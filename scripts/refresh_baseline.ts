/**
 * Refresh Baseline Script
 * -----------------------
 * 1. Re-fetches October orders modified after 2026-11-01 (to pick up completed/cancelled status updates)
 * 2. Merges November 2026 raw orders (already cached at src/data/november2026_raw_orders.json)
 * 3. Rebuilds baselineSample.json with the full merged dataset
 *
 * Run: npx tsx scripts/refresh_baseline.ts
 */

import path from 'path';
import fs from 'fs';
import { getSecretsConfig } from '../src/lib/secrets';
import { formatWooCommerceToOrderRows } from '../src/lib/woocommerceClient';

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchOrdersByModifiedAfter(
  baseUrl: string,
  authHeader: string,
  afterDate: string, // YYYY-MM-DD
  beforeDate?: string
): Promise<any[]> {
  const orders: any[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = new URL(`${baseUrl}/wp-json/wc/v3/orders`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', '100');
    url.searchParams.set('modified_after', `${afterDate}T00:00:00`);
    if (beforeDate) url.searchParams.set('modified_before', `${beforeDate}T23:59:59`);
    url.searchParams.set('status', 'any');
    url.searchParams.set('orderby', 'modified');
    url.searchParams.set('order', 'desc');

    process.stdout.write(`  Page ${page}/${totalPages}... `);
    const start = performance.now();
    const res = await fetch(url.toString(), {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });

    if (!res.ok) {
      console.error(`HTTP ${res.status}`);
      break;
    }
    const headerTotalPages = res.headers.get('x-wp-totalpages');
    const headerTotal = res.headers.get('x-wp-total');
    if (headerTotalPages) totalPages = parseInt(headerTotalPages, 10);
    const pageOrders = await res.json();
    if (!Array.isArray(pageOrders) || pageOrders.length === 0) break;
    orders.push(...pageOrders);
    console.log(`${pageOrders.length} orders (${Math.round(performance.now() - start)}ms) — total so far: ${orders.length}/${headerTotal || '?'}`);
    if (pageOrders.length < 100 || page >= totalPages) break;
    page++;
    await sleep(250);
  }
  return orders;
}

/** Non-destructive upsert — incoming wins on conflict (fresher data) */
function upsertOrders(existing: any[], incoming: any[]): any[] {
  const map = new Map<string, any>();
  for (const o of existing) map.set(String(o.id || o.number), o);
  let updated = 0, added = 0;
  for (const o of incoming) {
    const key = String(o.id || o.number);
    if (map.has(key)) updated++;
    else added++;
    map.set(key, o); // incoming (fresher) wins
  }
  console.log(`  Upsert: ${updated} updated, ${added} new, total: ${map.size}`);
  return Array.from(map.values());
}

async function main() {
  const secrets = getSecretsConfig();
  const wc = secrets.woocommerce;
  const authHeader = 'Basic ' + Buffer.from(`${wc.consumer_key}:${wc.consumer_secret}`).toString('base64');
  const baseUrl = wc.store_url.replace(/\/+$/, '');

  console.log('══════════════════════════════════════════════════════');
  console.log('🔄 BASELINE REFRESH — Stale October + Full November');
  console.log('══════════════════════════════════════════════════════\n');

  // ── Step 1: Re-fetch October orders modified after Nov 1 ─────────────────
  console.log('📥 Step 1: Fetching October orders modified after 2026-11-01...');
  const refreshedOct = await fetchOrdersByModifiedAfter(baseUrl, authHeader, '2026-11-01', '2026-10-31');
  // Note: modified_after + date range isn't directly filterable, so we fetch all
  // orders modified after Nov 1 and filter those created in October
  const refreshedOctOnly = refreshedOct.filter((o) => {
    const created = o.date_created || '';
    return created.startsWith('2026-10');
  });
  console.log(`  → ${refreshedOct.length} total modified-after-Nov1 orders, ${refreshedOctOnly.length} are October orders\n`);

  // Also fetch ALL processing orders that might be from before October (older stale)
  console.log('📥 Step 1b: Fetching any remaining processing orders (older stale)...');
  const url = new URL(`${baseUrl}/wp-json/wc/v3/orders`);
  url.searchParams.set('per_page', '100');
  url.searchParams.set('status', 'processing');
  url.searchParams.set('orderby', 'date');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('page', '1');
  const procRes = await fetch(url.toString(), { headers: { Authorization: authHeader, Accept: 'application/json' } });
  const procOrders = procRes.ok ? await procRes.json() : [];
  console.log(`  → ${Array.isArray(procOrders) ? procOrders.length : 0} processing orders found\n`);

  // ── Step 2: Load November raw (already fetched) ───────────────────────────
  console.log('📥 Step 2: Loading November 2026 raw orders from cache...');
  const novPath = path.join(process.cwd(), 'src', 'data', 'november2026_raw_orders.json');

  // Re-fetch November to get latest statuses (waiting orders may have changed)
  console.log('  Re-fetching November orders to get latest statuses...');
  const freshNov = await fetchOrdersByModifiedAfter(baseUrl, authHeader, '2026-11-01');
  const freshNovOnly = freshNov.filter((o) => {
    const created = o.date_created || '';
    return created.startsWith('2026-11');
  });
  console.log(`  → ${freshNovOnly.length} November orders with fresh statuses`);

  // Also load the cached November to catch any the modified_after might have missed
  let cachedNov: any[] = [];
  if (fs.existsSync(novPath)) {
    cachedNov = JSON.parse(fs.readFileSync(novPath, 'utf8'));
    console.log(`  Loaded ${cachedNov.length} cached November orders`);
  }

  // Merge: cached Nov as base, fresh Nov as update
  let mergedNov = upsertOrders(cachedNov, freshNovOnly);
  console.log(`  → Merged November dataset: ${mergedNov.length} orders`);

  // Save updated November cache
  fs.writeFileSync(novPath, JSON.stringify(mergedNov, null, 2), 'utf8');
  console.log(`  💾 Updated november2026_raw_orders.json\n`);

  // ── Step 3: Build merged raw orders dataset ────────────────────────────────
  console.log('🔀 Step 3: Merging all data sources...');

  // Load existing baseline raw orders to preserve any other months
  const baselinePath = path.join(process.cwd(), 'src', 'data', 'baselineSample.json');
  const existingBaseline = fs.existsSync(baselinePath)
    ? JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
    : { orders: [] };

  // We need to rebuild from raw WC orders. Merge order of precedence:
  // 1. Start with merged November (freshest)
  // 2. Upsert refreshed October (fresh statuses)
  // 3. Upsert stale processing orders
  // 4. The existing baseline handles pre-October if needed

  // Reconstruct raw merged set
  let allRaw: any[] = [];
  allRaw = upsertOrders(allRaw, mergedNov);
  allRaw = upsertOrders(allRaw, refreshedOct); // All modified-after-Nov1 (includes non-Oct)
  if (Array.isArray(procOrders) && procOrders.length > 0) {
    allRaw = upsertOrders(allRaw, procOrders);
  }

  // ── Step 4: Transform to RawOrderRow format ───────────────────────────────
  console.log('\n📊 Step 4: Transforming to RawOrderRow format...');
  const formattedRows = formatWooCommerceToOrderRows(allRaw);
  console.log(`  → ${formattedRows.length} line item rows from ${allRaw.length} orders`);

  // Status breakdown of merged raw
  const statusCounts: Record<string, number> = {};
  for (const o of allRaw) {
    const s = String(o.status || 'unknown');
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }
  console.log('\n  Status breakdown of merged dataset:');
  console.table(statusCounts);

  // ── Step 5: Write updated baselineSample.json ────────────────────────────
  console.log('💾 Step 5: Writing updated baselineSample.json...');
  const newBaseline = {
    orders: formattedRows,
    returns: [],
    partials: [],
    exchanges: [],
    pathaoDelivery: [],
    updatedAt: new Date().toISOString(),
    sourceName: `⚡ Refreshed Baseline — Oct (refreshed) + Nov ${mergedNov.length} orders · ${formattedRows.length} items · ${new Date().toLocaleDateString('en-GB')}`,
  };
  fs.writeFileSync(baselinePath, JSON.stringify(newBaseline, null, 2), 'utf8');
  console.log(`  ✅ Saved to ${baselinePath}`);
  console.log(`  Total rows: ${formattedRows.length}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const waitingCount = allRaw.filter((o) => o.status === 'waiting').length;
  const processingCount = allRaw.filter((o) => o.status === 'processing').length;
  console.log('\n══════════════════════════════════════════════════════');
  console.log('✅ BASELINE REFRESH COMPLETE');
  console.log(`   Total raw orders merged : ${allRaw.length}`);
  console.log(`   Waiting (queue)         : ${waitingCount}`);
  console.log(`   Processing              : ${processingCount}`);
  console.log(`   Total formatted rows    : ${formattedRows.length}`);
  console.log('══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
