#!/usr/bin/env node
/**
 * 100 headless-боёв для оценки баланса.
 * Запуск: node tools/battle-auto-sim.js [--json] [--csv path]
 */

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DT = 0.05;
const MAX_STEPS = Math.ceil(120 / DT) + 2;

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
  "items-catalog.js",
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
  if (typeof ITEM_CATALOG !== "undefined") globalThis.ITEM_CATALOG = ITEM_CATALOG;
  if (typeof getClassById !== "undefined") globalThis.getClassById = getClassById;
  if (typeof MAX_BATTLE_DURATION !== "undefined") globalThis.MAX_BATTLE_DURATION = MAX_BATTLE_DURATION;
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

const {
  createPlacedItem,
  createBattleState,
  battleTick,
  applySynergyModifiers,
  MAX_BATTLE_DURATION,
} = sandbox;

function getCatalog() {
  return sandbox.ITEM_CATALOG;
}

/** @type {Record<string, { label: string, classId: string, items: string[] }>} */
const PRESETS = {
  priest_food: {
    label: "Жрец: food sustain",
    classId: "priest",
    items: [
      "iron_helmet", "apple", "apple", "apple", "banana",
      "healing_herb", "garlic", "apprentice_staff", "iron_patch",
    ],
  },
  priest_minimal: {
    label: "Жрец: старт",
    classId: "priest",
    items: ["apple", "banana"],
  },
  warrior_starter: {
    label: "Воин: старт",
    classId: "warrior",
    items: ["rusty_sword", "iron_helmet"],
  },
  warrior_mid: {
    label: "Воин: mid",
    classId: "warrior",
    items: ["knight_sword", "iron_helmet", "iron_shield", "health_stone", "bandage"],
  },
  warrior_heavy: {
    label: "Воин: тяжёлый",
    classId: "warrior",
    items: ["war_hammer", "titan_armor", "great_shield", "royal_helmet", "health_stone"],
  },
  rogue_poison: {
    label: "Разбойник: яд",
    classId: "rogue",
    items: ["dagger", "poison_vial", "poison_dagger", "spider_web", "smoke_bomb"],
  },
  rogue_burst: {
    label: "Разбойник: burst",
    classId: "rogue",
    items: ["shadow_blade", "spectral_dagger", "dagger", "lucky_charm", "speed_amulet"],
  },
  mage_staff: {
    label: "Маг: посох",
    classId: "mage",
    items: ["apprentice_staff", "mana_crystal", "fire_crystal", "mana_orb", "ring_of_power"],
  },
  mage_fire: {
    label: "Маг: огонь",
    classId: "mage",
    items: ["fire_staff", "enchanted_staff", "fire_crystal", "frost_crystal", "mana_orb"],
  },
  tank_block: {
    label: "Тank: блок",
    classId: "warrior",
    items: ["iron_helmet", "great_shield", "garlic", "iron_shield", "rune_of_protection", "bandage"],
  },
  heal_stack: {
    label: "Хил-стак",
    classId: "priest",
    items: ["apple", "apple", "healing_herb", "banana", "health_stone", "bandage", "garlic"],
  },
  hardbot_style: {
    label: "Hard bot style",
    classId: "warrior",
    items: ["iron_helmet", "rusty_sword", "heart_container", "artifact_stone_death", "artifact_stone_death"],
  },
  physical_burst: {
    label: "Физ burst",
    classId: "warrior",
    items: ["hero_sword", "falcon_blade", "beast_fang", "rage_potion", "speed_amulet"],
  },
  dot_mix: {
    label: "DoT mix",
    classId: "rogue",
    items: ["poison_vial", "poison_dagger", "fire_staff", "spider_web", "antitoxin"],
  },
  glass_mage: {
    label: "Стекло-маг",
    classId: "mage",
    items: ["enchanted_staff", "manathirst", "spark_stone", "rune_of_magic", "blood_stone"],
  },
  warrior_dual: {
    label: "Воин: dual wield",
    classId: "warrior",
    items: ["crossblades", "dagger", "knight_sword", "speed_amulet", "iron_helmet"],
  },
  rogue_crit: {
    label: "Разбойник: crit",
    classId: "rogue",
    items: ["spectral_dagger", "lucky_charm", "cork_charm", "shadow_blade", "smoke_bomb"],
  },
  mage_hybrid: {
    label: "Маг: hybrid",
    classId: "mage",
    items: ["apprentice_staff", "fire_staff", "mana_orb", "spark_stone", "health_stone"],
  },
  sustain_mix: {
    label: "Sustain mix",
    classId: "priest",
    items: ["iron_helmet", "apple", "banana", "health_stone", "great_shield", "bandage", "garlic"],
  },
  poison_heavy: {
    label: "Яд heavy",
    classId: "rogue",
    items: ["poison_vial", "poison_vial", "poison_dagger", "spider_web", "antitoxin"],
  },
  scaling_hearts: {
    label: "Scaling hearts",
    classId: "warrior",
    items: ["heart_container", "iron_helmet", "health_stone", "bandage", "rusty_sword"],
  },
  anti_heal_pressure: {
    label: "Anti-heal pressure",
    classId: "rogue",
    items: ["poison_dagger", "fire_staff", "artifact_stone_death", "dagger", "spider_web"],
  },
  all_in_burst: {
    label: "All-in burst",
    classId: "warrior",
    items: ["hero_long_sword", "eggscalibur", "rage_potion", "beast_fang", "speed_amulet"],
  },
  utility_baseline: {
    label: "Utility baseline",
    classId: "warrior",
    items: ["bandage", "lucky_charm", "iron_patch", "antitoxin", "health_stone"],
  },
};

/** 50 пар × раунды 1 и 8 (ранний / поздний fatigue) = 100 симов */
const SIM_ROUNDS = [1, 8];

const MATCHUPS = [
  // sustain vs pressure
  ["priest_food", "hardbot_style"],
  ["priest_food", "warrior_starter"],
  ["priest_food", "warrior_mid"],
  ["priest_food", "rogue_poison"],
  ["priest_food", "mage_staff"],
  ["priest_food", "tank_block"],
  ["priest_food", "physical_burst"],
  ["priest_food", "anti_heal_pressure"],
  ["priest_food", "all_in_burst"],
  ["priest_minimal", "warrior_starter"],
  ["priest_minimal", "rogue_burst"],
  ["heal_stack", "hardbot_style"],
  ["heal_stack", "dot_mix"],
  ["heal_stack", "mage_fire"],
  ["heal_stack", "poison_heavy"],
  ["sustain_mix", "hardbot_style"],
  ["sustain_mix", "physical_burst"],
  ["sustain_mix", "rogue_poison"],
  // tank / block
  ["tank_block", "physical_burst"],
  ["tank_block", "mage_fire"],
  ["tank_block", "rogue_poison"],
  ["tank_block", "all_in_burst"],
  // warrior triangle
  ["warrior_starter", "warrior_starter"],
  ["warrior_mid", "warrior_heavy"],
  ["warrior_heavy", "physical_burst"],
  ["warrior_dual", "warrior_mid"],
  ["warrior_dual", "tank_block"],
  // rogue
  ["rogue_poison", "heal_stack"],
  ["rogue_poison", "tank_block"],
  ["rogue_burst", "mage_staff"],
  ["rogue_crit", "heal_stack"],
  ["rogue_crit", "glass_mage"],
  ["poison_heavy", "sustain_mix"],
  // mage
  ["mage_staff", "tank_block"],
  ["mage_fire", "heal_stack"],
  ["mage_fire", "hardbot_style"],
  ["mage_hybrid", "tank_block"],
  ["mage_hybrid", "warrior_mid"],
  ["glass_mage", "physical_burst"],
  ["glass_mage", "rogue_poison"],
  // scaling / hardbot
  ["hardbot_style", "physical_burst"],
  ["hardbot_style", "heal_stack"],
  ["scaling_hearts", "priest_food"],
  ["scaling_hearts", "physical_burst"],
  ["scaling_hearts", "mage_fire"],
  // burst vs sustain
  ["all_in_burst", "heal_stack"],
  ["anti_heal_pressure", "heal_stack"],
  ["anti_heal_pressure", "sustain_mix"],
  ["dot_mix", "tank_block"],
  ["dot_mix", "warrior_heavy"],
];

if (MATCHUPS.length !== 50) {
  throw new Error(`MATCHUPS must contain exactly 50 pairs, got ${MATCHUPS.length}`);
}

const SCENARIOS = [];
let simId = 0;
MATCHUPS.forEach(([playerKey, enemyKey]) => {
  SIM_ROUNDS.forEach((round) => {
    simId += 1;
    SCENARIOS.push({ id: simId, round, playerKey, enemyKey });
  });
});

function buildLoadout(presetKey, teamPrefix) {
  const preset = PRESETS[presetKey];
  if (!preset) throw new Error(`Unknown preset: ${presetKey}`);

  const items = [];
  let skipped = 0;
  const catalog = getCatalog();
  preset.items.forEach((itemId, index) => {
    if (!catalog[itemId]) {
      skipped += 1;
      return;
    }
    const item = createPlacedItem(itemId, index % 8, Math.floor(index / 8), 0);
    item.uid = `${teamPrefix}-${itemId}-${index}`;
    items.push(item);
  });

  if (!items.length) throw new Error(`Preset ${presetKey} has no valid items`);

  applySynergyModifiers(items);
  return { preset, items, skipped };
}

function sumSideStats(side, state) {
  let damageDealt = side.totalDamageDealt || 0;
  let healingDone = side.totalHealingDone || 0;
  let blockDone = 0;

  if (state?.itemDamageStats) {
    side.items.forEach((item) => {
      const stat = state.itemDamageStats[item.uid];
      if (!stat) return;
      blockDone += stat.blockDone || 0;
    });
  }

  return { damageDealt, healingDone, blockDone };
}

function runBattle(playerKey, enemyKey, round) {
  const playerLoadout = buildLoadout(playerKey, "p");
  const enemyLoadout = buildLoadout(enemyKey, "e");

  const state = createBattleState(
    playerLoadout.items.map((i) => ({ ...i, runtime: i.runtime ? { ...i.runtime } : null })),
    enemyLoadout.items.map((i) => ({ ...i, runtime: i.runtime ? { ...i.runtime } : null })),
    playerLoadout.preset.classId,
    enemyLoadout.preset.classId,
    round,
  );

  const playerStartHp = state.player.maxHp;
  const enemyStartHp = state.enemy.maxHp;

  for (let step = 0; step < MAX_STEPS && !state.finished; step++) {
    battleTick(state, DT);
  }

  const playerStats = sumSideStats(state.player, state);
  const enemyStats = sumSideStats(state.enemy, state);

  const playerDamageTaken = Math.max(0, playerStartHp - state.player.hp + playerStats.healingDone);
  const enemyDamageTaken = Math.max(0, enemyStartHp - state.enemy.hp + enemyStats.healingDone);

  const maxDur = MAX_BATTLE_DURATION || 120;
  const timedOut = state.elapsed >= maxDur - 0.001
    || (state.finished && state.player.hp > 0 && state.enemy.hp > 0);

  return {
    playerKey,
    enemyKey,
    playerLabel: playerLoadout.preset.label,
    enemyLabel: enemyLoadout.preset.label,
    playerClass: playerLoadout.preset.classId,
    enemyClass: enemyLoadout.preset.classId,
    round,
    winner: state.winner || "unknown",
    timeout: timedOut,
    durationSec: Math.round((state.elapsed || 0) * 10) / 10,
    playerEndHp: Math.round(state.player.hp),
    playerMaxHp: state.player.maxHp,
    enemyEndHp: Math.round(state.enemy.hp),
    enemyMaxHp: state.enemy.maxHp,
    playerDamageDealt: Math.round(playerStats.damageDealt * 10) / 10,
    enemyDamageDealt: Math.round(enemyStats.damageDealt * 10) / 10,
    playerHealing: Math.round(playerStats.healingDone * 10) / 10,
    enemyHealing: Math.round(enemyStats.healingDone * 10) / 10,
    playerBlock: Math.round(playerStats.blockDone),
    enemyBlock: Math.round(enemyStats.blockDone),
    playerDamageTaken: Math.round(playerDamageTaken * 10) / 10,
    enemyDamageTaken: Math.round(enemyDamageTaken * 10) / 10,
    playerHealRatio: playerStats.damageDealt > 0
      ? Math.round((playerStats.healingDone / playerStats.damageDealt) * 100) / 100
      : null,
    playerHealVsTaken: playerDamageTaken > 0
      ? Math.round((playerStats.healingDone / playerDamageTaken) * 100) / 100
      : null,
    enemyHealVsTaken: enemyDamageTaken > 0
      ? Math.round((enemyStats.healingDone / enemyDamageTaken) * 100) / 100
      : null,
    healAdvantagePlayer: Math.round((playerStats.healingDone - playerStats.damageDealt) * 10) / 10,
    healAdvantageEnemy: Math.round((enemyStats.healingDone - enemyStats.damageDealt) * 10) / 10,
    playerSkippedItems: playerLoadout.skipped,
    enemySkippedItems: enemyLoadout.skipped,
  };
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function toCsvRow(obj, headers) {
  return headers.map((h) => csvEscape(obj[h])).join(",");
}

function aggregateByKey(results, keyFn) {
  const map = new Map();
  results.forEach((r) => {
    const key = keyFn(r);
    if (!map.has(key)) {
      map.set(key, {
        key,
        count: 0,
        timeouts: 0,
        playerWins: 0,
        enemyWins: 0,
        durationSum: 0,
        playerHealSum: 0,
        playerDmgSum: 0,
        enemyHealSum: 0,
        enemyDmgSum: 0,
      });
    }
    const row = map.get(key);
    row.count += 1;
    if (r.timeout) row.timeouts += 1;
    if (r.winner === "player") row.playerWins += 1;
    if (r.winner === "enemy") row.enemyWins += 1;
    row.durationSum += r.durationSec;
    row.playerHealSum += r.playerHealing;
    row.playerDmgSum += r.playerDamageDealt;
    row.enemyHealSum += r.enemyHealing;
    row.enemyDmgSum += r.enemyDamageDealt;
  });
  return [...map.values()].map((row) => ({
    ...row,
    timeoutRate: Math.round((row.timeouts / row.count) * 1000) / 10,
    avgDuration: Math.round((row.durationSum / row.count) * 10) / 10,
    avgPlayerHeal: Math.round((row.playerHealSum / row.count) * 10) / 10,
    avgPlayerDmg: Math.round((row.playerDmgSum / row.count) * 10) / 10,
    avgEnemyHeal: Math.round((row.enemyHealSum / row.count) * 10) / 10,
    avgEnemyDmg: Math.round((row.enemyDmgSum / row.count) * 10) / 10,
  }));
}

function printSummary(results) {
  const n = results.length;
  const timeouts = results.filter((r) => r.timeout).length;
  const avgDuration = results.reduce((s, r) => s + r.durationSec, 0) / n;
  const playerWins = results.filter((r) => r.winner === "player").length;
  const enemyWins = results.filter((r) => r.winner === "enemy").length;
  const draws = results.filter((r) => r.winner === "draw").length;

  const priestFood = results.filter((r) => r.playerKey === "priest_food");
  const pfTimeouts = priestFood.filter((r) => r.timeout).length;
  const pfAvgHeal = priestFood.reduce((s, r) => s + r.playerHealing, 0) / (priestFood.length || 1);
  const pfAvgDmg = priestFood.reduce((s, r) => s + r.playerDamageDealt, 0) / (priestFood.length || 1);

  console.log(`\n=== Сводка ${n} автосимов ===`);
  console.log(`Бои: ${n} | Таймаут 120с: ${timeouts} (${Math.round(timeouts / n * 100)}%)`);
  console.log(`Победы — игрок: ${playerWins}, враг: ${enemyWins}, ничья: ${draws}`);
  console.log(`Средняя длительность: ${avgDuration.toFixed(1)}с`);
  console.log(`Жрец food (${priestFood.length} боёв): таймаут ${pfTimeouts}, ср. хил ${pfAvgHeal.toFixed(1)}, ср. урон ${pfAvgDmg.toFixed(1)}`);

  SIM_ROUNDS.forEach((round) => {
    const subset = results.filter((r) => r.round === round);
    const to = subset.filter((r) => r.timeout).length;
    const avg = subset.reduce((s, r) => s + r.durationSec, 0) / (subset.length || 1);
    console.log(`  Раунд ${round}: ${subset.length} боёв, таймаут ${to} (${Math.round(to / (subset.length || 1) * 100)}%), ср. ${avg.toFixed(1)}с`);
  });

  const byPlayerPreset = aggregateByKey(results, (r) => r.playerKey)
    .sort((a, b) => b.avgPlayerHeal - a.avgPlayerHeal)
    .slice(0, 8);
  console.log("\nТоп пресетов игрока по ср. хилу:");
  byPlayerPreset.forEach((row) => {
    console.log(`  ${row.key}: хил ${row.avgPlayerHeal}, урон ${row.avgPlayerDmg}, таймаут ${row.timeoutRate}% (${row.count} боёв)`);
  });

  const topHeal = [...results].sort((a, b) => b.playerHealing - a.playerHealing).slice(0, 5);
  console.log("\nТоп-5 по лечению игрока:");
  topHeal.forEach((r) => {
    console.log(`  ${r.durationSec}s | ${r.playerLabel} vs ${r.enemyLabel} R${r.round} | хил ${r.playerHealing} | урон ${r.playerDamageDealt} | ${r.winner}${r.timeout ? " (timeout)" : ""}`);
  });

  const topTimeout = results.filter((r) => r.timeout).slice(0, 8);
  if (topTimeout.length) {
    console.log("\nПримеры боёв до таймера:");
    topTimeout.forEach((r) => {
      console.log(`  ${r.playerLabel} vs ${r.enemyLabel} R${r.round} → ${r.winner} | P ${r.playerEndHp}/${r.playerMaxHp} E ${r.enemyEndHp}/${r.enemyMaxHp}`);
    });
  }

  return {
    total: n,
    timeouts,
    timeoutRate: Math.round((timeouts / n) * 1000) / 10,
    playerWins,
    enemyWins,
    draws,
    avgDuration: Math.round(avgDuration * 10) / 10,
    byRound: SIM_ROUNDS.map((round) => {
      const subset = results.filter((r) => r.round === round);
      return {
        round,
        count: subset.length,
        timeouts: subset.filter((r) => r.timeout).length,
        avgDuration: Math.round((subset.reduce((s, r) => s + r.durationSec, 0) / (subset.length || 1)) * 10) / 10,
      };
    }),
    byPlayerPreset: aggregateByKey(results, (r) => r.playerKey),
    byEnemyPreset: aggregateByKey(results, (r) => r.enemyKey),
  };
}

function main() {
  const expected = MATCHUPS.length * SIM_ROUNDS.length;
  if (SCENARIOS.length !== expected) {
    throw new Error(`Expected ${expected} scenarios, got ${SCENARIOS.length}`);
  }

  const results = SCENARIOS.map((scenario) => {
    const result = runBattle(scenario.playerKey, scenario.enemyKey, scenario.round);
    return { simId: scenario.id, ...result };
  });

  const headers = [
    "simId", "round", "playerKey", "enemyKey", "playerLabel", "enemyLabel",
    "playerClass", "enemyClass", "winner", "timeout", "durationSec",
    "playerEndHp", "playerMaxHp", "enemyEndHp", "enemyMaxHp",
    "playerDamageDealt", "enemyDamageDealt",
    "playerHealing", "enemyHealing",
    "playerBlock", "enemyBlock",
    "playerDamageTaken", "enemyDamageTaken",
    "playerHealVsTaken", "playerHealRatio", "enemyHealVsTaken",
    "healAdvantagePlayer", "healAdvantageEnemy",
  ];

  const csvPath = process.argv.includes("--csv")
    ? process.argv[process.argv.indexOf("--csv") + 1]
    : path.join(__dirname, "battle-auto-sim-results.csv");

  const csv = [
    headers.join(","),
    ...results.map((row) => toCsvRow(row, headers)),
  ].join("\n");

  fs.writeFileSync(csvPath, csv, "utf8");
  console.log(`Записано ${results.length} симов → ${csvPath}`);

  if (process.argv.includes("--json")) {
    const jsonPath = csvPath.replace(/\.csv$/i, ".json");
    const summary = printSummary(results);
    fs.writeFileSync(jsonPath, JSON.stringify({ summary, results }, null, 2), "utf8");
    console.log(`JSON → ${jsonPath}`);
  } else {
    printSummary(results);
  }
}

main();
