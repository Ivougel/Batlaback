/**
 * Заглушки lobby-runtime / lobby-opponents до ленивой подгрузки бандла.
 * Полные реализации переопределяют эти функции при загрузке lobby-runtime.js.
 */
import type { BattleSide } from "../types/game";

function getDisplayBattleState(): object | null {
  return typeof battleState !== "undefined" ? battleState ?? null : null;
}

function getLobbySpectateProfileNames(): null {
  return null;
}

function isLobby2pColumnLayoutActive(): boolean {
  return false;
}

function isLobby2pColumnPrepLayout(): boolean {
  return false;
}

function getLobby2pColumnGridOrigin(): number {
  return 0;
}

function lobby2pColumnInset(): number {
  return 0;
}

function syncLobby2pHudDom(): void {}

function renderLobby2pCommerce(): void {}

function syncLobby2pBothFromGlobals(): void {}

function importLobby2pHumanToGlobals(): void {}

function drawLobby2pSplitPrep(): void {}

function drawLobby2pSideBattleFx(): void {}

function setLobby2pActiveHuman(): void {}

function lobby2pHasActiveDuel(): boolean {
  return false;
}

function lobby2pHasSideBattle(): boolean {
  return false;
}

function lobby2pHasAnySideBattle(): boolean {
  return false;
}

function lobby2pSideFromCanvasX(): BattleSide {
  return "player";
}

function lobby2pSideFromHudTarget(_target: Element | null): BattleSide | null {
  return null;
}

function lobby2pSideFromCommerceTarget(target: Element | null): BattleSide | null {
  return lobby2pSideFromHudTarget(target);
}

function ensureLobby2pActiveHumanForSide(_side: BattleSide): void {}

function resolveShopCardElement(_side: BattleSide, index: number): Element | null {
  return document.querySelector(`#shop-slots .shop-card[data-index="${index}"]`)
    || document.querySelector(`.shop-card[data-index="${index}"]`);
}

function resolveBenchCardElement(_side: BattleSide, index: number): Element | null {
  return document.querySelector(`#bench-slots .bench-card[data-bench="${index}"]`);
}

function initLobbyRun(): void {}

function initLobby2pRun(): void {}

function getLobbyPlayer(): null {
  return null;
}

function getLobbyOpponent(): null {
  return null;
}

function getLobbyFighterById(): null {
  return null;
}

function getLobbyHumanFighter(): null {
  return null;
}

function getAliveLobbyFighters(): never[] {
  return [];
}

function getLobby2pShopPopoverHuman(): number {
  return 0;
}

function getLobby2pBenchPopoverHuman(): number {
  return 0;
}

function syncLobby2pShopFabExpanded(): void {}

function syncLobby2pBenchFabExpanded(): void {}

function syncLobby2pBenchFabBadges(): void {}

function toggleLobby2pBench(): void {}

function bindLobbyRosterClicks(): void {}

function bindLobby2pBattleTabs(): void {}

function initLobby2pHudBridge(): void {}

function stopLobbyPrepTimer(): void {}

function resetLobbyPrepTimer(): void {}

function renderLobbyChrome(): void {}

function syncPrepBottomBarChrome(): void {}

function syncPrepBottomStats(): void {}

function rollbackPreparedBattleStart(): void {}
