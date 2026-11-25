/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { fileSize, nameParts, uniqueNames, integer } from "./file-utils";

export function renamePreview(entries, settings) {
    const base = settings.nameBase.trim();
    const start = Math.max(1, Math.min(999999, Math.trunc(Number(settings.start) || 1)));
    const digits = Math.max(1, Math.min(6, Number(settings.digits) || 2));
    const match = settings.find && settings.ignoreCase
        ? new RegExp(settings.find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu") : null;
    return uniqueNames(entries.map(({ file }, index) => {
        let [stem, extension] = nameParts(file.name);
        switch (settings.renameMode) {
        case "sequence": stem = (base || "file") + "-" + String(start + index).padStart(digits, "0"); break;
        case "prefix": if (base) stem = base + "-" + stem; break;
        case "suffix": if (base) stem += "-" + base; break;
        case "replace":
            if (settings.find) stem = match ? stem.replace(match, () => settings.replace) : stem.split(settings.find).join(settings.replace);
            break;
        }
        if (settings.hyphenate) stem = stem.trim().replace(/\s+/g, "-");
        if (settings.renameCase === "lower") stem = stem.toLowerCase();
        if (settings.renameCase === "upper") stem = stem.toUpperCase();
        return stem + extension;
    }));
}

export function renameFiles(entries, settings) {
    if (settings.renameMode === "replace" && !settings.find) throw new Error("Enter the text you want to find in your filenames.");
    if (settings.renameMode === "sequence") integer(settings.start, "Start at", 1, 999999);
    if (["prefix", "suffix"].includes(settings.renameMode) && !settings.nameBase.trim()) {
        throw new Error("Enter the " + settings.renameMode + " to add.");
    }
    const names = renamePreview(entries, settings);
    return entries.map(({ file }, index) => ({ name: names[index], blob: file, originalName: file.name }));
}

async function sniffFormat(file) {
    const bytes = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    const text = String.fromCharCode(...bytes);
    if (bytes[0] === 255 && bytes[1] === 216) return "JPG";
    if (bytes[0] === 137 && text.startsWith("PNG\r\n\x1a\n", 1)) return "PNG";
    if (text.startsWith("RIFF") && text.startsWith("WEBP", 8)) return "WebP";
    if (/^GIF8[79]a/.test(text)) return "GIF";
    if (text.startsWith("BM") && bytes.length >= 14) return "BMP";
    if (text.startsWith("ftyp", 4)) {
        const brands = text.slice(8, 64);
        if (/avif|avis/.test(brands)) return "AVIF";
        if (/hei[cf]|heix|mif1|msf1|hevc/.test(brands)) return "HEIC";
    }
    if (text.includes("%PDF-")) return "PDF";
    if (text.startsWith("PK\x03\x04") || text.startsWith("PK\x05\x06")) return "ZIP";
    return null;
}

function optionalInteger(value, label, max) {
    return value.trim() ? integer(value, label, 1, max) : null;
}

const imageTypes = new Set(["JPG", "PNG", "WebP", "GIF", "BMP", "AVIF", "HEIC"]);

export async function checkFile({ file, kind }, settings, signal) {
    const minKB = optionalInteger(settings.minKB, "Minimum size", 80000);
    const maxKB = optionalInteger(settings.maxKB, "Maximum size", 80000);
    if (minKB && maxKB && minKB > maxKB) throw new Error("The minimum size must be at or below the maximum size.");
    const width = optionalInteger(settings.checkWidth, "Expected width", 100000);
    const height = optionalInteger(settings.checkHeight, "Expected height", 100000);
    const maxPages = optionalInteger(settings.maxPages, "Maximum pages", 100000);
    let format = await sniffFormat(file);
    const facts = [["File size", fileSize(file.size)], ["Bytes", String(file.size)]];
    const notes = [];
    const setRequirements = Boolean(minKB || maxKB || width || height || maxPages || settings.expected !== "any");
    if (minKB && file.size < minKB * 1000) notes.push("Below the " + minKB + " KB minimum");
    if (maxKB && file.size > maxKB * 1000) notes.push("Above the " + maxKB + " KB limit");

    if (imageTypes.has(format) || (!format && kind === "image")) {
        const { decodeImage } = await import("./images");
        const image = await decodeImage(file);
        try {
            facts.push(["Dimensions", image.width + " × " + image.height + " px"]);
            if (width && image.width !== width) notes.push("Width must be " + width + " px");
            if (height && image.height !== height) notes.push("Height must be " + height + " px");
            format ||= "Image";
        } finally {
            image.close();
        }
    } else if (width || height) {
        notes.push("Pixel dimensions require an image");
    }

    if (format === "PDF" || (!format && kind === "pdf")) {
        const { pdfPageCount } = await import("./pdfs");
        const count = await pdfPageCount(file);
        facts.push(["Pages", String(count)]);
        if (maxPages && count > maxPages) notes.push("Above the " + maxPages + "-page limit");
        format = "PDF";
    } else if (maxPages) {
        notes.push("PDF page limits require a PDF");
    }

    facts.push(["Format", format || file.type || "Unknown"]);
    if (settings.expected !== "any" && settings.expected !== format) notes.push("Expected " + settings.expected);
    if (settings.checksum) {
        signal.throwIfAborted();
        if (!globalThis.crypto?.subtle) throw new Error("SHA-256 requires a secure HTTPS page.");
        const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
        const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
        facts.push(["SHA-256", fingerprint]);
    }
    return {
        name: file.name,
        facts,
        verdict: setRequirements ? (notes.length ? "review" : "pass") : undefined,
        warning: notes.length ? notes.join(" · ") : undefined,
    };
}

function csvCell(value = "") {
    const safe = /^\s*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
    return '"' + safe.replaceAll('"', '""') + '"';
}

export function checkReport(result) {
    const labels = ["File size", "Bytes", "Format", "Dimensions", "Pages", "SHA-256"];
    const rows = [["Filename", ...labels, "Status", "Notes"]];
    for (const item of result.items) {
        const facts = Object.fromEntries(item.facts);
        const status = { pass: "Meets requirements", review: "Needs review" }[item.verdict] || "Inspected";
        rows.push([item.name, ...labels.map(label => facts[label]), status, item.warning]);
    }
    for (const error of result.errors) rows.push(["", ...labels.map(() => ""), "Could not process", error]);
    return new Blob(["\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
}
