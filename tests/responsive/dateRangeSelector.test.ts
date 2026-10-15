import { describe, it, expect } from 'vitest';
import {
  filterOrdersByDateScope,
  getScopeRange,
  analyzeDates,
  computeFileWeeks,
  comparePeriods,
  DateScope
} from '@/lib/dateFilter';
import { RawOrderRow } from '@/types';

describe('Smart Date Range & Scope Engine', () => {
  const sampleOrders: RawOrderRow[] = [
    { orderId: '1001', orderDate: '2026-10-01', orderAmount: 1500, deliveryStatus: 'Delivered' },
    { orderId: '1002', orderDate: '2026-10-05', orderAmount: 2200, deliveryStatus: 'Delivered' },
    { orderId: '1003', orderDate: '2026-10-10', orderAmount: 1800, deliveryStatus: 'Returned' },
    { orderId: '1004', orderDate: '2026-10-14', orderAmount: 3100, deliveryStatus: 'Delivered' },
    { orderId: '1005', orderDate: '2026-08-15', orderAmount: 1200, deliveryStatus: 'Delivered' }, // 2 months older
  ];

  it('defaults to 30d (Last 30 Days) for efficient bounded initial load', () => {
    const result = filterOrdersByDateScope(sampleOrders);
    expect(result.scope).toBe('30d');
    expect(result.label).toBe('Last 30 Days');
    // Orders from Oct 1-14 should be included in 30d from Oct 14 anchor
    expect(result.matchedOrders).toBe(4);
    // Aug 15 order is beyond 30 days and should be filtered out
    expect(result.filteredOrders.some(o => o.orderId === '1005')).toBe(false);
  });

  it('calculates exact 30-day window relative to dataset anchor day', () => {
    const analysis = analyzeDates(sampleOrders);
    const range = getScopeRange('30d', analysis);
    expect(range.label).toBe('Last 30 Days');
    expect(range.endMs - range.startMs).toBe(30 * 86400000);
  });

  it('provides correct counts for all preset scopes', () => {
    const result = filterOrdersByDateScope(sampleOrders, 'all');
    expect(result.counts.all).toBe(5);
    expect(result.counts['30d']).toBe(4);
    expect(result.counts['7d']).toBeGreaterThanOrEqual(1);
  });

  it('partitions orders into dynamic consecutive 7-day file weeks', () => {
    const analysis = analyzeDates(sampleOrders);
    const weeks = computeFileWeeks(sampleOrders, analysis);
    expect(weeks.length).toBeGreaterThan(0);
    expect(weeks[0].id).toBe('week-1');
    expect(weeks[0].startDate).toBeDefined();
    expect(weeks[0].endDate).toBeDefined();
  });

  it('accurately compares two operational periods (Week-over-Week / Period-over-Period)', () => {
    const analysis = analyzeDates(sampleOrders);
    const range30d = getScopeRange('30d', analysis);
    const range7d = getScopeRange('7d', analysis);

    const comparison = comparePeriods(
      sampleOrders,
      { startMs: range7d.startMs, endMs: range7d.endMs, label: 'Last 7 Days' },
      { startMs: range30d.startMs, endMs: range30d.endMs, label: 'Last 30 Days' }
    );

    expect(comparison.periodA.label).toBe('Last 7 Days');
    expect(comparison.periodB.label).toBe('Last 30 Days');
    expect(comparison.deltas).toBeDefined();
    expect(typeof comparison.deltas.ordersDelta).toBe('number');
  });
});
