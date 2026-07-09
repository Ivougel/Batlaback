#!/usr/bin/env node
/**
 * Аудит: мощность предмета vs занимаемые клетки инвентаря.
 * Запуск: node tools/audit-item-shapes.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function loadCatalog() {
  const itemsJs = fs.readFileSync(path.join(ROOT, "items.js"), "utf8");
  const catalogJs = fs.readFileSync(path.join(ROOT, "items-catalog.js"), "utf8");
  const fn = new Function(`${itemsJs}\n${catalogJs}\nreturn ITEM_CATALOG;`);
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

function getShapeLabel(def) {
  const cells = normalizeShape(def.shape);
  if (cells.length === 1) return "1×1";
  let minC = Infinity,
    minR = Infinity,
    maxC = -Infinity,
    maxR = -Infinity;
  cells.forEach(([c, r]) => {
    minC = Math.min(minC, c);
    minR = Math.min(minR, r);
    maxC = Math.max(maxC, c);
    maxR = Math.max(maxR, r);
  });
  return `${maxC - minC + 1}×${maxR - minR + 1} (${cells.length} кл.)`;
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

/** Расширенная оценка силы (без синергий/камней, solo). */
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
      case "damage": {
        if (tr === "on_hit" || tr === "on_block" || tr === "on_miss") break;
        score += avgDamage(effect, def) * pace * 3.2 * chance(effect.chance);
        break;
      }
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

/** Ожидаемая плотность силы (power/cell) по редкости — медиана. */
function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function main() {
  const catalog = loadCatalog();
  const items = Object.values(catalog).filter((d) => !d.isContainer && !d.craftOnly);

  const rows = items.map((def) => {
    const cells = getCellCount(def);
    const power = scoreItemPower(def);
    const density = power / cells;
    const costPerCell = (def.cost || 0) / cells;
    return {
      id: def.id,
      name: def.name,
      rarity: def.rarity || "common",
      cost: def.cost || 0,
      cells,
      shape: getShapeLabel(def),
      power,
      density,
      costPerCell,
      tags: (def.tags || []).slice(0, 4).join(", "),
    };
  });

  const byRarity = {};
  rows.forEach((r) => {
    if (!byRarity[r.rarity]) byRarity[r.rarity] = [];
    byRarity[r.rarity].push(r);
  });

  const expectedDensity = {};
  Object.entries(byRarity).forEach(([rarity, list]) => {
    expectedDensity[rarity] = median(list.map((x) => x.density));
  });

  const globalMedianDensity = median(rows.map((r) => r.density));

  rows.forEach((r) => {
    const expected = expectedDensity[r.rarity] || globalMedianDensity;
    r.expectedDensity = expected;
    r.densityRatio = expected > 0 ? r.density / expected : 1;
    r.globalDensityRatio = globalMedianDensity > 0 ? r.density / globalMedianDensity : 1;
  });

  const flagged = rows
    .filter((r) => r.densityRatio >= 1.35 && r.power >= 15)
    .sort((a, b) => b.densityRatio - a.densityRatio);

  const singleCellStrong = rows.filter((r) => r.cells === 1 && r.power >= 25).sort((a, b) => b.power - a.power);

  const undersizedWeapons = rows
    .filter((r) => r.tags.includes("weapon") && r.cells <= 2 && r.power >= 30)
    .sort((a, b) => b.density - a.density);

  console.log("=== АУДИТ: МОЩНОСТЬ vs РАЗМЕР В ИНВЕНТАРЕ ===\n");
  console.log(`Всего предметов (без контейнеров/крафт-only): ${rows.length}`);
  console.log(`Медиана плотности силы (power/cell): ${globalMedianDensity.toFixed(1)}\n`);

  console.log("--- Медиана power/cell по редкости ---");
  Object.keys(RARITY_RANK)
    .filter((k) => byRarity[k]?.length)
    .sort((a, b) => RARITY_RANK[a] - RARITY_RANK[b])
    .forEach((rarity) => {
      const list = byRarity[rarity];
      const avgCells = list.reduce((s, x) => s + x.cells, 0) / list.length;
      console.log(
        `  ${rarity.padEnd(10)} n=${String(list.length).padStart(3)}  ` +
          `медиана=${expectedDensity[rarity].toFixed(1).padStart(5)}  ` +
          `ср.клеток=${avgCells.toFixed(2)}`,
      );
    });

  console.log("\n--- Распределение по размеру ---");
  const byCells = {};
  rows.forEach((r) => {
    byCells[r.cells] = (byCells[r.cells] || 0) + 1;
  });
  Object.keys(byCells)
    .sort((a, b) => a - b)
    .forEach((c) => {
      const subset = rows.filter((r) => r.cells === Number(c));
      const medPow = median(subset.map((x) => x.power));
      console.log(`  ${c} кл.: ${byCells[c]} предм., медиана power=${medPow.toFixed(0)}`);
    });

  console.log("\n=== ТОП: слишком мощные для своего размера (density ≥135% от медианы редкости, power≥15) ===");
  flagged.slice(0, 40).forEach((r, i) => {
    console.log(
      `${String(i + 1).padStart(2)}. [${r.rarity}] ${r.name} (${r.id})` +
        ` | ${r.shape} | power=${r.power} | ${r.density.toFixed(0)}/cell` +
        ` (${(r.densityRatio * 100).toFixed(0)}% от нормы) | ${r.cost}💰`,
    );
  });

  console.log("\n=== 1×1 предметы с power ≥ 25 ===");
  singleCellStrong.slice(0, 30).forEach((r, i) => {
    console.log(`${String(i + 1).padStart(2)}. [${r.rarity}] ${r.name} | power=${r.power} | ${r.cost}💰 | ${r.tags}`);
  });

  console.log("\n=== Оружие ≤2 клеток с power ≥ 30 ===");
  undersizedWeapons.slice(0, 25).forEach((r, i) => {
    console.log(
      `${String(i + 1).padStart(2)}. [${r.rarity}] ${r.name} | ${r.shape} | power=${r.power} | ${r.density.toFixed(0)}/cell | ${r.cost}💰`,
    );
  });

  console.log("\n=== Недооценённые по размеру (рекомендация увеличить форму) — топ-15 ===");
  const recommendations = flagged
    .filter((r) => r.cells <= 2)
    .slice(0, 15)
    .map((r) => {
      const targetCells = r.cells === 1 ? 2 : Math.min(r.cells + 1, 4);
      const targetShape = r.cells === 1 ? "1×2 или 2×1" : `${r.cells + 1} кл. (L/T-форма)`;
      return { ...r, targetCells, targetShape };
    });
  recommendations.forEach((r, i) => {
    console.log(
      `${i + 1}. ${r.name} [${r.rarity}]: сейчас ${r.shape}, power=${r.power}` + ` → предложение: ${r.targetShape}`,
    );
  });

  const outPath = path.join(__dirname, "audit-item-shapes-report.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totals: { items: rows.length, globalMedianDensity },
        expectedDensityByRarity: expectedDensity,
        flagged: flagged.slice(0, 60),
        singleCellStrong: singleCellStrong.slice(0, 40),
        undersizedWeapons: undersizedWeapons.slice(0, 30),
        all: rows.sort((a, b) => b.densityRatio - a.densityRatio),
      },
      null,
      2,
    ),
  );
  console.log(`\nПолный отчёт: ${outPath}`);
}

main();
