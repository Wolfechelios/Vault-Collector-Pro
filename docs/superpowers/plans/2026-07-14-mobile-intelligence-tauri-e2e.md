# Mobile Intelligence and Tauri E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add offline mobile intelligence parity through verified snapshot/change bundles and enforce a real Linux Tauri UI test gate.

**Architecture:** A shared sync package defines versioned bundles, canonical checksums, protected merge planning, and mobile change contracts. Desktop exchanges those contracts through SQLite/Tauri commands; mobile stores them in IndexedDB and renders touch-first workspaces. WebdriverIO drives a test-build Tauri binary through `tauri-driver` on Ubuntu.

**Tech Stack:** TypeScript, React 19, Vitest, IndexedDB, Zod, Rust, rusqlite, Tauri 2, WebdriverIO, tauri-driver, GitHub Actions.

## Global Constraints

- Desktop SQLite remains authoritative.
- Mobile works without a server, account, or network request.
- Imports validate schema version, checksum, vault identity, and base revision before mutation.
- Protected and concurrent edits never overwrite silently; change IDs are idempotent.
- Test-only Tauri commands cannot compile into production builds.
- Existing checks plus mobile and native E2E checks must pass before merge.

---

### Task 1: Shared intelligence bundle protocol

**Files:**
- Create: `packages/intelligence-sync/package.json`
- Create: `packages/intelligence-sync/tsconfig.json`
- Create: `packages/intelligence-sync/src/index.ts`
- Test: `packages/intelligence-sync/src/index.test.ts`

**Interfaces:**
- Produces `IntelligenceSnapshot`, `MobileChangeBundle`, `MobileChange`, `createSnapshotBundle()`, `createChangeBundle()`, `verifySnapshotBundle()`, and `verifyChangeBundle()`.

- [ ] Write failing tests for deterministic canonical serialization, SHA-256 verification, version/vault rejection, duplicate change IDs, and evidence/rule attribution.
- [ ] Run `npx vitest run packages/intelligence-sync/src/index.test.ts`; expect failure because the package is absent.
- [ ] Implement format version `1`, recursive key sorting, Web Crypto SHA-256, strict runtime guards, and these envelopes:

```ts
type IntelligenceSnapshot = {
  format: 'vault-intelligence-snapshot'; version: 1; vaultId: string;
  revision: number; exportedAt: string; payload: SnapshotPayload; checksum: string;
};
type MobileChangeBundle = {
  format: 'vault-mobile-changes'; version: 1; vaultId: string;
  baseRevision: number; createdAt: string; changes: MobileChange[]; checksum: string;
};
```

- [ ] Run the focused tests; expect all PASS.
- [ ] Commit with `git commit -m "Add verified intelligence bundle protocol"`.

### Task 2: Protected merge planner

**Files:**
- Modify: `packages/intelligence-sync/src/index.ts`
- Test: `packages/intelligence-sync/src/index.test.ts`

**Interfaces:**
- Produces `planMobileChanges(snapshotState, currentState, bundle): MergePlan` with `applicable`, `duplicates`, and `conflicts`.

- [ ] Write failing tests for decisions, new captures, rule/search edits, replayed IDs, stale-but-unchanged records, protected values, concurrent fields, and rule timestamp conflicts.
- [ ] Run `npx vitest run packages/intelligence-sync/src/index.test.ts -t merge`; expect missing-export failure.
- [ ] Implement immutable planning. Permit stale revisions only where exported and current fingerprints match; classify protected/concurrent edits as conflicts.
- [ ] Run all sync tests; expect PASS.
- [ ] Commit with `git commit -m "Add protected mobile change planning"`.

### Task 3: Desktop transactional exchange

**Files:**
- Create: `apps/desktop/src-tauri/migrations/0006_mobile_intelligence.sql`
- Modify: `apps/desktop/src-tauri/src/db/mod.rs`
- Modify: `apps/desktop/src-tauri/src/db/intelligence.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Test: `apps/desktop/src-tauri/tests/intelligence_repository.rs`
- Modify: `apps/desktop/src/lib/catalogueApi.ts`

**Interfaces:**
- Produces repository methods `export_intelligence_snapshot` and `import_mobile_changes`, plus commands `export_intelligence_bundle` and `import_mobile_change_bundle`.
- Persists singleton vault identity/revision and `applied_mobile_changes`.

- [ ] Write failing Rust tests for snapshot contents, monotonic revisions, transactional rollback, idempotent replay, protected conflicts, stale-but-unchanged application, rule conflicts, and reindex notification.
- [ ] Run Cargo locally when available; otherwise publish the test-only commit and confirm CI fails specifically for absent repository methods.
- [ ] Add the rollback-safe migration and repository implementation. Validate before the mutation transaction, reuse existing decision semantics, record conflicts as review suggestions, ledger applied IDs, and increment revision once.
- [ ] Add JSON Tauri commands and typed TypeScript wrappers; notify the indexer only after commit.
- [ ] Run `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` and `npx tsc -b apps/desktop/tsconfig.json`; expect exit `0`.
- [ ] Commit with `git commit -m "Add desktop mobile intelligence exchange"`.

### Task 4: Mobile IndexedDB repository

**Files:**
- Create: `apps/mobile/src/data/mobileIntelligenceDb.ts`
- Test: `apps/mobile/src/data/mobileIntelligenceDb.test.ts`
- Create: `apps/mobile/src/data/testIndexedDb.ts`
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/vite.config.ts`

**Interfaces:**
- Produces `MobileIntelligenceRepository` methods for snapshot import, item/evidence/suggestion/rule/search reads, append-only decisions/captures/rule/search changes, and change export.

- [ ] Add `fake-indexeddb` and write failing tests for atomic import, explicit schema upgrades, validation rollback, snapshot replacement, ordered changes, duplicate suppression, and reopen persistence.
- [ ] Run `npx vitest run apps/mobile/src/data/mobileIntelligenceDb.test.ts`; expect missing-repository failure.
- [ ] Implement separate metadata, item, evidence, suggestion, field-state, rule, search, history, and change stores. Verify before replacing the active snapshot.
- [ ] Run `npm run test --workspace @vault/mobile`; expect PASS.
- [ ] Commit with `git commit -m "Add offline mobile intelligence storage"`.

### Task 5: Mobile shell and bundle exchange

**Files:**
- Create: `apps/mobile/src/App.tsx`
- Test: `apps/mobile/src/App.test.tsx`
- Create: `apps/mobile/src/styles.css`
- Create: `apps/mobile/src/features/exchange/BundleExchange.tsx`
- Test: `apps/mobile/src/features/exchange/BundleExchange.test.tsx`
- Modify: `apps/mobile/src/main.tsx`

**Interfaces:**
- Produces touch navigation for Capture, Review, Search, Collections, Rules and snapshot/change file controls.

- [ ] Write failing tests for accessible tabs, import counts, checksum errors, export privacy confirmation, and change-only downloads.
- [ ] Run the focused mobile tests; expect missing-component failure.
- [ ] Split the current one-file app without losing its photo queue. Add bottom navigation and the exchange sheet.
- [ ] Run mobile tests and production build; expect PASS.
- [ ] Commit with `git commit -m "Add mobile intelligence shell and exchange"`.

### Task 6: Mobile Capture, Review, and Evidence

**Files:**
- Create: `apps/mobile/src/features/capture/MobileCapture.tsx`
- Test: `apps/mobile/src/features/capture/MobileCapture.test.tsx`
- Create: `apps/mobile/src/features/review/MobileScanReview.tsx`
- Test: `apps/mobile/src/features/review/MobileScanReview.test.tsx`
- Create: `apps/mobile/src/features/review/MobileEvidenceSheet.tsx`
- Modify: `apps/mobile/src/App.tsx`

**Interfaces:**
- Consumes shared vision/inference functions; produces local evidence/suggestions and append-only `suggestion-decision` changes.

- [ ] Write failing tests for image-quality feedback, pasted OCR, confidence badges, rule attribution, raw/source evidence, decisions, and protected warnings.
- [ ] Run focused tests; expect missing-feature failures.
- [ ] Implement local analysis, persistence, evidence bottom sheet, and accept/edit/reject actions without mutating imported authoritative state.
- [ ] Run all mobile tests; expect PASS.
- [ ] Commit with `git commit -m "Add mobile capture review intelligence"`.

### Task 7: Mobile Search, Collections, and Rules

**Files:**
- Create: `apps/mobile/src/features/search/MobileSearch.tsx`
- Test: `apps/mobile/src/features/search/MobileSearch.test.tsx`
- Create: `apps/mobile/src/features/search/MobileCollections.tsx`
- Create: `apps/mobile/src/features/rules/MobileRules.tsx`
- Test: `apps/mobile/src/features/rules/MobileRules.test.tsx`
- Modify: `apps/mobile/src/App.tsx`

**Interfaces:**
- Consumes shared query parsing and rule validation; produces local results, smart collections, saved-search changes, and rule changes.

- [ ] Write failing tests for the five specified natural-language examples, recent/saved search, all five smart collections, and complete structured rule management.
- [ ] Run focused tests; expect missing-workspace failures.
- [ ] Implement deterministic local filtering over IndexedDB records and append rule/search mutations to the change log.
- [ ] Run mobile tests and build; expect PASS.
- [ ] Commit with `git commit -m "Complete mobile intelligence workflows"`.

### Task 8: Desktop exchange UI

**Files:**
- Create: `apps/desktop/src/features/intelligence/MobileExchange.tsx`
- Test: `apps/desktop/src/features/intelligence/MobileExchange.test.tsx`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/styles.css`

- [ ] Write failing tests for privacy confirmation, export naming, validation errors, import result counts, and Scan Review conflict navigation.
- [ ] Run the focused test; expect missing-component failure.
- [ ] Implement accessible file controls and stable semantic E2E selectors without changing backup/general import behavior.
- [ ] Run desktop tests and build; expect PASS.
- [ ] Commit with `git commit -m "Add desktop mobile intelligence exchange UI"`.

### Task 9: True Tauri WebDriver harness

**Files:**
- Create: `apps/desktop/e2e/wdio.conf.ts`
- Create: `apps/desktop/e2e/support/tauriService.ts`
- Create: `apps/desktop/e2e/support/fixtures.ts`
- Create: `apps/desktop/e2e/specs/intelligence.e2e.ts`
- Create: `apps/desktop/src-tauri/src/test_support.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/package.json`
- Modify: `.gitignore`
- Modify: `package-lock.json`

**Interfaces:**
- Produces `npm run test:e2e --workspace @vault/desktop`; test seed/reset commands exist only under Cargo feature `e2e-test-support`.

- [ ] Write seven E2E scenarios: launch/create, export, import, safe storage, protected conflict, background FTS, and restart persistence.
- [ ] Run on Linux; expect failure because the Tauri service/test support is absent.
- [ ] Implement a service that starts `tauri-driver`, spawns the real binary with isolated app data, connects WebdriverIO, captures diagnostics, and terminates processes. Restart only the app for persistence.
- [ ] Add reset/fixture commands behind `#[cfg(feature = "e2e-test-support")]`; do not include the feature by default.
- [ ] Build with `cargo tauri build --debug --features e2e-test-support` and run `xvfb-run -a npm run test:e2e --workspace @vault/desktop`; expect seven PASS.
- [ ] Run production `cargo check` without the feature and confirm test command names are absent.
- [ ] Commit with `git commit -m "Add true Tauri end-to-end automation"`.

### Task 10: CI gate and release

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `docs/releases/0.8-mobile-intelligence.md`

- [ ] Add an explicit mobile job that runs Vitest and the production build.
- [ ] Add an Ubuntu job installing Rust, Node 24, WebKitGTK/Tauri prerequisites, `tauri-driver`, and Xvfb; build the test feature and run WebdriverIO.
- [ ] Always upload screenshots, WebDriver/Tauri logs, and isolated SQLite on E2E failure.
- [ ] Run `npm test`, `npm run build`, and `git diff --check`; expect zero failures.
- [ ] Publish the feature branch and open a draft PR describing privacy, protected merges, offline scope, and native E2E coverage.
- [ ] Require frontend, mobile, macOS Rust, and Ubuntu Tauri E2E jobs to succeed; fix every failure.
- [ ] Mark ready and merge only with every required check green, then report remaining broader-release gaps.
