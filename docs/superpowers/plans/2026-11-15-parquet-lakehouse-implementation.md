# Full End-to-End Apache Parquet Lakehouse Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full end-to-end Apache Parquet (`.parquet`) storage, network wire transfer, and client-side querying using `hyparquet` to reduce payload sizes by 90%, cut client RAM usage by 85%, and eliminate Render container out-of-memory crashes.

**Architecture:** 
A hybrid lakehouse model: server-side Node.js streams orders into compressed Snappy `.parquet` partitions (`parquetjs-lite`) stored by month (`orders_YYYY_MM.parquet`). Next.js API routes serve partitions with HTTP range and ETag caching. The client browser uses zero-dependency `hyparquet` + `hyparquet-compressors` to parse columnar vectors directly from binary IndexedDB blobs with automated JSON fallback and offers instant `.parquet` analyst downloads.

**Tech Stack:** 
Next.js 14.2 App Router · TypeScript 5.6 · `hyparquet` (v1.33.0) · `hyparquet-compressors` · `parquetjs-lite` (v0.8.7) · IndexedDB · Vitest

**Spec:** `docs/PARQUET_ARCHITECTURE_ANALYSIS.md`

## Global Constraints
- Strictly enforce integer quantities on line items and returned items.
- Maintain dual-engine backward compatibility with existing JSON partition stores.
- All SVG icons must have explicit width and height constraints.
- Comply with all 10 Golden UX Rules in `DESIGN.md`.
- Zero TypeScript errors (`npx tsc --noEmit` must pass with code 0).
- All Vitest test suites must pass.

## Review Focus
1. **Empty / Null values**: Handling optional fields (courier tracking ID, cashier ID, branch) without throwing Thrift/Parquet schema validation errors.
2. **Buffer slicing in Node vs Browser**: Ensuring ArrayBuffer offsets are correctly handled when reading from Node `Buffer` vs browser `Blob`.
3. **Partition Boundary Integrity**: Verifying order rows strictly partition into Dhaka time (`+06:00`) YYYY-MM buckets.
4. **Export Stream Delivery**: Ensuring the Parquet export route streams valid binary attachment headers without corruption.
5. **Memory Cap on Render**: Ensuring large order writes use row-group streaming so container heap stays < 120MB.

---

### Task 1: Canonical Parquet Schema & Invariants (`src/lib/parquet/parquetSchema.ts`)

**Files:**
- Create: `src/lib/parquet/parquetSchema.ts`
- Test: `tests/parquet/parquetSchema.test.ts`

- [ ] Write Vitest test in `tests/parquet/parquetSchema.test.ts` validating schema fields, type mapping, and row transformation to schema dict.
- [ ] Create `src/lib/parquet/parquetSchema.ts` declaring `DEEN_ORDER_PARQUET_SCHEMA` with `parquetjs-lite` fields and a bidirectional row normalizer (`orderRowToParquetRecord` and `parquetRecordToOrderRow`).
- [ ] Verify test passes with `npx vitest run tests/parquet/parquetSchema.test.ts`.

---

### Task 2: Server-Side Parquet Writer & Partition Manager (`src/lib/server/parquetWriter.ts`)

**Files:**
- Create: `src/lib/server/parquetWriter.ts`
- Test: `tests/parquet/parquetWriter.test.ts`

- [ ] Write test in `tests/parquet/parquetWriter.test.ts` for `ordersToParquetBuffer` and `saveOrdersToParquetPartition`.
- [ ] Implement `src/lib/server/parquetWriter.ts` using `parquetjs-lite` with Snappy compression, streaming row groups, and disk storage in `data/lakehouse/partitions/`.
- [ ] Verify test passes with `npx vitest run tests/parquet/parquetWriter.test.ts`.

---

### Task 3: Client-Side Parquet Reader with `hyparquet` (`src/lib/parquet/parquetClient.ts`)

**Files:**
- Create: `src/lib/parquet/parquetClient.ts`
- Test: `tests/parquet/parquetClient.test.ts`

- [ ] Write test in `tests/parquet/parquetClient.test.ts` ensuring `hyparquet` reads buffers, decompresses Snappy, and extracts both full rows and projected subsets.
- [ ] Implement `src/lib/parquet/parquetClient.ts` configuring `hyparquet.parquetRead` with `hyparquet-compressors` (Snappy) and typed `RawOrderRow` conversion.
- [ ] Verify test passes with `npx vitest run tests/parquet/parquetClient.test.ts`.

---

### Task 4: Next.js API Routes for Parquet Partitions & Direct Export

**Files:**
- Create: `src/app/api/lakehouse/partition/route.ts`
- Create: `src/app/api/lakehouse/export/route.ts`
- Test: `tests/parquet/parquetApiRoute.test.ts`

- [ ] Write test in `tests/parquet/parquetApiRoute.test.ts` testing GET /api/lakehouse/partition and POST /api/lakehouse/export.
- [ ] Implement `src/app/api/lakehouse/partition/route.ts` with streaming response, byte-range support, and ETag caching.
- [ ] Implement `src/app/api/lakehouse/export/route.ts` streaming pristine `.parquet` file with proper Content-Disposition attachment headers.
- [ ] Verify tests pass with `npx vitest run tests/parquet/parquetApiRoute.test.ts`.

---

### Task 5: Binary IndexedDB Lakehouse Partition Store Integration (`src/lib/sync/partitionStore.ts`)

**Files:**
- Modify: `src/lib/sync/partitionStore.ts`
- Test: `tests/parquet/lakehousePartitionStore.test.ts`

- [ ] Write test in `tests/parquet/lakehousePartitionStore.test.ts` verifying binary Parquet saving/loading in IndexedDB with graceful JSON fallback.
- [ ] Update `src/lib/sync/partitionStore.ts` to add `saveParquetPartitionBlob`, `loadParquetPartitionBlob`, and integrate into `loadPartitionsForDateRange`.
- [ ] Verify test passes with `npx vitest run tests/parquet/lakehousePartitionStore.test.ts`.

---

### Task 6: UI Parquet Export Integration & Cloud Sync Status Badge

**Files:**
- Modify: `src/components/tabs/OrdersLedgerTab.tsx`
- Modify: `src/components/tabs/SkuPerformanceTab.tsx`
- Modify: `src/components/CloudSyncBar.tsx`

- [ ] Add `📥 Export .parquet` button with badge next to Excel in `OrdersLedgerTab.tsx`.
- [ ] Add `📥 Export .parquet` button in `SkuPerformanceTab.tsx`.
- [ ] Add Lakehouse Parquet active indicator in `CloudSyncBar.tsx`.

---

### Task 7: Full System Verification, Typecheck & Git Integration

**Files:**
- Audit all files: `npx tsc --noEmit` and `npm test`
- Documentation: Update `docs/DATA_SYNC_AND_PARTITIONING.md` and `docs/CHANGELOG.md`

- [ ] Run `npx tsc --noEmit` to verify 0 TypeScript errors.
- [ ] Run full test suite (`npm test`) to ensure all tests pass.
- [ ] Commit and push to `origin/main`.
