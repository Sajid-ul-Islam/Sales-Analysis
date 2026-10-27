import { describe, it, expect } from 'vitest';
import {
  executeInMemorySql,
  validateSqlSafety,
  sanitizeSqlLimit,
  formatSqlResultToMarkdownTable,
  normalizeRowsForSql,
} from '@/lib/ai/sqlEngine';

describe('In-Memory SQL Engine for DEEN Assistant', () => {
  const sampleOrders = [
    {
      orderId: '18901',
      orderDate: '2026-10-20',
      customerName: 'Rahim Khan',
      phone: '01711000001',
      districtArea: 'Inside Dhaka',
      fulfillmentLocation: 'Online Store (Central Warehouse)',
      sipInventory: 'Central Warehouse',
      paymentMethod: 'Cash on delivery',
      deliveryStatus: 'delivered',
      orderDeliveryStatus: 'Delivered',
      courierStatus: 'Delivered',
      itemName: 'Vintage Denim Jeans - 32',
      sku: '101-SLIM-32',
      quantity: 1,
      itemCost: 2000,
      orderAmount: 2000,
    },
    {
      orderId: '18902',
      orderDate: '2026-10-21',
      customerName: 'Karim Ahmed',
      phone: '01811000002',
      districtArea: 'Outside Dhaka',
      fulfillmentLocation: 'Mirpur Outlet POS',
      sipInventory: 'Mirpur Outlet',
      paymentMethod: 'bKash',
      deliveryStatus: 'returned',
      orderDeliveryStatus: 'Not Paid Return',
      courierStatus: 'Returned',
      itemName: 'Cuban Collar Shirt - L',
      sku: '102-CUBAN-L',
      quantity: 2,
      itemCost: 1500,
      orderAmount: 3000,
      returnedValue: 3000,
      isReturn: true,
    },
    {
      orderId: '18903',
      orderDate: '2026-10-22',
      customerName: 'Tanvir Hossain',
      phone: '01911000003',
      districtArea: 'Outside Dhaka',
      fulfillmentLocation: 'Cumilla Branch',
      sipInventory: 'Cumilla Branch',
      paymentMethod: 'Cash on delivery',
      deliveryStatus: 'delivered',
      orderDeliveryStatus: 'Delivered',
      courierStatus: 'Delivered',
      itemName: 'Vintage Denim Jeans - 34',
      sku: '101-SLIM-34',
      quantity: 1,
      itemCost: 2200,
      orderAmount: 2200,
    },
    {
      orderId: '18904',
      orderDate: '2026-10-23',
      customerName: 'Rahim Khan',
      phone: '01711000001',
      districtArea: 'Inside Dhaka',
      fulfillmentLocation: 'Online Store (Central Warehouse)',
      sipInventory: 'Central Warehouse',
      paymentMethod: 'Cash on delivery',
      deliveryStatus: 'partial',
      orderDeliveryStatus: 'Partial',
      courierStatus: 'Partial Delivered',
      itemName: 'Panjabi Premium White - XL',
      sku: '103-PANJ-XL',
      quantity: 1,
      itemCost: 2800,
      orderAmount: 2800,
      isPartial: true,
    },
  ];

  describe('1. SQL Safety & Guardrails', () => {
    it('approves clean SELECT queries', () => {
      expect(validateSqlSafety('SELECT * FROM orders').isValid).toBe(true);
      expect(validateSqlSafety('SELECT districtArea, count(*) FROM orders GROUP BY districtArea').isValid).toBe(true);
      expect(validateSqlSafety('WITH summary AS (SELECT * FROM orders) SELECT * FROM summary').isValid).toBe(true);
    });

    it('rejects destructive commands (DROP, DELETE, UPDATE, INSERT, ALTER)', () => {
      expect(validateSqlSafety('DROP TABLE orders').isValid).toBe(false);
      expect(validateSqlSafety('DELETE FROM orders WHERE 1=1').isValid).toBe(false);
      expect(validateSqlSafety('UPDATE orders SET orderAmount = 0').isValid).toBe(false);
      expect(validateSqlSafety('INSERT INTO orders VALUES (1)').isValid).toBe(false);
      expect(validateSqlSafety('ALTER TABLE orders ADD COLUMN test INT').isValid).toBe(false);
      expect(validateSqlSafety('TRUNCATE TABLE orders').isValid).toBe(false);
    });

    it('blocks statement chaining (;)', () => {
      expect(validateSqlSafety('SELECT * FROM orders; DROP TABLE orders;').isValid).toBe(false);
      expect(validateSqlSafety('SELECT * FROM orders; SELECT * FROM users').isValid).toBe(false);
    });

    it('enforces row limit clamp', () => {
      expect(sanitizeSqlLimit('SELECT * FROM orders')).toBe('SELECT * FROM orders LIMIT 50');
      expect(sanitizeSqlLimit('SELECT * FROM orders LIMIT 10')).toBe('SELECT * FROM orders LIMIT 10');
      expect(sanitizeSqlLimit('SELECT * FROM orders LIMIT 500', 50)).toBe('SELECT * FROM orders LIMIT 50');
    });
  });

  describe('2. In-Memory Query Execution', () => {
    it('executes simple SELECT with WHERE filter', () => {
      const res = executeInMemorySql("SELECT orderId, customerName FROM orders WHERE districtArea = 'Inside Dhaka'", sampleOrders);
      expect(res.success).toBe(true);
      expect(res.rows).toHaveLength(2);
      expect(res.rows.map((r) => r.orderId)).toEqual(['18901', '18904']);
    });

    it('executes aggregate functions (COUNT, SUM, AVG)', () => {
      const res = executeInMemorySql('SELECT count(*) as totalOrders, sum(quantity) as totalUnits FROM orders', sampleOrders);
      expect(res.success).toBe(true);
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].totalOrders).toBe(4);
      expect(res.rows[0].totalUnits).toBe(5); // 1 + 2 + 1 + 1
    });

    it('executes GROUP BY with aggregations and ORDER BY', () => {
      const res = executeInMemorySql(
        'SELECT districtArea, count(*) as orderCount, sum(totalPrice) as grossRevenue FROM orders GROUP BY districtArea ORDER BY grossRevenue DESC',
        sampleOrders
      );
      expect(res.success).toBe(true);
      expect(res.rows).toHaveLength(2);
      // Outside Dhaka has 3000 + 2200 = 5200; Inside Dhaka has 2000 + 2800 = 4800
      expect(res.rows[0].districtArea).toBe('Outside Dhaka');
      expect(res.rows[0].grossRevenue).toBe(5200);
      expect(res.rows[1].districtArea).toBe('Inside Dhaka');
      expect(res.rows[1].grossRevenue).toBe(4800);
    });

    it('supports string LIKE pattern matching', () => {
      const res = executeInMemorySql("SELECT orderId, itemName FROM orders WHERE itemName LIKE '%Jeans%'", sampleOrders);
      expect(res.success).toBe(true);
      expect(res.rows).toHaveLength(2);
      expect(res.rows.map((r) => r.orderId)).toEqual(['18901', '18903']);
    });

    it('returns executionTimeMs and column names', () => {
      const res = executeInMemorySql('SELECT sku, quantity FROM orders', sampleOrders);
      expect(res.success).toBe(true);
      expect(res.columns).toEqual(['sku', 'quantity']);
      expect(typeof res.executionTimeMs).toBe('number');
      expect(res.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('3. Markdown Formatting', () => {
    it('formats query results into clean GitHub Flavored Markdown table', () => {
      const res = executeInMemorySql('SELECT orderId, customerName, totalPrice FROM orders WHERE orderId = "18901"', sampleOrders);
      const md = formatSqlResultToMarkdownTable(res);
      expect(md).toContain('| orderId | customerName | totalPrice |');
      expect(md).toContain('| 18901 | Rahim Khan | 2,000 |');
    });

    it('handles empty results gracefully', () => {
      const res = executeInMemorySql("SELECT * FROM orders WHERE orderId = 'NON_EXISTENT'", sampleOrders);
      const md = formatSqlResultToMarkdownTable(res);
      expect(md).toContain('0 matching rows');
    });

    it('handles query errors gracefully without crashing', () => {
      const res = executeInMemorySql('SELECT FROM INVALID SYNTAX', sampleOrders);
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
      const md = formatSqlResultToMarkdownTable(res);
      expect(md).toContain('SQL Query Error');
    });
  });
});
