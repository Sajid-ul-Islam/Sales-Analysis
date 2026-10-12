# Antigravity Guidelines: Unbreakable CSS & Styling Rules

These rules govern all styling, layout composition, and CSS architecture for the DEEN Commerce Reconciliation Engine. They are mandatory and must be strictly adhered to across all components and tabs.

---

## 1. Dual-Engine Unbreakable Architecture (Fail-Safe CSS)

To ensure CSS can **NEVER be broken by anything no matter what** (stale dev caches, build transitions, webpack 404s, or client hydration delays):

1. **Layer 1 — Inline Critical Resets & Tokens in `layout.tsx`**:
   - Fundamental variables (`--primary: #EB5A19`, `--brand-navy: #0F172A`), container resets, scrollbar styles, table overflow wrappers, and glow utilities are injected directly in `<head>` via an inline `<style id="critical-unbreakable-css">` tag.
   - The browser has structural and chromatic styles available before any external file request.

2. **Layer 2 — Standalone Tailwind CDN Runtime in `layout.tsx`**:
   - `layout.tsx` loads `https://cdn.tailwindcss.com` along with a synchronized inline theme configuration matching `tailwind.config.ts`.
   - If Next.js dev server ever returns a 404 on `layout.css` (e.g., when a production build alters `.next` while dev server is active), the client-side Tailwind engine instantly parses and renders every single utility class dynamically in the browser.

3. **Layer 3 — Next.js PostCSS Pipeline (`globals.css`)**:
   - Full Tailwind compilation via standard build pipeline.
   - Dual PostCSS configurations (`postcss.config.js` and `postcss.config.mjs`) remain in the project root to satisfy all bundlers (Next.js, Turbopack, Webpack, Tailwind CLI).

4. **Layer 4 — Stale Process Purge in `Launch_Dashboard.bat`**:
   - `Launch_Dashboard.bat` automatically terminates any zombie node processes bound to port 3000 before launching `npm run dev`.

---

## 2. Zero-Break Layout Contracts

### 2.1 Table & Grid Overflow Protection
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

### 2.2 SVG Mini Charts & Meter Dimensions
- **Rule**: All inline SVG charts (such as donut meters and KPI progress circles) MUST specify explicit `width` and `height` attributes (e.g. `width="44" height="44"`) and the `shrink-0` Tailwind class.
- **Reason**: Without explicit width/height attributes, SVG elements under flex layouts can collapse to 0px or expand to viewport width, causing devastating layout shifts and broken rendering.

### 2.3 Flex Child Containment (`min-w-0`)
- **Rule**: Any flex child containing truncated text (`truncate`) or child grids must have `min-w-0`.
- **Reason**: The CSS flexbox specification defaults `min-width` to `auto`, which prevents flex items from shrinking below their content size, causing layout blowouts.

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
