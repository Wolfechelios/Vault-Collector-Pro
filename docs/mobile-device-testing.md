# WolfeVault Mobile Device Testing

## Android

1. From the repository root run `npm run mobile:android --workspace @vault/mobile`.
2. Let Android Studio finish its first Gradle sync.
3. Select a physical Android 7.0+ device with USB debugging enabled.
4. Choose the `app` run configuration and press Run.
5. A command-line debug build, when the Android SDK is installed, is `cd apps/mobile/android && ./gradlew assembleDebug`.
6. The resulting APK is `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

## iOS

1. On macOS run `npm run mobile:ios --workspace @vault/mobile`.
2. In Xcode select the `App` project and `App` target.
3. Under Signing & Capabilities select your Apple development team and keep bundle identifier `com.wolfe.vaultcollector` unless your account requires a unique suffix.
4. Select a physical iPhone or iPad and press Run.
5. Accept camera and selected-photo permissions when prompted.

## Offline acceptance checklist

- Enable airplane mode before first analysis.
- Capture and select photos using both the camera and photo library.
- Confirm OCR returns visible label text and model/serial candidates.
- Confirm UPC/EAN/QR barcode values appear as barcode evidence.
- Test tools, cards, coins, electronics, and clothing or shoes.
- Confirm object/category candidates show confidence and can be reviewed.
- Test a known printed brand and confirm uncertain logo/brand signals remain flagged rather than silently replacing a manual value.
- Test an unsupported logo and confirm no confident brand is invented.
- Deny camera permission once and confirm the existing capture is not lost.
- Capture multiple photos, restart the app, and confirm offline state remains.
- Import a desktop snapshot and confirm category-specific fields match the desktop schema manager.
- Edit a field, export the mobile change bundle, and import it on desktop.

## Flagged device risks

- Broad commercial logo coverage is limited to locally recognized brand text and classifier signals until a separately licensed or trained logo dataset is supplied.
- iOS compilation and signing require Xcode and an Apple development team and were not executed in a non-macOS development environment.
- Camera quality, OCR latency, thermal behavior, and classifier accuracy must be measured on the physical devices you intend to support.
