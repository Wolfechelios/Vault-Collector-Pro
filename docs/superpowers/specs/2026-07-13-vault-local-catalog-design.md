# Vault Local Catalogue Design

## Goal

Build an Apple Silicon macOS application that acts as the master private catalogue for the user's possessions, with a browser-based phone companion for capture over local Wi-Fi. Each item is stored as a complete private eBay-style listing and can be valued using OCR-assisted identification plus hybrid comparable-sales sources.

## Product Principles

- The Mac is the authoritative source of truth.
- The complete catalogue, photos, ownership details, notes, and serial numbers remain local.
- Internet access is permitted only for approved pricing lookups and optional future marketplace publishing.
- Every item is listing-ready from the moment it is created, but private and unpublished by default.
- OCR proposes data; verified user data is never silently overwritten.
- The app must work for cards, comics, magazines, books, coins, cash, media, electronics, memorabilia, posters, furniture, vehicles, and custom categories.

## Platform and Technology

- macOS Apple Silicon first release.
- Tauri 2 desktop shell.
- React + TypeScript frontend.
- Rust backend for SQLite access, filesystem operations, local HTTPS server, device pairing, pricing orchestration, encryption, backup, and migration.
- Browser-based mobile companion served by the desktop application.
- SQLite master database with managed local media storage.
- Apple Vision OCR on macOS, with a local fallback OCR adapter.

## Core Architecture

### Desktop Application

The desktop application owns the master database, original images, derived thumbnails, OCR data, valuation history, backup schedules, and trusted-device records. It exposes a local HTTPS service only while phone capture is enabled.

### Phone Companion

The phone companion is opened by scanning a QR code displayed by the Mac. It supports camera capture, multi-image upload, draft editing, barcode scanning, storage-location scanning, item lookup, and queue status. It does not retain the full catalogue.

### Storage

- SQLite database for normalized records and search indexes.
- Original photos stored unchanged in a managed media directory.
- Thumbnails, OCR crops, and normalized images stored as derived assets.
- Content hashes prevent duplicate media storage.
- Backup archives contain database, media, settings, trusted-device data, and a manifest with checksums.

## Item Record

Every item is a private listing record with:

- Listing title
- Category and subcategory
- Condition and condition description
- Item specifics
- Brand, model, year, edition, serial number, SKU
- Quantity
- Multiple ordered photos
- Full description
- Purchase price
- Current median market value
- Suggested asking price
- Minimum acceptable price
- Shipping dimensions and weight
- Storage location
- Acquisition date
- Status: Collection, Draft, Listed, Sold, Archived
- Private notes
- OCR evidence and confidence per extracted field
- Valuation history
- Comparable sales
- Sale price and sale date

## Capture and OCR Workflow

1. Phone captures one or more photos.
2. Mac receives the images over the paired local connection.
3. Images are preserved, normalized, deskewed, and perspective-corrected for OCR.
4. OCR extracts visible text, barcodes, identifiers, and category clues.
5. The category engine suggests a schema and item specifics.
6. The user reviews and corrects the proposed identity.
7. The pricing engine queries approved sources using minimum necessary identifying data.
8. Comparable results are normalized and filtered.
9. The app calculates a cleaned median and confidence score.
10. The user approves the valuation and saves the item.
11. The item is assigned to a physical storage location.

## Pricing Engine

### Sources

- eBay sold listings as the broad baseline where officially accessible.
- Category-specific official APIs where available.
- CSV/JSON comparable-sale imports where an API is unavailable.
- No unsupported scraping in the first release.

### Comparable Filtering

Exclude or down-rank:

- Active asking prices
- Lots when valuing a single item
- Reproductions and replicas when the item is authentic
- Incorrect variants, editions, years, or model numbers
- Conditions materially different from the target item
- Extreme statistical outliers
- Listings with weak identity matches

### Valuation Output

- Median sold value
- Low and high comparable range
- Valid comparable count
- Date range
- Source breakdown
- Condition adjustment
- Match confidence
- Valuation confidence
- Suggested listing price

All valuation changes are appended to history and require approval before replacing a verified value.

## Pairing and Security

- Same-LAN requirement for the phone companion.
- QR code plus temporary six-digit pairing code.
- Manual approval on the Mac for first connection.
- Per-device trusted token stored in secure browser storage and represented in the Mac database.
- Device revocation from the desktop UI.
- Local HTTPS using an application-managed certificate.
- API credentials stored in macOS Keychain.
- Local server binds only to explicitly selected private interfaces.
- No telemetry by default.

## Organisation and Search

- Categories and custom categories
- Collections and custom tags
- Rooms, shelves, boxes, bins, and storage-location QR labels
- Saved searches and smart collections
- Duplicate detection
- Recently added, highest value, unvalued, stale valuation, missing photo, and missing location views
- Full-text search across title, OCR text, category, item specifics, description, notes, serial/SKU, and storage path

## Migration

Supported sources:

- Existing Vault HTML data
- Vault JSON exports
- CSV
- Excel
- eBay-style listing exports
- Photo folders
- Mixed folders containing images and notes

Migration must create a rollback snapshot, infer field mappings, match photos, detect likely duplicates, preview proposed changes, import only approved records, and verify record counts and media checksums.

## Backup and Recovery

- Scheduled encrypted backups to a selected local folder.
- Optional mirror copy to an external drive.
- Manual Back Up Now action.
- Versioned snapshots and configurable retention.
- Restore preview and integrity validation.
- Emergency recovery package.
- Database repair and media reconciliation tools.

## Main Screens

- Dashboard
- Inventory
- Add Item
- Camera Inbox
- OCR Review
- Item Editor
- Item Detail
- Pricing Review
- Comparable Sales
- Storage Locations
- Collections
- Migration Center
- Backup and Restore
- Trusted Devices
- Settings
- Diagnostics

## First Release Acceptance Criteria

- Runs as an Apple Silicon macOS application.
- Imports the current Vault seed data.
- Creates, edits, searches, and archives private listing-first records.
- Stores multiple local photos per item.
- Receives phone photos over the local network after secure pairing.
- Extracts OCR text locally and records confidence.
- Calculates median valuations from normalized comparable data through pluggable providers.
- Maintains valuation history.
- Supports hierarchical storage locations and printable QR labels.
- Creates and validates encrypted backups.
- Produces a signed-ready `.app` and `.dmg` build workflow.

## Explicit Non-Goals for First Release

- Cloud catalogue synchronization
- Remote access over the public internet
- Automatic marketplace publishing
- Native iOS or Android application
- Unsupported web scraping
- Multi-user collaboration
