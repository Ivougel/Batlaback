/**
 * Prep drag/drop runtime — вынесено из game.js.
 * Состояние (dragPayload, dragFrom, pending*Drag, …) остаётся в game.js.
 */

function getDragThresholdPx() {
  return isTouchUi() ? TOUCH_DRAG_THRESHOLD_PX : MOUSE_DRAG_THRESHOLD_PX;
}

/** На touch drag стартует только после «свободы» для tap-to-tooltip. */
function getPrepDragCommitThresholdPx() {
  return isTouchUi()
    ? Math.max(TOUCH_DRAG_THRESHOLD_PX, TOOLTIP_CONFIG.moveTolerance)
    : MOUSE_DRAG_THRESHOLD_PX;
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

  const onUp = (e) => {
    if (!isLoadoutInteractionPhase() || !isActiveDrag()) return;
    if (e.button != null && e.button !== 0) return;
    if (tryBuyFromPendingShopDrag(e.clientX, e.clientY)) return;
    finishDragDrop(e);
  };

  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp, { passive: false });
  window.addEventListener("pointercancel", onUp, { passive: false });
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
  st.bench.splice(index, 1);
  if (selectedBench === index) selectedBench = -1;
  else if (selectedBench > index) selectedBench -= 1;
  return { ...entry };
}

function restoreBenchDragEntry(st, dragFrom) {
  if (dragFrom?.type !== "bench" || !dragFrom.benchEntry) return;
  if (st.bench.length >= MAX_BENCH) return;
  const idx = Math.min(Math.max(0, dragFrom.index ?? st.bench.length), st.bench.length);
  st.bench.splice(idx, 0, dragFrom.benchEntry);
  dragFrom.benchEntry = null;
}

function commitBenchDragEntry(dragFrom) {
  if (dragFrom?.type === "bench") dragFrom.benchEntry = null;
}

function restoreDraggedItem(side = prepViewSide) {
  if (!dragFrom) return;
  const st = getLoadoutEditState(side);
  if (dragFrom.type === "item") {
    st.items = [...st.items, dragFrom.item];
  } else if (dragFrom.type === "container") {
    st.containers = [...st.containers, dragFrom.container];
    st.items = [...st.items, ...dragFrom.carriedItems];
  } else if (dragFrom.type === "bench") {
    restoreBenchDragEntry(st, dragFrom);
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
  const dragSide = dragFrom?.side || prepViewSide;

  const sellZone = document.getElementById("shop-sell-zone");
  if (sellZone && !isPrepSellFabActive()) {
    sellZone.classList.toggle("sell-drop-target", onSell);
    sellZone.classList.toggle("is-drag-active", sellable);
  } else if (sellZone) {
    sellZone.classList.remove("sell-drop-target", "is-drag-active");
  }

  document.querySelectorAll(".sell-drop-zone").forEach((el) => {
    let zoneActive = onSell;
    let zoneSellable = sellable;
    if (el.classList.contains("lobby2p-sell-zone")) {
      const side = Number(el.dataset.human) === 0 ? "player" : "enemy";
      zoneSellable = sellable && side === dragSide;
      zoneActive = onSell && side === dragSide;
    }
    el.classList.toggle("is-drag-active", zoneSellable);
    el.classList.toggle("is-drag-target", zoneActive);
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
  const benchOk = st.bench.length + displaced.length <= MAX_BENCH;
  return slotOk && benchOk;
}

function maybePrepArcHoverSound(col, row) {
  if (typeof PrepDragArc === "undefined" || !PrepDragArc.isActive()) return;
  if (col == null || row == null || !isPrepArcPlaceableCell(col, row)) {
    PrepDragArc.syncHoverCell(null, null);
    return;
  }
  const kind = isContainerItem(dragPayload?.itemId) ? "c" : "s";
  PrepDragArc.syncHoverCell(col, row, kind);
}

function applyPrepBoardHoverFromCanvasXY(mx, my, side, st) {
  if (isLobby2pColumnPrepLayout() && lobby2pSideFromCanvasX(mx) !== side) return false;
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

function shouldDrawPrepGridFigurePreview() {
  if (!isPrepSidebarArcDrag()) return true;
  if (hoverSlot || hoverCell || prepDropPreviewHover) return true;
  const st = typeof getSideState === "function" ? getSideState(prepViewSide) : null;
  return !!(st && typeof getPrepDropPlacement === "function" && getPrepDropPlacement(st, prepViewSide));
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
  if (isLobby2pMode() && lobbyState?.isSplitLobby) {
    if (typeof window.isPrepShopPopoverOpen === "function" && window.isPrepShopPopoverOpen()) {
      const panel = document.querySelector("#prep-shop-popover .prep-shop-popover__panel");
      const r = panel?.getBoundingClientRect();
      if (r && r.width >= 1 && r.height >= 1) return r;
    }
    return null;
  }
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
  const dropE = createSyntheticPointerEvent(clientX, clientY);
  return {
    shop: dragFrom?.type === "shop" && isPointerInsideShopDrawerBounds(clientX, clientY, side),
    bench: dragFrom?.type === "bench" && isDropOnBench(dropE, { ignoreBoardTarget: true }),
  };
}

function clearPrepBoardDropHover() {
  prepDropPreviewHover = null;
  hoverCell = null;
  hoverSlot = null;
  if (typeof PrepDragArc !== "undefined" && PrepDragArc.isActive()) {
    PrepDragArc.syncHoverCell(null, null);
  }
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
  const coords = canvasCoordsFromClient(clientX, clientY);
  return isOnBoard(coords.x, coords.y, prepViewSide);
}

function getPrepDragGhostClientPos(clientX, clientY) {
  if (isPrepSidebarArcDrag()) {
    return { x: clientX, y: clientY, rotation: 0 };
  }
  const anchor = getDragGhostAnchorClient(clientX, clientY);
  if (isLoadoutInteractionPhase()
    && isPrepArcDragSource()
    && typeof PrepDragArc !== "undefined"
    && PrepDragArc.isActive()) {
    return PrepDragArc.resolveGhostPosition(clientX, clientY, anchor.x, anchor.y);
  }
  return { x: anchor.x, y: anchor.y, rotation: 0 };
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

  const tryCanvas = (mx, my) => applyPrepBoardHoverFromCanvasXY(mx, my, side, st);
  const tryClient = (cx, cy) => {
    const coords = canvasCoordsFromClient(cx, cy);
    return tryCanvas(coords.x, coords.y);
  };

  if (isPrepSidebarArcDrag()) {
    if (syncPrepSidebarBoardHover(clientX, clientY, side, st)) {
      maybePrepArcHoverSound(hoverSlot?.col ?? hoverCell?.col, hoverSlot?.row ?? hoverCell?.row);
      return;
    }
  } else {
    if (tryClient(clientX, clientY)) {
      maybePrepArcHoverSound(hoverSlot?.col ?? hoverCell?.col, hoverSlot?.row ?? hoverCell?.row);
      return;
    }
    if (ghostClientX != null && ghostClientY != null && tryClient(ghostClientX, ghostClientY)) {
      maybePrepArcHoverSound(hoverSlot?.col ?? hoverCell?.col, hoverSlot?.row ?? hoverCell?.row);
      return;
    }
    if (typeof PrepDragArc !== "undefined" && PrepDragArc.isActive() && isPrepArcDragSource()) {
      const anchor = getDragGhostAnchorClient(clientX, clientY);
      if (tryClient(anchor.x, anchor.y)) {
        maybePrepArcHoverSound(hoverSlot?.col ?? hoverCell?.col, hoverSlot?.row ?? hoverCell?.row);
        return;
      }
    }
  }

  hoverCell = null;
  hoverSlot = null;
  if (typeof PrepDragArc !== "undefined" && PrepDragArc.isActive()) {
    PrepDragArc.syncHoverCell(null, null);
  }
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
    if (!resolved) return null;
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
  const benchOk = st.bench.length + displaced.length <= MAX_BENCH;
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
  const shape = rotateShape(def.shape, rot);
  let best = null;
  let bestScore = -1;
  for (const [dx, dy] of shape) {
    const col = hoverCol - dx;
    const row = hoverRow - dy;
    let score = 0;
    for (const [sx, sy] of shape) {
      const c = col + sx;
      const r = row + sy;
      if (c >= 0 && c < GRID_COLS && r >= 0 && r < GRID_ROWS) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = {
        kind: "item",
        col,
        row,
        rotation: rot,
        valid: false,
        displaced: [],
      };
    }
  }
  return best;
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
      return st.bench.length < MAX_BENCH ? "valid" : "invalid";
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
      return st.bench.length < MAX_BENCH ? "valid" : "invalid";
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
    const benchOk = st.bench.length + displaced.length <= MAX_BENCH;
    return placement.valid && benchOk && slotOk ? "valid" : "invalid";
  }

  return "neutral";
}

function maybeCelebratePrepArcDrop(success) {
  if (!success || typeof PrepDragArc === "undefined") return false;
  if (!isPrepArcDragSource()) return false;
  if (!PrepDragArc.isActive()) return false;
  PrepDragArc.celebrate(lastPointerClient.x, lastPointerClient.y);
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
  prepSidebarDragUnlocked = false;
  prepSidebarStickyHover = null;
  prepDropPreviewHover = null;
  clearGamepadBoardFocus();
  if (typeof onPrepDragEnd === "function") onPrepDragEnd();
  if (typeof PrepDragArc !== "undefined" && !PrepDragArc.isCelebrating?.()) {
    PrepDragArc.end();
  }
  hideDragGhostOverlay();
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
    applyPrepDragGhostStyles(el, arcRotation, { fullSize: !!ghostLayout });
  }
}

function updatePointerFromClient(clientX, clientY) {
  if (!canvas) return;
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
      syncPrepDragBoardHover(clientX, clientY, clientX, clientY);
      if (typeof window.syncFxCanvasGeometry === "function") window.syncFxCanvasGeometry();
    }

    const overSidebar = isPointerOverPrepSidebar(clientX, clientY);
    if (overSidebar) {
      tooltipItem = null;
      syncFieldTooltip();
    } else if (dragPayload) {
      tooltipItem = null;
      hideSidebarTooltip();
    } else if ((pendingShopDrag || pendingBenchDrag) && !isTouchUi()) {
      tooltipItem = null;
      hideSidebarTooltip();
    } else if (!isTouchUi()) {
      if (!sidebarTooltipPinned
        && (sidebarTooltipSource === "shop" || sidebarTooltipSource === "bench")) {
        hideSidebarTooltip();
      }
      updateTooltip(mousePos.x, mousePos.y);
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
  } else if ((phase === "battle" || phase === "replay") && battleState && !isTouchUi()) {
    updateTooltip(mousePos.x, mousePos.y);
  }

  syncDragGhostOverlay(clientX, clientY);
  if (dragPayload && typeof onPrepDragMove === "function") onPrepDragMove(clientX, clientY);
}

function gamepadPointerDownAt(clientX, clientY) {
  if (!isLoadoutInteractionPhase() || gameOver) return;
  updatePointerFromClient(clientX, clientY);
  const synthetic = createSyntheticPointerEvent(clientX, clientY);
  const target = document.elementFromPoint(clientX, clientY);

  const shopCard = target?.closest?.(".shop-card:not(.empty)");
  if (shopCard) {
    const side = (isLobby2pMode() && lobbyState?.isSplitLobby)
      ? prepViewSide
      : (lobby2pSideFromCommerceTarget(shopCard) || prepViewSide);
    ensureLobby2pActiveHumanForSide(side);
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
    let side = lobby2pSideFromHudTarget(benchCard) || prepViewSide;
    ensureLobby2pActiveHumanForSide(side);
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
  if (isLobby2pMode() && phase === "prep" && lobbyState?.isSplitLobby && !lobby2pHasActiveDuel()) {
    const { x: mx } = canvasCoordsFromEvent(e);
    const targetSide = lobby2pSideFromCanvasX(mx);
    if (targetSide !== prepViewSide && canEditPrepSide(targetSide)) {
      setLobby2pActiveHuman(targetSide === "player" ? 0 : 1);
    }
  }
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

function tryGemSocketDrop(st, dragFrom, dragPayload, col, row, side) {
  if (!isGemItem(dragPayload.itemId)) return false;
  const excludeUid = isPrepLoadoutItemDrag() ? dragFrom.item.uid : null;
  const host = findSocketHostAt(st.items, col, row, dragPayload.itemId, excludeUid);
  if (!host) return false;

  let gemId = dragPayload.itemId;
  let purchasedGemId = null;

  if (dragFrom.type === "shop") {
    // Покупку откладываем до успешной вставки в сокет.
    purchasedGemId = dragFrom.index;
  } else if (dragFrom.type === "item") {
    st.items = st.items.filter((i) => i.uid !== dragFrom.item.uid);
  }

  const hostIdx = st.items.findIndex((i) => i.uid === host.uid);
  if (hostIdx < 0) return false;
  if (dragFrom.type === "shop") {
    const bought = commitShopPurchase(purchasedGemId, side);
    if (!bought) return false;
    gemId = bought;
  }
  const socketed = socketGemIntoItem(st.items[hostIdx], gemId);
  if (!socketed) return false;

  st.items[hostIdx] = socketed;
  const gemName = ITEM_CATALOG[gemId]?.name || gemId;
  const hostName = ITEM_CATALOG[host.itemId]?.name || host.itemId;
  log(`💎 ${gemName} вставлен в ${hostName}`);
  playPrepSfx("prep_gem");
  if (side === prepViewSide && typeof CombatLog !== "undefined") {
    CombatLog.notifyGemSocketed(gemId, host.itemId);
  }
  return true;
}

function drawItemSocketMarkers(ctx, item, def, team, cellRectFn) {
  if (typeof drawItemSocketVisuals === "function") {
    drawItemSocketVisuals(ctx, item, def, cellRectFn);
    return;
  }
  const count = getItemSocketCount(item.itemId);
  if (!count) return;
  const normalized = ensureSocketArray(item);
  const cells = getItemCells(item);
  const cols = cells.map(([c]) => c);
  const rows = cells.map(([, r]) => r);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  const maxRow = Math.max(...rows);

  for (let i = 0; i < count; i++) {
    const col = count === 1
      ? Math.round((minCol + maxCol) / 2)
      : Math.round(minCol + ((maxCol - minCol) * i) / Math.max(1, count - 1));
    const rect = cellRectFn(col, maxRow);
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h - 6;
    const gemId = normalized.socketedGems[i];
    const filled = !!gemId;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = filled ? `${ITEM_CATALOG[gemId]?.color || "#d2a8ff"}cc` : "rgba(255,255,255,0.18)";
    ctx.fill();
    ctx.strokeStyle = filled ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (filled && ITEM_CATALOG[gemId]) {
      drawCellEmojiAt(ctx, getItemIcons(ITEM_CATALOG[gemId])[0], cx, cy, 10);
    }
    ctx.restore();
  }
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

  const side = dragFrom.side || prepViewSide;
  const st = getLoadoutEditState(side);

  const sidebarDragCancel = getPrepSidebarDragCancelAt(dropClientX, dropClientY, side);

  if (dragPayload && !sidebarDragCancel.shop && !sidebarDragCancel.bench) {
    syncPrepDragBoardHover(dropClientX, dropClientY, dropClientX, dropClientY);
    if (isPrepSidebarArcDrag()) {
      const projected = projectClientPointToPrepBackpack(dropClientX, dropClientY);
      if (projected) applyPrepSidebarCorridorHover(projected, side, st);
    }
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
  const sidebarPlacement = isPrepSidebarArcDrag() && !pointerOnBench && !sidebarDragCancel.shop
    ? getPrepDropPlacement(st, side)
    : null;
  const dropBackToShop = sidebarDragCancel.shop;
  const dropBackToBench = sidebarDragCancel.bench;
  const { x: mx, y: my } = canvasCoordsFromClient(dropClientX, dropClientY);
  let onBoard = isOnBoard(mx, my, side);
  if (onBoard && isLobby2pColumnPrepLayout() && lobby2pSideFromCanvasX(mx) !== side) {
    onBoard = false;
  }
  const boardCol = onBoard ? xToCol(mx, side) : null;
  const boardRow = onBoard ? yToRow(my, side) : null;
  const dropCol = pointerOnBench ? null : (sidebarPlacement?.col ?? boardCol);
  const dropRow = pointerOnBench ? null : (sidebarPlacement?.row ?? boardRow);
  const hasDropCell = dropCol != null && dropRow != null;
  const onBackpackSlot = hasDropCell && isSlotCell(st.containers, dropCol, dropRow);
  const dropOnBench = pointerOnBench;

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

  if (dropBackToBench) {
    restoreDraggedItem(side);
    clearDragUiState();
    renderBench();
    recalcSynergies();
    updateUI();
    return;
  }

  if (dropOnBench) {
    if (dragFrom.type === "shop") {
      if (st.bench.length < MAX_BENCH) {
        const itemId = commitShopPurchase(dragFrom.index, side);
        if (itemId) {
          st.bench.push({
            itemId,
            uid: `bench-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            rotation: dragPayload.rotation || 0,
          });
          prepArcCelebrate = true;
          const boughtDef = ITEM_CATALOG[itemId];
          if (typeof playPrepBuyFanfare === "function") playPrepBuyFanfare(boughtDef);
        }
      } else {
        log("Скамейка полна!");
      }
    } else if (dragFrom.type === "item") {
      st.bench.push({ itemId: dragFrom.item.itemId, uid: dragFrom.item.uid, rotation: dragPayload.rotation || 0 });
      prepArcCelebrate = true;
    } else if (dragFrom.type === "container") {
      st.bench.push({
        itemId: dragFrom.container.itemId,
        uid: dragFrom.container.uid,
        rotation: dragPayload.rotation || 0,
        carriedItems: dragFrom.carriedItems,
        originCol: dragFrom.container.col,
        originRow: dragFrom.container.row,
      });
      prepArcCelebrate = true;
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
  } else if (!isContainerItem(dragPayload.itemId) && hasDropCell) {
    const col = dropCol;
    const row = dropRow;
    if (isSlotCell(st.containers, col, row) && tryGemSocketDrop(st, dragFrom, dragPayload, col, row, side)) {
      commitBenchDragEntry(dragFrom);
      // камень вставлен в сокет
    } else if (isSlotCell(st.containers, col, row)) {
      const excludeUid = isPrepLoadoutItemDrag() ? dragFrom.item.uid : null;
      const placement = resolveLoadoutPlacementDisplacing(
        st.containers,
        dragPayload.itemId,
        col,
        row,
        dragPayload.rotation || 0,
      );
      if (placement.valid) {
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
        if (st.bench.length + displaced.length > MAX_BENCH) {
          log("Скамейка полна!");
          if (isPrepLoadoutItemDrag()) {
            st.items = [...st.items, dragFrom.item];
            if (typeof notifyPrepPlacementRejected === "function") notifyPrepPlacementRejected(dragFrom.item);
          }
          restoreDraggedItem(side);
          clearDragUiState();
          renderBench();
          recalcSynergies();
          updateUI();
          return;
        }
        if (!slotOk) {
          if (isPrepLoadoutItemDrag()) {
            st.items = [...st.items, dragFrom.item];
            if (typeof notifyPrepPlacementRejected === "function") notifyPrepPlacementRejected(dragFrom.item);
          }
          restoreDraggedItem(side);
          clearDragUiState();
          renderBench();
          recalcSynergies();
          updateUI();
          return;
        }
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
          queueDisplaceToBenchAnimations(side, displacedItems, prepViewSide, (item) => {
            const benchState = getSideState(side);
            benchState.bench.push({
              itemId: item.itemId,
              uid: item.uid,
              rotation: item.rotation || 0,
            });
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
      } else if (isPrepLoadoutItemDrag()) {
        st.items = [...st.items, dragFrom.item];
        if (typeof notifyPrepPlacementRejected === "function") notifyPrepPlacementRejected(dragFrom.item);
      }
    } else if (isPrepLoadoutItemDrag()) {
      st.items = [...st.items, dragFrom.item];
      if (typeof notifyPrepPlacementRejected === "function") notifyPrepPlacementRejected(dragFrom.item);
    }
  } else if (isPrepLoadoutItemDrag()) {
    st.items = [...st.items, dragFrom.item];
    if (typeof notifyPrepPlacementRejected === "function") notifyPrepPlacementRejected(dragFrom.item);
  } else if (dragFrom.type === "container") {
    st.containers = [...st.containers, dragFrom.container];
    st.items = [...st.items, ...dragFrom.carriedItems];
    dragFrom.carriedItems?.forEach((item) => {
      if (typeof notifyPrepPlacementRejected === "function") notifyPrepPlacementRejected(item);
    });
  }

  if (dragFrom?.type === "bench" && dragFrom.benchEntry) {
    restoreBenchDragEntry(st, dragFrom);
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
  if (!dragPayload && !isPointerOverPrepSidebar(lastPointerClient.x, lastPointerClient.y)) {
    if (prepTooltipsEnabled && !isTouchUi()) {
      try { updateTooltip(mousePos.x, mousePos.y); } catch (err) { console.error("updateTooltip failed:", err); }
    } else if (prepTooltipsEnabled && typeof applyGamepadPrepFocusTooltip === "function" && lastGamepadPrepFocus) {
      applyGamepadPrepFocusTooltip(lastGamepadPrepFocus);
    }
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
  pendingCanvasPick = null;
  onMouseDown(createSyntheticPointerEvent(clientX, clientY));
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
  ensureLobby2pActiveHumanForSide(side);
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
    syncPrepDragBoardHover(e.clientX, e.clientY, e.clientX, e.clientY);
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
    syncPrepDragBoardHover(e.clientX, e.clientY, e.clientX, e.clientY);
  }
  syncDragGhostOverlay(lastPointerClient.x, lastPointerClient.y);
}
