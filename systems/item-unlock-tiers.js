/**
 * Таблица разблокировки предметов по уровню героя (в духе Backpack Brawl).
 * Стартовый пул — явный; остальное — по редкости + слой пула.
 */
const ItemUnlockTiers = (() => {
  const HERO_IDS = ["warrior", "rogue", "mage", "priest"];

  /** Предметы, доступные любому герою с 1-го уровня. */
  const SHARED_STARTER_IDS = new Set([
    "apple", "banana", "garlic", "cheese", "healing_herb", "healing_herbs",
    "bandage", "wooden_sword", "broom", "pan", "lucky_charm", "health_stone",
    "blueberries", "pineapple", "leather_bag", "small_pouch", "utility_pouch",
    "lump_of_coal", "carrot", "chili_pepper",
  ]);

  /** Стартовый пул по герою (уровень 1). */
  const HERO_STARTER_IDS = {
    warrior: new Set([
      "rusty_sword", "iron_helmet", "knight_sword", "iron_shield", "wooden_buckler",
      "hammer", "spear", "star_of_courage", "villain_sword", "hungry_blade",
    ]),
    rogue: new Set([
      "dagger", "poison_vial", "poison_dagger", "smoke_bomb", "thorn_whip",
      "ripsaw_blade", "fly_agaric", "pestilence_flask",
    ]),
    mage: new Set([
      "apprentice_staff", "mana_crystal", "fire_crystal", "snowball", "spark_stone",
      "chipped_sapphire", "chipped_ruby", "chipped_amethyst", "storm_burst",
      "mana_potion",
    ]),
    priest: new Set([
      "divine_potion", "shiny_shell", "shelly", "healing_herb", "healing_herbs",
      "pineapple", "blueberries", "bandage",
    ]),
  };

  const EXPANSION_IDS = new Set(
    typeof ITEM_POOL_120_MANIFEST !== "undefined"
      ? (ITEM_POOL_120_MANIFEST.layers?.expansion_shop || [])
      : [],
  );

  const TIER_BASE_LEVEL = {
    common: 1,
    rare: 4,
    epic: 7,
    legendary: 11,
    godly: 14,
    unique: 16,
  };

  /** itemId → { minLevel, scope: 'shared'|'hero', heroId? } */
  const table = new Map();

  function stableSalt(id) {
    let h = 0;
    const s = String(id || "");
    for (let i = 0; i < s.length; i += 1) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  function isStarterForHero(itemId, heroId) {
    if (SHARED_STARTER_IDS.has(itemId)) return true;
    return HERO_STARTER_IDS[heroId]?.has(itemId) || false;
  }

  function computeMinLevel(item) {
    if (!item?.id) return 20;
    const tier = typeof getItemShopRarityTier === "function"
      ? getItemShopRarityTier(item)
      : "common";
    const base = TIER_BASE_LEVEL[tier] ?? 5;
    const variance = stableSalt(item.id) % 3;
    let level = base + (tier === "common" ? 0 : variance);
    if (EXPANSION_IDS.has(item.id)) level += 2;
    if (item.classRestriction) level = Math.max(2, level - 1);
    return Math.min(20, Math.max(1, level));
  }

  function buildTable() {
    table.clear();
    if (typeof ITEM_CATALOG === "undefined") return;

    Object.values(ITEM_CATALOG).forEach((item) => {
      if (!item?.id) return;
      if (item.craftOnly || item.isEnhancementItem || item.isBuildKey || item.isAmplifierItem) {
        return;
      }
      if (typeof isCraftOutputItemId === "function" && isCraftOutputItemId(item.id)) return;

      let minLevel = computeMinLevel(item);
      let scope = "shared";
      let heroId = null;

      if (item.classRestriction && HERO_IDS.includes(item.classRestriction)) {
        scope = "hero";
        heroId = item.classRestriction;
        if (isStarterForHero(item.id, heroId)) minLevel = 1;
      } else if (SHARED_STARTER_IDS.has(item.id)) {
        minLevel = 1;
      } else {
        const inAnyStarter = HERO_IDS.some((hid) => HERO_STARTER_IDS[hid]?.has(item.id));
        if (inAnyStarter) minLevel = 2;
      }

      table.set(item.id, { minLevel, scope, heroId });
    });
  }

  function getSpec(itemId) {
    return table.get(itemId) || null;
  }

  function getMinLevel(itemId) {
    return getSpec(itemId)?.minLevel ?? 20;
  }

  function listShopItemIdsForHero(heroId) {
    if (typeof ITEM_CATALOG === "undefined") return [];
    return Object.values(ITEM_CATALOG)
      .filter((item) => {
        if (!item?.id) return false;
        if (typeof isShopEligibleItem === "function") {
          return isShopEligibleItem(item, heroId, 16);
        }
        return true;
      })
      .map((item) => item.id);
  }

  buildTable();

  return {
    SHARED_STARTER_IDS,
    HERO_STARTER_IDS,
    getSpec,
    getMinLevel,
    isStarterForHero,
    listShopItemIdsForHero,
    rebuild: buildTable,
  };
})();

window.ItemUnlockTiers = ItemUnlockTiers;
