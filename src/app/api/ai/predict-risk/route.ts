import { NextRequest, NextResponse } from 'next/server';
import { generateAICompletion } from '@/lib/geminiClient';
import { RTO_PREDICTION_SYSTEM_PROMPT } from '@/lib/ai/prompts';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order } = body;

    if (!order) {
      return NextResponse.json({ error: 'Order details required' }, { status: 400 });
    }

    const orderPrompt = `Order ID: ${order.orderId || 'N/A'}
Customer: ${order.customerName || 'N/A'}
Phone: ${order.phone || 'N/A'}
City: ${order.city || 'N/A'}
Shipping Address: ${order.address || 'N/A'}
Customer Note: "${order.customerNote || ''}"
Order Amount: ৳${order.orderAmount || 0}
Line Items: ${Array.isArray(order.items) ? order.items.map((it: any) => `${it.itemName || ''} (Size: ${it.size || ''}, Qty: ${it.quantity || 1})`).join('; ') : 'N/A'}`;

    const rawResponse = await generateAICompletion({
      prompt: orderPrompt,
      systemInstruction: RTO_PREDICTION_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      temperature: 0.1,
    });

    if (rawResponse) {
      try {
        const parsed = JSON.parse(rawResponse);
        return NextResponse.json({ success: true, aiEvaluation: parsed, source: 'gemini' });
      } catch (parseErr) {
        // Fall back to heuristic below
      }
    }

    // Deterministic Heuristic Fallback if Gemini key is unset or network error
    const note = String(order.customerNote || '').toLowerCase();
    const isBracketing = Array.isArray(order.items) && order.items.length > 1;
    let fallbackScore = 20;
    let reasonEn = 'Standard low-risk residential order.';
    let reasonBn = 'সাধারণ আবাসিক অর্ডার।';
    let action = 'INSTANT_DISPATCH';

    if (note.includes('size na mille') || note.includes('check kore') || note.includes('dekhe')) {
      fallbackScore = 75;
      reasonEn = 'Customer expressed hesitation regarding product size and inspection.';
      reasonBn = 'গ্রাহক সাইজ পরিবর্তন বা দেখার শর্ত দিয়েছেন।';
      action = 'CALL_TO_VERIFY_SIZE';
    } else if (isBracketing) {
      fallbackScore = 65;
      reasonEn = 'Multi-item parcel with multiple sizes detected (potential bracketing).';
      reasonBn = 'একাধিক সাইজের পোশাক একই সাথে অর্ডার করা হয়েছে।';
      action = 'CALL_TO_VERIFY_SIZE';
    }

    const tier = fallbackScore >= 70 ? 'HIGH_RISK' : fallbackScore >= 40 ? 'MEDIUM' : 'LOW';

    return NextResponse.json({
      success: true,
      aiEvaluation: {
        riskScore: fallbackScore,
        riskTier: tier,
        reasonEn,
        reasonBn,
        recommendedAction: action,
      },
      source: 'heuristic_fallback',
    });
  } catch (error: any) {
    console.error('API /api/ai/predict-risk error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
