/**
 * Скорость симуляции боя — не влияет на урон/кулдауны предметов, только dt.
 */

const BATTLE_SPEED_STORAGE_KEY = "bb_savedBattleSpeed";

type BattleSpeed = 1 | 2 | 3;

let battleSpeedMultiplier: BattleSpeed = 1;
let savedBattleSpeed: BattleSpeed = 1;
let battlePaused = false;

function parseBattleSpeed(value: number): BattleSpeed {
  return value === 2 || value === 3 ? value : 1;
}

function loadBattleSettings(): void {
  const stored = parseInt(localStorage.getItem(BATTLE_SPEED_STORAGE_KEY) || "1", 10);
  savedBattleSpeed = parseBattleSpeed(stored);
  battleSpeedMultiplier = savedBattleSpeed;
}

function setBattleSpeed(multiplier: number): void {
  const next = parseBattleSpeed(multiplier);
  battleSpeedMultiplier = next;
  savedBattleSpeed = next;
  battlePaused = false;
  localStorage.setItem(BATTLE_SPEED_STORAGE_KEY, String(next));
  updateBattleControlsUI();
}

function toggleBattlePause(): void {
  battlePaused = !battlePaused;
  updateBattleControlsUI();
}

/** dt для battleTick — 0 на паузе. */
function getBattleSimDt(rawDt: number): number {
  if (battlePaused) return 0;
  if (typeof phase !== "undefined" && phase === "replay") return 0;
  return rawDt * battleSpeedMultiplier;
}

/** dt для отсчёта 3-2-1 — всегда реальное время, без ускорения. */
function getBattleCountdownDt(rawDt: number): number {
  if (battlePaused) return 0;
  if (typeof phase !== "undefined" && phase === "replay") return 0;
  return rawDt;
}

/** dt для анимаций ударов/предметов во время боя / replay. */
function getBattleAnimDt(rawDt: number): number {
  if (battlePaused && phase !== "replay") return 0;
  if (typeof phase !== "undefined" && phase === "replay" && replayPlayback) {
    return battlePaused ? 0 : rawDt * (replayPlayback.speed || 3);
  }
  if (battlePaused) return 0;
  return rawDt * battleSpeedMultiplier;
}

function resetBattlePause(): void {
  battlePaused = false;
}

function isBattlePaused(): boolean {
  return battlePaused;
}
