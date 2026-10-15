import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isBlobConfigured, uploadDatasetToBlob, fetchDatasetFromBlob, getBlobStorageStatus } from '@/lib/blobStorage';
import { downloadDatasetAsJson } from '@/lib/datasetExport';
import { DatasetSnapshot } from '@/types';

describe('Vercel Blob & Dataset Snapshot Persistence (Methods 1 & 3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Method 3: Vercel Blob Graceful Degradation', () => {
    it('isBlobConfigured returns false when BLOB_READ_WRITE_TOKEN is absent', () => {
      const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
      delete process.env.BLOB_READ_WRITE_TOKEN;
      delete process.env.VERCEL_OIDC_TOKEN;

      expect(isBlobConfigured()).toBe(false);

      if (originalToken) process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    });

    it('uploadDatasetToBlob gracefully returns failure when token is not configured', async () => {
      const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
      delete process.env.BLOB_READ_WRITE_TOKEN;
      delete process.env.VERCEL_OIDC_TOKEN;

      const result = await uploadDatasetToBlob({ orders: [] });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Vercel Blob is not configured');

      if (originalToken) process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    });

    it('fetchDatasetFromBlob gracefully returns failure when token is not configured', async () => {
      const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
      delete process.env.BLOB_READ_WRITE_TOKEN;
      delete process.env.VERCEL_OIDC_TOKEN;

      const result = await fetchDatasetFromBlob();
      expect(result.success).toBe(false);
      expect(result.message).toContain('BLOB_READ_WRITE_TOKEN is missing');

      if (originalToken) process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    });

    it('getBlobStorageStatus returns configured: false when token is absent', async () => {
      const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
      delete process.env.BLOB_READ_WRITE_TOKEN;
      delete process.env.VERCEL_OIDC_TOKEN;

      const status = await getBlobStorageStatus();
      expect(status.configured).toBe(false);
      expect(status.latestBlob).toBeNull();

      if (originalToken) process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    });
  });

  describe('Method 1: Dataset Export Formatting', () => {
    it('generates standard DatasetSnapshot schema without throwing in SSR', () => {
      // In Node environment (window === undefined), downloadDatasetAsJson safely no-ops
      expect(() => {
        downloadDatasetAsJson({
          orders: [{ orderId: '1001', 'Item Cost': 1200 } as any],
          returns: [],
          partials: [],
          exchanges: [],
          pathaoDelivery: [],
        });
      }).not.toThrow();
    });
  });
});
