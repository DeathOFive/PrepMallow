# F-Droid packaging request

Status: submitted on 25 November 2026 as [fdroid/rfp#4865](https://gitlab.com/fdroid/rfp/-/work_items/4865).
Awaiting review; HEIC/PDF codec source-build requirements remain open.

Issue title: Request for Packaging: PrepMallow

---

* [ ] Full inclusion-policy compliance requires packager review of the codec source builds documented below.
* [x] The app is not already listed in fdroiddata or its issue/merge-request tracker.
* [x] No existing PrepMallow packaging request was found.
* [x] The upstream repository includes Fastlane descriptions, icon, screenshots and changelog.
* [x] The original app author authorizes inclusion.
* [ ] Optional donation.

#### APPLICATION ID: com.saaimsohail.prepmallow.mobile

```yaml
Categories:
  - Graphics
  - System
License: GPL-3.0-only
AuthorName: Saaim Sohail
AuthorWebSite: https://saaimsohail.com/
WebSite: https://saaimsohail.com/prepmallow/
SourceCode: https://github.com/DeathOFive/PrepMallow
IssueTracker: https://github.com/DeathOFive/PrepMallow/issues
AutoName: PrepMallow
RepoType: git
Repo: https://github.com/DeathOFive/PrepMallow.git
```

PrepMallow provides 17 offline tools for preparing photos, PDFs and ZIPs for online forms, email and sharing. It can compress images to a target size, resize and convert photos, crop and rotate images, remove image metadata, create PDFs from photos, merge/split/reorganize PDFs, render PDF pages, compress scans, extract selectable text, add watermarks, rename files in batches, create/extract ZIPs and check file requirements.

The author authorizes F-Droid inclusion. The complete native Android source and bundled web-tool source have been published under GPLv3, with third-party license notices.

**Buildable source commit:** https://github.com/DeathOFive/PrepMallow/commit/7c7d07833c828d3746d0b5ecc79a6eb311300e49
**Build instructions:** https://github.com/DeathOFive/PrepMallow/blob/main/BUILDING.md
**Packaging notes:** https://github.com/DeathOFive/PrepMallow/blob/main/FDROID.md
**Dependency sources and licenses:** https://github.com/DeathOFive/PrepMallow/blob/main/THIRD_PARTY.md
**Fastlane metadata, icon, screenshots and changelog:** https://github.com/DeathOFive/PrepMallow/tree/main/fastlane/metadata/android/en-US

Version name/code: 1.0.1 / 2. Minimum Android: 10 (API 29). Target API: 36. Android System WebView 110 or newer is required.

The application is fully bundled and does not request the INTERNET permission. Native Android integration includes file and folder pickers, incoming Share support, Save As, outgoing Share and clipboard support. There are no advertising/analytics SDKs, Google Play Services, Firebase, account requirements or automatic APK updates.

**Validation:** The release APK was built successfully using OpenJDK 17, Gradle 8.13, Android SDK 36 and Build Tools 36.0.0. `assembleRelease` and `lintRelease` passed (zero lint errors; six warnings). The generated APK declares the expected application ID, version name/code and minimum/target API levels.

**Packaging review needed:** The FOSS npm dependencies are pinned by package-lock.json. The normal build currently uses heic-to's packaged asm.js HEIC decoder and pdfjs-dist's packaged WebAssembly/JavaScript codecs. Their source repositories and upstream build instructions are documented, but these codec binaries have not yet been independently rebuilt in F-Droid's environment. Assistance with their source-build requirements is requested. Reproducible builds have not been verified, and no scanner bypass is proposed.

The historical v1.0.1 tag contains documentation only and predates source publication. Please pin the source commit above for the initial review rather than that old tag.

The app was first released on GitHub on 11 November 2026 and is early in its public development. The existing APK release is available at https://github.com/DeathOFive/PrepMallow/releases/tag/v1.0.1. The F-Droid packaging-request tracker and fdroiddata issues and merge requests were checked for PrepMallow on 25 November 2026; no existing request was found.

**Why add this app:** It provides offline file preparation for document-upload forms and sharing, with native Android file picking, saving and sharing rather than sending documents to a remote service.

**Summary:** Prepare photos, PDFs and ZIPs offline for forms, email and sharing

