/**
 * finishDragDrop должен commit-ить getPrepDropPlacement как есть.
 * node tools/prep-drag-drop.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const src = fs.readFileSync(path.join(ROOT, "prep-drag.js"), "utf8");

assert(
  src.includes("boardPlacement?.kind === \"item\""),
  "finishDragDrop must branch on boardPlacement kind=item",
);
assert(
  !src.match(/boardPlacement\?\.kind === "item"[\s\S]{0,1200}resolveLoadoutPlacementDisplacing\(/),
  "finishDragDrop must not re-resolve placement after boardPlacement",
);
assert(
  src.includes("const placement = boardPlacement"),
  "finishDragDrop must commit boardPlacement directly",
);

console.log("prep-drag-drop.test.mjs: OK");
