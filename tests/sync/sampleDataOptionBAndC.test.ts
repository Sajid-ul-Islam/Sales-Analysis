import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getSampleData, POST as postSampleData } from '@/app/api/sample-data/route';
import { clearSampleDataMemoryCache } from '@/lib/sync/sampleDataCache';
import * as wcClient from '@/lib/woocommerceClient';

describe('Option C Unified Baseline & Option B Forced Live Sync Fallback (/api/sample-data)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearSampleDataMemoryCache();
  });

  describe('Option C: Standard Master Baseline Load (0ms Instant Load)', () => {
    it('serves the complete unified baseline dataset with zero external API calls', async () => {
      const spyFetchWc = vi.spyOn(wcClient, 'fetchWooCommerceOrders');
      const req = new NextRequest('http://localhost:3000/api/sample-data');

      const res = await getSampleData(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.ordersCount).toBeGreaterThan(5000);
      expect(json.orders.length).toBe(json.ordersCount);
      expect(json.source).toBe('baseline_bundled');

      // Zero external WooCommerce API calls made in Option C!
      expect(spyFetchWc).not.toHaveBeenCalled();
    });

    it('generates deterministic ETag and supports HTTP 304 conditional freshness', async () => {
      const req1 = new NextRequest('http://localhost:3000/api/sample-data');
      const res1 = await getSampleData(req1);
      const etag = res1.headers.get('ETag');
      expect(etag).toBeDefined();

      // Client sends matching If-None-Match
      const req2 = new NextRequest('http://localhost:3000/api/sample-data', {
        headers: { 'If-None-Match': etag! }
      });
      const res2 = await getSampleData(req2);
      expect(res2.status).toBe(304);
    });
  });

  describe('Option B: Forced Live Sync Fallback (?force=true)', () => {
    it('triggers live WooCommerce fetch when force=true is passed', async () => {
      const mockRawOrders = [
        {
          id: 99999,
          number: '99999',
          status: 'processing',
          total: '2500',
          date_created: '2026-11-19T10:00:00',
          created_via: 'checkout',
          line_items: [
            {
              id: 1,
              name: 'DEEN Oxford Shirt - Navy',
              sku: 'SHIRT-OX-NAV-L',
              quantity: 1,
              price: 2500,
              total: '2500',
            }
          ]
        }
      ];

      vi.spyOn(wcClient, 'testWooCommerceConnection').mockResolvedValue({
        success: true,
        status: 200,
        message: 'Mock connected',
      });

      const spyFetch = vi.spyOn(wcClient, 'fetchWooCommerceOrders').mockResolvedValue(mockRawOrders as any);

      const req = new NextRequest('http://localhost:3000/api/sample-data?force=true');
      const res = await getSampleData(req);
      expect(res.status).toBe(200);

      // Verify Option B triggered live WooCommerce fetch
      expect(spyFetch).toHaveBeenCalledWith(expect.objectContaining({
        status: 'any',
        orderBy: 'date',
        order: 'desc',
      }));

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.source).toBe('live_woocommerce_forced');
      expect(json.ordersPath).toContain('WooCommerce REST API (Live Force Sync)');
      expect(json.ordersCount).toBeGreaterThan(0);
    });

    it('gracefully falls back to Option C baseline if WooCommerce connection test fails during forced sync', async () => {
      vi.spyOn(wcClient, 'testWooCommerceConnection').mockResolvedValue({
        success: false,
        status: 503,
        message: 'WooCommerce API unreachable',
      });

      const req = new NextRequest('http://localhost:3000/api/sample-data?force=true');
      const res = await getSampleData(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      // Falls back safely to baseline without crashing
      expect(json.source).toBe('baseline_bundled');
      expect(json.ordersCount).toBeGreaterThan(5000);
    });
  });
});
