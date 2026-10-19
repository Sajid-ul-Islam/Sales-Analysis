# Project: DEEN Commerce Reconciliation Dashboard UI/UX Modernization

## Architecture
- **Framework**: Next.js 14+ (App Router), React 18, TypeScript (strict mode).
- **Styling**: Tailwind CSS with fail-safe dual-engine architecture:
  1. Inlined critical CSS tokens & resets in `src/app/layout.tsx`.
  2. Standalone client Tailwind CDN script in `src/app/layout.tsx`.
  3. Precompiled production Tailwind via `postcss.config.js` and `postcss.config.mjs`.
  4. Class-based dark mode (`darkMode: "class"` in `tailwind.config.ts`, `.dark` class on root HTML).
- **Navigation Architecture**:
  - Mobile (< 768px): Sticky bottom navigation bar (`MobileBottomNav.tsx`) for top 4 tabs + drawer trigger; slide-over drawer (`NavigationDrawer.tsx`) for extended 10 tabs with 48px touch targets.
  - Tablet (768px - 1024px): Collapsible icon rail (`w-16` / `w-20`) with floating tooltips and notification badges, reclaiming central real estate.
  - Desktop (>= 1024px): Persistent full sidebar (`w-64`) with brand header, workspace pill, and account footer.
- **Table Container & Sticky Frozen Architecture**:
  - Fail-safe wrapper: `div.overflow-x-auto.min-w-0` on every tabular view preventing horizontal layout blowouts.
  - Sticky primary identifier column: `sticky left-0 bg-inherit z-10` on body cells, `sticky left-0 bg-slate-50 z-20` on header cells, with subtle drop-shadow separation (`shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]`).
  - Native inertial touch swiping and scroll hint gradient cues.
- **Responsive KPI & Chart Architecture**:
  - Harmonized grid: 1-col on mobile (<768px), 2-col on tablet (768px-1024px), 4-6 col on desktop (>=1024px).
  - Strict SVG sizing: `viewBox="0 0 36 36"`, explicit integer `width="44" height="44"`, and `shrink-0`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Mobile Sticky Bottom Nav | Sticky footer navigation bar for fast switching among 4 high-frequency tabs (Overview, Orders, Returns, Sync) + More trigger | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Mobile Slide-Over Drawer | Accessible off-canvas drawer for extended tabs (Settings, Territory, Marketing, Risk, Outlets, etc.) with >=48px touch targets | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Tablet Collapsible Icon Rail | Compact 64-80px vertical icon rail with tooltips, maximizing screen width for tables | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Desktop Persistent Sidebar | Full 256px persistent sidebar with brand header, workspace pill, and active indicators | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Table Zero-Blowout Container | Wrap all tables in `overflow-x-auto min-w-0` to eliminate mobile layout blowouts | M2 | ORIGINAL_REQUEST §R2 |
| 6 | Frozen Primary ID Column | CSS `sticky left-0 bg-inherit z-10` on primary identifier columns across all 5+ tables | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Touch Density & Scroll Hints | Touch-optimized table row padding and visual scroll gradient hints for swipeability | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Auto-Flowing Responsive KPI Grid | Responsive KPI grid: 1-col mobile, 2-col tablet, 4-6 col desktop | M3 | ORIGINAL_REQUEST §R3 |
| 9 | Fluid Responsive SVG Charts | All inline SVGs, donuts, and charts scale fluidly with explicit viewBox, width/height, and shrink-0 | M3 | ORIGINAL_REQUEST §R3 |
| 10 | Class-Based Dark/Light Theming | `darkMode: "class"`, `.dark` tokens in CSS/Tailwind, and accessible theme toggle button in Header | M4 | ORIGINAL_REQUEST §R4 |
| 11 | WCAG AA Touch Targets & A11y | Minimum 44x44px touch targets on buttons/tabs, visible keyboard focus rings | M4 | ORIGINAL_REQUEST §R4 |
| 12 | Dual-Engine Fail-Safe CSS | Inlined critical CSS resets + Tailwind CDN + dual PostCSS config | M4 | AGENTS.md §5 |
| 13 | E2E & Hardening Test Suite | 4-tier requirement-driven test suite verifying layout responsiveness, frozen columns, KPI grids, theming, and regression integrity | M5 | Acceptance Criteria |
| 14 | Live Operations Terminal | Real-time WooCommerce & Pathao Hermes sync, status modification tracking, pack queue, today's orders, 7D baseline | M6 | Live Operations Engine |
| 15 | DEEN Assistant AI Copilot | Autonomous executive assistant grounded in live ops, domain knowledge RAG, BYOK provider switcher, agentic tagging | M7 | AI Copilot Integration |
| 16 | Omnipresent Command Palette | Global `Cmd+K` / `Ctrl+K` modal searching tabs, orders, customers, and SKUs with keyboard navigation | E1 | Overall Experience |
| 17 | Live Sync Notification Center | Floating toast event pipeline and header status indicator for real-time order and courier events | E2 | Overall Experience |
| 18 | Universal Date Range Engine | Global temporal filter across all 12 modules with period comparison math ($\Delta \%$) | E3 | Overall Experience |
| 19 | Table Ergonomics & Density | Selectable table density (Compact / Standard / Relaxed) and column visibility customization | E4 | Overall Experience |
| 20 | Order-Wise Dispatched Ledger | Default consolidated master order rows, multi-item badges (`+X more`), nested breakdowns, and view toggle | M8 | ORIGINAL_REQUEST |
| 21 | Pathao Customer Delivery Rating | Dual-tier phone rating intelligence via Pathao B2B success API & store history fallback | M8 | ORIGINAL_REQUEST |
| 22 | WooCommerce Pathao Plugin Extraction | Auto-harvesting of `ptc_consignment_id`, `_ptc_consignment_id`, and tracking links | M8 | ORIGINAL_REQUEST |
| 23 | Split-Screen Sales Volume Charts | Maximized side-by-side split screen (Donut + Subcategory volume, 7D avg removed) | M8 | ORIGINAL_REQUEST |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Adaptive Multi-Device Navigation | Implement `MobileBottomNav.tsx`, responsive collapsible icon rail in `Sidebar.tsx`, and slide-over drawer with >=48px touch targets | None | COMPLETED |
| M2 | Responsive Tables with Frozen Columns | Implement `overflow-x-auto min-w-0`, `sticky left-0` on primary ID columns, opaque background layering, and scroll hints across all tables | None | COMPLETED |
| M3 | Responsive KPI Cards & Charts | Harmonize KPI overview grid (1-col mobile, 2-col tablet, 4-6 desktop), update typography, and enforce fluid SVG constraints | None | COMPLETED |
| M4 | Design System, Theming & Accessibility | Configure `darkMode: "class"`, add theme toggle in Header, ensure >=44px touch targets across UI, and reinforce fail-safe CSS | M1 | COMPLETED |
| M5 | Final E2E Test Suite & Adversarial Hardening | Comprehensive test coverage for all tiers (T1-T4 + T5 hardening), zero regressions, type-check, lint, build pass | M1, M2, M3, M4 | COMPLETED |
| M6 | Live Operations & Real-Time Sync | WooCommerce REST batch sync, Pathao Hermes live tracking, status modification tracking, pack queue, 7D rolling baseline | None | COMPLETED |
| M7 | AI Assistant Live Ops Integration | Ground DEEN Assistant in real-time orders, courier telemetry, 7D baseline, offline heuristics fallback, agentic tags | M6 | COMPLETED |
| M8 | Order-Wise Ledger & Customer Rating Engine | Default Order-Wise dispatched ledger, expandable nested line items, dual-tier Pathao customer ratings, plugin metadata extraction, and maximized split charts | M6, M7 | COMPLETED |
| E1 | Command Palette (`Cmd + K`) | Universal modal search across tabs, orders, customers, SKUs, and quick actions with keyboard shortcuts | None | IN PROGRESS |
| E2 | Live Sync Notification Center | Floating toast alert pipeline for background sync events (new orders, courier updates, discrepancies) | M6 | PLANNED |
| E3 | Universal Date Range Engine | Header date range bar applying across all 12 modules with period comparison deltas | None | PLANNED |
| E4 | Table Density & Virtualization | Display density switcher (Compact/Standard/Relaxed), column visibility, and high-performance virtual windowing | M2 | PLANNED |

## Interface Contracts

### Navigation Component Contract (`src/components/MobileBottomNav.tsx` & `Sidebar.tsx`)
```typescript
export interface NavigationProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  tabCounts?: Record<string, number>;
  sourceMode?: 'API' | 'UPLOAD';
}

export interface BottomNavTabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
}
```

### Table Responsive Container Contract (`src/components/tabs/*.tsx`)
- Outer container: `<div className="w-full overflow-x-auto min-w-0 rounded-xl border border-slate-200 ...">`
- Header sticky cell: `<th className="sticky left-0 bg-slate-50 z-20 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] min-w-[140px] ...">`
- Body sticky cell: `<td className="sticky left-0 bg-white group-hover:bg-[#FFF7ED] z-10 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] min-w-[140px] ...">`

### KPI Grid Breakpoint Contract (`src/components/KpiOverview.tsx`)
- Container: `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5`
- Metric typography: `text-xl sm:text-2xl xl:text-3xl`
- Micro-donut: explicit `width="44" height="44" viewBox="0 0 36 36" shrink-0`

## Code Layout
- `src/app/layout.tsx`: Root HTML, inlined critical tokens, Tailwind CDN, safe-area viewport meta.
- `src/app/page.tsx`: Main page layout, active tab state, bottom padding for mobile bar (`pb-20 md:pb-6`), layout composition.
- `src/components/Sidebar.tsx`: Multi-device navigation component (Desktop full sidebar, Tablet icon rail, Mobile drawer).
- `src/components/MobileBottomNav.tsx`: Dedicated sticky mobile bottom navigation bar.
- `src/components/Header.tsx`: Header with theme toggle, hamburger trigger, source switcher, user avatar.
- `src/components/KpiOverview.tsx`: Top KPI metric cards and micro-visualizations.
- `src/components/tabs/`: Tabular views (`OrdersLedgerTab.tsx`, `CourierMismatchTab.tsx`, `SkuPerformanceTab.tsx`, `ItemReturnsTab.tsx`, `CustomerRiskTab.tsx`, `ExchangedOrdersTab.tsx`, `ExecutiveOverviewTab.tsx`).
- `src/components/charts/`: Reusable SVG and interactive charts (`InteractiveDonutChart.tsx`, `ComparativeBarChart.tsx`, `BangladeshMapChart.tsx`, `InteractiveAreaTrendChart.tsx`, `FunnelWaterfallChart.tsx`, `PaymentMethodMixCard.tsx`).
- `src/lib/themeManager.ts`: Theme switcher and CSS variable manager.
- `tailwind.config.ts`: Tailwind configuration with `darkMode: "class"`.
- `tests/`: Automated test suite (regression tests + E2E responsive layout tests).
