/**
 * Headless VM sandbox для balance-симов (общий bootstrap).
 */

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const BATTLE_STUBS = [
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
];

const ENGINE_FILES = [
  "classes.js",
  "items.js",
  "items-catalog.js",
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

function createSimSandbox() {
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
  for (const file of ENGINE_FILES) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx);
  }

  vm.runInContext(`
    if (typeof ITEM_CATALOG !== "undefined") globalThis.ITEM_CATALOG = ITEM_CATALOG;
    if (typeof CRAFT_OUTPUT_IDS !== "undefined") globalThis.CRAFT_OUTPUT_IDS = CRAFT_OUTPUT_IDS;
    if (typeof CLASS_CATALOG !== "undefined") globalThis.CLASS_CATALOG = CLASS_CATALOG;
    if (typeof AI_ARCHETYPES !== "undefined") globalThis.AI_ARCHETYPES = AI_ARCHETYPES;
    if (typeof getClassById !== "undefined") globalThis.getClassById = getClassById;
    if (typeof MAX_BATTLE_DURATION !== "undefined") globalThis.MAX_BATTLE_DURATION = MAX_BATTLE_DURATION;
  `, ctx);

  BATTLE_STUBS.forEach((name) => {
    sandbox[name] = () => {};
  });
  sandbox.battleTeamLabel = (team) => (team === "player" ? "Игрок" : team === "enemy" ? "Враг" : team);

  return sandbox;
}

module.exports = {
  ROOT,
  ENGINE_FILES,
  BATTLE_STUBS,
  createSimSandbox,
};
