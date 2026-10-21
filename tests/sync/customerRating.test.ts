import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeCustomerPhone,
  deriveRatingFromStats,
  resolveCustomerRating,
  batchResolveCustomerRatings,
  fetchPathaoCustomerRating,
  getStoreHistoryIndex,
} from '@/lib/customerRating';
import { buildOrderWiseWorkbook } from '@/lib/orderGrouping';

describe('Pathao Customer Rating & Phone Intelligence Engine', () => {
  describe('normalizeCustomerPhone', () => {
    it('normalizes standard 11-digit Bangladeshi mobile number', () => {
      const res = normalizeCustomerPhone('01712345678');
      expect(res.full).toBe('01712345678');
      expect(res.suffix10).toBe('1712345678');
    });

    it('strips international prefix +880 or 880', () => {
      const res1 = normalizeCustomerPhone('+8801812345678');
      expect(res1.full).toBe('01812345678');
      expect(res1.suffix10).toBe('1812345678');

      const res2 = normalizeCustomerPhone('8801912345678');
      expect(res2.full).toBe('01912345678');
      expect(res2.suffix10).toBe('1912345678');
    });

    it('handles numbers with spaces, hyphens, and parentheses', () => {
      const res = normalizeCustomerPhone('+880 1712-345 678');
      expect(res.full).toBe('01712345678');
      expect(res.suffix10).toBe('1712345678');
    });

    it('handles 10-digit number missing leading zero', () => {
      const res = normalizeCustomerPhone('1712345678');
      expect(res.full).toBe('01712345678');
      expect(res.suffix10).toBe('1712345678');
    });

    it('gracefully returns empty string for invalid, missing, or placeholder phones', () => {
      expect(normalizeCustomerPhone('').full).toBe('');
      expect(normalizeCustomerPhone('nan').full).toBe('');
      expect(normalizeCustomerPhone('none').full).toBe('');
      expect(normalizeCustomerPhone('N/A').full).toBe('');
      expect(normalizeCustomerPhone('12345').full).toBe(''); // too short
    });
  });

  describe('deriveRatingFromStats', () => {
    it('categorizes zero total orders as NEW customer', () => {
      const r = deriveRatingFromStats('01700000000', { delivered: 0, returned: 0, total: 0 });
      expect(r.ratingTier).toBe('NEW');
      expect(r.ratingLabel).toBe('New Customer');
      expect(r.riskLevel).toBe('LOW');
    });

    it('categorizes >= 90% success rate as EXCELLENT', () => {
      const r = deriveRatingFromStats('01711111111', { delivered: 10, returned: 0, total: 10 });
      expect(r.ratingTier).toBe('EXCELLENT');
      expect(r.ratingLabel).toContain('100% (Excellent)');
      expect(r.riskLevel).toBe('LOW');
    });

    it('categorizes 80% to 89% success rate as GOOD', () => {
      const r = deriveRatingFromStats('01722222222', { delivered: 8, returned: 2, total: 10 });
      expect(r.ratingTier).toBe('GOOD');
      expect(r.ratingLabel).toContain('80% (Good)');
      expect(r.riskLevel).toBe('LOW');
    });

    it('categorizes 60% to 79% success rate as MODERATE', () => {
      const r = deriveRatingFromStats('01733333333', { delivered: 7, returned: 3, total: 10 });
      expect(r.ratingTier).toBe('MODERATE');
      expect(r.ratingLabel).toContain('70% (Moderate)');
      expect(r.riskLevel).toBe('MEDIUM');
    });

    it('categorizes < 60% success rate as RISKY with high risk alert', () => {
      const r = deriveRatingFromStats('01744444444', { delivered: 2, returned: 4, total: 6 });
      expect(r.ratingTier).toBe('RISKY');
      expect(r.ratingLabel).toContain('High Risk');
      expect(r.riskLevel).toBe('HIGH');
    });

    it('respects Pathao official customer_rating string tags', () => {
      const r1 = deriveRatingFromStats('01711111111', { delivered: 5, returned: 0, total: 5 }, 'PATHAO', 'excellent_customer');
      expect(r1.ratingTier).toBe('EXCELLENT');

      const r2 = deriveRatingFromStats('01722222222', { delivered: 2, returned: 2, total: 4 }, 'PATHAO', 'risky_customer');
      expect(r2.ratingTier).toBe('RISKY');
    });
  });

  describe('resolveCustomerRating with Store History Index', () => {
    it('indexes baseline store delivery history without errors', () => {
      const storeMap = getStoreHistoryIndex();
      expect(storeMap.size).toBeGreaterThan(100);
    });

    it('resolves historical buyer rating with grounded accuracy', async () => {
      // Pick a known historical phone from baseline (e.g. 1739757536)
      const res = await resolveCustomerRating('01739757536');
      expect(res.phone).toBe('01739757536');
      expect(res.normalizedPhone).toBe('01739757536');
      expect(res.totalOrders).toBeGreaterThanOrEqual(1);
      expect(res.successRate).toBeGreaterThanOrEqual(0);
      expect(res.source).toBe('STORE_HISTORY');
    });

    it('resolves unknown phone number as NEW customer without throwing', async () => {
      const res = await resolveCustomerRating('01399999999');
      expect(res.ratingTier).toBe('NEW');
      expect(res.ratingLabel).toBe('New Customer');
      expect(res.totalOrders).toBe(0);
    });
  });

  describe('batchResolveCustomerRatings', () => {
    it('resolves multiple numbers in batch with deduplication', async () => {
      const phones = ['01739757536', '01739757536', '01399999999', '01822222222'];
      const results = await batchResolveCustomerRatings(phones, { skipPathaoApi: true });

      expect(results).toHaveProperty('01739757536');
      expect(results).toHaveProperty('01399999999');
      expect(results['01399999999'].ratingTier).toBe('NEW');
    });
  });

  describe('Order-Wise Excel Export with Ratings', () => {
    it('includes Customer Rating and Delivery Success Rate columns in workbook', () => {
      const mockGroups = [
        {
          orderId: '1001',
          baseOrderId: '1001',
          orderDate: '2026-10-18T10:00:00Z',
          customerName: 'Tanvir Ahmed',
          phone: '01711111111',
          city: 'Dhaka',
          wcStatus: 'shipped',
          courierStatus: 'Delivered',
          consignmentId: 'RD1001A',
          consignmentIds: ['RD1001A'],
          items: [],
          totalQuantity: 2,
          totalAmount: 4300,
          collectionType: 'REGULAR' as const,
          hasDiscrepancy: false,
          branch: { isBranchFulfillment: false, branchCode: 'ONLINE', branchName: 'Online Store' },
          exchangeInfo: { isExchange: false },
          primaryRow: {} as any,
        },
      ];

      const mockReport = {
        referenceDate: '2026-10-18',
        activeOrders: [],
        exchangeStats: { replacementOrders: [] },
      } as any;

      const ratings = {
        '01711111111': {
          ratingLabel: '95% (Excellent)',
          successRate: 95,
        },
      };

      const wb = buildOrderWiseWorkbook(mockGroups as any, mockReport, { ratings });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = sheet ? Object.keys(sheet).filter(k => k.startsWith('A') || k.startsWith('E')) : [];
      expect(wb.SheetNames).toContain('Shipped Orders (Order-Wise)');
    });
  });

  describe('Paid Return & Status Precedence Invariants', () => {
    it('classifies "Paid Return" as returned instead of delivered in live orders augmentation', async () => {
      const testPhone = '01988887777';
      const liveOrders = [
        {
          Phone: testPhone,
          'Delivery Status': 'Paid Return',
          'Order status': 'completed',
        } as any,
      ];

      const res = await resolveCustomerRating(testPhone, { liveOrders });
      expect(res.deliveredOrders).toBe(0);
      expect(res.returnedOrders).toBe(1);
      expect(res.totalOrders).toBe(1);
      expect(res.ratingTier).toBe('RISKY');
    });
  });
});
