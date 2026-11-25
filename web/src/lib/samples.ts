/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
import type { Tool } from "./catalog";
import { encode, makeCanvas } from "./images";

export async function samplePhoto(name = "weekend-photo.jpg", variant = 0, format = "image/jpeg") {
  const { canvas, context } = makeCanvas(1600, 1100);
  const colors = variant ? ["#d4e5b2", "#f7eedc", "#405044", "#638576"] : ["#e9dcfb", "#fff1d8", "#514482", "#b4a0e5"];
  const wash = context.createLinearGradient(0, 0, 1600, 1100);
  wash.addColorStop(0, colors[0]);
  wash.addColorStop(1, colors[1]);
  context.fillStyle = wash;
  context.fillRect(0, 0, 1600, 1100);
  context.fillStyle = colors[3];
  context.beginPath();
  context.arc(1250, 300, 194, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = colors[2];
  context.beginPath();
  context.moveTo(0, 1050);
  context.quadraticCurveTo(350, 380, 762, 790);
  context.quadraticCurveTo(1100, 350, 1600, 855);
  context.lineTo(1600, 1100);
  context.lineTo(0, 1100);
  context.fill();
  context.fillStyle = "#272237";
  context.font = "700 100px system-ui";
  context.fillText(variant ? "Field notes" : "Weekend notes", 100, 235);
  context.font = "400 33px system-ui";
  context.fillText("A PrepMallow sample image", 106, 298);
  const blob = await encode(canvas, format, .96);
  canvas.width = 1;
  return new File([blob], name, { type: blob.type });
}

async function samplePdf(name: string, captions: string[]) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const [i, caption] of captions.entries()) {
    const page = doc.addPage([460, 580]);
    const palette = [rgb(.90,.86,.97), rgb(.86,.92,.75), rgb(.98,.90,.79)];
    page.drawRectangle({ x: 22, y: 22, width: 416, height: 536, color: palette[i % palette.length] });
    page.drawText("PREPMALLOW  /  SAMPLE", { x: 54, y: 498, font, size: 10 });
    page.drawText(caption, { x: 54, y: 390, font, size: 32, color: rgb(.17,.12,.24) });
    page.drawText("Page " + (i + 1), { x: 54, y: 64, font, size: 14 });
  }
  return new File([Uint8Array.from(await doc.save())], name, { type: "application/pdf" });
}

async function sampleScan() {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  for (const index of [0, 1, 2]) {
    const photo = await samplePhoto("scan.jpg", index % 2);
    const image = await doc.embedJpg(await photo.arrayBuffer());
    doc.addPage([504, 346.5]).drawImage(image, { x: 0, y: 0, width: 504, height: 346.5 });
  }
  return new File([Uint8Array.from(await doc.save())], "sample-scan.pdf", { type: "application/pdf" });
}

export async function sampleFiles(tool: Tool) {
  if (tool.slug === "compress-image") return [await samplePhoto("weekend-photo.png", 0, "image/png")];
  if (tool.slug === "open-zip") {
    const { sampleArchive } = await import("./archives");
    return [await sampleArchive()];
  }
  if (tool.slug === "compress-pdf") return [await sampleScan()];
  if (tool.slug === "watermark-file") return Promise.all([samplePhoto(), samplePdf("sample-document.pdf", ["Document copy"])]);
  if (tool.slug === "merge-pdf") {
    return Promise.all([samplePdf("cover.pdf", ["Cover sheet"]), samplePdf("notes.pdf", ["Notes", "Next steps"])]);
  }
  if (tool.intake === "pdf") return [await samplePdf("sample-pages.pdf", ["First page", "Second page", "Third page"])];
  if (tool.slug === "rename-files" || tool.slug === "create-zip") {
    return ["notes-final.txt", "ideas-old.txt", "checklist-copy.txt"].map((name) => new File(["PrepMallow sample file.\n"], name, { type: "text/plain" }));
  }
  if (tool.slug === "images-to-pdf") return Promise.all([samplePhoto(), samplePhoto("field-notes.jpg", 1)]);
  return [await samplePhoto()];
}
