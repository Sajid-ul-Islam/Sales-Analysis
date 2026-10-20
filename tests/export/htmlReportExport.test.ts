import { describe, it, expect } from 'vitest';
import { generateLiveOpsHtmlReport, downloadLiveOpsHtmlReport } from '@/lib/htmlReportExport';
import { LiveOpsReport } from '@/lib/liveOpsProcessor';
import { OrderWiseGroup } from '@/lib/orderGrouping';

function createMockReport(): LiveOpsReport {
  return {
    selectedView: 'Today Shipped',
    referenceDate: '2026-10-18',
    anchorDate: '2026-10-18',
    todayIso: '2026-10-18',
    comparisonDate: '2026-10-17',
    refDayName: 'Sunday',
    prevDayName: 'Saturday',
    isFallbackDate: false,
    shippedItems: {
      value: 142,
      rawValue: 142,
      prevValue: 124,
      rawPrevValue: 124,
      prevDayName: 'Saturday',
      deltaAbs: 18,
      deltaPercent: 14.5,
      deltaFormatted: '+14.5%',
      isPositive: true,
      sparkline: [120, 126, 132, 129, 139, 124, 142],
    },
    salesRevenue: {
      value: 185600,
      rawValue: 185600,
      prevValue: 164100,
      rawPrevValue: 164100,
      prevDayName: 'Saturday',
      deltaAbs: 21500,
      deltaPercent: 13.1,
      deltaFormatted: '+13.1%',
      isPositive: true,
      sparkline: [154000, 162000, 171000, 168000, 182000, 164100, 185600],
    },
    shippedOrders: {
      value: 86,
      rawValue: 86,
      prevValue: 78,
      rawPrevValue: 78,
      prevDayName: 'Saturday',
      deltaAbs: 8,
      deltaPercent: 10.3,
      deltaFormatted: '+10.3%',
      isPositive: true,
      sparkline: [74, 78, 81, 79, 85, 78, 86],
    },
    basketSize: {
      value: 1.65,
      rawValue: 1.65,
      prevValue: 1.59,
      rawPrevValue: 1.59,
      prevDayName: 'Saturday',
      deltaAbs: 0.06,
      deltaPercent: 3.8,
      deltaFormatted: '+3.8%',
      isPositive: true,
      sparkline: [1.6, 1.6, 1.6, 1.6, 1.6, 1.6, 1.65],
    },
    customerMix: {
      newCount: 58,
      retCount: 28,
      newPercent: 68,
      retPercent: 32,
      prevNew: 50,
      prevRet: 25,
      prevDayName: 'Saturday',
      deltaNew: 8,
      deltaNewPercent: 16,
      sparkline: [50, 52, 55, 54, 58],
    },
    last7DaysHistory: [
      { dateIso: '2026-10-12', dateLabel: '12 Oct', dayName: 'Monday', revenue: 154000, orderCount: 74, itemCount: 120, aov: 2081, isToday: false, isPrevDay: false, orders: [] },
      { dateIso: '2026-10-13', dateLabel: '13 Oct', dayName: 'Tuesday', revenue: 162000, orderCount: 78, itemCount: 126, aov: 2076, isToday: false, isPrevDay: false, orders: [] },
      { dateIso: '2026-10-14', dateLabel: '14 Oct', dayName: 'Wednesday', revenue: 171000, orderCount: 81, itemCount: 132, aov: 2111, isToday: false, isPrevDay: false, orders: [] },
      { dateIso: '2026-10-15', dateLabel: '15 Oct', dayName: 'Thursday', revenue: 168000, orderCount: 79, itemCount: 129, aov: 2126, isToday: false, isPrevDay: false, orders: [] },
      { dateIso: '2026-10-16', dateLabel: '16 Oct', dayName: 'Friday', revenue: 182000, orderCount: 85, itemCount: 139, aov: 2141, isToday: false, isPrevDay: false, orders: [] },
      { dateIso: '2026-10-17', dateLabel: '17 Oct', dayName: 'Saturday', revenue: 164100, orderCount: 78, itemCount: 124, aov: 2103, isToday: false, isPrevDay: true, orders: [] },
      { dateIso: '2026-10-18', dateLabel: '18 Oct', dayName: 'Sunday', revenue: 185600, orderCount: 86, itemCount: 142, aov: 2158, isToday: true, isPrevDay: false, orders: [] },
    ],
    executiveBriefing: {
      dateIso: '2026-10-18',
      dateFormatted: 'Sunday, 18 Oct 2026',
      totalOrders: 86,
      totalItems: 142,
      totalRevenue: 185600,
      aov: 2158,
      vs7dRevenuePct: 9.4,
      vs7dVolumePct: 7.5,
      topCategory: { name: 'Jeans', volume: 40, revenue: 77952 },
      topProduct: { name: 'Raw Indigo Selvedge Jeans', units: 34, revenue: 64600 },
      selectsSharePct: 42,
      newCustomerPct: 68,
      summaryPoints: [
        'Dispatched 86 unique orders (142 pcs) generating ৳185,600 net sales.',
        'DEEN Selects jeans represented 42% of revenue with 0 courier delivery discrepancies.',
        'Pathao courier handover confirmed for 82 out of 86 orders (95.3% handover rate).',
      ],
      clipboardText: 'Sunday Briefing...',
    },
    avg7dMetrics: {
      items: 130,
      orders: 80,
      revenue: 169600,
      aov: 2120,
      newCustomerPct: 65,
    },
    todaysOrdersBreakdown: {
      processingCount: 14,
      processingAmount: 28000,
      holdCount: 2,
      holdAmount: 4500,
      todayShippedCount: 86,
      todayShippedAmount: 185600,
      totalActiveCount: 102,
      totalActiveAmount: 218100,
    },
    allOrdersBreakdown: {
      processingCount: 14,
      processingAmount: 28000,
      holdCount: 2,
      holdAmount: 4500,
      todayShippedCount: 86,
      todayShippedAmount: 185600,
      totalActiveCount: 102,
      totalActiveAmount: 218100,
    },
    topProducts: [
      { rank: 1, productName: 'Raw Indigo Selvedge Jeans', sku: 'DN-RAW-01', category: 'Jeans', subCategory: 'Selvedge', unitsSold: 34, revenue: 64600, revenueShare: 34.8, orderCount: 28, isSelects: true, velocityScore: 'HOT' },
      { rank: 2, productName: 'Urban Slim Comfort Chino', sku: 'DN-CHN-02', category: 'Twill', subCategory: 'Chinos', unitsSold: 26, revenue: 39000, revenueShare: 21.0, orderCount: 22, isSelects: false, velocityScore: 'FAST' },
      { rank: 3, productName: 'Oxford Classic Shirt', sku: 'DN-OXF-03', category: 'Casual', subCategory: 'Oxford', unitsSold: 18, revenue: 27000, revenueShare: 14.5, orderCount: 15, isSelects: false, velocityScore: 'STEADY' },
    ],
    selectsStats: {
      selectsRevenue: 77952,
      regularRevenue: 107648,
      totalRevenue: 185600,
      selectsRevShare: 42,
      regularRevShare: 58,
      selectsQty: 36,
      regularQty: 50,
      totalQty: 86,
      selectsQtyShare: 42,
      regularQtyShare: 58,
    },
    categoryItems: [
      { name: 'Jeans', displayName: 'Jeans', revenue: 77952, volume: 40, selectsVolume: 20, regularVolume: 20, selectsRevenue: 40000, regularRevenue: 37952, avgUnitPrice: 1948, revenueShare: 42, color: '#f43f5e' },
      { name: 'Twill', displayName: 'Twill', revenue: 44544, volume: 28, selectsVolume: 0, regularVolume: 28, selectsRevenue: 0, regularRevenue: 44544, avgUnitPrice: 1590, revenueShare: 24, color: '#f97316' },
      { name: 'Casual', displayName: 'Casual', revenue: 33408, volume: 22, selectsVolume: 0, regularVolume: 22, selectsRevenue: 0, regularRevenue: 33408, avgUnitPrice: 1518, revenueShare: 18, color: '#a855f7' },
      { name: 'Polo', displayName: 'Polo', revenue: 29696, volume: 18, selectsVolume: 0, regularVolume: 18, selectsRevenue: 0, regularRevenue: 29696, avgUnitPrice: 1649, revenueShare: 16, color: '#6366f1' },
    ],
    subCategoryItems: [],
    avgUnitsSold: 1.65,
    activeOrders: [
      {
        'Order ID': '20101',
        'Order Date': '2026-10-18 11:20',
        'Customer Name': 'Tanvir Ahmed',
        Phone: '01711223344',
        'Item Name': 'Raw Indigo Selvedge Jeans',
        Quantity: 2,
        'Item Cost': 1900,
        'Order Amount': 3800,
        'Delivery Status': 'completed',
        'Courier Status': 'Delivered',
        'Consignment ID': 'PTC-88123',
      },
    ],
    totalDispatchedItems: 142,
    totalUniqueOrders: 86,
    exchangeStats: {
      count: 2,
      itemsCount: 2,
      revenue: 3800,
      orders: [],
      replacementOrders: [],
      originalExchangedOrders: [],
    },
  };
}

describe('HTML Report Exporter (htmlReportExport)', () => {
  it('generates a valid standalone HTML5 document', () => {
    const report = createMockReport();
    const html = generateLiveOpsHtmlReport(report);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('DEEN Operations &amp; Dispatch Report');
    expect(html).toContain('2026-10-18');
    expect(html).toContain('Sunday');
  });

  it('renders all 6 KPI cards with accurate values and change indicators', () => {
    const report = createMockReport();
    const html = generateLiveOpsHtmlReport(report);

    // KPI 1: Shipped Items
    expect(html).toContain('Shipped Items');
    expect(html).toContain('142');
    expect(html).toContain('130 pcs/day');

    // KPI 2: Sales Revenue
    expect(html).toContain('Sales Revenue');
    expect(html).toContain('৳185,600');

    // KPI 3: Dispatched Orders
    expect(html).toContain('Dispatched Orders');
    expect(html).toContain('86');

    // KPI 4: Basket Size
    expect(html).toContain('Basket Size');
    expect(html).toContain('1.6');

    // KPI 5: Customer Mix
    expect(html).toContain('Customer Mix');
    expect(html).toContain('68%');

    // KPI 6: Selects Collection
    expect(html).toContain('Selects Collection');
    expect(html).toContain('42%');
  });

  it('renders pure vector SVG Donut Chart and Category Volume Icon Bar Chart', () => {
    const report = createMockReport();
    const html = generateLiveOpsHtmlReport(report);

    // Donut chart SVG
    expect(html).toContain('<svg');
    expect(html).toContain('class="donut-chart"');
    expect(html).toContain('NET REVENUE');
    expect(html).toContain('৳185,600');

    // Category volume icon bar chart SVG
    expect(html).toContain('class="volume-bar-chart"');
    expect(html).toContain('Sales Volume by Category (Units Sold)');
    expect(html).toContain('40 pcs');
    expect(html).toContain('👖');
    expect(html).not.toContain('class="trend-chart"');
  });

  it('renders courier delivery telemetry progress bar', () => {
    const report = createMockReport();
    const html = generateLiveOpsHtmlReport(report);

    expect(html).toContain('courier-bar');
    expect(html).toContain('Delivered:');
    expect(html).toContain('In Transit:');
  });

  it('renders executive briefing bullet points', () => {
    const report = createMockReport();
    const html = generateLiveOpsHtmlReport(report);

    expect(html).toContain('Executive Operational Briefing');
    expect(html).toContain('Dispatched 86 unique orders (142 pcs)');
    expect(html).toContain('DEEN Selects jeans represented 42% of revenue');
  });

  it('renders top fast-moving products table', () => {
    const report = createMockReport();
    const html = generateLiveOpsHtmlReport(report);

    expect(html).toContain('Top 10 Fast-Moving Products');
    expect(html).toContain('Raw Indigo Selvedge Jeans');
    expect(html).toContain('DN-RAW-01');
    expect(html).toContain('৳64,600');
  });

  it('renders orders ledger when orderWiseGroups are provided', () => {
    const report = createMockReport();
    const mockGroups: OrderWiseGroup[] = [
      {
        orderId: '20101',
        baseOrderId: '20101',
        orderDate: '2026-10-18 11:20',
        customerName: 'Tanvir Ahmed',
        phone: '01711223344',
        city: 'Dhaka',
        wcStatus: 'completed',
        courierStatus: 'Delivered',
        consignmentId: 'PTC-88123',
        consignmentIds: ['PTC-88123'],
        items: [
          {
            itemName: 'Raw Indigo Selvedge Jeans',
            sku: 'DN-RAW-01',
            category: 'Jeans',
            quantity: 2,
            itemCost: 1900,
            amount: 3800,
            isSelects: true,
            subCategory: 'Selvedge',
            row: report.activeOrders[0],
          },
        ],
        totalQuantity: 2,
        totalAmount: 3800,
        collectionType: 'SELECTS',
        hasDiscrepancy: false,
        branch: {
          isBranchFulfillment: false,
          branchName: 'Online Central Warehouse',
          branchCode: 'ONLINE',
          baseOrderId: '20101',
        },
        isExchange: false,
        exchangeInfo: {
          isExchange: false,
          type: 'general_exchange',
          referencedOrderId: null,
          displayTag: '',
        },
        primaryRow: report.activeOrders[0],
        rawRows: report.activeOrders,
      },
    ];

    const html = generateLiveOpsHtmlReport(report, {
      includeOrdersTable: true,
      orderWiseGroups: mockGroups,
    });

    expect(html).toContain('Dispatched Orders Ledger');
    expect(html).toContain('#20101');
    expect(html).toContain('Tanvir Ahmed');
    expect(html).toContain('PTC-88123');
    expect(html).toContain('৳3,800');
  });

  it('escapes potentially dangerous HTML characters to prevent XSS injection', () => {
    const report = createMockReport();
    report.referenceDate = '2026-10-18"><script>alert(1)</script>';
    report.topProducts[0].productName = 'Jeans <img src=x onerror=alert(2)>';

    const html = generateLiveOpsHtmlReport(report);

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(2)>');
    expect(html).toContain('&lt;img src=x onerror=alert(2)&gt;');
  });

  it('safely handles downloadLiveOpsHtmlReport in Node/SSR environment without throwing', () => {
    const report = createMockReport();
    expect(() => downloadLiveOpsHtmlReport(report)).not.toThrow();
  });
});
