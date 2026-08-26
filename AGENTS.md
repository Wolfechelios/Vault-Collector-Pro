# AGENTS.md

# Archive Boutique Engineering Rules

## Mission

Build Archive Boutique as a local-first museum, collection, valuation, storage, and marketplace platform.

The museum experience is the primary application architecture. Inventory, OCR, learning, search, storage, pricing, and marketplace systems exist underneath it and must not replace it with a generic dashboard-first inventory UI.

Never sacrifice stability for speed.

---

## Product Architecture

User-facing concepts:

- Museum Experience
- Curator Intelligence
- Archive Operations
- Valuation & Marketplace
- Collection Knowledge

Every physical item is presented as an exhibit. Collections are galleries or exhibitions. Physical storage is the archive/back room. Technical workflows are curator workspaces such as Intake Studio, Curator Review, Valuation Office, and Archive Storage.

The existing museum/gallery architecture must be preserved and extended rather than replaced.

---

## Repository Rules

- Never commit directly to main.
- Always use feature branches.
- One coherent release block per branch.
- Open a Pull Request for every release.
- CI must pass before merging.
- Prefer large integrated changes over tiny disconnected patches.

---

## Tooling Policy

Do not use Lovable or consume Lovable credits unless the user explicitly asks for it or there is a genuine implementation blocker that cannot reasonably be solved directly in the repository.

Default implementation path is direct repository development with TypeScript, React, Tauri, Rust, SQLite, tests, and GitHub Actions.

---

## Architecture

SQLite is the source of truth.

Desktop:
- Tauri
- React
- TypeScript

Mobile:
- React
- Shared packages

Shared packages include:
- domain
- pricing
- vision
- storage
- storage-management
- marketplace
- pricing-adapters
- inventory-intelligence
- importer
- backup
- ui

---

## Non-Negotiable Requirements

Everything works offline for core functionality.

No cloud dependency for catalog access, item editing, learning rules, search, storage, or backups.

Unlimited inventory.

Unlimited photos where platform storage permits.

Local database.

Automatic backups.

Cross-platform architecture.

User-entered values must never be silently overwritten by automated systems.

---

## Curator Intelligence

OCR is only one signal.

Combine:

- OCR
- Barcode
- Object Recognition
- Image Quality
- Duplicate Detection
- Category Detection
- Brand/Model Recognition
- Condition Evidence
- Learning Rules
- Search Intelligence

High-confidence evidence may auto-fill fields. Lower-confidence or conflicting evidence must be surfaced for curator review. Every suggestion must retain its source and confidence.

---

## Learning

Learning must be explainable, local, inspectable, editable, and reversible.

Learn from accepted corrections, rejected suggestions, category preferences, storage preferences, title conventions, and repeated OCR corrections.

Do not hide learning behavior in opaque remote training.

---

## Search

Search must work offline and cover titles, brands, models, identifiers, descriptions, notes, OCR evidence, specifics, categories, conditions, values, statuses, and storage locations.

Natural-language queries should be translated into deterministic filters whenever possible.

---

## Pricing

Store:

- Median value
- Comparable sales
- Confidence score
- Price history

Never overwrite historical prices.

Official provider APIs are preferred. Do not bypass provider access controls or use prohibited scraping.

---

## Marketplace

Use a marketplace-ready listing model.

Support:

- Draft generation
- Assisted descriptions
- Assisted titles
- Shipping recommendations
- CSV/JSON export

Never delete or silently replace user edits.

---

## Storage

Physical storage is represented as the Archive Back Room.

Hierarchy may include:

Property
→ Room
→ Zone
→ Cabinet/Rack
→ Shelf/Drawer
→ Bin/Case
→ Exhibit

Everything can have a physical location and append-only move history.

---

## Curator Timeline

Every exhibit should retain a living history of meaningful actions such as acquisition, capture, OCR/recognition, edits, verification, valuation, movement, listing, sale, restoration, and archival.

History is additive; do not erase prior events when state changes.

---

## Performance

Large collections must remain responsive.

Use background jobs for:

- OCR
- Pricing
- AI/vision analysis
- Thumbnail generation
- Duplicate detection
- Search indexing

Never block the UI for long-running work.

---

## Security

Never commit:

.env

API keys

Databases

Personal media

Secrets

Provider credentials

---

## Release Rules

Every feature branch must:

Build successfully.

Pass the tests directly covering changed modules plus the final release gate.

Pass GitHub Actions before merge.

Be merge-ready.

Do not waste time on redundant repeated test loops when the touched modules and final build gate already provide coverage.

Never merge broken code.

---

## Priority Order

1. Stability
2. Data integrity
3. Museum experience consistency
4. Performance
5. User experience
6. New features

Never sacrifice the first four for feature count.
