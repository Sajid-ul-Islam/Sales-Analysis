# Living Engineering Roadmap & Backlog: DEEN Commerce

**Version:** 2.4.2  
**Status:** Active Sprint & Product Backlog  
**Last Updated:** November 2026  

---

## 1. Completed Milestones

### v2.0.0 – Architectural Modernization
- [x] Full rewrite from legacy Python server to Next.js 14 App Router, React 18, and TypeScript.
- [x] In-memory AlaSQL OLAP relational engine for instant client filtering across 50,000+ line items.
- [x] Initial tab architecture: Executive Overview, Status Matrix, SKU Performance, Territory, Unit Economics.

### v2.1.0 – Unbreakable UX & Design System
- [x] Codified 10 Golden UX Rules in `DESIGN.md`.
- [x] Enforced responsive table wrapper containment (`overflow-x-auto min-w-0 w-full`).
- [x] Clamped SVG icon expansion with explicit sizing utility classes and global CSS resets.
- [x] Multi-sheet 7-page Month-End Close Excel Export (`excelExport.ts`) with auto-fitted columns.

### v2.2.0 – Mathematical Knapsack Engine
- [x] Implemented deterministic 0/1 knapsack dynamic programming algorithm (`src/lib/subsetSum.ts`).
- [x] Strictly enforced integer quantity invariant (zero floating-point items allowed).
- [x] Branch courier suffix hygiene engine (`c` Cumilla, `w` Wari, `s` Sylhet, `m` Mirpur).
- [x] Segregated in-store retail POS walk-ins (`_sip_outlet_id`) completely away from online dispatch lists.

### v2.3.0 – Live Operations Terminal & Courier Fraud Intelligence
- [x] Real-time warehouse fulfillment stream with live status indicators and 7-day rolling baseline.
- [x] One-click WhatsApp/Slack executive dispatch briefing generator.
- [x] Pathao customer delivery success rating and fraud risk scoring (🌟 Excellent, 👍 Good, ⚖️ Moderate, ⚠️ High Risk, 🌱 New Buyer).
- [x] Everyday Dispatched Orders Ledger with Order-Wise basket counters (`+X more`) and Line Items toggle.

### v2.4.0 – Multi-Month Statements, Campaign Intelligence & Native White Aesthetics
- [x] Integrated `MonthlyStatementsHub` consolidating September 2026, October 2026, and November 2026.
- [x] Added `CampaignIntelligenceTab` with Delivered ROAS, Blended CAC, and ad spend attribution.
- [x] Default canvas background set to **Native Super White** (`#FFFFFF`) with zero hydration flash.
- [x] Theme presets selector in `SettingsTab` (Modern Slate, Cool Metallic Zinc, Warm Paper Ivory, Deep Midnight Canvas).
- [x] Google Gemini 2.5 Flash AI copilot integration (`@google/genai` 2.29.1).

### v2.4.1 – Netlify OpenNext Migration & Category Engine Hardening
- [x] Successfully migrated production deployment to **Netlify** (`https://deen-sales.netlify.app/`) with `@netlify/plugin-nextjs` v5 OpenNext runtime.
- [x] Resolved build blockers (`SECRETS_SCAN_ENABLED = "false"`) and activated all 36 environment variables across serverless functions.
- [x] Reclassified Face Masks (`DEEN Breathable Face Mask`) and Leather Belts under **`Accessories`** with dedicated sub-categories (`Mask` & `Belt`).
- [x] Updated WhatsApp/Slack live executive dispatch briefing to report `Ecom + Outlet dispatch: X + Y`.

### v2.4.2 – Pre-Dispatch Predictive RTO Warning & Gemini Risk Predictor
- [x] Surface pre-dispatch predictive RTO warning badge (`⚠️ High Risk`) on Everyday Dispatched Orders ledger.
- [x] Operational Pre-Dispatch Advisory banner inside Order Detail Modal for buyers with low delivery rates (< 50%).
- [x] Interactive Gemini 2.5 Flash + Heuristic RTO evaluation hub with size-bracketing detection and Bengali recommendations.
- [x] Comprehensive test suite in `tests/ai/predictRiskRoute.test.ts`.

### v2.5.0 – Omnichannel Visual Intelligence & Chart Suite
- [x] **5-Channel Commercial Bar Chart**: Grouped bar chart comparing Gross Sales, COGS, and Gross Profit across Online E-Com, Mirpur, Cumilla, Wari, and Sylhet.
- [x] **Omnichannel Market Share Donut**: Net Revenue share (Ecom 55.6% vs Outlets 44.4%) and Volume units share.
- [x] **Channel Category Stacked Bar Chart**: Distribution of top apparel categories (Jeans, Cargo, Twill Chinos, Shirts, Polos) per channel.
- [x] **Top 10 Products Leaderboard Bar Chart**: Master SKU revenue and units sold leaderboard with RTO badges.
- [x] **Product Portfolio 4-Quadrant Risk Matrix**: Volume vs Return Rate scatter plot (Stars, Sizing Alerts, Niche, Discontinue).
- [x] **Size Run & Fit Return Histogram**: Apparel sizing distribution curve (Waist 28-38 & Tops S-XXL) highlighting fit defects.
- [x] **Financial Cash Realization Waterfall**: Step-by-step cash flow erosion from gross dispatch to settled bank cash.
- [x] **Return Reasons 80/20 Pareto Chart**: Return cause distribution with cumulative 80% defect barrier curve.
- [x] **Customer Risk Tier Distribution**: Safe vs Moderate vs High Risk segmentation with loss estimation.
- [x] **Courier Settlement Aging Curve**: Pathao transit duration and discrepancy severity breakdown.
- [x] **Modern Dropdown Calendar Date Range Selector**: Interactive calendar range picker with month/year jump dropdowns and two-way synced inputs.
- [x] **Vitest Test Suite**: Verified in `tests/charts/visualCharts.test.ts` (100% tests passing).

---

## 2. Active Sprint Deliverables (Current Workstream)

- [ ] **Finalize November 2026 Month-to-Date Live Order Intake**: Stream real-time consignments directly from Pathao Hermes webhook listener.
- [ ] **Automated Google Drive Sheet Archival**: Integrate `@vercel/blob` or Google Drive API to auto-archive exported closing workbooks on the 1st of each month.
- [ ] **Operator Permission Granularity**: Expand settings telemetry card to enforce per-outlet branch editing locks.

---

## 3. Short-Term Backlog (Q1 2027)

1. [x] **Pre-Dispatch Predictive RTO Warning Badge** *(Completed in v2.4.2)*:
   - Surfaced machine learning and heuristic fraud score on the warehouse packing screen.
   - Alerts packing team if buyer has $<50\%$ delivery success rate across previous orders with actionable WhatsApp confirmation link.
2. **Steadfast & RedX Courier Multi-Carrier Adapters**:
   - Expand courier reconciliation beyond Pathao to ingest Steadfast and RedX delivery reports into a single unified ledger.
3. **Automated WhatsApp Order Confirmation Flow**:
   - Automatically message customers placing COD orders $> \text{৳}3,000$ to confirm size and delivery address before dispatch.

---

## 4. Long-Term Architectural Vision (Q2–Q4 2027)

1. **Autonomous Closed-Loop Dispute Filing**:
   - System detects courier fee overcharges ($> \text{৳}150$) and automatically files dispute claims via Pathao Partner API.
2. **ERP Auto-Journaling**:
   - Direct integration into QuickBooks / Odoo to push net recognized revenue, courier shipping fees, and return inventory write-offs at month-end close.
3. **PWA Mobile Warehouse Scanner**:
   - Progressive Web App camera barcode scanner for real-time warehouse shelf audits and return intake.
