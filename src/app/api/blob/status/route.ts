import { NextResponse } from 'next/server';
import { getBlobStorageStatus, isBlobConfigured } from '@/lib/blobStorage';
import { validateApiRequest } from '@/lib/auth/apiAuth';

import { jsonWithEdgeCache } from '@/lib/edgeCache';

// ISR (Incremental Static Regeneration): Revalidate blob status at most once every 60 seconds
export const revalidate = 60;

export async function GET(req: Request) {
  try {
    // 1. Operator Authentication Check
    const auth = validateApiRequest(req, { requiredRole: 'operator', allowDemo: false });
    if (!auth.authenticated) {
      return NextResponse.json({
        configured: false,
        statusCode: auth.statusCode,
        message: auth.message,
      }, { status: auth.statusCode });
    }

    const configured = isBlobConfigured();
    if (!configured) {
      return jsonWithEdgeCache({
        configured: false,
        message: 'Vercel Blob is not configured. Add BLOB_READ_WRITE_TOKEN to your environment.',
      }, 'SYSTEM_STATUS', { req });
    }

    const status = await getBlobStorageStatus();
    return jsonWithEdgeCache({
      configured: true,
      status,
      message: status.latestBlob
        ? `Vercel Blob active: latest dataset updated ${status.latestBlob.uploadedAt}`
        : 'Vercel Blob active: store is ready (no dataset uploaded yet).',
    }, 'SYSTEM_STATUS', { req });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error checking Vercel Blob status';
    return NextResponse.json({
      configured: false,
      error: errorMsg,
    }, { status: 500 });
  }
}

