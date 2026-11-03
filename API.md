# DEEN Commerce Reconciliation Engine — API Specification

**Version:** 2.4.0  
**Base URL:** `https://reconciliation.deencommerce.com` (Production) / `http://localhost:3000` (Development)  
**Security Protocols:** Bearer JWT · HMAC-SHA256 Webhook Signatures · Role-Based Access Control (RBAC)  
**Last Updated:** November 2026  

---

## 1. System Overview & Integration Topology

The DEEN Commerce Reconciliation Engine integrates with three external and internal systems:
1. **WooCommerce REST API v3**: Authoritative source for web orders, line items, prices, customer metadata, and POS register transactions (`sip_outlet_id`).
2. **Pathao Hermes Courier API**: Courier dispatch status, consignment IDs, COD collected cash, merchant delivery fee charges, customer delivery success rating.
3. **Internal App Router Serverless API**: Lightweight micro-services powering data synchronization, background webhooks, multi-month statements, and AI copilot analysis.

```
┌─────────────────────────────────┐           ┌──────────────────────────────────┐
│      WooCommerce REST API       │           │      Pathao Hermes API           │
│   (Orders, Line Items, POS)     │           │   (Consignments, COD, Fees)      │
└────────────────┬────────────────┘           └─────────────────┬────────────────┘
                 │                                              │
                 │ Webhook / Polling                            │ Webhook / Polling
                 ▼                                              ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│               DEEN RECONCILIATION API LAYER (Next.js 14 App Router)             │
│                                                                                │
│  • /api/sync/woocommerce   • /api/sync/pathao        • /api/sync/status        │
│  • /api/campaigns          • /api/sample-data        • /api/ai/query           │
└───────────────────────────────────────┬────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                 CLIENT DASHBOARD / ENGINE (AlaSQL + React 18)                  │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Next.js App Router Internal API Routes

### 2.1 `/api/sync/woocommerce`
Synchronizes commercial orders and POS register events from the central WooCommerce store.

- **Method:** `GET` / `POST`
- **Authentication:** Admin Session or `x-sync-api-key` header.
- **Query Parameters (GET):**
  - `start_date` (ISO-8601 string, e.g. `2026-11-01`): Start filter.
  - `end_date` (ISO-8601 string, e.g. `2026-11-30`): End filter.
  - `status` (string, comma-separated): e.g. `processing,completed,on-hold,cancelled`.
  - `outlet_id` (string, optional): e.g. `2` (Mirpur), `7` (Cumilla), `8` (Wari), `9` (Sylhet).
  - `page` (number, default `1`): Pagination page.
  - `per_page` (number, default `100`, max `100`): Results per page.

- **Sample Request:**
```bash
curl -X GET "https://reconciliation.deencommerce.com/api/sync/woocommerce?start_date=2026-11-01&end_date=2026-11-03" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

- **Success Response (200 OK):**
```json
{
  "status": "success",
  "synced_at": "2026-11-03T17:00:00.000Z",
  "total_records": 1420,
  "data": [
    {
      "id": 18924,
      "order_number": "18924",
      "created_via": "checkout",
      "status": "completed",
      "total": "2850.00",
      "shipping_total": "90.00",
      "payment_method": "cod",
      "date_created": "2026-11-02T10:14:00Z",
      "billing": {
        "first_name": "Sajid",
        "phone": "01711000000",
        "city": "Sylhet",
        "state": "SYL"
      },
      "line_items": [
        {
          "id": 4012,
          "name": "Classic Oxford Shirt - Olive / L",
          "product_id": 820,
          "variation_id": 1204,
          "quantity": 1,
          "price": 1450,
          "sku": "OXF-OLV-L"
        },
        {
          "id": 4013,
          "name": "Heavyweight Pique Polo - Navy / L",
          "product_id": 845,
          "variation_id": 1250,
          "quantity": 1,
          "price": 1310,
          "sku": "POL-NAV-L"
        }
      ],
      "meta_data": [
        { "key": "ptc_consignment_id", "value": "PT18924" },
        { "key": "_sip_outlet_id", "value": null }
      ]
    }
  ]
}
```

---

### 2.2 `/api/sync/pathao`
Synchronizes courier delivery milestones, cash collection settlements, and consignment status updates.

- **Method:** `GET` / `POST`
- **Authentication:** Bearer Token / Merchant Secret.
- **POST Action:** Triggers automated batch status check against Pathao Hermes endpoints for pending parcels.
- **Success Response (200 OK):**
```json
{
  "status": "success",
  "dispatched_count": 894,
  "delivered_count": 682,
  "returned_count": 145,
  "partial_count": 67,
  "cod_settled_amount": 1428590,
  "courier_fee_charged": 98450
}
```

---

### 2.3 `/api/sync/status`
Health check, API gateway latency, and live synchronization telemetry endpoint.

- **Method:** `GET`
- **Success Response (200 OK):**
```json
{
  "healthy": true,
  "timestamp": "2026-11-03T17:01:10.000Z",
  "version": "2.4.0",
  "integrations": {
    "woocommerce": {
      "status": "connected",
      "latency_ms": 142,
      "last_sync": "2026-11-03T16:50:00.000Z"
    },
    "pathao_hermes": {
      "status": "connected",
      "latency_ms": 285,
      "token_expires_at": "2027-01-20T00:00:00.000Z"
    },
    "gemini_ai": {
      "status": "ready",
      "model": "gemini-2.5-flash"
    }
  }
}
```

---

### 2.4 `/api/campaigns`
Fetches and updates multi-channel marketing campaigns, attribution models, and ad spend ROI.

- **Method:** `GET` / `POST` / `PUT`
- **Payload Schema (POST/PUT):**
```json
{
  "campaign_name": "Winter 26 Drop 1",
  "channel": "meta_ads",
  "start_date": "2026-11-01",
  "end_date": "2026-11-15",
  "ad_spend_bdt": 45000,
  "target_categories": ["Jackets", "Hoodies", "Polo"]
}
```

---

### 2.5 `/api/sample-data`
Provides zero-dependency fallback datasets when offline, in development, or running Vitest integration pipelines without production credentials.

- **Method:** `GET`
- **Returns:** Fully populated baseline JSON containing multi-month real orders (September, October, November 2026) with all edge cases (split branches, partial returns, size exchanges, and retail POS orders).

---

## 3. Pathao Hermes Courier API Reference

### 3.1 Authentication (OAuth2 Client Credentials)
- **Endpoint:** `POST https://api.hermes.pathao.com/aladdin/api/v1/issue-token`
- **Payload:**
```json
{
  "client_id": "DEEN_PATHAO_CLIENT_ID",
  "client_secret": "DEEN_PATHAO_CLIENT_SECRET",
  "username": "merchant@deencommerce.com",
  "password": "STORE_PASSWORD",
  "grant_type": "password"
}
```
- **Returns:** Access token with 90-day validity window.

### 3.2 Customer Phone Delivery Intelligence & Fraud Risk
- **Endpoint:** `GET https://api.hermes.pathao.com/aladdin/api/v1/user/success?phone=01711XXXXXX`
- **Header:** `Authorization: Bearer <TOKEN>`
- **Response:**
```json
{
  "type": "success",
  "code": 200,
  "data": {
    "total_orders": 34,
    "successful_deliveries": 31,
    "failed_deliveries": 3,
    "success_rate": 91.18,
    "risk_level": "LOW"
  }
}
```
- **Engine Classification Mapping:**
  - `success_rate >= 90%`: `🌟 Excellent`
  - `80% <= success_rate < 90%`: `👍 Good`
  - `65% <= success_rate < 80%`: `⚖️ Moderate`
  - `success_rate < 65%` or `failed_deliveries > 5`: `⚠️ High Risk`
  - `total_orders <= 2`: `🌱 New Buyer`

### 3.3 Consignment Creation
- **Endpoint:** `POST https://api.hermes.pathao.com/aladdin/api/v1/orders`
- **Consignment Item Suffixes:**
  - Warehouse central: `17263`
  - Cumilla branch: `17263 c`
  - Wari branch: `17263 w`
  - Sylhet branch: `17263 s`
  - Mirpur branch: `17263 m`

---

## 4. Webhook Ingestion & Signature Verification

### 4.1 WooCommerce Order Update Webhook
- **Webhook Action:** `order.created`, `order.updated`
- **Headers:**
  - `x-wc-webhook-topic`: `order.updated`
  - `x-wc-webhook-signature`: Base64 HMAC-SHA256 signature generated using `WC_WEBHOOK_SECRET`.
- **Verification Logic:**
```typescript
import crypto from 'crypto';

export function verifyWooCommerceSignature(rawBody: string, signature: string, secret: string): boolean {
  const hash = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}
```

---

## 5. Error Codes & Telemetry Standards

| HTTP Code | Error Key | Description | Remediation |
|---|---|---|---|
| `400` | `INVALID_DATE_RANGE` | Provided `start_date` is later than `end_date`. | Check date filter selectors. |
| `401` | `UNAUTHORIZED_OPERATOR` | Session token missing or expired. | Relogin via operator modal. |
| `403` | `FORBIDDEN_SCOPE` | Operator lacks permission for branch outlet. | Review RBAC in `SECURITY.md`. |
| `422` | `FLOAT_QUANTITY_DETECTED` | Knapsack returned non-integer items. | Audit integer solver constraint. |
| `429` | `RATE_LIMIT_EXCEEDED` | Exceeded 60 requests/minute to Pathao API. | Automatic exponential backoff. |
| `502` | `COURIER_GATEWAY_TIMEOUT` | Pathao Hermes API unresponsive. | Use cached offline snapshot. |
