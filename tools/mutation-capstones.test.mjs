/**
 * Тесты этапа 8: капстуны мутаций + класс-новичок.
 * Запуск: node tools/mutation-capstones.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const LOAD_ORDER = [
  "classes.js",
  "items.js",
  "items-catalog.js",
  "systems/mutations.js",
  "systems/mutation-capstones.js",
  "systems/battle-stacks.js",
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadSandbox() {
  const sandbox = {
    console, Math, Object, Array, Map, Set, JSON, Number, String, Boolean,
    parseInt, parseFloat, isNaN, Infinity, Error, Date, performance: { now: () => 0 },
    pushBattleLog: () => {},
    battleTeamLabel: (t) => t,
    deriveDollFromItems: () => ({ doll: {} }),
    addSideStack: (side, stack, n) => {
      side.stacks = side.stacks || {};
      side.stacks[stack] = (side.stacks[stack] || 0) + n;
    },
    getSideStack: (side, stack) => side.stacks?.[stack] || 0,
  };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const file of LOAD_ORDER) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx);
  }
  vm.runInContext(`
    function applyClassCombatBonus(side, classId) {
      const cls = getClassById(classId);
      if (!cls?.combatBonus) return;
      const b = cls.combatBonus;
      if (b.type === "maxHpMult") side.maxHp = Math.floor(side.maxHp * (1 + b.value));
      if (b.type === "attackSpeedMult") side.cooldownMult *= 1 - b.value;
      if (b.type === "magicDamageMult") side.magicDamageMult *= 1 + b.value;
      if (b.type === "foodInventory") {
        const foodCount = (side.items || []).filter((i) => ITEM_CATALOG[i.itemId]?.tags?.includes("food")).length;
        if (foodCount > 0 && b.maxHpPctPerFood) {
          side.maxHp = Math.floor(side.maxHp * (1 + foodCount * b.maxHpPctPerFood));
        }
        if (b.foodHealMult) side.classFoodHealMult = 1 + b.foodHealMult;
      }
    }
    Object.assign(globalThis, {
      CLASS_CATALOG,
      ITEM_CATALOG,
      getClassById,
      applyClassCombatBonus,
      applyMutationMilestoneCapstones,
      initMutationCapstoneRuntime,
      modifyMutationCapstoneDamage,
      tickMutationCapstonesImpl,
      CAPSTONE_INIT,
      MAGE_MANA_STACK_DAMAGE_MULT,
    });
  `, ctx);
  return sandbox;
}

function makeSide(overrides = {}) {
  return {
    hp: 80,
    maxHp: 100,
    block: 0,
    damageMult: 1,
    magicDamageMult: 1,
    cooldownMult: 1,
    poisonStacks: 0,
    stamina: 10,
    items: [{ itemId: "dagger", uid: "a" }, { itemId: "apple", uid: "b" }],
    stacks: {},
    ...overrides,
  };
}

function testNoviceClassPassives(sb) {
  const warrior = makeSide({ maxHp: 100 });
  sb.applyClassCombatBonus(warrior, "warrior");
  assert(warrior.maxHp === 103, `воин HP +3%: ${warrior.maxHp}`);

  const mage = makeSide();
  sb.applyClassCombatBonus(mage, "mage");
  assert(mage.magicDamageMult === 1.04, `маг magic +4%: ${mage.magicDamageMult}`);

  const priest = makeSide({ maxHp: 100, items: [{ itemId: "apple" }, { itemId: "banana" }] });
  sb.applyClassCombatBonus(priest, "priest");
  assert(priest.maxHp === 103, `жрец +1.5%×2 еды: ${priest.maxHp}`);
  assert(priest.classFoodHealMult === 1.08, "жрец heal mult");

  assert(sb.MAGE_MANA_STACK_DAMAGE_MULT === 1.25, "маг mana stack mult");
}

function testCapstoneInit(sb) {
  assert(Object.keys(sb.CAPSTONE_INIT).length === 32, "32 капстуна в init");
  const side = makeSide();
  sb.applyMutationMilestoneCapstones(side, null, "p_zrecrela");
  assert(side.mutationId === "p_zrecrela", "mutation id");
  assert(side.mutationRuntime.hymnInterval === 6, "hymn interval");

  const pal = makeSide();
  sb.applyMutationMilestoneCapstones(pal, null, "p_paladin");
  assert(pal.mutationRuntime.paladinBlockConvert === 0.12, "paladin convert");
}

function testAssassinBurst(sb) {
  const state = { player: makeSide({ mutationId: "r_assassin", mutationRuntime: { assassinBurstCd: 0, assassinBurstMult: 1.35 } }), enemy: makeSide({ poisonStacks: 4 }) };
  state.player.mutationId = "r_assassin";
  const dmg = sb.modifyMutationCapstoneDamage(
    state, "player", state.player, state.enemy, "enemy", 10, { damageType: "physical" },
  );
  assert(dmg === 13, `assassin burst 10→13, got ${dmg}`);
  assert(state.player.mutationRuntime.assassinBurstCd === 6, "assassin cd");
}

function testDiversityCapstone(sb) {
  const side = makeSide({
    items: [
      { itemId: "dagger" }, { itemId: "apple" }, { itemId: "mana_crystal" },
      { itemId: "holy_armor" }, { itemId: "pestilence_flask" },
    ],
  });
  sb.applyMutationMilestoneCapstones(side, null, "w_veteran");
  assert(side.mutationRuntime.diversityMult > 0, "veteran diversity bonus");
}

function testHymnTick(sb) {
  const state = {
    finished: false,
    player: makeSide({ mutationId: "p_zrecrela", mutationRuntime: { hymnTimer: 0, hymnInterval: 6 }, poisonStacks: 2 }),
    enemy: makeSide({ stamina: 5 }),
  };
  state.player.mutationId = "p_zrecrela";
  let logs = 0;
  const prevLog = sb.pushBattleLog;
  sb.pushBattleLog = () => { logs += 1; };
  sb.tickMutationCapstonesImpl(state, 6.1);
  sb.pushBattleLog = prevLog;
  assert(state.player.poisonStacks === 1, "hymn cleanse poison");
  assert(state.enemy.stamina === 4, "hymn -1 stamina");
  assert(logs >= 1, "hymn log");
}

const tests = [
  ["класс-новичок", () => testNoviceClassPassives(loadSandbox())],
  ["init капстунов", () => testCapstoneInit(loadSandbox())],
  ["ассасин burst", () => testAssassinBurst(loadSandbox())],
  ["diversity", () => testDiversityCapstone(loadSandbox())],
  ["гимн tick", () => testHymnTick(loadSandbox())],
];

let passed = 0;
let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
    failed += 1;
  }
}
console.log(`\nИтого: ${passed} ok, ${failed} fail`);
if (failed > 0) process.exit(1);
