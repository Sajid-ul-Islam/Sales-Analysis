# Technical Requirements Document (TRD)
## DEEN Commerce — Sales & Return Reconciliation Engine

**Version:** 2.2.0  
**Stack:** Next.js 14 (App Router) · React 18 · TypeScript 5.6 · Tailwind CSS 3.4  
**Runtime:** Node.js 18+ (Vercel Serverless / Edge compatible)  
**Last Updated:** October 2026  

---

## 1. System Architecture Overview

The **DEEN Commerce Reconciliation Engine** is designed as a high-performance, client-first Next.js 14 web application with serverless API proxy routes.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT BROWSER                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │   UI Shell & Analysis Views (React 18 / Tailwind CSS)                 │  │
│  │   - Executive Overview       - Outlet Dispatch       - Outlet Sales   │  │
│  │   - Status Matrix            - SKU Performance       - Item Returns   │  │
│  │   - Courier Mismatch Audit   - Territory Breakdown   - Customer Risk  │  │
│  │   - Unit Economics           - Exchanged Hub         - Orders Ledger  │  │
│  │   - System Settings & Themes (SettingsTab.tsx)                        │  │
│  └───────────────────────────────────▲───────────────────────────────────┘  │
│                                      │                                      │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │   Reconciliation Engine Core (src/lib/)                               │  │
│  │   - Knapsack DP Solver (subsetSum.ts)                                 │  │
│  │   - Discrepancy Auditor (discrepancyAuditor.ts)                       │  │
│  │   - Reconciler & Geo Engine (reconciliationEngine.ts, geo.ts)         │  │
│  │   - Multi-Sheet Export Engine (excelExport.ts)                        │  │
│  │   - Theme Manager & Customizer (themeManager.ts)                      │  │
│  │   - Local Override State Store (overrideStore.ts)                     │  │
│  └───────────────────▲───────────────────────────────────▲───────────────┘  │
└──────────────────────┼───────────────────────────────────┼──────────────────┘
                       │ Local XLSX / CSV                  │ JSON Payloads
                       │ Dropzone Pipeline                 │
┌──────────────────────┴───────────────────────────────────┴──────────────────┐
│                         NEXT.JS APP ROUTER API LAYER                        │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────┐  │
│  │ /api/sync/woocommerce │ │   /api/sync/pathao    │ │ /api/sample-data  │  │
│  │ (WooCommerce v3 REST) │ │  (Pathao Hermes API)  │ │ (Serverless Safe) │  │
│  └───────────▲───────────┘ └───────────▲───────────┘ └───────────────────┘  │
│              │                         │                                    │
│              │                         │ ┌───────────────────────────────┐  │
│              │                         │ │       /api/sync/status        │  │
│              │                         │ │ (Connectivity & Health Audit) │  │
│              │                         │ └───────────────────────────────┘  │
└──────────────┼─────────────────────────┼────────────────────────────────────┘
               │ HTTPS / OAuth 1.0a      │ Bearer Token / Hermes REST
┌──────────────┴───────────┐ ┌───────────┴───────────┐
│     WooCommerce Store    │ │   Pathao Courier API  │
│ (https://deencommerce.com)│ │(api-hermes.pathao.com)│
└──────────────────────────┘ └───────────────────────┘
```

---

## 2. Technology Stack & Key Dependencies

| Component | Library / Framework | Version | Technical Justification |
|---|---|---|---|
| **Framework** | Next.js (App Router) | `14.2.15` | Hybrid SSR/Static client execution with serverless API route handlers |
| **Language** | TypeScript | `5.6.3` | Strict compile-time type safety across order schemas and reconciliation types |
| **Styling** | Tailwind CSS + PostCSS | `3.4.14` | Utility-first CSS with customized design system tokens and immutable layout guarantees |
| **Icons** | Lucide React | `0.453.0` | Feather-style SVG icons for clean operational iconography |
| **Spreadsheet Engine** | XLSX (SheetJS) | `0.18.5` | In-memory binary parsing and multi-sheet Excel generation |
| **Utility** | `clsx` & `tailwind-merge` | `^2.1.1` | Conflict-free conditional CSS class composition |

---

## 3. Core Modules & Algorithmic Specifications

### 3.1 Knapsack / Subset-Sum Partial Matching (`subsetSum.ts`)
When couriers accept partial item returns, the collected COD amount reflects:
$$\text{Collected COD} = \sum_{i \in \text{Kept}} \text{ItemPrice}_i + \text{DeliveryCharge}$$

The dynamic programming algorithm executes the following sequence:
1. **Garment Unit Flattening**: Expands multi-quantity order line items into discrete items with single quantity (`qty = 1`).
2. **Delivery Charge Variations**: Iterates candidate shipping fees based on territory:
   - Inside Dhaka: ৳50 (candidate variants: ৳60, ৳0)
   - Outside Dhaka: ৳90 (candidate variants: ৳100, ৳120, ৳0)
3. **Exact & Tolerance Subset Solver**:
   - `exactMatch`: Finds a combination whose total is within $\pm ৳2$ of $\text{COD} - \text{DeliveryCharge}$.
   - `toleranceMatch`: Evaluates candidate subsets within $\pm ৳25$.
   - `closestMatch`: Fallback choosing the closest discrete subset sum.
4. **Strict Integer Constraint**:
   Returned items quantity must always evaluate to whole positive integer values:
   $$\text{QuantityReturned} \in \mathbb{Z}_{\ge 0}$$
   **Fractional quantities (e.g. 0.5) are strictly prohibited and discarded.**

### 3.2 Fulfillment Branch & Outlet Detection (`reconciliationEngine.ts`)
Branch attribution uses a deterministic multi-stage waterfall:
1. **Store Name Check**:
   - Contains `cumilla` / `comilla` $\rightarrow$ `Cumilla Branch` (`c`)
   - Contains `wari` $\rightarrow$ `Wari Branch` (`w`)
   - Contains `sylhet` $\rightarrow$ `Sylhet Branch` (`s`)
   - Contains `mirpur` $\rightarrow$ `Mirpur Outlet POS` (`m`)
2. **Order ID Suffix Regex Check**:
   - `/\b\d+\s*c\b|[-_\s]c$/i` or `/\d+c$/i` $\rightarrow$ `Cumilla Branch`
   - `/\b\d+\s*w\b|[-_\s]w$/i` or `/\d+w$/i` $\rightarrow$ `Wari Branch`
   - `/\b\d+\s*s\b|[-_\s]s$/i` or `/\d+s$/i` $\rightarrow$ `Sylhet Branch`
   - `/\b\d+\s*m\b|[-_\s]m$/i` or `/\d+m$/i` $\rightarrow$ `Mirpur Outlet POS`
3. **Order Notes & Fallback**:
   - Inspects customer notes for outlet keywords.
   - Base orders with no suffix default to `Online Store (Central Warehouse)` with suffix `""`.

### 3.3 Paid Return Propagation Rule
If an order contains split consignments across multiple branches:
$$\text{isPaidReturn}_{\text{order}} = \bigvee_{p \in \text{parcels}} \text{isPaidReturn}_p$$
If at least one parcel is marked `Paid Return`, all returned parcels within that order inherit `Paid Return` accounting. Otherwise, they are classified as `Non-Paid Return`.

### 3.4 Split Multi-Parcel Delivery Rule
If an order is split into multiple branch shipments:
$$\text{isDelivered}_{\text{order}} = \bigwedge_{p \in \text{parcels}} \text{isDelivered}_p$$
An order is marked `DELIVERED` only if **every** branch parcel was successfully delivered. If some are delivered and some returned, the order status becomes `PARTIAL`.

### 3.5 Discrepancy Auditor (`discrepancyAuditor.ts`)
Audits differences between courier records and merchant order records:
- **Status Mismatch**: Courier shows `Delivered` while merchant record is `Returned`, or courier shows `Returned to Merchant` while merchant record is `Delivered`.
- **COD Mismatch**: Pathao collected cash diverges from expected collected amount by $> ৳10$.
- **Missing In Courier**: Merchant order marked fulfilled but absent from courier dispatch manifests.
- **Unlogged Return**: Courier marks parcel returned, but merchant system still flags order as open.

### 3.6 Financial Unit Economics Waterfall
- $\text{Gross Invoiced Sales} = \sum \text{Dispatched Gross Amount}$
- $\text{Net Realized Sales} = \sum \text{Delivered Items Value} + \sum \text{Partial Kept Items Value}$
- $\text{Estimated COGS} = 42\% \times \text{Net Realized Sales}$
- $\text{Gross Margin} = \text{Net Realized Sales} - \text{Estimated COGS}$
- $\text{Net Courier Burden} = \text{Pathao Gross Charges} - \text{Paid Return Recoveries} - \text{Customer Delivery Fees}$
- $\text{Packaging Loss} = (\text{Total Full Returns} + \text{Total Partials}) \times ৳25$
- $\text{Net Contribution Margin} = \text{Gross Margin} - \text{Net Courier Burden} - \text{Packaging Loss}$

---

## 4. API Endpoints & Serverless Integrations

### 4.1 `/api/sync/pathao` (POST)
- Authenticates against Pathao Aladdin / Hermes API using client credentials.
- Endpoint: `POST https://api-hermes.pathao.com/aladdin/api/v1/issue-token`
- Caches Bearer tokens in memory for 1 hour (`expires_in - 60s`).
- Fetches parcel details in parallel worker queues (concurrency: 5).
- Returns normalized `RawOrderRow[]` ready for reconciliation.
- **Serverless Resilience**: Wrapped in try/catch with safe filesystem guards; never throws uncaught 500 exceptions if local fallback files are absent.

### 4.2 `/api/sync/woocommerce` (POST)
- Queries WooCommerce REST API `/wp-json/wc/v3/orders`.
- Uses HTTP Basic Authentication (`consumer_key:consumer_secret`).
- Fetches orders in paginated batches (`per_page: 100`, up to 5 pages / 500 orders).
- Extracts in-store POS register metadata:
  - `_sip_outlet_id`: `1` (Mirpur), `2` (Cumilla), `9` (Wari), `7/8` (Sylhet).
  - `_sip_created_by`: Cashier user IDs (`1508`, `3`, `572`, `35/69`).

### 4.3 `/api/sync/status` (GET)
- Health-check endpoint verifying configuration status and live connectivity for Pathao and WooCommerce.
- Returns `{ pathao: { configured, connected }, woocommerce: { configured, connected } }`.

### 4.4 `/api/sample-data` (GET)
- Loads local workspace Excel spreadsheets when available on local developer machines.
- In serverless cloud environments (Vercel), detects absent files gracefully and returns empty arrays without throwing errors, prompting the user for drag-and-drop file ingestion.

---

## 5. Security & Environment Configuration

Configuration variables are resolved through `src/lib/secrets.ts` via standard environment variables:

| Variable | Environment | Default / Fallback |
|---|---|---|
| `WOOCOMMERCE_STORE_URL` | Server | `https://deencommerce.com` |
| `WOOCOMMERCE_CONSUMER_KEY` | Server | `""` |
| `WOOCOMMERCE_CONSUMER_SECRET`| Server | `""` |
| `PATHAO_BASE_URL` | Server | `https://api-hermes.pathao.com` |
| `PATHAO_CLIENT_ID` | Server | `""` |
| `PATHAO_CLIENT_SECRET` | Server | `""` |
| `PATHAO_USERNAME` | Server | `""` |
| `PATHAO_PASSWORD` | Server | `""` |

---

## 6. CSS & Layout Rendering Resilience

To guarantee that CSS rendering **never breaks**:
1. **Dual PostCSS Specification**: Both `postcss.config.js` (CommonJS `module.exports`) and `postcss.config.mjs` (ES Module `export default`) are maintained. This eliminates build tool loader ambiguities between Next.js webpack, Turbopack, and Tailwind CLI.
2. **Intrinsic CSS Tokens & Resets**: `globals.css` injects CSS root custom properties (`--primary: #EB5A19`, `--brand-navy: #0F172A`) and universal `box-sizing: border-box`, ensuring structural styling remains intact even if utility stylesheets experience loading delays.
3. **Responsive Container Contracts**: All tables and matrices utilize `.table-container-responsive` (`overflow-x: auto`) and `.min-w-0` to prevent flexbox blowouts on narrow displays.
4. **Explicit SVG Sizing**: All inline SVG charts and donut meters must have hardcoded `width="44" height="44"` (or `48x48`) and `shrink-0` classes to prevent SVG viewports from distorting or expanding under flex layouts.

---

## 7. System Settings & Customization Hub Architecture

Version 2.6 introduces the centralized `SettingsTab.tsx` and `settingsStore.ts` engine:
1. **Dynamic Financial Modeling**:
   - `insideDeliveryFee` (default ৳50) and `outsideDeliveryFee` (default ৳90) wire into knapsack net-COD deduction and courier burden calculations.
   - `cogsPercent` (default 42%) dynamically determines COGS deductions across delivered and kept items.
   - `packagingCost` (default ৳25) accounts for unboxing depreciation on returned parcels.
   - `exactTolerance` (default ৳2) defines the dynamic programming Knapsack tolerance window.
2. **Live Theme Customizer (`themeManager.ts`)**:
   - 8 curated brand presets + real-time 6-digit hex color picker.
   - Automatic generation of `--primary`, `--primary-hover`, `--primary-subtle`, and RGB channel variables applied live to `:root`.
   - Dark canvas toggle and compact density mode.
3. **Configuration & Audit Management**:
   - One-click JSON diagnostic export and JSON configuration file import.
   - In-memory & `localStorage` Activity Audit Log tracking timestamped modifications.
   - Safe credential editing with masked client secrets and live status connectivity testing.
