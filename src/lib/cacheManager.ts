/**
 * DEEN Commerce Reconciliation Engine — Local Cache Management System
 * High-performance browser caching engine with TTL validation, quota eviction,
 * storage diagnostics, and bulk inspection operations.
 */

import { getCookieDetails, getAllCookies } from './cookieManager';

export type CacheTag = 'dataset' | 'reconciliation' | 'api' | 'settings' | 'general';

export interface CacheEnvelope<T = unknown> {
  key: string;
  data: T;
  timestamp: number;
  ttlMs: number; // 0 = indefinite (no automatic expiration)
  tag: CacheTag;
  version: string;
  byteSize: number;
}

export interface CacheEntrySummary {
  key: string;
  name: string;
  tag: CacheTag;
  byteSize: number;
  formattedSize: string;
  timestamp: number;
  formattedAge: string;
  ttlMs: number;
  expiryStatus: string;
  isExpired: boolean;
  itemCount?: number;
}

export interface StorageEstimateResult {
  totalStorageBytes: number;
  formattedTotalStorage: string;
  deenCacheBytes: number;
  formattedDeenCache: string;
  cookieBytes: number;
  formattedCookieBytes: string;
  itemCount: number;
  quotaEstimateBytes: number;
  percentUsed: number;
  health: 'healthy' | 'moderate' | 'warning';
}

export const DEEN_CACHE_PREFIX = 'deen_cache_';
export const CURRENT_CACHE_VERSION = '2.6.0';

export const DEEN_CACHE_KEYS = {
  ACTIVE_DATASET: 'deen_cache_active_dataset',
  SAMPLE_BASELINE: 'deen_cache_sample_baseline',
  RECONCILIATION_RESULT: 'deen_cache_reconciliation_result',
  PATHAO_SYNC: 'deen_cache_pathao_sync',
  WC_SYNC: 'deen_cache_wc_sync',
  AUDIT_LOGS: 'deen_cache_audit_logs',
  LIVE_TERMINAL: 'deen_cache_live_terminal',
  SETTINGS: 'deen_app_settings_v2',
  THEME: 'deen_theme_settings_v2',
  OVERRIDES: 'deen_order_status_overrides_v1'
} as const;

// Friendly human names for dashboard cache entries
const CACHE_KEY_NAMES: Record<string, { name: string; tag: CacheTag }> = {
  deen_cache_active_dataset: { name: 'Active Working Dataset (Orders & Returns)', tag: 'dataset' },
  deen_cache_sample_baseline: { name: 'September 1,026 Clean Orders Baseline', tag: 'dataset' },
  deen_cache_reconciliation_result: { name: 'Reconciliation Engine Computed Snapshot', tag: 'reconciliation' },
  deen_cache_pathao_sync: { name: 'Pathao Courier API Sync Cache', tag: 'api' },
  deen_cache_wc_sync: { name: 'WooCommerce Store API Sync Cache', tag: 'api' },
  deen_cache_live_terminal: { name: 'Live Orders Terminal Snapshot (WC & Hermes)', tag: 'api' },
  deen_cache_audit_logs: { name: 'Reconciliation Activity Audit Logs', tag: 'settings' },
  deen_app_settings_v2: { name: 'Application Parameters & Business Model Rules', tag: 'settings' },
  deen_theme_settings_v2: { name: 'Appearance, Custom Theme & Canvas Settings', tag: 'settings' },
  deen_order_status_overrides_v1: { name: 'Manual Order Status & Financial Overrides', tag: 'settings' }
};

/**
 * Format bytes into human-readable string (e.g. 1.2 KB, 3.4 MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format time elapsed into a friendly age string (e.g. 'Just now', '12m ago', '3h ago')
 */
export function formatTimeAge(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 5000) return 'Just now';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Store an item in the local cache with TTL, category tag, and quota safeguards.
 */
export function setCacheItem<T = unknown>(
  key: string,
  data: T,
  options?: { ttlMs?: number; tag?: CacheTag }
): boolean {
  if (typeof window === 'undefined') return false;

  const ttlMs = options?.ttlMs ?? 0; // 0 = indefinite
  const tag = options?.tag ?? 'general';

  try {
    const rawData = JSON.stringify(data);
    const byteSize = new Blob([rawData]).size;

    const envelope: CacheEnvelope<T> = {
      key,
      data,
      timestamp: Date.now(),
      ttlMs,
      tag,
      version: CURRENT_CACHE_VERSION,
      byteSize
    };

    const serialized = JSON.stringify(envelope);

    try {
      localStorage.setItem(key, serialized);
      if (byteSize > 250 * 1024) {
        setIndexedDbItem(key, data, ttlMs).catch(() => {});
      }
      return true;
    } catch (quotaErr) {
      // Storage quota exceeded — attempt emergency eviction of expired or non-critical cache
      console.warn('[CacheManager] LocalStorage quota exceeded. Evicting expired/API caches...', quotaErr);
      evictExpiredAndApiCaches();

      // Retry once after eviction
      try {
        localStorage.setItem(key, serialized);
        return true;
      } catch {
        console.warn('[CacheManager] LocalStorage quota still full. Persisting to IndexedDB store:', key);
        setIndexedDbItem(key, data, ttlMs).catch(() => {});
        return true;
      }
    }
  } catch (err) {
    console.error(`[CacheManager] Failed to serialize cache item for key "${key}":`, err);
    return false;
  }
}

/**
 * Retrieve an item from the cache. Returns null if missing, corrupted, or expired.
 */
export function getCacheItem<T = unknown>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    let envelope: CacheEnvelope<T>;
    try {
      envelope = JSON.parse(raw);
    } catch {
      // If it's a plain raw JSON string (e.g. legacy store), parse directly
      return JSON.parse(raw) as T;
    }

    // Check if item has standard cache envelope structure
    if (envelope && typeof envelope === 'object' && 'timestamp' in envelope && 'data' in envelope) {
      // Verify TTL expiration
      if (envelope.ttlMs > 0) {
        const age = Date.now() - envelope.timestamp;
        if (age > envelope.ttlMs) {
          console.info(`[CacheManager] Cache entry "${key}" expired (${age}ms > ${envelope.ttlMs}ms). Removing.`);
          localStorage.removeItem(key);
    removeIndexedDbItem(key).catch(() => {});
          return null;
        }
      }
      return envelope.data;
    }

    // Fallback if key is stored without envelope
    return envelope as unknown as T;
  } catch (err) {
    console.error(`[CacheManager] Error reading cache item "${key}":`, err);
    return null;
  }
}

/**
 * Remove a specific cache item from localStorage.
 */

// ── High-Performance Native IndexedDB Storage Engine (Zero-Dependency) ──
const IDB_NAME = 'deen_reconciliation_store';
const IDB_VERSION = 1;
const IDB_STORE = 'large_cache_entries';

function openIndexedDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Stores large datasets (> 250 KB or exceeding localStorage quota) in IndexedDB.
 */
export async function setIndexedDbItem<T>(key: string, data: T, ttlMs = 0): Promise<boolean> {
  const db = await openIndexedDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put({
        key,
        data,
        timestamp: Date.now(),
        ttlMs,
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Retrieves large cached dataset from IndexedDB with TTL verification.
 */
export async function getIndexedDbItem<T>(key: string): Promise<T | null> {
  const db = await openIndexedDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        const entry = req.result;
        if (!entry) return resolve(null);
        if (entry.ttlMs > 0 && Date.now() - entry.timestamp > entry.ttlMs) {
          try {
            const delTx = db.transaction(IDB_STORE, 'readwrite');
            delTx.objectStore(IDB_STORE).delete(key);
          } catch {}
          return resolve(null);
        }
        resolve(entry.data as T);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Removes an item from IndexedDB.
 */
export async function removeIndexedDbItem(key: string): Promise<boolean> {
  const db = await openIndexedDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Asynchronously retrieves item, checking localStorage first, then IndexedDB fallback.
 */
export async function getCacheItemAsync<T>(key: string): Promise<T | null> {
  const local = getCacheItem<T>(key);
  if (local !== null) return local;
  return getIndexedDbItem<T>(key);
}

export function removeCacheItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.error(`[CacheManager] Failed to remove item "${key}":`, err);
  }
}

/**
 * Check if a cache item exists and is still valid.
 */
export function hasCacheItem(key: string): boolean {
  return getCacheItem(key) !== null;
}

/**
 * Evict all expired items and temporary API synchronization responses.
 */
export function evictExpiredAndApiCaches(): number {
  if (typeof window === 'undefined') return 0;
  let evicted = 0;
  const now = Date.now();

  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }

    for (const k of keys) {
      if (!k.startsWith('deen_')) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;

      try {
        const env = JSON.parse(raw);
        if (env && typeof env === 'object' && env.timestamp && env.ttlMs) {
          if (now - env.timestamp > env.ttlMs) {
            localStorage.removeItem(k);
            evicted++;
            continue;
          }
        }
        // If it's a transient API response, evict during quota pressure
        if (k.includes('_api_') || k.includes('pathao_sync') || k.includes('wc_sync')) {
          localStorage.removeItem(k);
          evicted++;
        }
      } catch {}
    }
  } catch (err) {
    console.error('[CacheManager] Error during cache eviction:', err);
  }

  return evicted;
}

/**
 * Inspect and return summaries of all DEEN cache entries currently in browser memory.
 */
export function getAllCacheEntries(): CacheEntrySummary[] {
  if (typeof window === 'undefined') return [];
  const entries: CacheEntrySummary[] = [];
  const now = Date.now();

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('deen_')) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const byteSize = new Blob([raw]).size;
      let meta = CACHE_KEY_NAMES[key];
      if (!meta && key.startsWith('deen_sync_')) {
        const parts = key.split('_');
        const providerName = parts[2] === 'woocommerce' ? 'WooCommerce Orders' : parts[2] === 'pathao' ? 'Pathao Courier' : 'API Sync';
        const start = parts[3] || '';
        const end = parts[4] || '';
        meta = {
          name: `${providerName} Cache (${start} → ${end})`,
          tag: 'api' as CacheTag
        };
      }
      if (!meta) {
        meta = {
          name: key.replace(/_/g, ' ').replace(/^deen\s+/i, ''),
          tag: 'general' as CacheTag
        };
      }

      let timestamp = Date.now();
      let ttlMs = 0;
      let tag: CacheTag = meta.tag;
      let itemCount: number | undefined = undefined;

      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if ('timestamp' in parsed) timestamp = parsed.timestamp;
          else if ('cachedAt' in parsed) timestamp = parsed.cachedAt;
          if ('ttlMs' in parsed) ttlMs = parsed.ttlMs;
          if ('tag' in parsed) tag = parsed.tag;
          if ('ordersCount' in parsed && typeof parsed.ordersCount === 'number') {
            itemCount = parsed.ordersCount;
          } else if ('data' in parsed) {
            if (Array.isArray(parsed.data)) itemCount = parsed.data.length;
            else if (parsed.data && typeof parsed.data === 'object' && 'orders' in parsed.data && Array.isArray(parsed.data.orders)) {
              itemCount = parsed.data.orders.length;
            }
          } else if (Array.isArray(parsed)) {
            itemCount = parsed.length;
          }
        }
      } catch {}

      const ageMs = now - timestamp;
      const isExpired = ttlMs > 0 && ageMs > ttlMs;

      let expiryStatus = 'Permanent / Manual';
      if (ttlMs > 0) {
        if (isExpired) {
          expiryStatus = 'Expired';
        } else {
          const remainingSec = Math.round((ttlMs - ageMs) / 1000);
          if (remainingSec < 60) expiryStatus = `${remainingSec}s left`;
          else if (remainingSec < 3600) expiryStatus = `${Math.round(remainingSec / 60)}m left`;
          else expiryStatus = `${Math.round(remainingSec / 3600)}h left`;
        }
      }

      entries.push({
        key,
        name: meta.name,
        tag,
        byteSize,
        formattedSize: formatBytes(byteSize),
        timestamp,
        formattedAge: formatTimeAge(timestamp),
        ttlMs,
        expiryStatus,
        isExpired,
        itemCount
      });
    }
  } catch (err) {
    console.error('[CacheManager] Error scanning cache entries:', err);
  }

  // Sort by byteSize descending
  return entries.sort((a, b) => b.byteSize - a.byteSize);
}

/**
 * Remove all cache entries associated with a specific tag (e.g. 'api', 'dataset').
 */
export function clearCacheByTag(targetTag: CacheTag): number {
  if (typeof window === 'undefined') return 0;
  const entries = getAllCacheEntries();
  let count = 0;

  for (const entry of entries) {
    if (entry.tag === targetTag) {
      removeCacheItem(entry.key);
      count++;
    }
  }

  return count;
}

/**
 * Clear all DEEN cache entries and working datasets (leaves basic theme & settings intact if preserveSettings is true).
 */
export function clearAllDeenCache(preserveSettings = true): number {
  if (typeof window === 'undefined') return 0;
  let cleared = 0;

  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('deen_')) keys.push(k);
    }

    for (const k of keys) {
      if (preserveSettings && (k === DEEN_CACHE_KEYS.SETTINGS || k === DEEN_CACHE_KEYS.THEME)) {
        continue;
      }
      localStorage.removeItem(k);
      cleared++;
    }
  } catch (err) {
    console.error('[CacheManager] Error purging DEEN cache:', err);
  }

  return cleared;
}

/**
 * Compute real-time storage metrics across LocalStorage and Cookies.
 */
export function getStorageEstimate(): StorageEstimateResult {
  if (typeof window === 'undefined') {
    return {
      totalStorageBytes: 0,
      formattedTotalStorage: '0 B',
      deenCacheBytes: 0,
      formattedDeenCache: '0 B',
      cookieBytes: 0,
      formattedCookieBytes: '0 B',
      itemCount: 0,
      quotaEstimateBytes: 5 * 1024 * 1024,
      percentUsed: 0,
      health: 'healthy'
    };
  }

  let totalStorageBytes = 0;
  let deenCacheBytes = 0;
  let itemCount = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key) || '';
      const bytes = new Blob([`${key}${val}`]).size;
      totalStorageBytes += bytes;
      itemCount++;
      if (key.startsWith('deen_')) {
        deenCacheBytes += bytes;
      }
    }
  } catch {}

  // Calculate Cookie Storage
  const cookieDetails = getCookieDetails();
  const cookieBytes = cookieDetails.reduce((sum, c) => sum + c.sizeBytes, 0);

  // Standard browser LocalStorage quota is approximately 5MB (5,242,880 bytes)
  const quotaEstimateBytes = 5 * 1024 * 1024;
  const percentUsed = Math.min(100, Math.round((totalStorageBytes / quotaEstimateBytes) * 100));

  let health: StorageEstimateResult['health'] = 'healthy';
  if (percentUsed >= 85) health = 'warning';
  else if (percentUsed >= 60) health = 'moderate';

  return {
    totalStorageBytes,
    formattedTotalStorage: formatBytes(totalStorageBytes),
    deenCacheBytes,
    formattedDeenCache: formatBytes(deenCacheBytes),
    cookieBytes,
    formattedCookieBytes: formatBytes(cookieBytes),
    itemCount,
    quotaEstimateBytes,
    percentUsed,
    health
  };
}

/**
 * Exports complete workspace storage (cache, cookies, settings, and overrides) as a JSON string.
 */
export function exportEntireWorkspaceStorageJSON(): string {
  if (typeof window === 'undefined') return '{}';

  const snapshot: {
    exportedAt: string;
    engineVersion: string;
    localStorage: Record<string, unknown>;
    cookies: Record<string, string>;
  } = {
    exportedAt: new Date().toISOString(),
    engineVersion: CURRENT_CACHE_VERSION,
    localStorage: {},
    cookies: getAllCookies()
  };

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('deen_')) {
        const val = localStorage.getItem(key);
        try {
          snapshot.localStorage[key] = val ? JSON.parse(val) : null;
        } catch {
          snapshot.localStorage[key] = val;
        }
      }
    }
  } catch (err) {
    console.error('[CacheManager] Error building export snapshot:', err);
  }

  return JSON.stringify(snapshot, null, 2);
}

/**
 * Restores workspace storage from an exported JSON string.
 */
export function importWorkspaceStorageJSON(jsonString: string): { success: boolean; importedKeys: number; error?: string } {
  if (typeof window === 'undefined') return { success: false, importedKeys: 0, error: 'SSR environment' };

  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, importedKeys: 0, error: 'Invalid JSON payload format.' };
    }

    let importedKeys = 0;

    // Restore LocalStorage items
    if (parsed.localStorage && typeof parsed.localStorage === 'object') {
      for (const [key, value] of Object.entries(parsed.localStorage as Record<string, unknown>)) {
        if (typeof key === 'string' && key.startsWith('deen_')) {
          const stringified = typeof value === 'string' ? value : JSON.stringify(value);
          localStorage.setItem(key, stringified);
          importedKeys++;
        }
      }
    }

    return { success: true, importedKeys };
  } catch (err: unknown) {
    return { success: false, importedKeys: 0, error: err instanceof Error ? err.message : String(err) };
  }
}
