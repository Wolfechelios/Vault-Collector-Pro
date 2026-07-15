# WolfeVault Mobile PWA Testing

## Install from GitHub Pages

The production address is `https://wolfechelios.github.io/Vault-Collector-Pro/`.

### iPhone and iPad

1. Open the production address in Safari.
2. Tap Share, then **Add to Home Screen**.
3. Open WolfeVault from its new home-screen icon.
4. Allow camera or photo-library access when capture requests it.

### Android

1. Open the production address in Chrome.
2. Open the browser menu and choose **Install app** or **Add to Home screen**.
3. Open WolfeVault from the launcher.
4. Allow camera or file access when capture requests it.

## First-load preparation

Stay online for the first complete load. Open Capture and analyze one representative photo so the OCR and object-recognition assets can download and enter the offline cache. Do not switch to airplane mode until WolfeVault reports the analysis result or a specific model warning.

## Offline acceptance checklist

- Import a desktop snapshot and confirm items, learning rules, evidence, and category-specific fields appear.
- Analyze one representative photo while online to cache recognition assets.
- Close the installed PWA, enable airplane mode, and reopen it from the home screen.
- Confirm inventory, deterministic search, smart collections, rules, schemas, and review data remain available.
- Capture or select photos and confirm cached OCR and object/category recognition run locally.
- Confirm UPC, EAN, or QR values appear as barcode evidence on supported images.
- Confirm uncertain logo or brand signals remain flagged instead of replacing a manual value.
- Disable or deny camera access and confirm file selection, pasted text, manual fields, and offline saving still work.
- Save a capture, restart the PWA, and confirm the queued change remains available for export.
- Return online, deploy an update, and confirm WolfeVault asks before reloading into the new version.

## Known device risks

- Browser OCR and object-model download time varies with the first connection and device storage.
- Mobile Safari can evict site data under severe storage pressure; export pending changes before clearing Safari website data.
- Broad commercial logo coverage remains limited to recognized brand text and conservative classifier aliases.
- Camera quality, OCR latency, memory pressure, and thermal behavior must be measured on the devices you intend to support.
