/**
 * BB Fidelity: fullscreen экран конца забега (classic / versus).
 */
const BBRunComplete = (() => {
  let bound = false;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function resolvePortraitSrc(classId) {
    if (typeof getClassHeroPortraitSrc === "function") {
      return getClassHeroPortraitSrc(classId);
    }
    const cls = typeof getClassById === "function" ? getClassById(classId) : null;
    return cls?.heroPortraitSrc || cls?.iconSrc || null;
  }

  function resolveHeroLabel(classId) {
    if (typeof isVersusMode === "function" && isVersusMode()) return "Игрок 1";
    if (typeof getHeroLabel === "function") {
      const hero = getHeroLabel(classId);
      if (hero) return hero;
    }
    const cls = typeof getClassById === "function" ? getClassById(classId) : null;
    return cls?.heroLabel || cls?.name || "Игрок";
  }

  function resolveClassName(classId) {
    const cls = typeof getClassById === "function" ? getClassById(classId) : null;
    return cls?.name || "";
  }

  function renderHearts(lives, maxLives) {
    const max = Math.max(1, maxLives || 4);
    const current = Math.max(0, Math.min(max, lives ?? 0));
    return Array.from({ length: max }, (_, i) => {
      const filled = i < current;
      const cls = [
        "bb-run-complete__heart",
        filled ? "bb-run-complete__heart--full" : "bb-run-complete__heart--empty",
      ].filter(Boolean).join(" ");
      return `<span class="${cls}" aria-hidden="true">${filled ? "❤️" : "🖤"}</span>`;
    }).join("");
  }

  function renderTrophies(runResults, roundNum) {
    const max = typeof RUN_BATTLES !== "undefined" ? RUN_BATTLES : 16;
    return Array.from({ length: max }, (_, i) => {
      const num = i + 1;
      const result = runResults?.[i];
      let icon = "⚪";
      let cls = "bb-run-complete__trophy";
      if (result === "win") {
        icon = "🏆";
        cls += " bb-run-complete__trophy--win";
      } else if (result === "loss") {
        icon = "💀";
        cls += " bb-run-complete__trophy--loss";
      } else if (result === "draw") {
        icon = "🤝";
        cls += " bb-run-complete__trophy--draw";
      }
      return `<span class="${cls}" title="Раунд ${num}">${icon}</span>`;
    }).join("");
  }

  function resolveOutcome(runResults, roundNum, lives) {
    const max = typeof RUN_BATTLES !== "undefined" ? RUN_BATTLES : 16;
    const completed = roundNum > max;
    const outOfLives = typeof shouldUseBBRunLives === "function"
      && shouldUseBBRunLives()
      && lives <= 0;

    if (completed) {
      const { wins, winrate } = typeof computeRunWinrate === "function"
        ? computeRunWinrate(runResults)
        : { wins: 0, winrate: 0 };
      return {
        mood: "victory",
        title: "Забег завершён!",
        emoji: "🏆",
        subtitle: wins >= Math.ceil(max * 0.5)
          ? `Отличный результат · винрейт ${winrate}%`
          : `Пройдено ${max} боёв · винрейт ${winrate}%`,
      };
    }
    if (outOfLives) {
      return {
        mood: "defeat",
        title: "Поражение",
        emoji: "💀",
        subtitle: "Жизни закончились — забег завершён",
      };
    }
    return {
      mood: "complete",
      title: "Забег завершён!",
      emoji: "⚔️",
      subtitle: "Спасибо за игру",
    };
  }

  function bindOnce() {
    if (bound) return;
    const btn = document.getElementById("btn-bb-run-complete-home");
    if (btn) {
      bound = true;
      btn.addEventListener("click", () => {
        document.getElementById("btn-restart")?.click();
      });
    }
  }

  function hide() {
    const overlay = document.getElementById("bb-run-complete-overlay");
    if (!overlay) return Promise.resolve();
    overlay.classList.remove("bb-run-complete-overlay--visible");
    if (typeof ScreenTransitions !== "undefined") {
      return ScreenTransitions.hideScreenOverlay(overlay, "runComplete").then(() => {
        overlay.classList.add("hidden");
        overlay.setAttribute("aria-hidden", "true");
        document.documentElement.removeAttribute("data-bb-run-complete");
      });
    }
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    document.documentElement.removeAttribute("data-bb-run-complete");
    return Promise.resolve();
  }

  function show(runResults, runItemStats, roundNum, phase, goldStats = null) {
    bindOnce();
    const overlay = document.getElementById("bb-run-complete-overlay");
    if (!overlay) {
      if (typeof showRunCompleteOverlay === "function") {
        showRunCompleteOverlay(runResults, runItemStats, roundNum, phase, null, goldStats);
      }
      return;
    }

    document.getElementById("battle-result-overlay")?.classList.add("hidden");
    document.getElementById("bb-round-result-overlay")?.classList.add("hidden");

    const classId = typeof playerClass !== "undefined" ? playerClass : null;
    const lives = typeof runLives !== "undefined" ? runLives : 0;
    const maxLives = typeof getBBRunLivesMax === "function" ? getBBRunLivesMax() : 4;
    const showLives = typeof shouldUseBBRunLives === "function" && shouldUseBBRunLives();
    const outcome = resolveOutcome(runResults, roundNum, lives);
    const { wins, losses, draws, played, winrate } = typeof computeRunWinrate === "function"
      ? computeRunWinrate(runResults)
      : { wins: 0, losses: 0, draws: 0, played: 0, winrate: 0 };

    overlay.dataset.outcome = outcome.mood;
    document.documentElement.setAttribute("data-bb-run-complete", outcome.mood);

    const portraitEl = document.getElementById("bb-run-complete-portrait");
    const heroEl = document.getElementById("bb-run-complete-hero");
    const classEl = document.getElementById("bb-run-complete-class");
    const titleEl = document.getElementById("bb-run-complete-title");
    const subtitleEl = document.getElementById("bb-run-complete-subtitle");
    const statsEl = document.getElementById("bb-run-complete-stats");
    const trophiesEl = document.getElementById("bb-run-complete-trophies");
    const heartsEl = document.getElementById("bb-run-complete-hearts");
    const livesWrap = document.getElementById("bb-run-complete-lives-wrap");
    const goldEl = document.getElementById("bb-run-complete-gold");
    const metaEl = document.getElementById("bb-run-complete-meta");

    const portraitSrc = resolvePortraitSrc(classId);
    if (portraitEl) {
      if (portraitSrc) {
        portraitEl.src = portraitSrc;
        portraitEl.alt = resolveClassName(classId);
        portraitEl.hidden = false;
      } else {
        portraitEl.removeAttribute("src");
        portraitEl.alt = "";
        portraitEl.hidden = true;
      }
    }
    if (heroEl) heroEl.textContent = resolveHeroLabel(classId);
    if (classEl) {
      const name = resolveClassName(classId);
      classEl.textContent = name;
      classEl.hidden = !name;
    }
    if (titleEl) titleEl.textContent = `${outcome.emoji} ${outcome.title}`;
    if (subtitleEl) subtitleEl.textContent = outcome.subtitle;
    if (statsEl) {
      statsEl.textContent = played
        ? `🏆 ${wins} · 💀 ${losses} · 🤝 ${draws} · ${winrate}%`
        : "Бои не сыграны";
    }
    if (trophiesEl) trophiesEl.innerHTML = renderTrophies(runResults, roundNum);
    if (heartsEl && showLives) heartsEl.innerHTML = renderHearts(lives, maxLives);
    if (livesWrap) {
      livesWrap.hidden = !showLives;
      livesWrap.toggleAttribute("hidden", !showLives);
    }
    if (goldEl && goldStats) {
      const earned = goldStats.earned ?? 0;
      const spent = goldStats.spent ?? 0;
      goldEl.textContent = `Получено ${earned}💰 · Потрачено ${spent}💰`;
      goldEl.hidden = earned <= 0 && spent <= 0;
    } else if (goldEl) {
      goldEl.hidden = true;
    }
    if (metaEl && typeof MetaProgress !== "undefined") {
      const reward = MetaProgress.getLastRunReward();
      metaEl.innerHTML = reward ? MetaProgress.renderRunRewardHtml(reward) : "";
      metaEl.classList.toggle("hidden", !reward);
    }

    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    void overlay.offsetWidth;
    overlay.classList.add("bb-run-complete-overlay--visible");

    if (typeof ScreenTransitions !== "undefined") {
      void ScreenTransitions.showScreenOverlay(overlay, "runComplete");
    }
    if (typeof refreshGamepadHints === "function") refreshGamepadHints();
  }

  return { show, hide };
})();

function showBBRunComplete(runResults, runItemStats, roundNum, phase, boardSnapshot, goldStats) {
  BBRunComplete.show(runResults, runItemStats, roundNum, phase, goldStats);
}

function hideBBRunComplete() {
  return BBRunComplete.hide();
}

function showRunCompleteForMode(runResults, runItemStats, roundNum, phase, boardSnapshot, goldStats) {
  if (typeof shouldUseBBRunCompleteScreen === "function" && shouldUseBBRunCompleteScreen()) {
    showBBRunComplete(runResults, runItemStats, roundNum, phase, boardSnapshot, goldStats);
    return;
  }
  if (typeof showRunCompleteOverlay === "function") {
    showRunCompleteOverlay(runResults, runItemStats, roundNum, phase, boardSnapshot, goldStats);
  }
}

if (typeof window !== "undefined") {
  window.BBRunComplete = BBRunComplete;
  window.showBBRunComplete = showBBRunComplete;
  window.hideBBRunComplete = hideBBRunComplete;
  window.showRunCompleteForMode = showRunCompleteForMode;
}
