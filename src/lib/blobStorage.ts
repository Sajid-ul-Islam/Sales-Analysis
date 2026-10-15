import { put, list, del } from '@vercel/blob';
import { DatasetSnapshot } from '@/types';

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
    url: string;
    pathname: string;
    size: number;
    uploadedAt: Date;
  } | null;
  totalSnapshots: number;
}

/**
 * Uploads a DatasetSnapshot to Vercel Blob with public read access.
 * Overwrites deen_dataset_latest.json so all visitors receive the updated snapshot.
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

  const payload: DatasetSnapshot = {
    orders: dataset.orders || [],
    pathaoDelivery: dataset.pathaoDelivery || [],
    returns: dataset.returns || [],
    partials: dataset.partials || [],
    exchanges: dataset.exchanges || [],
    sourceName: dataset.sourceName || 'Cloud Synced Dataset (Vercel Blob)',
    syncedAt: new Date().toISOString(),
    version: '2.0.0',
  };

  const serialized = JSON.stringify(payload);
  const sizeBytes = Buffer.byteLength(serialized, 'utf8');

  try {
    // 1. Upload latest snapshot with deterministic pathname (addRandomSuffix: false allows predictable overwrite)
    const blob = await put(LATEST_BLOB_PATHNAME, serialized, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    });

    // 2. Optionally create a timestamped backup archive
    if (options.createTimestampArchive) {
      const archiveName = `archives/deen_dataset_${Date.now()}.json`;
      await put(archiveName, serialized, {
        access: 'public',
        contentType: 'application/json',
      }).catch(err => console.warn('[VercelBlob] Failed to write archive copy:', err));
    }

    return {
      success: true,
      url: blob.url,
      pathname: blob.pathname,
      size: sizeBytes,
      uploadedAt: payload.syncedAt,
      message: `Successfully uploaded ${payload.orders.length} orders & ${payload.returns.length} returns to Vercel Blob (${(sizeBytes / 1024).toFixed(1)} KB).`,
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
    const { blobs } = await list({ prefix: LATEST_BLOB_PATHNAME });
    const target = blobs.find(b => b.pathname === LATEST_BLOB_PATHNAME) || blobs[0];

    if (!target) {
      return {
        success: false,
        message: 'No dataset snapshot found in Vercel Blob store.',
      };
    }

    // Fetch the JSON payload from the public blob URL
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
    const latest = blobs.find(b => b.pathname === LATEST_BLOB_PATHNAME) || blobs[0] || null;

    return {
      configured: true,
      latestBlob: latest ? {
        url: latest.url,
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
