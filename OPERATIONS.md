# Standard Operating Procedures (SOPs): DEEN Commerce Operations

**Version:** 2.4.0  
**Scope:** Central Warehouse Logistics · Retail Branch Outlets · Finance & Reconciliation  
**Target Roles:** Warehouse Dispatch Leads, Branch Outlet Cashiers, Operations Managers, Reconciliation Auditors  
**Last Updated:** November 2026  

---

## 1. Overview & Operational Mandates

This manual codifies the everyday standard operating procedures required to maintain inventory integrity, courier settlement accuracy, and audit-grade financial reporting across **DEEN Commerce** channels.

---

## 2. SOP-01: Morning Warehouse Packing & Courier Dispatch

- **Time Window:** 09:30 AM – 02:00 PM (Daily)
- **Responsible:** Central Warehouse Dispatch Lead

### Procedure:
1. **Queue Inspection (`LiveOpsTab`)**:
   - Open the **Live Operations Terminal**.
   - Filter by status `processing` and `on-hold`.
   - Inspect today's order count and items in pack queue.
2. **Consignment Creation & Suffix Assignment**:
   - Central Warehouse orders: Print Pathao airway bill with clean numeric order ID (e.g., `17263`).
   - If stock is missing at Central Warehouse and routed to a branch, notify branch cashier to create consignment with appropriate suffix:
     - Mirpur Outlet $\to$ `17263 m`
     - Cumilla Branch $\to$ `17263 c`
     - Wari Branch $\to$ `17263 w`
     - Sylhet Branch $\to$ `17263 s`
3. **Packaging Standard**:
   - Ensure each garment is sealed inside a clean inner poly bag with silica gel.
   - Insert printed invoice detailing individual SKU prices and delivery fee (৳50 ID / ৳90 OD).
   - Seal inside outer security poly bag; adhere Pathao thermal barcode label flat on center.
4. **Courier Handover**:
   - Pathao pickup rider scans airway bills on-site.
   - Dispatch lead verifies count in `LiveOpsTab` under "Today's Orders".
   - Generate one-click WhatsApp/Slack dispatch briefing to executive group.

---

## 3. SOP-02: Evening Return Parcel Intake & Restocking

- **Time Window:** 05:00 PM – 07:30 PM (Daily)
- **Responsible:** Returns & Quality Inspection Specialist

### Procedure:
1. **Courier Return Manifest Verification**:
   - Receive returned parcels from Pathao delivery rider.
   - Cross-check physical parcels against Pathao Return Sheet.
2. **Physical Inspection**:
   - Inspect garment for wear, perfume odor, tears, or missing brand hangtags.
   - **Grade A (Pristine)**: Return to active warehouse stock bin.
   - **Grade B (Defective / Damaged)**: Route to factory rework bin; log damage in `ItemReturnsTab`.
3. **Status Tagging in Reconciliation Engine**:
   - Scan airway bill into search box.
   - If rider collected delivery fee (৳50 or ৳90) at customer door, mark status as **`Paid Return`**.
   - If customer paid ৳0, mark status as **`Return`** (Full RTO).
   - If partial delivery occurred, verify returned items match subset calculated by the **Knapsack DP Solver**.

---

## 4. SOP-03: Size & Color Exchange Handling (`D-` Consignments)

- **Responsible:** Customer Experience (CX) & Fulfillment Support

### Procedure:
1. When customer requests an exchange, support staff confirms return tracking and creates replacement order in WooCommerce.
2. Order Number Format: Must use `D-` prefix followed by original order ID (e.g., `D-17263`) or `DD-` for secondary exchanges.
3. Order Origin: Set `created_via: "admin"` or `"no-checkout"`.
4. Payment Method: Marked as `Exchange Replacement (৳0 Balance)`.
5. Dispatch Tracking: Handled under **`ExchangedOrdersTab`**.

---

## 5. SOP-04: Weekly Courier Settlement & Bank Deposit Reconciliation

- **Frequency:** Every Monday morning
- **Responsible:** Finance Reconciliation Auditor

### Procedure:
1. **Download Pathao Payment Statement**:
   - Log in to Pathao Hermes Merchant Portal.
   - Download weekly disbursement invoice detailing COD collected, delivery fees, and bank disbursement reference.
2. **Reconciliation Audit (`CourierMismatchTab`)**:
   - Open `CourierMismatchTab` in the DEEN Reconciliation Dashboard.
   - Check for discrepancies where Pathao deducted courier charges higher than customer collected fee.
   - Identify any "Delivered" consignments missing from the bank deposit remittance sheet.
3. **Dispute Filing**:
   - Any discrepancy $> \text{৳}150$ must be escalated to the assigned Pathao Key Account Manager (KAM) within 72 hours.

---

## 6. SOP-05: Month-End Financial Closing & Workbook Archival

- **Frequency:** 1st business day of each new month
- **Responsible:** Chief Financial Officer / Head of Operations

### Procedure:
1. Verify all in-transit parcels from previous month have final delivery or return status.
2. Open **`MonthlyStatementsHub`** in the dashboard.
3. Review month-over-month trajectory, net recognized revenue, and return loss metrics.
4. Click **`Export Month-End Net Sales Close Report (.xlsx)`**.
5. Save generated 7-sheet workbook into company Google Drive archive under `Finance/Monthly_Statements/YYYY-MM_DEEN_Reconciliation.xlsx`.
6. Confirm executive sign-off checklist in `AUDIT_REPORT.md`.
