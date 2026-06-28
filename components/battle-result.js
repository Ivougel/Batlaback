/**
 * UI экрана результата боя.
 */

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeBattleLogEntry(entry) {
  if (typeof entry === "string") {
    return { t: null, actor: "system", type: "info", message: entry };
  }
  return entry || { t: null, actor: "system", type: "info", message: "" };
}

function renderBattleLogLine(entry) {
  const row = normalizeBattleLogEntry(entry);
  const type = row.type || "info";
  const actor = row.actor || "system";
  const enemyBadge = typeof getEnemyDisplayName === "function" ? getEnemyDisplayName() : "ИИ";
  const timeHtml = row.t != null
    ? `<span class="battle-log-time">${Number(row.t).toFixed(1)}с</span>`
    : `<span class="battle-log-time battle-log-time-empty">—</span>`;
  const actorBadge = actor === "player"
    ? `<span class="battle-log-badge battle-log-badge-player">Вы</span>`
    : actor === "enemy"
      ? `<span class="battle-log-badge battle-log-badge-enemy">${escapeHtml(enemyBadge)}</span>`
      : `<span class="battle-log-badge battle-log-badge-system">•</span>`;

  return `<div class="battle-log-line battle-log-type-${type} battle-log-actor-${actor}">
    ${timeHtml}${actorBadge}<span class="battle-log-msg">${escapeHtml(row.message || "")}</span>
  </div>`;
}

async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {
    /* fallback below */
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (_) {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

function formatBattleLogCopyText(logLines, summary) {
  const lines = (logLines || []).map(normalizeBattleLogEntry);
  const enemyName = typeof getEnemyDisplayName === "function" ? getEnemyDisplayName() : "ИИ";
  const roundNum = summary?.roundNum;
  const title = roundNum != null ? `Лог боя — раунд ${roundNum}` : "Лог боя";
  const playerDmg = summary?.player?.damage ?? 0;
  const enemyDmg = summary?.enemy?.damage ?? 0;
  const playerSplit = formatDamageTypeSplit(summary?.player?.physicalDamage, summary?.player?.magicDamage);
  const enemySplit = formatDamageTypeSplit(summary?.enemy?.physicalDamage, summary?.enemy?.magicDamage);

  const out = [
    title,
    `Вы нанесли по HP: ${formatStatNumber(playerDmg)} (${playerSplit}) | ${enemyName} нанёс по HP: ${formatStatNumber(enemyDmg)} (${enemySplit})`,
    "",
  ];

  if (!lines.length) {
    out.push("(записей нет)");
    return out.join("\n");
  }

  lines.forEach((row) => {
    const time = row.t != null ? `${Number(row.t).toFixed(1)}с` : "—";
    const actor = row.actor === "player"
      ? "Вы"
      : row.actor === "enemy"
        ? enemyName
        : "•";
    out.push(`${time}\t[${actor}]\t${row.message || ""}`);
  });

  return out.join("\n");
}

function renderBattleLogSection(logLines, summary) {
  const lines = (logLines || []).map(normalizeBattleLogEntry);
  if (!lines.length) {
    return '<p class="battle-log-empty">Записей нет</p>';
  }

  const playerDmg = summary?.player?.damage ?? 0;
  const enemyDmg = summary?.enemy?.damage ?? 0;
  const playerSplit = formatDamageTypeSplit(summary?.player?.physicalDamage, summary?.player?.magicDamage);
  const enemySplit = formatDamageTypeSplit(summary?.enemy?.physicalDamage, summary?.enemy?.magicDamage);
  const enemyName = typeof getEnemyDisplayName === "function" ? getEnemyDisplayName() : "ИИ";
  const header = `
    <div class="battle-log-summary">
      <span class="battle-log-count">${lines.length} событий</span>
      <span class="battle-log-stat battle-log-stat-player">Вы: <b>${playerDmg}</b> HP <span class="battle-log-split">(${playerSplit})</span></span>
      <span class="battle-log-stat battle-log-stat-enemy">${escapeHtml(enemyName)}: <b>${enemyDmg}</b> HP <span class="battle-log-split">(${enemySplit})</span></span>
    </div>
    <p class="battle-log-hint">Хронология с начала боя. Урон по HP, блок и броня — в строке атаки; ниже — какие защитные предметы погасили урон.</p>
  `;

  const rows = lines.map(renderBattleLogLine).join("");
  return `${header}<div class="battle-log-scroll">${rows}</div>`;
}

function showBattleResultPopup(summary, battleLog = []) {
  const overlay = document.getElementById("battle-result-overlay");
  if (!overlay) return;

  document.getElementById("battle-result-title").textContent = summary.title;

  let subtitle = `Раунд ${summary.roundNum}`;
  if (summary.winner === "player") subtitle += " · Победа в бою";
  else if (summary.winner === "enemy") subtitle += " · Поражение в бою";
  else subtitle += " · Ничья";
  if (summary.classWinnerLine) subtitle += ` · ${summary.classWinnerLine}`;
  document.getElementById("battle-result-subtitle").textContent = subtitle;

  const accordionsEl = document.getElementById("battle-result-accordions");
  renderBattleResultPanel(accordionsEl, [
    {
      type: "static",
      title: "🏆 Результат боя",
      html: renderBattleResultBlock(summary),
    },
    {
      type: "popup",
      title: "⚔ Вклад предметов",
      popupTitle: "Вклад предметов",
      html: renderItemStatsSection(summary.playerItems, summary.enemyItems),
      getCopyText: () => formatItemStatsCopyText(summary.playerItems, summary.enemyItems, {
        roundNum: summary.roundNum,
      }),
    },
    {
      type: "popup",
      title: "📜 Лог боя",
      popupTitle: "Лог боя",
      html: renderBattleLogSection(battleLog, summary),
      getCopyText: () => formatBattleLogCopyText(battleLog, summary),
    },
  ]);

  overlay.classList.remove("hidden");

  if (typeof refreshGamepadHints === "function") refreshGamepadHints();

  const replayBtn = document.getElementById("btn-battle-replay");
  if (replayBtn) {
    const canReplay = typeof lastBattleReplay !== "undefined"
      && lastBattleReplay?.frames?.length > 1;
    replayBtn.classList.toggle("hidden", !canReplay);
  }
}

function hideBattleResultPopup() {
  hideDetailPopup();
  document.getElementById("battle-result-overlay")?.classList.add("hidden");
}

function showRunCompleteOverlay(runResults, runItemStats, roundNum, phase, boardSnapshot = null, goldStats = null) {
  const overlay = document.getElementById("overlay");
  if (!overlay) return;

  document.getElementById("battle-result-overlay")?.classList.add("hidden");

  const { wins, losses, draws, played, winrate } = computeRunWinrate(runResults);
  document.getElementById("overlay-title").textContent = "Забег завершён!";
  document.getElementById("overlay-text").textContent = played
    ? `${RUN_BATTLES} боёв пройдено · Винрейт ${winrate}% (${wins} побед, ${losses} поражений, ${draws} ничьих)`
    : `${RUN_BATTLES} боёв пройдено`;

  const { player, enemy } = runItemStatsToArrays(runItemStats);
  const accordionsEl = document.getElementById("run-complete-accordions");
  if (accordionsEl) {
    renderAccordions(accordionsEl, [
      {
        title: "📊 История забега",
        html: renderRunStatsPanel(roundNum, phase, runResults, goldStats),
        open: true,
      },
      {
        title: "⚔ Статистика предметов за забег",
        html: renderItemStatsSection(player, enemy, { showBoardButtons: !!boardSnapshot }),
        open: true,
        getCopyText: () => formatItemStatsCopyText(player, enemy, {
          title: "Статистика предметов за забег",
        }),
      },
    ]);
    bindBoardPreviewButtons(accordionsEl, boardSnapshot);
  }

  overlay.classList.remove("hidden");
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}
