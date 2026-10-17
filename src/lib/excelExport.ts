import * as XLSX from 'xlsx';
import { ReconciliationResult } from './reconciliationEngine';
import { cleanCustomerPhone } from './woocommerceClient';

/**
 * Natural numerical order comparator for sorting orders.
 * Orders like "17263", "17263 c", "17264", "D-17265" sort in natural numerical order.
 */
export function compareOrdersByNumber(a: any, b: any): number {
  const idA = String(a?.['Order ID'] || a?.orderId || a?.orderNumber || a?.['WooCommerce Order #'] || a?.id || '').trim();
  const idB = String(b?.['Order ID'] || b?.orderId || b?.orderNumber || b?.['WooCommerce Order #'] || b?.id || '').trim();

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
export function getExportCustomerName(o: any): string {
  if (!o) return 'Customer';
  const candidates = [
    o.rawCustomerName,
    o['Customer Name'],
    o.customerName,
    o['Full Name (Shipping)'],
    o['Billing Name'],
    o.recipientName,
    o['Recipient Name'],
    o.billing?.first_name ? `${o.billing.first_name} ${o.billing.last_name || ''}`.trim() : undefined,
    o.shipping?.first_name ? `${o.shipping.first_name} ${o.shipping.last_name || ''}`.trim() : undefined,
    o.Name,
    o.name,
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
export function getExportPhoneNumber(o: any): string {
  if (!o) return '';
  const candidates = [
    o.rawPhone,
    o.formattedPhone,
    o.Phone,
    o.phone,
    o['Phone (Shipping)'],
    o['Billing Phone'],
    o.recipientPhone,
    o['Recipient Phone'],
    o.billing?.phone,
    o.shipping?.phone,
    o.contact,
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

export function exportReconciledExcel(result: ReconciliationResult, filenamePrefix: string = 'DEEN_Commerce_Reconciliation') {
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
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // 2. Reconciled Orders Ledger Sheet (Sorted by Order Number)
  const sortedReconciledOrders = [...result.reconciledOrders].sort(compareOrdersByNumber);
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
    'Returned Qty': i.quantity,
    'Unit Price (BDT)': i.itemCost,
    'Total Returned Value (BDT)': Math.round(i.returnedValue),
    'Order Total (BDT)': i.orderAmount
  }));
  const wsRet = XLSX.utils.json_to_sheet(retData);
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
function saveWorkbook(wb: XLSX.WorkBook, filename: string) {
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

    if ((window.navigator as any)?.msSaveOrOpenBlob) {
      (window.navigator as any).msSaveOrOpenBlob(blob, filename);
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
