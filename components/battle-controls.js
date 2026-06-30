/**
 * Панель управления боем.
 */

function initBattleControls(handlers) {
  const panel = document.getElementById("battle-controls");
  if (!panel) return;

  document.getElementById("btn-battle-pause")?.addEventListener("click", () => {
    if (typeof playGameSfx === "function") playGameSfx("ui_toggle");
    if (phase === "replay") {
      replayPlayback.playing = !replayPlayback.playing;
      battlePaused = !replayPlayback.playing;
    } else {
      toggleBattlePause();
    }
    updateBattleControlsUI();
  });

  panel.querySelectorAll("[data-speed]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (typeof playGameSfx === "function") playGameSfx("ui_click");
      const speed = parseInt(btn.dataset.speed, 10);
      if (phase === "replay" && replayPlayback) {
        replayPlayback.speed = speed;
        savedBattleSpeed = speed;
        localStorage.setItem(BATTLE_SPEED_STORAGE_KEY, String(speed));
      } else {
        setBattleSpeed(speed);
      }
      updateBattleControlsUI();
    });
  });

  document.getElementById("btn-battle-skip")?.addEventListener("click", () => {
    if (typeof playGameSfx === "function") playGameSfx("ui_click");
    if (phase === "replay") {
      finishBattleReplay();
      return;
    }
    handlers?.onSkip?.();
  });

  loadBattleSettings();
  updateBattleControlsUI();
}

function setBattleControlsVisible(visible) {
  document.getElementById("battle-controls")?.classList.toggle("hidden", !visible);
}

function updateBattleControlsUI() {
  const panel = document.getElementById("battle-controls");
  if (!panel) return;

  const activeSpeed = phase === "replay"
    ? (replayPlayback?.speed || savedBattleSpeed)
    : battleSpeedMultiplier;

  panel.querySelectorAll("[data-speed]").forEach((btn) => {
    const speed = parseInt(btn.dataset.speed, 10);
    btn.classList.toggle("active", speed === activeSpeed && !battlePaused);
  });

  const pauseBtn = document.getElementById("btn-battle-pause");
  if (pauseBtn) {
    const paused = phase === "replay" ? !replayPlayback?.playing : battlePaused;
    pauseBtn.textContent = paused ? "▶" : "⏸";
    pauseBtn.title = paused ? "Продолжить" : "Пауза";
    pauseBtn.classList.toggle("active", paused);
  }

  const skipBtn = document.getElementById("btn-battle-skip");
  if (skipBtn) {
    skipBtn.textContent = phase === "replay" ? "⏩ К результату" : "⏩ Пропустить";
  }
}
