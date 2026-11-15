import { parquetReadObjects, parquetMetadata } from 'hyparquet';
import { compressors, decompressSnappy } from 'hyparquet-compressors';
import { RawOrderRow } from '@/types';
import {
  ParquetOrderRecord,
  parquetRecordToOrderRow,
  ParquetFieldKey,
} from '@/lib/parquet/parquetSchema';

export interface ParseParquetOptions {
  columns?: string[];
  rowLimit?: number;
}

export interface ParquetBufferMetadata {
  rowCount: number;
  columns: string[];
}

/**
 * Ensures an ArrayBuffer is safely sliced from any Uint8Array, Buffer, or ArrayBuffer.
 */
function toArrayBuffer(input: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (input instanceof ArrayBuffer) {
    return input;
  }
  return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
}

/**
 * Parses binary Parquet data into standard RawOrderRow[] records using hyparquet.
 * Supports column projection pushdown to read only requested columns in sub-milliseconds.
 */
export async function parseParquetOrders(
  fileData: ArrayBuffer | Uint8Array,
  options?: ParseParquetOptions
): Promise<RawOrderRow[]> {
  const arrayBuffer = toArrayBuffer(fileData);

  const rawObjects = await parquetReadObjects({
    file: arrayBuffer,
    columns: options?.columns,
    compressors: {
      SNAPPY: decompressSnappy,
      ...compressors,
    },
  });

  const isProjected = Array.isArray(options?.columns) && options.columns.length > 0;
  const rows: RawOrderRow[] = [];

  for (let i = 0; i < rawObjects.length; i++) {
    if (options?.rowLimit && i >= options.rowLimit) break;
    const obj = rawObjects[i] as Record<string, unknown>;

    if (isProjected) {
      // Map projected fields into both camelCase and legacy display names for tab compatibility
      const row: RawOrderRow = { ...obj };
      if (obj.orderId !== undefined) {
        row['Order ID'] = String(obj.orderId);
        row.orderId = String(obj.orderId);
      }
      if (obj.orderDate !== undefined) {
        row['Order Date'] = String(obj.orderDate);
        row.orderDate = String(obj.orderDate);
      }
      if (obj.customerName !== undefined) {
        row['Customer Name'] = String(obj.customerName);
        row.customerName = String(obj.customerName);
      }
      if (obj.phone !== undefined) {
        row.Phone = String(obj.phone);
        row.phone = String(obj.phone);
      }
      if (obj.city !== undefined) {
        row.City = String(obj.city);
        row.city = String(obj.city);
      }
      if (obj.deliveryStatus !== undefined) {
        row['Delivery Status'] = String(obj.deliveryStatus);
        row.deliveryStatus = String(obj.deliveryStatus);
      }
      if (obj.courierStatus !== undefined) {
        row['Courier Status'] = String(obj.courierStatus);
        row.courierStatus = String(obj.courierStatus);
      }
      if (obj.consignmentId !== undefined) {
        row['Consignment ID'] = String(obj.consignmentId);
        row.consignmentId = String(obj.consignmentId);
      }
      if (obj.itemName !== undefined) {
        row['Item Name'] = String(obj.itemName);
        row.itemName = String(obj.itemName);
      }
      if (obj.sku !== undefined) {
        row.SKU = String(obj.sku);
        row.sku = String(obj.sku);
      }
      if (obj.category !== undefined) {
        row.Category = String(obj.category);
        row.category = String(obj.category);
      }
      if (obj.quantity !== undefined) {
        const q = Math.max(1, Math.round(Number(obj.quantity) || 1));
        row.Quantity = q;
        row.quantity = q;
        row.qty = q;
      }
      if (obj.itemCost !== undefined) {
        const c = Number(obj.itemCost) || 0;
        row['Item Cost'] = c;
        row.itemCost = c;
      }
      if (obj.orderAmount !== undefined) {
        const a = Number(obj.orderAmount) || 0;
        row['Order Amount'] = a;
        row.orderAmount = a;
        row.total = a;
      }
      if (obj.paymentMethod !== undefined) {
        row['Payment Method'] = String(obj.paymentMethod);
        row.paymentMethod = String(obj.paymentMethod);
      }
      rows.push(row);
    } else {
      const fullRecord = obj as unknown as ParquetOrderRecord;
      rows.push(parquetRecordToOrderRow(fullRecord));
    }
  }

  return rows;
}

/**
 * Inspects binary Parquet buffer metadata and schema without reading full rows.
 */
export function getParquetBufferMetadata(fileData: ArrayBuffer | Uint8Array): ParquetBufferMetadata {
  const arrayBuffer = toArrayBuffer(fileData);
  const meta = parquetMetadata(arrayBuffer);
  const rowCount = typeof meta.num_rows === 'bigint' ? Number(meta.num_rows) : Number(meta.num_rows || 0);
  const columns = (meta.schema || [])
    .filter((s) => s.name && s.name !== 'root')
    .map((s) => s.name as ParquetFieldKey);

  return {
    rowCount,
    columns,
  };
}
