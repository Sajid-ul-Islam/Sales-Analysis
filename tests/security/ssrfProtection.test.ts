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

    it('rejects cloud metadata IP 169.254.169.254', () => {
      const res = validateSafeOutboundUrl('https://169.254.169.254/latest/meta-data/');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/SSRF protection/);
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
