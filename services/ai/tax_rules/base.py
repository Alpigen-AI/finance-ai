"""
Strategy pattern for country-specific tax categorization.
One interface, swapped at runtime based on `user.country` — this is the
single seam that keeps US and India logic from leaking into each other.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class TaxCategory:
    code: str
    label: str
    country: str


class TaxRuleEngine(ABC):
    country: str

    @abstractmethod
    def categories(self) -> list[TaxCategory]:
        """All valid categories for this jurisdiction — used to constrain
        the ADK agent's structured output (never let it invent a code)."""

    @abstractmethod
    def default_category(self) -> TaxCategory:
        """Fallback when the agent can't confidently classify a line item."""
