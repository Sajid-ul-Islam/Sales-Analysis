import { getSecretsConfig } from './secrets';
import { RawOrderRow } from '@/types';

export interface WcFetchOptions {
  page?: number;
  perPage?: number;
  status?: string;
  after?: string;
  before?: string;
}

export async function testWooCommerceConnection(): Promise<{
  success: boolean;
  status: number;
  message: string;
}> {
  const { woocommerce: wc } = getSecretsConfig();
  if (!wc.store_url || !wc.consumer_key || !wc.consumer_secret) {
    return {
      success: false,
      status: 400,
      message: 'WooCommerce credentials not configured in .env.local or environment variables',
    };
  }

  const url = `${wc.store_url.replace(/\/+$/, '')}/wp-json/wc/v3/orders?consumer_key=${encodeURIComponent(
    wc.consumer_key
  )}&consumer_secret=${encodeURIComponent(wc.consumer_secret)}&per_page=1`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 DEEN-Commerce-Engine/1.0',
      },
    });

    if (res.ok) {
      return {
        success: true,
        status: res.status,
        message: 'Connected successfully to WooCommerce REST API.',
      };
    }

    const errJson = await res.json().catch(() => ({}));
    if (res.status === 401 && errJson.code === 'woocommerce_rest_cannot_view') {
      return {
        success: false,
        status: 401,
        message:
          'WooCommerce 401 (Cannot View): The API key is valid but associated with a WordPress user role that lacks "Administrator" or "Shop Manager" order viewing permissions. In WP Admin, go to WooCommerce > Settings > Advanced > REST API and ensure key permissions are Read/Write for an Admin user.',
      };
    }

    return {
      success: false,
      status: res.status,
      message: errJson.message || `WooCommerce HTTP error ${res.status}`,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 500,
      message: err?.message || 'Network error connecting to WooCommerce',
    };
  }
}

export interface WcFetchOptions {
  page?: number;
  perPage?: number;
  status?: string;
  after?: string;
  before?: string;
  fetchAllPages?: boolean;
  maxPages?: number;
}

export async function fetchWooCommerceOrders(options: WcFetchOptions = {}): Promise<any[]> {
  const { woocommerce: wc } = getSecretsConfig();
  const perPage = options.perPage || 100;
  const maxPages = options.maxPages || 5;
  let currentPage = options.page || 1;
  let allOrders: any[] = [];

  while (currentPage <= maxPages) {
    const url = new URL(`${wc.store_url.replace(/\/+$/, '')}/wp-json/wc/v3/orders`);
    url.searchParams.set('consumer_key', wc.consumer_key);
    url.searchParams.set('consumer_secret', wc.consumer_secret);
    url.searchParams.set('page', String(currentPage));
    url.searchParams.set('per_page', String(perPage));

    if (options.status && options.status !== 'any') url.searchParams.set('status', options.status);
    if (options.after) url.searchParams.set('after', options.after);
    if (options.before) url.searchParams.set('before', options.before);

    const res = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 DEEN-Commerce-Engine/1.0',
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch WooCommerce orders: HTTP ${res.status}`);
    }

    const pageOrders = await res.json();
    if (!Array.isArray(pageOrders) || pageOrders.length === 0) break;
    allOrders = [...allOrders, ...pageOrders];

    if (!options.fetchAllPages || pageOrders.length < perPage) break;
    currentPage++;
  }

  return allOrders;
}

/**
 * Transforms WooCommerce nested order objects with line_items into flat RawOrderRow records.
 */
export function formatWooCommerceToOrderRows(orders: any[]): RawOrderRow[] {
  const rows: RawOrderRow[] = [];

  for (const order of orders) {
    const orderId = String(order.id || order.number || '');
    const dateCreated = order.date_created || '';
    const customerName = `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || order.shipping?.first_name || 'Customer';
    const phone = order.billing?.phone || order.shipping?.phone || '';
    const city = order.billing?.city || order.shipping?.city || '';
    const state = order.billing?.state || order.shipping?.state || '';
    const orderTotal = parseFloat(order.total) || 0;
    const paymentMethod = order.payment_method_title || order.payment_method || 'Cash on Delivery';
    const note = order.customer_note || '';
    const status = order.status || 'processing';

    const lineItems = order.line_items || [];
    if (lineItems.length === 0) {
      rows.push({
        'Order ID': orderId,
        'orderId': orderId,
        'Order Date': dateCreated,
        'Customer Name': customerName,
        'Phone': phone,
        'City': city,
        'State': state,
        'Item Cost': orderTotal,
        'Order Amount': orderTotal,
        'Payment Method': paymentMethod,
        'Order Notes': note,
        'Delivery Status': status,
        'Quantity': 1,
        'SKU': 'GENERAL',
        'Item Name': 'Apparel Order',
      });
    } else {
      for (const item of lineItems) {
        const qty = item.quantity || 1;
        const subtotal = parseFloat(item.total || item.subtotal) || 0;
        const itemCost = qty > 0 ? subtotal / qty : subtotal;

        rows.push({
          'Order ID': orderId,
          'orderId': orderId,
          'Order Date': dateCreated,
          'Customer Name': customerName,
          'Phone': phone,
          'City': city,
          'State': state,
          'SKU': item.sku || '',
          'Item Name': item.name || '',
          'Quantity': qty,
          'Item Cost': itemCost,
          'Order Amount': orderTotal,
          'Payment Method': paymentMethod,
          'Order Notes': note,
          'Delivery Status': status,
        });
      }
    }
  }

  return rows;
}
