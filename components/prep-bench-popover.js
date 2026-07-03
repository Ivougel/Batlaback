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

  function isPrepPhase() {
    if (typeof window.isLivePrepSession === "function") {
      return window.isLivePrepSession();
    }
    return document.getElementById("app")?.dataset.phase === "prep";
  }

  function forceHidePrepBenchChrome() {
    document.documentElement.removeAttribute(OPEN_ATTR);
    const popover = document.getElementById("prep-bench-popover");
    const fab = document.getElementById("btn-prep-bench-fab");
    if (popover) {
      popover.classList.add("hidden");
      popover.hidden = true;
      popover.setAttribute("aria-hidden", "true");
    }
    if (fab) {
      fab.classList.add("hidden");
      fab.hidden = true;
      fab.setAttribute("aria-hidden", "true");
      fab.setAttribute("aria-expanded", "false");
      fab.classList.remove("bench-drop-target");
    }
    const benchPanel = document.getElementById("bench-panel");
    benchPanel?.classList.remove("bench-drop-target");
  }

  function setOpen(open) {
    const next = !!(open && usesPrepBenchPopover() && isPrepPhase());
    document.documentElement.toggleAttribute(OPEN_ATTR, next);
    const popover = document.getElementById("prep-bench-popover");
    const fab = document.getElementById("btn-prep-bench-fab");
    if (popover) {
      popover.classList.toggle("hidden", !next);
      popover.hidden = !next;
      popover.setAttribute("aria-hidden", next ? "false" : "true");
    }
    fab?.setAttribute("aria-expanded", next ? "true" : "false");
    if (!next) {
      forceHidePrepBenchChrome();
    }
    if (typeof window.syncPrepBenchFabPosition === "function") {
      requestAnimationFrame(() => window.syncPrepBenchFabPosition());
    }
    if (typeof window.positionPrepTooltipDock === "function") {
      requestAnimationFrame(() => window.positionPrepTooltipDock());
    }
  }

  function closePrepBenchPopover() {
    setOpen(false);
    if (!isPrepPhase()) forceHidePrepBenchChrome();
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
    const show = usesPrepBenchPopover() && isPrepPhase();
    if (!show) {
      forceHidePrepBenchChrome();
      return;
    }
    if (fab) {
      fab.classList.toggle("hidden", !show);
      fab.hidden = !show;
      fab.setAttribute("aria-hidden", show ? "false" : "true");
    }
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
    document.getElementById("btn-prep-bench-fab")?.addEventListener("click", (e) => {
      if (!isPrepPhase()) return;
      e.stopPropagation();
      togglePrepBenchPopover();
    });
    document.getElementById("btn-prep-bench-close")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closePrepBenchPopover();
    });
    document.getElementById("prep-bench-popover-backdrop")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closePrepBenchPopover();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePrepBenchPopover();
    });

    const app = document.getElementById("app");
    if (app) {
      new MutationObserver(() => {
        if (app.dataset.phase !== "prep") forceHidePrepBenchChrome();
        syncFabVisibility();
      }).observe(app, { attributes: true, attributeFilter: ["data-phase"] });
    }

    const root = document.documentElement;
    new MutationObserver(() => {
      if (root.dataset.gamePhase && root.dataset.gamePhase !== "prep") {
        forceHidePrepBenchChrome();
      }
      syncFabVisibility();
      if (!usesPrepBenchPopover()) forceHidePrepBenchChrome();
    }).observe(root, {
      attributes: true,
      attributeFilter: ["data-prep-bench-popover", "data-prep-layout", "data-prep-shop-drawer", "data-ui-surface", "data-game-phase"],
    });

    syncFabVisibility();
  }

  window.usesPrepBenchPopover = usesPrepBenchPopover;
  window.closePrepBenchPopover = closePrepBenchPopover;
  window.togglePrepBenchPopover = togglePrepBenchPopover;
  window.openPrepBenchPopover = openPrepBenchPopover;
  window.syncPrepBenchFabBadge = syncPrepBenchFabBadge;
  window.syncPrepBenchFabVisibility = syncFabVisibility;
  window.forceHidePrepBenchChrome = forceHidePrepBenchChrome;
  window.syncBenchMount = syncBenchMount;
  window.isPrepBenchPopoverOpen = isOpen;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
