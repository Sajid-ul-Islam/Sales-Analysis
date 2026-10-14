import { NextRequest, NextResponse } from 'next/server';
import { fetchFullGA4Analytics } from '@/lib/ga4Client';
import { fetchFullMetaAnalytics } from '@/lib/metaClient';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get('range') || '30d';

  try {
    const [ga4Data, metaData] = await Promise.all([
      fetchFullGA4Analytics(range),
      fetchFullMetaAnalytics(range === '7d' ? 'last_7d' : 'last_30d'),
    ]);

    // Calculate blended omnichannel cross-metrics
    const ga4Revenue = ga4Data.overview?.totalRevenue || 0;
    const ga4Purchases = ga4Data.overview?.transactions || ga4Data.overview?.conversions || 0;
    const metaSpend = metaData.insights?.spend || 0;
    const metaPurchases = metaData.insights?.purchases || 0;

    const blendedRoas = metaSpend > 0 ? parseFloat((ga4Revenue / metaSpend).toFixed(2)) : 0;
    const blendedCac = ga4Purchases > 0 && metaSpend > 0 ? Math.round(metaSpend / ga4Purchases) : 0;

    return NextResponse.json({
      success: true,
      ga4: ga4Data,
      meta: metaData,
      blended: {
        ga4Revenue,
        ga4Purchases,
        metaSpend,
        metaPurchases,
        blendedRoas,
        blendedCac,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch combined analytics overview' },
      { status: 500 }
    );
  }
}
