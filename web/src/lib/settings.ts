/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
export type PageEdit = { index: number; rotation: number; keep: boolean; thumb?: string };
export type ImageType = "image/jpeg" | "image/png" | "image/webp";

export const defaultSettings = {
  target: "200", keepPixels: false, compressWidth: "", compressHeight: "", compressFit: "pad",
  width: "1080", height: "1080", fit: "contain", format: "image/jpeg", quality: "88",
  pageSize: "a4", orientation: "auto", margin: "24",
  filename: "", range: "", dpi: "120", scanDetail: "balanced", grayscale: false,
  watermark: "", placement: "diagonal", opacity: "28", shade: "dark",
  renameMode: "sequence", nameBase: "document", start: "1", digits: "2", find: "", replace: "",
  maxKB: "", expected: "any", checkWidth: "", checkHeight: "",
  background: "#ffffff",
  fillTransparency: false,
  noUpscale: false,
  aspect: "free",
  zoom: "100",
  cropX: "50",
  cropY: "50",
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
  photoLayout: "one",
  photoFit: "contain",
  photoQuality: "balanced",
  mergeRanges: {} as Record<string, string>,
  startOnOddPage: false,
  splitMode: "pages",
  splitSize: "2",
  textMode: "combined",
  textHeadings: true,
  targetPdfKB: "",
  markSize: "8.5",
  markColor: "#3a2675",
  renameCase: "keep",
  ignoreCase: false,
  hyphenate: false,
  zipLevel: "3",
  zipFolder: "",
  minKB: "",
  maxPages: "",
  checksum: false,
};

export type Settings = typeof defaultSettings;
export const reusableSettings: Record<string, (keyof Settings)[]> = {
  "compress-image": ["target", "keepPixels", "format", "compressWidth", "compressHeight", "compressFit", "background", "fillTransparency"],
  "resize-image": ["width", "height", "fit", "format", "quality", "background", "fillTransparency", "noUpscale"],
  "convert-image": ["format", "quality", "background", "fillTransparency"],
  "images-to-pdf": ["pageSize", "orientation", "margin", "photoLayout", "photoFit", "photoQuality"],
  "pdf-to-images": ["dpi", "format", "quality"],
  "compress-pdf": ["scanDetail", "grayscale"],
  "remove-image-metadata": ["format", "quality"],
  "check-file": ["maxKB", "expected", "checkWidth", "checkHeight", "minKB", "maxPages", "checksum"],
};
