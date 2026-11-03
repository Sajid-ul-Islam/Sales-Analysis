# Technical Requirements Document (TRD): DEEN Commerce

## DEEN Commerce — Sales & Return Reconciliation Engine

**Version:** 2.4.0  
**Stack:** Next.js 14.2 (App Router) · React 18 · TypeScript 5.6 · Tailwind CSS 3.4 · AlaSQL 4.21 · SheetJS 0.20 · Google GenAI SDK 2.29  
**Runtime:** Node.js 18+ (Vercel Serverless / Edge & Docker Alpine compatible)  
**Last Updated:** November 2026  

---

## 1. System Architecture & Component Graph

The **DEEN Commerce Reconciliation Engine** is implemented as a client-first, zero-latency analytical web application with serverless edge API proxy routes.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT BROWSER                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │   UI Shell & Analysis Views (React 18 / Tailwind CSS)                 │  │
│  │   - Executive Overview       - Live Ops Terminal     - Outlet Dispatch│  │
│  │   - Status Matrix            - SKU Performance       - Item Returns   │  │
│  │   - Courier Mismatch Audit   - Territory Breakdown   - Customer Risk  │  │
│  │   - Unit Economics           - Exchanged Orders Hub  - Orders Ledger  │  │
│  │   - Outlet Sales (POS)       - Monthly Statements    - Campaign Intel │  │
│  │   - System Settings & Theme Manager (SettingsTab.tsx)                 │  │
│  └───────────────────────────────────▲───────────────────────────────────┘  │
│                                      │                                      │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │   Reconciliation Engine Core (src/lib/)                               │  │
│  │   - Knapsack DP Solver (subsetSum.ts)                                 │  │
│  │   - Discrepancy Auditor (discrepancyAuditor.ts)                       │  │
│  │   - Reconciler & Geo Engine (reconciliationEngine.ts, geo.ts)         │  │
│  │   - Multi-Sheet Export Engine (excelExport.ts)                        │  │
│  │   - Dynamic Theme Manager (themeManager.ts)                           │  │
│  │   - Local Override State Store (overrideStore.ts)                     │  │
│  │   - Campaign Attribution Engine (campaignEngine.ts)                   │  │
│  │   - Date Filter & Calendar Boundaries (dateFilter.ts)                 │  │
│  └───────────────────▲───────────────────────────────────▲───────────────┘  │
│                      │                                   │                  │
│                      │ In-Memory AlaSQL                  │ IndexedDB / Local│
│                      │ Relational Cache                  │ State Storage    │
└──────────────────────┼───────────────────────────────────┼──────────────────┘
                       │ Local XLSX / CSV Dropzone         │ JSON Payloads
                       │ Pipeline                          │
┌──────────────────────┴───────────────────────────────────┴──────────────────┐
│                         NEXT.JS APP ROUTER API LAYER                        │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────┐  │
│  │ /api/sync/woocommerce │ │   /api/sync/pathao    │ │ /api/sample-data  │  │
│  │ (WooCommerce v3 REST) │ │  (Pathao Hermes API)  │ │ (Offline Ready)   │  │
│  └───────────▲───────────┘ └───────────▲───────────┘ └───────────────────┘  │
│              │                         │                                    │
│  ┌───────────┴───────────┐ ┌───────────┴───────────┐ ┌───────────────────┐  │
│  │    /api/sync/status   │ │    /api/campaigns     │ │   /api/ai/query   │  │
│  │ (Health & Telemetry)  │ │ (Ad Spend & Tracking) │ │ (Gemini Copilot)  │  │
│  └───────────────────────┘ └───────────────────────┘ └───────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core TypeScript Contracts & Data Models

### 2.1 The Master Reconciled Order (`src/types/index.ts`)
```typescript
export type DeliveryStatus = 
  | 'Delivered' 
  | 'Paid Return' 
  | 'Return' 
  | 'Partial' 
  | 'Exchanged' 
  | 'In-Transit';

export interface ReconciledOrder {
  id: number | string;
  orderNumber: string;
  orderPrefix?: string; // e.g. "D-" or "DD-"
  orderSuffix?: string; // e.g. "c", "w", "s", "m"
  customerName: string;
  phone: string;
  city: string;
  territory: 'Inside Dhaka' | 'Outside Dhaka';
  channel: 'Online Store' | 'Mirpur POS' | 'Cumilla Branch' | 'Wari Branch' | 'Sylhet Branch';
  isPos: boolean;
  isOrderOnline: boolean;
  status: DeliveryStatus;
  
  // Financial breakdown
  orderTotal: number;
  customerShippingFee: number;
  courierChargedFee: number;
  codCollectedAmount: number;
  netRecognizedRevenue: number;
  returnLossAmount: number;
  packagingLossAmount: number; // Fixed 25 BDT for returns/partials
  
  // Consignment & Delivery
  consignmentId?: string;
  courierName: 'Pathao';
  customerRating?: '🌟 Excellent' | '👍 Good' | '⚖️ Moderate' | '⚠️ High Risk' | '🌱 New Buyer';
  
  // Line items
  lineItems: ReconciledLineItem[];
  dateCreated: string;
  dateModified?: string;
}

export interface ReconciledLineItem {
  id: number;
  sku: string;
  name: string;
  category: 'Polo' | 'Oxford Shirt' | 'Outerwear' | 'Trousers' | 'Panjabi' | 'Other';
  quantity: number;
  unitPrice: number;
  deliveredQty: number; // MUST BE INTEGER
  returnedQty: number;  // MUST BE INTEGER
  itemStatus: 'Delivered' | 'Returned';
}
```

---

## 3. Algorithmic Specifications

### 3.1 0/1 Knapsack Subset-Sum DP Solver (`src/lib/subsetSum.ts`)
```typescript
export function findSubsetSum(
  items: { id: number; price: number; qty: number }[],
  targetSum: number
): { deliveredItemIds: Set<number>; success: boolean } {
  // 1. Expand items into unit instances
  const unitList: { id: number; price: number }[] = [];
  for (const item of items) {
    for (let q = 0; q < item.qty; q++) {
      unitList.push({ id: item.id, price: item.price });
    }
  }

  const n = unitList.length;
  // DP table: dp[i][w] = boolean
  const dp: boolean[][] = Array.from({ length: n + 1 }, () => 
    new Array(targetSum + 1).fill(false)
  );
  
  for (let i = 0; i <= n; i++) dp[i][0] = true;

  for (let i = 1; i <= n; i++) {
    const val = unitList[i - 1].price;
    for (let w = 1; w <= targetSum; w++) {
      if (val <= w) {
        dp[i][w] = dp[i - 1][w] || dp[i - 1][w - val];
      } else {
        dp[i][w] = dp[i - 1][w];
      }
    }
  }

  if (!dp[n][targetSum]) {
    return { deliveredItemIds: new Set(), success: false };
  }

  // Backtrack to find exact delivered item instances
  let currentTarget = targetSum;
  const deliveredIndices = new Set<number>();
  for (let i = n; i > 0 && currentTarget > 0; i--) {
    if (!dp[i - 1][currentTarget]) {
      deliveredIndices.add(i - 1);
      currentTarget -= unitList[i - 1].price;
    }
  }

  const deliveredItemIds = new Set<number>();
  deliveredIndices.forEach(idx => deliveredItemIds.add(unitList[idx].id));

  return { deliveredItemIds, success: true };
}
```

---

## 4. State Management & Storage Architecture

1. **`settingsStore.ts`**:
   - Manages active theme preset (`super-white`, `slate-subtle`, `zinc-cool`, `cream-warm`, `dark-canvas`).
   - Stores encrypted Pathao API client credentials and WooCommerce keys in browser `localStorage`.
   - Exports configuration JSON and handles file imports.
2. **`overrideStore.ts`**:
   - Stores manual reconciliation status overrides indexed by order ID.
3. **`campaignStore.ts`**:
   - Manages marketing ad spend records for attribution calculation.

---

## 5. Non-Functional & Performance Budgets

- **First Contentful Paint (FCP):** $<0.8\text{s}$ on 3G.
- **Client Search & Filter Latency:** $<15\text{ms}$ for 20,000 orders using AlaSQL in-memory indexing.
- **TypeScript Strictness:** Zero implicit `any`, zero unhandled null assertions.
- **Max Bundle Size:** $<250\text{KB}$ gzip for initial entrypoint.
