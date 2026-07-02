/**
 * Единый доступ к масштабам UI (ui-layout задаёт CSS-переменные на resize).
 */
const LayoutScales = (() => {
  function readCssPx(name, fallback = 1) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function uiScale() {
    return readCssPx("--ui-scale", 1);
  }

  function gameScale() {
    return readCssPx("--game-scale", uiScale());
  }

  function lobbyRosterEmojiSize() {
    return readCssPx("--lobby-roster-emoji-size", Math.round(20 * uiScale()));
  }

  function typeScale() {
    return readCssPx("--type-scale", 1);
  }

  /** rem → px от текущего корня (--font-root). */
  function typePx(remSize) {
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return Math.round(root * remSize);
  }

  /** Базовый px × --game-scale (эмодзи, FX, иконки боя). */
  function gamePx(basePx) {
    return Math.round(basePx * gameScale());
  }

  function uiSurface() {
    return document.documentElement.dataset.uiSurface || "default";
  }

  function isUiSurface(name) {
    return uiSurface() === name;
  }

  function isTabletSide() {
    return isUiSurface("tablet-side");
  }

  /** Профильный множитель летящих чисел / FX (ui-layout BATTLE_PROFILES). */
  function fxFloatScale() {
    return readCssPx("--fx-float-scale", 1);
  }

  function fxProjectileScale() {
    return readCssPx("--fx-projectile-scale", fxFloatScale());
  }

  /** game-scale × fx-float-scale для траекторий боя. */
  function battleFxScale() {
    return gameScale() * fxFloatScale();
  }

  function battleFxPx(basePx) {
    return Math.round(basePx * battleFxScale());
  }

  return {
    readCssPx,
    uiScale,
    gameScale,
    lobbyRosterEmojiSize,
    typeScale,
    typePx,
    gamePx,
    fxFloatScale,
    fxProjectileScale,
    battleFxScale,
    battleFxPx,
    uiSurface,
    isUiSurface,
    isTabletSide,
  };
})();

window.LayoutScales = LayoutScales;
window.readGameScale = () => LayoutScales.gameScale();
window.isTabletSideLayout = () => LayoutScales.isTabletSide();
