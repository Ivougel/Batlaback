/**
 * Слоты усилений (голова / грудь / ботинки) — отдельно от рюкзака и манекена.
 * Предметы усилений: ENHANCEMENT_CATALOG + tools/enhancement-items-blueprint.json
 * @see docs/enhancement-item-set-gdd.md
 */

const ENHANCEMENT_SLOT_ORDER = ["head", "chest", "boots"];

const ENHANCEMENT_SLOT_META = {
  head: { label: "Голова", icon: "👤", unlockRound: 2, role: "стиль / ось" },
  chest: { label: "Грудь", icon: "🦺", unlockRound: 6, role: "выживание" },
  boots: { label: "Ботинки", icon: "👢", unlockRound: 11, role: "темп / капстоун" },
};

const ENHANCEMENT_SHOP_PREFIX = "enh:";
const ENHANCEMENT_SHOP_COST_BY_RARITY = {
  common: 3,
  rare: 5,
  epic: 7,
  legendary: 9,
};
const SHOP_ENHANCEMENT_ROLL_CHANCE = 0.22;

/** Активные в игре (implemented: true). Остальное — чертёж под будущий каталог. */
const ENHANCEMENT_CATALOG = {
  enh_stray_charm: {
    id: "enh_stray_charm",
    name: "Оберег странника",
    icon: "🐣",
    slot: "head",
    families: ["utility"],
    rarity: "common",
    implemented: true,
    acquisition: ["shop"],
    recommendedMutations: ["w_veteran", "r_rogue", "m_sage", "p_hermit"],
    desc: "+1% all · усиливает путь универсала",
    combat: { allMult: 0.01 },
  },
  enh_ember_crown: {
    id: "enh_ember_crown",
    name: "Пепельная корона",
    icon: "👑",
    slot: "head",
    families: ["fire", "magic"],
    rarity: "rare",
    implemented: true,
    acquisition: ["shop", "key"],
    recommendedMutations: ["m_pyro", "p_inquisitor"],
    desc: "+3% магия · огненная ось",
    combat: { magicDamageMult: 0.03 },
  },
  enh_hymn_veil: {
    id: "enh_hymn_veil",
    name: "Вуаль гимна",
    icon: "🎵",
    slot: "head",
    families: ["holy", "musical"],
    rarity: "epic",
    implemented: true,
    acquisition: ["shop", "craft"],
    recommendedMutations: ["p_zrecrela", "r_bard"],
    desc: "−3% перезарядка · путь к ЖРЕЦИЛЕ",
    combat: { cooldownMult: -0.03 },
  },
  enh_defeated_breastplate: {
    id: "enh_defeated_breastplate",
    name: "Кираса побеждённого",
    icon: "🛡️",
    slot: "chest",
    families: ["armor", "holy"],
    rarity: "legendary",
    implemented: true,
    acquisition: ["shop", "craft"],
    recommendedMutations: ["w_guardian", "p_paladin"],
    desc: "+8 HP · танк / паладин",
    combat: { maxHp: 8 },
  },
  enh_holy_aegis: {
    id: "enh_holy_aegis",
    name: "Святая эгида",
    icon: "✨",
    slot: "chest",
    families: ["holy", "armor"],
    rarity: "epic",
    implemented: true,
    acquisition: ["craft"],
    recommendedMutations: ["p_paladin", "p_zrecrela"],
    desc: "+6 HP · святая грудная опора",
    combat: { maxHp: 6 },
  },
  enh_guardian_mail: {
    id: "enh_guardian_mail",
    name: "Кольчуга стража",
    icon: "⛓️",
    slot: "chest",
    families: ["armor"],
    rarity: "rare",
    implemented: true,
    acquisition: ["craft"],
    recommendedMutations: ["w_guardian", "w_veteran"],
    desc: "+5 HP · базовая грудная броня",
    combat: { maxHp: 5 },
  },
  enh_zealot_vestment: {
    id: "enh_zealot_vestment",
    name: "Ряса ревнителя",
    icon: "📿",
    slot: "chest",
    families: ["holy", "heal"],
    rarity: "epic",
    implemented: true,
    acquisition: ["craft"],
    recommendedMutations: ["p_zrecrela", "p_inquisitor"],
    desc: "+4 HP · +1% all · путь к ЖРЕЦИЛЕ",
    combat: { maxHp: 4, allMult: 0.01 },
  },
  enh_mad_scholar_sandals: {
    id: "enh_mad_scholar_sandals",
    name: "Сандалии сумасшедшего учёного",
    icon: "👡",
    slot: "boots",
    families: ["speed", "magic", "luck"],
    rarity: "legendary",
    implemented: true,
    acquisition: ["shop", "key"],
    recommendedMutations: ["m_chaos", "m_pyro"],
    desc: "−4% перезарядка · хаотичный учёный",
    combat: { cooldownMult: -0.04 },
  },
  enh_assassin_treads: {
    id: "enh_assassin_treads",
    name: "Шаги клинка",
    icon: "🥾",
    slot: "boots",
    families: ["poison", "melee"],
    rarity: "epic",
    implemented: true,
    acquisition: ["shop"],
    recommendedMutations: ["r_assassin", "r_shadow"],
    desc: "+3.5% урон · ассасин",
    combat: { damageMult: 0.035 },
  },
};

function createEmptyEnhancementLoadout() {
  return { head: null, chest: null, boots: null };
}

function getEnhancementDef(id) {
  return id ? ENHANCEMENT_CATALOG[id] || null : null;
}

function getEnhancementItemDef(enhDef) {
  if (!enhDef?.implemented) return null;
  const slotLabel = ENHANCEMENT_SLOT_META[enhDef.slot]?.label || enhDef.slot;
  const shopOnly = (enhDef.acquisition || []).includes("shop");
  const craftOnly = (enhDef.acquisition || []).includes("craft") && !shopOnly;
  return {
    id: enhDef.id,
    name: enhDef.name,
    icon: enhDef.icon,
    color: "#8b6fcf",
    shape: [[0, 0]],
    rarity: enhDef.rarity,
    cost: getEnhancementShopCost(enhDef),
    tags: [...(enhDef.families || []), "enhancement"],
    cooldown: 0,
    description: enhDef.desc || "",
    craftOnly,
    isEnhancementItem: true,
    enhancementId: enhDef.id,
    enhancementSlot: enhDef.slot,
    buildHints: craftOnly
      ? `Усиление · ${slotLabel} · только крафт`
      : `Усиление · ${slotLabel} · положите в рюкзак`,
  };
}

function registerEnhancementItemsInCatalog() {
  if (typeof ITEM_CATALOG === "undefined") return;
  Object.values(ENHANCEMENT_CATALOG).forEach((enhDef) => {
    const itemDef = getEnhancementItemDef(enhDef);
    if (itemDef) ITEM_CATALOG[itemDef.id] = itemDef;
  });
}

function isEnhancementBackpackItem(itemId) {
  const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[itemId] : null;
  return !!(def?.isEnhancementItem || ENHANCEMENT_CATALOG[itemId]?.implemented);
}

function getEnhancementIdFromItem(itemId) {
  const def = ITEM_CATALOG[itemId];
  if (def?.enhancementId) return def.enhancementId;
  if (ENHANCEMENT_CATALOG[itemId]) return itemId;
  return null;
}

function getEnhancementPlacementBlockReason(itemId, items = [], excludeUid = null, roundNum = null) {
  const enhId = getEnhancementIdFromItem(itemId);
  if (!enhId) return null;
  const enhDef = getEnhancementDef(enhId);
  if (!enhDef) return null;
  const r = roundNum ?? (typeof round !== "undefined" ? round : 1);
  const slotId = enhDef.slot;
  const slotLabel = ENHANCEMENT_SLOT_META[slotId]?.label || slotId;
  if (!isEnhancementSlotUnlocked(slotId, r)) {
    return `Усиление «${slotLabel}» доступно с раунда ${getEnhancementSlotUnlockRound(slotId)}`;
  }
  const exclude = new Set();
  if (excludeUid) exclude.add(excludeUid);
  const duplicate = (items || []).some((item) => {
    if (exclude.has(item.uid)) return false;
    const otherId = getEnhancementIdFromItem(item.itemId);
    if (!otherId) return false;
    return getEnhancementDef(otherId)?.slot === slotId;
  });
  if (duplicate) return `В рюкзаке уже есть усиление для «${slotLabel}»`;
  return null;
}

function canPlaceEnhancementItemInLoadout(itemId, items = [], excludeUid = null, roundNum = null) {
  return !getEnhancementPlacementBlockReason(itemId, items, excludeUid, roundNum);
}

/** Активные усиления = предметы 1×1 в рюкзаке (нет клетки — нет усиления). */
function syncEnhancementsFromBackpack(items = [], enhancements = {}, roundNum = 1) {
  ENHANCEMENT_SLOT_ORDER.forEach((slotId) => {
    enhancements[slotId] = null;
  });
  (items || []).forEach((item) => {
    const enhId = getEnhancementIdFromItem(item.itemId);
    if (!enhId) return;
    const enhDef = getEnhancementDef(enhId);
    if (!enhDef?.implemented) return;
    if (!isEnhancementSlotUnlocked(enhDef.slot, roundNum)) return;
    if (enhancements[enhDef.slot]) return;
    enhancements[enhDef.slot] = enhId;
  });
  return enhancements;
}

function toEnhancementShopId(enhancementId) {
  return enhancementId ? `${ENHANCEMENT_SHOP_PREFIX}${enhancementId}` : null;
}

function parseEnhancementShopId(shopEntryId) {
  if (!shopEntryId || !String(shopEntryId).startsWith(ENHANCEMENT_SHOP_PREFIX)) return null;
  return String(shopEntryId).slice(ENHANCEMENT_SHOP_PREFIX.length) || null;
}

function isEnhancementShopEntry(shopEntryId) {
  if (parseEnhancementShopId(shopEntryId)) return true;
  return !!(typeof ITEM_CATALOG !== "undefined" && ITEM_CATALOG[shopEntryId]?.isEnhancementItem);
}

function getEnhancementShopCost(def) {
  if (!def) return 0;
  if (def.cost != null) return def.cost;
  return ENHANCEMENT_SHOP_COST_BY_RARITY[def.rarity] || 4;
}

function getEnhancementSellRefund(def) {
  return getEnhancementShopCost(def);
}

function resolveShopEntryMeta(shopEntryId) {
  const legacyId = parseEnhancementShopId(shopEntryId);
  if (legacyId) {
    const def = getEnhancementDef(legacyId);
    if (def?.implemented) {
      return { kind: "enhancement", def, entryId: legacyId, cost: getEnhancementShopCost(def) };
    }
  }
  const itemDef = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[shopEntryId] : null;
  if (itemDef?.isEnhancementItem) {
    const def = getEnhancementDef(itemDef.enhancementId || shopEntryId) || itemDef;
    return {
      kind: "enhancement",
      def,
      entryId: shopEntryId,
      cost: itemDef.cost ?? getEnhancementShopCost(def),
    };
  }
  if (!itemDef) return null;
  return { kind: "item", def: itemDef, entryId: shopEntryId, cost: itemDef.cost ?? 0 };
}

function getShopEligibleEnhancements(ctx = {}) {
  const round = ctx.round ?? 1;
  const loadoutItems = ctx.loadoutItems || [];
  return Object.values(ENHANCEMENT_CATALOG).filter((def) => {
    if (!def.implemented) return false;
    if (!(def.acquisition || []).includes("shop")) return false;
    if (!isEnhancementSlotUnlocked(def.slot, round)) return false;
    const inBag = loadoutItems.some((item) => getEnhancementIdFromItem(item?.itemId) === def.id);
    if (inBag) return false;
    return true;
  });
}

function scoreEnhancementShopBias(def, ctx = {}) {
  let score = 1;
  const mutationId = ctx.mutationId || ctx.mutationFormId;
  if (mutationId && (def.recommendedMutations || []).includes(mutationId)) score += 1.5;
  if (ctx.companionId && (def.recommendedMutations || []).some((m) => String(m).startsWith(String(ctx.companionId).slice(0, 2)))) {
    score += 0.25;
  }
  return score;
}

function pickWeightedEnhancement(pool, ctx = {}) {
  if (!pool.length) return null;
  const weights = pool.map((def) => {
    if (typeof scoreEnhancementWithBuildBias === "function") {
      return scoreEnhancementWithBuildBias(def, ctx);
    }
    return scoreEnhancementShopBias(def, ctx);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function rollShopEnhancementEntry(ctx = {}) {
  const pool = getShopEligibleEnhancements(ctx);
  if (!pool.length) return null;
  const picked = pickWeightedEnhancement(pool, ctx);
  return picked ? picked.id : null;
}

function tryRollShopEnhancement(ctx = {}) {
  if ((ctx.round ?? 1) < 2) return null;
  if (Math.random() > SHOP_ENHANCEMENT_ROLL_CHANCE) return null;
  return rollShopEnhancementEntry(ctx);
}

function isEnhancementSlotUnlocked(slotId, round = 1) {
  const meta = ENHANCEMENT_SLOT_META[slotId];
  return (round || 1) >= (meta?.unlockRound || 99);
}

function getEnhancementSlotUnlockRound(slotId) {
  return ENHANCEMENT_SLOT_META[slotId]?.unlockRound || 99;
}

function canEquipEnhancementInSlot(enhancementId, slotId, round = 1) {
  const def = getEnhancementDef(enhancementId);
  if (!def || !def.implemented) return false;
  if (def.slot !== slotId) return false;
  if (!isEnhancementSlotUnlocked(slotId, round)) return false;
  return true;
}

function applyEnhancementTagsToCounts(tagCounts, enhancements = {}) {
  if (!tagCounts || !enhancements) return tagCounts;
  ENHANCEMENT_SLOT_ORDER.forEach((slotId) => {
    const def = getEnhancementDef(enhancements[slotId]);
    if (!def?.implemented) return;
    (def.families || []).forEach((family) => {
      tagCounts[family] = (tagCounts[family] || 0) + 2;
    });
  });
  return tagCounts;
}

function applyEnhancementCombatBonus(side, enhancements = {}) {
  if (!side) return;
  side.enhancementIds = ENHANCEMENT_SLOT_ORDER
    .map((slot) => enhancements[slot])
    .filter(Boolean);
  ENHANCEMENT_SLOT_ORDER.forEach((slotId) => {
    const def = getEnhancementDef(enhancements[slotId]);
    if (!def?.implemented || !def.combat) return;
    const b = def.combat;
    if (b.allMult) {
      side.damageMult *= 1 + b.allMult;
      side.magicDamageMult *= 1 + b.allMult;
    }
    if (b.damageMult) side.damageMult *= 1 + b.damageMult;
    if (b.magicDamageMult) side.magicDamageMult *= 1 + b.magicDamageMult;
    if (b.cooldownMult) side.cooldownMult *= 1 + b.cooldownMult;
    if (b.maxHp) {
      side.maxHp += Number(b.maxHp) || 0;
      side.hp = Math.min(side.maxHp, (side.hp || 0) + (Number(b.maxHp) || 0));
    }
  });
}

function equipEnhancementInLoadout(enhancements, enhancementId, round = 1, options = {}) {
  const def = getEnhancementDef(enhancementId);
  if (!def?.implemented) return { ok: false, reason: "invalid" };
  const slotId = def.slot;
  if (!canEquipEnhancementInSlot(enhancementId, slotId, round)) return { ok: false, reason: "locked" };
  const replaced = enhancements[slotId] || null;
  if (replaced && !options.replace) return { ok: false, reason: "occupied", slotId };
  enhancements[slotId] = enhancementId;
  return { ok: true, slotId, replaced };
}

function unequipEnhancementFromLoadout(enhancements, slotId) {
  const prev = enhancements[slotId] || null;
  enhancements[slotId] = null;
  return prev;
}

function applyEnhancementRunModifiers(side, prepMeta = {}) {
  applyEnhancementCombatBonus(side, prepMeta.enhancements);
}

function getEquippedEnhancementSummary(enhancements = {}) {
  return ENHANCEMENT_SLOT_ORDER.map((slotId) => {
    const id = enhancements[slotId];
    const def = getEnhancementDef(id);
    return {
      slotId,
      id,
      def,
      label: ENHANCEMENT_SLOT_META[slotId]?.label || slotId,
      unlockRound: getEnhancementSlotUnlockRound(slotId),
    };
  });
}

function escapeEnhancementHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function renderPrepEnhancementStripHtml(round, enhancements = {}, options = {}) {
  const heroCard = !!options.heroCard;
  const slots = getEquippedEnhancementSummary(enhancements);
  const cells = slots.map((slot) => {
    const unlocked = isEnhancementSlotUnlocked(slot.slotId, round);
    const def = slot.def;
    const title = unlocked
      ? (def
        ? `${def.name}: ${def.desc || ""} · активно, пока лежит в рюкзаке`
        : `${slot.label} — положите усиление 1×1 в рюкзак`)
      : `Откроется на раунде ${slot.unlockRound}`;
    const icon = def?.icon || ENHANCEMENT_SLOT_META[slot.slotId]?.icon || "◻️";
    const slotLabel = heroCard ? String(slot.label).toUpperCase() : slot.label;
    let nameHtml = "";
    if (def?.name) {
      nameHtml = `<span class="enh-slot-name">${escapeEnhancementHtml(def.name)}</span>`;
    } else if (!unlocked) {
      nameHtml = `<span class="enh-slot-name">${escapeEnhancementHtml(`R${slot.unlockRound}`)}</span>`;
    } else if (!heroCard) {
      nameHtml = `<span class="enh-slot-name">Пусто</span>`;
    }
    const stateClass = !unlocked
      ? "enh-slot--locked"
      : def
        ? "enh-slot--filled"
        : "enh-slot--empty";
    return `
      <div class="enh-slot ${stateClass}" data-enh-slot="${slot.slotId}" data-enh-id="${def?.id || ""}" title="${escapeEnhancementHtml(title)}">
        <span class="enh-slot-kicker">${escapeEnhancementHtml(slotLabel)}</span>
        <span class="enh-slot-icon" aria-hidden="true">${icon}</span>
        ${nameHtml}
      </div>
    `;
  }).join("");

  const stripClass = heroCard
    ? "prep-enhancement-strip prep-enhancement-strip--hero-card"
    : "prep-enhancement-strip";

  return `
    <div class="${stripClass}" id="prep-enhancement-strip" aria-label="Слоты усилений">
      <span class="prep-enhancement-eyebrow">Усиления</span>
      <div class="prep-enhancement-slots">${cells}</div>
    </div>
  `;
}

function buildEnhancementTooltipLines(def, context = "shop") {
  const lines = [];
  const slotLabel = ENHANCEMENT_SLOT_META[def.slot]?.label || def.slot;
  const rarityColor = typeof RARITY_COLORS !== "undefined" ? (RARITY_COLORS[def.rarity] || "#e6edf3") : "#e6edf3";
  lines.push({
    text: `${def.icon} ${def.name}`,
    style: "title",
    color: rarityColor,
  });
  lines.push({
    text: `Усиление · ${slotLabel}`,
    style: "sub",
    color: "#8b949e",
  });
  if (def.desc) {
    lines.push({ text: def.desc, style: "normal", color: "#c9d1d9" });
  }
  if ((def.families || []).length) {
    lines.push({
      text: `Семейства: ${def.families.join(", ")} (+2 к мутации)`,
      style: "normal",
      color: "#79c0ff",
    });
  }
  const cost = getEnhancementShopCost(def);
  if (context === "shop") {
    lines.push({
      text: `${cost}💰 · положите 1×1 в рюкзак (нет места — нет усиления)`,
      style: "normal",
      color: "#f0c14b",
    });
  } else if (context === "enhancement") {
    lines.push({
      text: `Продажа: ${getEnhancementSellRefund(def)}💰`,
      style: "normal",
      color: "#f0c14b",
    });
  }
  return lines;
}

function renderEnhancementShopCardHTML(def, { extraClasses = "", innerBefore = "", dataAttrs = "" } = {}) {
  const cost = getEnhancementShopCost(def);
  const rarityColor = typeof getRarityNameColor === "function"
    ? getRarityNameColor(def.rarity)
    : "#c9d1d9";
  const classes = typeof getRarityCardClasses === "function"
    ? getRarityCardClasses(def.rarity, ["shop-card", "shop-card--enhancement", extraClasses].filter(Boolean).join(" "))
    : `shop-card shop-card--enhancement ${extraClasses}`.trim();
  return `<div class="${classes}"${dataAttrs ? ` ${dataAttrs}` : ""} style="--shop-rarity-color:${rarityColor}">
    ${innerBefore}
    <div class="shop-item-main">
      <div class="shop-item-stack shop-item-stack--enhancement">
        <div class="shop-item-visual">
          <div class="item-icon-shell item-icon-shell--enhancement" style="background:rgba(120,90,200,0.25)">
            <span class="enh-shop-icon" aria-hidden="true">${def.icon}</span>
          </div>
        </div>
        <div class="shop-item-side-meta">
          <div class="cost shop-item-cost" aria-label="Цена ${cost}"><span class="cost-value">${cost}</span><span class="cost-coin" aria-hidden="true">💰</span></div>
          <div class="enh-shop-slot-tag">${escapeEnhancementHtml(ENHANCEMENT_SLOT_META[def.slot]?.label || def.slot)}</div>
        </div>
      </div>
    </div>
  </div>`;
}

/** Список чертежей по классу и мутации. */
function listEnhancementBlueprints(filters = {}) {
  return Object.values(ENHANCEMENT_CATALOG).filter((def) => {
    if (filters.implementedOnly && !def.implemented) return false;
    if (filters.slot && def.slot !== filters.slot) return false;
    if (filters.mutationId && !(def.recommendedMutations || []).includes(filters.mutationId)) return false;
    return true;
  });
}

registerEnhancementItemsInCatalog();
