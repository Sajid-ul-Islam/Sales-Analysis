/**
 * Rate Limiter: Serverless-Resilient Multi-Tier Distributed & In-Memory Rate Limiter
 *
 * Designed specifically for serverless environments (e.g. Vercel Lambdas) where
 * in-memory instances are ephemeral and unshared across concurrent lambda invocations.
 *
 * Tier 1: Distributed Persistent Store (Upstash Redis / Vercel KV REST API)
 *         Triggered automatically when KV_REST_API_URL / UPSTASH_REDIS_REST_URL
 *         and matching tokens are present.
 * Tier 2: In-Memory Sliding Window Bucket
 *         Zero-latency fallback when distributed store is not configured or during
 *         offline development and testing.
 */

export interface RateLimitStatus {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTimeMs: number;
  isDistributed?: boolean;
}

interface BucketEntry {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, BucketEntry>();

/**
 * Returns true if distributed Upstash Redis / Vercel KV credentials are configured.
 */
export function isDistributedRateLimiterConfigured(): boolean {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token);
}

/**
 * Synchronous local sliding window fallback.
 */
function checkLocalRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitStatus {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetTime) {
    const newEntry: BucketEntry = {
      count: 1,
      resetTime: now + windowMs,
    };
    memoryStore.set(key, newEntry);
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetTimeMs: newEntry.resetTime,
      isDistributed: false,
    };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetTimeMs: entry.resetTime,
      isDistributed: false,
    };
  }

  entry.count++;
  return {
    allowed: true,
    limit,
    remaining: limit - entry.count,
    resetTimeMs: entry.resetTime,
    isDistributed: false,
  };
}

/**
 * Distributed rate limiter via Upstash Redis / Vercel KV REST pipeline.
 */
async function checkDistributedRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitStatus> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return checkLocalRateLimit(key, limit, windowMs);
  }

  const now = Date.now();
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const redisKey = `deen_rl:${key}`;

  try {
    const response = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['EXPIRE', redisKey, windowSec, 'NX'],
        ['PTTL', redisKey],
      ]),
      // Low timeout to prevent hanging API requests if Redis has latency
      signal: AbortSignal.timeout(1500),
    });

    if (!response.ok) {
      console.warn(`[RateLimiter] Distributed KV returned HTTP ${response.status}. Falling back to local store.`);
      return checkLocalRateLimit(key, limit, windowMs);
    }

    const data = await response.json();
    if (Array.isArray(data) && data[0]?.result !== undefined) {
      const currentCount = Number(data[0].result) || 1;
      const pttl = Number(data[2]?.result) > 0 ? Number(data[2].result) : windowMs;
      const resetTimeMs = now + pttl;

      if (currentCount > limit) {
        return {
          allowed: false,
          limit,
          remaining: 0,
          resetTimeMs,
          isDistributed: true,
        };
      }

      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - currentCount),
        resetTimeMs,
        isDistributed: true,
      };
    }
  } catch (err: any) {
    console.warn(`[RateLimiter] Distributed rate check failed (${err.message}). Using local fallback.`);
  }

  return checkLocalRateLimit(key, limit, windowMs);
}

/**
 * Dual Sync/Async Hybrid Rate Limiter.
 *
 * Can be called synchronously:
 *   const status = checkRateLimit(key, limit, windowMs);
 *   if (!status.allowed) ...
 *
 * Or awaited asynchronously to use distributed Upstash Redis / Vercel KV:
 *   const status = await checkRateLimit(key, limit, windowMs);
 *   if (!status.allowed) ...
 */
export function checkRateLimit(
  key: string,
  limit: number = 60,
  windowMs: number = 60000
): RateLimitStatus & PromiseLike<RateLimitStatus> {
  const localStatus = checkLocalRateLimit(key, limit, windowMs);

  // If distributed KV is configured, create async promise that resolves to distributed check
  const promise = isDistributedRateLimiterConfigured()
    ? checkDistributedRateLimit(key, limit, windowMs)
    : Promise.resolve(localStatus);

  // Return hybrid thenable object
  return Object.assign(promise, localStatus);
}

/**
 * Explicit async rate limiter for serverless API routes.
 */
export async function checkRateLimitAsync(
  key: string,
  limit: number = 60,
  windowMs: number = 60000
): Promise<RateLimitStatus> {
  if (isDistributedRateLimiterConfigured()) {
    return checkDistributedRateLimit(key, limit, windowMs);
  }
  return checkLocalRateLimit(key, limit, windowMs);
}

/**
 * Reset rate limit cache (useful in unit tests).
 */
export function resetRateLimits(): void {
  memoryStore.clear();
}
