import { NextRequest, NextResponse } from 'next/server';
import { generateAICompletion } from '@/lib/geminiClient';
import { detectAIProvider, AIProvider } from '@/lib/byok';
import { checkRateLimit } from '@/lib/auth/rateLimiter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'internal_caller';
    const rateCheck = await checkRateLimit(`byok_test_${clientIp}`, 10, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded: Max 10 BYOK connectivity tests per minute.',
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { apiKey = '', provider: propProvider, model: propModel } = body;

    const trimmedKey = (apiKey || '').trim();

    // Auto-detect provider and model if not explicitly specified
    let provider: AIProvider = propProvider;
    let model = propModel;

    if (!provider || !model) {
      const detected = detectAIProvider(trimmedKey);
      if (!provider) provider = detected.provider;
      if (!model) model = detected.model;
    }

    if (!trimmedKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'No API key provided. Please paste a valid API key to test.',
        },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Send a minimal ping prompt to verify connectivity and quota
    const pingPrompt = 'Respond with "PONG" only.';
    const response = await generateAICompletion({
      prompt: pingPrompt,
      systemInstruction: 'You are an automated API connectivity health-checker. Respond with "PONG" only.',
      temperature: 0.1,
      byokApiKey: trimmedKey,
      byokProvider: provider,
      byokModel: model,
    });

    const latencyMs = Date.now() - startTime;

    if (!response) {
      return NextResponse.json({
        success: false,
        error: `Failed to connect to ${provider.toUpperCase()}. Please verify that your API key is valid, active, and has sufficient quota/credits.`,
      });
    }

    return NextResponse.json({
      success: true,
      provider,
      model,
      latencyMs,
      message: `Connected successfully to ${provider.toUpperCase()} (${model}) in ${latencyMs}ms!`,
    });
  } catch (error: unknown) {
    console.error('BYOK test API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred while verifying the API key.',
      },
      { status: 500 }
    );
  }
}
