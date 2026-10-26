# DEEN Commerce — Order Tracking & Reconciliation Business Rules

These authoritative business rules govern order ID parsing, fulfillment branch tracking, status reconciliation, return classification, and exchange matching across DEEN Commerce systems (WooCommerce, Pathao Courier, Excel manifests).

---

## 1. General Order Information
* An order (e.g., base ID `17263`) may contain **multiple line items** (e.g., multiple apparel products, sizes, or quantities).
* Orders are reconciled at both the order level and the individual SKU/line-item level.

---

## 2. Fulfillment Locations & Courier IDs
The Pathao Courier Order ID reflects the physical origin/fulfillment location of the parcel:

* **Online Store (Central Warehouse Hub)**:
  * When items in the online store order are dispatched from the Central Warehouse, the Pathao Courier Order ID remains unchanged without any suffix (e.g., `17263`).
* **Retail Branch Outlet Orders (Two Distinct Operational Categories)**:
  1. **Type 1: POS / Non-Checkout Orders (Offline Retail Walk-In Orders)**:
     * In-store retail walk-in customer sales made at physical branch registers (Mirpur, Cumilla, Wari, Sylhet).
     * Identified by POS plugin metadata (`_sip_outlet_id`: Mirpur `2`, Cumilla `7`, Wari `8`, Sylhet `9`; cashier user IDs `_sip_created_by`: Mirpur `3`, Cumilla `35`, Wari `69`, Sylhet `572`; `created_via: "pos"` or empty, `_sip_order_source: "pos"`).
     * In-store payment: Cash at counter, register POS card swipe terminal, bKash QR code, Nagad QR (`sip_cash`, `sip_bkash`, `sip_city_bank`, `sip_ucb`, `sip_split`).
     * Excluded from online commercial dispatch counts and Excel shipping manifests (`isPos: true`, `isOrderOnline: false`). Tracked strictly on `OutletSalesTab`.
  2. **Type 2: Online Orders Dispatched from Outlets (Branch Courier Dispatches)**:
     * Genuine online ecommerce checkout orders fulfilled from retail branch locations because central warehouse was out of stock.
     * Suffixes appended to courier Order IDs to identify the origin branch:
       * `17263 c`: Dispatched from **Cumilla Branch** (POS outlet ID `7`, cashier `35`)
       * `17263 w`: Dispatched from **Wari Branch** (POS outlet ID `8`, cashier `69`)
       * `17263 s`: Dispatched from **Sylhet Branch** (POS outlet ID `9`, cashier `572`)
       * `17263 m`: Dispatched from **Mirpur Outlet** (POS outlet ID `2`, cashier `3`)
     * **Single Definitive Rule for Ecommerce Orders**: An order is strictly classified as an Ecommerce order (`isOrderOnline: true`, `isPos: false`) if and only if:
       1. It was placed via web checkout (`created_via: "checkout"` or `"store-api"`), OR
       2. It has an explicit ecommerce payment method (`payment_method: "ecom"` or `"sip_ecom"`), OR
       3. It has courier tracking (Pathao consignment ID / shipping lines).
       In-store counter payments (such as bKash QR or Card swipe at outlet registers) are never classified as Ecommerce orders.
     * Tracked on `OutletDispatchTab` (outlet parcel dispatches) and `LiveOpsTab` (commercial dispatches).
* **ID Matching Logic**:
  * To reconcile branch shipments against store orders, extract the numeric base order ID (`17263`) while recording the branch tag (`Online Store`, `Mirpur POS`, `Cumilla`, `Wari`, `Sylhet`).

---

## 3. Order Delivery Statuses & Reconciliation Logic

### A. Delivered
* The entire parcel (or all parcels belonging to the order) is successfully delivered to the customer.
* **Split Multi-Parcel Rule**: If an order has split multi-parcels (e.g., dispatched from multiple branches or multiple consignments), detect the items from the product costs. If **every parcel is delivered**, the entire order is marked as **Delivered**.
* 100% of order merchandise value is recognized as net delivered revenue.

### B. Returned (Full Return / RTO)
* All parcels/items in the order are returned without acceptance by the customer.
* **Paid Return Propagation Rule**:
  * *If at least one parcel in the order is marked as "Paid Return" (or has return COD collected), all returned parcels in that order count as **Paid Returns**.*
  * *Otherwise, they are categorized as **Non-Paid Returns**.*

### C. Partial Delivery & Discrete Integer Units
* Applied when a multi-item order has a mix of statuses (e.g., some items are delivered, some items are returned, or some items are exchanged).
* **Doorstep Price & Delivery Fee Accounting**:
  * The delivered/collected price collected by the courier may include a delivery charge (typically **50 TK** inside Dhaka or **90 TK** outside Dhaka).
  * Deducting the delivery charge gives the net merchandise price of the item(s) that the customer received (kept).
  * The leftover price is the price of the returned items.
* **STRICT INTEGER RULE**:
  * **Returned items quantity CANNOT be a float (e.g. 0.5 is strictly forbidden). It MUST be an integer value (0, 1, 2, ...).**
  * Uses Knapsack / Subset-Sum dynamic programming to partition discrete whole garments into kept versus returned units.

### D. Exchanged
* Denoted by prefixes such as `D-17263` or `DD-17263` on the parcel order ID, or replacement notes (`Exchange for #17839`).
* The prefix indicates an exchange replacement parcel dispatched to the customer for order `17263`.
* Exchange parcel IDs must strip `D-` / `DD-` to link directly back to the original order ID while tagging the order as an exchange.
* **Non-Checkout / No-Checkout Orders Rule**:
  * Orders created without frontend web checkout (`created_via !== 'checkout'`, `created_via: 'admin'`, `created_via: 'manual'`, or tagged as `no-checkout`) are staff-created customer exchange replacements.
  * These orders are **strictly treated as exchanged orders (`isExchange: true`)**.
  * They must **NEVER be counted as new commercial sales** in sales revenue, dispatched items, order counts, or commercial processing/on-hold packing queues (`allOrdersBreakdown`).
  * They are isolated from sales charts and tracked separately under **Exchange Logistics** (`exchangeStats`).

---

## 4. Excel Export Status Columns Specification
The Excel export (`Reconciled Orders` ledger) features two distinct status columns:

1. **Order Delivery Status** (Order-Level):
   * Values: `Delivered`, `Paid Return`, `Not Paid Return`, `Exchange`, `Partial`.
   * **Every item in the same order receives this exact same order-level status value.**

2. **Item Delivery Status** (Item-Level):
   * Reflects the item-wise fulfillment outcome:
     * If order is **Delivered** $\rightarrow$ item gets `Delivered`.
     * If order is **Paid Return** or **Not Paid Return** $\rightarrow$ item gets `Returned`.
     * If order is **Partial** $\rightarrow$ kept items get `Delivered`, while returned items get `Returned`.
     * If order is **Exchange** $\rightarrow$ item gets `Exchange`.

3. **POS & Non-Checkout Isolation in Excel Exports**:
   * **Commercial Sheet (`Shipped Orders (Online)`)**: Strictly contains genuine online ecommerce checkout orders. Physical POS outlet orders (`isOrderOnline === false`) and manual non-checkout exchange replacements (`isOrderExchange === true`) are strictly excluded.
   * **Exchanges Sheet (`Exchanges & Non-Checkout`)**: Replacement parcels and non-checkout orders are isolated on a dedicated secondary sheet with zero recognized commercial revenue.

---

## 5. Live Operations Order Pipeline Rules

### A. Today's Shipped Orders
* An order is classified as Shipped on target date $D$ if its status is `completed`, `shipped`, or `delivered`, AND its status modification timestamp (`Date Modified` / `dateModified`) matches date $D$.
* If `Date Modified` is unavailable, fallback to `Order Date`.

### B. Warehouse Fulfillment Queue
* Defined as the active fulfillment backlog: all orders currently in `processing` OR `hold` / `on-hold` status.
* Excludes completed, cancelled, or refunded orders.

### C. Today's Active Orders
* Defined as Today's Shipped Orders + all orders placed today with `processing` status awaiting packing.

### D. 7-Day Rolling Daily Baseline
* Rolling 7-day average metrics (items/day, orders/day, revenue/day, AOV) must always be rounded to whole integers:
  $$\text{DailyAvg} = \mathrm{round}\left(\frac{\sum_{i=1}^7 \text{Metric}_i}{7}\right)$$

---

## 6. Everyday Dispatched Orders Ledger & Order-Wise Consolidation

### A. Default View Mode Invariant
* The Everyday Dispatched Orders Ledger defaults to **Order-Wise** (`ORDER_WISE`) view mode.
* In Order-Wise mode, multiple line items sharing the identical base order ID (e.g. `17263`) are collapsed into a single master order row.
* A mode toggle allows switching between:
  * **Order-Wise (`ORDER_WISE`)**: Consolidated view with basket chips and expandable item breakdowns.
  * **Line Item (`ITEM_WISE`)**: Granular row-per-SKU audit view.

### B. Master Order Row Representation
* Displays the primary/first item's SKU and product title.
* If the order contains multiple items ($N > 1$), an interactive badge `+X more` (where $X = N - 1$) is appended.
* Total item count is clearly displayed via a numeric badge chip (e.g. `3 items`).
* Aggregate order merchandise value reflects the sum of all contained line items ($\sum \text{Item Price} \times \text{Quantity}$).
* Clicking the master row or chevron dynamically expands the nested line items showing individual SKUs, sizes, colors, and prices.

---

## 7. WooCommerce Pathao Plugin Consignment Extraction

### A. Meta Field Extraction Waterfall
* Orders processed via the official WooCommerce Pathao Courier plugin store parcel and consignment identifiers in order metadata.
* Extraction must inspect metadata keys in the following priority:
  1. `ptc_consignment_id`
  2. `_ptc_consignment_id`
  3. `consignment_id` / `_consignment_id`
  4. Freeform extraction from order notes matching regex `Consignment ID:\s*([A-Z0-9]+)`
* Associated courier status is extracted from `ptc_status` or `_ptc_status`.
* Official tracking link is synthesized: `https://merchant.pathao.com/tracking?consignment_id={consignment_id}`.

---

## 8. Customer Delivery Rating & Phone Intelligence Standards

### A. Phone Number Normalization Contract
* Customer phone numbers must be sanitized and normalized to the standard Bangladeshi 11-digit MSISDN format:
  $$\text{Regex: } ^01[3-9]\d{8}$$
* Strips leading international country codes (`+88`, `88`, `0088`), spaces, hyphens, and parentheses.
* Invalid or non-standard phone numbers are safely handled without throwing errors.

### B. Dual-Tier Rating Resolution
1. **Tier 1 — Real-Time Courier Success API**:
   * Evaluated via Pathao User Success API (`POST /aladdin/api/v1/user/success`).
   * Returns lifetime metrics across all Pathao merchants: `total_parcels`, `successful_deliveries`, and calculated delivery percentage.
2. **Tier 2 — Grounded Store History Baseline**:
   * When courier API returns empty/unregistered or during offline execution, calculate empirical baseline from all historical orders associated with the customer phone in the local synced dataset.

### C. Standardized Rating Badges & Thresholds
* **🌟 Excellent** (`bg-emerald-50 text-emerald-700 border-emerald-200`):
  * Delivery rate $\ge 90\%$ with $\ge 5$ total orders, OR $100\%$ with $\ge 2$ total orders.
* **👍 Good** (`bg-teal-50 text-teal-700 border-teal-200`):
  * Delivery rate $\ge 80\%$ with $\ge 3$ total orders.
* **⚖️ Moderate** (`bg-amber-50 text-amber-700 border-amber-200`):
  * Delivery rate between $60\%$ and $79\%$.
* **⚠️ High Risk** (`bg-rose-50 text-rose-700 border-rose-200`):
  * Delivery rate $< 60\%$ with $\ge 2$ orders, or $\ge 3$ return cancellations. Operations must require advance delivery charge payment.
* **🌱 New Buyer** (`bg-slate-100 text-slate-700 border-slate-200`):
  * First-time customer with $\le 1$ order and no courier history.


---

## 9. Smart Inventory (SIP) & Outlet Allocation Engine

### A. WooCommerce SIP Metadata Structure
DEEN Commerce utilizes a Smart Inventory / POS plugin to manage multi-location branch stock. Inventory deductions are persisted in order-level and line-item metadata:
* **Order-Level Deduction Waterfall (`_sip_waterfall_deductions`)**:
  * An array of JSON objects recorded directly on the order:
    ```json
    [
      { "outlet_id": 1, "outlet_slug": "warehouse", "product_id": 17766, "variation_id": 17767, "qty": 1 },
      { "outlet_id": 2, "outlet_slug": "mirpur-12", "product_id": 18705, "variation_id": 18706, "qty": 1 }
    ]
    ```
  * Maps individual items by `variation_id` and `product_id` to their exact deduction location.
  * Allows split-origin orders where Item 1 originates from Central Warehouse and Item 2 originates from a retail branch.

### B. 4-Tier Waterfall Resolution Architecture
When extracting the inventory origin for any line item, the engine resolves in the following strict precedence:
1. **Tier 1 — Waterfall Deductions Array**: Match item `variation_id` (or `product_id`) within `_sip_waterfall_deductions`.
2. **Tier 2 — Line Item Metadata**: Check item `meta_data` for `_sip_outlet_id`, `_outlet_id`, `outlet_id`, `location_id`, `sip_location`.
3. **Tier 3 — Order-Level Branch Fallback**: Inspect order metadata (`_sip_outlet_id`, cashier `_sip_created_by`: Mirpur `3`, Cumilla `35`, Wari `69`, Sylhet `572`) or courier dispatch suffixes (`c`, `w`, `s`, `m`).
4. **Tier 4 — Default Origin**: If no branch indicator exists, assign to **Central Warehouse** (`ONLINE`).

### C. Physical Nodes & Design Token Badges
* **Central Warehouse** (Outlet `1`, Slug `warehouse`, Code `ONLINE`):
  * Sky badge: `bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800` with `🌐` icon.
* **Mirpur Outlet** (Outlet `2`, Slug `mirpur-12`, Code `MIRPUR`):
  * Purple badge: `bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800` with `🏬` icon.
* **Cumilla Branch** (Outlet `7`, Slug `cumilla`, Code `CUMILLA`):
  * Amber badge: `bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800` with `🏬` icon.
* **Wari Branch** (Outlet `8`, Slug `wari`, Code `WARI`):
  * Teal badge: `bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800` with `🏬` icon.
* **Sylhet Branch** (Outlet `9`, Slug `sylhet`, Code `SYLHET`):
  * Indigo badge: `bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800` with `🏬` icon.
* **Exchange Replacement** (Code `EXCHANGE`):
  * Violet badge: `bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800` with `🔄` icon.

### D. Ledger Visibility & Search Filtering
* **Order-Wise View (`ORDER_WISE`)**: Rendered inside the expanded nested line-items breakdown table under the `SIP Inventory` column.
* **Line Items View (`ITEM_WISE`)**: Rendered in a dedicated table column between `Collection` and `Qty`.
* **Telemetry Modal**: Displayed on every order item in the Order Details modal.
* **Omni-Search Support**: The ledger search bar dynamically filters orders matching any SIP inventory name (e.g. "Cumilla", "Warehouse", "Sylhet").
