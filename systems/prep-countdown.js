/**
 * Таймер подготовки: звуки (старт, −10с, −5с), отсчёт 3-2-1 перед боем.
 * Итоги боя — окно просмотра 6 с, затем авто-«Продолжить».
 */
const PrepCountdown = (() => {
  const PREP_COUNTDOWN_SEC = 3;
  const BATTLE_RESULT_VIEW_SEC = 6;

  let countdown = {
    active: false,
    remaining: 0,
    label: null,
    onComplete: null,
  };
  let audioPhaseKey = "";
  let audioTenPlayed = false;
  let audioFivePlayed = false;
  let lobbyAutoArmed = false;

  function playSfx(id) {
    if (typeof playGameSfx === "function") playGameSfx(id);
  }

  function resetAudioMarks(phaseKey) {
    audioPhaseKey = phaseKey || "";
    audioTenPlayed = false;
    audioFivePlayed = false;
  }

  function onPrepPhaseStarted(phaseKey) {
    resetAudioMarks(phaseKey);
    lobbyAutoArmed = false;
    playSfx("prep_phase_start");
  }

  function resetLobbyArming() {
    lobbyAutoArmed = false;
  }

  function tickPrepTimerAudio(remainingSec, active, phaseKey) {
    if (!active) return;
    if (phaseKey && phaseKey !== audioPhaseKey) resetAudioMarks(phaseKey);
    const secs = Math.ceil(Math.max(0, remainingSec));
    if (secs <= 10 && secs > 9 && !audioTenPlayed) {
      audioTenPlayed = true;
      playSfx("prep_timer_10");
    }
    if (secs <= 5 && secs > 4 && !audioFivePlayed) {
      audioFivePlayed = true;
      playSfx("prep_timer_5");
    }
  }

  function isActive() {
    return countdown.active;
  }

  function cancel() {
    countdown.active = false;
    countdown.remaining = 0;
    countdown.label = null;
    countdown.onComplete = null;
    if (typeof hideBattleCountdownOverlay === "function") hideBattleCountdownOverlay();
  }

  function render() {
    if (!countdown.active || !countdown.label) {
      if (!countdown.active && typeof hideBattleCountdownOverlay === "function") {
        hideBattleCountdownOverlay();
      }
      return;
    }
    if (typeof renderBattleCountdown === "function") {
      renderBattleCountdown({
        countdown: { active: true, label: countdown.label },
      });
    }
    const overlay = document.getElementById("battle-countdown-overlay");
    overlay?.classList.toggle(
      "battle-countdown-overlay--prep",
      document.getElementById("app")?.dataset?.phase === "prep",
    );
  }

  function start(onComplete) {
    cancel();
    countdown = {
      active: true,
      remaining: PREP_COUNTDOWN_SEC,
      label: "3",
      onComplete: typeof onComplete === "function" ? onComplete : null,
    };
    playSfx("battle_countdown_tick");
    render();
  }

  function tick(dt) {
    if (!countdown.active) return false;
    const prevLabel = countdown.label;
    countdown.remaining -= dt;
    const left = Math.ceil(Math.max(0, countdown.remaining));
    countdown.label = left > 0 ? String(left) : null;

    if (countdown.label !== prevLabel) {
      if (countdown.label) playSfx("battle_countdown_tick");
      else playSfx("battle_countdown_go");
    }

    render();

    if (countdown.remaining <= 0) {
      const cb = countdown.onComplete;
      cancel();
      if (cb) cb();
      return true;
    }
    return false;
  }

  function tryArmLobbyAutoCountdown(remainingSec) {
    if (lobbyAutoArmed || countdown.active) return;
    if (remainingSec > PREP_COUNTDOWN_SEC || remainingSec <= 0) return;
    lobbyAutoArmed = true;
    start(() => {
      lobbyAutoArmed = false;
      if (typeof executeBattleStart === "function") executeBattleStart();
    });
  }

  let battleResultClock = {
    active: false,
    rafId: null,
    startedAt: 0,
    lastLabel: null,
  };

  function renderBattleResultCountdown(label) {
    const wrap = document.getElementById("battle-result-countdown");
    const digit = document.getElementById("battle-result-countdown-digit");
    if (!wrap || !digit) return;
    if (!label) {
      wrap.classList.add("hidden");
      wrap.setAttribute("aria-hidden", "true");
      digit.textContent = "";
      digit.classList.remove("battle-result-countdown-digit--pop");
      return;
    }
    wrap.classList.remove("hidden");
    wrap.setAttribute("aria-hidden", "false");
    digit.setAttribute("aria-label", `До продолжения ${label} секунд`);
    if (digit.textContent !== label) {
      digit.textContent = label;
      digit.classList.remove("battle-result-countdown-digit--pop");
      void digit.offsetWidth;
      digit.classList.add("battle-result-countdown-digit--pop");
    }
  }

  function stopBattleResultCountdown() {
    if (battleResultClock.rafId) {
      cancelAnimationFrame(battleResultClock.rafId);
      battleResultClock.rafId = null;
    }
    battleResultClock.active = false;
    battleResultClock.startedAt = 0;
    battleResultClock.lastLabel = null;
    renderBattleResultCountdown(null);
  }

  function battleResultCountdownFrame(ts) {
    if (!battleResultClock.active) return;
    if (!battleResultClock.startedAt) battleResultClock.startedAt = ts;
    const elapsed = (ts - battleResultClock.startedAt) / 1000;
    const secsLeft = BATTLE_RESULT_VIEW_SEC - elapsed;
    const label = secsLeft > 0 ? String(Math.ceil(secsLeft)) : null;

    if (label !== battleResultClock.lastLabel) {
      if (label) playSfx("battle_countdown_tick");
      else playSfx("battle_countdown_go");
      battleResultClock.lastLabel = label;
      renderBattleResultCountdown(label);
    }

    if (secsLeft <= 0) {
      stopBattleResultCountdown();
      const overlay = document.getElementById("battle-result-overlay");
      if (overlay && !overlay.classList.contains("hidden")) {
        document.getElementById("btn-battle-continue")?.click();
      }
      return;
    }
    battleResultClock.rafId = requestAnimationFrame(battleResultCountdownFrame);
  }

  function clearBattleResultWindow() {
    stopBattleResultCountdown();
  }

  function scheduleBattleResultWindow() {
    clearBattleResultWindow();
    const overlay = document.getElementById("battle-result-overlay");
    if (!overlay || overlay.classList.contains("hidden")) return;
    battleResultClock.active = true;
    battleResultClock.lastLabel = String(BATTLE_RESULT_VIEW_SEC);
    playSfx("battle_countdown_tick");
    renderBattleResultCountdown(String(BATTLE_RESULT_VIEW_SEC));
    battleResultClock.rafId = requestAnimationFrame(battleResultCountdownFrame);
  }

  return {
    PREP_COUNTDOWN_SEC,
    BATTLE_RESULT_VIEW_SEC,
    onPrepPhaseStarted,
    resetLobbyArming,
    tickPrepTimerAudio,
    isActive,
    cancel,
    start,
    tick,
    render,
    tryArmLobbyAutoCountdown,
    scheduleBattleResultWindow,
    clearBattleResultWindow,
  };
})();

window.PrepCountdown = PrepCountdown;
