# Contributing Guidelines: DEEN Commerce Reconciliation Engine

Thank you for contributing to the **DEEN Commerce Reconciliation Engine**. This platform handles mission-critical accounting and logistics reconciliation. We maintain rigorous standards for code quality, mathematical determinism, and user experience stability.

---

## 1. Code of Conduct & Development Principles

1. **Zero-Breakage UI Contract**: Every table must be responsive and wrapped in `w-full min-w-0 overflow-x-auto`. SVGs must have explicit dimensions clamped to maximum `44x44` pixels.
2. **Mathematical Invariant**: Never write or modify algorithms that allow floating-point returned quantities. Quantities must always be positive integers ($\in \mathbb{Z}_{\ge 0}$).
3. **Data Isolation**: Never mix retail POS walk-ins (`isPos: true`) into online courier dispatch reports.
4. **Secret Hygiene**: Never commit API keys, secrets, or `.env` files. Serverless routes in `src/app/api/` must keep credentials server-side.

---

## 2. Local Development Setup

### 2.1 Prerequisites
- **Node.js:** `v18.18.0` or higher (Node 20+ recommended)
- **Package Manager:** `npm` (v10+)
- **Git:** Latest version

### 2.2 Quickstart
```bash
# 1. Clone repository
git clone https://github.com/Sajid-ul-Islam/Sales-Analysis.git
cd Sales-Analysis

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local

# 4. Start local development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. Available npm Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `next dev -p 3000` | Start Next.js local development server. |
| `npm run build` | `next build` | Production build verification. |
| `npm run start` | `next start -p 3000` | Start production server locally. |
| `npm run lint` | `next lint` | Run ESLint checks across codebase. |
| `npm run type-check` | `tsc --noEmit` | Comprehensive TypeScript static type check. |
| `npm test` | `vitest run` | Execute automated test suites. |
| `npm run test:watch` | `vitest` | Interactive test watcher. |

---

## 4. Git Branching & Commit Conventions

### 4.1 Branch Naming
- `feat/feature-name`: New user-facing capabilities or tabs.
- `fix/bug-description`: Bug fixes or accounting repairs.
- `perf/optimization`: Performance improvements or caching enhancements.
- `docs/doc-update`: Documentation additions or revisions.
- `refactor/component`: Non-functional code cleanup.

### 4.2 Commit Messages (Conventional Commits)
All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
```
<type>(<scope>): <short description in present tense>

[optional body explaining motivation and technical details]

[optional footer with issue references: Fixes #123]
```

**Examples:**
- `feat(theme): add native super white default with dynamic css presets`
- `fix(knapsack): prevent fractional quantity returns on partial deliveries`
- `perf(cache): implement indexeddb offline baseline storage`
- `docs(api): document pathao customer rating endpoint and risk badges`

---

## 5. Coding Standards

### 5.1 TypeScript
- `strict: true` is enforced in `tsconfig.json`.
- Avoid `any`. Define explicit interfaces in `src/types/index.ts` or `src/types/campaign.ts`.
- Use union types for status states: `'Delivered' | 'Paid Return' | 'Return' | 'Partial' | 'Exchanged'`.

### 5.2 React & Components
- Prefer functional components with hooks (`useState`, `useMemo`, `useCallback`).
- Wrap expensive mathematical or sorting passes in `useMemo` with minimal dependency arrays.
- Place all new top-level tab views inside `src/components/tabs/` and register them in `src/components/tabs/index.ts`.

### 5.3 Tailwind CSS & Layout
- Use Tailwind utility classes.
- Follow the **10 Golden UX Rules** in `docs/DESIGN.md`.
- Never use fixed pixel widths on parent containers (use `w-full min-w-0 max-w-7xl` etc.).

---

## 6. Pull Request (PR) Checklist

Before submitting a PR, verify that you have completed:
- [ ] Run `npm run type-check` with **0 errors**.
- [ ] Run `npm run lint` with **0 errors**.
- [ ] Run `npm test` with all suites passing.
- [ ] Verified responsive layout down to 375px mobile width.
- [ ] Clamped all new SVGs to maximum `44x44`.
- [ ] Updated relevant documentation in `docs/` and root.
- [ ] Self-reviewed your diff to ensure no secrets or debug `console.log` statements are present.
