# Antigravity Rules: Core UI/UX Design Principles & Psychological Laws

**Scope:** All frontend UI components, tabs, modals, charts, and navigation shells in the DEEN Commerce Reconciliation Engine (`src/app/`, `src/components/`).  
**Status:** Mandatory App Rule — must be verified on every UI feature or modification.

---

## 1. Core UI Design Principles (5 Pillars)

1. **Visual Hierarchy**
   - Guide attention using typographic scale, weight (`font-headline font-bold` on KPIs & headings), spacing, and color.
   - Reserve DEEN Orange (`#EB5A19` / `#C8430E`) for active navigation, primary CTAs, and critical focus states.
   - Primary KPI values use `text-xl` to `text-3xl` with `font-mono tabular-nums`; metadata stays secondary (`text-xs`).

2. **Consistency**
   - Reuse shared primitives (`StatusBadge`, `FulfillmentBadge`, `EmptyState`, `ErrorCard`, `NoSearchResults`, `LoadingProgress`, `TableSkeleton`) instead of reinventing status pills or blank screens.
   - Keep header heights (`h-16`), card radii (`rounded-xl`, `rounded-2xl`), table padding (`py-3 px-3.5`), and modal anatomy (`role="dialog"`, header with `×`, Escape close, backdrop click) uniform across all views.

3. **Proximity & Alignment (Gestalt)**
   - Group related filters, KPIs, and summary chips tightly inside unified toolbars or card grids (`gap-2` within clusters, `gap-4` / `gap-6` between distinct groups).
   - Align grids cleanly (`grid-cols-*`) with `min-w-0` on flex children and wrap every `<table>` in `<div className="w-full min-w-0 overflow-x-auto">`.

4. **Contrast & Accessibility (WCAG AA Mandatory)**
   - Normal text contrast MUST meet **>= 4.5:1** (`text-slate-600` or darker on `#FFFFFF` / `slate-50`; never light `text-slate-300` or `text-slate-400` for readable light-mode labels). Small orange text on white MUST use `text-primary-dark` (`#C8430E`, 4.6:1 contrast).
   - Enforce a **minimum `11px` (`text-[11px]` / `text-xs`) font floor** on all navigation labels, section headers, chips, and interactive controls.
   - Every icon-only `<button>` MUST have an explicit `aria-label` (and `<title>`/`title`).
   - Every interactive non-button element (`<div onClick>`, `<tr onClick>`, clickable `<span>`) MUST use native `<button>` or implement `role="button"`, `tabIndex={0}`, and Enter/Space `onKeyDown` handlers.
   - Modals and drawers MUST set `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (or `aria-label`), close on `Escape`, and close on backdrop click.
   - Active navigation items MUST include `aria-current="page"`.

5. **Feedback**
   - Every clickable control MUST give immediate visual/tactile feedback (`active:scale-95` or `active:scale-[0.98]`, clear `:hover` state, `:focus-visible` ring).
   - Async actions (API sync, Excel/CSV export, save, copy-to-clipboard) MUST show loading spinners/disabled state during work and visible confirmation ("Copied!", toast banner inside `role="status" aria-live="polite"`) immediately on completion.

---

## 2. Core UX Design Principles (Peter Morville's UX Honeycomb)

1. **Usefulness**: Every tab and chart solves a concrete DEEN Commerce operational problem (e.g., COD leakage detection, 0/1 knapsack partial attribution, branch POS isolation, size-curve stockouts). Avoid decorative widgets without decisions behind them.
2. **Usability**: Workflows must work intuitively without documentation—label DEEN domain concepts (Paid Return, RTO Loss, Split Suffixes `m/c/w/s`) plainly.
3. **Findability**: Support Command Palette (`⌘K`), instant clearable search inputs (`×` clear button when non-empty), match counts ("Showing X of Y"), and scoped filter pills.
4. **Credibility**: Build financial trust via `DataProvenanceBanner` (showing exact source, timestamp, and row counts), `font-mono tabular-nums`, plain error recovery (`ErrorCard`), and zero broken/placeholder labels.
5. **Desirability**: Deliver crisp craft—Native Super White (`#FFFFFF`) default, Pitch-Black OLED Dark Mode (`#000000`), balanced whitespace, and polished card depth.
6. **Accessibility**: Keyboard-first (`Skip to main content`, `⌘K`, `⌘J`, `⌘B`, `Esc`, `Tab`), `prefers-reduced-motion` guard, and color-never-alone status pills (text + icon/badge, never dot color alone).
7. **Value**: High leverage per click—1-click `.xlsx`/`.csv` exports, instant date presets, and KPI drill-downs directly into filtered ledgers.

---

## 3. Key Psychological Laws of UI/UX

1. **Hick's Law** (*Keep Choices Simple*)
   - Reduce decision latency: cap top-level filter controls cleanly and move secondary options into progressive disclosure drawers/tabs (e.g., "More Filters", "Details").
   - Present a single clear primary CTA per card/modal alongside muted secondary actions.

2. **Fitts's Law** (*Larger, Closer Targets*)
   - Enforce minimum interactive target sizes: **`>= 44×44px`** for mobile/tablet nav & drawer items (`>= 48px` on bottom nav), **`>= 36×36px`** for compact toolbar icon buttons (minimum `28–32px` inside dense inline table cells).
   - Place related actions directly beside their target (Clear `×` inside search input, Reset right next to active filters, Copy next to Order ID).

3. **Jakob's Law** (*Match Mental Models*)
   - Preserve standard enterprise web conventions: persistent left sidebar + sticky search header, `⌘K` spotlight search, `Esc` dismisses any modal/popover, standard iconography (`Search`, `Download`, `X`, `RefreshCw`).

4. **Miller's Law** (*Chunk Information into 5–7 Items*)
   - Navigation groups MUST stay compact (**5–7 items per group**, e.g. 5 in `Core Operations`, 5 in `Commercial & Retail`).
   - KPI rows cap at **4–5 cards per row** (`xl:grid-cols-5`, `sm:grid-cols-2 lg:grid-cols-4`).
   - Break dense settings and analytics screens into scannable, titled sections with visual dividers.

5. **Aesthetic-Usability Effect**
   - Clean visual polish increases user trust and perceived ease of use: enforce consistent border radii, alignment, crisp contrast, zero horizontal scroll blowouts, and zero awkward text truncation/overlap.
