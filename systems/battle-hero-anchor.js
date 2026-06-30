/**
 * Единый якорь эмодзи-аватара героя (ThoughtArena + ArenaEquipment + ui-layout).
 */

const BattleHeroAnchor = (() => {
  /** Нормированные позиции слотов внутри combat floor (#battle-thought-arena). */
  const COMBAT_FLOOR_ANCHOR = {
    player: { x: 0.20, y: 0.40 },
    enemy: { x: 0.80, y: 0.40 },
  };

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

  /** Боевой пол (дуэль) — нижняя полоса под портретами, на всех tier. */
  function usesCombatFloorAnchors() {
    return isFlankArenaBattle();
  }

  /** @deprecated alias */
  function shouldAnchorThoughtBelowHero() {
    return usesCombatFloorAnchors();
  }

  function getBattleHudEl(side) {
    return document.getElementById(side === "enemy" ? "battle-hud-enemy" : "battle-hud-player");
  }

  function getCombatFloorEl() {
    return document.getElementById("battle-thought-arena");
  }

  function getCombatFloorRect() {
    const r = getCombatFloorEl()?.getBoundingClientRect();
    if (r && r.width > 8 && r.height > 8) return r;
    return null;
  }

  function thoughtSlotGapPx() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--ui-scale").trim();
    const scale = Number.parseFloat(raw) || 1;
    return Math.round(6 * scale);
  }

  function readCssPx(name, fallback = 0) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function thoughtSlotEmojiSize(vmin = viewportMin()) {
    const floor = getCombatFloorRect();
    const fromFloor = floor ? Math.round(floor.height * 0.68) : 0;
    const fromVmin = Math.round(vmin * 0.19);
    return Math.round(Math.min(172, Math.max(100, Math.max(fromFloor, fromVmin))));
  }

  function thoughtSlotHaloPx(emojiSize = thoughtSlotEmojiSize()) {
    return Math.round(emojiSize * 0.36);
  }

  /** Размер контейнера слота (эмодзи + орбита спутников). */
  function thoughtSlotSize(vmin = viewportMin()) {
    const emoji = thoughtSlotEmojiSize(vmin);
    return emoji + thoughtSlotHaloPx(emoji) * 2;
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

  function getHeroColumnCenterX(side) {
    const ar = getAvatarAnchorRect(side);
    if (ar) return ar.left + ar.width / 2;

    const panelId = side === "enemy" ? "enemy-avatar-panel" : "player-avatar-panel";
    const panelRect = document.getElementById(panelId)?.getBoundingClientRect();
    if (panelRect && panelRect.width > 8) {
      return panelRect.left + panelRect.width / 2;
    }

    const zoneLeftVar = side === "enemy" ? "--battle-enemy-zone-left" : "--battle-player-zone-left";
    const zoneWidthVar = side === "enemy" ? "--battle-enemy-zone-width" : "--battle-player-zone-width";
    const objectsLayer = document.getElementById("layer-objects");
    const layoutRect = objectsLayer?.getBoundingClientRect();
    if (layoutRect && layoutRect.width > 0) {
      const zoneLeft = readCssPx(zoneLeftVar, 0);
      const zoneW = readCssPx(zoneWidthVar, 120);
      return layoutRect.left + zoneLeft + zoneW / 2;
    }

    return null;
  }

  /** Позиция thought-slot в viewport (px) — под колонкой героя, у нижнего края combat floor. */
  function getThoughtSlotAnchor(side) {
    const floor = getCombatFloorRect();
    const emojiSize = thoughtSlotEmojiSize();
    const halo = thoughtSlotHaloPx(emojiSize);
    const containerSize = emojiSize + halo * 2;
    const cx = getHeroColumnCenterX(side);

    if (floor && cx != null) {
      const gap = thoughtSlotGapPx();
      const cy = floor.bottom - gap - emojiSize / 2;
      return {
        cx,
        cy,
        emojiSize,
        halo,
        containerSize,
        top: cy - containerSize / 2,
        left: cx - containerSize / 2,
        size: containerSize,
      };
    }

    const ar = getAvatarAnchorRect(side);
    if (!ar) return null;

    const gap = thoughtSlotGapPx();
    const fallbackCx = ar.left + ar.width / 2;
    const cy = ar.bottom + gap + emojiSize / 2;
    return {
      cx: fallbackCx,
      cy,
      emojiSize,
      halo,
      containerSize,
      top: cy - containerSize / 2,
      left: fallbackCx - containerSize / 2,
      size: containerSize,
    };
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

    const anchor = getThoughtSlotAnchor(side);
    if (anchor) {
      return {
        x: anchor.cx,
        y: anchor.cy,
        size: anchor.emojiSize ?? anchor.size,
      };
    }

    return null;
  }

  function getFoeThoughtCenter(side) {
    const foe = side === "player" ? "enemy" : "player";
    const c = getThoughtSlotCenter(foe);
    return c ? { x: c.x, y: c.y } : null;
  }

  return {
    COMBAT_FLOOR_ANCHOR,
    viewportMin,
    isFlankArenaBattle,
    usesCombatFloorAnchors,
    shouldAnchorThoughtBelowHero,
    getBattleHudEl,
    getCombatFloorEl,
    getCombatFloorRect,
    thoughtSlotGapPx,
    thoughtSlotEmojiSize,
    thoughtSlotHaloPx,
    thoughtSlotSize,
    getThoughtSlotEl,
    getAvatarAnchorRect,
    getThoughtSlotAnchor,
    getThoughtSlotCenter,
    getFoeThoughtCenter,
  };
})();

if (typeof window !== "undefined") {
  window.BattleHeroAnchor = BattleHeroAnchor;
}
