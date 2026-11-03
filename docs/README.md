# DEEN Commerce Reconciliation Engine

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)
[![Next.js 14.2](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![TypeScript 5.6](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS 3.4](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-5.0-6e9f18.svg)](https://vitest.dev/)
[![Status](https://img.shields.io/badge/Status-Production--Ready-emerald.svg)](#)

A high-performance, client-first analytics & reconciliation engine reconciling **Pathao courier deliveries** and **WooCommerce e-commerce sales** (returns, partial deliveries, branch splits, exchanges, and POS counter sales) for **DEEN Commerce** ([deencommerce.com](https://deencommerce.com)).

Features an in-browser 0/1 knapsack dynamic programming solver, a real-time Live Operations Terminal, an AI semantic copilot powered by Google Gemini, and automated 7-sheet closing Excel workbooks.

---

## 🌟 Executive Overview & Key Capabilities

- **Mathematical Knapsack DP Reconciliation (`subsetSum.ts`)**: Reverse-engineers partial order customer acceptances from courier COD remittances using 0/1 knapsack dynamic programming with a **strict integer quantity invariant (zero floating items allowed)**.
- **Omnichannel Channel Segregation**:
  - **Online Store (Central Warehouse)**: Standard web checkout orders.
  - **Branch Split Courier Dispatches**: Regional courier consignments dispatched from store inventory (`17263 c` Cumilla, `17263 w` Wari, `17263 s` Sylhet, `17263 m` Mirpur).
  - **Retail POS Register Walk-Ins**: Physical store counter sales (`_sip_outlet_id`: `2`, `7`, `8`, `9`). Filtered exclusively to `OutletSalesTab` and completely hidden from online delivery reports.
  - **Exchanged Orders Hub**: Size and color exchange replacements (`D-` and `DD-` prefix orders) isolated from new commercial revenue.
- **Live Operations Terminal (`LiveOpsTab`)**: Real-time warehouse pack stream, live connection telemetry, 7-day rolling baseline, and one-click WhatsApp/Slack executive dispatch briefing.
- **Pathao Customer Fraud Scoring & Intelligence**: Instant delivery success rating badges (🌟 Excellent, 👍 Good, ⚖️ Moderate, ⚠️ High Risk, 🌱 New Buyer) queried from Pathao network API (`/aladdin/api/v1/user/success`).
- **Multi-Month Statements Hub (`MonthlyStatementsHub`)**: Unified closing statements consolidating September 2026, October 2026, and November 2026 with month-over-month trajectory analysis.
- **Campaign Intelligence Tab (`CampaignIntelligenceTab`)**: Full-funnel ad spend attribution for Meta Ads, Google Ads, and SMS with real-time **Delivered ROAS** calculations.
- **Native Super White Aesthetics**: Pure `#FFFFFF` default canvas background with dynamic CSS custom properties (`--bg-surface`, `--card-surface`, `--border-surface`) and one-click theme presets in `SettingsTab`.
- **Month-End 7-Sheet Excel Export**: Generates audit-grade `.xlsx` workbooks via SheetJS with auto-fitted columns and dynamic accounting formulas.

---

## 🏗️ Tech Stack & Architecture

- **Framework**: Next.js 14.2 (App Router)
- **Frontend Core**: React 18 · TypeScript 5.6 · Tailwind CSS 3.4
- **In-Memory Analytics**: AlaSQL 4.21 (in-browser relational OLAP engine)
- **AI Copilot**: Google GenAI SDK (`@google/genai` 2.29.1, Gemini 2.5 Flash)
- **Export Engine**: SheetJS (XLSX 0.20.3)
- **Testing**: Vitest 5.0
- **Deployment**: Vercel Serverless / Edge & Docker Alpine

---

## 🚀 Quickstart Guide

### Prerequisites
- Node.js `18.18.0` or higher
- npm `10.0.0` or higher

```bash
# 1. Clone repository
git clone https://github.com/Sajid-ul-Islam/Sales-Analysis.git
cd Sales-Analysis

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env.local

# 4. Start local development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the active application.

---

## 📋 Available npm Scripts

```bash
npm run dev          # Start Next.js App Router dev server on port 3000
npm run build        # Build production bundle (.next)
npm run start        # Start production build server
npm run type-check   # Run static TypeScript verification (tsc --noEmit)
npm run lint         # Run ESLint validation
npm test             # Run automated Vitest test suites
```

---

## 📁 Repository Directory Structure

```
.
├── .agents/                    # Agent behavioral guidelines & system rules
├── docs/                       # Complete engineering documentation suite (23 files)
├── public/                     # Static branding assets and icons
├── scripts/                    # Automation scripts (Multi-month dataset generators)
├── src/
│   ├── app/                    # Next.js App Router (pages, layout, globals.css, API routes)
│   │   ├── api/                # Serverless endpoints (/api/sync/..., /api/campaigns, etc.)
│   │   ├── globals.css         # Unbreakable base styles & theme resets
│   │   └── page.tsx            # Master single-page app containing all 16 tab modules
│   ├── components/             # React presentation components
│   │   ├── common/             # Atomic widgets, badges & MonthlyStatementsHub
│   │   ├── tabs/               # 16 specialized analytical modules
│   │   ├── Header.tsx          # Omni search, Ask AI button & Command palette
│   │   ├── KpiOverview.tsx     # Hero KPI cards with clamped mini-donuts
│   │   └── Sidebar.tsx         # Collapsible responsive navigation
│   ├── data/                   # Offline datasets & webhook event logs
│   ├── lib/                    # Algorithmic engine, knapsack DP & business services
│   └── types/                  # TypeScript interfaces and contracts
└── tests/                      # Automated Vitest suites
```

---

## 📚 Canonical Documentation Index

All technical, operational, and architectural specifications are maintained in the repository:

| Document | Description |
|---|---|
| [AGENTS.md](AGENTS.md) | Autonomous agent behavioral contracts, business rules & invariants |
| [API.md](API.md) | Complete REST API & webhook specifications for WooCommerce and Pathao |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, component graph, state stores & data pipelines |
| [AUDIT.md](AUDIT.md) | Reconciliation algorithms, COD leakage audit & accounting proofs |
| [AUDIT_REPORT.md](AUDIT_REPORT.md) | Historical audit reports, empirical data findings & closed-month validations |
| [BUGS_AND_FIXES.md](BUGS_AND_FIXES.md) | Incident log, regression mitigations & architectural bug fixes |
| [CHANGELOG.md](CHANGELOG.md) | Semantic version history & detailed release notes |
| [CONTEXT.md](CONTEXT.md) | Domain context, Bangladesh logistics realities & retail ecosystem |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Developer onboarding, Git conventions & PR guidelines |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel deployment, Docker setup, edge proxies & CDN configs |
| [DESIGN.md](DESIGN.md) | Unbreakable UI design system, color tokens & 10 Golden Rules |
| [OPERATIONS.md](OPERATIONS.md) | Warehouse, retail branch & finance department standard SOPs |
| [PRD.md](PRD.md) | Product Requirements Document (features, personas & scope) |
| [R&D.md](R&D.md) | Research & development roadmap, ML RTO models & innovations |
| [SECURITY.md](SECURITY.md) | Threat modeling, HMAC signatures, RBAC & vulnerability management |
| [SKILLS.md](SKILLS.md) | Machine & agent skill definitions, schemas & triggers |
| [TESTING.md](TESTING.md) | Vitest testing suites, mock pipelines & mathematical verification |
| [TODO.md](TODO.md) | Living roadmap, completed milestones & sprint backlog |
| [TRD.md](TRD.md) | Technical Requirements Document (data structures & APIs) |
| [WEBMCP.md](WEBMCP.md) | Web Model Context Protocol specifications & agent interfaces |
| [WORKFLOW.md](WORKFLOW.md) | End-to-end data pipelines & developer release workflows |

---

## 🛡️ License & Copyright

Proprietary Software. © 2026 DEEN Commerce. All rights reserved.
Unauthorized copying, distribution, or decompilation is strictly prohibited.
