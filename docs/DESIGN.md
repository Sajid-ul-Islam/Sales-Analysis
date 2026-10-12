# Design System & CSS Architecture Document (DESIGN.md)
## DEEN Commerce — Sales & Return Reconciliation Engine

**Version:** 2.2.0  
**Design Theme:** Pristine Enterprise Light Theme with Vibrant Omni-Channel Accents  
**Typography:** Plus Jakarta Sans & Inter  
**Last Updated:** October 2026  

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
  5. Exchanges Sheet (`Exchanged.xlsx`)

---

## 5. Unbreakable CSS Rules & Fail-Safe Patterns

To prevent broken or unstyled CSS rendering:

1. **Dual PostCSS Files**:
   - `postcss.config.js` (CommonJS module export)
   - `postcss.config.mjs` (ESM default export)
   - This ensures build stability across Next.js webpack, standalone scripts, and Tailwind CLI.
2. **Explicit CSS Root Tokens in `globals.css`**:
   - Fundamental variables (`--primary`, `--brand-navy`, `--background`) are declared in vanilla CSS `:root`.
   - Structural fallbacks ensure elements never lose basic color definition even if utility classes lag.
3. **Flex Child Protection (`min-w-0`)**:
   - All flexbox children holding text or tables include `min-w-0` to prevent flex items from overflowing past container boundaries.
4. **Scrollbar Design**:
   - Lightweight custom scrollbars (`6px` width, `#f1f5f9` track, `#cbd5e1` thumb, `#EB5A19` on hover).
