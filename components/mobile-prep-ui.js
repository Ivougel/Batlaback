/**
 * Мобильная подготовка: магазин в bottom-sheet, один экран с полем.
 */
(function initMobilePrepUi() {
  const OPEN_ATTR = "data-prep-shop-open";

  function usesPrepShopDrawer() {
    const root = document.documentElement;
    return root.dataset.prepLayout === "mobile"
      || root.dataset.prepShopDrawer === "true"
      || root.dataset.uiSurface === "tablet-stacked";
  }

  function isMobilePrepLayout() {
    return document.documentElement.dataset.prepLayout === "mobile";
  }

  function setShopOpen(open) {
    const next = !!open;
    document.documentElement.toggleAttribute(OPEN_ATTR, next);
    if (!next) document.documentElement.removeAttribute("data-prep-drag-targets-board");
    const toggle = document.getElementById("btn-mobile-shop");
    const closeBtn = document.getElementById("btn-prep-shop-close");
    toggle?.setAttribute("aria-expanded", next ? "true" : "false");
    closeBtn?.setAttribute("aria-expanded", next ? "true" : "false");
    const backdrop = document.getElementById("prep-shop-backdrop");
    backdrop?.classList.toggle("hidden", !next);
    backdrop?.setAttribute("aria-hidden", next ? "false" : "true");
    if (typeof positionPrepTooltipDock === "function") {
      requestAnimationFrame(() => positionPrepTooltipDock());
    }
    if (typeof syncPrepTooltipDockVisibility === "function") {
      requestAnimationFrame(() => syncPrepTooltipDockVisibility());
    }
    if (typeof window.syncMobileShopFabPosition === "function") {
      requestAnimationFrame(() => window.syncMobileShopFabPosition());
    }
    if (typeof window.syncMobileOverlayAnchors === "function") {
      requestAnimationFrame(() => window.syncMobileOverlayAnchors({ phase: "prep" }));
    }
    if (typeof window.syncTabletPortraitShopRows === "function") {
      requestAnimationFrame(() => window.syncTabletPortraitShopRows());
    }
    if (typeof scheduleCanvasFit === "function") scheduleCanvasFit();
  }

  function closeMobilePrepShop() {
    if (!document.documentElement.hasAttribute(OPEN_ATTR)) return;
    setShopOpen(false);
  }

  function toggleMobilePrepShop() {
    if (!usesPrepShopDrawer()) return;
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
    /* Backdrop is visual-only (pointer-events: none) — field stays interactive while shop is open. */

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
        if (!usesPrepShopDrawer()) closeMobilePrepShop();
      }).observe(app, { attributes: true, attributeFilter: ["data-phase"] });
    }

    new MutationObserver(() => {
      syncRotatePrompt();
      if (!usesPrepShopDrawer()) closeMobilePrepShop();
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-prep-layout", "data-orientation", "data-prep-shop-drawer", "data-ui-surface"],
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
