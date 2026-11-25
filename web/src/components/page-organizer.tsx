/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, FileText, GripVertical, RotateCw } from "lucide-react";
import { moveItem, pageSelection } from "../lib/file-utils";
import type { PageEdit } from "../lib/settings";
import { PageOrder } from "./workspace-additions";

export function PageOrganizer({ pages, onChange, busy }: { pages: PageEdit[]; onChange: (update: (current: PageEdit[]) => PageEdit[]) => void; busy: boolean }) {
  const [range, setRange] = useState("");
  const [rangeError, setRangeError] = useState("");
  const kept = pages.filter((page) => page.keep).length;

  function edit(index: number, patch: Partial<PageEdit>) {
    if (!busy) onChange((current) => current.map((page) => page.index === index ? { ...page, ...patch } : page));
  }

  function movePage(index: number, direction: -1 | 1) {
    onChange((current) => {
      const from = current.findIndex((page) => page.index === index);
      return moveItem(current, from, from + direction);
    });
  }

  function rotatePage(index: number) {
    onChange((current) => current.map((page) =>
      page.index === index ? { ...page, rotation: (page.rotation + 90) % 360 } : page));
  }

  function applyRange() {
    try {
      const selected = new Set(pageSelection(range, pages.length));
      onChange((current) => current.map((page) => ({ ...page, keep: selected.has(page.index) })));
      setRangeError("");
    } catch (error) { setRangeError((error as Error).message); }
  }

  return <section className="page-organizer" aria-label="Edit PDF pages">
    <div className="page-organizer-title"><h3>Page order</h3><span>{kept} of {pages.length} kept</span></div>
    <div className="page-range">
      <label className="sr-only" htmlFor="page-range">Pages to keep</label>
      <input id="page-range" value={range} disabled={busy} placeholder="Keep pages, e.g. 2–4, 7"
        onChange={(event) => setRange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyRange(); } }} />
      <button className="button button-outline button-small" type="button" disabled={busy} onClick={applyRange}>Select pages</button>
      <button className="link-button" type="button" disabled={busy} onClick={() => { setRange(""); setRangeError(""); onChange((current) => current.map((page) => ({ ...page, keep: true }))); }}>Keep all</button>
    </div>
    {rangeError && <p className="notice notice-error" role="alert">{rangeError}</p>}
    <PageOrder pages={pages} onChange={onChange} busy={busy} />
    <div className="pdf-page-grid">
      {pages.map((page, position) => <article className={"pdf-page" + (page.keep ? "" : " page-excluded")} key={page.index}
        onDragOver={(event) => { if (!busy && event.dataTransfer.types.includes("application/x-prepmallow-page")) event.preventDefault(); }}
        onDrop={(event) => {
          if (busy || !event.dataTransfer.types.includes("application/x-prepmallow-page")) return;
          event.preventDefault();
          const index = Number(event.dataTransfer.getData("application/x-prepmallow-page"));
          onChange((current) => moveItem(current, current.findIndex((candidate) => candidate.index === index), current.findIndex((candidate) => candidate.index === page.index)));
        }}>
        <div className="page-art">
          {page.thumb ? <img src={page.thumb} alt="" style={{ transform: "rotate(" + page.rotation + "deg) scale(" + (page.rotation % 180 ? ".83" : "1") + ")" }} />
            : <FileText size={34} aria-hidden="true" />}
          <span className="page-drag" draggable={!busy} title="Drag to reorder" aria-hidden="true"
            onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-prepmallow-page", String(page.index)); }}>
            <GripVertical size={17} />
          </span>
        </div>
        <label className="page-keep">
          <input type="checkbox" checked={page.keep} disabled={busy} onChange={(event) => edit(page.index, { keep: event.target.checked })} />
          <span>Page {page.index + 1}</span>
        </label>
        <div className="page-actions">
          <button className="icon-button" type="button" disabled={busy || position === 0} aria-label={"Move page " + (page.index + 1) + " earlier"} onClick={() => movePage(page.index, -1)}><ArrowLeft size={15} /></button>
          <button className="icon-button" type="button" disabled={busy || position === pages.length - 1} aria-label={"Move page " + (page.index + 1) + " later"} onClick={() => movePage(page.index, 1)}><ArrowRight size={15} /></button>
          <button className="icon-button" type="button" disabled={busy} aria-label={"Rotate page " + (page.index + 1) + " clockwise"} onClick={() => rotatePage(page.index)}><RotateCw size={15} /></button>
        </div>
      </article>)}
    </div>
  </section>;
}
