import { NextRequest, NextResponse } from 'next/server';
import { fetchFullGA4Analytics, testGA4Connection } from '@/lib/ga4Client';
import { validateApiRequest } from '@/lib/auth/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. Operator Auth Check
  const auth = validateApiRequest(request, { requiredRole: 'operator', allowDemo: false });
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.statusCode });
  }

  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get('range') || '30d';
  const checkOnly = searchParams.get('check') === 'true';

  if (checkOnly) {
    const status = await testGA4Connection();
    return NextResponse.json(status);
  }

  const report = await fetchFullGA4Analytics(range);
  return NextResponse.json(report);
}

export async function POST(request: NextRequest) {
  // 1. Operator Auth Check
  const auth = validateApiRequest(request, { requiredRole: 'operator', allowDemo: false });
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.statusCode });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const range = body.range || '30d';
    const report = await fetchFullGA4Analytics(range);
    return NextResponse.json(report);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to process GA4 request';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
