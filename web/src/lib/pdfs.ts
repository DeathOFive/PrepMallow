/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { PDFDocument } from "pdf-lib";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { makeCanvas } from "./images";
import { safeName, stemOf, type Output } from "./file-utils";
import type { PageEdit, Settings } from "./settings";

export const MAX_ORGANIZE_PAGES = 100;

export async function loadPdf(file: File): Promise<PDFDocument> {
  const { PDFDocument } = await import("pdf-lib");
  try {
    return await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
  } catch {
    throw new Error("Could not open " + file.name + ". Choose a complete, password-free PDF.");
  }
}

export async function pdfPageCount(file: File) {
  return (await loadPdf(file)).getPageCount();
}

function outputPdfName(input: string, fallback: string) {
  return safeName(input.trim().replace(/\.pdf$/i, ""), fallback) + ".pdf";
}

export async function savePdf(pdf: PDFDocument) {
  return new Blob([Uint8Array.from(await pdf.save())], { type: "application/pdf" });
}

export async function organizePdf(file: File, pages: PageEdit[], settings: Settings): Promise<Output> {
  const kept = pages.filter((page) => page.keep);
  if (!kept.length) throw new Error("Keep at least one page to save a PDF.");
  const { PDFDocument, degrees } = await import("pdf-lib");
  const source = await loadPdf(file);
  const pdf = await PDFDocument.create();
  const copies = await pdf.copyPages(source, kept.map((page) => page.index));
  copies.forEach((page, i) => {
    page.setRotation(degrees(((page.getRotation().angle + kept[i].rotation) % 360 + 360) % 360));
    pdf.addPage(page);
  });
  return { name: outputPdfName(settings.filename, stemOf(file) + "-pages"), blob: await savePdf(pdf), detail: kept.length + " pages" };
}

export async function withPdf<T>(file: File, signal: AbortSignal, process: (pdf: PDFDocumentProxy) => Promise<T>): Promise<T> {
    const { GlobalWorkerOptions, getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const assetRoot = document.getElementById("prepmallow-app")?.dataset.assetRoot;
    if (!assetRoot) throw new Error("PDF resources could not be located. Reload the page and try again.");
    const resources = new URL("pdf-assets/", assetRoot);
    GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.js", resources).href;
    const data = new Uint8Array(await file.arrayBuffer());
    signal.throwIfAborted();
    const task = getDocument({
        data,
        cMapUrl: new URL("cmaps/", resources).href,
        cMapPacked: true,
        standardFontDataUrl: new URL("standard_fonts/", resources).href,
        wasmUrl: new URL("wasm/", resources).href,
        iccUrl: new URL("iccs/", resources).href,
        isEvalSupported: false,
        useSystemFonts: true,
    });
    let closing: Promise<void> | undefined;
    function close() {
        closing ??= task.destroy().catch(() => {});
        return closing;
    }
    signal.addEventListener("abort", close, { once: true });

    try {
        let pdf;
        try {
            pdf = await task.promise;
        } catch {
            signal.throwIfAborted();
            throw new Error("Could not open " + file.name + ". Choose a complete, password-free PDF.");
        }
        signal.throwIfAborted();
        return await process(pdf);
    } finally {
        signal.removeEventListener("abort", close);
        await close();
    }
}

export async function rasterPage(page: PDFPageProxy, dpi: number, maxEdge: number, signal: AbortSignal) {
    signal.throwIfAborted();
    const scale = dpi / 72;
    const requested = page.getViewport({ scale });
    const maxPixels = 12_000_000;
    const ratio = Math.min(1, maxEdge / requested.width, maxEdge / requested.height,
        Math.sqrt(maxPixels / (requested.width * requested.height)));
    const viewport = page.getViewport({ scale: scale * ratio });
    const { canvas, context } = makeCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
    const render = page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" });
    const cancel = () => render.cancel();
    signal.addEventListener("abort", cancel, { once: true });
    try {
        await render.promise;
        return { canvas, context };
    } catch (error) {
        canvas.width = 1;
        throw error;
    } finally {
        signal.removeEventListener("abort", cancel);
    }
}

export async function pageThumbnails(file: File, emit: (index: number, image: string) => void, signal: AbortSignal) {
  return withPdf(file, signal, async pdf => {
    for (let index = 0; index < Math.min(pdf.numPages, MAX_ORGANIZE_PAGES); index++) {
      signal.throwIfAborted();
      const page = await pdf.getPage(index + 1);
      let canvas: HTMLCanvasElement | undefined;
      try {
        ({ canvas } = await rasterPage(page, 72, 180, signal));
        emit(index, canvas.toDataURL("image/jpeg", .66));
      } catch {
        signal.throwIfAborted();
      } finally {
        if (canvas) canvas.width = 1;
        page.cleanup();
      }
    }
  });
}
