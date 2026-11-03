import fs from 'fs';
import { formatWooCommerceToOrderRows } from '../src/lib/woocommerceClient';

const rawOrders = JSON.parse(fs.readFileSync('src/data/october2026_raw_orders.json', 'utf8'));
const allRows = formatWooCommerceToOrderRows(rawOrders);

const productMap = new Map<string, number>();
const skuMap = new Map<string, number>();

allRows.forEach((r) => {
  const pName = r['Item Name'] || r.itemName || '';
  // Clean product name by removing trailing size (e.g., " - M", " - 32", " - XXL")
  const baseName = pName.replace(/\s*-\s*(s|m|l|xl|xxl|2xl|3xl|4xl|28|30|32|34|36|38|40|42|free size|regular)\s*$/i, '').trim();
  const sku = r.SKU || r.sku || 'GENERAL';

  productMap.set(baseName, (productMap.get(baseName) || 0) + Number(r.Quantity || 1));
  skuMap.set(sku, (skuMap.get(sku) || 0) + Number(r.Quantity || 1));
});

console.log('Unique Base Products:', productMap.size);
console.log('Unique SKUs:', skuMap.size);

// Print Top 10 Products by units
console.log('\nTop 10 Products:');
Array.from(productMap.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([p, qty], idx) => {
    console.log(`  ${idx + 1}. ${p.padEnd(45)}: ${qty} units`);
  });

// Print Top 10 SKUs by units
console.log('\nTop 10 SKUs:');
Array.from(skuMap.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([s, qty], idx) => {
    console.log(`  ${idx + 1}. ${s.padEnd(25)}: ${qty} units`);
  });

