import { getSecretsConfig } from './secrets';
import { RawOrderRow } from '@/types';

interface PathaoTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function getPathaoToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  const { pathao } = getSecretsConfig();
  if (!pathao.client_id || !pathao.client_secret || !pathao.username || !pathao.password) {
    throw new Error('Pathao credentials missing in .env.local or environment variables');
  }

  const res = await fetch(`${pathao.base_url.replace(/\/+$/, '')}/aladdin/api/v1/issue-token`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
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
    const errText = await res.text();
    throw new Error(`Pathao token generation failed (${res.status}): ${errText}`);
  }

  const data: PathaoTokenResponse = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

export async function getPathaoStores(): Promise<any[]> {
  const token = await getPathaoToken();
  const { pathao } = getSecretsConfig();

  const res = await fetch(`${pathao.base_url.replace(/\/+$/, '')}/aladdin/api/v1/stores`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Pathao stores: ${res.statusText}`);
  }

  const data = await res.json();
  return data?.data?.data || [];
}

export async function getPathaoOrderDetails(consignmentId: string): Promise<any | null> {
  const token = await getPathaoToken();
  const { pathao } = getSecretsConfig();

  const res = await fetch(`${pathao.base_url.replace(/\/+$/, '')}/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    return null;
  }

  const json = await res.json();
  return json?.data || null;
}

export async function batchFetchPathaoOrders(
  consignmentIds: string[],
  concurrency = 5
): Promise<any[]> {
  const results: any[] = [];
  const queue = [...consignmentIds];

  const worker = async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      try {
        const order = await getPathaoOrderDetails(id);
        if (order) results.push(order);
      } catch (err) {
        console.warn(`Error fetching Pathao order ${id}:`, err);
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, consignmentIds.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Converts Pathao Aladdin order responses into standardized reconciliation return rows.
 */
export function formatPathaoToReturnRows(pathaoOrders: any[]): RawOrderRow[] {
  return pathaoOrders.map((o) => {
    const rawOid = o.merchant_order_id || o.order_id || o.order_consignment_id;
    return {
      'order_id': rawOid,
      'orderId': rawOid,
      'consignment_id': o.order_consignment_id || o.order_id,
      'consignmentid': o.order_consignment_id || o.order_id,
      'delivery_status': o.order_status || 'Delivered',
      'deliverystatus': o.order_status || 'Delivered',
      'status': o.order_status || 'Delivered',
      'cod_amount': parseFloat(o.order_amount) || 0,
      'codamount': parseFloat(o.order_amount) || 0,
      'charge': parseFloat(o.total_fee || o.delivery_fee) || 0,
      'delivery_fee': parseFloat(o.delivery_fee) || 0,
      'discount': parseFloat(o.discount) || 0,
      'customer_name': o.recipient_name || '',
      'customername': o.recipient_name || '',
      'phone': o.recipient_phone || '',
      'city': o.city_name || '',
      'zone': o.zone_name || '',
      'address': o.recipient_address || '',
      'failed_reason': o.failed_reason || '',
      'invoice_id': o.invoice_id || '',
      'store_name': o.store_name || '',
      'created_at': o.order_created_at || '',
    };
  });
}
