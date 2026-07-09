/**
 * Отложенный крафт: кластеры регистрируются на поле, слияние — в начале следующего prep.
 */
import type { PendingCraftEntry } from "../types/game";

type CraftSide = "player" | "enemy";

const pendingCraftBySide: Record<CraftSide, PendingCraftEntry[]> = {
  player: [],
  enemy: [],
};

function pendingCraftClusterKey(recipe: { id: string }, clusterItems: Array<{ uid: string }>): string {
  const uids = clusterItems
    .map((item) => item.uid)
    .sort()
    .join(",");
  return `${recipe.id}:${uids}`;
}

function getPendingCraftsForSide(side: CraftSide): PendingCraftEntry[] {
  return pendingCraftBySide[side] || [];
}

function resetPendingCraftState(): void {
  pendingCraftBySide.player = [];
  pendingCraftBySide.enemy = [];
}

function getPendingCraftBoardUids(side: CraftSide): Set<string> {
  const uids = new Set<string>();
  getPendingCraftsForSide(side).forEach((entry) => {
    entry.itemUids.forEach((uid) => uids.add(uid));
  });
  return uids;
}

function getDuePendingCrafts(side: CraftSide, currentRound = typeof round !== "undefined" ? round : 1): PendingCraftEntry[] {
  return getPendingCraftsForSide(side).filter((entry) => entry.registeredRound < currentRound);
}

function removePendingCraftEntries(side: CraftSide, keys: string[]): void {
  const drop = new Set(keys);
  pendingCraftBySide[side] = getPendingCraftsForSide(side).filter((entry) => !drop.has(entry.key));
}

function syncPendingCraftClustersForContainers(
  containers: object[],
  items: object[],
  sideKey: CraftSide,
  currentRound: number,
): void {
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

function syncPendingCraftClustersForSide(side: CraftSide, currentRound = typeof round !== "undefined" ? round : 1): void {
  const st = getSideState(side);
  syncPendingCraftClustersForContainers(st.containers, st.items, side, currentRound);
}

/** Подхватить кластеры, собранные в prep раунда, который только что закончился боем. */
function syncPendingCraftClustersFromLastPrep(side: CraftSide): void {
  const currentRound = typeof round !== "undefined" ? round : 1;
  syncPendingCraftClustersForSide(side, Math.max(1, currentRound - 1));
}

function resolveDuePendingCraftsForSideInstant(side: CraftSide): boolean {
  syncPendingCraftClustersFromLastPrep(side);
  return applyDuePendingCraftsInstant(side);
}

function syncPendingCraftClustersOnState(
  state: { containers?: object[]; items?: object[] } | null | undefined,
  sideKey: CraftSide,
  currentRound = typeof round !== "undefined" ? round : 1,
): void {
  if (!state?.containers || !state?.items) return;
  syncPendingCraftClustersForContainers(state.containers, state.items, sideKey, currentRound);
}

function resolvePendingCraftEntry(side: CraftSide, entry: PendingCraftEntry) {
  const st = getSideState(side);
  const clusterItems = st.items.filter((item: { uid?: string }) => entry.itemUids.includes(item.uid ?? ""));
  if (clusterItems.length !== entry.itemUids.length) return null;
  const recipe = entry.recipe || ITEM_RECIPES.find((r: { id: string }) => r.id === entry.recipeId);
  if (!recipe || typeof applyRecipe !== "function") return null;
  return applyRecipe(st.containers, st.items, recipe, clusterItems);
}

function logPendingCraftResult(side: CraftSide, recipe: { output: string }): void {
  const out = ITEM_CATALOG[recipe.output] as { icon?: string; name?: string } | undefined;
  if (!out) return;
  if (typeof log === "function") log(`⚗️ Крафт: ${out.icon} ${out.name}`);
  if (side === prepViewSide && typeof CombatLog !== "undefined") {
    CombatLog.notifyCraft(out);
  }
}

function applyDuePendingCraftsInstant(side: CraftSide): boolean {
  const due = getDuePendingCrafts(side);
  if (!due.length) return false;

  const st = getSideState(side);
  let changed = false;
  due.forEach((entry) => {
    const result = resolvePendingCraftEntry(side, entry);
    if (!result) return;
    st.items = result.items;
    logPendingCraftResult(side, result.recipe as { output: string });
    changed = true;
  });

  removePendingCraftEntries(side, due.map((entry) => entry.key));
  if (changed && typeof playPrepSfx === "function") playPrepSfx("prep_craft");
  return changed;
}

function resolveDuePendingCraftsOnPrepEntry(): void {
  const sides: CraftSide[] = ["player"];
  if (typeof isVersusMode === "function" && isVersusMode()) sides.push("enemy");

  let changed = false;
  for (const side of sides) {
    if (resolveDuePendingCraftsForSideInstant(side)) changed = true;
  }

  if (changed) {
    if (typeof recalcSynergies === "function") recalcSynergies();
    if (typeof renderBench === "function") renderBench();
    if (typeof renderShop === "function") renderShop();
    if (typeof updateUI === "function") updateUI();
  }
}
