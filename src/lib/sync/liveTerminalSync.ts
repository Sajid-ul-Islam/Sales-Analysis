import { RawOrderRow, DatasetSnapshot } from '@/types';
import { fetchWooCommerceOrders, formatWooCommerceToOrderRows, testWooCommerceConnection, WcCredentials, cleanCustomerPhone, isOnlinePaymentMethod, isEcomPaymentMethod } from '@/lib/woocommerceClient';
import { batchFetchPathaoOrders, batchFetchPathaoOrdersByOrderIds, fetchRecentPathaoOrders, getPathaoToken, PathaoCredentials, PathaoOrderDetail } from '@/lib/pathaoClient';
import { getSecretsWithOverrides } from '@/lib/secrets';
import { createDataProvenance, DataProvenanceInfo } from '@/lib/dataAudit';
import { buildTimelineIndex, extractCustomerBilling, classifyCustomer } from '@/lib/customerRegistry';
import { fetchDatasetFromBlob, isBlobConfigured } from '@/lib/blobStorage';
import { getLiveWebhookUpdates, PathaoWebhookRecord } from '@/lib/pathaoWebhookEngine';
import baselineData from '@/data/baselineSample.json';

export type StandardCourierStatus =
  | 'Delivered'
  | 'In Transit'
  | 'Returned'
  | 'Partial'
  | 'Pending Pickup'
  | 'Untracked';

export type CourierDiscrepancyType =
  | 'RETURNED_BUT_SHIPPED'
  | 'DELIVERED_BUT_PROCESSING'
  | 'COD_MISMATCH'
  | 'UNCOLLECTED_COD'
  | 'DOUBLE_COLLECTION_RISK'
  | 'NONE';

export type BranchFulfillmentCode = 'ONLINE' | 'MIRPUR' | 'CUMILLA' | 'WARI' | 'SYLHET' | 'EXCHANGE';

export interface FulfillmentBranchInfo {
  branchName: string;
  branchCode: BranchFulfillmentCode;
  isBranchFulfillment: boolean;
  baseOrderId: string;
}

export interface CourierTrackingInfo {
  consignmentId: string;
  orderId: string;
  baseOrderId?: string;
  courierStatus: StandardCourierStatus;
  rawStatus: string;
  collectedAmount: number;
  deliveryFee: number;
  codFee: number;
  recipientName: string;
  recipientPhone: string;
  recipientCity: string;
  updatedAt?: string;
  hasDiscrepancy: boolean;
  discrepancyType: CourierDiscrepancyType;
  discrepancyMessage?: string;
  fulfillmentBranch?: string;
  isBranchFulfillment?: boolean;
}

export interface LiveTerminalStats {
  totalOrders: number;
  totalLineItems: number;
  handedOverCount: number;
  handedOverRate: number; // e.g. 92.5
  inTransitCount: number;
  deliveredCount: number;
  returnedCount: number;
  pendingPickupCount: number;
  untrackedCount: number;
  discrepancyCount: number;
  totalCodCollected: number;
  branchOrderCount?: number;
  exchangeOrderCount?: number;
}

export interface DiscrepancyAlert {
  orderId: string;
  wcStatus: string;
  courierStatus: StandardCourierStatus;
  type: CourierDiscrepancyType;
  message: string;
  consignmentId?: string;
  fulfillmentBranch?: string;
}

export interface LiveTerminalSyncResult {
  success: boolean;
  message: string;
  orders: RawOrderRow[];
  courierTrackingMap: Record<string, CourierTrackingInfo>;
  stats: LiveTerminalStats;
  discrepancies: DiscrepancyAlert[];
  wcConnected: boolean;
  pathaoConnected: boolean;
  syncTimestamp: string;
  provenance: DataProvenanceInfo;
}

/**
 * Normalizes varied Pathao status strings into 6 standard operational courier categories.
 */
export function normalizeCourierStatus(rawStatus?: string): StandardCourierStatus {
  if (!rawStatus) return 'Untracked';
  const s = String(rawStatus).toLowerCase().trim();

  if (
    (s.includes('delivered') && !s.includes('partial') && !s.includes('return')) ||
    s.includes('payment collected') ||
    s.includes('cash collected') ||
    s.includes('delivery completed') ||
    s.includes('paid delivery') ||
    s === 'paid'
  ) {
    return 'Delivered';
  }
  if (
    s.includes('partial') ||
    s.includes('partial_delivered') ||
    s.includes('partial return') ||
    s.includes('exchange')
  ) {
    return 'Partial';
  }
  if (
    s.includes('return') ||
    s.includes('rto') ||
    s.includes('cancelled') ||
    s.includes('canceled') ||
    s.includes('fail') ||
    s.includes('damaged') ||
    s.includes('rejected')
  ) {
    return 'Returned';
  }
  if (
    s.includes('transit') ||
    s.includes('picked') ||
    s.includes('at hub') ||
    s.includes('sorting') ||
    s.includes('dispatched') ||
    s.includes('on hold') ||
    s.includes('shipped') ||
    s.includes('out for delivery') ||
    s.includes('assigned')
  ) {
    return 'In Transit';
  }
  if (s.includes('pending') || s.includes('requested') || s.includes('ready')) {
    return 'Pending Pickup';
  }

  return 'In Transit';
}

/**
 * Cleans an order ID (removes quotes, trailing spaces) while preserving branch suffixes.
 */
export function cleanOrderId(rawId: unknown): string {
  if (!rawId) return '';
  return String(rawId).replace(/["'\s]/g, '').toLowerCase();
}

/**
 * Extracts base numeric order ID (e.g. '17263 m' -> '17263', 'D-17263' -> '17263').
 */
export function extractBaseOrderId(rawId: unknown): string {
  if (!rawId) return '';
  const cleaned = cleanOrderId(rawId);
  // Strip exchange/duplicate prefixes like d-, dd-, ex-, exchange-, ret-
  const withoutPrefix = cleaned.replace(/^(dd?|ex|exchange|ret)[-_]?/i, '');
  // Strip branch register suffixes like -m, -c, -w, -s or m, c, w, s
  const baseNumeric = withoutPrefix.replace(/[-_]?[mcws]$/i, '');
  return baseNumeric;
}

/**
 * Detects fulfillment branch from order ID suffixes, notes, or consignment labels.
 * Mirpur Outlet POS: '17263 m' (POS outlet ID 1)
 * Cumilla Branch: '17263 c' (POS outlet ID 2)
 * Wari Branch: '17263 w' (POS outlet ID 9)
 * Sylhet Branch: '17263 s' (POS outlet IDs 7 & 8)
 * Exchange: 'D-17263' or 'DD-17263'
 * Central Warehouse: No suffix (e.g. '17263')
 */
export function detectFulfillmentBranch(orderIdOrRow: unknown): FulfillmentBranchInfo {
  // If orderIdOrRow is an object with pre-existing branchCode and fulfillmentBranch, preserve them
  if (typeof orderIdOrRow === 'object' && orderIdOrRow !== null) {
    const rowObj = orderIdOrRow as Record<string, unknown>;
    const rawOid = String(rowObj['Order ID'] || rowObj.orderId || rowObj['Consignment ID'] || '');
    const baseOrderId = extractBaseOrderId(rawOid);

    if (rowObj.fulfillmentBranch && rowObj.branchCode && rowObj.branchCode !== 'ONLINE') {
      return {
        branchName: String(rowObj.fulfillmentBranch),
        branchCode: rowObj.branchCode as BranchFulfillmentCode,
        isBranchFulfillment: true,
        baseOrderId,
      };
    }

    const createdVia = String(rowObj['Created Via'] || rowObj.created_via || rowObj.createdVia || '').toLowerCase().trim();
    const hasSipExchange = Boolean(
      rowObj.isExchange === true ||
      createdVia === 'sip_exchange' ||
      createdVia.includes('exchange') ||
      rowObj._sip_exchange_order === '1' ||
      rowObj._sip_exchange_order === 1 ||
      Boolean(rowObj._sip_exchange_of) ||
      Boolean(rowObj._sip_exchange_code)
    );
    if (hasSipExchange || /^(dd?|ex|exchange|ret)[-_]/i.test(rawOid)) {
      return { branchName: 'Exchange Replacement', branchCode: 'EXCHANGE', isBranchFulfillment: true, baseOrderId };
    }

    // Authoritative Branch Suffix on Order ID (e.g. 17265 c, 17266 w, 17267 s, 17264 m)
    if (/\b\d+\s*c\b|[-_\s]c$/i.test(rawOid) || /\d+c$/i.test(rawOid)) {
      return { branchName: 'Cumilla Branch', branchCode: 'CUMILLA', isBranchFulfillment: true, baseOrderId };
    }
    if (/\b\d+\s*w\b|[-_\s]w$/i.test(rawOid) || /\d+w$/i.test(rawOid)) {
      return { branchName: 'Wari Branch', branchCode: 'WARI', isBranchFulfillment: true, baseOrderId };
    }
    if (/\b\d+\s*s\b|[-_\s]s$/i.test(rawOid) || /\d+s$/i.test(rawOid)) {
      return { branchName: 'Sylhet Branch', branchCode: 'SYLHET', isBranchFulfillment: true, baseOrderId };
    }
    if (/\b\d+\s*m\b|[-_\s]m$/i.test(rawOid) || /\d+m$/i.test(rawOid)) {
      return { branchName: 'Mirpur Outlet POS', branchCode: 'MIRPUR', isBranchFulfillment: true, baseOrderId };
    }

    const oid = String(
      rowObj.outletId ||
      rowObj['Outlet ID'] ||
      rowObj._sip_outlet_id ||
      rowObj.sip_outlet_id ||
      rowObj._pos_outlet_id ||
      rowObj.pos_outlet_id ||
      ''
    ).trim();
    // Real WooCommerce SIP POS Outlets & Cashiers:
    // Outlet 2 = Mirpur-12 POS (Cashier 3: mirpur12posuser)
    // Outlet 7 = Cumilla Branch POS (Cashier 35: deencumilla)
    // Outlet 8 = Wari Branch POS (Cashier 69: deenwari)
    // Outlet 9 = Sylhet Branch POS (Cashier 572: deensylhet)
    // Outlet 1 = Central Warehouse (Cashier 1508: mohimanul) - also supported as Mirpur fallback for legacy mocks
    if (oid === '2') {
      return { branchName: 'Mirpur Outlet POS', branchCode: 'MIRPUR', isBranchFulfillment: true, baseOrderId };
    }
    if (oid === '7') {
      return { branchName: 'Cumilla Branch', branchCode: 'CUMILLA', isBranchFulfillment: true, baseOrderId };
    }
    if (oid === '8') {
      return { branchName: 'Wari Branch', branchCode: 'WARI', isBranchFulfillment: true, baseOrderId };
    }
    if (oid === '9') {
      return { branchName: 'Sylhet Branch', branchCode: 'SYLHET', isBranchFulfillment: true, baseOrderId };
    }
    if (oid === '1') {
      return { branchName: 'Mirpur Outlet POS', branchCode: 'MIRPUR', isBranchFulfillment: true, baseOrderId };
    }

    const cashierId = String(rowObj.cashierId || rowObj.cashier_id || rowObj._sip_cashier_id || rowObj._sip_created_by || '').trim();
    if (cashierId === '3') {
      return { branchName: 'Mirpur Outlet POS', branchCode: 'MIRPUR', isBranchFulfillment: true, baseOrderId };
    }
    if (cashierId === '35') {
      return { branchName: 'Cumilla Branch', branchCode: 'CUMILLA', isBranchFulfillment: true, baseOrderId };
    }
    if (cashierId === '69') {
      return { branchName: 'Wari Branch', branchCode: 'WARI', isBranchFulfillment: true, baseOrderId };
    }
    if (cashierId === '572') {
      return { branchName: 'Sylhet Branch', branchCode: 'SYLHET', isBranchFulfillment: true, baseOrderId };
    }
    if (cashierId === '1508') {
      return { branchName: 'Mirpur Outlet POS', branchCode: 'MIRPUR', isBranchFulfillment: true, baseOrderId };
    }

    const locText = String(
      rowObj.fulfillmentBranch ||
      rowObj.fulfillmentLocation ||
      rowObj.storeName ||
      rowObj.outletName ||
      rowObj.branch ||
      ''
    ).toLowerCase();
    if (locText.includes('mirpur')) {
      return { branchName: 'Mirpur Outlet POS', branchCode: 'MIRPUR', isBranchFulfillment: true, baseOrderId };
    }
    if (locText.includes('cumilla') || locText.includes('comilla')) {
      return { branchName: 'Cumilla Branch', branchCode: 'CUMILLA', isBranchFulfillment: true, baseOrderId };
    }
    if (locText.includes('wari')) {
      return { branchName: 'Wari Branch', branchCode: 'WARI', isBranchFulfillment: true, baseOrderId };
    }
    if (locText.includes('sylhet')) {
      return { branchName: 'Sylhet Branch', branchCode: 'SYLHET', isBranchFulfillment: true, baseOrderId };
    }
  }

  const rowObj = typeof orderIdOrRow === 'object' && orderIdOrRow !== null ? (orderIdOrRow as Record<string, unknown>) : null;
  const raw = typeof orderIdOrRow === 'string'
    ? orderIdOrRow
    : String(rowObj?.['Order ID'] || rowObj?.orderId || rowObj?.['Consignment ID'] || '');

  const cleaned = cleanOrderId(raw);
  const baseOrderId = extractBaseOrderId(raw);
  const objNotes = rowObj
    ? `${rowObj['Order Notes'] || rowObj.orderNotes || rowObj.customer_note || ''} ${rowObj.Substatus || rowObj.substatus || ''}`.toLowerCase()
    : '';
  const createdVia = rowObj
    ? String(rowObj['Created Via'] || rowObj.created_via || rowObj.createdVia || '').toLowerCase().trim()
    : '';
  const isNoCheckout = Boolean(
    rowObj?.isNoCheckout === true ||
    rowObj?.isNonCheckout === true ||
    createdVia === 'admin' ||
    createdVia === 'manual' ||
    createdVia === 'sip_exchange' ||
    createdVia.includes('exchange') ||
    rowObj?._sip_exchange_order === '1' ||
    rowObj?._sip_exchange_order === 1 ||
    Boolean(rowObj?._sip_exchange_of) ||
    Boolean(rowObj?._sip_exchange_code) ||
    createdVia.includes('no-checkout') ||
    createdVia.includes('no_checkout') ||
    createdVia.includes('non-checkout') ||
    (Boolean(createdVia) && createdVia !== 'checkout' && createdVia !== 'store-api' && createdVia !== 'pos') ||
    objNotes.includes('no checkout') ||
    objNotes.includes('no-checkout') ||
    objNotes.includes('non-checkout') ||
    objNotes.includes('without checkout')
  );

  const hasExchangeNote =
    /exchange\s+for\s+#?\d+/i.test(objNotes) ||
    /\bexchanged\b/i.test(objNotes) ||
    /exchange/i.test(String(rowObj?.orderCategory || '')) ||
    rowObj?.isExchange === true ||
    isNoCheckout;

  if (/^(dd?|ex|exchange|ret)[-_]/i.test(cleaned) || /^d-\d+/i.test(raw.trim()) || hasExchangeNote) {
    return {
      branchName: 'Exchange Replacement',
      branchCode: 'EXCHANGE',
      isBranchFulfillment: true,
      baseOrderId,
    };
  }

  if (/[-_]?m$/i.test(cleaned) || /\s+m$/i.test(raw.trim())) {
    return {
      branchName: 'Mirpur Outlet POS',
      branchCode: 'MIRPUR',
      isBranchFulfillment: true,
      baseOrderId,
    };
  }

  if (/[-_]?c$/i.test(cleaned) || /\s+c$/i.test(raw.trim())) {
    return {
      branchName: 'Cumilla Branch',
      branchCode: 'CUMILLA',
      isBranchFulfillment: true,
      baseOrderId,
    };
  }

  if (/[-_]?w$/i.test(cleaned) || /\s+w$/i.test(raw.trim())) {
    return {
      branchName: 'Wari Branch',
      branchCode: 'WARI',
      isBranchFulfillment: true,
      baseOrderId,
    };
  }

  if (/[-_]?s$/i.test(cleaned) || /\s+s$/i.test(raw.trim())) {
    return {
      branchName: 'Sylhet Branch',
      branchCode: 'SYLHET',
      isBranchFulfillment: true,
      baseOrderId,
    };
  }

  return {
    branchName: 'Central Warehouse (Online)',
    branchCode: 'ONLINE',
    isBranchFulfillment: false,
    baseOrderId,
  };
}

/**
 * Detects discrepancies between WooCommerce store status and Pathao courier status.
 */
export function detectCourierDiscrepancy(
  wcStatus: string,
  courierStatus: StandardCourierStatus,
  orderAmount: number,
  collectedAmount: number,
  options?: {
    paymentMethod?: string;
    isCod?: boolean;
    isPrepaid?: boolean;
    isReturnFromWp?: boolean;
    isPartialFromWp?: boolean;
  }
): { hasDiscrepancy: boolean; type: CourierDiscrepancyType; message?: string } {
  const normWc = String(wcStatus || '').toLowerCase().trim();
  const isWpReturn = options?.isReturnFromWp || /^(returned|refunded|failed|cancelled|canceled|rto)$/i.test(normWc);

  // 1. Critical Discrepancy: WooCommerce considers the parcel shipped/completed, but Pathao returned it!
  if (
    !isWpReturn &&
    (normWc === 'completed' || normWc === 'shipped' || normWc === 'delivered') &&
    courierStatus === 'Returned'
  ) {
    return {
      hasDiscrepancy: true,
      type: 'RETURNED_BUT_SHIPPED',
      message: 'Order marked as completed/shipped in store, but Pathao Courier returned parcel to merchant.',
    };
  }

  // 2. Operational Discrepancy: Delivered by Pathao but still marked processing in store
  if (
    (normWc === 'processing' || normWc === 'on-hold' || normWc === 'pending') &&
    courierStatus === 'Delivered'
  ) {
    return {
      hasDiscrepancy: true,
      type: 'DELIVERED_BUT_PROCESSING',
      message: 'Parcel has been delivered and collected by Pathao courier, but status in WooCommerce is still processing.',
    };
  }

  // 3. Financial Discrepancies
  if (courierStatus === 'Delivered') {
    const pm = String(options?.paymentMethod || '').toLowerCase();
    const isPrepaid = options?.isPrepaid ?? (
      /bkash|nagad|rocket|card|bank|ssl|sslcommerz|prepaid|advance|online/i.test(pm)
    );
    const isCod = options?.isCod ?? (
      !isPrepaid && (/cod|cash/i.test(pm) || orderAmount > 0)
    );

    // 3A. Delivered with COD mismatch (difference > 150 TK)
    if (orderAmount > 0 && collectedAmount > 0) {
      if (Math.abs(orderAmount - collectedAmount) > 150) {
        return {
          hasDiscrepancy: true,
          type: 'COD_MISMATCH',
          message: `COD mismatch: Store billed ৳${orderAmount.toLocaleString()}, but Pathao collected ৳${collectedAmount.toLocaleString()}.`,
        };
      }
    }

    // 3B. Uncollected COD: COD order delivered, but Pathao recorded 0 collected
    if (options !== undefined && isCod && orderAmount > 150 && collectedAmount === 0) {
      return {
        hasDiscrepancy: true,
        type: 'UNCOLLECTED_COD',
        message: `Uncollected COD: Order is Cash on Delivery (৳${orderAmount.toLocaleString()}) and marked delivered, but Pathao reported ৳0 collected.`,
      };
    }

    // 3C. Double Collection Risk: Prepaid order, but courier collected money from customer at doorstep
    if (isPrepaid && collectedAmount > 100) {
      return {
        hasDiscrepancy: true,
        type: 'DOUBLE_COLLECTION_RISK',
        message: `Double Collection Risk: Order was prepaid online, but Pathao collected ৳${collectedAmount.toLocaleString()} at doorstep.`,
      };
    }
  }

  return {
    hasDiscrepancy: false,
    type: 'NONE',
  };
}

/**
 * Parses dates across Excel serial floats, ISO strings, and epoch timestamps into numeric ms epoch.
 */
export function parseDateToEpoch(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    // Excel serial date (e.g. 46295.72)
    if (val > 30000 && val < 60000) {
      return Math.round((val - 25569) * 86400 * 1000);
    }
    // Unix epoch ms
    if (val > 1000000000000) return Math.round(val);
    // Unix epoch seconds
    if (val > 1000000000) return Math.round(val * 1000);
    return Math.round(val);
  }
  const s = String(val).trim();
  if (!s) return 0;
  const num = Number(s);
  if (!isNaN(num) && /^\d+(\.\d+)?$/.test(s)) {
    return parseDateToEpoch(num);
  }
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?/.test(s) && !s.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    const normalized = s.replace(' ', 'T');
    const parsed = Date.parse(`${normalized}+06:00`);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const parsed = Date.parse(`${s}T12:00:00+06:00`);
    return isNaN(parsed) ? 0 : parsed;
  }
  const parsed = Date.parse(s);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Indexes a Pathao order record across consignment ID, exact order ID, base order ID,
 * and customer phone (sorted descending by timestamp to prioritize the latest order).
 */
export function indexTrackingRecord(
  po: PathaoOrderDetail | Record<string, unknown>,
  courierTrackingMap: Record<string, CourierTrackingInfo>,
  phoneTrackingMap: Map<string, CourierTrackingInfo[]>
) {
  const consId = String(
    po['Order consignment id'] ||
    po.order_consignment_id ||
    po['Consignment ID'] ||
    po.consignment_id ||
    po.order_id ||
    ''
  ).trim();

  const rawOid = cleanOrderId(
    po['Merchant order id'] ||
    po.merchant_order_id ||
    po['Order ID'] ||
    po.order_id
  );
  const baseOid = extractBaseOrderId(rawOid);

  const rawPhone = String(
    po['Recipient phone'] ||
    po.recipient_phone ||
    po.phone ||
    ''
  );
  const cleanPhone = cleanCustomerPhone(rawPhone).displayPhone;

  if (!consId && !rawOid && !cleanPhone) return;

  const branchInfo = detectFulfillmentBranch(po['Merchant order id'] || po.merchant_order_id || rawOid);
  const rawStatus = String(po['Order status'] || po.order_status || '');
  const status = normalizeCourierStatus(rawStatus);
  const collected = parseFloat(String(po['Collected amount'] || po.collected_amount || po.order_amount || 0)) || 0;
  const fee = parseFloat(String(po['Total fee'] || po.total_fee || po.delivery_fee || 0)) || 0;
  const codFee = parseFloat(String(po['Cod fee'] || po.cod_fee || 0)) || 0;

  const dateVal =
    po['Order status updated at'] ||
    po.order_status_updated_at ||
    po['Order created at'] ||
    po.order_created_at ||
    po.created_at ||
    '';
  const updatedAt = dateVal ? String(dateVal) : undefined;

  const tracking: CourierTrackingInfo = {
    consignmentId: consId,
    orderId: rawOid,
    baseOrderId: baseOid,
    courierStatus: status,
    rawStatus,
    collectedAmount: collected,
    deliveryFee: fee,
    codFee,
    recipientName: String(po['Recipient name'] || po.recipient_name || ''),
    recipientPhone: rawPhone,
    recipientCity: String(po.City || po.city_name || po.recipient_city || ''),
    updatedAt,
    hasDiscrepancy: false,
    discrepancyType: 'NONE',
    fulfillmentBranch: branchInfo.branchName,
    isBranchFulfillment: branchInfo.isBranchFulfillment,
  };

  // 1. Index by Consignment ID
  if (consId) {
    const k = consId.toLowerCase();
    if (!courierTrackingMap[k]) courierTrackingMap[k] = tracking;
  }

  // 2. Index by Exact Merchant Order ID
  if (rawOid) {
    const k = `oid_${rawOid}`;
    if (!courierTrackingMap[k]) courierTrackingMap[k] = tracking;
  }

  // 3. Index by Base Order ID
  if (baseOid && baseOid !== rawOid) {
    const k = `oid_${baseOid}`;
    if (!courierTrackingMap[k]) courierTrackingMap[k] = tracking;
  }

  // 4. Index by Customer Phone (sorted with newest order first)
  if (cleanPhone) {
    if (!phoneTrackingMap.has(cleanPhone)) {
      phoneTrackingMap.set(cleanPhone, []);
    }
    const list = phoneTrackingMap.get(cleanPhone)!;
    if (!list.some((existing) => existing.consignmentId && existing.consignmentId === tracking.consignmentId)) {
      list.push(tracking);
      list.sort((a, b) => parseDateToEpoch(b.updatedAt) - parseDateToEpoch(a.updatedAt));
    }
  }
}

/**
 * Indexes real-time Pathao Webhook telemetry updates into the courier tracking cache.
 */
export function indexWebhookRecord(
  webhook: PathaoWebhookRecord,
  courierTrackingMap: Record<string, CourierTrackingInfo>,
  _phoneTrackingMap?: Map<string, CourierTrackingInfo[]>
): void {
  const consId = (webhook.consignmentId || '').trim();
  const rawOid = cleanOrderId(webhook.merchantOrderId);
  const baseOid = extractBaseOrderId(rawOid) || rawOid;
  const branchInfo = detectFulfillmentBranch(webhook.merchantOrderId || rawOid);

  let status: StandardCourierStatus = 'In Transit';
  if (webhook.normalizedStatus === 'Delivered') status = 'Delivered';
  else if (webhook.normalizedStatus === 'Returned') status = 'Returned';
  else if (webhook.normalizedStatus === 'Partial') status = 'Partial';
  else if (webhook.normalizedStatus === 'Untracked') status = 'Untracked';

  const tracking: CourierTrackingInfo = {
    consignmentId: consId,
    orderId: rawOid,
    baseOrderId: baseOid,
    courierStatus: status,
    rawStatus: webhook.rawStatus,
    collectedAmount: webhook.collectedAmount,
    deliveryFee: 0,
    codFee: 0,
    recipientName: '',
    recipientPhone: '',
    recipientCity: '',
    updatedAt: webhook.updatedAt,
    hasDiscrepancy: false,
    discrepancyType: 'NONE',
    fulfillmentBranch: branchInfo.branchName,
    isBranchFulfillment: branchInfo.isBranchFulfillment,
  };

  if (consId) {
    courierTrackingMap[consId.toLowerCase()] = tracking;
  }
  if (rawOid) {
    courierTrackingMap[`oid_${rawOid}`] = tracking;
  }
  if (baseOid && baseOid !== rawOid) {
    courierTrackingMap[`oid_${baseOid}`] = tracking;
  }
}

/**
 * Primary synchronization orchestrator for the Live Operations Terminal.
 * Combines WooCommerce order data and Pathao courier consignment telemetry.
 */
export async function syncLiveTerminalData(options: {
  wcCredentials?: WcCredentials;
  pathaoCredentials?: PathaoCredentials;
  activeOrders?: RawOrderRow[];
  limitConsignments?: number;
  fetchLiveWc?: boolean;
  skipNetwork?: boolean;
  maxPages?: number;
}): Promise<LiveTerminalSyncResult> {
  let wcConnected = false;
  let pathaoConnected = false;
  let rawOrders: RawOrderRow[] = [];

  const shouldFetchWc = options.fetchLiveWc || (!options.activeOrders && !options.skipNetwork);

  // ── Step 1: Fetch or load WooCommerce Orders ──
  if (shouldFetchWc && !options.skipNetwork) {
    try {
      const wcTest = await testWooCommerceConnection(options.wcCredentials);
      if (wcTest.success) {
        wcConnected = true;
        const maxPagesToFetch = options.maxPages || 6; // Default to 6 pages (600 orders) to cover full 7-day rolling window
        const fetched = await fetchWooCommerceOrders({
          perPage: 100,
          fetchAllPages: true,
          maxPages: maxPagesToFetch,
          orderBy: 'date',
          order: 'desc',
          credentials: options.wcCredentials,
        });
        if (fetched && fetched.length > 0) {
          const liveRows = formatWooCommerceToOrderRows(fetched);
          if (Array.isArray(options.activeOrders) && options.activeOrders.length > 0) {
            const liveOrderIds = new Set(liveRows.map((r) => cleanOrderId(r['Order ID'] || r.orderId)));
            const nonOverlapping = options.activeOrders.filter((r) => !liveOrderIds.has(cleanOrderId(r['Order ID'] || r.orderId)));
            rawOrders = [...liveRows, ...nonOverlapping];
          } else {
            rawOrders = liveRows;
          }
        }
      }
    } catch (err) {
      console.warn('WooCommerce live fetch failed or unconfigured, checking fallback:', err);
    }
  }

  let blobDataset: DatasetSnapshot | null = null;

  // Fallback to active orders passed from client, Vercel Blob cloud snapshot, or bundled baseline dataset
  if (rawOrders.length === 0) {
    if (Array.isArray(options.activeOrders) && options.activeOrders.length > 0) {
      rawOrders = options.activeOrders;
    } else if (isBlobConfigured()) {
      try {
        const blobRes = await fetchDatasetFromBlob();
        if (blobRes.success && blobRes.dataset && Array.isArray(blobRes.dataset.orders) && blobRes.dataset.orders.length > 0) {
          rawOrders = blobRes.dataset.orders;
          blobDataset = blobRes.dataset;
        }
      } catch (blobErr) {
        console.warn('[liveTerminalSync] Notice: Vercel Blob fallback fetch skipped:', blobErr);
      }
    }

    if (rawOrders.length === 0 && baselineData && Array.isArray((baselineData as { orders?: RawOrderRow[] }).orders)) {
      rawOrders = (baselineData as { orders: RawOrderRow[] }).orders;
    }
  }

  // ── Step 1B: Classify Customers (DEEN-OPS Customer Mix Grounding) ──
  try {
    const customerTimeline = buildTimelineIndex(rawOrders);
    for (const row of rawOrders) {
      const billing = extractCustomerBilling(row);
      const orderDateIso = String(row['Order Date'] || row.orderDate || row['Date Modified'] || '');
      const cls = classifyCustomer(billing, orderDateIso, customerTimeline);
      const rowRec = row as Record<string, unknown>;
      rowRec.isReturningCustomer = cls === 'returning';
      rowRec.customerType = cls;
    }
  } catch (err) {
    console.warn('Customer classification in live terminal sync caught warning:', err);
  }

  // ── Step 2: Harvest Consignment & Merchant IDs ──
  const consignmentIdSet = new Set<string>();
  const orderIdMap = new Map<string, RawOrderRow[]>();
  const unconsignedOrderIds = new Set<string>();
  const unconsignedPhones = new Set<string>();

  for (const row of rawOrders) {
    const cid =
      row['Consignment ID'] ||
      row.consignmentId ||
      row.consignment_id ||
      row.tracking_number ||
      row['Tracking ID'];
    if (cid && typeof cid === 'string' && cid.trim().length > 3) {
      consignmentIdSet.add(cid.trim());
    } else {
      const oid = cleanOrderId(row['Order ID'] || row.orderId);
      if (oid) unconsignedOrderIds.add(oid);
      const rawPhone = row.Phone || row.phone || (row as Record<string, unknown>)['Billing Phone'] || (row as Record<string, unknown>)['Shipping Phone'] || '';
      const cleanPhone = cleanCustomerPhone(rawPhone).displayPhone;
      if (cleanPhone) unconsignedPhones.add(cleanPhone);
    }

    const oid = cleanOrderId(row['Order ID'] || row.orderId);
    if (oid) {
      if (!orderIdMap.has(oid)) orderIdMap.set(oid, []);
      orderIdMap.get(oid)!.push(row);
    }
  }

  // ── Step 3: Query Pathao Courier Aladdin API ──
  const courierTrackingMap: Record<string, CourierTrackingInfo> = {};
  const phoneTrackingMap = new Map<string, CourierTrackingInfo[]>();

  const harvestedConsignments = Array.from(consignmentIdSet).slice(0, options.limitConsignments || 20);
  const harvestedOrderIds = Array.from(unconsignedOrderIds).slice(0, 15);

  if (!options.skipNetwork) {
    try {
      const { pathao } = getSecretsWithOverrides({ pathao: options.pathaoCredentials });
      if (pathao.client_id && pathao.client_secret) {
        const token = await getPathaoToken(options.pathaoCredentials);
        if (token) {
          pathaoConnected = true;
          const liveOrdersToProcess: PathaoOrderDetail[] = [];

          // 3A: Explicit Consignment ID lookups
          if (harvestedConsignments.length > 0) {
            const byCons = await batchFetchPathaoOrders(harvestedConsignments, 4, options.pathaoCredentials);
            liveOrdersToProcess.push(...byCons);
          }

          // 3B: If orders lack consignment IDs, query Pathao by order ID
          if (harvestedOrderIds.length > 0) {
            const byOid = await batchFetchPathaoOrdersByOrderIds(harvestedOrderIds, 3, options.pathaoCredentials);
            liveOrdersToProcess.push(...byOid);
          }

          // 3C: Fetch recent dispatches from Pathao to match active dispatches
          if (harvestedOrderIds.length > 0 || unconsignedPhones.size > 0) {
            try {
              const recent = await fetchRecentPathaoOrders(1, options.pathaoCredentials);
              if (Array.isArray(recent) && recent.length > 0) {
                liveOrdersToProcess.push(...recent);
              }
            } catch {
              // ignore
            }
          }

          for (const po of liveOrdersToProcess) {
            indexTrackingRecord(po, courierTrackingMap, phoneTrackingMap);
          }
        }
      }
    } catch (err) {
      console.warn('Pathao live API connection skipped or unconfigured:', err);
    }
  }

  // Fallback: Populate courier data from Vercel Blob or bundled baseline data (pathaoDelivery) if unmapped
  const fallbackDelivery = (blobDataset?.pathaoDelivery && blobDataset.pathaoDelivery.length > 0)
    ? (blobDataset.pathaoDelivery as Record<string, unknown>[])
    : (baselineData && Array.isArray((baselineData as { pathaoDelivery?: Record<string, unknown>[] }).pathaoDelivery))
      ? (baselineData as { pathaoDelivery: Record<string, unknown>[] }).pathaoDelivery
      : [];

  if (fallbackDelivery.length > 0) {
    for (const po of fallbackDelivery) {
      indexTrackingRecord(po, courierTrackingMap, phoneTrackingMap);
    }
  }

  // ── Step 3D: Ingest Real-Time Pathao Webhook Updates (Top Priority Live State) ──
  try {
    const liveWebhooks = getLiveWebhookUpdates();
    if (liveWebhooks && liveWebhooks.size > 0) {
      for (const webhookRecord of liveWebhooks.values()) {
        indexWebhookRecord(webhookRecord, courierTrackingMap, phoneTrackingMap);
      }
    }
  } catch (err) {
    console.warn('[liveTerminalSync] Notice: Webhook updates ingestion skipped:', err);
  }

  // ── Step 4: Enrich Orders & Compute Discrepancies ──
  const discrepancies: DiscrepancyAlert[] = [];
  let handedOverCount = 0;
  let inTransitCount = 0;
  let deliveredCount = 0;
  let returnedCount = 0;
  let pendingPickupCount = 0;
  let untrackedCount = 0;
  let totalCodCollected = 0;
  let branchOrderCount = 0;
  let exchangeOrderCount = 0;

  const seenOrders = new Set<string>();

  const enrichedOrders: RawOrderRow[] = rawOrders.map((row) => {
    const branchInfo = detectFulfillmentBranch(row);
    const rawOid = cleanOrderId(row['Order ID'] || row.orderId);
    const baseOid = branchInfo.baseOrderId || extractBaseOrderId(rawOid) || rawOid;
    const consId = String(
      row['Consignment ID'] ||
        row.consignmentId ||
        row.consignment_id ||
        row.tracking_number ||
        ''
    ).trim();
    const rawPhone = row.Phone || row.phone || (row as Record<string, unknown>)['Billing Phone'] || (row as Record<string, unknown>)['Shipping Phone'] || '';
    const cleanPhone = cleanCustomerPhone(rawPhone).displayPhone;

    // Multi-tier Resolution Hierarchy:
    // Tier 1: Match by explicit Consignment ID
    let tracking = consId ? courierTrackingMap[consId.toLowerCase()] : undefined;

    // Tier 2: Match by exact Merchant Order ID
    if (!tracking && rawOid) {
      tracking = courierTrackingMap[`oid_${rawOid}`];
    }

    // Tier 3: Match by base Order ID (e.g. without branch suffix or exchange prefix)
    if (!tracking && baseOid) {
      tracking = courierTrackingMap[`oid_${baseOid}`];
    }

    // Tier 4: Match by Customer Phone Number (pick latest Pathao order for this customer)
    if (!tracking && cleanPhone && phoneTrackingMap.has(cleanPhone)) {
      const candidates = phoneTrackingMap.get(cleanPhone)!;
      if (candidates.length > 0) {
        tracking = candidates[0];
      }
    }

    // Tier 5: Fallback to Pathao status and fee stored in WooCommerce order metadata
    const rawPathaoStatus = String(row.pathaoStatus || (row as Record<string, unknown>)['Pathao Status'] || '');
    const rawPathaoFee = parseFloat(String(row.pathaoDeliveryFee || (row as Record<string, unknown>)['Pathao Delivery Fee'] || 0)) || 0;
    if (!tracking && rawPathaoStatus && rawPathaoStatus !== '-' && rawPathaoStatus !== 'null') {
      const normalizedMetaStatus = normalizeCourierStatus(rawPathaoStatus);
      tracking = {
        consignmentId: consId,
        orderId: rawOid,
        baseOrderId: baseOid,
        courierStatus: normalizedMetaStatus,
        rawStatus: rawPathaoStatus,
        collectedAmount: 0,
        deliveryFee: rawPathaoFee,
        codFee: 0,
        recipientName: String(row['Customer Name'] || row.customerName || ''),
        recipientPhone: String(rawPhone || ''),
        recipientCity: String(row.City || row.city || ''),
        hasDiscrepancy: false,
        discrepancyType: 'NONE',
        fulfillmentBranch: branchInfo.branchName,
        isBranchFulfillment: branchInfo.isBranchFulfillment,
      };
    }

    const courierStatus: StandardCourierStatus = tracking ? tracking.courierStatus : 'Untracked';
    const effectiveConsId = tracking?.consignmentId || consId || '';
    const collectedAmount = tracking?.collectedAmount || 0;
    const fee = tracking?.deliveryFee || 0;

    // Ensure resolved consignment ID is reflected on the order record
    if (effectiveConsId && !row['Consignment ID']) {
      (row as Record<string, unknown>)['Consignment ID'] = effectiveConsId;
      (row as Record<string, unknown>).consignmentId = effectiveConsId;
      (row as Record<string, unknown>).tracking_number = effectiveConsId;
    }

    const wcStatus = String(row['Delivery Status'] || row.status || 'shipped');
    const orderAmount = Number(row['Order Amount'] || row['Item Cost'] || 0);
    const rowRec = row as Record<string, unknown>;
    const paymentMethod = String(
      row['Payment Method'] ||
      rowRec.payment_method ||
      rowRec.paymentMethod ||
      rowRec['Cash on delivery'] ||
      ''
    );

    const discCheck = detectCourierDiscrepancy(wcStatus, courierStatus, orderAmount, collectedAmount, {
      paymentMethod,
      isReturnFromWp: Boolean(row.isReturnFromWp || (row as Record<string, unknown>).wpDeliveryStatus === 'Paid Return' || (row as Record<string, unknown>).wpDeliveryStatus === 'Not Paid Return'),
      isPartialFromWp: Boolean(row.isPartialFromWp || (row as Record<string, unknown>).wpDeliveryStatus === 'Partial'),
    });

    if (discCheck.hasDiscrepancy && !seenOrders.has(rawOid)) {
      discrepancies.push({
        orderId: String(row['Order ID'] || row.orderId || ''),
        wcStatus,
        courierStatus,
        type: discCheck.type,
        message: discCheck.message || '',
        consignmentId: effectiveConsId,
        fulfillmentBranch: branchInfo.branchName,
      });
    }

    if (!seenOrders.has(rawOid)) {
      seenOrders.add(rawOid);

      if (branchInfo.isBranchFulfillment) {
        branchOrderCount++;
      }
      if (branchInfo.branchCode === 'EXCHANGE') {
        exchangeOrderCount++;
      }

      if (courierStatus !== 'Untracked') {
        handedOverCount++;
      } else {
        untrackedCount++;
      }

      if (courierStatus === 'In Transit') inTransitCount++;
      else if (courierStatus === 'Delivered') {
        deliveredCount++;
        totalCodCollected += collectedAmount || orderAmount;
      } else if (courierStatus === 'Returned') {
        returnedCount++;
      } else if (courierStatus === 'Pending Pickup') {
        pendingPickupCount++;
      }
    }

    return {
      ...row,
      'Consignment ID': effectiveConsId,
      consignmentId: effectiveConsId,
      'Courier Status': courierStatus,
      courierStatus: courierStatus,
      pathaoStatus: courierStatus,
      hasDiscrepancy: discCheck.hasDiscrepancy,
      discrepancyType: discCheck.type,
      discrepancyMessage: discCheck.message,
      collectedAmount,
      courierDeliveryFee: fee,
      fulfillmentBranch: branchInfo.branchName,
      branchCode: branchInfo.branchCode,
      isBranchFulfillment: branchInfo.branchCode !== 'ONLINE' && !Boolean(
        row.isPos === true &&
        !isEcomPaymentMethod(paymentMethod, (row as Record<string, unknown>).payment_method_title) &&
        !effectiveConsId &&
        String(row['Created Via'] || (row as Record<string, unknown>).created_via || '').toLowerCase().trim() !== 'checkout'
      ),
      isPos: Boolean(
        row.isPos === true &&
        !isEcomPaymentMethod(paymentMethod, (row as Record<string, unknown>).payment_method_title) &&
        !effectiveConsId &&
        String(row['Created Via'] || (row as Record<string, unknown>).created_via || '').toLowerCase().trim() !== 'checkout'
      ),
      baseOrderId: baseOid,
    };
  });

  const totalDistinctOrders = seenOrders.size;
  const handedOverRate =
    totalDistinctOrders > 0 ? Math.round((handedOverCount / totalDistinctOrders) * 1000) / 10 : 0;

  const stats: LiveTerminalStats = {
    totalOrders: totalDistinctOrders,
    totalLineItems: enrichedOrders.length,
    handedOverCount,
    handedOverRate,
    inTransitCount,
    deliveredCount,
    returnedCount,
    pendingPickupCount,
    untrackedCount,
    discrepancyCount: discrepancies.length,
    totalCodCollected,
    branchOrderCount,
    exchangeOrderCount,
  };

  const provenanceSource = wcConnected || pathaoConnected
    ? 'live_api'
    : blobDataset
      ? 'vercel_blob'
      : 'baseline_bundled';

  const provenance = createDataProvenance(
    provenanceSource,
    enrichedOrders.length,
    false
  );

  const message = wcConnected
    ? `Successfully synchronized ${totalDistinctOrders} live orders (${enrichedOrders.length} line items) from WooCommerce REST API with Pathao courier telemetry.`
    : `Synchronized ${totalDistinctOrders} orders (${enrichedOrders.length} line items) with local snapshot / Pathao courier telemetry.`;

  return {
    success: true,
    message,
    orders: enrichedOrders,
    courierTrackingMap,
    stats,
    discrepancies,
    wcConnected,
    pathaoConnected,
    syncTimestamp: new Date().toISOString(),
    provenance,
  };
}
