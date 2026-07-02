#!/usr/bin/env node
/**
 * Генерация пула v120: 120 предметов под философию «новичок + спутник + рюкзак + усиления».
 * node tools/generate-item-pool-120.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MIGRATED = path.join(ROOT, "tools/items-migrated.json");
const MIGRATED_LEGACY = path.join(ROOT, "tools/items-migrated-legacy.json");
const MANIFEST_OUT = path.join(ROOT, "tools/item-pool-120-manifest.json");
const RUNTIME_OUT = path.join(ROOT, "systems/item-pool-120.js");

const LAYERS = {
  starter: [
    "rusty_sword", "iron_helmet",
    "dagger", "poison_vial",
    "apprentice_staff", "mana_crystal",
    "apple", "banana",
  ],
  enhancement: [
    "enh_stray_charm", "enh_ember_crown", "enh_hymn_veil", "enh_shadow_hood",
    "enh_frost_circlet", "enh_inquisitor_mask", "enh_bard_crown", "enh_oracle_diadem",
    "enh_defeated_breastplate", "enh_holy_aegis", "enh_guardian_mail", "enh_zealot_vestment",
    "enh_plague_bindings", "enh_arcane_robe", "enh_juggernaut_plate", "enh_rogue_vest",
    "enh_mad_scholar_sandals", "enh_assassin_treads", "enh_swift_treads", "enh_paladin_greaves",
    "enh_frost_walkers", "enh_trickster_slippers", "enh_pyro_steps", "enh_guardian_sabatons",
  ],
  amplifier: [
    "amplify_fire", "amplify_holy", "amplify_poison", "amplify_magic", "amplify_melee",
    "amplify_staff", "amplify_wand", "amplify_twohand", "amplify_chest", "amplify_boots",
  ],
  key: [
    "key_ember_codex", "key_hymn_folio", "key_paladin_oath", "key_shadow_pact",
  ],
  triple_support: [
    "fire_staff", "weapon_holy_mace", "armor_holy_choir", "accessory_musical_slippers",
    "boots_steadfast", "armor_light_weave", "dagger",
  ],
};

const CORE_EXCLUDE = new Set([
  "artifact_stone_death", "heart_container", "more_stats", "gloves_of_haste",
]);

const CORE_QUOTAS = [
  ["weapon", 12],
  ["shield", 2],
  ["poison", 5],
  ["fire", 3],
  ["cold", 2],
  ["holy", 4],
  ["magic", 5],
  ["gem", 4],
  ["food", 8],
  ["potion", 6],
  ["nature", 3],
  ["accessory", 4],
  ["armor", 7],
  ["__bag__", 2],
];

function itemHasTag(item, tag) {
  return (item.tags || []).includes(tag);
}

function layerIdsFlat() {
  const seen = new Set();
  const flat = [];
  for (const [layer, ids] of Object.entries(LAYERS)) {
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        flat.push({ id, layer });
      }
    }
  }
  return { seen, flat };
}

function canPickForQuota(item, tag) {
  if (item.craftOnly || CORE_EXCLUDE.has(item.id)) return false;
  if (tag === "__bag__") return item.isContainer && item.shopContainer;
  if (item.isContainer) return false;
  if (tag === "weapon" && itemHasTag(item, "poison")) return false;
  if (tag === "armor" && itemHasTag(item, "shield")) return false;
  if (tag === "potion" && itemHasTag(item, "poison")) return false;
  if (tag === "food" && itemHasTag(item, "poison")) return false;
  return itemHasTag(item, tag);
}

function pickCoreShop(migratedItems, reserved) {
  const TARGET = 68;
  const used = new Set(reserved);
  const picked = [];

  for (const [tag, quota] of CORE_QUOTAS) {
    let count = 0;
    const sorted = [...migratedItems].sort((a, b) => (a.cost || 0) - (b.cost || 0));
    for (const item of sorted) {
      if (count >= quota || picked.length >= TARGET) break;
      if (used.has(item.id) || !canPickForQuota(item, tag)) continue;
      used.add(item.id);
      picked.push(item.id);
      count += 1;
    }
  }

  const isBackfillEligible = (item) => {
    if (used.has(item.id) || CORE_EXCLUDE.has(item.id) || item.craftOnly) return false;
    if (item.isContainer) return item.shopContainer;
    const tags = item.tags || [];
    return tags.some((t) => [
      "weapon", "armor", "shield", "food", "potion", "poison", "magic", "gem",
      "fire", "cold", "holy", "nature", "accessory", "utility",
    ].includes(t));
  };

  const sortedBackfill = [...migratedItems].sort((a, b) => (a.cost || 0) - (b.cost || 0));
  for (const item of sortedBackfill) {
    if (picked.length >= TARGET) break;
    if (!isBackfillEligible(item)) continue;
    used.add(item.id);
    picked.push(item.id);
  }

  if (picked.length !== TARGET) {
    throw new Error(`core_shop: ${picked.length}/${TARGET} после квот и backfill`);
  }

  return picked;
}

function main() {
  const migrated = JSON.parse(fs.readFileSync(MIGRATED, "utf8")).items;
  const { seen, flat: layerFlat } = layerIdsFlat();

  const coreShop = pickCoreShop(migrated, seen);
  const entries = [
    ...layerFlat,
    ...coreShop.map((id) => ({ id, layer: "core_shop" })),
  ];

  if (entries.length !== 120) {
    throw new Error(`Ожидалось 120 предметов, получено ${entries.length}`);
  }

  const manifest = {
    version: 1,
    name: "pool-120",
    description: "Курированный пул: 52 системных (без дубля dagger) + 68 предметов рюкзака",
    generatedAt: new Date().toISOString(),
    counts: {
      starter: LAYERS.starter.length,
      enhancement: LAYERS.enhancement.length,
      amplifier: LAYERS.amplifier.length,
      key: LAYERS.key.length,
      triple_support: LAYERS.triple_support.length,
      core_shop: coreShop.length,
      total: entries.length,
    },
    layers: {
      ...LAYERS,
      core_shop: coreShop,
    },
    items: entries.map((e) => e.id),
  };

  fs.writeFileSync(MANIFEST_OUT, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const poolIds = new Set(manifest.items);
  const migratedData = JSON.parse(fs.readFileSync(MIGRATED, "utf8"));
  const legacySource = fs.existsSync(MIGRATED_LEGACY)
    ? JSON.parse(fs.readFileSync(MIGRATED_LEGACY, "utf8"))
    : migratedData;
  if (migratedData.items.length > poolIds.size && !fs.existsSync(MIGRATED_LEGACY)) {
    fs.writeFileSync(MIGRATED_LEGACY, `${JSON.stringify(migratedData, null, 2)}\n`, "utf8");
    console.log(`Архив полного каталога → ${path.relative(ROOT, MIGRATED_LEGACY)}`);
  }
  const beforeCount = migratedData.items.length;
  /** Стартовый рюкзак не в магазине, но нужен для createStartingContainers. */
  const INFRA_ITEM_IDS = new Set(["starter_bag"]);
  const filtered = migratedData.items.filter((item) => poolIds.has(item.id));
  const filteredIds = new Set(filtered.map((item) => item.id));
  const infraItems = legacySource.items.filter(
    (item) => INFRA_ITEM_IDS.has(item.id) && !filteredIds.has(item.id),
  );
  migratedData.items = [...filtered, ...infraItems];
  fs.writeFileSync(MIGRATED, `${JSON.stringify(migratedData, null, 2)}\n`, "utf8");

  const runtime = `/**
 * Пул v120 — единственный игровой каталог предметов.
 * Сгенерировано tools/generate-item-pool-120.mjs
 * @see docs/item-pool-120-gdd.md
 */

const ITEM_POOL_120_MANIFEST = ${JSON.stringify(manifest, null, 2)};

const ITEM_POOL_120_ID_SET = new Set(ITEM_POOL_120_MANIFEST.items);

function isItemPool120Enabled() {
  return true;
}

function setItemPool120Enabled(_enabled) {
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.dataset.itemPool = "120";
  }
}

function isItemInPool120(itemId) {
  return ITEM_POOL_120_ID_SET.has(itemId);
}

function filterItemsToPool120(itemsOrDefs) {
  return itemsOrDefs.filter((entry) => {
    const id = typeof entry === "string" ? entry : entry?.id || entry?.itemId;
    return id && isItemInPool120(id);
  });
}

function getItemPool120Ids() {
  return [...ITEM_POOL_120_ID_SET];
}

function getItemPool120Layer(itemId) {
  for (const [layer, ids] of Object.entries(ITEM_POOL_120_MANIFEST.layers)) {
    if (ids.includes(itemId)) return layer;
  }
  return null;
}

setItemPool120Enabled(true);
`;

  fs.writeFileSync(RUNTIME_OUT, runtime, "utf8");

  const catalog = spawnSync(process.execPath, ["tools/generate-items-catalog.js"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (catalog.status !== 0) {
    process.exit(catalog.status || 1);
  }

  console.log("=== Item pool v120 ===\n");
  console.log(`Всего: ${entries.length}`);
  console.log(manifest.counts);
  console.log(`Каталог items-migrated.json: ${beforeCount} → ${migratedData.items.length}`);
  console.log(`\nМанифест → ${MANIFEST_OUT}`);
  console.log(`Runtime  → ${RUNTIME_OUT}`);
}

main();
