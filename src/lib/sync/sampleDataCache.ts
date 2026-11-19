export interface CachedFallback {
  payload: Record<string, unknown>;
  etag: string;
}

let cachedMaskedFallback: CachedFallback | null = null;

export function getCachedMaskedFallback(): CachedFallback | null {
  return cachedMaskedFallback;
}

export function setCachedMaskedFallback(item: CachedFallback | null): void {
  cachedMaskedFallback = item;
}

export function clearSampleDataMemoryCache(): void {
  cachedMaskedFallback = null;
}
