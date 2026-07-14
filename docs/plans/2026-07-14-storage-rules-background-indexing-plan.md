# Storage Rules and Background Indexing Implementation Plan

## 1. Establish behavior with tests

- Add learning-package tests for deriving and applying storage rules.
- Add protected-merge tests proving existing and manual locations are unchanged.
- Add desktop UI tests for editing valid rules and rejecting invalid rule shapes.
- Add Rust persistence tests for atomic rule updates and reindex queue draining.

## 2. Complete storage learning

- Extend learning evaluation with storage-specific matching and influence metadata.
- Feed learned storage recommendations into the standard field suggestion pipeline.
- Apply safe automatic storage only when the target field is empty and unprotected.
- Route conflicts to review and retain source evidence.

## 3. Complete rule management

- Add validated rule-update commands and repository methods.
- Add structured condition/action controls to the Learning Rules manager.
- Show a concise effect preview and preserve all existing toggle, priority, and removal behavior.

## 4. Run indexing continuously

- Refactor queue draining into a bounded, independently testable Rust operation.
- Start and manage the background worker from Tauri application setup.
- Signal the worker after local mutations and retain periodic wake-up as a durable fallback.
- Add retry/backoff and clean shutdown behavior.

## 5. Verify and release

- Run focused tests after each implementation slice.
- Run the full unit, integration, frontend build, desktop/mobile build, and formatting/lint checks.
- Publish the feature branch, open a PR, wait for GitHub Actions, and merge only when every gate passes.
