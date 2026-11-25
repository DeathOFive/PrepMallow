/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { uniqueNames, type Entry, type Output } from "./file-utils";
import { checkFile, renameFiles } from "./file-tools";
import type { PageEdit, Settings } from "./settings";

export type RunResult = { items: Output[]; errors: string[] };

const singleResult = (item: Output) => ({ items: [item], errors: [] });
const multipleResults = (items: Output[]) => ({ items, errors: [] });

function nameResults(result: RunResult) {
    const names = uniqueNames(result.items.map(item => item.name));
    result.items.forEach((item, index) => { item.name = names[index]; });
    return result;
}

export async function runTool(slug: string, entries: Entry[], settings: Settings, pages: PageEdit[],
    progress: (message: string) => void, signal: AbortSignal, archiveSelection: Parameters<typeof import("./archives").extractArchive>[1]): Promise<RunResult> {
    if (!entries.length) throw new Error("Choose a file to get started.");
    signal.throwIfAborted();
    const first = entries[0].file;
    switch (slug) {
    case "images-to-pdf":
        return singleResult(await (await import("./pdf-edits")).photosToPdf(entries, settings, progress, signal));
    case "merge-pdf":
        return singleResult(await (await import("./pdf-edits")).mergePdfs(entries, settings, progress, signal));
    case "organize-pdf": {
        const { organizePdf } = await import("./pdfs");
        return singleResult(await organizePdf(first, pages, settings));
    }
    case "pdf-to-images":
        return multipleResults(await (await import("./pdf-edits")).pdfToImages(first, settings, progress, signal));
    case "split-pdf":
        return nameResults(multipleResults(await (await import("./pdf-edits")).splitPdf(first, settings, progress, signal)));
    case "extract-pdf-text":
        return multipleResults(await (await import("./pdf-edits")).extractPdfText(first, settings, progress, signal));
    case "rename-files":
        return multipleResults(renameFiles(entries, settings));
    case "create-zip":
        return singleResult(await (await import("./archives")).createArchive(entries, settings, progress, signal));
    case "open-zip":
        return nameResults(await (await import("./archives")).extractArchive(first, archiveSelection, progress, signal));
    }

    if (slug === "watermark-file" && !settings.watermark.trim()) throw new Error("Enter some text for your watermark.");
    const result: RunResult = { items: [], errors: [] };
    for (const [index, entry] of entries.entries()) {
        signal.throwIfAborted();
        progress("Processing file " + (index + 1) + " of " + entries.length);
        try {
            let output;
            if (slug === "check-file") output = await checkFile(entry, settings, signal);
            else if (slug === "compress-pdf") output = await (await import("./pdf-edits")).compressPdf(entry.file, settings, progress, signal);
            else if (slug === "watermark-file" && entry.kind === "pdf") {
                output = await (await import("./pdf-edits")).watermarkPdf(entry.file, settings, progress, signal);
            } else {
                output = await (await import("./image-edits")).runImageTool(slug, entry.file, settings, signal);
            }
            result.items.push(output);
        } catch (error) {
            signal.throwIfAborted();
            result.errors.push(entry.file.name + " · " + (error instanceof Error ? error.message : "Could not process this file."));
        }
    }
    return slug === "check-file" ? result : nameResults(result);
}
