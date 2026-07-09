#!/usr/bin/env node
/** Пост-обработка dist/ после vite build. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, "dist");
const VITE_HTML = path.join(DIST, "index.vite.html");
const INDEX_HTML = path.join(DIST, "index.html");
const SRC_BUNDLE = path.join(ROOT, "generated/legacy-app-core.js");
const DEST_BUNDLE = path.join(DIST, "generated/legacy-app-core.js");

if (!fs.existsSync(VITE_HTML)) {
  console.error("post-vite-build: missing dist/index.vite.html");
  process.exit(1);
}
if (!fs.existsSync(SRC_BUNDLE)) {
  console.error("post-vite-build: missing generated/legacy-app-core.js — run generate:vite-entry first");
  process.exit(1);
}

fs.mkdirSync(path.dirname(DEST_BUNDLE), { recursive: true });
fs.copyFileSync(SRC_BUNDLE, DEST_BUNDLE);
fs.copyFileSync(VITE_HTML, INDEX_HTML);

const kb = (fs.statSync(DEST_BUNDLE).size / 1024).toFixed(0);
console.log(`post-vite-build: dist/index.html + bundle ${kb} KB`);
