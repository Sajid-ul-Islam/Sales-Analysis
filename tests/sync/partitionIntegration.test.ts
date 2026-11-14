import { describe, it, expect } from 'vitest';
import {
  upsertOrderRows,
  partitionOrdersByMonth,
  getMonthKeysForDateRange,
  upsertDatasetSnapshot,
} from '@/lib/sync/partitionStore';
import { filterOrdersByDateScope } from '@/lib/dateFilter';
import { RawOrderRow, DatasetSnapshot } from '@/types';

describe('Partitioned Store & Upsert Integration Verification', () => {
  it('prevents historical month wipeout when syncing a new date range', () => {
    // 1. Initial State: September baseline with 50 orders
    const septemberOrders: RawOrderRow[] = Array.from({ length: 50 }, (_, i) => ({
      orderId: `SEP-${1000 + i}`,
      'Order Date': `2026-09-${String((i % 28) + 1).padStart(2, '0')} 12:00:00`,
      status: 'completed',
      'Delivery Status': 'Delivered',
      quantity: 1,
      itemCost: 1500,
      sku: `SKU-SEP-${i}`,
      fulfillmentBranch: 'Online Store',
    }));

    // 2. User syncs October orders (20 orders)
    const octoberOrders: RawOrderRow[] = Array.from({ length: 20 }, (_, i) => ({
      orderId: `OCT-${2000 + i}`,
      'Order Date': `2026-10-${String((i % 28) + 1).padStart(2, '0')} 14:00:00`,
      status: 'processing',
      'Delivery Status': 'In Transit',
      quantity: 1,
      itemCost: 1800,
      sku: `SKU-OCT-${i}`,
      fulfillmentBranch: i % 2 === 0 ? 'Mirpur Outlet' : 'Online Store',
    }));

    // 3. Perform Upsert Merge
    const upsertResult = upsertOrderRows(septemberOrders, octoberOrders);

    // Invariant: Total orders MUST be 70 (neither September nor October was deleted)
    expect(upsertResult.totalCount).toBe(70);
    expect(upsertResult.addedCount).toBe(20);
    expect(upsertResult.updatedCount).toBe(0);
    expect(upsertResult.unchangedCount).toBe(50);
    expect(upsertResult.uniqueOrdersCount).toBe(70);

    // 4. Test Filter-Wise Data Slicing on the combined dataset
    // A. Filter: September only
    const sepFiltered = filterOrdersByDateScope(upsertResult.merged, 'custom', {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });
    expect(sepFiltered.matchedOrders).toBe(50);

    // B. Filter: October only
    const octFiltered = filterOrdersByDateScope(upsertResult.merged, 'custom', {
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });
    expect(octFiltered.matchedOrders).toBe(20);

    // C. Filter: Mirpur Outlet in October
    const mirpurInOct = octFiltered.filteredOrders.filter(
      r => r.fulfillmentBranch === 'Mirpur Outlet'
    );
    expect(mirpurInOct.length).toBe(10);
  });

  it('updates order status in place without duplicating rows when live sync receives order updates', () => {
    const existingOrders: RawOrderRow[] = [
      { orderId: '17263', 'Order Date': '2026-10-15', status: 'processing', 'Delivery Status': 'In Transit', quantity: 2, itemCost: 1200 },
      { orderId: '17264', 'Order Date': '2026-10-16', status: 'processing', 'Delivery Status': 'In Transit', quantity: 1, itemCost: 1500 },
    ];

    // Status update from courier/webhook: 17263 is now Delivered
    const incomingUpdate: RawOrderRow[] = [
      { orderId: '17263', 'Order Date': '2026-10-15', status: 'completed', 'Delivery Status': 'Delivered', quantity: 2, itemCost: 1200 },
    ];

    const result = upsertOrderRows(existingOrders, incomingUpdate);

    expect(result.totalCount).toBe(2); // Still 2 rows, not 3!
    expect(result.updatedCount).toBe(1);
    expect(result.addedCount).toBe(0);

    const order17263 = result.merged.find(r => r.orderId === '17263');
    expect(order17263?.status).toBe('completed');
    expect(order17263?.['Delivery Status']).toBe('Delivered');
  });

  it('correctly partitions multi-month data and computes month keys for arbitrary ranges', () => {
    const orders: RawOrderRow[] = [
      { orderId: 'O1', 'Order Date': '2026-08-15' },
      { orderId: 'O2', 'Order Date': '2026-09-10' },
      { orderId: 'O3', 'Order Date': '2026-10-22' },
      { orderId: 'O4', 'Order Date': '2026-11-05' },
    ];

    const partitions = partitionOrdersByMonth(orders);
    expect(Array.from(partitions.keys()).sort()).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);

    const requestedKeys = getMonthKeysForDateRange('2026-09-01', '2026-10-31');
    expect(requestedKeys).toEqual(['2026-09', '2026-10']);
  });
});
