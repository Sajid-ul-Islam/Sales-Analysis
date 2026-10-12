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

- `/api/sync/pathao` - Sync Pathao courier data
- `/api/sync/woocommerce` - Sync WooCommerce order data
- `/api/sync/status` - Sync status updates

## License

Private - Deen Commerce internal tool.
