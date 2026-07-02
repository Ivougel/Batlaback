#!/usr/bin/env node
/**
 * Пресеты билдов: AI-прогон prep по архетипу класса, магазин только pool v120.
 * node tools/generate-class-pool120-presets.js
 */
const fs = require("fs");
const path = require("path");
const { createPool120SimSandbox } = require("./sim-pool120-sandbox.js");

const CLASSES = ["warrior", "rogue", "mage", "priest"];
const ROUNDS = [1, 8, 16];
const GRID_W = 9;
const GRID_H = 7;
const OUT_PATH = path.join(__dirname, "class-pool120-presets.json");

/** Мягкий потолок предметов в рюкзаке по чекпоинту (анти-snowball R16). */
const MAX_LOADOUT_ITEMS = { 1: 4, 8: 9, 16: 12 };

/** Win-streak prep для пресетов; анти-snowball — только cap предметов на R16. */
function prepBattleResult(prepRound) {
  if (prepRound === 1) return null;
  return true;
}

function prepRecentResults(upToRound) {
  const n = Math.min(3, Math.max(0, upToRound - 1));
  return Array(n).fill("win");
}

function seedFor(classId, round) {
  const base = { warrior: 11, rogue: 23, mage: 37, priest: 53 };
  return (base[classId] || 1) * 1000 + round * 17;
}

function serializeItems(items) {
  return items.map((item) => ({
    itemId: item.itemId,
    col: item.col,
    row: item.row,
    rotation: item.rotation || 0,
  }));
}

function countByTag(items, sb) {
  const counts = {};
  items.forEach((item) => {
    const def = sb.ITEM_CATALOG[item.itemId];
    (def?.tags || []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
  });
  return counts;
}

function trimLoadoutToCap(sb, state, classId, cap, round) {
  const archetype = sb.AI_ARCHETYPES[classId];
  while (state.items.length > cap) {
    let worst = null;
    let worstScore = Infinity;
    state.items.forEach((item) => {
      const def = sb.ITEM_CATALOG[item.itemId];
      const offBuild = typeof sb.itemMatchesKillArchetype === "function"
        && !sb.itemMatchesKillArchetype(def, archetype);
      const others = state.items.filter((i) => i.uid !== item.uid);
      const s = sb.scoreItemForAI(
        item.itemId,
        archetype,
        others,
        state.bench,
        classId,
        GRID_W,
        GRID_H,
        state.containers,
        null,
        round,
      ) + (offBuild ? -40 : 0);
      if (s < worstScore) {
        worstScore = s;
        worst = item;
      }
    });
    if (!worst) break;
    state.items = state.items.filter((i) => i.uid !== worst.uid);
  }
}

function finalizePresetLoadout(sb, state, classId, targetRound) {
  if (targetRound < 16) return;
  const itemCap = MAX_LOADOUT_ITEMS[targetRound] || 12;
  trimLoadoutToCap(sb, state, classId, itemCap, targetRound);
}

function simulateArchetypePrep(sb, classId, targetRound) {
  sb.Math.random = require("./sim-pool120-sandbox.js").seededRandom(seedFor(classId, targetRound));

  const lockedArchetype = sb.AI_ARCHETYPES[classId];

  let containers = sb.createStartingContainers(GRID_W, GRID_H);
  let items = sb.applyClassStarters(containers, [], classId);
  let state = {
    archetype: sb.AI_ARCHETYPES[classId],
    classId,
    gold: sb.AI_ECON.START_GOLD,
    containers,
    items,
    bench: [],
  };

  for (let r = 1; r <= targetRound; r++) {
    if (r > 1 && typeof sb.shouldGrantBagReward === "function" && sb.shouldGrantBagReward(r)) {
      const bag = sb.grantBagReward(state.containers, r, GRID_W, GRID_H, state.items);
      if (bag.granted) state.containers = bag.containers;
    }
    const battleWon = prepBattleResult(r);
    state = sb.aiEnemyPrepPhase(
      state,
      r,
      GRID_W,
      GRID_H,
      battleWon,
      [],
      classId,
      {
        recentResults: prepRecentResults(r),
        forceArchetypeId: classId,
      },
    );
    state.classId = classId;
    state.archetype = lockedArchetype;
  }

  finalizePresetLoadout(sb, state, classId, targetRound);

  if (typeof sb.applySynergyModifiers === "function") {
    sb.applySynergyModifiers(state.items);
  }

  const power = typeof sb.computeBackpackPower === "function"
    ? sb.computeBackpackPower(state.containers, state.items, classId).score
    : 0;

  return {
    classId,
    round: targetRound,
    archetype: classId,
    companionId: sb.defaultCompanionForClass(classId),
    gold: state.gold,
    power,
    itemCount: state.items.length,
    tagCounts: countByTag(state.items, sb),
    items: serializeItems(state.items),
    itemIds: [...new Set(state.items.map((i) => i.itemId))],
  };
}

function main() {
  const sb = createPool120SimSandbox(42);
  const presets = {};
  const summary = [];

  for (const classId of CLASSES) {
    for (const round of ROUNDS) {
      const preset = simulateArchetypePrep(sb, classId, round);
      const key = `${classId}_r${round}_tagged`;
      preset.key = key;
      preset.label = `${sb.getClassById(classId)?.name || classId} · архетип · R${round} · pool120`;
      presets[key] = preset;
      summary.push({
        key,
        classId,
        round,
        power: preset.power,
        items: preset.itemCount,
        food: preset.tagCounts.food || 0,
        weapon: preset.tagCounts.weapon || 0,
        top: preset.itemIds.slice(0, 6).join(", "),
      });
    }
  }

  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), pool: "v120", presets }, null, 2),
    "utf8",
  );

  console.log("=== Pool120 tagged presets (AI prep, win-streak) ===\n");
  console.log("Key".padEnd(22), "PWR".padStart(5), "Itm".padStart(4), "Food".padStart(5), "Wpn".padStart(4), "Top");
  for (const row of summary) {
    console.log(
      row.key.padEnd(22),
      String(row.power).padStart(5),
      String(row.items).padStart(4),
      String(row.food).padStart(5),
      String(row.weapon).padStart(4),
      row.top,
    );
  }
  console.log(`\nJSON → ${OUT_PATH}`);
}

main();
