// Transpiled from TypeScript — npm run compile:ts

const PrepCountdown = /* @__PURE__ */ (() => {
  const PREP_COUNTDOWN_SEC = 3;
  const BATTLE_RESULT_VIEW_SEC = 6;
  const COUNTDOWN_STALE_MS = 5e3;
  let countdown = {
    active: false,
    remaining: 0,
    label: null,
    onComplete: null,
    startedAt: 0
  };
  let audioPhaseKey = "";
  let audioTenPlayed = false;
  let audioFivePlayed = false;
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
    playSfx("prep_phase_start");
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
    countdown.startedAt = 0;
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
        countdown: { active: true, label: countdown.label }
      });
    }
    const overlay = document.getElementById("battle-countdown-overlay");
    overlay?.classList.toggle(
      "battle-countdown-overlay--prep",
      document.getElementById("app")?.dataset?.phase === "prep"
    );
  }
  function start(onComplete) {
    cancel();
    countdown = {
      active: true,
      remaining: PREP_COUNTDOWN_SEC,
      label: "3",
      onComplete: typeof onComplete === "function" ? onComplete : null,
      startedAt: Date.now()
    };
    playSfx("battle_countdown_tick");
    render();
  }
  function finishCountdown() {
    const cb = countdown.onComplete;
    cancel();
    if (cb) cb();
    return true;
  }
  function tick(dt) {
    if (!countdown.active) return false;
    if (countdown.startedAt && Date.now() - countdown.startedAt > COUNTDOWN_STALE_MS) {
      console.warn("PrepCountdown stale \u2014 forcing battle start");
      return finishCountdown();
    }
    const prevLabel = countdown.label;
    countdown.remaining -= dt;
    const left = Math.ceil(Math.max(0, countdown.remaining));
    countdown.label = left > 0 ? String(left) : null;
    if (countdown.label !== prevLabel) {
      if (countdown.label) playSfx("battle_countdown_tick");
      else playSfx("battle_countdown_go");
      render();
    }
    if (countdown.remaining <= 0) return finishCountdown();
    return false;
  }
  let battleResultClock = {
    active: false,
    rafId: null,
    timerId: null,
    startedAt: 0,
    lastLabel: null
  };
  function battleResultCountdownGapMs() {
    if (typeof BattleFxTier !== "undefined" && BattleFxTier.battleResultCountdownTickMs) {
      return BattleFxTier.battleResultCountdownTickMs();
    }
    return 250;
  }
  function clearBattleResultCountdownTimer() {
    if (battleResultClock.rafId) {
      cancelAnimationFrame(battleResultClock.rafId);
      battleResultClock.rafId = null;
    }
    if (battleResultClock.timerId) {
      clearTimeout(battleResultClock.timerId);
      battleResultClock.timerId = null;
    }
  }
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
    digit.setAttribute("aria-label", `\u0414\u043E \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0435\u043D\u0438\u044F ${label} \u0441\u0435\u043A\u0443\u043D\u0434`);
    if (digit.textContent !== label) {
      digit.textContent = label;
      digit.classList.remove("battle-result-countdown-digit--pop");
      void digit.offsetWidth;
      digit.classList.add("battle-result-countdown-digit--pop");
    }
  }
  function stopBattleResultCountdown() {
    clearBattleResultCountdownTimer();
    battleResultClock.active = false;
    battleResultClock.startedAt = 0;
    battleResultClock.lastLabel = null;
    renderBattleResultCountdown(null);
  }
  function battleResultCountdownTick(ts) {
    if (!battleResultClock.active) return;
    if (typeof isBattleResultFrozen === "function" && isBattleResultFrozen()) {
      battleResultClock.timerId = setTimeout(() => battleResultCountdownTick(performance.now()), 250);
      return;
    }
    if (!battleResultClock.startedAt) battleResultClock.startedAt = ts ?? performance.now();
    const elapsed = ((ts ?? performance.now()) - battleResultClock.startedAt) / 1e3;
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
    const gap = battleResultCountdownGapMs();
    battleResultClock.timerId = setTimeout(() => battleResultCountdownTick(performance.now()), gap);
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
    battleResultCountdownTick(performance.now());
  }
  return {
    PREP_COUNTDOWN_SEC,
    BATTLE_RESULT_VIEW_SEC,
    onPrepPhaseStarted,
    tickPrepTimerAudio,
    isActive,
    cancel,
    start,
    tick,
    render,
    scheduleBattleResultWindow,
    clearBattleResultWindow
  };
})();
window.PrepCountdown = PrepCountdown;
