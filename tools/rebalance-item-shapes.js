#!/usr/bin/env node
/**
 * Пересчёт shape всех предметов от якоря Maneki-neko (2 клетки).
 * Запуск: node tools/rebalance-item-shapes.js [--dry-run]
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const MIGRATED = path.join(__dirname, "items-migrated.json");
const ITEMS_JS = path.join(ROOT, "items.js");
const ANCHOR_ID = "maneki_neko";
const ANCHOR_CELLS = 2;
const MAX_CELLS = 6;
const DRY_RUN = process.argv.includes("--dry-run");

// --- scoring (копия audit-item-shapes.js) ---
const DAMAGE_SPREAD = { common: 2, uncommon: 3, rare: 4, legendary: 5 };

function loadCatalog() {
  const itemsJs = fs.readFileSync(ITEMS_JS, "utf8");
  const catalogJs = fs.readFileSync(path.join(ROOT, "items-catalog.js"), "utf8");
  const fn = new Function(`${itemsJs}\n${catalogJs}\nreturn ITEM_CATALOG;`);
  return fn();
}

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

function cellCountFromShape(shape) {
  if (Array.isArray(shape)) return shape.length;
  if (shape?.w && shape?.h) return shape.w * shape.h;
  return 1;
}

/** Подбор формы по числу клеток и тегам. */
function pickShape(cells, def) {
  const tags = def.tags || [];
  const weapon = tags.includes("weapon");
  const armor = tags.includes("armor");
  const shield = tags.includes("shield");
  const food = tags.includes("food");

  if (cells <= 1) return { w: 1, h: 1 };

  if (cells === 2) {
    if (weapon) return { w: 1, h: 2 };
    if (armor || shield) return { w: 2, h: 1 };
    if (food) return { w: 1, h: 2 };
    return { w: 2, h: 1 };
  }

  if (cells === 3) {
    if (weapon && !armor) return { w: 1, h: 3 };
    return [
      [0, 0],
      [1, 0],
      [0, 1],
    ];
  }

  if (cells === 4) return { w: 2, h: 2 };

  if (cells === 5)
    return [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ];

  if (cells === 6) return { w: 2, h: 3 };

  const w = 2;
  const h = Math.ceil(cells / w);
  if (w * h === cells) return { w, h };
  return [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [0, 2],
    [1, 2],
  ].slice(0, cells);
}

function targetCells(power, powerPerCell, id, currentCells) {
  if (id === ANCHOR_ID) return ANCHOR_CELLS;
  const computed = Math.min(MAX_CELLS, Math.max(1, Math.round(power / powerPerCell)));
  return Math.max(currentCells, computed);
}

function shapeToJsExpr(shape) {
  if (Array.isArray(shape)) {
    if (shape.length === 1) return "[[0, 0]]";
    return `[${shape.map(([c, r]) => `[${c}, ${r}]`).join(", ")}]`;
  }
  const { w, h } = shape;
  if (w === 1 && h === 1) return "[[0, 0]]";
  return `shapeRect(${w}, ${h})`;
}

function shapesEqual(a, b) {
  const norm = (s) => JSON.stringify(s);
  return norm(a) === norm(b);
}

function updateItemsJs(content, shapeMap, changedIds) {
  let updated = content;
  const ids = changedIds || Object.keys(shapeMap);
  for (const id of ids) {
    const shape = shapeMap[id];
    if (!shape) continue;
    const expr = shapeToJsExpr(shape);
    const re = new RegExp(
      `(\\s${id}:\\s*defItem\\(\\{[\\s\\S]*?\\n\\s*shape:\\s*)(\\[\\[[\\s\\S]*?\\]\\]|shapeRect\\(\\d+,\\s*\\d+\\))(,)`,
      "m",
    );
    if (!re.test(updated)) continue;
    updated = updated.replace(re, `$1${expr}$3`);
  }
  return updated;
}

function main() {
  const catalog = loadCatalog();
  const anchor = catalog[ANCHOR_ID];
  if (!anchor) {
    console.error(`Якорь ${ANCHOR_ID} не найден в каталоге`);
    process.exit(1);
  }

  const anchorPower = scoreItemPower(anchor);
  const powerPerCell = anchorPower / ANCHOR_CELLS;

  console.log(`Якорь: ${anchor.name} (${ANCHOR_ID})`);
  console.log(`  power=${anchorPower}, cells=${ANCHOR_CELLS}, power/cell=${powerPerCell.toFixed(2)}\n`);

  const shapeMap = {};
  const changes = [];

  Object.values(catalog).forEach((def) => {
    if (def.isContainer) return;
    const power = scoreItemPower(def);
    const prevShape = Array.isArray(def.shape)
      ? def.shape
      : def.shape?.w
        ? { w: def.shape.w, h: def.shape.h }
        : { w: 1, h: 1 };
    const oldCells = cellCountFromShape(prevShape);
    const cells = targetCells(power, powerPerCell, def.id, oldCells);
    const newShape = cells === oldCells && def.id !== ANCHOR_ID ? prevShape : pickShape(cells, def);
    shapeMap[def.id] = newShape;

    const newCellCount = cellCountFromShape(newShape);
    if (oldCells !== newCellCount || !shapesEqual(prevShape, newShape)) {
      changes.push({
        id: def.id,
        name: def.name,
        power,
        oldCells,
        newCells: newCellCount,
        shape: newShape,
      });
    }
  });

  changes.sort((a, b) => b.newCells - a.newCells || b.power - a.power);

  console.log(`Изменений: ${changes.length} из ${Object.keys(shapeMap).length} предметов\n`);
  changes.slice(0, 30).forEach((c) => {
    console.log(`  ${c.name} (${c.id}): ${c.oldCells}→${c.newCells} кл., power=${c.power}`);
  });
  if (changes.length > 30) console.log(`  ... и ещё ${changes.length - 30}`);

  if (DRY_RUN) {
    console.log("\n--dry-run: файлы не изменены");
    return;
  }

  const migrated = JSON.parse(fs.readFileSync(MIGRATED, "utf8"));
  let jsonUpdated = 0;
  migrated.items.forEach((item) => {
    if (item.isContainer || !shapeMap[item.id]) return;
    const next = shapeMap[item.id];
    const prev = item.shape;
    if (!shapesEqual(prev, next)) {
      item.shape = next;
      jsonUpdated += 1;
    }
  });
  fs.writeFileSync(MIGRATED, `${JSON.stringify(migrated, null, 2)}\n`, "utf8");
  console.log(`\nОбновлено в items-migrated.json: ${jsonUpdated}`);

  const itemsJs = fs.readFileSync(ITEMS_JS, "utf8");
  const protectedIds = new Set(migrated.protectedIds || []);
  const protectedShapeMap = {};
  protectedIds.forEach((id) => {
    if (shapeMap[id]) protectedShapeMap[id] = shapeMap[id];
  });
  // контейнеры в items.js
  ["starter_bag", "leather_pouch", "backpack", "storage_chest", "large_sack"].forEach((id) => {
    delete protectedShapeMap[id];
  });

  const newItemsJs = updateItemsJs(
    itemsJs,
    shapeMap,
    changes.map((c) => c.id),
  );
  if (newItemsJs !== itemsJs) {
    fs.writeFileSync(ITEMS_JS, newItemsJs, "utf8");
    const protectedChanged = changes.filter((c) => protectedIds.has(c.id)).length;
    console.log(`Обновлено в items.js: ${protectedChanged} protected`);
  }

  execSync("node tools/generate-bb-catalog.js", { cwd: ROOT, stdio: "inherit" });
  console.log("Каталог перегенерирован.");
}

main();
