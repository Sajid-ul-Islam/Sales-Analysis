import fs from 'fs';
import { formatWooCommerceToOrderRows } from '../src/lib/woocommerceClient';

const rawOrders = JSON.parse(fs.readFileSync('src/data/october2026_raw_orders.json', 'utf8'));
const rows = formatWooCommerceToOrderRows(rawOrders);

// Group by orderId
const orderMap = new Map<string, any[]>();
rows.forEach((r) => {
  const oId = r['Order ID'];
  if (!orderMap.has(oId)) orderMap.set(oId, []);
  orderMap.get(oId)!.push(r);
});

console.log('Total orders in formatted rows:', orderMap.size);

let ordersWithPosRows = 0;
let ordersWithCheckoutRows = 0;
let ordersWithSipExchangeRows = 0;

orderMap.forEach((items, oId) => {
  const hasPos = items.some((it) => it.isPos);
  const hasCheckout = items.some((it) => !it.isPos && (it.createdVia === 'checkout' || it.createdVia === 'store-api' || !it.createdVia));
  const hasExchange = items.some((it) => it.createdVia === 'sip_exchange');

  if (hasPos) ordersWithPosRows++;
  if (hasCheckout) ordersWithCheckoutRows++;
  if (hasExchange) ordersWithSipExchangeRows++;
});

console.log('Orders with isPos rows:', ordersWithPosRows);
console.log('Orders with checkout rows:', ordersWithCheckoutRows);
console.log('Orders with sip_exchange rows:', ordersWithSipExchangeRows);

// Let's inspect 3 sample orders with isPos rows
let sampled = 0;
orderMap.forEach((items, oId) => {
  if (items.some((it) => it.isPos) && sampled < 3) {
    sampled++;
    const rawOrder = rawOrders.find((o: any) => String(o.id) === oId);
    console.log(`Sample order ${oId}:`);
    console.log('  created_via:', rawOrder?.created_via);
    console.log('  status:', rawOrder?.status);
    console.log('  payment_method:', rawOrder?.payment_method);
    console.log('  meta outlet/pos keys:', rawOrder?.meta_data?.filter((m: any) => m.key.includes('outlet') || m.key.includes('sip') || m.key.includes('pos')));
  }
});

