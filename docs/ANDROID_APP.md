# Tidepost Android app

Tidepost Android is a native Kotlin + Jetpack Compose companion app for the existing Tidepost Console repository.

## Current state

The Android app includes a beginner-friendly dashboard, bottom navigation, a server URL settings screen, and a GitHub Actions workflow that builds and uploads a **debug APK**.

### Home-to-work / work-to-home helpers

- **Keep a caption draft on the phone:** draft text is stored in the app's private local preferences and remains available after closing/reopening the app.
- **Copy a caption:** copy the current text to the Android clipboard so it can be pasted into the web composer on a computer.
- **Share a caption:** use Android's share sheet to send text to another app. This action does not publish to a social platform.
- **Remember the web console URL:** save an HTTPS URL locally and open it in the phone browser to sign in through the existing web experience.
- **Clear status language:** the app distinguishes local-only draft storage from real server sync and does not invent workspace metrics.

**Important limitation:** drafts do not sync between devices yet. If you create a draft on the phone, it will not automatically appear in the browser at home/work. Cross-device sync needs a real authenticated draft API and workspace authorization on the server. Calendar, live workspace metrics, scheduling, and publishing are also not connected yet.

## Build the APK

Requirements: JDK 17 and Gradle 8.9 or a compatible Gradle 8.x release.

From the repository root:

```bash
cd android-app
gradle assembleDebug
```

APK output:

```
android-app/app/build/outputs/apk/debug/app-debug.apk
```

You can also open **Actions → Android APK** in GitHub and download the `tidepost-android-debug-apk` artifact after a successful run. GitHub downloads artifacts as ZIP files; extract the ZIP to find the `.apk`. Debug APKs are for testing, not Play Store release.

## Install on an Android phone

Download the APK to the phone, open it, and allow installation from that source if Android asks. Only install APKs built from a repository/version you trust.

## Security and privacy decisions

- Cleartext HTTP traffic is disabled. Use HTTPS for deployed environments.
- The server URL and draft caption are stored in the app's private preferences on this device; they are not cloud-synced or presented as encrypted cloud storage.
- Do not put social-platform client secrets, database credentials, JWT signing secrets, or token-encryption keys in the mobile app.
- The app must authenticate against the existing server and enforce workspace authorization server-side.
- Use Android Keystore-backed storage for any future persisted session credential; do not store passwords in preferences or logs.
- Do not treat client-side validation as server authorization.
- Never enter social account passwords or provider access tokens into the server URL setting.

## Next integration steps

1. Verify actual login/session and workspace API routes in the web app.
2. Add a typed HTTPS API client and safe session lifecycle.
3. Implement login/logout and workspace selection against existing auth.
4. Implement authenticated, workspace-scoped draft sync so a phone draft can be resumed on the web and vice versa.
5. Load actual connected-account, calendar, post, and analytics data.
6. Add post creation/scheduling only after matching server-side validation and permissions.
7. Add tests, API error handling, accessibility checks, and signed release build configuration.
8. Validate OAuth callback behavior and provider permissions using authorized test accounts.

The production-readiness caveats in the main README still apply. These mobile convenience features do not change the web app's release status.
