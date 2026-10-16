# Antigravity Guidelines: Unbreakable CSS & Styling Rules

These rules govern all styling, layout composition, and CSS architecture for the DEEN Commerce Reconciliation Engine. They are mandatory and must be strictly adhered to across all components and tabs.

---

## 1. Zero-CDN Next.js Compiled Architecture & Fail-Safe Resets

To ensure optimal performance, accessibility, and resilience:

1. **Layer 1 — Essential Inlined Critical Resets in `layout.tsx`**:
   - Fundamental variables (`--primary: #EB5A19`, `--primary-dark: #C8430E`, `--brand-navy: #0F172A`), container resets, scrollbar styles, table overflow wrappers, and glow utilities are injected directly in `<head>` via an inline `<style id="critical-unbreakable-css">` tag.
   - An anti-FOUC theme initializer script (`#theme-initializer`) runs before DOM rendering to eliminate theme flicker.

2. **Layer 2 — Self-Hosted Variable Typography (`next/font/google`)**:
   - `Inter` and `Plus_Jakarta_Sans` are downloaded at build time and inlined as CSS variables (`--font-sans` and `--font-headline`).
   - Zero render-blocking Google Font network requests and zero font layout shifts (CLS = 0).

3. **Layer 3 — Next.js PostCSS Pipeline (`globals.css`) & Zero CDN**:
   - Full Tailwind compilation ahead-of-time via PostCSS (`postcss.config.js` and `postcss.config.mjs`).
   - Zero runtime CDN scripts (`cdn.tailwindcss.com` is completely removed), preventing layout shifts and JavaScript execution overhead.

4. **Layer 4 — Hierarchical Layered Dark Surfaces**:
   - Pure `#000000` pitch-black canvas only.
   - Cards, tables, modals, and sidebars utilize layered semantic depth tokens:
     - `deepBlack.canvas` (#000000)
     - `deepBlack.sidebar` (#050505)
     - `deepBlack.card` (#0A0A0A)
     - `deepBlack.elevated` (#121212)
     - `deepBlack.hover` (#171717)
     - `deepBlack.border` (#1F1F1F)
   - Brute-force `!important` selector overrides are strictly prohibited.

5. **Layer 5 — WCAG AA Contrast Standards & Typography Floor**:
   - Small text using brand orange uses `primary-dark` (`#C8430E` / 4.6:1 contrast ratio against white) and `text-orange-400` in dark mode.
   - Minimum 11px font floor across navigation and label chips.
   - Reduced motion guard (`@media (prefers-reduced-motion: reduce)`) guarantees instant transitions for sensitive users.

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
