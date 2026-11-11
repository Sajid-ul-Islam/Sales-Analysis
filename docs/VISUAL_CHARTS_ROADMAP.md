# DEEN Commerce: Visual Graphs & Charts Roadmap (v2.5.0)

**Target Environment:** Next.js 14.2 App Router · TypeScript 5.6 · Tailwind CSS 3.4 · Pure SVG + React  
**Architecture:** Zero external charting dependencies (no D3 / Chart.js bloat). 100% Native Pure React SVG components with Tailwind CSS tokens, theme harmony (super white `#FFFFFF` light mode and `#0A0A0A` dark mode), full responsiveness, and clamped SVGs.

---

## Master Implementation Checklist

### Phase 1: 5-Channel Omnichannel Visual Suite (`ChannelComparisonTab.tsx`)
- [x] **1.1** Create `src/components/charts/ChannelComparisonBarChart.tsx`:
  - 5-Channel grouped column/bar chart comparing **Online E-Commerce**, **Mirpur Outlet**, **Cumilla Branch**, **Wari Branch**, and **Sylhet Branch**.
  - Dual metrics: **Gross Sales (৳)** vs **COGS (৳)** vs **Gross Profit (৳)**.
  - Gross Margin % badge per channel (e.g. Mirpur 60.5%, Online 55.4%).
  - Interactive tooltip showing Net Sales, COGS, Profit, and Margin %.
- [x] **1.2** Create `src/components/charts/ChannelContributionDonutChart.tsx`:
  - Visual donut chart showing **Net Revenue Share** (Ecom 55.6% vs Outlets 44.4%) and **Units Sold Share** (1,840 units).
  - Center metric, color-coded branch slices, responsive legend.
- [x] **1.3** Create `src/components/charts/ChannelCategoryStackedBarChart.tsx`:
  - Visual stacked horizontal bar chart showing category distribution (Jeans, Cargo, Twill Chino, Shirts, Polos) per channel.
- [x] **1.4** Wire charts into `src/components/tabs/ChannelComparisonTab.tsx`:
  - Add view toggle: `Visual Graphs & Analytics` vs `Detailed KPI Tables`.
  - Export new charts from `src/components/charts/index.ts`.

---

### Phase 2: Product & SKU Visual Intelligence Suite (`ProductAnalysisTab.tsx`)
- [x] **2.1** Create `src/components/charts/TopProductsLeaderboardChart.tsx`:
  - Top 10 Revenue & Volume Generating Master SKUs horizontal bar chart.
  - Interactive bars with delivered revenue, units sold, and return loss indicators.
- [x] **2.2** Create `src/components/charts/ProductRiskQuadrantChart.tsx`:
  - 4-Quadrant visual matrix (Volume vs Return Rate):
    - **Quadrant 1 (Stars)**: High Volume / Low Return (< 20%)
    - **Quadrant 2 (Sizing / Quality Alert)**: High Volume / High Return (> 35%)
    - **Quadrant 3 (Niche Retainers)**: Low Volume / Low Return (< 15%)
    - **Quadrant 4 (Discontinue / Clearance)**: Low Volume / High Return (> 40%)
  - Interactive hover tooltips showing SKU, Category, Delivered Qty, Return Rate %, and Revenue.
- [x] **2.3** Create `src/components/charts/SizeRunHistogramChart.tsx`:
  - Waist sizes (28, 30, 32, 34, 36, 38) and Top sizes (S, M, L, XL, XXL) distribution curve.
  - Shows production velocity vs return concentration per size.
- [x] **2.4** Wire charts into `src/components/tabs/ProductAnalysisTab.tsx` and export from `src/components/charts/index.ts`.

---

### Phase 3: Returns, RTO & Financial Leakage Diagnostics (`ItemReturnsTab.tsx` & `ExecutiveOverviewTab.tsx`)
- [x] **3.1** Create `src/components/charts/FinancialLeakageWaterfallChart.tsx`:
  - Cash realization waterfall:
    - `Gross Dispatched Value` (+)
    - `Full Return Losses` (-)
    - `Partial Acceptance Loss` (-)
    - `Courier Return Penalties` (-)
    - `Packaging Sunk Costs (৳25/parcel)` (-)
    - `Net Cash Realized` (=)
- [x] **3.2** Create `src/components/charts/ReturnReasonParetoChart.tsx`:
  - Pareto chart: Return reasons by volume (Size mismatch, Fabric dislike, Delay, Customer cancel) with 80/20 cumulative line.
- [x] **3.3** Wire waterfall and Pareto charts into `src/components/tabs/ItemReturnsTab.tsx` and `src/components/tabs/ExecutiveOverviewTab.tsx`.

---

### Phase 4: Customer Risk & Courier Settlement Analytics (`CustomerRiskTab.tsx` & `CourierMismatchTab.tsx`)
- [x] **4.1** Create `src/components/charts/CustomerRiskTierChart.tsx`:
  - Risk tier donut: Safe (<10% RTO), Moderate (10–30%), High Risk (>30%), Serial Returner (>60%).
  - Wire into `src/components/tabs/CustomerRiskTab.tsx`.
- [x] **4.2** Create `src/components/charts/SettlementAgingCurveChart.tsx`:
  - Pathao COD settlement timeline distribution (0-3d, 4-7d, 8-14d, 15d+).
  - Wire into `src/components/tabs/CourierMismatchTab.tsx`.

---

### Phase 5: Verification, Tests & Documentation
- [x] **5.1** Create unit tests in `tests/charts/visualCharts.test.ts` verifying all chart math, SVG calculations, and props.
- [x] **5.2** Run `npx tsc --noEmit` to ensure 0 TypeScript errors.
- [x] **5.3** Run `npm test` to verify all test suites pass.
- [x] **5.4** Run `npx next build` to guarantee production build integrity.
- [x] **5.5** Update `docs/TODO.md` and `docs/CHANGELOG.md` with release notes for v2.5.0.
