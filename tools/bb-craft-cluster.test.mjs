/**
 * Кластеры крафта: pending без места под результат + поиск клеток после снятия ингредиентов.
 * node tools/bb-craft-cluster.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadCraftSandbox() {
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
    gameMode: "classic",
    selectedGameMode: "classic",
    playerClass: "warrior",
    prepViewSide: "player",
    round: 1,
    phase: "prep",
    document: { documentElement: { dataset: {} }, querySelectorAll: () => [] },
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    getItemIcons: (def) => [def?.icon || "📦"],
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
    "backpack-engine.js",
    "systems/crafting.js",
    "systems/craft-pending.js",
  ].forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), ctx);
  });
  vm.runInContext(`
    function getSideState(side) { return { containers: playerContainers, items: playerItems, bench: [] }; }
    var playerContainers = createStartingContainers();
    var playerItems = [];
    function mk(id, col, row, rot = 0) { return createPlacedItem(id, col, row, rot); }
    var filler = ["rusty_sword", "iron_helmet", "whetstone", "dagger", "poison_vial", "broom", "pan"];
  `, ctx);
  return sandbox;
}

function run() {
  const s = loadCraftSandbox();
  const recipe = s.getAllCraftRecipes().find((r) => r.output === "stone_helm");
  assert(recipe, "stone_helm recipe");

  vm.runInContext(`
    const o = getStarterBagOrigin(9, 7, 3, 3);
    playerContainers = createStartingContainers();
    playerItems = [];
    let fi = 0;
    for (let r = o.row; r < o.row + 3; r += 1) {
      for (let c = o.col; c < o.col + 3; c += 1) {
        if (c === o.col && r === o.row) { playerItems.push(mk("cap_of_resilience", c, r)); continue; }
        if (c === o.col + 1 && r === o.row) { playerItems.push(mk("stone_skin_potion", c, r)); continue; }
        playerItems.push(mk(filler[fi++], c, r));
      }
    }
  `, s);

  const cluster = s.enumerateRecipeClusters(s.playerItems, recipe)[0];
  assert(cluster, "cap + potion cluster on full 3×3");
  assert(!s.canApplyCraftRecipe(s.playerContainers, s.playerItems, recipe, cluster),
    "no 2×2 space on packed starter bag");
  const detected = s.detectMatchingCraftClusters(s.playerContainers, s.playerItems, { playerClass: "warrior" });
  assert(detected.some((d) => d.recipe.output === "stone_helm"),
    "pending craft detected even without output space");

  s.syncPendingCraftClustersForContainers(s.playerContainers, s.playerItems, "player", 1);
  assert(s.getPendingCraftsForSide("player").some((e) => e.recipeId === recipe.id),
    "pending entry registered");

  vm.runInContext(`
    (function () {
      const origin = getStarterBagOrigin(9, 7, 3, 3);
      playerItems = [mk("cap_of_resilience", origin.col, origin.row), mk("stone_skin_potion", origin.col + 1, origin.row)];
    })();
  `, s);
  const sparseCluster = s.enumerateRecipeClusters(s.playerItems, recipe)[0];
  assert(s.canApplyCraftRecipe(s.playerContainers, s.playerItems, recipe, sparseCluster),
    "sparse board fits stone_helm");
  const applied = s.applyRecipe(s.playerContainers, s.playerItems, recipe, sparseCluster);
  assert(applied?.placed?.itemId === "stone_helm", "craft applies on sparse board");

  console.log("bb-craft-cluster.test.mjs: OK");
}

run();
