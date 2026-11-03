import fs from 'fs';
import * as XLSX from 'xlsx';

// Load October Checkout Orders List workbook
const wb = XLSX.readFile('Sample Docs/October 2026 Checkout Orders List.xlsx');
const checkoutOrders = XLSX.utils.sheet_to_json(wb.Sheets['October Checkout Orders']) as any[];
const checkoutLineItems = XLSX.utils.sheet_to_json(wb.Sheets['Checkout Line Items']) as any[];
const allOrders = XLSX.utils.sheet_to_json(wb.Sheets['All October Orders']) as any[];

console.log('Checkout Orders:', checkoutOrders.length);
console.log('Checkout Line Items in sheet:', checkoutLineItems.length);
console.log('All Orders:', allOrders.length);

// Check delivery statuses in checkoutOrders
const orderStatusMap = new Map<string, any>();
checkoutOrders.forEach((o) => {
  const oId = String(o['Order ID']).trim();
  orderStatusMap.set(oId, {
    pathaoStatus: o['Pathao Delivery Status'] || 'Untracked',
    wcStatus: o['Status'] || '',
    audit: o['Reconciliation Audit'] || '',
    cod: Number(o['Pathao Collected COD (৳)']) || 0,
    fee: Number(o['Pathao Courier Fee (৳)']) || 0,
  });
});

// Let's inspect unique statuses
const pathaoStatuses = new Set<string>();
checkoutOrders.forEach((o) => pathaoStatuses.add(o['Pathao Delivery Status']));
console.log('Pathao statuses in checkout orders:', Array.from(pathaoStatuses));

// Check line items: what statuses do they currently have?
const lineItemStatuses = new Set<string>();
checkoutLineItems.forEach((it) => lineItemStatuses.add(it['Courier Delivery Status']));
console.log('Line item courier statuses:', Array.from(lineItemStatuses));

