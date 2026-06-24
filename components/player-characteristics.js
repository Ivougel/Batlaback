/**
 * Попап «Характеристики» — игрок и противник.
 */

const FIGHTER_CHAR_UI = {
  player: {
    panelId: "player-avatar-panel",
    popupId: "player-characteristics-popup",
    contentId: "player-characteristics-content",
    btnId: "btn-player-stats",
    closeBtnId: "btn-player-char-close",
    titleId: "player-char-title",
    openClass: "player-char-open",
  },
  enemy: {
    panelId: "enemy-avatar-panel",
    popupId: "enemy-characteristics-popup",
    contentId: "enemy-characteristics-content",
    btnId: "btn-enemy-stats",
    closeBtnId: "btn-enemy-char-close",
    titleId: "enemy-char-title",
    openClass: "enemy-char-open",
  },
};

function escapePlayerCharHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildFighterCharacteristicsSummary(state) {
  const battleItems = flattenContainersForBattle(state.containers, state.items);
  const profile = applyProfileIdentity(
    computeCombatProfile(battleItems, state.classId, state.displayName || "Боец"),
    state.classId,
    state.gold,
  );
  const backpackPower = computeBackpackPower(state.containers, state.items, state.classId);
  const showRunStats = state.side !== "enemy";
  const runStats = showRunStats ? computeRunWinrate(state.runResults || []) : { wins: 0, played: 0 };

  return {
    name: profile.name || "Боец",
    className: profile.className || "—",
    gold: profile.gold ?? 0,
    maxHp: profile.hpMax ?? profile.hp ?? 100,
    roundsPlayed: runStats.played,
    wins: runStats.wins,
    backpackPower,
    showRunStats,
  };
}

function renderFighterCharacteristicsHTML(data, side) {
  const bp = data.backpackPower || { score: 0, itemCount: 0, tier: { label: "Слабый", className: "bp-tier-weak" } };
  const bpTier = bp.tier || { label: "—", className: "" };
  const bpHint = bp.itemCount
    ? `${bp.itemCount} предм. на столе · синергии и класс учтены`
    : "Нет предметов на столе";

  const rows = [
    ["Имя", data.name],
    ["Класс", data.className],
    [
      "Backpack Power",
      `<span class="player-char-bp ${escapePlayerCharHtml(bpTier.className)}" title="${escapePlayerCharHtml(bpHint)}"><span class="player-char-bp-score">${bp.score}</span><span class="player-char-bp-tier">${escapePlayerCharHtml(bpTier.label)}</span></span>`,
      true,
    ],
    ["Золото", `${data.gold} 💰`],
    ["Здоровье", `${data.maxHp} ❤️`],
  ];

  if (data.showRunStats) {
    rows.push(["Сыграно раундов", String(data.roundsPlayed)]);
    rows.push(["Побед", String(data.wins)]);
  }

  const ui = FIGHTER_CHAR_UI[side];
  const title = side === "enemy" ? "Противник" : "Характеристики";

  return `
    <div class="player-char-popup-inner">
      <button type="button" class="player-char-close" id="${ui.closeBtnId}" aria-label="Закрыть">×</button>
      <h4 class="player-char-title" id="${ui.titleId}">${escapePlayerCharHtml(title)}</h4>
      <dl class="player-char-list">
        ${rows.map(([label, value, rawHtml]) => `
          <div class="player-char-row${label === "Backpack Power" ? " player-char-row-bp" : ""}">
            <dt>${escapePlayerCharHtml(label)}</dt>
            <dd>${rawHtml ? value : escapePlayerCharHtml(value)}</dd>
          </div>
        `).join("")}
      </dl>
    </div>
  `;
}

function isFighterCharacteristicsOpen(side) {
  const ui = FIGHTER_CHAR_UI[side];
  const popup = document.getElementById(ui.popupId);
  return !!(popup && !popup.classList.contains("hidden"));
}

function isPlayerCharacteristicsOpen() {
  return isFighterCharacteristicsOpen("player");
}

function closeFighterCharacteristicsPopup(side) {
  const ui = FIGHTER_CHAR_UI[side];
  const popup = document.getElementById(ui.popupId);
  const btn = document.getElementById(ui.btnId);
  popup?.classList.add("hidden");
  document.getElementById(ui.panelId)?.classList.remove(ui.openClass);
  btn?.setAttribute("aria-expanded", "false");
}

function closePlayerCharacteristicsPopup() {
  closeFighterCharacteristicsPopup("player");
}

function closeAllFighterCharacteristicsPopups() {
  closeFighterCharacteristicsPopup("player");
  closeFighterCharacteristicsPopup("enemy");
}

function refreshFighterCharacteristicsPopup(state) {
  const side = state.side || "player";
  if (!isFighterCharacteristicsOpen(side)) return;
  const ui = FIGHTER_CHAR_UI[side];
  const content = document.getElementById(ui.contentId);
  if (content) {
    content.innerHTML = renderFighterCharacteristicsHTML(buildFighterCharacteristicsSummary(state), side);
  }
}

function refreshPlayerCharacteristicsPopup(state) {
  refreshFighterCharacteristicsPopup({ ...state, side: "player" });
}

function openFighterCharacteristicsPopup(state) {
  if (state.phase !== "prep" || state.gameOver) return;
  const side = state.side || "player";
  const otherSide = side === "player" ? "enemy" : "player";
  closeFighterCharacteristicsPopup(otherSide);

  const ui = FIGHTER_CHAR_UI[side];
  const popup = document.getElementById(ui.popupId);
  const content = document.getElementById(ui.contentId);
  const btn = document.getElementById(ui.btnId);
  if (!popup || !content) return;

  content.innerHTML = renderFighterCharacteristicsHTML(buildFighterCharacteristicsSummary(state), side);
  popup.classList.remove("hidden");
  document.getElementById(ui.panelId)?.classList.add(ui.openClass);
  btn?.setAttribute("aria-expanded", "true");
}

function openPlayerCharacteristicsPopup(state) {
  openFighterCharacteristicsPopup({ ...state, side: "player" });
}

function toggleFighterCharacteristicsPopup(state) {
  const side = state.side || "player";
  if (isFighterCharacteristicsOpen(side)) {
    closeFighterCharacteristicsPopup(side);
  } else {
    openFighterCharacteristicsPopup(state);
  }
}

function togglePlayerCharacteristicsPopup(state) {
  toggleFighterCharacteristicsPopup({ ...state, side: "player" });
}

function bindPlayerCharacteristicsControls(getPlayerState, getEnemyState) {
  document.getElementById("btn-player-stats")?.addEventListener("click", () => {
    toggleFighterCharacteristicsPopup({ ...getPlayerState(), side: "player" });
  });

  document.getElementById("btn-enemy-stats")?.addEventListener("click", () => {
    toggleFighterCharacteristicsPopup({ ...getEnemyState(), side: "enemy" });
  });

  ["player", "enemy"].forEach((side) => {
    const ui = FIGHTER_CHAR_UI[side];
    document.getElementById(ui.popupId)?.addEventListener("click", (e) => {
      if (e.target.id === ui.closeBtnId || e.target.closest(`#${ui.closeBtnId}`)) {
        closeFighterCharacteristicsPopup(side);
      }
    });
  });
}
