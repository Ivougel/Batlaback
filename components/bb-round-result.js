/**
 * BB Fidelity: fullscreen итог раунда — жизни, трофеи, CTA.
 */
const BBRoundResult = (() => {
  let bound = false;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderHearts(lives, maxLives) {
    const max = Math.max(1, maxLives || 4);
    const current = Math.max(0, Math.min(max, lives ?? max));
    return Array.from({ length: max }, (_, i) => {
      const filled = i < current;
      const lostThisRound = i === current;
      const cls = [
        "bb-round-result__heart",
        filled ? "bb-round-result__heart--full" : "bb-round-result__heart--empty",
        lostThisRound ? "bb-round-result__heart--lost" : "",
      ].filter(Boolean).join(" ");
      return `<span class="${cls}" aria-hidden="true">${filled ? "❤️" : "🖤"}</span>`;
    }).join("");
  }

  function renderTrophies(runResults, roundNum) {
    const max = typeof RUN_BATTLES !== "undefined" ? RUN_BATTLES : 16;
    const cells = Array.from({ length: Math.min(max, 10) }, (_, i) => {
      const num = i + 1;
      const result = runResults?.[i];
      let icon = "⚪";
      let cls = "bb-round-result__trophy";
      if (result === "win") {
        icon = "🏆";
        cls += " bb-round-result__trophy--win";
      } else if (result === "loss") {
        icon = "💀";
        cls += " bb-round-result__trophy--loss";
      } else if (result === "draw") {
        icon = "🤝";
        cls += " bb-round-result__trophy--draw";
      } else if (num === roundNum) {
        icon = "▶️";
        cls += " bb-round-result__trophy--current";
      }
      return `<span class="${cls}" title="Раунд ${num}">${icon}</span>`;
    }).join("");
    return cells;
  }

  function outcomeCopy(summary) {
    if (summary.winner === "player") {
      return { title: "Победа!", mood: "win", emoji: "🏆" };
    }
    if (summary.winner === "enemy") {
      return { title: "Поражение", mood: "loss", emoji: "💀" };
    }
    return { title: "Ничья", mood: "draw", emoji: "🤝" };
  }

  function bindOnce() {
    if (bound) return;
    const btn = document.getElementById("btn-bb-round-continue");
    const replayBtn = document.getElementById("btn-bb-round-replay");
    if (btn) {
      bound = true;
      btn.addEventListener("click", () => {
        document.getElementById("btn-battle-continue")?.click();
      });
    }
    if (replayBtn) {
      replayBtn.addEventListener("click", () => {
        document.getElementById("btn-battle-replay")?.click();
      });
    }
  }

  function hide() {
    const overlay = document.getElementById("bb-round-result-overlay");
    if (!overlay) return Promise.resolve();
    overlay.classList.remove("bb-round-result-overlay--visible");
    if (typeof PrepCountdown !== "undefined") PrepCountdown.clearBattleResultWindow();
    if (typeof ScreenTransitions !== "undefined") {
      return ScreenTransitions.hideScreenOverlay(overlay, "result").then(() => {
        overlay.classList.add("hidden");
        overlay.setAttribute("aria-hidden", "true");
        document.documentElement.removeAttribute("data-bb-round-result");
      });
    }
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.removeAttribute("data-bb-round-result");
    return Promise.resolve();
  }

  function show(summary, battleLog = [], ctx = {}) {
    bindOnce();
    const overlay = document.getElementById("bb-round-result-overlay");
    if (!overlay) {
      if (typeof showBattleResultPopup === "function") showBattleResultPopup(summary, battleLog);
      return;
    }

    const outcome = outcomeCopy(summary);
    const lives = ctx.runLives ?? (typeof runLives !== "undefined" ? runLives : null);
    const maxLives = typeof getBBRunLivesMax === "function" ? getBBRunLivesMax() : 4;
    const showLives = typeof shouldUseBBRunLives === "function" && shouldUseBBRunLives();
    const roundNum = ctx.roundNum ?? summary.roundNum ?? (typeof round !== "undefined" ? round : 1);
    const runHistory = ctx.runResults ?? (typeof runResults !== "undefined" ? runResults : []);

    overlay.dataset.outcome = summary.winner || "draw";
    document.documentElement.setAttribute("data-bb-round-result", outcome.mood);

    const titleEl = document.getElementById("bb-round-result-title");
    const subtitleEl = document.getElementById("bb-round-result-subtitle");
    const heartsEl = document.getElementById("bb-round-result-hearts");
    const trophiesEl = document.getElementById("bb-round-result-trophies");
    const goldEl = document.getElementById("bb-round-result-gold");
    const lineEl = document.getElementById("bb-round-result-line");
    const livesWrap = document.getElementById("bb-round-result-lives-wrap");
    const replayBtn = document.getElementById("btn-bb-round-replay");

    if (titleEl) {
      titleEl.textContent = `${outcome.emoji} ${outcome.title}`;
    }
    if (subtitleEl) {
      subtitleEl.textContent = summary.classWinnerLine || summary.title || "";
    }
    if (lineEl) {
      const p = summary.player;
      const e = summary.enemy;
      lineEl.textContent = p && e
        ? `❤️ ${p.hp}/${p.maxHp} · ⚔ ${p.damage}  —  ⚔ ${e.damage} · ❤️ ${e.hp}/${e.maxHp}`
        : "";
    }
    if (heartsEl && showLives) {
      heartsEl.innerHTML = renderHearts(lives, maxLives);
    }
    if (livesWrap) {
      livesWrap.hidden = !showLives;
      livesWrap.toggleAttribute("hidden", !showLives);
    }
    if (trophiesEl) {
      trophiesEl.innerHTML = renderTrophies(runHistory, roundNum);
    }
    if (goldEl) {
      const gold = summary.goldReward ?? 0;
      goldEl.textContent = gold > 0 ? `+${gold} 💰` : "";
      goldEl.hidden = gold <= 0;
    }
    if (replayBtn) {
      const canReplay = typeof lastBattleReplay !== "undefined"
        && lastBattleReplay?.frames?.length > 1;
      replayBtn.classList.toggle("hidden", !canReplay);
      replayBtn.toggleAttribute("hidden", !canReplay);
    }

    const reveal = () => {
      if (typeof PrepCountdown !== "undefined") {
        PrepCountdown.scheduleBattleResultWindow();
      }
      if (typeof refreshGamepadHints === "function") refreshGamepadHints();
    };

    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    void overlay.offsetWidth;
    overlay.classList.add("bb-round-result-overlay--visible");

    if (typeof ScreenTransitions !== "undefined") {
      void ScreenTransitions.showScreenOverlay(overlay, "result").then(reveal);
      return;
    }
    reveal();
  }

  return { show, hide };
})();

function showBBRoundResult(summary, battleLog, ctx) {
  BBRoundResult.show(summary, battleLog, ctx);
}

function hideBBRoundResult() {
  return BBRoundResult.hide();
}

function showBattleResultForMode(summary, battleLog = []) {
  if (typeof shouldUseBBRoundResultScreen === "function" && shouldUseBBRoundResultScreen()) {
    showBBRoundResult(summary, battleLog, {
      runLives: typeof runLives !== "undefined" ? runLives : undefined,
      runResults: typeof runResults !== "undefined" ? runResults : undefined,
      roundNum: typeof round !== "undefined" ? round : summary?.roundNum,
    });
    return;
  }
  if (typeof showBattleResultPopup === "function") {
    showBattleResultPopup(summary, battleLog);
  }
}

if (typeof window !== "undefined") {
  window.BBRoundResult = BBRoundResult;
  window.showBBRoundResult = showBBRoundResult;
  window.hideBBRoundResult = hideBBRoundResult;
  window.showBattleResultForMode = showBattleResultForMode;
}
