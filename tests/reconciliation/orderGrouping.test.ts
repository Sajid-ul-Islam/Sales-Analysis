import { describe, it, expect } from 'vitest';
import { groupOrdersByOrderId, filterOrderWiseGroups, buildOrderWiseWorkbook } from '@/lib/orderGrouping';
import { RawOrderRow } from '@/types';

describe('Order-Wise Grouping & Filtering Engine', () => {
  const mockRows: Partial<RawOrderRow>[] = [
    // Order 1001: Multi-item basket (2 items: 1 Jeans, 1 Shirt)
    {
      'Order ID': '1001',
      orderId: '1001',
      'Order Date': '2026-10-18T10:00:00Z',
      'Customer Name': 'Tanvir Ahmed',
      Phone: '01711111111',
      'Item Name': 'DEEN High-End Jeans - Indigo 32',
      SKU: 'DN-JN-01',
      Quantity: 1,
      'Item Cost': 2500,
      'Order Amount': 2500,
      'Delivery Status': 'shipped',
      'Courier Status': 'Delivered',
      courierStatus: 'Delivered',
      'Consignment ID': 'RD1001A',
    },
    {
      'Order ID': '1001',
      orderId: '1001',
      'Order Date': '2026-10-18T10:00:00Z',
      'Customer Name': 'Tanvir Ahmed',
      Phone: '01711111111',
      'Item Name': 'DEEN Signature Oxford Shirt - L',
      SKU: 'DN-SH-02',
      Quantity: 2,
      'Item Cost': 1800,
      'Order Amount': 3600,
      'Delivery Status': 'shipped',
      'Courier Status': 'Delivered',
      courierStatus: 'Delivered',
      'Consignment ID': 'RD1001A',
    },
    // Order 1002: Single-item Selects order
    {
      'Order ID': '1002',
      orderId: '1002',
      'Order Date': '2026-10-18T11:00:00Z',
      'Customer Name': 'Kazi Rifat',
      Phone: '01822222222',
      'Item Name': 'ZARA Quilted Bomber Jacket',
      SKU: 'SEL-JK-01',
      Quantity: 1,
      'Item Cost': 4500,
      'Order Amount': 4500,
      'Delivery Status': 'shipped',
      'Courier Status': 'In Transit',
      courierStatus: 'In Transit',
      'Consignment ID': 'RD1002B',
    },
    // Order 1003: Discrepancy order
    {
      'Order ID': '1003',
      orderId: '1003',
      'Order Date': '2026-10-18T12:00:00Z',
      'Customer Name': 'Mahmudul Hasan',
      Phone: '01933333333',
      'Item Name': 'DEEN Twill Five Pocket Pant',
      SKU: 'DN-TW-03',
      Quantity: 1,
      'Item Cost': 2100,
      'Order Amount': 2100,
      'Delivery Status': 'shipped',
      'Courier Status': 'Returned',
      courierStatus: 'Returned',
      'Consignment ID': 'RD1003C',
      hasDiscrepancy: true,
      discrepancyType: 'RETURNED_BUT_SHIPPED',
    },
  ];

  it('consolidates multi-item order rows into a single authoritative order group', () => {
    const groups = groupOrdersByOrderId(mockRows as RawOrderRow[]);

    // 4 rows should consolidate into 3 unique orders
    expect(groups).toHaveLength(3);

    // Find Order 1001
    const order1001 = groups.find((g) => g.orderId === '1001');
    expect(order1001).toBeDefined();
    expect(order1001?.items).toHaveLength(2);
    expect(order1001?.totalQuantity).toBe(3); // 1 + 2 = 3
    expect(order1001?.totalAmount).toBe(6100); // 2500 + 3600 = 6100
    expect(order1001?.customerName).toBe('Tanvir Ahmed');
    expect(order1001?.courierStatus).toBe('Delivered');
    expect(order1001?.consignmentId).toBe('RD1001A');
    expect(order1001?.collectionType).toBe('REGULAR');
  });

  it('correctly classifies collection type as SELECTS for curated items', () => {
    const groups = groupOrdersByOrderId(mockRows as RawOrderRow[]);
    const order1002 = groups.find((g) => g.orderId === '1002');
    expect(order1002?.collectionType).toBe('SELECTS');
    expect(order1002?.totalQuantity).toBe(1);
    expect(order1002?.totalAmount).toBe(4500);
  });

  it('propagates discrepancies from any line item to the order-level group', () => {
    const groups = groupOrdersByOrderId(mockRows as RawOrderRow[]);
    const order1003 = groups.find((g) => g.orderId === '1003');
    expect(order1003?.hasDiscrepancy).toBe(true);
    expect(order1003?.discrepancyType).toBe('RETURNED_BUT_SHIPPED');
  });

  it('filters order-wise groups by product name inside multi-item basket', () => {
    const groups = groupOrdersByOrderId(mockRows as RawOrderRow[]);

    // Searching for "Oxford" should match Order 1001 because item 2 is an Oxford shirt
    const filteredByOxford = filterOrderWiseGroups(groups, { searchQuery: 'Oxford' });
    expect(filteredByOxford).toHaveLength(1);
    expect(filteredByOxford[0].orderId).toBe('1001');

    // Searching for "Bomber" should match Order 1002
    const filteredByBomber = filterOrderWiseGroups(groups, { searchQuery: 'Bomber' });
    expect(filteredByBomber).toHaveLength(1);
    expect(filteredByBomber[0].orderId).toBe('1002');
  });

  it('filters order-wise groups by category matching any item in the order', () => {
    const groups = groupOrdersByOrderId(mockRows as RawOrderRow[]);

    // Category filter "Jeans" should match Order 1001
    const jeansOrders = filterOrderWiseGroups(groups, { categoryFilter: 'Jeans' });
    expect(jeansOrders.map((o) => o.orderId)).toContain('1001');

    // Category filter "Jacket" should match Order 1002
    const jacketOrders = filterOrderWiseGroups(groups, { categoryFilter: 'Jacket' });
    expect(jacketOrders.map((o) => o.orderId)).toContain('1002');
  });

  it('filters order-wise groups by courier status', () => {
    const groups = groupOrdersByOrderId(mockRows as RawOrderRow[]);

    const deliveredOrders = filterOrderWiseGroups(groups, { courierFilter: 'Delivered' });
    expect(deliveredOrders).toHaveLength(1);
    expect(deliveredOrders[0].orderId).toBe('1001');

    const transitOrders = filterOrderWiseGroups(groups, { courierFilter: 'In Transit' });
    expect(transitOrders).toHaveLength(1);
    expect(transitOrders[0].orderId).toBe('1002');

    const discrepancyOrders = filterOrderWiseGroups(groups, { courierFilter: 'DISCREPANCY_ONLY' });
    expect(discrepancyOrders).toHaveLength(1);
    expect(discrepancyOrders[0].orderId).toBe('1003');
  });

  it('builds an Excel workbook for order-wise consolidated view', () => {
    const groups = groupOrdersByOrderId(mockRows as RawOrderRow[]);
    const mockReport = {
      referenceDate: '2026-10-18',
      exchangeStats: { replacementOrders: [] },
    } as unknown as import('@/lib/liveOpsProcessor').LiveOpsReport;

    const wb = buildOrderWiseWorkbook(groups, mockReport);
    expect(wb.SheetNames).toContain('Shipped Orders (Order-Wise)');
    const sheet = wb.Sheets['Shipped Orders (Order-Wise)'];
    expect(sheet).toBeDefined();
  });

  describe('Branch Suffix & camelCase Normalization Invariants', () => {
    it('decodes Mirpur Outlet branch suffix "m" and groups properly', () => {
      const mirpurRows = [
        {
          orderId: '17263 m',
          quantity: 2,
          price: 1500,
          customerName: 'Mirpur Shopper',
          phone: '01712345678',
          deliveryStatus: 'Delivered',
        } as any,
      ];

      const groups = groupOrdersByOrderId(mirpurRows);
      expect(groups).toHaveLength(1);
      expect(groups[0].baseOrderId).toBe('17263');
      expect(groups[0].branch.isBranchFulfillment).toBe(true);
      expect(groups[0].branch.branchCode).toBe('MIRPUR');
      expect(groups[0].totalAmount).toBe(3000); // 2 * 1500
      expect(groups[0].totalQuantity).toBe(2);
    });

    it('correctly aggregates camelCase properties (qty, itemCost, orderAmount)', () => {
      const camelRows = [
        {
          orderId: '5501',
          qty: 3,
          itemCost: 800,
          total: 2400,
          customerName: 'Sajidul Islam',
          phone: '01812345678',
          status: 'shipped',
        } as any,
      ];

      const groups = groupOrdersByOrderId(camelRows);
      expect(groups).toHaveLength(1);
      expect(groups[0].totalQuantity).toBe(3);
      expect(groups[0].totalAmount).toBe(2400);
    });
  });

  describe('Channel Filtering (Online Checkout vs POS vs All)', () => {
    const mixedRows = [
      // Online web checkout order
      {
        orderId: '8001',
        'Order ID': '8001',
        'Item Name': 'DEEN Polo Shirt',
        Quantity: 1,
        'Item Cost': 1200,
        'Order Amount': 1200,
        'Payment Method': 'bKash',
        'Consignment ID': 'PTC-9901',
        'Created Via': 'checkout',
      } as unknown as RawOrderRow,
      // Physical walk-in POS order
      {
        orderId: '9001',
        'Order ID': '9001',
        'Item Name': 'DEEN Casual Trouser',
        Quantity: 2,
        'Item Cost': 1500,
        'Order Amount': 3000,
        'Order Source': 'POS',
        'Created Via': 'pos',
        isPos: true,
      } as unknown as RawOrderRow,
    ];

    it('identifies isPos and isOnline accurately during grouping', () => {
      const groups = groupOrdersByOrderId(mixedRows);
      expect(groups).toHaveLength(2);

      const onlineGroup = groups.find((g) => g.orderId === '8001');
      const posGroup = groups.find((g) => g.orderId === '9001');

      expect(onlineGroup?.isOnline).toBe(true);
      expect(onlineGroup?.isPos).toBe(false);

      expect(posGroup?.isOnline).toBe(false);
      expect(posGroup?.isPos).toBe(true);
    });

    it('filters strictly to ONLINE orders by default or when channelFilter is ONLINE', () => {
      const groups = groupOrdersByOrderId(mixedRows);

      // Default (no channelFilter option)
      const defaultFiltered = filterOrderWiseGroups(groups);
      expect(defaultFiltered).toHaveLength(1);
      expect(defaultFiltered[0].orderId).toBe('8001');

      // Explicit ONLINE
      const onlineFiltered = filterOrderWiseGroups(groups, { channelFilter: 'ONLINE' });
      expect(onlineFiltered).toHaveLength(1);
      expect(onlineFiltered[0].orderId).toBe('8001');
    });

    it('filters strictly to POS orders when channelFilter is POS', () => {
      const groups = groupOrdersByOrderId(mixedRows);
      const posFiltered = filterOrderWiseGroups(groups, { channelFilter: 'POS' });
      expect(posFiltered).toHaveLength(1);
      expect(posFiltered[0].orderId).toBe('9001');
      expect(posFiltered[0].isPos).toBe(true);
    });

    it('returns both ONLINE and POS orders when channelFilter is ALL', () => {
      const groups = groupOrdersByOrderId(mixedRows);
      const allFiltered = filterOrderWiseGroups(groups, { channelFilter: 'ALL' });
      expect(allFiltered).toHaveLength(2);
      expect(allFiltered.map((g) => g.orderId).sort()).toEqual(['8001', '9001']);
    });
  });
});

