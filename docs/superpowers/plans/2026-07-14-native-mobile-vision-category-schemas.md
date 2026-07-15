# Native Mobile Vision and Configurable Category Schemas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package WolfeVault Mobile for iOS and Android, run offline native vision analysis, and drive category-specific fields from SQLite-managed schemas on desktop and mobile.

**Architecture:** Capacitor wraps the existing React mobile build. A typed `VaultVision` bridge normalizes Apple Vision and Android ML Kit results into the existing shared evidence model. SQLite owns category definitions; verified desktop snapshots copy those definitions atomically into mobile IndexedDB.

**Tech Stack:** React 19, TypeScript, Vite, Capacitor, Swift/Apple Vision, Kotlin/Google ML Kit, TensorFlow Lite-compatible bundled classification, Rust, rusqlite, SQLite, IndexedDB, Vitest.

## Global Constraints

- Core capture, inference, schema rendering, review, and bundle exchange work offline.
- SQLite remains the desktop source of truth.
- User-entered inventory values are never silently replaced.
- Unsupported logo candidates remain review suggestions.
- Existing item-specific values survive schema definition deletion.
- Run only affected checks during implementation; batch remote verification once.
- iOS signing and physical-device behavior are user handoff checks when macOS hardware or credentials are unavailable.

---

### Task 1: Persist and exchange configurable category schemas

**Files:**
- Create: `apps/desktop/src-tauri/migrations/0007_category_schema_management.sql`
- Modify: `apps/desktop/src-tauri/src/db/mod.rs`
- Modify: `apps/desktop/src-tauri/src/db/intelligence.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `packages/intelligence-sync/src/index.ts`
- Test: `packages/intelligence-sync/src/index.test.ts`
- Test: `apps/desktop/src-tauri/src/db/intelligence.rs`

**Interfaces:**
- Produces: `CategorySchemaRecord`, `CategorySchemaInput`, `IntelligenceRepository::{list,upsert,delete}_category_schema`.
- Extends: `SnapshotPayload.categorySchemas: CategorySchemaRecord[]`.
- Preserves: item-specific values when a definition is disabled or removed.

- [ ] **Step 1: Write failing snapshot and validation tests**

```ts
it('round-trips validated category schemas', async () => {
  const bundle = await createSnapshotBundle('vault-1', 4, {
    ...emptyPayload,
    categorySchemas: [{ category: 'tools', key: 'voltage', label: 'Voltage', kind: 'text', required: false, searchable: true, options: [], aliases: ['volts'], order: 10, enabled: true }]
  });
  expect((await verifySnapshotBundle(bundle)).payload.categorySchemas[0].key).toBe('voltage');
});

it('rejects malformed schema definitions before import', async () => {
  const bundle = await createSnapshotBundle('vault-1', 4, { ...emptyPayload, categorySchemas: [{ category: '', key: 'x' }] as any });
  await expect(verifySnapshotBundle(bundle)).rejects.toThrow('category schema');
});
```

- [ ] **Step 2: Run only the sync-package test and confirm failure**

Run: `npm run test --workspace @vault/intelligence-sync`

Expected: FAIL because `categorySchemas` is not part of the snapshot payload or validator.

- [ ] **Step 3: Add migration and repository records**

```sql
ALTER TABLE category_field_definitions ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1));
ALTER TABLE category_field_definitions ADD COLUMN updated_at TEXT;
UPDATE category_field_definitions SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE updated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_category_fields_runtime
  ON category_field_definitions(category, enabled, display_order);
```

Define the Rust record with camel-case serialization and parse `options_json`/`aliases_json` into arrays at the command boundary. `delete_category_schema` deletes only the definition row.

- [ ] **Step 4: Extend snapshot serialization and validation**

```ts
export type CategorySchemaRecord = {
  category: string; key: string; label: string; kind: string;
  required: boolean; searchable: boolean; options: string[];
  aliases: string[]; order: number; enabled: boolean;
};

export type SnapshotPayload = ExistingSnapshotPayload & {
  categorySchemas: CategorySchemaRecord[];
};
```

Validation rejects blank category/key/label/kind, duplicate `category:key`, non-finite order, and non-array options/aliases before checksum acceptance.

- [ ] **Step 5: Add Tauri CRUD commands and Rust transaction tests**

Test create, update, ordering, disable, deletion, snapshot inclusion, and preservation of an existing `item_specifics` value. Register:

```rust
list_category_schemas,
upsert_category_schema,
delete_category_schema,
```

- [ ] **Step 6: Run affected persistence checks**

Run: `npm run test --workspace @vault/intelligence-sync`

Expected: PASS.

Run when Cargo is available: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml category_schema`

Expected: category schema tests PASS. If Cargo is unavailable, record this single check for CI rather than running unrelated suites.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src-tauri packages/intelligence-sync
git commit -m "Persist configurable category schemas"
```

### Task 2: Make desktop forms and schema management database-driven

**Files:**
- Create: `apps/desktop/src/features/categories/CategorySchemaManager.tsx`
- Create: `apps/desktop/src/features/categories/CategorySchemaManager.test.tsx`
- Create: `apps/desktop/src/features/categories/categorySchema.ts`
- Modify: `apps/desktop/src/features/items/CategorySpecificFields.tsx`
- Modify: `apps/desktop/src/lib/catalogueApi.ts`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/styles.css`

**Interfaces:**
- Consumes: native schema CRUD commands from Task 1.
- Produces: `normalizeCategorySchemas(rows)` and `fieldsForCategory(rows, category)`.
- Changes: `CategorySpecificFields` accepts `definitions` instead of importing compiled runtime definitions.

- [ ] **Step 1: Write failing component tests**

```tsx
it('renders enabled database definitions in display order', () => {
  const html = renderToStaticMarkup(<CategorySpecificFields category="tools" specifics={{}} definitions={[
    { category: 'tools', key: 'voltage', label: 'Voltage', kind: 'text', order: 20, enabled: true },
    { category: 'tools', key: 'hidden', label: 'Hidden', kind: 'text', order: 10, enabled: false }
  ] as any} onChange={() => undefined}/>);
  expect(html).toContain('Voltage');
  expect(html).not.toContain('Hidden');
});

it('exposes edit disable and remove controls', () => {
  const html = renderToStaticMarkup(<CategorySchemaManager schemas={[schema]} onSave={() => undefined} onDelete={() => undefined}/>);
  expect(html).toContain('Disable field');
  expect(html).toContain('Remove definition');
});
```

- [ ] **Step 2: Run affected desktop component tests and confirm failure**

Run: `npm run test --workspace @vault/desktop -- src/features/categories/CategorySchemaManager.test.tsx src/features/items/CategorySpecificFields.test.tsx`

Expected: FAIL because the manager and injected-definition API do not exist.

- [ ] **Step 3: Implement the API and pure schema selectors**

```ts
export const categorySchemaApi = {
  list: () => invoke<CategorySchemaRecord[]>('list_category_schemas'),
  save: (schema: CategorySchemaRecord) => invoke<CategorySchemaRecord>('upsert_category_schema', { schema }),
  remove: (category: string, key: string) => invoke<void>('delete_category_schema', { category, key })
};

export function fieldsForCategory(rows: CategorySchemaRecord[], category: string) {
  return rows.filter(row => row.enabled && (row.category === '*' || row.category === category.toLowerCase()))
    .sort((a, b) => a.order - b.order);
}
```

- [ ] **Step 4: Implement schema manager and dynamic form wiring**

The manager edits label/kind/required/searchable/options/aliases/order and uses explicit Save, Disable/Enable, and Remove actions. `App` loads schemas with its existing initial data and refreshes only schema state after mutations.

- [ ] **Step 5: Run affected desktop tests and build once**

Run: `npm run test --workspace @vault/desktop -- src/features/categories/CategorySchemaManager.test.tsx src/features/items/CategorySpecificFields.test.tsx`

Expected: PASS.

Run: `npm run build --workspace @vault/desktop`

Expected: PASS. Do not rerun the full workspace suite.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src
git commit -m "Drive desktop category fields from SQLite"
```

### Task 3: Store schemas atomically and render them on mobile

**Files:**
- Modify: `apps/mobile/src/data/mobileIntelligenceDb.ts`
- Modify: `apps/mobile/src/data/mobileIntelligenceDb.test.ts`
- Create: `apps/mobile/src/features/categories/MobileCategoryFields.tsx`
- Create: `apps/mobile/src/features/categories/MobileCategoryFields.test.tsx`
- Modify: `apps/mobile/src/features/capture/MobileCapture.tsx`
- Modify: `apps/mobile/src/App.tsx`

**Interfaces:**
- Consumes: `SnapshotPayload.categorySchemas` from Task 1.
- Produces: `MobileIntelligenceRepository.listCategorySchemas(category?)`.
- Mobile capture emits schema-backed `specifics` alongside vision evidence.

- [ ] **Step 1: Write failing atomic-import and rendering tests**

```ts
it('replaces category schemas in the same verified snapshot transaction', async () => {
  await repository.importSnapshot(snapshotWithSchemas([voltage]));
  expect(await repository.listCategorySchemas('tools')).toEqual([voltage]);
  await expect(repository.importSnapshot(tamperedSnapshot)).rejects.toThrow();
  expect(await repository.listCategorySchemas('tools')).toEqual([voltage]);
});
```

```tsx
it('renders imported select options', () => {
  const html = renderToStaticMarkup(<MobileCategoryFields definitions={[powerSource]} values={{}} onChange={() => undefined}/>);
  expect(html).toContain('Battery');
  expect(html).toContain('Corded');
});
```

- [ ] **Step 2: Run only affected mobile tests and confirm failure**

Run: `npm run test --workspace @vault/mobile -- src/data/mobileIntelligenceDb.test.ts src/features/categories/MobileCategoryFields.test.tsx`

Expected: FAIL because the schema store and component do not exist.

- [ ] **Step 3: Add IndexedDB schema store and atomic import**

Increase the database version, create `categorySchemas` keyed by `[category,key]`, clear and repopulate it inside the same snapshot transaction, and keep checksum validation before opening a write transaction.

- [ ] **Step 4: Add dynamic capture controls**

```tsx
<MobileCategoryFields
  definitions={schemas.filter(row => row.enabled && (row.category === '*' || row.category === category))}
  values={specifics}
  onChange={(key, value) => setSpecifics(current => ({ ...current, [key]: value }))}
/>
```

- [ ] **Step 5: Run affected tests and one mobile build**

Run: `npm run test --workspace @vault/mobile -- src/data/mobileIntelligenceDb.test.ts src/features/categories/MobileCategoryFields.test.tsx src/App.test.tsx`

Expected: PASS.

Run: `npm run build --workspace @vault/mobile`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src
git commit -m "Render synced category schemas on mobile"
```

### Task 4: Add the Capacitor iOS and Android applications

**Files:**
- Create: `apps/mobile/capacitor.config.ts`
- Create: `apps/mobile/android/**`
- Create: `apps/mobile/ios/**`
- Modify: `apps/mobile/package.json`
- Modify: `package-lock.json`
- Create: `apps/mobile/src/native/runtime.ts`
- Test: `apps/mobile/src/native/runtime.test.ts`
- Create: `docs/mobile-device-testing.md`

**Interfaces:**
- Produces: `isNativeMobile(): boolean`, `mobile:sync`, `mobile:android`, and `mobile:ios` scripts.
- Capacitor identity: `com.wolfe.vaultcollector`; display name: `WolfeVault`.
- Web directory: `dist`.

- [ ] **Step 1: Write the failing runtime-adapter test**

```ts
it('keeps browser development on the web adapter', () => {
  expect(runtimePlatform({ isNativePlatform: () => false } as any)).toBe('web');
});
```

- [ ] **Step 2: Install one aligned Capacitor major and camera plugin**

Run from the repository root:

```bash
npm install --workspace @vault/mobile @capacitor/core @capacitor/camera
npm install --workspace @vault/mobile --save-dev @capacitor/cli @capacitor/android @capacitor/ios
```

Use the same resolved major for all five Capacitor packages; keep the lockfile result. Do not independently upgrade unrelated packages.

- [ ] **Step 3: Add configuration and scripts**

```ts
const config: CapacitorConfig = {
  appId: 'com.wolfe.vaultcollector',
  appName: 'WolfeVault',
  webDir: 'dist',
  bundledWebRuntime: false
};
```

Scripts:

```json
{
  "mobile:sync": "npm run build && cap sync",
  "mobile:android": "npm run mobile:sync && cap open android",
  "mobile:ios": "npm run mobile:sync && cap open ios"
}
```

- [ ] **Step 4: Generate and retain both native projects**

Run:

```bash
npx cap add android
npx cap add ios
npm run mobile:sync
```

Add Android camera permission and iOS `NSCameraUsageDescription`/`NSPhotoLibraryUsageDescription`. Configure Android `minSdk` to at least 23 for bundled ML Kit.

- [ ] **Step 5: Validate only generated-project synchronization**

Run: `npm run mobile:sync --workspace @vault/mobile`

Expected: web build copied and both native projects synchronized.

If Android tooling is present, run: `cd apps/mobile/android && ./gradlew assembleDebug`

Expected: debug APK succeeds. If Android SDK is unavailable, record the command in the handoff instead of installing an unrelated SDK stack.

Do not attempt iOS compilation on a non-macOS host. Document Xcode open, team selection, signing, device selection, and Run steps.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile package-lock.json docs/mobile-device-testing.md
git commit -m "Package WolfeVault Mobile with Capacitor"
```

### Task 5: Implement native offline OCR, barcode, object, and logo signals

**Files:**
- Create: `apps/mobile/src/native/vision.ts`
- Create: `apps/mobile/src/native/vision.test.ts`
- Modify: `apps/mobile/src/features/capture/MobileCapture.tsx`
- Create: `apps/mobile/ios/App/App/VaultVisionPlugin.swift`
- Modify: `apps/mobile/ios/App/App/AppDelegate.swift`
- Create: `apps/mobile/android/app/src/main/java/com/wolfe/vaultcollector/VaultVisionPlugin.kt`
- Modify: `apps/mobile/android/app/src/main/java/com/wolfe/vaultcollector/MainActivity.kt`
- Modify: `apps/mobile/android/app/build.gradle`
- Create: `apps/mobile/android/app/src/main/assets/vault_inventory_classifier.tflite`
- Create: `apps/mobile/ios/App/App/vault_inventory_classifier.mlmodelc/**`
- Modify: `docs/mobile-device-testing.md`

**Interfaces:**
- Produces: `VaultVision.analyze({ images: NativeVisionImage[] }): Promise<NativeVisionResult>`.
- Normalizes: `NativeVisionSignal` into `VisionSignal` accepted by `parseVisionText`.
- Signal shape includes `kind`, `field`, `value`, `confidence`, `sourceImageId`, `rawText`, `bounds`, and `engine`.

- [ ] **Step 1: Write failing normalization and protected-confidence tests**

```ts
it('normalizes native signals without promoting uncertain logos', () => {
  const candidate = nativeResultToCandidate({
    rawText: 'DEWALT', barcodes: [],
    signals: [{ kind: 'logo', field: 'brand', value: 'DeWalt', confidence: 0.54, sourceImageId: 'p1', engine: 'Vision' }]
  });
  expect(candidate.fields.find(row => row.field === 'brand')?.confidence).toBe(0.54);
});

it('falls back visibly when native analysis is unavailable', async () => {
  await expect(analyzeNativePhotos([], unavailablePlugin)).rejects.toThrow('Native vision is unavailable');
});
```

- [ ] **Step 2: Run the native adapter test and confirm failure**

Run: `npm run test --workspace @vault/mobile -- src/native/vision.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the typed Capacitor bridge**

```ts
export interface VaultVisionPlugin {
  analyze(options: { images: NativeVisionImage[] }): Promise<NativeVisionResult>;
}

export const VaultVision = registerPlugin<VaultVisionPlugin>('VaultVision');
```

The adapter merges OCR text, normalizes barcode strings, converts object/category results to metadata/object signals, and combines brand OCR with logo classifier signals without increasing the native confidence.

- [ ] **Step 4: Implement Apple Vision analysis**

Decode each local file/data URL and perform `VNRecognizeTextRequest`, `VNDetectBarcodesRequest`, and `VNClassifyImageRequest` off the main thread. Return observation confidence and normalized bounding boxes. Load the bundled inventory Core ML classifier for category/logo signals; failure of that classifier must still return successful OCR/barcode results with a warning.

- [ ] **Step 5: Implement Android bundled ML analysis**

Use bundled dependencies, not Play Services downloads:

```gradle
implementation 'com.google.mlkit:text-recognition:16.0.1'
implementation 'com.google.mlkit:barcode-scanning:17.3.0'
implementation 'com.google.mlkit:image-labeling:17.0.9'
implementation 'com.google.mlkit:image-labeling-custom:17.0.3'
```

Load `vault_inventory_classifier.tflite` with `LocalModel.Builder().setAssetFilePath(...)`. Process images on a background executor and return partial results plus warnings if one engine fails.

- [ ] **Step 6: Wire native capture analysis into the existing evidence pipeline**

After selecting photos, native builds call `VaultVision.analyze`; browser builds preserve pasted-text parsing. The capture change stores source photo IDs, raw OCR, barcodes, object/logo signals, engine names, warnings, and parsed fields. Analyze remains enabled for photo-only captures.

- [ ] **Step 7: Run only affected vision/mobile checks**

Run:

```bash
npm run test --workspace @vault/vision
npm run test --workspace @vault/mobile -- src/native/vision.test.ts src/App.test.tsx
npm run build --workspace @vault/mobile
npm run mobile:sync --workspace @vault/mobile
```

Expected: all four commands PASS. Do not run the desktop or full monorepo suites here.

If Android tooling exists, run `cd apps/mobile/android && ./gradlew assembleDebug` once after all native changes. iOS build and device inference remain the documented user handoff.

- [ ] **Step 8: Record device-test risks and commit**

The handoff checklist must cover camera permission denial, airplane-mode first launch, OCR/barcodes, at least five inventory categories, unsupported logos, low-confidence review behavior, multi-photo capture, app restart, and bundle export.

```bash
git add apps/mobile docs/mobile-device-testing.md
git commit -m "Add offline native mobile vision"
```

### Task 6: Final affected-path integration and PR handoff

**Files:**
- Modify: `docs/mobile-device-testing.md`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Adds one path-filtered mobile-native CI job.
- Does not rerun desktop Tauri E2E for mobile-only changes.

- [ ] **Step 1: Add path-filtered checks**

The mobile-native job runs only when `apps/mobile/**`, `packages/vision/**`, `packages/intelligence-sync/**`, or category migration/API paths change. It installs dependencies, runs affected mobile/sync tests, builds mobile, and runs Capacitor sync. Android assembly runs in this same job only if the checked-in Gradle project and SDK image support it.

- [ ] **Step 2: Run the final affected command batch once**

```bash
npm run test --workspace @vault/intelligence-sync
npm run test --workspace @vault/vision
npm run test --workspace @vault/mobile
npm run build --workspace @vault/mobile
npm run mobile:sync --workspace @vault/mobile
```

Expected: PASS. Run the targeted Rust category tests once if Cargo is available. Do not repeat unchanged checks.

- [ ] **Step 3: Review the handoff for exact device steps and flagged risks**

Confirm the document names the generated Android APK path, Xcode workspace/project path, signing step, required permissions, offline test procedure, and known logo-model coverage boundary.

- [ ] **Step 4: Commit and publish one PR update**

```bash
git add .github/workflows/ci.yml docs/mobile-device-testing.md
git commit -m "Gate native mobile installation paths"
```

Publish the branch once after the local affected checks pass. Let the single path-filtered CI run complete; mark any hardware-only uncertainty for device review rather than retriggering the full matrix.
