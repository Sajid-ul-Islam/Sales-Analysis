import { NextResponse } from 'next/server';
import { uploadDatasetToBlob, fetchDatasetFromBlob, isBlobConfigured } from '@/lib/blobStorage';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { checkRateLimit } from '@/lib/auth/rateLimiter';
import { createDataProvenance } from '@/lib/dataAudit';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    if (!isBlobConfigured()) {
      return NextResponse.json({
        success: false,
        configured: false,
        message: 'Vercel Blob is not configured. BLOB_READ_WRITE_TOKEN is missing.',
      });
    }

    const result = await fetchDatasetFromBlob();
    if (!result.success || !result.dataset) {
      return NextResponse.json({
        success: false,
        configured: true,
        message: result.message,
      });
    }

    const orderCount = result.dataset.orders?.length || 0;
    const provenance = createDataProvenance('vercel_blob', orderCount, false);

    return NextResponse.json({
      success: true,
      configured: true,
      dataset: result.dataset,
      provenance,
      url: result.url,
      uploadedAt: result.uploadedAt,
      size: result.size,
      ordersCount: orderCount,
      returnsCount: result.dataset.returns?.length || 0,
      partialsCount: result.dataset.partials?.length || 0,
      exchangesCount: result.dataset.exchanges?.length || 0,
      pathaoDeliveryCount: result.dataset.pathaoDelivery?.length || 0,
      message: result.message,
    });
  } catch (err: any) {
    console.error('[API /api/blob/dataset GET] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch dataset from Vercel Blob' },
      { status: 200 } // Graceful zero-500 response
    );
  }
}

export async function POST(req: Request) {
  try {
    // 1. API Authentication & Role Check
    const auth = validateApiRequest(req, { requiredRole: 'operator', allowDemo: true });
    if (!auth.authenticated) {
      return NextResponse.json({
        success: false,
        statusCode: auth.statusCode,
        message: auth.message,
      }, { status: auth.statusCode });
    }

    // 2. Rate Limiting (20 requests per minute)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'internal_caller';
    const rateCheck = checkRateLimit(`blob_upload_${clientIp}`, 20, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json({
        success: false,
        statusCode: 429,
        message: 'Rate limit exceeded: Max 20 Vercel Blob uploads per minute.',
      }, { status: 429 });
    }

    if (!isBlobConfigured()) {
      return NextResponse.json({
        success: false,
        configured: false,
        message: 'Vercel Blob is not configured. Please add BLOB_READ_WRITE_TOKEN in Vercel Environment Variables.',
      });
    }

    const body = await req.json().catch(() => ({}));
    if (!body || (!body.orders && !body.returns)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid dataset payload: Must supply orders or returns array.',
      }, { status: 400 });
    }

    const upload = await uploadDatasetToBlob(body, { createTimestampArchive: true });

    return NextResponse.json({
      success: upload.success,
      configured: true,
      message: upload.message,
      url: upload.url,
      pathname: upload.pathname,
      size: upload.size,
      uploadedAt: upload.uploadedAt,
    });
  } catch (err: any) {
    console.error('[API /api/blob/dataset POST] Error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to upload dataset to Vercel Blob' },
      { status: 500 }
    );
  }
}
