/**
 * Sandbox для audit/tests max-account (classic).
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export function createMaxAccountSandbox(root, mode = "classic") {
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
    getClassById: (id) => ({ id, name: id, heroLabel: id }),
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
    "shop-engine.js",
    "systems/bb-reference-unlocks.js",
    "systems/item-unlock-tiers.js",
    "systems/meta-progress.js",
    "systems/item-presentation.js",
    "systems/crafting.js",
    "classes.js",
  ].forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), ctx);
  });
  vm.runInContext(`
    if (typeof ITEM_CATALOG !== "undefined") this.ITEM_CATALOG = ITEM_CATALOG;
    if (typeof ITEM_RECIPES !== "undefined") this.ITEM_RECIPES = ITEM_RECIPES;
    if (typeof CLASS_CATALOG !== "undefined") this.CLASS_CATALOG = CLASS_CATALOG;
  `, ctx);
  sandbox.MetaProgress?.setPickerMode?.(mode);
  sandbox.MetaProgress?.setRunMode?.(mode);
  return sandbox;
}

/** Предметы, участвующие в classic shop/craft (без solo/path-only слоёв). */
export function isClassicPlayableItem(item) {
  if (!item?.id) return false;
  if ((item.tags || []).includes("gem")) return false;
  if (item.isEnhancementItem) return false;
  if (item.isBuildKey) return false;
  if (item.isAmplifierItem) return false;
  return true;
}

/** Достижимость: shop ∪ транзитивное замыкание craft outputs (variant A). */
export function computeReachableItemIds(sandbox, round = 10, heroClass = "warrior") {
  const reachable = new Set(["starter_bag"]);
  const mechClass = sandbox.getMechanicalClassId?.(heroClass) ?? heroClass ?? null;
  Object.values(sandbox.ITEM_CATALOG).forEach((item) => {
    if (sandbox.isShopEligibleItem(item, mechClass, round)) {
      reachable.add(item.id);
    }
  });

  const recipes = sandbox.ITEM_RECIPES || sandbox.getAllCraftRecipes?.() || [];
  let changed = true;
  while (changed) {
    changed = false;
    recipes.forEach((recipe) => {
      if (!recipe?.output || reachable.has(recipe.output)) return;
      const outputDef = sandbox.ITEM_CATALOG?.[recipe.output];
      if (outputDef?.classRestriction && outputDef.classRestriction !== heroClass) return;
      const inputs = recipe.inputs || [];
      if (inputs.length > 0 && inputs.every((inp) => reachable.has(inp.itemId))) {
        reachable.add(recipe.output);
        changed = true;
      }
    });
  }
  return reachable;
}

function isItemForHero(item, heroClass) {
  if (!item?.classRestriction) return true;
  return item.classRestriction === heroClass;
}

export function auditMaxAccountPool(sandbox) {
  const catalog = Object.values(sandbox.ITEM_CATALOG);
  const playable = catalog.filter(isClassicPlayableItem);
  const heroes = Object.keys(sandbox.CLASS_CATALOG || {});
  const unreachableByHero = {};
  heroes.forEach((heroId) => {
    const reachable = computeReachableItemIds(sandbox, 10, heroId);
    const expected = playable.filter((item) => isItemForHero(item, heroId));
    unreachableByHero[heroId] = expected.filter((item) => !reachable.has(item.id));
  });
  const reachable = computeReachableItemIds(sandbox);
  const shopEligible = playable.filter((item) => {
    const mech = sandbox.getMechanicalClassId?.("warrior") ?? null;
    return sandbox.isShopEligibleItem(item, mech, 10);
  });
  const craftOnly = playable.filter((item) => item.craftOnly);
  const craftOutputs = playable.filter((item) => sandbox.isCraftOutputItemId?.(item.id));
  const unreachable = [...new Set(heroes.flatMap((id) => unreachableByHero[id].map((i) => i.id)))]
    .map((id) => sandbox.ITEM_CATALOG[id])
    .filter(Boolean);

  return {
    catalogTotal: catalog.length,
    playableTotal: playable.length,
    shopEligible: shopEligible.length,
    craftOnly: craftOnly.length,
    craftOutputs: craftOutputs.length,
    reachable: reachable.size,
    unreachable,
    unreachableIds: unreachable.map((i) => i.id).sort(),
    unreachableByHero,
  };
}
