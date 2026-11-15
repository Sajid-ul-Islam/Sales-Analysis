import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveParquetPartitionBlob,
  loadParquetPartitionBlob,
  loadPartition,
  savePartition,
  PARQUET_PARTITION_PREFIX,
} from '@/lib/sync/partitionStore';
import { ordersToParquetBuffer } from '@/lib/server/parquetWriter';
import { RawOrderRow } from '@/types';

describe('Binary IndexedDB Lakehouse Partition Store', () => {
  const sampleOrders: RawOrderRow[] = [
    {
      'Order ID': '21001',
      'Order Date': '2026-10-15',
      'Customer Name': 'Tareq Rahman',
      Phone: '01711002233',
      City: 'Dhaka',
      'Delivery Status': 'Delivered',
      'Courier Status': 'Delivered',
      'Consignment ID': 'C-21001',
      'Item Name': 'Semi-Drop Panjabi',
      SKU: 'PAN-SDP-40',
      Category: 'Panjabi',
      Quantity: 2,
      'Item Cost': 2100,
      'Order Amount': 4200,
      'Payment Method': 'cod',
    },
  ];

  it('saves and loads binary Parquet partition blob in IndexedDB/cache', async () => {
    const nodeBuf = await ordersToParquetBuffer(sampleOrders);
    const arrayBuffer = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength) as ArrayBuffer;

    await saveParquetPartitionBlob('2026-10', arrayBuffer, {
      orderCount: 1,
      rowCount: 1,
    });

    const loadedBlob = await loadParquetPartitionBlob('2026-10');
    expect(loadedBlob).not.toBeNull();
    expect(loadedBlob?.byteLength).toBe(arrayBuffer.byteLength);

    // loadPartition should prioritize Parquet binary partition over JSON
    const partition = await loadPartition('2026-10');
    expect(partition).not.toBeNull();
    expect(partition?.rows).toHaveLength(1);
    expect(partition?.rows[0]['Order ID']).toBe('21001');
    expect(partition?.rows[0].Quantity).toBe(2);
  });

  it('falls back to JSON partition store when Parquet partition is absent', async () => {
    // Save normal JSON partition for 2026-09
    await savePartition('2026-09', sampleOrders);

    const partition = await loadPartition('2026-09');
    expect(partition).not.toBeNull();
    expect(partition?.rows).toHaveLength(1);
    expect(partition?.rows[0]['Order ID']).toBe('21001');
  });
});
