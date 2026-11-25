# F-Droid packaging

PrepMallow's author authorizes inclusion in F-Droid. The Android application and
the bundled PrepMallow web-tool code in this repository are GPL-3.0-only.
Third-party components retain the licenses listed in `THIRD_PARTY.md`.

Tracking request: [fdroid/rfp#4865](https://gitlab.com/fdroid/rfp/-/work_items/4865), submitted on
25 November 2026. The request is awaiting review, including the codec build
requirements below. This is not an approved F-Droid listing.

- Name: PrepMallow
- Application ID: `com.saaimsohail.prepmallow.mobile`
- Version name / code: `1.0.1` / `2`
- Minimum Android version: Android 10 (API 29)
- Android System WebView: 110 or newer
- Source: https://github.com/DeathOFive/PrepMallow
- Website: https://saaimsohail.com/prepmallow/
- Build instructions: `BUILDING.md`
- Listing metadata: `fastlane/metadata/android/en-US/`

## Runtime behavior

The app bundles all 17 tools locally and does not request the Android INTERNET
permission. It has native document and folder pickers, incoming Share support,
Save As integration, outgoing Share support, and clipboard integration. It is
not a WebView that fetches the website.

It contains no Firebase, Google Play Services, advertising SDK, analytics SDK,
account requirement, or automatic APK updater. It requests access to documents
through Android's system file picker rather than broad storage permissions.

## Packaging review notes

The initial source publication does not retarget the historical v1.0.1 tag.
That tag predates the source publication. Pin the source-publication commit for
the initial packaging review; subsequent release tags must contain source.

The normal build uses FOSS packages from npm, pinned by the lockfile. Two need
particular attention during F-Droid review:

- `heic-to` includes an asm.js build of libheif/libde265. Its README documents
  rebuilding the decoder; see the source links in `THIRD_PARTY.md`.
- `pdfjs-dist` includes prebuilt WebAssembly and JavaScript fallback codecs,
  together with their license files. The relevant sources are Mozilla PDF.js,
  OpenJPEG, qcms, JBIG2, and QuickJS. The app sets `isEvalSupported: false` and
  does not fetch additional executable code from the Internet.

These dependencies are free software, but their packaged codec binaries have
not yet been independently rebuilt in the F-Droid build environment. An
F-Droid recipe must account for their source provenance and any required
source builds. No broad scanner bypass or claim of verified reproducibility
is supplied here. A packaging request is not approval or an F-Droid listing.

The repository includes source and asset license notices, instructions for an
unsigned Android build, and upstream listing metadata to support this review. It does not
publish signing keys.
