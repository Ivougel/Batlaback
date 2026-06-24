/**
 * Каталог предметов — данные, теги, эффекты, синергии.
 * Логика боя интерпретирует effects[] универсально.
 */

/** Глобальный масштаб интерфейса (1 = базовый, ~1.25 = +25%). */
const UI_SCALE = 1;

function uiPx(value) {
  return Math.round(value * UI_SCALE);
}

/** Точечная коррекция (доля клетки) поверх center/middle — только для кривых глифов. */
const ICON_OPTICAL_OFFSETS = {
  "☠️": [0.04, 0.03],
  "\u2620\uFE0F": [0.04, 0.03],
  "☠": [0.04, 0.03],
};

/** Центрирует emoji в клетке canvas (center/middle + опциональный offset). */
function drawCellEmoji(ctx, icon, x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const size = Math.max(14, Math.round(Math.min(w, h) * 0.58));
  ctx.save();
  ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  const fallback = ICON_OPTICAL_OFFSETS[icon];
  const ox = fallback ? fallback[0] * w : 0;
  const oy = fallback ? fallback[1] * h : 0;
  ctx.fillText(icon, cx + ox, cy + oy);
  ctx.restore();
}

const RARITY_COLORS = {
  common: "#8b949e",
  uncommon: "#3fb950",
  rare: "#58a6ff",
  epic: "#a371f7",
  legendary: "#f0c14b",
};

/** Визуальные стили карточек и названий по rarity из ITEM_CATALOG. */
const RARITY_UI = {
  common: { nameColor: "#8b949e", borderColor: "#484f58", glow: null },
  uncommon: { nameColor: "#3fb950", borderColor: "#3fb950", glow: "soft" },
  rare: { nameColor: "#58a6ff", borderColor: "#58a6ff", glow: "medium" },
  epic: { nameColor: "#a371f7", borderColor: "#a371f7", glow: "medium" },
  legendary: { nameColor: "#f0c14b", borderColor: "#f0c14b", glow: "strong" },
};

function getRarityUI(rarity) {
  return RARITY_UI[rarity] || RARITY_UI.common;
}

function getRarityNameColor(rarity) {
  return getRarityUI(rarity).nameColor;
}

function getRarityCardClasses(rarity, extraClasses = "") {
  const base = `rarity-${rarity || "common"}`;
  return extraClasses ? `${extraClasses} ${base}` : base;
}

/** После каких раундов (счётчик после боя) выдаётся бесплатная сумка. */
const BAG_REWARD_ROUNDS = [2, 4, 6, 8, 10, 12, 14];

/** Какую сумку выдать на наградном раунде. */
function pickBagRewardId(roundNum) {
  if (roundNum <= 4) return "leather_pouch";
  if (roundNum <= 8) return "backpack";
  if (roundNum <= 12) return "storage_chest";
  return "large_sack";
}

/** Русские названия тегов для UI (внутренние id остаются на английском). */
const TAG_LABELS = {
  weapon: "оружие",
  armor: "броня",
  shield: "щит",
  magic: "магия",
  gem: "кристалл",
  poison: "яд",
  food: "еда",
  nature: "природа",
  fire: "огонь",
  bag: "сумка",
  utility: "универсальный",
  craft: "крафт",
};

function formatTagLabel(tag) {
  return TAG_LABELS[tag] || tag;
}

function formatTagsList(tags, separator = ", ") {
  return (tags || []).map(formatTagLabel).join(separator);
}

const DAMAGE_TYPE_LABELS = {
  magic: "магия",
  fire: "огонь",
};

function formatDamageType(type) {
  if (!type) return "";
  return DAMAGE_TYPE_LABELS[type] || TAG_LABELS[type] || type;
}

function getBaseSynergyIdsForTags(tags) {
  const ids = new Set();
  (tags || []).forEach((tag) => {
    (BASE_TAG_SYNERGIES[tag] || []).forEach((rule) => ids.add(rule.id));
  });
  return ids;
}

/** Синергии, заданные у предмета явно — без автоподмешанных по тегам. */
function getUniqueItemSynergies(def) {
  const baseIds = getBaseSynergyIdsForTags(def.tags);
  return (def.synergies || []).filter((s) => !baseIds.has(s.id));
}

/** Базовые синергии по тегам (добавляются к предметам автоматически). */
/** Минорные синергии — небольшой бонус за укладку; основная сила в крафте. */
const BASE_TAG_SYNERGIES = {
  weapon: [
    {
      id: "weapon_near_armor",
      adjacency: "strong",
      neighborTags: ["armor"],
      target: "self",
      apply: { type: "blockBonus", value: 1 },
      desc: "Оружие рядом с бронёй: +1 блока",
    },
    {
      id: "weapon_near_poison",
      adjacency: "strong",
      neighborTags: ["poison"],
      target: "self",
      apply: { type: "poisonBonus", value: 1 },
      desc: "Оружие рядом с ядом: +1 к яду",
    },
  ],
  magic: [
    {
      id: "magic_near_gem",
      adjacency: "strong",
      neighborTags: ["gem"],
      target: "self",
      apply: { type: "cooldownReduction", value: 0.08 },
      desc: "Магия рядом с кристаллом: −8% кулдаун",
    },
  ],
};

function shapeRect(w, h) {
  const cells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([x, y]);
  return cells;
}

function getShapeBounds(shape) {
  if (!shape?.length) return { minCol: 0, minRow: 0, cols: 1, rows: 1 };
  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  shape.forEach(([c, r]) => {
    minCol = Math.min(minCol, c);
    minRow = Math.min(minRow, r);
    maxCol = Math.max(maxCol, c);
    maxRow = Math.max(maxRow, r);
  });
  return {
    minCol,
    minRow,
    cols: maxCol - minCol + 1,
    rows: maxRow - minRow + 1,
  };
}

/** Схема занятости клеток для карточек магазина и скамейки. */
function renderItemShapeMiniHTML(def, options = {}) {
  const shape = def?.shape;
  if (!shape?.length) return "";

  const { size = "md" } = options;
  const cellSet = new Set(shape.map(([c, r]) => `${c},${r}`));
  const { minCol, minRow, cols, rows } = getShapeBounds(shape);
  const maxDim = Math.max(cols, rows);
  const cellPx = size === "sm"
    ? (maxDim <= 2 ? 7 : maxDim === 3 ? 6 : 5)
    : (maxDim <= 2 ? 10 : maxDim === 3 ? 8 : 6);
  const color = def.color || "#58a6ff";
  const label = `${cols}×${rows}`;

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const filled = cellSet.has(`${minCol + c},${minRow + r}`);
      const style = filled ? ` style="background:${color}d9;border-color:${color}"` : "";
      cells.push(`<span class="item-shape-cell${filled ? " filled" : ""}"${style}></span>`);
    }
  }

  return `<div class="item-shape-mini item-shape-mini--${size}" style="grid-template-columns:repeat(${cols},${cellPx}px)" title="Форма: ${label}" aria-label="Занимает ${label} клеток">${cells.join("")}</div>`;
}

function mergeSynergies(tags, extra = []) {
  const list = [...extra];
  tags.forEach((tag) => {
    (BASE_TAG_SYNERGIES[tag] || []).forEach((rule) => {
      if (!list.some((r) => r.id === rule.id)) list.push(rule);
    });
  });
  return list;
}

/** Разброс урона по редкости (min = max(1, value − spread)). */
const DAMAGE_SPREAD_BY_RARITY = {
  common: 2,
  uncommon: 3,
  rare: 4,
  legendary: 5,
};

function resolveDamageRange(effect, def) {
  if (!effect || effect.type !== "damage") return { min: 0, max: 0 };
  if (effect.valueMin != null || effect.valueMax != null) {
    const max = effect.valueMax ?? effect.value ?? 1;
    const min = effect.valueMin ?? Math.max(1, max - 2);
    return { min: Math.min(min, max), max };
  }
  const max = Math.max(1, effect.value || 1);
  const spread = DAMAGE_SPREAD_BY_RARITY[def?.rarity] ?? 2;
  return { min: Math.max(1, max - spread), max };
}

function getEffectAverageDamage(effect, def) {
  const { min, max } = resolveDamageRange(effect, def);
  return (min + max) / 2;
}

function formatDamageRangeText(effect, def) {
  const { min, max } = resolveDamageRange(effect, def);
  return min === max ? String(min) : `${min}–${max}`;
}

/** Бросок урона: удача смещает результат к верхней границе диапазона. */
function rollDamageWithLuck(min, max, luck = 0) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const span = hi - lo + 1;
  if (span <= 1) return lo;
  const bias = 1 + Math.max(0, luck) * 0.025;
  const r = Math.pow(Math.random(), 1 / bias);
  return lo + Math.floor(r * span);
}

function enrichDamageEffect(effect, rarity) {
  if (effect.type !== "damage") return effect;
  const { min, max } = resolveDamageRange(effect, { rarity });
  return {
    ...effect,
    valueMin: effect.valueMin ?? min,
    valueMax: effect.valueMax ?? max,
    value: effect.value ?? Math.round((min + max) / 2),
  };
}

/** Стоимость выносливости только для оружия (тег weapon). */
const STAMINA_COST_SCALE = 1.12;

function computeItemStaminaCostFromOpts(opts) {
  const tags = opts.tags || [];
  if (!tags.includes("weapon")) return 0;

  const effects = opts.effects ?? [];
  let cost = 0;
  effects.forEach((e) => {
    if (e.trigger === "passive") return;
    if (e.type === "damage") {
      const peak = e.valueMax ?? e.value ?? 1;
      cost = Math.max(cost, Math.round(peak * 1.15 + 3));
    }
    if (e.type === "poison") {
      cost = Math.max(cost, Math.round(e.value * 2.2 + 3));
    }
  });
  if (cost <= 0) cost = 5;
  return Math.max(1, Math.ceil(cost * STAMINA_COST_SCALE));
}

function getItemStaminaCost(def) {
  if (!def) return 0;
  if (!def.tags?.includes("weapon")) return 0;
  if (typeof def.staminaCost === "number" && def.staminaCost > 0) return def.staminaCost;
  if (!itemHasActivatableEffects(def)) return 0;
  return computeItemStaminaCostFromOpts(def);
}

function defItem(opts) {
  const tags = opts.tags || [];
  const staminaCost = opts.staminaCost ?? computeItemStaminaCostFromOpts(opts);
  return {
    id: opts.id,
    name: opts.name,
    icon: opts.icon,
    color: opts.color || "#8b949e",
    shape: opts.shape,
    classRestriction: opts.classRestriction ?? null,
    rarity: opts.rarity,
    cost: opts.cost,
    tags,
    stats: {
      damage: opts.damage ?? 0,
      defense: opts.defense ?? 0,
      maxHp: opts.maxHp ?? 0,
    },
    cooldown: opts.cooldown ?? 2.5,
    staminaCost,
    effects: (opts.effects ?? []).map((e) => enrichDamageEffect(e, opts.rarity)),
    synergies: mergeSynergies(tags, opts.synergies ?? []),
    isContainer: false,
    craftOnly: opts.craftOnly ?? false,
  };
}

const ITEM_CATALOG = {
  starter_bag: {
    id: "starter_bag",
    name: "Сумка",
    icon: "👜",
    color: "#6e4c2a",
    shape: shapeRect(3, 3),
    internalCols: 3,
    internalRows: 3,
    isContainer: true,
    immovable: true,
    classRestriction: null,
    rarity: "common",
    cost: 0,
    tags: ["bag"],
    stats: {},
    cooldown: 0,
    effects: [],
    synergies: [],
  },
  leather_pouch: {
    id: "leather_pouch",
    name: "Кожаный мешочек",
    icon: "👝",
    color: "#8b6914",
    shape: shapeRect(1, 2),
    internalCols: 1,
    internalRows: 2,
    isContainer: true,
    shopContainer: true,
    immovable: false,
    classRestriction: null,
    rarity: "common",
    cost: 2,
    tags: ["bag"],
    stats: {},
    cooldown: 0,
    effects: [],
    synergies: [],
  },
  backpack: {
    id: "backpack",
    name: "Рюкзак",
    icon: "🎒",
    color: "#4a6741",
    shape: [[0, 0], [0, 1], [0, 2]],
    internalCols: 1,
    internalRows: 3,
    isContainer: true,
    shopContainer: true,
    immovable: false,
    classRestriction: null,
    rarity: "uncommon",
    cost: 4,
    tags: ["bag"],
    stats: {},
    cooldown: 0,
    effects: [],
    synergies: [],
  },
  storage_chest: {
    id: "storage_chest",
    name: "Сундук",
    icon: "📦",
    color: "#6e4c2a",
    shape: shapeRect(2, 2),
    internalCols: 2,
    internalRows: 2,
    isContainer: true,
    shopContainer: true,
    immovable: false,
    classRestriction: null,
    rarity: "rare",
    cost: 7,
    minShopRound: 5,
    tags: ["bag"],
    stats: {},
    cooldown: 0,
    effects: [],
    synergies: [],
  },
  large_sack: {
    id: "large_sack",
    name: "Большой мешок",
    icon: "🛄",
    color: "#4a6741",
    shape: shapeRect(2, 3),
    internalCols: 2,
    internalRows: 3,
    isContainer: true,
    shopContainer: true,
    immovable: false,
    classRestriction: null,
    rarity: "rare",
    cost: 9,
    minShopRound: 8,
    tags: ["bag"],
    stats: {},
    cooldown: 0,
    effects: [],
    synergies: [],
  },

  // ── COMMON (6 + 4 стартовых в общем пуле) ──
  rusty_sword: defItem({
    id: "rusty_sword", name: "Ржавый меч", icon: "🗡️", color: "#8b949e",
    shape: shapeRect(1, 2), rarity: "common", cost: 2, tags: ["weapon"], damage: 2, cooldown: 2.5,
    effects: [{ type: "damage", value: 2, valueMin: 1, valueMax: 3 }],
  }),
  iron_shield: defItem({
    id: "iron_shield", name: "Железный щит", icon: "🛡️", color: "#6e7681",
    shape: shapeRect(2, 1), rarity: "common", cost: 3, tags: ["armor", "shield"], cooldown: 3,
    effects: [{ type: "block", value: 5 }],
    synergies: [{
      id: "shield_weapon_buff", adjacency: "strong", neighborTags: ["weapon"], target: "self",
      apply: { type: "grantBlockBuff", value: 3, buffTargetTags: ["weapon"], cap: 12 },
      desc: "При блоке: +3 к атаке соседнего оружия",
    }],
  }),
  poison_dagger: defItem({
    id: "poison_dagger", name: "Ядовитый кинжал", icon: "🗡️", color: "#3fb950",
    shape: shapeRect(1, 2), rarity: "common", cost: 3, tags: ["weapon", "poison"], damage: 2, cooldown: 2.6,
    effects: [
      { type: "damage", value: 2, valueMin: 1, valueMax: 2 },
      { type: "poison", value: 1, interval: 3 },
    ],
  }),
  healing_herb: defItem({
    id: "healing_herb", name: "Целебная трава", icon: "🌿", color: "#56d364",
    shape: shapeRect(2, 1), rarity: "common", cost: 2, tags: ["food", "nature"], cooldown: 4,
    effects: [{ type: "heal", value: 5 }],
    synergies: [{
      id: "nature_food_boost", adjacency: "strong", neighborTags: ["nature"], target: "self",
      apply: { type: "healBonus", value: 1 }, desc: "+1 лечения рядом с природой",
    }],
  }),
  apple: defItem({
    id: "apple", name: "Яблоко", icon: "🍎", color: "#f85149",
    shape: [[0, 0]], rarity: "common", cost: 1, tags: ["food"], cooldown: 2.5,
    effects: [{ type: "heal", value: 3 }],
  }),
  leather_armor: defItem({
    id: "leather_armor", name: "Кожаная броня", icon: "🦺", color: "#8b6914",
    shape: shapeRect(2, 2), rarity: "common", cost: 3, tags: ["armor"], defense: 5, cooldown: 0,
    effects: [{ type: "passiveDefense", value: 5, trigger: "passive" }],
    synergies: [{
      id: "leather_shield_support", adjacency: "strong", neighborTags: ["shield"], target: "neighbor",
      apply: { type: "blockBonus", value: 1 },
      desc: "Рядом со щитом: +1 к блоку щита",
    }],
  }),
  iron_helmet: defItem({
    id: "iron_helmet", name: "Железный шлем", icon: "⛑️", color: "#6e7681",
    shape: shapeRect(1, 2), rarity: "common", cost: 2, tags: ["armor"], defense: 3, cooldown: 4,
    effects: [
      { type: "passiveDefense", value: 3, trigger: "passive" },
      { type: "block", value: 4 },
    ],
  }),
  dagger: defItem({
    id: "dagger", name: "Кинжал", icon: "🔪", color: "#c9d1d9",
    shape: [[0, 0]], rarity: "common", cost: 2, tags: ["weapon"], damage: 2, cooldown: 1.5,
    effects: [{ type: "damage", value: 2, valueMin: 1, valueMax: 3 }],
  }),
  poison_vial: defItem({
    id: "poison_vial", name: "Яд", icon: "☠️", color: "#3fb950",
    shape: [[0, 0]], rarity: "common", cost: 2, tags: ["poison"], cooldown: 4.5,
    effects: [{ type: "poison", value: 1 }],
  }),

  // ── UTILITY — универсальные, слабые, под любой билд и бюджет ──
  bandage: defItem({
    id: "bandage", name: "Бинт", icon: "🩹", color: "#56d364",
    shape: [[0, 0]], rarity: "common", cost: 1, tags: ["utility", "food"], cooldown: 3,
    effects: [{ type: "heal", value: 3 }],
  }),
  lucky_charm: defItem({
    id: "lucky_charm", name: "Талисман", icon: "🍀", color: "#3fb950",
    shape: [[0, 0]], rarity: "common", cost: 2, tags: ["utility", "gem"], cooldown: 0,
    effects: [{ type: "passiveLuck", value: 35, trigger: "passive" }],
  }),
  wooden_buckler: defItem({
    id: "wooden_buckler", name: "Деревянный щиток", icon: "🪵", color: "#8b6914",
    shape: shapeRect(2, 1), rarity: "common", cost: 2, tags: ["utility", "shield"], cooldown: 4,
    effects: [{ type: "block", value: 3 }],
  }),
  cork_charm: defItem({
    id: "cork_charm", name: "Пробка-оберег", icon: "🧿", color: "#6e7681",
    shape: [[0, 0]], rarity: "common", cost: 2, tags: ["utility"], cooldown: 5,
    effects: [{ type: "block", value: 2 }],
  }),
  whetstone: defItem({
    id: "whetstone", name: "Точильный камень", icon: "🪨", color: "#8b949e",
    shape: [[0, 0]], rarity: "common", cost: 3, tags: ["utility", "craft"], cooldown: 0,
    effects: [],
  }),
  gloves_of_haste: defItem({
    id: "gloves_of_haste", name: "Перчатки спешки", icon: "🧤", color: "#58a6ff",
    shape: [[0, 0]], rarity: "common", cost: 3, tags: ["utility", "craft"], cooldown: 0,
    effects: [],
  }),
  pestilence_flask: defItem({
    id: "pestilence_flask", name: "Ядовитое зелье", icon: "🧪", color: "#3fb950",
    shape: [[0, 0]], rarity: "common", cost: 3, tags: ["poison", "craft"], cooldown: 0,
    effects: [],
  }),
  broom: defItem({
    id: "broom", name: "Метла", icon: "🧹", color: "#8b6914",
    shape: shapeRect(1, 2), rarity: "common", cost: 2, tags: ["utility", "craft"], cooldown: 0,
    effects: [],
  }),
  pan: defItem({
    id: "pan", name: "Сковородка", icon: "🍳", color: "#c9d1d9",
    shape: shapeRect(2, 1), rarity: "common", cost: 3, tags: ["utility", "craft"], cooldown: 0,
    effects: [],
  }),
  heroic_potion: defItem({
    id: "heroic_potion", name: "Геройское зелье", icon: "⚗️", color: "#f0c14b",
    shape: [[0, 0]], rarity: "uncommon", cost: 4, tags: ["food", "craft"], cooldown: 0,
    effects: [],
  }),
  hungry_blade: defItem({
    id: "hungry_blade", name: "Голодный клинок", icon: "🗡️", color: "#d29922",
    shape: shapeRect(1, 2), rarity: "uncommon", cost: 5, tags: ["weapon"], damage: 5, cooldown: 2.2,
    effects: [{ type: "damage", value: 5 }],
  }),
  iron_patch: defItem({
    id: "iron_patch", name: "Железная заплатка", icon: "🔩", color: "#6e7681",
    shape: shapeRect(1, 2), rarity: "common", cost: 3, tags: ["utility", "armor"], cooldown: 0,
    effects: [{ type: "passiveDefense", value: 2, trigger: "passive" }],
  }),
  antitoxin: defItem({
    id: "antitoxin", name: "Антидот", icon: "🧴", color: "#79c0ff",
    shape: [[0, 0]], rarity: "uncommon", cost: 3, tags: ["utility", "nature"], cooldown: 3.5,
    effects: [{ type: "heal", value: 4 }],
  }),
  spark_stone: defItem({
    id: "spark_stone", name: "Искорка", icon: "✨", color: "#d2a8ff",
    shape: [[0, 0]], rarity: "uncommon", cost: 4, tags: ["utility", "magic"], cooldown: 3,
    effects: [{ type: "damage", value: 3, damageType: "magic" }],
  }),

  apprentice_staff: defItem({
    id: "apprentice_staff", name: "Посох ученика", icon: "🪄", color: "#a371f7",
    shape: shapeRect(1, 2), rarity: "common", cost: 3, tags: ["weapon", "magic"], damage: 2, cooldown: 2.5,
    effects: [{ type: "damage", value: 2, valueMin: 1, valueMax: 3, damageType: "magic" }],
  }),

  // ── UNCOMMON (8) ──
  mana_crystal: defItem({
    id: "mana_crystal", name: "Мана-кристалл", icon: "💎", color: "#a371f7",
    shape: shapeRect(1, 2), rarity: "uncommon", cost: 5, tags: ["magic", "gem"], damage: 4, cooldown: 2,
    effects: [{ type: "damage", value: 4, damageType: "magic" }],
  }),
  ring_of_power: defItem({
    id: "ring_of_power", name: "Кольцо силы", icon: "💍", color: "#f0883e",
    shape: shapeRect(1, 2), rarity: "uncommon", cost: 5, tags: ["gem"], cooldown: 0,
    effects: [{ type: "statMult", stat: "damage", value: 0.15, trigger: "passive" }],
  }),
  health_stone: defItem({
    id: "health_stone", name: "Камень здоровья", icon: "❤️", color: "#f85149",
    shape: [[0, 0]], rarity: "uncommon", cost: 5, tags: ["gem"], maxHp: 12, cooldown: 5,
    effects: [
      { type: "passiveMaxHp", value: 12, trigger: "passive" },
      { type: "heal", value: 4 },
    ],
    synergies: [{
      id: "health_stone_food", adjacency: "strong", neighborTags: ["food"], target: "self",
      apply: { type: "healBonus", value: 1 },
      desc: "Рядом с едой: +1 к лечению",
    }],
  }),
  speed_amulet: defItem({
    id: "speed_amulet", name: "Амулет скорости", icon: "⚡", color: "#58a6ff",
    shape: [[0, 0]], rarity: "uncommon", cost: 5, tags: ["gem"], cooldown: 0,
    effects: [{ type: "statMult", stat: "cooldown", value: -0.12, trigger: "passive" }],
  }),
  fire_crystal: defItem({
    id: "fire_crystal", name: "Огненный кристалл", icon: "🔥", color: "#f0883e",
    shape: shapeRect(1, 2), rarity: "uncommon", cost: 6, tags: ["fire", "gem"], cooldown: 2.5,
    effects: [{ type: "damage", value: 5, damageType: "fire" }],
  }),
  frost_crystal: defItem({
    id: "frost_crystal", name: "Морозный кристалл", icon: "❄️", color: "#79c0ff",
    shape: shapeRect(1, 2), rarity: "uncommon", cost: 6, tags: ["magic", "gem"], damage: 4, cooldown: 3,
    effects: [
      { type: "damage", value: 4, damageType: "magic" },
      { type: "slow", value: 0.15, duration: 3 },
    ],
  }),
  spider_web: defItem({
    id: "spider_web", name: "Паутина", icon: "🕸️", color: "#8b949e",
    shape: shapeRect(2, 1), rarity: "uncommon", cost: 5, tags: ["nature"], cooldown: 4,
    effects: [{ type: "slow", value: 0.1, duration: 4 }],
  }),
  beast_fang: defItem({
    id: "beast_fang", name: "Клык зверя", icon: "🦷", color: "#d29922",
    shape: [[0, 0]], rarity: "uncommon", cost: 6, tags: ["weapon"], cooldown: 0,
    effects: [
      { type: "statMult", stat: "cooldown", value: -0.15, trigger: "passive" },
      { type: "statMult", stat: "damage", value: 0.1, trigger: "passive" },
    ],
  }),
  rage_potion: defItem({
    id: "rage_potion", name: "Зелье ярости", icon: "🧪", color: "#f85149",
    shape: [[0, 0]], rarity: "uncommon", cost: 8, tags: ["food"], cooldown: 6,
    effects: [{ type: "buffTimed", stat: "damage", value: 0.3, duration: 5 }],
  }),

  // ── RARE (6) ──
  great_shield: defItem({
    id: "great_shield", name: "Большой щит", icon: "🛡️", color: "#58a6ff",
    shape: shapeRect(2, 2), rarity: "rare", cost: 8, tags: ["armor", "shield"], cooldown: 3,
    effects: [{ type: "block", value: 18 }],
    synergies: [{
      id: "great_shield_armor_pair", adjacency: "strong", neighborTags: ["armor"], target: "self",
      apply: { type: "blockBonus", value: 2 },
      desc: "Рядом с бронёй: +2 к блоку",
    }],
  }),
  knight_sword: defItem({
    id: "knight_sword", name: "Меч рыцаря", icon: "⚔️", color: "#79c0ff",
    shape: shapeRect(1, 3), rarity: "rare", cost: 9, tags: ["weapon"], damage: 16, cooldown: 3.2,
    effects: [{ type: "damage", value: 16 }],
  }),
  titan_armor: defItem({
    id: "titan_armor", name: "Доспех титана", icon: "🦾", color: "#a371f7",
    shape: shapeRect(2, 2), rarity: "rare", cost: 10, tags: ["armor"], defense: 16, maxHp: 15, cooldown: 0,
    effects: [
      { type: "passiveDefense", value: 16, trigger: "passive" },
      { type: "passiveMaxHp", value: 15, trigger: "passive" },
    ],
  }),
  blood_stone: defItem({
    id: "blood_stone", name: "Кровавый камень", icon: "🩸", color: "#f85149",
    shape: shapeRect(1, 2), rarity: "rare", cost: 10, tags: ["gem"], damage: 5, cooldown: 3.5,
    effects: [
      { type: "lifesteal", value: 0.22, trigger: "passive" },
      { type: "passiveMaxHp", value: 10, trigger: "passive" },
      { type: "damage", value: 5 },
    ],
  }),
  rune_of_protection: defItem({
    id: "rune_of_protection", name: "Руна защиты", icon: "🔷", color: "#58a6ff",
    shape: shapeRect(1, 2), rarity: "rare", cost: 7, tags: ["magic"], cooldown: 3.5,
    effects: [
      { type: "shieldBlockMult", value: 0.38, trigger: "passive" },
      { type: "block", value: 6 },
    ],
  }),
  rune_of_magic: defItem({
    id: "rune_of_magic", name: "Руна магии", icon: "✨", color: "#a371f7",
    shape: shapeRect(1, 2), rarity: "rare", cost: 7, tags: ["magic", "gem"], damage: 4, cooldown: 3,
    effects: [
      { type: "statMult", stat: "magicDamage", value: 0.35, trigger: "passive" },
      { type: "damage", value: 4, damageType: "magic" },
    ],
  }),

  // ── LEGENDARY — классовые (6) ──
  war_hammer: defItem({
    id: "war_hammer", name: "Боевой молот", icon: "🔨", color: "#ffa657",
    shape: [[0, 0], [1, 0], [0, 1]], classRestriction: "warrior",
    rarity: "legendary", cost: 12, tags: ["weapon"], damage: 25, cooldown: 4.5,
    effects: [
      { type: "damage", value: 25 },
      { type: "shieldBreakBonus", value: 0.5, trigger: "passive" },
    ],
  }),
  royal_helmet: defItem({
    id: "royal_helmet", name: "Королевский шлем", icon: "👑", color: "#f0c14b",
    shape: shapeRect(1, 2), classRestriction: "warrior",
    rarity: "legendary", cost: 10, tags: ["armor"], defense: 10, maxHp: 15, cooldown: 2.5,
    effects: [
      { type: "passiveDefense", value: 10, trigger: "passive" },
      { type: "passiveMaxHp", value: 15, trigger: "passive" },
      { type: "block", value: 10 },
    ],
    synergies: [{
      id: "royal_block_buff", adjacency: "strong", neighborTags: ["weapon"], target: "self",
      apply: { type: "grantBlockBuff", value: 4, buffTargetTags: ["weapon"], cap: 20 },
      desc: "При блоке: +4 к атаке соседнего оружия (макс. +20 за бой)",
    }],
  }),
  smoke_bomb: defItem({
    id: "smoke_bomb", name: "Дымовая бомба", icon: "💨", color: "#8b949e",
    shape: shapeRect(1, 2), classRestriction: "rogue",
    rarity: "legendary", cost: 10, tags: ["poison"], cooldown: 4.5,
    effects: [
      { type: "dodgePeriodic", interval: 3, trigger: "passive" },
      { type: "poison", value: 2 },
    ],
  }),
  shadow_blade: defItem({
    id: "shadow_blade", name: "Клинок тени", icon: "🌑", color: "#484f58",
    shape: shapeRect(1, 2), classRestriction: "rogue",
    rarity: "legendary", cost: 15, tags: ["weapon", "poison"], damage: 13, cooldown: 2,
    effects: [
      { type: "damage", value: 13 },
      { type: "crit", chance: 0.25, doublePoison: true, trigger: "passive" },
    ],
  }),
  fire_staff: defItem({
    id: "fire_staff", name: "Огненный посох", icon: "🔥", color: "#f0883e",
    shape: [[0, 0], [0, 1], [1, 1]], classRestriction: "mage",
    rarity: "legendary", cost: 12, tags: ["weapon", "magic", "fire"], damage: 11, cooldown: 3,
    effects: [
      { type: "damage", value: 11, damageType: "fire" },
      { type: "groundFire", value: 3, trigger: "passive" },
      { type: "shieldBreakBonus", value: 0.15, trigger: "passive" },
    ],
    synergies: [{
      id: "fire_gem_boost", adjacency: "weak", neighborTags: ["gem"], target: "self",
      apply: { type: "damageBonus", value: 2 }, desc: "+2 урона рядом с кристаллом (диаг.)",
    }],
  }),
  mana_orb: defItem({
    id: "mana_orb", name: "Сфера маны", icon: "🔮", color: "#a371f7",
    shape: shapeRect(1, 2), classRestriction: "mage",
    rarity: "legendary", cost: 16, tags: ["magic", "gem"], damage: 7, cooldown: 2.4,
    effects: [
      { type: "damage", value: 7, damageType: "magic" },
      { type: "repeatCast", magicOnly: true, trigger: "passive" },
    ],
  }),

  // ── КРАФТ — только через рецепты ──
  hero_sword: defItem({
    id: "hero_sword", name: "Геройский меч", icon: "⚔️", color: "#79c0ff",
    shape: shapeRect(1, 2), rarity: "uncommon", cost: 0, craftOnly: true, tags: ["weapon"], damage: 6, cooldown: 2.4,
    effects: [{ type: "damage", value: 6, valueMin: 4, valueMax: 8 }],
  }),
  hero_long_sword: defItem({
    id: "hero_long_sword", name: "Геройский длинный меч", icon: "🗡️", color: "#58a6ff",
    shape: shapeRect(1, 3), rarity: "rare", cost: 0, craftOnly: true, tags: ["weapon"], damage: 11, cooldown: 2.8,
    effects: [{ type: "damage", value: 11, valueMin: 8, valueMax: 14 }],
  }),
  falcon_blade: defItem({
    id: "falcon_blade", name: "Соколиный клинок", icon: "🦅", color: "#79c0ff",
    shape: shapeRect(1, 2), rarity: "rare", cost: 0, craftOnly: true, tags: ["weapon"], damage: 8, cooldown: 1.4,
    effects: [{ type: "damage", value: 8, valueMin: 6, valueMax: 10 }],
  }),
  crossblades: defItem({
    id: "crossblades", name: "Скрещённые клинки", icon: "⚔️", color: "#a371f7",
    shape: [[0, 0], [1, 0], [0, 1]], rarity: "epic", cost: 0, craftOnly: true, tags: ["weapon"], damage: 15, cooldown: 2.6,
    effects: [{ type: "damage", value: 15, valueMin: 12, valueMax: 18 }],
  }),
  spectral_dagger: defItem({
    id: "spectral_dagger", name: "Призрачный кинжал", icon: "👻", color: "#a371f7",
    shape: [[0, 0]], rarity: "uncommon", cost: 0, craftOnly: true, tags: ["weapon", "magic"], damage: 5, cooldown: 1.6,
    effects: [{ type: "damage", value: 5, damageType: "magic" }],
  }),
  manathirst: defItem({
    id: "manathirst", name: "Жаждущий маны", icon: "🩸", color: "#a371f7",
    shape: shapeRect(1, 2), rarity: "rare", cost: 0, craftOnly: true, tags: ["weapon", "magic"], damage: 6, cooldown: 2.2,
    effects: [
      { type: "damage", value: 6, damageType: "magic" },
      { type: "lifesteal", value: 0.15, trigger: "passive" },
    ],
  }),
  enchanted_staff: defItem({
    id: "enchanted_staff", name: "Магический посох", icon: "🪄", color: "#bc8cff",
    shape: shapeRect(1, 2), rarity: "uncommon", cost: 0, craftOnly: true, tags: ["weapon", "magic"], damage: 5, cooldown: 2.2,
    effects: [{ type: "damage", value: 5, damageType: "magic" }],
  }),
  shovel: defItem({
    id: "shovel", name: "Лопата", icon: "⛏️", color: "#8b6914",
    shape: shapeRect(1, 2), rarity: "uncommon", cost: 0, craftOnly: true, tags: ["weapon"], damage: 4, cooldown: 2.5,
    effects: [{ type: "damage", value: 4 }],
  }),
  eggscalibur: defItem({
    id: "eggscalibur", name: "Яйце-экскалибур", icon: "🥚", color: "#f0c14b",
    shape: [[0, 0], [1, 0], [0, 1]], rarity: "legendary", cost: 0, craftOnly: true, tags: ["weapon"], damage: 18, cooldown: 3,
    effects: [{ type: "damage", value: 18, valueMin: 14, valueMax: 22 }],
  }),
};

function getShopEligibleItems(playerClass) {
  return Object.values(ITEM_CATALOG).filter((item) => {
    if (item.isContainer) return false;
    if (item.craftOnly) return false;
    if (item.classRestriction && item.classRestriction !== playerClass) return false;
    return true;
  });
}

function isUtilityItem(item) {
  return !!(item?.tags?.includes("utility"));
}

function isItemAffordable(item, gold) {
  return (item?.cost ?? 0) <= (gold ?? 0);
}

function getUtilityShopItems(playerClass) {
  return getShopEligibleItems(playerClass).filter(isUtilityItem);
}

function getAffordableShopItems(playerClass, gold) {
  return getShopEligibleItems(playerClass).filter((item) => isItemAffordable(item, gold));
}

function collectLoadoutTags(items) {
  const tags = new Set();
  items.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    if (def?.tags) def.tags.forEach((t) => tags.add(t));
  });
  return [...tags];
}

function shouldGrantBagReward(roundNum) {
  return BAG_REWARD_ROUNDS.includes(roundNum);
}

function getShopContainerItems() {
  return Object.values(ITEM_CATALOG).filter(
    (item) => item.isContainer && item.shopContainer && !item.immovable,
  );
}

function isContainerAvailableInShop(item, round = 1) {
  if (!item?.shopContainer) return false;
  return (item.minShopRound || 1) <= round;
}

function itemHasActivatableEffects(def) {
  return (def.effects || []).some((e) => e.trigger !== "passive" && e.type !== "passiveDefense"
    && e.type !== "statMult" && e.type !== "passiveMaxHp" && e.type !== "lifesteal"
    && e.type !== "shieldBlockMult" && e.type !== "shieldBreakBonus" && e.type !== "crit"
    && e.type !== "dodgePeriodic" && e.type !== "groundFire" && e.type !== "repeatCast");
}
