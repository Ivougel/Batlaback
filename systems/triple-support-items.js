// Transpiled from TypeScript — npm run compile:ts

const TRIPLE_SUPPORT_PATCHES = {
  fire_staff: {
    recommendedTriple: "triple_pyro_mage",
    buildHints: "\u041E\u043F\u043E\u0440\u0430 \xB7 \u041E\u0433\u043D\u0435\u043D\u043D\u044B\u0439 \u043F\u0438\u0440\u043E\u043C\u0430\u043D\u0442 \xB7 \u043F\u043E\u0441\u043E\u0445 \u0432\u0435\u0442\u043A\u0438"
  },
  dagger: {
    recommendedTriple: "triple_assassin",
    buildHints: "\u041E\u043F\u043E\u0440\u0430 \xB7 \u0410\u0441\u0441\u0430\u0441\u0438\u043D \xB7 \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0439 \u043A\u043B\u0438\u043D\u043E\u043A \u0432\u0435\u0442\u043A\u0438"
  }
};
const TRIPLE_SUPPORT_CATALOG = {
  weapon_holy_mace: {
    id: "weapon_holy_mace",
    name: "\u0421\u0432\u044F\u0442\u043E\u0439 \u043C\u043E\u043B\u043E\u0442",
    icon: "\u{1F528}\u2728",
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
      { type: "statMult", stat: "damage", value: 0.04, trigger: "passive" }
    ],
    description: "\u0421\u0432\u044F\u0442\u043E\u0439 \u0443\u0434\u0430\u0440. \u0412 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F: +20 \u0431\u043B\u043E\u043A\u0430. +4% \u0443\u0440\u043E\u043D\u0430.",
    buildHints: "\u041E\u043F\u043E\u0440\u0430 \xB7 \u041F\u0430\u043B\u0430\u0434\u0438\u043D \xB7 \u043C\u043E\u043B\u043E\u0442 \u0432\u0435\u0442\u043A\u0438"
  },
  armor_holy_choir: {
    id: "armor_holy_choir",
    name: "\u0425\u043E\u0440\u043E\u0432\u0430\u044F \u043A\u0438\u0440\u0430\u0441\u0430",
    icon: "\u{1F9BA}\u{1F3B5}",
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
      { type: "statMult", stat: "cooldown", value: -0.03, trigger: "passive" }
    ],
    description: "\u0421\u0432\u044F\u0442\u0430\u044F \u0431\u0440\u043E\u043D\u044F \u0445\u043E\u0440\u0430. \u041A\u0430\u0436\u0434\u044B\u0435 3\u0441: +3 HP. \u22123% \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0430.",
    buildHints: "\u041E\u043F\u043E\u0440\u0430 \xB7 \u0416\u0420\u0415\u0426\u0418\u041B\u0410 \xB7 \u0433\u0440\u0443\u0434\u044C \u0432\u0435\u0442\u043A\u0438",
    sockets: 1
  },
  accessory_musical_slippers: {
    id: "accessory_musical_slippers",
    name: "\u041C\u0443\u0437\u044B\u043A\u0430\u043B\u044C\u043D\u044B\u0435 \u0442\u0443\u0444\u043B\u0438",
    icon: "\u{1F45E}\u{1F3B5}",
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
      { type: "gainStack", stack: "empower", value: 1, trigger: "battle_start" }
    ],
    description: "\u22123.5% \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0430. \u0412 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F: +1 \u0443\u0441\u0438\u043B\u0435\u043D\u0438\u0435.",
    buildHints: "\u041E\u043F\u043E\u0440\u0430 \xB7 \u0416\u0420\u0415\u0426\u0418\u041B\u0410 \xB7 \u0431\u043E\u0442\u0438\u043D\u043A\u0438 \u0432\u0435\u0442\u043A\u0438"
  },
  boots_steadfast: {
    id: "boots_steadfast",
    name: "\u0421\u0442\u043E\u0439\u043A\u0438\u0435 \u0441\u0430\u043F\u043E\u0433\u0438",
    icon: "\u{1F97E}",
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
      { type: "gainStack", stack: "block", value: 35, trigger: "battle_start" }
    ],
    description: "\u0412 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F: +35 \u0431\u043B\u043E\u043A\u0430. +3% \u043C\u0430\u043A\u0441. HP.",
    buildHints: "\u041E\u043F\u043E\u0440\u0430 \xB7 \u041F\u0430\u043B\u0430\u0434\u0438\u043D \xB7 \u0441\u0430\u043F\u043E\u0433\u0438 \u0432\u0435\u0442\u043A\u0438"
  },
  armor_light_weave: {
    id: "armor_light_weave",
    name: "\u041B\u0451\u0433\u043A\u0438\u0439 \u043F\u043B\u0435\u0442\u0451\u043D\u044B\u0439 \u0434\u043E\u0441\u043F\u0435\u0445",
    icon: "\u{1F94B}",
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
      { type: "statMult", stat: "damage", value: 0.035, trigger: "passive" }
    ],
    description: "+3.5% \u0443\u0440\u043E\u043D\u0430. 25% \u0448\u0430\u043D\u0441 \u044F\u0434\u0430 \u043F\u0440\u0438 \u0443\u0434\u0430\u0440\u0435.",
    buildHints: "\u041E\u043F\u043E\u0440\u0430 \xB7 \u0410\u0441\u0441\u0430\u0441\u0438\u043D \xB7 \u043B\u0451\u0433\u043A\u0430\u044F \u0431\u0440\u043E\u043D\u044F"
  }
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
      staminaCost: raw.staminaCost
    });
  }
  return {
    ...raw,
    slot: typeof resolveItemSlot === "function" ? resolveItemSlot(raw) : raw.slot || null,
    stats: {
      damage: raw.damage ?? 0,
      defense: raw.defense ?? 0,
      maxHp: raw.maxHp ?? 0
    },
    isContainer: false,
    craftOnly: false,
    metaEffects: raw.metaEffects ?? []
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
  const unlocked = ctx.unlockedBuilds || (typeof collectUnlockedBuilds === "function" ? collectUnlockedBuilds(ctx.loadoutItems || []) : /* @__PURE__ */ new Set());
  if (unlocked.has(buildId)) weight += 2.5;
  const spec = getTripleBuildSpec(buildId);
  if (spec && ctx.mutationId && spec.mutation === ctx.mutationId) weight += 1.25;
  if (spec && ctx.companionId && spec.companion === ctx.companionId) weight += 0.75;
  const tags = ctx.loadoutTags || [];
  if (item.tags?.some((t) => tags.includes(t))) weight += 0.5;
  return weight;
}
function listTripleSupportItems(filters = {}) {
  const patched = Object.keys(TRIPLE_SUPPORT_PATCHES).map((id) => ITEM_CATALOG?.[id]).filter(Boolean);
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
