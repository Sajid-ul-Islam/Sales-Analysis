# Product Requirements Document (PRD)
## DEEN Commerce — Sales & Return Reconciliation Engine

**Version:** 2.2.0  
**Status:** Approved & Implemented  
**Owner:** DEEN Commerce Operations, Logistics & Finance Engineering  
**Last Updated:** October 2026  

---

## 1. Executive Summary & Vision

**DEEN Commerce** operates a hybrid omni-channel lifestyle apparel brand encompassing a high-volume online e-commerce website ([deencommerce.com](https://deencommerce.com)) alongside physical retail outlet branches across Bangladesh (Mirpur, Cumilla, Wari, and Sylhet).

In high-volume apparel commerce, parcel delivery logistics are inherently non-linear. Orders experience split dispatches from multiple regional branches, partial customer acceptances (e.g., trying two sizes or styles and keeping one), full customer returns (RTO), size exchanges (`D-` / `DD-` prefix consignments), and courier COD settlement delays.

The **DEEN Commerce Sales & Return Reconciliation Engine** is an enterprise-grade analytics and reconciliation platform that unifies courier delivery tracking (Pathao Hermes API / Master Delivery Reports) with e-commerce store transactions (WooCommerce REST API / Order exports). By combining automated discrete knapsack dynamic programming with strict accounting rules, the system gives leadership, warehouse dispatchers, and finance teams a transparent, audit-ready net sales truth.

---

## 2. Core Problem Statement

1. **The Partial Order Ambiguity**: Customers frequently order multiple items (e.g., 2 shirts + 1 polo) but keep only a subset. Couriers collect a partial cash amount that includes shipping fees (50 TK inside Dhaka, 90 TK outside Dhaka). Without automated mathematical reconciliation, inventory managers cannot determine which exact SKU was returned or kept.
2. **Multi-Branch & Outlet Conflation**: An order with base ID `17263` might be split into `17263 c` (fulfilled from Cumilla) and `17263 w` (fulfilled from Wari). Historically, central online shipments were confused with Mirpur retail store POS register transactions. The system must maintain a strict boundary between the Online Store (Central Warehouse) and physical branch POS outlets.
3. **Courier Cost & COD Leakage**: Delivery fees, COD surcharges, and return shipping penalties frequently diverge from merchant collections. Reconciling Pathao charged fees against merchant customer collections prevents hidden courier billing leakages.
4. **Fractional Item Inventory Corruption**: Erroneous division of returned amounts into fractional quantities (e.g., 0.5 shirts) corrupts warehouse ERP inventory sync. Returned item counts must strictly remain whole integers.
5. **Customer RTO Vulnerability**: High-return repeat buyers inflict heavy sunk costs on forward and return logistics. Identifying chronic returners (>50% RTO) protects cash flow.

---

## 3. Target User Personas

| Persona | Key Responsibilities | Primary Dashboard Focus |
|---|---|---|
| **C-Level Executive / Founder** | High-level business performance, net cash margin, return losses, contribution margin | Executive Overview, KPI Overview, Net Sales Hero, Unit Economics |
| **Logistics & Warehouse Manager** | Parcel dispatches, courier consignment tracking, branch splits, Courier Mismatches | Outlet Dispatch Hub, Courier Mismatch, Territory Analysis, Item Returns |
| **Retail Branch Operations Lead** | In-store POS transactions, branch courier dispatches, outlet performance | Outlet Dispatch, Outlet Sales Tab (POS vs Web) |
| **Finance & Reconciliation Auditor** | COD recovery, Pathao fee audits, return loss accounting, export generation | Unit Economics, Courier Mismatch, Orders Ledger, Excel Export |

---

## 4. Key Functional Modules & Requirements

The dashboard features **12 dedicated operational modules**:

### 4.1 Executive Overview & KPI Metrics
- **Real-Time KPI Cards**:
  1. **Gross Dispatched Value**: Total order value shipped across all channels.
  2. **Net Reconciled Revenue**: Actual recognized revenue from delivered units and accepted partial items.
  3. **Return Value Loss**: Monetary cost of returned merchandise (paid and non-paid).
  4. **Delivery Retention Rate (%)**: Percentage of dispatched parcels successfully kept by customers.
  5. **Exchange Volume & Cost Recovery**: Parcels routed through size exchanges and Pathao charged fees vs customer collection.
  6. **Pathao Courier Costs & Margin Recovery**: Direct courier charges audited against customer delivery fees collected.
  7. **Packaging & Operations Loss**: Packaging material sunk cost (fixed ৳25 per return/partial).
- **Expandable Mini Donut Visuals**: Clean visual percentage indicators with immutable width/height constraints (`44x44` / `48x48`) to guarantee unbreakable browser scaling.

### 4.2 Status Matrix & Disposition Tracking
- Categorizes all line items into discrete delivery outcomes:
  - `Delivered`: Consignment delivered in full to customer.
  - `Paid Return`: Customer returned parcel, but delivery fee or return fee was collected via COD.
  - `Not Paid Return`: Full return with zero collection.
  - `Partial`: Customer accepted a subset of items and returned the remainder.
  - `Exchange`: Sizing swap order indicated by `D-` or `DD-` prefix.

### 4.3 Outlet Dispatch Hub
- **Purpose**: Tracks parcel dispatches, delivery retention rates, and returned consignment values across fulfillment nodes.
- **Fulfillment Centers (Strictly 5 Entities)**:
  1. `Online Store (Central Warehouse)`: Base consignments without suffix, dispatched from central hub.
  2. `Mirpur Outlet POS` (`m`): Dispatches or store orders fulfilled from Mirpur retail branch.
  3. `Cumilla Branch` (`c`): Dispatches from Cumilla branch outlet.
  4. `Wari Branch` (`w`): Dispatches from Wari branch outlet in Old Dhaka.
  5. `Sylhet Branch` (`s`): Dispatches from Sylhet regional branch outlet.
- **Strict Parcel-Count Rule**: All logistics metrics in this tab evaluate **unique parcels / consignments**, not individual garment pieces or order line duplicates.
- **KPI Indicators**: Top Retail Branch (evaluated purely across physical branches, excluding the central warehouse), Retail Outlets Share, and Delivery Success Rates.

### 4.4 Outlet Sales & Multi-Channel Revenue Reconciler
- **Purpose**: Direct integration with WooCommerce REST API (`/wp-json/wc/v3/orders`) to analyze gross sales, unit counts, discounts, and payment methods.
- **Channel Partitioning**:
  - **Online E-Commerce**: Orders placed via web checkout (`created_via: "checkout"`).
  - **In-Store POS Registers**: Filtered via `_sip_outlet_id` and cashier metadata (`_sip_created_by`):
    - `Mirpur Outlet POS` (`outlet_id: 1` or cashier `1508`)
    - `Cumilla Branch POS` (`outlet_id: 2` or cashier `3`)
    - `Wari Branch POS` (`outlet_id: 9` or cashier `572`)
    - `Sylhet Branch POS` (`outlet_id: 7/8` or cashier `35/69`)
- **Interactive Multi-Page Sync**: Dynamic pagination pull (100 per page across 5 pages) to capture high-density POS transactions across outlets.

### 4.5 SKU Performance & Category Breakdown
- **Distinct Product Categories**:
  - `Polo` vs `T-shirt`: Maintained as two distinct, non-overlapping product categories.
  - `Jacket` vs `Sweatshirt`: Maintained as two distinct outerwear categories.
  - `Panjabi`, `Jeans`, `Shorts`, `Hoodie`, and Accessories.
- **Metrics**: Units sold, units delivered, return rate (%), net revenue, and return financial impact.
- **Category & Item Performance Export**: Export SKU performance, delivery conversion, return rate, and gross revenue directly to formatted Excel spreadsheets.

### 4.6 Item Returns & Granular Return Source Analysis
- Deep-dive inspector for every returned line item.
- Identifies return origin sources:
  - `Full Return (Paid Return)`
  - `Full Return (Non-Paid Return)`
  - `Partial Order Return (Rejected Item)`
  - `Partial Order Return (Estimated Proportion)`
- Real-time search by SKU, customer phone, order ID, and territory filtering.

### 4.7 Knapsack DP Partial Item Matching Solver
- Solves which exact items in a multi-item order were kept vs returned based on the courier collected COD amount.
- Flattens multi-quantity order items into discrete single-garment candidate units.
- Evaluates candidate subsets against COD amount after deducting territory delivery charges (50 TK Dhaka, 90 TK outside Dhaka, 60/100/120 variants).
- **Strict Integer Constraint**: Returned item count must always evaluate to whole integer values (1, 2, 3...). Fractional quantities (such as 0.5) are strictly prohibited.

### 4.8 Exchanged Orders Hub
- Reconciles exchange consignments tagged with `D-` or `DD-` prefixes.
- Pairs exchange parcels back to original order numbers.
- Tracks courier charges incurred on exchange shipments and audits COD collected from customers for exchange shipping fees.

### 4.9 Courier Mismatch & Pathao Delivery Audit
- Cross-audits Pathao Courier Hermes API data against merchant order manifests.
- **Audit Categories**:
  - `STATUS_MISMATCH`: Courier shows delivered but merchant record is marked returned, or vice versa.
  - `COD_MISMATCH`: Discrepancy between courier collected cash and order invoice value.
  - `MISSING_IN_COURIER`: Merchant orders with no corresponding consignment record in Pathao.
  - `UNLOGGED_RETURN`: Courier marked parcel as returned, but merchant system still shows pending.
- **Severity Classification**: `CRITICAL` (direct financial leakage), `WARNING` (operational sync lag), `MATCH` (clean reconciliation).

### 4.10 Territory & Geographic Breakdown
- Segmented regional breakdown:
  - `Inside Dhaka Metro`: Standard ৳50/৳60 delivery charge zone.
  - `Outside Dhaka`: Standard ৳90/৳100/৳120 delivery charge zone.
  - `Outlet / POS`: In-store counter collections.
- Compares return incidence rate (%) and net realized sales volume between metropolitan and out-of-district buyers.

### 4.11 Customer Risk Profiling & RTO Scoring
- Profiles buyers based on historical order volume and delivery completion rate.
- **Risk Tiers**:
  - `HIGH_RISK`: Return/RTO rate $> 50\%$ on multiple orders. Recommendation: Mandatory advance shipping fee collection.
  - `MEDIUM`: Return/RTO rate between $20\% - 50\%$. Recommendation: Phone verification before dispatch.
  - `LOW`: Return/RTO rate $< 20\%$. Recommendation: Standard automated fulfillment.

### 4.12 Unit Economics & Logistics Financial Waterfall
- Comprehensive financial waterfall model:
  - **Gross GMV**: Invoiced dispatch value.
  - **Estimated COGS**: Modeled fabric and manufacturing cost (42%–45% of retail value).
  - **Courier Logistics Burden**: Gross courier fees minus customer shipping fees and paid return COD recoveries.
  - **Packaging Sunk Cost**: Fixed ৳25 loss per return or partial parcel.
  - **Net Contribution Margin**: Net cash earnings recognized post-logistics and manufacturing expenses.

### 4.13 Orders Ledger Master Inspector & Detail Modal
- Master search and filter table supporting searches across Order ID, Phone Number, Customer Name, and SKU.
- Filter by delivery status, fulfillment branch, and territory.
- Clickable rows open an interactive `OrderDetailModal` showing line-item pricing, customer notes, courier status tracking, and split fulfillment routes.

### 4.14 Excel Export Engine
- One-click multi-sheet export delivering:
  1. `Master Reconciled Ledger`
  2. `SKU Performance`
  3. `Category Performance`
  4. `Outlet Dispatch Summary`
  5. `Customer Risk Audit`
- Standardized status columns:
  - `Order Delivery Status`: Overall order outcome (`Delivered`, `Paid Return`, `Not Paid Return`, `Exchange`, `Partial`). Identical for all items within an order.
  - `Item Delivery Status`: Specific item outcome (`Delivered`, `Returned`, `Exchange`).

### 4.15 System Settings & Custom Themes Hub
- **Visual Appearance & Theme Customizer**:
  - 8 curated enterprise color presets (Deen Signature Orange, Royal Indigo, Emerald Growth, Electric Violet, Crimson Velvet, Ocean Sky, Amber Harvest, Deep Graphite).
  - Custom hexadecimal color picker with live real-time CSS variable updates (`--primary`, `--primary-hover`, `--primary-subtle`, `--primary-dark`).
  - Persistent browser storage in `localStorage` ensuring theme selections survive page reloads and browser sessions.
  - Interactive Theme Preview Widget rendering live buttons, badges, and accents.
  - Display preferences: Show/Hide mini donut charts and compact density toggles.
- **Reconciliation & Mathematical Parameters**:
  - Dynamic parameter binding: Any updates to `insideDeliveryFee`, `outsideDeliveryFee`, `packagingCost`, `cogsPercent`, or `exactTolerance` instantly re-run `runReconciliationEngine` and the Knapsack solver without reloading the page.
  - Inside Dhaka delivery fee deduction setting (Default: ৳50).
  - Outside Dhaka delivery fee deduction setting (Default: ৳90).
  - Packaging sunk cost per returned parcel (Default: ৳25).
  - Modeled COGS margin rate (Default: 42%).
  - Knapsack exact match tolerance window (Default: ৳2).
  - Ingestion toggles: Default Exclude August Dates and Default Exclude Physical POS Registers.
- **Cloud API Synchronization Center & Credential Vault**:
  - Live WooCommerce REST API and Pathao Courier Hermes API connection monitors.
  - Interactive Credential Drawer: Edit and save WooCommerce Store URL, Consumer Key/Secret, and Pathao Client ID/Secret/Username directly from the browser with persistent encrypted local state.
  - Custom date range selection and order status filters.
  - One-click live synchronization and health check diagnostics.
- **Data & Configuration Management**:
  - One-click baseline data reset (1,026 clean September orders).
  - Purge locally cached manual overrides.
  - One-click JSON diagnostic export and JSON configuration file import (instant restore of parameters and theme).
  - Activity Audit Log: Timestamped ledger tracking all theme updates, formula changes, and sync events.

---

## 5. Non-Functional Requirements

1. **Unbreakable CSS & Layout Resilience**:
   - Zero-unstyle guarantee: The application must never render unstyled HTML, missing utility classes, or broken CSS grids under any network or hot-reload condition.
   - Dual PostCSS configuration (`postcss.config.js` and `postcss.config.mjs`) ensuring seamless compilation across all build tools.
   - Intrinsic CSS fallbacks in `globals.css` ensuring responsive containers, overflow safety, and typography resets.
2. **Serverless & Vercel Native Execution**:
   - Resilient against missing disk spreadsheets in cloud serverless sandboxes.
   - Dual-mode operation: Local demo datasets when local files exist; instant Drag-and-Drop or Cloud Sync when deployed on Vercel.
3. **Deterministic Performance**:
   - Sub-second UI state filtering across 1,000+ line items using optimized React `useMemo` hooks.
   - Clean Next.js compilation (`npm run build`) completed in < 20 seconds.
