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

  function isHudVisible() {
    const hud = document.getElementById("gamepad-hints-bar");
    if (!hud || hud.classList.contains("hidden")) return false;
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

  /** Stacked только для узких/portrait экранов. Landscape iPad mini+ → side. */
  function shouldUseStackedPrep(w, h) {
    const landscape = w > h;

    if (landscape && w >= 880 && h >= 620) return false;

    if (w <= 720 || h <= 560) return true;
    if (isCoarsePointerOnly() && h <= 680) return true;
    if (!landscape && w <= 1024) return true;
    if (w <= 900 || h <= 620) return true;
    return false;
  }

  function measurePrepChromeHeight() {
    const app = document.getElementById("app");
    if (!app) return 72;
    const topBar = app.querySelector(".top-bar");
    let chrome = 0;
    if (topBar) {
      const style = getComputedStyle(topBar);
      chrome += topBar.offsetHeight + (parseFloat(style.marginBottom) || 0);
    }
    const appStyle = getComputedStyle(app);
    chrome += (parseFloat(appStyle.paddingTop) || 0) + (parseFloat(appStyle.paddingBottom) || 0);
    return chrome + 8;
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

    if (touchDev || w <= 1366) {
      document.documentElement.dataset.prepSideFit = "true";
      let fitScale = Math.min(baseScale, available / PREP_SIDE_CONTENT_H, w / DESIGN_W);
      fitScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, fitScale));
      return Math.round(fitScale * 1000) / 1000;
    }

    return baseScale;
  }

  function applyUiLayout() {
    const { w, h } = viewportSize();
    const rawScale = Math.min(w / DESIGN_W, h / DESIGN_H);
    let clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, rawScale));

    const touchDev = isTouchDevice();
    document.documentElement.dataset.touch = touchDev ? "true" : "false";
    document.documentElement.dataset.gamepadHud = touchDev ? "hidden" : "auto";

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

    const hudH = isModalOpen() || !isHudVisible() ? 0 : (document.getElementById("gamepad-hints-bar")?.offsetHeight ?? 0);
    document.documentElement.style.setProperty("--hud-offset", `${hudH}px`);
    document.documentElement.style.setProperty(
      "--app-h",
      "calc(100dvh - var(--hud-offset) - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
    );
    document.documentElement.style.setProperty(
      "--overlay-max-h",
      "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 10px)",
    );
  }

  function scheduleLayout() {
    requestAnimationFrame(applyUiLayout);
  }

  applyUiLayout();
  window.addEventListener("resize", scheduleLayout, { passive: true });
  window.addEventListener("orientationchange", scheduleLayout, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleLayout, { passive: true });
  document.addEventListener("DOMContentLoaded", () => {
    scheduleLayout();
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
        attributeFilter: ["data-phase"],
      });
    }
  });

  window.applyUiLayout = applyUiLayout;
})();
