import { describe, it, expect } from 'vitest';
import { classifyProductLine, computeSelectsStats } from '@/lib/selectsAnalytics';
import { getCategoryForSales, getSubCategoryForSales, getShortCategoryLabel, getShortSubCategoryLabel } from '@/lib/liveCategoryEngine';
import {
  getPreviousWorkingDay,
  processLiveOpsData,
  formatBangladeshPhoneNumber,
  generateWhatsAppConfirmationUrl,
  isOrderExchange,
  extractExchangeInfo,
} from '@/lib/liveOpsProcessor';
import { RawOrderRow } from '@/types';
import { normalizePhone, normalizeEmail, normalizeName, normalizeCity } from '@/lib/customerRegistry';
import * as XLSX from 'xlsx';
import { buildLiveShippedOrdersWorkbook } from '@/lib/excelExport';
import { computeDynamicYAxis } from '@/lib/liveOpsProcessor';

describe('Live Operations & Shipped Orders Engine (DEEN-OPS Specification)', () => {
  describe('DEEN Selects vs DEEN Regular Classification', () => {
    it('classifies items containing DEEN brand tag as DEEN Regular', () => {
      expect(classifyProductLine('DEEN High-End Jeans - Indigo', 'SKU-REG-101')).toBe('DEEN Regular');
      expect(classifyProductLine('DEEN Signature Oxford Shirt', 'SKU-REG-102')).toBe('DEEN Regular');
      expect(classifyProductLine('DEEN Teal Trousers', 'SKU-REG-103')).toBe('DEEN Regular');
    });

    it('classifies curated third-party brands and non-DEEN products as DEEN Selects', () => {
      expect(classifyProductLine('ZARA Quilted Jacket', 'SKU-SEL-201')).toBe('DEEN Selects');
      expect(classifyProductLine('Calvin Klein Jeans Slim Fit', 'SKU-SEL-202')).toBe('DEEN Selects');
      expect(classifyProductLine('4F Active T-Shirt', 'SKU-SEL-203')).toBe('DEEN Selects');
      expect(classifyProductLine('Pull & Bear Classic Tee', 'SKU-SEL-204')).toBe('DEEN Selects');
    });

    it('classifies explicit Selects keyword or SKU prefix as DEEN Selects', () => {
      expect(classifyProductLine('DEEN Selects Silk Panjabi', 'DS-901-BLU')).toBe('DEEN Selects');
      expect(classifyProductLine('Regular Shirt', 'SEL-8821')).toBe('DEEN Selects');
    });

    it('correctly calculates selects vs regular revenue and volume shares', () => {
      const items = [
        { itemName: 'DEEN High-End Jeans', sku: 'SKU-1', quantity: 2, itemCost: 2000, amount: 4000 },
        { itemName: 'ZARA Quilted Jacket', sku: 'SEL-1', quantity: 1, itemCost: 6000, amount: 6000 },
      ];

      const stats = computeSelectsStats(items);
      expect(stats.totalRevenue).toBe(10000);
      expect(stats.regularRevenue).toBe(4000);
      expect(stats.selectsRevenue).toBe(6000);
      expect(stats.selectsRevShare).toBe(60);
      expect(stats.regularRevShare).toBe(40);
      expect(stats.totalQty).toBe(3);
      expect(stats.regularQty).toBe(2);
      expect(stats.selectsQty).toBe(1);
    });
  });

  describe('Category and Sub-Category Engine', () => {
    it('maps items to canonical DEEN categories', () => {
      expect(getCategoryForSales('Slim Fit Stretch Jeans')).toBe('Jeans');
      expect(getCategoryForSales('Mens Twill Five Pocket Pant')).toBe('Twill');
      expect(getCategoryForSales('Classic Polo Shirt Navy')).toBe('Polo');
      expect(getCategoryForSales('Heavyweight Winter Hoodie')).toBe('Hoodie');
      expect(getCategoryForSales('Casual Full Sleeve Shirt')).toBe('FS Shirt');
      expect(getCategoryForSales('Cuban Half Sleeve Shirt')).toBe('HS Shirt');
    });

    it('extracts granular sub-categories', () => {
      expect(getSubCategoryForSales('Classic Regular Jeans', 'Jeans')).toBe('Regular Fit Jeans');
      expect(getSubCategoryForSales('Indigo Slim Fit Jeans', 'Jeans')).toBe('Slim Fit Jeans');
      expect(getSubCategoryForSales('Vintage Denim Jacket', 'Jacket')).toBe('Denim Jacket');
    });

    it('extracts short concise category labels for charts', () => {
      expect(getShortCategoryLabel('Denim Jacket Winter Edition')).toBe('Denim Jacket');
      expect(getShortCategoryLabel('Twill Five Pockets Casual')).toBe('Twill');
      expect(getShortCategoryLabel('FS Shirt - Formal Executive')).toBe('Formal');
    });

    it('differentiates main category names and sub-category names for charts and filters', () => {
      // Main category: Jeans -> Sub categories: Regular Fit, Slim Fit, Straight Fit
      expect(getCategoryForSales('Classic Regular Jeans')).toBe('Jeans');
      expect(getShortSubCategoryLabel(getSubCategoryForSales('Classic Regular Jeans', 'Jeans'))).toBe('Regular Fit');

      expect(getCategoryForSales('Indigo Slim Fit Jeans')).toBe('Jeans');
      expect(getShortSubCategoryLabel(getSubCategoryForSales('Indigo Slim Fit Jeans', 'Jeans'))).toBe('Slim Fit');

      expect(getCategoryForSales('Straight Cut Denim Jeans')).toBe('Jeans');
      expect(getShortSubCategoryLabel(getSubCategoryForSales('Straight Cut Denim Jeans', 'Jeans'))).toBe('Straight Fit');

      // Twill: 5-Pocket Twill vs Twill Joggers
      expect(getShortSubCategoryLabel('Twill Five Pockets')).toBe('5-Pocket Twill');
      expect(getShortSubCategoryLabel('Twill Joggers')).toBe('Twill Joggers');

      // Shirts: Flannel vs Oxford vs Cuban
      expect(getShortSubCategoryLabel('Flannel Shirt')).toBe('Flannel');
      expect(getShortSubCategoryLabel('Oxford Shirt')).toBe('Oxford');
      expect(getShortSubCategoryLabel('Cuban Shirt')).toBe('Cuban');
    });
  });

  describe('Bangladesh Operational Working Day Comparisons', () => {
    it('skips Friday (Bangladesh standard weekend) when determining previous working day', () => {
      // Friday 2026-10-16 -> Thursday 2026-10-15
      // Saturday 2026-10-17 -> Thursday 2026-10-15 (skipping Friday)
      const saturday = new Date('2026-10-17T12:00:00Z');
      const prevWorkday = getPreviousWorkingDay(saturday);
      // In JS: Thursday is day 4
      expect(prevWorkday.getDay()).toBe(4);
    });

    it('flags closed Friday (0 dispatches) with isFridayClosed: true and open Friday with false', () => {
      // Reference date: Saturday 2026-10-17
      // Friday was 2026-10-16
      const mockOrders: Partial<RawOrderRow>[] = [
        {
          'Order ID': '9001',
          'Date Modified': '2026-10-17T10:00:00Z',
          'Delivery Status': 'shipped',
          Quantity: 2,
          'Order Amount': 3500,
        },
      ];

      // 1. Case: Friday had 0 dispatches (warehouse closed)
      const reportClosedFriday = processLiveOpsData(mockOrders as RawOrderRow[], {
        view: 'Today Shipped',
        customDate: '2026-10-17',
      });
      const fridaySummaryClosed = reportClosedFriday.last7DaysHistory.find((d) => d.dateIso === '2026-10-16');
      expect(fridaySummaryClosed).toBeDefined();
      expect(fridaySummaryClosed?.dayName).toBe('Friday');
      expect(fridaySummaryClosed?.orderCount).toBe(0);
      expect(fridaySummaryClosed?.isFridayClosed).toBe(true);

      // 2. Case: Special open Friday with shipped parcels
      const mockWithFridayDispatches: Partial<RawOrderRow>[] = [
        ...mockOrders,
        {
          'Order ID': '9002',
          'Date Modified': '2026-10-16T11:00:00Z',
          'Delivery Status': 'shipped',
          Quantity: 10,
          'Order Amount': 15000,
        },
      ];
      const reportOpenFriday = processLiveOpsData(mockWithFridayDispatches as RawOrderRow[], {
        view: 'Today Shipped',
        customDate: '2026-10-17',
      });
      const fridaySummaryOpen = reportOpenFriday.last7DaysHistory.find((d) => d.dateIso === '2026-10-16');
      expect(fridaySummaryOpen).toBeDefined();
      expect(fridaySummaryOpen?.orderCount).toBe(1);
      expect(fridaySummaryOpen?.isFridayClosed).toBe(false);

      // Saturday (non-Friday) is never flagged as closed Friday
      const saturdaySummary = reportOpenFriday.last7DaysHistory.find((d) => d.dateIso === '2026-10-17');
      expect(saturdaySummary?.isFridayClosed).toBe(false);
    });
  });

  describe('Live Operations Processor Synthesis', () => {
    it('synthesizes live operations report with 5 KPI cards, sparklines, and charts', () => {
      const mockOrders: Partial<RawOrderRow>[] = [
        {
          'Order ID': '2001',
          'Order Date': '2026-10-15T10:00:00Z',
          'Date Modified': '2026-10-15T11:00:00Z',
          'Customer Name': 'Tanvir Ahmed',
          Phone: '01711000001',
          'Item Name': 'DEEN Slim Fit Jeans',
          SKU: 'DN-J-01',
          Quantity: 1,
          'Item Cost': 2500,
          'Order Amount': 2500,
          'Delivery Status': 'shipped',
        },
        {
          'Order ID': '2002',
          'Order Date': '2026-10-15T10:30:00Z',
          'Date Modified': '2026-10-15T11:30:00Z',
          'Customer Name': 'Rahim Uddin',
          Phone: '01711000002',
          'Item Name': 'ZARA Quilted Jacket',
          SKU: 'SEL-JK-02',
          Quantity: 2,
          'Item Cost': 4500,
          'Order Amount': 9000,
          'Delivery Status': 'shipped',
        },
      ];

      const report = processLiveOpsData(mockOrders as RawOrderRow[], {
        view: 'Today Shipped',
        onlineOnly: true,
      });

      expect(report.selectedView).toBe('Today Shipped');
      expect(report.shippedItems.rawValue).toBeGreaterThan(0);
      expect(report.salesRevenue.rawValue).toBeGreaterThan(0);
      expect(report.shippedOrders.rawValue).toBeGreaterThan(0);
      expect(report.basketSize.rawValue).toBeGreaterThan(0);
      expect(report.customerMix.newCount + report.customerMix.retCount).toBeGreaterThan(0);
      expect(report.selectsStats).toBeDefined();
      expect(report.categoryItems.length).toBeGreaterThan(0);
    });

    it('preserves courier tracking status and consignment IDs in operational records', () => {
      const mockOrdersWithCourier: Partial<RawOrderRow>[] = [
        {
          'Order ID': '3001',
          'Order Date': '2026-10-15T12:00:00Z',
          'Customer Name': 'Jamal Hossain',
          Phone: '01711000003',
          'Item Name': 'DEEN Twill Five Pocket Pant',
          SKU: 'DN-TW-01',
          Quantity: 1,
          'Item Cost': 2100,
          'Order Amount': 2100,
          'Delivery Status': 'shipped',
          'Courier Status': 'Delivered',
          courierStatus: 'Delivered',
          'Consignment ID': 'RD101010DEMO',
          hasDiscrepancy: false,
        },
      ];

      const report = processLiveOpsData(mockOrdersWithCourier as RawOrderRow[], {
        view: 'All Orders',
      });

      expect(report.activeOrders.length).toBe(1);
      expect(report.activeOrders[0]['Courier Status']).toBe('Delivered');
      expect(report.activeOrders[0]['Consignment ID']).toBe('RD101010DEMO');
    });

    it('enforces All Orders = Processing + Hold + Today Shipped/Completed from checkout/ecom', () => {
      const todayIso = '2026-10-15';
      const mockCheckoutOrders: Partial<RawOrderRow>[] = [
        // 1. Processing order (in fulfillment queue)
        {
          'Order ID': '4001',
          'Order Date': '2026-10-14T18:00:00Z',
          'Customer Name': 'Rahim',
          Phone: '01711000010',
          'Item Name': 'DEEN Polo Navy - M',
          SKU: 'POLO-01',
          Quantity: 1,
          'Item Cost': 1500,
          'Order Amount': 1500,
          'Delivery Status': 'processing',
          'Order Source': 'Online',
        },
        // 2. On-Hold order (awaiting customer confirmation)
        {
          'Order ID': '4002',
          'Order Date': '2026-10-14T20:00:00Z',
          'Customer Name': 'Karim',
          Phone: '01711000020',
          'Item Name': 'DEEN Slim Jeans - 32',
          SKU: 'JEANS-02',
          Quantity: 1,
          'Item Cost': 2600,
          'Order Amount': 2600,
          'Delivery Status': 'on-hold',
          'Order Source': 'Online',
        },
        // 3. Shipped Today (handed over today)
        {
          'Order ID': '4003',
          'Order Date': '2026-10-15T10:00:00Z',
          'Date Modified': '2026-10-15T11:00:00Z',
          'Customer Name': 'Salim',
          Phone: '01711000030',
          'Item Name': 'ZARA Bomber Jacket',
          SKU: 'ZARA-JKT-01',
          Quantity: 1,
          'Item Cost': 5500,
          'Order Amount': 5500,
          'Delivery Status': 'shipped',
          'Order Source': 'Online',
        },
        // 4. Shipped Yesterday (should NOT be in today's shipped portion)
        {
          'Order ID': '4004',
          'Order Date': '2026-10-13T10:00:00Z',
          'Date Modified': '2026-10-14T11:00:00Z',
          'Customer Name': 'Old Shipped Customer',
          Phone: '01711000040',
          'Item Name': 'DEEN T-Shirt',
          SKU: 'TEE-01',
          Quantity: 1,
          'Item Cost': 950,
          'Order Amount': 950,
          'Delivery Status': 'shipped',
          'Order Source': 'Online',
        },
        // 5. Cancelled Order (should be excluded)
        {
          'Order ID': '4005',
          'Order Date': '2026-10-15T09:00:00Z',
          'Customer Name': 'Cancelled Customer',
          Phone: '01711000050',
          'Item Name': 'DEEN Polo',
          SKU: 'POLO-02',
          Quantity: 1,
          'Item Cost': 1500,
          'Order Amount': 1500,
          'Delivery Status': 'cancelled',
          'Order Source': 'Online',
        },
        // 6. POS Order (retail store register, should be excluded if onlineOnly)
        {
          'Order ID': '4006',
          'Order Date': '2026-10-15T12:00:00Z',
          'Customer Name': 'Walk-in Outlet Customer',
          Phone: '01711000060',
          'Item Name': 'DEEN Pants',
          SKU: 'PANT-01',
          Quantity: 1,
          'Item Cost': 2000,
          'Order Amount': 2000,
          'Delivery Status': 'completed',
          'Order Source': 'POS',
          isPos: true,
        },
      ];

      const report = processLiveOpsData(mockCheckoutOrders as RawOrderRow[], {
        view: 'All Orders',
        onlineOnly: true,
        customDate: todayIso,
      });

      // Active orders must contain Today Shipped (4003) + Processing (4001)
      const orderIds = report.activeOrders.map((o) => o['Order ID']);
      expect(orderIds).toContain('4001');
      expect(orderIds).toContain('4003');
      expect(orderIds).not.toContain('4004'); // Old shipped
      expect(orderIds).not.toContain('4005'); // Cancelled
      expect(orderIds).not.toContain('4006'); // POS register

      // Breakdown metrics
      expect(report.allOrdersBreakdown.processingCount).toBe(1);
      expect(report.allOrdersBreakdown.holdCount).toBe(1);
      expect(report.allOrdersBreakdown.todayShippedCount).toBe(1);
      expect(report.allOrdersBreakdown.totalActiveCount).toBe(3);

      // Verify Queue view includes both processing and hold orders
      const queueReport = processLiveOpsData(mockCheckoutOrders as RawOrderRow[], {
        view: 'Queue',
        onlineOnly: true,
      });
      const queueIds = queueReport.activeOrders.map((o) => o['Order ID']);
      expect(queueIds).toContain('4001'); // Processing in queue
      expect(queueIds).toContain('4002'); // Hold in queue
      expect(queueIds).not.toContain('4003'); // Shipped not in queue
    });

    it('enforces Today\'s Orders = orders shipped today + orders with status Processing', () => {
      const todayIso = '2026-10-15';
      const mockTodayOrders: Partial<RawOrderRow>[] = [
        {
          'Order ID': '6001',
          'Order Date': '2026-10-15T09:00:00Z',
          'Date Modified': '2026-10-15T10:00:00Z',
          'Customer Name': 'Shipped Today Customer',
          Phone: '01711223344',
          'Item Name': 'DEEN Slim Fit Jeans',
          SKU: 'DN-J-01',
          Quantity: 2,
          'Item Cost': 2500,
          'Order Amount': 5000,
          'Delivery Status': 'shipped',
        },
        {
          'Order ID': '6002',
          'Order Date': '2026-10-14T22:00:00Z',
          'Customer Name': 'Processing Queue Customer',
          Phone: '01711223355',
          'Item Name': 'DEEN Twill Five Pocket Pant',
          SKU: 'DN-TW-01',
          Quantity: 1,
          'Item Cost': 2000,
          'Order Amount': 2000,
          'Delivery Status': 'processing',
        },
        {
          'Order ID': '6003',
          'Order Date': '2026-10-15T11:00:00Z',
          'Customer Name': 'On-Hold Customer',
          Phone: '01711223366',
          'Item Name': 'ZARA Bomber Jacket',
          SKU: 'ZARA-JK-01',
          Quantity: 1,
          'Item Cost': 6000,
          'Order Amount': 6000,
          'Delivery Status': 'on-hold',
        },
        {
          'Order ID': '6004',
          'Order Date': '2026-10-14T10:00:00Z',
          'Date Modified': '2026-10-14T12:00:00Z',
          'Customer Name': 'Yesterday Shipped',
          Phone: '01711223377',
          'Item Name': 'DEEN Polo',
          SKU: 'DN-POLO-01',
          Quantity: 1,
          'Item Cost': 1200,
          'Order Amount': 1200,
          'Delivery Status': 'shipped',
        },
        {
          'Order ID': '6005',
          'Order Date': '2026-10-15T08:00:00Z',
          'Customer Name': 'Cancelled Order',
          Phone: '01711223388',
          'Item Name': 'DEEN T-Shirt',
          SKU: 'DN-TEE-01',
          Quantity: 1,
          'Item Cost': 800,
          'Order Amount': 800,
          'Delivery Status': 'cancelled',
        },
      ];

      const report = processLiveOpsData(mockTodayOrders as RawOrderRow[], {
        view: "Today's Orders",
        onlineOnly: true,
        customDate: todayIso,
      });

      expect(report.selectedView).toBe("Today's Orders");
      const activeIds = report.activeOrders.map((o) => o['Order ID']);
      // Must contain Shipped Today (6001) and Processing (6002)
      expect(activeIds).toContain('6001');
      expect(activeIds).toContain('6002');
      // Must exclude on-hold (6003 in queue), yesterday shipped (6004), and cancelled (6005)
      expect(activeIds).not.toContain('6003');
      expect(activeIds).not.toContain('6004');
      expect(activeIds).not.toContain('6005');

      // Total orders count = 2 (shipped today + processing)
      expect(report.totalUniqueOrders).toBe(2);
      // Total items count = 2 (jeans) + 1 (pant) = 3
      expect(report.totalDispatchedItems).toBe(3);
      // Revenue = 5000 + 2000 = 7000
      expect(report.salesRevenue.rawValue).toBe(7000);
      expect(report.todaysOrdersBreakdown.processingCount).toBe(1);
      expect(report.todaysOrdersBreakdown.holdCount).toBe(1);
      expect(report.todaysOrdersBreakdown.todayShippedCount).toBe(1);
    });

    it('generates 7-day rolling history, strictly integer 7-day averages, and executive briefing', () => {
      const todayIso = '2026-10-15';
      const mockHistoricalOrders: Partial<RawOrderRow>[] = [
        {
          'Order ID': '7001',
          'Date Modified': '2026-10-15T10:00:00Z',
          'Delivery Status': 'shipped',
          Quantity: 3,
          'Order Amount': 6000,
          'Order Source': 'Online',
        },
        {
          'Order ID': '7002',
          'Date Modified': '2026-10-14T10:00:00Z',
          'Delivery Status': 'completed',
          Quantity: 2,
          'Order Amount': 4000,
          'Order Source': 'Online',
        },
        {
          'Order ID': '7003',
          'Date Modified': '2026-10-13T10:00:00Z',
          'Delivery Status': 'delivered',
          Quantity: 1,
          'Order Amount': 2000,
          'Order Source': 'Online',
        },
      ];

      const report = processLiveOpsData(mockHistoricalOrders as RawOrderRow[], {
        view: 'Today Shipped',
        customDate: todayIso,
      });

      // 7-day history length
      expect(report.last7DaysHistory.length).toBe(7);

      // Verify strict integer averages
      expect(Number.isInteger(report.avg7dMetrics.items)).toBe(true);
      expect(Number.isInteger(report.avg7dMetrics.orders)).toBe(true);
      expect(Number.isInteger(report.avg7dMetrics.revenue)).toBe(true);
      expect(Number.isInteger(report.avg7dMetrics.aov)).toBe(true);

      // Verify KPI prevValue is integer
      expect(Number.isInteger(report.shippedItems.rawPrevValue)).toBe(true);
      expect(Number.isInteger(report.salesRevenue.rawPrevValue)).toBe(true);
      expect(Number.isInteger(report.shippedOrders.rawPrevValue)).toBe(true);
      expect(Number.isInteger(report.basketSize.rawPrevValue)).toBe(true);

      // Verify Executive Briefing
      expect(report.executiveBriefing.dateIso).toBe(todayIso);
      expect(report.executiveBriefing.totalOrders).toBe(1);
      expect(report.executiveBriefing.totalItems).toBe(3);
      expect(report.executiveBriefing.totalRevenue).toBe(6000);
      expect(report.executiveBriefing.clipboardText).toContain('Executive Briefing');
      expect(report.executiveBriefing.summaryPoints.length).toBeGreaterThan(0);
    });
  });

  describe('Real-Time Fulfillment Acceleration: WhatsApp & Product Spotlight', () => {
    it('formats Bangladesh phone numbers accurately for WhatsApp links', () => {
      expect(formatBangladeshPhoneNumber('01712345678')).toBe('8801712345678');
      expect(formatBangladeshPhoneNumber('+8801812345678')).toBe('8801812345678');
      expect(formatBangladeshPhoneNumber('8801912345678')).toBe('8801912345678');
      expect(formatBangladeshPhoneNumber('1712345678')).toBe('8801712345678');
      expect(formatBangladeshPhoneNumber('017-1234-5678')).toBe('8801712345678');
      expect(formatBangladeshPhoneNumber(undefined)).toBeNull();
    });

    it('generates WhatsApp confirmation URLs with pre-formatted Bengali/English templates', () => {
      const mockOrder: Partial<RawOrderRow> = {
        'Order ID': '17280',
        'Customer Name': 'Tanvir Rahman',
        Phone: '01811223344',
        'Order Amount': 3450,
        'Item Name': 'DEEN Royal Panjabi - Black',
        City: 'Chittagong',
        Address: 'House 12, Road 4, GEC Circle',
      };

      // 1. Address Verification Template
      const addrRes = generateWhatsAppConfirmationUrl(mockOrder as RawOrderRow, {
        type: 'address_verification',
      });
      expect(addrRes.url).toBeDefined();
      expect(addrRes.url).toContain('https://wa.me/8801811223344?text=');
      expect(addrRes.message).toContain('Assalamu Alaikum Tanvir Rahman');
      expect(addrRes.message).toContain('Order #17280');
      expect(addrRes.message).toContain('House 12, Road 4, GEC Circle');
      expect(addrRes.message).toContain('CONFIRM');

      // 2. Advance Token Template
      const advRes = generateWhatsAppConfirmationUrl(mockOrder as RawOrderRow, {
        type: 'advance_token',
        advanceAmount: 200,
      });
      expect(advRes.url).toContain('https://wa.me/8801811223344');
      expect(advRes.message).toContain('deposit BDT 200 booking advance via bKash Merchant');
      expect(advRes.message).toContain('bKash TrxID');
    });

    it('synthesizes top products spotlight ranking with velocity score and revenue share', () => {
      const mockSpotlightOrders: Partial<RawOrderRow>[] = [
        {
          'Order ID': '5001',
          'Order Date': '2026-10-15T10:00:00Z',
          'Item Name': 'DEEN Silk Panjabi',
          SKU: 'DN-SILK-01',
          Quantity: 4,
          'Item Cost': 3500,
          'Order Amount': 14000,
          'Delivery Status': 'processing',
          'Order Source': 'Online',
        },
        {
          'Order ID': '5002',
          'Order Date': '2026-10-15T11:00:00Z',
          'Item Name': 'DEEN Silk Panjabi',
          SKU: 'DN-SILK-01',
          Quantity: 2,
          'Item Cost': 3500,
          'Order Amount': 7000,
          'Delivery Status': 'shipped',
          'Order Source': 'Online',
        },
        {
          'Order ID': '5003',
          'Order Date': '2026-10-15T11:30:00Z',
          'Item Name': 'DEEN Twill Chino Pant',
          SKU: 'DN-CHINO-02',
          Quantity: 2,
          'Item Cost': 2100,
          'Order Amount': 4200,
          'Delivery Status': 'shipped',
          'Order Source': 'Online',
        },
      ];

      const report = processLiveOpsData(mockSpotlightOrders as RawOrderRow[], {
        view: 'All Orders',
        customDate: '2026-10-15',
      });

      expect(report.topProducts.length).toBe(2);
      const top1 = report.topProducts[0];
      expect(top1.productName).toBe('DEEN Silk Panjabi');
      expect(top1.unitsSold).toBe(6);
      expect(top1.revenue).toBe(21000);
      expect(top1.velocityScore).toBe('HOT');
      expect(top1.orderCount).toBe(2);

      const top2 = report.topProducts[1];
      expect(top2.productName).toBe('DEEN Twill Chino Pant');
      expect(top2.unitsSold).toBe(2);
    });
  });

  describe('Day Selection, Chart Data, and Hero KPI Synchronization', () => {
    const multiDayOrders: Partial<RawOrderRow>[] = [
      // Day 1: 2026-10-14 (Wednesday) - 2 orders, 3 items, ৳6,500
      {
        'Order ID': '101',
        'Date Modified': '2026-10-14T10:00:00Z',
        'Item Name': 'Vintage Denim Jacket',
        Quantity: 1,
        'Item Cost': 3500,
        'Order Amount': 3500,
        'Delivery Status': 'shipped',
        'Order Source': 'Online',
      },
      {
        'Order ID': '102',
        'Date Modified': '2026-10-14T11:00:00Z',
        'Item Name': 'Mens Twill Five Pocket Pant',
        Quantity: 2,
        'Item Cost': 1500,
        'Order Amount': 3000,
        'Delivery Status': 'shipped',
        'Order Source': 'Online',
      },
      // Day 2: 2026-10-15 (Thursday) - 1 order, 4 items, ৳10,000
      {
        'Order ID': '103',
        'Date Modified': '2026-10-15T12:00:00Z',
        'Item Name': 'DEEN Slim Jeans',
        Quantity: 4,
        'Item Cost': 2500,
        'Order Amount': 10000,
        'Delivery Status': 'shipped',
        'Order Source': 'Online',
      },
    ];

    it('ensures Hero KPIs, 7-day strip, and chart data are perfectly identical for any audited day', () => {
      const reportWed = processLiveOpsData(multiDayOrders as RawOrderRow[], {
        view: 'Today Shipped',
        customDate: '2026-10-14',
        anchorDate: '2026-10-15',
      });

      // 1. Hero KPI Card values for Wednesday 2026-10-14
      expect(reportWed.referenceDate).toBe('2026-10-14');
      expect(reportWed.shippedOrders.rawValue).toBe(2);
      expect(reportWed.shippedItems.rawValue).toBe(3);
      expect(reportWed.salesRevenue.rawValue).toBe(6500);

      // 2. 7-Day History strip entry for Wednesday matches Hero KPIs exactly
      const wedSummary = reportWed.last7DaysHistory.find((d) => d.dateIso === '2026-10-14');
      expect(wedSummary).toBeDefined();
      expect(wedSummary?.orderCount).toBe(reportWed.shippedOrders.rawValue);
      expect(wedSummary?.itemCount).toBe(reportWed.shippedItems.rawValue);
      expect(wedSummary?.revenue).toBe(reportWed.salesRevenue.rawValue);

      // 3. Category chart data sum matches Hero KPIs exactly
      const totalChartRevenue = reportWed.categoryItems.reduce((acc, c) => acc + c.revenue, 0);
      const totalChartVolume = reportWed.categoryItems.reduce((acc, c) => acc + c.volume, 0);
      expect(totalChartRevenue).toBe(reportWed.salesRevenue.rawValue);
      expect(totalChartVolume).toBe(reportWed.shippedItems.rawValue);

      // 4. Slices contain real data, never falling back to dummy data
      expect(reportWed.categoryItems.length).toBe(2);
      expect(reportWed.categoryItems.map((c) => c.name)).toContain('Jacket');
      expect(reportWed.categoryItems.map((c) => c.name)).toContain('Twill');
    });

    it('keeps 7-day dispatch history strip stable when inspecting past dates', () => {
      const reportHistorical = processLiveOpsData(multiDayOrders as RawOrderRow[], {
        view: 'Today Shipped',
        customDate: '2026-10-14',
        anchorDate: '2026-10-15',
      });

      // The 7-day history strip must be anchored on 2026-10-15 (today)
      const dates = reportHistorical.last7DaysHistory.map((d) => d.dateIso);
      expect(dates[dates.length - 1]).toBe('2026-10-15');
      expect(dates).toContain('2026-10-14');

      // The isToday flag is attached strictly to anchor date 2026-10-15, not the audited date
      const todayEntry = reportHistorical.last7DaysHistory.find((d) => d.dateIso === '2026-10-15');
      expect(todayEntry?.isToday).toBe(true);

      const wedEntry = reportHistorical.last7DaysHistory.find((d) => d.dateIso === '2026-10-14');
      expect(wedEntry?.isToday).toBe(false);
    });
  });

  describe('Exchange Order Isolation & Non-Recounting Engine (WooCommerce / Pathao Parity)', () => {
    it('accurately identifies exchange orders, replacements, and original exchanged orders', () => {
      // 1. Replacement order referencing original order (e.g. #18085 for #17839)
      const replacementOrder: Partial<RawOrderRow> = {
        'Order ID': '18085',
        'Customer Name': 'Nasif Amer',
        'Delivery Status': 'completed',
        'Order Notes': 'Exchange for #17839',
        Substatus: 'Exchange for #17839',
      };
      expect(isOrderExchange(replacementOrder as RawOrderRow)).toBe(true);
      const repInfo = extractExchangeInfo(replacementOrder as RawOrderRow);
      expect(repInfo.isExchange).toBe(true);
      expect(repInfo.type).toBe('replacement');
      expect(repInfo.referencedOrderId).toBe('17839');
      expect(repInfo.displayTag).toBe('Exchange for #17839');

      // 2. Pathao courier non-checkout consignment format (D-17839)
      const pathaoExchangeOrder: Partial<RawOrderRow> = {
        'Order ID': 'D-17839',
        'Consignment ID': 'D-17839',
        'Delivery Status': 'shipped',
      };
      expect(isOrderExchange(pathaoExchangeOrder as RawOrderRow)).toBe(true);
      const pathaoInfo = extractExchangeInfo(pathaoExchangeOrder as RawOrderRow);
      expect(pathaoInfo.type).toBe('replacement');
      expect(pathaoInfo.referencedOrderId).toBe('17839');

      // 3. Original order marked "Exchanged" (e.g. #17839)
      const originalOrder: Partial<RawOrderRow> = {
        'Order ID': '17839',
        'Customer Name': 'Nasif Amer',
        'Delivery Status': 'completed',
        Substatus: 'Exchanged',
      };
      expect(isOrderExchange(originalOrder as RawOrderRow)).toBe(true);
      const origInfo = extractExchangeInfo(originalOrder as RawOrderRow);
      expect(origInfo.isExchange).toBe(true);
      expect(origInfo.type).toBe('original_exchanged');
      expect(origInfo.displayTag).toBe('Exchanged');
    });

    it('prevents historical order (#17839) from recounting today when modified to Exchanged status', () => {
      const todayIso = '2026-10-17';
      const mockOrders: Partial<RawOrderRow>[] = [
        // Order 17839 was placed on Oct 14, completed Oct 15, and modified today with substatus "Exchanged"
        {
          'Order ID': '17839',
          'Order Date': '2026-10-14T10:00:00Z',
          'Date Completed': '2026-10-15T14:00:00Z',
          'Date Modified': '2026-10-17T11:00:00Z',
          'Customer Name': 'Nasif Amer',
          'Item Name': 'DEEN Slim Jeans - 32',
          Quantity: 1,
          'Item Cost': 2800,
          'Order Amount': 2800,
          'Delivery Status': 'completed',
          Substatus: 'Exchanged',
          'Order Notes': 'Customer requested size swap',
          'Order Source': 'Online',
        },
        // Order 18090 is a genuine commercial order completed today
        {
          'Order ID': '18090',
          'Order Date': '2026-10-17T09:00:00Z',
          'Date Completed': '2026-10-17T10:00:00Z',
          'Date Modified': '2026-10-17T10:00:00Z',
          'Customer Name': 'Tanvir Islam',
          'Item Name': 'Vintage Denim Jacket',
          Quantity: 1,
          'Item Cost': 4500,
          'Order Amount': 4500,
          'Delivery Status': 'completed',
          'Order Source': 'Online',
        },
      ];

      const report = processLiveOpsData(mockOrders as RawOrderRow[], {
        view: 'Today Shipped',
        customDate: todayIso,
        anchorDate: todayIso,
      });

      // 1. #17839 must NOT recount today as completed/shipped!
      expect(report.shippedOrders.rawValue).toBe(1); // Only 18090
      expect(report.shippedItems.rawValue).toBe(1);
      expect(report.salesRevenue.rawValue).toBe(4500); // Only 4500 from 18090, NOT 7300

      // 2. Charts must only contain genuine sales from 18090
      const chartRev = report.categoryItems.reduce((acc, c) => acc + c.revenue, 0);
      expect(chartRev).toBe(4500);

      // 3. Exchange stats captures the original exchanged order
      expect(report.exchangeStats.originalExchangedOrders.length).toBe(1);
      expect(report.exchangeStats.originalExchangedOrders[0]['Order ID']).toBe('17839');
    });

    it('isolates replacement exchange order (#18085 for #17839) from charts and gross sales revenue', () => {
      const todayIso = '2026-10-17';
      const mockOrders: Partial<RawOrderRow>[] = [
        // 1. Replacement order created today (#18085)
        {
          'Order ID': '18085',
          'Order Date': '2026-10-17T11:00:00Z',
          'Date Completed': '2026-10-17T11:30:00Z',
          'Date Modified': '2026-10-17T11:30:00Z',
          'Customer Name': 'Nasif Amer',
          'Item Name': 'DEEN Slim Jeans - 34',
          SKU: 'DN-J-34',
          Quantity: 1,
          'Item Cost': 2800,
          'Order Amount': 2800,
          'Delivery Status': 'completed',
          Substatus: 'Exchange for #17839',
          'Order Notes': 'Exchange for #17839 - replacement pair dispatched',
          'Order Source': 'Online',
        },
        // 2. Regular commercial sale dispatched today (#18086)
        {
          'Order ID': '18086',
          'Order Date': '2026-10-17T10:00:00Z',
          'Date Completed': '2026-10-17T11:00:00Z',
          'Date Modified': '2026-10-17T11:00:00Z',
          'Customer Name': 'Habib Rahman',
          'Item Name': 'Classic Polo Shirt Navy',
          SKU: 'DN-POLO-01',
          Quantity: 2,
          'Item Cost': 1200,
          'Order Amount': 2400,
          'Delivery Status': 'completed',
          'Order Source': 'Online',
        },
      ];

      const report = processLiveOpsData(mockOrders as RawOrderRow[], {
        view: 'Today Shipped',
        customDate: todayIso,
        anchorDate: todayIso,
      });

      // 1. Gross sales revenue & volume must NOT count the replacement order #18085
      expect(report.salesRevenue.rawValue).toBe(2400); // strictly #18086
      expect(report.shippedItems.rawValue).toBe(2); // strictly #18086
      expect(report.shippedOrders.rawValue).toBe(1); // strictly #18086

      // 2. Charts must NOT show #18085 Jeans as shipped sales
      const jeansCat = report.categoryItems.find((c) => c.name === 'Jeans');
      expect(jeansCat).toBeUndefined(); // Jeans was only in the exchange replacement

      const poloCat = report.categoryItems.find((c) => c.name === 'Polo');
      expect(poloCat).toBeDefined();
      expect(poloCat?.revenue).toBe(2400);
      expect(poloCat?.volume).toBe(2);

      // 3. Dedicated exchange system accurately tracks the replacement order
      expect(report.exchangeStats.count).toBe(1);
      expect(report.exchangeStats.itemsCount).toBe(1);
      expect(report.exchangeStats.replacementOrders.length).toBe(1);
      expect(report.exchangeStats.replacementOrders[0]['Order ID']).toBe('18085');

      // 4. Executive Briefing highlights the exchange replacement transparently
      const briefingPoints = report.executiveBriefing.summaryPoints;
      const exchangeBullet = briefingPoints.find((p) => p.includes('Exchange Logistics'));
      expect(exchangeBullet).toBeDefined();
      expect(exchangeBullet).toContain('#18085 (Exchange for #17839)');
      expect(exchangeBullet).toContain('isolated from sales charts with zero revenue inflation');

      // 5. Clipboard briefing contains exchange dispatches section
      expect(report.executiveBriefing.clipboardText).toContain('Exchanges Dispatched: 1 replacement parcel(s) [#18085 (for #17839)]');

      // 6. Orders ledger contains both orders with full exchange details
      expect(report.activeOrders.length).toBe(2);
      const repOrderInLedger = report.activeOrders.find((o) => (o['Order ID'] || o.orderId) === '18085');
      expect(repOrderInLedger).toBeDefined();
      expect(isOrderExchange(repOrderInLedger as RawOrderRow)).toBe(true);

      // 7. 7-Day History strip records exchange count for today
      const todaySummary = report.last7DaysHistory.find((d) => d.dateIso === todayIso);
      expect(todaySummary).toBeDefined();
      expect(todaySummary?.exchangeCount).toBe(1);
    });

    it('treats non-checkout / admin orders as exchanged orders and isolates them from commercial sales & processing queues', () => {
      const todayIso = '2026-10-17';
      const nonCheckoutOrder: Partial<RawOrderRow> = {
        'Order ID': '18099',
        'Order Date': '2026-10-17T11:00:00Z',
        'Date Modified': '2026-10-17T11:00:00Z',
        'Customer Name': 'Manual Exchange Customer',
        'Delivery Status': 'processing',
        created_via: 'admin',
        'Order Source': 'Online',
        'Item Name': 'Vintage Denim Jacket',
        Quantity: 1,
        'Item Cost': 4500,
        'Order Amount': 4500,
      };

      // 1. Must be recognized as an exchange order
      expect(isOrderExchange(nonCheckoutOrder as RawOrderRow)).toBe(true);
      const exInfo = extractExchangeInfo(nonCheckoutOrder as RawOrderRow);
      expect(exInfo.isExchange).toBe(true);
      expect(exInfo.type).toBe('replacement');
      expect(exInfo.displayTag).toBe('Exchange (No Checkout)');

      // 2. In Today's Orders / Processing queue, non-checkout orders are NOT counted in commercial active orders
      const commercialOrder: Partial<RawOrderRow> = {
        'Order ID': '18100',
        'Order Date': '2026-10-17T12:00:00Z',
        'Date Modified': '2026-10-17T12:00:00Z',
        'Customer Name': 'Regular Checkout Customer',
        'Delivery Status': 'processing',
        created_via: 'checkout',
        'Order Source': 'Online',
        'Item Name': 'DEEN Polo Navy - L',
        Quantity: 1,
        'Item Cost': 1800,
        'Order Amount': 1800,
      };

      const report = processLiveOpsData([nonCheckoutOrder, commercialOrder] as RawOrderRow[], {
        view: "Today's Orders",
        customDate: todayIso,
        anchorDate: todayIso,
      });

      // Commercial sales KPIs must only reflect the genuine checkout order (18100)
      expect(report.totalUniqueOrders).toBe(1);
      expect(report.totalDispatchedItems).toBe(1);
      expect(report.salesRevenue.rawValue).toBe(1800);

      // Processing pipeline count must NOT include the non-checkout exchange order
      expect(report.allOrdersBreakdown.processingCount).toBe(1);
      expect(report.allOrdersBreakdown.totalActiveCount).toBe(1);
      expect(report.allOrdersBreakdown.totalActiveAmount).toBe(1800);

      // Exchange system captures the non-checkout replacement order
      expect(report.exchangeStats.count).toBe(1);
      expect(report.exchangeStats.replacementOrders[0]['Order ID']).toBe('18099');

      // Table displays both commercial order and replacement exchange order
      expect(report.activeOrders.length).toBe(2);
    });

    it('strictly excludes POS and non-checkout exchange orders from Executive Briefing metrics and telemetry', () => {
      const todayIso = '2026-10-17';
      const commercialOrder: Partial<RawOrderRow> = {
        'Order ID': '18100',
        'Order Date': '2026-10-17T10:00:00Z',
        'Date Modified': '2026-10-17T11:00:00Z',
        'Customer Name': 'Ecom Online Customer',
        Phone: '01711223344',
        'Delivery Status': 'shipped',
        created_via: 'checkout',
        'Order Source': 'Online',
        'Item Name': 'DEEN Signature Polo',
        SKU: 'POLO-01',
        Quantity: 1,
        'Item Cost': 2200,
        'Order Amount': 2200,
        'Consignment ID': 'CID-ONLINE-100',
      };

      const posOrder: Partial<RawOrderRow> = {
        'Order ID': '18101 m',
        'Order Date': '2026-10-17T12:00:00Z',
        'Date Modified': '2026-10-17T12:00:00Z',
        'Customer Name': 'Outlet Walk-in Customer',
        Phone: '01811223344',
        'Delivery Status': 'shipped',
        'Order Source': 'pos',
        fulfillmentLocation: 'Mirpur Outlet POS',
        isPos: true,
        'Item Name': 'DEEN Jeans',
        SKU: 'J-01',
        Quantity: 1,
        'Item Cost': 3000,
        'Order Amount': 3000,
      };

      const nonCheckoutOrder: Partial<RawOrderRow> = {
        'Order ID': '18099',
        'Order Date': '2026-10-17T09:00:00Z',
        'Date Modified': '2026-10-17T09:00:00Z',
        'Customer Name': 'Exchange Replacement Customer',
        Phone: '01911223344',
        'Delivery Status': 'shipped',
        created_via: 'admin',
        'Order Source': 'Online',
        'Item Name': 'DEEN Twill Pant',
        SKU: 'TW-01',
        Quantity: 1,
        'Item Cost': 2500,
        'Order Amount': 2500,
      };

      const report = processLiveOpsData(
        [commercialOrder, posOrder, nonCheckoutOrder] as RawOrderRow[],
        {
          view: 'Today Shipped',
          customDate: todayIso,
          anchorDate: todayIso,
        }
      );

      const briefing = report.executiveBriefing;
      // 1. Total commercial orders & volume must ONLY reflect genuine online checkout order (18100)
      expect(briefing.totalOrders).toBe(1);
      expect(briefing.totalItems).toBe(1);
      expect(briefing.totalRevenue).toBe(2200);

      // 2. Channel split must show 1 ecom, 0 outlet, 1 exchange
      expect(briefing.channelBreakdown.totalOrders).toBe(1);
      expect(briefing.channelBreakdown.ecomCount).toBe(1);
      expect(briefing.channelBreakdown.outletCount).toBe(0);
      expect(briefing.channelBreakdown.exchangeCount).toBe(1);

      // 3. Telemetry must be derived strictly from the commercial online order
      expect(briefing.fulfillment.lastShippedOrder).toBe('18100');
      expect(briefing.fulfillment.lastPathaoPrint).toBe('CID-ONLINE-100');

      // 4. Clipboard text formatting must omit POS outlet and label Ecom as Checkout
      expect(briefing.clipboardText).toContain('🛒 *Total Orders:* 1');
      expect(briefing.clipboardText).toContain('🔄 *Exchange:* 1');
      expect(briefing.clipboardText).toContain('🚀 *Ecom (Checkout):* 1');
      expect(briefing.clipboardText).not.toContain('🏪 *Outlet:*');
    });

    it('strictly excludes POS and non-checkout exchange orders from commercial Excel export sheet', () => {
      const todayIso = '2026-10-17';
      const commercialOrder: Partial<RawOrderRow> = {
        'Order ID': '18100',
        'Order Date': '2026-10-17T10:00:00Z',
        'Customer Name': 'Ecom Online Customer',
        Phone: '01711223344',
        'Delivery Status': 'shipped',
        created_via: 'checkout',
        'Order Source': 'Online',
        'Item Name': 'DEEN Signature Polo',
        SKU: 'POLO-01',
        Quantity: 1,
        'Item Cost': 2200,
        'Order Amount': 2200,
      };

      const posOrder: Partial<RawOrderRow> = {
        'Order ID': '18101 m',
        'Order Date': '2026-10-17T12:00:00Z',
        'Customer Name': 'Outlet Walk-in Customer',
        'Delivery Status': 'shipped',
        'Order Source': 'pos',
        fulfillmentLocation: 'Mirpur Outlet POS',
        isPos: true,
        'Item Name': 'DEEN Jeans',
        Quantity: 1,
        'Item Cost': 3000,
        'Order Amount': 3000,
      };

      const nonCheckoutOrder: Partial<RawOrderRow> = {
        'Order ID': '18099',
        'Order Date': '2026-10-17T09:00:00Z',
        'Customer Name': 'Exchange Replacement Customer',
        'Delivery Status': 'shipped',
        created_via: 'admin',
        'Order Source': 'Online',
        'Item Name': 'DEEN Twill Pant',
        Quantity: 1,
        'Item Cost': 2500,
        'Order Amount': 2500,
      };

      const ordersPool = [commercialOrder, posOrder, nonCheckoutOrder] as RawOrderRow[];
      const report = processLiveOpsData(ordersPool, {
        view: 'Today Shipped',
        customDate: todayIso,
        anchorDate: todayIso,
      });

      const wb = buildLiveShippedOrdersWorkbook(ordersPool, report);

      // Sheet 1: Shipped Orders (Online) must contain ONLY the commercial online checkout order
      expect(wb.SheetNames).toContain('Shipped Orders (Online)');
      const commercialSheetData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        wb.Sheets['Shipped Orders (Online)']
      );
      expect(commercialSheetData.length).toBe(1);
      expect(commercialSheetData[0]['Order ID']).toBe('18100');
      const exportedIds = commercialSheetData.map((r) => r['Order ID']);
      expect(exportedIds).not.toContain('18101 m'); // POS excluded
      expect(exportedIds).not.toContain('18099'); // Non-checkout excluded

      // Sheet 2: Exchanges & Non-Checkout must isolate the exchange order
      expect(wb.SheetNames).toContain('Exchanges & Non-Checkout');
      const exchangeSheetData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        wb.Sheets['Exchanges & Non-Checkout']
      );
      expect(exchangeSheetData.length).toBe(1);
      expect(exchangeSheetData[0]['Replacement Order ID']).toBe('18099');
      expect(exchangeSheetData[0]['Commercial Revenue Recognized']).toBe(0);
    });
  });

  describe('DEEN-OPS Customer Mix & Multi-Bucket Identity Resolution', () => {
    it('normalizes Bangladesh phone numbers, emails, and district city names', () => {
      expect(normalizePhone('01712-447704')).toBe('01712447704');
      expect(normalizePhone('+8801712447704')).toBe('01712447704');
      expect(normalizePhone('8801712447704')).toBe('01712447704');
      expect(normalizePhone('1712447704')).toBe('01712447704');
      expect(normalizePhone('01700000000')).toBe('');

      expect(normalizeEmail('  Customer.Deen@Gmail.com ')).toBe('customer.deen@gmail.com');
      expect(normalizeName('Md. Tanvir Ahmed (Sunny)')).toBe('md tanvir ahmed sunny');
      expect(normalizeCity('Chattogram')).toBe('chittagong');
      expect(normalizeCity('Bogura')).toBe('bogra');
    });

    it('resolves returning customers via phone aliases, email, and name|city', () => {
      const historicalOrders: Partial<RawOrderRow>[] = [
        {
          'Order ID': '1001',
          'Order Date': '2026-10-10T10:00:00Z',
          'Date Modified': '2026-10-10T10:00:00Z',
          'Customer Name': 'Kazi Farhan',
          Phone: '01819223344',
          Email: 'farhan@deen.com',
          City: 'Dhaka',
          'Item Name': 'DEEN Casual Shirt',
          Quantity: 1,
          'Item Cost': 2100,
          'Order Amount': 2100,
          'Delivery Status': 'completed',
        },
        {
          'Order ID': '1002',
          'Order Date': '2026-10-11T10:00:00Z',
          'Date Modified': '2026-10-11T10:00:00Z',
          'Customer Name': 'Asif Iqbal',
          Phone: '01711998877',
          Email: 'asif@deen.com',
          City: 'Sylhet',
          'Item Name': 'DEEN Twill Pant',
          Quantity: 1,
          'Item Cost': 2500,
          'Order Amount': 2500,
          'Delivery Status': 'completed',
        },
      ];

      // On Oct 15:
      // 1. Farhan orders again with +880 international phone format (Returning via phone alias)
      // 2. Asif orders again with different phone but same email (Returning via email priority)
      // 3. New buyer (Shakib) places first order ever (New customer)
      // 4. Anonymous Walk-in Customer (Excluded from customer mix)
      const oct15Orders: Partial<RawOrderRow>[] = [
        {
          'Order ID': '1010',
          'Order Date': '2026-10-15T12:00:00Z',
          'Date Modified': '2026-10-15T12:00:00Z',
          'Customer Name': 'Kazi Farhan',
          Phone: '+8801819223344', // Different alias format
          Email: '',
          City: 'Dhaka',
          'Item Name': 'DEEN Oversized Tee',
          Quantity: 1,
          'Item Cost': 1400,
          'Order Amount': 1400,
          'Delivery Status': 'shipped',
        },
        {
          'Order ID': '1011',
          'Order Date': '2026-10-15T14:00:00Z',
          'Date Modified': '2026-10-15T14:00:00Z',
          'Customer Name': 'Asif Iqbal',
          Phone: '01999887766', // Different phone
          Email: 'asif@deen.com', // Matching email
          City: 'Sylhet',
          'Item Name': 'DEEN Denim Jacket',
          Quantity: 1,
          'Item Cost': 3500,
          'Order Amount': 3500,
          'Delivery Status': 'shipped',
        },
        {
          'Order ID': '1012',
          'Order Date': '2026-10-15T16:00:00Z',
          'Date Modified': '2026-10-15T16:00:00Z',
          'Customer Name': 'Shakib Khan',
          Phone: '01511223344',
          Email: 'shakib@newbuyer.com',
          City: 'Khulna',
          'Item Name': 'DEEN Polo',
          Quantity: 1,
          'Item Cost': 1200,
          'Order Amount': 1200,
          'Delivery Status': 'shipped',
        },
        {
          'Order ID': '1013',
          'Order Date': '2026-10-15T17:00:00Z',
          'Date Modified': '2026-10-15T17:00:00Z',
          'Customer Name': 'Walk-in Customer',
          Phone: '01700000000',
          City: 'Mirpur',
          'Item Name': 'DEEN Basic Tee',
          Quantity: 1,
          'Item Cost': 800,
          'Order Amount': 800,
          'Delivery Status': 'completed',
        },
      ];

      const report = processLiveOpsData(oct15Orders as RawOrderRow[], {
        view: 'Today Shipped',
        onlineOnly: true,
        customDate: '2026-10-15',
        anchorDate: '2026-10-15',
        historicalOrders: historicalOrders as RawOrderRow[],
      });

      // Exactly 3 unique online customers (Farhan, Asif, Shakib; Walk-in excluded)
      expect(report.customerMix.retCount).toBe(2); // Farhan + Asif
      expect(report.customerMix.newCount).toBe(1); // Shakib
      expect(report.customerMix.retPercent).toBe(67); // 2/3 = 66.7% -> 67%
      expect(report.customerMix.newPercent).toBe(33); // 1/3 = 33.3% -> 33%
      expect(report.customerMix.sparkline.length).toBeGreaterThanOrEqual(2);
    });

    it('counts multi-item orders from the same customer as 1 unique customer', () => {
      const multiItemOrders: Partial<RawOrderRow>[] = [
        {
          'Order ID': '5001',
          'Order Date': '2026-10-15T10:00:00Z',
          'Date Modified': '2026-10-15T10:00:00Z',
          'Customer Name': 'Tariq Islam',
          Phone: '01755112233',
          'Item Name': 'DEEN Twill Pant - 32',
          Quantity: 1,
          'Item Cost': 2500,
          'Order Amount': 5000,
          'Delivery Status': 'shipped',
        },
        {
          'Order ID': '5001', // Same order ID
          'Order Date': '2026-10-15T10:00:00Z',
          'Date Modified': '2026-10-15T10:00:00Z',
          'Customer Name': 'Tariq Islam',
          Phone: '01755112233',
          'Item Name': 'DEEN Twill Pant - 34',
          Quantity: 1,
          'Item Cost': 2500,
          'Order Amount': 5000,
          'Delivery Status': 'shipped',
        },
      ];

      const report = processLiveOpsData(multiItemOrders as RawOrderRow[], {
        view: 'Today Shipped',
        customDate: '2026-10-15',
        anchorDate: '2026-10-15',
      });

      expect(report.customerMix.newCount + report.customerMix.retCount).toBe(1);
    });
  });

  describe('Sales Volume by Category Dynamic Scaling (LiveVolumeBarChart)', () => {
    it('scales dynamically down for small volumes rather than statically clamping to 14', () => {
      // When max volume is small (e.g. 3), top scale is 3, not 14
      const res3 = computeDynamicYAxis(3);
      expect(res3.maxVolume).toBe(3);
      expect(res3.yTicks).toEqual([0, 1, 2, 3]);

      // When max volume is 6, top scale is 6, not 14
      const res6 = computeDynamicYAxis(6);
      expect(res6.maxVolume).toBe(6);
      expect(res6.yTicks).toEqual([0, 2, 4, 6]);
    });

    it('scales dynamically up for larger volumes', () => {
      // When max volume is 25, top scale dynamically expands to 25
      const res25 = computeDynamicYAxis(25);
      expect(res25.maxVolume).toBe(25);
      expect(res25.yTicks).toEqual([0, 5, 10, 15, 20, 25]);

      // When max volume is 50, top scale dynamically expands to 50
      const res50 = computeDynamicYAxis(50);
      expect(res50.maxVolume).toBe(50);
      expect(res50.yTicks).toEqual([0, 10, 20, 30, 40, 50]);
    });

    it('handles zero or negative volume gracefully', () => {
      const res0 = computeDynamicYAxis(0);
      expect(res0.maxVolume).toBe(4);
      expect(res0.yTicks).toEqual([0, 1, 2, 3, 4]);
    });

    it('supports adjustable chart height and dynamic scaling according to the highest bar', () => {
      const calculateAutoHeight = (maxActualVolume: number) => {
        if (maxActualVolume >= 16) return 540;
        if (maxActualVolume >= 10) return 500;
        if (maxActualVolume >= 5) return 460;
        return 420;
      };

      expect(calculateAutoHeight(20)).toBe(540);
      expect(calculateAutoHeight(14)).toBe(500);
      expect(calculateAutoHeight(8)).toBe(460);
      expect(calculateAutoHeight(3)).toBe(420);
    });
  });
});


