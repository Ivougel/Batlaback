/**
 * Roguelike-магазин: веса редкости по раунду + динамический баланс экономики.
 */

const RARITY_TIERS = [
  { untilRound: 3, weights: { common: 0.72, uncommon: 0.23, rare: 0.05, legendary: 0 } },
  { untilRound: 6, weights: { common: 0.52, uncommon: 0.33, rare: 0.15, legendary: 0 } },
  { untilRound: 10, weights: { common: 0.38, uncommon: 0.38, rare: 0.19, legendary: 0.05 } },
  { untilRound: 999, weights: { common: 0.28, uncommon: 0.38, rare: 0.24, legendary: 0.1 } },
];

const UTILITY_SLOT_CHANCE = 0.42;
const LOSS_UTILITY_BOOST = 0.35;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getRarityWeightsForRound(round) {
  const tier = RARITY_TIERS.find((t) => round <= t.untilRound) || RARITY_TIERS[RARITY_TIERS.length - 1];
  return { ...tier.weights };
}

function countRecentLosses(recentResults) {
  return (recentResults || []).filter((r) => r === "loss").length;
}

function rollRarity(ctx) {
  const weights = getRarityWeightsForRound(ctx.round || 1);
  const gold = ctx.gold ?? 0;
  const round = ctx.round ?? 1;
  const losses = countRecentLosses(ctx.recentResults);

  const expensiveBias = clamp(gold / Math.max(1, round * 5), 0, 0.08);
  weights.rare += expensiveBias;
  weights.legendary += expensiveBias * 0.35;
  weights.common -= expensiveBias * 0.7;

  if (losses >= 2) {
    weights.uncommon += 0.04;
    weights.common += 0.06;
    weights.rare -= 0.04;
    weights.legendary -= 0.06;
  }

  if (gold <= 6) {
    weights.common += 0.12;
    weights.uncommon += 0.04;
    weights.rare -= 0.1;
    weights.legendary -= 0.06;
  }

  weights.common = Math.max(0.05, weights.common);
  weights.uncommon = Math.max(0.05, weights.uncommon);
  weights.rare = Math.max(0, weights.rare);
  weights.legendary = Math.max(0, weights.legendary);

  const total = weights.common + weights.uncommon + weights.rare + weights.legendary;
  const r = Math.random() * total;
  let acc = 0;
  for (const key of ["legendary", "rare", "uncommon", "common"]) {
    acc += weights[key];
    if (r <= acc) return key;
  }
  return "common";
}

function itemShopWeight(item, ctx) {
  let w = 1;
  const gold = ctx.gold ?? 0;
  const tags = ctx.loadoutTags || [];
  const opponentTags = ctx.opponentLoadoutTags || [];
  const losses = countRecentLosses(ctx.recentResults);
  const tagOverlap = item.tags.filter((t) => tags.includes(t)).length;
  const buildHelp = losses >= 2 ? 0.12 + tagOverlap * 0.1 : tagOverlap * 0.05;
  w += buildHelp;

  if (isUtilityItem(item)) {
    w += 0.18;
    if (gold <= 8) w += 0.25;
    if (losses >= 1) w += LOSS_UTILITY_BOOST;
  }

  if (item.tags?.includes("craft")) w += 0.14;

  if (isItemAffordable(item, gold)) {
    const budgetRatio = item.cost / Math.max(1, gold);
    if (budgetRatio <= 0.35) w += 0.2;
    else if (budgetRatio <= 0.65) w += 0.12;
  } else {
    const over = item.cost - gold;
    w *= Math.max(0.08, 1 - over * 0.12);
  }

  if (opponentTags.includes("shield") || opponentTags.includes("armor")) {
    if (item.tags.includes("magic") || item.tags.includes("fire")) w += 0.1;
  }
  if (opponentTags.includes("poison") || opponentTags.includes("weapon")) {
    if (item.tags.includes("shield") || item.tags.includes("utility")) w += 0.1;
    if (item.tags.includes("poison")) w += 0.06;
  }

  if (item.cost >= 10 && gold < item.cost) w *= 0.15;
  else if (item.cost >= 8 && gold >= item.cost) {
    w += clamp(gold / 50, 0, 0.15);
  }

  if (ctx.playerClass && item.classRestriction === ctx.playerClass) w += 0.45;
  return Math.max(0.03, w);
}

function pickWeightedItem(pool, ctx) {
  if (!pool.length) return null;
  const weights = pool.map((item) => itemShopWeight(item, ctx));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i].id;
  }
  return pool[pool.length - 1].id;
}

function rollShopBag(ctx) {
  const round = ctx.round ?? 1;
  const pool = getShopContainerItems().filter((item) => isContainerAvailableInShop(item, round));
  if (!pool.length) return null;

  const gold = ctx.gold ?? 0;
  const weights = pool.map((item) => {
    let w = 1;
    if (item.rarity === "common") w = 1.4;
    if (item.rarity === "uncommon") w = 1;
    if (item.rarity === "rare") w = 0.55;
    if (item.cost >= 8) w *= 0.7;
    if (!isItemAffordable(item, gold)) w *= 0.2;
    return Math.max(0.05, w);
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i].id;
  }
  return pool[pool.length - 1].id;
}

function buildShopPool(ctx, opts = {}) {
  const playerClass = ctx.playerClass || null;
  let pool = getShopEligibleItems(playerClass);

  if (opts.preferUtility) {
    const utility = pool.filter((item) => isUtilityItem(item));
    if (utility.length) pool = utility;
  }

  if (opts.preferSurvival) {
    const survival = pool.filter((item) =>
      item.tags.includes("utility")
      || item.tags.includes("food")
      || (item.effects || []).some((e) => e.type === "heal" || e.type === "passiveMaxHp"),
    );
    if (survival.length) pool = survival;
  }

  if (opts.requireAffordable) {
    const affordable = pool.filter((item) => isItemAffordable(item, ctx.gold ?? 0));
    if (affordable.length) pool = affordable;
  }

  if (!opts.ignoreRarity) {
    const rarity = rollRarity(ctx);
    const byRarity = pool.filter((i) => i.rarity === rarity);
    if (byRarity.length) pool = byRarity;
    else {
      const commons = pool.filter((i) => i.rarity === "common");
      if (commons.length) pool = commons;
    }
  }

  return pool;
}

function rollShopItem(ctx, opts = {}) {
  const round = ctx.round ?? 1;
  const bagChance = opts.allowBag === false ? 0 : clamp(0.1 + round * 0.01, 0.1, 0.22);
  if (!opts.preferUtility && !opts.requireAffordable && Math.random() < bagChance) {
    const bagId = rollShopBag(ctx);
    if (bagId) return bagId;
  }

  const pool = buildShopPool(ctx, opts);
  if (!pool.length) return null;
  return pickWeightedItem(pool, ctx);
}

function rollShopItemGuaranteed(ctx, opts = {}) {
  let item = rollShopItem(ctx, opts);
  let guard = 0;
  while (!item && guard < 40) {
    item = rollShopItem(ctx, { ...opts, ignoreRarity: guard > 20 });
    guard += 1;
  }
  if (item) return item;
  const fallback = getAffordableShopItems(ctx.playerClass || null, ctx.gold ?? 0);
  if (fallback.length) return fallback[0].id;
  const eligible = getShopEligibleItems(ctx.playerClass || null);
  return eligible[0]?.id || null;
}

/**
 * Собирает витрину с гарантиями: ≥1 по карману, шанс utility-слота, после лоссов — survival.
 */
function rollShopBatch(count, ctx) {
  const slots = [];
  const gold = ctx.gold ?? 0;
  const losses = countRecentLosses(ctx.recentResults);
  const utilityIdx = Math.random() < UTILITY_SLOT_CHANCE ? Math.floor(Math.random() * count) : -1;
  let survivalIdx = -1;
  if (losses >= 2) survivalIdx = (utilityIdx + 1 + Math.floor(Math.random() * Math.max(1, count - 1))) % count;

  for (let i = 0; i < count; i++) {
    if (i === utilityIdx) {
      slots.push(rollShopItemGuaranteed(ctx, {
        preferUtility: true,
        requireAffordable: gold <= 10,
      }));
    } else if (i === survivalIdx) {
      slots.push(rollShopItemGuaranteed(ctx, {
        preferSurvival: true,
        requireAffordable: gold <= 12,
      }));
    } else {
      slots.push(rollShopItemGuaranteed(ctx, {}));
    }
  }

  const hasAffordable = slots.some((id) => isItemAffordable(ITEM_CATALOG[id], gold));
  if (gold > 0 && !hasAffordable) {
    const fixIdx = Math.floor(Math.random() * count);
    slots[fixIdx] = rollShopItemGuaranteed(ctx, { requireAffordable: true });
  }

  return slots;
}

function rollShop(count, ctx) {
  return rollShopBatch(count, ctx);
}

/** @deprecated используйте rollShopItem */
function randomShopItem() {
  return rollShopItem({ round: 1, gold: 12, playerClass: null, loadoutTags: [], recentResults: [] });
}
