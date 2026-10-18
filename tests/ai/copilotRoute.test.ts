import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { RawOrderRow } from '@/types';
import { computeLiveOpsSlice } from '@/lib/ai/semanticAnalytics';

// Mock generateAICompletion to isolate offline fallback and mocked LLM testing
const mockGenerateAICompletion = vi.fn();
vi.mock('@/lib/geminiClient', () => ({
  generateAICompletion: (...args: any[]) => mockGenerateAICompletion(...args)
}));

import { POST } from '@/app/api/ai/copilot/route';

describe('/api/ai/copilot Live Ops Integration', () => {
  beforeEach(() => {
    mockGenerateAICompletion.mockReset();
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const mockOrders: RawOrderRow[] = [
    {
      orderId: '3001',
      status: 'completed',
      date_modified: `${todayIso}T12:00:00`,
      date_created: `${todayIso}T10:00:00`,
      itemCost: 1850,
      orderAmount: 1850,
      quantity: 1,
      itemName: 'DEEN Signature Panjabi',
      customerName: 'Kazi Rahman',
      phone: '01811112222',
      deliveryStatus: 'Delivered',
      pathaoStatus: 'Delivered',
      courierCollectedCod: 1850,
    },
    {
      orderId: '3002',
      status: 'processing',
      date_modified: `${todayIso}T13:00:00`,
      date_created: `${todayIso}T11:00:00`,
      itemCost: 2400,
      orderAmount: 2400,
      quantity: 2,
      itemName: 'Casual Shirt',
      customerName: 'Tanvir Hossain',
      phone: '01922223333',
      deliveryStatus: 'In Transit',
      pathaoStatus: 'In Transit',
      courierCollectedCod: 0,
    },
    {
      orderId: '3003',
      status: 'on-hold',
      date_modified: `${todayIso}T13:30:00`,
      date_created: `${todayIso}T11:30:00`,
      itemCost: 1200,
      orderAmount: 1200,
      quantity: 1,
      itemName: 'Polo Tee',
      customerName: 'Siam Ahmed',
      phone: '01733334444',
      deliveryStatus: 'Pending Pickup',
    }
  ];

  const liveOpsSlice = computeLiveOpsSlice(mockOrders);

  const mockSummary = {
    grossOrders: 3,
    grossSalesRevenue: 5450,
    deliveredOrders: 1,
    paidReturnOrders: 0,
    notPaidReturnOrders: 0,
    exchangeOrders: 0,
    partialOrders: 0,
    netDeliveredRevenue: 1850,
    returnRatePercentage: 0,
    totalCourierFee: 150,
    totalCodFee: 20,
    totalCourierCharged: 170,
    linehaulDistribution: {
      insideDhakaCount: 2,
      outsideDhakaCount: 1,
      subDhakaCount: 0,
      insideDhakaPercentage: 66.7,
      outsideDhakaPercentage: 33.3,
      subDhakaPercentage: 0
    },
    estimatedPackagingCost: 60,
    estimatedCogs: 2450,
    discrepancyCount: 0,
    discrepancyTotalTaka: 0,
    netProfit: 1200,
    netMarginPercent: 22.0,
    marketingRoas: 4.5
  };

  it('rejects missing query with 400 status', async () => {
    const req = new NextRequest('http://localhost:3000/api/ai/copilot', {
      method: 'POST',
      body: JSON.stringify({})
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Query string required');
  });

  it('returns grounded offline heuristic answer when asking about today sales and telemetry without LLM key', async () => {
    mockGenerateAICompletion.mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/ai/copilot', {
      method: 'POST',
      body: JSON.stringify({
        query: "What are today's sales, queue, and real-time courier telemetry?",
        summary: mockSummary,
        activeTab: 'tabLiveOps',
        tabLabel: 'Live Terminal',
        analyticsSlices: {
          liveOps: liveOpsSlice
        }
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.answer).toBeDefined();
    expect(data.answer).toContain("Today's Sales & Operational Executive Summary");
    expect(data.answer).toContain("Today's Dispatched Volume");
    expect(data.answer).toContain("Fulfillment Queue");
    expect(data.answer).toContain("Real-Time Courier Telemetry");
    expect(data.appliedRules.some((rule: string) => rule.includes("Shipped") || rule.includes("Today"))).toBe(true);
    expect(data.source).toBe('offline_knowledge_fallback');
  });

  it('includes 7-day rolling baseline in response when comparing performance in offline mode', async () => {
    mockGenerateAICompletion.mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/ai/copilot', {
      method: 'POST',
      body: JSON.stringify({
        query: "Compare today's performance with 7-day baseline",
        summary: mockSummary,
        activeTab: 'tabLiveOps',
        tabLabel: 'Live Terminal',
        analyticsSlices: {
          liveOps: liveOpsSlice
        }
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.answer).toContain("7-Day Rolling Baseline");
    expect(data.appliedRules.some((rule: string) => rule.includes('Baseline') || rule.includes('Shipped'))).toBe(true);
  });

  it('passes liveOpsContext and query facts to LLM prompt when LLM is active with valid operator auth', async () => {
    process.env.ADMIN_API_SECRET = 'secret_admin_key_123';
    mockGenerateAICompletion.mockResolvedValue('### Executive Response\nToday shipped revenue reached ৳1,850 across 1 orders.');

    const req = new NextRequest('http://localhost:3000/api/ai/copilot', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret_admin_key_123',
      },
      body: JSON.stringify({
        query: "What are today's sales and revenue?",
        summary: mockSummary,
        activeTab: 'tabLiveOps',
        tabLabel: 'Live Terminal',
        analyticsSlices: {
          liveOps: liveOpsSlice
        }
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.answer).toContain('Today shipped revenue reached ৳1,850');
    expect(data.source).toBe('gemini');

    // Verify context passed to generateAICompletion
    expect(mockGenerateAICompletion).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateAICompletion.mock.calls[0][0];
    expect(callArgs.prompt).toContain("Today's Shipped Orders:");
    expect(callArgs.prompt).toContain("Live Warehouse Fulfillment Queue:");
    expect(callArgs.prompt).toContain("Real-Time Courier Telemetry");
  });

  it('prevents anonymous callers from consuming server LLM keys and falls back to deterministic briefing', async () => {
    mockGenerateAICompletion.mockResolvedValue('### This should NOT be called by anonymous users');

    const req = new NextRequest('http://localhost:3000/api/ai/copilot', {
      method: 'POST',
      body: JSON.stringify({
        query: "What are today's sales?",
        summary: mockSummary,
        activeTab: 'tabLiveOps',
        tabLabel: 'Live Terminal',
        analyticsSlices: {
          liveOps: liveOpsSlice
        }
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    // LLM must NOT be called for anonymous users without BYOK
    expect(mockGenerateAICompletion).not.toHaveBeenCalled();
    expect(data.source).toBe('offline_knowledge_fallback');
    expect(data.answer).toContain("Today's Dispatched Volume");
  });
});
