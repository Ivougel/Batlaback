/**
 * Анимация вытеснения: предметы летят с доски на скамейку.
 * Координаты — здесь; физика полёта — в ItemFlightController.
 */

const DISPLACE_STAGGER = ITEM_FLIGHT_STAGGER;

function isUsableClientRect(r) {
  return !!(r && r.width > 4 && r.height > 4);
}

function getCanvasClientScale() {
  const canvasEl = document.getElementById("game-canvas");
  if (!canvasEl) return { x: 1, y: 1 };
  const rect = canvasEl.getBoundingClientRect();
  return {
    x: rect.width / Math.max(1, canvasEl.width),
    y: rect.height / Math.max(1, canvasEl.height),
  };
}

function canvasPointToClient(x, y) {
  const canvasEl = document.getElementById("game-canvas");
  if (!canvasEl) return null;
  const canvasRect = canvasEl.getBoundingClientRect();
  if (!isUsableClientRect(canvasRect)) return null;
  const scale = getCanvasClientScale();
  return {
    x: canvasRect.left + x * scale.x,
    y: canvasRect.top + y * scale.y,
  };
}

function rectCenter(r) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function getItemVisualCenterOnBoard(item, team) {
  const cells = getItemCells(item);
  if (!cells.length) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  cells.forEach(([c, r]) => {
    const rect = cellRect(team, c, r);
    sx += rect.x + rect.w / 2;
    sy += rect.y + rect.h / 2;
  });
  return { x: sx / cells.length, y: sy / cells.length };
}

function getItemVisualCenterClient(item, team) {
  const center = getItemVisualCenterOnBoard(item, team);
  return canvasPointToClient(center.x, center.y) || center;
}

function usesBenchPopoverMode() {
  return typeof usesPrepBenchPopover === "function" && usesPrepBenchPopover();
}

function isBenchPopoverOpen() {
  return document.documentElement.hasAttribute("data-prep-bench-open");
}

function getPrepBenchFabClientPoint() {
  const fab = document.getElementById("btn-prep-bench-fab");
  if (!fab || fab.hidden) return null;
  if (getComputedStyle(fab).display === "none") return null;
  const r = fab.getBoundingClientRect();
  return isUsableClientRect(r) ? rectCenter(r) : null;
}

function getBenchSlotsClientPoint(slotIndex) {
  const slotsEl = document.getElementById("bench-slots");
  if (!slotsEl) return null;

  const panel = document.getElementById("bench-panel");
  if (panel) {
    const panelStyle = getComputedStyle(panel);
    if (panelStyle.display === "none" || panelStyle.visibility === "hidden") return null;
  }

  if (usesBenchPopoverMode() && !isBenchPopoverOpen()) return null;

  const maxBench = typeof getBenchMaxCapacity === "function"
    ? getBenchMaxCapacity()
    : (typeof MAX_BENCH !== "undefined" ? MAX_BENCH : 6);
  const idx = Math.min(Math.max(0, slotIndex), maxBench - 1);
  const cards = slotsEl.querySelectorAll(".bench-card");
  const targetEl = cards[idx] || cards[cards.length - 1] || slotsEl;
  const iconEl = targetEl.classList?.contains("empty")
    ? targetEl
    : (targetEl.querySelector(".icon") || targetEl);
  const tr = iconEl.getBoundingClientRect();
  return isUsableClientRect(tr) ? rectCenter(tr) : null;
}

function getBenchSlotClientPoint(side, slotIndex) {
  if (typeof shouldUsePrepStoragePhysics === "function" && shouldUsePrepStoragePhysics()
    && typeof PrepStoragePhysics !== "undefined") {
    return PrepStoragePhysics.getInboundTarget(side, slotIndex);
  }

  const slotPt = getBenchSlotsClientPoint(slotIndex);
  if (slotPt) return slotPt;

  const fabPt = getPrepBenchFabClientPoint();
  if (fabPt) return fabPt;

  if (isBenchPopoverOpen()) {
    const panel = document.querySelector("#prep-bench-popover .prep-bench-popover__panel");
    const pr = panel?.getBoundingClientRect();
    if (isUsableClientRect(pr)) return rectCenter(pr);
  }

  const benchPanel = document.getElementById("bench-panel");
  if (benchPanel) {
    const br = benchPanel.getBoundingClientRect();
    if (isUsableClientRect(br)) return rectCenter(br);
  }

  const shop = document.getElementById("shop-panel")?.getBoundingClientRect();
  if (isUsableClientRect(shop)) {
    return { x: shop.left + shop.width * 0.5, y: shop.top + shop.height * 0.82 };
  }

  const canvasFallback = canvasPointToClient(
    typeof uiPx === "function" ? uiPx(48) : 48,
    typeof uiPx === "function" ? uiPx(320) : 320,
  );
  if (canvasFallback) return canvasFallback;

  const vv = window.visualViewport;
  return {
    x: (vv?.width ?? window.innerWidth) - 56,
    y: (vv?.height ?? window.innerHeight) - 96,
  };
}

function getBenchTargetClientPoint(side, slotOffset = 0) {
  const st = getSideState(side);
  return getBenchSlotClientPoint(side, st.bench.length + slotOffset);
}

function getDisplaceItemEmoji(item) {
  const def = ITEM_CATALOG[item.itemId];
  if (!def) return "📦";
  const icons = typeof getItemIcons === "function" ? getItemIcons(def) : [];
  return icons.join("") || "📦";
}

function queueDisplaceToBenchAnimations(side, items, team, onItemLanded) {
  if (!items?.length || typeof queueItemFlight !== "function") return;

  const benchBase = getSideState(side).bench.length;
  let landedCount = 0;
  const total = items.length;

  items.forEach((item, index) => {
    const benchSlot = benchBase + index;
    const from = getItemVisualCenterClient(item, team);
    const to = getBenchSlotClientPoint(side, benchSlot);
    queueItemFlight({
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      emoji: getDisplaceItemEmoji(item),
      itemId: item.itemId,
      isDisplace: true,
      delay: index * DISPLACE_STAGGER,
      meta: { side, team, item, benchSlot },
      onComplete: () => {
        if (typeof onItemLanded === "function") onItemLanded(item, side, to);
        landedCount += 1;
        if (landedCount >= total) {
          if (typeof renderBench === "function") renderBench(side);
          if (typeof PrepStoragePhysics !== "undefined"
            && typeof shouldUsePrepStoragePhysics === "function"
            && shouldUsePrepStoragePhysics()) {
            PrepStoragePhysics.sync(side);
          }
          if (typeof recalcSynergies === "function") recalcSynergies();
          if (typeof updateUI === "function") updateUI();
        }
      },
    });
  });
}

function tickDisplaceAnimations(dt) {
  if (typeof tickItemFlights === "function") tickItemFlights(dt);
}

function hasActiveDisplaceAnimations(side = null) {
  if (typeof hasActiveItemFlights !== "function") return false;
  if (!side) return hasActiveItemFlights();
  return hasActiveItemFlights((m) => m.meta?.side === side);
}

/** @deprecated Canvas draw replaced by DOM overlay; kept for call-site compatibility. */
function drawDisplaceAnimations(_ctx, _team) {}

function clearDisplaceAnimations(side = null) {
  if (typeof clearItemFlights !== "function") return;
  if (!side) {
    clearItemFlights();
    return;
  }
  clearItemFlights((m) => m.meta?.side === side);
}
