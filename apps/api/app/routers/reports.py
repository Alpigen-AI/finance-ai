from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth import AuthedUser, get_current_user
from app.firestore_client import FieldFilter, user_doc, user_subcollection
from services.financial.safe_to_spend import RecurringObligation, compute_safe_to_spend

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/safe-to-spend")
async def get_safe_to_spend(user: AuthedUser = Depends(get_current_user)):
    """Powers the dashboard's headline number.

    Balance source, in priority order:
      1. Linked bank transactions (Phase 3 — not built yet, so this is
         currently always empty for every user)
      2. manualBalance on the user profile — the Phase-0 stopgap set via
         the Balance Setup screen / PATCH /users/me
    """
    txns = [doc.to_dict() async for doc in user_subcollection(user.uid, "transactions").stream()]
    profile_snapshot = await user_doc(user.uid).get()
    profile = profile_snapshot.to_dict() or {}

    balance = sum(t["amount"] for t in txns) if txns else float(profile.get("manualBalance", 0.0))
    target_reserve = float(profile.get("targetSavingsReserve", 0.0))

    obligation_docs = [
        doc.to_dict()
        async for doc in user_subcollection(user.uid, "recurringObligations")
        .where(filter=FieldFilter("isActive", "==", True))
        .stream()
    ]
    obligations = [
        RecurringObligation(label=o["label"], amount=o["amount"], due_day_of_month=o["dueDayOfMonth"])
        for o in obligation_docs
    ]

    result = compute_safe_to_spend(
        current_balance=balance,
        recurring_obligations=obligations,
        target_savings_reserve=target_reserve,
    )
    return {**result.to_dict(), "balance_source": "bank_linked" if txns else "manual"}


@router.get("/monthly/{month}")
async def get_monthly_report(month: str, user: AuthedUser = Depends(get_current_user)):
    """month format: YYYY-MM. Computed on-demand from the expenses
    subcollection; cache into monthlyReports/{month} once the month closes."""
    start, end = f"{month}-01", f"{month}-31"
    query = (
        user_subcollection(user.uid, "expenses")
        .where(filter=FieldFilter("expenseDate", ">=", start))
        .where(filter=FieldFilter("expenseDate", "<=", end))
    )
    expenses = [doc.to_dict() async for doc in query.stream()]

    total = sum(e["amount"] for e in expenses)
    
    # 1. Safely compute total deductible amount
    deductible = sum(
        e["amount"] for e in expenses if e.get("isDeductible", True) is not False
    )

    # 2. Safely group by tax label (handling missing/None keys)
    by_category: dict[str, float] = {}
    for e in expenses:
        label = e.get("taxLabel") or "Uncategorized"
        by_category[label] = by_category.get(label, 0.0) + e["amount"]

    return {
        "month": month,
        "total_expenses": round(total, 2),
        "total_deductible": round(deductible, 2),
        "by_category": {k: round(v, 2) for k, v in by_category.items()},
        "count": len(expenses),  # Optional: return total number of expense entries
    }