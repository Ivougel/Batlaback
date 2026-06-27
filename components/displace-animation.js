/**
 * Анимация вытеснения: предметы «вываливаются» с доски и падают на скамейку.
 * Рисуется в DOM-overlay (viewport), чтобы траектория была видна между рюкзаком и магазином.
 */

const DISPLACE_FALL_DURATION = 2;
const DISPLACE_STAGGER = 0.14;

let displaceAnimations = [];
let displaceAnimIdCounter = 0;
const displaceDomActive = new Map();

function easeInQuad(t) {
  return t * t;
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
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

function ensureDisplaceLayer() {
  let layer = document.getElementById("displace-fx-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "displace-fx-layer";
    layer.className = "displace-fx-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
  }
  return layer;
}

function clearDisplaceDomLayer() {
  displaceDomActive.forEach((el) => el.remove());
  displaceDomActive.clear();
  const layer = document.getElementById("displace-fx-layer");
  if (layer) layer.innerHTML = "";
}

function sampleDisplaceAnimPoint(anim, localAge) {
  if (localAge < 0) {
    return {
      x: anim.fromX,
      y: anim.fromY,
      alpha: 1,
      scale: 1,
    };
  }

  const t = Math.min(1, localAge / anim.duration);
  const fallT = easeInQuad(t);
  const slideT = easeInOutSine(t);
  const { x: scaleX, y: scaleY } = getCanvasClientScale();
  const arcLift = Math.sin(t * Math.PI) * uiPx(52) * scaleY;
  const x = anim.fromX
    + (anim.toX - anim.fromX) * slideT
    + Math.sin(t * Math.PI * 2) * anim.wobble * uiPx(10) * scaleX * (1 - t);
  const y = anim.fromY + (anim.toY - anim.fromY) * fallT - arcLift;
  const alpha = t > 0.94 ? 1 - (t - 0.94) / 0.06 : 1;
  const scale = 1 - t * 0.08;

  return { x, y, alpha, scale };
}

function renderDisplaceDomAnimations() {
  if (!displaceAnimations.length) {
    if (displaceDomActive.size) clearDisplaceDomLayer();
    return;
  }

  const layer = ensureDisplaceLayer();
  const active = new Set();
  const uiScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1;
  const fontSize = 52 * uiScale;

  displaceAnimations.forEach((anim) => {
    active.add(anim.id);
    const localAge = anim.age - anim.delay;
    const pt = sampleDisplaceAnimPoint(anim, localAge);

    let el = displaceDomActive.get(anim.id);
    if (!el) {
      el = document.createElement("div");
      el.className = "displace-flight";
      el.textContent = getDisplaceItemEmoji(anim.item);
      layer.appendChild(el);
      displaceDomActive.set(anim.id, el);
    }

    el.style.fontSize = `${fontSize}px`;
    el.style.opacity = String(pt.alpha);
    el.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0) translate(-50%, -50%) scale(${pt.scale})`;
  });

  displaceDomActive.forEach((el, id) => {
    if (active.has(id)) return;
    el.remove();
    displaceDomActive.delete(id);
  });
}

function queueDisplaceToBenchAnimations(side, items, team, onItemLanded) {
  if (!items?.length) return;

  const { x: scaleX } = getCanvasClientScale();

  items.forEach((item, index) => {
    const from = getItemVisualCenterClient(item, team);
    const to = getBenchTargetClientPoint(side, index);
    displaceAnimations.push({
      id: ++displaceAnimIdCounter,
      side,
      item: {
        itemId: item.itemId,
        uid: item.uid,
        rotation: item.rotation || 0,
        col: item.col,
        row: item.row,
      },
      team,
      fromX: from.x,
      fromY: from.y,
      toX: to.x + (index - (items.length - 1) / 2) * uiPx(6) * scaleX,
      toY: to.y,
      delay: index * DISPLACE_STAGGER,
      age: 0,
      duration: DISPLACE_FALL_DURATION,
      wobble: (Math.random() - 0.5) * 0.35,
      onComplete: () => {
        const st = getSideState(side);
        st.bench.push({
          itemId: item.itemId,
          uid: item.uid,
          rotation: item.rotation || 0,
        });
        if (typeof onItemLanded === "function") onItemLanded(item, side);
      },
    });
  });

  renderDisplaceDomAnimations();
}

function tickDisplaceAnimations(dt) {
  if (!displaceAnimations.length) return;

  displaceAnimations = displaceAnimations.filter((anim) => {
    anim.age += dt;
    if (anim.age < anim.delay + anim.duration) return true;

    try {
      anim.onComplete?.();
    } catch (err) {
      console.error("displace onComplete failed:", err);
    }
    return false;
  });

  renderDisplaceDomAnimations();
}

function hasActiveDisplaceAnimations(side = null) {
  if (!side) return displaceAnimations.length > 0;
  return displaceAnimations.some((anim) => anim.side === side);
}

/** @deprecated Canvas draw replaced by DOM overlay; kept for call-site compatibility. */
function drawDisplaceAnimations(_ctx, _team) {}

function clearDisplaceAnimations(side = null) {
  if (!side) {
    displaceAnimations = [];
    clearDisplaceDomLayer();
    return;
  }
  displaceAnimations = displaceAnimations.filter((anim) => anim.side !== side);
  renderDisplaceDomAnimations();
}
