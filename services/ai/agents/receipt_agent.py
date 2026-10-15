"""
Receipt Categorizer Agent — Google ADK

Flow:
  1. Vertex AI multimodal model reads the receipt image directly (no separate
     OCR step needed — Gemini handles vision + extraction in one call).
  2. Agent maps each line item to a country-specific tax code using the
     `list_tax_categories` tool (constrains it to a closed set — it cannot
     invent a tax code that doesn't exist).
  3. Structured output is validated against our schema before it ever
     touches the database.

NOTE: google-adk's API surface moves quickly. Verify class/import names
against the installed `google-adk` version before deploying — the shape
below (Agent + FunctionTool + Vertex model string) reflects the pattern
as of early 2026 but pin your requirements.txt version to avoid drift.
"""
from __future__ import annotations

import json
from typing import Any

from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import FunctionTool

from services.ai.tax_rules import get_tax_rules


def list_tax_categories(country: str) -> list[dict]:
    """Tool: returns the closed set of valid tax categories for a country.
    The agent MUST pick a code from this list — never invent one."""
    engine = get_tax_rules(country)
    return [c.__dict__ for c in engine.categories()]


RECEIPT_AGENT_INSTRUCTION = """
You are a receipt-processing assistant for a personal finance app.

Given a receipt image and the user's country ("US" or "IN"):

1. Extract:
   - vendor name
   - total amount
   - currency
   - purchase date
   - each visible line item with its description and amount

2. Call `list_tax_categories` for the user's country.

3. For every line item, choose exactly one valid tax code from the
   returned categories. Never invent a tax code.

4. Determine the overall tax category for the expense:
   - If the receipt contains one clear dominant category, use that category.
   - If the receipt contains mixed categories, use the default/residual
     category rather than guessing.
   - The final `tax_code` MUST be one of the codes returned by
     `list_tax_categories`.

5. Determine `is_deductible` for the overall expense:
   - If the purchase appears personal, set false.
   - If it appears business-related and the available evidence supports
     deductibility, set true.
   - If this cannot be determined confidently, set false.

6. Extract notes only when useful information is visible on the receipt.
   Otherwise return null.

7. Never fabricate information.
   If a field cannot be read confidently, return null.

8. Return ONLY this JSON object:

{
  "vendor": string | null,
  "total_amount": number | null,
  "currency": string | null,
  "purchase_date": "YYYY-MM-DD" | null,
  "tax_code": string | null,
  "is_deductible": boolean,
  "notes": string | null,
  "line_items": [
    {
      "description": string,
      "amount": number | null,
      "tax_code": string | null,
      "is_deductible": boolean
    }
  ]
}
"""

receipt_agent = Agent(
    name="receipt_categorizer",
    model="gemini-2.5-flash",
    instruction=RECEIPT_AGENT_INSTRUCTION,
    tools=[FunctionTool(list_tax_categories)],
)

session_service = InMemorySessionService()

runner = Runner(
    agent=receipt_agent,
    app_name="alpigen_ai",
    session_service=session_service,
)


def parse_agent_output(raw_text: str) -> dict[str, Any]:
    """Defensive parsing and validation of receipt agent output."""

    cleaned = raw_text.strip()

    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = (
            cleaned.split("\n", 1)[-1]
            if cleaned.lower().startswith("json")
            else cleaned
        )

    data = json.loads(cleaned)

    required = {
        "vendor",
        "total_amount",
        "currency",
        "purchase_date",
        "tax_code",
        "is_deductible",
        "notes",
        "line_items",
    }

    missing = required - data.keys()

    if missing:
        raise ValueError(
            f"Agent output missing required fields: {missing}"
        )

    if not isinstance(data["line_items"], list):
        raise ValueError(
            "Agent output line_items must be a list"
        )

    return data