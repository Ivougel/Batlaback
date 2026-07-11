/**
 * Крафт: ингредиенты рецепта должны касаться друг друга (ребро к ребру),
 * но не обязаны быть изолированы от остальных предметов на поле.
 */
import type { CraftRecipe } from "../types/game";

type BoardItem = { uid: string; itemId: string; col: number; row: number };
type CatalogDef = { id?: string; icon?: string; name?: string; isContainer?: boolean };
type CraftTooltipLine = { text?: string; html?: string; style?: string; color?: string };
type CraftRecipePart = { type: "op"; text: string } | { type: "chip"; itemId: string; count?: number };
type CraftContext = { playerClass?: string; classId?: string };

declare const BB_REFERENCE_RECIPES: CraftRecipe[] | undefined;

const FALLBACK_RECIPES: CraftRecipe[] = [
  {
    id: "hero_sword",
    inputs: [
      { itemId: "rusty_sword", count: 1 },
      { itemId: "whetstone", count: 2 },
    ],
    output: "hero_sword",
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
    id: "shovel",
    inputs: [
      { itemId: "broom", count: 1 },
      { itemId: "pan", count: 1 },
    ],
    output: "shovel",
  },
];

function initCraftRecipes(): CraftRecipe[] {
  const ref = typeof BB_REFERENCE_RECIPES !== "undefined" ? BB_REFERENCE_RECIPES : null;
  if (ref?.length) return ref.slice() as CraftRecipe[];
  return FALLBACK_RECIPES.slice();
}

const ITEM_RECIPES: CraftRecipe[] = initCraftRecipes();

const RECIPES_BY_INGREDIENT = new Map<string, CraftRecipe[]>();
const RECIPES_BY_OUTPUT = new Map<string, CraftRecipe>();

function rebuildCraftRecipeIndex() {
  RECIPES_BY_INGREDIENT.clear();
  RECIPES_BY_OUTPUT.clear();
  ITEM_RECIPES.forEach((recipe) => {
    RECIPES_BY_OUTPUT.set(recipe.output, recipe);
    recipe.inputs.forEach((input) => {
      if (!RECIPES_BY_INGREDIENT.has(input.itemId)) {
        RECIPES_BY_INGREDIENT.set(input.itemId, []);
      }
      RECIPES_BY_INGREDIENT.get(input.itemId)!.push(recipe);
    });
  });
}


function pruneCraftRecipesOutsidePool() {
  if (typeof shouldFilterToPool120 === "function" && shouldFilterToPool120()) {
    if (typeof isItemInPool120 !== "function") return;
    for (let i = ITEM_RECIPES.length - 1; i >= 0; i -= 1) {
      const recipe = ITEM_RECIPES[i];
      const ids = [recipe.output, ...recipe.inputs.map((input) => input.itemId)];
      if (ids.some((id) => !isItemInPool120(id))) {
        ITEM_RECIPES.splice(i, 1);
      }
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

function recipeInputTotal(recipe: CraftRecipe): number {
  return recipe.inputs.reduce((sum, input) => sum + input.count, 0);
}

function countItemsById(items: BoardItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    counts.set(item.itemId, (counts.get(item.itemId) || 0) + 1);
  });
  return counts;
}

function recipeMatchesCluster(clusterItems: BoardItem[], recipe: CraftRecipe): boolean {
  const counts = countItemsById(clusterItems);
  if (clusterItems.length !== recipeInputTotal(recipe)) return false;
  return recipe.inputs.every((input) => (counts.get(input.itemId) || 0) === input.count);
}

function chooseK<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const out: T[][] = [];
  const walk = (start: number, picked: T[]) => {
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

function isCraftClusterConnected(clusterItems: BoardItem[], pool: BoardItem[]): boolean {
  if (clusterItems.length <= 1) return true;
  const uidSet = new Set(clusterItems.map((item) => item.uid));
  const visited = new Set<string>([clusterItems[0].uid]);
  const queue: BoardItem[] = [clusterItems[0]];

  while (queue.length) {
    const current = queue.shift()!;
    getAdjacentItems(pool, current).forEach((entry, uid) => {
      if (!entry.strong || !uidSet.has(uid) || visited.has(uid)) return;
      visited.add(uid);
      queue.push(entry.item as BoardItem);
    });
  }

  return visited.size === clusterItems.length;
}

/** Все связные поднаборы поля, удовлетворяющие рецепту (ингредиенты касаются друг друга, но не обязаны быть изолированы от остальных). */
function enumerateRecipeClusters(items: BoardItem[], recipe: CraftRecipe): BoardItem[][] {
  const pool = items.filter((item) => !ITEM_CATALOG[item.itemId]?.isContainer);
  const pickGroups: BoardItem[][][] = [];

  for (const input of recipe.inputs) {
    const matches = pool.filter((item) => item.itemId === input.itemId);
    if (matches.length < input.count) return [];
    pickGroups.push(chooseK(matches, input.count));
  }

  const results: BoardItem[][] = [];
  const seen = new Set<string>();

  const cartesian = (groupIndex: number, acc: BoardItem[]) => {
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

function hasMatchingRecipeCluster(items: BoardItem[], recipe: CraftRecipe): boolean {
  return enumerateRecipeClusters(items, recipe).length > 0;
}

function getStrongCraftComponents(items: BoardItem[]): BoardItem[][] {
  const pool = items.filter((item) => !ITEM_CATALOG[item.itemId]?.isContainer);
  const visited = new Set<string>();
  const components: BoardItem[][] = [];

  pool.forEach((seed) => {
    if (visited.has(seed.uid)) return;
    const component: BoardItem[] = [];
    const queue: BoardItem[] = [seed];
    visited.add(seed.uid);

    while (queue.length) {
      const current = queue.shift()!;
      component.push(current);
      getAdjacentItems(pool, current).forEach((entry, uid) => {
        if (!entry.strong || visited.has(uid)) return;
        visited.add(uid);
        queue.push(entry.item as BoardItem);
      });
    }

    components.push(component);
  });

  return components;
}

function getClusterAnchor(items: BoardItem[]): { col: number; row: number } {
  let col = Infinity;
  let row = Infinity;
  items.forEach((item) => {
    col = Math.min(col, item.col);
    row = Math.min(row, item.row);
  });
  return { col: Number.isFinite(col) ? col : 0, row: Number.isFinite(row) ? row : 0 };
}

function findCraftPlacement(
  containers: object[],
  items: BoardItem[],
  outputId: string,
  preferCol: number,
  preferRow: number,
) {
  const candidates = [{ col: preferCol, row: preferRow }];
  items.forEach((item) => {
    getItemCells(item).forEach(([c, r]: [number, number]) => candidates.push({ col: c, row: r }));
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

function applyRecipe(
  containers: object[],
  items: BoardItem[],
  recipe: CraftRecipe,
  clusterItems: BoardItem[],
) {
  const removeUids = new Set(clusterItems.map((item) => item.uid));
  const remaining = items.filter((item) => !removeUids.has(item.uid));
  const anchor = getClusterAnchor(clusterItems);
  const placement = findCraftPlacement(containers, remaining, recipe.output, anchor.col, anchor.row);
  if (!placement) return null;

  const placed = createPlacedItem(recipe.output, placement.col, placement.row, placement.rotation) as BoardItem;
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
function tryResolveCrafting(containers: object[], items: BoardItem[], ctx: object | null = null) {
  const craftCtx = ctx || (typeof getCraftContextFromGame === "function"
    ? getCraftContextFromGame(typeof prepViewSide !== "undefined" ? prepViewSide : "player")
    : {});
  const crafted: CraftRecipe[] = [];
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

function canApplyCraftRecipe(
  containers: object[],
  items: BoardItem[],
  recipe: CraftRecipe,
  clusterItems: BoardItem[],
): boolean {
  const removeUids = new Set(clusterItems.map((item) => item.uid));
  const remaining = items.filter((item) => !removeUids.has(item.uid));
  const anchor = getClusterAnchor(clusterItems);
  return !!findCraftPlacement(containers, remaining, recipe.output, anchor.col, anchor.row);
}

/**
 * Все валидные кластеры на поле (без пересечения предметов между рецептами).
 * @returns {{ recipe: object, clusterItems: object[], anchor: { col: number, row: number } }[]}
 */
function detectMatchingCraftClusters(containers: object[], items: BoardItem[], ctx: object | null = null) {
  const craftCtx = ctx || (typeof getCraftContextFromGame === "function"
    ? getCraftContextFromGame(typeof prepViewSide !== "undefined" ? prepViewSide : "player")
    : {});
  const usedUids = new Set<string>();
  const results: Array<{ recipe: CraftRecipe; clusterItems: BoardItem[]; anchor: { col: number; row: number } }> = [];
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
        if (!canApplyCraftRecipe(containers, pool, recipe, cluster)) continue;

        cluster.forEach((item) => usedUids.add(item.uid));
        results.push({
          recipe,
          clusterItems: cluster,
          anchor: getClusterAnchor(cluster),
        });
        found = true;
        break;
      }
      if (found) break;
    }
  }

  return results;
}

function getRecipesUsingIngredient(itemId: string): CraftRecipe[] {
  return RECIPES_BY_INGREDIENT.get(itemId) || [];
}

function getRecipeForOutput(itemId: string): CraftRecipe | null {
  return RECIPES_BY_OUTPUT.get(itemId) || null;
}

function escapeCraftTooltipHtml(text: unknown): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function getCraftItemIcon(itemId: string): string {
  const def = ITEM_CATALOG[itemId] as CatalogDef | undefined;
  if (!def) return "◻️";
  if (typeof getItemIcons === "function") return getItemIcons(def)[0] || def.icon || "◻️";
  return def.icon || "◻️";
}

function getCraftItemName(itemId: string): string {
  const def = ITEM_CATALOG[itemId] as CatalogDef | undefined;
  if (!def) return itemId;
  return typeof getItemDisplayName === "function" ? getItemDisplayName(def) : (def.name ?? itemId);
}

function renderCraftRecipeChipHtml(itemId: string, count = 1): string {
  const icon = getCraftItemIcon(itemId);
  const name = getCraftItemName(itemId);
  const countHtml = count > 1
    ? `<span class="craft-recipe-chip__count">${count}×</span>`
    : "";
  return `<span class="craft-recipe-chip" data-item-id="${escapeCraftTooltipHtml(itemId)}" data-name="${escapeCraftTooltipHtml(name)}" tabindex="0" role="img" aria-label="${escapeCraftTooltipHtml(name)}">${countHtml}<span class="craft-recipe-chip__icon" aria-hidden="true">${icon}</span><span class="craft-recipe-chip__tip" aria-hidden="true">${escapeCraftTooltipHtml(name)}</span></span>`;
}

function buildCraftRecipeParts(recipe: CraftRecipe): CraftRecipePart[] {
  const parts: CraftRecipePart[] = [];
  recipe.inputs.forEach((input, index) => {
    if (index > 0) parts.push({ type: "op", text: "+" });
    parts.push({ type: "chip", itemId: input.itemId, count: input.count });
  });
  parts.push({ type: "op", text: "=" });
  parts.push({ type: "chip", itemId: recipe.output, count: 1 });
  return parts;
}

function renderCraftRecipeLineHtml(parts: CraftRecipePart[]): string {
  const inner = parts.map((part) => {
    if (part.type === "op") {
      return `<span class="craft-recipe-op" aria-hidden="true">${part.text}</span>`;
    }
    return renderCraftRecipeChipHtml(part.itemId, part.count || 1);
  }).join("");
  return `<div class="craft-recipe-line">${inner}</div>`;
}

function formatRecipeInputs(recipe: CraftRecipe): string {
  const parts: string[] = [];
  recipe.inputs.forEach((input) => {
    const def = ITEM_CATALOG[input.itemId];
    const label = def ? `${def.icon} ${def.name}` : input.itemId;
    parts.push(input.count > 1 ? `${input.count}× ${label}` : label);
  });
  return parts.join(" + ");
}

function getCraftTooltipLines(itemId: string, side: string | null = null): CraftTooltipLine[] {
  const lines: CraftTooltipLine[] = [];
  const craftCtx = typeof getCraftContextFromGame === "function"
    ? getCraftContextFromGame(side || (typeof prepViewSide !== "undefined" ? prepViewSide : "player"))
    : {};
  const comboLines: CraftTooltipLine[] = [];

  const asOutput = getRecipeForOutput(itemId);
  if (asOutput) {
    const available = typeof isCraftRecipeAvailable !== "function" || isCraftRecipeAvailable(asOutput, craftCtx);
    if (available) {
      comboLines.push({
        html: renderCraftRecipeLineHtml(buildCraftRecipeParts(asOutput)),
        style: "craft-recipe",
        color: "#d2a8ff",
      });
    } else if (asOutput.hint) {
      comboLines.push({
        text: `Недоступно (${asOutput.hint})`,
        color: "#8b949e",
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
      color: "#bc8cff",
    });
  });

  if (!comboLines.length) return lines;

  lines.push({ text: "⚗️ Крафт", style: "label", color: "#bc8cff" });
  comboLines.forEach((entry) => {
    if (entry.html) {
      lines.push({ html: entry.html, style: entry.style || "craft-recipe", color: entry.color });
    } else {
      lines.push({ text: entry.text, style: "normal", color: entry.color });
    }
  });
  lines.push({
    text: "Сложите вплотную на поле — слияние в начале следующего раунда",
    style: "normal",
    color: "#8b949e",
  });

  return lines;
}

function isCraftIngredient(itemId: string): boolean {
  return RECIPES_BY_INGREDIENT.has(itemId);
}

function getAllCraftRecipes(): CraftRecipe[] {
  return ITEM_RECIPES;
}

function getCraftOutputItemIds(): string[] {
  return ITEM_RECIPES.map((recipe) => recipe.output);
}

function getCraftContextHeroClass(ctx: CraftContext | null = null): string | null {
  if (ctx?.playerClass) return ctx.playerClass;
  if (ctx?.classId) return ctx.classId;
  if (typeof pendingPlayerClass !== "undefined" && pendingPlayerClass) return pendingPlayerClass;
  if (typeof playerClass !== "undefined" && playerClass) return playerClass;
  return null;
}

function isCraftRecipeAvailable(recipe: CraftRecipe, ctx: CraftContext | null = null): boolean {
  if (!recipe) return false;
  if (typeof isClassicMode === "function" && isClassicMode()) return true;
  if (typeof MetaProgress === "undefined" || !MetaProgress.isActiveForRun()) return true;
  const heroClass = getCraftContextHeroClass(ctx);
  return recipe.inputs.every((input) => MetaProgress.isItemUnlocked(input.itemId, heroClass ?? ""));
}

function getVisibleCraftRecipes(ctx: CraftContext | null = null): CraftRecipe[] {
  return ITEM_RECIPES.filter((recipe) => isCraftRecipeAvailable(recipe, ctx));
}

function getCraftIngredientItemIds(): string[] {
  const ids = new Set<string>();
  ITEM_RECIPES.forEach((recipe) => {
    recipe.inputs.forEach((input) => ids.add(input.itemId));
  });
  return [...ids];
}
