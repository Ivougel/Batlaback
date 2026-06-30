/**
 * Единый якорь эмодзи-аватара героя (ThoughtArena + ArenaEquipment + ui-layout).
 */

const BattleHeroAnchor = (() => {
  function viewportMin() {
    const vv = window.visualViewport;
    return Math.min(vv?.width ?? window.innerWidth, vv?.height ?? window.innerHeight);
  }

  function isFlankArenaBattle() {
    const app = document.getElementById("app");
    const phase = app?.dataset?.phase;
    return document.documentElement.dataset.battleHeroPlacement === "flank-arena"
      && document.documentElement.dataset.battleArenaLayout === "true"
      && (phase === "battle" || phase === "replay");
  }

  function thoughtSlotSize(vmin = viewportMin()) {
    return Math.round(Math.min(112, Math.max(68, vmin * 0.12)));
  }

  function getThoughtSlotEl(side) {
    return document.getElementById(side === "enemy" ? "enemy-thought-slot" : "player-thought-slot");
  }

  function getAvatarAnchorRect(side) {
    const avatarSlotId = side === "enemy" ? "enemy-avatar-slot" : "player-avatar-slot";
    const avatarSlot = document.getElementById(avatarSlotId);
    if (!avatarSlot) return null;

    const shell = avatarSlot.querySelector(".avatar-hero-shell");
    const anchor = shell?.querySelector(".avatar-hero-stage")
      || shell?.querySelector(".profile-avatar")
      || shell
      || avatarSlot;
    const ar = anchor.getBoundingClientRect();
    if (ar.width <= 4 || ar.height <= 4) return null;
    return ar;
  }

  /** Центр слота эмодзи-аватара в viewport (px). */
  function getThoughtSlotCenter(side) {
    const slot = getThoughtSlotEl(side);
    const sr = slot?.getBoundingClientRect();
    if (sr && sr.width > 4 && sr.height > 4) {
      return {
        x: sr.left + sr.width / 2,
        y: sr.top + sr.height / 2,
        size: sr.width,
      };
    }

    const ar = getAvatarAnchorRect(side);
    if (!ar) return null;

    const size = thoughtSlotSize();
    const cx = ar.left + ar.width / 2;
    const top = ar.top - size * 0.42;
    return {
      x: cx,
      y: Math.max(4 + size / 2, top + size / 2),
      size,
    };
  }

  function getFoeThoughtCenter(side) {
    const foe = side === "player" ? "enemy" : "player";
    const c = getThoughtSlotCenter(foe);
    return c ? { x: c.x, y: c.y } : null;
  }

  return {
    viewportMin,
    isFlankArenaBattle,
    thoughtSlotSize,
    getThoughtSlotEl,
    getAvatarAnchorRect,
    getThoughtSlotCenter,
    getFoeThoughtCenter,
  };
})();

if (typeof window !== "undefined") {
  window.BattleHeroAnchor = BattleHeroAnchor;
}
