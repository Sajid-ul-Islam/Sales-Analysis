import fs from 'fs';
import * as XLSX from 'xlsx';
import { formatWooCommerceToOrderRows } from '../src/lib/woocommerceClient';
import { extractBaseOrderId, cleanOrderId } from '../src/lib/sync/liveTerminalSync';

// Read Pathao Manifest
const pathaoFile = 'Sample Docs/Oct Pathao Delivey Order Lists.xlsx';
const wbP = XLSX.readFile(pathaoFile);
const rawPathaoData = XLSX.utils.sheet_to_json(wbP.Sheets['Oct All'], { header: 1 }) as any[][];

const pathaoByOrder = new Map<string, any[]>();
for (let i = 1; i < rawPathaoData.length; i++) {
  const row = rawPathaoData[i];
  if (!row || row.length === 0) continue;
  const merchantOrderId = String(row[3] || '').trim();
  const rec = {
    consignmentId: String(row[0] || '').trim(),
    orderStatus: String(row[17] || '').trim(),
    orderType: String(row[20] || 'Delivery').trim(),
    collected: parseFloat(row[12] || '0'),
    collectable: parseFloat(row[11] || '0'),
    fee: parseFloat(row[13] || '0'),
  };

  const rawMId = merchantOrderId;
  const baseId = extractBaseOrderId(rawMId);
  const cleanId = cleanOrderId(rawMId);

  [rawMId, baseId, cleanId].forEach((id) => {
    if (id) {
      if (!pathaoByOrder.has(id)) pathaoByOrder.set(id, []);
      pathaoByOrder.get(id)!.push(rec);
    }
  });
}

// Read raw orders
const rawOrders = JSON.parse(fs.readFileSync('src/data/october2026_raw_orders.json', 'utf8'));
const allRows = formatWooCommerceToOrderRows(rawOrders);

interface SkuAgg {
  category: string;
  subCategory: string;
  productName: string;
  sku: string;
  size: string;
  unitPrice: number;
  totalOrderedQty: number;
  grossOrderedValue: number;
  deliveredQty: number;
  deliveredValue: number;
  posSoldQty: number;
  posSoldValue: number;
  onlineDeliveredQty: number;
  onlineDeliveredValue: number;
  exchangedQty: number;
  exchangedValue: number;
  returnedQty: number;
  returnedValue: number;
  paidReturnQty: number;
  nonPaidReturnQty: number;
  partialQty: number;
  inTransitQty: number;
  cancelledQty: number;
}

const skuMap = new Map<string, SkuAgg>();
const productMap = new Map<string, SkuAgg>();
const categoryMap = new Map<string, SkuAgg>();

for (const row of allRows) {
  const oId = row['Order ID'];
  const qty = Number(row.Quantity || row.quantity || 1);
  const cost = Number(row['Item Cost'] || row.itemCost || 0);
  const val = qty * cost;

  const cat = String(row.Category || row.category || 'Others').trim();
  const subCat = String(row.Subcategory || row.subCategory || 'General').trim();
  const rawName = String(row['Item Name'] || row.itemName || 'Product').trim();
  const baseName = rawName.replace(/\s*-\s*(s|m|l|xl|xxl|2xl|3xl|4xl|28|30|32|34|36|38|40|42|free size|regular)\s*$/i, '').trim();
  const sku = String(row.SKU || row.sku || 'GENERAL').trim();
  const size = String(row.Size || row.size || '').toUpperCase().trim();

  const isPos = Boolean(row.isPos);
  const isExchange = Boolean(row.isExchange || row.createdVia === 'sip_exchange');
  const wcStatus = String(row.status || '').toLowerCase();

  const pathaoRecs = pathaoByOrder.get(oId) || [];
  const statuses = pathaoRecs.map((r) => r.orderStatus.toLowerCase());

  // Determine item disposition
  let isDelivered = false;
  let isPosSold = false;
  let isOnlineDelivered = false;
  let isReturned = false;
  let isPaidReturn = false;
  let isNonPaidReturn = false;
  let isExch = false;
  let isPart = false;
  let isInTrans = false;
  let isCanc = false;

  if (isExchange) {
    isExch = true;
  } else if (isPos) {
    isPosSold = true;
    isDelivered = true;
  } else if (statuses.some((s) => s.includes('partial'))) {
    isPart = true;
    // For partial in DEEN: typically 1 item accepted, 1 returned.
    // If order has 1 item and partial, it was delivered. If multiple, we attribute proportionally or to delivered.
    isDelivered = true;
    isOnlineDelivered = true;
  } else if (statuses.some((s) => s === 'paid return')) {
    isReturned = true;
    isPaidReturn = true;
  } else if (statuses.some((s) => s.includes('return'))) {
    isReturned = true;
    isNonPaidReturn = true;
  } else if (statuses.some((s) => s === 'delivered' || s.includes('delivered'))) {
    isDelivered = true;
    isOnlineDelivered = true;
  } else if (statuses.some((s) => s.includes('transit') || s.includes('assigned'))) {
    isInTrans = true;
  } else if (wcStatus === 'cancelled' || statuses.some((s) => s.includes('pickup cancel'))) {
    isCanc = true;
  } else if (wcStatus === 'completed') {
    isDelivered = true;
    isOnlineDelivered = true;
  } else {
    isCanc = true; // unfulfilled / pending
  }

  // Helper updater
  const updateAgg = (map: Map<string, SkuAgg>, key: string, nameToUse: string, skuToUse: string, sizeToUse: string) => {
    if (!map.has(key)) {
      map.set(key, {
        category: cat,
        subCategory: subCat,
        productName: nameToUse,
        sku: skuToUse,
        size: sizeToUse,
        unitPrice: cost,
        totalOrderedQty: 0,
        grossOrderedValue: 0,
        deliveredQty: 0,
        deliveredValue: 0,
        posSoldQty: 0,
        posSoldValue: 0,
        onlineDeliveredQty: 0,
        onlineDeliveredValue: 0,
        exchangedQty: 0,
        exchangedValue: 0,
        returnedQty: 0,
        returnedValue: 0,
        paidReturnQty: 0,
        nonPaidReturnQty: 0,
        partialQty: 0,
        inTransitQty: 0,
        cancelledQty: 0,
      });
    }
    const entry = map.get(key)!;
    entry.totalOrderedQty += qty;
    entry.grossOrderedValue += val;
    if (isDelivered) {
      entry.deliveredQty += qty;
      entry.deliveredValue += val;
    }
    if (isPosSold) {
      entry.posSoldQty += qty;
      entry.posSoldValue += val;
    }
    if (isOnlineDelivered) {
      entry.onlineDeliveredQty += qty;
      entry.onlineDeliveredValue += val;
    }
    if (isReturned) {
      entry.returnedQty += qty;
      entry.returnedValue += val;
      if (isPaidReturn) entry.paidReturnQty += qty;
      if (isNonPaidReturn) entry.nonPaidReturnQty += qty;
    }
    if (isExch) {
      entry.exchangedQty += qty;
      entry.exchangedValue += val;
    }
    if (isPart) entry.partialQty += qty;
    if (isInTrans) entry.inTransitQty += qty;
    if (isCanc) entry.cancelledQty += qty;
  };

  // 1. SKU key: SKU + Size
  const skuKey = `${sku}__${size}`;
  updateAgg(skuMap, skuKey, rawName, sku, size);

  // 2. Product key: Base Product Name
  updateAgg(productMap, baseName, baseName, sku, 'All Sizes');

  // 3. Category key: Category Name
  updateAgg(categoryMap, cat, cat, '', '');
}

console.log(`Generated: ${skuMap.size} SKUs, ${productMap.size} Products, ${categoryMap.size} Categories.`);

// Check overall sums
let totOrdered = 0, totDelivered = 0, totReturned = 0, totExchanged = 0;
categoryMap.forEach((c) => {
  totOrdered += c.totalOrderedQty;
  totDelivered += c.deliveredQty;
  totReturned += c.returnedQty;
  totExchanged += c.exchangedQty;
});

console.log(`Totals Check:`);
console.log(`Ordered: ${totOrdered} units`);
console.log(`Delivered: ${totDelivered} units (${((totDelivered / totOrdered) * 100).toFixed(1)}%)`);
console.log(`Returned: ${totReturned} units (${((totReturned / totOrdered) * 100).toFixed(1)}%)`);
console.log(`Exchanged: ${totExchanged} units (${((totExchanged / totOrdered) * 100).toFixed(1)}%)`);

