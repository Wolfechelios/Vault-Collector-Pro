# WolfeVault Mobile PWA Design

## Decision

WolfeVault Mobile will ship only as an installable Progressive Web Application hosted on GitHub Pages. Capacitor and the generated Android and iOS applications will be removed. The desktop application and its SQLite intelligence services remain unchanged.

## Application architecture

`apps/mobile` remains the mobile client and becomes the sole PWA entry point. It will include a web app manifest, install icons, an offline application shell, service-worker registration, update handling, and GitHub Pages base-path support.

IndexedDB remains the local persistence layer for imported inventory snapshots, evidence, suggestions, learning rules, category schemas, saved searches, and queued changes. The existing snapshot import and change export flow remains deterministic and offline-capable.

Camera capture will use browser camera/file inputs so the same path works on current iOS Safari and Android Chrome. Manual capture and editing remain available when recognition capabilities are unavailable.

## Browser intelligence

Recognition runs locally in a web worker to keep the interface responsive. Versioned browser-compatible OCR and lightweight object-recognition assets will be cached after their first successful download. Barcode recognition will prefer the browser `BarcodeDetector` API when available and use a bundled browser fallback otherwise.

Recognition results continue through the existing evidence and inventory-intelligence pipeline. Every suggestion keeps its confidence, evidence source, raw text, and verification state. User-entered values remain protected from silent replacement. Low-confidence and conflicting results remain in review.

Logo recognition will conservatively combine OCR brand extraction and object labels. It will not claim broad commercial logo coverage. Uncertain brand signals remain visibly flagged.

The interface will expose model readiness, download failures, offline state, and recognition fallbacks. Capture and manual editing must continue when a model cannot load.

## Offline and updates

The service worker will precache the application shell and runtime-cache versioned recognition assets. After one complete online load, inventory, search, rules, schemas, capture, and cached recognition remain usable offline.

New application versions download in the background. An update activates only after the user accepts a reload, preventing unsaved work from being interrupted.

## Deployment

A GitHub Actions workflow will build and deploy `apps/mobile` to GitHub Pages under the repository base path. It will run the affected mobile tests and one production build before publishing. Feature branches will not create duplicate deployments.

## Removal scope

The migration removes Capacitor dependencies, native runtime adapters, native vision bridges, Capacitor scripts and configuration, and generated `apps/mobile/android` and `apps/mobile/ios` projects. Native build checks leave the release gate because no native mobile application remains.

## Verification

Focused tests will cover manifest and service-worker registration, GitHub Pages paths, update behavior, worker result mapping, barcode fallback, capture fallback, and IndexedDB persistence. Verification will run the affected mobile tests and one production PWA build. Offline behavior and installability will be checked against the built artifact without repeating unrelated desktop or Rust suites.

## Acceptance criteria

- WolfeVault installs from GitHub Pages on supported iOS and Android browsers.
- The installed application launches and retains inventory data offline after an initial complete load.
- Capture, manual editing, deterministic search, learning rules, category schemas, and queued changes work offline.
- Cached browser recognition runs without sending inventory images to a server.
- Recognition failures are visible and never block manual capture.
- No Capacitor, Android, or iOS build is required to release the mobile application.
