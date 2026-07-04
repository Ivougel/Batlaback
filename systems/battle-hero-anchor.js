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

  /** Множитель эмодзи на боевом полу арены. */
  const BATTLE_THOUGHT_EMOJI_SCALE = 1;

  function battleThoughtEmojiScale() {
    return BATTLE_THOUGHT_EMOJI_SCALE;
  }

  /** Нормализованные точки на зелёном полу (красные маркеры на макете). */
  const COMBAT_FLOOR_ANCHOR = {
    player: { x: 0.20, y: 0.58 },
    enemy: { x: 0.80, y: 0.58 },
  };

  const FLOOR_EMOJI_PROFILE = {
    headBadge: false,
    floorRatio: 0.50,
    floorWidthRatio: 0.21,
    haloRatio: 0.30,
    avatarRatio: 0,
    avatarWidthRatio: 0,
    minPx: 64,
    maxPx: 144,
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

  function resolveLayoutCombatFloorRect() {
    const objectsLayer = document.getElementById("layer-objects");
    const floorTop = readCssPx("--battle-combat-floor-top", 0);
    const floorH = readCssPx("--battle-combat-floor-h", 0);
    const arenaLeft = readCssPx("--battle-arena-zone-left", 0);
    const arenaW = readCssPx("--battle-arena-zone-width", 0);
    const gap = thoughtSlotGapPx();

    const buildRect = (left, top, width, height) => {
      if (width < 40 || height < 48) return null;
      return {
        left,
        top,
        width,
        height,
        bottom: top + height,
        right: left + width,
      };
    };

    if (objectsLayer && floorTop > 0 && floorH > 40 && arenaW > 40) {
      const base = objectsLayer.getBoundingClientRect();
      const top = base.top + floorTop;
      const left = base.left + arenaLeft;
      const chromeTop = visibleBattleCorridorTopPx();
      const bottom = Math.min(top + floorH, chromeTop - gap);
      const height = Math.max(0, bottom - top);
      const fromLayout = buildRect(left, top, arenaW, height);
      if (fromLayout) return fromLayout;
    }

    if (objectsLayer && arenaW > 40) {
      const base = objectsLayer.getBoundingClientRect();
      const left = base.left + (arenaLeft > 0 ? arenaLeft : Math.max(0, (base.width - arenaW) / 2));
      const playerHud = getBattleHudEl("player")?.getBoundingClientRect();
      const enemyHud = getBattleHudEl("enemy")?.getBoundingClientRect();
      const hudBottom = Math.max(playerHud?.bottom ?? 0, enemyHud?.bottom ?? 0);
      const chromeTop = visibleBattleCorridorTopPx();
      const top = hudBottom + gap;
      const bottom = chromeTop - gap;
      const fromCorridor = buildRect(left, top, arenaW, bottom - top);
      if (fromCorridor) return fromCorridor;
    }

    const dom = getCombatFloorEl()?.getBoundingClientRect();
    if (!dom || dom.width < 8) return null;

    const chromeTop = visibleBattleCorridorTopPx();
    const bottom = Math.min(dom.bottom, chromeTop - gap);
    const height = Math.max(0, bottom - dom.top);
    return buildRect(dom.left, dom.top, dom.width, height);
  }

  function getCombatFloorRect() {
    refreshMeasureCache();
    if (measureCache.combatFloor !== undefined) {
      return measureCache.combatFloor;
    }
    measureCache.combatFloor = resolveLayoutCombatFloorRect();
    return measureCache.combatFloor;
  }

  function gameScale() {
    return readCssPx("--game-scale", readCssPx("--ui-scale", 1));
  }

  const EMOJI_SIZE_BY_PROFILE = {
    "phone-portrait": {
      ...FLOOR_EMOJI_PROFILE,
      floorRatio: 0.46,
      floorWidthRatio: 0.24,
      vminRatio: 0.11,
      minPx: 72,
      maxPx: 120,
      haloRatio: 0.28,
    },
    "phone-landscape": {
      ...FLOOR_EMOJI_PROFILE,
      floorRatio: 0.48,
      floorWidthRatio: 0.22,
      vminRatio: 0.10,
      minPx: 68,
      maxPx: 130,
    },
    "tablet-landscape-side": {
      ...FLOOR_EMOJI_PROFILE,
      floorRatio: 0.52,
      floorWidthRatio: 0.20,
      vminRatio: 0.12,
      minPx: 96,
      maxPx: 168,
      haloRatio: 0.28,
      satelliteScale: 0.62,
      heroBelowZoneBias: 0.72,
      heroAboveZoneBias: 0.82,
      heroSpecYRatio: 0.20,
      heroSpecXBias: 0.34,
    },
    "tablet-portrait": {
      ...FLOOR_EMOJI_PROFILE,
      floorRatio: 0.44,
      floorWidthRatio: 0.23,
      vminRatio: 0.10,
      minPx: 72,
      maxPx: 118,
    },
    "desktop-portrait": {
      ...FLOOR_EMOJI_PROFILE,
      floorRatio: 0.46,
      floorWidthRatio: 0.22,
      vminRatio: 0.10,
      minPx: 76,
      maxPx: 132,
    },
    "desktop-landscape": {
      ...FLOOR_EMOJI_PROFILE,
      floorRatio: 0.50,
      floorWidthRatio: 0.20,
      vminRatio: 0.095,
      minPx: 80,
      maxPx: 152,
      satelliteScale: 0.62,
      heroSpecYRatio: 0.18,
      heroSpecXBias: 0.32,
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

    let fromFloor = 0;
    if (floor && usesCombatFloorAnchors() && !usesHeroAboveThoughtAnchors() && !prof.headBadge) {
      const floorBottom = visibleCombatFloorBottom(floor) ?? floor.bottom;
      const usableH = Math.max(0, floorBottom - floor.top);
      const fromFloorH = usableH * (prof.floorRatio ?? 0.5);
      const fromFloorW = floor.width * (prof.floorWidthRatio ?? 0.21);
      fromFloor = Math.max(fromFloorH, fromFloorW);
    }
    const fromVmin = Math.round(vmin * (prof.vminRatio ?? 0.1) * Math.max(0.92, uiScale));
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
    const raw = Math.max(fromFloor, fromVmin, fromAvatar) * emojiMod * BATTLE_THOUGHT_EMOJI_SCALE;
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

  function getPrepCharacterAnchorRect(side) {
    const root = document.documentElement;
    if (root.dataset.battlePrepHeroLayer !== "true") return null;
    const charEl = document.getElementById(side === "enemy" ? "prep-character-enemy" : "prep-character-player");
    if (!charEl || charEl.hasAttribute("hidden")) return null;
    const visual = charEl.querySelector(".prep-character-img, .prep-character-emoji") || charEl;
    const ar = visual.getBoundingClientRect();
    return ar.width >= 48 && ar.height >= 48 ? ar : null;
  }

  function getAvatarAnchorRect(side) {
    refreshMeasureCache();
    if (measureCache.avatarRect[side] !== undefined) {
      return measureCache.avatarRect[side];
    }

    const prepRect = getPrepCharacterAnchorRect(side);
    if (prepRect) {
      measureCache.avatarRect[side] = prepRect;
      return prepRect;
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
    if (usesCombatFloorAnchors() && !emojiProfile().headBadge) return false;
    const prof = emojiProfile();
    return prof.heroBelow === true || currentBattleProfile() === "tablet-landscape-side";
  }

  function getHeroColumnTop(side) {
    const ar = getAvatarAnchorRect(side);
    if (ar && ar.height > 24) return ar.top;

    const panelId = side === "enemy" ? "enemy-avatar-panel" : "player-avatar-panel";
    const panelRect = document.getElementById(panelId)?.getBoundingClientRect();
    if (panelRect && panelRect.height > 16) return panelRect.top;

    const objectsLayer = document.getElementById("layer-objects");
    const heroRowTop = readCssPx("--battle-hero-row-top", 0);
    if (objectsLayer && heroRowTop > 0) {
      return objectsLayer.getBoundingClientRect().top + heroRowTop;
    }

    return null;
  }

  function usesHeroAboveThoughtAnchors() {
    if (!isFlankArenaBattle() || usesHeadBadgeAnchors()) return false;
    const profile = currentBattleProfile();
    return profile === "tablet-landscape-side" || profile.startsWith("desktop-");
  }

  function readHudAnchorTopPx(side) {
    const specific = readCssPx(`--battle-hud-anchor-top-${side}`, 0);
    if (specific > 0) return specific;
    return readCssPx("--battle-hud-anchor-top", 0);
  }

  /** Стабильный потолок колонки для эмодзи (layout var, не live HUD rect). */
  function getHeroEmojiColumnCeilingY(side) {
    const viewport = document.getElementById("prep-field-column");
    const hudAnchorVp = readHudAnchorTopPx(side);
    if (viewport && hudAnchorVp > 0) {
      return viewport.getBoundingClientRect().top + hudAnchorVp;
    }

    const objectsLayer = document.getElementById("layer-objects");
    const heroRowTop = readCssPx("--battle-hero-row-top", 0);
    if (objectsLayer && heroRowTop > 0) {
      return objectsLayer.getBoundingClientRect().top + heroRowTop;
    }

    return null;
  }

  /** Flank-arena: эмодзи-аватар над героем/HUD (верх колонки), не на торсе и не на «полу». */
  function getHeroAboveThoughtAnchor(side) {
    const cx = getHeroColumnCenterX(side);
    if (cx == null) return null;

    const emojiSize = thoughtSlotEmojiSize();
    const halo = thoughtSlotHaloPx(emojiSize);
    const containerSize = emojiSize + halo * 2;
    const gap = Math.max(thoughtSlotGapPx(), Math.round(10 * readCssPx("--ui-scale", 1)));

    let ceilingY = getHeroEmojiColumnCeilingY(side);

    if (ceilingY == null) {
      const panelId = side === "enemy" ? "enemy-avatar-panel" : "player-avatar-panel";
      const panelRect = document.getElementById(panelId)?.getBoundingClientRect();
      const stageRect = getAvatarAnchorRect(side);
      const heroTop = getHeroColumnTop(side);
      const hudRect = getBattleHudEl(side)?.getBoundingClientRect();

      if (hudRect && hudRect.height > 8) {
        const portraitTop = stageRect?.top ?? panelRect?.top ?? heroTop;
        if (portraitTop == null || hudRect.top <= portraitTop - 2) {
          ceilingY = hudRect.top;
        }
      }
      if (ceilingY == null && panelRect && panelRect.height > 16) {
        ceilingY = panelRect.top;
      } else if (ceilingY == null && heroTop != null) {
        ceilingY = heroTop;
      }
    }

    if (ceilingY == null) return null;

    const vv = window.visualViewport;
    const safeTop = (vv?.offsetTop ?? 0) + Math.max(gap, Math.round(8 * readCssPx("--ui-scale", 1)));
    let slotTop = ceilingY - gap - containerSize;
    if (slotTop < safeTop) slotTop = safeTop;

    const cy = slotTop + containerSize / 2;

    return {
      cx,
      cy,
      emojiSize,
      halo,
      containerSize,
      top: slotTop,
      left: cx - containerSize / 2,
      size: containerSize,
    };
  }

  /** Центральная арена: эмодзи на боевом полу (x20/y58, x80/y58). */
  function getCombatFloorThoughtAnchor(side) {
    const floor = getCombatFloorRect();
    if (!floor) return null;

    const anchorNorm = COMBAT_FLOOR_ANCHOR[side] || COMBAT_FLOOR_ANCHOR.player;
    const emojiSize = thoughtSlotEmojiSize();
    const halo = thoughtSlotHaloPx(emojiSize);
    const containerSize = emojiSize + halo * 2;

    const cx = floor.left + floor.width * anchorNorm.x;
    const cy = floor.top + floor.height * anchorNorm.y;

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

  /** @deprecated Компактный бейдж на голове — только если headBadge включён в профиле. */
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

  /** Эмодзи спека — верх колонки героя (как на макете flank-arena). */
  function getHeroNearSpecAnchor(side) {
    const panelId = side === "enemy" ? "enemy-avatar-panel" : "player-avatar-panel";
    const panelRect = document.getElementById(panelId)?.getBoundingClientRect();
    const ar = getAvatarAnchorRect(side);
    if ((!panelRect || panelRect.width < 40) && (!ar || ar.height < 40)) return null;

    const emojiSize = thoughtSlotEmojiSize();
    const halo = thoughtSlotHaloPx(emojiSize);
    const containerSize = emojiSize + halo * 2;
    const prof = emojiProfile();
    const xBias = prof.heroSpecXBias ?? 0.34;

    let cx;
    let cy;
    if (panelRect && panelRect.width > 40) {
      cx = panelRect.left + panelRect.width * (side === "enemy" ? 0.52 : 0.48);
      cy = panelRect.top + Math.min(Math.max(emojiSize * 0.55, 28), panelRect.height * 0.14);
    } else {
      cx = side === "enemy"
        ? ar.left + ar.width * (0.5 - xBias)
        : ar.left + ar.width * (0.5 + xBias);
      cy = ar.top + ar.height * (prof.heroSpecYRatio ?? 0.12);
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
    // Tablet-side / desktop flank: эмодзи над героем в колонке (как на макете).
    if (usesHeroAboveThoughtAnchors()) {
      const aboveHero = getHeroAboveThoughtAnchor(side);
      if (aboveHero) return aboveHero;

      const nearHero = getHeroNearSpecAnchor(side);
      if (nearHero) return nearHero;

      const underHero = getHeroBelowThoughtAnchor(side);
      if (underHero) return underHero;

      const cx = getHeroColumnCenterX(side);
      const ar = getAvatarAnchorRect(side);
      if (cx != null && ar) {
        const emojiSize = thoughtSlotEmojiSize();
        const halo = thoughtSlotHaloPx(emojiSize);
        const containerSize = emojiSize + halo * 2;
        const gap = Math.max(thoughtSlotGapPx(), Math.round(10 * readCssPx("--ui-scale", 1)));
        const slotTop = ar.top - gap - containerSize;
        return {
          cx,
          cy: slotTop + containerSize / 2,
          emojiSize,
          halo,
          containerSize,
          top: slotTop,
          left: cx - containerSize / 2,
          size: containerSize,
        };
      }
      return null;
    }

    if (usesCombatFloorAnchors() && !usesHeadBadgeAnchors()) {
      const floorAnchor = getCombatFloorThoughtAnchor(side);
      if (floorAnchor) return floorAnchor;
    }

    if (usesHeadBadgeAnchors()) {
      const badge = getHeadBadgeThoughtAnchor(side);
      if (badge) return badge;
    }

    if (usesHeroBelowThoughtAnchors()) {
      const underHero = getHeroBelowThoughtAnchor(side);
      if (underHero) return underHero;
    }

    // Fallback: спек-эмодзи у верхней части колонки (prep-аналог).
    if (isFlankArenaBattle()) {
      const nearHero = getHeroNearSpecAnchor(side);
      if (nearHero) return nearHero;
    }

    const floor = getCombatFloorRect();
    const emojiSize = thoughtSlotEmojiSize();
    const halo = thoughtSlotHaloPx(emojiSize);
    const containerSize = emojiSize + halo * 2;

    if (floor) {
      const floorAnchor = getCombatFloorThoughtAnchor(side);
      if (floorAnchor) return floorAnchor;
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

    const anchor = getThoughtSlotAnchor(side);
    if (anchor) {
      measureCache.thoughtCenter[side] = {
        x: anchor.cx,
        y: anchor.cy,
        size: anchor.emojiSize ?? anchor.size,
      };
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
    getCombatFloorThoughtAnchor,
    getHeroAboveThoughtAnchor,
    getHeroColumnTop,
    getHeroBelowThoughtAnchor,
    getHeroNearSpecAnchor,
    usesHeroAboveThoughtAnchors,
    usesHeroBelowThoughtAnchors,
    invalidateMeasureCache,
  };
})();

if (typeof window !== "undefined") {
  window.BattleHeroAnchor = BattleHeroAnchor;
}
