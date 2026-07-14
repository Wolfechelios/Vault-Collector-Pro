# Storage Rules and Background Indexing Design

## Scope

Complete three connected Inventory Intelligence capabilities: safe learned storage suggestions, fully editable local learning rules, and a genuine background FTS reindex worker.

## Storage behavior

- Repeated accepted storage corrections create inspectable `storage` rules scoped by category or item type.
- A matching rule may populate only an empty, unprotected storage field.
- The populated value remains visibly flagged until verified and records the rule that influenced it.
- Existing, conflicting, or user-entered storage values are never silently replaced; conflicts enter review.
- Storage recommendations use the existing evidence and field-suggestion persistence model.

## Rule editing

- The Learning Rules manager edits rule conditions, action value, priority, and enabled state.
- Inputs are structured and validated for the selected rule kind instead of requiring raw JSON.
- Saving preserves rule identity and audit timestamps.
- The UI previews the rule's effect before saving where current inventory data permits it.
- Rules remain local, inspectable, disableable, and removable.

## Background indexing

- The desktop application starts an asynchronous worker during Tauri setup.
- SQLite remains the durable job queue and source of truth.
- The worker drains small batches at startup and after item changes without blocking UI commands.
- A lightweight periodic wake catches changes from import paths that cannot send an in-process signal.
- Temporary database locks use bounded retry/backoff; permanent errors are logged without terminating the app.
- Shutdown cancels the worker cleanly.

## Data integrity

- Existing migrations and public command shapes remain compatible.
- Manual values retain protection during merges.
- A failed rule edit leaves the previous rule unchanged.
- Reindex jobs are removed only after the corresponding FTS document is updated successfully.

## Verification

- TypeScript tests cover storage rule derivation, safe application, attribution, and protected merges.
- UI tests cover structured editing and validation.
- Rust tests cover rule persistence, batch queue draining, FTS visibility, and retry-safe behavior.
- The complete frontend test/build suite and Rust CI gate must pass before merge.
