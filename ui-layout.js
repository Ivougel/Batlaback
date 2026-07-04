/**
 * Адаптивный UI: масштаб, tier, compact-режим, высота viewport и HUD.
 */
(function initUiLayout() {
  const DESIGN_W = 1280;
  const DESIGN_H = 800;
  const SCALE_MIN = 0.52;
  const SCALE_MAX = 1;
  const PREP_STACKED_CONTENT_H = 640;
  const PREP_SIDE_CONTENT_H = 760;

  function viewportSize() {
    const vv = window.visualViewport;
    return {
      w: vv?.width ?? window.innerWidth,
      h: vv?.height ?? window.innerHeight,
    };
  }

  function isBattleUiPhase() {
    const phase = document.getElementById("app")?.dataset.phase;
    return phase === "battle" || phase === "replay";
  }

  function getBottomChrome() {
    return document.getElementById("bottom-chrome");
  }

  function isClassOverlayOpen() {
    const el = document.getElementById("class-overlay");
    return !!el && !el.classList.contains("hidden");
  }

  function visualViewportBottom() {
    const vv = window.visualViewport;
    return vv ? vv.offsetTop + vv.height : window.innerHeight;
  }

  function isPwaStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
  }

  /** PWA/tablet: прижать chrome к visualViewport.bottom (иначе белая полоса под home indicator). */
  function syncBottomChromeDock() {
    const root = document.documentElement;
    const bar = getBottomChrome();
    root.style.removeProperty("--class-intro-chrome-h");

    if (!bar || bar.classList.contains("hidden") || getComputedStyle(bar).display === "none") {
      root.style.removeProperty("--bottom-chrome-pin-y");
      return;
    }
    if (isLayoutBlockingModal() && !isClassOverlayOpen()) {
      root.style.removeProperty("--bottom-chrome-pin-y");
      return;
    }

    const tier = root.dataset.uiTier;
    const touch = root.dataset.touch === "true";
    const shouldPin = (tier === "tablet" && touch) || isPwaStandalone();
    if (!shouldPin) {
      root.style.removeProperty("--bottom-chrome-pin-y");
      if (isClassOverlayOpen()) {
        root.style.setProperty(
          "--class-intro-chrome-h",
          `${Math.max(bar.offsetHeight, readCssPx("--bottom-chrome-h", 44))}px`,
        );
      }
      return;
    }

    const viewBottom = visualViewportBottom();
    const rect = bar.getBoundingClientRect();
    const gap = Math.max(0, viewBottom - rect.bottom);
    const pinY = gap > 0.5 ? Math.round(gap) : 0;

    if (pinY > 0) {
      root.style.setProperty("--bottom-chrome-pin-y", `${pinY}px`);
    } else {
      root.style.removeProperty("--bottom-chrome-pin-y");
    }

    if (isClassOverlayOpen()) {
      const reserve = Math.max(
        Math.round(bar.offsetHeight + pinY),
        readCssPx("--bottom-chrome-h", 44),
      );
      root.style.setProperty("--class-intro-chrome-h", `${reserve}px`);
    }
  }

  function measureBottomChromeHeight() {
    syncBottomChromeDock();
    const pinY = readCssPx("--bottom-chrome-pin-y", 0);

    if (isClassOverlayOpen()) {
      const reserve = readCssPx("--class-intro-chrome-h", 0);
      if (reserve > 0) return reserve;
      const bar = getBottomChrome();
      if (!bar || bar.classList.contains("hidden")) return readCssPx("--bottom-chrome-h", 44);
      if (getComputedStyle(bar).display === "none") return readCssPx("--bottom-chrome-h", 44);
      return bar.offsetHeight + pinY || readCssPx("--bottom-chrome-h", 44);
    }
    if (isLayoutBlockingModal()) return 0;
    const bar = getBottomChrome();
    if (!bar || bar.classList.contains("hidden")) return readCssPx("--bottom-chrome-h", 44);
    if (getComputedStyle(bar).display === "none") return readCssPx("--bottom-chrome-h", 44);
    return (bar.offsetHeight || readCssPx("--bottom-chrome-h", 44)) + pinY;
  }

  function isHudVisible() {
    if (isClassOverlayOpen()) {
      const bar = getBottomChrome();
      return !!bar && !bar.classList.contains("hidden") && getComputedStyle(bar).display !== "none";
    }
    const bar = getBottomChrome();
    if (!bar || bar.classList.contains("hidden")) return false;
    if (isModalOpen()) return false;
    if (isBattleUiPhase()) return true;
    if (document.documentElement.dataset.gamepadHud === "hidden") return false;
    return getComputedStyle(bar).display !== "none";
  }

  function isModalOpen() {
    return ["class-overlay", "battle-result-overlay", "battle-detail-overlay", "overlay", "settings-overlay", "escape-menu-overlay"].some((id) => {
      const el = document.getElementById(id);
      return el && !el.classList.contains("hidden");
    });
  }

  function isLayoutBlockingModal() {
    return ["class-overlay", "battle-detail-overlay", "overlay", "settings-overlay", "escape-menu-overlay"].some((id) => {
      const el = document.getElementById(id);
      return el && !el.classList.contains("hidden");
    });
  }

  function isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  function isCoarsePointerOnly() {
    return window.matchMedia("(pointer: coarse)").matches
      && !window.matchMedia("(pointer: fine)").matches;
  }

  /** Портрет телефона — mobile (drawer). Планшет в портрете — stacked, не drawer. */
  function shouldUseMobilePrepLayout(w, h, tier) {
    if (w > h) return false;
    if (!isTouchDevice() && !isCoarsePointerOnly()) return false;
    if (tier === "tablet") return false;
    return w <= 768;
  }

  /** iPad / phone landscape side-by-side: touch, ширина ≥700, высота ≥360. */
  function shouldUseTabletSideFit(w, h, prepLayout, touchDev, tier) {
    if (prepLayout !== "side") return false;
    if (h >= w) return false;
    if (tier === "tablet") return true;
    if (touchDev && w >= 700 && w <= 1800 && h >= 360 && h <= 1200) return true;
    return false;
  }

  function usesTabletPrepHeroLayout(root = document.documentElement) {
    return root.dataset.uiSurface === "tablet-side";
  }

  function isTabletSideLayout(root = document.documentElement) {
    return root.dataset.uiSurface === "tablet-side";
  }

  function isPrepHeroCardHud(root = document.documentElement) {
    return root.dataset.prepLayout === "side"
      || root.dataset.uiSurface === "tablet-side"
      || root.dataset.uiSurface === "desktop";
  }

  function computeTabletPrepHeroHeight(columnH, sceneTop = 14) {
    const usable = Math.max(220, columnH - sceneTop - 12);
    return Math.round(Math.min(300, Math.max(168, usable * 0.32)));
  }

  const PREP_GRID_COLS = 7;
  const PREP_GRID_ROWS = 9;

  /** iPad mini 7 PWA landscape — точечный брейкпоинт (1133×744). */
  function isIpadMiniPwaLandscape() {
    const w = Math.round(window.visualViewport?.width ?? window.innerWidth);
    const h = Math.round(window.visualViewport?.height ?? window.innerHeight);
    return w === 1133 && h === 744;
  }

  /** iPad / tablet-side prep: крупные ячейки, сетка заполняет колонку поля. */
  function syncTabletSidePrepGridMetrics() {
    if (document.body?.classList.contains("is-ui-dragging")) return false;
    const root = document.documentElement;
    const app = document.getElementById("app");
    if (!usesTabletPrepHeroLayout(root) || app?.dataset.phase !== "prep") return false;

    const fieldCol = document.getElementById("prep-field-column");
    const layerWorld = fieldCol?.querySelector(".layer-world");
    if (!fieldCol || fieldCol.clientWidth < 120 || fieldCol.clientHeight < 120) return false;

    const uiScale = readCssPx("--ui-scale", 1);
    const gap = Math.max(1, Math.round(readCssPx("--cell-gap", 1)));
    const sceneTop = readCssPx("--prep-scene-top", 14);
    const pad = Math.round(8 * uiScale);

    const colW = layerWorld?.clientWidth > 0 ? layerWorld.clientWidth : fieldCol.clientWidth;
    const colH = layerWorld?.clientHeight > 0 ? layerWorld.clientHeight : fieldCol.clientHeight;

    const heroLayer = document.querySelector("#app[data-phase=\"prep\"] .prep-character-layer");
    let heroReserveW = 0;
    if (heroLayer && getComputedStyle(heroLayer).display !== "none") {
      const heroRect = heroLayer.getBoundingClientRect();
      const colRect = fieldCol.getBoundingClientRect();
      if (heroRect.width > 48 && heroRect.right > colRect.left) {
        heroReserveW = Math.max(0, Math.round(heroRect.right - colRect.left + pad));
      }
    } else if (isIpadMiniPwaLandscape()) {
      heroReserveW = Math.round(colW * 0.22);
    }

    const availW = Math.max(180, colW - pad * 2 - heroReserveW);
    const availH = Math.max(220, colH - sceneTop - pad);

    const minCell = Math.round(36 * uiScale);
    const maxCell = Math.round(isIpadMiniPwaLandscape() ? 78 : 84 * uiScale);
    const byW = Math.floor((availW - (PREP_GRID_COLS - 1) * gap) / PREP_GRID_COLS);
    const byH = Math.floor((availH - (PREP_GRID_ROWS - 1) * gap) / PREP_GRID_ROWS);
    const cell = Math.min(maxCell, Math.max(minCell, Math.min(byW, byH)));

    const prev = readCssPx("--cell-size", 0);
    if (Math.abs(prev - cell) < 1 && readCssPx("--prep-hero-reserve-w", -1) === heroReserveW) return false;

    root.style.setProperty("--cell-size", `${cell}px`);
    root.style.setProperty("--prep-hero-reserve-w", `${heroReserveW}px`);
    return true;
  }

  function shouldUseStackedPrep(w, h, tier) {
    if (shouldUseMobilePrepLayout(w, h, tier)) return false;

    if (h >= w && tier === "tablet") return true;

    if (w >= 600 && w <= 1200) return false;

    const landscape = w > h;

    if (landscape && w >= 880 && h >= 620) return false;

    if (w <= 599 || h <= 560) return true;
    if (isCoarsePointerOnly() && w < 600 && h <= 680) return true;
    if (w <= 900 || h <= 620) return true;
    return false;
  }

  function roundScale(n) {
    return Math.round(n * 1000) / 1000;
  }

  /**
   * Матрица tier × orientation + battle-подпрофиль.
   * id: phone-portrait | phone-landscape | tablet-portrait | tablet-landscape | desktop-portrait | desktop-landscape
   */
  function resolveLayoutProfile(w, h, ctx) {
    const portrait = h >= w;
    const orientation = portrait ? "portrait" : "landscape";
    const { tier, prepLayout, tabletSideFit, tabletPrepHero, touchDev } = ctx;

    let battleProfile;
    if (prepLayout === "mobile") {
      battleProfile = "phone-portrait";
    } else if (tier === "phone" && !portrait) {
      battleProfile = "phone-landscape";
    } else if ((tabletSideFit || tabletPrepHero) && !portrait) {
      battleProfile = "tablet-landscape-side";
    } else if (portrait && tier !== "desktop") {
      battleProfile = "tablet-portrait";
    } else {
      battleProfile = portrait ? "desktop-portrait" : "desktop-landscape";
    }

    return {
      id: `${tier}-${orientation}`,
      battleProfile,
      tier,
      orientation,
      portrait,
      prepLayout,
      touchDev,
      phoneLandscape: battleProfile === "phone-landscape",
      mobilePrep: prepLayout === "mobile",
    };
  }

  function resolveUiSurface(ctx) {
    const { prepLayout, tabletSideFit, tabletPrepHero, layoutProfile } = ctx;
    if (prepLayout === "mobile") return "phone-drawer";
    if (tabletSideFit || tabletPrepHero) return "tablet-side";
    if (layoutProfile.id === "phone-landscape") return "phone-landscape";
    if (prepLayout === "stacked" || layoutProfile.id === "tablet-portrait") return "tablet-stacked";
    if (layoutProfile.tier === "desktop") return "desktop";
    return "default";
  }

  const TYPE_SCALE_BY_TIER = {
    phone: { floor: 0.96, boost: 1.2, cap: 1.05 },
    tablet: { floor: 1.02, boost: 1.18, cap: 1.14 },
    desktop: { floor: 0.85, boost: 1, cap: 1.05 },
  };

  const INTRO_UI_SCALE_MIN = {
    "tablet-landscape": 0.84,
    "tablet-portrait": 0.78,
  };

  function computeTypeScale(uiScale, profile) {
    const cfg = TYPE_SCALE_BY_TIER[profile.tier] || TYPE_SCALE_BY_TIER.desktop;
    const cap = cfg.cap ?? 1.05;
    let typeScale = uiScale * cfg.boost;
    if (profile.touchDev) typeScale = Math.max(typeScale, cfg.floor);
    return roundScale(Math.max(cfg.floor, Math.min(cap, typeScale)));
  }

  function applyIntroUiScaleFloor(clamped, layoutProfile) {
    if (!isClassOverlayOpen() || layoutProfile.tier !== "tablet") return clamped;
    const min = INTRO_UI_SCALE_MIN[layoutProfile.id] ?? 0.8;
    return roundScale(Math.max(min, clamped));
  }

  function computeGameScale(uiScale, profile) {
    const shrink = { phone: 0.94, tablet: 0.97, desktop: 1 };
    const mod = shrink[profile?.tier] ?? 1;
    return roundScale(Math.max(SCALE_MIN, Math.min(1, uiScale * mod)));
  }

  /** Prep-раскладка по layoutProfile (tier × orientation). */
  const PREP_PROFILES = {
    "phone-portrait": {
      fitAvailH: 300, fitMinScale: 0.65, fitWidthRatio: 0.48,
      canvasAvailShare: 0.44, canvasMaxCap: 280,
      shopRowBase: 70, shopRowMin: 54, shopRowMax: 74,
      heroSlotHeight: "min(280px, 34vh)", heroSlotMax: 300,
      sceneAvatarH: 140, sceneAvatarW: 112, dollSlot: 34, characterGap: 6,
      shopPanelW: 300,
    },
    "phone-landscape": {
      fitAvailH: 200, fitMinScale: SCALE_MIN, fitWidthRatio: 1,
      canvasAvailShare: 0.68, canvasMaxCap: 320,
      shopRowBase: 52, shopRowMin: 44, shopRowMax: 58,
      heroSlotHeight: "100%", heroSlotMax: 220,
      sceneAvatarH: 110, sceneAvatarW: 96, dollSlot: 28, characterGap: 4,
      shopPanelW: 260,
    },
    "tablet-portrait": {
      fitAvailH: PREP_STACKED_CONTENT_H, fitMinScale: SCALE_MIN, fitWidthRatio: 1,
      canvasAvailShare: 0.48, canvasMaxCap: 375,
      shopRowBase: 68, shopRowMin: 56, shopRowMax: 84,
      heroSlotHeight: "min(400px, 44vh)", heroSlotMax: 420,
      sceneAvatarH: 200, sceneAvatarW: 148, dollSlot: 38, characterGap: 8,
      shopPanelW: 300, shopCols: 5,
    },
    "tablet-landscape": {
      fitAvailH: PREP_SIDE_CONTENT_H, fitMinScale: SCALE_MIN, fitWidthRatio: 1,
      canvasAvailShare: 0.52, canvasMaxCap: 420,
      shopRowBase: 88, shopRowMin: 72, shopRowMax: 100,
      heroSlotHeight: "min(54vh, 520px)", heroSlotMax: 560,
      sceneAvatarH: 148, sceneAvatarW: 118, dollSlot: 38, characterGap: 8,
      shopPanelW: 320,
    },
    "desktop-portrait": {
      fitAvailH: PREP_STACKED_CONTENT_H, fitMinScale: SCALE_MIN, fitWidthRatio: 1,
      canvasAvailShare: 0.32, canvasMaxCap: 260,
      shopRowBase: 72, shopRowMin: 56, shopRowMax: 76,
      heroSlotHeight: "min(54vh, 520px)", heroSlotMax: 560,
      sceneAvatarH: 152, sceneAvatarW: 120, dollSlot: 38, characterGap: 8,
      shopPanelW: 320,
    },
    "desktop-landscape": {
      fitAvailH: PREP_SIDE_CONTENT_H, fitMinScale: SCALE_MIN, fitWidthRatio: 1,
      canvasAvailShare: 0.30, canvasMaxCap: 280,
      shopRowBase: 66, shopRowMin: 54, shopRowMax: 74,
      heroSlotHeight: "min(54vh, 520px)", heroSlotMax: 560,
      sceneAvatarH: 152, sceneAvatarW: 120, dollSlot: 38, characterGap: 8,
      shopPanelW: 272,
    },
  };

  /** Solo lobby: уже solo prep — больше места под поле и плавающий roster. */
  const LOBBY_SHOP_PANEL_W = {
    "phone-portrait": 252,
    "phone-landscape": 224,
    "tablet-portrait": 252,
    "tablet-landscape": 216,
    "desktop-portrait": 248,
    "desktop-landscape": 228,
  };

  function isSoloLobbyPrepPhase() {
    const app = document.getElementById("app");
    const mode = app?.dataset?.gameMode || document.documentElement.dataset?.gameMode;
    return mode === "lobby" && app?.dataset?.phase === "prep";
  }

  function applyPrepProfileVars(layoutProfile, fitScale = 1) {
    const cfg = PREP_PROFILES[layoutProfile.id] || PREP_PROFILES["desktop-landscape"];
    const root = document.documentElement;
    const lobbyPrep = isSoloLobbyPrepPhase();
    root.style.setProperty("--prep-hero-slot-height", cfg.heroSlotHeight);
    root.style.setProperty("--prep-hero-slot-height-max", `${cfg.heroSlotMax}px`);
    root.style.setProperty("--prep-scene-avatar-h", `calc(${cfg.sceneAvatarH}px * var(--game-scale))`);
    root.style.setProperty("--prep-scene-avatar-w", `calc(${cfg.sceneAvatarW}px * var(--game-scale))`);
    root.style.setProperty("--doll-slot-size", `calc(${cfg.dollSlot}px * var(--game-scale))`);
    root.style.setProperty("--prep-character-gap", `${cfg.characterGap}px`);
    const shopPanelW = lobbyPrep
      ? (LOBBY_SHOP_PANEL_W[layoutProfile.id] ?? Math.round(cfg.shopPanelW * 0.68))
      : cfg.shopPanelW;
    root.style.setProperty("--shop-panel-w", `${shopPanelW}px`);
    const shopRowH = Math.round(Math.max(
      cfg.shopRowMin,
      Math.min(cfg.shopRowMax, cfg.shopRowBase * fitScale),
    ));
    const ipadMiniBoost = !lobbyPrep && layoutProfile.id === "tablet-landscape" && isIpadMiniPwaLandscape();
    const lobbyRowCap = layoutProfile.id === "tablet-landscape" ? 76 : 72;
    const rowH = lobbyPrep
      ? Math.max(cfg.shopRowMin, Math.min(lobbyRowCap, Math.round(shopRowH * 0.82)))
      : (ipadMiniBoost ? Math.max(shopRowH, 92) : shopRowH);
    root.style.setProperty("--prep-shop-row-h", `${rowH}px`);
    const shopIconSize = Math.round(rowH * (ipadMiniBoost ? 0.8 : 0.76));
    const shopIconFont = Math.round(rowH * (ipadMiniBoost ? 0.64 : 0.6));
    root.style.setProperty("--shop-card-row-h", `${rowH}px`);
    root.style.setProperty("--shop-item-icon-size", `${shopIconSize}px`);
    root.style.setProperty("--shop-item-icon-font", `${shopIconFont}px`);
    root.style.setProperty("--shop-item-icon-duo-width", `${Math.round(shopIconSize * 1.38)}px`);
    const benchRowH = Math.max(44, Math.round(rowH * 0.78));
    root.style.setProperty("--prep-bench-row-h", `${benchRowH}px`);
    if (cfg.shopCols) {
      root.style.setProperty("--prep-shop-cols", String(cfg.shopCols));
    } else {
      root.style.removeProperty("--prep-shop-cols");
    }
    return cfg;
  }

  function applyFluidGridMetrics(uiScale) {
    const root = document.documentElement;
    const cell = Math.round(Math.max(36, Math.min(46, 36 + 10 * uiScale)));
    const gap = Math.round(Math.max(20, Math.min(36, 20 + 16 * uiScale)));
    const statsW = Math.round(Math.max(248, Math.min(276, 248 + 28 * uiScale)));
    root.style.setProperty("--cell-size", `${cell}px`);
    root.style.setProperty("--grid-gap", `${gap}px`);
    root.style.setProperty("--battle-stats-panel-w", `${statsW}px`);
  }

  /** Коэффициенты боевой раскладки по battleProfile (доли vh/vw, min/max). */
  const BATTLE_PROFILES = {
    "phone-portrait": {
      heroFromVh: true, heroVh: 0.32, heroMin: 148, heroMax: 220,
      arenaVh: 0.30, arenaMin: 128,
      colMin: 140, colMax: 220, colShare: 0.48,
      imgRatio: 0.72, imgMin: 120, imgMax: 168,
      portraitZoom: 1.0, chromePad: 10, portraitObjectY: "100%",
      emojiScale: 1, floorShare: 0.30, heroShare: 0.28, portraitDuelShare: 0.30,
      fxFloatScale: 0.9, fxProjectileScale: 0.9,
    },
    "phone-landscape": {
      heroFromVh: false, heroZoneShare: 0.30, heroMin: 108, heroMax: 148,
      arenaVh: 0.28, arenaMin: 104,
      colMin: 92, colMax: 132, colShare: 0.21,
      imgRatio: 0.52, imgMin: 80, imgMax: 118,
      portraitZoom: 0.92, chromePad: 8, portraitObjectY: "100%",
      emojiScale: 1, floorShare: 0.42, heroShare: 0.26,
      fxFloatScale: 0.86, fxProjectileScale: 0.88,
    },
    "tablet-landscape-side": {
      heroFromVh: false, heroZoneShare: 0.44, heroMin: 200, heroMax: 360,
      arenaVh: 0.22, arenaMin: 120,
      colMin: 168, colMax: 300, colShare: 0.28,
      imgRatio: 0.78, imgMin: 180, imgMax: 300,
      portraitZoom: 0.96, chromePad: 14, portraitObjectY: "100%",
      emojiScale: 1, floorShare: 0.30, heroShare: 0.44,
      zoneShares: { player: 0.28, arena: 0.44, enemy: 0.28 },
      tabletSide: true,
      fxFloatScale: 1, fxProjectileScale: 1,
    },
    "tablet-portrait": {
      heroFromVh: false, heroZoneShare: 0.36, heroMin: 180, heroMax: 320,
      arenaVh: 0.12, arenaMin: 96,
      colMin: 100, colMax: 158, colShare: 0.22,
      imgRatio: 0.68, imgMin: 128, imgMax: 240,
      portraitZoom: 0.98, chromePad: 12, portraitObjectY: "100%",
      emojiScale: 1, floorShare: 0.28, heroShare: 0.28, portraitDuelShare: 0.28,
      fxFloatScale: 0.94, fxProjectileScale: 0.94,
    },
    "desktop-portrait": {
      heroFromVh: false, heroZoneShare: 0.58, heroMin: 300, heroMax: 520,
      arenaVh: 0.18, arenaMin: 120,
      colMin: 240, colMax: 400, colShare: 0.20,
      imgRatio: 0.88, imgMin: 280, imgMax: 480,
      portraitZoom: 1.1, chromePad: 20, portraitObjectY: "100%",
      emojiScale: 1, floorShare: 0.20, heroShare: 0.58,
      zoneShares: { player: 0.30, arena: 0.38, enemy: 0.30 },
      heroPortraitBleed: 1.14,
      fxFloatScale: 1, fxProjectileScale: 1,
    },
    "desktop-landscape": {
      heroFromVh: false, heroZoneShare: 0.58, heroMin: 300, heroMax: 520,
      arenaVh: 0.18, arenaMin: 120,
      colMin: 240, colMax: 400, colShare: 0.20,
      imgRatio: 0.88, imgMin: 280, imgMax: 480,
      portraitZoom: 1.1, chromePad: 20, portraitObjectY: "100%",
      emojiScale: 1, floorShare: 0.20, heroShare: 0.58,
      zoneShares: { player: 0.30, arena: 0.38, enemy: 0.30 },
      heroPortraitBleed: 1.14,
      fxFloatScale: 1, fxProjectileScale: 1,
    },
  };

  function computeBattleLayoutFromProfile(profileKey, { vh, hudReserve, stageW, measuredFieldH = 0, measuredArenaH = 0 }) {
    const cfg = BATTLE_PROFILES[profileKey] || BATTLE_PROFILES["desktop-landscape"];
    const usable = measuredFieldH > 120 ? measuredFieldH : (vh - hudReserve);
    const heroZone = cfg.heroFromVh
      ? Math.min(cfg.heroMax, Math.max(cfg.heroMin, Math.round(vh * cfg.heroVh)))
      : Math.min(cfg.heroMax, Math.max(cfg.heroMin, Math.round(usable * cfg.heroZoneShare)));
    let arenaMin = Math.max(cfg.arenaMin, Math.round(vh * cfg.arenaVh));
    if (measuredFieldH > 120 && cfg.floorShare) {
      const floorBudget = Math.round(measuredFieldH * cfg.floorShare);
      arenaMin = Math.max(cfg.arenaMin, Math.min(floorBudget, Math.round(measuredFieldH * 0.42)));
    }
    if (measuredArenaH > cfg.arenaMin * 0.45) {
      arenaMin = Math.max(arenaMin, Math.round(measuredArenaH));
    }
    const heroColW = Math.round(Math.min(cfg.colMax, Math.max(cfg.colMin, stageW * cfg.colShare)));
    const heroImgH = Math.round(Math.min(cfg.imgMax, Math.max(cfg.imgMin, heroZone * cfg.imgRatio)));
    return {
      cfg,
      heroZone,
      arenaMin,
      heroColW,
      heroImgH,
      portraitZoom: cfg.portraitZoom,
      chromePad: cfg.chromePad,
    };
  }

  function applyBattleFxScaleVars(profileKey) {
    const cfg = BATTLE_PROFILES[profileKey] || BATTLE_PROFILES["desktop-landscape"];
    const root = document.documentElement;
    const fx = cfg.fxFloatScale ?? 1;
    const proj = cfg.fxProjectileScale ?? fx;
    root.style.setProperty("--fx-float-scale", String(fx));
    root.style.setProperty("--fx-projectile-scale", String(proj));
  }

  function applyBattleProfileDataset(root, profileKey) {
    root.dataset.battleProfile = profileKey;
    root.dataset.heroCardMode = "full-bleed";
    applyBattleFxScaleVars(profileKey);
    if (profileKey === "phone-landscape") {
      root.dataset.battlePhoneLandscape = "true";
    } else {
      root.removeAttribute("data-battle-phone-landscape");
    }
    if (profileKey === "phone-portrait") {
      root.dataset.battleMobileStack = "true";
    } else {
      root.removeAttribute("data-battle-mobile-stack");
    }
  }

  function measurePrepChromeHeight() {
    const app = document.getElementById("app");
    if (!app || app.dataset.phase !== "prep") return 0;
    return measureBottomChromeHeight() + 4;
  }

  /** Измерение ключевых зон prep/battle после первого layout-прохода. */
  function measureLayoutZones() {
    const root = document.documentElement;
    const app = document.getElementById("app");
    if (!app) return null;

    const phase = app.dataset.phase;
    const zones = {
      phase,
      viewportH: viewportSize().h,
      appH: app.offsetHeight,
      topBar: 0,
      toolbar: 0,
      canvas: 0,
      hero: 0,
      chrome: measureBottomChromeHeight(),
      battleHero: 0,
      battleFloor: 0,
      used: 0,
    };

    if (phase === "prep") {
      const topBar = document.getElementById("prep-top-bar");
      const chromeBar = getBottomChrome();
      const island = document.getElementById("prep-field-island");
      const hero = document.querySelector("#app[data-phase=\"prep\"] .prep-character-layer");

      if (topBar && getComputedStyle(topBar).display !== "none") zones.topBar = topBar.offsetHeight;
      if (chromeBar && getComputedStyle(chromeBar).display !== "none") {
        const measured = readCssPx("--bottom-chrome-h-measured", 0);
        zones.toolbar = measured > 0 ? measured : chromeBar.offsetHeight;
      }
      if (island && getComputedStyle(island).display !== "none") {
        const canvasEl = document.getElementById("game-canvas");
        const stage = island.querySelector(".battle-canvas-stage");
        const fitMode = root.dataset.prepViewportFit === "true" || root.dataset.prepMobileFit === "true";
        let canvasZone = island.offsetHeight;
        if (fitMode) {
          const displayH = Math.max(canvasEl?.offsetHeight ?? 0, stage?.offsetHeight ?? 0);
          if (displayH > 20) {
            const pad = Math.round(10 * (readCssPx("--ui-scale", 1) || 1));
            canvasZone = Math.min(canvasZone, displayH + pad);
          }
        }
        zones.canvas = canvasZone;
      }
      if (hero && getComputedStyle(hero).display !== "none") zones.hero = hero.offsetHeight;

      zones.chrome = 0;
      const fieldCol = document.querySelector("#app[data-phase=\"prep\"] .prep-field-column");
      const shopPanel = document.getElementById("shop-panel");
      const fieldColZone = (root.dataset.prepViewportFit === "true"
        || root.dataset.prepMobileFit === "true"
        || root.dataset.uiSurface === "phone-landscape"
        || root.dataset.uiSurface === "tablet-side"
        || root.dataset.uiSurface === "tablet-stacked")
        && fieldCol
        && getComputedStyle(fieldCol).display !== "none";
      if (fieldColZone && root.dataset.uiSurface === "tablet-stacked" && root.dataset.prepShopDrawer !== "true") {
        const rowH = Math.max(
          fieldCol.offsetHeight,
          shopPanel && getComputedStyle(shopPanel).display !== "none" ? shopPanel.offsetHeight : 0,
        );
        zones.used = zones.topBar + rowH + zones.toolbar;
      } else {
        zones.used = zones.topBar + (fieldColZone ? fieldCol.offsetHeight : zones.canvas + zones.hero);
      }
    } else if (phase === "battle" || phase === "replay") {
      const sceneUi = document.getElementById("battle-scene-ui");
      const combatFloor = document.getElementById("battle-thought-arena");
      if (sceneUi && getComputedStyle(sceneUi).display !== "none") {
        zones.battleHero = sceneUi.offsetHeight;
      }
      if (combatFloor && getComputedStyle(combatFloor).display !== "none") {
        const assignedFloor = readCssPx("--battle-combat-floor-h", 0);
        zones.battleFloor = assignedFloor > 0
          ? assignedFloor
          : combatFloor.offsetHeight;
      }
      zones.used = zones.battleHero + zones.battleFloor + zones.chrome;
      root.style.setProperty("--zone-battle-hero-h", `${zones.battleHero}px`);
      root.style.setProperty("--zone-battle-floor-h", `${zones.battleFloor}px`);
    }

    root.style.setProperty("--zone-topbar-h", `${zones.topBar}px`);
    root.style.setProperty("--zone-toolbar-h", `${zones.toolbar}px`);
    root.style.setProperty("--zone-canvas-h", `${zones.canvas}px`);
    root.style.setProperty("--zone-hero-h", `${zones.hero}px`);
    root.style.setProperty("--zone-chrome-h", `${zones.chrome}px`);
    root.style.setProperty("--zone-used-h", `${zones.used}px`);
    syncMobileOverlayAnchors(zones);
    return zones;
  }

  /** Второй проход: поджать зоны, если не влезают в --app-h. */
  function applyMeasuredZoneFit(zones) {
    const root = document.documentElement;
    if (!zones) return;

    const appH = readCssPx("--app-h", zones.viewportH) || zones.appH;
    const phase = zones.phase;

    if (phase === "battle" || phase === "replay") {
      const floorMin = root.dataset.battlePhoneLandscape === "true" ? 64 : 72;
      if (zones.battleFloor > 0 && zones.battleFloor < floorMin && zones.battleHero > floorMin + 40) {
        const heroCap = Math.max(96, Math.round((appH - zones.chrome - floorMin) * 0.42));
        const curHero = readCssPx("--battle-hero-zone-h", zones.battleHero);
        if (curHero > heroCap) {
          root.style.setProperty("--battle-hero-zone-h", `${heroCap}px`);
          root.style.setProperty("--desktop-battle-hero-zone-h", `${heroCap}px`);
        }
      }
      return;
    }

    const prepLayout = root.dataset.prepLayout;
    const phoneLandscape = root.dataset.uiSurface === "phone-landscape";
    if (prepLayout !== "mobile" && prepLayout !== "stacked" && !phoneLandscape) {
      root.style.removeProperty("--zone-fit-shrink");
      return;
    }

    const overflow = zones.used - appH + 8;
    if (overflow <= 4) {
      root.style.removeProperty("--zone-fit-shrink");
      root.style.removeProperty("--prep-canvas-max-h-base");
      return;
    }

    const shrink = Math.max(0.86, appH / zones.used);
    root.style.setProperty("--zone-fit-shrink", String(roundScale(shrink)));

    let canvasBase = readCssPx("--prep-canvas-max-h-base", null);
    const canvasCur = readCssPx("--prep-canvas-max-h", null);
    if (canvasBase == null && canvasCur != null) {
      canvasBase = canvasCur;
      root.style.setProperty("--prep-canvas-max-h-base", `${Math.round(canvasBase)}px`);
    }
    if (canvasBase != null) {
      root.style.setProperty("--prep-canvas-max-h", `${Math.round(canvasBase * shrink)}px`);
      return;
    }

    const canvasMax = canvasCur;
    if (canvasMax != null) {
      root.style.setProperty("--prep-canvas-max-h", `${Math.round(canvasMax * shrink)}px`);
      return;
    }

    if (prepLayout === "mobile") {
      const app = document.getElementById("app");
      const canvasH = zones.canvas || document.getElementById("prep-field-island")?.offsetHeight || 0;
      if (canvasH > 100) {
        const newCap = Math.max(132, Math.round(canvasH * shrink));
        const capVar = `${newCap}px`;
        document.documentElement.style.setProperty("--prep-mobile-canvas-cap", capVar);
        app?.style.setProperty("--prep-mobile-canvas-cap", capVar);
      }
      return;
    }
  }

  function readCssPx(name, fallback = null) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const val = parseFloat(raw);
    return Number.isFinite(val) ? val : fallback;
  }

  function clearCanvasDisplaySize() {
    ["game-canvas", "canvas-fx"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.removeProperty("width");
      el.style.removeProperty("height");
      el.style.removeProperty("max-width");
      el.style.removeProperty("max-height");
    });
  }

  function setCanvasDisplaySize(canvas, w, h) {
    const curW = Math.round(parseFloat(canvas.style.width) || 0);
    const curH = Math.round(parseFloat(canvas.style.height) || 0);
    if (Math.abs(curW - w) <= 1 && Math.abs(curH - h) <= 1) return false;

    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.style.maxWidth = `${w}px`;
    canvas.style.maxHeight = `${h}px`;
    if (canvas.id === "game-canvas") {
      const fx = document.getElementById("canvas-fx");
      if (fx) {
        const fxW = Math.round(parseFloat(fx.style.width) || 0);
        const fxH = Math.round(parseFloat(fx.style.height) || 0);
        if (Math.abs(fxW - w) > 1 || Math.abs(fxH - h) > 1) {
          fx.style.width = `${w}px`;
          fx.style.height = `${h}px`;
          fx.style.maxWidth = `${w}px`;
          fx.style.maxHeight = `${h}px`;
        }
        if (canvas.width > 0 && canvas.height > 0) {
          fx.width = canvas.width;
          fx.height = canvas.height;
        }
      }
    }
    return true;
  }

  function syncFxCanvasGeometry() {
    const viewport = document.getElementById("prep-field-column");
    const canvasEl = document.getElementById("game-canvas");
    const anchor = document.getElementById("canvas-fx-anchor");
    if (!viewport || !canvasEl || !anchor) return;

    const vpRect = viewport.getBoundingClientRect();
    const canvasRect = canvasEl.getBoundingClientRect();
    if (canvasRect.width <= 0 || canvasRect.height <= 0) return;

    const sig = [
      Math.round(vpRect.left),
      Math.round(vpRect.top),
      Math.round(canvasRect.left),
      Math.round(canvasRect.top),
      Math.round(canvasRect.width),
      Math.round(canvasRect.height),
    ].join("|");
    if (syncFxCanvasGeometry._sig === sig) return;
    syncFxCanvasGeometry._sig = sig;

    anchor.style.left = `${canvasRect.left - vpRect.left}px`;
    anchor.style.top = `${canvasRect.top - vpRect.top}px`;
    anchor.style.width = `${canvasRect.width}px`;
    anchor.style.height = `${canvasRect.height}px`;
  }

  function syncPrepHeroSlotHeight() {
    syncPrepHeroSlotHeight._cache = null;
  }

  function syncPrepHeroCardPortraitSize() {
    const root = document.documentElement;
    const app = document.getElementById("app");
    const showHud = isPrepHeroCardHud(root)
      && app
      && (app.dataset.phase === "prep" || app.dataset.prepHeroHud === "true");

    if (!showHud) {
      root.style.removeProperty("--prep-hero-card-portrait-w");
      root.style.removeProperty("--prep-hero-card-portrait-h");
      root.style.removeProperty("--prep-hud-portrait-bust-scale");
      return;
    }

    const topBar = document.getElementById("prep-top-bar");
    if (!topBar) return;

    const hudW = topBar.clientWidth;
    if (hudW < 96) return;

    const uiScale = readCssPx("--ui-scale", 1);
    const share = readCssPx("--prep-hero-card-portrait-w-share", 0.38);
    const minW = readCssPx("--prep-hero-card-portrait-w-min", 148 * uiScale);
    const maxW = readCssPx("--prep-hero-card-portrait-w-max", 320 * uiScale);
    const portraitW = Math.round(Math.max(minW, Math.min(maxW, hudW * share)));

    const aspect = readCssPx("--prep-hero-card-portrait-ratio", 0.86);
    const maxH = readCssPx("--prep-hero-card-portrait-h-max", 280 * uiScale);
    const minH = readCssPx("--prep-hero-card-portrait-h-min", 168 * uiScale);
    const portraitH = Math.round(Math.max(minH, Math.min(maxH, portraitW / Math.max(0.72, aspect))));

    const refW = 156;
    const bustScale = Math.max(1.32, Math.min(2.05, 1.96 * (refW / portraitW)));

    root.style.setProperty("--prep-hero-card-portrait-w", `${portraitW}px`);
    root.style.setProperty("--prep-hero-card-portrait-h", `${portraitH}px`);
    root.style.setProperty("--prep-hud-portrait-bust-scale", bustScale.toFixed(3));
  }

  let prepHeroCardPortraitObserver = null;

  function ensurePrepHeroCardPortraitObserver() {
    if (prepHeroCardPortraitObserver || typeof ResizeObserver === "undefined") return;
    const topBar = document.getElementById("prep-top-bar");
    if (!topBar) return;
    prepHeroCardPortraitObserver = new ResizeObserver(() => {
      syncPrepHeroCardPortraitSize();
      syncOpenPrepTooltipDock();
    });
    prepHeroCardPortraitObserver.observe(topBar);
  }

  function syncClassOverlayAnchors() {
    const root = document.documentElement;
    const uiScale = readCssPx("--ui-scale", 1);
    const touchMin = readCssPx("--touch-target-min", 44);
    const fallback = Math.round(Math.max(72, touchMin + 24 * uiScale));

    let dockH = fallback;
    if (isClassOverlayOpen()) {
      const introReserve = readCssPx("--class-intro-chrome-h", 0);
      if (introReserve > 0) {
        dockH = Math.round(introReserve);
      } else {
        const chrome = getBottomChrome();
        if (chrome && getComputedStyle(chrome).display !== "none") {
          const h = chrome.getBoundingClientRect().height;
          dockH = Math.max(fallback, Math.round(h));
        }
      }
    }
    root.style.setProperty("--class-mobile-dock-h", `${dockH}px`);
    root.style.removeProperty("--class-modal-scroll-max-h");
    warnClassIntroViewportOverflow();
  }

  let classIntroOverflowWarned = false;

  /** localStorage bb-intro-overflow-debug=1 — предупреждение в консоли при переполнении intro. */
  function warnClassIntroViewportOverflow() {
    if (!isClassOverlayOpen()) {
      classIntroOverflowWarned = false;
      return;
    }
    let debug = false;
    try {
      debug = localStorage.getItem("bb-intro-overflow-debug") === "1"
        || new URLSearchParams(window.location.search).has("bbIntroOverflow");
    } catch {
      debug = false;
    }
    if (!debug) return;

    const modal = document.querySelector("#class-overlay:not(.hidden) .class-modal");
    const playerStep = document.getElementById("class-step-player");
    if (!modal) return;

    const modalOverflow = modal.scrollHeight - modal.clientHeight;
    const stepOverflow = playerStep && !playerStep.classList.contains("hidden")
      ? playerStep.scrollHeight - playerStep.clientHeight
      : 0;
    const worst = Math.max(modalOverflow, stepOverflow);
    if (worst <= 2) {
      classIntroOverflowWarned = false;
      return;
    }
    if (classIntroOverflowWarned) return;
    classIntroOverflowWarned = true;
    console.warn("[class-intro] viewport overflow", {
      modalPx: Math.round(modalOverflow),
      playerStepPx: Math.round(stepOverflow),
      modal: { scrollHeight: modal.scrollHeight, clientHeight: modal.clientHeight },
      playerStep: playerStep
        ? { scrollHeight: playerStep.scrollHeight, clientHeight: playerStep.clientHeight }
        : null,
      step: document.getElementById("class-overlay")?.dataset?.classIntroStep,
    });
  }

  function isTabletLandscapeSideBattle(root = document.documentElement) {
    return root.dataset.battleProfile === "tablet-landscape-side";
  }

  /** Flank-arena bust: HP на бёдрах портрета. Full-body prep-layer — ниже (usesBattleHudHipAnchor). */
  function usesBattleHudHipAnchor(root = document.documentElement) {
    if (root.dataset.battleHeroPlacement !== "flank-arena") return false;
    if (typeof usesBattlePrepHeroLayer === "function" && usesBattlePrepHeroLayer(root)) return false;
    const profile = root.dataset.battleProfile || "";
    return profile !== "phone-portrait" && profile !== "tablet-portrait";
  }

  function readBattleHudHipPortraitRatio(root = document.documentElement) {
    const raw = getComputedStyle(root).getPropertyValue("--battle-hud-hip-portrait-ratio").trim();
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.58;
  }

  function measureBattleHudBarsBlockPx(uiScale = readCssPx("--ui-scale", 1)) {
    const barH = Math.round(16 * uiScale);
    const gap = Math.round(3 * uiScale);
    return barH * 2 + gap;
  }

  /** Full-body: зарезервированная полоса под героем (чипы + HP/stamina). */
  function measureBattleHudVitalsBandPx(uiScale = readCssPx("--ui-scale", 1)) {
    const barsBlock = measureBattleHudBarsBlockPx(uiScale);
    const chipBand = Math.round(56 * uiScale);
    const gap = Math.round(6 * uiScale);
    return gap + chipBand + gap + barsBlock;
  }

  function measureBattleHudChipBandPx(uiScale = readCssPx("--ui-scale", 1)) {
    return Math.round(56 * uiScale);
  }

  function measureBattleHudSideRect(side) {
    const prepRect = measureBattlePrepHeroRect(side);
    if (prepRect && prepRect.height >= 48) return prepRect;
    if (typeof BattleHeroAnchor !== "undefined") {
      const ar = BattleHeroAnchor.getAvatarAnchorRect(side);
      if (ar && ar.height >= 48) return ar;
    }
    const slotId = side === "enemy" ? "enemy-avatar-slot" : "player-avatar-slot";
    const stage = document.getElementById(slotId)?.querySelector(".avatar-hero-stage");
    if (stage) {
      const stageRect = stage.getBoundingClientRect();
      if (stageRect.height >= 48) return stageRect;
    }
    return null;
  }

  /** Y верха блока HP/stamina (viewport-col coords) — по бёдрам героя. */
  function measureBattleHudHipTopVp(vpRect, root = document.documentElement) {
    const uiScale = readCssPx("--ui-scale", 1);
    const barsBlock = measureBattleHudBarsBlockPx(uiScale);
    const portraitRatio = readBattleHudHipPortraitRatio(root);
    const hipLines = ["player", "enemy"]
      .map((side) => {
        const rect = measureBattleHudSideRect(side);
        if (!rect) return null;
        return rect.top + rect.height * portraitRatio;
      })
      .filter((line) => line != null);

    if (hipLines.length) {
      const avgHip = hipLines.reduce((sum, line) => sum + line, 0) / hipLines.length;
      return Math.max(0, Math.round(avgHip - vpRect.top - barsBlock * 0.5));
    }

    const floorTop = readCssPx("--battle-combat-floor-top", 0);
    const floorH = readCssPx("--battle-combat-floor-h", 0);
    const floorRatioRaw = getComputedStyle(root).getPropertyValue("--battle-hud-hip-floor-ratio").trim();
    const floorRatio = parseFloat(floorRatioRaw) || 0.58;
    const heroRowTop = readCssPx("--battle-hero-row-top", 0);
    const heroImgH = readCssPx(
      "--battle-hero-img-h",
      readCssPx("--tablet-battle-hero-img-h", 280),
    );

    let hipLineLayout = heroRowTop + Math.round(28 * uiScale) + heroImgH * portraitRatio;
    if (floorH > 64) {
      const heroVisualBottom = heroRowTop + heroImgH;
      if (floorTop <= heroVisualBottom + 8) {
        hipLineLayout = floorTop + floorH * floorRatio;
      }
    }

    return Math.max(0, Math.round(hipLineLayout - barsBlock * 0.5));
  }

  function measureBattleHudPrepWidthPx(zoneW, prepRect, uiScale) {
    return Math.max(120, Math.min(
      Math.round(200 * uiScale),
      zoneW,
      Math.round(prepRect.width * 1.08),
    ));
  }

  function measureBattleHudPrepLeftVp(team, prepRect, vpRect, zoneLeft, zoneW, hudWidth, uiScale) {
    const edgeInset = Math.round(6 * uiScale);
    let hudLeft = team === "player"
      ? Math.round(prepRect.right - vpRect.left - hudWidth + edgeInset)
      : Math.round(prepRect.left - vpRect.left - edgeInset);
    hudLeft = Math.max(zoneLeft, Math.min(hudLeft, zoneLeft + zoneW - hudWidth));
    return hudLeft;
  }

  /** Full-body: HUD на всю колонку героя (чипы + полоски). */
  function measureBattleHudPrepColumnVp(team, prepRect, vpRect, zoneW, uiScale) {
    const hudWidth = Math.max(120, Math.min(Math.round(200 * uiScale), zoneW));
    const hudLeft = team === "player"
      ? Math.round(prepRect.left - vpRect.left)
      : Math.round(prepRect.right - vpRect.left - hudWidth);
    return { hudLeft, hudWidth };
  }

  /** Full-body prep hero: HUD (чипы + HP/stamina) над головой спрайта. */
  function measureBattleHudAboveHeroTopVp(heroRect, vpRect, hudHeight, uiScale = readCssPx("--ui-scale", 1)) {
    const gap = Math.round(6 * uiScale);
    const bandH = Math.max(40, Math.round(hudHeight));
    return Math.max(0, Math.round(heroRect.top - vpRect.top - bandH - gap));
  }

  function syncBattleHudAnchors() {
    if (syncBattleHudAnchors._raf) return;
    syncBattleHudAnchors._raf = requestAnimationFrame(() => {
      syncBattleHudAnchors._raf = 0;
      syncBattleHudAnchorsNow();
    });
  }

  function syncBattleHudAnchorsNow() {
    const viewport = document.getElementById("prep-field-column");
    const app = document.getElementById("app");
    if (!viewport || !app) return;
    const phase = app.dataset.phase;
    if (phase !== "battle" && phase !== "replay") return;

    const now = performance.now();
    const minGap = 180;
    if (syncBattleHudAnchorsNow._lastAt && now - syncBattleHudAnchorsNow._lastAt < minGap) return;
    syncBattleHudAnchorsNow._lastAt = now;

    const vpRect = viewport.getBoundingClientRect();
    const root = document.documentElement;
    const useFlankZones = root.dataset.battleHeroPlacement === "flank-arena";
    if (useFlankZones && root.dataset.prepHudPreset === "unit-frame") {
      root.setAttribute("data-battle-unit-frame-hud", "true");
      return;
    }
    root.removeAttribute("data-battle-unit-frame-hud");
    const tabletLandscapeSide = isTabletLandscapeSideBattle(root);
    const prepHeroLayer = typeof usesBattlePrepHeroLayer === "function"
      && usesBattlePrepHeroLayer(root);

    if (prepHeroLayer) {
      root.dataset.battleHudAboveHero = "true";
      root.style.setProperty(
        "--battle-vitals-band-h",
        `${measureBattleHudVitalsBandPx(readCssPx("--ui-scale", 1))}px`,
      );
    } else {
      root.removeAttribute("data-battle-hud-above-hero");
      root.style.removeProperty("--battle-vitals-band-h");
    }

    let sharedStageBottom = null;
    if (!prepHeroLayer && tabletLandscapeSide && useFlankZones) {
      const stageBottoms = ["player-avatar-slot", "enemy-avatar-slot"]
        .map((slotId) => document.getElementById(slotId)?.querySelector(".avatar-hero-stage"))
        .filter(Boolean)
        .map((stage) => stage.getBoundingClientRect().bottom)
        .filter((bottom) => bottom > 8);
      if (stageBottoms.length) sharedStageBottom = Math.max(...stageBottoms);
    }

    let sharedHudTopPx = null;
    const hipHudAnchor = usesBattleHudHipAnchor(root);
    if (hipHudAnchor) {
      sharedHudTopPx = measureBattleHudHipTopVp(vpRect, root);
    } else if (sharedStageBottom != null) {
      const barsGapEarly = Math.round(6 * readCssPx("--ui-scale", 1));
      const hudOverlapEarly = readCssPx("--hero-hud-overlap", Math.round(16 * readCssPx("--ui-scale", 1)));
      sharedHudTopPx = Math.max(0, Math.round(sharedStageBottom - vpRect.top + barsGapEarly - hudOverlapEarly));
    }

    if (!syncBattleHudAnchorsNow._hudSig) syncBattleHudAnchorsNow._hudSig = { player: "", enemy: "" };
    let thoughtSlotsDirty = false;

    [
      {
        team: "player",
        slotId: "player-avatar-slot",
        panelId: "player-avatar-panel",
        hudId: "battle-hud-player",
        zoneLeftVar: "--battle-player-zone-left",
        zoneWidthVar: "--battle-player-zone-width",
      },
      {
        team: "enemy",
        slotId: "enemy-avatar-slot",
        panelId: "enemy-avatar-panel",
        hudId: "battle-hud-enemy",
        zoneLeftVar: "--battle-enemy-zone-left",
        zoneWidthVar: "--battle-enemy-zone-width",
      },
    ].forEach(({ team, slotId, panelId, hudId, zoneLeftVar, zoneWidthVar }) => {
      const slot = document.getElementById(slotId);
      const panel = document.getElementById(panelId);
      const hud = document.getElementById(hudId);
      if (!slot || !hud) return;

      const uiScale = readCssPx("--ui-scale", 1);
      const barsGap = Math.round(6 * uiScale);

      if (prepHeroLayer) {
        const prepRect = measureBattlePrepHeroRect(team);
        if (prepRect && prepRect.height >= 48) {
          const zoneW = readCssPx(zoneWidthVar, 180);
          const column = measureBattleHudPrepColumnVp(team, prepRect, vpRect, zoneW, uiScale);
          const barsBlock = measureBattleHudBarsBlockPx(uiScale);
          const chipBand = measureBattleHudChipBandPx(uiScale);
          const hudHeight = chipBand + barsGap + barsBlock;
          const hudTopPx = measureBattleHudAboveHeroTopVp(prepRect, vpRect, hudHeight, uiScale);

          hud.style.left = `${column.hudLeft}px`;
          hud.style.width = `${column.hudWidth}px`;
          hud.style.maxWidth = `${column.hudWidth}px`;
          hud.style.top = `${hudTopPx}px`;
          root.style.setProperty(`--battle-hud-anchor-top-${team}`, `${hudTopPx}px`);

          hud.style.setProperty("--battle-hud-status-max-h", `${chipBand}px`);
          hud.style.setProperty("--battle-hud-max-h", `${chipBand + barsGap + barsBlock}px`);
          hud.style.setProperty("--battle-hud-chip-band-h", `${chipBand}px`);
          return;
        }
      }

      const shell = slot.querySelector(".avatar-hero-shell");
      const upper = shell?.querySelector(".avatar-hero-upper");
      const badge = shell?.querySelector(".avatar-hero-weapon-badge");
      const stage = shell?.querySelector(".avatar-hero-stage");
      const anchor = stage || upper || shell || slot;
      const anchorRect = anchor.getBoundingClientRect();
      const stageRect = stage?.getBoundingClientRect();
      const upperRect = upper?.getBoundingClientRect();

      let anchorBottom = anchorRect.bottom;
      if (sharedStageBottom != null) {
        anchorBottom = sharedStageBottom;
      } else if (badge) {
        const badgeRect = badge.getBoundingClientRect();
        if (badgeRect.height > 2) anchorBottom = Math.max(anchorBottom, badgeRect.bottom);
      } else if (upperRect && upperRect.height > 8) {
        anchorBottom = Math.max(anchorBottom, upperRect.bottom);
      }
      if (stageRect && stageRect.height > 8) {
        anchorBottom = Math.max(anchorBottom, stageRect.bottom);
      }

      let hudLeft = anchorRect.left - vpRect.left;
      let hudWidth = Math.max(anchorRect.width, 120);

      if (useFlankZones) {
        const zoneLeft = readCssPx(zoneLeftVar, hudLeft);
        const zoneW = readCssPx(zoneWidthVar, hudWidth);
        const panelRect = panel?.getBoundingClientRect();
        const edgeInset = Math.round(6 * uiScale);
        if (hipHudAnchor) {
          hudWidth = Math.max(120, Math.min(Math.round(200 * uiScale), zoneW));
          const liveRect = measureBattleHudSideRect(team);
          if (liveRect) {
            hudLeft = measureBattleHudPrepLeftVp(team, liveRect, vpRect, zoneLeft, zoneW, hudWidth, uiScale);
          } else {
            hudLeft = team === "player"
              ? zoneLeft + zoneW - hudWidth - edgeInset
              : zoneLeft + edgeInset;
          }
        } else if (tabletLandscapeSide && stageRect && stageRect.width > 40) {
          hudLeft = stageRect.left - vpRect.left;
          hudWidth = Math.max(120, Math.min(zoneW, Math.round(stageRect.width)));
        } else if (panelRect && panelRect.width > 8) {
          hudLeft = panelRect.left - vpRect.left;
          hudWidth = Math.max(120, Math.min(zoneW, panelRect.width));
        } else {
          hudLeft = zoneLeft;
          hudWidth = Math.max(120, zoneW - Math.round(8 * readCssPx("--ui-scale", 1)));
        }
      }

      const hudOverlap = useFlankZones
        ? readCssPx("--hero-hud-overlap", Math.round(16 * readCssPx("--ui-scale", 1)))
        : 0;
      let hudTopPx = sharedHudTopPx != null
        ? sharedHudTopPx
        : Math.max(0, Math.round(anchorBottom - vpRect.top + barsGap - hudOverlap));
      if (!hipHudAnchor && sharedHudTopPx == null && stageRect && stageRect.height > 8) {
        const minTop = Math.round(stageRect.bottom - vpRect.top + barsGap);
        if (hudTopPx < minTop) hudTopPx = minTop;
      }

      const heroRowTop = readCssPx("--battle-hero-row-top", 0);
      const heroZoneH = readCssPx("--battle-hero-zone-h-active", readCssPx("--battle-hero-zone-h", 0));
      let statusMaxSig = "";
      if (heroZoneH > 40) {
        const heroRowBottomVp = heroRowTop + heroZoneH - vpRect.top;
        const maxHudH = Math.max(40, Math.round(heroRowBottomVp - hudTopPx - barsGap));
        statusMaxSig = String(maxHudH);
      }

      const hudSig = [
        Math.round(hudLeft),
        hudTopPx,
        Math.round(hudWidth),
        statusMaxSig,
      ].join("|");
      if (syncBattleHudAnchorsNow._hudSig[team] !== hudSig) {
        syncBattleHudAnchorsNow._hudSig[team] = hudSig;
        thoughtSlotsDirty = true;
        hud.style.left = `${Math.round(hudLeft)}px`;
        hud.style.top = `${hudTopPx}px`;
        hud.style.width = `${Math.round(hudWidth)}px`;
        hud.style.maxWidth = `${Math.round(hudWidth)}px`;
        root.style.setProperty(`--battle-hud-anchor-top-${team}`, `${hudTopPx}px`);

        if (heroZoneH > 40) {
          hud.style.setProperty("--battle-hud-max-h", `${statusMaxSig}px`);
        }

        if (useFlankZones && tabletLandscapeSide) {
          const thoughtBand = readCssPx(
            "--battle-thought-band-h",
            typeof BattleHeroAnchor !== "undefined" ? BattleHeroAnchor.thoughtSlotSize() : 150,
          );
          const barsMin = Math.round(54 * uiScale);
          const maxHudH = readCssPx("--battle-hud-max-h", 0);
          if (maxHudH > barsMin + 8) {
            const statusMax = Math.max(48, maxHudH - barsMin - Math.round(8 * uiScale));
            hud.style.setProperty("--battle-hud-status-max-h", `${statusMax}px`);
          }
        }
      }
    });

    if (sharedHudTopPx != null) {
      root.style.setProperty("--battle-hud-anchor-top", `${sharedHudTopPx}px`);
    }

    if (typeof syncBattleHudSurfaceFlags === "function") syncBattleHudSurfaceFlags();
    if (useFlankZones && thoughtSlotsDirty) syncHeroEmotionSlotAnchors();
    if (thoughtSlotsDirty) syncHeroAttackSlotAnchors();
  }

  /** Зона атакующей экипировки — в combat floor по колонкам героев. */
  function syncHeroAttackSlotAnchors() {
    const root = document.documentElement;
    if (root.dataset.battleHeroPlacement !== "flank-arena") return;

    const viewport = document.getElementById("prep-field-column");
    const sceneUi = document.getElementById("battle-scene-ui");
    const objectsLayer = document.getElementById("layer-objects");
    if (!viewport || !sceneUi) return;

    const sceneRect = sceneUi.getBoundingClientRect();
    const uiScale = readCssPx("--ui-scale", 1);
    const gap = Math.round(6 * uiScale);
    const minH = Math.round(76 * uiScale);
    const useCombatFloor = typeof BattleHeroAnchor !== "undefined"
      && BattleHeroAnchor.usesCombatFloorAnchors();
    const floorRect = useCombatFloor ? BattleHeroAnchor.getCombatFloorRect() : null;
    const layoutRect = objectsLayer?.getBoundingClientRect();

    [
      { slotId: "player-attack-arena", hudId: "battle-hud-player", side: "player", zoneLeftVar: "--battle-player-zone-left", zoneWidthVar: "--battle-player-zone-width" },
      { slotId: "enemy-attack-arena", hudId: "battle-hud-enemy", side: "enemy", zoneLeftVar: "--battle-enemy-zone-left", zoneWidthVar: "--battle-enemy-zone-width" },
    ].forEach(({ slotId, hudId, side, zoneLeftVar, zoneWidthVar }) => {
      const slot = document.getElementById(slotId);
      const hud = document.getElementById(hudId);
      if (!slot || !hud) return;

      let left;
      let top;
      let width;
      let height;

      if (floorRect && layoutRect && layoutRect.width > 0) {
        const zoneLeft = readCssPx(zoneLeftVar, 0);
        const zoneW = readCssPx(zoneWidthVar, 120);
        left = layoutRect.left + zoneLeft - sceneRect.left;
        top = floorRect.top - sceneRect.top;
        width = zoneW;
        height = Math.max(minH, floorRect.height);
      } else {
        const hudRect = hud.getBoundingClientRect();
        if (hudRect.width <= 0) return;

        left = hudRect.left - sceneRect.left;
        top = hudRect.bottom - sceneRect.top + gap;
        width = hudRect.width;
        const panelBottom = sceneRect.bottom - gap;
        height = Math.max(minH, panelBottom - top);
      }

      slot.style.position = "absolute";
      slot.style.left = `${Math.round(left)}px`;
      slot.style.top = `${Math.round(top)}px`;
      slot.style.width = `${Math.round(width)}px`;
      slot.style.height = `${Math.round(Math.max(minH, height))}px`;
      slot.style.right = "auto";
      slot.style.bottom = "auto";
    });

    if (typeof ArenaEquipment !== "undefined" && ArenaEquipment.onResize) {
      ArenaEquipment.onResize();
    }
  }

  function clearMobileDisplayVars() {
    const root = document.documentElement;
    root.dataset.battleMobileFit = "false";
    [
      "--battle-canvas-display-w",
      "--battle-canvas-display-h",
      "--battle-field-display-w",
      "--battle-grid-gap-display",
      "--mobile-battle-hero-zone-h",
      "--mobile-battle-portrait-h",
      "--mobile-battle-hero-img-h",
      "--mobile-battle-thought-arena-min-h",
      "--battle-hero-card-h",
      "--prep-canvas-display-w",
      "--prep-canvas-display-h",
      "--prep-shop-fab-top",
      "--prep-shop-fab-right",
      "--prep-sell-fab-top",
      "--prep-canvas-zone-bottom",
      "--prep-hero-zone-top",
      "--prep-hero-zone-bottom",
      "--prep-toolbar-zone-top",
      "--prep-mobile-fab-bottom",
      "--prep-mobile-fab-right",
      "--prep-doll-layer-bottom",
    ].forEach((name) => root.style.removeProperty(name));
  }

  function usesPrepShopDrawer() {
    if (typeof window.usesPrepShopDrawer === "function") {
      return window.usesPrepShopDrawer();
    }
    const root = document.documentElement;
    return root.dataset.prepLayout === "mobile"
      || root.dataset.prepShopDrawer === "true";
  }

  function syncMobileOverlayAnchors(zones) {
    const root = document.documentElement;
    const app = document.getElementById("app");
    const phase = zones?.phase || app?.dataset.phase || "prep";

    if (!usesPrepShopDrawer()) {
      [
        "--prep-shop-fab-top",
        "--prep-sell-fab-top",
        "--prep-canvas-zone-bottom",
        "--prep-hero-zone-top",
        "--prep-hero-zone-bottom",
        "--prep-toolbar-zone-top",
        "--prep-mobile-fab-bottom",
        "--prep-mobile-fab-right",
        "--prep-doll-layer-bottom",
        "--prep-shop-sheet-max-h",
        "--prep-shop-sheet-bottom",
      ].forEach((name) => root.style.removeProperty(name));
      return;
    }

    const chrome = getBottomChrome();
    const uiScale = readCssPx("--ui-scale", 1);
    const gap = Math.round(8 * uiScale);
    const edgeInset = Math.round(readCssPx("--prep-mobile-edge-inset", readCssPx("--gap-md", 12) * uiScale));
    const fabSize = Math.round(readCssPx("--prep-shop-fab-size", 56));
    const vh = window.visualViewport?.height ?? window.innerHeight;

    if (chrome && getComputedStyle(chrome).display !== "none") {
      const toolbarTop = Math.round(chrome.getBoundingClientRect().top);
      root.style.setProperty("--prep-toolbar-zone-top", `${toolbarTop}px`);
      root.style.setProperty("--prep-mobile-fab-bottom", `${Math.max(gap, vh - toolbarTop + gap)}px`);
    } else if (zones?.toolbar > 0) {
      const toolbarTop = Math.round(vh - zones.toolbar);
      root.style.setProperty("--prep-toolbar-zone-top", `${toolbarTop}px`);
      root.style.setProperty("--prep-mobile-fab-bottom", `${Math.max(gap, zones.toolbar + gap)}px`);
    }

    root.style.setProperty("--prep-mobile-fab-right", `${edgeInset}px`);

    const fabBottom = readCssPx("--prep-mobile-fab-bottom", fabSize + gap);
    root.style.setProperty("--prep-doll-layer-bottom", `${Math.round(fabBottom + fabSize + gap)}px`);

    if (phase !== "prep") return;

    const island = document.getElementById("prep-field-island");
    const hero = document.querySelector("#app[data-phase=\"prep\"] .prep-character-layer");

    if (island && getComputedStyle(island).display !== "none") {
      root.style.setProperty("--prep-canvas-zone-bottom", `${Math.round(island.getBoundingClientRect().bottom)}px`);
    }
    if (hero && getComputedStyle(hero).display !== "none") {
      const hr = hero.getBoundingClientRect();
      if (hr.height > 40) {
        root.style.setProperty("--prep-hero-zone-top", `${Math.round(hr.top)}px`);
        root.style.setProperty("--prep-hero-zone-bottom", `${Math.round(hr.bottom)}px`);
      }
    }

    const heroTop = readCssPx("--prep-hero-zone-top", 0);
    const heroBottom = readCssPx("--prep-hero-zone-bottom", 0);
    const canvasBottom = readCssPx("--prep-canvas-zone-bottom", 0);
    const toolbarTop = readCssPx("--prep-toolbar-zone-top", 0);

    let zoneTop = canvasBottom + gap;
    let zoneBottom = toolbarTop - gap;
    if (heroBottom > heroTop + 48) {
      zoneTop = heroTop + gap;
      zoneBottom = heroBottom - gap;
    }
    if (zoneBottom > zoneTop + fabSize) {
      const centeredTop = Math.round((zoneTop + zoneBottom) / 2 - fabSize / 2);
      const top = Math.max(zoneTop, Math.min(centeredTop, zoneBottom - fabSize));
      root.style.setProperty("--prep-shop-fab-top", `${top}px`);
      root.style.setProperty("--prep-sell-fab-top", `${Math.max(zoneTop, top - fabSize - gap)}px`);
    }

    if (toolbarTop > 0) {
      const appH = readCssPx("--app-h", vh);
      const isTabletDrawer = root.dataset.prepShopDrawer === "true"
        && root.dataset.uiSurface === "tablet-stacked";
      if (isTabletDrawer) {
        const topBar = readCssPx("--zone-topbar-h", 0)
          || document.getElementById("prep-top-bar")?.offsetHeight
          || 48;
        const sheetH = Math.max(340, Math.round(toolbarTop - topBar - gap * 2));
        root.style.setProperty("--prep-shop-sheet-max-h", `${sheetH}px`);
      } else {
        const sheetShare = 0.62;
        const tokenCap = Math.min(Math.round(appH * sheetShare), Math.round(vh * sheetShare));
        const peekTop = Math.max(canvasBottom, heroTop, Math.round(vh * 0.18));
        const corridorCap = Math.max(160, Math.round(toolbarTop - gap - peekTop));
        root.style.setProperty(
          "--prep-shop-sheet-max-h",
          `${Math.max(160, Math.min(tokenCap, corridorCap))}px`,
        );
      }
      root.style.setProperty("--prep-shop-sheet-bottom", `${Math.max(0, Math.round(vh - toolbarTop))}px`);
    }

    if (typeof window.syncPrepSellFabVisibility === "function") {
      window.syncPrepSellFabVisibility();
    }
  }

  /** @deprecated alias — используйте syncMobileOverlayAnchors */
  function syncPrepMobileZoneAnchors(zones) {
    syncMobileOverlayAnchors(zones);
  }

  function syncPrepBenchPopoverMode(prepLayout) {
    const root = document.documentElement;
    const surface = root.dataset.uiSurface;
    const drawer = root.dataset.prepShopDrawer === "true";
    const use = prepLayout === "side"
      && !drawer
      && (surface === "tablet-side" || surface === "desktop");
    if (use) {
      root.dataset.prepBenchPopover = "true";
    } else {
      root.removeAttribute("data-prep-bench-popover");
    }
    if (typeof window.syncPrepBenchFabBadge === "function") {
      window.syncPrepBenchFabBadge();
    }
    if (typeof window.syncBenchMount === "function") {
      window.syncBenchMount();
    }
  }

  function syncPrepShopPopoverMode(prepLayout) {
    const root = document.documentElement;
    const surface = root.dataset.uiSurface;
    const drawer = root.dataset.prepShopDrawer === "true";
    const use = prepLayout === "side"
      && !drawer
      && (surface === "tablet-side" || surface === "desktop");
    if (use) {
      root.dataset.prepShopPopover = "true";
    } else {
      root.removeAttribute("data-prep-shop-popover");
    }
    if (typeof window.syncShopMount === "function") {
      window.syncShopMount();
    }
    if (typeof window.syncPrepShopPopoverPosition === "function") {
      window.syncPrepShopPopoverPosition();
    }
  }

  function getPrepSideCommerceAnchorLeft(gap = 8) {
    const panelW = readCssPx("--shop-panel-w", 248);
    return Math.round(window.innerWidth - panelW - gap);
  }

  /** FAB скамейки — вплотную к левому краю колонки магазина (или справа от неё на enemy prep). */
  function getPrepBenchFabAnchorLeft(gap, fabSize) {
    const enemySide = document.getElementById("app")?.dataset.prepSide === "enemy";
    const panelW = readCssPx("--shop-panel-w", 300);
    const shop = document.getElementById("shop-panel");
    const shopRect = shop?.getBoundingClientRect();
    const shopVisible = !!(shopRect && shopRect.width > 8
      && shop && getComputedStyle(shop).display !== "none");

    let fabLeft;
    if (enemySide) {
      if (shopVisible) {
        fabLeft = Math.round(shopRect.right + gap);
      } else {
        fabLeft = Math.round(gap);
      }
    } else if (shopVisible) {
      fabLeft = Math.round(shopRect.left - fabSize);
    } else {
      fabLeft = Math.round(window.innerWidth - panelW - fabSize);
    }

    const corridor = measurePrepHeroGridCorridor(gap);
    if (corridor) {
      if (enemySide) {
        fabLeft = Math.min(fabLeft, Math.round(corridor.right - fabSize));
        fabLeft = Math.max(corridor.left, fabLeft);
      } else {
        fabLeft = Math.max(corridor.left, fabLeft);
        fabLeft = Math.min(fabLeft, Math.round(corridor.right - fabSize));
      }
    }

    return fabLeft;
  }

  function syncPrepSideFabAnchorRight(root, gap) {
    const right = `${Math.round(gap)}px`;
    root.style.setProperty("--prep-sell-fab-right", right);
  }

  /** Prep grid/island rect — якорь для popover магазина (не перекрывать поле). */
  function measurePrepFieldRect() {
    const island = document.getElementById("prep-field-island");
    const canvas = document.getElementById("game-canvas");
    const scaleWrap = document.querySelector("#prep-field-island .canvas-scale-wrap");
    const islandRect = island?.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    const scaleRect = scaleWrap?.getBoundingClientRect();
    if (scaleRect && scaleRect.width >= 40) return scaleRect;
    if (canvasRect && canvasRect.width >= 40) return canvasRect;
    if (islandRect && islandRect.width >= 40) return islandRect;
    return null;
  }

  /** Коридор hero ↔ grid (canvas), без учёта открытого магазина. */
  function measurePrepHeroGridCorridor(gap) {
    const heroLayer = document.getElementById("prep-character-layer");
    const fieldIsland = document.getElementById("prep-field-island");
    const canvas = document.getElementById("game-canvas");
    const topBar = document.getElementById("prep-top-bar");
    const bottomChrome = getBottomChrome();
    const enemySide = document.getElementById("app")?.dataset.prepSide === "enemy";

    const islandRect = fieldIsland?.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    const gridRect = (canvasRect && canvasRect.width >= 40) ? canvasRect : islandRect;
    const heroRect = heroLayer?.getBoundingClientRect();
    const topBarRect = topBar?.getBoundingClientRect();
    const bottomRect = bottomChrome?.getBoundingClientRect();
    const vv = window.visualViewport;
    const viewTop = vv?.offsetTop ?? 0;
    const viewBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight);

    if (!gridRect || gridRect.width < 40) return null;

    let left;
    let right;
    if (enemySide) {
      if (!heroRect || heroRect.width < 24) return null;
      left = gridRect.right + gap;
      right = heroRect.left - gap;
    } else {
      left = heroRect && heroRect.width > 24 ? heroRect.right + gap : gap;
      right = gridRect.left - gap;
    }
    if (right - left < 48) return null;

    const top = (topBarRect?.bottom ?? viewTop) + gap;
    const bottom = (bottomRect?.top ?? viewBottom) - gap;
    if (bottom <= top + 48) return null;

    return {
      left: Math.round(left),
      right: Math.round(right),
      top: Math.round(top),
      bottom: Math.round(bottom),
    };
  }

  /** Popover магазина — только в коридоре между героем и сеткой. */
  function syncPrepShopPopoverRect(gap, panelW, uiScale) {
    const island = document.getElementById("prep-field-island");
    const canvas = document.getElementById("game-canvas");
    const islandRect = island?.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();

    const corridor = measurePrepHeroGridCorridor(gap);
    if (corridor) {
      const shopW = corridor.right - corridor.left;
      return {
        corridorLeft: corridor.left,
        corridorW: shopW,
        corridorRight: corridor.right,
        corridorTop: corridor.top,
        corridorHeight: corridor.bottom - corridor.top,
        topSourceRect: islandRect ?? canvasRect,
      };
    }

    const shopTargetW = Math.min(Math.round(panelW + 4 * uiScale), Math.round(236 * uiScale));
    const shopMinW = Math.round(120 * uiScale);
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const shopRight = Math.round(vw - gap * 4);
    const shopLeft = shopRight - shopTargetW;

    return {
      corridorLeft: shopLeft,
      corridorW: Math.max(shopMinW, shopTargetW),
      corridorRight: shopRight,
      topSourceRect: islandRect ?? canvasRect,
    };
  }

  /** Popover скамейки — якорь у FAB в коридоре hero↔grid, раскрытие в сторону героя. */
  function syncPrepBenchPopoverRect(gap, panelW, uiScale) {
    const fab = document.getElementById("btn-prep-bench-fab");
    const fabRect = fab?.getBoundingClientRect();
    const benchTargetW = Math.min(
      Math.round(320 * uiScale),
      Math.round(panelW * 1.08 + 8 * uiScale),
    );
    const benchMinW = Math.round(168 * uiScale);
    const enemySide = document.getElementById("app")?.dataset.prepSide === "enemy";
    const heroLayer = document.getElementById("prep-character-layer");
    const heroRect = heroLayer?.getBoundingClientRect();
    const heroBound = heroRect && heroRect.width > 24
      ? (enemySide ? Math.round(heroRect.right - gap) : Math.round(heroRect.right + gap))
      : (enemySide ? window.innerWidth - gap : gap);

    if (fabRect && fabRect.width > 8) {
      let benchLeft;
      let benchRight;
      if (enemySide) {
        benchLeft = Math.round(fabRect.left);
        benchRight = Math.min(heroBound, benchLeft + benchTargetW);
        benchLeft = Math.max(gap, benchRight - benchTargetW);
      } else {
        benchRight = Math.round(fabRect.right);
        benchLeft = Math.max(gap, heroBound, benchRight - benchTargetW);
        benchRight = benchLeft + Math.max(benchMinW, Math.min(benchTargetW, benchRight - benchLeft));
      }
      const benchW = Math.max(benchMinW, benchRight - benchLeft);
      return {
        corridorLeft: benchLeft,
        corridorW: benchW,
        opensTowardHero: enemySide ? "right" : "left",
      };
    }

    const corridor = measurePrepHeroGridCorridor(gap);
    if (corridor) {
      const benchW = Math.max(benchMinW, Math.min(benchTargetW, corridor.right - corridor.left));
      if (enemySide) {
        return {
          corridorLeft: Math.max(gap, corridor.left),
          corridorW: benchW,
          opensTowardHero: "right",
        };
      }
      return {
        corridorLeft: Math.max(gap, heroBound, corridor.right - benchW),
        corridorW: benchW,
        opensTowardHero: "left",
      };
    }

    let benchRight = Math.round(window.innerWidth - gap);
    let benchLeft = benchRight - benchTargetW;
    benchLeft = Math.max(gap, benchLeft);
    const benchW = Math.max(benchMinW, benchRight - benchLeft);

    return { corridorLeft: benchLeft, corridorW: benchW, opensTowardHero: "left" };
  }

  function syncPrepCommerceCorridorRect(gap, panelW, uiScale) {
    const island = document.getElementById("prep-field-island");
    const canvas = document.getElementById("game-canvas");
    const heroLayer = document.getElementById("prep-character-layer");
    const islandRect = island?.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    const heroRect = heroLayer?.getBoundingClientRect();

    const fieldRect = measurePrepFieldRect();
    const prepColRect = document.getElementById("prep-left-column")?.getBoundingClientRect();

    const popoverTargetW = Math.min(392, Math.round(panelW * 1.12 + 12 * uiScale));
    const fabSize = readCssPx("--prep-bench-fab-size", 75 * uiScale);
    const fabRight = readCssPx("--prep-bench-fab-right", panelW + gap);
    const corridorRight = Math.round(window.innerWidth - fabRight - fabSize - gap);
    const corridorInnerRight = corridorRight - gap;

    const fieldBound = fieldRect ? Math.round(fieldRect.right + gap) : 0;
    const heroBound = heroRect && heroRect.width > 24
      ? Math.round(heroRect.right + gap)
      : gap;
    const commerceLeft = prepColRect
      ? Math.round(prepColRect.right + gap)
      : Math.max(gap, heroBound);
    const minPanelLeft = Math.max(gap, heroBound, commerceLeft, fieldBound);
    const panelRight = corridorInnerRight;
    const availableW = Math.max(0, panelRight - minPanelLeft);
    let corridorW = Math.min(popoverTargetW, availableW);
    corridorW = Math.max(120, corridorW);
    let corridorLeft = panelRight - corridorW;
    if (corridorLeft < minPanelLeft) {
      corridorLeft = minPanelLeft;
      corridorW = Math.max(120, panelRight - corridorLeft);
    }

    return { corridorLeft, corridorW, topSourceRect: islandRect ?? canvasRect };
  }

  function syncPrepShopPopoverPosition() {
    const root = document.documentElement;
    if (root.dataset.prepShopPopover !== "true") return;
    if (document.getElementById("app")?.dataset.phase !== "prep") return;

    const uiScale = readCssPx("--ui-scale", 1);
    const gap = Math.round(8 * uiScale);
    const panelW = readCssPx("--shop-panel-w", 300);

    const chrome = getBottomChrome();
    const chromeTop = chrome && getComputedStyle(chrome).display !== "none"
      ? chrome.getBoundingClientRect().top
      : (window.visualViewport?.height ?? window.innerHeight);

    const { corridorLeft, corridorW, corridorTop, corridorHeight, topSourceRect } = syncPrepShopPopoverRect(gap, panelW, uiScale);
    const top = corridorTop != null
      ? corridorTop
      : Math.round(Math.max(gap, topSourceRect?.top ?? gap));
    const height = corridorHeight != null
      ? corridorHeight
      : Math.max(180, Math.round(chromeTop - gap - top));

    root.style.setProperty("--prep-shop-popover-x", `${corridorLeft}px`);
    root.style.removeProperty("--prep-shop-popover-right");
    root.style.setProperty("--prep-shop-popover-y", `${top}px`);
    root.style.setProperty("--prep-shop-popover-w", `${corridorW}px`);
    root.style.setProperty("--prep-shop-popover-max-h", `${height}px`);
    root.style.removeProperty("--prep-shop-popover-h");
    syncOpenPrepTooltipDock();
  }

  function syncPrepSellFabPosition() {
    const root = document.documentElement;
    if (typeof window.usesPrepSellFab !== "function" || !window.usesPrepSellFab()) return;
    if (document.getElementById("app")?.dataset.phase !== "prep") return;

    const uiScale = readCssPx("--ui-scale", 1);
    const gap = Math.round(8 * uiScale);
    const surface = root.dataset.uiSurface;
    const mobileDrawerOnly = root.dataset.prepLayout === "mobile"
      || root.dataset.prepShopDrawer === "true";

    if (mobileDrawerOnly) return;

    const shop = document.getElementById("shop-panel");
    const shopRect = shop?.getBoundingClientRect();
    const baseFabPx = (surface === "tablet-side" || surface === "desktop") ? 75 : 56;
    const fabSize = Math.round(readCssPx("--prep-sell-fab-size", baseFabPx * uiScale));
    root.style.setProperty("--prep-sell-fab-size", `${fabSize}px`);

    if (root.dataset.prepShopPopover === "true") {
      syncPrepSideFabAnchorRight(root, gap);
    } else if (shopRect && shopRect.width > 8) {
      root.style.setProperty(
        "--prep-sell-fab-right",
        `${Math.round(window.innerWidth - shopRect.left + gap)}px`,
      );
    } else {
      root.style.setProperty(
        "--prep-sell-fab-right",
        `calc(var(--shop-panel-w, 248px) + ${gap}px)`,
      );
    }

    const benchBottom = readCssPx("--prep-bench-fab-bottom", 0);
    const benchSize = readCssPx("--prep-bench-fab-size", 0);
    const chrome = getBottomChrome();
    const vh = window.visualViewport?.height ?? window.innerHeight;

    if (chrome && getComputedStyle(chrome).display !== "none") {
      const chromeTop = chrome.getBoundingClientRect().top;
      root.style.setProperty("--prep-sell-fab-bottom", `${Math.max(gap, Math.round(vh - chromeTop + gap))}px`);
    } else {
      root.style.setProperty("--prep-sell-fab-bottom", `${Math.round(88 * uiScale)}px`);
    }
  }

  function syncPrepBenchFabPosition() {
    const root = document.documentElement;
    if (root.dataset.prepBenchPopover !== "true") return;
    if (document.getElementById("app")?.dataset.phase !== "prep") return;

    const shop = document.getElementById("shop-panel");
    const chrome = getBottomChrome();
    const shopRect = shop?.getBoundingClientRect();
    const surface = root.dataset.uiSurface;
    const uiScale = readCssPx("--ui-scale", 1);
    const baseFabPx = (surface === "tablet-side" || surface === "desktop") ? 75 : 44;
    const fabSize = Math.round(readCssPx("--prep-bench-fab-size", baseFabPx * uiScale));
    const gap = Math.round(6 * uiScale);
    const gap8 = Math.round(8 * uiScale);

    if (root.dataset.prepShopPopover === "true") {
      syncPrepSideFabAnchorRight(root, gap);
      const fabLeft = getPrepBenchFabAnchorLeft(gap8, fabSize);
      root.style.setProperty("--prep-bench-fab-left", `${fabLeft}px`);
      root.style.removeProperty("--prep-bench-fab-right");
    } else if (shopRect && shopRect.width > 8) {
      root.style.removeProperty("--prep-bench-fab-left");
      root.style.setProperty(
        "--prep-bench-fab-right",
        `${Math.round(window.innerWidth - shopRect.left + gap)}px`,
      );
    } else {
      root.style.removeProperty("--prep-bench-fab-left");
      root.style.setProperty(
        "--prep-bench-fab-right",
        `calc(var(--shop-panel-w, 248px) + ${gap}px)`,
      );
    }

    const vh = window.visualViewport?.height ?? window.innerHeight;
    if (chrome && getComputedStyle(chrome).display !== "none") {
      const chromeTop = chrome.getBoundingClientRect().top;
      root.style.setProperty("--prep-bench-fab-bottom", `${Math.max(gap, Math.round(vh - chromeTop + gap))}px`);
    } else {
      root.style.setProperty("--prep-bench-fab-bottom", `${Math.round(72 * uiScale)}px`);
    }

    const fabBottom = readCssPx("--prep-bench-fab-bottom", 80);
    root.style.setProperty("--prep-bench-popover-bottom", `${Math.round(fabBottom + fabSize + gap)}px`);
    root.style.setProperty("--prep-bench-fab-size", `${fabSize}px`);
    const panelW = readCssPx("--shop-panel-w", 300);
    if (root.dataset.prepShopPopover === "true") {
      syncPrepShopPopoverPosition();
    }
    if (root.dataset.prepBenchPopover === "true") {
      const { corridorLeft, corridorW, opensTowardHero } = root.dataset.prepShopPopover === "true"
        ? syncPrepBenchPopoverRect(gap8, panelW, uiScale)
        : syncPrepCommerceCorridorRect(gap8, panelW, uiScale);
      root.style.setProperty("--prep-bench-popover-x", `${corridorLeft}px`);
      root.style.setProperty("--prep-bench-popover-w", `${corridorW}px`);
      if (opensTowardHero === "right") {
        root.dataset.prepBenchPopoverDir = "hero-right";
      } else if (opensTowardHero === "left") {
        root.dataset.prepBenchPopoverDir = "hero-left";
      } else {
        root.removeAttribute("data-prep-bench-popover-dir");
      }
    }
    syncPrepSellFabPosition();
  }

  function syncOpenPrepTooltipDock() {
    if (typeof window.isLivePrepSession === "function" && !window.isLivePrepSession()) return;
    const phase = document.getElementById("app")?.dataset.phase;
    if (phase !== "prep") return;
    const tip = document.getElementById("sidebar-tooltip");
    if (tip && !tip.classList.contains("hidden")
      && typeof window.positionPrepTooltipDock === "function") {
      window.positionPrepTooltipDock();
    }
  }

  function syncMobileShopFabPosition() {
    const root = document.documentElement;
    syncMobileOverlayAnchors({ phase: document.getElementById("app")?.dataset.phase || "prep" });

    syncOpenPrepTooltipDock();

    if (!usesPrepShopDrawer()) {
      return;
    }
  }

  function setMobileBattleDisplayVars(displayW, displayH, logicalBattleW) {
    const root = document.documentElement;
    const scale = displayW / logicalBattleW;
    const fieldW = readCssPx("--prep-canvas-w", displayW * 0.45) * scale;
    const gridGap = readCssPx("--grid-gap", 36) * scale;
    root.style.setProperty("--battle-canvas-display-w", `${displayW}px`);
    root.style.setProperty("--battle-canvas-display-h", `${displayH}px`);
    root.style.setProperty("--battle-field-display-w", `${Math.round(fieldW)}px`);
    root.style.setProperty("--battle-grid-gap-display", `${Math.round(gridGap)}px`);
    root.dataset.battleMobileFit = "true";
  }

  const TABLET_BATTLE_AVATAR_VAR_NAMES = [
    "--tablet-prep-hero-h",
    "--tablet-battle-hero-zone-h",
    "--tablet-battle-hero-img-h",
    "--tablet-battle-thought-arena-min-h",
    "--tablet-battle-chrome-bottom",
    "--tablet-battle-scene-offset-x",
    "--tablet-battle-enemy-slot-left",
      "--tablet-battle-slot-w",
      "--tablet-battle-field-display-w",
      "--tablet-battle-canvas-display-w",
    "--prep-canvas-display-w",
    "--prep-canvas-display-h",
    "--battle-canvas-display-w",
    "--battle-canvas-display-h",
    "--battle-field-display-w",
    "--battle-grid-gap-display",
  ];

  const TABLET_BATTLE_FIELD_COL_VAR_NAMES = [
    "--battle-scene-offset-x",
    "--battle-enemy-slot-left",
  ];

  function clearTabletSideVars() {
    const root = document.documentElement;
    const fieldCol = document.getElementById("prep-field-column");
    const sceneUi = document.getElementById("battle-scene-ui");
    TABLET_BATTLE_AVATAR_VAR_NAMES.forEach((name) => {
      root.style.removeProperty(name);
      sceneUi?.style.removeProperty(name);
    });
    TABLET_BATTLE_FIELD_COL_VAR_NAMES.forEach((name) => {
      root.style.removeProperty(name);
      fieldCol?.style.removeProperty(name);
      sceneUi?.style.removeProperty(name);
    });
    sceneUi?.style.removeProperty("width");
    sceneUi?.style.removeProperty("max-width");
    root.style.removeProperty("--tablet-battle-player-x");
    root.style.removeProperty("--tablet-battle-enemy-x");
  }

  /** Масштаб полей боя для grid карточек (2× рюкзак + gap), без left в px. */
  function setTabletBattleFieldMetrics(root, displayCanvasW) {
    const canvas = document.getElementById("game-canvas");
    const sceneUi = document.getElementById("battle-scene-ui");
    const canvasRect = canvas?.getBoundingClientRect();
    const renderedCanvasW = canvasRect?.width > 0 ? canvasRect.width : displayCanvasW;
    if (renderedCanvasW <= 0) return;

    const logicalBattleW = readCssPx("--battle-canvas-w", renderedCanvasW);
    const scale = renderedCanvasW / logicalBattleW;
    const fieldW = readCssPx("--prep-canvas-w", 200) * scale;
    const gap = readCssPx("--grid-gap", 36) * scale;
    const slotW = Math.round(fieldW);
    const gapPx = `${Math.round(gap)}px`;
    const canvasPx = `${Math.round(renderedCanvasW)}px`;

    const targets = [sceneUi, root].filter(Boolean);
    for (const el of targets) {
      el.style.setProperty("--tablet-battle-field-display-w", `${slotW}px`);
      el.style.setProperty("--tablet-battle-slot-w", `${slotW}px`);
      el.style.setProperty("--tablet-battle-canvas-display-w", canvasPx);
      el.style.setProperty("--battle-field-display-w", `${slotW}px`);
      el.style.setProperty("--battle-grid-gap-display", gapPx);
    }
    if (sceneUi) {
      const sceneUiW = Math.round(slotW * 2 + gap);
      sceneUi.style.width = `${sceneUiW}px`;
      sceneUi.style.maxWidth = "100%";
      sceneUi.style.marginLeft = "auto";
      sceneUi.style.marginRight = "auto";
    }
    root.style.removeProperty("--tablet-battle-scene-offset-x");
    root.style.removeProperty("--tablet-battle-enemy-slot-left");
    sceneUi?.style.removeProperty("--tablet-battle-scene-offset-x");
    sceneUi?.style.removeProperty("--tablet-battle-enemy-slot-left");
  }

  function syncTabletBattleAvatarPositions() {
    syncBattleSceneGridMetrics();
  }

  const FLANK_HERO_DOM_IDS = ["player-avatar-panel", "enemy-avatar-panel", "battle-thought-arena"];

  function clearFlankHeroInlineStyles() {
    FLANK_HERO_DOM_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      ["left", "top", "right", "bottom", "width", "max-width", "height", "max-height", "transform"].forEach((prop) => {
        el.style.removeProperty(prop);
      });
    });
  }

  function measureBattleFieldChromeBottom(fieldCol) {
    const root = document.documentElement;
    const fromVar = readCssPx("--tablet-battle-chrome-bottom", 0);
    if (fromVar > 0) return fromVar;
    const hudReserve = measureBattleHudReserve();
    if (hudReserve > 0) return hudReserve;

    const toolbar = getBottomChrome();
    if (!fieldCol || !toolbar || getComputedStyle(toolbar).display === "none") return 8;

    const colRect = fieldCol.getBoundingClientRect();
    const toolRect = toolbar.getBoundingClientRect();
    if (toolRect.top >= colRect.bottom - 2) return 8;
    return Math.max(8, Math.round(colRect.bottom - toolRect.top + 4));
  }

  function ensureFlankBattleSceneUiMetrics(sceneUi) {
    if (!sceneUi) return;
    sceneUi.style.width = "100%";
    sceneUi.style.maxWidth = "100%";
    sceneUi.style.marginLeft = "0";
    sceneUi.style.marginRight = "0";
  }

  /**
   * Три зоны hero-row по UI-макету (не по gap между рюкзаками на canvas):
   * desktop ~28% player | ~44% emoji arena | ~28% enemy
   * mobile stack: 50% | 50% карточки сверху, арена — отдельной полосой ниже
   */
  function computeBattleHeroRowZones(layoutWidth, _layoutRect, _canvasRect, heroColW, edgePad, opts = {}) {
    const innerW = Math.max(320, layoutWidth - edgePad * 2);
    const uiScale = opts.uiScale ?? 1;

    if (opts.mobileStack === true) {
      const cardGap = Math.max(6, Math.round(6 * uiScale));
      const cardW = Math.floor((innerW - cardGap) / 2);
      const innerPad = Math.max(4, edgePad);
      const playerColW = Math.max(
        heroColW,
        Math.min(cardW - innerPad, cardW - innerPad * 2),
      );
      const enemyColW = playerColW;
      return {
        mobileStack: true,
        colW: Math.min(playerColW, enemyColW),
        playerColW,
        enemyColW,
        playerZoneLeft: edgePad,
        playerZoneW: cardW,
        playerPanelLeft: edgePad + Math.max(0, Math.floor((cardW - playerColW) / 2)),
        enemyZoneLeft: edgePad + cardW + cardGap,
        enemyZoneW: cardW,
        enemyPanelLeft: edgePad + cardW + cardGap + Math.max(0, Math.floor((cardW - enemyColW) / 2)),
        arenaLeft: edgePad,
        arenaW: innerW,
      };
    }

    const shares = opts.zoneShares || { player: 0.28, arena: 0.44, enemy: 0.28 };
    const playerShare = shares.player;
    const arenaShare = shares.arena;
    const enemyShare = shares.enemy;

    let playerZoneW = Math.round(innerW * playerShare);
    let arenaW = Math.round(innerW * arenaShare);
    let enemyZoneW = Math.round(innerW * enemyShare);

    const minSide = Math.max(heroColW, Math.round(innerW * 0.22));
    const minArena = Math.max(160, Math.round(innerW * 0.34));
    playerZoneW = Math.max(minSide, playerZoneW);
    enemyZoneW = Math.max(minSide, enemyZoneW);
    arenaW = Math.max(minArena, arenaW);

    let overflow = playerZoneW + arenaW + enemyZoneW - innerW;
    if (overflow > 0) {
      const fromArena = Math.min(overflow, Math.max(0, arenaW - minArena));
      arenaW -= fromArena;
      overflow -= fromArena;
    }
    if (overflow > 0) {
      const fromPlayer = Math.min(overflow, Math.max(0, playerZoneW - minSide));
      playerZoneW -= fromPlayer;
      overflow -= fromPlayer;
    }
    if (overflow > 0) {
      enemyZoneW = Math.max(minSide, enemyZoneW - overflow);
    }

    const playerZoneLeft = edgePad;
    const arenaLeft = playerZoneLeft + playerZoneW;
    const enemyZoneLeft = arenaLeft + arenaW;
    const innerPad = Math.max(edgePad, Math.round(edgePad * 1.5));

    const playerColW = Math.min(
      Math.max(heroColW, Math.floor(playerZoneW - innerPad * 2)),
      Math.floor(playerZoneW - innerPad),
    );
    const enemyColW = Math.min(
      Math.max(heroColW, Math.floor(enemyZoneW - innerPad * 2)),
      Math.floor(enemyZoneW - innerPad),
    );

    return {
      colW: Math.min(playerColW, enemyColW),
      playerColW,
      enemyColW,
      playerZoneLeft,
      playerZoneW,
      playerPanelLeft: playerZoneLeft + innerPad,
      enemyZoneLeft,
      enemyZoneW,
      enemyPanelLeft: enemyZoneLeft + Math.max(innerPad, enemyZoneW - enemyColW - innerPad),
      arenaLeft,
      arenaW,
    };
  }

  function applyBattleHeroRowZoneVars(root, fieldCol, zones, heroRowTop, heroZoneH, combatFloor = null) {
    const entries = [
      ["--battle-hero-row-top", heroRowTop],
      ["--battle-hero-zone-h-active", heroZoneH],
      ["--battle-hero-col-w-active", zones.colW],
      ["--battle-player-zone-left", zones.playerZoneLeft],
      ["--battle-player-zone-width", zones.playerZoneW],
      ["--battle-enemy-zone-left", zones.enemyZoneLeft],
      ["--battle-enemy-zone-width", zones.enemyZoneW],
      ["--battle-arena-zone-left", zones.arenaLeft],
      ["--battle-arena-zone-width", zones.arenaW],
    ];
    if (combatFloor) {
      entries.push(
        ["--battle-combat-floor-top", combatFloor.top],
        ["--battle-combat-floor-h", combatFloor.height],
      );
    }
    entries.forEach(([name, value]) => {
      root.style.setProperty(name, `${Math.round(value)}px`);
      fieldCol?.style.setProperty(name, `${Math.round(value)}px`);
    });
  }

  function readBattlePortraitHeadroom(root, uiScale = 1) {
    if (root.dataset.heroCardMode !== "full-bleed") return 0;
    const heroImgH = readCssPx(
      "--battle-hero-img-h",
      readCssPx("--desktop-battle-hero-img-h", 280),
    );
    const bleedRaw = getComputedStyle(root).getPropertyValue("--hero-portrait-bleed").trim();
    const portraitBleed = parseFloat(bleedRaw) || 1;
    if (portraitBleed <= 1 || heroImgH <= 0) return 0;
    return Math.round(heroImgH * (portraitBleed - 1) + Math.max(4, Math.round(6 * uiScale)));
  }

  function placeBattleHeroPanel(panel, left, top, width, height, opts = {}) {
    if (!panel) return;
    panel.style.setProperty("--flank-panel-x", `${Math.round(left)}px`);
    panel.style.setProperty("--flank-panel-y", `${Math.round(top)}px`);
    panel.style.position = "absolute";
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.width = `${Math.round(width)}px`;
    panel.style.maxWidth = `${Math.round(width)}px`;
    panel.style.height = "auto";
    panel.style.minHeight = `${Math.round(Math.min(height, 120))}px`;
    if (opts.allowPortraitOverflow) {
      panel.style.maxHeight = "none";
      panel.style.overflow = "visible";
    } else {
      panel.style.maxHeight = `${Math.round(height)}px`;
      panel.style.removeProperty("overflow");
    }
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.transform = "none";
  }

  function usesTabletBattleThoughtCorners() {
    return typeof BattleHeroAnchor !== "undefined"
      && BattleHeroAnchor.usesCombatFloorAnchors();
  }

  /** Эмодзи-аватар (мысль): над колонкой героя; combat floor — только для атак. */
  function syncHeroEmotionSlotAnchors(opts = {}) {
    const root = document.documentElement;
    if (root.dataset.battleHeroPlacement !== "flank-arena") {
      root.removeAttribute("data-tablet-thought-corners");
      root.removeAttribute("data-thought-slot-below-hero");
      root.removeAttribute("data-battle-combat-floor");
      root.removeAttribute("data-battle-hud-above-hero");
      root.removeAttribute("data-thought-duel-center");
      syncHeroEmotionSlotAnchors._layout = null;
      return;
    }

    const combatFloor = typeof BattleHeroAnchor !== "undefined"
      && BattleHeroAnchor.usesCombatFloorAnchors();
    root.dataset.battleCombatFloor = combatFloor ? "true" : "false";
    root.dataset.tabletThoughtCorners = combatFloor ? "true" : "false";
    const portraitHeadBadge = typeof BattleHeroAnchor !== "undefined"
      && BattleHeroAnchor.usesHeadBadgeAnchors?.();
    const aboveHero = typeof BattleHeroAnchor !== "undefined"
      && BattleHeroAnchor.usesHeroAboveThoughtAnchors?.();
    root.dataset.thoughtAboveHero = aboveHero ? "true" : "false";
    root.dataset.thoughtHeadBadge = portraitHeadBadge ? "true" : "false";
    root.dataset.thoughtSlotBelowHero = "false";
    const duelCenter = typeof BattleHeroAnchor !== "undefined"
      && BattleHeroAnchor.usesCenterDuelThoughtAnchors?.();
    if (duelCenter) root.dataset.thoughtDuelCenter = "true";
    else root.removeAttribute("data-thought-duel-center");

    const vmin = Math.min(
      window.visualViewport?.width ?? window.innerWidth,
      window.visualViewport?.height ?? window.innerHeight,
    );
    const size = typeof BattleHeroAnchor !== "undefined"
      ? BattleHeroAnchor.thoughtSlotSize(vmin)
      : Math.round(Math.min(112, Math.max(68, vmin * 0.12)));
    root.style.setProperty("--battle-thought-band-h", `${size}px`);

    if (!syncHeroEmotionSlotAnchors._layout) {
      syncHeroEmotionSlotAnchors._layout = { player: "", enemy: "" };
    }
    let layoutChanged = false;

    [
      { slotId: "player-thought-slot", side: "player" },
      { slotId: "enemy-thought-slot", side: "enemy" },
    ].forEach(({ slotId, side }) => {
      const thoughtSlot = document.getElementById(slotId);
      if (!thoughtSlot) return;

      const avatar = document.getElementById(side === "enemy" ? "enemy-avatar-slot" : "player-avatar-slot")
        ?.querySelector(".profile-avatar");
      if (avatar && !avatar.querySelector(".hero-portrait-head-badge-anchor")) {
        avatar.insertAdjacentHTML("beforeend", '<span class="hero-portrait-head-badge-anchor" aria-hidden="true"></span>');
      }

      let cx;
      let top;
      let slotSize = size;
      let emojiSize = null;

      if (typeof BattleHeroAnchor !== "undefined") {
        const anchor = BattleHeroAnchor.getThoughtSlotAnchor(side);
        if (anchor) {
          cx = anchor.cx;
          top = anchor.top;
          slotSize = anchor.size;
          emojiSize = anchor.emojiSize || null;
        }
      }

      if (cx == null || top == null) {
        const ar = typeof BattleHeroAnchor !== "undefined"
          ? BattleHeroAnchor.getAvatarAnchorRect(side)
          : null;
        if (!ar || ar.width <= 4) return;
        if (typeof BattleHeroAnchor !== "undefined" && BattleHeroAnchor.usesHeadBadgeAnchors?.()) {
          const badge = BattleHeroAnchor.getHeadBadgeThoughtAnchor(side);
          if (badge) {
            cx = badge.cx;
            top = badge.top;
            slotSize = badge.size;
            emojiSize = badge.emojiSize || null;
          }
        }
        if (cx == null || top == null) {
          const rescue = typeof BattleHeroAnchor !== "undefined"
            ? (BattleHeroAnchor.getHeroAboveThoughtAnchor?.(side)
              || BattleHeroAnchor.getThoughtSlotAnchor?.(side))
            : null;
          if (rescue) {
            cx = rescue.cx;
            top = rescue.top;
            slotSize = rescue.size ?? slotSize;
            emojiSize = rescue.emojiSize || emojiSize;
          }
        }
        if (cx == null || top == null) {
          cx = ar.left + ar.width / 2;
          top = ar.bottom + Math.round(6 * readCssPx("--ui-scale", 1));
        }
      }

      const layoutKey = `${Math.round(cx)}|${Math.round(top)}|${slotSize}|${emojiSize || ""}`;
      if (syncHeroEmotionSlotAnchors._layout[side] === layoutKey) return;
      syncHeroEmotionSlotAnchors._layout[side] = layoutKey;
      layoutChanged = true;

      if (emojiSize) {
        thoughtSlot.style.setProperty("--battle-thought-emoji-size", `${emojiSize}px`);
        thoughtSlot.style.setProperty("--thought-size", `${emojiSize}px`);
      }

      thoughtSlot.style.position = "fixed";
      thoughtSlot.style.left = `${Math.round(cx - slotSize / 2)}px`;
      thoughtSlot.style.top = `${Math.round(top)}px`;
      thoughtSlot.style.width = `${slotSize}px`;
      thoughtSlot.style.height = `${slotSize}px`;
      thoughtSlot.style.right = "auto";
      thoughtSlot.style.bottom = "auto";
      thoughtSlot.style.zIndex = "26";
      thoughtSlot.style.overflow = "visible";
      thoughtSlot.style.pointerEvents = "none";
    });

    if (!layoutChanged) {
      if (typeof BattleHeroAnchor !== "undefined") {
        const emojiPx = BattleHeroAnchor.thoughtSlotEmojiSize(vmin);
        const rootKey = String(emojiPx);
        if (syncHeroEmotionSlotAnchors._rootEmoji !== rootKey) {
          syncHeroEmotionSlotAnchors._rootEmoji = rootKey;
          root.style.setProperty("--battle-thought-emoji-size", `${emojiPx}px`);
        }
      }
      return;
    }

    if (typeof BattleHeroAnchor !== "undefined" && BattleHeroAnchor.invalidateMeasureCache) {
      BattleHeroAnchor.invalidateMeasureCache();
    }

    if (typeof ThoughtArena !== "undefined" && ThoughtArena.onResize) {
      ThoughtArena.onResize();
    }
    if (typeof BattleHeroAnchor !== "undefined") {
      const emojiPx = BattleHeroAnchor.thoughtSlotEmojiSize(vmin);
      syncHeroEmotionSlotAnchors._rootEmoji = String(emojiPx);
      root.style.setProperty("--battle-thought-emoji-size", `${emojiPx}px`);
    }
    if (!opts.skipEquipRelayout
      && typeof ArenaEquipment !== "undefined" && ArenaEquipment.onResize) {
      ArenaEquipment.onResize();
    }
  }

  function isPortraitBattleProfile(root) {
    const profile = root.dataset.battleProfile;
    return profile === "phone-portrait" || profile === "tablet-portrait";
  }

  /** Портрет: компактная дуэльная полоса под HUD (не весь коридор до toolbar). */
  function refinePortraitCombatCorridor(root, layoutRect, layoutH, { arenaGap }) {
    if (!isPortraitBattleProfile(root)) return null;
    if (typeof syncBattleHudAnchors === "function") syncBattleHudAnchors();

    const hudBottomLayout = Math.max(
      document.getElementById("battle-hud-player")?.getBoundingClientRect().bottom ?? 0,
      document.getElementById("battle-hud-enemy")?.getBoundingClientRect().bottom ?? 0,
    ) - layoutRect.top;
    const chromeBar = getBottomChrome();
    const chromeTopLayout = chromeBar && getComputedStyle(chromeBar).display !== "none"
      ? chromeBar.getBoundingClientRect().top - layoutRect.top
      : layoutH;

    const floorTopMin = Math.max(0, hudBottomLayout + arenaGap);
    const floorBottomMax = Math.min(layoutH - arenaGap, chromeTopLayout - arenaGap);
    const corridorH = Math.max(96, floorBottomMax - floorTopMin);

    const uiScale = readCssPx("--ui-scale", 1);
    const vmin = Math.min(
      window.visualViewport?.width ?? window.innerWidth,
      window.visualViewport?.height ?? window.innerHeight,
    );
    const slotSize = typeof BattleHeroAnchor !== "undefined"
      ? BattleHeroAnchor.thoughtSlotSize(vmin)
      : Math.round(Math.min(172, Math.max(100, vmin * 0.19)));
    const orbitPad = Math.round(48 * uiScale);
    const compactH = Math.max(96, slotSize + orbitPad);

    const profile = root.dataset.battleProfile || "phone-portrait";
    const prof = BATTLE_PROFILES[profile] || {};
    const duelShare = prof.portraitDuelShare ?? 0.32;
    const shareCap = Math.round(corridorH * duelShare);
    const floorH = Math.min(corridorH, Math.max(compactH, shareCap));

    return { top: floorTopMin, height: floorH };
  }

  function usesBattlePrepHeroLayer(root = document.documentElement) {
    const app = document.getElementById("app");
    if (!app || (app.dataset.phase !== "battle" && app.dataset.phase !== "replay")) return false;
    if (root.dataset.battleHeroPlacement !== "flank-arena") return false;
    if (root.dataset.prepLayout === "mobile") return false;
    if (root.dataset.battlePrepHeroLayer !== "true") return false;
    return usesTabletPrepHeroLayout(root) || root.dataset.uiSurface === "desktop";
  }

  function measureBattlePrepHeroRect(side) {
    const charEl = document.getElementById(side === "enemy" ? "prep-character-enemy" : "prep-character-player");
    if (!charEl || charEl.hasAttribute("hidden")) return null;
    const visual = charEl.querySelector(".prep-character-img, .prep-character-emoji") || charEl;
    const r = visual.getBoundingClientRect();
    if (!r || r.width < 48 || r.height < 48) return null;
    return r;
  }

  /** L2/L3 hero row: 3 зоны (player | emoji arena | enemy), Safari-safe 4-layer. */
  function syncFlankArenaHeroAnchors() {
    const fieldCol = document.getElementById("prep-field-column");
    const sceneUi = document.getElementById("battle-scene-ui");
    const objectsLayer = document.getElementById("layer-objects");
    const canvas = document.getElementById("game-canvas");
    const root = document.documentElement;
    if (!fieldCol || !canvas || !sceneUi || !objectsLayer) return;

    root.dataset.battleCombatFloor = "true";
    ensureFlankBattleSceneUiMetrics(sceneUi);

    const layoutRect = objectsLayer.getBoundingClientRect();
    const sceneRect = sceneUi.getBoundingClientRect();
    if (layoutRect.width <= 0) return;

    const uiScale = readCssPx("--ui-scale", 1);
    const edgePad = Math.max(4, Math.round(4 * uiScale));
    const arenaGap = Math.round(8 * uiScale);
    const rowGap = Math.round(8 * uiScale);
    const vmin = Math.min(
      window.visualViewport?.width ?? window.innerWidth,
      window.visualViewport?.height ?? window.innerHeight,
    );
    const sceneOffsetX = sceneRect.left - layoutRect.left;
    const fieldPadBottom = parseFloat(getComputedStyle(fieldCol).paddingBottom) || 0;
    const toolbarReserve = fieldPadBottom > 0
      ? fieldPadBottom
      : measureBattleFieldChromeBottom(fieldCol);

    if (usesBattlePrepHeroLayer(root)) {
      const playerRect = measureBattlePrepHeroRect("player");
      const enemyRect = measureBattlePrepHeroRect("enemy");
      if (playerRect && enemyRect) {
        const heroCardH = Math.round(Math.max(playerRect.height, enemyRect.height));
        const heroRowTop = Math.round(Math.min(
          playerRect.top - sceneRect.top,
          enemyRect.top - sceneRect.top,
        ));
        const playerZoneLeft = Math.round(playerRect.left - layoutRect.left);
        const playerZoneW = Math.round(playerRect.width);
        const enemyZoneLeft = Math.round(enemyRect.left - layoutRect.left);
        const enemyZoneW = Math.round(enemyRect.width);
        const arenaLeft = playerZoneLeft + playerZoneW;
        const arenaW = Math.max(120, enemyZoneLeft - arenaLeft);
        const layoutHeight = Math.max(layoutRect.height, sceneRect.height, fieldCol.clientHeight);
        const vitalsBandH = measureBattleHudVitalsBandPx(uiScale);
        root.style.setProperty("--battle-vitals-band-h", `${vitalsBandH}px`);
        const heroBottomScene = Math.round(
          Math.max(playerRect.bottom, enemyRect.bottom) - sceneRect.top,
        );
        const combatFloorTop = Math.round(heroBottomScene + arenaGap);
        const combatFloorH = Math.max(
          readCssPx("--battle-thought-arena-min-h", 110),
          layoutHeight - combatFloorTop - toolbarReserve - arenaGap,
        );

        root.style.setProperty("--battle-hero-img-h", `${heroCardH}px`);
        root.style.setProperty("--tablet-battle-hero-img-h", `${heroCardH}px`);
        root.style.setProperty("--desktop-battle-hero-img-h", `${heroCardH}px`);

        const zones = {
          playerZoneLeft,
          playerZoneW,
          playerColW: playerZoneW,
          playerPanelLeft: playerZoneLeft,
          enemyZoneLeft,
          enemyZoneW,
          enemyColW: enemyZoneW,
          enemyPanelLeft: enemyZoneLeft,
          arenaLeft,
          arenaW,
        };

        placeBattleHeroPanel(
          document.getElementById("player-avatar-panel"),
          playerRect.left - sceneRect.left + sceneOffsetX,
          heroRowTop,
          playerRect.width,
          heroCardH,
          { allowPortraitOverflow: true },
        );
        placeBattleHeroPanel(
          document.getElementById("enemy-avatar-panel"),
          enemyRect.left - sceneRect.left + sceneOffsetX,
          heroRowTop,
          enemyRect.width,
          heroCardH,
          { allowPortraitOverflow: true },
        );

        applyBattleHeroRowZoneVars(root, fieldCol, zones, heroRowTop, heroCardH, {
          top: combatFloorTop,
          height: combatFloorH,
        });

        const thoughtArena = document.getElementById("battle-thought-arena");
        if (thoughtArena) {
          thoughtArena.style.position = "absolute";
          thoughtArena.style.left = `${zones.arenaLeft}px`;
          thoughtArena.style.width = `${zones.arenaW}px`;
          thoughtArena.style.top = `${Math.round(combatFloorTop)}px`;
          thoughtArena.style.height = `${Math.round(combatFloorH)}px`;
          thoughtArena.style.maxHeight = `${Math.round(combatFloorH)}px`;
          thoughtArena.style.right = "auto";
          thoughtArena.style.bottom = "auto";
          thoughtArena.style.minHeight = `${readCssPx("--battle-thought-arena-min-h", 110)}px`;
        }

        if (typeof syncBattleHudAnchors === "function") {
          syncBattleHudAnchors();
        } else {
          syncHeroEmotionSlotAnchors();
          syncHeroAttackSlotAnchors();
        }
        return;
      }
    }

    const heroZoneH = readCssPx(
      "--battle-hero-zone-h",
      readCssPx("--desktop-battle-hero-zone-h", 220),
    );
    const heroColW = readCssPx(
      "--battle-hero-col-w",
      readCssPx("--desktop-battle-hero-col-w", 180),
    );
    const scenePad = Math.max(4, Math.round(4 * uiScale));
    const layoutHeight = Math.max(layoutRect.height, sceneRect.height, fieldCol.clientHeight);
    const mobileStack = root.dataset.prepLayout === "mobile";
    const phoneLandscape = root.dataset.battlePhoneLandscape === "true";
    const phoneCompact = mobileStack || phoneLandscape;
    const tabletSide = isTabletSideLayout(root);
    const tabletLandscapeSide = isTabletLandscapeSideBattle(root);
    const isDesktopBattle = (root.dataset.battleProfile || "").startsWith("desktop-");
    if (mobileStack) {
      root.dataset.battleMobileStack = "true";
    } else {
      root.removeAttribute("data-battle-mobile-stack");
    }

    const sceneTop = mobileStack
      ? 0
      : readCssPx("--prep-scene-top", 14);
    let heroCardH = mobileStack
      ? readCssPx("--battle-hero-card-h", Math.round(heroZoneH * 0.92))
      : heroZoneH;
    const thoughtSizeEst = typeof BattleHeroAnchor !== "undefined"
      ? BattleHeroAnchor.thoughtSlotSize(vmin)
      : Math.round(Math.min(172, Math.max(100, vmin * 0.19)));
    let combatFloorMin = Math.max(
      readCssPx("--battle-thought-arena-min-h", 110),
      Math.round(layoutHeight * 0.24),
      thoughtSizeEst + Math.round(28 * uiScale),
    );
    const usableH = Math.max(148, layoutHeight - toolbarReserve - rowGap);

    let layoutH = layoutHeight;
    if (phoneCompact) {
      const vhNow = window.visualViewport?.height ?? window.innerHeight;
      const chromeBar = getBottomChrome();
      const chromeTop = chromeBar && getComputedStyle(chromeBar).display !== "none"
        ? chromeBar.getBoundingClientRect().top
        : vhNow;
      layoutH = Math.min(
        layoutHeight,
        Math.max(120, Math.round(chromeTop - layoutRect.top)),
      );
    }

    if (mobileStack || phoneLandscape) {
      const prof = BATTLE_PROFILES[root.dataset.battleProfile] || {};
      const floorShare = prof.floorShare ?? (mobileStack ? 0.26 : 0.30);
      const heroShare = prof.heroShare ?? (mobileStack ? 0.28 : 0.32);
      combatFloorMin = Math.max(phoneLandscape ? 84 : 100, Math.round(usableH * floorShare));
      heroCardH = Math.min(
        heroCardH,
        Math.max(phoneLandscape ? 92 : 104, Math.round(usableH * heroShare)),
      );
    } else if (tabletLandscapeSide) {
      const prof = BATTLE_PROFILES[root.dataset.battleProfile] || {};
      const heroImgH = readCssPx(
        "--battle-hero-img-h",
        readCssPx("--tablet-battle-hero-img-h", Math.round(heroZoneH * 0.78)),
      );
      const nameBand = Math.round(30 * uiScale);
      heroCardH = Math.min(heroZoneH, heroImgH + nameBand);
      combatFloorMin = Math.max(
        readCssPx("--battle-thought-arena-min-h", prof.arenaMin ?? 120),
        Math.round(usableH * (prof.floorShare ?? 0.30)),
      );
    } else if ((root.dataset.battleProfile || "").startsWith("desktop-")) {
      const prof = BATTLE_PROFILES[root.dataset.battleProfile] || {};
      combatFloorMin = Math.max(
        readCssPx("--battle-thought-arena-min-h", prof.arenaMin ?? 120),
        Math.round(usableH * (prof.floorShare ?? 0.20)),
      );
      heroCardH = heroZoneH;
    }

    if (heroCardH + arenaGap + combatFloorMin > usableH) {
      if (isDesktopBattle && !mobileStack && !phoneLandscape && !tabletLandscapeSide) {
        combatFloorMin = Math.max(96, usableH - heroCardH - arenaGap - rowGap);
        if (heroCardH + arenaGap + combatFloorMin > usableH) {
          heroCardH = Math.max(Math.round(heroZoneH * 0.75), usableH - arenaGap - combatFloorMin - rowGap);
        }
      } else {
        combatFloorMin = Math.max(phoneLandscape ? 80 : 92, Math.round(usableH * 0.27));
        heroCardH = Math.max(phoneLandscape ? 88 : 100, usableH - arenaGap - combatFloorMin);
      }
    }

    const portraitHeadroom = readBattlePortraitHeadroom(root, uiScale);
    root.style.setProperty("--battle-portrait-headroom", `${portraitHeadroom}px`);

    const heroRowTopMax = Math.max(
      rowGap + portraitHeadroom,
      layoutH - heroCardH - arenaGap - combatFloorMin - toolbarReserve - rowGap,
    );
    let heroRowTop;
    if (isDesktopBattle && !mobileStack && !phoneLandscape && !tabletLandscapeSide) {
      const bandH = Math.max(heroCardH, usableH - combatFloorMin - arenaGap - toolbarReserve - rowGap * 2);
      const bandSlack = Math.max(0, bandH - heroCardH - portraitHeadroom);
      // Нижняя треть полосы героя — как в автобатлерах: стоят на «полу», головы в safe area.
      const heroAnchorT = 0.48;
      heroRowTop = Math.max(
        rowGap + portraitHeadroom,
        Math.min(
          heroRowTopMax,
          Math.round(rowGap + portraitHeadroom + bandSlack * heroAnchorT),
        ),
      );
    } else if (tabletLandscapeSide || (isDesktopBattle && !mobileStack && !phoneLandscape)) {
      const prepHeroBottom = readCssPx("--prep-hero-slot-bottom", 8);
      const stackBelowHero = combatFloorMin + arenaGap;
      heroRowTop = Math.max(
        rowGap + portraitHeadroom,
        layoutH - toolbarReserve - prepHeroBottom - heroCardH - stackBelowHero,
      );
    } else {
      heroRowTop = Math.max(
        rowGap + portraitHeadroom,
        Math.min(sceneTop + rowGap, heroRowTopMax),
      );
    }

    const battleProf = BATTLE_PROFILES[root.dataset.battleProfile || ""] || {};
    const zones = computeBattleHeroRowZones(
      layoutRect.width,
      layoutRect,
      null,
      heroColW,
      edgePad,
      {
        mobileStack,
        uiScale,
        zoneShares: (tabletSide && !mobileStack) || isDesktopBattle
          ? (battleProf.zoneShares || { player: 0.30, arena: 0.38, enemy: 0.30 })
          : null,
      },
    );
    const combatFloorTopInitial = heroRowTop + heroCardH + arenaGap;
    const combatFloorAvailable = phoneCompact
      ? Math.max(72, layoutH - combatFloorTopInitial - arenaGap)
      : Math.max(
        72,
        layoutHeight - combatFloorTopInitial - toolbarReserve - arenaGap,
      );
    let combatFloorTop = combatFloorTopInitial;
    let combatFloorH = phoneCompact
      ? (() => {
        let h = Math.max(combatFloorMin, combatFloorAvailable);
        if (phoneLandscape) {
          const chromeBar = getBottomChrome();
          const chromeTop = chromeBar && getComputedStyle(chromeBar).display !== "none"
            ? chromeBar.getBoundingClientRect().top
            : (window.visualViewport?.height ?? window.innerHeight);
          const maxH = Math.max(72, Math.round(chromeTop - combatFloorTop - arenaGap));
          h = Math.min(h, maxH);
        }
        return h;
      })()
      : tabletLandscapeSide
        ? Math.max(combatFloorMin, combatFloorAvailable)
        : Math.min(combatFloorMin, combatFloorAvailable);

    const allowPortraitOverflow = root.dataset.heroCardMode === "full-bleed"
      && (isDesktopBattle || mobileStack || phoneLandscape);

    placeBattleHeroPanel(
      document.getElementById("player-avatar-panel"),
      zones.playerPanelLeft + sceneOffsetX,
      heroRowTop,
      zones.playerColW,
      heroCardH,
      { allowPortraitOverflow },
    );
    placeBattleHeroPanel(
      document.getElementById("enemy-avatar-panel"),
      zones.enemyPanelLeft + sceneOffsetX,
      heroRowTop,
      zones.enemyColW,
      heroCardH,
      { allowPortraitOverflow },
    );

    const portraitCorridor = refinePortraitCombatCorridor(root, layoutRect, layoutH, { arenaGap });
    if (portraitCorridor) {
      combatFloorTop = portraitCorridor.top;
      combatFloorH = portraitCorridor.height;
    }

    applyBattleHeroRowZoneVars(root, fieldCol, zones, heroRowTop, heroCardH, {
      top: combatFloorTop,
      height: combatFloorH,
    });

    const thoughtArena = document.getElementById("battle-thought-arena");
    if (thoughtArena) {
      thoughtArena.style.position = "absolute";
      thoughtArena.style.left = `${zones.arenaLeft}px`;
      thoughtArena.style.width = `${zones.arenaW}px`;
      thoughtArena.style.top = `${Math.round(combatFloorTop)}px`;
      thoughtArena.style.height = `${Math.round(combatFloorH)}px`;
      thoughtArena.style.maxHeight = `${Math.round(combatFloorH)}px`;
      thoughtArena.style.right = "auto";
      thoughtArena.style.bottom = "auto";
      thoughtArena.style.minHeight = `${readCssPx("--battle-thought-arena-min-h", 110)}px`;
    }

    if (typeof syncBattleHudAnchors === "function") {
      syncBattleHudAnchors();
    } else {
      syncHeroEmotionSlotAnchors();
      syncHeroAttackSlotAnchors();
    }
  }

  function syncBattleSceneGridMetrics() {
    const root = document.documentElement;
    if (!isBattleUiPhase()) return;

    const now = performance.now();
    const minGap = (typeof BattleFxTier !== "undefined" && BattleFxTier.isLightBattleFx?.())
      ? 320
      : 120;
    if (syncBattleSceneGridMetrics._lastAt && now - syncBattleSceneGridMetrics._lastAt < minGap) return;
    syncBattleSceneGridMetrics._lastAt = now;

    if (root.dataset.battleHeroPlacement !== "flank-arena" || root.dataset.battleArenaLayout !== "true") {
      const canvas = document.getElementById("game-canvas");
      const fieldCol = document.getElementById("prep-field-column");
      const stageW = fieldCol?.clientWidth ?? 0;
      if (canvas && canvas.width > 0 && stageW > 0) {
        fitFlankArenaBattleLayout(root, canvas, fieldCol, stageW);
      }
    }

    if (root.dataset.battleHeroPlacement !== "flank-arena") return;
    syncFlankArenaHeroAnchors();
    if (typeof syncFxCanvasGeometry === "function") syncFxCanvasGeometry();
    if (typeof syncBattleHudAnchors === "function") syncBattleHudAnchors();
    if (typeof syncBattleAuraFrameLayout === "function") syncBattleAuraFrameLayout();
  }

  function scheduleBattleHeroRowSync(attempts = 6) {
    const light = typeof BattleFxTier !== "undefined" && BattleFxTier.isLightBattleFx?.();
    let left = light ? Math.min(attempts, 2) : attempts;
    const tick = () => {
      if (!isBattleUiPhase() || left <= 0) return;
      left -= 1;
      syncBattleSceneGridMetrics();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function syncBattleHudFeedDock() {
    document.documentElement.dataset.battleFeedHud = "false";
  }

  function measureBattleHudReserve() {
    if (!isBattleUiPhase()) return 0;
    const h = measureBottomChromeHeight();
    return h > 0 ? h + 4 : 0;
  }

  function syncTabletSideLayoutVars(h, phase) {
    const root = document.documentElement;
    if (!isTabletSideLayout(root)) {
      clearTabletSideVars();
      return;
    }

    const hudReserve = isBattleUiPhase() ? measureBattleHudReserve() : 0;
    const hudH = measureBottomChromeHeight();
    root.style.setProperty("--tablet-battle-chrome-bottom", `${Math.max(hudReserve, hudH + 12)}px`);

    if (phase === "prep") {
      const fieldCol = document.getElementById("prep-field-column");
      const sceneTop = readCssPx("--prep-scene-top", 14);
      const columnH = fieldCol?.clientHeight > 0 ? fieldCol.clientHeight : Math.max(320, h - measurePrepChromeHeight() - hudH);
      root.style.setProperty("--tablet-prep-hero-h", `${computeTabletPrepHeroHeight(columnH, sceneTop)}px`);
      return;
    }

    if (phase === "battle" || phase === "replay") {
      const profileKey = root.dataset.battleProfile || "tablet-landscape-side";
      const prof = BATTLE_PROFILES[profileKey] || BATTLE_PROFILES["tablet-landscape-side"];
      const avail = Math.max(200, h - hudReserve);
      const heroZone = Math.min(
        prof.heroMax,
        Math.max(prof.heroMin, Math.round(avail * (prof.heroZoneShare ?? 0.52))),
      );
      const heroImgH = Math.round(
        Math.min(prof.imgMax, Math.max(prof.imgMin, heroZone * (prof.imgRatio ?? 0.84))),
      );
      const arenaMin = Math.max(prof.arenaMin ?? 88, Math.round(h * (prof.arenaVh ?? 0.15)));
      root.style.setProperty("--tablet-battle-hero-zone-h", `${heroZone}px`);
      root.style.setProperty("--tablet-battle-hero-img-h", `${heroImgH}px`);
      root.style.setProperty("--tablet-battle-thought-arena-min-h", `${arenaMin}px`);
    }
  }

  function setBattleArenaLayout(enabled) {
    const wasEnabled = document.documentElement.dataset.battleArenaLayout === "true";
    document.documentElement.dataset.battleArenaLayout = enabled ? "true" : "false";
    if (enabled && !wasEnabled && typeof ArenaEquipment !== "undefined" && ArenaEquipment.onResize) {
      ArenaEquipment.onResize();
    }
  }

  function setBattleHeroPlacement(mode) {
    const root = document.documentElement;
    if (mode) {
      root.dataset.battleHeroPlacement = mode;
      root.dataset.battleHeroAnchor = mode === "flank-arena" ? "canvas" : "false";
      if (mode === "flank-arena") {
        ensureFlankBattleSceneUiMetrics(document.getElementById("battle-scene-ui"));
      }
    } else {
      root.removeAttribute("data-battle-hero-placement");
      root.removeAttribute("data-battle-hero-anchor");
      root.removeAttribute("data-battle-combat-floor");
      clearFlankHeroInlineStyles();
    }
  }

  /** CSS vars на html и #app — иначе #app[data-phase=battle] перебивает наследование. */
  function setBattleLayoutVar(name, value) {
    const root = document.documentElement;
    const app = document.getElementById("app");
    root.style.setProperty(name, value);
    if (app && (app.dataset.phase === "battle" || app.dataset.phase === "replay")) {
      app.style.setProperty(name, value);
    }
  }

  function clearBattleLayoutVars(names) {
    const root = document.documentElement;
    const app = document.getElementById("app");
    names.forEach((name) => {
      root.style.removeProperty(name);
      app?.style.removeProperty(name);
    });
  }

  const BATTLE_LAYOUT_VAR_NAMES = [
    "--battle-hero-col-w",
    "--battle-hero-img-h",
    "--battle-thought-arena-min-h",
    "--battle-hero-zone-h",
    "--battle-hero-row-top",
    "--battle-hero-zone-h-active",
    "--battle-hero-col-w-active",
    "--battle-player-zone-left",
    "--battle-player-zone-width",
    "--battle-enemy-zone-left",
    "--battle-enemy-zone-width",
    "--battle-arena-zone-left",
    "--battle-arena-zone-width",
    "--battle-combat-floor-top",
    "--battle-combat-floor-h",
    "--battle-emoji-scale",
    "--desktop-battle-hero-zone-h",
    "--desktop-battle-hero-img-h",
    "--desktop-battle-hero-col-w",
    "--desktop-battle-thought-arena-min-h",
    "--tablet-battle-chrome-bottom",
  ];

  /** Единая раскладка боя: player | arena | enemy на всех tier. */
  function fitFlankArenaBattleLayout(root, canvas, fieldCol, stageW) {
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const hudReserve = measureBattleHudReserve();
    const cssW = readCssPx("--battle-canvas-w", canvas.width);
    const cssH = readCssPx("--battle-canvas-h", canvas.height);
    const mobileLayout = root.dataset.prepLayout === "mobile";
    const tabletSide = isTabletSideLayout(root);

    const profileKey = root.dataset.battleProfile
      || resolveLayoutProfile(stageW, vh, {
        tier: root.dataset.uiTier || "desktop",
        prepLayout: root.dataset.prepLayout || "side",
        tabletSideFit: tabletSide,
        tabletPrepHero: tabletSide,
        touchDev: root.dataset.touch === "true",
      }).battleProfile;

    const measuredFieldH = fieldCol?.clientHeight ?? 0;
    const measuredArenaH = document.getElementById("battle-thought-arena")?.offsetHeight ?? 0;

    let {
      cfg,
      heroZone,
      arenaMin,
      heroColW,
      heroImgH,
      portraitZoom,
      chromePad,
    } = computeBattleLayoutFromProfile(profileKey, { vh, hudReserve, stageW, measuredFieldH, measuredArenaH });

    applyBattleProfileDataset(root, profileKey);

    if (profileKey === "phone-portrait") {
      const heroCardH = heroZone;
      setBattleLayoutVar("--battle-hero-card-h", `${heroCardH}px`);
    }
    setBattleLayoutVar("--battle-portrait-object-y", cfg.portraitObjectY);
    setBattleLayoutVar("--battle-emoji-scale", String(cfg.emojiScale));
    if (cfg.tabletSide) {
      setBattleLayoutVar("--tablet-battle-hero-img-h", `${heroImgH}px`);
      setBattleLayoutVar("--tablet-battle-chrome-bottom", `${Math.max(hudReserve, chromePad)}px`);
    } else if (profileKey === "tablet-portrait") {
      root.style.setProperty("--tablet-battle-chrome-bottom", `${Math.max(hudReserve, chromePad)}px`);
    } else if (profileKey.startsWith("desktop-")) {
      setBattleLayoutVar("--tablet-battle-chrome-bottom", `${Math.max(hudReserve, 8)}px`);
      if (cfg.heroPortraitBleed) {
        setBattleLayoutVar("--hero-portrait-bleed", String(cfg.heroPortraitBleed));
      }
    }

    setBattleArenaLayout(true);
    setBattleHeroPlacement("flank-arena");

    setBattleLayoutVar("--battle-hero-col-w", `${heroColW}px`);
    setBattleLayoutVar("--battle-hero-img-h", `${heroImgH}px`);
    setBattleLayoutVar("--battle-thought-arena-min-h", `${arenaMin}px`);
    setBattleLayoutVar("--battle-hero-zone-h", `${heroZone}px`);
    setBattleLayoutVar("--battle-portrait-zoom", String(portraitZoom));
    setBattleLayoutVar("--desktop-battle-hero-zone-h", `${heroZone}px`);
    setBattleLayoutVar("--desktop-battle-hero-img-h", `${heroImgH}px`);
    setBattleLayoutVar("--desktop-battle-hero-col-w", `${heroColW}px`);
    setBattleLayoutVar("--desktop-battle-thought-arena-min-h", `${arenaMin}px`);
    root.style.removeProperty("--battle-canvas-display-w");
    root.style.removeProperty("--battle-canvas-display-h");

    if (mobileLayout) {
      setBattleLayoutVar("--mobile-battle-portrait-h", `${heroImgH}px`);
      root.style.removeProperty("--battle-canvas-display-w");
      root.style.removeProperty("--battle-canvas-display-h");
      root.style.removeProperty("--battle-field-display-w");
      root.style.removeProperty("--battle-grid-gap-display");
    }

    // Рюкзак в бою — в popover; canvas схлопнут CSS, не ставим 0×0 (ломает координаты).
    clearCanvasDisplaySize();
    syncMobileShopFabPosition();
    requestAnimationFrame(() => requestAnimationFrame(syncBattleSceneGridMetrics));
  }

  /** Единственный источник display-size #game-canvas (bitmap — game.js applyPhaseCanvasLayout). */
  function fitCanvasDisplaySize() {
    if (isLayoutInteractionLocked()) {
      deferredCanvasFit = true;
      return;
    }
    const app = document.getElementById("app");
    const canvas = document.getElementById("game-canvas");
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      syncFxCanvasGeometry();
      return;
    }

    const phase = app?.dataset.phase;
    const root = document.documentElement;

    if (phase !== "battle" && phase !== "replay") {
      setBattleArenaLayout(false);
      setBattleHeroPlacement(null);
      clearBattleLayoutVars(BATTLE_LAYOUT_VAR_NAMES);
    }

    if (phase === "battle" || phase === "replay") {
      const stage = canvas.closest(".battle-canvas-stage");
      const fieldCol = canvas.closest(".prep-field-column");
      const stageW = fieldCol?.clientWidth ?? stage?.clientWidth ?? 0;
      if (stage && stageW > 0) {
        fitFlankArenaBattleLayout(root, canvas, fieldCol, stageW);
        syncFxCanvasGeometry();
        return;
      }
      if (root.dataset.battleHeroPlacement !== "flank-arena") {
        setBattleArenaLayout(false);
        setBattleHeroPlacement(null);
        root.dataset.battleMobileFit = "false";
        [
          "--battle-canvas-display-w",
          "--battle-canvas-display-h",
          "--battle-field-display-w",
          "--battle-grid-gap-display",
        ].forEach((name) => root.style.removeProperty(name));
        setCanvasDisplaySize(
          canvas,
          readCssPx("--battle-canvas-w", canvas.width),
          readCssPx("--battle-canvas-h", canvas.height),
        );
      }
      syncMobileShopFabPosition();
      syncFxCanvasGeometry();
      requestAnimationFrame(() => syncBattleSceneGridMetrics());
      return;
    }

    if (phase !== "prep") {
      clearCanvasDisplaySize();
      syncMobileShopFabPosition();
      syncFxCanvasGeometry();
      return;
    }

    root.dataset.battleMobileFit = "false";
    [
      "--battle-canvas-display-w",
      "--battle-canvas-display-h",
      "--battle-field-display-w",
      "--battle-grid-gap-display",
    ].forEach((name) => root.style.removeProperty(name));

    const sideFit = root.dataset.prepSideFit === "true";
    const mobileFit = root.dataset.prepMobileFit === "true";
    const viewportFit = root.dataset.prepViewportFit === "true";
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const sideBySidePrep = root.dataset.prepLayout === "side" && vw >= 600;
    const hasFieldColumn = !!document.querySelector(".prep-field-column");

    if (sideBySidePrep && hasFieldColumn) {
      if (usesTabletPrepHeroLayout(root)) {
        const stage = canvas.closest(".battle-canvas-stage");
        const fieldCol = canvas.closest(".prep-field-column");
        const layerWorld = fieldCol?.querySelector(".layer-world");
        const stageW = fieldCol?.clientWidth ?? stage?.clientWidth ?? canvas.width;
        if (stageW > 0) {
          const sceneTop = readCssPx("--prep-scene-top", 14);
          const columnH = fieldCol?.clientHeight > 0
            ? fieldCol.clientHeight
            : Math.max(320, (window.visualViewport?.height ?? window.innerHeight) - measurePrepChromeHeight());
          const heroH = computeTabletPrepHeroHeight(columnH, sceneTop);
          const prevHeroH = readCssPx("--tablet-prep-hero-h", 0);
          if (Math.abs(prevHeroH - heroH) >= 1) {
            root.style.setProperty("--tablet-prep-hero-h", `${heroH}px`);
          }
          const uiScale = readCssPx("--ui-scale", 1);
          const pad = Math.round(8 * uiScale);
          const fitW = layerWorld?.clientWidth > 0 ? layerWorld.clientWidth : stageW;
          const fitH = layerWorld?.clientHeight > 0 ? layerWorld.clientHeight : columnH;
          const maxH = Math.max(200, fitH - sceneTop - pad);
          const scale = Math.min(fitW / canvas.width, maxH / canvas.height);
          const ipadMini = isIpadMiniPwaLandscape();
          const finalScale = Math.min(
            Math.max(scale, ipadMini ? 0.92 : 0.9),
            ipadMini ? 1.02 : 1.08,
          );
          const w = Math.max(1, Math.floor(canvas.width * finalScale));
          const ch = Math.max(1, Math.floor(canvas.height * finalScale));
          root.style.setProperty("--prep-canvas-display-w", `${w}px`);
          root.style.setProperty("--prep-canvas-display-h", `${ch}px`);
          setCanvasDisplaySize(canvas, w, ch);
          syncMobileShopFabPosition();
          syncFxCanvasGeometry();
          return;
        }
      }
      setCanvasDisplaySize(
        canvas,
        readCssPx("--prep-canvas-w", canvas.width),
        readCssPx("--prep-canvas-h", canvas.height),
      );
      root.style.removeProperty("--prep-canvas-display-w");
      root.style.removeProperty("--prep-canvas-display-h");
      syncFxCanvasGeometry();
      return;
    }

    if (sideFit || mobileFit || viewportFit) {
      const stage = canvas.closest(".battle-canvas-stage");
      const fieldCol = canvas.closest(".prep-field-column");
      if (!stage) return;

      let stageW = (mobileFit && fieldCol?.clientWidth) ? fieldCol.clientWidth : stage.clientWidth;
      if (stageW <= 0) return;

      let maxH = canvas.height;
      const maxW = canvas.width;
      if (sideFit || mobileFit) {
        const avail = window.visualViewport?.height ?? window.innerHeight;
        maxH = Math.max(180, avail - measurePrepChromeHeight() - (mobileFit ? 24 : 200));
      } else if (viewportFit) {
        const cssMax = getComputedStyle(root).getPropertyValue("--prep-canvas-max-h").trim();
        if (cssMax) maxH = parseFloat(cssMax) || maxH;
        if (root.dataset.prepShopDrawer === "true" && fieldCol?.clientHeight > 80) {
          stageW = fieldCol.clientWidth;
          const canvasShare = 0.53;
          maxH = Math.max(maxH, Math.round(fieldCol.clientHeight * canvasShare));
          root.style.setProperty(
            "--prep-tablet-canvas-cap",
            `${Math.round(Math.min(fieldCol.clientHeight * canvasShare, maxH))}px`,
          );
        } else {
          root.style.removeProperty("--prep-tablet-canvas-cap");
        }
        if (root.dataset.uiSurface === "phone-landscape" && fieldCol?.clientHeight > 80) {
          stageW = Math.max(stageW, Math.floor(fieldCol.clientWidth * 0.5));
          maxH = Math.max(maxH, Math.round(fieldCol.clientHeight * 0.94));
        }
      }

      const allowUpscale = mobileFit
        || root.dataset.prepShopDrawer === "true"
        || (viewportFit && root.dataset.uiSurface === "phone-landscape");
      const scale = allowUpscale
        ? Math.min(stageW / canvas.width, maxH / canvas.height)
        : Math.min(stageW / canvas.width, maxW / canvas.width, maxH / canvas.height);
      if (scale <= 0) return;

      const w = Math.max(1, Math.floor(canvas.width * scale));
      const h = Math.max(1, Math.floor(canvas.height * scale));
      let outW = w;
      let outH = h;
      if (root.dataset.prepShopDrawer === "true" && root.dataset.uiSurface === "tablet-stacked") {
        outW = Math.max(1, Math.round(w * 0.85));
        outH = Math.max(1, Math.round(h * 0.85));
      }
      setCanvasDisplaySize(canvas, outW, outH);
      if (mobileFit || root.dataset.prepShopDrawer === "true") {
        root.style.setProperty("--prep-canvas-display-w", `${outW}px`);
        root.style.setProperty("--prep-canvas-display-h", `${outH}px`);
      } else {
        root.style.removeProperty("--prep-canvas-display-w");
        root.style.removeProperty("--prep-canvas-display-h");
      }
      syncMobileShopFabPosition();
      syncFxCanvasGeometry();
      return;
    }

    if (hasFieldColumn) {
      setCanvasDisplaySize(
        canvas,
        readCssPx("--prep-canvas-w", canvas.width),
        readCssPx("--prep-canvas-h", canvas.height),
      );
      syncFxCanvasGeometry();
      return;
    }

    clearCanvasDisplaySize();
    syncFxCanvasGeometry();
  }

  /** Подгонка строк магазина в tablet drawer — без вертикального скролла. */
  function syncTabletPortraitShopRows() {
    if (!usesPrepShopDrawer() || document.documentElement.dataset.uiSurface !== "tablet-stacked") return;
    if (!document.documentElement.hasAttribute("data-prep-shop-open")) return;
    const app = document.getElementById("app");
    if (app?.dataset.phase !== "prep") return;

    const panel = document.getElementById("shop-panel");
    const slots = panel?.querySelector(".shop-slots");
    if (!panel || !slots || panel.offsetHeight < 120) return;

    const chrome = panel.querySelector(".shop-chrome");
    const sell = panel.querySelector(".shop-sell-zone");
    const benchPanel = panel.querySelector(".bench-panel");
    const fixedH = (chrome?.offsetHeight ?? 0)
      + (sell?.offsetHeight ?? 0)
      + (benchPanel?.querySelector("h3")?.offsetHeight ?? 0)
      + Math.round(16 * readCssPx("--ui-scale", 1));

    const slotsArea = Math.max(120, panel.offsetHeight - fixedH);
    const shopRows = 1;
    const benchRows = 1;
    const shopShare = 0.52;
    const shopRowH = Math.floor((slotsArea * shopShare) / shopRows);
    const benchRowH = Math.floor((slotsArea * (1 - shopShare)) / benchRows);
    const rowH = Math.max(56, Math.min(96, shopRowH));
    const benchH = Math.max(44, Math.min(72, benchRowH));

    const root = document.documentElement;
    root.style.setProperty("--prep-shop-row-h", `${rowH}px`);
    root.style.setProperty("--prep-bench-row-h", `${benchH}px`);
  }

  let canvasFitRafId = 0;
  let deferredCanvasFit = false;
  let canvasFitInProgress = false;
  let canvasFitLastAt = 0;
  let canvasFitDeferRaf = 0;
  const CANVAS_FIT_MIN_MS = 160;

  function isLayoutInteractionLocked() {
    const body = document.body;
    if (body?.classList.contains("is-ui-dragging")) return true;
    if (body?.classList.contains("screen-transitioning")) return true;
    return !!document.querySelector(".game-layout")?.classList.contains("phase-transitioning");
  }

  function flushDeferredLayoutPasses() {
    if (!deferredCanvasFit || isLayoutInteractionLocked()) return;
    deferredCanvasFit = false;
    scheduleLayout();
  }

  function runCanvasFitPass() {
    if (isLayoutInteractionLocked()) {
      deferredCanvasFit = true;
      return;
    }
    if (canvasFitInProgress) return;

    const now = performance.now();
    if (now - canvasFitLastAt < CANVAS_FIT_MIN_MS) {
      if (!canvasFitDeferRaf) {
        canvasFitDeferRaf = requestAnimationFrame(() => {
          canvasFitDeferRaf = 0;
          scheduleCanvasFit();
        });
      }
      return;
    }

    canvasFitInProgress = true;
    deferredCanvasFit = false;
    canvasFitLastAt = now;
    try {
      fitCanvasDisplaySize();
      syncPrepHeroSlotHeight();
      syncTabletPortraitShopRows();
      const zones = measureLayoutZones();
      applyMeasuredZoneFit(zones);
      syncMobileShopFabPosition();
      if (document.documentElement.style.getPropertyValue("--zone-fit-shrink")) {
        requestAnimationFrame(() => {
          if (canvasFitInProgress) return;
          canvasFitInProgress = true;
          try {
            fitCanvasDisplaySize();
            syncTabletPortraitShopRows();
            const refitZones = measureLayoutZones();
            applyMeasuredZoneFit(refitZones);
            syncMobileShopFabPosition();
          } finally {
            canvasFitInProgress = false;
          }
        });
      }
    } finally {
      canvasFitInProgress = false;
    }
  }

  function scheduleCanvasFit() {
    if (canvasFitInProgress) return;
    if (canvasFitRafId) return;
    canvasFitRafId = requestAnimationFrame(() => {
      canvasFitRafId = 0;
      requestAnimationFrame(runCanvasFitPass);
    });
  }

  function onCanvasFitResize() {
    if (canvasFitInProgress) return;
    scheduleCanvasFit();
  }

  function applyPrepLayoutFit(w, h, prepLayout, baseScale, touchDev, layoutProfile) {
    document.documentElement.dataset.prepViewportFit = "false";
    document.documentElement.dataset.prepSideFit = "false";
    document.documentElement.dataset.prepMobileFit = "false";
    document.documentElement.dataset.prepShopDrawer = "false";
    document.documentElement.style.removeProperty("--prep-canvas-max-h");
    document.documentElement.style.removeProperty("--prep-canvas-max-h-base");
    document.documentElement.style.removeProperty("--zone-fit-shrink");

    const cfg = PREP_PROFILES[layoutProfile?.id] || PREP_PROFILES["desktop-landscape"];
    const hudH = isLayoutBlockingModal() ? 0 : measureBottomChromeHeight();
    const chromeH = measurePrepChromeHeight() + hudH;
    const available = Math.max(400, h - chromeH);

    if (prepLayout === "mobile") {
      document.documentElement.dataset.prepMobileFit = "true";
      document.documentElement.dataset.prepShopDrawer = "true";
      let fitScale = Math.min(baseScale, available / cfg.fitAvailH, w / (DESIGN_W * cfg.fitWidthRatio));
      fitScale = Math.max(cfg.fitMinScale, Math.min(SCALE_MAX, fitScale));
      return Math.round(fitScale * 1000) / 1000;
    }

    if (prepLayout === "stacked") {
      document.documentElement.dataset.prepViewportFit = "true";
      let fitScale = Math.min(baseScale, available / cfg.fitAvailH, w / DESIGN_W);
      fitScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, fitScale));
      const canvasMax = Math.round(Math.min(available * cfg.canvasAvailShare, cfg.canvasMaxCap * fitScale));
      document.documentElement.style.setProperty("--prep-canvas-max-h", `${canvasMax}px`);
      const tabletDrawer = layoutProfile?.id === "tablet-portrait";
      document.documentElement.dataset.prepShopDrawer = tabletDrawer ? "true" : "false";
      if (!tabletDrawer) {
        document.documentElement.removeAttribute("data-prep-shop-open");
      }
      return Math.round(fitScale * 1000) / 1000;
    }

    document.documentElement.dataset.prepShopDrawer = "false";

    if (prepLayout === "side" && w >= 600) {
      let fitScale = Math.min(baseScale, available / cfg.fitAvailH, w / DESIGN_W);
      fitScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, fitScale));
      return Math.round(fitScale * 1000) / 1000;
    }

    if (touchDev && w < 600) {
      document.documentElement.dataset.prepSideFit = "true";
      let fitScale = Math.min(baseScale, available / cfg.fitAvailH, w / DESIGN_W);
      fitScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, fitScale));
      return Math.round(fitScale * 1000) / 1000;
    }

    return baseScale;
  }

  function applyBattleHudPin(hudVisible, refreshAppH = false) {
    document.documentElement.dataset.battleHudPin = "false";
    document.documentElement.style.removeProperty("--hud-fixed-top");
    if (!hudVisible || refreshAppH) {
      const chromeH = measureBottomChromeHeight();
      document.documentElement.style.setProperty("--hud-offset", `${chromeH}px`);
      document.documentElement.style.setProperty(
        "--app-h",
        `calc(var(--viewport-h, 100dvh) - ${chromeH}px - env(safe-area-inset-top))`,
      );
    }
  }

  function applyUiLayout() {
    const { w, h } = viewportSize();
    const rawScale = Math.min(w / DESIGN_W, h / DESIGN_H);

    const touchDev = isTouchDevice();
    document.documentElement.dataset.touch = touchDev ? "true" : "false";
    const gamepadMode = typeof isGamepadInteraction === "function" && isGamepadInteraction();
    document.documentElement.dataset.gamepadHud = (touchDev && !gamepadMode) ? "hidden" : "auto";

    let tier = "desktop";
    if (w <= 720 || h <= 520) tier = "phone";
    else if (w <= 1366 || h <= 940) tier = "tablet";

    document.documentElement.dataset.uiTier = tier;
    document.documentElement.dataset.orientation = w > h ? "landscape" : "portrait";

    const compact = tier !== "desktop" || h <= 820;
    document.documentElement.dataset.uiCompact = compact ? "true" : "false";

    const scaleFloor = tier === "phone" ? 0.58 : SCALE_MIN;
    let clamped = Math.max(scaleFloor, Math.min(SCALE_MAX, rawScale));

    const prepLayout = shouldUseMobilePrepLayout(w, h, tier)
      ? "mobile"
      : (shouldUseStackedPrep(w, h, tier) ? "stacked" : "side");
    document.documentElement.dataset.prepLayout = prepLayout;
    const tabletSideFit = shouldUseTabletSideFit(w, h, prepLayout, touchDev, tier);
    const tabletPrepHero = tabletSideFit
      || (prepLayout === "side" && w > h && tier === "tablet" && touchDev);

    const layoutProfile = resolveLayoutProfile(w, h, {
      tier,
      prepLayout,
      tabletSideFit,
      tabletPrepHero,
      touchDev,
    });
    document.documentElement.dataset.layoutProfile = layoutProfile.id;
    document.documentElement.dataset.battleProfile = layoutProfile.battleProfile;
    document.documentElement.dataset.heroCardMode = "full-bleed";
    applyBattleFxScaleVars(layoutProfile.battleProfile);
    document.documentElement.dataset.uiSurface = resolveUiSurface({
      prepLayout,
      tabletSideFit,
      tabletPrepHero,
      layoutProfile,
    });
    if (layoutProfile.phoneLandscape) {
      document.documentElement.dataset.battlePhoneLandscape = "true";
    } else {
      document.documentElement.removeAttribute("data-battle-phone-landscape");
    }

    if (!isTabletSideLayout()) {
      clearTabletSideVars();
    }
    if (prepLayout !== "mobile") {
      clearMobileDisplayVars();
    }
    const preFitScale = clamped;
    const gameScale = computeGameScale(preFitScale, layoutProfile);
    document.documentElement.style.setProperty("--game-scale", String(gameScale));
    applyFluidGridMetrics(preFitScale);

    clamped = applyPrepLayoutFit(w, h, prepLayout, preFitScale, touchDev, layoutProfile);
    clamped = applyIntroUiScaleFloor(clamped, layoutProfile);
    applyPrepProfileVars(layoutProfile, clamped);
    syncPrepBenchPopoverMode(prepLayout);
    syncPrepShopPopoverMode(prepLayout);

    const typeScale = computeTypeScale(clamped, layoutProfile);
    document.documentElement.style.setProperty("--type-scale", String(typeScale));
    document.documentElement.style.setProperty("--ui-scale", String(clamped));
    document.documentElement.style.setProperty("--viewport-h", `${Math.round(h)}px`);
    document.documentElement.style.setProperty("--viewport-w", `${Math.round(w)}px`);

    if (typeof BattleFxTier !== "undefined" && BattleFxTier.applyBattleFxTierFlags) {
      BattleFxTier.applyBattleFxTierFlags();
    }

    const classOverlayOpen = isClassOverlayOpen();
    const modalBlocksHud = isLayoutBlockingModal() && !classOverlayOpen;
    const hudVisible = !modalBlocksHud;
    const hudH = measureBottomChromeHeight();
    document.documentElement.style.setProperty("--bottom-chrome-h-measured", `${hudH}px`);
    document.documentElement.style.setProperty("--hud-offset", `${hudH}px`);
    document.documentElement.style.setProperty(
      "--app-h",
      hudVisible
        ? "calc(var(--viewport-h, 100dvh) - var(--hud-offset) - env(safe-area-inset-top))"
        : "calc(var(--viewport-h, 100dvh) - var(--hud-offset) - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
    );
    applyBattleHudPin(hudVisible);
    if (classOverlayOpen) {
      document.documentElement.style.setProperty(
        "--overlay-max-h",
        `calc(var(--viewport-h, 100dvh) - env(safe-area-inset-top) - ${hudH}px - 8px)`,
      );
    } else {
      document.documentElement.style.setProperty(
        "--overlay-max-h",
        "calc(var(--viewport-h, 100dvh) - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 10px)",
      );
    }

    requestAnimationFrame(() => {
      syncBottomChromeDock();
      const dockH = measureBottomChromeHeight();
      document.documentElement.style.setProperty("--bottom-chrome-h-measured", `${dockH}px`);
      document.documentElement.style.setProperty("--hud-offset", `${dockH}px`);
      document.documentElement.style.setProperty(
        "--app-h",
        hudVisible
          ? "calc(var(--viewport-h, 100dvh) - var(--hud-offset) - env(safe-area-inset-top))"
          : "calc(var(--viewport-h, 100dvh) - var(--hud-offset) - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
      );
    });

    const appPhase = document.getElementById("app")?.dataset.phase ?? "prep";
    syncTabletSideLayoutVars(h, appPhase);

    if (typeof window.syncShopHintsVisibility === "function") {
      window.syncShopHintsVisibility();
    }

    syncBattleHudFeedDock();

    if (typeof syncBattleHudSurfaceFlags === "function") syncBattleHudSurfaceFlags();

    syncClassOverlayAnchors();

    if (isBattleUiPhase() && syncHeroEmotionSlotAnchors._layout) {
      syncHeroEmotionSlotAnchors._layout.player = "";
      syncHeroEmotionSlotAnchors._layout.enemy = "";
      syncHeroEmotionSlotAnchors._rootEmoji = null;
      if (typeof BattleHeroAnchor !== "undefined" && BattleHeroAnchor.invalidateMeasureCache) {
        BattleHeroAnchor.invalidateMeasureCache();
      }
    }

    if (!isLayoutInteractionLocked()) {
      scheduleCanvasFit();
      syncMobileShopFabPosition();
      syncPrepBenchFabPosition();
      if (typeof window.syncPrepShopPopoverPosition === "function") window.syncPrepShopPopoverPosition();
      if (typeof window.syncPrepSellFabPosition === "function") window.syncPrepSellFabPosition();
      if (typeof window.syncPrepSellFabVisibility === "function") window.syncPrepSellFabVisibility();
      syncPrepHeroSlotHeight();
      ensurePrepHeroCardPortraitObserver();
      syncPrepHeroCardPortraitSize();
      window.syncPrepHeroCardChrome?.();
      if (typeof syncPrepBuildEmojiBtnFromRuntime === "function") {
        syncPrepBuildEmojiBtnFromRuntime();
      } else if (typeof syncPrepBuildEmojiBtnMount === "function") {
        syncPrepBuildEmojiBtnMount();
      }

      if (usesTabletPrepHeroLayout() && appPhase === "prep") {
        syncTabletSidePrepGridMetrics();
      }
      if (typeof window.applyGridMetricsFromCss === "function") {
        window.applyGridMetricsFromCss();
      }
    } else {
      deferredCanvasFit = true;
    }
    syncBattleHudAnchors();
    syncFxCanvasGeometry();
  }

  let layoutRafId = 0;
  let lastViewportW = 0;
  let lastViewportH = 0;

  function runLayoutFollowUp() {
    if (document.documentElement.dataset.battleHudPin === "true") {
      applyBattleHudPin(true, true);
    }
    if (
      document.documentElement.dataset.battleArenaLayout === "true"
      && isBattleUiPhase()
    ) {
      const { h } = viewportSize();
      syncTabletSideLayoutVars(h, document.getElementById("app")?.dataset.phase ?? "prep");
      fitCanvasDisplaySize();
      requestAnimationFrame(() => {
        syncBattleSceneGridMetrics();
        syncBattleHudAnchors();
        syncFxCanvasGeometry();
      });
    }
  }

  function scheduleLayout() {
    if (isLayoutInteractionLocked()) {
      deferredCanvasFit = true;
      return;
    }
    if (layoutRafId) return;
    layoutRafId = requestAnimationFrame(() => {
      layoutRafId = 0;
      const { w, h } = viewportSize();
      lastViewportW = w;
      lastViewportH = h;
      applyUiLayout();
      if (!isLayoutInteractionLocked()) {
        requestAnimationFrame(runLayoutFollowUp);
      } else {
        deferredCanvasFit = true;
      }
    });
  }

  function scheduleLayoutOnViewportChange() {
    const { w, h } = viewportSize();
    if (w === lastViewportW && h === lastViewportH) return;
    scheduleLayout();
  }

  scheduleLayout();
  window.addEventListener("resize", scheduleLayout, { passive: true });
  window.addEventListener("orientationchange", scheduleLayout, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleLayoutOnViewportChange, { passive: true });
  document.addEventListener("DOMContentLoaded", () => {
    scheduleLayout();
    const stage = document.querySelector(".battle-canvas-stage");
    if (stage && typeof ResizeObserver !== "undefined") {
      new ResizeObserver(onCanvasFitResize).observe(stage);
    }
    const prepFieldCol = document.getElementById("prep-field-column");
    if (prepFieldCol && typeof ResizeObserver !== "undefined") {
      new ResizeObserver(onCanvasFitResize).observe(prepFieldCol);
    }
    const battleSceneUi = document.getElementById("battle-scene-ui");
    const gameCanvas = document.getElementById("game-canvas");
    const prepFieldIsland = document.getElementById("prep-field-island");
    const syncBattleGridOnResize = () => {
      if (document.documentElement.dataset.battleArenaLayout === "true" && isBattleUiPhase()) {
        syncBattleSceneGridMetrics();
      }
    };
    if (typeof ResizeObserver !== "undefined") {
      if (battleSceneUi) new ResizeObserver(syncBattleGridOnResize).observe(battleSceneUi);
      if (gameCanvas) new ResizeObserver(syncBattleGridOnResize).observe(gameCanvas);
      if (prepFieldIsland) new ResizeObserver(syncBattleGridOnResize).observe(prepFieldIsland);
    }
    const hud = getBottomChrome();
    if (hud) {
      new MutationObserver(scheduleLayout).observe(hud, {
        attributes: true,
        attributeFilter: ["class", "style"],
      });
    }
    ["class-overlay", "battle-result-overlay", "battle-detail-overlay", "overlay", "settings-overlay", "escape-menu-overlay"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        new MutationObserver(scheduleLayout).observe(el, {
          attributes: true,
          attributeFilter: ["class"],
        });
      }
    });
    const app = document.getElementById("app");
    if (app) {
      new MutationObserver(scheduleLayout).observe(app, {
        attributes: true,
        attributeFilter: ["data-phase", "data-prep-side"],
      });
    }
  });

  window.applyUiLayout = applyUiLayout;
  window.fitCanvasDisplaySize = fitCanvasDisplaySize;
  window.fitPrepCanvasToStage = fitCanvasDisplaySize;
  window.scheduleCanvasFit = scheduleCanvasFit;
  window.flushDeferredLayoutPasses = flushDeferredLayoutPasses;
  window.syncMobileShopFabPosition = syncMobileShopFabPosition;
  window.syncPrepBenchFabPosition = syncPrepBenchFabPosition;
  window.syncPrepShopPopoverPosition = syncPrepShopPopoverPosition;
  window.syncPrepSellFabPosition = syncPrepSellFabPosition;
  window.syncTabletPortraitShopRows = syncTabletPortraitShopRows;
  window.syncMobileOverlayAnchors = syncMobileOverlayAnchors;
  window.syncPrepMobileZoneAnchors = syncPrepMobileZoneAnchors;
  window.syncClassOverlayAnchors = syncClassOverlayAnchors;
  window.syncBattleHudAnchors = syncBattleHudAnchors;
  window.syncFxCanvasGeometry = syncFxCanvasGeometry;
  window.syncBattleHudFeedDock = syncBattleHudFeedDock;
  window.syncTabletBattleAvatarPositions = syncTabletBattleAvatarPositions;
  window.syncBattleSceneGridMetrics = syncBattleSceneGridMetrics;
  window.scheduleBattleHeroRowSync = scheduleBattleHeroRowSync;
  window.syncPrepHeroSlotHeight = syncPrepHeroSlotHeight;
  window.syncPrepHeroCardPortraitSize = syncPrepHeroCardPortraitSize;
  window.measureLayoutZones = measureLayoutZones;
  window.syncHeroEmotionSlotAnchors = syncHeroEmotionSlotAnchors;
  window.usesBattlePrepHeroLayer = usesBattlePrepHeroLayer;
  window.measureBattlePrepHeroRect = measureBattlePrepHeroRect;
})();
