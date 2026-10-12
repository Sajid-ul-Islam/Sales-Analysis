# Antigravity Workspace Guidelines: Return & Sales Reconciliation

## Business Rules for Order Tracking & Fulfillment

Refer to detailed rules in [.agents/rules/order_rules.md](file:///c:/Users/deenb/OneDrive/Documents/Return%20Analysis/.agents/rules/order_rules.md).

### 1. General Information
* An order (e.g. ID `17263`) may contain multiple items.

### 2. Fulfillment Locations & Courier IDs
* **Warehouse / Mirpur**: Pathao Courier ID remains unchanged (e.g., `17263`).
* **Branch Locations**: Suffixes indicate branch fulfillment:
  * `17263 c`: Items sent from **Cumilla**
  * `17263 w`: Items sent from **Wari**
  * `17263 s`: Items sent from **Sylhet**

### 3. Order Statuses
* **Delivered**: Entire parcel delivered.
  * **Split Multi-Parcel Rule**: If an order has split multi-parcels (e.g. from branches), detect items from product costs; if every parcel is delivered, mark the order as **Delivered**.
* **Returned**: All parcels in the order are returned.
  * **Paid Return Rule**: If at least one parcel is marked as Paid Return, all returned parcels count as paid returns; otherwise non-paid returns.
* **Partial**: Multi-item orders with a mix of statuses (some accepted, some returned, or exchanged).
  * **Price & Delivery Charge Accounting**: The delivered/collected price may include a 50 TK or 90 TK delivery charge; the remainder is the price of received/kept items, and the leftover price is the price of returned items.
  * **Integer Rule**: Returned items quantity **cannot be a float (0.5 is strictly forbidden)**; it must always be an **integer value (1, 2, 3...)**.
* **Exchanged**: Indicated by prefixes such as `D-17263` or `DD-17263`.

### 4. Excel Export Status Columns
* **Order Delivery Status**: Overall order status (`Delivered`, `Paid Return`, `Not Paid Return`, `Exchange`, `Partial`). Every item in the order gets this identical value.
* **Item Delivery Status**: Item-specific status:
  * If order is **Delivered** -> `Delivered`
  * If order is **Paid Return** or **Not Paid Return** -> `Returned`
  * If order is **Partial** -> `Delivered` (kept item) or `Returned` (returned item)
  * If order is **Exchange** -> `Exchange`

