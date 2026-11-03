# Deployment & Production Operations Guide: DEEN Commerce

**Version:** 2.4.0  
**Target Environments:** Vercel Serverless / Edge Platform · Docker Standalone · Node.js 18+  
**Primary Host:** `reconciliation.deencommerce.com`  
**Last Updated:** November 2026  

---

## 1. Architecture & Deployment Matrix

The **DEEN Commerce Reconciliation Engine** is designed to deploy seamlessly to **Vercel** as a high-performance Next.js 14 App Router application, or within a self-hosted **Docker** container on an Ubuntu/Debian Linux server behind an Nginx reverse proxy.

```
                                    ┌────────────────────────┐
                                    │      CLOUDFLARE        │
                                    │    (DNS, WAF, SSL)     │
                                    └───────────┬────────────┘
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       │                                                 │
                       ▼                                                 ▼
        ┌─────────────────────────────┐                   ┌─────────────────────────────┐
        │   VERCEL EDGE / SERVERLESS  │                   │     DOCKER / STANDALONE     │
        │    (Default Primary Tier)   │                   │    (Self-Hosted Fallback)   │
        └──────────────┬──────────────┘                   └──────────────┬──────────────┘
                       │                                                 │
                       ▼                                                 ▼
        ┌─────────────────────────────┐                   ┌─────────────────────────────┐
        │   Next.js 14 App Router     │                   │     Docker Container        │
        │   • Serverless API Proxy    │                   │     (Port 3000 / Nginx)     │
        │   • Static Client Assets    │                   │     Node.js 18 Alpine       │
        └─────────────────────────────┘                   └─────────────────────────────┘
```

---

## 2. Vercel Production Deployment

### 2.1 One-Click Setup
1. Push branch to GitHub: `git push origin main`.
2. Connect repository in [Vercel Dashboard](https://vercel.com).
3. Framework Preset: **Next.js**.
4. Root Directory: `./` (leave default).
5. Build Command: `npm run build`.
6. Output Directory: `.next`.

### 2.2 Environment Variables Matrix

Configure these in **Vercel Project Settings $\to$ Environment Variables**:

| Variable Name | Required | Environment | Description |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | **Yes** | All | Public domain URL, e.g. `https://reconciliation.deencommerce.com`. |
| `WC_STORE_URL` | **Yes** | Production | WooCommerce store URL, e.g. `https://deencommerce.com`. |
| `WC_CONSUMER_KEY` | **Yes** | Server | WooCommerce REST API read/write consumer key (`ck_...`). |
| `WC_CONSUMER_SECRET` | **Yes** | Server | WooCommerce REST API consumer secret (`cs_...`). |
| `WC_WEBHOOK_SECRET` | **Yes** | Server | Secret used for HMAC-SHA256 signature verification. |
| `PATHAO_CLIENT_ID` | **Yes** | Server | Pathao Hermes B2B Client ID. |
| `PATHAO_CLIENT_SECRET` | **Yes** | Server | Pathao Hermes B2B Client Secret. |
| `PATHAO_USERNAME` | **Yes** | Server | Pathao merchant login username / email. |
| `PATHAO_PASSWORD` | **Yes** | Server | Pathao merchant account password. |
| `GEMINI_API_KEY` | Optional | Server | Google Gemini API key for AI Copilot features. |
| `BLOB_READ_WRITE_TOKEN`| Optional | Server | Vercel Blob storage token for persistent backup exports. |

---

## 3. Docker Containerized Deployment

A production-ready multi-stage `Dockerfile` and `docker-compose.yml` are included in the repository.

### 3.1 Building and Running via Docker
```bash
# 1. Build Docker image
docker build -t deen-reconciliation:2.4.0 .

# 2. Run container
docker run -d \
  --name deen-reconciliation \
  -p 3000:3000 \
  --env-file .env.production \
  --restart always \
  deen-reconciliation:2.4.0

# Or via Docker Compose
docker compose up -d
```

### 3.2 Nginx Reverse Proxy Configuration
```nginx
server {
    listen 80;
    server_name reconciliation.deencommerce.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name reconciliation.deencommerce.com;

    ssl_certificate /etc/letsencrypt/live/reconciliation.deencommerce.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/reconciliation.deencommerce.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Health Checks & Synthetic Monitoring

- **Endpoint:** `GET https://reconciliation.deencommerce.com/api/sync/status`
- **Expected Return:** HTTP 200 with JSON payload:
```json
{
  "healthy": true,
  "timestamp": "2026-11-03T17:00:00.000Z",
  "version": "2.4.0",
  "integrations": {
    "woocommerce": { "status": "connected" },
    "pathao_hermes": { "status": "connected" }
  }
}
```
- Configure synthetic uptime pings every 5 minutes via UptimeRobot, BetterUptime, or Datadog.

---

## 5. Rollback & Disaster Recovery Procedures

1. **Instant Vercel Rollback**:
   - Navigate to **Deployments** in Vercel.
   - Select the previously passing deployment.
   - Click **Instant Rollback**. Traffic switches in $<5$ seconds.
2. **Offline Data Recovery**:
   - If WooCommerce API or Pathao API experiences nationwide downtime, the engine gracefully falls back to local IndexedDB cached orders and `/api/sample-data` baseline datasets.
   - Operators can continue exporting Excel closing statements without interruption.
