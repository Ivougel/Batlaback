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

  /** Stacked только на телефонах (<600px). Планшеты 600–1100px — side (поле | магазин). */
  function shouldUseStackedPrep(w, h) {
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

  function clearCanvasDisplaySize() {
    const canvas = document.getElementById("game-canvas");
    if (!canvas) return;
    canvas.style.removeProperty("width");
    canvas.style.removeProperty("height");
  }

  function isSideBySidePrepLayout() {
    return document.documentElement.dataset.prepLayout === "side";
  }

  function isSideBySidePrepBand() {
    const { w } = viewportSize();
    return w >= 600 && isSideBySidePrepLayout();
  }

  function isPrepShopOverlayLayout() {
    return false;
  }

  function getPrepFieldVisibleWidthRatio(app) {
    if (!isPrepShopOverlayLayout()) return 1;

    const arena = document.getElementById("battle-arena");
    const style = arena ? getComputedStyle(arena) : null;
    const readRatio = (names) => {
      if (!style) return null;
      for (const name of names) {
        const raw = style.getPropertyValue(name).trim();
        if (!raw) continue;
        const val = parseFloat(raw);
        if (Number.isFinite(val) && val > 0) return val;
      }
      return null;
    };

    const side = app?.dataset.prepSide || "player";
    if (side === "enemy") {
      const shopRight = readRatio(["--battle-shop-right", "--battle-shop-left"]);
      return shopRight != null ? Math.max(0.12, Math.min(1, 1 - shopRight)) : 0.28;
    }
    const shopLeft = readRatio(["--battle-shop-left", "--battle-field-ratio"]);
    return shopLeft != null ? Math.max(0.12, Math.min(1, shopLeft)) : 0.31;
  }

  function fitPrepCanvasToStage() {
    const app = document.getElementById("app");
    const phase = app?.dataset.phase;
    if (phase !== "prep") {
      if ((phase === "battle" || phase === "replay") && typeof window.lockBattleCanvasDisplaySize === "function") {
        window.lockBattleCanvasDisplaySize();
      } else {
        clearCanvasDisplaySize();
      }
      return;
    }

    if (isSideBySidePrepLayout()) {
      if (document.querySelector(".prep-field-column") && typeof window.lockPrepCanvasDisplaySize === "function") {
        window.lockPrepCanvasDisplaySize();
      } else {
        clearCanvasDisplaySize();
      }
      return;
    }

    const canvas = document.getElementById("game-canvas");
    const stage = document.querySelector("#app[data-phase=\"prep\"] .prep-left-column .battle-canvas-stage")
      || document.querySelector(".battle-canvas-stage");
    if (!canvas || !stage || canvas.width <= 0 || canvas.height <= 0) return;

    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    if (sw <= 0 || sh <= 0) return;

    const visibleRatio = getPrepFieldVisibleWidthRatio(app);
    const scaleW = sw / (visibleRatio * canvas.width);
    const scaleH = sh / canvas.height;
    const scale = Math.min(scaleW, scaleH);
    if (scale <= 0) return;

    const w = Math.max(1, Math.floor(canvas.width * scale));
    const h = Math.max(1, Math.floor(canvas.height * scale));
    canvas.style.setProperty("width", `${w}px`, "important");
    canvas.style.setProperty("height", `${h}px`, "important");
  }

  function scheduleCanvasFit() {
    requestAnimationFrame(() => {
      requestAnimationFrame(fitPrepCanvasToStage);
    });
  }

  function applyPrepLayoutFit(w, h, prepLayout, baseScale, touchDev) {
    document.documentElement.dataset.prepViewportFit = "false";
    document.documentElement.dataset.prepSideFit = "false";
    document.documentElement.style.removeProperty("--prep-canvas-max-h");
    document.documentElement.style.removeProperty("--prep-shop-row-h");

    const hudH = isModalOpen() || !isHudVisible() ? 0 : (document.getElementById("gamepad-hints-bar")?.offsetHeight ?? 0);
    const chromeH = measurePrepChromeHeight() + hudH;
    const available = Math.max(400, h - chromeH);

    if (prepLayout === "stacked") {
      document.documentElement.dataset.prepViewportFit = "true";
      let fitScale = Math.min(baseScale, available / PREP_STACKED_CONTENT_H, w / DESIGN_W);
      fitScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, fitScale));
      const canvasMax = Math.round(Math.min(available * 0.34, 240 * fitScale));
      const shopRowH = Math.round(Math.max(50, Math.min(68, 64 * fitScale)));
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
    document.documentElement.dataset.gamepadHud = (touchDev && !isBattleUiPhase()) ? "hidden" : "auto";

    let tier = "desktop";
    if (w <= 720 || h <= 520) tier = "phone";
    else if (w <= 1366 || h <= 940) tier = "tablet";

    document.documentElement.dataset.uiTier = tier;
    document.documentElement.dataset.orientation = w > h ? "landscape" : "portrait";

    const compact = tier !== "desktop" || h <= 820;
    document.documentElement.dataset.uiCompact = compact ? "true" : "false";

    const prepLayout = shouldUseStackedPrep(w, h) ? "stacked" : "side";
    document.documentElement.dataset.prepLayout = prepLayout;
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

    scheduleCanvasFit();

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
  window.fitPrepCanvasToStage = fitPrepCanvasToStage;
})();
