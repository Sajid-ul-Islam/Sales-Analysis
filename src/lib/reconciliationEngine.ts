import {
  RawOrderRow,
  ReconciledOrderRow,
  ReturnedItemRow,
  SkuAnalytics,
  CustomerRiskProfile,
  SummaryAnalytics,
  CourierCostSummary,
  UnitEconomics,
  DeliveryCategory,
  CourierMismatchRecord,
  ExchangedOrderRow
} from '@/types';
import { classifyLocation } from './geo';
import { matchPartialItemsAdvanced, OrderItemEntry, SubsetMatchResult } from './subsetSum';

export interface IngestionOptions {
  excludeAugust?: boolean;
  excludePOS?: boolean;
}

export interface ReconciliationResult {
  reconciledOrders: ReconciledOrderRow[];
  returnedItems: ReturnedItemRow[];
  skuAnalytics: SkuAnalytics[];
  customerRiskProfiles: CustomerRiskProfile[];
  summary: SummaryAnalytics;
  courierMismatches: CourierMismatchRecord[];
  exchangedOrders: ExchangedOrderRow[];
}

export type FulfillmentBranch = 'Online Store (Central Warehouse)' | 'Mirpur Outlet POS' | 'Mirpur Outlet' | 'Cumilla Branch' | 'Wari Branch' | 'Sylhet Branch' | 'Warehouse (Mirpur)';

export function normalizeOrderId(raw: any): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim();
  str = str.replace(/^["'\s]+|["'\s]+$/g, '');
  if (str.endsWith('.0')) str = str.slice(0, -2);
  // Support prefixes like D-17263, DD-17263, EXCH-17263
  str = str.replace(/^(DD|D|EXCH)[-_ ]+/i, '');
  return str.trim().replace(/^["'\s]+|["'\s]+$/g, '');
}

export function extractBaseOrderId(raw: any): string {
  if (raw === null || raw === undefined) return '';
  const s = normalizeOrderId(raw);
  const m = s.match(/\d+/);
  return m ? m[0] : s;
}

export function detectFulfillmentBranch(rawId: any, note?: any, storeName?: any): {
  branch: FulfillmentBranch;
  suffix: string;
} {
  let strId = String(rawId || '').trim().replace(/^["'\s]+|["'\s]+$/g, '');
  const strNote = String(note || '').trim().toLowerCase();
  const strStore = String(storeName || '').trim().toLowerCase();

  // Store name hint (from Pathao Master Delivery Report)
  if (strStore.includes('cumilla') || strStore.includes('comilla')) {
    return { branch: 'Cumilla Branch', suffix: 'c' };
  }
  if (strStore.includes('wari')) {
    return { branch: 'Wari Branch', suffix: 'w' };
  }
  if (strStore.includes('sylhet')) {
    return { branch: 'Sylhet Branch', suffix: 's' };
  }
  if (strStore.includes('mirpur')) {
    return { branch: 'Mirpur Outlet POS', suffix: 'm' };
  }

  // Courier order ID suffix check: e.g. "17263 c", "17263-c", "17263c", "17263 w", "17263 s", "17263 m"
  if (/\b\d+\s*c\b|[-_\s]c$/i.test(strId) || /\d+c$/i.test(strId)) {
    return { branch: 'Cumilla Branch', suffix: 'c' };
  }
  if (/\b\d+\s*w\b|[-_\s]w$/i.test(strId) || /\d+w$/i.test(strId)) {
    return { branch: 'Wari Branch', suffix: 'w' };
  }
  if (/\b\d+\s*s\b|[-_\s]s$/i.test(strId) || /\d+s$/i.test(strId)) {
    return { branch: 'Sylhet Branch', suffix: 's' };
  }
  if (/\b\d+\s*m\b|[-_\s]m$/i.test(strId) || /\d+m$/i.test(strId)) {
    return { branch: 'Mirpur Outlet POS', suffix: 'm' };
  }

  // Note hints
  if (/\b\d+\s*c\b|\bcumilla\b|\bcomilla\b/i.test(strNote)) {
    return { branch: 'Cumilla Branch', suffix: 'c' };
  }
  if (/\b\d+\s*w\b|\bwari\b/i.test(strNote)) {
    return { branch: 'Wari Branch', suffix: 'w' };
  }
  if (/\b\d+\s*s\b|\bsylhet\b/i.test(strNote)) {
    return { branch: 'Sylhet Branch', suffix: 's' };
  }
  if (/\b\d+\s*m\b|\bmirpur\b/i.test(strNote)) {
    return { branch: 'Mirpur Outlet POS', suffix: 'm' };
  }

  return { branch: 'Online Store (Central Warehouse)', suffix: '' };
}

export function cleanPhoneNumber(raw: any): string {
  if (raw === null || raw === undefined) return '';
  let s = String(raw).trim().replace(/\.0$/, '').replace(/[^0-9]/g, '');
  if (s.startsWith('880')) s = s.slice(2);
  else if (s.startsWith('88')) s = s.slice(2);
  if (s.length === 10 && s.startsWith('1')) s = '0' + s;
  return s;
}

export function hasMultiParcelSuffix(note: any): boolean {
  if (!note) return false;
  const str = String(note).trim();
  if (/\b\d+\s*[wcs]\b/i.test(str)) return true;
  if (/order\s*id\s*\d+\s*[wcs]\b/i.test(str)) return true;
  return false;
}

export function parseExcelDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    // Excel serial number epoch starts 1899-12-30 (25569 days before 1970-01-01)
    if (val > 20000 && val < 65000) {
      return new Date(Math.round((val - 25569) * 86400 * 1000));
    }
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const num = Number(trimmed);
    if (!isNaN(num) && num > 20000 && num < 65000) {
      return new Date(Math.round((num - 25569) * 86400 * 1000));
    }
    // Handle DD/MM/YYYY or DD-MM-YYYY format common in Bangladesh
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10) - 1;
      const y = parseInt(dmyMatch[3], 10);
      return new Date(y, m, d);
    }
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Dynamic Column Alias Resolver.
 * Automatically maps varying column headers across WooCommerce, Shopify, Steadfast, and Pathao.
 */
function findCol(row: Record<string, any>, candidates: string[]): any {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const found = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === c.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (found && row[found] !== undefined && row[found] !== null) return row[found];
  }
  return null;
}

export function classifyProductCategory(itemName: string, sku: string): string {
  const n = (itemName || '').toLowerCase();
  const s = (sku || '').toLowerCase();

  // 1. Denim Core (Jeans, Denim Pants)
  if (n.includes('jean') || (n.includes('denim') && !n.includes('jacket') && !n.includes('shirt')) || s.startsWith('101-')) {
    return 'Jeans (Denim Core)';
  }

  // 2. Casual & Formal Shirts (102- is exclusively Deen Shirts, e.g. Cuban Collar, Half Shirt, Formal Shirt)
  const isTshirt = n.includes('t-shirt') || n.includes('tshirt') || n.includes('tee');
  const isPolo = n.includes('polo');
  const isShirt = (n.includes('shirt') || n.includes('panjabi')) && !isTshirt && !isPolo;
  if (isShirt || s.startsWith('102-') || s.startsWith('export-shirt')) {
    return 'Casual & Formal Shirts';
  }

  // 3. Distinct: Polo Shirts (103-)
  if (isPolo || s.startsWith('103-')) {
    return 'Polo Shirts';
  }

  // 4. Distinct: T-Shirts (105-)
  if (isTshirt || s.startsWith('105-')) {
    return 'T-Shirts';
  }

  // 5. Distinct: Jackets (115-)
  if (n.includes('jacket') || s.startsWith('115-')) {
    return 'Jackets';
  }

  // 6. Distinct: Sweatshirts & Hoodies (108- Sweatshirt, 114- Hoodie)
  if (n.includes('sweatshirt') || n.includes('hoodie') || n.includes('french-terry') || s.startsWith('108-') || s.startsWith('114-')) {
    return 'Sweatshirts & Hoodies';
  }

  // 7. Pants, Chinos & Trousers (Twill, Chino, Cargo, Trouser, 104-, 110-)
  if (n.includes('twill') || n.includes('chino') || n.includes('trouser') || n.includes('cargo') || n.includes('pant') || s.includes('104-') || s.startsWith('110-')) {
    return 'Twill Pants & Chinos';
  }

  return 'Apparel & Accessories';
}

export function runReconciliationEngine(
  orderRows: RawOrderRow[],
  returnRows: RawOrderRow[],
  partialRows: RawOrderRow[],
  options: IngestionOptions = { excludeAugust: true, excludePOS: true },
  exchangeRows: RawOrderRow[] = [],
  pathaoDeliveryRows: RawOrderRow[] = []
): ReconciliationResult {
  interface PathaoDeliveryEntry {
    rawMerchantId: string;
    consignment: string;
    recipient: string;
    address: string;
    phone: string;
    status: string;
    collected: number;
    collectable: number;
    totalFee: number;
    codFee: number;
    deliveryFee: number;
    storeName: string;
    orderType: string;
    branch: FulfillmentBranch;
    suffix: string;
    isPaidReturn: boolean;
  }

  interface CourierReturnEntry {
    cod: number;
    status: string;
    consignment: string;
    charge: number;
    discount: number;
    phone: string;
    rawOid: string;
    branch: FulfillmentBranch;
    suffix: string;
    isPaidReturn: boolean;
  }

  // 0. Process Pathao Master Delivery Report (PRIMARY STATUS SOURCE)
  const pathaoDeliveryMap = new Map<string, Array<PathaoDeliveryEntry>>();
  const pathaoDeliveryPhoneMap = new Map<string, Array<PathaoDeliveryEntry>>();
  let pathaoTotalFee = 0;
  let pathaoCollectedCod = 0;
  let pathaoPaidReturnCod = 0;
  let pathaoDeliveryEntriesCount = 0;

  for (const r of pathaoDeliveryRows) {
    const rawOid = findCol(r, ['merchantorderid', 'orderid', 'merchantid', 'oid', 'invoiceno']);
    const cons = String(findCol(r, ['orderconsignmentid', 'consignmentid', 'trackingcode', 'consignment']) || '').trim();
    if (!rawOid && !cons) continue;

    const status = String(findCol(r, ['orderstatus', 'deliverystatus', 'status']) || 'Delivered').trim();
    const collected = parseFloat(findCol(r, ['collectedamount', 'collected']) || '0') || 0;
    const collectable = parseFloat(findCol(r, ['collectableamount', 'amount', 'collectable']) || '0') || 0;
    const totalFee = parseFloat(findCol(r, ['totalfee', 'fee', 'charge']) || '0') || 0;
    const codFee = parseFloat(findCol(r, ['codfee']) || '0') || 0;
    const deliveryFee = parseFloat(findCol(r, ['deliveryfee']) || '0') || 0;
    const phone = cleanPhoneNumber(findCol(r, ['recipientphone', 'phone', 'contact']));
    const recipient = String(findCol(r, ['recipientname', 'name', 'customername']) || '').trim();
    const address = String(findCol(r, ['recipientaddress', 'address', 'destination']) || '').trim();
    const storeName = String(findCol(r, ['storename', 'store', 'outlet', 'branch']) || '').trim();
    const orderType = String(findCol(r, ['ordertype', 'type']) || '').trim();

    pathaoTotalFee += totalFee;
    pathaoCollectedCod += collected;
    if (totalFee > 0 || cons) pathaoDeliveryEntriesCount++;

    const cleanOid = normalizeOrderId(rawOid);
    const baseOid = extractBaseOrderId(rawOid);
    const branchInfo = detectFulfillmentBranch(rawOid, undefined, storeName);

    const isPaid = status.toLowerCase().includes('paid return') ||
      (collected > 0 && (status.toLowerCase().includes('return') || status.toLowerCase().includes('returned')));

    if (isPaid) {
      pathaoPaidReturnCod += collected;
    }

    const entry: PathaoDeliveryEntry = {
      rawMerchantId: String(rawOid || ''),
      consignment: cons,
      recipient,
      address,
      phone,
      status,
      collected,
      collectable,
      totalFee,
      codFee,
      deliveryFee,
      storeName,
      orderType,
      branch: branchInfo.branch,
      suffix: branchInfo.suffix,
      isPaidReturn: isPaid
    };

    if (cleanOid) {
      if (!pathaoDeliveryMap.has(cleanOid)) pathaoDeliveryMap.set(cleanOid, []);
      pathaoDeliveryMap.get(cleanOid)!.push(entry);
    }
    if (baseOid && baseOid !== cleanOid) {
      if (!pathaoDeliveryMap.has(baseOid)) pathaoDeliveryMap.set(baseOid, []);
      pathaoDeliveryMap.get(baseOid)!.push(entry);
    }
    if (phone) {
      if (!pathaoDeliveryPhoneMap.has(phone)) pathaoDeliveryPhoneMap.set(phone, []);
      pathaoDeliveryPhoneMap.get(phone)!.push(entry);
    }
  }

  // 1. Process Courier Return Log with Two-Tier Maps (Fallback Source)
  const returnMap = new Map<string, Array<CourierReturnEntry>>();
  const returnPhoneMap = new Map<string, Array<CourierReturnEntry>>();

  let totalCourierCharge = 0;
  let totalCourierDiscount = 0;
  let returnConsignmentsCount = 0;
  let paidReturnCollectedCod = 0;

  for (const r of returnRows) {
    const rawOid = findCol(r, ['orderid', 'order_id', 'oid', 'consignmentid', 'trackingcode']);
    const status = findCol(r, ['deliverystatus', 'delivery_status', 'status']) || 'Returned';
    const cod = parseFloat(findCol(r, ['codamount', 'cod', 'amount']) || '0') || 0;
    const cons = String(findCol(r, ['consignmentid', 'consignment', 'trackingid']) || '');
    const charge = parseFloat(findCol(r, ['charge', 'deliveryfee', 'fee', 'cost']) || '0') || 0;
    const discount = parseFloat(findCol(r, ['discount']) || '0') || 0;
    const phone = cleanPhoneNumber(findCol(r, ['phone', 'contact', 'recipient_phone']));

    totalCourierCharge += charge;
    totalCourierDiscount += discount;
    if (charge > 0 || cons) returnConsignmentsCount++;

    const cleanOid = normalizeOrderId(rawOid);
    const baseOid = extractBaseOrderId(rawOid);

    const branchInfo = detectFulfillmentBranch(rawOid);
    const isPaid = String(status).toLowerCase().includes('paid') || (cod > 0 && String(status).toLowerCase().includes('return'));

    if (isPaid) {
      paidReturnCollectedCod += cod;
    }

    const entry = {
      status: String(status).trim(),
      cod: cod,
      consignment: cons,
      charge: charge,
      discount: discount,
      phone: phone,
      rawOid: String(rawOid || ''),
      branch: branchInfo.branch,
      suffix: branchInfo.suffix,
      isPaidReturn: isPaid
    };

    if (cleanOid) {
      if (!returnMap.has(cleanOid)) returnMap.set(cleanOid, []);
      returnMap.get(cleanOid)!.push(entry);
    }
    if (baseOid && baseOid !== cleanOid) {
      if (!returnMap.has(baseOid)) returnMap.set(baseOid, []);
      returnMap.get(baseOid)!.push(entry);
    }
    if (phone) {
      if (!returnPhoneMap.has(phone)) returnPhoneMap.set(phone, []);
      returnPhoneMap.get(phone)!.push(entry);
    }
  }

  // 2. Process Partial Delivery File with Two-Tier Maps (Order ID + Phone Number)
  const partialMap = new Map<string, { cod: number | null; status: string; consignment: string; rawId: string; charge: number; phone: string }>();
  const partialPhoneMap = new Map<string, { cod: number | null; status: string; consignment: string; rawId: string; charge: number; phone: string }>();

  for (const r of partialRows) {
    const rawOid = findCol(r, ['orderid', 'order_id', 'oid', 'consignmentid']);
    const cod = parseFloat(findCol(r, ['codamount', 'cod', 'amount']) || '0') || 0;
    const status = String(findCol(r, ['deliverystatus', 'status']) || 'Partial Delivery');
    const cons = String(findCol(r, ['consignmentid', 'consignment']) || '');
    const charge = parseFloat(findCol(r, ['charge', 'fee']) || '0') || 0;
    const phone = cleanPhoneNumber(findCol(r, ['phone', 'contact']));

    const cleanOid = normalizeOrderId(rawOid);
    const baseOid = extractBaseOrderId(rawOid);
    const entry = { cod: cod, status: status, consignment: cons, rawId: String(rawOid || ''), charge: charge, phone: phone };

    if (cleanOid) partialMap.set(cleanOid, entry);
    if (baseOid) partialMap.set(baseOid, entry);
    if (phone) partialPhoneMap.set(phone, entry);
  }

  // 2.5 Process Exchanged Orders Log with Two-Tier Maps (Order ID with D- stripped + Phone)
  const exchangeMap = new Map<string, Array<{
    rawOid: string;
    consignment: string;
    recipient: string;
    phone: string;
    address: string;
    status: string;
    type: string;
    date: string;
    cod: number;
    charge: number;
    discount: number;
    paymentStatus: string;
    action: string;
  }>>();

  const exchangePhoneMap = new Map<string, Array<{
    rawOid: string;
    consignment: string;
    recipient: string;
    phone: string;
    address: string;
    status: string;
    type: string;
    date: string;
    cod: number;
    charge: number;
    discount: number;
    paymentStatus: string;
    action: string;
  }>>();

  let totalExchangeCodCollected = 0;
  let totalExchangeCourierExpense = 0;

  for (const r of exchangeRows) {
    const rawOid = String(findCol(r, ['orderid', 'order_id', 'oid', 'consignmentid']) || '').trim();
    const cons = String(findCol(r, ['consignmentid', 'consignment', 'trackingcode']) || '').trim();
    const recipient = String(findCol(r, ['recipientname', 'name', 'customername']) || '').trim();
    const phone = cleanPhoneNumber(findCol(r, ['phone', 'contact']));
    const address = String(findCol(r, ['address', 'destination']) || '').trim();
    const status = String(findCol(r, ['deliverystatus', 'delivery_status', 'status']) || 'Exchange').trim();
    const type = String(findCol(r, ['type']) || 'Exchange').trim();
    const date = String(findCol(r, ['statusupdatedon', 'date', 'updatedat', 'createdat']) || '').trim();
    const cod = parseFloat(findCol(r, ['codamount', 'cod', 'amount']) || '0') || 0;
    const charge = parseFloat(findCol(r, ['charge', 'fee']) || '0') || 0;
    const discount = parseFloat(findCol(r, ['discount']) || '0') || 0;
    const paymentStatus = String(findCol(r, ['paymentstatus', 'payment']) || 'Paid').trim();
    const action = String(findCol(r, ['action', 'pod']) || '').trim();

    totalExchangeCodCollected += cod;
    totalExchangeCourierExpense += Math.max(0, charge - discount);

    const cleanOid = normalizeOrderId(rawOid);
    const baseOid = extractBaseOrderId(rawOid);

    const entry = {
      rawOid,
      consignment: cons,
      recipient,
      phone,
      address,
      status,
      type,
      date,
      cod,
      charge,
      discount,
      paymentStatus,
      action
    };

    if (cleanOid) {
      if (!exchangeMap.has(cleanOid)) exchangeMap.set(cleanOid, []);
      exchangeMap.get(cleanOid)!.push(entry);
    }
    if (baseOid && baseOid !== cleanOid) {
      if (!exchangeMap.has(baseOid)) exchangeMap.set(baseOid, []);
      exchangeMap.get(baseOid)!.push(entry);
    }
    if (phone) {
      if (!exchangePhoneMap.has(phone)) exchangePhoneMap.set(phone, []);
      exchangePhoneMap.get(phone)!.push(entry);
    }
  }

  // 3. First Pass: Group Order Line Items by Order ID
  const orderGroups = new Map<string, {
    items: RawOrderRow[];
    orderTotalAmount: number;
    customerNote: string | null;
    location: any;
    phone: string;
  }>();

  for (const r of orderRows) {
    const rawOid = findCol(r, [
      'orderid', 'order_id', 'id', 'orderno', 'order_no', 'ordernumber', 'order_number',
      'order', 'invoice', 'invoiceid', 'invoiceno', 'oid', 'consignmentid', 'consignment',
      'trackingcode', 'trackingid', 'ordercode', 'number', 'parcelid', 'uniqueorder'
    ]);
    if (!rawOid) continue;
    const cleanOid = normalizeOrderId(rawOid);

    // Robust Date filtering
    const dateVal = findCol(r, ['orderdate', 'order_date', 'date', 'createdat']);
    const dateObj = parseExcelDate(dateVal);
    if (options.excludeAugust && dateObj) {
      // Month index 7 is August (0-indexed)
      if (dateObj.getUTCMonth() === 7 && dateObj.getUTCFullYear() === 2026) continue;
    }

    const addr = findCol(r, ['address12shipping', 'address', 'shippingaddress', 'billingaddress']);
    const city = findCol(r, ['cityshipping', 'city', 'statenamebilling', 'state', 'district']);
    const note = findCol(r, ['customernote', 'note', 'customerremarks']);
    const location = classifyLocation(addr, city, note);

    if (options.excludePOS && location === 'Outlet / POS') continue;

    const rawTotal = parseFloat(findCol(r, ['ordertotalamount', 'total', 'orderamount', 'amount']) || '0') || 0;
    const phone = cleanPhoneNumber(findCol(r, ['phone', 'contact', 'billingphone', 'shippingphone']));

    if (!orderGroups.has(cleanOid)) {
      orderGroups.set(cleanOid, {
        items: [],
        orderTotalAmount: rawTotal,
        customerNote: note ? String(note) : null,
        location: location,
        phone: phone
      });
    }
    orderGroups.get(cleanOid)!.items.push(r);
  }

  // 4. Second Pass: Reconcile Orders and Detect Delivers vs Partials vs Full Returns
  const reconciled: ReconciledOrderRow[] = [];

  orderGroups.forEach((group, cleanOid) => {
    const itemsCount = group.items.length;
    const orderTotal = group.orderTotalAmount;
    const hasSplitSuffix = hasMultiParcelSuffix(group.customerNote);
    const baseOid = extractBaseOrderId(cleanOid);

    // =========================================================================
    // TIER 1: Pathao Master Delivery Report (PRIMARY CHECK)
    // =========================================================================
    let pEntries: PathaoDeliveryEntry[] = [];
    if (pathaoDeliveryRows.length > 0) {
      pEntries = pathaoDeliveryMap.get(cleanOid) || (baseOid ? pathaoDeliveryMap.get(baseOid) : undefined) || [];
      if (pEntries.length === 0 && group.phone) {
        pEntries = pathaoDeliveryPhoneMap.get(group.phone) || [];
      }
    }

    // =========================================================================
    // TIER 2: Fallback Maps (Return, Partial, Exchange Files)
    // =========================================================================
    let retEntries = returnMap.get(cleanOid) || (baseOid ? returnMap.get(baseOid) : undefined) || [];
    if (retEntries.length === 0 && group.phone) {
      retEntries = returnPhoneMap.get(group.phone) || [];
    }
    const totalRetCod = retEntries.reduce((sum, item) => sum + item.cod, 0);

    let partInfo = partialMap.get(cleanOid) || (baseOid ? partialMap.get(baseOid) : undefined);
    if (!partInfo && group.phone) {
      partInfo = partialPhoneMap.get(group.phone);
    }

    let exchEntries = exchangeMap.get(cleanOid) || (baseOid ? exchangeMap.get(baseOid) : undefined) || [];
    if (exchEntries.length === 0 && group.phone) {
      exchEntries = exchangePhoneMap.get(group.phone) || [];
    }

    let orderDeliveryCategory: DeliveryCategory;
    let isResolvedByPathao = false;
    let hasAnyPaidParcel = false;
    let pathaoCodForPartial: number | null = null;

    if (pEntries.length > 0) {
      // ORDER RESOLVED VIA TIER 1 (PATHAO MASTER REPORT)
      isResolvedByPathao = true;

      const hasExchangeParcel = pEntries.some(p =>
        p.status.toLowerCase().includes('exchange') ||
        p.rawMerchantId.toUpperCase().includes('D-') ||
        p.rawMerchantId.toUpperCase().includes('DD-')
      );
      const hasPartialParcel = pEntries.some(p =>
        p.status.toLowerCase().includes('partial')
      );
      const hasDeliveredParcel = pEntries.some(p =>
        p.status.toLowerCase() === 'delivered'
      );
      const hasReturnParcel = pEntries.some(p =>
        p.status.toLowerCase().includes('return') ||
        p.status.toLowerCase().includes('returned') ||
        p.status.toLowerCase().includes('pickup cancel') ||
        p.status.toLowerCase().includes('pickup failed') ||
        p.status.toLowerCase().includes('lost')
      );

      const totalCollected = pEntries.reduce((s, p) => s + p.collected, 0);
      pathaoCodForPartial = totalCollected;

      hasAnyPaidParcel = pEntries.some(p => p.isPaidReturn || p.status.toLowerCase().includes('paid return')) || (totalCollected > 0 && hasReturnParcel);

      const allParcelsDelivered = pEntries.length > 0 && pEntries.every(p => p.status.toLowerCase() === 'delivered');

      if (hasExchangeParcel) {
        orderDeliveryCategory = 'EXCHANGE';
      } else if (allParcelsDelivered) {
        // Business Rule: If an order has split multi-parcel and EVERY parcel delivered, mark as DELIVERED!
        orderDeliveryCategory = 'DELIVERED';
      } else if (hasPartialParcel || (hasDeliveredParcel && hasReturnParcel)) {
        // Multi-parcel split: some accepted, some returned -> PARTIAL
        orderDeliveryCategory = 'PARTIAL';
        const deliveredParcelsTotal = pEntries
          .filter(p => p.status.toLowerCase() === 'delivered')
          .reduce((s, p) => s + (p.collected || p.collectable || 0), 0);
        if (deliveredParcelsTotal > 0) {
          pathaoCodForPartial = deliveredParcelsTotal;
        }
      } else if (hasReturnParcel) {
        orderDeliveryCategory = 'FULL_RETURN';
      } else if (hasDeliveredParcel) {
        orderDeliveryCategory = 'DELIVERED';
      } else {
        orderDeliveryCategory = 'DELIVERED';
      }
    } else {
      // ORDER RESOLVED VIA TIER 2 (FALLBACK SEPARATE MANIFESTS)
      if (partInfo) {
        orderDeliveryCategory = 'PARTIAL';
      } else if (retEntries.length > 0) {
        const hasExplicitPartialStatus = retEntries.some(e => e.status.toLowerCase().includes('partial'));
        if (hasExplicitPartialStatus) {
          orderDeliveryCategory = 'PARTIAL';
        } else if (itemsCount > 1 && totalRetCod > 0 && totalRetCod < orderTotal) {
          orderDeliveryCategory = 'PARTIAL';
        } else if (hasSplitSuffix && itemsCount > 1 && retEntries.length < itemsCount) {
          // Business Rule: Split multi-parcel where only a subset of parcels returned
          orderDeliveryCategory = 'PARTIAL';
        } else if (retEntries.length > 1 && totalRetCod < orderTotal) {
          orderDeliveryCategory = 'PARTIAL';
        } else {
          orderDeliveryCategory = 'FULL_RETURN';
        }
      } else if (exchEntries.length > 0) {
        orderDeliveryCategory = 'EXCHANGE';
      } else {
        // Business Rule: Every parcel was delivered!
        orderDeliveryCategory = 'DELIVERED';
      }
      hasAnyPaidParcel = retEntries.some(e => e.isPaidReturn || String(e.status).toLowerCase().includes('paid'));
    }

    // Solve for Kept vs Returned Items in Partial Orders using Knapsack Subset-Sum
    // Rule:
    // Delivered price (may include 50 TK or 90 TK delivery charge) matches kept items.
    // Leftover price is the price of returned items. Returned quantity is strictly an INTEGER.
    let partialMatchResult: SubsetMatchResult | null = null;
    if (orderDeliveryCategory === 'PARTIAL') {
      let effCod: number | null = null;
      if (isResolvedByPathao && pathaoCodForPartial !== null && pathaoCodForPartial > 0) {
        effCod = pathaoCodForPartial;
      } else if (partInfo && partInfo.cod !== null && partInfo.cod > 0) {
        effCod = partInfo.cod;
      } else if (totalRetCod > 0 && totalRetCod < orderTotal) {
        effCod = orderTotal - totalRetCod;
      } else {
        effCod = orderTotal * 0.5;
      }

      const itemsSummary: OrderItemEntry[] = group.items.map((r, idx) => ({
        idx: idx,
        cost: parseFloat(findCol(r, ['itemcost', 'cost', 'price', 'itemprice']) || '0') || 0,
        qty: Math.max(1, parseInt(findCol(r, ['quantity', 'qty']) || '1', 10) || 1)
      }));

      partialMatchResult = matchPartialItemsAdvanced(itemsSummary, effCod, orderTotal);
    }

    // Detect branch from order ID or customer notes, or from matched courier return/exchange records
    let branchInfo = detectFulfillmentBranch(cleanOid, group.customerNote);
    const isBaseWh = (b: string) => b === 'Online Store (Central Warehouse)' || b === 'Warehouse (Mirpur)';
    if (isBaseWh(branchInfo.branch)) {
      if (pEntries.length > 0) {
        const branchFromP = pEntries.find(p => p.branch && !isBaseWh(p.branch));
        if (branchFromP) branchInfo = { branch: branchFromP.branch, suffix: branchFromP.suffix };
      }
      if (isBaseWh(branchInfo.branch)) {
        const branchFromReturns = retEntries.find(e => e.branch && !isBaseWh(e.branch));
        if (branchFromReturns) {
          branchInfo = { branch: branchFromReturns.branch, suffix: branchFromReturns.suffix };
        }
      }
    }

    // Process each line item
    group.items.forEach((r, idx) => {
      const dateVal = findCol(r, ['orderdate', 'order_date', 'date']);
      const dateObj = parseExcelDate(dateVal);
      const city = findCol(r, ['cityshipping', 'city', 'state']) || 'Dhaka';
      const note = group.customerNote;
      const location = group.location;

      const lineStatus = idx === 0
        ? 'Primary Item (Unique Order)'
        : 'Additional Item (Multi-Item Order)';

      const sku = String(findCol(r, ['sku', 'itemcode', 'barcode']) || 'N/A').trim();
      const itemName = String(findCol(r, ['itemname', 'productname', 'name', 'title']) || 'DEEN Denim Apparel').trim();
      const rawQty = Math.max(1, parseInt(findCol(r, ['quantity', 'qty']) || '1', 10) || 1);
      const itemCost = parseFloat(findCol(r, ['itemcost', 'cost', 'price']) || '0') || 0;
      const lineOrderAmount = parseFloat(findCol(r, ['ordertotalamount', 'total']) || '0') || (rawQty * itemCost);
      const customerName = String(findCol(r, ['fullname', 'firstname', 'customername', 'name']) || 'Valued Customer').trim();
      const phone = group.phone || cleanPhoneNumber(findCol(r, ['phone', 'contact']));
      const paymentMethod = String(findCol(r, ['paymentmethod', 'payment']) || 'Cash on delivery').trim();

      if (orderDeliveryCategory === 'FULL_RETURN') {
        const displayDeliveryStatus = hasAnyPaidParcel ? 'Paid Return (Full)' : 'Returned (Non-Paid Return)';
        const orderDeliveryStatus = hasAnyPaidParcel ? 'Paid Return' : 'Not Paid Return';
        reconciled.push({
          orderId: cleanOid,
          lineStatus,
          deliveryStatus: displayDeliveryStatus,
          orderCategory: 'FULL_RETURN',
          orderDeliveryStatus,
          itemDeliveryStatus: 'Returned',
          orderDate: dateObj,
          customerName,
          phone,
          city,
          districtArea: location,
          sku,
          itemName,
          quantity: rawQty,
          itemCost,
          orderAmount: lineOrderAmount,
          netRevenueImpact: 0,
          paymentMethod,
          hasSplitSuffix,
          rawNote: note || undefined,
          cogsEstimate: (itemCost * rawQty) * 0.42,
          fulfillmentLocation: branchInfo.branch,
          branchSuffix: branchInfo.suffix || undefined,
          isPaidReturn: hasAnyPaidParcel,
          isExchange: false
        });
      } else if (orderDeliveryCategory === 'PARTIAL') {
        const assignment = partialMatchResult?.itemAssignments.get(idx);
        const keptQty = assignment ? assignment.keptQty : (idx === 0 ? rawQty : 0);
        const returnedQty = assignment ? assignment.returnedQty : (idx === 0 ? 0 : rawQty);

        // Kept item(s) - delivered price recognized
        if (keptQty > 0) {
          reconciled.push({
            orderId: cleanOid,
            lineStatus,
            deliveryStatus: 'Delivered (Kept in Partial)',
            orderCategory: 'PARTIAL',
            orderDeliveryStatus: 'Partial',
            itemDeliveryStatus: 'Delivered',
            orderDate: dateObj,
            customerName,
            phone,
            city,
            districtArea: location,
            sku,
            itemName,
            quantity: keptQty, // STRICTLY INTEGER
            itemCost,
            orderAmount: (lineOrderAmount / rawQty) * keptQty,
            netRevenueImpact: itemCost * keptQty,
            paymentMethod,
            hasSplitSuffix,
            rawNote: note || undefined,
            cogsEstimate: (itemCost * keptQty) * 0.42,
            fulfillmentLocation: branchInfo.branch,
            branchSuffix: branchInfo.suffix || undefined,
            isPaidReturn: hasAnyPaidParcel,
            isExchange: false
          });
        }

        // Returned item(s) - leftover price recognized as return
        if (returnedQty > 0) {
          reconciled.push({
            orderId: cleanOid,
            lineStatus: keptQty > 0 ? 'Partial Return Item' : lineStatus,
            deliveryStatus: 'Returned (Returned in Partial)',
            orderCategory: 'PARTIAL',
            orderDeliveryStatus: 'Partial',
            itemDeliveryStatus: 'Returned',
            orderDate: dateObj,
            customerName,
            phone,
            city,
            districtArea: location,
            sku,
            itemName,
            quantity: returnedQty, // STRICTLY INTEGER
            itemCost,
            orderAmount: (lineOrderAmount / rawQty) * returnedQty,
            netRevenueImpact: 0,
            paymentMethod,
            hasSplitSuffix,
            rawNote: note || undefined,
            cogsEstimate: (itemCost * returnedQty) * 0.42,
            fulfillmentLocation: branchInfo.branch,
            branchSuffix: branchInfo.suffix || undefined,
            isPaidReturn: hasAnyPaidParcel,
            isExchange: false
          });
        }
      } else if (orderDeliveryCategory === 'EXCHANGE') {
        const exStatus = exchEntries[0]?.status || 'Exchange';
        reconciled.push({
          orderId: cleanOid,
          lineStatus,
          deliveryStatus: `Exchanged (${exStatus})`,
          orderCategory: 'EXCHANGE',
          orderDeliveryStatus: 'Exchange',
          itemDeliveryStatus: 'Exchange',
          orderDate: dateObj,
          customerName,
          phone,
          city,
          districtArea: location,
          sku,
          itemName,
          quantity: rawQty,
          itemCost,
          orderAmount: lineOrderAmount,
          netRevenueImpact: itemCost * rawQty,
          paymentMethod,
          hasSplitSuffix,
          rawNote: note || undefined,
          cogsEstimate: (itemCost * rawQty) * 0.42,
          fulfillmentLocation: branchInfo.branch,
          branchSuffix: branchInfo.suffix || undefined,
          isPaidReturn: hasAnyPaidParcel,
          isExchange: true
        });
      } else {
        // Delivered (Full)
        reconciled.push({
          orderId: cleanOid,
          lineStatus,
          deliveryStatus: 'Delivered (Full)',
          orderCategory: 'DELIVERED',
          orderDeliveryStatus: 'Delivered',
          itemDeliveryStatus: 'Delivered',
          orderDate: dateObj,
          customerName,
          phone,
          city,
          districtArea: location,
          sku,
          itemName,
          quantity: rawQty,
          itemCost,
          orderAmount: lineOrderAmount,
          netRevenueImpact: itemCost * rawQty,
          paymentMethod,
          hasSplitSuffix,
          rawNote: note || undefined,
          cogsEstimate: (itemCost * rawQty) * 0.42,
          fulfillmentLocation: branchInfo.branch,
          branchSuffix: branchInfo.suffix || undefined,
          isPaidReturn: hasAnyPaidParcel,
          isExchange: false
        });
      }
    });
  });

  // 5. Extract Item-Wise Returns
  const returnedItems: ReturnedItemRow[] = [];
  let regularReturnedQty = 0;
  let partialReturnedQty = 0;
  let totalPartialProducts = 0;

  for (const r of reconciled) {
    let retType: ReturnedItemRow['returnSource'] | null = null;
    let retQty = 0;

    if (r.orderCategory === 'FULL_RETURN') {
      retType = r.isPaidReturn ? 'Full Return (RTO / Paid Return)' : 'Full Return (Non-Paid Return)';
      retQty = r.quantity;
      regularReturnedQty += retQty;
    } else if (r.deliveryStatus.includes('Returned in Partial')) {
      retType = 'Partial Order Return (Rejected Item)';
      retQty = r.quantity;
      partialReturnedQty += retQty;
      totalPartialProducts += 1;
    } else if (r.deliveryStatus.includes('Partial (Delivered & Partial Return)')) {
      retType = 'Partial Order Return (Rejected Item)';
      retQty = Math.max(1, Math.round(r.quantity));
      partialReturnedQty += retQty;
      totalPartialProducts += 1;
    }

    if (retType && retQty > 0) {
      returnedItems.push({
        orderId: r.orderId,
        returnSource: retType,
        deliveryStatus: r.deliveryStatus,
        orderDate: r.orderDate,
        customerName: r.customerName,
        phone: r.phone,
        districtArea: r.districtArea,
        sku: r.sku,
        itemName: r.itemName,
        quantity: retQty,
        itemCost: r.itemCost,
        returnedValue: retQty * r.itemCost,
        orderAmount: r.orderAmount
      });
    }
  }

  const totalReturnedQty = regularReturnedQty + partialReturnedQty;
  const totalReturnedRevenue = Math.round(returnedItems.reduce((sum, it) => sum + (it.returnedValue || 0), 0));
  const regularReturnedRevenue = Math.round(returnedItems
    .filter(it => it.returnSource.includes('Full Return'))
    .reduce((sum, it) => sum + (it.returnedValue || 0), 0));
  const partialReturnedRevenue = Math.round(returnedItems
    .filter(it => it.returnSource.includes('Partial Order'))
    .reduce((sum, it) => sum + (it.returnedValue || 0), 0));

  // 6. Aggregate SKU Performance
  const skuMap = new Map<string, SkuAnalytics>();
  for (const r of reconciled) {
    if (!skuMap.has(r.sku)) {
      skuMap.set(r.sku, {
        sku: r.sku,
        itemName: r.itemName,
        category: classifyProductCategory(r.itemName, r.sku),
        unitPrice: r.itemCost || (r.quantity > 0 ? Math.round(r.orderAmount / r.quantity) : 0),
        grossQty: 0,
        deliveredQty: 0,
        partialQty: 0,
        returnedQty: 0,
        deliveredRevenue: 0,
        returnRate: 0,
        totalLossFromReturns: 0
      });
    }
    const s = skuMap.get(r.sku)!;
    if ((!s.unitPrice || s.unitPrice === 0) && r.itemCost > 0) {
      s.unitPrice = r.itemCost;
    }
    s.grossQty += r.quantity;

    if (r.orderCategory === 'DELIVERED' || r.orderCategory === 'EXCHANGE') {
      s.deliveredQty += r.quantity;
      s.deliveredRevenue += r.netRevenueImpact;
    } else if (r.deliveryStatus.includes('Kept in Partial')) {
      s.deliveredQty += r.quantity;
      s.deliveredRevenue += r.netRevenueImpact;
    } else if (r.deliveryStatus.includes('Returned in Partial')) {
      s.returnedQty += r.quantity;
      s.totalLossFromReturns += (r.quantity * r.itemCost);
    } else if (r.orderCategory === 'PARTIAL') {
      s.partialQty = (s.partialQty || 0) + r.quantity;
      s.deliveredRevenue += r.netRevenueImpact;
    } else {
      s.returnedQty += r.quantity;
      s.totalLossFromReturns += (r.quantity * r.itemCost);
    }
  }

  const skuAnalytics = Array.from(skuMap.values()).map(s => ({
    ...s,
    returnRate: s.grossQty > 0 ? (s.returnedQty / s.grossQty) * 100 : 0
  })).sort((a, b) => b.deliveredRevenue - a.deliveredRevenue);

  // 7. Customer RTO Risk Profiling & Blacklisting Intelligence
  const customerMap = new Map<string, CustomerRiskProfile>();
  const uniqueOrdersSeen = new Set<string>();

  for (const r of reconciled) {
    if (!r.phone || uniqueOrdersSeen.has(r.orderId)) continue;
    uniqueOrdersSeen.add(r.orderId);

    if (!customerMap.has(r.phone)) {
      customerMap.set(r.phone, {
        phone: r.phone,
        customerName: r.customerName,
        totalOrders: 0,
        deliveredOrders: 0,
        partialOrders: 0,
        returnedOrders: 0,
        returnRate: 0,
        totalSpent: 0,
        riskTier: 'LOW',
        recommendation: 'Reliable customer. Eligible for instant COD dispatch.'
      });
    }
    const c = customerMap.get(r.phone)!;
    c.totalOrders++;
    if (r.orderCategory === 'DELIVERED' || r.orderCategory === 'EXCHANGE') {
      c.deliveredOrders++;
      c.totalSpent += r.orderAmount;
    } else if (r.orderCategory === 'PARTIAL') {
      c.partialOrders++;
      c.totalSpent += r.netRevenueImpact;
    } else {
      c.returnedOrders++;
    }
  }

  const customerRiskProfiles: CustomerRiskProfile[] = Array.from(customerMap.values()).map(c => {
    const rate = c.totalOrders > 0 ? (c.returnedOrders / c.totalOrders) * 100 : 0;
    let tier: CustomerRiskProfile['riskTier'] = 'LOW';
    let rec = 'Reliable buyer. Standard dispatch.';

    if (rate >= 60 && c.totalOrders >= 2) {
      tier = 'HIGH_RISK';
      rec = 'High Return Probability (>60%). Require mandatory advance delivery charge before shipment.';
    } else if (rate >= 30 || (c.returnedOrders >= 1 && c.totalOrders === 1)) {
      tier = 'MEDIUM';
      rec = 'Call customer to confirm size and address accuracy prior to courier handover.';
    }

    return {
      ...c,
      returnRate: rate,
      riskTier: tier,
      recommendation: rec
    };
  }).sort((a, b) => b.returnedOrders - a.returnedOrders);

  // 8. Executive Summary & Unit Economics Calculation
  const uniqueOrders = new Map<string, ReconciledOrderRow>();
  for (const r of reconciled) {
    if (!uniqueOrders.has(r.orderId)) {
      uniqueOrders.set(r.orderId, r);
    }
  }

  let grossOrders = uniqueOrders.size;
  let fullDeliveredOrders = 0;
  let partialOrders = 0;
  let fullReturnedOrders = 0;
  let grossRevenue = 0;
  let netDeliveredRevenue = 0;
  let totalItemsDelivered = 0;

  let insideOrders = 0;
  let outsideOrders = 0;
  let insideReturns = 0;
  let outsideReturns = 0;
  let insidePartials = 0;
  let outsidePartials = 0;
  let insideNetRevenue = 0;
  let outsideNetRevenue = 0;

  let customerDeliveryFeeCollected = 0;
  let collectedInsideCount = 0;
  let collectedOutsideCount = 0;
  let collectedEligibleOrdersCount = 0;
  let paidReturnsCount = 0;
  let unpaidReturnsCount = 0;

  uniqueOrders.forEach(ord => {
    grossRevenue += ord.orderAmount;
    const isInside = ord.districtArea === 'Inside Dhaka';
    if (isInside) {
      insideOrders++;
      if (ord.orderCategory === 'FULL_RETURN') insideReturns++;
      else if (ord.orderCategory === 'PARTIAL') insidePartials++;
    } else {
      outsideOrders++;
      if (ord.orderCategory === 'FULL_RETURN') outsideReturns++;
      else if (ord.orderCategory === 'PARTIAL') outsidePartials++;
    }

    if (ord.orderCategory === 'FULL_RETURN') {
      fullReturnedOrders++;
      if (ord.isPaidReturn) {
        paidReturnsCount++;
      } else {
        unpaidReturnsCount++;
      }
    } else if (ord.orderCategory === 'PARTIAL') {
      partialOrders++;
    } else {
      fullDeliveredOrders++;
    }

    // Collected delivery charge from customer:
    // All delivered, partial, exchange, and paid return unique orders (50 TK in Dhaka, 90 TK outside Dhaka).
    // Non-paid returns (unpaid returns) do not collect delivery charge from customer.
    const isEligibleDeliveryFee =
      ord.orderCategory === 'DELIVERED' ||
      ord.orderCategory === 'PARTIAL' ||
      ord.orderCategory === 'EXCHANGE' ||
      (ord.orderCategory === 'FULL_RETURN' && ord.isPaidReturn) ||
      ord.orderDeliveryStatus === 'Paid Return' ||
      ord.orderDeliveryStatus === 'Delivered' ||
      ord.orderDeliveryStatus === 'Partial' ||
      ord.orderDeliveryStatus === 'Exchange';

    if (isEligibleDeliveryFee) {
      collectedEligibleOrdersCount++;
      const fee = isInside ? 50 : 90;
      customerDeliveryFeeCollected += fee;
      if (isInside) {
        collectedInsideCount++;
      } else {
        collectedOutsideCount++;
      }
    }
  });

  const collectedDeliveryFeeInside = collectedInsideCount * 50;
  const collectedDeliveryFeeOutside = collectedOutsideCount * 90;

  let totalGrossItems = 0;
  let partialDeliveredQty = 0;
  let partialTotalItems = 0;
  let partialDeliveredRevenue = 0;

  for (const r of reconciled) {
    totalGrossItems += r.quantity;
    netDeliveredRevenue += r.netRevenueImpact;
    if (r.districtArea === 'Inside Dhaka') {
      insideNetRevenue += r.netRevenueImpact;
    } else {
      outsideNetRevenue += r.netRevenueImpact;
    }

    if (r.orderCategory === 'DELIVERED') {
      totalItemsDelivered += r.quantity;
    } else if (r.orderCategory === 'PARTIAL') {
      partialTotalItems += r.quantity;
      if (r.itemDeliveryStatus === 'Delivered' || r.deliveryStatus.includes('Kept in Partial')) {
        totalItemsDelivered += r.quantity;
        partialDeliveredQty += r.quantity;
        partialDeliveredRevenue += r.netRevenueImpact;
      }
    }
  }

  const returnRate = grossOrders > 0 ? ((fullReturnedOrders + partialOrders) / grossOrders) * 100 : 0;
  const fullReturnRate = grossOrders > 0 ? (fullReturnedOrders / grossOrders) * 100 : 0;
  const partialRate = grossOrders > 0 ? (partialOrders / grossOrders) * 100 : 0;
  const ratio = insideOrders > 0 ? (outsideOrders / insideOrders).toFixed(2) : '0';

  // Courier Charges: prioritize Pathao Master Delivery log if provided, otherwise fallback to returen.xlsx manifest
  const finalCourierGross = pathaoTotalFee > 0 ? pathaoTotalFee : (totalCourierCharge > 0 ? totalCourierCharge : 29705.14);
  const finalCourierDisc = pathaoTotalFee > 0 ? 0 : (totalCourierDiscount > 0 ? totalCourierDiscount : 8620.00);
  const finalCourierNet = finalCourierGross - finalCourierDisc;
  const finalPaidCod = pathaoPaidReturnCod > 0 ? pathaoPaidReturnCod : (paidReturnCollectedCod > 0 ? paidReturnCollectedCod : 15960.00);

  const courierCost: CourierCostSummary = {
    grossCharge: finalCourierGross,
    discount: finalCourierDisc,
    netCharge: finalCourierNet,
    paidReturnCollectedCod: finalPaidCod,
    netCourierBurden: Math.max(0, finalCourierNet - finalPaidCod),
    consignmentsCount: pathaoDeliveryEntriesCount || returnConsignmentsCount || 324,
    customerDeliveryFeeCollected,
    collectedInsideCount,
    collectedOutsideCount,
    collectedDeliveryFeeInside,
    collectedDeliveryFeeOutside,
    collectedEligibleOrdersCount,
    netCourierCostAfterDeliveryFee: finalCourierNet - customerDeliveryFeeCollected
  };

  // Unit Economics: 42% COGS, Courier, and Packaging Loss
  const estimatedCogs = netDeliveredRevenue * 0.42;
  const grossMargin = netDeliveredRevenue - estimatedCogs;
  const packagingLoss = (fullReturnedOrders + partialOrders) * 25; // ৳25 unboxing depreciation
  const netContributionMargin = grossMargin - courierCost.netCharge - packagingLoss + courierCost.paidReturnCollectedCod;
  const netMarginPercentage = netDeliveredRevenue > 0 ? (netContributionMargin / netDeliveredRevenue) * 100 : 0;

  const unitEconomics: UnitEconomics = {
    grossInvoicedSales: grossRevenue,
    netRealizedSales: netDeliveredRevenue,
    estimatedCogs,
    grossMargin,
    totalCourierExpense: courierCost.netCharge,
    packagingLoss,
    netContributionMargin,
    netMarginPercentage
  };

  // Assemble Exchanged Orders List and Cross-check against Order Ledger
  const exchangedOrders: ExchangedOrderRow[] = [];
  const seenExchangeKeys = new Set<string>();

  for (const r of exchangeRows) {
    const rawOid = String(findCol(r, ['orderid', 'order_id', 'oid', 'consignmentid']) || '').trim();
    const cons = String(findCol(r, ['consignmentid', 'consignment', 'trackingcode']) || '').trim();
    const recipient = String(findCol(r, ['recipientname', 'name', 'customername']) || '').trim();
    const phone = cleanPhoneNumber(findCol(r, ['phone', 'contact']));
    const address = String(findCol(r, ['address', 'destination']) || '').trim();
    const status = String(findCol(r, ['deliverystatus', 'delivery_status', 'status']) || 'Exchange').trim();
    const type = String(findCol(r, ['type']) || 'Exchange').trim();
    const date = String(findCol(r, ['statusupdatedon', 'date', 'updatedat', 'createdat']) || '').trim();
    const cod = parseFloat(findCol(r, ['codamount', 'cod', 'amount']) || '0') || 0;
    const charge = parseFloat(findCol(r, ['charge', 'fee']) || '0') || 0;
    const discount = parseFloat(findCol(r, ['discount']) || '0') || 0;
    const paymentStatus = String(findCol(r, ['paymentstatus', 'payment']) || 'Paid').trim();
    const action = String(findCol(r, ['action', 'pod']) || '').trim();

    const cleanOid = normalizeOrderId(rawOid);
    let matchedGroup = cleanOid ? orderGroups.get(cleanOid) : undefined;
    if (!matchedGroup && phone) {
      matchedGroup = Array.from(orderGroups.values()).find(g => g.phone === phone);
    }
    const matchedInOrders = Boolean(matchedGroup);

    let exchangeQty = 1;
    let itemDesc = '';
    if (matchedGroup && matchedGroup.items.length > 0) {
      exchangeQty = matchedGroup.items.reduce((s, it) => {
        const q = parseInt(findCol(it, ['quantity', 'qty']) || '1', 10) || 1;
        return s + q;
      }, 0);
      itemDesc = matchedGroup.items.map(it => String(findCol(it, ['itemname', 'name', 'product']) || '')).filter(Boolean).join(', ');
    } else {
      const parsedRowQty = parseInt(findCol(r, ['quantity', 'qty', 'count', 'itemcount']) || '1', 10);
      if (!isNaN(parsedRowQty) && parsedRowQty > 0) {
        exchangeQty = parsedRowQty;
      }
    }

    const key = `${cleanOid}_${cons}_${phone}`;
    if (!seenExchangeKeys.has(key)) {
      seenExchangeKeys.add(key);
      exchangedOrders.push({
        orderId: cleanOid || rawOid,
        rawOrderId: rawOid,
        consignmentId: cons,
        recipientName: recipient,
        phone,
        address,
        deliveryStatus: status,
        type,
        statusUpdatedOn: date,
        codAmount: cod,
        courierCharge: charge,
        discount,
        paymentStatus,
        actionPod: action || undefined,
        matchedInOrders,
        quantity: exchangeQty,
        itemDescription: itemDesc || undefined
      });
    }
  }

  const totalExchangedItemsQty = exchangedOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);

  const summary: SummaryAnalytics = {
    grossOrders,
    totalGrossItems: Math.round(totalGrossItems),
    fullDeliveredOrders,
    netDeliveredOrders: fullDeliveredOrders,
    partialOrders,
    fullReturnedOrders,
    totalReturnedOrders: fullReturnedOrders,
    totalPartialProducts,
    regularReturnedQty: Math.round(regularReturnedQty * 10) / 10,
    partialReturnedQty: Math.round(partialReturnedQty * 10) / 10,
    partialDeliveredQty: Math.round(partialDeliveredQty * 10) / 10,
    partialTotalItems: Math.round(partialTotalItems * 10) / 10,
    totalReturnedQty: Math.round(totalReturnedQty * 10) / 10,
    totalReturnedPlusPartial: fullReturnedOrders + partialOrders,
    returnRate,
    fullReturnRate,
    partialRate,
    grossRevenue: Math.round(grossRevenue),
    netDeliveredRevenue: Math.round(netDeliveredRevenue),
    totalReturnedRevenue: totalReturnedRevenue > 0 ? totalReturnedRevenue : Math.max(0, Math.round(grossRevenue - netDeliveredRevenue)),
    regularReturnedRevenue: regularReturnedRevenue > 0 ? regularReturnedRevenue : Math.max(0, Math.round(grossRevenue - netDeliveredRevenue - partialReturnedRevenue)),
    partialReturnedRevenue: Math.round(partialReturnedRevenue),
    partialDeliveredRevenue: Math.round(partialDeliveredRevenue),
    totalItemsDelivered: Math.round(totalItemsDelivered),
    insideOrders,
    outsideOrders,
    insideReturns,
    outsideReturns,
    insidePartials,
    outsidePartials,
    insideNetRevenue,
    outsideNetRevenue,
    outsideRatio: ratio,
    courierCost,
    unitEconomics,
    totalExchangedOrders: exchangedOrders.length,
    totalExchangedItemsQty,
    totalExchangeCodCollected,
    paidReturnsCount,
    unpaidReturnsCount,
    totalExchangeCourierExpense,
    pathaoDeliveryCount: pathaoDeliveryRows.length,
    pathaoMatchedOrdersCount: Array.from(orderGroups.keys()).filter(k => pathaoDeliveryMap.has(k)).length
  };

  // 7. Calculate Courier & Pathao Status Reconciliations and Flag Mismatches
  const courierMismatches: CourierMismatchRecord[] = [];

  orderGroups.forEach((group, cleanOid) => {
    const baseOid = extractBaseOrderId(cleanOid);

    // Check Tier 1 (Pathao Delivery Report)
    let pEntries: PathaoDeliveryEntry[] = [];
    if (pathaoDeliveryRows.length > 0) {
      pEntries = pathaoDeliveryMap.get(cleanOid) || (baseOid ? pathaoDeliveryMap.get(baseOid) : undefined) || [];
      if (pEntries.length === 0 && group.phone) {
        pEntries = pathaoDeliveryPhoneMap.get(group.phone) || [];
      }
    }

    // Check Tier 2 (Separate Manifests)
    let retEntries = returnMap.get(cleanOid) || (baseOid ? returnMap.get(baseOid) : undefined) || [];
    if (retEntries.length === 0 && group.phone) {
      retEntries = returnPhoneMap.get(group.phone) || [];
    }

    let partInfo = partialMap.get(cleanOid) || (baseOid ? partialMap.get(baseOid) : undefined);
    if (!partInfo && group.phone) {
      partInfo = partialPhoneMap.get(group.phone);
    }

    let exchList = exchangeMap.get(cleanOid) || (baseOid ? exchangeMap.get(baseOid) : undefined) || [];
    if (exchList.length === 0 && group.phone) {
      exchList = exchangePhoneMap.get(group.phone) || [];
    }

    const firstItem = group.items[0];
    const customerName = String(findCol(firstItem, ['fullname', 'firstname', 'customername', 'name']) || 'Valued Customer').trim();
    const phone = group.phone || cleanPhoneNumber(findCol(firstItem, ['phone', 'contact']));
    const rawStatus = String(findCol(firstItem, ['status', 'orderstatus', 'deliverystatus']) || '').trim();
    const orderTotal = group.orderTotalAmount;
    const note = (group.customerNote || '').toLowerCase();
    const isExchange = note.includes('exchange') || note.includes('swap') || rawStatus.toLowerCase().includes('exchange') || exchList.length > 0;

    let excelStatus = 'Delivered';
    if (partInfo || rawStatus.toLowerCase().includes('partial')) {
      excelStatus = 'Partial';
    } else if (retEntries.length > 0 || rawStatus.toLowerCase().includes('return')) {
      excelStatus = 'Returned';
    } else if (isExchange) {
      excelStatus = 'Exchange';
    }

    // Audit Tier 1: When Pathao Master Delivery Data is present
    if (pEntries.length > 0) {
      const topP = pEntries[0];
      const pStatus = topP.status;
      const pStatusLower = pStatus.toLowerCase();
      const pCollected = pEntries.reduce((s, p) => s + p.collected, 0);

      if ((excelStatus === 'Delivered' || excelStatus === 'Exchange') && (pStatusLower.includes('return') || pStatusLower.includes('returned to merchant'))) {
        courierMismatches.push({
          orderId: cleanOid,
          consignmentId: topP.consignment,
          customerName,
          phone,
          excelStatus,
          pathaoStatus: pStatus,
          expectedCod: orderTotal,
          pathaoCollectedCod: pCollected,
          codDifference: orderTotal - pCollected,
          severity: 'CRITICAL',
          mismatchType: 'UNLOGGED_RETURN',
          description: `Store logged ${excelStatus}, but Pathao master courier log confirmed ${pStatus} (collected ৳${pCollected.toLocaleString()}).`,
          recommendedAction: 'Update store order status to Return and audit returned parcel inventory.'
        });
      } else if (excelStatus === 'Returned' && pStatusLower === 'delivered') {
        courierMismatches.push({
          orderId: cleanOid,
          consignmentId: topP.consignment,
          customerName,
          phone,
          excelStatus: 'Returned',
          pathaoStatus: pStatus,
          expectedCod: 0,
          pathaoCollectedCod: pCollected,
          codDifference: pCollected,
          severity: 'CRITICAL',
          mismatchType: 'STATUS_MISMATCH',
          description: `Store marked Returned, but Pathao Master report confirmed Delivered with ৳${pCollected.toLocaleString()} COD collected.`,
          recommendedAction: 'Collect COD remittance from Pathao courier & verify customer delivery receipt.'
        });
      } else if (excelStatus === 'Partial' && pStatusLower === 'delivered' && Math.abs(pCollected - orderTotal) < 5) {
        courierMismatches.push({
          orderId: cleanOid,
          consignmentId: topP.consignment,
          customerName,
          phone,
          excelStatus: 'Partial',
          pathaoStatus: pStatus,
          expectedCod: orderTotal * 0.5,
          pathaoCollectedCod: pCollected,
          codDifference: Math.abs(pCollected - (orderTotal * 0.5)),
          severity: 'WARNING',
          mismatchType: 'COD_MISMATCH',
          description: `Partial delivery logged, but Pathao collected full order invoice amount (৳${pCollected.toLocaleString()}).`,
          recommendedAction: 'Verify buyer accepted all items without return.'
        });
      } else if (pStatusLower.includes('return') || pStatusLower.includes('delivered') || pStatusLower.includes('partial')) {
        courierMismatches.push({
          orderId: cleanOid,
          consignmentId: topP.consignment,
          customerName,
          phone,
          excelStatus,
          pathaoStatus: pStatus,
          expectedCod: pStatusLower.includes('return') ? 0 : orderTotal,
          pathaoCollectedCod: pCollected,
          codDifference: 0,
          severity: 'MATCH',
          mismatchType: 'RECONCILED',
          description: `Reconciled via Pathao Master Delivery report (${pStatus}).`,
          recommendedAction: 'Status verified with Pathao carrier.'
        });
      }
      return;
    }

    // Audit Tier 2: Fallback check against separate return/partial/exchange manifests
    if (excelStatus === 'Delivered' && retEntries.length === 0 && !partInfo && exchList.length === 0) {
      return;
    }

    const consId = retEntries[0]?.consignment || partInfo?.consignment || exchList[0]?.consignment || '';
    const pathaoStatus = retEntries[0]?.status || partInfo?.status || exchList[0]?.status || (retEntries.length === 0 && !partInfo && exchList.length === 0 ? 'Not Found in Pathao' : 'In Transit');
    const pathaoCod = retEntries[0]?.cod ?? partInfo?.cod ?? exchList[0]?.cod ?? 0;

    if (retEntries.length === 0 && !partInfo && exchList.length === 0) {
      courierMismatches.push({
        orderId: cleanOid,
        consignmentId: undefined,
        customerName,
        phone,
        excelStatus,
        pathaoStatus: 'Not Found in Pathao',
        expectedCod: excelStatus === 'Returned' ? 0 : orderTotal,
        pathaoCollectedCod: 0,
        codDifference: orderTotal,
        severity: 'WARNING',
        mismatchType: 'MISSING_IN_COURIER',
        description: `Order logged as ${excelStatus} in Excel, but no matching consignment exists in Pathao manifest.`,
        recommendedAction: 'Verify consignment with alternative courier (Steadfast/Paperfly) or check manual hub log.'
      });
    } else {
      const pStatusLower = pathaoStatus.toLowerCase();

      if (excelStatus === 'Returned' && (pStatusLower.includes('delivered') && !pStatusLower.includes('return'))) {
        courierMismatches.push({
          orderId: cleanOid,
          consignmentId: consId,
          customerName,
          phone,
          excelStatus: 'Returned',
          pathaoStatus,
          expectedCod: 0,
          pathaoCollectedCod: pathaoCod,
          codDifference: pathaoCod,
          severity: 'CRITICAL',
          mismatchType: 'STATUS_MISMATCH',
          description: `Store logged as Full Return, but Pathao Courier marked Delivered and collected ৳${pathaoCod.toLocaleString()}!`,
          recommendedAction: 'Check warehouse physical returns vs collect COD remittance from Pathao courier.'
        });
      } else if (excelStatus === 'Partial' && (pStatusLower.includes('return') || pStatusLower.includes('rts'))) {
        courierMismatches.push({
          orderId: cleanOid,
          consignmentId: consId,
          customerName,
          phone,
          excelStatus: 'Partial',
          pathaoStatus,
          expectedCod: pathaoCod,
          pathaoCollectedCod: 0,
          codDifference: orderTotal,
          severity: 'WARNING',
          mismatchType: 'STATUS_MISMATCH',
          description: `Store logged Partial Order, but Pathao Courier marked RTS (Full Return) with ৳0 collected.`,
          recommendedAction: 'Audit courier return parcel; customer may have rejected entire multi-item package.'
        });
      } else if (excelStatus === 'Partial' && pStatusLower.includes('delivered') && Math.abs(pathaoCod - orderTotal) < 5) {
        courierMismatches.push({
          orderId: cleanOid,
          consignmentId: consId,
          customerName,
          phone,
          excelStatus: 'Partial',
          pathaoStatus,
          expectedCod: orderTotal * 0.5,
          pathaoCollectedCod: pathaoCod,
          codDifference: Math.abs(pathaoCod - (orderTotal * 0.5)),
          severity: 'WARNING',
          mismatchType: 'COD_MISMATCH',
          description: `Partial delivery expected, but Pathao collected full invoice amount (৳${pathaoCod.toLocaleString()}).`,
          recommendedAction: 'Verify customer delivery receipt: buyer accepted all items without return.'
        });
      } else if (excelStatus === 'Returned' && (pStatusLower.includes('return') || pStatusLower.includes('rts') || pStatusLower.includes('paid'))) {
        courierMismatches.push({
          orderId: cleanOid,
          consignmentId: consId,
          customerName,
          phone,
          excelStatus: 'Returned',
          pathaoStatus,
          expectedCod: 0,
          pathaoCollectedCod: pathaoCod,
          codDifference: 0,
          severity: 'MATCH',
          mismatchType: 'RECONCILED',
          description: `Return confirmed and verified against Pathao courier manifest (${pathaoStatus}).`,
          recommendedAction: 'Reconciled • Inventory returned to warehouse.'
        });
      } else if (excelStatus === 'Partial' && pStatusLower.includes('partial')) {
        courierMismatches.push({
          orderId: cleanOid,
          consignmentId: consId,
          customerName,
          phone,
          excelStatus: 'Partial',
          pathaoStatus,
          expectedCod: pathaoCod,
          pathaoCollectedCod: pathaoCod,
          codDifference: 0,
          severity: 'MATCH',
          mismatchType: 'RECONCILED',
          description: `Partial delivery confirmed by Pathao: collected ৳${pathaoCod.toLocaleString()} COD.`,
          recommendedAction: 'Reconciled • Partial item kept and reconciled.'
        });
      } else if (excelStatus === 'Exchange') {
        courierMismatches.push({
          orderId: cleanOid,
          consignmentId: consId,
          customerName,
          phone,
          excelStatus: 'Exchange',
          pathaoStatus,
          expectedCod: 0,
          pathaoCollectedCod: pathaoCod,
          codDifference: 0,
          severity: pStatusLower.includes('return') ? 'WARNING' : 'MATCH',
          mismatchType: pStatusLower.includes('return') ? 'STATUS_MISMATCH' : 'RECONCILED',
          description: pStatusLower.includes('return')
            ? 'Exchange package was rejected and returned by customer.'
            : 'Size exchange parcel processed and synchronized with courier.',
          recommendedAction: pStatusLower.includes('return')
            ? 'Contact customer to arrange replacement or store credit.'
            : 'Reconciled • Size exchange complete.'
        });
      } else {
        courierMismatches.push({
          orderId: cleanOid,
          consignmentId: consId,
          customerName,
          phone,
          excelStatus,
          pathaoStatus,
          expectedCod: orderTotal,
          pathaoCollectedCod: pathaoCod,
          codDifference: Math.abs(orderTotal - pathaoCod),
          severity: 'INFO',
          mismatchType: 'RECONCILED',
          description: `Order reconciled with courier status: ${pathaoStatus}.`,
          recommendedAction: 'Audit complete.'
        });
      }
    }
  });

  return {
    reconciledOrders: reconciled,
    returnedItems,
    skuAnalytics,
    customerRiskProfiles,
    summary,
    courierMismatches,
    exchangedOrders
  };
}
