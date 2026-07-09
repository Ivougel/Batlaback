// Transpiled from TypeScript — npm run compile:ts

function getPlacementSlotsForItem(itemId) {
  const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[itemId] : null;
  return def?.placementSlots?.length ? def.placementSlots : [];
}
function rotatePlacementOffset(at, rotation = 0) {
  if (!Array.isArray(at) || at.length < 2) return [0, 0];
  let [x, y] = at;
  const t = (rotation % 4 + 4) % 4;
  for (let i = 0; i < t; i += 1) {
    [x, y] = [y, -x];
  }
  return [x, y];
}
function getPlacementSlotCell(hostItem, slot) {
  const [dx, dy] = rotatePlacementOffset(slot.at, hostItem.rotation || 0);
  return [hostItem.col + dx, hostItem.row + dy];
}
function itemOccupiesCell(item, col, row) {
  if (!item) return false;
  return getItemCells(item).some(([c, r]) => c === col && r === row);
}
function findGuestAtCell(items, col, row, hostUid) {
  return (items || []).find((guest) => {
    if (!guest || guest.uid === hostUid) return false;
    return itemOccupiesCell(guest, col, row);
  }) || null;
}
function guestMatchesSlot(guestItem, slot) {
  if (!guestItem || !slot) return false;
  const def = ITEM_CATALOG[guestItem.itemId];
  if (!def) return false;
  if (Array.isArray(slot.acceptItemIds) && slot.acceptItemIds.length) {
    return slot.acceptItemIds.includes(guestItem.itemId);
  }
  const tags = slot.acceptTags || [];
  if (!tags.length) return true;
  return tags.some((tag) => (def.tags || []).includes(tag));
}
function formatPlacementSlotDesc(slot) {
  if (slot?.desc) return slot.desc;
  const tags = (slot?.acceptTags || []).join("/") || "\u043F\u0440\u0435\u0434\u043C\u0435\u0442";
  const icon = slot?.kind === "diamond" ? "\u25C6" : "\u2B50";
  return `${icon} \u0421\u043B\u043E\u0442: ${tags}`;
}
function buildPlacementSlotEntry(hostItem, guestItem, slot) {
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
    cell: getPlacementSlotCell(hostItem, slot)
  };
}
function collectActivePlacementSlots(items) {
  const result = [];
  const usedGuestUids = /* @__PURE__ */ new Set();
  (items || []).forEach((host) => {
    const slots = getPlacementSlotsForItem(host.itemId);
    if (!slots.length) return;
    slots.forEach((slot) => {
      const [col, row] = getPlacementSlotCell(host, slot);
      const guest = findGuestAtCell(items, col, row, host.uid);
      if (!guest || usedGuestUids.has(guest.uid)) return;
      if (!guestMatchesSlot(guest, slot)) return;
      usedGuestUids.add(guest.uid);
      result.push(buildPlacementSlotEntry(host, guest, slot));
    });
  });
  return result;
}
function applyPlacementSlotRule(slot, hostItem, guestItem) {
  if (!hostItem?.runtime) return;
  const pushDesc = (item, text) => {
    if (!text || !item.runtime) return;
    item.runtime.activeSynergies = item.runtime.activeSynergies || [];
    item.runtime.activeSynergies.push({
      from: slot.kind === "diamond" ? "\u25C6" : "\u2B50",
      desc: text,
      ruleId: slot.id,
      kind: "placementSlot"
    });
  };
  if (slot.hostApply && typeof applySynergyEffect === "function") {
    applySynergyEffect(
      { apply: slot.hostApply, target: "self", id: slot.id },
      hostItem,
      hostItem,
      null
    );
    pushDesc(hostItem, formatPlacementSlotDesc(slot));
  }
  if (slot.guestApply && guestItem?.runtime && typeof applySynergyEffect === "function") {
    applySynergyEffect(
      { apply: slot.guestApply, target: "neighbor", id: `${slot.id}:guest` },
      hostItem,
      guestItem,
      null
    );
    const guestDesc = `${slot.kind === "diamond" ? "\u25C6" : "\u2B50"} \u043E\u0442 ${ITEM_CATALOG[hostItem.itemId]?.name || "\u0445\u043E\u0437\u044F\u0438\u043D\u0430"}`;
    pushDesc(guestItem, guestDesc);
  }
}
function applyPlacementSlotModifiers(items) {
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
function drawPlacementSlotCell(ctx, rect, kind, filled) {
  if (!ctx || !rect) return;
  const pad = typeof CELL_TILE_PAD !== "undefined" ? CELL_TILE_PAD : 3;
  const ix = rect.x + pad;
  const iy = rect.y + pad;
  const iw = rect.w - pad * 2;
  const ih = rect.h - pad * 2;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.save();
  ctx.fillStyle = filled ? kind === "diamond" ? "rgba(120,180,255,0.28)" : "rgba(255,220,120,0.28)" : "rgba(0,0,0,0.18)";
  ctx.fillRect(ix, iy, iw, ih);
  ctx.strokeStyle = filled ? kind === "diamond" ? "rgba(140,200,255,0.95)" : "rgba(255,210,90,0.95)" : kind === "diamond" ? "rgba(120,180,255,0.65)" : "rgba(255,210,90,0.65)";
  ctx.lineWidth = filled ? 2.2 : 1.6;
  ctx.setLineDash(filled ? [] : [4, 3]);
  ctx.strokeRect(ix + 1, iy + 1, iw - 2, ih - 2);
  ctx.setLineDash([]);
  const label = kind === "diamond" ? "\u25C6" : "\u2605";
  ctx.font = `bold ${Math.max(11, Math.min(iw, ih) * 0.55)}px Nunito, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = filled ? "#ffe9a8" : "rgba(255,230,160,0.75)";
  ctx.fillText(label, cx, cy);
  ctx.restore();
}
function drawAllPlacementSlotVisuals(ctx, items, cellRectFn) {
  if (!ctx || !items?.length || typeof cellRectFn !== "function") return;
  items.forEach((host) => {
    const slots = getPlacementSlotsForItem(host.itemId);
    if (!slots.length) return;
    slots.forEach((slot) => {
      const [col, row] = getPlacementSlotCell(host, slot);
      const guest = findGuestAtCell(items, col, row, host.uid);
      const filled = !!(guest && guestMatchesSlot(guest, slot));
      const rect = cellRectFn(col, row);
      if (!rect) return;
      drawPlacementSlotCell(ctx, rect, slot.kind || "star", filled);
    });
  });
}
function getPlacementSlotTooltipLines(itemId) {
  const slots = getPlacementSlotsForItem(itemId);
  if (!slots.length) return [];
  return slots.map((slot) => {
    const tags = (slot.acceptTags || []).map((t) => typeof formatTagLabel === "function" ? formatTagLabel(t) : t).join(" / ") || "\u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442";
    const icon = slot.kind === "diamond" ? "\u25C6" : "\u2B50";
    const effect = slot.desc || `${icon} ${tags}`;
    return `${icon} \u0421\u043B\u043E\u0442: ${tags} \u2014 ${effect.replace(/^[⭐◆]\s*/, "")}`;
  });
}
window.getPlacementSlotsForItem = getPlacementSlotsForItem;
window.getPlacementSlotCell = getPlacementSlotCell;
window.collectActivePlacementSlots = collectActivePlacementSlots;
window.applyPlacementSlotModifiers = applyPlacementSlotModifiers;
window.drawAllPlacementSlotVisuals = drawAllPlacementSlotVisuals;
window.getPlacementSlotTooltipLines = getPlacementSlotTooltipLines;
