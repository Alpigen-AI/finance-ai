# Firestore Data Model

Every user's data lives in **subcollections under their own user document**.
This is the idiomatic Firestore multi-tenancy pattern — isolation is
structural (it's baked into the document path), and `firestore.rules`
enforces it for any direct client access.

```
users/{uid}                              — profile
  email, displayName, country ("US"|"IN"), currency ("USD"|"INR"),
  tier ("free"|"premium"), freeScansUsed, freeScansResetAt, createdAt

users/{uid}/receipts/{receiptId}
  imageUrl, vendor, totalAmount, currency, purchaseDate, lineItems[],
  status ("pending"|"processed"|"failed"), source ("mobile_camera"|"web_upload"),
  rawAgentOutput, createdAt

users/{uid}/expenses/{expenseId}
  receiptId, amount, currency, vendor, expenseDate, taxCode, taxLabel,
  country, isDeductible, notes, createdAt

users/{uid}/transactions/{txId}
  provider ("plaid"|"account_aggregator"), externalId, amount, currency,
  txnDate, merchantName, pending

users/{uid}/recurringObligations/{id}
  label, amount, dueDayOfMonth, isActive

users/{uid}/monthlyReports/{month}       — doc id = "2026-08"
  totalExpenses, totalDeductible, byCategory{}, safeToSpendSnapshot{}, generatedAt

users/{uid}/chatMessages/{id}
  role ("user"|"agent"), content, createdAt
```

## How reads/writes happen in practice

- **AI-driven writes** (receipt processing, chat replies) go through the
  Cloud Run backend using the Admin SDK, which bypasses `firestore.rules`
  entirely — isolation there is enforced in code by always scoping queries
  to `users/{authed_uid}/...`, never a bare collection query.
- **Dashboard reads** can go two ways: through the API (simplest, consistent
  with the FastAPI routers below), or as **direct Firestore realtime
  listeners from the web/mobile client** for live-updating UI (e.g. expense
  list updates the instant a receipt finishes processing, no polling). If
  you want that, the client SDK reads `users/{uid}/expenses` directly and
  `firestore.rules` is what protects it — no backend round-trip needed for
  read-only dashboard data.

## Composite indexes needed

- `expenses`: `expenseDate` (desc) — for month-filtered, date-sorted lists
- `chatMessages`: `createdAt` (asc) — for ordered chat history

See `firestore.indexes.json`.
