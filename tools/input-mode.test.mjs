/**
 * Smoke: input modes include stylus as precise pointer.
 * node tools/input-mode.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sandbox = {
  console,
  window: {
    matchMedia: (q) => ({
      matches: String(q).includes("pointer: fine"),
    }),
  },
  navigator: { maxTouchPoints: 5 },
  document: {
    documentElement: { dataset: {} },
  },
};
sandbox.window.navigator = sandbox.navigator;
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "systems/input-mode.js"), "utf8"), sandbox);

assert(typeof sandbox.initInteractionMode === "function", "initInteractionMode");
sandbox.initInteractionMode();
assert(sandbox.getInteractionMode() === "mouse", "fine pointer starts as mouse");

sandbox.markTouchInteraction();
assert(sandbox.isTouchInteraction(), "touch mode");
assert(sandbox.isFatFingerInteraction(), "touch is fat finger");
assert(!sandbox.isPreciseInteraction(), "touch not precise");

sandbox.markStylusInteraction();
assert(sandbox.isStylusInteraction(), "stylus mode");
assert(sandbox.isPreciseInteraction(), "stylus is precise");
assert(!sandbox.isFatFingerInteraction(), "stylus not fat finger");
assert(sandbox.document.documentElement.dataset.inputMode === "stylus", "dataset");

sandbox.markMouseInteraction();
assert(sandbox.isMouseInteraction() && sandbox.isPreciseInteraction(), "mouse precise");

console.log("input-mode.test.mjs: OK");
