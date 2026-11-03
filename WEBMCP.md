# Web Model Context Protocol (WebMCP) Specification: DEEN Commerce

**Version:** 2.4.0  
**Protocol:** Model Context Protocol (MCP) over HTTP/SSE & In-Browser PostMessage  
**Architecture:** Autonomous Agent Gateway for E-Commerce Reconciliation  
**Last Updated:** November 2026  

---

## 1. Protocol Mission & Scope

The **DEEN Commerce WebMCP Gateway** exposes standardized agentic tools, resources, and prompt templates to AI agents, IDE assistants, and external automated workers, allowing them to inspect, audit, and operate the reconciliation engine without bypassing business or accounting constraints.

```
┌─────────────────────────────────┐
│     AI Agent / IDE Assistant    │
└────────────────┬────────────────┘
                 │ WebMCP JSON-RPC 2.0 (Tools & Resources)
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DEEN WEBMCP SERVER GATEWAY                     │
│               (/api/mcp or in-browser window.postMessage)       │
├────────────────────────────────┬────────────────────────────────┤
│           RESOURCES            │             TOOLS              │
│  • orders://live               │  • query_reconciled_orders     │
│  • metrics://kpi_summary       │  • run_knapsack_reconciliation │
│  • statements://month/{month}  │  • evaluate_customer_phone     │
│  • theme://current             │  • trigger_excel_export        │
│                                │  • set_theme_background        │
└────────────────────────────────┴────────────────────────────────┘
```

---

## 2. Exposed Agentic Resources

Agents can read live and historical datasets through URI-based resource templates:

### 2.1 `orders://live`
- **MIME Type:** `application/json`
- **Description:** Returns the active live warehouse fulfillment stream (processing queue, today's dispatches, in-transit parcels).

### 2.2 `metrics://kpi_summary`
- **MIME Type:** `application/json`
- **Description:** Returns the active KPI overview snapshot: gross dispatched value, net recognized sales, delivery retention rate, courier leakage, and packaging losses.

### 2.3 `statements://month/{month}`
- **URI Template:** `statements://month/{YYYY-MM}` (e.g. `statements://month/2026-10`)
- **Description:** Returns the authoritative closed-month reconciliation summary and audit scorecard.

---

## 3. Exposed Agentic Tools

### 3.1 `query_reconciled_orders`
Executes safe, parameterized AlaSQL queries against the client browser's in-memory relational table.
- **Input Parameters:**
  ```json
  {
    "sql": "SELECT category, SUM(unitPrice * deliveredQty) as net_sales, COUNT(*) as units FROM lineItems GROUP BY category ORDER BY net_sales DESC",
    "limit": 50
  }
  ```
- **Returns:** Formatted array of row objects.

---

### 3.2 `run_knapsack_reconciliation`
Runs the deterministic subset-sum 0/1 knapsack algorithm on a disputed or partial delivery order.
- **Input Parameters:**
  ```json
  {
    "order_id": 18924,
    "collected_cod_cash": 1450,
    "shipping_zone": "inside_dhaka"
  }
  ```
- **Returns:** Delivered line items, returned line items, and integer compliance verification.

---

### 3.3 `evaluate_customer_phone`
Queries Pathao Hermes delivery intelligence to classify customer RTO fraud risk.
- **Input Parameters:**
  ```json
  {
    "phone": "01711000000"
  }
  ```
- **Returns:** Delivery success rate, total orders, failed count, and rating badge (🌟 Excellent, ⚠️ High Risk, etc.).

---

### 3.4 `trigger_excel_export`
Generates the master 7-sheet closing workbook (`.xlsx`) via SheetJS and returns a direct download URL.
- **Input Parameters:**
  ```json
  {
    "month": "2026-10",
    "include_audit_trail": true
  }
  ```

---

### 3.5 `set_theme_background`
Dynamically adjusts the canvas background and CSS variables.
- **Input Parameters:**
  ```json
  {
    "background_id": "super-white"
  }
  ```
- **Valid Values:** `super-white`, `slate-subtle`, `zinc-cool`, `cream-warm`, `dark-canvas`.

---

## 4. Security, Rate Limits & Guardrails

1. **Read-Only Safeguards**: WebMCP tools cannot delete historical orders or bypass the integer quantity knapsack constraint.
2. **Rate Limiting**: External MCP calls are restricted to 120 queries/minute per API session.
3. **Execution Timeouts**: AlaSQL queries exceeding 2,000ms are aborted to prevent UI thread starvation.
