/**
 * Таймер подготовки: звуки (старт, −10с, −5с), отсчёт 3-2-1 перед боем.
 * Итоги боя — окно просмотра 6 с, затем авто-«Продолжить».
 */
interface CountdownState {
  active: boolean;
  remaining: number;
  label: string | null;
  onComplete: (() => void) | null;
  startedAt: number;
}

interface BattleResultClock {
  active: boolean;
  rafId: number | null;
  timerId: ReturnType<typeof setTimeout> | null;
  startedAt: number;
  lastLabel: string | null;
}

const PrepCountdown = (() => {
  const PREP_COUNTDOWN_SEC = 3;
  const BATTLE_RESULT_VIEW_SEC = 6;
  const COUNTDOWN_STALE_MS = 5000;

  let countdown: CountdownState = {
    active: false,
    remaining: 0,
    label: null,
    onComplete: null,
    startedAt: 0,
  };
  let audioPhaseKey = "";
  let audioTenPlayed = false;
  let audioFivePlayed = false;

  function playSfx(id: string): void {
    if (typeof playGameSfx === "function") playGameSfx(id);
  }

  function resetAudioMarks(phaseKey: string): void {
    audioPhaseKey = phaseKey || "";
    audioTenPlayed = false;
    audioFivePlayed = false;
  }

  function onPrepPhaseStarted(phaseKey: string): void {
    resetAudioMarks(phaseKey);
    playSfx("prep_phase_start");
  }

  function tickPrepTimerAudio(remainingSec: number, active: boolean, phaseKey?: string): void {
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

  function isActive(): boolean {
    return countdown.active;
  }

  function cancel(): void {
    countdown.active = false;
    countdown.remaining = 0;
    countdown.label = null;
    countdown.onComplete = null;
    countdown.startedAt = 0;
    if (typeof hideBattleCountdownOverlay === "function") hideBattleCountdownOverlay();
  }

  function render(): void {
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

  function start(onComplete?: () => void): void {
    cancel();
    countdown = {
      active: true,
      remaining: PREP_COUNTDOWN_SEC,
      label: "3",
      onComplete: typeof onComplete === "function" ? onComplete : null,
      startedAt: Date.now(),
    };
    playSfx("battle_countdown_tick");
    render();
  }

  function finishCountdown(): boolean {
    const cb = countdown.onComplete;
    cancel();
    if (cb) cb();
    return true;
  }

  function tick(dt: number): boolean {
    if (!countdown.active) return false;
    if (countdown.startedAt && Date.now() - countdown.startedAt > COUNTDOWN_STALE_MS) {
      console.warn("PrepCountdown stale — forcing battle start");
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

  let battleResultClock: BattleResultClock = {
    active: false,
    rafId: null,
    timerId: null,
    startedAt: 0,
    lastLabel: null,
  };

  function battleResultCountdownGapMs(): number {
    if (typeof BattleFxTier !== "undefined" && BattleFxTier.battleResultCountdownTickMs) {
      return BattleFxTier.battleResultCountdownTickMs();
    }
    return 250;
  }

  function clearBattleResultCountdownTimer(): void {
    if (battleResultClock.rafId) {
      cancelAnimationFrame(battleResultClock.rafId);
      battleResultClock.rafId = null;
    }
    if (battleResultClock.timerId) {
      clearTimeout(battleResultClock.timerId);
      battleResultClock.timerId = null;
    }
  }

  function renderBattleResultCountdown(label: string | null): void {
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

  function stopBattleResultCountdown(): void {
    clearBattleResultCountdownTimer();
    battleResultClock.active = false;
    battleResultClock.startedAt = 0;
    battleResultClock.lastLabel = null;
    renderBattleResultCountdown(null);
  }

  function battleResultCountdownTick(ts?: number): void {
    if (!battleResultClock.active) return;
    if (typeof isBattleResultFrozen === "function" && isBattleResultFrozen()) {
      battleResultClock.timerId = setTimeout(() => battleResultCountdownTick(performance.now()), 250);
      return;
    }
    if (!battleResultClock.startedAt) battleResultClock.startedAt = ts ?? performance.now();
    const elapsed = ((ts ?? performance.now()) - battleResultClock.startedAt) / 1000;
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

  function clearBattleResultWindow(): void {
    stopBattleResultCountdown();
  }

  function scheduleBattleResultWindow(): void {
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
    clearBattleResultWindow,
  };
})();

window.PrepCountdown = PrepCountdown;
