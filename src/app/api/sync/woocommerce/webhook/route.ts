import { NextResponse } from 'next/server';
import { appendSyncEvent } from '@/lib/sync/eventLog';
import { formatWooCommerceToOrderRows, WcOrder } from '@/lib/woocommerceClient';

export const dynamic = 'force-dynamic';

function verifyWcWebhookAuth(req: Request): boolean {
  const configuredSecret =
    process.env.WC_WEBHOOK_SECRET ||
    process.env.INTERNAL_SYNC_SECRET ||
    process.env.ADMIN_API_SECRET;

  // If no secret configured in environment, allow in development/test mode
  if (!configuredSecret) {
    return true;
  }

  const url = new URL(req.url);
  const secretParam = url.searchParams.get('secret');

  const authHeader =
    req.headers.get('x-wc-webhook-secret') ||
    req.headers.get('x-webhook-secret') ||
    req.headers.get('x-wc-webhook-signature') ||
    req.headers.get('authorization') ||
    secretParam;

  if (!authHeader) {
    return false;
  }

  const cleanProvided = authHeader.replace(/^Bearer\s+/i, '').trim();
  const cleanConfigured = configuredSecret.replace(/^Bearer\s+/i, '').trim();

  return cleanProvided === cleanConfigured;
}

/**
 * GET /api/sync/woocommerce/webhook
 * Health check & webhook verification ping
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const challenge = searchParams.get('challenge') || searchParams.get('hub.challenge');

  if (challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({
    status: 'active',
    endpoint: '/api/sync/woocommerce/webhook',
    supportedTopics: ['order.updated', 'order.created', 'order.deleted'],
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/sync/woocommerce/webhook
 * Ingests real-time order lifecycle events pushed by WooCommerce.
 */
export async function POST(req: Request) {
  try {
    // 1. Authenticate request
    if (!verifyWcWebhookAuth(req)) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 401,
          message: 'Unauthorized: Invalid or missing WooCommerce webhook secret.',
        },
        { status: 401 }
      );
    }

    // Check WooCommerce webhook topic header
    const topicHeader = req.headers.get('x-wc-webhook-topic') || 'order.updated';

    // Handle WooCommerce Webhook Ping/Verification test
    if (topicHeader.includes('ping')) {
      return NextResponse.json({
        success: true,
        message: 'WooCommerce webhook test ping verified successfully.',
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Parse payload
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          statusCode: 400,
          message: 'Bad Request: Missing or invalid JSON body.',
        },
        { status: 400 }
      );
    }

    const rawOrders: WcOrder[] = Array.isArray(body)
      ? body
      : Array.isArray((body as { data?: unknown }).data)
      ? ((body as { data: WcOrder[] }).data)
      : [body as WcOrder];

    const processedEvents = [];

    for (const rawOrder of rawOrders) {
      const orderId = String(rawOrder.id || rawOrder.number || '').trim();
      const status = String(rawOrder.status || 'processing').toLowerCase();
      const total = Number(rawOrder.total) || 0;
      const customerName =
        [rawOrder.billing?.first_name, rawOrder.billing?.last_name]
          .filter(Boolean)
          .join(' ') ||
        rawOrder.billing?.phone ||
        'Customer';

      // Format line items if possible
      let lineItemCount = 0;
      try {
        const rows = formatWooCommerceToOrderRows([rawOrder]);
        lineItemCount = rows.length;
      } catch {
        lineItemCount = rawOrder.line_items?.length || 1;
      }

      const summary = `Order #${orderId || 'N/A'} updated (${status}) — ৳${total.toLocaleString()} (${lineItemCount} item${lineItemCount === 1 ? '' : 's'})`;

      const event = await appendSyncEvent({
        type: `wc:${topicHeader.replace(/^action\./, '')}`,
        source: 'woocommerce',
        summary,
        orderId,
        payload: {
          orderId,
          status,
          total,
          customerName,
          lineItemCount,
          currency: rawOrder.currency || 'BDT',
          dateModified: rawOrder.date_modified || new Date().toISOString(),
          paymentMethod: rawOrder.payment_method_title || rawOrder.payment_method || 'COD',
          shippingCity: rawOrder.shipping?.city || rawOrder.billing?.city || '',
        },
      });

      processedEvents.push(event);
    }

    return NextResponse.json({
      success: true,
      processed: processedEvents.length,
      events: processedEvents,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error('[WcWebhook] Processing error:', error);
    const msg = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json(
      {
        success: false,
        statusCode: 500,
        message: `Failed to process WooCommerce webhook: ${msg}`,
      },
      { status: 500 }
    );
  }
}
