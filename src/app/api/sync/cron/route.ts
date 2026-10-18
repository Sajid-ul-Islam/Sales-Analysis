import { NextResponse } from 'next/server';
import { fetchDatasetFromBlob, uploadDatasetToBlob, isBlobConfigured } from '@/lib/blobStorage';
import { batchFetchPathaoOrders, formatPathaoToReturnRows } from '@/lib/pathaoClient';
import { fetchWooCommerceOrders, formatWooCommerceToOrderRows } from '@/lib/woocommerceClient';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import baselineData from '@/data/baselineSample.json';
import { DatasetSnapshot, RawOrderRow } from '@/types';
import { getDhakaDaysAgoIso, getDhakaTodayIso } from '@/lib/timezone';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60s max execution time for Vercel Cron

/**
 * DEEN Commerce — Automated Incremental Cron Sync
 * Runs on a schedule (e.g. daily at 2 AM) to:
 * 1. Fetch recent WooCommerce orders (last 3-7 days).
 * 2. Identify in-flight / unfinalized Pathao consignments.
 * 3. Query Pathao gently (max 25-30 consignments with concurrency control).
 * 4. Merge updates with historical records and persist to Vercel Blob.
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
    // 2. Load Base Dataset (Prefer Vercel Blob, fallback to bundled baseline)
    let baseDataset: DatasetSnapshot = {
      orders: [],
      pathaoDelivery: [],
      returns: [],
      partials: [],
      exchanges: [],
      sourceName: 'Cron Automated Snapshot',
    };

    if (isBlobConfigured()) {
      const blobRes = await fetchDatasetFromBlob();
      if (blobRes.success && blobRes.dataset) {
        baseDataset = blobRes.dataset;
        log.push(`Loaded base from Vercel Blob: ${baseDataset.orders?.length || 0} orders`);
      }
    }

    if (!baseDataset.orders || baseDataset.orders.length === 0) {
      const b = (baselineData || {}) as Record<string, unknown>;
      baseDataset = {
        orders: (b.orders as RawOrderRow[]) || [],
        pathaoDelivery: (b.pathaoDelivery as RawOrderRow[]) || [],
        returns: (b.returns as RawOrderRow[]) || [],
        partials: (b.partials as RawOrderRow[]) || [],
        exchanges: (b.exchanges as RawOrderRow[]) || [],
        sourceName: 'Bundled Baseline (Cron Base)',
      };
      log.push(`Loaded base from bundled baseline: ${baseDataset.orders.length} orders`);
    }

    // 3. Step A: Incremental WooCommerce Sync (Recent 7 days in Asia/Dhaka)
    let newWcOrdersCount = 0;
    try {
      const sevenDaysAgo = getDhakaDaysAgoIso(7);
      const rawWc = await fetchWooCommerceOrders({
        after: `${sevenDaysAgo}T00:00:00`,
        perPage: 50,
        maxPages: 2,
        fetchAllPages: true,
      });

      if (rawWc && rawWc.length > 0) {
        const formattedRows = formatWooCommerceToOrderRows(rawWc);
        newWcOrdersCount = formattedRows.length;

        // Deduplicate & merge: new order items replace older entries matching the order ID
        const orderMap = new Map<string, RawOrderRow[]>();
        for (const o of baseDataset.orders || []) {
          const id = String(o['Order ID'] || o.orderId || '');
          if (!orderMap.has(id)) orderMap.set(id, []);
          orderMap.get(id)!.push(o);
        }

        // Overlay recent WooCommerce orders
        const newOrderMap = new Map<string, RawOrderRow[]>();
        for (const o of formattedRows) {
          const id = String(o['Order ID'] || o.orderId || '');
          if (!newOrderMap.has(id)) newOrderMap.set(id, []);
          newOrderMap.get(id)!.push(o);
        }

        newOrderMap.forEach((rows, id) => {
          orderMap.set(id, rows);
        });

        baseDataset.orders = Array.from(orderMap.values()).flat();
        log.push(`Merged ${newWcOrdersCount} recent WooCommerce order items`);
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

    // 5. Step C: Save Merged Snapshot to Vercel Blob
    let blobSaved = false;
    baseDataset.syncedAt = new Date().toISOString();
    baseDataset.sourceName = `Cron Automated Snapshot (${getDhakaTodayIso()})`;

    if (isBlobConfigured()) {
      const upload = await uploadDatasetToBlob(baseDataset, { createTimestampArchive: false });
      blobSaved = upload.success;
      log.push(`Saved merged dataset to Vercel Blob: ${upload.message}`);
    } else {
      log.push('Vercel Blob not configured; skipping cloud persistence');
    }

    const durationMs = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      durationMs,
      newWcOrdersCount,
      updatedPathaoCount,
      totalOrdersInStore: baseDataset.orders?.length || 0,
      totalReturnsInStore: baseDataset.returns?.length || 0,
      blobSaved,
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
