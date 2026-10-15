
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from app.routers.users import get_monthly_savings
from app.auth import AuthedUser, get_current_user
from app.firestore_client import user_subcollection
from services.ai.agents.coach_agent import coach_agent

router = APIRouter(prefix="/chat", tags=["chat"])

_session_service = InMemorySessionService()
_APP_NAME = "finance_coach"


# ---------------------------------------------------------
# 1. Detect intent BEFORE fetching financial records.
#    Unknown or ambiguous messages do not trigger data reads.
# ---------------------------------------------------------

def detect_financial_intent(message: str) -> str:
    text = message.lower().strip()
    text = re.sub(r"\s+", " ", text)

    safe_spend_patterns = [
        r"\bsafely spend\b",
        r"\bsafe to spend\b",
        r"\bhow much can i spend\b",
        r"\bhow much can i afford\b",
        r"\bspend kar sakta\b",
        r"\bkharch kar sakta\b",
        r"\bkitna kharch\b",
    ]

    obligations_patterns = [
        r"\bupcoming obligations\b",
        r"\bmy obligations\b",
        r"\bmy upcoming bills\b",
        r"\bwhat bills\b",
        r"\bbills do i have\b",
        r"\bpayments due\b",
        r"\bupcoming payments\b",
        r"\bmeri bills\b",
        r"\bkaunse bills\b",
        r"\bkonsi bills\b",
    ]

    spending_patterns = [
        r"\banaly[sz]e .*spending\b",
        r"\banaly[sz]e .*expenses\b",
        r"\bthis month.s spending\b",
        r"\bmonthly spending\b",
        r"\bmy expenses\b",
        r"\bwhere did .* spend\b",
        r"\bspending breakdown\b",
        r"\bkharch[a-z]* kahan\b",
        r"\bkahan kharch\b",
        r"\bexpenses batao\b",
    ]

    if any(re.search(p, text) for p in safe_spend_patterns):
        return "safe_to_spend"

    if any(re.search(p, text) for p in obligations_patterns):
        return "upcoming_obligations"

    if any(re.search(p, text) for p in spending_patterns):
        return "monthly_spending"

    # Includes broad prompts such as "Help me with my finances".
    # The coach can ask a follow-up without reading financial data.
    return "general"


# ---------------------------------------------------------
# 2. Read only the authenticated user's selected month.
# ---------------------------------------------------------

async def read_month_items(
    uid: str,
    collection_name: str,
    month: str,
) -> list[dict[str, Any]]:
    items_ref = (
        user_subcollection(uid, collection_name)
        .document(month)
        .collection("items")
    )

    results = []

    async for doc in items_ref.stream():
        item = doc.to_dict() or {}
        item["id"] = doc.id
        results.append(item)

    return results



async def get_monthly_financial_context(
    uid: str,
    month: str,
    intent: str,
    user: AuthedUser,
) -> dict:
    result = {
        "month": month,
        "intent": intent,
    }

    # Reuse your existing users router calculation.
    # This returns totalAllocated, totalSpent, totalObligations,
    # remaining and reserve.
    
    if intent == "safe_to_spend":
        savings = await get_monthly_savings(
            month=month,
            user=user,
        )

        print(
            "[SAFE_TO_SPEND DEBUG]",
            {
                "uid": uid,
                "month": month,
                "intent": intent,
                "savings": savings,
            },
        )

        result["safe_to_spend"] = {
            "totalAllocated": float(savings.get("totalAllocated", 0) or 0),
            "totalSpent": float(savings.get("totalSpent", 0) or 0),
            "totalObligations": float(savings.get("totalObligations", 0) or 0),
            "remaining": float(savings.get("remaining", 0) or 0),
            "reserve": float(savings.get("reserve", 0) or 0),
        }


    # Spending analysis: fetch the expense records for details.
    if intent == "monthly_spending":
        expenses_ref = (
            user_subcollection(uid, "expenses")
            .document(month)
            .collection("items")
        )

        expenses = []
        async for doc in expenses_ref.stream():
            item = doc.to_dict() or {}
            item["id"] = doc.id
            expenses.append(item)

        result["expenses"] = expenses
        result["total_spent"] = round(
            sum(
                float(
                    item.get("amount", item.get("totalAmount", 0))
                    or 0
                )
                for item in expenses
            ),
            2,
        )

    # Fetch obligations only when relevant.
    if intent in {"upcoming_obligations", "safe_to_spend"}:
        obligations_ref = (
            user_subcollection(uid, "obligations")
            .document(month)
            .collection("items")
        )

        paid_obligations = []
        unpaid_obligations = []

        async for doc in obligations_ref.stream():
            item = doc.to_dict() or {}
            item["id"] = doc.id
            amount = float(item.get("amount", 0) or 0)

            if item.get("paid") is True:
                paid_obligations.append(item)
            else:
                unpaid_obligations.append(item)

        result["paid_obligations"] = paid_obligations
        result["unpaid_obligations"] = unpaid_obligations

        result["total_paid_obligations"] = round(
            sum(float(x.get("amount", 0) or 0)
                for x in paid_obligations),
            2,
        )

        result["total_unpaid_obligations"] = round(
            sum(float(x.get("amount", 0) or 0)
                for x in unpaid_obligations),
            2,
        )
        print(
            "[CHAT FINANCIAL CONTEXT]",
            json.dumps(result, ensure_ascii=False),
        )

    return result








# ---------------------------------------------------------
# 3. Chat endpoint.
#    Firestore history is loaded only when a session is new.
# ---------------------------------------------------------

@router.post("")
async def send_message(
    message: str,
    user: AuthedUser = Depends(get_current_user),
):
    now = datetime.now(timezone.utc).isoformat()
    messages_ref = user_subcollection(user.uid, "chatMessages")

    session_id = f"session_{user.uid}"

    existing = await _session_service.get_session(
        app_name=_APP_NAME,
        user_id=user.uid,
        session_id=session_id,
    )

    # Load prior chat history only when this process has no session
    # for this user. Do not query history on every message.
    previous_history: list[dict[str, Any]] = []

    if existing is None:
        history_query = (
            messages_ref
            .order_by("createdAt", direction="DESCENDING")
            .limit(20)
        )

        history_docs = [
            doc.to_dict() async for doc in history_query.stream()
        ]
        previous_history = list(reversed(history_docs))

        await _session_service.create_session(
            app_name=_APP_NAME,
            user_id=user.uid,
            session_id=session_id,
        )

    # Save the current message after retrieving any prior history.
    await messages_ref.document().set({
        "role": "user",
        "content": message,
        "createdAt": now,
    })

    intent = detect_financial_intent(message)

    financial_context = None
    if intent != "general":
        current_month = datetime.now().strftime("%Y-%m")

        financial_context = await get_monthly_financial_context(
            uid=user.uid,
            month=current_month,
            intent=intent,
            user=user,
        )

    # Supply history only when initializing a new ADK session.
    # Later turns rely on the existing ADK session state.
    context_parts = [
        f"User country: {user.country}",
        f"Request intent: {intent}",
    ]

    if existing is None and previous_history:
        context_parts.append(
            "Previous conversation (reference only): "
            + json.dumps(previous_history, ensure_ascii=False)
        )

    if financial_context is not None:
        context_parts.append(
            "Verified financial data for this request: "
            + json.dumps(financial_context, ensure_ascii=False)
        )

    prompt = (
        message
        + "\n\n[Server-provided context]\n"
        + "\n".join(context_parts)
    )

    runner = Runner(
        agent=coach_agent,
        app_name=_APP_NAME,
        session_service=_session_service,
    )

    new_message = types.Content(
        role="user",
        parts=[types.Part(text=prompt)],
    )

    reply_text = ""

    async for event in runner.run_async(
        user_id=user.uid,
        session_id=session_id,
        new_message=new_message,
    ):
        if (
            event.is_final_response()
            and event.content
            and event.content.parts
        ):
            reply_text = event.content.parts[0].text or ""
            break

    await messages_ref.document().set({
        "role": "agent",
        "content": reply_text,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    return {"reply": reply_text}


@router.get("/history")
async def get_history(
    user: AuthedUser = Depends(get_current_user),
):
    query = (
        user_subcollection(user.uid, "chatMessages")
        .order_by("createdAt", direction="ASCENDING")
    )

    messages = [
        doc.to_dict() async for doc in query.stream()
    ]

    return {"messages": messages}
