/**
 * Анимация вытеснения: предметы летят с доски на скамейку.
 * Координаты — здесь; физика полёта — в ItemFlightController.
 */

const DISPLACE_STAGGER = ITEM_FLIGHT_STAGGER;

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
  if (!canvasEl) return { x, y };
  const canvasRect = canvasEl.getBoundingClientRect();
  const scale = getCanvasClientScale();
  return {
    x: canvasRect.left + x * scale.x,
    y: canvasRect.top + y * scale.y,
  };
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
  return canvasPointToClient(center.x, center.y);
}

function getBenchTargetClientPoint(side, slotOffset = 0) {
  const slotsEl = document.getElementById("bench-slots");
  if (!slotsEl) {
    const fallback = canvasPointToClient(uiPx(48), 320);
    return { x: fallback.x, y: fallback.y };
  }

  const st = getSideState(side);
  const slotIndex = Math.min(
    st.bench.length + slotOffset,
    Math.max(0, (typeof MAX_BENCH !== "undefined" ? MAX_BENCH : 6) - 1),
  );
  const cards = slotsEl.querySelectorAll(".bench-card");
  const targetEl = cards[slotIndex] || slotsEl;
  const tr = targetEl.getBoundingClientRect();

  return {
    x: tr.left + tr.width / 2,
    y: tr.top + tr.height / 2,
  };
}

function getDisplaceItemEmoji(item) {
  const def = ITEM_CATALOG[item.itemId];
  if (!def) return "📦";
  const icons = typeof getItemIcons === "function" ? getItemIcons(def) : [];
  return icons.join("") || "📦";
}

function queueDisplaceToBenchAnimations(side, items, team, onItemLanded) {
  if (!items?.length || typeof queueItemFlight !== "function") return;

  const { x: scaleX } = getCanvasClientScale();

  items.forEach((item, index) => {
    const from = getItemVisualCenterClient(item, team);
    const to = getBenchTargetClientPoint(side, index);
    queueItemFlight({
      fromX: from.x,
      fromY: from.y,
      toX: to.x + (index - (items.length - 1) / 2) * uiPx(6) * scaleX,
      toY: to.y,
      emoji: getDisplaceItemEmoji(item),
      itemId: item.itemId,
      delay: index * DISPLACE_STAGGER,
      meta: { side, team, item },
      onComplete: () => {
        if (typeof onItemLanded === "function") onItemLanded(item, side);
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
