import { NextResponse } from 'next/server';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { checkRateLimit } from '@/lib/auth/rateLimiter';
import { batchResolveCustomerRatings, resolveCustomerRating } from '@/lib/customerRating';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const auth = validateApiRequest(req, { requiredRole: 'readonly', allowDemo: true });
    if (!auth.authenticated) {
      return NextResponse.json({
        success: false,
        statusCode: auth.statusCode,
        message: auth.message,
      }, { status: auth.statusCode });
    }

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'internal_caller';
    const rateCheck = await checkRateLimit(`rating_lookup_${clientIp}`, 120, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json({
        success: false,
        statusCode: 429,
        message: 'Rate limit exceeded: Max 120 customer rating checks per minute.',
      }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const credentials = body.credentials || undefined;
    const singlePhone = body.phone ? String(body.phone).trim() : null;
    const batchInput = Array.isArray(body.batch) ? body.batch : (Array.isArray(body.phones) ? body.phones : null);
    const phoneList: string[] = batchInput
      ? batchInput.map((p: unknown) => String(p || '').trim()).filter(Boolean)
      : (singlePhone ? [singlePhone] : []);

    if (phoneList.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No phone numbers provided for customer rating check.',
        ratings: {},
      });
    }

    // Limit batch size to 50 numbers per request
    const cappedList = phoneList.slice(0, 50);
    const ratings = await batchResolveCustomerRatings(cappedList, { credentials });

    return NextResponse.json({
      success: true,
      message: `Retrieved delivery ratings for ${Object.keys(ratings).length} customer phone numbers.`,
      count: Object.keys(ratings).length,
      ratings,
    });
  } catch (error: unknown) {
    console.error('Customer rating API error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to retrieve customer ratings';
    return NextResponse.json({
      success: false,
      message: msg,
      ratings: {},
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const auth = validateApiRequest(req, { requiredRole: 'readonly', allowDemo: true });
    if (!auth.authenticated) {
      return NextResponse.json({
        success: false,
        statusCode: auth.statusCode,
        message: auth.message,
      }, { status: auth.statusCode });
    }

    const url = new URL(req.url);
    const phone = url.searchParams.get('phone');
    if (!phone) {
      return NextResponse.json({
        success: false,
        message: 'Query parameter "phone" is required.',
      }, { status: 400 });
    }

    const rating = await resolveCustomerRating(phone);
    return NextResponse.json({
      success: true,
      rating,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to retrieve customer rating';
    return NextResponse.json({
      success: false,
      message: msg,
    }, { status: 500 });
  }
}
