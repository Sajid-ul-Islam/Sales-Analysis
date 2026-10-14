import { NextResponse } from 'next/server';
import { fetchWooCommerceOrders, formatWooCommerceToOrderRows, testWooCommerceConnection } from '@/lib/woocommerceClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for multi-page order fetches on Vercel

export async function POST(req: Request) {
  try {
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

    return NextResponse.json({
      success: true,
      message: `Successfully fetched ${rawOrders.length} orders (${formattedRows.length} item line records) from WooCommerce.`,
      ordersCount: rawOrders.length,
      lineItemsCount: formattedRows.length,
      orders: formattedRows,
      rawOrders,
    });
  } catch (error: any) {
    console.error('WooCommerce sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to sync with WooCommerce',
      },
      { status: 500 }
    );
  }
}
