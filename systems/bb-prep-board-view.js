/**
 * BB prep: поворот инвентаря 90° (широкий рюкзак).
 * Canvas bitmap — landscape (GRID_INNER_H × GRID_INNER_W), без zoom/crop.
 */

function getBBPrepGridInnerSize() {
  if (typeof getPrepGridInnerSize === "function") return getPrepGridInnerSize();
  return { w: 422, h: 328 };
}

function clearBBPrepBoardView() {
  /* zoom-state removed; kept for layout compat */
}

function applyBBPrepBoardTransform(ctx) {
  if (!ctx || typeof shouldUseBBPrepDrawRotate !== "function" || !shouldUseBBPrepDrawRotate()) {
    return false;
  }
  const canvasW = ctx.canvas?.width ?? 0;
  const canvasH = ctx.canvas?.height ?? 0;
  if (!canvasW || !canvasH) return false;

  const { w: gridW, h: gridH } = getBBPrepGridInnerSize();
  ctx.translate(canvasW / 2, canvasH / 2);
  ctx.rotate(Math.PI / 2);
  ctx.translate(-gridW / 2, -gridH / 2);
  return true;
}

function bbPrepBitmapPointFromClient(clientX, clientY, canvasEl) {
  const canvas = canvasEl || (typeof document !== "undefined" ? document.getElementById("game-canvas") : null);
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  const rw = rect.width > 0 ? rect.width : 1;
  const rh = rect.height > 0 ? rect.height : 1;
  return {
    x: (clientX - rect.left) / rw * canvas.width,
    y: (clientY - rect.top) / rh * canvas.height,
  };
}

/** Bitmap coords → logical grid coords (top-left origin). */
function bbPrepLogicalFromBitmap(bx, by, _view, canvasW, canvasH) {
  const { w: gridW, h: gridH } = getBBPrepGridInnerSize();
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  return {
    x: gridW / 2 - (by - cy),
    y: bx - cx + gridH / 2,
  };
}

/** Logical grid coords → viewport client coords. */
function bbPrepClientFromLogical(x, y, _view, canvasEl) {
  const canvas = canvasEl || (typeof document !== "undefined" ? document.getElementById("game-canvas") : null);
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const { w: gridW, h: gridH } = getBBPrepGridInnerSize();
  const canvasW = canvas.width;
  const canvasH = canvas.height;
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const bx = cx + y - gridH / 2;
  const by = cy + gridW / 2 - x;

  return {
    x: rect.left + (bx / canvasW) * rect.width,
    y: rect.top + (by / canvasH) * rect.height,
  };
}

if (typeof window !== "undefined") {
  window.clearBBPrepBoardView = clearBBPrepBoardView;
  window.applyBBPrepBoardTransform = applyBBPrepBoardTransform;
  window.bbPrepBitmapPointFromClient = bbPrepBitmapPointFromClient;
  window.bbPrepLogicalFromBitmap = bbPrepLogicalFromBitmap;
  window.bbPrepClientFromLogical = bbPrepClientFromLogical;
}
