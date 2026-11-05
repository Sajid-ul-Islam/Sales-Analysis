import { put, list, del } from '@vercel/blob';
import { DatasetSnapshot, RawOrderRow } from '@/types';
import { sanitizeOrdersResponse } from '@/lib/auth/dataMasking';
import { stripEmptyProperties } from '@/lib/edgeCache';

export const LATEST_BLOB_PATHNAME = 'deen_dataset_latest.json';

// In-Memory Multi-Tier Cache to eliminate redundant Fast Origin Transfer
interface MemoryCacheEntry {
  url: string;
  uploadedAt: string;
  size: number;
  dataset: DatasetSnapshot;
  etag: string;
  fetchedAt: number;
  expiresAt: number;
}

let memoryCache: MemoryCacheEntry | null = null;
const MEM_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache validity in compute

/**
 * Manually flushes the in-memory blob cache (used by tests and force-syncs).
 */
export function clearBlobMemoryCache(): void {
  memoryCache = null;
}

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
  isFromCache?: boolean;
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
 * PAYLOAD OPTIMIZATION: Empty strings and nulls are stripped to shrink wire size.
 */
export async function uploadDatasetToBlob(
  dataset: Partial<DatasetSnapshot>,
  _options: { createTimestampArchive?: boolean } = {}
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

  // 2. Strip empty string and null properties to reduce payload footprint by up to 35%
  const trimmedOrders = sanitizedOrders.map(row => stripEmptyProperties(row as Record<string, unknown>) as RawOrderRow);
  const trimmedReturns = sanitizedReturns.map(row => stripEmptyProperties(row as Record<string, unknown>) as RawOrderRow);
  const trimmedPartials = sanitizedPartials.map(row => stripEmptyProperties(row as Record<string, unknown>) as RawOrderRow);
  const trimmedExchanges = sanitizedExchanges.map(row => stripEmptyProperties(row as Record<string, unknown>) as RawOrderRow);
  const trimmedPathao = sanitizedPathao.map(row => stripEmptyProperties(row as Record<string, unknown>) as RawOrderRow);

  const payload: DatasetSnapshot = {
    orders: trimmedOrders,
    pathaoDelivery: trimmedPathao,
    returns: trimmedReturns,
    partials: trimmedPartials,
    exchanges: trimmedExchanges,
    sourceName: dataset.sourceName || 'Cloud Synced Dataset (Vercel Blob - Masked)',
    syncedAt: new Date().toISOString(),
    version: '2.0.0',
  };

  const serialized = JSON.stringify(payload);
  const sizeBytes = Buffer.byteLength(serialized, 'utf8');

  try {
    // 3. Upload snapshot with random cryptographic suffix so filename is unguessable
    const blob = await put(LATEST_BLOB_PATHNAME, serialized, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/json',
    });

    // 4. Immediately populate the in-memory compute cache so subsequent reads within compute
    // do NOT download what was just uploaded!
    memoryCache = {
      url: blob.url,
      uploadedAt: payload.syncedAt,
      size: sizeBytes,
      dataset: payload,
      etag: `W/"blob-${payload.syncedAt}-${sizeBytes}"`,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + MEM_CACHE_TTL_MS,
    };

    // 5. Clean up older snapshots to prevent clutter and obsolete exposure
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
  } catch (err: unknown) {
    console.error('[VercelBlob] Error uploading to Vercel Blob:', err);
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to upload dataset to Vercel Blob',
    };
  }
}

/**
 * Retrieves the latest DatasetSnapshot from Vercel Blob with multi-tier in-memory caching.
 * Protects against excessive Fast Origin Transfer by preventing redundant 18MB cloud downloads.
 */
export async function fetchDatasetFromBlob(options?: { forceRefresh?: boolean }): Promise<BlobFetchResult> {
  if (!isBlobConfigured()) {
    return {
      success: false,
      message: 'Vercel Blob is not configured. BLOB_READ_WRITE_TOKEN is missing.',
    };
  }

  // Tier 1: Return from active in-memory compute cache if still fresh (0 network transfer!)
  if (!options?.forceRefresh && memoryCache && Date.now() < memoryCache.expiresAt) {
    return {
      success: true,
      dataset: memoryCache.dataset,
      url: memoryCache.url,
      uploadedAt: memoryCache.uploadedAt,
      size: memoryCache.size,
      message: `Retrieved ${memoryCache.dataset.orders?.length || 0} orders from warm memory cache (0 network transfer).`,
      isFromCache: true,
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

    const targetUploadedIso = target.uploadedAt.toISOString();

    // Tier 2: Check if existing in-memory dataset is identical in timestamp & size to the cloud blob
    if (!options?.forceRefresh && memoryCache && memoryCache.uploadedAt === targetUploadedIso && memoryCache.size === target.size) {
      memoryCache.expiresAt = Date.now() + MEM_CACHE_TTL_MS;
      return {
        success: true,
        dataset: memoryCache.dataset,
        url: memoryCache.url,
        uploadedAt: memoryCache.uploadedAt,
        size: memoryCache.size,
        message: `Verified cloud blob timestamp unchanged; served from warm memory cache (0 network transfer).`,
        isFromCache: true,
      };
    }

    // Tier 3: Cloud fetch with Next.js edge caching and compression headers
    const response = await fetch(target.url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Failed to fetch blob content from ${target.url} (HTTP ${response.status})`,
      };
    }

    const dataset: DatasetSnapshot = await response.json();

    // Update in-memory compute cache
    memoryCache = {
      url: target.url,
      uploadedAt: targetUploadedIso,
      size: target.size,
      dataset,
      etag: `W/"blob-${targetUploadedIso}-${target.size}"`,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + MEM_CACHE_TTL_MS,
    };

    return {
      success: true,
      dataset,
      url: target.url,
      uploadedAt: targetUploadedIso,
      size: target.size,
      message: `Retrieved ${dataset.orders?.length || 0} orders from Vercel Blob (${target.url}).`,
      isFromCache: false,
    };
  } catch (err: unknown) {
    console.error('[VercelBlob] Error fetching from Vercel Blob:', err);
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Error communicating with Vercel Blob',
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
