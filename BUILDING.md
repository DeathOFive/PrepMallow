# Build PrepMallow for Android

The repository contains the complete Android application and its bundled offline
web-tool source. No WordPress installation or running website is needed.

## Toolchain

- OpenJDK 17 or 21
- Android SDK Platform 36 and Build Tools 36.0.0
- Node.js 22.13 or newer, with npm
- Gradle 8.13 (the checked-in wrapper downloads a distribution with a pinned SHA-256)

Set `ANDROID_HOME` to your Android SDK directory, or create an untracked
`local.properties` containing `sdk.dir=/absolute/path/to/android-sdk`.

## Build from a clean checkout

```sh
cd web
npm ci --no-audit --no-fund
cd ..
./gradlew --no-daemon assembleRelease lintRelease
```

The unsigned release APK is written to
`app/build/outputs/apk/release/app-release-unsigned.apk`.

Gradle invokes `web/build.mjs` before compiling the Android app. That script
bundles the TypeScript, React components, CSS, fonts, JavaScript dependencies,
PDF resources, and third-party notices into the APK. It does not download code
at runtime. No API keys or signing passwords are required for this build.

For a separately installable development build, use `./gradlew assembleDebug`.
Its application ID has the additional `.preview` suffix.

## Verify the offline workspace separately

```sh
cd web
npm ci --no-audit --no-fund
npm run build
```

Generated files appear in `web/dist/`. The Android bridge is available in the
Android app; native picker, save, share, and clipboard integration require the
app. Ordinary file-processing code is in `web/src/lib/`.

## Signing and versioning

The stable application ID is `com.saaimsohail.prepmallow.mobile`.
The published v1.0.1 source declares version name `1.0.1` and version code `2`.
The older `v1.0.1` tag predates source publication and contains documentation
only; use the current source commit rather than that old tag to build.

Release signing is deliberately external to the build. Private keystores,
passwords, local SDK configuration, dependency directories, and generated APKs
are excluded from Git. Distributors can sign their own build.

An APK signed with a different key cannot replace an installed GitHub APK
directly. Back up any results you need before changing distribution channels.

## Dependency sources

`web/package-lock.json` pins package versions, download URLs, and integrity
digests. `THIRD_PARTY.md` identifies the dependency licenses and source
repositories, including the HEIC decoder and PDF codec sources. Source-level
F-Droid verification of those codec builds is tracked in `FDROID.md`.
