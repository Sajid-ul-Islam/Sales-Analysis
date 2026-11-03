import * as XLSX from 'xlsx';

const wb = XLSX.readFile('Sample Docs/October 2026 Product & SKU Performance.xlsx');
console.log('Sheets in Standalone Workbook:', wb.SheetNames);

const catData = XLSX.utils.sheet_to_json(wb.Sheets['Category Performance']) as any[];
const prodData = XLSX.utils.sheet_to_json(wb.Sheets['Product Performance']) as any[];
const skuData = XLSX.utils.sheet_to_json(wb.Sheets['SKU & Size Performance']) as any[];

console.log(`\n=== TOP 8 CATEGORIES (Out of ${catData.length}) ===`);
catData.slice(0, 8).forEach((c, idx) => {
  console.log(`${idx + 1}. ${c['Apparel Category'].padEnd(16)} | Ordered: ${String(c['Ordered Units']).padStart(3)} | Deliv: ${String(c['Total Delivered Units']).padStart(3)} (${c['Delivery Rate (%)'].padStart(5)}) | Ret: ${String(c['Total Returned Units']).padStart(2)} (${c['Return Rate (%)'].padStart(5)}) | Exch: ${String(c['Exchanged Units']).padStart(2)} | Net Rev: ৳${c['Delivered Value (৳)'].toLocaleString()}`);
});

console.log(`\n=== TOP 10 PRODUCTS (Out of ${prodData.length}) ===`);
prodData.slice(0, 10).forEach((p, idx) => {
  console.log(`${idx + 1}. [${p['Category']}] ${p['Product Name'].padEnd(42)} | Price: ৳${p['Unit Price (৳)']} | Ord: ${String(p['Ordered Units']).padStart(3)} | Deliv: ${String(p['Total Delivered Units']).padStart(3)} | Ret: ${String(p['Total Returned Units']).padStart(2)} | Exch: ${String(p['Exchanged Units']).padStart(2)} | Status: ${p['Performance Tag']}`);
});

console.log(`\n=== TOP 10 SKUs (Out of ${skuData.length}) ===`);
skuData.slice(0, 10).forEach((s, idx) => {
  console.log(`${idx + 1}. [${s['Category']}] SKU: ${s['SKU Code'].padEnd(15)} Size: ${String(s['Size']).padEnd(4)} | Ord: ${String(s['Ordered Units']).padStart(2)} | Deliv: ${String(s['Total Delivered Units']).padStart(2)} | Ret: ${String(s['Total Returned Units']).padStart(2)} | Exch: ${String(s['Exchanged Units']).padStart(2)} | Price: ৳${s['Unit Price (৳)']}`);
});

