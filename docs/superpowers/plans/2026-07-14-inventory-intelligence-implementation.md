# Integrated Inventory Intelligence Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship evidence-backed inventory inference, transparent local learning, deterministic offline search, unified persistence, and all supporting desktop workspaces as one WolfeVault release.

**Architecture:** `@vault/inventory-intelligence` consumes provider-neutral scan evidence and produces deterministic field suggestions, `@vault/learning` turns repeated decisions into inspectable rules, and `@vault/search` compiles natural language into reproducible filters. Domain schemas and Rust persist the shared contracts in SQLite; the desktop review UI is the only place low-confidence, conflicting, or protected replacements can be approved.

**Tech Stack:** TypeScript, Zod, Vitest, React 19, Rust, rusqlite, SQLite, Tauri 2.

## Global Constraints

- Work only in `Wolfechelios/Vault-Collector-Pro`.
- Everything required for capture, inference, review, and persistence works offline.
- User-entered and verified values are never silently overwritten.
- Every field suggestion retains confidence, source evidence, raw text, and verification state.
- High confidence is `>= 0.90`; medium is `>= 0.65` and `< 0.90`; low is `< 0.65`.
- Conflicts always require review.
- Extend existing APIs; do not remove working functionality.
- Use test-first development for every behavior.
- Ship the three intelligence systems on one feature branch and one pull request.

---

### Task 1: Define shared evidence and field-state contracts

**Files:**
- Create: `packages/domain/src/intelligence.ts`
- Create: `packages/domain/src/intelligence.test.ts`
- Modify: `packages/domain/src/index.ts`

**Interfaces:**
- Produces: `ScanEvidence`, `FieldSuggestion`, `ItemFieldState`, `VerificationState`, `SuggestionDisposition`, `CategoryFieldDefinition`, and their Zod schemas.

- [ ] Write failing schema tests that accept complete evidence, reject confidence outside `0..1`, and reject a suggestion with no evidence identifiers.
- [ ] Run `npm test --workspace @vault/domain -- intelligence.test.ts` and confirm the module is missing.
- [ ] Implement the schemas with camelCase serialized fields and inferred TypeScript types.
- [ ] Export the contracts from `packages/domain/src/index.ts`.
- [ ] Run `npm test --workspace @vault/domain` and confirm all domain tests pass.
- [ ] Commit `feat: define inventory intelligence contracts`.

### Task 2: Implement deterministic inference and protected merges

**Files:**
- Create: `packages/inventory-intelligence/package.json`
- Create: `packages/inventory-intelligence/src/index.ts`
- Create: `packages/inventory-intelligence/src/index.test.ts`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `ScanEvidence`, `FieldSuggestion`, `ItemFieldState` from `@vault/domain`.
- Produces: `buildSuggestions(evidence, fieldState)`, `applySuggestion(item, suggestion, decision)`, `confidenceBand(confidence)`, and `detectEvidenceConflicts(evidence)`.

- [ ] Write failing tests for high-confidence auto-save into empty fields, medium-confidence flagged save, low-confidence review, conflicts, and protected user values.
- [ ] Run `npm test --workspace @vault/inventory-intelligence` and confirm failures are caused by missing functions.
- [ ] Implement normalization, evidence grouping, corroboration scoring, conflict detection, deterministic dispositions, and explicit accept/edit/reject decisions.
- [ ] Ensure `applySuggestion` returns a new object and throws on automatic replacement of a protected field.
- [ ] Run the package tests and the entire workspace suite.
- [ ] Commit `feat: add protected inventory inference engine`.

### Task 3: Expand scan adapters and dynamic category schemas

**Files:**
- Modify: `packages/vision/src/index.ts`
- Modify: `packages/vision/src/index.test.ts`
- Create: `packages/inventory-intelligence/src/categories.ts`
- Create: `packages/inventory-intelligence/src/categories.test.ts`

**Interfaces:**
- Consumes: raw OCR text, barcode strings, provider evidence, and category identifiers.
- Produces: `visionCandidateToEvidence(candidate, mediaId)`, `getCategoryFields(category)`, and `mergeCategorySpecifics(current, nextCategory)`.

- [ ] Write failing parser tests for edition, color, material, condition, logo/brand, model number, serial number, year, size, and barcode evidence provenance.
- [ ] Write failing category tests for tools, cards, coins, electronics, clothing, shoes, jewelry, and generic fallback schemas.
- [ ] Implement deterministic extraction without network calls and retain provider/source metadata.
- [ ] Implement data-driven category definitions and preserve unknown current specifics on category changes.
- [ ] Run the vision and inventory-intelligence package tests.
- [ ] Commit `feat: expand evidence extraction and category schemas`.

### Task 4: Persist evidence, suggestions, and field protection

**Files:**
- Create: `apps/desktop/src-tauri/migrations/0005_inventory_intelligence.sql`
- Modify: `apps/desktop/src-tauri/src/db/mod.rs`
- Create: `apps/desktop/src-tauri/src/db/intelligence.rs`
- Modify: `apps/desktop/src-tauri/src/db/models.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Create: `apps/desktop/src-tauri/tests/inventory_intelligence.rs`

**Interfaces:**
- Produces: `IntelligenceRepository::{record_evidence,create_suggestions,list_review_queue,decide_suggestion,get_field_state}` and matching Tauri commands.

- [ ] Write failing migration tests for `scan_evidence`, `field_suggestions`, `item_field_state`, and `category_field_definitions` plus foreign keys and indexes.
- [ ] Write failing repository tests proving rejected suggestions do not alter items and protected values require explicit acceptance.
- [ ] Add the idempotent migration and register it after migration 0004.
- [ ] Implement repository transactions so item update, suggestion decision, and field state change commit or roll back together.
- [ ] Expose typed Tauri commands without changing existing item commands.
- [ ] Run `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` on a Rust-capable runner.
- [ ] Commit `feat: persist inventory evidence and review state`.

### Task 5: Build Scan Review and evidence viewer

**Files:**
- Create: `apps/desktop/src/features/intelligence/ScanReview.tsx`
- Create: `apps/desktop/src/features/intelligence/ScanReview.test.tsx`
- Create: `apps/desktop/src/features/intelligence/EvidenceViewer.tsx`
- Modify: `apps/desktop/src/features/vision/VisionPanel.tsx`
- Modify: `apps/desktop/src/lib/catalogueApi.ts`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `packages/ui/src/index.ts`
- Modify: `apps/desktop/src/styles.css`

**Interfaces:**
- Consumes: review-queue Tauri commands and category schemas.
- Produces: accept, edit, reject, source-photo inspection, confidence badges, conflict warnings, and protected-value locks.

- [ ] Write failing component tests for confidence labels, protected replacements, conflict display, evidence source selection, and decision callbacks.
- [ ] Add typed API methods for analyzing evidence and deciding suggestions.
- [ ] Implement the review workspace and evidence viewer with keyboard-accessible controls.
- [ ] Change Vision Panel's primary action from direct field replacement to evidence submission and review.
- [ ] Add the `review` application section and navigation count.
- [ ] Run desktop unit tests and the production desktop build.
- [ ] Commit `feat: add inventory scan review workspace`.

### Task 6: Render category-specific fields and protect manual edits

**Files:**
- Modify: `apps/desktop/src/features/items/itemForm.ts`
- Modify: `apps/desktop/src/features/items/itemForm.test.ts`
- Modify: `apps/desktop/src/features/items/ItemEditor.tsx`
- Create: `apps/desktop/src/features/items/CategorySpecificFields.tsx`
- Create: `apps/desktop/src/features/items/CategorySpecificFields.test.tsx`

**Interfaces:**
- Consumes: `getCategoryFields(category)` and current `specifics`.
- Produces: schema-driven form controls and explicit manual verification state for edited fields.

- [ ] Write failing tests proving category changes reveal the correct fields, unknown specifics survive, and manual edits are marked protected.
- [ ] Extend form state with category specifics and protection metadata without changing existing saved records.
- [ ] Implement schema-driven text, number, select, and identifier controls.
- [ ] Persist specific values and field protection through the existing item draft path.
- [ ] Run desktop tests, full workspace tests, and desktop/mobile builds.
- [ ] Commit `feat: add dynamic protected inventory fields`.

### Task 7: Implement inspectable local learning

**Files:**
- Create: `packages/learning/src/index.ts`
- Create: `packages/learning/src/index.test.ts`
- Modify: `apps/desktop/src-tauri/src/db/intelligence.rs`
- Create: `apps/desktop/src/features/learning/LearningRulesManager.tsx`
- Create: `apps/desktop/src/features/learning/LearningRulesManager.test.tsx`

**Interfaces:**
- Produces: `createLearningEvent`, `deriveCorrectionRules`, `applyLearningRules`, rule CRUD commands, and the Learning Rules manager.

- [ ] Write failing tests for accepted, edited, and rejected events; repeated aliases; storage, provider, category, and title preferences; rule influence; editing; disabling; and removal.
- [ ] Implement deterministic rule derivation with a two-correction minimum.
- [ ] Persist events and rules locally, including explanation, priority, enabled state, and evidence count.
- [ ] Attach influencing rule identifiers to new suggestions.
- [ ] Build inspect/edit/enable/disable/remove controls and run package plus desktop tests.
- [ ] Commit `feat: add inspectable local learning engine`.

### Task 8: Implement deterministic offline search intelligence

**Files:**
- Create: `packages/search/src/index.ts`
- Create: `packages/search/src/index.test.ts`
- Modify: `apps/desktop/src-tauri/src/db/intelligence.rs`
- Create: `apps/desktop/src/features/search/SearchWorkspace.tsx`
- Create: `apps/desktop/src/features/search/SearchWorkspace.test.tsx`

**Interfaces:**
- Produces: `parseSearchQuery`, FTS5-backed structured search, saved/recent searches, required smart collections, and cards/table/closet results.

- [ ] Write failing tests for all five approved natural-language examples and quantity/status/condition filters.
- [ ] Implement reproducible token consumption, comparisons, filter output, and FTS5-safe free text.
- [ ] Add background reindexing across item text, OCR, identifiers, notes, specifics, and location.
- [ ] Persist saved searches and history and implement the five required smart collections.
- [ ] Build global command search plus cards, table, and messy-closet views.
- [ ] Commit `feat: add deterministic offline search intelligence`.

### Task 9: Integrate all intelligence workspaces

**Files:**
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/styles.css`
- Modify: `apps/desktop/src/lib/catalogueApi.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: evidence, learning, and search Tauri commands.
- Produces: one navigable Inventory Intelligence release with no cloud dependency.

- [ ] Add navigation and counts for review, rules, and search.
- [ ] Route high/medium fields through automatic persistence and low/conflicting/protected fields through review.
- [ ] Show source evidence and rule influence next to every suggestion.
- [ ] Connect global search, saved/recent searches, and smart collections.
- [ ] Run all desktop UI tests and production builds.
- [ ] Commit `feat: integrate inventory intelligence release`.

### Task 10: Release-gate the integrated release

**Files:**
- Create: `docs/releases/0.7-inventory-intelligence.md`
- Modify: `.github/workflows/ci.yml`
- Modify: `apps/desktop/package.json`

**Interfaces:**
- Produces: repeatable CI checks for TypeScript tests/builds and Rust migration/repository tests.

- [ ] Add CI steps for workspace tests, production builds, Rust formatting, Clippy, and Rust tests.
- [ ] Document confidence thresholds, protection rules, schema changes, and rollback behavior.
- [ ] Run `npm test` and require all tests to pass.
- [ ] Run `npm run build` and require desktop/mobile builds to pass.
- [ ] Run Rust checks locally when available and require them in GitHub Actions.
- [ ] Confirm `git diff --check` is clean and no database, media, secrets, or generated build artifacts are staged.
- [ ] Commit `ci: gate inventory intelligence release`.
