import { NextRequest, NextResponse } from 'next/server';
import { fetchFullGA4Analytics, testGA4Connection } from '@/lib/ga4Client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
  try {
    const body = await request.json().catch(() => ({}));
    const range = body.range || '30d';
    const report = await fetchFullGA4Analytics(range);
    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to process GA4 request' },
      { status: 500 }
    );
  }
}
