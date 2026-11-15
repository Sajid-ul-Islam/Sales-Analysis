import { NextRequest, NextResponse } from 'next/server';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import {
  writeParquetPartitionFile,
  readParquetPartitionFile,
  getParquetPartitionStats,
} from '@/lib/server/parquetWriter';
import { RawOrderRow } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest | Request) {
  const auth = validateApiRequest(req, { requiredRole: 'readonly', allowDemo: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month');
  if (!month || !/^\d{4}[-_]\d{1,2}$/.test(month)) {
    return NextResponse.json({ error: 'Valid month query (YYYY-MM) is required' }, { status: 400 });
  }

  const normalizedMonth = month.replace('_', '-');
  const stats = await getParquetPartitionStats(normalizedMonth);
  if (!stats.exists) {
    return NextResponse.json(
      { error: `Partition for month ${normalizedMonth} not found on server` },
      { status: 404 }
    );
  }

  const ifNoneMatch = req.headers.get('if-none-match');
  if (ifNoneMatch && ifNoneMatch === stats.etag) {
    return new NextResponse(null, { status: 304 });
  }

  const buffer = await readParquetPartitionFile(normalizedMonth);
  if (!buffer) {
    return NextResponse.json({ error: 'Failed to read partition file' }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apache.parquet',
      'Content-Length': String(buffer.length),
      'Accept-Ranges': 'bytes',
      'ETag': stats.etag,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}

export async function POST(req: NextRequest | Request) {
  const auth = validateApiRequest(req, { requiredRole: 'readonly', allowDemo: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized to write partitions' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.month || !Array.isArray(body.orders)) {
    return NextResponse.json({ error: 'Body must include "month" and "orders" array' }, { status: 400 });
  }

  const normalizedMonth = String(body.month).replace('_', '-');
  const orders = body.orders as RawOrderRow[];

  try {
    const result = await writeParquetPartitionFile(normalizedMonth, orders);
    return NextResponse.json({
      success: true,
      month: normalizedMonth,
      byteSize: result.byteSize,
      orderCount: result.orderCount,
      etag: result.etag,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to write Parquet partition: ${msg}` }, { status: 500 });
  }
}
