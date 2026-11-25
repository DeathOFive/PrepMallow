/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { createElement as h, useEffect, useId, useRef, useState } from "react";
import { MAX_TOTAL_BYTES as maxTotalBytes, MAX_FILES as maxFiles, fileSize } from "../lib/file-utils";
import { copyToClipboard } from "../android-bridge";

function withinArchiveLimit(entries) {
    return entries.length <= maxFiles && entries.reduce((total, entry) => total + entry.unpacked, 0) <= maxTotalBytes;
}

const fileOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function action(label, onClick, disabled = false) {
    return h("button", { type: "button", className: "button button-outline button-small", onClick, disabled }, label);
}

export function useArchiveSelection(file) {
    const [loaded, setLoaded] = useState(null);
    const record = loaded?.file === file ? loaded : null;
    useEffect(() => {
        if (!file) {
            setLoaded(null);
            return;
        }
        const controller = new AbortController();
        async function load() {
            try {
                const { readArchive } = await import("../lib/archives");
                const entries = await readArchive(file, controller.signal);
                if (controller.signal.aborted) return;
                const available = entries.filter(entry => !entry.unavailable);
                const selection = withinArchiveLimit(available) ? available : [];
                setLoaded({ file, entries, selection });
            } catch (error) {
                if (!controller.signal.aborted) setLoaded({ file, error: error.message, entries: [], selection: [] });
            }
        }
        load();
        return () => controller.abort();
    }, [file]);
    return {
        loading: Boolean(file && !record),
        error: record?.error,
        entries: record?.entries || [],
        selection: record?.selection || [],
        update(selection) {
            setLoaded(current => current?.file === file ? { ...current, selection } : current);
        },
    };
}

export function ArchiveList({ archive, busy, onChange }) {
    const [query, setQuery] = useState("");
    const [notice, setNotice] = useState("");
    const searchId = useId();
    if (archive.loading) return h("p", { className: "field-note", role: "status" }, "Reading ZIP directory…");
    if (archive.error) return h("p", { className: "notice notice-error", role: "alert" }, archive.error);
    if (!archive.entries.length) return h("p", { className: "field-note" }, "There are no files in this archive.");

    const selected = new Set(archive.selection.map(entry => entry.id));
    const visible = archive.entries.filter(entry => entry.path.toLowerCase().includes(query.trim().toLowerCase()));
    const selectable = visible.filter(entry => !entry.unavailable);
    function update(ids) {
        const selection = archive.entries.filter(entry => ids.has(entry.id));
        if (!withinArchiveLimit(selection)) {
            setNotice("Select up to 40 files and 160 MB at a time. Search or deselect a few files to continue.");
            return;
        }
        setNotice("");
        onChange(selection);
    }

    return h("section", { className: "archive-browser", "aria-label": "ZIP contents" },
        h("div", { className: "archive-heading" },
            h("h3", null, "Archive contents"),
            h("span", { role: "status" }, selected.size + " of " + archive.entries.length + " selected")),
        h("label", { className: "sr-only", htmlFor: searchId }, "Find files in ZIP"),
        h("input", {
            id: searchId, type: "search", className: "archive-search", value: query, placeholder: "Find files in ZIP…",
            onChange: event => setQuery(event.target.value),
            onKeyDown: event => { if (event.key === "Enter") event.preventDefault(); },
        }),
        h("div", { className: "workspace-actions" },
            action("Select shown", () => update(new Set([...selected, ...selectable.map(entry => entry.id)])),
                busy || !selectable.some(entry => !selected.has(entry.id))),
            action("Clear selection", () => update(new Set()), busy || !selected.size)),
        notice && h("p", { className: "notice notice-error", role: "alert" }, notice),
        visible.length ? h("ul", { className: "archive-entries" }, visible.map(entry => h("li", { key: entry.id },
            h("label", { className: "archive-entry" },
                h("input", {
                    type: "checkbox", checked: selected.has(entry.id), disabled: busy || Boolean(entry.unavailable),
                    "aria-label": entry.path,
                    onChange: event => {
                        const next = new Set(selected);
                        if (event.target.checked) next.add(entry.id);
                        else next.delete(entry.id);
                        update(next);
                    },
                }),
                h("span", { className: "archive-name" }, entry.path),
                h("small", { className: "archive-size" }, entry.unavailable || fileSize(entry.unpacked))))))
            : h("p", { className: "field-note" }, "No files match that name."),
    );
}

export function FolderPicker({ disabled, onFiles, onChooseFolder }) {
    const picker = useRef(null);
    return h("div", { className: "workspace-actions folder-picker" },
        h("input", {
            ref: picker, type: "file", webkitdirectory: "", multiple: true, hidden: true, disabled,
            onChange: event => {
                onFiles(Array.from(event.currentTarget.files || []));
                event.currentTarget.value = "";
            },
        }),
        action("Choose a folder", onChooseFolder || (() => picker.current?.click()), disabled));
}

export function BatchOrder({ entries, busy, onChange }) {
    return h("div", { className: "workspace-actions batch-order", role: "group", "aria-label": "File order" },
        action("Sort A–Z", () => onChange(entries.slice().sort((left, right) => fileOrder.compare(
            left.file.webkitRelativePath || left.file.name, right.file.webkitRelativePath || right.file.name,
        ))), busy),
        action("Reverse order", () => onChange(entries.slice().reverse()), busy));
}

export function MergeRanges({ entries, settings, busy, update }) {
    return h("details", { className: "advanced-options merge-ranges" },
        h("summary", null, "Use specific pages per PDF"),
        h("div", null,
            h("p", { className: "field-note" }, "Leave a field blank to keep every page in that file."),
            ...entries.map(({ file, id }) => h("label", { key: id, className: "field" },
                h("span", null, file.name),
                h("input", {
                    type: "text", value: settings.mergeRanges[id] || "", placeholder: "All pages or 1, 3–5",
                    "aria-label": "Pages from " + file.name, maxLength: 150, disabled: busy,
                    onChange: event => update({ mergeRanges: { ...settings.mergeRanges, [id]: event.target.value } }),
                    onKeyDown: event => { if (event.key === "Enter") event.preventDefault(); },
                })))));
}

export function PageOrder({ pages, busy, onChange }) {
    const rotate = angle => onChange(current => current.map(page =>
        page.keep ? { ...page, rotation: (page.rotation + angle + 360) % 360 } : page));
    const anyKept = pages.some(page => page.keep);
    return h("div", { className: "workspace-actions page-bulk", role: "group", "aria-label": "Bulk page edits" },
        action("Rotate kept left", () => rotate(-90), busy || !anyKept),
        action("Rotate kept right", () => rotate(90), busy || !anyKept),
        action("Reverse order", () => onChange(current => current.slice().reverse()), busy || pages.length < 2),
        action("Original order", () => onChange(current => current.slice().sort((left, right) => left.index - right.index)), busy || pages.length < 2));
}

function CropCanvas({ source, imageTools, settings, busy, update }) {
    const canvas = useRef(null);
    const drag = useRef(null);
    const geometry = imageTools.cropGeometry(source, settings);
    const { outputWidth, outputHeight, cropWidth, cropHeight } = geometry;
    const scale = Math.min(600 / outputWidth, 400 / outputHeight);
    const width = Math.max(1, Math.round(outputWidth * scale));
    const height = Math.max(1, Math.round(outputHeight * scale));
    const maxX = geometry.width - cropWidth;
    const maxY = geometry.height - cropHeight;
    const movable = maxX > .01 || maxY > .01;

    useEffect(() => {
        const context = canvas.current?.getContext("2d");
        if (context) {
            context.imageSmoothingQuality = "high";
            imageTools.paintCrop(context, source, settings, geometry, width, height,
                settings.format === "image/jpeg" ? "#ffffff" : "");
        }
    });
    function begin(event) {
        if (busy || !movable || event.button !== 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        drag.current = { x: event.clientX, y: event.clientY, cropX: Number(settings.cropX), cropY: Number(settings.cropY), rect };
        event.currentTarget.setPointerCapture(event.pointerId);
    }
    function move(event) {
        const start = drag.current;
        if (busy || !start) return;
        const position = value => String(Math.round(Math.min(100, Math.max(0, value))));
        const cropX = maxX > .01 ? position(start.cropX - (event.clientX - start.x) / start.rect.width * cropWidth / maxX * 100) : settings.cropX;
        const cropY = maxY > .01 ? position(start.cropY - (event.clientY - start.y) / start.rect.height * cropHeight / maxY * 100) : settings.cropY;
        if (cropX !== settings.cropX || cropY !== settings.cropY) update({ cropX, cropY });
    }
    return h("figure", { className: "crop-preview" },
        h("div", { className: "crop-stage" }, h("canvas", {
            ref: canvas, width, height, className: movable && !busy ? "crop-movable" : undefined,
            role: "img", "aria-label": "Cropped photo preview",
            onPointerDown: begin, onPointerMove: move, onLostPointerCapture: () => { drag.current = null; },
        })),
        h("figcaption", null, h("strong", null, outputWidth + " × " + outputHeight + " px"),
            h("span", null, movable ? "Drag to reposition or use the sliders." : "Zoom in or choose a crop shape to reposition.")));
}

export function CropPreview({ file, settings, busy, update }) {
    const [preview, setPreview] = useState(null);
    useEffect(() => {
        let active = true;
        let source;
        async function load() {
            try {
                const [images, edits] = await Promise.all([import("../lib/images"), import("../lib/image-edits")]);
            const imageTools = { ...images, ...edits };
                if (!active) return;
                source = await imageTools.decodeImage(file);
                if (active) setPreview({ file, source, imageTools });
                else source.close();
            } catch (error) {
                if (active) setPreview({ file, error: error.message });
            }
        }
        load();
        return () => {
            active = false;
            source?.close();
        };
    }, [file]);
    if (preview?.file !== file) return h("p", { className: "field-note", role: "status" }, "Loading photo preview…");
    if (preview.error) return h("p", { className: "notice notice-error", role: "alert" }, preview.error);
    return h(CropCanvas, { source: preview.source, imageTools: preview.imageTools, settings, busy, update });
}

export function TextResultActions({ item, Dialog }) {
    const [preview, setPreview] = useState(null);
    const [notice, setNotice] = useState("");
    const previewLimit = 100_000;
    async function showPreview() {
        const text = await item.blob.slice(0, previewLimit + 4).text();
        setPreview(text.slice(0, previewLimit));
    }
    async function copyText() {
        try {
            await copyToClipboard(await item.blob.text());
            setNotice("Copied to clipboard.");
        } catch {
            await showPreview();
            setNotice("Clipboard access is unavailable. You can select and copy text in the preview.");
        }
    }
    return h("div", { className: "workspace-actions text-actions" },
        action("Preview text", showPreview), action("Copy text", copyText),
        notice && h("p", { role: "status", className: "text-copy-status" }, notice),
        preview !== null && h(Dialog, { label: "Text preview", onClose: () => setPreview(null) },
            h("h2", null, item.name),
            item.blob.size > previewLimit && h("p", null, "This preview shows the beginning. Download the file for the full text."),
            h("textarea", { className: "text-preview", "aria-label": "Extracted PDF text", readOnly: true, value: preview })),
    );
}

