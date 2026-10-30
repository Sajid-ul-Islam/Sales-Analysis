import { NextResponse } from 'next/server';
import { fetchWooCommerceOrders, formatWooCommerceToOrderRows, testWooCommerceConnection } from '@/lib/woocommerceClient';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { checkRateLimit } from '@/lib/auth/rateLimiter';
import { sanitizeOrdersResponse } from '@/lib/auth/dataMasking';
import { createDataProvenance } from '@/lib/dataAudit';
import { trimWooCommerceOrder } from '@/lib/edgeCache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for multi-page order fetches on Vercel

export async function POST(req: Request) {
  try {
    // 1. API Authentication & Role Check - Operator or Admin only
    const auth = validateApiRequest(req, { requiredRole: 'operator', allowDemo: false });
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
    const rateCheck = await checkRateLimit(`sync_wc_${clientIp}`, 30, 60000);
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
      orderBy: body.orderBy || 'date',
      order: body.order || 'desc',
      search: body.search,
      customer: body.customer,
      datesAreGmt: body.datesAreGmt,
      fetchAllPages: body.fetchAllPages !== undefined ? body.fetchAllPages : true,
      maxPages: Math.min(body.maxPages || 10, 20),
      credentials,
    });

    const formattedRows = formatWooCommerceToOrderRows(rawOrders);

    // 3. PII Sanitization for non-admin/demo roles
    const isPrivileged = auth.authenticated && (auth.role === 'admin' || auth.role === 'operator');
    const returnRows = isPrivileged ? formattedRows : sanitizeOrdersResponse(formattedRows);
    const provenance = createDataProvenance('live_api', rawOrders.length, !isPrivileged);

    // 4. Real-Time Operational Breakdown
    const statusBreakdown: Record<string, number> = {};
    const branchBreakdown: Record<string, number> = {};
    let posCount = 0;
    let onlineCount = 0;
    let totalRevenue = 0;

    for (const r of formattedRows) {
      const st = String(r['Delivery Status'] || r.status || 'processing').toLowerCase();
      statusBreakdown[st] = (statusBreakdown[st] || 0) + 1;
      const br = String(r.fulfillmentBranch || 'Online Store');
      branchBreakdown[br] = (branchBreakdown[br] || 0) + 1;
      if (r.isPos) posCount++;
      else onlineCount++;
      totalRevenue += Number(r['Item Cost'] || 0) * Number(r.Quantity || 1);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully fetched ${rawOrders.length} orders (${formattedRows.length} item line records) from WooCommerce.`,
      ordersCount: rawOrders.length,
      lineItemsCount: formattedRows.length,
      orders: returnRows,
      rawOrders: isPrivileged
        ? rawOrders.map((o) => trimWooCommerceOrder(o as Record<string, unknown>))
        : [],
      breakdown: {
        byStatus: statusBreakdown,
        byBranch: branchBreakdown,
        posCount,
        onlineCount,
        totalRevenue: Math.round(totalRevenue),
      },
      provenance,
    });
  } catch (error: unknown) {
    console.error('WooCommerce sync error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to sync with WooCommerce';
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
