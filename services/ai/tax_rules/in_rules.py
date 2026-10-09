from .base import TaxRuleEngine, TaxCategory

# Income Tax Act, 1961 — Sections 30 to 37 (business/profession expense heads)
_CATEGORIES = [
    ("IN_SEC30_RENT_PREMISES", "Rent, Rates, Taxes for Business Premises"),
    ("IN_SEC31_REPAIRS_MACHINERY", "Repairs to Machinery, Plant, Furniture"),
    ("IN_SEC32_DEPRECIATION", "Depreciation on Assets"),
    ("IN_SEC35_RD", "Scientific Research / R&D Expenditure"),
    ("IN_SEC36_STAFF_WELFARE", "Staff Welfare / Employee Costs"),
    ("IN_SEC37_ADVERTISING", "Advertising and Business Promotion"),
    ("IN_SEC37_TRAVEL", "Travel and Conveyance"),
    ("IN_SEC37_PROFESSIONAL_FEES", "Professional / Consultancy Fees"),
    ("IN_SEC37_OFFICE_SUPPLIES", "Office Supplies and Stationery"),
    ("IN_SEC37_COMMUNICATION", "Telephone / Internet / Communication"),
    ("IN_SEC37_GENERAL_BUSINESS", "General Business Expenditure (Sec 37 residual)"),
    ("NON_DEDUCTIBLE_PERSONAL", "Personal — Not Deductible"),
]


class INTaxRules(TaxRuleEngine):
    country = "IN"

    def categories(self) -> list[TaxCategory]:
        return [TaxCategory(code, label, "IN") for code, label in _CATEGORIES]

    def default_category(self) -> TaxCategory:
        return TaxCategory(
            "IN_SEC37_GENERAL_BUSINESS", "General Business Expenditure (Sec 37 residual)", "IN"
        )
