/**
 * BB prep board viewport — rotate + coords.
 * node tools/bb-prep-board.test.mjs
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

function run() {
  const s = loadBoardView();

  const canvasW = 328;
  const canvasH = 422;
  const gridW = 422;
  const gridH = 328;
  const cx = canvasW / 2;
  const cy = canvasH / 2;

  const samples = [
    [gridW / 2, gridH / 2],
    [0, 0],
    [gridW - 1, gridH - 1],
    [2, 3],
    [4, 5],
  ];

  const canvasEl = {
    width: canvasW,
    height: canvasH,
    getBoundingClientRect: () => ({
      left: 50,
      top: 100,
      width: 320,
      height: 248,
    }),
  };

  samples.forEach(([lx, ly]) => {
    const client = s.bbPrepClientFromLogical(lx, ly, null, canvasEl);
    assert(client, "client point");
    const bp = s.bbPrepBitmapPointFromClient(client.x, client.y, canvasEl);
    const back = s.bbPrepLogicalFromBitmap(bp.x, bp.y, null, canvasW, canvasH);
    assert(Math.abs(back.x - lx) < 1.5, `roundtrip x ${lx} -> ${back.x}`);
    assert(Math.abs(back.y - ly) < 1.5, `roundtrip y ${ly} -> ${back.y}`);
  });

  const center = s.bbPrepLogicalFromBitmap(cx, cy, null, canvasW, canvasH);
  assert(Math.abs(center.x - gridW / 2) < 0.01, "center x");
  assert(Math.abs(center.y - gridH / 2) < 0.01, "center y");

  console.log("bb-prep-board.test.mjs: OK");
}

run();
