/**
 * Система синергий — логика + состояние клеток инвентаря.
 */
import type { SynergyEntry, SynergyRule } from "../types/game";

type BoardItem = { uid: string; itemId: string; col?: number; row?: number };

interface SynergyCellState {
  col: number;
  row: number;
  synergyActive: boolean;
  type: string;
  strength: string;
  mode: string;
}

const synergyState: {
  previewSynergies: SynergyEntry[];
  activeSynergies: SynergyEntry[];
  enemyActiveSynergies: SynergyEntry[];
  activeSynergyCells: Array<{ cells: object[]; type: string; strength: string; status: string; itemUids: string[] }>;
  enemyActiveSynergyCells: Array<{ cells: object[]; type: string; strength: string; status: string; itemUids: string[] }>;
  previewSynergyCells: Array<{ cells: object[]; type: string; strength: string; status: string; itemUids: string[] }>;
  cellStates: Map<string, SynergyCellState>;
  isDragging: boolean;
} = {
  previewSynergies: [],
  activeSynergies: [],
  enemyActiveSynergies: [],
  activeSynergyCells: [],
  enemyActiveSynergyCells: [],
  previewSynergyCells: [],
  cellStates: new Map<string, SynergyCellState>(),
  isDragging: false,
};

const SYNERGY_VISUAL = {
  NONE: "none",
  ACTIVE: "active",
  PREVIEW: "preview",
};

function formatSynergyBonus(rule: SynergyRule): string {
  return formatSynergyHumanDesc(rule);
}

/** Простые подписи тегов для подсказок (без [скобок]). */
function formatSynergyTagLabels(tags: string[] | undefined): string {
  const labels = (tags || []).map((tag) => (
    typeof formatTagLabel === "function" ? formatTagLabel(tag) : tag
  ));
  if (!labels.length) return "нужный предмет";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} или ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} или ${labels[labels.length - 1]}`;
}

/** Как должны стоять предметы: сбоку / по диагонали. */
function formatSynergyPlacementPhrase(rule: SynergyRule): string {
  if (rule.adjacency === "weak") return "Если по диагонали стоит";
  if (rule.adjacency === "both") return "Если рядом или по диагонали стоит";
  return "Если рядом стоит";
}

/** Что именно даёт синергия — коротко и по-русски. */
function formatSynergyApplyPhrase(apply: SynergyRule["apply"]): string {
  if (!apply) return "";
  const v = apply.value;
  switch (apply.type) {
    case "damageBonus":
      return `+${v} к урону`;
    case "healBonus":
      return `+${v} к лечению`;
    case "blockBonus":
      return `+${v} к блоку`;
    case "poisonBonus":
      return `+${v} к яду`;
    case "cooldownReduction":
      return `срабатывает на ${Math.round((v ?? 0) * 100)}% быстрее`;
    case "grantBlockBuff": {
      const cap = apply.cap ? ` (не больше +${apply.cap} за бой)` : "";
      return `+${v} к урону соседнего оружия, когда вы блокируете${cap}`;
    }
    default:
      return "";
  }
}

/**
 * Человеческое описание синергии — совпадает с тем, что реально делает код.
 * target "self" — бонус получает этот предмет; "neighbor" — соседний.
 */
function formatSynergyHumanDesc(rule: SynergyRule): string {
  if (!rule?.apply) return rule?.desc || "";

  const bonus = formatSynergyApplyPhrase(rule.apply);
  if (!bonus) return rule.desc || "";

  const placement = formatSynergyPlacementPhrase(rule);
  const neighbor = formatSynergyTagLabels(rule.neighborTags);

  if (rule.apply.type === "grantBlockBuff") {
    return `${placement} ${neighbor}: ${bonus}`;
  }

  if (rule.target === "neighbor") {
    return `Соседние ${neighbor}: ${bonus}`;
  }

  if (rule.apply.type === "cooldownReduction") {
    return `${placement} ${neighbor} — этот предмет ${bonus}`;
  }

  return `${placement} ${neighbor} — ${bonus} у этого предмета`;
}

/** «Активно:» — без повторов; ×N если сработало несколько раз. */
function formatActiveSynergyTooltipLines(activeSynergies: Array<{ desc?: string }>): string[] {
  const counts = new Map();
  (activeSynergies || []).forEach((entry) => {
    const desc = entry?.desc || "";
    if (!desc) return;
    counts.set(desc, (counts.get(desc) || 0) + 1);
  });
  return [...counts.entries()].map(([desc, count]) => (
    count > 1 ? `${desc} (×${count})` : desc
  ));
}

function formatSynergyConditionFromRule(rule: SynergyRule): string {
  const human = formatSynergyHumanDesc(rule);
  if (human) return human;
  const adj = rule.adjacency === "weak" ? "диагонально" : "рядом";
  const tags = formatTagsList(rule.neighborTags || [], " / ");
  if (tags) return `${adj} с ${tags}`;
  return rule.desc || "";
}

function parseSynergyTexts(rule: SynergyRule): { condition: string; effect: string } {
  const effect = formatSynergyBonus(rule);
  if (rule.desc?.includes(":")) {
    const idx = rule.desc.indexOf(":");
    return {
      condition: rule.desc.slice(0, idx).trim(),
      effect: rule.desc.slice(idx + 1).trim() || effect,
    };
  }
  return {
    condition: formatSynergyConditionFromRule(rule),
    effect: effect || rule.desc || "",
  };
}

function inferSynergyType(itemA: BoardItem, itemB: BoardItem, rule: SynergyRule): string {
  const defA = ITEM_CATALOG[itemA.itemId];
  const defB = ITEM_CATALOG[itemB.itemId];
  const tags = [...(defA?.tags || []), ...(defB?.tags || [])];
  if (tags.includes("magic")) return "magic";
  if (tags.includes("weapon")) return "weapon";
  if (tags.includes("poison")) return "poison";
  if (tags.includes("armor")) return "armor";
  if (tags.includes("gem")) return "gem";
  if (rule?.neighborTags?.[0]) return rule.neighborTags[0];
  return "default";
}

function buildSynergyEntry(item: BoardItem, partner: BoardItem, rule: SynergyRule): SynergyEntry {
  const def = ITEM_CATALOG[item.itemId] as { name: string; icon: string };
  const partnerDef = ITEM_CATALOG[partner.itemId] as { name: string; icon: string };
  const texts = parseSynergyTexts(rule);
  return {
    items: [item.itemId, partner.itemId],
    itemUids: [item.uid, partner.uid],
    names: [def.name, partnerDef.name],
    icons: [def.icon, partnerDef.icon],
    condition: texts.condition,
    effect: texts.effect,
    bonus: texts.effect,
    desc: formatSynergyHumanDesc(rule),
    ruleId: rule.id,
    applyType: rule.apply?.type,
    type: inferSynergyType(item, partner, rule),
    strength: rule.adjacency === "strong" ? "strong" : "weak",
    status: SYNERGY_VISUAL.ACTIVE,
  };
}

function buildPlacementSynergyEntry(
  hostItem: BoardItem,
  guestItem: BoardItem,
  slot: { id?: string; desc?: string; acceptTags?: string[]; kind?: string },
): SynergyEntry {
  const hostDef = ITEM_CATALOG[hostItem.itemId] as { name: string; icon: string };
  const guestDef = ITEM_CATALOG[guestItem.itemId] as { name: string; icon: string };
  const desc = slot.desc
    || (typeof formatPlacementSlotDesc === "function"
      ? formatPlacementSlotDesc(slot)
      : "⭐ синергия");
  const pseudoRule = { neighborTags: slot.acceptTags || [], id: slot.id } as SynergyRule;
  return {
    items: [hostItem.itemId, guestItem.itemId],
    itemUids: [hostItem.uid, guestItem.uid],
    names: [hostDef.name, guestDef.name],
    icons: [hostDef.icon, guestDef.icon],
    condition: desc,
    effect: desc,
    bonus: desc,
    desc,
    ruleId: slot.id,
    type: inferSynergyType(hostItem, guestItem, pseudoRule),
    strength: "strong",
    status: SYNERGY_VISUAL.ACTIVE,
  };
}

/** Активные синергии — только заполненные ⭐/◆ слоты. */
function collectActiveSynergies(items: BoardItem[]): SynergyEntry[] {
  if (typeof collectActivePlacementSlots !== "function") return [];

  const uidToItem = new Map(items.map((i) => [i.uid, i]));
  const seen = new Set<string>();
  const result: SynergyEntry[] = [];

  collectActivePlacementSlots(items).forEach((entry) => {
    const host = uidToItem.get(entry.hostUid);
    const guest = entry.guestUid ? uidToItem.get(entry.guestUid) : null;
    if (!host || !guest) return;
    const key = `${entry.hostUid}:${entry.guestUid}:${entry.slotId}`;
    if (seen.has(key)) return;
    seen.add(key);
    const slot = (typeof getPlacementSlotsForItem === "function"
      ? getPlacementSlotsForItem(host.itemId)
      : []).find((s) => s.id === entry.slotId);
    if (!slot) return;
    result.push(buildPlacementSynergyEntry(host, guest, slot));
  });

  return result;
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

/** Клетки инвентаря, участвующие в синергии. */
function buildSynergyCellGroups(synergies: SynergyEntry[], items: BoardItem[], status: string) {
  const uidToItem = new Map(items.map((i) => [i.uid, i]));

  return (synergies || []).map((syn) => {
    const cells: Array<{ col: number; row: number; key: string; synergyActive: boolean }> = [];
    const keys = new Set();
    syn.itemUids.forEach((uid) => {
      const item = uidToItem.get(uid);
      if (!item) return;
      getItemCells(item).forEach(([col, row]: [number, number]) => {
        const key = cellKey(col, row);
        if (keys.has(key)) return;
        keys.add(key);
        cells.push({ col, row, key, synergyActive: true });
      });
    });
    return {
      cells,
      type: syn.type || "default",
      strength: syn.strength || "strong",
      status,
      itemUids: syn.itemUids,
    };
  });
}

function rebuildCellStates(
  activeGroups: Array<{ cells: Array<{ col: number; row: number; key: string }>; type: string; strength: string }>,
  previewGroups: Array<{ cells: Array<{ col: number; row: number; key: string }>; type: string; strength: string }> | null,
): Map<string, SynergyCellState> {
  const map = new Map<string, SynergyCellState>();
  const previewKeys = new Set();
  (previewGroups || []).forEach((g) => {
    g.cells.forEach((c) => previewKeys.add(c.key));
  });

  (activeGroups || []).forEach((group) => {
    group.cells.forEach((cell) => {
      if (previewKeys.has(cell.key)) return;
      map.set(cell.key, {
        col: cell.col,
        row: cell.row,
        synergyActive: true,
        type: group.type,
        strength: group.strength,
        mode: SYNERGY_VISUAL.ACTIVE,
      });
    });
  });

  (previewGroups || []).forEach((group) => {
    group.cells.forEach((cell) => {
      map.set(cell.key, {
        col: cell.col,
        row: cell.row,
        synergyActive: true,
        type: group.type,
        strength: group.strength,
        mode: SYNERGY_VISUAL.PREVIEW,
      });
    });
  });

  synergyState.cellStates = map;
  return map;
}

function syncSynergyCellLayers(
  playerItems: BoardItem[],
  enemyItems: BoardItem[],
  previewItems: BoardItem[] | null,
  previewSynergies: SynergyEntry[],
): void {
  const previewUids = getSynergyInvolvedUids(previewSynergies);
  const activeFiltered = synergyState.activeSynergies.filter(
    (s) => !s.itemUids.some((u) => previewUids.has(u)),
  );

  synergyState.activeSynergyCells = buildSynergyCellGroups(
    activeFiltered,
    playerItems,
    SYNERGY_VISUAL.ACTIVE,
  );

  synergyState.enemyActiveSynergyCells = buildSynergyCellGroups(
    synergyState.enemyActiveSynergies,
    enemyItems || [],
    SYNERGY_VISUAL.ACTIVE,
  );

  synergyState.previewSynergyCells = previewSynergies.length && previewItems
    ? buildSynergyCellGroups(previewSynergies, previewItems, SYNERGY_VISUAL.PREVIEW)
    : [];

  rebuildCellStates(
    synergyState.activeSynergyCells as Array<{ cells: Array<{ col: number; row: number; key: string }>; type: string; strength: string }>,
    synergyState.previewSynergyCells as Array<{ cells: Array<{ col: number; row: number; key: string }>; type: string; strength: string }>,
  );
}

function buildPreviewPlacement(
  containers: object[],
  items: BoardItem[],
  dragPayload: { itemId: string; rotation?: number },
  hoverSlot: { col: number; row: number },
  dragFrom: { type?: string; item?: { uid: string } } | null,
) {
  if (!dragPayload || !hoverSlot || isContainerItem(dragPayload.itemId)) return null;

  const excludeUid = dragFrom?.type === "item" ? dragFrom.item?.uid : null;
  const placement = resolveLoadoutPlacement(
    containers,
    items,
    dragPayload.itemId,
    hoverSlot.col,
    hoverSlot.row,
    dragPayload.rotation || 0,
    excludeUid ?? null,
  );
  if (!placement.valid) return null;

  let previewItems = items.filter((i) => i.uid !== excludeUid);
  const previewItem = createPlacedItem(
    dragPayload.itemId,
    placement.col,
    placement.row,
    placement.rotation,
  ) as BoardItem;
  if (excludeUid) previewItem.uid = excludeUid;
  previewItems = [...previewItems, previewItem];
  applySynergyModifiers(previewItems);

  return { previewItems, previewUid: previewItem.uid, placement };
}

/** Обновить активные синергии (игрок + ИИ). */
function refreshActiveSynergies(playerItems: BoardItem[], enemyItems: BoardItem[] = []): SynergyEntry[] {
  synergyState.activeSynergies = collectActiveSynergies(playerItems).map((s) => ({
    ...s,
    status: SYNERGY_VISUAL.ACTIVE,
  }));
  synergyState.enemyActiveSynergies = collectActiveSynergies(enemyItems).map((s) => ({
    ...s,
    status: SYNERGY_VISUAL.ACTIVE,
  }));
  syncSynergyCellLayers(playerItems, enemyItems, null, synergyState.previewSynergies);
  return synergyState.activeSynergies;
}

/** Обновить preview-синергии (только пока предмет зажат над рюкзаком). */
function refreshPreviewSynergies(
  containers: object[],
  playerItems: BoardItem[],
  dragPayload: { itemId: string; rotation?: number },
  hoverSlot: { col: number; row: number },
  dragFrom: { type?: string; item?: { uid: string } } | null,
  enemyItems: BoardItem[] = [],
) {
  if (!synergyState.isDragging || !dragPayload || !hoverSlot) {
    synergyState.previewSynergies = [];
    syncSynergyCellLayers(playerItems, enemyItems, null, []);
    return null;
  }

  const built = buildPreviewPlacement(containers, playerItems, dragPayload, hoverSlot, dragFrom);
  if (!built) {
    synergyState.previewSynergies = [];
    syncSynergyCellLayers(playerItems, enemyItems, null, []);
    return null;
  }

  const all = collectActiveSynergies(built.previewItems);
  synergyState.previewSynergies = all
    .filter((s) => s.itemUids.includes(built.previewUid))
    .map((s) => ({ ...s, status: SYNERGY_VISUAL.PREVIEW }));

  syncSynergyCellLayers(playerItems, enemyItems, built.previewItems, synergyState.previewSynergies);
  return built;
}

function startSynergyPreview(): void {
  synergyState.isDragging = true;
  synergyState.previewSynergies = [];
  synergyState.previewSynergyCells = [];
}

function endSynergyPreview(): void {
  synergyState.isDragging = false;
  synergyState.previewSynergies = [];
  synergyState.previewSynergyCells = [];
  if (typeof playerItems !== "undefined") {
    syncSynergyCellLayers(
      playerItems as BoardItem[],
      typeof enemyItems !== "undefined" ? (enemyItems as BoardItem[]) : [],
      null,
      [],
    );
  }
}

function getSynergyInvolvedUids(synergies: SynergyEntry[] | null | undefined): Set<string> {
  const set = new Set<string>();
  (synergies || []).forEach((s) => s.itemUids.forEach((u) => set.add(u)));
  return set;
}

function getCellSynergyState(col: number, row: number): SynergyCellState | null {
  return synergyState.cellStates.get(cellKey(col, row)) || null;
}

/** @deprecated Используйте synergyState.activeSynergies */
function collectSynergyPanelEntries(synergies: SynergyEntry[]): Array<{ itemName: string; partnerName: string; desc: string }> {
  return synergies.map((s) => ({
    itemName: s.names[0],
    partnerName: s.names[1],
    desc: s.effect || s.bonus || s.desc,
  }));
}

function getItemVisualCenter(item: BoardItem, team: string): { x: number; y: number } {
  const cells = getItemCells(item);
  if (!cells.length) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  cells.forEach(([c, r]: [number, number]) => {
    const rect = cellRectForSynergy(team, c, r);
    sx += rect.x + rect.w / 2;
    sy += rect.y + rect.h / 2;
  });
  return { x: sx / cells.length, y: sy / cells.length };
}

function cellRectForSynergy(team: string, col: number, row: number): { x: number; y: number; w: number; h: number } {
  if (typeof cellRect === "function") {
    return cellRect(team, col, row);
  }
  const stride = typeof GRID_STRIDE !== "undefined" ? GRID_STRIDE : 47;
  const originX = typeof layoutGridOrigin === "function"
    ? layoutGridOrigin(team)
    : (team === "player" ? (GRID_PLAYER_X || 0) : (ENEMY_X || 0));
  const topY = typeof layoutBackpackY === "function" ? layoutBackpackY() : (BACKPACK_Y || 0);
  const cell = typeof GRID_CELL !== "undefined" ? GRID_CELL : 46;
  return { x: originX + col * stride, y: topY + row * stride, w: cell, h: cell };
}

function synergyColorForType(type: string, strength: string, mode: string): string {
  const isActive = mode === SYNERGY_VISUAL.ACTIVE;
  const palette: Record<string, Record<string, string>> = {
    magic: { strong: isActive ? "#e8c547" : "#c9a227", weak: isActive ? "#6cb6ff" : "#58a6ff" },
    weapon: { strong: isActive ? "#f0c14b" : "#e3b341", weak: isActive ? "#8ec5ff" : "#79c0ff" },
    poison: { strong: isActive ? "#56d364" : "#3fb950", weak: isActive ? "#7ee787" : "#56d364" },
    armor: { strong: isActive ? "#b1bac4" : "#8b949e", weak: isActive ? "#9198a1" : "#6e7681" },
    gem: { strong: isActive ? "#bc8cff" : "#a371f7", weak: isActive ? "#d2a8ff" : "#bc8cff" },
    default: { strong: isActive ? "#ffe066" : "#f0c14b", weak: isActive ? "#6cb6ff" : "#58a6ff" },
  };
  const set = palette[type] || palette.default;
  return set[strength] || set.strong;
}

window.formatSynergyHumanDesc = formatSynergyHumanDesc;
window.formatActiveSynergyTooltipLines = formatActiveSynergyTooltipLines;
