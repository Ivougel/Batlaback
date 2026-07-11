#!/usr/bin/env node
/**
 * Собирает список URL для precache PWA из index.html + статика.
 * Относительные пути — работают на GitHub Pages (/RepoName/) и локально.
 * node tools/generate-pwa-precache.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const OUT = path.join(ROOT, "pwa-precache.js");
/** Бамп при любом изменении списка — iPad/PWA сбрасывает старый Cache Storage. */
const CACHE_VERSION = "bb-pwa-v13";

const STATIC_EXT = new Set([".js", ".css", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".mp3", ".woff", ".woff2"]);

/** Каталоги, которые нельзя класть в offline-кэш (OOM на iPad Mini PWA). */
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "tools",
  ".git",
  ".cursor",
  ".github",
  "coverage",
  "playwright-report",
  "test-results",
  "agent-transcripts",
]);

function toRelUrl(filePath) {
  return filePath.split(path.sep).join("/");
}

function basePath(url) {
  return url.split("?")[0].split("#")[0];
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (STATIC_EXT.has(path.extname(name).toLowerCase())) {
      out.push(toRelUrl(path.relative(ROOT, full)));
    }
  }
  return out;
}

function urlsFromIndex(html) {
  const urls = new Set(["index.html", "manifest.webmanifest", "sw.js", "pwa-precache.js"]);
  const re = /(?:src|href)=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1];
    if (!raw || raw.startsWith("http") || raw.startsWith("//") || raw.startsWith("#") || raw.startsWith("data:")) {
      continue;
    }
    const clean = raw.split("#")[0].replace(/^\//, "");
    if (!clean) continue;
    const top = basePath(clean).split("/")[0];
    if (SKIP_DIRS.has(top)) continue;
    urls.add(clean);
  }
  return urls;
}

function buildPrecacheList(html) {
  const fromIndex = urlsFromIndex(html);
  const indexBases = new Set([...fromIndex].map(basePath));
  const walked = walk(ROOT).filter((p) => !indexBases.has(p));
  return [...new Set([...fromIndex, ...walked])].sort();
}

function main() {
  const html = fs.readFileSync(INDEX, "utf8");
  const sorted = buildPrecacheList(html);
  const nm = sorted.filter((u) => u.includes("node_modules")).length;
  const dist = sorted.filter((u) => u.startsWith("dist/") || u === "dist").length;
  if (nm || dist) {
    console.error(`Refusing to write precache with node_modules=${nm} dist=${dist}`);
    process.exit(1);
  }

  const body = `// Auto-generated — node tools/generate-pwa-precache.js
self.PWA_CACHE_VERSION = "${CACHE_VERSION}";
self.PWA_PRECACHE_URLS = ${JSON.stringify(sorted, null, 2)};
`;

  fs.writeFileSync(OUT, body, "utf8");
  console.log(`Precache: ${sorted.length} URLs → ${OUT} (${CACHE_VERSION})`);
}

main();
