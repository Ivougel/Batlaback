const DOLL_SLOTS = {
  head:      { label: "Голова",      accepts: ["head"],      max: 1 },
  chest:     { label: "Броня",       accepts: ["chest"],     max: 1 },
  leftHand:  { label: "Левая рука",  accepts: ["leftHand", "shield", "twoHand"], max: 1 },
  rightHand: { label: "Правая рука", accepts: ["rightHand", "twoHand"], max: 1 },
  gloves:    { label: "Перчатки",    accepts: ["gloves"],    max: 1 },
  boots:     { label: "Обувь",       accepts: ["boots"],     max: 1 },
  ring1:     { label: "Кольцо 1",    accepts: ["ring"],      max: 1 },
  ring2:     { label: "Кольцо 2",    accepts: ["ring"],      max: 1 },
  amulet:    { label: "Амулет",      accepts: ["amulet"],    max: 1 },
};

const DOLL_SLOT_PLACEHOLDERS = {
  head: "👑", chest: "🫁", leftHand: "🤜", rightHand: "🤛",
  gloves: "🧤", boots: "👢", ring1: "💍", ring2: "💍", amulet: "📿",
};

function getSlotOccupancy(items, excludeUids = null) {
  const exclude = excludeUids instanceof Set ? excludeUids : new Set(excludeUids || []);
  const occ = {
    head: false,
    chest: false,
    gloves: false,
    boots: false,
    amulet: false,
    ring: 0,
    leftHand: false,
    rightHand: false,
  };
  (items || []).forEach((item) => {
    if (exclude.has(item.uid)) return;
    const slot = ITEM_CATALOG[item.itemId]?.slot;
    if (!slot) return;
    if (slot === "twoHand") {
      occ.leftHand = true;
      occ.rightHand = true;
    } else if (slot === "leftHand") {
      occ.leftHand = true;
    } else if (slot === "rightHand") {
      occ.rightHand = true;
    } else if (slot === "ring") {
      occ.ring += 1;
    } else if (Object.prototype.hasOwnProperty.call(occ, slot)) {
      occ[slot] = true;
    }
  });
  return occ;
}

function isSlotAvailableForType(occ, slotType) {
  switch (slotType) {
    case "head":
    case "chest":
    case "gloves":
    case "boots":
    case "amulet":
      return !occ[slotType];
    case "ring":
      return occ.ring < 2;
    case "twoHand":
      return !occ.leftHand && !occ.rightHand;
    case "leftHand":
      return !occ.leftHand;
    case "rightHand":
      return !occ.rightHand;
    default:
      return true;
  }
}

/** Можно ли добавить предмет с slot в loadout (с учётом вытесняемых uid). */
function canAddSlotItemToLoadout(items, itemId, excludeUid = null, alsoExcludeUids = []) {
  const def = ITEM_CATALOG[itemId];
  if (!def?.slot) return true;
  const exclude = new Set(alsoExcludeUids);
  if (excludeUid) exclude.add(excludeUid);
  const occ = getSlotOccupancy(items, exclude);
  return isSlotAvailableForType(occ, def.slot);
}

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
      doll.leftHand = item.itemId;
      doll.rightHand = item.itemId;
      uidBySlot.leftHand = item.uid;
      uidBySlot.rightHand = item.uid;
    } else if (slot === "ring") {
      const ringSlot = ringCount === 0 ? "ring1" : ringCount === 1 ? "ring2" : null;
      if (ringSlot) {
        doll[ringSlot] = item.itemId;
        uidBySlot[ringSlot] = item.uid;
        ringCount += 1;
      }
    } else if (slot === "leftHand") {
      doll.leftHand = item.itemId;
      uidBySlot.leftHand = item.uid;
    } else if (slot === "rightHand") {
      doll.rightHand = item.itemId;
      uidBySlot.rightHand = item.uid;
    } else if (Object.prototype.hasOwnProperty.call(doll, slot)) {
      doll[slot] = item.itemId;
      uidBySlot[slot] = item.uid;
    }
  });

  return { doll, uidBySlot };
}

function getDollState(items) {
  if (items) return deriveDollFromItems(items).doll;
  if (typeof getSideState === "function") {
    const side = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
    return deriveDollFromItems(getSideState(side).items).doll;
  }
  return deriveDollFromItems([]).doll;
}

function canEquipToSlot(itemId, slotId) {
  const def = ITEM_CATALOG[itemId];
  if (!def || !def.slot) return false;
  const slot = DOLL_SLOTS[slotId];
  if (!slot) return false;
  if (def.slot === "twoHand") {
    return slotId === "leftHand" || slotId === "rightHand";
  }
  return slot.accepts.includes(def.slot);
}

function findFirstLoadoutPlacement(containers, items, itemId, rotation = 0, excludeUid = null) {
  if (typeof buildSlotSet !== "function" || typeof resolveLoadoutPlacement !== "function") return null;
  const slots = [...buildSlotSet(containers)].map((k) => k.split(",").map(Number));
  const startRot = ((rotation || 0) % 4 + 4) % 4;
  const rotations = [startRot];
  for (let r = 0; r < 4; r++) if (r !== startRot) rotations.push(r);
  for (const rot of rotations) {
    for (const [col, row] of slots) {
      const placement = resolveLoadoutPlacement(containers, items, itemId, col, row, rot, excludeUid);
      if (placement.valid) return placement;
    }
  }
  return null;
}

function canDropItemOnDollSlot(items, containers, itemId, slotId, excludeUid = null, rotation = 0) {
  if (!canEquipToSlot(itemId, slotId)) return false;
  if (!canAddSlotItemToLoadout(items, itemId, excludeUid)) return false;
  return !!findFirstLoadoutPlacement(containers, items, itemId, rotation, excludeUid);
}

function removeLoadoutItemToBench(itemUid, side) {
  if (!itemUid || typeof getSideState !== "function") return false;
  const st = getSideState(side);
  const idx = st.items.findIndex((i) => i.uid === itemUid);
  if (idx < 0) return false;
  const [removed] = st.items.splice(idx, 1);
  const maxBench = typeof MAX_BENCH !== "undefined" ? MAX_BENCH : 6;
  if (st.bench.length >= maxBench) {
    st.items.splice(idx, 0, removed);
    if (typeof log === "function") log("Скамейка полна!");
    return false;
  }
  st.bench.push({
    itemId: removed.itemId,
    uid: removed.uid,
    rotation: removed.rotation || 0,
  });
  return true;
}

function resetDoll() {
  syncDollUI();
}

function syncDollUI(side) {
  const s = side ?? (typeof prepViewSide !== "undefined" ? prepViewSide : "player");
  const items = typeof getSideState === "function" ? getSideState(s).items : [];
  const { doll } = deriveDollFromItems(items);

  Object.entries(doll).forEach(([slotId, itemId]) => {
    const slotEl = document.querySelector(`.doll-slot[data-slot="${slotId}"]`);
    if (!slotEl) return;
    if (itemId) {
      const def = ITEM_CATALOG[itemId];
      slotEl.classList.add("doll-slot--filled");
      slotEl.textContent = def?.icon || "?";
      slotEl.title = def?.name || itemId;
    } else {
      slotEl.classList.remove("doll-slot--filled");
      slotEl.textContent = DOLL_SLOT_PLACEHOLDERS[slotId] || "○";
      slotEl.title = DOLL_SLOTS[slotId]?.label || slotId;
    }
  });
}

function isDollOpen() {
  const app = document.getElementById("app");
  const layer = document.getElementById("prep-doll-layer");
  return app?.getAttribute("data-doll-open") === "true"
    || layer?.classList.contains("doll-open");
}

function hitTestDollSlot(clientX, clientY) {
  if (!isDollOpen()) return null;
  const pad = (typeof isTouchUi === "function" && isTouchUi()) ? 10 : 0;
  let hit = null;
  document.querySelectorAll(".doll-slot[data-slot]").forEach((slotEl) => {
    const r = slotEl.getBoundingClientRect();
    if (clientX >= r.left - pad && clientX <= r.right + pad
      && clientY >= r.top - pad && clientY <= r.bottom + pad) {
      hit = slotEl.dataset.slot;
    }
  });
  return hit;
}

function tryFinishDragOnDoll(e) {
  if (typeof phase === "undefined" || phase !== "prep") return false;
  if (!dragPayload || !dragFrom) return false;
  if (!isDollOpen()) return false;
  if (dragFrom.type === "container") return false;

  const slotId = hitTestDollSlot(e.clientX, e.clientY);
  if (!slotId) return false;

  const side = dragFrom.side || prepViewSide;
  const st = typeof getSideState === "function" ? getSideState(side) : null;
  if (!st) return false;

  const itemId = dragPayload.itemId;
  const excludeUid = dragFrom.type === "item" ? dragFrom.item?.uid : null;

  function rejectDrop() {
    if (typeof restoreDraggedItem === "function") restoreDraggedItem(side);
    if (typeof notifyPrepPlacementRejected === "function" && dragFrom.type === "item" && dragFrom.item) {
      notifyPrepPlacementRejected(dragFrom.item);
    }
    return true;
  }

  if (!canDropItemOnDollSlot(st.items, st.containers, itemId, slotId, excludeUid, dragPayload.rotation || 0)) {
    return rejectDrop();
  }

  const placement = findFirstLoadoutPlacement(
    st.containers,
    st.items,
    itemId,
    dragPayload.rotation || 0,
    excludeUid,
  );
  if (!placement) return rejectDrop();

  if (dragFrom.type === "bench") {
    st.bench.splice(dragFrom.index, 1);
    if (typeof selectedBench !== "undefined" && selectedBench === dragFrom.index) selectedBench = -1;
  } else if (dragFrom.type === "shop") {
    if (typeof commitShopPurchase !== "function") return rejectDrop();
    const boughtId = commitShopPurchase(dragFrom.index, side);
    if (!boughtId) return rejectDrop();
    dragPayload.itemId = boughtId;
  } else if (dragFrom.type !== "item") {
    return false;
  }

  const finalItemId = dragPayload.itemId;
  const placed = createPlacedItem(finalItemId, placement.col, placement.row, placement.rotation);
  if (dragFrom.type === "item") {
    placed.uid = dragFrom.item.uid;
    if (dragFrom.item.socketedGems) placed.socketedGems = [...dragFrom.item.socketedGems];
  }
  st.items = [...st.items, placed];
  dragPayload.rotation = placement.rotation;
  if (typeof notifyPrepItemPlaced === "function") {
    notifyPrepItemPlaced(placed, ITEM_CATALOG[placed.itemId]);
  }
  syncDollUI(side);
  return true;
}

function clearDollDropHighlight() {
  document.querySelectorAll(".doll-slot").forEach((slotEl) => {
    slotEl.classList.remove("doll-slot--drop-valid", "doll-slot--drop-invalid", "doll-slot--drop-hover");
  });
}

function updateDollDropHighlight(clientX, clientY) {
  if (!isDollOpen() || typeof dragPayload === "undefined" || !dragPayload) {
    clearDollDropHighlight();
    return;
  }
  const itemId = dragPayload.itemId;
  const def = ITEM_CATALOG[itemId];
  if (!def?.slot || dragFrom?.type === "container") {
    clearDollDropHighlight();
    return;
  }

  const side = dragFrom?.side || (typeof prepViewSide !== "undefined" ? prepViewSide : "player");
  const st = typeof getSideState === "function" ? getSideState(side) : null;
  const excludeUid = dragFrom?.type === "item" ? dragFrom.item?.uid : null;
  const hover = hitTestDollSlot(clientX, clientY);

  document.querySelectorAll(".doll-slot").forEach((slotEl) => {
    const sid = slotEl.dataset.slot;
    slotEl.classList.remove("doll-slot--drop-valid", "doll-slot--drop-invalid", "doll-slot--drop-hover");
    const ok = st && canDropItemOnDollSlot(
      st.items,
      st.containers,
      itemId,
      sid,
      excludeUid,
      dragPayload.rotation || 0,
    );
    slotEl.classList.add(ok ? "doll-slot--drop-valid" : "doll-slot--drop-invalid");
    if (hover === sid) slotEl.classList.add("doll-slot--drop-hover");
  });
}

function chainDollDragHooks() {
  const prevMove = typeof onPrepDragMove === "function" ? onPrepDragMove : null;
  const prevEnd = typeof onPrepDragEnd === "function" ? onPrepDragEnd : null;

  onPrepDragMove = function dollPrepDragMove(clientX, clientY) {
    if (prevMove) prevMove(clientX, clientY);
    updateDollDropHighlight(clientX, clientY);
  };

  onPrepDragEnd = function dollPrepDragEnd() {
    if (prevEnd) prevEnd();
    clearDollDropHighlight();
  };
}

function initDollSlotClicks() {
  document.querySelectorAll(".doll-slot").forEach((slotEl) => {
    slotEl.addEventListener("click", () => {
      const slotId = slotEl.dataset.slot;
      const side = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
      if (typeof getSideState !== "function") return;
      const st = getSideState(side);
      const { uidBySlot } = deriveDollFromItems(st.items);
      const itemUid = uidBySlot[slotId];
      if (!itemUid) return;
      if (removeLoadoutItemToBench(itemUid, side)) {
        if (typeof renderBench === "function") renderBench(side);
        if (typeof recalcSynergies === "function") recalcSynergies();
        syncDollUI(side);
      }
    });
  });
  syncDollUI();
  chainDollDragHooks();
}

document.addEventListener("DOMContentLoaded", initDollSlotClicks);
