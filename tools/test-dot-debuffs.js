/**
 * Быстрая проверка DoT и дебафф-чипов (node tools/test-dot-debuffs.js).
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.join(__dirname, "..");
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
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
};
sandbox.global = sandbox;
sandbox.window = sandbox;
sandbox.document = {
  getElementById: () => null,
  createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }),
};

const ctx = vm.createContext(sandbox);
const files = [
  "classes.js",
  "items.js",
  "items-catalog.js",
  "systems/meta-effects.js",
  "backpack-engine.js",
  "systems/gem-sockets.js",
  "systems/combat.js",
  "systems/combat-profile.js",
  "systems/battle-stacks.js",
  "systems/battle-debuffs.js",
  "battle-engine.js",
];

for (const f of files) {
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
}

// Заглушки UI-хуков из battle-engine
sandbox.initBattleAnimations = () => {};
sandbox.pushBattleLog = () => {};
sandbox.queueHitAnimation = () => {};
sandbox.spawnBattleFloat = () => {};
sandbox.triggerProfileAvatarCritFlip = () => {};
sandbox.triggerProfileAvatarHitShake = () => {};
sandbox.tickBattleAnimations = () => {};
sandbox.queueItemActivationPulse = () => {};
sandbox.battleTeamLabel = (t) => t;

const {
  createBattleState,
  executeEffect,
  createRuntimeState,
  battleTick,
  collectBattleStatusEffects,
  resolveGroundFireValue,
  getMaxGroundFireFromEffects,
  getBattleEffectsForItem,
} = sandbox;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function makeItem(id, uid) {
  const item = { itemId: id, uid: uid || id, row: 0, col: 0 };
  item.runtime = createRuntimeState(item);
  return item;
}

const playerItems = [makeItem("poison_vial", "pv1"), makeItem("poison_vial", "pv2")];
const enemyItems = [makeItem("fire_staff", "fs1")];
const state = createBattleState(playerItems, enemyItems, "rogue", "mage", 2);
state.itemDamageStats = {};

const pv = state.player.items[0];
const rt = pv.runtime;
executeEffect(state, { type: "poison", value: 1 }, pv, state.player, state.enemy, rt, "player");
assert(state.enemy.poisonStacks >= 1, `poison should apply stacks, got ${state.enemy.poisonStacks}`);
assert((state.itemDamageStats.pv1?.poisonApplied || 0) >= 1, "poisonApplied stat should increment");

executeEffect(state, { type: "poison", value: 2 }, pv, state.player, state.player, rt, "player");
assert(state.player.poisonStacks >= 1, "self-poison should stack on self");

const fsItem = state.enemy.items[0];
const groundValues = getBattleEffectsForItem(fsItem)
  .filter((e) => e.type === "groundFire")
  .map((e) => e.value || 0);
const scaledGround = sandbox.resolveGroundFireValue(getBattleEffectsForItem(fsItem));
state.player.groundFire = Math.max(state.player.groundFire, scaledGround);
assert(state.player.groundFire >= 2, `groundFire should be >= 2 after pacing, got ${state.player.groundFire}`);

// Несколько groundFire на одном предмете — берётся максимум
const sunShieldFx = [{ type: "groundFire", value: 1 }, { type: "groundFire", value: 2 }];
assert(sandbox.getMaxGroundFireFromEffects(sunShieldFx) === 2, "max groundFire should be 2");

// Лимит стаков яда
for (let i = 0; i < 10; i++) {
  executeEffect(state, { type: "poison", value: 1 }, pv, state.player, state.enemy, rt, "player");
}
assert(state.enemy.poisonStacks > 3, `poison cap should exceed 3, got ${state.enemy.poisonStacks}`);

state.enemy.slowDebuff = 0.15;
state.enemy.slowTimer = 4;
state.enemy.stunTimer = 1.5;

const playerDebuffIds = collectBattleStatusEffects(state.player, state.player.items, state)
  .debuffs.map((d) => d.id);
const enemyDebuffIds = collectBattleStatusEffects(state.enemy, state.enemy.items, state)
  .debuffs.map((d) => d.id);

assert(playerDebuffIds.includes("poison"), "self poison chip missing");
assert(playerDebuffIds.includes("ground-fire"), "ground fire chip missing on player");
assert(enemyDebuffIds.includes("poison"), "enemy poison chip missing");
assert(enemyDebuffIds.includes("slow"), "slow chip missing");
assert(enemyDebuffIds.includes("stun"), "stun chip missing");

state.enemy.poisonStacks = 4;
state.enemy.poisonSourceTeam = "player";
state.enemy.poisonSourceItemUid = "pv1";
const hpBefore = state.enemy.hp;
for (let i = 0; i < 50; i++) battleTick(state, 0.1);
assert(state.enemy.hp < hpBefore, "poison dot should deal damage");

console.log("OK: DoT + debuff chip checks passed");
