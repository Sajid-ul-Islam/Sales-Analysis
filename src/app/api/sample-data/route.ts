import { NextResponse } from 'next/server';
import path from 'path';
import * as XLSX from 'xlsx';
import fs from 'fs';
import { sanitizeOrdersResponse } from '@/lib/auth/dataMasking';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { createDataProvenance } from '@/lib/dataAudit';
import baselineData from '@/data/baselineSample.json';
import { fetchDatasetFromBlob, isBlobConfigured } from '@/lib/blobStorage';
import { DatasetSnapshot } from '@/types';

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

function parseExcelFile(filePath: string): any[] {
  try {
    if (!filePath || typeof fs === 'undefined' || !fs.existsSync || !fs.existsSync(filePath)) {
      return [];
    }
    const buf = fs.readFileSync(filePath);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName || !wb.Sheets[sheetName]) return [];
    return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  } catch (err) {
    console.warn(`[API /api/sample-data] Non-fatal notice reading ${filePath}:`, err);
    return [];
  }
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const auth = validateApiRequest(req, { requiredRole: 'operator', allowDemo: true });
    const isPrivileged = auth.authenticated && (auth.role === 'admin' || auth.role === 'operator' || auth.role === 'demo');

    // 1. TIER 1 CLOUD CHECK: Vercel Blob Storage (Method 3)
    // If BLOB_READ_WRITE_TOKEN is configured and a cloud dataset snapshot exists, serve it with 0ms delay!
    if (isBlobConfigured()) {
      try {
        const blobResult = await fetchDatasetFromBlob();
        if (blobResult.success && blobResult.dataset && (blobResult.dataset.orders?.length || 0) > 0) {
          const ds = blobResult.dataset;
          const sanitizedOrders = isPrivileged ? ds.orders : sanitizeOrdersResponse(ds.orders || []);
          const sanitizedReturns = isPrivileged ? ds.returns : sanitizeOrdersResponse(ds.returns || []);
          const sanitizedPartials = isPrivileged ? ds.partials : sanitizeOrdersResponse(ds.partials || []);
          const sanitizedExchanges = isPrivileged ? ds.exchanges : sanitizeOrdersResponse(ds.exchanges || []);
          const sanitizedPathao = isPrivileged ? ds.pathaoDelivery : sanitizeOrdersResponse(ds.pathaoDelivery || []);

          const provenance = createDataProvenance('vercel_blob', sanitizedOrders.length, true);

          return NextResponse.json({
            success: true,
            source: 'vercel_blob',
            blobUrl: blobResult.url,
            ordersPath: 'deen_dataset_latest.json (Vercel Blob)',
            returnsPath: 'deen_dataset_latest.json (Vercel Blob)',
            partialsPath: 'deen_dataset_latest.json (Vercel Blob)',
            exchangesPath: 'deen_dataset_latest.json (Vercel Blob)',
            pathaoDeliveryPath: 'deen_dataset_latest.json (Vercel Blob)',
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
          });
        }
      } catch (blobErr) {
        console.warn('[API /api/sample-data] Non-fatal notice querying Vercel Blob:', blobErr);
      }
    }

    // 2. TIER 2 LOCAL CHECK: Local Excel Spreadsheets on disk (Method 1 Local Dev)
    const cwd = process.cwd();

    const orderCandidates = [
      path.join(cwd, 'Sample Docs', '7-30 Sept.xlsx'),
      path.join(cwd, '7-30 Sept.xlsx'),
      path.join(cwd, 'Sample Docs', 'Merged - 27 Aug - 30 Sept.xlsx'),
      path.join(cwd, 'Merged - 27 Aug - 30 Sept.xlsx'),
      path.join(cwd, 'Sample Docs', 'September Online Orders - 1-30 Sept.xlsx')
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

    // 3. TIER 3 ZERO-500 FALLBACK: Bundled Static JSON in Repository (Method 1 Production)
    // If individual files are absent on disk (e.g. Vercel serverless environment where Sample Docs is gitignored),
    // fallback directly to the bundled, precompiled baseline dataset to guarantee 100% data availability.
    const fallback = (baselineData || {}) as {
      orders?: any[];
      returns?: any[];
      partials?: any[];
      exchanges?: any[];
      pathaoDelivery?: any[];
    };

    const ordersFromFallback = orders.length === 0;
    const returnsFromFallback = returns.length === 0;
    const partialsFromFallback = partials.length === 0;
    const exchangesFromFallback = exchanges.length === 0;
    const pathaoFromFallback = pathaoDelivery.length === 0;

    if (ordersFromFallback) orders = fallback.orders || [];
    if (returnsFromFallback) returns = fallback.returns || [];
    if (partialsFromFallback) partials = fallback.partials || [];
    if (exchangesFromFallback) exchanges = fallback.exchanges || [];
    if (pathaoFromFallback) pathaoDelivery = fallback.pathaoDelivery || [];

    const isAnyFallbackUsed = ordersFromFallback || returnsFromFallback || partialsFromFallback || exchangesFromFallback || pathaoFromFallback;
    console.log(`[API /api/sample-data] Loaded ${orders.length} orders, ${returns.length} returns, ${partials.length} partials, ${exchanges.length} exchanges, ${pathaoDelivery.length} pathao records (Any Fallback: ${isAnyFallbackUsed})`);

    // PII Sanitization across all exported sample records
    const sanitizedOrders = isPrivileged ? orders : sanitizeOrdersResponse(orders);
    const sanitizedReturns = isPrivileged ? returns : sanitizeOrdersResponse(returns);
    const sanitizedPartials = isPrivileged ? partials : sanitizeOrdersResponse(partials);
    const sanitizedExchanges = isPrivileged ? exchanges : sanitizeOrdersResponse(exchanges);
    const sanitizedPathao = isPrivileged ? pathaoDelivery : sanitizeOrdersResponse(pathaoDelivery);

    const provenance = createDataProvenance(
      isAnyFallbackUsed ? 'baseline_bundled' : 'disk_spreadsheet',
      sanitizedOrders.length,
      true
    );

    return NextResponse.json({
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
      pathaoDelivery: sanitizedPathao
    });
  } catch (error: any) {
    console.error('Error reading sample data:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to load sample dataset' },
      { status: 500 }
    );
  }
}

/**
 * Method 1 Save Endpoint:
 * Allows persisting the active working dataset directly to src/data/baselineSample.json when running locally.
 */
export async function POST(req: Request) {
  try {
    const body: Partial<DatasetSnapshot> = await req.json().catch(() => ({}));
    const targetPath = path.join(process.cwd(), 'src', 'data', 'baselineSample.json');

    // Test if file is writable (e.g. running locally in Node vs Vercel serverless)
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
        message: 'The server filesystem is read-only in this environment (e.g. Vercel Serverless). Please use Vercel Blob (Method 3) or download the JSON locally.',
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

    return NextResponse.json({
      success: true,
      isReadOnly: false,
      message: `Successfully saved ${payload.orders.length} orders & ${payload.returns.length} returns to src/data/baselineSample.json. Commit to Git to deploy on Vercel.`,
      ordersCount: payload.orders.length,
      returnsCount: payload.returns.length,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || 'Failed to write baseline file',
    }, { status: 500 });
  }
}
