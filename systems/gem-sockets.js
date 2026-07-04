/**
 * Камни (Gemstones) — вставка в сокеты предметов как в Backpack Battles.
 */

const GEM_TIER_POWER = {
  chipped: 1,
  flawed: 1.25,
  regular: 1.5,
  flawless: 2,
  perfect: 2.5,
};

function parseGemId(itemId) {
  const m = String(itemId || "").match(
    /^(chipped|flawed|regular|flawless|perfect)_(ruby|sapphire|emerald|topaz|amethyst)$/,
  );
  if (!m) return null;
  return { tier: m[1], type: m[2] };
}

function isGemItem(itemId) {
  if (!itemId) return false;
  if (parseGemId(itemId)) return true;
  return !!ITEM_CATALOG[itemId]?.tags?.includes("gem");
}

function getItemSocketCount(itemId) {
  const n = ITEM_CATALOG[itemId]?.sockets;
  return typeof n === "number" && n > 0 ? n : 0;
}

function ensureSocketArray(item) {
  const count = getItemSocketCount(item.itemId);
  if (!count) return item;
  const gems = Array.isArray(item.socketedGems) ? [...item.socketedGems] : [];
  while (gems.length < count) gems.push(null);
  return { ...item, socketedGems: gems.slice(0, count) };
}

function getSocketCategory(def) {
  if (!def) return "accessory";
  const tags = def.tags || [];
  if (tags.includes("weapon")) return "weapon";
  if (tags.includes("armor") || tags.includes("shield")) return "armor";
  return "accessory";
}

function canSocketGem(hostItem, gemId) {
  if (!hostItem || !isGemItem(gemId)) return false;
  if (getItemSocketCount(hostItem.itemId) <= 0) return false;
  const normalized = ensureSocketArray(hostItem);
  return normalized.socketedGems.some((g) => !g);
}

function socketGemIntoItem(hostItem, gemId) {
  if (!canSocketGem(hostItem, gemId)) return null;
  const normalized = ensureSocketArray(hostItem);
  const idx = normalized.socketedGems.findIndex((g) => !g);
  const next = [...normalized.socketedGems];
  next[idx] = gemId;
  return { ...normalized, socketedGems: next };
}

function findSocketHostAt(items, col, row, gemId, excludeUid = null) {
  const host = typeof findItemAtSlot === "function"
    ? findItemAtSlot(items, col, row)
    : items.find((item) => getItemCells(item).some(([c, r]) => c === col && r === row));
  if (!host || host.uid === excludeUid) return null;
  if (isGemItem(host.itemId)) return null;
  return canSocketGem(host, gemId) ? host : null;
}

function getGemSocketBattleEffects(gemId, hostDef) {
  const parsed = parseGemId(gemId);
  if (!parsed || !hostDef) return [];
  const cat = getSocketCategory(hostDef);
  const p = GEM_TIER_POWER[parsed.tier] || 1;
  const t = parsed.type;
  const passive = (type, extra = {}) => ({ type, trigger: "passive", ...extra });

  if (cat === "weapon") {
    if (t === "ruby") return [{ type: "groundFire", value: Math.max(1, Math.round(p)) }];
    if (t === "sapphire") return [{ type: "slow", value: 0.04 * p, duration: 3 }];
    if (t === "emerald") return [{ type: "heal", value: Math.max(1, Math.round(2 * p)) }];
    if (t === "topaz") return [passive("statMult", { stat: "cooldown", value: -0.03 * p })];
    if (t === "amethyst") return [{ type: "damage", value: Math.max(1, Math.round(p)), damageType: "magic" }];
  }
  if (cat === "armor") {
    if (t === "ruby") return [passive("passiveDefense", { value: Math.max(1, Math.round(p)) })];
    if (t === "sapphire") return [{ type: "block", value: Math.max(1, Math.round(2 * p)) }];
    if (t === "emerald") return [passive("passiveMaxHp", { value: Math.max(2, Math.round(3 * p)) })];
    if (t === "topaz") return [passive("statMult", { stat: "cooldown", value: -0.04 * p })];
    if (t === "amethyst") return [passive("statMult", { stat: "magicDamage", value: 0.05 * p })];
  }
  // accessory / pet / прочее
  if (t === "ruby") return [passive("statMult", { stat: "damage", value: 0.04 * p })];
  if (t === "sapphire") return [passive("passiveLuck", { value: Math.max(2, Math.round(3 * p)) })];
  if (t === "emerald") return [passive("passiveMaxHp", { value: Math.max(2, Math.round(4 * p)) })];
  if (t === "topaz") return [passive("statMult", { stat: "cooldown", value: -0.05 * p })];
  if (t === "amethyst") return [passive("statMult", { stat: "magicDamage", value: 0.06 * p })];
  return [];
}

function formatGemSocketEffectLine(effect) {
  if (!effect) return "";
  const v = effect.value;
  switch (effect.type) {
    case "groundFire":
      return `Жар на попадание (${Math.round(v)})`;
    case "slow":
      return `Замедление ${Math.round(Math.abs(v) * 100)}% на ${effect.duration || 3}с`;
    case "heal":
      return `Лечение +${Math.round(v)} HP`;
    case "damage":
      return `Маг. урон +${Math.round(v)}`;
    case "block":
      return `Блок +${Math.round(v)}`;
    case "passiveDefense":
      return `Защита +${Math.round(v)}`;
    case "passiveMaxHp":
      return `Макс. HP +${Math.round(v)}`;
    case "passiveLuck":
      return `Удача +${Math.round(v)}`;
    case "statMult": {
      if (effect.stat === "cooldown") {
        return `Перезарядка −${Math.round(Math.abs(v) * 100)}%`;
      }
      if (effect.stat === "damage") {
        return `Урон +${Math.round(v * 100)}%`;
      }
      if (effect.stat === "magicDamage") {
        return `Маг. урон +${Math.round(v * 100)}%`;
      }
      return `${effect.stat} ${v}`;
    }
    default:
      return effect.type || "";
  }
}

function describeGemSocketEffects(gemId, hostItemId) {
  const hostDef = ITEM_CATALOG[hostItemId];
  const effects = getGemSocketBattleEffects(gemId, hostDef);
  return effects.map(formatGemSocketEffectLine).filter(Boolean).join(" · ");
}

function getGemSocketCategoryLabel(hostDef) {
  const cat = getSocketCategory(hostDef);
  if (cat === "weapon") return "оружие";
  if (cat === "armor") return "броня";
  return "аксессуар";
}

function getGemSocketHintFromDescription(gemId, hostItemId) {
  const gemDef = ITEM_CATALOG[gemId];
  const hostDef = ITEM_CATALOG[hostItemId];
  if (!gemDef || !hostDef) return describeGemSocketEffects(gemId, hostItemId);

  const desc = gemDef.description || "";
  const cat = getSocketCategory(hostDef);
  const prefixByCat = {
    weapon: "Сокет оружия",
    armor: "Сокет брони",
    accessory: "Сокет аксессуара",
  };
  const prefix = prefixByCat[cat] || "Сокет";
  const segment = desc.split(/\.\s+/).find((part) => part.includes(prefix));
  if (segment) {
    const colon = segment.indexOf(":");
    const tail = colon >= 0 ? segment.slice(colon + 1).trim() : segment.trim();
    if (tail) return tail;
  }

  const effectLine = describeGemSocketEffects(gemId, hostItemId);
  if (effectLine) return effectLine;
  return desc || "";
}

function getGemSocketFeedHint(gemId, hostItemId) {
  const hostDef = ITEM_CATALOG[hostItemId];
  const gemDef = ITEM_CATALOG[gemId];
  const hostName = hostDef?.name || hostItemId;
  const gemName = gemDef?.name || gemId;
  const category = getGemSocketCategoryLabel(hostDef);
  const effectLine = describeGemSocketEffects(gemId, hostItemId);
  const catalogHint = getGemSocketHintFromDescription(gemId, hostItemId);
  const buildHints = typeof getItemBuildHints === "function"
    ? getItemBuildHints(gemDef)
    : (gemDef?.buildHints || "");

  const lines = [
    `${gemName} → [${hostName}] (${category})`,
    effectLine ? `Эффект: ${effectLine}` : null,
    catalogHint && catalogHint !== effectLine ? catalogHint : null,
    buildHints || null,
  ].filter(Boolean);

  return lines.join("\n");
}

function getSocketBattleEffects(item) {
  const hostDef = ITEM_CATALOG[item?.itemId];
  const socketCount = getItemSocketCount(item?.itemId);
  if (!hostDef || socketCount <= 0) return [];
  const normalized = ensureSocketArray(item);
  const gems = Array.isArray(normalized.socketedGems) ? normalized.socketedGems : [];
  const out = [];
  gems.forEach((gemId) => {
    if (!gemId) return;
    out.push(...getGemSocketBattleEffects(gemId, hostDef));
  });
  return out;
}

function getBattleEffectsForItem(item) {
  const def = ITEM_CATALOG[item?.itemId];
  const base = def?.effects || [];
  return [...base, ...getSocketBattleEffects(item)];
}

function formatSocketedGemsLine(item) {
  if (!item || getItemSocketCount(item.itemId) <= 0) return null;
  const normalized = ensureSocketArray(item);
  const gems = Array.isArray(normalized.socketedGems) ? normalized.socketedGems : [];
  const filled = gems.filter(Boolean);
  if (!filled.length) return null;
  const names = filled.map((id) => ITEM_CATALOG[id]?.name || id).join(", ");
  return `💎 Сокеты: ${names}`;
}

function initPlacedItemSockets(item) {
  if (!item || getItemSocketCount(item.itemId) <= 0) return item;
  return ensureSocketArray(item);
}

/**
 * Раскладка иконок предмета и сокетов по клеткам формы.
 * Свободные клетки фигуры (не занятые эмодзи предмета) — под вставленные камни.
 */
function getPlacedItemVisualLayout(item, def) {
  const hostDef = def || ITEM_CATALOG[item?.itemId];
  if (!hostDef || !item) return { iconSlots: [], gemSlots: [] };

  const cells = typeof getItemCells === "function" ? getItemCells(item) : [];
  const icons = typeof getItemIcons === "function" ? getItemIcons(hostDef) : [hostDef.icon || "📦"];
  const socketCount = getItemSocketCount(item.itemId);
  const normalized = ensureSocketArray(item);
  const gems = Array.isArray(item.socketedGems) && item.socketedGems.some(Boolean)
    ? item.socketedGems
    : (normalized.socketedGems || []);

  const multiIcon = cells.length > 1 && icons.length > 1;
  const iconSlots = multiIcon
    ? cells.slice(0, Math.min(cells.length, icons.length)).map((cell, i) => ({
      cell,
      icons: [icons[i]],
    }))
    : [{
      cell: typeof getItemIconCell === "function" ? getItemIconCell(item) : [item.col, item.row],
      icons,
      useShapeBounds: cells.length > 1,
    }];

  const iconCellKeys = new Set(iconSlots.map((s) => `${s.cell[0]},${s.cell[1]}`));
  const freeCells = cells.filter(([c, r]) => !iconCellKeys.has(`${c},${r}`));

  const gemSlots = [];
  for (let i = 0; i < socketCount; i += 1) {
    const dedicatedCell = freeCells[i] || null;
    gemSlots.push({
      index: i,
      gemId: gems[i] || null,
      cell: dedicatedCell,
      overlay: !dedicatedCell,
    });
  }

  return { iconSlots, gemSlots };
}

/** Какая клетка фигуры занята камнем (для заливки фона). */
function getGemCellVisualMap(item, def) {
  const layout = getPlacedItemVisualLayout(item, def);
  const map = new Map();
  layout.gemSlots.forEach((slot) => {
    if (!slot.cell) return;
    map.set(`${slot.cell[0]},${slot.cell[1]}`, {
      gemId: slot.gemId || null,
      emptySocket: !slot.gemId,
    });
  });
  return map;
}
