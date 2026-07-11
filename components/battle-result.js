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

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function formatBrCountText(el, value) {
  const kind = el.dataset.brKind;
  const prefix = el.dataset.brPrefix || "";
  const suffix = el.dataset.brSuffix || "";
  if (kind === "hp") {
    const max = Number(el.dataset.brMax) || 0;
    const icon = el.dataset.brIcon || "❤️";
    return `${icon} ${formatStatNumber(value)}/${max}`;
  }
  if (kind === "time") {
    return `${prefix}${formatBattleTime(value)}`;
  }
  return `${prefix}${formatStatNumber(value)}${suffix}`;
}

function animateBattleResultStatCounts(root) {
  const scope = root || document.getElementById("battle-result-accordions");
  if (!scope) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const countUp = typeof BattleFxTier !== "undefined" && BattleFxTier.battleResultCountUpEnabled
    ? BattleFxTier.battleResultCountUpEnabled()
    : !(typeof BattleFxTier !== "undefined" && BattleFxTier.isLightBattleFx());
  const counters = [...scope.querySelectorAll("[data-br-count]")];
  if (!counters.length) return;

  const items = counters.map((el) => {
    const final = Number(el.dataset.brValue) || 0;
    return {
      el,
      final,
      useDecimal: !Number.isInteger(final),
    };
  });

  if (reduced || !countUp) {
    items.forEach(({ el, final }) => {
      el.textContent = formatBrCountText(el, final);
    });
    return;
  }

  const duration = 720;
  const start = performance.now();
  items.forEach(({ el }) => {
    el.textContent = formatBrCountText(el, 0);
  });

  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = easeOutCubic(t);
    items.forEach(({ el, final, useDecimal }) => {
      const raw = final * eased;
      const value = useDecimal ? Math.round(raw * 10) / 10 : Math.round(raw);
      el.textContent = formatBrCountText(el, value);
    });
    if (t < 1) requestAnimationFrame(tick);
    else {
      items.forEach(({ el, final }) => {
        el.textContent = formatBrCountText(el, final);
      });
    }
  };
  requestAnimationFrame(tick);
}

function showBattleResultPopup(summary, battleLog = []) {
  const overlay = document.getElementById("battle-result-overlay");
  if (!overlay) return;

  overlay.dataset.outcome = summary.winner || "draw";

  const titleEl = document.getElementById("battle-result-title");
  if (titleEl) {
    titleEl.textContent = summary.classWinnerLine || summary.title || "Бой завершён";
    titleEl.classList.add("battle-result-headline");
  }

  const subtitleEl = document.getElementById("battle-result-subtitle");
  if (subtitleEl) {
    subtitleEl.textContent = summary.roundNum != null ? `Раунд ${summary.roundNum}` : "";
  }

  const viewHintEl = document.getElementById("battle-result-view-hint");
  if (viewHintEl) {
    viewHintEl.classList.add("hidden");
    viewHintEl.textContent = "";
  }

  const continueBtn = document.getElementById("btn-battle-continue");
  if (continueBtn) {
    continueBtn.textContent = "Продолжить";
  }

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

  const reveal = () => {
    animateBattleResultStatCounts(accordionsEl);
    if (typeof startBattleResultTheater === "function") {
      startBattleResultTheater(summary);
    }
    if (typeof PrepCountdown !== "undefined") {
      PrepCountdown.scheduleBattleResultWindow();
    }
    if (typeof refreshGamepadHints === "function") refreshGamepadHints();
    const replayBtn = document.getElementById("btn-battle-replay");
    if (replayBtn) {
      const canReplay = typeof lastBattleReplay !== "undefined"
        && lastBattleReplay?.frames?.length > 1;
      replayBtn.classList.toggle("hidden", !canReplay);
    }
  };

  if (typeof ScreenTransitions !== "undefined") {
    void ScreenTransitions.showScreenOverlay(overlay, "result").then(reveal);
    return;
  }

  overlay.classList.remove("hidden");
  reveal();
}

function hideBattleResultPopupAsync(variant = "result") {
  hideDetailPopup();
  if (typeof stopBattleResultTheater === "function") stopBattleResultTheater();
  if (typeof PrepCountdown !== "undefined") PrepCountdown.clearBattleResultWindow();
  const bbOverlay = document.getElementById("bb-round-result-overlay");
  if (bbOverlay && !bbOverlay.classList.contains("hidden") && typeof hideBBRoundResult === "function") {
    return hideBBRoundResult();
  }
  const overlay = document.getElementById("battle-result-overlay");
  if (!overlay || overlay.classList.contains("hidden")) return Promise.resolve();
  if (typeof ScreenTransitions !== "undefined") {
    return ScreenTransitions.hideScreenOverlay(overlay, variant).then(() => {
      overlay.removeAttribute("data-outcome");
    });
  }
  overlay.classList.add("hidden");
  overlay.removeAttribute("data-outcome");
  return Promise.resolve();
}

function hideBattleResultPopup() {
  void hideBattleResultPopupAsync();
}

(function bindBattleResultHelpOnce() {
  const help = document.getElementById("battle-result-help");
  const btn = help?.querySelector(".battle-result-help-btn");
  const tip = document.getElementById("battle-result-help-tooltip");
  if (!btn || !tip) return;

  const closeTip = () => {
    tip.classList.add("hidden");
    btn.setAttribute("aria-expanded", "false");
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = tip.classList.contains("hidden");
    if (willOpen) {
      tip.classList.remove("hidden");
      btn.setAttribute("aria-expanded", "true");
    } else {
      closeTip();
    }
  });

  document.addEventListener("click", (e) => {
    if (!help.contains(e.target)) closeTip();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTip();
  });
})();

function showRunCompleteOverlay(runResults, runItemStats, roundNum, phase, boardSnapshot = null, goldStats = null) {
  const overlay = document.getElementById("overlay");
  if (!overlay) return;

  document.getElementById("battle-result-overlay")?.classList.add("hidden");

  const { wins, losses, draws, played, winrate } = computeRunWinrate(runResults);
  document.getElementById("overlay-title").textContent = "Забег завершён!";
  document.getElementById("overlay-text").textContent = played
    ? `${RUN_BATTLES} боёв пройдено · Винрейт ${winrate}% (${wins} побед, ${losses} поражений, ${draws} ничьих)`
    : `${RUN_BATTLES} боёв пройдено`;

  const metaRewardEl = document.getElementById("run-complete-meta-reward");
  if (metaRewardEl && typeof MetaProgress !== "undefined") {
    const reward = MetaProgress.getLastRunReward();
    metaRewardEl.innerHTML = reward ? MetaProgress.renderRunRewardHtml(reward) : "";
    metaRewardEl.classList.toggle("hidden", !reward);
  }

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

  if (typeof ScreenTransitions !== "undefined") {
    void ScreenTransitions.showScreenOverlay(overlay, "runComplete");
  } else {
    overlay.classList.remove("hidden");
  }
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}
