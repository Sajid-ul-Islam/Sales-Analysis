import { NextResponse } from 'next/server';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { checkRateLimit } from '@/lib/auth/rateLimiter';
import { sanitizeOrdersResponse } from '@/lib/auth/dataMasking';
import { syncLiveTerminalData } from '@/lib/sync/liveTerminalSync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for multi-page order fetch and consignment tracking

export async function POST(req: Request) {
  try {
    // 1. API Authentication & Role Check
    const auth = validateApiRequest(req, { requiredRole: 'operator', allowDemo: true });
    if (!auth.authenticated) {
      return NextResponse.json(
        {
          success: false,
          statusCode: auth.statusCode,
          message: auth.message,
          orders: [],
        },
        { status: auth.statusCode }
      );
    }

    // 2. Sliding Window Rate Limiting (30 requests per minute)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'internal_caller';
    const rateCheck = checkRateLimit(`sync_live_terminal_${clientIp}`, 30, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 429,
          message: 'Rate limit exceeded: Max 30 live terminal sync requests per minute.',
          orders: [],
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const result = await syncLiveTerminalData({
      wcCredentials: body.wcCredentials,
      pathaoCredentials: body.pathaoCredentials,
      activeOrders: body.activeOrders,
      limitConsignments: body.limitConsignments || 25,
      fetchLiveWc: body.fetchLiveWc !== undefined ? body.fetchLiveWc : true,
    });

    const isPrivileged = auth.role === 'admin' || auth.role === 'operator' || auth.role === 'demo';
    const sanitizedOrders = isPrivileged ? result.orders : sanitizeOrdersResponse(result.orders);

    return NextResponse.json({
      ...result,
      orders: sanitizedOrders,
    });
  } catch (error: any) {
    console.error('Live terminal sync error:', error);
    const msg = error?.message || 'Failed to sync Live Operations Terminal';
    return NextResponse.json(
      {
        success: false,
        error: msg,
        message: msg,
        orders: [],
      },
      { status: 500 }
    );
  }
}
