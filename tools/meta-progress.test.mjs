/**
 * Smoke-тесты мета-прогрессии.
 * node tools/meta-progress.test.mjs
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
  const storage = new Map();
  const sandbox = {
    console, Math, Object, Array, Map, Set, JSON, Number, String, Boolean,
    window: null,
    document: { documentElement: { dataset: {} }, querySelectorAll: () => [] },
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    location: { search: "" },
    CRAFT_OUTPUT_IDS: new Set(),
    getCraftOutputItemIds: () => [],
    isCraftOutputItemId: () => false,
    filterItemsToPool120: (items) => items,
    getClassById: (id) => ({ id, name: id }),
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);

  const files = [
    "systems/item-pool-120.js",
    "items.js",
    "items-catalog.js",
    "shop-engine.js",
    "classes.js",
    "systems/item-unlock-tiers.js",
    "systems/meta-progress.js",
  ];
  files.forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), ctx);
  });
  return sandbox;
}

function run() {
  const s = loadSandbox();
  const { MetaProgress, ItemUnlockTiers } = s;

  assert(MetaProgress.isHeroUnlocked("warrior"), "warrior unlocked");
  assert(MetaProgress.isHeroUnlocked("rogue"), "rogue unlocked");
  assert(!MetaProgress.isHeroUnlocked("mage"), "mage locked");
  assert(!MetaProgress.isHeroUnlocked("priest"), "priest locked");

  const warriorProg = MetaProgress.countItemProgress("warrior");
  assert(warriorProg.unlocked > 0, "warrior has starter items");
  assert(warriorProg.unlocked < warriorProg.total, "warrior not full catalog");

  assert(MetaProgress.isItemUnlocked("rusty_sword", "warrior"), "rusty_sword starter");

  MetaProgress.recordRunEnd({
    classId: "warrior",
    runResults: ["win", "loss"],
    round: 8,
    wins: 1,
  });
  assert(MetaProgress.getHeroRecord("warrior").runs === 1, "warrior run count");

  MetaProgress.recordRunEnd({
    classId: "rogue",
    runResults: ["win"],
    round: 5,
    wins: 1,
  });
  assert(MetaProgress.isHeroUnlocked("mage"), "mage after 2 completed runs");

  for (let i = 0; i < 10; i += 1) {
    MetaProgress.recordRunEnd({
      classId: "warrior",
      runResults: Array(12).fill("win"),
      round: 12,
      wins: 12,
    });
  }
  assert(MetaProgress.getHeroLevel("warrior") >= 3, "warrior level 3+");
  assert(MetaProgress.isHeroUnlocked("priest"), "priest after warrior 3");

  const katanaLevel = ItemUnlockTiers.getMinLevel("katana");
  assert(katanaLevel >= 10, "katana high tier unlock");

  console.log("meta-progress.test.mjs: OK (8 checks)");
}

run();
