# Native Mobile Vision and Configurable Category Schemas

## Objective

Ship WolfeVault's existing offline mobile intelligence client as native iOS and Android applications, add production mobile OCR/barcode/object inference, and make category-specific fields editable data rather than compiled constants.

The implementation must remain local-first. Core capture, inference, schema rendering, review, and bundle exchange cannot depend on a network connection.

## Native Application Architecture

Capacitor will wrap `apps/mobile` without replacing its React UI, IndexedDB repository, or desktop bundle exchange. The repository will contain committed `ios` and `android` projects, camera/photo permissions, native asset configuration, and repeatable build/sync commands.

The web application remains independently buildable. A small runtime adapter will detect Capacitor and route image analysis through native plugins; browser development uses the existing local parser and reports native-only capabilities as unavailable.

## Vision Pipeline

The shared mobile vision interface accepts one or more local images and returns normalized evidence records containing:

- signal kind: OCR, barcode, logo, object, or metadata;
- extracted field and value;
- confidence;
- source image identifier;
- raw recognized text where applicable;
- engine identifier;
- verification state and warnings.

iOS uses Apple Vision for accurate text recognition and barcode detection. Android uses Google ML Kit text recognition and barcode scanning. Both platforms use a bundled TensorFlow Lite image classifier for offline object/category signals. Native results feed the existing `@vault/vision` parser and inventory inference logic rather than bypassing confidence and protected-field rules.

Logo inference is deliberately conservative. It combines recognized brand text, known-brand aliases, visual classifier signals, and learned local rules. A visually unsupported or conflicting logo remains a review suggestion. The release will not claim broad commercial logo coverage without a licensed or trained logo dataset.

Models and required runtime assets are bundled with the application. No inventory image is uploaded for core recognition.

## Category Schema Persistence

SQLite remains authoritative. `category_field_definitions` will support category, key, label, input kind, required/searchable flags, ordered options, aliases, display order, enabled state, and timestamps. A migration will preserve current seeded definitions and allow user-created categories and fields.

Desktop commands and a schema manager UI will provide list, create, edit, reorder, enable/disable, and remove operations. Deletion will remove only the definition; existing item-specific values remain preserved.

Desktop item forms will load definitions from SQLite. Snapshot export will include category schemas. Mobile import will store them atomically in IndexedDB, and mobile capture/review forms will render fields from the imported definitions. Static shared definitions remain only as migration/bootstrap defaults, not runtime authority.

## Data Flow

1. The user captures or selects photographs on a native device.
2. Native OCR, barcode, and image classification run locally.
3. Results are normalized and passed through shared deterministic parsing and confidence rules.
4. Mobile stores the capture, source images, evidence, and suggestions offline.
5. Category-specific controls come from the imported schema snapshot.
6. The existing checksummed change bundle returns accepted edits and captures to desktop.
7. Desktop applies changes transactionally and schedules search reindexing.

## Failure Handling

Unavailable native engines, unsupported images, model initialization failures, and permission denial produce visible warnings without losing the capture. Partial signals are retained. Low-confidence and conflicting results enter review. User-entered values remain protected from silent replacement.

Schema bundle validation occurs before IndexedDB mutation. Unsupported schema versions or malformed field definitions reject the import atomically.

## Verification and Handoff

Development verification is intentionally targeted:

- shared normalization and schema tests;
- mobile repository and UI tests affected by the change;
- mobile production web build;
- Capacitor configuration and Android sync/build where the environment supports it.

Already-passed unrelated desktop suites will not be repeated during installation. iOS compilation, signing, camera permissions, model performance, and physical-device behavior will be handed to the user with exact Xcode steps when macOS hardware or credentials are unavailable. Plausible non-blocking risks will be recorded for device testing instead of causing redundant full-matrix runs.

## Acceptance Criteria

- The repository opens as native projects in Android Studio and Xcode.
- Native captures run offline OCR and barcode detection on both platforms.
- Bundled offline classification returns object/category signals on both platforms.
- Logo/brand signals retain confidence and never silently overwrite protected values.
- Category definitions are editable in desktop SQLite-backed UI and drive desktop/mobile dynamic fields.
- Snapshot exchange transports category schemas with validation and atomic mobile persistence.
- Existing web-mobile workflows remain functional.
