import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GET as getCogsRoute } from '@/app/api/sync/woocommerce/cogs/route';
import { WcCogsData, getItemCogsInfo } from '@/lib/woocommerceClient';

describe('WooCommerce SKU COGS Extraction & API Engine', () => {
  it('has a valid persistent wc-sku-cogs.json seed file', () => {
    const filePath = path.join(process.cwd(), 'src', 'data', 'wc-sku-cogs.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const raw = fs.readFileSync(filePath, 'utf-8');
    const data: WcCogsData = JSON.parse(raw);

    expect(data.fetchedAt).toBeDefined();
    expect(data.totalProducts).toBeGreaterThan(0);
    expect(data.totalSkusWithCogs).toBeGreaterThan(0);
    expect(Object.keys(data.bySku).length).toBeGreaterThan(0);
    expect(Object.keys(data.byId).length).toBeGreaterThan(0);

    // Verify sample SKU
    const sampleRecord = data.bySku['109-0102-085']; // DEEN Black Bifold Wallet
    expect(sampleRecord).toBeDefined();
    expect(sampleRecord.cogs).toBe(450);
    expect(sampleRecord.regularPrice).toBe(950);
    expect(sampleRecord.grossMarginPercent).toBe(52.6);
  });

  it('serves cached COGS data via GET /api/sync/woocommerce/cogs', async () => {
    const req = new Request('http://localhost:3000/api/sync/woocommerce/cogs', {
      method: 'GET',
      headers: {
        'x-forwarded-for': '127.0.0.1',
      },
    });

    const res = await getCogsRoute(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.totalSkusWithCogs).toBeGreaterThan(0);
    expect(body.data.bySku['109-0102-085'].cogs).toBe(450);
  });

  it('resolves exact regularPrice and MRP alongside COGS in getItemCogsInfo', () => {
    const info = getItemCogsInfo('109-0102-085', 850);
    expect(info.cogs).toBe(450);
    expect(info.regularPrice).toBe(950);
    expect(info.mrp).toBe(950);
    expect(info.isExact).toBe(true);

    const fallback = getItemCogsInfo('UNKNOWN-SKU-999', 1200);
    expect(fallback.cogs).toBe(Math.round(1200 * 0.42));
    expect(fallback.mrp).toBe(1200);
    expect(fallback.isExact).toBe(false);
  });
});
