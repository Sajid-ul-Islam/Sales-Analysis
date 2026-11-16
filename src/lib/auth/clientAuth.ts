/**
 * Client-Side Authentication Helper
 * Supplies Bearer authorization headers for internal frontend requests
 * to Next.js API endpoints.
 */

export const DEFAULT_INTERNAL_OPERATOR_TOKEN = '2d66a734e2c7fec920770a81fdcab9c8a292b487ac526134ba83e533b8382e60';

export function getClientAuthToken(): string {
  if (typeof window === 'undefined') {
    return process.env.API_BEARER_TOKEN || process.env.NEXT_PUBLIC_API_BEARER_TOKEN || DEFAULT_INTERNAL_OPERATOR_TOKEN;
  }

  try {
    // 1. Direct local storage token
    const direct = localStorage.getItem('deen_api_token');
    if (direct && direct.trim()) return direct.trim();

    // 2. Settings store token
    const settingsStr = localStorage.getItem('deen_app_settings');
    if (settingsStr) {
      const parsed = JSON.parse(settingsStr);
      if (parsed.apiToken && typeof parsed.apiToken === 'string') {
        return parsed.apiToken.trim();
      }
    }
  } catch {}

  // 3. Fallback to public environment variable or internal operator token
  return process.env.NEXT_PUBLIC_API_BEARER_TOKEN || DEFAULT_INTERNAL_OPERATOR_TOKEN;
}

export function getClientAuthHeaders(customHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  const token = getClientAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}
