import { getSecretsWithOverrides } from './secrets';
import { RawOrderRow } from '@/types';
import { withExponentialBackoff } from './sync/retry';
import { getCategoryForSales, getSubCategoryForSales } from './liveCategoryEngine';
import { classifyProductLine } from './selectsAnalytics';

export interface WcCredentials {
  store_url?: string;
  consumer_key?: string;
  consumer_secret?: string;
}

export interface WcMetaItem {
  key?: string;
  value?: unknown;
  display_key?: string;
  [key: string]: unknown;
}

export interface WcOrder {
  id?: number | string;
  number?: string;
  status?: string;
  date_created?: string;
  date_modified?: string;
  date_modified_gmt?: string;
  date_completed?: string;
  date_completed_gmt?: string;
  customer_note?: string;
  order_notes?: string;
  total?: string | number;
  payment_method?: string;
  payment_method_title?: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
  };
  shipping?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
  };
  meta_data?: WcMetaItem[];
  line_items?: Array<{
    id?: number | string;
    product_id?: number | string;
    variation_id?: number | string;
    name?: string;
    sku?: string;
    quantity?: number;
    subtotal?: string | number;
    total?: string | number;
    price?: string | number;
    meta_data?: WcMetaItem[];
    [key: string]: unknown;
  }>;
  shipping_lines?: Array<{ total?: string | number }>;
  discount_total?: string | number;
  coupon_lines?: Array<{ code?: string }>;
  [key: string]: unknown;
}

export async function testWooCommerceConnection(credentials?: WcCredentials): Promise<{
  success: boolean;
  status: number;
  message: string;
}> {
  const { woocommerce: wc } = getSecretsWithOverrides({ woocommerce: credentials });
  if (!wc.store_url || !wc.consumer_key || !wc.consumer_secret) {
    return {
      success: false,
      status: 400,
      message: 'WooCommerce credentials not configured in Vercel environment variables or Settings.',
    };
  }

  const url = `${wc.store_url.replace(/\/+$/, '')}/wp-json/wc/v3/orders?per_page=1`;
  const authHeader = 'Basic ' + Buffer.from(`${wc.consumer_key}:${wc.consumer_secret}`).toString('base64');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
          'User-Agent': 'Mozilla/5.0 DEEN-Commerce-Engine/2.0 (Next.js; Vercel Serverless)',
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.ok) {
      return {
        success: true,
        status: res.status,
        message: 'Connected successfully to WooCommerce REST API.',
      };
    }

    const contentType = res.headers.get('content-type') || '';
    let errJson: { code?: string; message?: string } = {};
    if (contentType.includes('application/json')) {
      errJson = await res.json().catch(() => ({}));
    } else {
      const text = await res.text().catch(() => '');
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        return {
          success: false,
          status: res.status,
          message: `WooCommerce server returned HTML error page (HTTP ${res.status}). Verify store URL and firewall whitelist.`,
        };
      }
    }

    if (res.status === 401 && errJson.code === 'woocommerce_rest_cannot_view') {
      return {
        success: false,
        status: 401,
        message:
          'WooCommerce 401 (Cannot View): The API key is valid but lacks order viewing permissions. In WP Admin, ensure key permissions are Read/Write for an Admin user.',
      };
    }

    if (res.status === 403) {
      return {
        success: false,
        status: 403,
        message:
          'WooCommerce 403 (Forbidden): Request blocked by WordPress firewall, Wordfence, or Cloudflare. Whitelist server IP or use Application Passwords.',
      };
    }

    return {
      success: false,
      status: res.status,
      message: errJson.message || `WooCommerce HTTP error ${res.status}`,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        success: false,
        status: 504,
        message: 'WooCommerce connection timed out after 9 seconds. The store server may be slow or blocking serverless requests.',
      };
    }
    return {
      success: false,
      status: 500,
      message: err instanceof Error ? err.message : 'Network error connecting to WooCommerce',
    };
  }
}

export interface WcFetchOptions {
  page?: number;
  perPage?: number;
  status?: string | string[];
  after?: string;
  before?: string;
  fetchAllPages?: boolean;
  maxPages?: number;
  credentials?: WcCredentials;
  orderBy?: 'date' | 'id' | 'include' | 'title' | 'slug' | 'modified';
  order?: 'asc' | 'desc';
  search?: string;
  customer?: number;
  offset?: number;
  datesAreGmt?: boolean;
  timeoutMs?: number;
}

/**
 * Normalizes customer phone numbers into clean local (01...) and international (8801...) formats.
 */
export function cleanCustomerPhone(rawPhone: unknown): { displayPhone: string; whatsappPhone: string } {
  if (!rawPhone) return { displayPhone: '', whatsappPhone: '' };
  const cleaned = String(rawPhone).replace(/\D/g, '');

  if (cleaned.startsWith('880') && cleaned.length >= 13) {
    return {
      displayPhone: cleaned.slice(2),
      whatsappPhone: cleaned,
    };
  }
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return {
      displayPhone: cleaned,
      whatsappPhone: '88' + cleaned,
    };
  }
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return {
      displayPhone: '0' + cleaned,
      whatsappPhone: '880' + cleaned,
    };
  }

  const standard10 = cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
  return {
    displayPhone: standard10.length === 10 ? '0' + standard10 : cleaned,
    whatsappPhone: standard10.length === 10 ? '880' + standard10 : cleaned,
  };
}

/**
 * Detects whether delivery address belongs to Inside Dhaka or Outside Dhaka.
 */
export function detectDistrictArea(city: string, state: string, address: string): 'Inside Dhaka' | 'Outside Dhaka' {
  const combined = `${city} ${state} ${address}`.toLowerCase();
  const insideDhakaPattern = /\b(dhaka|mirpur|uttara|gulshan|banani|dhanmondi|mohammadpur|badda|motijheel|tejgaon|khilgaon|bashundhara|malibagh|rampura|baridhara|shyamoli|lalbagh|wari|pallabi|cantonment|farmgate|azimpur|shahbag|jatrabari|maghbazar|keraniganj|savar|gazipur|narayanganj)\b/i;
  return insideDhakaPattern.test(combined) ? 'Inside Dhaka' : 'Outside Dhaka';
}

/**
 * Classifies payment method into Cash on Delivery (COD) vs Prepaid Gateway.
 */
export function classifyPayment(paymentMethodTitle?: string, paymentMethodKey?: string): {
  paymentMethod: string;
  isPrepaid: boolean;
  isCod: boolean;
} {
  const title = (paymentMethodTitle || paymentMethodKey || 'Cash on Delivery').trim();
  const lower = `${title} ${paymentMethodKey || ''}`.toLowerCase();
  const isPrepaid = /bkash|nagad|rocket|card|bank|ssl|sslcommerz|prepaid|advance|online|visa|mastercard|amex/i.test(lower);
  const isCod = !isPrepaid;
  return {
    paymentMethod: title,
    isPrepaid,
    isCod,
  };
}

/**
 * Detects fulfillment branch according to DEEN Order Rules (.agents/rules/order_rules.md).
 */
export function detectBranchFromOrder(order: WcOrder, meta: WcMetaItem[], orderId: string): {
  isPos: boolean;
  outletId: string;
  fulfillmentBranch: string;
  branchCode: 'ONLINE' | 'MIRPUR' | 'CUMILLA' | 'WARI' | 'SYLHET' | 'EXCHANGE';
} {
  const isPosMeta = meta.some((m: WcMetaItem) =>
    m.key === '_sip_pos_order' ||
    (m.key === '_sip_order_source' && String(m.value).toLowerCase() === 'pos') ||
    m.key === '_pos_register_id' ||
    m.key === '_pos_outlet_id'
  );

  const outletMeta = meta.find((m: WcMetaItem) =>
    m.key === '_sip_outlet_id' ||
    m.key === '_pos_outlet_id' ||
    m.key === '_outlet_id' ||
    m.key === 'outlet_id'
  );
  const outletId = outletMeta ? String(outletMeta.value).trim() : '';

  const cleanId = String(orderId || order?.id || order?.number || '').trim().toLowerCase();
  const customerNote = String(order?.customer_note || order?.order_notes || (order?.notes as string) || '').toLowerCase();
  const metaStrings = meta.map((m: WcMetaItem) => `${m.key}=${m.value}`).join(' ').toLowerCase();

  // 1. Exchange Replacement: D-17263 / DD-17263 / ex-17263 / "Exchange for #17839" / "Exchanged"
  if (
    /^(dd?|ex|exchange)[-_]/i.test(cleanId) ||
    /^d-\d+/i.test(cleanId) ||
    /exchange\s+for\s+#?\d+/i.test(customerNote) ||
    /exchange\s+for\s+#?\d+/i.test(metaStrings) ||
    /\bexchanged\b/i.test(customerNote) ||
    meta.some((m: WcMetaItem) => /substatus|custom_status|status_label/i.test(m.key || '') && /exchange/i.test(String(m.value)))
  ) {
    return {
      isPos: false,
      outletId: '',
      fulfillmentBranch: 'Exchange Replacement',
      branchCode: 'EXCHANGE',
    };
  }

  // 2. Mirpur Outlet POS: 17263 m or POS Outlet ID 1
  if (outletId === '1' || /[-_]?m$/i.test(cleanId) || /\s+m$/i.test(String(orderId).trim())) {
    return {
      isPos: true,
      outletId: outletId || '1',
      fulfillmentBranch: 'Mirpur Outlet POS',
      branchCode: 'MIRPUR',
    };
  }

  // 3. Cumilla Branch: 17263 c or POS Outlet ID 2
  if (outletId === '2' || /[-_]?c$/i.test(cleanId) || /\s+c$/i.test(String(orderId).trim())) {
    return {
      isPos: true,
      outletId: outletId || '2',
      fulfillmentBranch: 'Cumilla Branch',
      branchCode: 'CUMILLA',
    };
  }

  // 4. Wari Branch: 17263 w or POS Outlet ID 9
  if (outletId === '9' || /[-_]?w$/i.test(cleanId) || /\s+w$/i.test(String(orderId).trim())) {
    return {
      isPos: true,
      outletId: outletId || '9',
      fulfillmentBranch: 'Wari Branch',
      branchCode: 'WARI',
    };
  }

  // 5. Sylhet Branch: 17263 s or POS Outlet IDs 7 & 8
  if (outletId === '7' || outletId === '8' || /[-_]?s$/i.test(cleanId) || /\s+s$/i.test(String(orderId).trim())) {
    return {
      isPos: true,
      outletId: outletId || '7',
      fulfillmentBranch: 'Sylhet Branch',
      branchCode: 'SYLHET',
    };
  }

  // 6. Generic POS order if marked as POS but unknown outlet
  if (isPosMeta) {
    return {
      isPos: true,
      outletId: outletId || '',
      fulfillmentBranch: 'Retail Outlet POS',
      branchCode: 'MIRPUR',
    };
  }

  // 7. Default: Central Warehouse (Online Store)
  return {
    isPos: false,
    outletId: '',
    fulfillmentBranch: 'Online Store (Central Warehouse)',
    branchCode: 'ONLINE',
  };
}

/**
 * Extracts courier consignment tracking code across major Bangladesh shipping plugins and meta keys.
 */
export function extractConsignmentTracking(order: WcOrder, meta: WcMetaItem[]): string {
  const trackingKeys = [
    '_pathao_consignment_id',
    'pathao_consignment_id',
    'pathao_tracking_code',
    '_pathao_tracking_id',
    '_pathao_order_id',
    '_consignment_id',
    'consignment_id',
    'consignment_id_pathao',
    '_tracking_number',
    '_shipping_tracking_number',
    '_courier_tracking_id',
    '_steadfast_consignment_id',
    '_redx_tracking_id',
  ];

  for (const k of trackingKeys) {
    const found = meta.find((m: WcMetaItem) => String(m.key || '').toLowerCase() === k);
    if (found && found.value && typeof found.value === 'string' && found.value.trim().length > 3) {
      return found.value.trim();
    }
  }

  // Check shipment tracking items array
  const shipmentMeta = meta.find((m: WcMetaItem) => String(m.key || '').toLowerCase().includes('shipment_tracking'));
  if (shipmentMeta && shipmentMeta.value) {
    let items = shipmentMeta.value;
    if (typeof items === 'string' && (items.startsWith('[') || items.startsWith('{'))) {
      try {
        items = JSON.parse(items);
      } catch {
        // ignore
      }
    }
    if (Array.isArray(items) && items.length > 0 && (items[0] as { tracking_number?: string }).tracking_number) {
      return String((items[0] as { tracking_number?: string }).tracking_number).trim();
    }
  }

  // Fallback: Check customer or order notes for Pathao/Steadfast consignment pattern
  const notes = `${order.customer_note || ''} ${order.order_notes || ''}`;
  const match = notes.match(/\b(RD[A-Z0-9]{10,20}|[A-Z0-9]{12,25})\b/i);
  if (match && /^RD/i.test(match[1])) {
    return match[1];
  }

  return '';
}

/**
 * Extracts apparel variation attributes (Size, Color) from WooCommerce line item meta.
 */
export function extractVariationAttributes(item: { meta_data?: WcMetaItem[]; [key: string]: unknown }): { size: string; color: string } {
  let size = '';
  let color = '';
  const itemMeta = item.meta_data || [];
  for (const m of itemMeta) {
    const key = String(m.key || '').toLowerCase();
    const val = String(m.value || '').trim();
    if (!size && (/size|waist|fit/i.test(key) || String(m.display_key || '').toLowerCase().includes('size'))) {
      size = val;
    }
    if (!color && (/color|shade/i.test(key) || String(m.display_key || '').toLowerCase().includes('color'))) {
      color = val;
    }
  }
  return { size, color };
}

/**
 * Fetches real-time orders from WooCommerce REST API v3 with smart pagination, ordering, and date windowing.
 */
export async function fetchWooCommerceOrders(options: WcFetchOptions = {}): Promise<WcOrder[]> {
  const { woocommerce: wc } = getSecretsWithOverrides({ woocommerce: options.credentials });
  const perPage = Math.min(Math.max(options.perPage || 100, 1), 100);
  const maxPages = options.maxPages || 3;
  let currentPage = options.page || 1;
  let allOrders: WcOrder[] = [];
  const orderBy = options.orderBy || 'date';
  const order = options.order || 'desc';

  const authHeader = 'Basic ' + Buffer.from(`${wc.consumer_key}:${wc.consumer_secret}`).toString('base64');

  while (currentPage <= maxPages) {
    const url = new URL(`${wc.store_url.replace(/\/+$/, '')}/wp-json/wc/v3/orders`);
    url.searchParams.set('page', String(currentPage));
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('orderby', orderBy);
    url.searchParams.set('order', order);

    if (options.status && options.status !== 'any') {
      const statusParam = Array.isArray(options.status)
        ? options.status.join(',')
        : String(options.status);
      url.searchParams.set('status', statusParam);
    } else if (options.status === 'any') {
      url.searchParams.set('status', 'any');
    }

    if (options.after) {
      const afterStr = options.after.includes('T') ? options.after : `${options.after}T00:00:00`;
      url.searchParams.set('after', afterStr);
    }
    if (options.before) {
      const beforeStr = options.before.includes('T') ? options.before : `${options.before}T23:59:59`;
      url.searchParams.set('before', beforeStr);
    }
    if (options.search) {
      url.searchParams.set('search', options.search.trim());
    }
    if (options.customer) {
      url.searchParams.set('customer', String(options.customer));
    }
    if (options.offset) {
      url.searchParams.set('offset', String(options.offset));
    }
    if (options.datesAreGmt) {
      url.searchParams.set('dates_are_gmt', 'true');
    }

    let totalPages: number | undefined;
    let _totalOrders: number | undefined;

    const pageOrders = await withExponentialBackoff(async () => {
      const timeoutMs = options.timeoutMs || 15000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(url.toString(), {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Authorization': authHeader,
            'User-Agent': 'Mozilla/5.0 DEEN-Commerce-Engine/2.0 (Next.js; Vercel Serverless)',
          },
        });

        const contentType = res.headers.get('content-type') || '';
        const wpTotal = res.headers.get('x-wp-total');
        const wpTotalPages = res.headers.get('x-wp-totalpages');
        if (wpTotal) _totalOrders = parseInt(wpTotal, 10);
        if (wpTotalPages) totalPages = parseInt(wpTotalPages, 10);

        if (!res.ok) {
          let errMsg = `Failed to fetch WooCommerce orders: HTTP ${res.status}`;
          if (contentType.includes('application/json')) {
            const err = await res.json().catch(() => ({}));
            errMsg = err.message || errMsg;
          } else {
            const text = await res.text().catch(() => '');
            if (text.includes('<!DOCTYPE') || text.includes('<html')) {
              errMsg = `WooCommerce API returned HTML error (HTTP ${res.status}). Store firewall, Cloudflare, or WordPress error page encountered.`;
            }
          }
          const error = new Error(errMsg) as Error & { status?: number };
          error.status = res.status;
          throw error;
        }

        if (!contentType.includes('application/json')) {
          const text = await res.text().catch(() => '');
          throw new Error(`WooCommerce returned HTML instead of JSON (${res.status}): ${text.slice(0, 80)}`);
        }

        return (await res.json()) as WcOrder[];
      } finally {
        clearTimeout(timeoutId);
      }
    }, { maxRetries: 2, baseDelayMs: 350 });

    if (!Array.isArray(pageOrders) || pageOrders.length === 0) break;
    allOrders = [...allOrders, ...pageOrders];

    // Smart early termination:
    // If not fetching all pages, stop after first page
    if (!options.fetchAllPages) break;
    // If fewer orders than perPage, no more pages exist
    if (pageOrders.length < perPage) break;
    // If totalPages is known from HTTP headers and we've reached it, stop!
    if (totalPages !== undefined && currentPage >= totalPages) break;

    currentPage++;
  }

  return allOrders;
}

/**
 * Transforms WooCommerce nested order objects with line_items into rich flat RawOrderRow records.
 * Accurately extracts branch fulfillment, courier tracking, geographic area, variation attributes,
 * and apparel collection classifications.
 */
export function formatWooCommerceToOrderRows(orders: WcOrder[]): RawOrderRow[] {
  const rows: RawOrderRow[] = [];

  for (const order of orders) {
    const orderId = String(order.id || order.number || '');
    const dateCreated = order.date_created || '';
    const dateModified = order.date_modified || order.date_modified_gmt || dateCreated;
    const dateCompleted = order.date_completed || order.date_completed_gmt || '';
    const customerName = `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || order.shipping?.first_name || 'Customer';
    const rawPhone = order.billing?.phone || order.shipping?.phone || '';
    const { displayPhone, whatsappPhone } = cleanCustomerPhone(rawPhone);
    const email = order.billing?.email || '';
    const address = [order.billing?.address_1, order.billing?.address_2].filter(Boolean).join(', ') || [order.shipping?.address_1, order.shipping?.address_2].filter(Boolean).join(', ') || '';
    const city = order.billing?.city || order.shipping?.city || '';
    const state = order.billing?.state || order.shipping?.state || '';
    const districtArea = detectDistrictArea(city, state, address);

    const orderTotal = typeof order.total === 'number' ? order.total : parseFloat(String(order.total || '0')) || 0;
    const { paymentMethod, isPrepaid, isCod } = classifyPayment(order.payment_method_title, order.payment_method);
    const note = order.customer_note || '';
    const status = order.status || 'processing';

    const meta = order.meta_data || [];
    const branchInfo = detectBranchFromOrder(order, meta, orderId);
    const trackingId = extractConsignmentTracking(order, meta);
    const shippingFee = (order.shipping_lines && order.shipping_lines[0]) ? parseFloat(String(order.shipping_lines[0].total || '0')) || 0 : 0;
    const discountTotal = typeof order.discount_total === 'number' ? order.discount_total : parseFloat(String(order.discount_total || '0')) || 0;
    const couponCodes = (order.coupon_lines || []).map((c: { code?: string }) => c.code).filter(Boolean).join(', ');

    // Extract substatus or custom order status badge (e.g. "Exchange for #17839" or "Exchanged")
    let substatus = '';
    for (const m of meta) {
      const k = String(m.key || '').toLowerCase();
      const v = String(m.value || '').trim();
      if (/substatus|sub_status|custom_order_status|order_status_label|ywcos_custom_status/i.test(k) && v) {
        substatus = v;
        break;
      }
    }
    if (!substatus) {
      const notesText = `${order.customer_note || ''} ${order.order_notes || ''}`;
      const match = notesText.match(/exchange\s+for\s+#?\d+/i) || notesText.match(/\bexchanged\b/i);
      if (match) substatus = match[0];
    }
    const isOrderExchangeRow = branchInfo.branchCode === 'EXCHANGE' || /exchange/i.test(substatus);

    const lineItems = order.line_items || [];
    if (lineItems.length === 0) {
      const prodName = 'Apparel Order';
      const cat = getCategoryForSales(prodName);
      const subCat = getSubCategoryForSales(prodName);
      const lineClass = classifyProductLine(prodName, 'GENERAL', cat);
      const isSelects = lineClass === 'DEEN Selects';

      rows.push({
        'Order ID': orderId,
        'orderId': orderId,
        'orderNumber': String(order.number || orderId),
        'Order Date': dateCreated,
        'orderDate': dateCreated,
        'Date Modified': dateModified,
        'dateModified': dateModified,
        'Date Completed': dateCompleted,
        'dateCompleted': dateCompleted,
        'date_completed': dateCompleted,
        'Substatus': substatus,
        'substatus': substatus,
        'isExchange': isOrderExchangeRow,
        'Customer Name': customerName,
        'customerName': customerName,
        'rawCustomerName': customerName,
        'Phone': displayPhone || rawPhone,
        'phone': displayPhone || rawPhone,
        'rawPhone': displayPhone || rawPhone,
        'formattedPhone': whatsappPhone,
        'Email': email,
        'email': email,
        'Address': address,
        'address': address,
        'City': city,
        'city': city,
        'State': state,
        'state': state,
        'districtArea': districtArea,
        'District Area': districtArea,
        'LocationType': districtArea,
        'Item Cost': orderTotal,
        'itemCost': orderTotal,
        'Order Amount': orderTotal,
        'orderAmount': orderTotal,
        'Payment Method': paymentMethod,
        'paymentMethod': paymentMethod,
        'isPrepaid': isPrepaid,
        'isCod': isCod,
        'Order Notes': note,
        'orderNotes': note,
        'Delivery Status': status,
        'status': status,
        'Quantity': 1,
        'quantity': 1,
        'SKU': 'GENERAL',
        'sku': 'GENERAL',
        'Item Name': prodName,
        'itemName': prodName,
        'Category': cat,
        'category': cat,
        'Subcategory': subCat,
        'subCategory': subCat,
        'Apparel Line': lineClass,
        'isSelects': isSelects,
        'Order Source': branchInfo.isPos ? 'POS' : 'Online',
        'Outlet ID': branchInfo.outletId,
        'fulfillmentBranch': branchInfo.fulfillmentBranch,
        'branchCode': branchInfo.branchCode,
        'Shipping Fee': shippingFee,
        'shippingFee': shippingFee,
        'Discount Total': discountTotal,
        'Coupon Codes': couponCodes,
        'Consignment ID': trackingId,
        'consignmentId': trackingId,
        'tracking_number': trackingId,
        isPos: branchInfo.isPos,
        outletId: branchInfo.outletId,
        isBranchFulfillment: branchInfo.branchCode !== 'ONLINE',
      });
    } else {
      for (const item of lineItems) {
        const qty = Number(item.quantity) || 1;
        const subtotal = parseFloat(String(item.total || item.subtotal || 0)) || 0;
        const itemCost = qty > 0 ? subtotal / qty : subtotal;
        const sku = String(item.sku || '').trim() || 'GENERAL';
        const prodName = String(item.name || 'Apparel Item').trim();
        const { size, color } = extractVariationAttributes(item);
        const cat = getCategoryForSales(prodName);
        const subCat = getSubCategoryForSales(prodName);
        const lineClass = classifyProductLine(prodName, sku, cat);
        const isSelects = lineClass === 'DEEN Selects';

        rows.push({
          'Order ID': orderId,
          'orderId': orderId,
          'orderNumber': String(order.number || orderId),
          'Order Date': dateCreated,
          'orderDate': dateCreated,
          'Date Modified': dateModified,
          'dateModified': dateModified,
          'Date Completed': dateCompleted,
          'dateCompleted': dateCompleted,
          'date_completed': dateCompleted,
          'Substatus': substatus,
          'substatus': substatus,
          'isExchange': isOrderExchangeRow,
          'Customer Name': customerName,
          'customerName': customerName,
          'rawCustomerName': customerName,
          'Phone': displayPhone || rawPhone,
          'phone': displayPhone || rawPhone,
          'rawPhone': displayPhone || rawPhone,
          'formattedPhone': whatsappPhone,
          'Email': email,
          'email': email,
          'Address': address,
          'address': address,
          'City': city,
          'city': city,
          'State': state,
          'state': state,
          'districtArea': districtArea,
          'District Area': districtArea,
          'LocationType': districtArea,
          'SKU': sku,
          'sku': sku,
          'Item Name': prodName,
          'itemName': prodName,
          'Size': size,
          'size': size,
          'Color': color,
          'color': color,
          'Category': cat,
          'category': cat,
          'Subcategory': subCat,
          'subCategory': subCat,
          'Apparel Line': lineClass,
          'isSelects': isSelects,
          'Quantity': qty,
          'quantity': qty,
          'Item Cost': itemCost,
          'itemCost': itemCost,
          'Order Amount': orderTotal,
          'orderAmount': orderTotal,
          'Payment Method': paymentMethod,
          'paymentMethod': paymentMethod,
          'isPrepaid': isPrepaid,
          'isCod': isCod,
          'Order Notes': note,
          'orderNotes': note,
          'Delivery Status': status,
          'status': status,
          'Order Source': branchInfo.isPos ? 'POS' : 'Online',
          'Outlet ID': branchInfo.outletId,
          'fulfillmentBranch': branchInfo.fulfillmentBranch,
          'branchCode': branchInfo.branchCode,
          'Shipping Fee': shippingFee,
          'shippingFee': shippingFee,
          'Discount Total': discountTotal,
          'Coupon Codes': couponCodes,
          'Consignment ID': trackingId,
          'consignmentId': trackingId,
          'tracking_number': trackingId,
          isPos: branchInfo.isPos,
          outletId: branchInfo.outletId,
          isBranchFulfillment: branchInfo.branchCode !== 'ONLINE',
        });
      }
    }
  }

  return rows;
}
