import { NextResponse } from 'next/server';
import path from 'path';
import * as XLSX from 'xlsx';
import fs from 'fs';

function findFirstExistingFile(candidatePaths: string[]): string | null {
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function parseExcelFile(filePath: string): any[] {
  try {
    const buf = fs.readFileSync(filePath);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
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

    const orders = ordersPath ? parseExcelFile(ordersPath) : [];
    const returns = returnsPath ? parseExcelFile(returnsPath) : [];
    const partials = partialsPath ? parseExcelFile(partialsPath) : [];
    const exchanges = exchangesPath ? parseExcelFile(exchangesPath) : [];
    const pathaoDelivery = pathaoPath ? parseExcelFile(pathaoPath) : [];

    console.log(`[API /api/sample-data] Loaded ${orders.length} orders, ${returns.length} returns, ${partials.length} partials, ${exchanges.length} exchanges, ${pathaoDelivery.length} pathao records`);

    return NextResponse.json({
      success: true,
      ordersPath: ordersPath ? path.basename(ordersPath) : null,
      returnsPath: returnsPath ? path.basename(returnsPath) : null,
      partialsPath: partialsPath ? path.basename(partialsPath) : null,
      exchangesPath: exchangesPath ? path.basename(exchangesPath) : null,
      pathaoDeliveryPath: pathaoPath ? path.basename(pathaoPath) : null,
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
