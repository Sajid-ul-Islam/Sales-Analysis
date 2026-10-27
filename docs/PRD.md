# Product Requirements Document (PRD)
## DEEN Commerce — Sales & Return Reconciliation Engine

**Version:** 2.4.0  
**Status:** Approved & Implemented  
**Owner:** DEEN Commerce Operations, Logistics & Finance Engineering  
**Last Updated:** October 2026 (Live Ops & AI Assistant Integration)  

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
  - `Exchange`: Sizing swap or product replacement indicated by `D-` or `DD-` prefix, replacement notes (`Exchange for #17839`), or non-checkout orders (`created_via: "admin"` / `"manual"` / `"no-checkout"`). In DEEN operations, non-checkout orders represent customer exchange replacements created manually by store staff, and are isolated from new sales revenue and processing queue counts.

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
    - `Mirpur Outlet POS` (`outlet_id: 2` or cashier `3`)
    - `Cumilla Branch POS` (`outlet_id: 7` or cashier `35`)
    - `Wari Branch POS` (`outlet_id: 8` or cashier `69`)
    - `Sylhet Branch POS` (`outlet_id: 9` or cashier `572`)
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

### 4.16 Live Operations Terminal & Real-Time Dispatch Engine
- **Purpose**: Real-time warehouse operational terminal monitoring high-velocity fulfillment, active packing queues, and courier handover telemetry.
- **Key Operational Features**:
  1. **Status Modification Timestamp Tracking**: Uses `Date Modified` / `dateModified` to track precisely when orders transitioned from `processing`/`hold` to `completed`/`shipped`. Orders modified on the active operational date are verified as today's dispatches.
  2. **Warehouse Fulfillment Queue**: Real-time backlog tracking all active orders in `processing` or `on-hold` status awaiting customer phone confirmation or warehouse packing.
  3. **Today's Active Orders Pipeline**: Aggregates Today's Shipped Parcels + all orders currently in `processing` placed today.
  4. **7-Day Rolling History & Interactive Date Strip**: Horizontal 7-day selector allowing operators to inspect any previous day's dispatches, category mix, and financial KPIs.
  5. **Integer 7-Day Daily Baseline**: Rolling daily average baseline computed using strict rounded integers (`Math.round`), eliminating corrupting decimal representations.
  6. **Executive Briefing Generator**: Automatically synthesizes operational summaries with one-click copy for WhatsApp, Slack, and executive updates.
  7. **Real-Time Courier Telemetry (Pathao Hermes)**: Live tracking of parcel statuses (Delivered, In Transit, Returned, Pending Pickup, Untracked), courier handover rate, and real-time COD collected.

### 4.17 DEEN Assistant: AI-Supported Reconciliation & Business Copilot
- **Purpose**: Autonomous executive business analyst integrated into the dashboard, capable of answering queries regarding net sales, return losses, courier leakage, and live fulfillment in real-time.
- **Key Capabilities**:
  1. **Omni-Provider Architecture**: Powered by Google Gemini by default, with Bring Your Own Key (BYOK) modal supporting OpenAI (GPT-4o), Anthropic (Claude 3.5), and Groq (Llama 3).
  2. **Live Ops & Fulfillment Grounding**: Deterministically feeds `LiveOpsAnalyticsSlice` into LLM prompts, eliminating hallucinations for today's sales, queue depth, courier telemetry, and 7-day rolling baselines.
  3. **Offline Heuristic Knowledge Engine**: Gracefully synthesizes full executive summaries from deterministic algorithms and domain rules even when completely offline or without an API key.
  4. **Agentic Action Proposals**: Proposes and executes bulk audit tagging (e.g. tagging high-risk RTO customers for advance fees, tagging Pathao courier COD discrepancies).
  5. **Persistent History & Markdown Export**: Encrypts and saves chat history locally with one-click export to Markdown (`.md`).

### 4.18 Everyday Dispatched Orders Ledger & Order-Wise Consolidation
- **Consolidated Default State**: Ledger defaults to `ORDER_WISE` view, grouping granular line items into single authoritative order rows.
- **Multi-Item Basket Counter**: Displays prominent `+X more` interactive badges for multi-item baskets with collapsible item breakdown rows showing individual product titles, SKUs, and prices.
- **Flexible View Switcher**: High-speed toggle between Consolidated Orders (`ORDER_WISE`) and Line Items (`ITEM_WISE`), fully synchronized with URL state parameter `?ledgerView=ORDER_WISE|ITEM_WISE`.
- **Specialized Multi-Sheet Excel Export**: Generates authoritative multi-sheet workbooks (`Shipped Orders (Order-Wise)` and `Exchanges & Non-Checkout`), strictly isolating non-checkout exchange replacements from commercial revenue.

### 4.19 Pathao Customer Delivery Rating & Phone Intelligence Engine
- **Purpose**: Real-time fraud screening, COD risk mitigation, and buyer reliability classification based on customer mobile numbers.
- **Dual-Tier Grounded Resolution**:
  1. **Pathao Courier Network Telemetry**: Queries Pathao's recipient insight API (`POST /aladdin/api/v1/user/success`) using B2B OAuth credentials to retrieve network-wide delivery rate, total deliveries, and return statistics.
  2. **Empirical Store History Grounding (Zero Hallucination)**: Seamless fallback to DEEN's historical delivery records (2,500+ orders, 2,498 Pathao consignments, and customer return registers) to compute exact empirical delivery success rate (`Delivered / (Delivered + Returned) * 100`) with instant $0\text{ ms}$ local hydration.
- **Standardized Rating Tiers**:
  - 🌟 **Excellent** ($\ge 90\%$ success): Low risk, eligible for fast-track COD dispatch (`bg-emerald-50 text-emerald-700`).
  - 👍 **Good** ($80\% - 89\%$ success): Low risk, consistent delivery history (`bg-teal-50 text-teal-700`).
  - ⚖️ **Moderate** ($60\% - 79\%$ success): Medium risk, size and address phone confirmation recommended (`bg-amber-50 text-amber-700`).
  - ⚠️ **High Risk** ($< 60\%$ success): High RTO probability, recommends mandatory advance courier fee before shipment (`bg-rose-50 text-rose-700 animate-pulse`).
  - 🌱 **New Customer** ($0$ prior orders): First-time buyer profile (`bg-slate-100 text-slate-600`).
- **Ubiquitous Visual Integration**: Displayed directly under customer contact details in the Order-Wise table, Item-Wise table, Order Inspection Modal, and Order-Wise Excel export columns.

### 4.20 Maximized Sales Volume by Category Split View
- **Dual-Chart Split Screen**: Maximized side-by-side grid layout pairing the Category Revenue Donut Chart with the Subcategory Volume Bar Chart.
- **Streamlined Visual Hierarchy**: Removed redundant 7-day average overlays from the bar chart, allowing warehouse leads and merchandisers to audit volume throughput without chart clutter.
- **Subcategory Deep-Dive Toggle**: 1-click toggle to drill into granular jeans fits (Slim Fit, Regular Fit, Straight Fit) with persistent state preservation.

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

---

## 6. User Experience (UX) Architecture & Ergonomic Enhancements

To guarantee a best-in-class merchant and auditor experience across Desktop, Tablet, and Mobile devices:

### 6.1 Omnipresent Command Palette (`Cmd + K` / `Ctrl + K`)
- Instant keyboard-driven global modal accessible from any view.
- Unified search indexing:
  - **Orders**: Base Order ID, branch suffixes (`c`, `w`, `s`, `m`), Pathao consignment ID, tracking code.
  - **Customers**: Phone number lookup (`017...`, `018...`, `019...`), customer name, risk classification.
  - **SKUs & Categories**: Garment SKU code, product title, delivery conversion rate.
  - **Quick Navigation & Actions**: 1-click jump to any of the 14 tabs, trigger live sync, toggle themes, export data.

### 6.2 Real-Time Sync Observability & Live Notification Center
- **Dynamic Header Status Badges**: Pulsing green dot for WooCommerce REST API, pulsing blue dot for Pathao Hermes Courier API, showing real-time connectivity and countdown to next auto-sync.
- **Floating Toast System**: Non-intrusive notification toasts alerting users to newly synced orders, courier status transitions, and newly detected courier discrepancies.
- **Notification Drawer**: Central history drawer preserving the last 25 operational sync events with direct links to inspected rows.
- **Webhook Redundancy & Zero-Pressure Tracking**: Support for dual-redundant Pathao webhook ingestion and rate-limit protected live synchronization, linking consignment IDs into WooCommerce order records with zero plugin edits.

### 6.3 Universal Date Range Engine Across All Modules
- Global persistent header filter supporting: `Today`, `Yesterday`, `Last 7 Days`, `Last 30 Days`, `This Month (MTD)`, and `Custom Date Range`.
- Period-over-period comparison mode ($\Delta \%$) across Executive Overview, Orders Ledger, SKU Performance, Customer Risk, and Territory Breakdown.

### 6.4 Table Display Ergonomics & Virtualization
- **Density Controls**: Three selectable display densities (`Compact` 32px, `Standard` 44px, `Relaxed` 56px) to accommodate warehouse tablets and desktop workstations.
- **Column Visibility Manager**: Customizable column selector to focus on specific financial or operational columns.
- **Virtual Windowing**: High-performance virtualization ensuring silky 60fps scrolling across 10,000+ orders without browser lag.

### 6.5 Interactive AI Copilot Action Cards
- In-chat actionable widgets: 1-click navigate to order in Orders Ledger, 1-click draft courier dispute email with pre-filled consignment evidence, and inline mini trendline visualizations.

### 6.6 Offline Persistence & IndexedDB Caching
- Browser IndexedDB caching of order snapshots and reconciliation states for instantaneous (<150ms) boot times and offline resilience during warehouse network interruptions.

### 4.9 Smart Inventory (SIP) Line-Item Origin Tracking
- **Purpose**: Direct extraction from WooCommerce REST API order payload to surface which exact branch inventory fulfilled each line item.
- **Data Source**: Order-level `_sip_waterfall_deductions` array mapping item `variation_id` / `product_id` to physical outlets (Warehouse, Mirpur-12, Cumilla, Wari, Sylhet).
- **Presentation**: Displayed as color-coded badges in Everyday Dispatched Orders Ledger (Order-Wise nested list and Item-Wise flat view) and Order Details modal.
- **Excel & CSV Export Manifests**: All Excel workbooks (`.xlsx`) and CSV manifests include an explicit `SIP Inventory` column identifying the originating warehouse/outlet node for auditing branch stock deductions offline.

### 4.10 Dynamic & Adjustable Category Volume Bar Chart
- **Purpose**: Ensure the Category & Sub-Category sales volume bar chart seamlessly fills available screen space and dynamically scales relative to peak product dispatches.
- **Highest Bar Scaling**: Dynamic height calculation based on the highest product category volume, giving ample vertical presence to top-selling items and preventing letterbox distortion.
- **Adjustable Size Controls**: Real-time user sizing controls (`Auto`, `Mid`, `Tall`, `Max`, and `+`/`-` fine-tuning steppers) with localStorage persistence.
- **Visual Intelligence**: Overhead volume counts rendered directly above all bars with a crowned badge (`👑`) on the highest-performing category.

