import { NextResponse } from 'next/server';
import path from 'path';
import * as XLSX from 'xlsx';
import fs from 'fs';
import { sanitizeOrdersResponse } from '@/lib/auth/dataMasking';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { createDataProvenance } from '@/lib/dataAudit';
import { getBaselineDataset } from '@/lib/baselineLoader';
import { DatasetSnapshot, RawOrderRow } from '@/types';
import { sampleDatasetSnapshot } from '@/lib/orderSampling';
import { jsonWithEdgeCache, isClientFresh, createNotModifiedResponse } from '@/lib/edgeCache';
import { fetchWooCommerceOrders, formatWooCommerceToOrderRows, testWooCommerceConnection } from '@/lib/woocommerceClient';

function findFirstExistingFile(candidatePaths: string[]): string | null {
  try {
    for (const p of candidatePaths) {
      if (typeof fs !== 'undefined' && fs.existsSync && fs.existsSync(p)) return p;
    }
  } catch {
    return null;
  }
  return null;
}

function parseExcelFile(filePath: string): RawOrderRow[] {
  try {
    if (!filePath || typeof fs === 'undefined' || !fs.existsSync || !fs.existsSync(filePath)) {
      return [];
    }
    const buf = fs.readFileSync(filePath);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const targetSheet = wb.Sheets['All Orders (Multi-Month)'] || wb.Sheets['Checkout Line Items'] || (wb.SheetNames[0] ? wb.Sheets[wb.SheetNames[0]] : null);
    if (!targetSheet) return [];
    return XLSX.utils.sheet_to_json(targetSheet, { defval: '' });
  } catch (err) {
    console.warn(`[API /api/sample-data] Non-fatal notice reading ${filePath}:`, err);
    return [];
  }
}

// In-memory cache for fast unprivileged responses
interface CachedFallback {
  payload: Record<string, unknown>;
  etag: string;
}
let cachedMaskedFallback: CachedFallback | null = null;

export function clearSampleDataMemoryCache(): void {
  cachedMaskedFallback = null;
}

// ISR (Incremental Static Regeneration): Cache static baseline sample data for 1 hour
export const revalidate = 3600;

export async function GET(req: Request) {
  try {
    const auth = validateApiRequest(req, { requiredRole: 'readonly', allowDemo: true });
    const isPrivileged = auth.authenticated && (auth.role === 'admin' || auth.role === 'operator');

    const url = new URL(req.url);
    const isForceSync = url.searchParams.get('force') === 'true' ||
      url.searchParams.get('refresh') === 'true' ||
      req.headers.get('x-force-sync') === 'true';

    // ─────────────────────────────────────────────────────────────────────────────
    // OPTION B: FORCED LIVE SYNC (Fallback to live WooCommerce REST API)
    // ─────────────────────────────────────────────────────────────────────────────
    if (isForceSync) {
      try {
        const testConn = await testWooCommerceConnection();
        if (testConn.success) {
          console.log('[API /api/sample-data] Forced live sync triggered: Querying live WooCommerce API...');
          const rawWcOrders = await fetchWooCommerceOrders({
            perPage: 100,
            status: 'any',
            orderBy: 'date',
            order: 'desc',
            fetchAllPages: true,
            maxPages: 6,
          });

          if (rawWcOrders && rawWcOrders.length > 0) {
            const freshRows = formatWooCommerceToOrderRows(rawWcOrders);
            const baseline = getBaselineDataset();

            // Non-destructively upsert fresh rows into master baseline
            const orderMap = new Map<string, RawOrderRow[]>();
            for (const r of baseline.orders || []) {
              const oid = String(r['Order ID'] || r.orderId || r.orderNumber || '');
              if (!oid) continue;
              if (!orderMap.has(oid)) orderMap.set(oid, []);
              orderMap.get(oid)!.push(r);
            }

            const freshMap = new Map<string, RawOrderRow[]>();
            for (const r of freshRows) {
              const oid = String(r['Order ID'] || r.orderId || r.orderNumber || '');
              if (!oid) continue;
              if (!freshMap.has(oid)) freshMap.set(oid, []);
              freshMap.get(oid)!.push(r);
            }

            // Fresh incoming orders overwrite existing matching IDs
            for (const [oid, rows] of freshMap.entries()) {
              orderMap.set(oid, rows);
            }

            const mergedOrders: RawOrderRow[] = [];
            for (const rows of orderMap.values()) {
              mergedOrders.push(...rows);
            }

            // Update in-memory baseline
            baseline.orders = mergedOrders;
            baseline.syncedAt = new Date().toISOString();
            (baseline as any).updatedAt = new Date().toISOString();
            baseline.sourceName = `⚡ Live WooCommerce Master (${mergedOrders.length.toLocaleString()} items · Refreshed ${new Date().toLocaleDateString('en-GB')})`;

            // Option C Auto-Refresh: Write back to src/data/baselineSample.json if writable
            try {
              const localPath = path.join(process.cwd(), 'src', 'data', 'baselineSample.json');
              if (fs.existsSync(path.dirname(localPath))) {
                fs.writeFileSync(localPath, JSON.stringify(baseline, null, 2), 'utf8');
                console.log(`[API /api/sample-data] Option C: Persisted ${mergedOrders.length} orders directly to ${localPath}`);
              }
            } catch (fsErr) {
              console.warn('[API /api/sample-data] Notice: Local disk write skipped (serverless environment):', fsErr);
            }

            // Clear in-memory cache
            clearSampleDataMemoryCache();

            let sanitizedOrders = isPrivileged ? mergedOrders : sanitizeOrdersResponse(mergedOrders);
            let sanitizedReturns = isPrivileged ? (baseline.returns || []) : sanitizeOrdersResponse(baseline.returns || []);
            let sanitizedPartials = isPrivileged ? (baseline.partials || []) : sanitizeOrdersResponse(baseline.partials || []);
            let sanitizedExchanges = isPrivileged ? (baseline.exchanges || []) : sanitizeOrdersResponse(baseline.exchanges || []);
            let sanitizedPathao = isPrivileged ? (baseline.pathaoDelivery || []) : sanitizeOrdersResponse(baseline.pathaoDelivery || []);

            if (auth.sampleRate && auth.sampleRate < 1) {
              const sampled = sampleDatasetSnapshot({
                orders: sanitizedOrders,
                returns: sanitizedReturns,
                partials: sanitizedPartials,
                exchanges: sanitizedExchanges,
                pathaoDelivery: sanitizedPathao,
              }, auth.sampleRate);
              sanitizedOrders = sampled.orders;
              sanitizedReturns = sampled.returns;
              sanitizedPartials = sampled.partials;
              sanitizedExchanges = sampled.exchanges;
              sanitizedPathao = sampled.pathaoDelivery || [];
            }

            const provenance = createDataProvenance('live_api', rawWcOrders.length, !isPrivileged);
            const livePayload = {
              success: true,
              source: 'live_woocommerce_forced',
              ordersPath: 'WooCommerce REST API (Live Force Sync)',
              returnsPath: 'baselineSample.json (Historical)',
              partialsPath: 'baselineSample.json (Historical)',
              exchangesPath: 'baselineSample.json (Historical)',
              pathaoDeliveryPath: 'baselineSample.json (Historical)',
              ordersCount: sanitizedOrders.length,
              returnsCount: sanitizedReturns.length,
              partialsCount: sanitizedPartials.length,
              exchangesCount: sanitizedExchanges.length,
              pathaoDeliveryCount: sanitizedPathao.length,
              provenance,
              orders: sanitizedOrders,
              returns: sanitizedReturns,
              partials: sanitizedPartials,
              exchanges: sanitizedExchanges,
              pathaoDelivery: sanitizedPathao,
            };

            const sampleKey = auth.sampleRate ? String(auth.sampleRate) : '1';
            const liveEtag = `W/"live-${Date.now()}-${sampleKey}-${isPrivileged ? 'priv' : 'mask'}"`;
            return jsonWithEdgeCache(livePayload, 'STATIC_DATASET', { req, etag: liveEtag, isPrivate: false });
          }
        }
      } catch (liveErr) {
        console.warn('[API /api/sample-data] Forced live sync error, falling back to local baseline:', liveErr);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // OPTION C: LOCAL UNIFIED BASELINE (0ms High-Performance Master Ledger)
    // ─────────────────────────────────────────────────────────────────────────────
    // Fast path: if unprivileged fallback was already parsed & sanitized in this compute instance, serve immediately
    if (!isPrivileged && (!auth.sampleRate || auth.sampleRate === 1) && cachedMaskedFallback) {
      if (isClientFresh(req, cachedMaskedFallback.etag)) {
        return createNotModifiedResponse(cachedMaskedFallback.etag, 'STATIC_DATASET');
      }
      return jsonWithEdgeCache(cachedMaskedFallback.payload, 'STATIC_DATASET', {
        req,
        etag: cachedMaskedFallback.etag,
        isPrivate: false,
      });
    }

    const cwd = process.cwd();

    const orderCandidates = [
      path.join(cwd, 'Sample Docs', 'DEEN Multi-Month Master Orders (Sept-Oct-Nov).xlsx'),
      path.join(cwd, 'DEEN Multi-Month Master Orders (Sept-Oct-Nov).xlsx'),
      path.join(cwd, 'Sample Docs', 'November 2026 Checkout Orders List.xlsx'),
      path.join(cwd, 'Sample Docs', 'Nov', 'November 2026 Checkout Orders List.xlsx'),
      path.join(cwd, 'Sample Docs', 'October 2026 Checkout Orders List.xlsx'),
      path.join(cwd, 'October 2026 Checkout Orders List.xlsx'),
      path.join(cwd, 'Sample Docs', '7-30 Sept.xlsx'),
      path.join(cwd, '7-30 Sept.xlsx'),
    ];

    const returnCandidates = [
      path.join(cwd, 'Sample Docs', 'returen.xlsx'),
      path.join(cwd, 'returen.xlsx'),
      path.join(cwd, 'Sample Docs', 'Returned - 1-30 Sept.xlsx'),
      path.join(cwd, 'Returned - 1-30 Sept.xlsx')
    ];

    const partialCandidates = [
      path.join(cwd, 'Sample Docs', 'Partial Orders.xlsx'),
      path.join(cwd, 'Partial Orders.xlsx')
    ];

    const exchangeCandidates = [
      path.join(cwd, 'Sample Docs', 'Exchanged.xlsx'),
      path.join(cwd, 'Exchanged.xlsx')
    ];

    const pathaoCandidates = [
      path.join(cwd, 'Sample Docs', 'Pataho sample delivey data.csv'),
      path.join(cwd, 'Pataho sample delivey data.csv'),
      path.join(cwd, 'Sample Docs', 'Pathao sample delivery data.csv')
    ];

    const ordersPath = findFirstExistingFile(orderCandidates);
    const returnsPath = findFirstExistingFile(returnCandidates);
    const partialsPath = findFirstExistingFile(partialCandidates);
    const exchangesPath = findFirstExistingFile(exchangeCandidates);
    const pathaoPath = findFirstExistingFile(pathaoCandidates);

    let orders = ordersPath ? parseExcelFile(ordersPath) : [];
    let returns = returnsPath ? parseExcelFile(returnsPath) : [];
    let partials = partialsPath ? parseExcelFile(partialsPath) : [];
    let exchanges = exchangesPath ? parseExcelFile(exchangesPath) : [];
    let pathaoDelivery = pathaoPath ? parseExcelFile(pathaoPath) : [];

    // TIER 3 FALLBACK: Unified Precompiled Baseline JSON in Repository (Option C Primary)
    const fallback = (getBaselineDataset() || {}) as {
      orders?: RawOrderRow[];
      returns?: RawOrderRow[];
      partials?: RawOrderRow[];
      exchanges?: RawOrderRow[];
      pathaoDelivery?: RawOrderRow[];
    };

    const ordersFromFallback = orders.length === 0;
    const returnsFromFallback = returns.length === 0;
    const partialsFromFallback = partials.length === 0;
    const exchangesFromFallback = exchanges.length === 0;
    const pathaoFromFallback = pathaoDelivery.length === 0;

    if (ordersFromFallback || (fallback.orders && fallback.orders.length > orders.length)) {
      orders = fallback.orders || orders;
    }
    if (returnsFromFallback) returns = fallback.returns || [];
    if (partialsFromFallback) partials = fallback.partials || [];
    if (exchangesFromFallback) exchanges = fallback.exchanges || [];
    if (pathaoFromFallback) pathaoDelivery = fallback.pathaoDelivery || [];

    const isAnyFallbackUsed = ordersFromFallback || returnsFromFallback || partialsFromFallback || exchangesFromFallback || pathaoFromFallback;
    console.log(`[API /api/sample-data] Loaded ${orders.length} orders, ${returns.length} returns, ${partials.length} partials, ${exchanges.length} exchanges, ${pathaoDelivery.length} pathao records (Any Fallback: ${isAnyFallbackUsed})`);

    // PII Sanitization across all exported sample records
    let sanitizedOrders = isPrivileged ? orders : sanitizeOrdersResponse(orders);
    let sanitizedReturns = isPrivileged ? returns : sanitizeOrdersResponse(returns);
    let sanitizedPartials = isPrivileged ? partials : sanitizeOrdersResponse(partials);
    let sanitizedExchanges = isPrivileged ? exchanges : sanitizeOrdersResponse(exchanges);
    let sanitizedPathao = isPrivileged ? pathaoDelivery : sanitizeOrdersResponse(pathaoDelivery);

    if (auth.sampleRate && auth.sampleRate < 1) {
      const sampled = sampleDatasetSnapshot({
        orders: sanitizedOrders,
        returns: sanitizedReturns,
        partials: sanitizedPartials,
        exchanges: sanitizedExchanges,
        pathaoDelivery: sanitizedPathao,
      }, auth.sampleRate);
      sanitizedOrders = sampled.orders;
      sanitizedReturns = sampled.returns;
      sanitizedPartials = sampled.partials;
      sanitizedExchanges = sampled.exchanges;
      sanitizedPathao = sampled.pathaoDelivery || [];
    }

    const provenance = createDataProvenance(
      isAnyFallbackUsed ? 'baseline_bundled' : 'disk_spreadsheet',
      sanitizedOrders.length,
      true
    );

    const fallbackPayload = {
      success: true,
      source: isAnyFallbackUsed ? 'baseline_bundled' : 'disk_spreadsheet',
      ordersPath: ordersPath ? path.basename(ordersPath) : (ordersFromFallback ? 'baselineSample.json (Bundled)' : null),
      returnsPath: returnsPath ? path.basename(returnsPath) : (returnsFromFallback ? 'baselineSample.json (Bundled)' : null),
      partialsPath: partialsPath ? path.basename(partialsPath) : (partialsFromFallback ? 'baselineSample.json (Bundled)' : null),
      exchangesPath: exchangesPath ? path.basename(exchangesPath) : (exchangesFromFallback ? 'baselineSample.json (Bundled)' : null),
      pathaoDeliveryPath: pathaoPath ? path.basename(pathaoPath) : (pathaoFromFallback ? 'baselineSample.json (Bundled)' : null),
      ordersCount: sanitizedOrders.length,
      returnsCount: sanitizedReturns.length,
      partialsCount: sanitizedPartials.length,
      exchangesCount: sanitizedExchanges.length,
      pathaoDeliveryCount: sanitizedPathao.length,
      provenance,
      orders: sanitizedOrders,
      returns: sanitizedReturns,
      partials: sanitizedPartials,
      exchanges: sanitizedExchanges,
      pathaoDelivery: sanitizedPathao,
    };

    const sampleKey = auth.sampleRate ? String(auth.sampleRate) : '1';
    const fallbackEtag = `W/"baseline-${sanitizedOrders.length}-${sampleKey}-${isPrivileged ? 'priv' : 'mask'}"`;

    if (!isPrivileged && (!auth.sampleRate || auth.sampleRate === 1)) {
      cachedMaskedFallback = {
        payload: fallbackPayload,
        etag: fallbackEtag,
      };
    }

    return jsonWithEdgeCache(fallbackPayload, 'STATIC_DATASET', { req, etag: fallbackEtag, isPrivate: false });
  } catch (error: unknown) {
    console.error('Error reading sample data:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to load sample dataset';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}

/**
 * Save Endpoint:
 * Allows persisting the active working dataset directly to src/data/baselineSample.json when running locally.
 */
export async function POST(req: Request) {
  const auth = validateApiRequest(req, { requiredRole: 'operator', allowDemo: false });
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, message: auth.message || 'Unauthorized' }, { status: auth.statusCode });
  }

  try {
    const body: Partial<DatasetSnapshot> = await req.json().catch(() => ({}));
    const targetPath = path.join(process.cwd(), 'src', 'data', 'baselineSample.json');

    // Test if file is writable (e.g. running locally in Node vs read-only environment)
    let isWritable = false;
    try {
      if (typeof fs !== 'undefined' && fs.existsSync && fs.existsSync(path.dirname(targetPath))) {
        fs.accessSync(path.dirname(targetPath), fs.constants.W_OK);
        isWritable = true;
      }
    } catch {
      isWritable = false;
    }

    if (!isWritable) {
      return NextResponse.json({
        success: false,
        isReadOnly: true,
        message: 'The server filesystem is read-only in this environment. Please download the dataset JSON locally or sync via Cloud Sync.',
      });
    }

    const payload = {
      orders: sanitizeOrdersResponse(body.orders || []),
      pathaoDelivery: sanitizeOrdersResponse(body.pathaoDelivery || []),
      returns: sanitizeOrdersResponse(body.returns || []),
      partials: sanitizeOrdersResponse(body.partials || []),
      exchanges: sanitizeOrdersResponse(body.exchanges || []),
      updatedAt: new Date().toISOString(),
      sourceName: body.sourceName || 'Updated Baseline Dataset',
    };

    fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');
    clearSampleDataMemoryCache();

    return NextResponse.json({
      success: true,
      isReadOnly: false,
      message: `Successfully saved ${payload.orders.length} orders & ${payload.returns.length} returns to src/data/baselineSample.json. Commit to Git to deploy on Vercel.`,
      ordersCount: payload.orders.length,
      returnsCount: payload.returns.length,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to write baseline file';
    return NextResponse.json({
      success: false,
      error: errorMsg,
    }, { status: 500 });
  }
}
