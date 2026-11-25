# Third-party software and assets

Copyright (C) 2026 Saaim Sohail. PrepMallow's own Android and bundled web-tool
source is licensed under GPL-3.0-only. Original PrepMallow app icons and
listing screenshots are distributed under the same license. This does not
replace the licenses of the third-party works below.

| Component | Version | License | Upstream source |
| --- | --- | --- | --- |
| React and React DOM | 19.2.6 | MIT | https://github.com/facebook/react |
| Scheduler | 0.27.0 | MIT | https://github.com/facebook/react |
| Lucide React | 1.71.0 | ISC | https://github.com/lucide-icons/lucide |
| pdf-lib | 1.17.1 | MIT | https://github.com/Hopding/pdf-lib |
| @pdf-lib/standard-fonts | 1.0.0 | MIT | https://github.com/Hopding/standard-fonts |
| @pdf-lib/upng | 1.0.1 | MIT | https://github.com/Hopding/upng |
| pako | 1.0.11 | MIT and Zlib | https://github.com/nodeca/pako |
| tslib | 1.14.1 | 0BSD | https://github.com/microsoft/tslib |
| PDF.js (pdfjs-dist) | 6.5.438 | Apache-2.0, with codec notices | https://github.com/mozilla/pdf.js |
| heic-to | 1.6.7 | LGPL-3.0 | https://github.com/hoppergee/heic-to |
| libheif, used by heic-to | 1.23.7 | LGPL-3.0 | https://github.com/strukturag/libheif |
| libde265, used by the HEIC decoder | See heic-to build instructions | LGPL-3.0 | https://github.com/strukturag/libde265 |
| fflate | 0.8.3 | MIT | https://github.com/101arrowz/fflate |
| esbuild (build tool) | 0.27.5 | MIT | https://github.com/evanw/esbuild |
| DM Sans | Fontsource 5.3.0 | OFL-1.1 | https://github.com/googlefonts/dm-fonts |
| Manrope | Fontsource 5.3.0 | OFL-1.1 | https://github.com/sharanda/manrope |
| Fraunces | Fontsource 5.3.0 | OFL-1.1 | https://github.com/undercasetype/Fraunces |
| Gradle wrapper | 8.13 | Apache-2.0 | https://github.com/gradle/gradle/tree/v8.13.0 |

The bundled font license texts are in `LICENSES/`. Gradle's wrapper license is
also supplied there. `COPYING` and `COPYING.LESSER` contain the GPLv3 and LGPLv3
license texts for the HEIC dependency.

The application build copies dependency license texts into the APK's
`assets/workspace/licenses/` directory. PDF.js resource directories are copied
with their codec, CMap, color-profile, and standard-font notices intact.

PDF.js codec source and build instructions are maintained under
https://github.com/mozilla/pdf.js/tree/master/external, including `openjpeg`,
`qcms`, `jbig2`, and `quickjs`. Their exact bundled license notices are part of
the pinned `pdfjs-dist` package. The HEIC decoder's build instructions are in
https://github.com/hoppergee/heic-to#development-guide.

The source is provided to permit modification and rebuilding, including
replacement of LGPL components. F-Droid-specific verification of packaged
codecs is described in `FDROID.md`.
