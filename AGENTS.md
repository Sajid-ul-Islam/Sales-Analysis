# Antigravity Workspace Guidelines: Return & Sales Reconciliation

## Documentation Architecture
* **Product Requirements Document (PRD)**: [docs/PRD.md](file:///c:/Users/deenb/OneDrive/Documents/Return%20Analysis/docs/PRD.md)
* **Technical Requirements Document (TRD)**: [docs/TRD.md](file:///c:/Users/deenb/OneDrive/Documents/Return%20Analysis/docs/TRD.md)
* **Design System & CSS Architecture**: [docs/DESIGN.md](file:///c:/Users/deenb/OneDrive/Documents/Return%20Analysis/docs/DESIGN.md)
* **Order & Fulfillment Rules**: [.agents/rules/order_rules.md](file:///c:/Users/deenb/OneDrive/Documents/Return%20Analysis/.agents/rules/order_rules.md)
* **Unbreakable CSS & Styling Rules**: [.agents/rules/css_and_styling_rules.md](file:///c:/Users/deenb/OneDrive/Documents/Return%20Analysis/.agents/rules/css_and_styling_rules.md)

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
* **Exchanged**: Indicated by prefixes such as `D-17263` or `DD-17263`.

### 4. Excel Export Status Columns
* **Order Delivery Status**: Overall order status (`Delivered`, `Paid Return`, `Not Paid Return`, `Exchange`, `Partial`). Every item in the order gets this identical value.
* **Item Delivery Status**: Item-specific status:
  * If order is **Delivered** -> `Delivered`
  * If order is **Paid Return** or **Not Paid Return** -> `Returned`
  * If order is **Partial** -> `Delivered` (kept item) or `Returned` (returned item)
  * If order is **Exchange** -> `Exchange`

### 5. Unbreakable CSS & Styling Standards
* Maintain dual PostCSS config (`postcss.config.js` and `postcss.config.mjs`) at all times.
* All data tables must be wrapped in `overflow-x-auto` with `min-w-0` to guarantee zero layout blowout.
* Inline SVG charts must specify explicit `width="44" height="44"` (or `48x48`) and `shrink-0` to prevent SVG viewport distortion.
* Adhere strictly to the semantic color tokens documented in [docs/DESIGN.md](file:///c:/Users/deenb/OneDrive/Documents/Return%20Analysis/docs/DESIGN.md).
