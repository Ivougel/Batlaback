/**
 * Каталог предметов — данные, теги, эффекты, синергии.
 * Логика боя интерпретирует effects[] универсально.
 */

/** Глобальный масштаб интерфейса (1 = базовый, ~1.25 = +25%). */
const UI_SCALE = 1;

function uiPx(value) {
  const scale = (typeof LayoutScales !== "undefined" && LayoutScales.gameScale)
    ? LayoutScales.gameScale()
    : (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--game-scale")) || 1);
  return Math.round(value * scale);
}

/** Отступ цветной плитки предмета внутри клетки (совпадает с roundRect в drawLoadoutItems). */
const CELL_TILE_PAD = 3;

const CELL_EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const EMOJI_WARMUP_GLYPHS = ["🗡️", "🛡️", "🔮", "🥚", "👢"];

let cellEmojiWarmupKey = "";

/** Прогрев TextMetrics после смены bitmap canvas (первый кадр боя иначе без ink bbox). */
function warmupCellEmojiMetrics(ctx) {
  if (!ctx) return;
  ctx.save();
  EMOJI_WARMUP_GLYPHS.forEach((glyph) => {
    [14, 24, 28].forEach((px) => {
      ctx.font = `${px}px ${CELL_EMOJI_FONT}`;
      ctx.measureText(glyph);
    });
  });
  ctx.restore();
  const c = ctx.canvas;
  cellEmojiWarmupKey = c ? `${c.width}x${c.height}` : "default";
}

function ensureCellEmojiMetrics(ctx) {
  if (!ctx) return;
  const c = ctx.canvas;
  const key = c ? `${c.width}x${c.height}` : "default";
  if (key === cellEmojiWarmupKey) return;
  warmupCellEmojiMetrics(ctx);
}

/** Рисует emoji в точке (cx, cy) внутри квадрата innerSize×innerSize. */
function drawCellEmojiAt(ctx, icon, cx, cy, innerSize) {
  ensureCellEmojiMetrics(ctx);
  const size = Math.max(14, Math.round(Math.max(1, innerSize) * 0.62));
  ctx.save();
  ctx.font = `${size}px ${CELL_EMOJI_FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const m = ctx.measureText(icon);
  const inkW = (m.actualBoundingBoxLeft ?? 0) + (m.actualBoundingBoxRight ?? 0);
  const inkH = (m.actualBoundingBoxAscent ?? 0) + (m.actualBoundingBoxDescent ?? 0);
  const hasBBox = inkW > 0 && inkH > 0;

  let drawX;
  let drawY;
  if (hasBBox) {
    // Safari/iOS: center/middle ломает цветные emoji — центрируем по ink bbox.
    const centerOffsetX = ((m.actualBoundingBoxLeft ?? 0) + (m.actualBoundingBoxRight ?? 0)) / 2;
    const centerOffsetY = ((m.actualBoundingBoxDescent ?? 0) - (m.actualBoundingBoxAscent ?? 0)) / 2;
    drawX = cx - centerOffsetX;
    drawY = cy - centerOffsetY;
  } else {
    const textW = m.width > 0 ? m.width : size;
    const ascent = m.emHeightAscent ?? size * 0.85;
    const descent = m.emHeightDescent ?? size * 0.15;
    drawX = cx - textW / 2;
    drawY = cy + (descent - ascent) / 2;
  }
  ctx.fillText(icon, drawX, drawY);
  ctx.restore();
}

/** Центрирует emoji внутри одной клетки сетки (цветной плитки), не по центру всей фигуры. */
function drawCellEmoji(ctx, icon, x, y, w, h, pad = CELL_TILE_PAD) {
  const innerW = Math.max(1, w - pad * 2);
  const innerH = Math.max(1, h - pad * 2);
  const cx = x + pad + innerW / 2;
  const cy = y + pad + innerH / 2;
  drawCellEmojiAt(ctx, icon, cx, cy, Math.min(innerW, innerH));
}

/** Разбивает строку иконки на 1–2 эмодзи (поддержка ZWJ-последовательностей). */
function splitItemIconString(icon) {
  if (!icon) return ["📦"];
  const str = String(icon).trim();
  if (!str) return ["📦"];
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const parts = [...new Intl.Segmenter().segment(str)].map((s) => s.segment).filter(Boolean);
    if (parts.length) return parts.slice(0, 2);
  }
  const graphemes = str.match(/\p{Extended_Pictographic}(\uFE0F|\uFE0E)?(\u200D\p{Extended_Pictographic}(\uFE0F|\uFE0E)?)*/gu);
  if (graphemes?.length) return graphemes.slice(0, 2);
  return [str];
}

function getItemIcons(def) {
  return splitItemIconString(def?.icon);
}

/** В сокете — только основной глиф (цвет сердца), без маркера тира (◇/◆/💎/…). */
function getSocketGemDisplayIcon(def) {
  const icons = getItemIcons(def);
  if (!icons.length) return "💎";
  if (icons.length === 1) return icons[0];
  const isGem = def?.tags?.includes("gem")
    || (typeof isGemItem === "function" && def?.id && isGemItem(def.id));
  return isGem ? icons[icons.length - 1] : icons[0];
}

/** HTML для магазина / скамейки: до 2 эмодзи в одной подложке, слева направо. */
function renderItemIconsHTML(def) {
  const icons = getItemIcons(def);
  if (!icons.length) return `<span class="icon-glyph" aria-hidden="true">📦</span>`;
  if (icons.length === 1) return `<span class="icon-glyph" aria-hidden="true">${icons[0]}</span>`;
  return `<span class="icon-duo" aria-hidden="true">${icons.map((glyph) => `<span class="icon-glyph">${glyph}</span>`).join("")}</span>`;
}

/** Класс оболочки иконки: два эмодзи — та же подложка, уже глифы внутри. */
function getItemIconShellClass(def) {
  return getItemIcons(def).length > 1 ? "icon icon--duo" : "icon";
}

/** Компактно: оба эмодзи в одной клетке (магазин, скамейка, 1×1 на поле). */
function drawItemIcons(ctx, icons, x, y, w, h, pad = CELL_TILE_PAD) {
  const list = (icons || []).slice(0, 2);
  if (!list.length) return;
  if (list.length === 1) {
    drawCellEmoji(ctx, list[0], x, y, w, h, pad);
    return;
  }
  const innerW = Math.max(1, w - pad * 2);
  const innerH = Math.max(1, h - pad * 2);
  const slotW = innerW / list.length;
  list.forEach((icon, i) => {
    const cx = x + pad + slotW * i + slotW / 2;
    const cy = y + pad + innerH / 2;
    drawCellEmojiAt(ctx, icon, cx, cy, Math.min(slotW, innerH) * 0.92);
  });
}

/**
 * Иконки размещённого предмета: при форме >1 клетки — по эмодзи на ячейку,
 * иначе оба эмодзи компактно в якорной клетке.
 */
function drawPlacedItemIcons(ctx, def, item, cellRectFn) {
  const layout = typeof getPlacedItemVisualLayout === "function"
    ? getPlacedItemVisualLayout(item, def)
    : null;

  if (layout?.iconSlots?.length) {
    layout.iconSlots.forEach((slot) => {
      const [c, r] = slot.cell;
      const rect = cellRectFn(c, r);
      drawItemIcons(ctx, slot.icons, rect.x, rect.y, rect.w, rect.h);
    });
    return;
  }

  const icons = getItemIcons(def);
  const cells = typeof getItemCells === "function" ? getItemCells(item) : [];
  if (cells.length > 1 && icons.length > 1) {
    cells.slice(0, icons.length).forEach(([c, r], i) => {
      const rect = cellRectFn(c, r);
      drawCellEmoji(ctx, icons[i], rect.x, rect.y, rect.w, rect.h);
    });
    return;
  }
  const [iconCol, iconRow] = typeof getItemIconCell === "function"
    ? getItemIconCell(item)
    : [item.col, item.row];
  const rect = cellRectFn(iconCol, iconRow);
  drawItemIcons(ctx, icons, rect.x, rect.y, rect.w, rect.h);
}

/** Камни в свободных клетках формы; пустые сокеты — индикатор в клетке или оверлей. */
function drawGemInCell(ctx, gemDef, rect, pad = typeof CELL_TILE_PAD !== "undefined" ? CELL_TILE_PAD : 3) {
  if (!gemDef) return;
  const ix = rect.x + pad;
  const iy = rect.y + pad;
  const iw = rect.w - pad * 2;
  const ih = rect.h - pad * 2;
  const round = typeof roundRect === "function" ? roundRect : null;

  ctx.fillStyle = `${gemDef.color || "#d2a8ff"}bb`;
  if (round) {
    round(ix, iy, iw, ih, 5, ctx);
    ctx.fill();
    ctx.strokeStyle = RARITY_COLORS[gemDef.rarity] || "#f0c14b";
    ctx.lineWidth = 2;
    round(ix, iy, iw, ih, 5, ctx);
    ctx.stroke();
  } else {
    ctx.fillRect(ix, iy, iw, ih);
    ctx.strokeStyle = RARITY_COLORS[gemDef.rarity] || "#f0c14b";
    ctx.lineWidth = 2;
    ctx.strokeRect(ix, iy, iw, ih);
  }
  drawCellEmoji(ctx, getSocketGemDisplayIcon(gemDef), rect.x, rect.y, rect.w, rect.h, pad);
}

function drawEmptySocketInCell(ctx, rect, pad = typeof CELL_TILE_PAD !== "undefined" ? CELL_TILE_PAD : 3) {
  const ix = rect.x + pad;
  const iy = rect.y + pad;
  const iw = rect.w - pad * 2;
  const ih = rect.h - pad * 2;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = Math.min(iw, ih) * 0.2;

  ctx.fillStyle = "rgba(88,60,140,0.35)";
  ctx.fillRect(ix, iy, iw, ih);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(188,140,255,0.75)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawItemSocketVisuals(ctx, item, def, cellRectFn) {
  if (typeof getPlacedItemVisualLayout !== "function") return;
  const layout = getPlacedItemVisualLayout(item, def);
  if (!layout.gemSlots.length) return;

  layout.gemSlots.forEach((slot) => {
    const gemDef = slot.gemId ? ITEM_CATALOG[slot.gemId] : null;

    if (slot.cell) {
      const [c, r] = slot.cell;
      const rect = cellRectFn(c, r);
      ctx.save();
      if (gemDef) drawGemInCell(ctx, gemDef, rect);
      else drawEmptySocketInCell(ctx, rect);
      ctx.restore();
      return;
    }

    if (!slot.overlay) return;
    const [iconCol, iconRow] = typeof getItemIconCell === "function"
      ? getItemIconCell(item)
      : [item.col, item.row];
    const rect = cellRectFn(iconCol, iconRow);
    const badgeW = Math.min(rect.w * 0.55, 28);
    const badgeH = Math.min(rect.h * 0.32, 22);
    const bx = rect.x + (rect.w - badgeW) / 2;
    const by = rect.y + rect.h - badgeH - 4;

    ctx.save();
    if (gemDef) {
      drawGemInCell(ctx, gemDef, { x: bx, y: by, w: badgeW, h: badgeH }, 2);
    } else {
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h - 6;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fill();
      ctx.strokeStyle = "rgba(188,140,255,0.55)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  });
}

const RARITY_COLORS = {
  common: "#8b949e",
  uncommon: "#3fb950",
  rare: "#58a6ff",
  epic: "#a371f7",
  legendary: "#f0c14b",
  godly: "#ff7b72",
  unique: "#ffa657",
};

/** Визуальные стили карточек и названий по rarity из ITEM_CATALOG. */
const RARITY_UI = {
  common: { nameColor: "#8b949e", borderColor: "#484f58", glow: null },
  uncommon: { nameColor: "#3fb950", borderColor: "#3fb950", glow: "soft" },
  rare: { nameColor: "#58a6ff", borderColor: "#58a6ff", glow: "medium" },
  epic: { nameColor: "#a371f7", borderColor: "#a371f7", glow: "medium" },
  legendary: { nameColor: "#f0c14b", borderColor: "#f0c14b", glow: "strong" },
  godly: { nameColor: "#ff7b72", borderColor: "#ff7b72", glow: "strong" },
  unique: { nameColor: "#ffa657", borderColor: "#ffa657", glow: "strong" },
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
  cold: "лёд",
  holy: "святой",
  dark: "тёмный",
  vampiric: "вампирский",
  luck: "удача",
  pet: "питомец",
  potion: "зелье",
  debuff: "дебафф",
  melee: "ближний",
  ranged: "дальний",
  spikes: "шипы",
  stun: "оглушение",
  accessory: "аксессуар",
  ring: "кольцо",
  amulet: "амулет",
  necklace: "ожерелье",
  gloves: "перчатки",
  shoes: "обувь",
  helmet: "шлем",
  musical: "музыка",
  consumable: "расходник",
  card: "карта",
  treasure: "сокровище",
  heal: "лечение",
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
function normalizeItemShape(shape) {
  if (Array.isArray(shape) && shape.length) return shape;
  if (shape && typeof shape.w === "number" && typeof shape.h === "number") {
    const cells = [];
    for (let r = 0; r < shape.h; r++) {
      for (let c = 0; c < shape.w; c++) cells.push([c, r]);
    }
    return cells.length ? cells : [[0, 0]];
  }
  return [[0, 0]];
}

function renderItemShapeMiniHTML(def, options = {}) {
  const shape = normalizeItemShape(def?.shape);
  if (!shape.length) return "";

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

/**
 * Стоимость выносливости: оружие и активные гемы.
 * Подогнано под пул 40 и regen 5+1/оружие: быстрые клинки платят по CD-floor.
 */
const STAMINA_COST_SCALE = 1.05;
/** Скидка на оружие после баланса (посох и т.д. реже «ломаются» без стamina). */
const STAMINA_WEAPON_COST_MULT = 0.75;
/** Активные гемы (кристалл и т.п.) делят пул с оружием. */
const GEM_ACTIVATION_STAMINA_COST = 3;
/** Бенчмарк: STAMINA_REGEN_PER_SEC (5) + бонус за одно оружие (1). */
const STAMINA_COST_REGEN_BENCHMARK = 6;

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
  if (cost <= 0) cost = 4;
  const cd = opts.cooldown ?? 2.5;
  const cdFloor = Math.ceil(STAMINA_COST_REGEN_BENCHMARK * cd * 0.95);
  cost = Math.max(cost, cdFloor);
  return Math.max(1, Math.ceil(cost * STAMINA_COST_SCALE * STAMINA_WEAPON_COST_MULT));
}

function getItemStaminaCost(def) {
  if (!def || !itemHasActivatableEffects(def)) return 0;
  if (def.tags?.includes("weapon")) {
    if (typeof def.staminaCost === "number" && def.staminaCost > 0) {
      return Math.max(1, Math.ceil(def.staminaCost * STAMINA_WEAPON_COST_MULT));
    }
    return computeItemStaminaCostFromOpts(def);
  }
  if (def.tags?.includes("gem")) return GEM_ACTIVATION_STAMINA_COST;
  if (def.tags?.includes("food")) {
    const hasHeal = (def.effects || []).some(
      (e) => e.type === "heal" || (e.type === "periodic" && Number(e.heal) > 0),
    );
    if (hasHeal) {
      const healFx = (def.effects || []).find((e) => e.type === "heal");
      const healVal = healFx?.value || 2;
      return Math.max(2, Math.min(5, Math.ceil(healVal * 0.75)));
    }
  }
  if (typeof def.staminaCost === "number" && def.staminaCost > 0) return def.staminaCost;
  return 0;
}

function shapeCellCount(shape) {
  return Array.isArray(shape) ? shape.length : 0;
}

function resolveItemSlot(def) {
  const tags = def.tags || [];
  const id = def.id || "";

  if (tags.includes("helmet") || id.includes("helmet")) return "head";
  if (tags.includes("shield")) return "leftHand";
  if (tags.includes("ring")) return "ring";
  if (tags.includes("amulet") || tags.includes("necklace")) return "amulet";
  if (tags.includes("gloves") || tags.includes("gauntlets")) return "gloves";
  if (tags.includes("shoes") || tags.includes("boots")) return "boots";
  if (tags.includes("armor")) return "chest";
  if (tags.includes("weapon")) {
    return shapeCellCount(def.shape) >= 3 ? "twoHand" : "rightHand";
  }

  if (tags.includes("gem") || tags.includes("utility") || tags.includes("food")
    || tags.includes("poison") || tags.includes("consumable") || tags.includes("potion")
    || tags.includes("accessory") || tags.includes("pet") || tags.includes("bag")) {
    return null;
  }
  return null;
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
    slot: resolveItemSlot(opts),
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
    description: opts.description ?? "",
    goldPerRound: opts.goldPerRound ?? 0,
    sockets: opts.sockets ?? 0,
    effects: (opts.effects ?? []).map((e) => enrichDamageEffect(e, opts.rarity)),
    metaEffects: opts.metaEffects ?? [],
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
    shape: shapeRect(1, 2), rarity: "common", cost: 2, tags: ["weapon", "melee"], damage: 2, cooldown: 2.5,
    effects: [{ type: "damage", value: 2, valueMin: 1, valueMax: 3 }],
  }),
  iron_shield: defItem({
    id: "iron_shield", name: "Железный щит", icon: "🛡️", color: "#6e7681",
    shape: shapeRect(2, 1), rarity: "common", cost: 3, tags: ["armor", "shield"], cooldown: 3,
    effects: [{ type: "block", value: 5 }],
    synergies: [{
      id: "shield_weapon_buff", adjacency: "strong", neighborTags: ["weapon"], target: "self",
      apply: { type: "grantBlockBuff", value: 3, buffTargetTags: ["weapon"], cap: 12 },
      desc: "[при блоке]: +3 к атаке соседнего оружия",
    }],
  }),
  poison_dagger: defItem({
    id: "poison_dagger", name: "Ядовитый кинжал", icon: "🗡️", color: "#3fb950",
    shape: shapeRect(1, 2), rarity: "common", cost: 3, tags: ["weapon", "poison", "melee"], damage: 2, cooldown: 2.6,
    effects: [
      { type: "damage", value: 2, valueMin: 1, valueMax: 2 },
      { type: "poison", value: 2, trigger: "on_hit" },
      { type: "extraAttackOnStun", trigger: "passive" },
    ],
  }),
  healing_herb: defItem({
    id: "healing_herb", name: "Целебная трава", icon: "🌿", color: "#56d364",
    shape: shapeRect(2, 1), rarity: "common", cost: 2, tags: ["food", "nature", "heal"], cooldown: 4,
    effects: [{ type: "heal", value: 5 }],
    synergies: [{
      id: "nature_food_boost", adjacency: "strong", neighborTags: ["nature"], target: "self",
      apply: { type: "healBonus", value: 1 }, desc: "+1 лечения рядом с природой",
    }],
  }),
  apple: defItem({
    id: "apple", name: "Яблоко", icon: "🍎", color: "#f85149",
    shape: [[0, 0]], rarity: "common", cost: 1, tags: ["food", "heal"], cooldown: 2.5,
    effects: [{ type: "heal", value: 3 }],
  }),
  iron_helmet: defItem({
    id: "iron_helmet", name: "Железный шлем", icon: "⛑️", color: "#6e7681",
    shape: shapeRect(1, 2), rarity: "common", cost: 2, tags: ["armor", "helmet"], defense: 3, cooldown: 4,
    effects: [
      { type: "passiveDefense", value: 3, trigger: "passive" },
      { type: "block", value: 4 },
    ],
  }),
  dagger: defItem({
    id: "dagger", name: "Кинжал", icon: "🔪", color: "#c9d1d9",
    shape: [[0, 0]], rarity: "common", cost: 2, tags: ["weapon", "melee"], damage: 2, cooldown: 1.5,
    effects: [
      { type: "damage", value: 2, valueMin: 1, valueMax: 3 },
      { type: "extraAttackOnStun", trigger: "passive" },
    ],
  }),
  poison_vial: defItem({
    id: "poison_vial", name: "Яд", icon: "☠️", color: "#3fb950",
    shape: [[0, 0]], rarity: "common", cost: 2, tags: ["poison", "consumable"], cooldown: 4.5,
    effects: [{ type: "poison", value: 1 }],
  }),

  // ── UTILITY — универсальные, слабые, под любой билд и бюджет ──
  bandage: defItem({
    id: "bandage", name: "Бинт", icon: "🩹", color: "#56d364",
    shape: [[0, 0]], rarity: "common", cost: 1, tags: ["utility", "food", "heal"], cooldown: 3,
    effects: [{ type: "heal", value: 3 }],
  }),
  lucky_charm: defItem({
    id: "lucky_charm", name: "Талисман", icon: "🍀", color: "#3fb950",
    shape: shapeRect(2, 2), rarity: "common", cost: 2, tags: ["utility", "gem", "luck", "accessory"], cooldown: 0,
    effects: [{ type: "passiveLuck", value: 35, trigger: "passive" }],
  }),
  cork_charm: defItem({
    id: "cork_charm", name: "Пробка-оберег", icon: "🧿", color: "#6e7681",
    shape: [[0, 0]], rarity: "common", cost: 2, tags: ["utility", "accessory"], cooldown: 5,
    effects: [{ type: "block", value: 2 }],
  }),
  iron_patch: defItem({
    id: "iron_patch", name: "Железная заплатка", icon: "🔩", color: "#6e7681",
    shape: shapeRect(1, 2), rarity: "common", cost: 3, tags: ["utility"], cooldown: 0,
    effects: [{ type: "passiveDefense", value: 2, trigger: "passive" }],
  }),
  antitoxin: defItem({
    id: "antitoxin", name: "Антидот", icon: "🧴", color: "#79c0ff",
    shape: [[0, 0]], rarity: "uncommon", cost: 3, tags: ["utility", "nature", "heal"], cooldown: 3.5,
    effects: [{ type: "heal", value: 4 }],
  }),
  spark_stone: defItem({
    id: "spark_stone", name: "Искорка", icon: "✨", color: "#d2a8ff",
    shape: [[0, 0]], rarity: "uncommon", cost: 4, tags: ["utility", "magic"], cooldown: 3,
    effects: [{ type: "damage", value: 3, damageType: "magic" }],
  }),

  apprentice_staff: defItem({
    id: "apprentice_staff", name: "Посох ученика", icon: "🪄", color: "#a371f7",
    shape: shapeRect(1, 2), rarity: "common", cost: 3, tags: ["weapon", "magic", "melee"], damage: 2, cooldown: 2.5,
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
    shape: shapeRect(1, 2), rarity: "uncommon", cost: 5, tags: ["accessory", "ring"], cooldown: 0,
    effects: [{ type: "statMult", stat: "damage", value: 0.15, trigger: "passive" }],
  }),
  health_stone: defItem({
    id: "health_stone", name: "Камень здоровья", icon: "❤️", color: "#f85149",
    shape: [[0, 0]], rarity: "uncommon", cost: 5, tags: ["gem", "heal"], maxHp: 12, cooldown: 5,
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
    shape: [[0, 0]], rarity: "uncommon", cost: 5, tags: ["accessory", "amulet", "gem"], cooldown: 0,
    effects: [{ type: "statMult", stat: "cooldown", value: -0.12, trigger: "passive" }],
  }),
  fire_crystal: defItem({
    id: "fire_crystal", name: "Огненный кристалл", icon: "🔥", color: "#f0883e",
    shape: shapeRect(1, 2), rarity: "uncommon", cost: 6, tags: ["fire", "gem"], cooldown: 2.5,
    effects: [{ type: "damage", value: 5, damageType: "fire" }],
  }),
  frost_crystal: defItem({
    id: "frost_crystal", name: "Морозный кристалл", icon: "❄️", color: "#79c0ff",
    shape: shapeRect(1, 2), rarity: "uncommon", cost: 6, tags: ["magic", "gem", "cold"], damage: 4, cooldown: 3,
    effects: [
      { type: "damage", value: 4, damageType: "magic" },
      { type: "slow", value: 0.15, duration: 3 },
    ],
  }),
  spider_web: defItem({
    id: "spider_web", name: "Паутина", icon: "🕸️", color: "#8b949e",
    shape: shapeRect(2, 1), rarity: "uncommon", cost: 5, tags: ["nature", "debuff", "utility"], cooldown: 4,
    effects: [{ type: "slow", value: 0.1, duration: 4 }],
  }),
  beast_fang: defItem({
    id: "beast_fang", name: "Клык зверя", icon: "🦷", color: "#d29922",
    shape: [[0, 0]], rarity: "uncommon", cost: 6, tags: ["accessory", "nature"], cooldown: 0,
    effects: [
      { type: "statMult", stat: "cooldown", value: -0.15, trigger: "passive" },
      { type: "statMult", stat: "damage", value: 0.1, trigger: "passive" },
    ],
  }),
  rage_potion: defItem({
    id: "rage_potion", name: "Зелье ярости", icon: "🧪", color: "#f85149",
    shape: [[0, 0]], rarity: "uncommon", cost: 8, tags: ["food", "potion"], cooldown: 6,
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
    shape: shapeRect(1, 3), rarity: "rare", cost: 9, tags: ["weapon", "melee"], damage: 16, cooldown: 3.2,
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
    shape: shapeRect(1, 2), rarity: "rare", cost: 10, tags: ["gem", "vampiric"], damage: 5, cooldown: 3.5,
    effects: [
      { type: "lifesteal", value: 0.22, trigger: "passive" },
      { type: "passiveMaxHp", value: 10, trigger: "passive" },
      { type: "damage", value: 5 },
    ],
  }),
  rune_of_protection: defItem({
    id: "rune_of_protection", name: "Руна защиты", icon: "🔷", color: "#58a6ff",
    shape: shapeRect(1, 2), rarity: "rare", cost: 7, tags: ["magic", "utility"], cooldown: 3.5,
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
    rarity: "legendary", cost: 12, tags: ["weapon", "melee"], damage: 25, cooldown: 4.5,
    effects: [
      { type: "damage", value: 25 },
      { type: "shieldBreakBonus", value: 0.5, trigger: "passive" },
    ],
  }),
  royal_helmet: defItem({
    id: "royal_helmet", name: "Королевский шлем", icon: "👑", color: "#f0c14b",
    shape: shapeRect(1, 2), classRestriction: "warrior",
    rarity: "legendary", cost: 10, tags: ["armor", "helmet"], defense: 10, maxHp: 15, cooldown: 2.5,
    effects: [
      { type: "passiveDefense", value: 10, trigger: "passive" },
      { type: "passiveMaxHp", value: 15, trigger: "passive" },
      { type: "block", value: 10 },
    ],
    synergies: [{
      id: "royal_block_buff", adjacency: "strong", neighborTags: ["weapon"], target: "self",
      apply: { type: "grantBlockBuff", value: 4, buffTargetTags: ["weapon"], cap: 20 },
      desc: "[при блоке]: +4 к атаке соседнего оружия (макс. +20 за бой)",
    }],
  }),
  smoke_bomb: defItem({
    id: "smoke_bomb", name: "Дымовая бомба", icon: "💨", color: "#8b949e",
    shape: shapeRect(1, 2), classRestriction: "rogue",
    rarity: "legendary", cost: 10, tags: ["poison", "utility", "debuff"], cooldown: 4.5,
    effects: [
      { type: "dodgePeriodic", interval: 3, trigger: "passive" },
      { type: "poison", value: 2 },
    ],
  }),
  shadow_blade: defItem({
    id: "shadow_blade", name: "Клинок тени", icon: "🌑", color: "#484f58",
    shape: shapeRect(1, 2), classRestriction: "rogue",
    rarity: "legendary", cost: 15, tags: ["weapon", "poison", "melee"], damage: 13, cooldown: 2,
    effects: [
      { type: "damage", value: 13 },
      { type: "crit", chance: 0.25, doublePoison: true, trigger: "passive" },
    ],
  }),
  fire_staff: defItem({
    id: "fire_staff", name: "Огненный посох", icon: "🔥", color: "#f0883e",
    shape: [[0, 0], [0, 1], [1, 1]], classRestriction: "mage",
    rarity: "legendary", cost: 12, tags: ["weapon", "magic", "fire", "melee"], damage: 11, cooldown: 3,
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
    shape: shapeRect(1, 2), rarity: "uncommon", cost: 0, craftOnly: true, tags: ["weapon", "melee"], damage: 6, cooldown: 2.4,
    effects: [{ type: "damage", value: 6, valueMin: 4, valueMax: 8 }],
  }),
  hero_long_sword: defItem({
    id: "hero_long_sword", name: "Геройский длинный меч", icon: "🗡️", color: "#58a6ff",
    shape: shapeRect(1, 3), rarity: "rare", cost: 0, craftOnly: true, tags: ["weapon", "melee"], damage: 11, cooldown: 2.8,
    effects: [{ type: "damage", value: 11, valueMin: 8, valueMax: 14 }],
  }),
  falcon_blade: defItem({
    id: "falcon_blade", name: "Соколиный клинок", icon: "🦅", color: "#79c0ff",
    shape: shapeRect(1, 2), rarity: "rare", cost: 0, craftOnly: true, tags: ["weapon", "melee"], damage: 8, cooldown: 1.4,
    effects: [{ type: "damage", value: 8, valueMin: 6, valueMax: 10 }],
  }),
  crossblades: defItem({
    id: "crossblades", name: "Скрещённые клинки", icon: "⚔️", color: "#a371f7",
    shape: [[0, 0], [1, 0], [0, 1]], rarity: "epic", cost: 0, craftOnly: true, tags: ["weapon", "melee"], damage: 15, cooldown: 2.6,
    effects: [{ type: "damage", value: 15, valueMin: 12, valueMax: 18 }],
  }),
  spectral_dagger: defItem({
    id: "spectral_dagger", name: "Призрачный кинжал", icon: "👻", color: "#a371f7",
    shape: [[0, 0]], rarity: "uncommon", cost: 0, craftOnly: true, tags: ["weapon", "magic", "melee"], damage: 5, cooldown: 1.6,
    effects: [
      { type: "damage", value: 5, damageType: "magic" },
      { type: "spendStack", stack: "mana", value: 1, trigger: "on_hit", attackBuff: 6 },
      { type: "extraAttackOnStun", trigger: "passive" },
    ],
  }),
  manathirst: defItem({
    id: "manathirst", name: "Жаждущий маны", icon: "🩸", color: "#a371f7",
    shape: shapeRect(1, 2), rarity: "rare", cost: 0, craftOnly: true, tags: ["weapon", "magic", "melee"], damage: 6, cooldown: 2.2,
    effects: [
      { type: "damage", value: 6, damageType: "magic" },
      { type: "lifesteal", value: 0.15, trigger: "passive" },
    ],
  }),
  enchanted_staff: defItem({
    id: "enchanted_staff", name: "Магический посох", icon: "🪄", color: "#bc8cff",
    shape: shapeRect(1, 2), rarity: "uncommon", cost: 0, craftOnly: true, tags: ["weapon", "magic", "melee"], damage: 5, cooldown: 2.2,
    effects: [{ type: "damage", value: 5, damageType: "magic" }],
  }),
  shovel: defItem({
    id: "shovel", name: "Лопата", icon: "⛏️", color: "#58a6ff",
    shape: shapeRect(1, 2), rarity: "rare", cost: 8, craftOnly: true,
    tags: ["weapon", "debuff", "melee", "craft"], damage: 6, cooldown: 2.2, staminaCost: 1.5,
    effects: [
      { type: "damage", value: 6, valueMin: 5, valueMax: 8 },
      { type: "slow", value: 0.12, duration: 3, chance: 0.4 },
    ],
    metaEffects: [
      { phase: "shop_enter", type: "dig_item", value: 1 },
    ],
    description: "[при входе в магазин]: Выкопать случайный предмет. [при попадании]: 40% шанс наложить 1 стак(ов)",
  }),
  eggscalibur: defItem({
    id: "eggscalibur", name: "Яйце-экскалибур", icon: "🥚", color: "#f0c14b",
    shape: [[0, 0], [1, 0], [0, 1]], rarity: "legendary", cost: 0, craftOnly: true, tags: ["weapon", "melee"], damage: 18, cooldown: 3,
    effects: [{ type: "damage", value: 18, valueMin: 14, valueMax: 22 }],
  }),
};

Object.values(ITEM_CATALOG).forEach((item) => {
  item.slot = resolveItemSlot(item);
});

function isShopEligibleItem(item, playerClass = null, round = 1) {
  if (!item || item.craftOnly) return false;
  if (typeof CRAFT_OUTPUT_IDS !== "undefined" && CRAFT_OUTPUT_IDS.has(item.id)) return false;
  if (item.classRestriction && item.classRestriction !== playerClass) return false;
  if (item.isContainer) {
    if (!item.shopContainer || item.immovable) return false;
    return isContainerAvailableInShop(item, round);
  }
  return true;
}

function getShopEligibleItems(playerClass, round = 1) {
  return Object.values(ITEM_CATALOG).filter((item) => isShopEligibleItem(item, playerClass, round));
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

function getAffordableShopItems(playerClass, gold, round = 1) {
  return getShopEligibleItems(playerClass, round).filter((item) => isItemAffordable(item, gold));
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

const COOLDOWN_ACTIVATION_EFFECT_TYPES = new Set([
  "damage",
  "heal",
  "block",
  "poison",
  "slow",
  "buffTimed",
  "lifesteal",
  "onHitCapBonus",
  "breakBlockOnHit",
  "selfPoison",
]);

const COOLDOWN_ACTIVATION_SKIP_TRIGGERS = new Set([
  "passive",
  "battle_start",
  "on_hit",
  "on_block",
  "on_miss",
  "on_defend",
  "on_revive",
  "on_foe_heal",
]);

function effectParticipatesInCooldownActivation(effect) {
  if (!effect?.type || !COOLDOWN_ACTIVATION_EFFECT_TYPES.has(effect.type)) return false;
  const trigger = effect.trigger || effect.phase;
  if (trigger && COOLDOWN_ACTIVATION_SKIP_TRIGGERS.has(trigger)) return false;
  return true;
}

function itemHasActivatableEffects(def) {
  if (!def) return false;
  return (def.effects || []).some(effectParticipatesInCooldownActivation);
}
