# Deen Commerce Reconciliation Engine

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)
[![CI Pipeline](https://github.com/Sajid-ul-Islam/Sales-Analysis/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)

A unified, real-time analytics & reconciliation dashboard reconciling Pathao courier deliveries and WooCommerce e-commerce sales (returns, partials, exchanges), featuring a Live Operations Terminal, AI copilot intelligence, and automated accounting audit exports.

## Overview

This application helps Deen Commerce track and reconcile:
- **Order fulfillment status** across multiple warehouses and branch locations
- **Returns** (paid vs. non-paid) with proper accounting
- **Partial orders** with mixed delivery/return statuses
- **Exchanges** and multi-parcel shipments

## Features

- **Live Operations Terminal**: Real-time warehouse fulfillment stream synced directly with WooCommerce REST API and Pathao Hermes Courier API, status modification tracking (`Date Modified`), pack queue (`processing` + `hold`), today's orders, 7-day rolling history with date picker, integer-only 7-day daily baseline, and one-click WhatsApp/Slack executive briefing.
- **DEEN Assistant (AI Copilot)**: Autonomous natural language business and reconciliation analyst powered by Gemini & BYOK (OpenAI, Claude, Groq), grounded in real-time operational slices and domain knowledge rules with offline heuristic synthesis and agentic bulk actions.
- **KPI Overview**: Key metrics at a glance with live delivery retention, courier cost recovery, and return loss.
- **Outlet Dispatch (Hub)**: Courier parcel dispatches, delivery retention rates, and returned consignment values across Online Store (Central Warehouse) and retail branch outlets (Mirpur POS `m`, Cumilla `c`, Wari `w`, Sylhet `s`).
- **Outlet Sales (WooCommerce Live)**: Real-time sales revenue, units sold, and channel breakdown comparing the Online Store (Website) against in-store physical POS registers.
- **Status Matrix**: Visual grid of order statuses across delivery outcomes.
- **SKU Performance**: Distinct categories for Polo, T-shirt, Jacket, and Sweatshirt with Excel export.
- **Territory Breakdown**: Regional performance (Inside Dhaka vs Outside Dhaka).
- **Unit Economics**: Profitability analysis per order and transaction.
- **Orders Ledger**: Searchable, filterable master order ledger with parcel badges and modal inspector.
- **Excel Export**: Multi-sheet formatted Excel reports with strict business status columns.

## Tech Stack

- **Frontend**: Next.js 14 + React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Python (server.py) for data processing
- **Data Processing**: Excel (xlsx) for reports

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.x (for server.py)

### Installation

```bash
npm install
```

### Environment Setup

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

Configure secrets in `secrets.toml` (copy from `secrets.example.toml`).

### Running the Dashboard

**Option 1: Using the launcher (Windows)**
```bash
Launch_Dashboard.bat
```

**Option 2: Manual start**
```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

## Documentation Architecture & Business Rules

Detailed architectural and business specifications:
- **[Product Requirements Document (PRD)](./docs/PRD.md)**: Product features, 14 analysis modules, persona requirements, and operational workflows
- **[Technical Requirements Document (TRD)](./docs/TRD.md)**: System topology, algorithms (Knapsack DP solver), API integrations, and data contracts
- **[Design System & CSS Architecture (DESIGN.md)](./docs/DESIGN.md)**: Color tokens, typography, component blueprints, and unbreakable CSS guarantees
- **[Order Tracking Business Rules](./.agents/rules/order_rules.md)**: Branch suffixes (`c`, `w`, `s`, `m`), paid return propagation, and integer-only return rule
- **[Unbreakable CSS & Styling Rules](./.agents/rules/css_and_styling_rules.md)**: PostCSS configuration, table overflow safety, and SVG dimension standards
- **[Workspace Guidelines](./AGENTS.md)**: High-level reconciliation overview and agent rules

## Project Structure

```
├── .github/workflows/ # GitHub Actions CI pipeline (ci.yml)
├── src/
│   ├── app/           # Next.js app router pages & API routes
│   ├── components/    # React components (tabs, CommandPalette, notifications)
│   ├── lib/           # Business logic (reconciliation, clients, security, export)
│   └── types/         # TypeScript interfaces and contracts
├── public/            # Static assets (logos, images)
├── scripts/           # Utility and anonymization scripts
├── legacy/            # Archived pre-v2.0 vanilla JS and Python prototypes
└── docs/              # Architectural PRD, TRD, and deployment guides
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/sync/live-terminal` | POST | High-speed dual-stream sync fetching WooCommerce orders & Pathao Hermes telemetry |
| `/api/ai/copilot` | POST | AI copilot inference engine with live ops grounding, offline fallback, and BYOK |
| `/api/sync/pathao` | POST | Fetch live consignments from Pathao Hermes API, cross-check returns & COD |
| `/api/sync/woocommerce` | POST | Fetch orders from WooCommerce REST API (paginated, up to 5 pages) |
| `/api/sync/status` | GET/POST | Health-check & sync status diagnostics |
| `/api/sample-data` | GET | Load pre-built September workspace dataset for demo/testing |

## Reconciliation Engine

The core `reconciliationEngine.ts` processes:

1. **Pathao Master Delivery Report** (primary status source) - maps consignments to orders
2. **Courier Return Log** (fallback) - captures RTO/paid returns with COD amounts
3. **Partial Delivery File** - handles split shipments with partial collections
4. **Exchanged Orders Log** - handles D-17263 / DD-17263 prefixed exchanges

### Subset-Sum Knapsack Solver

For **partial orders**, the engine uses `subsetSum.ts` to solve which items were kept vs returned:
- Flattens multi-quantity items into discrete garment units
- Tries delivery fee deductions (50 TK Dhaka, 90 TK outside, 60/100/120 TK variants)
- Searches for exact match (<=2 BDT), tolerance match (<=25 BDT), or closest discrete match
- **Enforces integer-only returned quantities** (no 0.5 allowed)

### Business Rules Implemented

| Rule | Implementation |
|------|---------------|
| Split multi-parcel delivered | If ALL parcels delivered -> mark DELIVERED |
| Paid return propagation | If any parcel is Paid Return, all returned parcels count as paid |
| Branch suffix detection | IDs like `17263 c`, `17263 w`, `17263 s` map to Cumilla/Wari/Sylhet |
| Geographic classification | 200+ district/thana names for Inside/Outside Dhaka |
| COGS calculation | ~42% of delivered item cost |
| Packaging loss | ৳25 per returned/partial order |
| Customer risk tiers | LOW (<30% return rate), MEDIUM (30-60%), HIGH_RISK (>60%) |

## Development

### Install dependencies
```bash
npm install
```

### Development server
```bash
npm run dev    # Starts on http://localhost:3000
```

### Build for production
```bash
npm run build
npm start      # Production server on port 3000
```

### Python fallback server
```bash
python server.py   # Serves static files on http://localhost:8085
```

## Configuration

Create `.env.local` from `.env.example` and `secrets.toml` from `secrets.example.toml`.

### Required secrets (secrets.toml)

```toml
[woocommerce]
store_url = "https://your-store.com"
consumer_key = "ck_..."
consumer_secret = "cs_..."

[pathao]
base_url = "https://api.pathao.com"
client_id = "..."
client_secret = "..."
username = "..."
password = "..."
```

## Excel Export

The `Export` button generates a multi-sheet workbook:

1. **Executive Summary** - KPI metrics & unit economics
2. **Reconciled Orders** - Full ledger with Order Delivery Status & Item Delivery Status columns
3. **SKU Performance** - Product-level retention & return analytics
4. **Item-Wise Returns** - Full returns + partial returns detail
5. **Customer Risk Intelligence** - Risk tiers & recommendations
6. **Exchanged Orders** - Exchange log with COD & courier fees
7. **Courier Mismatches** - Pathao vs Excel status/COD discrepancies

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── sample-data/   # Demo dataset loader
│   │   │   ├── sync/
│   │   │   │   ├── pathao/    # Pathao Hermes API sync
│   │   │   │   ├── woocommerce/ # WooCommerce REST API sync
│   │   │   │   └── status/   # Status update endpoint
│   │   │   └── ...
│   │   ├── globals.css        # Tailwind imports + custom styles
│   │   ├── layout.tsx         # Root layout with fonts & metadata
│   │   └── page.tsx           # Main dashboard (client component)
│   ├── components/
│   │   ├── CloudSyncBar.tsx   # Live API sync toolbar
│   │   ├── FileDropzone.tsx   # Multi-file upload dropzones
│   │   ├── Header.tsx         # Export/reset/switch mode controls
│   │   ├── KpiOverview.tsx    # 8 KPI cards + hero metric
│   │   ├── Sidebar.tsx        # Tab navigation
│   │   ├── tabs/              # 12 analysis tabs:
│   │   │   ├── CourierMismatchTab.tsx
│   │   │   ├── CustomerRiskTab.tsx
│   │   │   ├── ExchangedOrdersTab.tsx
│   │   │   ├── ExecutiveOverviewTab.tsx
│   │   │   ├── ItemReturnsTab.tsx
│   │   │   ├── OrdersLedgerTab.tsx
│   │   │   ├── OutletDispatchTab.tsx   # Courier parcel dispatches by outlet
│   │   │   ├── OutletSalesTab.tsx      # WooCommerce sales across web & POS
│   │   │   ├── SkuPerformanceTab.tsx
│   │   │   ├── StatusMatrixTab.tsx
│   │   │   ├── TerritoryTab.tsx
│   │   │   └── UnitEconomicsTab.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── reconciliationEngine.ts  # Core orchestration (1,500+ lines)
│   │   ├── subsetSum.ts              # Knapsack/subset-sum solver
│   │   ├── excelExport.ts           # Multi-sheet Excel generator
│   │   ├── pathaoClient.ts          # Pathao Aladdin API client
│   │   ├── woocommerceClient.ts    # WooCommerce REST client
│   │   ├── geo.ts                   # Geocoding dictionary (200+ locations)
│   │   ├── secrets.ts              # Config and env reader
│   │   ├── discrepancyAuditor.ts   # Mismatch detection logic
│   │   ├── overrideStore.ts        # State override utilities
│   │   └── ...
│   └── types/
│       └── index.ts                # All TypeScript interfaces
├── legacy/                   # Archived pre-v2.0 vanilla JS & Python prototypes
├── secrets.example.toml      # Configuration template
├── .env.example              # Environment variables template
└── package.json              # Next.js 14 + dependencies
```

## Vercel & Production Deployment

The project is built on Next.js 14 (App Router) and is ready for Vercel deployment.

### 1. Build Verification
```bash
npm run build
```
Generates optimized static pages and serverless API endpoints with zero build errors.

### 2. Environment Variables on Vercel
In your **Vercel Project Settings → Environment Variables**, add the variables defined in `.env.example`:

| Variable | Description |
|---|---|
| `WOOCOMMERCE_STORE_URL` | Store URL (e.g. `https://deencommerce.com`) |
| `WOOCOMMERCE_CONSUMER_KEY` | WooCommerce REST API Consumer Key (`ck_...`) |
| `WOOCOMMERCE_CONSUMER_SECRET` | WooCommerce REST API Consumer Secret (`cs_...`) |
| `PATHAO_BASE_URL` | Hermes API URL (`https://api-hermes.pathao.com`) |
| `PATHAO_CLIENT_ID` | Pathao Client ID |
| `PATHAO_CLIENT_SECRET` | Pathao Client Secret |
| `PATHAO_USERNAME` | Pathao Merchant Email |
| `PATHAO_PASSWORD` | Pathao Merchant Password |

### 3. Serverless File Handling
- The serverless API routes (`/api/sample-data`, `/api/sync/pathao`) are hardened against missing filesystem assets in cloud sandboxes.
- When deployed without local Excel spreadsheets, the frontend automatically initiates in **Dropzone / Upload Mode**, allowing drag-and-drop ingestion of current courier sheets or direct live synchronization via WooCommerce and Pathao APIs.

## License

Private - Deen Commerce internal tool.
