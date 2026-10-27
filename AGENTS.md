# Antigravity Workspace Guidelines: Return & Sales Reconciliation

## Documentation Architecture
* **Product Requirements Document (PRD)**: [docs/PRD.md](docs/PRD.md)
* **Technical Requirements Document (TRD)**: [docs/TRD.md](docs/TRD.md)
* **Design System & CSS Architecture**: [docs/DESIGN.md](docs/DESIGN.md)
* **Order & Fulfillment Rules**: [.agents/rules/order_rules.md](.agents/rules/order_rules.md)
* **Unbreakable CSS & Styling Rules**: [.agents/rules/css_and_styling_rules.md](.agents/rules/css_and_styling_rules.md)
* **Reconciliation & Accounting Rules**: [.agents/rules/reconciliation_and_accounting_rules.md](.agents/rules/reconciliation_and_accounting_rules.md)
* **API Integration & Data Sync Rules**: [.agents/rules/api_and_data_sync_rules.md](.agents/rules/api_and_data_sync_rules.md)

---

## Business Rules for Order Tracking & Fulfillment

Refer to detailed rules in [.agents/rules/order_rules.md](.agents/rules/order_rules.md).

### 1. General Information
* An order (e.g. ID `17263`) may contain multiple items.

### 2. Fulfillment Locations & Courier IDs
* **Online Store (Central Warehouse)**: Pathao Courier ID remains unchanged without suffix (e.g., `17263`).
* **Retail Outlet Branches & POS (Two Distinct Categories)**:
  * **Type 1: POS / Non-Checkout Orders (Offline Retail Walk-In Orders)**: Physical store register sales (`_sip_outlet_id`: Mirpur `2`, Cumilla `7`, Wari `8`, Sylhet `9`; cashier user IDs: Mirpur `3`, Cumilla `35`, Wari `69`, Sylhet `572`; `created_via: "pos"` or empty). Walk-in customers paying with Cash, bKash QR, Nagad QR, or Card terminal swipe at store registers without courier tracking. Excluded from online commercial dispatches (`isPos: true`, `isOrderOnline: false`). Tracked strictly on `OutletSalesTab`.
  * **Type 2: Online Orders Dispatched from Outlets (Branch Courier Dispatches)**: Web checkout orders fulfilled from physical branch outlets when central warehouse lacks stock:
    * `17263 c`: Items sent from **Cumilla Branch** (POS outlet ID `7`, cashier `35`)
    * `17263 w`: Items sent from **Wari Branch** (POS outlet ID `8`, cashier `69`)
    * `17263 s`: Items sent from **Sylhet Branch** (POS outlet ID `9`, cashier `572`)
    * `17263 m`: Items sent from **Mirpur Outlet** (POS outlet ID `2`, cashier `3`)
    * **Single Definitive Rule for Ecommerce Orders**: An order is strictly classified as an Ecommerce order (`isOrderOnline: true`, `isPos: false`) if and only if:
      1. It was placed via web checkout (`created_via: "checkout"` or `"store-api"`), OR
      2. It has an explicit ecommerce payment method (`payment_method: "ecom"` or `"sip_ecom"`), OR
      3. It has courier tracking (Pathao consignment ID / shipping lines).
      In-store counter payments (such as bKash QR or Card swipe at outlet registers) are never classified as Ecommerce orders. Tracked in `OutletDispatchTab` and `LiveOpsTab`.

### 3. Order Statuses
* **Delivered**: Entire parcel delivered.
  * **Split Multi-Parcel Rule**: If an order has split multi-parcels (e.g. from branches), detect items from product costs; if every parcel is delivered, mark the order as **Delivered**.
* **Returned**: All parcels in the order are returned.
  * **Paid Return Rule**: If at least one parcel is marked as Paid Return, all returned parcels count as paid returns; otherwise non-paid returns.
* **Partial**: Multi-item orders with a mix of statuses (some accepted, some returned, or exchanged).
  * **Price & Delivery Charge Accounting**: The delivered/collected price may include a 50 TK or 90 TK delivery charge; the remainder is the price of received/kept items, and the leftover price is the price of returned items.
  * **Integer Rule**: Returned items quantity **cannot be a float (0.5 is strictly forbidden)**; it must always be an **integer value (1, 2, 3...)**.
* **Exchanged**: Indicated by prefixes such as `D-17263` or `DD-17263`, replacement notes, or non-checkout orders (`created_via: "admin"` / `"manual"` / `"no-checkout"`). In DEEN operations, non-checkout orders represent customer size/item exchange replacements created manually by store staff, and are strictly isolated from new commercial sales and processing queue counts.

### 4. Excel Export Status Columns & Isolation
* **Order Delivery Status**: Overall order status (`Delivered`, `Paid Return`, `Not Paid Return`, `Exchange`, `Partial`). Every item in the order gets this identical value.
* **Item Delivery Status**: Item-specific status:
  * If order is **Delivered** -> `Delivered`
  * If order is **Paid Return** or **Not Paid Return** -> `Returned`
  * If order is **Partial** -> `Delivered` (kept item) or `Returned` (returned item)
  * If order is **Exchange** -> `Exchange`
* **Commercial Export Isolation**: Shipped orders Excel export strictly excludes POS outlet orders and manual non-checkout exchange replacements from the commercial sales sheet (`Shipped Orders (Online)`). Replacements are cleanly isolated on `Exchanges & Non-Checkout`.
* **SIP Inventory Origin in All Exports**: All Excel (.xlsx) and CSV export manifests include an authoritative `SIP Inventory` column identifying the Smart Inventory stock deduction location (`Central Warehouse`, `Mirpur Outlet`, `Cumilla Branch`, `Wari Branch`, `Sylhet Branch`, `Exchange Replacement`, or consolidated multi-branch lists like `Sylhet Branch, Mirpur Outlet`) across:
  - `Shipped Orders (Order-Wise)` and `Exchanges & Non-Checkout` (`buildOrderWiseWorkbook`)
  - `Shipped Orders (Online)` and `Exchanges & Non-Checkout` (`buildLiveShippedOrdersWorkbook`)
  - `Reconciled Orders` and `Item-Wise Returns` (`exportReconciledExcel`)
  - `Outlet Parcels Ledger` (`handleExportOutletReport`)
  - Real-time CSV exports in `LiveOpsTab` (`handleExportCsv`)

### 5. Unbreakable CSS & Styling Standards
* **Compiled Zero-CDN PostCSS Architecture**: Production CSS is compiled ahead-of-time through Next.js PostCSS (`postcss.config.js` and `postcss.config.mjs`) with zero runtime CDN scripts, eliminating render-blocking network requests and layout shifts.
* **Essential Inlined Critical CSS**: Lightweight inlined resets (`box-sizing`, scrollbars, table containment, font smoothing, anti-FOUC theme initializer) in `src/app/layout.tsx` prevent any unstyled flash before async chunks hydrate.
* **Self-Hosted Variable Fonts**: Uses `next/font/google` (`Inter` and `Plus_Jakarta_Sans` with CSS variables `--font-sans` and `--font-headline`) downloaded at build time with zero external Google font requests.
* **Layered Dark Mode Surface Depth**: Pure `#000000` canvas only, with hierarchical elevation surfaces: `deepBlack.canvas` (#000000), `deepBlack.sidebar` (#050505), `deepBlack.card` (#0A0A0A), `deepBlack.elevated` (#121212), `deepBlack.hover` (#171717), and `deepBlack.border` (#1F1F1F). Brute-force `!important` overrides are forbidden.
* **WCAG AA Contrast Standards**: High-contrast brand typography using `primary-dark` (`#C8430E` / 4.6:1 contrast ratio against white) on small text, and minimum 11px font floor across navigation and status chips.
* **Data Table Containment**: All data tables must be wrapped in `overflow-x-auto` with `min-w-0` to guarantee zero layout blowout.
* **Inline SVG Dimensions**: Inline SVG charts must specify explicit `width="44" height="44"` (or `48x48`) and `shrink-0` to prevent SVG viewport distortion.
* **Reduced Motion Compliance**: Accessible `@media (prefers-reduced-motion: reduce)` declarations ensure instant transitions for users requesting reduced motion.

### 6. Live Operations & Real-Time Dispatch Rules
* **Status Modification Verification**: An order is verified as shipped on date $D$ if its status is `completed`, `shipped`, or `delivered`, and its modification timestamp (`Date Modified` / `dateModified`) matches date $D$.
* **Warehouse Pack Queue**: Backlog of orders needing warehouse fulfillment or customer verification; strictly defined as all active orders in `processing` OR `hold` / `on-hold` status.
* **Today's Active Orders Pipeline**: Defined as Today's Shipped Orders + all orders currently in `processing` placed today.
* **7-Day Rolling Baseline Invariant**: All daily averages (items/day, orders/day, revenue/day, AOV) must evaluate strictly to whole rounded **integers** (`Math.round`), avoiding fractional decimals.

### 7. AI Assistant Grounding & Copilot Invariants
* **Zero Hallucination Mandate**: The AI copilot (`DEEN Assistant`) must strictly ground all sales numbers, queue counts, delivery statuses, and baseline comparisons in verified `LiveOpsAnalyticsSlice` facts.
* **Offline Fallback Guarantee**: If external LLM API keys are unconfigured or unavailable, `/api/ai/copilot` must synthesize a complete, grounded executive briefing using deterministic knowledge rules and mathematical slices without failing.

### 8. Everyday Dispatched Orders Ledger & Customer Delivery Rating Engine
* **Order-Wise Ledger Default**: Everyday Dispatched Orders Ledger defaults to Order-Wise (`ledgerViewMode: 'ORDER_WISE'`). Groups multi-item orders into a single consolidated master order row showing the primary item with a multi-item counter badge (`+X more`), item count chip, aggregate order value, and expandable nested line-item breakdown.
* **Pathao Courier Consignment Extraction**: Consignment IDs and tracking codes are extracted from WooCommerce order metadata keys (`ptc_consignment_id`, `_ptc_consignment_id`, `ptc_status`) created by the official Pathao WooCommerce plugin.
* **Dual-Redundant Webhook & Rate-Limit Resilient Tracking**:
  * **Zero-Pressure Rate Limiting**: Bypasses blind 404 queries to Pathao API by strictly filtering order IDs against consignment formats, eliminating API throttling. Orders with active webhook metadata (`ptc_status`) are resolved instantly without external network calls.
  * **Asynchronous Reverse Sync**: Inbound Pathao webhook events to `/api/sync/pathao/webhook` asynchronously write `ptc_consignment_id` and `ptc_status` directly into WooCommerce order meta (`PUT /wp-json/wc/v3/orders/{id}`) without touching WordPress plugin files or stalling the webhook handshake.
  * **Batch WooCommerce Tracking Updates**: Supports bulk synchronization (`POST /wp-json/wc/v3/orders/batch`) in chunks of 100 orders to link offline delivery reports back into WooCommerce.
  * **Strict Consignment-to-Order Isolation (No Phone-Based Consignment Matching)**:
    - Consignment tracking codes and parcel delivery statuses MUST strictly link to orders ONLY via explicit plugin metadata (`ptc_consignment_id`, `_ptc_consignment_id`, `tracking_number`), exact Pathao `merchant_order_id` (or base order ID, e.g. `18914`, `18914 c`, `D-18914`), or WooCommerce order meta `ptc_status`.
    - **FORBIDDEN: Matching consignments by Customer Phone Number**: Customer phone numbers represent the customer's identity across lifetime orders (used strictly for Customer Delivery Rating & Store History Index), NEVER for linking a parcel shipment. Repeat orders in `processing` status that haven't been dispatched must remain `Untracked` with empty consignment ID until dispatched, and must NEVER inherit a previous order's consignment ID or trigger false `DELIVERED_BUT_PROCESSING` discrepancies.
* **Dual-Tier Customer Delivery Rating**:
  * **Tier 1 (Pathao B2B Success API)**: Real-time query to Pathao User Success API (`POST /aladdin/api/v1/user/success`) using normalized Bangladeshi phone numbers (`01XXXXXXXXX`).
  * **Tier 2 (Empirical Fallback & Baseline)**: Grounded store history calculation (`getStoreHistoryIndex`) across all lifetime synced orders.
  * **Rating Classification**:
    - 🌟 **Excellent**: Delivery rate $\ge 90\%$ ($\ge 5$ orders) or $100\%$ ($\ge 2$ orders)
    - 👍 **Good**: Delivery rate $\ge 80\%$ ($\ge 3$ orders)
    - ⚖️ **Moderate**: Delivery rate $60\% - 79\%$
    - ⚠️ **High Risk**: Delivery rate $< 60\%$ ($\ge 2$ orders) or flagged return risk
    - 🌱 **New Buyer**: $\le 1$ total lifetime order without courier history

### 9. Smart Inventory (SIP) & Outlet Allocation Engine
* **WooCommerce SIP Plugin Metadata**: Smart Inventory / Point of Sale metadata is resolved from order-level `_sip_waterfall_deductions` array (`[{"outlet_id":1,"outlet_slug":"warehouse","product_id":...,"variation_id":...}]`), mapping each specific apparel item to its physical inventory origin.
* **4-Tier Waterfall Resolution Order**:
  1. `_sip_waterfall_deductions` exact `variation_id` and `product_id` match.
  2. Line-item level `meta_data` keys (`_sip_outlet_id`, `_outlet_id`, `location_id`).
  3. Order-level branch fallback (`_sip_outlet_id`, cashier ID `_sip_created_by`: Mirpur `3`, Cumilla `35`, Wari `69`, Sylhet `572`, or courier dispatch suffixes `c`, `w`, `s`, `m`).
  4. Default: `Central Warehouse` (Online store).
* **Physical Nodes & Visual Badges**:
  - `Central Warehouse` (Code: `ONLINE`, Outlet: `1`, Slug: `warehouse`): Sky badge `🌐 Central Warehouse`.
  - `Mirpur Outlet` (Code: `MIRPUR`, Outlet: `2`, Slug: `mirpur-12`): Purple badge `🏬 Mirpur Outlet`.
  - `Cumilla Branch` (Code: `CUMILLA`, Outlet: `7`, Slug: `cumilla`): Amber badge `🏬 Cumilla Branch`.
  - `Wari Branch` (Code: `WARI`, Outlet: `8`, Slug: `wari`): Teal badge `🏬 Wari Branch`.
  - `Sylhet Branch` (Code: `SYLHET`, Outlet: `9`, Slug: `sylhet`): Indigo badge `🏬 Sylhet Branch`.
  - `Exchange Replacement` (Code: `EXCHANGE`): Violet badge `🔄 Exchange Replacement`.
* **Ledger Visibility**: Rendered in Order-Wise view (`ORDER_WISE`) within the nested line-items breakdown table, in Item-Wise view (`ITEM_WISE`) in a dedicated `SIP Inventory` column, and in the Order Details Telemetry modal. Search filter supports filtering directly by outlet name (e.g. "Cumilla", "Warehouse").
* **Web Checkout Exclusivity**: Any order placed via web checkout (`created_via: "checkout"` or `"store-api"`) is **EXCLUSIVELY an Ecommerce order (`isOrderOnline: true`, `isPos: false`)**, regardless of whether its line-item stock was deducted from a branch outlet inventory via SIP (`_sip_waterfall_deductions` or `_sip_outlet_id`). The SIP inventory source belongs strictly to the line item (`sipInventory`), and NEVER alters the order-level channel to POS/Outlet.
* **Mirpur POS vs Central Warehouse Separation**: Central Warehouse (Outlet `1`, slug: `warehouse`, cashier: `1508`, code: `ONLINE`) and Mirpur Outlet POS (Outlet `2`, slug: `mirpur-12`, cashier: `3`, code: `MIRPUR`) are **two strictly separate, independent inventories in SIP**. Central Warehouse orders (even if historically designated "Warehouse (Mirpur)") are NEVER treated as Mirpur POS retail stock.
* **Export Ledger Grounding**: All Excel and CSV exports ground the `SIP Inventory` column against resolved line-item inventory origins, providing operational transparency for branch inventory transfers and reconciliations.

### 10. Performance Outlook & Category Analytics Bar Chart Sizing Invariants
* **Highest Bar Scaling & Dynamic Height**: The Category & Sub-Category volume bar chart (`LiveVolumeBarChart`) dynamically scales its SVG height and card container based on the highest bar (`maxCategoryVol` / peak item volume), eliminating awkward vertical letterbox whitespace in split desktop layouts.
* **Interactive Size / Height Adjuster**: The chart header features an interactive size control (`Auto`, `Mid`, `Tall`, `Max`, plus `-` / `+` steppers in 30px increments), persisting the user's view preference in `localStorage` (`deen_bar_chart_size_mode`, `deen_bar_chart_custom_height`).
* **Visual Hierarchy & Overhead Labels**: The highest bar is crowned with a prominent indicator (`👑 {units} un`) and top glow. All bars render explicit overhead item counts when idle, seamlessly transitioning to detailed stack tooltips on hover.

### 11. Dual-Mode Authentication & Multi-Branch Staff SSO Engine
* **Dual Login Paradigms**:
  - **Mode A (WooCommerce / WordPress Staff SSO)**: Direct authentication via `https://deencommerce.com/wp-login.php` or `/wp/v2/users/me` with automatic role and outlet resolution (Mirpur Outlet ID 2 / Cashier 3, Cumilla Outlet 7 / Cashier 35, Wari Outlet 8 / Cashier 69, Sylhet Outlet 9 / Cashier 572, Administrator).
  - **Mode B (Master Passcode & Quick PIN Gate)**: Rapid ops floor access using constant-time verified environment secrets (`AUTH_ADMIN_PIN: 2026`, `AUTH_OPS_PIN: 1234`, `AUTH_ADMIN_PASSCODE`, `AUTH_OPS_PASSCODE`).
* **Cryptographic Session Tokens**: Edge-compatible HMAC-SHA256 tokens (`deen_session`) signed via Web Crypto `SubtleCrypto` in Edge Middleware and verified synchronously via Node crypto in API routes.
* **HttpOnly Session Cookies**: Tokens stored in strict `HttpOnly`, `SameSite=Lax`, `Path=/` cookies with 7-day TTL (`604800` seconds).
* **Edge Route Protection (`src/middleware.ts`)**: All UI views (`/`) and internal mutation/data APIs (`/api/*`) strictly require authenticated sessions, redirecting unauthenticated users to `/login?redirect=...` and authenticated sessions away from `/login`. Public endpoints (`/api/auth/*`, `/api/sync/pathao/webhook`, static assets) remain accessible without session.
* **Dual-Redundant API Backward Compatibility**: API endpoints accept both existing `Bearer` tokens (`API_BEARER_TOKEN`, `SYNC_API_TOKEN`) and user session cookies (`deen_session`), ensuring zero disruption to automated cron jobs, webhooks, or test harnesses.


