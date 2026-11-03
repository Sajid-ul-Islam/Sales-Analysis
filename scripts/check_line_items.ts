import fs from 'fs';
import { formatWooCommerceToOrderRows } from '../src/lib/woocommerceClient';

const raw = JSON.parse(fs.readFileSync('src/data/october2026_raw_orders.json', 'utf8'));
const rows = formatWooCommerceToOrderRows(raw);
console.log('Total formatted rows:', rows.length);

const counts: Record<string, number> = {};
rows.forEach((r) => {
  const key = `isPos:${r.isPos},createdVia:${r.created_via || r.createdVia}`;
  counts[key] = (counts[key] || 0) + 1;
});
console.log('Row status breakdown:', counts);

// Check isPos determination
let isPosTrue = 0;
rows.forEach((r) => {
  if (r.isPos) isPosTrue++;
});
console.log('isPos true count:', isPosTrue);

