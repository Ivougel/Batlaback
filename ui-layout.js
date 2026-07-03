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
    if (isModalOpen() && !isClassOverlayOpen()) {
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
    if (isModalOpen()) return 0;
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
    return root.dataset.prepLayout === "side" || root.dataset.uiSurface === "tablet-side";
  }

  function computeTabletPrepHeroHeight(columnH, sceneTop = 14) {
    const usable = Math.max(220, columnH - sceneTop - 12);
    return Math.round(Math.min(300, Math.max(168, usable * 0.32)));
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
      canvasAvailShare: 0.36, canvasMaxCap: 260,
      shopRowBase: 72, shopRowMin: 56, shopRowMax: 76,
      heroSlotHeight: "min(54vh, 520px)", heroSlotMax: 560,
      sceneAvatarH: 148, sceneAvatarW: 118, dollSlot: 38, characterGap: 8,
      shopPanelW: 310,
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
      shopRowBase: 74, shopRowMin: 58, shopRowMax: 78,
      heroSlotHeight: "min(54vh, 520px)", heroSlotMax: 560,
      sceneAvatarH: 152, sceneAvatarW: 120, dollSlot: 38, characterGap: 8,
      shopPanelW: 320,
    },
  };

  function applyPrepProfileVars(layoutProfile, fitScale = 1) {
    const cfg = PREP_PROFILES[layoutProfile.id] || PREP_PROFILES["desktop-landscape"];
    const root = document.documentElement;
    root.style.setProperty("--prep-hero-slot-height", cfg.heroSlotHeight);
    root.style.setProperty("--prep-hero-slot-height-max", `${cfg.heroSlotMax}px`);
    root.style.setProperty("--prep-scene-avatar-h", `calc(${cfg.sceneAvatarH}px * var(--game-scale))`);
    root.style.setProperty("--prep-scene-avatar-w", `calc(${cfg.sceneAvatarW}px * var(--game-scale))`);
    root.style.setProperty("--doll-slot-size", `calc(${cfg.dollSlot}px * var(--game-scale))`);
    root.style.setProperty("--prep-character-gap", `${cfg.characterGap}px`);
    root.style.setProperty("--shop-panel-w", `${cfg.shopPanelW}px`);
    const shopRowH = Math.round(Math.max(
      cfg.shopRowMin,
      Math.min(cfg.shopRowMax, cfg.shopRowBase * fitScale),
    ));
    root.style.setProperty("--prep-shop-row-h", `${shopRowH}px`);
    const benchRowH = Math.max(44, Math.round(shopRowH * 0.78));
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
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.style.maxWidth = `${w}px`;
    canvas.style.maxHeight = `${h}px`;
    if (canvas.id === "game-canvas") {
      const fx = document.getElementById("canvas-fx");
      if (fx) {
        fx.style.width = `${w}px`;
        fx.style.height = `${h}px`;
        fx.style.maxWidth = `${w}px`;
        fx.style.maxHeight = `${h}px`;
        if (canvas.width > 0 && canvas.height > 0) {
          fx.width = canvas.width;
          fx.height = canvas.height;
        }
      }
    }
  }

  function syncFxCanvasGeometry() {
    const viewport = document.getElementById("prep-field-column");
    const canvasEl = document.getElementById("game-canvas");
    const anchor = document.getElementById("canvas-fx-anchor");
    if (!viewport || !canvasEl || !anchor) return;

    const vpRect = viewport.getBoundingClientRect();
    const canvasRect = canvasEl.getBoundingClientRect();
    if (canvasRect.width <= 0 || canvasRect.height <= 0) return;

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
    if (!isPrepHeroCardHud(root)) {
      root.style.removeProperty("--prep-hero-card-portrait-w");
      root.style.removeProperty("--prep-hero-card-portrait-h");
    }
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
  }

  function isTabletLandscapeSideBattle(root = document.documentElement) {
    return root.dataset.battleProfile === "tablet-landscape-side";
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

    const vpRect = viewport.getBoundingClientRect();
    const root = document.documentElement;
    const useFlankZones = root.dataset.battleHeroPlacement === "flank-arena";
    const tabletLandscapeSide = isTabletLandscapeSideBattle(root);

    let sharedStageBottom = null;
    if (tabletLandscapeSide && useFlankZones) {
      const stageBottoms = ["player-avatar-slot", "enemy-avatar-slot"]
        .map((slotId) => document.getElementById(slotId)?.querySelector(".avatar-hero-stage"))
        .filter(Boolean)
        .map((stage) => stage.getBoundingClientRect().bottom)
        .filter((bottom) => bottom > 8);
      if (stageBottoms.length) sharedStageBottom = Math.max(...stageBottoms);
    }

    let sharedHudTopPx = null;
    if (tabletLandscapeSide) {
      const barsGapEarly = Math.round(6 * readCssPx("--ui-scale", 1));
      const hudOverlapEarly = readCssPx("--hero-hud-overlap", Math.round(10 * readCssPx("--ui-scale", 1)));
      const heroRowTop = readCssPx("--battle-hero-row-top", 0);
      const heroImgH = readCssPx(
        "--battle-hero-img-h",
        readCssPx("--tablet-battle-hero-img-h", 280),
      );
      const nameBand = Math.round(28 * readCssPx("--ui-scale", 1));
      sharedHudTopPx = Math.max(
        0,
        Math.round(heroRowTop + nameBand + heroImgH + barsGapEarly - hudOverlapEarly),
      );
    } else if (sharedStageBottom != null) {
      const barsGapEarly = Math.round(6 * readCssPx("--ui-scale", 1));
      const hudOverlapEarly = readCssPx("--hero-hud-overlap", Math.round(16 * readCssPx("--ui-scale", 1)));
      sharedHudTopPx = Math.max(0, Math.round(sharedStageBottom - vpRect.top + barsGapEarly - hudOverlapEarly));
    }

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
    ].forEach(({ slotId, panelId, hudId, zoneLeftVar, zoneWidthVar }) => {
      const slot = document.getElementById(slotId);
      const panel = document.getElementById(panelId);
      const hud = document.getElementById(hudId);
      if (!slot || !hud) return;

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
        if (tabletLandscapeSide && stageRect && stageRect.width > 40) {
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

      const barsGap = Math.round(6 * readCssPx("--ui-scale", 1));
      const hudOverlap = useFlankZones
        ? readCssPx("--hero-hud-overlap", Math.round(16 * readCssPx("--ui-scale", 1)))
        : 0;
      let hudTopPx = sharedHudTopPx != null
        ? sharedHudTopPx
        : Math.max(0, Math.round(anchorBottom - vpRect.top + barsGap - hudOverlap));
      if (sharedHudTopPx == null && stageRect && stageRect.height > 8) {
        const minTop = Math.round(stageRect.bottom - vpRect.top + barsGap);
        if (hudTopPx < minTop) hudTopPx = minTop;
      }

      const heroRowTop = readCssPx("--battle-hero-row-top", 0);
      const heroZoneH = readCssPx("--battle-hero-zone-h-active", readCssPx("--battle-hero-zone-h", 0));
      if (heroZoneH > 40) {
        const heroRowBottomVp = heroRowTop + heroZoneH - vpRect.top;
        const maxHudH = Math.max(40, Math.round(heroRowBottomVp - hudTopPx - barsGap));
        hud.style.setProperty("--battle-hud-max-h", `${maxHudH}px`);
      }

      hud.style.left = `${Math.round(hudLeft)}px`;
      hud.style.top = `${hudTopPx}px`;
      hud.style.width = `${Math.round(hudWidth)}px`;
      hud.style.maxWidth = `${Math.round(hudWidth)}px`;
    });

    if (typeof syncBattleHudSurfaceFlags === "function") syncBattleHudSurfaceFlags();
    if (useFlankZones) syncHeroEmotionSlotAnchors();
    syncHeroAttackSlotAnchors();
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
  }

  /** @deprecated alias — используйте syncMobileOverlayAnchors */
  function syncPrepMobileZoneAnchors(zones) {
    syncMobileOverlayAnchors(zones);
  }

  function syncMobileShopFabPosition() {
    const root = document.documentElement;
    syncMobileOverlayAnchors({ phase: document.getElementById("app")?.dataset.phase || "prep" });

    if (!usesPrepShopDrawer()) {
      return;
    }
    const phase = document.getElementById("app")?.dataset.phase;
    if (phase !== "prep") return;

    const tip = document.getElementById("sidebar-tooltip");
    if (tip && !tip.classList.contains("hidden")
      && typeof window.positionPrepTooltipDock === "function") {
      window.positionPrepTooltipDock();
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

  /** Эмодзи-аватар: в combat floor (нижняя полоса дуэли) на всех tier. */
  function syncHeroEmotionSlotAnchors(opts = {}) {
    const root = document.documentElement;
    if (root.dataset.battleHeroPlacement !== "flank-arena") {
      root.removeAttribute("data-tablet-thought-corners");
      root.removeAttribute("data-thought-slot-below-hero");
      root.removeAttribute("data-battle-combat-floor");
      syncHeroEmotionSlotAnchors._layout = null;
      return;
    }

    const combatFloor = typeof BattleHeroAnchor !== "undefined"
      && BattleHeroAnchor.usesCombatFloorAnchors();
    root.dataset.battleCombatFloor = combatFloor ? "true" : "false";
    root.dataset.tabletThoughtCorners = combatFloor ? "true" : "false";
    const headBadge = combatFloor
      && typeof BattleHeroAnchor !== "undefined"
      && BattleHeroAnchor.usesHeadBadgeAnchors?.();
    root.dataset.thoughtHeadBadge = headBadge ? "true" : "false";
    root.dataset.thoughtSlotBelowHero = combatFloor && !headBadge ? "true" : "false";

    const vmin = Math.min(
      window.visualViewport?.width ?? window.innerWidth,
      window.visualViewport?.height ?? window.innerHeight,
    );
    const size = typeof BattleHeroAnchor !== "undefined"
      ? BattleHeroAnchor.thoughtSlotSize(vmin)
      : Math.round(Math.min(112, Math.max(68, vmin * 0.12)));

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
            ? (BattleHeroAnchor.getHeroBelowThoughtAnchor?.(side)
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
      }

      thoughtSlot.style.position = "fixed";
      thoughtSlot.style.left = `${Math.round(cx - slotSize / 2)}px`;
      thoughtSlot.style.top = `${Math.round(Math.max(4, top))}px`;
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

    const heroZoneH = readCssPx(
      "--battle-hero-zone-h",
      readCssPx("--desktop-battle-hero-zone-h", 220),
    );
    const heroColW = readCssPx(
      "--battle-hero-col-w",
      readCssPx("--desktop-battle-hero-col-w", 180),
    );
    const uiScale = readCssPx("--ui-scale", 1);
    const edgePad = Math.max(4, Math.round(4 * uiScale));
    const scenePad = Math.max(4, Math.round(4 * uiScale));
    const fieldPadBottom = parseFloat(getComputedStyle(fieldCol).paddingBottom) || 0;
    const toolbarReserve = fieldPadBottom > 0
      ? fieldPadBottom
      : measureBattleFieldChromeBottom(fieldCol);
    const layoutHeight = Math.max(layoutRect.height, sceneRect.height, fieldCol.clientHeight);
    const rowGap = Math.round(8 * uiScale);
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
    const arenaGap = Math.round(8 * uiScale);
    const vmin = Math.min(
      window.visualViewport?.width ?? window.innerWidth,
      window.visualViewport?.height ?? window.innerHeight,
    );
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
    } else if (tabletLandscapeSide) {
      heroRowTop = Math.max(rowGap + portraitHeadroom, sceneTop + Math.round(8 * uiScale));
    } else {
      heroRowTop = Math.max(
        rowGap + portraitHeadroom,
        Math.min(sceneTop + rowGap, heroRowTopMax),
      );
    }
    const sceneOffsetX = sceneRect.left - layoutRect.left;

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
    if (document.getElementById("app")?.dataset.gameMode === "td") return;

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
  }

  function scheduleBattleHeroRowSync(attempts = 6) {
    let left = attempts;
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
    document.documentElement.dataset.battleArenaLayout = enabled ? "true" : "false";
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
    if (document.getElementById("app")?.dataset.gameMode === "td") return;
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
      const app = document.getElementById("app");
      if (app?.dataset.gameMode === "td") {
        setBattleArenaLayout(false);
        setBattleHeroPlacement(null);
        root.dataset.battleMobileFit = "false";
        [
          "--battle-canvas-display-w",
          "--battle-canvas-display-h",
          "--battle-field-display-w",
          "--battle-grid-gap-display",
        ].forEach((name) => root.style.removeProperty(name));
        const loadoutOpen = app?.dataset.tdLoadoutOpen === "true";
        const fieldCol = canvas.closest(".prep-field-column");
        const island = document.getElementById("prep-field-island");
        const sheetBody = document.getElementById("td-loadout-sheet-body");
        const stageW = fieldCol?.clientWidth ?? 0;
        const stageH = fieldCol?.clientHeight ?? 0;

        if (loadoutOpen && sheetBody) {
          const bodyRect = sheetBody.getBoundingClientRect();
          const fitW = bodyRect.width > 40 ? bodyRect.width : stageW;
          const fitH = bodyRect.height > 40 ? bodyRect.height : stageH;
          const scale = fitW > 0 && fitH > 0
            ? Math.min(fitW / canvas.width, fitH / canvas.height)
            : 1;
          const finalScale = Math.min(Math.max(1, scale), 2.5);
          const w = Math.max(1, Math.floor(canvas.width * finalScale));
          const h = Math.max(1, Math.floor(canvas.height * finalScale));
          root.style.setProperty("--battle-canvas-display-w", `${w}px`);
          root.style.setProperty("--battle-canvas-display-h", `${h}px`);
          setCanvasDisplaySize(canvas, w, h);
          syncFxCanvasGeometry();
          if (typeof TdArena !== "undefined" && typeof TdArena.resize === "function") {
            TdArena.resize();
          }
          return;
        }

        const islandRect = island?.getBoundingClientRect();
        const fitW = islandRect && islandRect.width > 40 ? islandRect.width : stageW;
        const fitH = islandRect && islandRect.height > 40 ? islandRect.height : stageH;
        if (fitW > 0 && fitH > 0 && canvas.width > 0 && canvas.height > 0) {
          const scale = Math.min(fitW / canvas.width, fitH / canvas.height, 1.5);
          const w = Math.max(1, Math.floor(canvas.width * scale));
          const h = Math.max(1, Math.floor(canvas.height * scale));
          root.style.setProperty("--battle-canvas-display-w", `${w}px`);
          root.style.setProperty("--battle-canvas-display-h", `${h}px`);
          setCanvasDisplaySize(canvas, w, h);
        }
        syncFxCanvasGeometry();
        if (typeof TdArena !== "undefined" && typeof TdArena.resize === "function") {
          TdArena.resize();
        }
        return;
      }
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
        const stageW = fieldCol?.clientWidth ?? stage?.clientWidth ?? canvas.width;
        if (stageW > 0) {
          const sceneTop = readCssPx("--prep-scene-top", 14);
          const columnH = fieldCol?.clientHeight > 0
            ? fieldCol.clientHeight
            : Math.max(320, (window.visualViewport?.height ?? window.innerHeight) - measurePrepChromeHeight());
          const heroH = computeTabletPrepHeroHeight(columnH, sceneTop);
          root.style.setProperty("--tablet-prep-hero-h", `${heroH}px`);
          const maxH = Math.max(120, columnH - heroH - sceneTop - 20);
          const scale = Math.min(stageW / canvas.width, maxH / canvas.height, 1);
          const w = Math.max(1, Math.floor(canvas.width * scale));
          const ch = Math.max(1, Math.floor(canvas.height * scale));
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

  function runCanvasFitPass() {
    fitCanvasDisplaySize();
    syncPrepHeroSlotHeight();
    syncTabletPortraitShopRows();
    const zones = measureLayoutZones();
    applyMeasuredZoneFit(zones);
    syncMobileShopFabPosition();
    if (document.documentElement.style.getPropertyValue("--zone-fit-shrink")) {
      requestAnimationFrame(() => {
        fitCanvasDisplaySize();
        syncTabletPortraitShopRows();
        const refitZones = measureLayoutZones();
        applyMeasuredZoneFit(refitZones);
        syncMobileShopFabPosition();
      });
    }
  }

  function scheduleCanvasFit() {
    if (canvasFitRafId) return;
    canvasFitRafId = requestAnimationFrame(() => {
      canvasFitRafId = 0;
      requestAnimationFrame(runCanvasFitPass);
    });
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
    const hudH = isModalOpen() ? 0 : measureBottomChromeHeight();
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

    const typeScale = computeTypeScale(clamped, layoutProfile);
    document.documentElement.style.setProperty("--type-scale", String(typeScale));
    document.documentElement.style.setProperty("--ui-scale", String(clamped));
    document.documentElement.style.setProperty("--viewport-h", `${Math.round(h)}px`);
    document.documentElement.style.setProperty("--viewport-w", `${Math.round(w)}px`);

    if (typeof BattleFxTier !== "undefined" && BattleFxTier.applyBattleFxTierFlags) {
      BattleFxTier.applyBattleFxTierFlags();
    }

    const classOverlayOpen = isClassOverlayOpen();
    const modalBlocksHud = isModalOpen() && !classOverlayOpen;
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

    scheduleCanvasFit();
    syncMobileShopFabPosition();
    syncPrepHeroSlotHeight();
    window.syncPrepHeroCardChrome?.();

    if (typeof window.applyGridMetricsFromCss === "function") {
      window.applyGridMetricsFromCss();
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
    if (layoutRafId) return;
    layoutRafId = requestAnimationFrame(() => {
      layoutRafId = 0;
      const { w, h } = viewportSize();
      lastViewportW = w;
      lastViewportH = h;
      applyUiLayout();
      requestAnimationFrame(runLayoutFollowUp);
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
  window.visualViewport?.addEventListener("scroll", scheduleLayoutOnViewportChange, { passive: true });
  document.addEventListener("DOMContentLoaded", () => {
    scheduleLayout();
    const stage = document.querySelector(".battle-canvas-stage");
    if (stage && typeof ResizeObserver !== "undefined") {
      new ResizeObserver(scheduleCanvasFit).observe(stage);
    }
    const prepFieldCol = document.getElementById("prep-field-column");
    if (prepFieldCol && typeof ResizeObserver !== "undefined") {
      new ResizeObserver(scheduleCanvasFit).observe(prepFieldCol);
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
  window.syncMobileShopFabPosition = syncMobileShopFabPosition;
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
})();
