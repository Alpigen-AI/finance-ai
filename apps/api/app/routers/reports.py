
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from app.auth import AuthedUser, get_current_user
from app.firestore_client import FieldFilter, user_doc, user_subcollection
from services.financial.safe_to_spend import (
    RecurringObligation,
    compute_safe_to_spend,
)

from services.ai.agents.report_agent import (
    build_monthly_report,
    generate_monthly_insights,
)


router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/safe-to-spend")
async def get_safe_to_spend(
    user: AuthedUser = Depends(get_current_user),
):
    """Calculate the dashboard's safe-to-spend amount."""

    # Read linked transactions, if available.
    transactions = [
        doc.to_dict() or {}
        async for doc in user_subcollection(
            user.uid, "transactions"
        ).stream()
    ]

    # Fall back to the manually entered balance.
    profile_snapshot = await user_doc(user.uid).get()
    profile = profile_snapshot.to_dict() or {}

    balance = (
        sum(float(txn.get("amount") or 0) for txn in transactions)
        if transactions
        else float(profile.get("manualBalance", 0.0))
    )

    target_reserve = float(
        profile.get("targetSavingsReserve", 0.0)
    )

    obligation_docs = [
        doc.to_dict() or {}
        async for doc in user_subcollection(
            user.uid, "recurringObligations"
        )
        .where(filter=FieldFilter("isActive", "==", True))
        .stream()
    ]

    obligations = [
        RecurringObligation(
            label=item["label"],
            amount=float(item["amount"]),
            due_day_of_month=int(item["dueDayOfMonth"]),
        )
        for item in obligation_docs
        if item.get("label") is not None
        and item.get("amount") is not None
        and item.get("dueDayOfMonth") is not None
    ]

    result = compute_safe_to_spend(
        current_balance=balance,
        recurring_obligations=obligations,
        target_savings_reserve=target_reserve,
    )

    return {
        **result.to_dict(),
        "balance_source": (
            "bank_linked" if transactions else "manual"
        ),
    }


@router.get("/monthly/{month}")
async def get_monthly_report(
    month: str,
    user: AuthedUser = Depends(get_current_user),
):
    """
    Return the complete monthly financial report:
    budget, expenses, obligations, safe-to-spend, and insights.
    Expected month format: YYYY-MM.
    """

    # Validate YYYY-MM.
    try:
        parsed_month = date.fromisoformat(f"{month}-01")

        if parsed_month.strftime("%Y-%m") != month:
            raise ValueError

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Month must be in YYYY-MM format, e.g. 2026-10",
        )

    # Use the existing deterministic report builder.
    try:
        report = await build_monthly_report(
            user_id=user.uid,
            month=parsed_month.month,
            year=parsed_month.year,
        )
        return report

    except HTTPException:
        raise

    except Exception as exc:
        # Keep the actual exception in backend logs for debugging.
        import logging

        logging.getLogger(__name__).exception(
            "Failed to generate monthly report for %s",
            month,
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to generate the monthly report.",
        ) from exc


@router.get("/monthly/{month}/insights")
async def get_monthly_insights(
    month: str,
    user: AuthedUser = Depends(get_current_user),
):
    """AI-written monthly insights, generated from Firestore data."""

    try:
        parsed_month = date.fromisoformat(f"{month}-01")

        if parsed_month.strftime("%Y-%m") != month:
            raise ValueError

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Month must be in YYYY-MM format, e.g. 2026-10",
        )

    try:
        return await generate_monthly_insights(
            user_id=user.uid,
            month=parsed_month.month,
            year=parsed_month.year,
        )

    except Exception as exc:
        import logging

        logging.getLogger(__name__).exception(
            "Failed to generate insights for %s",
            month,
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to generate insights right now.",
        ) from exc