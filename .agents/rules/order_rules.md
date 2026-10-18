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
* **Retail Branch & Outlet POS Locations (Suffix Codes & Registers)**:
  * **Mirpur Outlet POS**: Physical retail store register / POS outlet (`17263 m` or WooCommerce POS outlet ID `1`). Strictly distinct from the Online Store.
  * When items are fulfilled from retail branch locations, specific suffixes are appended to the courier order ID:
    * `17263 c` (or `17263-c` / `17263c`): Dispatched from **Cumilla Branch** (POS outlet ID `2`)
    * `17263 w` (or `17263-w` / `17263w`): Dispatched from **Wari Branch** (POS outlet ID `9`)
    * `17263 s` (or `17263-s` / `17263s`): Dispatched from **Sylhet Branch** (POS outlet IDs `7` & `8`)
    * `17263 m` (or `17263-m` / `17263m`): Dispatched from **Mirpur Outlet POS** (POS outlet ID `1`)
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


