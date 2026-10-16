# Design System & CSS Architecture Document (DESIGN.md)
## DEEN Commerce — Sales & Return Reconciliation Engine

**Version:** 2.4.0  
**Design Theme:** Pristine Enterprise Light & Class-Based Dark Theme with Omni-Channel Accents  
**Typography:** Plus Jakarta Sans, Inter, JetBrains Mono  
**Last Updated:** October 2026 (Live Ops, Mobile-First & Command Palette Ergonomics)  

---

## 1. Design Philosophy & Aesthetic Principles

The **DEEN Commerce Reconciliation Dashboard** balances high-density data analytics with modern enterprise aesthetics. The design adheres to three core tenets:

1. **Immediate Clarity (The 3-Second Audit)**: Executives and operations leads can instantly identify net reconciled sales, return loss rates, and courier cost recovery without visual clutter.
2. **Distinct Omni-Channel Color Coding**: Every branch outlet, order status, mismatch severity, and customer risk tier is assigned a dedicated semantic color token, ensuring immediate identification across tables, badges, cards, and charts.
3. **Unbreakable CSS Architecture**: Layouts are designed to never break, blow out, or collapse—even under extreme data volumes, narrow viewports, or asynchronous CSS loading.

---

## 2. Design Tokens & Color Palette

### 2.1 Primary & Brand Accent Colors
- **Deen Brand Orange** (`primary`):
  - `primary`: `#EB5A19` (Brand signature)
  - `primary-hover`: `#D4490E`
  - `primary-subtle`: `#FFF7ED` (50 tint)
  - `primary-dark`: `#C8430E`
- **Enterprise Dark Slate** (`navy`):
  - `navy-deep`: `#0F172A` (Sidebar background & executive headers)
  - `navy-surface`: `#1E293B`
  - `navy-border`: `#334155`

### 2.2 Outlet & Branch Specific Tokens
Each fulfillment location carries a consistent semantic badge across all 12 modules:

| Location | Suffix | Color Family | Tailwind Classes | Badge Preview |
|---|---|---|---|---|
| **Online Store (Central Warehouse)** | Base / None | Indigo | `bg-indigo-50 text-indigo-700 border-indigo-200` | Indigo Hub Badge |
| **Mirpur Outlet POS** | `m` | Purple | `bg-purple-50 text-purple-700 border-purple-200` | Purple POS Badge |
| **Cumilla Branch** | `c` | Emerald | `bg-emerald-50 text-emerald-700 border-emerald-200`| Emerald Branch Badge |
| **Wari Branch** | `w` | Sky | `bg-sky-50 text-sky-700 border-sky-200` | Sky Branch Badge |
| **Sylhet Branch** | `s` | Amber | `bg-amber-50 text-amber-700 border-amber-200` | Amber Branch Badge |

### 2.3 Status Disposition Tokens

| Status | Background | Text | Border | Indicator Meaning |
|---|---|---|---|---|
| **Delivered** | `bg-emerald-50` | `text-emerald-700` | `border-emerald-200` | Customer accepted and kept consignment |
| **Paid Return** | `bg-blue-50` | `text-blue-700` | `border-blue-200` | Consignment returned with delivery COD collected |
| **Non-Paid Return** | `bg-rose-50` | `text-rose-700` | `border-rose-200` | Full return with zero collection |
| **Partial Order** | `bg-amber-50` | `text-amber-700` | `border-amber-200` | Split acceptance solved via knapsack solver |
| **Exchange** | `bg-purple-50` | `text-purple-700` | `border-purple-200` | Size swap replacement (D- / DD-) |

### 2.4 Courier Mismatch Severity Tokens

| Severity | Tailwind Classes | Usage Context |
|---|---|---|
| **CRITICAL** | `bg-rose-100 text-rose-800 border-rose-300 font-bold` | Direct cash loss or status conflict |
| **WARNING** | `bg-amber-100 text-amber-800 border-amber-300 font-bold` | COD variation or pending courier sync |
| **MATCH** | `bg-emerald-100 text-emerald-800 border-emerald-300 font-medium` | Exact reconciliation between Pathao and manifest |
| **MISSING** | `bg-slate-100 text-slate-800 border-slate-300 font-medium` | Order missing from courier system |

### 2.5 Customer Risk Tier Tokens

| Risk Tier | RTO Threshold | Tailwind Classes | Operational Action |
|---|---|---|---|
| **HIGH_RISK** | $> 50\%$ | `bg-rose-50 text-rose-700 border-rose-200` | Collect advance shipping fee |
| **MEDIUM** | $20\% - 50\%$ | `bg-amber-50 text-amber-700 border-amber-200` | Mandatory phone confirmation call |
| **LOW** | $< 20\%$ | `bg-emerald-50 text-emerald-700 border-emerald-200` | Automated dispatch processing |

---

## 3. Typography & Hierarchy

The interface combines **Plus Jakarta Sans** for headlines and numeric KPIs with **Inter** for dense transactional tables:

- **Headlines & KPI Totals**: `font-headline` (`Plus Jakarta Sans`, weights: 600, 700, 800)
  - Hero Value: `text-3xl font-extrabold tracking-tight`
  - Card Metric: `text-xl font-bold tracking-tight text-slate-900`
- **Body & Tabular Content**: `font-sans` (`Inter`, weights: 400, 500, 600)
  - Column Headers: `text-[11px] font-bold text-slate-500 uppercase tracking-wider`
  - Table Cell Values: `text-xs text-slate-800`
- **Identifiers & SKUs**: `font-mono` (`ui-monospace`, `SFMono-Regular`, `Menlo`)
  - Order IDs: `text-xs font-mono font-semibold text-slate-900`
  - Suffixes: `text-[10px] font-mono px-1 py-0.5 rounded`

---

## 4. Component Blueprints & Layout Resiliency

### 4.1 KPI Overview Cards & Mini Donuts
- **Immutable Dimensions**: All mini SVG donut meters feature hardcoded `width="44" height="44"` (or `48x48`) along with `shrink-0` to guarantee that browser SVG viewports never collapse or expand during font swaps.
- **Card Glow Utility**:
  - `card-glow-primary`: `box-shadow: 0 0 25px -5px rgba(235, 90, 25, 0.12)`
  - `card-glow-emerald`: `box-shadow: 0 0 25px -5px rgba(16, 185, 129, 0.12)`

### 4.2 Unbreakable Table Architecture
- Every tabular view is enclosed within `.table-container-responsive`:
  ```html
  <div class="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
    <table class="w-full text-left border-collapse text-xs">
      <!-- ... -->
    </table>
  </div>
  ```
- **Sticky Headers**: Sticky headers with `bg-slate-50/90 backdrop-blur-xs z-10` ensure visual context while scrolling large order batches.
- **Zebra Hover Rows**: Table rows utilize `hover:bg-slate-50/80 transition-colors` for crisp scannability.

### 4.3 Multi-Dropzone Drag-and-Drop Ingestion
- Clean dashed dropzones (`border-2 border-dashed border-slate-200 hover:border-primary/60`) with drag-over state feedback (`bg-orange-50/50 border-primary`).
- Dedicated dropzone targets for:
  1. Base Store Orders (`September Online Orders`)
  2. Pathao Delivery Log (`Pathao sample delivery data.csv`)
  3. Returns Report (`returen.xlsx`)
  4. Partial Shipments (`Partial Orders.xlsx`)
### 4.4 Dynamic Live Connection & Telemetry Status Badges
- **Pulsing Indicator Dots**: Real-time heartbeat indicators for background sync connections:
  - `🟢 WooCommerce API Live`: `inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse`
  - `🔵 Pathao Hermes Live`: `inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse`
- **Item Count Chips**: `px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-[#EB5A19] border border-orange-200`
- **Sync Countdown & Freshness Indicator**: Subtle timestamp label formatted as relative time (`"Synced 12s ago"`).

### 4.5 Adaptive Multi-Device Navigation Architecture
- **Mobile (<768px)**: Sticky bottom navigation bar (`MobileBottomNav.tsx`) with 48px minimum touch targets for high-frequency tabs (Overview, Orders, Returns, Sync), plus an accessible off-canvas drawer trigger for extended tabs.
- **Tablet (768px - 1024px)**: Collapsible icon rail (`w-16` / `w-20`) with floating tooltips, maximizing screen width for data-dense tables.
- **Desktop (>=1024px)**: Persistent 256px (`w-64`) sidebar with brand header, workspace status pill, and account actions.

### 4.6 Command Palette (`Cmd + K`) Visual Specs
- **Modal Backdrop**: High-elevation `z-[100]` with `bg-slate-900/60 dark:bg-black/80 backdrop-blur-md` overlay.
- **Palette Container**: Centered floating container (`max-w-2xl w-full mx-auto shadow-2xl rounded-2xl border border-slate-200 dark:border-[#222] bg-white dark:bg-[#0D0D0D]`).
- **Keyboard Shortcut Badges**: Standardized semantic key caps (`<kbd class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-[#1E1E1E] text-slate-500 border border-slate-200 dark:border-[#333]">⌘K</kbd>`).
- **Category Grouping**: Distinct section headers (`TABS`, `ORDERS`, `CUSTOMERS`, `SKUS`, `ACTIONS`) with dedicated icons and active focus highlights (`bg-[#EB5A19]/10 text-[#EB5A19] dark:bg-[#EB5A19]/20`).

### 4.7 Toast & Notification UI Tokens
- **Floating Alert Placement**: Fixed top-right / bottom-right notification stack (`fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none`).
- **Card Styling**: `pointer-events-auto p-3.5 rounded-xl border shadow-lg bg-white dark:bg-[#141414] border-slate-200 dark:border-[#262626] flex items-start gap-3 animate-slideInRight`.
- **Status Accents**:
  - `Success`: Emerald border, emerald icon badge (`bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600`).
  - `Warning / Discrepancy`: Amber border, amber icon badge (`bg-amber-50 dark:bg-amber-950/40 text-amber-600`).
  - `Critical Error`: Rose border, rose icon badge (`bg-rose-50 dark:bg-rose-950/40 text-rose-600`).

---

## 5. Unbreakable CSS Rules & Fail-Safe Patterns

To guarantee that CSS rendering **never breaks under any condition**:

1. **Dual-Engine Fail-Safe Rendering**:
   - **Layer 1 (Inline Critical Resets & CSS Variables)**: Embedded directly into `<head>` inside `<style id="critical-unbreakable-css">` in `src/app/layout.tsx`. Guarantees fundamental box-sizing, typography resets, table overflows, scrollbars, and color variables are active before any external network request finishes.
   - **Layer 2 (Standalone Client-Side Tailwind CDN Engine)**: Injected via `https://cdn.tailwindcss.com` with a synchronized JSON theme in `layout.tsx`. If Next.js dev server ever returns a 404 for `layout.css` due to cache invalidation, the browser dynamically renders all Tailwind utility classes on the fly.
   - **Layer 3 (Compiled Production CSS Bundle)**: Maintained via Next.js standard build and `globals.css`.
   - **Layer 4 (Port Conflict & Zombie Process Protection)**: `Launch_Dashboard.bat` automatically terminates any orphaned processes holding port 3000 before launching `npm run dev`.
2. **Dual PostCSS Configuration**:
   - `postcss.config.js` (CommonJS module export)
   - `postcss.config.mjs` (ESM default export)
   - Guarantees seamless compatibility across Next.js webpack, Turbopack, and Tailwind CLI.
3. **Flex Child Containment (`min-w-0`)**:
   - All flexbox children holding text or tables include `min-w-0` to prevent flex items from overflowing past container boundaries.
4. **Table & Ledger Responsive Protection**:
   - Every tabular component is enclosed within `.table-container-responsive` (`overflow-x: auto`) to prevent viewport blowouts.
5. **Explicit Inline SVG Dimensions**:
   - All SVG charts and meters specify explicit `width="44" height="44"` (or `48x48`) and `shrink-0` classes.
