# WolfeVault Mobile PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native Capacitor mobile clients with one installable, offline-first WolfeVault PWA deployed through GitHub Pages.

**Architecture:** Vite builds the React mobile client beneath the repository Pages base path and `vite-plugin-pwa` generates the manifest and service worker. IndexedDB remains the system of record; a dedicated web-recognition boundary runs OCR, barcode, and object work outside React and returns existing evidence-compatible signals.

**Tech Stack:** React 19, Vite 6, TypeScript, Vitest, IndexedDB, Workbox/Vite PWA, Tesseract.js, ZXing Browser, Transformers.js, GitHub Actions/Pages.

## Global Constraints

- Mobile delivery is PWA-only; remove Capacitor, Android, and iOS application code.
- Host at `https://wolfechelios.github.io/Vault-Collector-Pro/` with base path `/Vault-Collector-Pro/`.
- Inventory images and recognition remain on device; do not add a recognition API.
- Recognition assets must be versioned and cached after their first successful load.
- Capture and manual editing must work when any recognition engine is unavailable.
- User-entered values remain protected; low-confidence and conflicting suggestions remain in review.
- Run only affected mobile tests and one final production build.

---

### Task 1: Remove native packaging and establish the PWA shell

**Files:**
- Delete: `apps/mobile/android/`
- Delete: `apps/mobile/ios/`
- Delete: `apps/mobile/capacitor.config.ts`
- Delete: `apps/mobile/src/native/runtime.ts`
- Delete: `apps/mobile/src/native/runtime.test.ts`
- Delete: `apps/mobile/src/native/vision.ts`
- Delete: `apps/mobile/src/native/vision.test.ts`
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/vite.config.ts`
- Modify: `apps/mobile/index.html`
- Create: `apps/mobile/src/pwa/pwaConfig.test.ts`

**Interfaces:**
- Produces: PWA build configuration with `base === '/Vault-Collector-Pro/'`, manifest start URL, service-worker registration, and runtime caching rules.

- [ ] **Step 1: Write the failing configuration test**

```ts
import {describe, expect, it} from 'vitest';
import config from '../../vite.config';

describe('mobile PWA configuration', () => {
  it('uses the GitHub Pages base path and PWA plugin', () => {
    expect(config.base).toBe('/Vault-Collector-Pro/');
    expect(config.plugins).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm run test --workspace @vault/mobile -- --run src/pwa/pwaConfig.test.ts`

Expected: FAIL because the current Vite configuration has no Pages base or PWA plugin.

- [ ] **Step 3: Replace native dependencies and scripts**

Remove all `@capacitor/*` dependencies and `mobile:*` scripts. Add `vite-plugin-pwa`, `tesseract.js`, `@tesseract.js-data/eng`, `@zxing/browser`, and `@huggingface/transformers`. Add scripts:

```json
{
  "build:pwa": "vite build",
  "preview:pwa": "vite preview --host 0.0.0.0 --port 4173"
}
```

- [ ] **Step 4: Configure Vite PWA and Workbox**

Set `base: '/Vault-Collector-Pro/'`, `registerType: 'prompt'`, manifest identity `WolfeVault`, `display: 'standalone'`, `theme_color: '#12100f'`, and icons at `pwa-192x192.png`, `pwa-512x512.png`, and `maskable-512x512.png`. Precache the application shell and runtime-cache versioned model assets with CacheFirst and a 30-day maximum age.

- [ ] **Step 5: Remove native source trees and update HTML metadata**

Delete the native files listed above. Add `theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, and `apple-touch-icon` metadata to `index.html`.

- [ ] **Step 6: Run the focused test**

Run: `npm run test --workspace @vault/mobile -- --run src/pwa/pwaConfig.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile package.json package-lock.json
git commit -m "Convert mobile shell to PWA"
```

### Task 2: Add install, offline, and update lifecycle UI

**Files:**
- Create: `apps/mobile/src/pwa/usePwaLifecycle.ts`
- Create: `apps/mobile/src/pwa/usePwaLifecycle.test.ts`
- Create: `apps/mobile/src/pwa/PwaStatus.tsx`
- Create: `apps/mobile/src/pwa/PwaStatus.test.tsx`
- Modify: `apps/mobile/src/App.tsx`
- Modify: `apps/mobile/src/styles.css`

**Interfaces:**
- Produces: `usePwaLifecycle(): { offline: boolean; updateReady: boolean; applyUpdate(): Promise<void> }`.

- [ ] **Step 1: Write failing lifecycle tests**

Test that an `offline` event sets `offline: true`, an `online` event clears it, and `onNeedRefresh` sets `updateReady: true` without reloading immediately.

- [ ] **Step 2: Verify failure**

Run: `npm run test --workspace @vault/mobile -- --run src/pwa/usePwaLifecycle.test.ts src/pwa/PwaStatus.test.tsx`

Expected: FAIL because lifecycle components do not exist.

- [ ] **Step 3: Implement lifecycle state**

Use `virtual:pwa-register/react` with `immediate: true`. Expose `applyUpdate()` as `updateServiceWorker(true)` and add/remove browser online/offline listeners in an effect.

- [ ] **Step 4: Render non-blocking status**

Render an offline badge when disconnected and an “Update ready / Reload” banner only when `updateReady` is true. Mount it once beneath the app header.

- [ ] **Step 5: Run the focused tests and commit**

Run: `npm run test --workspace @vault/mobile -- --run src/pwa/usePwaLifecycle.test.ts src/pwa/PwaStatus.test.tsx src/App.test.tsx`

Expected: PASS.

```bash
git add apps/mobile/src/pwa apps/mobile/src/App.tsx apps/mobile/src/styles.css
git commit -m "Add PWA offline and update lifecycle"
```

### Task 3: Implement the web recognition boundary

**Files:**
- Create: `apps/mobile/src/recognition/types.ts`
- Create: `apps/mobile/src/recognition/webRecognition.ts`
- Create: `apps/mobile/src/recognition/webRecognition.test.ts`
- Create: `apps/mobile/src/recognition/recognition.worker.ts`
- Create: `apps/mobile/src/recognition/workerClient.ts`
- Create: `apps/mobile/src/recognition/workerClient.test.ts`

**Interfaces:**
- Produces: `recognizePhotos(images: string[]): Promise<WebRecognitionResult>`.
- Produces: `WebRecognitionResult = { rawText: string; signals: VisionSignal[]; warnings: string[]; readiness: RecognitionReadiness }`.

- [ ] **Step 1: Write failing mapping and fallback tests**

Cover OCR text mapping, barcode identifier mapping, object-to-category mapping, conservative known-brand aliases at confidence `0.68`, and warnings returned when one engine rejects while other results survive.

- [ ] **Step 2: Verify failure**

Run: `npm run test --workspace @vault/mobile -- --run src/recognition/webRecognition.test.ts src/recognition/workerClient.test.ts`

Expected: FAIL because the recognition boundary does not exist.

- [ ] **Step 3: Define serializable worker messages**

Use requests `{ id: string; type: 'recognize'; images: string[] }` and responses `{ id: string; result?: WebRecognitionResult; error?: string }`. Reject only when the worker itself cannot start; engine-level failures become warnings.

- [ ] **Step 4: Implement OCR, barcode, and object adapters**

Use one lazily initialized Tesseract English worker, native `BarcodeDetector` when present with ZXing fallback, and Transformers.js `image-classification` with `Xenova/mobilenet_v2_1.0_224`. Normalize all outputs into `@vault/vision` signals and terminate no shared worker between captures.

- [ ] **Step 5: Implement the worker client**

Create the module worker with `new Worker(new URL('./recognition.worker.ts', import.meta.url), {type: 'module'})`, correlate requests by ID, and preserve partial results.

- [ ] **Step 6: Run focused tests and commit**

Run: `npm run test --workspace @vault/mobile -- --run src/recognition/webRecognition.test.ts src/recognition/workerClient.test.ts`

Expected: PASS.

```bash
git add apps/mobile/src/recognition
git commit -m "Add offline browser recognition worker"
```

### Task 4: Connect PWA recognition to capture without blocking manual entry

**Files:**
- Modify: `apps/mobile/src/features/capture/MobileCapture.tsx`
- Create: `apps/mobile/src/features/capture/MobileCapture.test.tsx`
- Modify: `apps/mobile/src/styles.css`

**Interfaces:**
- Consumes: `recognizePhotos(images: string[]): Promise<WebRecognitionResult>`.
- Preserves: capture export with category-specific `specifics` and evidence-compatible intelligence suggestions.

- [ ] **Step 1: Write failing capture tests**

Test browser camera input uses `accept="image/*"` and `capture="environment"`; recognition results populate reviewable fields; engine rejection displays a warning; and “Save capture offline” remains enabled after rejection.

- [ ] **Step 2: Verify failure**

Run: `npm run test --workspace @vault/mobile -- --run src/features/capture/MobileCapture.test.tsx`

Expected: FAIL against the native-runtime branch.

- [ ] **Step 3: Replace native branching**

Remove imports from `src/native`. Always call the web worker when photos exist, retain pasted-text parsing as a manual fallback, display readiness/warnings, and keep the explicit offline-save step.

- [ ] **Step 4: Run capture and integration tests**

Run: `npm run test --workspace @vault/mobile -- --run src/features/capture/MobileCapture.test.tsx src/App.test.tsx src/data/mobileIntelligenceDb.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/capture apps/mobile/src/styles.css
git commit -m "Use browser intelligence for PWA capture"
```

### Task 5: Add GitHub Pages deployment and remove native release checks

**Files:**
- Create: `.github/workflows/mobile-pages.yml`
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/mobile-device-testing.md`

**Interfaces:**
- Produces: Pages artifact from `apps/mobile/dist` at `/Vault-Collector-Pro/`.

- [ ] **Step 1: Add the Pages workflow**

Trigger on pushes to `main` affecting `apps/mobile/**`, shared packages used by mobile, root lockfiles, or the workflow itself. Grant `contents: read`, `pages: write`, and `id-token: write`; use one concurrency group with cancellation.

- [ ] **Step 2: Add exact workflow commands**

Install once with `npm ci --no-audit --no-fund`, run the affected mobile test suite once, run `npm run build:pwa --workspace @vault/mobile` once, configure Pages, upload `apps/mobile/dist`, and deploy with the official Pages actions.

- [ ] **Step 3: Remove native mobile checks and rewrite testing docs**

Delete Android/iOS assembly references from CI and replace the device guide with Safari/Chrome installation, first-load model caching, airplane-mode verification, and update acceptance steps.

- [ ] **Step 4: Validate workflow syntax and commit**

Run: `git diff --check`

Expected: no errors.

```bash
git add .github/workflows docs/mobile-device-testing.md
git commit -m "Deploy WolfeVault PWA to GitHub Pages"
```

### Task 6: Final affected-only verification

**Files:**
- Modify only files required by concrete failures.

**Interfaces:**
- Produces: installable Pages-ready PWA artifact.

- [ ] **Step 1: Run the affected mobile suite once**

Run: `npm run test --workspace @vault/mobile`

Expected: all mobile tests pass.

- [ ] **Step 2: Run one production build**

Run: `npm run build:pwa --workspace @vault/mobile`

Expected: Vite completes and emits `manifest.webmanifest`, service-worker files, and Pages-relative application assets in `apps/mobile/dist`.

- [ ] **Step 3: Inspect the artifact without rebuilding**

Run: `test -f apps/mobile/dist/manifest.webmanifest && rg -n '/Vault-Collector-Pro/' apps/mobile/dist/index.html apps/mobile/dist/manifest.webmanifest && git diff --check`

Expected: manifest exists, built URLs use the repository base path, and no whitespace errors exist.

- [ ] **Step 4: Commit any concrete verification fix**

If Step 1–3 required a code fix, commit only that fix. Do not rerun unrelated desktop, Rust, or native tests.
