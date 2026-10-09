"""
Firebase Auth verification + entitlement gating.

BRD §4.1: "The system must verify active subscription authorization
status instantly before releasing backend compute capacity or invoking
Google Vertex AI APIs." — enforced here, BEFORE any route hits an ADK
agent, not after.
"""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status
from firebase_admin import auth as firebase_auth

from app.config import settings
from app.firestore_client import user_doc


@dataclass
class AuthedUser:
    uid: str
    email: str
    country: str
    tier: str
    free_scans_used: int


async def verify_firebase_token(request: Request) -> dict:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = header.removeprefix("Bearer ").strip()
    try:
        return firebase_auth.verify_id_token(token)
    except Exception as exc:  # noqa: BLE001 — surfaced as a clean 401
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {exc}") from exc


async def get_current_user(decoded_token: dict = Depends(verify_firebase_token)) -> AuthedUser:
    """Loads the app-level user profile (country, tier, quota) that
    accompanies the verified Firebase identity."""
    # Safely extract UID across token variants
    uid = decoded_token.get("uid") or decoded_token.get("sub") or decoded_token.get("user_id")
    if not uid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token payload: missing UID")

    snapshot = await user_doc(uid).get()
    
    # Returning clean 404 triggers Expo to navigate to Onboarding
    if not snapshot.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found — complete onboarding"
        )

    data = snapshot.to_dict() or {}
    
    # Safe field access preventing KeyErrors (500 Internal Server Errors)
    email = data.get("email") or decoded_token.get("email", "")
    country = data.get("country", "")

    return AuthedUser(
        uid=uid,
        email=email,
        country=country,
        tier=data.get("tier", "free"),
        free_scans_used=data.get("freeScansUsed", 0),
    )


async def require_scan_entitlement(user: AuthedUser = Depends(get_current_user)) -> AuthedUser:
    """Gate that runs before any receipt/vision endpoint. Blocks the call
    from ever reaching Vertex AI if the free-tier quota is exhausted."""
    if user.tier == "premium":
        return user
    if user.free_scans_used >= settings.free_tier_monthly_scan_limit:
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            f"Free tier limit of {settings.free_tier_monthly_scan_limit} scans/month reached. "
            "Upgrade to Premium for unlimited scanning.",
        )
    return user