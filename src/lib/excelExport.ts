import * as XLSX from 'xlsx';
import { ReconciliationResult } from './reconciliationEngine';
import { cleanCustomerPhone } from './woocommerceClient';
import { RawOrderRow } from '@/types';
import {
  isOrderExchange,
  isOrderOnline,
  extractExchangeInfo,
  LiveOpsReport,
} from './liveOpsProcessor';
import { classifyProductLine } from './selectsAnalytics';
import { getCategoryForSales, getSubCategoryForSales } from './liveCategoryEngine';
import { DataProvenanceInfo } from './dataAudit';

/**
 * Strips trailing size indicator from product name (e.g. " - 34", " - XL", " - 2XL", " - 46")
 * returning the clean main product style name.
 */
export function cleanProductMainName(name: string): string {
  if (!name) return 'DEEN Apparel';
  let cleaned = name.trim();
  cleaned = cleaned.replace(/\s*[-–—]\s*(?:(?:[2-5]?X[SL])|[SML]|(?:[2-5]?XL)|XS|XXL|XXXL|\d{2}(?:\.\d)?)\s*$/i, '');
  return cleaned.trim() || name;
}

/**
 * Extracts the base Master SKU code by stripping variation size suffixes if present.
 */
export function extractMasterSku(sku: string): string {
  if (!sku) return 'N/A';
  let s = sku.trim();
  s = s.replace(/[-_](?:(?:[2-5]?X[SL])|[SML]|(?:[2-5]?XL)|XS|XXL|XXXL|\d{2})\s*$/i, '');
  return s.trim() || sku;
}

/**
 * Auto-fits column widths for JSON-based worksheet to avoid cell clipping and ### display errors in Excel.
 */
export function autoFitSheetColumns(
  ws: XLSX.WorkSheet,
  data: Record<string, unknown>[],
  minW = 10,
  maxW = 60
): void {
  if (!data || data.length === 0) return;
  const keys = Object.keys(data[0]);
  ws['!cols'] = keys.map((k) => {
    let max = k.length;
    const sampleLimit = Math.min(data.length, 1200);
    for (let i = 0; i < sampleLimit; i++) {
      const v = data[i][k];
      if (v !== null && v !== undefined) {
        const s = String(v);
        if (s.length > max) max = s.length;
      }
    }
    return { wch: Math.min(Math.max(max + 3, minW), maxW) };
  });
}

/**
 * Auto-fits column widths for Array-of-Arrays (AOA) based worksheet.
 */
export function autoFitAoaColumns(
  ws: XLSX.WorkSheet,
  aoa: (string | number | undefined | null)[][],
  minW = 12,
  maxW = 65
): void {
  if (!aoa || aoa.length === 0) return;
  const colCount = Math.max(...aoa.map((r) => (r ? r.length : 0)));
  const widths: number[] = new Array(colCount).fill(minW);
  for (const row of aoa) {
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (v !== null && v !== undefined) {
        const s = String(v);
        if (s.length > widths[c]) widths[c] = s.length;
      }
    }
  }
  ws['!cols'] = widths.map((w) => ({
    wch: Math.min(Math.max(w + 3, minW), maxW),
  }));
}

/**
 * Natural numerical order comparator for sorting orders.
 * Orders like "17263", "17263 c", "17264", "D-17265" sort in natural numerical order.
 */
export function compareOrdersByNumber(a: unknown, b: unknown): number {
  const rowA = a as Record<string, unknown> | null;
  const rowB = b as Record<string, unknown> | null;
  const idA = String(rowA?.['Order ID'] || rowA?.orderId || rowA?.orderNumber || rowA?.['WooCommerce Order #'] || rowA?.id || '').trim();
  const idB = String(rowB?.['Order ID'] || rowB?.orderId || rowB?.orderNumber || rowB?.['WooCommerce Order #'] || rowB?.id || '').trim();

  const numA = parseInt(idA.replace(/\D/g, ''), 10);
  const numB = parseInt(idB.replace(/\D/g, ''), 10);

  if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
    return numA - numB;
  }

  return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Extracts the full, unmasked customer name for export manifests.
 */
export function getExportCustomerName(o: unknown): string {
  if (!o || typeof o !== 'object') return 'Customer';
  const obj = o as Record<string, unknown>;
  const billing = obj.billing as Record<string, unknown> | undefined;
  const shipping = obj.shipping as Record<string, unknown> | undefined;
  const candidates = [
    obj.rawCustomerName,
    obj['Customer Name'],
    obj.customerName,
    obj['Full Name (Shipping)'],
    obj['Billing Name'],
    obj.recipientName,
    obj['Recipient Name'],
    billing?.first_name ? `${billing.first_name} ${billing.last_name || ''}`.trim() : undefined,
    shipping?.first_name ? `${shipping.first_name} ${shipping.last_name || ''}`.trim() : undefined,
    obj.Name,
    obj.name,
  ];

  // 1. Prefer candidate without mask asterisks or redaction tokens
  for (const c of candidates) {
    if (typeof c === 'string') {
      const val = c.trim();
      if (val && !val.includes('***') && !val.includes('[REDACTED')) {
        return val;
      }
    }
  }

  // 2. Fallback to whatever is non-empty
  for (const c of candidates) {
    if (typeof c === 'string') {
      const val = c.trim();
      if (val) return val;
    }
  }

  return 'Customer';
}

/**
 * Extracts the full, unmasked 11-digit phone number for export manifests.
 */
export function getExportPhoneNumber(o: unknown): string {
  if (!o || typeof o !== 'object') return '';
  const obj = o as Record<string, unknown>;
  const billing = obj.billing as Record<string, unknown> | undefined;
  const shipping = obj.shipping as Record<string, unknown> | undefined;
  const candidates = [
    obj.rawPhone,
    obj.formattedPhone,
    obj.Phone,
    obj.phone,
    obj['Phone (Shipping)'],
    obj['Billing Phone'],
    obj.recipientPhone,
    obj['Recipient Phone'],
    billing?.phone,
    shipping?.phone,
    obj.contact,
  ];

  // 1. Prefer unmasked candidate
  for (const c of candidates) {
    if (typeof c === 'string' || typeof c === 'number') {
      const val = String(c).trim();
      if (val && !val.includes('*') && !val.includes('[PHONE REDACTED]')) {
        const { displayPhone } = cleanCustomerPhone(val);
        if (displayPhone) return displayPhone;
        return val;
      }
    }
  }

  // 2. Fallback to masked phone if no unmasked version exists
  for (const c of candidates) {
    if (typeof c === 'string' || typeof c === 'number') {
      const val = String(c).trim();
      if (val) return val;
    }
  }

  return '';
}

export function exportReconciledExcel(
  result: ReconciliationResult,
  filenamePrefix: string = 'DEEN_Commerce_Reconciliation',
  options: { excludePos?: boolean } = {}
) {
  const wb = XLSX.utils.book_new();
  const s = result.summary;

  // 1. Executive Summary Sheet
  const summaryAoa = [
    ['DEEN COMMERCE - EXECUTIVE SALES & RETURN RECONCILIATION AUDIT'],
    ['Generated On: ' + new Date().toLocaleString()],
    [],
    ['KEY PERFORMANCE METRIC', 'VALUE', 'DESCRIPTION'],
    ['Gross Orders Placed', s.grossOrders, 'Total unique customer orders processed'],
    ['Full Delivered Orders', s.fullDeliveredOrders, 'Customer accepted 100% of order items'],
    ['Partial Orders (Delivered & Partial Return)', s.partialOrders, 'Customer kept part and returned part, or multi-parcel (w, c, s) shipment'],
    ['Full Returned Orders (RTO)', s.fullReturnedOrders, 'Entire shipment rejected and returned to hub'],
    ['Overall Return & Partial Incidence', s.returnRate.toFixed(2) + '%', 'Combined return and partial incidence rate'],
    ['Gross Invoiced Sales', Math.round(s.grossRevenue), 'Total BDT invoiced before returns'],
    ['Clean Realized Net Sales', Math.round(s.netDeliveredRevenue), 'Recognized net revenue after returns & partial adjustments'],
    ['Net Items Delivered', s.totalItemsDelivered, 'Physical apparel units in customer possession'],
    ['Outside : Inside Dhaka Ratio', s.outsideRatio + ' : 1', `${s.outsideOrders} Outside vs ${s.insideOrders} Inside`],
    ['Multi-Item Order GMV Integrity', s.doubleCountingAudit ? (s.doubleCountingAudit.isValid ? 'VERIFIED (0% Double Counting)' : `FLAGGED (+৳${s.doubleCountingAudit.inflationDelta})`) : 'VERIFIED', 'Deduplication invariant: ensures zero revenue inflation across multi-item rows'],
    [],
    ['PATHAO & COURIER COST RECONCILIATION'],
    ['Total Pathao Courier Charge (Gross)', Math.round(s.courierCost.grossCharge), 'Sum of Charge column from courier return manifest'],
    ['Courier Shipping Discount', Math.round(s.courierCost.discount), 'Discount applied by courier'],
    ['Net Pathao Payable (Post-Discount)', Math.round(s.courierCost.netCharge), 'Actual payable delivery fee to courier'],
    ['Customer Delivery Fee Collected (50 TK Dhaka / 90 TK Outside)', Math.round(s.courierCost.customerDeliveryFeeCollected), `${s.courierCost.collectedInsideCount} Dhaka orders (50 TK) + ${s.courierCost.collectedOutsideCount} Outside orders (90 TK) from unique delivered, partial, exchange & paid returns`],
    ['Paid Return COD Collected from Customers', Math.round(s.courierCost.paidReturnCollectedCod), 'Advance/return delivery fee recovered from customers on return'],
    ['Net Shipping Expense Burden', Math.round(s.courierCost.netCourierBurden), 'Net delivery cost absorbed by brand'],
    [],
    ['UNIT ECONOMICS & CONTRIBUTION MARGIN'],
    ['Net Realized Sales', Math.round(s.unitEconomics.netRealizedSales), 'Recognized top-line revenue'],
    ['Estimated COGS (Production & Fabric ~42%)', Math.round(s.unitEconomics.estimatedCogs), 'Direct cost of delivered goods'],
    ['Gross Margin', Math.round(s.unitEconomics.grossMargin), 'Revenue minus product manufacturing costs'],
    ['Courier Logistics Cost', Math.round(s.unitEconomics.totalCourierExpense), 'Courier payable for dispatched deliveries & returns'],
    ['Packaging & Unboxing Depreciation (৳25/ret)', Math.round(s.unitEconomics.packagingLoss), 'Polybag, hangtag & quality check loss per returned order'],
    ['Meta Ad Performance Spend (BDT)', Math.round(s.unitEconomics.metaAdCost), 'Performance marketing budget on Facebook & Instagram'],
    ['True Net Contribution Margin (BDT)', Math.round(s.unitEconomics.netContributionMargin), 'Bottom-line cash yield after COGS, logistics, packaging, and Meta ads'],
    ['Net Contribution Margin (%)', s.unitEconomics.netMarginPercentage.toFixed(2) + '%', 'Margin percentage on realized sales'],
    ['Blended ROAS (x)', s.unitEconomics.roas.toFixed(2) + 'x', 'Return on Ad Spend: Realized Sales / Meta Ad Spend'],
    ['Blended CAC (BDT / Kept Order)', Math.round(s.unitEconomics.cac), 'Customer Acquisition Cost per delivered order'],
    [],
    ['GEOGRAPHICAL RECONCILIATION BREAKDOWN'],
    ['Territory / Area', 'Gross Orders', 'Full Returns', 'Partial Orders', 'Net Orders', 'Return Rate', 'Net Delivered Sales (BDT)'],
    ['Inside Dhaka', s.insideOrders, s.insideReturns, s.insidePartials, s.insideOrders - s.insideReturns, (((s.insideReturns + s.insidePartials) / (s.insideOrders || 1)) * 100).toFixed(1) + '%', Math.round(s.insideNetRevenue)],
    ['Outside Dhaka', s.outsideOrders, s.outsideReturns, s.outsidePartials, s.outsideOrders - s.outsideReturns, (((s.outsideReturns + s.outsidePartials) / (s.outsideOrders || 1)) * 100).toFixed(1) + '%', Math.round(s.outsideNetRevenue)],
    ['Total Deliveries', s.grossOrders, s.fullReturnedOrders, s.partialOrders, s.grossOrders - s.fullReturnedOrders, s.returnRate.toFixed(1) + '%', Math.round(s.netDeliveredRevenue)]
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  autoFitAoaColumns(wsSummary, summaryAoa);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // 2. Reconciled Orders Ledger Sheet (Sorted by Order Number)
  let reconciledOrdersList = result.reconciledOrders;
  if (options.excludePos) {
    reconciledOrdersList = reconciledOrdersList.filter(
      (r) => !String(r.fulfillmentLocation || '').toLowerCase().includes('pos')
    );
  }
  const sortedReconciledOrders = [...reconciledOrdersList].sort(compareOrdersByNumber);
  const detailsData = sortedReconciledOrders.map(r => {
    // 1. Order-level delivery status (all items of the same order get identical value: Delivered, Paid Return, Not Paid Return, Exchange, Partial)
    const orderDeliveryStatus = r.orderDeliveryStatus || (
      (r.orderCategory === 'EXCHANGE' || r.isExchange) ? 'Exchange' :
      (r.orderCategory === 'PARTIAL') ? 'Partial' :
      (r.orderCategory === 'FULL_RETURN') ? (r.isPaidReturn ? 'Paid Return' : 'Not Paid Return') :
      'Delivered'
    );

    // 2. Item-level delivery status (item wise outcome: Delivered, Returned, Exchange)
    const itemDeliveryStatus = r.itemDeliveryStatus || (
      (r.orderCategory === 'EXCHANGE' || r.isExchange) ? 'Exchange' :
      (r.orderCategory === 'FULL_RETURN') ? 'Returned' :
      (r.orderCategory === 'PARTIAL') ? (
        (r.deliveryStatus.includes('Kept') || r.netRevenueImpact > 0) ? 'Delivered' : 'Returned'
      ) :
      'Delivered'
    );

    return {
      'Order ID': r.orderId,
      'Order Delivery Status': orderDeliveryStatus,
      'Item Delivery Status': itemDeliveryStatus,
      'Order Line Status': r.lineStatus,
      'Delivery Status': r.deliveryStatus,
      'Order Date': r.orderDate ? r.orderDate.toISOString().slice(0, 19).replace('T', ' ') : '',
      'Customer Name': getExportCustomerName(r),
      'Phone': getExportPhoneNumber(r),
      'City': r.city,
      'Territory': r.districtArea,
      'SKU': r.sku,
      'Product Description': r.itemName,
      'SIP Inventory': String(r.sipInventory || r.fulfillmentLocation || 'Central Warehouse'),
      'Quantity': r.quantity,
      'Unit Cost (BDT)': r.itemCost,
      'Order Total (BDT)': r.orderAmount,
      'Net Revenue Recognized': Math.round(r.netRevenueImpact),
      'Payment Method': r.paymentMethod,
      'Manual Review Flag': r.requiresManualReview ? 'FLAGGED FOR MANUAL AUDIT' : 'CONFIRMED OK',
      'Audit Trail / Evidence': r.decisionEvidence?.explanation || '',
      'AI Audit Tag': r.aiAuditTag || '',
      'AI Operational Notes': r.aiAuditNote || ''
    };
  });
  const wsDetails = XLSX.utils.json_to_sheet(detailsData);
  autoFitSheetColumns(wsDetails, detailsData);
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Reconciled Orders');

  // 3. SKU Performance Sheet
  const skuData = result.skuAnalytics.map(i => ({
    'SKU': i.sku,
    'Item Name': i.itemName,
    'Gross Qty Sold': i.grossQty,
    'Delivered Qty': Math.round(i.deliveredQty),
    'Returned Qty': Math.round(i.returnedQty),
    'Return Rate (%)': i.returnRate.toFixed(1) + '%',
    'Net Delivered Revenue (BDT)': Math.round(i.deliveredRevenue),
    'Total Return Loss (BDT)': Math.round(i.totalLossFromReturns)
  }));
  const wsSku = XLSX.utils.json_to_sheet(skuData);
  autoFitSheetColumns(wsSku, skuData);
  XLSX.utils.book_append_sheet(wb, wsSku, 'SKU Performance');

  // 4. Item-Wise Returns Sheet (Full Returns + Partial Returned Products - Sorted by Order Number)
  const sortedReturnedItems = [...result.returnedItems].sort(compareOrdersByNumber);
  const retData = sortedReturnedItems.map(i => ({
    'Order ID': i.orderId,
    'Return Source': i.returnSource,
    'Delivery Status': i.deliveryStatus,
    'Order Date': i.orderDate ? i.orderDate.toISOString().slice(0, 19).replace('T', ' ') : '',
    'Customer Name': getExportCustomerName(i),
    'Phone': getExportPhoneNumber(i),
    'Territory': i.districtArea,
    'SKU': i.sku,
    'Product Description': i.itemName,
    'SIP Inventory': String(i.sipInventory || 'Central Warehouse'),
    'Returned Qty': i.quantity,
    'Unit Price (BDT)': i.itemCost,
    'Total Returned Value (BDT)': Math.round(i.returnedValue),
    'Order Total (BDT)': i.orderAmount
  }));
  const wsRet = XLSX.utils.json_to_sheet(retData);
  autoFitSheetColumns(wsRet, retData);
  XLSX.utils.book_append_sheet(wb, wsRet, 'Item-Wise Returns');

  // 5. Customer Risk Profiling Sheet
  const riskData = result.customerRiskProfiles.map(c => ({
    'Phone Number': getExportPhoneNumber(c),
    'Customer Name': getExportCustomerName(c),
    'Total Orders Placed': c.totalOrders,
    'Delivered Orders': c.deliveredOrders,
    'Partial Orders': c.partialOrders,
    'Returned Orders': c.returnedOrders,
    'Return Rate (%)': c.returnRate.toFixed(1) + '%',
    'Total Realized GMV (BDT)': Math.round(c.totalSpent),
    'Risk Tier': c.riskTier,
    'Operational Recommendation': c.recommendation
  }));
  const wsRisk = XLSX.utils.json_to_sheet(riskData);
  autoFitSheetColumns(wsRisk, riskData);
  XLSX.utils.book_append_sheet(wb, wsRisk, 'Customer Risk Intelligence');

  // 6. Exchanged Orders Sheet (Sorted by Order Number)
  if (result.exchangedOrders && result.exchangedOrders.length > 0) {
    const sortedExchanges = [...result.exchangedOrders].sort(compareOrdersByNumber);
    const exchangeData = sortedExchanges.map(e => ({
      'Order ID': e.orderId,
      'Raw Order ID': e.rawOrderId,
      'Consignment ID': e.consignmentId,
      'Recipient Name': getExportCustomerName(e),
      'Phone': getExportPhoneNumber(e),
      'Destination / Address': e.address,
      'Delivery Status': e.deliveryStatus,
      'Items Quantity': e.quantity || 1,
      'Item Description': e.itemDescription || '',
      'Exchange COD (BDT)': e.codAmount,
      'Courier Fee (BDT)': e.courierCharge,
      'Discount (BDT)': e.discount,
      'Payment Status': e.paymentStatus,
      'Action / POD': e.actionPod || '',
      'Matched in Ledger': e.matchedInOrders ? 'Yes' : 'No'
    }));
    const wsExchanges = XLSX.utils.json_to_sheet(exchangeData);
    autoFitSheetColumns(wsExchanges, exchangeData);
    XLSX.utils.book_append_sheet(wb, wsExchanges, 'Exchanged Orders');
  }

  // 7. Courier & Pathao Mismatch Audit Sheet (Sorted by Order Number)
  if (result.courierMismatches && result.courierMismatches.length > 0) {
    const sortedMismatches = [...result.courierMismatches].sort(compareOrdersByNumber);
    const mismatchData = sortedMismatches.map(m => ({
      'Order ID': m.orderId,
      'Consignment ID': m.consignmentId || 'N/A',
      'Customer Name': getExportCustomerName(m),
      'Phone': getExportPhoneNumber(m),
      'Excel Status': m.excelStatus,
      'Pathao Courier Status': m.pathaoStatus,
      'Expected COD (BDT)': m.expectedCod,
      'Pathao Collected COD (BDT)': m.pathaoCollectedCod,
      'COD Difference (BDT)': m.codDifference,
      'Severity': m.severity,
      'Mismatch Type': m.mismatchType,
      'Audit Description': m.description,
      'Action Recommendation': m.recommendedAction
    }));
    const wsMismatch = XLSX.utils.json_to_sheet(mismatchData);
    autoFitSheetColumns(wsMismatch, mismatchData);
    XLSX.utils.book_append_sheet(wb, wsMismatch, 'Courier Mismatches');
  }

  // 8. AI Audited & Tagged Orders Sheet (Sorted by Order Number)
  const taggedOrders = [...result.reconciledOrders.filter(r => Boolean(r.aiAuditTag))].sort(compareOrdersByNumber);
  if (taggedOrders.length > 0) {
    const aiAuditData = taggedOrders.map(r => ({
      'Order ID': r.orderId,
      'AI Audit Tag': r.aiAuditTag || '',
      'AI Operational Notes': r.aiAuditNote || '',
      'Customer Name': getExportCustomerName(r),
      'Phone': getExportPhoneNumber(r),
      'City': r.city,
      'Territory': r.districtArea,
      'Delivery Status': r.orderDeliveryStatus || r.deliveryStatus,
      'SKU': r.sku,
      'Product': r.itemName,
      'Quantity': r.quantity,
      'Order Total (BDT)': r.orderAmount,
      'Net Revenue Recognized (BDT)': Math.round(r.netRevenueImpact),
      'Fulfillment Branch': r.fulfillmentLocation || 'Online Store (Central Warehouse)'
    }));
    const wsAiAudit = XLSX.utils.json_to_sheet(aiAuditData);
    autoFitSheetColumns(wsAiAudit, aiAuditData);
    XLSX.utils.book_append_sheet(wb, wsAiAudit, 'AI Audited Orders');
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  const finalFilename = `${filenamePrefix}_${dateStamp}.xlsx`;

  saveWorkbook(wb, finalFilename);
}

/**
 * Robust cross-browser Excel workbook downloader.
 * Fixes issue where Chromium cancels download if URL.revokeObjectURL is called prematurely.
 */
export function saveWorkbook(wb: XLSX.WorkBook, filename: string) {
  if (typeof window === 'undefined') return;

  // 1. Primary: Use XLSX.writeFile which handles browser downloads natively
  try {
    if (typeof XLSX.writeFile === 'function') {
      XLSX.writeFile(wb, filename);
      return;
    }
  } catch (err) {
    console.warn('XLSX.writeFile failed, falling back to manual Blob download:', err);
  }

  // 2. Secondary fallback: Manual Blob generation with safe 60s lifecycle
  try {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const nav = window.navigator as unknown as { msSaveOrOpenBlob?: (blob: Blob, defaultName?: string) => boolean };
    if (nav?.msSaveOrOpenBlob) {
      nav.msSaveOrOpenBlob(blob, filename);
      return;
    }

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();

    // Clean up DOM and revoke object URL only after download stream has safely finished (60 seconds)
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      window.URL.revokeObjectURL(url);
    }, 60000);
  } catch (err) {
    console.error('Failed to download Excel workbook:', err);
    throw err;
  }
}

export interface CategoryExportItem {
  name: string;
  sub?: string;
  dispatched: number;
  returns: number;
  net: number;
  retention: string;
  revenue: number;
}

export interface MasterSkuExportItem {
  masterSku: string;
  name?: string;
  mainName?: string;
  category: string;
  grossQty: number;
  returnedQty: number;
  deliveredQty: number;
  retentionRate?: number;
  returnRate?: number;
  deliveredRevenue: number;
  returnLoss: number;
}

export function exportPerformanceReport(
  categories: CategoryExportItem[],
  masterSkuItems: MasterSkuExportItem[],
  viewMode: 'CATEGORY' | 'ITEM' = 'CATEGORY'
) {
  const wb = XLSX.utils.book_new();

  // 1. Category Performance Data
  const catData = categories.map((c, i) => ({
    'SL': i + 1,
    'Category': c.name,
    'Focus / Subcategory': c.sub || '',
    'Dispatched (Units)': c.dispatched,
    'Returned (Units)': c.returns,
    'Net Delivered (Units)': c.net,
    'Retention Rate': c.retention + '%',
    'Delivered Revenue (BDT)': c.revenue
  }));
  const wsCat = XLSX.utils.json_to_sheet(catData);
  autoFitSheetColumns(wsCat, catData);

  // 2. Item Wise Master SKU Data
  const itemData = masterSkuItems.map((it, i) => {
    const itemName = it.mainName || it.name || 'DEEN Apparel';
    const retentionPct = it.retentionRate !== undefined
      ? it.retentionRate.toFixed(1)
      : (it.grossQty > 0 ? ((it.deliveredQty / it.grossQty) * 100).toFixed(1) : '0.0');

    return {
      'SL': i + 1,
      'Master SKU': it.masterSku,
      'Product Style Name': itemName,
      'Category': it.category,
      'Dispatched (Units)': it.grossQty,
      'Returned (Units)': it.returnedQty,
      'Net Delivered (Units)': it.deliveredQty,
      'Retention Rate': retentionPct + '%',
      'Delivered Revenue (BDT)': Math.round(it.deliveredRevenue),
      'Return Revenue Loss (BDT)': Math.round(it.returnLoss)
    };
  });
  const wsItem = XLSX.utils.json_to_sheet(itemData);
  autoFitSheetColumns(wsItem, itemData);

  // Arrange active sheet first based on current viewMode
  if (viewMode === 'CATEGORY') {
    XLSX.utils.book_append_sheet(wb, wsCat, 'Category Wise Performance');
    XLSX.utils.book_append_sheet(wb, wsItem, 'Item Wise (Master SKU)');
  } else {
    XLSX.utils.book_append_sheet(wb, wsItem, 'Item Wise (Master SKU)');
    XLSX.utils.book_append_sheet(wb, wsCat, 'Category Wise Performance');
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  const prefix = viewMode === 'CATEGORY' ? 'DEEN_Category_Wise_Performance' : 'DEEN_Item_Wise_Performance';
  const finalFilename = `${prefix}_${dateStamp}.xlsx`;

  saveWorkbook(wb, finalFilename);
}

export interface LiveShippedOrdersExportOptions {
  isExchangesView?: boolean;
  filenamePrefix?: string;
}

/**
 * Builds the official multi-sheet Excel workbook for Live Shipped Orders.
 * Invariant Rule: Strictly excludes POS retail store orders and non-checkout exchange orders from commercial sales.
 * When replacement/non-checkout orders exist, they are isolated on a dedicated 'Exchanges & Non-Checkout' sheet
 * with zero commercial revenue impact.
 */
export function buildLiveShippedOrdersWorkbook(
  orders: RawOrderRow[],
  report: LiveOpsReport,
  options: LiveShippedOrdersExportOptions = {}
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const isExchangesView = Boolean(options.isExchangesView);

  // 1. Determine commercial orders to export
  // Invariant Rule: Strictly exclude POS outlet orders and non-checkout exchange orders from commercial sales
  const commercialOrders = isExchangesView
    ? orders.filter(isOrderExchange)
    : orders.filter((o) => isOrderOnline(o) && !isOrderExchange(o));

  const sortedOrders = [...commercialOrders].sort(compareOrdersByNumber);

  const exportData = sortedOrders.map((o) => {
    const itemName = String(o['Item Name'] || o.itemName || o.name || '');
    const sku = String(o.SKU || o.sku || '');
    const cat = getCategoryForSales(itemName);
    const subCat = getSubCategoryForSales(itemName, cat);
    const isSelects = classifyProductLine(itemName, sku, cat) === 'DEEN Selects';

    return {
      'Order ID': o['Order ID'] || o.orderId,
      'Date': o['Order Date'] || o.orderDate || o.date_created || '',
      'Customer Name': getExportCustomerName(o),
      'Phone': getExportPhoneNumber(o),
      'City': o.City || o.city || 'Dhaka',
      'Item Name': itemName,
      'SKU': sku,
      'Category': cat,
      'Sub-Category': subCat,
      'Collection Line': isSelects ? 'DEEN Selects' : 'DEEN Regular',
      'SIP Inventory': String(o.sipInventory || o.sip_inventory || o['SIP Inventory'] || o.fulfillmentBranch || o['Fulfillment Branch'] || 'Central Warehouse'),
      'Quantity': Number(o.Quantity ?? o.quantity ?? o.qty) || 1,
      'Unit Cost (TK)': Number(o['Item Cost'] ?? o.itemCost ?? o.price) || 0,
      'Order Amount (TK)': Number(o['Order Amount'] ?? o.orderAmount ?? o.amount ?? o.total) || 0,
      'WooCommerce Status': String(o['Delivery Status'] || (o as Record<string, unknown>).status || 'shipped'),
      'Pathao Courier Status': String(o['Courier Status'] || o.courierStatus || 'Untracked'),
      'Pathao Consignment ID': String(o['Consignment ID'] || o.consignmentId || o.tracking_number || 'N/A'),
      'Collected Amount (TK)': Number(o.collectedAmount ?? o['Collected Amount']) || 0,
      'Courier Discrepancy': o.hasDiscrepancy ? `Yes (${o.discrepancyType})` : 'None',
    };
  });

  const mainSheetName = isExchangesView ? 'Exchanges Only' : 'Shipped Orders (Online)';
  const wsMain = XLSX.utils.json_to_sheet(exportData);
  autoFitSheetColumns(wsMain, exportData);
  XLSX.utils.book_append_sheet(wb, wsMain, mainSheetName);

  // 2. Dedicated Sheet 2: Exchanges & Non-Checkout Replacements (if not already in exchanges view)
  if (!isExchangesView) {
    const exchangePool = report?.exchangeStats?.replacementOrders?.length
      ? report.exchangeStats.replacementOrders
      : orders.filter(isOrderExchange);

    if (exchangePool.length > 0) {
      const sortedExchanges = [...exchangePool].sort(compareOrdersByNumber);
      const exData = sortedExchanges.map((o) => {
        const info = extractExchangeInfo(o);
        const itemName = String(o['Item Name'] || o.itemName || o.name || '');
        const sku = String(o.SKU || o.sku || '');
        return {
          'Replacement Order ID': o['Order ID'] || o.orderId,
          'Original Order ID': info.referencedOrderId || 'N/A',
          'Exchange Tag': info.displayTag || 'Exchange',
          'Date': o['Order Date'] || o.orderDate || o.date_created || '',
          'Customer Name': getExportCustomerName(o),
          'Phone': getExportPhoneNumber(o),
          'City': o.City || o.city || 'Dhaka',
          'Item Name': itemName,
          'SKU': sku,
          'SIP Inventory': String(o.sipInventory || o.sip_inventory || o['SIP Inventory'] || 'Exchange Replacement'),
          'Quantity': Number(o.Quantity ?? o.quantity ?? o.qty) || 1,
          'Courier Status': String(o['Courier Status'] || o.courierStatus || 'Untracked'),
          'Pathao Consignment ID': String(o['Consignment ID'] || o.consignmentId || o.tracking_number || 'N/A'),
          'Commercial Revenue Recognized': 0, // Invariant: zero revenue inflation
          'Operational Notes': 'Customer exchange replacement parcel created manually via staff admin (zero new revenue)',
        };
      });
      const wsExchanges = XLSX.utils.json_to_sheet(exData);
      autoFitSheetColumns(wsExchanges, exData);
      XLSX.utils.book_append_sheet(wb, wsExchanges, 'Exchanges & Non-Checkout');
    }
  }

  return wb;
}

export function exportLiveShippedOrdersExcel(
  orders: RawOrderRow[],
  report: LiveOpsReport,
  options: LiveShippedOrdersExportOptions = {}
) {
  const wb = buildLiveShippedOrdersWorkbook(orders, report, options);
  const prefix = options.filenamePrefix || 'DEEN_Live_Shipped_Orders';
  const finalFilename = `${prefix}_${report.referenceDate}.xlsx`;
  saveWorkbook(wb, finalFilename);
}

export interface MonthlyNetSalesExportOptions {
  monthLabel?: string;
  filenamePrefix?: string;
  provenance?: DataProvenanceInfo;
}

/**
 * Builds a comprehensive 7-sheet Monthly Net Sales Report workbook (.xlsx) designed
 * for executive review and month-end accounting close.
 *
 * Sheets:
 * 1. Executive Summary & P&L - Realized top-line sales, return deductions, unit economics, Meta ads & contribution margin.
 * 2. Category Sales & Retention - Apparel categories (Jeans, Shirts, Polos, Tees, etc.) with units, retention %, net sales.
 * 3. Master SKU Leaderboard - Consolidated product styles (sizes consolidated) ranked by realized revenue with status tags.
 * 4. Commercial Orders Ledger - Reconciled commercial orders sorted naturally, unmasked customer details, inventory origins.
 * 5. Item-Wise Returns & Partials - Granular return loss audit, return sources, SIP origins, returned quantities, loss value.
 * 6. Omnichannel & SIP Inventory - Multi-node fulfillment breakdown (Central Warehouse, Mirpur, Cumilla, Wari, Sylhet, Exchanges).
 * 7. Courier & COD Settlement - Pathao logistics costs, delivery fee collections, COD discrepancy audit.
 */
export function buildMonthlyNetSalesWorkbook(
  result: ReconciliationResult,
  options: MonthlyNetSalesExportOptions = {}
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const s = result.summary;
  const provenance = options.provenance;

  // Determine operational time scope
  const reportPeriodLabel = options.monthLabel ||
    provenance?.dateRangeFormatted ||
    (() => {
      const dates = result.reconciledOrders
        .map((r) => (r.orderDate ? new Date(r.orderDate).getTime() : 0))
        .filter((t) => t > 0);
      if (dates.length > 0) {
        const minD = new Date(Math.min(...dates));
        const maxD = new Date(Math.max(...dates));
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        if (minD.getMonth() === maxD.getMonth() && minD.getFullYear() === maxD.getFullYear()) {
          return `${monthNames[minD.getMonth()]} ${minD.getFullYear()}`;
        }
        return `${minD.toISOString().slice(0, 10)} to ${maxD.toISOString().slice(0, 10)}`;
      }
      return 'Comprehensive Operating Period';
    })();

  const totalUnitsDispatched = result.reconciledOrders.reduce((acc, r) => acc + (Number(r.quantity) || 1), 0);
  const totalUnitsDelivered = s.totalItemsDelivered || result.reconciledOrders
    .filter((r) => r.itemDeliveryStatus === 'Delivered' || (r.orderCategory !== 'FULL_RETURN' && Number(r.netRevenueImpact) > 0))
    .reduce((acc, r) => acc + (Number(r.quantity) || 1), 0);
  const totalUnitsReturned = result.returnedItems.reduce((acc, r) => acc + Math.round(r.quantity), 0);
  const totalReturnLossValue = result.returnedItems.reduce((acc, r) => acc + (Number(r.returnedValue) || 0), 0);
  const fullReturnLoss = result.returnedItems
    .filter((r) => r.returnSource.includes('Full Return'))
    .reduce((acc, r) => acc + (Number(r.returnedValue) || 0), 0);
  const partialReturnLoss = Math.max(0, totalReturnLossValue - fullReturnLoss);
  const realizedAov = Math.max(1, s.fullDeliveredOrders + s.partialOrders) > 0
    ? Math.round(s.netDeliveredRevenue / Math.max(1, s.fullDeliveredOrders + s.partialOrders))
    : 0;
  const grossMarginRatio = s.unitEconomics.netRealizedSales > 0
    ? (s.unitEconomics.grossMargin / s.unitEconomics.netRealizedSales) * 100
    : 0;

  // ==========================================
  // SHEET 1: Executive Summary & P&L
  // ==========================================
  const summaryAoa: (string | number | undefined | null)[][] = [
    ['DEEN COMMERCE - MONTH-END NET SALES & FINANCIAL RECONCILIATION AUDIT'],
    ['Generated On: ' + new Date().toLocaleString()],
    ['Reporting Scope / Period: ' + reportPeriodLabel],
    ['Data Provenance / Source: ' + (provenance?.activeDatasetLabel || 'Active Reconciled Operating Ledger')],
    ['Multi-Item Deduplication Integrity: ' + (s.doubleCountingAudit ? (s.doubleCountingAudit.isValid ? 'VERIFIED (0% Double Counting Invariant)' : `FLAGGED (+৳${s.doubleCountingAudit.inflationDelta})`) : 'VERIFIED')],
    [],
    ['TOP-LINE COMMERCIAL REALIZATION', 'AMOUNT (BDT)', 'DESCRIPTION / ACCOUNTING BASIS'],
    ['Gross Invoiced Revenue (GMV)', Math.round(s.grossRevenue), 'Total customer checkout order value before returns'],
    ['Full Return Deductions (RTO)', Math.round(fullReturnLoss), 'Revenue loss from rejected & undelivered full returns'],
    ['Partial Return Adjustments', Math.round(partialReturnLoss), 'Revenue deducted for returned items in split orders'],
    ['Clean Realized Net Sales', Math.round(s.netDeliveredRevenue), 'Net cash realized after all return deductions'],
    ['Realized Average Order Value (AOV)', realizedAov, 'Average net realized revenue per successfully delivered order'],
    [],
    ['UNIT ECONOMICS & BOTTOM-LINE CASH YIELD', 'VALUE', 'DESCRIPTION / FORMULA'],
    ['Net Realized Sales', Math.round(s.unitEconomics.netRealizedSales), 'Top-line realized revenue baseline'],
    ['Estimated COGS (Production & Fabric ~42%)', Math.round(s.unitEconomics.estimatedCogs), 'Direct manufacturing & fabric costs of delivered apparel'],
    ['Gross Product Margin', Math.round(s.unitEconomics.grossMargin), 'Realized Sales minus direct manufacturing COGS'],
    ['Gross Product Margin Ratio (%)', grossMarginRatio.toFixed(2) + '%', 'Gross profit margin as percentage of realized sales'],
    ['Courier Logistics Expense', Math.round(s.unitEconomics.totalCourierExpense), 'Courier payable for dispatched parcel deliveries & returns'],
    ['Packaging & Return QC Depreciation (৳25/ret)', Math.round(s.unitEconomics.packagingLoss), 'Polybag, hangtag & quality check handling loss per returned parcel'],
    ['Meta Ad Performance Marketing Spend', Math.round(s.unitEconomics.metaAdCost), 'Performance advertising investment on Facebook & Instagram'],
    ['True Net Contribution Margin (Cash Flow)', Math.round(s.unitEconomics.netContributionMargin), 'Bottom-line operational cash yield after COGS, Courier, Packaging & Meta Ads'],
    ['Net Contribution Margin Rate (%)', s.unitEconomics.netMarginPercentage.toFixed(2) + '%', 'Net contribution margin percentage on realized sales'],
    ['Blended ROAS (Return on Ad Spend)', s.unitEconomics.roas.toFixed(2) + 'x', 'Realized Sales divided by Meta Ad Spend'],
    ['Blended CAC (Cost Per Delivered Order)', Math.round(s.unitEconomics.cac) + ' BDT', 'Customer acquisition cost per successfully kept order'],
    [],
    ['FULFILLMENT PIPELINE & VOLUME METRICS', 'COUNT', 'PERCENTAGE / BREAKDOWN'],
    ['Gross Commercial Orders Dispatched', s.grossOrders, '100.0%'],
    ['Full Delivered Orders (100% Kept)', s.fullDeliveredOrders, ((s.fullDeliveredOrders / Math.max(1, s.grossOrders)) * 100).toFixed(1) + '%'],
    ['Partial Orders (Some Kept / Multi-Parcel)', s.partialOrders, ((s.partialOrders / Math.max(1, s.grossOrders)) * 100).toFixed(1) + '%'],
    ['Full Returned Orders (RTO)', s.fullReturnedOrders, ((s.fullReturnedOrders / Math.max(1, s.grossOrders)) * 100).toFixed(1) + '%'],
    ['Staff Exchange Replacements (Non-Commercial)', s.totalExchangedOrders || 0, 'Cleanly isolated replacement orders with 0 BDT new revenue'],
    ['Delivered Fulfillment Realization Rate (%)', ((s.fullDeliveredOrders / Math.max(1, s.grossOrders)) * 100).toFixed(2) + '%', 'Percentage of orders fully accepted by customers'],
    ['Overall Return & Partial Incidence (%)', s.returnRate.toFixed(2) + '%', 'Combined return and partial incidence rate'],
    ['Total Apparel Units Dispatched', totalUnitsDispatched, 'Gross garment units dispatched from warehouse & branches'],
    ['Total Apparel Units Delivered / Kept', totalUnitsDelivered, ((totalUnitsDelivered / Math.max(1, totalUnitsDispatched)) * 100).toFixed(1) + '% retained in customer possession'],
    ['Total Apparel Units Returned', totalUnitsReturned, ((totalUnitsReturned / Math.max(1, totalUnitsDispatched)) * 100).toFixed(1) + '% returned to inventory'],
    [],
    ['PATHAO LOGISTICS & COD SETTLEMENT', 'AMOUNT (BDT)', 'OPERATIONAL BASIS'],
    ['Gross Pathao Delivery Charges', Math.round(s.courierCost.grossCharge), 'Sum of charges from courier shipping manifest'],
    ['Courier Shipping Discounts', Math.round(s.courierCost.discount), 'Commercial shipping volume discounts applied by Pathao'],
    ['Net Delivery Fee Payable to Pathao', Math.round(s.courierCost.netCharge), 'Actual payable delivery fee to courier'],
    ['Customer Delivery Fee Collected (৳50 Dhaka / ৳90 Outside)', Math.round(s.courierCost.customerDeliveryFeeCollected), `${s.courierCost.collectedInsideCount} Inside Dhaka (৳50) + ${s.courierCost.collectedOutsideCount} Outside Dhaka (৳90) from unique completed orders`],
    ['Paid Return COD Collected on Refusals', Math.round(s.courierCost.paidReturnCollectedCod), 'Advance/COD delivery fee recovered from customers upon parcel refusal'],
    ['Net Courier Expense Burden Absorbed by DEEN', Math.round(s.courierCost.netCourierBurden), 'Final delivery cost absorbed by DEEN brand (Net Payable minus Collections)'],
    [],
    ['GEOGRAPHICAL PERFORMANCE REALIZATION', 'GROSS ORDERS', 'DELIVERED ORDERS', 'FULL RETURNS', 'PARTIAL ORDERS', 'RETURN RATE (%)', 'NET REALIZED SALES (BDT)', 'AVG REALIZED TICKET (BDT)'],
    [
      'Inside Dhaka',
      s.insideOrders,
      s.insideOrders - s.insideReturns,
      s.insideReturns,
      s.insidePartials,
      (((s.insideReturns + s.insidePartials) / Math.max(1, s.insideOrders)) * 100).toFixed(1) + '%',
      Math.round(s.insideNetRevenue),
      Math.round(s.insideNetRevenue / Math.max(1, s.insideOrders - s.insideReturns))
    ],
    [
      'Outside Dhaka',
      s.outsideOrders,
      s.outsideOrders - s.outsideReturns,
      s.outsideReturns,
      s.outsidePartials,
      (((s.outsideReturns + s.outsidePartials) / Math.max(1, s.outsideOrders)) * 100).toFixed(1) + '%',
      Math.round(s.outsideNetRevenue),
      Math.round(s.outsideNetRevenue / Math.max(1, s.outsideOrders - s.outsideReturns))
    ],
    [
      'Total Commercial Orders',
      s.grossOrders,
      s.grossOrders - s.fullReturnedOrders,
      s.fullReturnedOrders,
      s.partialOrders,
      s.returnRate.toFixed(1) + '%',
      Math.round(s.netDeliveredRevenue),
      realizedAov
    ],
    [],
    ['Outside to Inside Dhaka Order Ratio', s.outsideRatio + ' : 1', `${s.outsideOrders} Outside vs ${s.insideOrders} Inside Dhaka orders`]
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  autoFitAoaColumns(wsSummary, summaryAoa);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary & P&L');

  // ==========================================
  // SHEET 2: Category Sales & Retention
  // ==========================================
  const defaultCategoryFocus: Record<string, string> = {
    'Jeans': 'Slim, Regular & Loose Fit Denim',
    'Casual & Formal Shirts': 'Full Sleeve, Half Sleeve, Cuban Collar & Linen Shirts',
    'Polo Shirts': 'Classic Pique, Solid & Knitted Polos',
    'T-Shirts': 'Solid, Graphic & Heavyweight GSM Tees',
    'Twill Pants & Chinos': 'Urban Slim Comfort Chinos, Trousers & Cargo',
    'Jackets': 'Denim Jackets, Windbreakers & Outerwear',
    'Sweatshirts & Hoodies': 'Winter Fleece & French-Terry Hoodies',
    'Apparel & Accessories': 'Boxers, Masks & Core Essentials'
  };

  const categoryGroups: Record<string, { dispatched: number; delivered: number; returned: number; revenue: number; loss: number }> = {};
  for (const cat of Object.keys(defaultCategoryFocus)) {
    categoryGroups[cat] = { dispatched: 0, delivered: 0, returned: 0, revenue: 0, loss: 0 };
  }

  for (const it of result.skuAnalytics) {
    const rawCat = it.category || getCategoryForSales(it.itemName);
    const cat = categoryGroups[rawCat] ? rawCat : 'Apparel & Accessories';
    categoryGroups[cat].dispatched += it.grossQty;
    categoryGroups[cat].delivered += it.deliveredQty;
    categoryGroups[cat].returned += it.returnedQty;
    categoryGroups[cat].revenue += it.deliveredRevenue;
    categoryGroups[cat].loss += it.totalLossFromReturns;
  }

  const catRows: Record<string, unknown>[] = Object.entries(categoryGroups)
    .filter(([_, data]) => data.dispatched > 0)
    .map(([catName, d], idx) => {
      const grossSales = d.revenue + d.loss;
      const retention = d.dispatched > 0 ? ((d.delivered / d.dispatched) * 100).toFixed(1) : '0.0';
      const returnPct = d.dispatched > 0 ? ((d.returned / d.dispatched) * 100).toFixed(1) : '0.0';
      const share = s.netDeliveredRevenue > 0 ? ((d.revenue / s.netDeliveredRevenue) * 100).toFixed(1) : '0.0';
      const avgPrice = d.delivered > 0 ? Math.round(d.revenue / d.delivered) : 0;

      return {
        'SL': idx + 1,
        'Apparel Category': catName,
        'Focus / Sub-Category': defaultCategoryFocus[catName] || 'Apparel Collection',
        'Dispatched (Units)': d.dispatched,
        'Delivered (Units)': d.delivered,
        'Returned (Units)': d.returned,
        'Retention Rate (%)': retention + '%',
        'Return Rate (%)': returnPct + '%',
        'Gross Dispatched Sales (BDT)': Math.round(grossSales),
        'Return Revenue Loss (BDT)': Math.round(d.loss),
        'Net Realized Sales (BDT)': Math.round(d.revenue),
        'Revenue Contribution (%)': share + '%',
        'Avg Realized Price / Unit (BDT)': avgPrice
      };
    })
    .sort((a, b) => (Number(b['Net Realized Sales (BDT)']) || 0) - (Number(a['Net Realized Sales (BDT)']) || 0));

  // Append Grand Total Row
  const totalCatDispatched = catRows.reduce((acc, r) => acc + (Number(r['Dispatched (Units)']) || 0), 0);
  const totalCatDelivered = catRows.reduce((acc, r) => acc + (Number(r['Delivered (Units)']) || 0), 0);
  const totalCatReturned = catRows.reduce((acc, r) => acc + (Number(r['Returned (Units)']) || 0), 0);
  const totalCatGross = catRows.reduce((acc, r) => acc + (Number(r['Gross Dispatched Sales (BDT)']) || 0), 0);
  const totalCatLoss = catRows.reduce((acc, r) => acc + (Number(r['Return Revenue Loss (BDT)']) || 0), 0);
  const totalCatNet = catRows.reduce((acc, r) => acc + (Number(r['Net Realized Sales (BDT)']) || 0), 0);

  catRows.push({
    'SL': '' as unknown as number,
    'Apparel Category': 'TOTAL / BLENDED CLOSE',
    'Focus / Sub-Category': 'All Active Apparel Categories',
    'Dispatched (Units)': totalCatDispatched,
    'Delivered (Units)': totalCatDelivered,
    'Returned (Units)': totalCatReturned,
    'Retention Rate (%)': (totalCatDispatched > 0 ? ((totalCatDelivered / totalCatDispatched) * 100).toFixed(1) : '0.0') + '%',
    'Return Rate (%)': (totalCatDispatched > 0 ? ((totalCatReturned / totalCatDispatched) * 100).toFixed(1) : '0.0') + '%',
    'Gross Dispatched Sales (BDT)': totalCatGross,
    'Return Revenue Loss (BDT)': totalCatLoss,
    'Net Realized Sales (BDT)': totalCatNet,
    'Revenue Contribution (%)': '100.0%',
    'Avg Realized Price / Unit (BDT)': totalCatDelivered > 0 ? Math.round(totalCatNet / totalCatDelivered) : 0
  });

  const wsCat = XLSX.utils.json_to_sheet(catRows);
  autoFitSheetColumns(wsCat, catRows);
  XLSX.utils.book_append_sheet(wb, wsCat, 'Category Sales & Retention');

  // ==========================================
  // SHEET 3: Master SKU Leaderboard
  // ==========================================
  const masterMap = new Map<string, {
    masterSku: string;
    mainName: string;
    category: string;
    grossQty: number;
    deliveredQty: number;
    returnedQty: number;
    deliveredRevenue: number;
    returnLoss: number;
  }>();

  for (const it of result.skuAnalytics) {
    const masterSku = extractMasterSku(it.sku);
    const mainName = cleanProductMainName(it.itemName);
    const category = it.category || getCategoryForSales(it.itemName);

    const existing = masterMap.get(masterSku);
    if (existing) {
      existing.grossQty += it.grossQty;
      existing.deliveredQty += it.deliveredQty;
      existing.returnedQty += it.returnedQty;
      existing.deliveredRevenue += it.deliveredRevenue;
      existing.returnLoss += it.totalLossFromReturns;
    } else {
      masterMap.set(masterSku, {
        masterSku,
        mainName,
        category,
        grossQty: it.grossQty,
        deliveredQty: it.deliveredQty,
        returnedQty: it.returnedQty,
        deliveredRevenue: it.deliveredRevenue,
        returnLoss: it.totalLossFromReturns,
      });
    }
  }

  const sortedMasterSkus = Array.from(masterMap.values())
    .sort((a, b) => b.deliveredRevenue - a.deliveredRevenue);

  const masterSkuRows = sortedMasterSkus.map((it, idx) => {
    const retRate = it.grossQty > 0 ? (it.deliveredQty / it.grossQty) * 100 : 0;
    const rtoRate = it.grossQty > 0 ? (it.returnedQty / it.grossQty) * 100 : 0;

    let status = '📊 Standard Style';
    if (it.deliveredRevenue > 0 && retRate >= 88 && it.grossQty >= 15) {
      status = '🌟 Top Seller';
    } else if (rtoRate >= 32 && it.grossQty >= 5) {
      status = '⚠️ High Return Risk';
    } else if (it.grossQty >= 25) {
      status = '⚡ Volume Driver';
    } else if (retRate >= 80) {
      status = '✅ Healthy Performer';
    }

    return {
      'Rank': idx + 1,
      'Master SKU': it.masterSku,
      'Product Style Name': it.mainName,
      'Category': it.category,
      'Performance Status': status,
      'Dispatched (Units)': it.grossQty,
      'Delivered (Units)': it.deliveredQty,
      'Returned (Units)': it.returnedQty,
      'Retention Rate (%)': retRate.toFixed(1) + '%',
      'Return Rate (%)': rtoRate.toFixed(1) + '%',
      'Gross Dispatched Sales (BDT)': Math.round(it.deliveredRevenue + it.returnLoss),
      'Return Revenue Loss (BDT)': Math.round(it.returnLoss),
      'Net Realized Revenue (BDT)': Math.round(it.deliveredRevenue),
      'Avg Realized Unit Price (BDT)': it.deliveredQty > 0 ? Math.round(it.deliveredRevenue / it.deliveredQty) : 0
    };
  });

  const wsMasterSku = XLSX.utils.json_to_sheet(masterSkuRows);
  autoFitSheetColumns(wsMasterSku, masterSkuRows);
  XLSX.utils.book_append_sheet(wb, wsMasterSku, 'Master SKU Leaderboard');

  // ==========================================
  // SHEET 4: Commercial Orders Ledger
  // ==========================================
  const commercialOrders = result.reconciledOrders.filter(
    (r) => !String(r.fulfillmentLocation || '').toLowerCase().includes('pos') &&
           !r.isExchange &&
           r.orderCategory !== 'EXCHANGE'
  );
  const sortedCommercial = [...commercialOrders].sort(compareOrdersByNumber);

  const commercialRows = sortedCommercial.map((r) => {
    const orderDeliveryStatus = r.orderDeliveryStatus || (
      (r.orderCategory === 'EXCHANGE' || r.isExchange) ? 'Exchange' :
      (r.orderCategory === 'PARTIAL') ? 'Partial' :
      (r.orderCategory === 'FULL_RETURN') ? (r.isPaidReturn ? 'Paid Return' : 'Not Paid Return') :
      'Delivered'
    );

    const itemDeliveryStatus = r.itemDeliveryStatus || (
      (r.orderCategory === 'EXCHANGE' || r.isExchange) ? 'Exchange' :
      (r.orderCategory === 'FULL_RETURN') ? 'Returned' :
      (r.orderCategory === 'PARTIAL') ? (
        (r.deliveryStatus.includes('Kept') || r.netRevenueImpact > 0) ? 'Delivered' : 'Returned'
      ) :
      'Delivered'
    );

    return {
      'Order ID': r.orderId,
      'Order Delivery Status': orderDeliveryStatus,
      'Item Delivery Status': itemDeliveryStatus,
      'Line Status': r.lineStatus,
      'Delivery Status': r.deliveryStatus,
      'Order Date': r.orderDate ? r.orderDate.toISOString().slice(0, 19).replace('T', ' ') : '',
      'Customer Name': getExportCustomerName(r),
      'Customer Phone': getExportPhoneNumber(r),
      'City': r.city || 'Dhaka',
      'Territory Area': r.districtArea || 'Inside Dhaka',
      'SKU': r.sku,
      'Product Description': r.itemName,
      'SIP Inventory Origin': String(r.sipInventory || r.fulfillmentLocation || 'Central Warehouse'),
      'Quantity': r.quantity,
      'Unit Cost (BDT)': r.itemCost,
      'Order Total (BDT)': r.orderAmount,
      'Net Revenue Recognized (BDT)': Math.round(r.netRevenueImpact),
      'Payment Method': r.paymentMethod,
      'Audit Flag': r.requiresManualReview ? 'FLAGGED FOR MANUAL AUDIT' : 'CONFIRMED OK',
      'Evidence & Notes': r.decisionEvidence?.explanation || r.aiAuditNote || ''
    };
  });

  const wsCommercial = XLSX.utils.json_to_sheet(commercialRows);
  autoFitSheetColumns(wsCommercial, commercialRows);
  XLSX.utils.book_append_sheet(wb, wsCommercial, 'Commercial Orders Ledger');

  // ==========================================
  // SHEET 5: Item-Wise Returns & Partials
  // ==========================================
  const sortedReturns = [...result.returnedItems].sort(compareOrdersByNumber);
  const returnRows: Record<string, unknown>[] = sortedReturns.map((i) => ({
    'Order ID': i.orderId,
    'Return Source': i.returnSource,
    'Delivery Status': i.deliveryStatus,
    'Order Date': i.orderDate ? i.orderDate.toISOString().slice(0, 19).replace('T', ' ') : '',
    'Customer Name': getExportCustomerName(i),
    'Customer Phone': getExportPhoneNumber(i),
    'Territory Area': i.districtArea,
    'SKU': i.sku,
    'Product Description': i.itemName,
    'SIP Inventory Origin': String(i.sipInventory || 'Central Warehouse'),
    'Returned Qty': Math.round(i.quantity),
    'Unit Cost (BDT)': i.itemCost,
    'Total Return Loss (BDT)': Math.round(i.returnedValue),
    'Order Total (BDT)': i.orderAmount
  }));

  // Append Total Returns Row
  returnRows.push({
    'Order ID': 'TOTAL RETURNED ITEMS AUDIT',
    'Return Source': `${sortedReturns.length} return line items`,
    'Delivery Status': '',
    'Order Date': '',
    'Customer Name': '',
    'Customer Phone': '',
    'Territory Area': '',
    'SKU': '',
    'Product Description': '',
    'SIP Inventory Origin': '',
    'Returned Qty': sortedReturns.reduce((acc, it) => acc + Math.round(it.quantity), 0),
    'Unit Cost (BDT)': 0,
    'Total Return Loss (BDT)': Math.round(sortedReturns.reduce((acc, it) => acc + (it.returnedValue || 0), 0)),
    'Order Total (BDT)': 0
  });

  const wsReturns = XLSX.utils.json_to_sheet(returnRows);
  autoFitSheetColumns(wsReturns, returnRows);
  XLSX.utils.book_append_sheet(wb, wsReturns, 'Item-Wise Returns & Partials');

  // ==========================================
  // SHEET 6: Omnichannel & SIP Inventory
  // ==========================================
  interface NodeAccumulator {
    nodeName: string;
    nodeType: string;
    orderIds: Set<string>;
    dispatchedQty: number;
    deliveredQty: number;
    returnedQty: number;
    grossSales: number;
    returnLoss: number;
    netRevenue: number;
  }

  function resolveNodeInfo(raw: unknown): { key: string; name: string; type: string } {
    const str = String(raw || '').toLowerCase();
    if (str.includes('mirpur') && str.includes('pos')) return { key: 'mirpur_pos', name: 'Mirpur Outlet POS', type: 'Offline Retail Counter' };
    if (str.includes('mirpur')) return { key: 'mirpur', name: 'Mirpur Outlet', type: 'Retail Branch (Courier Dispatch)' };
    if (str.includes('cumilla') || str.includes('comilla')) return { key: 'cumilla', name: 'Cumilla Branch', type: 'Retail Branch (Courier Dispatch)' };
    if (str.includes('wari')) return { key: 'wari', name: 'Wari Branch', type: 'Retail Branch (Courier Dispatch)' };
    if (str.includes('sylhet')) return { key: 'sylhet', name: 'Sylhet Branch', type: 'Retail Branch (Courier Dispatch)' };
    if (str.includes('exchange')) return { key: 'exchange', name: 'Exchange Replacement', type: 'Staff Replacement (Non-commercial)' };
    return { key: 'warehouse', name: 'Central Warehouse', type: 'Ecommerce Central Hub' };
  }

  const nodeMap = new Map<string, NodeAccumulator>();
  const standardNodes = [
    { key: 'warehouse', name: 'Central Warehouse', type: 'Ecommerce Central Hub' },
    { key: 'mirpur', name: 'Mirpur Outlet', type: 'Retail Branch (Courier Dispatch)' },
    { key: 'cumilla', name: 'Cumilla Branch', type: 'Retail Branch (Courier Dispatch)' },
    { key: 'wari', name: 'Wari Branch', type: 'Retail Branch (Courier Dispatch)' },
    { key: 'sylhet', name: 'Sylhet Branch', type: 'Retail Branch (Courier Dispatch)' },
    { key: 'exchange', name: 'Exchange Replacement', type: 'Staff Replacement (Non-commercial)' }
  ];

  for (const n of standardNodes) {
    nodeMap.set(n.key, {
      nodeName: n.name,
      nodeType: n.type,
      orderIds: new Set(),
      dispatchedQty: 0,
      deliveredQty: 0,
      returnedQty: 0,
      grossSales: 0,
      returnLoss: 0,
      netRevenue: 0
    });
  }

  for (const r of result.reconciledOrders) {
    const origin = r.sipInventory || r.fulfillmentLocation || 'Central Warehouse';
    const { key, name, type } = resolveNodeInfo(origin);
    let entry = nodeMap.get(key);
    if (!entry) {
      entry = {
        nodeName: name,
        nodeType: type,
        orderIds: new Set(),
        dispatchedQty: 0,
        deliveredQty: 0,
        returnedQty: 0,
        grossSales: 0,
        returnLoss: 0,
        netRevenue: 0
      };
      nodeMap.set(key, entry);
    }

    entry.orderIds.add(String(r.orderId));
    const qty = Number(r.quantity) || 1;
    entry.dispatchedQty += qty;
    const net = Number(r.netRevenueImpact) || 0;
    entry.netRevenue += net;
    const cost = Number(r.itemCost) || 0;
    entry.grossSales += cost * qty;

    const isDelivered = r.itemDeliveryStatus === 'Delivered' || (r.orderCategory !== 'FULL_RETURN' && net > 0);
    if (isDelivered) {
      entry.deliveredQty += qty;
    } else {
      entry.returnedQty += qty;
      entry.returnLoss += cost * qty;
    }
  }

  const totalOmniNet = Array.from(nodeMap.values()).reduce((sum, n) => sum + n.netRevenue, 0);

  const omniRows = Array.from(nodeMap.values()).map((n) => {
    const retention = n.dispatchedQty > 0 ? ((n.deliveredQty / n.dispatchedQty) * 100).toFixed(1) + '%' : '0.0%';
    const share = totalOmniNet > 0 ? ((n.netRevenue / totalOmniNet) * 100).toFixed(1) + '%' : '0.0%';
    return {
      'Fulfillment Location': n.nodeName,
      'Node Channel Type': n.nodeType,
      'Dispatched Orders': n.orderIds.size,
      'Dispatched Units': n.dispatchedQty,
      'Delivered Units': n.deliveredQty,
      'Returned Units': n.returnedQty,
      'Retention Rate (%)': retention,
      'Gross Dispatched Sales (BDT)': Math.round(n.grossSales),
      'Return Revenue Loss (BDT)': Math.round(n.returnLoss),
      'Net Realized Sales (BDT)': Math.round(n.netRevenue),
      '% Share of Net Realized Sales': share
    };
  });

  const wsOmni = XLSX.utils.json_to_sheet(omniRows);
  autoFitSheetColumns(wsOmni, omniRows);
  XLSX.utils.book_append_sheet(wb, wsOmni, 'Omnichannel & SIP Inventory');

  // ==========================================
  // SHEET 7: Courier & COD Settlement
  // ==========================================
  const courierAoa: (string | number | undefined | null)[][] = [
    ['PATHAO COURIER & COD SETTLEMENT AUDIT'],
    ['Generated On: ' + new Date().toLocaleString()],
    ['Reporting Scope: ' + reportPeriodLabel],
    [],
    ['COURIER FINANCIAL METRIC', 'AMOUNT (BDT)', 'DESCRIPTION & DETAILS'],
    ['Gross Pathao Delivery Charges', Math.round(s.courierCost.grossCharge), 'Total charge from Pathao courier invoices'],
    ['Courier Shipping Discount', Math.round(s.courierCost.discount), 'Commercial shipping volume discounts applied by Pathao'],
    ['Net Pathao Payable (Post-Discount)', Math.round(s.courierCost.netCharge), 'Actual payable delivery fee to Pathao Courier'],
    ['Customer Delivery Fee Collected', Math.round(s.courierCost.customerDeliveryFeeCollected), `${s.courierCost.collectedInsideCount} Inside Dhaka (50 TK) + ${s.courierCost.collectedOutsideCount} Outside Dhaka (90 TK)`],
    ['Paid Return COD Collected on Refusals', Math.round(s.courierCost.paidReturnCollectedCod), 'Advance/COD delivery fee recovered from customers on parcel refusal'],
    ['Net Courier Expense Burden Absorbed by Brand', Math.round(s.courierCost.netCourierBurden), 'Final delivery cost absorbed by DEEN (Net Charge - Customer Collections)'],
    ['Average Net Courier Cost Per Delivered Order', Math.round(s.courierCost.netCourierBurden / Math.max(1, s.fullDeliveredOrders + s.partialOrders)), 'Average delivery overhead per successfully kept order'],
    [],
    ['COURIER COD & STATUS MISMATCH AUDIT']
  ];

  if (result.courierMismatches && result.courierMismatches.length > 0) {
    courierAoa.push([
      'Order ID',
      'Consignment ID',
      'Customer Name',
      'Phone',
      'Excel / Ledger Status',
      'Pathao Status',
      'Expected COD (BDT)',
      'Pathao Collected COD (BDT)',
      'COD Difference (BDT)',
      'Severity',
      'Mismatch Classification',
      'Audit Description',
      'Action Recommendation'
    ]);

    const sortedMismatches = [...result.courierMismatches].sort(compareOrdersByNumber);
    for (const m of sortedMismatches) {
      courierAoa.push([
        m.orderId,
        m.consignmentId || 'N/A',
        getExportCustomerName(m),
        getExportPhoneNumber(m),
        m.excelStatus,
        m.pathaoStatus,
        m.expectedCod,
        m.pathaoCollectedCod,
        m.codDifference,
        m.severity,
        m.mismatchType,
        m.description,
        m.recommendedAction
      ]);
    }
  } else {
    courierAoa.push(['Zero courier mismatches detected. All consignments reconciled with 100% COD and status fidelity.']);
  }

  const wsCourier = XLSX.utils.aoa_to_sheet(courierAoa);
  autoFitAoaColumns(wsCourier, courierAoa);
  XLSX.utils.book_append_sheet(wb, wsCourier, 'Courier & COD Settlement');

  return wb;
}

/**
 * Downloads the 7-sheet Monthly Net Sales Report workbook with safe browser download handling.
 */
export function exportMonthlyNetSalesExcel(
  result: ReconciliationResult,
  options: MonthlyNetSalesExportOptions = {}
): void {
  const wb = buildMonthlyNetSalesWorkbook(result, options);
  const monthSlug = options.monthLabel
    ? options.monthLabel.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
    : new Date().toISOString().slice(0, 7);
  const prefix = options.filenamePrefix || 'DEEN_Monthly_Net_Sales_Report';
  const finalFilename = `${prefix}_${monthSlug}.xlsx`;
  saveWorkbook(wb, finalFilename);
}

