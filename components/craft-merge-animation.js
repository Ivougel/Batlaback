/**
 * Анимация отложенного крафта (3 с):
 * отрыв от ячеек → сближение → вспышка → один предмет.
 */

const CRAFT_MERGE_DURATION_SEC = 3;
const CRAFT_MERGE_LIFT_END = 0.5;
const CRAFT_MERGE_CONVERGE_END = 1.95;
const CRAFT_MERGE_FLASH_END = 2.55;

const craftMergeHiddenBySide = {
  player: new Set(),
  enemy: new Set(),
};

let craftMergeLayerEl = null;
let activeCraftMerges = [];

function craftMergeUiPx(n) {
  if (typeof LayoutScales !== "undefined") return n * LayoutScales.gameScale();
  const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1;
  return n * scale;
}

function craftMergeUiScale() {
  if (typeof LayoutScales !== "undefined") return LayoutScales.gameScale();
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1;
}

function clamp01(t) {
  return Math.min(1, Math.max(0, t));
}

function easeOutCubic(t) {
  const x = clamp01(t);
  return 1 - (1 - x) ** 3;
}

function easeInOutCubic(t) {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

function easeOutBack(t) {
  const x = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

function ensureCraftMergeSideSets(side) {
  if (!craftMergeHiddenBySide[side]) craftMergeHiddenBySide[side] = new Set();
}

function getCraftMergeHiddenUids(side) {
  return craftMergeHiddenBySide[side] || new Set();
}

function getCraftMergeChargingUids(side) {
  const uids = new Set();
  activeCraftMerges.forEach((merge) => {
    if (side && merge.side !== side) return;
    (merge.hiddenUids || []).forEach((uid) => uids.add(uid));
  });
  return uids;
}

function hideCraftMergeUids(side, uids) {
  ensureCraftMergeSideSets(side);
  uids.forEach((uid) => craftMergeHiddenBySide[side].add(uid));
}

function clearCraftMergeHiddenUids(side, uids) {
  ensureCraftMergeSideSets(side);
  uids.forEach((uid) => craftMergeHiddenBySide[side].delete(uid));
}

function prepCraftMergeCoordsReady() {
  const canvasEl = document.getElementById("game-canvas");
  if (!canvasEl || canvasEl.width <= 0 || canvasEl.height <= 0) return false;
  const rect = canvasEl.getBoundingClientRect();
  if (rect.width <= 4 || rect.height <= 4) return false;
  return typeof cellRect === "function"
    && typeof boardItemClientCenter === "function";
}

function prepCraftMergeLayoutAnchored() {
  if (!prepCraftMergeCoordsReady()) return false;
  const canvasEl = document.getElementById("game-canvas");
  const rect = canvasEl.getBoundingClientRect();
  if (typeof shouldUseBBStackPrepLayout === "function" && shouldUseBBStackPrepLayout()) {
    const gridCol = document.querySelector(".bb-prep-inventory-grid");
    const island = document.getElementById("prep-field-island");
    if (!gridCol || !island || island.parentElement !== gridCol) return false;
    const gridRect = gridCol.getBoundingClientRect();
    if (!isUsableCraftMergeClientRect(gridRect)) return false;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    if (cx < gridRect.left - 24 || cx > gridRect.right + 24) return false;
    if (cy < gridRect.top - 24 || cy > gridRect.bottom + 48) return false;
  }
  return true;
}

function whenPrepCraftMergeCoordsReady(cb, attempt = 0) {
  if (prepCraftMergeCoordsReady()) {
    cb();
    return;
  }
  if (attempt >= 60) {
    cb();
    return;
  }
  requestAnimationFrame(() => whenPrepCraftMergeCoordsReady(cb, attempt + 1));
}

function whenPrepCraftMergeLayoutReady(cb, attempt = 0) {
  if (typeof syncBBPrepLayout === "function") syncBBPrepLayout();
  if (typeof scheduleCanvasFit === "function") scheduleCanvasFit();
  if (typeof window.syncFxCanvasGeometry === "function") window.syncFxCanvasGeometry();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!prepCraftMergeLayoutAnchored()) {
        if (attempt >= 90) {
          cb();
          return;
        }
        whenPrepCraftMergeLayoutReady(cb, attempt + 1);
        return;
      }
      cb();
    });
  });
}

function isUsableCraftMergeClientRect(rect) {
  return !!(rect && rect.width > 4 && rect.height > 4);
}

function getCraftMergeItemCenterClient(item, team) {
  if (typeof getItemVisualCenter === "function" && typeof canvasPointToClient === "function") {
    const center = getItemVisualCenter(item, team);
    const pt = center ? canvasPointToClient(center.x, center.y) : null;
    if (pt) return pt;
  }
  if (typeof boardItemClientCenter === "function") {
    const pt = boardItemClientCenter(item, team);
    if (pt) return pt;
  }
  return null;
}

function getClusterVisualCenterClient(clusterItems, team) {
  if (!clusterItems?.length) return null;
  if (typeof getItemVisualCenter === "function" && typeof canvasPointToClient === "function") {
    let sx = 0;
    let sy = 0;
    let count = 0;
    clusterItems.forEach((item) => {
      const center = getItemVisualCenter(item, team);
      if (!center) return;
      const pt = canvasPointToClient(center.x, center.y);
      if (!pt) return;
      sx += pt.x;
      sy += pt.y;
      count += 1;
    });
    if (count) return { x: sx / count, y: sy / count };
  }
  if (typeof boardItemClientCenter === "function") {
    let sx = 0;
    let sy = 0;
    let count = 0;
    clusterItems.forEach((item) => {
      const pt = boardItemClientCenter(item, team);
      if (!pt) return;
      sx += pt.x;
      sy += pt.y;
      count += 1;
    });
    if (count) return { x: sx / count, y: sy / count };
  }
  return null;
}

function refreshCraftMergeActorCoords(merge) {
  if (!merge?.clusterItems?.length) return false;
  const center = getClusterVisualCenterClient(merge.clusterItems, merge.side);
  if (!center) return false;
  merge.center = center;
  for (const actor of merge.actors) {
    const from = getCraftMergeItemCenterClient(actor.item, merge.side);
    if (!from) return false;
    actor.from = from;
  }
  if (merge.applied && merge.placedUid) {
    const st = getSideState(merge.side);
    const placed = st.items.find((item) => item.uid === merge.placedUid);
    if (placed) {
      const pt = getCraftMergeItemCenterClient(placed, merge.side);
      if (pt) merge.resultClient = pt;
    }
  }
  return true;
}

function buildCraftMergeActors(clusterItems, team) {
  const center = getClusterVisualCenterClient(clusterItems, team);
  if (!center) return null;

  const actors = [];
  for (const item of clusterItems) {
    const from = getCraftMergeItemCenterClient(item, team);
    if (!from) return null;
    actors.push({
      item,
      emoji: getCraftMergeItemEmoji(item),
      from,
    });
  }
  return { center, actors };
}

function getCraftMergeItemEmoji(item) {
  const def = ITEM_CATALOG[item.itemId];
  if (!def) return "📦";
  const icons = typeof getItemIcons === "function" ? getItemIcons(def) : [];
  return icons.join("") || def.icon || "📦";
}

function setCraftMergeActive(active) {
  document.documentElement.toggleAttribute("data-craft-merge-active", !!active);
}

function isCraftMergeBlockingPrep() {
  return document.documentElement.hasAttribute("data-craft-merge-active")
    || activeCraftMerges.length > 0;
}

function hasActiveCraftMergeAnimations(side = null) {
  if (!activeCraftMerges.length) return false;
  if (!side) return true;
  return activeCraftMerges.some((merge) => merge.side === side);
}

function getCraftMergeLayerHost() {
  return document.body;
}

function ensureCraftMergeLayer() {
  const host = getCraftMergeLayerHost();
  if (craftMergeLayerEl) {
    if (craftMergeLayerEl.parentElement !== host) {
      host.appendChild(craftMergeLayerEl);
    }
    return craftMergeLayerEl;
  }
  craftMergeLayerEl = document.getElementById("craft-merge-fx-layer");
  if (!craftMergeLayerEl) {
    craftMergeLayerEl = document.createElement("div");
    craftMergeLayerEl.id = "craft-merge-fx-layer";
    craftMergeLayerEl.className = "craft-merge-fx-layer";
    craftMergeLayerEl.setAttribute("aria-hidden", "true");
    host.appendChild(craftMergeLayerEl);
  } else if (craftMergeLayerEl.parentElement !== host) {
    host.appendChild(craftMergeLayerEl);
  }
  return craftMergeLayerEl;
}

function clearCraftMergeLayer() {
  if (craftMergeLayerEl) craftMergeLayerEl.innerHTML = "";
}

function sampleIngredientActor(actor, center, t) {
  const from = actor.from;
  const liftPx = craftMergeUiPx(32);

  if (t < CRAFT_MERGE_LIFT_END) {
    const u = easeOutCubic(t / CRAFT_MERGE_LIFT_END);
    return {
      x: from.x,
      y: from.y - liftPx * u,
      scale: 1 + 0.42 * u,
      alpha: 1,
      glow: 0.35 + u * 0.35,
      rotation: 0,
    };
  }

  if (t < CRAFT_MERGE_CONVERGE_END) {
    const u = easeInOutCubic((t - CRAFT_MERGE_LIFT_END) / (CRAFT_MERGE_CONVERGE_END - CRAFT_MERGE_LIFT_END));
    const startY = from.y - liftPx;
    const ctrlX = (from.x + center.x) / 2;
    const ctrlY = Math.min(startY, center.y) - craftMergeUiPx(36);
    const x = (1 - u) ** 2 * from.x + 2 * (1 - u) * u * ctrlX + u ** 2 * center.x;
    const y = (1 - u) ** 2 * startY + 2 * (1 - u) * u * ctrlY + u ** 2 * center.y;
    return {
      x,
      y,
      scale: 1.42 + 0.28 * u,
      alpha: 1,
      glow: 0.7 + u * 0.3,
      rotation: (u - 0.5) * 10,
    };
  }

  if (t < CRAFT_MERGE_FLASH_END) {
    const u = (t - CRAFT_MERGE_CONVERGE_END) / (CRAFT_MERGE_FLASH_END - CRAFT_MERGE_CONVERGE_END);
    const pulse = 1 + Math.sin(u * Math.PI) * 0.28;
    return {
      x: center.x,
      y: center.y,
      scale: 1.7 * pulse * (1 - u * 0.92),
      alpha: 1 - easeOutCubic(u),
      glow: 1 - u * 0.4,
      rotation: 0,
    };
  }

  return null;
}

function sampleResultActor(merge, t) {
  if (!merge.resultClient || t < CRAFT_MERGE_CONVERGE_END) return null;
  const center = merge.center;
  const final = merge.resultClient;
  const revealT = (t - CRAFT_MERGE_CONVERGE_END) / (CRAFT_MERGE_DURATION_SEC - CRAFT_MERGE_CONVERGE_END);
  const u = easeOutBack(clamp01(revealT));
  const flashU = clamp01((t - CRAFT_MERGE_CONVERGE_END) / 0.22);
  return {
    x: center.x + (final.x - center.x) * u,
    y: center.y + (final.y - center.y) * u,
    scale: 0.35 + 0.95 * u,
    alpha: flashU,
    glow: 0.85 * (1 - u * 0.35),
    rotation: 0,
  };
}

function applyCraftMergeState(merge) {
  if (merge.applied) return;
  merge.applied = true;

  const { side, entry, clusterItems } = merge;
  const st = getSideState(side);
  let result = resolvePendingCraftEntry(side, entry);
  if (!result && typeof applyRecipe === "function" && entry.recipe) {
    result = applyRecipe(st.containers ?? [], st.items, entry.recipe, clusterItems);
  }

  removePendingCraftEntries(side, [entry.key]);

  if (!result) {
    console.warn("craft merge failed, restoring ingredients", entry?.key);
    clearCraftMergeHiddenUids(side, merge.hiddenUids);
    return;
  }

  st.items = result.items;
  logPendingCraftResult(side, result.recipe);
  if (typeof playPrepSfx === "function") playPrepSfx("prep_craft");

  const placed = result.placed;
  merge.outputEmoji = placed ? getCraftMergeItemEmoji(placed) : "✨";
  merge.resultClient = placed ? getCraftMergeItemCenterClient(placed, side) : merge.center;
  merge.placedUid = placed?.uid || null;
  if (placed?.uid) {
    hideCraftMergeUids(side, [placed.uid]);
    merge.hiddenUids.push(placed.uid);
  }
}

function finishCraftMerge(merge) {
  const idx = activeCraftMerges.indexOf(merge);
  if (idx >= 0) activeCraftMerges.splice(idx, 1);
  clearCraftMergeHiddenUids(merge.side, merge.hiddenUids);
  if (!activeCraftMerges.length) {
    clearCraftMergeLayer();
    setCraftMergeActive(false);
  }
  if (typeof recalcSynergies === "function") recalcSynergies();
  if (typeof updateUI === "function") updateUI();
  merge.onComplete?.();
}

function renderCraftMergeInto(layer, merge) {
  const t = merge.age;
  const center = merge.center;
  const fontSize = 54 * craftMergeUiScale();

  if (t >= CRAFT_MERGE_CONVERGE_END && t <= CRAFT_MERGE_FLASH_END + 0.15) {
    const flashU = clamp01((t - CRAFT_MERGE_CONVERGE_END) / (CRAFT_MERGE_FLASH_END - CRAFT_MERGE_CONVERGE_END));
    const flash = document.createElement("div");
    flash.className = "craft-merge-flash";
    const size = craftMergeUiPx(90 + flashU * 110);
    flash.style.width = `${size}px`;
    flash.style.height = `${size}px`;
    flash.style.left = "0";
    flash.style.top = "0";
    flash.style.transform = `translate3d(${center.x}px, ${center.y}px, 0) translate(-50%, -50%)`;
    flash.style.opacity = String((1 - flashU * 0.55) * 0.95);
    layer.appendChild(flash);
  }

  merge.actors.forEach((actor) => {
    const vis = sampleIngredientActor(actor, center, t);
    if (!vis || vis.alpha <= 0.02) return;
    const el = document.createElement("div");
    el.className = "craft-merge-actor craft-merge-actor--ingredient";
    el.textContent = actor.emoji;
    el.style.fontSize = `${fontSize}px`;
    const px = Math.round(vis.x * 2) / 2;
    const py = Math.round(vis.y * 2) / 2;
    el.style.left = "0";
    el.style.top = "0";
    el.style.opacity = String(vis.alpha);
    el.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%) rotate(${vis.rotation}deg) scale(${vis.scale})`;
    el.style.filter = `drop-shadow(0 0 ${8 + vis.glow * 18}px rgba(255, 220, 140, ${0.55 + vis.glow * 0.4}))`;
    layer.appendChild(el);
  });

  const resultVis = sampleResultActor(merge, t);
  if (resultVis && resultVis.alpha > 0.02 && merge.outputEmoji) {
    const el = document.createElement("div");
    el.className = "craft-merge-actor craft-merge-actor--result";
    el.textContent = merge.outputEmoji;
    el.style.fontSize = `${fontSize}px`;
    const px = Math.round(resultVis.x * 2) / 2;
    const py = Math.round(resultVis.y * 2) / 2;
    el.style.left = "0";
    el.style.top = "0";
    el.style.opacity = String(resultVis.alpha);
    el.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%) scale(${resultVis.scale})`;
    el.style.filter = `drop-shadow(0 0 ${12 + resultVis.glow * 20}px rgba(255, 235, 170, ${0.65 + resultVis.glow * 0.35}))`;
    layer.appendChild(el);
  }
}

function renderCraftMerge(merge) {
  const layer = ensureCraftMergeLayer();
  layer.innerHTML = "";
  activeCraftMerges.forEach((entry) => renderCraftMergeInto(layer, entry));
  if (!activeCraftMerges.includes(merge)) {
    renderCraftMergeInto(layer, merge);
  }
}

function tickCraftMergeAnimations(dt) {
  if (!activeCraftMerges.length) return;

  const finished = [];
  activeCraftMerges.forEach((merge) => {
    refreshCraftMergeActorCoords(merge);
    merge.age += dt;
    if (!merge.applied && merge.age >= CRAFT_MERGE_CONVERGE_END) {
      applyCraftMergeState(merge);
      refreshCraftMergeActorCoords(merge);
    }
    if (merge.age >= CRAFT_MERGE_DURATION_SEC) {
      finished.push(merge);
    }
  });

  const layer = ensureCraftMergeLayer();
  layer.innerHTML = "";
  activeCraftMerges.forEach((merge) => renderCraftMergeInto(layer, merge));

  finished.forEach((merge) => finishCraftMerge(merge));
}

function playCraftMergeTimeline(side, entry, clusterItems, onComplete) {
  const built = buildCraftMergeActors(clusterItems, side);
  if (!built) {
    const hiddenUids = clusterItems.map((item) => item.uid);
    const merge = {
      side,
      entry,
      clusterItems,
      hiddenUids: [...hiddenUids],
      applied: false,
      center: { x: 0, y: 0 },
      actors: [],
      age: 0,
      onComplete,
    };
    applyCraftMergeState(merge);
    clearCraftMergeHiddenUids(side, hiddenUids);
    if (typeof recalcSynergies === "function") recalcSynergies();
    if (typeof updateUI === "function") updateUI();
    onComplete?.();
    return;
  }

  const { center, actors } = built;

  const hiddenUids = clusterItems.map((item) => item.uid);
  hideCraftMergeUids(side, hiddenUids);

  const merge = {
    side,
    entry,
    clusterItems,
    center,
    actors,
    age: 0,
    applied: false,
    outputEmoji: null,
    resultClient: null,
    hiddenUids: [...hiddenUids],
    onComplete,
  };

  activeCraftMerges.push(merge);
  setCraftMergeActive(true);
  ensureCraftMergeLayer();
  refreshCraftMergeActorCoords(merge);
  renderCraftMerge(merge);
  if (typeof updateUI === "function") updateUI();
}

function animateSingleCraftMerge(side, entry, onComplete) {
  const st = getSideState(side);
  const clusterItems = st.items.filter((item) => entry.itemUids.includes(item.uid));
  if (clusterItems.length !== entry.itemUids.length) {
    removePendingCraftEntries(side, [entry.key]);
    onComplete?.();
    return;
  }

  whenPrepCraftMergeLayoutReady(() => {
    playCraftMergeTimeline(side, entry, clusterItems, onComplete);
  });
}

function runDuePendingCraftMergeForSide(side, onComplete) {
  if (typeof syncPendingCraftClustersFromLastPrep === "function") {
    syncPendingCraftClustersFromLastPrep(side);
  }

  const due = getDuePendingCrafts(side);
  if (!due.length) {
    onComplete?.();
    return;
  }

  const queue = [...due];

  const runNext = () => {
    if (!queue.length) {
      onComplete?.();
      return;
    }
    const entry = queue.shift();
    animateSingleCraftMerge(side, entry, runNext);
  };

  whenPrepCraftMergeLayoutReady(runNext);
}

if (typeof window !== "undefined") {
  window.runDuePendingCraftMergeForSide = runDuePendingCraftMergeForSide;
  window.tickCraftMergeAnimations = tickCraftMergeAnimations;
  window.hasActiveCraftMergeAnimations = hasActiveCraftMergeAnimations;
  window.isCraftMergeBlockingPrep = isCraftMergeBlockingPrep;
  window.getCraftMergeChargingUids = getCraftMergeChargingUids;
  window.getCraftMergeHiddenUids = getCraftMergeHiddenUids;
}
