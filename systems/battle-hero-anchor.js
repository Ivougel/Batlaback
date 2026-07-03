/**
 * Единый якорь эмодзи-аватара героя (ThoughtArena + ArenaEquipment + ui-layout).
 */

const BattleHeroAnchor = (() => {
  const MEASURE_CACHE_MS = 32;
  const measureCache = {
    until: 0,
    thoughtCenter: {},
    avatarRect: {},
    combatFloor: undefined,
  };

  function invalidateMeasureCache() {
    measureCache.until = 0;
    measureCache.thoughtCenter = {};
    measureCache.avatarRect = {};
    measureCache.combatFloor = undefined;
  }

  function refreshMeasureCache() {
    const now = performance.now();
    if (now <= measureCache.until) return;
    measureCache.until = now + MEASURE_CACHE_MS;
    measureCache.thoughtCenter = {};
    measureCache.avatarRect = {};
    measureCache.combatFloor = undefined;
  }

  /** Множитель эмодзи на «волшебной линии» — компактный бейдж на голове. */
  const BATTLE_THOUGHT_EMOJI_SCALE = 1;

  function battleThoughtEmojiScale() {
    return BATTLE_THOUGHT_EMOJI_SCALE;
  }

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
    refreshMeasureCache();
    if (measureCache.combatFloor !== undefined) {
      return measureCache.combatFloor;
    }
    const r = getCombatFloorEl()?.getBoundingClientRect();
    measureCache.combatFloor = (r && r.width > 8 && r.height > 8) ? r : null;
    return measureCache.combatFloor;
  }

  function gameScale() {
    return readCssPx("--game-scale", readCssPx("--ui-scale", 1));
  }

  const EMOJI_SIZE_BY_PROFILE = {
    "phone-portrait": {
      floorRatio: 0.12, vminRatio: 0.048, minPx: 24, maxPx: 36,
      haloRatio: 0.5, avatarRatio: 0.07, avatarWidthRatio: 0.22,
      headBadge: true, headBadgeYRatio: 0.07, headBadgeInnerXRatio: 0.5,
    },
    "phone-landscape": {
      floorRatio: 0.14, vminRatio: 0.05, minPx: 26, maxPx: 38,
      haloRatio: 0.48, avatarRatio: 0.075, avatarWidthRatio: 0.23,
      headBadge: true, headBadgeYRatio: 0.07, headBadgeInnerXRatio: 0.5,
    },
    "tablet-landscape-side": {
      floorRatio: 0.10, vminRatio: 0.042, minPx: 28, maxPx: 40,
      haloRatio: 0.48, avatarRatio: 0.072, avatarWidthRatio: 0.24,
      headBadge: true, headBadgeYRatio: 0.07, headBadgeInnerXRatio: 0.5,
      satelliteScale: 0.72, heroBelow: false,
    },
    "tablet-portrait": {
      floorRatio: 0.11, vminRatio: 0.045, minPx: 26, maxPx: 38,
      haloRatio: 0.5, avatarRatio: 0.07, avatarWidthRatio: 0.22,
      headBadge: true, headBadgeYRatio: 0.07, headBadgeInnerXRatio: 0.5,
    },
    "desktop-portrait": {
      floorRatio: 0.12, vminRatio: 0.048, minPx: 28, maxPx: 42,
      haloRatio: 0.48, avatarRatio: 0.075, avatarWidthRatio: 0.24,
      headBadge: true, headBadgeYRatio: 0.07, headBadgeInnerXRatio: 0.5,
    },
    "desktop-landscape": {
      floorRatio: 0.10, vminRatio: 0.044, minPx: 28, maxPx: 42,
      haloRatio: 0.48, avatarRatio: 0.072, avatarWidthRatio: 0.24,
      headBadge: true, headBadgeYRatio: 0.07, headBadgeInnerXRatio: 0.5,
      satelliteScale: 0.72,
    },
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

    let fromFloorH = 0;
    let fromFloorW = 0;
    if (floor && !prof.headBadge) {
      fromFloorH = Math.round(floor.height * prof.floorRatio);
      fromFloorW = Math.round(floor.width * 0.11);
    }
    const fromVmin = Math.round(vmin * prof.vminRatio * Math.max(0.92, uiScale));
    let fromAvatar = 0;
    const avatarRatio = prof.avatarRatio ?? 0;
    const avatarWidthRatio = prof.avatarWidthRatio ?? 0;
    if (avatarRatio > 0 || avatarWidthRatio > 0) {
      for (const side of ["player", "enemy"]) {
        const ar = getAvatarAnchorRect(side);
        if (!ar) continue;
        if (avatarRatio > 0 && ar.height > 40) {
          fromAvatar = Math.max(fromAvatar, Math.round(ar.height * avatarRatio));
        }
        if (avatarWidthRatio > 0 && ar.width > 40) {
          fromAvatar = Math.max(fromAvatar, Math.round(ar.width * avatarWidthRatio));
        }
      }
    }
    const raw = Math.max(fromFloorH, fromFloorW, fromVmin, fromAvatar) * emojiMod * BATTLE_THOUGHT_EMOJI_SCALE;
    const minPx = Math.round(prof.minPx);
    const maxPx = Math.round(prof.maxPx);
    return Math.round(Math.min(maxPx, Math.max(minPx, raw)));
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

  function getPortraitHeadBadgeAnchorEl(side) {
    const avatarSlotId = side === "enemy" ? "enemy-avatar-slot" : "player-avatar-slot";
    return document.getElementById(avatarSlotId)?.querySelector(".hero-portrait-head-badge-anchor");
  }

  function getProfileAvatarFrameRect(side) {
    refreshMeasureCache();
    const cacheKey = `frame_${side}`;
    if (measureCache.avatarRect[cacheKey] !== undefined) {
      return measureCache.avatarRect[cacheKey];
    }

    const avatarSlotId = side === "enemy" ? "enemy-avatar-slot" : "player-avatar-slot";
    const avatar = document.getElementById(avatarSlotId)?.querySelector(".profile-avatar");
    if (!avatar) {
      measureCache.avatarRect[cacheKey] = null;
      return null;
    }
    const ar = avatar.getBoundingClientRect();
    measureCache.avatarRect[cacheKey] = (ar.width <= 4 || ar.height <= 4) ? null : ar;
    return measureCache.avatarRect[cacheKey];
  }

  function getAvatarAnchorRect(side) {
    refreshMeasureCache();
    if (measureCache.avatarRect[side] !== undefined) {
      return measureCache.avatarRect[side];
    }

    const frameRect = getProfileAvatarFrameRect(side);
    if (frameRect) {
      measureCache.avatarRect[side] = frameRect;
      return frameRect;
    }

    const avatarSlotId = side === "enemy" ? "enemy-avatar-slot" : "player-avatar-slot";
    const avatarSlot = document.getElementById(avatarSlotId);
    if (!avatarSlot) {
      measureCache.avatarRect[side] = null;
      return null;
    }

    const shell = avatarSlot.querySelector(".avatar-hero-shell");
    const anchor = shell?.querySelector(".avatar-hero-stage")
      || shell?.querySelector(".profile-avatar")
      || shell
      || avatarSlot;
    const ar = anchor.getBoundingClientRect();
    measureCache.avatarRect[side] = (ar.width <= 4 || ar.height <= 4) ? null : ar;
    return measureCache.avatarRect[side];
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

  function usesHeadBadgeAnchors() {
    if (!isFlankArenaBattle()) return false;
    return emojiProfile().headBadge === true;
  }

  function usesHeroBelowThoughtAnchors() {
    if (usesHeadBadgeAnchors()) return false;
    const prof = emojiProfile();
    return prof.heroBelow === true || currentBattleProfile() === "tablet-landscape-side";
  }

  /** Компактный бейдж на голове — верх-внутрь к центру экрана. */
  function getHeadBadgeThoughtAnchor(side) {
    const emojiSize = thoughtSlotEmojiSize();
    const halo = thoughtSlotHaloPx(emojiSize);
    const containerSize = emojiSize + halo * 2;

    const anchorEl = getPortraitHeadBadgeAnchorEl(side);
    if (anchorEl) {
      const point = anchorEl.getBoundingClientRect();
      const cx = point.left + point.width / 2;
      const cy = point.top + point.height / 2;
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

    const ar = getProfileAvatarFrameRect(side) || getAvatarAnchorRect(side);
    if (!ar) return null;

    const prof = emojiProfile();
    const headYRatio = prof.headBadgeYRatio ?? 0.07;
    const headXRatio = prof.headBadgeInnerXRatio ?? 0.5;

    const cy = ar.top + ar.height * headYRatio;
    const cx = ar.left + ar.width * headXRatio;

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
    if (usesHeadBadgeAnchors()) {
      const badge = getHeadBadgeThoughtAnchor(side);
      if (badge) return badge;
    }

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
    refreshMeasureCache();
    if (measureCache.thoughtCenter[side] !== undefined) {
      return measureCache.thoughtCenter[side];
    }

    const slot = getThoughtSlotEl(side);
    const sr = slot?.getBoundingClientRect();
    if (sr && sr.width > 4 && sr.height > 4) {
      measureCache.thoughtCenter[side] = {
        x: sr.left + sr.width / 2,
        y: sr.top + sr.height / 2,
        size: sr.width,
      };
      return measureCache.thoughtCenter[side];
    }

    const anchor = getThoughtSlotAnchor(side);
    if (anchor) {
      measureCache.thoughtCenter[side] = {
        x: anchor.cx,
        y: anchor.cy,
        size: anchor.emojiSize ?? anchor.size,
      };
      return measureCache.thoughtCenter[side];
    }

    measureCache.thoughtCenter[side] = null;
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
    battleThoughtEmojiScale,
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
    usesHeadBadgeAnchors,
    getHeadBadgeThoughtAnchor,
    usesHeroBelowThoughtAnchors,
    invalidateMeasureCache,
  };
})();

if (typeof window !== "undefined") {
  window.BattleHeroAnchor = BattleHeroAnchor;
}
