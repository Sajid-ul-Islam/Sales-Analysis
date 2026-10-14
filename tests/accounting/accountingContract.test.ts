import { describe, it, expect } from 'vitest';
import {
  assertNoDoubleCounting,
  assertDeliveryFeeBalance,
  assertWholeIntegerQuantities,
  validateUnitEconomics,
} from '@/lib/accounting/accountingContract';

describe('Accounting Contract & Financial Mathematical Invariants', () => {
  describe('Invariant 1: No Double-Counting on Multi-Item Orders', () => {
    it('detects when row-level naive aggregation inflates multi-item order totals', () => {
      // 1 order with 3 line items, order total is 3000 BDT
      const multiItemRows = [
        { 'Order ID': '101', 'Order Amount': 3000, SKU: 'ITEM-A', Quantity: 1, 'Item Cost': 1000 },
        { 'Order ID': '101', 'Order Amount': 3000, SKU: 'ITEM-B', Quantity: 1, 'Item Cost': 1000 },
        { 'Order ID': '101', 'Order Amount': 3000, SKU: 'ITEM-C', Quantity: 1, 'Item Cost': 1000 },
      ];

      const audit = assertNoDoubleCounting(multiItemRows);
      expect(audit.uniqueOrderCount).toBe(1);
      expect(audit.totalLineItemsCount).toBe(3);
      expect(audit.deduplicatedTotalGMV).toBe(3000);
      expect(audit.naiveSummedGMV).toBe(9000); // 3x double-counting inflation
      expect(audit.inflationDelta).toBe(6000);
      expect(audit.inflationPercentage).toBe(200);
      expect(audit.isValid).toBe(false);
    });

    it('validates single-item orders where naive sum equals deduplicated total', () => {
      const singleItemRows = [
        { 'Order ID': '101', 'Order Amount': 1500, SKU: 'ITEM-A', Quantity: 1 },
        { 'Order ID': '102', 'Order Amount': 2000, SKU: 'ITEM-B', Quantity: 1 },
      ];

      const audit = assertNoDoubleCounting(singleItemRows);
      expect(audit.deduplicatedTotalGMV).toBe(3500);
      expect(audit.naiveSummedGMV).toBe(3500);
      expect(audit.inflationDelta).toBe(0);
      expect(audit.isValid).toBe(true);
    });
  });

  describe('Invariant 2: COD Delivery Fee Conservation', () => {
    it('verifies exact COD balance when collected amount equals kept items plus delivery fee', () => {
      const balance = assertDeliveryFeeBalance({
        collectedCod: 1540,
        keptMerchandiseValue: 1450,
        deliveryFee: 90, // Outside Dhaka
      });

      expect(balance.isBalanced).toBe(true);
      expect(balance.expectedCod).toBe(1540);
      expect(balance.deviation).toBe(0);
    });

    it('flags imbalance when collected COD deviates by more than tolerance', () => {
      const balance = assertDeliveryFeeBalance({
        collectedCod: 1300,
        keptMerchandiseValue: 1450,
        deliveryFee: 90,
        tolerance: 2.0,
      });

      expect(balance.isBalanced).toBe(false);
      expect(balance.deviation).toBe(240);
    });
  });

  describe('Invariant 3: Whole Integer Quantities', () => {
    it('approves discrete non-negative integer assignments', () => {
      const validAssignments = [
        { totalQty: 3, keptQty: 2, returnedQty: 1 },
        { totalQty: 1, keptQty: 1, returnedQty: 0 },
        { totalQty: 2, keptQty: 0, returnedQty: 2 },
      ];

      const res = assertWholeIntegerQuantities(validAssignments);
      expect(res.isValid).toBe(true);
      expect(res.violations.length).toBe(0);
    });

    it('rejects forbidden float quantities such as 0.5', () => {
      const invalidAssignments = [
        { totalQty: 1, keptQty: 0.5, returnedQty: 0.5 },
      ];

      const res = assertWholeIntegerQuantities(invalidAssignments);
      expect(res.isValid).toBe(false);
      expect(res.violations.length).toBe(1);
    });
  });

  describe('Invariant 4: Unit Economics Formulas & Contribution Margin', () => {
    it('computes CM2, CM3, COGS ratio, and packaging loss correctly', () => {
      const res = validateUnitEconomics({
        realizedNetSales: 100000,
        cogsAmount: 43000, // 43% COGS
        netCourierBurden: 8000,
        returnedOrPartialOrderCount: 40,
        packagingUnitCost: 25, // ৳25 sunk loss
        metaAdSpend: 20000,
      });

      expect(res.grossProductMargin).toBe(57000); // 100k - 43k
      expect(res.packagingLossTotal).toBe(1000); // 40 * 25
      expect(res.cm2).toBe(48000); // 57000 - 8000 - 1000
      expect(res.cm3).toBe(28000); // 48000 - 20000
      expect(res.cogsRatioPercent).toBe(43);
      expect(res.isCogsInExpectedRange).toBe(true);
      expect(res.roas).toBe(5); // 100k / 20k
    });
  });
});
