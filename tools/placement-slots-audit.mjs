/**
 * Аудит слотов ⭐: пересечение с формой, стороны, дубли с синергиями.
 * node tools/placement-slots-audit.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadSandbox() {
  const sandbox = {
    console,
    Math,
    Object,
    Array,
    Map,
    Set,
    JSON,
    CRAFT_OUTPUT_IDS: new Set(),
    isCraftOutputItemId: () => false,
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  [
    "items.js",
    "items-catalog.js",
    "backpack-engine.js",
    "systems/placement-slots.js",
    "systems/placement-slots-catalog.js",
  ].forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), ctx);
  });
  vm.runInContext("globalThis.ITEM_CATALOG = ITEM_CATALOG;", ctx);
  return sandbox;
}

function shapeCells(shape, rotation = 0) {
  const rotated = sandboxRotate(shape, rotation);
  return new Set(rotated.map(([x, y]) => `${x},${y}`));
}

function sandboxRotate(shape, times) {
  let cells = shape.map(([x, y]) => [x, y]);
  const t = ((times % 4) + 4) % 4;
  for (let i = 0; i < t; i++) {
    cells = cells.map(([x, y]) => [y, -x]);
    const minX = Math.min(...cells.map(([x]) => x));
    const minY = Math.min(...cells.map(([, y]) => y));
    cells = cells.map(([x, y]) => [x - minX, y - minY]);
  }
  return cells;
}

function slotOverlapsShape(shape, at, rotation) {
  const body = shapeCells(shape, rotation);
  let [dx, dy] = at;
  const t = ((rotation % 4) + 4) % 4;
  for (let i = 0; i < t; i += 1) {
    [dx, dy] = [dy, -dx];
  }
  return body.has(`${dx},${dy}`);
}

function adjacentOutsideCells(shape) {
  const body = shapeCells(shape, 0);
  const offsets = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];
  const out = [];
  body.forEach((key) => {
    const [bx, by] = key.split(",").map(Number);
    offsets.forEach(([dx, dy]) => {
      const ax = bx + dx;
      const ay = by + dy;
      const k = `${ax},${ay}`;
      if (!body.has(k)) out.push([ax, ay]);
    });
  });
  const uniq = new Map();
  out.forEach(([x, y]) => {
    uniq.set(`${x},${y}`, [x, y]);
  });
  return [...uniq.values()];
}

function suggestSlotAt(shape) {
  const prefs = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [2, 0],
    [1, 1],
  ];
  const outside = new Set(adjacentOutsideCells(shape).map(([x, y]) => `${x},${y}`));
  for (const p of prefs) {
    if (outside.has(`${p[0]},${p[1]}`)) return p;
  }
  return adjacentOutsideCells(shape)[0] || [1, 0];
}

const s = loadSandbox();
const defs = s.PLACEMENT_SLOT_DEFS;
let issues = 0;

console.log("=== Аудит placement slots ===\n");

Object.entries(defs).forEach(([itemId, slots]) => {
  const def = s.ITEM_CATALOG[itemId];
  if (!def) {
    console.log(`⚠ ${itemId}: нет в каталоге (skip)`);
    return;
  }
  const shape = def.shape || [[0, 0]];

  slots.forEach((slot) => {
    const rotations = [0, 1, 2, 3];
    const overlapRots = rotations.filter((r) => slotOverlapsShape(shape, slot.at, r));
    const suggested = suggestSlotAt(shape);

    if (overlapRots.length) {
      console.log(
        `❌ ${itemId} slot ${slot.id}: at ${JSON.stringify(slot.at)} перекрывает форму при rot ${overlapRots.join(",")}`,
      );
      console.log(`   shape ${JSON.stringify(shape)} → лучше at ${JSON.stringify(suggested)}`);
      issues += 1;
    } else {
      console.log(`✓ ${itemId}: at ${JSON.stringify(slot.at)} ок на всех поворотах`);
    }
  });
});

console.log(`\nИтого проблем: ${issues}`);
if (issues > 0) process.exitCode = 1;
