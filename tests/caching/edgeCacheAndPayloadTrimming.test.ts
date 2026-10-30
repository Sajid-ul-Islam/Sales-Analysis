import { describe, it, expect } from 'vitest';
import {
  getEdgeCacheHeaders,
  generateETag,
  isClientFresh,
  createNotModifiedResponse,
  jsonWithEdgeCache,
  stripEmptyProperties,
  trimWooCommerceOrder,
  trimOrderRowsForSql,
  EDGE_CACHE_PROFILES,
} from '@/lib/edgeCache';

describe('Edge Caching & CDN Optimization', () => {
  it('should return valid Vercel Edge caching headers for STATIC_DATASET', () => {
    const headers = getEdgeCacheHeaders('STATIC_DATASET');
    expect(headers['Cache-Control']).toContain('s-maxage=3600');
    expect(headers['Cache-Control']).toContain('stale-while-revalidate=86400');
    expect(headers['CDN-Cache-Control']).toBe('public, s-maxage=3600, stale-while-revalidate=86400');
    expect(headers['Vercel-CDN-Cache-Control']).toBe('public, s-maxage=3600, stale-while-revalidate=86400');
    expect(headers['Vary']).toContain('Accept-Encoding');
  });

  it('should return valid headers for SYSTEM_STATUS and ANALYTICS_REPORT', () => {
    const statusHeaders = getEdgeCacheHeaders('SYSTEM_STATUS');
    expect(statusHeaders['Cache-Control']).toContain('s-maxage=30');

    const analyticsHeaders = getEdgeCacheHeaders('ANALYTICS_REPORT');
    expect(analyticsHeaders['Cache-Control']).toContain('s-maxage=300');
    expect(analyticsHeaders['Cache-Control']).toContain('stale-while-revalidate=900');
  });

  it('should enforce private no-store headers when isPrivate is true', () => {
    const headers = getEdgeCacheHeaders('STATIC_DATASET', { isPrivate: true });
    expect(headers['Cache-Control']).toBe('private, no-cache, no-store, must-revalidate');
    expect(headers['CDN-Cache-Control']).toBeUndefined();
    expect(headers['Vercel-CDN-Cache-Control']).toBeUndefined();
  });

  it('should generate deterministic ETags and recognize matching If-None-Match headers', () => {
    const payload = { ordersCount: 1500, source: 'baseline' };
    const etag1 = generateETag(payload);
    const etag2 = generateETag(payload);
    expect(etag1).toBe(etag2);
    expect(etag1.startsWith('W/"')).toBe(true);

    const reqMatching = new Request('http://localhost/api/test', {
      headers: { 'if-none-match': etag1 },
    });
    expect(isClientFresh(reqMatching, etag1)).toBe(true);

    const reqWildcard = new Request('http://localhost/api/test', {
      headers: { 'if-none-match': '*' },
    });
    expect(isClientFresh(reqWildcard, etag1)).toBe(true);

    const reqMismatched = new Request('http://localhost/api/test', {
      headers: { 'if-none-match': 'W/"different-etag"' },
    });
    expect(isClientFresh(reqMismatched, etag1)).toBe(false);
  });

  it('should return HTTP 304 with zero body bytes when client is fresh', () => {
    const data = { hello: 'world' };
    const etag = generateETag(data);
    const req = new Request('http://localhost/api/test', {
      headers: { 'if-none-match': etag },
    });

    const res = jsonWithEdgeCache(data, 'STATIC_DATASET', { req, etag });
    expect(res.status).toBe(304);
    expect(res.headers.get('ETag')).toBe(etag);
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=3600');
  });

  it('should return HTTP 200 with full body when client is not fresh', async () => {
    const data = { hello: 'world' };
    const req = new Request('http://localhost/api/test');

    const res = jsonWithEdgeCache(data, 'STATIC_DATASET', { req });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(data);
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=3600');
  });
});

describe('Response Payload Trimming', () => {
  it('should strip empty strings, null, and undefined values from objects', () => {
    const bloated = {
      orderId: '1001',
      emptyNote: '',
      nullValue: null,
      undefinedValue: undefined,
      validZero: 0,
      validFalse: false,
      nested: {
        keep: 'yes',
        remove: '',
      },
    };

    const trimmed = stripEmptyProperties(bloated);
    expect(trimmed).toEqual({
      orderId: '1001',
      validZero: 0,
      validFalse: false,
      nested: {
        keep: 'yes',
      },
    });
  });

  it('should prune bloated WooCommerce orders to essential fields and drop links and taxes', () => {
    const rawWcOrder = {
      id: 17263,
      number: '17263',
      status: 'completed',
      total: '2950.00',
      date_created: '2026-10-20T10:00:00',
      date_modified: '2026-10-20T12:00:00',
      payment_method: 'cod',
      payment_method_title: 'Cash on delivery',
      discount_total: '0.00',
      customer_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
      version: '8.5.1',
      cart_hash: 'a1b2c3d4e5f6',
      _links: { self: [{ href: 'https://example.com/wp-json/wc/v3/orders/17263' }] },
      tax_lines: [{ id: 1, rate_code: 'VAT', rate_percent: 5 }],
      fee_lines: [],
      billing: {
        first_name: 'John',
        last_name: 'Doe',
        phone: '01711223344',
        city: 'Dhaka',
        postcode: '1212',
        country: 'BD',
      },
      shipping: {
        first_name: 'John',
        city: 'Dhaka',
        address_1: 'House 1, Road 2',
      },
      line_items: [
        {
          id: 501,
          name: 'DEEN Black Denim Pants - 32',
          sku: '108-0101-010',
          quantity: 1,
          price: 1450,
          total: 1450,
          subtotal: 1450,
          taxes: [],
        },
      ],
      meta_data: [
        { id: 1, key: '_sip_outlet_id', value: '2' },
        { id: 2, key: '_sip_created_by', value: '3' },
        { id: 3, key: 'ptc_consignment_id', value: '17263-ABC' },
        { id: 4, key: '_wp_http_referer', value: '/wp-admin/edit.php' },
        { id: 5, key: '_action_scheduler_lock', value: '172900000' },
        { id: 6, key: '_wc_session_timestamp', value: '172900000' },
      ],
    };

    const trimmed = trimWooCommerceOrder(rawWcOrder);

    // Verify bloated properties are purged
    expect(trimmed._links).toBeUndefined();
    expect(trimmed.customer_user_agent).toBeUndefined();
    expect(trimmed.cart_hash).toBeUndefined();
    expect(trimmed.tax_lines).toBeUndefined();

    // Verify required business and reconciliation fields are preserved
    expect(trimmed.id).toBe(17263);
    expect(trimmed.number).toBe('17263');
    expect(trimmed.status).toBe('completed');
    expect(trimmed.total).toBe('2950.00');
    expect((trimmed.billing as Record<string, unknown>).phone).toBe('01711223344');

    // Verify metadata whitelist: unneeded WP hooks stripped, _sip_outlet_id and ptc_consignment_id preserved
    const metaKeys = (trimmed.meta_data as Array<{ key: string }>).map((m) => m.key);
    expect(metaKeys).toContain('_sip_outlet_id');
    expect(metaKeys).toContain('_sip_created_by');
    expect(metaKeys).toContain('ptc_consignment_id');
    expect(metaKeys).not.toContain('_wp_http_referer');
    expect(metaKeys).not.toContain('_action_scheduler_lock');
    expect(metaKeys).not.toContain('_wc_session_timestamp');

    // Verify line item size is pruned
    const lineItem = (trimmed.line_items as Array<Record<string, unknown>>)[0];
    expect(lineItem.sku).toBe('108-0101-010');
    expect(lineItem.taxes).toBeUndefined();
  });

  it('should trim order rows for SQL execution preserving only tabular query columns', () => {
    const rawRows = [
      {
        'Order ID': '18001',
        'Order Status': 'Completed',
        'Delivery Status': 'Delivered',
        'Order Date': '2026-10-15',
        'Order Total Amount': 2400,
        'Item Cost': 1200,
        Quantity: 2,
        SKU: 'DEN-101',
        'Item Name': 'Vintage Denim',
        'City (Shipping)': 'Dhaka',
        'Payment Method Title': 'Cash on delivery',
        districtArea: 'Inside Dhaka',
        fulfillmentLocation: 'Online Store (Central Warehouse)',
        sipInventory: 'Central Warehouse',
        // Extraneous keys that should be stripped
        unneededTelemetryLogs: { ping: true, latency: 45 },
        internalTraceId: 'trace-xyz-123',
        wpRawPayload: { full: true },
      },
    ];

    const trimmed = trimOrderRowsForSql(rawRows);
    expect(trimmed).toHaveLength(1);
    expect(trimmed[0]['Order ID']).toBe('18001');
    expect(trimmed[0]['SKU']).toBe('DEN-101');
    expect(trimmed[0]['unneededTelemetryLogs']).toBeUndefined();
    expect(trimmed[0]['internalTraceId']).toBeUndefined();
    expect(trimmed[0]['wpRawPayload']).toBeUndefined();
  });
});
