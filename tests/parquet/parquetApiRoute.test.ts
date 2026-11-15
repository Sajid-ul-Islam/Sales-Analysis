import { describe, it, expect, afterAll } from 'vitest';
import { GET as getPartition, POST as postPartition } from '@/app/api/lakehouse/partition/route';
import { POST as postExport } from '@/app/api/lakehouse/export/route';
import { parseParquetOrders } from '@/lib/parquet/parquetClient';
import { RawOrderRow } from '@/types';
import fs from 'fs';
import path from 'path';

describe('Parquet Lakehouse & Export API Routes', () => {
  const sampleOrders: RawOrderRow[] = [
    {
      'Order ID': '20001',
      'Order Date': '2026-11-12 12:00:00',
      'Customer Name': 'Mahmudul Hasan',
      Phone: '01711223344',
      City: 'Dhaka',
      'Delivery Status': 'Delivered',
      'Courier Status': 'Delivered',
      'Consignment ID': 'C-20001',
      'Item Name': 'Signature Cotton Panjabi',
      SKU: 'SIG-COT-42',
      Category: 'Panjabi',
      Quantity: 1,
      'Item Cost': 2600,
      'Order Amount': 2600,
      'Payment Method': 'cod',
    },
    {
      'Order ID': '20002',
      'Order Date': '2026-11-12 13:00:00',
      'Customer Name': 'Zubair Hossain',
      Phone: '01811223344',
      City: 'Cumilla',
      'Delivery Status': 'Delivered',
      'Courier Status': 'Delivered',
      'Consignment ID': 'C-20002',
      'Item Name': 'Tailored Waistcoat',
      SKU: 'WST-BLK-40',
      Category: 'Waistcoat',
      Quantity: 2,
      'Item Cost': 1800,
      'Order Amount': 3600,
      'Payment Method': 'bKash',
    },
  ];

  it('POST /api/lakehouse/partition writes a monthly partition', async () => {
    const req = new Request('http://localhost:3000/api/lakehouse/partition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-deen-auth-role': 'admin',
      },
      body: JSON.stringify({
        month: '2026-11',
        orders: sampleOrders,
      }),
    });

    const res = await postPartition(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.month).toBe('2026-11');
    expect(json.orderCount).toBe(2);
    expect(json.byteSize).toBeGreaterThan(0);
    expect(json.etag).toContain('W/"');
  });

  it('GET /api/lakehouse/partition serves binary Parquet file with caching headers', async () => {
    const req = new Request('http://localhost:3000/api/lakehouse/partition?month=2026-11', {
      method: 'GET',
      headers: {
        'x-deen-auth-role': 'readonly',
      },
    });

    const res = await getPartition(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/vnd.apache.parquet');
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    const etag = res.headers.get('ETag');
    expect(etag).toBeTruthy();

    const arrayBuffer = await res.arrayBuffer();
    const rows = await parseParquetOrders(arrayBuffer);
    expect(rows).toHaveLength(2);
    expect(rows[0]['Order ID']).toBe('20001');

    // 304 Validation
    const req304 = new Request('http://localhost:3000/api/lakehouse/partition?month=2026-11', {
      method: 'GET',
      headers: {
        'x-deen-auth-role': 'readonly',
        'If-None-Match': etag as string,
      },
    });
    const res304 = await getPartition(req304);
    expect(res304.status).toBe(304);
  });

  it('POST /api/lakehouse/export streams binary Parquet attachment file for direct analyst download', async () => {
    const req = new Request('http://localhost:3000/api/lakehouse/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-deen-auth-role': 'readonly',
      },
      body: JSON.stringify({
        orders: sampleOrders,
        filename: 'deen_custom_export.parquet',
      }),
    });

    const res = await postExport(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/vnd.apache.parquet');
    expect(res.headers.get('Content-Disposition')).toContain('filename="deen_custom_export.parquet"');

    const ab = await res.arrayBuffer();
    const rows = await parseParquetOrders(ab);
    expect(rows).toHaveLength(2);
    expect(rows[1].SKU).toBe('WST-BLK-40');
  });

  afterAll(() => {
    const testPartition = path.join(process.cwd(), 'data', 'lakehouse', 'partitions', 'orders_2026_11.parquet');
    if (fs.existsSync(testPartition)) {
      try { fs.unlinkSync(testPartition); } catch {}
    }
  });
});
