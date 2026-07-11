/**
 * Prep drag/drop runtime — вынесено из game.js.
 * Состояние (dragPayload, dragFrom, pending*Drag, …) остаётся в game.js.
 */

let prepDragGhostRaf = 0;
let prepDragGhostPending = null;

function cancelPrepDragGhostRaf() {
  if (prepDragGhostRaf) {
    cancelAnimationFrame(prepDragGhostRaf);
    prepDragGhostRaf = 0;
  }
  prepDragGhostPending = null;
}

function scheduleSyncDragGhostOverlay(clientX, clientY) {
  if (!dragPayload) {
    cancelPrepDragGhostRaf();
    return;
  }
  prepDragGhostPending = { x: clientX, y: clientY };
  if (prepDragGhostRaf) return;
  prepDragGhostRaf = requestAnimationFrame(() => {
    prepDragGhostRaf = 0;
    const pending = prepDragGhostPending;
    prepDragGhostPending = null;
    if (!pending || !dragPayload) return;
    syncDragGhostOverlay(pending.x, pending.y);
  });
}

/** На touch drag стартует только после «свободы» для tap-to-tooltip. */
function getPrepDragCommitThresholdPx() {
  return isTouchUi()
    ? Math.max(TOUCH_DRAG_THRESHOLD_PX, TOOLTIP_CONFIG.moveTolerance)
    : MOUSE_DRAG_THRESHOLD_PX;
}

let prepDragPointerVel = { vx: 0, vy: 0 };
let prepDragPointerPrev = { x: 0, y: 0, t: 0 };
let prepScreenFlingSuppress = false;
let lastPrepDragHoverCellKey = null;

function resetPrepDragPointerVelocity() {
  prepDragPointerVel = { vx: 0, vy: 0 };
  prepDragPointerPrev = { x: 0, y: 0, t: 0 };
}

function samplePrepDragPointerVelocity(clientX, clientY) {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (prepDragPointerPrev.t > 0) {
    const dt = Math.max(0.008, (now - prepDragPointerPrev.t) / 1000);
    const rawVx = (clientX - prepDragPointerPrev.x) / dt;
    const rawVy = (clientY - prepDragPointerPrev.y) / dt;
    prepDragPointerVel.vx = prepDragPointerVel.vx * 0.55 + rawVx * 0.45;
    prepDragPointerVel.vy = prepDragPointerVel.vy * 0.55 + rawVy * 0.45;
  }
  prepDragPointerPrev = { x: clientX, y: clientY, t: now };
}

function getPrepDragReleaseVelocity() {
  return {
    vx: prepDragPointerVel.vx * 1.12,
    vy: prepDragPointerVel.vy * 1.22,
  };
}

function releaseBenchEntryToStoragePhysics(st, dragFrom, clientX, clientY, side) {
  if (!dragFrom?.benchEntry) return false;
  const entry = dragFrom.benchEntry;
  const idx = Math.min(Math.max(0, dragFrom.index ?? st.bench.length), st.bench.length);
  st.bench.splice(idx, 0, entry);
  dragFrom.benchEntry = null;
  if (typeof PrepStoragePhysics !== "undefined"
    && typeof shouldUsePrepStoragePhysics === "function"
    && shouldUsePrepStoragePhysics()) {
    const vel = getPrepDragReleaseVelocity();
    if (typeof PrepStoragePhysics.ensureBenchEntryInteractive === "function") {
      PrepStoragePhysics.ensureBenchEntryInteractive(entry, side, clientX, clientY, vel.vx, vel.vy);
    } else {
      PrepStoragePhysics.onDragCancel(entry);
      PrepStoragePhysics.releaseAtDrop(entry, clientX, clientY, vel.vx, vel.vy, side);
    }
    return true;
  }
  return false;
}

/** Прямое размещение на сетке — только при отпускании над инвентарём (как в оригинале BB). */
function evaluateDirectInventoryPlacementOnDrop(dropClientX, dropClientY, side, st, opts = {}) {
  if (!dragPayload || !dragFrom) return null;
  if (opts.flingLanding) {
    return evaluateFlingInventoryPlacement(dropClientX, dropClientY, side, st);
  }
  const hoverClient = resolvePrepDragHoverClient(dropClientX, dropClientY);
  syncPrepDragBoardHover(dropClientX, dropClientY, hoverClient.x, hoverClient.y);
  const { x: mx, y: my } = canvasCoordsFromClient(hoverClient.x, hoverClient.y);
  if (!isOnBoard(mx, my, side)) return null;
  const placement = getPrepDropPlacement(st, side);
  if (!placement?.valid) return null;
  if (placement.kind === "item" && placement.benchOk === false) return null;
  return placement;
}

/** Приземление после screen fling: только ghost-позиция, без отмены из-за хранилища под пальцем. */
function evaluateFlingInventoryPlacement(clientX, clientY, side, st) {
  if (!dragPayload || !dragFrom) return null;
  const ghost = resolvePrepDragHoverClient(clientX, clientY);
  const hit = findPrepBoardHoverCellFromGhostClient(ghost.x, ghost.y, side);
  if (!hit) return null;
  applyPrepBoardHoverFromCell(hit.col, hit.row, side, st);
  const { x: mx, y: my } = canvasCoordsFromClient(ghost.x, ghost.y);
  if (!isOnBoard(mx, my, side)) return null;
  const placement = getPrepDropPlacement(st, side);
  if (!placement?.valid) return null;
  if (placement.kind === "item" && placement.benchOk === false) return null;
  return placement;
}

function hasPrepThrowIntentOnDrop(dropClientX, dropClientY, pointerOnBench) {
  const vel = getPrepDragReleaseVelocity();
  const speed = Math.hypot(vel.vx, vel.vy);
  if (speed >= 90) return true;
  if (Math.abs(vel.vy) >= 110) return true;
  if (Math.abs(vel.vx) >= 140) return true;
  const overStorage = typeof shouldUsePrepStoragePhysics === "function"
    && shouldUsePrepStoragePhysics()
    && typeof PrepStoragePhysics !== "undefined"
    && PrepStoragePhysics.isPointerInside(dropClientX, dropClientY);
  if (pointerOnBench || overStorage) {
    return speed >= 45 || Math.abs(vel.vy) >= 55;
  }
  return false;
}

function restoreDraggedItem(side = prepViewSide, source = dragFrom) {
  if (!source) return;
  const st = getLoadoutEditState(side);
  if (source.type === "item") {
    st.items = [...st.items, source.item];
  } else if (source.type === "container") {
    st.containers = [...st.containers, source.container];
    st.items = [...st.items, ...source.carriedItems];
  } else if (source.type === "bench") {
    restoreBenchDragEntry(st, source);
  }
}

function restoreFlingDragToStorage(flier, side) {
  const from = flier?.dragFrom;
  if (!from) return false;
  const st = getLoadoutEditState(side);
  if (from.type === "bench" && from.benchEntry) {
    const entry = from.benchEntry;
    const idx = Math.min(Math.max(0, from.index ?? st.bench.length), st.bench.length);
    if (!st.bench.some((e) => e.uid === entry.uid)) {
      st.bench.splice(idx, 0, entry);
    }
    from.benchEntry = null;
    if (typeof PrepStoragePhysics !== "undefined"
      && typeof shouldUsePrepStoragePhysics === "function"
      && shouldUsePrepStoragePhysics()
      && typeof PrepStoragePhysics.ensureBenchEntryInteractive === "function") {
      PrepStoragePhysics.ensureBenchEntryInteractive(
        entry,
        side,
        flier.x,
        flier.y,
        flier.vx * 0.25,
        flier.vy * 0.25,
      );
    } else {
      restoreBenchDragEntry(st, { type: "bench", index: idx, benchEntry: entry });
    }
    return true;
  }
  dragFrom = from;
  dragPayload = flier.dragPayload;
  restoreDraggedItem(side, from);
  dragFrom = null;
  dragPayload = null;
  return true;
}

function tryPrepScreenFlingOnDrop(dropClientX, dropClientY, side, st, dropOnSell, dropBackToShop, pointerOnBench) {
  if (prepScreenFlingSuppress) return false;
  if (typeof shouldUseBBStackPrepLayout !== "function" || !shouldUseBBStackPrepLayout()) return false;
  if (dropOnSell || dropBackToShop) return false;
  if (evaluateDirectInventoryPlacementOnDrop(dropClientX, dropClientY, side, st)) return false;
  if (typeof PrepStoragePhysics === "undefined" || !PrepStoragePhysics.beginScreenFling) return false;

  const vel = getPrepDragReleaseVelocity();
  const overStorage = typeof shouldUsePrepStoragePhysics === "function"
    && shouldUsePrepStoragePhysics()
    && PrepStoragePhysics.isPointerInside(dropClientX, dropClientY);
  if (!hasPrepThrowIntentOnDrop(dropClientX, dropClientY, pointerOnBench)
    && (overStorage || pointerOnBench)) {
    return false;
  }

  return PrepStoragePhysics.beginScreenFling({
    dragFrom,
    dragPayload,
    clientX: dropClientX,
    clientY: dropClientY,
    vx: vel.vx,
    vy: vel.vy,
    side,
  });
}

function resolvePrepScreenFlingLanding(flier) {
  if (!flier?.dragFrom || !flier?.dragPayload) return;
  const side = flier.side || prepViewSide;
  const st = getLoadoutEditState(side);

  try {
    prepScreenFlingSuppress = true;
    dragFrom = flier.dragFrom;
    dragPayload = flier.dragPayload;

    const placement = evaluateFlingInventoryPlacement(flier.x, flier.y, side, st);
    if (placement) {
      finishDragDrop(createSyntheticPointerEvent(flier.x, flier.y));
      return;
    }

    const sellEvt = createSyntheticPointerEvent(flier.x, flier.y);
    if (isDropOnSell(sellEvt) && sellDraggedItem(side)) {
      clearDragUiState();
      renderBench(side);
      recalcSynergies();
      updateUI();
      return;
    }

    if (typeof PrepStoragePhysics !== "undefined"
      && PrepStoragePhysics.absorbAtClient(
        flier.dragFrom,
        flier.dragPayload,
        flier.x,
        flier.y,
        flier.vx * 0.35,
        flier.vy * 0.35,
        side,
      )) {
      clearDragUiState();
      renderBench(side);
      recalcSynergies();
      updateUI();
      return;
    }

    restoreFlingDragToStorage(flier, side);
    clearDragUiState();
    renderBench(side);
    recalcSynergies();
    updateUI();
  } finally {
    prepScreenFlingSuppress = false;
    dragFrom = null;
    dragPayload = null;
    if (typeof scheduleCanvasFit === "function") scheduleCanvasFit();
  }
}

if (typeof window !== "undefined") {
  window.resolvePrepScreenFlingLanding = resolvePrepScreenFlingLanding;
}

function getDropPointerClient(e) {
  if (isTouchUi() && (dragPayload || pendingShopDrag || pendingBenchDrag)) {
    return { x: lastPointerClient.x, y: lastPointerClient.y };
  }
  return { x: e.clientX, y: e.clientY };
}

function createDropPointerEvent(e) {
  const { x, y } = getDropPointerClient(e);
  return createSyntheticPointerEvent(x, y);
}

function bindPrepLoadoutDragPointer() {
  if (bindPrepLoadoutDragPointer._done) return;
  bindPrepLoadoutDragPointer._done = true;

  const isActiveDrag = () => !!(dragPayload || pendingShopDrag || pendingBenchDrag);

  const onMove = (e) => {
    if (!isLoadoutInteractionPhase() || !isActiveDrag()) return;
    if (e.cancelable) e.preventDefault();
    updatePointerFromClient(e.clientX, e.clientY);
  };

  const onDocMove = (e) => {
    if (!pendingShopDrag && !pendingBenchDrag) return;
    if (!isLoadoutInteractionPhase()) return;
    updatePointerFromClient(e.clientX, e.clientY);
  };

  const onUp = (e) => {
    if (!isLoadoutInteractionPhase() || !isActiveDrag()) return;
    if (e.button != null && e.button !== 0) return;
    if (tryBuyFromPendingShopDrag(e.clientX, e.clientY)) return;
    finishDragDrop(e);
  };

  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp, { passive: false });
  window.addEventListener("pointercancel", onUp, { passive: false });
  document.addEventListener("mousemove", onDocMove, { passive: false });
}

function sellDraggedItem(side = prepViewSide) {
  if (!dragFrom || !dragPayload) return false;
  if (dragFrom.type === "shop") return false;

  if (dragFrom.type === "bench") {
    if (dragFrom.benchEntry) {
      creditItemSale(dragFrom.benchEntry.itemId, side);
      (dragFrom.benchEntry.carriedItems || []).forEach((ci) => creditItemSale(ci.itemId, side));
      commitBenchDragEntry(dragFrom);
      return true;
    }
    return sellBenchEntry(dragFrom.index, side);
  }
  if (dragFrom.type === "item") {
    creditItemSale(dragFrom.item.itemId, side);
    return true;
  }
  if (dragFrom.type === "container") {
    creditItemSale(dragFrom.container.itemId, side);
    (dragFrom.carriedItems || []).forEach((ci) => creditItemSale(ci.itemId, side));
    return true;
  }
  return false;
}

function sellDraggedItemQuick(side = prepViewSide) {
  if (!sellDraggedItem(side)) return false;
  if (typeof markPrepLoadoutMutationChange === "function") {
    markPrepLoadoutMutationChange({
      itemId: dragFrom?.item?.itemId
        || dragFrom?.benchEntry?.itemId
        || dragFrom?.container?.itemId
        || null,
      cause: "sell",
    });
  }
  clearDragUiState();
  renderBench();
  recalcSynergies();
  updateUI();
  return true;
}

function dropDraggedItemToBench() {
  if (!dragPayload) return;
  const benchPanel = document.getElementById("bench-panel");
  if (!benchPanel) return;
  const r = benchPanel.getBoundingClientRect();
  finishDragDrop(createSyntheticPointerEvent(r.left + r.width / 2, r.top + r.height / 2));
}

function takeBenchEntryOnDragStart(st, index) {
  const entry = st.bench[index];
  if (!entry) return null;
  if (typeof PrepStoragePhysics !== "undefined"
    && typeof shouldUsePrepStoragePhysics === "function"
    && shouldUsePrepStoragePhysics()) {
    PrepStoragePhysics.onDragStart(entry);
  }
  st.bench.splice(index, 1);
  if (selectedBench === index) selectedBench = -1;
  else if (selectedBench > index) selectedBench -= 1;
  return { ...entry };
}

function restoreBenchDragEntry(st, dragFrom) {
  if (dragFrom?.type !== "bench" || !dragFrom.benchEntry) return;
  if (typeof canFitOnBench === "function" ? !canFitOnBench(st, 1) : st.bench.length >= MAX_BENCH) return;
  if (typeof PrepStoragePhysics !== "undefined"
    && typeof shouldUsePrepStoragePhysics === "function"
    && shouldUsePrepStoragePhysics()) {
    PrepStoragePhysics.onDragCancel(dragFrom.benchEntry);
  }
  const idx = Math.min(Math.max(0, dragFrom.index ?? st.bench.length), st.bench.length);
  st.bench.splice(idx, 0, dragFrom.benchEntry);
  dragFrom.benchEntry = null;
}

function commitBenchDragEntry(dragFrom) {
  if (dragFrom?.type !== "bench") return;
  const uid = dragFrom.benchEntry?.uid;
  dragFrom.benchEntry = null;
  if (uid && typeof PrepStoragePhysics !== "undefined" && PrepStoragePhysics.releaseDragHold) {
    PrepStoragePhysics.releaseDragHold(uid);
  }
}

function canPrepSellDragHighlight() {
  return !!(phase === "prep" && dragPayload && dragFrom?.type !== "shop");
}

function syncSellDropHighlight(clientX, clientY) {
  const sellable = canPrepSellDragHighlight();
  document.documentElement.toggleAttribute("data-prep-sell-drag", sellable);

  const synthetic = sellable && clientX != null && clientY != null
    ? createSyntheticPointerEvent(clientX, clientY)
    : null;
  const onSell = !!(sellable && synthetic && isDropOnSell(synthetic));

  const sellZone = document.getElementById("shop-sell-zone");
  if (sellZone && !isPrepSellFabActive()) {
    sellZone.classList.toggle("sell-drop-target", onSell);
    sellZone.classList.toggle("is-drag-active", sellable);
  } else if (sellZone) {
    sellZone.classList.remove("sell-drop-target", "is-drag-active");
  }

  document.querySelectorAll(".sell-drop-zone").forEach((el) => {
    el.classList.toggle("is-drag-active", sellable);
    el.classList.toggle("is-drag-target", onSell);
  });
}

function clearSellDropHighlight() {
  document.documentElement.removeAttribute("data-prep-sell-drag");
  document.getElementById("shop-sell-zone")?.classList.remove("sell-drop-target", "is-drag-active");
  document.querySelectorAll(".sell-drop-zone").forEach((el) => {
    el.classList.remove("is-drag-target", "is-drag-active");
  });
}

function syncPrepBenchPopoverPassthrough() {
  const benchUi = typeof usesPrepBenchPopover === "function" && usesPrepBenchPopover();
  const shopUi = typeof window.usesPrepShopPopover === "function" && window.usesPrepShopPopover();
  const benchOpen = typeof isPrepBenchPopoverOpen === "function" && isPrepBenchPopoverOpen();
  const shopOpen = typeof window.isPrepShopPopoverOpen === "function" && window.isPrepShopPopoverOpen();
  const dragging = !!(dragPayload || pendingShopDrag || pendingBenchDrag);
  document.documentElement.toggleAttribute("data-prep-bench-drag", !!(benchUi && benchOpen && dragging));
  document.documentElement.toggleAttribute("data-prep-shop-drag", !!(shopUi && shopOpen && dragging));
}

function syncUiDragState() {
  const dragging = !!(dragPayload || pendingShopDrag || pendingBenchDrag);
  document.body.classList.toggle("is-ui-dragging", dragging);
  if (dragging) {
    tooltipItem = null;
    hideSidebarTooltip();
  } else {
    window.flushDeferredLayoutPasses?.();
  }
  syncPrepBenchPopoverPassthrough();
  syncPrepShopDragBackdrop(lastPointerClient.x, lastPointerClient.y);
  syncSellDropHighlight(lastPointerClient.x, lastPointerClient.y);
  if (typeof syncCraftPreviewFromDrag === "function") syncCraftPreviewFromDrag();
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}

function notifyPrepDragRejectedFromDragFrom() {
  if (dragFrom?.type === "item" && dragFrom.item) {
    notifyPrepPlacementRejected(dragFrom.item);
  }
}

function isPrepBackpackArcDrag() {
  return dragFrom?.type === "item" || dragFrom?.type === "container";
}

function isPrepLoadoutItemDrag() {
  return dragFrom?.type === "item";
}

function isPrepArcDragSource() {
  if (!dragFrom) return false;
  return dragFrom.type === "shop"
    || dragFrom.type === "bench"
    || dragFrom.type === "item"
    || dragFrom.type === "container";
}

function resolveContainerPlacementAtCursor(st, cursorCol, cursorRow, preferredRot = null, exactOnly = false) {
  if (!dragPayload || !isContainerItem(dragPayload.itemId)) return null;
  const excludeUid = dragFrom?.type === "container" ? dragFrom.container?.uid : null;
  const other = findContainerAtCell(st.containers, cursorCol, cursorRow);
  if (other && other.uid !== excludeUid) return null;

  const itemId = dragPayload.itemId;
  const startRot = preferredRot != null
    ? ((preferredRot % 4) + 4) % 4
    : ((dragPayload.rotation || 0) % 4 + 4) % 4;
  const rotations = exactOnly
    ? [startRot]
    : (() => {
      const order = [startRot];
      for (let r = 0; r < 4; r++) if (r !== startRot) order.push(r);
      return order;
    })();

  for (const rot of rotations) {
    const shape = rotateShape(ITEM_CATALOG[itemId].shape, rot);
    for (const [dx, dy] of shape) {
      const anchorCol = cursorCol - dx;
      const anchorRow = cursorRow - dy;
      const ok = dragFrom?.type === "container"
        ? canMoveContainerWithItems(
          dragFrom.container,
          anchorCol,
          anchorRow,
          st.containers,
          st.items,
          excludeUid,
          getActiveGridCols(),
          getActiveGridRows(),
        )
        : canPlaceContainer(
          itemId,
          anchorCol,
          anchorRow,
          rot,
          getActiveGridCols(),
          getActiveGridRows(),
          st.containers,
          excludeUid,
          st.items,
        );
      if (ok) return { col: anchorCol, row: anchorRow, rotation: rot };
    }
  }
  return null;
}

function isPrepArcPlaceableCell(col, row) {
  if (!isLoadoutInteractionPhase() || !dragPayload) return false;
  const side = dragFrom?.side || prepViewSide;
  if (!canEditPrepSide(side)) return false;
  const st = getLoadoutEditState(side);

  if (isContainerItem(dragPayload.itemId)) {
    return !!resolveContainerPlacementAtCursor(st, col, row);
  }

  if (!isSlotCell(st.containers, col, row)) return false;
  const excludeUid = isPrepLoadoutItemDrag() ? dragFrom.item?.uid : null;
  const placement = resolveLoadoutPlacementDisplacing(
    st.containers,
    dragPayload.itemId,
    col,
    row,
    dragPayload.rotation || 0,
  );
  if (!placement.valid) return false;
  const displaced = getOverlappingLoadoutItems(
    st.items,
    dragPayload.itemId,
    placement.col,
    placement.row,
    placement.rotation,
    excludeUid,
  );
  const displacedUids = displaced.map((item) => item.uid);
  const slotOk = typeof canAddSlotItemToLoadout !== "function"
    || canAddSlotItemToLoadout(st.items, dragPayload.itemId, excludeUid, displacedUids);
  const benchOk = typeof canFitOnBench === "function"
    ? canFitOnBench(st, displaced.length)
    : st.bench.length + displaced.length <= MAX_BENCH;
  return slotOk && benchOk;
}

function uiCm(cm) {
  return uiPx(cm * (96 / 2.54));
}

function getPrepDragGhostOffsetY() {
  const want = uiCm(2);
  const stride = typeof gridStrideFor === "function" ? gridStrideFor(prepViewSide) : uiPx(48);
  // 2 см на desktop; на телефоне не больше ~40% клетки — иначе призрак улетает в магазин.
  return Math.min(want, Math.max(uiPx(18), stride * 0.42));
}

function isClientPointInsideCanvas(clientX, clientY) {
  if (!canvas || clientX == null || clientY == null) return false;
  const rect = canvas.getBoundingClientRect();
  const right = rect.right ?? rect.left + rect.width;
  const bottom = rect.bottom ?? rect.top + rect.height;
  if (right <= rect.left || bottom <= rect.top) return false;
  return clientX >= rect.left && clientX <= right
    && clientY >= rect.top && clientY <= bottom;
}

function getPrepDragGhostClientPos(clientX, clientY) {
  const offsetY = getPrepDragGhostOffsetY();
  let x = clientX;
  let y = clientY - offsetY;
  if (canvas && clientX != null && clientY != null) {
    const rect = canvas.getBoundingClientRect();
    const pad = 2;
    const fingerOnCanvas = clientY >= rect.top && clientY <= rect.bottom
      && clientX >= rect.left && clientX <= rect.right;
    if (fingerOnCanvas) {
      y = Math.max(rect.top + pad, Math.min(rect.bottom - pad, y));
      x = Math.max(rect.left + pad, Math.min(rect.right - pad, x));
    }
  }
  return { x, y, rotation: 0 };
}

function isClientPointInsidePrepBackpack(clientX, clientY, side = prepViewSide) {
  const rect = getPrepBackpackClientRect();
  if (!rect) return isClientPointInsideCanvas(clientX, clientY);
  return clientX >= rect.left && clientX <= rect.right
    && clientY >= rect.top && clientY <= rect.bottom;
}

/** Клетка под точкой призрака. BB rotate: client-space + центры клеток; иначе inverse canvas. */
function findPrepBoardHoverCellFromClient(clientX, clientY, side = prepViewSide) {
  if (clientX == null || clientY == null) return null;
  if (isPointerOverPrepSidebar(clientX, clientY)) return null;

  const rotated = typeof shouldUseBBPrepDrawRotate === "function" && shouldUseBBPrepDrawRotate();

  if (rotated) {
    if (!isClientPointInsidePrepBackpack(clientX, clientY, side)) return null;
    const stride = typeof gridStrideFor === "function" ? gridStrideFor(side) : uiPx(48);
    const maxDist = stride * 0.72;
    const cols = getActiveGridCols();
    const rows = getActiveGridRows();
    let bestCol = null;
    let bestRow = null;
    let bestDist = Infinity;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const center = boardCellClientCenter(col, row, side);
        if (!center) continue;
        const dist = Math.hypot(center.x - clientX, center.y - clientY);
        if (dist < bestDist) {
          bestDist = dist;
          bestCol = col;
          bestRow = row;
        }
      }
    }

    if (bestCol == null || bestDist > maxDist) return null;
    return { col: bestCol, row: bestRow };
  }

  if (!isClientPointInsideCanvas(clientX, clientY)) return null;

  const { x: mx, y: my } = canvasCoordsFromClient(clientX, clientY);
  if (!isOnBoard(mx, my, side)) return null;

  const col = xToCol(mx, side);
  const row = yToRow(my, side);
  const cols = getActiveGridCols();
  const rows = getActiveGridRows();
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
  return { col, row };
}

function findPrepBoardHoverCellFromGhostClient(ghostClientX, ghostClientY, side = prepViewSide) {
  return findPrepBoardHoverCellFromClient(ghostClientX, ghostClientY, side);
}

function applyPrepBoardHoverFromCell(col, row, side, st) {
  if (col == null || row == null) return false;
  prepDropPreviewHover = { col, row };
  if (isContainerItem(dragPayload.itemId)) {
    hoverCell = { col, row };
    hoverSlot = null;
    return true;
  }
  if (isSlotCell(st.containers, col, row)) {
    hoverSlot = { col, row };
    hoverCell = null;
    return true;
  }
  const placement = resolveLoadoutPlacementDisplacing(
    st.containers,
    dragPayload.itemId,
    col,
    row,
    dragPayload.rotation || 0,
  );
  if (placement.valid) {
    hoverSlot = { col, row };
    hoverCell = null;
    return true;
  }
  hoverCell = { col, row };
  hoverSlot = null;
  return true;
}

function isPrepDragGhostOverBoard(clientX, clientY) {
  const ghost = getPrepDragGhostClientPos(clientX, clientY);
  return !!findPrepBoardHoverCellFromGhostClient(ghost.x, ghost.y, dragFrom?.side || prepViewSide);
}

function getPrepDragBoardHoverCell() {
  const col = prepDropPreviewHover?.col ?? hoverSlot?.col ?? hoverCell?.col;
  const row = prepDropPreviewHover?.row ?? hoverSlot?.row ?? hoverCell?.row;
  if (col == null || row == null) return null;
  return { col, row };
}

/** Визуальная тень — строго под призраком (клетка под иконкой), без «лучшего» invalid-snap. */
function getPrepDragShadowPlacement(st, side = prepViewSide) {
  if (!dragPayload || !isLoadoutInteractionPhase()) return null;
  const ghost = getPrepDragGhostClientPos(lastPointerClient.x, lastPointerClient.y);
  const hover = findPrepBoardHoverCellFromGhostClient(ghost.x, ghost.y, side);
  if (!hover) return null;

  const logical = getPrepDropPlacement(st, side);
  const rot = logical?.rotation ?? (((dragPayload.rotation || 0) % 4 + 4) % 4);

  if (isContainerItem(dragPayload.itemId)) {
    if (logical) return logical;
    return {
      kind: "container",
      col: hover.col,
      row: hover.row,
      rotation: rot,
      valid: false,
      displaced: [],
    };
  }

  if (logical?.valid) {
    return logical;
  }

  const invalid = buildInvalidItemDropPreview(dragPayload.itemId, hover.col, hover.row, rot);
  if (invalid) {
    return { ...invalid, displaced: logical?.displaced || [] };
  }

  return {
    kind: "item",
    col: hover.col,
    row: hover.row,
    rotation: rot,
    valid: false,
    displaced: [],
  };
}

/** Hit-test и drop — всегда по позиции призрака, не пальца. */
function resolvePrepDragHoverClient(clientX, clientY) {
  return getPrepDragGhostClientPos(clientX, clientY);
}

function shouldShowPrepDragBoardShadow(clientX = lastPointerClient.x, clientY = lastPointerClient.y) {
  if (!dragPayload || !isLoadoutInteractionPhase()) return false;
  const ghost = getPrepDragGhostClientPos(clientX, clientY);
  return !!findPrepBoardHoverCellFromGhostClient(ghost.x, ghost.y, dragFrom?.side || prepViewSide);
}

function maybePrepDragHoverSound(col, row) {
  const key = col != null && row != null ? `${col},${row}` : null;
  if (key === lastPrepDragHoverCellKey) return;
  lastPrepDragHoverCellKey = key;
  if (key && isPrepArcPlaceableCell(col, row) && typeof playGameSfx === "function") {
    playGameSfx("arc_hover");
  }
}

/** @deprecated alias */
function maybePrepArcHoverSound(col, row) {
  maybePrepDragHoverSound(col, row);
}

function applyPrepBoardHoverFromCanvasXY(mx, my, side, st) {
  if (!isOnBoard(mx, my, side)) return false;
  const col = xToCol(mx, side);
  const row = yToRow(my, side);
  prepDropPreviewHover = { col, row };
  if (isContainerItem(dragPayload.itemId)) {
    hoverCell = { col, row };
    hoverSlot = null;
    return true;
  }
  if (isSlotCell(st.containers, col, row)) {
    hoverSlot = { col, row };
    hoverCell = null;
    return true;
  }
  const placement = resolveLoadoutPlacementDisplacing(
    st.containers,
    dragPayload.itemId,
    col,
    row,
    dragPayload.rotation || 0,
  );
  if (placement.valid) {
    hoverSlot = { col, row };
    hoverCell = null;
    return true;
  }
  hoverCell = { col, row };
  hoverSlot = null;
  return true;
}

function prepCellCanvasCenter(col, row, team = prepViewSide) {
  const rect = cellRect(team, col, row);
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function findNearestPrepPlaceableHover(mx, my, side, st) {
  if (!dragPayload || !st) return null;
  const team = prepViewSide;
  let best = null;
  let bestDist = Infinity;

  const consider = (col, row) => {
    const maxCols = getActiveGridCols();
    const maxRows = getActiveGridRows();
    if (col < 0 || col >= maxCols || row < 0 || row >= maxRows) return;
    if (!isPrepArcPlaceableCell(col, row)) return;
    const center = prepCellCanvasCenter(col, row, team);
    const dist = Math.hypot(center.x - mx, center.y - my);
    if (dist < bestDist) {
      bestDist = dist;
      best = { col, row };
    }
  };

  if (isContainerItem(dragPayload.itemId)) {
    for (let row = 0; row < getActiveGridRows(); row += 1) {
      for (let col = 0; col < getActiveGridCols(); col += 1) {
        consider(col, row);
      }
    }
  } else {
    buildSlotSet(st.containers).forEach((key) => {
      const [col, row] = key.split(",").map(Number);
      consider(col, row);
    });
  }

  return best;
}

function findNearestPrepSlotHover(mx, my, side, st) {
  if (!dragPayload || !st) return null;
  const team = prepViewSide;
  let best = null;
  let bestDist = Infinity;

  const consider = (col, row) => {
    const maxCols = getActiveGridCols();
    const maxRows = getActiveGridRows();
    if (col < 0 || col >= maxCols || row < 0 || row >= maxRows) return;
    const center = prepCellCanvasCenter(col, row, team);
    const dist = Math.hypot(center.x - mx, center.y - my);
    if (dist < bestDist) {
      bestDist = dist;
      best = { col, row };
    }
  };

  if (isContainerItem(dragPayload.itemId)) {
    for (let row = 0; row < getActiveGridRows(); row += 1) {
      for (let col = 0; col < getActiveGridCols(); col += 1) {
        consider(col, row);
      }
    }
  } else {
    buildSlotSet(st.containers).forEach((key) => {
      const [col, row] = key.split(",").map(Number);
      consider(col, row);
    });
  }

  return best;
}

function applyPrepBoardHoverFromNearestPlaceable(mx, my, side, st) {
  const nearest = findNearestPrepPlaceableHover(mx, my, side, st);
  if (nearest) {
    const { col, row } = nearest;
    prepDropPreviewHover = { col, row };
    if (isContainerItem(dragPayload.itemId)) {
      hoverCell = { col, row };
      hoverSlot = null;
    } else {
      hoverSlot = { col, row };
      hoverCell = null;
    }
    return true;
  }

  const fallback = findNearestPrepSlotHover(mx, my, side, st);
  if (!fallback) return false;
  const center = prepCellCanvasCenter(fallback.col, fallback.row, prepViewSide);
  return applyPrepBoardHoverFromCanvasXY(center.x, center.y, side, st);
}

function isPrepSidebarArcDrag() {
  return dragFrom?.type === "shop"
    || dragFrom?.type === "bench";
}

function getPrepBackpackClientRect() {
  const team = prepViewSide;
  let ox;
  let oy;
  let innerW;
  let innerH;
  ox = gridOrigin(team);
  oy = layoutBackpackY();
  innerW = GRID_INNER_W;
  innerH = GRID_INNER_H;
  const tl = canvasPointToClient(ox, oy);
  const br = canvasPointToClient(ox + innerW, oy + innerH);
  if (!tl || !br) return null;
  return {
    left: Math.min(tl.x, br.x),
    top: Math.min(tl.y, br.y),
    right: Math.max(tl.x, br.x),
    bottom: Math.max(tl.y, br.y),
  };
}

function getShopDrawerRect(side = dragFrom?.side || prepViewSide) {
  const panel = document.getElementById("shop-panel");
  if (!panel) return null;
  if (typeof window.usesPrepShopPopover === "function" && window.usesPrepShopPopover()) {
    if (typeof window.isPrepShopPopoverOpen === "function" && !window.isPrepShopPopoverOpen()) {
      return null;
    }
  }
  const r = panel.getBoundingClientRect();
  if (!r || r.width < 1 || r.height < 1) return null;
  return r;
}

function usesPrepCommercePopoverMode() {
  return (typeof usesPrepBenchPopover === "function" && usesPrepBenchPopover())
    || (typeof window.usesPrepShopPopover === "function" && window.usesPrepShopPopover());
}

function isPointerInsideShopDrawerBounds(clientX, clientY, side = dragFrom?.side || prepViewSide) {
  if (clientX == null || clientY == null) return false;
  const r = getShopDrawerRect(side);
  if (!r) return false;
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
}

/** Отмена sidebar-drag: вернули предмет в зону источника (магазин / скамья). */
function getPrepSidebarDragCancelAt(clientX, clientY, side = dragFrom?.side || prepViewSide) {
  const ghost = getPrepDragGhostClientPos(clientX, clientY);
  const ghostOnBoard = !!findPrepBoardHoverCellFromGhostClient(ghost.x, ghost.y, side);
  const dropE = createSyntheticPointerEvent(clientX, clientY);
  return {
    shop: dragFrom?.type === "shop"
      && isPointerInsideShopDrawerBounds(clientX, clientY, side)
      && !ghostOnBoard,
    bench: dragFrom?.type === "bench" && isDropOnBench(dropE, { ignoreBoardTarget: true }),
  };
}

function clearPrepBoardDropHover() {
  prepDropPreviewHover = null;
  hoverCell = null;
  hoverSlot = null;
  maybePrepDragHoverSound(null, null);
}

/** Доля ширины клетки — порог перехода в соседнюю (Schmitt trigger, см. snapgrid / Fitts). */
const PREP_SIDEBAR_CELL_SWITCH_MARGIN = 0.28;

/**
 * Дискретный индекс оси с гистерезисом: палец должен явно пересечь границу клетки,
 * иначе тень остаётся на текущей — без «прыжков на километр» от микродвижений.
 */
function quantizePrepSidebarAxis(norm, count, stickyIndex) {
  const n = Math.max(0, Math.min(1, norm));
  if (count <= 1) return 0;
  if (stickyIndex == null || !Number.isFinite(stickyIndex)) {
    return Math.max(0, Math.min(count - 1, Math.round(n * (count - 1))));
  }
  let idx = Math.max(0, Math.min(count - 1, stickyIndex));
  const margin = PREP_SIDEBAR_CELL_SWITCH_MARGIN / count;
  const upperEdge = (idx + 1) / count;
  const lowerEdge = idx / count;
  if (idx < count - 1 && n >= upperEdge + margin) idx += 1;
  else if (idx > 0 && n <= lowerEdge - margin) idx -= 1;
  return idx;
}

/** Зона управления дугой: коридор между рюкзаком и магазином (как на UX-макете). */
/** Зона управления дугой: коридор между рюкзаком и магазином (как на UX-макете). */
function getPrepBenchCommerceRect() {
  if (typeof shouldUsePrepStoragePhysics === "function" && shouldUsePrepStoragePhysics()) {
    const r = typeof PrepStoragePhysics !== "undefined"
      ? (PrepStoragePhysics.getStorageBandRect?.() || PrepStoragePhysics.getArenaClientRect?.())
      : null;
    if (r && r.width > 0 && r.height > 0) return r;
    const body = document.getElementById("prep-storage-mount");
    const br = body?.getBoundingClientRect();
    if (br && br.width > 0 && br.height > 0) return br;
  }
  if (typeof usesPrepBenchPopover === "function" && usesPrepBenchPopover()) {
    const popover = document.getElementById("prep-bench-popover");
    if (popover && !popover.hidden && !popover.classList.contains("hidden")) {
      const panel = popover.querySelector(".prep-bench-popover__panel");
      const panelRect = panel?.getBoundingClientRect();
      if (panelRect && panelRect.width > 0 && panelRect.height > 0) return panelRect;
    }
    const fab = document.getElementById("btn-prep-bench-fab");
    const fabRect = fab && !fab.hidden ? fab.getBoundingClientRect() : null;
    if (fabRect && fabRect.width > 0 && fabRect.height > 0) return fabRect;
    return null;
  }
  const panel = document.getElementById("bench-panel");
  const rect = panel?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? rect : null;
}

/** Зона управления дугой: коридор между рюкзаком и магазином (как на UX-макете). */
function getPrepSidebarDragMapRect() {
  const backpack = getPrepBackpackClientRect();
  if (!backpack) return null;
  const shop = document.getElementById("shop-panel")?.getBoundingClientRect();
  const bench = getPrepBenchCommerceRect();

  const sidebarLeft = Math.min(
    shop?.left ?? Infinity,
    bench?.left ?? Infinity,
  );
  const corridorLeft = backpack.right + 4;
  const corridorRight = Number.isFinite(sidebarLeft)
    ? Math.max(corridorLeft + 8, sidebarLeft - 4)
    : Math.max(corridorLeft + 8, backpack.right + backpack.right - backpack.left);
  return {
    left: corridorLeft,
    top: backpack.top,
    right: corridorRight,
    bottom: backpack.bottom,
  };
}

/** Проецирует палец на рюкзак: абсолютное 1:1 по коридору (CD ratio ≈ 1). */
function projectClientPointToPrepBackpack(clientX, clientY) {
  if (!canvas || clientX == null || clientY == null) return null;
  const team = dragFrom?.side || prepViewSide;
  const coords = canvasCoordsFromClient(clientX, clientY);
  let ox;
  let oy;
  let gw;
  let gh;
  ox = gridOrigin(team);
  oy = layoutBackpackY();
  gw = GRID_INNER_W;
  gh = GRID_INNER_H;
  const inset = 0.5;

  if (coords.x >= ox + inset && coords.x <= ox + gw - inset
    && coords.y >= oy + inset && coords.y <= oy + gh - inset) {
    return coords;
  }

  const mapRect = getPrepSidebarDragMapRect();
  if (!mapRect) return null;

  const spanX = Math.max(1, mapRect.right - mapRect.left);
  const spanY = Math.max(1, mapRect.bottom - mapRect.top);
  const normX = Math.max(0, Math.min(1, (clientX - mapRect.left) / spanX));
  const normY = Math.max(0, Math.min(1, (clientY - mapRect.top) / spanY));

  return {
    x: ox + Math.max(inset, Math.min(gw - inset, normX * gw)),
    y: oy + Math.max(inset, Math.min(gh - inset, normY * gh)),
  };
}

function applyPrepSidebarCorridorHover(projected, side, st) {
  const team = prepViewSide;
  const gridW = getActiveGridCols();
  const gridH = getActiveGridRows();
  let ox;
  let oy;
  let innerW;
  let innerH;
  ox = gridOrigin(team);
  oy = layoutBackpackY();
  innerW = GRID_INNER_W;
  innerH = GRID_INNER_H;
  const normX = (projected.x - ox) / innerW;
  const normY = (projected.y - oy) / innerH;
  const col = quantizePrepSidebarAxis(normX, gridW, prepSidebarStickyHover?.col);
  const row = quantizePrepSidebarAxis(normY, gridH, prepSidebarStickyHover?.row);
  prepSidebarStickyHover = { col, row };
  const center = prepCellCanvasCenter(col, row, team);
  const directApplied = applyPrepBoardHoverFromCanvasXY(center.x, center.y, side, st);
  if (directApplied) {
    const slotOccupied = isSlotCell(st.containers, col, row)
      && !!findItemAtSlot(st.items, col, row);
    if (slotOccupied) {
      const placement = getPrepDropPlacement(st, side);
      if (placement && !placement.valid) return true;
    }
  }
  return applyPrepBoardHoverFromNearestPlaceable(center.x, center.y, side, st);
}

/** Точка тени на поле для зелёной дуги (магазин/скамья → ✊ → поле). */
function getPrepSidebarLinkTargetClient() {
  const anchor = getPrepPlacementAnchorClient();
  if (anchor) return anchor;
  const col = hoverSlot?.col ?? hoverCell?.col ?? prepDropPreviewHover?.col;
  const row = hoverSlot?.row ?? hoverCell?.row ?? prepDropPreviewHover?.row;
  if (col == null || row == null) return null;
  const target = boardCellClientCenter(col, row);
  return target;
}

function syncPrepSidebarBoardHover(clientX, clientY, side, st) {
  const pointer = createSyntheticPointerEvent(clientX, clientY);
  if (isDropOnBench(pointer) || isDropOnSell(pointer)) {
    prepDropPreviewHover = null;
    hoverCell = null;
    hoverSlot = null;
    if (typeof PrepDragArc !== "undefined" && PrepDragArc.isActive()) {
      PrepDragArc.syncHoverCell(null, null);
    }
    return false;
  }
  const cancelAt = getPrepSidebarDragCancelAt(clientX, clientY, side);
  const inShopBounds = isPointerInsideShopDrawerBounds(clientX, clientY);
  if (cancelAt.shop || cancelAt.bench) {
    clearPrepBoardDropHover();
    return false;
  }
  if (!prepSidebarDragUnlocked && inShopBounds) {
    clearPrepBoardDropHover();
    return false;
  }
  if (!prepSidebarDragUnlocked && !inShopBounds) {
    prepSidebarDragUnlocked = true;
    prepSidebarStickyHover = null;
  }

  let mx;
  let my;

  if (!isPointerOverPrepSidebar(clientX, clientY)) {
    const coords = canvasCoordsFromClient(clientX, clientY);
    if (isOnBoard(coords.x, coords.y, side)) {
      mx = coords.x;
      my = coords.y;
      prepSidebarStickyHover = null;
    }
  }

  if (mx == null) {
    const projected = projectClientPointToPrepBackpack(clientX, clientY);
    if (!projected) return false;
    return applyPrepSidebarCorridorHover(projected, side, st);
  }

  // Если проекция попала в занятую клетку и предмет сейчас не размещается,
  // показываем красную тень именно в этой точке (без автоснаппинга).
  const directApplied = applyPrepBoardHoverFromCanvasXY(mx, my, side, st);
  if (directApplied) {
    const col = xToCol(mx, side);
    const row = yToRow(my, side);
    const slotOccupied = isSlotCell(st.containers, col, row)
      && !!findItemAtSlot(st.items, col, row);
    if (slotOccupied) {
      const placement = getPrepDropPlacement(st, side);
      if (placement && !placement.valid) return true;
    }
  }

  return applyPrepBoardHoverFromNearestPlaceable(mx, my, side, st);
}

function getPrepGhostCanvasScale() {
  if (!canvas || canvas.width <= 0) return 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0) return 1;
  return rect.width / canvas.width;
}

function getPrepRemoteHoldGhostLayout(def, rotation) {
  const cell = layoutCell;
  const margin = CELL_TILE_PAD * 2;
  const emojiBox = Math.max(28, cell * 1.35);
  const logicalW = emojiBox + margin * 2;
  const logicalH = emojiBox + margin * 2;
  const scale = getPrepGhostCanvasScale();
  return {
    cell,
    emojiBox,
    logicalW,
    logicalH,
    clientW: logicalW * scale,
    clientH: logicalH * scale,
    scale,
  };
}

function drawPrepRemoteHoldGhost(targetCtx, def, itemId, rotation, layout) {
  const icon = getItemIcons(def)?.[0] || "📦";
  const cx = layout.logicalW / 2;
  const cy = layout.logicalH / 2;
  const rotDeg = (((rotation || 0) % 4) + 4) % 4 * 90;

  targetCtx.save();
  if (rotDeg) {
    targetCtx.translate(cx, cy);
    targetCtx.rotate(rotDeg * Math.PI / 180);
    targetCtx.translate(-cx, -cy);
  }
  targetCtx.font = `${Math.round(layout.emojiBox)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  targetCtx.textAlign = "center";
  targetCtx.textBaseline = "middle";
  targetCtx.shadowColor = "rgba(0,0,0,0.45)";
  targetCtx.shadowBlur = 9;
  targetCtx.fillText(icon, cx, cy);
  targetCtx.restore();
}

function getPrepPlacementAnchorClient() {
  if (!isLoadoutInteractionPhase() || !dragPayload || !canvas) return null;
  const side = dragFrom?.side || prepViewSide;
  if (!canEditPrepSide(side)) return null;
  const st = getLoadoutEditState(side);
  const placement = getPrepDropPlacement(st, side);
  if (!placement) return null;
  const team = prepViewSide;
  const def = ITEM_CATALOG[dragPayload.itemId];
  if (!def) return null;
  const shape = rotateShape(def.shape, placement.rotation || 0);
  if (!shape.length) return null;
  let sx = 0;
  let sy = 0;
  shape.forEach(([dx, dy]) => {
    const rect = cellRect(team, placement.col + dx, placement.row + dy);
    sx += rect.x + rect.w / 2;
    sy += rect.y + rect.h / 2;
  });
  return canvasPointToClient(sx / shape.length, sy / shape.length);
}

function isPointerOverPrepBackpack(clientX, clientY) {
  if (!canvas || !isLoadoutInteractionPhase() || clientX == null || clientY == null) return false;
  if (isPointerOverPrepSidebar(clientX, clientY)) return false;
  return !!findPrepBoardHoverCellFromGhostClient(clientX, clientY, prepViewSide);
}

function syncPrepDragBoardHover(clientX, clientY, ghostClientX, ghostClientY) {
  prepDropPreviewHover = null;
  if (!isLoadoutInteractionPhase() || !dragPayload) return;
  const side = dragFrom?.side || prepViewSide;
  if (!canEditPrepSide(side)) {
    hoverCell = null;
    hoverSlot = null;
    return;
  }
  const st = getLoadoutEditState(side);

  const pointer = createSyntheticPointerEvent(clientX, clientY);
  if (isDropOnBench(pointer) || isDropOnSell(pointer)) {
    hoverCell = null;
    hoverSlot = null;
    maybePrepDragHoverSound(null, null);
    return;
  }

  const cancelAt = getPrepSidebarDragCancelAt(clientX, clientY, side);
  if (cancelAt.shop || cancelAt.bench) {
    clearPrepBoardDropHover();
    return;
  }

  if (isPrepSidebarArcDrag() && !prepSidebarDragUnlocked) {
    const inShopBounds = isPointerInsideShopDrawerBounds(clientX, clientY);
    const inBenchBounds = dragFrom?.type === "bench"
      && isDropOnBench(pointer, { ignoreBoardTarget: true });
    const ghostPos = getPrepDragGhostClientPos(clientX, clientY);
    const ghostOnBoard = isPointerOverPrepBackpack(ghostPos.x, ghostPos.y);
    if ((inShopBounds || inBenchBounds) && !ghostOnBoard) {
      clearPrepBoardDropHover();
      return;
    }
    prepSidebarDragUnlocked = true;
    prepSidebarStickyHover = null;
  }

  const ghostPos = getPrepDragGhostClientPos(clientX, clientY);
  const hit = findPrepBoardHoverCellFromGhostClient(ghostPos.x, ghostPos.y, side);
  if (!hit) {
    hoverCell = null;
    hoverSlot = null;
    maybePrepDragHoverSound(null, null);
    return;
  }

  if (applyPrepBoardHoverFromCell(hit.col, hit.row, side, st)) {
    maybePrepDragHoverSound(hoverSlot?.col ?? hoverCell?.col, hoverSlot?.row ?? hoverCell?.row);
    return;
  }

  hoverCell = null;
  hoverSlot = null;
  maybePrepDragHoverSound(null, null);
}

/** @deprecated use syncPrepDragBoardHover */
function syncPrepDropPreviewHover(clientX, clientY, ghostClientX, ghostClientY) {
  syncPrepDragBoardHover(clientX, clientY, ghostClientX, ghostClientY);
}

function getPrepDropPlacement(st, side = prepViewSide, rotationOverride = null) {
  if (!dragPayload || !isLoadoutInteractionPhase()) return null;
  const activeRot = rotationOverride != null ? rotationOverride : (dragPayload.rotation || 0);
  const gridW = getActiveGridCols();
  const gridH = getActiveGridRows();
  const col = hoverSlot?.col ?? hoverCell?.col ?? prepDropPreviewHover?.col;
  const row = hoverSlot?.row ?? hoverCell?.row ?? prepDropPreviewHover?.row;
  if (col == null || row == null) return null;

  const excludeUid = dragFrom?.type === "container"
    ? dragFrom.container?.uid
    : (dragFrom?.type === "item" ? dragFrom.item?.uid : null);

  if (isContainerItem(dragPayload.itemId)) {
    const exactOnly = rotationOverride != null;
    const resolved = resolveContainerPlacementAtCursor(st, col, row, activeRot, exactOnly);
    if (!resolved) {
      if (hoverCell) {
        return {
          kind: "container",
          col: hoverCell.col,
          row: hoverCell.row,
          rotation: activeRot,
          valid: false,
          displaced: [],
        };
      }
      return null;
    }
    const valid = dragFrom?.type === "container"
      ? canMoveContainerWithItems(
        dragFrom.container,
        resolved.col,
        resolved.row,
        st.containers,
        st.items,
        excludeUid,
        gridW,
        gridH,
      )
      : canPlaceContainer(
        dragPayload.itemId,
        resolved.col,
        resolved.row,
        resolved.rotation,
        gridW,
        gridH,
        st.containers,
        excludeUid,
        st.items,
      );
    return {
      kind: "container",
      col: resolved.col,
      row: resolved.row,
      rotation: resolved.rotation,
      valid,
      displaced: [],
    };
  }

  const placement = resolveLoadoutPlacementDisplacing(
    st.containers,
    dragPayload.itemId,
    col,
    row,
    activeRot,
  );
  if (!placement.valid) {
    return buildInvalidItemDropPreview(dragPayload.itemId, col, row, activeRot);
  }
  const displaced = getOverlappingLoadoutItems(
    st.items,
    dragPayload.itemId,
    placement.col,
    placement.row,
    placement.rotation,
    excludeUid,
  );
  const displacedUids = displaced.map((item) => item.uid);
  const slotOk = typeof canAddSlotItemToLoadout !== "function"
    || canAddSlotItemToLoadout(st.items, dragPayload.itemId, excludeUid, displacedUids);
  const benchOk = typeof canFitOnBench === "function"
    ? canFitOnBench(st, displaced.length)
    : st.bench.length + displaced.length <= MAX_BENCH;
  return {
    kind: "item",
    col: placement.col,
    row: placement.row,
    rotation: placement.rotation,
    valid: slotOk && benchOk,
    displaced,
  };
}

function buildInvalidItemDropPreview(itemId, hoverCol, hoverRow, rotation) {
  const def = ITEM_CATALOG[itemId];
  if (!def || def.isContainer) return null;
  const rot = ((rotation || 0) % 4 + 4) % 4;
  return {
    kind: "item",
    col: hoverCol,
    row: hoverRow,
    rotation: rot,
    valid: false,
    displaced: [],
  };
}

function getPrepArcSidebarAnchorClient(clientX, clientY) {
  const pointer = createSyntheticPointerEvent(clientX, clientY);
  if (isDropOnBench(pointer)) {
    const benchEl = document.getElementById("bench-slots") || document.getElementById("bench-panel");
    const benchCenter = getElementClientCenter(benchEl);
    if (benchCenter) return benchCenter;
  }
  if (isDropOnSell(pointer)) {
    const sellCenter = getElementClientCenter(getPrepSellDropElement());
    if (sellCenter) return sellCenter;
  }
  return null;
}

function getPrepArcDropState() {
  if (!isLoadoutInteractionPhase() || !dragPayload) return "neutral";
  const side = dragFrom?.side || prepViewSide;
  const st = getLoadoutEditState(side);

  if (isPrepSidebarArcDrag()) {
    const pointer = createSyntheticPointerEvent(lastPointerClient.x, lastPointerClient.y);
    const cancelAt = getPrepSidebarDragCancelAt(lastPointerClient.x, lastPointerClient.y, side);
    if (cancelAt.shop || cancelAt.bench) return "neutral";
    if (isDropOnBench(pointer)) {
      return typeof canFitOnBench === "function"
        ? (canFitOnBench(st, 1) ? "valid" : "invalid")
        : (st.bench.length < MAX_BENCH ? "valid" : "invalid");
    }
    if (isDropOnSell(pointer)) {
      return "valid";
    }
    const placement = getPrepDropPlacement(st, side);
    if (!placement) return "neutral";
    return placement.valid ? "valid" : "invalid";
  }

  if (isPrepBackpackArcDrag()) {
    const pointer = createSyntheticPointerEvent(lastPointerClient.x, lastPointerClient.y);
    if (isDropOnBench(pointer)) {
      return typeof canFitOnBench === "function"
        ? (canFitOnBench(st, 1) ? "valid" : "invalid")
        : (st.bench.length < MAX_BENCH ? "valid" : "invalid");
    }
    if (isDropOnSell(pointer)) {
      return "valid";
    }
    return "neutral";
  }

  if (!isOnBoard(mousePos.x, mousePos.y, side)) return "neutral";

  if (isContainerItem(dragPayload.itemId) && hoverCell) {
    const excludeUid = dragFrom?.type === "container" ? dragFrom.container?.uid : null;
    const valid = dragFrom?.type === "container"
      ? canMoveContainerWithItems(
        dragFrom.container,
        hoverCell.col,
        hoverCell.row,
        st.containers,
        st.items,
        excludeUid,
        getActiveGridCols(),
        getActiveGridRows(),
      )
      : canPlaceContainer(
        dragPayload.itemId,
        hoverCell.col,
        hoverCell.row,
        dragPayload.rotation || 0,
        getActiveGridCols(),
        getActiveGridRows(),
        st.containers,
        excludeUid,
        st.items,
      );
    return valid ? "valid" : "invalid";
  }

  if (!isContainerItem(dragPayload.itemId) && hoverSlot) {
    const excludeUid = isPrepLoadoutItemDrag() ? dragFrom.item?.uid : null;
    const placement = resolveLoadoutPlacementDisplacing(
      st.containers,
      dragPayload.itemId,
      hoverSlot.col,
      hoverSlot.row,
      dragPayload.rotation || 0,
    );
    if (!placement.valid) return "invalid";
    const displaced = getOverlappingLoadoutItems(
      st.items,
      dragPayload.itemId,
      placement.col,
      placement.row,
      placement.rotation,
      excludeUid,
    );
    const displacedUids = displaced.map((item) => item.uid);
    const slotOk = typeof canAddSlotItemToLoadout !== "function"
      || canAddSlotItemToLoadout(st.items, dragPayload.itemId, excludeUid, displacedUids);
    const benchOk = typeof canFitOnBench === "function"
    ? canFitOnBench(st, displaced.length)
    : st.bench.length + displaced.length <= MAX_BENCH;
    return placement.valid && benchOk && slotOk ? "valid" : "invalid";
  }

  return "neutral";
}

function maybeCelebratePrepArcDrop(success) {
  if (!success || !isPrepArcDragSource()) return false;
  if (typeof PrepDragArc !== "undefined" && PrepDragArc.celebrate) {
    PrepDragArc.celebrate(lastPointerClient.x, lastPointerClient.y);
    return true;
  }
  if (typeof playGameSfx === "function") playGameSfx("arc_celebrate");
  return true;
}

function hasPrepBoardDropTarget() {
  return !!(hoverSlot || hoverCell || prepDropPreviewHover);
}

function clearDragUiState() {
  document.querySelectorAll(".shop-card.shop-dragging").forEach((el) => el.classList.remove("shop-dragging"));
  pendingShopDrag = null;
  pendingBenchDrag = null;
  pendingCanvasPick = null;
  shopDidDrag = false;
  syncPrepBenchPopoverPassthrough();
  endSynergyPreview();
  synergyPreviewBuilt = null;
  canvas?.classList.remove("synergy-preview-mode");
  document.getElementById("bench-panel")?.classList.remove("bench-drop-target");
  document.getElementById("btn-prep-bench-fab")?.classList.remove("bench-drop-target");
  clearSellDropHighlight();
  dragPayload = null;
  dragFrom = null;
  resetPrepDragPointerVelocity();
  prepSidebarDragUnlocked = false;
  prepSidebarStickyHover = null;
  prepDropPreviewHover = null;
  lastPrepDragHoverCellKey = null;
  clearGamepadBoardFocus();
  if (typeof onPrepDragEnd === "function") onPrepDragEnd();
  if (typeof PrepDragArc !== "undefined" && !PrepDragArc.isCelebrating?.()) {
    PrepDragArc.end();
  }
  if (typeof BBCraftTether !== "undefined") {
    BBCraftTether.end();
  }
  hideDragGhostOverlay();
  cancelPrepDragGhostRaf();
  if (typeof clearCraftPartnerBenchDom === "function") clearCraftPartnerBenchDom();
  syncUiDragState();
  if (typeof window.resetPrepTouchGesture === "function") window.resetPrepTouchGesture();
}

function createSyntheticPointerEvent(clientX, clientY) {
  return {
    clientX,
    clientY,
    target: canvas,
    preventDefault() {},
    button: 0,
  };
}

function getDragGhostCanvas() {
  if (!dragGhostCanvas) {
    dragGhostCanvas = document.getElementById("ui-drag-ghost");
    dragGhostCtx = dragGhostCanvas?.getContext("2d") || null;
  }
  return dragGhostCanvas;
}

function hideDragGhostOverlay() {
  getDragGhostCanvas()?.classList.add("hidden");
}

/** Призрак drag: центр якорной клетки превью, не середина всей фигуры. */
function getDragGhostAnchorClient(clientX, clientY) {
  if (!isLoadoutInteractionPhase() || !dragPayload || !canvas) {
    return { x: clientX, y: clientY };
  }

  const side = dragFrom?.side || prepViewSide;
  if (!canEditPrepSide(side)) return { x: clientX, y: clientY };

  if (isPrepBackpackArcDrag()) {
    const sidebarAnchor = getPrepArcSidebarAnchorClient(clientX, clientY);
    if (sidebarAnchor) return sidebarAnchor;
    return { x: clientX, y: clientY };
  }

  const team = prepViewSide;

  if (isContainerItem(dragPayload.itemId) && hoverCell) {
    return boardCellClientCenter(hoverCell.col, hoverCell.row, team);
  }

  if (!isContainerItem(dragPayload.itemId) && hoverSlot) {
    const st = getLoadoutEditState(side);
    const placement = resolveLoadoutPlacementDisplacing(
      st.containers,
      dragPayload.itemId,
      hoverSlot.col,
      hoverSlot.row,
      dragPayload.rotation || 0,
    );
    if (placement.valid) {
      return boardCellClientCenter(placement.col, placement.row, team);
    }
    return boardCellClientCenter(hoverSlot.col, hoverSlot.row, team);
  }

  return { x: clientX, y: clientY };
}

function syncDragGhostOverlay(clientX, clientY) {
  if (!dragPayload) {
    hideDragGhostOverlay();
    return;
  }
  const el = getDragGhostCanvas();
  if (!el || !dragGhostCtx) return;

  const sidebarDrag = isPrepSidebarArcDrag();
  const anchor = getDragGhostAnchorClient(clientX, clientY);
  let ghostX = anchor.x;
  let ghostY = anchor.y;
  let arcRotation = null;

  if (isLoadoutInteractionPhase()
    && isPrepArcDragSource()
    && typeof PrepDragArc !== "undefined"
    && PrepDragArc.isActive()) {
    PrepDragArc.mountGhostToBody();
    if (sidebarDrag) {
      ghostX = clientX;
      ghostY = clientY;
      arcRotation = null;
      const outsideShopArea = !isPointerInsideShopDrawerBounds(clientX, clientY);
      let linkTarget = null;
      if (outsideShopArea) {
        linkTarget = getPrepSidebarLinkTargetClient();
      }
      PrepDragArc.sync(clientX, clientY, clientX, clientY, {
        linkPoint: linkTarget,
        grabAtPointer: true,
        remoteHold: true,
        dropState: getPrepArcDropState(),
        itemId: dragPayload.itemId,
      });
      el.classList.add("ui-drag-ghost--arc-flight", "ui-drag-ghost--remote-hold");
      el.classList.remove("hidden");
    } else {
      const arcPos = PrepDragArc.resolveGhostPosition(clientX, clientY, anchor.x, anchor.y);
      ghostX = arcPos.x;
      ghostY = arcPos.y;
      arcRotation = arcPos.rotation;
      PrepDragArc.sync(clientX, clientY, anchor.x, anchor.y, {
        dropState: getPrepArcDropState(),
        itemId: dragPayload.itemId,
        linkPoint: null,
        grabAtPointer: false,
        remoteHold: false,
      });
      el.classList.add("ui-drag-ghost--arc-flight");
      el.classList.remove("ui-drag-ghost--remote-hold");
    }
  } else {
    el.classList.remove("ui-drag-ghost--arc-flight", "ui-drag-ghost--remote-hold");
    if (isLoadoutInteractionPhase() && hoverSlot && !isPrepSidebarArcDrag()) {
      ghostX = anchor.x;
      ghostY = anchor.y;
    } else {
      const ghostPos = getPrepDragGhostClientPos(clientX, clientY);
      ghostX = ghostPos.x;
      ghostY = ghostPos.y;
    }
  }

  el.classList.remove("hidden");
  el.style.left = `${ghostX}px`;
  el.style.top = `${ghostY}px`;

  const def = ITEM_CATALOG[dragPayload.itemId];
  if (!def) return;

  const ghostDrawRotation = typeof getPrepGhostDrawRotation === "function"
    ? getPrepGhostDrawRotation()
    : (dragPayload.rotation || 0);

  const remoteHoldGhost = sidebarDrag
    && isLoadoutInteractionPhase()
    && typeof PrepDragArc !== "undefined"
    && PrepDragArc.isActive();
  const ghostLayout = remoteHoldGhost
    ? getPrepRemoteHoldGhostLayout(def, ghostDrawRotation)
    : null;
  const dpr = window.devicePixelRatio || 1;
  let sizeW;
  let sizeH;
  if (ghostLayout) {
    sizeW = Math.ceil(ghostLayout.clientW);
    sizeH = Math.ceil(ghostLayout.clientH);
  } else {
    sizeW = DRAG_GHOST_CANVAS_SIZE;
    sizeH = DRAG_GHOST_CANVAS_SIZE;
  }
  if (el.width !== Math.ceil(sizeW * dpr) || el.height !== Math.ceil(sizeH * dpr)) {
    el.width = Math.ceil(sizeW * dpr);
    el.height = Math.ceil(sizeH * dpr);
    el.style.width = `${sizeW}px`;
    el.style.height = `${sizeH}px`;
  }

  dragGhostCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dragGhostCtx.clearRect(0, 0, sizeW, sizeH);

  if (ghostLayout) {
    dragGhostCtx.scale(ghostLayout.scale, ghostLayout.scale);
    drawPrepRemoteHoldGhost(
      dragGhostCtx,
      def,
      dragPayload.itemId,
      ghostDrawRotation,
      ghostLayout,
    );
  } else {
    const offset = uiPx(10);
    drawItemPreview(offset, offset, def, dragPayload.itemId, true, ghostDrawRotation, dragGhostCtx);
  }
  if (typeof applyPrepDragGhostStyles === "function") {
    applyPrepDragGhostStyles(el, arcRotation, { fullSize: !!ghostLayout, stable: true });
  }

  if (isLoadoutInteractionPhase()
    && dragPayload
    && typeof BBCraftTether !== "undefined") {
    const tetherSide = dragFrom?.side || prepViewSide;
    BBCraftTether.syncDragTethers(ghostX, ghostY, tetherSide);
  }
}

function updatePointerFromClient(clientX, clientY) {
  if (!canvas) return;
  if (dragPayload) samplePrepDragPointerVelocity(clientX, clientY);
  lastPointerClient.x = clientX;
  lastPointerClient.y = clientY;
  const coords = canvasCoordsFromClient(clientX, clientY);
  mousePos.x = coords.x;
  mousePos.y = coords.y;

  if (isLoadoutInteractionPhase()) {
    hoverCell = null;
    hoverSlot = null;
    const synthetic = createSyntheticPointerEvent(clientX, clientY);
    updatePendingShopDrag(synthetic);
    if (phase === "prep") {
      updatePendingBenchDrag(synthetic);
    }
    if (phase === "prep") updatePendingCanvasPick(clientX, clientY);
    const side = dragPayload && dragFrom?.side ? dragFrom.side : prepViewSide;
    if (dragPayload && canEditPrepSide(side)) {
      const hoverClient = resolvePrepDragHoverClient(clientX, clientY);
      syncPrepDragBoardHover(clientX, clientY, hoverClient.x, hoverClient.y);
    }

    const overStorage = typeof isPointerOverPrepStorage === "function"
      && isPointerOverPrepStorage(clientX, clientY);
    const overSidebar = isPointerOverPrepSidebar(clientX, clientY);
    if (overStorage || overSidebar) {
      if (!sidebarTooltipPinned) {
        tooltipItem = null;
        syncFieldTooltip();
      }
    } else if (dragPayload) {
      tooltipItem = null;
      hideSidebarTooltip();
    } else if ((pendingShopDrag || pendingBenchDrag) && !isTouchUi()) {
      tooltipItem = null;
      hideSidebarTooltip();
    }

    const benchPanel = document.getElementById("bench-panel");
    const benchFab = document.getElementById("btn-prep-bench-fab");
    const onBench = !!(dragPayload && isDropOnBench(synthetic));
    if (benchPanel) {
      benchPanel.classList.toggle("bench-drop-target", onBench);
    }
    if (benchFab) {
      benchFab.classList.toggle("bench-drop-target", onBench);
    }
    syncSellDropHighlight(clientX, clientY);
    syncPrepShopDragBackdrop(clientX, clientY);
  }

  if (dragPayload) {
    scheduleSyncDragGhostOverlay(clientX, clientY);
  } else {
    cancelPrepDragGhostRaf();
    syncDragGhostOverlay(clientX, clientY);
  }
  if (dragPayload && typeof onPrepDragMove === "function") onPrepDragMove(clientX, clientY);
}

function gamepadPointerDownAt(clientX, clientY) {
  if (!isLoadoutInteractionPhase() || gameOver) return;
  updatePointerFromClient(clientX, clientY);
  const synthetic = createSyntheticPointerEvent(clientX, clientY);
  const target = document.elementFromPoint(clientX, clientY);

  const shopCard = target?.closest?.(".shop-card:not(.empty)");
  if (shopCard) {
    const side = prepViewSide;
    if (!canEditPrepSide(side)) return;
    const index = shopCard.dataset.shopIndex != null
      ? +shopCard.dataset.shopIndex
      : +shopCard.dataset.index;
    if (!Number.isNaN(index)) {
      beginPendingShopDrag(index, synthetic, side);
      if (isTouchUi()) {
        armPointerTapTooltip(clientX, clientY, () => {
          if (dragPayload || shopDidDrag) return;
          showSidebarTooltipAt(
            clientX,
            clientY,
            shopCard.dataset.itemId,
            null,
            "shop",
            shopCard,
            { pinned: true },
          );
        }, { pointerType: "touch" });
      }
      return;
    }
  }

  const benchCard = target?.closest?.(".bench-card:not(.empty)");
  if (benchCard) {
    const side = prepViewSide;
    if (!canEditPrepSide(side)) return;
    const index = +benchCard.dataset.bench;
    if (!Number.isNaN(index)) {
      if (isTouchUi()) {
        const st = getSideState(side);
        const entry = st.bench[index];
        beginPendingBenchDrag(index, synthetic, side);
        armPointerTapTooltip(clientX, clientY, () => {
          if (dragPayload) return;
          if (!entry) return;
          showSidebarTooltipAt(
            clientX,
            clientY,
            entry.itemId,
            entry,
            "bench",
            benchCard,
            { pinned: true },
          );
        }, { pointerType: "touch" });
      } else {
        startBenchDrag(index, synthetic, side);
      }
      return;
    }
  }

  if (!canEditPrepSide()) return;

  if (target?.closest?.("#prep-storage-mount, .prep-storage-body, .prep-screen-flier")) {
    return;
  }

  const clickable = target?.closest?.("button:not([disabled]), .shop-pin");
  if (clickable && !clickable.closest("#game-canvas")) {
    clickable.click();
    return;
  }

  if (isTouchUi() && target?.closest?.("#game-canvas")) {
    armPointerTapTooltip(clientX, clientY, () => {
      pendingCanvasPick = null;
      updatePointerFromClient(clientX, clientY);
      updateTooltip(mousePos.x, mousePos.y);
    }, { pointerType: "touch" });
    pendingCanvasPick = { clientX, clientY };
    return;
  }

  onMouseDown(synthetic);
}

function gamepadPointerUpAt(clientX, clientY) {
  updatePointerFromClient(clientX, clientY);
  if (tryShowPrepPointerTapTooltip(clientX, clientY)) return;
  if (tryBuyFromPendingShopDrag(clientX, clientY)) return;
  pendingBenchDrag = null;
  pendingCanvasPick = null;
  finishDragDrop(createSyntheticPointerEvent(clientX, clientY));
}

function canvasCoordsFromEvent(e) {
  return canvasCoordsFromClient(e.clientX, e.clientY);
}
function rotateDragItem() {
  if (!dragPayload) return;
  const oldRot = ((dragPayload.rotation || 0) % 4 + 4) % 4;
  const newRot = (oldRot + 1) % 4;
  dragPayload.rotation = newRot;
  if (typeof beginPrepGhostRotationSpin === "function") {
    beginPrepGhostRotationSpin(oldRot, newRot);
  }
  playPrepSfx("prep_rotate");
  syncDragGhostOverlay(lastPointerClient.x, lastPointerClient.y);
}

function onMouseDown(e) {
  if (!isLoadoutInteractionPhase() || gameOver) return;
  if (!canEditPrepSide()) return;
  const side = prepViewSide;
  const st = getLoadoutEditState(side);
  const { x: mx, y: my } = canvasCoordsFromEvent(e);
  const hit = hitTest(mx, my);

  if (hit?.zone === "slot" && hit.item) {
    e.preventDefault();
    selectedBench = -1;
    dragPayload = { itemId: hit.item.itemId, rotation: hit.item.rotation || 0 };
    dragFrom = { type: "item", item: hit.item, side };
    st.items = st.items.filter((i) => i.uid !== hit.item.uid);
    beginPrepDragArcFromBackpack(hit.item.col, hit.item.row, side);
    startSynergyPreview();
    recalcSynergies();
    syncUiDragState();
    if (typeof onPrepDragStart === "function") onPrepDragStart();
    syncDragGhostOverlay(e.clientX, e.clientY);
  } else if (hit?.zone === "slot" && hit.container && !hit.item && !ITEM_CATALOG[hit.container.itemId].immovable) {
    e.preventDefault();
    selectedBench = -1;
    const carriedItems = getItemsTouchingContainer(st.items, hit.container);
    dragPayload = { itemId: hit.container.itemId, rotation: hit.container.rotation || 0 };
    dragFrom = { type: "container", container: hit.container, carriedItems, side };
    st.containers = st.containers.filter((c) => c.uid !== hit.container.uid);
    st.items = st.items.filter((i) => !carriedItems.some((c) => c.uid === i.uid));
    beginPrepDragArcFromBackpack(hit.container.col, hit.container.row, side);
    startSynergyPreview();
    recalcSynergies();
    syncUiDragState();
    if (typeof onPrepDragStart === "function") onPrepDragStart();
    syncDragGhostOverlay(e.clientX, e.clientY);
  }
}

function tryGemSocketDrop() {
  return false;
}

function drawItemSocketMarkers() {
  /* gem sockets removed */
}

function finishDragDrop(e) {
  pendingShopDrag = null;
  pendingBenchDrag = null;
  if (!dragPayload || !dragFrom) {
    clearDragUiState();
    return;
  }

  const shopPurchasedDuringDrop = dragFrom.type === "shop";
  const commerceSide = dragFrom.side || prepViewSide;

  let prepArcCelebrate = false;
  const dropE = createDropPointerEvent(e);
  const { x: dropClientX, y: dropClientY } = getDropPointerClient(e);
  if (dragPayload) samplePrepDragPointerVelocity(dropClientX, dropClientY);

  const side = dragFrom.side || prepViewSide;
  const st = getLoadoutEditState(side);

  const sidebarDragCancel = getPrepSidebarDragCancelAt(dropClientX, dropClientY, side);
  const hoverClient = resolvePrepDragHoverClient(dropClientX, dropClientY);

  if (dragPayload && !sidebarDragCancel.shop && !sidebarDragCancel.bench) {
    syncPrepDragBoardHover(dropClientX, dropClientY, hoverClient.x, hoverClient.y);
  } else if (sidebarDragCancel.shop || sidebarDragCancel.bench) {
    clearPrepBoardDropHover();
  }
  if (!canEditPrepSide(side)) {
    restoreDraggedItem(side);
    notifyPrepDragRejectedFromDragFrom();
    clearDragUiState();
    return;
  }

  const dropOnSell = isDropOnSell(dropE);
  const pointerOnBench = isDropOnBench(dropE);
  let boardPlacement = null;
  if (prepScreenFlingSuppress) {
    boardPlacement = evaluateFlingInventoryPlacement(dropClientX, dropClientY, side, st);
  } else {
    const ghostOnBoard = isPrepDragGhostOverBoard(dropClientX, dropClientY);
    boardPlacement = ghostOnBoard && !pointerOnBench && !sidebarDragCancel.shop
      ? getPrepDropPlacement(st, side)
      : null;
  }
  const dropBackToShop = sidebarDragCancel.shop;
  const dropBackToBench = sidebarDragCancel.bench && !prepScreenFlingSuppress;
  const placementOnBoard = !!(boardPlacement?.valid);
  const dropCol = placementOnBoard ? boardPlacement.col : null;
  const dropRow = placementOnBoard ? boardPlacement.row : null;
  const hasDropCell = placementOnBoard && dropCol != null && dropRow != null;
  const onBackpackSlot = hasDropCell && isSlotCell(st.containers, dropCol, dropRow);
  const dropOnBench = pointerOnBench && !prepScreenFlingSuppress && !placementOnBoard;

  if (dropOnSell && sellDraggedItem(side)) {
    if (isPrepBackpackArcDrag()) prepArcCelebrate = true;
    clearDragUiState();
    renderBench();
    recalcSynergies();
    updateUI();
    return;
  }

  if (dropOnSell) {
    restoreDraggedItem(side);
    notifyPrepDragRejectedFromDragFrom();
    clearDragUiState();
    renderBench();
    recalcSynergies();
    updateUI();
    return;
  }

  if (dropBackToShop) {
    // Пользователь передумал: вернул предмет в зону магазина — отменяем hold.
    restoreDraggedItem(side);
    clearDragUiState();
    renderBench();
    recalcSynergies();
    updateUI();
    return;
  }

  if (tryPrepScreenFlingOnDrop(dropClientX, dropClientY, side, st, dropOnSell, dropBackToShop, pointerOnBench)) {
    clearDragUiState();
    return;
  }

  if (dropBackToBench) {
    if (!releaseBenchEntryToStoragePhysics(st, dragFrom, dropClientX, dropClientY, side)) {
      restoreDraggedItem(side);
    }
    clearDragUiState();
    renderBench();
    recalcSynergies();
    updateUI();
    return;
  }

  if (dropOnBench) {
    const storageFullMsg = typeof shouldUsePrepStoragePhysics === "function" && shouldUsePrepStoragePhysics()
      ? "Хранилище полно!"
      : "Скамейка полна!";
    const hasRoom = typeof canFitOnBench === "function"
      ? canFitOnBench(st, 1)
      : st.bench.length < MAX_BENCH;
    const dropVel = getPrepDragReleaseVelocity();
    if (dragFrom.type === "shop") {
      if (hasRoom) {
        const itemId = commitShopPurchase(dragFrom.index, side);
        if (itemId) {
          const entry = {
            itemId,
            uid: `bench-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            rotation: dragPayload.rotation || 0,
          };
          st.bench.push(entry);
          if (typeof shouldUsePrepStoragePhysics === "function" && shouldUsePrepStoragePhysics()) {
            PrepStoragePhysics.spawnAtDrop(entry, dropE.clientX, dropE.clientY, side, dropVel);
          }
          prepArcCelebrate = true;
          const boughtDef = ITEM_CATALOG[itemId];
          if (typeof playPrepBuyFanfare === "function") playPrepBuyFanfare(boughtDef);
        }
      } else {
        log(storageFullMsg);
      }
    } else if (hasRoom && dragFrom.type === "bench" && dragFrom.benchEntry) {
      releaseBenchEntryToStoragePhysics(st, dragFrom, dropClientX, dropClientY, side);
      prepArcCelebrate = true;
    } else if (hasRoom && dragFrom.type === "item") {
      const entry = { itemId: dragFrom.item.itemId, uid: dragFrom.item.uid, rotation: dragPayload.rotation || 0 };
      st.bench.push(entry);
      if (typeof shouldUsePrepStoragePhysics === "function" && shouldUsePrepStoragePhysics()) {
        PrepStoragePhysics.spawnAtDrop(entry, dropE.clientX, dropE.clientY, side, dropVel);
      }
      prepArcCelebrate = true;
    } else if (hasRoom && dragFrom.type === "container") {
      const entry = {
        itemId: dragFrom.container.itemId,
        uid: dragFrom.container.uid,
        rotation: dragPayload.rotation || 0,
        carriedItems: dragFrom.carriedItems,
        originCol: dragFrom.container.col,
        originRow: dragFrom.container.row,
      };
      st.bench.push(entry);
      if (typeof shouldUsePrepStoragePhysics === "function" && shouldUsePrepStoragePhysics()) {
        PrepStoragePhysics.spawnAtDrop(entry, dropE.clientX, dropE.clientY, side, dropVel);
      }
      prepArcCelebrate = true;
    } else if (!hasRoom && dragFrom.type !== "shop") {
      log(storageFullMsg);
      restoreDraggedItem(side);
    }
  } else if (isContainerItem(dragPayload.itemId) && hasDropCell) {
    const col = dropCol;
    const row = dropRow;
    const excludeUid = dragFrom.type === "container" ? dragFrom.container.uid : null;
    const canMove = dragFrom.type === "container"
      ? canMoveContainerWithItems(
        dragFrom.container,
        col,
        row,
        st.containers,
        st.items,
        excludeUid,
        getActiveGridCols(),
        getActiveGridRows(),
      )
      : canPlaceContainer(
        dragPayload.itemId,
        col,
        row,
        dragPayload.rotation || 0,
        getActiveGridCols(),
        getActiveGridRows(),
        st.containers,
        excludeUid,
        st.items,
      );

    if (canMove) {
      if (dragFrom.type === "bench") {
        const benchEntry = dragFrom.benchEntry;
        commitBenchDragEntry(dragFrom);
        const placed = createContainer(dragPayload.itemId, col, row, dragPayload.rotation || 0);
        st.containers = [...st.containers, placed];
        (benchEntry?.carriedItems || []).forEach((item) => {
          const dCol = col - (benchEntry.originCol ?? col);
          const dRow = row - (benchEntry.originRow ?? row);
          st.items = [...st.items, { ...item, col: item.col + dCol, row: item.row + dRow }];
        });
        prepArcCelebrate = true;
      } else if (dragFrom.type === "shop") {
        const itemId = commitShopPurchase(dragFrom.index, side);
        if (itemId) {
          const placed = createContainer(itemId, col, row, dragPayload.rotation || 0);
          st.containers = [...st.containers, placed];
          prepArcCelebrate = true;
        }
      } else {
        const placed = createContainer(dragPayload.itemId, col, row, dragPayload.rotation || 0);
        if (dragFrom.type === "container") {
          placed.uid = dragFrom.container.uid;
          const dCol = col - dragFrom.container.col;
          const dRow = row - dragFrom.container.row;
          st.containers = [...st.containers, placed];
          st.items = [...st.items, ...dragFrom.carriedItems.map((item) => ({
            ...item,
            col: item.col + dCol,
            row: item.row + dRow,
          }))];
        }
      }
      if (typeof notifyPrepHeavyDrop === "function") {
        notifyPrepHeavyDrop(ITEM_CATALOG[dragPayload.itemId]);
      }
      if (side === prepViewSide && typeof CombatLog !== "undefined" && isShopExpansionContainer(dragPayload.itemId)) {
        CombatLog.notifyBackpack(ITEM_CATALOG[dragPayload.itemId]);
      }
      if (dragFrom.type === "container" && dragFrom.carriedItems?.length) {
        dragFrom.carriedItems.forEach((item) => {
          if (typeof notifyPrepItemPlaced === "function") {
            notifyPrepItemPlaced(item, ITEM_CATALOG[item.itemId]);
          }
        });
      }
    } else if (dragFrom.type === "container") {
      st.containers = [...st.containers, dragFrom.container];
      st.items = [...st.items, ...dragFrom.carriedItems];
      dragFrom.carriedItems?.forEach((item) => {
        if (typeof notifyPrepPlacementRejected === "function") notifyPrepPlacementRejected(item);
      });
    }
  } else if (!isContainerItem(dragPayload.itemId) && hasDropCell && boardPlacement?.kind === "item") {
    const hoverAtDrop = getPrepDragBoardHoverCell();
    const socketCol = hoverAtDrop?.col ?? dropCol;
    const socketRow = hoverAtDrop?.row ?? dropRow;
    if (isSlotCell(st.containers, socketCol, socketRow)
      && tryGemSocketDrop(st, dragFrom, dragPayload, socketCol, socketRow, side)) {
      commitBenchDragEntry(dragFrom);
      // камень вставлен в сокет
    } else {
      const placement = boardPlacement;
      const displaced = placement.displaced || [];
      let displacedItems = [];
      if (displaced.length) {
        displaced.forEach((existing) => {
          st.items = st.items.filter((i) => i.uid !== existing.uid);
        });
        displacedItems = displaced;
      }
      if (dragFrom.type === "bench") {
        commitBenchDragEntry(dragFrom);
      } else if (dragFrom.type === "shop") {
        const itemId = commitShopPurchase(dragFrom.index, side);
        if (!itemId) {
          clearDragUiState();
          renderBench();
          recalcSynergies();
          updateUI();
          return;
        }
        dragPayload.itemId = itemId;
      }
      if (displacedItems.length) {
        renderBench(side);
        queueDisplaceToBenchAnimations(side, displacedItems, prepViewSide, (item, landSide, landPt) => {
          const benchState = getSideState(side);
          const entry = {
            itemId: item.itemId,
            uid: item.uid,
            rotation: item.rotation || 0,
          };
          benchState.bench.push(entry);
          if (typeof shouldUsePrepStoragePhysics === "function" && shouldUsePrepStoragePhysics() && landPt) {
            PrepStoragePhysics.spawnFromInbound(entry, landPt.x, landPt.y, side);
          }
        });
      }
      const placed = createPlacedItem(dragPayload.itemId, placement.col, placement.row, placement.rotation);
      if (isPrepLoadoutItemDrag()) {
        placed.uid = dragFrom.item.uid;
        if (dragFrom.item.socketedGems) placed.socketedGems = [...dragFrom.item.socketedGems];
      }
      st.items = [...st.items, placed];
      dragPayload.rotation = placement.rotation;
      if (typeof notifyPrepItemPlaced === "function") {
        notifyPrepItemPlaced(placed, ITEM_CATALOG[placed.itemId]);
      }
      if (dragFrom.type === "shop" || dragFrom.type === "bench") {
        prepArcCelebrate = true;
      }
    }
  } else if (isPrepLoadoutItemDrag()) {
    const heroClass = typeof getLoadoutHeroClass === "function" ? getLoadoutHeroClass() : null;
    const wrongClass = typeof isItemAllowedForHeroClass === "function"
      && !isItemAllowedForHeroClass(dragFrom.item.itemId, heroClass);
    const benchRoom = typeof canFitOnBench === "function"
      ? canFitOnBench(st, 1)
      : st.bench.length < MAX_BENCH;
    if (wrongClass && benchRoom) {
      st.bench.push({
        itemId: dragFrom.item.itemId,
        uid: dragFrom.item.uid,
        rotation: dragPayload.rotation || 0,
      });
      prepArcCelebrate = true;
    } else {
      st.items = [...st.items, dragFrom.item];
      if (typeof notifyPrepPlacementRejected === "function") notifyPrepPlacementRejected(dragFrom.item);
    }
  } else if (dragFrom.type === "container") {
    st.containers = [...st.containers, dragFrom.container];
    st.items = [...st.items, ...dragFrom.carriedItems];
    dragFrom.carriedItems?.forEach((item) => {
      if (typeof notifyPrepPlacementRejected === "function") notifyPrepPlacementRejected(item);
    });
  }

  if (dragFrom?.type === "bench" && dragFrom.benchEntry) {
    const usedPhysics = typeof shouldUsePrepStoragePhysics === "function"
      && shouldUsePrepStoragePhysics()
      && releaseBenchEntryToStoragePhysics(st, dragFrom, dropClientX, dropClientY, side);
    if (!usedPhysics) restoreBenchDragEntry(st, dragFrom);
  }

  maybeCelebratePrepArcDrop(prepArcCelebrate);
  if (prepArcCelebrate && typeof markPrepLoadoutMutationChange === "function") {
    markPrepLoadoutMutationChange({
      itemId: dragPayload?.itemId
        || dragFrom?.item?.itemId
        || dragFrom?.benchEntry?.itemId
        || dragFrom?.container?.itemId
        || null,
      cause: dragFrom?.type === "shop" ? "buy" : "place",
    });
  }
  clearDragUiState();
  if (shopPurchasedDuringDrop) suppressShopClickUntil = 0;
  if (canEditPrepSide(side)) syncPendingCraftsForSide(side);
  if (typeof hasActiveDisplaceAnimations === "function" && hasActiveDisplaceAnimations(side)) {
    if (shopPurchasedDuringDrop) renderShop(commerceSide);
    recalcSynergies();
    updateUI();
  } else {
    if (shopPurchasedDuringDrop) renderShop(commerceSide);
    renderBench();
    recalcSynergies();
    updateUI();
  }
  if (!dragPayload && typeof applyGamepadPrepFocusTooltip === "function" && lastGamepadPrepFocus) {
    applyGamepadPrepFocusTooltip(lastGamepadPrepFocus);
  }
}

function beginPendingBenchDrag(index, e, side = prepViewSide) {
  if (phase !== "prep" || gameOver || !canEditPrepSide(side)) return;
  const st = getSideState(side);
  if (!st.bench[index]) return;
  pendingBenchDrag = { index, startX: e.clientX, startY: e.clientY, side };
  syncUiDragState();
}

function updatePendingBenchDrag(e) {
  if (!pendingBenchDrag || dragPayload) return;
  const dx = e.clientX - pendingBenchDrag.startX;
  const dy = e.clientY - pendingBenchDrag.startY;
  if (Math.hypot(dx, dy) < getPrepDragCommitThresholdPx()) return;
  const { index, side } = pendingBenchDrag;
  pendingBenchDrag = null;
  clearTouchTapGesture();
  hideSidebarTooltip();
  startBenchDrag(index, e, side);
}

function updatePendingCanvasPick(clientX, clientY) {
  if (!pendingCanvasPick || dragPayload) return;
  const dx = clientX - pendingCanvasPick.clientX;
  const dy = clientY - pendingCanvasPick.clientY;
  if (Math.hypot(dx, dy) < getPrepDragCommitThresholdPx()) return;
  const pick = pendingCanvasPick;
  pendingCanvasPick = null;
  onMouseDown(createSyntheticPointerEvent(pick.clientX, pick.clientY));
}

function tryBuyFromPendingShopDrag(clientX, clientY) {
  if (!pendingShopDrag || dragPayload) return false;
  const dx = clientX - pendingShopDrag.startX;
  const dy = clientY - pendingShopDrag.startY;
  if (Math.hypot(dx, dy) >= getPrepDragCommitThresholdPx()) return false;
  if (isTouchUi()) return false;
  const { index, side } = pendingShopDrag;
  pendingShopDrag = null;
  syncUiDragState();

  const st = getSideState(side);
  const entry = st.shop[index];
  const card = document.querySelector(`.shop-card[data-index="${index}"]`);
  if (!entry || !card || card.classList.contains("empty")) return false;
  showSidebarTooltipAt(clientX, clientY, entry, null, "shop", card, { pinned: true });
  suppressShopClickUntil = Date.now() + 500;
  return true;
}

function beginPendingShopDrag(index, e, side = prepViewSide) {
  if (!isLoadoutInteractionPhase() || gameOver || !canEditPrepSide(side)) return;
  const st = getSideState(side);
  if (!st.shop[index]) return;
  const entryId = st.shop[index];
  const enhMeta = typeof resolveShopEntryMeta === "function" ? resolveShopEntryMeta(entryId) : null;
  const cost = enhMeta?.cost ?? ITEM_CATALOG[entryId]?.cost;
  if (cost == null || st.gold < cost) return;
  e.preventDefault();
  pendingShopDrag = { index, startX: e.clientX, startY: e.clientY, side };
  shopDidDrag = false;
  syncUiDragState();
}

function updatePendingShopDrag(e) {
  if (!pendingShopDrag || dragPayload) return;
  const dx = e.clientX - pendingShopDrag.startX;
  const dy = e.clientY - pendingShopDrag.startY;
  if (Math.hypot(dx, dy) < getPrepDragCommitThresholdPx()) return;
  const { index, side } = pendingShopDrag;
  pendingShopDrag = null;
  clearTouchTapGesture();
  shopDidDrag = true;
  startShopDrag(index, e, side);
}

function resolveShopCardElement(_side, index) {
  return document.querySelector(`#shop-slots .shop-card[data-index="${index}"]`)
    || document.querySelector(`.shop-card[data-index="${index}"]`);
}

function resolveBenchCardElement(_side, index) {
  if (typeof window.isPrepBenchPopoverOpen === "function" && window.isPrepBenchPopoverOpen()) {
    return document.querySelector(`#bench-slots .bench-card[data-bench="${index}"]`);
  }
  return document.querySelector(`#bench-slots .bench-card[data-bench="${index}"]`);
}

function beginPrepDragArcFromCard(cardEl, itemIdOverride = null, originOverride = null) {
  if (!isLoadoutInteractionPhase() || typeof PrepDragArc === "undefined") return;
  const c = originOverride || getElementClientCenter(cardEl);
  if (!c) return;
  const itemId = itemIdOverride || cardEl?.dataset?.itemId || dragPayload?.itemId;
  PrepDragArc.begin({ fromX: c.x, fromY: c.y, itemId });
}

function beginPrepDragArcFromBackpack(col, row, side = prepViewSide) {
  if (!isLoadoutInteractionPhase() || typeof PrepDragArc === "undefined") return;
  const c = boardCellClientCenter(col, row, side);
  if (!c) return;
  const st = getLoadoutEditState(side);
  const kind = isContainerItem(dragPayload?.itemId)
    ? "c"
    : (isSlotCell(st.containers, col, row) ? "s" : "c");
  const originPlaceable = isPrepArcPlaceableCell(col, row);
  PrepDragArc.begin({
    fromX: c.x,
    fromY: c.y,
    itemId: dragPayload?.itemId,
    originCol: originPlaceable ? col : null,
    originRow: originPlaceable ? row : null,
    originKind: kind,
  });
}

function startShopDrag(index, e, side = prepViewSide) {
  if (!isLoadoutInteractionPhase() || gameOver || !canEditPrepSide(side)) return;
  const st = getSideState(side);
  if (!st.shop[index]) return;
  const entryId = st.shop[index];
  const enhMeta = typeof resolveShopEntryMeta === "function" ? resolveShopEntryMeta(entryId) : null;
  const cost = enhMeta?.cost ?? ITEM_CATALOG[entryId]?.cost;
  if (cost == null || st.gold < cost) return;
  if (e?.preventDefault) e.preventDefault();
  clearTouchTapGesture();
  hideSidebarTooltip();
  dragPayload = { itemId: entryId, rotation: 0 };
  dragFrom = { type: "shop", index, side };
  resetPrepDragPointerVelocity();
  prepSidebarDragUnlocked = usesPrepCommercePopoverMode();
  prepSidebarStickyHover = null;
  const arcCard = resolveShopCardElement(side, index);
  const arcOrigin = getElementClientCenter(arcCard)
    || (e?.clientX != null && e?.clientY != null ? { x: e.clientX, y: e.clientY } : null);
  beginPrepDragArcFromCard(arcCard, entryId, arcOrigin);
  startSynergyPreview();
  arcCard?.classList.add("shop-dragging");
  syncUiDragState();
  if (typeof onPrepDragStart === "function") onPrepDragStart();
  if (typeof window.resetPrepTouchGesture === "function") window.resetPrepTouchGesture();
  if (e?.clientX != null && e?.clientY != null) {
    lastPointerClient.x = e.clientX;
    lastPointerClient.y = e.clientY;
    samplePrepDragPointerVelocity(e.clientX, e.clientY);
    const hoverClient = resolvePrepDragHoverClient(e.clientX, e.clientY);
    syncPrepDragBoardHover(e.clientX, e.clientY, hoverClient.x, hoverClient.y);
  }
  syncDragGhostOverlay(lastPointerClient.x, lastPointerClient.y);
}

function startBenchDrag(index, e, side = prepViewSide) {
  const st = getSideState(side);
  if (phase !== "prep" || gameOver || !canEditPrepSide(side) || !st.bench[index]) return;
  e.preventDefault();
  clearTouchTapGesture();
  hideSidebarTooltip();
  const arcCard = resolveBenchCardElement(side, index);
  const arcOrigin = getElementClientCenter(arcCard)
    || (e?.clientX != null && e?.clientY != null ? { x: e.clientX, y: e.clientY } : null);
  const benchEntry = takeBenchEntryOnDragStart(st, index);
  if (!benchEntry) return;
  selectedBench = -1;
  document.querySelectorAll("#bench-slots .bench-card").forEach((card) => {
    card.classList.toggle("selected", +card.dataset.bench === index);
  });
  dragPayload = { itemId: benchEntry.itemId, rotation: benchEntry.rotation || 0 };
  dragFrom = { type: "bench", index, side, benchEntry };
  resetPrepDragPointerVelocity();
  prepSidebarDragUnlocked = usesPrepCommercePopoverMode();
  prepSidebarStickyHover = null;
  renderBench(side);
  beginPrepDragArcFromCard(arcCard, benchEntry.itemId, arcOrigin);
  if (typeof window.resetPrepTouchGesture === "function") window.resetPrepTouchGesture();
  startSynergyPreview();
  syncUiDragState();
  if (typeof onPrepDragStart === "function") onPrepDragStart();
  if (e?.clientX != null && e?.clientY != null) {
    lastPointerClient.x = e.clientX;
    lastPointerClient.y = e.clientY;
    samplePrepDragPointerVelocity(e.clientX, e.clientY);
    const hoverClient = resolvePrepDragHoverClient(e.clientX, e.clientY);
    syncPrepDragBoardHover(e.clientX, e.clientY, hoverClient.x, hoverClient.y);
  }
  syncDragGhostOverlay(lastPointerClient.x, lastPointerClient.y);
}
