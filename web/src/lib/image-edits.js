/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
import {
    boundedDimensions as fitLimits, decodeImage, encode as encodeCanvas, extension, imageType as imageFormat, makeCanvas, sourceImageType,
} from "./images";
import { MAX_EDGE as maxEdge, MAX_PIXELS as maxPixels, stemOf, integer } from "./file-utils";

function color(value, fallback) {
    return /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}

function checkDimensions(width, height) {
    if (width > maxEdge || height > maxEdge || width * height > maxPixels) {
        throw new Error("Choose dimensions up to 6,000 px per side and 24 megapixels total.");
    }
}

function imageMatte(format, settings) {
    return format === "image/jpeg" || settings.fillTransparency ? color(settings.background, "#ffffff") : "";
}

function fillCanvas(context, width, height, matte) {
    if (matte) {
        context.fillStyle = matte;
        context.fillRect(0, 0, width, height);
    }
}

export function drawSource(context, source, width, height, fit, matte, noUpscale = false) {
    fillCanvas(context, width, height, matte);
    if (fit === "stretch") {
        context.drawImage(source.source, 0, 0, width, height);
        return;
    }
    const factor = fit === "crop"
        ? Math.max(width / source.width, height / source.height)
        : Math.min(width / source.width, height / source.height, noUpscale ? 1 : Infinity);
    const drawWidth = source.width * factor;
    const drawHeight = source.height * factor;
    context.drawImage(source.source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

export function cropGeometry(source, settings) {
    const rotation = settings.rotation * Math.PI / 2;
    const sideways = settings.rotation % 2 !== 0;
    const width = sideways ? source.height : source.width;
    const height = sideways ? source.width : source.height;
    const [across, down] = settings.aspect.split(":").map(Number);
    const ratio = across && down ? across / down : width / height;
    const zoom = Number(settings.zoom) / 100;
    const cropWidth = Math.min(width, height * ratio) / zoom;
    const cropHeight = Math.min(height, width / ratio) / zoom;
    const [outputWidth, outputHeight] = fitLimits(Math.max(1, Math.round(cropWidth)), Math.max(1, Math.round(cropHeight)));
    return { rotation, width, height, cropWidth, cropHeight, outputWidth, outputHeight };
}

export function paintCrop(context, source, settings, geometry, width, height, matte) {
    const { rotation, width: imageWidth, height: imageHeight, cropWidth, cropHeight } = geometry;
    const left = (imageWidth - cropWidth) * Number(settings.cropX) / 100;
    const top = (imageHeight - cropHeight) * Number(settings.cropY) / 100;
    context.clearRect(0, 0, width, height);
    fillCanvas(context, width, height, matte);
    context.save();
    context.scale(width / cropWidth, height / cropHeight);
    context.translate(imageWidth / 2 - left, imageHeight / 2 - top);
    context.scale(settings.flipHorizontal ? -1 : 1, settings.flipVertical ? -1 : 1);
    context.rotate(rotation);
    context.drawImage(source.source, -source.width / 2, -source.height / 2, source.width, source.height);
    context.restore();
}

function imageResult(file, blob, format, width, height, suffix) {
    return {
        name: stemOf(file) + suffix + "." + extension(format),
        blob,
        originalBytes: file.size,
        detail: width + " × " + height + " px",
    };
}

async function bestUnderLimit(canvas, format, limit, lowestQuality, signal) {
    const full = await encodeCanvas(canvas, format, .96);
    if (full.size <= limit) return { best: full };
    const lowest = await encodeCanvas(canvas, format, lowestQuality);
    if (lowest.size > limit) return { floor: lowest.size };
    let best = lowest;
    let lower = lowestQuality;
    let upper = .96;
    for (let step = 0; step < 9; step++) {
        signal.throwIfAborted();
        const quality = (lower + upper) / 2;
        const candidate = await encodeCanvas(canvas, format, quality);
        if (candidate.size <= limit) {
            best = candidate;
            lower = quality;
        } else {
            upper = quality;
        }
    }
    return { best };
}

async function compressImage(file, source, settings, signal) {
    const limit = integer(settings.target, "Maximum size", 5, 25000) * 1000;
    const format = settings.format === "image/webp" ? "image/webp" : "image/jpeg";
    const hasWidth = Boolean(settings.compressWidth.trim());
    const hasHeight = Boolean(settings.compressHeight.trim());
    const lockPixels = hasWidth || hasHeight || settings.keepPixels;
    let [width, height] = fitLimits(source.width, source.height);
    if (hasWidth || hasHeight) {
        width = hasWidth ? integer(settings.compressWidth, "Width", 1, maxEdge) : null;
        height = hasHeight ? integer(settings.compressHeight, "Height", 1, maxEdge) : null;
        width ??= Math.max(1, Math.round(height * source.width / source.height));
        height ??= Math.max(1, Math.round(width * source.height / source.width));
        checkDimensions(width, height);
    } else if (lockPixels && (width !== source.width || height !== source.height)) {
        throw new Error("The original dimensions exceed the workspace limit. Allow smaller dimensions to continue.");
    }
    const fit = hasWidth && hasHeight ? settings.compressFit : "stretch";
    const matte = imageMatte(format, settings);

    for (let attempt = 0; attempt < 24; attempt++) {
        signal.throwIfAborted();
        const { canvas, context } = makeCanvas(width, height);
        try {
            drawSource(context, source, width, height, fit, matte);
            const { best, floor } = await bestUnderLimit(canvas, format, limit, lockPixels ? .04 : .32, signal);
            if (best) return imageResult(file, best, format, width, height, "-" + settings.target + "kb");
            if (lockPixels || (width === 1 && height === 1)) break;
            const factor = Math.max(.28, Math.min(.85, .93 * Math.sqrt(limit / floor)));
            width = Math.max(1, Math.floor(width * factor));
            height = Math.max(1, Math.floor(height * factor));
        } finally {
            canvas.width = 1;
        }
    }
    throw new Error(lockPixels
        ? "This photo cannot reach that limit at the requested dimensions. Try WebP, fewer pixels or a higher KB limit."
        : "This photo could not fit under the selected limit. Try a higher limit.");
}

export function drawWatermark(context, width, height, settings) {
    const text = settings.watermark.trim();
    const shortEdge = Math.min(width, height);
    const tiled = settings.placement === "tile";
    const size = Math.max(8, Math.round(shortEdge * Number(settings.markSize) / 100 * (tiled ? .55 : 1)));
    const baseline = Math.max(size, height * .06);
    context.save();
    context.font = "700 " + size + "px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = settings.shade === "light" ? "#ffffff" : settings.shade === "custom"
        ? color(settings.markColor, "#3a2675") : "#14121c";
    context.globalAlpha = Math.min(.9, Math.max(.08, Number(settings.opacity) / 100));

    if (["center", "top", "bottom"].includes(settings.placement)) {
        const y = settings.placement === "top" ? baseline
            : settings.placement === "bottom" ? height - baseline : height / 2;
        context.fillText(text, width / 2, y, width * .86);
    } else {
        context.translate(width / 2, height / 2);
        context.rotate(-Math.PI / 7);
        if (tiled) {
            const lineWidth = Math.min(context.measureText(text).width, width * .54);
            const horizontalStep = Math.max(shortEdge * .42, lineWidth + size * 1.5);
            const verticalStep = size * 4;
            const extent = Math.hypot(width, height) / 2;
            const rows = Math.ceil(extent / verticalStep);
            for (let row = -rows; row <= rows; row++) {
                for (let x = -extent; x <= extent + horizontalStep; x += horizontalStep) {
                    context.fillText(text, x + (row % 2 ? horizontalStep / 2 : 0), row * verticalStep, width * .54);
                }
            }
        } else {
            context.fillText(text, 0, 0, Math.min(Math.hypot(width, height) * .72, width * .97));
        }
    }
    context.restore();
}

export async function runImageTool(slug, file, settings, signal) {
    const source = await decodeImage(file);
    try {
        signal.throwIfAborted();
        if (slug === "compress-image") return await compressImage(file, source, settings, signal);
        const outputFormat = settings.format === "original" || slug === "watermark-file"
            ? sourceImageType(file) : imageFormat(settings.format);
        const quality = slug === "watermark-file" ? .94 : Number(settings.quality) / 100;
        let width = source.width;
        let height = source.height;
        let fit = "stretch";
        let geometry;

        if (slug === "crop-image") {
            geometry = cropGeometry(source, settings);
            ({ outputWidth: width, outputHeight: height } = geometry);
        } else if (slug === "resize-image") {
            width = integer(settings.width, "Width", 1, maxEdge);
            height = integer(settings.height, "Height", 1, maxEdge);
            fit = settings.fit;
            if (fit === "contain") {
                const factor = Math.min(width / source.width, height / source.height, settings.noUpscale ? 1 : Infinity);
                width = Math.max(1, Math.round(source.width * factor));
                height = Math.max(1, Math.round(source.height * factor));
                fit = "stretch";
            }
        }
        checkDimensions(width, height);
        const { canvas, context } = makeCanvas(width, height);
        try {
            const matte = imageMatte(outputFormat, settings);
            if (geometry) paintCrop(context, source, settings, geometry, width, height, matte);
            else drawSource(context, source, width, height, fit, matte, settings.noUpscale);
            if (slug === "watermark-file") drawWatermark(context, width, height, settings);
            const blob = await encodeCanvas(canvas, outputFormat, quality);
            const suffix = { "crop-image": "-cropped", "resize-image": "-resized", "convert-image": "-converted",
                "watermark-file": "-watermarked", "remove-image-metadata": "-clean" }[slug];
            return imageResult(file, blob, outputFormat, width, height, suffix);
        } finally {
            canvas.width = 1;
        }
    } finally {
        source.close();
    }
}
