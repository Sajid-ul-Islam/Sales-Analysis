import { describe, it, expect } from 'vitest';
import { withExponentialBackoff } from '@/lib/sync/retry';
import { SyncTracker } from '@/lib/sync/syncTracker';
import { logSyncReport, getSyncHistory, clearSyncHistory } from '@/lib/sync/syncLogger';

describe('Sync Reliability, Observability & Retry Framework', () => {
  describe('Exponential Backoff Retry Utility', () => {
    it('succeeds on subsequent retry when transient error occurs', async () => {
      let attempts = 0;
      const result = await withExponentialBackoff(
        async () => {
          attempts++;
          if (attempts < 3) {
            const err: any = new Error('Rate limit exceeded');
            err.status = 429;
            throw err;
          }
          return { data: 'ok' };
        },
        { maxRetries: 3, baseDelayMs: 20 }
      );

      expect(attempts).toBe(3);
      expect(result.data).toBe('ok');
    });

    it('does not retry non-transient 401 client errors', async () => {
      let attempts = 0;
      await expect(
        withExponentialBackoff(
          async () => {
            attempts++;
            const err: any = new Error('Invalid credentials');
            err.status = 401;
            throw err;
          },
          { maxRetries: 3, baseDelayMs: 20 }
        )
      ).rejects.toThrow('Invalid credentials');

      expect(attempts).toBe(1); // Fails fast without useless retries
    });
  });

  describe('Sync Tracker Batch Reporting', () => {
    it('aggregates requested, successful, failed, and skipped records accurately', () => {
      const tracker = new SyncTracker('pathao', 10, 'live_api');
      tracker.recordSuccess(7);
      tracker.recordFailure('CONS-101', new Error('Consignment not found in courier Hermes system'), 404);
      tracker.recordFailure('CONS-102', new Error('Timeout'), 504);
      tracker.recordSkipped(1);

      const report = tracker.finalize();
      expect(report.source).toBe('pathao');
      expect(report.status).toBe('partial');
      expect(report.requestedCount).toBe(10);
      expect(report.successfulCount).toBe(7);
      expect(report.failedCount).toBe(2);
      expect(report.skippedCount).toBe(1);
      expect(report.errors.length).toBe(2);
      expect(report.errors[0].recordId).toBe('CONS-101');
      expect(report.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Sync Logger Circular Buffer', () => {
    it('stores and retrieves sync execution logs', () => {
      clearSyncHistory();
      const tracker = new SyncTracker('woocommerce', 50);
      tracker.recordSuccess(50);
      const report = tracker.finalize();

      logSyncReport(report);
      const history = getSyncHistory();
      expect(history.length).toBe(1);
      expect(history[0].source).toBe('woocommerce');
      expect(history[0].successfulCount).toBe(50);
    });
  });
});
