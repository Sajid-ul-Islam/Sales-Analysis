import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockBlobPut = vi.fn();
const mockBlobList = vi.fn();
const mockBlobDel = vi.fn();

vi.mock('@vercel/blob', () => ({
  put: (...args: any[]) => mockBlobPut(...args),
  list: (...args: any[]) => mockBlobList(...args),
  del: (...args: any[]) => mockBlobDel(...args),
}));

import {
  isBlobConfigured,
  uploadDatasetToBlob,
  fetchDatasetFromBlob,
  clearBlobMemoryCache,
} from '@/lib/blobStorage';
import { GET as getSampleData } from '@/app/api/sample-data/route';
import { NextRequest } from 'next/server';
import { setCacheItem } from '@/lib/cacheManager';

describe('Fast Origin Transfer Optimization & Blob Compute Caching', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockBlobPut.mockReset();
    mockBlobList.mockReset();
    mockBlobDel.mockReset();
    clearBlobMemoryCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    clearBlobMemoryCache();
  });

  describe('Multi-Tier Blob Memory Caching in Compute', () => {
    it('serves repeat reads from in-memory cache without repeating origin fetch (0 bytes network transfer)', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test_token';
      const now = new Date();
      mockBlobList.mockResolvedValue({
        blobs: [
          {
            pathname: 'deen_dataset_latest-abc.json',
            url: 'https://public.blob.vercel-storage.com/deen_dataset_latest-abc.json',
            size: 5000,
            uploadedAt: now,
          },
        ],
        hasMore: false,
      });

      const mockDataset = {
        orders: [{ orderId: '101', customerName: 'Sajid', itemCost: 1200 }],
        returns: [],
        partials: [],
        exchanges: [],
        pathaoDelivery: [],
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDataset,
      });
      global.fetch = fetchSpy as any;

      // First call: Cold cache -> performs list & fetch
      const res1 = await fetchDatasetFromBlob();
      expect(res1.success).toBe(true);
      expect(res1.isFromCache).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second call: Warm memory cache -> 0 network fetches, 0 list calls
      mockBlobList.mockClear();
      fetchSpy.mockClear();

      const res2 = await fetchDatasetFromBlob();
      expect(res2.success).toBe(true);
      expect(res2.isFromCache).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(0);
      expect(mockBlobList).toHaveBeenCalledTimes(0);
      expect(res2.dataset?.orders?.length).toBe(1);
    });

    it('uploadDatasetToBlob automatically trims empty properties and populates compute memory cache', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test_token';
      mockBlobPut.mockResolvedValue({
        pathname: 'deen_dataset_latest-def.json',
        url: 'https://public.blob.vercel-storage.com/deen_dataset_latest-def.json',
      });
      mockBlobList.mockResolvedValue({ blobs: [], hasMore: false });

      const datasetWithBloat = {
        orders: [
          {
            orderId: '201',
            customerName: 'Rahim Khan',
            phone: '01812345678',
            emptyField: '',
            nullField: null,
            undefinedField: undefined,
          } as any,
        ],
        returns: [],
      };

      const uploadResult = await uploadDatasetToBlob(datasetWithBloat);
      expect(uploadResult.success).toBe(true);
      expect(mockBlobPut).toHaveBeenCalledTimes(1);

      // Inspect serialized payload: empty/null fields must be stripped
      const serializedJson = JSON.parse(mockBlobPut.mock.calls[0][1]);
      const savedOrder = serializedJson.orders[0];
      expect(savedOrder.emptyField).toBeUndefined();
      expect(savedOrder.nullField).toBeUndefined();
      expect(savedOrder.undefinedField).toBeUndefined();
      expect(savedOrder.orderId).toBe('201');

      // Subsequent read must immediately return the uploaded dataset from warm memory without list or fetch
      const readResult = await fetchDatasetFromBlob();
      expect(readResult.success).toBe(true);
      expect(readResult.isFromCache).toBe(true);
      expect(readResult.dataset?.orders?.[0]?.orderId).toBe('201');
    });

    it('clearBlobMemoryCache successfully purges compute memory cache', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test_token';
      mockBlobPut.mockResolvedValue({
        pathname: 'deen_dataset_latest-xyz.json',
        url: 'https://public.blob.vercel-storage.com/deen_dataset_latest-xyz.json',
      });
      mockBlobList.mockResolvedValue({ blobs: [], hasMore: false });

      await uploadDatasetToBlob({ orders: [{ orderId: '301' } as any] });
      const before = await fetchDatasetFromBlob();
      expect(before.isFromCache).toBe(true);

      clearBlobMemoryCache();

      // After clearing, next read will query list again
      mockBlobList.mockResolvedValue({
        blobs: [
          {
            pathname: 'deen_dataset_latest-xyz.json',
            url: 'https://public.blob.vercel-storage.com/deen_dataset_latest-xyz.json',
            size: 100,
            uploadedAt: new Date(),
          },
        ],
      });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ orders: [{ orderId: '301' }] }),
      }) as any;

      const after = await fetchDatasetFromBlob();
      expect(after.isFromCache).toBe(false);
    });
  });

  describe('Sample Data Route ETag & 304 Validation', () => {
    it('returns HTTP 304 Not Modified when client sends matching If-None-Match ETag', async () => {
      // First call to generate the payload and obtain the ETag
      const req1 = new NextRequest('http://localhost:3000/api/sample-data');
      const res1 = await getSampleData(req1);
      expect(res1.status).toBe(200);

      const etag = res1.headers.get('ETag');
      expect(etag).toBeTruthy();
      expect(etag?.startsWith('W/"')).toBe(true);

      // Second call with If-None-Match header matching the ETag
      const req2 = new NextRequest('http://localhost:3000/api/sample-data', {
        headers: { 'if-none-match': etag! },
      });
      const res2 = await getSampleData(req2);

      // Must be 304 Not Modified with zero content
      expect(res2.status).toBe(304);
      expect(res2.headers.get('ETag')).toBe(etag);
      expect(res2.headers.get('Cache-Control')).toContain('s-maxage=3600');
    });
  });

  describe('CacheManager Quota Protection', () => {
    it('persists datasets larger than 1MB directly to IndexedDB without polluting LocalStorage', () => {
      const mockSetItem = vi.fn();
      const originalWindow = (global as any).window;
      const originalLocalStorage = (global as any).localStorage;

      (global as any).window = {};
      (global as any).localStorage = {
        setItem: mockSetItem,
        getItem: vi.fn(),
        removeItem: vi.fn(),
      };

      try {
        const mockLargeData = {
          orders: Array.from({ length: 5000 }, (_, i) => ({
            orderId: `ORDER-${i}`,
            description: 'Large order details to exceed 1MB threshold '.repeat(10),
          })),
        };

        const result = setCacheItem('deen_test_large_key', mockLargeData);
        expect(result).toBe(true);
        // LocalStorage.setItem must NOT be called for >1MB items to avoid quota blowout
        expect(mockSetItem).not.toHaveBeenCalled();
      } finally {
        (global as any).window = originalWindow;
        (global as any).localStorage = originalLocalStorage;
      }
    });
  });
});
