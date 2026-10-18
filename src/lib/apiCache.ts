/**
 * DEEN Commerce — Robust Multi-Tier Client Storage Cache for WooCommerce & Pathao
 * Drastically minimizes live API overhead, eliminates rate-limiting (HTTP 429),
 * and enables instant 0ms sub-second reloads for historical and recent periods.
 */

import { RawOrderRow } from '@/types';

export type SyncProvider = 'woocommerce' | 'pathao';

export interface SyncCacheRecord<T = RawOrderRow[]> {
  key: string;
  provider: SyncProvider;
  data: T;
  ordersCount: number;
  lineItemsCount?: number;
  startDate: string;
  endDate: string;
  orderStatus?: string;
  cachedAt: number;
  ttlMs: number;
  isHistorical: boolean;
  version: string;
  rawSummary?: string;
}

export interface CacheCheckResult<T = RawOrderRow[]> {
  hit: boolean;
  data: T | null;
  ordersCount: number;
  lineItemsCount?: number;
  ageMs: number;
  ageFormatted: string;
  isExpired: boolean;
  isHistorical: boolean;
  key: string;
}

const CACHE_VERSION = '2.7.0';
const CATALOG_KEY = 'deen_api_sync_catalog_v1';

// Adaptive TTL Rules:
// - Historical past months (e.g. September 2026): 7 days (immutable historical baseline)
// - Recent / MTD: 2 hours
// - Today: 15 minutes
export const TTL_HISTORICAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const TTL_RECENT_MS = 2 * 60 * 60 * 1000;          // 2 hours
export const TTL_TODAY_MS = 15 * 60 * 1000;               // 15 minutes

import { getDhakaTodayIso, getDhakaIsoDate, parseDhakaMidday } from '@/lib/timezone';

/**
 * Determines whether a date range represents historical (past closed) data strictly in Asia/Dhaka time.
 */
export function isHistoricalDateRange(endDateStr: string): boolean {
  if (!endDateStr) return false;
  try {
    const endIso = getDhakaIsoDate(endDateStr);
    const todayIso = getDhakaTodayIso();
    if (endIso === todayIso) return false;

    const endMidday = parseDhakaMidday(endIso);
    const todayMidday = parseDhakaMidday(todayIso);
    const diffDays = (todayMidday.getTime() - endMidday.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 3;
  } catch {
    return false;
  }
}

/**
 * Computes optimal TTL in milliseconds based on dates pinned to Asia/Dhaka time.
 */
export function getRecommendedTTL(startDate: string, endDate: string): number {
  const todayStr = getDhakaTodayIso();
  const startIso = startDate ? getDhakaIsoDate(startDate) : '';
  const endIso = endDate ? getDhakaIsoDate(endDate) : '';

  if (endIso === todayStr || startIso === todayStr) {
    return TTL_TODAY_MS;
  }
  if (isHistoricalDateRange(endDate)) {
    return TTL_HISTORICAL_MS;
  }
  return TTL_RECENT_MS;
}

/**
 * Builds a deterministic storage cache key.
 */
export function generateSyncCacheKey(
  provider: SyncProvider,
  startDate: string,
  endDate: string,
  orderStatus: string = 'any'
): string {
  const cleanStart = (startDate || 'all').trim();
  const cleanEnd = (endDate || 'all').trim();
  const cleanStatus = (orderStatus || 'any').trim().toLowerCase();
  return `deen_sync_${provider}_${cleanStart}_${cleanEnd}_${cleanStatus}`;
}

/**
 * Formats time age into human-readable string.
 */
export function formatCacheAge(cachedAt: number): string {
  const diffMs = Date.now() - cachedAt;
  if (diffMs < 10000) return 'Just now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Retrieve cached sync data from local storage if valid.
 */
export function getSyncCache<T = RawOrderRow[]>(
  provider: SyncProvider,
  startDate: string,
  endDate: string,
  orderStatus: string = 'any',
  bypassCache: boolean = false
): CacheCheckResult<T> {
  const key = generateSyncCacheKey(provider, startDate, endDate, orderStatus);

  if (typeof window === 'undefined' || bypassCache) {
    return {
      hit: false,
      data: null,
      ordersCount: 0,
      ageMs: 0,
      ageFormatted: '',
      isExpired: false,
      isHistorical: false,
      key,
    };
  }

  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return {
        hit: false,
        data: null,
        ordersCount: 0,
        ageMs: 0,
        ageFormatted: '',
        isExpired: false,
        isHistorical: false,
        key,
      };
    }

    const record: SyncCacheRecord<T> = JSON.parse(raw);
    const ageMs = Date.now() - record.cachedAt;
    const isExpired = record.ttlMs > 0 && ageMs > record.ttlMs;

    // If expired, return hit: false but keep key in case caller wants stale fallback
    if (isExpired) {
      return {
        hit: false,
        data: record.data,
        ordersCount: record.ordersCount,
        lineItemsCount: record.lineItemsCount,
        ageMs,
        ageFormatted: formatCacheAge(record.cachedAt),
        isExpired: true,
        isHistorical: record.isHistorical,
        key,
      };
    }

    return {
      hit: true,
      data: record.data,
      ordersCount: record.ordersCount,
      lineItemsCount: record.lineItemsCount,
      ageMs,
      ageFormatted: formatCacheAge(record.cachedAt),
      isExpired: false,
      isHistorical: record.isHistorical,
      key,
    };
  } catch (err) {
    console.error(`[ApiCache] Failed to read cache for key ${key}:`, err);
    return {
      hit: false,
      data: null,
      ordersCount: 0,
      ageMs: 0,
      ageFormatted: '',
      isExpired: false,
      isHistorical: false,
      key,
    };
  }
}

/**
 * Store sync results into localStorage with quota protection & catalog index.
 */
export function setSyncCache<T = RawOrderRow[]>(
  provider: SyncProvider,
  startDate: string,
  endDate: string,
  orderStatus: string = 'any',
  data: T,
  counts: { ordersCount: number; lineItemsCount?: number }
): boolean {
  if (typeof window === 'undefined') return false;

  const key = generateSyncCacheKey(provider, startDate, endDate, orderStatus);
  const isHistorical = isHistoricalDateRange(endDate);
  const ttlMs = getRecommendedTTL(startDate, endDate);

  const record: SyncCacheRecord<T> = {
    key,
    provider,
    data,
    ordersCount: counts.ordersCount,
    lineItemsCount: counts.lineItemsCount,
    startDate,
    endDate,
    orderStatus,
    cachedAt: Date.now(),
    ttlMs,
    isHistorical,
    version: CACHE_VERSION,
  };

  try {
    const serialized = JSON.stringify(record);

    try {
      localStorage.setItem(key, serialized);
      updateCatalogEntry(key, provider, startDate, endDate, counts.ordersCount, serialized.length);
      return true;
    } catch (quotaErr) {
      console.warn('[ApiCache] Storage quota exceeded. Pruning older API sync caches...', quotaErr);
      pruneOldestSyncCaches(key);

      try {
        localStorage.setItem(key, serialized);
        updateCatalogEntry(key, provider, startDate, endDate, counts.ordersCount, serialized.length);
        return true;
      } catch (secondErr) {
        console.error('[ApiCache] Unable to cache sync result even after pruning:', secondErr);
        return false;
      }
    }
  } catch (err) {
    console.error(`[ApiCache] Failed to serialize sync cache for ${key}:`, err);
    return false;
  }
}

interface CatalogEntry {
  key: string;
  provider: SyncProvider;
  startDate: string;
  endDate: string;
  ordersCount: number;
  byteSize: number;
  updatedAt: number;
}

/**
 * Updates the catalog of cached API queries for easy listing and management.
 */
function updateCatalogEntry(
  key: string,
  provider: SyncProvider,
  startDate: string,
  endDate: string,
  ordersCount: number,
  byteSize: number
): void {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    const catalog: Record<string, CatalogEntry> = raw ? JSON.parse(raw) : {};
    catalog[key] = {
      key,
      provider,
      startDate,
      endDate,
      ordersCount,
      byteSize,
      updatedAt: Date.now(),
    };
    localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
  } catch {}
}

/**
 * Prunes older API sync entries to free up localStorage for active datasets.
 */
export function pruneOldestSyncCaches(preserveKey?: string): number {
  if (typeof window === 'undefined') return 0;
  let pruned = 0;

  try {
    const syncKeys: { key: string; time: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('deen_sync_') && k !== preserveKey) {
        try {
          const raw = localStorage.getItem(k);
          const parsed = raw ? JSON.parse(raw) : null;
          syncKeys.push({ key: k, time: parsed?.cachedAt || 0 });
        } catch {
          syncKeys.push({ key: k, time: 0 });
        }
      }
    }

    // Sort oldest first
    syncKeys.sort((a, b) => a.time - b.time);

    // Evict oldest 50%
    const evictCount = Math.max(1, Math.ceil(syncKeys.length / 2));
    for (let i = 0; i < evictCount && i < syncKeys.length; i++) {
      localStorage.removeItem(syncKeys[i].key);
      pruned++;
    }
  } catch (e) {
    console.error('[ApiCache] Error during pruning:', e);
  }

  return pruned;
}

/**
 * Clears all cached sync responses for WooCommerce & Pathao.
 */
export function clearAllSyncCaches(provider?: SyncProvider): number {
  if (typeof window === 'undefined') return 0;
  let cleared = 0;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('deen_sync_')) {
        if (!provider || k.includes(`_${provider}_`)) {
          keysToRemove.push(k);
        }
      }
    }

    for (const k of keysToRemove) {
      localStorage.removeItem(k);
      cleared++;
    }

    if (!provider) {
      localStorage.removeItem(CATALOG_KEY);
    }
  } catch (e) {
    console.error('[ApiCache] Error clearing sync caches:', e);
  }

  return cleared;
}

/**
 * Returns summary statistics of cached API datasets.
 */
export function getSyncCacheStats(): {
  totalCachedEntries: number;
  wcEntriesCount: number;
  pathaoEntriesCount: number;
  totalCachedBytes: number;
  savedApiCallsEstimate: number;
} {
  if (typeof window === 'undefined') {
    return {
      totalCachedEntries: 0,
      wcEntriesCount: 0,
      pathaoEntriesCount: 0,
      totalCachedBytes: 0,
      savedApiCallsEstimate: 0,
    };
  }

  let totalCachedEntries = 0;
  let wcEntriesCount = 0;
  let pathaoEntriesCount = 0;
  let totalCachedBytes = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('deen_sync_')) {
        const val = localStorage.getItem(k) || '';
        totalCachedBytes += new Blob([k, val]).size;
        totalCachedEntries++;
        if (k.includes('_woocommerce_')) wcEntriesCount++;
        if (k.includes('_pathao_')) pathaoEntriesCount++;
      }
    }
  } catch {}

  return {
    totalCachedEntries,
    wcEntriesCount,
    pathaoEntriesCount,
    totalCachedBytes,
    savedApiCallsEstimate: totalCachedEntries * 3, // Each sync typically does 2-4 page queries
  };
}
