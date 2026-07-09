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
  stroke: "rgba(255, 210, 120, 0.78)",
  fill: "rgba(255, 190, 80, 0.12)",
  glow: "#ffd27a",
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

function getCraftPartnerTargets(
  shopItemId: string,
  containers: object[],
  items: Array<{ uid: string; itemId: string }>,
  bench: Array<{ itemId?: string }> | null | undefined,
  ctx: object | null = null,
): { boardUids: string[]; benchIndices: number[] } {
  if (!shopItemId || typeof getRecipesUsingIngredient !== "function") {
    return { boardUids: [], benchIndices: [] };
  }

  const craftCtx = ctx || (typeof getCraftContextFromGame === "function" ? getCraftContextFromGame() : {});
  const recipes = getRecipesUsingIngredient(shopItemId).filter((recipe: CraftRecipe) => {
    if (typeof isCraftRecipeAvailable === "function" && !isCraftRecipeAvailable(recipe, craftCtx)) {
      return false;
    }
    return recipe.inputs.some((input) => input.itemId === shopItemId);
  });

  const boardUids = new Set();
  const benchIndices = new Set();

  recipes.forEach((recipe) => {
    recipe.inputs.forEach((input) => {
      if (input.itemId === shopItemId) return;
      items.forEach((item) => {
        if (item.itemId === input.itemId) boardUids.add(item.uid);
      });
      (bench || []).forEach((entry, index) => {
        if (entry?.itemId === input.itemId) benchIndices.add(index);
      });
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

function drawPrepCraftHighlights(
  ctx: CanvasRenderingContext2D,
  time: number,
  side: string,
  items: Array<{ uid: string; itemId: string }>,
  bench: object[],
  dragContext: { shopItemId?: string; containers?: object[]; ctx?: object } | null = null,
): boolean {
  if (typeof phase !== "undefined" && phase !== "prep") return false;
  if (!dragContext?.shopItemId) return false;

  const targets = getCraftPartnerTargets(
    dragContext.shopItemId,
    dragContext.containers ?? [],
    items,
    bench,
    dragContext.ctx ?? null,
  );
  if (!targets.boardUids.length) return false;

  const pulse = 0.5 + Math.sin((time || 0) * 3.1) * 0.5;
  const uidSet = new Set(targets.boardUids);
  let drew = false;

  items.forEach((item) => {
    if (!uidSet.has(item.uid)) return;
    drew = true;
    getItemCells(item).forEach(([col, row]: [number, number]) => {
      drawCraftCellHighlight(ctx, side, col, row, CRAFT_PREVIEW_COLORS, pulse, true);
    });
  });

  return drew;
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

  const pulse = 0.5 + Math.sin((time || 0) * 2.4) * 0.5;
  let drew = false;

  items.forEach((item) => {
    if (!pendingUids.has(item.uid)) return;
    drew = true;
    getItemCells(item).forEach(([col, row]: [number, number]) => {
      drawCraftCellHighlight(ctx, side, col, row, CRAFT_PENDING_COLORS, pulse, false);
    });
  });

  return drew;
}

function syncCraftPreviewFromDrag(): void {
  if (typeof dragPayload === "undefined" || typeof dragFrom === "undefined") return;
  if (!dragPayload || dragFrom?.type !== "shop") {
    clearCraftPartnerBenchDom();
    return;
  }

  const side = dragFrom.side || (typeof prepViewSide !== "undefined" ? prepViewSide : "player");
  const st = getSideState(side);
  const ctx = typeof getCraftContextFromGame === "function" ? getCraftContextFromGame(side) : {};
  const targets = getCraftPartnerTargets(
    dragPayload.itemId,
    st.containers,
    st.items as Array<{ uid: string; itemId: string }>,
    st.bench,
    ctx,
  );
  syncCraftPartnerBenchDom(targets.benchIndices);
}
