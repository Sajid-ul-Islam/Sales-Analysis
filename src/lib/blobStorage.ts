import { put, list, del } from '@vercel/blob';
import { DatasetSnapshot } from '@/types';
import { sanitizeOrdersResponse } from '@/lib/auth/dataMasking';

export const LATEST_BLOB_PATHNAME = 'deen_dataset_latest.json';

/**
 * Checks whether Vercel Blob credentials exist in the environment.
 */
export function isBlobConfigured(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
    (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)
  );
}

export interface BlobUploadResult {
  success: boolean;
  url?: string;
  pathname?: string;
  size?: number;
  uploadedAt?: string;
  message: string;
}

export interface BlobFetchResult {
  success: boolean;
  dataset?: DatasetSnapshot;
  url?: string;
  uploadedAt?: string;
  size?: number;
  message: string;
}

export interface BlobStatusResult {
  configured: boolean;
  latestBlob: {
    pathname: string;
    size: number;
    uploadedAt: Date;
  } | null;
  totalSnapshots: number;
}

/**
 * Uploads a DatasetSnapshot to Vercel Blob.
 * STRICT SECURITY INVARIANT: All customer rows (Name, Phone, Email, Address)
 * are thoroughly sanitized and masked before being serialized to cloud storage.
 */
export async function uploadDatasetToBlob(
  dataset: Partial<DatasetSnapshot>,
  options: { createTimestampArchive?: boolean } = {}
): Promise<BlobUploadResult> {
  if (!isBlobConfigured()) {
    return {
      success: false,
      message: 'Vercel Blob is not configured. Add BLOB_READ_WRITE_TOKEN to your Vercel Environment Variables.',
    };
  }

  // 1. Mandatory PII Sanitization across all order & delivery entities before serialization
  const sanitizedOrders = sanitizeOrdersResponse(dataset.orders || [], 'full');
  const sanitizedReturns = sanitizeOrdersResponse(dataset.returns || [], 'full');
  const sanitizedPartials = sanitizeOrdersResponse(dataset.partials || [], 'full');
  const sanitizedExchanges = sanitizeOrdersResponse(dataset.exchanges || [], 'full');
  const sanitizedPathao = sanitizeOrdersResponse(dataset.pathaoDelivery || [], 'full');

  const payload: DatasetSnapshot = {
    orders: sanitizedOrders,
    pathaoDelivery: sanitizedPathao,
    returns: sanitizedReturns,
    partials: sanitizedPartials,
    exchanges: sanitizedExchanges,
    sourceName: dataset.sourceName || 'Cloud Synced Dataset (Vercel Blob - Masked)',
    syncedAt: new Date().toISOString(),
    version: '2.0.0',
  };

  const serialized = JSON.stringify(payload);
  const sizeBytes = Buffer.byteLength(serialized, 'utf8');

  try {
    // 2. Upload snapshot with random cryptographic suffix so filename is unguessable
    const blob = await put(LATEST_BLOB_PATHNAME, serialized, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/json',
    });

    // 3. Clean up older snapshots to prevent clutter and obsolete exposure
    try {
      const { blobs } = await list({ prefix: 'deen_dataset_latest' });
      const obsolete = blobs.filter(b => b.url !== blob.url);
      if (obsolete.length > 0) {
        await del(obsolete.map(b => b.url));
      }
    } catch (cleanupErr) {
      console.warn('[VercelBlob] Failed to clean up obsolete snapshots:', cleanupErr);
    }

    return {
      success: true,
      pathname: blob.pathname,
      size: sizeBytes,
      uploadedAt: payload.syncedAt,
      message: `Successfully uploaded ${payload.orders.length} orders & ${payload.returns.length} returns to Vercel Blob (${(sizeBytes / 1024).toFixed(1)} KB, PII-sanitized).`,
    };
  } catch (err: any) {
    console.error('[VercelBlob] Error uploading to Vercel Blob:', err);
    return {
      success: false,
      message: err?.message || 'Failed to upload dataset to Vercel Blob',
    };
  }
}

/**
 * Retrieves the latest DatasetSnapshot from Vercel Blob.
 */
export async function fetchDatasetFromBlob(): Promise<BlobFetchResult> {
  if (!isBlobConfigured()) {
    return {
      success: false,
      message: 'Vercel Blob is not configured. BLOB_READ_WRITE_TOKEN is missing.',
    };
  }

  try {
    const { blobs } = await list({ prefix: 'deen_dataset_latest' });
    const sorted = [...blobs].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    const target = sorted[0];

    if (!target) {
      return {
        success: false,
        message: 'No dataset snapshot found in Vercel Blob store.',
      };
    }

    // Fetch the JSON payload from the blob URL
    const response = await fetch(target.url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store', // Always get fresh cloud state
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Failed to fetch blob content from ${target.url} (HTTP ${response.status})`,
      };
    }

    const dataset: DatasetSnapshot = await response.json();
    return {
      success: true,
      dataset,
      url: target.url,
      uploadedAt: target.uploadedAt.toISOString(),
      size: target.size,
      message: `Retrieved ${dataset.orders?.length || 0} orders from Vercel Blob (${target.url}).`,
    };
  } catch (err: any) {
    console.error('[VercelBlob] Error fetching from Vercel Blob:', err);
    return {
      success: false,
      message: err?.message || 'Error communicating with Vercel Blob',
    };
  }
}

/**
 * Inspects status of Vercel Blob store.
 */
export async function getBlobStorageStatus(): Promise<BlobStatusResult> {
  if (!isBlobConfigured()) {
    return {
      configured: false,
      latestBlob: null,
      totalSnapshots: 0,
    };
  }

  try {
    const { blobs } = await list({ limit: 10 });
    const matching = blobs.filter(b => b.pathname.startsWith('deen_dataset_latest'));
    const latest = matching.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0] || blobs[0] || null;

    return {
      configured: true,
      latestBlob: latest ? {
        pathname: latest.pathname,
        size: latest.size,
        uploadedAt: latest.uploadedAt,
      } : null,
      totalSnapshots: blobs.length,
    };
  } catch (err) {
    console.warn('[VercelBlob] Error listing blobs:', err);
    return {
      configured: false,
      latestBlob: null,
      totalSnapshots: 0,
    };
  }
}
