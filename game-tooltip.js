/**
 * Prep / battle tooltips — вынесено из game.js.
 * Состояние (tooltipItem, sidebarTooltipSource, …) остаётся в game.js.
 */

function showPrepModChipTooltipAt(clientX, clientY, chipEl, options = {}) {
  if (!chipEl || (typeof prepTooltipsEnabled !== "undefined" && !prepTooltipsEnabled)) return;
  const el = document.getElementById("sidebar-tooltip");
  if (!el) return;
  const popover = chipEl.querySelector(".prep-mod-chip-popover");
  const raw = popover?.innerHTML || "";
  const parts = raw
    .split(/<br\s*\/?>/i)
    .map((line) => line.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
  const ariaLabel = chipEl.getAttribute("aria-label") || "";
  const title = parts[0] || ariaLabel || "Модификатор";
  const lines = [{ text: title, style: "title" }];
  parts.slice(1).forEach((text) => lines.push({ text, style: "normal" }));
  if (!parts.length && ariaLabel) lines.push({ text: ariaLabel, style: "sub" });

  cancelScheduledTooltipHide();
  sidebarTooltipPinned = !!options.pinned;
  sidebarTooltipSource = "mod-chip";
  tooltipItem = null;
  fieldTooltipVisible = false;
  el.classList.remove("synergy-tooltip", "sidebar-tooltip--card");
  applySidebarTooltipCard(el, lines, { emoji: chipEl.querySelector(".prep-mod-chip-emoji")?.textContent || "✨" });
  el.classList.remove("hidden");
  syncPrepTooltipDockVisibility();
  positionSidebarTooltip(clientX, clientY, "viewport", "mod-chip");
}

function bindPrepModChipTooltips(root = null) {
  const scope = root || document;
  scope.querySelectorAll(".prep-mod-chip--icon-only").forEach((chip) => {
    if (chip.dataset.modTipBound === "1") return;
    chip.dataset.modTipBound = "1";
    const showAt = (clientX, clientY, pinned = false) => {
      showPrepModChipTooltipAt(clientX, clientY, chip, { pinned });
    };
    if (typeof bindPointerTapTooltip === "function") {
      bindPointerTapTooltip(chip, (clientX, clientY) => showAt(clientX, clientY, true));
    }
    chip.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const rect = chip.getBoundingClientRect();
      showAt(rect.left + rect.width / 2, rect.bottom, true);
    });
  });
}

function dismissClassOverlayTooltip() {
  if (sidebarTooltipSource === "companion") hideSidebarTooltip();
}

function showCompanionTooltipAt(clientX, clientY, companionId, sourceEl = null, options = {}) {
  if (shouldSuppressTooltipReshow(sourceEl)) return;
  const el = document.getElementById("sidebar-tooltip");
  if (!el || typeof buildCompanionTooltipLines !== "function") return;
  cancelScheduledTooltipHide();
  sidebarTooltipPinned = !!options.pinned;
  sidebarTooltipSource = "companion";
  tooltipItem = null;
  fieldTooltipVisible = false;
  el.classList.remove("synergy-tooltip");
  const companion = typeof getCompanionById === "function" ? getCompanionById(companionId) : null;
  applySidebarTooltipCard(
    el,
    buildCompanionTooltipLines(companionId),
    { emoji: companion?.emoji || "🐾", rarityColor: sourceEl?.classList.contains("selected") ? "#f5c842" : "#30363d" },
  );
  el.classList.remove("hidden");
  syncPrepTooltipDockVisibility();
  positionSidebarTooltip(clientX, clientY, "viewport", "companion");
}

function bindPrepCompanionTooltip(root = document) {
  root.querySelectorAll(".prep-companion-tip[data-companion-id]").forEach((btn) => {
    if (btn.dataset.companionTipBound === "1") return;
    btn.dataset.companionTipBound = "1";
    const companionId = btn.dataset.companionId;
    const showAt = (clientX, clientY, pinned = false) => {
      if (!prepTooltipsEnabled) return;
      showCompanionTooltipAt(clientX, clientY, companionId, btn, { pinned });
    };

    if (typeof bindPointerTapTooltip === "function") {
      bindPointerTapTooltip(btn, (clientX, clientY) => showAt(clientX, clientY, true));
    }
    btn.style.cursor = "pointer";
  });
}

function bindCompanionCardTooltips() {
  document.querySelectorAll("#companion-grid [data-companion]").forEach((btn) => {
    if (btn.dataset.companionTooltipBound === "1") return;
    btn.dataset.companionTooltipBound = "1";
    const companionId = btn.dataset.companion;
    const showAt = (clientX, clientY, pinned = false) => {
      showCompanionTooltipAt(clientX, clientY, companionId, btn, { pinned });
    };

    if (typeof bindPointerTapTooltip === "function") {
      bindPointerTapTooltip(btn, (clientX, clientY) => showAt(clientX, clientY, true));
    }
    btn.style.cursor = "pointer";
  });
}

function hideClassSummaryTooltip() {
  classSummaryTooltipPinned = false;
  classSummaryTooltipKind = null;
  const tip = document.getElementById("class-summary-tooltip");
  if (!tip) return;
  tip.classList.add("hidden");
  tip.setAttribute("aria-hidden", "true");
  tip.style.left = "";
  tip.style.top = "";
}

function buildClassSummaryTooltipHtml(kind) {
  if (kind === "hero" && pendingPlayerClass) {
    const cls = getClassById(pendingPlayerClass);
    if (!cls) return "";
    const title = typeof escapeClassHtml === "function"
      ? escapeClassHtml(cls.heroLabel || cls.noviceLabel || cls.name)
      : (cls.heroLabel || cls.noviceLabel || cls.name);
    const body = typeof escapeClassHtml === "function"
      ? escapeClassHtml(typeof getClassIntroBlurb === "function"
        ? getClassIntroBlurb(pendingPlayerClass)
        : (cls.desc || ""))
      : (typeof getClassIntroBlurb === "function"
        ? getClassIntroBlurb(pendingPlayerClass)
        : (cls.desc || ""));
    return `<p class="class-summary-tooltip-title">${title}</p>
      <p class="class-summary-tooltip-body">${body}</p>`;
  }
  if (kind === "companion" && pendingPlayerCompanionId) {
    const companion = COMPANION_CATALOG?.[pendingPlayerCompanionId];
    if (!companion) return "";
    const title = typeof escapeClassHtml === "function"
      ? escapeClassHtml(`${companion.emoji} ${companion.name}`)
      : `${companion.emoji} ${companion.name}`;
    const body = typeof escapeClassHtml === "function"
      ? escapeClassHtml(companion.desc || "")
      : (companion.desc || "");
    return `<p class="class-summary-tooltip-title">${title}</p>
      <p class="class-summary-tooltip-body">${body}</p>`;
  }
  return "";
}

function positionClassSummaryTooltip(anchorEl) {
  const tip = document.getElementById("class-summary-tooltip");
  if (!tip || !anchorEl) return;
  tip.classList.remove("hidden");
  tip.removeAttribute("aria-hidden");
  const rect = anchorEl.getBoundingClientRect();
  const tipW = tip.offsetWidth || 240;
  const tipH = tip.offsetHeight || 96;
  let left = rect.left + rect.width / 2 - tipW / 2;
  let top = rect.top - tipH - 12;
  if (top < 8) top = rect.bottom + 12;
  left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

function showClassSummaryTooltip(kind, anchorEl, options = {}) {
  const tip = document.getElementById("class-summary-tooltip");
  if (!tip || !anchorEl) return;
  const html = buildClassSummaryTooltipHtml(kind);
  if (!html) return;
  tip.innerHTML = html;
  classSummaryTooltipKind = kind;
  classSummaryTooltipPinned = !!options.pinned;
  positionClassSummaryTooltip(anchorEl);
}

function armPointerTapTooltip(clientX, clientY, onTap, { pointerType, allowMouse = true } = {}) {
  beginTouchTapGesture({ clientX, clientY, allowMouse, onTap });
  const fatFinger = typeof isFatFingerPointerType === "function"
    ? isFatFingerPointerType(pointerType)
    : pointerType === "touch";
  if (fatFinger || (!pointerType && isTouchUi())) {
    finishTouchTapGesture(clientX, clientY);
    return true;
  }
  return false;
}

function cancelScheduledTooltipHide() {
  if (tooltipHideTimer) {
    clearTimeout(tooltipHideTimer);
    tooltipHideTimer = null;
  }
}

function hideSidebarTooltip() {
  cancelScheduledTooltipHide();
  sidebarTooltipPinned = false;
  if (typeof hideItemHintSecondaryOverlays === "function") hideItemHintSecondaryOverlays();
  else if (typeof hideItemHintCraftOverlay === "function") hideItemHintCraftOverlay();
  if (typeof clearDomSparkleHighlights === "function") clearDomSparkleHighlights();
  const el = document.getElementById("sidebar-tooltip");
  const wasCombatFeed = sidebarTooltipSource === "combat-feed";
  if (el) {
    el.classList.add("hidden");
    el.classList.remove("combat-feed-hint-tooltip", "sidebar-tooltip--floating", "sidebar-tooltip--card");
  }
  setPrepTooltipDockPassthrough(false);
  syncPrepTooltipDockVisibility();
  fieldTooltipVisible = false;
  if (wasCombatFeed) {
    clearCombatFeedTooltipActive();
    if (typeof CombatLog?.onExternalTooltipHide === "function") {
      CombatLog.onExternalTooltipHide();
    }
  }
}

function isMobilePrepPortrait() {
  return document.documentElement.dataset.prepLayout === "mobile" && phase === "prep";
}

/** Живой prep-забег: не intro (#class-overlay), не battle/replay. */
function isLivePrepSession() {
  if (phase !== "prep") return false;
  if (!document.body.classList.contains("screen-app-visible")) return false;
  if (isPopupOpen("class-overlay")) return false;
  return document.getElementById("app")?.dataset.phase === "prep";
}

function isTabletSidePrepTooltipDock() {
  return isLivePrepSession() && document.documentElement.dataset.uiSurface === "tablet-side";
}

function isBBStackPrepTooltipDock() {
  return isLivePrepSession() && document.documentElement.dataset.prepLayout === "bb-stack";
}

function isBBStackTabletLandscapePrep(root = document.documentElement) {
  return root.dataset.prepLayout === "bb-stack"
    && root.dataset.layoutProfile === "tablet-landscape"
    && root.dataset.bbPrepPhoneOverlay !== "true";
}

function usesPrepItemTooltipDock() {
  return isMobilePrepPortrait() || isTabletSidePrepTooltipDock() || isBBStackPrepTooltipDock();
}

function getPrepHeroGridTooltipZone(margin = 10) {
  const heroLayer = document.getElementById("prep-character-layer");
  const fieldIsland = document.getElementById("prep-field-island");
  const canvas = document.getElementById("game-canvas");
  const topBar = document.getElementById("prep-top-bar");
  const bottomChrome = document.getElementById("bottom-chrome");
  const enemySide = document.getElementById("app")?.dataset.prepSide === "enemy";

  const islandRect = fieldIsland?.getBoundingClientRect();
  const canvasRect = canvas?.getBoundingClientRect();
  // Сетка внутри island выровнена вправо — при росте island (свёрнутая HUD-карточка)
  // левый край контейнера уезжает под героя; для коридора берём canvas, не island.
  const gridRect = (canvasRect && canvasRect.width >= 40)
    ? canvasRect
    : islandRect;
  const heroRect = heroLayer?.getBoundingClientRect();
  const topBarRect = topBar?.getBoundingClientRect();
  const bottomRect = bottomChrome?.getBoundingClientRect();
  const vv = window.visualViewport;
  const viewTop = vv?.offsetTop ?? 0;
  const viewBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight);

  if (!gridRect || gridRect.width < 40) return null;

  let left;
  let right;
  if (enemySide) {
    if (!heroRect || heroRect.width < 24) return null;
    left = gridRect.right + margin;
    right = heroRect.left - margin;
  } else {
    left = heroRect && heroRect.width > 24 ? heroRect.right + margin : margin;
    right = gridRect.left - margin;
  }
  if (right - left < 72) return null;

  const top = (topBarRect?.bottom ?? viewTop) + margin;
  const bottom = (bottomRect?.top ?? viewBottom) - margin;
  if (bottom <= top + 48) return null;

  return { left, right, top, bottom };
}

/** Зона портрета героя на prep (tablet-side): тултипы предметов магазина. */
function getPrepHeroPortraitTooltipZone(margin = 8) {
  const heroLayer = document.getElementById("prep-character-layer");
  const heroVisual = heroLayer?.querySelector(".prep-character-img, .prep-character-emoji, .prep-character");
  const topBar = document.getElementById("prep-top-bar");
  const bottomChrome = document.getElementById("bottom-chrome");

  const heroRect = (heroVisual?.getBoundingClientRect().width > 24)
    ? heroVisual.getBoundingClientRect()
    : heroLayer?.getBoundingClientRect();
  if (!heroRect || heroRect.width < 24) return null;

  const topBarRect = topBar?.getBoundingClientRect();
  const bottomRect = bottomChrome?.getBoundingClientRect();
  const vv = window.visualViewport;
  const viewTop = (topBarRect?.bottom ?? vv?.offsetTop ?? 0) + margin;
  const viewBottom = (bottomRect?.top ?? (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight)) - margin;

  const top = Math.max(viewTop, Math.round(heroRect.top + margin));
  const bottom = Math.min(viewBottom, Math.round(heroRect.bottom - margin));
  const left = Math.round(heroRect.left + margin);
  const right = Math.round(heroRect.right - margin);
  if (right - left < 48 || bottom - top < 48) return null;

  return { left, right, top, bottom };
}

function isTabletSideShopHeroTooltipDock() {
  return isTabletSidePrepTooltipDock() && sidebarTooltipSource === "shop";
}

function setPrepTooltipDockPassthrough(active) {
  const dock = document.getElementById("prep-tooltip-dock");
  if (!dock) return;
  dock.classList.toggle("prep-tooltip-dock--passthrough", !!active);
  if (active) dock.classList.remove("hidden");
}

function syncPrepTooltipDockVisibility() {
  const el = document.getElementById("sidebar-tooltip");
  const dock = document.getElementById("prep-tooltip-dock");
  if (!dock) return;

  if (!isLivePrepSession()) {
    dock.classList.add("hidden");
    dock.classList.remove("prep-tooltip-dock--passthrough", "prep-tooltip-dock--item", "prep-tooltip-dock--hero-grid", "prep-tooltip-dock--hero-portrait");
    return;
  }

  if (usesPrepItemTooltipDock()) {
    const hasItemTip = el && !el.classList.contains("hidden")
      && !el.classList.contains("sidebar-tooltip--floating");
    const shopHeroTip = hasItemTip && isTabletSideShopHeroTooltipDock();
    dock.classList.remove("prep-tooltip-dock--passthrough");
    dock.classList.toggle("hidden", !hasItemTip);
    dock.classList.toggle("prep-tooltip-dock--item", hasItemTip);
    dock.classList.toggle("prep-tooltip-dock--hero-portrait", shopHeroTip);
    dock.classList.toggle(
      "prep-tooltip-dock--hero-grid",
      (isTabletSidePrepTooltipDock() || isBBStackPrepTooltipDock()) && hasItemTip && !shopHeroTip,
    );
    if (hasItemTip) positionPrepTooltipDock();
    return;
  }

  dock.classList.remove("prep-tooltip-dock--item", "prep-tooltip-dock--hero-grid", "prep-tooltip-dock--hero-portrait");

  if (!el) return;

  if (el.classList.contains("sidebar-tooltip--floating")) {
    dock.classList.remove("hidden");
    dock.classList.add("prep-tooltip-dock--passthrough");
    return;
  }

  dock.classList.remove("prep-tooltip-dock--passthrough");
  dock.classList.toggle("hidden", el.classList.contains("hidden"));
}

function shouldUsePrepTooltipDock(placement) {
  if (!isLivePrepSession()) return false;
  if (sidebarTooltipSource === "mod-chip"
    || sidebarTooltipSource === "companion"
    || sidebarTooltipSource === "combat-feed") {
    return false;
  }
  const ctx = placement || sidebarTooltipSource;
  const itemCtx = ctx === "shop" || ctx === "bench" || ctx === "field" || ctx === "inventory" || ctx === "doll";
  if (!itemCtx) return false;
  return usesPrepItemTooltipDock();
}

function positionMobilePrepTooltipDock(dock) {
  const root = document.documentElement;
  const uiScale = parseFloat(getComputedStyle(root).getPropertyValue("--ui-scale")) || 1;
  const margin = Math.round(8 * uiScale);
  const vv = window.visualViewport;
  const viewLeft = vv?.offsetLeft ?? 0;
  const viewWidth = vv?.width ?? window.innerWidth;

  const readZonePx = (name, fallback = 0) => {
    const inline = parseFloat(root.style.getPropertyValue(name));
    if (Number.isFinite(inline) && inline > 0) return inline;
    const computed = parseFloat(getComputedStyle(root).getPropertyValue(name));
    if (Number.isFinite(computed) && computed > 0) return computed;
    return fallback;
  };

  if (typeof window.syncPrepMobileZoneAnchors === "function") {
    window.syncPrepMobileZoneAnchors({ phase: "prep" });
  }

  const toolbarTop = readZonePx(
    "--prep-toolbar-zone-top",
    document.getElementById("bottom-chrome")?.getBoundingClientRect().top ?? window.innerHeight,
  );
  let zoneBottom = toolbarTop - margin;

  const shopPanel = document.getElementById("shop-panel");
  const shopOpen = root.hasAttribute("data-prep-shop-open");
  if (shopOpen && shopPanel) {
    const shopRect = shopPanel.getBoundingClientRect();
    if (shopRect.top < zoneBottom) zoneBottom = shopRect.top - margin;
  }

  const heroTop = readZonePx("--prep-hero-zone-top", 0);
  const heroBottom = readZonePx("--prep-hero-zone-bottom", 0);
  const canvasBottom = readZonePx(
    "--prep-canvas-zone-bottom",
    document.getElementById("prep-field-island")?.getBoundingClientRect().bottom ?? margin,
  );

  let zoneTop;
  if (heroBottom > heroTop + 48) {
    zoneTop = heroTop + margin;
    zoneBottom = Math.min(zoneBottom, heroBottom - margin);
  } else {
    zoneTop = canvasBottom + margin;
  }

  if (zoneBottom <= zoneTop + 40) {
    zoneTop = canvasBottom + margin;
    zoneBottom = toolbarTop - margin;
    if (shopOpen && shopPanel) {
      const shopRect = shopPanel.getBoundingClientRect();
      if (shopRect.top < zoneBottom) zoneBottom = shopRect.top - margin;
    }
  }

  const availableH = Math.max(48, zoneBottom - zoneTop);
  const zoneHeroH = parseFloat(getComputedStyle(root).getPropertyValue("--zone-hero-h")) || availableH;
  const maxHeight = Math.min(220, Math.round(Math.min(zoneHeroH * 0.9, availableH)));
  const top = Math.max(margin, zoneTop);

  dock.style.left = `${viewLeft + margin}px`;
  dock.style.width = `${Math.max(120, viewWidth - margin * 2)}px`;
  dock.style.top = `${top}px`;
  dock.style.maxHeight = `${maxHeight}px`;
  dock.style.height = "auto";
}

function positionTabletSidePrepTooltipDock(dock) {
  const root = document.documentElement;
  const uiScale = parseFloat(getComputedStyle(root).getPropertyValue("--ui-scale")) || 1;
  const margin = Math.round(6 * uiScale);

  if (isTabletSideShopHeroTooltipDock()) {
    const heroZone = getPrepHeroPortraitTooltipZone(margin);
    if (heroZone) {
      const zoneW = heroZone.right - heroZone.left;
      const zoneH = heroZone.bottom - heroZone.top;
      dock.style.left = `${heroZone.left}px`;
      dock.style.top = `${heroZone.top}px`;
      dock.style.width = `${zoneW}px`;
      dock.style.maxHeight = `${zoneH}px`;
      dock.style.height = `${zoneH}px`;
      return;
    }
  }

  const zone = getPrepHeroGridTooltipZone(margin);

  if (!zone) {
    const heroRect = document.getElementById("prep-character-layer")?.getBoundingClientRect();
    const topBarRect = document.getElementById("prep-top-bar")?.getBoundingClientRect();
    const bottomRect = document.getElementById("bottom-chrome")?.getBoundingClientRect();
    const dockW = Math.round(248 * uiScale);
    const dockH = Math.round(220 * uiScale);
    const vv = window.visualViewport;
    const viewTop = (vv?.offsetTop ?? 0) + margin;
    const viewBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - margin;

    let left = margin;
    let top = (topBarRect?.bottom ?? viewTop) + margin;
    if (heroRect && heroRect.width > 24) {
      left = heroRect.right + margin;
      top = Math.max(top, heroRect.top + margin);
    }
    left = Math.min(left, Math.max(margin, (vv?.offsetLeft ?? 0) + (vv?.width ?? window.innerWidth) - dockW - margin));
    top = Math.max(viewTop, Math.min(top, (bottomRect?.top ?? viewBottom) - dockH - margin));

    dock.style.left = `${left}px`;
    dock.style.top = `${top}px`;
    dock.style.width = `${dockW}px`;
    dock.style.maxHeight = `${dockH}px`;
    dock.style.height = "auto";
    return;
  }

  const zoneW = zone.right - zone.left;
  const zoneH = zone.bottom - zone.top;

  dock.style.left = `${zone.left}px`;
  dock.style.top = `${zone.top}px`;
  dock.style.width = `${zoneW}px`;
  dock.style.maxHeight = `${zoneH}px`;
  dock.style.height = `${zoneH}px`;
}

function positionBBStackPrepTooltipDock(dock) {
  const root = document.documentElement;
  const uiScale = parseFloat(getComputedStyle(root).getPropertyValue("--ui-scale")) || 1;
  const margin = Math.round(6 * uiScale);
  const tipCol = document.getElementById("bb-prep-inventory-tip");
  const shell = document.querySelector(".bb-prep-inventory-shell");
  const fieldCol = document.getElementById("prep-field-column");
  const topBar = document.getElementById("prep-top-bar");
  const bottomChrome = document.getElementById("bottom-chrome");
  const storage = document.querySelector(".bb-prep-storage");
  const commerce = document.querySelector(".bb-prep-commerce-bar");
  const vv = window.visualViewport;
  const viewLeft = vv?.offsetLeft ?? 0;
  const viewTop = vv?.offsetTop ?? 0;
  const viewW = vv?.width ?? window.innerWidth;
  const viewH = vv?.height ?? window.innerHeight;
  const viewRight = viewLeft + viewW;
  const chromeRect = bottomChrome?.getBoundingClientRect();
  const chromeVisible = !!(bottomChrome
    && getComputedStyle(bottomChrome).display !== "none"
    && (chromeRect?.height ?? 0) > 8);
  const viewBottom = (chromeVisible ? chromeRect.top : viewTop + viewH) - margin;
  const topLimit = (topBar?.getBoundingClientRect().bottom ?? viewTop) + margin;
  const phonePortrait = root.dataset.layoutProfile === "phone-portrait"
    || root.dataset.bbPrepPhoneOverlay === "true";
  const tabletLandscape = isBBStackTabletLandscapePrep(root);

  let left;
  let width;
  let top = topLimit;
  let maxHeight;

  const tipRect = tipCol?.getBoundingClientRect();
  const shellRect = shell?.getBoundingClientRect();
  const fieldRect = fieldCol?.getBoundingClientRect();
  const gridRect = shell?.querySelector(".bb-prep-inventory-grid")?.getBoundingClientRect();
  const tipCollapsed = !(tipRect && tipRect.width >= 48 && tipRect.height >= 24);

  // Phone / collapsed tip / tablet landscape: держим dock внутри поля (на планшете — в колонке сетки).
  if (tipCollapsed || phonePortrait || tabletLandscape) {
    let bounds = (fieldRect && fieldRect.height >= 80) ? fieldRect : shellRect;
    if (tabletLandscape && gridRect && gridRect.width >= 120 && gridRect.height >= 80) {
      bounds = gridRect;
    }
    if (bounds && bounds.width >= 120) {
      const commerceBottom = commerce?.getBoundingClientRect().bottom ?? 0;
      const storageTop = storage?.getBoundingClientRect().top;
      const bandTop = Math.max(topLimit, bounds.top + margin, commerceBottom + margin);
      const bandBottom = Math.min(
        viewBottom,
        Number.isFinite(storageTop) ? storageTop - margin : viewBottom,
        bounds.bottom - margin,
      );
      if (tabletLandscape) {
        // Карточка + левый flyout-оверлей: dock шире карточки, без scroll.
        const cardW = Math.round(210 * uiScale);
        const flyoutReserve = Math.round(212 * uiScale);
        width = Math.min(bounds.width - margin * 2, cardW + flyoutReserve);
        // Карточка справа в dock (flyout слева) — центрируем footprint по сетке.
        left = bounds.left + (bounds.width - width) / 2;
        const bandH = Math.max(160, bandBottom - bandTop);
        maxHeight = Math.max(180, Math.min(bandH, Math.round(viewH * 0.72)));
        top = bandTop + Math.max(0, Math.round((bandH - maxHeight) * 0.18));
        if (top + maxHeight > bandBottom) {
          top = Math.max(bandTop, bandBottom - maxHeight);
        }
      } else {
        width = Math.max(168, Math.min(bounds.width - margin * 2, viewW * 0.92));
        left = bounds.left + (bounds.width - width) / 2;
        const bandH = Math.max(140, bandBottom - bandTop);
        maxHeight = Math.max(160, Math.min(bandH, Math.round(viewH * 0.58)));
        // Чуть ниже центра поля — карточка и flyout остаются в зоне видимости.
        top = bandTop + Math.max(0, Math.round((bandH - maxHeight) * 0.28));
        if (top + maxHeight > bandBottom) {
          top = Math.max(bandTop, bandBottom - maxHeight);
        }
      }
    } else {
      width = Math.max(140, Math.min(viewW * 0.88, tabletLandscape ? Math.round(422 * uiScale) : 320));
      left = viewLeft + (viewW - width) / 2;
      top = topLimit + Math.round(viewH * 0.22);
      maxHeight = Math.max(160, Math.min(viewBottom - top, Math.round(viewH * 0.5)));
    }
  } else {
    left = tipRect.left + margin;
    width = tipRect.width - margin * 2;
    top = Math.max(topLimit, tipRect.top + margin);
  }

  width = Math.max(120, Math.min(width, viewW - margin * 2));
  left = Math.max(viewLeft + margin, Math.min(left, viewRight - width - margin));
  if (!(Number.isFinite(maxHeight) && maxHeight > 0)) {
    maxHeight = Math.max(160, Math.min(viewBottom - top, Math.round(viewH * 0.72)));
  }
  maxHeight = Math.max(140, Math.min(maxHeight, viewBottom - top));

  const leftPct = ((left - viewLeft) / viewW) * 100;
  const widthPct = (width / viewW) * 100;
  const topPct = ((top - viewTop) / viewH) * 100;

  root.style.setProperty("--bb-prep-tooltip-left", `${leftPct.toFixed(3)}%`);
  root.style.setProperty("--bb-prep-tooltip-width", `${widthPct.toFixed(3)}%`);
  root.style.setProperty("--bb-prep-tooltip-top", `${topPct.toFixed(3)}%`);
  root.style.setProperty("--bb-prep-tooltip-max-h", `${Math.round(maxHeight)}px`);

  dock.style.setProperty("position", "fixed", "important");
  dock.style.setProperty("left", `${Math.round(left)}px`, "important");
  dock.style.setProperty("top", `${Math.round(top)}px`, "important");
  dock.style.setProperty("width", `${Math.round(width)}px`, "important");
  dock.style.setProperty("max-height", `${Math.round(maxHeight)}px`, "important");
  dock.style.setProperty("height", "auto", "important");
  dock.style.setProperty("right", "auto", "important");
  dock.style.setProperty("bottom", "auto", "important");
  dock.style.setProperty("z-index", "var(--z-prep-tooltip, 9700)", "important");
}

function positionPrepTooltipDock() {
  const dock = document.getElementById("prep-tooltip-dock");
  if (!dock) return;

  if (isMobilePrepPortrait()) {
    positionMobilePrepTooltipDock(dock);
    return;
  }

  if (isTabletSidePrepTooltipDock()) {
    positionTabletSidePrepTooltipDock(dock);
    return;
  }

  if (isBBStackPrepTooltipDock()) {
    positionBBStackPrepTooltipDock(dock);
    return;
  }

  dock.style.height = "";
  const margin = 10;
  const corridor = getTooltipCorridorBounds(margin, 8);
  const vv = window.visualViewport;
  const viewLeft = vv?.offsetLeft ?? 0;
  const viewTop = vv?.offsetTop ?? 0;
  const viewWidth = vv?.width ?? window.innerWidth;
  const viewHeight = vv?.height ?? window.innerHeight;

  let left;
  let width;
  let top;
  let maxHeight;

  if (corridor) {
    width = Math.min(360, Math.max(240, corridor.right - corridor.left - margin * 2));
    left = corridor.left + (corridor.right - corridor.left - width) / 2;
  } else {
    width = Math.min(340, Math.max(240, viewWidth * 0.42));
    left = viewLeft + (viewWidth - width) / 2;
  }

  const toolbar = document.getElementById("bottom-chrome");
  const combatFeedBtn = document.getElementById("btn-combat-feed");
  const feedPanel = document.getElementById("combat-feed-panel");
  const toolbarRect = toolbar?.getBoundingClientRect();
  const feedBtnRect = combatFeedBtn?.getBoundingClientRect();
  const feedOpen = feedPanel?.classList.contains("combat-feed-panel--open");

  let bottomLimit = (toolbarRect?.top ?? viewTop + viewHeight) - margin;
  if (feedOpen && feedPanel) {
    const feedRect = feedPanel.getBoundingClientRect();
    bottomLimit = Math.min(bottomLimit, feedRect.top - margin);
  } else if (feedBtnRect) {
    bottomLimit = Math.min(bottomLimit, feedBtnRect.top - margin);
  }

  const topLimit = (corridor?.top ?? viewTop) + margin;
  maxHeight = Math.min(360, Math.max(160, bottomLimit - topLimit - margin));
  top = Math.max(topLimit, bottomLimit - maxHeight);

  dock.style.left = `${left}px`;
  dock.style.top = `${top}px`;
  dock.style.width = `${width}px`;
  dock.style.maxHeight = `${maxHeight}px`;
}

function scheduleHideSidebarTooltip() {
  /* Sticky tooltips: dismiss only via bindGlobalTooltipDismiss. */
}

function requestHideSidebarTooltip() {
  /* Sticky tooltips: dismiss only via bindGlobalTooltipDismiss. */
}

function isSidebarTooltipVisible() {
  const tooltip = document.getElementById("sidebar-tooltip");
  return !!tooltip && !tooltip.classList.contains("hidden");
}

function shouldSuppressTooltipReshow(sourceEl) {
  if (!tooltipDismissGesture) return false;
  const sameSource = sourceEl && tooltipDismissGesture.sourceEl && sourceEl === tooltipDismissGesture.sourceEl;
  tooltipDismissGesture = null;
  return sameSource;
}

function dismissSidebarTooltipFromPointer(e) {
  if (!isSidebarTooltipVisible()) return false;
  tooltipDismissGesture = {
    pointerId: e?.pointerId ?? null,
    sourceEl: e?.target?.closest?.(".shop-card, .bench-card, .prep-storage-body, .doll-slot, .profile-avatar, .combat-feed-msg-text--hinted, .profile-status-chip, .profile-stack-chip, .prep-companion-tip, .enh-slot") || null,
  };
  hideSidebarTooltip();
  tooltipItem = null;
  if (typeof syncFieldTooltip === "function") syncFieldTooltip();
  return true;
}

/** Клик/tap внутри карточки подсказки или её inline-попапов — не закрывать тултип. */
function isPointerInsideSidebarTooltipSurface(target) {
  if (!target?.closest) return false;
  const tip = document.getElementById("sidebar-tooltip");
  if (!tip || tip.classList.contains("hidden")) return false;
  if (target.closest("#sidebar-tooltip")) return true;
  return !!target.closest(".item-info-popup--in-card:not(.hidden), .item-craft-popup--in-card:not(.hidden)");
}

function bindGlobalTooltipDismiss() {
  if (document.documentElement.dataset.globalTooltipDismissBound) return;
  document.documentElement.dataset.globalTooltipDismissBound = "1";
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Только синтетический mouse после touch — не блокировать реальные touch/pen pointerdown.
    if (e.pointerType === "mouse" && isSyntheticMouseFromTouch()) return;
    if (!isSidebarTooltipVisible()) return;
    if (!e.target.closest(".item-hint-card__tag-icon") && typeof hideItemHintTagCaptions === "function") {
      hideItemHintTagCaptions();
    }
    if (e.target.closest(".item-hint-card__edge-btn, .item-hint-card__icon-btn, .item-hint-card__tag-icon, .item-info-popup--in-card, .item-craft-popup--in-card")) return;
    if (typeof hideItemHintSecondaryOverlays === "function" && hideItemHintSecondaryOverlays()) return;
    if (typeof hideItemHintCraftOverlay === "function" && hideItemHintCraftOverlay()) return;
    if (isPointerInsideSidebarTooltipSurface(e.target)) return;
    dismissSidebarTooltipFromPointer(e);
  }, true);
  document.addEventListener("pointerup", () => {
    window.setTimeout(() => {
      tooltipDismissGesture = null;
    }, 0);
  }, true);
  document.addEventListener("pointercancel", () => {
    tooltipDismissGesture = null;
  }, true);
}

function bindTouchTooltipDismiss() {
  bindGlobalTooltipDismiss();
}

function bindPrepHeroTooltip() {
  const trigger = document.getElementById("btn-prep-hero-info");
  const tooltip = document.getElementById("prep-hero-tooltip");
  if (!trigger || !tooltip) return;

  const open = () => {
    refreshPrepHeroTooltip();
    tooltip.classList.remove("hidden");
    trigger.setAttribute("aria-expanded", "true");
  };

  const toggle = (e) => {
    e?.stopPropagation?.();
    if (tooltip.classList.contains("hidden")) open();
    else closePrepHeroTooltip();
  };

  trigger.addEventListener("click", toggle);
  trigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(e);
    }
    if (e.key === "Escape") closePrepHeroTooltip();
  });

  document.addEventListener("click", (e) => {
    if (tooltip.classList.contains("hidden")) return;
    if (e.target.closest("#btn-prep-hero-info") || e.target.closest("#prep-hero-tooltip")) return;
    closePrepHeroTooltip();
  });
}

function refreshPrepHeroTooltip() {
  const titleEl = document.getElementById("prep-hero-tooltip-title");
  const descEl = document.getElementById("prep-hero-tooltip-desc");
  const classId = prepViewSide === "player" ? playerClass : enemyClass;
  const side = prepViewSide === "player" ? "player" : "enemy";
  const rt = getSideMutationRuntime(side);
  const companion = typeof getCompanionById === "function" ? getCompanionById(rt.companionId) : null;
  if (titleEl) titleEl.textContent = getRunDisplayTitle(side);
  if (descEl) {
    const cls = getClassById(classId);
    let desc = cls?.desc || "Описание класса недоступно.";
    if (companion) desc += ` · Спутник: ${companion.emoji} ${companion.name}`;
    if (rt.mutationId && typeof getMutationById === "function") {
      const m = getMutationById(rt.mutationId);
      desc += ` · Мутация: ${m?.name || rt.mutationId}`;
      if (typeof getMutationPerkMeta === "function") {
        const perks = getMutationPerkMeta(rt.mutationId);
        if (perks?.capstoneDesc) desc += ` · ${perks.capstoneDesc}`;
      }
    } else if (rt.formId && typeof getMutationById === "function") {
      const m = getMutationById(rt.formId);
      desc += ` · Форма: ${m?.formName || rt.formId}`;
      if (typeof getMutationPerkMeta === "function") {
        const perks = getMutationPerkMeta(rt.formId);
        if (perks?.formPerk) desc += ` · ${perks.formPerk}`;
      }
    } else if (typeof resolveMutationProgress === "function") {
      const progress = resolveMutationProgress({
        classId: rt.classId,
        companionId: rt.companionId,
        items: rt.items,
        round,
      });
      const leaderId = progress?.leader?.id;
      if (leaderId && typeof getMutationPerkMeta === "function") {
        const perks = getMutationPerkMeta(leaderId);
        const gap = typeof formatMutationMilestoneGap === "function"
          ? formatMutationMilestoneGap(progress, round, rt.formId, rt.mutationId)
          : "";
        if (perks?.perkTagline) desc += ` · Путь: ${perks.perkTagline}`;
        if (gap) desc += ` · ${gap}`;
      }
    }
    if (classId === "priest" && typeof countFoodItemsInLoadout === "function") {
      const items = prepViewSide === "player" ? playerItems : enemyItems;
      const foodCount = countFoodItemsInLoadout(items);
      const bonus = cls?.combatBonus || {};
      const pct = Math.round((bonus.maxHpPctPerFood || 0.03) * 100);
      const healPct = Math.round((bonus.foodHealMult || 0.25) * 100);
      desc += ` · Сейчас: ${foodCount} еды → +${foodCount * pct}% HP, еда +${healPct}% хил`;
    }
    descEl.textContent = desc;
  }
}

function closePrepHeroTooltip() {
  document.getElementById("prep-hero-tooltip")?.classList.add("hidden");
  document.getElementById("btn-prep-hero-info")?.setAttribute("aria-expanded", "false");
}

function handlePrepTooltipsHotkey(e) {
  if (e.key !== "t" && e.key !== "T" && e.key !== "е" && e.key !== "Е") return false;
  if (phase !== "prep" || gameOver || isPhaseTransitioning()) return false;
  if (
    isBoardPreviewOpen()
    || isRecipeBookOpen()
    || isPopupOpen("class-overlay")
    || isPopupOpen("overlay")
    || isPopupOpen("bb-run-complete-overlay")
    || isPopupOpen("battle-result-overlay")
  ) {
    return false;
  }
  togglePrepTooltips();
  e.preventDefault();
  return true;
}

function togglePrepTooltips() {
  prepTooltipsEnabled = !prepTooltipsEnabled;
  document.documentElement.dataset.prepTooltips = prepTooltipsEnabled ? "on" : "off";
  document.documentElement.dataset.gamepadHud = prepTooltipsEnabled ? "auto" : "hidden";
  if (!prepTooltipsEnabled) hideSidebarTooltip();
  else if (lastGamepadPrepFocus) applyGamepadPrepFocusTooltip(lastGamepadPrepFocus);
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}

function applyGamepadPrepFocusTooltip(focus) {
  if (!prepTooltipsEnabled || phase !== "prep" || dragPayload) {
    if (!prepTooltipsEnabled || dragPayload) hideSidebarTooltip();
    return;
  }
  if (!focus) {
    hideSidebarTooltip();
    return;
  }
  if (focus.zone === "shop") {
    const card = document.querySelectorAll("#shop-slots .shop-card")[focus.index];
    if (!card || card.classList.contains("empty") || !card.dataset.itemId) {
      hideSidebarTooltip();
      return;
    }
    const c = getElementClientCenter(card);
    if (c) showSidebarTooltipAt(c.x, c.y, card.dataset.itemId, null, "shop", card);
    return;
  }
  if (focus.zone === "bench") {
    const card = document.querySelectorAll("#bench-slots .bench-card")[focus.index];
    const st = getSideState(prepViewSide);
    const idx = +card?.dataset?.bench;
    const entry = Number.isFinite(idx) ? st.bench[idx] : null;
    if (!card || card.classList.contains("empty") || !entry) {
      hideSidebarTooltip();
      return;
    }
    const c = getElementClientCenter(card);
    if (c) showSidebarTooltipAt(c.x, c.y, entry.itemId, entry, "bench", card);
    return;
  }
  if (focus.zone === "board" && gamepadBoardFocus) {
    const st = getSideState(prepViewSide);
    const { col, row } = gamepadBoardFocus;
    const item = findItemAtSlot(st.items, col, row);
    if (item) {
      const { x, y } = boardCellClientCenter(col, row);
      showSidebarTooltipAt(x, y, item.itemId, item, "field");
      return;
    }
    const container = findContainerAtCell(st.containers, col, row);
    if (container) {
      const { x, y } = boardCellClientCenter(col, row);
      showSidebarTooltipAt(x, y, container.itemId, null, "field");
      return;
    }
    hideSidebarTooltip();
  }
}

function escapeTooltipHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTooltipCooldownSec(sec) {
  const n = Math.max(0, Number(sec) || 0);
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} сек` : `${rounded.toFixed(1)} сек`;
}

function getItemTooltipAdjustments(contentItem) {
  if (!contentItem) return null;
  const rt = contentItem.runtime;
  const hasGems = contentItem.socketedGems?.some(Boolean);
  if (!rt && !hasGems) return null;

  const adj = {
    cooldownMult: rt?.cooldownMult ?? 1,
    damageBonus: rt?.damageBonus ?? 0,
    healBonus: rt?.healBonus ?? 0,
    blockBonus: rt?.blockBonus ?? 0,
    poisonBonus: rt?.poisonBonus ?? 0,
    passiveMaxHp: 0,
    passiveDefense: 0,
    passiveLuck: 0,
  };

  if (typeof getSocketBattleEffects === "function") {
    getSocketBattleEffects(contentItem).forEach((e) => {
      if (e.type === "statMult" && e.stat === "cooldown") {
        adj.cooldownMult *= 1 + (e.value || 0);
      }
      if (e.type === "heal") adj.healBonus += e.value || 0;
      if (e.type === "block") adj.blockBonus += e.value || 0;
      if (e.type === "damage") adj.damageBonus += e.value || 0;
      if (e.type === "passiveMaxHp") adj.passiveMaxHp += e.value || 0;
      if (e.type === "passiveDefense") adj.passiveDefense += e.value || 0;
      if (e.type === "passiveLuck") adj.passiveLuck += e.value || 0;
    });
  }

  if (typeof clampCooldownMult === "function") {
    adj.cooldownMult = clampCooldownMult(adj.cooldownMult);
  }

  return adj;
}

function applyDamageBonusToEffect(effect, bonus, def) {
  if (!bonus) return effect;
  const { min, max } = resolveDamageRange(effect, def);
  const nextMin = min + bonus;
  const nextMax = max + bonus;
  return {
    ...effect,
    valueMin: nextMin,
    valueMax: nextMax,
    value: Math.round((nextMin + nextMax) / 2),
  };
}

function makeStatDeltaLine(prefix, baseFormatted, effectiveFormatted, options = {}) {
  const { color = "#e6edf3", buffColor = "green", suffix = "" } = options;
  const base = `${baseFormatted}${suffix}`;
  const effective = `${effectiveFormatted}${suffix}`;
  if (base === effective) {
    return { text: `${prefix} ${base}`, style: "normal", color };
  }
  return {
    text: prefix,
    style: "normal",
    color,
    statDelta: { from: baseFormatted, to: effectiveFormatted, suffix, buffColor },
  };
}

function describeTooltipEffectLine(e, def, adj) {
  if (!adj) {
    const text = describeEffect(e, def);
    if (!text) return null;
    return { text, style: "normal", color: "#e6edf3" };
  }

  switch (e.type) {
    case "damage": {
      if (adj.damageBonus <= 0) break;
      const typeSuffix = e.damageType ? ` (${formatDamageType(e.damageType)})` : "";
      const baseRange = formatDamageRangeText(e, def);
      const modRange = formatDamageRangeText(applyDamageBonusToEffect(e, adj.damageBonus, def), def);
      return makeStatDeltaLine("⚔ Урон:", baseRange, modRange, { suffix: typeSuffix, buffColor: "green" });
    }
    case "heal": {
      if (adj.healBonus <= 0) break;
      const base = String(e.value ?? 0);
      const mod = String((e.value ?? 0) + adj.healBonus);
      return makeStatDeltaLine("❤ Лечение:", base, mod, { buffColor: "green" });
    }
    case "block": {
      if (adj.blockBonus <= 0) break;
      const base = String(e.value ?? 0);
      const mod = String((e.value ?? 0) + adj.blockBonus);
      return makeStatDeltaLine("🛡 Блок:", base, mod, { buffColor: "green" });
    }
    case "poison": {
      if (adj.poisonBonus <= 0) break;
      const base = String(e.value ?? 0);
      const mod = String((e.value ?? 0) + adj.poisonBonus);
      return makeStatDeltaLine("☠ Яд:", base, mod, { buffColor: "green" });
    }
    case "passiveDefense": {
      if (adj.passiveDefense <= 0) break;
      const base = String(e.value ?? 0);
      const mod = String((e.value ?? 0) + adj.passiveDefense);
      return makeStatDeltaLine("🦺 Защита:", `+${base}`, `+${mod}`, { buffColor: "green" });
    }
    case "passiveMaxHp": {
      if (adj.passiveMaxHp <= 0) break;
      const base = String(e.value ?? 0);
      const mod = String((e.value ?? 0) + adj.passiveMaxHp);
      return makeStatDeltaLine("❤ Макс. HP:", `+${base}`, `+${mod}`, { buffColor: "green" });
    }
    case "passiveLuck": {
      if (adj.passiveLuck <= 0) break;
      const base = String(e.value ?? 0);
      const mod = String((e.value ?? 0) + adj.passiveLuck);
      return makeStatDeltaLine("🍀 Удача:", `+${base}`, `+${mod}`, { buffColor: "green" });
    }
    default:
      break;
  }

  const text = describeEffect(e, def);
  if (!text) return null;
  return { text, style: "normal", color: "#e6edf3" };
}

function renderTooltipLinesHtml(lines) {
  const fmt = typeof formatTooltipMechanicText === "function"
    ? formatTooltipMechanicText
    : (text) => (typeof escapeTooltipHtml === "function" ? escapeTooltipHtml(text) : String(text ?? ""));

  return lines
    .filter((l) => !l.sep)
    .map((l) => {
      const color = l.color ? ` style="color:${l.color}"` : "";
      if (l.statDelta) {
        const buffClass = l.statDelta.buffColor === "purple" ? " tt-stat-buff--purple" : "";
        const suffix = l.statDelta.suffix ? escapeTooltipHtml(l.statDelta.suffix) : "";
        return `<div class="tt-line tt-line-stat tt-${l.style || "normal"}"${color}>${fmt(l.text)} <span class="tt-stat-base">${escapeTooltipHtml(l.statDelta.from)}</span><span class="tt-stat-arrow">→</span><span class="tt-stat-buff${buffClass}">${escapeTooltipHtml(l.statDelta.to)}</span>${suffix}</div>`;
      }
      if (l.html) {
        return `<div class="tt-line tt-${l.style || "normal"} tt-line--html"${color}>${l.html}</div>`;
      }
      return `<div class="tt-line tt-${l.style || "normal"}"${color}>${fmt(l.text)}</div>`;
    })
    .join("");
}

function isDescribeEffectFallback(e, def) {
  const described = describeEffect(e, def);
  if (!described) return true;
  const typeLabel = typeof localizeBbDescription === "function" ? localizeBbDescription(e.type) : e.type;
  const fallback = `${typeLabel}${e.value != null ? `: ${e.value}` : ""}`;
  return described === fallback;
}

function getStrongCanonicalEffectTexts(def) {
  const seen = new Set();
  const out = [];
  for (const e of def.effects || []) {
    if (isDescribeEffectFallback(e, def)) continue;
    const text = describeEffect(e, def);
    if (!text) continue;
    const key = normalizeTooltipCompareText(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function getPlacementSlotCanonicalTexts(itemId) {
  if (typeof getPlacementSlotsForItem !== "function") return [];
  const slots = getPlacementSlotsForItem(itemId);
  if (!slots.length) return [];

  const seen = new Set();
  const out = [];
  const push = (text) => {
    if (!text) return;
    const key = normalizeTooltipCompareText(text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(text);
  };

  if (typeof getPlacementSlotTooltipLines === "function") {
    getPlacementSlotTooltipLines(itemId).forEach(push);
  }
  slots.forEach((slot) => {
    push((slot.desc || "").replace(/^[⭐◆]\s*/, ""));
  });
  return out;
}

function getTooltipCanonicalTexts(def) {
  return [
    ...getStrongCanonicalEffectTexts(def),
    ...getPlacementSlotCanonicalTexts(def.id),
  ];
}

function dedupeTooltipLines(lines) {
  const kept = [];
  const canonicalForDedupe = [];
  for (const line of lines) {
    if (line.sep || line.style === "title" || line.style === "label") {
      kept.push(line);
      continue;
    }
    const text = line.text;
    if (!text) {
      kept.push(line);
      continue;
    }
    if (isTooltipTextCoveredBy(text, canonicalForDedupe)) continue;
    kept.push(line);
    canonicalForDedupe.push(text);
  }
  return kept;
}

function normalizeTooltipCompareText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/[«»"""'']/g, "")
    .replace(/(?:^|[\s,.;])(?:в\s+)?(?:при\s+[\p{L}]+|в\s+начале\s+боя)\s*:?\s*/giu, " ")
    .replace(/каждый|тегом|у противника|противнику|с тегом/g, "")
    .replace(/(\p{L}+)ов(?=[\s,.!?:;→]|$)/gu, "$1")
    .replace(/следующей/g, "след")
    .replace(/[^\p{L}\p{N}%+\-→.:]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tooltipCompareTokens(text) {
  const normalized = normalizeTooltipCompareText(text);
  if (!normalized) return [];
  return normalized.split(" ").filter((token) => token.length > 1 || /[\d%]/.test(token));
}

function isTooltipTextCoveredBy(candidate, canonicalTexts) {
  const normalizedCandidate = normalizeTooltipCompareText(candidate);
  if (!normalizedCandidate) return true;

  return canonicalTexts.some((canonical) => {
    const normalizedCanonical = normalizeTooltipCompareText(canonical);
    if (!normalizedCanonical) return false;
    if (normalizedCandidate.includes(normalizedCanonical) || normalizedCanonical.includes(normalizedCandidate)) {
      return true;
    }

    const candidateTokens = tooltipCompareTokens(candidate);
    const canonicalTokens = tooltipCompareTokens(canonical);
    if (!candidateTokens.length || !canonicalTokens.length) return false;

    const shorter = candidateTokens.length <= canonicalTokens.length ? candidateTokens : canonicalTokens;
    const longer = candidateTokens.length > canonicalTokens.length ? candidateTokens : canonicalTokens;
    const longerSet = new Set(longer);
    const matched = shorter.filter((token) => longerSet.has(token)).length;
    return matched / shorter.length >= 0.75;
  });
}

function splitTooltipDescriptionSegments(text) {
  return String(text ?? "")
    .split(/\.\s+/)
    .map((segment) => segment.replace(/\.\s*$/, "").trim())
    .filter(Boolean);
}

function filterRedundantTooltipText(text, canonicalTexts) {
  if (!text || !canonicalTexts.length) return text;

  const segments = splitTooltipDescriptionSegments(text);
  if (!segments.length) return text;

  const kept = segments.filter((segment) => !isTooltipTextCoveredBy(segment, canonicalTexts));
  if (!kept.length) return text;
  if (kept.length === segments.length) return text;

  const joined = kept.join(". ");
  return /[.!?]$/.test(text.trim()) ? `${joined}.` : joined;
}

const TOOLTIP_RARITY_LABELS = {
  common: "Обычный",
  uncommon: "Необычный",
  rare: "Редкий",
  epic: "Эпический",
  legendary: "Легендарный",
  godly: "Божественный",
  unique: "Уникальный",
};

const TOOLTIP_TAG_ICONS = {
  food: "🍖",
  nature: "🌱",
  potion: "🧪",
  poison: "☠",
  weapon: "⚔",
  armor: "🛡",
  shield: "🛡",
  magic: "✨",
  gem: "💎",
  pet: "🐾",
  fire: "🔥",
  cold: "❄",
  luck: "🍀",
  craft: "⚗️",
  consumable: "🧪",
  utility: "🔧",
  heal: "❤",
  card: "🃏",
};

function pushTooltipInfoEntry(entries, seen, key, entry) {
  if (!entry || seen.has(key)) return;
  seen.add(key);
  entries.push(entry);
}

function buildItemTooltipFooterMeta(def, context = "field") {
  if (!def) return null;
  const level = typeof ItemUnlockTiers !== "undefined" ? ItemUnlockTiers.getMinLevel(def.id) : null;
  const tags = (def.tags || []).slice(0, 6).map((tag) => {
    const glossary = typeof getItemTagGlossaryEntry === "function" ? getItemTagGlossaryEntry(tag) : null;
    const rawLabel = typeof formatTagLabel === "function" ? formatTagLabel(tag) : tag;
    const caption = glossary?.title
      || (rawLabel ? rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1) : tag);
    return {
      id: tag,
      icon: TOOLTIP_TAG_ICONS[tag] || "🏷",
      label: caption,
      caption,
    };
  });
  return {
    rarityLabel: TOOLTIP_RARITY_LABELS[def.rarity] || def.rarity || "Обычный",
    level,
    tags,
  };
}

function buildItemTooltipInfoEntries(def, contentItem, rotation, context, opts, detailLines = []) {
  const entries = [];
  const seen = new Set();

  const tooltipDescription = typeof getItemTooltipDescription === "function"
    ? getItemTooltipDescription(def)
    : def.description;
  if (typeof collectMechanicTagsFromText === "function") {
    collectMechanicTagsFromText(tooltipDescription).forEach((label) => {
      const hint = typeof getMechanicTagHint === "function" ? getMechanicTagHint(label) : null;
      if (!hint) return;
      pushTooltipInfoEntry(entries, seen, `mechanic:${label.toLowerCase()}`, {
        icon: typeof getMechanicTagIcon === "function" ? getMechanicTagIcon(label) : "❓",
        title: label,
        desc: hint,
        kind: "mechanic",
      });
    });
  }

  (def.tags || []).forEach((tag) => {
    const glossary = typeof getItemTagGlossaryEntry === "function" ? getItemTagGlossaryEntry(tag) : null;
    if (!glossary) return;
    pushTooltipInfoEntry(entries, seen, `tag:${tag}`, {
      icon: glossary.icon,
      title: glossary.title,
      desc: glossary.desc,
      kind: "tag",
    });
  });

  if (typeof isCraftIngredient === "function" && isCraftIngredient(def.id)) {
    pushTooltipInfoEntry(entries, seen, "ingredient", {
      icon: "⚗️",
      title: "Ингредиент",
      desc: "Используется в рецептах крафта с другими предметами.",
      kind: "tag",
    });
  }

  detailLines.forEach((line, index) => {
    if (!line || line.sep || line.style === "title") return;
    const text = line.text || line.html;
    if (!text) return;
    pushTooltipInfoEntry(entries, seen, `detail:${index}:${String(text).slice(0, 24)}`, {
      icon: line.style === "label" ? "📋" : "ℹ️",
      title: line.style === "label" ? String(line.text || "Подробнее") : "Подробнее",
      descHtml: line.html || null,
      desc: line.html ? null : String(line.text || ""),
      kind: "detail",
      tone: line.style || "normal",
    });
  });

  if (context === "field" && contentItem?.runtime?.activeSynergies?.length) {
    const activeLines = typeof formatActiveSynergyTooltipLines === "function"
      ? formatActiveSynergyTooltipLines(contentItem.runtime.activeSynergies)
      : contentItem.runtime.activeSynergies.map((s) => s.desc);
    activeLines.forEach((text, index) => {
      pushTooltipInfoEntry(entries, seen, `synergy:${index}`, {
        icon: "🔗",
        title: index === 0 ? "Активно на поле" : "Синергия",
        desc: text,
        kind: "runtime",
      });
    });
  }

  const craftSide = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
  if (!getCraftTooltipMeta?.(def.id, craftSide) && typeof getItemGrimFlavor === "function") {
    const flavor = getItemGrimFlavor(def.id);
    if (flavor) {
      pushTooltipInfoEntry(entries, seen, "flavor", {
        icon: "📜",
        title: "Описание",
        desc: flavor,
        kind: "flavor",
      });
    }
  }

  return entries;
}

/** Разнесённая подсказка: компактная карточка + попапы info/craft (реф. Backpack Battles). */
function buildItemTooltipPayload(def, contentItem, rotation, context = "field", opts = {}) {
  const heroClass = opts.heroClass
    || (typeof pendingPlayerClass !== "undefined" ? pendingPlayerClass : null)
    || (typeof playerClass !== "undefined" ? playerClass : null);
  const presentation = typeof getItemPresentationState === "function"
    ? getItemPresentationState(def.id, heroClass, opts)
    : null;
  if (presentation?.locked && typeof buildLockedItemTooltipLines === "function") {
    const lockedLines = buildLockedItemTooltipLines(def, presentation);
    return {
      locked: true,
      titleText: typeof getItemDisplayName === "function" ? getItemDisplayName(def) : def.name,
      summaryLines: lockedLines.filter((l) => l.style !== "title"),
      infoEntries: [],
      footerMeta: buildItemTooltipFooterMeta(def, context),
      craftSide: typeof prepViewSide !== "undefined" ? prepViewSide : "player",
      hasInfo: false,
      hasCraft: false,
    };
  }

  const fullLines = buildItemTooltipLines(def, contentItem, rotation, context, opts);
  const titleLine = fullLines.find((l) => l.style === "title");
  const titleText = stripLeadingEmoji(titleLine?.text || "")
    || (typeof getItemDisplayName === "function" ? getItemDisplayName(def) : def.name)
    || "Предмет";

  const summaryLines = [];
  const detailLines = [];
  const canonicalEffectTexts = getTooltipCanonicalTexts(def);
  const tooltipDescription = typeof getItemTooltipDescription === "function"
    ? getItemTooltipDescription(def)
    : def.description;
  const hasTooltipDescription = Boolean(tooltipDescription?.trim());
  const filteredTooltipDescription = tooltipDescription
    ? filterRedundantTooltipText(tooltipDescription, canonicalEffectTexts)
    : null;
  const displayDescription = filteredTooltipDescription || tooltipDescription;

  if (displayDescription) {
    summaryLines.push({ text: displayDescription, style: "normal", color: "#c9d1d9" });
  }

  fullLines.forEach((line) => {
    if (!line || line.sep || line.style === "title") return;
    if (line.text === displayDescription) return;

    const isSummaryStat = !!line.statDelta;
    const isPrimaryDescription = line.text === displayDescription;

    if (isPrimaryDescription) return;

    if (isSummaryStat) {
      summaryLines.push(line);
      return;
    }

    if (line.style === "normal" && hasTooltipDescription && !line.statDelta && !line.html) {
      detailLines.push(line);
      return;
    }

    if (line.style === "sub" || line.style === "label" || line.style === "flavor" || line.html) {
      detailLines.push(line);
      return;
    }

    if (!hasTooltipDescription) {
      summaryLines.push(line);
    } else {
      detailLines.push(line);
    }
  });

  const craftSide = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
  const infoEntries = buildItemTooltipInfoEntries(
    def,
    contentItem,
    rotation,
    context,
    opts,
    detailLines,
  );

  return {
    locked: false,
    titleText,
    summaryLines: dedupeTooltipLines(summaryLines),
    infoEntries,
    footerMeta: buildItemTooltipFooterMeta(def, context),
    craftSide,
    hasInfo: infoEntries.length > 0,
    hasCraft: typeof getCraftTooltipMeta === "function" && !!getCraftTooltipMeta(def.id, craftSide),
  };
}

function stripLeadingEmoji(text) {
  return String(text ?? "")
    .replace(/^(\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*)\s*/u, "")
    .trim();
}

/** context: shop — магазин; bench — скамейка; field — предмет на поле / canvas */
function buildItemTooltipLines(def, contentItem, rotation, context = "field", opts = {}) {
  const heroClass = opts.heroClass
    || (typeof pendingPlayerClass !== "undefined" ? pendingPlayerClass : null)
    || (typeof playerClass !== "undefined" ? playerClass : null);
  const presentation = typeof getItemPresentationState === "function"
    ? getItemPresentationState(def.id, heroClass, opts)
    : null;
  if (presentation?.locked && typeof buildLockedItemTooltipLines === "function") {
    return buildLockedItemTooltipLines(def, presentation);
  }

  const lines = [];
  lines.push({ text: `${getItemIcons(def).join("")} ${typeof getItemDisplayName === "function" ? getItemDisplayName(def) : def.name}`, style: "title", color: RARITY_COLORS[def.rarity] || "#e6edf3" });

  if (def.isContainer) {
    const slots = getSlotBounds(playerContainers);
    const shape = typeof normalizeItemShape === "function"
      ? normalizeItemShape(def.shape)
      : (Array.isArray(def.shape) ? def.shape : []);
    const bounds = typeof getShapeBounds === "function"
      ? getShapeBounds(shape)
      : { cols: shape.length || 1, rows: 1 };
    lines.push({
      text: `Контейнер · +${shape.length} слотов (${bounds.cols}×${bounds.rows})`,
      style: "sub",
      color: "#8b949e",
    });
    const containerDesc = typeof getItemTooltipDescription === "function"
      ? getItemTooltipDescription(def)
      : def.description;
    const containerCanonicalTexts = getTooltipCanonicalTexts(def);
    const filteredContainerDesc = containerDesc
      ? filterRedundantTooltipText(containerDesc, containerCanonicalTexts)
      : null;
    if (filteredContainerDesc) {
      lines.push({ text: filteredContainerDesc, style: "normal", color: "#c9d1d9" });
    }
    if (context === "shop") {
      lines.push({ text: `${def.cost}💰 · купите и поставьте рядом с инвентарём`, style: "normal", color: "#f0c14b" });
    }
    if (slots) {
      lines.push({
        text: `Поле: ${slots.maxCol - slots.minCol + 1}×${slots.maxRow - slots.minRow + 1} (${slots.count} кл.)`,
        style: "normal",
        color: "#79c0ff",
      });
    }
    return lines;
  }

  if (context !== "shop") {
    const shape = typeof normalizeItemShape === "function"
      ? normalizeItemShape(def.shape)
      : (Array.isArray(def.shape) ? def.shape : []);
    lines.push({ text: `${shape.length} кл.`, style: "sub", color: "#8b949e" });
  }

  const placementSlotLines = typeof getPlacementSlotTooltipLines === "function"
    ? getPlacementSlotTooltipLines(def.id)
    : [];
  const canonicalEffectTexts = getTooltipCanonicalTexts(def);

  const tooltipDescription = typeof getItemTooltipDescription === "function"
    ? getItemTooltipDescription(def)
    : def.description;
  const hasTooltipDescription = Boolean(tooltipDescription?.trim());
  const filteredTooltipDescription = tooltipDescription
    ? filterRedundantTooltipText(tooltipDescription, canonicalEffectTexts)
    : null;
  const displayDescription = filteredTooltipDescription || tooltipDescription;
  if (displayDescription) {
    lines.push({ text: displayDescription, style: "normal", color: "#c9d1d9" });
  }

  const buildHints = typeof getItemBuildHints === "function" ? getItemBuildHints(def) : def.buildHints;
  if (buildHints && context !== "shop") {
    lines.push({ text: `💡 ${buildHints}`, style: "sub", color: "#79c0ff" });
  }

  if (contentItem && typeof formatSocketedGemsLine === "function") {
    const socketLine = formatSocketedGemsLine(contentItem);
    if (socketLine) lines.push({ text: socketLine, style: "normal", color: "#d2a8ff" });
  }
  if (def.sockets > 0 && context !== "shop") {
    const used = contentItem?.socketedGems?.filter(Boolean).length || 0;
    lines.push({
      text: `⭕ Сокеты: ${used}/${def.sockets}`,
      style: "normal",
      color: "#bc8cff",
    });
  }

  placementSlotLines.forEach((line) => {
    lines.push({ text: line, style: "normal", color: "#f0c14b" });
  });

  if (isGemItem(def.id) && context === "field") {
    lines.push({ text: "Перетащите на предмет с сокетом для вставки", style: "normal", color: "#bc8cff" });
  }

  if (def.goldPerRound > 0) {
    lines.push({ text: `💰 +${def.goldPerRound} золота за раунд`, style: "normal", color: "#f0c14b" });
  }

  const adj = context === "field" ? getItemTooltipAdjustments(contentItem) : null;

  if (def.effects?.length) {
    def.effects.forEach((e) => {
      const line = describeTooltipEffectLine(e, def, adj);
      if (!line) return;
      if (hasTooltipDescription && !line.statDelta) return;
      lines.push(line);
    });
    if (def.cooldown > 0) {
      if (adj && adj.cooldownMult < 0.999) {
        const effective = def.cooldown * adj.cooldownMult;
        lines.push(makeStatDeltaLine(
          "⏱ Перезарядка:",
          formatTooltipCooldownSec(def.cooldown),
          formatTooltipCooldownSec(effective),
          { color: "#8b949e", buffColor: "purple" },
        ));
      } else {
        lines.push({
          text: `⏱ Перезарядка: ${formatTooltipCooldownSec(def.cooldown)}`,
          style: "normal",
          color: "#8b949e",
        });
      }
    } else if (def.effects.every((e) => e.trigger === "passive" || e.type.startsWith("passive"))) {
      lines.push({ text: "Пассивный", style: "normal", color: "#8b949e" });
    }
    const staminaCost = typeof getItemStaminaCost === "function" ? getItemStaminaCost(def) : (def.staminaCost || 0);
    if (staminaCost > 0) {
      lines.push({ text: `⚡ Выносливость: ${staminaCost}`, style: "normal", color: "#d29922" });
    }
  } else if (adj && (adj.passiveMaxHp > 0 || adj.passiveDefense > 0 || adj.passiveLuck > 0)) {
    if (adj.passiveDefense > 0 && !def.effects?.some((e) => e.type === "passiveDefense")) {
      lines.push(makeStatDeltaLine("🦺 Защита:", "+0", `+${adj.passiveDefense}`, { buffColor: "green" }));
    }
    if (adj.passiveMaxHp > 0 && !def.effects?.some((e) => e.type === "passiveMaxHp")) {
      lines.push(makeStatDeltaLine("❤ Макс. HP:", "+0", `+${adj.passiveMaxHp}`, { buffColor: "green" }));
    }
    if (adj.passiveLuck > 0 && !def.effects?.some((e) => e.type === "passiveLuck")) {
      lines.push(makeStatDeltaLine("🍀 Удача:", "+0", `+${adj.passiveLuck}`, { buffColor: "green" }));
    }
  }

  if (def.classRestriction) {
    const c = getClassById(def.classRestriction);
    lines.push({ text: `Только: ${c?.name || def.classRestriction}`, style: "normal", color: "#f0c14b" });
  }

  if (typeof getCraftTooltipMeta === "function") {
    const craftSide = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
    const craftMeta = getCraftTooltipMeta(def.id, craftSide);
    if (!craftMeta && typeof getItemGrimFlavor === "function" && context !== "shop") {
      const flavor = getItemGrimFlavor(def.id);
      if (flavor) {
        lines.push({ text: flavor, style: "flavor", color: "#848896" });
      }
    }
  }

  if (context === "field" && contentItem?.runtime) {
    const rt = contentItem.runtime;
    const bonuses = [];
    if (rt.poisonSourceEfficiency != null && rt.poisonSourceEfficiency < 1) {
      bonuses.push(`${Math.round(rt.poisonSourceEfficiency * 100)}% эффективности яда (стак)`);
    }
    if (rt.blockSourceEfficiency != null && rt.blockSourceEfficiency < 1) {
      bonuses.push(`${Math.round(rt.blockSourceEfficiency * 100)}% эффективности блока (стак)`);
    }
    if (rt.duplicateEfficiency != null && rt.duplicateEfficiency < 1) {
      bonuses.push(`${Math.round(rt.duplicateEfficiency * 100)}% силы (повтор на доске)`);
    }
    if (rt.grantBlockBuff && rt.grantBlockBuffEfficiency != null && rt.grantBlockBuffEfficiency < 1) {
      bonuses.push(`${Math.round(rt.grantBlockBuffEfficiency * 100)}% баффа оружия при блоке`);
    }
    if (bonuses.length) {
      lines.push({ sep: true });
      lines.push({ text: "Модификаторы:", style: "label", color: "#a371f7" });
      bonuses.forEach((b) => lines.push({ text: b, style: "normal", color: "#a371f7" }));
    }
    if (rt.activeSynergies?.length) {
      lines.push({ sep: true });
      lines.push({ text: "Активно:", style: "label", color: "#58a6ff" });
      const activeLines = typeof formatActiveSynergyTooltipLines === "function"
        ? formatActiveSynergyTooltipLines(rt.activeSynergies)
        : rt.activeSynergies.map((s) => s.desc);
      activeLines.forEach((text) => lines.push({ text, style: "normal", color: "#58a6ff" }));
    }
  }

  return dedupeTooltipLines(lines);
}

function getTooltipBounds(boundsKind = "viewport") {
  if (boundsKind === "field") {
    const canvasEl = document.getElementById("game-canvas");
    if (canvasEl) return canvasEl.getBoundingClientRect();
  }
  if (boundsKind === "shop") {
    const shop = document.getElementById("shop-panel");
    if (shop) return shop.getBoundingClientRect();
  }
  const app = document.getElementById("app");
  if (app) {
    const rect = app.getBoundingClientRect();
    return {
      left: rect.left + 8,
      top: rect.top + 8,
      right: rect.right - 8,
      bottom: rect.bottom - 8,
      width: rect.width - 16,
      height: rect.height - 16,
    };
  }
  return {
    left: 8,
    top: 8,
    right: window.innerWidth - 8,
    bottom: window.innerHeight - 8,
  };
}

function isPointerOverPrepSidebar(clientX, clientY) {
  if (clientX == null || clientY == null) return false;
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit) return false;
  return !!hit.closest(
    "#shop-panel, #prep-bench-popover, #bench-panel, #bench-slots, .bench-card, #btn-prep-bench-fab, #prep-shop-popover, .run-stats-anchor, #prep-run-stats-anchor, #run-stats-popover, #sidebar-tooltip, #prep-tooltip-dock, #recipe-book-overlay, #bb-item-wiki-overlay, #combat-feed-dock, #combat-feed-panel, #combat-feed-scroll, #prep-doll-layer",
  );
}

function isPointerOverPrepStorage(clientX, clientY) {
  if (clientX == null || clientY == null) return false;
  if (typeof shouldUsePrepStoragePhysics !== "function" || !shouldUsePrepStoragePhysics()) return false;
  const hit = document.elementFromPoint(clientX, clientY);
  if (hit?.closest?.(".prep-storage-body, #prep-storage-mount, .prep-storage-arena")) return true;
  return typeof PrepStoragePhysics !== "undefined" && PrepStoragePhysics.isPointerInside(clientX, clientY);
}

function resolvePrepStorageBenchEntry(clientX, clientY) {
  if (typeof shouldUsePrepStoragePhysics !== "function" || !shouldUsePrepStoragePhysics()) return null;
  const hit = document.elementFromPoint(clientX, clientY);
  const bodyEl = hit?.closest?.(".prep-storage-body");
  const side = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
  const st = typeof getSideState === "function" ? getSideState(side) : null;
  if (!st?.bench?.length) return null;

  if (bodyEl) {
    const idx = Number(bodyEl.dataset.bench);
    const entry = Number.isFinite(idx) && idx >= 0 ? st.bench[idx] : null;
    if (entry?.uid === bodyEl.dataset.uid) {
      return { entry, sourceEl: bodyEl };
    }
    const byUid = st.bench.find((e) => e.uid === bodyEl.dataset.uid);
    if (byUid) return { entry: byUid, sourceEl: bodyEl };
  }

  if (typeof PrepStoragePhysics === "undefined") return null;
  const benchIndex = PrepStoragePhysics.hitTestBenchIndex(clientX, clientY);
  if (benchIndex < 0) return null;
  const entry = st.bench[benchIndex];
  if (!entry) return null;
  const sourceEl = document.querySelector(`.prep-storage-body[data-uid="${entry.uid}"]`);
  return { entry, sourceEl };
}

function tryShowPrepStorageTooltip(clientX, clientY) {
  if (typeof prepTooltipsEnabled !== "undefined" && !prepTooltipsEnabled) return false;
  if (typeof dragPayload !== "undefined" && dragPayload) return false;
  const resolved = resolvePrepStorageBenchEntry(clientX, clientY);
  if (!resolved) return false;
  showSidebarTooltipAt(
    clientX,
    clientY,
    resolved.entry.itemId,
    resolved.entry,
    "bench",
    resolved.sourceEl,
    { pinned: true },
  );
  return true;
}

function isPointerOverCombatFeed(clientX, clientY) {
  if (clientX == null || clientY == null) return false;
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit) return false;
  return !!hit.closest(
    "#combat-feed-dock, #combat-feed-panel, #combat-feed-scroll, .combat-feed-msg-text--hinted",
  );
}

function markCombatFeedTooltipActive() {
  sidebarTooltipSource = "combat-feed";
  fieldTooltipVisible = false;
  tooltipItem = null;
}

function clearCombatFeedTooltipActive() {
  if (sidebarTooltipSource === "combat-feed") sidebarTooltipSource = null;
}

function getShopTooltipAnchorY() {
  const slots = document.getElementById("shop-slots");
  const panel = document.getElementById("shop-panel");
  const el = slots || panel;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return rect.top + rect.height * 0.42;
}

function getBenchTooltipAnchorY() {
  const slots = document.getElementById("bench-slots");
  const panel = document.getElementById("bench-panel");
  const el = slots || panel;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return rect.top + rect.height * 0.38;
}

function getTooltipCorridorBounds(margin = 10, gap = 14) {
  const canvasRect = document.getElementById("game-canvas")?.getBoundingClientRect();
  const shopRect = document.getElementById("shop-panel")?.getBoundingClientRect();
  const vv = window.visualViewport;
  const viewTop = (vv?.offsetTop ?? 0) + margin;
  const viewBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - margin;

  if (!canvasRect || !shopRect) return null;

  const left = canvasRect.right + gap;
  const right = shopRect.left - gap;
  if (right - left < 72) return null;

  return { left, right, top: viewTop, bottom: viewBottom };
}

function positionTooltipInCorridor(tipW, tipH, margin, gap, options = {}) {
  const {
    hAnchor = "left",
    hFraction = 0.55,
    clientY = 0,
    verticalBias = 0.42,
    anchorY = null,
  } = options;

  const corridor = getTooltipCorridorBounds(margin, gap);
  if (!corridor) return null;

  const corridorW = corridor.right - corridor.left;
  let left;

  if (hAnchor === "center") {
    const centerX = corridor.left + corridorW * hFraction;
    left = centerX - tipW / 2;
    left = Math.max(corridor.left, Math.min(left, corridor.right - tipW));
  } else {
    left = corridor.left;
    if (left + tipW > corridor.right) {
      left = Math.max(corridor.left, corridor.right - tipW);
    }
  }

  const refY = anchorY ?? clientY;
  let top = refY - tipH * verticalBias;
  top = Math.max(corridor.top, Math.min(top, corridor.bottom - tipH));
  return { left, top };
}

function getCorridorTooltipPosition(placement, clientX, clientY, tipW, tipH, margin, gap) {
  if (placement === "field") {
    return positionTooltipInCorridor(tipW, tipH, margin, gap, {
      hAnchor: "left",
      clientY,
      verticalBias: 0.42,
    });
  }
  if (placement === "shop") {
    return positionTooltipInCorridor(tipW, tipH, margin, gap, {
      hAnchor: "center",
      hFraction: 0.58,
      anchorY: getShopTooltipAnchorY(),
      clientY,
      verticalBias: 0.36,
    });
  }
  if (placement === "bench") {
    return positionTooltipInCorridor(tipW, tipH, margin, gap, {
      hAnchor: "center",
      hFraction: 0.58,
      anchorY: getBenchTooltipAnchorY(),
      clientY,
      verticalBias: 0.4,
    });
  }
  if (placement === "doll") {
    return positionTooltipInCorridor(tipW, tipH, margin, gap, {
      hAnchor: "left",
      clientY,
      verticalBias: 0.42,
    });
  }
  if (placement === "inventory") {
    return null;
  }
  return null;
}

function positionHeroHudTooltip(clientX, clientY, tipW, tipH, margin, gap) {
  const vv = window.visualViewport;
  const viewLeft = (vv?.offsetLeft ?? 0) + margin;
  const viewTop = (vv?.offsetTop ?? 0) + margin;
  const viewRight = viewLeft + (vv?.width ?? window.innerWidth) - margin * 2;
  const viewBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - margin;

  let left = clientX - tipW / 2;
  let top = clientY + gap;
  if (top + tipH > viewBottom) top = clientY - tipH - gap;
  top = Math.max(viewTop, Math.min(top, viewBottom - tipH));
  left = Math.max(viewLeft, Math.min(left, viewRight - tipW));
  return { left, top };
}

function positionSidebarTooltip(clientX, clientY, boundsKind = "viewport", placement = "auto") {
  const el = document.getElementById("sidebar-tooltip");
  const dock = document.getElementById("prep-tooltip-dock");
  if (!el || el.classList.contains("hidden")) return;

  if (shouldUsePrepTooltipDock(placement)) {
    el.classList.remove("sidebar-tooltip--floating");
    setPrepTooltipDockPassthrough(false);
    positionPrepTooltipDock();
    el.style.left = "";
    el.style.top = "";
    el.style.right = "";
    el.style.bottom = "";
    el.style.visibility = "";
    el.style.position = "";
    el.style.zIndex = "";
    syncPrepTooltipDockVisibility();
    return;
  }

  el.classList.add("sidebar-tooltip--floating");
  setPrepTooltipDockPassthrough(true);

  const bounds = getTooltipBounds(boundsKind);
  const margin = 10;
  const gap = 14;

  el.style.visibility = "hidden";
  el.style.left = "-9999px";
  el.style.top = "0";
  const tipW = el.offsetWidth;
  const tipH = el.offsetHeight;

  let left;
  let top;

  if (placement === "mod-chip" || placement === "companion") {
    const heroHudPos = positionHeroHudTooltip(clientX, clientY, tipW, tipH, margin, gap);
    left = heroHudPos.left;
    top = heroHudPos.top;
  } else if (placement === "shop" || placement === "bench" || placement === "field" || placement === "doll" || placement === "inventory") {
    const corridorPos = getCorridorTooltipPosition(placement, clientX, clientY, tipW, tipH, margin, gap);
    if (corridorPos) {
      left = corridorPos.left;
      top = corridorPos.top;
    } else if (placement === "field") {
      const vv = window.visualViewport;
      const viewRight = (vv?.offsetLeft ?? 0) + (vv?.width ?? window.innerWidth) - margin;
      const viewTop = (vv?.offsetTop ?? 0) + margin;
      const viewBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - margin;
      left = viewRight - tipW;
      top = Math.max(viewTop, Math.min(clientY - tipH * 0.42, viewBottom - tipH));
    } else if (placement === "inventory") {
      left = clientX - tipW / 2;
      top = clientY - tipH - gap;
      top = Math.max(bounds.top + margin, Math.min(top, bounds.bottom - tipH - margin));
      left = Math.max(bounds.left + margin, Math.min(left, bounds.right - tipW - margin));
    } else {
      const bias = placement === "bench" ? 0.58 : 0.42;
      left = clientX - tipW - gap;
      top = clientY - tipH * bias;
      top = Math.max(bounds.top + margin, Math.min(top, bounds.bottom - tipH - margin));
      left = Math.max(bounds.left + margin, Math.min(left, bounds.right - tipW - margin));
    }
  } else {
    const spaceRight = bounds.right - clientX - margin;
    const spaceLeft = clientX - bounds.left - margin;
    const preferRight = spaceRight >= spaceLeft;

    if (preferRight && spaceRight >= Math.min(tipW, 120)) {
      left = clientX + gap;
    } else if (spaceLeft >= Math.min(tipW, 120)) {
      left = clientX - tipW - gap;
    } else if (spaceRight >= spaceLeft) {
      left = clientX + gap;
    } else {
      left = clientX - tipW - gap;
    }

    top = clientY - tipH * 0.35;
    top = Math.max(bounds.top + margin, Math.min(top, bounds.bottom - tipH - margin));
    left = Math.max(bounds.left + margin, Math.min(left, bounds.right - tipW - margin));
  }

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.visibility = "";
}

function syncFieldTooltip() {
  try {
    if (!tooltipItem || dragPayload) {
      if (fieldTooltipVisible && sidebarTooltipSource !== "combat-feed" && !sidebarTooltipPinned) {
        hideSidebarTooltip();
      }
      return;
    }

    if (sidebarTooltipSource === "combat-feed") {
      clearCombatFeedTooltipActive();
    }

    sidebarTooltipSource = "field";
    sidebarTooltipPinned = true;
    const { itemId, x, y, contentItem, rotation } = tooltipItem;
    const el = document.getElementById("sidebar-tooltip");
    const def = ITEM_CATALOG[itemId];
    if (!el || !def) return;

    el.classList.remove("synergy-tooltip");
    const cardOpts = getItemTooltipCardOptions(def, "field");
    cardOpts.itemId = def.id;
    cardOpts.craftSide = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
    const payload = buildItemTooltipPayload(def, contentItem, rotation || 0, "field");
    applySidebarTooltipCard(el, payload, cardOpts);
    el.classList.remove("hidden");
    fieldTooltipVisible = true;

    const client = canvasPointToClient(x, y);
    if (!client) return;
    positionSidebarTooltip(client.x, client.y, "field", "field");
  } catch (err) {
    console.error("syncFieldTooltip failed:", err);
    tooltipItem = null;
    hideSidebarTooltip();
  }
}

function pickClosestEntityAtCanvasPoint(mx, my, entities, team, pad = 0) {
  let best = null;
  let bestDist = Infinity;
  for (let i = entities.length - 1; i >= 0; i -= 1) {
    const entity = entities[i];
    getItemCells(entity).forEach(([c, r]) => {
      const rect = cellRect(team, c, r);
      if (mx < rect.x - pad || mx > rect.x + rect.w + pad || my < rect.y - pad || my > rect.y + rect.h + pad) {
        return;
      }
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      const dist = Math.hypot(mx - cx, my - cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = entity;
      }
    });
  }
  return best;
}

function findItemAtCanvasPoint(mx, my, items, team = "player") {
  if (!isTouchUi()) {
    const picked = pickClosestEntityAtCanvasPoint(mx, my, items, team);
    if (picked) return picked;
    const col = xToCol(mx, team);
    const row = yToRow(my, team);
    return findItemAtSlot(items, col, row);
  }

  const col = xToCol(mx, team);
  const row = yToRow(my, team);
  const exact = findItemAtSlot(items, col, row);
  if (exact) return exact;

  const stride = gridStrideFor(team);
  const pad = TOOLTIP_CONFIG.touchPadding;
  const searchRadius = Math.ceil(pad / stride) + 1;
  let best = null;
  let bestDist = Infinity;

  items.forEach((item) => {
    getItemCells(item).forEach(([c, r]) => {
      if (Math.abs(c - col) > searchRadius || Math.abs(r - row) > searchRadius) return;
      const rect = cellRect(team, c, r);
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      const dist = Math.hypot(mx - cx, my - cy);
      const maxDist = Math.max(rect.w, rect.h) / 2 + pad;
      if (dist <= maxDist && dist < bestDist) {
        bestDist = dist;
        best = item;
      }
    });
  });

  return best;
}

function findContainerAtCanvasPoint(mx, my, containers, team = "player") {
  if (!isTouchUi()) {
    return pickClosestEntityAtCanvasPoint(mx, my, containers, team);
  }

  const col = xToCol(mx, team);
  const row = yToRow(my, team);
  const exact = findContainerAtCell(containers, col, row);
  if (exact) return exact;

  const stride = gridStrideFor(team);
  const pad = TOOLTIP_CONFIG.touchPadding;
  const searchRadius = Math.ceil(pad / stride) + 1;
  let best = null;
  let bestDist = Infinity;

  containers.forEach((container) => {
    getItemCells(container).forEach(([c, r]) => {
      if (Math.abs(c - col) > searchRadius || Math.abs(r - row) > searchRadius) return;
      const rect = cellRect(team, c, r);
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      const dist = Math.hypot(mx - cx, my - cy);
      const maxDist = Math.max(rect.w, rect.h) / 2 + pad;
      if (dist <= maxDist && dist < bestDist) {
        bestDist = dist;
        best = container;
      }
    });
  });

  return best;
}

function getTooltipBoardSources() {
  if ((phase === "battle" || phase === "replay") && battleState) {
    return {
      playerItems: battleState.player.items,
      enemyItems: battleState.enemy.items,
      playerContainers: null,
      enemyContainers: null,
    };
  }
  if (phase === "prep") {
    return {
      playerItems,
      enemyItems,
      playerContainers,
      enemyContainers,
    };
  }
  return null;
}

function isPointerOverBattleInventoryPopover(clientX, clientY) {
  if (clientX == null || clientY == null) return false;
  const hit = document.elementFromPoint(clientX, clientY);
  return !!hit?.closest?.(".battle-inventory-popover");
}

function updateTooltip(mx, my) {
  if (isPointerOverCombatFeed(lastPointerClient.x, lastPointerClient.y)) {
    return;
  }
  if (isPointerOverBattleInventoryPopover(lastPointerClient.x, lastPointerClient.y)) {
    return;
  }

  if (sidebarTooltipSource === "combat-feed" && typeof CombatLog?.hideTooltip === "function") {
    CombatLog.hideTooltip();
  }

  if (dragPayload) {
    tooltipItem = null;
    syncFieldTooltip();
    return;
  }

  const stickyTooltip = isSidebarTooltipVisible() && sidebarTooltipPinned;
  if (stickyTooltip && sidebarTooltipSource !== "field") {
    return;
  }

  const sources = getTooltipBoardSources();
  if (!sources) {
    if (!stickyTooltip) {
      tooltipItem = null;
      syncFieldTooltip();
    }
    return;
  }

  if (phase === "prep") {
    const side = prepViewSide;
    if (isOnBoard(mx, my, side)) {
      const col = xToCol(mx, side);
      const row = yToRow(my, side);
      const items = side === "player" ? sources.playerItems : sources.enemyItems;
      const containers = side === "player" ? sources.playerContainers : sources.enemyContainers;
      const item = findItemAtCanvasPoint(mx, my, items, side);
      if (item) {
        tooltipItem = { itemId: item.itemId, x: mx, y: my, contentItem: item };
        syncFieldTooltip();
        return;
      }
      if (containers) {
        const container = findContainerAtCanvasPoint(mx, my, containers, side);
        if (container) {
          tooltipItem = { itemId: container.itemId, x: mx, y: my, rotation: container.rotation || 0 };
          syncFieldTooltip();
          return;
        }
      }
    }
    if (!stickyTooltip) {
      tooltipItem = null;
      syncFieldTooltip();
    }
    return;
  }

  if (isOnBoard(mx, my, "player")) {
    const col = xToCol(mx, "player");
    const row = yToRow(my, "player");
    const item = findItemAtCanvasPoint(mx, my, sources.playerItems, "player");
    if (item) {
      tooltipItem = { itemId: item.itemId, x: mx, y: my, contentItem: item };
      syncFieldTooltip();
      return;
    }
    if (sources.playerContainers) {
      const container = findContainerAtCanvasPoint(mx, my, sources.playerContainers, "player");
      if (container) {
        tooltipItem = { itemId: container.itemId, x: mx, y: my, rotation: container.rotation || 0 };
        syncFieldTooltip();
        return;
      }
    }
  }

  if (isOnBoard(mx, my, "enemy")) {
    const col = xToCol(mx, "enemy");
    const row = yToRow(my, "enemy");
    const item = findItemAtCanvasPoint(mx, my, sources.enemyItems, "enemy");
    if (item) {
      tooltipItem = { itemId: item.itemId, x: mx, y: my, contentItem: item };
      syncFieldTooltip();
      return;
    }
    if (sources.enemyContainers) {
      const container = findContainerAtCanvasPoint(mx, my, sources.enemyContainers, "enemy");
      if (container) {
        tooltipItem = { itemId: container.itemId, x: mx, y: my, rotation: container.rotation || 0 };
        syncFieldTooltip();
        return;
      }
    }
  }

  if (!stickyTooltip) {
    tooltipItem = null;
    syncFieldTooltip();
  }
}

function showSidebarTooltipAt(clientX, clientY, itemId, contentItem, context = "shop", sourceEl = null, options = {}) {
  if (shouldSuppressTooltipReshow(sourceEl)) return;
  const el = document.getElementById("sidebar-tooltip");
  const def = ITEM_CATALOG[itemId];
  if (!el || !def) return;
  cancelScheduledTooltipHide();
  sidebarTooltipPinned = options.pinned !== false;
  sidebarTooltipSource = context;
  if (typeof syncDomSparkleFromTooltipSource === "function") {
    syncDomSparkleFromTooltipSource(sourceEl);
  }
  tooltipItem = null;
  fieldTooltipVisible = false;
  el.classList.remove("synergy-tooltip");
  const heroClass = typeof playerClass !== "undefined" ? playerClass : null;
  const presentation = typeof getItemPresentationState === "function"
    ? getItemPresentationState(itemId, heroClass)
    : null;
  const cardOpts = getItemTooltipCardOptions(def, context);
  if (presentation?.locked) {
    cardOpts.emoji = "🔒";
    cardOpts.locked = true;
    cardOpts.rarityColor = "#484f58";
  } else {
    cardOpts.itemId = def.id;
    cardOpts.craftSide = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
  }
  if (sourceEl?.dataset?.unaffordable) {
    const sideGold = getSideState(prepViewSide).gold;
    const payload = buildItemTooltipPayload(def, contentItem, 0, context, { heroClass });
    applySidebarTooltipCard(el, {
      ...payload,
      summaryLines: [
        { text: "Недостаточно золота", style: "label", color: "#f85149" },
        { text: `${def.cost}💰 · у вас ${sideGold}💰`, style: "sub", color: "#8b949e" },
        ...(payload.summaryLines || []),
      ],
    }, cardOpts);
  } else {
    const payload = buildItemTooltipPayload(def, contentItem, 0, context, { heroClass });
    applySidebarTooltipCard(el, payload, cardOpts);
  }
  el.classList.remove("hidden");
  syncPrepTooltipDockVisibility();
  const boundsKind = context === "shop" ? "shop"
    : context === "bench" ? "bench"
      : context === "field" || context === "inventory" ? "field"
        : "viewport";
  positionSidebarTooltip(clientX, clientY, boundsKind, context);
  if (shouldUsePrepTooltipDock(context)) {
    requestAnimationFrame(() => {
      positionPrepTooltipDock();
      syncPrepTooltipDockVisibility();
    });
  }
}

function showSidebarTooltip(e, itemId, contentItem, context = "shop") {
  showSidebarTooltipAt(e.clientX, e.clientY, itemId, contentItem, context, e.currentTarget, { pinned: true });
}

function moveSidebarTooltip(e, boundsKind = "viewport", placement = "auto") {
  if (shouldUsePrepTooltipDock(placement)) {
    positionPrepTooltipDock();
    syncPrepTooltipDockVisibility();
    return;
  }
  positionSidebarTooltip(e.clientX, e.clientY, boundsKind, placement);
}

function bindPointerTapTooltip(el, onTapAt) {
  if (!el || el.dataset.pointerTapTooltipBound === "1") return;
  el.dataset.pointerTapTooltipBound = "1";
  let activePointer = null;
  const captureOpts = { capture: true };

  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    activePointer = e.pointerId;
    const shownNow = armPointerTapTooltip(
      e.clientX,
      e.clientY,
      () => onTapAt(e.clientX, e.clientY),
      { pointerType: e.pointerType, allowMouse: true },
    );
    if (shownNow) activePointer = null;
  }, captureOpts);
  el.addEventListener("pointerup", (e) => {
    if (activePointer == null || e.pointerId !== activePointer) return;
    activePointer = null;
    // Палец показывает tooltip на down; мышь/стилус — на up.
    if (typeof isFatFingerPointerType === "function"
      ? isFatFingerPointerType(e.pointerType)
      : e.pointerType === "touch") return;
    finishTouchTapGesture(e.clientX, e.clientY);
  }, captureOpts);
  el.addEventListener("pointercancel", () => {
    activePointer = null;
    clearTouchTapGesture();
  }, captureOpts);
}

function tryShowPrepPointerTapTooltip(clientX, clientY) {
  if (!isTouchUi() || phase !== "prep" || gameOver || !prepTooltipsEnabled) return false;
  if (dragPayload || shopDidDrag) return false;

  const tip = document.getElementById("sidebar-tooltip");
  const tipAlreadyVisible = tip && !tip.classList.contains("hidden") && sidebarTooltipPinned;

  if (pendingShopDrag) {
    const dx = clientX - pendingShopDrag.startX;
    const dy = clientY - pendingShopDrag.startY;
    if (Math.hypot(dx, dy) < getPrepDragCommitThresholdPx()) {
      const { index, side } = pendingShopDrag;
      const st = getSideState(side);
      const entry = st.shop[index];
      const card = document.querySelector(`.shop-card[data-index="${index}"]`);
      if (entry && card && !card.classList.contains("empty")) {
        pendingShopDrag = null;
        syncUiDragState();
        if (tipAlreadyVisible && sidebarTooltipSource === "shop") return true;
        showSidebarTooltipAt(clientX, clientY, entry, null, "shop", card, { pinned: true });
        return true;
      }
    }
  }

  if (pendingBenchDrag) {
    const dx = clientX - pendingBenchDrag.startX;
    const dy = clientY - pendingBenchDrag.startY;
    if (Math.hypot(dx, dy) < getPrepDragCommitThresholdPx()) {
      const { index, side } = pendingBenchDrag;
      const st = getSideState(side);
      const entry = st.bench[index];
      const card = resolveBenchCardElement(side, index)
        || document.querySelector(`#bench-slots .bench-card[data-bench="${index}"]`);
      if (entry && card && !card.classList.contains("empty")) {
        pendingBenchDrag = null;
        syncUiDragState();
        if (tipAlreadyVisible && sidebarTooltipSource === "bench") return true;
        showSidebarTooltipAt(clientX, clientY, entry.itemId, entry, "bench", card, { pinned: true });
        return true;
      }
    }
  }

  if (pendingCanvasPick) {
    const dx = clientX - pendingCanvasPick.clientX;
    const dy = clientY - pendingCanvasPick.clientY;
    if (Math.hypot(dx, dy) < getPrepDragCommitThresholdPx()) {
      pendingCanvasPick = null;
      updatePointerFromClient(clientX, clientY);
      updateTooltip(mousePos.x, mousePos.y);
      return true;
    }
  }

  return false;
}

function bindItemTooltipEvents(el, itemId, contentItem, context = "shop") {
  if (!itemId || !el) return;
  if (el.dataset.itemTooltipBound === "1") return;
  el.dataset.itemTooltipBound = "1";

  bindPointerTapTooltip(el, (clientX, clientY) => {
    if (!prepTooltipsEnabled) return;
    const liveItemId = el.dataset.itemId || itemId;
    if (!liveItemId) return;
    showSidebarTooltipAt(clientX, clientY, liveItemId, contentItem, context, el, { pinned: true });
  });

  if (context === "shop" || context === "bench" || context === "field" || context === "inventory") {
    el.style.cursor = "pointer";
  }
  if (typeof bindItemEmojiSparklePointer === "function") {
    bindItemEmojiSparklePointer(el);
  }
}

window.positionPrepTooltipDock = positionPrepTooltipDock;
window.getPrepHeroGridTooltipZone = getPrepHeroGridTooltipZone;
window.getPrepHeroPortraitTooltipZone = getPrepHeroPortraitTooltipZone;
window.syncPrepTooltipDockVisibility = syncPrepTooltipDockVisibility;
window.isLivePrepSession = isLivePrepSession;
window.bindPointerTapTooltip = bindPointerTapTooltip;
window.tryShowPrepStorageTooltip = tryShowPrepStorageTooltip;
window.isPointerOverPrepStorage = isPointerOverPrepStorage;
