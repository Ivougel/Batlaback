/**
 * Smoke-тесты режима Classic BB.
 * node tools/bb-classic.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadSandbox() {
  const storage = new Map();
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
    document: { documentElement: { dataset: {} }, querySelectorAll: () => [] },
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    gameMode: "classic",
    selectedGameMode: "classic",
    playerClass: "warrior",
    pendingPlayerClass: "warrior",
    CRAFT_OUTPUT_IDS: new Set(),
    getCraftOutputItemIds: () => [],
    isCraftOutputItemId: () => false,
    filterItemsToPool120: (items) => items,
    getClassById: (id) => ({ id, name: id }),
    getItemIcons: (def) => [def?.icon || "📦"],
    getItemDisplayName: (def) => def?.name || "",
    window: null,
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  [
    "systems/bb-classic.js",
    "systems/item-pool-120.js",
    "items.js",
    "items-catalog.js",
    "shop-engine.js",
    "systems/bb-reference-unlocks.js",
    "systems/item-unlock-tiers.js",
    "systems/meta-progress.js",
    "systems/item-presentation.js",
  ].forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), ctx);
  });
  return sandbox;
}

function run() {
  const s = loadSandbox();

  assert(s.isClassicMode(), "classic mode active");
  assert(!s.shouldUseMutationSystem(), "mutations off");
  assert(!s.shouldUseCustomShopRolls(), "custom shop rolls off");
  assert(!s.shouldFilterToPool120(), "pool120 filter off");
  assert(!s.shouldUseAdjacencySynergies(), "classic uses star slots not adjacency");
  assert(s.getPrepShopSlotCount() === 5, "5 shop slots in classic");
  assert(s.isMaxAccountMode(), "max account in classic");
  assert(!s.shouldUseClassSystem(), "class combat bonuses off in classic");
  assert(s.shouldApplyClassItemRestriction(), "class item restriction on in classic");
  assert(!s.shouldSkipClassIntro(), "hero pick stays in classic (cosmetic only)");
  assert(s.getMechanicalClassId("warrior") === "warrior", "mechanical class preserved for restrictions");

  const warriorItem = { id: "test_warrior", classRestriction: "warrior", craftOnly: false, tags: [] };
  const rogueItem = { id: "test_rogue", classRestriction: "rogue", craftOnly: false, tags: [] };
  assert(s.isShopEligibleItem(warriorItem, "warrior", 1), "warrior item eligible for warrior");
  assert(!s.isShopEligibleItem(warriorItem, "rogue", 1), "warrior item blocked for rogue");
  assert(!s.isShopEligibleItem(rogueItem, "warrior", 1), "rogue item blocked for warrior");
  assert(s.isShopEligibleItem(rogueItem, "rogue", 1), "rogue item eligible for rogue");
  assert(s.isShopEligibleItem(warriorItem, null, 1), "class-restricted item eligible when classless");

  s.MetaProgress.setPickerMode("classic");
  s.MetaProgress.setRunMode("classic");
  const heroes = ["warrior", "rogue", "mage", "priest"];
  heroes.forEach((id) => {
    assert(s.MetaProgress.isHeroUnlocked(id), `hero unlocked: ${id}`);
  });
  assert(!s.MetaProgress.isActiveForRun(), "meta unlock off in classic (max account)");
  assert(s.MetaProgress.isItemUnlocked("rusty_sword", "warrior"), "starter unlocked when meta off");
  assert(s.MetaProgress.isItemUnlocked("katana", "warrior"), "all items unlocked when meta off");

  const katana = s.getItemPresentationState("katana", "warrior");
  assert(!katana.locked, "no lock overlay when meta off");

  s.gameMode = "solo";
  s.selectedGameMode = "solo";
  assert(!s.isClassicMode(), "solo is not classic");
  assert(s.shouldUseMutationSystem(), "mutations on in solo");
  assert(!s.shouldUseAdjacencySynergies(), "solo uses star slots not adjacency");
  assert(s.getPrepShopSlotCount() === 5, "5 shop slots in solo");

  console.log("bb-classic.test.mjs: OK");
}

run();
