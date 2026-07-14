# Storage Management and Online Pricing Adapters Design

## Scope

This release delivers two integrated subsystems:

1. Physical storage management for locating, moving, labeling, and auditing inventory.
2. Automatic online pricing adapters that normalize sold-comparable data into Vault's existing valuation engine.

The release remains local-first. SQLite is the source of truth. External pricing providers are optional enhancements and cannot block catalog access, item editing, backups, or manual valuation.

## Architecture

### New shared packages

- `@vault/storage-management`
  - storage node domain model
  - hierarchy validation
  - capacity calculations
  - move planning and history
  - QR payload generation and parsing
  - scan-to-move commands
  - location search and breadcrumb generation

- `@vault/pricing-adapters`
  - provider adapter contract
  - credential-state model
  - normalized comparable schema
  - cache and rate-limit policy
  - retry and backoff logic
  - provider health reporting
  - adapters for eBay, TCGplayer, PriceCharting, Discogs, and manual/imported data

### Desktop integration

The desktop application receives:

- Storage Manager section
- tree and table views of physical locations
- create, rename, archive, and reorder actions
- bulk item relocation
- QR label export
- scan-to-move workflow
- location history and capacity warnings
- Pricing Providers settings panel
- credential status and provider health
- automatic comparable retrieval
- cache inspection and refresh controls
- provider-specific error details

### Persistence

SQLite migrations add:

- `storage_nodes`
- `storage_node_closure`
- `storage_assignments`
- `storage_moves`
- `storage_labels`
- `pricing_provider_accounts`
- `pricing_provider_cache`
- `pricing_provider_requests`
- `pricing_refresh_jobs`

Secrets are not stored in plaintext database columns. The database stores provider configuration and secret references. Tauri secure storage/keychain integration owns actual tokens where supported. A local encrypted fallback is permitted only when keychain access is unavailable.

## Storage Model

### Hierarchy

Supported node kinds:

- property
- building
- room
- zone
- cabinet
- shelf
- drawer
- bin
- case
- custom

The default path is:

`Property -> Room -> Cabinet/Shelf -> Bin -> Item`

The model is flexible enough to represent garages, warehouses, vehicles, safes, display cases, and off-site storage.

### Rules

- Every node has a stable UUID independent of its name or path.
- Renaming or moving a node does not break item references.
- A node cannot become its own ancestor.
- Archived nodes remain available in history but cannot receive new assignments.
- Items can have one active physical location and an append-only move history.
- Bulk relocation is transactional: either every selected assignment moves, or none do.
- Optional capacity can be expressed as item count, volume, weight, or a custom unit.
- Capacity warnings are advisory unless the user enables strict enforcement.

### QR labels

Each node can export a compact QR payload containing:

- payload version
- Vault installation identifier
- storage node UUID
- checksum

No item titles, addresses, API keys, or personal information are embedded in QR labels.

Scanning a location QR can:

- open that location
- assign a newly captured item
- move selected inventory
- begin a batch relocation session

## Online Pricing Adapter Model

### Provider contract

Each adapter implements:

- provider ID and display metadata
- credential requirements
- availability/health check
- query construction
- request execution
- response normalization
- pagination
- rate-limit interpretation
- cache TTL recommendation
- cancellation support

Every adapter returns `ProviderResult` objects compatible with the existing Marketplace Intelligence package.

### Initial providers

#### eBay

Primary general-purpose adapter. Uses official eBay APIs and sold/completed comparable data where the connected account and API product permit it. The adapter stores no eBay credentials in source control or browser local storage.

#### TCGplayer

Specialized adapter for trading cards. It activates only when valid credentials and API access are available. Product IDs, set data, printing, rarity, and condition are mapped into comparable evidence.

#### PriceCharting

Specialized adapter for video games and selected collectibles. Uses supported API access and maps loose, complete, new, and graded prices into condition-aware comparable records.

#### Discogs

Specialized adapter for music media. Uses official Discogs API access and maps release identifiers, media condition, sleeve condition, currency, and sale history when available.

#### Manual/import adapter

Always available. Supports CSV/JSON imported sold data and manual comparable entry. This is the fallback when an official provider cannot be used.

### Query routing

Provider selection is automatic but user-overridable:

- cards -> TCGplayer, eBay
- video games -> PriceCharting, eBay
- vinyl/CD/cassette -> Discogs, eBay
- general merchandise -> eBay
- unsupported categories -> eBay and manual/import

The router considers category, identifiers, barcode, brand, model, set, edition, and condition. It will not send photos or private notes to providers unless a future adapter explicitly requires them and the user enables that behavior.

### Caching and refresh

- Cache keys include provider, normalized query, condition, currency, and relevant identifiers.
- Default cache TTL is provider-specific and typically 6-24 hours.
- Manual refresh bypasses freshness checks but still respects hard provider rate limits.
- Stale cached results remain visible with a clear stale indicator if a provider is offline.
- Refresh jobs are retryable and cancellable.
- Exponential backoff includes jitter.
- Authentication failures are not retried until credentials change.
- Rate-limited requests schedule the next allowed attempt instead of repeatedly failing.

### Data integrity

- Provider results are append-only evidence attached to valuation snapshots.
- Refreshing prices never deletes previous valuations or comparable records.
- Currency is preserved and converted only through an explicit conversion layer.
- Listings identified as lots, parts-only, reproductions, or weak matches are marked or excluded by the existing pricing engine.
- User-entered comparables are never overwritten by provider refreshes.

## Error Handling

The system distinguishes:

- credentials required
- authorization denied
- provider unavailable
- rate limited
- malformed response
- network offline
- timeout
- cancelled
- unsupported category

Provider failures cannot crash the desktop application or prevent manual valuation. Errors are stored with request metadata excluding secrets and sensitive headers.

Storage mutations use transactions. Invalid hierarchy operations, missing nodes, stale assignments, and bulk-move conflicts produce actionable errors and leave the database unchanged.

## Security

- No credentials in Git, `.env` commits, browser local storage, logs, exports, or backups.
- Secret values are redacted from provider errors.
- Network requests use HTTPS and provider-approved endpoints only.
- No prohibited scraping or bypassing provider access controls.
- QR labels contain opaque IDs and checksums only.
- Imported pricing files are parsed locally and treated as untrusted input.

## User Interface

### Storage Manager

- hierarchy tree with expand/collapse
- breadcrumb navigation
- node editor
- occupancy and capacity indicators
- items-at-location table
- bulk select and move
- location history
- printable QR label sheet
- scan input field compatible with camera or USB scanners
- orphaned/unassigned inventory queue

### Pricing Providers

- provider cards with enabled state
- credential status
- health and last successful request
- cache age
- rate-limit state
- test connection action
- category routing controls
- automatic/manual refresh controls

### Valuation integration

The existing Value & Sell workspace gains:

- Fetch online comparables
- provider selection
- live job progress
- cached/stale indicators
- per-provider result counts
- normalized comparable review
- save valuation snapshot
- refresh history

## Testing

### Unit tests

- hierarchy validation and cycle prevention
- closure-table updates
- capacity calculations
- QR round trips and checksum rejection
- transactional bulk moves
- provider routing
- normalization for each provider fixture
- cache-key stability
- TTL and stale behavior
- retry/backoff classification
- secret redaction

### Integration tests

- SQLite migration creation
- create/move/archive storage nodes
- item assignment and history persistence
- provider cache persistence
- refresh job state transitions
- mocked provider success, authentication failure, rate limiting, timeout, cancellation, and malformed responses

### Application tests

- Storage Manager renders and performs core operations
- bulk relocation preserves consistency
- provider settings render health states
- online comparable retrieval feeds Marketplace Intelligence
- manual fallback remains usable with every provider disabled

### CI release gate

The pull request cannot merge until:

- every workspace test passes
- desktop and mobile production builds pass
- Rust/Tauri tests pass
- SQLite migration tests pass
- provider fixtures contain no real credentials
- secret scanning finds no tokens

## Delivery Boundary

This release includes production-ready adapter architecture and official-provider implementations that can operate when the user supplies valid credentials and the provider grants the required API access.

This release does not manufacture credentials, guarantee access to restricted sold-data products, bypass API approval, or use prohibited scraping. Providers without valid access remain disabled with manual/import fallback available.
