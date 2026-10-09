"""
Financial Coach Agent — Google ADK

This is the conversational chatbot shown in both the mobile app and the
web dashboard. It discusses personal finance, nudges the user away from
unnecessary spending, and answers "can I afford X?" questions.

CRITICAL DESIGN RULE (BRD §4.3 + §5): this agent NEVER computes balances,
safe-to-spend numbers, or purchase verdicts itself. It calls the
deterministic `services/financial/safe_to_spend.py` engine as a tool and
only narrates/contextualizes the result. This eliminates ledger
hallucinations and keeps the numbers audit-safe.

It also never claims to be a CPA / certified financial advisor — BRD §5
requires an explicit "informational tool, not professional advice"
disclaimer to be enforced at the product layer (see COACH_DISCLAIMER).
"""
from __future__ import annotations

from datetime import date

from google.adk.agents import Agent
from google.adk.tools import FunctionTool

from services.financial.safe_to_spend import (
    RecurringObligation,
    compute_safe_to_spend,
    evaluate_purchase,
)

COACH_DISCLAIMER = (
    "I'm an automated financial insights tool, not a certified accountant "
    "or financial advisor — for tax filing or investment decisions, please "
    "consult a licensed professional."
)


def get_safe_to_spend(
    current_balance: float,
    target_savings_reserve: float,
    obligations: list[dict],
) -> dict:
    """Tool: deterministic safe-to-spend calculation. `obligations` is a
    list of {"label": str, "amount": float, "due_day_of_month": int}."""
    parsed = [RecurringObligation(**o) for o in obligations]
    result = compute_safe_to_spend(
        current_balance=current_balance,
        recurring_obligations=parsed,
        target_savings_reserve=target_savings_reserve,
        today=date.today(),
    )
    return result.to_dict()


def get_purchase_verdict(
    proposed_amount: float,
    safe_to_spend_today: float,
    safe_to_spend_this_month: float,
) -> dict:
    """Tool: strict yes/no/wait verdict — deterministic, not LLM-decided."""
    verdict = evaluate_purchase(proposed_amount, safe_to_spend_today, safe_to_spend_this_month)
    return {"verdict": verdict}


COACH_INSTRUCTION = f"""
You are a friendly, encouraging personal finance coach inside a budgeting app.

Ground rules:
- For ANY question involving money the user has, upcoming bills, or whether
  they can afford something, you MUST call `get_safe_to_spend` and/or
  `get_purchase_verdict` first. Never estimate or guess these numbers
  yourself — you have no reliable memory of the user's real balance.
- When you deliver a purchase verdict, state it plainly as the tool
  returned it ("yes" / "wait" / "no") and then explain the reasoning in
  plain language. Do not soften or override the tool's verdict.
- Proactively point out spending patterns that look avoidable (e.g.
  frequent small discretionary charges) and suggest one concrete,
  specific action — not generic "budget better" advice.
- Be warm and motivating, never shaming, about past spending.
- Do not give investment advice, tax-filing instructions, or legal advice.
  If asked, respond with: "{COACH_DISCLAIMER}"
- Keep responses short (2-4 sentences) unless the user asks for detail —
  this is a chat interface, not a report.
"""

coach_agent = Agent(
    name="financial_coach",
    model="gemini-2.5-flash",
    instruction=COACH_INSTRUCTION,
    tools=[FunctionTool(get_safe_to_spend), FunctionTool(get_purchase_verdict)],
)
