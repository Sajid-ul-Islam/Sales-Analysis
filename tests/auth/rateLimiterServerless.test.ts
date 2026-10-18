import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkRateLimit,
  checkRateLimitAsync,
  resetRateLimits,
  isDistributedRateLimiterConfigured,
} from '@/lib/auth/rateLimiter';

describe('Rate Limiter: Serverless-Resilient Multi-Tier Rate Limiting', () => {
  beforeEach(() => {
    resetRateLimits();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    resetRateLimits();
    vi.restoreAllMocks();
  });

  describe('Tier 2: In-Memory Sliding Window (Local Fallback)', () => {
    it('supports synchronous invocation with immediate property access', () => {
      const key = 'test_sync_user_1';
      const r1 = checkRateLimit(key, 2);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(1);
      expect(r1.limit).toBe(2);

      const r2 = checkRateLimit(key, 2);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(0);

      const r3 = checkRateLimit(key, 2);
      expect(r3.allowed).toBe(false);
      expect(r3.remaining).toBe(0);
    });

    it('supports asynchronous awaiting via hybrid Thenable contract', async () => {
      const key = 'test_async_user_2';
      const r1 = await checkRateLimit(key, 2);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(1);

      const r2 = await checkRateLimit(key, 2);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(0);

      const r3 = await checkRateLimit(key, 2);
      expect(r3.allowed).toBe(false);
    });

    it('resets correctly with resetRateLimits', () => {
      const key = 'test_reset_user';
      checkRateLimit(key, 1);
      expect(checkRateLimit(key, 1).allowed).toBe(false);

      resetRateLimits();
      expect(checkRateLimit(key, 1).allowed).toBe(true);
    });
  });

  describe('Tier 1: Distributed Persistent KV / Upstash Redis', () => {
    it('detects when distributed KV credentials are configured', () => {
      expect(isDistributedRateLimiterConfigured()).toBe(false);

      process.env.KV_REST_API_URL = 'https://example-redis.upstash.io';
      process.env.KV_REST_API_TOKEN = 'mock-token-xyz';
      expect(isDistributedRateLimiterConfigured()).toBe(true);
    });

    it('executes pipeline against distributed KV REST endpoint when configured', async () => {
      process.env.KV_REST_API_URL = 'https://mock-kv.upstash.io';
      process.env.KV_REST_API_TOKEN = 'secret-token';

      // Mock global fetch for Upstash REST pipeline
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { result: 1 },    // INCR result
          { result: 1 },    // EXPIRE result
          { result: 59500 }, // PTTL in ms
        ],
      });
      vi.stubGlobal('fetch', mockFetch);

      const status = await checkRateLimitAsync('distributed_client_99', 10, 60000);
      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(9);
      expect(status.isDistributed).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://mock-kv.upstash.io/pipeline',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-token',
          }),
        })
      );
    });

    it('blocks request when distributed KV reports count exceeded limit', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://mock-upstash.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'secret-upstash-token';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { result: 11 },   // INCR count is 11 (exceeds limit 10)
          { result: 1 },
          { result: 30000 },
        ],
      });
      vi.stubGlobal('fetch', mockFetch);

      const status = await checkRateLimitAsync('distributed_client_100', 10, 60000);
      expect(status.allowed).toBe(false);
      expect(status.remaining).toBe(0);
      expect(status.isDistributed).toBe(true);
    });

    it('gracefully falls back to local in-memory store if distributed KV fails', async () => {
      process.env.KV_REST_API_URL = 'https://broken-kv.upstash.io';
      process.env.KV_REST_API_TOKEN = 'bad-token';

      // Simulate network / HTTP 500 error
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error: ETIMEDOUT'));
      vi.stubGlobal('fetch', mockFetch);

      const status = await checkRateLimitAsync('fallback_client_1', 5, 60000);
      expect(status.allowed).toBe(true);
      expect(status.isDistributed).toBe(false);
    });
  });
});
