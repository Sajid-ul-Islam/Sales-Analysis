import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Route handlers
import { GET as getSampleData, POST as postSampleData } from '@/app/api/sample-data/route';
import { GET as getBlobStatus } from '@/app/api/blob/status/route';
import { GET as getBlobDataset, POST as postBlobDataset } from '@/app/api/blob/dataset/route';
import { POST as postSyncWooCommerce } from '@/app/api/sync/woocommerce/route';
import { POST as postSyncPathao } from '@/app/api/sync/pathao/route';
import { POST as postSyncLiveTerminal } from '@/app/api/sync/live-terminal/route';
import { GET as getSyncStatus, POST as postSyncStatus } from '@/app/api/sync/status/route';
import { GET as getSyncCron } from '@/app/api/sync/cron/route';
import { GET as getAnalyticsOverview } from '@/app/api/analytics/overview/route';
import { GET as getAnalyticsMeta, POST as postAnalyticsMeta } from '@/app/api/analytics/meta/route';
import { GET as getAnalyticsGA4, POST as postAnalyticsGA4 } from '@/app/api/analytics/ga4/route';
import { POST as postPredictRisk } from '@/app/api/ai/predict-risk/route';
import { POST as postReturnDiagnosis } from '@/app/api/ai/after-sales/return-diagnosis/route';
import { POST as postCourierAudit } from '@/app/api/ai/after-sales/courier-audit/route';
import { POST as postCustomerLoss } from '@/app/api/ai/after-sales/customer-loss/route';
import { resetRateLimits } from '@/lib/auth/rateLimiter';

describe('Strict Route Authentication & RBAC Coverage', () => {
  beforeEach(() => {
    resetRateLimits();
    delete process.env.ADMIN_API_SECRET;
    delete process.env.INTERNAL_SYNC_SECRET;
    delete process.env.API_BEARER_TOKEN;
    delete process.env.SYNC_API_TOKEN;
    delete process.env.NEXT_PUBLIC_API_BEARER_TOKEN;
    delete process.env.CRON_SECRET;
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  describe('Unauthenticated Caller Rejection (401 Unauthorized)', () => {
    it('blocks anonymous calls to POST /api/sample-data', async () => {
      const req = new NextRequest('http://localhost:3000/api/sample-data', { method: 'POST', body: '{}' });
      const res = await postSampleData(req);
      expect(res.status).toBe(401);
    });

    it('blocks anonymous calls to GET /api/blob/status', async () => {
      const req = new NextRequest('http://localhost:3000/api/blob/status');
      const res = await getBlobStatus(req);
      expect(res.status).toBe(401);
    });

    it('blocks anonymous calls to GET /api/blob/dataset', async () => {
      const req = new NextRequest('http://localhost:3000/api/blob/dataset');
      const res = await getBlobDataset(req);
      expect(res.status).toBe(401);
    });

    it('blocks anonymous calls to POST /api/blob/dataset', async () => {
      const req = new NextRequest('http://localhost:3000/api/blob/dataset', {
        method: 'POST',
        body: JSON.stringify({ orders: [] })
      });
      const res = await postBlobDataset(req);
      expect(res.status).toBe(401);
    });

    it('blocks anonymous calls to POST /api/sync/woocommerce', async () => {
      const req = new NextRequest('http://localhost:3000/api/sync/woocommerce', {
        method: 'POST',
        body: JSON.stringify({ perPage: 10 })
      });
      const res = await postSyncWooCommerce(req);
      expect(res.status).toBe(401);
    });

    it('blocks anonymous calls to POST /api/sync/pathao', async () => {
      const req = new NextRequest('http://localhost:3000/api/sync/pathao', {
        method: 'POST',
        body: JSON.stringify({ limit: 10 })
      });
      const res = await postSyncPathao(req);
      expect(res.status).toBe(401);
    });

    it('blocks anonymous calls to POST /api/sync/live-terminal', async () => {
      const req = new NextRequest('http://localhost:3000/api/sync/live-terminal', {
        method: 'POST',
        body: JSON.stringify({ limitConsignments: 10 })
      });
      const res = await postSyncLiveTerminal(req);
      expect(res.status).toBe(401);
    });

    it('blocks anonymous calls to GET /api/sync/status', async () => {
      const req = new NextRequest('http://localhost:3000/api/sync/status');
      const res = await getSyncStatus(req);
      expect(res.status).toBe(401);
    });

    it('blocks anonymous calls to POST /api/sync/status', async () => {
      const req = new NextRequest('http://localhost:3000/api/sync/status', {
        method: 'POST',
        body: JSON.stringify({ woocommerce: {} })
      });
      const res = await postSyncStatus(req);
      expect(res.status).toBe(401);
    });

    it('blocks anonymous calls to GET /api/sync/cron', async () => {
      const req = new NextRequest('http://localhost:3000/api/sync/cron');
      const res = await getSyncCron(req);
      expect(res.status).toBe(401);
    });

    it('blocks anonymous calls to GET /api/analytics/overview', async () => {
      const req = new NextRequest('http://localhost:3000/api/analytics/overview');
      const res = await getAnalyticsOverview(req);
      expect(res.status).toBe(401);
    });

    it('blocks anonymous calls to GET /api/analytics/meta', async () => {
      const req = new NextRequest('http://localhost:3000/api/analytics/meta');
      const res = await getAnalyticsMeta(req);
      expect(res.status).toBe(401);
    });

    it('blocks anonymous calls to POST /api/analytics/meta', async () => {
      const req = new NextRequest('http://localhost:3000/api/analytics/meta', { method: 'POST', body: '{}' });
      const res = await postAnalyticsMeta(req);
      expect(res.status).toBe(401);
    });

    it('blocks anonymous calls to GET /api/analytics/ga4', async () => {
      const req = new NextRequest('http://localhost:3000/api/analytics/ga4');
      const res = await getAnalyticsGA4(req);
      expect(res.status).toBe(401);
    });

    it('blocks anonymous calls to POST /api/analytics/ga4', async () => {
      const req = new NextRequest('http://localhost:3000/api/analytics/ga4', { method: 'POST', body: '{}' });
      const res = await postAnalyticsGA4(req);
      expect(res.status).toBe(401);
    });

    it('blocks anonymous calls to POST /api/ai/predict-risk', async () => {
      const req = new NextRequest('http://localhost:3000/api/ai/predict-risk', {
        method: 'POST',
        body: JSON.stringify({ profile: { customerName: 'Test' } })
      });
      const res = await postPredictRisk(req);
      expect(res.status).toBe(401);
    });

    it('blocks anonymous calls to after-sales AI when server LLM is requested without auth', async () => {
      const req1 = new NextRequest('http://localhost:3000/api/ai/after-sales/return-diagnosis', {
        method: 'POST',
        body: JSON.stringify({ returnedItems: [] })
      });
      const res1 = await postReturnDiagnosis(req1);
      expect(res1.status).toBe(401);

      const req2 = new NextRequest('http://localhost:3000/api/ai/after-sales/courier-audit', {
        method: 'POST',
        body: JSON.stringify({ mismatches: [] })
      });
      const res2 = await postCourierAudit(req2);
      expect(res2.status).toBe(401);

      const req3 = new NextRequest('http://localhost:3000/api/ai/after-sales/customer-loss', {
        method: 'POST',
        body: JSON.stringify({ profiles: [] })
      });
      const res3 = await postCustomerLoss(req3);
      expect(res3.status).toBe(401);
    });
  });

  describe('Readonly Sample Data Access', () => {
    it('allows demo/anonymous callers to GET /api/sample-data but strips unmasked PII and raw blob URL', async () => {
      const req = new NextRequest('http://localhost:3000/api/sample-data');
      const res = await getSampleData(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      // blobUrl must be stripped
      expect(data.blobUrl).toBeUndefined();
      // Orders must be sanitized
      if (data.orders && data.orders.length > 0) {
        const firstOrder = data.orders[0];
        if (firstOrder.phone) {
          expect(firstOrder.phone).toMatch(/\*{4}/);
        }
      }
    }, 25000);
  });

  describe('Authenticated Operator Access', () => {
    it('grants access when valid operator bearer token is provided', async () => {
      process.env.API_BEARER_TOKEN = 'test_valid_operator_token';
      const req = new NextRequest('http://localhost:3000/api/blob/status', {
        headers: { authorization: 'Bearer test_valid_operator_token' }
      });
      const res = await getBlobStatus(req);
      // Status is 200 (even if blob not configured, it doesn't 401)
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.configured).toBe(false);
    });
  });
});
