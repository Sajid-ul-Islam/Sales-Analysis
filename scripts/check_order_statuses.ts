import { getSecretsConfig } from '../src/lib/secrets';

const ORDER_IDS = [19140, 19172, 19190, 19195, 19197, 19207, 19214, 19233, 19329, 19330, 19336];

async function main() {
  const secrets = getSecretsConfig();
  const wc = secrets.woocommerce;
  const authHeader = 'Basic ' + Buffer.from(`${wc.consumer_key}:${wc.consumer_secret}`).toString('base64');
  const baseUrl = wc.store_url.replace(/\/+$/, '');

  console.log('Fetching live status for', ORDER_IDS.length, 'orders from WooCommerce...\n');
  console.log('Order #  | Created       | Status        | Total   | Items');
  console.log('---------|---------------|---------------|---------|--------------------------------');

  for (const id of ORDER_IDS) {
    try {
      const res = await fetch(`${baseUrl}/wp-json/wc/v3/orders/${id}`, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
      });
      if (!res.ok) {
        console.log(`${id}      | ERROR: HTTP ${res.status}`);
        continue;
      }
      const o = await res.json();
      const created = (o.date_created || '').slice(0, 10);
      const modified = (o.date_modified || '').slice(0, 10);
      const status = o.status || 'unknown';
      const total = `৳${parseFloat(o.total || '0').toLocaleString()}`;
      const items = (o.line_items || []).map((it: any) => `${it.name} x${it.quantity}`).join(', ').slice(0, 60);
      const modifiedNote = modified !== created ? ` (mod: ${modified})` : '';
      console.log(`${id} | ${created}${modifiedNote} | ${status.padEnd(13)} | ${total.padEnd(7)} | ${items}`);
    } catch (e: any) {
      console.log(`${id}      | FETCH ERROR: ${e.message}`);
    }
  }
  console.log('\nDone.');
}

main().catch(console.error);
