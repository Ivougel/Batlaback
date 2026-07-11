/**
 * PrepDragArc — лёгкий трекер prep-drag (без дуги).
 * API сохранён для совместимости с prep-drag.js / game.js.
 */

const PrepDragArc = (() => {
  let active = false;
  let celebrating = false;
  let ghostOriginalParent = null;

  function getOffsetY() {
    if (typeof uiCm === "function") return uiCm(2);
    if (typeof uiPx === "function") return uiPx(2 * (96 / 2.54));
    return 2 * (96 / 2.54);
  }

  function resolveGhostPosition(clientX, clientY) {
    const oy = getOffsetY();
    return { x: clientX, y: clientY - oy, rotation: 0 };
  }

  function begin() {
    active = true;
    celebrating = false;
  }

  function end() {
    active = false;
    celebrating = false;
    restoreGhostParent();
  }

  function celebrate() {
    celebrating = true;
    if (typeof playGameSfx === "function") playGameSfx("arc_celebrate");
    window.setTimeout(() => {
      celebrating = false;
      end();
    }, 120);
  }

  function isActive() {
    return active;
  }

  function isCelebrating() {
    return celebrating;
  }

  function sync() {}

  function syncHoverCell() {}

  function pushTrailPoint() {}

  function mountGhostToBody() {
    const el = typeof getDragGhostCanvas === "function" ? getDragGhostCanvas() : null;
    if (!el || el.parentElement === document.body) return;
    ghostOriginalParent = el.parentElement;
    document.body.appendChild(el);
  }

  function restoreGhostParent() {
    const el = typeof getDragGhostCanvas === "function" ? getDragGhostCanvas() : null;
    if (!el || !ghostOriginalParent) return;
    if (el.parentElement === document.body) ghostOriginalParent.appendChild(el);
    ghostOriginalParent = null;
  }

  return {
    begin,
    sync,
    end,
    celebrate,
    isActive,
    isCelebrating,
    resolveGhostPosition,
    pushTrailPoint,
    mountGhostToBody,
    syncHoverCell,
    getGhostRotation: () => 0,
  };
})();

if (typeof window !== "undefined") {
  window.PrepDragArc = PrepDragArc;
}
