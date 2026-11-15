import { describe, it, expect, afterAll } from 'vitest';
import {
  ordersToParquetBuffer,
  writeParquetPartitionFile,
  readParquetPartitionFile,
  getParquetPartitionStats,
} from '@/lib/server/parquetWriter';
import { RawOrderRow } from '@/types';
import fs from 'fs';
import path from 'path';

describe('Server-Side Parquet Writer & Partition Lakehouse', () => {
  const sampleOrders: RawOrderRow[] = [
    {
      'Order ID': '18301',
      'Order Date': '2026-11-01 10:00:00',
      'Customer Name': 'Tanvir Hasan',
      Phone: '01700112233',
      City: 'Dhaka',
      'Delivery Status': 'Delivered',
      'Courier Status': 'Delivered',
      'Consignment ID': 'C-101',
      'Item Name': 'Classic White Panjabi',
      SKU: 'PAN-WHT-40',
      Category: 'Panjabi',
      Quantity: 1,
      'Item Cost': 1850,
      'Order Amount': 1850,
      'Payment Method': 'cod',
    },
    {
      'Order ID': '18302',
      'Order Date': '2026-11-02 11:30:00',
      'Customer Name': 'Ashiqur Rahman',
      Phone: '01800223344',
      City: 'Sylhet',
      'Delivery Status': 'Return',
      'Courier Status': 'Returned',
      'Consignment ID': 'C-102',
      'Item Name': 'Midnight Blue Kabli',
      SKU: 'KAB-BLU-42',
      Category: 'Kabli',
      Quantity: 2,
      'Item Cost': 2950,
      'Order Amount': 5900,
      'Payment Method': 'bKash',
    },
  ];

  it('converts an array of RawOrderRow into a compressed Parquet Buffer', async () => {
    const buf = await ordersToParquetBuffer(sampleOrders);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
    // Parquet file starts with magic bytes PAR1
    const magic = buf.subarray(0, 4).toString('ascii');
    expect(magic).toBe('PAR1');
  });

  it('writes and atomically saves a monthly partition file to data/lakehouse/partitions', async () => {
    const res = await writeParquetPartitionFile('2026-11', sampleOrders);
    expect(res.orderCount).toBe(2);
    expect(res.byteSize).toBeGreaterThan(0);
    expect(fs.existsSync(res.filePath)).toBe(true);

    const readBuf = await readParquetPartitionFile('2026-11');
    expect(readBuf).not.toBeNull();
    expect(readBuf?.subarray(0, 4).toString('ascii')).toBe('PAR1');

    const stats = await getParquetPartitionStats('2026-11');
    expect(stats?.exists).toBe(true);
    expect(stats?.etag).toContain('W/"');
  });

  it('handles empty order arrays without crashing, writing a valid empty Parquet file', async () => {
    const buf = await ordersToParquetBuffer([]);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.subarray(0, 4).toString('ascii')).toBe('PAR1');
  });

  afterAll(() => {
    // Cleanup generated test partition if desired
    const testPartition = path.join(process.cwd(), 'data', 'lakehouse', 'partitions', 'orders_2026_11.parquet');
    if (fs.existsSync(testPartition)) {
      try { fs.unlinkSync(testPartition); } catch {}
    }
  });
});
