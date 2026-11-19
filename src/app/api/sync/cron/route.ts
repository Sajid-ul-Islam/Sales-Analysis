import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { batchFetchPathaoOrders, formatPathaoToReturnRows } from '@/lib/pathaoClient';
import { fetchWooCommerceOrders, formatWooCommerceToOrderRows } from '@/lib/woocommerceClient';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { getBaselineDataset } from '@/lib/baselineLoader';
import { DatasetSnapshot, RawOrderRow } from '@/types';
import { getDhakaDaysAgoIso, getDhakaTodayIso } from '@/lib/timezone';
import { clearSampleDataMemoryCache } from '@/lib/sync/sampleDataCache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60s max execution time for Vercel Cron

/**
 * DEEN Commerce — Automated Incremental Cron Sync (Option C)
 * Runs on a schedule (e.g. daily at 2 AM) to:
 * 1. Load active baseline dataset from disk / memory.
 * 2. Fetch recent WooCommerce orders (last 3-7 days).
 * 3. Identify in-flight / unfinalized Pathao consignments and refresh their delivery status.
 * 4. Merge updates non-destructively by primary key.
 * 5. Persist the refreshed dataset directly to src/data/baselineSample.json.
 */
export async function GET(req: Request) {
  // 1. Mandatory Admin / Cron Authentication Check
  const auth = validateApiRequest(req, { requiredRole: 'admin', allowDemo: false, allowCronSecret: true });
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, message: 'Unauthorized: Valid Admin secret or CRON_SECRET required.' }, { status: 401 });
  }

  const log: string[] = [];
  const startTime = Date.now();

  try {
    // 2. Load Base Dataset directly from unified baseline
    const b = (getBaselineDataset() || {}) as Record<string, unknown>;
    const baseDataset: DatasetSnapshot = {
      orders: (b.orders as RawOrderRow[]) || [],
      pathaoDelivery: (b.pathaoDelivery as RawOrderRow[]) || [],
      returns: (b.returns as RawOrderRow[]) || [],
      partials: (b.partials as RawOrderRow[]) || [],
      exchanges: (b.exchanges as RawOrderRow[]) || [],
      sourceName: (b.sourceName as string) || 'Unified Baseline (Cron Base)',
    };
    log.push(`Loaded base from baseline dataset: ${baseDataset.orders.length} orders, ${baseDataset.returns?.length || 0} returns`);

    // 3. Step A: Incremental WooCommerce Sync
    const url = new URL(req.url);
    const daysParam = parseInt(url.searchParams.get('days') || '7', 10);
    const syncDays = Math.min(Math.max(isNaN(daysParam) ? 7 : daysParam, 1), 90);
    const maxPagesParam = parseInt(url.searchParams.get('max_pages') || (syncDays > 7 ? '10' : '2'), 10);

    let newWcOrdersCount = 0;
    try {
      const daysAgo = getDhakaDaysAgoIso(syncDays);
      log.push(`Sync window: Last ${syncDays} days (after ${daysAgo}T00:00:00)`);
      const rawWc = await fetchWooCommerceOrders({
        after: `${daysAgo}T00:00:00`,
        perPage: 50,
        maxPages: maxPagesParam,
        fetchAllPages: true,
      });

      if (rawWc && rawWc.length > 0) {
        const formattedRows = formatWooCommerceToOrderRows(rawWc);
        newWcOrdersCount = formattedRows.length;

        // Deduplicate & non-destructively merge: incoming orders update matching orderId
        const orderMap = new Map<string, RawOrderRow[]>();
        for (const o of baseDataset.orders || []) {
          const id = String(o['Order ID'] || o.orderId || o.orderNumber || '');
          if (!orderMap.has(id)) orderMap.set(id, []);
          orderMap.get(id)!.push(o);
        }

        // Overlay recent WooCommerce orders
        const newOrderMap = new Map<string, RawOrderRow[]>();
        for (const o of formattedRows) {
          const id = String(o['Order ID'] || o.orderId || o.orderNumber || '');
          if (!newOrderMap.has(id)) newOrderMap.set(id, []);
          newOrderMap.get(id)!.push(o);
        }

        newOrderMap.forEach((rows, id) => {
          orderMap.set(id, rows);
        });

        baseDataset.orders = Array.from(orderMap.values()).flat();
        log.push(`Merged ${newWcOrdersCount} recent WooCommerce order items (Total: ${baseDataset.orders.length})`);
      }
    } catch (wcErr: unknown) {
      const msg = wcErr instanceof Error ? wcErr.message : String(wcErr);
      log.push(`WooCommerce sync skipped/notice: ${msg}`);
    }

    // 4. Step B: Incremental "Bit-by-Bit" Pathao Sync (Max 30 in-flight parcels)
    let updatedPathaoCount = 0;
    try {
      const candidates: string[] = [];

      // Find in-flight / recent orders that are NOT yet finalized as Delivered or Returned
      for (const ord of baseDataset.orders || []) {
        const status = String(ord['Delivery Status'] || ord.deliveryStatus || '').toLowerCase();
        const isFinalized = status.includes('delivered') || status.includes('paid return') || status.includes('not paid return');
        const cid = ord['Consignment ID'] || ord.consignmentId || ord.trackingId || ord.consignment_id;

        if (cid && !isFinalized) {
          candidates.push(String(cid).trim());
        }
      }

      // Also check recent returns/delivery records
      for (const ret of (baseDataset.returns || []).slice(-50)) {
        const cid = ret['Consignment ID'] || ret.consignmentId || ret.consignment_id;
        const status = String(ret['Delivery Status'] || ret.deliveryStatus || '').toLowerCase();
        if (cid && !status.includes('paid')) {
          candidates.push(String(cid).trim());
        }
      }

      // Deduplicate and take a gentle slice of 25 (zero pressure on Pathao API)
      const uniqueConsignments = Array.from(new Set(candidates)).slice(0, 25);

      if (uniqueConsignments.length > 0) {
        const pathaoResults = await batchFetchPathaoOrders(uniqueConsignments, 3);
        if (pathaoResults && pathaoResults.length > 0) {
          const newReturnRows = formatPathaoToReturnRows(pathaoResults);
          updatedPathaoCount = newReturnRows.length;

          // Merge into returns list
          const returnMap = new Map<string, RawOrderRow>();
          for (const r of baseDataset.returns || []) {
            const cid = String(r['Consignment ID'] || r.consignment_id || r.order_id || '');
            if (cid) returnMap.set(cid, r);
          }
          for (const r of newReturnRows) {
            const cid = String(r['Consignment ID'] || r.consignment_id || r.order_id || '');
            if (cid) returnMap.set(cid, r);
          }
          baseDataset.returns = Array.from(returnMap.values());
          log.push(`Incremental Pathao check: updated ${updatedPathaoCount} in-flight consignments`);
        }
      } else {
        log.push('Pathao check: all active consignments are already finalized');
      }
    } catch (pathaoErr: unknown) {
      const msg = pathaoErr instanceof Error ? pathaoErr.message : String(pathaoErr);
      log.push(`Pathao sync skipped/notice: ${msg}`);
    }

    // 5. Step C: Option C - Persist Merged Snapshot directly to baselineSample.json
    let baselineSaved = false;
    baseDataset.syncedAt = new Date().toISOString();
    (baseDataset as any).updatedAt = new Date().toISOString();
    baseDataset.sourceName = `Cron Automated Snapshot (${getDhakaTodayIso()})`;

    try {
      const localPath = path.join(process.cwd(), 'src', 'data', 'baselineSample.json');
      if (fs.existsSync(path.dirname(localPath))) {
        fs.writeFileSync(localPath, JSON.stringify(baseDataset, null, 2), 'utf-8');
        clearSampleDataMemoryCache();
        baselineSaved = true;
        log.push(`Saved refreshed dataset directly to local baseline: ${localPath}`);
      }
    } catch (fsErr) {
      log.push(`Local filesystem write skipped (serverless environment): ${fsErr instanceof Error ? fsErr.message : String(fsErr)}`);
    }

    const durationMs = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      durationMs,
      newWcOrdersCount,
      updatedPathaoCount,
      totalOrdersInStore: baseDataset.orders?.length || 0,
      totalReturnsInStore: baseDataset.returns?.length || 0,
      baselineSaved,
      log,
      message: `Cron completed in ${(durationMs / 1000).toFixed(1)}s: ${newWcOrdersCount} new WooCommerce rows, ${updatedPathaoCount} Pathao parcels refreshed.`,
    });
  } catch (err: unknown) {
    console.error('[API /api/sync/cron] Fatal error:', err);
    const errorMsg = err instanceof Error ? err.message : 'Cron execution failed';
    return NextResponse.json({
      success: false,
      error: errorMsg,
      log,
    }, { status: 500 });
  }
}
