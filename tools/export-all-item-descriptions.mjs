#!/usr/bin/env node
/**
 * Сводный файл: все предметы каталога + наши тексты (description, buildHints, flavor).
 * node tools/export-all-item-descriptions.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_MD = path.join(ROOT, "docs/all-items-descriptions.md");
const OUT_JSON = path.join(ROOT, "docs/all-items-descriptions.json");
const OUT_CSV = path.join(ROOT, "docs/all-items-descriptions.csv");

const RARITY_LABELS = {
  common: "Обычный",
  uncommon: "Необычный",
  rare: "Редкий",
  epic: "Эпический",
  legendary: "Легендарный",
  godly: "Божественный",
  unique: "Уникальный",
};

const TAG_LABELS = {
  weapon: "оружие",
  armor: "броня",
  shield: "щит",
  magic: "магия",
  gem: "кристалл",
  poison: "яд",
  food: "еда",
  nature: "природа",
  fire: "огонь",
  cold: "лёд",
  holy: "святой",
  dark: "тёмный",
  vampiric: "вампирский",
  luck: "удача",
  pet: "питомец",
  potion: "зелье",
  debuff: "дебафф",
  melee: "ближний",
  ranged: "дальний",
  spikes: "шипы",
  stun: "оглушение",
  accessory: "аксессуар",
  ring: "кольцо",
  amulet: "амулет",
  necklace: "ожерелье",
  gloves: "перчатки",
  shoes: "обувь",
  helmet: "шлем",
  musical: "музыка",
  consumable: "расходник",
  card: "карта",
  treasure: "сокровище",
  heal: "лечение",
  bag: "сумка",
  utility: "универсальный",
  craft: "крафт",
  speed: "скорость",
};

function loadCatalog() {
  const sandbox = {
    console,
    Math,
    Object,
    Array,
    Map,
    Set,
    JSON,
    Number,
    String,
    Boolean,
    document: { documentElement: { dataset: {} } },
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  const ctx = vm.createContext(sandbox);
  const code = [
    "items.js",
    "items-catalog.js",
    "systems/item-flavor.js",
  ].map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
  vm.runInContext(code, ctx);
  vm.runInContext(
    "globalThis.__catalog = ITEM_CATALOG; globalThis.__flavor = getItemGrimFlavor;",
    ctx,
  );
  return { catalog: sandbox.__catalog, getGrimFlavor: sandbox.__flavor };
}

function tagLabel(tag) {
  return TAG_LABELS[tag] || tag;
}

function loadJsonItems() {
  const jsonPath = path.join(ROOT, "tools/items-migrated.json");
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const byId = new Map();
  for (const item of data.items || []) {
    if (item?.id) byId.set(item.id, item);
  }
  return byId;
}

function collectRows(catalog, getGrimFlavor, jsonById) {
  return Object.values(catalog)
    .map((def) => {
      const src = jsonById.get(def.id);
      const tags = (def.tags || src?.tags || []).map(tagLabel);
      const description = String(def.description || src?.description || "").trim();
      const buildHints = String(def.buildHints || src?.buildHints || "").trim();
      return {
        id: def.id,
        name: def.name || src?.name || def.id,
        icon: def.icon || src?.icon || "",
        rarity: def.rarity || src?.rarity || "",
        rarityLabel: RARITY_LABELS[def.rarity || src?.rarity] || def.rarity || "",
        cost: def.cost ?? src?.cost ?? null,
        tags,
        description,
        buildHints,
        flavor: String(getGrimFlavor?.(def.id) || "").trim(),
        craftOnly: !!(def.craftOnly || src?.craftOnly),
        isContainer: !!def.isContainer,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

function writeMarkdown(rows, generatedAt) {
  const lines = [];
  lines.push("# Все предметы — описания");
  lines.push("");
  lines.push(`> Сгенерировано: **${generatedAt}** · **${rows.length}** предметов`);
  lines.push("> Источник: `tools/items-migrated.json` + `items-catalog.js` + `systems/item-flavor.js`");
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const row of rows) {
    lines.push(`## ${row.icon} ${row.name}`);
    lines.push("");
    lines.push(`- **ID:** \`${row.id}\``);
    lines.push(`- **Редкость:** ${row.rarityLabel}${row.cost != null ? ` · **Цена:** ${row.cost}💰` : ""}`);
    if (row.tags.length) lines.push(`- **Теги:** ${row.tags.join(", ")}`);
    if (row.craftOnly) lines.push("- **Только крафт**");
    if (row.isContainer) lines.push("- **Контейнер / сумка**");
    lines.push("");
    lines.push("**Описание (игроку):**");
    lines.push("");
    lines.push(row.description ? row.description : "—");
    lines.push("");
    if (row.buildHints) {
      lines.push("**Подсказка по билду:**");
      lines.push("");
      lines.push(row.buildHints);
      lines.push("");
    }
    if (row.flavor) {
      lines.push("**Flavor (atmospheric):**");
      lines.push("");
      lines.push(row.flavor);
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }

  fs.writeFileSync(OUT_MD, `${lines.join("\n")}\n`, "utf8");
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(rows) {
  const columns = [
    "id",
    "name",
    "icon",
    "rarity",
    "rarity_label",
    "cost",
    "tags",
    "description",
    "build_hints",
    "flavor",
    "craft_only",
    "is_container",
  ];
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((col) => {
      switch (col) {
        case "rarity_label": return csvEscape(row.rarityLabel);
        case "tags": return csvEscape(row.tags.join("; "));
        case "build_hints": return csvEscape(row.buildHints);
        case "craft_only": return csvEscape(row.craftOnly ? "да" : "");
        case "is_container": return csvEscape(row.isContainer ? "да" : "");
        default: return csvEscape(row[col] ?? "");
      }
    }).join(",")),
  ];
  // BOM для корректного открытия кириллицы в Excel
  fs.writeFileSync(OUT_CSV, `\uFEFF${lines.join("\n")}\n`, "utf8");
}

function writeJson(rows, generatedAt) {
  fs.writeFileSync(
    OUT_JSON,
    `${JSON.stringify({ generatedAt, count: rows.length, items: rows }, null, 2)}\n`,
    "utf8",
  );
}

function main() {
  const { catalog, getGrimFlavor } = loadCatalog();
  const jsonById = loadJsonItems();
  const rows = collectRows(catalog, getGrimFlavor, jsonById);
  const generatedAt = new Date().toISOString().slice(0, 10);

  writeMarkdown(rows, generatedAt);
  writeJson(rows, generatedAt);
  writeCsv(rows);

  const withDesc = rows.filter((r) => r.description).length;
  const withHints = rows.filter((r) => r.buildHints).length;
  const withFlavor = rows.filter((r) => r.flavor).length;

  console.log(`MD   → ${OUT_MD}`);
  console.log(`JSON → ${OUT_JSON}`);
  console.log(`CSV  → ${OUT_CSV}`);
  console.log(`Предметов: ${rows.length}`);
  console.log(`  description: ${withDesc}, buildHints: ${withHints}, flavor: ${withFlavor}`);
}

main();
