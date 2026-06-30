#!/usr/bin/env node
/**
 * Сравнение вариантов пассивки жреца — без изменений в game-коде.
 * node tools/priest-passive-sweep.js
 */

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DT = 0.05;
const MAX_STEPS = Math.ceil(120 / DT) + 2;

const PRIEST_VARIANTS = {
  legacy_flat5: {
    label: "Legacy: +5 HP за еду",
    combatBonus: { type: "foodInventory", maxHpPerFood: 5 },
  },
  vB_current: {
    label: "vB (текущий): 3% HP + 25% хил еды",
    combatBonus: { type: "foodInventory", maxHpPctPerFood: 0.03, foodHealMult: 0.25 },
  },
  variant_A: {
    label: "A: +10 base HP + 4 HP/еда",
    combatBonus: { type: "foodInventory", baseMaxHp: 10, maxHpPerFood: 4 },
  },
  variant_B_plus: {
    label: "B+: 4% HP/еда + 30% хил + 8 base",
    combatBonus: { type: "foodInventory", baseMaxHp: 8, maxHpPctPerFood: 0.04, foodHealMult: 0.30 },
  },
  variant_B_pp: {
    label: "B++: 5% HP/еда + 35% хил + 8 base",
    combatBonus: { type: "foodInventory", baseMaxHp: 8, maxHpPctPerFood: 0.05, foodHealMult: 0.35 },
  },
  variant_C: {
    label: "C: 3% HP/еда + 35% хил + 10 base",
    combatBonus: { type: "foodInventory", baseMaxHp: 10, maxHpPctPerFood: 0.03, foodHealMult: 0.35 },
  },
};

const PRIEST_PRESETS = ["priest_food", "priest_minimal", "heal_stack", "sustain_mix"];

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
  parseInt,
  parseFloat,
  isNaN,
  Infinity,
  Error,
  Date,
  performance: { now: () => 0 },
};
sandbox.global = sandbox;
sandbox.window = sandbox;
sandbox.document = {
  getElementById: () => null,
  createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }),
};

const ctx = vm.createContext(sandbox);
const ENGINE_FILES = [
  "classes.js",
  "items.js",
  "items-bb-catalog.js",
  "systems/meta-effects.js",
  "backpack-engine.js",
  "systems/gem-sockets.js",
  "systems/combat.js",
  "systems/synergy.js",
  "systems/combat-profile.js",
  "systems/battle-stacks.js",
  "systems/battle-debuffs.js",
  "battle-engine.js",
];

for (const file of ENGINE_FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx);
}

vm.runInContext(`
  if (typeof CLASS_CATALOG !== "undefined") globalThis.CLASS_CATALOG = CLASS_CATALOG;
  if (typeof ITEM_CATALOG !== "undefined") globalThis.ITEM_CATALOG = ITEM_CATALOG;
`, ctx);

[
  "initBattleAnimations",
  "pushBattleLog",
  "queueHitAnimation",
  "spawnBattleFloat",
  "triggerProfileAvatarCritFlip",
  "triggerProfileAvatarHitShake",
  "tickBattleAnimations",
  "queueItemActivationPulse",
  "emitEffectAttackVisual",
  "tickDamageFlights",
  "initBattleDamageTracker",
  "recordDotDamageDealt",
  "queueStaminaSpendFeedback",
  "queueItemFailedAnimation",
].forEach((name) => {
  sandbox[name] = () => {};
});
sandbox.battleTeamLabel = (team) => (team === "player" ? "Игрок" : team === "enemy" ? "Враг" : team);

vm.runInContext(`
  globalThis.applyClassCombatBonus = function applyClassCombatBonusSweep(side, classId) {
    const cls = getClassById(classId);
    if (!cls?.combatBonus) return;
    const b = cls.combatBonus;
    if (b.type === "maxHpMult") side.maxHp = Math.floor(side.maxHp * (1 + b.value));
    if (b.type === "attackSpeedMult") side.cooldownMult *= 1 - b.value;
    if (b.type === "magicDamageMult") side.magicDamageMult *= 1 + b.value;
    if (b.type === "foodInventory") {
      const foodCount = countFoodItemsInLoadout(side.items);
      side.classFoodCount = foodCount;
      if (b.baseMaxHp) side.maxHp += Number(b.baseMaxHp) || 0;
      const pctPerFood = Number(b.maxHpPctPerFood) || 0;
      const flatPerFood = Number(b.maxHpPerFood) || 0;
      if (foodCount > 0) {
        const before = side.maxHp;
        if (pctPerFood > 0) {
          side.maxHp = Math.floor(side.maxHp * (1 + foodCount * pctPerFood));
        } else if (flatPerFood > 0) {
          side.maxHp += foodCount * flatPerFood;
        }
        side.classFoodBonusHp = side.maxHp - before;
      }
      const foodHealMult = Number(b.foodHealMult) || 0;
      if (foodHealMult > 0) side.classFoodHealMult = 1 + foodHealMult;
    }
  };
`, ctx);

const simDefs = fs.readFileSync(path.join(__dirname, "battle-auto-sim.js"), "utf8");
const defsBlock = simDefs.slice(simDefs.indexOf("const PRESETS ="), simDefs.indexOf("function buildLoadout("));
vm.runInContext(`${defsBlock}
  globalThis.PRESETS = PRESETS;
  globalThis.SCENARIOS = SCENARIOS;
  globalThis.SIM_ROUNDS = SIM_ROUNDS;
  globalThis.MATCHUPS = MATCHUPS;
`, ctx);

function sb(name) {
  return sandbox[name];
}

function buildLoadout(presetKey, teamPrefix) {
  const preset = sb("PRESETS")[presetKey];
  const catalog = sb("ITEM_CATALOG");
  const items = [];
  preset.items.forEach((itemId, index) => {
    if (!catalog[itemId]) return;
    const item = sb("createPlacedItem")(itemId, index % 8, Math.floor(index / 8), 0);
    item.uid = `${teamPrefix}-${itemId}-${index}`;
    items.push(item);
  });
  sb("applySynergyModifiers")(items);
  return { preset, items };
}

function runBattle(playerKey, enemyKey, round) {
  const playerLoadout = buildLoadout(playerKey, "p");
  const enemyLoadout = buildLoadout(enemyKey, "e");
  const state = sb("createBattleState")(
    playerLoadout.items.map((i) => ({ ...i, runtime: i.runtime ? { ...i.runtime } : null })),
    enemyLoadout.items.map((i) => ({ ...i, runtime: i.runtime ? { ...i.runtime } : null })),
    playerLoadout.preset.classId,
    enemyLoadout.preset.classId,
    round,
  );
  for (let step = 0; step < MAX_STEPS && !state.finished; step++) {
    sb("battleTick")(state, DT);
  }
  const maxDur = sb("MAX_BATTLE_DURATION") || 120;
  const timedOut = state.elapsed >= maxDur - 0.001
    || (state.finished && state.player.hp > 0 && state.enemy.hp > 0);
  return {
    playerKey,
    enemyKey,
    playerClass: playerLoadout.preset.classId,
    enemyClass: enemyLoadout.preset.classId,
    winner: state.winner || "unknown",
    timeout: timedOut,
    durationSec: state.elapsed || 0,
    playerMaxHp: state.player.maxHp,
    playerHealing: state.player.totalHealingDone || 0,
    playerDamageDealt: state.player.totalDamageDealt || 0,
  };
}

function sampleHp(variantKey) {
  sb("CLASS_CATALOG").priest.combatBonus = { ...PRIEST_VARIANTS[variantKey].combatBonus };
  const samples = {
    priest_start: ["apple", "banana"],
    priest_food: sb("PRESETS").priest_food.items,
    no_food: ["rusty_sword", "iron_helmet"],
  };
  const out = {};
  for (const [name, ids] of Object.entries(samples)) {
    const items = ids.map((id, i) => sb("createPlacedItem")(id, i % 9, Math.floor(i / 9)));
    const side = sb("createBattleSide")(items, "priest");
    sb("applyClassCombatBonus")(side, "priest");
    out[name] = { maxHp: side.maxHp, food: sb("countFoodItemsInLoadout")(items) };
  }
  return out;
}

function aggregatePriestResults(results) {
  const priestGames = results.filter((r) => r.playerClass === "priest");
  const byPreset = {};
  for (const key of PRIEST_PRESETS) {
    const subset = priestGames.filter((r) => r.playerKey === key);
    if (!subset.length) continue;
    byPreset[key] = {
      n: subset.length,
      wins: subset.filter((r) => r.winner === "player").length,
      timeouts: subset.filter((r) => r.timeout).length,
      avgHeal: subset.reduce((s, r) => s + r.playerHealing, 0) / subset.length,
      avgDmg: subset.reduce((s, r) => s + r.playerDamageDealt, 0) / subset.length,
      avgMaxHp: subset.reduce((s, r) => s + r.playerMaxHp, 0) / subset.length,
    };
  }
  const all = {
    n: priestGames.length,
    wins: priestGames.filter((r) => r.winner === "player").length,
    timeouts: priestGames.filter((r) => r.timeout).length,
    avgHeal: priestGames.reduce((s, r) => s + r.playerHealing, 0) / (priestGames.length || 1),
    avgDmg: priestGames.reduce((s, r) => s + r.playerDamageDealt, 0) / (priestGames.length || 1),
  };
  return { all, byPreset };
}

function runVariant(variantKey) {
  sb("CLASS_CATALOG").priest.combatBonus = { ...PRIEST_VARIANTS[variantKey].combatBonus };
  return sb("SCENARIOS").map((scenario) => {
    const r = runBattle(scenario.playerKey, scenario.enemyKey, scenario.round);
    return { variantKey, ...r };
  });
}

console.log("=== Priest passive sweep (100 боёв × вариант, без изменений game-кода) ===\n");

const report = {};
for (const [key, meta] of Object.entries(PRIEST_VARIANTS)) {
  report[key] = {
    label: meta.label,
    hpSamples: sampleHp(key),
    results: runVariant(key),
    stats: null,
  };
  report[key].stats = aggregatePriestResults(report[key].results);
  process.stdout.write(".");
}
console.log("\n");

console.log("─── Max HP (жрец, до боя) ───");
console.log(
  "Вариант".padEnd(22),
  "Старт".padStart(6),
  "Food6".padStart(6),
  "Без еды".padStart(8),
);
for (const [key, data] of Object.entries(report)) {
  console.log(
    key.padEnd(22),
    String(data.hpSamples.priest_start.maxHp).padStart(6),
    String(data.hpSamples.priest_food.maxHp).padStart(6),
    String(data.hpSamples.no_food.maxHp).padStart(8),
  );
}

console.log("\n─── Все бои где игрок = жрец (36 из 100) ───");
console.log(
  "Вариант".padEnd(22),
  "WR".padStart(6),
  "TO%".padStart(5),
  "Хил".padStart(7),
  "Урон".padStart(7),
);
for (const [key, data] of Object.entries(report)) {
  const s = data.stats.all;
  const wr = Math.round((100 * s.wins) / s.n);
  const to = Math.round((100 * s.timeouts) / s.n);
  console.log(
    key.padEnd(22),
    `${wr}%`.padStart(6),
    `${to}%`.padStart(5),
    s.avgHeal.toFixed(1).padStart(7),
    s.avgDmg.toFixed(1).padStart(7),
  );
}

console.log("\n─── priest_food (18 боёв) ───");
console.log(
  "Вариант".padEnd(22),
  "WR".padStart(6),
  "Хил".padStart(7),
  "Урон".padStart(7),
  "maxHP".padStart(7),
);
for (const [key, data] of Object.entries(report)) {
  const s = data.stats.byPreset.priest_food;
  if (!s) continue;
  const wr = Math.round((100 * s.wins) / s.n);
  console.log(
    key.padEnd(22),
    `${wr}%`.padStart(6),
    s.avgHeal.toFixed(1).padStart(7),
    s.avgDmg.toFixed(1).padStart(7),
    s.avgMaxHp.toFixed(0).padStart(7),
  );
}

console.log("\n─── heal_stack (8 боёв) ───");
console.log(
  "Вариант".padEnd(22),
  "WR".padStart(6),
  "TO%".padStart(5),
  "Хил".padStart(7),
);
for (const [key, data] of Object.entries(report)) {
  const s = data.stats.byPreset.heal_stack;
  if (!s) continue;
  const wr = Math.round((100 * s.wins) / s.n);
  const to = Math.round((100 * s.timeouts) / s.n);
  console.log(
    key.padEnd(22),
    `${wr}%`.padStart(6),
    `${to}%`.padStart(5),
    s.avgHeal.toFixed(1).padStart(7),
  );
}

const outPath = path.join(__dirname, "priest-passive-sweep-results.json");
fs.writeFileSync(
  outPath,
  JSON.stringify(
    Object.fromEntries(
      Object.entries(report).map(([k, v]) => [k, { label: v.label, hpSamples: v.hpSamples, stats: v.stats }]),
    ),
    null,
    2,
  ),
  "utf8",
);
console.log(`\nJSON → ${outPath}`);
