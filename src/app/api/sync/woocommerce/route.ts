import { NextResponse } from 'next/server';
import { fetchWooCommerceOrders, formatWooCommerceToOrderRows, testWooCommerceConnection } from '@/lib/woocommerceClient';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { checkRateLimit } from '@/lib/auth/rateLimiter';
import { sanitizeOrdersResponse } from '@/lib/auth/dataMasking';
import { createDataProvenance } from '@/lib/dataAudit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for multi-page order fetches on Vercel

export async function POST(req: Request) {
  try {
    // 1. API Authentication & Role Check
    const auth = validateApiRequest(req, { requiredRole: 'operator', allowDemo: true });
    if (!auth.authenticated) {
      return NextResponse.json({
        success: false,
        statusCode: auth.statusCode,
        message: auth.message,
        orders: [],
      }, { status: auth.statusCode });
    }

    // 2. Sliding Window Rate Limiting (30 requests per minute)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'internal_caller';
    const rateCheck = checkRateLimit(`sync_wc_${clientIp}`, 30, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json({
        success: false,
        statusCode: 429,
        message: 'Rate limit exceeded: Max 30 WooCommerce sync requests per minute.',
        orders: [],
      }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const credentials = body.credentials || undefined;
    const test = await testWooCommerceConnection(credentials);

    if (!test.success) {
      return NextResponse.json({
        success: false,
        statusCode: test.status,
        message: test.message,
        orders: [],
      });
    }

    const rawOrders = await fetchWooCommerceOrders({
      perPage: body.perPage || 100,
      status: body.status || 'any',
      after: body.after,
      before: body.before,
      fetchAllPages: body.fetchAllPages !== undefined ? body.fetchAllPages : true,
      maxPages: body.maxPages || 3,
      credentials,
    });

    const formattedRows = formatWooCommerceToOrderRows(rawOrders);

    // 3. PII Sanitization for non-admin/demo roles
    const isPrivileged = auth.role === 'admin';
    const returnRows = isPrivileged ? formattedRows : sanitizeOrdersResponse(formattedRows);
    const provenance = createDataProvenance('live_api', rawOrders.length, !isPrivileged);

    return NextResponse.json({
      success: true,
      message: `Successfully fetched ${rawOrders.length} orders (${formattedRows.length} item line records) from WooCommerce.`,
      ordersCount: rawOrders.length,
      lineItemsCount: formattedRows.length,
      orders: returnRows,
      rawOrders: rawOrders,
      provenance,
    });
  } catch (error: any) {
    console.error('WooCommerce sync error:', error);
    const msg = error?.message || 'Failed to sync with WooCommerce';
    return NextResponse.json(
      {
        success: false,
        error: msg,
        message: msg,
        orders: [],
        rawOrders: [],
      },
      { status: 500 }
    );
  }
}
