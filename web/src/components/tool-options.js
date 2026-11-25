/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { cloneElement, createElement as h, Fragment } from "react";
import { defaultSettings } from "../lib/settings";

const imageFormats = [["image/jpeg", "JPG"], ["image/png", "PNG"], ["image/webp", "WebP"]];
const fitOptions = [["contain", "Fit inside"], ["crop", "Fill and center crop"], ["pad", "Fit and add padding"]];
const pageHint = "Leave blank for all pages. Enter a range like 1, 3–5.";
const ratios = [
    ["free", "Original aspect ratio"], ["1:1", "Square · 1:1"], ["4:3", "Standard · 4:3"],
    ["3:2", "Photo · 3:2"], ["16:9", "Landscape · 16:9"], ["4:5", "Portrait · 4:5"],
    ["9:16", "Vertical · 9:16"], ["7:9", "35 × 45 ratio · 7:9"],
];

const group = (...fields) => h(Fragment, null, ...fields);
const inline = (...fields) => h("div", { className: "fields-inline" }, ...fields);
const note = text => h("p", { className: "field-note" }, text);
const advanced = (title, ...fields) => h("details", { className: "advanced-options" },
    h("summary", null, title), h("div", null, ...fields));

export function ToolOptions({ slug, settings, update }) {
    function field(key, label, input, hint) {
        const labelId = "prep-" + slug + "-" + key;
        return h("label", { className: "field" }, h("span", { id: labelId }, label),
            cloneElement(input, {
                "aria-labelledby": input.props["aria-label"] ? undefined : labelId,
                "aria-describedby": hint ? labelId + "-hint" : undefined,
            }), hint && h("small", { id: labelId + "-hint" }, hint));
    }
    function change(key) {
        return event => update({ [key]: event.target.value });
    }
    function input(key, label, placeholder = "", hint = "", numeric = false) {
        return field(key, label, h("input", {
            type: "text",
            value: settings[key],
            placeholder,
            inputMode: numeric ? "numeric" : undefined,
            maxLength: numeric ? 8 : 150,
            onChange: change(key),
        }), hint);
    }
    function select(key, label, options, hint) {
        return field(key, label, h("select", { value: settings[key], onChange: change(key) },
            options.map(([value, name]) => h("option", { key: value, value }, name))), hint);
    }
    function check(key, label, hint) {
        return h("label", { className: "check-setting" },
            h("input", { type: "checkbox", checked: settings[key], onChange: event => update({ [key]: event.target.checked }) }),
            h("span", null, label, hint && h("small", null, hint)));
    }
    function slider(key, label, min, max, step = 1) {
        return field(key, label + " · " + settings[key] + "%", h("input", {
            type: "range", min, max, step, value: settings[key], onChange: change(key),
            "aria-label": label,
        }));
    }
    function color(key, label) {
        return field(key, label, h("input", { type: "color", value: settings[key], onChange: change(key) }));
    }
    function presets(label, options, apply, isActive) {
        return h("div", { className: "presets", role: "group", "aria-label": label },
            options.map(([name, ...values]) => h("button", {
                key: name, type: "button", "aria-pressed": isActive(...values), onClick: () => apply(...values),
            }, name)));
    }
    const quality = () => settings.format !== "image/png" && slider("quality", "Image quality", 30, 100);
    const format = () => select("format", "Save as", imageFormats);
    const pages = (hint = pageHint) => input("range", "Pages (optional)", "All pages or 1, 3–5", hint);
    const outputName = placeholder => input("filename", "Output name (optional)", placeholder);
    const matte = () => group(
        settings.format !== "image/jpeg" && check("fillTransparency", "Fill transparent areas"),
        (settings.format === "image/jpeg" || settings.fillTransparency) && color("background", "Background color"),
    );

    switch (slug) {
    case "compress-image":
        return group(
            input("target", "Maximum size per image (KB)", "200", "", true),
            presets("Common file size limits", [["50 KB", "50"], ["100 KB", "100"], ["200 KB", "200"],
                ["500 KB", "500"], ["1 MB", "1000"]], target => update({ target }), value => settings.target === value),
            select("format", "Save as", imageFormats.filter(([value]) => value !== "image/png")),
            !settings.compressWidth && !settings.compressHeight &&
                check("keepPixels", "Keep original dimensions", "Leave unchecked to let PrepMallow reduce dimensions for tighter limits."),
            advanced("Dimensions and background",
                inline(input("compressWidth", "Width (px)", "Auto", "", true),
                    input("compressHeight", "Height (px)", "Auto", "", true)),
                note("Set one side to keep the photo’s proportions. Set both for exact dimensions."),
                select("compressFit", "How to fit two dimensions", fitOptions.slice(1).reverse()),
                matte()),
        );
    case "resize-image":
        return group(
            inline(input("width", "Width (px)", "1080", "", true), input("height", "Height (px)", "1080", "", true)),
            presets("Common image dimensions", [
                ["600 × 600", "600", "600"], ["Square", "1080", "1080"], ["Portrait", "1080", "1350"],
                ["Social card", "1200", "630"], ["Full HD", "1920", "1080"], ["Vertical HD", "1080", "1920"],
            ], (width, height) => update({ width, height }), (width, height) => settings.width === width && settings.height === height),
            select("fit", "How to fit", fitOptions, {
                contain: "Keeps proportions within the width and height.",
                crop: "Fills the exact size and trims the edges.",
                pad: "Fits the whole image on an exact-size canvas.",
            }[settings.fit]),
            settings.fit !== "crop" && check("noUpscale", "Keep small images from enlarging"),
            format(), quality(), advanced("Background", matte()),
        );
    case "convert-image":
        return group(format(), quality(), matte(), note("Animated images export as a single frame."));
    case "crop-image":
        return group(
            select("aspect", "Crop shape", ratios), slider("zoom", "Zoom", 100, 300),
            inline(slider("cropX", "Horizontal position", 0, 100), slider("cropY", "Vertical position", 0, 100)),
            h("div", { className: "presets", role: "group", "aria-label": "Rotate or flip image" },
                h("button", { type: "button", onClick: () => update({ rotation: (settings.rotation + 3) % 4 }) }, "Rotate left"),
                h("button", { type: "button", onClick: () => update({ rotation: (settings.rotation + 1) % 4 }) }, "Rotate right"),
                h("button", { type: "button", "aria-pressed": settings.flipHorizontal, onClick: () => update({ flipHorizontal: !settings.flipHorizontal }) }, "Flip left/right"),
                h("button", { type: "button", "aria-pressed": settings.flipVertical, onClick: () => update({ flipVertical: !settings.flipVertical }) }, "Flip top/bottom"),
                h("button", { type: "button", onClick: () => update({
                    aspect: defaultSettings.aspect, zoom: defaultSettings.zoom, cropX: defaultSettings.cropX, cropY: defaultSettings.cropY,
                    rotation: defaultSettings.rotation, flipHorizontal: false, flipVertical: false,
                }) }, "Reset crop")),
            format(), quality(),
        );
    case "images-to-pdf":
        return group(
            select("pageSize", "Paper size", [["a4", "A4"], ["a5", "A5"], ["letter", "US Letter"], ["legal", "US Legal"], ["photo", "Match each photo"]]),
            inline(
                settings.pageSize !== "photo" && select("orientation", "Orientation", [["auto", "Automatic"], ["portrait", "Portrait"], ["landscape", "Landscape"]]),
                select("margin", "Page margins", [["0", "None"], ["12", "Narrow"], ["24", "Standard"], ["42", "Wide"]]),
            ),
            settings.pageSize !== "photo" && inline(
                select("photoLayout", "Photos per sheet", [["one", "One"], ["two", "Two"], ["four", "Four"]]),
                select("photoFit", "How photos fit", [["contain", "Fit whole photo"], ["crop", "Fill the frame"]]),
            ),
            select("photoQuality", "Photo detail", [["compact", "Smaller file"], ["balanced", "Balanced"], ["high", "Higher detail"]]),
            outputName("photos"),
        );
    case "merge-pdf":
        return group(outputName("merged"),
            check("startOnOddPage", "Start each document on an odd page", "Insert a blank page where needed for double-sided printing."),
            note("Drag files or use the arrows to set the merge order."));
    case "organize-pdf":
        return group(outputName("organized-pages"), note("Select, move or rotate pages in the preview. The export follows the order shown."));
    case "split-pdf":
        return group(
            select("splitMode", "Split by", [["pages", "Individual pages"], ["ranges", "Custom ranges"], ["fixed", "Fixed number of pages"]]),
            settings.splitMode === "ranges"
                ? input("range", "Page ranges", "1–3, 4–6, 8", "Each comma-separated range becomes one PDF.")
                : pages("Leave blank for all pages. Each export can contain up to 40 parts."),
            settings.splitMode === "fixed" && input("splitSize", "Pages per part", "2", "", true),
            outputName("source filename"),
        );
    case "extract-pdf-text":
        return group(
            pages("Extract up to 100 pages into one file or up to 40 individual page files."),
            select("textMode", "Save text as", [["combined", "One text file"], ["separate", "One file per page"]]),
            settings.textMode === "combined" && check("textHeadings", "Include page headings"),
            outputName("source filename"),
            note("Works with selectable text. Image-only scans need OCR first."),
        );
    case "pdf-to-images":
        return group(
            format(), select("dpi", "Resolution", [["72", "72 DPI · small"], ["96", "96 DPI"], ["120", "120 DPI · balanced"],
                ["150", "150 DPI"], ["200", "200 DPI · detailed"]]), quality(),
            pages("Export up to 40 pages at a time."),
            input("filename", "Filename prefix (optional)", "source filename"),
        );
    case "compress-pdf":
        return group(
            select("scanDetail", "Scan detail", [["small", "Smallest"], ["balanced", "Balanced"], ["sharp", "Sharper text"]]),
            input("targetPdfKB", "Target size (KB, optional)", "500", "A tighter target may reduce readability.", true),
            pages("Compress up to 40 pages per PDF."),
            check("grayscale", "Use grayscale", "Useful for black and white scans."),
            note("Each page becomes an image. Selectable text, links and forms are flattened."),
        );
    case "watermark-file":
        return group(
            input("watermark", "Watermark text", "For school registration only"),
            select("placement", "Placement", [["diagonal", "Across the middle"], ["center", "Center"], ["top", "Top center"],
                ["bottom", "Bottom center"], ["tile", "Repeat across the page"]]),
            select("shade", "Text color", [["dark", "Dark"], ["light", "White"], ["custom", "Custom"]]),
            settings.shade === "custom" && color("markColor", "Custom text color"),
            inline(slider("markSize", "Text size", 4, 18, 0.5), slider("opacity", "Opacity", 8, 90)),
            input("range", "PDF pages (optional)", "All pages or 1, 3–5", "This range applies to PDFs. Photos always get the watermark."),
        );
    case "remove-image-metadata":
        return group(
            select("format", "Save as", [["original", "Match source format where supported"], ...imageFormats]),
            quality(), note("Fresh copies retain the visible pixels and drop the original EXIF, GPS and camera tags."),
        );
    case "rename-files":
        return group(
            select("renameMode", "Naming rule", [["sequence", "Numbered names"], ["prefix", "Add a prefix"],
                ["suffix", "Add a suffix"], ["replace", "Find and replace"], ["keep", "Keep the base name"]]),
            settings.renameMode === "replace" && inline(input("find", "Find text", "old"), input("replace", "Replace with", "new")),
            settings.renameMode === "replace" && check("ignoreCase", "Ignore case when matching"),
            ["sequence", "prefix", "suffix"].includes(settings.renameMode) &&
                input("nameBase", { sequence: "Base name", prefix: "Prefix", suffix: "Suffix" }[settings.renameMode], "document"),
            settings.renameMode === "sequence" && inline(input("start", "Start at", "1", "", true),
                select("digits", "Number format", [["1", "1"], ["2", "01"], ["3", "001"], ["4", "0001"], ["5", "00001"], ["6", "000001"]])),
            select("renameCase", "Filename case", [["keep", "Keep case"], ["lower", "lowercase"], ["upper", "UPPERCASE"]]),
            check("hyphenate", "Replace spaces with hyphens"),
        );
    case "create-zip":
        return group(
            input("filename", "Archive name (optional)", "prepmallow-files"),
            select("zipLevel", "Compression", [["0", "Store · fastest"], ["3", "Balanced"], ["9", "Smallest · slower"]]),
            input("zipFolder", "Top-level folder (optional)", "submission", "Folder uploads keep their paths inside the ZIP."),
            note("If two files would have the same path, a number is added to keep both."),
        );
    case "open-zip":
        return group(note("Select up to 40 files from the archive list. Downloads of all selected files as a ZIP keep the folder structure."));
    case "check-file":
        return group(
            inline(input("minKB", "Minimum size (KB)", "Optional", "", true),
                input("maxKB", "Maximum size (KB)", "Optional", "", true)),
            select("expected", "Required format", [["any", "Any format"], ...["JPG", "PNG", "WebP", "HEIC", "AVIF", "GIF", "BMP", "PDF", "ZIP"].map(type => [type, type])]),
            inline(input("checkWidth", "Exact width (px)", "Optional", "", true),
                input("checkHeight", "Exact height (px)", "Optional", "", true)),
            input("maxPages", "Maximum PDF pages", "Optional", "", true),
            check("checksum", "Include SHA-256 checksum", "Use this fingerprint to verify whether two files are identical."),
        );
    default:
        return null;
    }
};
