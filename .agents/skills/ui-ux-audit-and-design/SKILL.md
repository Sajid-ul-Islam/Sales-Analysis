---
name: ui-ux-audit-and-design
description: Audit, design, and enforce Core UI Design Principles, Peter Morville's UX Honeycomb, and Psychological Laws of UI/UX (Hick's, Fitts's, Jakob's, Miller's, Aesthetic-Usability) across React/Next.js/Tailwind components in DEEN Commerce. Use whenever creating or reviewing tabs, modals, tables, navigation, filters, or running full UI/UX compliance audits.
---

# UI/UX Principles, Honeycomb & Psychological Laws Skill

Apply this skill when designing new features or auditing existing components in `src/components/` and `src/app/`. Always enforce `.agents/rules/ui_ux_laws_and_principles.md` alongside `.agents/rules/css_and_styling_rules.md`.

## Evaluation Framework (17-Point Matrix)

### Part A — Core UI Design Principles (5)
1. **Visual Hierarchy**: `Plus Jakarta Sans` (`font-headline`) headlines & metrics, clear size/weight contrast, primary DEEN Orange (`#EB5A19` / `#C8430E`) reserved for primary CTAs and active states.
2. **Consistency**: Use shared `StatusBadge`, `FulfillmentBadge`, `EmptyState`, `ErrorCard`, `NoSearchResults`. Modals share backdrop click, `Esc` close, `role="dialog"`, and `×` close button.
3. **Proximity & Alignment**: Group filter/action clusters tightly (`gap-2`); separate distinct sections (`gap-4`/`gap-6`). Use `min-w-0` on flex children and wrap every `<table>` in `<div className="w-full min-w-0 overflow-x-auto">`.
4. **Contrast & Accessibility**:
   - Normal light-mode text must use `text-slate-600` or darker (`>= 4.5:1` contrast on `#FFFFFF`; NEVER `text-slate-300` or `text-slate-400` for readable light-mode labels). Small orange text on white must use `text-primary-dark` (`#C8430E`).
   - Minimum **`11px` (`text-[11px]`)** font size on navigation items, badges, and micro-labels.
   - Icon-only buttons MUST include `aria-label`.
   - Clickable non-button containers (`div`, `tr`, `span`) MUST either use `<button type="button">` or have `role="button"`, `tabIndex={0}`, and Enter/Space `onKeyDown` handlers.
   - Toasts/async feedback regions MUST expose `role="status"` and `aria-live="polite"`.
5. **Feedback**: Interactive controls include `active:scale-95` / `active:scale-[0.98]`; copy, save, sync, and export buttons display immediate inline or toast confirmation.

### Part B — UX Honeycomb (7)
6. **Usefulness**: Every card/chart answers a real operational decision.
7. **Usability**: Self-explanatory domain terms and controls without manuals.
8. **Findability**: `⌘K` Command Palette, instant search with `×` clear button, active filter indicators, and result counts.
9. **Credibility**: `DataProvenanceBanner` dataset transparency, `font-mono tabular-nums`, honest error recovery (`ErrorCard`).
10. **Desirability**: Crisp Native Super White (`#FFFFFF`) & Pitch-Black OLED (`#000000`), balanced spacing.
11. **Accessibility**: `Skip to main content`, keyboard shortcuts, `prefers-reduced-motion`, color-never-alone status pills.
12. **Value**: 1-click exports, smart date presets, direct KPI-to-ledger drill-downs.

### Part C — Psychological Laws of UI/UX (5)
13. **Hick's Law**: Keep visible choices focused; group secondary filters in expandable trays; avoid > 1 primary CTA per card.
14. **Fitts's Law**: Minimum `36×36px` toolbar buttons, `44×44px` sidebar/nav items, `48×48px` mobile touch targets; colocate Reset/Clear buttons with inputs.
15. **Jakob's Law**: Follow familiar dashboard conventions (`Esc` closes overlays, left sidebar, sticky header, recognizable Lucide icons).
16. **Miller's Law**: Chunk navigation and KPI strips to **5–7 items** per group/row.
17. **Aesthetic-Usability Effect**: Crisp borders, uniform radii, zero overflow/clipping, clean visual polish.

## Audit & Fix Workflow

1. **Scan Modified/Target Components**:
   Check for:
   - Any `<table` missing an enclosing `overflow-x-auto` container with `min-w-0`.
   - Any `<button` containing only an icon/SVG without `aria-label`.
   - Any modal (`fixed inset-0`) missing `role="dialog"`, `aria-modal="true"`, or `Escape` key listener.
   - Any clickable `<div`, `<tr`, or `<span` missing `role="button"`, `tabIndex={0}`, and Enter/Space keyboard handling.
   - Any navigation/label chip below `11px` (`text-[8px]`, `text-[9px]`, `text-[10px]`, `text-3xs`) or light-mode readable text using washed-out `text-slate-300`/`text-slate-400`.
   - Any action button lacking `active:scale-95` or confirmation feedback on copy/save/export.
   - Sidebar or KPI groups exceeding 7 items without chunking.
2. **Apply Structural Fixes First**: Fix broken table wrappers, modal `Esc`/ARIA contracts, keyboard handlers, icon-button `aria-label`s, and Fitts's touch target bounds before cosmetic tweaks.
3. **Verify**:
   - Run `npx vitest run tests/ui/ tests/responsive/`
   - Run `npx tsc --noEmit`
   - Never break existing CSS contracts (`AGENTS.md` §5 & `.agents/rules/css_and_styling_rules.md`).
