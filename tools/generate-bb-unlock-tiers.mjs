#!/usr/bin/env node
/**
 * Генерирует systems/bb-reference-unlocks.js из каталога (эвристика BB-уровней).
 * node tools/generate-bb-unlock-tiers.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "systems/bb-reference-unlocks.js");

function loadSandbox() {
  const sandbox = {
    console,
    Math,
    Object,
    Array,
    Map,
    Set,
    JSON,
    window: null,
    CRAFT_OUTPUT_IDS: new Set(),
    getCraftOutputItemIds: () => [],
    isCraftOutputItemId: () => false,
    BB_SHOP_TIERS: ["unique", "godly", "legendary", "epic", "rare", "common"],
    getItemShopRarityTier(item) {
      if (!item) return "common";
      if (item.shopRarityTier) return item.shopRarityTier;
      const rarity = item.rarity || "common";
      if (rarity === "uncommon") return "rare";
      if (this.BB_SHOP_TIERS.includes(rarity)) return rarity;
      return "common";
    },
    isShopEligibleItem: () => true,
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  [
    "systems/item-pool-120.js",
    "items.js",
    "items-catalog.js",
    "shop-engine.js",
  ].forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), ctx);
  });
  return sandbox;
}

function main() {
  const s = loadSandbox();
  const src = fs.readFileSync(path.join(ROOT, "systems/item-unlock-tiers.js"), "utf8");
  vm.runInContext(src, vm.createContext(s));
  const { ItemUnlockTiers } = s;
  if (!ItemUnlockTiers?.listShopItemIdsForHero) {
    throw new Error("ItemUnlockTiers not loaded");
  }

  const heroes = ["warrior", "rogue", "mage", "priest"];
  const entries = {};
  heroes.forEach((heroId) => {
    const ids = ItemUnlockTiers.listShopItemIdsForHero(heroId);
    ids.forEach((itemId) => {
      const spec = ItemUnlockTiers.getSpec(itemId);
      if (!spec) return;
      entries[itemId] = {
        minLevel: spec.minLevel,
        scope: spec.scope,
        ...(spec.heroId ? { heroId: spec.heroId } : {}),
      };
    });
  });

  const body = `/**
 * Таблица unlock предметов — сгенерировано tools/generate-bb-unlock-tiers.mjs
 * Источник: эвристика редкости + стартовые пулы (сверять с wiki BB).
 */
const BB_REFERENCE_UNLOCK_TABLE = ${JSON.stringify(entries, null, 2)};

window.BB_REFERENCE_UNLOCK_TABLE = BB_REFERENCE_UNLOCK_TABLE;
`;

  fs.writeFileSync(OUT, body);
  console.log(`Wrote ${OUT} (${Object.keys(entries).length} items)`);
}

main();
