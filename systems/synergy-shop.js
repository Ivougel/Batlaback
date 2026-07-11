/**
 * Подсказки ⭐/◆ слотов для магазина / скамейки (оценка совместимости с полем).
 */

function getShopSynergyHint(itemId, boardItems) {
  if (typeof findPlacementSynergyPartners === "function") {
    const partnerItems = findPlacementSynergyPartners(itemId, boardItems || []);
    if (!partnerItems.length) return null;
    return {
      strength: "strong",
      partnerUids: partnerItems.map((i) => i.uid),
      partnerItems,
    };
  }

  const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[itemId] : null;
  if (!def || !boardItems?.length) return null;

  const partnerMap = new Map();
  const shopSlots = typeof getPlacementSlotsForItem === "function"
    ? getPlacementSlotsForItem(itemId)
    : (def.placementSlots || []);

  boardItems.forEach((host) => {
    const slots = typeof getPlacementSlotsForItem === "function"
      ? getPlacementSlotsForItem(host.itemId)
      : (ITEM_CATALOG[host.itemId]?.placementSlots || []);
    slots.forEach((slot) => {
      const fits = typeof itemMatchesPlacementSlot === "function"
        ? itemMatchesPlacementSlot(itemId, slot)
        : false;
      if (fits) partnerMap.set(host.uid, host);
    });
  });

  shopSlots.forEach((slot) => {
    boardItems.forEach((guest) => {
      if (typeof guestMatchesSlot === "function" && guestMatchesSlot(guest, slot)) {
        partnerMap.set(guest.uid, guest);
      }
    });
  });

  if (!partnerMap.size) return null;
  const partnerItems = [...partnerMap.values()];
  return {
    strength: "strong",
    partnerUids: partnerItems.map((i) => i.uid),
    partnerItems,
  };
}

function getBoardItemClientCenter(item, team) {
  if (!item || typeof getItemVisualCenter !== "function") return null;
  const center = getItemVisualCenter(item, team);
  if (!center || typeof canvasPointToClient !== "function") return null;
  return canvasPointToClient(center.x, center.y);
}

/** Отключено — подсветка синергий в commerce UI не используется. */
function getShopSynergyExtraClasses() {
  return "";
}

function getBenchSynergyExtraClasses() {
  return "";
}

function resolveActiveDragSynergyTetherTargets() {
  return [];
}

window.getBoardItemClientCenter = getBoardItemClientCenter;
window.getShopSynergyHint = getShopSynergyHint;
window.getShopSynergyExtraClasses = getShopSynergyExtraClasses;
window.getBenchSynergyExtraClasses = getBenchSynergyExtraClasses;
window.resolveActiveDragSynergyTetherTargets = resolveActiveDragSynergyTetherTargets;
