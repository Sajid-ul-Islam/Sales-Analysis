# AI Agent Skills Registry: DEEN Commerce Reconciliation Engine

**Version:** 2.4.0  
**Specification:** Agentic Capability Units & Autonomous Tool Protocol  
**Runtime:** Antigravity / Agentic Tool Ecosystem  
**Last Updated:** November 2026  

---

## 1. Overview & Skill Architecture

The **DEEN Commerce Skills Registry** defines autonomous, modular skills that software agents, background runners, and AI copilot instances can invoke to inspect, reconcile, audit, and export retail operations data.

```
┌────────────────────────────────────────────────────────┐
│                   AGENT SKILL HUB                      │
├────────────────────────────┬───────────────────────────┤
│ reconciliation-analysis    │ Whole-order audit & net   │
│                            │ sales calculation         │
├────────────────────────────┼───────────────────────────┤
│ subset-sum-solver          │ 0/1 Knapsack partial      │
│                            │ order line-item resolver  │
├────────────────────────────┼───────────────────────────┤
│ pathao-rating-evaluator    │ Customer delivery fraud   │
│                            │ risk classifier           │
├────────────────────────────┼───────────────────────────┤
│ excel-export-auditor       │ 7-sheet closing workbook  │
│                            │ generator & validator     │
├────────────────────────────┼───────────────────────────┤
│ theme-customizer           │ Native Super White and    │
│                            │ CSS variable injector     │
├────────────────────────────┼───────────────────────────┤
│ campaign-auditor           │ Delivered ROAS and CAC    │
│                            │ attribution analyzer      │
├────────────────────────────┼───────────────────────────┤
│ ui-ux-audit-and-design     │ 17-point Core UI, UX      │
│                            │ Honeycomb & Laws auditor  │
└────────────────────────────┴───────────────────────────┘
```

---

## 2. Skill Specifications

### 2.1 `reconciliation-analysis`
- **Description:** Analyzes a batch of orders against courier delivery records, segregating POS vs Web, classifying return dispositions, and detecting courier fee leakages.
- **Input Schema:**
  ```json
  {
    "start_date": "2026-11-01",
    "end_date": "2026-11-03",
    "outlet_filter": "all"
  }
  ```
- **Output Contract:**
  ```json
  {
    "gross_dispatched_bdt": 3380000,
    "net_reconciled_bdt": 2444200,
    "retention_rate_pct": 70.3,
    "rto_loss_bdt": 830400,
    "courier_leakage_bdt": 2700
  }
  ```

---

### 2.2 `subset-sum-solver`
- **Description:** Solves 0/1 knapsack dynamic programming problem to determine which specific line items were delivered vs returned from a courier COD cash remittance.
- **Input Schema:**
  ```json
  {
    "order_id": 18924,
    "collected_cod_amount": 1450,
    "delivery_territory": "inside_dhaka",
    "shipping_fee_deduction": 50,
    "line_items": [
      { "id": 1, "sku": "OXF-OLV-L", "price": 1400, "qty": 1 },
      { "id": 2, "sku": "POL-NAV-L", "price": 1310, "qty": 1 }
    ]
  }
  ```
- **Output Contract:**
  ```json
  {
    "status": "Partial",
    "delivered_items": [{ "sku": "OXF-OLV-L", "qty": 1, "value": 1400 }],
    "returned_items": [{ "sku": "POL-NAV-L", "qty": 1, "value": 1310 }],
    "integer_check": true
  }
  ```

---

### 2.3 `pathao-rating-evaluator`
- **Description:** Queries Pathao Hermes Aladdin user success API and calculates empirical customer fraud risk level.
- **Input Schema:**
  ```json
  { "phone": "01711XXXXXX" }
  ```
- **Output Contract:**
  ```json
  {
    "rating_badge": "🌟 Excellent",
    "delivery_success_pct": 94.2,
    "total_historical_orders": 35,
    "failed_orders": 2,
    "risk_level": "LOW"
  }
  ```

---

### 2.4 `excel-export-auditor`
- **Description:** Generates the master 7-sheet Month-End Net Sales Close Report (.xlsx) with auto-fitted column widths and verifies mathematical formulas before download.
- **Input Schema:**
  ```json
  { "month": "2026-10", "include_audit_trail": true }
  ```
- **Output Contract:**
  ```json
  {
    "filename": "DEEN_October_2026_Net_Sales_Closing.xlsx",
    "sheets_generated": 7,
    "total_rows": 2420,
    "file_size_kb": 348
  }
  ```

---

### 2.5 `theme-customizer`
- **Description:** Adjusts root CSS variables and applies canvas background presets.
- **Input Schema:**
  ```json
  { "preset_id": "super-white" }
  ```
- **Output Contract:**
  ```json
  {
    "applied_preset": "Native Super White",
    "bg_surface": "#FFFFFF",
    "border_surface": "#E5E7EB"
  }
  ```

---

### 2.6 `ui-ux-audit-and-design`
- **Skill File:** [`.agents/skills/ui-ux-audit-and-design/SKILL.md`](.agents/skills/ui-ux-audit-and-design/SKILL.md)
- **Rule Reference:** [`.agents/rules/ui_ux_laws_and_principles.md`](.agents/rules/ui_ux_laws_and_principles.md)
- **Description:** Audits and enforces the 5 Core UI Principles, 7 UX Honeycomb traits, and 5 Psychological Laws of UI/UX (Hick's, Fitts's, Jakob's, Miller's, Aesthetic-Usability) across React/Next.js/Tailwind components.
