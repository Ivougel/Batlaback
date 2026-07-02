/**
 * Тесты мутаций в лобби: sync milestones + prepMeta.
 * Запуск: node tools/lobby-mutations.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadSandbox() {
  const sandbox = {
    console, Math, Object, Array, Map, Set, JSON, Number, String, Boolean,
    parseInt, parseFloat, isNaN, Infinity, Error, Date, performance: { now: () => 0 },
    document: { getElementById: () => null, querySelectorAll: () => [] },
  };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  const files = [
    "classes.js",
    "items.js",
    "items-catalog.js",
    "systems/mutations.js",
    "systems/mutation-ui.js",
    "systems/enhancements.js",
    "shop-engine.js",
    "backpack-engine.js",
    "ai-engine.js",
    "systems/lobby-opponents.js",
    "systems/lobby-fighter-avatar.js",
  ];
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx);
  }
  vm.runInContext(`
    Object.assign(globalThis, {
      syncLobbyFighterMutationMilestones,
      lobbyFighterPrepMeta,
      resolveLobbyFighterAvatarVisual,
      MUTATION_ROUND_FORM,
      MUTATION_ROUND_FINAL,
    });
  `, ctx);
  return sandbox;
}

function run() {
  const s = loadSandbox();
  let passed = 0;

  const fighter = {
    classId: "priest",
    companionId: "s_light",
    items: [],
    enhancements: { head: null, chest: null, boots: null },
    mutationFormId: null,
    mutationId: null,
    alive: true,
  };

  s.syncLobbyFighterMutationMilestones(fighter, 7);
  assert(!fighter.mutationFormId, "R7: no form yet");
  passed++;

  fighter.mutationFormId = "p_paladin";
  const meta = s.lobbyFighterPrepMeta(fighter);
  assert(meta.mutationFormId === "p_paladin", "prepMeta form");
  assert(meta.companionId === "s_light", "prepMeta companion");
  passed++;

  const visual = s.resolveLobbyFighterAvatarVisual(fighter, { fighters: [fighter] }, { phase: "prep", round: 8 });
  assert(visual.emoji === "⚔️", "R8 form emoji paladin");
  assert(visual.isForm, "visual isForm");
  passed++;

  fighter.mutationId = "p_oracle";
  const visualMut = s.resolveLobbyFighterAvatarVisual(fighter, { fighters: [fighter] }, { phase: "prep", round: 16 });
  assert(visualMut.emoji === "🔮", "R16 mutation emoji");
  assert(visualMut.isMutation, "visual isMutation");
  passed++;

  console.log(`lobby-mutations.test.mjs: ${passed}/${passed} OK`);
}

run();
