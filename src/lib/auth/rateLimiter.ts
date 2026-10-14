export interface RateLimitStatus {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTimeMs: number;
}

interface BucketEntry {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, BucketEntry>();

/**
 * Sliding window in-memory rate limiter for serverless API endpoints.
 * @param key Identifier (e.g. client IP, API key, endpoint)
 * @param limit Max requests allowed within window
 * @param windowMs Time window in milliseconds (default: 60,000ms = 1 minute)
 */
export function checkRateLimit(
  key: string,
  limit: number = 60,
  windowMs: number = 60000
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
    };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetTimeMs: entry.resetTime,
    };
  }

  entry.count++;
  return {
    allowed: true,
    limit,
    remaining: limit - entry.count,
    resetTimeMs: entry.resetTime,
  };
}

/**
 * Reset rate limit cache (useful in unit tests).
 */
export function resetRateLimits(): void {
  memoryStore.clear();
}
