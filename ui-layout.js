/**
 * Адаптивный UI: масштаб, tier, compact-режим, высота viewport и HUD.
 */
(function initUiLayout() {
  const DESIGN_W = 1280;
  const DESIGN_H = 800;
  const SCALE_MIN = 0.62;
  const SCALE_MAX = 1;

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
    return getComputedStyle(hud).display !== "none";
  }

  function isModalOpen() {
    return ["class-overlay", "battle-result-overlay", "battle-detail-overlay", "overlay"].some((id) => {
      const el = document.getElementById(id);
      return el && !el.classList.contains("hidden");
    });
  }

  function applyUiLayout() {
    const { w, h } = viewportSize();
    const rawScale = Math.min(w / DESIGN_W, h / DESIGN_H);
    const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, rawScale));

    document.documentElement.style.setProperty("--ui-scale", String(Math.round(clamped * 1000) / 1000));
    document.documentElement.style.setProperty("--viewport-h", `${Math.round(h)}px`);
    document.documentElement.style.setProperty("--viewport-w", `${Math.round(w)}px`);

    let tier = "desktop";
    if (w <= 720 || h <= 520) tier = "phone";
    else if (w <= 1100 || h <= 920) tier = "tablet";

    document.documentElement.dataset.uiTier = tier;
    document.documentElement.dataset.orientation = w > h ? "landscape" : "portrait";

    const compact = tier !== "desktop" || h <= 940;
    document.documentElement.dataset.uiCompact = compact ? "true" : "false";

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
    ["class-overlay", "battle-result-overlay", "battle-detail-overlay", "overlay"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        new MutationObserver(scheduleLayout).observe(el, {
          attributes: true,
          attributeFilter: ["class"],
        });
      }
    });
  });

  window.applyUiLayout = applyUiLayout;
})();
