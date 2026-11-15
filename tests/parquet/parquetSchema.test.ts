import { describe, it, expect } from 'vitest';
import {
  DEEN_ORDER_PARQUET_FIELDS,
  DEEN_ORDER_PARQUET_COLUMNS,
  orderRowToParquetRecord,
  parquetRecordToOrderRow,
  ParquetOrderRecord,
} from '@/lib/parquet/parquetSchema';
import { RawOrderRow } from '@/types';

describe('Parquet Schema & Normalizer Engine', () => {
  it('exports deterministic column names in ordered array', () => {
    expect(DEEN_ORDER_PARQUET_COLUMNS).toBeInstanceOf(Array);
    expect(DEEN_ORDER_PARQUET_COLUMNS.length).toBeGreaterThanOrEqual(20);
    expect(DEEN_ORDER_PARQUET_COLUMNS).toContain('orderId');
    expect(DEEN_ORDER_PARQUET_COLUMNS).toContain('orderDate');
    expect(DEEN_ORDER_PARQUET_COLUMNS).toContain('quantity');
    expect(DEEN_ORDER_PARQUET_COLUMNS).toContain('itemCost');
    expect(DEEN_ORDER_PARQUET_COLUMNS).toContain('orderAmount');
  });

  it('normalizes a standard WooCommerce order row into a clean Parquet record', () => {
    const rawOrder: RawOrderRow = {
      'Order ID': '18205',
      'Order Date': '2026-11-14 14:32:00',
      'Customer Name': 'Samiul Haque',
      Phone: '01712345678',
      City: 'Dhaka',
      'Delivery Status': 'Delivered',
      'Courier Status': 'Delivered',
      'Consignment ID': 'CID-99238',
      'Item Name': 'Imperial Silk Panjabi',
      SKU: 'DN-PAN-01-L',
      Category: 'Panjabi',
      Quantity: '2',
      'Item Cost': '2450.00',
      'Order Amount': '4900.00',
      'Payment Method': 'cod',
      'Order Source': 'Online',
      'Outlet ID': '',
      branchCode: 'ONLINE',
      isPos: false,
      isOrderOnline: true,
    };

    const record = orderRowToParquetRecord(rawOrder);
    expect(record.orderId).toBe('18205');
    expect(record.customerName).toBe('Samiul Haque');
    expect(record.phone).toBe('01712345678');
    expect(record.city).toBe('Dhaka');
    expect(record.sku).toBe('DN-PAN-01-L');
    expect(record.itemName).toBe('Imperial Silk Panjabi');
    expect(record.quantity).toBe(2);
    expect(Number.isInteger(record.quantity)).toBe(true);
    expect(record.itemCost).toBe(2450);
    expect(record.orderAmount).toBe(4900);
    expect(record.isPos).toBe(false);
    expect(record.isOrderOnline).toBe(true);
    expect(record.orderYearMonth).toBe('2026-11');
  });

  it('enforces strict integer quantity rule and handles missing/empty values gracefully', () => {
    const rawWithMissing: RawOrderRow = {
      orderId: '18206 c',
      Quantity: 1.7, // Invalid fractional quantity
      'Item Cost': undefined,
      orderAmount: null,
    };

    const record = orderRowToParquetRecord(rawWithMissing);
    expect(record.orderId).toBe('18206 c');
    // Fractional quantity must be coerced to integer
    expect(record.quantity).toBe(2);
    expect(Number.isInteger(record.quantity)).toBe(true);
    expect(record.itemCost).toBe(0);
    expect(record.orderAmount).toBe(0);
    expect(record.customerName).toBe('Customer');
    expect(record.branchCode).toBe('CUMILLA'); // detected from 'c' suffix
  });

  it('bidirectionally converts Parquet record back to RawOrderRow with full field fidelity', () => {
    const record: ParquetOrderRecord = {
      orderId: '17890',
      orderNumber: '17890',
      invoiceNo: 'INV-17890',
      orderDate: '2026-10-25',
      orderYearMonth: '2026-10',
      customerName: 'Rahim Khan',
      phone: '01899998888',
      city: 'Chittagong',
      deliveryStatus: 'Return',
      courierStatus: 'Returned',
      consignmentId: 'CID-555',
      itemName: 'Royal Kabli Set',
      sku: 'KAB-SET-M',
      category: 'Kabli',
      quantity: 1,
      itemCost: 3200,
      orderAmount: 3200,
      paymentMethod: 'bKash',
      orderSource: 'Online',
      outletId: '',
      branchCode: 'ONLINE',
      isPos: false,
      isOrderOnline: true,
      isSplitBranch: false,
    };

    const row = parquetRecordToOrderRow(record);
    expect(row['Order ID']).toBe('17890');
    expect(row.orderId).toBe('17890');
    expect(row['Item Name']).toBe('Royal Kabli Set');
    expect(row.SKU).toBe('KAB-SET-M');
    expect(row.Quantity).toBe(1);
    expect(row['Item Cost']).toBe(3200);
    expect(row['Order Amount']).toBe(3200);
    expect(row.City).toBe('Chittagong');
  });
});
