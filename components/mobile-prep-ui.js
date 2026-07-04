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

  function usesPrepShopPopover() {
    return typeof window.usesPrepShopPopover === "function" && window.usesPrepShopPopover();
  }

  function usesPrepShopDrawer() {
    const root = document.documentElement;
    return root.dataset.prepLayout === "mobile"
      || root.dataset.prepShopDrawer === "true"
      || root.dataset.uiSurface === "tablet-stacked";
  }

  function usesPrepSellFab() {
    return usesPrepShopDrawer() || usesPrepSellFabSideLayout();
  }

  function isMobilePrepLayout() {
    return document.documentElement.dataset.prepLayout === "mobile";
  }

  function isPrepPhase() {
    return document.getElementById("app")?.dataset.phase === "prep";
  }

  function setShopOpen(open) {
    const wasOpen = usesPrepShopPopover()
      ? (typeof window.isPrepShopPopoverOpen === "function" && window.isPrepShopPopoverOpen())
      : document.documentElement.hasAttribute(OPEN_ATTR);
    const next = !!open;
    if (usesPrepShopPopover()) {
      if (typeof window.setPrepShopPopoverOpen === "function") {
        window.setPrepShopPopoverOpen(next && isPrepPhase());
      }
      return;
    }
    if (!usesPrepShopDrawer()) return;
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
    if (!usesPrepShopPopover() && usesPrepShopDrawer()) {
      const isNowOpen = document.documentElement.hasAttribute(OPEN_ATTR);
      if (isNowOpen && !wasOpen && typeof playPrepCommerceSfx === "function") {
        playPrepCommerceSfx("shop", "open");
      } else if (!isNowOpen && wasOpen && typeof playPrepCommerceSfx === "function") {
        playPrepCommerceSfx("shop", "close");
      }
    }
  }

  function closeMobilePrepShop() {
    setShopOpen(false);
  }

  function openMobilePrepShop() {
    if (!isPrepPhase()) return;
    if (usesPrepShopPopover()) {
      if (typeof window.openPrepShopPopover === "function") window.openPrepShopPopover();
      return;
    }
    if (usesPrepShopDrawer()) setShopOpen(true);
  }

  function toggleMobilePrepShop() {
    if (!isPrepPhase()) return;
    if (usesPrepShopPopover()) {
      if (typeof window.togglePrepShopPopover === "function") window.togglePrepShopPopover();
      return;
    }
    if (!usesPrepShopDrawer()) return;
    setShopOpen(!document.documentElement.hasAttribute(OPEN_ATTR));
  }

  function syncPrepShopFabVisibility() {
    const shopBtn = document.getElementById("btn-mobile-shop");
    if (!shopBtn) return;
    const show = usesPrepShopDrawer() && isPrepPhase() && !usesPrepSellFab();
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
    if (show && typeof window.syncPrepShopPopoverPosition === "function") {
      requestAnimationFrame(() => window.syncPrepShopPopoverPosition());
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
    document.getElementById("btn-mobile-shop")?.addEventListener("click", (e) => {
      if (!isPrepPhase()) return;
      e.stopPropagation();
      toggleMobilePrepShop();
    });
    document.getElementById("btn-prep-shop-close")?.addEventListener("click", (e) => {
      if (usesPrepShopPopover()) {
        if (typeof window.closePrepShopPopover === "function") window.closePrepShopPopover();
        return;
      }
      closeMobilePrepShop();
    });
    document.getElementById("btn-prep-sell-fab")?.addEventListener("click", handlePrepSellFabClick);
    document.getElementById("prep-shop-backdrop")?.addEventListener("click", (e) => {
      if (usesPrepShopPopover()) return;
      if (!usesPrepSellFabSideLayout()) return;
      e.preventDefault();
      closeMobilePrepShop();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (usesPrepShopPopover() && typeof window.isPrepShopPopoverOpen === "function" && window.isPrepShopPopoverOpen()) {
        closeMobilePrepShop();
      } else if (usesPrepShopDrawer()) {
        closeMobilePrepShop();
      }
    });

    window.addEventListener("resize", syncRotatePrompt, { passive: true });
    window.addEventListener("orientationchange", syncRotatePrompt, { passive: true });

    const app = document.getElementById("app");
    if (app) {
      new MutationObserver(() => {
        onPrepPhaseChange(app.dataset.phase);
        syncRotatePrompt();
        if (!usesPrepShopDrawer() && !usesPrepShopPopover()) closeMobilePrepShop();
      }).observe(app, { attributes: true, attributeFilter: ["data-phase"] });
    }

    new MutationObserver(() => {
      syncRotatePrompt();
      syncPrepSellFabVisibility();
      if (!usesPrepShopDrawer() && !usesPrepShopPopover()) closeMobilePrepShop();
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-prep-layout", "data-orientation", "data-prep-shop-drawer", "data-prep-shop-popover", "data-ui-surface", "data-game-phase"],
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
