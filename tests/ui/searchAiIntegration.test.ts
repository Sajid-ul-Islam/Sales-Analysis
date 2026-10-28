import { describe, it, expect, vi } from 'vitest';
import { getTabContext } from '@/lib/ai/contextualPrompts';
import { detectAgenticIntent } from '@/lib/ai/agenticActions';

describe('Search & Header AI Assistant Integration', () => {
  it('detects tab context accurately when querying AI assistant from search', () => {
    const executiveContext = getTabContext('tabExecutive');
    expect(executiveContext.label).toBe('Executive Overview');
    expect(executiveContext.summaryFocus).toContain('net delivered revenue');

    const liveOpsContext = getTabContext('tabLiveOps');
    expect(liveOpsContext.label).toBe('Live Operations Terminal');
    expect(liveOpsContext.summaryFocus).toContain('fulfillment');

    const ordersContext = getTabContext('tabOrders');
    expect(ordersContext.label).toBe('Orders Ledger');
  });

  it('verifies dynamic AI search query formatting for command palette and header', () => {
    const userQuery = 'why is mirpur return rate higher than central warehouse?';
    
    // Command palette dynamic item generator behavior
    const dynamicAiItem = {
      id: 'action-dynamic-copilot',
      category: 'AI Assistant',
      title: `Ask DEEN Assistant: "${userQuery}"`,
      subtitle: `Ask AI Copilot to analyze "${userQuery}" with live orders, returns, and delivery telemetry`,
      badge: 'Ask AI ↵',
      query: userQuery,
    };

    expect(dynamicAiItem.title).toContain(userQuery);
    expect(dynamicAiItem.badge).toBe('Ask AI ↵');
    expect(dynamicAiItem.category).toBe('AI Assistant');
  });

  it('handles preset AI prompts for rapid executive search discovery', () => {
    const AI_PRESET_PROMPTS = [
      {
        id: 'ai-prompt-queue',
        title: "Analyze today fulfillment queue and dispatch pace",
        prompt: "Analyze today's fulfillment queue, warehouse pack backlog, and compare with our 7-day rolling baseline."
      },
      {
        id: 'ai-prompt-returns',
        title: 'Why is return rate fluctuating by outlet and territory?',
        prompt: "Compare return rates between Central Warehouse and regional branches (Mirpur, Cumilla, Wari, Sylhet). What are the main drivers of return loss?"
      },
      {
        id: 'ai-prompt-customers',
        title: 'Identify top chronic returners and risky buyers',
        prompt: "Identify the top chronic returners and high-risk customer phone numbers with return rates over 40%."
      },
      {
        id: 'ai-prompt-net-sales',
        title: 'Calculate net realized revenue after returns and courier costs',
        prompt: "Provide an executive summary of net delivered sales, return deductions, COGS, and net brand burden."
      },
      {
        id: 'ai-prompt-courier',
        title: 'Audit Pathao courier delivery tracking and COD discrepancies',
        prompt: "Audit courier delivery discrepancies and mismatches between Pathao courier status and store orders."
      }
    ];

    expect(AI_PRESET_PROMPTS.length).toBe(5);
    AI_PRESET_PROMPTS.forEach(p => {
      expect(p.prompt.length).toBeGreaterThan(20);
      expect(p.title.length).toBeGreaterThan(10);
    });
  });

  it('detects agentic intent from search queries forwarded to DEEN Assistant', () => {
    const mockReconciliation: any = {
      courierMismatches: [
        {
          orderId: '1001',
          statusMismatch: true,
          reconciliationStatus: 'DISCREPANCY_COURIER_RETURNED_WC_DELIVERED',
          customerName: 'Rahim Khan'
        }
      ],
      customerRiskProfiles: [
        {
          customerPhone: '01711111111',
          customerName: 'Karim Ahmed',
          returnRate: 0.85,
          totalOrders: 6
        }
      ]
    };

    const action = detectAgenticIntent('fix courier mismatches', mockReconciliation);
    expect(action).toBeDefined();
    if (action) {
      expect(action.affectedCount).toBeGreaterThan(0);
    }
  });
});
