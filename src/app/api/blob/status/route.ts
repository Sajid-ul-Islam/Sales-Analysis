import { NextResponse } from 'next/server';
import { getBlobStorageStatus, isBlobConfigured } from '@/lib/blobStorage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
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
  } catch (err: any) {
    return NextResponse.json({
      configured: false,
      error: err?.message || 'Error checking Vercel Blob status',
    });
  }
}
