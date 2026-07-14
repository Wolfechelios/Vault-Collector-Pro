# Mobile Intelligence and Tauri E2E Design

## Objective

Deliver touch-first mobile parity for WolfeVault's intelligence workflow and add a required end-to-end test gate that drives the real Tauri desktop application. Core behavior remains offline and local-first. Desktop SQLite remains authoritative.

## Scope

Mobile includes:

- multi-photo capture and local analysis;
- confidence-based Scan Review;
- evidence and learned-rule attribution;
- deterministic natural-language inventory search;
- saved searches and smart collections;
- inspectable, editable, disableable, and removable learning rules;
- offline persistence and verified bundle exchange with desktop.

Desktop-only backup administration, general-purpose importing, marketplace workflows, and bulk inventory administration remain out of scope.

## Shared architecture

A new headless shared layer owns bundle schemas, checksum verification, protected merge semantics, mobile change tracking, rule validation, and synchronization conflict results. Existing domain, learning, search, and inventory-intelligence packages remain the source of inference and query behavior. Mobile and desktop render separate interfaces against these shared contracts so touch layouts do not inherit Tauri or desktop assumptions.

The exchange protocol is transport-independent. The first transport is manual file exchange; a future same-Wi-Fi transport can carry the same snapshots and change sets without changing merge semantics.

## Intelligence bundle protocol

Desktop exports a versioned snapshot containing:

- a stable vault identifier and monotonically increasing revision;
- inventory records;
- scan evidence and field suggestions;
- item field state, including protection and verification state;
- correction rules;
- saved searches;
- export timestamp and SHA-256 checksum.

Mobile exports an append-only change bundle containing:

- source vault identifier and imported base revision;
- accepted, edited, and rejected suggestion decisions;
- new offline captures and their evidence;
- rule edits with original and updated timestamps;
- saved-search changes;
- creation timestamp and SHA-256 checksum.

Import validates the schema version, checksum, vault identity, and base revision before mutation. Desktop applies valid changes in one SQLite transaction. User-protected or concurrently changed fields never merge silently; they produce standard review suggestions with conflict evidence. Duplicate change IDs are idempotent.

## Mobile persistence

IndexedDB stores snapshot data and a separate append-only change log. Schema upgrades are explicit and rollback-safe. A failed import writes nothing. The previous usable snapshot remains available if a migration or bundle validation fails.

Mobile search and smart collections read only local IndexedDB data and shared deterministic query parsing. No server, account, or network request is required.

## Mobile interface

The mobile application uses five touch-first workspaces:

1. **Capture** — photographs, image-quality feedback, extracted fields, and offline queue.
2. **Review** — confidence badges, proposed values, accept/edit/reject controls, and protected-conflict warnings.
3. **Search** — natural-language search, structured result cards, recent searches, and saved searches.
4. **Collections** — unpriced, unassigned, duplicate, missing-photo, and review-needed collections.
5. **Rules** — rule origin, influence, structured editing, priority, enable/disable, and removal.

Evidence opens in a mobile sheet with source photo metadata, raw text, confidence, provider, and influencing rules. Import/export status reports exact counts and actionable validation errors.

## Desktop integration

Desktop adds explicit intelligence snapshot export and mobile change import actions. Repository methods serialize authoritative SQLite records and apply change bundles transactionally. Import results report applied decisions, imported captures, updated rules, duplicate changes, and conflicts sent to Scan Review.

The desktop background indexer is notified after successful bundle import so FTS results update without opening Search.

## Error and conflict handling

- Invalid version, checksum, vault identity, or malformed content rejects the whole bundle.
- A stale base revision is allowed only when every referenced record is unchanged; otherwise affected changes become review conflicts.
- Protected values are never overwritten automatically.
- Rule edit conflicts preserve the desktop version and create a visible conflict result.
- Interrupted IndexedDB or SQLite writes remain atomic.
- Bundle files contain inventory data and therefore display a privacy warning before export.

## True Tauri end-to-end automation

WebdriverIO drives the actual Linux Tauri binary through `tauri-driver` under a virtual display. Tests use an isolated application-data directory and exercise native IPC, SQLite, window lifecycle, and restart persistence rather than a Vite browser preview.

The required E2E scenarios are:

1. launch the packaged application and create an item;
2. export an intelligence snapshot and validate the generated file;
3. import a mobile change bundle and observe its decision in the UI;
4. confirm a learned storage rule fills only an empty location and remains flagged;
5. confirm protected conflicts appear in Scan Review;
6. confirm background FTS indexing makes a changed item searchable without a foreground reindex command;
7. restart the Tauri process and confirm SQLite persistence.

Tests use stable semantic selectors and deterministic seed/fixture commands available only in test builds. Test-only commands cannot be enabled in production builds.

## CI and diagnostics

GitHub Actions retains frontend and macOS Rust jobs and adds:

- mobile unit/component tests and a production mobile build;
- an Ubuntu Tauri E2E job installing WebKitGTK, `tauri-driver`, WebdriverIO, and a virtual display;
- required screenshots, WebDriver logs, Tauri stdout/stderr, and the isolated SQLite database as failure artifacts.

All existing checks plus mobile and native E2E checks must pass before merge.

## Acceptance criteria

- Mobile completes capture, review, evidence inspection, search, smart collection, and rule-management workflows offline.
- Snapshot and change bundles round-trip deterministically with checksum and revision validation.
- Protected and concurrent edits never overwrite silently.
- Desktop search reindexes successful imports in the background.
- The required Linux job drives the real Tauri app and passes all seven scenarios.
- Desktop and mobile production builds, TypeScript tests, Rust tests, SQLite tests, and E2E tests are green.
