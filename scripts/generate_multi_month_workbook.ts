import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

async function main() {
  console.log('Generating DEEN Multi-Month Master Orders (Sept-Oct-Nov).xlsx...');

  const baselinePath = path.join(process.cwd(), 'src', 'data', 'baselineSample.json');
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const allOrders = baseline.orders || [];

  console.log(`Total orders in baseline: ${allOrders.length}`);

  // Auto-fit helper
  function autoFitColumns(sheet: XLSX.WorkSheet, data: any[]) {
    if (!data || data.length === 0) return;
    const colNames = Object.keys(data[0]);
    const colWidths = colNames.map((col) => {
      let maxLen = col.length;
      for (const row of data.slice(0, 200)) {
        const valStr = String(row[col] ?? '');
        if (valStr.length > maxLen) maxLen = valStr.length;
      }
      return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
    });
    sheet['!cols'] = colWidths;
  }

  // Split by month
  const septOrders: any[] = [];
  const octOrders: any[] = [];
  const novOrders: any[] = [];

  for (const o of allOrders) {
    const dStr = String(o['Order Date'] || o.orderDate || '');
    if (dStr.startsWith('2026-09') || dStr.includes('Sep')) septOrders.push(o);
    else if (dStr.startsWith('2026-10') || dStr.includes('Oct')) octOrders.push(o);
    else if (dStr.startsWith('2026-11') || dStr.includes('Nov')) novOrders.push(o);
  }

  console.log(`September: ${septOrders.length} rows`);
  console.log(`October:   ${octOrders.length} rows`);
  console.log(`November:  ${novOrders.length} rows`);

  // Build Monthly KPI Comparison Table
  function computeMonthKpis(orders: any[], name: string, isClosed: boolean) {
    const totalUnits = orders.reduce((sum, r) => sum + (Number(r.Quantity || r.quantity) || 1), 0);
    const grossVal = orders.reduce((sum, r) => sum + ((Number(r.Quantity || 1)) * (Number(r['Item Cost'] || r.itemCost) || 0)), 0);

    let delivUnits = 0;
    let delivVal = 0;
    let retUnits = 0;
    let retVal = 0;
    let exchUnits = 0;
    let exchVal = 0;

    orders.forEach((r) => {
      const q = Number(r.Quantity || r.quantity || 1);
      const c = Number(r['Item Cost'] || r.itemCost || 0);
      const v = q * c;
      const st = String(r.Substatus || r.substatus || r['Delivery Status'] || r.status || '').toLowerCase();
      const pSt = String(r['Pathao Status'] || r.pathaoStatus || '').toLowerCase();

      if (r.isExchange || st.includes('exchange') || pSt.includes('exchange')) {
        exchUnits += q;
        exchVal += v;
      } else if (pSt.includes('return') || st.includes('return') || st.includes('cancel')) {
        retUnits += q;
        retVal += v;
      } else if (st.includes('deliver') || pSt.includes('deliver') || st === 'completed') {
        delivUnits += q;
        delivVal += v;
      }
    });

    const delivRate = totalUnits > 0 ? (delivUnits / totalUnits) * 100 : 0;
    const retRate = totalUnits > 0 ? (retUnits / totalUnits) * 100 : 0;
    const exchRate = totalUnits > 0 ? (exchUnits / totalUnits) * 100 : 0;

    return {
      'Month Statement': name,
      'Status': isClosed ? '🔒 Closed & Audited' : '🟢 Live · Ongoing Month',
      'Total Dispatched Units': totalUnits,
      'Gross Dispatched Value (৳)': Math.round(grossVal),
      'Delivered Units': delivUnits,
      'Net Realized Sales (৳)': Math.round(delivVal),
      'Returned Units': retUnits,
      'Return Loss Value (৳)': Math.round(retVal),
      'Exchanged Units': exchUnits,
      'Exchange Value (৳)': Math.round(exchVal),
      'Delivery Retention Rate (%)': `${delivRate.toFixed(1)}%`,
      'Return Rate (%)': `${retRate.toFixed(1)}%`,
      'Exchange Rate (%)': `${exchRate.toFixed(1)}%`,
    };
  }

  const comparisonRows = [
    computeMonthKpis(septOrders, 'September 2026', true),
    computeMonthKpis(octOrders, 'October 2026', true),
    computeMonthKpis(novOrders, 'November 2026 (Live · Day 3)', false),
  ];

  const wb = XLSX.utils.book_new();

  // Sheet 1: Monthly Comparison Summary
  const wsComp = XLSX.utils.json_to_sheet(comparisonRows);
  autoFitColumns(wsComp, comparisonRows);
  XLSX.utils.book_append_sheet(wb, wsComp, 'Monthly Performance Comparison');

  // Sheet 2: All Multi-Month Orders
  const wsAll = XLSX.utils.json_to_sheet(allOrders);
  autoFitColumns(wsAll, allOrders.slice(0, 100));
  XLSX.utils.book_append_sheet(wb, wsAll, 'All Orders (Multi-Month)');

  // Sheet 3: October Orders
  const wsOct = XLSX.utils.json_to_sheet(octOrders);
  autoFitColumns(wsOct, octOrders.slice(0, 100));
  XLSX.utils.book_append_sheet(wb, wsOct, 'October 2026 Orders');

  // Sheet 4: September Orders
  const wsSept = XLSX.utils.json_to_sheet(septOrders);
  autoFitColumns(wsSept, septOrders.slice(0, 100));
  XLSX.utils.book_append_sheet(wb, wsSept, 'September 2026 Orders');

  // Sheet 5: November Live Orders
  const wsNov = XLSX.utils.json_to_sheet(novOrders);
  autoFitColumns(wsNov, novOrders.slice(0, 100));
  XLSX.utils.book_append_sheet(wb, wsNov, 'November 2026 Live');

  const outFilePath = path.join(process.cwd(), 'Sample Docs', 'DEEN Multi-Month Master Orders (Sept-Oct-Nov).xlsx');
  XLSX.writeFile(wb, outFilePath);
  console.log(`✅ Saved master workbook: ${outFilePath}`);
}

main().catch(console.error);

