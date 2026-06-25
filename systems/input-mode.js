/**
 * Автопереключение режима ввода: gamepad | touch | mouse.
 * Последний зафиксированный тип ввода определяет логику взаимодействия.
 */

let interactionMode = "mouse";
const interactionModeListeners = [];

function isTouchCapableDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

function isCoarsePointerOnly() {
  return window.matchMedia("(pointer: coarse)").matches
    && !window.matchMedia("(pointer: fine)").matches;
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

function isGamepadInteraction() {
  return interactionMode === "gamepad";
}

function onInteractionModeChange(listener) {
  if (typeof listener === "function") interactionModeListeners.push(listener);
}

function setInteractionMode(mode) {
  if (mode !== "gamepad" && mode !== "touch" && mode !== "mouse") return;
  if (mode === interactionMode) return;
  const prev = interactionMode;
  interactionMode = mode;
  syncInteractionModeDataset();
  interactionModeListeners.forEach((fn) => {
    try {
      fn(mode, prev);
    } catch (_) {}
  });
}

function markTouchInteraction() {
  setInteractionMode("touch");
}

function markMouseInteraction() {
  setInteractionMode("mouse");
}

function markGamepadInteraction() {
  setInteractionMode("gamepad");
}
