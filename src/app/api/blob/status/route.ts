import { NextResponse } from 'next/server';
import { getBlobStorageStatus, isBlobConfigured } from '@/lib/blobStorage';
import { validateApiRequest } from '@/lib/auth/apiAuth';

export const dynamic = 'force-dynamic';

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
      return NextResponse.json({
        configured: false,
        message: 'Vercel Blob is not configured. Add BLOB_READ_WRITE_TOKEN to your environment.',
      });
    }

    const status = await getBlobStorageStatus();
    return NextResponse.json({
      configured: true,
      status,
      message: status.latestBlob
        ? `Vercel Blob active: latest dataset updated ${status.latestBlob.uploadedAt}`
        : 'Vercel Blob active: store is ready (no dataset uploaded yet).',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error checking Vercel Blob status';
    return NextResponse.json({
      configured: false,
      error: errorMsg,
    }, { status: 500 });
  }
}

