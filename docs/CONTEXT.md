# Business Domain & Organizational Context: DEEN Commerce

**Version:** 2.4.0  
**Domain:** Omnichannel Apparel E-Commerce & Retail Logistics in Bangladesh  
**Target Market:** Bangladesh National Apparel & Lifestyle Market  
**Last Updated:** November 2026  

---

## 1. Company Background & Brand Identity

**DEEN Commerce** ([deencommerce.com](https://deencommerce.com)) is a premier Bangladeshi contemporary apparel and lifestyle brand specializing in premium menswear, including:
- Heavyweight Pique & Compact Cotton Polo Shirts
- Classic Oxford & Formal Button-Down Shirts
- Winter Outerwear: Quilted & Puffer Jackets, Hoodies, and Sweatshirts
- Premium Denim & Casual Trousers
- Traditional Festive Panjabi & Kurta Collections

The brand operates a fast-growing hybrid omnichannel model combining high-volume direct-to-consumer (D2C) web commerce with a physical retail presence across Bangladesh's major commercial hubs.

---

## 2. Omnichannel Network Topology

```
                                  ┌─────────────────────────────┐
                                  │      DEEN COMMERCE HQ       │
                                  │   (Central Executive Team)  │
                                  └──────────────┬──────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        │                                                 │
                        ▼                                                 ▼
        ┌───────────────────────────────┐                 ┌───────────────────────────────┐
        │   CENTRAL ONLINE WAREHOUSE    │                 │   PHYSICAL RETAIL OUTLETS     │
        │   (Central Web Fulfillment)   │                 │   (POS & Split Dispatches)    │
        └───────────────┬───────────────┘                 └───────────────┬───────────────┘
                        │                                                 │
                        │ Standard Ecom Dispatch                          ├── Mirpur Outlet (ID: 2, 'm')
                        │ Consignment: #17263                             ├── Cumilla Branch (ID: 7, 'c')
                        ▼                                                 ├── Wari Branch (ID: 8, 'w')
        ┌───────────────────────────────┐                                 └── Sylhet Branch (ID: 9, 's')
        │     PATHAO COURIER HUB        │                                                 │
        │   (Nationwide 3PL Delivery)   │◄────────────────────────────────────────────────┘
        └───────────────┬───────────────┘                 Regional Split Dispatch
                        │                                 Consignment: #17263 c, w, s, m
                        ▼
        ┌───────────────────────────────┐
        │      END CONSUMER (COD)       │
        └───────────────────────────────┘
```

### 2.1 Retail Branches & POS Identification
1. **Mirpur Outlet (Dhaka)**: Outlet ID `2`, Cashier User ID `3`. Suffix `m`.
2. **Cumilla Branch**: Outlet ID `7`, Cashier User ID `35`. Suffix `c`.
3. **Wari Branch (Dhaka)**: Outlet ID `8`, Cashier User ID `69`. Suffix `w`.
4. **Sylhet Branch**: Outlet ID `9`, Cashier User ID `572`. Suffix `s`.
5. **Central E-Commerce Warehouse**: Default online store dispatch location.

---

## 3. The Bangladesh E-Commerce & Logistics Reality

Operating an apparel e-commerce business in Bangladesh presents unique economic and logistical conditions that necessitate this dedicated reconciliation engine:

### 3.1 Cash on Delivery (COD) Dominance
- Over **90%** of all online apparel orders in Bangladesh are completed via Cash on Delivery (COD).
- Because customers do not pay upfront, the purchase commitment is fluid. Customers may refuse delivery at their doorstep due to change of mind, delayed courier arrival, or sizing concerns.
- Delivery couriers handle all cash collections and remit funds back to the merchant on a 3- to 7-day settlement cycle, minus courier fees, COD collection surcharges (typically 1%), and return penalty fees.

### 3.2 High Return-to-Origin (RTO) Rates
- Nationwide apparel RTO rates in Bangladesh average between **20% and 35%**.
- Sunk costs of an RTO:
  - Forward shipping fee (৳50 Inside Dhaka, ৳90 Outside Dhaka)
  - Return shipping fee (৳25 to ৳45)
  - Packaging depreciation (৳25 per parcel for poly bag, airway bill, and handling)
  - Inventory lockup during transit (4 to 10 days in courier possession)

### 3.3 The "Try & Choose" Partial Delivery Phenomenon
- Customers frequently order multiple sizes or colors (e.g. Medium and Large) to test fit at their doorstep.
- When the courier arrives, the customer opens the package, keeps one item, hands the remaining item back to the delivery rider, and pays partial cash.
- Couriers record this as a single lump-sum COD amount. The **Knapsack DP Solver** in this system is specifically designed to mathematically resolve which exact item was kept and which was returned.

### 3.4 Sizing Exchanges (`D-` and `DD-` Consignments)
- When a customer requests a size exchange after delivery, DEEN support staff manually create a replacement order prefixed with `D-` (e.g., `D-17263`) or `DD-`.
- These orders are categorized as `created_via: "admin"` or `"no-checkout"`.
- Accounting rule: They must be isolated from new commercial revenue to avoid double-counting sales volume.

---

## 4. Operational Ecosystem & Data Integrations

1. **WooCommerce Core**: Manages product SKUs, inventory levels, web checkout sessions, and coupon promotions.
2. **SIP POS Plugin**: Runs on iPads/touch terminals at physical retail registers in Mirpur, Cumilla, Wari, and Sylhet, creating walk-in counter orders.
3. **Pathao Hermes Courier API**: Bangladesh's leading logistics platform. Automated tracking, consignment creation, rider dispatch, and fraud scoring.
4. **AlaSQL Engine**: High-performance client-side in-memory relational database powering real-time cross-filtering, OLAP pivots, and instant aggregations across thousands of rows.
