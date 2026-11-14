# DEEN Commerce Reconciliation Engine — Data Synchronization & Partitioning Architecture

**Version:** 3.0.0  
**Status:** Production Standard  
**Last Updated:** November 2026  
**Module:** `src/lib/sync/partitionStore.ts`, `src/components/CloudSyncBar.tsx`, `src/app/page.tsx`  

---

## 1. Executive Summary & Purpose

In multi-channel apparel operations across Bangladesh (WooCommerce online store + 4 nationwide retail outlets in Mirpur, Cumilla, Wari, and Sylhet + Pathao Hermes courier logistics), sales orders accumulate at 3,000–5,000+ orders per month.

Historically, naive sync approaches suffered from three severe bottlenecks:
1. **The "Big Chunk" Memory Exhaustion**: Fetching 10,000+ historical orders in one single HTTP call required dozens of paginated WordPress API calls, risking HTTP 504 timeouts and crashing cloud containers (e.g., Render 512MB RAM free/starter tier).
2. **The "Full Replace" Destruction Anti-Pattern**: Syncing a small date window (e.g. "Last 7 Days" or "October 2026") would overwrite the in-memory array, accidentally wiping out previously loaded historical months (September baseline).
3. **Repeated Fetch Latency**: Switching between months in the dashboard UI forced users to wait 15–30 seconds for external API requests every time.

The **Partitioned Month Store & Upsert Merger Engine** solves all three problems completely.

---

## 2. 4-Tier Synchronization & Storage Model

```
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 1: Client-Side Partitioned Store (IndexedDB by Month YYYY-MM)      │
│  - deen_partition_orders_2026_09 (Historical closed, 30d/permanent TTL)│
│  - deen_partition_orders_2026_10 (Historical closed, 30d/permanent TTL)│
│  - deen_partition_orders_2026_11 (Active MTD, 2h TTL)                  │
│  - deen_partition_catalog_v1 (Metadata, order counts, byte estimates)  │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ (Loads in <15ms)
┌───────────────────────────────────┴────────────────────────────────────┐
│ Tier 2: On-Demand Date-Window API with Sparse Projection (_fields)     │
│  - Query: /api/sync/woocommerce?after=2026-10-01&before=2026-10-31      │
│  - Strips 70% of WooCommerce bloat on server before wire transfer      │
│  - HTTP 304 ETag caching: 0 bytes transferred if unchanged             │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ (Upserts delta rows)
┌───────────────────────────────────┴────────────────────────────────────┐
│ Tier 3: In-Memory AlaSQL Indexing for Filter-Wise Slicing (<5ms)       │
│  - Table: orders [id, date, outlet_id, status, payment, category, sku] │
│  - Instant sub-millisecond filtering across 15,000+ rows in RAM        │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ (Real-time delta updates)
┌───────────────────────────────────┴────────────────────────────────────┐
│ Tier 4: Zero-Polling Push Engine (Webhooks + Server-Sent Events)       │
│  - WooCommerce / Pathao Webhooks -> sync-events.jsonl                  │
│  - EventSource (/api/sync/events/stream) patches single rows in RAM    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Primitives & Invariants

### 3.1 Primary Key Resolution (`getRowOrderId`)
All rows (whether from Excel uploads or WooCommerce REST payloads) resolve their Order ID dynamically via:
```typescript
const candidates = [
  'orderId', 'order_id', 'Order ID', 'orderID', 'oid',
  'id', 'orderNumber', 'order_number', 'Order Number',
  'invoice', 'invoice_no', 'Invoice No', 'Invoice'
];
```

### 3.2 Non-Destructive Upsert Merger (`upsertOrderRows`)
Located in `src/lib/sync/partitionStore.ts`:
- **Order-Atomic Merging**: When updated rows for order `#17263` arrive, its existing line items are replaced with the incoming line items.
- **Historical Preservation**: All other orders (from September, October, or previous days) remain 100% untouched.
- **Deterministic Sort**: The merged array is sorted by `Order Date` descending, then `Order ID` descending.
- **Integer Quantity Invariant**: Sunk costs, returned quantities, and delivered quantities are guaranteed to remain strict integers ($1, 2, 3$).

### 3.3 Partitioning by Month (`partitionOrdersByMonth`)
Every order row is assigned a partition key (`YYYY-MM`) strictly in **Asia/Dhaka time (`+06:00`)**:
- Example: `2026-09`, `2026-10`, `2026-11`.
- Historical closed months (any month older than current month) receive an adaptive TTL of **30 days to permanent**.
- The active current month receives an adaptive TTL of **2 hours**.
- Volatile daily data receives an adaptive TTL of **15 minutes**.

---

## 4. Developer & Agent Operational Recipes

### Recipe 1: How to sync an on-demand date range without wiping memory
```typescript
import { upsertOrderRows, saveOrdersToPartitions } from '@/lib/sync/partitionStore';

// 1. Fetch the date window from the server
const res = await fetch('/api/sync/woocommerce', {
  method: 'POST',
  headers: getClientAuthHeaders(),
  body: JSON.stringify({
    after: '2026-10-01T00:00:00',
    before: '2026-10-31T23:59:59',
    perPage: 100,
  }),
});
const data = await res.json();

// 2. Non-destructively merge into active in-memory orders
const { merged, addedCount, updatedCount } = upsertOrderRows(existingOrders, data.orders);

// 3. Persist the incoming batch into monthly IndexedDB partitions in background
await saveOrdersToPartitions(data.orders);
```

### Recipe 2: Instant 0ms Load from Local Partition Store
```typescript
import { loadPartitionsForDateRange } from '@/lib/sync/partitionStore';

// When user selects "October 2026" or a custom range:
const partitionRes = await loadPartitionsForDateRange('2026-10-01', '2026-10-31');

if (partitionRes.allMonthsCovered && partitionRes.rows.length > 0) {
  // 0ms load! No network calls made to WooCommerce.
  console.log(`Loaded ${partitionRes.rows.length} orders from cache:`, partitionRes.matchedMonths);
} else {
  // Some or all months are missing -> trigger server fetch
}
```

### Recipe 3: Filter-Wise Data Slicing (<5ms in RAM)
Once orders are merged into the master pool, tab filtering runs directly against in-memory arrays via `src/lib/dateFilter.ts`:
```typescript
import { filterOrdersByDateScope } from '@/lib/dateFilter';

// Slices master pool into the requested date window in <3ms
const { filteredOrders, matchedOrders } = filterOrdersByDateScope(masterOrders, 'custom', {
  startDate: '2026-10-01',
  endDate: '2026-10-31',
});

// Filter by Outlet Branch (Mirpur, Cumilla, Wari, Sylhet, Online)
const mirpurOrders = filteredOrders.filter(r => r.fulfillmentBranch === 'Mirpur Outlet');

// Filter by Delivery Status
const deliveredOrders = filteredOrders.filter(r => r['Delivery Status'] === 'Delivered');
```

---

## 5. File Map

| Path | Purpose |
|---|---|
| `src/lib/sync/partitionStore.ts` | Core partition store, IndexedDB catalog, and upsert merger logic |
| `src/lib/dateFilter.ts` | Dhaka timezone-aligned date scopes and fast array filtering |
| `src/components/CloudSyncBar.tsx` | Cloud sync toolbar with partition diagnostics & cache bypass |
| `src/components/DateRangeSelector.tsx` | Date selector with 1-click month presets & comparison modal |
| `src/app/page.tsx` | Root reconciliation state coordinator and live sync upsert handler |
| `tests/sync/partitionStore.test.ts` | Vitest unit tests for primary key, month keys, and upsert logic |
| `tests/sync/partitionIntegration.test.ts` | End-to-end integration tests for multi-month merging & filtering |
