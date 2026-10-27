import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import {
  getRowOrderId,
  deterministicHash,
  getSampledBaseOrderIds,
  sampleDatasetSnapshot
} from '@/lib/orderSampling';
import { verifyPasscode, createSessionToken } from '@/lib/auth/session';
import { POST as postLogin } from '@/app/api/auth/login/route';
import { GET as getSampleData } from '@/app/api/sample-data/route';
import { RawOrderRow, DatasetSnapshot } from '@/types';

describe('Deterministic 15% Order Sampling Engine & Executive Auth', () => {
  describe('1. Hash & Order ID Extraction', () => {
    it('extracts order ID across varied schema column names', () => {
      expect(getRowOrderId({ 'Order ID': '18901' })).toBe('18901');
      expect(getRowOrderId({ order_id: '18902' })).toBe('18902');
      expect(getRowOrderId({ 'Merchant Order ID': '18903 c' })).toBe('18903 c');
      expect(getRowOrderId({ 'Consignment ID': 'RD18904' })).toBe('RD18904');
    });

    it('generates consistent deterministic hashes', () => {
      const hash1 = deterministicHash('17263');
      const hash2 = deterministicHash('17263');
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('number');
    });
  });

  describe('2. Deterministic 15% Unique Order Selection', () => {
    // Generate mock order set with 100 unique orders, some with multiple line items (total 150 rows)
    const mockOrders: RawOrderRow[] = [];
    for (let i = 1; i <= 100; i++) {
      const orderId = `${1000 + i}`;
      // Add primary item
      mockOrders.push({
        'Order ID': orderId,
        'Item Name': `Apparel Item A-${i}`,
        'Item Cost': 1200,
        'Order Date': '2026-10-15',
        'Delivery Status': 'Delivered'
      });
      // Add 2nd item for every 2nd order (multi-item orders)
      if (i % 2 === 0) {
        mockOrders.push({
          'Order ID': orderId,
          'Item Name': `Apparel Item B-${i}`,
          'Item Cost': 800,
          'Order Date': '2026-10-15',
          'Delivery Status': 'Delivered'
        });
      }
    }

    it('selects exactly 15 unique base order IDs out of 100 (15%)', () => {
      const sampledIds = getSampledBaseOrderIds(mockOrders, 0.15);
      expect(sampledIds.size).toBe(15);
    });

    it('produces 100% deterministic order selection across multiple runs', () => {
      const runA = Array.from(getSampledBaseOrderIds(mockOrders, 0.15)).sort();
      const runB = Array.from(getSampledBaseOrderIds(mockOrders, 0.15)).sort();
      expect(runA).toEqual(runB);
    });

    it('samples dataset snapshot and keeps all multi-item rows for sampled orders', () => {
      const mockReturns: RawOrderRow[] = [
        { 'Order ID': '1002', 'Return Status': 'Returned' },
        { 'Order ID': '1099', 'Return Status': 'Returned' },
      ];

      const snapshot: DatasetSnapshot = {
        orders: mockOrders,
        returns: mockReturns,
        partials: [],
        exchanges: [],
        pathaoDelivery: [],
        sourceName: 'Test Master Dataset'
      };

      const sampled = sampleDatasetSnapshot(snapshot, 0.15);
      const sampledUniqueOrderIds = new Set(
        sampled.orders.map(o => String(o['Order ID']))
      );

      // Unique orders must be exactly 15
      expect(sampledUniqueOrderIds.size).toBe(15);
      // Total rows may be > 15 due to multi-item orders being preserved intact
      expect(sampled.orders.length).toBeGreaterThanOrEqual(15);

      // Returns are filtered so only returns belonging to sampled orders are kept
      for (const ret of sampled.returns) {
        expect(sampledUniqueOrderIds.has(String(ret['Order ID']))).toBe(true);
      }
    });

    it('returns original dataset if ratio is 1 or greater', () => {
      const snapshot: DatasetSnapshot = {
        orders: mockOrders,
        returns: [],
        partials: [],
        exchanges: [],
        pathaoDelivery: [],
      };
      const result = sampleDatasetSnapshot(snapshot, 1);
      expect(result.orders.length).toBe(mockOrders.length);
    });
  });

  describe('3. Executive Director Authentication (15% Sampled View)', () => {
    it('authenticates Executive PIN 7742 as Executive Director with sampleRate 0.15', () => {
      const user = verifyPasscode('7742');
      expect(user).not.toBeNull();
      expect(user?.role).toBe('admin');
      expect(user?.displayName).toBe('Executive Director');
      expect(user?.sampleRate).toBe(0.15);
      expect(user?.username).toBe('director');
    });

    it('authenticates Executive Passcode deen@director2026 with sampleRate 0.15', () => {
      const user = verifyPasscode('deen@director2026');
      expect(user).not.toBeNull();
      expect(user?.displayName).toBe('Executive Director');
      expect(user?.sampleRate).toBe(0.15);
    });

    it('POST /api/auth/login succeeds with PIN 7742 and returns sampleRate: 0.15', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'PASSCODE', passcode: '7742' })
      });

      const res = await postLogin(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.displayName).toBe('Executive Director');
      expect(json.user.sampleRate).toBe(0.15);
      expect(json.user.role).toBe('admin');
    });

    it('POST /api/auth/login succeeds with email and password for Executive Director', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'WOOCOMMERCE',
          username: 'director@deencommerce.com',
          password: 'director2026'
        })
      });

      const res = await postLogin(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.displayName).toBe('Executive Director');
      expect(json.user.sampleRate).toBe(0.15);
      expect(json.user.email).toBe('director@deencommerce.com');
    });

    it('GET /api/sample-data automatically serves 15% sampled orders for Executive Director session', async () => {
      const execToken = await createSessionToken({
        id: 'staff_executive',
        username: 'director',
        displayName: 'Executive Director',
        role: 'admin',
        assignedOutlet: 'ALL',
        authMethod: 'PASSCODE',
        sampleRate: 0.15,
                expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      const req = new NextRequest('http://localhost:3000/api/sample-data', {
        headers: { Cookie: `deen_session=${execToken}` }
      });

      const res = await getSampleData(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      // Bundled baseline has 2,549 order rows across ~2,000 unique orders
      // Sampled 15% should be around 382 rows (strictly < 500 rows, far less than 2,549)
      expect(json.ordersCount).toBeLessThan(500);
      expect(json.orders.length).toBe(json.ordersCount);
    });
  });
});
