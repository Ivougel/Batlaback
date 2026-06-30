/**
 * Live-попап инвентаря по тапу на портрет в battle/replay.
 * position: fixed на document.body — вне ResizeObserver ui-layout.
 * Оба героя могут быть открыты одновременно.
 */

const BattleInventoryPopover = (() => {
  const TEAMS = ["player", "enemy"];
  /** @type {Map<string, HTMLElement>} */
  const popoverEls = new Map();
  /** @type {Map<string, string>} */
  const lastRenderSig = new Map();
  let listenersBound = false;
  let lastTouchAt = 0;

  function isLiveBattlePhase() {
    return phase === "battle" || phase === "replay";
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

  function getLiveSideData(team) {
    if (!battleState || !battleState[team]) return null;
    const containers = team === "player" ? playerContainers : enemyContainers;
    const classId = team === "player" ? playerClass : enemyClass;
    return {
      team,
      containers,
      items: battleState[team].items || [],
      classId,
    };
  }

  function getTeamTitle(team, classId) {
    const className = CLASS_CATALOG[classId]?.name;
    if (team === "player") {
      const name = typeof getPlayerProfileName === "function" ? getPlayerProfileName() : "Вы";
      return className ? `${name} · ${className}` : name;
    }
    const enemyName = typeof getEnemyDisplayName === "function" ? getEnemyDisplayName() : "ИИ";
    return className ? `${enemyName} · ${className}` : enemyName;
  }

  function collectActiveItemUids(team) {
    const active = new Set();
    if (!battleState || typeof isItemFlashing !== "function") return active;
    const items = battleState[team]?.items || [];
    items.forEach((item) => {
      if (isItemFlashing(battleState, item.uid)) active.add(item.uid);
    });
    return active;
  }

  function buildRenderSignature(data) {
    if (!data) return "";
    const parts = data.items.map((item) => {
      const rt = item.runtime || {};
      const syn = (rt.activeSynergies || []).length;
      const cd = item.currentCooldown != null ? item.currentCooldown.toFixed(2) : "-";
      return `${item.uid}:${item.itemId}:${item.col},${item.row},${item.rotation || 0}:${cd}:${syn}`;
    });
    return `${data.team}|${parts.join(";")}`;
  }

  function renderPopoverContent(team) {
    const data = getLiveSideData(team);
    const el = ensurePopoverEl(team);
    const titleEl = el.querySelector(".battle-inventory-popover__title");
    const bodyEl = el.querySelector(".battle-inventory-popover__body");
    if (!data || !titleEl || !bodyEl) return;

    titleEl.textContent = `Рюкзак · ${getTeamTitle(team, data.classId)}`;
    const activeUids = collectActiveItemUids(team);
    bodyEl.innerHTML = `
      ${renderBoardPreviewGrid(data.containers, data.items, team, { activeUids })}
      <div class="board-preview-section-title">Активные синергии</div>
      <div class="battle-inventory-popover__synergies">${renderBoardPreviewSynergies(data.items)}</div>
    `;
    lastRenderSig.set(team, buildRenderSignature(data));
    bindPopoverCellTooltips(team, data);
  }

  function bindPopoverCellTooltips(team, data) {
    const el = popoverEls.get(team);
    if (!el || !data || typeof bindItemTooltipEvents !== "function") return;

    el.querySelectorAll(".bp-cell.bp-has-item[data-item-id]").forEach((cell) => {
      const itemId = cell.dataset.itemId;
      if (!itemId) return;
      const item = data.items.find((i) => i.uid === cell.dataset.itemUid)
        || data.items.find((i) => i.itemId === itemId);
      bindItemTooltipEvents(cell, itemId, item || null, "inventory");
    });
  }

  function getPortraitPanelEl(team) {
    return document.getElementById(team === "player" ? "player-avatar-panel" : "enemy-avatar-panel");
  }

  function getPortraitAnchorRect(team) {
    const panel = getPortraitPanelEl(team);
    const panelRect = panel?.getBoundingClientRect();
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

  function positionPopover(team) {
    const el = ensurePopoverEl(team);
    if (el.classList.contains("hidden")) return;

    const rect = getPortraitAnchorRect(team);
    if (!rect || !rect.width) return;

    const margin = 10;
    const gap = 8;
    const bounds = getTooltipBounds();

    const panelW = Math.min(
      Math.max(rect.width, 156),
      bounds.right - bounds.left - margin * 2,
    );
    el.style.width = `${Math.round(panelW)}px`;

    el.style.visibility = "hidden";
    el.style.left = "-9999px";
    el.style.top = "0";
    const tipW = el.offsetWidth;
    const tipH = el.offsetHeight;

    let left = team === "enemy" ? rect.right - tipW : rect.left;
    let top = rect.top - tipH - gap;

    if (top < bounds.top + margin) {
      top = bounds.top + margin;
    }

    left = Math.max(bounds.left + margin, Math.min(left, bounds.right - tipW - margin));
    top = Math.max(bounds.top + margin, Math.min(top, bounds.bottom - tipH - margin));

    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
    el.style.visibility = "";
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
      el.style.removeProperty("width");
      el.setAttribute("aria-hidden", "true");
      lastRenderSig.delete(side);
    });

    if (typeof refreshGamepadHints === "function") refreshGamepadHints();
  }

  function syncActiveCellHighlights(team) {
    const el = popoverEls.get(team);
    if (!el || el.classList.contains("hidden")) return;
    const activeUids = collectActiveItemUids(team);
    el.querySelectorAll(".bp-cell[data-item-uid]").forEach((cell) => {
      const uid = cell.dataset.itemUid;
      cell.classList.toggle("bp-cell-active", activeUids.has(uid));
    });
  }

  function openBattleInventoryPopover(team) {
    if (!isLiveBattlePhase() || !getLiveSideData(team)) return;
    if (typeof hideSidebarTooltip === "function") hideSidebarTooltip();
    const el = ensurePopoverEl(team);
    renderPopoverContent(team);
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
    positionPopover(team);
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

    // Любой тап по портрету обрабатывается отдельно (toggle), не закрываем остальные.
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
      renderPopoverContent(team);
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
    if (!isLiveBattlePhase()) return;
    getOpenTeams().forEach((team) => syncActiveCellHighlights(team));
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

window.openBattleInventoryPopover = openBattleInventoryPopover;
window.toggleBattleInventoryPopover = toggleBattleInventoryPopover;

function syncBattleInventoryPopoverFlash() {
  BattleInventoryPopover.syncBattleInventoryPopoverFlash();
}
