import { NextResponse } from 'next/server';
import path from 'path';
import * as XLSX from 'xlsx';
import fs from 'fs';
import { sanitizeOrdersResponse } from '@/lib/auth/dataMasking';
import { createDataProvenance } from '@/lib/dataAudit';
import baselineData from '@/data/baselineSample.json';

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

export async function GET() {
  try {
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

    // Vercel / Cloud Resilient Fallback:
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
    const sanitizedOrders = sanitizeOrdersResponse(orders);
    const sanitizedReturns = sanitizeOrdersResponse(returns);
    const sanitizedPartials = sanitizeOrdersResponse(partials);
    const sanitizedExchanges = sanitizeOrdersResponse(exchanges);
    const sanitizedPathao = sanitizeOrdersResponse(pathaoDelivery);

    const provenance = createDataProvenance(
      isAnyFallbackUsed ? 'baseline_bundled' : 'disk_spreadsheet',
      sanitizedOrders.length,
      true
    );

    return NextResponse.json({
      success: true,
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
