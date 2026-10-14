import { NextRequest, NextResponse } from 'next/server';
import { generateAICompletion } from '@/lib/geminiClient';
import { COPILOT_SYSTEM_PROMPT } from '@/lib/ai/prompts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, summary, history = [], byok } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query string required' }, { status: 400 });
    }

    // Prepare contextual store facts
    const contextPrompt = `Store Performance Facts (Reconciled by Knapsack DP Engine):
- Gross Orders Dispatched: ${summary?.grossOrders?.toLocaleString() || 0}
- Net Delivered Orders: ${summary?.fullDeliveredOrders?.toLocaleString() || 0}
- Full Returns: ${summary?.fullReturnedOrders?.toLocaleString() || 0} (${(summary?.fullReturnRate || 0).toFixed(1)}%)
- Partials: ${summary?.partialOrders?.toLocaleString() || 0} (${(summary?.partialRate || 0).toFixed(1)}%)
- Total Return Rate (Full + Partials): ${(summary?.returnRate || 0).toFixed(1)}%
- Gross Dispatched Revenue: ৳${(summary?.grossRevenue || 0).toLocaleString()}
- Realized Net Revenue: ৳${(summary?.netDeliveredRevenue || 0).toLocaleString()}
- Inside Dhaka Orders: ${summary?.insideOrders?.toLocaleString() || 0} (Net: ৳${(summary?.insideNetRevenue || 0).toLocaleString()})
- Outside Dhaka Orders: ${summary?.outsideOrders?.toLocaleString() || 0} (Net: ৳${(summary?.outsideNetRevenue || 0).toLocaleString()})
- Territory Outside Ratio: ~${Math.round(Number(summary?.outsideRatio) || (summary?.outsideOrders / Math.max(1, summary?.insideOrders || 1))) || 1} : 1
- Exchanged Orders: ${summary?.totalExchangedOrders || 0} (COD collected: ৳${(summary?.totalExchangeCodCollected || 0).toLocaleString()})

User Executive Question:
"${query}"

Instructions:
Provide a crisp, analytical, executive-level answer based on the real store numbers above. Highlight takeaways, risks, and recommendations.`;

    const aiAnswer = await generateAICompletion({
      prompt: contextPrompt,
      systemInstruction: COPILOT_SYSTEM_PROMPT,
      temperature: 0.3,
      byokApiKey: byok?.apiKey,
      byokProvider: byok?.provider,
      byokModel: byok?.model,
    });

    if (aiAnswer) {
      return NextResponse.json({
        success: true,
        answer: aiAnswer,
        source: byok?.provider || 'gemini',
      });
    }

    // Heuristic Fallback if AI Key is not configured
    let fallbackText = `### Store Performance Summary
- **Gross Dispatched:** ${summary?.grossOrders?.toLocaleString() || 0} orders (৳${(summary?.grossRevenue || 0).toLocaleString()})
- **Net Realized Sales:** ৳${(summary?.netDeliveredRevenue || 0).toLocaleString()} (${summary?.fullDeliveredOrders?.toLocaleString() || 0} orders)
- **Return Rate:** ${(summary?.returnRate || 0).toFixed(1)}% (${summary?.fullReturnedOrders || 0} full returns, ${summary?.partialOrders || 0} partials)
- **Territory Ratio:** ~${Math.round(Number(summary?.outsideRatio) || 1)} Outside orders per 1 Dhaka order.

*Note: For deeper contextual question answering, ensure your GEMINI_API_KEY is configured in your environment or Settings tab.*`;

    return NextResponse.json({
      success: true,
      answer: fallbackText,
      source: 'offline_summary',
    });
  } catch (error: any) {
    console.error('API /api/ai/copilot error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
