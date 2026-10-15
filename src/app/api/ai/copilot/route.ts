import { NextRequest, NextResponse } from 'next/server';
import { generateAICompletion } from '@/lib/geminiClient';
import { COPILOT_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { retrieveRelevantKnowledge } from '@/lib/ai/knowledgeBase';
import { generateQueryAnalyticalFacts, AnalyticsSlices } from '@/lib/ai/semanticAnalytics';

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
      summary: any;
      history?: any[];
      byok?: any;
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
        .filter((h: any) => h && h.text && (h.sender === 'user' || h.sender === 'assistant'))
        .slice(-6)
        .map((h: any) => `${h.sender === 'user' ? 'Merchant' : 'DEEN Assistant'}: ${h.text.trim()}`)
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
${dynamicFactsContext}${knowledgeContext}${activeModuleContext}${historyContext}
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

    const aiAnswer = await generateAICompletion({
      prompt: contextPrompt,
      systemInstruction: COPILOT_SYSTEM_PROMPT,
      temperature: 0.25,
      byokApiKey: byok?.apiKey,
      byokProvider: byok?.provider,
      byokModel: byok?.model,
    });

    if (aiAnswer) {
      return NextResponse.json({
        success: true,
        answer: aiAnswer,
        source: byok?.provider || 'gemini',
        appliedRules: relevantKnowledge.map((k) => k.title),
      });
    }

    // Heuristic Fallback if AI Key is not configured
    let fallbackText = `### Store Performance Summary
- **Gross Dispatched:** ${summary?.grossOrders?.toLocaleString() || 0} orders (৳${(summary?.grossRevenue || 0).toLocaleString()})
- **Net Realized Sales:** ৳${(summary?.netDeliveredRevenue || 0).toLocaleString()} (${summary?.fullDeliveredOrders?.toLocaleString() || 0} orders)
- **Return Rate:** ${(summary?.returnRate || 0).toFixed(1)}% (${summary?.fullReturnedOrders || 0} full returns, ${summary?.partialOrders || 0} partials)
- **Territory Ratio:** ~${Math.round(Number(summary?.outsideRatio) || 1)} Outside orders per 1 Dhaka order.\n\n`;

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
  } catch (error: any) {
    console.error('API /api/ai/copilot error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
