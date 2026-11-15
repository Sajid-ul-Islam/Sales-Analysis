import { RawOrderRow } from '@/types';
import { getRowOrderId } from '@/lib/sync/partitionStore';
import { getDhakaIsoDate, getDhakaTodayIso } from '@/lib/timezone';
import { detectFulfillmentBranch } from '@/lib/fulfillmentUtils';
import { isOrderOnline } from '@/lib/liveOpsProcessor';

/**
 * Canonical Parquet Column Definitions for DEEN Commerce Orders.
 * Compatible with parquetjs-lite schema specification.
 */
export const DEEN_ORDER_PARQUET_FIELDS = {
  orderId: { type: 'UTF8' },
  orderNumber: { type: 'UTF8', optional: true },
  invoiceNo: { type: 'UTF8', optional: true },
  orderDate: { type: 'UTF8' },
  orderYearMonth: { type: 'UTF8' }, // 'YYYY-MM'
  customerName: { type: 'UTF8', optional: true },
  phone: { type: 'UTF8', optional: true },
  city: { type: 'UTF8', optional: true },
  deliveryStatus: { type: 'UTF8', optional: true },
  courierStatus: { type: 'UTF8', optional: true },
  consignmentId: { type: 'UTF8', optional: true },
  itemName: { type: 'UTF8', optional: true },
  sku: { type: 'UTF8', optional: true },
  category: { type: 'UTF8', optional: true },
  quantity: { type: 'INT32' },
  itemCost: { type: 'DOUBLE' },
  orderAmount: { type: 'DOUBLE' },
  paymentMethod: { type: 'UTF8', optional: true },
  orderSource: { type: 'UTF8', optional: true },
  outletId: { type: 'UTF8', optional: true },
  branchCode: { type: 'UTF8', optional: true },
  isPos: { type: 'BOOLEAN', optional: true },
  isOrderOnline: { type: 'BOOLEAN', optional: true },
  isSplitBranch: { type: 'BOOLEAN', optional: true },
} as const;

export type ParquetFieldKey = keyof typeof DEEN_ORDER_PARQUET_FIELDS;

export const DEEN_ORDER_PARQUET_COLUMNS: ParquetFieldKey[] = [
  'orderId',
  'orderNumber',
  'invoiceNo',
  'orderDate',
  'orderYearMonth',
  'customerName',
  'phone',
  'city',
  'deliveryStatus',
  'courierStatus',
  'consignmentId',
  'itemName',
  'sku',
  'category',
  'quantity',
  'itemCost',
  'orderAmount',
  'paymentMethod',
  'orderSource',
  'outletId',
  'branchCode',
  'isPos',
  'isOrderOnline',
  'isSplitBranch',
];

export interface ParquetOrderRecord {
  orderId: string;
  orderNumber: string;
  invoiceNo: string;
  orderDate: string;
  orderYearMonth: string;
  customerName: string;
  phone: string;
  city: string;
  deliveryStatus: string;
  courierStatus: string;
  consignmentId: string;
  itemName: string;
  sku: string;
  category: string;
  quantity: number;
  itemCost: number;
  orderAmount: number;
  paymentMethod: string;
  orderSource: string;
  outletId: string;
  branchCode: string;
  isPos: boolean;
  isOrderOnline: boolean;
  isSplitBranch: boolean;
}

/**
 * Extracts YYYY-MM strictly in Asia/Dhaka time (+06:00) from order date.
 */
function extractYearMonthFromDate(dateVal: unknown): string {
  if (!dateVal) return getDhakaTodayIso().slice(0, 7);
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    return getDhakaIsoDate(dateVal).slice(0, 7);
  }
  const str = String(dateVal).trim();
  const match = str.match(/^(\d{4})[-/.](\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    return `${y}-${m}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return getDhakaIsoDate(parsed).slice(0, 7);
  }
  return getDhakaTodayIso().slice(0, 7);
}

/**
 * Normalizes a raw order row into a clean, strictly typed Parquet record.
 */
export function orderRowToParquetRecord(row: RawOrderRow): ParquetOrderRecord {
  const rowRec = row as Record<string, unknown>;
  const orderId = String(getRowOrderId(row) || rowRec.orderId || rowRec['Order ID'] || rowRec.id || '').trim();
  
  const rawDate = rowRec['Order Date'] || rowRec.orderDate || rowRec.date_created || rowRec.date || '';
  const orderDate = String(rawDate || '').trim();
  const orderYearMonth = extractYearMonthFromDate(rawDate);

  const customerName = String(
    rowRec['Customer Name'] || rowRec.customerName || rowRec.customer_name || rowRec.name || 'Customer'
  ).trim();
  const phone = String(rowRec.Phone || rowRec.phone || rowRec.billing_phone || '').trim();
  const city = String(rowRec.City || rowRec.city || rowRec.billing_city || 'Dhaka').trim();
  
  const deliveryStatus = String(
    rowRec['Delivery Status'] || rowRec.deliveryStatus || rowRec.status || rowRec.wcStatus || 'Delivered'
  ).trim();
  const courierStatus = String(
    rowRec['Courier Status'] || rowRec.courierStatus || rowRec.pathaoStatus || 'Untracked'
  ).trim();
  const consignmentId = String(
    rowRec['Consignment ID'] || rowRec.consignmentId || rowRec.tracking_number || ''
  ).trim();
  
  const itemName = String(
    rowRec['Item Name'] || rowRec.itemName || rowRec.item_name || rowRec.name || 'Apparel Item'
  ).trim();
  const sku = String(rowRec.SKU || rowRec.sku || '').trim();
  const category = String(rowRec.Category || rowRec.category || 'Panjabi').trim();
  
  // Mathematical Invariant: Integer Quantity rule (1, 2, 3...)
  const rawQty = Number(rowRec.Quantity ?? rowRec.quantity ?? rowRec.qty ?? (rowRec as any).itemQuantity ?? 1);
  const quantity = Math.max(1, Math.round(isNaN(rawQty) ? 1 : rawQty));

  const rawCost = Number(rowRec['Item Cost'] ?? rowRec.itemCost ?? rowRec.price ?? rowRec.item_cost ?? (rowRec as any).itemPrice ?? 0);
  const itemCost = isNaN(rawCost) ? 0 : rawCost;

  const rawAmt = Number(rowRec['Order Amount'] ?? rowRec.orderAmount ?? rowRec.amount ?? rowRec.total ?? (rowRec as any).orderTotal ?? (rowRec as any).lineTotal ?? 0);
  const orderAmount = isNaN(rawAmt) ? (itemCost > 0 ? itemCost * quantity : 0) : rawAmt;

  const paymentMethod = String(
    rowRec['Payment Method'] || rowRec.paymentMethod || rowRec.payment_method || 'cod'
  ).trim();
  const orderSource = String(rowRec['Order Source'] || rowRec.orderSource || 'Online').trim();
  const outletId = String(rowRec['Outlet ID'] || rowRec.outletId || rowRec.sipOutletId || '').trim();

  // Branch & Fulfillment classification
  const branchInfo = detectFulfillmentBranch(row);
  const branchCode = String(rowRec.branchCode || branchInfo.branchCode || 'ONLINE').trim();
  const isPos = Boolean(rowRec.isPos !== undefined ? rowRec.isPos : (!isOrderOnline(row) && branchCode !== 'ONLINE'));
  const isOnline = Boolean(rowRec.isOrderOnline !== undefined ? rowRec.isOrderOnline : isOrderOnline(row));
  const isSplitBranch = Boolean(rowRec.isSplitBranch !== undefined ? rowRec.isSplitBranch : branchInfo.isBranchFulfillment);

  return {
    orderId,
    orderNumber: String(rowRec.orderNumber || orderId),
    invoiceNo: String(rowRec.invoiceNo || rowRec.invoice || orderId),
    orderDate,
    orderYearMonth,
    customerName,
    phone,
    city,
    deliveryStatus,
    courierStatus,
    consignmentId,
    itemName,
    sku,
    category,
    quantity,
    itemCost,
    orderAmount,
    paymentMethod,
    orderSource,
    outletId,
    branchCode,
    isPos,
    isOrderOnline: isOnline,
    isSplitBranch,
  };
}

/**
 * Converts a Parquet record back to a fully compatible RawOrderRow.
 */
export function parquetRecordToOrderRow(record: ParquetOrderRecord): RawOrderRow {
  return {
    'Order ID': record.orderId,
    orderId: record.orderId,
    id: record.orderId,
    orderNumber: record.orderNumber,
    invoiceNo: record.invoiceNo,
    'Order Date': record.orderDate,
    orderDate: record.orderDate,
    orderYearMonth: record.orderYearMonth,
    'Customer Name': record.customerName,
    customerName: record.customerName,
    Phone: record.phone,
    phone: record.phone,
    City: record.city,
    city: record.city,
    'Delivery Status': record.deliveryStatus,
    deliveryStatus: record.deliveryStatus,
    'Courier Status': record.courierStatus,
    courierStatus: record.courierStatus,
    'Consignment ID': record.consignmentId,
    consignmentId: record.consignmentId,
    'Item Name': record.itemName,
    itemName: record.itemName,
    SKU: record.sku,
    sku: record.sku,
    Category: record.category,
    category: record.category,
    Quantity: record.quantity,
    quantity: record.quantity,
    qty: record.quantity,
    'Item Cost': record.itemCost,
    itemCost: record.itemCost,
    'Order Amount': record.orderAmount,
    orderAmount: record.orderAmount,
    total: record.orderAmount,
    'Payment Method': record.paymentMethod,
    paymentMethod: record.paymentMethod,
    'Order Source': record.orderSource,
    orderSource: record.orderSource,
    'Outlet ID': record.outletId,
    outletId: record.outletId,
    branchCode: record.branchCode,
    isPos: record.isPos,
    isOrderOnline: record.isOrderOnline,
    isSplitBranch: record.isSplitBranch,
  };
}
