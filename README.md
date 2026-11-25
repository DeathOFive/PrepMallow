# PrepMallow

PrepMallow is a free, open-source toolkit for getting photos, PDFs, and other
files ready for online forms, email, and sharing. The Android app runs all 17
tools offline and processes files on your device.

**[Download PrepMallow v1.0.1 for Android](https://github.com/DeathOFive/PrepMallow/releases/download/v1.0.1/PrepMallow-v1.0.1.apk)**
· [Release notes](https://github.com/DeathOFive/PrepMallow/releases/tag/v1.0.1)
· [Try the web tools](https://saaimsohail.com/prepmallow/)

## Install on Android

Requires **Android 10 or newer** and **Android System WebView 110 or newer**.

1. On your Android device, download `PrepMallow-v1.0.1.apk` from the **Assets**
   section of the [v1.0.1 release](https://github.com/DeathOFive/PrepMallow/releases/tag/v1.0.1).
2. Open the APK from **Downloads**. If prompted, open **Settings** and enable
   **Allow from this source** for the browser or Files app that opened it.
3. Return to the installer, tap **Install**, and open **PrepMallow**.
4. Pick a tool and select your files. Tap **Save** or **Share** when your result
   is ready.

The v1.0.0 preview and stable app use different application IDs, so they can
appear alongside one another. The stable application ID is
`com.saaimsohail.prepmallow.mobile`.

## What you can do

| Need | Included Android tools |
| --- | --- |
| Prepare photos | Compress to a target size; resize; convert HEIC, JPG, PNG, and WebP; crop, rotate, and flip; remove image metadata |
| Prepare PDFs | Turn images into a PDF; merge; organize, rotate, and extract pages; split; render pages as images; compress scans; extract selectable text |
| Prepare files to share | Add text watermarks; rename files in batches; create ZIPs; browse and extract ZIPs |
| Check a form's requirements | Check file size, format, and image dimensions |

For a form that asks for a JPG under 200 KB and exactly 600 × 600 pixels,
open **Compress images**, set the size and dimensions, and save the result.
Then use **Check file details** to verify the copy before uploading it.

Encrypted PDFs, password-protected ZIPs, ZIP64 archives, and OCR of image-only
scans are not supported. Compression results depend on the source file.

## File privacy

The Android app bundles its tools locally and does not request the Internet
permission. It uses Android's document picker, Save As dialog, share sheet,
and clipboard integration. It has no account requirement, advertising,
analytics, Google Play Services, or Firebase dependency.

The web tools process selected files in your browser.
[Read about file handling](https://saaimsohail.com/prepmallow/privacy/).

## Source and builds

This repository now includes the complete Android application and the bundled
offline web-tool source:

- `app/src/main/java/`: native Android file picker, import/export, share, and
  local WebView integration.
- `web/src/`: the 17 tools, React interface, processing code, and Android bridge.
- `web/package-lock.json`: pinned JavaScript dependencies and integrity hashes.
- `fastlane/metadata/android/`: app listing text, screenshots, and changelog.

See [BUILDING.md](BUILDING.md) for a command-line build and
[THIRD_PARTY.md](THIRD_PARTY.md) for dependency sources and licenses.

The historical `v1.0.1` tag predates source publication and contains
documentation only. Build from the current source commit. Private signing keys
are not included.

## F-Droid

The [packaging request #4865](https://gitlab.com/fdroid/rfp/-/work_items/4865) was submitted on 25 November 2026.
It is awaiting review; PrepMallow is not yet listed in the official F-Droid
repository. Packaging preparation and codec review notes are in
[FDROID.md](FDROID.md).

## License

Copyright (C) 2026 Saaim Sohail.

PrepMallow's own Android and bundled web-tool source is licensed under the
**GNU General Public License version 3 only (GPL-3.0-only)**. See [LICENSE](LICENSE).
You may use, study, modify, and redistribute it under that license. Third-party
libraries and fonts retain their respective licenses, listed in
[THIRD_PARTY.md](THIRD_PARTY.md).
