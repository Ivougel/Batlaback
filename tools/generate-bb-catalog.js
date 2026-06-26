#!/usr/bin/env node
/**
 * Генерирует items-bb-catalog.js из tools/items-migrated.json
 * Запуск: node tools/generate-bb-catalog.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(__dirname, "items-migrated.json");
const OUT = path.join(ROOT, "items-bb-catalog.js");

function esc(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function shapeExpr(shape) {
  if (Array.isArray(shape)) {
    return JSON.stringify(shape);
  }
  const { w, h } = shape;
  if (w === 1 && h === 1) return "[[0, 0]]";
  return `shapeRect(${w}, ${h})`;
}

function fmtEffects(effects) {
  if (!effects?.length) return "[]";
  return `[\n${effects.map((e) => {
    const parts = Object.entries(e)
      .filter(([, v]) => v != null)
      .map(([k, v]) => {
        if (typeof v === "string") return `${k}: "${esc(v)}"`;
        if (typeof v === "boolean") return `${k}: ${v}`;
        if (Array.isArray(v) || (typeof v === "object" && v !== null)) {
          return `${k}: ${JSON.stringify(v)}`;
        }
        return `${k}: ${v}`;
      });
    return `      { ${parts.join(", ")} }`;
  }).join(",\n")}\n    ]`;
}

function fmtMetaEffects(meta) {
  if (!meta?.length) return null;
  return `metaEffects: ${fmtEffects(meta)}`;
}

function fmtSynergies(synergies) {
  if (!synergies?.length) return "[]";
  return `[\n${synergies.map((s) => {
    const apply = s.apply;
    const applyStr = `apply: { type: "${apply.type}", value: ${apply.value}${apply.buffTargetTags ? `, buffTargetTags: ${JSON.stringify(apply.buffTargetTags)}` : ""}${apply.cap != null ? `, cap: ${apply.cap}` : ""} }`;
    return `      { id: "${esc(s.id)}", adjacency: "${s.adjacency}", neighborTags: ${JSON.stringify(s.neighborTags)}, target: "${s.target}", ${applyStr}, desc: "${esc(s.desc || "")}" }`;
  }).join(",\n")}\n    ]`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const protectedSet = new Set(data.protectedIds || []);
  const entries = data.items.filter((item) => !item.protected && !protectedSet.has(item.id));

  const lines = [
    "/**",
    " * Каталог Backpack Battles — сгенерировано tools/generate-bb-catalog.js",
    " * Не редактировать вручную. Источник: tools/items-migrated.json",
    " */",
    "",
    "const BB_ITEM_CATALOG_RAW = {",
  ];

  entries.forEach((item, idx) => {
    const comma = idx < entries.length - 1 ? "," : "";
    const isContainer = !!item.isContainer;

    if (isContainer) {
      const opts = [
        `id: "${esc(item.id)}"`,
        `name: "${esc(item.name)}"`,
        `icon: "${esc(item.icon)}"`,
        `color: "${esc(item.color)}"`,
        `shape: ${shapeExpr(item.shape)}`,
        `internalCols: ${item.internalCols}`,
        `internalRows: ${item.internalRows}`,
        "isContainer: true",
        item.shopContainer ? "shopContainer: true" : null,
        "immovable: false",
        item.classRestriction ? `classRestriction: "${item.classRestriction}"` : null,
        `rarity: "${item.rarity}"`,
        `cost: ${item.cost}`,
        `tags: ${JSON.stringify(item.tags)}`,
        "stats: {}",
        "cooldown: 0",
        "effects: []",
        item.craftOnly ? "craftOnly: true" : null,
        item.synergies?.length ? `synergies: ${fmtSynergies(item.synergies)}` : "synergies: []",
        item.description ? `description: "${esc(item.description)}"` : null,
        item.buildHints ? `buildHints: "${esc(item.buildHints)}"` : null,
        item.goldPerRound > 0 ? `goldPerRound: ${item.goldPerRound}` : null,
        "_isContainerEntry: true",
      ].filter(Boolean);

      lines.push(`  ${item.id}: {`);
      opts.forEach((o) => lines.push(`    ${o},`));
      lines.push(`  }${comma}`);
      return;
    }

    const opts = [
      `id: "${esc(item.id)}"`,
      `name: "${esc(item.name)}"`,
      `icon: "${esc(item.icon)}"`,
      `color: "${esc(item.color)}"`,
      `shape: ${shapeExpr(item.shape)}`,
      item.classRestriction ? `classRestriction: "${item.classRestriction}"` : null,
      `rarity: "${item.rarity}"`,
      `cost: ${item.cost}`,
      `tags: ${JSON.stringify(item.tags)}`,
      item.damage != null ? `damage: ${item.damage}` : null,
      item.defense != null ? `defense: ${item.defense}` : null,
      `cooldown: ${item.cooldown}`,
      item.staminaCost != null ? `staminaCost: ${item.staminaCost}` : null,
      item.craftOnly ? "craftOnly: true" : null,
      `effects: ${fmtEffects(item.effects)}`,
      item.synergies?.length ? `synergies: ${fmtSynergies(item.synergies)}` : null,
      fmtMetaEffects(item.metaEffects),
      item.description ? `description: "${esc(item.description)}"` : null,
      item.buildHints ? `buildHints: "${esc(item.buildHints)}"` : null,
      item.goldPerRound > 0 ? `goldPerRound: ${item.goldPerRound}` : null,
      item.sockets > 0 ? `sockets: ${item.sockets}` : null,
    ].filter(Boolean);

    lines.push(`  ${item.id}: {`);
    opts.forEach((o) => lines.push(`    ${o},`));
    lines.push(`  }${comma}`);
  });

  lines.push("};");
  lines.push("");

  const craftIds = data.items.filter((item) => item.craftOnly).map((item) => item.id);
  lines.push(`const CRAFT_OUTPUT_IDS = new Set(${JSON.stringify(craftIds)});`);
  lines.push("");
  lines.push("function buildBBCatalog() {");
  lines.push("  const out = {};");
  lines.push("  Object.entries(BB_ITEM_CATALOG_RAW).forEach(([key, opts]) => {");
  lines.push("    if (opts._isContainerEntry) {");
  lines.push("      const { _isContainerEntry, ...container } = opts;");
  lines.push("      out[key] = container;");
  lines.push("      return;");
  lines.push("    }");
  lines.push("    out[key] = defItem(opts);");
  lines.push("  });");
  lines.push("  return out;");
  lines.push("}");
  lines.push("");
  lines.push("if (typeof ITEM_CATALOG !== \"undefined\" && typeof defItem === \"function\") {");
  lines.push("  Object.assign(ITEM_CATALOG, buildBBCatalog());");
  lines.push("}");
  lines.push("");

  fs.writeFileSync(OUT, lines.join("\n"), "utf8");
  console.log(`Сгенерировано ${entries.length} предметов → ${path.relative(ROOT, OUT)}`);
  console.log(`Пропущено (protected): ${data.items.length - entries.length}`);
}

main();
