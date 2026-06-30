#!/usr/bin/env node
/**
 * Собирает список URL для precache PWA из index.html + статика.
 * node tools/generate-pwa-precache.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const OUT = path.join(ROOT, "pwa-precache.js");

const STATIC_EXT = new Set([".js", ".css", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".mp3", ".woff", ".woff2"]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === "tools" || name === ".git") continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (STATIC_EXT.has(path.extname(name).toLowerCase())) {
      out.push("/" + path.relative(ROOT, full).split(path.sep).join("/"));
    }
  }
  return out;
}

function urlsFromIndex(html) {
  const urls = new Set(["/", "/index.html", "/manifest.webmanifest", "/sw.js"]);
  const re = /(?:src|href)=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1];
    if (!raw || raw.startsWith("http") || raw.startsWith("//") || raw.startsWith("#") || raw.startsWith("data:")) {
      continue;
    }
    const clean = raw.split("#")[0];
    urls.add(clean.startsWith("/") ? clean : `/${clean}`);
  }
  return urls;
}

function main() {
  const html = fs.readFileSync(INDEX, "utf8");
  const urls = new Set([...urlsFromIndex(html), ...walk(ROOT)]);
  const sorted = [...urls].sort();

  const body = `// Auto-generated — node tools/generate-pwa-precache.js
self.PWA_CACHE_VERSION = "bb-pwa-v1";
self.PWA_PRECACHE_URLS = ${JSON.stringify(sorted, null, 2)};
`;

  fs.writeFileSync(OUT, body, "utf8");
  console.log(`Precache: ${sorted.length} URLs → ${OUT}`);
}

main();
