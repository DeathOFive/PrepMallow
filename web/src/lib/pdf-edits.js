/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { MAX_TOTAL_BYTES as maxBatchBytes, safeName, stemOf, pageSelection, integer } from "./file-utils";
import { boundedDimensions as fitLimits, decodeImage, encode as encodeCanvas, extension, imageType as imageFormat, makeCanvas } from "./images";
import { drawSource, drawWatermark } from "./image-edits";
import { loadPdf, rasterPage, savePdf, withPdf } from "./pdfs";

const maxParts = 40;
const pdfLib = () => import("pdf-lib");

function outputStem(filename, fallback, extension) {
    const suffix = "." + extension;
    const raw = filename.trim();
    return safeName(raw.toLowerCase().endsWith(suffix) ? raw.slice(0, -suffix.length) : raw, fallback);
}

function requirePages(selection, limit, message) {
    if (!selection.length) throw new Error("The PDF has no pages to process.");
    if (selection.length > limit) throw new Error(message);
}

function boundedTotal(total, size, message) {
    const sum = total + size;
    if (sum > maxBatchBytes) throw new Error(message);
    return sum;
}

const paperSizes = { a4: [595.28, 841.89], a5: [419.53, 595.28], letter: [612, 792], legal: [612, 1008] };
const photoProfiles = {
    compact: { edge: 1500, pixels: 2_200_000, quality: .72 },
    balanced: { edge: 2800, pixels: 7_000_000, quality: .9 },
    high: { edge: 4000, pixels: 12_000_000, quality: .94 },
};

function photoPageSize(source, settings, margin) {
    if (settings.pageSize === "photo") {
        const scale = Math.min(1, 1000 / Math.max(source.width, source.height));
        return [source.width * scale + 2 * margin, source.height * scale + 2 * margin];
    }
    const [width, height] = paperSizes[settings.pageSize] || paperSizes.a4;
    const landscape = settings.orientation === "landscape" || (settings.orientation === "auto" && source.width > source.height);
    return landscape ? [height, width] : [width, height];
}

function photoFrame(page, margin, perPage, slot) {
    const { width, height } = page.getSize();
    const columns = perPage === 4 || (perPage === 2 && width > height) ? 2 : 1;
    const rows = perPage / columns;
    const gutter = 12;
    const frameWidth = (width - margin * 2 - gutter * (columns - 1)) / columns;
    const frameHeight = (height - margin * 2 - gutter * (rows - 1)) / rows;
    return {
        x: margin + (slot % columns) * (frameWidth + gutter),
        y: height - margin - frameHeight - Math.floor(slot / columns) * (frameHeight + gutter),
        width: frameWidth,
        height: frameHeight,
    };
}

async function placePhoto(pdf, page, source, frame, settings, profile) {
    const fill = settings.pageSize !== "photo" && settings.photoFit === "crop";
    const aspect = frame.width / frame.height;
    const targetWidth = fill ? Math.min(source.width, source.height * aspect) : source.width;
    const targetHeight = fill ? Math.min(source.height, source.width / aspect) : source.height;
    const [width, height] = fitLimits(targetWidth, targetHeight, profile.edge, profile.pixels);
    const { canvas, context } = makeCanvas(width, height);
    try {
        drawSource(context, source, width, height, fill ? "crop" : "stretch", "#ffffff");
        const photo = await encodeCanvas(canvas, "image/jpeg", profile.quality);
        const embedded = await pdf.embedJpg(await photo.arrayBuffer());
        const draw = fill ? { width: frame.width, height: frame.height } : embedded.scaleToFit(frame.width, frame.height);
        page.drawImage(embedded, {
            x: frame.x + (frame.width - draw.width) / 2,
            y: frame.y + (frame.height - draw.height) / 2,
            ...draw,
        });
        return photo.size;
    } finally {
        canvas.width = 1;
    }
}

export async function photosToPdf(entries, settings, progress, signal) {
    const { PDFDocument } = await pdfLib();
    const pdf = await PDFDocument.create();
    const margin = integer(settings.margin, "Page margin", 0, 72);
    const perPage = settings.pageSize === "photo" ? 1 : ({ two: 2, four: 4 }[settings.photoLayout] || 1);
    const profile = photoProfiles[settings.photoQuality] || photoProfiles.balanced;
    let page;
    let total = 0;
    for (const [index, { file }] of entries.entries()) {
        signal.throwIfAborted();
        progress("Preparing photo " + (index + 1) + " of " + entries.length);
        const source = await decodeImage(file).catch(error => { throw new Error(file.name + " · " + error.message); });
        try {
            signal.throwIfAborted();
            const slot = index % perPage;
            if (!slot) page = pdf.addPage(photoPageSize(source, settings, margin));
            const frame = photoFrame(page, margin, perPage, slot);
            const bytes = await placePhoto(pdf, page, source, frame, settings, profile);
            total = boundedTotal(total, bytes, "The PDF would exceed 160 MB. Choose smaller photo detail or fewer photos.");
        } finally {
            source.close();
        }
    }
    const count = pdf.getPageCount();
    return {
        name: outputStem(settings.filename, "photos", "pdf") + ".pdf",
        blob: await savePdf(pdf),
        detail: count + (count === 1 ? " page" : " pages") + " · " + entries.length + (entries.length === 1 ? " photo" : " photos"),
    };
}

export async function mergePdfs(entries, settings, progress, signal) {
    if (entries.length < 2) throw new Error("Add at least two PDFs to merge.");
    const { PDFDocument } = await pdfLib();
    const output = await PDFDocument.create();
    for (const [index, { file, id }] of entries.entries()) {
        signal.throwIfAborted();
        progress("Copying document " + (index + 1) + " of " + entries.length);
        const source = await loadPdf(file);
        let selected;
        try {
            selected = pageSelection(settings.mergeRanges[id] || "", source.getPageCount());
        } catch (error) {
            throw new Error(file.name + " · " + error.message);
        }
        if (!selected.length) throw new Error(file.name + " has no pages to merge.");
        const count = output.getPageCount();
        const insertBlank = settings.startOnOddPage && count % 2 !== 0;
        if (count + selected.length + Number(insertBlank) > 500) {
            throw new Error("Merge up to 500 pages per PDF. Choose fewer pages or smaller batches.");
        }
        if (insertBlank) {
            const last = output.getPage(count - 1);
            output.addPage([last.getWidth(), last.getHeight()]).setRotation(last.getRotation());
        }
        for (const page of await output.copyPages(source, selected)) output.addPage(page);
    }
    return {
        name: outputStem(settings.filename, "merged", "pdf") + ".pdf",
        blob: await savePdf(output),
        detail: output.getPageCount() + " pages",
    };
}

function splitPlan(settings, count) {
    if (settings.splitMode === "ranges") {
        const ranges = settings.range.trim().replace(/[–—]/g, "-").split(",");
        if (ranges.some(range => !/^\s*\d+\s*(?:-\s*\d+\s*)?$/.test(range))) {
            throw new Error("Enter ranges like 1–3, 4–6, 8.");
        }
        return ranges.map(range => {
            const pages = pageSelection(range, count);
            const first = pages[0] + 1;
            const last = pages.at(-1) + 1;
            return { pages, label: first === last ? "page-" + first : "pages-" + first + "-" + last };
        });
    }
    const selected = pageSelection(settings.range, count);
    if (settings.splitMode !== "fixed") return selected.map(index => ({ pages: [index], label: "page-" + (index + 1) }));
    const size = integer(settings.splitSize, "Pages per part", 1, 500);
    const parts = [];
    for (let offset = 0; offset < selected.length; offset += size) {
        parts.push({ pages: selected.slice(offset, offset + size), label: "part-" + String(parts.length + 1).padStart(2, "0") });
    }
    return parts;
}

export async function splitPdf(file, settings, progress, signal) {
    const { PDFDocument } = await pdfLib();
    const source = await loadPdf(file);
    if (!source.getPageCount()) throw new Error("The PDF has no pages to split.");
    const parts = splitPlan(settings, source.getPageCount());
    if (parts.length > maxParts || parts.reduce((total, part) => total + part.pages.length, 0) > 500) {
        throw new Error("Split up to 40 parts and 500 pages at a time. Choose a smaller range.");
    }
    const base = outputStem(settings.filename, stemOf(file), "pdf");
    const items = [];
    let total = 0;
    for (const [index, { pages, label }] of parts.entries()) {
        signal.throwIfAborted();
        progress("Creating part " + (index + 1) + " of " + parts.length);
        const output = await PDFDocument.create();
        for (const page of await output.copyPages(source, pages)) output.addPage(page);
        const blob = await savePdf(output);
        total = boundedTotal(total, blob.size, "The parts would exceed 160 MB. Choose a smaller page range.");
        items.push({ name: base + "-" + label + ".pdf", blob, detail: pages.length + (pages.length === 1 ? " page" : " pages") });
    }
    return items;
}

function pageText(content) {
    return content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : "") : "").join("").trim();
}

function plainText(text) {
    return new Blob([text], { type: "text/plain;charset=utf-8" });
}

export async function extractPdfText(file, settings, progress, signal) {
    return withPdf(file, signal, async pdf => {
        const selected = pageSelection(settings.range, pdf.numPages);
        const separate = settings.textMode === "separate";
        requirePages(selected, separate ? maxParts : 100, "Choose a smaller range. You can extract up to " + (separate ? "40 separate" : "100 combined") + " pages.");
        const base = outputStem(settings.filename, stemOf(file) + "-text", "txt");
        const found = [];
        const empty = [];
        let characters = 0;
        for (const [position, index] of selected.entries()) {
            signal.throwIfAborted();
            progress("Reading page " + (position + 1) + " of " + selected.length);
            const page = await pdf.getPage(index + 1);
            let text;
            try {
                text = pageText(await page.getTextContent());
            } finally {
                page.cleanup();
            }
            if (!text) {
                empty.push(index + 1);
                continue;
            }
            characters += text.length;
            if (characters > 8_000_000) throw new Error("The extracted text is too large. Choose a smaller page range.");
            found.push({ page: index + 1, text });
        }
        if (!found.length) throw new Error("There is no selectable text in these pages. Scanned pages need OCR first.");
        const items = separate
            ? found.map(({ page, text }) => ({ name: base + "-page-" + page + ".txt", blob: plainText(text), detail: "Page " + page, textPreview: true }))
            : [{
                name: base + ".txt",
                blob: plainText(found.map(({ page, text }) => settings.textHeadings ? "--- Page " + page + " ---\n" + text : text).join("\n\n")),
                detail: found.length + (found.length === 1 ? " page with text" : " pages with text"),
                textPreview: true,
            }];
        if (empty.length) items[0].warning = "No selectable text on " + (empty.length === 1 ? "page " : "pages ") + empty.join(", ") + ".";
        return items;
    });
}

export async function pdfToImages(file, settings, progress, signal) {
    return withPdf(file, signal, async pdf => {
        const selected = pageSelection(settings.range, pdf.numPages);
        requirePages(selected, maxParts, "Export up to 40 pages at a time. Enter a smaller page range.");
        const format = imageFormat(settings.format);
        const dpi = integer(settings.dpi, "Resolution", 72, 200);
        const quality = Number(settings.quality) / 100;
        const prefix = safeName(settings.filename, stemOf(file));
        const items = [];
        let total = 0;
        for (const [position, index] of selected.entries()) {
            signal.throwIfAborted();
            progress("Rendering page " + (position + 1) + " of " + selected.length);
            const page = await pdf.getPage(index + 1);
            let canvas;
            try {
                ({ canvas } = await rasterPage(page, dpi, 4800, signal));
                const blob = await encodeCanvas(canvas, format, quality);
                total = boundedTotal(total, blob.size, "These images exceed 160 MB. Choose a smaller page range or lower resolution.");
                items.push({ name: prefix + "-page-" + (index + 1) + "." + extension(format), blob,
                    detail: canvas.width + " × " + canvas.height + " px" });
            } finally {
                if (canvas) canvas.width = 1;
                page.cleanup();
            }
        }
        return items;
    });
}

function grayscale(context, width, height) {
    const image = context.getImageData(0, 0, width, height);
    for (let i = 0; i < image.data.length; i += 4) {
        const light = .2126 * image.data[i] + .7152 * image.data[i + 1] + .0722 * image.data[i + 2];
        image.data[i] = image.data[i + 1] = image.data[i + 2] = light;
    }
    context.putImageData(image, 0, 0);
}

const scanProfiles = { small: { dpi: 84, quality: .59 }, balanced: { dpi: 120, quality: .73 }, sharp: { dpi: 160, quality: .84 } };

async function buildScan(pdf, selected, settings, profile, progress, signal) {
    const { PDFDocument } = await pdfLib();
    const output = await PDFDocument.create();
    let total = 0;
    for (const [position, index] of selected.entries()) {
        signal.throwIfAborted();
        progress(position + 1, selected.length);
        const page = await pdf.getPage(index + 1);
        let canvas;
        try {
            const { width, height } = page.getViewport({ scale: 1 });
            const raster = await rasterPage(page, profile.dpi, 4000, signal);
            canvas = raster.canvas;
            if (settings.grayscale) grayscale(raster.context, canvas.width, canvas.height);
            const blob = await encodeCanvas(canvas, "image/jpeg", profile.quality);
            total = boundedTotal(total, blob.size, "The PDF would exceed 160 MB. Try a smaller page range or a lower detail setting.");
            const image = await output.embedJpg(await blob.arrayBuffer());
            output.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
        } finally {
            if (canvas) canvas.width = 1;
            page.cleanup();
        }
    }
    return savePdf(output);
}

export async function compressPdf(file, settings, progress, signal) {
    const target = settings.targetPdfKB.trim()
        ? integer(settings.targetPdfKB, "Target size", 5, 80_000) * 1000 : null;
    return withPdf(file, signal, async pdf => {
        const selected = pageSelection(settings.range, pdf.numPages);
        requirePages(selected, maxParts, "Compress up to 40 pages at a time. Choose a smaller range.");
        const originalSize = selected.length === pdf.numPages ? file.size : undefined;
        let profile = scanProfiles[settings.scanDetail] || scanProfiles.balanced;
        let best;
        for (let attempt = 1; attempt <= (target ? 4 : 1); attempt++) {
            const blob = await buildScan(pdf, selected, settings, profile, (position, count) => {
                progress("Compressing page " + position + " of " + count + (attempt > 1 ? " · pass " + attempt : ""));
            }, signal);
            if (!best || blob.size < best.size) best = blob;
            if (!target || best.size <= target || (profile.dpi === 36 && profile.quality === .28)) break;
            const scale = Math.min(.83, Math.max(.48, .92 * Math.sqrt(target / blob.size)));
            profile = { dpi: Math.max(36, Math.floor(profile.dpi * scale)), quality: Math.max(.28, profile.quality - .13) };
        }
        return {
            name: stemOf(file) + "-compressed.pdf",
            blob: best,
            originalBytes: originalSize,
            detail: selected.length + (selected.length === 1 ? " flattened page" : " flattened pages"),
            warning: target && best.size > target ? "The smallest copy is above " + settings.targetPdfKB + " KB. Try fewer pages or a higher limit."
                : originalSize && best.size >= originalSize ? "The new PDF is larger. Try Smallest or use your original." : undefined,
        };
    });
}

export async function watermarkPdf(file, settings, progress, signal) {
    const { degrees } = await pdfLib();
    const pdf = await loadPdf(file);
    const selected = pageSelection(settings.range, pdf.getPageCount());
    requirePages(selected, 250, "Add a watermark to up to 250 pages at a time. Enter a smaller page range.");
    const marks = new Map();
    for (const [position, index] of selected.entries()) {
        signal.throwIfAborted();
        progress("Marking page " + (position + 1) + " of " + selected.length);
        const page = pdf.getPage(index);
        const { x, y, width, height } = page.getCropBox();
        const angle = (page.getRotation().angle % 360 + 360) % 360;
        const [visualWidth, visualHeight] = angle === 90 || angle === 270 ? [height, width] : [width, height];
        const key = visualWidth + "×" + visualHeight;
        let mark = marks.get(key);
        if (!mark) {
            const scale = 1200 / Math.max(visualWidth, visualHeight);
            const { canvas, context } = makeCanvas(Math.max(1, Math.round(visualWidth * scale)), Math.max(1, Math.round(visualHeight * scale)));
            try {
                drawWatermark(context, canvas.width, canvas.height, settings);
                const overlay = await encodeCanvas(canvas, "image/png");
                mark = await pdf.embedPng(await overlay.arrayBuffer());
                marks.set(key, mark);
            } finally {
                canvas.width = 1;
            }
        }
        page.drawImage(mark, {
            x: x + (angle === 90 || angle === 180 ? width : 0),
            y: y + (angle === 180 || angle === 270 ? height : 0),
            width: visualWidth, height: visualHeight, rotate: degrees(angle),
        });
    }
    return { name: stemOf(file) + "-watermarked.pdf", blob: await savePdf(pdf),
        detail: selected.length + (selected.length === 1 ? " marked page" : " marked pages") };
}
