import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRowOrderId,
  getOrderMonthKey,
  partitionOrdersByMonth,
  isHistoricalMonth,
  formatMonthKeyLabels,
  upsertOrderRows,
  upsertGenericRows,
  upsertDatasetSnapshot,
  getMonthKeysForDateRange,
  savePartition,
  loadPartition,
  saveOrdersToPartitions,
  loadPartitionsForDateRange,
  clearPartition,
  clearAllPartitions,
  getPartitionStoreStats
} from '@/lib/sync/partitionStore';
import { RawOrderRow, DatasetSnapshot } from '@/types';

describe('Partitioned Month Store & Upsert Merger Engine', () => {
  describe('Primary Key & Date Normalization', () => {
    it('extracts Order ID from diverse column candidate names', () => {
      expect(getRowOrderId({ orderId: '101' })).toBe('101');
      expect(getRowOrderId({ 'Order ID': '102' })).toBe('102');
      expect(getRowOrderId({ order_number: '103' })).toBe('103');
      expect(getRowOrderId({ invoice_no: '104' })).toBe('104');
      expect(getRowOrderId({ id: 105 })).toBe('105');
      expect(getRowOrderId({} as RawOrderRow)).toBe('');
    });

    it('extracts Asia/Dhaka month key correctly', () => {
      const order1 = { orderId: '1', orderDate: '2026-09-15T14:30:00+06:00' };
      const order2 = { orderId: '2', 'Order Date': '2026-10-05 10:00:00' };
      const order3 = { orderId: '3', date_created: '2026-11-01T01:00:00Z' }; // 01:00 UTC = 07:00 Dhaka on 2026-11-01

      expect(getOrderMonthKey(order1)).toBe('2026-09');
      expect(getOrderMonthKey(order2)).toBe('2026-10');
      expect(getOrderMonthKey(order3)).toBe('2026-11');
    });

    it('partitions a list of orders by month', () => {
      const orders: RawOrderRow[] = [
        { orderId: '1', orderDate: '2026-09-10' },
        { orderId: '2', orderDate: '2026-09-20' },
        { orderId: '3', orderDate: '2026-10-02' },
        { orderId: '4', orderDate: '2026-11-12' },
      ];

      const partitioned = partitionOrdersByMonth(orders);
      expect(partitioned.size).toBe(3);
      expect(partitioned.get('2026-09')?.length).toBe(2);
      expect(partitioned.get('2026-10')?.length).toBe(1);
      expect(partitioned.get('2026-11')?.length).toBe(1);
    });

    it('formats month key labels nicely', () => {
      const labels = formatMonthKeyLabels('2026-10');
      expect(labels.label).toBe('October 2026');
      expect(labels.shortLabel).toBe('Oct 2026');
      expect(labels.year).toBe(2026);
      expect(labels.month).toBe(10);
    });

    it('identifies historical closed months vs current month', () => {
      // Assuming system runs in November 2026 (per workspace context)
      expect(isHistoricalMonth('2026-08')).toBe(true);
      expect(isHistoricalMonth('2026-09')).toBe(true);
      expect(isHistoricalMonth('2026-10')).toBe(true);
      // Future or far ahead
      expect(isHistoricalMonth('2030-01')).toBe(false);
    });
  });

  describe('Upsert Merger Invariants', () => {
    it('appends new orders without modifying existing ones', () => {
      const existing: RawOrderRow[] = [
        { orderId: '101', sku: 'SKU-A', quantity: 1, itemCost: 1200, orderDate: '2026-09-01' },
        { orderId: '102', sku: 'SKU-B', quantity: 2, itemCost: 1500, orderDate: '2026-09-02' },
      ];

      const incoming: RawOrderRow[] = [
        { orderId: '103', sku: 'SKU-C', quantity: 1, itemCost: 2000, orderDate: '2026-09-03' },
      ];

      const result = upsertOrderRows(existing, incoming);
      expect(result.totalCount).toBe(3);
      expect(result.addedCount).toBe(1);
      expect(result.updatedCount).toBe(0);
      expect(result.unchangedCount).toBe(2);
      expect(result.uniqueOrdersCount).toBe(3);
      // Ordered descending by date
      expect(result.merged[0].orderId).toBe('103');
    });

    it('updates existing orders by replacing line items cleanly when order status changes', () => {
      const existing: RawOrderRow[] = [
        { orderId: '101', sku: 'SKU-A', status: 'processing', quantity: 1, orderDate: '2026-09-01' },
        { orderId: '102', sku: 'SKU-B', status: 'processing', quantity: 2, orderDate: '2026-09-02' },
      ];

      const incoming: RawOrderRow[] = [
        { orderId: '101', sku: 'SKU-A', status: 'completed', 'Delivery Status': 'Delivered', quantity: 1, orderDate: '2026-09-01' },
      ];

      const result = upsertOrderRows(existing, incoming);
      expect(result.totalCount).toBe(2);
      expect(result.addedCount).toBe(0);
      expect(result.updatedCount).toBe(1);
      expect(result.unchangedCount).toBe(1);
      expect(result.uniqueOrdersCount).toBe(2);

      const updated = result.merged.find(r => r.orderId === '101');
      expect(updated?.status).toBe('completed');
      expect(updated?.['Delivery Status']).toBe('Delivered');
    });

    it('preserves multi-item orders correctly on upsert', () => {
      const existing: RawOrderRow[] = [
        { orderId: '101', sku: 'SKU-A', quantity: 1, orderDate: '2026-09-01' },
        { orderId: '101', sku: 'SKU-B', quantity: 1, orderDate: '2026-09-01' },
        { orderId: '102', sku: 'SKU-C', quantity: 1, orderDate: '2026-09-02' },
      ];

      const incoming: RawOrderRow[] = [
        { orderId: '101', sku: 'SKU-A', quantity: 1, status: 'shipped', orderDate: '2026-09-01' },
        { orderId: '101', sku: 'SKU-B', quantity: 1, status: 'shipped', orderDate: '2026-09-01' },
      ];

      const result = upsertOrderRows(existing, incoming);
      expect(result.totalCount).toBe(3);
      expect(result.uniqueOrdersCount).toBe(2);
      expect(result.updatedCount).toBe(1);
      expect(result.unchangedCount).toBe(1); // Order 102 was unchanged
    });

    it('upserts generic courier rows by consignment ID', () => {
      const existing: RawOrderRow[] = [
        { consignment_id: 'C100', status: 'in_transit' },
        { consignment_id: 'C101', status: 'pending' },
      ];

      const incoming: RawOrderRow[] = [
        { consignment_id: 'C100', status: 'delivered' },
        { consignment_id: 'C102', status: 'in_transit' },
      ];

      const merged = upsertGenericRows(existing, incoming);
      expect(merged.length).toBe(3);
      const c100 = merged.find(r => r.consignment_id === 'C100');
      expect(c100?.status).toBe('delivered');
      const c102 = merged.find(r => r.consignment_id === 'C102');
      expect(c102?.status).toBe('in_transit');
    });

    it('merges an entire DatasetSnapshot without data loss', () => {
      const existing: DatasetSnapshot = {
        orders: [{ orderId: '101', orderDate: '2026-09-01', status: 'processing' }],
        returns: [{ consignment_id: 'R1' }],
        partials: [{ consignment_id: 'P1' }],
        exchanges: [{ orderId: 'D-101' }],
        pathaoDelivery: [{ consignment_id: 'PTH1' }],
        sourceName: 'Master Dataset'
      };

      const incoming: Partial<DatasetSnapshot> = {
        orders: [{ orderId: '102', orderDate: '2026-10-01', status: 'completed' }],
        returns: [{ consignment_id: 'R2' }],
      };

      const mergedSnapshot = upsertDatasetSnapshot(existing, incoming);
      expect(mergedSnapshot.orders.length).toBe(2);
      expect(mergedSnapshot.returns.length).toBe(2);
      expect(mergedSnapshot.partials.length).toBe(1);
      expect(mergedSnapshot.exchanges.length).toBe(1);
      expect(mergedSnapshot.pathaoDelivery?.length).toBe(1);
    });
  });

  describe('Date Range Month Resolution', () => {
    it('computes all month keys covering a date range', () => {
      expect(getMonthKeysForDateRange('2026-09-01', '2026-09-30')).toEqual(['2026-09']);
      expect(getMonthKeysForDateRange('2026-09-15', '2026-10-15')).toEqual(['2026-09', '2026-10']);
      expect(getMonthKeysForDateRange('2026-08-01', '2026-11-30')).toEqual([
        '2026-08', '2026-09', '2026-10', '2026-11'
      ]);
      expect(getMonthKeysForDateRange('2026-10-01', '2026-09-01')).toEqual([]);
    });
  });
});
