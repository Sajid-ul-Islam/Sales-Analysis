import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { getBaselineDataset } from '@/lib/baselineLoader';
import { matchPartialItemsAdvanced, OrderItemEntry } from '@/lib/subsetSum';
import { resolveCustomerRating } from '@/lib/customerRating';
import { computeMonthlyStatementSummaries } from '@/lib/monthlyStatements';
import { processLiveOpsData } from '@/lib/liveOpsProcessor';
import {
  executeInMemorySql,
  validateSqlSafety,
  getOrdersTableSchemaDescription,
} from '@/lib/ai/sqlEngine';
import { BACKGROUND_PRESETS, DEFAULT_THEME_SETTINGS } from '@/lib/themeManager';
import { RawOrderRow } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Creates and configures a fresh McpServer instance with DEEN Commerce tools and resources.
 * In stateless HTTP mode, a fresh server is instantiated per request to prevent transport/session collisions.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'deen-sales-mcp',
    version: '2.4.0',
  });

  // ==========================================
  // RESOURCES (per WEBMCP.md Specification)
  // ==========================================

  // 1. orders://live - Live warehouse fulfillment stream
  server.resource(
    'orders_live',
    'orders://live',
    async (uri) => {
      const dataset = getBaselineDataset();
      const liveReport = processLiveOpsData(dataset.orders as RawOrderRow[], { view: 'All Orders' });
      const payload = {
        uri: uri.href,
        asOf: new Date().toISOString(),
        totalOrdersCount: dataset.orders.length,
        shippedOrdersCount: liveReport.shippedOrders.rawValue,
        processingOrdersCount: liveReport.todaysOrdersBreakdown.processingCount,
        holdOrdersCount: liveReport.todaysOrdersBreakdown.holdCount,
        queueOrdersCount: liveReport.todaysOrdersBreakdown.queueCount || 0,
        activeOrdersSample: liveReport.activeOrders.slice(0, 10),
      };
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  );

  // 2. metrics://kpi_summary - Active KPI overview snapshot
  server.resource(
    'metrics_kpi_summary',
    'metrics://kpi_summary',
    async (uri) => {
      const dataset = getBaselineDataset();
      const liveReport = processLiveOpsData(dataset.orders as RawOrderRow[], { view: 'All Orders' });
      const statements = computeMonthlyStatementSummaries(dataset.orders);
      const latestStatement = statements[0] || null;

      const payload = {
        uri: uri.href,
        asOf: new Date().toISOString(),
        liveOps: {
          salesRevenue: liveReport.salesRevenue.rawValue,
          shippedOrders: liveReport.shippedOrders.rawValue,
          shippedItems: liveReport.shippedItems.rawValue,
          customerMix: liveReport.customerMix,
          topCategories: liveReport.categoryItems.slice(0, 5),
        },
        latestClosedMonth: latestStatement
          ? {
              monthKey: latestStatement.monthKey,
              label: latestStatement.label,
              grossRevenue: latestStatement.grossRevenue,
              deliveredRevenue: latestStatement.deliveredRevenue,
              returnedRevenue: latestStatement.returnedRevenue,
              deliveryRate: latestStatement.deliveryRate,
              returnRate: latestStatement.returnRate,
              orderCount: latestStatement.orderCount,
              unitCount: latestStatement.unitCount,
            }
          : null,
      };

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  );

  // 3. statements://month/{month} - Closed-month reconciliation summary
  server.resource(
    'monthly_statement',
    new ResourceTemplate('statements://month/{month}', { list: undefined }),
    async (uri, { month }) => {
      const dataset = getBaselineDataset();
      const statements = computeMonthlyStatementSummaries(dataset.orders);
      const targetKey = String(month).trim().toLowerCase();
      const matched = statements.find(
        (s) =>
          s.monthKey.toLowerCase() === targetKey ||
          s.id.toLowerCase() === targetKey ||
          s.label.toLowerCase() === targetKey ||
          s.shortLabel.toLowerCase() === targetKey
      );

      if (!matched) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: `Statement for month '${month}' not found. Available months: ${statements.map((s) => s.monthKey).join(', ')}`,
              }),
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(matched, null, 2),
          },
        ],
      };
    }
  );

  // 4. theme://current - Active theme and styling presets
  server.resource(
    'theme_current',
    'theme://current',
    async (uri) => {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                defaultSettings: DEFAULT_THEME_SETTINGS,
                availablePresets: BACKGROUND_PRESETS,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ==========================================
  // TOOLS (per WEBMCP.md Specification)
  // ==========================================

  // 1. query_reconciled_orders
  server.tool(
    'query_reconciled_orders',
    'Executes safe AlaSQL queries against the reconciled orders dataset. Supports filtering, aggregation, and grouping by category, district, SKU, and payment method.',
    {
      sql: z.string().describe('SQL query string (e.g. SELECT category, SUM(totalPrice) as sales, COUNT(*) as units FROM orders GROUP BY category ORDER BY sales DESC)'),
    },
    async ({ sql }) => {
      const safety = validateSqlSafety(sql);
      if (!safety.isValid) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `SQL Safety Violation: ${safety.reason || 'Query contains forbidden statements'}. Available schema:\n${getOrdersTableSchemaDescription()}`,
            },
          ],
        };
      }

      const dataset = getBaselineDataset();
      const queryResult = executeInMemorySql(sql, dataset.orders);

      if (!queryResult.success) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `SQL Query Execution Error: ${queryResult.error}\n\nSchema reference:\n${getOrdersTableSchemaDescription()}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                rowCount: queryResult.rowCount,
                executionTimeMs: queryResult.executionTimeMs,
                columns: queryResult.columns,
                rows: queryResult.rows,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 2. run_knapsack_reconciliation
  server.tool(
    'run_knapsack_reconciliation',
    'Runs the deterministic subset-sum 0/1 knapsack algorithm on a disputed or partial delivery order. Solves exact delivered vs returned items while strictly enforcing integer quantities (no fractional items).',
    {
      order_id: z.union([z.string(), z.number()]).describe('Order ID number or string (e.g. 18924)'),
      collected_cod_cash: z.number().describe('Total cash collected by courier in BDT (including delivery fee)'),
      shipping_zone: z
        .enum(['inside_dhaka', 'outside_dhaka'])
        .optional()
        .default('inside_dhaka')
        .describe('Delivery shipping zone: inside_dhaka (50 TK delivery fee) or outside_dhaka (90 TK)'),
      custom_items: z
        .array(
          z.object({
            idx: z.number().optional(),
            name: z.string().optional(),
            cost: z.number().describe('Unit price of the item'),
            qty: z.number().describe('Quantity of the item (strictly positive integer)'),
          })
        )
        .optional()
        .describe('Explicit line items for the order if not looking up from database'),
    },
    async ({ order_id, collected_cod_cash, shipping_zone, custom_items }) => {
      let items: OrderItemEntry[] = [];
      let orderTotalAmount = 0;

      if (custom_items && custom_items.length > 0) {
        items = custom_items.map((it, idx) => ({
          idx: it.idx !== undefined ? it.idx : idx,
          cost: it.cost,
          qty: Math.max(1, Math.round(it.qty)),
        }));
        orderTotalAmount = items.reduce((sum, it) => sum + it.cost * it.qty, 0);
      } else {
        const dataset = getBaselineDataset();
        const strId = String(order_id).trim();
        const found = (dataset.orders as Record<string, unknown>[]).filter(
          (o) => String(o['Order ID'] || o.orderId || o.id || '').trim() === strId
        );

        if (found.length === 0) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Order ID ${order_id} not found in database. Pass 'custom_items' array with item prices and quantities.`,
              },
            ],
          };
        }

        items = found.map((row, idx) => {
          const cost = parseFloat(String(row['Item Cost'] || row.itemCost || row.Price || row.price || 0)) || 0;
          const qty = parseInt(String(row.Quantity || row.quantity || 1), 10) || 1;
          return { idx, cost, qty };
        });
        const rawTotal = parseFloat(String(found[0]['Order Total Amount'] || found[0].total || 0));
        orderTotalAmount = rawTotal > 0 ? rawTotal : items.reduce((sum, it) => sum + it.cost * it.qty, 0);
      }

      const insideFee = shipping_zone === 'outside_dhaka' ? 90 : 50;
      const outsideFee = shipping_zone === 'outside_dhaka' ? 90 : 50;

      const result = matchPartialItemsAdvanced(items, collected_cod_cash, orderTotalAmount, insideFee, outsideFee);

      // Verify AGENTS.md invariant: Returned quantities MUST be integer values
      const assignments = Array.from(result.itemAssignments.entries()).map(([idx, assign]) => {
        if (!Number.isInteger(assign.keptQty) || !Number.isInteger(assign.returnedQty)) {
          throw new Error(`Knapsack invariant violation: Fractional quantity detected for item idx ${idx}`);
        }
        return {
          itemIndex: idx,
          totalQty: assign.totalQty,
          deliveredQty: assign.keptQty,
          returnedQty: assign.returnedQty,
          unitCost: assign.itemCost,
          deliveredValue: assign.keptValue,
          returnedValue: assign.returnedValue,
        };
      });

      const responsePayload = {
        orderId: order_id,
        collectedCodCash: collected_cod_cash,
        shippingZone: shipping_zone,
        deliveryFeeDeducted: insideFee,
        netProductValueDelivered: result.matchedValue,
        confidence: result.confidence,
        toleranceDifference: result.toleranceDifference,
        integerQuantityInvariantVerified: true,
        summary: {
          totalKeptValue: result.keptTotalValue,
          totalReturnedValue: result.returnedTotalValue,
          packagingMaterialLoss: 25, // Fixed ৳25 per returned/partial parcel per AGENTS.md
        },
        itemAssignments: assignments,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(responsePayload, null, 2),
          },
        ],
      };
    }
  );

  // 3. evaluate_customer_phone
  server.tool(
    'evaluate_customer_phone',
    'Queries Pathao Hermes delivery intelligence and historical fulfillment records to assess customer delivery success rate and RTO fraud risk.',
    {
      phone: z.string().describe('Customer phone number in Bangladesh format (e.g. 01711000000)'),
    },
    async ({ phone }) => {
      const rating = await resolveCustomerRating(phone);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(rating, null, 2),
          },
        ],
      };
    }
  );

  // 4. get_kpi_overview
  server.tool(
    'get_kpi_overview',
    'Get current sales and operational KPI overview (revenue, orders, items, customer mix, top categories).',
    {
      view: z
        .enum(['Today Shipped', "Today's Orders", 'All Orders', 'Queue'])
        .optional()
        .default('All Orders')
        .describe('Operational view filter'),
      channel: z.enum(['ALL', 'ONLINE', 'POS']).optional().default('ALL').describe('Channel filter: ALL, ONLINE, or POS'),
    },
    async ({ view, channel }) => {
      const dataset = getBaselineDataset();
      const report = processLiveOpsData(dataset.orders as RawOrderRow[], {
        view: view as 'Today Shipped' | "Today's Orders" | 'All Orders' | 'Queue',
        channelFilter: channel,
      });

      const responsePayload = {
        view,
        channel,
        kpis: {
          salesRevenue: report.salesRevenue.rawValue,
          shippedOrders: report.shippedOrders.rawValue,
          shippedItems: report.shippedItems.rawValue,
          customerMix: report.customerMix,
        },
        todaysOrdersPipeline: report.todaysOrdersBreakdown,
        topCategories: report.categoryItems.slice(0, 5),
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(responsePayload, null, 2),
          },
        ],
      };
    }
  );

  // 5. get_monthly_statement
  server.tool(
    'get_monthly_statement',
    'Get the authoritative financial closing statement for a given month (e.g. 2026-10 or October 2026).',
    {
      month: z.string().describe("Month identifier, e.g. '2026-10' or 'October 2026'"),
    },
    async ({ month }) => {
      const dataset = getBaselineDataset();
      const statements = computeMonthlyStatementSummaries(dataset.orders);
      const target = month.trim().toLowerCase();
      const statement = statements.find(
        (s) =>
          s.monthKey.toLowerCase() === target ||
          s.id.toLowerCase() === target ||
          s.label.toLowerCase() === target ||
          s.shortLabel.toLowerCase() === target
      );

      if (!statement) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Monthly statement for '${month}' not found. Available closed months: ${statements.map((s) => s.monthKey).join(', ')}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(statement, null, 2),
          },
        ],
      };
    }
  );

  // 6. trigger_excel_export
  server.tool(
    'trigger_excel_export',
    'Generates master reconciliation export metadata and summary for a specific month.',
    {
      month: z.string().optional().default('2026-10').describe('Month in YYYY-MM format (e.g. 2026-10)'),
      include_audit_trail: z.boolean().optional().default(true).describe('Whether to include audit trail breakdown'),
    },
    async ({ month, include_audit_trail }) => {
      const dataset = getBaselineDataset();
      const statements = computeMonthlyStatementSummaries(dataset.orders);
      const stmt = statements.find((s) => s.monthKey === month);

      const payload = {
        month,
        include_audit_trail,
        status: stmt ? 'READY' : 'NOT_FOUND',
        summary: stmt || null,
        exportOptions: {
          filename: `DEEN_Reconciliation_${month}.xlsx`,
          sheetsIncluded: [
            'Net Sales & COGS',
            'Disputed & Partial Orders',
            'RTO Courier Return Leakage',
            'Retail POS Branch Breakdown',
            'Pathao Delivery Settlement',
            'Customer Retention Scorecard',
            ...(include_audit_trail ? ['Audit Trail & Knapsack Proofs'] : []),
          ],
          downloadEndpoint: '/api/lakehouse/export',
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  );

  // 7. set_theme_background
  server.tool(
    'set_theme_background',
    'Dynamically adjusts canvas background theme settings and returns corresponding CSS variables.',
    {
      background_id: z
        .enum(['super-white', 'slate-subtle', 'zinc-cool', 'cream-warm', 'dark-canvas'])
        .describe('Background preset ID'),
    },
    async ({ background_id }) => {
      const preset = BACKGROUND_PRESETS.find((p) => p.id === background_id) || BACKGROUND_PRESETS[0];
      const updatedSettings = {
        ...DEFAULT_THEME_SETTINGS,
        backgroundId: preset.id,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                appliedPreset: preset,
                activeSettings: updatedSettings,
                cssVariables: {
                  '--bg-surface': preset.bgHex,
                  '--card-surface': preset.cardHex,
                  '--sidebar-surface': preset.sidebarHex,
                  '--border-surface': preset.borderHex,
                  '--text-surface': preset.textHex,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

/**
 * Validates request authorization using MCP_SECRET bearer token.
 */
function isAuthorized(req: Request): boolean {
  const secret = process.env.MCP_SECRET;
  if (!secret) {
    // If no secret configured in local dev, allow seamless local inspection
    return true;
  }
  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${secret}`;
}

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32002, message: 'Unauthorized: Invalid or missing MCP_SECRET Bearer token.' },
        id: null,
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Header normalization: ensure application/json and text/event-stream are in Accept header
  const headers = new Headers(req.headers);
  const accept = headers.get('accept') || '';
  if (!accept.includes('application/json') || !accept.includes('text/event-stream')) {
    headers.set('accept', 'application/json, text/event-stream');
  }

  const normalizedReq = new Request(req, { headers });
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode for Next.js App Router
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(normalizedReq);
}

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid or missing MCP_SECRET Bearer token.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const accept = req.headers.get('accept') || '';
  if (accept.includes('text/event-stream')) {
    const server = createMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    return transport.handleRequest(req);
  }

  return new Response(
    JSON.stringify(
      {
        status: 'online',
        server: 'deen-sales-mcp',
        version: '2.4.0',
        description: 'DEEN Commerce Reconciliation Engine WebMCP Server Gateway',
        endpoints: {
          mcp: '/api/mcp',
        },
        resources: [
          'orders://live',
          'metrics://kpi_summary',
          'statements://month/{month}',
          'theme://current',
        ],
        tools: [
          'query_reconciled_orders',
          'run_knapsack_reconciliation',
          'evaluate_customer_phone',
          'get_kpi_overview',
          'get_monthly_statement',
          'trigger_excel_export',
          'set_theme_background',
        ],
      },
      null,
      2
    ),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    },
  });
}
