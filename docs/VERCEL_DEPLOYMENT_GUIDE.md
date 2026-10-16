# DEEN Commerce Reconciliation Engine — Vercel Deployment & API Setup Guide

This guide provides end-to-end instructions for deploying the **DEEN Commerce Sales Analysis & Reconciliation Dashboard** to **Vercel** with full feature parity, live API data synchronization, and zero serverless crashes.

---

## 1. Feature Readiness Summary on Vercel

| Feature | Local Dev | Vercel Deployment | Status & Architecture |
| :--- | :---: | :---: | :--- |
| **Bangladesh Map Chart (Territory)** | ✅ Fully working | ✅ 100% Ready | Pre-compressed SVG geometry (64.5 KB) bundled in JS. Zero external map APIs or CDN dependencies required. |
| **Exchange KPI & Baseline Data** | ✅ 73 Exchanges | ✅ 73 Exchanges | Decoupled per-entity fallback to bundled `baselineSample.json`. Works immediately on Vercel even without file uploads. |
| **WooCommerce REST API Sync** | ✅ Active | ✅ Supported | Multi-page order sync protected by 8-9s `AbortController` timeouts to prevent Vercel 504 serverless timeouts. |
| **Pathao Hermes Courier Sync** | ✅ Active | ✅ Supported | Dynamic consignment harvesting from active orders and bundled baseline data; no local `.xlsx` files needed on Vercel. |
| **Google Analytics 4 (GA4)** | ✅ Active | ✅ Supported | Node.js native crypto JWT generation. Supports direct `GCP_SERVICE_ACCOUNT_JSON` single-variable setup. |
| **Meta Ads & Pixel API** | ✅ Active | ✅ Supported | Marketing API v19.0 insights, ROAS, and live pixel event verification. |
| **Dynamic In-Browser Overrides** | ✅ Active | ✅ Supported | Credentials entered in **Settings** take immediate effect via `POST /api/sync/status` without redeploying Vercel. |

---

## 2. Setting Up Environment Variables in Vercel

In your Vercel Project Dashboard, navigate to:
**Settings > Environment Variables** and add the following variables:

```bash
# ==============================================================================
# WooCommerce REST API
# ==============================================================================
WOOCOMMERCE_STORE_URL="https://deencommerce.com"
WOOCOMMERCE_CONSUMER_KEY="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
WOOCOMMERCE_CONSUMER_SECRET="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# ==============================================================================
# Pathao Hermes Courier API
# ==============================================================================
PATHAO_BASE_URL="https://api-hermes.pathao.com"
PATHAO_CLIENT_ID="your_pathao_client_id"
PATHAO_CLIENT_SECRET="your_pathao_client_secret"
PATHAO_USERNAME="your_email@deencommerce.com"
PATHAO_PASSWORD="your_pathao_password"

# ==============================================================================
# Google Analytics 4 (Recommended: Single JSON Variable)
# ==============================================================================
GA4_PROPERTY_ID="123456789"
GCP_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"...","client_id":"..."}'

# ==============================================================================
# Meta Ads & Pixel Marketing Integration
# ==============================================================================
META_PIXEL_ID="1234567890123456"
META_AD_ACCOUNT_ID="act_1234567890123456"
META_ACCESS_TOKEN="your_meta_system_user_token"
```

---

## 3. Detailed Integration Setup Instructions

### A. WooCommerce REST API
1. Log into your WordPress Admin (`https://deencommerce.com/wp-admin`).
2. Go to **WooCommerce > Settings > Advanced > REST API**.
3. Click **Add key**.
4. Set:
   * **Description**: `DEEN Analytics Vercel Engine`
   * **User**: Select an account with **Administrator** or **Shop Manager** role.
   * **Permissions**: `Read` (or `Read/Write`).
5. Copy the **Consumer Key** (`ck_...`) and **Consumer Secret** (`cs_...`) to Vercel.
> [!TIP]
> If your store uses Cloudflare Bot Fight Mode or Wordfence, ensure serverless requests are not blocked by adding a custom rule allowing REST API requests with User-Agent `DEEN-Commerce-Engine/2.0`.

---

### B. Pathao Hermes Courier API
1. Pathao Hermes uses OAuth 2.0 with the Aladdin v1 API endpoints.
2. Ensure you have your Pathao Merchant Portal credentials:
   * **Client ID** & **Client Secret** (provided by Pathao Merchant Onboarding / API Team).
   * **Username** & **Password** (the credentials you use to log into merchant.pathao.com).
3. The engine connects to `https://api-hermes.pathao.com/aladdin/api/v1/issue-token` to retrieve a Bearer access token and fetches status for courier consignments.
> [!NOTE]
> On Vercel, when you click **Sync Pathao**, the engine automatically extracts tracking numbers from your currently active orders or pre-seeded baseline consignments.

---

### C. Google Analytics 4 (GA4)
1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a Service Account.
2. Generate and download a **JSON Key**.
3. In [Google Analytics Admin](https://analytics.google.com/), go to **Property Access Management**.
4. Add the Service Account's `client_email` with **Viewer** permissions.
5. In Vercel, paste the entire contents of the downloaded JSON file into `GCP_SERVICE_ACCOUNT_JSON`.
   * *This avoids having to manually escape `\n` in private keys!*
6. Set `GA4_PROPERTY_ID` to your numeric Property ID (e.g. `123456789`).

---

### D. Meta Ads & Pixel API
1. In Meta Events Manager, copy your **Pixel ID** (`META_PIXEL_ID`, e.g. `1234567890123456`).
2. In Meta Ads Manager, copy your **Ad Account ID** with `act_` prefix (`META_AD_ACCOUNT_ID`, e.g. `act_1234567890123456`).
3. In Meta Business Settings, go to **System Users** and generate an access token with permissions:
   * `ads_read`
   * `read_insights`
4. Set this as `META_ACCESS_TOKEN` in Vercel.

---

## 4. Troubleshooting Common Vercel Issues

### Issue 1: "Exchange KPI showing 0 on Vercel"
* **Cause**: In older commits, the server looked for local `.xlsx` files in `Sample Docs/` which are gitignored.
* **Resolution**: The engine now features an independent per-entity fallback to `baselineSample.json`. Even on a completely clean serverless environment with zero files on disk, all 73 exchange orders and 2,549 baseline orders are fully loaded.

### Issue 2: "504 Gateway Timeout on WooCommerce Sync"
* **Cause**: Vercel Hobby plan enforces a 10–15s function timeout. Fetching more than 500 orders across sequential HTTP requests can exceed this window.
* **Resolution**: 
  - The engine caps default pages to `maxPages: 3` (300 orders) with a 9.5s `AbortController` deadline.
  - For historical syncs over large date ranges, use shorter date ranges (e.g., 7 days or 14 days) or upload monthly Excel export files.

### Issue 3: "WooCommerce 401 (Cannot View)"
* **Cause**: The API key is associated with a WordPress user that lacks permission to read orders.
* **Resolution**: Re-create the REST key in WooCommerce under an **Administrator** user account with `Read/Write` permission.

### Issue 4: "Pathao sync returned no consignment IDs"
* **Cause**: Pathao's API requires specific consignment IDs to query.
* **Resolution**: Ensure you have either:
  1. Orders already loaded in your dashboard (the sync will automatically harvest their consignment IDs).
  2. The default baseline loaded (which supplies 2,498 consignment tracking numbers).
  3. Uploaded a Pathao Excel or CSV delivery report.

---

## 5. Live Verification After Deployment

After deploying to Vercel:
1. Open your Vercel URL in an incognito window.
2. Confirm the header shows **"September Baseline (1,026 Clean)"**.
3. Verify the **Exchange KPI** card shows:
   * **Exchanged Orders**: 73
   * **Exchanged Units**: 73
4. Go to the **Territory** tab:
   * Verify the **Bangladesh Map** renders all 8 divisions.
   * Toggle between **Dispatched Orders**, **Realized Revenue**, and **RTO Risk %**.
   * Click any division to verify drill-down details and top destination districts.
5. In **Settings > Cloud API Integration**:
   * Click **Test APIs** to verify live connectivity with your configured credentials.
