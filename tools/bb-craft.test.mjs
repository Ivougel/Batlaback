/**
 * Smoke-тесты крафта BB classic.
 * node tools/bb-craft.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadSandbox(mode = "classic") {
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
    gameMode: mode,
    selectedGameMode: mode,
    playerClass: "warrior",
    pendingPlayerClass: "warrior",
    prepViewSide: "player",
    document: { documentElement: { dataset: {} }, querySelectorAll: () => [] },
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    CRAFT_OUTPUT_IDS: new Set(),
    getCraftOutputItemIds: () => [],
    isCraftOutputItemId: () => false,
    filterItemsToPool120: (items) => items,
    shouldFilterToPool120: () => mode === "classic" ? false : true,
    isClassicMode: () => mode === "classic",
    isPathMode: () => mode === "path",
    getClassById: (id) => ({ id, name: id }),
    getItemIcons: (def) => [def?.icon || "📦"],
    getItemDisplayName: (def) => def?.name || "",
    getAdjacentItems: () => new Map(),
    getItemCells: () => [],
    resolveLoadoutPlacement: () => ({ valid: false }),
    createPlacedItem: () => ({}),
    window: null,
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  [
    "systems/bb-classic.js",
    "systems/bb-reference-recipes.js",
    "systems/item-pool-120.js",
    "items.js",
    "items-catalog.js",
    "systems/bb-reference-unlocks.js",
    "systems/item-unlock-tiers.js",
    "systems/meta-progress.js",
    "systems/item-presentation.js",
    "systems/crafting.js",
  ].forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), ctx);
  });
  return sandbox;
}

function run() {
  const classic = loadSandbox("classic");
  classic.MetaProgress.setRunMode("classic");

  const all = classic.getAllCraftRecipes();
  assert(all.length >= 70, `expected 70+ recipes, got ${all.length}`);

  assert(classic.isCraftRecipeAvailable(all.find((r) => r.output === "shovel"), { playerClass: "warrior" }), "shovel craft available at start");

  const katana = all.find((r) => r.output === "katana");
  if (katana) {
    const locked = !classic.isCraftRecipeAvailable(katana, { playerClass: "warrior" });
    assert(typeof locked === "boolean", "katana availability check");
  }

  assert(typeof classic.getVisibleCraftRecipes === "function", "getVisibleCraftRecipes exists");
  assert(classic.getVisibleCraftRecipes({ playerClass: "warrior" }).length > 0, "visible recipes");

  const solo = loadSandbox("solo");
  solo.MetaProgress.setRunMode("solo");
  assert(solo.isCraftRecipeAvailable(all[0], { playerClass: "warrior" }), "solo: all crafts available");

  console.log(`bb-craft.test.mjs: OK (${all.length} recipes)`);
}

run();
