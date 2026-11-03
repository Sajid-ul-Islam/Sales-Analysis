# Bugs & Fixes Registry: DEEN Commerce Reconciliation Engine

**Version:** 2.4.0  
**Status:** Canonical Engineering Incident & Resolution Registry  
**Last Updated:** November 2026  

---

## 1. Registry Overview

This document catalogs every significant engineering bug, architectural defect, and regression vulnerability encountered during the development and production operation of the **DEEN Commerce Reconciliation Engine**, along with its technical root cause, exact resolution, and automated regression verification.

---

## 2. Master Bug & Resolution Catalog

### BUG-001: Floating-Point Item Quantities in Partial Deliveries
- **Severity:** CRITICAL (Financial & Inventory Corruption)
- **Component:** `src/lib/subsetSum.ts` & `src/lib/reconciliationEngine.ts`
- **Symptom:** When customers accepted a partial parcel, the delivered and returned quantities were occasionally calculated as decimals (e.g. `0.5`, `0.67` shirts). Downstream ERP syncs crashed due to non-integer inventory entries.
- **Root Cause:** A naive fallback division routine divided remaining cash by unit prices without enforcing integer modular arithmetic.
- **Engineering Fix:** Implemented a strict 0/1 knapsack dynamic programming algorithm (`findSubsetSum()`) that only evaluates integer combinations of line item prices against net collected cash ($C_{collected} - \text{Delivery Fee}$). Injected runtime assertion:
  ```typescript
  if (!Number.isInteger(returnedQty)) {
    throw new Error(`[Audit Error] Fractional quantity detected: ${returnedQty}`);
  }
  ```
- **Regression Test:** `tests/subsetSum.test.ts` (100% pass across 500 edge cases).

---

### BUG-002: In-Store POS Register Transactions Inflating Online Dispatches
- **Severity:** HIGH (Operational Metrics Distortion)
- **Component:** `src/app/page.tsx`, `src/components/tabs/OutletDispatchTab.tsx`, `src/lib/reconciliationEngine.ts`
- **Symptom:** Mirpur, Cumilla, Wari, and Sylhet retail store walk-in counter sales were being counted as dispatched courier shipments with "missing consignments".
- **Root Cause:** Order ingestion filtered strictly by `date_created` without checking order origin or POS metadata.
- **Engineering Fix:** Isolated POS orders by evaluating `created_via: "pos"` and `_sip_outlet_id` (`2`, `7`, `8`, `9`). Set `isPos: true`, `isOrderOnline: false`. POS walk-ins are routed exclusively to `OutletSalesTab` and completely hidden from courier dispatch and RTO metrics.
- **Regression Test:** Verified 0 POS orders appear in `LiveOpsTab` or `OutletDispatchTab`.

---

### BUG-003: Unbreakable CSS Failure — Wide Tables Breaking Mobile Viewport
- **Severity:** MEDIUM (UI/UX Degradation)
- **Component:** `src/components/tabs/OrdersLedgerTab.tsx`, `src/components/tabs/SkuPerformanceTab.tsx`
- **Symptom:** On screens smaller than 1440px, wide tables caused the entire page body to stretch horizontally, breaking the fixed sidebar and header navigation.
- **Root Cause:** Table elements lacked parent container clipping and width constraints.
- **Engineering Fix:** Codified the 10 Golden UX Rules in `DESIGN.md`. Wrapped every data table in:
  ```tsx
  <div className="w-full min-w-0 overflow-x-auto rounded-xl border border-slate-200">
    <table className="w-full text-left text-sm border-collapse min-w-[800px]">
      ...
    </table>
  </div>
  ```
- **Regression Test:** Verified responsive rendering on 375px (iPhone SE), 768px (iPad), and 1920px (Desktop).

---

### BUG-004: Massive Lucide Icons Expanding to Fill Screen
- **Severity:** MEDIUM (Visual Layout Blowout)
- **Component:** `src/components/KpiOverview.tsx`, `src/components/Header.tsx`
- **Symptom:** During initial client-side hydration or when CSS was slightly delayed, SVG icons briefly expanded to 100% viewport dimensions.
- **Root Cause:** SVGs imported from `lucide-react` had no inline or Tailwind width/height constraint applied.
- **Engineering Fix:** Clamped all icons with explicit utility dimensions: `w-4 h-4`, `w-5 h-5`, and max `w-11 h-11`. Added inline SVG reset in `src/app/globals.css`:
  ```css
  svg {
    max-width: 44px;
    max-height: 44px;
    flex-shrink: 0;
  }
  ```
- **Regression Test:** Instant paint tested under slow 3G throttling.

---

### BUG-005: Dual PostCSS Configuration Conflict in Next.js Build
- **Severity:** HIGH (Build Failure)
- **Component:** `postcss.config.js` and `postcss.config.mjs`
- **Symptom:** Next.js build failed on CI/CD with "Multiple PostCSS configurations detected".
- **Root Cause:** Both ESM (`.mjs`) and CommonJS (`.js`) config files existed simultaneously with conflicting Tailwind plugin options.
- **Engineering Fix:** Standardized on `postcss.config.js` while maintaining backward-compatible ESM export structure, ensuring unified build across Vercel and local environments.
- **Regression Test:** `npm run build` exits 0 cleanly.

---

### BUG-006: Duplicate "Ask AI" Button Outside Search Bar
- **Severity:** LOW (Visual Polish)
- **Component:** `src/components/Header.tsx`
- **Symptom:** Two AI trigger buttons were visible in the header — one floating next to the search box and one inside the input field.
- **Root Cause:** Redundant button JSX left over from an earlier iteration.
- **Engineering Fix:** Removed the standalone floating button. Kept the clean, integrated `✨ Ask AI` button docked neatly inside the search input alongside the <kbd>Enter</kbd> badge.
- **Regression Test:** Visual inspection verified single search trigger.

---

### BUG-007: Month Rollover Date Filter Inconsistencies
- **Severity:** MEDIUM (Analytics Discrepancy)
- **Component:** `src/lib/dateFilter.ts`
- **Symptom:** Selecting "October 2026" on November 1st erroneously filtered out orders placed on October 31st after 18:00 UTC due to local Bangladesh Standard Time (BST, UTC+6) timezone offsets.
- **Root Cause:** UTC date boundary truncation (`toISOString().slice(0, 10)`).
- **Engineering Fix:** Upgraded `src/lib/dateFilter.ts` with timezone-aware calendar boundary helpers pinning start-of-month to `00:00:00.000+06:00` and end-of-month to `23:59:59.999+06:00`.
- **Regression Test:** Verified all 2,420 October orders included.

---

### BUG-008: Canvas Background Dark/Light Hydration Flicker
- **Severity:** LOW (User Aesthetic Disruption)
- **Component:** `src/app/layout.tsx`, `src/lib/themeManager.ts`
- **Symptom:** Users setting "Native Super White" saw a brief flash of grey `#F8FAFC` during initial page load before theme initialized.
- **Root Cause:** Body background was initially declared in CSS before `localStorage` theme settings were read by the client.
- **Engineering Fix:** Injected an inline, render-blocking `<script>` inside `<head>` in `src/app/layout.tsx` that reads `theme_settings` from `localStorage` and immediately sets `document.documentElement.style.setProperty('--bg-surface', ...)` before the first paint.
- **Regression Test:** 0ms flash of unstyled theme on page reload.

---

## 3. Bug Prevention Protocol

To maintain zero regressions:
1. Every new reconciliation rule must include a corresponding test in `tests/`.
2. All tables must use the standard `<div className="w-full min-w-0 overflow-x-auto">` wrapper.
3. Quantities must always be validated with `Number.isInteger()`.
4. Git pre-commit hooks run `npm run type-check && npm run lint`.
