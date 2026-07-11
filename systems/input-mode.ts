/**
 * Автопереключение режима ввода: gamepad | touch | mouse | stylus.
 * Последний зафиксированный тип ввода определяет логику взаимодействия.
 *
 * stylus = Apple Pencil / Surface Pen: точный pointer (как мышь),
 * без fat-finger порогов и ghost-offset над пальцем.
 */
import type { InputMode } from "../types/game";

type InteractionModeListener = (mode: InputMode, prev: InputMode) => void;

let interactionMode: InputMode = "mouse";
const interactionModeListeners: InteractionModeListener[] = [];

function isTouchCapableDevice(): boolean {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

function isCoarsePointerOnly(): boolean {
  return (
    window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(pointer: fine)").matches
  );
}

function syncInteractionModeDataset(): void {
  document.documentElement.dataset.inputMode = interactionMode;
}

function initInteractionMode(): void {
  interactionMode = isCoarsePointerOnly() ? "touch" : "mouse";
  syncInteractionModeDataset();
}

function getInteractionMode(): InputMode {
  return interactionMode;
}

function isTouchInteraction(): boolean {
  return interactionMode === "touch";
}

function isMouseInteraction(): boolean {
  return interactionMode === "mouse";
}

function isStylusInteraction(): boolean {
  return interactionMode === "stylus";
}

function isGamepadInteraction(): boolean {
  return interactionMode === "gamepad";
}

/** Мышь или стилус — точный pointer (мелкий порог drag, click-buy, без finger-lift). */
function isPreciseInteraction(): boolean {
  return interactionMode === "mouse" || interactionMode === "stylus";
}

/** Палец — fat-finger UX (tap-tooltip, увеличенный порог, ghost над пальцем). */
function isFatFingerInteraction(): boolean {
  return interactionMode === "touch";
}

function onInteractionModeChange(listener: InteractionModeListener): void {
  if (typeof listener === "function") interactionModeListeners.push(listener);
}

function setInteractionMode(mode: InputMode): void {
  if (mode !== "gamepad" && mode !== "touch" && mode !== "mouse" && mode !== "stylus") return;
  if (mode === interactionMode) return;
  const prev = interactionMode;
  interactionMode = mode;
  syncInteractionModeDataset();
  for (const fn of interactionModeListeners) {
    try {
      fn(mode, prev);
    } catch {
      /* listener error */
    }
  }
}

function markTouchInteraction(): void {
  setInteractionMode("touch");
}

function markMouseInteraction(): void {
  setInteractionMode("mouse");
}

function markStylusInteraction(): void {
  setInteractionMode("stylus");
}

function markGamepadInteraction(): void {
  setInteractionMode("gamepad");
}
