/**
 * Sweep prep-drag hover mapping (desktop BB stack).
 * node tools/debug-prep-drag-sweep.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baseUrl = `file://${root}/index.html`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => typeof startRunFromOverlay === "function");
await page.evaluate(async () => {
  selectPlayerClass("warrior");
  selectPlayerClass("warrior");
  await startRunFromOverlay();
});
await page.waitForSelector('#app[data-phase="prep"]', { timeout: 15000 });
await page.waitForTimeout(900);
await page.evaluate(() => {
  window.applyUiLayout?.();
  window.scheduleCanvasFit?.();
});
await page.waitForTimeout(400);

const report = await page.evaluate(async () => {
  ensureShopReady();
  renderShop();
  const card = document.querySelector("#shop-slots .shop-card:not(.empty)");
  const canvas = document.getElementById("game-canvas");
  const col = document.getElementById("prep-field-column");
  if (!card || !canvas) return { error: "missing elements" };

  const start = card.getBoundingClientRect();
  card.dispatchEvent(new MouseEvent("mousedown", {
    bubbles: true, cancelable: true,
    clientX: start.left + start.width / 2,
    clientY: start.top + start.height / 2,
    buttons: 1,
  }));

  const canvasRect = canvas.getBoundingClientRect();
  const colRect = col?.getBoundingClientRect();
  const points = [];
  const grid = [
    [0.1, 0.05], [0.5, 0.05], [0.9, 0.05],
    [0.1, 0.25], [0.5, 0.25], [0.9, 0.25],
    [0.1, 0.5], [0.5, 0.5], [0.9, 0.5],
    [0.1, 0.85], [0.5, 0.85], [0.9, 0.85],
  ];

  if (colRect) {
    grid.push(
      [null, colRect.top + 8],
      [null, colRect.top + colRect.height * 0.35],
    );
  }

  for (const pt of grid) {
    let clientX;
    let clientY;
    if (pt[0] == null) {
      clientX = canvasRect.left + canvasRect.width * 0.5;
      clientY = pt[1];
    } else {
      clientX = canvasRect.left + canvasRect.width * pt[0];
      clientY = canvasRect.top + canvasRect.height * pt[1];
    }

    for (let i = 0; i < 6; i += 1) {
      document.dispatchEvent(new MouseEvent("mousemove", {
        bubbles: true, cancelable: true, clientX, clientY, buttons: 1,
      }));
      await new Promise((r) => requestAnimationFrame(r));
    }

    const ghost = getPrepDragGhostClientPos(clientX, clientY);
    const hover = findPrepBoardHoverCellFromGhostClient(ghost.x, ghost.y, prepViewSide);
    const shadow = getPrepDragShadowPlacement(getLoadoutEditState(prepViewSide), prepViewSide);
    const logical = canvasCoordsFromClient(ghost.x, ghost.y);
    const onBoard = isOnBoard(logical.x, logical.y, prepViewSide);
    let cellCenter = null;
    let dist = null;
    if (hover) {
      cellCenter = boardCellClientCenter(hover.col, hover.row, prepViewSide);
      dist = Math.hypot(cellCenter.x - ghost.x, cellCenter.y - ghost.y);
    }

    points.push({
      clientX: Math.round(clientX),
      clientY: Math.round(clientY),
      ghost: { x: Math.round(ghost.x), y: Math.round(ghost.y) },
      hover,
      shadow: shadow ? { col: shadow.col, row: shadow.row } : null,
      onBoard,
      logical: { x: Math.round(logical.x), y: Math.round(logical.y) },
      dist: dist != null ? Math.round(dist) : null,
      ghostInCanvas: isClientPointInsideCanvas(ghost.x, ghost.y),
    });
  }

  document.dispatchEvent(new MouseEvent("mouseup", {
    bubbles: true, cancelable: true,
    clientX: canvasRect.left + canvasRect.width * 0.5,
    clientY: canvasRect.top + canvasRect.height * 0.5,
    buttons: 0,
  }));

  return {
    prepLayout: document.documentElement.dataset.prepLayout,
    canvasRect: {
      w: Math.round(canvasRect.width),
      h: Math.round(canvasRect.height),
      t: Math.round(canvasRect.top),
    },
    cols: getActiveGridCols(),
    rows: getActiveGridRows(),
    points,
  };
});

console.log(JSON.stringify(report, null, 2));
await page.screenshot({ path: "tools/debug-prep-drag-sweep.png", fullPage: false });
await browser.close();
