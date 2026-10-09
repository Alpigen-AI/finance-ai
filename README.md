# Finance AI — Phase 0 + Phase 1 Scaffold (All-Google Stack)

Everything runs on one Firebase/GCP project: **Firebase Auth** (identity),
**Firestore** (database), **Firebase Storage** (receipt images),
**Google ADK + Vertex AI (Gemini)** (agents), **Cloud Run** (API hosting),
**Firebase Hosting** (web app). No third-party infra in the core stack.

## What's here vs. what's next

**Built in this pass:**
- `packages/types` — shared TS types
- `infrastructure/database/` — Firestore data model, security rules, composite indexes
- `infrastructure/deployment/` — Dockerfile + Cloud Build config for Cloud Run
- `firebase.json` / `.firebaserc` — Firestore + Hosting config
- `services/ai/tax_rules/` — US (IRS Schedule C) and India (Income Tax Act §30–37) engines
- `services/financial/safe_to_spend.py` — pure-math engine, no LLM
- `services/ai/agents/` — receipt categorizer + financial coach ADK agents
- `apps/api/` — FastAPI backend on Firestore, ready to containerize for Cloud Run

**Not yet built:**
- `apps/mobile/` — Expo camera capture + chat UI (palette confirmed: navy `#0E2A4D` / teal `#17B8C7`)
- `apps/web/` — Next.js landing + dashboard + chat UI, deployed via Firebase Hosting
- Bank linking (Plaid US / Account Aggregator India) — Phase 3
- Razorpay billing/entitlements — Phase 4

## Local setup

```bash
cd apps/api
pip install -r requirements.txt
cp ../../.env.example ../../.env        # fill in your Firebase/GCP project id
gcloud auth application-default login   # so the Admin SDK can find credentials locally
uvicorn app.main:app --reload
```

## Deploying

```bash
# One-time: point the Firebase CLI at your project
firebase use --add                      # replace the placeholder in .firebaserc

# Push Firestore rules + indexes
firebase deploy --only firestore

# Build + deploy the API to Cloud Run
gcloud builds submit --config infrastructure/deployment/cloudbuild.yaml

# Deploy the web app once apps/web exists (Firebase Hosting's Next.js
# frameworks support builds and deploys it to Cloud Run automatically)
firebase deploy --only hosting
```

## Key design decisions worth knowing

1. **Country logic is a strategy pattern, not a fork.** `get_tax_rules(user.country)`
   is the only place country ever branches.

2. **The LLM never does math.** `safe_to_spend.py` and `evaluate_purchase()`
   are plain Python. The coach agent calls them as tools and narrates the
   result — this is what BRD §4.3 means by "eliminate ledger hallucinations."

3. **Tax categorization is constrained, not freeform.** The receipt agent
   gets the closed list of valid codes via a tool call, and the API
   double-checks the returned code before writing to Firestore.

4. **Multi-tenancy is structural, not just a query filter.** Every user's
   data lives under `users/{uid}/...` — `firestore.rules` protects direct
   client access, and the backend's `user_subcollection()` helper is the
   only sanctioned path to reach it, so there's no code path that can
   accidentally cross tenants.

5. **Entitlement checks happen before any Vertex AI call** — `require_scan_entitlement`
   runs as a FastAPI dependency ahead of the route body, satisfying BRD
   §4.1's "verify instantly before releasing backend compute" requirement.

6. **Receipts are mobile-only by product decision.** The web app is
   landing + dashboard + chat; there is no upload UI planned for web.
