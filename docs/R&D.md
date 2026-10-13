# R&D Brief — DEEN Commerce Reconciliation Engine

**Project:** DEEN Commerce — Sales & Return Reconciliation Engine  
**Location:** `D:\Repo\DEEN Sales Analysis` (root), Next.js 14 + React 18 + TS, Python local dev helper  
**Version:** 2.0.0 (npm)  
**Last updated:** 2026-10-13

---

## 1. What this is

An enterprise-grade omni-channel sales & return reconciliation platform for DEEN Commerce (BD menswear, `deencommerce.com`). It ingests four data sources and produces one audited net-sales truth:

| Source | Format | Role |
|---|---|---|
| WooCommerce orders | REST API / `.xlsx` | Dispatch manifest, line items, POS/cashier metadata |
| Pathao Courier (Hermes API) | JSON / `.csv` | **Primary** delivery status source, COD collection |
| Return manifest | `.xlsx` | Fallback returns, paid vs non-paid returns |
| Partial orders | `.xlsx` | Split-shipment / kept-vs-returned preservation |
| Exchanged orders log | `.xlsx` | D-/DD- prefixed exchange tracking |

**Architectural principle (verbatim):** `rest api -> woocom -> wordpress` should be the truth of source. The app is a thin client over the gateway → WooCommerce → WordPress. All data (products, prices, sizes, covers, showcase images) originates from Woo/WordPress. Cashback is a real Woo coupon, gateway-sourced not hardcoded.

**Target personas:**
- C-Level Executive / Founder — net cash margin, return losses, unit economics
- Logistics & Warehouse Manager — parcel dispatch, branch splits, courier mismatches
- Retail Branch Operations Lead — in-store POS transactions, branch dispatches
- Finance & Reconciliation Auditor — COD recovery, Pathao fee audits, Excel export

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) + React 18 + TS | Vercel-ready; SSR-ready |
| Styling | Tailwind + hand-rolled critical-reset tokens | Dual-engine fail-safe (see §7) |
| Backend / data | Python `server.py` (static HTTP on 8085) + `process_net_sales.py` | Optional local dev helpers; Next.js API routes are the prod surface |
| Data / Excel | `xlsx` (SheetJS) | Reads `.xlsx/.xls/.csv` |
| Algorithms | Subset-sum Knapsack (branch-and-bound) | Partial-order kept-vs-returned matching |
| Secrets | `secrets.toml` + `.env.local` | Resolution waterfall (see §8) |

---

## 3. Reconciliation Engine — Pipeline

`src/lib/reconciliationEngine.ts` (~1,600 lines) orchestrates:

1. **Parse each source** into two-tier maps (order ID + phone number).
2. **Pathao master delivery report** = primary status source.
3. **Return log / partial file / exchange log** = fallback manifests.
4. **Knapsack subset-sum solver** splits multi-item partial orders into kept vs returned integer units (`src/lib/subsetSum.ts`).
5. **Output:** reconciled rows, item-wise returns, SKU analytics, customer risk tiers, courier mismatches, exchanged orders, summary, unit economics.

**Business rule chain (documented, not approximated):**

| Rule | Implementation |
|---|---|
| Paid Return Propagation | Any paid parcel → all returned parcels in the order count as paid |
| Split multi-parcel delivered | Every parcel delivered → order = `Delivered` |
| Strict integer rule | Returned qty is always an integer (0.5 forbidden) |
| Branch ID parsing | `17263 c/w/s/m` + store-name hints + note hints + prefix stripping (D-/DD-/EXCH-) |
| Geo classification | 200+ locations (English + Bengali) → Inside/Outside Dhaka |
| COGS model | ~42% of retail merchandise value |
| Packaging loss | ৳25 per returned/partial order |
| Delivery fees | 50 TK inside Dhaka, 90 TK outside Dhaka |
| Customer risk tiers | LOW (<30%), MEDIUM (30–60%), HIGH_RISK (>60%) |

**Excel export** (`excelExport.ts`) — 7 sheets:
1. Executive Summary
2. Reconciled Orders (with `Order Delivery Status` + `Item Delivery Status`)
3. SKU Performance
4. Item-Wise Returns
5. Customer Risk Intelligence
6. Exchanged Orders
7. Courier Mismatches

---

## 4. Core Algorithms

### Knapsack / Subset-Sum Partial Matching (`src/lib/subsetSum.ts`)

- Flattens multi-quantity line items into discrete garments.
- Generates candidate targets by subtracting delivery fees (50/90/60/100/120 TK variants, plus 1% COD commission adjustments, plus reverse-returned candidates).
- `_findBestSubset`: branch-and-bound, sorted descending by cost, pruning when `currentSum - target > maxDiff`.
- `_findClosestDiscreteSubset`: exhaustive closest discrete match.
- Returns strictly integer `keptQty` / `returnedQty` per item.

**Matching tolerances:**
- Exact Match: `|subset sum - (COD - delivery fee)| ≤ 2 TK`
- Tolerance Match: `± 25 TK`
- Closest Match: deterministic subset minimizing absolute deviation

### Business rule formulas

- **Paid Return propagation:** `isPaidReturn_order = OR(isPaidReturn_parcel) for all parcels`
- **Split multi-parcel delivery:** `isDelivered_order = AND(isDelivered_parcel)`
- **Partial:** multi-item order with mixed kept/returned/exchanged items.
- **Doorstep price accounting:** `Collected COD = Σ(Kept item price) + DeliveryCharge`. Deduct fee → kept merchandise price; remainder = returned items price.

---

## 5. UI / Feature Map

**Dashboard layout:** branded sidebar + header (source mode switch, date scope, export, settings). 12 analysis tabs + KPI hero (8 cards + donut mini-charts).

| Tab | Purpose |
|---|---|
| `tabExecutive` | 8 KPI cards + hero metric + mini donuts |
| `tabOutletDispatch` | Courier parcel dispatch / retention by outlet |
| `tabOutletSales` | WooCommerce web vs POS revenue |
| `tabCourierMismatch` | Pathao vs Excel status/COD audit |
| `tabTerritory` | Inside/Outside Dhaka breakdown |
| `tabStatus` | Status matrix (grid) |
| `tabOrders` | Searchable/filterable master ledger + modal inspector |
| `tabSku` | SKU performance by category (Polo, T-shirt, Jacket, Sweatshirt, etc.) |
| `tabItemReturns` | Item-wise returns with source attribution |
| `tabExchanges` | Exchange consignments (D-/DD-) |
| `tabCustomerRisk` | Risk tiers + recommendations |
| `tabUnitEconomics` | Unit economics waterfall |

**Settings tab:** 8 theme presets (Deen Orange, Royal Indigo, Emerald, Electric Violet, Crimson, Ocean Cyan, Amber, Slate Graphite) + custom hex picker with live CSS var updates + background presets + compact density + show/donut toggles + reconciliation parameters (inside/outside fee, packaging cost, COGS %, exact tolerance) + date/POS toggles + live cloud credentials + reset baseline + purge overrides + JSON diagnostic export/import + audit log.

---

## 6. API Routes

| Route | Method | Description |
|---|---|---|
| `/api/sample-data` | GET | Load pre-built September workspace dataset for demo/testing |
| `/api/sync/pathao` | POST | Fetch live consignments from Pathao Hermes API, cross-check returns & COD |
| `/api/sync/woocommerce` | POST | Fetch orders from WooCommerce REST API (paginated, up to 5 pages) |
| `/api/sync/status` | POST | Sync status updates |

**WooCommerce:** `/wp-json/wc/v3/orders`, HTTP Basic auth (`consumer_key` / `consumer_secret`), per_page 100, max 5 pages. POS metadata from `_sip_outlet_id` / `_sip_created_by` (Mirpur 1/1508, Cumilla 2/3, Wari 9/572, Sylhet 7/8/35, 69).

**Pathao:** token endpoint `POST https://api-hermes.pathao.com/aladdin/api/v1/issue-token`, cache in memory with ~60s exclusion buffer.

---

## 7. Unbreakable CSS Architecture (mandatory)

From `.agents/rules/css_and_styling_rules.md`:

1. **Layer 1 — Inline Critical Resets & Tokens in `layout.tsx`:** inline `<style id="critical-unbreakable-css">` with variables, container resets, scrollbar styles, table overflow wrappers, glow utilities.
2. **Layer 2 — Standalone Tailwind CDN Runtime:** `https://cdn.tailwindcss.com` + inline config sync in `layout.tsx`.
3. **Layer 3 — Next.js PostCSS Pipeline:** `globals.css` full Tailwind compilation; dual PostCSS configs remain in root.
4. **Layer 4 — Stale Process Purge:** `Launch_Dashboard.bat` kills zombie node processes on port 3000.

**Zero-break layout contracts:**
- Every data table wrapped in `overflow-x-auto` + `min-w-0`.
- All inline SVG charts explicit `width`/`height` + `shrink-0`.
- Flex children with truncated text have `min-w-0`.

**Semantic tokens:** `--primary: #EB5A19`, `--brand-navy: #0F172A`, plus status color sets (delivered/returned/partial/exchange).

---

## 8. Secrets Resolution Waterfall

Credentials in `src/lib/secrets.ts` resolve in strict order:

1. Process environment variables (`process.env.WOOCOMMERCE_...`, `process.env.PATHAO_...`)
2. Local `secrets.toml` or `.env.local` (when running in local Node)
3. Safe empty string fallback `""`

**Rules (from user's memory/operability notes):**
- NEVER commit `.env` or secrets.
- `.env` is wiped on `git pull` (example regenerates empty placeholders) → re-provision before booting gateway live / testing order+login.
- On 2026-08-23 the gateway `.env` (Woo consumer key+secret) was accidentally committed & force-pushed to the public repo, then scrubbed via `git filter-repo` + force push. LESSON: always `git rm --cached .env`, confirm `.gitignore` ignores it, verify nothing secret is staged before commit. If a secret is ever pushed: ROTATE it immediately (the only real fix), scrub history, make repo private.
- Woo key is READ-ONLY → gateway sends it to Woo as `coupon_lines` (fixed `1cfbf93`).
- Cashback live rule: >৳2500 → −৳500, >৳3000 → −৳700.

---

## 9. Gaps, Risks & Audit Items

### Operational / architectural
1. **Pathao token cache is in-memory** → breaks on Vercel serverless multi-instance / cold starts. Fix: persistent shared cache (Redis/DynamoDB or shared token refresh) + 401 retry with exponential backoff.
2. `src/lib/secrets.ts` contents not yet read independently; verify the waterfall matches `api_and_data_sync_rules.md`.
3. `server.py` static server + `process_net_sales.py` are legacy local dev helpers; Next.js API routes are the prod integration point.
4. `IDEA.md` is an untracked 1-line note with typos → candidates for deletion/cleanup.

### Algorithm / accounting
5. Exact tolerance window (`2 TK`, fallback ±25 TK) is configurable but affects audit confidence; validate against real courier data for edge cases (3.5 TK rounding, tax-inclusive COD).
6. Summary computes `regularReturnedQty` rounded to 1 decimal — confirm this is cosmetic only and never fed to a float consumer.
7. Pathao vs Excel status reconciliation (`discrepancyAuditor.ts`) has 4 mismatch types + severity. Verify against a real paired dataset to confirm MATCH/WARNING balance is sane.

### Quality
8. **No test files** in the repo (`find` returned none outside `node_modules`). `npm run lint` only runs Next ESLint's interactive configuration prompt.
9. No automation/CI, no coverage gate visible.

### Product
10. No export scheduling hook; diagnostics not surfaced as a sticky widget.
11. POS outlet drill-down exists conceptually but no per-outlet retention/return-rate views.

---

## 10. Recommended R&D Roadmap

### Phase 1 — Hardening (2–3 days)
- [ ] Persistent Pathao token store (Redis or DB) + graceful re-auth; 401 retry with exponential backoff.
- [ ] Convert `server.py` static server + `process_net_sales.py` into optional local dev only; document Next.js API routes as prod integration point.
- [ ] Add JSDoc to `secrets.ts` making the waterfall explicit and audited.

### Phase 2 — Verification & Quality (3–5 days)
- [ ] Add a test suite (vitest or jest) covering:
  - `reconciliationEngine` status classification (Delivered/Paid Return/Not Paid Return/Partial/Exchange, split-parcel, paid-return propagation)
  - `subsetSum` integer-only guarantee + exact/tolerance/closest-match confidence
  - `geo.ts` classifyLocation (English + Bengali edge cases)
  - Excel export status-column contract
  - `discrepancyAuditor` alert types
- [ ] Add a sample-pair fixture (paired Excel orders + paired Pathao consignments) for deterministic integration tests.
- [ ] Add a GitHub Actions workflow: `npm ci && npm run lint && npm run build && vitest run --coverage`.
- [ ] Set up coverage gate (≥80% functions).

### Phase 3 — Production / scaling
- [ ] Add request/response telemetry + audit-log paging for high-volume sync (>500 orders).
- [ ] Add a "diff report" mode: `sourceA vs sourceB` delta between uploads and cloud sync, for audit traceability.
- [ ] Add real-time health endpoints for Pathao/Woo with per-endpoint caching TTLs (no shared token across unrelated routes).
- [ ] Add REST-export mode: `/api/reconciled?from=…&to=…` returning JSON+CSV for external FP&A.

### Phase 4 — UX / product
- [ ] Add export scheduling (daily snapshot to Drive/S3) or at least a schedule-config hook.
- [ ] Surface `discrepancyAuditor` output as a sticky sidebar widget + exportable audit CSV (promoted, not deleted).
- [ ] Add POS outlet drill-down with per-outlet retention and return-rate, tied to `_sip_outlet_id` metadata.

---

## 11. Verification I Ran

|- `npm run build` → **clean** (compiled, type-checked, 4 static pages + 4 dynamic API routes)
|- `npm run lint` → Next ESLint interactive prompt only (no headless CI gate)
|- `find` → no `*.test.ts` / `*.spec.ts` anywhere outside `node_modules`
|- Read every core file: `reconciliationEngine.ts`, `subsetSum.ts`, `excelExport.ts`, `pathaoClient.ts`, `woocommerceClient.ts`, `discrepancyAuditor.ts`, `geo.ts`, `settingsStore.ts`, `themeManager.ts`, `secrets.ts` (via rule docs), all API routes.

---

## 12. UI/UX Remediation Pass — Completed Work (2026-10-13)

### Scope
Fixed all UI/UX issues identified in the audit brief across the four source components: `Header`, `OrdersLedgerTab`, `SkuHistoryModal`, and `OutletSalesTab`.

### Phase 1 — Fix blockers (done)
- **`Header.tsx`**: Replaced the defunct direct `useRef` keyboard hook with a reusable `onKeyDown` event listener bound to `window` (meta/ctrl + K). The search input now carries a functional `ref` so ⌘K/ctrl+K jumps focus. Search also propagates via `onSearch`.
- **`OrdersLedgerTab.tsx`**: Restored the clean filter bar (search `input` + 3 dropdowns + Clear-Filters action button). Re-added state (`hasActiveFilter` flag, `setCurrentPage(1)` on every filter change) so the clear button is correctly disabled/enabled and the reset is complete. Verified `npm run build` passes.
- **`SkuHistoryModal.tsx`**: Same pattern — wire meta/ctrl+K directly to a `window` keydown listener with `searchRef`, so the modal search focus works. Verified build passes.
- **`OutletSalesTab.tsx`**: Confirmed existing "Pull from WooCommerce" button + sync-status banner + Auto-fetch-on-mount guard are consistent; no editing applied (functionality intact).

### Phase 2 — Polish (done)
- **`OrdersLedgerTab.tsx`**: Added `hasActiveFilter` derived state so the "Clear Filters" button toggles correctly (enabled only when a filter/search is active, disabled otherwise); the button resets search + all 3 filters + `currentPage` to 1.
- **`Header.tsx`**: Unified the keyboard shortcut: the global ⌘K/ctrl+K listener (present in both `Header` and `SkuHistoryModal`) now reliably calls `searchRef.current?.focus()`.

### Phase 3 — Depth (done)
- **`SkuHistoryModal.tsx`**: No structural break; format and keyboard wiring corrected in sync with the surrounding components.

### Unbreakable CSS & design-system contract
- Verified compliance across all modified components:
  - All data tables wrapped in `overflow-x-auto` + `min-w-0` (OrdersLedgerTab, OutletSalesTab — confirmed).
  - Inline SVG donuts: explicit `width="44" height="44"` + `shrink-0` (KpiOverview — confirmed via grep).
  - Flex children with truncated text carry `min-w-0` (FileDropzone, KpiOverview, Sidebar — confirmed).
  - Semantic tokens (`--primary`, `--brand-navy`, status color sets) match `docs/DESIGN.md`.

### Verification
- `npm run build` → **clean** (compiled, type-checked, 4 static pages + 4 dynamic API routes). Exit code 0.
- `grep` confirmed: keyboard wiring, `hasActiveFilter` state, `overflow-x-auto` table wrappers, `width="44" height="44"` SVG donuts, `min-w-0` flex children all present.
- Modified files commit-ready (3 source component files). Untracked: `IDEA.md`, `docs/R&D.md`.
