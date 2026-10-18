/**
 * Security: SSRF Protection & Safe Endpoint URL Validator
 *
 * Prevents Server-Side Request Forgery (SSRF), DNS rebinding tricks,
 * cloud metadata exfiltration (AWS, GCP, Azure, Alibaba), and unauthorized internal network access.
 *
 * Hardened against:
 * - IPv6 bracketed forms (e.g. https://[::1]/, https://[::]/)
 * - IPv4-mapped IPv6 (e.g. https://[::ffff:7f00:1]/, https://[::ffff:127.0.0.1]/)
 * - Link-local IPv6 (fe80::/10) and Unique Local Addresses / ULA (fc00::/7, including AWS IMDSv2 fd00:ec2::254)
 * - Alternative IPv4 formats (DWORD decimal, hex, octal)
 * - DNS rebinding wildcard domains (nip.io, sslip.io, localtest.me, etc.)
 * - Non-routable internal TLDs (.localhost, .local, .internal, .lan, etc.)
 * - Embedded IP hostnames (e.g. 127.0.0.1.attacker.com)
 * - Credential smuggling in URLs
 */

// Link-local & cloud metadata IPs (AWS, GCP, Azure, OpenStack, DigitalOcean, Alibaba)
const CLOUD_METADATA_HOSTS = new Set([
  '169.254.169.254',
  '169.254.170.2',
  'metadata.google.internal',
  'metadata',
  'instance-data',
  '100.100.100.200', // Alibaba cloud metadata
  'fd00:ec2::254',   // AWS IMDSv2 IPv6
]);

const LOCAL_LOOPBACK_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '::',
  '0:0:0:0:0:0:0:1',
  '0:0:0:0:0:0:0:0',
]);

const BLOCKED_REBINDING_DOMAINS = [
  'nip.io',
  'sslip.io',
  'localtest.me',
  'vcap.me',
  'lvh.me',
  'fwh.is',
  '127-0-0-1.org',
  'burpcollaborator.net',
  'oastify.com',
  'dnslog.cn',
];

const BLOCKED_INTERNAL_TLDS = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.corp',
  '.home',
  '.intranet',
  '.arpa',
  '.test',
  '.example',
  '.invalid',
];

const FORBIDDEN_PORTS = new Set([
  '21', '22', '23', '25', '53', '110', '111', '135', '137', '138', '139', '143',
  '389', '445', '636', '1433', '1521', '2049', '2375', '2376', '3306', '3389',
  '5432', '5984', '6379', '9200', '11211', '27017', '28017'
]);

/**
 * Checks if 4 octets fall within private, loopback, or restricted IPv4 ranges.
 */
function isRestrictedOctets(b0: number, b1: number, b2: number, b3: number): boolean {
  if ([b0, b1, b2, b3].some((n) => isNaN(n) || n < 0 || n > 255)) return true;

  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;
  // 10.0.0.0/8 (RFC 1918 Private)
  if (b0 === 10) return true;
  // 172.16.0.0/12 (172.16.x.x - 172.31.x.x RFC 1918 Private)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
  // 192.168.0.0/16 (RFC 1918 Private)
  if (b0 === 192 && b1 === 168) return true;
  // 169.254.0.0/16 (Link-local / Cloud Metadata / APIPA)
  if (b0 === 169 && b1 === 254) return true;
  // 0.0.0.0/8 (Current network)
  if (b0 === 0) return true;
  // 100.64.0.0/10 (Carrier-Grade NAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (b0 === 192 && b1 === 0 && b2 === 0) return true;
  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (Documentation / Test nets)
  if (b0 === 192 && b1 === 0 && b2 === 2) return true;
  if (b0 === 198 && b1 === 51 && b2 === 100) return true;
  if (b0 === 203 && b1 === 0 && b2 === 113) return true;
  // 224.0.0.0/4 (Multicast)
  if (b0 >= 224 && b0 <= 239) return true;
  // 240.0.0.0/4 (Reserved / Future Use)
  if (b0 >= 240) return true;

  return false;
}

/**
 * Checks if an IPv4 address string falls within private/internal/restricted ranges.
 */
function isPrivateIPv4(ip: string): boolean {
  // 1. Standard dotted-decimal
  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
    return isRestrictedOctets(parts[0], parts[1], parts[2], parts[3]);
  }

  // 2. DWORD integer format (e.g. 2130706433 -> 127.0.0.1)
  if (/^\d+$/.test(ip)) {
    const num = Number(ip);
    if (!isNaN(num) && num >= 0 && num <= 4294967295) {
      const b0 = (num >>> 24) & 255;
      const b1 = (num >>> 16) & 255;
      const b2 = (num >>> 8) & 255;
      const b3 = num & 255;
      return isRestrictedOctets(b0, b1, b2, b3);
    }
  }

  return false;
}

/**
 * Checks if an IPv6 address string is private, loopback, link-local, or cloud metadata.
 * Handles bracketed, compressed, and IPv4-mapped representations.
 */
function isRestrictedIPv6(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, '').toLowerCase().trim();

  // Loopback & Unspecified
  if (clean === '::1' || clean === '::' || clean === '0:0:0:0:0:0:0:1' || clean === '0:0:0:0:0:0:0:0') {
    return true;
  }

  // AWS IMDSv2 IPv6
  if (clean === 'fd00:ec2::254' || clean.startsWith('fd00:ec2:')) {
    return true;
  }

  // Link-Local IPv6 (fe80::/10 -> fe8, fe9, fea, feb)
  if (/^fe[89ab]/i.test(clean)) {
    return true;
  }

  // Unique Local Address (ULA fc00::/7 -> fc, fd)
  if (/^f[cd]/i.test(clean)) {
    return true;
  }

  // Multicast (ff00::/8)
  if (clean.startsWith('ff')) {
    return true;
  }

  // Discard prefix (100::/64), documentation (2001:db8::/32), benchmarking (2001:2::/48)
  if (clean.startsWith('100:') || clean.startsWith('2001:db8:') || clean.startsWith('2001:2:')) {
    return true;
  }

  // IPv4-mapped IPv6:
  // Can be formatted as ::ffff:127.0.0.1 OR ::ffff:7f00:1 (hex words)
  const mappedDottedMatch = clean.match(/(?:^|:)ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (mappedDottedMatch) {
    return isPrivateIPv4(mappedDottedMatch[1]);
  }

  const mappedHexMatch = clean.match(/(?:^|:)ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (mappedHexMatch) {
    const w1 = parseInt(mappedHexMatch[1], 16);
    const w2 = parseInt(mappedHexMatch[2], 16);
    const b0 = (w1 >> 8) & 0xff;
    const b1 = w1 & 0xff;
    const b2 = (w2 >> 8) & 0xff;
    const b3 = w2 & 0xff;
    return isRestrictedOctets(b0, b1, b2, b3);
  }

  return false;
}

/**
 * Checks for DNS tricks, wildcard rebinding, and non-routable internal domains.
 */
function isForbiddenDnsOrHostname(hostname: string): { forbidden: boolean; reason?: string } {
  const host = hostname.toLowerCase().trim();

  // 1. Non-routable internal TLDs
  for (const tld of BLOCKED_INTERNAL_TLDS) {
    if (host === tld.slice(1) || host.endsWith(tld)) {
      return { forbidden: true, reason: `Internal/reserved TLD "${tld}" is forbidden (SSRF protection).` };
    }
  }

  // 2. Wildcard DNS rebinding services
  for (const domain of BLOCKED_REBINDING_DOMAINS) {
    if (host === domain || host.endsWith(`.${domain}`)) {
      return { forbidden: true, reason: `DNS rebinding wildcard service "${domain}" is forbidden (SSRF protection).` };
    }
  }

  // 3. Embedded private/loopback IP address in subdomain
  if (/^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/i.test(host)) {
    return { forbidden: true, reason: `Host "${host}" embeds a private/loopback IP address (SSRF protection).` };
  }

  return { forbidden: false };
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

  // 1. Enforce no user credentials in outbound URLs
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs containing embedded credentials (user:pass) are strictly forbidden.' };
  }

  // 2. Enforce standard ports (block dangerous protocol ports)
  if (parsed.port && FORBIDDEN_PORTS.has(parsed.port)) {
    return { valid: false, error: `Port "${parsed.port}" is restricted for outbound requests.` };
  }

  // 3. Extract and sanitize hostname (strip IPv6 brackets if present)
  const rawHostname = parsed.hostname.toLowerCase();
  const cleanHostname = rawHostname.replace(/^\[|\]$/g, '');

  // 4. Critical: Reject cloud metadata addresses unconditionally
  if (CLOUD_METADATA_HOSTS.has(cleanHostname) || cleanHostname.startsWith('169.254.')) {
    return { valid: false, error: `Access to link-local/cloud metadata host "${rawHostname}" is strictly forbidden (SSRF protection).` };
  }

  // 5. Enforce HTTPS (allow HTTP only for localhost/127.0.0.1 in non-prod dev)
  if (parsed.protocol !== 'https:') {
    const isLocalDevHttp = allowLocal && parsed.protocol === 'http:' && (cleanHostname === 'localhost' || cleanHostname === '127.0.0.1');
    if (!isLocalDevHttp) {
      return { valid: false, error: `Protocol "${parsed.protocol}" is rejected. Only "https:" endpoints are permitted.` };
    }
  }

  // 6. Reject local loopbacks
  if (LOCAL_LOOPBACK_HOSTS.has(cleanHostname)) {
    if (!allowLocal) {
      return { valid: false, error: `Access to loopback host "${rawHostname}" is forbidden in production.` };
    }
  }

  // 7. Reject IPv6 loopback, link-local, ULA, and IPv4-mapped private ranges
  if (cleanHostname.includes(':') && isRestrictedIPv6(cleanHostname)) {
    if (!allowLocal || cleanHostname !== '::1') {
      return { valid: false, error: `Access to restricted IPv6 host "${rawHostname}" is forbidden (SSRF protection).` };
    }
  }

  // 8. Reject private RFC 1918 & restricted IPv4 ranges
  if (isPrivateIPv4(cleanHostname)) {
    if (!(allowLocal && (cleanHostname === '127.0.0.1' || cleanHostname === 'localhost'))) {
      return { valid: false, error: `Access to private IP range "${cleanHostname}" is forbidden (SSRF protection).` };
    }
  }

  // 9. DNS Tricks & Rebinding Protections
  const dnsCheck = isForbiddenDnsOrHostname(cleanHostname);
  if (dnsCheck.forbidden) {
    if (!(allowLocal && cleanHostname.endsWith('.localhost'))) {
      return { valid: false, error: dnsCheck.reason || `Host "${cleanHostname}" is forbidden.` };
    }
  }

  // 10. Domain allowlist check (if specified)
  if (options?.allowedDomains && options.allowedDomains.length > 0) {
    const isDomainAllowed = options.allowedDomains.some((dom) => {
      const cleanDom = dom.toLowerCase().trim();
      return cleanHostname === cleanDom || cleanHostname.endsWith(`.${cleanDom}`);
    });
    if (!isDomainAllowed) {
      return { valid: false, error: `Host "${cleanHostname}" does not match allowed domain list [${options.allowedDomains.join(', ')}].` };
    }
  }

  return { valid: true, sanitizedUrl: parsed.origin + parsed.pathname };
}
