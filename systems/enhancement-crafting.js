/**
 * PR-B: крафт грудных усилений + ключи веток (unlock_build).
 * @see docs/enhancement-item-set-gdd.md
 */

const BUILD_UNLOCK_CATALOG = {
  triple_pyro_mage: {
    id: "triple_pyro_mage",
    label: "Огненный пиромант",
    mutation: "m_pyro",
    companion: "s_spark",
    enhancementIds: ["enh_ember_crown", "enh_defeated_breastplate", "enh_mad_scholar_sandals"],
    supportItemIds: ["fire_staff", "enh_pyro_steps"],
    craftRecipeIds: ["craft_enh_defeated_breastplate"],
  },
  triple_zrecrela: {
    id: "triple_zrecrela",
    label: "ЖРЕЦИЛА",
    mutation: "p_zrecrela",
    companion: "s_spark",
    enhancementIds: ["enh_hymn_veil", "enh_zealot_vestment", "enh_holy_aegis"],
    supportItemIds: ["armor_holy_choir", "accessory_musical_slippers"],
    craftRecipeIds: ["craft_enh_zealot_vestment"],
  },
  triple_paladin: {
    id: "triple_paladin",
    label: "Паладин",
    mutation: "p_paladin",
    companion: "s_blade",
    enhancementIds: ["enh_paladin_greaves", "enh_defeated_breastplate"],
    supportItemIds: ["weapon_holy_mace", "boots_steadfast"],
    craftRecipeIds: ["craft_enh_paladin_greaves"],
  },
  triple_assassin: {
    id: "triple_assassin",
    label: "Ассасин",
    mutation: "r_assassin",
    companion: "s_shadow",
    enhancementIds: ["enh_assassin_treads", "enh_shadow_hood"],
    supportItemIds: ["dagger", "armor_light_weave"],
    craftRecipeIds: ["craft_enh_plague_bindings"],
  },
};

const KEY_ITEM_CATALOG = {
  key_ember_codex: {
    id: "key_ember_codex",
    name: "Пепельный кодекс",
    icon: "📕",
    color: "#e85d04",
    shape: [[0, 0]],
    rarity: "rare",
    cost: 4,
    tags: ["key", "fire", "enhancement"],
    description: "Открывает ветку «Огненный пиромант»: bias усилений и крафтов в магазине.",
    isBuildKey: true,
    unlockBuild: "triple_pyro_mage",
    metaEffects: [{ type: "unlock_build", build: "triple_pyro_mage", phase: "passive" }],
    buildHints: "Ключ ветки · положите в рюкзак",
  },
  key_hymn_folio: {
    id: "key_hymn_folio",
    name: "Фолиант гимна",
    icon: "📜",
    color: "#d4a72c",
    shape: [[0, 0]],
    rarity: "epic",
    cost: 5,
    tags: ["key", "holy", "musical", "enhancement"],
    description: "Открывает ветку «ЖРЕЦИЛА»: видны рецепты и чаще святые усиления.",
    isBuildKey: true,
    unlockBuild: "triple_zrecrela",
    metaEffects: [{ type: "unlock_build", build: "triple_zrecrela", phase: "passive" }],
    buildHints: "Ключ ветки · положите в рюкзак",
  },
  key_paladin_oath: {
    id: "key_paladin_oath",
    name: "Клятва паладина",
    icon: "⚔️",
    color: "#79c0ff",
    shape: [[0, 0]],
    rarity: "rare",
    cost: 4,
    tags: ["key", "holy", "enhancement"],
    description: "Открывает ветку «Паладин»: bias святых опор и усилений.",
    isBuildKey: true,
    unlockBuild: "triple_paladin",
    metaEffects: [{ type: "unlock_build", build: "triple_paladin", phase: "passive" }],
    buildHints: "Ключ ветки · положите в рюкзак",
  },
  key_shadow_pact: {
    id: "key_shadow_pact",
    name: "Договор тени",
    icon: "🗡️",
    color: "#8b949e",
    shape: [[0, 0]],
    rarity: "rare",
    cost: 4,
    tags: ["key", "poison", "enhancement"],
    description: "Открывает ветку «Ассасин»: чаще ядовитые опоры.",
    isBuildKey: true,
    unlockBuild: "triple_assassin",
    metaEffects: [{ type: "unlock_build", build: "triple_assassin", phase: "passive" }],
    buildHints: "Ключ ветки · положите в рюкзак",
  },
};

const ENHANCEMENT_CRAFT_RECIPES = [
  {
    id: "craft_enh_defeated_breastplate",
    output: "enh_defeated_breastplate",
    inputs: [
      { itemId: "titan_armor", count: 1 },
      { itemId: "holy_armor", count: 1 },
    ],
    enhancementCraft: true,
    requires: {
      minRound: 6,
      minMutationForm: true,
      loadoutTags: ["armor", "holy"],
      recommendedMutation: "p_paladin",
    },
    hint: "R6+ · форма R8 · armor+holy · или мутация Паладин",
  },
  {
    id: "craft_enh_holy_aegis",
    output: "enh_holy_aegis",
    inputs: [
      { itemId: "holy_armor", count: 1 },
      { itemId: "wooden_buckler", count: 1 },
    ],
    enhancementCraft: true,
    requires: {
      minRound: 6,
      minMutationForm: true,
      loadoutTags: ["holy", "armor"],
      recommendedMutation: "p_paladin",
    },
    hint: "Форма R8+ · holy+armor в рюкзаке",
  },
  {
    id: "craft_enh_guardian_mail",
    output: "enh_guardian_mail",
    inputs: [
      { itemId: "leather_armor", count: 1 },
      { itemId: "wooden_buckler", count: 1 },
    ],
    enhancementCraft: true,
    requires: {
      minRound: 6,
      minMutationForm: true,
      loadoutTags: ["armor"],
      recommendedMutation: "w_guardian",
    },
    hint: "Форма R8+ · тег armor",
  },
  {
    id: "craft_enh_zealot_vestment",
    output: "enh_zealot_vestment",
    inputs: [
      { itemId: "holy_armor", count: 1 },
      { itemId: "mana_crystal", count: 1 },
    ],
    enhancementCraft: true,
    requires: {
      minRound: 6,
      minMutationForm: true,
      loadoutTags: ["holy"],
      build: "triple_zrecrela",
      recommendedMutation: "p_zrecrela",
    },
    hint: "Форма R8+ · ключ ЖРЕЦИЛЫ или мутация",
  },
  {
    id: "craft_enh_plague_bindings",
    output: "enh_plague_bindings",
    inputs: [
      { itemId: "pestilence_flask", count: 1 },
      { itemId: "leather_armor", count: 1 },
    ],
    enhancementCraft: true,
    requires: {
      minRound: 6,
      minMutationForm: true,
      loadoutTags: ["poison", "armor"],
      build: "triple_assassin",
      recommendedMutation: "r_assassin",
    },
    hint: "R6+ · яд+броня · ключ ассасина",
  },
  {
    id: "craft_enh_paladin_greaves",
    output: "enh_paladin_greaves",
    inputs: [
      { itemId: "holy_armor", count: 1 },
      { itemId: "leather_boots", count: 1 },
    ],
    enhancementCraft: true,
    requires: {
      minRound: 6,
      minMutationForm: true,
      loadoutTags: ["holy"],
      build: "triple_paladin",
      recommendedMutation: "p_paladin",
    },
    hint: "R6+ · holy · ключ паладина",
  },
  {
    id: "craft_enh_juggernaut_plate",
    output: "enh_juggernaut_plate",
    inputs: [
      { itemId: "titan_armor", count: 1 },
      { itemId: "leather_armor", count: 1 },
    ],
    enhancementCraft: true,
    requires: {
      minRound: 6,
      minMutationForm: true,
      loadoutTags: ["armor"],
      recommendedMutation: "w_juggernaut",
    },
    hint: "R6+ · форма R8 · тяжёлая броня",
  },
  {
    id: "craft_enh_guardian_sabatons",
    output: "enh_guardian_sabatons",
    inputs: [
      { itemId: "leather_armor", count: 1 },
      { itemId: "leather_boots", count: 1 },
    ],
    enhancementCraft: true,
    requires: {
      minRound: 6,
      minMutationForm: true,
      loadoutTags: ["armor"],
      recommendedMutation: "w_guardian",
    },
    hint: "R6+ · форма R8 · страж",
  },
];

const SHOP_KEY_ROLL_CHANCE = 0.1;

function registerKeyItemsInCatalog() {
  if (typeof ITEM_CATALOG === "undefined") return;
  Object.values(KEY_ITEM_CATALOG).forEach((def) => {
    ITEM_CATALOG[def.id] = { ...def };
  });
}

function getEnhancementCraftRecipes() {
  return ENHANCEMENT_CRAFT_RECIPES.slice();
}

function collectUnlockedBuilds(items = []) {
  const builds = new Set();
  if (typeof collectMetaEffectsFromItems !== "function") return builds;
  collectMetaEffectsFromItems(items).forEach((effect) => {
    if (effect.type === "unlock_build" && effect.build) builds.add(effect.build);
  });
  return builds;
}

function hasBuildKeyInLoadout(items = [], buildId) {
  return (items || []).some((item) => {
    const def = ITEM_CATALOG?.[item?.itemId];
    return def?.isBuildKey && def.unlockBuild === buildId;
  });
}

function getCraftContextFromGame(side = "player") {
  const roundNum = typeof round !== "undefined" ? round : 1;
  let loadoutItems = [];
  let mutationFormId = null;
  let mutationId = null;
  if (typeof getSideState === "function") {
    const st = getSideState(side);
    loadoutItems = st.items || [];
  }
  if (side === "enemy") {
    mutationFormId = typeof enemyMutationFormId !== "undefined" ? enemyMutationFormId : null;
    mutationId = typeof enemyMutationId !== "undefined" ? enemyMutationId : null;
  } else {
    mutationFormId = typeof playerMutationFormId !== "undefined" ? playerMutationFormId : null;
    mutationId = typeof playerMutationId !== "undefined" ? playerMutationId : null;
  }
  return {
    round: roundNum,
    loadoutItems,
    mutationFormId,
    mutationId,
    unlockedBuilds: collectUnlockedBuilds(loadoutItems),
  };
}

function isCraftRecipeAvailable(recipe, ctx = {}) {
  if (!recipe?.enhancementCraft) return true;
  const req = recipe.requires || {};
  if ((ctx.round ?? 1) < (req.minRound ?? 6)) return false;

  const tags = typeof collectLoadoutTags === "function"
    ? collectLoadoutTags(ctx.loadoutItems || [])
    : [];
  if (req.loadoutTags?.length && !req.loadoutTags.every((tag) => tags.includes(tag))) {
    return false;
  }

  const unlocked = ctx.unlockedBuilds || collectUnlockedBuilds(ctx.loadoutItems);
  if (req.build && unlocked.has(req.build)) return true;
  if (req.recommendedMutation && ctx.mutationId === req.recommendedMutation) return true;
  if (req.minMutationForm && ctx.mutationFormId) return true;

  return false;
}

function getEnhancementCraftBlockReason(recipe, ctx = {}) {
  if (isCraftRecipeAvailable(recipe, ctx)) return null;
  return recipe.hint || "Рецепт усиления пока недоступен";
}

function getVisibleCraftRecipes(ctx = {}) {
  return (typeof getAllCraftRecipes === "function" ? getAllCraftRecipes() : [])
    .filter((recipe) => isCraftRecipeAvailable(recipe, ctx));
}

function getShopEligibleKeyItems(ctx = {}) {
  const roundNum = ctx.round ?? 1;
  if (roundNum < 4) return [];
  const loadoutItems = ctx.loadoutItems || [];
  return Object.values(KEY_ITEM_CATALOG).filter((def) => {
    if (loadoutItems.some((item) => item?.itemId === def.id)) return false;
    if (hasBuildKeyInLoadout(loadoutItems, def.unlockBuild)) return false;
    return true;
  });
}

function tryRollShopKeyItem(ctx = {}) {
  if ((ctx.round ?? 1) < 4) return null;
  if (Math.random() > SHOP_KEY_ROLL_CHANCE) return null;
  const pool = getShopEligibleKeyItems(ctx);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function scoreEnhancementWithBuildBias(def, ctx = {}) {
  let score = typeof scoreEnhancementShopBias === "function" ? scoreEnhancementShopBias(def, ctx) : 1;
  const unlocked = ctx.unlockedBuilds || collectUnlockedBuilds(ctx.loadoutItems || []);
  unlocked.forEach((buildId) => {
    const spec = BUILD_UNLOCK_CATALOG[buildId];
    if (spec?.enhancementIds?.includes(def.id)) score += 2;
  });
  return score;
}

function collectPrepBuildKeyIconChips(items = []) {
  const unlocked = collectUnlockedBuilds(items);
  const keys = (items || []).filter((item) => ITEM_CATALOG[item?.itemId]?.isBuildKey);
  const chips = [];

  keys.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    const spec = BUILD_UNLOCK_CATALOG[def?.unlockBuild];
    const label = spec?.label || def?.unlockBuild || def?.name;
    chips.push({
      icon: def?.icon || "🔑",
      tipTitle: def?.name || "Ключ ветки",
      tipLines: [`ветка «${label}»`, def?.description || ""].filter(Boolean),
      active: true,
      kind: "key",
      ariaLabel: `${def?.name || "Ключ"}: ветка «${label}»`,
    });
  });

  [...unlocked]
    .filter((buildId) => !keys.some((item) => ITEM_CATALOG[item.itemId]?.unlockBuild === buildId))
    .forEach((buildId) => {
      const spec = BUILD_UNLOCK_CATALOG[buildId];
      chips.push({
        icon: "🗝️",
        tipTitle: spec?.label || buildId,
        tipLines: ["Ветка открыта", "bias магазина / крафта"],
        active: true,
        kind: "key",
        ariaLabel: `${spec?.label || buildId}: bias магазина/крафта`,
      });
    });

  return chips;
}

function renderPrepBuildKeyStatusHtml(items = []) {
  const chips = collectPrepBuildKeyIconChips(items);
  if (!chips.length) return "";
  const chipsHtml = chips.map((chip) => (
    typeof renderPrepModIconChipHtml === "function"
      ? renderPrepModIconChipHtml(chip)
      : `${chip.icon}`
  )).join("");
  return `
    <div class="prep-modifier-strip prep-modifier-strip--key prep-modifier-strip--icons" aria-label="Ключи веток">
      <div class="prep-modifier-chips prep-modifier-chips--icons">${chipsHtml}</div>
    </div>
  `;
}

function scoreTripleSupportShopBias(item, ctx = {}) {
  if (!item?.recommendedTriple) return 0;
  return typeof scoreShopItemPickWeight === "function"
    ? scoreShopItemPickWeight(item, ctx) - 1
    : 0;
}

function registerEnhancementCraftingAssets() {
  registerKeyItemsInCatalog();
  if (typeof registerEnhancementItemsInCatalog === "function") {
    registerEnhancementItemsInCatalog();
  }
}

registerEnhancementCraftingAssets();
