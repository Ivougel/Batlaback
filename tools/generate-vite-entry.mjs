#!/usr/bin/env node
/**
 * Генерирует classic-script бандл из порядка <script src> в index.html.
 * Запуск: node tools/generate-vite-entry.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const INDEX_HTML = path.join(ROOT, "index.html");
const OUT_CORE = path.join(ROOT, "generated/legacy-app-core.js");
const OUT_MANIFEST = path.join(ROOT, "tools/script-manifest.json");
const OUT_VITE_HTML = path.join(ROOT, "index.vite.html");

function stripQuery(src) {
  return src.split("?")[0];
}

function extractScriptSrcs(html) {
  const srcs = [];
  const re = /<script\s+src="([^"]+)"/g;
  for (const match of html.matchAll(re)) {
    srcs.push(stripQuery(match[1]));
  }
  return srcs;
}

function buildLegacyCore(srcs) {
  const parts = [];
  for (const rel of srcs) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      throw new Error(`Script not found: ${rel}`);
    }
    const code = fs.readFileSync(abs, "utf8");
    parts.push(`/* ===== ${rel} ===== */\n${code}`);
  }
  return `${parts.join("\n\n")}\n`;
}

function buildViteHtml(html) {
  const moduleTag = '  <script src="/generated/legacy-app-core.js"></script>\n';
  let out = html.replace(/<script\s+src="[^"]+"><\/script>\s*/g, "");
  if (!out.includes("</body>")) {
    throw new Error("index.html: missing </body>");
  }
  out = out.replace("</body>", `${moduleTag}</body>`);
  return out;
}

function main() {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const srcs = extractScriptSrcs(html);
  if (!srcs.length) {
    throw new Error("No <script src> tags found in index.html");
  }

  fs.mkdirSync(path.dirname(OUT_CORE), { recursive: true });

  const core = buildLegacyCore(srcs);
  fs.writeFileSync(OUT_CORE, core);
  fs.writeFileSync(
    OUT_MANIFEST,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), scripts: srcs }, null, 2)}\n`,
  );
  fs.writeFileSync(OUT_VITE_HTML, buildViteHtml(html));

  const kb = (Buffer.byteLength(core) / 1024).toFixed(0);
  console.log(`generate-vite-entry: ${srcs.length} scripts → generated/legacy-app-core.js (${kb} KB)`);
}

main();
