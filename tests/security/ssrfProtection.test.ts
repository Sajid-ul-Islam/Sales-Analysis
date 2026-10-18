import { describe, it, expect } from 'vitest';
import { validateSafeOutboundUrl } from '@/lib/security/urlValidator';
import { getSecretsWithOverrides } from '@/lib/secrets';

describe('Security: SSRF Prevention & Credential Exfiltration Isolation', () => {
  describe('validateSafeOutboundUrl', () => {
    it('allows valid public HTTPS URLs', () => {
      const res = validateSafeOutboundUrl('https://api-hermes.pathao.com/aladdin/api/v1/issue-token');
      expect(res.valid).toBe(true);
      expect(res.sanitizedUrl).toBe('https://api-hermes.pathao.com/aladdin/api/v1/issue-token');
    });

    it('rejects cloud metadata IP 169.254.169.254 and AWS IPv6 metadata [fd00:ec2::254]', () => {
      const res4 = validateSafeOutboundUrl('https://169.254.169.254/latest/meta-data/');
      expect(res4.valid).toBe(false);
      expect(res4.error).toMatch(/SSRF protection/);

      const res6 = validateSafeOutboundUrl('https://[fd00:ec2::254]/latest/meta-data/');
      expect(res6.valid).toBe(false);
      expect(res6.error).toMatch(/SSRF protection/);

      const resGoogle = validateSafeOutboundUrl('https://metadata.google.internal/computeMetadata/v1/');
      expect(resGoogle.valid).toBe(false);
      expect(resGoogle.error).toMatch(/SSRF protection/);
    });

    it('rejects bracketed IPv6 loopback and unspecified addresses', () => {
      const loopback1 = validateSafeOutboundUrl('https://[::1]/admin');
      expect(loopback1.valid).toBe(false);
      expect(loopback1.error).toMatch(/loopback|restricted IPv6|SSRF protection/i);

      const loopbackFull = validateSafeOutboundUrl('https://[0:0:0:0:0:0:0:1]/');
      expect(loopbackFull.valid).toBe(false);

      const unspecified = validateSafeOutboundUrl('https://[::]/');
      expect(unspecified.valid).toBe(false);
    });

    it('rejects IPv4-mapped IPv6 addresses targeting loopback or private networks', () => {
      // https://[::ffff:7f00:1]/ is IPv4 127.0.0.1 in hex words
      const mappedHex = validateSafeOutboundUrl('https://[::ffff:7f00:1]/api');
      expect(mappedHex.valid).toBe(false);
      expect(mappedHex.error).toMatch(/SSRF protection|restricted IPv6/i);

      // https://[::ffff:127.0.0.1]/
      const mappedDotted = validateSafeOutboundUrl('https://[::ffff:127.0.0.1]/');
      expect(mappedDotted.valid).toBe(false);
      expect(mappedDotted.error).toMatch(/SSRF protection|restricted IPv6/i);

      // https://[::ffff:a00:1]/ (10.0.0.1)
      const mappedPrivate = validateSafeOutboundUrl('https://[::ffff:a00:1]/');
      expect(mappedPrivate.valid).toBe(false);
      expect(mappedPrivate.error).toMatch(/SSRF protection|restricted IPv6/i);
    });

    it('rejects IPv6 link-local (fe80::) and unique local (fc00::/7) addresses', () => {
      const linkLocal = validateSafeOutboundUrl('https://[fe80::1]/');
      expect(linkLocal.valid).toBe(false);
      expect(linkLocal.error).toMatch(/SSRF protection|restricted IPv6/i);

      const ula = validateSafeOutboundUrl('https://[fc00::1]/');
      expect(ula.valid).toBe(false);
      expect(ula.error).toMatch(/SSRF protection|restricted IPv6/i);
    });

    it('rejects alternative IPv4 formats (DWORD decimal)', () => {
      // 2130706433 is 127.0.0.1
      const dword = validateSafeOutboundUrl('https://2130706433/');
      expect(dword.valid).toBe(false);
      expect(dword.error).toMatch(/loopback|private|SSRF protection/i);
    });

    it('rejects DNS rebinding wildcard domains and internal TLDs', () => {
      expect(validateSafeOutboundUrl('https://127.0.0.1.nip.io/').valid).toBe(false);
      expect(validateSafeOutboundUrl('https://10.0.0.1.sslip.io/').valid).toBe(false);
      expect(validateSafeOutboundUrl('https://localtest.me/').valid).toBe(false);
      expect(validateSafeOutboundUrl('https://app.localhost/').valid).toBe(false);
      expect(validateSafeOutboundUrl('https://corp-service.internal/').valid).toBe(false);
      expect(validateSafeOutboundUrl('https://server.local/').valid).toBe(false);
      expect(validateSafeOutboundUrl('https://127.0.0.1.evilcorp.com/').valid).toBe(false);
    });

    it('rejects URL with embedded credentials (credential exfiltration)', () => {
      const creds = validateSafeOutboundUrl('https://user:pass@api-hermes.pathao.com/');
      expect(creds.valid).toBe(false);
      expect(creds.error).toMatch(/embedded credentials/i);
    });

    it('rejects dangerous ports targeting internal services', () => {
      expect(validateSafeOutboundUrl('https://api-hermes.pathao.com:22/').valid).toBe(false);
      expect(validateSafeOutboundUrl('https://api-hermes.pathao.com:6379/').valid).toBe(false);
      expect(validateSafeOutboundUrl('https://api-hermes.pathao.com:27017/').valid).toBe(false);
    });

    it('rejects private IPv4 subnets (RFC 1918)', () => {
      expect(validateSafeOutboundUrl('https://10.0.0.1/api').valid).toBe(false);
      expect(validateSafeOutboundUrl('https://192.168.1.1/admin').valid).toBe(false);
      expect(validateSafeOutboundUrl('https://172.16.0.5/secrets').valid).toBe(false);
    });

    it('rejects non-HTTPS protocols like file:// or gopher:// or http:// in production', () => {
      expect(validateSafeOutboundUrl('file:///etc/passwd').valid).toBe(false);
      expect(validateSafeOutboundUrl('gopher://127.0.0.1:70/').valid).toBe(false);
    });

    it('enforces allowed domains whitelist when specified', () => {
      const resGood = validateSafeOutboundUrl('https://api-hermes.pathao.com', {
        allowedDomains: ['pathao.com'],
      });
      expect(resGood.valid).toBe(true);

      const resBad = validateSafeOutboundUrl('https://evil-hacker.com/aladdin', {
        allowedDomains: ['pathao.com'],
      });
      expect(resBad.valid).toBe(false);
      expect(resBad.error).toMatch(/does not match allowed domain list/);
    });
  });

  describe('getSecretsWithOverrides Credential Isolation', () => {
    it('does not leak server WooCommerce keys when an untrusted third-party store URL is supplied', () => {
      const secrets = getSecretsWithOverrides({
        woocommerce: {
          store_url: 'https://attacker-controlled-site.com',
        },
      });

      // Even if attacker changes store_url, the server keys are NOT forwarded!
      expect(secrets.woocommerce.store_url).toBe('https://attacker-controlled-site.com');
      expect(secrets.woocommerce.consumer_key).toBe('');
      expect(secrets.woocommerce.consumer_secret).toBe('');
    });

    it('rejects SSRF attempts targeting AWS metadata in WooCommerce overrides', () => {
      const secrets = getSecretsWithOverrides({
        woocommerce: {
          store_url: 'https://169.254.169.254/api',
        },
      });

      // Untrusted URL is rejected, maintaining the safe base store URL
      expect(secrets.woocommerce.store_url).not.toBe('https://169.254.169.254/api');
    });

    it('rejects non-pathao domains in Pathao base_url overrides', () => {
      const secrets = getSecretsWithOverrides({
        pathao: {
          base_url: 'https://evil-pathao-phishing.com',
        },
      });

      // Fallback stays on legitimate pathao base URL
      expect(secrets.pathao.base_url).not.toBe('https://evil-pathao-phishing.com');
    });
  });
});
