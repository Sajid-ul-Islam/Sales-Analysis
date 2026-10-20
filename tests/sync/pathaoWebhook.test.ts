import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  normalizePathaoStatus,
  verifyPathaoWebhookSecret,
  processPathaoWebhookEvent,
  clearLiveWebhookUpdates,
  getLiveWebhookUpdates,
} from '@/lib/pathaoWebhookEngine';
import { GET, POST } from '@/app/api/sync/pathao/webhook/route';

describe('Pathao Webhook Inbound Telemetry Engine', () => {
  beforeEach(() => {
    clearLiveWebhookUpdates();
    delete process.env.PATHAO_WEBHOOK_SECRET;
  });

  afterEach(() => {
    clearLiveWebhookUpdates();
    delete process.env.PATHAO_WEBHOOK_SECRET;
  });

  describe('normalizePathaoStatus', () => {
    it('normalizes success statuses into Delivered', () => {
      expect(normalizePathaoStatus('Delivered')).toBe('Delivered');
      expect(normalizePathaoStatus('delivered')).toBe('Delivered');
      expect(normalizePathaoStatus('Payment_Collected')).toBe('Delivered');
      expect(normalizePathaoStatus('Completed')).toBe('Delivered');
    });

    it('normalizes return and RTO statuses into Returned', () => {
      expect(normalizePathaoStatus('Return')).toBe('Returned');
      expect(normalizePathaoStatus('Returned')).toBe('Returned');
      expect(normalizePathaoStatus('Failed')).toBe('Returned');
      expect(normalizePathaoStatus('RTO_Delivered')).toBe('Returned');
      expect(normalizePathaoStatus('Cancelled')).toBe('Returned');
    });

    it('normalizes partial deliveries into Partial', () => {
      expect(normalizePathaoStatus('Partial_Delivered')).toBe('Partial');
      expect(normalizePathaoStatus('partial')).toBe('Partial');
    });

    it('normalizes transit statuses into In-Transit', () => {
      expect(normalizePathaoStatus('In_Transit')).toBe('In-Transit');
      expect(normalizePathaoStatus('Picked_Up')).toBe('In-Transit');
      expect(normalizePathaoStatus('On_The_Way')).toBe('In-Transit');
      expect(normalizePathaoStatus('Hub_Transfer')).toBe('In-Transit');
    });

    it('handles empty or unrecognized statuses gracefully', () => {
      expect(normalizePathaoStatus('')).toBe('Untracked');
      expect(normalizePathaoStatus(undefined)).toBe('Untracked');
    });
  });

  describe('verifyPathaoWebhookSecret', () => {
    it('allows in development/test mode when no secret is configured', () => {
      delete process.env.PATHAO_WEBHOOK_SECRET;
      expect(verifyPathaoWebhookSecret('any-header')).toBe(true);
      expect(verifyPathaoWebhookSecret(null)).toBe(true);
    });

    it('validates secret strictly when PATHAO_WEBHOOK_SECRET is set', () => {
      process.env.PATHAO_WEBHOOK_SECRET = 'deen_secret_token_123';

      expect(verifyPathaoWebhookSecret('deen_secret_token_123')).toBe(true);
      expect(verifyPathaoWebhookSecret('Bearer deen_secret_token_123')).toBe(true);
      expect(verifyPathaoWebhookSecret('Bearer wrong_secret')).toBe(false);
      expect(verifyPathaoWebhookSecret(null)).toBe(false);
    });
  });

  describe('processPathaoWebhookEvent', () => {
    it('processes and caches a single consignment status update', () => {
      const payload = {
        event: 'order.status_updated',
        consignment_id: '6740B0123XYZ',
        merchant_order_id: '18991',
        order_status: 'Delivered',
        collected_amount: 3200,
        reason: 'Successfully delivered to customer',
      };

      const record = processPathaoWebhookEvent(payload);
      expect(record).not.toBeNull();
      expect(record!.consignmentId).toBe('6740B0123XYZ');
      expect(record!.merchantOrderId).toBe('18991');
      expect(record!.normalizedStatus).toBe('Delivered');
      expect(record!.collectedAmount).toBe(3200);

      const updates = getLiveWebhookUpdates();
      expect(updates.get('6740B0123XYZ')).toBeDefined();
      expect(updates.get('order_18991')).toBeDefined();
    });

    it('returns null when neither consignment_id nor merchant_order_id is present', () => {
      const record = processPathaoWebhookEvent({ order_status: 'Delivered' });
      expect(record).toBeNull();
    });
  });

  describe('API Route Handler (GET & POST)', () => {
    it('handles GET challenge requests from webhook registration', async () => {
      const req = new Request('https://deen-commerce.com/api/sync/pathao/webhook?challenge=challenge_token_999');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe('challenge_token_999');
    });

    it('handles GET status inspection', async () => {
      const req = new Request('https://deen-commerce.com/api/sync/pathao/webhook');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('active');
      expect(json.endpoint).toBe('/api/sync/pathao/webhook');
    });

    it('rejects POST requests with invalid secrets when configured', async () => {
      process.env.PATHAO_WEBHOOK_SECRET = 'secure_secret_pass';

      const req = new Request('https://deen-commerce.com/api/sync/pathao/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': 'invalid_secret',
        },
        body: JSON.stringify({ consignment_id: 'C100', order_status: 'Delivered' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('accepts and processes valid POST webhook events', async () => {
      process.env.PATHAO_WEBHOOK_SECRET = 'secure_secret_pass';

      const req = new Request('https://deen-commerce.com/api/sync/pathao/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': 'secure_secret_pass',
        },
        body: JSON.stringify({
          consignment_id: 'C200',
          merchant_order_id: '19050',
          order_status: 'Payment_Collected',
          collected_amount: 1950,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.processed).toBe(1);
      expect(json.records[0].normalizedStatus).toBe('Delivered');
    });
  });
});
