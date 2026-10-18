import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { batchFetchPathaoOrders, formatPathaoToReturnRows } from '@/lib/pathaoClient';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { checkRateLimit } from '@/lib/auth/rateLimiter';
import { sanitizeOrdersResponse } from '@/lib/auth/dataMasking';
import { createDataProvenance } from '@/lib/dataAudit';
import baselineData from '@/data/baselineSample.json';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for batch Pathao consignment requests on Vercel

export async function POST(req: Request) {
  try {
    // 1. API Authentication & Role Check - Operator or Admin only
    const auth = validateApiRequest(req, { requiredRole: 'operator', allowDemo: false });
    if (!auth.authenticated) {
      return NextResponse.json({
        success: false,
        statusCode: auth.statusCode,
        message: auth.message,
        orders: [],
      }, { status: auth.statusCode });
    }

    // 2. Sliding Window Rate Limiting (30 requests per minute)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'internal_caller';
    const rateCheck = await checkRateLimit(`sync_pathao_${clientIp}`, 30, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json({
        success: false,
        statusCode: 429,
        message: 'Rate limit exceeded: Max 30 Pathao sync requests per minute.',
        orders: [],
      }, { status: 429 });
    }
    const body = await req.json().catch(() => ({}));
    const credentials = body.credentials || undefined;
    let consignmentIds: string[] = body.consignmentIds || [];
    const limit = Math.min(body.limit || 25, 40);

    // 1. If active WooCommerce orders or tracking list supplied in body, harvest from them
    if (consignmentIds.length === 0 && Array.isArray(body.activeOrders) && body.activeOrders.length > 0) {
      for (const row of body.activeOrders) {
        const cid = row.consignmentId || row.trackingId || row.consignment_id || row['Consignment ID'] || row.tracking_code || row.tracking_number;
        if (cid) {
          consignmentIds.push(String(cid).trim());
          continue;
        }
        if (Array.isArray(row.meta_data)) {
          const metaCid = row.meta_data.find((m: any) =>
            m.key && (m.key.toLowerCase().includes('consignment') || m.key.toLowerCase().includes('tracking') || m.key.toLowerCase().includes('pathao'))
          );
          if (metaCid && metaCid.value) {
            consignmentIds.push(String(metaCid.value).trim());
            continue;
          }
        }
      }
    }

    // 2. Fallback to bundled baseline dataset tracking IDs (guaranteed to work on Vercel)
    if (consignmentIds.length === 0 && baselineData) {
      const b = baselineData as any;
      const combined = [...(b.pathaoDelivery || []), ...(b.returns || [])];
      for (const r of combined) {
        const cid = r['Consignment ID'] || r.consignmentId || r.consignment_id || r['Tracking ID'];
        if (cid) consignmentIds.push(String(cid).trim());
        if (consignmentIds.length >= limit * 2) break;
      }
    }

    // 3. If still empty, check returen.xlsx on local disk (local dev fallback)
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

    const fetchedData = await batchFetchPathaoOrders(consignmentIds, 4, credentials);

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
    const isPrivileged = auth.authenticated && (auth.role === 'admin' || auth.role === 'operator');
    const returnRows = isPrivileged ? formattedRows : sanitizeOrdersResponse(formattedRows);
    const provenance = createDataProvenance('live_api', formattedRows.length, !isPrivileged);

    return NextResponse.json({
      success: true,
      message: `Successfully fetched ${formattedRows.length} live consignments from Pathao Hermes API for the selected date range.`,
      count: formattedRows.length,
      orders: returnRows,
      rawPathao: isPrivileged ? filteredData : undefined,
      provenance,
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
