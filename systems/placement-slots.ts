/**
 * Слоты размещения (⭐ star / ◆ diamond) — усиление от предмета в фиксированной клетке.
 * Как в Backpack Brawl: у предмета есть слот-клетка; подходящий предмет в ней даёт бонус.
 */
import type { PlacementSlotActiveEntry, PlacementSlotCatalogEntry } from "../types/game";

type BoardItem = {
  uid: string;
  itemId: string;
  col: number;
  row: number;
  rotation?: number;
  runtime?: { activeSynergies?: Array<{ from: string; desc: string; ruleId: string; kind: string }> };
};

function itemHasBattleStartEffect(itemId: string): boolean {
  if (typeof isBattleStartItem === "function") return isBattleStartItem(itemId);
  const def = typeof ITEM_CATALOG !== "undefined"
    ? (ITEM_CATALOG[itemId] as {
        effects?: Array<{ phase?: string; trigger?: string; type?: string }>;
        metaEffects?: Array<{ phase?: string }>;
      })
    : null;
  if (!def) return false;
  if ((def.effects || []).some((e) => e.phase === "battle_start" || e.trigger === "battle_start")) return true;
  if ((def.metaEffects || []).some((e) => e.phase === "battle_start")) return true;
  if ((def.effects || []).some((e) => (
    e.trigger === "passive"
    && e.type
    && ["passiveMaxHp", "passiveLuck", "groundFire", "cooldownStartMult"].includes(e.type)
  ))) return true;
  return false;
}

function getPlacementSlotsForItem(itemId: string): PlacementSlotCatalogEntry[] {
  const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[itemId] : null;
  return def?.placementSlots?.length ? def.placementSlots : [];
}

function rotatePlacementOffset(at: [number, number], rotation = 0): [number, number] {
  if (!Array.isArray(at) || at.length < 2) return [0, 0];
  let [x, y] = at;
  const t = ((rotation % 4) + 4) % 4;
  for (let i = 0; i < t; i += 1) {
    [x, y] = [y, -x];
  }
  return [x, y];
}

function getPlacementSlotCell(hostItem: BoardItem, slot: PlacementSlotCatalogEntry): [number, number] {
  const [dx, dy] = rotatePlacementOffset(slot.at, hostItem.rotation || 0);
  return [hostItem.col + dx, hostItem.row + dy];
}

function itemOccupiesCell(item: BoardItem, col: number, row: number): boolean {
  if (!item) return false;
  return getItemCells(item).some(([c, r]: [number, number]) => c === col && r === row);
}

function findGuestAtCell(items: BoardItem[], col: number, row: number, hostUid: string): BoardItem | null {
  return (items || []).find((guest) => {
    if (!guest || guest.uid === hostUid) return false;
    return itemOccupiesCell(guest, col, row);
  }) || null;
}

function guestMatchesSlot(guestItem: BoardItem, slot: PlacementSlotCatalogEntry): boolean {
  if (!guestItem || !slot) return false;
  const def = ITEM_CATALOG[guestItem.itemId];
  if (!def) return false;
  if (slot.acceptBattleStart) {
    return itemHasBattleStartEffect(guestItem.itemId);
  }
  if (slot.acceptStarHost) {
    return getPlacementSlotsForItem(guestItem.itemId).length > 0;
  }
  if (Array.isArray(slot.acceptItemIds) && slot.acceptItemIds.length) {
    return slot.acceptItemIds.includes(guestItem.itemId);
  }
  const tags = slot.acceptTags || [];
  if (!tags.length) return true;
  return tags.some((tag) => (def.tags || []).includes(tag));
}

function formatPlacementSlotDesc(slot: PlacementSlotCatalogEntry): string {
  if (slot?.desc) return slot.desc;
  if (slot.acceptBattleStart) {
    const icon = slot?.kind === "diamond" ? "◆" : "⭐";
    return `${icon} Слот: предмет «начало боя»`;
  }
  if (slot.acceptStarHost) {
    const icon = slot?.kind === "diamond" ? "◆" : "⭐";
    return `${icon} Слот: предмет со звёздами`;
  }
  const tags = (slot?.acceptTags || []).join("/") || "предмет";
  const icon = slot?.kind === "diamond" ? "◆" : "⭐";
  return `${icon} Слот: ${tags}`;
}

/** Сколько заполненных ⭐ у хоста (для Piggybank и т.п.). */
function countStarredGuestsForHost(
  hostItem: BoardItem,
  items: BoardItem[],
  filterSlot?: (slot: PlacementSlotCatalogEntry) => boolean,
): number {
  const active = collectActivePlacementSlots(items);
  const slots = getPlacementSlotsForItem(hostItem.itemId);
  return active.filter((entry) => {
    if (entry.hostUid !== hostItem.uid || !entry.guestUid) return false;
    const slot = slots.find((s) => s.id === entry.slotId);
    if (!slot) return false;
    return !filterSlot || filterSlot(slot);
  }).length;
}

/** Считает предметы с тегом только в ⭐ хоста (иначе — по всей стороне). */
function countTagForItemEffect(
  side: { items?: BoardItem[] },
  hostItem: BoardItem | null | undefined,
  tag: string,
): number {
  if (!tag) return 0;
  const items = side?.items || [];
  if (hostItem?.itemId) {
    const slots = getPlacementSlotsForItem(hostItem.itemId);
    if (slots.some((s) => (s.acceptTags || []).includes(tag))) {
      return countStarredGuestsForHost(hostItem, items, (s) => (
        (s.acceptTags || []).includes(tag)
      ));
    }
  }
  return typeof countTaggedItemsOnSide === "function"
    ? countTaggedItemsOnSide(side, tag)
    : 0;
}

function buildPlacementSlotEntry(
  hostItem: BoardItem,
  guestItem: BoardItem | null,
  slot: PlacementSlotCatalogEntry,
): PlacementSlotActiveEntry {
  const hostDef = ITEM_CATALOG[hostItem.itemId];
  const guestDef = guestItem ? ITEM_CATALOG[guestItem.itemId] : null;
  return {
    hostUid: hostItem.uid,
    guestUid: guestItem?.uid || null,
    hostId: hostItem.itemId,
    guestId: guestItem?.itemId || null,
    slotId: slot.id,
    kind: slot.kind || "star",
    desc: formatPlacementSlotDesc(slot),
    hostName: hostDef?.name || hostItem.itemId,
    guestName: guestDef?.name || null,
    cell: getPlacementSlotCell(hostItem, slot),
  };
}

/** Активные слоты: один гость может активировать несколько ⭐ разных хозяев (как в BB). */
function collectActivePlacementSlots(items: BoardItem[]): PlacementSlotActiveEntry[] {
  const result: PlacementSlotActiveEntry[] = [];

  (items || []).forEach((host) => {
    const slots = getPlacementSlotsForItem(host.itemId);
    if (!slots.length) return;

    slots.forEach((slot) => {
      const [col, row] = getPlacementSlotCell(host, slot);
      const guest = findGuestAtCell(items, col, row, host.uid);
      if (!guest || !guestMatchesSlot(guest, slot)) return;
      result.push(buildPlacementSlotEntry(host, guest, slot));
    });
  });

  return result;
}

function applyPlacementSlotRule(
  slot: PlacementSlotCatalogEntry,
  hostItem: BoardItem,
  guestItem: BoardItem | null,
): void {
  if (!hostItem?.runtime) return;

  const pushDesc = (item: BoardItem, text: string) => {
    if (!text || !item.runtime) return;
    item.runtime.activeSynergies = item.runtime.activeSynergies || [];
    item.runtime.activeSynergies.push({
      from: slot.kind === "diamond" ? "◆" : "⭐",
      desc: text,
      ruleId: slot.id,
      kind: "placementSlot",
    });
  };

  if (slot.hostApply && typeof applySynergyEffect === "function") {
    applySynergyEffect(
      { apply: slot.hostApply, target: "self", id: slot.id },
      hostItem,
      hostItem,
      null,
    );
    pushDesc(hostItem, formatPlacementSlotDesc(slot));
  }

  if (slot.guestApply && guestItem?.runtime && typeof applySynergyEffect === "function") {
    applySynergyEffect(
      { apply: slot.guestApply, target: "neighbor", id: `${slot.id}:guest` },
      hostItem,
      guestItem,
      null,
    );
    const guestDesc = `${slot.kind === "diamond" ? "◆" : "⭐"} от ${ITEM_CATALOG[hostItem.itemId]?.name || "хозяина"}`;
    pushDesc(guestItem, guestDesc);
  }
}

function applyPlacementSlotModifiers(items: BoardItem[]): PlacementSlotActiveEntry[] {
  const active = collectActivePlacementSlots(items);
  const hostMap = new Map((items || []).map((item) => [item.uid, item]));
  const guestMap = new Map((items || []).map((item) => [item.uid, item]));

  active.forEach((entry) => {
    const host = hostMap.get(entry.hostUid);
    const guest = entry.guestUid ? guestMap.get(entry.guestUid) ?? null : null;
    if (!host) return;
    const slot = getPlacementSlotsForItem(host.itemId).find((s) => s.id === entry.slotId);
    if (!slot) return;
    applyPlacementSlotRule(slot, host, guest);
  });

  return active;
}

type PlacementSlotVisualMode = "active" | "preview";

interface PlacementSlotLinkVisual {
  hostUid: string;
  guestUid: string | null;
  slotCol: number;
  slotRow: number;
  kind: string;
  mode: PlacementSlotVisualMode;
}

interface PlacementSlotBridge {
  from: { x: number; y: number };
  to: { x: number; y: number };
  star: { x: number; y: number };
}

/** Связи ⭐ для отрисовки: idle — все активные; drag — только с focusUid. */
function collectPlacementSlotLinkVisuals(
  items: BoardItem[],
  options?: { focusUid?: string | null },
): PlacementSlotLinkVisual[] {
  const focusUid = options?.focusUid || null;
  const seen = new Set<string>();
  const result: PlacementSlotLinkVisual[] = [];

  collectActivePlacementSlots(items).forEach((entry) => {
    if (focusUid && entry.hostUid !== focusUid && entry.guestUid !== focusUid) return;
    const key = `${entry.hostUid}:${entry.slotId}:${entry.guestUid || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({
      hostUid: entry.hostUid,
      guestUid: entry.guestUid,
      slotCol: entry.cell[0],
      slotRow: entry.cell[1],
      kind: entry.kind || "star",
      mode: focusUid ? "preview" : "active",
    });
  });

  return result;
}

/** @deprecated Используйте collectPlacementSlotLinkVisuals */
function collectPlacementSlotVisualEntries(
  items: BoardItem[],
  options?: { focusUid?: string | null },
): Array<{ col: number; row: number; kind: string; mode: PlacementSlotVisualMode }> {
  return collectPlacementSlotLinkVisuals(items, options).map((link) => ({
    col: link.slotCol,
    row: link.slotRow,
    kind: link.kind,
    mode: link.mode,
  }));
}

function findHostCellAdjacentToSlot(
  hostItem: BoardItem,
  slotCol: number,
  slotRow: number,
): [number, number] | null {
  const cells = getItemCells(hostItem) as Array<[number, number]>;
  let best: [number, number] | null = null;
  let bestDist = Infinity;
  cells.forEach(([hc, hr]) => {
    if (hc === slotCol && hr === slotRow) return;
    const dist = Math.abs(hc - slotCol) + Math.abs(hr - slotRow);
    if (dist === 1 && dist < bestDist) {
      best = [hc, hr];
      bestDist = dist;
    }
  });
  return best;
}

function resolvePlacementSlotBridge(
  hostItem: BoardItem,
  slotCol: number,
  slotRow: number,
  cellRectFn: (col: number, row: number) => { x: number; y: number; w: number; h: number } | null | undefined,
  guestItem?: BoardItem | null,
): PlacementSlotBridge | null {
  const slotRect = cellRectFn(slotCol, slotRow);
  if (!slotRect) return null;

  const adj = findHostCellAdjacentToSlot(hostItem, slotCol, slotRow);
  const hostRect = adj ? cellRectFn(adj[0], adj[1]) : null;

  let guestCenter = {
    x: slotRect.x + slotRect.w / 2,
    y: slotRect.y + slotRect.h / 2,
  };
  if (guestItem && typeof getItemVisualCenter === "function") {
    const team = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
    guestCenter = getItemVisualCenter(guestItem, team);
  }

  if (!hostRect) {
    const hostCenter = typeof getItemVisualCenter === "function"
      ? getItemVisualCenter(hostItem, typeof prepViewSide !== "undefined" ? prepViewSide : "player")
      : guestCenter;
    return {
      from: hostCenter,
      to: guestCenter,
      star: {
        x: (hostCenter.x + guestCenter.x) / 2,
        y: (hostCenter.y + guestCenter.y) / 2,
      },
    };
  }

  let fromX = hostRect.x + hostRect.w / 2;
  let fromY = hostRect.y + hostRect.h / 2;
  let starX = slotRect.x + slotRect.w / 2;
  let starY = slotRect.y + slotRect.h / 2;

  const [hc, hr] = adj!;
  if (slotCol > hc) {
    fromX = hostRect.x + hostRect.w;
    starX = slotRect.x;
    starY = (Math.max(hostRect.y, slotRect.y) + Math.min(hostRect.y + hostRect.h, slotRect.y + slotRect.h)) / 2;
    fromY = starY;
  } else if (slotCol < hc) {
    fromX = hostRect.x;
    starX = slotRect.x + slotRect.w;
    starY = (Math.max(hostRect.y, slotRect.y) + Math.min(hostRect.y + hostRect.h, slotRect.y + slotRect.h)) / 2;
    fromY = starY;
  } else if (slotRow > hr) {
    fromY = hostRect.y + hostRect.h;
    starY = slotRect.y;
    starX = (Math.max(hostRect.x, slotRect.x) + Math.min(hostRect.x + hostRect.w, slotRect.x + slotRect.w)) / 2;
    fromX = starX;
  } else if (slotRow < hr) {
    fromY = hostRect.y;
    starY = slotRect.y + slotRect.h;
    starX = (Math.max(hostRect.x, slotRect.x) + Math.min(hostRect.x + hostRect.w, slotRect.x + slotRect.w)) / 2;
    fromX = starX;
  }

  return {
    from: { x: fromX, y: fromY },
    to: guestCenter,
    star: { x: starX, y: starY },
  };
}

function drawPlacementSlotBridge(
  ctx: CanvasRenderingContext2D,
  bridge: PlacementSlotBridge,
  kind: string,
  visualMode: PlacementSlotVisualMode,
  time = 0,
): void {
  if (!ctx || !bridge) return;
  const isPreview = visualMode === "preview";
  const pulse = isPreview ? 0.55 + Math.sin(time * 5.2) * 0.45 : 0.85 + Math.sin(time * 2.4) * 0.15;
  const isDiamond = kind === "diamond";
  const lineColor = isDiamond
    ? (isPreview ? `rgba(150,210,255,${0.55 + pulse * 0.35})` : "rgba(130,195,255,0.85)")
    : (isPreview ? `rgba(255,220,100,${0.6 + pulse * 0.35})` : "rgba(255,210,80,0.9)");

  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = isPreview ? 2.2 + pulse * 0.8 : 2.4;
  ctx.setLineDash(isPreview ? [6, 5] : []);
  ctx.shadowColor = isDiamond ? "#9fd4ff" : "#ffd76a";
  ctx.shadowBlur = isPreview ? 6 + pulse * 10 : 4 + pulse * 6;
  ctx.beginPath();
  ctx.moveTo(bridge.from.x, bridge.from.y);
  ctx.lineTo(bridge.star.x, bridge.star.y);
  ctx.lineTo(bridge.to.x, bridge.to.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  const label = isDiamond ? "◆" : "★";
  const starSize = isPreview ? 14 + pulse * 4 : 13 + pulse * 2;
  ctx.font = `bold ${starSize}px Nunito, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = isDiamond ? "#b8e4ff" : "#ffe082";
  ctx.shadowBlur = isPreview ? 10 + pulse * 12 : 8;
  ctx.fillStyle = isPreview
    ? (isDiamond ? "#e8f6ff" : "#fff3b0")
    : (isDiamond ? "#d8eeff" : "#ffe566");
  ctx.fillText(label, bridge.star.x, bridge.star.y);

  ctx.beginPath();
  ctx.arc(bridge.star.x, bridge.star.y, starSize * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = isPreview
    ? (isDiamond ? `rgba(120,180,255,${0.18 + pulse * 0.2})` : `rgba(255,210,70,${0.2 + pulse * 0.22})`)
    : (isDiamond ? "rgba(120,180,255,0.22)" : "rgba(255,210,70,0.28)");
  ctx.fill();
  ctx.restore();
}

/** Все ⭐/◆ клетки хозяина — для подсказки при drag (BB: серые звёзды на тени предмета). */
function collectHostPlacementSlotMarkers(hostItem: BoardItem | null | undefined) {
  if (!hostItem?.itemId) return [];
  const slots = getPlacementSlotsForItem(hostItem.itemId);
  if (!slots.length) return [];
  const seen = new Set<string>();
  const result: Array<{ col: number; row: number; kind: string; slotId: string }> = [];
  for (const slot of slots) {
    const [col, row] = getPlacementSlotCell(hostItem, slot);
    const key = `${col},${row}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ col, row, kind: slot.kind || "star", slotId: slot.id });
  }
  return result;
}

/** Серый маркер пустого слота на клетке (оригинал BB при перетаскивании хозяина). */
function drawPlacementSlotCellHint(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  kind: string,
  time = 0,
): void {
  const isDiamond = kind === "diamond";
  const pulse = 0.65 + Math.sin(time * 3.8) * 0.12;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.save();
  ctx.fillStyle = isDiamond
    ? `rgba(140,180,220,${0.08 + pulse * 0.06})`
    : `rgba(175,175,185,${0.11 + pulse * 0.07})`;
  ctx.fillRect(rect.x + 1.5, rect.y + 1.5, rect.w - 3, rect.h - 3);
  const label = isDiamond ? "◆" : "★";
  const starSize = 11 + pulse * 2;
  ctx.font = `bold ${starSize}px Nunito, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = isDiamond
    ? `rgba(165,200,230,${0.58 + pulse * 0.18})`
    : `rgba(195,195,205,${0.72 + pulse * 0.18})`;
  ctx.fillText(label, cx, cy);
  ctx.restore();
}

function drawPlacementSlotGuestGlow(
  ctx: CanvasRenderingContext2D,
  guestItem: BoardItem,
  cellRectFn: (col: number, row: number) => { x: number; y: number; w: number; h: number } | null | undefined,
  kind: string,
  visualMode: PlacementSlotVisualMode,
  time = 0,
): void {
  if (!ctx || !guestItem) return;
  const isPreview = visualMode === "preview";
  const pulse = isPreview ? 0.55 + Math.sin(time * 5.2) * 0.45 : 0.85;
  const isDiamond = kind === "diamond";
  const stroke = isDiamond
    ? `rgba(140,200,255,${0.35 + pulse * 0.25})`
    : `rgba(255,210,90,${0.4 + pulse * 0.25})`;

  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = isPreview ? 2 : 2.4;
  ctx.setLineDash(isPreview ? [4, 3] : []);
  (getItemCells(guestItem) as Array<[number, number]>).forEach(([col, row]) => {
    const rect = cellRectFn(col, row);
    if (!rect) return;
    const pad = 2;
    ctx.strokeRect(rect.x + pad, rect.y + pad, rect.w - pad * 2, rect.h - pad * 2);
  });
  ctx.restore();
}

/** BB-style: idle — связь host↔guest; drag — серые ⭐ на слотах хозяина + preview-связи. */
function drawPrepPlacementSlotVisuals(
  ctx: CanvasRenderingContext2D,
  boardItems: BoardItem[],
  cellRectFn: (col: number, row: number) => { x: number; y: number; w: number; h: number } | null | undefined,
  options?: {
    isDragging?: boolean;
    previewItems?: BoardItem[] | null;
    previewUid?: string | null;
    dragHostItem?: BoardItem | null;
    time?: number;
  },
): void {
  if (!ctx || typeof cellRectFn !== "function") return;

  const time = options?.time ?? 0;
  const isDragging = !!options?.isDragging;
  const previewItems = options?.previewItems;
  const previewUid = options?.previewUid;
  const dragHostItem = options?.dragHostItem;

  if (isDragging && dragHostItem) {
    const itemsForFilled = previewItems?.length
      ? previewItems
      : [...boardItems, dragHostItem];
    const filledSlotKeys = new Set(
      collectActivePlacementSlots(itemsForFilled)
        .filter((entry) => entry.hostUid === dragHostItem.uid)
        .map((entry) => `${entry.cell[0]},${entry.cell[1]}`),
    );
    collectHostPlacementSlotMarkers(dragHostItem).forEach((marker) => {
      const key = `${marker.col},${marker.row}`;
      if (filledSlotKeys.has(key)) return;
      const rect = cellRectFn(marker.col, marker.row);
      if (!rect) return;
      drawPlacementSlotCellHint(ctx, rect, marker.kind, time);
    });
  }

  const sourceItems = (isDragging && previewItems?.length && previewUid)
    ? previewItems
    : (!isDragging ? boardItems : (isDragging && previewItems?.length ? previewItems : null));
  if (!sourceItems?.length) return;

  const focusUid = isDragging && previewUid ? previewUid : null;
  const links = collectPlacementSlotLinkVisuals(sourceItems, { focusUid });
  const uidToItem = new Map(sourceItems.map((item) => [item.uid, item]));

  links.forEach((link) => {
    const host = uidToItem.get(link.hostUid);
    if (!host) return;
    const guest = link.guestUid ? uidToItem.get(link.guestUid) : null;
    const bridge = resolvePlacementSlotBridge(host, link.slotCol, link.slotRow, cellRectFn, guest);
    if (!bridge) return;
    drawPlacementSlotBridge(ctx, bridge, link.kind, link.mode, time);
    if (guest) {
      drawPlacementSlotGuestGlow(ctx, guest, cellRectFn, link.kind, link.mode, time);
    }
  });
}

/** @deprecated Используйте drawPrepPlacementSlotVisuals */
function drawAllPlacementSlotVisuals(
  ctx: CanvasRenderingContext2D,
  items: BoardItem[],
  cellRectFn: (col: number, row: number) => { x: number; y: number; w: number; h: number } | null | undefined,
): void {
  drawPrepPlacementSlotVisuals(ctx, items, cellRectFn, { isDragging: false });
}

function formatPlacementSlotTooltipLine(slot: import("../types/game").PlacementSlotCatalogEntry): string {
  if (slot.acceptBattleStart) {
    const icon = slot.kind === "diamond" ? "◆" : "⭐";
    return `${icon} Слот: предмет «начало боя» — ${(slot.desc || "").replace(/^[⭐◆]\s*/, "")}`;
  }
  if (slot.acceptStarHost) {
    const icon = slot.kind === "diamond" ? "◆" : "⭐";
    return `${icon} Слот: предмет со звёздами — ${(slot.desc || "").replace(/^[⭐◆]\s*/, "")}`;
  }
  const tags = (slot.acceptTags || []).map((t) => (
    typeof formatTagLabel === "function" ? formatTagLabel(t) : t
  )).join(" / ") || "подходящий предмет";
  const icon = slot.kind === "diamond" ? "◆" : "⭐";
  const effect = slot.desc || `${icon} ${tags}`;
  return `${icon} Слот: ${tags} — ${effect.replace(/^[⭐◆]\s*/, "")}`;
}

function getPlacementSlotTooltipLines(itemId: string): string[] {
  const slots = getPlacementSlotsForItem(itemId);
  if (!slots.length) return [];

  const counts = new Map<string, number>();
  for (const slot of slots) {
    const line = formatPlacementSlotTooltipLine(slot);
    counts.set(line, (counts.get(line) || 0) + 1);
  }
  return [...counts.keys()];
}

/** Подходит ли предмет (по id) в слот ⭐/◆. */
function itemMatchesPlacementSlot(itemId: string, slot: PlacementSlotCatalogEntry): boolean {
  return guestMatchesSlot({ itemId, uid: "__slot_probe__" } as BoardItem, slot);
}

/** Партнёры на поле, с которыми itemId может образовать ⭐/◆ связь (для магазина / AI). */
function findPlacementSynergyPartners(itemId: string, boardItems: BoardItem[]): BoardItem[] {
  const def = ITEM_CATALOG[itemId] as { placementSlots?: PlacementSlotCatalogEntry[] } | undefined;
  if (!def || !boardItems?.length) return [];
  const partners = new Map<string, BoardItem>();

  boardItems.forEach((host) => {
    getPlacementSlotsForItem(host.itemId).forEach((slot) => {
      if (itemMatchesPlacementSlot(itemId, slot)) {
        partners.set(host.uid, host);
      }
    });
  });

  (def.placementSlots || getPlacementSlotsForItem(itemId)).forEach((slot) => {
    boardItems.forEach((guest) => {
      if (guestMatchesSlot(guest, slot)) {
        partners.set(guest.uid, guest);
      }
    });
  });

  return [...partners.values()];
}

/** Оценка позиции: сколько ⭐/◆ слотов активируется при такой расстановке. */
function scorePlacementSlotPosition(
  itemId: string,
  col: number,
  row: number,
  rotation: number,
  items: BoardItem[],
): number {
  const temp: BoardItem = {
    uid: "__temp__",
    itemId,
    col,
    row,
    rotation,
  };
  const combined = [...items.filter((i) => i.uid !== temp.uid), temp];
  let score = 0;

  combined.forEach((host) => {
    if (host.uid === temp.uid) return;
    getPlacementSlotsForItem(host.itemId).forEach((slot) => {
      const [sc, sr] = getPlacementSlotCell(host, slot);
      if (itemOccupiesCell(temp, sc, sr) && guestMatchesSlot(temp, slot)) {
        score += 1;
      }
    });
  });

  getPlacementSlotsForItem(itemId).forEach((slot) => {
    const [sc, sr] = getPlacementSlotCell(temp, slot);
    const guest = findGuestAtCell(combined, sc, sr, temp.uid);
    if (guest && guestMatchesSlot(guest, slot)) {
      score += 1;
    }
  });

  return score;
}

window.getPlacementSlotsForItem = getPlacementSlotsForItem;
window.getPlacementSlotCell = getPlacementSlotCell as (hostItem: object, slot: import("../types/game").PlacementSlotCatalogEntry) => [number, number];
window.collectActivePlacementSlots = collectActivePlacementSlots as (items: object[]) => import("../types/game").PlacementSlotActiveEntry[];
window.applyPlacementSlotModifiers = applyPlacementSlotModifiers as (items: object[]) => import("../types/game").PlacementSlotActiveEntry[];
window.countStarredGuestsForHost = countStarredGuestsForHost as (
  hostItem: object,
  items: object[],
  filterSlot?: (slot: import("../types/game").PlacementSlotCatalogEntry) => boolean,
) => number;
window.countTagForItemEffect = countTagForItemEffect as (
  side: object,
  hostItem: object | null | undefined,
  tag: string,
) => number;
window.collectPlacementSlotLinkVisuals = collectPlacementSlotLinkVisuals as (
  items: object[],
  options?: { focusUid?: string | null },
) => PlacementSlotLinkVisual[];
window.collectPlacementSlotVisualEntries = collectPlacementSlotVisualEntries as (
  items: object[],
  options?: { focusUid?: string | null },
) => PlacementSlotVisualEntry[];
window.collectHostPlacementSlotMarkers = collectHostPlacementSlotMarkers as (
  hostItem: object | null | undefined,
) => Array<{ col: number; row: number; kind: string; slotId: string }>;
window.drawPrepPlacementSlotVisuals = drawPrepPlacementSlotVisuals as (
  ctx: CanvasRenderingContext2D,
  boardItems: object[],
  cellRectFn: (col: number, row: number) => object | null | undefined,
  options?: {
    isDragging?: boolean;
    previewItems?: object[] | null;
    previewUid?: string | null;
    dragHostItem?: object | null;
    time?: number;
  },
) => void;
window.drawAllPlacementSlotVisuals = drawAllPlacementSlotVisuals as (
  ctx: CanvasRenderingContext2D,
  items: object[],
  cellRectFn: (col: number, row: number) => object | null | undefined,
) => void;
window.getPlacementSlotTooltipLines = getPlacementSlotTooltipLines;
window.itemMatchesPlacementSlot = itemMatchesPlacementSlot;
window.findPlacementSynergyPartners = findPlacementSynergyPartners;
window.scorePlacementSlotPosition = scorePlacementSlotPosition;
