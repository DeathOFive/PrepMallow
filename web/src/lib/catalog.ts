/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
export type Group = "Images" | "PDF" | "File utilities";
export type Intake = "image" | "pdf" | "zip" | "visual" | "any";

export type Tool = {
  slug: string;
  group: Group;
  title: string;
  short: string;
  seoTitle: string;
  description: string;
  intake: Intake;
  action: string;
  steps: [string, string, string];
  faq: [string, string];
  single?: boolean;
  related?: string[];
};

const newTools: Tool[] = [
    {
        slug: "crop-image",
        group: "Images",
        title: "Crop & rotate images",
        short: "Frame, rotate or flip a photo.",
        seoTitle: "Crop, Rotate & Flip Images Online",
        description: "Crop a photo with a live preview. Pick an aspect ratio, zoom and position the frame, then rotate or flip the image before downloading.",
        intake: "image",
        single: true,
        action: "Save cropped image",
        steps: ["Choose a photo and pick the shape of your crop.", "Zoom and position the frame. Rotate or flip the photo as needed.", "Choose an output format and save the cropped copy."],
        faq: ["How do I crop a photo into a square?", "Pick Square, then drag the preview or use the position sliders to frame the part of the photo you want to keep."],
        related: ["resize-image", "compress-image", "convert-image"],
    },
    {
        slug: "split-pdf",
        group: "PDF",
        title: "Split a PDF",
        short: "Make separate PDFs from pages or ranges.",
        seoTitle: "Split PDF by Page, Range or Chunk",
        description: "Split a PDF into individual pages, custom page ranges or parts of a fixed length. Download the new PDFs individually or together in a ZIP.",
        intake: "pdf",
        single: true,
        action: "Split PDF",
        steps: ["Choose a PDF.", "Split by individual page, custom page range or a fixed number of pages.", "Download the parts you need or save all of them in one ZIP."],
        faq: ["Can I get several multi-page PDFs out of one file?", "Yes. Choose Custom ranges and enter 1–3, 4–6, 8, for example. Each comma-separated range becomes its own PDF."],
        related: ["organize-pdf", "merge-pdf", "extract-pdf-text"],
    },
    {
        slug: "extract-pdf-text",
        group: "PDF",
        title: "Extract PDF text",
        short: "Copy or download selectable text.",
        seoTitle: "Extract Selectable Text From a PDF",
        description: "Extract selectable text from all or selected PDF pages. Preview and copy it, or save a single text file or one text file per page.",
        intake: "pdf",
        single: true,
        action: "Extract text",
        steps: ["Choose a PDF that contains selectable text.", "Choose a page range and whether to combine the text.", "Preview, copy or download the extracted text."],
        faq: ["Does this read text in scanned pages?", "This tool extracts text already embedded in a PDF. Image-only scans need optical character recognition (OCR) first."],
        related: ["pdf-to-images", "split-pdf", "organize-pdf"],
    },
    {
        slug: "open-zip",
        group: "File utilities",
        title: "Open a ZIP",
        short: "Browse an archive and extract selected files.",
        seoTitle: "Open ZIP Files & Extract Selected Files",
        description: "Browse the files and folders in a ZIP, filter by name, and download only the entries you select. Selected files can also be packed into a new ZIP.",
        intake: "zip",
        single: true,
        action: "Extract selected files",
        steps: ["Choose a ZIP archive to see its contents.", "Search for the files you need and select them.", "Download the selected files or package them into a new ZIP."],
        faq: ["Which ZIPs can I open?", "PrepMallow opens standard, unencrypted ZIP archives that use Store or Deflate compression. ZIP64 and password-protected entries are unavailable."],
        related: ["create-zip", "rename-files", "check-file"],
    },
];

const updates: Record<string, Partial<Tool>> = {
    "compress-image": {
        description: "Shrink JPG, PNG, WebP and HEIC photos to a size limit such as 50 KB, 100 KB or 200 KB. Set a width, a height or both, and choose a background for transparent areas.",
        related: ["resize-image", "crop-image", "check-file"],
    },
    "resize-image": {
        description: "Resize a photo to exact pixel dimensions or fit it inside a box. Use presets, crop or pad to fit, and keep small images from being enlarged.",
        related: ["crop-image", "compress-image", "convert-image"],
    },
    "convert-image": {
        description: "Convert a batch of HEIC, JPG, PNG, WebP, AVIF, BMP or GIF images to JPG, PNG or WebP. Set the quality and keep or fill transparent areas.",
    },
    "images-to-pdf": {
        description: "Combine photos into a PDF. Set the paper size, margins and photo detail, and arrange one, two or four images on each sheet.",
        steps: ["Add your photos or photographed documents.", "Arrange them in order and choose the paper size, margins and layout.", "Create one PDF and review its pages before sharing."],
        faq: ["Can I put several photos on one PDF page?", "Yes. Choose two or four photos per sheet on a standard paper size. Match each photo uses a separate page for each image."],
    },
    "merge-pdf": {
        description: "Combine PDFs in your chosen order, with optional page ranges per file and blank pages for double-sided printing.",
        steps: ["Select two or more PDFs and arrange them in order.", "Optionally enter a page range for each document.", "Download the combined PDF."],
        related: ["split-pdf", "organize-pdf", "images-to-pdf"],
    },
    "organize-pdf": {
        description: "Preview PDF pages, change their order, rotate pages individually or in bulk, and export only the pages you select.",
        related: ["split-pdf", "merge-pdf", "pdf-to-images"],
    },
    "pdf-to-images": {
        description: "Render all or selected PDF pages as JPG, PNG or WebP. Choose a resolution, quality and filename prefix, then download the images.",
        related: ["extract-pdf-text", "split-pdf", "images-to-pdf"],
    },
    "compress-pdf": {
        description: "Shrink scans and photo-heavy PDFs. Choose the page range and detail, use grayscale if needed, and optionally aim for a maximum file size.",
        related: ["split-pdf", "organize-pdf", "check-file"],
    },
    "watermark-file": {
        description: "Add a visible text watermark to photos or selected PDF pages. Control the placement, text size, color and opacity in your browser.",
        faq: ["Can I watermark a copy for a specific recipient?", "Yes. Enter a note such as “For school registration only,” then choose its position, size and opacity. For PDFs, you can apply it to specific pages."],
    },
    "remove-image-metadata": {
        description: "Create fresh image copies without original EXIF, GPS or camera information. Keep the source format where supported or choose JPG, PNG or WebP.",
    },
    "rename-files": {
        description: "Rename a batch with numbering, prefixes, suffixes or text replacement. Change filename case and preview each name before downloading.",
    },
    "create-zip": {
        description: "Make a ZIP from individual files or a folder. Keep directory paths, choose a compression level and optionally add a top-level folder.",
        steps: ["Choose files or a folder you want to package.", "Name the archive and choose a compression level.", "Download the ZIP and attach it wherever ZIP files are accepted."],
        related: ["open-zip", "rename-files", "check-file"],
    },
    "check-file": {
        description: "Check size, format, image dimensions and PDF page limits before uploading. Generate SHA-256 checksums and download a CSV report.",
        related: ["compress-image", "resize-image", "compress-pdf"],
    },
};

export const homeDescription = "Free tools to crop and compress photos, merge or split PDFs, extract text, check files and open ZIP archives. PrepMallow processes files on your device.";

function upgradeCatalog(tools: Tool[]): Tool[] {
    return tools.map(tool => ({ ...tool, ...updates[tool.slug] })).concat(newTools);
}

export function relatedTools(tool: Tool, tools: Tool[]) {
    const others = tools.filter(item => item.slug !== tool.slug);
    const preferred = (tool.related || []).map(slug => others.find(item => item.slug === slug)).filter(Boolean);
    const remaining = others.filter(item => !preferred.includes(item));
    return preferred.concat(
        remaining.filter(item => item.group === tool.group),
        remaining.filter(item => item.group !== tool.group),
    ).slice(0, 3);
}

export function fileKindLabel(intake: Intake) {
    if (intake === "image") return "photo";
    if (intake === "pdf") return "PDF";
    if (intake === "zip") return "ZIP";
    return "file";
}

export const searchKeywords: Record<string, string> = {
    "crop-image": "flip straighten square portrait landscape",
    "split-pdf": "separate burst cut break into parts",
    "extract-pdf-text": "copy pdf to txt plain text",
    "open-zip": "unzip unarchive extract unpack archive",
    "remove-image-metadata": "privacy remove location gps exif",
    "check-file": "inspect verify checksum sha256 upload limit",
};

export const tools = upgradeCatalog([
  {
    slug: "compress-image", group: "Images", title: "Compress images",
    short: "Fit a photo under a KB limit.",
    seoTitle: "Compress Image to a Target Size in KB",
    description: "Shrink JPG, PNG, WebP and HEIC photos to a maximum file size, such as 50 KB, 100 KB or 200 KB. Set exact pixel dimensions too, and compare the result before downloading.",
    intake: "image", action: "Compress images",
    steps: ["Choose one or more photos.", "Set a maximum size in KB for each photo and pick JPG or WebP.", "Compare the new sizes and save your files."],
    faq: ["Can I get a photo under 100 KB?", "Yes. Set the limit to 100 KB and PrepMallow will check the actual exported size. Allow it to reduce pixel dimensions if your photo cannot reach the limit at its original size."],
  },
  {
    slug: "resize-image", group: "Images", title: "Resize images",
    short: "Get the right pixel dimensions.",
    seoTitle: "Resize Image by Width and Height",
    description: "Resize a photo to exact pixel dimensions or fit it inside a box. Choose centered crop, padding or proportional scaling and export as JPG, PNG or WebP.",
    intake: "image", action: "Resize images",
    steps: ["Add your images.", "Enter a width and height in pixels, then choose how to fit the image.", "Preview and download the resized copies."],
    faq: ["How do I resize a photo without stretching it?", "Fit inside preserves the aspect ratio. Choose padding for an exact canvas size or center crop to fill the entire frame."],
  },
  {
    slug: "convert-image", group: "Images", title: "Convert images",
    short: "Switch between JPG, PNG and WebP.",
    seoTitle: "Convert HEIC, JPG, PNG and WebP Images",
    description: "Convert iPhone HEIC photos and other images to JPG, PNG or WebP in your browser. Convert a batch and download the results together.",
    intake: "image", action: "Convert images",
    steps: ["Choose HEIC, JPG, PNG, WebP, AVIF, BMP or GIF images.", "Pick a format. Use PNG or WebP to keep transparent areas.", "Download converted files individually or together as a ZIP."],
    faq: ["How do I turn an iPhone HEIC photo into a JPG?", "Choose your HEIC file, select JPG as the output format and run the conversion. The original stays on your device."],
  },
  {
    slug: "images-to-pdf", group: "PDF", title: "Photos to PDF",
    short: "Put your photos in a single PDF.",
    seoTitle: "Convert Photos to One PDF",
    description: "Combine JPG, PNG, HEIC and other photos into one PDF. Arrange the photos, pick A4 or US Letter, and set the page orientation and margins.",
    intake: "image", action: "Create PDF",
    steps: ["Add your photos or photographed documents.", "Arrange them in page order. Choose a page size and margins.", "Save a single PDF with one image per page."],
    faq: ["Can I make a PDF from several phone pictures?", "Yes. Add all the photos at once or in batches. Each image becomes a page, in the same order shown in the file list."],
  },
  {
    slug: "merge-pdf", group: "PDF", title: "Merge PDFs",
    short: "Combine PDFs in the order you choose.",
    seoTitle: "Merge PDF Files in Your Browser",
    description: "Combine multiple PDFs into a single PDF. Put the files in order and keep the original page sizes and selectable text.",
    intake: "pdf", action: "Merge PDFs",
    steps: ["Select two or more PDF files.", "Use the arrow buttons or drag the handles to arrange the documents.", "Download the combined PDF."],
    faq: ["Does merging turn PDF pages into pictures?", "PrepMallow copies the PDF pages so ordinary text stays selectable. Review the output if you rely on interactive forms, bookmarks or digital signatures."],
  },
  {
    slug: "organize-pdf", group: "PDF", title: "Organize PDF pages",
    short: "Reorder, rotate and extract pages.",
    seoTitle: "Reorder, Rotate & Extract PDF Pages",
    description: "See page previews, change PDF page order, rotate sideways scans or extract selected pages into a new PDF.",
    intake: "pdf", action: "Save PDF pages", single: true,
    steps: ["Choose a PDF to load the page previews.", "Move pages, rotate them or uncheck the ones you want to leave out.", "Download a PDF containing the pages you kept."],
    faq: ["Can I extract just a few pages from a PDF?", "Yes. Enter a range like 2–4, 7 or select pages individually. The export includes the selected pages in the order shown."],
  },
  {
    slug: "pdf-to-images", group: "PDF", title: "PDF to images",
    short: "Save pages as JPG or PNG.",
    seoTitle: "Convert PDF Pages to JPG or PNG",
    description: "Render all or selected PDF pages as individual JPG or PNG files. Choose a resolution and download them as a ZIP.",
    intake: "pdf", action: "Export images", single: true,
    steps: ["Open a PDF.", "Choose JPG or PNG, a resolution, and the pages you want.", "Save the images individually or in one ZIP."],
    faq: ["What resolution should I choose?", "120 DPI is a good starting point for sharing. Try 200 DPI for small text and finer detail, or 72 DPI for smaller files."],
  },
  {
    slug: "compress-pdf", group: "PDF", title: "Compress scanned PDFs",
    short: "Make scan-heavy PDFs smaller.",
    seoTitle: "Compress Scanned PDFs in Your Browser",
    description: "Reduce the size of PDFs made from scans or photos. Choose image detail and optional grayscale, then compare the new file size.",
    intake: "pdf", action: "Compress PDFs",
    steps: ["Choose a PDF containing scans or photos.", "Select a detail level and optionally use grayscale.", "Check the size and readability of the downloaded PDF."],
    faq: ["What happens to selectable text and links?", "This tool rebuilds each page as an image. The new PDF has a visible copy of each page, with text, links and fields flattened."],
  },
  {
    slug: "watermark-file", group: "File utilities", title: "Add a watermark",
    short: "Stamp a note onto a photo or PDF.",
    seoTitle: "Add a Text Watermark to a PDF or Image",
    description: "Add a visible text watermark to photos and PDF pages. Control its placement, shade and opacity directly in your browser.",
    intake: "visual", action: "Add watermark",
    steps: ["Choose images, PDFs, or both.", "Type a watermark and pick a layout and opacity.", "Review and save the marked copies."],
    faq: ["Can I watermark a copy for a specific recipient?", "Yes. Enter text such as “For school registration only” and choose a diagonal, tiled or bottom placement. The mark is applied to each image or PDF page."],
  },
  {
    slug: "remove-image-metadata", group: "Images", title: "Remove photo metadata",
    short: "Share a copy without embedded GPS.",
    seoTitle: "Remove EXIF and GPS Metadata From Photos",
    description: "Create fresh copies of photos without their original EXIF, GPS and camera information. Review the photo and download a clean copy.",
    intake: "image", action: "Clean photos",
    steps: ["Choose the photos you want to share.", "Create fresh copies from the image pixels.", "Save the cleaned photos and keep the originals separately."],
    faq: ["Which metadata is removed?", "Original EXIF, GPS, IPTC and XMP data are dropped during re-encoding. Your browser may add standard format information such as image density."],
  },
  {
    slug: "rename-files", group: "File utilities", title: "Batch rename files",
    short: "Give a set of files consistent names.",
    seoTitle: "Batch Rename Files Online",
    description: "Rename files with a numbered sequence, an added prefix or a text replacement. Preview the new names and download a ZIP of the renamed copies.",
    intake: "any", action: "Rename copies",
    steps: ["Choose the files to rename.", "Set the naming rule and check the preview.", "Save the renamed copies in a ZIP or download them individually."],
    faq: ["Will it change the files in my folders?", "Your originals keep their names. PrepMallow creates downloads with the new names and preserves the original file extensions."],
  },
  {
    slug: "create-zip", group: "File utilities", title: "Create a ZIP",
    short: "Pack several files into one download.",
    seoTitle: "Create a ZIP File Online",
    description: "Make a standard ZIP archive from photos, PDFs and other files. Select files, give the archive a name and download it directly.",
    intake: "any", action: "Create ZIP",
    steps: ["Choose any files you want to package.", "Name your archive.", "Download the ZIP and attach it wherever ZIP files are accepted."],
    faq: ["Will a ZIP make photos and PDFs much smaller?", "ZIP is useful for packaging many files together. JPEG images and some PDFs are already compressed, so the reduction may be small."],
  },
  {
    slug: "check-file", group: "File utilities", title: "Check file details",
    short: "Verify file size, type and dimensions.",
    seoTitle: "Check File Size, Image Dimensions and PDF Pages",
    description: "Check whether a file fits a size cap, type or exact image dimensions. See image dimensions and PDF page counts without uploading your files.",
    intake: "any", action: "Check files",
    steps: ["Choose the files you plan to send.", "Enter any size, type or pixel requirements you need to check.", "Review the results and fix anything that does not fit."],
    faq: ["Can I check that a photo is under 200 KB and exactly 600 × 600 pixels?", "Yes. Enter 200 as the maximum KB, then enter 600 for the width and height. The results show which requirements the photo meets."],
  },
]);

export const groups: Group[] = ["Images", "PDF", "File utilities"];
export const toolBySlug = (slug: string) => tools.find((tool) => tool.slug === slug);

export const brand = "PrepMallow";
