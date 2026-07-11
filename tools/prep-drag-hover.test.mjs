/**
 * Prep drag: client-space hover под призраком (BB rotate).
 * node tools/prep-drag-hover.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadBoardView() {
  const sandbox = {
    console,
    Math,
    document: { getElementById: () => ({ width: 422, height: 328 }) },
    window: null,
    shouldUseBBPrepDrawRotate: () => true,
    shouldRotateBBPrepField90: () => true,
    getPrepGridInnerSize: () => ({ w: 422, h: 328 }),
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "systems/bb-prep-board-view.js"), "utf8"), ctx);
  return sandbox;
}

function buildPrepCoordSandbox() {
  const s = loadBoardView();
  const GRID_COLS = 3;
  const GRID_ROWS = 3;
  const GRID_CELL = 106;
  const GRID_CELL_GAP = 2;
  const GRID_STRIDE = GRID_CELL + GRID_CELL_GAP;

  const canvasEl = {
    width: 328,
    height: 422,
    getBoundingClientRect: () => ({
      left: 100,
      top: 200,
      width: 320,
      height: 248,
    }),
  };

  function cellRect(_team, col, row) {
    return {
      x: col * GRID_STRIDE,
      y: row * GRID_STRIDE,
      w: GRID_CELL,
      h: GRID_CELL,
    };
  }

  function canvasPointToClient(x, y) {
    return s.bbPrepClientFromLogical(x, y, null, canvasEl);
  }

  function boardCellClientCenter(col, row) {
    const rect = cellRect("player", col, row);
    return canvasPointToClient(rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  function findPrepBoardHoverCellFromClient(clientX, clientY) {
    const maxDist = GRID_STRIDE * 0.72;
    let bestCol = null;
    let bestRow = null;
    let bestDist = Infinity;
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const center = boardCellClientCenter(col, row);
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

  return {
    GRID_COLS,
    GRID_ROWS,
    GRID_STRIDE,
    boardCellClientCenter,
    findPrepBoardHoverCellFromClient,
  };
}

function run() {
  const s = buildPrepCoordSandbox();

  for (let row = 0; row < s.GRID_ROWS; row += 1) {
    for (let col = 0; col < s.GRID_COLS; col += 1) {
      const center = s.boardCellClientCenter(col, row);
      const hit = s.findPrepBoardHoverCellFromClient(center.x, center.y);
      assert(hit, `miss ${col},${row}`);
      assert(hit.col === col && hit.row === row, `cell ${col},${row} -> ${hit.col},${hit.row}`);
    }
  }

  const c00 = s.boardCellClientCenter(0, 0);
  const c20 = s.boardCellClientCenter(2, 0);
  const hitLeft = s.findPrepBoardHoverCellFromClient(c00.x, c00.y);
  const hitRight = s.findPrepBoardHoverCellFromClient(c20.x, c20.y);
  assert(hitLeft.col < hitRight.col, "mirror-x: col increases left→right");

  const shopAbove = { x: (c00.x + c20.x) / 2, y: Math.min(c00.y, c20.y) - 120 };
  assert(s.findPrepBoardHoverCellFromClient(shopAbove.x, shopAbove.y) == null,
    "ghost over shop must not produce board hover");

  console.log("prep-drag-hover.test.mjs: OK");
}

run();
