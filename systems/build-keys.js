// Transpiled from TypeScript — npm run compile:ts

function getBuildKeyPlayerDescription(buildId) {
  const spec = BUILD_UNLOCK_CATALOG[buildId];
  const label = spec?.label || buildId;
  switch (buildId) {
    case "triple_pyro_mage":
      return `\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0432\u0435\u0442\u043A\u0443 \xAB${label}\xBB: \u0447\u0430\u0449\u0435 \u043E\u0433\u043D\u0435\u043D\u043D\u044B\u0435 \u043E\u043F\u043E\u0440\u044B \u0438 \u0440\u0435\u0446\u0435\u043F\u0442\u044B \u0432 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0435.`;
    case "triple_zrecrela":
      return `\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0432\u0435\u0442\u043A\u0443 \xAB${label}\xBB: \u0432\u0438\u0434\u043D\u044B \u0440\u0435\u0446\u0435\u043F\u0442\u044B \u0438 \u0447\u0430\u0449\u0435 \u0441\u0432\u044F\u0442\u044B\u0435 \u043E\u043F\u043E\u0440\u044B.`;
    case "triple_paladin":
      return `\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0432\u0435\u0442\u043A\u0443 \xAB${label}\xBB: \u0447\u0430\u0449\u0435 \u0441\u0432\u044F\u0442\u044B\u0435 \u043E\u043F\u043E\u0440\u044B \u0432\u0435\u0442\u043A\u0438.`;
    case "triple_assassin":
      return `\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0432\u0435\u0442\u043A\u0443 \xAB${label}\xBB: \u0447\u0430\u0449\u0435 \u044F\u0434\u043E\u0432\u0438\u0442\u044B\u0435 \u043E\u043F\u043E\u0440\u044B.`;
    default:
      return `\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0432\u0435\u0442\u043A\u0443 \xAB${label}\xBB: \u0447\u0430\u0449\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u044D\u0442\u043E\u0439 \u0432\u0435\u0442\u043A\u0438 \u0432 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0435.`;
  }
}
const BUILD_UNLOCK_CATALOG = {
  triple_pyro_mage: {
    id: "triple_pyro_mage",
    label: "\u041E\u0433\u043D\u0435\u043D\u043D\u044B\u0439 \u043F\u0438\u0440\u043E\u043C\u0430\u043D\u0442",
    mutation: "m_pyro",
    companion: "s_spark",
    supportItemIds: ["fire_staff"]
  },
  triple_zrecrela: {
    id: "triple_zrecrela",
    label: "\u0416\u0420\u0415\u0426\u0418\u041B\u0410",
    mutation: "p_zrecrela",
    companion: "s_spark",
    supportItemIds: ["armor_holy_choir", "accessory_musical_slippers"]
  },
  triple_paladin: {
    id: "triple_paladin",
    label: "\u041F\u0430\u043B\u0430\u0434\u0438\u043D",
    mutation: "p_paladin",
    companion: "s_blade",
    supportItemIds: ["weapon_holy_mace", "boots_steadfast"]
  },
  triple_assassin: {
    id: "triple_assassin",
    label: "\u0410\u0441\u0441\u0430\u0441\u0438\u043D",
    mutation: "r_assassin",
    companion: "s_shadow",
    supportItemIds: ["dagger", "armor_light_weave"]
  }
};
const KEY_ITEM_CATALOG = {
  key_ember_codex: {
    id: "key_ember_codex",
    name: "\u041F\u0435\u043F\u0435\u043B\u044C\u043D\u044B\u0439 \u043A\u043E\u0434\u0435\u043A\u0441",
    icon: "\u{1F4D5}",
    color: "#e85d04",
    shape: [[0, 0]],
    rarity: "rare",
    cost: 4,
    tags: ["key", "fire"],
    description: getBuildKeyPlayerDescription("triple_pyro_mage"),
    isBuildKey: true,
    unlockBuild: "triple_pyro_mage",
    metaEffects: [{ type: "unlock_build", build: "triple_pyro_mage", phase: "passive" }],
    buildHints: "\u041A\u043B\u044E\u0447 \u0432\u0435\u0442\u043A\u0438 \xB7 \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435 \u0432 \u0440\u044E\u043A\u0437\u0430\u043A"
  },
  key_hymn_folio: {
    id: "key_hymn_folio",
    name: "\u0424\u043E\u043B\u0438\u0430\u043D\u0442 \u0433\u0438\u043C\u043D\u0430",
    icon: "\u{1F4DC}",
    color: "#d4a72c",
    shape: [[0, 0]],
    rarity: "epic",
    cost: 5,
    tags: ["key", "holy", "musical"],
    description: getBuildKeyPlayerDescription("triple_zrecrela"),
    isBuildKey: true,
    unlockBuild: "triple_zrecrela",
    metaEffects: [{ type: "unlock_build", build: "triple_zrecrela", phase: "passive" }],
    buildHints: "\u041A\u043B\u044E\u0447 \u0432\u0435\u0442\u043A\u0438 \xB7 \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435 \u0432 \u0440\u044E\u043A\u0437\u0430\u043A"
  },
  key_paladin_oath: {
    id: "key_paladin_oath",
    name: "\u041A\u043B\u044F\u0442\u0432\u0430 \u043F\u0430\u043B\u0430\u0434\u0438\u043D\u0430",
    icon: "\u2694\uFE0F",
    color: "#79c0ff",
    shape: [[0, 0]],
    rarity: "rare",
    cost: 4,
    tags: ["key", "holy"],
    description: getBuildKeyPlayerDescription("triple_paladin"),
    isBuildKey: true,
    unlockBuild: "triple_paladin",
    metaEffects: [{ type: "unlock_build", build: "triple_paladin", phase: "passive" }],
    buildHints: "\u041A\u043B\u044E\u0447 \u0432\u0435\u0442\u043A\u0438 \xB7 \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435 \u0432 \u0440\u044E\u043A\u0437\u0430\u043A"
  },
  key_shadow_pact: {
    id: "key_shadow_pact",
    name: "\u0414\u043E\u0433\u043E\u0432\u043E\u0440 \u0442\u0435\u043D\u0438",
    icon: "\u{1F5E1}\uFE0F",
    color: "#8b949e",
    shape: [[0, 0]],
    rarity: "rare",
    cost: 4,
    tags: ["key", "poison"],
    description: getBuildKeyPlayerDescription("triple_assassin"),
    isBuildKey: true,
    unlockBuild: "triple_assassin",
    metaEffects: [{ type: "unlock_build", build: "triple_assassin", phase: "passive" }],
    buildHints: "\u041A\u043B\u044E\u0447 \u0432\u0435\u0442\u043A\u0438 \xB7 \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435 \u0432 \u0440\u044E\u043A\u0437\u0430\u043A"
  }
};
const SHOP_KEY_ROLL_CHANCE = 0.1;
function registerKeyItemsInCatalog() {
  if (typeof ITEM_CATALOG === "undefined") return;
  Object.values(KEY_ITEM_CATALOG).forEach((def) => {
    ITEM_CATALOG[def.id] = { ...def };
  });
}
function collectUnlockedBuilds(items = []) {
  const builds = /* @__PURE__ */ new Set();
  if (typeof collectMetaEffectsFromItems !== "function") return builds;
  collectMetaEffectsFromItems(items).forEach((effect) => {
    if (effect.type === "unlock_build" && effect.build) builds.add(effect.build);
  });
  return builds;
}
function hasBuildKeyInLoadout(items = [], buildId) {
  return (items || []).some((item) => {
    const def = item?.itemId ? ITEM_CATALOG[item.itemId] : void 0;
    return def?.isBuildKey && def.unlockBuild === buildId;
  });
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
function collectPrepBuildKeyIconChips(items = []) {
  const unlocked = collectUnlockedBuilds(items);
  const keys = (items || []).filter((item) => ITEM_CATALOG[item?.itemId]?.isBuildKey);
  const chips = [];
  keys.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    const spec = BUILD_UNLOCK_CATALOG[def?.unlockBuild];
    const label = spec?.label || def?.unlockBuild || def?.name;
    chips.push({
      icon: def?.icon || "\u{1F511}",
      tipTitle: def?.name || "\u041A\u043B\u044E\u0447 \u0432\u0435\u0442\u043A\u0438",
      tipLines: [`\u0432\u0435\u0442\u043A\u0430 \xAB${label}\xBB`, def?.description || ""].filter(Boolean),
      active: true,
      kind: "key",
      ariaLabel: `${def?.name || "\u041A\u043B\u044E\u0447"}: \u0432\u0435\u0442\u043A\u0430 \xAB${label}\xBB`
    });
  });
  [...unlocked].filter((buildId) => !keys.some((item) => ITEM_CATALOG[item.itemId]?.unlockBuild === buildId)).forEach((buildId) => {
    const spec = BUILD_UNLOCK_CATALOG[buildId];
    chips.push({
      icon: "\u{1F5DD}\uFE0F",
      tipTitle: spec?.label || buildId,
      tipLines: ["\u0412\u0435\u0442\u043A\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u0430", "\u0412 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0435 \u0447\u0430\u0449\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u044D\u0442\u043E\u0439 \u0432\u0435\u0442\u043A\u0438"],
      active: true,
      kind: "key",
      ariaLabel: `${spec?.label || buildId}: \u0432\u0435\u0442\u043A\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u0430`
    });
  });
  return chips;
}
function renderPrepBuildKeyStatusHtml(items = []) {
  const chips = collectPrepBuildKeyIconChips(items);
  if (!chips.length) return "";
  const chipsHtml = chips.map((chip) => typeof renderPrepModIconChipHtml === "function" ? renderPrepModIconChipHtml(chip) : `${chip.icon}`).join("");
  return `
    <div class="prep-modifier-strip prep-modifier-strip--key prep-modifier-strip--icons" aria-label="\u041A\u043B\u044E\u0447\u0438 \u0432\u0435\u0442\u043E\u043A">
      <div class="prep-modifier-chips prep-modifier-chips--icons">${chipsHtml}</div>
    </div>
  `;
}
function scoreTripleSupportShopBias(item, ctx = {}) {
  if (!item?.recommendedTriple) return 0;
  return typeof scoreShopItemPickWeight === "function" ? scoreShopItemPickWeight(item, ctx) - 1 : 0;
}
registerKeyItemsInCatalog();
