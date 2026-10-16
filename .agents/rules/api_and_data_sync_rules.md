# DEEN Commerce — API Integration & Data Synchronization Rules

These rules govern WooCommerce REST API synchronization, Pathao Courier Hermes API communication, environment security, and serverless resilience.

---

## 1. WooCommerce REST API Integration Rules

### 1.1 Endpoint & Authentication
* Base URL: `https://deencommerce.com`
* Endpoint: `/wp-json/wc/v3/orders`
* Auth: HTTP Basic Authentication via `consumer_key` and `consumer_secret`.

### 1.2 Multi-Page Sync & High-Density POS Retrieval
* Orders must be fetched in paginated chunks of `per_page: 100`.
* Max pages: `5` (up to 500 orders per sync batch).
* Orders must be parsed to extract POS register metadata:
  * `_sip_outlet_id`:
    * `1` $\rightarrow$ `Mirpur Outlet POS`
    * `2` $\rightarrow$ `Cumilla Branch POS`
    * `9` $\rightarrow$ `Wari Branch POS`
    * `7` or `8` $\rightarrow$ `Sylhet Branch POS`
  * `_sip_created_by`: Cashier user IDs (`1508`, `3`, `572`, `35`, `69`).

---

## 2. Pathao Courier Hermes API Integration Rules

### 2.1 Token Issuance & Caching
* Endpoint: `POST https://api-hermes.pathao.com/aladdin/api/v1/issue-token`
* Cache Bearer token in memory with an expiration buffer of `60 seconds`:
  $$\text{cacheTTL} = \text{expires\_in} - 60$$
* Never issue new tokens on every request if an active token is cached and valid.

### 2.2 Concurrency & Worker Queues
* Concurrency limit: Maximum **5** concurrent requests when querying parcel status from Pathao.
* Implement exponential backoff for HTTP 429 (Rate Limit) and HTTP 500 responses.

---

## 3. Serverless Execution & Zero-500 Promise

### 3.1 Graceful Degradation in Cloud Environments
* In cloud/serverless deployments (e.g. Vercel), local spreadsheets in `Sample Docs/` may not exist on disk.
* API routes (`/api/sample-data`, `/api/sync/pathao`, `/api/sync/woocommerce`) must **never throw uncaught 500 exceptions**.
* When local files or credentials are not found:
  1. Return `{ success: false, data: [], error: '...' }` with HTTP 200 status or a descriptive JSON payload.
  2. The frontend client must cleanly prompt the user to upload spreadsheets via the Drag-and-Drop Dropzone or enter credentials in settings.

### 3.2 Secrets Resolution Waterfall
Credentials in `src/lib/secrets.ts` must resolve in strict order:
1. Process environment variables (`process.env.WOOCOMMERCE_...`, `process.env.PATHAO_...`)
2. Local `secrets.toml` or `.env.local` when running in local Node environment
3. Safe empty string fallback `""` when neither is configured.

---

## 4. Live Terminal Sync & Reentrancy Prevention Rules

### 4.1 Sync Concurrency Guard & Rate-Limit Protection
* All client-side polling and manual triggers must enforce an `isSyncingRef` concurrency guard.
* Minimum sync interval: 60 seconds for automated polling.
* Exponential backoff: If HTTP 429 (Rate Limit) is encountered, pause polling for at least 120 seconds.
* Never include mutated datasets in `useCallback` dependency arrays of sync handlers, preventing infinite re-trigger loops.

### 4.2 Single-Flight Data Propagation
* `LiveOpsTab.tsx` passes synced order rows directly to `page.tsx`'s state via `onRefreshLive(orders, provenance)`.
* `page.tsx` must absorb the live array directly into top-level state without executing redundant `/api/sync/live-terminal` network calls.

### 4.3 POS Outlet Metadata Preservation
* Orders originating from physical store POS registers have standard numeric IDs (e.g. `17966`) without letter suffixes.
* The branch detection waterfall must inspect `_sip_outlet_id`, `fulfillmentBranch`, and `outletId` properties first before defaulting to Online Store (Central Warehouse).

