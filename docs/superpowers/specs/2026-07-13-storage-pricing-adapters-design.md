# Storage Management, Online Pricing Adapters, and Smart Inventory Auto-Fill Design

## Scope

This release delivers three integrated subsystems:

1. Physical storage management for locating, moving, labeling, and auditing inventory.
2. Automatic online pricing adapters that normalize sold-comparable data into Vault's existing valuation engine.
3. Camera/OCR inventory intelligence that converts captured photos into structured inventory fields with evidence and confidence tracking.

The release remains local-first. SQLite is the source of truth. External pricing providers are optional enhancements and cannot block catalog access, item editing, backups, camera capture, OCR, or manual valuation.

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

- `@vault/inventory-intelligence`
  - OCR field extraction and normalization
  - barcode and identifier parsing
  - category/subcategory inference
  - brand, model, year, edition, set, card number, size, color, material, serial, SKU, UPC/EAN mapping
  - title and description generation
  - field confidence and source evidence
  - protected merge rules that never silently overwrite user-verified fields
  - pricing-query and suggested-storage routing

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
- Scan Review workspace showing extracted fields, confidence, evidence, and auto-save status
- inventory editor indicators for AI-populated and user-verified fields

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
- `inventory_field_evidence`
- `inventory_field_decisions`
- `inventory_learning_rules`
- `scan_analysis_runs`

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

## Smart Camera Inventory Auto-Fill

### Inputs

The analysis pipeline consumes one or more captured photos, OCR text, barcode/QR results, image-quality metadata, and existing item context. It does not require cloud access for core extraction.

### Structured fields

The pipeline may populate:

- title
- category and subcategory
- brand and manufacturer
- model and part number
- serial number
- SKU
- UPC, EAN, ISBN, catalog number, card number, set code, or other identifiers
- year, edition, release, printing, rarity, and grading company where applicable
- size, color, material, dimensions, and weight clues
- condition clues and condition notes
- description
- item specifics and search keywords
- suggested marketplace category
- suggested storage category/location
- suggested online-pricing query

### Evidence model

Every inferred field stores:

- normalized field name
- proposed value
- confidence from 0.0 to 1.0
- extraction source (`ocr`, `barcode`, `logo`, `object`, `layout`, `user-rule`, or `combined`)
- source media ID
- raw OCR or decoded identifier when applicable
- creation time
- verification state
- superseded/rejected state

### Auto-save policy

- Confidence `>= 0.95`: automatically save when the target field is empty or still AI-managed.
- Confidence `0.80-0.9499`: automatically save and mark the field as AI-filled and reviewable.
- Confidence `< 0.80`: do not commit to the canonical field; show as a review suggestion.
- Barcode and exact identifier checksum matches may be treated as high-confidence even when OCR confidence is lower.
- Existing user-verified values are never overwritten automatically.
- Conflicting high-confidence evidence creates a review conflict instead of choosing silently.
- User corrections create local learning rules scoped by category, brand, identifier pattern, or field.

### Category and field routing

Category inference selects the best supported hierarchy, such as:

- Electronics -> Computers -> Laptops
- Clothing -> Shoes
- Collectibles -> Trading Cards
- Coins -> Silver Dollars
- Tools -> Power Tools
- Music -> Vinyl Records

Category changes trigger the appropriate field template so category-specific fields are populated rather than dumped into generic notes.

### Processing flow

1. Validate image quality and preserve all source photos.
2. Decode barcode/QR identifiers.
3. Run OCR and layout-aware text grouping.
4. Extract brands, models, identifiers, years, sets, editions, and attributes.
5. Infer category/subcategory.
6. Merge evidence using confidence and source reliability.
7. Populate safe fields according to the auto-save policy.
8. Produce a pricing query and route to relevant online providers.
9. Suggest a storage category or destination.
10. Record all decisions and expose uncertain/conflicting values for review.

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

The router considers category, identifiers, barcode, brand, model, set, edition, condition, and the camera-generated pricing query. It will not send photos or private notes to providers unless a future adapter explicitly requires them and the user enables that behavior.

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
- Camera/OCR output never replaces user-verified inventory fields without explicit review.

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
- unreadable image
- low-confidence extraction
- conflicting field evidence
- invalid barcode checksum

Provider failures cannot crash the desktop application or prevent manual valuation. Errors are stored with request metadata excluding secrets and sensitive headers.

Storage mutations use transactions. Invalid hierarchy operations, missing nodes, stale assignments, and bulk-move conflicts produce actionable errors and leave the database unchanged.

Camera/OCR failures preserve the photos and create a recoverable scan-analysis record. Partial extraction may still populate safe fields while uncertain values remain suggestions.

## Security

- No credentials in Git, `.env` commits, browser local storage, logs, exports, or backups.
- Secret values are redacted from provider errors.
- Network requests use HTTPS and provider-approved endpoints only.
- No prohibited scraping or bypassing provider access controls.
- QR labels contain opaque IDs and checksums only.
- Imported pricing files are parsed locally and treated as untrusted input.
- OCR evidence and photos stay local unless the user explicitly enables a remote provider in a future release.

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

### Scan Review

- source-photo gallery
- extracted fields grouped by category template
- confidence badges and evidence source
- auto-saved, review-needed, conflict, verified, and rejected states
- accept, reject, edit, and mark-verified actions
- raw OCR and barcode details
- suggested pricing query and routed providers
- suggested storage destination
- batch accept for safe high-confidence fields

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
- OCR field normalization
- category routing
- confidence thresholds
- protected merge behavior
- conflicting evidence handling
- local learning-rule application

### Integration tests

- SQLite migration creation
- create/move/archive storage nodes
- item assignment and history persistence
- provider cache persistence
- refresh job state transitions
- mocked provider success, authentication failure, rate limiting, timeout, cancellation, and malformed responses
- scan-analysis persistence
- field-evidence persistence
- auto-save into empty fields
- preservation of user-verified fields

### Application tests

- Storage Manager renders and performs core operations
- bulk relocation preserves consistency
- provider settings render health states
- online comparable retrieval feeds Marketplace Intelligence
- manual fallback remains usable with every provider disabled
- camera capture creates a structured inventory draft
- category-specific fields populate from OCR/barcode evidence
- low-confidence values remain review suggestions
- user corrections remain protected on later scans

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

The release provides deterministic local OCR/barcode field routing and confidence-based auto-fill. Advanced cloud object recognition is not required for core operation and is not silently enabled.