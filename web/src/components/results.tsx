/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Download, Eye, Files, Info, LoaderCircle, Share2 } from "lucide-react";
import { fileSize, type Output } from "../lib/file-utils";
import { android, exportBlob, type ExportAction } from "../android-bridge";
import { FileDialog } from "./file-dialog";
import { TextResultActions } from "./workspace-additions";
import { checkReport } from "../lib/file-tools";
import type { RunResult } from "../lib/run-tool";

function useImageUrl(blob?: Blob) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob?.type.startsWith("image/")) { setUrl(""); return; }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

function ExportButtons({ blob, name, label = "Save", share = true }: {
  blob: Blob; name: string; label?: string; share?: boolean;
}) {
  const [working, setWorking] = useState<ExportAction>();
  const [error, setError] = useState("");
  async function send(action: ExportAction) {
    setWorking(action);
    setError("");
    try { await exportBlob(blob, name, action); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Could not export this file."); }
    finally { setWorking(undefined); }
  }
  return <>
    <button className="button button-outline button-small" type="button" aria-label={label + " " + name}
      disabled={!!working} onClick={() => send("save")}>
      {working === "save" ? <LoaderCircle className="spin" size={17} /> : <Download size={17} />}{label}
    </button>
    {android && share && <button className="button button-outline button-small" type="button" aria-label={"Share " + name}
      disabled={!!working} onClick={() => send("share")}>
      {working === "share" ? <LoaderCircle className="spin" size={17} /> : <Share2 size={17} />}Share
    </button>}
    {error && <p className="notice notice-error" role="alert">{error}</p>}
  </>;
}

function PdfPreview({ blob, name }: { blob: Blob; name: string }) {
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<{ source: string; total: number }>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    async function render() {
      setLoading(true);
      setError("");
      try {
        const { withPdf, rasterPage } = await import("../lib/pdfs");
        const file = new File([blob], name, { type: "application/pdf" });
        await withPdf(file, signal, async pdf => {
          const pdfPage = await pdf.getPage(page + 1);
          const { canvas } = await rasterPage(pdfPage, 110, 1600, signal);
          try {
            const source = canvas.toDataURL("image/jpeg", .82);
            if (!signal.aborted) setPreview({ source, total: pdf.numPages });
          } finally {
            canvas.width = 1;
            pdfPage.cleanup();
          }
        });
      } catch (problem) {
        if (!signal.aborted) setError(problem instanceof Error ? problem.message : "Could not preview this PDF.");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
    void render();
    return () => controller.abort();
  }, [blob, name, page]);

  return <>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {loading && <p className="field-note" role="status">Rendering page…</p>}
    {!loading && !error && preview && <img className="app-preview-page" src={preview.source} alt={"PDF page " + (page + 1)} />}
    {preview && preview.total > 1 && <div className="app-preview-pages">
      <button className="button button-outline button-small" type="button" disabled={loading || page === 0}
        aria-label="Previous page" onClick={() => setPage(page - 1)}><ArrowLeft size={17} /></button>
      <span>{page + 1} / {preview.total}</span>
      <button className="button button-outline button-small" type="button" disabled={loading || page + 1 >= preview.total}
        aria-label="Next page" onClick={() => setPage(page + 1)}><ArrowRight size={17} /></button>
    </div>}
  </>;
}

function OutputItem({ item }: { item: Output }) {
  const imageUrl = useImageUrl(item.blob);
  const [preview, setPreview] = useState(false);
  const blob = item.blob;
  const isPdf = blob?.type === "application/pdf";
  const saving = blob && item.originalBytes ? Math.round((1 - blob.size / item.originalBytes) * 100) : 0;

  return <article className="result-item">
    <div className="result-main">
      <div className="result-thumb">{imageUrl ? <img src={imageUrl} alt="" /> : item.facts ? <Info size={21} /> : <Files size={21} />}</div>
      <div className="result-info">
        <h3 title={item.name}>{item.name}</h3>
        {blob && <p>
          {item.originalBytes ? fileSize(item.originalBytes) + " → " : ""}{fileSize(blob.size)}
          {item.detail ? " · " + item.detail : ""}
          {saving > 0 && <span className="saving-badge">{saving}% smaller</span>}
        </p>}
        {item.originalName && <p>From {item.originalName}</p>}
      </div>
      {blob && <div className="result-actions">
        {(imageUrl || isPdf) && <button className="icon-button" aria-label={"Preview " + item.name}
          type="button" onClick={() => setPreview(true)}><Eye size={19} /></button>}
        <ExportButtons blob={blob} name={item.name} />
      </div>}
      {item.verdict && <span className={"verdict " + item.verdict}>{item.verdict === "pass" ? "Meets requirements" : "Needs review"}</span>}
    </div>
    {item.textPreview && blob && <TextResultActions item={item} Dialog={FileDialog} />}
    {item.facts && <dl className="result-facts">{item.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {item.warning && <p className="result-warning"><Info size={15} /> {item.warning}</p>}
    {preview && blob && <FileDialog label={"Preview " + item.name} onClose={() => setPreview(false)}>
      <h2 className="preview-title">{item.name}</h2>
      {isPdf ? <PdfPreview blob={blob} name={item.name} /> :
        <img className="preview-image" src={imageUrl} alt={"Output preview of " + item.name} />}
    </FileDialog>}
  </article>;
}

export function Results({ result, slug, onHandoff }: {
  result: RunResult; slug: string; onHandoff: (slug: string, items: Output[]) => void;
}) {
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState("");
  const downloads = result.items.filter((item): item is Output & { blob: Blob } => !!item.blob);

  async function saveAll() {
    setZipping(true);
    setZipError("");
    try {
      const { packArchive } = await import("../lib/archives");
      await exportBlob(await packArchive(downloads), "prepmallow-" + slug + ".zip", "save");
    } catch (error) { setZipError((error as Error).message); }
    finally { setZipping(false); }
  }

  return <section className="result-section" aria-label="Results">
    <div className="results-head">
      <h2>{result.items.length ? slug === "check-file" ? "File check complete" : "Ready to save" : "Files need attention"}</h2>
      {slug === "check-file" && result.items.length > 0 && <ExportButtons blob={checkReport(result)}
        name="prepmallow-file-report.csv" label="Save CSV" share={false} />}
      {(downloads.length > 1 || (slug === "open-zip" && downloads.length > 0)) && <button className="button button-dark" type="button" disabled={zipping} onClick={saveAll}>
        {zipping ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />} {zipping ? "Packing…" : "Save all as ZIP"}
      </button>}
    </div>
    {zipError && <p className="notice notice-error" role="alert">{zipError}</p>}
    {result.errors.length > 0 && <div className="notice notice-error" role="alert"><strong>Some files could not be processed.</strong>
      <ul>{result.errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
    <div className="result-list">{result.items.map((item, i) => <OutputItem key={i + ":" + item.name} item={item} />)}</div>
    {downloads.length > 0 && <div className="result-next">
      <button className="link-button" type="button" onClick={() => onHandoff("check-file", downloads)}>Check output requirements <ArrowUpRight size={15} /></button>
      {slug === "create-zip" && <button className="link-button" type="button" onClick={() => onHandoff("open-zip", downloads)}>Open this ZIP <ArrowRight size={15} /></button>}
      {downloads.length === 1 && downloads[0].blob.type === "application/pdf" && slug !== "organize-pdf" &&
        <button className="link-button" type="button" onClick={() => onHandoff("organize-pdf", downloads)}>Organize PDF pages <ArrowRight size={15} /></button>}
      {downloads.every(({ blob }) => blob.type.startsWith("image/")) && slug !== "images-to-pdf" &&
        <button className="link-button" type="button" onClick={() => onHandoff("images-to-pdf", downloads)}>Use in Photos to PDF <ArrowRight size={15} /></button>}
    </div>}
  </section>;
}
