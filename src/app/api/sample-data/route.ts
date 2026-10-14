import { NextResponse } from 'next/server';
import path from 'path';
import * as XLSX from 'xlsx';
import fs from 'fs';
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
    // If files are absent on disk (e.g. Vercel serverless environment where Sample Docs is gitignored),
    // fallback directly to the bundled, precompiled baseline dataset to guarantee 100% data availability.
    const fallback = (baselineData || {}) as {
      orders?: any[];
      returns?: any[];
      partials?: any[];
      exchanges?: any[];
      pathaoDelivery?: any[];
    };

    const isFallbackUsed = orders.length === 0;
    if (isFallbackUsed) {
      orders = fallback.orders || [];
      returns = fallback.returns || [];
      partials = fallback.partials || [];
      exchanges = fallback.exchanges || [];
      pathaoDelivery = fallback.pathaoDelivery || [];
    }

    console.log(`[API /api/sample-data] Loaded ${orders.length} orders, ${returns.length} returns, ${partials.length} partials, ${exchanges.length} exchanges, ${pathaoDelivery.length} pathao records (Fallback: ${isFallbackUsed})`);

    return NextResponse.json({
      success: true,
      ordersPath: ordersPath ? path.basename(ordersPath) : (isFallbackUsed ? 'baselineSample.json (Bundled)' : null),
      returnsPath: returnsPath ? path.basename(returnsPath) : (isFallbackUsed ? 'baselineSample.json (Bundled)' : null),
      partialsPath: partialsPath ? path.basename(partialsPath) : (isFallbackUsed ? 'baselineSample.json (Bundled)' : null),
      exchangesPath: exchangesPath ? path.basename(exchangesPath) : (isFallbackUsed ? 'baselineSample.json (Bundled)' : null),
      pathaoDeliveryPath: pathaoPath ? path.basename(pathaoPath) : (isFallbackUsed ? 'baselineSample.json (Bundled)' : null),
      ordersCount: orders.length,
      returnsCount: returns.length,
      partialsCount: partials.length,
      exchangesCount: exchanges.length,
      pathaoDeliveryCount: pathaoDelivery.length,
      orders,
      returns,
      partials,
      exchanges,
      pathaoDelivery
    });
  } catch (error: any) {
    console.error('Error reading sample data:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to load sample dataset' },
      { status: 500 }
    );
  }
}
