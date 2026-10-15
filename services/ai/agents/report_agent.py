"""
Reporting Agent — Alpigen AI

Flow:
1. The app calls /reports/monthly/{month}/insights.
2. The route calls generate_monthly_insights(user_id, month, year).
3. The insights agent calls its fetch_monthly_data tool, which reads the
   user's budget, expenses and obligations from Firestore.
4. The LLM writes the insights as JSON (most spent, most/least purchased,
   watch out, key takeaway, tips) and the app renders them.

The agent never modifies financial records. The user_id/month/year come
from the session state, NOT from the LLM, so the model cannot request
another user's data.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Any

from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import FunctionTool, ToolContext
from google.genai import types

# IMPORTANT: change this import to where your user_subcollection helper lives.
from apps.api.app.firestore_client import user_subcollection

logger = logging.getLogger(__name__)

APP_NAME = "alpigen_insights"
MODEL = "gemini-2.5-flash"


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def money(value: Any) -> float:
    """Safely convert a Firestore numeric value to a float."""
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def to_date(value: Any) -> date | None:
    """Convert a Firestore timestamp / datetime / ISO string to a date."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except ValueError:
            return None
    return None


def month_key_of(month: int, year: int) -> str:
    return f"{year:04d}-{month:02d}"


# --------------------------------------------------------------------------
# Firestore fetchers (read-only)
# --------------------------------------------------------------------------

async def get_monthly_expenses(user_id: str, month: int, year: int) -> dict:
    """Fetch the month's expenses and build ledger entries."""
    month_key = month_key_of(month, year)

    expenses_ref = (
        user_subcollection(user_id, "expenses")
        .document(month_key)
        .collection("items")
    )

    ledger_entries: list[dict] = []
    category_totals: dict[str, float] = defaultdict(float)
    total_spent = 0.0

    async for doc in expenses_ref.stream():
        item = doc.to_dict() or {}

        amount = money(item.get("amount"))
        category = item.get("taxLabel") or item.get("taxCode") or "Uncategorized"
        expense_date = to_date(item.get("expenseDate"))

        total_spent += amount
        category_totals[category] += amount

        ledger_entries.append({
            "id": doc.id,
            "type": "expense",
            "date": expense_date.isoformat() if expense_date else None,
            "description": item.get("vendor") or "Expense",
            "amount": amount,
            "category": category,
            "currency": item.get("currency"),
            "source": item.get("source", "manual"),
            "receiptId": item.get("receiptId"),
        })

    ledger_entries.sort(key=lambda e: e.get("date") or "", reverse=True)

    return {
        "month": month_key,
        "totalSpent": round(total_spent, 2),
        "expenseCount": len(ledger_entries),
        "categoryBreakdown": [
            {
                "category": category,
                "amount": round(amount, 2),
                "percentage": (
                    round(amount / total_spent * 100, 1) if total_spent > 0 else 0
                ),
            }
            for category, amount in sorted(
                category_totals.items(), key=lambda p: p[1], reverse=True
            )
        ],
        "ledgerEntries": ledger_entries,
    }


async def get_monthly_obligations(user_id: str, month: int, year: int) -> dict:
    """Fetch monthly commitments such as rent, bills and subscriptions."""
    month_key = month_key_of(month, year)

    obligations_ref = (
        user_subcollection(user_id, "obligations")
        .document(month_key)
        .collection("items")
    )

    entries: list[dict] = []
    total_obligations = 0.0
    paid_count = 0

    async for doc in obligations_ref.stream():
        item = doc.to_dict() or {}
        amount = money(item.get("amount"))

        # All monthly commitments count toward safe-to-spend, paid or not.
        total_obligations += amount

        if item.get("paid", False):
            paid_count += 1

        due = to_date(item.get("due_date"))

        entries.append({
            "id": doc.id,
            "type": "obligation",
            "description": item.get("label", "Obligation"),
            "amount": amount,
            "dueDate": due.isoformat() if due else None,
            "paid": bool(item.get("paid", False)),
        })

    return {
        "month": month_key,
        "totalObligations": round(total_obligations, 2),
        "obligationCount": len(entries),
        "paidCount": paid_count,
        "entries": entries,
    }


async def get_monthly_budget(user_id: str, month: int, year: int) -> dict:
    """Fetch the user's monthly budget target."""
    month_key = month_key_of(month, year)

    snapshot = await user_subcollection(user_id, "budgets").document(month_key).get()
    data = snapshot.to_dict() or {}

    return {
        "month": month_key,
        "totalAllocated": money(data.get("totalAllocated")),
        "reserve": money(data.get("reserve")),
        "budgetExists": snapshot.exists,
    }


# --------------------------------------------------------------------------
# Deterministic report (used by /reports/monthly/{month})
# --------------------------------------------------------------------------

async def build_monthly_report(user_id: str, month: int, year: int) -> dict:
    """Deterministic monthly report. No LLM is used for any amount."""
    if not 1 <= month <= 12:
        raise ValueError("month must be between 1 and 12")

    budget, expenses, obligations = await asyncio.gather(
        get_monthly_budget(user_id, month, year),
        get_monthly_expenses(user_id, month, year),
        get_monthly_obligations(user_id, month, year),
    )

    allocated = budget["totalAllocated"]
    spent = expenses["totalSpent"]
    committed = obligations["totalObligations"]

    # Matches the Home screen's safe-to-spend calculation.
    safe_to_spend = max(0.0, round(allocated - spent - committed, 2))
    over_budget = max(0.0, round(spent + committed - allocated, 2))

    return {
        "month": budget["month"],
        "currency": None,
        "budgetExists": budget["budgetExists"],
        "summary": {
            "budget": allocated,
            "reserve": budget["reserve"],
            "totalSpent": spent,
            "totalObligations": committed,
            "safeToSpend": safe_to_spend,
            "overBudget": over_budget,
            "expenseCount": expenses["expenseCount"],
            "obligationCount": obligations["obligationCount"],
        },
        "categoryBreakdown": expenses["categoryBreakdown"],
        "ledgerEntries": sorted(
            expenses["ledgerEntries"] + obligations["entries"],
            key=lambda e: str(e.get("date") or e.get("dueDate") or ""),
            reverse=True,
        ),
        "obligations": {
            "paidCount": obligations["paidCount"],
            "unpaidCount": obligations["obligationCount"] - obligations["paidCount"],
        },
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


# --------------------------------------------------------------------------
# Item statistics (pre-ranked so the LLM only has to explain them)
# --------------------------------------------------------------------------

def build_item_stats(expense_entries: list[dict]) -> dict:
    """Group expenses by item (vendor/description): count and total spent."""
    groups: dict[str, dict] = {}

    for entry in expense_entries:
        name = (entry.get("description") or "Expense").strip()
        key = name.lower()
        group = groups.setdefault(
            key,
            {"name": name, "count": 0, "totalSpent": 0.0, "category": entry.get("category")},
        )
        group["count"] += 1
        group["totalSpent"] += entry["amount"]

    items = [
        {**g, "totalSpent": round(g["totalSpent"], 2)} for g in groups.values()
    ]

    by_count_desc = sorted(items, key=lambda i: (-i["count"], -i["totalSpent"]))
    by_count_asc = sorted(items, key=lambda i: (i["count"], i["totalSpent"]))
    by_spend_desc = sorted(items, key=lambda i: -i["totalSpent"])

    all_same_frequency = len({i["count"] for i in items}) <= 1

    return {
        "distinctItems": len(items),
        "allItemsSameFrequency": all_same_frequency,
        "mostPurchased": by_count_desc[:3],
        "leastPurchased": by_count_asc[:3],
        "mostSpentOn": by_spend_desc[:5],
    }


# --------------------------------------------------------------------------
# Agent tool: fetches the month's data from Firestore
# --------------------------------------------------------------------------

async def fetch_monthly_data(tool_context: ToolContext) -> dict:
    """
    Fetch the user's data for the month being analysed: budget target,
    expenses, fixed obligations, category breakdown and item statistics
    (most purchased, least purchased, most spent on). Takes no arguments;
    the user and month are already set for this session.
    """
    state = tool_context.state
    user_id = state["user_id"]
    month = int(state["month"])
    year = int(state["year"])

    report = await build_monthly_report(user_id, month, year)
    summary = report["summary"]

    expenses = [e for e in report["ledgerEntries"] if e["type"] == "expense"]
    obligations = [e for e in report["ledgerEntries"] if e["type"] == "obligation"]

    if not expenses and not obligations:
        return {"hasData": False, "month": report["month"]}

    largest = sorted(expenses, key=lambda e: e["amount"], reverse=True)[:10]
    used = round(summary["totalSpent"] + summary["totalObligations"], 2)

    return {
        "hasData": True,
        "month": report["month"],
        "currency": "INR",
        "budgetTarget": summary["budget"],
        "budgetIsSet": report["budgetExists"] and summary["budget"] > 0,
        "totalSpent": summary["totalSpent"],
        "totalObligations": summary["totalObligations"],
        "totalUsed": used,
        "budgetUsedPercent": (
            round(used / summary["budget"] * 100, 1) if summary["budget"] > 0 else None
        ),
        "safeToSpend": summary["safeToSpend"],
        "overBudgetBy": summary["overBudget"],
        "expenseCount": summary["expenseCount"],
        "categoryBreakdown": report["categoryBreakdown"],
        "itemStats": build_item_stats(expenses),
        "largestExpenses": [
            {
                "description": e["description"],
                "amount": e["amount"],
                "category": e["category"],
                "date": e["date"],
            }
            for e in largest
        ],
        "obligations": [
            {"description": o["description"], "amount": o["amount"], "paid": o["paid"]}
            for o in obligations
        ],
    }


# --------------------------------------------------------------------------
# The insights agent
# --------------------------------------------------------------------------

INSIGHTS_INSTRUCTION = """
You are Alpigen AI's personal finance coach.

Step 1: Call the fetch_monthly_data tool exactly once. It takes no arguments.
Step 2: Using ONLY the data it returns, write the monthly insights.

Rules:
- Never invent, estimate or recalculate any amount, count or percentage.
  Quote the numbers exactly as they appear in the tool result.
- Amounts are in INR; write them like ₹1,250.
- Do not compare with other months (no other month's data is provided).
- If hasData is false, return {"available": false,
  "message": "No expenses or commitments recorded for this month yet."}.
- If budgetIsSet is false, say a budget has not been set and do not talk
  about budget usage.
- If itemStats.allItemsSameFrequency is true, say every item was bought
  equally often instead of naming a "most/least purchased" item.
- Be specific: name items and categories. Be friendly, practical and
  concise. No lecturing, no shaming.

Respond with ONLY a JSON object, no markdown fences, no extra text:
{
  "available": true,
  "summary": "2-3 sentence overview of the month",
  "budgetStatus": {
    "status": "on_track" | "close_to_limit" | "over_budget" | "no_budget",
    "message": "one sentence about the budget target vs what was used"
  },
  "mostSpentOn": {
    "name": "item or vendor with the highest total spend",
    "amount": 0,
    "comment": "one sentence"
  },
  "topCategory": {
    "category": "category with the highest spend",
    "amount": 0,
    "percentage": 0,
    "comment": "one sentence"
  },
  "mostPurchased": {
    "name": "most frequently bought item",
    "count": 0,
    "comment": "one sentence"
  },
  "leastPurchased": {
    "name": "least frequently bought item",
    "count": 0,
    "comment": "one sentence"
  },
  "watchOut": [
    {"title": "short title", "detail": "what the user should be careful about"}
  ],
  "keyTakeaway": "the single most useful thing to do to save more next month",
  "nextMonthTips": ["tip 1", "tip 2", "tip 3"]
}
Use null for mostPurchased / leastPurchased if they do not apply.
watchOut: 1 to 3 items. nextMonthTips: exactly 3 specific, actionable tips.
"""

insights_agent = Agent(
    name="monthly_insights_agent",
    model=MODEL,
    instruction=INSIGHTS_INSTRUCTION,
    tools=[FunctionTool(fetch_monthly_data)],
    # Note: no response_mime_type here. Gemini does not allow forced JSON
    # output together with function calling, so the JSON is enforced by the
    # prompt and parsed defensively below.
    generate_content_config=types.GenerateContentConfig(temperature=0.3),
)

_session_service = InMemorySessionService()
_runner = Runner(
    agent=insights_agent,
    app_name=APP_NAME,
    session_service=_session_service,
)


def _extract_json(text: str) -> dict:
    """Pull the first JSON object out of the model's reply."""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("Model did not return JSON")
    return json.loads(text[start : end + 1])


async def _run_agent(user_id: str, month: int, year: int) -> str:
    session_id = str(uuid.uuid4())

    # user_id / month / year live in session state so the tool reads them
    # from here, never from LLM-supplied arguments.
    await _session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
        state={"user_id": user_id, "month": month, "year": year},
    )

    message = types.Content(
        role="user",
        parts=[types.Part(text="Generate the monthly insights for this user.")],
    )

    final_text = ""
    async for event in _runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=message,
    ):
        if event.is_final_response() and event.content and event.content.parts:
            final_text = "".join(p.text or "" for p in event.content.parts)

    return final_text


async def generate_monthly_insights(user_id: str, month: int, year: int) -> dict:
    """Run the insights agent and return JSON for the mobile app."""
    if not 1 <= month <= 12:
        raise ValueError("month must be between 1 and 12")

    insights: dict | None = None

    for attempt in range(2):  # one retry if the model returns bad JSON
        text = await _run_agent(user_id, month, year)
        try:
            insights = _extract_json(text)
            break
        except (ValueError, json.JSONDecodeError):
            logger.warning(
                "Insights JSON parse failed (attempt %d): %r", attempt + 1, text[:300]
            )

    if insights is None:
        raise RuntimeError("Could not generate insights")

    insights.setdefault("available", True)

    return {
        "month": month_key_of(month, year),
        **insights,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }