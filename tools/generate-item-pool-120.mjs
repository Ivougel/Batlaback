#!/usr/bin/env node
/**
 * Генерация пула v240: 120 системных + 188 предметов рюкзака (68 база + 120 расширение).
 * node tools/generate-item-pool-120.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { autoDescribeItem } from "./auto-item-descriptions.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MIGRATED = path.join(ROOT, "tools/items-migrated.json");
const MIGRATED_LEGACY = path.join(ROOT, "tools/items-migrated-legacy.json");
const MANIFEST_OUT = path.join(ROOT, "tools/item-pool-120-manifest.json");
const RUNTIME_OUT = path.join(ROOT, "systems/item-pool-120.js");

const POOL_TOTAL = 240;

/** 120 предметов из legacy: 63 shop + 57 бывших craftOnly (включаются в магазин). */
const EXPANSION_SHOP = [
  "artifact_stone_cold", "artifact_stone_heat", "beast_fang", "blood_amulet", "blood_harvester",
  "blood_stone", "box_of_riches", "corrupted_crystal", "cthulhu", "cubert", "dancing_dragon",
  "djinn_lamp", "fancy_fencing_rapier", "fanfare", "flute", "frozen_flame", "goobert",
  "great_shield", "happy_bomb", "holdall", "impractically_large_greatsword", "katana",
  "king_crown", "large_sack", "leather_bag", "lightsaber", "lil_chestnut", "mana_orb",
  "mana_orb_charm", "maneki_neko", "mr_struggles", "mrs_struggles", "offering_bowl",
  "paradise_birb", "pop", "potion_belt", "prismatic_orb", "prismatic_sword", "relic_case",
  "repeater", "ring_of_power", "ruby_egg", "rune_of_magic", "rune_of_protection",
  "shadow_blade", "shield_of_valor", "snowmaster", "speed_amulet", "spider_web",
  "stable_recombobulator", "stamina_sack", "stone_golem", "storage_chest", "tim",
  "time_dilator", "unsettling_presence", "unstable_recombobulator", "utility_pouch",
  "walrus_tusk", "war_hammer", "whetstone",   "wolpertinger", "shovel",
  "crossblades", "eggscalibur", "enchanted_staff", "falcon_blade", "hero_long_sword",
  "hero_sword", "manathirst", "spectral_dagger", "the_fool", "burning_coal",
  "flawed_amethyst", "flawed_emerald", "flawed_ruby", "flawed_sapphire", "flawed_topaz",
  "lucky_clover", "ace_of_spades", "carrot", "forging_hammer", "reverse", "the_lovers",
  "dragon_claws", "jimbo", "rat", "regular_amethyst", "regular_emerald", "regular_ruby",
  "regular_sapphire", "regular_topaz", "shortbow", "spell_scroll_frostbolt", "burning_torch",
  "chili_pepper", "darkest_lotus", "flame_badge", "holo_fire_lizard", "leaf_badge",
  "magic_badge", "puzzle_badge", "rainbow_badge", "shell_totem", "sir_sand", "skull_badge",
  "squirrel", "stone_badge", "torch", "twine_badge", "white_eyes_blue_dragon", "wolf_badge",
  "axe", "dragonskin_boots", "hedgehog", "mana_potion", "molten_dagger", "spiked_collar",
  "toad", "bow_and_arrow",
];

const EXPANSION_CRAFT_IDS = new Set([
  "crossblades", "eggscalibur", "enchanted_staff", "falcon_blade", "hero_long_sword",
  "hero_sword", "manathirst", "shovel", "spectral_dagger", "the_fool", "burning_coal",
  "flawed_amethyst", "flawed_emerald", "flawed_ruby", "flawed_sapphire", "flawed_topaz",
  "lucky_clover", "ace_of_spades", "carrot", "forging_hammer", "reverse", "the_lovers",
  "dragon_claws", "jimbo", "rat", "regular_amethyst", "regular_emerald", "regular_ruby",
  "regular_sapphire", "regular_topaz", "shortbow", "spell_scroll_frostbolt", "burning_torch",
  "chili_pepper", "darkest_lotus", "flame_badge", "holo_fire_lizard", "leaf_badge",
  "magic_badge", "puzzle_badge", "rainbow_badge", "shell_totem", "sir_sand", "skull_badge",
  "squirrel", "stone_badge", "torch", "twine_badge", "white_eyes_blue_dragon", "wolf_badge",
  "axe", "dragonskin_boots", "hedgehog", "mana_potion", "molten_dagger", "spiked_collar",
  "toad", "bow_and_arrow",
]);

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
  expansion_shop: EXPANSION_SHOP,
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

function mergeLegacyCatalog(migratedData) {
  if (!fs.existsSync(MIGRATED_LEGACY)) return migratedData;
  const legacy = JSON.parse(fs.readFileSync(MIGRATED_LEGACY, "utf8"));
  const byId = new Map(migratedData.items.map((item) => [item.id, item]));
  for (const item of legacy.items) {
    if (!byId.has(item.id)) byId.set(item.id, structuredClone(item));
  }
  for (const id of EXPANSION_CRAFT_IDS) {
    const item = byId.get(id);
    if (item) item.craftOnly = false;
  }
  migratedData.items = [...byId.values()];
  return migratedData;
}

function applyAutoDescriptions(migratedData, poolIds) {
  let patched = 0;
  migratedData.items.forEach((item) => {
    if (!poolIds.has(item.id)) return;
    if (item.description?.trim()) return;
    const text = autoDescribeItem(item);
    if (!text) return;
    item.description = text;
    patched += 1;
  });
  return patched;
}

function main() {
  const migratedData = JSON.parse(fs.readFileSync(MIGRATED, "utf8"));
  mergeLegacyCatalog(migratedData);
  fs.writeFileSync(MIGRATED, `${JSON.stringify(migratedData, null, 2)}\n`, "utf8");

  const migrated = migratedData.items;
  const { seen, flat: layerFlat } = layerIdsFlat();

  const coreShop = pickCoreShop(migrated, seen);
  const entries = [
    ...layerFlat,
    ...coreShop.map((id) => ({ id, layer: "core_shop" })),
  ];

  if (entries.length !== POOL_TOTAL) {
    throw new Error(`Ожидалось ${POOL_TOTAL} предметов, получено ${entries.length}`);
  }

  const poolIds = new Set(entries.map((e) => e.id));
  const described = applyAutoDescriptions(migratedData, poolIds);
  if (described > 0) {
    fs.writeFileSync(MIGRATED, `${JSON.stringify(migratedData, null, 2)}\n`, "utf8");
    console.log(`Авто-описания: +${described} предметов`);
  }

  const manifest = {
    version: 2,
    name: "pool-240",
    description: "Курированный пул: 52 системных + 68 базовый магазин + 120 расширение из legacy",
    generatedAt: new Date().toISOString(),
    counts: {
      starter: LAYERS.starter.length,
      enhancement: LAYERS.enhancement.length,
      amplifier: LAYERS.amplifier.length,
      key: LAYERS.key.length,
      triple_support: LAYERS.triple_support.length,
      core_shop: coreShop.length,
      expansion_shop: EXPANSION_SHOP.length,
      total: entries.length,
    },
    layers: {
      ...LAYERS,
      core_shop: coreShop,
    },
    items: entries.map((e) => e.id),
  };

  fs.writeFileSync(MANIFEST_OUT, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const poolIdsSet = new Set(manifest.items);
  const legacySource = fs.existsSync(MIGRATED_LEGACY)
    ? JSON.parse(fs.readFileSync(MIGRATED_LEGACY, "utf8"))
    : migratedData;
  if (migratedData.items.length > poolIdsSet.size && !fs.existsSync(MIGRATED_LEGACY)) {
    fs.writeFileSync(MIGRATED_LEGACY, `${JSON.stringify(migratedData, null, 2)}\n`, "utf8");
    console.log(`Архив полного каталога → ${path.relative(ROOT, MIGRATED_LEGACY)}`);
  }
  const beforeCount = migratedData.items.length;
  /** Стартовый рюкзак не в магазине, но нужен для createStartingContainers. */
  const INFRA_ITEM_IDS = new Set(["starter_bag"]);
  const filtered = migratedData.items.filter((item) => poolIdsSet.has(item.id));
  const filteredIds = new Set(filtered.map((item) => item.id));
  const infraItems = legacySource.items.filter(
    (item) => INFRA_ITEM_IDS.has(item.id) && !filteredIds.has(item.id),
  );
  migratedData.items = [...filtered, ...infraItems];
  fs.writeFileSync(MIGRATED, `${JSON.stringify(migratedData, null, 2)}\n`, "utf8");

  const runtime = `/**
 * Пул v240 — единственный игровой каталог предметов (120 системных + 120 расширение).
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
    document.documentElement.dataset.itemPool = "240";
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

  console.log("=== Item pool v240 ===\n");
  console.log(`Всего: ${entries.length}`);
  console.log(manifest.counts);
  console.log(`Каталог items-migrated.json: ${beforeCount} → ${migratedData.items.length}`);
  console.log(`\nМанифест → ${MANIFEST_OUT}`);
  console.log(`Runtime  → ${RUNTIME_OUT}`);
}

main();
