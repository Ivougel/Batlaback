/**
 * Сложный бот: каждый раунд подбирает лучшую экипировку из полного пула.
 * Ограничения: без дубликатов legendary/godly (по itemId), сила рюкзака чуть выше игрока.
 */

const HARD_BOT_POWER_MARGIN = 1.08;
const HARD_BOT_POWER_BONUS = 3;
const HARD_BOT_NO_DUP_TIERS = new Set(["legendary", "godly"]);

function isHardBotRestrictedItem(def) {
  if (!def) return false;
  const tier = typeof getItemShopRarityTier === "function"
    ? getItemShopRarityTier(def)
    : (def.rarity || "common");
  return HARD_BOT_NO_DUP_TIERS.has(tier);
}

function getHardBotItemPool(classId, round) {
  const ctx = {
    round,
    gold: 9999,
    playerClass: classId,
    loadoutTags: [],
    loadoutItems: [],
    opponentLoadoutTags: [],
    shopModifiers: null,
    bonusUniqueGranted: false,
  };

  let pool = typeof getExpandedShopPool === "function"
    ? getExpandedShopPool(ctx)
    : getShopEligibleItems(classId, round);

  return pool.filter((item) => {
    if (!item || item.craftOnly || item.protected) return false;
    if (typeof isCraftOutputItemId === "function" && isCraftOutputItemId(item.id)) return false;
    if (item.classRestriction && item.classRestriction !== classId) return false;
    if (item.isContainer && (!item.shopContainer || item.immovable)) return false;
    return true;
  });
}

function hardBotCanAddItem(itemId, items) {
  const def = ITEM_CATALOG[itemId];
  if (!def) return false;
  if (isHardBotRestrictedItem(def) && items.some((entry) => entry.itemId === itemId)) {
    return false;
  }
  return true;
}

function measureHardBotPower(containers, items, classId) {
  if (typeof computeBackpackPower !== "function") {
    return typeof scoreFullLoadout === "function" ? scoreFullLoadout(containers, items) : 0;
  }
  return computeBackpackPower(containers, items, classId).score;
}

function hardBotTryCrafting(containers, items) {
  if (typeof tryResolveCrafting !== "function") return items;
  let guard = 0;
  while (guard < 16) {
    guard += 1;
    const result = tryResolveCrafting(containers, items);
    if (!result.crafted.length) break;
    items.splice(0, items.length, ...result.items);
  }
  return items;
}

function hardBotRankPool(pool, containers, items, classId, round, gridW, gridH) {
  const archetype = AI_ARCHETYPES[classId] || AI_ARCHETYPES.warrior;
  const ctx = {
    archetype,
    items,
    bench: [],
    classId,
    gridW,
    gridH,
    containers,
    scout: null,
    round,
  };

  return [...pool].sort((a, b) => {
    const scoreB = typeof aiItemScore === "function" ? aiItemScore(b.id, ctx) : (b.cost || 0);
    const scoreA = typeof aiItemScore === "function" ? aiItemScore(a.id, ctx) : (a.cost || 0);
    return scoreB - scoreA;
  });
}

function hardBotFindBestAddition(containers, items, pool, classId, round, gridW, gridH) {
  const before = measureHardBotPower(containers, items, classId);
  let best = null;

  for (const entry of pool) {
    const itemId = entry.id;
    if (!hardBotCanAddItem(itemId, items)) continue;

    const place = typeof findBestLoadoutPlacement === "function"
      ? findBestLoadoutPlacement(containers, items, itemId)
      : findLoadoutItemPlacement(containers, items, itemId, 0);
    if (!place?.valid) continue;

    const trial = [
      ...items,
      createPlacedItem(itemId, place.col, place.row, place.rotation || 0),
    ];
    if (typeof validateLoadoutItems === "function" && !validateLoadoutItems(containers, trial)) {
      continue;
    }

    const after = measureHardBotPower(containers, trial, classId);
    const gain = after - before;
    if (!best || gain > best.gain) {
      best = { itemId, place, gain, trial };
    }
  }

  return best;
}

function hardBotFindBestSwap(containers, items, pool, classId, round, gridW, gridH) {
  const before = measureHardBotPower(containers, items, classId);
  let best = null;

  for (const victim of items) {
    const victimDef = ITEM_CATALOG[victim.itemId];
    if (victimDef?.protected) continue;

    const without = items.filter((entry) => entry.uid !== victim.uid);
    if (typeof validateLoadoutItems === "function" && !validateLoadoutItems(containers, without)) {
      continue;
    }

    for (const entry of pool) {
      const itemId = entry.id;
      if (itemId === victim.itemId) continue;
      if (!hardBotCanAddItem(itemId, without)) continue;

      const place = typeof findBestLoadoutPlacement === "function"
        ? findBestLoadoutPlacement(containers, without, itemId)
        : findLoadoutItemPlacement(containers, without, itemId, 0);
      if (!place?.valid) continue;

      const trial = [
        ...without,
        createPlacedItem(itemId, place.col, place.row, place.rotation || 0),
      ];
      if (typeof validateLoadoutItems === "function" && !validateLoadoutItems(containers, trial)) {
        continue;
      }

      const after = measureHardBotPower(containers, trial, classId);
      const gain = after - before;
      if (gain > 0.5 && (!best || gain > best.gain)) {
        best = { trial, gain };
      }
    }
  }

  return best;
}

function hardBotAiState(containers, items, classId) {
  return {
    containers,
    items,
    bench: [],
    classId,
    archetype: AI_ARCHETYPES[classId] || AI_ARCHETYPES.warrior,
  };
}

function hardBotRunAiOptimize(containers, items, classId) {
  if (typeof aiOptimizeLoadout !== "function") return items;
  const state = hardBotAiState(containers, items, classId);
  aiOptimizeLoadout(state);
  return state.items;
}

function buildHardBotOptimalLoadout(containers, items, classId, round, gridW, gridH, targetPower) {
  const pool = hardBotRankPool(getHardBotItemPool(classId, round), containers, items, classId, round, gridW, gridH);

  let guard = 0;
  while (guard < 80) {
    guard += 1;
    const addition = hardBotFindBestAddition(containers, items, pool, classId, round, gridW, gridH);
    if (!addition || addition.gain < 0.35) break;
    items.push(createPlacedItem(
      addition.itemId,
      addition.place.col,
      addition.place.row,
      addition.place.rotation || 0,
    ));
    items = hardBotTryCrafting(containers, items);
    items = hardBotRunAiOptimize(containers, items, classId);
  }

  guard = 0;
  while (guard < 60 && measureHardBotPower(containers, items, classId) < targetPower) {
    guard += 1;
    const swap = hardBotFindBestSwap(containers, items, pool, classId, round, gridW, gridH);
    if (!swap) break;
    items = swap.trial;
    items = hardBotTryCrafting(containers, items);
    items = hardBotRunAiOptimize(containers, items, classId);
  }

  items = hardBotRunAiOptimize(containers, items, classId);
  items = hardBotTryCrafting(containers, items);
  const aiState = hardBotAiState(containers, items, classId);
  if (typeof aiSocketGems === "function") aiSocketGems(aiState);
  items = aiState.items;
  if (typeof aiApplyCrafting === "function") aiApplyCrafting(aiState);
  items = aiState.items;
  items = hardBotRunAiOptimize(containers, items, classId);

  return items;
}

function hardBotPrepPhase(state, round, gridW, gridH, battleWon, playerContainers, playerItems, playerClass) {
  const classId = state.classId || AI_ARCHETYPES.warrior.id;
  const containers = state.containers || createStartingContainers(gridW, gridH);
  let items = applyClassStarters(containers, [], classId);

  const playerPower = measureHardBotPower(playerContainers, playerItems, playerClass);
  const targetPower = Math.max(
    8,
    Math.ceil(playerPower * HARD_BOT_POWER_MARGIN) + HARD_BOT_POWER_BONUS,
  );

  items = buildHardBotOptimalLoadout(
    containers,
    items,
    classId,
    round,
    gridW,
    gridH,
    targetPower,
  );

  if (typeof applySynergyModifiersToContainers === "function") {
    applySynergyModifiersToContainers(containers, items);
  }

  let gold = state.gold ?? AI_ECON.START_GOLD;
  if (battleWon === true) gold += AI_ECON.ROUND_GOLD + AI_ECON.WIN_GOLD;
  else if (battleWon === false) gold += AI_ECON.ROUND_GOLD;
  else if (battleWon === null && round === 1) {
    // старт игры
  } else {
    gold += AI_ECON.ROUND_GOLD;
  }

  const archetype = AI_ARCHETYPES[classId] || AI_ARCHETYPES.warrior;
  return {
    archetype,
    classId,
    gold,
    containers,
    items,
    bench: [],
  };
}

function createInitialHardBotState(round, gridW, gridH, playerContainers, playerItems, playerClass, enemyClassId = "warrior") {
  const classId = enemyClassId || "warrior";
  const containers = createStartingContainers(gridW, gridH);
  const items = applyClassStarters(containers, [], classId);
  return hardBotPrepPhase(
    {
      classId,
      gold: AI_ECON.START_GOLD,
      containers,
      items,
      bench: [],
    },
    round,
    gridW,
    gridH,
    null,
    playerContainers,
    playerItems,
    playerClass || "warrior",
  );
}
