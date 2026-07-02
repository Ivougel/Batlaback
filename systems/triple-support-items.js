/**
 * PR-D: легендарные опоры под флагманские тройки + bias магазина.
 * @see tools/enhancement-items-blueprint.json
 */

const TRIPLE_SUPPORT_PATCHES = {
  fire_staff: {
    recommendedTriple: "triple_pyro_mage",
    buildHints: "Опора · Огненный пиромант · посох ветки",
  },
  dagger: {
    recommendedTriple: "triple_assassin",
    buildHints: "Опора · Ассасин · стартовый клинок ветки",
  },
};

const TRIPLE_SUPPORT_CATALOG = {
  weapon_holy_mace: {
    id: "weapon_holy_mace",
    name: "Святой молот",
    icon: "🔨✨",
    color: "#f0c14b",
    shape: [[0, 0], [0, 1]],
    classRestriction: "priest",
    rarity: "godly",
    cost: 13,
    tags: ["weapon", "holy", "melee"],
    damage: 9,
    cooldown: 2.4,
    staminaCost: 14,
    recommendedTriple: "triple_paladin",
    effects: [
      { type: "damage", value: 9, valueMin: 5, valueMax: 10, damageType: "holy" },
      { type: "gainStack", stack: "block", value: 20, trigger: "battle_start" },
      { type: "statMult", stat: "damage", value: 0.04, trigger: "passive" },
    ],
    description: "Святой удар. В начале боя: +20 блока. +4% урона.",
    buildHints: "Опора · Паладин · молот ветки",
  },
  armor_holy_choir: {
    id: "armor_holy_choir",
    name: "Хоровая кираса",
    icon: "🦺🎵",
    color: "#d4a72c",
    shape: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]],
    classRestriction: "priest",
    rarity: "legendary",
    cost: 11,
    tags: ["armor", "holy", "musical"],
    defense: 3,
    cooldown: 2.5,
    recommendedTriple: "triple_zrecrela",
    effects: [
      { type: "passiveDefense", value: 3, trigger: "passive" },
      { type: "heal", value: 3, trigger: "periodic", interval: 3 },
      { type: "statMult", stat: "cooldown", value: -0.03, trigger: "passive" },
    ],
    description: "Святая броня хора. Каждые 3с: +3 HP. −3% перезарядка.",
    buildHints: "Опора · ЖРЕЦИЛА · грудь ветки",
    sockets: 1,
  },
  accessory_musical_slippers: {
    id: "accessory_musical_slippers",
    name: "Музыкальные туфли",
    icon: "👞🎵",
    color: "#bc8cff",
    shape: [[0, 0]],
    classRestriction: "priest",
    rarity: "epic",
    cost: 7,
    tags: ["shoes", "musical", "holy", "accessory"],
    cooldown: 0,
    recommendedTriple: "triple_zrecrela",
    effects: [
      { type: "statMult", stat: "cooldown", value: -0.035, trigger: "passive" },
      { type: "gainStack", stack: "empower", value: 1, trigger: "battle_start" },
    ],
    description: "−3.5% перезарядка. В начале боя: +1 усиление.",
    buildHints: "Опора · ЖРЕЦИЛА · ботинки ветки",
  },
  boots_steadfast: {
    id: "boots_steadfast",
    name: "Стойкие сапоги",
    icon: "🥾",
    color: "#79c0ff",
    shape: [[0, 0], [1, 0]],
    classRestriction: "priest",
    rarity: "legendary",
    cost: 9,
    tags: ["shoes", "armor", "holy"],
    defense: 2,
    cooldown: 0,
    recommendedTriple: "triple_paladin",
    effects: [
      { type: "passiveDefense", value: 2, trigger: "passive" },
      { type: "gainStack", stack: "block", value: 35, trigger: "battle_start" },
    ],
    description: "В начале боя: +35 блока. +3% макс. HP.",
    buildHints: "Опора · Паладин · сапоги ветки",
  },
  armor_light_weave: {
    id: "armor_light_weave",
    name: "Лёгкий плетёный доспех",
    icon: "🥋",
    color: "#8b949e",
    shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
    classRestriction: "rogue",
    rarity: "epic",
    cost: 8,
    tags: ["armor", "poison", "melee"],
    defense: 2,
    cooldown: 0,
    recommendedTriple: "triple_assassin",
    effects: [
      { type: "passiveDefense", value: 2, trigger: "passive" },
      { type: "statMult", stat: "damage", value: 0.035, trigger: "passive" },
    ],
    description: "+3.5% урона. 25% шанс яда при ударе.",
    buildHints: "Опора · Ассасин · лёгкая броня",
  },
};

function normalizeTripleSupportItemDef(raw) {
  if (typeof defItem === "function") {
    return defItem({
      ...raw,
      shape: raw.shape,
      tags: raw.tags,
      effects: raw.effects,
      description: raw.description,
      buildHints: raw.buildHints,
      sockets: raw.sockets,
      damage: raw.damage,
      defense: raw.defense,
      staminaCost: raw.staminaCost,
    });
  }
  return {
    ...raw,
    slot: typeof resolveItemSlot === "function" ? resolveItemSlot(raw) : raw.slot || null,
    stats: {
      damage: raw.damage ?? 0,
      defense: raw.defense ?? 0,
      maxHp: raw.maxHp ?? 0,
    },
    isContainer: false,
    craftOnly: false,
    metaEffects: raw.metaEffects ?? [],
    synergies: raw.synergies ?? [],
  };
}

function registerTripleSupportItems() {
  if (typeof ITEM_CATALOG === "undefined") return;
  Object.values(TRIPLE_SUPPORT_CATALOG).forEach((raw) => {
    const def = normalizeTripleSupportItemDef(raw);
    def.recommendedTriple = raw.recommendedTriple;
    ITEM_CATALOG[def.id] = def;
  });
}

function patchTripleSupportMetadata() {
  if (typeof ITEM_CATALOG === "undefined") return;
  Object.entries(TRIPLE_SUPPORT_PATCHES).forEach(([itemId, patch]) => {
    const def = ITEM_CATALOG[itemId];
    if (!def) return;
    Object.assign(def, patch);
  });
}

function getTripleBuildSpec(buildId) {
  if (typeof BUILD_UNLOCK_CATALOG !== "undefined" && BUILD_UNLOCK_CATALOG[buildId]) {
    return BUILD_UNLOCK_CATALOG[buildId];
  }
  return null;
}

function scoreShopItemPickWeight(item, ctx = {}) {
  let weight = 1;
  if (!item?.recommendedTriple) return weight;

  const buildId = item.recommendedTriple;
  const unlocked = ctx.unlockedBuilds || (typeof collectUnlockedBuilds === "function"
    ? collectUnlockedBuilds(ctx.loadoutItems || [])
    : new Set());

  if (unlocked.has(buildId)) weight += 2.5;

  const spec = getTripleBuildSpec(buildId);
  if (spec && ctx.mutationId && spec.mutation === ctx.mutationId) weight += 1.25;
  if (spec && ctx.companionId && spec.companion === ctx.companionId) weight += 0.75;

  const tags = ctx.loadoutTags || [];
  if (item.tags?.some((t) => tags.includes(t))) weight += 0.5;

  return weight;
}

function listTripleSupportItems(filters = {}) {
  const patched = Object.keys(TRIPLE_SUPPORT_PATCHES)
    .map((id) => ITEM_CATALOG?.[id])
    .filter(Boolean);
  const created = Object.values(TRIPLE_SUPPORT_CATALOG);
  return [...created, ...patched].filter((def) => {
    if (filters.tripleId && def.recommendedTriple !== filters.tripleId) return false;
    return true;
  });
}

function registerTripleSupportAssets() {
  registerTripleSupportItems();
  patchTripleSupportMetadata();
}

registerTripleSupportAssets();
