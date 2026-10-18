import crypto from 'crypto';
import { getSecretsConfig } from './secrets';

export interface GA4OverviewData {
  connected: boolean;
  propertyId: string;
  currency: string;
  timeZone: string;
  activeUsers: number;
  sessions: number;
  screenPageViews: number;
  bounceRatePercent: number;
  averageSessionDurationSec: number;
  conversions: number;
  totalRevenue: number;
  transactions: number;
  realtimeActiveUsers: number;
  realtimePageViews: number;
  conversionRatePercent: number;
  averageRevenuePerUser: number;
  latencyMs: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface GA4ChannelData {
  channel: string;
  sessions: number;
  activeUsers: number;
  conversions: number;
  totalRevenue: number;
  sharePercent: number;
}

export interface GA4PageData {
  pagePath: string;
  pageTitle: string;
  screenPageViews: number;
  activeUsers: number;
  bounceRatePercent: number;
}

export interface GA4GeoData {
  city: string;
  country: string;
  activeUsers: number;
  sessions: number;
  sharePercent: number;
}

export interface GA4FunnelEvent {
  eventName: string;
  label: string;
  eventCount: number;
  dropoffRatePercent?: number;
}

export interface GA4DailyPoint {
  date: string;
  rawDate: string;
  activeUsers: number;
  sessions: number;
  conversions: number;
  totalRevenue: number;
}

export interface GA4DeviceData {
  deviceCategory: string;
  sessions: number;
  activeUsers: number;
  sharePercent: number;
}

export interface GA4FullReport {
  success: boolean;
  overview: GA4OverviewData;
  channels: GA4ChannelData[];
  topPages: GA4PageData[];
  geo: GA4GeoData[];
  funnel: GA4FunnelEvent[];
  dailyTimeline: GA4DailyPoint[];
  devices: GA4DeviceData[];
  error?: string;
}

// In-memory token cache to prevent redundant OAuth requests
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

function base64Url(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Generates an OAuth2 access token for Google Cloud Service Account
 */
export async function getGoogleServiceAccountAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && tokenExpiresAt > now + 300) {
    return cachedAccessToken;
  }

  const secrets = getSecretsConfig();
  const sa = secrets.gcp_service_account;

  if (!sa.client_email || !sa.private_key) {
    throw new Error('GCP Service Account credentials (client_email or private_key) are missing.');
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
  };

  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signInput);
  signer.end();
  const signature = signer
    .sign(sa.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signInput}.${signature}`;

  const tokenRes = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(
      `Google OAuth2 error: ${tokenData.error_description || tokenData.error || 'Token acquisition failed'}`
    );
  }

  cachedAccessToken = tokenData.access_token;
  tokenExpiresAt = now + (tokenData.expires_in || 3600);
  return tokenData.access_token;
}

/**
 * Converts high-level date scope identifier to GA4 API date range
 */
export function resolveGA4DateRange(range: string = '30d'): { startDate: string; endDate: string } {
  const trimmed = range.toLowerCase().trim();
  if (trimmed === 'today') {
    return { startDate: 'today', endDate: 'today' };
  } else if (trimmed === '7d' || trimmed === 'last7') {
    return { startDate: '7daysAgo', endDate: 'today' };
  } else if (trimmed === '30d' || trimmed === 'last30' || trimmed === 'month') {
    return { startDate: '30daysAgo', endDate: 'today' };
  } else if (trimmed === '90d' || trimmed === 'last90') {
    return { startDate: '90daysAgo', endDate: 'today' };
  } else if (trimmed.includes(':')) {
    const [start, end] = trimmed.split(':');
    return { startDate: start, endDate: end || 'today' };
  }
  return { startDate: '30daysAgo', endDate: 'today' };
}

/**
 * Quick diagnostic ping to check GA4 connectivity and property settings
 */
export async function testGA4Connection(): Promise<{
  connected: boolean;
  propertyId: string;
  clientEmail: string;
  currency?: string;
  timeZone?: string;
  realtimeUsers?: number;
  message: string;
  latencyMs: number;
}> {
  const startTime = Date.now();
  const secrets = getSecretsConfig();
  const propertyId = secrets.ga4.property_id || '123456789';
  const clientEmail = secrets.gcp_service_account.client_email;

  if (!propertyId || !clientEmail || !secrets.gcp_service_account.private_key) {
    return {
      connected: false,
      propertyId,
      clientEmail,
      message: 'GA4 or GCP Service Account credentials not configured.',
      latencyMs: Date.now() - startTime,
    };
  }

  try {
    const accessToken = await getGoogleServiceAccountAccessToken();

    // Query realtime endpoint for minimal latency health-check
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics: [{ name: 'activeUsers' }],
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      return {
        connected: false,
        propertyId,
        clientEmail,
        message: data.error?.message || 'Failed to query GA4 Data API.',
        latencyMs: Date.now() - startTime,
      };
    }

    const realtimeUsers = parseInt(data.rows?.[0]?.metricValues?.[0]?.value || '0', 10);

    return {
      connected: true,
      propertyId,
      clientEmail,
      currency: 'BDT',
      timeZone: 'Asia/Dhaka',
      realtimeUsers,
      message: `Connected to Google Analytics 4 Property #${propertyId} (${realtimeUsers} active users right now).`,
      latencyMs: Date.now() - startTime,
    };
  } catch (err: unknown) {
    return {
      connected: false,
      propertyId,
      clientEmail,
      message: err instanceof Error ? err.message : 'Unexpected connection error while authenticating with GA4.',
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Fetches comprehensive Google Analytics 4 metrics & breakdown reports
 */
export async function fetchFullGA4Analytics(dateRangeIdentifier: string = '30d'): Promise<GA4FullReport> {
  const startTime = Date.now();
  const secrets = getSecretsConfig();
  const propertyId = secrets.ga4.property_id || '123456789';
  const range = resolveGA4DateRange(dateRangeIdentifier);

  try {
    const accessToken = await getGoogleServiceAccountAccessToken();

    // 1. Fetch Overview Report
    const overviewPromise = fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [range],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'conversions' },
            { name: 'totalRevenue' },
            { name: 'transactions' },
          ],
        }),
      }
    ).then((r) => r.json());

    // 2. Fetch Realtime Active Users
    const realtimePromise = fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
        }),
      }
    ).then((r) => r.json());

    // 3. Fetch Channel Acquisition Breakdown
    const channelsPromise = fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [range],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [
            { name: 'sessions' },
            { name: 'activeUsers' },
            { name: 'conversions' },
            { name: 'totalRevenue' },
          ],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 10,
        }),
      }
    ).then((r) => r.json());

    // 4. Fetch Top Landing & Browsing Pages
    const pagesPromise = fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [range],
          dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
          metrics: [
            { name: 'screenPageViews' },
            { name: 'activeUsers' },
            { name: 'bounceRate' },
          ],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 8,
        }),
      }
    ).then((r) => r.json());

    // 5. Fetch Geographic Distribution (Cities in BD / Global)
    const geoPromise = fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [range],
          dimensions: [{ name: 'city' }, { name: 'country' }],
          metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
          limit: 8,
        }),
      }
    ).then((r) => r.json());

    // 6. Fetch Key Funnel Events
    const funnelPromise = fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [range],
          dimensions: [{ name: 'eventName' }],
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: {
            filter: {
              fieldName: 'eventName',
              inListFilter: {
                values: ['page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'purchase'],
              },
            },
          },
        }),
      }
    ).then((r) => r.json());

    // 7. Fetch Daily Timeseries for trends and charts
    const timelinePromise = fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [range],
          dimensions: [{ name: 'date' }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'conversions' },
            { name: 'totalRevenue' },
          ],
          orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
        }),
      }
    ).then((r) => r.json());

    // 8. Fetch Device Platform Categories
    const devicePromise = fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [range],
          dimensions: [{ name: 'deviceCategory' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        }),
      }
    ).then((r) => r.json());

    const [overviewData, realtimeData, channelsData, pagesData, geoData, funnelData, timelineData, deviceData] =
      await Promise.all([
        overviewPromise,
        realtimePromise,
        channelsPromise,
        pagesPromise,
        geoPromise,
        funnelPromise,
        timelinePromise,
        devicePromise,
      ]);

    // Parse overview numbers
    const ovRow = overviewData?.rows?.[0]?.metricValues || [];
    const activeUsers = parseInt(ovRow[0]?.value || '0', 10);
    const sessions = parseInt(ovRow[1]?.value || '0', 10);
    const screenPageViews = parseInt(ovRow[2]?.value || '0', 10);
    const bounceRatePercent = parseFloat((parseFloat(ovRow[3]?.value || '0') * 100).toFixed(1));
    const averageSessionDurationSec = Math.round(parseFloat(ovRow[4]?.value || '0'));
    const conversions = Math.round(parseFloat(ovRow[5]?.value || '0'));
    const totalRevenue = Math.round(parseFloat(ovRow[6]?.value || '0'));
    const transactions = parseInt(ovRow[7]?.value || '0', 10);

    const realtimeActiveUsers = parseInt(realtimeData?.rows?.[0]?.metricValues?.[0]?.value || '0', 10);
    const realtimePageViews = parseInt(realtimeData?.rows?.[0]?.metricValues?.[1]?.value || '0', 10);

    const conversionRatePercent = sessions > 0 ? parseFloat(((conversions / sessions) * 100).toFixed(2)) : 0;
    const averageRevenuePerUser = activeUsers > 0 ? Math.round(totalRevenue / activeUsers) : 0;

    interface GA4Row {
      dimensionValues?: Array<{ value?: string }>;
      metricValues?: Array<{ value?: string }>;
    }

    // Parse channels
    const channels: GA4ChannelData[] = ((channelsData?.rows || []) as GA4Row[]).map((row) => {
      const channel = row.dimensionValues?.[0]?.value || 'Other';
      const cSessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const cUsers = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const cConv = Math.round(parseFloat(row.metricValues?.[2]?.value || '0'));
      const cRev = Math.round(parseFloat(row.metricValues?.[3]?.value || '0'));
      const share = sessions > 0 ? parseFloat(((cSessions / sessions) * 100).toFixed(1)) : 0;
      return {
        channel,
        sessions: cSessions,
        activeUsers: cUsers,
        conversions: cConv,
        totalRevenue: cRev,
        sharePercent: share,
      };
    });

    // Parse top pages
    const topPages: GA4PageData[] = ((pagesData?.rows || []) as GA4Row[]).map((row) => ({
      pagePath: row.dimensionValues?.[0]?.value || '/',
      pageTitle: row.dimensionValues?.[1]?.value || 'Untitled',
      screenPageViews: parseInt(row.metricValues?.[0]?.value || '0', 10),
      activeUsers: parseInt(row.metricValues?.[1]?.value || '0', 10),
      bounceRatePercent: parseFloat((parseFloat(row.metricValues?.[2]?.value || '0') * 100).toFixed(1)),
    }));

    // Parse geo
    const geo: GA4GeoData[] = ((geoData?.rows || []) as GA4Row[]).map((row) => {
      const city = row.dimensionValues?.[0]?.value || 'Unknown';
      const country = row.dimensionValues?.[1]?.value || 'Bangladesh';
      const gUsers = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const gSessions = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const share = activeUsers > 0 ? parseFloat(((gUsers / activeUsers) * 100).toFixed(1)) : 0;
      return {
        city: city === '(not set)' ? 'Other Regions' : city,
        country,
        activeUsers: gUsers,
        sessions: gSessions,
        sharePercent: share,
      };
    });

    // Parse funnel
    const funnelMap: Record<string, number> = {};
    ((funnelData?.rows || []) as GA4Row[]).forEach((row) => {
      const evName = row.dimensionValues?.[0]?.value;
      const count = parseInt(row.metricValues?.[0]?.value || '0', 10);
      if (evName) funnelMap[evName] = count;
    });

    const funnelOrder = [
      { eventName: 'page_view', label: '1. Store Visits (Page View)' },
      { eventName: 'view_item', label: '2. Product Views (View Item)' },
      { eventName: 'add_to_cart', label: '3. Cart Additions (Add to Cart)' },
      { eventName: 'begin_checkout', label: '4. Checkout Started (Initiate Checkout)' },
      { eventName: 'purchase', label: '5. Completed Orders (Purchase)' },
    ];

    let prevCount = 0;
    const funnel: GA4FunnelEvent[] = funnelOrder.map((step, idx) => {
      const count = funnelMap[step.eventName] || 0;
      let dropoff = 0;
      if (idx > 0 && prevCount > 0) {
        dropoff = parseFloat((((prevCount - count) / prevCount) * 100).toFixed(1));
      }
      prevCount = count;
      return {
        eventName: step.eventName,
        label: step.label,
        eventCount: count,
        dropoffRatePercent: idx === 0 ? 0 : Math.max(0, dropoff),
      };
    });

    // Parse daily timeline
    function formatGA4Date(raw: string): string {
      if (!raw || raw.length !== 8) return raw;
      const month = parseInt(raw.substring(4, 6), 10) - 1;
      const day = parseInt(raw.substring(6, 8), 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[month] || ''} ${day}`;
    }

    const dailyTimeline: GA4DailyPoint[] = ((timelineData?.rows || []) as GA4Row[]).map((row) => {
      const rawDate = row.dimensionValues?.[0]?.value || '';
      return {
        rawDate,
        date: formatGA4Date(rawDate),
        activeUsers: parseInt(row.metricValues?.[0]?.value || '0', 10),
        sessions: parseInt(row.metricValues?.[1]?.value || '0', 10),
        conversions: Math.round(parseFloat(row.metricValues?.[2]?.value || '0')),
        totalRevenue: Math.round(parseFloat(row.metricValues?.[3]?.value || '0')),
      };
    });

    // Parse devices
    const totalDeviceSessions = ((deviceData?.rows || []) as GA4Row[]).reduce(
      (acc: number, r) => acc + parseInt(r.metricValues?.[0]?.value || '0', 10),
      0
    );
    const devices: GA4DeviceData[] = ((deviceData?.rows || []) as GA4Row[]).map((row) => {
      const devCat = row.dimensionValues?.[0]?.value || 'desktop';
      const dSessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
      const dUsers = parseInt(row.metricValues?.[1]?.value || '0', 10);
      const share = totalDeviceSessions > 0 ? parseFloat(((dSessions / totalDeviceSessions) * 100).toFixed(1)) : 0;
      return {
        deviceCategory: devCat,
        sessions: dSessions,
        activeUsers: dUsers,
        sharePercent: share,
      };
    });

    return {
      success: true,
      overview: {
        connected: true,
        propertyId,
        currency: overviewData.metadata?.currencyCode || 'BDT',
        timeZone: overviewData.metadata?.timeZone || 'Asia/Dhaka',
        activeUsers,
        sessions,
        screenPageViews,
        bounceRatePercent,
        averageSessionDurationSec,
        conversions,
        totalRevenue,
        transactions,
        realtimeActiveUsers,
        realtimePageViews,
        conversionRatePercent,
        averageRevenuePerUser,
        latencyMs: Date.now() - startTime,
        dateRange: range,
      },
      channels,
      topPages,
      geo,
      funnel,
      dailyTimeline,
      devices,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      overview: {
        connected: false,
        propertyId,
        currency: 'BDT',
        timeZone: 'Asia/Dhaka',
        activeUsers: 0,
        sessions: 0,
        screenPageViews: 0,
        bounceRatePercent: 0,
        averageSessionDurationSec: 0,
        conversions: 0,
        totalRevenue: 0,
        transactions: 0,
        realtimeActiveUsers: 0,
        realtimePageViews: 0,
        conversionRatePercent: 0,
        averageRevenuePerUser: 0,
        latencyMs: Date.now() - startTime,
        dateRange: range,
      },
      channels: [],
      topPages: [],
      geo: [],
      funnel: [],
      dailyTimeline: [],
      devices: [],
      error: errorMsg || 'Failed to fetch Google Analytics 4 report.',
    };
  }
}
