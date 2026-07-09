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
  assert(s.getPrepShopSlotCount() === 4, "4 shop slots");

  s.MetaProgress.setPickerMode("classic");
  s.MetaProgress.setRunMode("classic");
  assert(s.MetaProgress.isActiveForRun(), "meta unlock in classic run");
  assert(s.MetaProgress.isItemUnlocked("rusty_sword", "warrior"), "starter unlocked");

  const locked = s.getItemPresentationState("katana", "warrior");
  assert(typeof locked.locked === "boolean", "presentation state");

  s.gameMode = "solo";
  s.selectedGameMode = "solo";
  assert(!s.isClassicMode(), "solo is not classic");
  assert(s.shouldUseMutationSystem(), "mutations on in solo");
  assert(s.getPrepShopSlotCount() === 5, "5 shop slots in solo");

  console.log("bb-classic.test.mjs: OK");
}

run();
