# Storage Management and Online Pricing Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver production-ready physical storage management and official online pricing-adapter infrastructure integrated into Vault Collector Pro.

**Architecture:** Add two focused shared packages: `@vault/storage-management` for stable UUID-based hierarchy, QR labels, capacity and transactional move planning; and `@vault/pricing-adapters` for provider routing, normalization, caching, retries, redaction and official HTTP adapter contracts. Persist both subsystems in SQLite and expose them through the existing desktop Storage and Value & Sell workspaces.

**Tech Stack:** TypeScript, React 19, Vitest, Tauri 2, Rust, SQLite, GitHub Actions.

## Global Constraints

- SQLite remains the source of truth.
- Core catalog operations remain fully usable offline.
- No credentials in Git, browser local storage, logs, exports or backups.
- Provider access uses official HTTPS APIs only; no prohibited scraping.
- Storage item moves are atomic and append-only in history.
- Provider refreshes never overwrite manual comparables or previous valuations.
- Every workspace test, desktop/mobile build and Rust test must pass before merge.

---

### Task 1: Storage Management Domain Engine

**Files:**
- Create: `packages/storage-management/package.json`
- Create: `packages/storage-management/src/index.ts`
- Create: `packages/storage-management/src/index.test.ts`

**Interfaces:**
- Produces: `StorageNode`, `StorageAssignment`, `StorageMove`, `createNode`, `validateMove`, `moveNode`, `planBulkAssignmentMove`, `calculateCapacity`, `buildBreadcrumb`, `encodeStorageQr`, `decodeStorageQr`.

- [ ] Write tests for node creation, cycle prevention, breadcrumb generation, QR checksum rejection, capacity warnings and all-or-nothing bulk moves.
- [ ] Implement immutable hierarchy utilities and stable UUID helpers.
- [ ] Run `npm run test --workspace @vault/storage-management` and require all tests to pass.
- [ ] Commit `feat: add storage management engine`.

### Task 2: Pricing Adapter Engine

**Files:**
- Create: `packages/pricing-adapters/package.json`
- Create: `packages/pricing-adapters/src/index.ts`
- Create: `packages/pricing-adapters/src/index.test.ts`

**Interfaces:**
- Consumes: `ProviderResult` and `ComparableProvider` from `@vault/marketplace`.
- Produces: `PricingAdapter`, `routeProviders`, `normalizeEbay`, `normalizeTcgplayer`, `normalizePriceCharting`, `normalizeDiscogs`, `buildCacheKey`, `classifyProviderError`, `computeBackoffMs`, `redactSecrets`, `PricingCache`.

- [ ] Write provider fixture tests, router tests, cache TTL tests, retry tests and redaction tests.
- [ ] Implement official-provider request contracts with injectable `fetch` and credential references.
- [ ] Implement manual/import fallback and stale-cache behavior.
- [ ] Run `npm run test --workspace @vault/pricing-adapters` and require all tests to pass.
- [ ] Commit `feat: add online pricing adapters`.

### Task 3: SQLite Persistence

**Files:**
- Create: `apps/desktop/src-tauri/migrations/0005_storage_pricing_adapters.sql`
- Modify: `apps/desktop/src-tauri/src/db/mod.rs`
- Test: `apps/desktop/src-tauri/tests/item_repository.rs`

**Interfaces:**
- Produces tables `storage_nodes`, `storage_node_closure`, `storage_assignments`, `storage_moves`, `storage_labels`, `pricing_provider_accounts`, `pricing_provider_cache`, `pricing_provider_requests`, `pricing_refresh_jobs`.

- [ ] Add normalized tables, indexes, foreign keys and append-only timestamps.
- [ ] Register migration 0005.
- [ ] Extend Rust migration test to assert all new tables exist.
- [ ] Run `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`.
- [ ] Commit `feat: persist storage and pricing adapters`.

### Task 4: Storage Manager Desktop UI

**Files:**
- Create: `apps/desktop/src/features/storage/StorageManager.tsx`
- Create: `apps/desktop/src/features/storage/storage-manager.css`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/main.tsx`
- Modify: `apps/desktop/package.json`

**Interfaces:**
- Consumes storage-management package and current `ItemRecord[]`.
- Produces hierarchy editor, occupancy view, QR export, unassigned queue and bulk move workflow.

- [ ] Build local-first state repository with migration from existing `specifics.storagePath` strings.
- [ ] Add create, rename, archive, move and bulk assign actions.
- [ ] Add QR payload export and scan-to-select input.
- [ ] Add occupancy/capacity warnings and move history.
- [ ] Add component tests where practical and run desktop tests/build.
- [ ] Commit `feat: add storage manager workspace`.

### Task 5: Pricing Providers and Marketplace Integration

**Files:**
- Create: `apps/desktop/src/features/marketplace/PricingProvidersPanel.tsx`
- Create: `apps/desktop/src/features/marketplace/pricing-providers.css`
- Modify: `apps/desktop/src/features/marketplace/MarketplaceCenter.tsx`
- Modify: `apps/desktop/src/main.tsx`
- Modify: `apps/desktop/package.json`

**Interfaces:**
- Consumes pricing-adapters package and existing Marketplace Intelligence engine.
- Produces provider settings, health display, online comparable fetch, cache controls and result review.

- [ ] Add provider configuration using secret references only.
- [ ] Add category-aware provider routing and automatic fetch.
- [ ] Add request progress, stale cache display, provider errors and cancellation.
- [ ] Feed normalized results into existing valuation snapshot flow without replacing manual rows.
- [ ] Run all frontend tests and production builds.
- [ ] Commit `feat: integrate automatic pricing providers`.

### Task 6: CI, Security and Release Gate

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Produces explicit tests for both new packages and a secret-pattern scan.

- [ ] Add workspace test steps for storage-management and pricing-adapters.
- [ ] Add grep-based rejection for likely committed provider tokens while excluding fixtures and lockfiles.
- [ ] Run the complete repository test/build matrix.
- [ ] Open PR and fix every CI failure.
- [ ] Merge only after frontend and Rust jobs are fully green.
