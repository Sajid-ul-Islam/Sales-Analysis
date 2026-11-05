import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { fetchWooCommerceCogsMap, WcCogsData } from '@/lib/woocommerceClient';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { checkRateLimit } from '@/lib/auth/rateLimiter';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow sufficient time for variation sweeps

// In-memory cache for ultra-fast GET responses
let memoryCache: WcCogsData | null = null;
let lastCacheRead = 0;

function getCachedCogsData(): WcCogsData | null {
  const now = Date.now();
  if (memoryCache && now - lastCacheRead < 60000) {
    return memoryCache;
  }

  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'wc-sku-cogs.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      memoryCache = JSON.parse(raw) as WcCogsData;
      lastCacheRead = now;
      return memoryCache;
    }
  } catch {
    // Fall back to memory cache if disk read fails
  }

  return memoryCache;
}

function persistCogsData(data: WcCogsData): void {
  memoryCache = data;
  lastCacheRead = Date.now();
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'wc-sku-cogs.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Failed to persist wc-sku-cogs.json to disk:', msg);
  }
}

/**
 * GET /api/sync/woocommerce/cogs
 * Returns cached SKU-to-COGS data extracted from WooCommerce REST API (_sip_buying_price).
 */
export async function GET(req: Request) {
  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'internal_caller';
    const rateCheck = await checkRateLimit(`cogs_get_${clientIp}`, 60, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, statusCode: 429, message: 'Rate limit exceeded.' },
        { status: 429 }
      );
    }

    const cached = getCachedCogsData();
    if (!cached) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 404,
          message: 'No COGS dataset available. Trigger a sync via POST /api/sync/woocommerce/cogs.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      statusCode: 200,
      data: cached,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error while fetching COGS map.';
    return NextResponse.json(
      {
        success: false,
        statusCode: 500,
        message: msg,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync/woocommerce/cogs
 * Triggers a live sync with WooCommerce REST API to re-extract _sip_buying_price
 * across all simple products and variable product variations.
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
    const rateCheck = await checkRateLimit(`cogs_sync_${clientIp}`, 5, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, statusCode: 429, message: 'Rate limit exceeded: Max 5 syncs per minute.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const credentials = body.credentials || undefined;
    const maxPages = typeof body.maxPages === 'number' ? body.maxPages : undefined;
    const concurrency = typeof body.concurrency === 'number' ? body.concurrency : 10;

    const freshData = await fetchWooCommerceCogsMap({
      credentials,
      maxPages,
      concurrency,
    });

    persistCogsData(freshData);

    return NextResponse.json({
      success: true,
      statusCode: 200,
      message: `Successfully synchronized ${freshData.totalSkusWithCogs} SKUs with exact WooCommerce COGS from ${freshData.totalProducts} catalog products.`,
      data: freshData,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to sync COGS from WooCommerce REST API.';
    return NextResponse.json(
      {
        success: false,
        statusCode: 500,
        message: msg,
      },
      { status: 500 }
    );
  }
}
