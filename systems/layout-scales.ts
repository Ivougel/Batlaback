/**
 * Единый доступ к масштабам UI (ui-layout задаёт CSS-переменные на resize).
 */
const LayoutScales = (() => {
  function readCssPx(name: string, fallback = 1): number {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function uiScale(): number {
    return readCssPx("--ui-scale", 1);
  }

  function gameScale(): number {
    return readCssPx("--game-scale", uiScale());
  }

  function lobbyRosterEmojiSize(): number {
    return readCssPx("--lobby-roster-emoji-size", Math.round(20 * uiScale()));
  }

  function typeScale(): number {
    return readCssPx("--type-scale", 1);
  }

  /** rem → px от текущего корня (--font-root). */
  function typePx(remSize: number): number {
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return Math.round(root * remSize);
  }

  /** Базовый px × --game-scale (эмодзи, FX, иконки боя). */
  function gamePx(basePx: number): number {
    return Math.round(basePx * gameScale());
  }

  function uiSurface(): string {
    return document.documentElement.dataset.uiSurface || "default";
  }

  function isUiSurface(name: string): boolean {
    return uiSurface() === name;
  }

  function isTabletSide(): boolean {
    return isUiSurface("tablet-side");
  }

  /** Профильный множитель летящих чисел / FX (tokens.css + tablet-landscape-side в ui-layout). */
  function fxFloatScale(): number {
    return readCssPx("--fx-float-scale", 1);
  }

  function fxProjectileScale(): number {
    return readCssPx("--fx-projectile-scale", fxFloatScale());
  }

  /** game-scale × fx-float-scale для траекторий боя. */
  function battleFxScale(): number {
    return gameScale() * fxFloatScale();
  }

  function battleFxPx(basePx: number): number {
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
