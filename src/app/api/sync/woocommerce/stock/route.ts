import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { checkRateLimit } from '@/lib/auth/rateLimiter';
import { getSecretsWithOverrides } from '@/lib/secrets';
import { LocationStockBreakdown } from '@/lib/inventoryEngine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export interface WcStockData {
  syncedAt: string;
  totalProducts: number;
  totalSkus: number;
  stockBySku: Record<string, LocationStockBreakdown>;
}

let memoryStockCache: WcStockData | null = null;
let lastCacheRead = 0;

function getCachedStockData(): WcStockData | null {
  const now = Date.now();
  if (memoryStockCache && now - lastCacheRead < 60000) {
    return memoryStockCache;
  }

  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'wc-sku-stock.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      memoryStockCache = JSON.parse(raw) as WcStockData;
      lastCacheRead = now;
      return memoryStockCache;
    }
  } catch {
    // Disk read fallback
  }

  return memoryStockCache;
}

function persistStockData(data: WcStockData): void {
  memoryStockCache = data;
  lastCacheRead = Date.now();
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'wc-sku-stock.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Failed to persist wc-sku-stock.json to disk:', msg);
  }
}

/**
 * GET /api/sync/woocommerce/stock
 * Returns the current cached product stock breakdown across locations.
 */
export async function GET(req: Request) {
  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'internal_caller';
    const rateCheck = await checkRateLimit(`stock_get_${clientIp}`, 60, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, statusCode: 429, message: 'Rate limit exceeded.' },
        { status: 429 }
      );
    }

    const cached = getCachedStockData();
    if (!cached) {
      return NextResponse.json(
        {
          success: true,
          statusCode: 200,
          data: {
            syncedAt: new Date().toISOString(),
            totalProducts: 0,
            totalSkus: 0,
            stockBySku: {},
          },
          isDefault: true,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      statusCode: 200,
      data: cached,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error while fetching stock data.';
    return NextResponse.json(
      { success: false, statusCode: 500, message: msg },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync/woocommerce/stock
 * Synchronizes stock counts from WooCommerce REST API across catalog products & variations.
 */
export async function POST(req: Request) {
  try {
    const auth = validateApiRequest(req, { requiredRole: 'operator', allowDemo: true });
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, statusCode: auth.statusCode, message: auth.message },
        { status: auth.statusCode }
      );
    }

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'internal_caller';
    const rateCheck = await checkRateLimit(`stock_sync_${clientIp}`, 5, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, statusCode: 429, message: 'Rate limit exceeded: Max 5 syncs per minute.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { woocommerce: wc } = getSecretsWithOverrides({ woocommerce: body.credentials });

    if (!wc.store_url || !wc.consumer_key || !wc.consumer_secret) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 400,
          message: 'WooCommerce credentials not configured in settings or environment variables.',
        },
        { status: 400 }
      );
    }

    const cleanStoreUrl = wc.store_url.replace(/\/+$/, '');
    const authHeader = 'Basic ' + Buffer.from(`${wc.consumer_key}:${wc.consumer_secret}`).toString('base64');
    const maxPages = typeof body.maxPages === 'number' ? body.maxPages : 8;

    const stockBySku: Record<string, LocationStockBreakdown> = {};
    let totalProductsFetched = 0;

    for (let page = 1; page <= maxPages; page++) {
      const url = `${cleanStoreUrl}/wp-json/wc/v3/products?per_page=100&page=${page}&_fields=id,name,type,sku,stock_quantity,stock_status,meta_data`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Authorization': authHeader,
          'User-Agent': 'DEEN-Inventory-Sync/2.0',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) break;
      const batch = await res.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      totalProductsFetched += batch.length;

      for (const p of batch) {
        const sku = String(p.sku || '').trim();
        const totalQty = typeof p.stock_quantity === 'number' ? p.stock_quantity : (p.stock_status === 'instock' ? 15 : 0);

        if (sku) {
          // Check for outlet specific SIP meta
          let mirpurStock = 0;
          let cumillaStock = 0;
          let wariStock = 0;
          let sylhetStock = 0;

          if (Array.isArray(p.meta_data)) {
            for (const m of p.meta_data) {
              const k = String(m.key || '').toLowerCase();
              const v = Number(m.value) || 0;
              if (k.includes('mirpur') || k.includes('outlet_2')) mirpurStock = v;
              if (k.includes('cumilla') || k.includes('comilla') || k.includes('outlet_7')) cumillaStock = v;
              if (k.includes('wari') || k.includes('outlet_8')) wariStock = v;
              if (k.includes('sylhet') || k.includes('outlet_9')) sylhetStock = v;
            }
          }

          // Distribute remainder to warehouse
          const outletSum = mirpurStock + cumillaStock + wariStock + sylhetStock;
          const warehouseStock = Math.max(0, totalQty - outletSum);

          stockBySku[sku] = {
            warehouse: warehouseStock,
            mirpur: mirpurStock,
            cumilla: cumillaStock,
            wari: wariStock,
            sylhet: sylhetStock,
          };
        }
      }

      if (batch.length < 100) break;
    }

    const syncResult: WcStockData = {
      syncedAt: new Date().toISOString(),
      totalProducts: totalProductsFetched,
      totalSkus: Object.keys(stockBySku).length,
      stockBySku,
    };

    persistStockData(syncResult);

    return NextResponse.json({
      success: true,
      statusCode: 200,
      message: `Successfully refreshed stock levels for ${syncResult.totalSkus} SKUs across all DEEN locations.`,
      data: syncResult,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to synchronize live inventory stock.';
    return NextResponse.json(
      { success: false, statusCode: 500, message: msg },
      { status: 500 }
    );
  }
}
