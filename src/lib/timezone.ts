/**
 * Timezone Utility: Strictly Pinned to Asia/Dhaka (UTC+6)
 *
 * Guarantees zero divergence between client browser, Vercel serverless functions,
 * and automated cron tasks. Bangladesh Standard Time (BST) is fixed at UTC+6
 * with no daylight saving time (DST).
 */

export const DHAKA_TIMEZONE = 'Asia/Dhaka';
export const DHAKA_OFFSET_HOURS = 6;
export const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

// Reusable cached Intl formatters with strict Asia/Dhaka timezone
const dhakaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: DHAKA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dhakaWeekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: DHAKA_TIMEZONE,
  weekday: 'long',
});

/**
 * Returns YYYY-MM-DD for any date or timestamp strictly in Asia/Dhaka time.
 */
export function getDhakaIsoDate(input?: Date | string | number | null): string {
  if (!input) {
    return dhakaDateFormatter.format(new Date());
  }
  const d = typeof input === 'string' || typeof input === 'number' ? new Date(input) : input;
  if (isNaN(d.getTime())) {
    return dhakaDateFormatter.format(new Date());
  }
  return dhakaDateFormatter.format(d);
}

/**
 * Returns today's ISO date string (YYYY-MM-DD) strictly in Asia/Dhaka time.
 */
export function getDhakaTodayIso(): string {
  return dhakaDateFormatter.format(new Date());
}

/**
 * Returns full weekday name (e.g. "Monday", "Friday") in Asia/Dhaka time.
 */
export function getDhakaDayName(input?: Date | string | number | null): string {
  const d = !input ? new Date() : (typeof input === 'string' || typeof input === 'number' ? new Date(input) : input);
  if (isNaN(d.getTime())) return dhakaWeekdayFormatter.format(new Date());
  return dhakaWeekdayFormatter.format(d);
}

/**
 * Parses YYYY-MM-DD safely at 12:00:00 (midday) Dhaka time (+06:00).
 * Midday in Dhaka corresponds to 06:00 UTC, preventing any midnight boundary drift across runtimes.
 */
export function parseDhakaMidday(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') return new Date();
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T12:00:00+06:00`);
  }
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Returns previous working day in Bangladesh, skipping Friday (BST weekend).
 * In Bangladesh, corporate/ops weekend is Friday. If stepping back from Saturday
 * lands on Friday, it steps back to Thursday.
 */
export function getDhakaPreviousWorkingDay(input?: Date | string | number | null): { date: Date; isoDay: string; dayName: string } {
  const base = input ? (typeof input === 'string' || typeof input === 'number' ? new Date(input) : input) : new Date();
  const currentIso = getDhakaIsoDate(base);
  const midday = parseDhakaMidday(currentIso);

  // Step back 1 calendar day (24 hours) in Dhaka time
  let prevMidday = new Date(midday.getTime() - 24 * 60 * 60 * 1000);
  let dayName = getDhakaDayName(prevMidday);

  // If previous day is Friday, step back one more day to Thursday
  if (dayName === 'Friday') {
    prevMidday = new Date(prevMidday.getTime() - 24 * 60 * 60 * 1000);
    dayName = getDhakaDayName(prevMidday);
  }

  return {
    date: prevMidday,
    isoDay: getDhakaIsoDate(prevMidday),
    dayName,
  };
}

/**
 * Checks if a given date corresponds to today in Asia/Dhaka.
 */
export function isDhakaToday(input: Date | string | number | null): boolean {
  if (!input) return false;
  return getDhakaIsoDate(input) === getDhakaTodayIso();
}

/**
 * Calculates ISO date (YYYY-MM-DD) N days ago strictly in Asia/Dhaka time.
 */
export function getDhakaDaysAgoIso(days: number): string {
  const now = new Date();
  const targetMs = now.getTime() - days * 24 * 60 * 60 * 1000;
  return getDhakaIsoDate(targetMs);
}

/**
 * Returns timestamp [startMs, endMs] for a given Dhaka ISO day (defaults to today).
 * Covers 00:00:00.000 to 23:59:59.999 BST (UTC+6).
 */
export function getDhakaDayBoundaries(isoDay?: string): { startMs: number; endMs: number } {
  const day = isoDay || getDhakaTodayIso();
  const startMs = new Date(`${day}T00:00:00+06:00`).getTime();
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return { startMs, endMs };
}

