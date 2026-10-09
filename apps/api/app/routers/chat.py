from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from app.auth import AuthedUser, get_current_user
from app.firestore_client import user_subcollection
from services.ai.agents.coach_agent import coach_agent

router = APIRouter(prefix="/chat", tags=["chat"])

# One shared session service for the lifetime of the process.
# Sessions are keyed by user UID so history is isolated per user.
_session_service = InMemorySessionService()
_APP_NAME = "finance_coach"


@router.post("")
async def send_message(message: str, user: AuthedUser = Depends(get_current_user)):
    """Single endpoint used by BOTH the mobile app and the web dashboard —
    same agent, same conversation history, so a user can start a chat on
    web and continue it on mobile."""
    messages_ref = user_subcollection(user.uid, "chatMessages")
    now = datetime.now(timezone.utc).isoformat()

    await messages_ref.document().set({"role": "user", "content": message, "createdAt": now})

    history_query = messages_ref.order_by("createdAt", direction="DESCENDING").limit(20)
    history_docs = [doc.to_dict() async for doc in history_query.stream()]
    history = list(reversed(history_docs))

    # Ensure a session exists for this user (one session per user, reused
    # across requests so the Runner can track multi-turn context internally).
    session_id = f"session_{user.uid}"
    existing = await _session_service.get_session(
        app_name=_APP_NAME, user_id=user.uid, session_id=session_id
    )
    if existing is None:
        await _session_service.create_session(
            app_name=_APP_NAME, user_id=user.uid, session_id=session_id
        )

    runner = Runner(
        agent=coach_agent,
        app_name=_APP_NAME,
        session_service=_session_service,
    )

    new_message = types.Content(
        role="user",
        parts=[
            types.Part(
                text=(
                    f"{message}\n\n"
                    f"[context: country={user.country}, "
                    f"recent_history={history}]"
                )
            )
        ],
    )

    reply_text = ""
    async for event in runner.run_async(
        user_id=user.uid,
        session_id=session_id,
        new_message=new_message,
    ):
        if event.is_final_response() and event.content and event.content.parts:
            reply_text = event.content.parts[0].text
            break

    await messages_ref.document().set({
        "role": "agent",
        "content": reply_text,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })

    return {"reply": reply_text}


@router.get("/history")
async def get_history(user: AuthedUser = Depends(get_current_user)):
    query = user_subcollection(user.uid, "chatMessages").order_by("createdAt", direction="ASCENDING")
    messages = [doc.to_dict() async for doc in query.stream()]
    return {"messages": messages}
