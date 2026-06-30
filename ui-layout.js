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
    const usable = Math.max(220, columnH - sceneTop - 12);
    return Math.round(Math.min(300, Math.max(168, usable * 0.32)));
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
    const app = document.getElementById("app");
    const root = document.documentElement;
    if (app?.dataset.phase !== "prep" || root.dataset.prepLayout === "mobile") {
      root.style.removeProperty("--prep-hero-slot-height");
      return;
    }

    const fieldCol = document.getElementById("prep-field-column");
    const island = document.getElementById("prep-field-island");
    if (!fieldCol || !island) return;

    const colRect = fieldCol.getBoundingClientRect();
    const islandRect = island.getBoundingClientRect();
    if (colRect.width <= 0) return;

    const toolbar = document.getElementById("prep-toolbar");
    const toolbarTop = toolbar?.getBoundingClientRect().top ?? colRect.bottom;
    const gap = readCssPx("--prep-character-gap", 8);
    const bottomPad = readCssPx("--prep-hero-slot-bottom", 6);
    const rowTop = islandRect.bottom + gap - colRect.top;
    const rowBottom = toolbarTop - colRect.top - 8;
    const maxH = readCssPx("--prep-hero-slot-height-max", 380);
    const rowH = Math.max(108, Math.min(maxH, rowBottom - rowTop - bottomPad));
    root.style.setProperty("--prep-hero-slot-height", `${Math.round(rowH)}px`);
  }

  function syncBattleHudAnchors() {
    const viewport = document.getElementById("prep-field-column");
    const app = document.getElementById("app");
    if (!viewport || !app) return;
    const phase = app.dataset.phase;
    if (phase !== "battle" && phase !== "replay") return;

    const vpRect = viewport.getBoundingClientRect();
    const root = document.documentElement;
    const useFlankZones = root.dataset.battleHeroPlacement === "flank-arena";

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
      const anchor = shell?.querySelector(".avatar-hero-stage") || shell || slot;
      const anchorRect = anchor.getBoundingClientRect();
      const bars = hud.querySelector(".avatar-hero-bars");
      const barsH = bars?.offsetHeight || 52;

      let hudLeft = anchorRect.left - vpRect.left;
      let hudWidth = Math.max(anchorRect.width, 120);

      if (useFlankZones) {
        const zoneLeft = readCssPx(zoneLeftVar, hudLeft);
        const zoneW = readCssPx(zoneWidthVar, hudWidth);
        const panelRect = panel?.getBoundingClientRect();
        if (panelRect && panelRect.width > 8) {
          hudLeft = panelRect.left - vpRect.left;
          hudWidth = Math.max(120, Math.min(zoneW, panelRect.width));
        } else {
          hudLeft = zoneLeft;
          hudWidth = Math.max(120, zoneW - Math.round(8 * readCssPx("--ui-scale", 1)));
        }
      }

      const barsGap = Math.round(4 * readCssPx("--ui-scale", 1));
      hud.style.left = `${Math.round(hudLeft)}px`;
      hud.style.top = `${Math.max(0, Math.round(anchorRect.bottom - vpRect.top + barsGap))}px`;
      hud.style.width = `${Math.round(hudWidth)}px`;
      hud.style.maxWidth = `${Math.round(hudWidth)}px`;
    });

    if (useFlankZones) syncHeroEmotionSlotAnchors();
    syncHeroAttackSlotAnchors();
  }

  /** Зона атакующей экипировки — под HP/статами (L2, синие области макета). */
  function syncHeroAttackSlotAnchors() {
    const root = document.documentElement;
    if (root.dataset.battleHeroPlacement !== "flank-arena") return;

    const viewport = document.getElementById("prep-field-column");
    const sceneUi = document.getElementById("battle-scene-ui");
    if (!viewport || !sceneUi) return;

    const vpRect = viewport.getBoundingClientRect();
    const sceneRect = sceneUi.getBoundingClientRect();
    const uiScale = readCssPx("--ui-scale", 1);
    const gap = Math.round(6 * uiScale);
    const minH = Math.round(76 * uiScale);

    [
      { slotId: "player-attack-arena", hudId: "battle-hud-player" },
      { slotId: "enemy-attack-arena", hudId: "battle-hud-enemy" },
    ].forEach(({ slotId, hudId }) => {
      const slot = document.getElementById(slotId);
      const hud = document.getElementById(hudId);
      if (!slot || !hud) return;

      const hudRect = hud.getBoundingClientRect();
      if (hudRect.width <= 0) return;

      const left = hudRect.left - sceneRect.left;
      const top = hudRect.bottom - sceneRect.top + gap;
      const width = hudRect.width;
      const panelBottom = sceneRect.bottom - gap;
      const height = Math.max(minH, panelBottom - top);

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

    const toolbar = document.getElementById("prep-toolbar");
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
   * ~28% player | ~44% emoji arena | ~28% enemy
   */
  function computeBattleHeroRowZones(layoutWidth, _layoutRect, _canvasRect, heroColW, edgePad) {
    const innerW = Math.max(320, layoutWidth - edgePad * 2);
    const playerShare = 0.28;
    const arenaShare = 0.44;
    const enemyShare = 0.28;

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

  function applyBattleHeroRowZoneVars(root, fieldCol, zones, heroRowTop, heroZoneH) {
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
    entries.forEach(([name, value]) => {
      root.style.setProperty(name, `${Math.round(value)}px`);
      fieldCol?.style.setProperty(name, `${Math.round(value)}px`);
    });
  }

  function placeBattleHeroPanel(panel, left, top, width, height) {
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
    panel.style.maxHeight = `${Math.round(height)}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.transform = "none";
  }

  function usesTabletBattleThoughtCorners() {
    return false;
  }

  /** Эмодзи-аватар: фиксированно над портретом героя (mobile + tablet). */
  function syncHeroEmotionSlotAnchors(opts = {}) {
    const root = document.documentElement;
    if (root.dataset.battleHeroPlacement !== "flank-arena") {
      root.removeAttribute("data-tablet-thought-corners");
      return;
    }

    root.dataset.tabletThoughtCorners = "false";

    const vmin = Math.min(
      window.visualViewport?.width ?? window.innerWidth,
      window.visualViewport?.height ?? window.innerHeight,
    );
    const size = typeof BattleHeroAnchor !== "undefined"
      ? BattleHeroAnchor.thoughtSlotSize(vmin)
      : Math.round(Math.min(112, Math.max(68, vmin * 0.12)));

    [
      { slotId: "player-thought-slot", avatarSlotId: "player-avatar-slot", biasX: 0.5 },
      { slotId: "enemy-thought-slot", avatarSlotId: "enemy-avatar-slot", biasX: 0.5 },
    ].forEach(({ slotId, avatarSlotId, biasX }) => {
      const thoughtSlot = document.getElementById(slotId);
      if (!thoughtSlot) return;

      const ar = typeof BattleHeroAnchor !== "undefined"
        ? BattleHeroAnchor.getAvatarAnchorRect(
          slotId === "enemy-thought-slot" ? "enemy" : "player",
        )
        : null;
      const avatarSlot = document.getElementById(avatarSlotId);
      const fallbackAr = !ar && avatarSlot
        ? (avatarSlot.querySelector(".avatar-hero-shell") || avatarSlot).getBoundingClientRect()
        : null;
      const anchorRect = ar || fallbackAr;
      if (!anchorRect || anchorRect.width <= 4) return;

      const cx = anchorRect.left + anchorRect.width * biasX;
      const top = anchorRect.top - size * 0.42;

      thoughtSlot.style.position = "fixed";
      thoughtSlot.style.left = `${Math.round(cx - size / 2)}px`;
      thoughtSlot.style.top = `${Math.round(Math.max(4, top))}px`;
      thoughtSlot.style.width = `${size}px`;
      thoughtSlot.style.height = `${size}px`;
      thoughtSlot.style.right = "auto";
      thoughtSlot.style.bottom = "auto";
      thoughtSlot.style.zIndex = "26";
      thoughtSlot.style.overflow = "visible";
      thoughtSlot.style.pointerEvents = "none";
    });

    if (typeof ThoughtArena !== "undefined" && ThoughtArena.onResize) {
      ThoughtArena.onResize();
    }
    if (!opts.skipEquipRelayout
      && typeof ArenaEquipment !== "undefined" && ArenaEquipment.onResize) {
      ArenaEquipment.onResize();
    }
  }

  /** L2/L3 hero row: 3 зоны (player | emoji arena | enemy), Safari-safe 4-layer. */
  function syncFlankArenaHeroAnchors() {
    const fieldCol = document.getElementById("prep-field-column");
    const sceneUi = document.getElementById("battle-scene-ui");
    const objectsLayer = document.getElementById("layer-objects");
    const canvas = document.getElementById("game-canvas");
    const root = document.documentElement;
    if (!fieldCol || !canvas || !sceneUi || !objectsLayer) return;

    ensureFlankBattleSceneUiMetrics(sceneUi);

    const layoutRect = objectsLayer.getBoundingClientRect();
    const sceneRect = sceneUi.getBoundingClientRect();
    if (layoutRect.width <= 0) return;

    const canvasRect = canvas.getBoundingClientRect();
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
    const canvasBottom = Math.max(0, Math.round(canvasRect.bottom - layoutRect.top));
    const rowGap = typeof getVisualExperimentHeroRowGap === "function"
      ? getVisualExperimentHeroRowGap(uiScale)
      : Math.round(8 * uiScale);
    const heroRowTopFromCanvas = canvasBottom + rowGap;
    const heroRowTopMax = Math.max(rowGap, layoutHeight - heroZoneH - Math.round(6 * uiScale));
    const heroRowTop = Math.max(
      rowGap,
      Math.min(heroRowTopFromCanvas, heroRowTopMax),
    );
    const sceneOffsetX = sceneRect.left - layoutRect.left;

    const zones = computeBattleHeroRowZones(
      layoutRect.width,
      layoutRect,
      canvasRect,
      heroColW,
      edgePad,
    );
    applyBattleHeroRowZoneVars(root, fieldCol, zones, heroRowTop, heroZoneH);

    placeBattleHeroPanel(
      document.getElementById("player-avatar-panel"),
      zones.playerPanelLeft + sceneOffsetX,
      heroRowTop,
      zones.playerColW,
      heroZoneH,
    );
    placeBattleHeroPanel(
      document.getElementById("enemy-avatar-panel"),
      zones.enemyPanelLeft + sceneOffsetX,
      heroRowTop,
      zones.enemyColW,
      heroZoneH,
    );

    const thoughtArena = document.getElementById("battle-thought-arena");
    if (thoughtArena) {
      thoughtArena.style.position = "absolute";
      thoughtArena.style.left = `${zones.arenaLeft}px`;
      thoughtArena.style.width = `${zones.arenaW}px`;
      thoughtArena.style.top = `${heroRowTop}px`;
      thoughtArena.style.height = `${Math.round(heroZoneH)}px`;
      thoughtArena.style.maxHeight = `${Math.round(heroZoneH)}px`;
      thoughtArena.style.right = "auto";
      thoughtArena.style.bottom = "auto";
      thoughtArena.style.minHeight = `${readCssPx("--battle-thought-arena-min-h", 110)}px`;
    }

    syncHeroEmotionSlotAnchors();
    syncHeroAttackSlotAnchors();
  }

  function syncBattleSceneGridMetrics() {
    const root = document.documentElement;
    if (!isBattleUiPhase()) return;

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
      const heroZone = Math.min(320, Math.max(200, Math.round((h - measureBattleHudReserve()) * 0.3)));
      const arenaMin = Math.max(110, Math.round(h * 0.14));
      const heroImgH = Math.round(Math.min(220, Math.max(140, heroZone * 0.46)));
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
      clearFlankHeroInlineStyles();
    }
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
    const tabletSide = root.dataset.tabletSideFit === "true"
      || root.dataset.tabletPrepHero === "true";
    const portrait = stageW < vh;
    const tabletPortrait = portrait
      && !mobileLayout
      && !tabletSide
      && (root.dataset.uiTier === "tablet" || root.dataset.touch === "true");

    let heroZone;
    let arenaMin;
    let heroColW;
    let heroImgH;
    let portraitZoom;
    let chromePad;

    if (mobileLayout) {
      heroZone = Math.min(280, Math.max(200, Math.round(vh * 0.26)));
      arenaMin = Math.max(130, Math.round(vh * 0.18));
      heroColW = Math.round(Math.min(180, Math.max(108, stageW * 0.24)));
      heroImgH = Math.round(Math.min(200, Math.max(132, heroZone * 0.55)));
      portraitZoom = 2.5;
      chromePad = 10;
    } else if (tabletSide) {
      heroZone = Math.min(320, Math.max(200, Math.round((vh - hudReserve) * 0.30)));
      arenaMin = Math.max(96, Math.round(vh * 0.12));
      heroColW = Math.round(Math.min(200, Math.max(120, stageW * 0.20)));
      heroImgH = Math.round(Math.min(210, Math.max(150, heroZone * 0.50)));
      portraitZoom = 0.95;
      chromePad = 16;
      root.style.setProperty("--tablet-battle-chrome-bottom", `${Math.max(hudReserve, chromePad)}px`);
    } else if (tabletPortrait) {
      heroZone = Math.min(300, Math.max(180, Math.round((vh - hudReserve) * 0.30)));
      arenaMin = Math.max(88, Math.round(vh * 0.10));
      heroColW = Math.round(Math.min(150, Math.max(96, stageW * 0.22)));
      heroImgH = Math.round(Math.min(180, Math.max(108, heroZone * 0.44)));
      portraitZoom = 1.05;
      chromePad = 12;
      root.style.setProperty("--tablet-battle-chrome-bottom", `${Math.max(hudReserve, chromePad)}px`);
    } else {
      heroZone = Math.min(360, Math.max(220, Math.round(vh * 0.24)));
      arenaMin = Math.max(140, Math.round(vh * 0.18));
      heroColW = Math.round(Math.min(280, Math.max(200, stageW * 0.17)));
      heroImgH = Math.round(Math.min(240, Math.max(160, heroZone * 0.5)));
      portraitZoom = 1.15;
      chromePad = 20;
      root.style.setProperty("--tablet-battle-chrome-bottom", `${Math.max(hudReserve, 8)}px`);
    }

    let maxH = Math.max(100, vh - hudReserve - heroZone - arenaMin - chromePad);
    let scale = Math.min(stageW / cssW, maxH / cssH, 1);

    if (typeof applyVisualExperimentBattleLayout === "function") {
      const tweaked = applyVisualExperimentBattleLayout({
        heroZone,
        arenaMin,
        heroColW,
        heroImgH,
        portraitZoom,
        chromePad,
        scale,
        mobileLayout,
        tabletSide,
        tabletPortrait,
        stageW,
        vh,
        hudReserve,
      });
      if (tweaked) {
        heroZone = tweaked.heroZone;
        arenaMin = tweaked.arenaMin;
        heroColW = tweaked.heroColW;
        heroImgH = tweaked.heroImgH;
        portraitZoom = tweaked.portraitZoom;
        chromePad = tweaked.chromePad ?? chromePad;
        if (tweaked.scale != null) {
          scale = tweaked.scale;
          maxH = Math.max(100, vh - hudReserve - heroZone - arenaMin - chromePad);
        }
      }
    }

    const w = Math.max(1, Math.floor(cssW * scale));
    const ch = Math.max(1, Math.floor(cssH * scale));

    setBattleArenaLayout(true);
    setBattleHeroPlacement("flank-arena");

    root.style.setProperty("--battle-hero-col-w", `${heroColW}px`);
    root.style.setProperty("--battle-hero-img-h", `${heroImgH}px`);
    root.style.setProperty("--battle-thought-arena-min-h", `${arenaMin}px`);
    root.style.setProperty("--battle-hero-zone-h", `${heroZone}px`);
    root.style.setProperty("--battle-portrait-zoom", String(portraitZoom));
    root.style.setProperty("--desktop-battle-hero-zone-h", `${heroZone}px`);
    root.style.setProperty("--desktop-battle-hero-img-h", `${heroImgH}px`);
    root.style.setProperty("--desktop-battle-hero-col-w", `${heroColW}px`);
    root.style.setProperty("--desktop-battle-thought-arena-min-h", `${arenaMin}px`);
    root.style.setProperty("--battle-canvas-display-w", `${w}px`);
    root.style.setProperty("--battle-canvas-display-h", `${ch}px`);

    if (mobileLayout) {
      root.style.setProperty("--mobile-battle-portrait-h", `${heroImgH}px`);
      setMobileBattleDisplayVars(w, ch, cssW);
    }

    setCanvasDisplaySize(canvas, w, ch);
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
      BATTLE_LAYOUT_VAR_NAMES.forEach((name) => root.style.removeProperty(name));
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

  function scheduleCanvasFit() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitCanvasDisplaySize();
        syncPrepHeroSlotHeight();
      });
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
      || (prepLayout === "side" && w > h && tier === "tablet" && touchDev);
    document.documentElement.dataset.tabletSideFit = tabletSideFit ? "true" : "false";
    document.documentElement.dataset.tabletPrepHero = tabletPrepHero ? "true" : "false";
    if (!tabletSideFit && !tabletPrepHero) {
      clearTabletSideVars();
    }
    if (prepLayout !== "mobile") {
      clearMobileDisplayVars();
    }
    clamped = applyPrepLayoutFit(w, h, prepLayout, clamped, touchDev);
    if (typeof applyVisualExperimentPrepUiScale === "function") {
      clamped = applyVisualExperimentPrepUiScale(clamped, { prepLayout, tier, w, h });
    }

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
    syncPrepHeroSlotHeight();

    if (typeof window.applyGridMetricsFromCss === "function") {
      window.applyGridMetricsFromCss();
    }
    syncBattleHudAnchors();
    syncFxCanvasGeometry();
  }

  function scheduleLayout() {
    requestAnimationFrame(() => {
      applyUiLayout();
      requestAnimationFrame(() => {
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
  window.syncBattleHudAnchors = syncBattleHudAnchors;
  window.syncFxCanvasGeometry = syncFxCanvasGeometry;
  window.syncBattleHudFeedDock = syncBattleHudFeedDock;
  window.syncTabletBattleAvatarPositions = syncTabletBattleAvatarPositions;
  window.syncBattleSceneGridMetrics = syncBattleSceneGridMetrics;
  window.scheduleBattleHeroRowSync = scheduleBattleHeroRowSync;
  window.syncPrepHeroSlotHeight = syncPrepHeroSlotHeight;
  window.syncHeroEmotionSlotAnchors = syncHeroEmotionSlotAnchors;
})();
