#!/usr/bin/env node
/**
 * Синхронизирует craftOnly в tools/items-migrated.json с рецептами BB.
 *
 * Правило:
 * - output рецепта → craftOnly: true (не продаётся в магазине)
 * - CRAFT_TERMINAL без рецепта → craftOnly: true (редкие fusion-предметы)
 * - всё остальное → craftOnly: false (shop/craft ingredients)
 *
 * node tools/sync-item-craft-flags.mjs [--write]
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, "tools/items-migrated.json");
const RECIPES_PATH = path.join(ROOT, "systems/bb-reference-recipes.js");

/** Craft-only без рецепта в classic (пока) — не должны быть в shop. */
const CRAFT_TERMINAL = new Set([
  "rainbow_goobert",
]);

function loadRecipeOutputs() {
  const ctx = { window: {} };
  ctx.window = ctx;
  vm.runInContext(fs.readFileSync(RECIPES_PATH, "utf8"), vm.createContext(ctx));
  const recipes = ctx.BB_REFERENCE_RECIPES || [];
  return new Set(recipes.map((r) => r.output));
}

function shouldBeCraftOnly(itemId, outputs) {
  if (outputs.has(itemId)) return true;
  if (CRAFT_TERMINAL.has(itemId)) return true;
  return false;
}

function main() {
  const write = process.argv.includes("--write");
  const data = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const outputs = loadRecipeOutputs();

  let flippedToTrue = 0;
  let flippedToFalse = 0;
  const changes = [];

  data.items.forEach((item) => {
    const want = shouldBeCraftOnly(item.id, outputs);
    const had = !!item.craftOnly;
    if (had !== want) {
      changes.push({ id: item.id, from: had, to: want });
      if (want) flippedToTrue += 1;
      else flippedToFalse += 1;
      if (write) item.craftOnly = want;
    }
  });

  const craftOnlyCount = data.items.filter((i) => (write ? shouldBeCraftOnly(i.id, outputs) : i.craftOnly)).length;

  console.log(`Recipe outputs: ${outputs.size}`);
  console.log(`CRAFT_TERMINAL: ${CRAFT_TERMINAL.size}`);
  console.log(`Changes: ${changes.length} (→true: ${flippedToTrue}, →false: ${flippedToFalse})`);
  console.log(`craftOnly after sync: ${craftOnlyCount}`);

  if (changes.length && !write) {
    console.log("\nSample changes (first 20):");
    changes.slice(0, 20).forEach((c) => {
      console.log(`  ${c.id}: ${c.from} → ${c.to}`);
    });
    console.log("\nRe-run with --write to apply.");
  }

  if (write) {
    fs.writeFileSync(SRC, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    console.log(`Wrote ${path.relative(ROOT, SRC)}`);
  }
}

main();
