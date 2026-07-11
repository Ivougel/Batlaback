/**
 * Мета-эффекты предметов вне боя: магазин, золото, слоты.
 * Источник: item.metaEffects[] из каталога (колонка «Триггеры» в CSV).
 */
import type { MetaEffect, PrepShopSideState, ShopPoolModifiers } from "../types/game";

type LoadoutItem = { uid: string; itemId: string };

const CHIPPED_GEM_IDS = [
  "chipped_ruby", "chipped_sapphire", "chipped_emerald", "chipped_topaz", "chipped_amethyst",
];

const FLAME_ITEM_IDS = ["burning_coal", "lump_of_coal", "burning_torch", "flame_badge"];

const SHOP_CLASS_OFFERS: Record<string, { tags?: string[]; classes?: string[]; allClasses?: boolean }> = {
  ranger: { tags: ["ranger"], classes: ["rogue"] },
  reaper: { tags: ["reaper"], classes: [] },
  berserker: { tags: ["berserker"], classes: ["warrior"] },
  pyromancer: { tags: ["pyromancer"], classes: [] },
  mage: { tags: ["magic"], classes: ["mage"] },
  adventurer: { tags: ["treasure"], classes: [] },
  pet: { tags: ["pet"], classes: [] },
  gem: { tags: ["gem"], classes: [] },
  card: { tags: ["card"], classes: [] },
  fire: { tags: ["fire"], classes: [] },
  all: { allClasses: true },
};

function collectMetaEffectsFromItems(items: LoadoutItem[] = []): MetaEffect[] {
  const out: MetaEffect[] = [];
  (items || []).forEach((item) => {
    const def = ITEM_CATALOG[item?.itemId] as { metaEffects?: MetaEffect[]; name?: string } | undefined;
    if (!def?.metaEffects?.length) return;
    def.metaEffects.forEach((effect) => {
      out.push({
        ...effect,
        sourceItemId: item.itemId,
        sourceUid: item.uid,
        sourceName: typeof getItemDisplayName === "function" ? getItemDisplayName(def) : def.name,
      });
    });
  });
  return out;
}

function filterMetaEffects(effects: MetaEffect[], phase: string): MetaEffect[] {
  return (effects || []).filter((e) => e.phase === phase);
}

function collectShopPoolModifiers(items: LoadoutItem[] = []): ShopPoolModifiers {
  const mods: ShopPoolModifiers = {
    offerTags: new Set(),
    offerClasses: new Set(),
    excludePlayerClass: false,
    uniqueChanceBonus: 0,
    bonusUnique: 0,
    sellBonusPct: 0,
    startingValue: 0,
  };

  collectMetaEffectsFromItems(items).forEach((effect) => {
    if (effect.phase !== "shop_pool" && effect.phase !== "passive") return;
    switch (effect.type) {
      case "offer_tag": {
        const spec = SHOP_CLASS_OFFERS[effect.tag as keyof typeof SHOP_CLASS_OFFERS] || { tags: [effect.tag as string] };
        (spec.tags || []).forEach((t) => mods.offerTags.add(t));
        (spec.classes || []).forEach((c) => mods.offerClasses.add(c));
        if (spec.allClasses) mods.offerClasses.add("__all__");
        break;
      }
      case "offer_class": {
        const spec = SHOP_CLASS_OFFERS[effect.classId as keyof typeof SHOP_CLASS_OFFERS] || {};
        (spec.tags || []).forEach((t) => mods.offerTags.add(t));
        (spec.classes || []).forEach((c) => mods.offerClasses.add(c));
        if (effect.classId === "all" || spec.allClasses) mods.offerClasses.add("__all__");
        break;
      }
      case "exclude_player_class":
        mods.excludePlayerClass = true;
        break;
      case "unique_chance_bonus":
        mods.uniqueChanceBonus += Number(effect.value) || 0;
        break;
      case "bonus_unique":
        mods.bonusUnique += Number(effect.value) || 0;
        break;
      case "sell_bonus":
        mods.sellBonusPct += Number(effect.value) || 0;
        break;
      case "starting_value":
        mods.startingValue += Number(effect.value) || 0;
        break;
      default:
        break;
    }
  });

  return mods;
}

function itemMatchesShopModifiers(item: { classRestriction?: string; tags?: string[] }, mods: ShopPoolModifiers): boolean {
  if (!mods || !item) return false;
  if (mods.offerClasses.has("__all__") && item.classRestriction) return true;
  if (item.classRestriction && mods.offerClasses.has(item.classRestriction)) return true;
  if (item.tags?.some((t) => mods.offerTags.has(t))) return true;
  return false;
}

function isItemExcludedByShopModifiers(
  item: { id?: string; classRestriction?: string },
  ctx: { shopModifiers?: ShopPoolModifiers; playerClass?: string },
): boolean {
  if (!ctx?.shopModifiers?.excludePlayerClass || !ctx.playerClass) return false;
  if (item.classRestriction === ctx.playerClass) return true;
  const starter = typeof CLASS_CATALOG !== "undefined"
    ? CLASS_CATALOG[ctx.playerClass]?.starterItems
    : null;
  return Array.isArray(starter) && starter.includes(item.id);
}

function applyGainGoldMeta(
  sideState: Pick<PrepShopSideState, "gold">,
  effect: MetaEffect,
  logFn?: (msg: string) => void,
): number {
  const amount = Math.max(0, Number(effect.value) || 0);
  if (!amount) return 0;
  sideState.gold += amount;
  if (typeof logFn === "function") {
    logFn(`💰 ${effect.sourceName}: +${amount} золота`);
  }
  return amount;
}

function pickRandomId(ids: string[] | null | undefined): string | null {
  if (!ids?.length) return null;
  return ids[Math.floor(Math.random() * ids.length)];
}

function addItemToBenchOrShop(
  st: PrepShopSideState,
  itemId: string,
  ctx: object,
  logFn?: (msg: string) => void,
  sourceName?: string,
): boolean {
  if (!itemId || !st) return false;
  const def = ITEM_CATALOG[itemId];
  if (!def) return false;

  if (st.bench.length < 8) {
    st.bench.push({
      itemId,
      uid: `meta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    });
    if (typeof logFn === "function") {
      logFn(`🎁 ${sourceName}: получен ${typeof getItemDisplayName === "function" ? getItemDisplayName(def) : def.name}`);
    }
    return true;
  }

  const emptySlot = st.shop.findIndex((id, i) => !id && !st.shopFrozen[i]);
  if (emptySlot >= 0) {
    st.shop[emptySlot] = itemId;
    if (typeof logFn === "function") {
      logFn(`🛒 ${sourceName}: в магазине появился ${typeof getItemDisplayName === "function" ? getItemDisplayName(def) : def.name}`);
    }
    return true;
  }
  return false;
}

function rollCheapShopItem(ctx: { playerClass?: string; round?: number }, maxCost = 3): string | null {
  const pool = typeof getBaseShopPool === "function"
    ? getBaseShopPool(ctx.playerClass, ctx.round).filter((i) => (i.cost ?? 0) <= maxCost && !i.craftOnly && !(typeof isCraftOutputItemId === "function" && isCraftOutputItemId(i.id)))
    : [];
  return pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null;
}

function countHighRarityItems(items: LoadoutItem[] = []): number {
  let n = 0;
  items.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    const tier = typeof getItemShopRarityTier === "function" ? getItemShopRarityTier(def) : def?.rarity;
    if (["legendary", "godly", "unique"].includes(tier)) n += 1;
  });
  return n;
}

const POTION_UPGRADE_MAP = {
  health_potion: "strong_health_potion",
  strong_health_potion: "strong_health_potion",
  mana_potion: "strong_mana_potion",
  strong_mana_potion: "strong_mana_potion",
  heroic_potion: "strong_heroic_potion",
  vampiric_potion: "strong_vampiric_potion",
};

function getItemGoldCost(itemId: string): number {
  const def = ITEM_CATALOG[itemId];
  return Math.max(0, Number(def?.cost) || 0);
}

function canConsumeInRecombo(itemId: string): boolean {
  const def = ITEM_CATALOG[itemId] as { isContainer?: boolean; protected?: boolean; craftOnly?: boolean } | undefined;
  if (!def || def.isContainer || def.protected || def.craftOnly) return false;
  return true;
}

function getContainersHostingItem(containers: LoadoutItem[], item: LoadoutItem): LoadoutItem[] {
  if (!item || typeof getItemCells !== "function") return [];
  const cells = new Set(getItemCells(item).map(([c, r]: [number, number]) => `${c},${r}`));
  return (containers || []).filter((container) =>
    getItemCells(container).some(([c, r]: [number, number]) => cells.has(`${c},${r}`)),
  );
}

function getItemsFullyInsideContainer(container: LoadoutItem, items: LoadoutItem[]): LoadoutItem[] {
  const slotSet = new Set(getItemCells(container).map(([c, r]: [number, number]) => `${c},${r}`));
  return (items || []).filter((item) => {
    const cells = getItemCells(item);
    return cells.length > 0 && cells.every(([c, r]: [number, number]) => slotSet.has(`${c},${r}`));
  });
}

function collectRecomboVictims(
  items: LoadoutItem[],
  containers: LoadoutItem[],
  sourceItem: LoadoutItem,
  target = "self",
): LoadoutItem[] {
  if (!sourceItem) return [];
  const mode = String(target || "self").toLowerCase();

  if (mode === "inside") {
    const hosts = getContainersHostingItem(containers, sourceItem);
    const victimMap = new Map();
    hosts.forEach((container) => {
      getItemsFullyInsideContainer(container, items).forEach((item) => {
        if (item.uid === sourceItem.uid) return;
        if (canConsumeInRecombo(item.itemId)) victimMap.set(item.uid, item);
      });
    });
    return [...victimMap.values()];
  }

  const victims = new Map();
  if (canConsumeInRecombo(sourceItem.itemId)) victims.set(sourceItem.uid, sourceItem);
  if (typeof getAdjacentItems === "function") {
    getAdjacentItems(items, sourceItem).forEach((entry) => {
      const adj = entry.item as LoadoutItem;
      if (canConsumeInRecombo(adj.itemId)) victims.set(adj.uid, adj);
    });
  }
  return [...victims.values()];
}

function rollRecomboRewardIds(totalCost: number, ctx: { playerClass?: string; round?: number }): string[] {
  const budget = Math.max(0, Math.floor(Number(totalCost) || 0));
  if (budget <= 0) return [];

  const pool = (typeof getExpandedShopPool === "function"
    ? getExpandedShopPool(ctx)
    : (typeof getBaseShopPool === "function" ? getBaseShopPool(ctx.playerClass, ctx.round) : []))
    .filter((item) => item && !item.craftOnly && getItemGoldCost(item.id) > 0);

  if (!pool.length) return [];

  const rewards = [];
  let remaining = budget;
  let guard = 0;
  while (remaining > 0 && guard < 16) {
    guard += 1;
    const candidates = pool.filter((item) => getItemGoldCost(item.id) <= remaining);
    if (!candidates.length) break;
    const maxCost = Math.max(...candidates.map((item) => getItemGoldCost(item.id)));
    const top = candidates.filter((item) => getItemGoldCost(item.id) >= maxCost * 0.8);
    const pick = top[Math.floor(Math.random() * top.length)];
    rewards.push(pick.id);
    remaining -= getItemGoldCost(pick.id);
  }
  return rewards;
}

function placeRecomboReward(
  st: PrepShopSideState,
  itemId: string,
  ctx: object,
  logFn?: (msg: string) => void,
  sourceName?: string,
): boolean {
  const def = ITEM_CATALOG[itemId];
  if (!def || !st) return false;

  if (typeof findLoadoutItemPlacement === "function" && typeof createPlacedItem === "function") {
    const placement = findLoadoutItemPlacement(st.containers || [], st.items, itemId, 0);
    if (placement) {
      st.items.push(createPlacedItem(itemId, placement.col, placement.row, placement.rotation));
      if (typeof logFn === "function") {
        const label = typeof getItemDisplayName === "function" ? getItemDisplayName(def) : def.name;
        logFn(`🎰 ${sourceName}: получен ${label}`);
      }
      return true;
    }
  }

  return addItemToBenchOrShop(st, itemId, ctx, logFn, sourceName);
}

function logRecomboFeed(text: string, mergeKey?: string): void {
  if (typeof CombatLog?.addEvent !== "function") return;
  CombatLog.addEvent({
    type: "craft",
    text,
    mergeKey: mergeKey || text,
    icon: "🎰",
  });
}

function applyConsumeRecombo(
  st: PrepShopSideState,
  effect: MetaEffect,
  ctx: object,
  logFn?: (msg: string) => void,
  consumedUids?: Set<string>,
): boolean {
  if (!st || !effect?.sourceUid) return false;
  const consumed = consumedUids || new Set<string>();
  const source = (st.items as LoadoutItem[]).find((item) => item.uid === effect.sourceUid);
  if (!source || consumed.has(source.uid)) return false;

  const target = effect.target || "self";
  let victims = collectRecomboVictims(st.items as LoadoutItem[], (st.containers || []) as LoadoutItem[], source, target);
  victims = victims.filter((item) => !consumed.has(item.uid));

  if (target === "inside" && !victims.length) {
    if (typeof logFn === "function") {
      logFn(`🎰 ${effect.sourceName}: в сумке нечего перекомбинировать`);
    }
    return false;
  }
  if (!victims.length) return false;

  const totalCost = victims.reduce((sum, item) => sum + getItemGoldCost(item.itemId), 0);
  if (totalCost <= 0) return false;

  const rewardIds = rollRecomboRewardIds(totalCost, ctx);
  if (!rewardIds.length) {
    if (typeof logFn === "function") {
      logFn(`🎰 ${effect.sourceName}: не удалось создать предмет (${totalCost}💰)`);
    }
    return false;
  }

  const consumedNames = victims
    .map((item) => (typeof getItemDisplayName === "function"
      ? getItemDisplayName(ITEM_CATALOG[item.itemId])
      : ITEM_CATALOG[item.itemId]?.name))
    .filter(Boolean);
  const removeSet = new Set(victims.map((item) => item.uid));
  st.items = (st.items as LoadoutItem[]).filter((item) => !removeSet.has(item.uid));
  victims.forEach((item) => consumed.add(item.uid));

  const rewardNames = rewardIds
    .map((id) => (typeof getItemDisplayName === "function"
      ? getItemDisplayName(ITEM_CATALOG[id])
      : ITEM_CATALOG[id]?.name))
    .filter(Boolean);

  if (typeof logFn === "function") {
    logFn(`🔄 ${effect.sourceName}: ${consumedNames.join(", ")} (${totalCost}💰) → ${rewardNames.join(", ")}`);
  }
  logRecomboFeed(
    `Перекомбинация: ${consumedNames.join(", ")} → ${rewardNames.join(", ")} (${totalCost}💰)`,
    `recombo:${effect.sourceUid}:${(ctx as { round?: number }).round}:${rewardIds.join("+")}`,
  );

  rewardIds.forEach((itemId) => {
    placeRecomboReward(st, itemId, ctx, logFn, effect.sourceName);
  });
  return true;
}

function applyShopEnterMeta(side: string, items: LoadoutItem[], logFn?: (msg: string) => void): boolean {
  const st = typeof getSideState === "function" ? getSideState(side) : null;
  if (!st) return false;
  const ctx = typeof getShopContextForSide === "function" ? getShopContextForSide(side) : { round: 1 };
  const consumedUids = new Set<string>();
  let loadoutChanged = false;

  filterMetaEffects(collectMetaEffectsFromItems(items), "shop_enter").forEach((effect) => {
    switch (effect.type) {
      case "gain_gold":
        applyGainGoldMeta(st, effect, logFn);
        break;
      case "dig_item": {
        const id = typeof rollShopItemGuaranteed === "function"
          ? rollShopItemGuaranteed(ctx)
          : rollCheapShopItem(ctx, 12);
        if (id) addItemToBenchOrShop(st, id, ctx, logFn, effect.sourceName);
        break;
      }
      case "gain_buff":
        st.pendingShopBuffs = (st.pendingShopBuffs || 0) + (Number(effect.value) || 1);
        if (typeof logFn === "function") {
          logFn(`✨ ${effect.sourceName}: +${effect.value || 1} бафф к началу боя`);
        }
        break;
      case "generate_gem":
      case "gem_if_godly":
        break;
      case "generate_flame": {
        const chance = Number(effect.chance) || 0.65;
        if (st.gold >= 1 && Math.random() < chance) {
          st.gold -= 1;
          const flameId = pickRandomId(FLAME_ITEM_IDS);
          if (flameId) addItemToBenchOrShop(st, flameId, ctx, logFn, effect.sourceName);
        }
        break;
      }
      case "generate_worth": {
        const cheapId = rollCheapShopItem(ctx, 2);
        if (cheapId) addItemToBenchOrShop(st, cheapId, ctx, logFn, effect.sourceName);
        break;
      }
      case "items_not_gold":
        st._shopItemsNotGold = true;
        if (typeof logFn === "function") {
          logFn(`🎁 ${effect.sourceName}: вместо золота — предметы большей ценности`);
        }
        break;
      case "upgrade_adjacent_potion": {
        const potionIdx = st.bench.findIndex((b) => (ITEM_CATALOG[b.itemId] as { tags?: string[] } | undefined)?.tags?.includes("potion"));
        if (potionIdx >= 0) {
          const curId = st.bench[potionIdx].itemId;
          const upgraded = (POTION_UPGRADE_MAP as Record<string, string>)[curId] || curId;
          if (upgraded !== curId) {
            st.bench[potionIdx].itemId = upgraded;
            const def = ITEM_CATALOG[upgraded];
            if (typeof logFn === "function" && def) {
              logFn(`🧪 ${effect.sourceName}: ${typeof getItemDisplayName === "function" ? getItemDisplayName(def) : def.name}`);
            }
          } else if (typeof logFn === "function") {
            logFn(`🧪 ${effect.sourceName}: зелье уже максимального уровня`);
          }
        }
        break;
      }
      case "consume_recombo":
        if (applyConsumeRecombo(st, effect, ctx, logFn, consumedUids)) loadoutChanged = true;
        break;
      case "consume_inside_flame":
        if (typeof logFn === "function") {
          logFn(`🔥 ${effect.sourceName}: содержимое превращено в пламя`);
        }
        break;
      default:
        break;
    }
  });

  return loadoutChanged;
}

function pickHigherTierItemId(itemId: string, ctx: object): string {
  if (typeof upgradeShopItemToHigherTier !== "function") return itemId;
  return upgradeShopItemToHigherTier(itemId, ctx) || itemId;
}

function applyShopRefreshMeta(
  side: string,
  items: LoadoutItem[],
  refreshedIndices: number[],
  shopState: { shop: Array<string | null>; shopFrozen: boolean[] },
  ctx: object,
  logFn?: (msg: string) => void,
): void {
  const st = typeof getSideState === "function" ? getSideState(side) : null;
  if (!st || !shopState?.shop) return;

  const effects = filterMetaEffects(collectMetaEffectsFromItems(items), "shop_refresh");
  if (!effects.length) return;

  const refreshed = refreshedIndices.filter((i) => shopState.shop[i]);
  if (!refreshed.length) return;

  effects.forEach((effect) => {
    if (effect.type === "rarity_up") {
      const count = Math.max(1, Number(effect.value) || 1);
      for (let n = 0; n < count; n += 1) {
        const idx = refreshed[Math.floor(Math.random() * refreshed.length)];
        const before = shopState.shop[idx];
        if (!before) continue;
        const after = pickHigherTierItemId(before, ctx);
        if (after && after !== before) {
          shopState.shop[idx] = after;
          const def = ITEM_CATALOG[after];
          if (typeof logFn === "function") {
            logFn(`💳 ${effect.sourceName}: повышена редкость → ${typeof getItemDisplayName === "function" ? getItemDisplayName(def) : def.name}`);
          }
        }
      }
    }
    if (effect.type === "trade_offer") {
      const chance = Number(effect.chance);
      const roll = Number.isFinite(chance) ? chance : 0.1;
      if (Math.random() < roll) {
        const bonus = Math.max(1, Number(effect.value) || 3);
        st.gold += bonus;
        if (typeof logFn === "function") {
          logFn(`🤝 ${effect.sourceName}: торговое предложение (+${bonus}💰)`);
        }
      }
    }
  });
}

function applyShopBuyMeta(
  side: string,
  loadoutItems: LoadoutItem[],
  boughtItemId: string,
  shopState: { shop: Array<string | null>; shopFrozen: boolean[] },
  ctx: { playerClass?: string; round?: number },
  logFn?: (msg: string) => void,
): void {
  const bought = ITEM_CATALOG[boughtItemId];
  if (!bought) return;

  filterMetaEffects(collectMetaEffectsFromItems(loadoutItems), "shop_buy").forEach((effect) => {
    const chance = Number(effect.chance) || 0;
    if (Math.random() >= chance) return;

    if (effect.type === "restock_tag" && effect.tag && bought.tags?.includes(effect.tag)) {
      const tag = effect.tag;
      const pool = typeof getExpandedShopPool === "function"
        ? getExpandedShopPool(ctx)
        : (typeof getBaseShopPool === "function" ? getBaseShopPool(ctx.playerClass, ctx.round) : []);
      const match = pool.filter((i) => i.tags?.includes(tag) && i.id !== boughtItemId);
      const restockId = match.length ? match[Math.floor(Math.random() * match.length)].id : boughtItemId;
      const empty = shopState.shop.findIndex((id, i) => !id && !shopState.shopFrozen[i]);
      if (empty >= 0) {
        shopState.shop[empty] = restockId;
        const def = ITEM_CATALOG[restockId];
        if (typeof logFn === "function") {
          logFn(`🧵 ${effect.sourceName}: пополнение → ${typeof getItemDisplayName === "function" ? getItemDisplayName(def) : def.name}`);
        }
      }
    }

    if (effect.type === "restock_bag" && bought.isContainer) {
      const empty = shopState.shop.findIndex((id, i) => !id && !shopState.shopFrozen[i]);
      if (empty >= 0) {
        shopState.shop[empty] = boughtItemId;
        if (typeof logFn === "function") {
          logFn(`🧩 ${effect.sourceName}: в магазине снова ${typeof getItemDisplayName === "function" ? getItemDisplayName(bought) : bought.name}`);
        }
      }
    }
  });
}

function getSellBonusMultiplier(items: LoadoutItem[] = []): number {
  let bonus = 0;
  collectMetaEffectsFromItems(items).forEach((effect) => {
    if (effect.type === "sell_bonus") bonus += Number(effect.value) || 0;
  });
  return 1 + bonus;
}

function getStarredChanceBonusFromItems(items: LoadoutItem[] = []): number {
  let bonus = 0;
  collectMetaEffectsFromItems(items).forEach((effect) => {
    if (effect.type === "starred_chance_bonus") {
      bonus += Number(effect.value) || 0;
    }
  });
  return bonus;
}

function getStartingValueBonus(items: LoadoutItem[] = []): number {
  return collectShopPoolModifiers(items).startingValue || 0;
}

function applyRoundGoldWithShopMeta(
  side: string,
  baseGold: number,
  items: LoadoutItem[],
  logFn?: (msg: string) => void,
): number {
  const st = typeof getSideState === "function" ? getSideState(side) : null;
  if (!st) return baseGold;

  if (st._shopItemsNotGold) {
    const ctx = typeof getShopContextForSide === "function" ? getShopContextForSide(side) : {};
    const itemId = rollCheapShopItem(ctx, 6) || rollCheapShopItem(ctx, 12);
    if (itemId) {
      addItemToBenchOrShop(st, itemId, ctx, logFn, "Подарок");
      if (typeof logFn === "function") {
        logFn(`🎁 Подарок: предмет вместо части золота за раунд`);
      }
      return Math.max(0, Math.floor(baseGold * 0.5));
    }
  }
  return baseGold;
}
