import { NextRequest, NextResponse } from 'next/server';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { ordersToParquetBuffer } from '@/lib/server/parquetWriter';
import { RawOrderRow } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest | Request) {
  const auth = validateApiRequest(req, { requiredRole: 'readonly', allowDemo: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.orders)) {
    return NextResponse.json({ error: 'Body must include "orders" array' }, { status: 400 });
  }

  const orders = body.orders as RawOrderRow[];
  const rawFilename = String(body.filename || 'deen_orders_export.parquet').trim();
  const safeFilename = rawFilename.endsWith('.parquet') ? rawFilename : `${rawFilename}.parquet`;

  try {
    const buffer = await ordersToParquetBuffer(orders);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apache.parquet',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to export Parquet file: ${msg}` }, { status: 500 });
  }
}
