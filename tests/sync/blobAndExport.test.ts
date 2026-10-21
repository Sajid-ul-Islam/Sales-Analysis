import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockBlobPut = vi.fn();
const mockBlobList = vi.fn();
const mockBlobDel = vi.fn();

vi.mock('@vercel/blob', () => ({
  put: (...args: any[]) => mockBlobPut(...args),
  list: (...args: any[]) => mockBlobList(...args),
  del: (...args: any[]) => mockBlobDel(...args),
}));

import { isBlobConfigured, uploadDatasetToBlob, fetchDatasetFromBlob, getBlobStorageStatus } from '@/lib/blobStorage';
import { downloadDatasetAsJson } from '@/lib/datasetExport';
import { compareOrdersByNumber, getExportCustomerName } from '@/lib/excelExport';
import { DatasetSnapshot } from '@/types';

describe('Vercel Blob & Dataset Snapshot Persistence (Methods 1 & 3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockBlobPut.mockReset();
    mockBlobList.mockReset();
    mockBlobDel.mockReset();
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

    it('uploadDatasetToBlob sanitizes PII and uses addRandomSuffix: true when uploading', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test_blob_rw_token_123';
      mockBlobPut.mockResolvedValue({
        pathname: 'deen_dataset_latest-xyz123.json',
        url: 'https://public.blob.vercel-storage.com/deen_dataset_latest-xyz123.json',
        downloadUrl: 'https://public.blob.vercel-storage.com/deen_dataset_latest-xyz123.json',
      });
      mockBlobList.mockResolvedValue({ blobs: [], hasMore: false });

      const unmaskedDataset = {
        orders: [
          {
            orderId: '1001',
            customerName: 'Sajidul Islam',
            phone: '01712345678',
            customerEmail: 'sajid@deencommerce.com',
            address: 'House 5, Road 2, Dhanmondi, Dhaka',
            itemCost: 1500,
          } as any,
        ],
      };

      const result = await uploadDatasetToBlob(unmaskedDataset);
      expect(result.success).toBe(true);
      expect(mockBlobPut).toHaveBeenCalledTimes(1);

      const callArgs = mockBlobPut.mock.calls[0];
      const uploadedString = callArgs[1] as string;
      const uploadedJson = JSON.parse(uploadedString);
      const uploadedOrder = uploadedJson.orders[0];

      expect(uploadedOrder.customerName).toBe('S*** I***');
      expect(uploadedOrder.phone).toBe('0171****678');
      expect(uploadedOrder.customerEmail).toBe('s***d@d***.com');
      expect(uploadedOrder.address).toContain('[REDACTED');

      // Verify addRandomSuffix is true for unguessable filename
      expect(callArgs[2]?.addRandomSuffix).toBe(true);

      delete process.env.BLOB_READ_WRITE_TOKEN;
    });

    it('getBlobStorageStatus omits raw storage URL in response', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'test_blob_rw_token_123';
      mockBlobList.mockResolvedValue({
        blobs: [
          {
            pathname: 'deen_dataset_latest-abc123.json',
            url: 'https://public.blob.vercel-storage.com/deen_dataset_latest-abc123.json',
            size: 10240,
            uploadedAt: new Date(),
          },
        ],
        hasMore: false,
      });

      const status = await getBlobStorageStatus();
      expect(status.configured).toBe(true);
      expect(status.latestBlob).not.toBeNull();
      expect(status.latestBlob?.pathname).toBe('deen_dataset_latest-abc123.json');
      // Must NOT contain url property
      expect((status.latestBlob as any)?.url).toBeUndefined();

      delete process.env.BLOB_READ_WRITE_TOKEN;
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

  describe('Order Export Formatting & Sorting Invariants', () => {
    it('sorts orders naturally by numeric order number including suffixes and prefixes', () => {
      const testOrders = [
        { 'Order ID': '18085' },
        { 'Order ID': '17263' },
        { 'Order ID': '18000' },
        { 'Order ID': '17263 m' },
        { 'Order ID': '17263 c' },
        { 'Order ID': 'D-17250' },
        { 'Order ID': '#18001' },
      ];

      const sorted = [...testOrders].sort(compareOrdersByNumber);
      const sortedIds = sorted.map((o) => o['Order ID']);

      expect(sortedIds).toEqual([
        'D-17250',
        '17263',
        '17263 c',
        '17263 m',
        '18000',
        '#18001',
        '18085',
      ]);
    });

    it('extracts full unmasked customer name even if masked version with asterisks is present', () => {
      // Masked in Customer Name, unmasked in rawCustomerName
      const order1 = {
        'Customer Name': 'T*** P***',
        rawCustomerName: 'Tusher Paul',
      };
      expect(getExportCustomerName(order1)).toBe('Tusher Paul');

      // Unmasked in customerName
      const order2 = {
        customerName: 'Sajidul Islam',
      };
      expect(getExportCustomerName(order2)).toBe('Sajidul Islam');

      // Billing names
      const order3 = {
        billing: { first_name: 'Tanvir', last_name: 'Ahmed' },
      };
      expect(getExportCustomerName(order3)).toBe('Tanvir Ahmed');

      // Fallback
      expect(getExportCustomerName({})).toBe('Customer');
    });

    it('extracts full unmasked 11-digit phone number even if masked version is present', async () => {
      const { getExportPhoneNumber } = await import('@/lib/excelExport');

      // Masked in Phone, but unmasked in rawPhone
      const order1 = {
        Phone: '0178****157',
        rawPhone: '01783650157',
      };
      expect(getExportPhoneNumber(order1)).toBe('01783650157');

      // Masked in Phone, unmasked in formattedPhone with 880 prefix
      const order2 = {
        Phone: '0178****157',
        formattedPhone: '8801783650157',
      };
      expect(getExportPhoneNumber(order2)).toBe('01783650157');

      // Plain clean 11-digit phone
      const order3 = {
        phone: '01812345678',
      };
      expect(getExportPhoneNumber(order3)).toBe('01812345678');
    });
  });
});
