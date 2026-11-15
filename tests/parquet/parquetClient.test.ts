import { describe, it, expect } from 'vitest';
import { parseParquetOrders, getParquetBufferMetadata } from '@/lib/parquet/parquetClient';
import { ordersToParquetBuffer } from '@/lib/server/parquetWriter';
import { RawOrderRow } from '@/types';

describe('Client-Side Parquet Ingestion (hyparquet)', () => {
  const sampleOrders: RawOrderRow[] = [
    {
      'Order ID': '19001',
      'Order Date': '2026-11-10 16:20:00',
      'Customer Name': 'Farhan Ahmed',
      Phone: '01911223344',
      City: 'Dhaka',
      'Delivery Status': 'Delivered',
      'Courier Status': 'Delivered',
      'Consignment ID': 'CID-771',
      'Item Name': 'Semi-Drop Panjabi',
      SKU: 'PAN-SDP-44',
      Category: 'Panjabi',
      Quantity: 3,
      'Item Cost': 2100,
      'Order Amount': 6300,
      'Payment Method': 'cod',
      isPos: false,
      isOrderOnline: true,
    },
    {
      'Order ID': '19002',
      'Order Date': '2026-11-10 17:00:00',
      'Customer Name': 'Nayeem Hasan',
      Phone: '01655667788',
      City: 'Chittagong',
      'Delivery Status': 'Paid Return',
      'Courier Status': 'Returned',
      'Consignment ID': 'CID-772',
      'Item Name': 'Tailored Cotton Pajama',
      SKU: 'PAJ-COT-L',
      Category: 'Pajama',
      Quantity: 1,
      'Item Cost': 950,
      'Order Amount': 950,
      'Payment Method': 'bKash',
      isPos: false,
      isOrderOnline: true,
    },
  ];

  it('reads binary Parquet buffer and maps into standard RawOrderRow[] using hyparquet', async () => {
    const nodeBuf = await ordersToParquetBuffer(sampleOrders);
    const arrayBuffer = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength) as ArrayBuffer;

    const parsedRows = await parseParquetOrders(arrayBuffer);
    expect(parsedRows).toHaveLength(2);

    const first = parsedRows[0];
    expect(first['Order ID']).toBe('19001');
    expect(first.orderId).toBe('19001');
    expect(first['Customer Name']).toBe('Farhan Ahmed');
    expect(first.City).toBe('Dhaka');
    expect(first.Quantity).toBe(3);
    expect(Number.isInteger(first.Quantity)).toBe(true);
    expect(first['Item Cost']).toBe(2100);
    expect(first['Order Amount']).toBe(6300);
    expect(first['Item Name']).toBe('Semi-Drop Panjabi');
    expect(first.SKU).toBe('PAN-SDP-44');

    const second = parsedRows[1];
    expect(second['Order ID']).toBe('19002');
    expect(second['Delivery Status']).toBe('Paid Return');
    expect(second.Quantity).toBe(1);
  });

  it('supports column projection pushdown to extract only specific columns', async () => {
    const nodeBuf = await ordersToParquetBuffer(sampleOrders);
    const arrayBuffer = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength) as ArrayBuffer;

    const projected = await parseParquetOrders(arrayBuffer, {
      columns: ['orderId', 'orderAmount', 'quantity'],
    });
    expect(projected).toHaveLength(2);
    expect(projected[0]['Order ID']).toBe('19001');
    expect(projected[0]['Order Amount']).toBe(6300);
    expect(projected[0].Quantity).toBe(3);
  });

  it('extracts metadata including row count and schema columns', async () => {
    const nodeBuf = await ordersToParquetBuffer(sampleOrders);
    const arrayBuffer = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength) as ArrayBuffer;

    const meta = getParquetBufferMetadata(arrayBuffer);
    expect(meta.rowCount).toBe(2);
    expect(meta.columns).toContain('orderId');
    expect(meta.columns).toContain('orderDate');
    expect(meta.columns).toContain('quantity');
  });
});
