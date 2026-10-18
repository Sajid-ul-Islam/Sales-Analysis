# Antigravity Workspace Guidelines: Return & Sales Reconciliation

## Documentation Architecture
* **Product Requirements Document (PRD)**: [docs/PRD.md](file:///c:/Users/deenb/OneDrive/Documents/Return%20Analysis/docs/PRD.md)
* **Technical Requirements Document (TRD)**: [docs/TRD.md](file:///c:/Users/deenb/OneDrive/Documents/Return%20Analysis/docs/TRD.md)
* **Design System & CSS Architecture**: [docs/DESIGN.md](file:///c:/Users/deenb/OneDrive/Documents/Return%20Analysis/docs/DESIGN.md)
* **Order & Fulfillment Rules**: [.agents/rules/order_rules.md](file:///c:/Users/deenb/OneDrive/Documents/Return%20Analysis/.agents/rules/order_rules.md)
* **Unbreakable CSS & Styling Rules**: [.agents/rules/css_and_styling_rules.md](file:///c:/Users/deenb/OneDrive/Documents/Return%20Analysis/.agents/rules/css_and_styling_rules.md)
* **Reconciliation & Accounting Rules**: [.agents/rules/reconciliation_and_accounting_rules.md](file:///c:/Users/deenb/OneDrive/Documents/Return%20Analysis/.agents/rules/reconciliation_and_accounting_rules.md)
* **API Integration & Data Sync Rules**: [.agents/rules/api_and_data_sync_rules.md](file:///c:/Users/deenb/OneDrive/Documents/Return%20Analysis/.agents/rules/api_and_data_sync_rules.md)

---

## Business Rules for Order Tracking & Fulfillment

Refer to detailed rules in [.agents/rules/order_rules.md](file:///c:/Users/deenb/OneDrive/Documents/Return%20Analysis/.agents/rules/order_rules.md).

### 1. General Information
* An order (e.g. ID `17263`) may contain multiple items.

### 2. Fulfillment Locations & Courier IDs
* **Online Store (Central Warehouse)**: Pathao Courier ID remains unchanged without suffix (e.g., `17263`).
* **Retail Outlet Branches & POS**:
  * **Mirpur Outlet POS**: Physical retail store register / POS outlet (`17263 m` or outlet ID `1`). Strictly distinct from the Online Store.
  * `17263 c`: Items sent from **Cumilla Branch** (POS outlet ID `2`)
  * `17263 w`: Items sent from **Wari Branch** (POS outlet ID `9`)
  * `17263 s`: Items sent from **Sylhet Branch** (POS outlet IDs `7` & `8`)

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

