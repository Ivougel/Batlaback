/**
 * Подсветка партнёров крафта при перетаскивании из магазина + маркеры pending на поле.
 */
import type { CraftRecipe } from "../types/game";

const CRAFT_PREVIEW_COLORS = {
  stroke: "rgba(188, 140, 255, 0.82)",
  fill: "rgba(140, 90, 220, 0.16)",
  glow: "#bc8cff",
};

const CRAFT_PENDING_COLORS = {
  stroke: "rgba(255, 228, 150, 0.95)",
  fill: "rgba(255, 200, 90, 0.22)",
  glow: "#ffe08a",
  linkHalo: "rgba(210, 150, 255, 0.72)",
  linkCore: "rgba(255, 230, 160, 0.92)",
};

let craftPartnerBenchIndices: number[] = [];

function drawCraftCellHighlight(
  ctx: CanvasRenderingContext2D,
  team: string,
  col: number,
  row: number,
  style: { fill: string; stroke: string; glow: string },
  pulse: number,
  strong = false,
): void {
  if (typeof cellRect !== "function") return;
  const rect = cellRect(team, col, row);
  ctx.save();
  ctx.fillStyle = style.fill;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = strong ? 2.8 : 2.2;
  ctx.shadowColor = style.glow;
  ctx.shadowBlur = 8 + pulse * 10;
  ctx.globalAlpha = 0.62 + pulse * 0.28;
  if (typeof roundRect === "function") {
    roundRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, 5);
    ctx.fill();
    ctx.globalAlpha = 0.72 + pulse * 0.2;
    ctx.stroke();
  }
  ctx.restore();
}

function recipeInputsSatisfied(
  recipe: CraftRecipe,
  itemId: string,
  items: Array<{ itemId: string }>,
  bench: Array<{ itemId?: string }> | null | undefined,
  opts: { boardOnly?: boolean } = {},
): boolean {
  const boardItems = items || [];
  const benchItems = bench || [];
  return recipe.inputs.every((input) => {
    if (input.itemId === itemId) return true;
    if (opts.boardOnly) {
      return boardItems.some((entry) => entry.itemId === input.itemId);
    }
    const onBoard = boardItems.some((entry) => entry.itemId === input.itemId);
    const onBench = benchItems.some((entry) => entry?.itemId === input.itemId);
    return onBoard || onBench;
  });
}

function getCraftPartnerTargets(
  shopItemId: string,
  containers: object[],
  items: Array<{ uid: string; itemId: string }>,
  bench: Array<{ itemId?: string }> | null | undefined,
  ctx: object | null = null,
  opts: { boardOnly?: boolean } | null = null,
): { boardUids: string[]; benchIndices: number[] } {
  if (!shopItemId || typeof getRecipesUsingIngredient !== "function") {
    return { boardUids: [], benchIndices: [] };
  }

  const craftCtx = ctx || (typeof getCraftContextFromGame === "function" ? getCraftContextFromGame() : {});
  const boardOnly = opts?.boardOnly === true;
  const recipes = getRecipesUsingIngredient(shopItemId).filter((recipe: CraftRecipe) => {
    if (typeof isCraftRecipeAvailable === "function" && !isCraftRecipeAvailable(recipe, craftCtx)) {
      return false;
    }
    if (!recipe.inputs.some((input) => input.itemId === shopItemId)) return false;
    return recipeInputsSatisfied(recipe, shopItemId, items, bench, { boardOnly });
  });

  const boardUids = new Set<string>();
  const benchIndices = new Set<number>();

  recipes.forEach((recipe) => {
    recipe.inputs.forEach((input) => {
      if (input.itemId === shopItemId) return;
      items.forEach((item) => {
        if (item.itemId === input.itemId) boardUids.add(item.uid);
      });
      if (!boardOnly) {
        (bench || []).forEach((entry, index) => {
          if (entry?.itemId === input.itemId) benchIndices.add(index);
        });
      }
    });
  });

  return {
    boardUids: [...boardUids] as string[],
    benchIndices: [...benchIndices] as number[],
  };
}

function syncCraftPartnerBenchDom(benchIndices: number[] = []): void {
  craftPartnerBenchIndices = [...benchIndices];
  const slots = document.getElementById("bench-slots");
  if (!slots) return;
  const cards = slots.querySelectorAll(".bench-card");
  cards.forEach((card, index) => {
    card.classList.toggle("craft-partner-glow", benchIndices.includes(index));
  });
}

function clearCraftPartnerBenchDom(): void {
  syncCraftPartnerBenchDom([]);
}

function drawCraftLinkArc(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  pulse: number,
  time = 0,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const span = Math.hypot(dx, dy) || 1;
  const lift = Math.min(span * 0.2, 56);
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2 - lift;

  ctx.save();
  ctx.strokeStyle = CRAFT_PENDING_COLORS.linkHalo;
  ctx.lineWidth = 8 + pulse * 5;
  ctx.shadowColor = CRAFT_PENDING_COLORS.glow;
  ctx.shadowBlur = 18 + pulse * 16;
  ctx.globalAlpha = 0.42 + pulse * 0.22;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(midX, midY, to.x, to.y);
  ctx.stroke();

  ctx.globalAlpha = 0.82 + pulse * 0.14;
  ctx.strokeStyle = CRAFT_PENDING_COLORS.linkCore;
  ctx.lineWidth = 2.8 + pulse * 1.1;
  ctx.shadowBlur = 10 + pulse * 8;
  ctx.setLineDash([8, 6]);
  ctx.lineDashOffset = -((time || 0) * 42);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(midX, midY, to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function drawPrepPendingCraftClusterLinks(
  ctx: CanvasRenderingContext2D,
  time: number,
  side: string,
  items: Array<{ uid: string }>,
): boolean {
  if (typeof getPendingCraftsForSide !== "function") return false;

  const pending = getPendingCraftsForSide(side);
  if (!pending.length) return false;

  const pulse = 0.5 + Math.sin((time || 0) * 2.8) * 0.5;
  const uidToItem = new Map(items.map((item) => [item.uid, item]));
  let drew = false;

  pending.forEach((entry) => {
    const clusterItems = entry.itemUids
      .map((uid) => uidToItem.get(uid))
      .filter(Boolean) as Array<{ uid: string }>;
    if (clusterItems.length < 2) return;

    for (let i = 0; i < clusterItems.length; i += 1) {
      for (let j = i + 1; j < clusterItems.length; j += 1) {
        if (typeof getItemVisualCenter !== "function") continue;
        const from = getItemVisualCenter(clusterItems[i], side);
        const to = getItemVisualCenter(clusterItems[j], side);
        if (!from || !to) continue;
        drawCraftLinkArc(ctx, from, to, pulse, time);
        drew = true;
      }
    }
  });

  return drew;
}

function drawPrepCraftHighlights(
  ctx: CanvasRenderingContext2D,
  time: number,
  side: string,
  items: Array<{ uid: string; itemId: string }>,
  bench: object[],
  dragContext: { shopItemId?: string; containers?: object[]; ctx?: object; boardOnly?: boolean } | null = null,
): boolean {
  if (typeof phase !== "undefined" && phase !== "prep") return false;
  if (!dragContext?.shopItemId) return false;

  const targets = getCraftPartnerTargets(
    dragContext.shopItemId,
    dragContext.containers ?? [],
    items,
    bench,
    dragContext.ctx ?? null,
    { boardOnly: dragContext.boardOnly === true },
  );
  if (!targets.boardUids.length) return false;
  return true;
}

function drawPrepPendingCraftHighlights(
  ctx: CanvasRenderingContext2D,
  time: number,
  side: string,
  items: Array<{ uid: string }>,
): boolean {
  if (typeof phase !== "undefined" && phase !== "prep") return false;
  if (typeof getPendingCraftBoardUids !== "function") return false;

  const pendingUids = getPendingCraftBoardUids(side);
  if (!pendingUids.size) return false;

  return drawPrepPendingCraftClusterLinks(ctx, time, side, items);
}

function syncCraftPreviewFromDrag(): void {
  if (typeof dragPayload === "undefined" || typeof dragFrom === "undefined") return;
  if (!dragPayload?.itemId) {
    clearCraftPartnerBenchDom();
    return;
  }

  const dragTypes = new Set(["shop", "bench", "item"]);
  if (!dragFrom || !dragTypes.has(dragFrom.type)) {
    clearCraftPartnerBenchDom();
    return;
  }

  const side = dragFrom.side || (typeof prepViewSide !== "undefined" ? prepViewSide : "player");
  const st = getSideState(side);
  const ctx = typeof getCraftContextFromGame === "function" ? getCraftContextFromGame(side) : {};
  const boardOnly = dragFrom.type === "shop";
  const targets = getCraftPartnerTargets(
    dragPayload.itemId,
    st.containers ?? [],
    st.items as Array<{ uid: string; itemId: string }>,
    st.bench,
    ctx,
    { boardOnly },
  );
  syncCraftPartnerBenchDom(targets.benchIndices);
}

declare global {
  interface Window {
    getCraftPartnerTargets: typeof getCraftPartnerTargets;
    syncCraftPreviewFromDrag: typeof syncCraftPreviewFromDrag;
    clearCraftPartnerBenchDom: typeof clearCraftPartnerBenchDom;
  }
}

if (typeof window !== "undefined") {
  window.getCraftPartnerTargets = getCraftPartnerTargets;
  window.syncCraftPreviewFromDrag = syncCraftPreviewFromDrag;
  window.clearCraftPartnerBenchDom = clearCraftPartnerBenchDom;
}
