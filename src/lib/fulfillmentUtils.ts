import { RawOrderRow } from '@/types';
import { DataProvenanceInfo } from './dataAudit';

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

    // DEFINITIVE INVARIANT: Web checkout orders (created_via: checkout / store-api)
    // If order was placed via web checkout, it is EXCLUSIVELY an Ecommerce order.
    // Check if it was an explicit branch courier dispatch with suffix (e.g. 17263 c, 17263 w, 17263 s, 17263 m).
    // Otherwise, it is an Online Store (Central Warehouse) order, NOT a POS register sale!
    const isWebCheckout = createdVia === 'checkout' || createdVia === 'store-api' || createdVia.includes('checkout');
    if (isWebCheckout) {
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
        return { branchName: 'Mirpur Outlet', branchCode: 'MIRPUR', isBranchFulfillment: true, baseOrderId };
      }
      return {
        branchName: 'Online Store (Central Warehouse)',
        branchCode: 'ONLINE',
        isBranchFulfillment: false,
        baseOrderId,
      };
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
    // Outlet 1 = Central Warehouse (Cashier 1508: mohimanul) — Central Online Hub, NEVER Mirpur POS!
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
      return { branchName: 'Online Store (Central Warehouse)', branchCode: 'ONLINE', isBranchFulfillment: false, baseOrderId };
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
      return { branchName: 'Online Store (Central Warehouse)', branchCode: 'ONLINE', isBranchFulfillment: false, baseOrderId };
    }

    const locText = String(
      rowObj.fulfillmentBranch ||
      rowObj.fulfillmentLocation ||
      rowObj.storeName ||
      rowObj.outletName ||
      rowObj.branch ||
      ''
    ).toLowerCase();
    // Central Warehouse ('Warehouse (Mirpur)' or 'Central Warehouse') is ONLINE, NOT Mirpur POS
    if (locText.includes('warehouse') || locText.includes('central') || locText.includes('online')) {
      return { branchName: 'Online Store (Central Warehouse)', branchCode: 'ONLINE', isBranchFulfillment: false, baseOrderId };
    }
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
  const isWpReturn = options?.isReturnFromWp || /^(returned|refunded|rto)$/i.test(normWc);

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
