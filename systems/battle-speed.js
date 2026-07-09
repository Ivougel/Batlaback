// Transpiled from TypeScript — npm run compile:ts

const BATTLE_SPEED_STORAGE_KEY = "bb_savedBattleSpeed";
let battleSpeedMultiplier = 1;
let savedBattleSpeed = 1;
let battlePaused = false;
function parseBattleSpeed(value) {
  return value === 2 || value === 3 ? value : 1;
}
function loadBattleSettings() {
  const stored = parseInt(localStorage.getItem(BATTLE_SPEED_STORAGE_KEY) || "1", 10);
  savedBattleSpeed = parseBattleSpeed(stored);
  battleSpeedMultiplier = savedBattleSpeed;
}
function setBattleSpeed(multiplier) {
  const next = parseBattleSpeed(multiplier);
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
function getBattleSimDt(rawDt) {
  if (battlePaused) return 0;
  if (typeof phase !== "undefined" && phase === "replay") return 0;
  return rawDt * battleSpeedMultiplier;
}
function getBattleCountdownDt(rawDt) {
  if (battlePaused) return 0;
  if (typeof phase !== "undefined" && phase === "replay") return 0;
  return rawDt;
}
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
function isBattlePaused() {
  return battlePaused;
}
