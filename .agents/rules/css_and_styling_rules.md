# Antigravity Guidelines: Unbreakable CSS & Styling Rules

These rules govern all styling, layout composition, and CSS architecture for the DEEN Commerce Reconciliation Engine. They are mandatory and must be strictly adhered to across all components and tabs.

---

## 1. Zero-Break Layout Contracts

### 1.1 Table & Grid Overflow Protection
- **Rule**: Every data table or ledger must be enclosed within an `overflow-x-auto` wrapper with `w-full` and `min-w-0`.
- **Reason**: High-density order records with multiple SKU lines and customer notes will force horizontal expansion. Unwrapped tables break the entire parent flex container.
- **Implementation**:
  ```tsx
  <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
    <table className="w-full text-left border-collapse text-xs">
      {/* ... */}
    </table>
  </div>
  ```

### 1.2 SVG Mini Charts & Meter Dimensions
- **Rule**: All inline SVG charts (such as donut meters and KPI progress circles) MUST specify explicit `width` and `height` attributes (e.g. `width="44" height="44"`) and the `shrink-0` Tailwind class.
- **Reason**: Without explicit width/height attributes, SVG elements under flex layouts can collapse to 0px or expand to viewport width, causing devastating layout shifts and broken rendering.

### 1.3 Flex Child Containment (`min-w-0`)
- **Rule**: Any flex child containing truncated text (`truncate`) or child grids must have `min-w-0`.
- **Reason**: The CSS flexbox specification defaults `min-width` to `auto`, which prevents flex items from shrinking below their content size, causing layout blowouts.

---

## 2. PostCSS & Build Tool Stability

- **Dual-File Rule**: Both `postcss.config.js` (CommonJS format) and `postcss.config.mjs` (ES Module format) must remain in the project root.
- **Reason**: Next.js build runners, Webpack, Turbopack, and Tailwind CLI resolve PostCSS config files differently based on package context. Having both prevents PostCSS loader resolution failures.
- **Root Tokens in `globals.css`**: Core brand variables (`--primary: #EB5A19`, `--brand-navy: #0F172A`) must always be defined in vanilla CSS `:root` so that fundamental brand aesthetics remain intact even if utility stylesheets experience hydration delays.

---

## 3. Brand Tokens & Semantic Colors

### 3.1 Fulfillment Location Badges
Always use the exact predefined token sets for outlets:
- **Online Store (Central Warehouse)**: `bg-indigo-50 text-indigo-700 border-indigo-200`
- **Mirpur Outlet POS (`m`)**: `bg-purple-50 text-purple-700 border-purple-200`
- **Cumilla Branch (`c`)**: `bg-emerald-50 text-emerald-700 border-emerald-200`
- **Wari Branch (`w`)**: `bg-sky-50 text-sky-700 border-sky-200`
- **Sylhet Branch (`s`)**: `bg-amber-50 text-amber-700 border-amber-200`

### 3.2 Delivery Status Badges
- **Delivered**: `bg-emerald-50 text-emerald-700 border-emerald-200`
- **Paid Return**: `bg-blue-50 text-blue-700 border-blue-200`
- **Not Paid Return**: `bg-rose-50 text-rose-700 border-rose-200`
- **Partial**: `bg-amber-50 text-amber-700 border-amber-200`
- **Exchange**: `bg-purple-50 text-purple-700 border-purple-200`

---

## 4. Typography Rules

- **Headlines & Big Metrics**: Always use `font-headline` (`Plus Jakarta Sans`) with bold/extrabold weights (`font-bold`, `font-extrabold`).
- **Body & Tabular Data**: Always use `font-sans` (`Inter`) with medium/semibold weights (`font-normal`, `font-medium`, `font-semibold`).
- **Order IDs, Consignment Codes & SKUs**: Always use `font-mono` to prevent character width jitter and maintain vertical column alignment.
