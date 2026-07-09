/**
 * Общий solver для ai-engine / hard-bot-engine: сила рюкзака, placement, greedy add/swap.
 */

function measureLoadoutPower(containers, items, classId) {
  if (typeof computeBackpackPower === "function" && classId) {
    try {
      return computeBackpackPower(containers, items, classId).score;
    } catch {
      /* fall through */
    }
  }
  if (typeof scoreFullLoadout === "function") {
    return scoreFullLoadout(containers, items);
  }
  return 0;
}

function findBestLoadoutPlacementByPower(containers, items, itemId, classId, excludeUid = null) {
  const slots = [...buildSlotSet(containers)].map((k) => k.split(",").map(Number));
  let best = null;
  let bestPower = -Infinity;

  for (let rot = 0; rot < 4; rot++) {
    for (const [col, row] of slots) {
      const placement = resolveLoadoutPlacement(containers, items, itemId, col, row, rot, excludeUid);
      if (!placement.valid) continue;
      const trial = [
        ...items.filter((i) => i.uid !== excludeUid),
        createPlacedItem(itemId, placement.col, placement.row, placement.rotation),
      ];
      if (excludeUid) trial[trial.length - 1].uid = excludeUid;
      else trial[trial.length - 1].uid = "__trial__";
      if (!validateLoadoutItems(containers, trial)) continue;
      const power = measureLoadoutPower(containers, trial, classId);
      if (power > bestPower) {
        bestPower = power;
        best = placement;
      }
    }
  }

  return best;
}

function measureAddItemPowerGain(containers, items, itemId, classId, excludeUid = null) {
  const def = ITEM_CATALOG[itemId];
  if (!def || def.isContainer || def.isEnhancementItem) return -999;

  const baseItems = excludeUid ? items.filter((i) => i.uid !== excludeUid) : items;
  const before = measureLoadoutPower(containers, baseItems, classId);
  const spot = findBestLoadoutPlacementByPower(containers, baseItems, itemId, classId);
  if (!spot?.valid) return -999;

  const trial = [
    ...baseItems,
    createPlacedItem(itemId, spot.col, spot.row, spot.rotation),
  ];
  trial[trial.length - 1].uid = "__trial__";
  if (!validateLoadoutItems(containers, trial)) return -999;
  return measureLoadoutPower(containers, trial, classId) - before;
}

function solverResolvePlacement(containers, items, itemId, classId, mode = "heuristic") {
  if (mode === "power" && classId) {
    return findBestLoadoutPlacementByPower(containers, items, itemId, classId);
  }
  if (typeof findBestLoadoutPlacement === "function") {
    return findBestLoadoutPlacement(containers, items, itemId);
  }
  return findLoadoutItemPlacement(containers, items, itemId, 0);
}

function solverTryCrafting(containers, items) {
  return items;
}

function solverFindBestAddition(containers, items, pool, classId, options = {}) {
  const {
    getItemId = (entry) => entry?.id ?? entry?.itemId ?? entry,
    canAddItem = () => true,
    placementMode = "heuristic",
    minGain = null,
  } = options;

  const before = measureLoadoutPower(containers, items, classId);
  let best = null;

  for (const entry of pool) {
    const itemId = getItemId(entry);
    if (!itemId || !canAddItem(itemId, items)) continue;

    const place = solverResolvePlacement(containers, items, itemId, classId, placementMode);
    if (!place?.valid) continue;

    const trial = [
      ...items,
      createPlacedItem(itemId, place.col, place.row, place.rotation || 0),
    ];
    if (typeof validateLoadoutItems === "function" && !validateLoadoutItems(containers, trial)) {
      continue;
    }

    const after = measureLoadoutPower(containers, trial, classId);
    const gain = after - before;
    if (minGain != null && gain < minGain) continue;
    if (!best || gain > best.gain) {
      best = { itemId, place, gain, trial };
    }
  }

  return best;
}

function solverFindBestSwap(containers, items, pool, classId, options = {}) {
  const {
    getItemId = (entry) => entry?.id ?? entry?.itemId ?? entry,
    canAddItem = () => true,
    placementMode = "heuristic",
    minGain = 0.5,
  } = options;

  const before = measureLoadoutPower(containers, items, classId);
  let best = null;

  for (const victim of items) {
    const victimDef = ITEM_CATALOG[victim.itemId];
    if (victimDef?.protected) continue;

    const without = items.filter((entry) => entry.uid !== victim.uid);
    if (typeof validateLoadoutItems === "function" && !validateLoadoutItems(containers, without)) {
      continue;
    }

    for (const entry of pool) {
      const itemId = getItemId(entry);
      if (!itemId || itemId === victim.itemId || !canAddItem(itemId, without)) continue;

      const place = solverResolvePlacement(containers, without, itemId, classId, placementMode);
      if (!place?.valid) continue;

      const trial = [
        ...without,
        createPlacedItem(itemId, place.col, place.row, place.rotation || 0),
      ];
      if (typeof validateLoadoutItems === "function" && !validateLoadoutItems(containers, trial)) {
        continue;
      }

      const after = measureLoadoutPower(containers, trial, classId);
      const gain = after - before;
      if (gain > minGain && (!best || gain > best.gain)) {
        best = { trial, gain };
      }
    }
  }

  return best;
}

/** Local search: перебор соседних позиций + swap-pairs (greedy, как bb_solver). */
function solverDeepOptimizeLoadout(containers, items, classId, options = {}) {
  const {
    minMoveGain = 0.8,
    minSwapGain = 1.2,
    maxRounds = 36,
  } = options;

  let bestScore = measureLoadoutPower(containers, items, classId);
  let improved = true;
  let guard = 0;

  while (improved && guard < maxRounds) {
    guard += 1;
    improved = false;

    for (const item of [...items]) {
      const slots = [...buildSlotSet(containers)].map((k) => k.split(",").map(Number));
      for (let rot = 0; rot < 4; rot += 1) {
        for (const [col, row] of slots) {
          const placement = resolveLoadoutPlacement(
            containers,
            items,
            item.itemId,
            col,
            row,
            rot,
            item.uid,
          );
          if (!placement.valid) continue;
          const same = item.col === placement.col && item.row === placement.row
            && (item.rotation || 0) === (placement.rotation || 0);
          if (same) continue;

          const moved = items.map((i) =>
            (i.uid === item.uid
              ? { ...i, col: placement.col, row: placement.row, rotation: placement.rotation }
              : i),
          );
          if (!validateLoadoutItems(containers, moved)) continue;
          const after = measureLoadoutPower(containers, moved, classId);
          if (after > bestScore + minMoveGain) {
            items.splice(0, items.length, ...moved);
            bestScore = after;
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
      if (improved) break;
    }

    if (improved) continue;

    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i];
        const b = items[j];
        const candidate = items.map((item) => {
          if (item.uid === a.uid) return { ...item, col: b.col, row: b.row, rotation: b.rotation || 0 };
          if (item.uid === b.uid) return { ...item, col: a.col, row: a.row, rotation: a.rotation || 0 };
          return item;
        });
        if (!validateLoadoutItems(containers, candidate)) continue;
        const after = measureLoadoutPower(containers, candidate, classId);
        if (after > bestScore + minSwapGain) {
          items.splice(0, items.length, ...candidate);
          bestScore = after;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }
}

const measureAiLoadoutPower = measureLoadoutPower;
const measureHardBotPower = measureLoadoutPower;
const aiMeasureAddItemPowerGain = measureAddItemPowerGain;
const hardBotTryCrafting = solverTryCrafting;
