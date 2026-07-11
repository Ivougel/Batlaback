/**
 * Утилиты слотов экипировки в рюкзаке (без UI манекена).
 * Несколько предметов одного типа слота могут лежать на поле одновременно.
 */

function deriveDollFromItems(items) {
  const doll = {
    head: null, chest: null, leftHand: null, rightHand: null,
    gloves: null, boots: null, ring1: null, ring2: null, amulet: null,
  };
  const uidBySlot = { ...doll };
  let ringCount = 0;

  (items || []).forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    const slot = def?.slot;
    if (!slot) return;

    if (slot === "twoHand") {
      if (!doll.leftHand) {
        doll.leftHand = item.itemId;
        doll.rightHand = item.itemId;
        uidBySlot.leftHand = item.uid;
        uidBySlot.rightHand = item.uid;
      }
    } else if (slot === "ring") {
      const ringSlot = ringCount === 0 ? "ring1" : ringCount === 1 ? "ring2" : null;
      if (ringSlot && !doll[ringSlot]) {
        doll[ringSlot] = item.itemId;
        uidBySlot[ringSlot] = item.uid;
        ringCount += 1;
      }
    } else if (slot === "leftHand" && !doll.leftHand) {
      doll.leftHand = item.itemId;
      uidBySlot.leftHand = item.uid;
    } else if (slot === "rightHand" && !doll.rightHand) {
      doll.rightHand = item.itemId;
      uidBySlot.rightHand = item.uid;
    } else if (Object.prototype.hasOwnProperty.call(doll, slot) && !doll[slot]) {
      doll[slot] = item.itemId;
      uidBySlot[slot] = item.uid;
    }
  });

  return { doll, uidBySlot };
}

function listSlotItemIds(items) {
  const ids = [];
  const seen = new Set();
  (items || []).forEach((item) => {
    if (!ITEM_CATALOG[item.itemId]?.slot || seen.has(item.uid)) return;
    seen.add(item.uid);
    ids.push(item.itemId);
  });
  return ids;
}

/** @deprecated Используйте listSlotItemIds — оставлено для совместимости. */
function listDollEquippedItems(items) {
  return listSlotItemIds(items).map((itemId) => {
    const item = (items || []).find((entry) => entry.itemId === itemId);
    const def = ITEM_CATALOG[itemId];
    return {
      slotId: def?.slot || "unknown",
      itemId,
      uid: item?.uid,
      def,
    };
  });
}

function getDollState(items) {
  if (items) return deriveDollFromItems(items).doll;
  if (typeof getSideState === "function") {
    const side = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
    return deriveDollFromItems(getSideState(side).items).doll;
  }
  return deriveDollFromItems([]).doll;
}

function canAddSlotItemToLoadout(items, itemId, excludeUid = null, alsoExcludeUids = []) {
  const def = ITEM_CATALOG[itemId];
  if (!def?.slot) return true;
  const heroClass = typeof getLoadoutHeroClass === "function" ? getLoadoutHeroClass() : null;
  if (typeof isItemAllowedForHeroClass === "function" && !isItemAllowedForHeroClass(itemId, heroClass)) {
    return false;
  }
  if (typeof canCompanionEquipItem === "function" && typeof getActiveCompanionIdForLoadout === "function") {
    const companionId = getActiveCompanionIdForLoadout();
    if (!canCompanionEquipItem(companionId, itemId, def)) return false;
  }
  return true;
}
