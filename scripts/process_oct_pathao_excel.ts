import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { classifyLocation } from '../src/lib/geo';

async function main() {
  const filePath = path.join(process.cwd(), 'Sample Docs', 'Oct Pathao Delivey Order Lists.xlsx');
  console.log(`Reading workbook: ${filePath}`);

  const wb = XLSX.readFile(filePath);
  const firstSheetName = wb.SheetNames[0] || 'Oct All';
  const rawRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[firstSheetName]);

  console.log(`Total rows in ${firstSheetName}: ${rawRows.length}`);

  // Load WooCommerce October orders for reverse logistics return lookups
  const wcJsonPath = path.join(process.cwd(), 'src', 'data', 'october2026_raw_orders.json');
  const wcMap = new Map<string, any>();
  if (fs.existsSync(wcJsonPath)) {
    try {
      const wcOrders: any[] = JSON.parse(fs.readFileSync(wcJsonPath, 'utf8'));
      for (const o of wcOrders) {
        const idStr = String(o.id || '');
        const numStr = String(o.number || '');
        if (idStr) wcMap.set(idStr, o);
        if (numStr) wcMap.set(numStr, o);
      }
      console.log(`Loaded ${wcMap.size} WooCommerce orders for cross-referencing customer addresses.`);
    } catch (e) {
      console.warn('Could not load WooCommerce orders:', e);
    }
  }

  // Enrich rows with "Inside Dhaka / Outside Dhaka"
  let insideCount = 0;
  let outsideCount = 0;

  const enrichedRows = rawRows.map((row) => {
    let addressToClassify = String(row['Recipient address'] || '');
    let cityToClassify = '';
    const isReturn = String(row['Order type'] || '').toLowerCase().includes('return') ||
                     String(row['Store name'] || '').toLowerCase().includes('reverse logistics');

    // If reverse logistics return parcel, look up original customer address from WooCommerce
    if (isReturn) {
      const rawMId = String(row['Merchant order id'] || '').trim();
      const cleanMId = rawMId.replace(/^[A-Za-z]+-/, '').replace(/[a-zA-Z\s]+$/, '');
      const matchedWc = wcMap.get(cleanMId) || wcMap.get(rawMId);

      if (matchedWc) {
        const shipAddr = matchedWc.shipping?.address_1 || matchedWc.billing?.address_1 || '';
        const shipCity = matchedWc.shipping?.city || matchedWc.billing?.city || '';
        if (shipAddr || shipCity) {
          addressToClassify = shipAddr;
          cityToClassify = shipCity;
        }
      } else {
        // Check Store name for reverse pickup location hints
        const store = String(row['Store name'] || '').toLowerCase();
        if (store.includes('mymensingh') || store.includes('chattogram') || store.includes('sylhet') || store.includes('cumilla')) {
          addressToClassify = store;
        }
      }
    }

    let territory: 'Inside Dhaka' | 'Outside Dhaka' = 'Outside Dhaka';

    // 1. Check with geo classifier
    const geoLoc = classifyLocation(addressToClassify, cityToClassify, '');
    if (geoLoc === 'Inside Dhaka') {
      territory = 'Inside Dhaka';
    } else if (geoLoc === 'Outside Dhaka') {
      territory = 'Outside Dhaka';
    } else {
      // 2. Fallback to delivery fee logic if ambiguous
      const deliveryFee = parseFloat(row['Delivery fee'] || '0');
      if (deliveryFee > 0 && deliveryFee <= 70) {
        territory = 'Inside Dhaka';
      } else {
        territory = 'Outside Dhaka';
      }
    }

    if (territory === 'Inside Dhaka') insideCount++;
    else outsideCount++;

    // Return new row with "Inside Dhaka / Outside Dhaka" column inserted after Recipient address
    const newRow: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      newRow[k] = v;
      if (k === 'Recipient address') {
        newRow['Inside Dhaka / Outside Dhaka'] = territory;
      }
    }
    // Safety check if 'Recipient address' key wasn't matched
    if (!('Inside Dhaka / Outside Dhaka' in newRow)) {
      newRow['Inside Dhaka / Outside Dhaka'] = territory;
    }

    return newRow;
  });

  console.log(`Territory Classification: Inside Dhaka = ${insideCount}, Outside Dhaka = ${outsideCount}`);

  // ==========================================
  // COMPUTE EXECUTIVE PIVOT & KPI METRICS
  // ==========================================
  const totalParcels = enrichedRows.length;
  let totalCollectable = 0;
  let totalCollected = 0;
  let totalFees = 0;
  let totalCodFees = 0;
  let totalDeliveryFees = 0;

  const statusMap: Record<string, { total: number; inside: number; outside: number; collectable: number; collected: number; fee: number }> = {};
  const storeMap: Record<string, { total: number; delivered: number; returned: number; collectable: number; collected: number; fee: number }> = {};

  for (const r of enrichedRows) {
    const st = String(r['Order status'] || 'Unknown').trim();
    const zone = r['Inside Dhaka / Outside Dhaka'] as 'Inside Dhaka' | 'Outside Dhaka';
    const store = String(r['Store name'] || 'DEEN ECOM').trim();

    const collectable = parseFloat(r['Collectable Amount'] || '0');
    const collected = parseFloat(r['Collected amount'] || '0');
    const fee = parseFloat(r['Total fee'] || '0');
    const codFee = parseFloat(r['Cod fee'] || '0');
    const delFee = parseFloat(r['Delivery fee'] || '0');

    totalCollectable += collectable;
    totalCollected += collected;
    totalFees += fee;
    totalCodFees += codFee;
    totalDeliveryFees += delFee;

    // Status aggregation
    if (!statusMap[st]) {
      statusMap[st] = { total: 0, inside: 0, outside: 0, collectable: 0, collected: 0, fee: 0 };
    }
    statusMap[st].total++;
    if (zone === 'Inside Dhaka') statusMap[st].inside++;
    else statusMap[st].outside++;
    statusMap[st].collectable += collectable;
    statusMap[st].collected += collected;
    statusMap[st].fee += fee;

    // Store aggregation
    if (!storeMap[store]) {
      storeMap[store] = { total: 0, delivered: 0, returned: 0, collectable: 0, collected: 0, fee: 0 };
    }
    storeMap[store].total++;
    if (st.toLowerCase() === 'delivered') storeMap[store].delivered++;
    if (st.toLowerCase().includes('return')) storeMap[store].returned++;
    storeMap[store].collectable += collectable;
    storeMap[store].collected += collected;
    storeMap[store].fee += fee;
  }

  const deliveredCount = (statusMap['Delivered']?.total || 0);
  const paidReturnCount = (statusMap['Paid Return']?.total || 0);
  const returnedCount = (statusMap['Return']?.total || 0) + (statusMap['Returned To Merchant']?.total || 0) + (statusMap['Return In Transit']?.total || 0) + (statusMap['Return Requested']?.total || 0) + paidReturnCount;
  const partialCount = (statusMap['Partial Delivery']?.total || 0);
  const exchangeCount = (statusMap['Exchange']?.total || 0);

  const deliveryRate = ((deliveredCount / totalParcels) * 100).toFixed(1);
  const returnRate = ((returnedCount / totalParcels) * 100).toFixed(1);
  const codCollectionRate = totalCollectable > 0 ? ((totalCollected / totalCollectable) * 100).toFixed(1) : '0.0';

  // Inside vs Outside specific delivery metrics
  const insideDelivered = statusMap['Delivered']?.inside || 0;
  const insideReturned = (statusMap['Return']?.inside || 0) + (statusMap['Returned To Merchant']?.inside || 0) + (statusMap['Paid Return']?.inside || 0);
  const outsideDelivered = statusMap['Delivered']?.outside || 0;
  const outsideReturned = (statusMap['Return']?.outside || 0) + (statusMap['Returned To Merchant']?.outside || 0) + (statusMap['Paid Return']?.outside || 0);

  const insideDelRate = insideCount > 0 ? ((insideDelivered / insideCount) * 100).toFixed(1) : '0.0';
  const outsideDelRate = outsideCount > 0 ? ((outsideDelivered / outsideCount) * 100).toFixed(1) : '0.0';

  // ==========================================
  // BUILD FORMATTED PIVOT & KPI WORKSHEET (AOA)
  // ==========================================
  const pivotAoa: any[][] = [];

  // Title Banner
  pivotAoa.push(['PATHAO COURIER OCTOBER 2026 EXECUTIVE RECONCILIATION & PIVOT DASHBOARD']);
  pivotAoa.push([`Generated: ${new Date().toISOString().slice(0, 10)} | Dataset: ${totalParcels.toLocaleString()} Dispatched Parcels | Currency: BDT (৳)`]);
  pivotAoa.push([]);

  // Section 1: Executive KPI Scorecard
  pivotAoa.push(['===================================================================================================']);
  pivotAoa.push(['EXECUTIVE KPI SCORECARD', '', '', '', '']);
  pivotAoa.push(['===================================================================================================']);
  pivotAoa.push(['KPI Metric', 'Value', 'Unit / Rate', 'Operational Benchmark & Description']);
  pivotAoa.push(['Total Dispatched Parcels', totalParcels, 'Parcels', 'Total courier consignments processed in October 2026']);
  pivotAoa.push(['Delivered Parcels', deliveredCount, `${deliveryRate}%`, 'Parcels successfully accepted & collected by customers']);
  pivotAoa.push(['Total Returned Parcels', returnedCount, `${returnRate}%`, 'Includes Return to Merchant, Paid Return, Return in Transit']);
  pivotAoa.push(['Paid Returns (COD Recovered)', paidReturnCount, `${((paidReturnCount / (returnedCount || 1)) * 100).toFixed(1)}% of Returns`, 'Parcel refusals with return delivery fee collected']);
  pivotAoa.push(['Partial Deliveries', partialCount, `${((partialCount / totalParcels) * 100).toFixed(1)}%`, 'Multi-item parcels partially kept by buyer']);
  pivotAoa.push(['Exchange Parcels', exchangeCount, `${((exchangeCount / totalParcels) * 100).toFixed(1)}%`, 'Replacement apparel parcels for size/cut exchanges']);
  pivotAoa.push([]);
  pivotAoa.push(['Gross Collectable COD Amount', Math.round(totalCollectable), 'BDT (৳)', 'Gross invoice value assigned to courier at dispatch']);
  pivotAoa.push(['Net COD Collected from Customers', Math.round(totalCollected), 'BDT (৳)', `Realized customer collections (${codCollectionRate}% of collectable)`]);
  pivotAoa.push(['Total Pathao Courier Fees', Math.round(totalFees), 'BDT (৳)', `Delivery fee (৳${Math.round(totalDeliveryFees)}) + COD Fee (৳${Math.round(totalCodFees)})`]);
  pivotAoa.push(['Net Settlement Payable by Pathao', Math.round(totalCollected - totalFees), 'BDT (৳)', 'Net realized payout (Collected COD minus Pathao fees)']);
  pivotAoa.push([]);

  // Section 2: Territory Breakdown (Inside Dhaka vs Outside Dhaka)
  pivotAoa.push(['===================================================================================================']);
  pivotAoa.push(['GEOGRAPHICAL TERRITORY BREAKDOWN (INSIDE DHAKA VS OUTSIDE DHAKA)', '', '', '', '']);
  pivotAoa.push(['===================================================================================================']);
  pivotAoa.push([
    'Territory',
    'Total Parcels',
    'Share of Volume (%)',
    'Delivered',
    'Delivery Rate (%)',
    'Returned',
    'Return Rate (%)',
    'Collectable (৳)',
    'Collected (৳)',
    'Realization Rate (%)'
  ]);

  const insideCollectable = Object.values(statusMap).reduce((acc, s) => acc + (s.inside / (s.total || 1)) * s.collectable, 0);
  const insideCollected = Object.values(statusMap).reduce((acc, s) => acc + (s.inside / (s.total || 1)) * s.collected, 0);
  const outsideCollectable = totalCollectable - insideCollectable;
  const outsideCollected = totalCollected - insideCollected;

  pivotAoa.push([
    'Inside Dhaka',
    insideCount,
    `${((insideCount / totalParcels) * 100).toFixed(1)}%`,
    insideDelivered,
    `${insideDelRate}%`,
    insideReturned,
    `${((insideReturned / insideCount) * 100).toFixed(1)}%`,
    Math.round(insideCollectable),
    Math.round(insideCollected),
    `${insideCollectable > 0 ? ((insideCollected / insideCollectable) * 100).toFixed(1) : 0}%`
  ]);

  pivotAoa.push([
    'Outside Dhaka',
    outsideCount,
    `${((outsideCount / totalParcels) * 100).toFixed(1)}%`,
    outsideDelivered,
    `${outsideDelRate}%`,
    outsideReturned,
    `${((outsideReturned / outsideCount) * 100).toFixed(1)}%`,
    Math.round(outsideCollectable),
    Math.round(outsideCollected),
    `${outsideCollectable > 0 ? ((outsideCollected / outsideCollectable) * 100).toFixed(1) : 0}%`
  ]);

  pivotAoa.push([
    'Grand Total',
    totalParcels,
    '100.0%',
    deliveredCount,
    `${deliveryRate}%`,
    returnedCount,
    `${returnRate}%`,
    Math.round(totalCollectable),
    Math.round(totalCollected),
    `${codCollectionRate}%`
  ]);
  pivotAoa.push([]);

  // Section 3: Master Pivot Table - Order Status by Territory
  pivotAoa.push(['===================================================================================================']);
  pivotAoa.push(['PIVOT TABLE: ORDER STATUS DISTRIBUTION BY TERRITORY', '', '', '', '']);
  pivotAoa.push(['===================================================================================================']);
  pivotAoa.push([
    'Order Status',
    'Inside Dhaka Count',
    'Inside %',
    'Outside Dhaka Count',
    'Outside %',
    'Total Parcels',
    'Overall %',
    'Collectable Amount (৳)',
    'Collected Amount (৳)',
    'Courier Fee (৳)'
  ]);

  const sortedStatuses = Object.entries(statusMap).sort((a, b) => b[1].total - a[1].total);
  for (const [st, data] of sortedStatuses) {
    pivotAoa.push([
      st,
      data.inside,
      `${((data.inside / (insideCount || 1)) * 100).toFixed(1)}%`,
      data.outside,
      `${((data.outside / (outsideCount || 1)) * 100).toFixed(1)}%`,
      data.total,
      `${((data.total / totalParcels) * 100).toFixed(1)}%`,
      Math.round(data.collectable),
      Math.round(data.collected),
      Math.round(data.fee)
    ]);
  }

  pivotAoa.push([
    'Grand Total',
    insideCount,
    '100.0%',
    outsideCount,
    '100.0%',
    totalParcels,
    '100.0%',
    Math.round(totalCollectable),
    Math.round(totalCollected),
    Math.round(totalFees)
  ]);
  pivotAoa.push([]);

  // Section 4: Store / Fulfillment Origin Pivot
  pivotAoa.push(['===================================================================================================']);
  pivotAoa.push(['PIVOT TABLE: DISPATCH ORIGIN & BRANCH PERFORMANCE', '', '', '', '']);
  pivotAoa.push(['===================================================================================================']);
  pivotAoa.push([
    'Store / Fulfillment Origin',
    'Total Parcels',
    'Volume Share (%)',
    'Delivered',
    'Delivery Rate (%)',
    'Returned',
    'Return Rate (%)',
    'Collectable (৳)',
    'Collected (৳)',
    'Courier Fees (৳)'
  ]);

  const sortedStores = Object.entries(storeMap).sort((a, b) => b[1].total - a[1].total);
  for (const [storeName, sData] of sortedStores) {
    const sDelRate = sData.total > 0 ? ((sData.delivered / sData.total) * 100).toFixed(1) : '0.0';
    const sRetRate = sData.total > 0 ? ((sData.returned / sData.total) * 100).toFixed(1) : '0.0';

    pivotAoa.push([
      storeName,
      sData.total,
      `${((sData.total / totalParcels) * 100).toFixed(1)}%`,
      sData.delivered,
      `${sDelRate}%`,
      sData.returned,
      `${sRetRate}%`,
      Math.round(sData.collectable),
      Math.round(sData.collected),
      Math.round(sData.fee)
    ]);
  }

  pivotAoa.push([
    'Grand Total',
    totalParcels,
    '100.0%',
    deliveredCount,
    `${deliveryRate}%`,
    returnedCount,
    `${returnRate}%`,
    Math.round(totalCollectable),
    Math.round(totalCollected),
    Math.round(totalFees)
  ]);
  pivotAoa.push([]);

  // Section 5: Visual Representation / Chart ASCII Guide
  pivotAoa.push(['===================================================================================================']);
  pivotAoa.push(['VISUAL DISTRIBUTION & DELIVERY RATE COMPARISON CHART', '', '', '', '']);
  pivotAoa.push(['===================================================================================================']);
  pivotAoa.push(['Territory / Status', 'Volume', 'Rate %', 'Visual Share Bar (1 block = 2%)']);
  const insideBarLen = Math.round((insideCount / totalParcels) * 50);
  const outsideBarLen = 50 - insideBarLen;
  pivotAoa.push(['Inside Dhaka Volume', insideCount, `${((insideCount / totalParcels) * 100).toFixed(1)}%`, '█'.repeat(insideBarLen)]);
  pivotAoa.push(['Outside Dhaka Volume', outsideCount, `${((outsideCount / totalParcels) * 100).toFixed(1)}%`, '█'.repeat(outsideBarLen)]);
  pivotAoa.push([]);
  const delBarLen = Math.round((deliveredCount / totalParcels) * 50);
  const retBarLen = Math.round((returnedCount / totalParcels) * 50);
  pivotAoa.push(['Overall Delivered Parcels', deliveredCount, `${deliveryRate}%`, '█'.repeat(delBarLen)]);
  pivotAoa.push(['Overall Returned Parcels', returnedCount, `${returnRate}%`, '█'.repeat(retBarLen)]);
  pivotAoa.push(['Paid Return Recoveries', paidReturnCount, `${((paidReturnCount / totalParcels) * 100).toFixed(1)}%`, '█'.repeat(Math.round((paidReturnCount / totalParcels) * 50))]);
  pivotAoa.push(['Partial Deliveries', partialCount, `${((partialCount / totalParcels) * 100).toFixed(1)}%`, '█'.repeat(Math.round((partialCount / totalParcels) * 50))]);

  // Replace Sheets in Workbook
  const newWb = XLSX.utils.book_new();

  // 1. First Sheet: Enriched "Oct All"
  const wsEnriched = XLSX.utils.json_to_sheet(enrichedRows);
  // Auto-fit column widths
  const range1 = XLSX.utils.decode_range(wsEnriched['!ref'] || 'A1:A1');
  const cols1 = [];
  for (let c = range1.s.c; c <= range1.e.c; c++) {
    cols1.push({ wch: 20 });
  }
  wsEnriched['!cols'] = cols1;
  XLSX.utils.book_append_sheet(newWb, wsEnriched, firstSheetName);

  // 2. Second Sheet: Executive Pivot & KPI Dashboard
  const wsPivot = XLSX.utils.aoa_to_sheet(pivotAoa);
  const colsPivot = [
    { wch: 36 },
    { wch: 18 },
    { wch: 22 },
    { wch: 55 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 24 },
    { wch: 24 },
    { wch: 20 }
  ];
  wsPivot['!cols'] = colsPivot;
  XLSX.utils.book_append_sheet(newWb, wsPivot, 'Pivot & KPI Dashboard');

  // Write Workbook Back to File
  XLSX.writeFile(newWb, filePath);
  console.log(`✅ Successfully updated ${filePath}!`);
}

main().catch(console.error);

