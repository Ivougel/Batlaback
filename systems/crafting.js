// Transpiled from TypeScript — npm run compile:ts

const FALLBACK_RECIPES = [
  {
    id: "hero_sword",
    inputs: [
      { itemId: "rusty_sword", count: 1 },
      { itemId: "whetstone", count: 2 }
    ],
    output: "hero_sword"
  },
  {
    id: "poison_dagger_craft",
    inputs: [
      { itemId: "dagger", count: 1 },
      { itemId: "pestilence_flask", count: 1 }
    ],
    output: "poison_dagger"
  },
  {
    id: "shovel",
    inputs: [
      { itemId: "broom", count: 1 },
      { itemId: "pan", count: 1 }
    ],
    output: "shovel"
  }
];
function initCraftRecipes() {
  const ref = typeof BB_REFERENCE_RECIPES !== "undefined" ? BB_REFERENCE_RECIPES : null;
  if (ref?.length) return ref.slice();
  return FALLBACK_RECIPES.slice();
}
const SOURCE_CRAFT_RECIPES = initCraftRecipes();
const ITEM_RECIPES = SOURCE_CRAFT_RECIPES.slice();
const RECIPES_BY_INGREDIENT = /* @__PURE__ */ new Map();
const RECIPES_BY_OUTPUT = /* @__PURE__ */ new Map();
function isGameModeKnown() {
  if (typeof selectedGameMode !== "undefined" && selectedGameMode) return true;
  if (typeof gameMode !== "undefined" && gameMode) return true;
  if (typeof document !== "undefined" && document.documentElement?.dataset?.gameMode) return true;
  return false;
}
function shouldPruneCraftRecipesForPool() {
  if (!isGameModeKnown()) return false;
  return typeof shouldFilterToPool120 === "function" && shouldFilterToPool120();
}
function rebuildCraftRecipeIndex() {
  RECIPES_BY_INGREDIENT.clear();
  RECIPES_BY_OUTPUT.clear();
  ITEM_RECIPES.forEach((recipe) => {
    RECIPES_BY_OUTPUT.set(recipe.output, recipe);
    recipe.inputs.forEach((input) => {
      if (!RECIPES_BY_INGREDIENT.has(input.itemId)) {
        RECIPES_BY_INGREDIENT.set(input.itemId, []);
      }
      RECIPES_BY_INGREDIENT.get(input.itemId).push(recipe);
    });
  });
}
function pruneCraftRecipesOutsidePool() {
  if (!shouldPruneCraftRecipesForPool()) return;
  if (typeof isItemInPool120 !== "function") return;
  for (let i = ITEM_RECIPES.length - 1; i >= 0; i -= 1) {
    const recipe = ITEM_RECIPES[i];
    const ids = [recipe.output, ...recipe.inputs.map((input) => input.itemId)];
    if (ids.some((id) => !isItemInPool120(id))) {
      ITEM_RECIPES.splice(i, 1);
    }
  }
}
function syncCraftOutputIdSet() {
  if (typeof CRAFT_OUTPUT_IDS === "undefined") return;
  CRAFT_OUTPUT_IDS.clear();
  ITEM_RECIPES.forEach((recipe) => {
    if (recipe?.output) CRAFT_OUTPUT_IDS.add(recipe.output);
  });
}
function refreshCraftRecipesForCurrentMode() {
  ITEM_RECIPES.length = 0;
  ITEM_RECIPES.push(...SOURCE_CRAFT_RECIPES);
  pruneCraftRecipesOutsidePool();
  rebuildCraftRecipeIndex();
  syncCraftOutputIdSet();
  if (typeof ItemUnlockTiers !== "undefined" && ItemUnlockTiers.rebuild) {
    ItemUnlockTiers.rebuild();
  }
}
refreshCraftRecipesForCurrentMode();
function recipeInputTotal(recipe) {
  return recipe.inputs.reduce((sum, input) => sum + input.count, 0);
}
function countItemsById(items) {
  const counts = /* @__PURE__ */ new Map();
  items.forEach((item) => {
    counts.set(item.itemId, (counts.get(item.itemId) || 0) + 1);
  });
  return counts;
}
function recipeMatchesCluster(clusterItems, recipe) {
  const counts = countItemsById(clusterItems);
  if (clusterItems.length !== recipeInputTotal(recipe)) return false;
  return recipe.inputs.every((input) => (counts.get(input.itemId) || 0) === input.count);
}
function chooseK(arr, k) {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const out = [];
  const walk = (start, picked) => {
    if (picked.length === k) {
      out.push([...picked]);
      return;
    }
    for (let i = start; i <= arr.length - (k - picked.length); i += 1) {
      picked.push(arr[i]);
      walk(i + 1, picked);
      picked.pop();
    }
  };
  walk(0, []);
  return out;
}
function isCraftClusterConnected(clusterItems, pool) {
  if (clusterItems.length <= 1) return true;
  const uidSet = new Set(clusterItems.map((item) => item.uid));
  const visited = /* @__PURE__ */ new Set([clusterItems[0].uid]);
  const queue = [clusterItems[0]];
  while (queue.length) {
    const current = queue.shift();
    getAdjacentItems(pool, current).forEach((entry, uid) => {
      if (!entry.strong || !uidSet.has(uid) || visited.has(uid)) return;
      visited.add(uid);
      queue.push(entry.item);
    });
  }
  return visited.size === clusterItems.length;
}
function enumerateRecipeClusters(items, recipe) {
  const pool = items.filter((item) => !ITEM_CATALOG[item.itemId]?.isContainer);
  const pickGroups = [];
  for (const input of recipe.inputs) {
    const matches = pool.filter((item) => item.itemId === input.itemId);
    if (matches.length < input.count) return [];
    pickGroups.push(chooseK(matches, input.count));
  }
  const results = [];
  const seen = /* @__PURE__ */ new Set();
  const cartesian = (groupIndex, acc) => {
    if (groupIndex >= pickGroups.length) {
      const uids = acc.map((item) => item.uid);
      if (new Set(uids).size !== uids.length) return;
      const key = uids.slice().sort().join(",");
      if (seen.has(key)) return;
      if (!isCraftClusterConnected(acc, pool)) return;
      seen.add(key);
      results.push(acc.slice());
      return;
    }
    for (const group of pickGroups[groupIndex]) {
      cartesian(groupIndex + 1, acc.concat(group));
    }
  };
  cartesian(0, []);
  return results;
}
function hasMatchingRecipeCluster(items, recipe) {
  return enumerateRecipeClusters(items, recipe).length > 0;
}
function getStrongCraftComponents(items) {
  const pool = items.filter((item) => !ITEM_CATALOG[item.itemId]?.isContainer);
  const visited = /* @__PURE__ */ new Set();
  const components = [];
  pool.forEach((seed) => {
    if (visited.has(seed.uid)) return;
    const component = [];
    const queue = [seed];
    visited.add(seed.uid);
    while (queue.length) {
      const current = queue.shift();
      component.push(current);
      getAdjacentItems(pool, current).forEach((entry, uid) => {
        if (!entry.strong || visited.has(uid)) return;
        visited.add(uid);
        queue.push(entry.item);
      });
    }
    components.push(component);
  });
  return components;
}
function getClusterAnchor(items) {
  let col = Infinity;
  let row = Infinity;
  items.forEach((item) => {
    col = Math.min(col, item.col);
    row = Math.min(row, item.row);
  });
  return { col: Number.isFinite(col) ? col : 0, row: Number.isFinite(row) ? row : 0 };
}
function findCraftPlacement(containers, items, outputId, preferCol, preferRow) {
  const candidates = [];
  const seen = /* @__PURE__ */ new Set();
  const addCandidate = (col, row) => {
    const key = `${col},${row}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ col, row });
  };
  addCandidate(preferCol, preferRow);
  items.forEach((item) => {
    getItemCells(item).forEach(([c, r]) => addCandidate(c, r));
  });
  if (typeof buildSlotSet === "function") {
    buildSlotSet(containers).forEach((key) => {
      const [c, r] = key.split(",").map(Number);
      addCandidate(c, r);
    });
  }
  for (let i = 0; i < candidates.length; i += 1) {
    const { col, row } = candidates[i];
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const placement = resolveLoadoutPlacement(
        containers,
        items,
        outputId,
        col,
        row,
        rotation,
        null
      );
      if (placement.valid) return placement;
    }
  }
  return null;
}
function applyRecipe(containers, items, recipe, clusterItems) {
  const removeUids = new Set(clusterItems.map((item) => item.uid));
  const remaining = items.filter((item) => !removeUids.has(item.uid));
  const anchor = getClusterAnchor(clusterItems);
  const placement = findCraftPlacement(containers, remaining, recipe.output, anchor.col, anchor.row);
  if (!placement) return null;
  const placed = createPlacedItem(recipe.output, placement.col, placement.row, placement.rotation);
  return {
    items: [...remaining, placed],
    placed,
    recipe
  };
}
function tryResolveCrafting(containers, items, ctx = null) {
  const craftCtx = ctx || (typeof getCraftContextFromGame === "function" ? getCraftContextFromGame(typeof prepViewSide !== "undefined" ? prepViewSide : "player") : {});
  const crafted = [];
  let nextItems = items;
  let changed = true;
  while (changed) {
    changed = false;
    for (const recipe of ITEM_RECIPES) {
      if (typeof isCraftRecipeAvailable === "function" && !isCraftRecipeAvailable(recipe, craftCtx)) {
        continue;
      }
      let applied = null;
      for (const cluster of enumerateRecipeClusters(nextItems, recipe)) {
        applied = applyRecipe(containers, nextItems, recipe, cluster);
        if (applied) break;
      }
      if (!applied) continue;
      nextItems = applied.items;
      crafted.push(applied.recipe);
      changed = true;
      break;
    }
  }
  return { items: nextItems, crafted };
}
function canApplyCraftRecipe(containers, items, recipe, clusterItems) {
  const removeUids = new Set(clusterItems.map((item) => item.uid));
  const remaining = items.filter((item) => !removeUids.has(item.uid));
  const anchor = getClusterAnchor(clusterItems);
  return !!findCraftPlacement(containers, remaining, recipe.output, anchor.col, anchor.row);
}
function detectMatchingCraftClusters(containers, items, ctx = null) {
  const craftCtx = ctx || (typeof getCraftContextFromGame === "function" ? getCraftContextFromGame(typeof prepViewSide !== "undefined" ? prepViewSide : "player") : {});
  const usedUids = /* @__PURE__ */ new Set();
  const results = [];
  let pool = items;
  let found = true;
  while (found) {
    found = false;
    for (const recipe of ITEM_RECIPES) {
      if (typeof isCraftRecipeAvailable === "function" && !isCraftRecipeAvailable(recipe, craftCtx)) {
        continue;
      }
      for (const cluster of enumerateRecipeClusters(pool, recipe)) {
        if (cluster.some((item) => usedUids.has(item.uid))) continue;
        cluster.forEach((item) => usedUids.add(item.uid));
        results.push({
          recipe,
          clusterItems: cluster,
          anchor: getClusterAnchor(cluster)
        });
        found = true;
        break;
      }
      if (found) break;
    }
  }
  return results;
}
function getRecipesUsingIngredient(itemId) {
  return RECIPES_BY_INGREDIENT.get(itemId) || [];
}
function getRecipeForOutput(itemId) {
  return RECIPES_BY_OUTPUT.get(itemId) || null;
}
function escapeCraftTooltipHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
function getCraftItemIcon(itemId) {
  const def = ITEM_CATALOG[itemId];
  if (!def) return "\u25FB\uFE0F";
  if (typeof getItemIcons === "function") return getItemIcons(def)[0] || def.icon || "\u25FB\uFE0F";
  return def.icon || "\u25FB\uFE0F";
}
function getCraftItemName(itemId) {
  const def = ITEM_CATALOG[itemId];
  if (!def) return itemId;
  return typeof getItemDisplayName === "function" ? getItemDisplayName(def) : def.name ?? itemId;
}
function renderCraftRecipeChipHtml(itemId, count = 1) {
  const icon = getCraftItemIcon(itemId);
  const name = getCraftItemName(itemId);
  const countHtml = count > 1 ? `<span class="craft-recipe-chip__count">${count}\xD7</span>` : "";
  return `<span class="craft-recipe-chip" data-item-id="${escapeCraftTooltipHtml(itemId)}" data-name="${escapeCraftTooltipHtml(name)}" tabindex="0" role="img" aria-label="${escapeCraftTooltipHtml(name)}">${countHtml}<span class="craft-recipe-chip__icon" aria-hidden="true">${icon}</span><span class="craft-recipe-chip__tip" aria-hidden="true">${escapeCraftTooltipHtml(name)}</span></span>`;
}
function buildCraftRecipeParts(recipe) {
  const parts = [];
  recipe.inputs.forEach((input, index) => {
    if (index > 0) parts.push({ type: "op", text: "+" });
    parts.push({ type: "chip", itemId: input.itemId, count: input.count });
  });
  parts.push({ type: "op", text: "=" });
  parts.push({ type: "chip", itemId: recipe.output, count: 1 });
  return parts;
}
function renderCraftRecipeLineHtml(parts) {
  const inner = parts.map((part) => {
    if (part.type === "op") {
      return `<span class="craft-recipe-op" aria-hidden="true">${part.text}</span>`;
    }
    return renderCraftRecipeChipHtml(part.itemId, part.count || 1);
  }).join("");
  return `<div class="craft-recipe-line">${inner}</div>`;
}
function formatRecipeInputs(recipe) {
  const parts = [];
  recipe.inputs.forEach((input) => {
    const def = ITEM_CATALOG[input.itemId];
    const label = def ? `${def.icon} ${def.name}` : input.itemId;
    parts.push(input.count > 1 ? `${input.count}\xD7 ${label}` : label);
  });
  return parts.join(" + ");
}
function getCraftTooltipLines(itemId, side = null) {
  const lines = [];
  const craftCtx = typeof getCraftContextFromGame === "function" ? getCraftContextFromGame(side || (typeof prepViewSide !== "undefined" ? prepViewSide : "player")) : {};
  const comboLines = [];
  let outputRecipeShown = false;
  const asOutput = getRecipeForOutput(itemId);
  if (asOutput) {
    const available = typeof isCraftRecipeAvailable !== "function" || isCraftRecipeAvailable(asOutput, craftCtx);
    if (available) {
      outputRecipeShown = true;
      comboLines.push({
        html: renderCraftRecipeLineHtml(buildCraftRecipeParts(asOutput)),
        style: "craft-recipe",
        color: "#d2a8ff"
      });
    } else if (asOutput.hint) {
      comboLines.push({
        text: `\u041D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E (${asOutput.hint})`,
        color: "#8b949e"
      });
    }
  }
  getRecipesUsingIngredient(itemId).forEach((recipe) => {
    const out = ITEM_CATALOG[recipe.output];
    if (!out) return;
    const available = typeof isCraftRecipeAvailable !== "function" || isCraftRecipeAvailable(recipe, craftCtx);
    if (!available) return;
    comboLines.push({
      html: renderCraftRecipeLineHtml(buildCraftRecipeParts(recipe)),
      style: "craft-recipe",
      color: "#bc8cff"
    });
  });
  if (!comboLines.length) return lines;
  lines.push({
    text: outputRecipeShown ? "\u2697\uFE0F \u041A\u0440\u0430\u0444\u0442" : "\u2697\uFE0F \u041A\u043E\u043C\u0431\u0438\u043D\u0430\u0446\u0438\u0438",
    style: "label",
    color: "#bc8cff"
  });
  comboLines.forEach((entry) => {
    if (entry.html) {
      lines.push({ html: entry.html, style: entry.style || "craft-recipe", color: entry.color });
    } else {
      lines.push({ text: entry.text, style: "normal", color: entry.color });
    }
  });
  const flavor = typeof getItemGrimFlavor === "function" ? getItemGrimFlavor(itemId) : "";
  if (flavor) {
    lines.push({
      text: flavor,
      style: "flavor",
      color: "#848896"
    });
  }
  return lines;
}
function getCraftTooltipMeta(itemId, side = null) {
  const lines = getCraftTooltipLines(itemId, side);
  if (!lines.length) return null;
  const labelLine = lines.find((line) => line.style === "label");
  const labelText = labelLine?.text || "\u2697\uFE0F \u041A\u0440\u0430\u0444\u0442";
  const isCombo = labelText.includes("\u041A\u043E\u043C\u0431\u0438\u043D\u0430\u0446\u0438\u0438");
  const recipeCount = lines.filter(
    (line) => line.style === "craft-recipe" || line.html && line.style !== "flavor"
  ).length;
  return {
    buttonLabel: labelText.replace(/^⚗️\s*/, "") || "\u041A\u0440\u0430\u0444\u0442",
    buttonHint: isCombo ? "\u0420\u0435\u0446\u0435\u043F\u0442\u044B, \u0433\u0434\u0435 \u0443\u0447\u0430\u0441\u0442\u0432\u0443\u0435\u0442 \u044D\u0442\u043E\u0442 \u043F\u0440\u0435\u0434\u043C\u0435\u0442" : recipeCount > 1 ? `${recipeCount} \u0440\u0435\u0446\u0435\u043F\u0442\u0430 \u043A\u0440\u0430\u0444\u0442\u0430` : "\u041A\u0430\u043A \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u044D\u0442\u043E\u0442 \u043F\u0440\u0435\u0434\u043C\u0435\u0442",
    lines,
    recipeCount
  };
}
function isCraftIngredient(itemId) {
  return RECIPES_BY_INGREDIENT.has(itemId);
}
function getAllCraftRecipes() {
  return ITEM_RECIPES;
}
function getCraftOutputItemIds() {
  return ITEM_RECIPES.map((recipe) => recipe.output);
}
function getCraftContextHeroClass(ctx = null) {
  if (ctx?.playerClass) return ctx.playerClass;
  if (ctx?.classId) return ctx.classId;
  if (typeof pendingPlayerClass !== "undefined" && pendingPlayerClass) return pendingPlayerClass;
  if (typeof playerClass !== "undefined" && playerClass) return playerClass;
  return null;
}
function isCraftRecipeAvailable(recipe, ctx = null) {
  if (!recipe) return false;
  if (typeof isClassicMode === "function" && isClassicMode()) return true;
  if (typeof MetaProgress === "undefined" || !MetaProgress.isActiveForRun()) return true;
  const heroClass = getCraftContextHeroClass(ctx);
  return recipe.inputs.every((input) => MetaProgress.isItemUnlocked(input.itemId, heroClass ?? ""));
}
function getVisibleCraftRecipes(ctx = null) {
  return ITEM_RECIPES.filter((recipe) => isCraftRecipeAvailable(recipe, ctx));
}
function getCraftIngredientItemIds() {
  const ids = /* @__PURE__ */ new Set();
  ITEM_RECIPES.forEach((recipe) => {
    recipe.inputs.forEach((input) => ids.add(input.itemId));
  });
  return [...ids];
}
window.refreshCraftRecipesForCurrentMode = refreshCraftRecipesForCurrentMode;
