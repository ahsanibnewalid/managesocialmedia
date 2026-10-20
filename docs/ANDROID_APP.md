# Tidepost Android app

Tidepost Android is a native Kotlin + Jetpack Compose companion app for the existing Tidepost Console repository.

## Current state

This first increment establishes the Android project, a responsive dark dashboard shell, bottom navigation, a server URL format screen, and a GitHub Actions workflow that builds and uploads a **debug APK**. It also adds beginner-focused guidance and a local draft preview. Dashboard counts intentionally show placeholders: the app is not yet connected to the production API. Calendar and analytics explain what will appear after integration; the composer can preview a draft locally but cannot publish it yet.

## Beginner-first features added

- **Start here checklist:** explains the first setup steps without assuming technical knowledge.
- **Plain-language labels:** explains what scheduled, published, and attention-needed statuses mean.
- **Draft writing and preview:** write a caption, see its character count, and preview it without accidentally publishing.
- **Pre-publish checklist:** reminds users to check account selection, media requirements, timing, and time zone.
- **Honest empty states:** does not pretend missing server data is zero or fabricate analytics.
- **Safety tips:** warns users not to share passwords, one-time codes, or access tokens.
- **HTTPS address check:** catches common URL-format mistakes; this is a format check only, not a live connectivity test.
- **Clear limitations:** pages explain which functions are waiting for server integration.

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

You can also open **Actions → Android APK** in GitHub and download the `tidepost-android-debug-apk` artifact after a successful run. Debug APKs are for testing, not Play Store release.

## Install on an Android phone

Download the APK to the phone, open it, and allow installation from that source if Android asks. Only install APKs built from a repository/version you trust.

## Security decisions

- Cleartext HTTP traffic is disabled. Use HTTPS for deployed environments.
- No social-platform client secret, database credential, JWT signing secret, or token-encryption key belongs in the mobile app.
- The app must authenticate against the existing server and enforce workspace authorization server-side.
- Use Android Keystore-backed storage for any future persisted session credential; do not store passwords in preferences or logs.
- Do not treat client-side validation as server authorization.

## Next integration steps

1. Verify actual login/session and workspace API routes in the web app.
2. Add a typed HTTPS API client and safe session lifecycle.
3. Implement login/logout and workspace selection against existing auth.
4. Load actual connected-account, calendar, post, and analytics data.
5. Add post creation/scheduling only after matching server-side validation and permissions.
6. Add tests, API error handling, accessibility checks, and signed release build configuration.
7. Validate OAuth callback behavior and provider permissions using authorized test accounts.

The production-readiness caveats in the main README still apply. This Android scaffold does not change the web app's release status.
