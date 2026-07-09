/**
 * PR-C: усилители рюкзака — 1×1 предметы с подсветкой связанных клеток в prep.
 * amplifySlot | amplifyFamily | amplifyEquip
 * @see docs/enhancement-item-set-gdd.md
 */

const AMPLIFIER_FAMILY_COLORS = {
  fire: { stroke: "rgba(255, 140, 60, 0.7)", fill: "rgba(255, 100, 40, 0.14)", glow: "#ff8c3c" },
  holy: { stroke: "rgba(255, 220, 120, 0.75)", fill: "rgba(255, 210, 90, 0.14)", glow: "#ffd966" },
  poison: { stroke: "rgba(120, 220, 100, 0.7)", fill: "rgba(80, 200, 90, 0.12)", glow: "#6fdc7a" },
  magic: { stroke: "rgba(140, 180, 255, 0.75)", fill: "rgba(100, 150, 255, 0.12)", glow: "#79c0ff" },
  melee: { stroke: "rgba(255, 120, 120, 0.7)", fill: "rgba(220, 80, 80, 0.12)", glow: "#f08888" },
  speed: { stroke: "rgba(120, 230, 210, 0.7)", fill: "rgba(80, 210, 190, 0.12)", glow: "#5fd4c4" },
};

const AMPLIFIER_SLOT_COLORS = {
  head: { stroke: "rgba(180, 150, 255, 0.75)", fill: "rgba(140, 110, 220, 0.14)", glow: "#b496ff" },
  chest: { stroke: "rgba(150, 190, 255, 0.75)", fill: "rgba(110, 160, 240, 0.14)", glow: "#8cb4ff" },
  boots: { stroke: "rgba(200, 170, 120, 0.75)", fill: "rgba(180, 140, 90, 0.14)", glow: "#c8aa78" },
};

const AMPLIFIER_EQUIP_COLORS = {
  staff: { stroke: "rgba(170, 130, 255, 0.75)", fill: "rgba(140, 100, 230, 0.12)", glow: "#aa82ff" },
  wand: { stroke: "rgba(200, 160, 255, 0.75)", fill: "rgba(170, 130, 240, 0.12)", glow: "#c8a0ff" },
  twoHand: { stroke: "rgba(255, 170, 100, 0.75)", fill: "rgba(240, 130, 70, 0.12)", glow: "#ffaa64" },
};

const SHOP_AMPLIFIER_ROLL_CHANCE = 0.15;
const SHOP_AMPLIFIER_MIN_ROUND = 3;

/** Активные усилители (implemented: true). */
const AMPLIFIER_CATALOG = {
  amplify_fire: {
    id: "amplify_fire",
    name: "Огненный фокус",
    icon: "🔥",
    amplifyFamily: "fire",
    rarity: "common",
    implemented: true,
    desc: "Подсвечивает огонь в рюкзаке. Если есть огненный предмет: +2% маг. урона.",
    combat: { magicDamageMult: 0.02 },
    recommendedTriples: ["triple_pyro_mage"],
  },
  amplify_holy: {
    id: "amplify_holy",
    name: "Святой ориентир",
    icon: "✨",
    amplifyFamily: "holy",
    rarity: "common",
    implemented: true,
    desc: "Подсвечивает святые предметы. Если есть святой предмет: +1% ко всему урону.",
    combat: { allMult: 0.01 },
    recommendedTriples: ["triple_zrecrela", "triple_paladin"],
  },
  amplify_poison: {
    id: "amplify_poison",
    name: "Ядовитый след",
    icon: "☠️",
    amplifyFamily: "poison",
    rarity: "common",
    implemented: true,
    desc: "Подсвечивает яд в рюкзаке. Если есть ядовитый предмет: +1.5% урона.",
    combat: { damageMult: 0.015 },
    recommendedTriples: ["triple_assassin"],
  },
  amplify_magic: {
    id: "amplify_magic",
    name: "Магический компас",
    icon: "🔮",
    amplifyFamily: "magic",
    rarity: "rare",
    implemented: true,
    desc: "Подсвечивает магию. Если есть магический предмет: +2.5% маг. урона.",
    combat: { magicDamageMult: 0.025 },
  },
  amplify_melee: {
    id: "amplify_melee",
    name: "Клинок-маяк",
    icon: "⚔️",
    amplifyFamily: "melee",
    rarity: "common",
    implemented: true,
    desc: "Подсвечивает ближний бой. Если есть предмет ближнего боя: +2% урона.",
    combat: { damageMult: 0.02 },
  },
  amplify_staff: {
    id: "amplify_staff",
    name: "Посох-указатель",
    icon: "🪄",
    amplifyEquip: "staff",
    rarity: "rare",
    implemented: true,
    desc: "Подсвечивает посохи. Если есть посох: +2% маг. урона.",
    combat: { magicDamageMult: 0.02 },
    recommendedTriples: ["triple_pyro_mage"],
  },
  amplify_wand: {
    id: "amplify_wand",
    name: "Жезл-маяк",
    icon: "✴️",
    amplifyEquip: "wand",
    rarity: "rare",
    implemented: true,
    desc: "Подсвечивает жезлы. Если есть жезл: +1.5% маг. урона.",
    combat: { magicDamageMult: 0.015 },
  },
  amplify_twohand: {
    id: "amplify_twohand",
    name: "Двуручный якорь",
    icon: "🪓",
    amplifyEquip: "twoHand",
    rarity: "epic",
    implemented: true,
    desc: "Подсвечивает двуручное оружие. Если есть двуручник: +2.5% урона.",
    combat: { damageMult: 0.025 },
  },
  amplify_chest: {
    id: "amplify_chest",
    name: "Кираса-маяк",
    icon: "🦺",
    amplifySlot: "chest",
    rarity: "rare",
    implemented: true,
    desc: "Подсвечивает броню. Если есть броня: +2 HP.",
    combat: { maxHp: 2 },
  },
  amplify_boots: {
    id: "amplify_boots",
    name: "Следопыт",
    icon: "👢",
    amplifySlot: "boots",
    rarity: "rare",
    implemented: true,
    desc: "Подсвечивает обувь. Если есть обувь: −1.5% перезарядки.",
    combat: { cooldownMult: -0.015 },
  },
};

const AMPLIFIER_SHOP_COST_BY_RARITY = {
  common: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};

function getAmplifierDef(id) {
  return id ? AMPLIFIER_CATALOG[id] || null : null;
}

function getAmplifierShopCost(def) {
  if (!def) return 2;
  return AMPLIFIER_SHOP_COST_BY_RARITY[def.rarity] || 3;
}

function getAmplifierItemDef(ampDef) {
  if (!ampDef?.implemented) return null;
  const hintParts = [];
  if (ampDef.amplifyFamily) hintParts.push(`семейство «${ampDef.amplifyFamily}»`);
  if (ampDef.amplifySlot) {
    const slotLabels = { head: "голова", chest: "грудь", boots: "ботинки" };
    const slotLabel = slotLabels[ampDef.amplifySlot] || ampDef.amplifySlot;
    hintParts.push(`слот «${slotLabel}»`);
  }
  if (ampDef.amplifyEquip) hintParts.push(`экипировка «${ampDef.amplifyEquip}»`);
  return {
    id: ampDef.id,
    name: ampDef.name,
    icon: ampDef.icon,
    color: "#3d8b7a",
    shape: [[0, 0]],
    rarity: ampDef.rarity,
    cost: getAmplifierShopCost(ampDef),
    tags: ["utility", "amplifier", ...(ampDef.amplifyFamily ? [ampDef.amplifyFamily] : [])],
    cooldown: 0,
    description: ampDef.desc || "",
    isAmplifierItem: true,
    amplifierId: ampDef.id,
    amplifyFamily: ampDef.amplifyFamily || null,
    amplifySlot: ampDef.amplifySlot || null,
    amplifyEquip: ampDef.amplifyEquip || null,
    buildHints: `Усилитель · подсветка ${hintParts.join(" · ") || "связей"}`,
  };
}

function registerAmplifierItemsInCatalog() {
  if (typeof ITEM_CATALOG === "undefined") return;
  Object.values(AMPLIFIER_CATALOG).forEach((ampDef) => {
    const itemDef = getAmplifierItemDef(ampDef);
    if (itemDef) ITEM_CATALOG[itemDef.id] = itemDef;
  });
}

function getAmplifierIdFromItem(itemId) {
  const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[itemId] : null;
  if (def?.amplifierId) return def.amplifierId;
  if (AMPLIFIER_CATALOG[itemId]) return itemId;
  return null;
}

function isAmplifierBackpackItem(itemId) {
  const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[itemId] : null;
  return !!(def?.isAmplifierItem || AMPLIFIER_CATALOG[itemId]?.implemented);
}

function itemMatchesEquipType(def, equipType) {
  if (!def || !equipType) return false;
  const id = String(def.id || "");
  const tags = def.tags || [];
  const slot = typeof resolveItemSlot === "function" ? resolveItemSlot(def) : null;
  const cellCount = typeof shapeCellCount === "function" ? shapeCellCount(def.shape) : (def.shape?.length || 0);

  switch (equipType) {
    case "staff":
      return tags.includes("staff") || id.includes("staff");
    case "wand":
      return tags.includes("wand") || id.includes("wand") || id.includes("rod");
    case "twoHand":
      return slot === "twoHand" || (tags.includes("weapon") && cellCount >= 3);
    case "rightHand":
      return tags.includes("weapon") && slot !== "twoHand" && cellCount < 3;
    default:
      return false;
  }
}

function itemMatchesAmplifierTarget(itemId, ampDef) {
  if (!ampDef) return false;
  const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[itemId] : null;
  if (!def) return false;
  if (def.isAmplifierItem) return false;

  if (ampDef.amplifyFamily) {
    return !!def.tags?.includes(ampDef.amplifyFamily);
  }

  if (ampDef.amplifySlot) {
    const slot = typeof resolveItemSlot === "function" ? resolveItemSlot(def) : null;
    if (ampDef.amplifySlot === "head") {
      return slot === "head" || def.tags?.includes("helmet");
    }
    if (ampDef.amplifySlot === "chest") {
      return slot === "chest" || def.tags?.includes("armor");
    }
    if (ampDef.amplifySlot === "boots") {
      return slot === "boots" || def.tags?.includes("boots") || def.tags?.includes("shoes");
    }
    return false;
  }

  if (ampDef.amplifyEquip) {
    return itemMatchesEquipType(def, ampDef.amplifyEquip);
  }

  return false;
}

function collectAmplifiersInLoadout(items = [], options = {}) {
  const excludeUid = options.excludeUid || null;
  const extraItemId = options.extraItemId || null;
  const out = [];

  (items || []).forEach((item) => {
    if (excludeUid && item.uid === excludeUid) return;
    const ampId = getAmplifierIdFromItem(item.itemId);
    const ampDef = getAmplifierDef(ampId);
    if (ampDef?.implemented) out.push(ampDef);
  });

  if (extraItemId && isAmplifierBackpackItem(extraItemId)) {
    const ampDef = getAmplifierDef(getAmplifierIdFromItem(extraItemId));
    if (ampDef?.implemented) out.push(ampDef);
  }

  return out;
}

function collectAmplifyHighlightedItems(items = [], amplifiers = []) {
  if (!amplifiers.length || !items?.length) return [];
  const highlighted = [];
  const seen = new Set();

  items.forEach((item) => {
    if (seen.has(item.uid)) return;
    const matchedBy = amplifiers.filter((amp) => itemMatchesAmplifierTarget(item.itemId, amp));
    if (!matchedBy.length) return;
    seen.add(item.uid);
    highlighted.push({ item, amplifiers: matchedBy });
  });

  return highlighted;
}

function loadoutHasAmplifierMatch(items, ampDef) {
  return (items || []).some((item) => itemMatchesAmplifierTarget(item.itemId, ampDef));
}

function applyAmplifierCombatBonus(side, items = []) {
  if (!side) return;
  const loadout = items.length ? items : (side.items || []);
  const amplifiers = collectAmplifiersInLoadout(loadout);
  if (!amplifiers.length) return;

  side.amplifierIds = amplifiers.map((a) => a.id);
  amplifiers.forEach((ampDef) => {
    if (!ampDef.combat || !loadoutHasAmplifierMatch(loadout, ampDef)) return;
    const b = ampDef.combat;
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

function applyAmplifierRunModifiers(side, prepMeta = {}) {
  const items = prepMeta.loadoutItems || prepMeta.items || side?.items || [];
  applyAmplifierCombatBonus(side, items);
}

function getAmplifierVisualStyle(ampDef) {
  if (!ampDef) {
    return { stroke: "rgba(120, 200, 180, 0.7)", fill: "rgba(80, 180, 160, 0.12)", glow: "#6ecfb8" };
  }
  if (ampDef.amplifyFamily) return AMPLIFIER_FAMILY_COLORS[ampDef.amplifyFamily] || AMPLIFIER_FAMILY_COLORS.magic;
  if (ampDef.amplifySlot) return AMPLIFIER_SLOT_COLORS[ampDef.amplifySlot] || AMPLIFIER_SLOT_COLORS.chest;
  if (ampDef.amplifyEquip) return AMPLIFIER_EQUIP_COLORS[ampDef.amplifyEquip] || AMPLIFIER_EQUIP_COLORS.staff;
  return { stroke: "rgba(120, 200, 180, 0.7)", fill: "rgba(80, 180, 160, 0.12)", glow: "#6ecfb8" };
}

function drawAmplifyCellHighlight(ctx, team, col, row, style, pulse, strong = false) {
  if (typeof cellRect !== "function") return;
  const rect = cellRect(team, col, row);
  ctx.save();
  ctx.fillStyle = style.fill;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = strong ? 2.8 : 2.2;
  ctx.shadowColor = style.glow;
  ctx.shadowBlur = 8 + pulse * 8;
  ctx.globalAlpha = 0.65 + pulse * 0.3;
  if (typeof roundRect === "function") {
    roundRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, 5);
    ctx.fill();
    ctx.globalAlpha = 0.75 + pulse * 0.2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawPrepAmplifyHighlights(ctx, time, side, items, dragContext = null) {
  if (typeof phase !== "undefined" && phase !== "prep") return false;

  const excludeUid = dragContext?.excludeUid || null;
  const extraItemId = dragContext?.extraItemId || null;
  const amplifiers = collectAmplifiersInLoadout(items, { excludeUid, extraItemId });
  if (!amplifiers.length) return false;

  const highlighted = collectAmplifyHighlightedItems(items, amplifiers);
  if (!highlighted.length) return false;

  const pulse = 0.5 + Math.sin((time || 0) * 2.8) * 0.5;
  const strong = !!(dragContext?.extraItemId);

  highlighted.forEach(({ item, amplifiers: matched }) => {
    const style = getAmplifierVisualStyle(matched[0]);
    if (typeof getItemCells !== "function") return;
    getItemCells(item).forEach(([col, row]) => {
      drawAmplifyCellHighlight(ctx, side, col, row, style, pulse, strong);
    });
  });

  return true;
}

function getShopEligibleAmplifiers(ctx = {}) {
  const roundNum = ctx.round ?? 1;
  if (roundNum < SHOP_AMPLIFIER_MIN_ROUND) return [];
  const loadoutItems = ctx.loadoutItems || [];
  return Object.values(AMPLIFIER_CATALOG).filter((def) => {
    if (!def.implemented) return false;
    if (loadoutItems.some((item) => item?.itemId === def.id)) return false;
    return true;
  });
}

function scoreAmplifierShopBias(def, ctx = {}) {
  let score = 1;
  const mutationId = ctx.mutationId || ctx.mutationFormId;
  if (mutationId && (def.recommendedTriples || []).some((tripleId) => {
    const spec = typeof BUILD_UNLOCK_CATALOG !== "undefined" ? BUILD_UNLOCK_CATALOG[tripleId] : null;
    return spec?.supportItemIds?.length;
  })) {
    score += 0.5;
  }
  const tags = ctx.loadoutTags || [];
  if (def.amplifyFamily && tags.includes(def.amplifyFamily)) score += 1.25;
  if (def.amplifySlot === "chest" && tags.includes("armor")) score += 0.75;
  if (def.amplifySlot === "boots" && (tags.includes("boots") || tags.includes("shoes"))) score += 0.75;
  return score;
}

function pickWeightedAmplifier(pool, ctx = {}) {
  if (!pool.length) return null;
  const weights = pool.map((def) => scoreAmplifierShopBias(def, ctx));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function rollShopAmplifierEntry(ctx = {}) {
  const pool = getShopEligibleAmplifiers(ctx);
  if (!pool.length) return null;
  const picked = pickWeightedAmplifier(pool, ctx);
  return picked ? picked.id : null;
}

function tryRollShopAmplifier(ctx = {}) {
  if ((ctx.round ?? 1) < SHOP_AMPLIFIER_MIN_ROUND) return null;
  if (Math.random() > SHOP_AMPLIFIER_ROLL_CHANCE) return null;
  return rollShopAmplifierEntry(ctx);
}

function escapePrepModChipHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/** Компактный emoji-чип с popover-подсказкой при наведении. */
function renderPrepModIconChipHtml({
  icon = "◻️",
  tipTitle = "",
  tipLines = [],
  active = false,
  kind = "amp",
  ariaLabel = "",
} = {}) {
  const label = escapePrepModChipHtml(ariaLabel || tipTitle || icon);
  const tipBody = [tipTitle, ...tipLines]
    .filter(Boolean)
    .map(escapePrepModChipHtml)
    .join("<br>");
  return `
    <span class="prep-mod-chip prep-mod-chip--icon-only prep-mod-chip--${kind}${active ? " is-active" : ""}"
          tabindex="0"
          role="button"
          aria-label="${label}">
      <span class="prep-mod-chip-emoji" aria-hidden="true">${icon}</span>
      <span class="prep-mod-chip-popover" role="tooltip">${tipBody}</span>
    </span>
  `.trim();
}

function collectAmplifierIconChips(items = []) {
  const amplifiers = collectAmplifiersInLoadout(items);
  return amplifiers.map((ampDef) => {
    const matches = items.filter((item) => itemMatchesAmplifierTarget(item.itemId, ampDef));
    const active = matches.length > 0;
    const target = ampDef.amplifyFamily
      ? `тег «${ampDef.amplifyFamily}»`
      : ampDef.amplifySlot
        ? `слот «${ampDef.amplifySlot}»`
        : ampDef.amplifyEquip
          ? `экип «${ampDef.amplifyEquip}»`
          : "связи";
    const bonus = ampDef.combat ? " · бонус в бою" : "";
    const stateLine = active
      ? `подсветка: ${matches.length} предм.${bonus}`
      : `положите предмет с ${target}`;
    return {
      icon: ampDef.icon,
      tipTitle: ampDef.name,
      tipLines: [stateLine, ampDef.desc || ""].filter(Boolean),
      active,
      kind: "amp",
      ariaLabel: `${ampDef.name}: ${stateLine}`,
    };
  });
}

function renderPrepAmplifierStatusHtml(items = []) {
  const chips = collectAmplifierIconChips(items);
  if (!chips.length) return "";
  const chipsHtml = chips.map((chip) => renderPrepModIconChipHtml(chip)).join("");
  return `
    <div class="prep-modifier-strip prep-modifier-strip--amp prep-modifier-strip--icons" aria-label="Усилители рюкзака">
      <div class="prep-modifier-chips prep-modifier-chips--icons">${chipsHtml}</div>
    </div>
  `;
}

function renderPrepModifierStripHtml(items = []) {
  const chips = [
    ...collectAmplifierIconChips(items),
    ...(typeof collectPrepBuildKeyIconChips === "function" ? collectPrepBuildKeyIconChips(items) : []),
  ];
  if (!chips.length) return "";
  const chipsHtml = chips.map((chip) => renderPrepModIconChipHtml(chip)).join("");
  return `
    <div class="prep-modifier-strip prep-modifier-strip--combined prep-modifier-strip--icons" aria-label="Модификаторы билда">
      <div class="prep-modifier-chips prep-modifier-chips--icons">${chipsHtml}</div>
    </div>
  `;
}

function buildAmplifierTooltipExtraLines(def) {
  const lines = [];
  if (def.amplifyFamily) lines.push(`Подсветка: тег «${def.amplifyFamily}»`);
  if (def.amplifySlot) {
    const slotLabels = { head: "голова", chest: "грудь", boots: "ботинки" };
    const slotLabel = slotLabels[def.amplifySlot] || def.amplifySlot;
    lines.push(`Подсветка: ${slotLabel} / броня`);
  }
  if (def.amplifyEquip) lines.push(`Подсветка: ${def.amplifyEquip}`);
  lines.push("Положите 1×1 в рюкзак — подсветка активна");
  return lines;
}

registerAmplifierItemsInCatalog();
