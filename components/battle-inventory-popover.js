/**
 * Live-попап инвентаря по тапу на портрет в battle/replay.
 * position: fixed на document.body — вне ResizeObserver ui-layout.
 * Оба героя могут быть открыты одновременно.
 */

const BattleInventoryPopover = (() => {
  const TEAMS = ["player", "enemy"];
  const BODY_CACHE_MAX = 20;
  const LOADING_BODY_HTML = `
    <div class="battle-inventory-popover__loading" aria-hidden="true">
      <div class="battle-inventory-popover__loading-grid"></div>
      <div class="battle-inventory-popover__loading-line"></div>
      <div class="battle-inventory-popover__loading-line battle-inventory-popover__loading-line--short"></div>
    </div>`;
  /** @type {Map<string, HTMLElement>} */
  const popoverEls = new Map();
  /** @type {Map<string, string>} */
  const lastRenderSig = new Map();
  /** @type {Map<string, string>} */
  const lastFlashSig = new Map();
  /** @type {Map<string, { title: string, html: string }>} */
  const bodyHtmlCache = new Map();
  let listenersBound = false;
  let lastTouchAt = 0;
  let lastFlashSyncAt = 0;
  let prewarmQueued = false;

  function isLiveBattlePhase() {
    return phase === "battle" || phase === "replay";
  }

  function isLobbySpectateLive() {
    return typeof isAnyLobbyMode === "function" && isAnyLobbyMode()
      && typeof lobbyMatches !== "undefined" && lobbyMatches?.length > 0
      && typeof lobbyState !== "undefined" && !!lobbyState;
  }

  function resolveLobbySpectateFighter(team) {
    if (!isLobbySpectateLive()) return null;
    const match = lobbyMatches[lobbySpectateMatchId];
    if (!match || match.byeFighterId) return null;
    const fighterId = team === "player" ? match.fighterAId : match.fighterBId;
    return lobbyState.fighters[fighterId] || null;
  }

  function ensurePopoverEl(team) {
    if (popoverEls.has(team)) return popoverEls.get(team);
    const el = document.createElement("div");
    el.id = `battle-inventory-popover-${team}`;
    el.className = "battle-inventory-popover hidden";
    el.dataset.team = team;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "false");
    el.innerHTML = `
      <div class="battle-inventory-popover__head">
        <h4 class="battle-inventory-popover__title"></h4>
        <button type="button" class="battle-inventory-popover__close" aria-label="Закрыть">×</button>
      </div>
      <div class="battle-inventory-popover__body"></div>
    `;
    document.body.appendChild(el);
    el.querySelector(".battle-inventory-popover__close")
      ?.addEventListener("click", (e) => {
        e.stopPropagation();
        closeBattleInventoryPopover(team);
      });
    el.addEventListener("click", (e) => e.stopPropagation());
    popoverEls.set(team, el);
    return el;
  }

  function isTeamPopoverOpen(team) {
    const el = popoverEls.get(team);
    return !!(el && !el.classList.contains("hidden"));
  }

  function getOpenTeams() {
    return TEAMS.filter((team) => isTeamPopoverOpen(team));
  }

  function getTooltipBounds() {
    const vv = window.visualViewport;
    const left = vv?.offsetLeft ?? 0;
    const top = vv?.offsetTop ?? 0;
    const width = vv?.width ?? window.innerWidth;
    const height = vv?.height ?? window.innerHeight;
    return {
      left: left + 8,
      top: top + 8,
      right: left + width - 8,
      bottom: top + height - 8,
      width,
      height,
    };
  }

  function getActiveBattleState() {
    if (typeof getDisplayBattleState === "function") {
      return getDisplayBattleState() || battleState;
    }
    return battleState;
  }

  function getLiveSideData(team) {
    const state = getActiveBattleState();
    if (!state || !state[team]) return null;

    const lobbyFighter = resolveLobbySpectateFighter(team);
    if (lobbyFighter) {
      return {
        team,
        scopeKey: `lobby:${lobbySpectateMatchId}`,
        containers: lobbyFighter.containers,
        items: state[team].items || [],
        classId: lobbyFighter.classId,
        displayName: lobbyFighter.name,
      };
    }

    return {
      team,
      scopeKey: "solo",
      containers: team === "player" ? playerContainers : enemyContainers,
      items: state[team].items || [],
      classId: team === "player" ? playerClass : enemyClass,
      displayName: null,
    };
  }

  function getTeamTitle(team, classId, data = null) {
    const className = CLASS_CATALOG[classId]?.name;
    if (data?.displayName) {
      return className ? `${data.displayName} · ${className}` : data.displayName;
    }
    if (team === "player") {
      const name = typeof getPlayerProfileName === "function" ? getPlayerProfileName() : "Вы";
      return className ? `${name} · ${className}` : name;
    }
    const enemyName = typeof getEnemyDisplayName === "function" ? getEnemyDisplayName() : "ИИ";
    return className ? `${enemyName} · ${className}` : enemyName;
  }

  function collectActiveItemUids(team) {
    const active = new Set();
    const state = getActiveBattleState();
    if (!state || typeof isItemFlashing !== "function") return active;
    const items = state[team]?.items || [];
    items.forEach((item) => {
      if (isItemFlashing(state, item.uid)) active.add(item.uid);
    });
    return active;
  }

  function buildRenderSignature(data) {
    if (!data) return "";
    const parts = data.items.map((item) => {
      const rt = item.runtime || {};
      const syn = (rt.activeSynergies || []).length;
      return `${item.uid}:${item.itemId}:${item.col},${item.row},${item.rotation || 0}:${syn}`;
    });
    return `${data.scopeKey || "solo"}|${data.team}|${parts.join(";")}`;
  }

  function computeSideBackpackPower(data) {
    if (!data || typeof computeBackpackPower !== "function") {
      return { score: 0, itemCount: 0, tier: { label: "—", className: "" } };
    }
    return computeBackpackPower(data.containers, data.items, data.classId);
  }

  function buildPopoverBodyHTML(data, team) {
    const backpackPower = computeSideBackpackPower(data);
    const powerHtml = typeof renderBackpackPowerStatHTML === "function"
      ? renderBackpackPowerStatHTML(backpackPower, "battle-inventory-popover__bp")
      : `<span class="battle-inventory-popover__power-value">${backpackPower.score ?? 0}</span>`;
    return `
      ${renderBoardPreviewGrid(data.containers, data.items, team, { activeUids: null })}
      <div class="battle-inventory-popover__power">
        <span class="battle-inventory-popover__power-label">Сила рюкзака</span>
        ${powerHtml}
      </div>
      <div class="board-preview-section-title">Активные синергии</div>
      <div class="battle-inventory-popover__synergies">${renderBoardPreviewSynergies(data.items)}</div>
    `;
  }

  function trimBodyCache() {
    while (bodyHtmlCache.size > BODY_CACHE_MAX) {
      const first = bodyHtmlCache.keys().next().value;
      bodyHtmlCache.delete(first);
    }
  }

  function rememberBodyCache(data, team, payload) {
    bodyHtmlCache.set(buildRenderSignature(data), payload);
    trimBodyCache();
  }

  function getFlashSyncGapMs() {
    if (typeof window.BattleFxTier?.isLightBattleFx === "function" && window.BattleFxTier.isLightBattleFx()) {
      return 100;
    }
    return 50;
  }

  function collectActiveFlashSignature(team) {
    const active = collectActiveItemUids(team);
    if (!active.size) return "";
    return [...active].sort().join(",");
  }

  function bindPopoverCellTooltips(team, data) {
    const el = popoverEls.get(team);
    const bodyEl = el?.querySelector(".battle-inventory-popover__body");
    if (!bodyEl || !data || typeof bindItemTooltipEvents !== "function") return;
    if (bodyEl.dataset.tooltipsBound === "1") return;
    bodyEl.dataset.tooltipsBound = "1";

    bodyEl.querySelectorAll(".bp-cell.bp-has-item[data-item-id]").forEach((cell) => {
      const itemId = cell.dataset.itemId;
      if (!itemId) return;
      const item = data.items.find((i) => i.uid === cell.dataset.itemUid)
        || data.items.find((i) => i.itemId === itemId);
      bindItemTooltipEvents(cell, itemId, item || null, "inventory");
    });
  }

  function clearPopoverBody(team) {
    const el = popoverEls.get(team);
    const bodyEl = el?.querySelector(".battle-inventory-popover__body");
    if (!bodyEl) return;
    bodyEl.innerHTML = "";
    delete bodyEl.dataset.tooltipsBound;
  }

  function applyPopoverContent(team, data, bodyHtml, titleText) {
    const el = ensurePopoverEl(team);
    const titleEl = el.querySelector(".battle-inventory-popover__title");
    const bodyEl = el.querySelector(".battle-inventory-popover__body");
    if (!titleEl || !bodyEl) return;

    titleEl.textContent = titleText;
    delete bodyEl.dataset.tooltipsBound;
    bodyEl.innerHTML = bodyHtml;
    lastRenderSig.set(team, buildRenderSignature(data));
    lastFlashSig.delete(team);
    bindPopoverCellTooltips(team, data);
    syncActiveCellHighlights(team, true);
    el.classList.remove("battle-inventory-popover--loading");
  }

  function renderPopoverContent(team) {
    const data = getLiveSideData(team);
    if (!data) return;
    const titleText = `Рюкзак · ${getTeamTitle(team, data.classId, data)}`;
    const bodyHtml = buildPopoverBodyHTML(data, team);
    rememberBodyCache(data, team, { title: titleText, html: bodyHtml });
    applyPopoverContent(team, data, bodyHtml, titleText);
  }

  function showPopoverLoading(team) {
    const el = ensurePopoverEl(team);
    const titleEl = el.querySelector(".battle-inventory-popover__title");
    const bodyEl = el.querySelector(".battle-inventory-popover__body");
    if (!titleEl || !bodyEl) return;
    el.classList.add("battle-inventory-popover--loading");
    titleEl.textContent = "Рюкзак · …";
    bodyEl.innerHTML = LOADING_BODY_HTML;
    delete bodyEl.dataset.tooltipsBound;
  }

  function schedulePopoverRender(team) {
    const run = () => {
      const el = popoverEls.get(team);
      if (!el || el.classList.contains("hidden")) return;

      const data = getLiveSideData(team);
      if (!data) {
        closeBattleInventoryPopover(team);
        return;
      }

      const cacheKey = buildRenderSignature(data);
      const cached = bodyHtmlCache.get(cacheKey);
      if (cached) {
        applyPopoverContent(team, data, cached.html, cached.title);
      } else {
        renderPopoverContent(team);
      }
      positionPopover(team);
    };

    requestAnimationFrame(() => {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(run, { timeout: 60 });
      } else {
        run();
      }
    });
  }

  function getPortraitPanelEl(team) {
    return document.getElementById(team === "player" ? "player-avatar-panel" : "enemy-avatar-panel");
  }

  function getPrepCharacterClickRect(team) {
    const root = document.documentElement;
    if (root.dataset.battlePrepHeroLayer !== "true") return null;
    const charEl = document.getElementById(team === "enemy" ? "prep-character-enemy" : "prep-character-player");
    if (!charEl || charEl.hasAttribute("hidden")) return null;
    const visual = charEl.querySelector(".prep-character-img, .prep-character-emoji") || charEl;
    const rect = visual.getBoundingClientRect();
    return rect.width >= 48 && rect.height >= 48 ? rect : null;
  }

  function getPortraitAnchorRect(team) {
    const prepRect = getPrepCharacterClickRect(team);
    const panel = getPortraitPanelEl(team);
    const panelRect = panel?.getBoundingClientRect();
    if (prepRect) {
      return {
        left: panelRect?.left ?? prepRect.left,
        right: panelRect?.right ?? prepRect.right,
        top: prepRect.top,
        bottom: prepRect.bottom,
        width: panelRect?.width ?? prepRect.width,
        height: prepRect.height,
      };
    }

    const stageRect = typeof getAvatarHeroStageRect === "function"
      ? getAvatarHeroStageRect(team)
      : null;
    if (!stageRect?.width || !panelRect?.width) return stageRect;
    return {
      left: panelRect.left,
      right: panelRect.right,
      top: stageRect.top,
      bottom: stageRect.bottom,
      width: panelRect.width,
      height: Math.max(0, stageRect.bottom - stageRect.top),
    };
  }

  function getPopoverMaxWidth() {
    const uiScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-scale")) || 1;
    const tier = document.documentElement.dataset.uiTier || "";
    const w = window.innerWidth;
    if (tier === "phone" || w < 520) {
      return Math.round(Math.min(196 * uiScale, w - 24));
    }
    if (tier === "tablet" || w < 960) {
      return Math.round(Math.min(228 * uiScale, w * 0.34));
    }
    return Math.round(Math.min(268 * uiScale, 320));
  }

  function shouldUseDockLayout() {
    if (shouldUseFlankColumnDock()) return true;
    const tier = document.documentElement.dataset.uiTier || "";
    if (tier === "phone" || tier === "tablet") return true;
    return window.innerWidth < 980;
  }

  function shouldUseFlankColumnDock() {
    const root = document.documentElement;
    return root.dataset.battleHeroPlacement === "flank-arena"
      && root.dataset.battleArenaLayout === "true";
  }

  function readRootCssPx(name, fallback = 0) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function getHeroColumnViewportRect(team, bounds, chromeInset) {
    const objectsLayer = document.getElementById("layer-objects");
    const layoutRect = objectsLayer?.getBoundingClientRect();
    if (!layoutRect || layoutRect.width <= 0) return null;

    const zoneLeftVar = team === "enemy" ? "--battle-enemy-zone-left" : "--battle-player-zone-left";
    const zoneWidthVar = team === "enemy" ? "--battle-enemy-zone-width" : "--battle-player-zone-width";
    const zoneLeft = readRootCssPx(zoneLeftVar, 0);
    const zoneW = readRootCssPx(zoneWidthVar, 180);
    const left = layoutRect.left + zoneLeft;
    const right = left + zoneW;

    const prepRect = document.documentElement.dataset.battlePrepHeroLayer === "true"
      && typeof window.measureBattlePrepHeroRect === "function"
      ? window.measureBattlePrepHeroRect(team)
      : null;
    if (prepRect && prepRect.height >= 48) {
      return {
        left,
        right,
        top: Math.max(bounds.top + 8, bounds.top),
        bottom: prepRect.bottom - 8,
        width: right - left,
        height: Math.max(96, prepRect.bottom - bounds.top - 16),
      };
    }

    const heroRowTop = readRootCssPx("--battle-hero-row-top", 0);
    const sceneUi = document.getElementById("battle-scene-ui");
    const sceneTop = sceneUi?.getBoundingClientRect().top ?? bounds.top;
    const top = Math.max(bounds.top + 8, sceneTop + heroRowTop);
    const bottom = bounds.bottom - chromeInset - 8;

    if (right - left < 80 || bottom - top < 96) return null;

    return { left, right, top, bottom, width: right - left, height: bottom - top };
  }

  function shouldSinglePopoverMode() {
    // В live-бою оба рюкзака можно держать открытыми; в replay — один (компактнее).
    return phase === "replay";
  }

  function getBottomChromeInset() {
    const chrome = document.getElementById("bottom-chrome");
    if (!chrome || chrome.classList.contains("hidden")) return 12;
    const rect = chrome.getBoundingClientRect();
    if (!rect.height) return 12;
    return Math.max(12, window.innerHeight - rect.top + 8);
  }

  function applyPopoverWidth(el) {
    const maxW = getPopoverMaxWidth();
    el.style.width = `${maxW}px`;
    el.style.maxWidth = `${maxW}px`;
  }

  function positionPopoverDock(team, el, bounds) {
    const margin = 8;
    const chromeInset = getBottomChromeInset();
    applyPopoverWidth(el);

    el.style.visibility = "hidden";
    el.style.left = "-9999px";
    el.style.top = "0";
    const tipW = el.offsetWidth;

    const colRect = shouldUseFlankColumnDock()
      ? getHeroColumnViewportRect(team, bounds, chromeInset)
      : null;

    let left;
    if (colRect) {
      left = team === "enemy"
        ? colRect.right - tipW - margin
        : colRect.left + margin;
      left = Math.max(colRect.left + margin, Math.min(left, colRect.right - tipW - margin));
    } else {
      left = team === "enemy"
        ? bounds.right - tipW - margin
        : bounds.left + margin;
      left = Math.max(bounds.left + margin, Math.min(left, bounds.right - tipW - margin));
    }

    const openCount = getOpenTeams().length;
    const colHeight = colRect?.height ?? (bounds.bottom - bounds.top - chromeInset - margin * 2);
    if (openCount >= 2) {
      const sharedMax = Math.floor(colHeight * 0.42);
      el.style.maxHeight = `${Math.max(108, sharedMax)}px`;
    } else {
      el.style.removeProperty("max-height");
    }

    let tipH = el.offsetHeight;
    let top;
    if (colRect) {
      top = colRect.bottom - tipH - margin;
      top = Math.max(colRect.top + margin, Math.min(top, colRect.bottom - tipH - margin));
    } else {
      top = bounds.bottom - tipH - chromeInset;
      top = Math.max(bounds.top + margin, Math.min(top, bounds.bottom - tipH - margin));
    }

    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
    el.style.visibility = "";
    el.classList.add("battle-inventory-popover--dock");
    el.classList.toggle("battle-inventory-popover--flank-col", !!colRect);
  }

  function positionPopoverAnchor(team, el, rect, bounds) {
    const margin = 10;
    const gap = 8;
    applyPopoverWidth(el);

    el.style.visibility = "hidden";
    el.style.left = "-9999px";
    el.style.top = "0";
    const tipW = el.offsetWidth;
    const tipH = el.offsetHeight;

    let left = team === "enemy" ? rect.right - tipW : rect.left;
    let top = rect.bottom + gap;

    if (top + tipH > bounds.bottom - getBottomChromeInset()) {
      top = rect.top - tipH - gap;
    }
    if (top < bounds.top + margin) {
      top = bounds.top + margin;
    }

    left = Math.max(bounds.left + margin, Math.min(left, bounds.right - tipW - margin));
    top = Math.max(bounds.top + margin, Math.min(top, bounds.bottom - tipH - margin));

    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
    el.style.visibility = "";
    el.classList.remove("battle-inventory-popover--dock");
  }

  function positionPopover(team) {
    const el = ensurePopoverEl(team);
    if (el.classList.contains("hidden")) return;

    const rect = getPortraitAnchorRect(team);
    if (!rect || !rect.width) return;

    const bounds = getTooltipBounds();
    el.classList.toggle("battle-inventory-popover--compact", shouldUseDockLayout());
    el.classList.toggle("battle-inventory-popover--replay", phase === "replay");

    if (shouldUseDockLayout()) {
      positionPopoverDock(team, el, bounds);
      return;
    }

    positionPopoverAnchor(team, el, rect, bounds);
  }

  function isBattleInventoryPopoverOpen() {
    return getOpenTeams().length > 0;
  }

  function closeBattleInventoryPopover(team = null) {
    const teams = team ? [team] : getOpenTeams();
    if (!teams.length) return;

    teams.forEach((side) => {
      const el = popoverEls.get(side);
      if (!el || el.classList.contains("hidden")) return;
      el.classList.add("hidden");
      el.classList.remove("battle-inventory-popover--loading", "battle-inventory-popover--dock", "battle-inventory-popover--compact", "battle-inventory-popover--replay");
      el.style.removeProperty("width");
      el.style.removeProperty("max-width");
      el.style.removeProperty("max-height");
      el.setAttribute("aria-hidden", "true");
      lastRenderSig.delete(side);
      lastFlashSig.delete(side);
      clearPopoverBody(side);
    });

    const stillOpen = getOpenTeams();
    if (stillOpen.length) {
      requestAnimationFrame(() => stillOpen.forEach((side) => positionPopover(side)));
    }

    if (typeof refreshGamepadHints === "function") refreshGamepadHints();
  }

  function syncActiveCellHighlights(team, force = false) {
    const el = popoverEls.get(team);
    if (!el || el.classList.contains("hidden")) return;
    const flashSig = collectActiveFlashSignature(team);
    if (!force && flashSig === lastFlashSig.get(team)) return;
    lastFlashSig.set(team, flashSig);
    const activeUids = collectActiveItemUids(team);
    el.querySelectorAll(".bp-cell[data-item-uid]").forEach((cell) => {
      const uid = cell.dataset.itemUid;
      cell.classList.toggle("bp-cell-active", activeUids.has(uid));
    });
  }

  function openBattleInventoryPopover(team) {
    if (!isLiveBattlePhase() || !getLiveSideData(team)) return;
    if (typeof hideSidebarTooltip === "function") hideSidebarTooltip();
    if (shouldSinglePopoverMode()) {
      const other = team === "player" ? "enemy" : "player";
      if (isTeamPopoverOpen(other)) closeBattleInventoryPopover(other);
    }
    const el = ensurePopoverEl(team);
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
    showPopoverLoading(team);
    schedulePopoverRender(team);
    requestAnimationFrame(() => {
      getOpenTeams().forEach((side) => positionPopover(side));
    });
    if (typeof refreshGamepadHints === "function") refreshGamepadHints();
  }

  function toggleBattleInventoryPopover(team) {
    if (isTeamPopoverOpen(team)) {
      closeBattleInventoryPopover(team);
      return;
    }
    openBattleInventoryPopover(team);
  }

  function resolveTeamFromPortraitTarget(target) {
    if (!target?.closest) return null;

    if (document.documentElement.dataset.battlePrepHeroLayer === "true") {
      if (target.closest("#prep-character-player, #prep-character-player .prep-character-img, #prep-character-player .prep-character-emoji")) {
        return "player";
      }
      if (target.closest("#prep-character-enemy, #prep-character-enemy .prep-character-img, #prep-character-enemy .prep-character-emoji")) {
        return "enemy";
      }
      if (target.closest("#player-avatar-panel")) return "player";
      if (target.closest("#enemy-avatar-panel")) return "enemy";
    }

    const avatar = target.closest(".profile-avatar");
    if (!avatar) return null;
    if (avatar.closest("#player-avatar-slot")) return "player";
    if (avatar.closest("#enemy-avatar-slot")) return "enemy";
    return null;
  }

  function onPortraitActivate(e) {
    if (!isLiveBattlePhase()) return;
    const team = resolveTeamFromPortraitTarget(e.target);
    if (!team) return;
    e.preventDefault();
    e.stopPropagation();
    toggleBattleInventoryPopover(team);
  }

  function onPortraitTouchEnd(e) {
    if (!isLiveBattlePhase()) return;
    const team = resolveTeamFromPortraitTarget(e.target);
    if (!team) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    lastTouchAt = Date.now();
    toggleBattleInventoryPopover(team);
  }

  function onPortraitClick(e) {
    if (Date.now() - lastTouchAt < 450) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onPortraitActivate(e);
  }

  function onDocumentPointerDown(e) {
    const openTeams = getOpenTeams();
    if (!openTeams.length) return;

    if (resolveTeamFromPortraitTarget(e.target)) return;

    for (const team of openTeams) {
      const el = popoverEls.get(team);
      if (el?.contains(e.target)) return;
    }

    closeBattleInventoryPopover();
  }

  function onReposition() {
    getOpenTeams().forEach((team) => positionPopover(team));
  }

  function refreshTeamPopover(team) {
    if (!isTeamPopoverOpen(team)) return;
    if (!isLiveBattlePhase()) {
      closeBattleInventoryPopover(team);
      return;
    }
    const data = getLiveSideData(team);
    if (!data) {
      closeBattleInventoryPopover(team);
      return;
    }
    const sig = buildRenderSignature(data);
    if (sig !== lastRenderSig.get(team)) {
      const cached = bodyHtmlCache.get(sig);
      if (cached) {
        applyPopoverContent(team, data, cached.html, cached.title);
      } else {
        renderPopoverContent(team);
      }
    } else {
      syncActiveCellHighlights(team);
    }
    positionPopover(team);
  }

  function refreshBattleInventoryPopover() {
    getOpenTeams().forEach((team) => refreshTeamPopover(team));
    if (!isLiveBattlePhase() && isBattleInventoryPopoverOpen()) {
      closeBattleInventoryPopover();
    }
  }

  function syncBattleInventoryPopoverFlash() {
    if (!isLiveBattlePhase() || !isBattleInventoryPopoverOpen()) return;
    const now = performance.now();
    if (now - lastFlashSyncAt < getFlashSyncGapMs()) return;
    lastFlashSyncAt = now;
    getOpenTeams().forEach((team) => syncActiveCellHighlights(team));
  }

  function prewarmBattleInventoryPopover() {
    if (!isLiveBattlePhase()) return;
    TEAMS.forEach((team) => {
      const data = getLiveSideData(team);
      if (!data) return;
      const cacheKey = buildRenderSignature(data);
      if (bodyHtmlCache.has(cacheKey)) return;
      const titleText = `Рюкзак · ${getTeamTitle(team, data.classId, data)}`;
      rememberBodyCache(data, team, {
        title: titleText,
        html: buildPopoverBodyHTML(data, team),
      });
    });
  }

  function queuePrewarmBattleInventoryPopover() {
    if (!isLiveBattlePhase() || prewarmQueued) return;
    prewarmQueued = true;
    const run = () => {
      prewarmQueued = false;
      prewarmBattleInventoryPopover();
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, { timeout: 120 });
    } else {
      requestAnimationFrame(run);
    }
  }

  function clearBattleInventoryPopoverCache() {
    bodyHtmlCache.clear();
    lastRenderSig.clear();
    lastFlashSig.clear();
  }

  function initBattleInventoryPopover() {
    if (listenersBound) return;
    listenersBound = true;

    document.addEventListener("click", onPortraitClick, true);
    document.addEventListener("touchend", onPortraitTouchEnd, { passive: false, capture: true });
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    window.addEventListener("resize", onReposition, { passive: true });
    window.visualViewport?.addEventListener("resize", onReposition, { passive: true });
    window.visualViewport?.addEventListener("scroll", onReposition, { passive: true });
  }

  return {
    initBattleInventoryPopover,
    openBattleInventoryPopover,
    closeBattleInventoryPopover,
    toggleBattleInventoryPopover,
    isBattleInventoryPopoverOpen,
    refreshBattleInventoryPopover,
    syncBattleInventoryPopoverFlash,
    prewarmBattleInventoryPopover,
    queuePrewarmBattleInventoryPopover,
    clearBattleInventoryPopoverCache,
  };
})();

function initBattleInventoryPopover() {
  BattleInventoryPopover.initBattleInventoryPopover();
}

function closeBattleInventoryPopover(team) {
  BattleInventoryPopover.closeBattleInventoryPopover(team);
}

function isBattleInventoryPopoverOpen() {
  return BattleInventoryPopover.isBattleInventoryPopoverOpen();
}

function refreshBattleInventoryPopover() {
  BattleInventoryPopover.refreshBattleInventoryPopover();
}

function openBattleInventoryPopover(team) {
  BattleInventoryPopover.openBattleInventoryPopover(team);
}

function toggleBattleInventoryPopover(team) {
  BattleInventoryPopover.toggleBattleInventoryPopover(team);
}

function prewarmBattleInventoryPopover() {
  BattleInventoryPopover.prewarmBattleInventoryPopover();
}

function queuePrewarmBattleInventoryPopover() {
  BattleInventoryPopover.queuePrewarmBattleInventoryPopover();
}

function clearBattleInventoryPopoverCache() {
  BattleInventoryPopover.clearBattleInventoryPopoverCache();
}

window.openBattleInventoryPopover = openBattleInventoryPopover;
window.toggleBattleInventoryPopover = toggleBattleInventoryPopover;
window.prewarmBattleInventoryPopover = prewarmBattleInventoryPopover;

function syncBattleInventoryPopoverFlash() {
  BattleInventoryPopover.syncBattleInventoryPopoverFlash();
}
