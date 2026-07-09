/**
 * Отложенный крафт: кластеры регистрируются на поле, слияние — в начале следующего prep.
 */

/** @typedef {{ key: string, recipeId: string, recipe: object, itemUids: string[], registeredRound: number, anchor: { col: number, row: number } }} PendingCraftEntry */

const pendingCraftBySide = {
  player: [],
  enemy: [],
};

function pendingCraftClusterKey(recipe, clusterItems) {
  const uids = clusterItems.map((item) => item.uid).sort().join(",");
  return `${recipe.id}:${uids}`;
}

function getPendingCraftsForSide(side) {
  return pendingCraftBySide[side] || [];
}

function resetPendingCraftState() {
  pendingCraftBySide.player = [];
  pendingCraftBySide.enemy = [];
}

function getPendingCraftBoardUids(side) {
  const uids = new Set();
  getPendingCraftsForSide(side).forEach((entry) => {
    entry.itemUids.forEach((uid) => uids.add(uid));
  });
  return uids;
}

function getDuePendingCrafts(side, currentRound = typeof round !== "undefined" ? round : 1) {
  return getPendingCraftsForSide(side).filter((entry) => entry.registeredRound < currentRound);
}

function removePendingCraftEntries(side, keys) {
  const drop = new Set(keys);
  pendingCraftBySide[side] = getPendingCraftsForSide(side).filter((entry) => !drop.has(entry.key));
}

function syncPendingCraftClustersForContainers(containers, items, sideKey, currentRound) {
  if (typeof detectMatchingCraftClusters !== "function") return;
  const ctx = typeof getCraftContextFromGame === "function" ? getCraftContextFromGame(sideKey) : {};
  const detected = detectMatchingCraftClusters(containers, items, ctx);
  const detectedKeys = new Set(detected.map((d) => pendingCraftClusterKey(d.recipe, d.clusterItems)));

  pendingCraftBySide[sideKey] = getPendingCraftsForSide(sideKey).filter((entry) => detectedKeys.has(entry.key));

  const existingKeys = new Set(getPendingCraftsForSide(sideKey).map((entry) => entry.key));
  detected.forEach((d) => {
    const key = pendingCraftClusterKey(d.recipe, d.clusterItems);
    if (existingKeys.has(key)) return;
    pendingCraftBySide[sideKey].push({
      key,
      recipeId: d.recipe.id,
      recipe: d.recipe,
      itemUids: d.clusterItems.map((item) => item.uid),
      registeredRound: currentRound,
      anchor: d.anchor,
    });
    existingKeys.add(key);
  });
}

function syncPendingCraftClustersForSide(side, currentRound = typeof round !== "undefined" ? round : 1) {
  const st = getSideState(side);
  syncPendingCraftClustersForContainers(st.containers, st.items, side, currentRound);
}

function syncPendingCraftClustersOnState(state, sideKey, currentRound = typeof round !== "undefined" ? round : 1) {
  if (!state?.containers || !state?.items) return;
  syncPendingCraftClustersForContainers(state.containers, state.items, sideKey, currentRound);
}

function resolvePendingCraftEntry(side, entry) {
  const st = getSideState(side);
  const clusterItems = st.items.filter((item) => entry.itemUids.includes(item.uid));
  if (clusterItems.length !== entry.itemUids.length) return null;
  const recipe = entry.recipe || ITEM_RECIPES.find((r) => r.id === entry.recipeId);
  if (!recipe || typeof applyRecipe !== "function") return null;
  return applyRecipe(st.containers, st.items, recipe, clusterItems);
}

function logPendingCraftResult(side, recipe) {
  const out = ITEM_CATALOG[recipe.output];
  if (!out) return;
  if (typeof log === "function") log(`⚗️ Крафт: ${out.icon} ${out.name}`);
  if (side === prepViewSide && typeof CombatLog !== "undefined") {
    CombatLog.notifyCraft(out);
  }
}

function applyDuePendingCraftsInstant(side) {
  const due = getDuePendingCrafts(side);
  if (!due.length) return false;

  const st = getSideState(side);
  let changed = false;
  due.forEach((entry) => {
    const result = resolvePendingCraftEntry(side, entry);
    if (!result) return;
    st.items = result.items;
    logPendingCraftResult(side, result.recipe);
    changed = true;
  });

  removePendingCraftEntries(side, due.map((entry) => entry.key));
  if (changed && typeof playPrepSfx === "function") playPrepSfx("prep_craft");
  return changed;
}

function resolveDuePendingCraftsOnPrepEntry() {
  if (typeof runDuePendingCraftMergeForSide !== "function") {
    const sides = ["player"];
    if (typeof isVersusMode === "function" && isVersusMode()) sides.push("enemy");
    let changed = false;
    sides.forEach((side) => {
      if (applyDuePendingCraftsInstant(side)) changed = true;
    });
    if (changed) {
      if (typeof recalcSynergies === "function") recalcSynergies();
      if (typeof renderBench === "function") renderBench();
      if (typeof renderShop === "function") renderShop();
      if (typeof updateUI === "function") updateUI();
    }
    return;
  }

  const visibleSide = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
  const otherSide = visibleSide === "player" ? "enemy" : "player";
  applyDuePendingCraftsInstant(otherSide);

  runDuePendingCraftMergeForSide(visibleSide, () => {
    if (typeof recalcSynergies === "function") recalcSynergies();
    if (typeof renderBench === "function") renderBench();
    if (typeof renderShop === "function") renderShop();
    if (typeof updateUI === "function") updateUI();
  });
}
