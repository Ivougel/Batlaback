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
/** Доля внутренней клетки под emoji (магазин / HUD используют ~65–80% высоты слота). */
const CELL_EMOJI_FILL = 0.74;

/**
 * Заливка формы предмета без полос между соседними клетками (мостит cell-gap).
 */
function drawMergedShapeCells(ctx, team, anchorCol, anchorRow, shape, options = {}) {
  if (!ctx || !shape?.length) return;
  const {
    fillStyle = null,
    strokeStyle = null,
    lineWidth = 0,
    inset = 0,
    radius = 0,
    bridgeGaps = true,
  } = options;

  const cells = shape.map(([dx, dy]) => [anchorCol + dx, anchorRow + dy]);
  const cellSet = new Set(cells.map(([c, r]) => `${c},${r}`));

  const paintFill = (x, y, w, h) => {
    const ix = x + inset;
    const iy = y + inset;
    const iw = w - inset * 2;
    const ih = h - inset * 2;
    if (iw <= 0 || ih <= 0) return;
    if (radius > 0 && typeof roundRect === "function") {
      roundRect(ix, iy, iw, ih, radius);
      ctx.fill();
    } else {
      ctx.fillRect(ix, iy, iw, ih);
    }
  };

  ctx.save();
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    cells.forEach(([c, r]) => {
      const rect = cellRect(team, c, r);
      paintFill(rect.x, rect.y, rect.w, rect.h);
    });
    if (bridgeGaps) {
      cells.forEach(([c, r]) => {
        if (cellSet.has(`${c + 1},${r}`)) {
          const left = cellRect(team, c, r);
          const right = cellRect(team, c + 1, r);
          const bx = left.x + left.w - inset;
          const bw = (right.x + inset) - bx;
          if (bw > 0) ctx.fillRect(bx, left.y + inset, bw, left.h - inset * 2);
        }
        if (cellSet.has(`${c},${r + 1}`)) {
          const top = cellRect(team, c, r);
          const bottom = cellRect(team, c, r + 1);
          const by = top.y + top.h - inset;
          const bh = (bottom.y + inset) - by;
          if (bh > 0) ctx.fillRect(top.x + inset, by, top.w - inset * 2, bh);
        }
      });
    }
  }

  if (strokeStyle && lineWidth > 0) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    cells.forEach(([c, r]) => {
      const rect = cellRect(team, c, r);
      const ix = rect.x + inset;
      const iy = rect.y + inset;
      const iw = rect.w - inset * 2;
      const ih = rect.h - inset * 2;
      if (iw <= 0 || ih <= 0) return;
      if (radius > 0 && typeof roundRect === "function") {
        roundRect(ix, iy, iw, ih, radius);
        ctx.stroke();
      } else {
        ctx.strokeRect(ix + 0.5, iy + 0.5, Math.max(0, iw - 1), Math.max(0, ih - 1));
      }
    });
  }
  ctx.restore();
}

function drawMergedOccupiedCells(ctx, team, cells, options = {}) {
  if (!cells?.length) return;
  let minCol = Infinity;
  let minRow = Infinity;
  cells.forEach(([c, r]) => {
    minCol = Math.min(minCol, c);
    minRow = Math.min(minRow, r);
  });
  const shape = cells.map(([c, r]) => [c - minCol, r - minRow]);
  drawMergedShapeCells(ctx, team, minCol, minRow, shape, options);
}

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

/** Центр bbox набора клеток (для поворота иконок вокруг фигуры). */
function getCellsBoundsCenter(cells, cellRectFn) {
  if (!cells?.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  cells.forEach(([c, r]) => {
    const { x, y, w, h } = cellRectFn(c, r);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });
  if (!Number.isFinite(minX)) return null;
  return { x: (minX + maxX) * 0.5, y: (minY + maxY) * 0.5 };
}

/** Прямоугольник для отрисовки иконки: для multi-cell с одним эмодзi — весь bbox фигуры. */
function getShapeIconDrawRect(cells, cellRectFn) {
  if (!cells?.length) return null;
  if (cells.length === 1) {
    const [c, r] = cells[0];
    return cellRectFn(c, r);
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  cells.forEach(([c, r]) => {
    const { x, y, w, h } = cellRectFn(c, r);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function getRectCenter(rect) {
  if (!rect) return null;
  return { x: rect.x + rect.w * 0.5, y: rect.y + rect.h * 0.5 };
}

function getItemIconRotationDeg(item, options = {}) {
  const base = (((item?.rotation || 0) % 4) + 4) % 4 * 90;
  return base + (options.extraRotationDeg || 0);
}

function withCanvasRotation(ctx, center, rotationDeg, drawFn) {
  if (!rotationDeg || !center) {
    drawFn();
    return;
  }
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(rotationDeg * Math.PI / 180);
  ctx.translate(-center.x, -center.y);
  drawFn();
  ctx.restore();
}

/** Рисует emoji в точке (cx, cy) внутри квадрата innerSize×innerSize. */
function drawCellEmojiAt(ctx, icon, cx, cy, innerSize, rotationDeg = 0) {
  ensureCellEmojiMetrics(ctx);
  const size = Math.max(14, Math.round(Math.max(1, innerSize) * CELL_EMOJI_FILL));
  ctx.save();
  if (rotationDeg) {
    ctx.translate(cx, cy);
    ctx.rotate(rotationDeg * Math.PI / 180);
    ctx.translate(-cx, -cy);
  }
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
  const sparkles = typeof renderItemEmojiSparklesHTML === "function"
    ? renderItemEmojiSparklesHTML()
    : "";
  const icons = getItemIcons(def);
  if (!icons.length) return `${sparkles}<span class="icon-glyph" aria-hidden="true">📦</span>`;
  if (icons.length === 1) return `${sparkles}<span class="icon-glyph" aria-hidden="true">${icons[0]}</span>`;
  return `${sparkles}<span class="icon-duo" aria-hidden="true">${icons.map((glyph) => `<span class="icon-glyph">${glyph}</span>`).join("")}</span>`;
}

/** Класс оболочки иконки: два эмодзи — та же подложка, уже глифы внутри. */
function getItemIconShellClass(def) {
  const duo = getItemIcons(def).length > 1;
  return duo ? "icon icon--duo item-emoji-sparkle-host" : "icon item-emoji-sparkle-host";
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
function drawPlacedItemIcons(ctx, def, item, cellRectFn, options = {}) {
  const glow = !!options.glow;
  const rotationDeg = getItemIconRotationDeg(item, options);
  const cells = typeof getItemCells === "function" ? getItemCells(item) : [[item.col, item.row]];
  const icons = getItemIcons(def);
  const multiIconPerCell = cells.length > 1 && icons.length > 1;
  const useShapeBounds = cells.length > 1 && !multiIconPerCell;

  const drawIcons = () => {
    const layout = typeof getPlacedItemVisualLayout === "function"
      ? getPlacedItemVisualLayout(item, def)
      : null;

    if (layout?.iconSlots?.length) {
      layout.iconSlots.forEach((slot) => {
        const slotCells = slot.useShapeBounds ? cells : null;
        const rect = slot.useShapeBounds && slotCells?.length
          ? getShapeIconDrawRect(slotCells, cellRectFn)
          : cellRectFn(slot.cell[0], slot.cell[1]);
        const pivot = slot.useShapeBounds
          ? getCellsBoundsCenter(cells, cellRectFn)
          : getRectCenter(rect);
        withCanvasRotation(ctx, pivot, rotationDeg, () => {
          drawItemIcons(ctx, slot.icons, rect.x, rect.y, rect.w, rect.h);
        });
      });
      return;
    }

    if (multiIconPerCell) {
      cells.slice(0, icons.length).forEach(([c, r], i) => {
        const rect = cellRectFn(c, r);
        withCanvasRotation(ctx, getRectCenter(rect), rotationDeg, () => {
          drawCellEmoji(ctx, icons[i], rect.x, rect.y, rect.w, rect.h);
        });
      });
      return;
    }

    const rect = useShapeBounds
      ? getShapeIconDrawRect(cells, cellRectFn)
      : cellRectFn(
        ...(typeof getItemIconCell === "function" ? getItemIconCell(item) : [item.col, item.row]),
      );
    withCanvasRotation(ctx, getCellsBoundsCenter(cells, cellRectFn), rotationDeg, () => {
      drawItemIcons(ctx, icons, rect.x, rect.y, rect.w, rect.h);
    });
  };

  if (!glow && !options.craftPendingGlow && !options.craftMergeChargeGlow) {
    drawIcons();
    return;
  }

  const lightFx = typeof BattleFxTier !== "undefined" && BattleFxTier.isLightBattleFx();
  if (lightFx && !options.craftPendingGlow && !options.craftMergeChargeGlow) {
    drawIcons();
    return;
  }

  ctx.save();
  if (options.craftMergeChargeGlow) {
    const pulse = 0.55 + Math.sin((typeof synergyAnimTime !== "undefined" ? synergyAnimTime : 0) * 5.4) * 0.45;
    ctx.shadowColor = "rgba(255, 240, 180, 1)";
    ctx.shadowBlur = 24 + pulse * 22;
    ctx.globalAlpha = 0.92 + pulse * 0.08;
  } else if (options.craftPendingGlow) {
    const pulse = 0.65 + Math.sin((typeof synergyAnimTime !== "undefined" ? synergyAnimTime : 0) * 2.6) * 0.35;
    ctx.shadowColor = "rgba(255, 220, 140, 0.98)";
    ctx.shadowBlur = 18 + pulse * 16;
  } else {
    ctx.shadowColor = "rgba(255, 230, 120, 0.95)";
    ctx.shadowBlur = 16;
  }
  drawIcons();
  ctx.restore();
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
  speed: "скорость",
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

/** Синергии для справочника / тултипа — только ⭐/◆ слоты. */
function getItemWikiSynergyLines(itemIdOrDef) {
  const def = typeof itemIdOrDef === "string" ? ITEM_CATALOG[itemIdOrDef] : itemIdOrDef;
  if (!def) return [];
  if (typeof getPlacementSlotTooltipLines !== "function") return [];
  return getPlacementSlotTooltipLines(def.id);
}

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
    ? (maxDim <= 2 ? 8 : maxDim === 3 ? 7 : 6)
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
    sockets: 0,
    effects: (opts.effects ?? []).map((e) => enrichDamageEffect(e, opts.rarity)),
    metaEffects: opts.metaEffects ?? [],
    isContainer: false,
    craftOnly: opts.craftOnly ?? false,
  };
}

/** Данные предметов — единый каталог в items-catalog.js (см. tools/items-migrated.json). */

function isCraftOutputItemId(itemId) {
  if (!itemId) return false;
  if (typeof CRAFT_OUTPUT_IDS !== "undefined" && CRAFT_OUTPUT_IDS.has(itemId)) return true;
  if (typeof getCraftOutputItemIds === "function") {
    return getCraftOutputItemIds().includes(itemId);
  }
  return false;
}

function isItemAllowedForHeroClass(itemOrId, heroClass) {
  const def = typeof itemOrId === "string" ? ITEM_CATALOG[itemOrId] : itemOrId;
  if (!def?.classRestriction) return true;
  if (typeof shouldApplyClassItemRestriction === "function" && !shouldApplyClassItemRestriction()) {
    return true;
  }
  if (!heroClass) return true;
  return def.classRestriction === heroClass;
}

function getLoadoutHeroClass() {
  if (typeof playerClass !== "undefined" && playerClass) return playerClass;
  if (typeof getSideState === "function") {
    const side = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
    const st = getSideState(side);
    if (st?.classId) return st.classId;
  }
  return null;
}

function isShopEligibleItem(item, playerClass = null, round = 1) {
  if (!item) return false;
  const maxAccount = typeof isMaxAccountMode === "function" && isMaxAccountMode();
  if (item.craftOnly) return false;
  if ((item.tags || []).includes("gem")) return false;
  if (item.isEnhancementItem) return false;
  if (item.isBuildKey) return false;
  if (item.isAmplifierItem) return false;
  if (isCraftOutputItemId(item.id)) return false;
  if (typeof isItemAllowedForHeroClass === "function" && !isItemAllowedForHeroClass(item, playerClass)) {
    return false;
  }
  if (item.isContainer) {
    const shopContainer = item.shopContainer
      || (maxAccount && !item.immovable && (item.cost ?? 0) > 0);
    if (!shopContainer) return false;
    return isContainerAvailableInShop(item, round);
  }
  return true;
}

function getShopEligibleItems(playerClass, round = 1, opts = {}) {
  let pool = Object.values(ITEM_CATALOG).filter((item) => isShopEligibleItem(item, playerClass, round));
  if (typeof filterItemsToPool120 === "function" && typeof shouldFilterToPool120 === "function" && shouldFilterToPool120()) {
    pool = filterItemsToPool120(pool);
  }
  const maxAccount = typeof isMaxAccountMode === "function" && isMaxAccountMode();
  const metaActive = !maxAccount && typeof MetaProgress !== "undefined" && MetaProgress.isActiveForRun();
  const applyMeta = !maxAccount && (opts.applyMetaUnlockFilter || metaActive);
  if (applyMeta && metaActive) {
    pool = pool.filter((item) => MetaProgress.isItemUnlocked(item.id, playerClass));
  }
  return pool;
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
  const maxAccount = typeof isMaxAccountMode === "function" && isMaxAccountMode();
  const purchasable = item?.shopContainer
    || (maxAccount && !item?.immovable && (item?.cost ?? 0) > 0);
  if (!purchasable) return false;
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
