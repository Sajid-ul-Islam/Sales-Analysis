# Antigravity Workspace Guidelines & Agent Contract: DEEN Commerce Reconciliation Engine

**Version:** 2.4.0  
**Target Environment:** Next.js 14.2 App Router · TypeScript 5.6 · Tailwind CSS 3.4 · Node.js 18+  
**Project:** DEEN Commerce — Sales & Return Reconciliation Engine  
**Last Updated:** November 2026  

---

## 1. Executive Mission & Identity

You are operating as an autonomous, high-precision software engineer and systems architect within the **DEEN Commerce Reconciliation Engine** workspace. 

This repository powers the financial, logistical, and operational backbone of **DEEN Commerce**, an omnichannel apparel brand operating nationwide across Bangladesh through e-commerce ([deencommerce.com](https://deencommerce.com)) and four retail outlet branches:
- **Mirpur Outlet** (POS Outlet ID `2`, Cashier User ID `3`, suffix `m`)
- **Cumilla Branch** (POS Outlet ID `7`, Cashier User ID `35`, suffix `c`)
- **Wari Branch** (POS Outlet ID `8`, Cashier User ID `69`, suffix `w`)
- **Sylhet Branch** (POS Outlet ID `9`, Cashier User ID `572`, suffix `s`)
- **Online Store / Central Warehouse** (Primary e-commerce fulfillment, unsuffixed numeric base IDs)

All agent actions must preserve system reliability, financial audit accuracy, and UI stability.

---

## 2. Core Documentation Index

Always reference the canonical documentation hierarchy before modifying architecture or business logic:

| Document | Primary Location | Purpose |
|---|---|---|
| **AGENTS.md** | `AGENTS.md` / `docs/AGENTS.md` | Autonomous agent behavioral contracts, business rules & invariants |
| **API.md** | `API.md` / `docs/API.md` | Complete REST API & webhook specifications for WooCommerce and Pathao |
| **ARCHITECTURE.md** | `ARCHITECTURE.md` / `docs/ARCHITECTURE.md` | System architecture, component graph, state stores & data pipelines |
| **AUDIT.md** | `AUDIT.md` / `docs/AUDIT.md` | Reconciliation algorithms, COD leakage audit & accounting proofs |
| **AUDIT_REPORT.md** | `AUDIT_REPORT.md` / `docs/AUDIT_REPORT.md` | Historical audit reports, empirical data findings & closed-month validations |
| **BUGS_AND_FIXES.md** | `BUGS_AND_FIXES.md` / `bugs&fixes.md` | Incident log, regression mitigations & architectural bug fixes |
| **CHANGELOG.md** | `CHANGELOG.md` / `docs/CHANGELOG.md` | Semantic version history & detailed release notes |
| **CONTEXT.md** | `CONTEXT.md` / `docs/CONTEXT.md` | Domain context, Bangladesh logistics realities & retail ecosystem |
| **CONTRIBUTING.md** | `CONTRIBUTING.md` / `docs/CONTRIBUTING.md` | Developer onboarding, Git conventions & PR guidelines |
| **DATA_SYNC_AND_PARTITIONING.md** | `docs/DATA_SYNC_AND_PARTITIONING.md` | Partitioned month lakehouse, non-destructive upsert merger & fast slicing |
| **DEPLOYMENT.md** | `DEPLOYMENT.md` / `docs/DEPLOYMENT.md` | Vercel deployment, Docker setup, edge proxies & CDN configs |
| **DESIGN.md** | `DESIGN.md` / `docs/DESIGN.md` | Unbreakable UI design system, color tokens & 10 Golden Rules |
| **OPERATIONS.md** | `OPERATIONS.md` / `docs/OPERATIONS.md` | Warehouse, retail branch & finance department standard SOPs |
| **PRD.md** | `PRD.md` / `docs/PRD.md` | Product Requirements Document (features, personas & scope) |
| **R&D.md** | `R&D.md` / `docs/R&D.md` | Research & development roadmap, ML RTO models & innovations |
| **README.md** | `README.md` | High-level repository orientation & developer setup guide |
| **SECURITY.md** | `SECURITY.md` / `docs/SECURITY.md` | Threat modeling, HMAC signatures, RBAC & vulnerability management |
| **SKILLS.md** | `SKILLS.md` / `docs/SKILLS.md` | Machine & agent skill definitions, schemas & triggers |
| **TESTING.md** | `TESTING.md` / `docs/TESTING.md` | Vitest testing suites, mock pipelines & mathematical verification |
| **TODO.md** | `TODO.md` / `docs/TODO.md` | Living roadmap, completed milestones & sprint backlog |
| **TRD.md** | `TRD.md` / `docs/TRD.md` | Technical Requirements Document (data structures & APIs) |
| **WEBMCP.md** | `WEBMCP.md` / `docs/WEBMCP.md` | Web Model Context Protocol specifications & agent interfaces |
| **WORKFLOW.md** | `WORKFLOW.md` / `docs/WORKFLOW.md` | End-to-end data pipelines & developer release workflows |

---

## 3. Order Tracking, Suffix Hygiene & Fulfillment Rules

Every agent modifying order parsing, reconciliation logic, or table views MUST enforce the following rules:

### 3.1 Fulfillment Channel Classification
1. **Online Store (Central Warehouse)**:
   - Primary e-commerce checkout orders (`created_via: "checkout"` or `"store-api"`).
   - Couriers: Pathao Hermes API. Consignment IDs follow numeric base order numbers without suffix (e.g., `17263`).
   - Flag: `isOrderOnline: true`, `isPos: false`.

2. **Branch Split Courier Dispatches**:
   - Web orders split across retail branches due to central stock shortages.
   - Suffix conventions:
     - `17263 c`: Sent from **Cumilla Branch** (POS Outlet ID `7`, Cashier `35`)
     - `17263 w`: Sent from **Wari Branch** (POS Outlet ID `8`, Cashier `69`)
     - `17263 s`: Sent from **Sylhet Branch** (POS Outlet ID `9`, Cashier `572`)
     - `17263 m`: Sent from **Mirpur Outlet** (POS Outlet ID `2`, Cashier `3`)
   - Flag: `isOrderOnline: true`, `isPos: false`, `isSplitBranch: true`. Tracked on `OutletDispatchTab` and `LiveOpsTab`.

3. **In-Store POS Register Walk-Ins**:
   - Physical outlet register sales (`created_via: "pos"`, `_sip_outlet_id`: `2`, `7`, `8`, or `9`).
   - Cashier User IDs: Mirpur `3`, Cumilla `35`, Wari `69`, Sylhet `572`.
   - Payment methods: Cash, bKash QR, Nagad QR, or Card terminal swipe.
   - NEVER assigned courier consignments.
   - Flag: `isPos: true`, `isOrderOnline: false`. Tracked exclusively on `OutletSalesTab`. NEVER mix POS walk-in sales into online courier dispatch metrics.

4. **Exchange Replacements**:
   - Prefixes: `D-17263`, `DD-17263`, or `created_via: "admin"` / `"manual"` / `"no-checkout"`.
   - Represent post-sale customer size or color replacements arranged by support staff.
   - Strictly isolated from initial commercial sales to avoid inflating gross sales revenue. Tracked on `ExchangedOrdersTab`.

---

## 4. Mathematical Reconciliation & Accounting Invariants

### 4.1 Knapsack Dynamic Programming Solver (`src/lib/subsetSum.ts`)
When couriers deliver a multi-item parcel partially, they collect a cash amount. The knapsack solver reverse-engineers the exact SKUs delivered vs returned.

1. **Integer Quantity Invariant**:
   - Returned and delivered quantities **MUST ALWAYS BE INTEGERS (1, 2, 3...)**.
   - Fractional quantities (e.g., `0.5`, `1.5`) are **STRICTLY FORBIDDEN**. If a float is detected, the run must fail with an audit error.

2. **Shipping Fee Deduction**:
   - Delivered cash collected includes courier delivery fees:
     - Inside Dhaka: ৳50 delivery fee
     - Outside Dhaka: ৳90 delivery fee
   - Algorithm subtracts the applicable delivery charge from net collected cash before running the subset-sum knapsack solver on line-item unit prices.

3. **Status Taxonomy**:
   - `Delivered`: All line items accepted by customer; full payment settled.
   - `Paid Return`: Entire parcel returned by customer, but customer paid delivery fee or return surcharge.
   - `Return`: Entire parcel returned with zero money collected.
   - `Partial`: Customer accepted at least one item and rejected at least one item.
   - `Exchanged`: Handled as return-and-replace consignment.

4. **Sunk Cost Constants**:
   - Packaging material loss: Fixed **৳25** per returned or partial parcel.
   - Courier return charge: Pathao return penalty applied to non-delivered parcels.

---

## 5. Unbreakable CSS & UI Contracts

The user interface has strict zero-breakage contracts codified in [.agents/rules/css_and_styling_rules.md](.agents/rules/css_and_styling_rules.md) and [.agents/rules/ui_ux_laws_and_principles.md](.agents/rules/ui_ux_laws_and_principles.md) (with the audit skill at [.agents/skills/ui-ux-audit-and-design/SKILL.md](.agents/skills/ui-ux-audit-and-design/SKILL.md)). All AI agents must adhere to:

1. **Table Containment**:
   - Every `<table>` element MUST be wrapped in a container with `overflow-x-auto min-w-0 w-full`.
   - Never allow tables to blow out parent layout containers.

2. **SVG Dimension Clamping**:
   - All Lucide and custom SVGs must have explicit height and width classes or attributes (e.g., `w-4 h-4`, `w-5 h-5`, max `w-11 h-11`).
   - Unconstrained SVGs that expand to viewport size are strictly prohibited.

3. **Native Super White Default**:
   - Root background must default to pure `#FFFFFF` (`--bg-surface: #FFFFFF`).
   - Dynamic theme variables (`--bg-surface`, `--card-surface`, `--sidebar-surface`, `--border-surface`, `--text-surface`) must be updated synchronously via `applyThemeToDocument()` in `src/lib/themeManager.ts`.

4. **Tailwind & PostCSS Resilience**:
   - Maintain dual PostCSS compatibility (`postcss.config.js` and `postcss.config.mjs`).
   - Preserve `@apply` utility isolation to prevent CSS cascade corruption.

---

## 6. Zero-Compute Webhook Architecture

- Webhook payloads received from WooCommerce or Pathao Hermes are captured to `src/data/sync-events.jsonl`.
- Processing is decoupled: incoming webhooks return HTTP 200 immediately, and reconciliation state re-computes incrementally on-demand or during scheduled worker runs.
- Webhook signature verification uses HMAC-SHA256 (`src/app/api/sync/...`).

### 6.1 Partitioned Month Store & Upsert Merger Invariant
- **Non-Destructive Sync Rule**: Never replace the entire `rawOrders` master array with a single date-window sync. Always use `upsertOrderRows(existing, incoming)` from `src/lib/sync/partitionStore.ts` to merge newly fetched orders by primary key (`orderId`).
- **Monthly Partitioning**: Store orders partitioned by `YYYY-MM` in IndexedDB (`deen_partition_orders_YYYY_MM`). Historical closed months (e.g. September, October) have permanent/30-day TTLs.
- **Fast Filter-Wise Slicing**: Slicing by date scope, outlet branch, or delivery status must run in-memory against the local dataset (<5ms) rather than issuing new network queries. Full specification: `docs/DATA_SYNC_AND_PARTITIONING.md`.

---

## 7. Agent Operational Checklist

Before declaring any coding task complete:
1. Run `npx tsc --noEmit` to ensure zero TypeScript errors.
2. Verify all UI changes conform to the 10 Golden UX Rules in `DESIGN.md`.
3. Check that the knapsack solver integer constraint remains intact.
4. Ensure no secret tokens (Pathao `client_secret`, WooCommerce consumer secrets) are leaked to client-side bundles.
5. Verify that both root documentation and `docs/` remain synchronized.
