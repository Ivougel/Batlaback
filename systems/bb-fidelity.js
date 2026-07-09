/**
 * BB Fidelity — переключатель UX classic / versus под оригинальный Backpack Battles.
 */
const BB_FIDELITY_MODES = new Set(["classic", "versus"]);

function getBBFidelityMode() {
  const mode = typeof gameMode !== "undefined" && gameMode
    ? gameMode
    : (typeof selectedGameMode !== "undefined" ? selectedGameMode : null);
  if (mode) {
    return BB_FIDELITY_MODES.has(mode) ? mode : null;
  }
  const attr = typeof document !== "undefined"
    ? document.documentElement?.dataset?.bbFidelity
    : null;
  return attr && BB_FIDELITY_MODES.has(attr) ? attr : null;
}

function isBBFidelityMode() {
  return !!getBBFidelityMode();
}

function isBBFidelityClassic() {
  return getBBFidelityMode() === "classic";
}

function isBBFidelityVersus() {
  return getBBFidelityMode() === "versus";
}

/** Синергии в магазине и нити — для classic/versus в первую очередь, но полезно везде в prep. */
function shouldShowPrepSynergyCommerceFx() {
  if (typeof phase !== "undefined" && phase !== "prep") return false;
  return isBBFidelityMode()
    || (typeof isClassicMode === "function" && isClassicMode())
    || (typeof gameMode !== "undefined" && gameMode === "versus");
}

function syncBBFidelityContext() {
  const root = typeof document !== "undefined" ? document.documentElement : null;
  if (!root) return;
  const fidelity = getBBFidelityMode();
  if (fidelity) {
    root.dataset.bbFidelity = fidelity;
  } else {
    delete root.dataset.bbFidelity;
  }
  syncBBFidelityBattleLayout();
}

/** BB classic/versus: вертикальный стек prep (шапка → магазин → инвентарь → хранилище). */
function shouldUseBBStackPrepLayout() {
  const appPhase = typeof document !== "undefined"
    ? document.getElementById("app")?.dataset?.phase
    : null;
  if (appPhase !== "prep") return false;
  return isBBFidelityMode();
}

/** BB classic/versus: полноэкранный VS перед боем вместо 3-2-1. */
function shouldUseBBVsScreen() {
  const getAppPhase = typeof document !== "undefined"
    && typeof document.getElementById === "function"
    ? document.getElementById("app")?.dataset?.phase
    : null;
  const appPhase = getAppPhase || (typeof phase !== "undefined" ? phase : null);
  if (appPhase !== "prep") return false;
  return isBBFidelityMode();
}

/** BB classic/versus: бой — две сетки вертикально, HP/stamina по центру. */
function shouldUseBBStackBattleLayout() {
  if (!isBBFidelityMode()) return false;
  const getAppPhase = typeof document !== "undefined"
    && typeof document.getElementById === "function"
    ? document.getElementById("app")?.dataset?.phase
    : null;
  const appPhase = getAppPhase || (typeof phase !== "undefined" ? phase : null);
  return appPhase === "battle" || appPhase === "replay";
}

function syncBBFidelityBattleLayout() {
  const root = typeof document !== "undefined" ? document.documentElement : null;
  if (!root) return;
  if (shouldUseBBStackBattleLayout()) {
    root.dataset.battleLayout = "bb-stack";
  } else {
    delete root.dataset.battleLayout;
  }
}

window.shouldUseBBStackPrepLayout = shouldUseBBStackPrepLayout;
window.shouldUseBBVsScreen = shouldUseBBVsScreen;
window.shouldUseBBStackBattleLayout = shouldUseBBStackBattleLayout;
window.syncBBFidelityBattleLayout = syncBBFidelityBattleLayout;

window.getBBFidelityMode = getBBFidelityMode;
window.isBBFidelityMode = isBBFidelityMode;
window.isBBFidelityClassic = isBBFidelityClassic;
window.isBBFidelityVersus = isBBFidelityVersus;
window.shouldShowPrepSynergyCommerceFx = shouldShowPrepSynergyCommerceFx;
window.syncBBFidelityContext = syncBBFidelityContext;
