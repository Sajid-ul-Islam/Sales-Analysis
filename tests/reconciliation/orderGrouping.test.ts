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

  it('attaches SIP inventory source to each line item in OrderWiseGroup', () => {
    const splitRows: Partial<RawOrderRow>[] = [
      {
        'Order ID': '2001',
        orderId: '2001',
        'Customer Name': 'Zubair',
        'Item Name': 'Warehouse Denim',
        SKU: 'WH-01',
        Quantity: 1,
        'Item Cost': 2000,
        'Order Amount': 2000,
        sipInventory: 'Central Warehouse',
        sipOutletId: '1',
        branchCode: 'ONLINE',
      },
      {
        'Order ID': '2001',
        orderId: '2001',
        'Customer Name': 'Zubair',
        'Item Name': 'Cumilla Shirt',
        SKU: 'CU-02',
        Quantity: 1,
        'Item Cost': 1500,
        'Order Amount': 1500,
        sipInventory: 'Cumilla Branch',
        sipOutletId: '7',
        branchCode: 'CUMILLA',
      },
    ];

    const groups = groupOrdersByOrderId(splitRows as RawOrderRow[]);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.items).toHaveLength(2);

    expect(g.items[0].sipInventory).toBe('Central Warehouse');
    expect(g.items[0].branchCode).toBe('ONLINE');
    expect(g.items[0].sipOutletId).toBe('1');

    expect(g.items[1].sipInventory).toBe('Cumilla Branch');
    expect(g.items[1].branchCode).toBe('CUMILLA');
    expect(g.items[1].sipOutletId).toBe('7');

    // Searching for "Cumilla" matches order because of the item SIP inventory
    const filteredBySip = filterOrderWiseGroups(groups, { searchQuery: 'Cumilla' });
    expect(filteredBySip).toHaveLength(1);
    expect(filteredBySip[0].orderId).toBe('2001');
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

    it('strictly isolates online checkout orders from outlet branch register orders (m, c, w, s)', () => {
      const outletRows: Partial<RawOrderRow>[] = [
        {
          orderId: '17263',
          'Order ID': '17263',
          'Item Name': 'Central Warehouse Tee',
          'Created Via': 'checkout',
          Quantity: 1,
          'Order Amount': 1200,
        },
        {
          orderId: '17264 m',
          'Order ID': '17264 m',
          'Item Name': 'Mirpur Outlet Polo',
          outletId: '1',
          'Payment Method': 'bKash', // Counter bKash payment at outlet
          Quantity: 1,
          'Order Amount': 1500,
        },
        {
          orderId: '17265 c',
          'Order ID': '17265 c',
          'Item Name': 'Cumilla Branch Denim',
          outletId: '2',
          Quantity: 1,
          'Order Amount': 2500,
        },
        {
          orderId: '17266 w',
          'Order ID': '17266 w',
          'Item Name': 'Wari Branch Hoodie',
          outletId: '9',
          Quantity: 1,
          'Order Amount': 2200,
        },
        {
          orderId: '17267 s',
          'Order ID': '17267 s',
          'Item Name': 'Sylhet Branch Shirt',
          outletId: '7',
          Quantity: 1,
          'Order Amount': 1800,
        },
      ];

      const groups = groupOrdersByOrderId(outletRows as RawOrderRow[]);
      expect(groups).toHaveLength(5);

      // Online checkout filter must ONLY contain genuine central checkout order (17263)
      const onlineOnly = filterOrderWiseGroups(groups, { channelFilter: 'ONLINE' });
      expect(onlineOnly).toHaveLength(1);
      expect(onlineOnly[0].orderId).toBe('17263');

      // Outlet filter must contain all 4 outlet store orders
      const outletAll = filterOrderWiseGroups(groups, { channelFilter: 'POS', posBranchFilter: 'ALL' });
      expect(outletAll).toHaveLength(4);
      expect(outletAll.map((g) => g.orderId)).toEqual(['17264 m', '17265 c', '17266 w', '17267 s']);

      // Branch-specific filters
      const mirpurOnly = filterOrderWiseGroups(groups, { channelFilter: 'POS', posBranchFilter: 'MIRPUR' });
      expect(mirpurOnly).toHaveLength(1);
      expect(mirpurOnly[0].orderId).toBe('17264 m');

      const cumillaOnly = filterOrderWiseGroups(groups, { channelFilter: 'POS', posBranchFilter: 'CUMILLA' });
      expect(cumillaOnly).toHaveLength(1);
      expect(cumillaOnly[0].orderId).toBe('17265 c');

      const wariOnly = filterOrderWiseGroups(groups, { channelFilter: 'POS', posBranchFilter: 'WARI' });
      expect(wariOnly).toHaveLength(1);
      expect(wariOnly[0].orderId).toBe('17266 w');

      const sylhetOnly = filterOrderWiseGroups(groups, { channelFilter: 'POS', posBranchFilter: 'SYLHET' });
      expect(sylhetOnly).toHaveLength(1);
      expect(sylhetOnly[0].orderId).toBe('17267 s');

      // ALL channel filter must contain all 5 orders (all outlet orders + online checkout)
      const allChannels = filterOrderWiseGroups(groups, { channelFilter: 'ALL' });
      expect(allChannels).toHaveLength(5);
    });

    it('excludes outlet orders whose payment method is ecom from OUTLET filter and includes them in ECOMMERCE filter without duplication in Ecommerce + Outlet', () => {
      const mixedRows: Partial<RawOrderRow>[] = [
        // 1. Genuine online checkout order
        {
          orderId: '2001',
          'Order ID': '2001',
          'Item Name': 'Ecommerce Regular Tee',
          'Payment Method': 'cod',
          Quantity: 1,
          'Order Amount': 1200,
        },
        // 2. Genuine outlet in-store order (cash / register)
        {
          orderId: '2002 m',
          'Order ID': '2002 m',
          'Item Name': 'Mirpur Outlet Walk-in Pants',
          outletId: '1',
          'Payment Method': 'cash',
          Quantity: 1,
          'Order Amount': 2200,
        },
        // 3. Outlet order whose payment method is ecom (dispatched from outlet for ecom order)
        {
          orderId: '2003 m',
          'Order ID': '2003 m',
          'Item Name': 'Mirpur Outlet Ecom Dispatch Polo',
          outletId: '1',
          'Payment Method': 'ecom',
          Quantity: 1,
          'Order Amount': 1800,
        },
      ];

      const groups = groupOrdersByOrderId(mixedRows as RawOrderRow[]);
      expect(groups).toHaveLength(3);

      const order2001 = groups.find((g) => g.orderId === '2001');
      const order2002 = groups.find((g) => g.orderId === '2002 m');
      const order2003 = groups.find((g) => g.orderId === '2003 m');

      expect(order2001?.isEcommerce).toBe(true);
      expect(order2001?.isOutlet).toBe(false);

      expect(order2002?.isEcommerce).toBe(false);
      expect(order2002?.isOutlet).toBe(true);

      // Order 2003 m has paymentMethod: 'ecom' -> must be isEcommerce: false, isOutlet: false
      // User rule: Outlet ecom dispatches are excluded from outlet (not a walk-in sale) and not included in ecom (already counted sold)
      expect(order2003?.isEcommerce).toBe(false);
      expect(order2003?.isOutlet).toBe(false);

      // ECOMMERCE filter must ONLY include genuine web checkout order 2001 (excluding outlet ecom dispatch 2003 m)
      const ecomOrders = filterOrderWiseGroups(groups, { channelFilter: 'ECOMMERCE' });
      expect(ecomOrders.map((g) => g.orderId)).toEqual(['2001']);

      // OUTLET filter must EXCLUDE 2003 m (ecom payment method) and ONLY contain genuine outlet order 2002 m
      const outletOrders = filterOrderWiseGroups(groups, { channelFilter: 'OUTLET' });
      expect(outletOrders.map((g) => g.orderId)).toEqual(['2002 m']);

      // Ecommerce + Outlet (ALL / Both) contains genuine ecom + genuine outlet (2001, 2002 m), excluding 2003 m
      const allOrders = filterOrderWiseGroups(groups, { channelFilter: 'ALL' });
      expect(allOrders).toHaveLength(2);
      expect(allOrders.map((g) => g.orderId)).toEqual(['2001', '2002 m']);
    });
  });
});

