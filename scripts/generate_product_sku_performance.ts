import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { formatWooCommerceToOrderRows } from '../src/lib/woocommerceClient';
import { extractBaseOrderId, cleanOrderId } from '../src/lib/sync/liveTerminalSync';

// 1. Read Pathao Manifest
const pathaoFile = path.join(process.cwd(), 'Sample Docs', 'Oct Pathao Delivey Order Lists.xlsx');
console.log(`Loading Pathao Manifest: ${pathaoFile}`);
const wbP = XLSX.readFile(pathaoFile);
const rawPathaoData = XLSX.utils.sheet_to_json(wbP.Sheets['Oct All'], { header: 1 }) as any[][];

interface PathaoSummary {
  consignmentIds: string[];
  statuses: string[];
  collected: number;
  collectable: number;
  fee: number;
  territory: string;
}

const pathaoByOrder = new Map<string, PathaoSummary>();

for (let i = 1; i < rawPathaoData.length; i++) {
  const row = rawPathaoData[i];
  if (!row || row.length === 0) continue;
  const mId = String(row[3] || '').trim();
  const consId = String(row[0] || '').trim();
  const status = String(row[17] || '').trim().toLowerCase();
  const collected = parseFloat(row[12] || '0');
  const collectable = parseFloat(row[11] || '0');
  const fee = parseFloat(row[13] || '0');
  const territory = String(row[8] || 'Outside Dhaka').trim();

  const updateEntry = (key: string) => {
    if (!key) return;
    if (!pathaoByOrder.has(key)) {
      pathaoByOrder.set(key, {
        consignmentIds: [],
        statuses: [],
        collected: 0,
        collectable: 0,
        fee: 0,
        territory,
      });
    }
    const entry = pathaoByOrder.get(key)!;
    if (consId && !entry.consignmentIds.includes(consId)) entry.consignmentIds.push(consId);
    entry.statuses.push(status);
    entry.collected += collected;
    entry.collectable += collectable;
    entry.fee += fee;
    if (territory && territory !== 'Outside Dhaka') entry.territory = territory;
  };

  const baseId = extractBaseOrderId(mId);
  const cleanId = cleanOrderId(mId);

  updateEntry(mId);
  if (baseId && baseId !== mId) updateEntry(baseId);
  if (cleanId && cleanId !== mId && cleanId !== baseId) updateEntry(cleanId);
}

console.log(`Indexed Pathao records for ${pathaoByOrder.size} order keys.`);

// 2. Read Raw WooCommerce Orders
const rawOrdersPath = path.join(process.cwd(), 'src', 'data', 'october2026_raw_orders.json');
const rawOrders = JSON.parse(fs.readFileSync(rawOrdersPath, 'utf8'));
console.log(`Loaded ${rawOrders.length} raw WooCommerce orders.`);

// 3. Format into item-level rows
const allRows = formatWooCommerceToOrderRows(rawOrders);
console.log(`Transformed into ${allRows.length} item line records.`);

// Group raw rows by Order ID to perform partial knapsack reconciliation
const orderItemsMap = new Map<string, typeof allRows>();
allRows.forEach((r) => {
  const oId = String(r['Order ID']);
  if (!orderItemsMap.has(oId)) orderItemsMap.set(oId, []);
  orderItemsMap.get(oId)!.push(r);
});

// Helper: Solve Partial Order Knapsack (matching collected amount minus 50/90 delivery fee to line item price)
function resolvePartialOrderItems(items: typeof allRows, collected: number): { deliveredIndices: Set<number> } {
  const deliveredIndices = new Set<number>();
  const shippingCandidates = [0, 50, 60, 70, 80, 90, 100, 110, 120, 130, 150];

  let bestMatch: number[] | null = null;
  let minDiff = Infinity;

  // Generate all non-empty subsets of items
  const n = items.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    let subsetSum = 0;
    const currentIndices: number[] = [];
    for (let i = 0; i < n; i++) {
      if ((mask & (1 << i)) !== 0) {
        currentIndices.push(i);
        const qty = Number(items[i].Quantity || 1);
        const cost = Number(items[i]['Item Cost'] || 0);
        subsetSum += qty * cost;
      }
    }

    // Check with shipping fees
    for (const ship of shippingCandidates) {
      const diff = Math.abs(subsetSum + ship - collected);
      if (diff < minDiff) {
        minDiff = diff;
        bestMatch = currentIndices;
      }
    }
  }

  if (bestMatch && minDiff <= 15) {
    bestMatch.forEach((idx) => deliveredIndices.add(idx));
  } else {
    // Default fallback: first item delivered, remaining returned
    deliveredIndices.add(0);
  }

  return { deliveredIndices };
}

// 4. Line-Item Disposition Classification
interface ClassifiedItem {
  orderId: string;
  orderNumber: string;
  category: string;
  subCategory: string;
  productName: string;
  baseProductName: string;
  sku: string;
  size: string;
  unitPrice: number;
  quantity: number;
  totalValue: number;
  channel: 'Online Checkout' | 'POS In-Store' | 'Admin Exchange';
  fulfillmentStatus: 'Delivered' | 'Returned' | 'Paid Return' | 'Exchanged' | 'In Transit' | 'Cancelled' | 'Pending';
  isDelivered: boolean;
  isOnlineDelivered: boolean;
  isPosSold: boolean;
  isReturned: boolean;
  isPaidReturn: boolean;
  isNonPaidReturn: boolean;
  isExchanged: boolean;
  isCancelled: boolean;
}

const classifiedItems: ClassifiedItem[] = [];

orderItemsMap.forEach((items, oId) => {
  const pathao = pathaoByOrder.get(oId);
  const rawOrder = rawOrders.find((o: any) => String(o.id) === oId || String(o.number) === oId);
  const wcStatus = String(rawOrder?.status || items[0].status || '').toLowerCase();
  const isPos = Boolean(items[0].isPos);
  const isExchange = Boolean(items[0].isExchange || items[0].createdVia === 'sip_exchange');

  const statuses = pathao?.statuses || [];
  const hasPartial = statuses.some((s) => s.includes('partial'));
  const hasPaidReturn = statuses.some((s) => s === 'paid return');
  const hasReturn = statuses.some((s) => s.includes('return') || s === 'returned to merchant');
  const hasDelivered = statuses.some((s) => s === 'delivered' || s.includes('delivered'));
  const hasExchangeCourier = statuses.some((s) => s.includes('exchange'));
  const hasInTransit = statuses.some((s) => s.includes('transit') || s.includes('assigned'));
  const hasPickupCancel = statuses.every((s) => s.includes('pickup cancel'));

  let partialDeliveredSet = new Set<number>();
  if (hasPartial) {
    const { deliveredIndices } = resolvePartialOrderItems(items, pathao?.collected || 0);
    partialDeliveredSet = deliveredIndices;
  }

  items.forEach((item, index) => {
    const qty = Number(item.Quantity || item.quantity || 1);
    const cost = Number(item['Item Cost'] || item.itemCost || 0);
    const val = qty * cost;

    const cat = String(item.Category || item.category || 'Others').trim();
    const subCat = String(item.Subcategory || item.subCategory || 'General').trim();
    const rawName = String(item['Item Name'] || item.itemName || 'Product').trim();
    const baseName = rawName.replace(/\s*-\s*(s|m|l|xl|xxl|2xl|3xl|4xl|28|30|32|34|36|38|40|42|free size|regular)\s*$/i, '').trim();
    const sku = String(item.SKU || item.sku || 'GENERAL').trim();
    const size = String(item.Size || item.size || 'Regular').toUpperCase().trim();

    let channel: 'Online Checkout' | 'POS In-Store' | 'Admin Exchange' = 'Online Checkout';
    if (isExchange) channel = 'Admin Exchange';
    else if (isPos) channel = 'POS In-Store';

    let status: 'Delivered' | 'Returned' | 'Paid Return' | 'Exchanged' | 'In Transit' | 'Cancelled' | 'Pending' = 'Pending';
    let isDelivered = false;
    let isOnlineDelivered = false;
    let isPosSold = false;
    let isReturned = false;
    let isPaidReturn = false;
    let isNonPaidReturn = false;
    let isExchanged = false;
    let isCancelled = false;

    if (channel === 'Admin Exchange') {
      status = 'Exchanged';
      isExchanged = true;
    } else if (channel === 'POS In-Store') {
      status = 'Delivered';
      isDelivered = true;
      isPosSold = true;
    } else if (hasPartial) {
      if (partialDeliveredSet.has(index)) {
        status = 'Delivered';
        isDelivered = true;
        isOnlineDelivered = true;
      } else {
        status = 'Returned';
        isReturned = true;
        isNonPaidReturn = true;
      }
    } else if (hasPaidReturn) {
      status = 'Paid Return';
      isReturned = true;
      isPaidReturn = true;
    } else if (hasReturn) {
      status = 'Returned';
      isReturned = true;
      isNonPaidReturn = true;
    } else if (hasDelivered) {
      status = 'Delivered';
      isDelivered = true;
      isOnlineDelivered = true;
    } else if (hasExchangeCourier) {
      status = 'Exchanged';
      isExchanged = true;
    } else if (hasInTransit) {
      status = 'In Transit';
    } else if (wcStatus === 'cancelled' || hasPickupCancel) {
      status = 'Cancelled';
      isCancelled = true;
    } else if (wcStatus === 'completed') {
      status = 'Delivered';
      isDelivered = true;
      isOnlineDelivered = true;
    } else {
      status = 'Pending';
      isCancelled = true; // pre-dispatch / on-hold
    }

    classifiedItems.push({
      orderId: oId,
      orderNumber: String(item.orderNumber || oId),
      category: cat,
      subCategory: subCat,
      productName: rawName,
      baseProductName: baseName,
      sku,
      size,
      unitPrice: cost,
      quantity: qty,
      totalValue: val,
      channel,
      fulfillmentStatus: status,
      isDelivered,
      isOnlineDelivered,
      isPosSold,
      isReturned,
      isPaidReturn,
      isNonPaidReturn,
      isExchanged,
      isCancelled,
    });
  });
});

console.log(`Classified ${classifiedItems.length} line items.`);

// 5. Build Aggregation Engine
interface AggregatedMetrics {
  category: string;
  subCategory: string;
  name: string;
  sku: string;
  size: string;
  unitPrice: number;
  variantsCount?: number;
  orderedQty: number;
  grossValue: number;
  deliveredQty: number;
  deliveredValue: number;
  onlineDeliveredQty: number;
  onlineDeliveredValue: number;
  posSoldQty: number;
  posSoldValue: number;
  returnedQty: number;
  paidReturnQty: number;
  nonPaidReturnQty: number;
  returnedValue: number;
  exchangedQty: number;
  exchangedValue: number;
  cancelledQty: number;
}

function createEmptyAgg(cat: string, subCat: string, name: string, sku: string, size: string, price: number): AggregatedMetrics {
  return {
    category: cat,
    subCategory: subCat,
    name,
    sku,
    size,
    unitPrice: price,
    variantsCount: 0,
    orderedQty: 0,
    grossValue: 0,
    deliveredQty: 0,
    deliveredValue: 0,
    onlineDeliveredQty: 0,
    onlineDeliveredValue: 0,
    posSoldQty: 0,
    posSoldValue: 0,
    returnedQty: 0,
    paidReturnQty: 0,
    nonPaidReturnQty: 0,
    returnedValue: 0,
    exchangedQty: 0,
    exchangedValue: 0,
    cancelledQty: 0,
  };
}

function addMetrics(agg: AggregatedMetrics, item: ClassifiedItem) {
  agg.orderedQty += item.quantity;
  agg.grossValue += item.totalValue;

  if (item.isDelivered) {
    agg.deliveredQty += item.quantity;
    agg.deliveredValue += item.totalValue;
  }
  if (item.isOnlineDelivered) {
    agg.onlineDeliveredQty += item.quantity;
    agg.onlineDeliveredValue += item.totalValue;
  }
  if (item.isPosSold) {
    agg.posSoldQty += item.quantity;
    agg.posSoldValue += item.totalValue;
  }
  if (item.isReturned) {
    agg.returnedQty += item.quantity;
    agg.returnedValue += item.totalValue;
    if (item.isPaidReturn) agg.paidReturnQty += item.quantity;
    if (item.isNonPaidReturn) agg.nonPaidReturnQty += item.quantity;
  }
  if (item.isExchanged) {
    agg.exchangedQty += item.quantity;
    agg.exchangedValue += item.totalValue;
  }
  if (item.isCancelled) {
    agg.cancelledQty += item.quantity;
  }
}

// 5A. Category Map
const catAggMap = new Map<string, AggregatedMetrics>();
// 5B. Product Map
const prodAggMap = new Map<string, AggregatedMetrics>();
const prodVariantsSet = new Map<string, Set<string>>();
// 5C. SKU Map
const skuAggMap = new Map<string, AggregatedMetrics>();

for (const it of classifiedItems) {
  // Category Aggregation
  if (!catAggMap.has(it.category)) {
    catAggMap.set(it.category, createEmptyAgg(it.category, '', it.category, '', '', 0));
  }
  addMetrics(catAggMap.get(it.category)!, it);

  // Product Aggregation
  if (!prodAggMap.has(it.baseProductName)) {
    prodAggMap.set(it.baseProductName, createEmptyAgg(it.category, it.subCategory, it.baseProductName, it.sku, 'All Sizes', it.unitPrice));
    prodVariantsSet.set(it.baseProductName, new Set<string>());
  }
  addMetrics(prodAggMap.get(it.baseProductName)!, it);
  prodVariantsSet.get(it.baseProductName)!.add(`${it.sku}_${it.size}`);

  // SKU Aggregation (SKU + Size)
  const skuKey = `${it.sku}__${it.size}__${it.productName}`;
  if (!skuAggMap.has(skuKey)) {
    skuAggMap.set(skuKey, createEmptyAgg(it.category, it.subCategory, it.productName, it.sku, it.size, it.unitPrice));
  }
  addMetrics(skuAggMap.get(skuKey)!, it);
}

// Attach variant counts to products
prodAggMap.forEach((agg, name) => {
  agg.variantsCount = prodVariantsSet.get(name)?.size || 1;
});

// Performance Tag Generator
function getPerformanceTag(delivRate: number, retRate: number, exchRate: number, orderedQty: number): string {
  if (orderedQty >= 50 && delivRate >= 85) return '🌟 Top Seller';
  if (orderedQty >= 40 && delivRate >= 75) return '⚡ Volume Driver';
  if (retRate >= 20.0 && orderedQty >= 10) return '⚠️ High Return Alert';
  if (exchRate >= 8.0 && orderedQty >= 10) return '🔄 High Exchange Alert';
  if (delivRate >= 90) return '✅ High Retention';
  return '⚖️ Steady Contributor';
}

// Format Category Rows
const totalBrandDeliveredValue = Array.from(catAggMap.values()).reduce((sum, c) => sum + c.deliveredValue, 0);

const categorySheetRows = Array.from(catAggMap.values())
  .sort((a, b) => b.grossValue - a.grossValue)
  .map((c) => {
    const delivRate = c.orderedQty > 0 ? (c.deliveredQty / c.orderedQty) * 100 : 0;
    const retRate = c.orderedQty > 0 ? (c.returnedQty / c.orderedQty) * 100 : 0;
    const exchRate = c.orderedQty > 0 ? (c.exchangedQty / c.orderedQty) * 100 : 0;
    const share = totalBrandDeliveredValue > 0 ? (c.deliveredValue / totalBrandDeliveredValue) * 100 : 0;

    return {
      'Apparel Category': c.category,
      'Ordered Units': c.orderedQty,
      'Gross Ordered Value (৳)': Math.round(c.grossValue),
      'Total Delivered Units': c.deliveredQty,
      'Delivered Value (৳)': Math.round(c.deliveredValue),
      'Online Courier Delivered': c.onlineDeliveredQty,
      'POS In-Store Retail Sold': c.posSoldQty,
      'Total Returned Units': c.returnedQty,
      'Paid Returns (Refusal COD)': c.paidReturnQty,
      'Non-Paid Returns (Rejected)': c.nonPaidReturnQty,
      'Returned Value (৳)': Math.round(c.returnedValue),
      'Exchanged Units': c.exchangedQty,
      'Exchanged Value (৳)': Math.round(c.exchangedValue),
      'Cancelled / Unfulfilled Units': c.cancelledQty,
      'Delivery Rate (%)': `${delivRate.toFixed(1)}%`,
      'Return Rate (%)': `${retRate.toFixed(1)}%`,
      'Exchange Rate (%)': `${exchRate.toFixed(1)}%`,
      'Brand Revenue Share (%)': `${share.toFixed(1)}%`,
      'Performance Status': getPerformanceTag(delivRate, retRate, exchRate, c.orderedQty),
    };
  });

// Format Product Rows
const productSheetRows = Array.from(prodAggMap.values())
  .sort((a, b) => b.grossValue - a.grossValue)
  .map((p) => {
    const delivRate = p.orderedQty > 0 ? (p.deliveredQty / p.orderedQty) * 100 : 0;
    const retRate = p.orderedQty > 0 ? (p.returnedQty / p.orderedQty) * 100 : 0;
    const exchRate = p.orderedQty > 0 ? (p.exchangedQty / p.orderedQty) * 100 : 0;
    const avgPrice = p.orderedQty > 0 ? Math.round(p.grossValue / p.orderedQty) : p.unitPrice;

    return {
      'Category': p.category,
      'Sub-Category': p.subCategory,
      'Product Name': p.name,
      'Base SKU': p.sku,
      'Size Variations': p.variantsCount,
      'Unit Price (৳)': avgPrice,
      'Ordered Units': p.orderedQty,
      'Gross Ordered Value (৳)': Math.round(p.grossValue),
      'Total Delivered Units': p.deliveredQty,
      'Delivered Value (৳)': Math.round(p.deliveredValue),
      'Online Courier Delivered': p.onlineDeliveredQty,
      'POS In-Store Sold': p.posSoldQty,
      'Total Returned Units': p.returnedQty,
      'Paid Returns': p.paidReturnQty,
      'Non-Paid Returns': p.nonPaidReturnQty,
      'Returned Value (৳)': Math.round(p.returnedValue),
      'Exchanged Units': p.exchangedQty,
      'Exchanged Value (৳)': Math.round(p.exchangedValue),
      'Cancelled / Unfulfilled Units': p.cancelledQty,
      'Delivery Rate (%)': `${delivRate.toFixed(1)}%`,
      'Return Rate (%)': `${retRate.toFixed(1)}%`,
      'Exchange Rate (%)': `${exchRate.toFixed(1)}%`,
      'Performance Tag': getPerformanceTag(delivRate, retRate, exchRate, p.orderedQty),
    };
  });

// Format SKU Rows
const skuSheetRows = Array.from(skuAggMap.values())
  .sort((a, b) => b.grossValue - a.grossValue)
  .map((s) => {
    const delivRate = s.orderedQty > 0 ? (s.deliveredQty / s.orderedQty) * 100 : 0;
    const retRate = s.orderedQty > 0 ? (s.returnedQty / s.orderedQty) * 100 : 0;
    const exchRate = s.orderedQty > 0 ? (s.exchangedQty / s.orderedQty) * 100 : 0;

    return {
      'Category': s.category,
      'Sub-Category': s.subCategory,
      'Product Name': s.name,
      'SKU Code': s.sku,
      'Size': s.size,
      'Unit Price (৳)': s.unitPrice,
      'Ordered Units': s.orderedQty,
      'Gross Ordered Value (৳)': Math.round(s.grossValue),
      'Total Delivered Units': s.deliveredQty,
      'Delivered Value (৳)': Math.round(s.deliveredValue),
      'Online Courier Delivered': s.onlineDeliveredQty,
      'POS In-Store Sold': s.posSoldQty,
      'Total Returned Units': s.returnedQty,
      'Paid Returns': s.paidReturnQty,
      'Non-Paid Returns': s.nonPaidReturnQty,
      'Returned Value (৳)': Math.round(s.returnedValue),
      'Exchanged Units': s.exchangedQty,
      'Exchanged Value (৳)': Math.round(s.exchangedValue),
      'Cancelled / Unfulfilled Units': s.cancelledQty,
      'Delivery Rate (%)': `${delivRate.toFixed(1)}%`,
      'Return Rate (%)': `${retRate.toFixed(1)}%`,
      'Exchange Rate (%)': `${exchRate.toFixed(1)}%`,
      'Performance Tag': getPerformanceTag(delivRate, retRate, exchRate, s.orderedQty),
    };
  });

// Helper: Auto-Fit Column Widths
function autoFitColumns(sheet: XLSX.WorkSheet, data: any[]) {
  if (!data || data.length === 0) return;
  const colNames = Object.keys(data[0]);
  const colWidths = colNames.map((col) => {
    let maxLen = col.length;
    for (const row of data) {
      const valStr = String(row[col] ?? '');
      if (valStr.length > maxLen) maxLen = valStr.length;
    }
    return { wch: Math.min(Math.max(maxLen + 3, 12), 48) };
  });
  sheet['!cols'] = colWidths;
}

// 6. Build Standalone Workbook: October 2026 Product & SKU Performance.xlsx
const standAloneWb = XLSX.utils.book_new();

const wsCat = XLSX.utils.json_to_sheet(categorySheetRows);
autoFitColumns(wsCat, categorySheetRows);
XLSX.utils.book_append_sheet(standAloneWb, wsCat, 'Category Performance');

const wsProd = XLSX.utils.json_to_sheet(productSheetRows);
autoFitColumns(wsProd, productSheetRows);
XLSX.utils.book_append_sheet(standAloneWb, wsProd, 'Product Performance');

const wsSku = XLSX.utils.json_to_sheet(skuSheetRows);
autoFitColumns(wsSku, skuSheetRows);
XLSX.utils.book_append_sheet(standAloneWb, wsSku, 'SKU & Size Performance');

// Save Standalone File
const standAloneFilePath = path.join(process.cwd(), 'Sample Docs', 'October 2026 Product & SKU Performance.xlsx');
XLSX.writeFile(standAloneWb, standAloneFilePath);
console.log(`✅ Saved standalone report: ${standAloneFilePath}`);

// 7. Append New Sheets into Master: October 2026 Checkout Orders List.xlsx
const masterFile = path.join(process.cwd(), 'Sample Docs', 'October 2026 Checkout Orders List.xlsx');
const masterWb = XLSX.readFile(masterFile);

// Check and replace/append sheets
const appendOrReplaceSheet = (wb: XLSX.WorkBook, ws: XLSX.WorkSheet, name: string) => {
  const existingIdx = wb.SheetNames.indexOf(name);
  if (existingIdx !== -1) {
    wb.Sheets[name] = ws;
  } else {
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
};

const wsMasterCat = XLSX.utils.json_to_sheet(categorySheetRows);
autoFitColumns(wsMasterCat, categorySheetRows);
appendOrReplaceSheet(masterWb, wsMasterCat, 'Category Performance');

const wsMasterProd = XLSX.utils.json_to_sheet(productSheetRows);
autoFitColumns(wsMasterProd, productSheetRows);
appendOrReplaceSheet(masterWb, wsMasterProd, 'Product Performance');

const wsMasterSku = XLSX.utils.json_to_sheet(skuSheetRows);
autoFitColumns(wsMasterSku, skuSheetRows);
appendOrReplaceSheet(masterWb, wsMasterSku, 'SKU Performance');

XLSX.writeFile(masterWb, masterFile);
console.log(`✅ Appended Category, Product, and SKU sheets to Master workbook: ${masterFile}`);

// 8. Re-Export High-Performance CSVs
const csvProdPath = path.join(process.cwd(), 'Sample Docs', 'October_2026_Product_Performance.csv');
const csvSkuPath = path.join(process.cwd(), 'Sample Docs', 'October_2026_SKU_Performance.csv');
fs.writeFileSync(csvProdPath, XLSX.utils.sheet_to_csv(wsProd), 'utf8');
fs.writeFileSync(csvSkuPath, XLSX.utils.sheet_to_csv(wsSku), 'utf8');
console.log(`✅ Saved CSV exports: ${csvProdPath} and ${csvSkuPath}`);

