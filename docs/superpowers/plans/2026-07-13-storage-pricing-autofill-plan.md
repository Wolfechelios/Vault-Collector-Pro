# Storage, Pricing Adapters, and Smart Auto-Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build production-ready physical storage management, official online pricing adapter architecture, and confidence-based camera/OCR inventory auto-fill as one integrated Vault release.

**Architecture:** Add three focused shared packages (`@vault/storage-management`, `@vault/pricing-adapters`, `@vault/inventory-intelligence`) and wire them into desktop/mobile, SQLite migrations, and CI. SQLite remains authoritative; provider secrets live behind secret references; OCR/barcode evidence is append-only and canonical fields use protected merge rules.

**Tech Stack:** TypeScript, React, Vitest, Tauri 2, Rust, SQLite/rusqlite, Web Crypto-compatible hashing, official provider HTTPS APIs.

## Global Constraints

- Core catalog, storage, OCR auto-fill, backups, and manual valuation must work offline.
- Never store provider credentials in Git, browser local storage, backups, logs, or plaintext SQLite columns.
- Existing user-verified inventory values must never be silently overwritten.
- Use official provider APIs only; no prohibited scraping or access-control bypasses.
- Every package must have tests and CI must pass desktop/mobile builds plus Rust/SQLite tests.

---

### Task 1: Storage Management Domain Package

**Files:**
- Create: `packages/storage-management/package.json`
- Create: `packages/storage-management/src/index.ts`
- Create: `packages/storage-management/src/index.test.ts`

**Interfaces:**
- Produces: `StorageNode`, `StorageAssignment`, `StorageMove`, `validateHierarchy`, `buildBreadcrumb`, `calculateOccupancy`, `planBulkMove`, `encodeStorageQr`, `decodeStorageQr`.

- [ ] Write tests covering cycle rejection, archived-node rejection, capacity calculations, transactional bulk planning, and QR checksum round trips.
- [ ] Implement typed models and pure functions.
- [ ] Run `npm run test --workspace @vault/storage-management` and expect all tests to pass.
- [ ] Commit with `feat: add storage management domain engine`.

### Task 2: Pricing Adapter Package

**Files:**
- Create: `packages/pricing-adapters/package.json`
- Create: `packages/pricing-adapters/src/index.ts`
- Create: `packages/pricing-adapters/src/index.test.ts`

**Interfaces:**
- Consumes: `ProviderResult` and `SaleComparable`.
- Produces: `PricingAdapter`, `AdapterContext`, `routeProviders`, `buildCacheKey`, `isCacheFresh`, `classifyProviderError`, `redactSecrets`, provider adapters for eBay, TCGplayer, PriceCharting, Discogs, and manual/import.

- [ ] Write fixtures with synthetic credentials and mocked JSON payloads.
- [ ] Implement routing, normalization, cache, retry classification, cancellation, and health state.
- [ ] Ensure every network adapter requires explicit credentials and HTTPS endpoints.
- [ ] Run package tests and commit `feat: add online pricing adapter engine`.

### Task 3: Inventory Intelligence Package

**Files:**
- Create: `packages/inventory-intelligence/package.json`
- Create: `packages/inventory-intelligence/src/index.ts`
- Create: `packages/inventory-intelligence/src/index.test.ts`

**Interfaces:**
- Produces: `FieldProposal`, `ScanAnalysis`, `LearningRule`, `extractInventoryFields`, `inferInventoryCategory`, `mergeFieldProposals`, `buildPricingQuery`, `suggestStorageRoute`.

- [ ] Write tests for OCR normalization, barcode extraction, category inference, confidence thresholds, conflicting evidence, and protection of verified fields.
- [ ] Implement deterministic local extraction and evidence merging.
- [ ] Run tests and commit `feat: add smart inventory autofill engine`.

### Task 4: SQLite Persistence

**Files:**
- Create: `apps/desktop/src-tauri/migrations/0005_storage_pricing_autofill.sql`
- Modify: `apps/desktop/src-tauri/src/db/mod.rs`
- Create: `apps/desktop/src-tauri/src/db/storage.rs`
- Create: `apps/desktop/src-tauri/src/db/intelligence.rs`
- Test: `apps/desktop/src-tauri/tests/storage_pricing_autofill.rs`

**Interfaces:**
- Produces transactional storage CRUD/move methods, provider cache/request persistence, scan-analysis persistence, field decision persistence, and learning-rule persistence.

- [ ] Add all tables, foreign keys, indexes, and append-only history constraints.
- [ ] Add Rust repository methods and migration tests.
- [ ] Run `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` and commit `feat: persist storage pricing and scan intelligence`.

### Task 5: Desktop Storage Manager

**Files:**
- Create: `apps/desktop/src/features/storage/StorageManager.tsx`
- Create: `apps/desktop/src/features/storage/storageManager.test.tsx`
- Create: `apps/desktop/src/features/storage/storage.css`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/main.tsx`
- Modify: `apps/desktop/package.json`

**Interfaces:**
- Consumes storage package and catalog items.
- Produces create/rename/archive/reorder, occupancy, unassigned queue, bulk move, QR export, and scan-to-move UI.

- [ ] Implement the complete Storage Manager view.
- [ ] Keep all destructive actions explicit and transactional.
- [ ] Run desktop tests/build and commit `feat: add desktop storage manager`.

### Task 6: Pricing Provider Settings and Automatic Retrieval

**Files:**
- Create: `apps/desktop/src/features/pricing/ProviderSettings.tsx`
- Create: `apps/desktop/src/features/pricing/providerSettings.test.tsx`
- Create: `apps/desktop/src/features/pricing/pricingProviders.css`
- Modify: `apps/desktop/src/features/marketplace/MarketplaceCenter.tsx`
- Modify: `apps/desktop/src/App.tsx`

**Interfaces:**
- Consumes pricing adapter package.
- Produces provider enablement, credential-reference state, health tests, cache state, refresh jobs, and normalized comparable injection into Marketplace Intelligence.

- [ ] Implement provider cards and routing controls.
- [ ] Add fetch-online-comparables workflow with cached/stale states and manual fallback.
- [ ] Run tests/build and commit `feat: add automatic online pricing workflow`.

### Task 7: Scan Review and Automatic Field Population

**Files:**
- Create: `apps/desktop/src/features/intelligence/ScanReview.tsx`
- Create: `apps/desktop/src/features/intelligence/scanReview.test.tsx`
- Create: `apps/desktop/src/features/intelligence/intelligence.css`
- Modify: `apps/desktop/src/features/capture/CaptureCenter.tsx`
- Modify: `apps/desktop/src/features/items/ItemEditor.tsx`
- Modify: `apps/desktop/src/App.tsx`

**Interfaces:**
- Consumes capture photos/OCR and inventory intelligence.
- Produces auto-saved fields, review suggestions, conflicts, evidence display, user verification, learning-rule creation, pricing queries, and storage suggestions.

- [ ] Implement scan-to-structured-draft flow.
- [ ] Apply >=0.95 and 0.80-0.9499 policies exactly.
- [ ] Preserve verified values and show conflicts.
- [ ] Run tests/build and commit `feat: add scan review and smart autofill`.

### Task 8: Mobile Capture Metadata

**Files:**
- Modify: `apps/mobile/src/main.tsx`
- Modify: `apps/mobile/package.json`

**Interfaces:**
- Produces capture bundles containing OCR text, barcode values, dimensions, image-quality metadata, and optional target storage QR payload.

- [ ] Extend offline bundles without breaking existing imports.
- [ ] Build mobile application and commit `feat: enrich mobile capture bundles`.

### Task 9: CI and Release Gate

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] Add explicit tests for all three new packages.
- [ ] Add provider-fixture secret scan.
- [ ] Run all workspace tests, desktop/mobile builds, and Rust tests.
- [ ] Open one pull request and fix every CI failure before merge.
- [ ] Merge only when all checks pass.
