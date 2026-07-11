/**
 * Prep: магазин в popover (tablet-side / desktop side layout).
 * html[data-prep-shop-popover="true"]
 */
(function initPrepShopPopover() {
  const OPEN_ATTR = "data-prep-shop-open";

  function usesPrepShopPopover() {
    return document.documentElement.dataset.prepShopPopover === "true";
  }

  function syncShopMount() {
    const shopPanel = document.getElementById("shop-panel");
    const gameLayout = document.querySelector("#app .game-layout");
    const battleArena = document.getElementById("battle-arena");
    const popoverInner = document.querySelector("#prep-shop-popover .prep-shop-popover__panel");
    if (!shopPanel) return;

    if (document.documentElement.dataset.prepLayout === "bb-stack") {
      const prepLeft = document.getElementById("prep-left-column");
      const fieldColumn = document.getElementById("prep-field-column");
      if (prepLeft && fieldColumn) {
        const insertBeforeAnchor = (el, anchor, parent) => {
          if (!el || !anchor || !parent) return;
          if (el.parentElement !== parent) {
            parent.insertBefore(el, anchor);
            return;
          }
          if (el.nextElementSibling !== anchor) {
            parent.insertBefore(el, anchor);
          }
        };
        const commerce = document.getElementById("bb-prep-commerce-bar");
        insertBeforeAnchor(shopPanel, fieldColumn, prepLeft);
        if (commerce) insertBeforeAnchor(commerce, fieldColumn, prepLeft);
        if (commerce) insertBeforeAnchor(shopPanel, commerce, prepLeft);
      } else if (battleArena && shopPanel.parentElement !== battleArena) {
        battleArena.appendChild(shopPanel);
      }
      return;
    }

    if (usesPrepShopPopover() && popoverInner) {
      if (shopPanel.parentElement !== popoverInner) {
        popoverInner.appendChild(shopPanel);
      }
      return;
    }

    if (gameLayout && shopPanel.parentElement !== gameLayout) {
      gameLayout.appendChild(shopPanel);
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

  function forceHidePrepShopChrome(opts = {}) {
    const forceDrawer = opts.forceDrawer === true;
    if (usesPrepShopPopover() || forceDrawer) {
      document.documentElement.removeAttribute(OPEN_ATTR);
      document.documentElement.removeAttribute("data-prep-drag-targets-board");
    }
    const popover = document.getElementById("prep-shop-popover");
    if (popover) {
      popover.classList.add("hidden");
      popover.hidden = true;
      popover.setAttribute("aria-hidden", "true");
    }
    document.getElementById("btn-mobile-shop")?.setAttribute("aria-expanded", "false");
    document.getElementById("btn-prep-shop-close")?.setAttribute("aria-expanded", "false");
  }

  function hidePrepShopPopoverChrome() {
    const popover = document.getElementById("prep-shop-popover");
    if (!popover) return;
    popover.classList.add("hidden");
    popover.hidden = true;
    popover.setAttribute("aria-hidden", "true");
  }

  function setOpen(open) {
    syncShopMount();
    const wasOpen = isOpen();
    const next = !!(open && usesPrepShopPopover() && isPrepPhase());
    document.documentElement.toggleAttribute(OPEN_ATTR, next);
    if (!next) document.documentElement.removeAttribute("data-prep-drag-targets-board");
    const popover = document.getElementById("prep-shop-popover");
    if (popover) {
      popover.classList.toggle("hidden", !next);
      popover.hidden = !next;
      popover.setAttribute("aria-hidden", next ? "false" : "true");
    }
    document.getElementById("btn-mobile-shop")?.setAttribute("aria-expanded", next ? "true" : "false");
    document.getElementById("btn-prep-shop-close")?.setAttribute("aria-expanded", next ? "true" : "false");
    if (!next) {
      forceHidePrepShopChrome();
    } else if (popover) {
      popover.classList.remove("hidden");
      popover.hidden = false;
      popover.setAttribute("aria-hidden", "false");
    }
    if (typeof window.syncPrepShopPopoverPosition === "function") {
      requestAnimationFrame(() => window.syncPrepShopPopoverPosition());
    }
    if (typeof window.positionPrepTooltipDock === "function") {
      requestAnimationFrame(() => window.positionPrepTooltipDock());
    }
    if (typeof scheduleCanvasFit === "function") scheduleCanvasFit();
    if (next && !wasOpen && typeof playPrepCommerceSfx === "function") {
      playPrepCommerceSfx("shop", "open");
    } else if (!next && wasOpen && typeof playPrepCommerceSfx === "function") {
      playPrepCommerceSfx("shop", "close");
    }
  }

  function closePrepShopPopover() {
    setOpen(false);
    if (!isPrepPhase()) forceHidePrepShopChrome();
  }

  function togglePrepShopPopover() {
    if (!usesPrepShopPopover() || !isPrepPhase()) return;
    setOpen(!isOpen());
  }

  function openPrepShopPopover() {
    if (!usesPrepShopPopover() || !isPrepPhase()) return;
    setOpen(true);
  }

  function syncChromeVisibility() {
    syncShopMount();
    const popover = document.getElementById("prep-shop-popover");
    const showChrome = usesPrepShopPopover() && isPrepPhase();
    if (!showChrome) {
      hidePrepShopPopoverChrome();
      if (!usesPrepShopPopover() && !isPrepPhase()) {
        forceHidePrepShopChrome({ forceDrawer: true });
      }
      return;
    }
    if (popover && !isOpen()) {
      hidePrepShopPopoverChrome();
    }
  }

  function shouldDismissPrepCommercePopover(target) {
    if (!target?.closest) return false;
    if (target.closest(
      "#prep-shop-popover .prep-shop-popover__panel, #prep-bench-popover .prep-bench-popover__panel",
    )) return false;
    if (target.closest(
      "#btn-prep-sell-fab, #btn-prep-bench-fab, #btn-mobile-shop, #btn-prep-shop-close, #btn-prep-bench-close",
    )) return false;
    if (target.closest(".shop-card, .bench-card")) return false;
    if (target.closest("#game-canvas, #prep-field-island, .prep-field-island, .canvas-scale-wrap")) return false;
    if (target.closest("#prep-tooltip-dock, #sidebar-tooltip")) return false;
    return true;
  }

  function bindPrepCommercePopoverDismiss() {
    if (document.documentElement.dataset.prepCommerceDismissBound === "true") return;
    document.documentElement.dataset.prepCommerceDismissBound = "true";
    document.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (!isPrepPhase()) return;
      if (document.body.classList.contains("is-ui-dragging")) return;
      const shopOpen = isOpen();
      const benchOpen = typeof window.isPrepBenchPopoverOpen === "function"
        && window.isPrepBenchPopoverOpen();
      if (!shopOpen && !benchOpen) return;
      if (!shouldDismissPrepCommercePopover(e.target)) return;
      if (shopOpen) closePrepShopPopover();
      if (benchOpen) window.closePrepBenchPopover?.();
    }, true);
  }

  function bind() {
    document.getElementById("btn-prep-shop-close")?.addEventListener("click", (e) => {
      if (!usesPrepShopPopover()) return;
      e.preventDefault();
      e.stopPropagation();
      closePrepShopPopover();
    });
    document.getElementById("prep-shop-popover-backdrop")?.addEventListener("click", (e) => {
      if (!usesPrepShopPopover()) return;
      if (!shouldDismissPrepCommercePopover(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      closePrepShopPopover();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !usesPrepShopPopover() || !isOpen()) return;
      closePrepShopPopover();
    });

    bindPrepCommercePopoverDismiss();

    const app = document.getElementById("app");
    if (app) {
      new MutationObserver(() => {
        if (app.dataset.phase !== "prep") forceHidePrepShopChrome({ forceDrawer: true });
        syncChromeVisibility();
      }).observe(app, { attributes: true, attributeFilter: ["data-phase"] });
    }

    const root = document.documentElement;
    new MutationObserver(() => {
      if (root.dataset.gamePhase && root.dataset.gamePhase !== "prep") {
        forceHidePrepShopChrome({ forceDrawer: true });
      }
      syncChromeVisibility();
    }).observe(root, {
      attributes: true,
      attributeFilter: ["data-prep-shop-popover", "data-prep-layout", "data-prep-shop-drawer", "data-ui-surface", "data-game-phase"],
    });

    syncChromeVisibility();
  }

  window.shouldDismissPrepCommercePopover = shouldDismissPrepCommercePopover;
  window.usesPrepShopPopover = usesPrepShopPopover;
  window.closePrepShopPopover = closePrepShopPopover;
  window.togglePrepShopPopover = togglePrepShopPopover;
  window.openPrepShopPopover = openPrepShopPopover;
  window.setPrepShopPopoverOpen = setOpen;
  window.syncShopMount = syncShopMount;
  window.isPrepShopPopoverOpen = isOpen;
  window.forceHidePrepShopChrome = forceHidePrepShopChrome;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
