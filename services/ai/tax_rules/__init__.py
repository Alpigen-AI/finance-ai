from .base import TaxCategory, TaxRuleEngine
from .in_rules import INTaxRules
from .us_rules import USTaxRules

_ENGINES: dict[str, TaxRuleEngine] = {
    "US": USTaxRules(),
    "IN": INTaxRules(),
}


def get_tax_rules(country: str) -> TaxRuleEngine:
    try:
        return _ENGINES[country]
    except KeyError:
        raise ValueError(f"Unsupported country: {country!r}. Expected 'US' or 'IN'.")


def resolve_tax_code(country: str, code: str) -> TaxCategory:
    """Validates tax_code against country rules, falling back to default if invalid."""
    engine = get_tax_rules(country)
    valid = {c.code: c for c in engine.categories()}
    return valid.get(code, engine.default_category())


__all__ = [
    "TaxRuleEngine",
    "TaxCategory",
    "get_tax_rules",
    "resolve_tax_code",
    "USTaxRules",
    "INTaxRules",
]