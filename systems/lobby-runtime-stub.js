// Transpiled from TypeScript — npm run compile:ts

function getDisplayBattleState() {
  return typeof battleState !== "undefined" ? battleState ?? null : null;
}
function getLobbySpectateProfileNames() {
  return null;
}
function isLobby2pColumnLayoutActive() {
  return false;
}
function isLobby2pColumnPrepLayout() {
  return false;
}
function getLobby2pColumnGridOrigin() {
  return 0;
}
function lobby2pColumnInset() {
  return 0;
}
function syncLobby2pHudDom() {
}
function renderLobby2pCommerce() {
}
function syncLobby2pBothFromGlobals() {
}
function importLobby2pHumanToGlobals() {
}
function drawLobby2pSplitPrep() {
}
function drawLobby2pSideBattleFx() {
}
function setLobby2pActiveHuman() {
}
function lobby2pHasActiveDuel() {
  return false;
}
function lobby2pHasSideBattle() {
  return false;
}
function lobby2pHasAnySideBattle() {
  return false;
}
function lobby2pSideFromCanvasX() {
  return "player";
}
function lobby2pSideFromHudTarget(_target) {
  return null;
}
function lobby2pSideFromCommerceTarget(target) {
  return lobby2pSideFromHudTarget(target);
}
function ensureLobby2pActiveHumanForSide(_side) {
}
function resolveShopCardElement(_side, index) {
  return document.querySelector(`#shop-slots .shop-card[data-index="${index}"]`) || document.querySelector(`.shop-card[data-index="${index}"]`);
}
function resolveBenchCardElement(_side, index) {
  return document.querySelector(`#bench-slots .bench-card[data-bench="${index}"]`);
}
function initLobbyRun() {
}
function initLobby2pRun() {
}
function getLobbyPlayer() {
  return null;
}
function getLobbyOpponent() {
  return null;
}
function getLobbyFighterById() {
  return null;
}
function getLobbyHumanFighter() {
  return null;
}
function getAliveLobbyFighters() {
  return [];
}
function getLobby2pShopPopoverHuman() {
  return 0;
}
function getLobby2pBenchPopoverHuman() {
  return 0;
}
function syncLobby2pShopFabExpanded() {
}
function syncLobby2pBenchFabExpanded() {
}
function syncLobby2pBenchFabBadges() {
}
function toggleLobby2pBench() {
}
function bindLobbyRosterClicks() {
}
function bindLobby2pBattleTabs() {
}
function initLobby2pHudBridge() {
}
function stopLobbyPrepTimer() {
}
function resetLobbyPrepTimer() {
}
function renderLobbyChrome() {
}
function syncPrepBottomBarChrome() {
}
function syncPrepBottomStats() {
}
function rollbackPreparedBattleStart() {
}
