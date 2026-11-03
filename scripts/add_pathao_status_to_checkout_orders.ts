import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { cleanOrderId, extractBaseOrderId } from '../src/lib/sync/liveTerminalSync';

interface PathaoRecord {
  consignmentId: string;
  orderCreatedAt: string | number;
  orderDescription: string;
  merchantOrderId: string;
  recipientName: string;
  recipientAddress: string;
  territory: string;
  recipientPhone: string;
  paymentStatus: string;
  collectableAmount: number;
  collectedAmount: number;
  totalFee: number;
  codFee: number;
  deliveryFee: number;
  cashOnDelivery: string;
  orderStatus: string;
  orderStatusUpdatedAt: string | number;
  storeName: string;
  orderType: string;
}

function resolveConsolidatedPathaoStatus(records: PathaoRecord[]): {
  status: string;
  consignmentIds: string;
  collectedAmount: number;
  collectableAmount: number;
  totalFee: number;
  territory: string;
  orderTypes: string;
} {
  const consIds = records.map((r) => r.consignmentId).filter(Boolean);
  const collected = records.reduce((sum, r) => sum + r.collectedAmount, 0);
  const collectable = records.reduce((sum, r) => sum + r.collectableAmount, 0);
  const fee = records.reduce((sum, r) => sum + r.totalFee, 0);

  // Territory: prefer non-reverse territory if available
  const forwardRecord = records.find((r) => r.orderType !== 'Return');
  const territory = forwardRecord?.territory || records[0]?.territory || 'Outside Dhaka';
  const orderTypes = Array.from(new Set(records.map((r) => r.orderType))).join(', ');

  const statuses = records.map((r) => r.orderStatus.toLowerCase());

  const hasPartial = statuses.some((s) => s.includes('partial'));
  const hasDelivered = statuses.some((s) => s === 'delivered');
  const hasPaidReturn = statuses.some((s) => s === 'paid return');
  const hasReturn = statuses.some((s) => s === 'returned to merchant' || s === 'return' || s === 'return requested');
  const hasReturnInTransit = statuses.some((s) => s === 'return in transit');
  const hasExchange = statuses.some((s) => s === 'exchange');
  const hasAssigned = statuses.some((s) => s.includes('assigned') || s.includes('transit'));
  const hasPickupCancel = statuses.every((s) => s === 'pickup cancel');

  let resolvedStatus = 'Untracked';

  if (hasPartial) {
    resolvedStatus = 'Partial Delivery';
  } else if (hasDelivered && !hasReturn) {
    resolvedStatus = 'Delivered';
  } else if (hasDelivered && hasReturn) {
    // Both delivered parcel and return parcel exist (e.g. delivered with return/exchange)
    resolvedStatus = hasExchange ? 'Exchange Delivered' : 'Delivered (Split/Return)';
  } else if (hasPaidReturn) {
    resolvedStatus = 'Paid Return';
  } else if (hasReturn) {
    resolvedStatus = 'Returned';
  } else if (hasReturnInTransit) {
    resolvedStatus = 'Return In Transit';
  } else if (hasExchange) {
    resolvedStatus = 'Exchange';
  } else if (hasAssigned) {
    resolvedStatus = 'In Transit';
  } else if (hasPickupCancel) {
    resolvedStatus = 'Pickup Cancel';
  } else if (records.length > 0) {
    resolvedStatus = records[0].orderStatus;
  }

  return {
    status: resolvedStatus,
    consignmentIds: consIds.join(', '),
    collectedAmount: collected,
    collectableAmount: collectable,
    totalFee: fee,
    territory,
    orderTypes,
  };
}

async function main() {
  const pathaoFile = path.join(process.cwd(), 'Sample Docs', 'Oct Pathao Delivey Order Lists.xlsx');
  const checkoutFile = path.join(process.cwd(), 'Sample Docs', 'October 2026 Checkout Orders List.xlsx');

  console.log(`1. Reading Pathao manifest: ${pathaoFile}`);
  const wbP = XLSX.readFile(pathaoFile);
  const rawPathaoData = XLSX.utils.sheet_to_json(wbP.Sheets['Oct All'], { header: 1 }) as any[][];

  // Header row normalization: column 3 is 'Merchant order id'
  const pathaoHeader = rawPathaoData[0];
  console.log('Original Pathao header col 3:', pathaoHeader[3]);
  pathaoHeader[3] = 'Merchant order id';

  const pathaoRecords: PathaoRecord[] = [];
  for (let i = 1; i < rawPathaoData.length; i++) {
    const row = rawPathaoData[i];
    if (!row || row.length === 0) continue;

    pathaoRecords.push({
      consignmentId: String(row[0] || '').trim(),
      orderCreatedAt: row[1],
      orderDescription: String(row[2] || '').trim(),
      merchantOrderId: String(row[3] || '').trim(),
      recipientName: String(row[6] || '').trim(),
      recipientAddress: String(row[7] || '').trim(),
      territory: String(row[8] || 'Outside Dhaka').trim(),
      recipientPhone: String(row[9] || '').trim(),
      paymentStatus: String(row[10] || '').trim(),
      collectableAmount: parseFloat(row[11] || '0'),
      collectedAmount: parseFloat(row[12] || '0'),
      totalFee: parseFloat(row[13] || '0'),
      codFee: parseFloat(row[14] || '0'),
      deliveryFee: parseFloat(row[15] || '0'),
      cashOnDelivery: String(row[16] || '').trim(),
      orderStatus: String(row[17] || '').trim(),
      orderStatusUpdatedAt: row[18],
      storeName: String(row[19] || '').trim(),
      orderType: String(row[20] || 'Delivery').trim(),
    });
  }

  console.log(`Parsed ${pathaoRecords.length} Pathao consignment records.`);

  // Save the normalized header back into Oct Pathao Delivey Order Lists.xlsx
  const wsFixedPathao = XLSX.utils.aoa_to_sheet(rawPathaoData);
  wbP.Sheets['Oct All'] = wsFixedPathao;
  XLSX.writeFile(wbP, pathaoFile);
  console.log(`Normalized header col 3 to 'Merchant order id' in ${pathaoFile}`);

  // Build indexing map for Pathao consignments
  const pathaoByOrder = new Map<string, PathaoRecord[]>();

  for (const p of pathaoRecords) {
    const rawMId = p.merchantOrderId;
    const baseId = extractBaseOrderId(rawMId);
    const cleanId = cleanOrderId(rawMId);

    if (rawMId) {
      if (!pathaoByOrder.has(rawMId)) pathaoByOrder.set(rawMId, []);
      pathaoByOrder.get(rawMId)!.push(p);
    }
    if (baseId && baseId !== rawMId) {
      if (!pathaoByOrder.has(baseId)) pathaoByOrder.set(baseId, []);
      pathaoByOrder.get(baseId)!.push(p);
    }
    if (cleanId && cleanId !== rawMId && cleanId !== baseId) {
      if (!pathaoByOrder.has(cleanId)) pathaoByOrder.set(cleanId, []);
      pathaoByOrder.get(cleanId)!.push(p);
    }
  }

  console.log(`Indexed Pathao records across ${pathaoByOrder.size} order identifier keys.`);

  // 2. Read WooCommerce Checkout Orders
  console.log(`\n2. Reading WooCommerce Checkout Orders: ${checkoutFile}`);
  const wbW = XLSX.readFile(checkoutFile);
  const checkoutOrders: any[] = XLSX.utils.sheet_to_json(wbW.Sheets['October Checkout Orders']);
  const lineItems: any[] = XLSX.utils.sheet_to_json(wbW.Sheets['Checkout Line Items']);
  const allOrders: any[] = XLSX.utils.sheet_to_json(wbW.Sheets['All October Orders']);

  console.log(`Total Checkout Orders: ${checkoutOrders.length}`);

  // Tracking & Discrepancy Statistics
  let matchedOrdersCount = 0;
  let deliveredOrdersCount = 0;
  let returnedOrdersCount = 0;
  let paidReturnOrdersCount = 0;
  let partialOrdersCount = 0;
  let exchangeOrdersCount = 0;
  let inTransitOrdersCount = 0;
  let pickupCancelCount = 0;
  let untrackedOrdersCount = 0;

  let totalCollectedCod = 0;
  let totalPathaoFees = 0;

  const returnedButCompletedDiscrepancies: any[] = [];
  const orderStatusAuditMap = new Map<string, string>();

  // Enrich Sheet 1: October Checkout Orders
  const enrichedCheckoutOrders = checkoutOrders.map((ord) => {
    const oId = String(ord['Order ID']).trim();
    const wcStatus = String(ord['Status'] || '').toLowerCase();
    const oVal = parseFloat(ord['Order Value (৳)'] || '0');

    // Look for matching Pathao records
    const matchedRecords = pathaoByOrder.get(oId) || [];

    if (matchedRecords.length === 0) {
      untrackedOrdersCount++;
      const audit = wcStatus === 'cancelled'
        ? 'Cancelled (Pre-dispatch)'
        : wcStatus === 'processing'
        ? 'Pending Warehouse Fulfillment'
        : 'Untracked / Handover Pending';

      orderStatusAuditMap.set(oId, 'Untracked');

      return {
        ...ord,
        'Pathao Delivery Status': 'Untracked',
        'Pathao Consignment ID': '',
        'Pathao Collected COD (৳)': 0,
        'Pathao Courier Fee (৳)': 0,
        'Delivery Territory': ord['City']?.toLowerCase().includes('dhaka') ? 'Inside Dhaka' : 'Outside Dhaka',
        'Reconciliation Audit': audit,
      };
    }

    matchedOrdersCount++;
    const resolved = resolveConsolidatedPathaoStatus(matchedRecords);
    totalCollectedCod += resolved.collectedAmount;
    totalPathaoFees += resolved.totalFee;

    let audit = 'OK';
    if (resolved.status === 'Delivered' || resolved.status === 'Exchange Delivered') {
      deliveredOrdersCount++;
      audit = '✅ Verified Delivered';
      if (wcStatus === 'cancelled') audit = '⚠️ CANCELLED_BUT_DELIVERED (Courier Delivered)';
      if (wcStatus === 'processing') audit = 'ℹ️ DELIVERED_BUT_PROCESSING';
    } else if (resolved.status === 'Paid Return') {
      paidReturnOrdersCount++;
      returnedOrdersCount++;
      audit = '💰 Paid Return (Refusal COD Recovered)';
      if (wcStatus === 'completed') {
        audit = '⚠️ PAID_RETURN_BUT_COMPLETED (Store status not adjusted)';
        returnedButCompletedDiscrepancies.push({
          orderId: oId,
          customer: ord['Customer Name'],
          phone: ord['Customer Phone'],
          value: oVal,
          pathaoStatus: 'Paid Return',
          consignment: resolved.consignmentIds,
        });
      }
    } else if (resolved.status === 'Returned') {
      returnedOrdersCount++;
      audit = '❌ Return to Merchant (Rejected)';
      if (wcStatus === 'completed') {
        audit = '🚨 RETURNED_BUT_COMPLETED (Store marked Completed; Actual Return)';
        returnedButCompletedDiscrepancies.push({
          orderId: oId,
          customer: ord['Customer Name'],
          phone: ord['Customer Phone'],
          value: oVal,
          pathaoStatus: 'Returned',
          consignment: resolved.consignmentIds,
        });
      }
    } else if (resolved.status === 'Partial Delivery') {
      partialOrdersCount++;
      audit = '🔄 Partial Accepted at Doorstep';
    } else if (resolved.status === 'Exchange') {
      exchangeOrdersCount++;
      audit = '🔁 Exchange Replacement Dispatch';
    } else if (resolved.status === 'In Transit' || resolved.status === 'Return In Transit') {
      inTransitOrdersCount++;
      audit = '🚚 In Transit / Hub Sorting';
    } else if (resolved.status === 'Pickup Cancel') {
      pickupCancelCount++;
      audit = '🚫 Pickup Cancelled by Courier';
    }

    orderStatusAuditMap.set(oId, resolved.status);

    return {
      ...ord,
      'Pathao Delivery Status': resolved.status,
      'Pathao Consignment ID': resolved.consignmentIds,
      'Pathao Collected COD (৳)': resolved.collectedAmount,
      'Pathao Courier Fee (৳)': resolved.totalFee,
      'Delivery Territory': resolved.territory,
      'Reconciliation Audit': audit,
    };
  });

  // Enrich Sheet 2: Checkout Line Items
  const enrichedLineItems = lineItems.map((item) => {
    const oId = String(item['Order ID'] || item.orderId || '').trim();
    const courierStatus = orderStatusAuditMap.get(oId) || 'Untracked';
    const matchedRecords = pathaoByOrder.get(oId) || [];
    const consId = matchedRecords.map((r) => r.consignmentId).join(', ');
    const territory = matchedRecords[0]?.territory || (item.city?.toLowerCase().includes('dhaka') ? 'Inside Dhaka' : 'Outside Dhaka');

    return {
      ...item,
      'Courier Delivery Status': courierStatus,
      'Consignment ID': consId,
      'Delivery Zone': territory,
    };
  });

  // Enrich Sheet 3: All October Orders
  const enrichedAllOrders = allOrders.map((ord) => {
    const oId = String(ord['Order ID']).trim();
    const courierStatus = orderStatusAuditMap.get(oId) || 'Untracked';
    const matchedRecords = pathaoByOrder.get(oId) || [];
    const consId = matchedRecords.map((r) => r.consignmentId).join(', ');

    return {
      ...ord,
      'Consignment ID': consId,
      'Courier Status': courierStatus,
    };
  });

  // Create Sheet 5: Reconciliation Discrepancies Audit Sheet
  const discrepancyRows = returnedButCompletedDiscrepancies.map((d) => ({
    'Order ID': d.orderId,
    'Customer Name': d.customer,
    'Customer Phone': d.phone,
    'WooCommerce Order Value (৳)': d.value,
    'Store Status': 'Completed',
    'Actual Pathao Status': d.pathaoStatus,
    'Consignment ID': d.consignment,
    'Audit Note': 'Revenue was marked as completed in WooCommerce but parcel was RETURNED by Pathao. Must be un-reconciled.',
  }));

  console.log('\n==============================================================');
  console.log('📊 ENRICHMENT & MAPPING COMPLETED');
  console.log('==============================================================');
  console.log(`Total WooCommerce Checkout Orders: ${checkoutOrders.length}`);
  console.log(`Matched with Pathao Consignments: ${matchedOrdersCount} (${((matchedOrdersCount / checkoutOrders.length) * 100).toFixed(1)}%)`);
  console.log(`- Verified Delivered: ${deliveredOrdersCount}`);
  console.log(`- Full Returned: ${returnedOrdersCount} (including ${paidReturnOrdersCount} Paid Returns)`);
  console.log(`- Partial Deliveries: ${partialOrdersCount}`);
  console.log(`- Exchange Parcels: ${exchangeOrdersCount}`);
  console.log(`- In Transit: ${inTransitOrdersCount}`);
  console.log(`- Pickup Cancelled: ${pickupCancelCount}`);
  console.log(`- Untracked / Not in Pathao Manifest: ${untrackedOrdersCount}`);
  console.log(`🚨 False "Completed" Orders (Returned in Pathao): ${returnedButCompletedDiscrepancies.length}`);
  const falseRevenue = returnedButCompletedDiscrepancies.reduce((sum, r) => sum + r.value, 0);
  console.log(`   Phantom Revenue Amount: ৳${Math.round(falseRevenue).toLocaleString()}`);

  // Build New Complete Workbook
  const newWb = XLSX.utils.book_new();

  // 1. Sheet: October Checkout Orders
  const ws1 = XLSX.utils.json_to_sheet(enrichedCheckoutOrders);
  XLSX.utils.book_append_sheet(newWb, ws1, 'October Checkout Orders');

  // 2. Sheet: Checkout Line Items
  const ws2 = XLSX.utils.json_to_sheet(enrichedLineItems);
  XLSX.utils.book_append_sheet(newWb, ws2, 'Checkout Line Items');

  // 3. Sheet: All October Orders
  const ws3 = XLSX.utils.json_to_sheet(enrichedAllOrders);
  XLSX.utils.book_append_sheet(newWb, ws3, 'All October Orders');

  // 4. Sheet: Status Summary
  const statusSummaryMap: Record<string, number> = {};
  for (const o of enrichedCheckoutOrders) {
    const st = o['Pathao Delivery Status'] || 'Untracked';
    statusSummaryMap[st] = (statusSummaryMap[st] || 0) + 1;
  }
  const summaryRows = Object.entries(statusSummaryMap).map(([st, count]) => ({
    'Pathao Delivery Status': st,
    'Order Count': count,
    'Percentage': `${((count / checkoutOrders.length) * 100).toFixed(1)}%`,
  }));
  const ws4 = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(newWb, ws4, 'Delivery Status Summary');

  // 5. Sheet: Discrepancy Audit
  const ws5 = XLSX.utils.json_to_sheet(discrepancyRows.length > 0 ? discrepancyRows : [{ 'Notice': 'No Discrepancies Detected' }]);
  XLSX.utils.book_append_sheet(newWb, ws5, 'Returned But Completed Audit');

  // Auto-fit column widths across all sheets
  [ws1, ws2, ws3, ws4, ws5].forEach((ws) => {
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    const cols = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      cols.push({ wch: 22 });
    }
    ws['!cols'] = cols;
  });

  XLSX.writeFile(newWb, checkoutFile);
  console.log(`\n📗 Successfully saved enriched workbook: ${checkoutFile}`);

  // Also update CSV
  const csvFile = path.join(process.cwd(), 'Sample Docs', 'October_2026_Checkout_Orders.csv');
  const csvContent = XLSX.utils.sheet_to_csv(ws1);
  fs.writeFileSync(csvFile, csvContent, 'utf8');
  console.log(`📄 Successfully saved updated CSV: ${csvFile}`);
}

main().catch(console.error);

