import { NextResponse } from 'next/server';
import {
  processPathaoWebhookEvent,
  verifyPathaoWebhookSecret,
  PathaoWebhookPayload,
  getLiveWebhookUpdates,
} from '@/lib/pathaoWebhookEngine';
import { logAuditAction } from '@/lib/settingsStore';
import { updateWooCommerceOrderTracking } from '@/lib/woocommerceClient';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/pathao/webhook
 * Health check and webhook verification challenge handler for Pathao setup.
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

  const liveUpdates = getLiveWebhookUpdates();
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/sync/pathao/webhook',
    registeredEvents: ['order.status_updated', 'order.delivered', 'order.returned'],
    cachedUpdatesCount: liveUpdates.size,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/sync/pathao/webhook
 * Receives real-time courier consignment telemetry events from Pathao Hermes.
 */
export async function POST(req: Request) {
  try {
    // 1. Authenticate webhook request
    const authHeader =
      req.headers.get('x-pathao-signature') ||
      req.headers.get('x-webhook-secret') ||
      req.headers.get('authorization');

    const isValid = verifyPathaoWebhookSecret(authHeader);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 401,
          message: 'Unauthorized: Invalid or missing Pathao webhook secret or signature.',
        },
        { status: 401 }
      );
    }

    // 2. Parse incoming payload
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          statusCode: 400,
          message: 'Bad Request: Missing or malformed JSON payload.',
        },
        { status: 400 }
      );
    }

    // Support both single event object and batch array
    const rawEvents: PathaoWebhookPayload[] = Array.isArray(body)
      ? body
      : Array.isArray(body.data)
      ? body.data
      : [body];

    const processedRecords = [];
    for (const evt of rawEvents) {
      const record = processPathaoWebhookEvent(evt);
      if (record) {
        processedRecords.push(record);

        // Asynchronously persist consignment tracking to WooCommerce order meta without blocking response
        if (record.merchantOrderId && record.consignmentId) {
          updateWooCommerceOrderTracking(record.merchantOrderId, {
            consignmentId: record.consignmentId,
            status: record.rawStatus,
            collectedAmount: record.collectedAmount,
          }).catch((err) => {
            console.warn(`[PathaoWebhook] Reverse sync to WC for order #${record.merchantOrderId} failed:`, err);
          });
        }
      }
    }

    // 3. Log audit event
    if (processedRecords.length > 0) {
      logAuditAction(
        'PATHAO_WEBHOOK_EVENT',
        `Processed ${processedRecords.length} live courier telemetry update(s)`
      );
    }

    return NextResponse.json({
      success: true,
      statusCode: 200,
      processed: processedRecords.length,
      records: processedRecords,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown internal error';
    return NextResponse.json(
      {
        success: false,
        statusCode: 500,
        message: `Internal webhook processing error: ${message}`,
      },
      { status: 500 }
    );
  }
}
