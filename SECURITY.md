# Security Policy & Telemetry: DEEN Commerce Reconciliation Engine

**Version:** 2.4.0  
**Classification:** Internal Confidential / Security Architecture  
**Enforcement:** Automated Pre-Commit · Serverless Boundary Shielding · HMAC-SHA256 Verification  
**Last Updated:** November 2026  

---

## 1. Security Architecture & Threat Model

The **DEEN Commerce Reconciliation Engine** processes sensitive commercial transactions, customer contact numbers, COD financial figures, and retail branch cash balances.

```
[ UNTRUSTED INTERNET ]
         │
         ▼
┌─────────────────────────────────┐
│     Cloudflare WAF & DDoS       │
│  (TLS 1.3, Rate-Limiting, CSP)  │
└────────────────┬────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│           Next.js 14 App Router API Boundary          │
│  • HMAC-SHA256 Signature Validation                    │
│  • Role-Based Session Decryption (AES-256-GCM)        │
│  • Secret Shielding (No secrets to client bundles)     │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│          Client Browser (In-Memory AlaSQL)             │
│  • Sanitized Order Records                             │
│  • XSS-Hardened React 18 VDOM                          │
│  • Frame Ancestor Embedding Defense                    │
└────────────────────────────────────────────────────────┘
```

---

## 2. API Key & Secret Hygiene

### 2.1 The Server-Side Secret Invariant
1. Secrets including `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET`, `WC_WEBHOOK_SECRET`, `PATHAO_CLIENT_SECRET`, and `GEMINI_API_KEY` must **NEVER** be prefixed with `NEXT_PUBLIC_`.
2. Any client-side reference to `process.env.PATHAO_CLIENT_SECRET` is blocked by Next.js compiler boundaries and caught by CI static analysis.
3. Serverless API routes in `src/app/api/` act as authenticating proxies, stripping credentials and returning only sanitized records to client browsers.

---

## 3. Webhook Authentication (HMAC-SHA256)

Incoming webhooks from WooCommerce or third-party courier services must be verified using cryptographic timing-safe comparisons before any event is committed to `sync-events.jsonl`:

```typescript
import crypto from 'crypto';

export function verifyWebhookSignature(
  rawPayload: string,
  providedSignature: string,
  secret: string
): boolean {
  if (!providedSignature || !secret) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawPayload, 'utf8')
    .digest('base64');

  const providedBuffer = Buffer.from(providedSignature, 'base64');
  const expectedBuffer = Buffer.from(expectedSignature, 'base64');

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}
```

---

## 4. Role-Based Access Control (RBAC) Matrix

Operators authenticating in the **Settings Tab** receive scoped roles:

| Capability / Tab | Executive Director (`👑`) | Branch Store Operator (`🏬`) | Read-Only Auditor (`👀`) |
|---|:---:|:---:|:---:|
| **Executive Overview & Margins** | Full Access | Hidden | View Only |
| **Gross Dispatched Revenue** | Full Access | Branch Scoped | View Only |
| **All-Branch Dispatches** | Full Access | Scoped to Assigned Store | View Only |
| **Live Operations Terminal** | Full Access | View Only | View Only |
| **Manual Status Overrides** | Allowed | Denied | Denied |
| **Multi-Sheet Excel Export** | Allowed | Denied | Allowed |
| **API Credentials Config** | Allowed | Denied | Denied |
| **AI Copilot Querying** | Allowed | Allowed | Allowed |

---

## 5. Content Security Policy (CSP) & Iframe Hardening

To prevent clickjacking and token exfiltration, `next.config.mjs` injects strict security headers:

```javascript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'self' https://deencommerce.com;"
  }
];
```

---

## 6. Vulnerability Disclosure Policy

If you discover a security vulnerability within the DEEN Commerce Reconciliation Engine:
1. **Do not create a public GitHub issue.**
2. Email full technical details and proof-of-concept steps to: **`security@deencommerce.com`**.
3. Our engineering security response team will acknowledge receipt within 24 hours and issue a patched release within 72 hours.
