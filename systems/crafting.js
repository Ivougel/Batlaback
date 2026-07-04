/**
 * Крафт: связные группы предметов (ребро к ребру) сливаются в новый предмет.
 */

const ITEM_RECIPES = [
  {
    id: "hero_sword",
    inputs: [
      { itemId: "rusty_sword", count: 1 },
      { itemId: "whetstone", count: 2 },
    ],
    output: "hero_sword",
  },
  {
    id: "hero_long_sword",
    inputs: [
      { itemId: "hero_sword", count: 1 },
      { itemId: "whetstone", count: 2 },
    ],
    output: "hero_long_sword",
  },
  {
    id: "falcon_blade",
    inputs: [
      { itemId: "hero_sword", count: 1 },
      { itemId: "gloves_of_haste", count: 2 },
    ],
    output: "falcon_blade",
  },
  {
    id: "crossblades",
    inputs: [
      { itemId: "hero_long_sword", count: 1 },
      { itemId: "falcon_blade", count: 1 },
    ],
    output: "crossblades",
  },
  {
    id: "poison_dagger_craft",
    inputs: [
      { itemId: "dagger", count: 1 },
      { itemId: "pestilence_flask", count: 1 },
    ],
    output: "poison_dagger",
  },
  {
    id: "spectral_dagger",
    inputs: [
      { itemId: "dagger", count: 1 },
      { itemId: "mana_crystal", count: 1 },
    ],
    output: "spectral_dagger",
  },
  {
    id: "manathirst",
    inputs: [
      { itemId: "hungry_blade", count: 1 },
      { itemId: "mana_crystal", count: 1 },
    ],
    output: "manathirst",
  },
  {
    id: "enchanted_staff",
    inputs: [
      { itemId: "broom", count: 1 },
      { itemId: "mana_crystal", count: 1 },
    ],
    output: "enchanted_staff",
  },
  {
    id: "shovel",
    inputs: [
      { itemId: "broom", count: 1 },
      { itemId: "pan", count: 1 },
    ],
    output: "shovel",
  },
  {
    id: "eggscalibur",
    inputs: [
      { itemId: "pan", count: 1 },
      { itemId: "heroic_potion", count: 1 },
    ],
    output: "eggscalibur",
  },
];

const RECIPES_BY_INGREDIENT = new Map();
const RECIPES_BY_OUTPUT = new Map();

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

if (typeof getEnhancementCraftRecipes === "function") {
  ITEM_RECIPES.push(...getEnhancementCraftRecipes());
}

function pruneCraftRecipesOutsidePool() {
  if (typeof isItemInPool120 !== "function") return;
  for (let i = ITEM_RECIPES.length - 1; i >= 0; i -= 1) {
    const recipe = ITEM_RECIPES[i];
    const ids = [recipe.output, ...recipe.inputs.map((input) => input.itemId)];
    if (ids.some((id) => !isItemInPool120(id))) {
      ITEM_RECIPES.splice(i, 1);
    }
  }
}

pruneCraftRecipesOutsidePool();

function syncCraftOutputIdSet() {
  if (typeof CRAFT_OUTPUT_IDS === "undefined") return;
  CRAFT_OUTPUT_IDS.clear();
  ITEM_RECIPES.forEach((recipe) => {
    if (recipe?.output) CRAFT_OUTPUT_IDS.add(recipe.output);
  });
}

rebuildCraftRecipeIndex();
syncCraftOutputIdSet();

function recipeInputTotal(recipe) {
  return recipe.inputs.reduce((sum, input) => sum + input.count, 0);
}

function countItemsById(items) {
  const counts = new Map();
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

function getStrongCraftComponents(items) {
  const pool = items.filter((item) => !ITEM_CATALOG[item.itemId]?.isContainer);
  const visited = new Set();
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
  const candidates = [{ col: preferCol, row: preferRow }];
  items.forEach((item) => {
    getItemCells(item).forEach(([c, r]) => candidates.push({ col: c, row: r }));
  });

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
        null,
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
    recipe,
  };
}

/**
 * Пытается применить все подходящие рецепты на поле.
 * @returns {{ items: object[], crafted: object[] }}
 */
function tryResolveCrafting(containers, items, ctx = null) {
  const craftCtx = ctx || (typeof getCraftContextFromGame === "function"
    ? getCraftContextFromGame(typeof prepViewSide !== "undefined" ? prepViewSide : "player")
    : {});
  const crafted = [];
  let nextItems = items;
  let changed = true;

  while (changed) {
    changed = false;
    const components = getStrongCraftComponents(nextItems);

    for (const recipe of ITEM_RECIPES) {
      if (typeof isCraftRecipeAvailable === "function" && !isCraftRecipeAvailable(recipe, craftCtx)) {
        continue;
      }
      let applied = null;
      for (const cluster of components) {
        if (!recipeMatchesCluster(cluster, recipe)) continue;
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

function getRecipesUsingIngredient(itemId) {
  return RECIPES_BY_INGREDIENT.get(itemId) || [];
}

function getRecipeForOutput(itemId) {
  return RECIPES_BY_OUTPUT.get(itemId) || null;
}

function formatRecipeInputs(recipe) {
  const parts = [];
  recipe.inputs.forEach((input) => {
    const def = ITEM_CATALOG[input.itemId];
    const label = def ? `${def.icon} ${def.name}` : input.itemId;
    parts.push(input.count > 1 ? `${input.count}× ${label}` : label);
  });
  return parts.join(" + ");
}

function getCraftTooltipLines(itemId) {
  const lines = [];
  const asOutput = getRecipeForOutput(itemId);
  if (asOutput) {
    const ctx = typeof getCraftContextFromGame === "function" ? getCraftContextFromGame() : {};
    const available = typeof isCraftRecipeAvailable !== "function" || isCraftRecipeAvailable(asOutput, ctx);
    const hint = asOutput.hint && !available ? ` (${asOutput.hint})` : "";
    lines.push({
      text: `⚗️ Крафт: ${formatRecipeInputs(asOutput)}${hint}`,
      style: "normal",
      color: available ? "#d2a8ff" : "#8b949e",
    });
  }

  getRecipesUsingIngredient(itemId).forEach((recipe) => {
    const out = ITEM_CATALOG[recipe.output];
    if (!out) return;
    const ctx = typeof getCraftContextFromGame === "function" ? getCraftContextFromGame() : {};
    const available = typeof isCraftRecipeAvailable !== "function" || isCraftRecipeAvailable(recipe, ctx);
    if (!available) return;
    lines.push({
      text: `⚗️ Рядом: ${formatRecipeInputs(recipe)} → ${out.icon} ${out.name}`,
      style: "normal",
      color: "#bc8cff",
    });
  });

  return lines;
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

function getCraftIngredientItemIds() {
  const ids = new Set();
  ITEM_RECIPES.forEach((recipe) => {
    recipe.inputs.forEach((input) => ids.add(input.itemId));
  });
  return [...ids];
}
