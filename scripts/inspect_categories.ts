import fs from 'fs';
import { formatWooCommerceToOrderRows } from '../src/lib/woocommerceClient';

const rawOrders = JSON.parse(fs.readFileSync('src/data/october2026_raw_orders.json', 'utf8'));
const allRows = formatWooCommerceToOrderRows(rawOrders);

const catMap = new Map<string, { count: number; revenue: number }>();
const subCatMap = new Map<string, { count: number; revenue: number }>();

allRows.forEach((r) => {
  const cat = r.Category || r.category || 'Uncategorized';
  const subCat = r.Subcategory || r.subCategory || 'General';
  const qty = Number(r.Quantity || r.quantity || 1);
  const cost = Number(r['Item Cost'] || r.itemCost || 0);

  if (!catMap.has(cat)) catMap.set(cat, { count: 0, revenue: 0 });
  const cEntry = catMap.get(cat)!;
  cEntry.count += qty;
  cEntry.revenue += qty * cost;

  if (!subCatMap.has(subCat)) subCatMap.set(subCat, { count: 0, revenue: 0 });
  const scEntry = subCatMap.get(subCat)!;
  scEntry.count += qty;
  scEntry.revenue += qty * cost;
});

console.log('Categories found:');
Array.from(catMap.entries())
  .sort((a, b) => b[1].revenue - a[1].revenue)
  .forEach(([cat, data]) => {
    console.log(`  ${cat.padEnd(25)}: ${data.count} units | ৳${Math.round(data.revenue).toLocaleString()}`);
  });

console.log('\nTop 15 Sub-Categories found:');
Array.from(subCatMap.entries())
  .sort((a, b) => b[1].revenue - a[1].revenue)
  .slice(0, 15)
  .forEach(([sc, data]) => {
    console.log(`  ${sc.padEnd(25)}: ${data.count} units | ৳${Math.round(data.revenue).toLocaleString()}`);
  });

