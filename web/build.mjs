// Copyright (C) 2026 Saaim Sohail
// SPDX-License-Identifier: GPL-3.0-only
import { build } from "esbuild";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const output = process.argv[2] ? path.resolve(process.argv[2]) : path.join(here, "dist");
if (output === here || !["workspace", "dist"].includes(path.basename(output))) {
  throw new Error("Use a dedicated workspace or dist directory for generated assets.");
}
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

const packages = path.join(here, "node_modules");
const result = await build({
  absWorkingDir: here,
  entryPoints: { app: "src/android.tsx" },
  outdir: output,
  bundle: true,
  splitting: true,
  jsx: "automatic",
  platform: "browser",
  format: "esm",
  target: "chrome110",
  minify: true,
  metafile: true,
  legalComments: "eof",
  loader: { ".woff2": "file" },
  assetNames: "media/[name]-[hash]",
  chunkNames: "chunks/[name]-[hash]",
  entryNames: "[name]-[hash]",
  define: { "process.env.NODE_ENV": '"production"' },
  external: ["node:*"],
  plugins: [{
    name: "workspace-router",
    setup(builder) {
      builder.onResolve({ filter: /^next\/(link|navigation)$/ }, () => ({ path: path.join(here, "src/router.tsx") }));
    },
  }],
});

const pdf = path.join(packages, "pdfjs-dist");
const pdfAssets = path.join(output, "pdf-assets");
mkdirSync(pdfAssets);
for (const name of ["cmaps", "iccs", "standard_fonts", "wasm"]) {
  cpSync(path.join(pdf, name), path.join(pdfAssets, name), { recursive: true });
}
copyFileSync(path.join(pdf, "legacy/build/pdf.worker.min.mjs"), path.join(pdfAssets, "pdf.worker.min.js"));
copyFileSync(path.join(here, "public/icon.png"), path.join(output, "icon.png"));

const licenses = path.join(output, "licenses");
mkdirSync(licenses);
const libraryNames = ["react", "react-dom", "scheduler", "lucide-react", "pdf-lib", "@pdf-lib/standard-fonts",
  "@pdf-lib/upng", "pako", "tslib", "pdfjs-dist", "heic-to", "fflate",
  "@fontsource-variable/dm-sans", "@fontsource-variable/manrope", "@fontsource-variable/fraunces"];
const notices = libraryNames.map(name => {
  const root = path.join(packages, name);
  const info = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const license = ["LICENSE", "LICENSE.md", "LICENSE.txt", "OFL.txt", "LICENSE.es6.txt"].find(file => existsSync(path.join(root, file)));
  if (license) {
    copyFileSync(path.join(root, license), path.join(licenses, name.replace(/^@/, "").replaceAll("/", "-") + ".txt"));
  }
  return name + " " + info.version + " (" + info.license + ")";
});
writeFileSync(path.join(licenses, "THIRD-PARTY.txt"), notices.join("\n") + "\n");

const [entry, metadata] = Object.entries(result.metafile.outputs).find(([, info]) => info.entryPoint === "src/android.tsx");
const assetPath = file => path.relative(output, path.resolve(here, file)).split(path.sep).join("/");
writeFileSync(path.join(output, "index.html"), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f9f8f4">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'">
  <title>PrepMallow</title>
  <link rel="stylesheet" href="${assetPath(metadata.cssBundle)}">
</head>
<body>
  <div id="prepmallow-app"><p class="app-loading" role="status">Opening PrepMallow…</p></div>
  <script type="module" src="${assetPath(entry)}"></script>
</body>
</html>
`);
console.log("Built the offline PrepMallow workspace.");
