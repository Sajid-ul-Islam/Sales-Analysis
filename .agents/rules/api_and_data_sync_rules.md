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
    * `2` $\rightarrow$ `Mirpur Outlet POS` (`outlet_slug: "mirpur-12"`)
    * `7` $\rightarrow$ `Cumilla Branch POS` (`outlet_slug: "cumilla"`)
    * `8` $\rightarrow$ `Wari Branch POS` (`outlet_slug: "wari"`)
    * `9` $\rightarrow$ `Sylhet Branch POS` (`outlet_slug: "sylhet"`)
    * `1` $\rightarrow$ `Central Warehouse` (`outlet_slug: "warehouse"`)
  * `_sip_created_by`: Cashier user IDs:
    * `3` $\rightarrow$ Mirpur (`mirpur12posuser@gmail.com`)
    * `35` $\rightarrow$ Cumilla (`deencumilla@gmail.com`)
    * `69` $\rightarrow$ Wari (`deenwari@gmail.com`)
    * `572` $\rightarrow$ Sylhet (`sylhet@deencommerce.com`)
    * `1508` $\rightarrow$ Shop Manager (`mohimanul@deencommerce.com`)

---

## 2. Pathao Courier Hermes API Integration Rules

### 2.1 Token Issuance & Caching
* Endpoint: `POST https://api-hermes.pathao.com/aladdin/api/v1/issue-token`
* Cache Bearer token in memory with an expiration buffer of `60 seconds`:
  $$\text{cacheTTL} = \text{expires\_in} - 60$$
* Never issue new tokens on every request if an active token is cached and valid.

### 2.2 B2B Client Credentials Authentication
* Endpoint: `POST https://api-hermes.pathao.com/aladdin/api/v1/external/login`
* Payload: `{ "client_id": "...", "client_secret": "..." }`
* Yields long-lived merchant authentication tokens valid for up to 90 days.
* Securely persisted in `secrets.toml` / `.env.local` as `PATHAO_CLIENT_ID` and `PATHAO_CLIENT_SECRET`.

### 2.3 Concurrency & Worker Queues
* Concurrency limit: Maximum **5** concurrent requests when querying parcel status from Pathao.
* Implement exponential backoff for HTTP 429 (Rate Limit) and HTTP 500 responses.

### 2.4 Consignment Tracking Endpoint
* Endpoint: `GET https://api-hermes.pathao.com/aladdin/api/v1/orders/{consignment_id}/info`
* Returns parcel real-time delivery status, order cost, collected COD amount, return charges, and transit history.

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

---

## 5. Pathao Customer Delivery Rating & Phone Intelligence API

### 5.1 Route Specification (`/api/courier/customer-rating`)
* Endpoint: `POST /api/courier/customer-rating`
* Body Payload:
  ```json
  {
    "phone": "01783650157",
    "batch": ["01783650157", "01912345678"]
  }
  ```
* Supports single phone query or batch resolution for table views.
* Rate Limiting: 120 requests/minute per client IP via token bucket rate limiter.
* In-Memory LRU Caching: 1-hour TTL on resolved phone ratings to minimize external API roundtrips.

### 5.2 External Courier Success Endpoint
* Endpoint: `POST https://api-hermes.pathao.com/aladdin/api/v1/user/success`
* Auth: Bearer token (obtained via `issue-token` or `external/login`).
* Payload: `{ "phone": "01783650157" }`
* Response Fields:
  * `total_parcels`: Total parcels dispatched to customer across all merchants on Pathao.
  * `successful_deliveries`: Number of successfully delivered parcels.
  * Delivery rate is calculated as:
    $$\text{DeliveryRate} = \left(\frac{\text{successful\_deliveries}}{\text{total\_parcels}}\right) \times 100$$

### 5.3 Empirical Baseline Fallback
* When Pathao API credentials are unavailable, fail, or return zero records, the engine calculates store-specific delivery metrics (`getStoreHistoryIndex`) from all lifetime orders in the local database or synced store history.

---

## 6. WooCommerce Pathao Plugin Meta Extraction Rules

### 6.1 Extraction Keys Priority
Orders synchronized from WooCommerce with the official Pathao plugin store fulfillment information in `meta_data` arrays. Parsers must check:
1. `ptc_consignment_id` (Primary consignment ID)
2. `_ptc_consignment_id` (Internal consignment ID)
3. `consignment_id` or `_consignment_id` (Alternative plugin keys)
4. Order Notes regex: `Consignment ID:\s*([A-Z0-9]+)`

### 6.2 Tracking URL Synthesis
* Consignment tracking link: `https://merchant.pathao.com/tracking?consignment_id={consignment_id}`
* Rendered as an external link chip in the Everyday Dispatched Orders Ledger and Order Inspector modal.

---

## 7. Cloud Sync & Omnichannel Hub Architectural Placement

### 7.1 Location Invariant: Settings Tab Consolidation
* The interactive Cloud Sync & Omnichannel Hub (`CloudSyncBar.tsx`) is strictly housed within `SettingsTab.tsx` under Section 0.5 (`Cloud Sync & Omnichannel Hub`).
* **FORBIDDEN: Mounting Sync Triggers on Executive Overview**:
  * Executive Overview (`ExecutiveOverviewTab.tsx`) is reserved strictly for high-level executive KPIs, profitability metrics, revenue breakdowns, and financial exports.
  * Real-time sync buttons, API key inputs, webhook diagnostics, and dataset swapping must live inside `SettingsTab` to eliminate operational clutter from executive presentations.

### 7.2 Synchronized Props & Dataset State
* `SettingsTab` receives live sync bindings from `page.tsx`:
  * `activeOrders`: Active order pool
  * `provenance`: Active data provenance metadata
  * `activeDataset`: Complete active bundle (orders, returns, partials, exchanges, courier delivery)
  * `onDataSynced`: Real-time state mutation handler
  * `onLoadFullDataset`: Executive 15% sample bypass callback


