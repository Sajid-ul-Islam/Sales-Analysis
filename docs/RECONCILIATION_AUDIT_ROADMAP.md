# Deen Commerce Reconciliation Engine — Audit Action Plan & Infrastructure Roadmap

This document serves as the master tracking roadmap for the prioritized code review recommendations. In accordance with the project directive, all foundational infrastructure modules, test suites, contracts, and CI pipelines have been built and verified, with full production endpoint rewiring scheduled as a prioritized to-do list.

---

## 1. Master To-Do & Infrastructure Status Matrix

| # | Priority | Effort | Review Checklist Item | Infrastructure Status | Wiring Status | Primary Files |
|---|---|---|---|---|---|---|
| **1** | **P0** | High | API Authentication & Role-Based Customer Data Access | **Built & Verified** | Pending Wiring (To-Do) | [`src/lib/auth/apiAuth.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/auth/apiAuth.ts), [`src/lib/auth/rateLimiter.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/auth/rateLimiter.ts), [`src/lib/auth/dataMasking.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/auth/dataMasking.ts) |
| **2** | **P0** | Medium | Dataset PII Audit & Demo Endpoint Sanitization | **Built & Verified** | Pending Wiring (To-Do) | [`src/lib/dataAudit.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/dataAudit.ts), [`src/data/baselineSample.json`](file:///home/bearded/Public/Sales-Analysis/src/data/baselineSample.json) |
| **3** | **P1** | High | Automated Reconciliation Domain Tests (6 Core Rules) | **Built & Passing (100%)** | Fully Tested | [`tests/reconciliation/reconciliationEngine.test.ts`](file:///home/bearded/Public/Sales-Analysis/tests/reconciliation/reconciliationEngine.test.ts), [`tests/fixtures/reconciliationFixtures.ts`](file:///home/bearded/Public/Sales-Analysis/tests/fixtures/reconciliationFixtures.ts) |
| **4** | **P1** | High | Accounting Invariants & Multi-Item Order Contracts | **Built & Passing (100%)** | Pending Wiring (To-Do) | [`src/lib/accounting/accountingContract.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/accounting/accountingContract.ts), [`tests/accounting/accountingContract.test.ts`](file:///home/bearded/Public/Sales-Analysis/tests/accounting/accountingContract.test.ts) |
| **5** | **P1** | Medium | Subset-Sum Ambiguity Detection & Manual Review Flagging | **Built & Passing (100%)** | Pending Wiring (To-Do) | [`src/lib/subsetSumAuditor.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/subsetSumAuditor.ts), [`tests/reconciliation/subsetSum.test.ts`](file:///home/bearded/Public/Sales-Analysis/tests/reconciliation/subsetSum.test.ts) |
| **6** | **P2** | Medium | Automated CI Quality Pipeline (Type-check, Lint, Test, Build) | **Built & Passing (100%)** | Active in CI | [`.github/workflows/ci.yml`](file:///home/bearded/Public/Sales-Analysis/.github/workflows/ci.yml), [`.eslintrc.json`](file:///home/bearded/Public/Sales-Analysis/.eslintrc.json), [`package.json`](file:///home/bearded/Public/Sales-Analysis/package.json) |
| **7** | **P2** | Medium | Sync Observability, Retries & Data Freshness Provenance | **Built & Passing (100%)** | Pending Wiring (To-Do) | [`src/lib/sync/retry.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/sync/retry.ts), [`src/lib/sync/syncTracker.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/sync/syncTracker.ts), [`src/lib/sync/syncLogger.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/sync/syncLogger.ts) |

---

## 2. Infrastructure Architecture & Module Specifications

### 2.1 Security & Access Control (P0)
* **API Authentication Helper** ([`src/lib/auth/apiAuth.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/auth/apiAuth.ts)):
  * Constant-time timing-safe token verification against `ADMIN_API_SECRET` and `API_BEARER_TOKEN`.
  * Role assignment (`admin`, `operator`, `demo`, `readonly`).
  * Graceful fallback in development/demo modes to prevent dev lockout.
* **Sliding-Window Rate Limiter** ([`src/lib/auth/rateLimiter.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/auth/rateLimiter.ts)):
  * In-memory token bucket tracking request quotas per client IP or API key.
* **Customer Data Masking** ([`src/lib/auth/dataMasking.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/auth/dataMasking.ts)):
  * Sanitizes Bangladeshi phone numbers (`01783650157` $\rightarrow$ `0178****157`).
  * Masks customer names to initials (`Tusher pual` $\rightarrow$ `T*** p***`).
  * Redacts street addresses while preserving divisional/thana context for GIS analytics (`[REDACTED STREET], Dhaka`).
  * Scrubs customer phone numbers embedded inside freeform courier/order notes.

### 2.2 Dataset Privacy & Provenance (P0)
* **Dataset PII Auditor & Anonymizer** ([`src/lib/dataAudit.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/dataAudit.ts)):
  * Audits tracked datasets for live customer phones, names, and residential addresses.
  * Provides `anonymizeDataset()` to generate privacy-safe sample datasets while strictly preserving financial metrics, SKUs, and quantities for algorithm execution.
  * Attaches `DataProvenanceInfo` (`live_api`, `demo_anonymized`, `baseline_fallback`, `disk_spreadsheet`).

### 2.3 Reconciliation Domain Test Suite (P1)
* **Vitest Runner** ([`vitest.config.mts`](file:///home/bearded/Public/Sales-Analysis/vitest.config.mts)):
  * Configured with path alias mapping (`@/*` $\rightarrow$ `./src/*`).
* **Test Fixtures** ([`tests/fixtures/reconciliationFixtures.ts`](file:///home/bearded/Public/Sales-Analysis/tests/fixtures/reconciliationFixtures.ts)):
  * Encodes representative scenarios for all 6 business rules from `.agents/rules/`.
* **Domain Test Assertions** ([`tests/reconciliation/reconciliationEngine.test.ts`](file:///home/bearded/Public/Sales-Analysis/tests/reconciliation/reconciliationEngine.test.ts)):
  * **Rule 1**: Branch detection (`17263` $\rightarrow$ Online Store, `17263 c` $\rightarrow$ Cumilla, `17263 w` $\rightarrow$ Wari, `17263 s` $\rightarrow$ Sylhet, `17263 m` $\rightarrow$ Mirpur POS).
  * **Rule 2**: Full delivery (single parcel and split multi-parcel).
  * **Rule 3**: Full return (non-paid return with zero customer COD).
  * **Rule 4**: Multi-parcel paid return propagation (if 1 parcel is paid return, all returned parcels in that order inherit paid return).
  * **Rule 5**: Partial delivery whole integer constraint ($\text{ReturnedQty} \in \mathbb{Z}_{\ge 0}$, floats like 0.5 strictly forbidden).
  * **Rule 6**: Exchanged order classification (`D-`, `DD-`, `EXCH-` prefixes).

### 2.4 Accounting Invariants Module (P1)
* **Mathematical Invariants** ([`src/lib/accounting/accountingContract.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/accounting/accountingContract.ts)):
  * `assertNoDoubleCounting`: Detects and prevents revenue inflation when summing order-level totals across flattened item rows.
  * `assertDeliveryFeeBalance`: Verifies $\text{Collected COD} = \sum \text{Kept Prices} + \text{Delivery Fee}$.
  * `assertWholeIntegerQuantities`: Ensures returned item quantities are non-negative whole integers.
  * `validateUnitEconomics`: Verifies COGS ratio (42-45%), Packaging sunk loss (৳25/return), CM2, CM3, and ROAS.

### 2.5 Subset-Sum Ambiguity Engine (P1)
* **Ambiguity Detection & Evidence Trail** ([`src/lib/subsetSumAuditor.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/subsetSumAuditor.ts)):
  * Evaluates competing subsets when multiple distinct combinations match the same collected COD.
  * Marks ambiguous results with `confidence: 'AMBIGUOUS_MULTI_CANDIDATE'` and `requiresManualReview: true`.
  * Flags nearest discrete fallback matches with `requiresManualReview: true`.
  * Attaches complete `decisionEvidence` detailing candidates evaluated, tolerance differences, and audit explanation.

### 2.6 CI Quality Assurance Pipeline (P2)
* **GitHub Actions Workflow** ([`.github/workflows/ci.yml`](file:///home/bearded/Public/Sales-Analysis/.github/workflows/ci.yml)):
  1. `npm ci --legacy-peer-deps`
  2. `npm run type-check` (`tsc --noEmit`)
  3. `npm run lint` (`next lint`)
  4. `npm run test` (`vitest run` — all 37 tests)
  5. `npm run build` (`next build`)

### 2.7 Sync Observability & Resilience (P2)
* **Retry Helper** ([`src/lib/sync/retry.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/sync/retry.ts)):
  * Exponential backoff with full randomized jitter for HTTP 429 and 5xx errors.
  * Fast-fail on non-retryable 4xx authentication errors.
* **Sync Batch Tracker** ([`src/lib/sync/syncTracker.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/sync/syncTracker.ts)):
  * Separately records `requestedCount`, `successfulCount`, `failedCount`, and `skippedCount`.
* **Sync History Buffer** ([`src/lib/sync/syncLogger.ts`](file:///home/bearded/Public/Sales-Analysis/src/lib/sync/syncLogger.ts)):
  * In-memory circular buffer recording the last 50 sync events.

---

## 3. Subsequent Wiring Plan (To-Do List)

The following checklist specifies how each module will be wired into live application handlers:

### Phase 1: Security & Sensitive Data Access (P0)
- [ ] **Wire `validateApiRequest` into `/api/sync/woocommerce/route.ts`**:
  * Check request authorization; reject unauthorized callers with HTTP 401/403 in production.
  * Allow optional demo query/header in dev environment.
- [ ] **Wire `validateApiRequest` into `/api/sync/pathao/route.ts`**:
  * Protect Pathao Hermes batch lookup endpoint.
- [ ] **Wire `sanitizeOrdersResponse` into `/api/sample-data/route.ts`**:
  * Sanitize baseline sample records before returning them to client, ensuring no live customer phone numbers or full street addresses are exposed.
- [ ] **Anonymize `src/data/baselineSample.json`**:
  * Run `anonymizeDataset` on the static JSON file and replace real phone numbers/names with synthetic records.

### Phase 2: Reconciliation & Accounting Integration (P1)
- [ ] **Connect `matchPartialItemsWithAudit` in `src/lib/reconciliationEngine.ts`**:
  * Replace direct `matchPartialItemsAdvanced` call with audited version.
  * Pass `requiresManualReview` and `decisionEvidence` into `ReconciledOrderRow`.
- [ ] **Surface Ambiguous Orders in UI**:
  * In `OrdersLedgerTab.tsx` and `CourierMismatchTab.tsx`, render an amber `Manual Review Required` badge on ambiguous matches with tooltip displaying `decisionEvidence.explanation`.
- [ ] **Integrate `assertNoDoubleCounting` Invariant**:
  * Validate summary GMV in `reconciliationEngine.ts` and `excelExport.ts` to guarantee exported figures match deduplicated order totals.

### Phase 3: External API Observability & Retries (P2)
- [ ] **Wrap WooCommerce fetches with `withExponentialBackoff` in `src/lib/woocommerceClient.ts`**:
  * Add Authorization header instead of query parameters.
  * Clean up timeouts using `finally`.
- [ ] **Wrap Pathao batch fetches with `withExponentialBackoff` and `SyncTracker` in `src/lib/pathaoClient.ts`**:
  * Track requested, successful, failed, and skipped consignments.
  * Expose batch summary to `/api/sync/status`.
- [ ] **Display Data Provenance in UI**:
  * In `CloudSyncBar.tsx`, display provenance badge (`Live API`, `Demo Anonymized`, `Spreadsheet Upload`).
