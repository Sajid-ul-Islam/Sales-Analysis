import { NextRequest } from 'next/server';
import { readSyncEvents, subscribeToSyncEvents, SyncEvent } from '@/lib/sync/eventLog';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/sync/events/stream
 * Unified Server-Sent Events (SSE) endpoint streaming real-time events from
 * WooCommerce and Pathao webhooks to connected browser clients.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const lastEventId =
    req.headers.get('last-event-id') ||
    url.searchParams.get('lastEventId') ||
    undefined;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const safeEnqueue = (chunk: Uint8Array) => {
        if (isClosed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          isClosed = true;
        }
      };

      const sendEvent = (event: SyncEvent) => {
        const payload = `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        safeEnqueue(encoder.encode(payload));
      };

      // 1. Initial greeting & handshake
      safeEnqueue(encoder.encode(`:connected at ${new Date().toISOString()}\n\n`));

      // 2. Catch up on any recent events since lastEventId
      try {
        const pastEvents = await readSyncEvents({ lastEventId, limit: 50 });
        for (const ev of pastEvents) {
          sendEvent(ev);
        }
      } catch (err) {
        console.warn('[SSE] Failed to load past events:', err);
      }

      // 3. Subscribe to real-time events
      const unsubscribe = subscribeToSyncEvents((event) => {
        sendEvent(event);
      });

      // 4. Periodic keepalive heartbeat every 15s
      const keepAliveTimer = setInterval(() => {
        safeEnqueue(encoder.encode(':keepalive\n\n'));
      }, 15000);

      // 5. Cleanup on connection close / abort
      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(keepAliveTimer);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
