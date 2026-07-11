/**
 * BB Fidelity — переключатель UX classic / versus под оригинальный Backpack Battles.
 */
const BB_FIDELITY_MODES = new Set(["classic", "hotseat"]);
const BB_RUN_LIVES_MAX = 4;
const BB_STORAGE_MAX_ITEMS = 18;

function isBBIntroShellStep() {
  if (typeof document === "undefined" || typeof document.getElementById !== "function") {
    return false;
  }
  return isClassIntroOverlayOpen();
}

function isClassIntroOverlayOpen() {
  if (typeof document === "undefined" || typeof document.getElementById !== "function") {
    return false;
  }
  const overlay = document.getElementById("class-overlay");
  return !!(overlay && !overlay.classList.contains("hidden"));
}

function getBBFidelityMode() {
  // На шаге выбора режима / кампании — обычный intro, без BB-контекста.
  if (isClassIntroOverlayOpen() && !isBBIntroShellStep()) {
    return null;
  }

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
  const mode = getBBFidelityMode();
  return mode === "hotseat" || mode === "versus";
}

function getBBRunLivesMax() {
  return BB_RUN_LIVES_MAX;
}

/** Classic BB: 4 жизни забега, −1 за поражение. */
function shouldUseBBRunLives() {
  return isBBFidelityClassic();
}

/** Classic/versus: fullscreen итог раунда вместо glass-модалки. */
function shouldUseBBRoundResultScreen() {
  return isBBFidelityMode();
}

/** Classic/versus: fullscreen конец забега вместо glass-модалки. */
function shouldUseBBRunCompleteScreen() {
  return isBBFidelityMode();
}

/** Classic/versus: intro в стиле BB (портрет, пергамент, зелёный CTA). */
function shouldUseBBIntroLayout() {
  const overlay = typeof document !== "undefined"
    ? document.getElementById("class-overlay")
    : null;
  if (!overlay || overlay.classList.contains("hidden")) return false;
  if (!isBBFidelityMode()) return false;
  return isBBIntroShellStep();
}

/** Classic + versus BB: без шага спутника. */
function shouldSkipBBCompanionIntro() {
  return isBBFidelityMode();
}

/** Hotseat: поочерёдный prep (pass-and-play). */
function shouldUseBBVersusTurnFlow() {
  return typeof isHotseatMode === "function" ? isHotseatMode() : getBBFidelityMode() === "hotseat";
}

function syncBBIntroContext() {
  const root = typeof document !== "undefined" ? document.documentElement : null;
  const overlay = typeof document !== "undefined"
    ? document.getElementById("class-overlay")
    : null;
  if (!root || !overlay) return;
  const active = shouldUseBBIntroLayout();
  if (active) {
    root.dataset.bbIntro = getBBFidelityMode() || "classic";
    overlay.classList.add("bb-intro-layout");
  } else {
    delete root.dataset.bbIntro;
    overlay.classList.remove("bb-intro-layout");
  }
}

/** Подсветка pending-крафта на поле в classic/versus. */
function shouldShowIdlePrepBoardHighlights() {
  if (typeof phase !== "undefined" && phase !== "prep") return false;
  return typeof shouldShowPrepCraftCommerceFx === "function" && shouldShowPrepCraftCommerceFx();
}

/** Подсветка синергий на столе / в магазине / SVG-нити — отключена. */
function shouldShowPrepSynergyCommerceFx() {
  return false;
}

/** BB prep stack: поле без поворота (portrait-сетка, как до эксперимента с rotate). */
function shouldRotateBBPrepField90() {
  return false;
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
  syncBBIntroContext();
  if (typeof syncPrepWikiButton === "function") syncPrepWikiButton();
}

/** BB classic/versus: физическое хранилище вместо 6 слотов скамейки. */
function shouldUsePrepStoragePhysics() {
  return shouldUseBBStackPrepLayout();
}

function getBenchMaxCapacity() {
  if (shouldUsePrepStoragePhysics()) return BB_STORAGE_MAX_ITEMS;
  return typeof MAX_BENCH !== "undefined" ? MAX_BENCH : 6;
}

function canFitOnBench(st, add = 1) {
  const count = st?.bench?.length ?? 0;
  return count + add <= getBenchMaxCapacity();
}

/** BB classic/versus: вертикальный стек prep (шапка → магазин → инвентарь → хранилище). */
function shouldUseBBStackPrepLayout() {
  const appPhase = typeof document !== "undefined"
    ? document.getElementById("app")?.dataset?.phase
    : null;
  if (appPhase !== "prep") return false;
  if (!isBBFidelityMode()) return false;
  if (typeof window === "undefined") return true;
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Мышь / трекпад (fine pointer): desktop/laptop → side prep по LAYOUT.md,
  // не телефонная колонка 480px. Touch/coarse (phone, Y700, iPad) оставляем bb-stack.
  try {
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (fine && w > h && Math.min(w, h) >= 700) return false;
  } catch (_) { /* ignore */ }
  return true;
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

window.BB_RUN_LIVES_MAX = BB_RUN_LIVES_MAX;
window.getBBRunLivesMax = getBBRunLivesMax;
window.shouldUseBBRunLives = shouldUseBBRunLives;
window.shouldUseBBRoundResultScreen = shouldUseBBRoundResultScreen;
window.shouldUseBBRunCompleteScreen = shouldUseBBRunCompleteScreen;
window.isBBIntroShellStep = isBBIntroShellStep;
window.shouldUseBBIntroLayout = shouldUseBBIntroLayout;
window.shouldSkipBBCompanionIntro = shouldSkipBBCompanionIntro;
window.shouldUseBBVersusTurnFlow = shouldUseBBVersusTurnFlow;
window.syncBBIntroContext = syncBBIntroContext;
window.BB_STORAGE_MAX_ITEMS = BB_STORAGE_MAX_ITEMS;
window.shouldUsePrepStoragePhysics = shouldUsePrepStoragePhysics;
window.getBenchMaxCapacity = getBenchMaxCapacity;
window.canFitOnBench = canFitOnBench;
window.shouldUseBBStackPrepLayout = shouldUseBBStackPrepLayout;
window.shouldUseBBVsScreen = shouldUseBBVsScreen;
window.shouldUseBBStackBattleLayout = shouldUseBBStackBattleLayout;
window.syncBBFidelityBattleLayout = syncBBFidelityBattleLayout;

window.getBBFidelityMode = getBBFidelityMode;
window.isBBFidelityMode = isBBFidelityMode;
window.isBBFidelityClassic = isBBFidelityClassic;
window.isBBFidelityVersus = isBBFidelityVersus;
window.shouldShowIdlePrepBoardHighlights = shouldShowIdlePrepBoardHighlights;
window.shouldShowPrepSynergyCommerceFx = shouldShowPrepSynergyCommerceFx;
window.shouldRotateBBPrepField90 = shouldRotateBBPrepField90;
window.syncBBFidelityContext = syncBBFidelityContext;
