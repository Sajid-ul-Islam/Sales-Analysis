/**
 * Security: SSRF Protection & Safe Endpoint URL Validator
 *
 * Prevents Server-Side Request Forgery (SSRF) and credential exfiltration
 * by validating that dynamic URLs provided via request payloads or settings
 * are strictly public, valid HTTPS endpoints and do not target cloud metadata,
 * internal loopbacks, or private network IP ranges.
 */

// Link-local & cloud metadata IPs (AWS, GCP, Azure, OpenStack, DigitalOcean)
// MUST NEVER be allowed under any circumstances, even in dev.
const CLOUD_METADATA_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata',
  'instance-data',
  '100.100.100.200', // Alibaba cloud metadata
]);

const LOCAL_LOOPBACK_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
]);

/**
 * Checks if an IPv4 address falls within private/internal RFC 1918 ranges.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;

  // 10.0.0.0/8
  if (parts[0] === 10) return true;
  // 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 127.0.0.0/8 (Loopback)
  if (parts[0] === 127) return true;
  // 169.254.0.0/16 (Link-local / Cloud Metadata)
  if (parts[0] === 169 && parts[1] === 254) return true;
  // 0.0.0.0/8
  if (parts[0] === 0) return true;

  return false;
}

export interface UrlValidationResult {
  valid: boolean;
  sanitizedUrl?: string;
  error?: string;
}

/**
 * Validates that a candidate URL is safe for server-side outbound HTTP requests.
 */
export function validateSafeOutboundUrl(
  rawUrl: string,
  options?: {
    allowedDomains?: string[];
    allowLocalInDev?: boolean;
  }
): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'URL must be a non-empty string.' };
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }

  const isDev = process.env.NODE_ENV !== 'production';
  const allowLocal = options?.allowLocalInDev && isDev;
  const hostname = parsed.hostname.toLowerCase();

  // 1. Critical: Reject cloud metadata addresses unconditionally
  if (CLOUD_METADATA_HOSTS.has(hostname) || hostname.startsWith('169.254.')) {
    return { valid: false, error: `Access to link-local/cloud metadata host "${hostname}" is strictly forbidden (SSRF protection).` };
  }

  // 2. Enforce HTTPS (allow HTTP only for localhost/127.0.0.1 in non-prod dev)
  if (parsed.protocol !== 'https:') {
    if (!(allowLocal && parsed.protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1'))) {
      return { valid: false, error: `Protocol "${parsed.protocol}" is rejected. Only "https:" endpoints are permitted.` };
    }
  }

  // 3. Reject local loopbacks in production
  if (LOCAL_LOOPBACK_HOSTS.has(hostname) && !allowLocal) {
    return { valid: false, error: `Access to loopback host "${hostname}" is forbidden in production.` };
  }

  // 4. Reject private RFC 1918 IP ranges
  if (isPrivateIPv4(hostname)) {
    if (!(allowLocal && (hostname === '127.0.0.1' || hostname === 'localhost'))) {
      return { valid: false, error: `Access to private IP range "${hostname}" is forbidden (SSRF protection).` };
    }
  }

  // 5. Domain allowlist check (if specified)
  if (options?.allowedDomains && options.allowedDomains.length > 0) {
    const isDomainAllowed = options.allowedDomains.some((dom) => {
      const cleanDom = dom.toLowerCase().trim();
      return hostname === cleanDom || hostname.endsWith(`.${cleanDom}`);
    });
    if (!isDomainAllowed) {
      return { valid: false, error: `Host "${hostname}" does not match allowed domain list [${options.allowedDomains.join(', ')}].` };
    }
  }

  return { valid: true, sanitizedUrl: parsed.origin + parsed.pathname };
}
