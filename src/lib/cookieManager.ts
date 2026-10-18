/**
 * DEEN Commerce Reconciliation Engine — Cookie Management System
 * Provides safe, enterprise-compliant cookie storage, reading, deletion, and inspection.
 */

export interface CookieOptions {
  days?: number;
  path?: string;
  sameSite?: 'Strict' | 'Lax' | 'None';
  secure?: boolean;
}

export interface CookieDetail {
  name: string;
  value: string;
  sizeBytes: number;
  isDeenCookie: boolean;
  description: string;
}

export const DEEN_COOKIE_KEYS = {
  ACTIVE_TAB: 'deen_active_tab',
  DATE_SCOPE: 'deen_date_scope',
  SOURCE_MODE: 'deen_source_mode',
  EXCLUDE_AUGUST: 'deen_exclude_august',
  EXCLUDE_POS: 'deen_exclude_pos',
  SESSION_ID: 'deen_session_id',
  CACHE_CONSENT: 'deen_cache_consent',
  LAST_VISIT: 'deen_last_visit',
  COMPACT_DENSITY: 'deen_compact_density'
} as const;

const COOKIE_DESCRIPTIONS: Record<string, string> = {
  deen_active_tab: 'Remembers the last active dashboard module tab (e.g. Executive, Ledger, Returns)',
  deen_date_scope: 'Stores active date filter window (All Records, Today, 7 Days, Month)',
  deen_source_mode: 'Remembers active data source selection (Uploaded Spreadsheets vs Cloud API)',
  deen_exclude_august: 'Reconciliation rule: excludes pre-September August trial records',
  deen_exclude_pos: 'Reconciliation rule: isolates Online Store from physical POS registers',
  deen_session_id: 'Anonymous workspace session identifier for local reconciliation audit logging',
  deen_cache_consent: 'Local cache and cookie storage consent status',
  deen_last_visit: 'Timestamp of previous active reconciliation session',
  deen_compact_density: 'UI display density preference (comfortable vs compact tabular density)'
};

/**
 * Retrieves a cookie value by name. Returns null if not found or on SSR.
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const nameEQ = encodeURIComponent(name) + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    }
  } catch (err) {
    console.error(`[CookieManager] Error reading cookie "${name}":`, err);
  }
  return null;
}

/**
 * Sets a cookie with configurable expiration, path, sameSite, and secure attributes.
 */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  if (typeof document === 'undefined') return;
  try {
    const {
      days = 30,
      path = '/',
      sameSite = 'Lax',
      secure = typeof window !== 'undefined' && window.location.protocol === 'https:'
    } = options;

    let expires = '';
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = `; expires=${date.toUTCString()}`;
    }

    const sameSiteStr = `; SameSite=${sameSite}`;
    const secureStr = secure ? '; Secure' : '';

    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${expires}; path=${path}${sameSiteStr}${secureStr}`;
  } catch (err) {
    console.error(`[CookieManager] Error setting cookie "${name}":`, err);
  }
}

/**
 * Deletes a cookie by setting its expiration date to the past.
 */
export function deleteCookie(name: string, path: string = '/'): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`;
  } catch (err) {
    console.error(`[CookieManager] Error deleting cookie "${name}":`, err);
  }
}

/**
 * Returns all accessible cookies as key-value pairs.
 */
export function getAllCookies(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const cookies: Record<string, string> = {};
  try {
    if (!document.cookie) return cookies;
    const items = document.cookie.split(';');
    for (const item of items) {
      const parts = item.split('=');
      const key = decodeURIComponent(parts[0]?.trim() || '');
      const value = decodeURIComponent(parts.slice(1).join('=')?.trim() || '');
      if (key) cookies[key] = value;
    }
  } catch (err) {
    console.error('[CookieManager] Error parsing all cookies:', err);
  }
  return cookies;
}

/**
 * Returns detailed metadata for all cookies currently stored in document.cookie.
 */
export function getCookieDetails(): CookieDetail[] {
  const all = getAllCookies();
  const entries: CookieDetail[] = [];

  for (const [name, value] of Object.entries(all)) {
    const rawString = `${name}=${value}`;
    const sizeBytes = new Blob([rawString]).size;
    const isDeen = name.startsWith('deen_');
    const description = COOKIE_DESCRIPTIONS[name] || (isDeen ? 'DEEN system preference' : 'Browser or third-party cookie');

    entries.push({
      name,
      value,
      sizeBytes,
      isDeenCookie: isDeen,
      description
    });
  }

  // Sort: DEEN cookies first, then alphabetical
  return entries.sort((a, b) => {
    if (a.isDeenCookie && !b.isDeenCookie) return -1;
    if (!a.isDeenCookie && b.isDeenCookie) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Deletes all cookies prefixed with 'deen_'.
 */
export function clearAllDeenCookies(): number {
  if (typeof document === 'undefined') return 0;
  const all = getAllCookies();
  let count = 0;
  for (const name of Object.keys(all)) {
    if (name.startsWith('deen_')) {
      deleteCookie(name);
      count++;
    }
  }
  return count;
}

/**
 * Deletes all accessible cookies in the current origin.
 */
export function clearAllCookies(): number {
  if (typeof document === 'undefined') return 0;
  const all = getAllCookies();
  let count = 0;
  for (const name of Object.keys(all)) {
    deleteCookie(name);
    count++;
  }
  return count;
}

/**
 * Ensures a valid session ID exists in cookies. If not present, creates one.
 */
export function getOrCreateSessionId(): string {
  let sessionId = getCookie(DEEN_COOKIE_KEYS.SESSION_ID);
  if (!sessionId) {
    const randomHex = Math.random().toString(36).substring(2, 10);
    sessionId = `session_${Date.now()}_${randomHex}`;
    setCookie(DEEN_COOKIE_KEYS.SESSION_ID, sessionId, { days: 90 });
  }
  return sessionId;
}
