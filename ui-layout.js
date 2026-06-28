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

  function isHudVisible() {
    const hud = document.getElementById("gamepad-hints-bar");
    if (!hud || hud.classList.contains("hidden")) return false;
    if (isModalOpen()) return false;
    if (isBattleUiPhase()) return true;
    if (document.documentElement.dataset.gamepadHud === "hidden") return false;
    return getComputedStyle(hud).display !== "none";
  }

  function isModalOpen() {
    return ["class-overlay", "battle-result-overlay", "battle-detail-overlay", "overlay", "settings-overlay"].some((id) => {
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

  /** Stacked — планшет landscape / узкий desktop. Портрет телефона — mobile (drawer). */
  function shouldUseMobilePrepLayout(w, h) {
    if (w > h) return false;
    if (!isTouchDevice() && !isCoarsePointerOnly()) return false;
    return w <= 768;
  }

  /** iPad landscape side-by-side: не только tier tablet (Pro/desktop site может быть шире 1366). */
  function shouldUseTabletSideFit(w, h, prepLayout, touchDev, tier) {
    if (prepLayout !== "side") return false;
    if (h >= w) return false;
    if (tier === "tablet") return true;
    if (touchDev && w >= 700 && w <= 1800 && h >= 560 && h <= 1200) return true;
    return false;
  }

  function usesTabletPrepHeroLayout(root = document.documentElement) {
    return root.dataset.tabletPrepHero === "true";
  }

  function computeTabletPrepHeroHeight(columnH, sceneTop = 14) {
    const usable = Math.max(280, columnH - sceneTop - 12);
    return Math.round(Math.min(440, Math.max(240, usable * 0.48)));
  }

  function shouldUseStackedPrep(w, h) {
    if (shouldUseMobilePrepLayout(w, h)) return false;

    if (w >= 600 && w <= 1200) return false;

    const landscape = w > h;

    if (landscape && w >= 880 && h >= 620) return false;

    if (w <= 599 || h <= 560) return true;
    if (isCoarsePointerOnly() && w < 600 && h <= 680) return true;
    if (w <= 900 || h <= 620) return true;
    return false;
  }

  function measurePrepChromeHeight() {
    const app = document.getElementById("app");
    if (!app) return 72;
    let chrome = 0;
    const bottomBar = app.querySelector("#prep-toolbar");
    if (bottomBar && getComputedStyle(bottomBar).display !== "none") {
      const bottomStyle = getComputedStyle(bottomBar);
      chrome += bottomBar.offsetHeight
        + (parseFloat(bottomStyle.marginTop) || 0)
        + (parseFloat(bottomStyle.marginBottom) || 0);
    }
    const appStyle = getComputedStyle(app);
    chrome += (parseFloat(appStyle.paddingTop) || 0) + (parseFloat(appStyle.paddingBottom) || 0);
    return chrome + 8;
  }

  function readCssPx(name, fallback = null) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const val = parseFloat(raw);
    return Number.isFinite(val) ? val : fallback;
  }

  function clearCanvasDisplaySize() {
    const canvas = document.getElementById("game-canvas");
    if (!canvas) return;
    canvas.style.removeProperty("width");
    canvas.style.removeProperty("height");
    canvas.style.removeProperty("max-width");
    canvas.style.removeProperty("max-height");
  }

  function setCanvasDisplaySize(canvas, w, h) {
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.style.maxWidth = `${w}px`;
    canvas.style.maxHeight = `${h}px`;
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
      "--mobile-battle-hero-img-h",
      "--prep-canvas-display-w",
      "--prep-canvas-display-h",
      "--prep-shop-fab-top",
      "--prep-shop-fab-right",
    ].forEach((name) => root.style.removeProperty(name));
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

  function syncMobileShopFabPosition() {
    const root = document.documentElement;
    if (root.dataset.prepLayout !== "mobile") {
      root.style.removeProperty("--prep-shop-fab-top");
      root.style.removeProperty("--prep-shop-fab-right");
      return;
    }
    const phase = document.getElementById("app")?.dataset.phase;
    if (phase !== "prep") return;
    const island = document.getElementById("prep-field-island");
    const toolbar = document.getElementById("prep-toolbar");
    if (!island || !toolbar) return;
    const rect = island.getBoundingClientRect();
    const toolbarTop = toolbar.getBoundingClientRect().top;
    const fabSize = 56;
    const zoneTop = rect.bottom + 8;
    const zoneBottom = toolbarTop - 8;
    const centeredTop = Math.round((zoneTop + zoneBottom) / 2 - fabSize / 2);
    const top = Math.max(zoneTop, Math.min(centeredTop, zoneBottom - fabSize));
    root.style.setProperty("--prep-shop-fab-top", `${top}px`);
    root.style.setProperty("--prep-shop-fab-right", "12px");
    if (typeof window.positionPrepTooltipDock === "function") {
      window.positionPrepTooltipDock();
    }
  }

  const TABLET_BATTLE_AVATAR_VAR_NAMES = [
    "--tablet-prep-hero-h",
    "--tablet-battle-hero-zone-h",
    "--tablet-battle-hero-img-h",
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
      sceneUi.style.width = canvasPx;
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
    const root = document.documentElement;
    if (root.dataset.tabletSideFit !== "true" && root.dataset.tabletPrepHero !== "true") return;
    if (!isBattleUiPhase()) return;
    const canvas = document.getElementById("game-canvas");
    let displayCanvasW = readCssPx("--battle-canvas-display-w", 0);
    if (displayCanvasW <= 0 && canvas) {
      displayCanvasW = canvas.getBoundingClientRect().width;
    }
    if (displayCanvasW <= 0) return;
    setTabletBattleFieldMetrics(root, displayCanvasW);
  }

  function syncBattleHudFeedDock() {
    const dock = document.getElementById("combat-feed-dock");
    const prepHome = document.getElementById("prep-toolbar-feed-home");
    const hudSlot = document.getElementById("battle-hud-feed-slot");
    if (!dock || !prepHome) return;

    const useHudBar = document.documentElement.dataset.tabletSideFit === "true" && isBattleUiPhase();
    document.documentElement.dataset.battleFeedHud = useHudBar ? "true" : "false";

    if (useHudBar && hudSlot) {
      hudSlot.hidden = false;
      if (dock.parentElement !== hudSlot) hudSlot.appendChild(dock);
    } else {
      if (hudSlot) hudSlot.hidden = true;
      if (dock.parentElement !== prepHome) prepHome.appendChild(dock);
    }
  }

  function measureBattleHudReserve() {
    if (!isBattleUiPhase()) return 0;
    const vv = window.visualViewport;
    const vBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight);
    let chromeTop = vBottom;

    const bar = document.getElementById("gamepad-hints-bar");
    if (bar && isHudVisible() && getComputedStyle(bar).display !== "none") {
      const rect = bar.getBoundingClientRect();
      if (rect.height > 0) chromeTop = Math.min(chromeTop, rect.top);
    }

    const toolbar = document.getElementById("prep-toolbar");
    if (toolbar && getComputedStyle(toolbar).display !== "none") {
      const rect = toolbar.getBoundingClientRect();
      if (rect.height > 0 && rect.bottom >= vBottom - 4) {
        chromeTop = Math.min(chromeTop, rect.top);
      }
    }

    return Math.ceil(Math.max(0, vBottom - chromeTop) + 10);
  }

  function syncTabletSideLayoutVars(h, phase) {
    const root = document.documentElement;
    const tabletPrep = root.dataset.tabletPrepHero === "true";
    if (root.dataset.tabletSideFit !== "true" && !tabletPrep) {
      clearTabletSideVars();
      return;
    }

    const hudReserve = isBattleUiPhase() ? measureBattleHudReserve() : 0;
    const hudH = isHudVisible() ? (document.getElementById("gamepad-hints-bar")?.offsetHeight ?? 0) : 0;
    root.style.setProperty("--tablet-battle-chrome-bottom", `${Math.max(hudReserve, hudH + 12)}px`);

    if (phase === "prep") {
      const fieldCol = document.getElementById("prep-field-column");
      const sceneTop = readCssPx("--prep-scene-top", 14);
      const columnH = fieldCol?.clientHeight > 0 ? fieldCol.clientHeight : Math.max(320, h - measurePrepChromeHeight() - hudH);
      root.style.setProperty("--tablet-prep-hero-h", `${computeTabletPrepHeroHeight(columnH, sceneTop)}px`);
      return;
    }

    if (phase === "battle" || phase === "replay") {
      const heroZone = Math.min(360, Math.max(240, Math.round((h - measureBattleHudReserve()) * 0.42)));
      const heroImgH = Math.round(Math.min(200, Math.max(128, heroZone * 0.42)));
      root.style.setProperty("--tablet-battle-hero-zone-h", `${heroZone}px`);
      root.style.setProperty("--tablet-battle-hero-img-h", `${heroImgH}px`);
    }
  }

  /** Единственный источник display-size #game-canvas (bitmap — game.js applyPhaseCanvasLayout). */
  function fitCanvasDisplaySize() {
    const app = document.getElementById("app");
    const canvas = document.getElementById("game-canvas");
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) return;

    const phase = app?.dataset.phase;
    const root = document.documentElement;

    if (phase === "battle" || phase === "replay") {
      const mobileLayout = root.dataset.prepLayout === "mobile";
      const tabletSide = root.dataset.tabletSideFit === "true";
      if (mobileLayout) {
        const stage = canvas.closest(".battle-canvas-stage");
        const fieldCol = canvas.closest(".prep-field-column");
        if (stage) {
          const stageW = fieldCol?.clientWidth ?? stage.clientWidth;
          if (stageW > 0) {
            const vh = window.visualViewport?.height ?? window.innerHeight;
            const hudH = isHudVisible() ? (document.getElementById("gamepad-hints-bar")?.offsetHeight ?? 0) : 0;
            const cssW = readCssPx("--battle-canvas-w", canvas.width);
            const cssH = readCssPx("--battle-canvas-h", canvas.height);
            const avatarZone = Math.min(300, Math.max(190, Math.round(vh * 0.34)));
            const maxH = Math.max(120, vh - hudH - avatarZone - 16);
            const scale = Math.min(stageW / cssW, maxH / cssH, 1);
            const w = Math.max(1, Math.floor(cssW * scale));
            const h = Math.max(1, Math.floor(cssH * scale));
            const heroImgH = Math.round(Math.min(168, Math.max(108, avatarZone * 0.46)));
            root.style.setProperty("--mobile-battle-hero-zone-h", `${avatarZone}px`);
            root.style.setProperty("--mobile-battle-hero-img-h", `${heroImgH}px`);
            setCanvasDisplaySize(canvas, w, h);
            setMobileBattleDisplayVars(w, h, cssW);
            syncMobileShopFabPosition();
            return;
          }
        }
      } else if (tabletSide || root.dataset.tabletPrepHero === "true") {
        const stage = canvas.closest(".battle-canvas-stage");
        const fieldCol = canvas.closest(".prep-field-column");
        if (stage) {
          const stageW = fieldCol?.clientWidth ?? stage.clientWidth;
          if (stageW > 0) {
            const vh = window.visualViewport?.height ?? window.innerHeight;
            const hudH = isHudVisible() ? (document.getElementById("gamepad-hints-bar")?.offsetHeight ?? 0) : 0;
            const cssW = readCssPx("--battle-canvas-w", canvas.width);
            const cssH = readCssPx("--battle-canvas-h", canvas.height);
            const heroZone = Math.min(360, Math.max(240, Math.round((vh - measureBattleHudReserve()) * 0.42)));
            const maxH = Math.max(120, vh - measureBattleHudReserve() - heroZone - 16);
            const scale = Math.min(stageW / cssW, maxH / cssH, 1);
            const w = Math.max(1, Math.floor(cssW * scale));
            const ch = Math.max(1, Math.floor(cssH * scale));
            const heroImgH = Math.round(Math.min(200, Math.max(128, heroZone * 0.42)));
            root.style.setProperty("--tablet-battle-hero-zone-h", `${heroZone}px`);
            root.style.setProperty("--tablet-battle-hero-img-h", `${heroImgH}px`);
            root.style.setProperty("--tablet-battle-chrome-bottom", `${measureBattleHudReserve()}px`);
            root.style.setProperty("--battle-canvas-display-w", `${w}px`);
            root.style.setProperty("--battle-canvas-display-h", `${ch}px`);
            setCanvasDisplaySize(canvas, w, ch);
            setTabletBattleFieldMetrics(root, w);
            requestAnimationFrame(() => {
              setTabletBattleFieldMetrics(root, w);
              requestAnimationFrame(() => syncTabletBattleAvatarPositions());
            });
            syncMobileShopFabPosition();
            return;
          }
        }
      } else {
        root.dataset.battleMobileFit = "false";
        [
          "--battle-canvas-display-w",
          "--battle-canvas-display-h",
          "--battle-field-display-w",
          "--battle-grid-gap-display",
        ].forEach((name) => root.style.removeProperty(name));
      }
      setCanvasDisplaySize(
        canvas,
        readCssPx("--battle-canvas-w", canvas.width),
        readCssPx("--battle-canvas-h", canvas.height),
      );
      syncMobileShopFabPosition();
      return;
    }

    if (phase !== "prep") {
      clearCanvasDisplaySize();
      syncMobileShopFabPosition();
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
      return;
    }

    if (sideFit || mobileFit || viewportFit) {
      const stage = canvas.closest(".battle-canvas-stage");
      const fieldCol = canvas.closest(".prep-field-column");
      if (!stage) return;

      const stageW = (mobileFit && fieldCol?.clientWidth) ? fieldCol.clientWidth : stage.clientWidth;
      if (stageW <= 0) return;

      let maxH = canvas.height;
      const maxW = canvas.width;
      if (sideFit || mobileFit) {
        const avail = window.visualViewport?.height ?? window.innerHeight;
        maxH = Math.max(180, avail - measurePrepChromeHeight() - (mobileFit ? 24 : 200));
      } else if (viewportFit) {
        const cssMax = getComputedStyle(root).getPropertyValue("--prep-canvas-max-h").trim();
        if (cssMax) maxH = parseFloat(cssMax) || maxH;
      }

      const scale = Math.min(stageW / canvas.width, maxW / canvas.width, maxH / canvas.height);
      if (scale <= 0) return;

      const w = Math.max(1, Math.floor(canvas.width * scale));
      const h = Math.max(1, Math.floor(canvas.height * scale));
      setCanvasDisplaySize(canvas, w, h);
      if (mobileFit) {
        root.style.setProperty("--prep-canvas-display-w", `${w}px`);
        root.style.setProperty("--prep-canvas-display-h", `${h}px`);
      } else {
        root.style.removeProperty("--prep-canvas-display-w");
        root.style.removeProperty("--prep-canvas-display-h");
      }
      syncMobileShopFabPosition();
      return;
    }

    if (hasFieldColumn) {
      setCanvasDisplaySize(
        canvas,
        readCssPx("--prep-canvas-w", canvas.width),
        readCssPx("--prep-canvas-h", canvas.height),
      );
      return;
    }

    clearCanvasDisplaySize();
  }

  function scheduleCanvasFit() {
    requestAnimationFrame(() => {
      requestAnimationFrame(fitCanvasDisplaySize);
    });
  }

  function applyPrepLayoutFit(w, h, prepLayout, baseScale, touchDev) {
    document.documentElement.dataset.prepViewportFit = "false";
    document.documentElement.dataset.prepSideFit = "false";
    document.documentElement.dataset.prepMobileFit = "false";
    document.documentElement.style.removeProperty("--prep-canvas-max-h");
    document.documentElement.style.removeProperty("--prep-shop-row-h");

    const hudH = isModalOpen() || !isHudVisible() ? 0 : (document.getElementById("gamepad-hints-bar")?.offsetHeight ?? 0);
    const chromeH = measurePrepChromeHeight() + hudH;
    const available = Math.max(400, h - chromeH);

    if (prepLayout === "mobile") {
      document.documentElement.dataset.prepMobileFit = "true";
      let fitScale = Math.min(baseScale, available / 340, w / (DESIGN_W * 0.36));
      fitScale = Math.max(0.58, Math.min(SCALE_MAX, fitScale));
      return Math.round(fitScale * 1000) / 1000;
    }

    if (prepLayout === "stacked") {
      document.documentElement.dataset.prepViewportFit = "true";
      let fitScale = Math.min(baseScale, available / PREP_STACKED_CONTENT_H, w / DESIGN_W);
      fitScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, fitScale));
      const canvasMax = Math.round(Math.min(available * 0.34, 240 * fitScale));
      const shopRowH = Math.round(Math.max(54, Math.min(74, 70 * fitScale)));
      document.documentElement.style.setProperty("--prep-canvas-max-h", `${canvasMax}px`);
      document.documentElement.style.setProperty("--prep-shop-row-h", `${shopRowH}px`);
      return Math.round(fitScale * 1000) / 1000;
    }

    if (prepLayout === "side" && w >= 600) {
      let fitScale = Math.min(baseScale, available / PREP_SIDE_CONTENT_H, w / DESIGN_W);
      fitScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, fitScale));
      return Math.round(fitScale * 1000) / 1000;
    }

    if (touchDev && w < 600) {
      document.documentElement.dataset.prepSideFit = "true";
      let fitScale = Math.min(baseScale, available / PREP_SIDE_CONTENT_H, w / DESIGN_W);
      fitScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, fitScale));
      return Math.round(fitScale * 1000) / 1000;
    }

    return baseScale;
  }

  function applyBattleHudPin(hudVisible, refreshAppH = false) {
    const bar = document.getElementById("gamepad-hints-bar");
    if (!bar || !hudVisible || !isBattleUiPhase() || isModalOpen()) {
      document.documentElement.dataset.battleHudPin = "false";
      document.documentElement.style.removeProperty("--hud-fixed-top");
      return;
    }

    const vv = window.visualViewport;
    const vTop = vv?.offsetTop ?? 0;
    const vHeight = vv?.height ?? window.innerHeight;
    const barH = bar.offsetHeight || 0;
    const top = Math.max(0, Math.round(vTop + vHeight - barH));

    document.documentElement.dataset.battleHudPin = "true";
    document.documentElement.style.setProperty("--hud-fixed-top", `${top}px`);

    if (refreshAppH && barH > 0) {
      document.documentElement.style.setProperty("--hud-offset", `${barH}px`);
      document.documentElement.style.setProperty(
        "--app-h",
        `calc(var(--viewport-h, 100dvh) - ${barH}px - env(safe-area-inset-top))`,
      );
    }
  }

  function applyUiLayout() {
    const { w, h } = viewportSize();
    const rawScale = Math.min(w / DESIGN_W, h / DESIGN_H);
    let clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, rawScale));

    const touchDev = isTouchDevice();
    document.documentElement.dataset.touch = touchDev ? "true" : "false";
    const gamepadMode = typeof isGamepadInteraction === "function" && isGamepadInteraction();
    document.documentElement.dataset.gamepadHud = (touchDev && !isBattleUiPhase() && !gamepadMode) ? "hidden" : "auto";

    let tier = "desktop";
    if (w <= 720 || h <= 520) tier = "phone";
    else if (w <= 1366 || h <= 940) tier = "tablet";

    document.documentElement.dataset.uiTier = tier;
    document.documentElement.dataset.orientation = w > h ? "landscape" : "portrait";

    const compact = tier !== "desktop" || h <= 820;
    document.documentElement.dataset.uiCompact = compact ? "true" : "false";

    const prepLayout = shouldUseMobilePrepLayout(w, h)
      ? "mobile"
      : (shouldUseStackedPrep(w, h) ? "stacked" : "side");
    document.documentElement.dataset.prepLayout = prepLayout;
    const tabletSideFit = shouldUseTabletSideFit(w, h, prepLayout, touchDev, tier);
    const tabletPrepHero = tabletSideFit
      || (prepLayout === "side" && w > h && (tier === "tablet" || touchDev));
    document.documentElement.dataset.tabletSideFit = tabletSideFit ? "true" : "false";
    document.documentElement.dataset.tabletPrepHero = tabletPrepHero ? "true" : "false";
    if (!tabletSideFit && !tabletPrepHero) {
      clearTabletSideVars();
    }
    if (prepLayout !== "mobile") {
      clearMobileDisplayVars();
    }
    clamped = applyPrepLayoutFit(w, h, prepLayout, clamped, touchDev);

    document.documentElement.style.setProperty("--ui-scale", String(clamped));
    document.documentElement.style.setProperty("--viewport-h", `${Math.round(h)}px`);
    document.documentElement.style.setProperty("--viewport-w", `${Math.round(w)}px`);

    const hudVisible = !isModalOpen() && isHudVisible();
    const hudH = hudVisible ? (document.getElementById("gamepad-hints-bar")?.offsetHeight ?? 0) : 0;
    document.documentElement.style.setProperty("--hud-offset", `${hudH}px`);
    document.documentElement.style.setProperty(
      "--app-h",
      hudVisible
        ? "calc(var(--viewport-h, 100dvh) - var(--hud-offset) - env(safe-area-inset-top))"
        : "calc(var(--viewport-h, 100dvh) - var(--hud-offset) - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
    );
    applyBattleHudPin(hudVisible);
    document.documentElement.style.setProperty(
      "--overlay-max-h",
      "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 10px)",
    );

    const appPhase = document.getElementById("app")?.dataset.phase ?? "prep";
    syncTabletSideLayoutVars(h, appPhase);

    if (typeof window.syncShopHintsVisibility === "function") {
      window.syncShopHintsVisibility();
    }

    syncBattleHudFeedDock();

    scheduleCanvasFit();
    syncMobileShopFabPosition();

    if (typeof window.applyGridMetricsFromCss === "function") {
      window.applyGridMetricsFromCss();
    }
  }

  function scheduleLayout() {
    requestAnimationFrame(() => {
      applyUiLayout();
      requestAnimationFrame(() => {
        if (document.documentElement.dataset.battleHudPin === "true") {
          applyBattleHudPin(true, true);
        }
        if (
          (document.documentElement.dataset.tabletSideFit === "true"
            || document.documentElement.dataset.tabletPrepHero === "true")
          && isBattleUiPhase()
        ) {
          const { h } = viewportSize();
          syncTabletSideLayoutVars(h, document.getElementById("app")?.dataset.phase ?? "prep");
          fitCanvasDisplaySize();
          requestAnimationFrame(syncTabletBattleAvatarPositions);
        }
      });
    });
  }

  scheduleLayout();
  window.addEventListener("resize", scheduleLayout, { passive: true });
  window.addEventListener("orientationchange", scheduleLayout, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleLayout, { passive: true });
  window.visualViewport?.addEventListener("scroll", scheduleLayout, { passive: true });
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
    const syncTabletAvatarsOnResize = () => {
      if (
        (document.documentElement.dataset.tabletSideFit === "true"
          || document.documentElement.dataset.tabletPrepHero === "true")
        && isBattleUiPhase()
      ) {
        syncTabletBattleAvatarPositions();
      }
    };
    if (typeof ResizeObserver !== "undefined") {
      if (battleSceneUi) new ResizeObserver(syncTabletAvatarsOnResize).observe(battleSceneUi);
      if (gameCanvas) new ResizeObserver(syncTabletAvatarsOnResize).observe(gameCanvas);
      if (prepFieldIsland) new ResizeObserver(syncTabletAvatarsOnResize).observe(prepFieldIsland);
    }
    const hud = document.getElementById("gamepad-hints-bar");
    if (hud) {
      new MutationObserver(scheduleLayout).observe(hud, {
        attributes: true,
        attributeFilter: ["class", "style"],
      });
    }
    ["class-overlay", "battle-result-overlay", "battle-detail-overlay", "overlay", "settings-overlay"].forEach((id) => {
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
  window.syncBattleHudFeedDock = syncBattleHudFeedDock;
  window.syncTabletBattleAvatarPositions = syncTabletBattleAvatarPositions;
})();
