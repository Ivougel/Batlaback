/**
 * Подсветка партнёров крафта при перетаскивании из магазина + маркеры pending на поле.
 */

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

let craftPartnerBenchIndices = [];

function drawCraftCellHighlight(ctx, team, col, row, style, pulse, strong = false) {
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

function getCraftPartnerTargets(shopItemId, containers, items, bench, ctx = null) {
  if (!shopItemId || typeof getRecipesUsingIngredient !== "function") {
    return { boardUids: [], benchIndices: [] };
  }

  const craftCtx = ctx || (typeof getCraftContextFromGame === "function" ? getCraftContextFromGame() : {});
  const recipes = getRecipesUsingIngredient(shopItemId).filter((recipe) => {
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
    boardUids: [...boardUids],
    benchIndices: [...benchIndices],
  };
}

function syncCraftPartnerBenchDom(benchIndices = []) {
  craftPartnerBenchIndices = [...benchIndices];
  const slots = document.getElementById("bench-slots");
  if (!slots) return;
  const cards = slots.querySelectorAll(".bench-card");
  cards.forEach((card, index) => {
    card.classList.toggle("craft-partner-glow", benchIndices.includes(index));
  });
}

function clearCraftPartnerBenchDom() {
  syncCraftPartnerBenchDom([]);
}

function drawPrepCraftHighlights(ctx, time, side, items, bench, dragContext = null) {
  if (typeof phase !== "undefined" && phase !== "prep") return false;
  if (!dragContext?.shopItemId) return false;

  const targets = getCraftPartnerTargets(
    dragContext.shopItemId,
    dragContext.containers,
    items,
    bench,
    dragContext.ctx,
  );
  if (!targets.boardUids.length) return false;

  const pulse = 0.5 + Math.sin((time || 0) * 3.1) * 0.5;
  const uidSet = new Set(targets.boardUids);
  let drew = false;

  items.forEach((item) => {
    if (!uidSet.has(item.uid)) return;
    drew = true;
    getItemCells(item).forEach(([col, row]) => {
      drawCraftCellHighlight(ctx, side, col, row, CRAFT_PREVIEW_COLORS, pulse, true);
    });
  });

  return drew;
}

function drawPrepPendingCraftHighlights(ctx, time, side, items) {
  if (typeof phase !== "undefined" && phase !== "prep") return false;
  if (typeof getPendingCraftBoardUids !== "function") return false;

  const pendingUids = getPendingCraftBoardUids(side);
  if (!pendingUids.size) return false;

  const pulse = 0.5 + Math.sin((time || 0) * 2.4) * 0.5;
  let drew = false;

  items.forEach((item) => {
    if (!pendingUids.has(item.uid)) return;
    drew = true;
    getItemCells(item).forEach(([col, row]) => {
      drawCraftCellHighlight(ctx, side, col, row, CRAFT_PENDING_COLORS, pulse, false);
    });
  });

  return drew;
}

function syncCraftPreviewFromDrag() {
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
    st.items,
    st.bench,
    ctx,
  );
  syncCraftPartnerBenchDom(targets.benchIndices);
}
