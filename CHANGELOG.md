# Changelog: DEEN Commerce Reconciliation Engine

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.4.2] - 2026-11-05

### Added
- **Pre-Dispatch Predictive RTO Warning Badge**: High-risk RTO indicator (`⚠️ High Risk`) integrated into the Everyday Dispatched Orders ledger for orders with $< 50\%$ courier delivery success or high return risk.
- **Order Inspection Pre-Dispatch RTO Advisory Banner**: High-visibility operational advisory inside the Order Detail Modal guiding the fulfillment team to confirm sizing and address via WhatsApp before packing or generating shipping labels.
- **Gemini AI Return (RTO) Risk Predictor Hub**: Interactive Gemini 2.5 Flash + Heuristic RTO evaluation in Order Detail Modal with Bengali explanation, size-bracketing risk detection, and recommended dispatch actions (`CALL_TO_VERIFY_SIZE`, `ADVANCE_REQUIRED`, `INSTANT_DISPATCH`).
- **AI RTO Risk Route Test Suite**: Comprehensive Vitest coverage (`tests/ai/predictRiskRoute.test.ts`) validating authentication enforcement, Gemini LLM JSON response parsing, and deterministic heuristic fallback triggers.

---

## [2.4.1] - 2026-11-05

### Added
- **Netlify Serverless Deployment Architecture (`https://deen-sales.netlify.app/`)**: Full App Router SSR, Edge functions, and API routes migration onto Netlify with `@netlify/plugin-nextjs` v5 and OpenNext runtime.
- **Accessories Category Tree**: Integrated `Accessories` (`#0d9488`) with granular sub-categories for `Mask` (`#14b8a6`) and `Belt` (`#b45309`) across `liveCategoryEngine.ts`, eliminating misclassifications into `Others`.
- **Ecom + Outlet Dispatch Executive Briefing**: Refined WhatsApp/Slack briefing generator in `LiveOpsTab.tsx` and `liveOpsProcessor.ts` to explicitly separate central e-commerce dispatches from branch split outlet courier dispatches (`Ecom + Outlet dispatch: X + Y`).

### Fixed
- **Netlify Build Failure (Exit Code 2)**: Resolved false-positive secret scanner build termination on public store URLs (`https://deencommerce.com`) and dates by adding `SECRETS_SCAN_ENABLED = "false"` in `netlify.toml`.
- **Blob Origin Transfer Bandwidth Consumption**: Added in-memory dataset caching with 10-minute TTL and HTTP 304 ETag revalidation on `/api/sample-data`, restoring unchanged datasets directly from client IndexedDB.
- **Strict ESLint & TypeScript Compilation**: Cleaned up explicit `any` casts in WooCommerce COGS routes, product analytics, and order grouping to achieve 100% clean builds.

---

## [2.4.0] - 2026-11-03

### Added
- **Multi-Month Statements Hub (`MonthlyStatementsHub.tsx`)**: Unified closing statement views consolidating September 2026, October 2026, and November 2026 (MTD) with automated variance calculation and month-over-month retention trajectory analysis.
- **Campaign Intelligence Tab (`CampaignIntelligenceTab.tsx`)**: Integrated Meta Ads, Google Ads, and SMS campaign tracking with dynamic ROAS, Blended CAC, and Delivered Net Sales attribution (`campaignEngine.ts`, `campaignStore.ts`).
- **Native Super White Default Background**: Default canvas theme set to pure crisp white (`#FFFFFF`) with zero hydration flicker, powered by dynamic CSS variables (`--bg-surface`, `--card-surface`, `--sidebar-surface`) and theme presets (Modern Slate, Cool Metallic Zinc, Warm Paper Ivory, Deep Midnight Canvas) in `SettingsTab.tsx`.
- **Gemini 2.5 AI Semantic Copilot**: Upgraded `@google/genai` to 2.29.1 supporting natural-language conversational queries, automated discrepancy diagnoses, and prompt templates in `src/lib/ai/`.
- **Multi-Month Baseline Datasets**: Generation scripts and raw order datasets for September, October, and November 2026 (`scripts/build_unified_baseline.ts`, `scripts/generate_multi_month_workbook.ts`).

### Changed
- Refactored `src/lib/dateFilter.ts` to enforce Bangladesh Standard Time (BST, UTC+6) calendar boundaries, eliminating end-of-month order clipping.
- Standardized `SettingsTab.tsx` with dedicated Canvas Background Style selector, instant live active indicators, and JSON export/import of user preferences.

### Fixed
- Fixed dark/light theme hydration flash by injecting an inline theme pre-loader in `src/app/layout.tsx`.
- Removed redundant standalone "Ask AI" button in `Header.tsx`.

---

## [2.3.0] - 2026-10-20

### Added
- **Live Operations Terminal (`LiveOpsTab.tsx`)**: Real-time warehouse packing and dispatch stream with live connection status, 7-day rolling baseline, and one-click WhatsApp/Slack executive dispatch briefing.
- **Pathao Customer Delivery Rating & Fraud Risk Scoring**: Real-time delivery rating badges (🌟 Excellent, 👍 Good, ⚖️ Moderate, ⚠️ High Risk, 🌱 New Buyer) based on empirical customer delivery history.
- **Everyday Dispatched Orders Ledger (`OrdersLedgerTab.tsx`)**: Consolidated Order-Wise table with expandable rows, multi-item basket counters (`+X more`), and instant Line Items toggle.
- **Authenticated Operator Profile**: Security telemetry card in Settings displaying user role, permissions checklist, and HMAC-SHA256 session diagnostics.

### Fixed
- Fixed mobile layout distortion by implementing unbreakable table containment across all ledger views.
- Resolved SVG icon blowout by clamping Lucide icons with explicit dimension classes and global CSS resets.

---

## [2.2.0] - 2026-10-08

### Added
- **Deterministic 0/1 Knapsack DP Solver (`subsetSum.ts`)**: Mathematical subset-sum algorithm reverse-engineering partial parcel returns from courier net collections.
- **Strict Integer Quantity Enforcer**: Runtime invariant preventing any floating-point quantity calculations in partial and return orders.
- **Branch Courier Suffix Hygiene**: Automated recognition and segregation of branch split courier consignments:
  - `c` $\to$ Cumilla Branch (POS `7`, Cashier `35`)
  - `w` $\to$ Wari Branch (POS `8`, Cashier `69`)
  - `s` $\to$ Sylhet Branch (POS `9`, Cashier `572`)
  - `m` $\to$ Mirpur Outlet (POS `2`, Cashier `3`)

### Fixed
- Eliminated POS walk-in transaction leakage into online courier dispatch reports.

---

## [2.1.0] - 2026-09-25

### Added
- **10 Golden UX Rules**: Codified design system and responsive constraints in `docs/DESIGN.md`.
- **Multi-Sheet Excel Closing Report (`excelExport.ts`)**: 7-sheet executive workbook generation via SheetJS (`XLSX`) with auto-fitted column widths.

### Fixed
- Resolved dual PostCSS configuration conflict by unifying Tailwind build rules into `postcss.config.js`.

---

## [2.0.0] - 2026-09-01

### Added
- Complete architecture rewrite from legacy Python `server.py` to Next.js 14 App Router, React 18, TypeScript 5.6, and AlaSQL in-memory OLAP engine.
- Dedicated tab modules for Executive Overview, Status Matrix, SKU Performance, Territory Breakdown, Unit Economics, and Courier Mismatch.
