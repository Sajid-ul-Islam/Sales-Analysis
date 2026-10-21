import { describe, it, expect } from 'vitest';
import {
  getDhakaIsoDate,
  getDhakaTodayIso,
  getDhakaDayName,
  getDhakaPreviousWorkingDay,
  parseDhakaMidday,
  isDhakaToday,
  getDhakaDaysAgoIso,
  getDhakaDayBoundaries,
  DHAKA_TIMEZONE,
  DHAKA_OFFSET_HOURS,
} from '@/lib/timezone';
import { getRecommendedTTL, isHistoricalDateRange } from '@/lib/apiCache';
import {
  formatDateToIsoDay,
  getDayName,
  getPreviousWorkingDay,
  parseOrderDateValue,
  isOrderOnline,
  processLiveOpsData,
} from '@/lib/liveOpsProcessor';

describe('Timezone Invariance: Strictly Pinned to Asia/Dhaka (UTC+6)', () => {
  it('defines correct constants for Bangladesh Standard Time', () => {
    expect(DHAKA_TIMEZONE).toBe('Asia/Dhaka');
    expect(DHAKA_OFFSET_HOURS).toBe(6);
  });

  describe('Midnight boundary handling (00:00 to 06:00 Dhaka time / 18:00 to 00:00 UTC)', () => {
    it('pins 02:00 AM Dhaka time (20:00 UTC previous day) to the Dhaka calendar day', () => {
      // 2026-10-17 at 20:00:00 UTC is 2026-10-18 at 02:00:00 AM BST
      const timestampUtc = new Date('2026-10-17T20:00:00.000Z');

      // UTC date is 17th
      expect(timestampUtc.toISOString().slice(0, 10)).toBe('2026-10-17');

      // Dhaka date is strictly 18th
      expect(getDhakaIsoDate(timestampUtc)).toBe('2026-10-18');
      expect(formatDateToIsoDay(timestampUtc)).toBe('2026-10-18');
    });

    it('pins 05:59 AM Dhaka time (23:59 UTC previous day) to the Dhaka calendar day', () => {
      // 2026-10-17 at 23:59:59 UTC is 2026-10-18 at 05:59:59 AM BST
      const timestampUtc = new Date('2026-10-17T23:59:59.000Z');
      expect(getDhakaIsoDate(timestampUtc)).toBe('2026-10-18');
      expect(formatDateToIsoDay(timestampUtc)).toBe('2026-10-18');
    });

    it('correctly maps weekday in Dhaka across UTC midnight boundary', () => {
      // 2026-10-17 21:00:00 UTC (Saturday night in London/UTC, but Sunday morning 03:00 AM in Dhaka)
      const lateSaturdayUtc = new Date('2026-10-17T21:00:00.000Z');
      expect(getDhakaDayName(lateSaturdayUtc)).toBe('Sunday');
      expect(getDayName(lateSaturdayUtc)).toBe('Sunday');
    });
  });

  describe('Midday Parsing & Safe Date Arithmetic', () => {
    it('parses YYYY-MM-DD anchored at midday Dhaka time (+06:00)', () => {
      const parsed = parseDhakaMidday('2026-10-18');
      // 12:00:00+06:00 is 06:00:00 UTC
      expect(parsed.toISOString()).toBe('2026-10-18T06:00:00.000Z');
      expect(getDhakaIsoDate(parsed)).toBe('2026-10-18');
    });

    it('calculates previous working day skipping Friday in Dhaka', () => {
      // Saturday Oct 17, 2026 in Dhaka: previous working day must be Thursday Oct 15 (skipping Friday Oct 16)
      const saturday = parseDhakaMidday('2026-10-17');
      const prev = getDhakaPreviousWorkingDay(saturday);
      expect(prev.isoDay).toBe('2026-10-15');
      expect(prev.dayName).toBe('Thursday');

      // In liveOpsProcessor.ts
      const processorPrev = getPreviousWorkingDay(saturday);
      expect(getDhakaIsoDate(processorPrev)).toBe('2026-10-15');
    });
  });

  describe('apiCache.ts Dhaka Timezone Integration', () => {
    it('identifies today strictly in Dhaka time for recommended TTL', () => {
      const todayDhaka = getDhakaTodayIso();
      // When endDate matches Dhaka today, TTL should be TTL_TODAY_MS (15 minutes = 900,000ms)
      const ttl = getRecommendedTTL(todayDhaka, todayDhaka);
      expect(ttl).toBe(15 * 60 * 1000);
    });

    it('does not classify Dhaka today as historical data', () => {
      const todayDhaka = getDhakaTodayIso();
      expect(isHistoricalDateRange(todayDhaka)).toBe(false);
    });

    it('classifies closed past ranges older than 3 days as historical data', () => {
      const fourDaysAgo = getDhakaDaysAgoIso(4);
      expect(isHistoricalDateRange(fourDaysAgo)).toBe(true);
    });

    it('computes exact day boundaries in UTC for any Dhaka date', () => {
      const boundaries = getDhakaDayBoundaries('2026-10-18');
      // 2026-10-18 00:00:00+06:00 is 2026-10-17 18:00:00.000Z
      expect(new Date(boundaries.startMs).toISOString()).toBe('2026-10-17T18:00:00.000Z');
      // 2026-10-18 24:00:00+06:00 is 2026-10-18 18:00:00.000Z
      expect(new Date(boundaries.endMs).toISOString()).toBe('2026-10-18T18:00:00.000Z');
      expect(boundaries.endMs - boundaries.startMs).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('Unzoned Date Parsing & Vercel Serverless Timezone Invariance', () => {
    it('pins unzoned WooCommerce date-time strings to Asia/Dhaka (+06:00)', () => {
      // Thursday evening in Dhaka (e.g. 18:30, 20:45, 21:38)
      // On Vercel (TZ=UTC), unzoned new Date() would parse as UTC and shift into Friday!
      const d1 = parseOrderDateValue('2026-10-15T18:30:00');
      const d2 = parseOrderDateValue('2026-10-15 20:45:21');
      const d3 = parseOrderDateValue('2026-10-15T21:38:58');

      expect(d1).not.toBeNull();
      expect(d2).not.toBeNull();
      expect(d3).not.toBeNull();

      expect(formatDateToIsoDay(d1!)).toBe('2026-10-15');
      expect(getDayName(d1!)).toBe('Thursday');

      expect(formatDateToIsoDay(d2!)).toBe('2026-10-15');
      expect(getDayName(d2!)).toBe('Thursday');

      expect(formatDateToIsoDay(d3!)).toBe('2026-10-15');
      expect(getDayName(d3!)).toBe('Thursday');
    });

    it('strictly isolates physical retail branch orders from online commercial dispatches', () => {
      // Online warehouse orders
      expect(isOrderOnline({ orderId: '17263', fulfillmentLocation: 'Online Store (Central Warehouse)' })).toBe(true);
      expect(isOrderOnline({ orderId: '17263', fulfillmentLocation: 'Warehouse (Mirpur)' })).toBe(true);

      // Physical retail outlets (Mirpur POS, Cumilla, Wari, Sylhet) without online indicators must evaluate to false
      expect(isOrderOnline({ orderId: '17263 m', fulfillmentLocation: 'Mirpur Outlet POS' })).toBe(false);
      expect(isOrderOnline({ orderId: '17263', outletId: '1', fulfillmentLocation: 'Mirpur Outlet POS' })).toBe(false);
      expect(isOrderOnline({ orderId: '17263 c', fulfillmentLocation: 'Cumilla Branch' })).toBe(false);
      expect(isOrderOnline({ orderId: '17263', outletId: '2', fulfillmentLocation: 'Cumilla Branch' })).toBe(false);
      expect(isOrderOnline({ orderId: '17263 w', fulfillmentLocation: 'Wari Branch' })).toBe(false);
      expect(isOrderOnline({ orderId: '17263', outletId: '9', fulfillmentLocation: 'Wari Branch' })).toBe(false);
      expect(isOrderOnline({ orderId: '17263 s', fulfillmentLocation: 'Sylhet Branch' })).toBe(false);
      expect(isOrderOnline({ orderId: '17263', outletId: '7', fulfillmentLocation: 'Sylhet Branch' })).toBe(false);

      // Online orders dispatched from retail branch outlets (with courier tracking, online payment, or web checkout) evaluate to true
      expect(isOrderOnline({ orderId: '17263 c', fulfillmentLocation: 'Cumilla Branch', consignmentId: 'RD12345678' })).toBe(true);
      expect(isOrderOnline({ orderId: '17263 w', fulfillmentLocation: 'Wari Branch', paymentMethod: 'bKash' })).toBe(true);
      expect(isOrderOnline({ orderId: '17263 s', fulfillmentLocation: 'Sylhet Branch', created_via: 'checkout' })).toBe(true);
    });

    it('filters out Friday from 7-day dispatch history when central warehouse is closed (0 dispatches)', () => {
      // Simulate orders on Thu, Sat, Sun, Mon, Tue, Wed - Friday has 0 dispatches
      const sampleOrders = [
        { 'Order ID': '101', 'Order Status': 'completed', 'Delivery Status': 'completed', 'Date Completed': '2026-10-15T10:00:00', fulfillmentLocation: 'Online Store (Central Warehouse)' },
        { 'Order ID': '102', 'Order Status': 'completed', 'Delivery Status': 'completed', 'Date Completed': '2026-10-17T10:00:00', fulfillmentLocation: 'Online Store (Central Warehouse)' },
        { 'Order ID': '103', 'Order Status': 'completed', 'Delivery Status': 'completed', 'Date Completed': '2026-10-18T10:00:00', fulfillmentLocation: 'Online Store (Central Warehouse)' },
      ];

      const report = processLiveOpsData(sampleOrders, { view: 'Today Shipped', anchorDate: '2026-10-21' });
      const displayDays = report.last7DaysHistory.filter((day) => {
        const isFriday = day.dayName.toLowerCase().startsWith('fri') || (day.dateLabel && day.dateLabel.toLowerCase().startsWith('fri'));
        if (isFriday && (day.isFridayClosed || day.orderCount === 0)) {
          return false;
        }
        return true;
      });

      const dayNames = displayDays.map((d) => d.dayName);
      expect(dayNames).not.toContain('Friday');
      expect(displayDays.length).toBe(6);
    });
  });
});

