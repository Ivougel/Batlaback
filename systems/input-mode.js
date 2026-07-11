// Transpiled from TypeScript — npm run compile:ts

/**
 * Автопереключение режима ввода: gamepad | touch | mouse | stylus.
 * stylus = точный pointer (Apple Pencil / Surface Pen).
 */
let interactionMode = "mouse";
const interactionModeListeners = [];
function isTouchCapableDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}
function isCoarsePointerOnly() {
  return window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(pointer: fine)").matches;
}
function syncInteractionModeDataset() {
  document.documentElement.dataset.inputMode = interactionMode;
}
function initInteractionMode() {
  interactionMode = isCoarsePointerOnly() ? "touch" : "mouse";
  syncInteractionModeDataset();
}
function getInteractionMode() {
  return interactionMode;
}
function isTouchInteraction() {
  return interactionMode === "touch";
}
function isMouseInteraction() {
  return interactionMode === "mouse";
}
function isStylusInteraction() {
  return interactionMode === "stylus";
}
function isGamepadInteraction() {
  return interactionMode === "gamepad";
}
function isPreciseInteraction() {
  return interactionMode === "mouse" || interactionMode === "stylus";
}
function isFatFingerInteraction() {
  return interactionMode === "touch";
}
function onInteractionModeChange(listener) {
  if (typeof listener === "function") interactionModeListeners.push(listener);
}
function setInteractionMode(mode) {
  if (mode !== "gamepad" && mode !== "touch" && mode !== "mouse" && mode !== "stylus") return;
  if (mode === interactionMode) return;
  const prev = interactionMode;
  interactionMode = mode;
  syncInteractionModeDataset();
  for (const fn of interactionModeListeners) {
    try {
      fn(mode, prev);
    } catch {
    }
  }
}
function markTouchInteraction() {
  setInteractionMode("touch");
}
function markMouseInteraction() {
  setInteractionMode("mouse");
}
function markStylusInteraction() {
  setInteractionMode("stylus");
}
function markGamepadInteraction() {
  setInteractionMode("gamepad");
}
