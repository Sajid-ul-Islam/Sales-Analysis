# Design System & UX Architecture: DEEN Commerce

**Version:** 2.4.0  
**Design Philosophy:** Native Super White Enterprise Minimalism · Unbreakable Responsive Layouts  
**Tech Stack:** Tailwind CSS 3.4 · PostCSS 8.5 · Lucide React · CSS Custom Properties  
**Last Updated:** November 2026  

---

## 1. Design Vision & Philosophy

The **DEEN Commerce Reconciliation Engine** delivers an enterprise-grade, high-density desktop experience tailored for data-heavy financial operations.

### Key Tenets:
1. **Native OS Feel (Native Super White)**: By default, the canvas utilizes pure `#FFFFFF` background surfaces and crisp borders to evoke the lightweight, distraction-free aesthetic of native macOS and Windows enterprise utilities.
2. **Zero Layout Shifts**: Metric changes, tab transitions, or expanding rows must never shift parent layout bounds or cause jitter.
3. **Information Density with Scannability**: High-volume tabular rows are optimized for 24-inch warehouse monitors as well as 13-inch laptop displays through tight vertical padding (`py-2.5`), monospace numeric tabular figures (`font-mono`), and high-contrast status pills.

---

## 2. The 10 Golden UX Rules (Unbreakable UI Contracts)

All user interface code MUST strictly adhere to these 10 inviolable rules:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   THE 10 GOLDEN RULES OF DEEN UX                       │
├────┬─────────────────────────────┬────────────────────────────────────┤
│ 1  │ Unbreakable Table Wrapping  │ All <table> elements MUST be       │
│    │                             │ wrapped in:                        │
│    │                             │ <div className="w-full min-w-0     │
│    │                             │ overflow-x-auto">                  │
├────┼─────────────────────────────┼────────────────────────────────────┤
│ 2  │ SVG Clamping                │ All SVGs/icons must have explicit  │
│    │                             │ width/height classes. Max: 44x44px.│
├────┼─────────────────────────────┼────────────────────────────────────┤
│ 3  │ Monospace Numbers           │ Financial figures and order counts │
│    │                             │ must use font-mono tabular nums.   │
├────┼─────────────────────────────┼────────────────────────────────────┤
│ 4  │ High-Contrast Status Pills  │ Delivery statuses must render with │
│    │                             │ semantic background & border tints.│
├────┼─────────────────────────────┼────────────────────────────────────┤
│ 5  │ Zero Floating Items         │ Returned quantities must display as│
│    │                             │ discrete integers (1, 2, 3...).    │
├────┼─────────────────────────────┼────────────────────────────────────┤
│ 6  │ Omnichannel Suffix Badges   │ Split branches must show dedicated │
│    │                             │ badges: [Mirpur m], [Cumilla c]... │
├────┼─────────────────────────────┼────────────────────────────────────┤
│ 7  │ POS Isolation               │ POS register sales must NEVER leak │
│    │                             │ into online dispatch tables.       │
├────┼─────────────────────────────┼────────────────────────────────────┤
│ 8  │ Dynamic Theme Resets        │ Body and container backgrounds must│
│    │                             │ consume var(--bg-surface).         │
├────┼─────────────────────────────┼────────────────────────────────────┤
│ 9  │ Keyboard Accessibility      │ Omni Search (⌘K), AI Copilot (⌘J), │
│    │                             │ and ESC modal dismissals supported.│
├────┼─────────────────────────────┼────────────────────────────────────┤
│ 10 │ Non-Blocking Async Spinners │ Background data fetches must never │
│    │                             │ freeze existing rendered tables.   │
└────┴─────────────────────────────┴────────────────────────────────────┘
```

---

## 3. Dynamic Color Architecture & CSS Custom Properties

The system implements CSS custom property tokens injected onto `:root` via `src/lib/themeManager.ts`.

### 3.1 Background Style Presets
Users can switch canvas background presets from `SettingsTab.tsx`:

| Preset ID | Preset Name | Background Hex | Description |
|---|---|---|---|
| `super-white` | **Native Super White** (Default) | `#FFFFFF` | Crisp, pure white native desktop software aesthetic. |
| `slate-subtle` | Modern Slate | `#F8FAFC` | Subtle slate blue-grey tint reducing eye strain. |
| `zinc-cool` | Cool Metallic Zinc | `#F4F4F5` | Neutral metallic industrial finish. |
| `cream-warm` | Warm Paper Ivory | `#FAFAF9` | Warm archival book paper aesthetic. |
| `dark-canvas` | Deep Midnight Canvas | `#0B0F19` | High-contrast dark mode for low-light environments. |

### 3.2 Status Palette & Semantics

| Status | Text Color | Background Pill | Border Color | Semantic Meaning |
|---|---|---|---|---|
| **Delivered** | `text-emerald-700` | `bg-emerald-50` | `border-emerald-200` | Full parcel delivered, cash collected. |
| **Paid Return** | `text-amber-700` | `bg-amber-50` | `border-amber-200` | Customer returned parcel, shipping fee paid. |
| **Return (RTO)**| `text-rose-700` | `bg-rose-50` | `border-rose-200` | Total return, zero cash collected. |
| **Partial** | `text-blue-700` | `bg-blue-50` | `border-blue-200` | Subset of items kept, subset returned. |
| **Exchanged** | `text-purple-700` | `bg-purple-50` | `border-purple-200` | Size/color exchange consignment (`D-`). |
| **In-Transit** | `text-slate-600` | `bg-slate-100` | `border-slate-200` | Currently with courier rider. |

---

## 4. Typography Scale & Fonts

The application leverages Next.js font optimization:
- **Primary Interface Font:** `Inter`, system-ui, -apple-system, sans-serif.
- **Monospace Financial Font:** `JetBrains Mono`, `Fira Code`, monospace (`font-mono`, `tabular-nums`).

```
Display Large: text-2xl font-bold tracking-tight (24px / 32px)
Section Title: text-lg font-semibold tracking-normal (18px / 28px)
Card Header:   text-sm font-medium text-slate-500 uppercase tracking-wider
Table Body:    text-xs md:text-sm font-normal text-slate-700
Table Numbers: text-xs md:text-sm font-mono font-medium text-slate-900
Pill Badge:    text-xs font-semibold px-2.5 py-0.5 rounded-full
```

---

## 5. Component Anatomy & Interaction States

### 5.1 KPI Overview Hero Cards
- Card container: `bg-white rounded-xl border border-slate-200 p-5 shadow-xs transition-all hover:border-slate-300`.
- Metric layout: Two-column flex container with bold numeric value on the left and clamped mini-donut chart (`w-11 h-11`) on the right.

### 5.2 Responsive Table Component
```tsx
<div className="w-full min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
  <table className="w-full text-left text-sm border-collapse min-w-[850px]">
    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-600 sticky top-0">
      <tr>
        <th className="py-3 px-4">Order ID</th>
        <th className="py-3 px-4">Customer</th>
        <th className="py-3 px-4">Outlet / Channel</th>
        <th className="py-3 px-4 text-right">Collected (BDT)</th>
        <th className="py-3 px-4 text-center">Status</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {/* Table rows */}
    </tbody>
  </table>
</div>
```

---

## 6. Core UI Principles, UX Honeycomb & Psychological Laws

All interface components enforce the mandatory contract in [.agents/rules/ui_ux_laws_and_principles.md](.agents/rules/ui_ux_laws_and_principles.md) (and audit workflow [.agents/skills/ui-ux-audit-and-design/SKILL.md](.agents/skills/ui-ux-audit-and-design/SKILL.md)):

- **Core UI Design Principles**: Visual Hierarchy, Consistency, Proximity & Alignment (Gestalt grids & `overflow-x-auto` table wrappers), Contrast & Accessibility (WCAG AA `>= 4.5:1`, 11px floor, `aria-label` on icon buttons, `role="dialog"` + `Esc` on modals, keyboard handlers on interactive cards/rows), and Feedback (`active:scale-95`, `role="status" aria-live="polite"` toast notifications, immediate copy/export confirmations).
- **The UX Honeycomb (Peter Morville)**: Usefulness, Usability, Findability (`⌘K` Command Palette & clearable searches), Credibility (`DataProvenanceBanner`), Desirability, Accessibility, and Value.
- **Psychological Laws of UI/UX**: Hick's Law (progressive disclosure & simple choices), Fitts's Law (minimum `36–48px` target sizing & colocated controls), Jakob's Law (familiar dashboard conventions & `Esc` dismissal), Miller's Law (`5–7` chunked nav items & KPI grids), and Aesthetic-Usability Effect.
