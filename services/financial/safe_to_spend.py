"""
Deterministic Safe-to-Spend engine.

BRD requirement (§4.3): "Raw baseline accounting calculations ... must run
strictly inside isolated database engines to eliminate artificial model
errors or ledger hallucinations."

This module is PURE PYTHON MATH — no LLM calls happen here. The ADK
"coach" agent calls `compute_safe_to_spend` as a *tool* and only narrates
the result; it never invents the numbers itself.
"""
from __future__ import annotations

import calendar
from dataclasses import dataclass, asdict
from datetime import date
from typing import Sequence


@dataclass
class RecurringObligation:
    label: str
    amount: float
    due_day_of_month: int


@dataclass
class SafeToSpendResult:
    as_of: str
    current_balance: float
    upcoming_obligations: float
    target_savings_reserve: float
    safe_to_spend_today: float
    safe_to_spend_this_month: float

    def to_dict(self) -> dict:
        return asdict(self)


def _days_left_in_month(today: date) -> int:
    last_day = calendar.monthrange(today.year, today.month)[1]
    return last_day - today.day + 1


def _obligations_due_before_month_end(
    obligations: Sequence[RecurringObligation], today: date
) -> float:
    """Sum obligations whose due day hasn't passed yet this month."""
    return sum(
        o.amount for o in obligations if o.due_day_of_month >= today.day
    )


def compute_safe_to_spend(
    current_balance: float,
    recurring_obligations: Sequence[RecurringObligation],
    target_savings_reserve: float,
    today: date | None = None,
) -> SafeToSpendResult:
    """
    Core formula:
        safe_to_spend_this_month = balance - upcoming_obligations - savings_reserve
        safe_to_spend_today      = safe_to_spend_this_month / days_left_in_month

    Both floored at 0 — we never tell a user they can spend a negative amount.
    """
    today = today or date.today()
    upcoming = _obligations_due_before_month_end(recurring_obligations, today)

    safe_month = max(0.0, current_balance - upcoming - target_savings_reserve)
    days_left = max(1, _days_left_in_month(today))
    safe_today = round(safe_month / days_left, 2)

    return SafeToSpendResult(
        as_of=today.isoformat(),
        current_balance=round(current_balance, 2),
        upcoming_obligations=round(upcoming, 2),
        target_savings_reserve=round(target_savings_reserve, 2),
        safe_to_spend_today=safe_today,
        safe_to_spend_this_month=round(safe_month, 2),
    )


def evaluate_purchase(
    proposed_amount: float,
    safe_to_spend_today: float,
    safe_to_spend_this_month: float,
) -> str:
    """
    Returns a strict, non-negotiable verdict — "yes" / "wait" / "no".
    This is the deterministic backbone behind the chatbot's purchase
    evaluations; the agent must not override this verdict, only explain it.
    """
    if proposed_amount <= safe_to_spend_today:
        return "yes"
    if proposed_amount <= safe_to_spend_this_month:
        return "wait"  # affordable this month, but would eat into other days
    return "no"
