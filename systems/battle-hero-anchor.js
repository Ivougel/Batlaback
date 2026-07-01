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

  function gameScale() {
    return readCssPx("--game-scale", readCssPx("--ui-scale", 1));
  }

  const EMOJI_SIZE_BY_PROFILE = {
    "phone-portrait": { floorRatio: 0.32, vminRatio: 0.14, minPx: 76, maxPx: 112, haloRatio: 0.22, avatarRatio: 0.34, slotCenterRatio: 0.38 },
    "phone-landscape": { floorRatio: 0.66, vminRatio: 0.17, minPx: 80, maxPx: 128, haloRatio: 0.28, avatarRatio: 0.40 },
    "tablet-landscape-side": {
      floorRatio: 0.48, vminRatio: 0.145, minPx: 96, maxPx: 168,
      haloRatio: 0.44, avatarRatio: 0.18, slotCenterRatio: 0.50,
      satelliteScale: 0.85, heroBelow: true, heroBelowZoneBias: 0.68,
    },
    "tablet-portrait": { floorRatio: 0.30, vminRatio: 0.13, minPx: 84, maxPx: 136, haloRatio: 0.26, avatarRatio: 0.32, slotCenterRatio: 0.38 },
    "desktop-portrait": { floorRatio: 0.66, vminRatio: 0.175, minPx: 100, maxPx: 168, haloRatio: 0.36, avatarRatio: 0.36 },
    "desktop-landscape": { floorRatio: 0.68, vminRatio: 0.18, minPx: 104, maxPx: 176, haloRatio: 0.36, avatarRatio: 0.34 },
  };

  function currentBattleProfile() {
    return document.documentElement.dataset.battleProfile || "desktop-landscape";
  }

  function emojiProfile() {
    return EMOJI_SIZE_BY_PROFILE[currentBattleProfile()]
      || EMOJI_SIZE_BY_PROFILE["desktop-landscape"];
  }

  function thoughtSlotGapPx() {
    return Math.round(6 * gameScale());
  }

  function readCssPx(name, fallback = 0) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function battleEmojiScale() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--battle-emoji-scale").trim();
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  function isMobilePortrait() {
    const root = document.documentElement;
    return root.dataset.prepLayout === "mobile" && root.dataset.orientation === "portrait";
  }

  function isPhoneLandscape() {
    const root = document.documentElement;
    return root.dataset.battleProfile === "phone-landscape"
      || root.dataset.uiSurface === "phone-landscape";
  }

  function visibleCombatFloorBottom(floorRect) {
    if (!floorRect) return null;
    const chrome = readCssPx("--tablet-battle-chrome-bottom", 0)
      || readCssPx("--bottom-chrome-h-measured", 56);
    const vv = window.visualViewport;
    const safeBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - chrome - thoughtSlotGapPx();
    return Math.min(floorRect.bottom, safeBottom);
  }

  function thoughtSlotEmojiSize(vmin = viewportMin()) {
    const prof = emojiProfile();
    const floor = getCombatFloorRect();
    const emojiMod = battleEmojiScale();
    const uiScale = readCssPx("--ui-scale", 1);

    const fromFloorH = floor ? Math.round(floor.height * prof.floorRatio) : 0;
    const fromFloorW = floor ? Math.round(floor.width * 0.11) : 0;
    const fromVmin = Math.round(vmin * prof.vminRatio * Math.max(0.92, uiScale));
    let fromAvatar = 0;
    const avatarRatio = prof.avatarRatio ?? 0;
    if (avatarRatio > 0) {
      for (const side of ["player", "enemy"]) {
        const ar = getAvatarAnchorRect(side);
        if (ar && ar.height > 40) {
          fromAvatar = Math.max(fromAvatar, Math.round(ar.height * avatarRatio));
        }
      }
    }
    const raw = Math.max(fromFloorH, fromFloorW, fromVmin, fromAvatar) * emojiMod;
    return Math.round(Math.min(prof.maxPx, Math.max(prof.minPx, raw)));
  }

  function thoughtSlotHaloPx(emojiSize = thoughtSlotEmojiSize()) {
    return Math.round(emojiSize * emojiProfile().haloRatio);
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

  function satelliteScaleFactor() {
    return emojiProfile().satelliteScale ?? 0.85;
  }

  function usesHeroBelowThoughtAnchors() {
    const prof = emojiProfile();
    return prof.heroBelow === true || currentBattleProfile() === "tablet-landscape-side";
  }

  function visibleViewportBottomPx() {
    const chrome = readCssPx("--tablet-battle-chrome-bottom", 0)
      || readCssPx("--bottom-chrome-h-measured", 56);
    const vv = window.visualViewport;
    return (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - chrome;
  }

  /** Верхний край нижнего battle-chrome (начало коридора под HUD). */
  function visibleBattleCorridorTopPx() {
    const fromVar = readCssPx("--zone-toolbar-top", 0)
      || readCssPx("--prep-toolbar-zone-top", 0);
    if (fromVar > 80) return fromVar;
    const chrome = document.getElementById("bottom-chrome")
      || document.querySelector(".bottom-chrome");
    const rect = chrome?.getBoundingClientRect();
    if (rect && rect.height > 12) return rect.top;
    return visibleViewportBottomPx();
  }

  /** Планшет landscape: эмодзи-аватар под героем (под HUD), спутники — орбита вокруг. */
  function getHeroBelowThoughtAnchor(side) {
    const emojiSize = thoughtSlotEmojiSize();
    const halo = thoughtSlotHaloPx(emojiSize);
    const containerSize = emojiSize + halo * 2;
    const cx = getHeroColumnCenterX(side);
    if (cx == null) return null;

    const prof = emojiProfile();
    const minGap = Math.max(thoughtSlotGapPx(), Math.round(10 * readCssPx("--ui-scale", 1)));
    const hudRect = getBattleHudEl(side)?.getBoundingClientRect();
    const stageRect = getAvatarAnchorRect(side);

    let cy;
    if (hudRect && hudRect.height > 12) {
      const zoneTop = hudRect.bottom + minGap;
      const corridorTop = visibleBattleCorridorTopPx();
      const cyMin = zoneTop + emojiSize / 2;
      const cyMax = corridorTop - minGap - emojiSize / 2;
      const band = cyMax - cyMin;
      const bias = prof.heroBelowZoneBias ?? 0.55;
      if (band > emojiSize * 0.08) {
        cy = cyMin + band * bias;
      } else {
        cy = cyMin;
      }
    } else if (stageRect) {
      cy = stageRect.bottom + minGap + emojiSize / 2;
    } else {
      return null;
    }

    const maxCy = visibleViewportBottomPx() - containerSize / 2 - minGap;
    if (Number.isFinite(maxCy) && cy > maxCy) cy = maxCy;

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

  /** Позиция thought-slot в viewport (px). */
  function getThoughtSlotAnchor(side) {
    if (usesHeroBelowThoughtAnchors()) {
      const underHero = getHeroBelowThoughtAnchor(side);
      if (underHero) return underHero;
    }

    const floor = getCombatFloorRect();
    const emojiSize = thoughtSlotEmojiSize();
    const halo = thoughtSlotHaloPx(emojiSize);
    const containerSize = emojiSize + halo * 2;
    const cx = floor ? getHeroColumnCenterX(side) : null;

    if (floor && cx != null) {
      const gap = thoughtSlotGapPx();
      const floorBottom = visibleCombatFloorBottom(floor) ?? floor.bottom;
      const floorTop = floor.top;
      const usableH = Math.max(0, floorBottom - floorTop);
      const prof = emojiProfile();
      const centerRatio = prof.slotCenterRatio ?? 0.52;
      let cy;
      if (usableH > emojiSize * 2.4) {
        cy = floorTop + usableH * centerRatio;
      } else {
        cy = floorBottom - gap - emojiSize / 2;
      }
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
    isMobilePortrait,
    isPhoneLandscape,
    battleEmojiScale,
    thoughtSlotEmojiSize,
    thoughtSlotHaloPx,
    thoughtSlotSize,
    getThoughtSlotEl,
    getAvatarAnchorRect,
    getHeroColumnCenterX,
    getThoughtSlotAnchor,
    getThoughtSlotCenter,
    getFoeThoughtCenter,
    emojiProfile,
    satelliteScaleFactor,
    usesHeroBelowThoughtAnchors,
  };
})();

if (typeof window !== "undefined") {
  window.BattleHeroAnchor = BattleHeroAnchor;
}
