import { getSecretsWithOverrides } from './secrets';
import { RawOrderRow } from '@/types';
import { withExponentialBackoff } from './sync/retry';
import { SyncTracker } from './sync/syncTracker';

export interface PathaoCredentials {
  base_url?: string;
  client_id?: string;
  client_secret?: string;
  username?: string;
  password?: string;
}

export interface PathaoStore {
  store_id: number | string;
  store_name: string;
  store_address?: string;
  [key: string]: unknown;
}

export interface PathaoOrderDetail {
  consignment_id?: string;
  order_consignment_id?: string;
  merchant_order_id?: string;
  order_id?: string;
  order_status?: string;
  order_amount?: string | number;
  collected_amount?: string | number;
  total_fee?: string | number;
  delivery_fee?: string | number;
  cod_fee?: string | number;
  store_name?: string;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_address?: string;
  recipient_city?: string;
  [key: string]: unknown;
}

interface PathaoTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function getPathaoToken(credentials?: PathaoCredentials): Promise<string> {
  const now = Date.now();
  if (!credentials && cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  const { pathao } = getSecretsWithOverrides({ pathao: credentials });
  if (!pathao.client_id || !pathao.client_secret || !pathao.username || !pathao.password) {
    throw new Error('Pathao credentials missing in Vercel environment variables or Settings');
  }

  const data: PathaoTokenResponse = await withExponentialBackoff(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8500);

    try {
      const res = await fetch(`${pathao.base_url.replace(/\/+$/, '')}/aladdin/api/v1/issue-token`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 DEEN-Commerce-Engine/2.0 (Next.js; Vercel Serverless)',
        },
        body: JSON.stringify({
          client_id: pathao.client_id,
          client_secret: pathao.client_secret,
          username: pathao.username,
          password: pathao.password,
          grant_type: 'password',
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const err = new Error(`Pathao token generation failed (${res.status}): ${errText.slice(0, 100)}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text().catch(() => '');
        throw new Error(`Pathao token endpoint returned non-JSON response (${res.status}): ${text.slice(0, 80)}`);
      }

      return await res.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }, { maxRetries: 2, baseDelayMs: 300 });

  if (!credentials) {
    cachedToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
  }
  return data.access_token;
}

export async function getPathaoStores(credentials?: PathaoCredentials): Promise<PathaoStore[]> {
  const token = await getPathaoToken(credentials);
  const { pathao } = getSecretsWithOverrides({ pathao: credentials });

  return await withExponentialBackoff(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8500);

    try {
      const res = await fetch(`${pathao.base_url.replace(/\/+$/, '')}/aladdin/api/v1/stores`, {
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 DEEN-Commerce-Engine/2.0 (Next.js; Vercel Serverless)',
        },
      });

      if (!res.ok) {
        const err = new Error(`Failed to fetch Pathao stores: ${res.statusText}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return [];
      }

      const data = await res.json().catch(() => null);
      return data?.data?.data || [];
    } finally {
      clearTimeout(timeoutId);
    }
  }, { maxRetries: 2, baseDelayMs: 300 });
}

export async function getPathaoOrderDetails(consignmentId: string, credentials?: PathaoCredentials): Promise<PathaoOrderDetail | null> {
  const token = await getPathaoToken(credentials);
  const { pathao } = getSecretsWithOverrides({ pathao: credentials });

  try {
    return await withExponentialBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      try {
        const res = await fetch(`${pathao.base_url.replace(/\/+$/, '')}/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}`, {
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 DEEN-Commerce-Engine/2.0 (Next.js; Vercel Serverless)',
          },
        });

        if (!res.ok) {
          return null;
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          return null;
        }

        const json = await res.json().catch(() => null);
        return json?.data || null;
      } finally {
        clearTimeout(timeoutId);
      }
    }, { maxRetries: 1, baseDelayMs: 250 });
  } catch {
    return null;
  }
}

export async function batchFetchPathaoOrders(
  consignmentIds: string[],
  concurrency = 4,
  credentials?: PathaoCredentials,
  tracker?: SyncTracker
): Promise<PathaoOrderDetail[]> {
  const results: PathaoOrderDetail[] = [];
  const queue = [...consignmentIds];

  const worker = async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      try {
        const order = await getPathaoOrderDetails(id, credentials);
        if (order) {
          results.push(order);
          tracker?.recordSuccess(1);
        } else {
          tracker?.recordFailure(id, 'Not Found in Pathao Hermes API', 404);
        }
      } catch (err: unknown) {
        console.warn(`Error fetching Pathao order ${id}:`, err);
        tracker?.recordFailure(id, err);
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, consignmentIds.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Queries Pathao Aladdin API by merchant order ID (order number) to resolve tracking details and consignment ID.
 */
export async function getPathaoOrderByMerchantOrderId(
  orderId: string,
  credentials?: PathaoCredentials
): Promise<PathaoOrderDetail | null> {
  const cleanId = String(orderId || '').trim();
  if (!cleanId) return null;

  try {
    const token = await getPathaoToken(credentials);
    const { pathao } = getSecretsWithOverrides({ pathao: credentials });

    return await withExponentialBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6500);

      try {
        // 1. Try querying orders endpoint with merchant_order_id query parameter
        const searchUrl = `${pathao.base_url.replace(/\/+$/, '')}/aladdin/api/v1/orders?merchant_order_id=${encodeURIComponent(cleanId)}`;
        const res = await fetch(searchUrl, {
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 DEEN-Commerce-Engine/2.0 (Next.js; Vercel Serverless)',
          },
        });

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const json = await res.json().catch(() => null);
            const list = json?.data?.data || json?.data;
            if (Array.isArray(list) && list.length > 0) {
              return list[0];
            }
            if (list && typeof list === 'object' && (list.consignment_id || list.order_consignment_id)) {
              return list;
            }
          }
        }

        // 2. Direct identifier endpoint fallback
        const directUrl = `${pathao.base_url.replace(/\/+$/, '')}/aladdin/api/v1/orders/${encodeURIComponent(cleanId)}`;
        const directRes = await fetch(directUrl, {
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 DEEN-Commerce-Engine/2.0 (Next.js; Vercel Serverless)',
          },
        });

        if (directRes.ok) {
          const contentType = directRes.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const json = await directRes.json().catch(() => null);
            return json?.data || null;
          }
        }

        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    }, { maxRetries: 1, baseDelayMs: 250 });
  } catch {
    return null;
  }
}

/**
 * Fetches recent order dispatches from Pathao to match active orders without consignment IDs.
 */
export async function fetchRecentPathaoOrders(
  page = 1,
  credentials?: PathaoCredentials
): Promise<PathaoOrderDetail[]> {
  try {
    const token = await getPathaoToken(credentials);
    const { pathao } = getSecretsWithOverrides({ pathao: credentials });

    return await withExponentialBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7500);

      try {
        const res = await fetch(`${pathao.base_url.replace(/\/+$/, '')}/aladdin/api/v1/orders?page=${page}`, {
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 DEEN-Commerce-Engine/2.0 (Next.js; Vercel Serverless)',
          },
        });

        if (!res.ok) return [];

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return [];

        const json = await res.json().catch(() => null);
        const list = json?.data?.data || json?.data || [];
        return Array.isArray(list) ? list : [];
      } finally {
        clearTimeout(timeoutId);
      }
    }, { maxRetries: 1, baseDelayMs: 250 });
  } catch {
    return [];
  }
}

/**
 * Batch queries Pathao Aladdin API by merchant order IDs.
 */
export async function batchFetchPathaoOrdersByOrderIds(
  orderIds: string[],
  concurrency = 3,
  credentials?: PathaoCredentials
): Promise<PathaoOrderDetail[]> {
  const results: PathaoOrderDetail[] = [];
  const queue = [...orderIds];

  const worker = async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      try {
        const order = await getPathaoOrderByMerchantOrderId(id, credentials);
        if (order) {
          results.push(order);
        }
      } catch {
        // Continue worker
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, orderIds.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Converts Pathao Aladdin order responses into standardized reconciliation return rows.
 */
export function formatPathaoToReturnRows(pathaoOrders: PathaoOrderDetail[]): RawOrderRow[] {
  return pathaoOrders.map((o) => {
    const rawOid = String(o.merchant_order_id || o.order_id || o.order_consignment_id || '');
    const consId = String(o.order_consignment_id || o.consignment_id || o.order_id || '');
    const status = String(o.order_status || 'Delivered');
    const amount = parseFloat(String(o.order_amount || 0)) || 0;
    const collected = parseFloat(String(o.collected_amount || o.order_amount || 0)) || 0;
    const fee = parseFloat(String(o.total_fee || o.delivery_fee || 0)) || 0;
    const deliveryFee = parseFloat(String(o.delivery_fee || 0)) || 0;
    const codFee = parseFloat(String(o.cod_fee || 0)) || 0;

    return {
      'Merchant order id': rawOid,
      'Order consignment id': consId,
      'Order status': status,
      'Collected amount': collected,
      'Collectable Amount': amount,
      'Total fee': fee,
      'Delivery fee': deliveryFee,
      'Cod fee': codFee,
      'Store name': o.store_name || '',
      'order_id': rawOid,
      'orderId': rawOid,
      'consignment_id': consId,
      'consignmentid': consId,
      'delivery_status': status,
      'deliverystatus': status,
      'status': status,
      'cod_amount': amount,
      'codamount': amount,
      'charge': fee,
      'discount': parseFloat(String(o.discount || 0)) || 0,
      'customer_name': o.recipient_name || '',
      'customername': o.recipient_name || '',
      'phone': o.recipient_phone || '',
      'city': o.city_name || '',
      'zone': o.zone_name || '',
      'address': o.recipient_address || '',
      'failed_reason': o.failed_reason || '',
      'invoice_id': o.invoice_id || '',
      'created_at': o.order_created_at || '',
    };
  });
}
