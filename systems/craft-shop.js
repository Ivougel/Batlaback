/**
 * Подсказки крафта для магазина / скамейки и цели SVG-нитей.
 */

function shouldShowPrepCraftCommerceFx() {
  if (typeof phase !== "undefined" && phase !== "prep") return false;
  return (typeof isBBFidelityMode === "function" && isBBFidelityMode())
    || (typeof isClassicMode === "function" && isClassicMode())
    || (typeof gameMode !== "undefined" && (gameMode === "versus" || gameMode === "hotseat"));
}

/**
 * @returns {{ strength: 'strong'|'weak', partnerCount: number, recipeCount: number, boardUids: string[], benchIndices: number[] } | null}
 */
function getShopCraftHint(itemId, containers, items, bench, ctx = null) {
  if (!itemId) return null;

  if (typeof getCraftPartnerTargets === "function") {
    const targets = getCraftPartnerTargets(
      itemId,
      containers,
      items,
      bench,
      ctx,
      { boardOnly: true },
    );
    if (!targets.boardUids.length) return null;
    return {
      strength: targets.boardUids.length > 1 ? "strong" : "weak",
      partnerCount: targets.boardUids.length,
      recipeCount: 1,
      boardUids: targets.boardUids,
      benchIndices: [],
    };
  }

  if (typeof getRecipesUsingIngredient !== "function") return null;
  const craftCtx = ctx || {};
  const boardItems = items || [];

  const recipes = getRecipesUsingIngredient(itemId).filter((recipe) => {
    if (typeof isCraftRecipeAvailable === "function" && !isCraftRecipeAvailable(recipe, craftCtx)) {
      return false;
    }
    return recipe.inputs.every((input) => {
      if (input.itemId === itemId) return true;
      return boardItems.some((entry) => entry.itemId === input.itemId);
    });
  });
  if (!recipes.length) return null;

  const boardUids = /* @__PURE__ */ new Set();
  recipes.forEach((recipe) => {
    recipe.inputs.forEach((input) => {
      if (input.itemId === itemId) return;
      boardItems.forEach((item) => {
        if (item.itemId === input.itemId) boardUids.add(item.uid);
      });
    });
  });
  if (!boardUids.size) return null;

  return {
    strength: boardUids.size > 1 || recipes.length > 1 ? "strong" : "weak",
    partnerCount: boardUids.size,
    recipeCount: recipes.length,
    boardUids: [...boardUids],
    benchIndices: [],
  };
}

function getCraftCommerceTetherTargetsForItem(itemId, containers, items, bench, team, ctx = null, exclude = {}) {
  const hint = typeof getShopCraftHint === "function"
    ? getShopCraftHint(itemId, containers, items, bench, ctx)
    : null;
  if (!hint?.boardUids?.length) return [];

  const strength = hint.strength;
  const out = [];

  hint.boardUids.forEach((uid) => {
    if (uid === exclude.excludeUid) return;
    const item = (items || []).find((entry) => entry.uid === uid);
    if (!item) return;
    const pt = typeof getBoardItemClientCenter === "function"
      ? getBoardItemClientCenter(item, team)
      : null;
    if (!pt) return;
    out.push({ ...pt, strength, uid, kind: "board" });
  });

  return out;
}

function getShopCraftTetherTargetsForItem(itemId, containers, items, bench, team, ctx = null) {
  const hint = getShopCraftHint(itemId, containers, items, bench, ctx);
  if (!hint) return [];

  return hint.boardUids
    .map((uid) => {
      const item = (items || []).find((entry) => entry.uid === uid);
      if (!item) return null;
      const pt = typeof getBoardItemClientCenter === "function"
        ? getBoardItemClientCenter(item, team)
        : null;
      if (!pt) return null;
      return { ...pt, strength: hint.strength, uid, kind: "board" };
    })
    .filter(Boolean);
}

function getShopCraftExtraClasses(itemId, containers, items, bench, sideOrCtx = null) {
  if (!shouldShowPrepCraftCommerceFx()) return "";
  const ctx = typeof sideOrCtx === "string"
    ? (typeof getCraftContextFromGame === "function" ? getCraftContextFromGame(sideOrCtx) : null)
    : sideOrCtx;
  const hint = getShopCraftHint(itemId, containers, items, bench, ctx);
  if (!hint) return "";
  return hint.strength === "strong" ? "shop-card--craft-strong" : "shop-card--craft";
}

function getBenchCraftExtraClasses(itemId, containers, items, bench, sideOrCtx = null) {
  if (!shouldShowPrepCraftCommerceFx()) return "";
  const ctx = typeof sideOrCtx === "string"
    ? (typeof getCraftContextFromGame === "function" ? getCraftContextFromGame(sideOrCtx) : null)
    : sideOrCtx;
  const hint = getShopCraftHint(itemId, containers, items, bench, ctx);
  if (!hint) return "";
  return hint.strength === "strong" ? "bench-card--craft-strong" : "bench-card--craft";
}

function getBenchCardClientCenter(index) {
  const slots = document.getElementById("bench-slots");
  if (!slots) return null;
  const card = slots.querySelector(`.bench-card[data-bench="${index}"]:not(.empty)`);
  if (!card) return null;
  const rect = card.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function getCraftTetherTargetsForItem(itemId, containers, items, bench, team, ctx = null, exclude = {}) {
  return getCraftCommerceTetherTargetsForItem(itemId, containers, items, bench, team, ctx, exclude);
}

function resolveActiveDragCraftTetherTargets(side) {
  if (typeof dragPayload === "undefined" || !dragPayload?.itemId) return [];
  if (typeof dragFrom === "undefined" || !dragFrom) return [];

  const dragTypes = new Set(["shop", "bench", "item"]);
  if (!dragTypes.has(dragFrom.type)) return [];

  const team = side || (typeof prepViewSide !== "undefined" ? prepViewSide : "player");
  const st = typeof getLoadoutEditState === "function"
    ? getLoadoutEditState(team)
    : (typeof getSideState === "function" ? getSideState(team) : null);
  if (!st) return [];

  const ctx = typeof getCraftContextFromGame === "function" ? getCraftContextFromGame(team) : {};
  const exclude = {};
  if (dragFrom.type === "item") exclude.excludeUid = dragFrom.item?.uid;
  if (dragFrom.type === "bench") exclude.excludeBenchIndex = dragFrom.index;

  const boardOnly = dragFrom.type === "shop";
  if (typeof getCraftPartnerTargets === "function") {
    const targets = getCraftPartnerTargets(
      dragPayload.itemId,
      st.containers ?? [],
      st.items || [],
      st.bench || [],
      ctx,
      { boardOnly },
    );
    return targets.boardUids
      .filter((uid) => !(exclude.excludeUid && uid === exclude.excludeUid))
      .map((uid) => {
        const item = (st.items || []).find((entry) => entry.uid === uid);
        if (!item) return null;
        const pt = typeof getBoardItemClientCenter === "function"
          ? getBoardItemClientCenter(item, team)
          : null;
        if (!pt) return null;
        const strength = targets.boardUids.length > 1 ? "strong" : "weak";
        return { ...pt, strength, uid, kind: "board" };
      })
      .filter(Boolean);
  }

  if (typeof getShopCraftTetherTargetsForItem === "function") {
    return getShopCraftTetherTargetsForItem(
      dragPayload.itemId,
      st.containers ?? [],
      st.items || [],
      st.bench || [],
      team,
      ctx,
    ).filter((target) => {
      if (exclude.excludeUid && target.uid === exclude.excludeUid) return false;
      return true;
    });
  }

  return getCraftCommerceTetherTargetsForItem(
    dragPayload.itemId,
    st.containers ?? [],
    st.items || [],
    st.bench || [],
    team,
    ctx,
    exclude,
  );
}

window.shouldShowPrepCraftCommerceFx = shouldShowPrepCraftCommerceFx;
window.getShopCraftHint = getShopCraftHint;
window.getShopCraftExtraClasses = getShopCraftExtraClasses;
window.getBenchCraftExtraClasses = getBenchCraftExtraClasses;
window.getBenchCardClientCenter = getBenchCardClientCenter;
window.getShopCraftTetherTargetsForItem = getShopCraftTetherTargetsForItem;
window.getCraftCommerceTetherTargetsForItem = getCraftCommerceTetherTargetsForItem;
window.getCraftTetherTargetsForItem = getCraftTetherTargetsForItem;
window.resolveActiveDragCraftTetherTargets = resolveActiveDragCraftTetherTargets;
