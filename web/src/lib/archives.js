/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { MAX_FILES as maxFiles, MAX_FILE_BYTES as maxFileBytes, MAX_TOTAL_BYTES as maxTotalBytes, nameParts, safeName } from "./file-utils";

const mime = "application/zip";
const decoder = new TextDecoder("utf-8", { fatal: true });
const cp437 = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    return value;
});

function updateCrc(crc, bytes) {
    for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
    return crc;
}

function archiveError() {
    return new Error("Could not read this ZIP. Choose a complete, standard ZIP archive.");
}

function leafName(name) {
    const [stem, extension] = nameParts(name);
    const base = safeName(stem);
    return (base === "__proto__" ? "_file" : base) + (extension ? "." + safeName(extension.slice(1), "file") : "");
}

function safePath(path) {
    const parts = path.split("/").filter(part => part && part !== "." && part !== "..");
    const leaf = leafName(parts.pop() || "file");
    return parts.map(part => safeName(part)).concat(leaf).join("/");
}

function uniquePaths(paths) {
    const sanitized = paths.map(safePath);
    const taken = new Set();
    for (const path of sanitized) {
        for (let slash = path.indexOf("/"); slash !== -1; slash = path.indexOf("/", slash + 1)) {
            taken.add(path.slice(0, slash).toLowerCase());
        }
    }
    return sanitized.map(path => {
        const slash = path.lastIndexOf("/") + 1;
        const directory = path.slice(0, slash);
        const [stem, suffix] = nameParts(path.slice(slash));
        let candidate = path;
        for (let counter = 2; taken.has(candidate.toLowerCase()); counter++) {
            candidate = directory + stem + "-" + counter + suffix;
        }
        taken.add(candidate.toLowerCase());
        return candidate;
    });
}

export async function packArchive(items, signal, level = 3) {
    if (!items.length) throw new Error("Choose at least one file to pack.");
    if (items.reduce((total, item) => total + item.blob.size, 0) > maxTotalBytes) {
        throw new Error("The combined files exceed the 160 MB ZIP limit. Download smaller batches.");
    }
    const { zip } = await import("fflate");
    const entries = Object.create(null);
    const paths = uniquePaths(items.map(item => item.archivePath || item.name));
    for (const [index, item] of items.entries()) {
        signal?.throwIfAborted();
        entries[paths[index]] = new Uint8Array(await item.blob.arrayBuffer());
    }
    signal?.throwIfAborted();
    return new Promise((resolve, reject) => {
        const stop = zip(entries, { level }, (error, bytes) => {
            signal?.removeEventListener("abort", onAbort);
            if (error) reject(error);
            else resolve(new Blob([bytes], { type: mime }));
        });
        function onAbort() {
            stop();
            reject(signal.reason);
        }
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}

export async function createArchive(entries, settings, progress, signal) {
    progress("Packing your files");
    const folder = settings.zipFolder.trim() ? safeName(settings.zipFolder) + "/" : "";
    const items = entries.map(({ file }) => ({
        blob: file,
        archivePath: folder + (file.webkitRelativePath || file.name),
    }));
    const blob = await packArchive(items, signal, Number(settings.zipLevel));
    const name = safeName(settings.filename.trim().replace(/\.zip$/i, ""), "prepmallow-files") + ".zip";
    return { name, blob, detail: entries.length + (entries.length === 1 ? " file" : " files") };
}

export async function sampleArchive() {
    const items = [
        { name: "read-me.txt", blob: new Blob(["PrepMallow sample ZIP.\n"]) },
        { archivePath: "notes/checklist.txt", blob: new Blob(["Choose files and download the selected copies.\n"]) },
        { archivePath: "notes/ideas.txt", blob: new Blob(["Try the other PrepMallow tools too.\n"]) },
    ];
    return new File([await packArchive(items)], "sample-files.zip", { type: mime });
}

function endOfDirectory(tail) {
    for (let offset = tail.byteLength - 22; offset >= 0; offset--) {
        if (tail.getUint32(offset, true) === 0x06054b50 && offset + 22 + tail.getUint16(offset + 20, true) === tail.byteLength) {
            return offset;
        }
    }
    throw archiveError();
}

function decodedName(bytes, extra, utf8) {
    if (utf8) {
        try {
            return decoder.decode(bytes);
        } catch {
            return "";
        }
    }
    for (let offset = 0; offset + 4 <= extra.byteLength;) {
        const type = extra.getUint16(offset, true);
        const length = extra.getUint16(offset + 2, true);
        const start = offset + 4;
        if (start + length > extra.byteLength) break;
        if (type === 0x7075 && length >= 5 && extra.getUint8(start) === 1
            && extra.getUint32(start + 1, true) === ((updateCrc(0xffffffff, bytes) ^ 0xffffffff) >>> 0)) {
            try {
                return decoder.decode(new Uint8Array(extra.buffer, extra.byteOffset + start + 5, length - 5));
            } catch {
                break;
            }
        }
        offset = start + length;
    }
    return Array.from(bytes, byte => byte < 128 ? String.fromCharCode(byte) : cp437[byte - 128]).join("");
}

function unsafePath(path) {
    return !path || /^[A-Za-z]:/.test(path) || /[\\\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(path)
        || path.split("/").some(part => !part || part === "." || part === "..");
}

export async function readArchive(file, signal) {
    const tailStart = Math.max(0, file.size - 65_557);
    const tail = new DataView(await file.slice(tailStart).arrayBuffer());
    signal?.throwIfAborted();
    const end = endOfDirectory(tail);
    const disk = tail.getUint16(end + 4, true);
    const directoryDisk = tail.getUint16(end + 6, true);
    const localCount = tail.getUint16(end + 8, true);
    const count = tail.getUint16(end + 10, true);
    const size = tail.getUint32(end + 12, true);
    const offset = tail.getUint32(end + 16, true);
    if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff
        || (end >= 20 && tail.getUint32(end - 20, true) === 0x07064b50)) {
        throw new Error("ZIP64 archives are unavailable in this browser tool.");
    }
    if (disk || directoryDisk || localCount !== count) throw new Error("Choose a ZIP stored as a single file.");
    if (count > 1000 || size > 8_000_000) throw new Error("Choose a ZIP with up to 1,000 entries and a smaller directory.");
    if (offset + size > tailStart + end) throw archiveError();
    const central = new DataView(await file.slice(offset, offset + size).arrayBuffer());
    signal?.throwIfAborted();
    const entries = [];
    for (let id = 0, position = 0; id < count; id++) {
        if (position + 46 > size || central.getUint32(position, true) !== 0x02014b50) throw archiveError();
        const host = central.getUint8(position + 5);
        const flags = central.getUint16(position + 8, true);
        const method = central.getUint16(position + 10, true);
        const crc = central.getUint32(position + 16, true);
        const packed = central.getUint32(position + 20, true);
        const unpacked = central.getUint32(position + 24, true);
        const nameLength = central.getUint16(position + 28, true);
        const extraLength = central.getUint16(position + 30, true);
        const commentLength = central.getUint16(position + 32, true);
        const entryDisk = central.getUint16(position + 34, true);
        const attributes = central.getUint32(position + 38, true);
        const localOffset = central.getUint32(position + 42, true);
        const start = position + 46;
        const next = start + nameLength + extraLength + commentLength;
        if (next > size) throw archiveError();
        const path = decodedName(new Uint8Array(central.buffer, start, nameLength),
            new DataView(central.buffer, start + nameLength, extraLength), Boolean(flags & 0x800));
        position = next;
        const unixType = host === 3 || host === 19 ? (attributes >>> 16) & 0xf000 : 0;
        if (path.endsWith("/") || attributes & 0x10 || unixType === 0x4000) continue;
        let unavailable = "";
        if (unsafePath(path)) unavailable = "Invalid filename or path";
        else if (unixType && unixType !== 0x8000) unavailable = "Special file";
        else if (flags & 0x2041) unavailable = "Password-protected";
        else if (method !== 0 && method !== 8) unavailable = "Unsupported compression";
        else if (entryDisk || packed === 0xffffffff || unpacked === 0xffffffff || localOffset === 0xffffffff) unavailable = "Unsupported ZIP record";
        else if (unpacked > maxFileBytes) unavailable = "Over 80 MB";
        else if (localOffset + 30 + packed > offset || (method === 0 && packed !== unpacked)) unavailable = "Invalid entry";
        entries.push({ id, path: path || "Unnamed entry", crc, method, packed, unpacked, localOffset, directoryOffset: offset, unavailable });
    }
    return entries;
}

async function unpackEntry(file, entry, signal) {
    const local = new DataView(await file.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer());
    if (local.getUint32(0, true) !== 0x04034b50 || local.getUint16(8, true) !== entry.method || local.getUint16(6, true) & 0x2041) {
        throw archiveError();
    }
    const start = entry.localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
    const end = start + entry.packed;
    if (end > entry.directoryOffset) throw archiveError();
    const chunks = [];
    let unpacked = 0;
    let crc = 0xffffffff;
    function collect(bytes) {
        unpacked += bytes.byteLength;
        if (unpacked > entry.unpacked) throw new Error("The file exceeds its declared size.");
        crc = updateCrc(crc, bytes);
        if (bytes.length) chunks.push(bytes);
    }
    let inflater;
    if (entry.method === 8) {
        const { Inflate } = await import("fflate");
        inflater = new Inflate(collect);
    }
    const step = inflater ? 16_384 : 262_144;
    for (let offset = start; offset < end; offset += step) {
        signal.throwIfAborted();
        const next = Math.min(end, offset + step);
        const bytes = new Uint8Array(await file.slice(offset, next).arrayBuffer());
        if (inflater) inflater.push(bytes, next === end);
        else collect(bytes);
        if (inflater && (offset - start) % (step * 64) === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (unpacked !== entry.unpacked || ((crc ^ 0xffffffff) >>> 0) !== entry.crc || (inflater && !entry.packed)) {
        throw new Error("The ZIP entry is incomplete or failed its checksum.");
    }
    return new Blob(chunks, { type: "application/octet-stream" });
}

export async function extractArchive(file, selected, progress, signal) {
    if (!selected?.length) throw new Error("Select at least one file from the archive.");
    if (selected.length > maxFiles || selected.reduce((total, entry) => total + entry.unpacked, 0) > maxTotalBytes) {
        throw new Error("Select up to 40 files and 160 MB of extracted data.");
    }
    const items = [];
    const errors = [];
    for (const [index, entry] of selected.entries()) {
        signal.throwIfAborted();
        progress("Extracting file " + (index + 1) + " of " + selected.length);
        if (entry.unavailable) {
            errors.push(entry.path + " · " + entry.unavailable);
            continue;
        }
        try {
            const blob = await unpackEntry(file, entry, signal);
            items.push({ name: leafName(entry.path.split("/").at(-1)), blob, archivePath: safePath(entry.path), detail: entry.path });
        } catch (error) {
            signal.throwIfAborted();
            errors.push(entry.path + " · " + error.message);
        }
    }
    return { items, errors };
}
