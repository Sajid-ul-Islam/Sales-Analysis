import fs from 'fs';
import * as XLSX from 'xlsx';

// Read the October Checkout Orders List workbook
const wb = XLSX.readFile('Sample Docs/October 2026 Checkout Orders List.xlsx');
console.log('Sheets in workbook:', wb.SheetNames);

const checkoutOrders = XLSX.utils.sheet_to_json(wb.Sheets['October Checkout Orders']) as any[];
const lineItems = XLSX.utils.sheet_to_json(wb.Sheets['Checkout Line Items']) as any[];
const allOrders = XLSX.utils.sheet_to_json(wb.Sheets['All October Orders']) as any[];

console.log('checkoutOrders:', checkoutOrders.length);
console.log('lineItems in sheet:', lineItems.length);
console.log('allOrders in sheet:', allOrders.length);

// Also read raw orders to verify all 2,445 line items
const rawOrders = JSON.parse(fs.readFileSync('src/data/october2026_raw_orders.json', 'utf8'));
let rawLineItemsCount = 0;
rawOrders.forEach((o: any) => {
  rawLineItemsCount += (o.line_items || []).length;
});
console.log('rawLineItemsCount across all raw orders:', rawLineItemsCount);

