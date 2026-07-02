#!/usr/bin/env node
/**
 * Round-robin баланс 4 архетипов на pool v120 (tagged AI presets).
 * node tools/generate-class-pool120-presets.js
 * node tools/class-balance-pool120-sim.js [--json]
 */
const fs = require("fs");
const path = require("path");
const { createPool120SimSandbox } = require("./sim-pool120-sandbox.js");

const PRESETS_PATH = path.join(__dirname, "class-pool120-presets.json");
const DT = 0.05;
const MAX_STEPS = Math.ceil(120 / DT) + 2;

const CLASSES = ["warrior", "rogue", "mage", "priest"];
const PREP_ROUNDS = [1, 8, 16];

function presetKey(classId, round) {
  return `${classId}_r${round}_tagged`;
}

function loadPresets() {
  if (!fs.existsSync(PRESETS_PATH)) {
    throw new Error(`Нет ${PRESETS_PATH} — сначала: node tools/generate-class-pool120-presets.js`);
  }
  return JSON.parse(fs.readFileSync(PRESETS_PATH, "utf8")).presets;
}

function buildPrepMeta(sb, preset) {
  const round = preset.round || 1;
  const companionId = preset.companionId || sb.defaultCompanionForClass(preset.classId);
  let mutationFormId = null;
  let mutationId = null;

  if (typeof sb.resolveMutationProgress === "function" && typeof sb.pickMutationIdForMilestone === "function") {
    const progress = sb.resolveMutationProgress({
      classId: preset.classId,
      companionId,
      items: preset.items.map((e) => ({ itemId: e.itemId })),
      enhancements: {},
      round,
    });
    const pick = sb.pickMutationIdForMilestone(progress, round);
    const formRound = sb.MUTATION_ROUND_FORM || 8;
    const finalRound = sb.MUTATION_ROUND_FINAL || 16;
    if (round >= finalRound && pick) {
      mutationId = pick;
      mutationFormId = pick;
    } else if (round >= formRound && pick) {
      mutationFormId = pick;
    }
  }

  return {
    companionId,
    mutationFormId,
    mutationId,
    enhancements: typeof sb.createEmptyEnhancementLoadout === "function"
      ? sb.createEmptyEnhancementLoadout()
      : { head: null, chest: null, boots: null },
  };
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

function runBattle(sandbox, playerPreset, enemyPreset) {
  const playerLoadout = buildLoadoutFromPreset(playerPreset, "p", sandbox);
  const enemyLoadout = buildLoadoutFromPreset(enemyPreset, "e", sandbox);
  const battleRound = playerPreset.round || 1;

  const state = sandbox.createBattleState(
    playerLoadout.items.map((i) => ({ ...i, runtime: i.runtime ? { ...i.runtime } : null })),
    enemyLoadout.items.map((i) => ({ ...i, runtime: i.runtime ? { ...i.runtime } : null })),
    playerPreset.classId,
    enemyPreset.classId,
    battleRound,
    {
      player: buildPrepMeta(sandbox, playerPreset),
      enemy: buildPrepMeta(sandbox, enemyPreset),
    },
  );

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
    prepRound: battleRound,
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
    playerMutation: state.player.mutationId || state.player.mutationFormId || null,
    enemyMutation: state.enemy.mutationId || state.enemy.mutationFormId || null,
  };
}

function aggregateByClass(results) {
  const stats = {};
  CLASSES.forEach((cls) => {
    stats[cls] = { asPlayer: { n: 0, w: 0, dmg: 0, heal: 0 }, asEnemy: { n: 0, w: 0 } };
  });

  results.forEach((r) => {
    const p = stats[r.playerClass];
    const e = stats[r.enemyClass];
    if (p) {
      p.asPlayer.n += 1;
      if (r.winner === "player") p.asPlayer.w += 1;
      p.asPlayer.dmg += r.playerDamage;
      p.asPlayer.heal += r.playerHeal;
    }
    if (e) {
      e.asEnemy.n += 1;
      if (r.winner === "enemy") e.asEnemy.w += 1;
    }
  });

  return stats;
}

function printMatrix(results, prepRound) {
  const slice = results.filter((r) => r.prepRound === prepRound);
  const matrix = {};
  CLASSES.forEach((row) => {
    matrix[row] = {};
    CLASSES.forEach((col) => { matrix[row][col] = null; });
  });
  slice.forEach((r) => {
    if (r.playerClass === r.enemyClass) return;
    matrix[r.playerClass][r.enemyClass] = r.winner === "player" ? 1 : r.winner === "enemy" ? 0 : 0.5;
  });

  console.log(`\n─── Матрица WR · prep R${prepRound} (player row → enemy col) ───`);
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
}

function main() {
  const allPresets = loadPresets();
  const sandbox = createPool120SimSandbox(42);
  const results = [];

  for (const prepRound of PREP_ROUNDS) {
    for (let i = 0; i < CLASSES.length; i++) {
      for (let j = i + 1; j < CLASSES.length; j++) {
        const classA = CLASSES[i];
        const classB = CLASSES[j];
        const presetA = allPresets[presetKey(classA, prepRound)];
        const presetB = allPresets[presetKey(classB, prepRound)];
        if (!presetA || !presetB) {
          throw new Error(`Нет пресетов ${presetKey(classA, prepRound)} / ${presetKey(classB, prepRound)}`);
        }
        results.push(runBattle(sandbox, presetA, presetB));
        results.push(runBattle(sandbox, presetB, presetA));
      }
    }
  }

  const byClass = aggregateByClass(results);
  const timeouts = results.filter((r) => r.timeout).length;

  console.log("=== Class balance sim · pool v120 · 4 архетипа ===\n");
  console.log(`Бои: ${results.length} | Таймауты: ${timeouts} (${Math.round((100 * timeouts) / results.length)}%)\n`);

  console.log("─── Winrate as PLAYER (все prep-раунды) ───");
  console.log("Класс".padEnd(12), "WR".padStart(6), "n".padStart(4), "avgDmg".padStart(8), "avgHeal".padStart(8));
  CLASSES.forEach((cls) => {
    const s = byClass[cls]?.asPlayer;
    if (!s?.n) return;
    const wr = Math.round((100 * s.w) / s.n);
    console.log(
      cls.padEnd(12),
      `${wr}%`.padStart(6),
      String(s.n).padStart(4),
      (s.dmg / s.n).toFixed(1).padStart(8),
      (s.heal / s.n).toFixed(1).padStart(8),
    );
  });

  PREP_ROUNDS.forEach((r) => printMatrix(results, r));

  console.log("\n─── Средняя длительность боя по prep-раунду ───");
  PREP_ROUNDS.forEach((r) => {
    const slice = results.filter((x) => x.prepRound === r);
    const avg = slice.reduce((s, x) => s + x.durationSec, 0) / slice.length;
    console.log(`R${r}: ${avg.toFixed(1)}s (${slice.length} боёв)`);
  });

  const out = {
    pool: "v120",
    summary: { total: results.length, timeouts, byClass },
    results,
  };

  const jsonPath = path.join(__dirname, "class-balance-pool120-results.json");
  if (process.argv.includes("--json")) {
    fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf8");
    console.log(`\nJSON → ${jsonPath}`);
  }
}

main();
