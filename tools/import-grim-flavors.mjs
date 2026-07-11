#!/usr/bin/env node
/**
 * Импорт уникальных grim-flavor из CSV (id,flavor) в systems/item-flavor.ts
 * node tools/import-grim-flavors.mjs deepseek_csv_20260711_9d64f4.txt
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FLAVOR_TS = path.join(ROOT, "systems/item-flavor.ts");

/** Ручные тексты, которых нет в батче DeepSeek — сохраняем поверх импорта. */
const MANUAL_OVERRIDES = {
  rip_saw:
    "Пилу сняли с двери подвала общежития. Зубья помнят металл. И то, что было за металлом.",
  holy_water:
    "Пробирка с жидкостью из часовни при морге. Крест на этикетке стёрт. Содержимое всё ещё шипит при прикосновении к коже.",
};

function parseFlavorCsv(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").trim().split("\n");
  const map = new Map();
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(",");
    if (idx < 0) continue;
    const id = line.slice(0, idx).trim();
    const flavor = line.slice(idx + 1).trim();
    if (id && flavor) map.set(id, flavor);
  }
  return map;
}

function escapeTsString(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatFlavorBlock(entries) {
  const sorted = [...entries.entries()].sort(([a], [b]) => a.localeCompare(b));
  const lines = sorted.map(
    ([id, flavor]) => `  ${id}:\n    "${escapeTsString(flavor)}",`,
  );
  return `const ITEM_GRIM_FLAVOR: Record<string, string> = {\n${lines.join("\n")}\n};`;
}

function main() {
  const input = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.join(ROOT, "deepseek_csv_20260711_9d64f4.txt");

  if (!fs.existsSync(input)) {
    console.error(`File not found: ${input}`);
    process.exit(1);
  }

  const imported = parseFlavorCsv(input);
  const merged = new Map(imported);
  for (const [id, flavor] of Object.entries(MANUAL_OVERRIDES)) {
    merged.set(id, flavor);
  }

  const ts = fs.readFileSync(FLAVOR_TS, "utf8");
  const block = formatFlavorBlock(merged);
  const next = ts.replace(
    /const ITEM_GRIM_FLAVOR: Record<string, string> = \{[\s\S]*?\};/,
    block,
  );

  if (next === ts) {
    console.error("Could not patch ITEM_GRIM_FLAVOR in item-flavor.ts");
    process.exit(1);
  }

  fs.writeFileSync(FLAVOR_TS, next);
  console.log(`Imported ${imported.size} flavors from ${path.basename(input)}`);
  console.log(`Total ITEM_GRIM_FLAVOR entries: ${merged.size}`);
}

main();
