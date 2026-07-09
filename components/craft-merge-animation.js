/**
 * Анимация отложенного крафта: ингредиенты сходятся в центр кластера, затем появляется результат.
 */

const CRAFT_MERGE_STAGGER = typeof ITEM_FLIGHT_STAGGER !== "undefined" ? ITEM_FLIGHT_STAGGER : 70;

function getClusterVisualCenterBoard(clusterItems, team) {
  if (!clusterItems?.length || typeof getItemCells !== "function" || typeof cellRect !== "function") {
    return { x: 0, y: 0 };
  }
  let sx = 0;
  let sy = 0;
  let count = 0;
  clusterItems.forEach((item) => {
    getItemCells(item).forEach(([col, row]) => {
      const rect = cellRect(team, col, row);
      sx += rect.x + rect.w / 2;
      sy += rect.y + rect.h / 2;
      count += 1;
    });
  });
  if (!count) return { x: 0, y: 0 };
  return { x: sx / count, y: sy / count };
}

function getClusterVisualCenterClient(clusterItems, team) {
  const center = getClusterVisualCenterBoard(clusterItems, team);
  if (typeof canvasPointToClient === "function") {
    return canvasPointToClient(center.x, center.y) || center;
  }
  return center;
}

function getCraftMergeItemEmoji(item) {
  const def = ITEM_CATALOG[item.itemId];
  if (!def) return "📦";
  const icons = typeof getItemIcons === "function" ? getItemIcons(def) : [];
  return icons.join("") || def.icon || "📦";
}

function setCraftMergeActive(active) {
  document.documentElement.toggleAttribute("data-craft-merge-active", !!active);
}

function animateSingleCraftMerge(side, entry, onComplete) {
  if (typeof queueItemFlight !== "function") {
    const result = resolvePendingCraftEntry(side, entry);
    if (result) {
      const st = getSideState(side);
      st.items = result.items;
      logPendingCraftResult(side, result.recipe);
      if (typeof playPrepSfx === "function") playPrepSfx("prep_craft");
    }
    removePendingCraftEntries(side, [entry.key]);
    onComplete?.();
    return;
  }

  const st = getSideState(side);
  const clusterItems = st.items.filter((item) => entry.itemUids.includes(item.uid));
  if (!clusterItems.length) {
    removePendingCraftEntries(side, [entry.key]);
    onComplete?.();
    return;
  }

  const to = getClusterVisualCenterClient(clusterItems, side);
  let landed = 0;
  const total = clusterItems.length;

  const finishMerge = () => {
    const result = resolvePendingCraftEntry(side, entry);
    removePendingCraftEntries(side, [entry.key]);
    if (result) {
      st.items = result.items;
      logPendingCraftResult(side, result.recipe);
      if (typeof playPrepSfx === "function") playPrepSfx("prep_craft");

      const placed = result.placed;
      if (placed && typeof getItemVisualCenterClient === "function") {
        const burstFrom = to;
        const burstTo = getItemVisualCenterClient(placed, side);
        queueItemFlight({
          fromX: burstFrom.x,
          fromY: burstFrom.y,
          toX: burstTo.x,
          toY: burstTo.y,
          emoji: getCraftMergeItemEmoji(placed),
          itemId: placed.itemId,
          delay: 40,
          meta: { craftMerge: true, side, entryKey: entry.key, burst: true },
        });
      }
    }
    if (typeof updateUI === "function") updateUI();
    onComplete?.();
  };

  clusterItems.forEach((item, index) => {
    const from = typeof getItemVisualCenterClient === "function"
      ? getItemVisualCenterClient(item, side)
      : to;
    queueItemFlight({
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      emoji: getCraftMergeItemEmoji(item),
      itemId: item.itemId,
      delay: index * CRAFT_MERGE_STAGGER,
      meta: { craftMerge: true, side, entryKey: entry.key },
      onComplete: () => {
        landed += 1;
        if (landed >= total) finishMerge();
      },
    });
  });
}

function runDuePendingCraftMergeForSide(side, onComplete) {
  const due = getDuePendingCrafts(side);
  if (!due.length) {
    onComplete?.();
    return;
  }

  setCraftMergeActive(true);
  const queue = [...due];

  const runNext = () => {
    if (!queue.length) {
      setCraftMergeActive(false);
      onComplete?.();
      return;
    }
    const entry = queue.shift();
    animateSingleCraftMerge(side, entry, runNext);
  };

  runNext();
}

function hasActiveCraftMergeAnimations(side = null) {
  if (typeof hasActiveItemFlights !== "function") return false;
  if (!side) return hasActiveItemFlights((flight) => flight.meta?.craftMerge);
  return hasActiveItemFlights((flight) => flight.meta?.craftMerge && flight.meta?.side === side);
}
