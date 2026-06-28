/**
 * Мобильная подготовка: магазин в bottom-sheet, один экран с полем.
 */
(function initMobilePrepUi() {
  const OPEN_ATTR = "data-prep-shop-open";

  function isMobilePrepLayout() {
    return document.documentElement.dataset.prepLayout === "mobile";
  }

  function setShopOpen(open) {
    const next = !!open;
    document.documentElement.toggleAttribute(OPEN_ATTR, next);
    const toggle = document.getElementById("btn-mobile-shop");
    const closeBtn = document.getElementById("btn-prep-shop-close");
    toggle?.setAttribute("aria-expanded", next ? "true" : "false");
    closeBtn?.setAttribute("aria-expanded", next ? "true" : "false");
    const backdrop = document.getElementById("prep-shop-backdrop");
    backdrop?.classList.toggle("hidden", !next);
    backdrop?.setAttribute("aria-hidden", next ? "false" : "true");
    if (next && typeof positionPrepTooltipDock === "function") {
      requestAnimationFrame(() => positionPrepTooltipDock());
    }
    if (typeof scheduleCanvasFit === "function") scheduleCanvasFit();
  }

  function closeMobilePrepShop() {
    if (!document.documentElement.hasAttribute(OPEN_ATTR)) return;
    setShopOpen(false);
  }

  function toggleMobilePrepShop() {
    if (!isMobilePrepLayout()) return;
    setShopOpen(!document.documentElement.hasAttribute(OPEN_ATTR));
  }

  function syncRotatePrompt() {
    const prompt = document.getElementById("mobile-rotate-prompt");
    if (!prompt) return;
    const show = isMobilePrepLayout()
      && document.documentElement.dataset.orientation === "landscape";
    prompt.classList.toggle("hidden", !show);
    prompt.setAttribute("aria-hidden", show ? "false" : "true");
    if (show) closeMobilePrepShop();
  }

  function bind() {
    document.getElementById("btn-mobile-shop")?.addEventListener("click", toggleMobilePrepShop);
    document.getElementById("btn-prep-shop-close")?.addEventListener("click", closeMobilePrepShop);
    document.getElementById("prep-shop-backdrop")?.addEventListener("click", closeMobilePrepShop);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMobilePrepShop();
    });

    window.addEventListener("resize", syncRotatePrompt, { passive: true });
    window.addEventListener("orientationchange", syncRotatePrompt, { passive: true });

    const app = document.getElementById("app");
    if (app) {
      new MutationObserver(() => {
        if (app.dataset.phase !== "prep") closeMobilePrepShop();
        syncRotatePrompt();
        if (!isMobilePrepLayout()) closeMobilePrepShop();
      }).observe(app, { attributes: true, attributeFilter: ["data-phase"] });
    }

    new MutationObserver(syncRotatePrompt).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-prep-layout", "data-orientation"],
    });

    syncRotatePrompt();
  }

  window.closeMobilePrepShop = closeMobilePrepShop;
  window.toggleMobilePrepShop = toggleMobilePrepShop;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
