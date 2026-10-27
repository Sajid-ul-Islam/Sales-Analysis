import { NextResponse } from 'next/server';
import { uploadDatasetToBlob, fetchDatasetFromBlob, isBlobConfigured } from '@/lib/blobStorage';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { checkRateLimit } from '@/lib/auth/rateLimiter';
import { createDataProvenance } from '@/lib/dataAudit';
import { sampleDatasetSnapshot } from '@/lib/orderSampling';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // 1. API Authentication & Role Check
    const auth = validateApiRequest(req, { requiredRole: 'operator', allowDemo: false });
    if (!auth.authenticated) {
      return NextResponse.json({
        success: false,
        statusCode: auth.statusCode,
        message: auth.message,
      }, { status: auth.statusCode });
    }

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

    const finalDataset = (auth.sampleRate && auth.sampleRate < 1)
      ? sampleDatasetSnapshot(result.dataset, auth.sampleRate)
      : result.dataset;
    const orderCount = finalDataset.orders?.length || 0;
    const isPrivileged = auth.role === 'admin' || auth.role === 'operator';
    const provenance = createDataProvenance('vercel_blob', orderCount, !isPrivileged);

    return NextResponse.json({
      success: true,
      configured: true,
      dataset: finalDataset,
      provenance,
      uploadedAt: result.uploadedAt,
      size: result.size,
      ordersCount: orderCount,
      returnsCount: finalDataset.returns?.length || 0,
      partialsCount: finalDataset.partials?.length || 0,
      exchangesCount: finalDataset.exchanges?.length || 0,
      pathaoDeliveryCount: finalDataset.pathaoDelivery?.length || 0,
      message: result.message,
    });
  } catch (err: unknown) {
    console.error('[API /api/blob/dataset GET] Error:', err);
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch dataset from Vercel Blob';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // 1. API Authentication & Role Check - Operator or Admin only, strictly NO demo access
    const auth = validateApiRequest(req, { requiredRole: 'operator', allowDemo: false });
    if (!auth.authenticated) {
      return NextResponse.json({
        success: false,
        statusCode: auth.statusCode,
        message: auth.message,
      }, { status: auth.statusCode });
    }

    // 2. Rate Limiting (20 requests per minute)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'internal_caller';
    const rateCheck = await checkRateLimit(`blob_upload_${clientIp}`, 20, 60000);
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

    const upload = await uploadDatasetToBlob(body, { createTimestampArchive: false });

    return NextResponse.json({
      success: upload.success,
      configured: true,
      message: upload.message,
      pathname: upload.pathname,
      size: upload.size,
      uploadedAt: upload.uploadedAt,
    });
  } catch (err: unknown) {
    console.error('[API /api/blob/dataset POST] Error:', err);
    const errorMsg = err instanceof Error ? err.message : 'Failed to upload dataset to Vercel Blob';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
