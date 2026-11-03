import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { cleanOrderId, extractBaseOrderId } from '../src/lib/sync/liveTerminalSync';

async function main() {
  const pathaoPath = path.join(process.cwd(), 'Sample Docs', 'Oct Pathao Delivey Order Lists.xlsx');
  const wcPath = path.join(process.cwd(), 'Sample Docs', 'October 2026 Checkout Orders List.xlsx');

  console.log('Loading Pathao consignments...');
  const wbPathao = XLSX.readFile(pathaoPath);
  const pathaoRows: any[] = XLSX.utils.sheet_to_json(wbPathao.Sheets['Oct All']);

  console.log('Loading WooCommerce checkout orders...');
  const wbWc = XLSX.readFile(wcPath);
  const wcOrders: any[] = XLSX.utils.sheet_to_json(wbWc.Sheets['October Checkout Orders']);
  const wcItems: any[] = XLSX.utils.sheet_to_json(wbWc.Sheets['Checkout Line Items']);

  console.log(`Pathao rows: ${pathaoRows.length}`);
  console.log(`WooCommerce checkout orders: ${wcOrders.length}`);
  console.log(`WooCommerce line items: ${wcItems.length}\n`);

  // Index WooCommerce Orders by ID and Order Number
  const wcOrderMap = new Map<string, any>();
  for (const o of wcOrders) {
    const id = cleanOrderId(o['Order ID']);
    const num = cleanOrderId(o['Order Number']);
    if (id) wcOrderMap.set(id, o);
    if (num) wcOrderMap.set(num, o);
  }

  // Index Pathao Consignments by Merchant Order ID and Consignment ID
  const pathaoMapByOrder = new Map<string, any[]>();
  const pathaoMapByCons = new Map<string, any>();

  for (const p of pathaoRows) {
    const rawMId = String(p['Merchant order id'] || '').trim();
    const baseId = extractBaseOrderId(rawMId);
    const cleanId = cleanOrderId(rawMId);
    const consId = String(p['Order consignment id'] || '').trim();

    if (consId) pathaoMapByCons.set(consId, p);

    // Group by base ID
    if (baseId) {
      if (!pathaoMapByOrder.has(baseId)) pathaoMapByOrder.set(baseId, []);
      pathaoMapByOrder.get(baseId)!.push(p);
    }
    if (cleanId && cleanId !== baseId) {
      if (!pathaoMapByOrder.has(cleanId)) pathaoMapByOrder.set(cleanId, []);
      pathaoMapByOrder.get(cleanId)!.push(p);
    }
  }

  // ==============================================================
  // RECONCILIATION AUDIT: MATCH WOOCOMMERCE ORDERS WITH PATHAO
  // ==============================================================
  let matchedOrders = 0;
  let untrackedWcOrders = 0;

  let deliveredWcOrders = 0;
  let returnedWcOrders = 0;
  let partialWcOrders = 0;
  let exchangeWcOrders = 0;
  let inTransitWcOrders = 0;
  let cancelledPreDispatch = 0;

  let totalWcGrossValue = 0;
  let realizedDeliveredRevenue = 0;
  let lostReturnOrderValue = 0;
  let totalCodCollectedFromPathao = 0;
  let totalPathaoCourierFees = 0;

  // Discrepancies
  const returnedButCompletedInWc: any[] = [];
  const codMismatches: any[] = [];

  for (const o of wcOrders) {
    const oId = cleanOrderId(o['Order ID']);
    const oVal = parseFloat(o['Order Value (৳)'] || '0');
    totalWcGrossValue += oVal;

    const wcStatus = String(o['Status'] || '').toLowerCase();
    if (wcStatus === 'cancelled') {
      cancelledPreDispatch++;
    }

    const matchedPathao = pathaoMapByOrder.get(oId) || [];

    if (matchedPathao.length === 0) {
      untrackedWcOrders++;
      continue;
    }

    matchedOrders++;

    // Evaluate overall courier status for the order
    const courierStatuses = matchedPathao.map((p) => String(p['Order status'] || '').toLowerCase());
    const isAnyDelivered = courierStatuses.some((s) => s === 'delivered');
    const isAnyReturned = courierStatuses.some((s) => s.includes('return'));
    const isAnyPartial = courierStatuses.some((s) => s.includes('partial'));
    const isAnyExchange = courierStatuses.some((s) => s.includes('exchange'));

    let codColl = 0;
    let feeColl = 0;
    for (const p of matchedPathao) {
      codColl += parseFloat(p['Collected amount'] || '0');
      feeColl += parseFloat(p['Total fee'] || '0');
    }
    totalCodCollectedFromPathao += codColl;
    totalPathaoCourierFees += feeColl;

    if (isAnyPartial) {
      partialWcOrders++;
      realizedDeliveredRevenue += codColl; // Actual partial collected
    } else if (isAnyDelivered && !isAnyReturned) {
      deliveredWcOrders++;
      realizedDeliveredRevenue += oVal;
    } else if (isAnyReturned && !isAnyDelivered) {
      returnedWcOrders++;
      lostReturnOrderValue += oVal;

      // DISCREPANCY CHECK: Marked Completed in WC but actually Returned in Pathao!
      if (wcStatus === 'completed') {
        returnedButCompletedInWc.push({
          orderId: oId,
          customerName: o['Customer Name'],
          phone: o['Customer Phone'],
          wcValue: oVal,
          wcStatus: o['Status'],
          pathaoStatus: matchedPathao.map((p) => p['Order status']).join(', '),
          consignments: matchedPathao.map((p) => p['Order consignment id']).join(', '),
        });
      }
    } else if (isAnyExchange) {
      exchangeWcOrders++;
      realizedDeliveredRevenue += oVal;
    } else {
      inTransitWcOrders++;
    }

    // COD discrepancy check
    if (isAnyDelivered && Math.abs(oVal - codColl) > 100 && codColl > 0) {
      codMismatches.push({
        orderId: oId,
        orderValue: oVal,
        codCollected: codColl,
        difference: oVal - codColl,
      });
    }
  }

  console.log('==============================================================');
  console.log('📊 OCTOBER 2026 CROSS-RECONCILIATION EXECUTIVE RESULTS');
  console.log('==============================================================');
  console.log(`Total WooCommerce Checkout Orders: ${wcOrders.length}`);
  console.log(`Pre-dispatch Cancelled in WooCommerce: ${cancelledPreDispatch}`);
  console.log(`Active Dispatched Orders Handed Over to Pathao: ${matchedOrders}`);
  console.log(`Untracked / No Consignment Linked: ${untrackedWcOrders}`);
  console.log('\nFulfillment Breakdown of Matched Orders:');
  console.log(`- Successfully Delivered: ${deliveredWcOrders} (${((deliveredWcOrders / matchedOrders) * 100).toFixed(1)}%)`);
  console.log(`- Full Returned: ${returnedWcOrders} (${((returnedWcOrders / matchedOrders) * 100).toFixed(1)}%)`);
  console.log(`- Partial Acceptances: ${partialWcOrders} (${((partialWcOrders / matchedOrders) * 100).toFixed(1)}%)`);
  console.log(`- Exchange Parcels: ${exchangeWcOrders} (${((exchangeWcOrders / matchedOrders) * 100).toFixed(1)}%)`);
  console.log(`- In-Transit / Pending: ${inTransitWcOrders}`);

  console.log('\nFinancial & Realization Metrics:');
  console.log(`- Total WooCommerce Gross Order Value: ৳${Math.round(totalWcGrossValue).toLocaleString()}`);
  console.log(`- Realized Net Delivered Sales Value: ৳${Math.round(realizedDeliveredRevenue).toLocaleString()}`);
  console.log(`- Lost Sales Value in Returns: ৳${Math.round(lostReturnOrderValue).toLocaleString()}`);
  console.log(`- Total COD Collected by Pathao: ৳${Math.round(totalCodCollectedFromPathao).toLocaleString()}`);
  console.log(`- Total Pathao Courier Fees: ৳${Math.round(totalPathaoCourierFees).toLocaleString()}`);
  console.log(`- Net Payout Payable by Pathao: ৳${Math.round(totalCodCollectedFromPathao - totalPathaoCourierFees).toLocaleString()}`);

  console.log('\nCRITICAL OPERATIONAL DISCREPANCIES:');
  console.log(`🚨 False "Completed" Orders in WooCommerce (Actually RETURNED in Pathao): ${returnedButCompletedInWc.length}`);
  const falseRevenue = returnedButCompletedInWc.reduce((sum, r) => sum + r.wcValue, 0);
  console.log(`   Phantom / Unadjusted Revenue on WordPress: ৳${Math.round(falseRevenue).toLocaleString()}`);
  if (returnedButCompletedInWc.length > 0) {
    console.log('   Sample False Completed Orders:', returnedButCompletedInWc.slice(0, 5));
  }
}

main().catch(console.error);

