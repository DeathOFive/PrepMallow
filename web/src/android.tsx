/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Archive, ArrowDownToLine, ArrowLeft, ArrowRight, Bookmark, ChevronRight, FileCheck, FileImage, FilePlus, FileText, FolderOpen, ImageIcon, Search, ShieldCheck, X } from "lucide-react";
import { Workbench } from "./components/workbench";
import { RoutingContext } from "./router";
import { android, chooseFiles, watchSharedFiles, type Selection } from "./android-bridge";
import { relatedTools, toolBySlug, tools, type Group, type Tool } from "./lib/catalog";
import { handoffFiles, kindOf, localGet, localSet } from "./lib/file-utils";
import "./fonts.css";
import "./app/globals.css";
import "./app/workspace.css";
import "./app/android.css";
import "./app/android-motion.css";

const filters = ["All tools", "Images", "PDF", "File utilities", "Saved"] as const;
type Filter = typeof filters[number];
const groupIcons = { Images: ImageIcon, PDF: FileText, "File utilities": Archive };
const quickTools = ["compress-image", "images-to-pdf", "merge-pdf", "check-file"];
const quickIcons = { "compress-image": ArrowDownToLine, "images-to-pdf": FileImage, "merge-pdf": FilePlus, "check-file": FileCheck };

function navigate(href: string) {
  const next = "#" + (href.replace(/\/+$/, "") || "/");
  if (location.hash !== next) location.hash = next;
}

function initialRoute() {
  return location.hash.slice(1) || "/";
}

function sharedTool(files: File[]) {
  const kinds = files.map(kindOf);
  if (kinds.every(kind => kind === "image")) return "compress-image";
  if (kinds.every(kind => kind === "pdf")) return files.length > 1 ? "merge-pdf" : "organize-pdf";
  if (kinds.length === 1 && kinds[0] === "zip") return "open-zip";
  return "check-file";
}

function storedFavorites(): string[] {
  try {
    const saved = JSON.parse(localGet("favorite-tools") || "[]");
    return Array.isArray(saved) ? saved.filter(slug => typeof slug === "string" && toolBySlug(slug)) : [];
  } catch { return []; }
}

function ToolRow({ tool, saved }: { tool: Tool; saved: boolean }) {
  const Icon = groupIcons[tool.group];
  return <button className="app-tool-row" type="button" onClick={() => navigate("/tools/" + tool.slug)}>
    <span className={"app-tool-icon " + (tool.group === "Images" ? "image" : tool.group === "PDF" ? "pdf" : "file")}><Icon size={21} /></span>
    <span className="app-tool-copy"><strong>{tool.title}</strong><small>{tool.short}</small></span>
    {saved && <Bookmark className="app-row-bookmark" size={15} fill="currentColor" aria-label="Saved" />}
    <ChevronRight className="app-row-chevron" size={19} />
  </button>;
}

function Home({ favorites, importFiles }: { favorites: string[]; importFiles: (selection: Selection) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All tools");
  const [picking, setPicking] = useState(false);
  const search = query.trim().toLowerCase();
  const matches = tools.filter(tool => (filter === "All tools" || filter === tool.group ||
    (filter === "Saved" && favorites.includes(tool.slug))) &&
    (!search || search.split(/\s+/).every(word => [tool.title, tool.short, tool.group, tool.description].join(" ").toLowerCase().includes(word))));
  const groups = ["Images", "PDF", "File utilities"] as Group[];

  async function openFiles() {
    setPicking(true);
    try { importFiles(await chooseFiles("any", true)); }
    finally { setPicking(false); }
  }

  return <div className="app-wrap app-home">
    <section className="app-intro" aria-label="Open files">
      <div>
        <h1>Get your files<br />ready to send.</h1>
        <p>Photos, PDFs and ZIPs, all on your phone.</p>
        <button className="app-open" type="button" disabled={picking} onClick={openFiles}>
          <FolderOpen size={18} /> {picking ? "Opening files…" : "Choose files"} <ArrowRight size={17} />
        </button>
      </div>
      <div className="app-intro-art" aria-hidden="true">
        <span className="app-art-sheet photo"><ImageIcon size={25} /></span>
        <span className="app-art-sheet document"><FileText size={30} /></span>
        <span className="app-art-sheet archive"><Archive size={26} /></span>
      </div>
    </section>
    <div className="app-search">
      <Search size={20} aria-hidden="true" />
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search tools" aria-label="Search tools" />
      {query && <button className="app-icon-button" type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={19} /></button>}
    </div>
    <div className="app-filters" role="group" aria-label="Filter tools">
      {filters.map(item => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>
        {item === "Saved" && <Bookmark size={15} />}{item === "File utilities" ? "Files" : item}
      </button>)}
    </div>
    {!search && filter === "All tools" && <section className="app-quick" aria-labelledby="quick-title">
      <h2 id="quick-title">Quick tools</h2>
      <div className="app-quick-grid">{quickTools.map(slug => {
        const tool = toolBySlug(slug)!;
        const Icon = quickIcons[slug as keyof typeof quickIcons];
        return <button type="button" key={slug} className="app-quick-card" onClick={() => navigate("/tools/" + slug)}>
          <Icon size={22} /><strong>{tool.title}</strong>
        </button>;
      })}</div>
    </section>}
    {groups.map(group => {
      const list = matches.filter(tool => tool.group === group);
      return list.length > 0 && <section className="app-tool-group" key={group} aria-label={group}>
        <h2>{group}</h2>
        <div className="app-tool-list">{list.map(tool => <ToolRow key={tool.slug} tool={tool} saved={favorites.includes(tool.slug)} />)}</div>
      </section>;
    })}
    {matches.length === 0 && <p className="app-empty">{!search && filter === "Saved" ? "Tap the bookmark in any tool to save it here." : "No tools match your search."}</p>}
  </div>;
}

function Privacy() {
  return <section className="app-wrap app-privacy">
    <span className="app-tool-icon image"><ShieldCheck size={24} /></span>
    <h1>File privacy</h1>
    <p>PrepMallow works offline. The app has no ads, analytics, accounts or internet permission.</p>
    <h2>Choosing files</h2>
    <p>Android gives PrepMallow access to the files or folder you select. Processing happens on your device. Your original files stay in place.</p>
    <h2>Saving and sharing</h2>
    <p>Save lets you choose where to store the output. Share sends a temporary copy to the app you select. PrepMallow removes old temporary copies when it next opens.</p>
    <h2>On-device settings</h2>
    <p>Saved tools and any settings you choose to remember stay in app storage. Clear app storage in Android settings to remove them.</p>
  </section>;
}

function WorkspaceApp() {
  const [route, setRoute] = useState(initialRoute);
  const [favorites, setFavorites] = useState(storedFavorites);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importVersion, setImportVersion] = useState(0);
  const tool = route.startsWith("/tools/") ? toolBySlug(route.slice(7)) : undefined;
  const privacy = route === "/privacy";

  const importFiles = useCallback((selection: Selection) => {
    setWarnings(selection.warnings);
    if (!selection.files.length) return;
    const slug = sharedTool(selection.files);
    handoffFiles(slug, selection.files);
    setImportVersion(version => version + 1);
    navigate("/tools/" + slug);
  }, []);

  useEffect(() => {
    const change = () => setRoute(initialRoute());
    addEventListener("hashchange", change);
    const unwatch = watchSharedFiles(importFiles);
    window.prepmallowHandleBack = () => {
      const dialog = document.querySelector("dialog[open]");
      if (dialog) dialog.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true }));
      else if (initialRoute() === "/") return false;
      else if (history.length > 1) history.back();
      else navigate("/");
      return true;
    };
    android?.ready();
    return () => { removeEventListener("hashchange", change); unwatch(); };
  }, [importFiles]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = tool ? tool.title + " · PrepMallow" : "PrepMallow";
  }, [route, tool]);

  function toggleFavorite(slug: string) {
    const next = favorites.includes(slug) ? favorites.filter(item => item !== slug) : [...favorites, slug];
    setFavorites(next);
    localSet("favorite-tools", JSON.stringify(next));
  }

  return <RoutingContext.Provider value={{ basePath: "", portfolioUrl: "", navigate }}>
    <header className="app-header">
      <div className="app-wrap app-header-inner">
        <div className="app-header-leading">
          {(tool || privacy) && <button className="app-icon-button" type="button" aria-label="Back to tools" onClick={() => navigate("/")}><ArrowLeft size={23} /></button>}
          <button className="app-wordmark" type="button" onClick={() => navigate("/")} aria-label="PrepMallow home">
            <img src="icon.png" alt="" width="32" height="32" /><span>Prep<span>Mallow</span></span>
          </button>
        </div>
        {tool ? <button className={"app-icon-button app-bookmark" + (favorites.includes(tool.slug) ? " is-saved" : "")}
          aria-label={favorites.includes(tool.slug) ? "Remove from saved tools" : "Save tool"} aria-pressed={favorites.includes(tool.slug)}
          type="button" onClick={() => toggleFavorite(tool.slug)}><Bookmark size={21} fill={favorites.includes(tool.slug) ? "currentColor" : "none"} /></button>
          : !privacy && <button className="app-privacy-link" type="button" onClick={() => navigate("/privacy")}><ShieldCheck size={17} /> Offline</button>}
      </div>
    </header>
    <main id="main">
      {!!warnings.length && <div className="app-wrap app-import-warning notice notice-error" role="alert">
        <ul>{warnings.map((message, index) => <li key={index}>{message}</li>)}</ul>
        <button className="app-icon-button" type="button" aria-label="Dismiss file messages" onClick={() => setWarnings([])}><X size={17} /></button>
      </div>}
      {tool ? <div className="app-wrap app-tool-screen" key={tool.slug}>
        <div className="app-tool-intro">
          <h1>{tool.title}</h1>
          <p>{tool.description.replace("in your browser", "on your phone")}</p>
        </div>
        <Workbench key={tool.slug + ":" + importVersion} tool={tool} />
        <section className="app-tool-group app-related" aria-label="Related tools">
          <h2>Related tools</h2>
          <div className="app-tool-list">{relatedTools(tool, tools).map(item => <ToolRow key={item.slug} tool={item} saved={favorites.includes(item.slug)} />)}</div>
        </section>
      </div> : privacy ? <Privacy /> : <Home favorites={favorites} importFiles={importFiles} />}
    </main>
  </RoutingContext.Provider>;
}

const element = document.getElementById("prepmallow-app")!;
element.dataset.assetRoot = new URL("./", document.baseURI).href;
createRoot(element).render(<WorkspaceApp />);
