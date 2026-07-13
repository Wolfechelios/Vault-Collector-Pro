# Vault Local Catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Apple Silicon macOS Tauri application that stores a private, listing-first inventory locally and accepts securely paired phone capture over the LAN.

**Architecture:** A React/TypeScript UI communicates with typed Tauri commands implemented in Rust. Rust owns SQLite, the media library, OCR adapters, pricing-provider adapters, local HTTPS pairing, migrations, and encrypted backups. The phone companion is a separate responsive React entry point served by the Rust local server.

**Tech Stack:** Tauri 2, React 19, TypeScript, Vite, Rust, Axum, SQLx + SQLite, Serde, Tokio, Rustls, Apple Vision adapter, Vitest, Playwright, Cargo test.

## Global Constraints

- Target macOS Apple Silicon only for release 1.
- Catalogue, photos, ownership details, notes, and serial numbers remain local.
- Internet access is limited to approved valuation providers.
- Every item is stored as a private eBay-style listing by default.
- OCR never silently overwrites verified fields.
- No public-internet remote access, cloud sync, native mobile app, or unsupported scraping in release 1.
- Preserve original imported media without recompression.

---

## File Map

- `src/desktop/` desktop React application.
- `src/mobile/` responsive phone companion.
- `src/shared/` shared types, schemas, and UI-independent logic.
- `src-tauri/src/db/` SQLite connection, migrations, and repositories.
- `src-tauri/src/media/` media ingestion, hashing, thumbnails, and metadata.
- `src-tauri/src/ocr/` OCR interfaces and Apple Vision adapter.
- `src-tauri/src/pricing/` provider interfaces, normalization, comparable filtering, and median calculation.
- `src-tauri/src/server/` LAN HTTPS server, QR pairing, sessions, and upload endpoints.
- `src-tauri/src/backup/` archive encryption, manifests, verification, and restore.
- `src-tauri/src/import/` Vault HTML/JSON, CSV, Excel, and folder migration.
- `tests/fixtures/` stable import, OCR, pricing, and backup fixtures.

### Task 1: Scaffold the Tauri workspace and shared contracts

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `src/desktop/main.tsx`
- Create: `src/mobile/main.tsx`
- Create: `src/shared/types/item.ts`
- Create: `src/shared/types/api.ts`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/main.rs`
- Test: `src/shared/types/item.test.ts`

**Interfaces:**
- Produces: `ItemRecord`, `ItemStatus`, `Money`, `MediaRef`, `FieldEvidence`, and typed command payloads used by all later tasks.

- [ ] Write a failing Vitest contract test that constructs a complete listing-first item and rejects an unknown status.
- [ ] Run `npm test -- src/shared/types/item.test.ts` and verify failure because contracts do not exist.
- [ ] Implement strict TypeScript types and Zod schemas for item records and command payloads.
- [ ] Add minimal desktop and mobile React entry points and a Tauri command returning application health.
- [ ] Run `npm test` and `cargo test --manifest-path src-tauri/Cargo.toml` and verify both pass.
- [ ] Commit with `git commit -m "build: scaffold vault desktop and mobile workspace"`.

### Task 2: Implement SQLite schema and repositories

**Files:**
- Create: `src-tauri/migrations/0001_initial.sql`
- Create: `src-tauri/src/db/mod.rs`
- Create: `src-tauri/src/db/models.rs`
- Create: `src-tauri/src/db/items.rs`
- Create: `src-tauri/src/db/locations.rs`
- Test: `src-tauri/tests/item_repository.rs`

**Interfaces:**
- Produces: `ItemRepository::{create,get,update,search,archive}`, `LocationRepository::{create_tree,list_tree,assign_item}`.

- [ ] Write repository tests covering item creation, item-specific JSON, ordered photos, archived state, and full-text search.
- [ ] Run `cargo test --test item_repository` and verify failure before migrations and repositories exist.
- [ ] Create normalized tables for items, item specifics, media, item-media links, valuations, comparables, locations, tags, item-tags, OCR evidence, trusted devices, and settings.
- [ ] Add FTS5 indexing for title, description, notes, OCR text, SKU, serial number, brand, and model.
- [ ] Implement transactional repositories with typed errors.
- [ ] Run repository tests and verify database files are cleaned up after each test.
- [ ] Commit with `git commit -m "feat: add local inventory database"`.

### Task 3: Build managed media ingestion

**Files:**
- Create: `src-tauri/src/media/mod.rs`
- Create: `src-tauri/src/media/hash.rs`
- Create: `src-tauri/src/media/thumbnail.rs`
- Create: `src-tauri/src/media/metadata.rs`
- Test: `src-tauri/tests/media_ingestion.rs`

**Interfaces:**
- Produces: `MediaService::ingest(path) -> MediaAsset`, `MediaService::attach(item_id, media_id, position)`.

- [ ] Write tests proving originals remain byte-identical, duplicate files reuse the same content hash, and thumbnails are generated separately.
- [ ] Run the media test and verify failure.
- [ ] Implement SHA-256 content-addressed storage under `originals/<prefix>/<hash>.<ext>` and derived assets under `derived/`.
- [ ] Read EXIF orientation and dimensions without mutating originals.
- [ ] Generate bounded thumbnails and persist metadata transactionally.
- [ ] Run tests and compare input/output checksums.
- [ ] Commit with `git commit -m "feat: add managed local media library"`.

### Task 4: Import the existing Vault catalogue

**Files:**
- Create: `src-tauri/src/import/mod.rs`
- Create: `src-tauri/src/import/vault_html.rs`
- Create: `src-tauri/src/import/report.rs`
- Create: `tests/fixtures/Vault_Collectors_Catalogue_FIXED.html`
- Test: `src-tauri/tests/vault_import.rs`

**Interfaces:**
- Produces: `VaultImporter::inspect(path) -> ImportPreview`, `VaultImporter::commit(preview_id) -> ImportResult`.

- [ ] Copy the supplied fixed Vault file into the fixture directory.
- [ ] Write a failing test that extracts category definitions and seed records without executing page JavaScript.
- [ ] Implement a parser that locates the `CATS` and `SEED` JSON strings, decodes them, maps records to `ItemRecord`, and records unmapped fields.
- [ ] Add duplicate candidates based on category, normalized title, year, and image hash.
- [ ] Require an automatic rollback backup before commit.
- [ ] Verify imported counts, category mappings, and rollback behavior.
- [ ] Commit with `git commit -m "feat: migrate existing Vault catalogue"`.

### Task 5: Implement desktop inventory UI

**Files:**
- Create: `src/desktop/App.tsx`
- Create: `src/desktop/routes.tsx`
- Create: `src/desktop/features/inventory/InventoryPage.tsx`
- Create: `src/desktop/features/items/ItemEditor.tsx`
- Create: `src/desktop/features/items/ItemDetail.tsx`
- Create: `src/desktop/features/dashboard/Dashboard.tsx`
- Test: `src/desktop/features/items/ItemEditor.test.tsx`
- Test: `tests/e2e/inventory.spec.ts`

**Interfaces:**
- Consumes: typed item commands and repository-backed Tauri handlers.
- Produces: complete create/edit/search/archive desktop workflow.

- [ ] Write component tests for required title/category fields, condition notes, item specifics, multiple-photo ordering, and verified-field protection.
- [ ] Write a Playwright test for create → search → edit → archive.
- [ ] Implement navigation and the high-value catalogue visual language derived from the existing Vault UI.
- [ ] Implement dashboard statistics, inventory grid/table views, saved filters, and item detail.
- [ ] Run unit and end-to-end tests.
- [ ] Commit with `git commit -m "feat: add desktop catalogue workflow"`.

### Task 6: Add hierarchical storage locations and QR labels

**Files:**
- Create: `src/desktop/features/locations/LocationManager.tsx`
- Create: `src/shared/locations/locationCode.ts`
- Create: `src-tauri/src/labels/mod.rs`
- Test: `src/shared/locations/locationCode.test.ts`
- Test: `src-tauri/tests/location_labels.rs`

**Interfaces:**
- Produces: stable location codes, printable QR-label PDFs, and item assignment commands.

- [ ] Write tests for room/shelf/box/bin paths, uniqueness, relocation history, and QR payload validation.
- [ ] Implement human-readable location codes and signed local QR payloads.
- [ ] Build location tree management and bulk item assignment.
- [ ] Generate printable label sheets with code, path, and QR.
- [ ] Run tests and inspect a generated fixture PDF.
- [ ] Commit with `git commit -m "feat: add physical storage tracking"`.

### Task 7: Implement OCR evidence pipeline

**Files:**
- Create: `src-tauri/src/ocr/mod.rs`
- Create: `src-tauri/src/ocr/apple_vision.rs`
- Create: `src-tauri/src/ocr/field_parser.rs`
- Create: `src/desktop/features/ocr/OcrReview.tsx`
- Test: `src-tauri/tests/ocr_field_parser.rs`

**Interfaces:**
- Produces: `OcrService::analyze(media_ids) -> OcrAnalysis` with text blocks and per-field evidence.

- [ ] Write parser tests for ISBN, VIN, card number, year, model, serial number, barcode, and confidence propagation.
- [ ] Implement an OCR trait and Apple Vision adapter invoked through a macOS bridge.
- [ ] Preserve raw OCR blocks, bounding boxes, source image IDs, and confidence.
- [ ] Add deterministic field parsers and category suggestions.
- [ ] Build review UI where suggestions can be accepted, edited, or rejected and verified fields are locked against silent replacement.
- [ ] Run parser tests and a manual Apple Vision fixture test.
- [ ] Commit with `git commit -m "feat: add local OCR-assisted item entry"`.

### Task 8: Build comparable normalization and median valuation

**Files:**
- Create: `src-tauri/src/pricing/mod.rs`
- Create: `src-tauri/src/pricing/provider.rs`
- Create: `src-tauri/src/pricing/normalize.rs`
- Create: `src-tauri/src/pricing/filter.rs`
- Create: `src-tauri/src/pricing/valuation.rs`
- Create: `src/desktop/features/pricing/PricingReview.tsx`
- Test: `src-tauri/tests/valuation_engine.rs`

**Interfaces:**
- Produces: `PricingProvider` trait and `ValuationEngine::calculate(target, comparables) -> ValuationResult`.

- [ ] Write tests for lot exclusion, variant mismatch, condition distance, duplicate sale removal, currency normalization, outlier rejection, and even/odd median sets.
- [ ] Implement provider-neutral comparable records.
- [ ] Implement robust filtering using hard identity rules plus median absolute deviation for price outliers.
- [ ] Calculate median, low/high range, source distribution, sample count, match confidence, and valuation confidence.
- [ ] Save approved valuations and comparables as immutable history entries.
- [ ] Build pricing review UI with included/excluded comparable explanations.
- [ ] Run valuation tests.
- [ ] Commit with `git commit -m "feat: add cleaned median valuation engine"`.

### Task 9: Add approved pricing-provider adapters

**Files:**
- Create: `src-tauri/src/pricing/providers/mod.rs`
- Create: `src-tauri/src/pricing/providers/imported_csv.rs`
- Create: `src-tauri/src/pricing/providers/ebay.rs`
- Create: `src-tauri/src/secrets/keychain.rs`
- Test: `src-tauri/tests/pricing_providers.rs`

**Interfaces:**
- Consumes: `PricingProvider` trait.
- Produces: provider registry and credential-safe query execution.

- [ ] Write provider contract tests using local HTTP fixtures and CSV fixtures.
- [ ] Implement CSV/JSON comparable import as the always-available provider.
- [ ] Implement the eBay provider only against the current official API contract and keep credentials in macOS Keychain.
- [ ] Send only category and approved item-identification fields to providers.
- [ ] Add request throttling, caching, retry policy, and clear provider diagnostics.
- [ ] Run provider contract tests with no live credentials required.
- [ ] Commit with `git commit -m "feat: add official pricing provider framework"`.

### Task 10: Implement secure LAN pairing and phone capture

**Files:**
- Create: `src-tauri/src/server/mod.rs`
- Create: `src-tauri/src/server/pairing.rs`
- Create: `src-tauri/src/server/routes.rs`
- Create: `src-tauri/src/server/tls.rs`
- Create: `src/mobile/App.tsx`
- Create: `src/mobile/features/capture/CaptureFlow.tsx`
- Create: `src/desktop/features/devices/TrustedDevices.tsx`
- Test: `src-tauri/tests/pairing_flow.rs`
- Test: `tests/e2e/mobile-capture.spec.ts`

**Interfaces:**
- Produces: LAN-only HTTPS service, six-digit pairing sessions, revocable device tokens, and chunked media upload.

- [ ] Write tests proving expired codes fail, unapproved devices cannot read data, approved devices can upload, revoked devices immediately fail, and non-private interfaces are rejected.
- [ ] Implement Rustls certificate generation and persistent local identity.
- [ ] Bind only to selected private LAN interfaces and expose a QR URL containing no permanent credential.
- [ ] Implement pairing code, desktop approval, device token issuance, and revocation.
- [ ] Build phone capture with multiple images, upload progress, retry, barcode input, and draft metadata.
- [ ] Run pairing and Playwright mobile tests.
- [ ] Commit with `git commit -m "feat: add secure phone capture over local wifi"`.

### Task 11: Add encrypted backup, restore, and integrity checks

**Files:**
- Create: `src-tauri/src/backup/mod.rs`
- Create: `src-tauri/src/backup/manifest.rs`
- Create: `src-tauri/src/backup/crypto.rs`
- Create: `src-tauri/src/backup/restore.rs`
- Create: `src/desktop/features/backup/BackupRestore.tsx`
- Test: `src-tauri/tests/backup_restore.rs`

**Interfaces:**
- Produces: `BackupService::{create,verify,restore_preview,restore}`.

- [ ] Write tests for encrypted round-trip, wrong password rejection, checksum corruption detection, missing external drive handling, and restore rollback.
- [ ] Quiesce writes and use SQLite online backup for consistent snapshots.
- [ ] Create a manifest with schema version, file sizes, SHA-256 checksums, and media counts.
- [ ] Encrypt archives with Argon2id-derived keys and an authenticated encryption mode.
- [ ] Implement scheduled local destination and optional external mirror with retention.
- [ ] Build verification and restore-preview UI.
- [ ] Run backup tests.
- [ ] Commit with `git commit -m "feat: add encrypted backup and recovery"`.

### Task 12: Diagnostics, packaging, and release verification

**Files:**
- Create: `src/desktop/features/diagnostics/Diagnostics.tsx`
- Create: `scripts/verify-release.sh`
- Modify: `src-tauri/tauri.conf.json`
- Create: `.github/workflows/macos-release.yml`
- Test: `tests/e2e/release-smoke.spec.ts`

**Interfaces:**
- Produces: reproducible Apple Silicon `.app` and `.dmg` artifacts and an in-app diagnostic report.

- [ ] Add diagnostics for database integrity, media reconciliation, OCR availability, pricing providers, LAN binding, trusted devices, and backup destinations.
- [ ] Add a smoke test covering migration, item creation, phone upload fixture, OCR fixture, valuation fixture, backup, and restore verification.
- [ ] Create a release script that checks Node/Rust versions, runs all tests, builds the app, validates architecture with `file`, and verifies the DMG contents.
- [ ] Configure Tauri bundle metadata, entitlements, icons, and signed-ready release settings.
- [ ] Run `bash scripts/verify-release.sh` and require zero failures.
- [ ] Commit with `git commit -m "build: package apple silicon vault release"`.

## Final Verification

- [ ] Run `npm ci`.
- [ ] Run `npm test`.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- [ ] Run `npm run test:e2e`.
- [ ] Run `bash scripts/verify-release.sh`.
- [ ] Import the supplied Vault file and compare source/import record counts.
- [ ] Confirm original-photo checksums are unchanged.
- [ ] Confirm the local server cannot bind to a public interface.
- [ ] Confirm revoked phone tokens fail immediately.
- [ ] Confirm a backup restores into a clean profile with matching manifest checksums.
