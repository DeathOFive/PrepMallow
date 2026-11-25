/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, FileText, GripVertical, ImageIcon, LoaderCircle, LockKeyhole, Plus, Sparkles, Upload, X } from "lucide-react";
import { fileKindLabel, type Tool } from "../lib/catalog";
import { android, chooseFiles } from "../android-bridge";
import { accepts, allowsEmpty, fileSize, handoffFiles, kindOf, localGet, localSet, MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES,
  moveItem, pickerAccept, receiveFiles, type Entry, type Output } from "../lib/file-utils";
import { defaultSettings, reusableSettings, type PageEdit, type Settings } from "../lib/settings";
import { renamePreview as plannedNames } from "../lib/file-tools";
import type { RunResult } from "../lib/run-tool";
import { PageOrganizer } from "./page-organizer";
import { Results } from "./results";
import { ToolOptions } from "./tool-options";
import { ArchiveList, BatchOrder, CropPreview, FolderPicker, MergeRanges, useArchiveSelection } from "./workspace-additions";

const formatHelp = {
  image: "JPG, PNG, WebP, HEIC, AVIF, BMP or GIF",
  pdf: "PDF documents",
  zip: "ZIP archives",
  visual: "Photos and PDF documents",
  any: "Any file type",
};

function EntryThumbnail({ entry }: { entry: Entry }) {
  const [url, setUrl] = useState("");
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (entry.kind !== "image" || /\.hei[cf]$/i.test(entry.file.name) || entry.file.type === "image/svg+xml") return;
    const objectUrl = URL.createObjectURL(entry.file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [entry]);
  return <span className={"entry-thumbnail " + (entry.kind === "pdf" ? "pdf-color" : "image-color")}>
    {url && !broken ? <img src={url} alt="" onError={() => setBroken(true)} /> :
      entry.kind === "image" ? <ImageIcon size={18} /> : <FileText size={18} />}
  </span>;
}

function startingSettings(slug: string): Settings {
  if (slug === "pdf-to-images") return { ...defaultSettings, format: "image/png", quality: "90" };
  if (slug === "remove-image-metadata") return { ...defaultSettings, format: "original", quality: "94" };
  return { ...defaultSettings };
}

export function Workbench({ tool }: { tool: Tool }) {
  const { slug } = tool;
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const resultsAnchor = useRef<HTMLDivElement>(null);
  const [interactive, setInteractive] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [settings, setSettings] = useState(() => startingSettings(slug));
  const [pages, setPages] = useState<PageEdit[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [pageError, setPageError] = useState("");
  const [previewError, setPreviewError] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [pickingFiles, setPickingFiles] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [fileMessages, setFileMessages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const reuse = reusableSettings[slug];
  const fileLabel = fileKindLabel(tool.intake);
  const archive = useArchiveSelection(slug === "open-zip" ? entries[0]?.file : undefined);

  const addFiles = useCallback((newFiles: File[]) => {
    if (!newFiles.length || controller.current) return;
    const next = tool.single ? [] : [...entries];
    const messages: string[] = [];
    let bytes = next.reduce((sum, entry) => sum + entry.file.size, 0);
    for (const file of newFiles) {
      const kind = kindOf(file);
      if (!accepts(tool.intake, kind)) {
        messages.push(file.name + " · Choose a supported " + fileLabel + ".");
      } else if ((file.size === 0 && !allowsEmpty(slug)) || file.size > MAX_FILE_BYTES) {
        messages.push(file.name + " · Choose a " + (allowsEmpty(slug) ? "" : "non-empty ") + "file up to 80 MB.");
      } else if (next.length >= (tool.single ? 1 : MAX_FILES) || bytes + file.size > MAX_TOTAL_BYTES) {
        messages.push(tool.single ? "This tool opens one " + fileLabel + " at a time." : "Choose up to 40 files and 160 MB total.");
        break;
      } else {
        next.push({ file, kind, id: globalThis.crypto?.randomUUID?.() ?? (Date.now() + "-" + Math.random()) });
        bytes += file.size;
      }
    }
    if (!tool.single || next.length) {
      setEntries(next);
      setResult(null);
    }
    setError("");
    setStatus("");
    setFileMessages(messages);
  }, [entries, fileLabel, slug, tool.intake, tool.single]);

  useEffect(() => { setInteractive(true); }, []);

  useEffect(() => {
    const incoming = receiveFiles(slug);
    if (incoming.length) addFiles(incoming);
  }, [addFiles, slug]);

  useEffect(() => {
    if (!reuse) return;
    const saved = localGet("settings:" + slug);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      const restored = startingSettings(slug);
      for (const key of reuse) {
        if (typeof parsed[key] === typeof restored[key]) Object.assign(restored, { [key]: parsed[key] });
      }
      setSettings(restored);
      setRemember(true);
    } catch { /* use defaults if stored settings cannot be read */ }
  }, [reuse, slug]);

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const pasted = Array.from(event.clipboardData?.files || []).filter((file) => accepts(tool.intake, kindOf(file)));
      if (pasted.length && !controller.current) { event.preventDefault(); addFiles(pasted); }
    };
    const preventFileNavigation = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    window.addEventListener("paste", paste);
    window.addEventListener("dragover", preventFileNavigation);
    window.addEventListener("drop", preventFileNavigation);
    return () => {
      window.removeEventListener("paste", paste);
      window.removeEventListener("dragover", preventFileNavigation);
      window.removeEventListener("drop", preventFileNavigation);
    };
  }, [addFiles, tool.intake]);

  const documentEntry = slug === "organize-pdf" ? entries[0] : undefined;
  useEffect(() => {
    if (!documentEntry) return;
    const preparation = new AbortController();
    setPages([]);
    setPageError("");
    setPreviewError(false);
    setLoadingPages(true);
    const load = async () => {
      try {
        const { MAX_ORGANIZE_PAGES, pdfPageCount, pageThumbnails } = await import("../lib/pdfs");
        const count = await pdfPageCount(documentEntry.file);
        if (preparation.signal.aborted) return;
        if (!count || count > MAX_ORGANIZE_PAGES) throw new Error("Choose a PDF with 1 to 100 pages to organize.");
        setPages(Array.from({ length: count }, (_, index) => ({ index, keep: true, rotation: 0 })));
        setLoadingPages(false);
        await pageThumbnails(documentEntry.file, (index, thumb) => {
          if (preparation.signal.aborted) return;
          setPages((current) => current.map((page) => page.index === index ? { ...page, thumb } : page));
        }, preparation.signal).catch(() => { if (!preparation.signal.aborted) setPreviewError(true); });
      } catch (error) {
        if (!preparation.signal.aborted) setPageError((error as Error).message);
      } finally {
        if (!preparation.signal.aborted) setLoadingPages(false);
      }
    };
    void load();
    return () => preparation.abort();
  }, [documentEntry]);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (result) resultsAnchor.current?.scrollIntoView({ block: "nearest" }); }, [result]);

  function saveSettings(next: Settings, shouldRemember: boolean) {
    if (!reuse) return;
    localSet("settings:" + slug, shouldRemember ? JSON.stringify(Object.fromEntries(reuse.map((key) => [key, next[key]]))) : null);
  }

  function updateSettings(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next, remember);
    setResult(null);
    setError("");
    setStatus("");
  }

  function changeEntries(next: Entry[]) {
    if (controller.current) return;
    setEntries(next);
    setFileMessages([]);
    setError("");
    setStatus("");
    setResult(null);
    if (!next.length) { setPages([]); setPageError(""); }
    if (slug === "merge-pdf") {
      setSettings(current => ({
        ...current,
        mergeRanges: Object.fromEntries(next.filter(entry => current.mergeRanges[entry.id]).map(entry => [entry.id, current.mergeRanges[entry.id]])),
      }));
    }
  }

  async function openPicker(folder = false) {
    if (!android) { picker.current?.click(); return; }
    setPickingFiles(true);
    try {
      const selection = await chooseFiles(tool.intake, !tool.single, folder);
      if (selection.files.length) addFiles(selection.files);
      if (selection.warnings.length) setFileMessages(messages => [...messages, ...selection.warnings]);
    } finally { setPickingFiles(false); }
  }

  async function useSample() {
    setLoadingSample(true);
    try {
      const { sampleFiles } = await import("../lib/samples");
      addFiles(await sampleFiles(tool));
    } catch { setError("The sample could not load. Choose a file from your device."); }
    finally { setLoadingSample(false); }
  }

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (controller.current || !ready) return;
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setResult(null);
    setError("");
    setStatus("Preparing your files");
    try {
      const { runTool } = await import("../lib/run-tool");
      const response = await runTool(slug, entries, settings, pages, setStatus, current.signal, archive.selection);
      current.signal.throwIfAborted();
      setResult(response);
      setStatus(response.items.length ? "Done" : "Check the results for details");
    } catch (error) {
      if (current.signal.aborted) setStatus("Stopped. Your files are still here.");
      else {
        setError(error instanceof Error ? error.message : "Could not finish. Try a smaller batch.");
        setStatus("");
      }
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }

  function handoff(next: string, items: Output[]) {
    handoffFiles(next, items.flatMap((item) => item.blob ? [new File([item.blob], item.name, { type: item.blob.type })] : []));
    router.push("/tools/" + next);
  }

  const renamePreview = slug === "rename-files" ? plannedNames(entries, settings) : [];
  const ready = entries.length > 0 && !loadingSample && !pickingFiles && !busy
    && (slug !== "merge-pdf" || entries.length >= 2)
    && (slug !== "organize-pdf" || (!loadingPages && !pageError && pages.some((page) => page.keep)))
    && (slug !== "open-zip" || archive.selection.length > 0);

  return <section className="workspace" aria-label={tool.title + " workspace"}>
    <form className="work-grid" onSubmit={run}>
      <div className="work-files">
        <div className="work-label"><span className="step-badge">01</span><h2>Your files</h2>{entries.length > 0 &&
          <button className="link-button clear-files" type="button" disabled={busy} onClick={() => changeEntries([])}>Clear all</button>}</div>
        <div className={"file-drop" + (dragging ? " drag-active" : "") + (entries.length ? " file-drop-small" : "")}
          onDragOver={(event) => { if (!busy && event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragging(true); } }}
          onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setDragging(false); }}
          onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) addFiles(Array.from(event.dataTransfer.files)); }}>
          <input ref={picker} type="file" hidden accept={pickerAccept[tool.intake]}
            multiple={!tool.single} disabled={!interactive || busy || loadingSample}
            onChange={(event) => { addFiles(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ""; }} />
          {entries.length === 0 ? <>
            <span className="upload-icon"><Upload size={24} /></span>
            <h3>{pickingFiles ? "Opening files…" : tool.single ? "Add a " + fileLabel : "Add files"}</h3>
            <p>{formatHelp[tool.intake]}</p>
            <button type="button" className="button button-dark" disabled={!interactive || loadingSample || pickingFiles} onClick={() => openPicker()}>
              Choose {tool.single ? fileLabel : "files"} <Plus size={17} />
            </button>
            <button className="link-button sample-button" type="button" disabled={!interactive || loadingSample || pickingFiles} onClick={useSample}>
              {loadingSample ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />} {loadingSample ? "Loading sample…" : "Try a sample"}
            </button>
          </> : <button type="button" className="link-button" disabled={busy || pickingFiles} onClick={() => openPicker()}>
            <Plus size={17} /> {tool.single ? "Choose a different " + fileLabel : "Add more files"}
          </button>}
        </div>
        <p className="workspace-limit">{tool.single ? "One " + fileLabel + ", up to 80 MB" : "Up to 40 files · 80 MB per file · 160 MB total"}</p>
        {slug === "create-zip" && <FolderPicker disabled={!interactive || busy || loadingSample || pickingFiles}
          onFiles={addFiles} onChooseFolder={android ? () => openPicker(true) : undefined} />}
        {fileMessages.length > 0 && <ul className="notice notice-error upload-messages" role="alert">{fileMessages.map((message, i) => <li key={i}>{message}</li>)}</ul>}
        {entries.length > 0 && <ul className="entries" aria-label="Selected files">
          {entries.map((entry, index) => <li key={entry.id} className="entry"
            onDragOver={(event) => { if (!busy && event.dataTransfer.types.includes("application/x-prepmallow-entry")) event.preventDefault(); }}
            onDrop={(event) => {
              if (busy || !event.dataTransfer.types.includes("application/x-prepmallow-entry")) return;
              event.preventDefault();
              const from = entries.findIndex((item) => item.id === event.dataTransfer.getData("application/x-prepmallow-entry"));
              changeEntries(moveItem(entries, from, index));
            }}>
            {entries.length > 1 && <span className="entry-grip" draggable={!busy} aria-hidden="true" title="Drag to reorder"
              onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-prepmallow-entry", entry.id); }}>
              <GripVertical size={17} />
            </span>}
            <EntryThumbnail entry={entry} />
            <span className="entry-name"><strong title={entry.file.webkitRelativePath || entry.file.name}>{entry.file.webkitRelativePath || entry.file.name}</strong>
              <small>{fileSize(entry.file.size)}{renamePreview[index] && " → " + renamePreview[index]}</small>
            </span>
            {entries.length > 1 && <div className="entry-order">
              <button className="icon-button" type="button" disabled={busy || index === 0} aria-label={"Move " + entry.file.name + " up"} onClick={() => changeEntries(moveItem(entries, index, index - 1))}><ArrowUp size={16} /></button>
              <button className="icon-button" type="button" disabled={busy || index === entries.length - 1} aria-label={"Move " + entry.file.name + " down"} onClick={() => changeEntries(moveItem(entries, index, index + 1))}><ArrowDown size={16} /></button>
            </div>}
            <button className="icon-button" type="button" disabled={busy} aria-label={"Remove " + entry.file.name} onClick={() => changeEntries(entries.filter((item) => item.id !== entry.id))}><X size={17} /></button>
          </li>)}
        </ul>}
        {entries.length > 1 && <BatchOrder entries={entries} busy={busy} onChange={changeEntries} />}
        {slug === "merge-pdf" && entries.length === 1 && <p className="field-note">Add one more PDF to combine the documents.</p>}
        {slug === "merge-pdf" && entries.length > 0 && <MergeRanges entries={entries} settings={settings} busy={busy} update={updateSettings} />}
        {slug === "open-zip" && entries[0] && <ArchiveList key={entries[0].id} archive={archive} busy={busy}
          onChange={selection => { archive.update(selection); updateSettings({}); }} />}
        {slug === "crop-image" && entries[0] && <CropPreview key={entries[0].id} file={entries[0].file} settings={settings} busy={busy} update={updateSettings} />}
        {documentEntry && loadingPages && <p className="field-note" role="status"><LoaderCircle size={16} className="spin" /> Reading pages…</p>}
        {documentEntry && pageError && <p className="notice notice-error" role="alert">{pageError}</p>}
        {documentEntry && previewError && <p className="notice">Thumbnails could not load. You can still edit pages by number.</p>}
        {documentEntry && pages.length > 0 && <PageOrganizer key={documentEntry.id} pages={pages} busy={busy}
          onChange={(update) => { setPages(update); setResult(null); setError(""); setStatus(""); }} />}
      </div>

      <div className="work-options">
        <div className="work-label"><span className="step-badge">02</span><h2>Settings</h2></div>
        <fieldset className="option-fields" disabled={busy} aria-label="Output settings">
          <ToolOptions slug={slug} settings={settings} update={updateSettings} />
          {reuse && <label className="check-setting remember-setting">
            <input type="checkbox" checked={remember} onChange={(event) => { setRemember(event.target.checked); saveSettings(settings, event.target.checked); }} />
            <span>Remember settings on this device</span>
          </label>}
        </fieldset>
        <div className="run-panel">
          <button className="button button-primary run-button" type="submit" disabled={!ready}>
            {busy ? <><LoaderCircle size={18} className="spin" /> Working…</> : <>{tool.action} <ArrowRight size={18} /></>}
          </button>
          <p className="run-privacy"><LockKeyhole size={14} /> Runs on your device</p>
          {status && <p className="work-status" role="status">{status}</p>}
          {busy && <button className="link-button cancel-button" type="button" onClick={() => controller.current?.abort()}>Stop processing</button>}
        </div>
        {error && <p className="notice notice-error" role="alert">{error}</p>}
      </div>
    </form>
    <div ref={resultsAnchor}>{result && <Results slug={slug} result={result} onHandoff={handoff} />}</div>
  </section>;
}
