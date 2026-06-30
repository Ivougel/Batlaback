/**
 * Live-попап инвентаря по тапу на портрет в battle/replay.
 * position: fixed на document.body — вне ResizeObserver ui-layout.
 */

const BattleInventoryPopover = (() => {
  let popoverEl = null;
  let openTeam = null;
  let listenersBound = false;
  let lastTouchAt = 0;
  let lastRenderSig = "";

  function isLiveBattlePhase() {
    return phase === "battle" || phase === "replay";
  }

  function ensurePopoverEl() {
    if (popoverEl) return popoverEl;
    popoverEl = document.createElement("div");
    popoverEl.id = "battle-inventory-popover";
    popoverEl.className = "battle-inventory-popover hidden";
    popoverEl.setAttribute("role", "dialog");
    popoverEl.setAttribute("aria-modal", "false");
    popoverEl.innerHTML = `
      <div class="battle-inventory-popover__head">
        <h4 class="battle-inventory-popover__title" id="battle-inventory-popover-title"></h4>
        <button type="button" class="battle-inventory-popover__close" id="battle-inventory-popover-close" aria-label="Закрыть">×</button>
      </div>
      <div class="battle-inventory-popover__body" id="battle-inventory-popover-body"></div>
    `;
    document.body.appendChild(popoverEl);
    popoverEl.querySelector("#battle-inventory-popover-close")
      ?.addEventListener("click", (e) => {
        e.stopPropagation();
        closeBattleInventoryPopover();
      });
    popoverEl.addEventListener("click", (e) => e.stopPropagation());
    return popoverEl;
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
    const el = ensurePopoverEl();
    const titleEl = el.querySelector("#battle-inventory-popover-title");
    const bodyEl = el.querySelector("#battle-inventory-popover-body");
    if (!data || !titleEl || !bodyEl) return;

    titleEl.textContent = `Рюкзак · ${getTeamTitle(team, data.classId)}`;
    const activeUids = collectActiveItemUids(team);
    bodyEl.innerHTML = `
      ${renderBoardPreviewGrid(data.containers, data.items, team, { activeUids })}
      <div class="board-preview-section-title">Активные синергии</div>
      <div id="battle-inventory-popover-synergies">${renderBoardPreviewSynergies(data.items)}</div>
    `;
    lastRenderSig = buildRenderSignature(data);
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
    const el = ensurePopoverEl();
    if (el.classList.contains("hidden")) return;

    const rect = getPortraitAnchorRect(team);
    if (!rect || !rect.width) return;

    const margin = 10;
    const gap = 8;
    const bounds = getTooltipBounds();

    el.dataset.team = team;
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
    return !!openTeam && popoverEl && !popoverEl.classList.contains("hidden");
  }

  function closeBattleInventoryPopover() {
    if (!openTeam) return;
    openTeam = null;
    lastRenderSig = "";
    const el = ensurePopoverEl();
    el.classList.add("hidden");
    el.removeAttribute("data-team");
    el.style.removeProperty("width");
    el.setAttribute("aria-hidden", "true");
    if (typeof refreshGamepadHints === "function") refreshGamepadHints();
  }

  function syncActiveCellHighlights(team) {
    if (!openTeam || openTeam !== team || !popoverEl || popoverEl.classList.contains("hidden")) return;
    const activeUids = collectActiveItemUids(team);
    popoverEl.querySelectorAll(".bp-cell[data-item-uid]").forEach((cell) => {
      const uid = cell.dataset.itemUid;
      cell.classList.toggle("bp-cell-active", activeUids.has(uid));
    });
  }

  function openBattleInventoryPopover(team) {
    if (!isLiveBattlePhase() || !getLiveSideData(team)) return;
    if (typeof hideSidebarTooltip === "function") hideSidebarTooltip();
    ensurePopoverEl();
    openTeam = team;
    renderPopoverContent(team);
    popoverEl.classList.remove("hidden");
    popoverEl.setAttribute("aria-hidden", "false");
    positionPopover(team);
    if (typeof refreshGamepadHints === "function") refreshGamepadHints();
  }

  function toggleBattleInventoryPopover(team) {
    if (openTeam === team) {
      closeBattleInventoryPopover();
      return;
    }
    closeBattleInventoryPopover();
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
    if (!openTeam || !popoverEl) return;
    if (popoverEl.contains(e.target)) return;
    if (resolveTeamFromPortraitTarget(e.target) === openTeam) return;
    closeBattleInventoryPopover();
  }

  function onReposition() {
    if (!openTeam) return;
    positionPopover(openTeam);
  }

  function refreshBattleInventoryPopover() {
    if (!openTeam || !isLiveBattlePhase()) {
      if (openTeam) closeBattleInventoryPopover();
      return;
    }
    const data = getLiveSideData(openTeam);
    if (!data) {
      closeBattleInventoryPopover();
      return;
    }
    const sig = buildRenderSignature(data);
    if (sig !== lastRenderSig) {
      renderPopoverContent(openTeam);
    } else {
      syncActiveCellHighlights(openTeam);
    }
    positionPopover(openTeam);
  }

  function syncBattleInventoryPopoverFlash() {
    if (!openTeam || !isLiveBattlePhase()) return;
    syncActiveCellHighlights(openTeam);
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

function closeBattleInventoryPopover() {
  BattleInventoryPopover.closeBattleInventoryPopover();
}

function isBattleInventoryPopoverOpen() {
  return BattleInventoryPopover.isBattleInventoryPopoverOpen();
}

function refreshBattleInventoryPopover() {
  BattleInventoryPopover.refreshBattleInventoryPopover();
}

function syncBattleInventoryPopoverFlash() {
  BattleInventoryPopover.syncBattleInventoryPopoverFlash();
}
