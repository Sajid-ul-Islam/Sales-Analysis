# Product Requirements Document (PRD): DEEN Commerce

## DEEN Commerce — Sales & Return Reconciliation Engine

**Version:** 2.4.0  
**Status:** Approved, Implemented & Operational  
**Owner:** DEEN Commerce Operations, Logistics & Finance Engineering  
**Last Updated:** November 2026 (Multi-Month Statements, Campaign Intelligence & Native White Aesthetics)  

---

## 1. Executive Summary & Vision

**DEEN Commerce** operates a premier omnichannel lifestyle apparel brand in Bangladesh, encompassing a high-volume online e-commerce website ([deencommerce.com](https://deencommerce.com)) alongside physical retail outlet branches across Dhaka (Mirpur, Wari), Cumilla, and Sylhet.

In high-volume apparel commerce, parcel delivery logistics are inherently non-linear. Orders experience split dispatches from multiple regional branches, partial customer acceptances (e.g., trying two sizes or styles and keeping one), full customer returns (RTO), size exchanges (`D-` / `DD-` prefix consignments), and courier COD settlement delays.

The **DEEN Commerce Sales & Return Reconciliation Engine** is an enterprise-grade analytics and reconciliation platform that unifies courier delivery tracking (Pathao Hermes API / Master Delivery Reports) with e-commerce store transactions (WooCommerce REST API / Order exports). By combining automated discrete knapsack dynamic programming with strict accounting rules, the system gives leadership, warehouse dispatchers, and finance teams a transparent, audit-ready net sales truth.

---

## 2. Core Problem Statement

1. **The Partial Order Ambiguity**: Customers frequently order multiple items (e.g., 2 shirts + 1 polo) but keep only a subset. Couriers collect a partial cash amount that includes shipping fees (50 TK inside Dhaka, 90 TK outside Dhaka). Without automated mathematical reconciliation, inventory managers cannot determine which exact SKU was returned or kept.
2. **Multi-Branch & Outlet Conflation**: An order with base ID `17263` might be split into `17263 c` (fulfilled from Cumilla) and `17263 w` (fulfilled from Wari). Historically, central online shipments were confused with Mirpur retail store POS register transactions. The system must maintain a strict boundary between the Online Store (Central Warehouse) and physical branch POS outlets.
3. **Courier Cost & COD Leakage**: Delivery fees, COD surcharges, and return shipping penalties frequently diverge from merchant collections. Reconciling Pathao charged fees against merchant customer collections prevents hidden courier billing leakages.
4. **Fractional Item Inventory Corruption**: Erroneous division of returned amounts into fractional quantities (e.g., 0.5 shirts) corrupts warehouse ERP inventory sync. Returned item counts must strictly remain whole integers.
5. **Customer RTO Vulnerability**: High-return repeat buyers inflict heavy sunk costs on forward and return logistics. Identifying chronic returners (>50% RTO) protects cash flow.

---

## 3. Target User Personas

| Persona | Key Responsibilities | Primary Dashboard Focus |
|---|---|---|
| **C-Level Executive / Founder** | High-level business performance, net cash margin, return losses, contribution margin | Executive Overview, KPI Overview, Monthly Statements Hub, Campaign Intelligence |
| **Logistics & Warehouse Manager** | Parcel dispatches, courier consignment tracking, branch splits, Courier Mismatches | Live Ops Terminal, Outlet Dispatch Hub, Courier Mismatch, Item Returns |
| **Retail Branch Operations Lead** | In-store POS transactions, branch courier dispatches, outlet performance | Outlet Dispatch, Outlet Sales Tab (POS vs Web) |
| **Finance & Reconciliation Auditor** | COD recovery, Pathao fee audits, return loss accounting, export generation | Unit Economics, Courier Mismatch, Orders Ledger, Excel Export |
| **Marketing & Growth Lead** | Ad spend attribution, blended customer acquisition cost, delivered ROAS | Campaign Intelligence Tab, SKU Performance Leaderboard |

---

## 4. Key Functional Modules & Requirements

The dashboard features **16 dedicated operational modules**:

### 4.1 Executive Overview & KPI Metrics
- **Real-Time KPI Cards**:
  1. **Gross Dispatched Value**: Total order value shipped across all channels.
  2. **Net Reconciled Revenue**: Actual recognized revenue from delivered units and accepted partial items.
  3. **Return Value Loss**: Monetary cost of returned merchandise (paid and non-paid).
  4. **Delivery Retention Rate (%)**: Percentage of dispatched parcels successfully kept by customers.
  5. **Exchange Volume & Cost Recovery**: Parcels routed through size exchanges and Pathao charged fees vs customer collection.
  6. **Pathao Courier Costs & Margin Recovery**: Direct courier charges audited against customer delivery fees collected.
  7. **Packaging & Operations Loss**: Packaging material sunk cost (fixed ৳25 per return/partial).
- **Expandable Mini Donut Visuals**: Clean visual percentage indicators with immutable width/height constraints (`44x44` / `48x48`) to guarantee unbreakable browser scaling.

### 4.2 Live Operations Terminal
- Real-time warehouse fulfillment stream synced directly with WooCommerce REST API and Pathao Hermes Courier API.
- Status modification tracking (`Date Modified`), pack queue (`processing` + `on-hold`), today's orders, and 7-day rolling history with date picker.
- One-click WhatsApp/Slack executive dispatch briefing generator.

### 4.3 Status Matrix & Disposition Tracking
- Categorizes all line items into discrete delivery outcomes:
  - `Delivered`: Consignment delivered in full to customer.
  - `Paid Return`: Customer returned parcel, but delivery fee or return fee was collected via COD.
  - `Return`: Customer rejected parcel; zero cash collected.
  - `Partial`: Multi-item orders where customer accepted a subset and returned the rest.
  - `Exchanged`: Handled as return-and-replace consignment.
  - `In-Transit`: Currently with courier rider.

### 4.4 SKU Performance Leaderboard
- Granular line-item sales metrics by garment category (Polo Shirts, Oxford Shirts, Outerwear, Trousers, Panjabi).
- Delivery retention rate, net sales volume, return rate, and gross revenue per SKU.

### 4.5 Item Returns & Damage Analysis
- Detailed breakdown of returned merchandise by SKU, size, and reason.
- Isolation of pristine restockable goods (Grade A) from damaged/soiled goods (Grade B).

### 4.6 Courier Mismatch & COD Settlement Auditor
- Pinpoints every consignment where Pathao collected cash diverges from calculated net sales.
- Flags delivery fee overcharges where courier fee exceeds customer collected fee.

### 4.7 Territory & Regional Breakdown
- Visual performance analytics comparing **Inside Dhaka** (ID, ৳50 fee) vs **Outside Dhaka** (OD, ৳90 fee).
- Regional delivery retention rates, transit turnaround times, and courier leakage rates.

### 4.8 Customer Risk & Delivery Fraud Scoring
- Phone-number delivery success rate and fraud risk scoring querying Pathao Hermes network API (`/aladdin/api/v1/user/success`).
- Renders color-coded rating badges: 🌟 Excellent, 👍 Good, ⚖️ Moderate, ⚠️ High Risk, 🌱 New Buyer.

### 4.9 Unit Economics & Contribution Margins
- Per-order profitability analysis factoring COGS, shipping subsidies, packaging costs (৳25), COD charges (1%), and payment gateway fees.

### 4.10 Exchanged Orders Hub (`D-` / `DD-`)
- Dedicated hub tracking post-sale size/item exchange replacements (`created_via: "admin"` / `"no-checkout"`).
- Strict isolation from new commercial sales to prevent double-counting revenue.

### 4.11 Master Orders Ledger
- Searchable, filterable ledger with dual-mode view:
  - **Order-Wise (Default)**: Aggregated rows with multi-item basket counters (`+X more`) and expandable drawers.
  - **Line Items (Item-Wise)**: Granular item-by-item inspection.

### 4.12 Outlet Dispatch Hub
- Central tracking of courier dispatches across:
  - Central E-Commerce Warehouse (Base ID)
  - Mirpur Outlet (`m`)
  - Cumilla Branch (`c`)
  - Wari Branch (`w`)
  - Sylhet Branch (`s`)

### 4.13 Outlet Sales Hub (WooCommerce Live vs POS)
- Segregated sales dashboard comparing Online Store website orders against in-store physical retail POS walk-ins (`_sip_outlet_id`).

### 4.14 Monthly Statements Hub
- Consolidated closing statements for September 2026, October 2026, and November 2026 (MTD).
- Automated month-over-month trajectory, net recognized revenue, and return loss metrics.

### 4.15 Campaign Intelligence Tab
- Attribution modeling for Meta Ads, Google Ads, and SMS marketing campaigns.
- Real-time calculation of Delivered ROAS (attributing revenue only to delivered orders, discounting RTOs) and Blended CAC.

### 4.16 Settings & Custom Themes Manager
- Appearance customizer featuring **Native Super White** (`#FFFFFF`) default canvas with dynamic CSS variables.
- One-click theme presets: Modern Slate, Cool Metallic Zinc, Warm Paper Ivory, Deep Midnight Canvas.
- Authenticated operator profile card, API credentials management, and JSON settings backup/restore.

---

## 5. Non-Functional Requirements

1. **Performance**: In-memory AlaSQL queries and React rendering must execute in under 16ms (60 FPS) across 20,000+ line items.
2. **Reliability & Offline Mode**: If external APIs fail, the dashboard gracefully loads cached IndexedDB data and baseline fallbacks (`/api/sample-data`).
3. **Unbreakable Layout**: Must conform to the 10 Golden UX Rules in `DESIGN.md`.
4. **Excel Export Fidelity**: Generated `.xlsx` workbooks must open cleanly in Microsoft Excel, Google Sheets, and LibreOffice with auto-fitted column widths and valid formulas.
