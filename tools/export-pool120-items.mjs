#!/usr/bin/env node
/**
 * Выгрузка пула v120: описания, теги, механики.
 * node tools/export-pool120-items.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_CSV = path.join(ROOT, "tools/pool120-items-export.csv");
const OUT_MD = path.join(ROOT, "tools/pool120-items-export.md");

const LOAD_ORDER = [
  "systems/item-pool-120.js",
  "items.js",
  "items-catalog.js",
  "systems/enhancements.js",
  "systems/enhancement-catalog-ext.js",
  "systems/enhancement-crafting.js",
  "systems/triple-support-items.js",
  "systems/backpack-amplifiers.js",
];

const LAYER_LABELS = {
  starter: "Старт класса",
  enhancement: "Усиление 1×1",
  amplifier: "Усилитель рюкзака",
  key: "Ключ ветки",
  triple_support: "Опора тройки",
  core_shop: "Магазин (рюкзак)",
  expansion_shop: "Расширение (legacy)",
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
  for (const file of LOAD_ORDER) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx);
  }
  vm.runInContext(
    `
    if (typeof registerEnhancementItemsInCatalog === "function") registerEnhancementItemsInCatalog();
    if (typeof registerAmplifierItemsInCatalog === "function") registerAmplifierItemsInCatalog();
    if (typeof registerTripleSupportItems === "function") registerTripleSupportItems();
    if (typeof registerKeyItemsInCatalog === "function") registerKeyItemsInCatalog();
    globalThis.__catalog = ITEM_CATALOG;
    globalThis.__getEnh = typeof getEnhancementDef === "function" ? getEnhancementDef : null;
    globalThis.__getAmp = typeof getAmplifierDef === "function" ? getAmplifierDef : null;
  `,
    ctx,
  );
  return {
    catalog: sandbox.__catalog,
    getEnhancementDef: sandbox.__getEnh,
    getAmplifierDef: sandbox.__getAmp,
  };
}

function formatCombatBonus(combat) {
  if (!combat) return "";
  return Object.entries(combat)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");
}

/** Что реально делает предмет в игре (не сырые effects[]). */
function resolveRuntimeMechanics(def, helpers) {
  const { getEnhancementDef, getAmplifierDef } = helpers;
  const battle = (def.effects || []).map(summarizeEffect);
  const meta = (def.metaEffects || []).map(summarizeEffect);
  const syn = (def.synergies || []).map(summarizeSynergy);

  if (def.isEnhancementItem) {
    const enh = getEnhancementDef?.(def.enhancementId || def.id);
    const parts = [];
    if (enh?.desc) parts.push(enh.desc);
    if (enh?.combat) parts.push(`бой: ${formatCombatBonus(enh.combat)}`);
    if (enh?.families?.length) parts.push(`bias тегов: ${enh.families.join(", ")}`);
    return {
      mechanic_layer: "усиление (отдельный слой)",
      runtime_mechanics: parts.join(" · ") || "—",
      works_in_battle: enh?.combat ? "да" : "bias",
      works_in_prep: "да",
      export_note: "effects[] пуст — смотри ENHANCEMENT_CATALOG.combat",
      battle_mechanics: battle.join(" | "),
      meta_mechanics: meta.join(" | "),
      synergies: syn.join(" | "),
    };
  }

  if (def.isAmplifierItem) {
    const amp = getAmplifierDef?.(def.amplifierId || def.id);
    const target = amp?.amplifyFamily
      ? `тег «${amp.amplifyFamily}»`
      : amp?.amplifySlot
        ? `слот «${amp.amplifySlot}»`
        : amp?.amplifyEquip
          ? `экип «${amp.amplifyEquip}»`
          : "?";
    const combat = amp?.combat ? ` · бой: ${formatCombatBonus(amp.combat)}` : "";
    return {
      mechanic_layer: "подсветка + боевой бонус",
      runtime_mechanics: `Подсвечивает ${target}. При совпадении в рюкзаке${combat || " — бонус"}.`,
      works_in_battle: amp?.combat ? "да (если есть пара)" : "нет",
      works_in_prep: "UI",
      export_note: "",
      battle_mechanics: battle.join(" | "),
      meta_mechanics: meta.join(" | "),
      synergies: syn.join(" | "),
    };
  }

  if (def.isBuildKey) {
    return {
      mechanic_layer: "ключ ветки",
      runtime_mechanics: meta.join(" | ") || `unlock: ${def.unlockBuild || "?"}`,
      works_in_battle: "нет",
      works_in_prep: "магазин/крафт",
      export_note: "bias магазина при unlock_build в рюкзаке",
      battle_mechanics: battle.join(" | "),
      meta_mechanics: meta.join(" | "),
      synergies: syn.join(" | "),
    };
  }

  if (def.isContainer) {
    const slots = (def.internalCols || 0) * (def.internalRows || 0);
    return {
      mechanic_layer: "контейнер",
      runtime_mechanics: `+${slots} слотов рюкзака${def.goldPerRound ? `, +${def.goldPerRound}💰/раунд` : ""}`,
      works_in_battle: "нет",
      works_in_prep: "слоты",
      export_note: "не активируется в бою",
      battle_mechanics: "",
      meta_mechanics: meta.join(" | "),
      synergies: syn.join(" | "),
    };
  }

  const hasBattle = battle.length > 0;
  const hasMetaOnly = !hasBattle && meta.length > 0;
  const parts = [];
  if (hasBattle) parts.push(battle.join(" | "));
  if (meta.length) parts.push(`мета: ${meta.join(" | ")}`);
  if (syn.length) parts.push(`синергии: ${syn.join(" | ")}`);

  return {
    mechanic_layer: hasMetaOnly
      ? "только prep/магазин"
      : hasBattle
        ? "бой (рюкзак)"
        : syn.length
          ? "только синергии"
          : "—",
    runtime_mechanics: parts.join(" · ") || "—",
    works_in_battle: hasBattle ? "да" : syn.length ? "косвенно" : "нет",
    works_in_prep: meta.length || syn.length ? "да" : hasBattle ? "—" : "нет",
    export_note: !def.description && hasBattle ? "нет текста описания — механика в effects" : "",
    battle_mechanics: battle.join(" | "),
    meta_mechanics: meta.join(" | "),
    synergies: syn.join(" | "),
  };
}

function summarizeEffect(effect) {
  const parts = [effect.type];
  if (effect.trigger || effect.phase) parts.push(`@${effect.trigger || effect.phase}`);
  if (effect.value != null) parts.push(`=${effect.value}`);
  if (effect.valueMin != null || effect.valueMax != null) {
    parts.push(`[${effect.valueMin ?? "?"}…${effect.valueMax ?? "?"}]`);
  }
  if (effect.chance != null) parts.push(`${Math.round(effect.chance * 100)}%`);
  if (effect.stat) parts.push(`stat:${effect.stat}`);
  if (effect.stack) parts.push(`stack:${effect.stack}`);
  if (effect.damageType) parts.push(`dmg:${effect.damageType}`);
  if (effect.build) parts.push(`build:${effect.build}`);
  return parts.join(" ");
}

function summarizeSynergy(syn) {
  const tags = syn.neighborTags?.join("+") || "?";
  const apply = syn.apply ? `${syn.apply.type}:${syn.apply.value ?? "?"}` : "";
  return `${syn.adjacency || "adj"} → ${tags} (${apply})`;
}

function shapeLabel(def) {
  const cells = Array.isArray(def.shape) ? def.shape.length : 1;
  if (def.isContainer) {
    const slots = (def.internalCols || 0) * (def.internalRows || 0);
    return `контейнер ${slots} сл.`;
  }
  return cells === 1 ? "1×1" : `${cells} кл.`;
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function main() {
  const { catalog, getEnhancementDef, getAmplifierDef } = loadCatalog();
  const helpers = { getEnhancementDef, getAmplifierDef };
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/item-pool-120-manifest.json"), "utf8"));
  const layerById = new Map();
  for (const [layer, ids] of Object.entries(manifest.layers)) {
    ids.forEach((id) => {
      layerById.set(id, layer);
    });
  }

  const ids = manifest.items.filter((id) => catalog[id]);
  const missing = manifest.items.filter((id) => !catalog[id]);
  if (missing.length) {
    console.warn("Нет в каталоге:", missing.join(", "));
  }

  const rows = ids.map((id) => {
    const def = catalog[id];
    const layer = layerById.get(id) || "?";
    const runtime = resolveRuntimeMechanics(def, helpers);
    const playerText =
      def.description || (def.isEnhancementItem ? getEnhancementDef?.(def.enhancementId || def.id)?.desc : "") || "";
    return {
      layer,
      layer_label: LAYER_LABELS[layer] || layer,
      id,
      name: def.name || id,
      icon: def.icon || "",
      rarity: def.rarity || "",
      cost: def.cost ?? "",
      shape: shapeLabel(def),
      tags: (def.tags || []).join(", "),
      cooldown: def.cooldown ?? "",
      stamina: def.staminaCost ?? "",
      sockets: def.sockets ?? "",
      description: playerText,
      build_hints: def.buildHints || "",
      mechanic_layer: runtime.mechanic_layer,
      runtime_mechanics: runtime.runtime_mechanics,
      works_in_battle: runtime.works_in_battle,
      works_in_prep: runtime.works_in_prep,
      export_note: runtime.export_note,
      battle_mechanics: runtime.battle_mechanics,
      meta_mechanics: runtime.meta_mechanics,
      synergies: runtime.synergies,
      craft_only: def.craftOnly ? "да" : "",
      is_enhancement: def.isEnhancementItem ? "да" : "",
      is_amplifier: def.isAmplifierItem ? "да" : "",
      is_build_key: def.isBuildKey ? "да" : "",
      unlock_build: def.unlockBuild || "",
      recommended_triple: def.recommendedTriple || "",
    };
  });

  const columns = [
    "layer_label",
    "id",
    "name",
    "icon",
    "rarity",
    "cost",
    "shape",
    "tags",
    "mechanic_layer",
    "runtime_mechanics",
    "works_in_battle",
    "works_in_prep",
    "description",
    "build_hints",
    "export_note",
    "battle_mechanics",
    "meta_mechanics",
    "synergies",
    "craft_only",
    "is_enhancement",
    "is_amplifier",
    "is_build_key",
    "unlock_build",
    "recommended_triple",
    "cooldown",
    "stamina",
    "sockets",
  ];
  const header = columns.join(",");
  const csvLines = [header, ...rows.map((r) => columns.map((c) => csvEscape(r[c])).join(","))];
  fs.writeFileSync(OUT_CSV, `${csvLines.join("\n")}\n`, "utf8");

  const md = [];
  md.push("# Пул предметов v240 — выгрузка");
  md.push("");
  md.push(`Сгенерировано: ${new Date().toISOString().slice(0, 10)} · **${rows.length}** предметов`);
  md.push("");
  md.push(
    "> Не все колонки `battle_mechanics` = боевой эффект. Усиления, усилители, ключи и сумки работают через **отдельные слои** — смотри `mechanic_layer` и `runtime_mechanics`.",
  );
  md.push("");
  md.push("CSV: `tools/pool120-items-export.csv`");
  md.push("");
  const summary = {};
  rows.forEach((r) => {
    summary[r.mechanic_layer] = (summary[r.mechanic_layer] || 0) + 1;
  });
  md.push("### Сводка по слоям механик");
  md.push("");
  Object.entries(summary).forEach(([k, n]) => {
    md.push(`- **${k}**: ${n}`);
  });
  md.push("");

  const layerOrder = ["starter", "enhancement", "amplifier", "key", "triple_support", "core_shop"];
  for (const layer of layerOrder) {
    const group = rows.filter((r) => r.layer === layer);
    if (!group.length) continue;
    md.push(`## ${LAYER_LABELS[layer]} (${group.length})`);
    md.push("");
    for (const r of group) {
      md.push(`### ${r.icon} ${r.name} (\`${r.id}\`)`);
      md.push("");
      md.push(`| | |`);
      md.push(`|---|---|`);
      md.push(`| Слой | ${r.layer_label} |`);
      md.push(`| Редкость | ${r.rarity} |`);
      md.push(`| Цена | ${r.cost} |`);
      md.push(`| Форма | ${r.shape} |`);
      md.push(`| Теги | ${r.tags || "—"} |`);
      md.push(`| Слой механик | **${r.mechanic_layer}** |`);
      md.push(`| Работает в бою | ${r.works_in_battle} |`);
      md.push(`| Работает в prep | ${r.works_in_prep} |`);
      md.push(`| Реально делает | ${r.runtime_mechanics || "—"} |`);
      if (r.cooldown !== "") md.push(`| КД | ${r.cooldown}с |`);
      if (r.stamina !== "") md.push(`| Стамина | ${r.stamina} |`);
      if (r.sockets !== "") md.push(`| Гнёзда | ${r.sockets} |`);
      md.push(`| Описание | ${r.description || "—"} |`);
      if (r.build_hints) md.push(`| Билд | ${r.build_hints} |`);
      if (r.export_note) md.push(`| ⚠️ | ${r.export_note} |`);
      if (r.battle_mechanics && r.mechanic_layer.includes("бой")) {
        md.push(`| effects[] | ${r.battle_mechanics} |`);
      }
      if (r.meta_mechanics) md.push(`| Мета | ${r.meta_mechanics} |`);
      if (r.synergies) md.push(`| Синергии | ${r.synergies} |`);
      if (r.unlock_build) md.push(`| Ветка | ${r.unlock_build} |`);
      if (r.recommended_triple) md.push(`| Тройка | ${r.recommended_triple} |`);
      md.push("");
    }
  }

  fs.writeFileSync(OUT_MD, md.join("\n"), "utf8");
  console.log(`CSV → ${OUT_CSV}`);
  console.log(`MD  → ${OUT_MD}`);
  console.log(`Предметов: ${rows.length}`);
}

main();
