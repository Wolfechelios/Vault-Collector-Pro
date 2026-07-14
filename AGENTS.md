# AGENTS.md

# Vault Collector Pro Engineering Rules

## Mission

Build the world's best local-first inventory, catalog, and valuation platform.

Never sacrifice stability for speed.

---

## Repository Rules

- Never commit directly to main.
- Always use feature branches.
- One subsystem per branch.
- Open a Pull Request for every feature.
- CI must pass before merging.

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

Shared packages:
- domain
- pricing
- vision
- storage
- importer
- backup
- ui

---

## Non-Negotiable Requirements

Everything works offline.

No cloud dependency for core functionality.

Unlimited inventory.

Unlimited photos.

Local database.

Automatic backups.

Cross-platform.

---

## Coding Standards

Never delete working functionality.

Prefer extension over replacement.

Avoid breaking APIs.

Keep modules small.

Write tests for every new feature.

Fix failing tests before writing new code.

No placeholder implementations.

No TODO comments without a matching GitHub issue.

---

## Vision System

OCR is only one signal.

Combine:

- OCR
- Barcode
- Object Recognition
- Image Quality
- Duplicate Detection
- Category Detection

---

## Pricing

Store:

- Median value
- Comparable sales
- Confidence score
- Price history

Never overwrite historical prices.

---

## Inventory

Support:

- Cards
- Coins
- Comics
- Tools
- Electronics
- Clothing
- Shoes
- Jewelry
- Collectibles
- Household items

Everything uses the same inventory engine.

---

## Marketplace

Use an eBay-style listing model.

Support:

- Draft generation
- AI descriptions
- AI titles

Never delete user edits.

---

## Storage

Hierarchy:

House
→ Room
→ Shelf
→ Cabinet
→ Bin
→ Item

Everything has a physical location.

---

## Performance

Large collections must remain responsive.

Use background jobs for:

- OCR
- Pricing
- AI
- Thumbnail generation
- Duplicate detection

Never block the UI.

---

## Security

Never commit:

.env

API keys

Databases

Personal media

Secrets

---

## Release Rules

Every feature branch must:

Build successfully.

Pass tests.

Pass GitHub Actions.

Be merge-ready.

Never merge broken code.

## Verification Efficiency

- During installation and feature development, run only checks directly affected by the change.
- Do not repeat checks that already passed for the same unchanged code.
- Batch related corrections before triggering remote CI.
- Record plausible non-blocking risks for later review instead of repeatedly rebuilding every platform.
- Run the complete release matrix only for a final merge candidate or when the user explicitly requests it.
- Platform checks that require unavailable hardware, signing credentials, or host operating systems must be handed off with exact test instructions.

---

## Priority Order

1. Stability
2. Data integrity
3. Performance
4. User experience
5. New features

Never sacrifice the first three for the last.
