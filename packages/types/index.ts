
// Shared types — used by web, mobile, and (mirrored) by the API


export type Country = "US" | "IN";
export type Tier = "free" | "premium";

export interface User {
  uid: string;               // Firebase Auth UID
  email: string;
  displayName?: string;
  country: Country;          // drives tax rules, currency, bank-linking provider
  currency: "USD" | "INR";
  tier: Tier;
  freeScansUsedThisMonth: number;
  createdAt: string;         // ISO
}

export interface ReceiptLineItem {
  description: string;
  amount: number;
  quantity?: number;
}

export interface Receipt {
  id: string;
  userId: string;
  imageUrl: string;          // storage ref (Firebase Storage / GCS)
  vendor?: string;
  totalAmount?: number;
  currency?: string;
  purchaseDate?: string;
  lineItems: ReceiptLineItem[];
  status: "pending" | "processed" | "failed";
  source: "mobile_camera" | "web_upload" | "email";
  createdAt: string;
}

// Tax code is country-specific; we store both a human label and a machine code
export interface TaxCategory {
  code: string;          // e.g. "SCHEDULE_C_L8_ADVERTISING" or "IN_SEC37_GENERAL_BUSINESS"
  label: string;         // e.g. "Advertising" or "Business Promotion Expenses"
  country: Country;
}

export interface Expense {
  id: string;
  userId: string;
  receiptId?: string;        // optional — expenses can also be manual/bank-derived
  amount: number;
  currency: string;
  vendor: string;
  date: string;
  taxCategory: TaxCategory;
  isDeductible: boolean;
  notes?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  provider: "plaid" | "account_aggregator";
  externalId: string;
  amount: number;            // negative = debit
  currency: string;
  date: string;
  merchantName?: string;
  pending: boolean;
}

export interface SafeToSpendResult {
  asOf: string;
  currentBalance: number;
  upcomingObligations: number;   // known bills before next income
  targetSavingsReserve: number;
  safeToSpendToday: number;
  safeToSpendThisMonth: number;
  verdictForQuery?: "yes" | "no" | "wait";
}

export interface MonthlyReport {
  id: string;
  userId: string;
  month: string;              // "2026-08"
  totalExpenses: number;
  totalDeductible: number;
  byCategory: Record<string, number>;
  safeToSpendSnapshot: SafeToSpendResult;
  generatedAt: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: "user" | "agent";
  content: string;
  createdAt: string;
}
