/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { Intake } from "./lib/catalog";
import { MAX_FILE_BYTES, MAX_TOTAL_BYTES } from "./lib/file-utils";

type Imported = { id: string; name: string; mime: string; relativePath?: string };
type ImportNotice = { source: "picker" | "share"; files: Imported[]; warnings: string[] };
export type Selection = { files: File[]; warnings: string[] };
export type ExportAction = "save" | "share";

type Bridge = {
  ready(): void;
  pick(kind: Intake, multiple: boolean, folder: boolean): void;
  beginExport(action: ExportAction, name: string, mime: string, size: number): string;
  appendExport(id: string, base64: string): boolean;
  finishExport(id: string): boolean;
  cancelExport(id: string): void;
  copy(text: string): boolean;
};

declare global {
  interface Window {
    PrepMallowAndroid?: Bridge;
    prepmallowHandleBack?: () => boolean;
  }
}

export const android = window.PrepMallowAndroid;
let pickerResult: ((notice: ImportNotice) => void) | undefined;

function onImportNotice(handler: (detail: ImportNotice) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<ImportNotice>).detail);
  window.addEventListener("prepmallow-import", listener);
  return () => window.removeEventListener("prepmallow-import", listener);
}

onImportNotice(notice => {
  if (notice.source !== "picker") return;
  const resolve = pickerResult;
  pickerResult = undefined;
  resolve?.(notice);
});

async function readSelection(notice: ImportNotice): Promise<Selection> {
  const files: File[] = [];
  const warnings = notice.warnings.slice();
  let total = 0;
  for (const source of notice.files) {
    try {
      const response = await fetch("../import/" + encodeURIComponent(source.id), { cache: "no-store" });
      if (!response.ok || !response.body) throw new Error("This file could not be opened.");
      const reader = response.body.getReader();
      const parts: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_FILE_BYTES || total + size > MAX_TOTAL_BYTES) {
            await reader.cancel();
            throw new Error("The selection exceeds the file size limit.");
          }
          parts.push(value);
        }
      } finally { reader.releaseLock(); }
      const file = new File(parts, source.name, { type: source.mime });
      if (source.relativePath) Object.defineProperty(file, "webkitRelativePath", { value: source.relativePath });
      total += size;
      files.push(file);
    } catch (error) {
      warnings.push(source.name + " · " + (error instanceof Error ? error.message : "Could not read the file."));
    }
  }
  return { files, warnings };
}

export async function chooseFiles(kind: Intake, multiple: boolean, folder = false) {
  if (!android) return { files: [], warnings: ["Open PrepMallow on Android to choose files from your device."] };
  if (pickerResult) return { files: [], warnings: ["Finish the current file selection first."] };
  const notice = await new Promise<ImportNotice>(resolve => {
    pickerResult = resolve;
    android.pick(kind, multiple, folder);
  });
  return readSelection(notice);
}

export function watchSharedFiles(handler: (selection: Selection) => void) {
  return onImportNotice(notice => {
    if (notice.source === "share") void readSelection(notice).then(handler);
  });
}

const transferSize = 256 * 1024;

function chunkToBase64(bytes: Uint8Array) {
  let raw = "";
  for (let start = 0; start < bytes.length; start += 8192) {
    raw += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return btoa(raw);
}

export async function exportBlob(blob: Blob, name: string, action: ExportAction) {
  if (!android) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }
  const id = android.beginExport(action, name, blob.type || "application/octet-stream", blob.size);
  if (!id) throw new Error("Could not start the export. Check available storage or try a smaller file.");
  try {
    for (let offset = 0; offset < blob.size; offset += transferSize) {
      const bytes = new Uint8Array(await blob.slice(offset, offset + transferSize).arrayBuffer());
      if (!android.appendExport(id, chunkToBase64(bytes))) throw new Error("Could not prepare the file.");
    }
    if (!android.finishExport(id)) throw new Error("Could not open the export. Try again.");
  } catch (error) {
    android.cancelExport(id);
    throw error;
  }
}

export async function copyToClipboard(text: string) {
  if (android) {
    if (!android.copy(text)) throw new Error("Text is too large for the clipboard.");
    return;
  }
  await navigator.clipboard.writeText(text);
}
