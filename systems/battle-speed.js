/**
 * Скорость симуляции боя — не влияет на урон/кулдауны предметов, только dt.
 */

const BATTLE_SPEED_STORAGE_KEY = "bb_savedBattleSpeed";

let battleSpeedMultiplier = 1;
let savedBattleSpeed = 1;
let battlePaused = false;

function loadBattleSettings() {
  const stored = parseInt(localStorage.getItem(BATTLE_SPEED_STORAGE_KEY) || "1", 10);
  savedBattleSpeed = [1, 2, 3].includes(stored) ? stored : 1;
  battleSpeedMultiplier = savedBattleSpeed;
}

function setBattleSpeed(multiplier) {
  const next = [1, 2, 3].includes(multiplier) ? multiplier : 1;
  battleSpeedMultiplier = next;
  savedBattleSpeed = next;
  battlePaused = false;
  localStorage.setItem(BATTLE_SPEED_STORAGE_KEY, String(next));
  updateBattleControlsUI();
}

function toggleBattlePause() {
  battlePaused = !battlePaused;
  updateBattleControlsUI();
}

/** dt для battleTick — 0 на паузе. */
function getBattleSimDt(rawDt) {
  if (battlePaused) return 0;
  if (typeof phase !== "undefined" && phase === "replay") return 0;
  return rawDt * battleSpeedMultiplier;
}

/** dt для отсчёта 3-2-1 — всегда реальное время, без ускорения. */
function getBattleCountdownDt(rawDt) {
  if (battlePaused) return 0;
  if (typeof phase !== "undefined" && phase === "replay") return 0;
  return rawDt;
}

/** dt для анимаций ударов/предметов во время боя / replay. */
function getBattleAnimDt(rawDt) {
  if (battlePaused && phase !== "replay") return 0;
  if (typeof phase !== "undefined" && phase === "replay" && replayPlayback) {
    return battlePaused ? 0 : rawDt * (replayPlayback.speed || 3);
  }
  if (battlePaused) return 0;
  return rawDt * battleSpeedMultiplier;
}

function resetBattlePause() {
  battlePaused = false;
}
