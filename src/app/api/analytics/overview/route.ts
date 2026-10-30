import { NextRequest, NextResponse } from 'next/server';
import { fetchFullGA4Analytics } from '@/lib/ga4Client';
import { fetchFullMetaAnalytics } from '@/lib/metaClient';
import { validateApiRequest } from '@/lib/auth/apiAuth';

import { jsonWithEdgeCache } from '@/lib/edgeCache';

// ISR (Incremental Static Regeneration): Cache combined analytics overview for 5 minutes
export const revalidate = 300;

export async function GET(request: NextRequest) {
  // 1. Operator Auth Check
  const auth = validateApiRequest(request, { requiredRole: 'operator', allowDemo: false });
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.statusCode });
  }

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

    return jsonWithEdgeCache({
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
    }, 'ANALYTICS_REPORT', { req: request });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch combined analytics overview';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
