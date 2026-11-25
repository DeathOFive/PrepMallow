/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { Intake } from "./catalog";

export const MAX_FILE_BYTES = 80_000_000;
export const MAX_TOTAL_BYTES = 160_000_000;
export const MAX_FILES = 40;
export const MAX_EDGE = 6000;
export const MAX_PIXELS = 24_000_000;

export const imageAccept = "image/jpeg,image/png,image/webp,image/avif,image/bmp,image/gif,image/heic,image/heif,.heic,.heif,.bmp";
export const pdfAccept = "application/pdf,.pdf";
const zipAccept = "application/zip,application/x-zip-compressed,.zip";
export const pickerAccept: Record<Intake, string | undefined> = {
  image: imageAccept,
  pdf: pdfAccept,
  zip: zipAccept,
  visual: imageAccept + "," + pdfAccept,
  any: undefined,
};

export type Kind = "image" | "pdf" | "zip" | "other";
export type Entry = { id: string; file: File; kind: Kind };
export type Output = {
  name: string;
  blob?: Blob;
  detail?: string;
  originalBytes?: number;
  warning?: string;
  facts?: [string, string][];
  verdict?: "pass" | "review";
  originalName?: string;
  textPreview?: boolean;
  archivePath?: string;
};

export function kindOf(file: File): Kind {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  if (/^image\/(jpeg|png|webp|avif|bmp|gif|hei[cf])(?:-sequence)?$/i.test(file.type)
      || /\.(jpe?g|png|webp|avif|bmp|gif|hei[cf])$/i.test(file.name)) return "image";
  if (/\.zip$/i.test(file.name) || ["application/zip", "application/x-zip-compressed"].includes(file.type)) return "zip";
  return "other";
}

export function accepts(intake: Intake, kind: Kind) {
  return intake === "any" || intake === kind || (intake === "visual" && (kind === "image" || kind === "pdf"));
}

export function allowsEmpty(slug: string) {
  return slug === "check-file" || slug === "rename-files" || slug === "create-zip";
}

export function fileSize(bytes: number) {
  if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(2) + " MB";
  if (bytes >= 1000) return (bytes / 1000).toFixed(1) + " KB";
  return bytes + " B";
}

export function nameParts(name: string) {
  const index = name.lastIndexOf(".");
  return index > 0 && name.length - index <= 13 ? [name.slice(0, index), name.slice(index)] : [name, ""];
}

export function safeName(value: string, fallback = "file") {
  const cleaned = value.replace(/[/\\:*?"<>|\x00-\x1f\x7f]/g, "_").trim().replace(/^[.]+|[. ]+$/g, "").slice(0, 140);
  if (!cleaned) return fallback;
  return /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(cleaned) ? "_" + cleaned : cleaned;
}

export function uniqueNames(names: string[]) {
  const used = new Set<string>();
  return names.map((raw) => {
    const [stem, suffix] = nameParts(raw);
    const base = safeName(stem);
    const extension = suffix ? "." + safeName(suffix.slice(1), "file") : "";
    let name = base + extension;
    for (let count = 2; used.has(name.toLowerCase()); count++) {
      name = base + "-" + count + extension;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

export function stemOf(file: File) {
  return safeName(nameParts(file.name)[0]);
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

export function pageSelection(input: string, count: number): number[] {
  const normalized = input.trim().replace(/[–—]/g, "-");
  if (!normalized || /^all$/i.test(normalized)) return Array.from({ length: count }, (_, i) => i);
  const selected = new Set<number>();
  for (const range of normalized.split(",")) {
    const match = range.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Enter pages like 1, 3–5, 8.");
    const first = Number(match[1]);
    const last = Number(match[2] || first);
    if (first < 1 || last > count || first > last) throw new Error("Choose pages between 1 and " + count + " in ascending ranges.");
    for (let page = first; page <= last; page++) selected.add(page - 1);
  }
  return [...selected];
}

export function integer(value: string, label: string, min: number, max: number) {
  const number = Number(value);
  if (!value.trim() || !Number.isInteger(number) || number < min || number > max) {
    throw new Error(label + " must be a whole number between " + min + " and " + max + ".");
  }
  return number;
}

export function localGet(key: string): string | null {
  try { return localStorage.getItem("prepmallow:" + key); } catch { return null; }
}

export function localSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem("prepmallow:" + key);
    else localStorage.setItem("prepmallow:" + key, value);
  } catch { /* local storage can be unavailable */ }
}

let transfer: { slug: string; files: File[] } | undefined;
export function handoffFiles(slug: string, files: File[]) {
  transfer = { slug, files };
}
export function receiveFiles(slug: string) {
  if (transfer?.slug !== slug) return [];
  const files = transfer.files;
  transfer = undefined;
  return files;
}
