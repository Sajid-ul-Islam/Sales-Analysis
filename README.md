# Deen Commerce Reconciliation Engine

A web-based dashboard for reconciling returns, sales, and order fulfillment data between Pathao (courier) and WooCommerce (e-commerce).

## Overview

This application helps Deen Commerce track and reconcile:
- **Order fulfillment status** across multiple warehouses and branch locations
- **Returns** (paid vs. non-paid) with proper accounting
- **Partial orders** with mixed delivery/return statuses
- **Exchanges** and multi-parcel shipments

## Features

- **KPI Overview**: Key metrics at a glance
- **Status Matrix**: Visual grid of order statuses
- **Sku Performance**: Product-level analysis
- **Territory Breakdown**: Regional performance (Mirpur, Cumilla, Wari, Sylhet)
- **Unit Economics**: Profitability analysis per order/transaction
- **Excel Export**: Export reconciled data with proper status columns

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
# Start the Python backend (if needed)
python server.py

# In another terminal, start Next.js
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

## Business Rules

See [AGENTS.md](./AGENTS.md) and [.agents/rules/order_rules.md](./.agents/rules/order_rules.md) for detailed business rules on:

- **Order IDs**: Multi-item orders with branch suffixes (`17263 c`, `17263 w`, `17263 s`)
- **Statuses**: Delivered, Returned, Partial, Exchange
- **Paid Returns**: If any parcel is marked Paid Return, all count as paid
- **Partial Orders**: Integer-only returned quantities (no 0.5)
- **Delivery Charges**: 50 TK or 90 TK included in collected amounts

## Project Structure

```
├── src/
│   ├── app/           # Next.js app router pages & API routes
│   ├── components/    # React components (tabs, KPIs, etc.)
│   └── lib/           # Business logic (reconciliation, clients, export)
├── server.py          # Python backend for data processing
├── process_net_sales.py
├── public/            # Static assets (logos, images)
└── scripts/           # Utility scripts
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/sync/pathao` | POST | Fetch live consignments from Pathao Hermes API, cross-check returns & COD |
| `/api/sync/woocommerce` | POST | Fetch orders from WooCommerce REST API (paginated, up to 5 pages) |
| `/api/sync/status` | POST | Sync status updates |
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
│   │   ├── tabs/              # 10 analysis tabs:
│   │   │   ├── CourierMismatchTab.tsx
│   │   │   ├── CustomerRiskTab.tsx
│   │   │   ├── ExchangedOrdersTab.tsx
│   │   │   ├── ExecutiveOverviewTab.tsx
│   │   │   ├── ItemReturnsTab.tsx
│   │   │   ├── OrdersLedgerTab.tsx
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
│   │   ├── secrets.ts              # TOML config reader
│   │   ├── discrepancyAuditor.ts   # Mismatch detection logic
│   │   ├── overrideStore.ts        # State override utilities
│   │   └── ...
│   └── types/
│       └── index.ts                # All TypeScript interfaces
├── server.py                 # Python dev server (port 8085)
├── process_net_sales.py     # Net sales processing script
├── secrets.example.toml      # Configuration template
├── .env.example              # Environment variables template
└── package.json              # Next.js 14 + dependencies
```

## License

Private - Deen Commerce internal tool.
