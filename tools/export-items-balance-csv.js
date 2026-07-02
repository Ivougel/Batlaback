#!/usr/bin/env node
/**
 * Полная выгрузка каталога предметов для баланса.
 * Запуск: node tools/export-items-balance-csv.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_PATH = path.join(__dirname, "items-balance-export.csv");

function loadCatalog() {
  const itemsJs = fs.readFileSync(path.join(ROOT, "items.js"), "utf8");
  const catalogJs = fs.readFileSync(path.join(ROOT, "items-catalog.js"), "utf8");
  const fn = new Function(`${itemsJs}\n${catalogJs}\nreturn { catalog: ITEM_CATALOG, craftIds: typeof CRAFT_OUTPUT_IDS !== "undefined" ? CRAFT_OUTPUT_IDS : new Set() };`);
  return fn();
}

function normalizeShape(shape) {
  if (Array.isArray(shape) && shape.length) return shape;
  if (shape && typeof shape.w === "number" && typeof shape.h === "number") {
    const cells = [];
    for (let r = 0; r < shape.h; r++) {
      for (let c = 0; c < shape.w; c++) cells.push([c, r]);
    }
    return cells.length ? cells : [[0, 0]];
  }
  return [[0, 0]];
}

function getCellCount(def) {
  return normalizeShape(def.shape).length;
}

function getShapeBounds(def) {
  const cells = normalizeShape(def.shape);
  let minC = Infinity;
  let minR = Infinity;
  let maxC = -Infinity;
  let maxR = -Infinity;
  cells.forEach(([c, r]) => {
    minC = Math.min(minC, c);
    minR = Math.min(minR, r);
    maxC = Math.max(maxC, c);
    maxR = Math.max(maxR, r);
  });
  return {
    cells: cells.length,
    width: maxC - minC + 1,
    height: maxR - minR + 1,
    label: cells.length === 1
      ? "1×1"
      : `${maxC - minC + 1}×${maxR - minR + 1} (${cells.length} кл.)`,
  };
}

const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, godly: 5, unique: 6 };
const DAMAGE_SPREAD = { common: 2, uncommon: 3, rare: 4, legendary: 5 };

function resolveDamageRange(effect, def) {
  if (!effect || effect.type !== "damage") return { min: 0, max: 0 };
  if (effect.valueMin != null || effect.valueMax != null) {
    const max = effect.valueMax ?? effect.value ?? 1;
    const min = effect.valueMin ?? Math.max(1, max - 2);
    return { min: Math.min(min, max), max };
  }
  const max = Math.max(1, effect.value || 1);
  const spread = DAMAGE_SPREAD[def?.rarity] ?? 2;
  return { min: Math.max(1, max - spread), max };
}

function avgDamage(effect, def) {
  const { min, max } = resolveDamageRange(effect, def);
  return (min + max) / 2;
}

function scoreItemPower(def) {
  if (!def || def.isContainer) return 0;

  const cd = Math.max(0.8, def.cooldown || 2.5);
  const pace = 2.2 / cd;
  const chance = (c) => (typeof c === "number" ? c : 1);
  let score = 0;

  const fx = [...(def.effects || []), ...(def.metaEffects || [])];

  fx.forEach((effect) => {
    const tr = effect.trigger || effect.phase;
    const isPassive = tr === "passive" || tr === "battle_start";

    switch (effect.type) {
      case "damage":
        if (tr === "on_hit" || tr === "on_block" || tr === "on_miss") break;
        score += avgDamage(effect, def) * pace * 3.2 * chance(effect.chance);
        break;
      case "block":
        score += (effect.value || 0) * pace * 2.4 * chance(effect.chance);
        break;
      case "heal":
        score += (effect.value || 0) * pace * 1.8 * chance(effect.chance);
        break;
      case "poison": {
        const interval = effect.interval > 1 ? effect.interval : 1;
        score += (effect.value || 1) * (pace / interval) * 2.2 * chance(effect.chance);
        break;
      }
      case "groundFire":
        score += (effect.value || 2) * pace * 1.5;
        break;
      case "slow":
        score += 4 * pace * chance(effect.chance);
        break;
      case "buffTimed":
        score += (effect.value || 0.1) * 100 * pace * 0.35;
        break;
      case "passiveDefense":
        score += (effect.value || 0) * 1.15;
        break;
      case "passiveMaxHp":
        score += (effect.value || 0) * 0.4;
        break;
      case "passiveLuck":
        score += (effect.value || 0) * 3;
        break;
      case "statMult": {
        const v = effect.value || 0;
        const stat = effect.stat || "";
        if (stat.includes("damage") || stat.includes("crit")) score += v * 35;
        else if (stat.includes("cooldown") && v < 0) score += Math.abs(v) * 40;
        else if (stat.includes("block") || stat.includes("defense")) score += v * 25;
        else if (stat.includes("maxHp")) score += v * 20;
        else score += v * 15;
        break;
      }
      case "cooldownReduction":
      case "cooldownMultPerTag":
        score += Math.abs(effect.value || effect.perTag || 0) * 30;
        break;
      case "lifesteal":
        score += (effect.value || 0) * 40;
        break;
      case "shieldBlockMult":
        score += (effect.value || 0) * 25;
        break;
      case "gainStack":
        score += (effect.value || 1) * 2.5 * (isPassive ? 1 : pace * 0.5) * chance(effect.chance);
        break;
      case "damagePerStack":
        score += (effect.value || 1) * 4;
        break;
      case "damagePerTag":
        score += (effect.value || 1) * 3;
        break;
      case "damagePerFoeDebuff":
        score += (effect.value || 1) * 5;
        break;
      case "damageBonus":
      case "blockBonus":
      case "healBonus":
        score += (effect.value || 0) * 3;
        break;
      case "onHitCapBonus":
        score += (effect.value || 0) * (effect.cap || 1) * 0.5 * chance(effect.chance);
        break;
      case "breakBlockOnHit":
        score += (effect.value || 0) * 0.8 * chance(effect.chance);
        break;
      case "applyStun":
        score += 6 * chance(effect.chance);
        break;
      case "extraAttackOnStun":
        score += 8;
        break;
      case "periodic":
        score += 5;
        break;
      case "stackThreshold":
        score += 4;
        break;
      case "activationThreshold":
        score += 3;
        break;
      case "invulnOnStaminaSpend":
        score += 12;
        break;
      case "battleRageLowHp":
        score += 8;
        break;
      case "foeHpThreshold":
        score += (effect.damageMult || 0) * 15;
        break;
      case "procChanceBonus":
        score += (effect.value || 0) * 20;
        break;
      case "stealWeaponDamage":
      case "stealRandomStack":
        score += 6;
        break;
      case "dig_item":
        score += 8;
        break;
      case "offer_tag":
        score += 2;
        break;
      default:
        break;
    }
  });

  if (def.stats?.defense) score += def.stats.defense * 1.1;
  if (def.stats?.maxHp) score += def.stats.maxHp * 0.25;
  if (def.stats?.damage) score += def.stats.damage * 0.5;
  score += (def.sockets || 0) * 2;
  score += (def.cost || 0) * 0.12;

  return Math.round(score * 10) / 10;
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function summarizeEffect(effect) {
  const parts = [effect.type];
  if (effect.trigger || effect.phase) parts.push(`@${effect.trigger || effect.phase}`);
  if (effect.value != null) parts.push(`v=${effect.value}`);
  if (effect.valueMin != null || effect.valueMax != null) {
    parts.push(`rng=${effect.valueMin ?? "?"}-${effect.valueMax ?? "?"}`);
  }
  if (effect.chance != null) parts.push(`ch=${Math.round(effect.chance * 100)}%`);
  if (effect.stat) parts.push(`stat=${effect.stat}`);
  if (effect.stack) parts.push(`stack=${effect.stack}`);
  if (effect.interval) parts.push(`int=${effect.interval}`);
  if (effect.tag) parts.push(`tag=${effect.tag}`);
  if (effect.tags) parts.push(`tags=${effect.tags.join("+")}`);
  return parts.join(" ");
}

function summarizeSynergy(syn) {
  const parts = [syn.id || "syn"];
  if (syn.adjacency) parts.push(syn.adjacency);
  if (syn.neighborTags?.length) parts.push(`→${syn.neighborTags.join("+")}`);
  if (syn.apply?.type) parts.push(`+${syn.apply.type}:${syn.apply.value ?? "?"}`);
  return parts.join(" ");
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsv(row, columns) {
  return columns.map((col) => csvEscape(row[col])).join(",");
}

function main() {
  const { catalog, craftIds } = loadCatalog();
  const items = Object.values(catalog).sort((a, b) => {
    const ra = RARITY_RANK[a.rarity] ?? 99;
    const rb = RARITY_RANK[b.rarity] ?? 99;
    if (ra !== rb) return ra - rb;
    return (a.name || "").localeCompare(b.name || "", "ru");
  });

  const combatRows = items.filter((d) => !d.isContainer);
  const densityByRarity = {};
  combatRows.forEach((def) => {
    const rarity = def.rarity || "common";
    if (!densityByRarity[rarity]) densityByRarity[rarity] = [];
    const cells = getCellCount(def);
    const power = scoreItemPower(def);
    densityByRarity[rarity].push(cells > 0 ? power / cells : 0);
  });
  const expectedDensity = {};
  Object.entries(densityByRarity).forEach(([rarity, list]) => {
    expectedDensity[rarity] = median(list);
  });
  const globalMedianDensity = median(
    combatRows
      .filter((d) => !d.craftOnly)
      .map((d) => {
        const cells = getCellCount(d);
        const power = scoreItemPower(d);
        return cells > 0 ? power / cells : 0;
      }),
  );

  const rows = items.map((def) => {
    const shape = getShapeBounds(def);
    const cells = shape.cells;
    const power = scoreItemPower(def);
    const density = cells > 0 ? Math.round((power / cells) * 100) / 100 : 0;
    const rarity = def.rarity || "common";
    const expected = expectedDensity[rarity] || globalMedianDensity;
    const densityRatio = expected > 0 ? Math.round((density / expected) * 1000) / 1000 : 1;

    const battleEffects = (def.effects || []).map(summarizeEffect);
    const metaEffects = (def.metaEffects || []).map(summarizeEffect);
    const synergies = (def.synergies || []).map(summarizeSynergy);

    const effectTypes = [...new Set((def.effects || []).map((e) => e.type))].join("; ");
    const metaTypes = [...new Set((def.metaEffects || []).map((e) => e.type))].join("; ");
    const triggers = [...new Set(
      [...(def.effects || []), ...(def.metaEffects || [])]
        .map((e) => e.trigger || e.phase)
        .filter(Boolean),
    )].join("; ");

    const shopEligible = !def.craftOnly
      && !craftIds.has(def.id)
      && (!def.classRestriction || true)
      && (!def.isContainer || (def.shopContainer && !def.immovable));

    return {
      id: def.id,
      name: def.name,
      icon: def.icon || "",
      rarity,
      cost: def.cost ?? 0,
      cells,
      shape_bbox: `${shape.width}×${shape.height}`,
      shape_label: shape.label,
      is_container: def.isContainer ? "да" : "нет",
      container_slots: def.isContainer ? (def.internalCols || 0) * (def.internalRows || 0) : "",
      craft_only: def.craftOnly ? "да" : "нет",
      in_shop: shopEligible ? "да" : "нет",
      class_restriction: def.classRestriction || "",
      tags: (def.tags || []).join("; "),
      cooldown: def.cooldown ?? "",
      stamina_cost: def.staminaCost ?? "",
      stat_damage: def.stats?.damage ?? 0,
      stat_defense: def.stats?.defense ?? 0,
      stat_max_hp: def.stats?.maxHp ?? 0,
      sockets: def.sockets ?? 0,
      gold_per_round: def.goldPerRound ?? 0,
      min_shop_round: def.minShopRound ?? "",
      effect_types: effectTypes,
      meta_effect_types: metaTypes,
      triggers,
      battle_mechanics: battleEffects.join(" | "),
      shop_mechanics: metaEffects.join(" | "),
      synergies: synergies.join(" | "),
      synergies_count: synergies.length,
      description: def.description || "",
      build_hints: def.buildHints || "",
      power_score: power,
      power_per_cell: density,
      cost_per_cell: cells > 0 ? Math.round(((def.cost ?? 0) / cells) * 100) / 100 : "",
      expected_density_rarity: Math.round((expected || 0) * 100) / 100,
      density_vs_rarity: densityRatio,
      density_vs_global: globalMedianDensity > 0
        ? Math.round((density / globalMedianDensity) * 1000) / 1000
        : 1,
    };
  });

  const columns = [
    { key: "id", header: "id" },
    { key: "name", header: "название" },
    { key: "icon", header: "иконка" },
    { key: "rarity", header: "редкость" },
    { key: "cost", header: "цена" },
    { key: "cells", header: "клеток" },
    { key: "shape_bbox", header: "форма_бокс" },
    { key: "shape_label", header: "форма" },
    { key: "is_container", header: "контейнер" },
    { key: "container_slots", header: "слотов_внутри" },
    { key: "craft_only", header: "только_крафт" },
    { key: "in_shop", header: "в_магазине" },
    { key: "class_restriction", header: "класс" },
    { key: "tags", header: "теги" },
    { key: "cooldown", header: "кд_сек" },
    { key: "stamina_cost", header: "стамина" },
    { key: "stat_damage", header: "урон_стат" },
    { key: "stat_defense", header: "защита_стат" },
    { key: "stat_max_hp", header: "хп_стат" },
    { key: "sockets", header: "гнёзда" },
    { key: "gold_per_round", header: "золото_раунд" },
    { key: "min_shop_round", header: "мин_раунд_магазин" },
    { key: "effect_types", header: "типы_эффектов" },
    { key: "meta_effect_types", header: "типы_мета_эффектов" },
    { key: "triggers", header: "триггеры" },
    { key: "battle_mechanics", header: "механики_боя" },
    { key: "shop_mechanics", header: "механики_магазина" },
    { key: "synergies_count", header: "синергий" },
    { key: "synergies", header: "синергии" },
    { key: "description", header: "описание" },
    { key: "build_hints", header: "подсказки_билда" },
    { key: "power_score", header: "оценка_силы" },
    { key: "power_per_cell", header: "сила_на_клетку" },
    { key: "cost_per_cell", header: "цена_на_клетку" },
    { key: "expected_density_rarity", header: "норма_сила_клетка_редкость" },
    { key: "density_vs_rarity", header: "отклонение_от_нормы_редкости" },
    { key: "density_vs_global", header: "отклонение_от_глоб_нормы" },
  ];

  const lines = [
    columns.map((c) => csvEscape(c.header)).join(","),
    ...rows.map((row) => rowToCsv(row, columns.map((c) => c.key))),
  ];

  fs.writeFileSync(OUT_PATH, `\uFEFF${lines.join("\n")}\n`, "utf8");
  console.log(`Экспорт: ${OUT_PATH}`);
  console.log(`Предметов: ${rows.length} (контейнеров: ${rows.filter((r) => r.is_container === "да").length})`);
}

main();
