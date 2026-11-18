import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET, POST, OPTIONS, createMcpServer } from '@/app/api/mcp/route';

describe('WebMCP App Router API Route (/api/mcp)', () => {
  const originalEnv = process.env.MCP_SECRET;

  beforeEach(() => {
    delete process.env.MCP_SECRET;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.MCP_SECRET = originalEnv;
    } else {
      delete process.env.MCP_SECRET;
    }
  });

  describe('CORS and Discovery (OPTIONS & GET)', () => {
    it('handles OPTIONS preflight with standard CORS headers', async () => {
      const res = await OPTIONS();
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('returns server metadata on GET without text/event-stream', async () => {
      const req = new Request('http://localhost:3000/api/mcp', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.server).toBe('deen-sales-mcp');
      expect(json.version).toBe('2.4.0');
      expect(json.tools).toContain('query_reconciled_orders');
      expect(json.tools).toContain('run_knapsack_reconciliation');
      expect(json.tools).toContain('get_kpi_overview');
      expect(json.resources).toContain('orders://live');
      expect(json.resources).toContain('metrics://kpi_summary');
    });

    it('enforces Bearer token when MCP_SECRET is configured', async () => {
      process.env.MCP_SECRET = 'super-secret-mcp-key';

      // 1. Missing Authorization header
      const unauthReq = new Request('http://localhost:3000/api/mcp', {
        method: 'GET',
      });
      const unauthRes = await GET(unauthReq);
      expect(unauthRes.status).toBe(401);

      // 2. Invalid Bearer token
      const wrongAuthReq = new Request('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer wrong-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
      });
      const wrongRes = await POST(wrongAuthReq);
      expect(wrongRes.status).toBe(401);

      // 3. Valid Bearer token
      const validAuthReq = new Request('http://localhost:3000/api/mcp', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer super-secret-mcp-key',
        },
      });
      const validRes = await GET(validAuthReq);
      expect(validRes.status).toBe(200);
    });
  });

  describe('MCP Protocol Lifecycle (POST JSON-RPC)', () => {
    it('handles initialize handshake', async () => {
      const initReq = new Request('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'vitest-client', version: '1.0.0' },
          },
        }),
      });

      const res = await POST(initReq);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.result).toBeDefined();
      expect(json.result.serverInfo.name).toBe('deen-sales-mcp');
      expect(json.result.serverInfo.version).toBe('2.4.0');
    });

    it('lists all 7 exposed agentic tools via tools/list', async () => {
      const listReq = new Request('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {},
        }),
      });

      const res = await POST(listReq);
      expect(res.status).toBe(200);
      const json = await res.json();
      const toolNames = json.result.tools.map((t: { name: string }) => t.name);

      expect(toolNames).toContain('query_reconciled_orders');
      expect(toolNames).toContain('run_knapsack_reconciliation');
      expect(toolNames).toContain('evaluate_customer_phone');
      expect(toolNames).toContain('get_kpi_overview');
      expect(toolNames).toContain('get_monthly_statement');
      expect(toolNames).toContain('trigger_excel_export');
      expect(toolNames).toContain('set_theme_background');
    });

    it('lists exposed resources via resources/list', async () => {
      const listReq = new Request('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'resources/list',
          params: {},
        }),
      });

      const res = await POST(listReq);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.result.resources.length).toBeGreaterThanOrEqual(3);
      const uris = json.result.resources.map((r: { uri: string }) => r.uri);
      expect(uris).toContain('orders://live');
      expect(uris).toContain('metrics://kpi_summary');
      expect(uris).toContain('theme://current');
    });

    it('executes set_theme_background tool call', async () => {
      const callReq = new Request('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: {
            name: 'set_theme_background',
            arguments: { background_id: 'super-white' },
          },
        }),
      });

      const res = await POST(callReq);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.result.content[0].type).toBe('text');
      const parsed = JSON.parse(json.result.content[0].text);
      expect(parsed.appliedPreset.id).toBe('super-white');
      expect(parsed.cssVariables['--bg-surface']).toBe('#FFFFFF');
    });

    it('executes run_knapsack_reconciliation enforcing integer quantity invariant', async () => {
      const callReq = new Request('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: {
            name: 'run_knapsack_reconciliation',
            arguments: {
              order_id: 'TEST-101',
              collected_cod_cash: 1500, // 50 delivery fee + 1450 shirt
              shipping_zone: 'inside_dhaka',
              custom_items: [
                { idx: 0, name: 'Oxford Shirt', cost: 1450, qty: 1 },
                { idx: 1, name: 'Denim Pants', cost: 2200, qty: 1 },
              ],
            },
          },
        }),
      });

      const res = await POST(callReq);
      expect(res.status).toBe(200);
      const json = await res.json();
      const payload = JSON.parse(json.result.content[0].text);

      expect(payload.integerQuantityInvariantVerified).toBe(true);
      expect(payload.deliveryFeeDeducted).toBe(50);
      expect(payload.netProductValueDelivered).toBe(1450);
      expect(payload.summary.packagingMaterialLoss).toBe(25);
      expect(payload.itemAssignments[0].deliveredQty).toBe(1);
      expect(payload.itemAssignments[1].deliveredQty).toBe(0);
      expect(payload.itemAssignments[1].returnedQty).toBe(1);
    });

    it('executes get_kpi_overview tool call', async () => {
      const callReq = new Request('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/call',
          params: {
            name: 'get_kpi_overview',
            arguments: { view: 'All Orders', channel: 'ALL' },
          },
        }),
      });

      const res = await POST(callReq);
      expect(res.status).toBe(200);
      const json = await res.json();
      const payload = JSON.parse(json.result.content[0].text);
      expect(payload.kpis).toBeDefined();
      expect(typeof payload.kpis.salesRevenue).toBe('number');
    });

    it('reads theme://current resource', async () => {
      const readReq = new Request('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 7,
          method: 'resources/read',
          params: { uri: 'theme://current' },
        }),
      });

      const res = await POST(readReq);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.result.contents[0].uri).toBe('theme://current');
      const parsed = JSON.parse(json.result.contents[0].text);
      expect(parsed.availablePresets.length).toBeGreaterThan(0);
    });
  });
});
