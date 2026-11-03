import { getSecretsConfig } from '../src/lib/secrets';

async function main() {
  const sec = getSecretsConfig();
  const url = `${sec.woocommerce.store_url}/wp-json/wc/v3/orders?after=2026-09-01T00:00:00&before=2026-09-30T23:59:59&per_page=5&status=any`;
  const auth = Buffer.from(`${sec.woocommerce.consumer_key}:${sec.woocommerce.consumer_secret}`).toString('base64');

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  const total = res.headers.get('x-wp-total');
  const totalPages = res.headers.get('x-wp-totalpages');
  console.log(`WooCommerce September Orders: Total=${total}, Pages=${totalPages}`);
}

main().catch(console.error);

