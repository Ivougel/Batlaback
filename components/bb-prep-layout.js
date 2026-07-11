/**
 * BB prep stack: перенос «В бой!», хранилища и монтирование shop в battle-arena.
 */

const BBPrepLayout = (() => {
  let fightBtnHome = null;
  let refreshBtnHome = null;
  let sellZoneHome = null;
  let storageToggleBound = false;
  const inventoryMounts = {
    islandParent: null,
    islandNext: null,
    heroParent: null,
    heroNext: null,
    tooltipParent: null,
    tooltipNext: null,
  };

  function restoreInventoryRow() {
    const island = document.getElementById("prep-field-island");
    if (island && inventoryMounts.islandParent) {
      inventoryMounts.islandParent.insertBefore(island, inventoryMounts.islandNext);
    }
    const hero = document.getElementById("prep-character-layer");
    if (hero && inventoryMounts.heroParent) {
      inventoryMounts.heroParent.insertBefore(hero, inventoryMounts.heroNext);
    }
    const dock = document.getElementById("prep-tooltip-dock");
    if (dock && inventoryMounts.tooltipParent) {
      inventoryMounts.tooltipParent.insertBefore(dock, inventoryMounts.tooltipNext);
    }
    document.querySelector(".bb-prep-inventory-shell")?.remove();
    inventoryMounts.islandParent = null;
    inventoryMounts.islandNext = null;
    inventoryMounts.heroParent = null;
    inventoryMounts.heroNext = null;
    inventoryMounts.tooltipParent = null;
    inventoryMounts.tooltipNext = null;
  }

  function ensureInventoryShell(layerWorld) {
    let shell = layerWorld.querySelector(".bb-prep-inventory-shell");
    if (shell) return shell;

    shell = document.createElement("div");
    shell.className = "bb-prep-inventory-shell";

    const heroCol = document.createElement("div");
    heroCol.className = "bb-prep-inventory-hero";
    heroCol.id = "bb-prep-inventory-hero";

    const gridCol = document.createElement("div");
    gridCol.className = "bb-prep-inventory-grid";

    const tipCol = document.createElement("div");
    tipCol.className = "bb-prep-inventory-tip";
    tipCol.id = "bb-prep-inventory-tip";

    shell.append(heroCol, gridCol, tipCol);
    layerWorld.insertBefore(shell, layerWorld.firstChild);
    return shell;
  }

  function syncInventoryRow() {
    const layerWorld = document.querySelector("#prep-field-column .layer-world");
    const island = document.getElementById("prep-field-island");
    const hero = document.getElementById("prep-character-layer");
    const dock = document.getElementById("prep-tooltip-dock");

    if (!isActive()) {
      restoreInventoryRow();
      return;
    }
    if (!layerWorld || !island) return;

    const shell = ensureInventoryShell(layerWorld);
    const heroCol = shell.querySelector(".bb-prep-inventory-hero");
    const gridCol = shell.querySelector(".bb-prep-inventory-grid");
    const tipCol = shell.querySelector(".bb-prep-inventory-tip");

    if (!inventoryMounts.islandParent) {
      inventoryMounts.islandParent = island.parentElement;
      inventoryMounts.islandNext = island.nextElementSibling;
    }
    if (island.parentElement !== gridCol) gridCol.appendChild(island);

    if (hero && heroCol) {
      if (!inventoryMounts.heroParent) {
        inventoryMounts.heroParent = hero.parentElement;
        inventoryMounts.heroNext = hero.nextElementSibling;
      }
      if (hero.parentElement !== heroCol) heroCol.appendChild(hero);
      hero.removeAttribute("aria-hidden");
    }

    if (dock && tipCol && dock.parentElement === tipCol) {
      if (!inventoryMounts.tooltipParent) {
        inventoryMounts.tooltipParent = document.body;
        inventoryMounts.tooltipNext = null;
      }
      document.body.appendChild(dock);
    }

    if (typeof scheduleCanvasFit === "function") scheduleCanvasFit();
    if (typeof window.positionPrepTooltipDock === "function") {
      requestAnimationFrame(() => window.positionPrepTooltipDock());
    }
  }

  function isActive() {
    return typeof shouldUseBBStackPrepLayout === "function"
      && shouldUseBBStackPrepLayout()
      && document.getElementById("app")?.dataset.phase === "prep";
  }

  /** Tablet landscape: refresh/sell в top bar, commerce bar скрыт (золото уже в HUD). */
  function useHeaderCommerceActions() {
    const root = document.documentElement;
    if (!isActive()) return false;
    if (root.hasAttribute("data-bb-prep-phone-overlay")) return false;
    if (root.dataset.layoutProfile === "phone-portrait") return false;
    return true;
  }

  function ensureHeaderActionSlot(headerSlot, id, className) {
    let slot = headerSlot.querySelector(`#${id}`);
    if (slot) return slot;
    slot = document.createElement("div");
    slot.id = id;
    slot.className = className;
    headerSlot.appendChild(slot);
    return slot;
  }

  function syncCommerceBar() {
    const bar = document.getElementById("bb-prep-commerce-bar");
    const rerollSlot = document.getElementById("bb-prep-commerce-reroll");
    const sellMount = document.getElementById("bb-prep-commerce-sell");
    const headerSlot = document.getElementById("bb-prep-header-actions");
    const refreshBtn = document.getElementById("btn-refresh");
    const sellZone = document.getElementById("shop-sell-zone");
    if (!refreshBtn) return;

    const headerMode = useHeaderCommerceActions();

    if (!isActive()) {
      if (bar) bar.hidden = true;
      refreshBtn.classList.remove("btn-refresh-shop--bb-stack", "btn-refresh-shop--header");
      if (refreshBtnHome && refreshBtn.parentElement !== refreshBtnHome) {
        refreshBtnHome.appendChild(refreshBtn);
      }
      if (sellZone && sellZoneHome && sellZone.parentElement !== sellZoneHome) {
        sellZoneHome.appendChild(sellZone);
      }
      sellMount?.setAttribute("aria-hidden", "true");
      document.getElementById("bb-prep-header-reroll")?.remove();
      document.getElementById("bb-prep-header-sell")?.remove();
      return;
    }

    if (!refreshBtnHome) {
      refreshBtnHome = refreshBtn.parentElement;
    }
    if (sellZone && !sellZoneHome) {
      sellZoneHome = sellZone.parentElement;
    }

    if (headerMode && headerSlot) {
      if (bar) bar.hidden = true;
      headerSlot.hidden = false;
      const headerReroll = ensureHeaderActionSlot(
        headerSlot,
        "bb-prep-header-reroll",
        "bb-prep-header-actions__reroll"
      );
      const headerSell = ensureHeaderActionSlot(
        headerSlot,
        "bb-prep-header-sell",
        "bb-prep-header-actions__sell"
      );
      if (refreshBtn.parentElement !== headerReroll) {
        headerReroll.appendChild(refreshBtn);
      }
      refreshBtn.classList.add("btn-refresh-shop--bb-stack", "btn-refresh-shop--header");
      if (sellZone) {
        if (sellZone.parentElement !== headerSell) {
          headerSell.appendChild(sellZone);
        }
        headerSell.removeAttribute("aria-hidden");
      }
      sellMount?.setAttribute("aria-hidden", "true");
      return;
    }

    if (bar) bar.hidden = false;
    document.getElementById("bb-prep-header-reroll")?.remove();
    document.getElementById("bb-prep-header-sell")?.remove();
    if (rerollSlot && refreshBtn.parentElement !== rerollSlot) {
      rerollSlot.appendChild(refreshBtn);
    }
    refreshBtn.classList.add("btn-refresh-shop--bb-stack");
    refreshBtn.classList.remove("btn-refresh-shop--header");

    if (sellZone && sellMount) {
      if (sellZone.parentElement !== sellMount) {
        sellMount.appendChild(sellZone);
      }
      sellMount.removeAttribute("aria-hidden");
    }
  }

  /** Магазин и commerce — между шапкой и полем (не после всей left-column). */
  function insertBeforeAnchor(el, anchor, parent) {
    if (!el || !anchor || !parent) return;
    if (el.parentElement !== parent) {
      parent.insertBefore(el, anchor);
      return;
    }
    if (el.nextElementSibling !== anchor) {
      parent.insertBefore(el, anchor);
    }
  }

  function syncShopMount() {
    const shopPanel = document.getElementById("shop-panel");
    const commerce = document.getElementById("bb-prep-commerce-bar");
    const prepLeft = document.getElementById("prep-left-column");
    const fieldColumn = document.getElementById("prep-field-column");
    if (!shopPanel || !prepLeft || !fieldColumn || !isActive()) return;

    insertBeforeAnchor(shopPanel, fieldColumn, prepLeft);
    if (useHeaderCommerceActions()) {
      if (commerce) commerce.hidden = true;
      return;
    }
    if (commerce) insertBeforeAnchor(commerce, fieldColumn, prepLeft);
    if (commerce) insertBeforeAnchor(shopPanel, commerce, prepLeft);
  }

  function syncBenchMount() {
    const storageBody = document.getElementById("bb-prep-storage-body");
    const storage = document.getElementById("bb-prep-storage");
    if (!storageBody || !storage) return;

    if (isActive()) {
      storage.hidden = false;
      if (typeof PrepStoragePhysics !== "undefined") {
        PrepStoragePhysics.mount();
        const side = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
        PrepStoragePhysics.sync(side);
      }
      return;
    }

    if (typeof PrepStoragePhysics !== "undefined") PrepStoragePhysics.unmount();
    storage.hidden = true;
  }

  function syncFightButton() {
    const btn = document.getElementById("btn-fight");
    const headerSlot = document.getElementById("bb-prep-header-actions");
    const chromeHome = document.querySelector(".bottom-chrome-prep-right");
    if (!btn || !headerSlot || !chromeHome) return;

    if (isActive()) {
      if (!fightBtnHome) fightBtnHome = chromeHome;
      headerSlot.hidden = false;
      // Fight last: refresh/sell slots may already be in header.
      headerSlot.appendChild(btn);
      btn.classList.add("btn-fight-header--bb-stack");
      if (typeof isBBFidelityMode === "function" && isBBFidelityMode()) {
        btn.textContent = "⚔️ В бой!";
      }
      return;
    }

    headerSlot.hidden = true;
    btn.classList.remove("btn-fight-header--bb-stack");
    if (fightBtnHome && btn.parentElement !== fightBtnHome) {
      fightBtnHome.appendChild(btn);
    }
  }

  function bindStorageToggle() {
    if (storageToggleBound) return;
    const handle = document.getElementById("bb-prep-storage-handle");
    if (!handle) return;
    storageToggleBound = true;
    handle.addEventListener("click", () => {
      const root = document.documentElement;
      const collapsed = root.hasAttribute("data-bb-storage-collapsed");
      root.toggleAttribute("data-bb-storage-collapsed", !collapsed);
      handle.setAttribute("aria-expanded", collapsed ? "true" : "false");
      if (typeof PrepStoragePhysics !== "undefined") {
        PrepStoragePhysics.syncMountGeometry?.();
        const side = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
        PrepStoragePhysics.sync(side);
      }
    });
  }

  function sync() {
    bindStorageToggle();
    if (!isActive()) {
      restoreInventoryRow();
      document.getElementById("bb-prep-header-actions")?.setAttribute("hidden", "");
      document.getElementById("bb-prep-storage")?.setAttribute("hidden", "");
      document.getElementById("bb-prep-commerce-bar")?.setAttribute("hidden", "");
      syncFightButton();
      syncCommerceBar();
      syncBenchMount();
      if (typeof window.syncShopMount === "function") window.syncShopMount();
      if (typeof window.syncBenchMount === "function") window.syncBenchMount();
      return;
    }

    syncShopMount();
    syncCommerceBar();
    syncBenchMount();
    syncFightButton();
    syncInventoryRow();
    document.documentElement.removeAttribute("data-bb-storage-collapsed");
    document.getElementById("bb-prep-storage-handle")
      ?.setAttribute("aria-expanded", "true");
    if (typeof PrepStoragePhysics !== "undefined") {
      PrepStoragePhysics.syncMountGeometry?.();
      const side = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
      PrepStoragePhysics.sync(side);
    }
  }

  return { sync, isActive };
})();

function syncBBPrepLayout() {
  BBPrepLayout.sync();
}

if (typeof window !== "undefined") {
  window.BBPrepLayout = BBPrepLayout;
  window.syncBBPrepLayout = syncBBPrepLayout;
}
