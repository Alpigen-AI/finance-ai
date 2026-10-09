from __future__ import annotations

from datetime import datetime, timezone 
import calendar

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import AuthedUser, get_current_user, verify_firebase_token
from app.firestore_client import user_doc, user_subcollection , FieldFilter

router = APIRouter(prefix="/users", tags=["users"])


class OnboardRequest(BaseModel):
    country: str          # "US" | "IN"
    currency: str          # "USD" | "INR"
    display_name: str | None = None


@router.post("/onboard")
async def onboard_user(body: OnboardRequest, decoded_token: dict = Depends(verify_firebase_token)):
    print("Received onboard request for body:", body)
    print("Decoded Firebase token UID:", decoded_token.get("uid"))

    if body.country not in ("US", "IN"):
        raise HTTPException(400, "country must be 'US' or 'IN'")

    try:
        uid = decoded_token["uid"]
        email = decoded_token.get("email") or decoded_token.get("phone_number", "")
        ref = user_doc(uid)
        
        # Verify if your client is async or synchronous
        existing = await ref.get()
        if existing.exists:
            return {"status": "already_onboarded", **existing.to_dict()}

        profile = {
            "email": email,
            "displayName": body.display_name,
            "country": body.country,
            "currency": body.currency,
            "tier": "free",
            "freeScansUsed": 0,
            "manualBalance": 0.0,
            "targetSavingsReserve": 0.0,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        await ref.set(profile, merge=True)
        print("Successfully wrote profile to Firestore for UID:", uid)
        return {"status": "onboarded", **profile}
    except Exception as err:
        print("ERROR IN ONBOARD ROUTE:", repr(err))
        raise HTTPException(status_code=500, detail=str(err))
    


@router.get("/me")
async def get_profile(user: AuthedUser = Depends(get_current_user)):
    snapshot = await user_doc(user.uid).get()
    return {"uid": user.uid, **snapshot.to_dict()}


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    country: str | None = None
    currency: str | None = None
    manual_balance: float | None = None
    target_savings_reserve: float | None = None


@router.patch("/me")
async def update_profile(body: ProfileUpdate, user: AuthedUser = Depends(get_current_user)):
    """Powers both the Balance-setup stopgap screen (manual_balance) and
    the Settings screen (display_name/country/currency edits)."""
    field_map = {
        "display_name": "displayName",
        "country": "country",
        "currency": "currency",
        "manual_balance": "manualBalance",
        "target_savings_reserve": "targetSavingsReserve",
    }
    updates = {
        field_map[k]: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None
    }
    if not updates:
        return {"status": "no changes"}
    await user_doc(user.uid).update(updates)
    return {"status": "updated", "fields": list(updates.keys())}


class ObligationRequest(BaseModel):
    label: str
    amount: float
    due_date: int
    paid: bool = False


def monthly_obligations_ref(uid: str, month: str):
    """
    Firestore structure:

    users/{uid}/obligations/{month}/items/{obligation_id}
    """

    return (
        user_subcollection(uid, "obligations")
        .document(month)
        .collection("items")
    )


@router.get("/me/obligations/{month}")
async def list_obligations(
    month: str,
    user: AuthedUser = Depends(get_current_user),
):
    ref = monthly_obligations_ref(user.uid, month)

    docs = [
        {"id": doc.id, **doc.to_dict()}
        async for doc in ref.stream()
    ]

    return {
        "month": month,
        "obligations": docs,
    }


@router.post("/me/obligations/{month}")
async def add_obligation(
    month: str,
    body: ObligationRequest,
    user: AuthedUser = Depends(get_current_user),
):
    ref = monthly_obligations_ref(user.uid, month).document()

    payload = {
        "label": body.label,
        "amount": body.amount,
        "due_date": body.due_date,
        "paid": body.paid,
    }

    await ref.set(payload)

    return {
        "id": ref.id,
        "month": month,
        "status": "created",
        **payload,
    }


@router.patch("/me/obligations/{month}/{obligation_id}")
async def update_obligation(
    month: str,
    obligation_id: str,
    body: ObligationRequest,
    user: AuthedUser = Depends(get_current_user),
):
    ref = monthly_obligations_ref(
        user.uid,
        month,
    ).document(obligation_id)

    snapshot = await ref.get()

    if not snapshot.exists:
        raise HTTPException(
            status_code=404,
            detail="Obligation not found",
        )

    payload = {
        "label": body.label,
        "amount": body.amount,
        "due_date": body.due_date,
        "paid": body.paid,
    }

    await ref.update(payload)

    return {
        "id": obligation_id,
        "month": month,
        "status": "updated",
        **payload,
    }


@router.delete("/me/obligations/{month}/{obligation_id}")
async def delete_obligation(
    month: str,
    obligation_id: str,
    user: AuthedUser = Depends(get_current_user),
):
    ref = monthly_obligations_ref(
        user.uid,
        month,
    ).document(obligation_id)

    snapshot = await ref.get()

    if not snapshot.exists:
        raise HTTPException(
            status_code=404,
            detail="Obligation not found",
        )

    await ref.delete()

    return {
        "id": obligation_id,
        "month": month,
        "status": "deleted",
    }
class SavingsRequest(BaseModel):
    month: str | None = None      
    total_allocated: float
    reserve: float = 0.0          


@router.post("/savings")
async def set_savings(
    body: SavingsRequest, user: AuthedUser = Depends(get_current_user)
):
    """Saves or updates a specific month's budget in the subcollection."""
    month = body.month or datetime.now(timezone.utc).strftime("%Y-%m")
    ref = user_subcollection(user.uid, "budgets").document(month)

    payload = {
        "month": month,
        "totalAllocated": body.total_allocated,
        "reserve": body.reserve,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    await ref.set(payload, merge=True)
    return {"status": "set", "month": month, **payload}

@router.get("/savings/history")
async def get_savings_history(user: AuthedUser = Depends(get_current_user)):
    """Fetches all monthly savings records for historical and yearly dashboard views."""
    budgets_stream = user_subcollection(user.uid, "budgets").stream()
    history = []

    async for doc in budgets_stream:
        data = doc.to_dict() or {}
        month = doc.id  # Document ID is "YYYY-MM"

        # Calculate expenses for this month
        try:
            year, m = map(int, month.split("-"))
            last_day = calendar.monthrange(year, m)[1]
            start_date = f"{month}-01"
            end_date = f"{month}-{last_day:02d}"
        except ValueError:
            continue

        expenses_query = (
            user_subcollection(user.uid, "expenses")
            .where(filter=FieldFilter("expenseDate", ">=", start_date))
            .where(filter=FieldFilter("expenseDate", "<=", end_date))
        )

        total_spent = 0.0
        async for exp in expenses_query.stream():
            total_spent += float(exp.to_dict().get("amount", 0.0))

        total_allocated = float(data.get("totalAllocated", 0.0))
        reserve = float(data.get("reserve", 0.0))

        history.append({
            "month": month,
            "totalAllocated": total_allocated,
            "totalSpent": total_spent,
            "reserve": reserve,
            "remaining": total_allocated - total_spent - reserve,
        })

    # Sort chronologically by month string
    history.sort(key=lambda x: x["month"], reverse=True)
    return {"history": history}


@router.get("/savings")
async def get_current_savings(user: AuthedUser = Depends(get_current_user)):
    """Defaults to fetching savings for the current active month (e.g., '2026-09')."""
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    return await get_monthly_savings(month=current_month, user=user)


@router.get("/savings/{month}")
async def get_monthly_savings(
    month: str,
    user: AuthedUser = Depends(get_current_user),
):
    # --------------------------------------------------
    # 1. Get monthly budget
    # users/{uid}/budgets/{month}
    # --------------------------------------------------

    budget_ref = (
        user_subcollection(user.uid, "budgets")
        .document(month)
    )

    budget_snapshot = await budget_ref.get()

    # No budget created for this month
    if not budget_snapshot.exists:
        return {
            "month": month,
            "totalAllocated": 0,
            "totalSpent": 0,
            "totalObligations": 0,
            "remaining": 0,
            "reserve": 0,
        }

    budget = budget_snapshot.to_dict() or {}

    total_allocated = float(
        budget.get("totalAllocated", 0)
    )

    reserve = float(
        budget.get("reserve", 0)
    )

    # --------------------------------------------------
    # 2. Calculate actual expenses for this month
    #
    # users/{uid}/expenses/{month}/items/{expense_id}
    # --------------------------------------------------

    expenses_ref = (
        user_subcollection(user.uid, "expenses")
        .document(month)
        .collection("items")
    )

    total_spent = 0.0

    async for expense_doc in expenses_ref.stream():
        expense = expense_doc.to_dict() or {}

        total_spent += float(
            expense.get("amount", 0)
        )

    # --------------------------------------------------
    # 3. Calculate fixed monthly obligations
    #
    # users/{uid}/obligations/{month}/items/{id}
    # --------------------------------------------------

    obligations_ref = monthly_obligations_ref(
        user.uid,
        month
    )

    total_obligations = 0.0

    async for obligation_doc in obligations_ref.stream():
        obligation = obligation_doc.to_dict() or {}

        total_obligations += float(
            obligation.get("amount", 0)
        )

    # --------------------------------------------------
    # 4. SAFE TO SPEND
    #
    # Budget - actual expenses - commitments
    # --------------------------------------------------

    remaining = (
        total_allocated
        - total_spent
        - total_obligations
    )

    # --------------------------------------------------
    # 5. Return dashboard values
    # --------------------------------------------------

    return {
        "month": month,
        "totalAllocated": total_allocated,
        "totalSpent": total_spent,
        "totalObligations": total_obligations,
        "remaining": max(remaining, 0),
        "reserve": reserve,
    }
@router.patch("/savings/{month}")
async def update_savings(
    month: str, body: SavingsRequest, user: AuthedUser = Depends(get_current_user)
):
    """Sets or updates the initial budget/allocation for the month."""
    ref = user_subcollection(user.uid, "budgets").document(month)
    payload = {
        "totalAllocated": body.total_allocated,
        "reserve": body.reserve,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    await ref.set(payload, merge=True)
    return {"status": "updated", "month": month, **payload}