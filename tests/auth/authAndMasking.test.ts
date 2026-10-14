import { describe, it, expect, beforeEach } from 'vitest';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { checkRateLimit, resetRateLimits } from '@/lib/auth/rateLimiter';
import { maskPhoneNumber, maskCustomerName, maskAddress, sanitizeOrderRow } from '@/lib/auth/dataMasking';
import { auditDatasetPII, anonymizeDataset } from '@/lib/dataAudit';

describe('Security & Data Privacy Infrastructure', () => {
  beforeEach(() => {
    resetRateLimits();
    delete process.env.ADMIN_API_SECRET;
    delete process.env.API_BEARER_TOKEN;
  });

  describe('API Authentication & Authorization', () => {
    it('authenticates admin request with valid secret token', () => {
      process.env.ADMIN_API_SECRET = 'secret_admin_key_123';
      const req = new Request('https://localhost/api/sync/woocommerce', {
        headers: { authorization: 'Bearer secret_admin_key_123' },
      });

      const res = validateApiRequest(req, { requiredRole: 'admin', allowDemo: false });
      expect(res.authenticated).toBe(true);
      expect(res.role).toBe('admin');
      expect(res.statusCode).toBe(200);
    });

    it('rejects invalid or missing bearer token in non-demo mode', () => {
      const origEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'production';
      process.env.ADMIN_API_SECRET = 'secret_admin_key_123';

      const req = new Request('https://localhost/api/sync/woocommerce', {
        headers: { authorization: 'Bearer invalid_token' },
      });

      const res = validateApiRequest(req, { requiredRole: 'admin', allowDemo: false });
      expect(res.authenticated).toBe(false);
      expect(res.statusCode).toBe(401);
      (process.env as any).NODE_ENV = origEnv;
    });

    it('allows demo mode when allowDemo flag is set', () => {
      const req = new Request('https://localhost/api/sample-data');
      const res = validateApiRequest(req, { allowDemo: true });
      expect(res.authenticated).toBe(true);
      expect(res.role).toBe('demo');
    });
  });

  describe('Sliding-Window Rate Limiter', () => {
    it('allows requests within threshold and blocks excess traffic', () => {
      const key = 'test_client_ip';
      // Limit 3 requests
      expect(checkRateLimit(key, 3).allowed).toBe(true);
      expect(checkRateLimit(key, 3).allowed).toBe(true);
      expect(checkRateLimit(key, 3).allowed).toBe(true);
      // 4th request must be blocked
      const blocked = checkRateLimit(key, 3);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });
  });

  describe('Customer PII Masking & Sanitization', () => {
    it('masks phone numbers properly', () => {
      expect(maskPhoneNumber('01783650157')).toBe('0178****157');
      expect(maskPhoneNumber('01812345678')).toBe('0181****678');
    });

    it('masks customer names to initials', () => {
      expect(maskCustomerName('Tusher pual')).toBe('T*** p***');
      expect(maskCustomerName('Ashraf ahmed Ovi')).toBe('A*** a*** O***');
    });

    it('masks street addresses while retaining district/city context', () => {
      const masked = maskAddress('House 747, Road 11, Flat B4, Bashundhara R/A, Dhaka', 'Dhaka');
      expect(masked).toBe('[REDACTED STREET], Dhaka');
    });

    it('sanitizes order row completely', () => {
      const row = {
        'Order ID': '16271',
        'Customer Name': 'Tusher pual',
        'Phone': '01783650157',
        'Address': '714 Jahanara Kutir, Comilla',
        'Order Notes': 'Customer phone 01783650157 confirmed',
      };
      const clean = sanitizeOrderRow(row, 'full');
      expect(clean['Customer Name']).toBe('T*** p***');
      expect(clean['Phone']).toBe('0178****157');
      expect(clean['Address']).toContain('[REDACTED');
      expect(clean['Order Notes']).toContain('[PHONE REDACTED]');
    });
  });

  describe('Dataset PII Audit & Anonymizer', () => {
    it('detects unmasked customer PII in datasets', () => {
      const testData = [
        { 'Order ID': '101', 'Customer Name': 'Real Customer', 'Phone': '01712345678', 'Address': '123 Real Street, Dhaka' },
      ];
      const audit = auditDatasetPII(testData);
      expect(audit.hasPII).toBe(true);
      expect(audit.piiRecordCount).toBe(1);
      expect(audit.detectedFields).toContain('Phone');
      expect(audit.detectedFields).toContain('Address');
    });

    it('anonymizes dataset while preserving financial metrics and order IDs', () => {
      const rawRecords = [
        { 'Order ID': '101', 'Customer Name': 'Dr Raj', 'Phone': '01712003598', 'Order Amount': 3129, Quantity: 2 },
      ];
      const cleanRecords = anonymizeDataset(rawRecords);
      expect(cleanRecords[0]['Order ID']).toBe('101');
      expect(cleanRecords[0]['Order Amount']).toBe(3129);
      expect(cleanRecords[0]['Quantity']).toBe(2);
      expect(cleanRecords[0]['Customer Name']).toBe('D*** R***');
      expect(cleanRecords[0]['Phone']).toBe('0171****598');

      const reAudit = auditDatasetPII(cleanRecords);
      expect(reAudit.hasPII).toBe(false);
    });
  });
});
