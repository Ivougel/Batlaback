/**
 * Мобильная подготовка: магазин в bottom-sheet / popover, FAB 💰/🛒.
 */
(function initMobilePrepUi() {
  const OPEN_ATTR = "data-prep-shop-open";

  function usesPrepSellFabSideLayout() {
    const root = document.documentElement;
    return root.dataset.prepLayout === "side"
      && (root.dataset.uiSurface === "tablet-side" || root.dataset.uiSurface === "desktop");
  }

  function usesPrepShopDrawer() {
    const root = document.documentElement;
    return root.dataset.prepLayout === "mobile"
      || root.dataset.prepShopDrawer === "true"
      || root.dataset.uiSurface === "tablet-stacked"
      || usesPrepSellFabSideLayout();
  }

  function usesPrepSellFab() {
    return usesPrepShopDrawer();
  }

  function isMobilePrepLayout() {
    return document.documentElement.dataset.prepLayout === "mobile";
  }

  function isPrepPhase() {
    return document.getElementById("app")?.dataset.phase === "prep";
  }

  function setShopOpen(open) {
    if (!usesPrepShopDrawer()) return;
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
    setShopOpen(false);
  }

  function openMobilePrepShop() {
    if (!usesPrepShopDrawer() || !isPrepPhase()) return;
    setShopOpen(true);
  }

  function toggleMobilePrepShop() {
    if (!usesPrepShopDrawer() || !isPrepPhase()) return;
    setShopOpen(!document.documentElement.hasAttribute(OPEN_ATTR));
  }

  function syncPrepShopFabVisibility() {
    const shopBtn = document.getElementById("btn-mobile-shop");
    const show = usesPrepShopDrawer() && isPrepPhase();
    if (!shopBtn) return;
    shopBtn.classList.toggle("hidden", !show);
    shopBtn.hidden = !show;
    shopBtn.setAttribute("aria-hidden", show ? "false" : "true");
    if (!show) shopBtn.setAttribute("aria-expanded", "false");
  }

  function syncPrepSellFabVisibility() {
    const fab = document.getElementById("btn-prep-sell-fab");
    if (!fab) return;
    const show = usesPrepSellFab() && isPrepPhase() && !fab.classList.contains("hidden-by-campaign");
    fab.classList.toggle("hidden", !show);
    fab.hidden = !show;
    fab.setAttribute("aria-hidden", show ? "false" : "true");
    document.documentElement.toggleAttribute("data-prep-sell-fab", show);
    if (show) document.documentElement.dataset.prepSellFab = "true";
    else delete document.documentElement.dataset.prepSellFab;
    syncPrepShopFabVisibility();
    if (show && typeof window.syncPrepSellFabPosition === "function") {
      requestAnimationFrame(() => window.syncPrepSellFabPosition());
    }
    if (show && isPrepPhase() && !document.documentElement.hasAttribute(OPEN_ATTR)) {
      if (typeof scheduleCanvasFit === "function") scheduleCanvasFit();
    }
  }

  function handlePrepSellFabClick(e) {
    if (!usesPrepSellFab() || !isPrepPhase()) return;
    e.preventDefault();
    e.stopPropagation();
    openMobilePrepShop();
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

  function onPrepPhaseChange(phase) {
    if (phase === "prep") {
      closeMobilePrepShop();
      syncPrepSellFabVisibility();
      syncPrepShopFabVisibility();
      return;
    }
    closeMobilePrepShop();
    syncPrepSellFabVisibility();
    syncPrepShopFabVisibility();
  }

  function bind() {
    document.getElementById("btn-mobile-shop")?.addEventListener("click", toggleMobilePrepShop);
    document.getElementById("btn-prep-shop-close")?.addEventListener("click", closeMobilePrepShop);
    document.getElementById("btn-prep-sell-fab")?.addEventListener("click", handlePrepSellFabClick);
    document.getElementById("prep-shop-backdrop")?.addEventListener("click", (e) => {
      if (!usesPrepSellFabSideLayout()) return;
      e.preventDefault();
      closeMobilePrepShop();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMobilePrepShop();
    });

    window.addEventListener("resize", syncRotatePrompt, { passive: true });
    window.addEventListener("orientationchange", syncRotatePrompt, { passive: true });

    const app = document.getElementById("app");
    if (app) {
      new MutationObserver(() => {
        onPrepPhaseChange(app.dataset.phase);
        syncRotatePrompt();
        if (!usesPrepShopDrawer()) closeMobilePrepShop();
      }).observe(app, { attributes: true, attributeFilter: ["data-phase"] });
    }

    new MutationObserver(() => {
      syncRotatePrompt();
      syncPrepSellFabVisibility();
      if (!usesPrepShopDrawer()) closeMobilePrepShop();
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-prep-layout", "data-orientation", "data-prep-shop-drawer", "data-ui-surface", "data-game-phase"],
    });

    syncRotatePrompt();
    syncPrepSellFabVisibility();
    syncPrepShopFabVisibility();
    if (isPrepPhase()) closeMobilePrepShop();
  }

  window.closeMobilePrepShop = closeMobilePrepShop;
  window.openMobilePrepShop = openMobilePrepShop;
  window.toggleMobilePrepShop = toggleMobilePrepShop;
  window.usesPrepShopDrawer = usesPrepShopDrawer;
  window.usesPrepSellFab = usesPrepSellFab;
  window.syncPrepSellFabVisibility = syncPrepSellFabVisibility;
  window.syncPrepShopFabVisibility = syncPrepShopFabVisibility;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
