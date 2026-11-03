import { getSecretsConfig } from '../src/lib/secrets';

async function main() {
  const sec = getSecretsConfig();
  const url = `${sec.woocommerce.store_url}/wp-json/wc/v3/orders?after=2026-11-01T00:00:00&per_page=20&status=any`;
  const auth = Buffer.from(`${sec.woocommerce.consumer_key}:${sec.woocommerce.consumer_secret}`).toString('base64');

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  const total = res.headers.get('x-wp-total');
  const totalPages = res.headers.get('x-wp-totalpages');
  console.log(`Live November Orders: Total=${total}, Pages=${totalPages}`);

  if (res.ok) {
    const orders = await res.json();
    console.log(`Fetched ${orders.length} November orders.`);
    if (orders.length > 0) {
      console.log('Sample Nov order:', orders[0].id, orders[0].date_created, orders[0].status, orders[0].total);
    }
  } else {
    console.log('Error status:', res.status, await res.text());
  }
}

main().catch(console.error);

