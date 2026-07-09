#!/usr/bin/env node
/**
 * Импорт предметов BB classic из tools/bb-reference/items-missing.json → legacy + каталог.
 * node tools/import-bb-reference-items.mjs [--rebuild]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, "tools/bb-reference/items-missing.json");
const LEGACY = path.join(ROOT, "tools/items-migrated-legacy.json");

function main() {
  const incoming = JSON.parse(fs.readFileSync(SRC, "utf8"));
  if (!Array.isArray(incoming.items) || incoming.items.length === 0) {
    throw new Error("items-missing.json: пустой список items");
  }

  const legacy = JSON.parse(fs.readFileSync(LEGACY, "utf8"));
  const byId = new Map(legacy.items.map((item) => [item.id, item]));
  let added = 0;
  let updated = 0;

  for (const item of incoming.items) {
    if (!item.id) throw new Error("item without id");
    if (byId.has(item.id)) {
      byId.set(item.id, structuredClone(item));
      updated += 1;
    } else {
      byId.set(item.id, structuredClone(item));
      added += 1;
    }
  }

  legacy.items = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(LEGACY, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");
  console.log(`Legacy: +${added} новых, ${updated} обновлено → ${path.relative(ROOT, LEGACY)}`);

  if (!process.argv.includes("--no-rebuild")) {
    const pool = spawnSync(process.execPath, ["tools/generate-item-pool-120.mjs"], {
      cwd: ROOT,
      stdio: "inherit",
    });
    if (pool.status !== 0) process.exit(pool.status || 1);

    const recipes = spawnSync(process.execPath, ["tools/generate-bb-recipes.mjs"], {
      cwd: ROOT,
      stdio: "inherit",
    });
    if (recipes.status !== 0) process.exit(recipes.status || 1);
  }
}

main();
