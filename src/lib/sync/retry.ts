export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  shouldRetry?: (error: unknown) => boolean;
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
    shouldRetry = (err: unknown) => {
      // Default retry condition: 429 Rate Limit, 502/503/504 Bad Gateway / Gateway Timeout, or network errors
      if (!err || typeof err !== 'object') return false;
      const status = ('status' in err && typeof (err as { status?: unknown }).status === 'number')
        ? (err as { status: number }).status
        : ('statusCode' in err && typeof (err as { statusCode?: unknown }).statusCode === 'number')
        ? (err as { statusCode: number }).statusCode
        : 0;
      if (status === 429 || (status >= 500 && status <= 504)) return true;
      if (err instanceof Error) {
        if (err.name === 'AbortError') return true;
        const code = (err as unknown as { code?: string }).code;
        if (code === 'ECONNRESET' || code === 'ETIMEDOUT') return true;
      }
      return false;
    },
  } = options;

  let attempt = 0;
  let delay = baseDelayMs;

  while (true) {
    try {
      return await operation();
    } catch (error: unknown) {
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
