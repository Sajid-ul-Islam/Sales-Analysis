import fs from 'fs';
import * as XLSX from 'xlsx';
import { formatWooCommerceToOrderRows } from '../src/lib/woocommerceClient';
import { extractBaseOrderId, cleanOrderId } from '../src/lib/sync/liveTerminalSync';

// 1. Read Pathao manifest to know exact courier delivery outcomes
const pathaoFile = 'Sample Docs/Oct Pathao Delivey Order Lists.xlsx';
const wbP = XLSX.readFile(pathaoFile);
const rawPathaoData = XLSX.utils.sheet_to_json(wbP.Sheets['Oct All'], { header: 1 }) as any[][];

// Pathao map by order ID
const pathaoByOrder = new Map<string, any[]>();
for (let i = 1; i < rawPathaoData.length; i++) {
  const row = rawPathaoData[i];
  if (!row || row.length === 0) continue;
  const merchantOrderId = String(row[3] || '').trim();
  const status = String(row[17] || '').trim().toLowerCase();
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

console.log('Indexed Pathao orders:', pathaoByOrder.size);

// 2. Read raw WooCommerce October orders
const rawOrders = JSON.parse(fs.readFileSync('src/data/october2026_raw_orders.json', 'utf8'));
const allRows = formatWooCommerceToOrderRows(rawOrders);
console.log('Total line item rows:', allRows.length);

// 3. Inspect line items fulfillment status determination
let deliveredItems = 0;
let returnedItems = 0;
let paidReturnItems = 0;
let exchangedItems = 0;
let partialItems = 0;
let inTransitItems = 0;
let cancelledItems = 0;
let posItems = 0;
let pendingItems = 0;

for (const row of allRows) {
  const oId = row['Order ID'];
  const qty = Number(row.Quantity || row.quantity || 1);
  const isPos = Boolean(row.isPos);
  const isExchange = Boolean(row.isExchange || row.createdVia === 'sip_exchange');
  const wcStatus = String(row.status || '').toLowerCase();

  const pathaoRecs = pathaoByOrder.get(oId) || [];
  const statuses = pathaoRecs.map((r) => r.orderStatus.toLowerCase());

  if (isExchange) {
    exchangedItems += qty;
  } else if (isPos) {
    posItems += qty;
  } else if (statuses.some((s) => s.includes('partial'))) {
    partialItems += qty;
  } else if (statuses.some((s) => s === 'paid return')) {
    paidReturnItems += qty;
    returnedItems += qty;
  } else if (statuses.some((s) => s.includes('return'))) {
    returnedItems += qty;
  } else if (statuses.some((s) => s === 'delivered' || s.includes('delivered'))) {
    deliveredItems += qty;
  } else if (statuses.some((s) => s.includes('transit') || s.includes('assigned'))) {
    inTransitItems += qty;
  } else if (wcStatus === 'cancelled' || statuses.some((s) => s.includes('pickup cancel'))) {
    cancelledItems += qty;
  } else if (wcStatus === 'completed') {
    deliveredItems += qty;
  } else {
    pendingItems += qty;
  }
}

console.log('Fulfillment items breakdown:');
console.log(`- Delivered (Courier + Completed): ${deliveredItems}`);
console.log(`- POS In-Store Sales: ${posItems}`);
console.log(`- Returned Items (Total): ${returnedItems} (including ${paidReturnItems} Paid Returns)`);
console.log(`- Exchanged Items: ${exchangedItems}`);
console.log(`- Partial Acceptances: ${partialItems}`);
console.log(`- In Transit: ${inTransitItems}`);
console.log(`- Cancelled / Pre-dispatch: ${cancelledItems}`);
console.log(`- Pending Pack Queue: ${pendingItems}`);

