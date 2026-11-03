import fs from 'fs';
import path from 'path';
import { getSecretsConfig } from '../src/lib/secrets';

async function fetchAllNovemberOrders() {
  const sec = getSecretsConfig();
  const auth = Buffer.from(`${sec.woocommerce.consumer_key}:${sec.woocommerce.consumer_secret}`).toString('base64');
  const baseUrl = sec.woocommerce.store_url;

  console.log(`Starting fetch of all November 2026 orders from WooCommerce...`);
  let page = 1;
  const allOrders: any[] = [];
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${baseUrl}/wp-json/wc/v3/orders?after=2026-11-01T00:00:00&per_page=100&page=${page}&status=any`;
    console.log(`Fetching page ${page}...`);
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!res.ok) {
      console.error(`Page ${page} failed: ${res.status} ${await res.text()}`);
      break;
    }

    const tp = res.headers.get('x-wp-totalpages');
    if (tp) totalPages = parseInt(tp, 10);
    const totalOrders = res.headers.get('x-wp-total');

    const orders = await res.json();
    console.log(`Page ${page}/${totalPages}: Received ${orders.length} orders (Total in WC: ${totalOrders})`);
    allOrders.push(...orders);
    page++;
  }

  console.log(`\nSuccessfully fetched ${allOrders.length} November 2026 orders.`);
  const outPath = path.join(process.cwd(), 'src', 'data', 'november2026_raw_orders.json');
  fs.writeFileSync(outPath, JSON.stringify(allOrders, null, 2), 'utf8');
  console.log(`Saved raw November orders to: ${outPath}`);
}

fetchAllNovemberOrders().catch(console.error);
