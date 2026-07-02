/**
 * Sandbox для баланс-симов на пуле v120 (+ мутации, усиления).
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const { ROOT, BATTLE_STUBS } = require("./sim-sandbox.js");

const POOL120_EXTRA_FILES = [
  "systems/item-pool-120.js",
  "items.js",
  "items-catalog.js",
  "systems/mutations.js",
  "systems/mutation-capstones.js",
  "systems/enhancements.js",
  "systems/enhancement-catalog-ext.js",
  "systems/triple-support-items.js",
  "systems/backpack-amplifiers.js",
  "systems/meta-effects.js",
  "systems/mechanic-tags.js",
  "systems/item-locale.js",
  "shop-engine.js",
  "backpack-engine.js",
  "systems/gem-sockets.js",
  "systems/crafting.js",
  "systems/synergy.js",
  "systems/combat.js",
  "systems/combat-profile.js",
  "systems/battle-stacks.js",
  "systems/battle-debuffs.js",
  "ai-engine.js",
  "hard-bot-engine.js",
  "battle-engine.js",
];

function seededRandom(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function createPool120SimSandbox(seed = 42) {
  const sandbox = {
    console,
    Math: Object.create(Math),
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
  sandbox.Math.random = seededRandom(seed);
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  sandbox.document = {
    getElementById: () => null,
    createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }),
    documentElement: { dataset: {} },
  };
  sandbox.localStorage = { getItem: () => "1", setItem() {} };
  sandbox.navigator = { maxTouchPoints: 0 };
  sandbox.location = { search: "" };

  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "classes.js"), "utf8"), ctx);
  for (const file of POOL120_EXTRA_FILES) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx);
  }

  vm.runInContext(`
    if (typeof setItemPool120Enabled === "function") setItemPool120Enabled(true);
    if (typeof ITEM_CATALOG !== "undefined") globalThis.ITEM_CATALOG = ITEM_CATALOG;
    if (typeof CLASS_CATALOG !== "undefined") globalThis.CLASS_CATALOG = CLASS_CATALOG;
    if (typeof AI_ARCHETYPES !== "undefined") globalThis.AI_ARCHETYPES = AI_ARCHETYPES;
    if (typeof AI_ECON !== "undefined") globalThis.AI_ECON = AI_ECON;
    if (typeof getClassById !== "undefined") globalThis.getClassById = getClassById;
    if (typeof MAX_BATTLE_DURATION !== "undefined") globalThis.MAX_BATTLE_DURATION = MAX_BATTLE_DURATION;
    if (typeof defaultCompanionForClass === "function") globalThis.defaultCompanionForClass = defaultCompanionForClass;
    if (typeof resolveMutationProgress === "function") globalThis.resolveMutationProgress = resolveMutationProgress;
    if (typeof pickMutationIdForMilestone === "function") globalThis.pickMutationIdForMilestone = pickMutationIdForMilestone;
    if (typeof MUTATION_ROUND_FORM !== "undefined") globalThis.MUTATION_ROUND_FORM = MUTATION_ROUND_FORM;
    if (typeof MUTATION_ROUND_FINAL !== "undefined") globalThis.MUTATION_ROUND_FINAL = MUTATION_ROUND_FINAL;
  `, ctx);

  BATTLE_STUBS.forEach((name) => {
    sandbox[name] = () => {};
  });
  sandbox.battleTeamLabel = (team) => (team === "player" ? "Игрок" : team === "enemy" ? "Враг" : team);

  return sandbox;
}

module.exports = {
  ROOT,
  seededRandom,
  createPool120SimSandbox,
};
