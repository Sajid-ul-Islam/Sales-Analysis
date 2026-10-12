import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { batchFetchPathaoOrders, formatPathaoToReturnRows } from '@/lib/pathaoClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for batch Pathao consignment requests on Vercel

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let consignmentIds: string[] = body.consignmentIds || [];
    const limit = body.limit || 20;

    // If no consignment IDs provided, extract from returen.xlsx (local development fallback)
    if (consignmentIds.length === 0) {
      try {
        const returnsPath = path.join(process.cwd(), 'returen.xlsx');
        if (typeof fs !== 'undefined' && fs.existsSync && fs.existsSync(returnsPath)) {
          const buf = fs.readFileSync(returnsPath);
          const wb = XLSX.read(buf, { type: 'buffer' });
          const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
          for (const r of rows) {
            const keys = Object.keys(r);
            const k = keys.find(key => key.toLowerCase().includes('consignment') || key.toLowerCase().includes('tracking'));
            if (k && r[k]) {
              consignmentIds.push(String(r[k]).trim());
            }
          }
        }
      } catch (err) {
        console.warn('Local fallback file returen.xlsx read skipped:', err);
      }
    }

    // Deduplicate and limit
    consignmentIds = Array.from(new Set(consignmentIds)).slice(0, limit);

    if (consignmentIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No consignment IDs available to sync with Pathao. Please provide consignment IDs or upload a Pathao courier sheet.',
        orders: [],
      });
    }

    const fetchedData = await batchFetchPathaoOrders(consignmentIds, 5);

    let filteredData = fetchedData;
    if (body.startDate || body.endDate) {
      const startTs = body.startDate ? new Date(body.startDate).getTime() : 0;
      const endTs = body.endDate ? new Date(body.endDate).getTime() + 86400000 : Infinity;
      filteredData = fetchedData.filter(o => {
        const rawDate = o.order_created_at || o.order_status_updated_at;
        if (!rawDate) return true;
        const t = new Date(rawDate).getTime();
        return isNaN(t) || (t >= startTs && t <= endTs);
      });
    }

    const formattedRows = formatPathaoToReturnRows(filteredData);

    return NextResponse.json({
      success: true,
      message: `Successfully fetched ${formattedRows.length} live consignments from Pathao Hermes API for the selected date range.`,
      count: formattedRows.length,
      orders: formattedRows,
      rawPathao: filteredData,
    });
  } catch (error: any) {
    console.error('Pathao sync error:', error);
    return NextResponse.json({
      success: false,
      message: error?.message || 'Failed to sync with Pathao',
      error: error?.message || 'Failed to sync with Pathao'
    });
  }
}
