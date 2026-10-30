import { NextResponse } from 'next/server';
import crypto from 'crypto';

export type CacheProfileKey =
  | 'STATIC_DATASET'   // e.g. /api/sample-data (1hr edge cache, 24hr SWR)
  | 'CLOUD_DATASET'    // e.g. /api/blob/dataset (60s edge cache, 5min SWR)
  | 'ANALYTICS_REPORT' // e.g. /api/analytics/meta, ga4, overview (5min edge cache, 15min SWR)
  | 'CUSTOMER_RATING'  // e.g. /api/courier/customer-rating (1hr edge cache, 24hr SWR)
  | 'SYSTEM_STATUS'    // e.g. /api/sync/status, /api/blob/status (30s edge cache, 60s SWR)
  | 'STATIC_ASSET'     // Static files, icons, logos (1yr immutable)
  | 'PRIVATE_MUTATION'; // Inbound webhooks, mutations, login/auth

export interface CacheProfileConfig {
  cacheControl: string;
  cdnCacheControl?: string;
  vercelCdnCacheControl?: string;
  revalidateSeconds?: number;
  vary?: string;
}

export const EDGE_CACHE_PROFILES: Record<CacheProfileKey, CacheProfileConfig> = {
  STATIC_DATASET: {
    cacheControl: 'public, s-maxage=3600, stale-while-revalidate=86400',
    cdnCacheControl: 'public, s-maxage=3600, stale-while-revalidate=86400',
    vercelCdnCacheControl: 'public, s-maxage=3600, stale-while-revalidate=86400',
    revalidateSeconds: 3600,
    vary: 'Accept-Encoding, Authorization',
  },
  CLOUD_DATASET: {
    cacheControl: 'public, s-maxage=60, stale-while-revalidate=300',
    cdnCacheControl: 'public, s-maxage=60, stale-while-revalidate=300',
    vercelCdnCacheControl: 'public, s-maxage=60, stale-while-revalidate=300',
    revalidateSeconds: 60,
    vary: 'Accept-Encoding, Authorization, Cookie',
  },
  ANALYTICS_REPORT: {
    cacheControl: 'public, s-maxage=300, stale-while-revalidate=900',
    cdnCacheControl: 'public, s-maxage=300, stale-while-revalidate=900',
    vercelCdnCacheControl: 'public, s-maxage=300, stale-while-revalidate=900',
    revalidateSeconds: 300,
    vary: 'Accept-Encoding, Authorization',
  },
  CUSTOMER_RATING: {
    cacheControl: 'public, s-maxage=3600, stale-while-revalidate=86400',
    cdnCacheControl: 'public, s-maxage=3600, stale-while-revalidate=86400',
    revalidateSeconds: 3600,
    vary: 'Accept-Encoding',
  },
  SYSTEM_STATUS: {
    cacheControl: 'public, s-maxage=30, stale-while-revalidate=60',
    cdnCacheControl: 'public, s-maxage=30, stale-while-revalidate=60',
    vercelCdnCacheControl: 'public, s-maxage=30, stale-while-revalidate=60',
    revalidateSeconds: 30,
    vary: 'Accept-Encoding, Authorization',
  },
  STATIC_ASSET: {
    cacheControl: 'public, max-age=31536000, immutable',
    cdnCacheControl: 'public, max-age=31536000, immutable',
    revalidateSeconds: 31536000,
  },
  PRIVATE_MUTATION: {
    cacheControl: 'private, no-cache, no-store, must-revalidate',
    cdnCacheControl: 'no-store',
    vercelCdnCacheControl: 'no-store',
    revalidateSeconds: 0,
  },
};

/**
 * Computes a standardized HTTP header dictionary for edge CDN caching on Vercel.
 */
export function getEdgeCacheHeaders(
  profileKey: CacheProfileKey,
  options?: { etag?: string; isPrivate?: boolean }
): Record<string, string> {
  const profile = EDGE_CACHE_PROFILES[profileKey];
  const headers: Record<string, string> = {
    'Cache-Control': options?.isPrivate
      ? 'private, no-cache, no-store, must-revalidate'
      : profile.cacheControl,
  };

  if (!options?.isPrivate) {
    if (profile.cdnCacheControl) {
      headers['CDN-Cache-Control'] = profile.cdnCacheControl;
    }
    if (profile.vercelCdnCacheControl) {
      headers['Vercel-CDN-Cache-Control'] = profile.vercelCdnCacheControl;
    }
    if (profile.vary) {
      headers['Vary'] = profile.vary;
    }
  }

  if (options?.etag) {
    headers['ETag'] = options.etag;
  }

  return headers;
}

/**
 * Deterministically generates a strong or weak HTTP ETag hash from any serializable payload.
 */
export function generateETag(payload: unknown, weak = true): string {
  try {
    const rawStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const hash = crypto.createHash('sha1').update(rawStr).digest('hex').slice(0, 20);
    return weak ? `W/"${hash}"` : `"${hash}"`;
  } catch {
    const fallbackHash = Math.random().toString(36).substring(2, 12);
    return weak ? `W/"${fallbackHash}"` : `"${fallbackHash}"`;
  }
}

/**
 * Checks whether the incoming request's If-None-Match header matches the current ETag.
 */
export function isClientFresh(req: Request | Headers, currentETag: string): boolean {
  if (!currentETag) return false;
  const headers = req instanceof Request ? req.headers : req;
  const clientEtag = headers.get('if-none-match');
  if (!clientEtag) return false;

  const normalize = (tag: string) => tag.replace(/^W\//, '').replace(/"/g, '').trim();
  const currentNormalized = normalize(currentETag);

  if (clientEtag === '*') return true;
  const clientTags = clientEtag.split(',').map((t) => normalize(t));
  return clientTags.includes(currentNormalized);
}

/**
 * Creates an empty HTTP 304 Not Modified response, preserving Edge CDN caching headers.
 */
export function createNotModifiedResponse(
  etag: string,
  profileKey: CacheProfileKey = 'STATIC_DATASET'
): NextResponse {
  const headers = getEdgeCacheHeaders(profileKey, { etag });
  return new NextResponse(null, {
    status: 304,
    headers,
  });
}

/**
 * Helper to construct a cached JSON NextResponse with edge caching headers and an ETag.
 */
export function jsonWithEdgeCache<T>(
  data: T,
  profileKey: CacheProfileKey,
  options?: { req?: Request; etag?: string; isPrivate?: boolean; status?: number }
): NextResponse {
  const etag = options?.etag || generateETag(data);

  if (options?.req && isClientFresh(options.req, etag)) {
    return createNotModifiedResponse(etag, profileKey);
  }

  const cacheHeaders = getEdgeCacheHeaders(profileKey, {
    etag,
    isPrivate: options?.isPrivate,
  });

  return NextResponse.json(data, {
    status: options?.status || 200,
    headers: cacheHeaders,
  });
}

/**
 * Trims raw objects by removing empty strings, null, and undefined values to reduce JSON wire size.
 */
export function stripEmptyProperties<T extends Record<string, unknown>>(obj: T): Partial<T> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      const nested = stripEmptyProperties(value as Record<string, unknown>);
      if (Object.keys(nested).length > 0) {
        cleaned[key] = nested;
      }
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned as Partial<T>;
}

/**
 * Whitelist of metadata keys required for outlet operations, courier tracking, and reconciliation.
 * Drops hundreds of internal WordPress hooks, session tokens, and plugin debug logs.
 */
const ESSENTIAL_WC_META_KEYS = new Set([
  '_sip_outlet_id',
  '_sip_created_by',
  '_created_via',
  'created_via',
  '_pos_register_domain',
  '_sip_pos_order',
  'ptc_consignment_id',
  '_ptc_consignment_id',
  'ptc_status',
  '_ptc_status',
  'tracking_number',
  '_sip_waterfall_deductions',
  '_sip_exchange_of',
  '_sip_exchange_order',
  '_sip_exchange_code',
  'custom_order_status',
  'substatus',
  'sub_status',
]);

/**
 * Trims a raw WooCommerce order into an ultra-lean payload containing only the exact
 * fields needed by OutletSalesTab, LiveOpsTab, and the order reconciliation engine.
 * Eliminates ~80-90% of raw order byte weight by pruning unneeded fields.
 */
export function trimWooCommerceOrder(rawOrder: Record<string, unknown>): Record<string, unknown> {
  if (!rawOrder || typeof rawOrder !== 'object') return rawOrder;

  const rawMeta = Array.isArray(rawOrder.meta_data)
    ? (rawOrder.meta_data as Array<{ key?: string; value?: unknown }>)
    : [];

  const prunedMeta = rawMeta
    .filter((m) => m && m.key && ESSENTIAL_WC_META_KEYS.has(m.key))
    .map((m) => ({ key: m.key, value: m.value }));

  const rawLineItems = Array.isArray(rawOrder.line_items)
    ? (rawOrder.line_items as Array<Record<string, unknown>>)
    : [];

  const prunedLineItems = rawLineItems.map((item) => ({
    id: item.id,
    name: item.name || item.parent_name || 'Item',
    sku: item.sku || 'N/A',
    quantity: item.quantity || 1,
    price: item.price || 0,
    total: item.total || 0,
    meta_data: Array.isArray(item.meta_data)
      ? (item.meta_data as Array<{ key?: string; value?: unknown }>)
          .filter((m) => m && m.key && (m.key.startsWith('_sip_') || m.key === 'size' || m.key === 'pa_size'))
          .map((m) => ({ key: m.key, value: m.value }))
      : undefined,
  }));

  const billing = (rawOrder.billing || {}) as Record<string, unknown>;
  const shipping = (rawOrder.shipping || {}) as Record<string, unknown>;

  return {
    id: rawOrder.id,
    number: rawOrder.number || rawOrder.id,
    status: rawOrder.status,
    total: rawOrder.total,
    date_created: rawOrder.date_created,
    date_modified: rawOrder.date_modified || rawOrder.date_modified_gmt,
    payment_method: rawOrder.payment_method,
    payment_method_title: rawOrder.payment_method_title,
    discount_total: rawOrder.discount_total || 0,
    customer_note: rawOrder.customer_note || undefined,
    billing: {
      first_name: billing.first_name,
      last_name: billing.last_name,
      phone: billing.phone,
      city: billing.city,
    },
    shipping: {
      first_name: shipping.first_name,
      city: shipping.city,
      address_1: shipping.address_1,
    },
    meta_data: prunedMeta,
    line_items: prunedLineItems,
    shipping_lines: Array.isArray(rawOrder.shipping_lines) && rawOrder.shipping_lines[0]
      ? [{ total: (rawOrder.shipping_lines[0] as Record<string, unknown>).total }]
      : undefined,
  };
}

/**
 * Trims order rows for in-memory SQL execution in the DEEN Copilot,
 * keeping only tabular columns needed by AlaSQL queries.
 */
export function trimOrderRowsForSql(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  if (!Array.isArray(rows)) return [];
  const ALLOWED_COLUMNS = [
    'Order ID',
    'Order Status',
    'Delivery Status',
    'Order Date',
    'Order Total Amount',
    'Item Cost',
    'Quantity',
    'SKU',
    'Item Name',
    'City (Shipping)',
    'Payment Method Title',
    'districtArea',
    'fulfillmentLocation',
    'sipInventory',
  ];

  return rows.map((row) => {
    const trimmed: Record<string, unknown> = {};
    for (const col of ALLOWED_COLUMNS) {
      if (col in row && row[col] !== undefined && row[col] !== '') {
        trimmed[col] = row[col];
      }
    }
    return trimmed;
  });
}
