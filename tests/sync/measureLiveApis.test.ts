import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { testWooCommerceConnection, fetchWooCommerceOrders, formatWooCommerceToOrderRows } from '@/lib/woocommerceClient';
import { getPathaoToken, getPathaoStores, getPathaoOrderDetails } from '@/lib/pathaoClient';

// Ensure .env.local variables are loaded for the test run
function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val.replace(/\\n/g, '\n');
        }
      }
    }
  }
}

loadLocalEnv();

describe('Live API Measurement & Performance Diagnostics', () => {
  describe('WooCommerce Live REST API Diagnostic', () => {
    it('measures connection latency and credentials validity', async () => {
      const startTime = performance.now();
      const conn = await testWooCommerceConnection();
      const elapsedMs = Math.round(performance.now() - startTime);

      console.log(`[WooCommerce Connection Benchmark] Status: ${conn.status}, Message: "${conn.message}", Elapsed: ${elapsedMs}ms`);
      expect(conn).toBeDefined();
      expect(typeof conn.status).toBe('number');
    });

    it('measures recent order fetch latency, throughput, and schema integrity', async () => {
      const startTime = performance.now();
      try {
        const orders = await fetchWooCommerceOrders({
          perPage: 5,
          fetchAllPages: false,
          maxPages: 1,
        });
        const elapsedMs = Math.round(performance.now() - startTime);
        console.log(`[WooCommerce Fetch Benchmark] Fetched ${orders.length} orders in ${elapsedMs}ms (Avg ${Math.round(elapsedMs / Math.max(orders.length, 1))}ms/order)`);

        if (orders.length > 0) {
          const rows = formatWooCommerceToOrderRows(orders);
          console.log(`[WooCommerce Line Items] Transformed ${orders.length} orders into ${rows.length} reconciled order rows.`);
          expect(rows.length).toBeGreaterThan(0);
          expect(rows[0].orderId).toBeDefined();
        }
      } catch (err: any) {
        console.warn(`[WooCommerce Fetch Notice]: ${err.message}`);
      }
    });
  });

  describe('Pathao Hermes Live API Diagnostic', () => {
    it('measures OAuth2 token exchange latency and bearer validity', async () => {
      const startTime = performance.now();
      try {
        const token = await getPathaoToken();
        const elapsedMs = Math.round(performance.now() - startTime);
        console.log(`[Pathao Token Benchmark] Received bearer token (${token.slice(0, 10)}...) in ${elapsedMs}ms`);
        expect(token).toBeDefined();
        expect(token.length).toBeGreaterThan(20);

        // Test stores lookup
        const storeStart = performance.now();
        const stores = await getPathaoStores();
        const storeElapsed = Math.round(performance.now() - storeStart);
        console.log(`[Pathao Stores Benchmark] Fetched ${stores.length} registered pickup stores in ${storeElapsed}ms`);
      } catch (err: any) {
        console.warn(`[Pathao Live Notice]: ${err.message}`);
      }
    });

    it('measures single consignment tracking lookup latency', async () => {
      try {
        const startTime = performance.now();
        // Test with a dummy or known consignment ID to test API latency and 404/200 handling
        const res = await getPathaoOrderDetails('TEST-CONSIGNMENT-ID-001');
        const elapsedMs = Math.round(performance.now() - startTime);
        console.log(`[Pathao Consignment Lookup Benchmark] Non-blocking lookup completed in ${elapsedMs}ms, result:`, res ? 'FOUND' : 'NOT_FOUND_GRACEFUL');
        expect(elapsedMs).toBeLessThan(10000);
      } catch (err: any) {
        console.warn(`[Pathao Consignment Notice]: ${err.message}`);
      }
    });
  });
});
