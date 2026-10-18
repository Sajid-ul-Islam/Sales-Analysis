import { NextRequest, NextResponse } from 'next/server';
import { generateAICompletion } from '@/lib/geminiClient';
import { COPILOT_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { retrieveRelevantKnowledge } from '@/lib/ai/knowledgeBase';
import { generateQueryAnalyticalFacts, AnalyticsSlices } from '@/lib/ai/semanticAnalytics';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { SummaryAnalytics } from '@/types';
import { CopilotChatMessage } from '@/lib/chatHistory';
import { AIProvider } from '@/lib/byok';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      query,
      summary,
      history = [],
      byok,
      activeTab,
      tabLabel,
      pageContext,
      analyticsSlices
    } = body as {
      query: string;
      summary: SummaryAnalytics;
      history?: CopilotChatMessage[];
      byok?: { apiKey?: string; provider?: AIProvider; model?: string };
      activeTab?: string;
      tabLabel?: string;
      pageContext?: string;
      analyticsSlices?: AnalyticsSlices;
    };

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query string required' }, { status: 400 });
    }

    // 1. RAG-like Semantic Retrieval of Business Rules, SOPs & Metric Formulas
    const relevantKnowledge = retrieveRelevantKnowledge(query, activeTab, 3);
    let knowledgeContext = '';
    if (relevantKnowledge.length > 0) {
      const knowledgeBlocks = relevantKnowledge
        .map(
          (k) =>
            `### [Domain Knowledge: ${k.title}]\n- **Summary:** ${k.summary}\n- **Rule / Calculation Standard:** ${k.formulaOrRule}${
              k.operationalSOP ? `\n- **Operational Action SOP:** ${k.operationalSOP}` : ''
            }`
        )
        .join('\n\n');
      knowledgeContext = `\nRetrieved Business Rules & Metric Specifications:\n${knowledgeBlocks}\n`;
    }

    // 2. Deterministic Analytical Slicing for Query Focus
    const queryFacts = generateQueryAnalyticalFacts(query, summary, analyticsSlices, activeTab);
    let dynamicFactsContext = '';
    if (queryFacts) {
      dynamicFactsContext = `\nFocused Ground-Truth Metrics for this Query:\n${queryFacts}\n`;
    }

    // 3. Format recent chat turns for contextual multi-turn understanding
    let historyContext = '';
    if (Array.isArray(history) && history.length > 0) {
      const turns = history
        .filter((h: CopilotChatMessage) => h && h.text && (h.sender === 'user' || h.sender === 'assistant'))
        .slice(-6)
        .map((h: CopilotChatMessage) => `${h.sender === 'user' ? 'Merchant' : 'DEEN Assistant'}: ${h.text.trim()}`)
        .join('\n\n');
      if (turns) {
        historyContext = `\nRecent Conversation Context:\n${turns}\n`;
      }
    }

    // 4. Active Dashboard View Context
    const activeModuleContext = tabLabel
      ? `\nActive Dashboard View / Context:\n- Active Page: ${tabLabel}${activeTab ? ` (${activeTab})` : ''}\n${pageContext ? `- Page Focus: ${pageContext}\n` : ''}`
      : '';

    // 5. Construct Grounded Prompt
    const liveOpsSlice = analyticsSlices?.liveOps;
    let liveOpsContext = '';
    if (liveOpsSlice) {
      const l = liveOpsSlice;
      liveOpsContext = `\nReal-Time Operational Ground Truth (Live Terminal & Courier Telemetry):
- Operational Date: ${l.refDayName} (${l.referenceDate})${l.isFallbackDate ? ' [Displaying latest recorded dispatches snapshot]' : ''}
- Today's Shipped Orders: ${l.todayShipped.ordersCount} orders (${l.todayShipped.itemsCount} items)
- Today's Gross Shipped Sales: ৳${l.todayShipped.grossRevenue.toLocaleString()} (AOV: ৳${l.todayShipped.aov.toLocaleString()})
- vs 7-Day Daily Average Baseline: ${l.todayShipped.deltaVs7dVolumePct >= 0 ? '+' : ''}${l.todayShipped.deltaVs7dVolumePct}% items | ${l.todayShipped.deltaVs7dRevenuePct >= 0 ? '+' : ''}${l.todayShipped.deltaVs7dRevenuePct}% revenue
- Live Warehouse Fulfillment Queue: ${l.queue.totalCount} orders pending packaging (${l.queue.processingCount} processing, ${l.queue.holdCount} on-hold)
- Today's Total Active Orders: ${l.todaysOrders.totalCount} orders (${l.todaysOrders.shippedCount} shipped + ${l.todaysOrders.processingCount} in packaging)
- Real-Time Courier Telemetry (Pathao): ${l.courierTelemetry.deliveredCount} Delivered, ${l.courierTelemetry.inTransitCount} In Transit, ${l.courierTelemetry.returnedCount} Returned, ${l.courierTelemetry.pendingPickupCount} Pending Pickup, ${l.courierTelemetry.untrackedCount} Untracked
- Courier Handover Rate: ${l.courierTelemetry.handedOverRate}% (${l.courierTelemetry.handedOverCount} parcels handed over)
- Real-Time COD Collected: ৳${l.courierTelemetry.totalCodCollected.toLocaleString()}
- Active Courier Discrepancies: ${l.courierTelemetry.discrepanciesCount} alerts
- 7-Day Rolling Baseline: ${l.sevenDayBaseline.avg7dItems} items/day | ${l.sevenDayBaseline.avg7dOrders} orders/day | ৳${l.sevenDayBaseline.avg7dRevenue.toLocaleString()}/day (AOV: ৳${l.sevenDayBaseline.avg7dAov.toLocaleString()})\n`;
    }

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
${liveOpsContext}${dynamicFactsContext}${knowledgeContext}${activeModuleContext}${historyContext}
User Executive Question:
"${query}"

Instructions:
1. Provide a crisp, analytical, executive-level answer strictly grounded in the deterministic numbers and retrieved business rules above.
2. If business rules (like branch suffix decoding, Knapsack integer partials, or courier SLAs) are relevant, cite and explain them clearly.
3. Ground your advice in the merchant's current page context (${tabLabel || 'Executive Overview'}), answering directly to the operational area they are inspecting.
4. Format your response cleanly using rich GitHub Flavored Markdown:
   - Use headings (### for sections)
   - Use bullet points (- ) with bold keys (**Metric:** value)
   - Use markdown tables (| ... |) when comparing metrics or locations
   - Highlight monetary amounts with '৳' symbol
   - Avoid unformatted plain walls of text.`;

    // 4. API Authentication & Token Protection
    const auth = validateApiRequest(req, { requiredRole: 'operator', allowDemo: true });
    const isAuthorizedOperator = auth.authenticated && (auth.role === 'admin' || auth.role === 'operator');
    const hasByok = Boolean(byok?.apiKey && String(byok.apiKey).trim().length > 5);

    let aiAnswer: string | null = null;

    // Security Invariant: Only permit external LLM calls if the caller has verified operator credentials OR supplies their own BYOK key.
    if (isAuthorizedOperator || hasByok) {
      aiAnswer = await generateAICompletion({
        prompt: contextPrompt,
        systemInstruction: COPILOT_SYSTEM_PROMPT,
        temperature: 0.25,
        byokApiKey: byok?.apiKey,
        byokProvider: byok?.provider,
        byokModel: byok?.model,
      });
    }

    if (aiAnswer) {
      return NextResponse.json({
        success: true,
        answer: aiAnswer,
        source: byok?.provider || 'gemini',
        appliedRules: relevantKnowledge.map((k) => k.title),
      });
    }

    // Heuristic Fallback if AI Key is not configured
    let fallbackText = '';
    const qLower = query.toLowerCase();
    const isLiveOpsQuery =
      qLower.includes('today') ||
      qLower.includes('todays') ||
      qLower.includes('sale') ||
      qLower.includes('queue') ||
      qLower.includes('dispatch') ||
      qLower.includes('courier') ||
      qLower.includes('reconciliation') ||
      qLower.includes('7-day') ||
      qLower.includes('baseline');

    if (isLiveOpsQuery && liveOpsSlice) {
      const l = liveOpsSlice;
      fallbackText += `### Today's Sales & Operational Executive Summary
- **Operational Date:** ${l.refDayName} (${l.referenceDate})
- **Today's Dispatched Volume:** ${l.todayShipped.ordersCount} orders (${l.todayShipped.itemsCount} items)
- **Gross Shipped Sales:** ৳${l.todayShipped.grossRevenue.toLocaleString()} (AOV: ৳${l.todayShipped.aov.toLocaleString()})
- **vs 7-Day Daily Baseline:** ${l.todayShipped.deltaVs7dVolumePct >= 0 ? '+' : ''}${l.todayShipped.deltaVs7dVolumePct}% items | ${l.todayShipped.deltaVs7dRevenuePct >= 0 ? '+' : ''}${l.todayShipped.deltaVs7dRevenuePct}% revenue
- **Warehouse Fulfillment Queue:** ${l.queue.totalCount} orders pending packaging (${l.queue.processingCount} processing, ${l.queue.holdCount} on-hold)
- **Today's Total Orders:** ${l.todaysOrders.totalCount} active orders (${l.todaysOrders.shippedCount} shipped + ${l.todaysOrders.processingCount} in packaging)

### Real-Time Courier Telemetry (Pathao)
- **Delivered Parcels:** ${l.courierTelemetry.deliveredCount} (COD Collected: ৳${l.courierTelemetry.totalCodCollected.toLocaleString()})
- **In Transit / Out for Delivery:** ${l.courierTelemetry.inTransitCount} parcels
- **Courier Handover Rate:** ${l.courierTelemetry.handedOverRate}%
- **Active Courier Discrepancies:** ${l.courierTelemetry.discrepanciesCount} alerts

### Daily Reconciliation & 7-Day Baseline
- **7-Day Daily Average Baseline:** ${l.sevenDayBaseline.avg7dItems} items/day | ৳${l.sevenDayBaseline.avg7dRevenue.toLocaleString()}/day (AOV: ৳${l.sevenDayBaseline.avg7dAov.toLocaleString()})\n\n`;
    } else {
      fallbackText += `### Store Performance Summary
- **Gross Dispatched:** ${summary?.grossOrders?.toLocaleString() || 0} orders (৳${(summary?.grossRevenue || 0).toLocaleString()})
- **Net Realized Sales:** ৳${(summary?.netDeliveredRevenue || 0).toLocaleString()} (${summary?.fullDeliveredOrders?.toLocaleString() || 0} orders)
- **Return Rate:** ${(summary?.returnRate || 0).toFixed(1)}% (${summary?.fullReturnedOrders || 0} full returns, ${summary?.partialOrders || 0} partials)
- **Territory Ratio:** ~${Math.round(Number(summary?.outsideRatio) || 1)} Outside orders per 1 Dhaka order.\n\n`;
    }

    if (queryFacts) {
      fallbackText += `### Relevant Operational Data\n${queryFacts}\n\n`;
    }

    if (relevantKnowledge.length > 0) {
      fallbackText += `### Applicable Business Policy\n`;
      for (const k of relevantKnowledge) {
        fallbackText += `**${k.title}:** ${k.formulaOrRule}\n\n`;
      }
    } else {
      fallbackText += `*Note: For conversational AI synthesis, connect a free Gemini API key in the BYOK settings.*`;
    }

    return NextResponse.json({
      success: true,
      answer: fallbackText,
      source: 'offline_knowledge_fallback',
      appliedRules: relevantKnowledge.map((k) => k.title),
    });
  } catch (error: unknown) {
    console.error('API /api/ai/copilot error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
