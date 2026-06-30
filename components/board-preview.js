/**
 * Превью стола (инвентарь + синергии) для экрана итогов забега.
 */

function escapeBoardPreviewHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cloneBoardContainer(container) {
  return {
    uid: container.uid,
    itemId: container.itemId,
    col: container.col,
    row: container.row,
    rotation: container.rotation || 0,
  };
}

function captureRunEndBoardSnapshot() {
  return {
    player: {
      containers: playerContainers.map(cloneBoardContainer),
      items: playerItems.map(clonePrepBattleItem),
      classId: playerClass,
    },
    enemy: {
      containers: enemyContainers.map(cloneBoardContainer),
      items: enemyItems.map(clonePrepBattleItem),
      classId: enemyClass,
    },
  };
}

function getBoardTeamLabel(team, snapshot) {
  const side = snapshot?.[team];
  const className = CLASS_CATALOG[side?.classId]?.name;
  if (team === "player") {
    const name = typeof getPlayerProfileName === "function" ? getPlayerProfileName() : "Вы";
    return className ? `🧑 ${name} · ${className}` : `🧑 ${name}`;
  }
  const enemyName = typeof getEnemyDisplayName === "function" ? getEnemyDisplayName() : "ИИ";
  const prefix = enemyName === "Игрок 2" ? "🧑" : "🤖";
  return className ? `${prefix} ${enemyName} · ${className}` : `${prefix} ${enemyName}`;
}

function buildBoardPreviewCellMap(containers, items) {
  const synergyKeys = new Set();
  collectActiveSynergies(items).forEach((syn) => {
    syn.itemUids.forEach((uid) => {
      const item = items.find((i) => i.uid === uid);
      if (!item) return;
      getItemCells(item).forEach(([c, r]) => synergyKeys.add(`${c},${r}`));
    });
  });

  const cells = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const key = `${col},${row}`;
      const isSlot = isSlotCell(containers, col, row);
      let containerDef = null;
      for (const container of containers) {
        if (getItemCells(container).some(([c, r]) => c === col && r === row)) {
          containerDef = ITEM_CATALOG[container.itemId];
          break;
        }
      }
      let itemDef = null;
      let isAnchor = false;
      let itemUid = null;
      for (const item of items) {
        if (!getItemCells(item).some(([c, r]) => c === col && r === row)) continue;
        itemDef = ITEM_CATALOG[item.itemId];
        isAnchor = item.col === col && item.row === row;
        if (isAnchor) itemUid = item.uid;
        break;
      }
      cells.push({
        col,
        row,
        isSlot,
        containerDef,
        itemDef,
        isAnchor,
        itemUid,
        synergy: synergyKeys.has(key),
      });
    }
  }
  return cells;
}

function renderBoardPreviewGrid(containers, items, team, options = {}) {
  const cells = buildBoardPreviewCellMap(containers, items);
  const teamClass = team === "player" ? "bp-team-player" : "bp-team-enemy";
  const activeUids = options.activeUids instanceof Set ? options.activeUids : null;
  return `<div class="bp-grid-wrap ${teamClass}">
    <div class="bp-grid" style="--bp-cols:${GRID_COLS}; --bp-rows:${GRID_ROWS};">
      ${cells.map((cell) => {
        const classes = [
          "bp-cell",
          cell.isSlot ? "bp-slot" : "bp-void",
          cell.synergy ? "bp-synergy" : "",
          cell.itemDef ? "bp-has-item" : "",
          activeUids && cell.itemUid && activeUids.has(cell.itemUid) ? "bp-cell-active" : "",
        ].filter(Boolean).join(" ");
        const style = cell.itemDef
          ? `--bp-fill:${cell.itemDef.color}`
          : cell.containerDef
            ? `--bp-fill:${cell.containerDef.color}`
            : "";
        const uidAttr = cell.itemUid ? ` data-item-uid="${escapeBoardPreviewHtml(cell.itemUid)}"` : "";
        const icon = cell.isAnchor && cell.itemDef
          ? `<span class="bp-icon" title="${escapeBoardPreviewHtml(cell.itemDef.name)}">${cell.itemDef.icon}</span>`
          : "";
        return `<div class="${classes}" style="${style}"${uidAttr}>${icon}</div>`;
      }).join("")}
    </div>
  </div>`;
}

function renderBoardPreviewSynergies(items) {
  const synergies = collectActiveSynergies(items);
  if (!synergies.length) {
    return '<p class="bp-synergies-empty">Активных синергий нет</p>';
  }
  return `<div class="bp-synergy-chips">${synergies.map((syn, i) => {
    const strengthClass = syn.strength === "strong" ? " synergy-chip-strong" : " synergy-chip-weak";
    const icons = (syn.icons || []).map((icon) =>
      `<span class="synergy-chip-icon">${icon}</span>`,
    ).join("");
    const label = escapeBoardPreviewHtml((syn.names || []).join(" + "));
    return `<button type="button" class="synergy-chip${strengthClass}" data-bp-synergy-idx="${i}" aria-label="Синергия: ${label}"><span class="synergy-chip-glow" aria-hidden="true"></span><span class="synergy-chip-content">${icons}</span></button>`;
  }).join("")}</div>`;
}

function bindBoardPreviewSynergyTooltips(items) {
  const synergies = collectActiveSynergies(items);
  const container = document.getElementById("board-preview-synergies");
  if (!container) return;
  container.querySelectorAll("[data-bp-synergy-idx]").forEach((chip) => {
    const synergy = synergies[+chip.dataset.bpSynergyIdx];
    if (!synergy) return;
    chip.addEventListener("mouseenter", (e) => showSynergyTooltip(e, synergy));
    chip.addEventListener("mousemove", moveSidebarTooltip);
    chip.addEventListener("mouseleave", hideSynergyTooltip);
  });
}

function showBoardPreviewPopup(team, snapshot) {
  const overlay = document.getElementById("board-preview-overlay");
  const titleEl = document.getElementById("board-preview-title");
  const gridEl = document.getElementById("board-preview-grid");
  const synergiesEl = document.getElementById("board-preview-synergies");
  const side = snapshot?.[team];
  if (!overlay || !side) return;

  titleEl.textContent = getBoardTeamLabel(team, snapshot);
  gridEl.innerHTML = renderBoardPreviewGrid(side.containers, side.items, team);
  synergiesEl.innerHTML = renderBoardPreviewSynergies(side.items);
  bindBoardPreviewSynergyTooltips(side.items);
  overlay.classList.remove("hidden");
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}

function hideBoardPreviewPopup() {
  hideSynergyTooltip();
  document.getElementById("board-preview-overlay")?.classList.add("hidden");
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}

function isBoardPreviewOpen() {
  return isPopupOpen("board-preview-overlay");
}

function bindBoardPreviewButtons(containerEl, snapshot) {
  if (!containerEl || !snapshot) return;
  containerEl.querySelectorAll(".btn-show-board").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const team = btn.dataset.boardTeam;
      if (team === "player" || team === "enemy") {
        showBoardPreviewPopup(team, snapshot);
      }
    });
  });
}

function initBoardPreviewControls() {
  document.getElementById("btn-board-preview-close")?.addEventListener("click", hideBoardPreviewPopup);
  document.getElementById("board-preview-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "board-preview-overlay") hideBoardPreviewPopup();
  });
}
