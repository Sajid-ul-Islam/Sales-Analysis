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
import { formatDateToIsoDay, getDayName, getPreviousWorkingDay } from '@/lib/liveOpsProcessor';

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
});

