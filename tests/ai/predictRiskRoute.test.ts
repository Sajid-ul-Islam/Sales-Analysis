import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGenerateAICompletion = vi.fn();
vi.mock('@/lib/geminiClient', () => ({
  generateAICompletion: (...args: any[]) => mockGenerateAICompletion(...args),
}));

import { POST as postPredictRisk } from '@/app/api/ai/predict-risk/route';
import { createSessionToken } from '@/lib/auth/session';

describe('AI Pre-Dispatch RTO Risk Predictor Route (/api/ai/predict-risk)', () => {
  let operatorToken: string;

  beforeEach(async () => {
    mockGenerateAICompletion.mockReset();
    operatorToken = await createSessionToken({
      id: 'op_1',
      username: 'dispatch_operator',
      displayName: 'Dispatch Operator',
      role: 'operator',
      authMethod: 'PASSCODE',
    });
  });

  const createAuthenticatedRequest = (body: Record<string, unknown>) => {
    return new NextRequest('http://localhost:3000/api/ai/predict-risk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `deen_session=${operatorToken}`,
      },
      body: JSON.stringify(body),
    });
  };

  it('rejects unauthenticated requests with HTTP 401', async () => {
    const unauthReq = new NextRequest('http://localhost:3000/api/ai/predict-risk', {
      method: 'POST',
      body: JSON.stringify({ order: { orderId: '101' } }),
    });
    const res = await postPredictRisk(unauthReq);
    expect(res.status).toBe(401);
  });

  it('rejects requests missing the order object with HTTP 400', async () => {
    const req = createAuthenticatedRequest({});
    const res = await postPredictRisk(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Order details required');
  });

  it('parses valid Gemini LLM response with structured RTO evaluation', async () => {
    const mockGeminiOutput = JSON.stringify({
      riskScore: 78,
      riskTier: 'HIGH_RISK',
      reasonEn: 'Customer note indicates uncertainty in sizing and inspection demand.',
      reasonBn: 'গ্রাহক ডেলিভারি নেওয়ার আগে সাইজ দেখে নেওয়ার শর্ত দিয়েছেন।',
      recommendedAction: 'CALL_TO_VERIFY_SIZE',
    });

    mockGenerateAICompletion.mockResolvedValueOnce(mockGeminiOutput);

    const req = createAuthenticatedRequest({
      order: {
        orderId: '19450',
        customerName: 'Shakil Ahmed',
        phone: '01712345678',
        city: 'Chattogram',
        customerNote: 'Delivery man er samne check kore nibo, size na mille ferot dibo',
        orderAmount: 2450,
        items: [{ itemName: 'Classic Slim Fit Denim', size: '32', quantity: 1 }],
      },
    });

    const res = await postPredictRisk(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.source).toBe('gemini');
    expect(data.aiEvaluation.riskScore).toBe(78);
    expect(data.aiEvaluation.riskTier).toBe('HIGH_RISK');
    expect(data.aiEvaluation.recommendedAction).toBe('CALL_TO_VERIFY_SIZE');
    expect(data.aiEvaluation.reasonBn).toContain('গ্রাহক');
  });

  describe('Deterministic Heuristic Fallback Engine', () => {
    it('detects sizing hesitation in customer notes and triggers CALL_TO_VERIFY_SIZE', async () => {
      // Simulate Gemini unavailable (returns null or empty)
      mockGenerateAICompletion.mockResolvedValueOnce(null);

      const req = createAuthenticatedRequest({
        order: {
          orderId: '19451',
          customerName: 'Rifat Hasan',
          phone: '01899990000',
          city: 'Dhaka',
          customerNote: 'Size na mille delivery boy ke ferot diye dibo',
          orderAmount: 1850,
          items: [{ itemName: 'Oxford Cotton Shirt', size: 'L', quantity: 1 }],
        },
      });

      const res = await postPredictRisk(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.source).toBe('heuristic_fallback');
      expect(data.aiEvaluation.riskScore).toBe(75);
      expect(data.aiEvaluation.riskTier).toBe('HIGH_RISK');
      expect(data.aiEvaluation.recommendedAction).toBe('CALL_TO_VERIFY_SIZE');
      expect(data.aiEvaluation.reasonBn).toContain('গ্রাহক সাইজ পরিবর্তন');
    });

    it('detects multi-item bracketing and triggers CALL_TO_VERIFY_SIZE with MEDIUM risk', async () => {
      mockGenerateAICompletion.mockResolvedValueOnce(null);

      const req = createAuthenticatedRequest({
        order: {
          orderId: '19452',
          customerName: 'Imtiaz Hossain',
          phone: '01911112222',
          city: 'Sylhet',
          customerNote: '',
          orderAmount: 4200,
          items: [
            { itemName: 'Polo Tee - Navy', size: 'M', quantity: 1 },
            { itemName: 'Polo Tee - Navy', size: 'L', quantity: 1 },
          ],
        },
      });

      const res = await postPredictRisk(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.source).toBe('heuristic_fallback');
      expect(data.aiEvaluation.riskScore).toBe(65);
      expect(data.aiEvaluation.riskTier).toBe('MEDIUM');
      expect(data.aiEvaluation.recommendedAction).toBe('CALL_TO_VERIFY_SIZE');
      expect(data.aiEvaluation.reasonEn).toContain('bracketing');
    });

    it('approves standard low-risk single-item order with INSTANT_DISPATCH', async () => {
      mockGenerateAICompletion.mockResolvedValueOnce(null);

      const req = createAuthenticatedRequest({
        order: {
          orderId: '19453',
          customerName: 'Saad Mahmud',
          phone: '01700001111',
          city: 'Dhaka',
          customerNote: 'Please deliver after 2pm',
          orderAmount: 1650,
          items: [{ itemName: 'Signature Casual Trousers', size: '32', quantity: 1 }],
        },
      });

      const res = await postPredictRisk(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.source).toBe('heuristic_fallback');
      expect(data.aiEvaluation.riskScore).toBe(20);
      expect(data.aiEvaluation.riskTier).toBe('LOW');
      expect(data.aiEvaluation.recommendedAction).toBe('INSTANT_DISPATCH');
    });
  });
});
