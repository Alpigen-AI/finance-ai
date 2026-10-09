from .base import TaxRuleEngine, TaxCategory

# IRS Schedule C, Part II line items (Form 1040) — the standard set for
# freelancers / sole proprietors / gig workers.
_CATEGORIES = [
    ("SCHEDULE_C_L8_ADVERTISING", "Advertising"),
    ("SCHEDULE_C_L9_CAR_TRUCK", "Car and Truck Expenses"),
    ("SCHEDULE_C_L11_CONTRACT_LABOR", "Contract Labor"),
    ("SCHEDULE_C_L15_INSURANCE", "Insurance (Other than Health)"),
    ("SCHEDULE_C_L17_LEGAL_PROFESSIONAL", "Legal and Professional Services"),
    ("SCHEDULE_C_L18_OFFICE_EXPENSE", "Office Expense"),
    ("SCHEDULE_C_L20B_RENT_OTHER", "Rent — Other Business Property"),
    ("SCHEDULE_C_L21_REPAIRS", "Repairs and Maintenance"),
    ("SCHEDULE_C_L22_SUPPLIES", "Supplies"),
    ("SCHEDULE_C_L25_UTILITIES", "Utilities"),
    ("SCHEDULE_C_L27A_OTHER", "Other Expenses"),
    ("NON_DEDUCTIBLE_PERSONAL", "Personal — Not Deductible"),
]


class USTaxRules(TaxRuleEngine):
    country = "US"

    def categories(self) -> list[TaxCategory]:
        return [TaxCategory(code, label, "US") for code, label in _CATEGORIES]

    def default_category(self) -> TaxCategory:
        return TaxCategory("SCHEDULE_C_L27A_OTHER", "Other Expenses", "US")
