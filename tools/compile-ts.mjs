#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
/**
 * Транспиляция systems/*.ts → systems/*.js (без бандлинга, classic script совместим).
 */
import * as esbuild from "esbuild";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SYSTEMS_DIR = path.join(ROOT, "systems");

const BANNER = "// Transpiled from TypeScript — npm run compile:ts\n";

function listTsModules() {
  return fs
    .readdirSync(SYSTEMS_DIR)
    .filter((name) => name.endsWith(".ts"))
    .sort()
    .map((name) => `systems/${name}`);
}

async function compileOne(rel) {
  const entry = path.join(ROOT, rel);
  const outfile = entry.replace(/\.ts$/, ".js");
  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: false,
    format: "esm",
    platform: "browser",
    target: "es2022",
    logLevel: "silent",
    banner: { js: BANNER },
  });
  const kb = (fs.statSync(outfile).size / 1024).toFixed(1);
  console.log(`compile:ts  ${rel} → ${path.basename(outfile)} (${kb} KB)`);
}

async function main() {
  const modules = listTsModules();
  if (!modules.length) {
    console.warn("compile:ts: no systems/*.ts files found");
    return;
  }
  for (const rel of modules) {
    await compileOne(rel);
  }
  console.log(`compile:ts: ${modules.length} module(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
