/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { MAX_EDGE, MAX_PIXELS } from "./file-utils";
import type { ImageType } from "./settings";

type ImageSource = ImageBitmap | HTMLImageElement;
export type DecodedImage = { source: ImageSource; width: number; height: number; close: () => void };

function loadElement(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This image could not be opened.")); };
    image.src = url;
  });
}

async function openImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const source = await createImageBitmap(blob, { imageOrientation: "from-image" });
      return { source, width: source.width, height: source.height, close: () => source.close() };
    } catch { /* use the browser's image element as a second decoder */ }
  }
  const source = await loadElement(blob);
  return { source, width: source.naturalWidth, height: source.naturalHeight, close: () => {} };
}

export async function decodeImage(file: File) {
  try {
    return await openImage(file);
  } catch {
    if (!/\.(heic|heif)$/i.test(file.name) && !/^image\/hei[cf]/i.test(file.type)) {
      throw new Error("This image could not be opened. Check that the file is complete and uses a supported format.");
    }
  }
  try {
    const { heicTo } = await import("heic-to/csp");
    return await openImage(await heicTo({ blob: file, type: "image/png" }));
  } catch {
    throw new Error("This HEIC image could not be decoded. Try exporting a JPG from your photo app first.");
  }
}

export function boundedDimensions(width: number, height: number, edge = MAX_EDGE, pixels = MAX_PIXELS) {
  const ratio = Math.min(1, edge / Math.max(width, height), Math.sqrt(pixels / (width * height)));
  return [Math.max(1, Math.floor(width * ratio)), Math.max(1, Math.floor(height * ratio))] as const;
}

export function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not open an image workspace.");
  context.imageSmoothingQuality = "high";
  return { canvas, context };
}

export function encode(canvas: HTMLCanvasElement, type: ImageType, quality = .88) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== type) {
        reject(new Error("This browser could not save " + extension(type).toUpperCase() + ". Try a different format or a smaller image."));
      } else {
        resolve(blob);
      }
    }, type, quality);
  });
}

export function extension(type: ImageType) {
  return type === "image/jpeg" ? "jpg" : type.split("/")[1];
}

export function imageType(value: string, fallback: ImageType = "image/jpeg"): ImageType {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp" ? value : fallback;
}

export function sourceImageType(file: File): ImageType {
  if (file.type === "image/webp" || /\.webp$/i.test(file.name)) return "image/webp";
  return /image\/(jpeg|hei[cf])/.test(file.type) || /\.(jpe?g|hei[cf])$/i.test(file.name) ? "image/jpeg" : "image/png";
}
