/**
 * Pathao Customer Rating & Delivery Intelligence Engine
 * 
 * Provides verified courier rating, delivery success rate, and RTO risk assessment
 * by customer phone number across Pathao Courier network and DEEN historical fulfillment records.
 */

import { getBaselineDataset } from './baselineLoader';
import { getSecretsWithOverrides } from './secrets';
import { getPathaoToken, PathaoCredentials } from './pathaoClient';
import { RawOrderRow } from '@/types';
import {
  CustomerRatingTier,
  CustomerRatingData,
  PhoneStats,
  normalizeCustomerPhone,
  deriveRatingFromStats,
} from './customerRatingTypes';

export {
  type CustomerRatingTier,
  type CustomerRatingData,
  type PhoneStats,
  normalizeCustomerPhone,
  deriveRatingFromStats,
};

let cachedStoreHistoryIndex: Map<string, PhoneStats> | null = null;
const ratingMemoryCache = new Map<string, CustomerRatingData>();

/**
 * Builds or retrieves the indexed store history map from baseline delivery records.
 */
export function getStoreHistoryIndex(): Map<string, PhoneStats> {
  if (cachedStoreHistoryIndex) return cachedStoreHistoryIndex;

  const map = new Map<string, PhoneStats>();
  const addRecord = (rawPhone: unknown, statusStr: unknown) => {
    const { suffix10 } = normalizeCustomerPhone(rawPhone);
    if (!suffix10 || suffix10 === '952700500') return; // Exclude central return warehouse phone

    if (!map.has(suffix10)) {
      map.set(suffix10, { delivered: 0, returned: 0, total: 0 });
    }
    const stat = map.get(suffix10)!;
    stat.total++;

    const s = String(statusStr || '').toLowerCase();
    if (s.includes('return') || s.includes('cancel') || s.includes('failed') || s.includes('rto')) {
      stat.returned++;
    } else if (s.includes('delivered') || s.includes('completed') || s.includes('received') || s.includes('paid')) {
      stat.delivered++;
    } else {
      // If ambiguous in-transit/pending, assume positive trend if not marked return
      stat.delivered++;
    }
  };

  try {
    const b = getBaselineDataset() as unknown as Record<string, unknown>;
    const pathaoList = (b?.pathaoDelivery as Record<string, unknown>[]) || [];
    for (const row of pathaoList) {
      addRecord(row['Recipient phone'] || row.recipient_phone, row['Order status'] || row.order_status);
    }

    const returnList = (b?.returns as Record<string, unknown>[]) || [];
    for (const row of returnList) {
      const { suffix10 } = normalizeCustomerPhone(row.Phone || row.phone);
      if (suffix10 && map.has(suffix10)) {
        // Return confirmed
        const stat = map.get(suffix10)!;
        stat.returned++;
        stat.total = Math.max(stat.total, stat.delivered + stat.returned);
      }
    }
  } catch (err) {
    console.warn('Error indexing customer history for delivery rating:', err);
  }

  cachedStoreHistoryIndex = map;
  return map;
}

/**
 * Derives a structured CustomerRatingData object from empirical delivery statistics.
 */
export async function fetchPathaoCustomerRating(
  phone: string,
  credentials?: PathaoCredentials
): Promise<CustomerRatingData | null> {
  const { full } = normalizeCustomerPhone(phone);
  if (!full || full.length < 10) return null;

  // Check cache
  const cached = ratingMemoryCache.get(full);
  if (cached && cached.source === 'PATHAO') return cached;

  const { pathao } = getSecretsWithOverrides({ pathao: credentials });
  if (!pathao.client_id || !pathao.client_secret) {
    return null; // Pathao credentials unconfigured, proceed to fallback
  }

  try {
    const token = await getPathaoToken(credentials);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    try {
      // 1. Try official user success endpoint: /aladdin/api/v1/user/success
      const endpoints = [
        `${pathao.base_url.replace(/\/+$/, '')}/aladdin/api/v1/user/success`,
        `https://merchant.pathao.com/api/v1/user/success`,
        `${pathao.base_url.replace(/\/+$/, '')}/aladdin/api/v1/user/success-rate`,
      ];

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 DEEN-Commerce-Engine/2.0 (Customer-Rating-Audit)',
            },
            body: JSON.stringify({ phone: full }),
          });

          if (res.ok) {
            const json = await res.json().catch(() => null);
            const data = json?.data?.data || json?.data || json;
            if (data && typeof data === 'object') {
              const delivered = parseInt(String(data.delivered || data.delivered_orders || data.success_count || 0), 10) || 0;
              const returned = parseInt(String(data.returned || data.return || data.returned_orders || data.failed_count || 0), 10) || 0;
              const total = parseInt(String(data.total || data.total_orders || delivered + returned), 10) || (delivered + returned);
              const rawRate = parseFloat(String(data.delivery_rate || data.success_rate || data.rate || 0));
              const successRate = !isNaN(rawRate) && rawRate > 0
                ? Math.round(rawRate > 1 ? rawRate : rawRate * 100)
                : (total > 0 ? Math.round((delivered / total) * 100) : 100);

              const rawTag = String(data.customer_rating || data.rating || data.risk_level || '');

              const stats: PhoneStats = { delivered, returned, total };
              const resolved = deriveRatingFromStats(full, stats, 'PATHAO', rawTag);
              if (rawRate > 0) resolved.successRate = successRate;

              ratingMemoryCache.set(full, resolved);
              return resolved;
            }
          }
        } catch {
          // Continue to next endpoint fallback
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    // Graceful fallback on token/network failure
  }

  return null;
}

/**
 * Resolves customer rating for a phone number with zero hallucination.
 * Queries Pathao live API when available, falling back seamlessly to historical delivery records.
 */
export async function resolveCustomerRating(
  phone: string,
  options?: {
    credentials?: PathaoCredentials;
    liveOrders?: RawOrderRow[];
  }
): Promise<CustomerRatingData> {
  const { full, suffix10 } = normalizeCustomerPhone(phone);
  if (!full) {
    return {
      phone: String(phone || 'N/A'),
      normalizedPhone: '',
      ratingTier: 'NEW',
      ratingLabel: 'New Customer',
      successRate: 100,
      totalOrders: 0,
      deliveredOrders: 0,
      returnedOrders: 0,
      riskLevel: 'LOW',
      source: 'STORE_HISTORY',
      courierNotes: 'Unspecified phone number.',
    };
  }

  // 1. Try Pathao Live API if credentials available
  try {
    const pathaoResult = await fetchPathaoCustomerRating(full, options?.credentials);
    if (pathaoResult && pathaoResult.totalOrders > 0) {
      return pathaoResult;
    }
  } catch {
    // Fallback to store history
  }

  // 2. Fallback to Store History & Reconciled Orders Index
  const storeMap = getStoreHistoryIndex();
  let stats = storeMap.get(suffix10) || null;

  // Augment with any live/active orders passed in
  if (options?.liveOrders && options.liveOrders.length > 0) {
    for (const o of options.liveOrders) {
      const oNorm = normalizeCustomerPhone(o.Phone || (o as Record<string, unknown>).phone);
      if (oNorm.suffix10 === suffix10) {
        if (!stats) stats = { delivered: 0, returned: 0, total: 0 };
        const status = String(o['Delivery Status'] || o['Order status'] || '').toLowerCase();
        if (status.includes('return') || status.includes('cancel') || status.includes('failed') || status.includes('rto')) {
          stats.returned++;
          stats.total++;
        } else if (status.includes('delivered') || status.includes('shipped') || status.includes('completed') || status.includes('received') || status.includes('paid')) {
          stats.delivered++;
          stats.total++;
        }
      }
    }
  }

  const result = deriveRatingFromStats(phone, stats, 'STORE_HISTORY');
  ratingMemoryCache.set(full, result);
  return result;
}

/**
 * Batch resolves customer ratings for a list of phone numbers with controlled concurrency.
 */
export async function batchResolveCustomerRatings(
  phones: string[],
  options?: {
    credentials?: PathaoCredentials;
    liveOrders?: RawOrderRow[];
    skipPathaoApi?: boolean;
  }
): Promise<Record<string, CustomerRatingData>> {
  const results: Record<string, CustomerRatingData> = {};
  const uniquePhones = Array.from(new Set(phones.filter(Boolean)));
  const storeMap = getStoreHistoryIndex();

  // 1. First pass: immediate synchronous resolution from historical store records
  const needPathaoQuery: string[] = [];

  for (const p of uniquePhones) {
    const { full, suffix10 } = normalizeCustomerPhone(p);
    if (!full) continue;

    // Check memory cache
    if (ratingMemoryCache.has(full)) {
      results[full] = ratingMemoryCache.get(full)!;
      results[p] = results[full];
      continue;
    }

    const stats = storeMap.get(suffix10) || null;
    const historyRating = deriveRatingFromStats(p, stats, 'STORE_HISTORY');
    results[full] = historyRating;
    results[p] = historyRating;

    if (!options?.skipPathaoApi) {
      needPathaoQuery.push(full);
    }
  }

  // 2. Second pass: enrich with Pathao API if requested and credentials available
  if (needPathaoQuery.length > 0 && !options?.skipPathaoApi) {
    const querySlice = needPathaoQuery.slice(0, 20); // Cap batch at 20 per call for latency guarantee
    const queue = [...querySlice];
    const worker = async () => {
      while (queue.length > 0) {
        const ph = queue.shift();
        if (!ph) break;
        try {
          const pathaoData = await fetchPathaoCustomerRating(ph, options?.credentials);
          if (pathaoData && pathaoData.totalOrders > 0) {
            results[ph] = pathaoData;
            ratingMemoryCache.set(ph, pathaoData);
          }
        } catch {
          // Keep store history fallback
        }
      }
    };

    const workers = Array.from({ length: Math.min(3, queue.length) }, () => worker());
    await Promise.all(workers);
  }

  return results;
}
