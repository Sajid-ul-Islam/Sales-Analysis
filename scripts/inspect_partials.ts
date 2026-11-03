import fs from 'fs';
import * as XLSX from 'xlsx';
import { formatWooCommerceToOrderRows } from '../src/lib/woocommerceClient';
import { extractBaseOrderId, cleanOrderId } from '../src/lib/sync/liveTerminalSync';

const pathaoFile = 'Sample Docs/Oct Pathao Delivey Order Lists.xlsx';
const wbP = XLSX.readFile(pathaoFile);
const rawPathaoData = XLSX.utils.sheet_to_json(wbP.Sheets['Oct All'], { header: 1 }) as any[][];

const pathaoPartials = new Map<string, any>();
for (let i = 1; i < rawPathaoData.length; i++) {
  const row = rawPathaoData[i];
  if (!row) continue;
  const status = String(row[17] || '').trim().toLowerCase();
  if (status.includes('partial')) {
    const mId = String(row[3] || '').trim();
    const collected = parseFloat(row[12] || '0');
    const collectable = parseFloat(row[11] || '0');
    pathaoPartials.set(mId, { collected, collectable });
    const base = extractBaseOrderId(mId);
    if (base) pathaoPartials.set(base, { collected, collectable });
  }
}

console.log('Total partial orders in Pathao:', pathaoPartials.size);

const rawOrders = JSON.parse(fs.readFileSync('src/data/october2026_raw_orders.json', 'utf8'));

pathaoPartials.forEach((val, oId) => {
  const ord = rawOrders.find((o: any) => String(o.id) === oId || String(o.number) === oId);
  if (ord) {
    const items = ord.line_items || [];
    console.log(`Order ${oId}: Collectable=৳${val.collectable}, Collected=৳${val.collected}`);
    console.log(`  Items (${items.length}):`, items.map((it: any) => `${it.name} (৳${it.price} x${it.quantity})`).join(', '));
  }
});

