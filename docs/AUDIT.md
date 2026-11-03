# Reconciliation & Financial Audit Specification: DEEN Commerce

**Version:** 2.4.0  
**Standard:** Enterprise Retail Accounting & Courier Settlement Verification  
**Applies to:** Central Online Store, Mirpur, Cumilla, Wari, and Sylhet Outlets  
**Last Updated:** November 2026  

---

## 1. Audit Mission & Core Mandate

The primary mission of the **DEEN Commerce Audit Specification** is to provide 100% verifiable financial truth by closing the gap between:
1. **Commercial Sales (WooCommerce)**: Dispatched merchandise values, promotions, and customer shipping charges.
2. **Logistical Reality (Pathao Hermes)**: Physical parcel status, multi-branch splits, and return shipments.
3. **Cash Flow & Settlements (COD)**: Actual cash collected by couriers, courier service charges, return penalties, and bank deposits.

---

## 2. Mathematical Audit: Subset-Sum Integer Knapsack Proof

### 2.1 The Problem Formulation
In Bangladeshi apparel commerce, customers frequently order multiple items ($N$ items, where $N \ge 2$) but keep only a subset of them upon courier delivery (e.g., keeping 1 polo and returning 1 shirt). The courier remits a single aggregated cash collection $C_{collected}$.

Without mathematical reconciliation, operations teams cannot determine:
- Which specific line items were delivered (revenue recognized).
- Which specific line items were returned (inventory restocked).

### 2.2 Mathematical Model
Let an order contain line items $L = \{l_1, l_2, \dots, l_k\}$ with discrete integer item prices $P = \{p_1, p_2, \dots, p_k\}$ and quantities $Q = \{q_1, q_2, \dots, q_k\}$, where $p_i, q_i \in \mathbb{Z}^+$.

Let the courier delivery fee collected from the customer be $F_{ship}$, where:
$$F_{ship} = \begin{cases} 50\text{ BDT} & \text{if Delivery Zone is Inside Dhaka} \\ 90\text{ BDT} & \text{if Delivery Zone is Outside Dhaka} \end{cases}$$

The net merchandise cash collected is:
$$V_{net} = C_{collected} - F_{ship}$$

The goal is to find a binary selection vector $\mathbf{x} = [x_1, x_2, \dots, x_k]^T \in \{0, 1\}^k$ representing accepted items such that:
$$\sum_{i=1}^k x_i \cdot p_i = V_{net}$$

Subject to the **Strict Integer Quantity Constraint**:
$$\forall i, \quad q_{delivered, i} = x_i \cdot q_i \in \mathbb{Z}_{\ge 0}$$
$$\forall i, \quad q_{returned, i} = (1 - x_i) \cdot q_i \in \mathbb{Z}_{\ge 0}$$
$$\text{No fractional quantities } (0.5, 1.5, \dots) \text{ are allowed under any circumstances.}$$

If no exact integer combination satisfies $\sum x_i p_i = V_{net}$, the order is flagged as an **Unreconciled Cash Anomaly (Audit Error 422)** requiring manual operator inspection.

---

## 3. Courier COD Leakage & Settlement Audit

### 3.1 Courier Fee Divergence Formula
For every dispatched parcel $j$, the system audits courier service charges ($Fee_{charged}$) against the delivery fee collected from the customer ($Fee_{collected}$):

$$\Delta Fee_j = Fee_{collected, j} - Fee_{charged, j}$$

- If $\Delta Fee_j \ge 0$: Full courier cost recovery.
- If $\Delta Fee_j < 0$: Courier cost leakage (subsidized delivery cost absorbed by merchant margin).

### 3.2 Return Penalty Audit
When a parcel is returned:
- **Non-Paid Return**: Customer paid ৳0. Merchant pays forward delivery fee + return shipping fee penalty (typically 50% of forward fee).
  $$\text{Loss}_{courier} = Fee_{forward} + Fee_{return}$$
- **Paid Return**: Customer paid the shipping charge at door before returning goods.
  $$\text{Loss}_{courier} = (Fee_{forward} + Fee_{return}) - C_{collected}$$

### 3.3 Packaging & Operational Sunk Cost
For every returned parcel or partial delivery:
$$\text{Sunk Cost}_{packaging} = \text{Fixed } 25\text{ BDT}$$
This covers poly bags, security tape, printed thermal airway bills, and return inspection labor.

---

## 4. Month-End Reconciliation & Audit Closing Procedures

Every calendar month (e.g. September 2026, October 2026, November 2026) must pass the following 6-step audit verification:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   MONTH-END CLOSING AUDIT CHECKLIST                    │
├────┬──────────────────────────────────────────────────────────┬────────┤
│ No │ Audit Step                                               │ Status │
├────┼──────────────────────────────────────────────────────────┼────────┤
│ 1  │ Verify Zero Floating-Point Quantities across all rows    │ PASS   │
│ 2  │ Match Total Dispatched Parcels = Delivered + Returned +  │ PASS   │
│    │ Partial + Exchanged + In-Transit                         │        │
│ 3  │ Reconcile Outlet Register Sales (_sip_outlet_id) vs Web  │ PASS   │
│ 4  │ Audit Pathao Remittance Statements vs Bank Bank Credits  │ PASS   │
│ 5  │ Settle Exchange Consignments (D- and DD- prefix orders)  │ PASS   │
│ 6  │ Export 7-Sheet Month-End Closing Workbook (.xlsx)        │ PASS   │
└────┴──────────────────────────────────────────────────────────┴────────┘
```

---

## 5. Discrepancy Classification Taxonomy

All audit discrepancies are assigned one of four severity levels:

| Code | Severity | Description | Action Required |
|---|---|---|---|
| `DISC-01` | **CRITICAL** | COD collected cash does not match any integer combination of line items. | Flag in `CourierMismatchTab`; inspect delivery receipt for manual courier deduction or discount. |
| `DISC-02` | **HIGH** | Consignment marked delivered by Pathao, but customer reports non-receipt (Ghost Delivery). | File courier dispute with Pathao merchant manager within 72 hours. |
| `DISC-03` | **MEDIUM** | Split parcel (`c`, `w`, `s`, `m`) delivered without central warehouse knowledge. | Cross-check branch POS stock transfer journal. |
| `DISC-04` | **LOW** | Address spelling variance between inside/outside Dhaka causing ৳40 fee discrepancy. | Adjust territory mapping in `src/lib/geo.ts`. |
