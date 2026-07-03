/**
 * Prep: скамейка в отдельном popover (tablet-side / desktop side layout).
 * Включается через html[data-prep-bench-popover="true"].
 */
(function initPrepBenchPopover() {
  const OPEN_ATTR = "data-prep-bench-open";

  function usesPrepBenchPopover() {
    return document.documentElement.dataset.prepBenchPopover === "true";
  }

  function usesPrepShopDrawer() {
    const root = document.documentElement;
    return root.dataset.prepLayout === "mobile"
      || root.dataset.prepShopDrawer === "true"
      || root.dataset.uiSurface === "tablet-stacked";
  }

  function syncBenchMount() {
    const benchPanel = document.getElementById("bench-panel");
    const shopObjects = document.querySelector("#shop-panel .shop-objects");
    const popoverInner = document.querySelector("#prep-bench-popover .prep-bench-popover__panel");
    if (!benchPanel) return;

    if (usesPrepBenchPopover() && popoverInner) {
      if (benchPanel.parentElement !== popoverInner) {
        popoverInner.appendChild(benchPanel);
      }
      return;
    }

    if (shopObjects && benchPanel.parentElement !== shopObjects) {
      shopObjects.appendChild(benchPanel);
    }
  }

  function isOpen() {
    return document.documentElement.hasAttribute(OPEN_ATTR);
  }

  function setOpen(open) {
    if (!usesPrepBenchPopover()) return;
    const next = !!open;
    document.documentElement.toggleAttribute(OPEN_ATTR, next);
    const popover = document.getElementById("prep-bench-popover");
    const fab = document.getElementById("btn-prep-bench-fab");
    popover?.classList.toggle("hidden", !next);
    popover?.setAttribute("aria-hidden", next ? "false" : "true");
    fab?.setAttribute("aria-expanded", next ? "true" : "false");
    if (typeof window.syncPrepBenchFabPosition === "function") {
      requestAnimationFrame(() => window.syncPrepBenchFabPosition());
    }
    if (typeof window.positionPrepTooltipDock === "function") {
      requestAnimationFrame(() => window.positionPrepTooltipDock());
    }
  }

  function closePrepBenchPopover() {
    if (isOpen()) setOpen(false);
  }

  function togglePrepBenchPopover() {
    if (!usesPrepBenchPopover()) return;
    setOpen(!isOpen());
  }

  function openPrepBenchPopover() {
    if (!usesPrepBenchPopover()) return;
    setOpen(true);
  }

  function syncFabVisibility() {
    syncBenchMount();
    const fab = document.getElementById("btn-prep-bench-fab");
    if (!fab) return;
    const show = usesPrepBenchPopover()
      && document.getElementById("app")?.dataset.phase === "prep";
    fab.classList.toggle("hidden", !show);
    fab.hidden = !show;
    if (!show) closePrepBenchPopover();
  }

  function syncPrepBenchFabBadge() {
    const fab = document.getElementById("btn-prep-bench-fab");
    if (!fab || !usesPrepBenchPopover()) return;
    let count = 0;
    if (typeof getSideState === "function" && typeof prepViewSide !== "undefined") {
      count = (getSideState(prepViewSide).bench || []).filter(Boolean).length;
    }
    fab.classList.toggle("prep-bench-fab--has-items", count > 0);
    fab.dataset.benchCount = String(count);
    const badge = fab.querySelector(".prep-bench-fab__badge");
    if (badge) {
      badge.textContent = count > 0 ? String(count) : "";
      badge.hidden = count === 0;
    }
  }

  function bind() {
    document.getElementById("btn-prep-bench-fab")?.addEventListener("click", togglePrepBenchPopover);
    document.getElementById("btn-prep-bench-close")?.addEventListener("click", closePrepBenchPopover);
    document.getElementById("prep-bench-popover")?.addEventListener("click", (e) => {
      if (e.target?.id === "prep-bench-popover") closePrepBenchPopover();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePrepBenchPopover();
    });

    const app = document.getElementById("app");
    if (app) {
      new MutationObserver(() => {
        if (app.dataset.phase !== "prep") closePrepBenchPopover();
        syncFabVisibility();
      }).observe(app, { attributes: true, attributeFilter: ["data-phase"] });
    }

    new MutationObserver(() => {
      syncFabVisibility();
      if (!usesPrepBenchPopover()) closePrepBenchPopover();
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-prep-bench-popover", "data-prep-layout", "data-prep-shop-drawer", "data-ui-surface"],
    });

    syncFabVisibility();
  }

  window.usesPrepBenchPopover = usesPrepBenchPopover;
  window.closePrepBenchPopover = closePrepBenchPopover;
  window.togglePrepBenchPopover = togglePrepBenchPopover;
  window.openPrepBenchPopover = openPrepBenchPopover;
  window.syncPrepBenchFabBadge = syncPrepBenchFabBadge;
  window.syncBenchMount = syncBenchMount;
  window.isPrepBenchPopoverOpen = isOpen;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
