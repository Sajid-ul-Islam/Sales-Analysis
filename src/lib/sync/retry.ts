export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  shouldRetry?: (error: any) => boolean;
}

/**
 * Executes an async operation with exponential backoff and jitter.
 * Designed for external API resilience (WooCommerce REST, Pathao Hermes API).
 */
export async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 400,
    maxDelayMs = 4000,
    backoffFactor = 2,
    shouldRetry = (err: any) => {
      // Default retry condition: 429 Rate Limit, 502/503/504 Bad Gateway / Gateway Timeout, or network errors
      if (!err) return false;
      const status = err.status || err.statusCode || 0;
      if (status === 429 || (status >= 500 && status <= 504)) return true;
      if (err.name === 'AbortError' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') return true;
      return false;
    },
  } = options;

  let attempt = 0;
  let delay = baseDelayMs;

  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      if (attempt > maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Add full jitter to prevent thundering herd problem
      const jitter = Math.random() * delay * 0.3;
      const totalWait = Math.min(maxDelayMs, delay + jitter);

      await new Promise(resolve => setTimeout(resolve, totalWait));
      delay = Math.min(maxDelayMs, delay * backoffFactor);
    }
  }
}
