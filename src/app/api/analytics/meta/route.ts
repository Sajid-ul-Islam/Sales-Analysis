import { NextRequest, NextResponse } from 'next/server';
import { fetchFullMetaAnalytics, testMetaConnection } from '@/lib/metaClient';
import { validateApiRequest } from '@/lib/auth/apiAuth';

import { jsonWithEdgeCache } from '@/lib/edgeCache';

// ISR (Incremental Static Regeneration): Cache Meta analytics reports for 5 minutes
export const revalidate = 300;

export async function GET(request: NextRequest) {
  // 1. Operator Auth Check
  const auth = validateApiRequest(request, { requiredRole: 'operator', allowDemo: false });
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.statusCode });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const preset = searchParams.get('preset') || 'last_30d';
    const customToken = searchParams.get('token') || undefined;
    const checkOnly = searchParams.get('check') === 'true';

    if (checkOnly) {
      const status = await testMetaConnection(customToken);
      return jsonWithEdgeCache(status, 'SYSTEM_STATUS', { req: request });
    }

    const report = await fetchFullMetaAnalytics(preset, customToken);
    return jsonWithEdgeCache(report, 'ANALYTICS_REPORT', { req: request });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to process Meta request';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // 1. Operator Auth Check
  const auth = validateApiRequest(request, { requiredRole: 'operator', allowDemo: false });
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.statusCode });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const preset = body.preset || 'last_30d';
    const customToken = body.token || undefined;
    const configuredMetaCost = body.metaAdCost ? parseFloat(body.metaAdCost) : undefined;

    const report = await fetchFullMetaAnalytics(preset, customToken, configuredMetaCost);
    return NextResponse.json(report);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to process Meta request';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
