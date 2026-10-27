import { describe, it, expect } from 'vitest';
import {
  extractProductAndSize,
  computeProductAnalytics,
} from '@/lib/productAnalytics';
import { ReconciledOrderRow } from '@/types';

describe('Product Analytics Engine', () => {
  describe('extractProductAndSize', () => {
    it('correctly splits apparel titles from numeric waist sizes', () => {
      const res = extractProductAndSize('DEEN High-End Vintage Wash Jeans - Slim Fit - 34');
      expect(res.parentTitle).toBe('DEEN High-End Vintage Wash Jeans - Slim Fit');
      expect(res.size).toBe('34');
    });

    it('correctly splits garment titles from alpha letter sizes', () => {
      const res = extractProductAndSize('DEEN Off-white Sweatshirt in French-Terry - L');
      expect(res.parentTitle).toBe('DEEN Off-white Sweatshirt in French-Terry');
      expect(res.size).toBe('L');
    });

    it('correctly handles 2XL, 3XL, and Free Size', () => {
      const res2xl = extractProductAndSize('Sorbino Denim Jacket - 2XL');
      expect(res2xl.parentTitle).toBe('Sorbino Denim Jacket');
      expect(res2xl.size).toBe('2XL');

      const resFree = extractProductAndSize('DEEN Leather Belt - Free Size');
      expect(resFree.parentTitle).toBe('DEEN Leather Belt');
      expect(resFree.size).toBe('FREE SIZE');
    });

    it('handles bracketed sizes', () => {
      const res = extractProductAndSize('Oxford Cotton Shirt (XL)');
      expect(res.parentTitle).toBe('Oxford Cotton Shirt');
      expect(res.size).toBe('XL');
    });

    it('gracefully preserves item name when no size is present', () => {
      const res = extractProductAndSize('DEEN Genuine Leather Wallet');
      expect(res.parentTitle).toBe('DEEN Genuine Leather Wallet');
      expect(res.size).toBe('');
    });
  });

  describe('computeProductAnalytics', () => {
    const mockOrders: ReconciledOrderRow[] = [
      // Order 1: 2 items (Multi-item basket: Jeans + Shirt)
      {
        orderId: '1001',
        lineStatus: 'Primary Item',
        deliveryStatus: 'Delivered',
        orderCategory: 'DELIVERED',
        orderDate: new Date('2026-09-05'),
        customerName: 'Rahim Khan',
        phone: '01711111111',
        city: 'Dhaka',
        districtArea: 'Inside Dhaka',
        sku: '101-001-32',
        itemName: 'DEEN Vintage Jeans - 32',
        quantity: 1,
        itemCost: 1500,
        orderAmount: 2500,
        netRevenueImpact: 1500,
        paymentMethod: 'COD',
        hasSplitSuffix: false,
        cogsEstimate: 630,
        sipInventory: 'Central Warehouse',
      },
      {
        orderId: '1001',
        lineStatus: 'Additional Item',
        deliveryStatus: 'Delivered',
        orderCategory: 'DELIVERED',
        orderDate: new Date('2026-09-05'),
        customerName: 'Rahim Khan',
        phone: '01711111111',
        city: 'Dhaka',
        districtArea: 'Inside Dhaka',
        sku: '102-001-L',
        itemName: 'DEEN Casual Shirt - L',
        quantity: 1,
        itemCost: 1000,
        orderAmount: 2500,
        netRevenueImpact: 1000,
        paymentMethod: 'COD',
        hasSplitSuffix: false,
        cogsEstimate: 420,
        sipInventory: 'Central Warehouse',
      },
      // Order 2: Same pair (Jeans at discounted price 1200 + Shirt)
      {
        orderId: '1002',
        lineStatus: 'Primary Item',
        deliveryStatus: 'Delivered',
        orderCategory: 'DELIVERED',
        orderDate: new Date('2026-09-10'),
        customerName: 'Karim Ullah',
        phone: '01722222222',
        city: 'Chittagong',
        districtArea: 'Outside Dhaka',
        sku: '101-001-34',
        itemName: 'DEEN Vintage Jeans - 34',
        quantity: 1,
        itemCost: 1200, // Sold at discount
        orderAmount: 2200,
        netRevenueImpact: 1200,
        paymentMethod: 'bKash',
        hasSplitSuffix: false,
        cogsEstimate: 504,
        sipInventory: 'Mirpur Outlet',
      },
      {
        orderId: '1002',
        lineStatus: 'Additional Item',
        deliveryStatus: 'Delivered',
        orderCategory: 'DELIVERED',
        orderDate: new Date('2026-09-10'),
        customerName: 'Karim Ullah',
        phone: '01722222222',
        city: 'Chittagong',
        districtArea: 'Outside Dhaka',
        sku: '102-001-M',
        itemName: 'DEEN Casual Shirt - M',
        quantity: 1,
        itemCost: 1000,
        orderAmount: 2200,
        netRevenueImpact: 1000,
        paymentMethod: 'bKash',
        hasSplitSuffix: false,
        cogsEstimate: 420,
        sipInventory: 'Mirpur Outlet',
      },
      // Order 3: Jeans full return
      {
        orderId: '1003',
        lineStatus: 'Primary Item',
        deliveryStatus: 'Returned',
        orderCategory: 'FULL_RETURN',
        orderDate: new Date('2026-09-15'),
        customerName: 'Sakib Ahmed',
        phone: '01733333333',
        city: 'Sylhet',
        districtArea: 'Outside Dhaka',
        sku: '101-001-34',
        itemName: 'DEEN Vintage Jeans - 34',
        quantity: 1,
        itemCost: 1500,
        orderAmount: 1590,
        netRevenueImpact: 0,
        paymentMethod: 'COD',
        hasSplitSuffix: false,
        cogsEstimate: 0,
        sipInventory: 'Sylhet Branch',
      },
      // Order 4: Single low volume product
      {
        orderId: '1004',
        lineStatus: 'Primary Item',
        deliveryStatus: 'Delivered',
        orderCategory: 'DELIVERED',
        orderDate: new Date('2026-09-20'),
        customerName: 'Tanvir Hossain',
        phone: '01744444444',
        city: 'Dhaka',
        districtArea: 'Inside Dhaka',
        sku: '115-001-XL',
        itemName: 'Leather Jacket - XL',
        quantity: 1,
        itemCost: 4500,
        orderAmount: 4550,
        netRevenueImpact: 4500,
        paymentMethod: 'COD',
        hasSplitSuffix: false,
        cogsEstimate: 1890,
        sipInventory: 'Central Warehouse',
      },
    ];

    it('correctly aggregates parent products and detects MRP and price points', () => {
      const result = computeProductAnalytics(mockOrders, { cogsPercent: 42, dateScopeDays: 30 });
      expect(result.products.length).toBe(3);

      const jeans = result.products.find(p => p.title === 'DEEN Vintage Jeans')!;
      expect(jeans).toBeDefined();
      expect(jeans.mrp).toBe(1500);
      expect(jeans.minPrice).toBe(1200);
      expect(jeans.totalGrossUnits).toBe(3);
      expect(jeans.totalDeliveredUnits).toBe(2);
      expect(jeans.totalReturnedUnits).toBe(1);
      expect(jeans.returnRate).toBeCloseTo(33.3, 1);
      expect(jeans.deliveredRevenue).toBe(2700); // 1500 + 1200

      // Price points
      expect(jeans.pricePoints.length).toBe(2);
      const p1500 = jeans.pricePoints.find(pp => pp.price === 1500)!;
      const p1200 = jeans.pricePoints.find(pp => pp.price === 1200)!;
      expect(p1500.discountPercent).toBe(0);
      expect(p1200.discountPercent).toBe(20); // (1500 - 1200) / 1500 = 20%
    });

    it('correctly executes Market Basket Analysis with Apriori Lift and Support', () => {
      const result = computeProductAnalytics(mockOrders);
      expect(result.summary.multiItemOrdersCount).toBe(2);
      expect(result.summary.totalOrdersCount).toBe(4);
      expect(result.summary.multiItemOrderRate).toBe(50); // 2 out of 4 = 50%

      // Pair DEEN Vintage Jeans & DEEN Casual Shirt occurred in 2 orders
      const pair = result.marketBasketPairs.find(
        p => (p.itemA === 'DEEN Vintage Jeans' && p.itemB === 'DEEN Casual Shirt') ||
             (p.itemB === 'DEEN Vintage Jeans' && p.itemA === 'DEEN Casual Shirt')
      );
      expect(pair).toBeDefined();
      expect(pair!.pairOrders).toBe(2);
      expect(pair!.support).toBe(50); // 2 / 4 = 50%
      expect(pair!.lift).toBeGreaterThan(1); // Positive association
    });

    it('correctly assigns ABC Pareto categories', () => {
      const result = computeProductAnalytics(mockOrders);
      // Revenue order: Leather Jacket (4500), DEEN Vintage Jeans (2700), DEEN Casual Shirt (2000)
      // Total delivered revenue = 9200
      // Leather Jacket (4500 / 9200 = 48.9%) -> Class A
      // Vintage Jeans (2700 -> cumulative 7200 / 9200 = 78.3%) -> Class A
      // Casual Shirt (2000 -> cumulative 9200 / 9200 = 100%) -> Class B or C
      const jacket = result.products.find(p => p.title === 'Leather Jacket')!;
      expect(jacket.abcCategory).toBe('A');
    });

    it('tracks size distribution and return rate per size', () => {
      const result = computeProductAnalytics(mockOrders);
      const jeans = result.products.find(p => p.title === 'DEEN Vintage Jeans')!;
      const sz34 = jeans.sizes.find(s => s.size === '34')!;
      const sz32 = jeans.sizes.find(s => s.size === '32')!;

      expect(sz34.grossUnits).toBe(2);
      expect(sz34.returnedUnits).toBe(1);
      expect(sz34.returnRate).toBe(50); // 1 out of 2 returned

      expect(sz32.grossUnits).toBe(1);
      expect(sz32.returnedUnits).toBe(0);
      expect(sz32.returnRate).toBe(0);
    });

    it('handles empty orders gracefully', () => {
      const result = computeProductAnalytics([]);
      expect(result.products).toEqual([]);
      expect(result.summary.totalProducts).toBe(0);
      expect(result.summary.totalOrdersCount).toBe(0);
    });
  });
});
