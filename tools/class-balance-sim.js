#!/usr/bin/env node
/**
 * Round-robin баланс классов на bot-optimal пресетах.
 * node tools/class-balance-sim.js [--json]
 * Сначала: node tools/generate-class-optimal-presets.js
 */

const fs = require("fs");
const path = require("path");
const { createSimSandbox } = require("./sim-sandbox.js");

const PRESETS_PATH = path.join(__dirname, "class-optimal-presets.json");
const DT = 0.05;
const MAX_STEPS = Math.ceil(120 / DT) + 2;

const CLASSES = ["warrior", "rogue", "mage", "priest"];
const ROUNDS = [1, 8, 16];
const SIM_FATIGUE_ROUNDS = [1, 8];

function presetKey(classId, round, variant = "opt") {
  return variant === "hybrid" ? `${classId}_r${round}_hybrid_opt` : `${classId}_r${round}_opt`;
}

function loadPresets() {
  if (!fs.existsSync(PRESETS_PATH)) {
    throw new Error(`Нет ${PRESETS_PATH} — сначала запусти: node tools/generate-class-optimal-presets.js`);
  }
  return JSON.parse(fs.readFileSync(PRESETS_PATH, "utf8")).presets;
}

function buildLoadoutFromPreset(preset, teamPrefix, sandbox) {
  const items = preset.items.map((entry, index) => {
    const item = sandbox.createPlacedItem(
      entry.itemId,
      entry.col ?? (index % 8),
      entry.row ?? Math.floor(index / 8),
      entry.rotation || 0,
    );
    item.uid = `${teamPrefix}-${entry.itemId}-${index}`;
    return item;
  });
  sandbox.applySynergyModifiers(items);
  return { preset, items };
}

function runBattle(sandbox, playerPreset, enemyPreset, battleRound) {
  const playerLoadout = buildLoadoutFromPreset(playerPreset, "p", sandbox);
  const enemyLoadout = buildLoadoutFromPreset(enemyPreset, "e", sandbox);

  const state = sandbox.createBattleState(
    playerLoadout.items.map((i) => ({ ...i, runtime: i.runtime ? { ...i.runtime } : null })),
    enemyLoadout.items.map((i) => ({ ...i, runtime: i.runtime ? { ...i.runtime } : null })),
    playerPreset.classId,
    enemyPreset.classId,
    battleRound,
  );

  const playerStartHp = state.player.maxHp;
  const enemyStartHp = state.enemy.maxHp;

  for (let step = 0; step < MAX_STEPS && !state.finished; step++) {
    sandbox.battleTick(state, DT);
  }

  const maxDur = sandbox.MAX_BATTLE_DURATION || 120;
  const timedOut = state.elapsed >= maxDur - 0.001
    || (state.finished && state.player.hp > 0 && state.enemy.hp > 0);

  return {
    playerKey: playerPreset.key,
    enemyKey: enemyPreset.key,
    playerClass: playerPreset.classId,
    enemyClass: enemyPreset.classId,
    prepRound: playerPreset.round,
    battleRound,
    winner: state.winner || "unknown",
    timeout: timedOut,
    durationSec: Math.round((state.elapsed || 0) * 10) / 10,
    playerMaxHp: state.player.maxHp,
    playerEndHp: Math.round(state.player.hp),
    enemyMaxHp: state.enemy.maxHp,
    enemyEndHp: Math.round(state.enemy.hp),
    playerDamage: Math.round((state.player.totalDamageDealt || 0) * 10) / 10,
    enemyDamage: Math.round((state.enemy.totalDamageDealt || 0) * 10) / 10,
    playerHeal: Math.round((state.player.totalHealingDone || 0) * 10) / 10,
    enemyHeal: Math.round((state.enemy.totalHealingDone || 0) * 10) / 10,
  };
}

function aggregateByClass(results) {
  const stats = {};
  for (const cls of CLASSES) {
    stats[cls] = { asPlayer: { n: 0, w: 0, dmg: 0, heal: 0 }, asEnemy: { n: 0, w: 0 } };
  }
  stats.priest_hybrid = { asPlayer: { n: 0, w: 0, dmg: 0, heal: 0 }, asEnemy: { n: 0, w: 0 } };

  results.forEach((r) => {
    const pKey = r.playerClass === "priest" && r.playerKey.includes("hybrid") ? "priest_hybrid" : r.playerClass;
    const eKey = r.enemyClass === "priest" && r.enemyKey.includes("hybrid") ? "priest_hybrid" : r.enemyClass;

    if (stats[pKey]) {
      stats[pKey].asPlayer.n += 1;
      if (r.winner === "player") stats[pKey].asPlayer.w += 1;
      stats[pKey].asPlayer.dmg += r.playerDamage;
      stats[pKey].asPlayer.heal += r.playerHeal;
    }
    if (stats[eKey]) {
      stats[eKey].asEnemy.n += 1;
      if (r.winner === "enemy") stats[eKey].asEnemy.w += 1;
    }
  });

  return stats;
}

function main() {
  const allPresets = loadPresets();
  const sandbox = createSimSandbox();
  const results = [];

  for (const round of ROUNDS) {
    for (const battleRound of SIM_FATIGUE_ROUNDS) {
      for (let i = 0; i < CLASSES.length; i++) {
        for (let j = i + 1; j < CLASSES.length; j++) {
          const classA = CLASSES[i];
          const classB = CLASSES[j];
          const presetA = allPresets[presetKey(classA, round)];
          const presetB = allPresets[presetKey(classB, round)];
          if (!presetA || !presetB) continue;

          results.push(runBattle(sandbox, presetA, presetB, battleRound));
          results.push(runBattle(sandbox, presetB, presetA, battleRound));
        }
      }

      const priestHybrid = allPresets[presetKey("priest", round, "hybrid")];
      const priestDefault = allPresets[presetKey("priest", round, "opt")];
      if (priestHybrid && priestDefault) {
        for (const battleRound of SIM_FATIGUE_ROUNDS) {
          results.push(runBattle(sandbox, priestHybrid, priestDefault, battleRound));
          results.push(runBattle(sandbox, priestDefault, priestHybrid, battleRound));
        }
      }

      for (const other of CLASSES.filter((c) => c !== "priest")) {
        const presetO = allPresets[presetKey(other, round)];
        if (!priestHybrid || !presetO) continue;
        for (const battleRound of SIM_FATIGUE_ROUNDS) {
          results.push(runBattle(sandbox, priestHybrid, presetO, battleRound));
          results.push(runBattle(sandbox, presetO, priestHybrid, battleRound));
        }
      }
    }
  }

  const byClass = aggregateByClass(results);
  const timeouts = results.filter((r) => r.timeout).length;

  console.log("=== Class balance sim (bot-optimal presets) ===\n");
  console.log(`Бои: ${results.length} | Таймауты: ${timeouts} (${Math.round((100 * timeouts) / results.length)}%)\n`);

  console.log("─── Winrate as PLAYER (opt presets, все раунды) ───");
  console.log("Класс".padEnd(16), "WR".padStart(6), "n".padStart(4), "avgDmg".padStart(8), "avgHeal".padStart(8));
  for (const cls of [...CLASSES, "priest_hybrid"]) {
    const s = byClass[cls]?.asPlayer;
    if (!s || !s.n) continue;
    const wr = Math.round((100 * s.w) / s.n);
    console.log(
      cls.padEnd(16),
      `${wr}%`.padStart(6),
      String(s.n).padStart(4),
      (s.dmg / s.n).toFixed(1).padStart(8),
      (s.heal / s.n).toFixed(1).padStart(8),
    );
  }

  console.log("\n─── Матрица WR (prep R8, battle fatigue R8, player row vs enemy col) ───");
  const r8Results = results.filter((r) => r.prepRound === 8 && r.battleRound === 8 && !r.playerKey.includes("hybrid") && !r.enemyKey.includes("hybrid"));
  const matrix = {};
  CLASSES.forEach((row) => {
    matrix[row] = {};
    CLASSES.forEach((col) => { matrix[row][col] = null; });
  });
  r8Results.forEach((r) => {
    if (r.playerClass === r.enemyClass) return;
    const wr = r.winner === "player" ? 1 : r.winner === "enemy" ? 0 : 0.5;
    matrix[r.playerClass][r.enemyClass] = wr;
  });
  process.stdout.write("".padEnd(10));
  CLASSES.forEach((c) => process.stdout.write(c.slice(0, 6).padStart(8)));
  process.stdout.write("\n");
  CLASSES.forEach((row) => {
    process.stdout.write(row.slice(0, 8).padEnd(10));
    CLASSES.forEach((col) => {
      if (row === col) process.stdout.write("   —  ");
      else {
        const v = matrix[row][col];
        process.stdout.write(v == null ? "   ?  " : `${Math.round(v * 100)}%`.padStart(7));
      }
    });
    process.stdout.write("\n");
  });

  console.log("\n─── Priest: default opt vs hybrid (R8) ───");
  const priestCmp = results.filter((r) => r.prepRound === 8 && r.playerKey.includes("priest") && r.enemyKey.includes("priest"));
  const hybridAsPlayer = priestCmp.filter((r) => r.playerKey.includes("hybrid"));
  const hybridWins = hybridAsPlayer.filter((r) => r.winner === "player").length;
  console.log(`Hybrid as player: ${hybridWins}/${hybridAsPlayer.length} wins`);
  hybridAsPlayer.forEach((r) => {
    console.log(`  ${r.playerKey} vs ${r.enemyKey} → ${r.winner} | dmg ${r.playerDamage} vs ${r.enemyDamage} | ${r.durationSec}s`);
  });

  const out = {
    summary: { total: results.length, timeouts, byClass },
    results,
  };

  const jsonPath = path.join(__dirname, "class-balance-results.json");
  if (process.argv.includes("--json")) {
    fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf8");
    console.log(`\nJSON → ${jsonPath}`);
  }
}

main();
