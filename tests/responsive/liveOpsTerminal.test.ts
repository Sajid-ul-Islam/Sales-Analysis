import { describe, it, expect } from 'vitest';
import { classifyProductLine, computeSelectsStats } from '@/lib/selectsAnalytics';
import { getCategoryForSales, getSubCategoryForSales, getShortCategoryLabel } from '@/lib/liveCategoryEngine';
import { getPreviousWorkingDay, processLiveOpsData, computeDispatchCutoff, formatBangladeshPhoneNumber, generateWhatsAppConfirmationUrl } from '@/lib/liveOpsProcessor';
import { RawOrderRow } from '@/types';

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
      expect(getCategoryForSales('Mens Twill Five Pocket Pant')).toBe('Twill Five Pockets');
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
      expect(getShortCategoryLabel('Twill Five Pockets Casual')).toBe('Twill Five Pockets');
      expect(getShortCategoryLabel('FS Shirt - Formal Executive')).toBe('Formal');
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

      // Active orders must contain exactly the 3 checkout orders: Processing (4001) + On-Hold (4002) + Today Shipped (4003)
      const orderIds = report.activeOrders.map((o) => o['Order ID']);
      expect(orderIds).toContain('4001');
      expect(orderIds).toContain('4002');
      expect(orderIds).toContain('4003');
      expect(orderIds).not.toContain('4004'); // Old shipped
      expect(orderIds).not.toContain('4005'); // Cancelled
      expect(orderIds).not.toContain('4006'); // POS register

      // Breakdown metrics
      expect(report.allOrdersBreakdown.processingCount).toBe(1);
      expect(report.allOrdersBreakdown.holdCount).toBe(1);
      expect(report.allOrdersBreakdown.todayShippedCount).toBe(1);
      expect(report.allOrdersBreakdown.totalActiveCount).toBe(3);
    });

    it('enforces Today\'s Orders = orders shipped today + orders with status Processing or Hold', () => {
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
      // Must contain Shipped Today (6001), Processing (6002), On-Hold (6003)
      expect(activeIds).toContain('6001');
      expect(activeIds).toContain('6002');
      expect(activeIds).toContain('6003');
      // Must exclude yesterday shipped (6004) and cancelled (6005)
      expect(activeIds).not.toContain('6004');
      expect(activeIds).not.toContain('6005');

      // Total orders count
      expect(report.totalUniqueOrders).toBe(3);
      // Total items count = 2 (jeans) + 1 (pant) + 1 (jacket) = 4
      expect(report.totalDispatchedItems).toBe(4);
      // Revenue = 5000 + 2000 + 6000 = 13000
      expect(report.salesRevenue.rawValue).toBe(13000);
      expect(report.todaysOrdersBreakdown.processingCount).toBe(1);
      expect(report.todaysOrdersBreakdown.holdCount).toBe(1);
      expect(report.todaysOrdersBreakdown.todayShippedCount).toBe(1);
    });
  });

  describe('Real-Time Fulfillment Acceleration: Dispatch Cut-off, WhatsApp & Product Spotlight', () => {
    it('computes accurate dispatch cut-off countdown, required packing velocity, and packing progress', () => {
      // Create a deterministic simulated date: 2:30 PM (14:30) Bangladesh time (UTC 8:30)
      const simulatedNow = new Date('2026-10-15T08:30:00.000Z'); // 8:30 UTC = 14:30 BST
      const cutoff4pm = computeDispatchCutoff(15, 16, simulatedNow, 45);

      expect(cutoff4pm.cutoffHour).toBe(16);
      expect(cutoff4pm.cutoffLabel).toBe('4:00 PM BST');
      expect(cutoff4pm.isPassed).toBe(false);
      expect(cutoff4pm.hoursRemaining).toBe(1);
      expect(cutoff4pm.minutesRemaining).toBe(30);
      expect(cutoff4pm.timeRemainingFormatted).toBe('1h 30m');
      expect(cutoff4pm.pendingToPackCount).toBe(15);
      // 15 orders in 1.5 hours = 10 orders/hour
      expect(cutoff4pm.packingVelocityRequired).toBe(10);
      expect(cutoff4pm.urgencyLevel).toBe('URGENT'); // <= 120 mins remaining
      expect(cutoff4pm.packedCount).toBe(45);
      expect(cutoff4pm.totalTargetCount).toBe(60);
      expect(cutoff4pm.packingProgressPct).toBe(75); // 45 / 60 = 75%

      // Simulate overdue/passed cut-off: 5:00 PM (17:00 BST = 11:00 UTC)
      const passedNow = new Date('2026-10-15T11:00:00.000Z');
      const cutoffOverdue = computeDispatchCutoff(8, 16, passedNow, 32);
      expect(cutoffOverdue.isPassed).toBe(true);
      expect(cutoffOverdue.urgencyLevel).toBe('OVERDUE');
      expect(cutoffOverdue.timeRemainingFormatted).toBe('Cutoff Passed');
      expect(cutoffOverdue.packedCount).toBe(32);
      expect(cutoffOverdue.totalTargetCount).toBe(40);
      expect(cutoffOverdue.packingProgressPct).toBe(80); // 32 / 40 = 80%
    });

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
});

