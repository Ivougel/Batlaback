/**
 * Магазин в стиле Backpack Battles: фиксированные % редкости по раунду.
 * Источник: https://backpackbattles.wiki.gg/wiki/Game_Mechanics
 */

/** Тиры розыгрыша магазина (как в оригинале BB). */
const BB_SHOP_TIERS = ["unique", "godly", "legendary", "epic", "rare", "common"];

/** % на слот по раунду (раунды 12–18 = строка 12). */
const BB_RARITY_PERCENT_BY_ROUND = [
  /*  1 */ { common: 90, rare: 10, epic: 0, legendary: 0, godly: 0, unique: 0 },
  /*  2 */ { common: 84, rare: 15, epic: 1, legendary: 0, godly: 0, unique: 0 },
  /*  3 */ { common: 75, rare: 20, epic: 5, legendary: 0, godly: 0, unique: 0 },
  /*  4 */ { common: 64, rare: 25, epic: 10, legendary: 1, godly: 0, unique: 3 },
  /*  5 */ { common: 45, rare: 35, epic: 15, legendary: 5, godly: 0, unique: 3 },
  /*  6 */ { common: 29, rare: 40, epic: 20, legendary: 10, godly: 1, unique: 3 },
  /*  7 */ { common: 20, rare: 35, epic: 25, legendary: 15, godly: 5, unique: 3 },
  /*  8 */ { common: 20, rare: 30, epic: 25, legendary: 15, godly: 10, unique: 3 },
  /*  9 */ { common: 20, rare: 28, epic: 25, legendary: 15, godly: 12, unique: 3 },
  /* 10 */ { common: 20, rare: 25, epic: 25, legendary: 15, godly: 15, unique: 3 },
  /* 11 */ { common: 20, rare: 23, epic: 23, legendary: 17, godly: 17, unique: 3 },
  /* 12+ */ { common: 20, rare: 20, epic: 20, legendary: 20, godly: 20, unique: 3 },
];

const BADGE_ITEM_IDS = new Set([
  "rainbow_badge", "leaf_badge", "wolf_badge", "twine_badge",
]);

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getBBRarityRow(round = 1) {
  const idx = clamp(Math.floor(round), 1, 12) - 1;
  return { ...BB_RARITY_PERCENT_BY_ROUND[idx] };
}

/** Внутренняя редкость каталога → тир розыгрыша магазина BB. */
function getItemShopRarityTier(item) {
  if (!item) return "common";
  if (item.shopRarityTier) return item.shopRarityTier;
  const rarity = item.rarity || "common";
  if (rarity === "uncommon") return "rare";
  if (BB_SHOP_TIERS.includes(rarity)) return rarity;
  return "common";
}

function loadoutHasUniqueItem(items = []) {
  return items.some((entry) => {
    const def = ITEM_CATALOG[entry?.itemId];
    return def && getItemShopRarityTier(def) === "unique";
  });
}

function getBBRarityWeights(ctx) {
  const round = ctx.round ?? 1;
  const weights = getBBRarityRow(round);
  const isReroll = !!ctx.isReroll;
  const hasUnique = ctx.hasUniqueInLoadout ?? loadoutHasUniqueItem(ctx.loadoutItems);

  if (ctx.shopModifiers?.uniqueChanceBonus) {
    weights.unique = (weights.unique || 0) * (1 + ctx.shopModifiers.uniqueChanceBonus);
  }

  if (isReroll || hasUnique) {
    const uniqueWeight = weights.unique || 0;
    weights.unique = 0;
    if (uniqueWeight > 0) {
      const base = weights.common + weights.rare + weights.epic + weights.legendary + weights.godly;
      if (base > 0) {
        weights.common += uniqueWeight * (weights.common / base);
        weights.rare += uniqueWeight * (weights.rare / base);
        weights.epic += uniqueWeight * (weights.epic / base);
        weights.legendary += uniqueWeight * (weights.legendary / base);
        weights.godly += uniqueWeight * (weights.godly / base);
      } else {
        weights.common += uniqueWeight;
      }
    }
  }

  return weights;
}

function rollBBShopTier(ctx) {
  const weights = getBBRarityWeights(ctx);
  const total = BB_SHOP_TIERS.reduce((sum, key) => sum + (weights[key] || 0), 0);
  if (total <= 0) return "common";

  const r = Math.random() * total;
  let acc = 0;
  for (const key of BB_SHOP_TIERS) {
    acc += weights[key] || 0;
    if (r <= acc) return key;
  }
  return "common";
}

function pickUniformItem(pool) {
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

/** Повысить редкость предмета на один тир (common → rare → …). */
function upgradeShopItemToHigherTier(itemId, ctx) {
  const def = ITEM_CATALOG[itemId];
  if (!def) return itemId;
  const tier = getItemShopRarityTier(def);
  const tierIdx = BB_SHOP_TIERS.indexOf(tier);
  if (tierIdx <= 0) return itemId;

  const higherTier = BB_SHOP_TIERS[tierIdx - 1];
  const pool = filterPoolByShopTier(
    getBaseShopPool(ctx.playerClass || null, ctx.round ?? 1),
    higherTier,
  );
  if (!pool.length) return itemId;
  return pickUniformItem(pool);
}

function pickUniqueItem(pool, ctx) {
  if (!pool.length) return null;
  const round = ctx.round ?? 1;
  const weights = pool.map((item) => {
    let w = 1;
    if (BADGE_ITEM_IDS.has(item.id) && round <= 3) w = 1.1;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i].id;
  }
  return pool[pool.length - 1].id;
}

function getBaseShopPool(playerClass, round = 1) {
  return getShopEligibleItems(playerClass, round);
}

/** Расширенный пул с учётом значков и магазинных модификаторов на поле. */
function getExpandedShopPool(ctx) {
  const playerClass = ctx.playerClass || null;
  const round = ctx.round ?? 1;
  const base = getBaseShopPool(playerClass, round);
  const byId = new Map(base.map((item) => [item.id, item]));
  const mods = ctx.shopModifiers;

  if (!mods) return [...byId.values()];

  Object.values(ITEM_CATALOG).forEach((item) => {
    if (byId.has(item.id)) return;
    if (item.craftOnly) return;
    if (typeof CRAFT_OUTPUT_IDS !== "undefined" && CRAFT_OUTPUT_IDS.has(item.id)) return;
    if (isItemExcludedByShopModifiers(item, ctx)) return;
    if (!itemMatchesShopModifiers(item, mods)) return;
    if (item.isContainer && (!item.shopContainer || item.immovable)) return;
    if (item.classRestriction && item.classRestriction !== playerClass) {
      if (!itemMatchesShopModifiers(item, mods)) return;
    }
    byId.set(item.id, item);
  });

  return [...byId.values()];
}

function filterPoolByShopTier(pool, tier) {
  return pool.filter((item) => getItemShopRarityTier(item) === tier);
}

function buildShopPool(ctx, opts = {}) {
  const playerClass = ctx.playerClass || null;
  const round = ctx.round ?? 1;
  let pool = getExpandedShopPool(ctx);

  if (opts.requireAffordable) {
    const affordable = pool.filter((item) => isItemAffordable(item, ctx.gold ?? 0));
    if (affordable.length) pool = affordable;
  }

  if (!opts.ignoreRarity) {
    const tier = opts.forcedTier || rollBBShopTier(ctx);
    let byTier = filterPoolByShopTier(pool, tier);
    if (!byTier.length) {
      const tierIdx = BB_SHOP_TIERS.indexOf(tier);
      for (let i = tierIdx + 1; i < BB_SHOP_TIERS.length; i++) {
        byTier = filterPoolByShopTier(pool, BB_SHOP_TIERS[i]);
        if (byTier.length) break;
      }
    }
    if (byTier.length) pool = byTier;
  }

  return pool;
}

function rollShopItem(ctx, opts = {}) {
  const pool = buildShopPool(ctx, opts);
  if (!pool.length) return null;
  const tier = getItemShopRarityTier(pool[0]);
  if (tier === "unique") return pickUniqueItem(pool, ctx);
  return pickUniformItem(pool);
}

function rollShopItemGuaranteed(ctx, opts = {}) {
  let item = rollShopItem(ctx, opts);
  let guard = 0;
  while (!item && guard < 30) {
    item = rollShopItem(ctx, {
      ...opts,
      ignoreRarity: guard > 12,
      requireAffordable: opts.requireAffordable || guard > 8,
    });
    guard += 1;
  }
  if (item) return item;

  const affordable = getAffordableShopItems(ctx.playerClass || null, ctx.gold ?? 0, ctx.round ?? 1);
  if (affordable.length) return pickUniformItem(affordable);
  const eligible = getBaseShopPool(ctx.playerClass || null, ctx.round ?? 1);
  return eligible[0]?.id || null;
}

/** Собирает витрину: каждый слот — независимый бросок редкости по таблице BB. */
function rollShopBatch(count, ctx) {
  const slots = [];
  const mods = ctx.shopModifiers;
  let uniquePool = null;
  if (mods?.bonusUnique > 0 && !ctx.bonusUniqueGranted) {
    uniquePool = filterPoolByShopTier(getExpandedShopPool(ctx), "unique");
  }

  for (let i = 0; i < count; i++) {
    if (uniquePool?.length && !ctx.bonusUniqueGranted) {
      slots.push(pickUniqueItem(uniquePool, ctx));
      ctx.bonusUniqueGranted = true;
      continue;
    }
    slots.push(rollShopItemGuaranteed(ctx, {}));
  }
  return slots;
}

function rollShop(count, ctx) {
  return rollShopBatch(count, ctx);
}

/** Веса % для UI (например, тултип баннера магазина). */
function getShopRarityChancesForRound(round = 1, opts = {}) {
  const ctx = {
    round,
    isReroll: !!opts.isReroll,
    hasUniqueInLoadout: !!opts.hasUniqueInLoadout,
  };
  return getBBRarityWeights(ctx);
}

/** @deprecated */
function randomShopItem() {
  return rollShopItem({
    round: 1,
    gold: 12,
    playerClass: null,
    loadoutTags: [],
    loadoutItems: [],
    isReroll: false,
  });
}
