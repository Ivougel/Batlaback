/**
 * Backpack Battles — браузерный автобатлер с рюкзаком
 */

const GRID_COLS = 7;
const GRID_ROWS = 9;
const FRAME_EDGE = 2;
const SHOP_FIELD_GAP = 12;
const BACKPACK_COLS = GRID_COLS;
const BACKPACK_ROWS = GRID_ROWS;
const START_GOLD = 12;
const ROUND_GOLD = 10;
const WIN_GOLD = 3;

/** Читаются из CSS (--cell-size, --cell-gap, …) и пересчитываются на resize. */
let GRID_CELL = 46;
let GRID_CELL_GAP = 1;
let GRID_STRIDE = 47;
let FRAME_PAD = 8;
let FRAME_TITLE_H = 22;
let GRID_INNER_W = 807;
let GRID_INNER_H = 627;
let BACKPACK_Y = 0;
let GRID_TOP_Y = 0;
let GRID_PLAYER_X = 0;
let PLAYER_X = 0;
let PLAYER_FIELD_OUTER_W = 823;
let PREP_CANVAS_W = 422;
let PREP_CANVAS_H = 328;
let GRID_GAP = 108;
let ENEMY_X = 939;
let GAP_W = 108;
let BATTLE_CANVAS_W = 1762;
let BATTLE_CANVAS_H = 657;
let CANVAS_H = BATTLE_CANVAS_H;
let CANVAS_W = BATTLE_CANVAS_W;
let CELL = GRID_CELL;

function readCssPx(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const val = parseFloat(raw);
  return Number.isFinite(val) ? val : fallback;
}

function applyGridMetricsFromCss() {
  GRID_CELL = readCssPx("--cell-size", 46);
  GRID_CELL_GAP = readCssPx("--cell-gap", 1);
  FRAME_PAD = readCssPx("--frame-pad", 8);
  FRAME_TITLE_H = readCssPx("--frame-title-h", 22);
  GRID_GAP = readCssPx("--grid-gap", 36);

  GRID_STRIDE = GRID_CELL + GRID_CELL_GAP;
  CELL = GRID_CELL;
  GRID_INNER_W = GRID_COLS * GRID_CELL + (GRID_COLS - 1) * GRID_CELL_GAP;
  GRID_INNER_H = GRID_ROWS * GRID_CELL + (GRID_ROWS - 1) * GRID_CELL_GAP;

  PREP_CANVAS_W = GRID_INNER_W;
  PREP_CANVAS_H = GRID_INNER_H;

  GRID_PLAYER_X = 0;
  PLAYER_X = 0;
  BACKPACK_Y = 0;
  GRID_TOP_Y = 0;
  PLAYER_FIELD_OUTER_W = GRID_INNER_W;
  ENEMY_X = GRID_INNER_W + GRID_GAP;
  GAP_W = GRID_GAP;
  BATTLE_CANVAS_W = GRID_INNER_W + GRID_GAP + GRID_INNER_W;
  BATTLE_CANVAS_H = GRID_INNER_H;
  CANVAS_W = BATTLE_CANVAS_W;
  CANVAS_H = BATTLE_CANVAS_H;

  layoutCell = GRID_CELL;
  layoutPlayerX = GRID_PLAYER_X;
  layoutCanvasH = canvas ? canvas.height : BATTLE_CANVAS_H;

  if (canvas) {
    applyPhaseCanvasLayout();
    syncBattleArenaLayout();
    if (phase === "prep") draw();
  }
}

window.applyGridMetricsFromCss = applyGridMetricsFromCss;

let canvas, ctx, fxCanvas, fxCtx;
let lastGameLoopDt = 0.016;
let phase = "prep";
let layoutCell = GRID_CELL;
let layoutPlayerX = GRID_PLAYER_X;
let layoutCanvasH = CANVAS_H;
let round = 1;
let gold = START_GOLD;
let shop = Array(MAX_SHOP).fill(null);
let shopFrozen = Array(MAX_SHOP).fill(false);
let shopReadyForRound = 0;
let bench = [];
let playerContainers = [];
let playerItems = [];
let enemyContainers = [];
let enemyItems = [];
let enemyGold = START_GOLD;
let enemyBench = [];
let enemyArchetype = null;
let enemyClass = null;
let playerClass = null;
let pendingPlayerCompanionId = null;
let playerCompanionId = "s_stranger";
let enemyCompanionId = "s_stranger";
let playerMutationFormId = null;
let playerMutationId = null;
let enemyMutationFormId = null;
let enemyMutationId = null;
let playerEnhancements = typeof createEmptyEnhancementLoadout === "function"
  ? createEmptyEnhancementLoadout()
  : { head: null, chest: null, boots: null };
let enemyEnhancements = typeof createEmptyEnhancementLoadout === "function"
  ? createEmptyEnhancementLoadout()
  : { head: null, chest: null, boots: null };
let goldSpentTotal = 0;
let goldEarnedTotal = 0;
let recentBattleResults = [];
let battleStartTime = 0;
let battleState = null;
let dragPayload = null;
let dragFrom = null;
let prepSidebarDragUnlocked = false;
/** Текущая «липкая» клетка при управлении из коридора (гистерезис, без скачков). */
let prepSidebarStickyHover = null;
let selectedBench = -1;
let gameOver = false;
let hoverCell = null;
let hoverSlot = null;
let prepDropPreviewHover = null;
let mousePos = { x: 0, y: 0 };
let dragGhostCanvas = null;
let dragGhostCtx = null;
const DRAG_GHOST_CANVAS_SIZE = uiPx(88);
let lastPointerClient = { x: 0, y: 0 };
let gamepadBoardFocus = null;
let synergyAnimTime = 0;
let synergyPreviewBuilt = null;
let tooltipItem = null;
let fieldTooltipVisible = false;
let prepTooltipsEnabled = true;
let lastGamepadPrepFocus = null;
let sidebarTooltipSource = null;
let sidebarTooltipPinned = false;
let tooltipDismissGesture = null;
let lastRoundStats = null;
let pendingGameOver = false;
let lastBattleReplay = null;
let lastBattlePrepSnapshot = null;
let replayPlayback = null;

/** Освобождает тяжёлые replay-кадры (PWA / iPad OOM). Лог и summary остаются. */
function releasePreviousBattleReplayFrames() {
  if (!lastBattleReplay) return;
  lastBattleReplay.frames = [];
  lastBattleReplay.prepSnapshot = null;
}
let runResults = [];
let runItemStats = createEmptyRunItemStats();
let battleEndHandled = false;
let pendingShopDrag = null;
let pendingBenchDrag = null;
let pendingEnhancementDrag = null;
let enhancementSlotDidDrag = false;
let pendingCanvasPick = null;
let shopDidDrag = false;
let lastTouchEventAt = 0;
const TOOLTIP_CONFIG = {
  moveTolerance: 20,
  hideDelay: 250,
  touchPadding: 16,
};
const MOUSE_DRAG_THRESHOLD_PX = 5;
const TOUCH_DRAG_THRESHOLD_PX = 4;
let touchTapGesture = null;
let tooltipHideTimer = null;
let suppressShopClickUntil = 0;
let opponentMode = "ai";
let gameMode = "solo";
let lobbyState = null;
let lobbyViewFighterId = 0;
let lobbyMatches = [];
let lobbySpectateMatchId = 0;
/** @type {Map<number, number>} */
let lobbyBackgroundSimAcc = new Map();
let lobbyPrepTimerRemaining = 0;
let lobbyPrepTimerActive = false;
let lobbyPrepOvertimeUsed = false;
let lobbyTimerBattleQueued = false;
let lobbyRoundSettling = false;
let lastLobbyPlayerBattleWinner = null;
let lastLobbyRosterStripSig = "";
let lastLobbyRosterStripPhase = "";
let lastEndedBattleState = null;
let prepViewSide = "player";
let prepDollOpen = false;

function playPrepSfx(id, opts) {
  if (typeof playGameSfx === "function") playGameSfx(id, opts);
}

function setPrepDollOpen(open) {
  prepDollOpen = !!open;
  const app = document.getElementById("app");
  const btn = document.getElementById("btn-toggle-doll");
  const layer = document.getElementById("prep-doll-layer");
  if (app) {
    if (prepDollOpen) app.setAttribute("data-doll-open", "true");
    else app.removeAttribute("data-doll-open");
  }
  if (btn) {
    btn.classList.toggle("active", prepDollOpen);
    btn.setAttribute("aria-expanded", prepDollOpen ? "true" : "false");
  }
  if (layer) {
    layer.classList.toggle("doll-open", prepDollOpen);
    layer.setAttribute("aria-hidden", prepDollOpen ? "false" : "true");
  }
  if (!prepDollOpen && sidebarTooltipSource === "doll") hideSidebarTooltip();
}

function togglePrepDollOpen(e) {
  e?.preventDefault();
  e?.stopPropagation();
  const app = document.getElementById("app");
  const layer = document.getElementById("prep-doll-layer");
  const isOpen = app?.getAttribute("data-doll-open") === "true"
    || layer?.classList.contains("doll-open");
  setPrepDollOpen(!isOpen);
}
let selectedGameMode = "solo";
let selectedOpponentMode = "ai";
/** Выбранное испытание кампании в интро. */
let selectedCampaignTrial = "build-trial";
let campaignShopOptions = { allowRefresh: true, allowSell: true };
let selectedEnemyClass = null;
let pendingPlayerClass = null;
let pendingMutationIntentId = null;
let enemyShop = Array(MAX_SHOP).fill(null);
let enemyShopFrozen = Array(MAX_SHOP).fill(false);
let enemyShopReadyForRound = 0;
let playerPendingShopBuffs = 0;
let enemyPendingShopBuffs = 0;
let playerBonusUniqueGranted = false;
let enemyBonusUniqueGranted = false;

function getSideState(side = prepViewSide) {
  if (side === "enemy") {
    return {
      side: "enemy",
      get gold() { return enemyGold; },
      set gold(value) { enemyGold = value; },
      shop: enemyShop,
      shopFrozen: enemyShopFrozen,
      get shopReadyForRound() { return enemyShopReadyForRound; },
      set shopReadyForRound(value) { enemyShopReadyForRound = value; },
      bench: enemyBench,
      get containers() { return enemyContainers; },
      set containers(value) { enemyContainers = value; },
      get items() { return enemyItems; },
      set items(value) { enemyItems = value; },
      get classId() { return enemyClass; },
      get pendingShopBuffs() { return enemyPendingShopBuffs; },
      set pendingShopBuffs(value) { enemyPendingShopBuffs = value; },
      get bonusUniqueGranted() { return enemyBonusUniqueGranted; },
      set bonusUniqueGranted(value) { enemyBonusUniqueGranted = value; },
    };
  }
  return {
    side: "player",
    get gold() { return gold; },
    set gold(value) { gold = value; },
    shop,
    shopFrozen,
    get shopReadyForRound() { return shopReadyForRound; },
    set shopReadyForRound(value) { shopReadyForRound = value; },
    bench,
    get containers() { return playerContainers; },
    set containers(value) { playerContainers = value; },
    get items() { return playerItems; },
    set items(value) { playerItems = value; },
    get classId() { return playerClass; },
    get pendingShopBuffs() { return playerPendingShopBuffs; },
    set pendingShopBuffs(value) { playerPendingShopBuffs = value; },
    get bonusUniqueGranted() { return playerBonusUniqueGranted; },
    set bonusUniqueGranted(value) { playerBonusUniqueGranted = value; },
  };
}

function isVersusMode() {
  return gameMode === "versus";
}

function isHardBotMode() {
  return gameMode === "hardbot";
}

function isLobbyMode() {
  return gameMode === "lobby";
}

function isLobby2pMode() {
  return gameMode === "lobby2p";
}

function isAnyLobbyMode() {
  return isLobbyMode() || isLobby2pMode();
}

function isCampaignMode() {
  return gameMode === "campaign";
}

function isPrepHeroHudVisible() {
  return phase === "prep" && isPrepHeroCardHud();
}

function shouldEnableBattlePrepHeroLayer() {
  const app = document.getElementById("app");
  const root = document.documentElement;
  if (!app || (app.dataset.phase !== "battle" && app.dataset.phase !== "replay")) return false;
  if (root.dataset.prepLayout === "mobile") return false;
  if (root.dataset.uiSurface !== "tablet-side" && root.dataset.uiSurface !== "desktop") return false;
  if (root.dataset.battleHeroPlacement && root.dataset.battleHeroPlacement !== "flank-arena") return false;
  return true;
}

function syncBattlePrepHeroLayerDom() {
  const root = document.documentElement;
  const enabled = shouldEnableBattlePrepHeroLayer();
  if (enabled) root.dataset.battlePrepHeroLayer = "true";
  else root.removeAttribute("data-battle-prep-hero-layer");
  return enabled;
}

function syncPrepHeroHudDom() {
  const app = document.getElementById("app");
  if (!app) return;
  app.removeAttribute("data-prep-hero-hud");
  if (typeof syncPrepHudCollapseChrome === "function") syncPrepHudCollapseChrome();
}

function getEnemyDisplayName() {
  if (isLobbyMode() && isBattleUiPhase() && lobbyMatches.length) {
    const names = getLobbySpectateProfileNames();
    if (names) return names.enemyName;
  }
  if (isLobbyMode() && phase === "prep" && lobbyState) {
    const fighter = getLobbyFighterById(lobbyState, lobbyViewFighterId);
    if (fighter && !fighter.isHuman) return fighter.name;
    return getLobbyOpponent(lobbyState)?.name || "Соперник";
  }
  if (isLobbyMode()) return getLobbyOpponent(lobbyState)?.name || "Соперник";
  if (isVersusMode()) return "Игрок 2";
  if (isHardBotMode()) return "Сложный бот";
  if (isCampaignMode()) return "Манекен";
  return "ИИ";
}

function getPlayerProfileName() {
  if (isLobbyMode() && isBattleUiPhase() && lobbyMatches.length) {
    const names = getLobbySpectateProfileNames();
    if (names) return names.playerName;
  }
  if (isLobbyMode() && phase === "prep" && lobbyState) {
    const fighter = getLobbyFighterById(lobbyState, lobbyViewFighterId);
    if (fighter?.isHuman) return "Вы";
    if (fighter) return fighter.name;
  }
  return isVersusMode() ? "Игрок 1" : "Игрок";
}

function isEnemyPrepEditable() {
  return opponentMode === "manual";
}

function isLobbyViewingPlayer() {
  return isLobbyMode() && lobbyState && lobbyViewFighterId === lobbyState.playerId;
}

function canEditPrepSide(side = prepViewSide) {
  if (isLobby2pMode() && lobbyState?.isSplitLobby) {
    if (lobby2pHasActiveDuel()) return false;
    if (side === "player") return !lobby2pHasSideBattle(0);
    if (side === "enemy") return !lobby2pHasSideBattle(1);
    return false;
  }
  if (isLobbyMode()) return isLobbyViewingPlayer() && side === "player";
  if (side === "player") return true;
  return isEnemyPrepEditable();
}

function getPrepFieldTeam() {
  return prepViewSide;
}

function initManualEnemyState() {
  enemyClass = selectedEnemyClass || enemyClass || pickRandomClassId();
  enemyArchetype = AI_ARCHETYPES[enemyClass] || AI_ARCHETYPES.warrior;
  enemyGold = START_GOLD;
  enemyBench = [];
  enemyContainers = createStartingContainers();
  enemyItems = applyClassStarters(enemyContainers, [], enemyClass);
  enemyShop = Array(MAX_SHOP).fill(null);
  enemyShopFrozen = Array(MAX_SHOP).fill(false);
  enemyShopReadyForRound = 0;
  resetShopForNewRoundForSide("enemy");
}

function applyManualEnemyRoundGold(battleWinner) {
  const enemyBattleWon = battleWinner === "enemy";
  if (enemyBattleWon) enemyGold += ROUND_GOLD + WIN_GOLD;
  else enemyGold += ROUND_GOLD;
  resetShopForNewRoundForSide("enemy");
}

function applyLobbyGhostToEnemy() {
  const ghost = exportGhostFighterState(getLobbyOpponent(lobbyState));
  if (!ghost) return;
  enemyContainers = ghost.containers;
  enemyItems = ghost.items;
  enemyClass = ghost.classId;
  enemyArchetype = ghost.archetype;
  enemyGold = ghost.gold;
  if (ghost.companionId) enemyCompanionId = ghost.companionId;
  enemyMutationFormId = ghost.mutationFormId ?? null;
  enemyMutationId = ghost.mutationId ?? null;
  if (ghost.enhancements) {
    enemyEnhancements = {
      head: ghost.enhancements.head ?? null,
      chest: ghost.enhancements.chest ?? null,
      boots: ghost.enhancements.boots ?? null,
    };
  }
}

function resetLobbyPrepTimer() {
  lobbyPrepTimerRemaining = LOBBY_PREP_SECONDS;
  lobbyPrepTimerActive = true;
  lobbyPrepOvertimeUsed = false;
}

function stopLobbyPrepTimer() {
  lobbyPrepTimerActive = false;
}

/** Автостарт по таймеру — вне gameLoop prep-тика, чтобы не блокировать кадр. */
function queueLobbyTimerBattleStart() {
  if (lobbyTimerBattleQueued) return;
  lobbyTimerBattleQueued = true;
  requestAnimationFrame(() => {
    lobbyTimerBattleQueued = false;
    if (phase !== "prep" || !canStartBattle()) return;
    startBattle();
  });
}

function rollbackPreparedBattleStart() {
  battleState = null;
  if (typeof disposeLobbyMatches === "function") disposeLobbyMatches(lobbyMatches);
  lobbyMatches = [];
  lobbyBackgroundSimAcc.clear();
}

function scheduleLobbyBackgroundRoundMatches(lobby, battleRound) {
  const pending = lobbyMatches.filter((m) => !m.byeFighterId && !m.isPlayerMatch && !m.state);
  if (!pending.length) return;
  pending.forEach((match, index) => {
    const run = () => {
      if ((phase !== "battle" && phase !== "replay") || match.state) return;
      createLobbyMatchState(match, lobby, battleRound);
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, { timeout: 320 + index * 80 });
    } else {
      setTimeout(run, index * 16);
    }
  });
}

function ensureLobbyBackgroundMatchesReady() {
  if (!isAnyLobbyMode() || !lobbyState) return;
  lobbyMatches.forEach((match) => {
    if (!match.byeFighterId && !match.state) {
      createLobbyMatchState(match, lobbyState, round);
    }
  });
}

function beginLobbyRoundBattles(battleRound) {
  if (!lobbyState) throw new Error("lobby state missing");
  if (typeof syncAllLobbyFighterMutations === "function") {
    syncAllLobbyFighterMutations(lobbyState, battleRound);
  }
  if (typeof disposeLobbyMatches === "function") disposeLobbyMatches(lobbyMatches);
  lobbyMatches = [];
  lobbyBackgroundSimAcc.clear();

  if (isLobby2pMode()) {
    lobbyMatches = buildLobby2pRoundMatches(lobbyState);
    lobbyMatches.forEach((match) => {
      if (!match.byeFighterId) createLobbyMatchState(match, lobbyState, battleRound);
    });
  } else {
    lobbyMatches = buildLobbyRoundMatches(lobbyState);
    const playerMatch = lobbyMatches.find((m) => m.isPlayerMatch);
    if (!playerMatch || playerMatch.byeFighterId) throw new Error("lobby player match missing");
    createLobbyMatchState(playerMatch, lobbyState, battleRound);
    scheduleLobbyBackgroundRoundMatches(lobbyState, battleRound);
  }

  const playerIdx = isLobby2pMode()
    ? lobbyMatches.findIndex((m) => m.isPlayerMatch && m.humanId === 0)
    : lobbyMatches.findIndex((m) => m.isPlayerMatch);
  lobbySpectateMatchId = playerIdx >= 0 ? playerIdx : 0;
  const playerMatch = lobbyMatches[lobbySpectateMatchId];
  if (!playerMatch?.state) throw new Error("lobby player match missing");
  battleState = playerMatch.state;
  syncLobbySpectateBoards(playerMatch);
  const app = document.getElementById("app");
  if (app) app.dataset.lobbySpectate = "yours";
  if (typeof initBattleCountdown === "function") initBattleCountdown(playerMatch.state);
}

/** Создаёт battleState до смены фазы — renderPhase() сразу видит бой. */
function prepareBattleStartState() {
  releasePreviousBattleReplayFrames();
  battleEndHandled = false;
  tooltipItem = null;
  lastRoundStats = null;
  resetBattlePause();
  applySynergyModifiersToContainers(playerContainers, playerItems);
  applySynergyModifiersToContainers(enemyContainers, enemyItems);
  lastBattlePrepSnapshot = {
    playerItems: flattenContainersForBattle(playerContainers, playerItems).map(clonePrepBattleItem),
    enemyItems: flattenContainersForBattle(enemyContainers, enemyItems).map(clonePrepBattleItem),
    playerClass,
    enemyClass,
  };
  if (typeof setBattleEnemyTeamLabel === "function") {
    setBattleEnemyTeamLabel(getEnemyDisplayName());
  }

  if (isAnyLobbyMode() && lobbyState) {
    beginLobbyRoundBattles(round);
  } else {
    battleState = createBattleState(
      lastBattlePrepSnapshot.playerItems,
      lastBattlePrepSnapshot.enemyItems,
      playerClass,
      enemyClass,
      round,
      {
        player: {
          pendingShopBuffs: playerPendingShopBuffs,
          companionId: playerCompanionId,
          mutationFormId: playerMutationFormId,
          mutationId: playerMutationId,
          enhancements: playerEnhancements,
        },
        enemy: {
          pendingShopBuffs: enemyPendingShopBuffs,
          companionId: enemyCompanionId,
          mutationFormId: enemyMutationFormId,
          mutationId: enemyMutationId,
          enhancements: enemyEnhancements,
        },
      },
    );
    if (isCampaignMode() && typeof Campaign !== "undefined") {
      Campaign.applyMannequinBattleModifiers(battleState);
    }
    battleState.recording = true;
    battleState.replayFrames = [captureBattleFrame(battleState)];
    battleState.lastRecordAt = 0;
  }

  if (typeof resetStackOrbitVfx === "function") resetStackOrbitVfx();
  battleStartTime = Date.now();
  tickBattlePresentation._at = { emotion: 0, arena: 0, orbit: 0, aura: 0 };
  if (typeof BattleHeroAnchor !== "undefined" && BattleHeroAnchor.invalidateMeasureCache) {
    BattleHeroAnchor.invalidateMeasureCache();
  }
  playerPendingShopBuffs = 0;
  enemyPendingShopBuffs = 0;
}

/** Лёгкий UI после renderPhase — без повторного renderPlayerProfiles / bootstrap. */
function finalizeBattleStartUi() {
  if (typeof window.syncHeroEmotionSlotAnchors === "function") {
    if (window.syncHeroEmotionSlotAnchors._layout) {
      window.syncHeroEmotionSlotAnchors._layout.player = "";
      window.syncHeroEmotionSlotAnchors._layout.enemy = "";
    }
    window.syncHeroEmotionSlotAnchors();
  }
  if (typeof resetEmotionEngine === "function") resetEmotionEngine();
  if (typeof resetBattleAuraFrame === "function") resetBattleAuraFrame();
  if (typeof initBattleHud === "function") initBattleHud();
  if (typeof hideBattleCountdownOverlay === "function") hideBattleCountdownOverlay();
  if (!isAnyLobbyMode() && typeof initBattleCountdown === "function" && battleState) {
    initBattleCountdown(battleState);
  }
  if (typeof initBattleDamageTracker === "function" && battleState) {
    initBattleDamageTracker(battleState);
  }
  setBattleSpeed(savedBattleSpeed);
  updateBattleControlsUI();
  setPhaseLabel("Бой!", true);
  log(`Раунд ${round}: бой!`);
  playPrepSfx("battle_start");
  renderBattleStats();
  renderFightButton();
  renderLobbyChrome();
  if (typeof queuePrewarmBattleInventoryPopover === "function") {
    requestAnimationFrame(() => queuePrewarmBattleInventoryPopover());
  }
  if (typeof updateBattleAnalyzer === "function" && battleState) {
    updateBattleAnalyzer(battleState, 0);
  }
}

function setLobbyViewFighter(fighterId) {
  if (!lobbyState) return;
  const fighter = getLobbyFighterById(lobbyState, fighterId);
  if (!fighter || (!fighter.alive && fighter.id !== lobbyState.playerId)) return;
  lobbyViewFighterId = fighter.id;
  clearDragUiState();
  closePrepHeroTooltip();
  if (fighter.isHuman) {
    prepViewSide = "player";
  } else {
    syncEnemyBoardFromLobbyFighter(fighter);
    prepViewSide = "enemy";
  }
  const app = document.getElementById("app");
  if (app) app.dataset.prepSide = prepViewSide;
  updatePrepSideUI();
  if (fighter.isHuman) ensureShopReadyForSide("player");
  renderShop();
  renderBench();
  recalcSynergies();
  draw();
  renderLobbyChrome();
}

function syncLobbyPlayerFromGlobals() {
  if (!lobbyState) return;
  importLobbyPlayerGlobals(lobbyState, {
    classId: playerClass,
    gold,
    containers: playerContainers,
    items: playerItems,
    bench,
    pendingShopBuffs: playerPendingShopBuffs,
    companionId: playerCompanionId,
    mutationFormId: playerMutationFormId,
    mutationId: playerMutationId,
    enhancements: playerEnhancements,
    round,
  });
}

function invalidateLobbySpectateLayoutCaches() {
  if (typeof BattleHeroAnchor !== "undefined" && BattleHeroAnchor.invalidateMeasureCache) {
    BattleHeroAnchor.invalidateMeasureCache();
  }
  if (typeof window.syncHeroEmotionSlotAnchors === "function") {
    if (window.syncHeroEmotionSlotAnchors._layout) {
      window.syncHeroEmotionSlotAnchors._layout.player = "";
      window.syncHeroEmotionSlotAnchors._layout.enemy = "";
    }
    window.syncHeroEmotionSlotAnchors._rootEmoji = null;
  }
}

function setLobbySpectateMatch(matchIndex) {
  if (!lobbyMatches.length) return;
  const idx = Math.max(0, Math.min(lobbyMatches.length - 1, matchIndex));
  const match = lobbyMatches[idx];
  if (!match || match.byeFighterId || !match.state) return;
  if (idx === lobbySpectateMatchId) return;

  lobbySpectateMatchId = idx;
  syncLobbySpectateBoards(match);
  const app = document.getElementById("app");
  if (app) app.dataset.lobbySpectate = match.isPlayerMatch ? "yours" : "watch";
  queueLobbySpectatePresentation();
}

function queueLobbySpectatePresentation() {
  if (queueLobbySpectatePresentation._raf) return;
  queueLobbySpectatePresentation._raf = requestAnimationFrame(() => {
    queueLobbySpectatePresentation._raf = 0;
    applyLobbySpectatePresentation();
  });
}

function applyLobbySpectatePresentation() {
  const match = lobbyMatches[lobbySpectateMatchId];
  if (!match?.state || match.byeFighterId) return;

  lastLobbyRosterStripSig = "";
  lastLobbyRosterStripPhase = "";
  renderLobbyChrome(true);
  renderPlayerProfiles({ lightSpectate: true });

  const viewState = getDisplayBattleState();
  if (viewState && typeof drawEmotionLayer === "function") {
    const elapsed = battleStartTime ? (Date.now() - battleStartTime) / 1000 : 0;
    drawEmotionLayer(null, viewState, elapsed);
  }
  if (viewState && typeof syncStackOrbitFromBattle === "function" && !viewState.finished) {
    syncStackOrbitFromBattle(viewState, { force: true });
  }
  if (viewState && typeof syncBattleAuraFrame === "function") {
    const elapsed = battleStartTime ? (Date.now() - battleStartTime) / 1000 : 0;
    syncBattleAuraFrame(viewState, elapsed);
  }
  if (typeof closeBattleInventoryPopover === "function") closeBattleInventoryPopover();
  if (typeof queuePrewarmBattleInventoryPopover === "function") queuePrewarmBattleInventoryPopover();
}

function syncLobbySpectateBoards(match) {
  if (!match || !lobbyState) return;
  const fighterA = lobbyState.fighters[match.fighterAId];
  const fighterB = lobbyState.fighters[match.fighterBId];
  if (fighterA) {
    playerContainers = fighterA.containers;
    playerItems = fighterA.items;
    playerClass = fighterA.classId;
  }
  if (fighterB) {
    enemyContainers = fighterB.containers;
    enemyItems = fighterB.items;
    enemyClass = fighterB.classId;
    enemyArchetype = fighterB.archetype;
    enemyGold = fighterB.gold;
  }
  if (typeof setBattleEnemyTeamLabel === "function") {
    setBattleEnemyTeamLabel(fighterB?.name || "Соперник");
  }
}

function getDisplayBattleState() {
  if (!isAnyLobbyMode() || !isBattleUiPhase() || !lobbyMatches.length) return battleState;
  const match = lobbyMatches[lobbySpectateMatchId];
  return match?.state || battleState;
}

function getLobbySpectateProfileNames() {
  const match = lobbyMatches[lobbySpectateMatchId];
  if (!match || !lobbyState || match.byeFighterId) return null;
  const fighterA = lobbyState.fighters[match.fighterAId];
  const fighterB = lobbyState.fighters[match.fighterBId];
  return {
    playerName: fighterA?.name || "Игрок",
    enemyName: fighterB?.name || "Соперник",
    playerClassId: fighterA?.classId,
    enemyClassId: fighterB?.classId,
    playerMutationFormId: fighterA?.mutationFormId ?? null,
    playerMutationId: fighterA?.mutationId ?? null,
    enemyMutationFormId: fighterB?.mutationFormId ?? null,
    enemyMutationId: fighterB?.mutationId ?? null,
  };
}

function returnToLobbyPlayerMatch() {
  if (!isLobbyMode() || !lobbyMatches.length) return;
  const idx = typeof findLobbyPlayerMatchIndex === "function"
    ? findLobbyPlayerMatchIndex(lobbyMatches)
    : lobbyMatches.findIndex((m) => m.isPlayerMatch);
  if (idx >= 0) setLobbySpectateMatch(idx);
}

function syncLobbyReturnTableButton() {
  const btn = document.getElementById("btn-lobby-return-table");
  if (!btn) return;
  const match = lobbyMatches[lobbySpectateMatchId];
  const watching = isLobbyMode()
    && isBattleUiPhase()
    && !!lobbyState
    && match
    && !match.byeFighterId
    && !match.isPlayerMatch;
  btn.classList.toggle("hidden", !watching);
}

function closeStandingsDropdown() {
  const btn = document.getElementById("btn-standings-toggle");
  const dropdown = document.getElementById("standings-dropdown");
  if (!dropdown || dropdown.classList.contains("hidden")) return;
  dropdown.classList.add("hidden");
  dropdown.setAttribute("aria-hidden", "true");
  dropdown.style.removeProperty("left");
  dropdown.style.removeProperty("bottom");
  dropdown.style.removeProperty("position");
  btn?.setAttribute("aria-expanded", "false");
  btn?.classList.remove("active");
}

function positionStandingsDropdown() {
  const btn = document.getElementById("btn-standings-toggle");
  const dropdown = document.getElementById("standings-dropdown");
  if (!btn || !dropdown || dropdown.classList.contains("hidden")) return;
  const rect = btn.getBoundingClientRect();
  const width = dropdown.offsetWidth || 220;
  const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
  dropdown.style.position = "fixed";
  dropdown.style.left = `${Math.round(left)}px`;
  dropdown.style.bottom = `${Math.round(window.innerHeight - rect.top + 8)}px`;
  dropdown.style.right = "auto";
}

function syncPrepBottomStats({ gold, hpLabel, roundLabel, lobbyHp = false } = {}) {
  const bar = document.getElementById("prep-bottom-stats");
  if (!bar) return;
  const show = isPrepHeroHudVisible();
  bar.toggleAttribute("hidden", !show);
  if (!show) return;
  const goldEl = document.getElementById("prep-bottom-stat-gold");
  const hpEl = document.getElementById("prep-bottom-stat-hp");
  const roundEl = document.getElementById("prep-bottom-stat-round");
  if (goldEl && gold != null) goldEl.textContent = String(gold);
  if (hpEl && hpLabel != null) hpEl.textContent = hpLabel;
  if (roundEl && roundLabel != null) roundEl.textContent = roundLabel;
  bar.classList.toggle("prep-bottom-stats--lobby-hp", !!lobbyHp);
  const roundCaption = bar.querySelector(".prep-bottom-stat--round .prep-bottom-stat-label");
  if (roundCaption) roundCaption.textContent = "Раунд";
}

function syncPrepBottomBarChrome() {
  const standingsAnchor = document.getElementById("standings-anchor");
  const isPrep = phase === "prep";
  if (isLobby2pMode() && isPrep) {
    document.getElementById("prep-bottom-stats")?.setAttribute("hidden", "");
    standingsAnchor?.toggleAttribute("hidden", true);
    return;
  }
  // В лобби список соперников — кружки с эмоциями поверх поля prep.
  const showStandings = false;
  standingsAnchor?.toggleAttribute("hidden", !showStandings);

  if (showStandings && lobbyState) {
    const countEl = document.getElementById("standings-alive-count");
    if (countEl && typeof getAliveLobbyFighters === "function") {
      countEl.textContent = String(getAliveLobbyFighters(lobbyState).length);
    }
  } else {
    closeStandingsDropdown();
  }

  if (!isPrep || !isPrepHeroCardHud()) {
    document.getElementById("prep-bottom-stats")?.setAttribute("hidden", "");
  }
}

function bindStandingsToggle() {
  const btn = document.getElementById("btn-standings-toggle");
  const dropdown = document.getElementById("standings-dropdown");
  if (!btn || !dropdown || btn.dataset.standingsBound === "true") return;
  btn.dataset.standingsBound = "true";

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const willOpen = dropdown.classList.contains("hidden");
    dropdown.classList.toggle("hidden", !willOpen);
    dropdown.setAttribute("aria-hidden", willOpen ? "false" : "true");
    btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    btn.classList.toggle("active", willOpen);
    if (willOpen) {
      requestAnimationFrame(() => positionStandingsDropdown());
    } else {
      dropdown.style.removeProperty("left");
      dropdown.style.removeProperty("bottom");
      dropdown.style.removeProperty("position");
    }
  });

  window.addEventListener("resize", () => positionStandingsDropdown(), { passive: true });

  document.addEventListener("click", (e) => {
    if (dropdown.classList.contains("hidden")) return;
    if (e.target.closest(".standings-anchor")) return;
    closeStandingsDropdown();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeStandingsDropdown();
  });
}

function renderLobbyChrome(force = false) {
  const prepFieldRoster = document.getElementById("lobby-prep-field-roster");
  const battleRosterBar = document.getElementById("lobby-battle-roster-bar");
  const stripPrep = document.getElementById("lobby-roster-strip-prep");
  const stripBattle = document.getElementById("lobby-roster-strip-battle");
  const show = isAnyLobbyMode() && !!lobbyState;
  prepFieldRoster?.classList.toggle("hidden", !show || phase !== "prep" || (isLobby2pMode() && lobbyState?.isSplitLobby));
  battleRosterBar?.classList.toggle("hidden", !show || !isBattleUiPhase());
  syncPrepBottomBarChrome();
  if (!show) {
    const bottomTimer = document.getElementById("lobby-prep-timer-bottom");
    if (bottomTimer) {
      bottomTimer.innerHTML = "";
      bottomTimer.classList.add("hidden");
    }
    syncLobbyReturnTableButton();
    return;
  }

  const rosterOpts = phase === "prep"
    ? { phase: "prep", viewFighterId: lobbyViewFighterId, round }
    : { phase: "battle", spectateMatchId: lobbySpectateMatchId, matches: lobbyMatches, layout: "bottom", round };
  const stripSig = typeof buildLobbyRosterStripSignature === "function"
    ? buildLobbyRosterStripSignature(lobbyState, rosterOpts)
    : "";
  const rosterPhaseChanged = phase !== lastLobbyRosterStripPhase;
  if (force || rosterPhaseChanged || stripSig !== lastLobbyRosterStripSig) {
    lastLobbyRosterStripSig = stripSig;
    lastLobbyRosterStripPhase = phase;
    const stripHtml = renderLobbyRosterStrip(lobbyState, rosterOpts);
    const prepStrip = typeof isLobbyRosterPrepStripHtml === "function"
      ? isLobbyRosterPrepStripHtml(stripHtml)
      : stripHtml.includes('data-lobby-fighter="');
    if (stripPrep && (phase === "prep" || prepStrip)) stripPrep.innerHTML = stripHtml;
    if (stripBattle && isBattleUiPhase()) stripBattle.innerHTML = stripHtml;
  }
  syncLobbyReturnTableButton();
  if (show && phase === "prep") {
    if (typeof syncLobbyFighterAvatars === "function") {
      syncLobbyFighterAvatars(lobbyState, rosterOpts);
    }
    if (typeof syncLobbyFighterCardHp === "function") {
      syncLobbyFighterCardHp(lobbyState, rosterOpts);
    }
  }
  const bottomTimer = document.getElementById("lobby-prep-timer-bottom");
  const heroTimer = document.getElementById("prep-hero-card-timer");
  if (heroTimer) heroTimer.innerHTML = "";
  const timerHtml = phase === "prep" && lobbyPrepTimerActive
    ? renderLobbyPrepTimerHTML(lobbyPrepTimerRemaining, true, {
      total: typeof LOBBY_PREP_SECONDS !== "undefined" ? LOBBY_PREP_SECONDS : 50,
    })
    : "";
  if (bottomTimer) {
    bottomTimer.innerHTML = timerHtml;
    bottomTimer.classList.toggle("hidden", !timerHtml);
  }
  if (isBattleUiPhase() && typeof queuePrewarmBattleInventoryPopover === "function") {
    const popoverOpen = typeof isBattleInventoryPopoverOpen === "function" && isBattleInventoryPopoverOpen();
    if (!isLobbyMode() || popoverOpen) {
      queuePrewarmBattleInventoryPopover();
    }
  }
}

function clearLobbyRosterTouchHighlights(root) {
  root?.querySelectorAll(".lobby-fighter-card--touch, .lobby-prep-field-chip--touch").forEach((el) => {
    el.classList.remove("lobby-fighter-card--touch", "lobby-prep-field-chip--touch");
  });
}

function bindLobbyRosterClicks() {
  const onRosterPointerDown = (e) => {
    if (e.button !== 0) return;
    const enemyChip = e.target.closest(
      ".lobby-fighter-card:not(.lobby-fighter-card--yours), .lobby-prep-field-chip:not(.lobby-prep-field-chip--yours)",
    );
    if (enemyChip && phase === "prep") {
      enemyChip.classList.add(
        enemyChip.classList.contains("lobby-prep-field-chip")
          ? "lobby-prep-field-chip--touch"
          : "lobby-fighter-card--touch",
      );
    }
    const fighterBtn = e.target.closest("[data-lobby-fighter]");
    if (fighterBtn && isLobbyMode() && phase === "prep" && !fighterBtn.disabled) {
      e.preventDefault();
      setLobbyViewFighter(Number(fighterBtn.dataset.lobbyFighter));
      closeStandingsDropdown();
      return;
    }
    const spectateBtn = e.target.closest("[data-lobby-spectate]");
    if (spectateBtn && isLobbyMode() && isBattleUiPhase()) {
      e.preventDefault();
      const idx = Number(spectateBtn.dataset.lobbySpectate);
      if (Number.isFinite(idx)) setLobbySpectateMatch(idx);
      return;
    }
    const fighterCard = e.target.closest("[data-lobby-fighter-card]");
    if (fighterCard && isLobbyMode() && isBattleUiPhase() && !fighterCard.disabled) {
      e.preventDefault();
      const idx = Number(fighterCard.dataset.lobbySpectate);
      if (Number.isFinite(idx)) setLobbySpectateMatch(idx);
    }
  };
  const onRosterPointerEnd = (e) => {
    clearLobbyRosterTouchHighlights(e.currentTarget);
  };
  const standingsDropdown = document.getElementById("standings-dropdown");
  standingsDropdown?.addEventListener("pointerdown", onRosterPointerDown);
  standingsDropdown?.addEventListener("pointerup", onRosterPointerEnd);
  standingsDropdown?.addEventListener("pointercancel", onRosterPointerEnd);
  standingsDropdown?.addEventListener("pointerleave", onRosterPointerEnd);
  const prepFieldRoster = document.getElementById("lobby-prep-field-roster");
  prepFieldRoster?.addEventListener("pointerdown", onRosterPointerDown);
  prepFieldRoster?.addEventListener("pointerup", onRosterPointerEnd);
  prepFieldRoster?.addEventListener("pointercancel", onRosterPointerEnd);
  prepFieldRoster?.addEventListener("pointerleave", onRosterPointerEnd);
  document.getElementById("lobby-battle-roster-bar")?.addEventListener("pointerdown", onRosterPointerDown);
  bindStandingsToggle();
  document.getElementById("btn-lobby-return-table")?.addEventListener("click", (e) => {
    e.preventDefault();
    returnToLobbyPlayerMatch();
  });
}

function initLobbyRun() {
  lobbyState = initLobby(playerClass, GRID_COLS, GRID_ROWS);
  lobbyViewFighterId = lobbyState.playerId;
  lobbyMatches = [];
  lobbySpectateMatchId = 0;
  const player = getLobbyPlayer(lobbyState);
  if (player) {
    player.companionId = playerCompanionId;
    player.enhancements = playerEnhancements;
  }
  runLobbyBotsShopPhase(lobbyState, round);
  if (typeof syncAllLobbyFighterMutations === "function") {
    syncAllLobbyFighterMutations(lobbyState, round);
  }
  pickLobbyOpponent(lobbyState);
  resetLobbyPrepTimer();
  if (typeof resetLobbyFighterThoughts === "function") resetLobbyFighterThoughts();
  if (typeof seedLobbyFighterThoughts === "function") seedLobbyFighterThoughts(lobbyState);
  if (typeof DialogueEngine !== "undefined") {
    const prepDurationSec = typeof LOBBY_PREP_SECONDS !== "undefined" ? LOBBY_PREP_SECONDS : 55;
    DialogueEngine.reset(`lobby:${lobbyState?.seed || Date.now()}`);
    DialogueEngine.onRunStart(lobbyState, round, { prepDurationSec });
  }
  setLobbyViewFighter(lobbyState.playerId);
  delete document.documentElement.dataset.lobbySplit;
  syncLobby2pHudDom();
}

function initLobby2pRun() {
  lobbyState = initLobby2p(playerClass, enemyClass, GRID_COLS, GRID_ROWS);
  lobbyViewFighterId = 0;
  lobbyMatches = [];
  lobbySpectateMatchId = 0;
  const h0 = getLobbyHumanFighter(lobbyState, 0);
  const h1 = getLobbyHumanFighter(lobbyState, 1);
  if (h0) {
    h0.companionId = playerCompanionId;
    h0.enhancements = playerEnhancements;
  }
  if (h1) {
    h1.companionId = enemyCompanionId;
    h1.enhancements = enemyEnhancements;
  }
  importLobby2pHumanToGlobals(0);
  importLobby2pHumanToGlobals(1);
  runLobbyBotsShopPhase(lobbyState, round);
  if (typeof syncAllLobbyFighterMutations === "function") {
    syncAllLobbyFighterMutations(lobbyState, round);
  }
  resetShopForNewRoundForSide("player");
  resetShopForNewRoundForSide("enemy");
  prepViewSide = "player";
  document.getElementById("app")?.setAttribute("data-prep-side", "player");
  document.documentElement.dataset.lobbySplit = "true";
  syncLobby2pHudDom();
}

function getLobby2pHumanGlobals(humanId) {
  if (humanId === 0) {
    return {
      classId: playerClass,
      gold,
      containers: playerContainers,
      items: playerItems,
      bench,
      pendingShopBuffs: playerPendingShopBuffs,
      companionId: playerCompanionId,
      mutationFormId: playerMutationFormId,
      mutationId: playerMutationId,
      enhancements: playerEnhancements,
      round,
    };
  }
  return {
    classId: enemyClass,
    gold: enemyGold,
    containers: enemyContainers,
    items: enemyItems,
    bench: enemyBench,
    pendingShopBuffs: enemyPendingShopBuffs,
    companionId: enemyCompanionId,
    mutationFormId: enemyMutationFormId,
    mutationId: enemyMutationId,
    enhancements: enemyEnhancements,
    round,
  };
}

function syncLobby2pHumanFromGlobals(humanId) {
  if (!lobbyState?.isSplitLobby) return;
  importLobbyFighterGlobals(lobbyState, humanId, getLobby2pHumanGlobals(humanId));
}

function syncLobby2pBothFromGlobals() {
  syncLobby2pHumanFromGlobals(0);
  syncLobby2pHumanFromGlobals(1);
}

function importLobby2pHumanToGlobals(humanId) {
  const fighter = getLobbyHumanFighter(lobbyState, humanId);
  if (!fighter) return;
  const ghost = exportGhostFighterState(fighter);
  if (!ghost) return;
  if (humanId === 0) {
    playerClass = ghost.classId;
    gold = ghost.gold;
    playerContainers = ghost.containers;
    playerItems = ghost.items;
    bench = fighter.bench ? fighter.bench.map((e) => (e ? { ...e } : null)) : [];
    playerCompanionId = ghost.companionId || playerCompanionId;
    playerMutationFormId = ghost.mutationFormId ?? null;
    playerMutationId = ghost.mutationId ?? null;
    if (ghost.enhancements) playerEnhancements = { ...ghost.enhancements };
  } else {
    enemyClass = ghost.classId;
    enemyGold = ghost.gold;
    enemyContainers = ghost.containers;
    enemyItems = ghost.items;
    enemyBench = fighter.bench ? fighter.bench.map((e) => (e ? { ...e } : null)) : [];
    enemyCompanionId = ghost.companionId || enemyCompanionId;
    enemyMutationFormId = ghost.mutationFormId ?? null;
    enemyMutationId = ghost.mutationId ?? null;
    if (ghost.enhancements) enemyEnhancements = { ...ghost.enhancements };
  }
}

function lobby2pHasSideBattle(humanId) {
  const sb = lobbyState?.sideBattles?.[humanId];
  return !!(sb?.state && !sb.state.finished);
}

function lobby2pHasAnySideBattle() {
  return lobby2pHasSideBattle(0) || lobby2pHasSideBattle(1);
}

function lobby2pHasActiveDuel() {
  const sb0 = lobbyState?.sideBattles?.[0];
  const sb1 = lobbyState?.sideBattles?.[1];
  return !!(sb0?.type === "duel" && sb0?.state && !sb0.state.finished)
    || !!(sb1?.type === "duel" && sb1?.state && !sb1.state.finished);
}

function lobby2pResolvePointerSide(clientX, canvasRect) {
  if (!canvasRect?.width) return prepViewSide;
  const mid = canvasRect.left + canvasRect.width / 2;
  return clientX < mid ? "player" : "enemy";
}

function setLobby2pActiveHuman(humanId) {
  if (!isLobby2pMode()) return;
  syncLobby2pHumanFromGlobals(prepViewSide === "player" ? 0 : 1);
  prepViewSide = humanId === 0 ? "player" : "enemy";
  lobbyViewFighterId = humanId;
  const app = document.getElementById("app");
  if (app) app.dataset.prepSide = prepViewSide;
  clearDragUiState();
  closePrepHeroTooltip();
  ensureShopReadyForSide(prepViewSide);
  updatePrepSideUI();
  if (isLobby2pMode() && lobbyState?.isSplitLobby) {
    renderLobby2pCommerce();
  } else {
    renderShop();
    renderBench();
  }
  recalcSynergies();
  syncLobby2pHudDom();
  draw();
}

function toggleLobby2pReady(humanId) {
  if (!lobbyState?.isSplitLobby || phase !== "prep") return;
  if (lobby2pHasSideBattle(humanId)) return;
  lobbyState.ready[humanId] = !lobbyState.ready[humanId];
  playPrepSfx(lobbyState.ready[humanId] ? "ui_confirm" : "ui_click");
  log(lobbyState.ready[humanId]
    ? `${getLobbyHumanFighter(lobbyState, humanId)?.name || "Игрок"} готов к раунду`
    : `${getLobbyHumanFighter(lobbyState, humanId)?.name || "Игрок"} снял готовность`);
  syncLobby2pHudDom();
  tryStartLobby2pScheduledRound();
}

function tryStartLobby2pScheduledRound() {
  if (!lobbyState?.isSplitLobby || phase !== "prep") return;
  if (!lobbyState.ready[0] || !lobbyState.ready[1]) return;
  if (lobby2pHasAnySideBattle()) return;
  lobbyState.ready[0] = false;
  lobbyState.ready[1] = false;
  syncLobby2pBothFromGlobals();
  syncLobby2pHudDom();
  startBattle();
}

function createLobby2pSideBattleState(humanId, opponentFighter, type) {
  const human = getLobbyHumanFighter(lobbyState, humanId);
  if (!human?.alive || !opponentFighter?.alive) return null;
  syncLobby2pBothFromGlobals();
  const humanItems = fighterBattleItems(human);
  const oppItems = fighterBattleItems(opponentFighter);
  return createBattleState(
    humanItems,
    oppItems,
    human.classId,
    opponentFighter.classId,
    round,
    {
      player: lobbyFighterPrepMeta(human),
      enemy: lobbyFighterPrepMeta(opponentFighter),
    },
  );
}

function startLobby2pFarm(humanId) {
  if (!lobbyState?.isSplitLobby || phase !== "prep") return;
  if (lobby2pHasAnySideBattle()) return;
  syncLobby2pBothFromGlobals();
  const bot = pickStrongestLobbyBot(lobbyState, [humanId]);
  if (!bot) {
    log("Нет доступных ботов для фарма");
    playPrepSfx("ui_error");
    return;
  }
  const state = createLobby2pSideBattleState(humanId, bot, "farm");
  if (!state) return;
  state.recording = humanId === 0;
  if (typeof initBattleCountdown === "function") initBattleCountdown(state);
  lobbyState.sideBattles[humanId] = { type: "farm", opponentId: bot.id, state, shared: false };
  lobbyState.ready[humanId] = false;
  log(`🌾 ${getLobbyHumanFighter(lobbyState, humanId)?.name}: фарм vs ${bot.name}`);
  playPrepSfx("battle_start");
  syncLobby2pHudDom();
  renderFightButton();
}

function startLobby2pDuel(challengerId) {
  if (!lobbyState?.isSplitLobby || phase !== "prep") return;
  if (lobby2pHasAnySideBattle()) return;
  const targetId = challengerId === 0 ? 1 : 0;
  const challenger = getLobbyHumanFighter(lobbyState, challengerId);
  const target = getLobbyHumanFighter(lobbyState, targetId);
  if (!challenger?.alive || !target?.alive) return;
  syncLobby2pBothFromGlobals();
  const state = createLobby2pSideBattleState(challengerId, target, "duel");
  if (!state) return;
  state.recording = true;
  if (typeof initBattleCountdown === "function") initBattleCountdown(state);
  const duelEntry = { type: "duel", opponentId: targetId, state, shared: true };
  lobbyState.sideBattles[0] = duelEntry;
  lobbyState.sideBattles[1] = duelEntry;
  lobbyState.ready[0] = false;
  lobbyState.ready[1] = false;
  log(`⚔️ Дуэль: ${challenger.name} vs ${target.name}`);
  playPrepSfx("battle_start");
  syncLobby2pHudDom();
  renderFightButton();
}

function finishLobby2pSideBattle(humanId, state, type) {
  if (!lobbyState?.isSplitLobby || !state?.finished) return;
  const human = getLobbyHumanFighter(lobbyState, humanId);
  const opponent = lobbyState.fighters[lobbyState.sideBattles[humanId]?.opponentId];
  if (!human || !opponent) return;

  const pseudoMatch = {
    id: -1,
    fighterAId: human.id,
    fighterBId: opponent.id,
    isPlayerMatch: true,
    state,
    finished: true,
  };
  const summary = applyLobbyMatchHpResult(lobbyState, pseudoMatch);
  importLobby2pHumanToGlobals(humanId);
  if (type === "duel" && opponent.isHuman) {
    importLobby2pHumanToGlobals(opponent.id);
  }

  if (state.winner === "player") {
    const reward = ROUND_GOLD + WIN_GOLD;
    if (humanId === 0) gold += reward;
    else enemyGold += reward;
    syncLobby2pHumanFromGlobals(humanId);
  } else if (state.winner === "enemy") {
    const reward = ROUND_GOLD;
    if (humanId === 0) gold += reward;
    else enemyGold += reward;
    syncLobby2pHumanFromGlobals(humanId);
  }

  const labels = getLobbyMatchLabels(lobbyState, pseudoMatch);
  const winnerName = state.winner === "player" ? labels.a : state.winner === "enemy" ? labels.b : null;
  if (winnerName) {
    log(`${type === "duel" ? "⚔️ Дуэль" : "🌾 Фарм"}: победа ${winnerName}${summary?.damage ? ` (−${summary.damage} HP)` : ""}`);
  } else {
    log(`${type === "duel" ? "⚔️ Дуэль" : "🌾 Фарм"}: ничья`);
  }

  if (type === "duel") {
    lobbyState.sideBattles[0] = null;
    lobbyState.sideBattles[1] = null;
  } else {
    lobbyState.sideBattles[humanId] = null;
  }
  syncLobby2pHudDom();
  renderFightButton();
  updateUI();
  if (isLobby2pRunOver(lobbyState)) {
    pendingGameOver = true;
    updateUI();
  }
}

function tickLobby2pSideBattles(dt) {
  if (!isLobby2pMode() || phase !== "prep" || !lobbyState?.isSplitLobby) return;
  const seen = new Set();
  [0, 1].forEach((humanId) => {
    const sb = lobbyState.sideBattles[humanId];
    if (!sb?.state || sb.state.finished) return;
    if (seen.has(sb.state)) return;
    seen.add(sb.state);
    const state = sb.state;
    const countdownDt = typeof getBattleCountdownDt === "function" ? getBattleCountdownDt(dt) : dt;
    if (countdownDt > 0 && typeof tickBattleCountdown === "function") {
      tickBattleCountdown(state, countdownDt);
    }
    const simDt = typeof getBattleSimDt === "function" ? getBattleSimDt(dt) : dt;
    const countdownActive = typeof isBattleCountdownActive === "function" && isBattleCountdownActive(state);
    if (simDt > 0 && !countdownActive) {
      battleTick(state, simDt);
      if (state.recording) recordBattleFrame(state);
    }
    if (state.finished) {
      finishLobby2pSideBattle(humanId, state, sb.type);
    }
  });
}

function renderLobby2pCommerce() {
  ensureShopReadyForSide("player");
  ensureShopReadyForSide("enemy");
  renderShop("player", document.getElementById("lobby2p-shop-slots-0"));
  renderShop("enemy", document.getElementById("lobby2p-shop-slots-1"));
  renderBench("player", document.getElementById("lobby2p-bench-slots-0"));
  renderBench("enemy", document.getElementById("lobby2p-bench-slots-1"));
}

function syncLobby2pHudDom() {
  if (typeof Lobby2pHud !== "undefined") Lobby2pHud.sync();
}

function initLobby2pHudBridge() {
  if (typeof Lobby2pHud === "undefined") return;
  Lobby2pHud.register({
    isActive: () => isLobby2pMode() && phase === "prep" && !!lobbyState?.isSplitLobby,
    getRound: () => round,
    getFighter: (id) => getLobbyHumanFighter(lobbyState, id),
    getClassId: (id) => (id === 0 ? playerClass : enemyClass),
    getEnhancements: (id) => (id === 0 ? playerEnhancements : enemyEnhancements),
    getItems: (id) => (id === 0 ? playerItems : enemyItems),
    getActiveHuman: () => (prepViewSide === "player" ? 0 : 1),
    getReady: (id) => !!lobbyState?.ready?.[id],
    hasSideBattle: (id) => lobby2pHasSideBattle(id),
    hasAnySideBattle: () => lobby2pHasAnySideBattle(),
    hasActiveDuel: () => lobby2pHasActiveDuel(),
    getBenchCount: (id) => {
      const arr = id === 0 ? bench : enemyBench;
      return arr.filter(Boolean).length;
    },
    setActiveHuman: (id) => setLobby2pActiveHuman(id),
    toggleReady: (id) => toggleLobby2pReady(id),
    startFarm: (id) => startLobby2pFarm(id),
    startDuel: (id) => startLobby2pDuel(id),
    refreshShop: (id) => {
      const side = id === 0 ? "player" : "enemy";
      refreshShop(true, side);
      syncLobby2pHumanFromGlobals(id);
      renderLobby2pCommerce();
      syncLobby2pHudDom();
    },
    renderCommerce: () => renderLobby2pCommerce(),
    renderRosterHtml: () => {
      if (!lobbyState || typeof renderLobbyRosterStrip !== "function") return "";
      return renderLobbyRosterStrip(lobbyState, {
        phase: "prep",
        viewFighterId: lobbyViewFighterId,
        round,
      });
    },
    scheduleLayout: () => {
      if (typeof window.scheduleLayout === "function") window.scheduleLayout();
      else if (typeof applyUiLayout === "function") applyUiLayout();
      if (typeof window.fitCanvasDisplaySize === "function") window.fitCanvasDisplaySize();
      draw();
    },
  });
  Lobby2pHud.bind();
}

function drawLobby2pPrepHalf(side) {
  const st = getSideState(side);
  const shake = typeof getPrepBackpackShakeOffset === "function"
    ? getPrepBackpackShakeOffset()
    : { x: 0, y: 0 };
  ctx.save();
  ctx.translate(shake.x, shake.y);
  const frameOptions = {
    showFullPlacementGrid: shouldShowFullContainerPlacementGrid(),
    containers: st.containers,
    items: st.items,
  };
  drawBackpackFrame(side, frameOptions);
  drawContainers(st.containers, side, false);
  drawSynergyVisuals(ctx, synergyAnimTime, synergyPreviewBuilt, "under", side);
  drawLoadoutItems(st.items, side, false);
  if (typeof drawAllPrepItemIdleEffects === "function") {
    drawAllPrepItemIdleEffects(ctx, st.items, side, synergyAnimTime);
  }
  drawSynergyVisuals(ctx, synergyAnimTime, synergyPreviewBuilt, "over", side);
  if (typeof drawPrepSynergyEnhancements === "function") {
    drawPrepSynergyEnhancements(ctx, synergyAnimTime, side, st.items);
  }
  if (canEditPrepSide(side) && dragPayload && getPrepDropPlacement(st, side)) {
    if (typeof drawPrepDropPreview === "function") drawPrepDropPreview(ctx, side, st);
    else drawDropPreview(ctx);
  }
  ctx.restore();
}

function drawLobby2pSideBattleHalf(sideBattle, half) {
  const state = sideBattle.state;
  if (!state) return;
  const clipX = half === "left" ? 0 : ENEMY_X;
  const clipW = GRID_INNER_W;
  ctx.save();
  ctx.beginPath();
  ctx.rect(clipX, 0, clipW, canvas.height);
  ctx.clip();
  drawBackpackFrame("player", { containers: playerContainers, items: state.player.items });
  drawBackpackFrame("enemy", { containers: enemyContainers, items: state.enemy.items });
  drawContainers(playerContainers, "player", false);
  drawContainers(enemyContainers, "enemy", false);
  drawPlacedItems(state.player.items, "player", false, true);
  drawPlacedItems(state.enemy.items, "enemy", true, true);
  ctx.restore();
}

function drawLobby2pSplitPrep() {
  if (lobby2pHasActiveDuel()) {
    const duelState = lobbyState.sideBattles[0]?.state;
    if (duelState) {
      drawBackpackFrame("player", { containers: playerContainers, items: duelState.player.items });
      drawBackpackFrame("enemy", { containers: enemyContainers, items: duelState.enemy.items });
      drawContainers(playerContainers, "player", false);
      drawContainers(enemyContainers, "enemy", false);
      drawPlacedItems(duelState.player.items, "player", false, true);
      drawPlacedItems(duelState.enemy.items, "enemy", true, true);
    }
    return;
  }
  const sb0 = lobbyState.sideBattles[0];
  const sb1 = lobbyState.sideBattles[1];
  if (sb0?.state && !sb0.state.finished && !sb0.shared) {
    drawLobby2pSideBattleHalf(sb0, "left");
  } else {
    drawLobby2pPrepHalf("player");
  }
  if (sb1?.state && !sb1.state.finished && !sb1.shared) {
    drawLobby2pSideBattleHalf(sb1, "right");
  } else if (!sb0?.shared) {
    drawLobby2pPrepHalf("enemy");
  }
}

function setPrepViewSide(side) {
  if (isLobby2pMode() && lobbyState) {
    setLobby2pActiveHuman(side === "player" ? 0 : 1);
    return;
  }
  if (isLobbyMode() && lobbyState) {
    if (side === "player") setLobbyViewFighter(lobbyState.playerId);
    else {
      const fighter = getLobbyFighterById(lobbyState, lobbyViewFighterId);
      const opp = getLobbyOpponent(lobbyState);
      if (fighter && !fighter.isHuman) return;
      if (opp) setLobbyViewFighter(opp.id);
    }
    return;
  }
  if (side !== "player" && side !== "enemy") return;
  if (side === prepViewSide) return;
  clearDragUiState();
  closePrepHeroTooltip();
  prepViewSide = side;
  const app = document.getElementById("app");
  if (app) app.dataset.prepSide = side;
  if (typeof resetPrepFocus === "function") resetPrepFocus();
  syncBattleArenaLayout();
  draw();
  updatePrepSideUI();
  ensureShopReadyForSide(side);
  renderShop();
  renderBench();
  recalcSynergies();
  updateUI();
}

function setPrepSideBtnContent(btn, emoji, label) {
  if (!btn) return;
  const ico = btn.querySelector(".prep-side-ico");
  const lbl = btn.querySelector(".prep-side-label");
  if (ico && lbl) {
    ico.textContent = emoji;
    lbl.textContent = label;
    btn.setAttribute("aria-label", label);
    btn.title = label;
    return;
  }
  btn.textContent = `${emoji} ${label}`;
}

function updatePrepSideUI() {
  document.querySelectorAll(".prep-side-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.prepSide === prepViewSide);
  });
  const editable = canEditPrepSide();
  const shopPanel = document.getElementById("shop-panel");
  shopPanel?.classList.toggle("shop-readonly", !editable);
  const hint = document.getElementById("shop-panel-hint");
  const refreshBtn = document.getElementById("btn-refresh");
  const playerBtn = document.getElementById("btn-prep-player");
  const enemyBtn = document.getElementById("btn-prep-enemy");

  if (isVersusMode() || isLobby2pMode()) {
    setPrepSideBtnContent(playerBtn, "🧑", "Игрок 1");
    setPrepSideBtnContent(enemyBtn, "🧑", "Игрок 2");
    if (prepViewSide === "enemy") {
      if (hint) hint.textContent = isLobby2pMode()
        ? "Игрок 2 · split-screen · Tab — игрок 1"
        : "Покупки и расстановка второго игрока · Tab — вернуться к игроку 1";
    } else {
      if (hint) hint.textContent = isLobby2pMode()
        ? "Игрок 1 · split-screen · Tab — игрок 2"
        : "Покупки и расстановка первого игрока · Tab — перейти к игроку 2";
    }
  } else if (prepViewSide === "enemy") {
    setPrepSideBtnContent(playerBtn, "🧑", "Мой стол");
    if (isLobbyMode()) {
      const oppName = getLobbyOpponent(lobbyState)?.name || "Соперник";
      setPrepSideBtnContent(enemyBtn, "👤", oppName);
      if (hint) hint.textContent = "Снимок билда соперника — только просмотр · Tab — вернуться";
    } else {
      setPrepSideBtnContent(enemyBtn, isHardBotMode() ? "💀" : "🤖", isHardBotMode() ? "Сложный бот" : "Противник");
      if (hint) {
        hint.textContent = isHardBotMode()
          ? "Билд бота обновляется каждый раунд — только просмотр"
          : "ИИ управляет этим билдом сам — только просмотр";
      }
    }
  } else {
    setPrepSideBtnContent(playerBtn, "🧑", "Мой стол");
    if (isLobbyMode()) {
      const oppName = getLobbyOpponent(lobbyState)?.name || "Соперник";
      setPrepSideBtnContent(enemyBtn, "👤", oppName);
    } else {
      setPrepSideBtnContent(enemyBtn, "🤖", "Противник");
    }
    if (hint) hint.textContent = "Перетащите предмет в инвентарь или на скамейку · 📍 на карточке — закрепить в магазине";
  }
  if (refreshBtn) refreshBtn.disabled = !editable;
  syncPrepBottomBarChrome();
  syncShopHintsVisibility();
  if (isLobby2pMode()) syncLobby2pHudDom();
}

function getActiveCompanionIdForLoadout() {
  return prepViewSide === "enemy" ? enemyCompanionId : playerCompanionId;
}

function getSideEnhancementsRaw(side = "player") {
  return side === "enemy" ? enemyEnhancements : playerEnhancements;
}

function syncEnhancementsForSide(side = prepViewSide) {
  const items = side === "enemy" ? enemyItems : playerItems;
  if (typeof syncEnhancementsFromBackpack === "function") {
    syncEnhancementsFromBackpack(items, getSideEnhancementsRaw(side), round);
  }
}

function getSideEnhancements(side = "player") {
  syncEnhancementsForSide(side);
  return getSideEnhancementsRaw(side);
}

function bindEnhancementTooltipEvents(el, enhancementId, context = "shop") {
  if (!el || !enhancementId || el.dataset.enhTooltipBound === "1") return;
  el.dataset.enhTooltipBound = "1";
  el.removeAttribute("title");
  const showAt = (clientX, clientY) => {
    const def = getEnhancementDef(enhancementId);
    if (!def) return;
    showEnhancementTooltipAt(clientX, clientY, def, context, el);
  };
  bindPointerTapTooltip(el, showAt);
  el.addEventListener("mouseenter", (e) => {
    if (isTouchUi() || dragPayload) return;
    showAt(e.clientX, e.clientY);
  });
  el.addEventListener("mouseleave", () => {
    if (isTouchUi() || sidebarTooltipPinned) return;
    if (sidebarTooltipSource === context || sidebarTooltipSource === "enhancement") hideSidebarTooltip();
  });
  if (typeof bindItemEmojiSparklePointer === "function") {
    bindItemEmojiSparklePointer(el);
  }
}

function showEnhancementTooltipAt(clientX, clientY, def, context = "shop", sourceEl = null, options = {}) {
  if (shouldSuppressTooltipReshow(sourceEl)) return;
  const el = document.getElementById("sidebar-tooltip");
  if (!el || !def || typeof buildEnhancementTooltipLines !== "function") return;
  cancelScheduledTooltipHide();
  sidebarTooltipPinned = !!options.pinned;
  sidebarTooltipSource = context === "shop" ? "shop" : "enhancement";
  if (typeof syncDomSparkleFromTooltipSource === "function") {
    syncDomSparkleFromTooltipSource(sourceEl);
  }
  tooltipItem = null;
  fieldTooltipVisible = false;
  el.classList.remove("synergy-tooltip");
  if (sourceEl?.dataset?.unaffordable) {
    const sideGold = getSideState(prepViewSide).gold;
    const cost = getEnhancementShopCost(def);
    applySidebarTooltipCard(el, [
      { text: "Недостаточно золота", style: "title", color: "#f85149" },
      { text: `${cost}💰 · у вас ${sideGold}💰`, style: "sub", color: "#8b949e" },
    ], { emoji: "💰", rarityColor: (typeof RARITY_COLORS !== "undefined" ? RARITY_COLORS[def.rarity] : null) || "#30363d", costBadge: cost });
  } else {
    applySidebarTooltipCard(
      el,
      buildEnhancementTooltipLines(def, context),
      getEnhancementTooltipCardOptions(def, context),
    );
  }
  el.classList.remove("hidden");
  syncPrepTooltipDockVisibility();
  const boundsKind = context === "shop" ? "shop" : "viewport";
  positionSidebarTooltip(clientX, clientY, boundsKind, context);
}

function bindPrepEnhancementStrip(side = prepViewSide) {
  const strip = document.getElementById("prep-enhancement-strip");
  if (!strip) return;
  strip.querySelectorAll(".enh-slot--filled").forEach((slotEl) => {
    const enhId = slotEl.dataset.enhId;
    const slotId = slotEl.dataset.enhSlot;
    if (!enhId || !slotId) return;
    bindEnhancementTooltipEvents(slotEl, enhId, "enhancement");
    if (!canEditPrepSide(side)) return;
    if (slotEl.dataset.enhInteractBound === "1") return;
    slotEl.dataset.enhInteractBound = "1";

    slotEl.addEventListener("click", () => {
      if (!canEditPrepSide(side) || dragPayload) return;
      if (enhancementSlotDidDrag) {
        enhancementSlotDidDrag = false;
        return;
      }
      if (unequipEnhancementSlotToBench(slotId, side)) {
        renderBench(side);
        recalcSynergies();
        updateUI();
      }
    });

    slotEl.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") return;
      if (!canEditPrepSide(side) || e.button !== 0) return;
      if (isSyntheticMouseFromTouch()) return;
      e.stopPropagation();
      try { slotEl.setPointerCapture(e.pointerId); } catch (_) {}
      startEnhancementSlotDrag(slotId, e, side);
    });

    slotEl.addEventListener("pointerup", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      try { slotEl.releasePointerCapture(e.pointerId); } catch (_) {}
    });
  });
}

function findEnhancementLoadoutItem(slotId, side = prepViewSide) {
  if (typeof findLoadoutItemForEnhancementSlot !== "function") return null;
  const st = getSideState(side);
  return findLoadoutItemForEnhancementSlot(st.items, slotId);
}

function unequipEnhancementSlotToBench(slotId, side = prepViewSide) {
  if (!canEditPrepSide(side)) return false;
  const item = findEnhancementLoadoutItem(slotId, side);
  if (!item || typeof removeLoadoutItemToBench !== "function") return false;
  const ok = removeLoadoutItemToBench(item.uid, side);
  if (!ok) return false;
  syncEnhancementsForSide(side);
  const enhDef = typeof getEnhancementDef === "function"
    ? getEnhancementDef(getEnhancementIdFromItem(item.itemId))
    : null;
  log(`📦 ${enhDef?.name || item.itemId} → скамейка`);
  playPrepSfx("prep_pickup");
  return true;
}

function startEnhancementSlotDrag(slotId, e, side = prepViewSide) {
  if (!isLoadoutInteractionPhase() || gameOver || !canEditPrepSide(side)) return;
  const st = getLoadoutEditState(side);
  const item = findEnhancementLoadoutItem(slotId, side);
  if (!item) return;
  if (e?.preventDefault) e.preventDefault();
  clearTouchTapGesture();
  hideSidebarTooltip();
  selectedBench = -1;
  enhancementSlotDidDrag = true;
  dragPayload = { itemId: item.itemId, rotation: item.rotation || 0 };
  dragFrom = { type: "enhancement", item, side, slotId };
  st.items = st.items.filter((i) => i.uid !== item.uid);
  prepSidebarDragUnlocked = false;
  prepSidebarStickyHover = null;
  const slotEl = e?.currentTarget || document.querySelector(`.enh-slot--filled[data-enh-slot="${slotId}"]`);
  if (slotEl && e?.pointerId != null) {
    try { slotEl.setPointerCapture(e.pointerId); } catch (_) {}
  }
  if (typeof beginPrepDragArcFromCard === "function" && slotEl) {
    beginPrepDragArcFromCard(slotEl, item.itemId);
  } else if (typeof beginPrepDragArcFromBackpack === "function") {
    beginPrepDragArcFromBackpack(item.col, item.row, side);
  }
  startSynergyPreview();
  recalcSynergies();
  syncUiDragState();
  if (typeof onPrepDragStart === "function") onPrepDragStart();
  if (e?.clientX != null && e?.clientY != null) {
    lastPointerClient.x = e.clientX;
    lastPointerClient.y = e.clientY;
    syncPrepDragBoardHover(e.clientX, e.clientY, e.clientX, e.clientY);
  }
  syncDragGhostOverlay(lastPointerClient.x, lastPointerClient.y);
}

function beginPendingEnhancementDrag(slotId, e, side = prepViewSide) {
  if (phase !== "prep" || gameOver || !canEditPrepSide(side)) return;
  if (!findEnhancementLoadoutItem(slotId, side)) return;
  pendingEnhancementDrag = { slotId, startX: e.clientX, startY: e.clientY, side };
  syncUiDragState();
}

function updatePendingEnhancementDrag(e) {
  if (!pendingEnhancementDrag || dragPayload) return;
  const dx = e.clientX - pendingEnhancementDrag.startX;
  const dy = e.clientY - pendingEnhancementDrag.startY;
  if (Math.hypot(dx, dy) < getPrepDragCommitThresholdPx()) return;
  const { slotId, side } = pendingEnhancementDrag;
  pendingEnhancementDrag = null;
  clearTouchTapGesture();
  hideSidebarTooltip();
  const slotEl = document.querySelector(`.enh-slot--filled[data-enh-slot="${slotId}"]`);
  startEnhancementSlotDrag(slotId, { ...e, currentTarget: slotEl }, side);
}

function tryUnequipEnhancementFromPendingDrag(clientX, clientY) {
  if (!pendingEnhancementDrag || dragPayload) return false;
  const dx = clientX - pendingEnhancementDrag.startX;
  const dy = clientY - pendingEnhancementDrag.startY;
  if (Math.hypot(dx, dy) >= getPrepDragCommitThresholdPx()) return false;
  const { slotId, side } = pendingEnhancementDrag;
  pendingEnhancementDrag = null;
  syncUiDragState();
  if (!unequipEnhancementSlotToBench(slotId, side)) return false;
  renderBench(side);
  recalcSynergies();
  updateUI();
  return true;
}

function getSideMutationRuntime(side = "player") {
  syncEnhancementsForSide(side);
  if (side === "enemy") {
    return {
      classId: enemyClass,
      companionId: enemyCompanionId,
      formId: enemyMutationFormId,
      mutationId: enemyMutationId,
      items: enemyItems,
      enhancements: enemyEnhancements,
    };
  }
  return {
    classId: playerClass,
    companionId: playerCompanionId,
    formId: playerMutationFormId,
    mutationId: playerMutationId,
    items: playerItems,
    enhancements: playerEnhancements,
  };
}

function syncMutationMilestonesForSide(side = "player") {
  if (typeof resolveMutationProgress !== "function" || typeof pickMutationIdForMilestone !== "function") return null;
  const rt = getSideMutationRuntime(side);
  if (!rt.classId) return null;
  const progress = resolveMutationProgress({
    classId: rt.classId,
    companionId: rt.companionId,
    items: rt.items,
    enhancements: rt.enhancements,
    round,
  });

  const pickId = pickMutationIdForMilestone(progress, round);
  if (side === "enemy") {
    if (round >= MUTATION_ROUND_FINAL && pickId && !enemyMutationId) {
      enemyMutationId = pickId;
      if (!enemyMutationFormId) enemyMutationFormId = pickId;
    } else if (round >= MUTATION_ROUND_FORM && pickId && !enemyMutationFormId) {
      enemyMutationFormId = pickId;
    }
  } else {
    if (round >= MUTATION_ROUND_FINAL && pickId && !playerMutationId) {
      playerMutationId = pickId;
      if (!playerMutationFormId) playerMutationFormId = pickId;
      const name = typeof getMutationById === "function" ? getMutationById(pickId)?.name : pickId;
      log(`Мутация: ${name || pickId}`);
      if (typeof triggerMutationMilestoneCelebration === "function") {
        triggerMutationMilestoneCelebration("player", "mutation");
      }
    } else if (round >= MUTATION_ROUND_FORM && pickId && !playerMutationFormId) {
      playerMutationFormId = pickId;
      const name = typeof getMutationById === "function" ? getMutationById(pickId)?.formName : pickId;
      log(`Форма: ${name || pickId}`);
      if (typeof triggerMutationMilestoneCelebration === "function") {
        triggerMutationMilestoneCelebration("player", "form");
      }
    }
  }
  return progress;
}

function syncAllMutationMilestones() {
  const playerProgress = syncMutationMilestonesForSide("player");
  if (isVersusMode()) syncMutationMilestonesForSide("enemy");
  return playerProgress;
}

function getRunDisplayTitle(side = "player") {
  const rt = getSideMutationRuntime(side);
  if (typeof getMutationDisplayTitle === "function") {
    return getMutationDisplayTitle(rt.classId, rt.formId, rt.mutationId);
  }
  const cls = getClassById(rt.classId);
  return cls?.heroLabel || cls?.noviceLabel || cls?.name || "—";
}

function ensureCompanionGrid() {
  const grid = document.getElementById("companion-grid");
  if (!grid || grid.dataset.built === "1") return;
  if (typeof COMPANION_CATALOG === "undefined") return;
  grid.dataset.built = "1";
  grid.innerHTML = Object.values(COMPANION_CATALOG).map((c) => `
    <button type="button" class="class-card companion-card glass-card" data-companion="${c.id}">
      <span class="companion-emoji" aria-hidden="true">${c.emoji}</span>
      <span class="class-name">${c.name}</span>
      <span class="class-desc">${c.desc}</span>
    </button>
  `).join("");
  grid.querySelectorAll("[data-companion]").forEach((btn) => {
    btn.addEventListener("click", () => selectCompanion(btn.dataset.companion));
  });
  bindCompanionCardTooltips();
}

function dismissClassOverlayTooltip() {
  if (sidebarTooltipSource === "companion") hideSidebarTooltip();
}

function showCompanionTooltipAt(clientX, clientY, companionId, sourceEl = null, options = {}) {
  if (shouldSuppressTooltipReshow(sourceEl)) return;
  const el = document.getElementById("sidebar-tooltip");
  if (!el || typeof buildCompanionTooltipLines !== "function") return;
  cancelScheduledTooltipHide();
  sidebarTooltipPinned = !!options.pinned;
  sidebarTooltipSource = "companion";
  tooltipItem = null;
  fieldTooltipVisible = false;
  el.classList.remove("synergy-tooltip");
  const companion = typeof getCompanionById === "function" ? getCompanionById(companionId) : null;
  applySidebarTooltipCard(
    el,
    buildCompanionTooltipLines(companionId),
    { emoji: companion?.emoji || "🐾", rarityColor: sourceEl?.classList.contains("selected") ? "#f5c842" : "#30363d" },
  );
  el.classList.remove("hidden");
  syncPrepTooltipDockVisibility();
  positionSidebarTooltip(clientX, clientY, "viewport", "companion");
}

function renderPrepCompanionLabelHtml(companion) {
  if (!companion) return "—";
  const safeName = typeof escapeClassHtml === "function"
    ? escapeClassHtml(companion.name)
    : companion.name;
  return `<button type="button" class="prep-companion-tip" data-companion-id="${companion.id}" aria-label="Спутник: ${safeName}">${companion.emoji} ${safeName}</button>`;
}

function bindPrepCompanionTooltip(root = document) {
  root.querySelectorAll(".prep-companion-tip[data-companion-id]").forEach((btn) => {
    if (btn.dataset.companionTipBound === "1") return;
    btn.dataset.companionTipBound = "1";
    const companionId = btn.dataset.companionId;
    const showAt = (clientX, clientY, pinned = false) => {
      if (!prepTooltipsEnabled) return;
      showCompanionTooltipAt(clientX, clientY, companionId, btn, { pinned });
    };

    if (typeof bindPointerTapTooltip === "function") {
      bindPointerTapTooltip(btn, (clientX, clientY) => showAt(clientX, clientY, true));
    }
    btn.addEventListener("mouseenter", (e) => {
      if (isSyntheticMouseFromTouch()) return;
      if (!prepTooltipsEnabled) return;
      cancelScheduledTooltipHide();
      showAt(e.clientX, e.clientY, false);
    });
    btn.addEventListener("mousemove", (e) => {
      if (isSyntheticMouseFromTouch()) return;
      if (sidebarTooltipSource !== "companion") return;
      positionSidebarTooltip(e.clientX, e.clientY, "viewport", "companion");
    });
    btn.addEventListener("mouseleave", () => {
      if (sidebarTooltipPinned || sidebarTooltipSource !== "companion") return;
      requestHideSidebarTooltip();
    });
    btn.style.cursor = "help";
  });
}

function bindCompanionCardTooltips() {
  document.querySelectorAll("#companion-grid [data-companion]").forEach((btn) => {
    if (btn.dataset.companionTooltipBound === "1") return;
    btn.dataset.companionTooltipBound = "1";
    const companionId = btn.dataset.companion;
    const showAt = (clientX, clientY, pinned = false) => {
      showCompanionTooltipAt(clientX, clientY, companionId, btn, { pinned });
    };

    if (typeof bindPointerTapTooltip === "function") {
      bindPointerTapTooltip(btn, (clientX, clientY) => showAt(clientX, clientY, true));
    }
    btn.addEventListener("mouseenter", (e) => {
      if (isSyntheticMouseFromTouch()) return;
      cancelScheduledTooltipHide();
      showAt(e.clientX, e.clientY, false);
    });
    btn.addEventListener("mousemove", (e) => {
      if (isSyntheticMouseFromTouch()) return;
      positionSidebarTooltip(e.clientX, e.clientY, "viewport", "companion");
    });
    btn.addEventListener("mouseleave", () => {
      if (sidebarTooltipPinned || sidebarTooltipSource !== "companion") return;
      requestHideSidebarTooltip();
    });
    btn.style.cursor = "help";
  });
}

function renderCompanionSelection() {
  ensureCompanionGrid();
  const grid = document.getElementById("companion-grid");
  if (!grid) return;
  const suggested = pendingPlayerClass && typeof defaultCompanionForClass === "function"
    ? defaultCompanionForClass(pendingPlayerClass)
    : null;
  grid.querySelectorAll("[data-companion]").forEach((btn) => {
    const picked = btn.dataset.companion === pendingPlayerCompanionId;
    btn.classList.toggle("selected", picked);
    btn.classList.toggle("suggested", !pendingPlayerCompanionId && btn.dataset.companion === suggested);
  });
}

const CLASS_INTRO_STEP_IDS = {
  mode: "class-step-mode",
  campaignTrial: "class-step-campaign",
  player: "class-step-player",
  companion: "class-step-companion",
  summary: "class-step-summary",
  opponent: "class-step-opponent",
};

function classIntroUsesTrialStep() {
  return selectedGameMode === "campaign";
}

function getClassIntroTotalSteps() {
  return classIntroUsesTrialStep() ? 5 : 4;
}

let classSummaryTooltipPinned = false;
let classSummaryTooltipKind = null;

function setClassIntroStep(stepKey, options = {}) {
  const overlay = document.getElementById("class-overlay");
  const prevStep = overlay?.getAttribute("data-class-intro-step") || "mode";
  let resolvedKey = stepKey;
  const targetId = CLASS_INTRO_STEP_IDS[resolvedKey];
  if (!targetId || !document.getElementById(targetId)) {
    console.warn(`[intro] missing step "${stepKey}" — fallback to mode`);
    resolvedKey = "mode";
  }
  const direction = options.direction
    || (typeof ScreenTransitions !== "undefined"
      ? ScreenTransitions.getIntroDirection(prevStep, resolvedKey)
      : "forward");

  Object.entries(CLASS_INTRO_STEP_IDS).forEach(([key, id]) => {
    document.getElementById(id)?.classList.toggle("hidden", key !== resolvedKey);
  });
  overlay?.setAttribute("data-class-intro-step", resolvedKey);
  overlay?.classList.toggle("class-overlay--summary", resolvedKey === "summary");
  if (resolvedKey === "summary" && typeof hideClassHeroShowcase === "function") {
    hideClassHeroShowcase();
  }
  if (prevStep !== resolvedKey && typeof ScreenTransitions !== "undefined") {
    void ScreenTransitions.pulseIntroStep(overlay, direction);
  }
}

function hideClassSummaryTooltip() {
  classSummaryTooltipPinned = false;
  classSummaryTooltipKind = null;
  const tip = document.getElementById("class-summary-tooltip");
  if (!tip) return;
  tip.classList.add("hidden");
  tip.setAttribute("aria-hidden", "true");
  tip.style.left = "";
  tip.style.top = "";
}

function buildClassSummaryTooltipHtml(kind) {
  if (kind === "hero" && pendingPlayerClass) {
    const cls = getClassById(pendingPlayerClass);
    if (!cls) return "";
    const title = typeof escapeClassHtml === "function"
      ? escapeClassHtml(cls.heroLabel || cls.noviceLabel || cls.name)
      : (cls.heroLabel || cls.noviceLabel || cls.name);
    const body = typeof escapeClassHtml === "function"
      ? escapeClassHtml(cls.heroLore || cls.desc || "")
      : (cls.heroLore || cls.desc || "");
    const bonus = typeof escapeClassHtml === "function"
      ? escapeClassHtml(cls.desc || "")
      : (cls.desc || "");
    return `<p class="class-summary-tooltip-title">${title}</p>
      <p class="class-summary-tooltip-body">${body}</p>
      <p class="class-summary-tooltip-bonus">${bonus}</p>`;
  }
  if (kind === "companion" && pendingPlayerCompanionId) {
    const companion = COMPANION_CATALOG?.[pendingPlayerCompanionId];
    if (!companion) return "";
    const title = typeof escapeClassHtml === "function"
      ? escapeClassHtml(`${companion.emoji} ${companion.name}`)
      : `${companion.emoji} ${companion.name}`;
    const body = typeof escapeClassHtml === "function"
      ? escapeClassHtml(companion.desc || "")
      : (companion.desc || "");
    return `<p class="class-summary-tooltip-title">${title}</p>
      <p class="class-summary-tooltip-body">${body}</p>`;
  }
  return "";
}

function positionClassSummaryTooltip(anchorEl) {
  const tip = document.getElementById("class-summary-tooltip");
  if (!tip || !anchorEl) return;
  tip.classList.remove("hidden");
  tip.removeAttribute("aria-hidden");
  const rect = anchorEl.getBoundingClientRect();
  const tipW = tip.offsetWidth || 240;
  const tipH = tip.offsetHeight || 96;
  let left = rect.left + rect.width / 2 - tipW / 2;
  let top = rect.top - tipH - 12;
  if (top < 8) top = rect.bottom + 12;
  left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

function showClassSummaryTooltip(kind, anchorEl, options = {}) {
  const tip = document.getElementById("class-summary-tooltip");
  if (!tip || !anchorEl) return;
  const html = buildClassSummaryTooltipHtml(kind);
  if (!html) return;
  tip.innerHTML = html;
  classSummaryTooltipKind = kind;
  classSummaryTooltipPinned = !!options.pinned;
  positionClassSummaryTooltip(anchorEl);
}

function bindClassSummaryInteractions() {
  const stage = document.getElementById("class-summary-stage");
  if (!stage || stage.dataset.bound === "1") return;
  stage.dataset.bound = "1";

  stage.querySelectorAll("[data-summary-kind]").forEach((btn) => {
    const kind = btn.dataset.summaryKind;
    btn.addEventListener("pointerover", (event) => {
      if (event.pointerType === "touch") return;
      showClassSummaryTooltip(kind, btn);
    });
    btn.addEventListener("pointerout", () => {
      if (!classSummaryTooltipPinned) hideClassSummaryTooltip();
    });
    btn.addEventListener("focus", () => showClassSummaryTooltip(kind, btn, { pinned: true }));
    btn.addEventListener("blur", () => {
      if (!classSummaryTooltipPinned) hideClassSummaryTooltip();
    });
    btn.addEventListener("click", (event) => {
      const coarse = window.matchMedia?.("(hover: none)")?.matches || event.pointerType === "touch";
      if (!coarse) return;
      event.preventDefault();
      if (classSummaryTooltipPinned && classSummaryTooltipKind === kind) {
        hideClassSummaryTooltip();
      } else {
        showClassSummaryTooltip(kind, btn, { pinned: true });
      }
    });
  });

  document.getElementById("btn-class-summary-start")?.addEventListener("click", () => startRunFromOverlay());
}

function renderClassSummaryStep() {
  const cls = pendingPlayerClass ? getClassById(pendingPlayerClass) : null;
  const companion = pendingPlayerCompanionId ? COMPANION_CATALOG?.[pendingPlayerCompanionId] : null;
  const lead = document.getElementById("class-summary-lead");
  const heroImg = document.getElementById("class-summary-hero-img");
  const heroName = document.getElementById("class-summary-hero-name");
  const companionEmoji = document.getElementById("class-summary-companion-emoji");
  const companionName = document.getElementById("class-summary-companion-name");
  const startBtn = document.getElementById("btn-class-summary-start");
  const heroFloat = document.getElementById("class-summary-hero");

  const heroLabel = cls?.heroLabel || cls?.noviceLabel || cls?.name || "—";
  if (lead) {
    const diffLine = selectedGameMode === "campaign"
        ? ` · ${Campaign.getTrial(selectedCampaignTrial)?.title || "Кампания"}`
        : "";
    lead.textContent = `Ваш выбор: ${heroLabel} и ${companion?.name || "—"}${diffLine}`;
  }
  if (heroImg && pendingPlayerClass) {
    const src = typeof getClassHeroPortraitSrc === "function"
      ? getClassHeroPortraitSrc(pendingPlayerClass)
      : "";
    if (heroImg.getAttribute("src") !== src) heroImg.setAttribute("src", src || "");
    heroImg.alt = heroLabel;
  }
  if (heroName) heroName.textContent = heroLabel;
  if (companionEmoji) companionEmoji.textContent = companion?.emoji || "🐾";
  if (companionName) companionName.textContent = companion?.name || "—";
  if (heroFloat) {
    if (pendingPlayerClass) heroFloat.dataset.class = pendingPlayerClass;
    else heroFloat.removeAttribute("data-class");
  }
  if (startBtn) {
    startBtn.disabled = !(pendingPlayerClass && pendingPlayerCompanionId);
    if (selectedGameMode === "versus") startBtn.textContent = "Начать игру";
    else if (selectedGameMode === "lobby") startBtn.textContent = "Начать лобби";
    else startBtn.textContent = "Старт";
  }
}

function showSummaryStep() {
  dismissClassOverlayTooltip();
  hideClassSummaryTooltip();
  if (!pendingPlayerClass || !pendingPlayerCompanionId) return;
  setClassIntroStep("summary");
  if (!selectedEnemyClass) {
    selectedEnemyClass = pendingPlayerClass === "mage" ? "warrior" : "mage";
  }
  const modeTitles = {
    lobby: "Лобби",
    lobby2p: "Лобби 2P",
    versus: "Противостояние",
    hardbot: "Сложный бот",
    solo: "Одиночная",
    campaign: "Кампания",
  };
  document.getElementById("class-modal-title").textContent = modeTitles[selectedGameMode] || "Готовы?";
  document.getElementById("class-modal-subtitle").textContent = "Наведите на героя или спутника — подробности о выборе";
  renderClassSummaryStep();
  syncClassOverlayUi();
  syncClassMobileDock();
}

function getCompanionStepHeroLabel() {
  const cls = pendingPlayerClass ? getClassById(pendingPlayerClass) : null;
  return cls?.heroLabel || cls?.noviceLabel || cls?.name || "героем";
}

function buildCompanionStepSubtitle() {
  const heroName = getCompanionStepHeroLabel();
  return `Окей, теперь вы ${heroName}, с каким спутником пойдёте сейчас? Они все разные, будьте внимательны`;
}

function showCompanionStep({ keepSelection = false } = {}) {
  hideClassSummaryTooltip();
  if (!keepSelection) pendingPlayerCompanionId = null;
  setClassIntroStep("companion");
  document.getElementById("class-modal-title").textContent = "Спутник";
  const companionSubtitle = buildCompanionStepSubtitle();
  document.getElementById("class-modal-subtitle").textContent = companionSubtitle;
  const stepSub = document.getElementById("class-companion-step-sub");
  if (stepSub) stepSub.textContent = companionSubtitle;
  renderCompanionSelection();
  syncClassOverlayUi();
  syncClassMobileDock();
}

function selectCompanion(companionId) {
  if (!COMPANION_CATALOG?.[companionId]) return;
  const reclick = pendingPlayerCompanionId === companionId;
  pendingPlayerCompanionId = companionId;
  renderCompanionSelection();
  if (reclick) {
    if (selectedGameMode === "lobby2p") showSecondClassStep();
    else showSummaryStep();
    return;
  }
  if (selectedGameMode === "lobby2p") {
    showSecondClassStep();
    return;
  }
  syncClassOverlayUi();
  syncClassMobileDock();
  updateStartRunButton();
}

function syncRunHudPhase() {
  const portraitFrame = document.getElementById("prep-hero-card-portrait-frame");
  const legacyBadge = document.getElementById("run-hud-phase");
  const hidden = phase !== "prep" || gameOver;
  if (portraitFrame) {
    if (hidden) portraitFrame.setAttribute("aria-hidden", "true");
    else portraitFrame.removeAttribute("aria-hidden");
  }
  if (!legacyBadge) return;
  legacyBadge.classList.add("hidden");
  legacyBadge.setAttribute("aria-hidden", "true");
}

function syncClassOverlayUi() {
  const badge = document.getElementById("class-step-badge");
  const hint = document.getElementById("class-action-hint");
  const modeStep = document.getElementById("class-step-mode");
  const playerStep = document.getElementById("class-step-player");
  const companionStep = document.getElementById("class-step-companion");
  const summaryStep = document.getElementById("class-step-summary");
  const opponentStep = document.getElementById("class-step-opponent");
  if (!badge || !hint) return;

  const totalSteps = getClassIntroTotalSteps();

  if (modeStep && !modeStep.classList.contains("hidden")) {
    badge.textContent = `Шаг 1 из ${totalSteps} · Режим`;
    hint.textContent = "Четыре девочки-звери скрестили клички с именами — выберите режим";
  } else if (document.getElementById("class-step-campaign") && !document.getElementById("class-step-campaign").classList.contains("hidden")) {
    badge.textContent = `Шаг 2 из ${totalSteps} · Испытание`;
    hint.textContent = "4 урока: рюкзак, заполнение, манекен и финальный манекен";
  } else if (playerStep && !playerStep.classList.contains("hidden")) {
    badge.textContent = classIntroUsesTrialStep()
      ? `Шаг 3 из ${totalSteps} · Герой`
      : `Шаг 2 из ${totalSteps} · Герой`;
    hint.textContent = pendingPlayerClass
      ? "Нажмите героя ещё раз — к выбору спутника"
      : "Читайте описание на плитке · после выбора слева — полная история";
  } else if (companionStep && !companionStep.classList.contains("hidden")) {
    badge.textContent = classIntroUsesTrialStep()
      ? `Шаг 4 из ${totalSteps} · Спутник`
      : `Шаг 3 из ${totalSteps} · Спутник`;
    hint.textContent = "Выберите спутника · нажмите ещё раз — к саммари";
  } else if (summaryStep && !summaryStep.classList.contains("hidden")) {
    badge.textContent = classIntroUsesTrialStep()
      ? `Шаг ${totalSteps} из ${totalSteps} · Старт`
      : `Шаг 4 из ${totalSteps} · Старт`;
    hint.textContent = "Наведите на героя или спутника · «Старт» по центру";
  } else if (opponentStep && !opponentStep.classList.contains("hidden")) {
    badge.textContent = selectedGameMode === "lobby2p" ? "Шаг 5 из 5 · Игрок 2" : "Шаг 4 из 4 · Соперник";
    const startLabel = selectedGameMode === "versus"
      ? "Начать игру"
      : selectedGameMode === "lobby2p"
        ? "Начать лобби 2P"
        : "Начать забег";
    hint.textContent = selectedGameMode === "lobby2p"
      ? `Класс второго игрока · «${startLabel}» внизу`
      : `Выберите героиню соперника, затем «${startLabel}» внизу экрана`;
  } else {
    badge.textContent = "";
    hint.textContent = "";
  }
  syncClassHeroShowcase();
  syncBottomChromeIntro();
}

function syncChromeNavButtons() {
  const overlay = document.getElementById("class-overlay");
  const overlayOpen = !!overlay && !overlay.classList.contains("hidden");
  const modeStep = document.getElementById("class-step-mode");
  const onMode = modeStep && !modeStep.classList.contains("hidden");
  const introBack = document.getElementById("btn-class-back");
  const prepBack = document.getElementById("btn-chrome-back");
  const inBattle = phase === "battle" || phase === "replay";
  const inPrep = phase === "prep" && !gameOver && !overlayOpen;

  if (introBack) introBack.classList.toggle("hidden", !overlayOpen || onMode);
  if (prepBack) prepBack.classList.toggle("hidden", !inPrep || inBattle);
}

function syncBottomChromeIntro() {
  const overlay = document.getElementById("class-overlay");
  const overlayOpen = !!overlay && !overlay.classList.contains("hidden");
  const stepEl = document.getElementById("bottom-chrome-intro-step");
  const hintEl = document.getElementById("bottom-chrome-intro-hint");
  const badge = document.getElementById("class-step-badge");
  const hint = document.getElementById("class-action-hint");
  const modeStep = document.getElementById("class-step-mode");
  const playerStep = document.getElementById("class-step-player");
  const companionStep = document.getElementById("class-step-companion");
  const summaryStep = document.getElementById("class-step-summary");
  const opponentStep = document.getElementById("class-step-opponent");
  const backBtn = document.getElementById("btn-class-back");
  const startBtn = document.getElementById("btn-start-run");

  if (stepEl) stepEl.textContent = badge?.textContent?.trim() || "Backpack Battles";
  if (hintEl) hintEl.textContent = hint?.textContent?.trim() || "Выберите режим, героя и спутника";

  const onMode = modeStep && !modeStep.classList.contains("hidden");
  const onSummary = summaryStep && !summaryStep.classList.contains("hidden");
  const onOpponent = opponentStep && !opponentStep.classList.contains("hidden");

  if (backBtn) backBtn.classList.toggle("hidden", !overlayOpen || onMode);
  if (startBtn) {
    const showStart = overlayOpen && (onSummary || onOpponent);
    startBtn.classList.toggle("hidden", !showStart);
  }

  updateStartRunButton();

  if (overlayOpen && typeof window.applyUiLayout === "function") {
    requestAnimationFrame(() => window.applyUiLayout());
  }
  syncChromeNavButtons();
}

function syncClassHeroShowcase() {
  const overlay = document.getElementById("class-overlay");
  if (!overlay || overlay.classList.contains("hidden")) {
    if (typeof hideClassHeroShowcase === "function") hideClassHeroShowcase();
    return;
  }
  const modeStep = document.getElementById("class-step-mode");
  if (modeStep && !modeStep.classList.contains("hidden")) {
    if (typeof updateClassHeroRosterShowcase === "function") updateClassHeroRosterShowcase();
    return;
  }
  const campaignTrialStep = document.getElementById("class-step-campaign");
  if (campaignTrialStep && !campaignTrialStep.classList.contains("hidden")) {
    if (typeof hideClassHeroShowcase === "function") hideClassHeroShowcase();
    return;
  }
  const summaryStep = document.getElementById("class-step-summary");
  if (summaryStep && !summaryStep.classList.contains("hidden")) {
    if (typeof hideClassHeroShowcase === "function") hideClassHeroShowcase();
    return;
  }
  if (typeof updateClassHeroShowcase !== "function") return;
  const opponentStep = document.getElementById("class-step-opponent");
  const onOpponent = opponentStep && !opponentStep.classList.contains("hidden");
  const classId = onOpponent ? selectedEnemyClass : pendingPlayerClass;
  updateClassHeroShowcase(classId || null);
}

function renderCampaignTrialSelection() {
  document.querySelectorAll(".campaign-trial-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.campaignTrial === selectedCampaignTrial);
  });
}

function showCampaignTrialStep() {
  dismissClassOverlayTooltip();
  hideClassSummaryTooltip();
  setClassIntroStep("campaignTrial");
  document.getElementById("class-modal-title").textContent = "Испытание кампании";
  document.getElementById("class-modal-subtitle").textContent =
    "Пошаговое обучение сборке билда — от рюкзака до боя с манекеном";
  renderCampaignTrialSelection();
  syncClassOverlayUi();
  syncClassMobileDock();
}

function selectCampaignTrial(trialId) {
  if (!Campaign?.TRIALS?.[trialId]) return;
  selectedCampaignTrial = trialId;
  renderCampaignTrialSelection();
  showPlayerClassStep();
}

function showGameModeStep() {
  hideClassSummaryTooltip();
  setClassIntroStep("mode");
  document.getElementById("class-modal-title").textContent = "Режим игры";
  document.getElementById("class-modal-subtitle").textContent = "Зверушки скрестили клички с именами — выберите режим забега";
  syncClassOverlayUi();
  syncClassMobileDock();
}

function showPlayerClassStep() {
  dismissClassOverlayTooltip();
  hideClassSummaryTooltip();
  setClassIntroStep("player");
  document.getElementById("class-modal-title").textContent = selectedGameMode === "versus"
    ? "Игрок 1 — герой"
    : selectedGameMode === "lobby2p"
      ? "Игрок 1 — герой"
      : "Выберите героя";
  document.getElementById("class-modal-subtitle").textContent = selectedGameMode === "versus"
    ? "Игрок 1 — выберите героиню."
    : selectedGameMode === "lobby2p"
      ? "16 бойцов: 2 игрока + 14 ботов."
      : selectedGameMode === "lobby"
      ? "Восьмерка бойцов — выберите героиню."
      : selectedGameMode === "campaign"
          ? "Герой для обучения и тренировок."
          : "Выберите героиню для забега.";
  syncClassOverlayUi();
  syncClassMobileDock();
  if (typeof renderClassMutationGallery === "function") {
    renderClassMutationGallery(pendingPlayerClass);
  }
}

function selectGameMode(mode) {
  if (mode !== "solo" && mode !== "versus" && mode !== "hardbot" && mode !== "lobby" && mode !== "lobby2p" && mode !== "campaign") return;
  selectedGameMode = mode;
  selectedOpponentMode = mode === "versus"
    ? "manual"
    : mode === "hardbot"
      ? "hardbot"
      : mode === "lobby"
        ? "ghost"
        : mode === "lobby2p"
          ? "ghost2p"
          : mode === "campaign"
              ? "campaign"
              : "ai";
  pendingPlayerClass = null;
  pendingPlayerCompanionId = null;
  selectedEnemyClass = null;
  document.querySelectorAll(".game-mode-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.gameMode === mode);
  });
  if (typeof renderClassMutationGallery === "function") renderClassMutationGallery(null);
  if (mode === "campaign") {
    showCampaignTrialStep();
  } else {
    showPlayerClassStep();
  }
}

function resetClassSelectOverlay() {
  pendingPlayerClass = null;
  pendingMutationIntentId = null;
  pendingPlayerCompanionId = null;
  selectedEnemyClass = null;
  selectedGameMode = "solo";
  selectedOpponentMode = "ai";
  selectedCampaignTrial = "build-trial";
  if (typeof Campaign !== "undefined") Campaign.reset();
  document.querySelectorAll(".game-mode-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.gameMode === "solo");
  });
  document.querySelectorAll(".class-card[data-class]").forEach((card) => card.classList.remove("selected"));
  document.querySelectorAll(".opponent-class-card").forEach((card) => card.classList.remove("selected"));
  if (typeof renderClassMutationGallery === "function") renderClassMutationGallery(null);
  showGameModeStep();
  updateStartRunButton();
  if (typeof syncClassPickerCardsFromCatalog === "function") syncClassPickerCardsFromCatalog();
  syncClassOverlayUi();
  syncClassMobileDock();
}

function showSecondClassStep() {
  dismissClassOverlayTooltip();
  document.getElementById("class-step-mode")?.classList.add("hidden");
  document.getElementById("class-step-player")?.classList.add("hidden");
  document.getElementById("class-step-companion")?.classList.add("hidden");
  document.getElementById("class-step-opponent")?.classList.remove("hidden");
  const hint = document.getElementById("opponent-mode-hint");
  if (selectedGameMode === "versus") {
    document.getElementById("class-modal-title").textContent = "Игрок 2 — класс";
    document.getElementById("class-modal-subtitle").textContent = `Игрок 1: ${getClassById(pendingPlayerClass)?.name || pendingPlayerClass}`;
    if (hint) hint.textContent = "Перед боем оба игрока по очереди покупают в магазине (Tab или кнопки внизу).";
  } else if (selectedGameMode === "lobby2p") {
    document.getElementById("class-modal-title").textContent = "Игрок 2 — класс";
    document.getElementById("class-modal-subtitle").textContent = `Игрок 1: ${getClassById(pendingPlayerClass)?.name || pendingPlayerClass}`;
    if (hint) hint.textContent = "Split-screen лобби: 2 игрока + 14 ботов. Фарм, дуэль и готовность к раунду.";
  } else if (selectedGameMode === "hardbot") {
    document.getElementById("class-modal-title").textContent = "Класс сложного бота";
    document.getElementById("class-modal-subtitle").textContent = `Ваш класс: ${getClassById(pendingPlayerClass)?.name || pendingPlayerClass}`;
    if (hint) hint.textContent = "Каждый раунд бот подбирает лучшую экипировку из всего пула. Legendary и godly не дублируются. Сила рюкзака бота — чуть выше вашей.";
  } else {
    document.getElementById("class-modal-title").textContent = "Класс бота";
    document.getElementById("class-modal-subtitle").textContent = `Ваш класс: ${getClassById(pendingPlayerClass)?.name || pendingPlayerClass}`;
    if (hint) hint.textContent = "Бот сам покупает предметы и расставляет билд между боями.";
  }
  if (!selectedEnemyClass) selectedEnemyClass = pendingPlayerClass === "mage" ? "warrior" : "mage";
  document.querySelectorAll(".opponent-class-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.opponentClass === selectedEnemyClass);
  });
  updateStartRunButton();
  syncClassOverlayUi();
  syncClassMobileDock();
  scrollClassPickerCardIntoView(document.querySelector(`.opponent-class-card[data-opponent-class="${selectedEnemyClass}"]`));
}

function syncClassMobileDock() {
  const dock = document.getElementById("class-mobile-dock");
  if (dock) {
    dock.classList.add("hidden");
    dock.setAttribute("aria-hidden", "true");
  }
  syncBottomChromeIntro();
  if (typeof window.syncClassOverlayAnchors === "function") {
    requestAnimationFrame(() => {
      window.syncClassOverlayAnchors();
      syncClassOverlayUi();
    });
  }
}

function updateStartRunButton() {
  const btn = document.getElementById("btn-start-run");
  if (!btn) return;
  const ready = !!(pendingPlayerClass && pendingPlayerCompanionId);
  btn.disabled = !ready;
  if (selectedGameMode === "versus") btn.textContent = "Начать игру";
  else if (selectedGameMode === "lobby") btn.textContent = "Начать лобби";
  else if (selectedGameMode === "lobby2p") btn.textContent = "Начать лобби 2P";
  else btn.textContent = "Старт";
  const summaryBtn = document.getElementById("btn-class-summary-start");
  if (summaryBtn) summaryBtn.disabled = !ready;
}

function scrollClassPickerCardIntoView(card) {
  card?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
}

function onMutationIntentSelected(mutationId) {
  pendingMutationIntentId = mutationId || null;
}

function onMutationIntentConfirmed(mutationId, classId) {
  pendingMutationIntentId = mutationId || null;
  if (classId && !pendingPlayerClass) pendingPlayerClass = classId;
  pendingPlayerCompanionId = null;
  showCompanionStep({ keepSelection: false });
}

function selectPlayerClass(classId) {
  const reclick = pendingPlayerClass === classId;
  pendingPlayerClass = classId;
  if (!reclick) pendingMutationIntentId = null;
  document.querySelectorAll(".class-card[data-class]").forEach((card) => {
    card.classList.toggle("selected", card.dataset.class === classId);
  });
  scrollClassPickerCardIntoView(document.querySelector(`.class-card[data-class="${classId}"]`));
  if (typeof renderClassMutationGallery === "function") renderClassMutationGallery(classId);
  if (reclick) {
    pendingPlayerCompanionId = null;
    showCompanionStep({ keepSelection: false });
    return;
  }
  syncClassOverlayUi();
  if (typeof window.syncClassOverlayAnchors === "function") {
    requestAnimationFrame(() => window.syncClassOverlayAnchors());
  }
  syncClassMobileDock();
  updateStartRunButton();
}

function selectOpponentClass(classId) {
  selectedEnemyClass = classId;
  document.querySelectorAll(".opponent-class-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.opponentClass === classId);
  });
  scrollClassPickerCardIntoView(document.querySelector(`.opponent-class-card[data-opponent-class="${classId}"]`));
  syncClassHeroShowcase();
  updateStartRunButton();
}

function clonePrepBattleItem(item) {
  return {
    uid: item.uid,
    itemId: item.itemId,
    col: item.col,
    row: item.row,
    rotation: item.rotation || 0,
    runtime: item.runtime ? { ...item.runtime } : null,
  };
}

function isSyntheticMouseFromTouch() {
  return Date.now() - lastTouchEventAt < 1000;
}

function isTouchUi() {
  return typeof isTouchInteraction === "function"
    ? isTouchInteraction()
    : document.documentElement.dataset.touch === "true";
}

function getDragThresholdPx() {
  return isTouchUi() ? TOUCH_DRAG_THRESHOLD_PX : MOUSE_DRAG_THRESHOLD_PX;
}

/** На touch drag стартует только после «свободы» для tap-to-tooltip. */
function getPrepDragCommitThresholdPx() {
  return isTouchUi()
    ? Math.max(TOUCH_DRAG_THRESHOLD_PX, TOOLTIP_CONFIG.moveTolerance)
    : MOUSE_DRAG_THRESHOLD_PX;
}

function getDropPointerClient(e) {
  if (isTouchUi() && (dragPayload || pendingShopDrag || pendingBenchDrag)) {
    return { x: lastPointerClient.x, y: lastPointerClient.y };
  }
  return { x: e.clientX, y: e.clientY };
}

function createDropPointerEvent(e) {
  const { x, y } = getDropPointerClient(e);
  return createSyntheticPointerEvent(x, y);
}

function isTouchLikePointerType(pointerType) {
  return pointerType === "touch" || pointerType === "pen";
}

function clearTouchTapGesture() {
  touchTapGesture = null;
}

function beginTouchTapGesture({ clientX, clientY, onTap, onCancel, allowMouse = false }) {
  if (!allowMouse && !isTouchUi()) return;
  clearTouchTapGesture();
  cancelScheduledTooltipHide();
  touchTapGesture = {
    startX: clientX,
    startY: clientY,
    onTap,
    onCancel,
    cancelled: false,
  };
}

/** На touch/pen — сразу при касании; на mouse — только подготовка жеста до pointerup. */
function armPointerTapTooltip(clientX, clientY, onTap, { pointerType, allowMouse = true } = {}) {
  beginTouchTapGesture({ clientX, clientY, allowMouse, onTap });
  if (isTouchLikePointerType(pointerType) || (!pointerType && isTouchUi())) {
    finishTouchTapGesture(clientX, clientY);
    return true;
  }
  return false;
}

function updateTouchTapGestureMove(clientX, clientY) {
  if (!touchTapGesture || touchTapGesture.cancelled) return;
  const dist = Math.hypot(clientX - touchTapGesture.startX, clientY - touchTapGesture.startY);
  if (dist >= TOOLTIP_CONFIG.moveTolerance) {
    touchTapGesture.cancelled = true;
    touchTapGesture.onCancel?.();
    clearTouchTapGesture();
    if (isTouchUi() && sidebarTooltipPinned && !dragPayload) {
      hideSidebarTooltip();
    }
  }
}

/** @returns {boolean} true, если сработал tap и показана подсказка */
function finishTouchTapGesture(clientX, clientY) {
  if (!touchTapGesture) return false;
  const gesture = touchTapGesture;
  clearTouchTapGesture();
  if (!gesture.cancelled) {
    gesture.onTap?.(clientX, clientY);
    return true;
  }
  return false;
}

function cancelScheduledTooltipHide() {
  if (tooltipHideTimer) {
    clearTimeout(tooltipHideTimer);
    tooltipHideTimer = null;
  }
}

function hideSidebarTooltip() {
  cancelScheduledTooltipHide();
  sidebarTooltipPinned = false;
  if (typeof clearDomSparkleHighlights === "function") clearDomSparkleHighlights();
  const el = document.getElementById("sidebar-tooltip");
  const wasCombatFeed = sidebarTooltipSource === "combat-feed";
  if (el) {
    el.classList.add("hidden");
    el.classList.remove("combat-feed-hint-tooltip", "sidebar-tooltip--floating", "sidebar-tooltip--card");
  }
  setPrepTooltipDockPassthrough(false);
  syncPrepTooltipDockVisibility();
  fieldTooltipVisible = false;
  if (wasCombatFeed) {
    clearCombatFeedTooltipActive();
    if (typeof CombatLog?.onExternalTooltipHide === "function") {
      CombatLog.onExternalTooltipHide();
    }
  }
}

function isMobilePrepPortrait() {
  return document.documentElement.dataset.prepLayout === "mobile" && phase === "prep";
}

/** Живой prep-забег: не intro (#class-overlay), не battle/replay. */
function isLivePrepSession() {
  if (phase !== "prep") return false;
  if (!document.body.classList.contains("screen-app-visible")) return false;
  if (isPopupOpen("class-overlay")) return false;
  return document.getElementById("app")?.dataset.phase === "prep";
}

function isTabletSidePrepTooltipDock() {
  return isLivePrepSession() && document.documentElement.dataset.uiSurface === "tablet-side";
}

function getPrepHeroGridTooltipZone(margin = 10) {
  const heroLayer = document.getElementById("prep-character-layer");
  const fieldIsland = document.getElementById("prep-field-island");
  const canvas = document.getElementById("game-canvas");
  const topBar = document.getElementById("prep-top-bar");
  const bottomChrome = document.getElementById("bottom-chrome");
  const enemySide = document.getElementById("app")?.dataset.prepSide === "enemy";

  const islandRect = fieldIsland?.getBoundingClientRect();
  const canvasRect = canvas?.getBoundingClientRect();
  // Сетка внутри island выровнена вправо — при росте island (свёрнутая HUD-карточка)
  // левый край контейнера уезжает под героя; для коридора берём canvas, не island.
  const gridRect = (canvasRect && canvasRect.width >= 40)
    ? canvasRect
    : islandRect;
  const heroRect = heroLayer?.getBoundingClientRect();
  const topBarRect = topBar?.getBoundingClientRect();
  const bottomRect = bottomChrome?.getBoundingClientRect();
  const vv = window.visualViewport;
  const viewTop = vv?.offsetTop ?? 0;
  const viewBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight);

  if (!gridRect || gridRect.width < 40) return null;

  let left;
  let right;
  if (enemySide) {
    if (!heroRect || heroRect.width < 24) return null;
    left = gridRect.right + margin;
    right = heroRect.left - margin;
  } else {
    left = heroRect && heroRect.width > 24 ? heroRect.right + margin : margin;
    right = gridRect.left - margin;
  }
  if (right - left < 72) return null;

  const top = (topBarRect?.bottom ?? viewTop) + margin;
  const bottom = (bottomRect?.top ?? viewBottom) - margin;
  if (bottom <= top + 48) return null;

  return { left, right, top, bottom };
}

/** Зона портрета героя на prep (tablet-side): тултипы предметов магазина. */
function getPrepHeroPortraitTooltipZone(margin = 8) {
  const heroLayer = document.getElementById("prep-character-layer");
  const heroVisual = heroLayer?.querySelector(".prep-character-img, .prep-character-emoji, .prep-character");
  const topBar = document.getElementById("prep-top-bar");
  const bottomChrome = document.getElementById("bottom-chrome");

  const heroRect = (heroVisual?.getBoundingClientRect().width > 24)
    ? heroVisual.getBoundingClientRect()
    : heroLayer?.getBoundingClientRect();
  if (!heroRect || heroRect.width < 24) return null;

  const topBarRect = topBar?.getBoundingClientRect();
  const bottomRect = bottomChrome?.getBoundingClientRect();
  const vv = window.visualViewport;
  const viewTop = (topBarRect?.bottom ?? vv?.offsetTop ?? 0) + margin;
  const viewBottom = (bottomRect?.top ?? (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight)) - margin;

  const top = Math.max(viewTop, Math.round(heroRect.top + margin));
  const bottom = Math.min(viewBottom, Math.round(heroRect.bottom - margin));
  const left = Math.round(heroRect.left + margin);
  const right = Math.round(heroRect.right - margin);
  if (right - left < 48 || bottom - top < 48) return null;

  return { left, right, top, bottom };
}

function isTabletSideShopHeroTooltipDock() {
  return isTabletSidePrepTooltipDock() && sidebarTooltipSource === "shop";
}

function setPrepTooltipDockPassthrough(active) {
  const dock = document.getElementById("prep-tooltip-dock");
  if (!dock) return;
  dock.classList.toggle("prep-tooltip-dock--passthrough", !!active);
  if (active) dock.classList.remove("hidden");
}

function syncPrepTooltipDockVisibility() {
  const el = document.getElementById("sidebar-tooltip");
  const dock = document.getElementById("prep-tooltip-dock");
  if (!dock) return;

  if (!isLivePrepSession()) {
    dock.classList.add("hidden");
    dock.classList.remove("prep-tooltip-dock--passthrough", "prep-tooltip-dock--item", "prep-tooltip-dock--hero-grid", "prep-tooltip-dock--hero-portrait");
    return;
  }

  if (isMobilePrepPortrait() || isTabletSidePrepTooltipDock()) {
    const hasItemTip = el && !el.classList.contains("hidden")
      && !el.classList.contains("sidebar-tooltip--floating");
    const shopHeroTip = hasItemTip && isTabletSideShopHeroTooltipDock();
    dock.classList.remove("prep-tooltip-dock--passthrough");
    dock.classList.toggle("hidden", !hasItemTip);
    dock.classList.toggle("prep-tooltip-dock--item", hasItemTip);
    dock.classList.toggle("prep-tooltip-dock--hero-portrait", shopHeroTip);
    dock.classList.toggle("prep-tooltip-dock--hero-grid", isTabletSidePrepTooltipDock() && hasItemTip && !shopHeroTip);
    if (hasItemTip) positionPrepTooltipDock();
    return;
  }

  dock.classList.remove("prep-tooltip-dock--item", "prep-tooltip-dock--hero-grid", "prep-tooltip-dock--hero-portrait");

  if (!el) return;

  if (el.classList.contains("sidebar-tooltip--floating")) {
    dock.classList.remove("hidden");
    dock.classList.add("prep-tooltip-dock--passthrough");
    return;
  }

  dock.classList.remove("prep-tooltip-dock--passthrough");
  dock.classList.toggle("hidden", el.classList.contains("hidden"));
}

function shouldUsePrepTooltipDock(placement) {
  if (!isLivePrepSession()) return false;
  if (sidebarTooltipSource === "enhancement"
    || sidebarTooltipSource === "companion"
    || sidebarTooltipSource === "combat-feed") {
    return false;
  }
  const ctx = placement || sidebarTooltipSource;
  const itemCtx = ctx === "shop" || ctx === "bench" || ctx === "field" || ctx === "inventory" || ctx === "doll";
  if (!itemCtx) return false;
  return isMobilePrepPortrait() || isTabletSidePrepTooltipDock();
}

function positionMobilePrepTooltipDock(dock) {
  const root = document.documentElement;
  const uiScale = parseFloat(getComputedStyle(root).getPropertyValue("--ui-scale")) || 1;
  const margin = Math.round(8 * uiScale);
  const vv = window.visualViewport;
  const viewLeft = vv?.offsetLeft ?? 0;
  const viewWidth = vv?.width ?? window.innerWidth;

  const readZonePx = (name, fallback = 0) => {
    const inline = parseFloat(root.style.getPropertyValue(name));
    if (Number.isFinite(inline) && inline > 0) return inline;
    const computed = parseFloat(getComputedStyle(root).getPropertyValue(name));
    if (Number.isFinite(computed) && computed > 0) return computed;
    return fallback;
  };

  if (typeof window.syncPrepMobileZoneAnchors === "function") {
    window.syncPrepMobileZoneAnchors({ phase: "prep" });
  }

  const toolbarTop = readZonePx(
    "--prep-toolbar-zone-top",
    document.getElementById("bottom-chrome")?.getBoundingClientRect().top ?? window.innerHeight,
  );
  let zoneBottom = toolbarTop - margin;

  const shopPanel = document.getElementById("shop-panel");
  const shopOpen = root.hasAttribute("data-prep-shop-open");
  if (shopOpen && shopPanel) {
    const shopRect = shopPanel.getBoundingClientRect();
    if (shopRect.top < zoneBottom) zoneBottom = shopRect.top - margin;
  }

  const heroTop = readZonePx("--prep-hero-zone-top", 0);
  const heroBottom = readZonePx("--prep-hero-zone-bottom", 0);
  const canvasBottom = readZonePx(
    "--prep-canvas-zone-bottom",
    document.getElementById("prep-field-island")?.getBoundingClientRect().bottom ?? margin,
  );

  let zoneTop;
  if (heroBottom > heroTop + 48) {
    zoneTop = heroTop + margin;
    zoneBottom = Math.min(zoneBottom, heroBottom - margin);
  } else {
    zoneTop = canvasBottom + margin;
  }

  if (zoneBottom <= zoneTop + 40) {
    zoneTop = canvasBottom + margin;
    zoneBottom = toolbarTop - margin;
    if (shopOpen && shopPanel) {
      const shopRect = shopPanel.getBoundingClientRect();
      if (shopRect.top < zoneBottom) zoneBottom = shopRect.top - margin;
    }
  }

  const availableH = Math.max(48, zoneBottom - zoneTop);
  const zoneHeroH = parseFloat(getComputedStyle(root).getPropertyValue("--zone-hero-h")) || availableH;
  const maxHeight = Math.min(220, Math.round(Math.min(zoneHeroH * 0.9, availableH)));
  const top = Math.max(margin, zoneTop);

  dock.style.left = `${viewLeft + margin}px`;
  dock.style.width = `${Math.max(120, viewWidth - margin * 2)}px`;
  dock.style.top = `${top}px`;
  dock.style.maxHeight = `${maxHeight}px`;
  dock.style.height = "auto";
}

function positionTabletSidePrepTooltipDock(dock) {
  const root = document.documentElement;
  const uiScale = parseFloat(getComputedStyle(root).getPropertyValue("--ui-scale")) || 1;
  const margin = Math.round(6 * uiScale);

  if (isTabletSideShopHeroTooltipDock()) {
    const heroZone = getPrepHeroPortraitTooltipZone(margin);
    if (heroZone) {
      const zoneW = heroZone.right - heroZone.left;
      const zoneH = heroZone.bottom - heroZone.top;
      dock.style.left = `${heroZone.left}px`;
      dock.style.top = `${heroZone.top}px`;
      dock.style.width = `${zoneW}px`;
      dock.style.maxHeight = `${zoneH}px`;
      dock.style.height = `${zoneH}px`;
      return;
    }
  }

  const zone = getPrepHeroGridTooltipZone(margin);

  if (!zone) {
    const heroRect = document.getElementById("prep-character-layer")?.getBoundingClientRect();
    const topBarRect = document.getElementById("prep-top-bar")?.getBoundingClientRect();
    const bottomRect = document.getElementById("bottom-chrome")?.getBoundingClientRect();
    const dockW = Math.round(248 * uiScale);
    const dockH = Math.round(220 * uiScale);
    const vv = window.visualViewport;
    const viewTop = (vv?.offsetTop ?? 0) + margin;
    const viewBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - margin;

    let left = margin;
    let top = (topBarRect?.bottom ?? viewTop) + margin;
    if (heroRect && heroRect.width > 24) {
      left = heroRect.right + margin;
      top = Math.max(top, heroRect.top + margin);
    }
    left = Math.min(left, Math.max(margin, (vv?.offsetLeft ?? 0) + (vv?.width ?? window.innerWidth) - dockW - margin));
    top = Math.max(viewTop, Math.min(top, (bottomRect?.top ?? viewBottom) - dockH - margin));

    dock.style.left = `${left}px`;
    dock.style.top = `${top}px`;
    dock.style.width = `${dockW}px`;
    dock.style.maxHeight = `${dockH}px`;
    dock.style.height = "auto";
    return;
  }

  const zoneW = zone.right - zone.left;
  const zoneH = zone.bottom - zone.top;

  dock.style.left = `${zone.left}px`;
  dock.style.top = `${zone.top}px`;
  dock.style.width = `${zoneW}px`;
  dock.style.maxHeight = `${zoneH}px`;
  dock.style.height = `${zoneH}px`;
}

function positionPrepTooltipDock() {
  const dock = document.getElementById("prep-tooltip-dock");
  if (!dock) return;

  if (isMobilePrepPortrait()) {
    positionMobilePrepTooltipDock(dock);
    return;
  }

  if (isTabletSidePrepTooltipDock()) {
    positionTabletSidePrepTooltipDock(dock);
    return;
  }

  dock.style.height = "";
  const margin = 10;
  const corridor = getTooltipCorridorBounds(margin, 8);
  const vv = window.visualViewport;
  const viewLeft = vv?.offsetLeft ?? 0;
  const viewTop = vv?.offsetTop ?? 0;
  const viewWidth = vv?.width ?? window.innerWidth;
  const viewHeight = vv?.height ?? window.innerHeight;

  let left;
  let width;
  let top;
  let maxHeight;

  if (corridor) {
    width = Math.min(360, Math.max(240, corridor.right - corridor.left - margin * 2));
    left = corridor.left + (corridor.right - corridor.left - width) / 2;
  } else {
    width = Math.min(340, Math.max(240, viewWidth * 0.42));
    left = viewLeft + (viewWidth - width) / 2;
  }

  const toolbar = document.getElementById("bottom-chrome");
  const combatFeedBtn = document.getElementById("btn-combat-feed");
  const feedPanel = document.getElementById("combat-feed-panel");
  const toolbarRect = toolbar?.getBoundingClientRect();
  const feedBtnRect = combatFeedBtn?.getBoundingClientRect();
  const feedOpen = feedPanel?.classList.contains("combat-feed-panel--open");

  let bottomLimit = (toolbarRect?.top ?? viewTop + viewHeight) - margin;
  if (feedOpen && feedPanel) {
    const feedRect = feedPanel.getBoundingClientRect();
    bottomLimit = Math.min(bottomLimit, feedRect.top - margin);
  } else if (feedBtnRect) {
    bottomLimit = Math.min(bottomLimit, feedBtnRect.top - margin);
  }

  const topLimit = (corridor?.top ?? viewTop) + margin;
  maxHeight = Math.min(360, Math.max(160, bottomLimit - topLimit - margin));
  top = Math.max(topLimit, bottomLimit - maxHeight);

  dock.style.left = `${left}px`;
  dock.style.top = `${top}px`;
  dock.style.width = `${width}px`;
  dock.style.maxHeight = `${maxHeight}px`;
}

function scheduleHideSidebarTooltip() {
  if (!isTouchUi()) {
    hideSidebarTooltip();
    return;
  }
  cancelScheduledTooltipHide();
  tooltipHideTimer = window.setTimeout(() => {
    tooltipHideTimer = null;
    hideSidebarTooltip();
  }, TOOLTIP_CONFIG.hideDelay);
}

function requestHideSidebarTooltip() {
  if (isSyntheticMouseFromTouch()) return;
  if (sidebarTooltipPinned) return;
  if (isTouchUi()) scheduleHideSidebarTooltip();
  else hideSidebarTooltip();
}

function isSidebarTooltipVisible() {
  const tooltip = document.getElementById("sidebar-tooltip");
  return !!tooltip && !tooltip.classList.contains("hidden");
}

function shouldSuppressTooltipReshow(sourceEl) {
  if (!tooltipDismissGesture) return false;
  const sameSource = sourceEl && tooltipDismissGesture.sourceEl && sourceEl === tooltipDismissGesture.sourceEl;
  tooltipDismissGesture = null;
  return sameSource;
}

function dismissSidebarTooltipFromPointer(e) {
  if (!isSidebarTooltipVisible()) return false;
  tooltipDismissGesture = {
    pointerId: e?.pointerId ?? null,
    sourceEl: e?.target?.closest?.(".shop-card, .bench-card, .doll-slot, .profile-avatar, .combat-feed-msg-text--hinted, .profile-status-chip, .profile-stack-chip, .prep-companion-tip, .enh-slot") || null,
  };
  hideSidebarTooltip();
  tooltipItem = null;
  if (typeof syncFieldTooltip === "function") syncFieldTooltip();
  return true;
}

function bindGlobalTooltipDismiss() {
  if (document.documentElement.dataset.globalTooltipDismissBound) return;
  document.documentElement.dataset.globalTooltipDismissBound = "1";
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (isSyntheticMouseFromTouch()) return;
    if (!isSidebarTooltipVisible()) return;
    if (e.target.closest("#sidebar-tooltip, #prep-tooltip-dock")) return;
    dismissSidebarTooltipFromPointer(e);
  }, true);
  document.addEventListener("pointerup", () => {
    window.setTimeout(() => {
      tooltipDismissGesture = null;
    }, 0);
  }, true);
  document.addEventListener("pointercancel", () => {
    tooltipDismissGesture = null;
  }, true);
}

function bindTouchTooltipDismiss() {
  bindGlobalTooltipDismiss();
}

function bindTouchInput() {
  const boardSection = document.querySelector(".board-section");
  const shopPanel = document.getElementById("shop-panel");
  const prepShopPopover = document.getElementById("prep-shop-popover");
  const benchPopover = document.getElementById("prep-bench-popover");
  const benchFab = document.getElementById("btn-prep-bench-fab");
  const touchTargets = [boardSection, canvas, shopPanel, prepShopPopover, benchPopover, benchFab].filter(Boolean);
  const captureOpts = { passive: false, capture: true };
  const bubbleOpts = { passive: false };
  let activeGesture = null;

  const isTouchLikePointer = (e) => e.pointerType === "touch" || e.pointerType === "pen";
  const gestureKey = (kind, id) => `${kind}:${id}`;
  const ignoreTarget = (target) => target?.closest?.("button, a, input, select, textarea");

  const onDown = (kind, id, x, y, e) => {
    if (activeGesture) return;
    if (ignoreTarget(e.target)) return;

    markTouchInteraction();

    if ((phase === "battle" || phase === "replay") && e.target?.closest?.("#game-canvas") && !dragPayload) {
      activeGesture = gestureKey(kind, id);
      lastTouchEventAt = Date.now();
      if (e.cancelable) e.preventDefault();
      beginTouchTapGesture({
        clientX: x,
        clientY: y,
        onTap: () => {
          updatePointerFromClient(x, y);
          updateTooltip(mousePos.x, mousePos.y);
        },
      });
      return;
    }

    if (!isLoadoutInteractionPhase() || gameOver) return;
    activeGesture = gestureKey(kind, id);
    lastTouchEventAt = Date.now();
    if (e.cancelable) e.preventDefault();
    const shopPointerSurface = e.target?.closest?.(
      "#prep-shop-popover, #shop-panel, .shop-card, .shop-pin, .btn-refresh-shop",
    );
    if (kind === "pointer" && !shopPointerSurface) {
      try {
        boardSection?.setPointerCapture(id);
      } catch (_) {}
    }
    gamepadPointerDownAt(x, y);
  };

  const onMove = (kind, id, x, y, e) => {
    if (activeGesture !== gestureKey(kind, id)) return;
    updateTouchTapGestureMove(x, y);
    if (e.cancelable) e.preventDefault();
    updatePointerFromClient(x, y);
  };

  const onUp = (kind, id, x, y) => {
    if (activeGesture !== gestureKey(kind, id)) return;
    lastTouchEventAt = Date.now();
    const tapHandled = finishTouchTapGesture(x, y);
    if (tapHandled && !dragPayload) {
      pendingShopDrag = null;
      pendingBenchDrag = null;
      pendingEnhancementDrag = null;
      pendingCanvasPick = null;
      syncUiDragState();
      activeGesture = null;
      if (kind === "pointer") {
        try {
          boardSection?.releasePointerCapture(id);
        } catch (_) {}
      }
      return;
    }
    gamepadPointerUpAt(x, y);
    if (kind === "pointer") {
      try {
        boardSection?.releasePointerCapture(id);
      } catch (_) {}
    }
    activeGesture = null;
  };

  boardSection?.addEventListener("pointerdown", (e) => {
    if (!isTouchLikePointer(e)) return;
    onDown("pointer", e.pointerId, e.clientX, e.clientY, e);
  }, captureOpts);

  boardSection?.addEventListener("pointermove", (e) => {
    if (!isTouchLikePointer(e)) return;
    onMove("pointer", e.pointerId, e.clientX, e.clientY, e);
  }, captureOpts);

  boardSection?.addEventListener("pointerup", (e) => {
    if (!isTouchLikePointer(e)) return;
    onUp("pointer", e.pointerId, e.clientX, e.clientY);
  }, captureOpts);

  boardSection?.addEventListener("pointercancel", (e) => {
    if (!isTouchLikePointer(e)) return;
    onUp("pointer", e.pointerId, e.clientX, e.clientY);
  }, captureOpts);

  touchTargets.forEach((el) => {
    el.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      onDown("touch", t.identifier, t.clientX, t.clientY, e);
    }, captureOpts);

    el.addEventListener("touchmove", (e) => {
      const id = activeGesture?.startsWith("touch:") ? +activeGesture.split(":")[1] : null;
      const t = id == null ? e.touches[0] : [...e.touches].find((touch) => touch.identifier === id) || e.touches[0];
      if (!t) return;
      onMove("touch", t.identifier, t.clientX, t.clientY, e);
    }, bubbleOpts);

    el.addEventListener("touchend", (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      onUp("touch", t.identifier, t.clientX, t.clientY);
    }, bubbleOpts);

    el.addEventListener("touchcancel", (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      onUp("touch", t.identifier, t.clientX, t.clientY);
    }, bubbleOpts);
  });

  window.addEventListener("touchmove", (e) => {
    if (!activeGesture?.startsWith("touch:")) return;
    const id = +activeGesture.split(":")[1];
    const t = [...e.touches].find((touch) => touch.identifier === id) || e.touches[0];
    if (!t) return;
    onMove("touch", t.identifier, t.clientX, t.clientY, e);
  }, bubbleOpts);

  window.addEventListener("touchend", (e) => {
    if (!activeGesture?.startsWith("touch:")) return;
    const t = e.changedTouches[0];
    if (!t) return;
    onUp("touch", t.identifier, t.clientX, t.clientY);
  }, bubbleOpts);

  document.addEventListener("touchstart", (e) => {
    if (dragPayload && isLoadoutInteractionPhase() && e.touches.length === 2) {
      e.preventDefault();
      rotateDragItem();
    }
  }, bubbleOpts);

  bindTouchTooltipDismiss();
  window.resetPrepTouchGesture = () => {
    activeGesture = null;
  };
}

/** Глобальный pointer bridge: drag из магазина / рюкзака на touch и pen. */
function bindPrepLoadoutDragPointer() {
  if (bindPrepLoadoutDragPointer._done) return;
  bindPrepLoadoutDragPointer._done = true;

  const isActiveDrag = () => !!(dragPayload || pendingShopDrag || pendingBenchDrag || pendingEnhancementDrag);

  const onMove = (e) => {
    if (!isLoadoutInteractionPhase() || !isActiveDrag()) return;
    if (e.cancelable) e.preventDefault();
    updatePointerFromClient(e.clientX, e.clientY);
  };

  const onUp = (e) => {
    if (!isLoadoutInteractionPhase() || !isActiveDrag()) return;
    if (e.button != null && e.button !== 0) return;
    if (tryBuyFromPendingShopDrag(e.clientX, e.clientY)) return;
    finishDragDrop(e);
  };

  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp, { passive: false });
  window.addEventListener("pointercancel", onUp, { passive: false });
}

function setPhaseLabel(text, isBattle = false) {
  const el = document.getElementById("phase-label");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("battle", isBattle);
}

function init() {
  applyGridMetricsFromCss();
  initInteractionMode();
  onInteractionModeChange((mode) => {
    if (mode !== "touch") clearTouchTapGesture();
    if (typeof refreshGamepadHints === "function") refreshGamepadHints();
  });

  const markMouseFromEvent = (e) => {
    if (isSyntheticMouseFromTouch()) return;
    if (e.pointerType && e.pointerType !== "mouse") return;
    markMouseInteraction();
  };
  document.addEventListener("mousedown", markMouseFromEvent, true);
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") return;
    if (e.pointerType === "mouse" && !isSyntheticMouseFromTouch()) markMouseInteraction();
  }, true);

  canvas = document.getElementById("game-canvas");
  ctx = canvas.getContext("2d");
  fxCanvas = document.getElementById("canvas-fx");
  fxCtx = fxCanvas?.getContext("2d") || null;
  applyPhaseCanvasLayout();
  syncBattleArenaLayout();
  canvas.addEventListener("mousedown", (e) => {
    if (isSyntheticMouseFromTouch()) return;
    markMouseInteraction();
    if (phase === "battle" && typeof handleBattleHudClick === "function") {
      handleBattleHudClick(e.clientX, e.clientY);
    }
    onMouseDown(e);
  });
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (dragPayload && isLoadoutInteractionPhase()) rotateDragItem();
  });
  canvas.addEventListener("mouseleave", () => {
    if (!dragPayload) {
      hoverCell = null;
      hoverSlot = null;
      tooltipItem = null;
    }
  });
  window.addEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("mousemove", (e) => {
    if (isSyntheticMouseFromTouch()) return;
    onGlobalMouseMove(e);
  });
  window.addEventListener("mouseup", (e) => {
    if (isSyntheticMouseFromTouch()) return;
    if (tryBuyFromPendingShopDrag(e.clientX, e.clientY)) return;
    finishDragDrop(e);
  });
  document.addEventListener("selectstart", (e) => {
    if (dragPayload || pendingShopDrag) e.preventDefault();
  });
  document.addEventListener("dragstart", (e) => {
    if (dragPayload || pendingShopDrag) e.preventDefault();
  });
  bindTouchInput();
  bindPrepLoadoutDragPointer();
  document.getElementById("btn-fight").addEventListener("click", startBattle);
  document.getElementById("btn-refresh")?.addEventListener("click", () => refreshShop(true));
  document.getElementById("sell-drop-zone")?.addEventListener("click", sellSelected);
  document.getElementById("btn-restart").addEventListener("click", returnToMainMenu);
  document.querySelectorAll(".game-mode-card").forEach((btn) => {
    btn.addEventListener("click", () => selectGameMode(btn.dataset.gameMode));
  });
  document.querySelectorAll(".campaign-trial-card").forEach((btn) => {
    btn.addEventListener("click", () => selectCampaignTrial(btn.dataset.campaignTrial));
  });
  if (typeof syncClassPickerCardsFromCatalog === "function") syncClassPickerCardsFromCatalog();
  if (typeof syncClassHeroRosterCaption === "function") syncClassHeroRosterCaption();
  document.querySelectorAll(".class-card[data-class]:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => selectPlayerClass(btn.dataset.class));
  });
  document.querySelectorAll(".opponent-class-card").forEach((btn) => {
    btn.addEventListener("click", () => selectOpponentClass(btn.dataset.opponentClass));
  });
  document.getElementById("btn-class-back-mode")?.addEventListener("click", () => {
    if (selectedGameMode === "campaign") showCampaignTrialStep();
    else showGameModeStep();
  });
  document.getElementById("btn-class-back-mode-campaign")?.addEventListener("click", () => showGameModeStep());
  document.getElementById("btn-class-back")?.addEventListener("click", () => {
    const summaryStep = document.getElementById("class-step-summary");
    const opponentStep = document.getElementById("class-step-opponent");
    const companionStep = document.getElementById("class-step-companion");
    const playerStep = document.getElementById("class-step-player");
    const campaignTrialStep = document.getElementById("class-step-campaign");
    if (summaryStep && !summaryStep.classList.contains("hidden")) showCompanionStep({ keepSelection: true });
    else if (opponentStep && !opponentStep.classList.contains("hidden")) showCompanionStep();
    else if (companionStep && !companionStep.classList.contains("hidden")) showPlayerClassStep();
    else if (playerStep && !playerStep.classList.contains("hidden")) {
      if (selectedGameMode === "campaign") showCampaignTrialStep();
      else showGameModeStep();
    }
    else if (campaignTrialStep && !campaignTrialStep.classList.contains("hidden")) showGameModeStep();
    else showGameModeStep();
  });
  document.getElementById("btn-class-back-player")?.addEventListener("click", () => showPlayerClassStep());
  document.getElementById("btn-class-back-companion")?.addEventListener("click", () => showCompanionStep({ keepSelection: true }));
  document.getElementById("btn-chrome-back")?.addEventListener("click", () => returnToMainMenu());
  bindClassSummaryInteractions();
  document.getElementById("btn-start-run")?.addEventListener("click", startRunFromOverlay);
  bindLobbyRosterClicks();
  initLobby2pHudBridge();
  bindLobby2pSellZones();
  window.addEventListener("resize", syncClassMobileDock, { passive: true });
  window.addEventListener("orientationchange", syncClassMobileDock, { passive: true });
  document.getElementById("btn-prep-player")?.addEventListener("click", () => setPrepViewSide("player"));
  document.getElementById("btn-prep-enemy")?.addEventListener("click", () => setPrepViewSide("enemy"));
  document.getElementById("btn-toggle-doll")?.addEventListener("click", togglePrepDollOpen);
  document.getElementById("btn-battle-continue")?.addEventListener("click", () => {
    if (isPhaseTransitioning()) return;
    if (isLobbyMode() && lobbyRoundSettling) {
      finishLobbyRoundFromContinue();
    }
    const continueAfterResult = () => {
      releasePreviousBattleReplayFrames();
      if (typeof hideBattleCountdownOverlay === "function") hideBattleCountdownOverlay();
      const continueBtn = document.getElementById("btn-battle-continue");
      if (continueBtn) continueBtn.textContent = "Продолжить";
      if (pendingGameOver) {
        showRunComplete();
        pendingGameOver = false;
        return;
      }
      if (isAnyLobbyMode() && lobbyState) {
        resetLobbyPrepTimer();
        setLobbyViewFighter(lobbyState.playerId);
        renderLobbyChrome(true);
      }
      setPhaseLabel(isCampaignMode() ? "Обучение" : "Подготовка", false);
      if (isCampaignMode()) syncCampaignChrome();
      requestAnimationFrame(() => updateUI());
    };
    const applyPrepPhase = () => {
      phase = "prep";
      renderPhase();
    };
    if (typeof ScreenTransitions !== "undefined" && ScreenTransitions.transitionFromResultToPrep) {
      void ScreenTransitions.transitionFromResultToPrep(
        applyPrepPhase,
        continueAfterResult,
        () => hideBattleResultPopupAsync("resultToPrep"),
      );
      return;
    }
    if (typeof hideBattleResultPopupAsync === "function") {
      void hideBattleResultPopupAsync().then(() => transitionToPhase("prep", continueAfterResult));
      return;
    }
    hideBattleResultPopup();
    transitionToPhase("prep", continueAfterResult);
  });
  document.getElementById("btn-battle-replay")?.addEventListener("click", () => {
    startBattleReplay();
  });
  initBattleControls({ onSkip: skipBattle });
  if (typeof initReplayTimeline === "function") initReplayTimeline();
  loadBattleSettings();
  bindProfileStatusTooltips();
  bindRunStatsToggle();
  bindBattleBuildStatsToggle();
  bindPrepHeroTooltip();
  bindPlayerCharacteristicsControls(getPlayerCharacteristicsState, getEnemyCharacteristicsState);
  initBoardPreviewControls();
  if (typeof initBattleInventoryPopover === "function") initBattleInventoryPopover();
  initRecipeBookControls();
  initSettingsControls();
  if (typeof initEscapeMenu === "function") {
    initEscapeMenu({
      returnToMainMenu,
      closeNestedPopups,
      getPhase: () => phase,
      getGameOver: () => gameOver,
      isPhaseTransitioning,
      isTypingBlocked: () => false,
      isActiveGameSession: () => !isPopupOpen("class-overlay")
        && (phase === "prep" || phase === "battle" || phase === "replay"),
      isBattleActive: () => phase === "battle" && !!battleState && !battleState.finished,
      isBattlePaused: () => typeof isBattlePaused === "function" ? isBattlePaused() : !!battlePaused,
      isReplayPlaying: () => phase === "replay" && !!replayPlayback?.playing,
      togglePause: () => {
        if (phase === "replay") {
          replayPlayback.playing = !replayPlayback.playing;
          battlePaused = !replayPlayback.playing;
        } else {
          toggleBattlePause();
        }
        updateBattleControlsUI();
      },
    });
  }
  if (typeof initVisualTheme === "function") initVisualTheme();
  if (typeof initSoundTheme === "function") initSoundTheme();
  if (typeof initPrepBuildEmojiBtn === "function") initPrepBuildEmojiBtn();
  if (typeof initLightBattleFxControls === "function") initLightBattleFxControls();
  if (typeof initEmojiOrbitSpeedControls === "function") initEmojiOrbitSpeedControls();
  if (typeof initCombatFeedControls === "function") initCombatFeedControls();
  initMusic();
  initGamepadControls({
    getSelectedGameMode: () => selectedGameMode,
    getPhase: () => phase,
    getGameOver: () => gameOver,
    getDt: () => lastGameLoopDt,
    isPhaseTransitioning,
    isPopupOpen,
    isBoardPreviewOpen,
    isRecipeBookOpen,
    closeAllPopups,
    useVirtualCursor: () => phase === "prep" && !gameOver && !isPopupOpen("class-overlay")
      && !isPopupOpen("battle-result-overlay") && !isPopupOpen("overlay")
      && !isRecipeBookOpen() && !isBoardPreviewOpen(),
    isDragging: () => !!dragPayload,
    getPrepSideKey: () => `${prepViewSide}:${phase}:${round}`,
    getGridCols: () => GRID_COLS,
    getGridRows: () => GRID_ROWS,
    setBoardFocus: setGamepadBoardFocus,
    clearBoardFocus: clearGamepadBoardFocus,
    activatePrepFocus: activateGamepadPrepFocus,
    dropAtBoardFocus: dropGamepadAtBoardFocus,
    updatePointerFromClient,
    pointerDownAt: gamepadPointerDownAt,
    pointerUpAt: gamepadPointerUpAt,
    rotateDrag: rotateDragItem,
    cancelDrag: () => {
      if (!dragPayload) return;
      restoreDraggedItem(dragFrom?.side || prepViewSide);
      clearDragUiState();
      renderBench();
      recalcSynergies();
      updateUI();
    },
    togglePrepSide: () => {
      if (phase !== "prep" || gameOver || isPhaseTransitioning()) return;
      if (isLobby2pMode() && lobbyState?.isSplitLobby) {
        setLobby2pActiveHuman(prepViewSide === "player" ? 1 : 0);
        return;
      }
      if (isLobbyMode() && lobbyState) {
        setLobbyViewFighter(cycleLobbyViewFighterId(lobbyState, lobbyViewFighterId, 1));
        return;
      }
      setPrepViewSide(prepViewSide === "player" ? "enemy" : "player");
    },
    onPrepFocusChanged: onGamepadPrepFocusChanged,
    togglePrepTooltips,
    sellBoardFocus: sellBoardFocusItem,
    sellBenchFocus: sellBenchFocusItem,
    sellDraggedQuick: sellDraggedItemQuick,
    dropDragToBench: dropDraggedItemToBench,
    toggleRecipeBook: toggleRecipeBookPopup,
    toggleCharacteristics: () => togglePlayerCharacteristicsPopup(getPlayerCharacteristicsState()),
    refreshShop: () => refreshShop(true),
    confirmPrimary: () => {
      handleEnterHotkey({ key: "Enter", preventDefault: () => {} });
    },
    togglePause: () => {
      if (phase === "replay") {
        replayPlayback.playing = !replayPlayback.playing;
        battlePaused = !replayPlayback.playing;
      } else {
        toggleBattlePause();
      }
      updateBattleControlsUI();
    },
    cycleBattleSpeed: (delta) => {
      const speeds = [1, 2, 3];
      const current = phase === "replay"
        ? (replayPlayback?.speed || savedBattleSpeed)
        : battleSpeedMultiplier;
      let idx = speeds.indexOf(current);
      if (idx < 0) idx = 0;
      idx = (idx + delta + speeds.length) % speeds.length;
      const speed = speeds[idx];
      if (phase === "replay" && replayPlayback) {
        replayPlayback.speed = speed;
        savedBattleSpeed = speed;
        localStorage.setItem(BATTLE_SPEED_STORAGE_KEY, String(speed));
      } else {
        setBattleSpeed(speed);
      }
      updateBattleControlsUI();
    },
  });
  const repositionOpenPrepTooltip = () => {
    if (!shouldUsePrepTooltipDock()) return;
    const tip = document.getElementById("sidebar-tooltip");
    if (tip && !tip.classList.contains("hidden")) positionPrepTooltipDock();
  };
  window.addEventListener("resize", repositionOpenPrepTooltip);
  window.visualViewport?.addEventListener("resize", repositionOpenPrepTooltip);
  showClassSelect();
  requestAnimationFrame(gameLoop);
}

function getGamePhase() {
  return phase;
}

function isBattleUiPhase() {
  return phase === "battle" || phase === "replay";
}

/** В flank-arena рюкзак показывается по тапу на портрет, не на canvas. */
function shouldDrawCanvasLoadoutInBattle() {
  if (!isBattleUiPhase()) return false;
  return document.documentElement.dataset.battleHeroPlacement !== "flank-arena";
}

function shouldThrottleBattleCanvasDraw() {
  if (!isBattleUiPhase()) return false;
  if (document.documentElement.dataset.battleHeroPlacement === "flank-arena") return true;
  return typeof BattleFxTier !== "undefined" && BattleFxTier.isLightBattleFx();
}

function battleCanvasDrawFps() {
  if (document.documentElement.dataset.uiTier === "tablet") return 12;
  return 20;
}

function tickBattleHudLite() {
  const state = getDisplayBattleState();
  if (!isBattleUiPhase() || !state) return;
  const now = performance.now();
  if (now - (tickBattleHudLite._at || 0) < 120) return;
  tickBattleHudLite._at = now;
  if (typeof syncLiveAvatarHeroFrame === "function") syncLiveAvatarHeroFrame(state);
}

function getAppDataPhase() {
  if (phase === "battle" || phase === "replay") return phase;
  return "prep";
}

function applyPhaseCanvasLayout() {
  if (!canvas) return;
  layoutCell = GRID_CELL;
  layoutPlayerX = GRID_PLAYER_X;
  if (phase === "prep") {
    if (isLobby2pMode() && lobbyState?.isSplitLobby) {
      canvas.width = BATTLE_CANVAS_W;
      canvas.height = BATTLE_CANVAS_H;
    } else {
      canvas.width = PREP_CANVAS_W;
      canvas.height = PREP_CANVAS_H;
    }
  } else {
    canvas.width = BATTLE_CANVAS_W;
    canvas.height = BATTLE_CANVAS_H;
  }
  if (fxCanvas) {
    fxCanvas.width = canvas.width;
    fxCanvas.height = canvas.height;
  }
  layoutCanvasH = canvas.height;
  if (typeof warmupCellEmojiMetrics === "function") warmupCellEmojiMetrics(ctx);
  if (typeof window.fitCanvasDisplaySize === "function") {
    window.fitCanvasDisplaySize();
  }
  if (typeof window.syncFxCanvasGeometry === "function") {
    requestAnimationFrame(() => window.syncFxCanvasGeometry());
  }
}

function getPlayerCharacteristicsState() {
  return {
    phase,
    gameOver,
    side: "player",
    classId: playerClass,
    displayName: getPlayerProfileName(),
    gold,
    containers: playerContainers,
    items: playerItems,
    runResults,
  };
}

function getEnemyCharacteristicsState() {
  return {
    phase,
    gameOver,
    side: "enemy",
    classId: enemyClass,
    displayName: getEnemyDisplayName(),
    gold: enemyGold,
    containers: enemyContainers,
    items: enemyItems,
    runResults: null,
  };
}

function renderPhase() {
  const app = document.getElementById("app");
  const root = document.documentElement;
  if (app) {
    app.dataset.phase = getAppDataPhase();
    app.dataset.gameMode = gameMode;
    if (phase === "prep") app.dataset.prepSide = prepViewSide;
  }
  if (root) {
    root.dataset.gamePhase = phase === "battle" || phase === "replay" ? phase : phase === "prep" ? "prep" : "";
    root.dataset.gameMode = gameMode;
  }
  syncClassOverlayHiddenDuringGame();
  applyPhaseCanvasLayout();
  setBattleControlsVisible(isBattleUiPhase());
  syncBattleArenaLayout();
  syncPrepHeroHudDom();
  if (phase !== "prep") {
    window.forceHidePrepBenchChrome?.();
    window.closePrepBenchPopover?.();
  }
  window.syncPrepBenchFabVisibility?.();
  const battleSceneUi = document.getElementById("battle-scene-ui");
  if (battleSceneUi) battleSceneUi.setAttribute("aria-hidden", isBattleUiPhase() ? "false" : "true");
  renderPlayerProfiles();
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
  if (phase === "prep" && !gameOver) {
    ensureShopReadyForSide("player");
    if (isEnemyPrepEditable()) ensureShopReadyForSide("enemy");
    if (phase === "prep") updatePrepSideUI();
    if (isLobby2pMode() && lobbyState?.isSplitLobby) {
      renderLobby2pCommerce();
    } else {
      renderShop();
      renderBench();
    }
  }
  syncPrepTooltipDockVisibility();
  renderFightButton();
  if (phase !== "prep") closeAllFighterCharacteristicsPopups();
  if (!isBattleUiPhase() && typeof closeBattleInventoryPopover === "function") closeBattleInventoryPopover();
  if (phase !== "prep") setPrepDollOpen(false);
  if (phase !== "prep" && typeof closeMobilePrepShop === "function") closeMobilePrepShop();
  if (typeof applyUiLayout === "function") scheduleLayoutAfterPhase();
  syncLobby2pHudDom();
  syncRunHudPhase();
  syncBattleHudVisibility();
  renderLobbyChrome();
  if (typeof CombatLog?.syncCombatFeedPhase === "function") CombatLog.syncCombatFeedPhase();
  if (isLobbyMode() && isBattleUiPhase()) {
    if (typeof CombatLog?.hideTooltip === "function") CombatLog.hideTooltip();
  }
  if (isBattleUiPhase() && typeof window.scheduleBattleHeroRowSync === "function") {
    window.scheduleBattleHeroRowSync();
  }
  if (typeof syncReplayTimeline === "function") syncReplayTimeline();
  if (!isBattleUiPhase() && typeof resetBattleAuraFrame === "function") {
    resetBattleAuraFrame();
  }
  syncChromeNavButtons();
}

function syncBattleHudVisibility() {
  const battleHud = document.getElementById("battle-run-hud");
  const runHud = document.getElementById("run-hud");
  const live = isBattleUiPhase();
  if (battleHud) {
    battleHud.hidden = !live;
    if (live) battleHud.removeAttribute("aria-hidden");
    else battleHud.setAttribute("aria-hidden", "true");
  }
  if (runHud) {
    runHud.hidden = true;
    runHud.setAttribute("aria-hidden", "true");
  }
  if (live && typeof syncBattleHudAnchors === "function") {
    requestAnimationFrame(() => syncBattleHudAnchors());
  }
}

function scheduleLayoutAfterPhase() {
  requestAnimationFrame(() => {
    if (typeof applyUiLayout === "function") applyUiLayout();
  });
}

function setPhase(newPhase) {
  phase = newPhase;
  renderPhase();
}

function transitionToPhase(newPhase, afterTransition) {
  if (typeof ScreenTransitions !== "undefined") {
    return ScreenTransitions.transitionPhase(
      newPhase,
      (nextPhase) => {
        phase = nextPhase;
        renderPhase();
      },
      afterTransition,
    );
  }
  const layout = document.querySelector(".game-layout");
  if (layout) layout.classList.add("phase-transitioning");
  window.setTimeout(() => {
    phase = newPhase;
    renderPhase();
    afterTransition?.();
    requestAnimationFrame(() => {
      layout?.classList.remove("phase-transitioning");
      window.flushDeferredLayoutPasses?.();
    });
  }, 200);
}

function getFieldLayoutMetrics() {
  const gridInnerW = GRID_INNER_W;
  const playerLeft = 0;
  const playerRight = gridInnerW;
  const enemyLeft = ENEMY_X;
  const enemyRight = ENEMY_X + gridInnerW;
  const totalW = BATTLE_CANVAS_W;
  const centerWidth = enemyLeft - playerRight;
  const enemyWidth = enemyRight - enemyLeft;
  const shopLeftRatio = Math.min(1, (playerRight + SHOP_FIELD_GAP) / totalW);
  const shopRightRatio = Math.max(0, (enemyLeft - SHOP_FIELD_GAP) / totalW);
  return {
    playerLeft,
    playerRight,
    enemyLeft,
    enemyRight,
    centerWidth,
    enemyWidth,
    totalW,
    playerColumnRatio: playerRight / totalW,
    centerRatio: centerWidth / totalW,
    enemyColumnRatio: enemyWidth / totalW,
    shopLeftRatio,
    shopRightRatio,
  };
}

function syncBattleArenaLayout() {
  const arena = document.getElementById("battle-arena");
  if (!arena || !canvas) return;

  const layout = getFieldLayoutMetrics();

  arena.style.setProperty("--battle-field-ratio", String(layout.playerColumnRatio));
  arena.style.setProperty("--battle-center-ratio", String(layout.centerRatio));
  arena.style.setProperty("--battle-enemy-ratio", String(layout.enemyColumnRatio));
  arena.style.setProperty("--battle-shop-left", String(layout.shopLeftRatio));
  arena.style.setProperty("--battle-shop-right", String(layout.shopRightRatio));

  arena.classList.toggle("is-battle", isBattleUiPhase());
  if (typeof window.fitCanvasDisplaySize === "function") {
    window.fitCanvasDisplaySize();
  }
  if (typeof window.syncFxCanvasGeometry === "function") {
    requestAnimationFrame(() => window.syncFxCanvasGeometry());
  }
  if (typeof window.syncBattleSceneGridMetrics === "function") {
    requestAnimationFrame(() => window.syncBattleSceneGridMetrics());
  }
}

function bindRunStatsToggle() {
  const btn = document.getElementById("btn-prep-hero-stats");
  const popover = document.getElementById("run-stats-popover");
  if (!btn || !popover) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    closePrepHeroTooltip();
    toggleRunStatsPopover();
  });

  document.addEventListener("click", (e) => {
    if (popover.classList.contains("hidden")) return;
    if (e.target.closest(".run-stats-anchor") || e.target.closest("#prep-hero-tooltip")) return;
    closeRunStatsPopover();
  });
}

function bindPrepHeroTooltip() {
  const trigger = document.getElementById("btn-prep-hero-info");
  const tooltip = document.getElementById("prep-hero-tooltip");
  if (!trigger || !tooltip) return;

  const open = () => {
    refreshPrepHeroTooltip();
    tooltip.classList.remove("hidden");
    trigger.setAttribute("aria-expanded", "true");
  };

  const toggle = (e) => {
    e?.stopPropagation?.();
    if (tooltip.classList.contains("hidden")) open();
    else closePrepHeroTooltip();
  };

  trigger.addEventListener("click", toggle);
  trigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(e);
    }
    if (e.key === "Escape") closePrepHeroTooltip();
  });

  document.addEventListener("click", (e) => {
    if (tooltip.classList.contains("hidden")) return;
    if (e.target.closest("#btn-prep-hero-info") || e.target.closest("#prep-hero-tooltip")) return;
    closePrepHeroTooltip();
  });
}

function refreshPrepHeroTooltip() {
  const titleEl = document.getElementById("prep-hero-tooltip-title");
  const descEl = document.getElementById("prep-hero-tooltip-desc");
  const classId = prepViewSide === "player" ? playerClass : enemyClass;
  const side = prepViewSide === "player" ? "player" : "enemy";
  const rt = getSideMutationRuntime(side);
  const companion = typeof getCompanionById === "function" ? getCompanionById(rt.companionId) : null;
  if (titleEl) titleEl.textContent = getRunDisplayTitle(side);
  if (descEl) {
    const cls = getClassById(classId);
    let desc = cls?.desc || "Описание класса недоступно.";
    if (companion) desc += ` · Спутник: ${companion.emoji} ${companion.name}`;
    if (rt.mutationId && typeof getMutationById === "function") {
      desc += ` · Мутация: ${getMutationById(rt.mutationId)?.name || rt.mutationId}`;
    } else if (rt.formId && typeof getMutationById === "function") {
      desc += ` · Форма: ${getMutationById(rt.formId)?.formName || rt.formId}`;
    }
    if (classId === "priest" && typeof countFoodItemsInLoadout === "function") {
      const items = prepViewSide === "player" ? playerItems : enemyItems;
      const foodCount = countFoodItemsInLoadout(items);
      const bonus = cls?.combatBonus || {};
      const pct = Math.round((bonus.maxHpPctPerFood || 0.03) * 100);
      const healPct = Math.round((bonus.foodHealMult || 0.25) * 100);
      desc += ` · Сейчас: ${foodCount} еды → +${foodCount * pct}% HP, еда +${healPct}% хил`;
    }
    descEl.textContent = desc;
  }
}

function closePrepHeroTooltip() {
  document.getElementById("prep-hero-tooltip")?.classList.add("hidden");
  document.getElementById("btn-prep-hero-info")?.setAttribute("aria-expanded", "false");
}

function isRunStatsPopoverOpen() {
  return isPopupOpen("run-stats-popover");
}

function openRunStatsPopover() {
  const popover = document.getElementById("run-stats-popover");
  const btn = document.getElementById("btn-prep-hero-stats");
  if (!popover) return;
  renderRunStats();
  popover.classList.remove("hidden");
  btn?.setAttribute("aria-expanded", "true");
}

function closeRunStatsPopover() {
  const popover = document.getElementById("run-stats-popover");
  const btn = document.getElementById("btn-prep-hero-stats");
  if (!popover) return;
  popover.classList.add("hidden");
  btn?.setAttribute("aria-expanded", "false");
}

function toggleRunStatsPopover() {
  if (isRunStatsPopoverOpen()) closeRunStatsPopover();
  else openRunStatsPopover();
}

function isBattleBuildStatsOpen() {
  return isPopupOpen("battle-build-stats-popover");
}

function openBattleBuildStatsPopover() {
  const popover = document.getElementById("battle-build-stats-popover");
  const btn = document.getElementById("btn-battle-build-stats");
  if (!popover || !btn) return;
  popover.classList.remove("hidden");
  btn.setAttribute("aria-expanded", "true");
}

function closeBattleBuildStatsPopover() {
  const popover = document.getElementById("battle-build-stats-popover");
  const btn = document.getElementById("btn-battle-build-stats");
  if (!popover || !btn) return;
  popover.classList.add("hidden");
  btn.setAttribute("aria-expanded", "false");
}

function toggleBattleBuildStatsPopover() {
  if (isBattleBuildStatsOpen()) closeBattleBuildStatsPopover();
  else openBattleBuildStatsPopover();
}

function bindBattleBuildStatsToggle() {
  const btn = document.getElementById("btn-battle-build-stats");
  const popover = document.getElementById("battle-build-stats-popover");
  const anchor = document.getElementById("battle-build-stats-anchor");
  if (!btn || !popover || !anchor) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleBattleBuildStatsPopover();
  });

  document.addEventListener("click", (e) => {
    if (popover.classList.contains("hidden")) return;
    if (e.target.closest("#battle-build-stats-anchor")) return;
    closeBattleBuildStatsPopover();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || popover.classList.contains("hidden")) return;
    closeBattleBuildStatsPopover();
  });
}

function returnToMainMenu() {
  if (typeof hideEscapeMenu === "function") hideEscapeMenu();
  pendingGameOver = false;
  gameOver = false;
  playerClass = null;
  gameMode = "solo";
  opponentMode = "ai";
  lobbyState = null;
  lobbyViewFighterId = 0;
  lobbyMatches = [];
  lobbySpectateMatchId = 0;
  lobbyRoundSettling = false;
  lastLobbyPlayerBattleWinner = null;
  stopLobbyPrepTimer();
  delete document.documentElement.dataset.lobbySplit;
  delete document.documentElement.dataset.lobby2pHud;
  delete document.documentElement.dataset.lobby2pActiveHuman;
  lastEndedBattleState = null;
  prepViewSide = "player";
  phase = "classSelect";
  dragPayload = null;
  dragFrom = null;
  clearDragUiState();
  closeRunStatsPopover();
  closeBattleBuildStatsPopover();
  closeAllFighterCharacteristicsPopups();
  hideSidebarTooltip();
  hideSynergyTooltip();
  hideBoardPreviewPopup();
  hideBattleResultPopup();
  document.getElementById("overlay")?.classList.add("hidden");

  const finishReturn = () => {
    resetClassSelectOverlay();
    ensureCompanionGrid();
    setPhaseLabel("Выбор класса", false);
    renderPhase();
    renderFightButton();
  };

  const wasInGame = document.body.classList.contains("screen-app-visible");
  if (wasInGame && typeof ScreenTransitions !== "undefined") {
    void ScreenTransitions.crossfadeGameToMenu(finishReturn);
    return;
  }

  document.body.classList.remove("screen-app-visible");
  document.getElementById("class-overlay")?.classList.remove("hidden");
  finishReturn();
}

function showClassSelect() {
  returnToMainMenu();
}

function startRunFromOverlay() {
  if (!pendingPlayerClass) return;
  if (!pendingPlayerCompanionId) return;
  if (typeof ScreenTransitions !== "undefined" && ScreenTransitions.isScreenTransitioning()) return;
  if (!selectedEnemyClass) {
    selectedEnemyClass = pendingPlayerClass === "mage" ? "warrior" : "mage";
  }
  gameMode = selectedGameMode;
  playerClass = pendingPlayerClass;
  playerCompanionId = pendingPlayerCompanionId;
  enemyCompanionId = typeof defaultCompanionForClass === "function"
    ? defaultCompanionForClass(selectedEnemyClass || pendingPlayerClass)
    : "s_stranger";
  playerMutationFormId = null;
  playerMutationId = null;
  enemyMutationFormId = null;
  enemyMutationId = null;
  opponentMode = selectedGameMode === "versus"
    ? "manual"
    : selectedGameMode === "hardbot"
      ? "hardbot"
      : selectedGameMode === "lobby"
        ? "ghost"
        : selectedGameMode === "lobby2p"
          ? "ghost2p"
          : selectedGameMode === "campaign"
              ? "campaign"
              : "ai";
  enemyClass = selectedEnemyClass || pendingPlayerClass;
  enemyArchetype = AI_ARCHETYPES[enemyClass] || AI_ARCHETYPES.warrior;
  prepViewSide = "player";
  if (selectedGameMode === "campaign" && typeof Campaign !== "undefined") {
    Campaign.startTrial(selectedCampaignTrial);
  }
  dismissClassOverlayTooltip();
  hideClassSummaryTooltip();
  const overlay = document.getElementById("class-overlay");
  overlay?.classList.remove("class-overlay--summary");
  const app = document.getElementById("app");
  if (app) app.dataset.gameMode = gameMode;
  document.documentElement.dataset.gameMode = gameMode;

  const beginRun = () => {
    restartGame();
  };

  if (typeof ScreenTransitions !== "undefined") {
    void ScreenTransitions.crossfadeMenuToGame(beginRun);
    return;
  }

  overlay?.classList.add("hidden");
  overlay?.setAttribute("aria-hidden", "true");
  document.body.classList.add("screen-app-visible");
  if (app) {
    app.style.removeProperty("visibility");
    app.style.removeProperty("pointer-events");
  }
  beginRun();
}

function startRun(classId) {
  playerClass = classId;
  dismissClassOverlayTooltip();
  document.getElementById("class-overlay").classList.add("hidden");
  restartGame();
}

function restartGame() {
  if (!playerClass) {
    showClassSelect();
    return;
  }
  if (!playerCompanionId) {
    playerCompanionId = typeof defaultCompanionForClass === "function"
      ? defaultCompanionForClass(playerClass)
      : "s_stranger";
  }
  if (!enemyCompanionId) {
    enemyCompanionId = typeof defaultCompanionForClass === "function"
      ? defaultCompanionForClass(enemyClass || playerClass)
      : "s_stranger";
  }
  playerMutationFormId = null;
  playerMutationId = null;
  enemyMutationFormId = null;
  enemyMutationId = null;
  playerEnhancements = typeof createEmptyEnhancementLoadout === "function"
    ? createEmptyEnhancementLoadout()
    : { head: null, chest: null, boots: null };
  enemyEnhancements = typeof createEmptyEnhancementLoadout === "function"
    ? createEmptyEnhancementLoadout()
    : { head: null, chest: null, boots: null };
  phase = "prep";
  round = 1;
  gold = START_GOLD;
  playerPendingShopBuffs = 0;
  playerBonusUniqueGranted = false;
  enemyPendingShopBuffs = 0;
  enemyBonusUniqueGranted = false;
  goldSpentTotal = 0;
  goldEarnedTotal = 0;
  recentBattleResults = [];
  runResults = [];
  runItemStats = createEmptyRunItemStats();
  bench = [];
  shop = Array(MAX_SHOP).fill(null);
  playerContainers = createStartingContainers();
  playerItems = applyClassStarters(playerContainers, [], playerClass);
  if (typeof getStartingValueBonus === "function") {
    gold += getStartingValueBonus(playerItems);
  }
  enemyGold = START_GOLD;
  enemyBench = [];
  if (opponentMode === "hardbot") {
    const enemyState = createInitialHardBotState(
      round,
      GRID_COLS,
      GRID_ROWS,
      playerContainers,
      playerItems,
      playerClass,
      enemyClass,
    );
    enemyArchetype = enemyState.archetype;
    enemyClass = enemyState.classId;
    enemyGold = enemyState.gold;
    enemyContainers = enemyState.containers;
    enemyItems = enemyState.items;
    enemyBench = enemyState.bench || [];
    enemyShop = Array(MAX_SHOP).fill(null);
    enemyShopFrozen = Array(MAX_SHOP).fill(false);
    enemyShopReadyForRound = 0;
  } else if (opponentMode === "ai") {
    const enemyState = createInitialEnemyState(round, GRID_COLS, GRID_ROWS, playerItems, playerClass);
    enemyArchetype = enemyState.archetype;
    enemyClass = enemyState.classId;
    enemyGold = enemyState.gold;
    enemyContainers = enemyState.containers;
    enemyItems = enemyState.items;
    enemyBench = enemyState.bench;
    enemyShop = Array(MAX_SHOP).fill(null);
    enemyShopFrozen = Array(MAX_SHOP).fill(false);
    enemyShopReadyForRound = 0;
  } else if (opponentMode === "ghost") {
    lobbyState = null;
    initLobbyRun();
  } else if (opponentMode === "ghost2p") {
    lobbyState = null;
    initLobby2pRun();
  } else if (opponentMode === "campaign") {
    const enemyState = typeof Campaign !== "undefined" ? Campaign.createEnemyPrep() : null;
    enemyArchetype = enemyState?.archetype || AI_ARCHETYPES.warrior;
    enemyClass = enemyState?.classId || "warrior";
    enemyGold = enemyState?.gold ?? 0;
    enemyContainers = enemyState?.containers || createStartingContainers();
    enemyItems = enemyState?.items || [];
    enemyBench = enemyState?.bench || [];
    enemyShop = Array(MAX_SHOP).fill(null);
    enemyShopFrozen = Array(MAX_SHOP).fill(false);
    enemyShopReadyForRound = 0;
  } else {
    initManualEnemyState();
  }
  prepViewSide = "player";
  battleState = null;
  clearBattleFloatLayer();
  replayPlayback = null;
  lastBattleReplay = null;
  battleEndHandled = false;
  gameOver = false;
  dragPayload = null;
  dragFrom = null;
  tooltipItem = null;
  lastRoundStats = null;
  pendingGameOver = false;
  shopFrozen = Array(MAX_SHOP).fill(false);
  shopReadyForRound = 0;
  document.getElementById("app")?.setAttribute("data-prep-side", "player");
  document.getElementById("battle-result-overlay")?.classList.add("hidden");
  document.getElementById("overlay").classList.add("hidden");
  hideBoardPreviewPopup();
  renderPhase();
  updatePrepSideUI();
  if (isCampaignMode() && typeof Campaign !== "undefined") {
    Campaign.startTrial(selectedCampaignTrial);
    Campaign.applyPrepStep();
    syncCampaignChrome();
  } else {
    resetShopForNewRound();
  }
  renderShop();
  renderBench();
  recalcSynergies();
  updateUI();
  renderRunStats();
  renderFightButton();
  setPhaseLabel(isCampaignMode() ? "Обучение" : "Подготовка", false);
  requestAnimationFrame(() => {
    if (isCampaignMode()) {
      syncCampaignChrome();
    } else {
      ensureShopReadyForSide("player");
      if (isEnemyPrepEditable()) ensureShopReadyForSide("enemy");
    }
    renderShop();
    renderBench();
    updatePrepSideUI();
    if (typeof applyUiLayout === "function") applyUiLayout();
  });
  log(isVersusMode()
    ? "Режим противостояния: Tab или кнопки — переключить магазин между игроками."
    : isLobbyMode()
      ? `Лобби: ${LOBBY_FIGHTER_COUNT} бойцов, ${LOBBY_START_HP} HP. 🏆 внизу — список участников. Таймер ${LOBBY_PREP_SECONDS}с.`
      : isCampaignMode()
          ? `Кампания: ${Campaign.getTrial()?.title || "испытание"} · ${Campaign.getProgressLabel()}`
          : isHardBotMode()
          ? "Сложный бот: каждый раунд подбирает лучшую экипировку. Расставьте предметы и в бой!"
          : "Расставьте предметы и в бой! Tab — посмотреть билд бота.");
}

function isPopupOpen(id) {
  const el = document.getElementById(id);
  return !!(el && !el.classList.contains("hidden"));
}

/** Итоги боя: phase=battle, симуляция остановлена, overlay открыт. */
function isBattleResultIdle() {
  return phase === "battle"
    && !battleState
    && isPopupOpen("battle-result-overlay");
}

/** Intro не должен оставаться поверх живого забега (PWA / resize). */
function syncClassOverlayHiddenDuringGame() {
  const overlay = document.getElementById("class-overlay");
  if (!overlay || !document.body.classList.contains("screen-app-visible")) return;
  if (overlay.classList.contains("overlay-exiting")) return;
  if (overlay.classList.contains("hidden")) return;
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  overlay.classList.remove("overlay-entering");
}

function closeNestedPopups() {
  let closed = false;

  if (typeof hideDetailPopup === "function" && isDetailPopupOpen()) {
    hideDetailPopup();
    return true;
  }

  if (isBoardPreviewOpen()) {
    hideBoardPreviewPopup();
    closed = true;
  }
  if (isRunStatsPopoverOpen()) {
    closeRunStatsPopover();
    closed = true;
  }
  if (isBattleBuildStatsOpen()) {
    closeBattleBuildStatsPopover();
    closed = true;
  }
  if (isPopupOpen("overlay")) {
    if (gameOver) returnToMainMenu();
    else document.getElementById("overlay")?.classList.add("hidden");
    closed = true;
  }

  const tooltip = document.getElementById("sidebar-tooltip");
  if (tooltip && !tooltip.classList.contains("hidden")) {
    hideSidebarTooltip();
    closed = true;
  }

  if (isFighterCharacteristicsOpen("player") || isFighterCharacteristicsOpen("enemy")) {
    closeAllFighterCharacteristicsPopups();
    closed = true;
  }

  if (isRecipeBookOpen()) {
    hideRecipeBookPopup();
    closed = true;
  }

  if (typeof isSettingsOpen === "function" && isSettingsOpen()) {
    hideSettingsPopup();
    closed = true;
  }

  if (isBattleInventoryPopoverOpen()) {
    closeBattleInventoryPopover();
    closed = true;
  }

  if (typeof window.isPrepBenchPopoverOpen === "function" && window.isPrepBenchPopoverOpen()) {
    window.closePrepBenchPopover?.();
    closed = true;
  }

  if (typeof window.isPrepShopPopoverOpen === "function" && window.isPrepShopPopoverOpen()) {
    window.closePrepShopPopover?.();
    closed = true;
  }

  return closed;
}

function closeAllPopups() {
  return typeof handleEscapeKey === "function" ? handleEscapeKey() : closeNestedPopups();
}

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function isPhaseTransitioning() {
  if (typeof ScreenTransitions !== "undefined" && ScreenTransitions.isScreenTransitioning()) return true;
  return document.querySelector(".game-layout")?.classList.contains("phase-transitioning");
}

function handleEnterHotkey(e) {
  if (e.key !== "Enter" || isPhaseTransitioning()) return false;
  if (isPopupOpen("class-overlay")) {
    const summaryStepOpen = !document.getElementById("class-step-summary")?.classList.contains("hidden");
    if (summaryStepOpen && pendingPlayerClass && pendingPlayerCompanionId) {
      const startBtn = document.getElementById("btn-start-run");
      if (startBtn && !startBtn.disabled) {
        startRunFromOverlay();
        e.preventDefault();
        return true;
      }
    }
    return false;
  }
  if (isBoardPreviewOpen()) {
    return false;
  }

  if (isPopupOpen("overlay") && gameOver) {
    returnToMainMenu();
    e.preventDefault();
    return true;
  }

  if (isPopupOpen("overlay")) {
    return false;
  }

  if (typeof isDetailPopupOpen === "function" && isDetailPopupOpen()) {
    return false;
  }

  if (isPopupOpen("battle-result-overlay")) {
    const btn = document.getElementById("btn-battle-continue");
    if (btn && !btn.disabled) {
      btn.click();
      e.preventDefault();
      return true;
    }
    return false;
  }

  if (phase === "battle" && battleState && !battleState.finished) {
    skipBattle();
    e.preventDefault();
    return true;
  }

  if (phase === "prep" && canStartBattle()) {
    startBattle();
    e.preventDefault();
    return true;
  }

  return false;
}

function prepKeyboardBlocked() {
  return isBoardPreviewOpen()
    || isRecipeBookOpen()
    || isPopupOpen("class-overlay")
    || isPopupOpen("overlay")
    || isPopupOpen("battle-result-overlay")
    || (typeof isDetailPopupOpen === "function" && isDetailPopupOpen());
}

function togglePrepShopKeyboard() {
  if (typeof window.toggleMobilePrepShop === "function") {
    window.toggleMobilePrepShop();
    return;
  }
  if (typeof window.togglePrepShopPopover === "function") {
    window.togglePrepShopPopover();
  }
}

function handleDesktopPrepShopHotkey(e) {
  if (e.key !== "b" && e.key !== "B") return false;
  if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return false;
  if (isTouchUi()) return false;
  if (phase !== "prep" || gameOver || isPhaseTransitioning()) return false;
  if (prepKeyboardBlocked()) return false;
  togglePrepShopKeyboard();
  e.preventDefault();
  return true;
}

function handleDesktopPrepRefreshHotkey(e) {
  if (e.key !== "r" && e.key !== "R" && e.key !== "к" && e.key !== "К") return false;
  if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return false;
  if (isTouchUi()) return false;
  if (phase !== "prep" || gameOver || isPhaseTransitioning()) return false;
  if (dragPayload) return false;
  if (prepKeyboardBlocked()) return false;
  if (typeof refreshShop === "function") refreshShop(true);
  e.preventDefault();
  return true;
}

function handleRecipeBookHotkey(e) {
  if (e.key !== "b" && e.key !== "B") return false;
  if (isPhaseTransitioning()) return false;
  if (!isTouchUi() && phase === "prep" && !gameOver && !e.shiftKey) return false;
  if (!isTouchUi() && phase === "prep" && !gameOver && e.shiftKey && prepKeyboardBlocked() && !isRecipeBookOpen()) {
    return false;
  }
  toggleRecipeBookPopup();
  e.preventDefault();
  return true;
}

function handlePrepTooltipsHotkey(e) {
  if (e.key !== "t" && e.key !== "T" && e.key !== "е" && e.key !== "Е") return false;
  if (phase !== "prep" || gameOver || isPhaseTransitioning()) return false;
  if (
    isBoardPreviewOpen()
    || isRecipeBookOpen()
    || isPopupOpen("class-overlay")
    || isPopupOpen("overlay")
    || isPopupOpen("battle-result-overlay")
  ) {
    return false;
  }
  togglePrepTooltips();
  e.preventDefault();
  return true;
}

function togglePrepTooltips() {
  prepTooltipsEnabled = !prepTooltipsEnabled;
  document.documentElement.dataset.prepTooltips = prepTooltipsEnabled ? "on" : "off";
  document.documentElement.dataset.gamepadHud = prepTooltipsEnabled ? "auto" : "hidden";
  if (!prepTooltipsEnabled) hideSidebarTooltip();
  else if (lastGamepadPrepFocus) applyGamepadPrepFocusTooltip(lastGamepadPrepFocus);
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}

function applyGamepadPrepFocusTooltip(focus) {
  if (!prepTooltipsEnabled || phase !== "prep" || dragPayload) {
    if (!prepTooltipsEnabled || dragPayload) hideSidebarTooltip();
    return;
  }
  if (!focus) {
    hideSidebarTooltip();
    return;
  }
  if (focus.zone === "shop") {
    const card = document.querySelectorAll("#shop-slots .shop-card")[focus.index];
    if (!card || card.classList.contains("empty") || !card.dataset.itemId) {
      hideSidebarTooltip();
      return;
    }
    const c = getElementClientCenter(card);
    if (c) showSidebarTooltipAt(c.x, c.y, card.dataset.itemId, null, "shop", card);
    return;
  }
  if (focus.zone === "bench") {
    const card = document.querySelectorAll("#bench-slots .bench-card")[focus.index];
    const st = getSideState(prepViewSide);
    const idx = +card?.dataset?.bench;
    const entry = Number.isFinite(idx) ? st.bench[idx] : null;
    if (!card || card.classList.contains("empty") || !entry) {
      hideSidebarTooltip();
      return;
    }
    const c = getElementClientCenter(card);
    if (c) showSidebarTooltipAt(c.x, c.y, entry.itemId, entry, "bench", card);
    return;
  }
  if (focus.zone === "board" && gamepadBoardFocus) {
    const st = getSideState(prepViewSide);
    const { col, row } = gamepadBoardFocus;
    const item = findItemAtSlot(st.items, col, row);
    if (item) {
      const { x, y } = boardCellClientCenter(col, row);
      showSidebarTooltipAt(x, y, item.itemId, item, "field");
      return;
    }
    const container = findContainerAtCell(st.containers, col, row);
    if (container) {
      const { x, y } = boardCellClientCenter(col, row);
      showSidebarTooltipAt(x, y, container.itemId, null, "field");
      return;
    }
    hideSidebarTooltip();
  }
}

function getLoadoutGoldPerRoundBonus(items) {
  let bonus = 0;
  (items || []).forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    if (def?.goldPerRound > 0) bonus += def.goldPerRound;
  });
  return bonus;
}

function sellBoardFocusItem() {
  if (phase !== "prep" || !canEditPrepSide() || !gamepadBoardFocus) return false;
  const st = getSideState(prepViewSide);
  const { col, row } = gamepadBoardFocus;
  const item = findItemAtSlot(st.items, col, row);
  if (item) {
    creditItemSale(item.itemId, prepViewSide);
    st.items = st.items.filter((i) => i.uid !== item.uid);
    synergyPreviewBuilt = null;
    recalcSynergies();
    updateUI();
    if (lastGamepadPrepFocus) applyGamepadPrepFocusTooltip(lastGamepadPrepFocus);
    return true;
  }
  const container = findContainerAtCell(st.containers, col, row);
  if (!container || ITEM_CATALOG[container.itemId]?.immovable) return false;
  const carriedItems = getItemsTouchingContainer(st.items, container);
  creditItemSale(container.itemId, prepViewSide);
  carriedItems.forEach((ci) => creditItemSale(ci.itemId, prepViewSide));
  st.containers = st.containers.filter((c) => c.uid !== container.uid);
  st.items = st.items.filter((i) => !carriedItems.some((c) => c.uid === i.uid));
  synergyPreviewBuilt = null;
  recalcSynergies();
  updateUI();
  if (lastGamepadPrepFocus) applyGamepadPrepFocusTooltip(lastGamepadPrepFocus);
  return true;
}

function sellBenchFocusItem(index) {
  if (phase !== "prep" || !canEditPrepSide()) return false;
  if (!sellBenchEntry(index)) return false;
  renderBench();
  recalcSynergies();
  updateUI();
  return true;
}

function sellDraggedItem(side = prepViewSide) {
  if (!dragFrom || !dragPayload) return false;
  if (dragFrom.type === "shop") return false;

  if (dragFrom.type === "bench") {
    if (dragFrom.benchEntry) {
      creditItemSale(dragFrom.benchEntry.itemId, side);
      (dragFrom.benchEntry.carriedItems || []).forEach((ci) => creditItemSale(ci.itemId, side));
      commitBenchDragEntry(dragFrom);
      return true;
    }
    return sellBenchEntry(dragFrom.index, side);
  }
  if (dragFrom.type === "item" || dragFrom.type === "enhancement") {
    creditItemSale(dragFrom.item.itemId, side);
    return true;
  }
  if (dragFrom.type === "container") {
    creditItemSale(dragFrom.container.itemId, side);
    (dragFrom.carriedItems || []).forEach((ci) => creditItemSale(ci.itemId, side));
    return true;
  }
  return false;
}

function sellDraggedItemQuick(side = prepViewSide) {
  if (!sellDraggedItem(side)) return false;
  clearDragUiState();
  renderBench();
  recalcSynergies();
  updateUI();
  return true;
}

function dropDraggedItemToBench() {
  if (!dragPayload) return;
  const benchPanel = document.getElementById("bench-panel");
  if (!benchPanel) return;
  const r = benchPanel.getBoundingClientRect();
  finishDragDrop(createSyntheticPointerEvent(r.left + r.width / 2, r.top + r.height / 2));
}

function onGamepadPrepFocusChanged(focus) {
  lastGamepadPrepFocus = focus;
  applyGamepadPrepFocusTooltip(focus);
}

function handleCharacteristicsHotkey(e) {
  if (e.key !== "h" && e.key !== "H") return false;
  if (phase !== "prep" || gameOver || isPhaseTransitioning()) return false;
  if (
    isBoardPreviewOpen()
    || isRecipeBookOpen()
    || isPopupOpen("class-overlay")
    || isPopupOpen("overlay")
    || isPopupOpen("battle-result-overlay")
  ) {
    return false;
  }
  togglePlayerCharacteristicsPopup(getPlayerCharacteristicsState());
  e.preventDefault();
  return true;
}

function handleGlobalKeydown(e) {
  if (isTypingTarget(e.target)) return;

  if (e.key === "Escape") {
    if (typeof handleEscapeKey === "function" ? handleEscapeKey() : closeNestedPopups()) {
      e.preventDefault();
    }
    return;
  }

  if (e.key === "Enter") {
    if (handleEnterHotkey(e)) return;
  }

  if (handleDesktopPrepShopHotkey(e)) return;

  if (handleRecipeBookHotkey(e)) return;

  if (handleCharacteristicsHotkey(e)) return;

  if (handlePrepTooltipsHotkey(e)) return;

  if (handleDesktopPrepRefreshHotkey(e)) return;

  if (e.key === "r" || e.key === "R" || e.key === "к" || e.key === "К") {
    if (dragPayload && isLoadoutInteractionPhase()) rotateDragItem();
  }

  if (e.key === "Tab" && phase === "prep" && !gameOver && !isPhaseTransitioning()) {
    if (
      isBoardPreviewOpen()
      || isPopupOpen("class-overlay")
      || isPopupOpen("overlay")
      || isPopupOpen("battle-result-overlay")
    ) {
      return;
    }
    e.preventDefault();
    if (isAnyLobbyMode() && lobbyState) {
      setLobbyViewFighter(cycleLobbyViewFighterId(
        lobbyState,
        lobbyViewFighterId,
        e.shiftKey ? -1 : 1,
      ));
      return;
    }
    setPrepViewSide(prepViewSide === "player" ? "enemy" : "player");
  }

  if (e.key === "Tab" && isBattleUiPhase() && isLobbyMode() && lobbyMatches.length && !isPhaseTransitioning()) {
    e.preventDefault();
    const playable = lobbyMatches
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.state && !m.byeFighterId);
    if (playable.length < 2) return;
    const pos = playable.findIndex(({ i }) => i === lobbySpectateMatchId);
    const next = playable[(pos + (e.shiftKey ? -1 : 1) + playable.length) % playable.length];
    setLobbySpectateMatch(next.i);
  }
}

function takeBenchEntryOnDragStart(st, index) {
  const entry = st.bench[index];
  if (!entry) return null;
  st.bench.splice(index, 1);
  if (selectedBench === index) selectedBench = -1;
  else if (selectedBench > index) selectedBench -= 1;
  return { ...entry };
}

function restoreBenchDragEntry(st, dragFrom) {
  if (dragFrom?.type !== "bench" || !dragFrom.benchEntry) return;
  if (st.bench.length >= MAX_BENCH) return;
  const idx = Math.min(Math.max(0, dragFrom.index ?? st.bench.length), st.bench.length);
  st.bench.splice(idx, 0, dragFrom.benchEntry);
  dragFrom.benchEntry = null;
}

function commitBenchDragEntry(dragFrom) {
  if (dragFrom?.type === "bench") dragFrom.benchEntry = null;
}

function restoreDraggedItem(side = prepViewSide) {
  if (!dragFrom) return;
  const st = getLoadoutEditState(side);
  if (dragFrom.type === "item" || dragFrom.type === "enhancement") {
    st.items = [...st.items, dragFrom.item];
  } else if (dragFrom.type === "container") {
    st.containers = [...st.containers, dragFrom.container];
    st.items = [...st.items, ...dragFrom.carriedItems];
  } else if (dragFrom.type === "bench") {
    restoreBenchDragEntry(st, dragFrom);
  }
}

function canPrepSellDragHighlight() {
  return !!(phase === "prep" && dragPayload && dragFrom?.type !== "shop");
}

function syncSellDropHighlight(clientX, clientY) {
  const sellable = canPrepSellDragHighlight();
  document.documentElement.toggleAttribute("data-prep-sell-drag", sellable);

  const synthetic = sellable && clientX != null && clientY != null
    ? createSyntheticPointerEvent(clientX, clientY)
    : null;
  const onSell = !!(sellable && synthetic && isDropOnSell(synthetic));
  const dragSide = dragFrom?.side || prepViewSide;

  const sellZone = document.getElementById("shop-sell-zone");
  if (sellZone && !isPrepSellFabActive()) {
    sellZone.classList.toggle("sell-drop-target", onSell);
    sellZone.classList.toggle("is-drag-active", sellable);
  } else if (sellZone) {
    sellZone.classList.remove("sell-drop-target", "is-drag-active");
  }

  document.querySelectorAll(".sell-drop-zone").forEach((el) => {
    let zoneActive = onSell;
    let zoneSellable = sellable;
    if (el.classList.contains("lobby2p-sell-zone")) {
      const side = Number(el.dataset.human) === 0 ? "player" : "enemy";
      zoneSellable = sellable && side === dragSide;
      zoneActive = onSell && side === dragSide;
    }
    el.classList.toggle("is-drag-active", zoneSellable);
    el.classList.toggle("is-drag-target", zoneActive);
  });
}

function clearSellDropHighlight() {
  document.documentElement.removeAttribute("data-prep-sell-drag");
  document.getElementById("shop-sell-zone")?.classList.remove("sell-drop-target", "is-drag-active");
  document.querySelectorAll(".sell-drop-zone").forEach((el) => {
    el.classList.remove("is-drag-target", "is-drag-active");
  });
}

function syncPrepBenchPopoverPassthrough() {
  const benchUi = typeof usesPrepBenchPopover === "function" && usesPrepBenchPopover();
  const shopUi = typeof window.usesPrepShopPopover === "function" && window.usesPrepShopPopover();
  const benchOpen = typeof isPrepBenchPopoverOpen === "function" && isPrepBenchPopoverOpen();
  const shopOpen = typeof window.isPrepShopPopoverOpen === "function" && window.isPrepShopPopoverOpen();
  const dragging = !!(dragPayload || pendingShopDrag || pendingBenchDrag || pendingEnhancementDrag);
  document.documentElement.toggleAttribute("data-prep-bench-drag", !!(benchUi && benchOpen && dragging));
  document.documentElement.toggleAttribute("data-prep-shop-drag", !!(shopUi && shopOpen && dragging));
}

function syncUiDragState() {
  const dragging = !!(dragPayload || pendingShopDrag || pendingBenchDrag || pendingEnhancementDrag);
  document.body.classList.toggle("is-ui-dragging", dragging);
  if (dragging) {
    tooltipItem = null;
    hideSidebarTooltip();
  } else {
    window.flushDeferredLayoutPasses?.();
  }
  syncPrepBenchPopoverPassthrough();
  syncPrepShopDragBackdrop(lastPointerClient.x, lastPointerClient.y);
  syncSellDropHighlight(lastPointerClient.x, lastPointerClient.y);
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}

function applyCraftingForSide(side = prepViewSide) {
  const st = getSideState(side);
  const craftCtx = typeof getCraftContextFromGame === "function" ? getCraftContextFromGame(side) : {};
  const result = tryResolveCrafting(st.containers, st.items, craftCtx);
  if (!result.crafted.length) return false;
  st.items = result.items;
  playPrepSfx("prep_craft");
  result.crafted.forEach((recipe) => {
    const out = ITEM_CATALOG[recipe.output];
    if (out) {
      log(`⚗️ Крафт: ${out.icon} ${out.name}`);
      if (side === prepViewSide && typeof CombatLog !== "undefined") {
        CombatLog.notifyCraft(out);
      }
    }
  });
  return true;
}

function notifyPrepDragRejectedFromDragFrom() {
  if ((dragFrom?.type === "item" || dragFrom?.type === "enhancement") && dragFrom.item) {
    notifyPrepPlacementRejected(dragFrom.item);
    return;
  }
  if (dragPayload?.itemId && typeof getEnhancementPlacementBlockReason === "function") {
    const side = dragFrom?.side || prepViewSide;
    const st = getSideState(side);
    const excludeUid = (dragFrom?.type === "item" || dragFrom?.type === "enhancement")
      ? dragFrom.item?.uid
      : null;
    const reason = getEnhancementPlacementBlockReason(dragPayload.itemId, st.items, excludeUid);
    if (reason) log(reason);
  }
}

function isPrepBackpackArcDrag() {
  return dragFrom?.type === "item" || dragFrom?.type === "container";
}

function isPrepEnhancementStripDrag() {
  return dragFrom?.type === "enhancement";
}

function isPrepLoadoutItemDrag() {
  return dragFrom?.type === "item" || dragFrom?.type === "enhancement";
}

function isPrepArcDragSource() {
  if (!dragFrom) return false;
  return dragFrom.type === "shop"
    || dragFrom.type === "bench"
    || dragFrom.type === "enhancement"
    || dragFrom.type === "item"
    || dragFrom.type === "container";
}

function resolveContainerPlacementAtCursor(st, cursorCol, cursorRow, preferredRot = null, exactOnly = false) {
  if (!dragPayload || !isContainerItem(dragPayload.itemId)) return null;
  const excludeUid = dragFrom?.type === "container" ? dragFrom.container?.uid : null;
  const other = findContainerAtCell(st.containers, cursorCol, cursorRow);
  if (other && other.uid !== excludeUid) return null;

  const itemId = dragPayload.itemId;
  const startRot = preferredRot != null
    ? ((preferredRot % 4) + 4) % 4
    : ((dragPayload.rotation || 0) % 4 + 4) % 4;
  const rotations = exactOnly
    ? [startRot]
    : (() => {
      const order = [startRot];
      for (let r = 0; r < 4; r++) if (r !== startRot) order.push(r);
      return order;
    })();

  for (const rot of rotations) {
    const shape = rotateShape(ITEM_CATALOG[itemId].shape, rot);
    for (const [dx, dy] of shape) {
      const anchorCol = cursorCol - dx;
      const anchorRow = cursorRow - dy;
      const ok = dragFrom?.type === "container"
        ? canMoveContainerWithItems(
          dragFrom.container,
          anchorCol,
          anchorRow,
          st.containers,
          st.items,
          excludeUid,
          getActiveGridCols(),
          getActiveGridRows(),
        )
        : canPlaceContainer(
          itemId,
          anchorCol,
          anchorRow,
          rot,
          getActiveGridCols(),
          getActiveGridRows(),
          st.containers,
          excludeUid,
          st.items,
        );
      if (ok) return { col: anchorCol, row: anchorRow, rotation: rot };
    }
  }
  return null;
}

function isPrepArcPlaceableCell(col, row) {
  if (!isLoadoutInteractionPhase() || !dragPayload) return false;
  const side = dragFrom?.side || prepViewSide;
  if (!canEditPrepSide(side)) return false;
  const st = getLoadoutEditState(side);

  if (isContainerItem(dragPayload.itemId)) {
    return !!resolveContainerPlacementAtCursor(st, col, row);
  }

  if (!isSlotCell(st.containers, col, row)) return false;
  const excludeUid = isPrepLoadoutItemDrag() ? dragFrom.item?.uid : null;
  const placement = resolveLoadoutPlacementDisplacing(
    st.containers,
    dragPayload.itemId,
    col,
    row,
    dragPayload.rotation || 0,
  );
  if (!placement.valid) return false;
  const displaced = getOverlappingLoadoutItems(
    st.items,
    dragPayload.itemId,
    placement.col,
    placement.row,
    placement.rotation,
    excludeUid,
  );
  const displacedUids = displaced.map((item) => item.uid);
  const slotOk = typeof canAddSlotItemToLoadout !== "function"
    || canAddSlotItemToLoadout(st.items, dragPayload.itemId, excludeUid, displacedUids);
  const benchOk = st.bench.length + displaced.length <= MAX_BENCH;
  return slotOk && benchOk;
}

function maybePrepArcHoverSound(col, row) {
  if (typeof PrepDragArc === "undefined" || !PrepDragArc.isActive()) return;
  if (col == null || row == null || !isPrepArcPlaceableCell(col, row)) {
    PrepDragArc.syncHoverCell(null, null);
    return;
  }
  const kind = isContainerItem(dragPayload?.itemId) ? "c" : "s";
  PrepDragArc.syncHoverCell(col, row, kind);
}

function applyPrepBoardHoverFromCanvasXY(mx, my, side, st) {
  if (!isOnBoard(mx, my, side)) return false;
  const col = xToCol(mx, side);
  const row = yToRow(my, side);
  prepDropPreviewHover = { col, row };
  if (isContainerItem(dragPayload.itemId)) {
    hoverCell = { col, row };
    hoverSlot = null;
    return true;
  }
  if (isSlotCell(st.containers, col, row)) {
    hoverSlot = { col, row };
    hoverCell = null;
    return true;
  }
  const placement = resolveLoadoutPlacementDisplacing(
    st.containers,
    dragPayload.itemId,
    col,
    row,
    dragPayload.rotation || 0,
  );
  if (placement.valid) {
    hoverSlot = { col, row };
    hoverCell = null;
    return true;
  }
  hoverCell = { col, row };
  hoverSlot = null;
  return true;
}

function prepCellCanvasCenter(col, row, team = prepViewSide) {
  const rect = cellRect(team, col, row);
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function findNearestPrepPlaceableHover(mx, my, side, st) {
  if (!dragPayload || !st) return null;
  const team = prepViewSide;
  let best = null;
  let bestDist = Infinity;

  const consider = (col, row) => {
    const maxCols = getActiveGridCols();
    const maxRows = getActiveGridRows();
    if (col < 0 || col >= maxCols || row < 0 || row >= maxRows) return;
    if (!isPrepArcPlaceableCell(col, row)) return;
    const center = prepCellCanvasCenter(col, row, team);
    const dist = Math.hypot(center.x - mx, center.y - my);
    if (dist < bestDist) {
      bestDist = dist;
      best = { col, row };
    }
  };

  if (isContainerItem(dragPayload.itemId)) {
    for (let row = 0; row < getActiveGridRows(); row += 1) {
      for (let col = 0; col < getActiveGridCols(); col += 1) {
        consider(col, row);
      }
    }
  } else {
    buildSlotSet(st.containers).forEach((key) => {
      const [col, row] = key.split(",").map(Number);
      consider(col, row);
    });
  }

  return best;
}

function findNearestPrepSlotHover(mx, my, side, st) {
  if (!dragPayload || !st) return null;
  const team = prepViewSide;
  let best = null;
  let bestDist = Infinity;

  const consider = (col, row) => {
    const maxCols = getActiveGridCols();
    const maxRows = getActiveGridRows();
    if (col < 0 || col >= maxCols || row < 0 || row >= maxRows) return;
    const center = prepCellCanvasCenter(col, row, team);
    const dist = Math.hypot(center.x - mx, center.y - my);
    if (dist < bestDist) {
      bestDist = dist;
      best = { col, row };
    }
  };

  if (isContainerItem(dragPayload.itemId)) {
    for (let row = 0; row < getActiveGridRows(); row += 1) {
      for (let col = 0; col < getActiveGridCols(); col += 1) {
        consider(col, row);
      }
    }
  } else {
    buildSlotSet(st.containers).forEach((key) => {
      const [col, row] = key.split(",").map(Number);
      consider(col, row);
    });
  }

  return best;
}

function applyPrepBoardHoverFromNearestPlaceable(mx, my, side, st) {
  const nearest = findNearestPrepPlaceableHover(mx, my, side, st);
  if (nearest) {
    const { col, row } = nearest;
    prepDropPreviewHover = { col, row };
    if (isContainerItem(dragPayload.itemId)) {
      hoverCell = { col, row };
      hoverSlot = null;
    } else {
      hoverSlot = { col, row };
      hoverCell = null;
    }
    return true;
  }

  const fallback = findNearestPrepSlotHover(mx, my, side, st);
  if (!fallback) return false;
  const center = prepCellCanvasCenter(fallback.col, fallback.row, prepViewSide);
  return applyPrepBoardHoverFromCanvasXY(center.x, center.y, side, st);
}

function isPrepSidebarArcDrag() {
  return dragFrom?.type === "shop"
    || dragFrom?.type === "bench"
    || dragFrom?.type === "enhancement";
}

function shouldDrawPrepGridFigurePreview() {
  if (!isPrepSidebarArcDrag()) return true;
  if (hoverSlot || hoverCell || prepDropPreviewHover) return true;
  const st = typeof getSideState === "function" ? getSideState(prepViewSide) : null;
  return !!(st && typeof getPrepDropPlacement === "function" && getPrepDropPlacement(st, prepViewSide));
}

function getPrepBackpackClientRect() {
  const team = prepViewSide;
  let ox;
  let oy;
  let innerW;
  let innerH;
  ox = gridOrigin(team);
  oy = layoutBackpackY();
  innerW = GRID_INNER_W;
  innerH = GRID_INNER_H;
  const tl = canvasPointToClient(ox, oy);
  const br = canvasPointToClient(ox + innerW, oy + innerH);
  if (!tl || !br) return null;
  return {
    left: Math.min(tl.x, br.x),
    top: Math.min(tl.y, br.y),
    right: Math.max(tl.x, br.x),
    bottom: Math.max(tl.y, br.y),
  };
}

function getShopDrawerRect() {
  const panel = document.getElementById("shop-panel");
  if (!panel) return null;
  if (typeof window.usesPrepShopPopover === "function" && window.usesPrepShopPopover()) {
    if (typeof window.isPrepShopPopoverOpen === "function" && !window.isPrepShopPopoverOpen()) {
      return null;
    }
  }
  const r = panel.getBoundingClientRect();
  if (!r || r.width < 1 || r.height < 1) return null;
  return r;
}

function usesPrepCommercePopoverMode() {
  return (typeof usesPrepBenchPopover === "function" && usesPrepBenchPopover())
    || (typeof window.usesPrepShopPopover === "function" && window.usesPrepShopPopover());
}

function isPointerInsideShopDrawerBounds(clientX, clientY) {
  if (clientX == null || clientY == null) return false;
  const r = getShopDrawerRect();
  if (!r) return false;
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
}

/** Доля ширины клетки — порог перехода в соседнюю (Schmitt trigger, см. snapgrid / Fitts). */
const PREP_SIDEBAR_CELL_SWITCH_MARGIN = 0.28;

/**
 * Дискретный индекс оси с гистерезисом: палец должен явно пересечь границу клетки,
 * иначе тень остаётся на текущей — без «прыжков на километр» от микродвижений.
 */
function quantizePrepSidebarAxis(norm, count, stickyIndex) {
  const n = Math.max(0, Math.min(1, norm));
  if (count <= 1) return 0;
  if (stickyIndex == null || !Number.isFinite(stickyIndex)) {
    return Math.max(0, Math.min(count - 1, Math.round(n * (count - 1))));
  }
  let idx = Math.max(0, Math.min(count - 1, stickyIndex));
  const margin = PREP_SIDEBAR_CELL_SWITCH_MARGIN / count;
  const upperEdge = (idx + 1) / count;
  const lowerEdge = idx / count;
  if (idx < count - 1 && n >= upperEdge + margin) idx += 1;
  else if (idx > 0 && n <= lowerEdge - margin) idx -= 1;
  return idx;
}

/** Зона управления дугой: коридор между рюкзаком и магазином (как на UX-макете). */
/** Зона управления дугой: коридор между рюкзаком и магазином (как на UX-макете). */
function getPrepBenchCommerceRect() {
  if (typeof usesPrepBenchPopover === "function" && usesPrepBenchPopover()) {
    const popover = document.getElementById("prep-bench-popover");
    if (popover && !popover.hidden && !popover.classList.contains("hidden")) {
      const panel = popover.querySelector(".prep-bench-popover__panel");
      const panelRect = panel?.getBoundingClientRect();
      if (panelRect && panelRect.width > 0 && panelRect.height > 0) return panelRect;
    }
    const fab = document.getElementById("btn-prep-bench-fab");
    const fabRect = fab && !fab.hidden ? fab.getBoundingClientRect() : null;
    if (fabRect && fabRect.width > 0 && fabRect.height > 0) return fabRect;
    return null;
  }
  const panel = document.getElementById("bench-panel");
  const rect = panel?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? rect : null;
}

/** Зона управления дугой: коридор между рюкзаком и магазином (как на UX-макете). */
function getPrepSidebarDragMapRect() {
  const backpack = getPrepBackpackClientRect();
  if (!backpack) return null;
  const shop = document.getElementById("shop-panel")?.getBoundingClientRect();
  const bench = getPrepBenchCommerceRect();

  const sidebarLeft = Math.min(
    shop?.left ?? Infinity,
    bench?.left ?? Infinity,
  );
  const corridorLeft = backpack.right + 4;
  const corridorRight = Number.isFinite(sidebarLeft)
    ? Math.max(corridorLeft + 8, sidebarLeft - 4)
    : Math.max(corridorLeft + 8, backpack.right + backpack.right - backpack.left);
  return {
    left: corridorLeft,
    top: backpack.top,
    right: corridorRight,
    bottom: backpack.bottom,
  };
}

/** Проецирует палец на рюкзак: абсолютное 1:1 по коридору (CD ratio ≈ 1). */
function projectClientPointToPrepBackpack(clientX, clientY) {
  if (!canvas || clientX == null || clientY == null) return null;
  const team = prepViewSide;
  const coords = canvasCoordsFromClient(clientX, clientY);
  let ox;
  let oy;
  let gw;
  let gh;
  ox = gridOrigin(team);
  oy = layoutBackpackY();
  gw = GRID_INNER_W;
  gh = GRID_INNER_H;
  const inset = 0.5;

  if (coords.x >= ox + inset && coords.x <= ox + gw - inset
    && coords.y >= oy + inset && coords.y <= oy + gh - inset) {
    return coords;
  }

  const mapRect = getPrepSidebarDragMapRect();
  if (!mapRect) return null;

  const spanX = Math.max(1, mapRect.right - mapRect.left);
  const spanY = Math.max(1, mapRect.bottom - mapRect.top);
  const normX = Math.max(0, Math.min(1, (clientX - mapRect.left) / spanX));
  const normY = Math.max(0, Math.min(1, (clientY - mapRect.top) / spanY));

  return {
    x: ox + Math.max(inset, Math.min(gw - inset, normX * gw)),
    y: oy + Math.max(inset, Math.min(gh - inset, normY * gh)),
  };
}

function applyPrepSidebarCorridorHover(projected, side, st) {
  const team = prepViewSide;
  const gridW = getActiveGridCols();
  const gridH = getActiveGridRows();
  let ox;
  let oy;
  let innerW;
  let innerH;
  ox = gridOrigin(team);
  oy = layoutBackpackY();
  innerW = GRID_INNER_W;
  innerH = GRID_INNER_H;
  const normX = (projected.x - ox) / innerW;
  const normY = (projected.y - oy) / innerH;
  const col = quantizePrepSidebarAxis(normX, gridW, prepSidebarStickyHover?.col);
  const row = quantizePrepSidebarAxis(normY, gridH, prepSidebarStickyHover?.row);
  prepSidebarStickyHover = { col, row };
  const center = prepCellCanvasCenter(col, row, team);
  const directApplied = applyPrepBoardHoverFromCanvasXY(center.x, center.y, side, st);
  if (directApplied) {
    const slotOccupied = isSlotCell(st.containers, col, row)
      && !!findItemAtSlot(st.items, col, row);
    if (slotOccupied) {
      const placement = getPrepDropPlacement(st, side);
      if (placement && !placement.valid) return true;
    }
  }
  return applyPrepBoardHoverFromNearestPlaceable(center.x, center.y, side, st);
}

/** Точка тени на поле для зелёной дуги (магазин/скамья → ✊ → поле). */
function getPrepSidebarLinkTargetClient() {
  const anchor = getPrepPlacementAnchorClient();
  if (anchor) return anchor;
  const col = hoverSlot?.col ?? hoverCell?.col ?? prepDropPreviewHover?.col;
  const row = hoverSlot?.row ?? hoverCell?.row ?? prepDropPreviewHover?.row;
  if (col == null || row == null) return null;
  const target = boardCellClientCenter(col, row);
  return target;
}

function syncPrepSidebarBoardHover(clientX, clientY, side, st) {
  const pointer = createSyntheticPointerEvent(clientX, clientY);
  if (isDropOnBench(pointer) || isDropOnSell(pointer)) {
    prepDropPreviewHover = null;
    hoverCell = null;
    hoverSlot = null;
    if (typeof PrepDragArc !== "undefined" && PrepDragArc.isActive()) {
      PrepDragArc.syncHoverCell(null, null);
    }
    return false;
  }
  const inShopBounds = isPointerInsideShopDrawerBounds(clientX, clientY);
  if (!prepSidebarDragUnlocked && inShopBounds) {
    prepDropPreviewHover = null;
    hoverCell = null;
    hoverSlot = null;
    return false;
  }
  if (!prepSidebarDragUnlocked && !inShopBounds) {
    prepSidebarDragUnlocked = true;
    prepSidebarStickyHover = null;
  }

  let mx;
  let my;

  if (!isPointerOverPrepSidebar(clientX, clientY)) {
    const coords = canvasCoordsFromClient(clientX, clientY);
    if (isOnBoard(coords.x, coords.y, side)) {
      mx = coords.x;
      my = coords.y;
      prepSidebarStickyHover = null;
    }
  }

  if (mx == null) {
    const projected = projectClientPointToPrepBackpack(clientX, clientY);
    if (!projected) return false;
    return applyPrepSidebarCorridorHover(projected, side, st);
  }

  // Если проекция попала в занятую клетку и предмет сейчас не размещается,
  // показываем красную тень именно в этой точке (без автоснаппинга).
  const directApplied = applyPrepBoardHoverFromCanvasXY(mx, my, side, st);
  if (directApplied) {
    const col = xToCol(mx, side);
    const row = yToRow(my, side);
    const slotOccupied = isSlotCell(st.containers, col, row)
      && !!findItemAtSlot(st.items, col, row);
    if (slotOccupied) {
      const placement = getPrepDropPlacement(st, side);
      if (placement && !placement.valid) return true;
    }
  }

  return applyPrepBoardHoverFromNearestPlaceable(mx, my, side, st);
}

function getPrepGhostCanvasScale() {
  if (!canvas || canvas.width <= 0) return 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0) return 1;
  return rect.width / canvas.width;
}

function getPrepRemoteHoldGhostLayout(def, rotation) {
  const cell = layoutCell;
  const margin = CELL_TILE_PAD * 2;
  const emojiBox = Math.max(28, cell * 1.35);
  const logicalW = emojiBox + margin * 2;
  const logicalH = emojiBox + margin * 2;
  const scale = getPrepGhostCanvasScale();
  return {
    cell,
    emojiBox,
    logicalW,
    logicalH,
    clientW: logicalW * scale,
    clientH: logicalH * scale,
    scale,
  };
}

function drawPrepRemoteHoldGhost(targetCtx, def, itemId, rotation, layout) {
  const icon = getItemIcons(def)?.[0] || "📦";
  const cx = layout.logicalW / 2;
  const cy = layout.logicalH / 2;
  const rotDeg = (((rotation || 0) % 4) + 4) % 4 * 90;

  targetCtx.save();
  if (rotDeg) {
    targetCtx.translate(cx, cy);
    targetCtx.rotate(rotDeg * Math.PI / 180);
    targetCtx.translate(-cx, -cy);
  }
  targetCtx.font = `${Math.round(layout.emojiBox)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  targetCtx.textAlign = "center";
  targetCtx.textBaseline = "middle";
  targetCtx.shadowColor = "rgba(0,0,0,0.45)";
  targetCtx.shadowBlur = 9;
  targetCtx.fillText(icon, cx, cy);
  targetCtx.restore();
}

function getPrepPlacementAnchorClient() {
  if (!isLoadoutInteractionPhase() || !dragPayload || !canvas) return null;
  const side = dragFrom?.side || prepViewSide;
  if (!canEditPrepSide(side)) return null;
  const st = getLoadoutEditState(side);
  const placement = getPrepDropPlacement(st, side);
  if (!placement) return null;
  const team = prepViewSide;
  const def = ITEM_CATALOG[dragPayload.itemId];
  if (!def) return null;
  const shape = rotateShape(def.shape, placement.rotation || 0);
  if (!shape.length) return null;
  let sx = 0;
  let sy = 0;
  shape.forEach(([dx, dy]) => {
    const rect = cellRect(team, placement.col + dx, placement.row + dy);
    sx += rect.x + rect.w / 2;
    sy += rect.y + rect.h / 2;
  });
  return canvasPointToClient(sx / shape.length, sy / shape.length);
}

function isPointerOverPrepBackpack(clientX, clientY) {
  if (!canvas || !isLoadoutInteractionPhase() || clientX == null || clientY == null) return false;
  if (isPointerOverPrepSidebar(clientX, clientY)) return false;
  const coords = canvasCoordsFromClient(clientX, clientY);
  return isOnBoard(coords.x, coords.y, prepViewSide);
}

function getPrepDragGhostClientPos(clientX, clientY) {
  if (isPrepSidebarArcDrag()) {
    return { x: clientX, y: clientY, rotation: 0 };
  }
  const anchor = getDragGhostAnchorClient(clientX, clientY);
  if (isLoadoutInteractionPhase()
    && isPrepArcDragSource()
    && typeof PrepDragArc !== "undefined"
    && PrepDragArc.isActive()) {
    return PrepDragArc.resolveGhostPosition(clientX, clientY, anchor.x, anchor.y);
  }
  return { x: anchor.x, y: anchor.y, rotation: 0 };
}

function syncPrepDragBoardHover(clientX, clientY, ghostClientX, ghostClientY) {
  prepDropPreviewHover = null;
  if (!isLoadoutInteractionPhase() || !dragPayload) return;
  const side = dragFrom?.side || prepViewSide;
  if (!canEditPrepSide(side)) {
    hoverCell = null;
    hoverSlot = null;
    return;
  }
  const st = getLoadoutEditState(side);

  const tryCanvas = (mx, my) => applyPrepBoardHoverFromCanvasXY(mx, my, side, st);
  const tryClient = (cx, cy) => {
    const coords = canvasCoordsFromClient(cx, cy);
    return tryCanvas(coords.x, coords.y);
  };

  if (isPrepSidebarArcDrag()) {
    if (syncPrepSidebarBoardHover(clientX, clientY, side, st)) {
      maybePrepArcHoverSound(hoverSlot?.col ?? hoverCell?.col, hoverSlot?.row ?? hoverCell?.row);
      return;
    }
  } else {
    if (tryClient(clientX, clientY)) {
      maybePrepArcHoverSound(hoverSlot?.col ?? hoverCell?.col, hoverSlot?.row ?? hoverCell?.row);
      return;
    }
    if (ghostClientX != null && ghostClientY != null && tryClient(ghostClientX, ghostClientY)) {
      maybePrepArcHoverSound(hoverSlot?.col ?? hoverCell?.col, hoverSlot?.row ?? hoverCell?.row);
      return;
    }
    if (typeof PrepDragArc !== "undefined" && PrepDragArc.isActive() && isPrepArcDragSource()) {
      const anchor = getDragGhostAnchorClient(clientX, clientY);
      if (tryClient(anchor.x, anchor.y)) {
        maybePrepArcHoverSound(hoverSlot?.col ?? hoverCell?.col, hoverSlot?.row ?? hoverCell?.row);
        return;
      }
    }
  }

  hoverCell = null;
  hoverSlot = null;
  if (typeof PrepDragArc !== "undefined" && PrepDragArc.isActive()) {
    PrepDragArc.syncHoverCell(null, null);
  }
}

/** @deprecated use syncPrepDragBoardHover */
function syncPrepDropPreviewHover(clientX, clientY, ghostClientX, ghostClientY) {
  syncPrepDragBoardHover(clientX, clientY, ghostClientX, ghostClientY);
}

function getPrepDropPlacement(st, side = prepViewSide, rotationOverride = null) {
  if (!dragPayload || !isLoadoutInteractionPhase()) return null;
  const activeRot = rotationOverride != null ? rotationOverride : (dragPayload.rotation || 0);
  const gridW = getActiveGridCols();
  const gridH = getActiveGridRows();
  const col = hoverSlot?.col ?? hoverCell?.col ?? prepDropPreviewHover?.col;
  const row = hoverSlot?.row ?? hoverCell?.row ?? prepDropPreviewHover?.row;
  if (col == null || row == null) return null;

  const excludeUid = dragFrom?.type === "container"
    ? dragFrom.container?.uid
    : (dragFrom?.type === "item" ? dragFrom.item?.uid : null);

  if (isContainerItem(dragPayload.itemId)) {
    const exactOnly = rotationOverride != null;
    const resolved = resolveContainerPlacementAtCursor(st, col, row, activeRot, exactOnly);
    if (!resolved) return null;
    const valid = dragFrom?.type === "container"
      ? canMoveContainerWithItems(
        dragFrom.container,
        resolved.col,
        resolved.row,
        st.containers,
        st.items,
        excludeUid,
        gridW,
        gridH,
      )
      : canPlaceContainer(
        dragPayload.itemId,
        resolved.col,
        resolved.row,
        resolved.rotation,
        gridW,
        gridH,
        st.containers,
        excludeUid,
        st.items,
      );
    return {
      kind: "container",
      col: resolved.col,
      row: resolved.row,
      rotation: resolved.rotation,
      valid,
      displaced: [],
    };
  }

  const placement = resolveLoadoutPlacementDisplacing(
    st.containers,
    dragPayload.itemId,
    col,
    row,
    activeRot,
  );
  if (!placement.valid) {
    return buildInvalidItemDropPreview(dragPayload.itemId, col, row, activeRot);
  }
  const displaced = getOverlappingLoadoutItems(
    st.items,
    dragPayload.itemId,
    placement.col,
    placement.row,
    placement.rotation,
    excludeUid,
  );
  const displacedUids = displaced.map((item) => item.uid);
  const slotOk = typeof canAddSlotItemToLoadout !== "function"
    || canAddSlotItemToLoadout(st.items, dragPayload.itemId, excludeUid, displacedUids);
  const benchOk = st.bench.length + displaced.length <= MAX_BENCH;
  return {
    kind: "item",
    col: placement.col,
    row: placement.row,
    rotation: placement.rotation,
    valid: slotOk && benchOk,
    displaced,
  };
}

function buildInvalidItemDropPreview(itemId, hoverCol, hoverRow, rotation) {
  const def = ITEM_CATALOG[itemId];
  if (!def || def.isContainer) return null;
  const rot = ((rotation || 0) % 4 + 4) % 4;
  const shape = rotateShape(def.shape, rot);
  let best = null;
  let bestScore = -1;
  for (const [dx, dy] of shape) {
    const col = hoverCol - dx;
    const row = hoverRow - dy;
    let score = 0;
    for (const [sx, sy] of shape) {
      const c = col + sx;
      const r = row + sy;
      if (c >= 0 && c < GRID_COLS && r >= 0 && r < GRID_ROWS) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = {
        kind: "item",
        col,
        row,
        rotation: rot,
        valid: false,
        displaced: [],
      };
    }
  }
  return best;
}

function getPrepArcSidebarAnchorClient(clientX, clientY) {
  const pointer = createSyntheticPointerEvent(clientX, clientY);
  if (isDropOnBench(pointer)) {
    const benchEl = document.getElementById("bench-slots") || document.getElementById("bench-panel");
    const benchCenter = getElementClientCenter(benchEl);
    if (benchCenter) return benchCenter;
  }
  if (isDropOnSell(pointer)) {
    const sellCenter = getElementClientCenter(getPrepSellDropElement());
    if (sellCenter) return sellCenter;
  }
  return null;
}

function getPrepArcDropState() {
  if (!isLoadoutInteractionPhase() || !dragPayload) return "neutral";
  const side = dragFrom?.side || prepViewSide;
  const st = getLoadoutEditState(side);

  if (isPrepSidebarArcDrag()) {
    const pointer = createSyntheticPointerEvent(lastPointerClient.x, lastPointerClient.y);
    if (isDropOnBench(pointer)) {
      return st.bench.length < MAX_BENCH ? "valid" : "invalid";
    }
    if (isDropOnSell(pointer)) {
      return "valid";
    }
    const placement = getPrepDropPlacement(st, side);
    if (!placement) return "neutral";
    return placement.valid ? "valid" : "invalid";
  }

  if (isPrepBackpackArcDrag()) {
    const pointer = createSyntheticPointerEvent(lastPointerClient.x, lastPointerClient.y);
    if (isDropOnBench(pointer)) {
      return st.bench.length < MAX_BENCH ? "valid" : "invalid";
    }
    if (isDropOnSell(pointer)) {
      return "valid";
    }
    return "neutral";
  }

  if (!isOnBoard(mousePos.x, mousePos.y, side)) return "neutral";

  if (isContainerItem(dragPayload.itemId) && hoverCell) {
    const excludeUid = dragFrom?.type === "container" ? dragFrom.container?.uid : null;
    const valid = dragFrom?.type === "container"
      ? canMoveContainerWithItems(
        dragFrom.container,
        hoverCell.col,
        hoverCell.row,
        st.containers,
        st.items,
        excludeUid,
        getActiveGridCols(),
        getActiveGridRows(),
      )
      : canPlaceContainer(
        dragPayload.itemId,
        hoverCell.col,
        hoverCell.row,
        dragPayload.rotation || 0,
        getActiveGridCols(),
        getActiveGridRows(),
        st.containers,
        excludeUid,
        st.items,
      );
    return valid ? "valid" : "invalid";
  }

  if (!isContainerItem(dragPayload.itemId) && hoverSlot) {
    const excludeUid = isPrepLoadoutItemDrag() ? dragFrom.item?.uid : null;
    const placement = resolveLoadoutPlacementDisplacing(
      st.containers,
      dragPayload.itemId,
      hoverSlot.col,
      hoverSlot.row,
      dragPayload.rotation || 0,
    );
    if (!placement.valid) return "invalid";
    const displaced = getOverlappingLoadoutItems(
      st.items,
      dragPayload.itemId,
      placement.col,
      placement.row,
      placement.rotation,
      excludeUid,
    );
    const displacedUids = displaced.map((item) => item.uid);
    const slotOk = typeof canAddSlotItemToLoadout !== "function"
      || canAddSlotItemToLoadout(st.items, dragPayload.itemId, excludeUid, displacedUids);
    const benchOk = st.bench.length + displaced.length <= MAX_BENCH;
    return placement.valid && benchOk && slotOk ? "valid" : "invalid";
  }

  return "neutral";
}

function maybeCelebratePrepArcDrop(success) {
  if (!success || typeof PrepDragArc === "undefined") return false;
  if (!isPrepArcDragSource()) return false;
  if (!PrepDragArc.isActive()) return false;
  PrepDragArc.celebrate(lastPointerClient.x, lastPointerClient.y);
  return true;
}

function hasPrepBoardDropTarget() {
  return !!(hoverSlot || hoverCell || prepDropPreviewHover);
}

function clearDragUiState() {
  document.querySelectorAll(".shop-card.shop-dragging").forEach((el) => el.classList.remove("shop-dragging"));
  pendingShopDrag = null;
  pendingBenchDrag = null;
  pendingEnhancementDrag = null;
  pendingCanvasPick = null;
  shopDidDrag = false;
  syncPrepBenchPopoverPassthrough();
  endSynergyPreview();
  synergyPreviewBuilt = null;
  canvas?.classList.remove("synergy-preview-mode");
  document.getElementById("bench-panel")?.classList.remove("bench-drop-target");
  document.getElementById("btn-prep-bench-fab")?.classList.remove("bench-drop-target");
  clearSellDropHighlight();
  dragPayload = null;
  dragFrom = null;
  prepSidebarDragUnlocked = false;
  prepSidebarStickyHover = null;
  prepDropPreviewHover = null;
  clearGamepadBoardFocus();
  if (typeof onPrepDragEnd === "function") onPrepDragEnd();
  if (typeof PrepDragArc !== "undefined" && !PrepDragArc.isCelebrating?.()) {
    PrepDragArc.end();
  }
  hideDragGhostOverlay();
  syncUiDragState();
  if (typeof window.resetPrepTouchGesture === "function") window.resetPrepTouchGesture();
}

function canStartBattle() {
  if (phase !== "prep" || gameOver) return false;
  if (isCampaignMode()) {
    if (typeof Campaign === "undefined" || !Campaign.isActive()) return false;
    return Campaign.meetsFightRequirement(playerItems, playerContainers);
  }
  if (isLobbyMode()) {
    if (!lobbyState || !getLobbyPlayer(lobbyState)?.alive) return false;
    if (isLobbyRunOver(lobbyState)) return false;
    if (!getLobbyOpponent(lobbyState)) return false;
  }
  if (isLobby2pMode()) return false;
  if (round > RUN_BATTLES) {
    return false;
  }
  if (!isCampaignMode() && playerItems.length === 0) return false;
  if (opponentMode === "manual" && enemyItems.length === 0) return false;
  return true;
}

function renderFightButton() {
  const btn = document.getElementById("btn-fight");
  if (!btn) return;
  const visible = phase === "prep" && !gameOver && !isLobby2pMode();
  btn.classList.toggle("hidden", !visible);
  if (visible) btn.disabled = !canStartBattle();
  if (visible && isCampaignMode()) {
    btn.textContent = `⚔️ ${typeof Campaign !== "undefined" ? Campaign.getFightLabel() : "К манекену"}`;
  } else if (visible) {
    btn.textContent = "⚔️ Бой";
  }
  if (visible && isVersusMode() && enemyItems.length === 0) {
    btn.title = "Игрок 2: положите предметы на стол";
  } else if (visible && isCampaignMode()) {
    const reason = typeof Campaign !== "undefined"
      ? Campaign.fightBlockReason(playerItems, playerContainers)
      : "";
    btn.title = reason || "Проверка билда на тренировочном манекене";
  } else if (visible && playerItems.length === 0) {
    btn.title = "Положите предметы в сумку";
  } else {
    btn.title = "";
  }
}

function recalcSynergies() {
  syncEnhancementsForSide("player");
  syncEnhancementsForSide("enemy");
  applySynergyModifiersToContainers(playerContainers, playerItems);
  applySynergyModifiersToContainers(enemyContainers, enemyItems);
  refreshActiveSynergies(playerItems, enemyItems);
  if (prepViewSide === "player" && typeof CombatLog !== "undefined") {
    CombatLog.trackSynergies(playerItems);
  }
  if (typeof onPrepSynergiesUpdated === "function") {
    onPrepSynergiesUpdated(prepViewSide);
  }
  renderPlayerProfiles();
}

function skipBattle() {
  if (phase !== "battle") return;
  if (!battleState) {
    transitionToPhase("prep", () => {
      battleEndHandled = false;
      ensureShopReady();
      renderShop();
      renderBench();
      updateUI();
      setPhaseLabel("Подготовка", false);
    });
    return;
  }
  if (battleState.finished) {
    endBattle();
    return;
  }
  try {
    fastForwardBattle(battleState);
  } catch (err) {
    console.error("skipBattle fastForward failed:", err);
    battleState.finished = true;
    battleState.winner = battleState.winner || "draw";
  }
  renderBattleStats();
  if (battleState?.finished) endBattle();
}

function startBattleReplay() {
  if (!lastBattleReplay?.frames?.length || !lastBattlePrepSnapshot) return;
  hideBattleResultPopup();
  closeBattleInventoryPopover();
  closeBattleBuildStatsPopover();
  resetBattlePause();
  phase = "replay";
  renderPhase();
  replayPlayback = {
    frames: lastBattleReplay.frames,
    index: 0,
    accum: 0,
    frameDuration: 0.1,
    speed: savedBattleSpeed || 3,
    playing: true,
  };
  battleState = createBattleState(
    lastBattlePrepSnapshot.playerItems,
    lastBattlePrepSnapshot.enemyItems,
    lastBattlePrepSnapshot.playerClass,
    lastBattlePrepSnapshot.enemyClass,
    lastBattleReplay.summary?.roundNum || round,
  );
  if (typeof resetStackOrbitVfx === "function") resetStackOrbitVfx();
  if (typeof setBattleEnemyTeamLabel === "function") {
    setBattleEnemyTeamLabel(getEnemyDisplayName());
  }
  battleState.recording = false;
  battleState.replayFullLog = lastBattleReplay.log || [];
  applyBattleFrame(battleState, lastBattleReplay.frames[0]);
  updateBattleControlsUI();
  renderFightButton();
  setPhaseLabel("Повтор боя", true);
}

function finishBattleReplay() {
  battleState = null;
  clearBattleFloatLayer();
  if (typeof resetStackOrbitVfx === "function") resetStackOrbitVfx();
  replayPlayback = null;
  resetBattlePause();
  setBattleControlsVisible(false);
  updateUI();
  if (lastBattleReplay?.summary) {
    showBattleResultPopup(lastBattleReplay.summary, lastBattleReplay.log || []);
  }
}

function tickReplay(rawDt) {
  if (!replayPlayback || !battleState) return;

  const animDt = getBattleAnimDt(rawDt);
  if (animDt > 0) {
    tickBattleAnimations(battleState, animDt);
  }

  if (!replayPlayback.playing) return;

  replayPlayback.accum += rawDt * replayPlayback.speed;
  while (
    replayPlayback.accum >= replayPlayback.frameDuration
    && replayPlayback.index < replayPlayback.frames.length - 1
  ) {
    replayPlayback.accum -= replayPlayback.frameDuration;
    replayPlayback.index++;
    applyBattleFrame(battleState, replayPlayback.frames[replayPlayback.index]);
  }

  renderBattleStats();

  if (typeof syncReplayTimeline === "function") syncReplayTimeline();

  if (
    replayPlayback.index >= replayPlayback.frames.length - 1
    && replayPlayback.accum >= 0.35
  ) {
    finishBattleReplay();
  }
}

function syncCampaignChrome() {
  const bar = document.getElementById("campaign-hint-bar");
  const progressEl = document.getElementById("campaign-hint-progress");
  const textEl = document.getElementById("campaign-hint-text");
  const refreshBtn = document.getElementById("btn-refresh");
  const sellBtn = document.getElementById("sell-drop-zone");
  const sellFab = document.getElementById("btn-prep-sell-fab");
  if (!isCampaignMode() || phase !== "prep" || gameOver || typeof Campaign === "undefined" || !Campaign.isActive()) {
    bar?.classList.add("hidden");
    refreshBtn?.classList.remove("hidden-by-campaign");
    sellBtn?.classList.remove("hidden-by-campaign");
    sellFab?.classList.remove("hidden-by-campaign");
    if (typeof window.syncPrepSellFabVisibility === "function") window.syncPrepSellFabVisibility();
    return;
  }
  const step = Campaign.getStep();
  const prep = step?.prep || {};
  bar?.classList.remove("hidden");
  if (progressEl) progressEl.textContent = Campaign.getProgressLabel();
  if (textEl) textEl.textContent = Campaign.getHintText();
  refreshBtn?.classList.toggle("hidden-by-campaign", prep.allowRefresh === false);
  sellBtn?.classList.toggle("hidden-by-campaign", prep.allowSell === false);
  sellFab?.classList.toggle("hidden-by-campaign", prep.allowSell === false);
  if (typeof window.syncPrepSellFabVisibility === "function") window.syncPrepSellFabVisibility();
}

function isLoadoutInteractionPhase() {
  return phase === "prep";
}

function getActiveGridCols() {
  return GRID_COLS;
}

function getActiveGridRows() {
  return GRID_ROWS;
}

function getLoadoutEditState(side = prepViewSide) {
  return getSideState(side);
}

function startBattle() {
  if (typeof ScreenTransitions !== "undefined" && ScreenTransitions.isScreenTransitioning()) return;
  if (!canStartBattle()) {
    playPrepSfx("ui_error");
    if (phase === "prep" && isCampaignMode() && typeof Campaign !== "undefined") {
      const reason = Campaign.fightBlockReason(playerItems, playerContainers);
      if (reason) log(reason);
    } else if (phase === "prep" && playerItems.length === 0) {
      log("Положите хотя бы один предмет в сумку! (не только на скамейку)");
    } else if (phase === "prep" && isVersusMode() && enemyItems.length === 0) {
      log("Игрок 2: положите предметы на стол (Tab — переключить магазин)");
    }
    return;
  }
  if (isLobbyMode()) {
    stopLobbyPrepTimer();
    applyCraftingForSide("player");
    applyLobbyGhostToEnemy();
    syncLobbyPlayerFromGlobals();
  }
  if (isLobby2pMode() && lobbyState) {
    stopLobbyPrepTimer();
    applyCraftingForSide("player");
    applyCraftingForSide("enemy");
    syncLobby2pBothFromGlobals();
  }
  if (dragPayload) {
    dragPayload = null;
    dragFrom = null;
    synergyPreviewBuilt = null;
  }
  window.forceHidePrepBenchChrome?.();
  window.closePrepBenchPopover?.();

  applyCraftingForSide("player");
  if (isVersusMode()) applyCraftingForSide("enemy");

  try {
    prepareBattleStartState();
  } catch (err) {
    console.error("startBattle prepare failed:", err);
    rollbackPreparedBattleStart();
    playPrepSfx("ui_error");
    log("Не удалось начать бой — проверьте консоль");
    return;
  }

  transitionToPhase("battle", () => {
    try {
      finalizeBattleStartUi();
    } catch (err) {
      console.error("startBattle failed:", err);
      rollbackPreparedBattleStart();
      transitionToPhase("prep", () => {
        ensureShopReady();
        renderShop();
        renderBench();
        updateUI();
        setPhaseLabel("Подготовка", false);
        log("Не удалось начать бой — проверьте консоль");
      });
    }
  });
}

function endBattle() {
  const playerMatch = isLobbyMode() ? lobbyMatches.find((m) => m.isPlayerMatch) : null;
  const activeState = battleState || playerMatch?.state;
  if (!activeState || battleEndHandled) return;
  battleEndHandled = true;

  const battleWinner = activeState.winner;
  const finishedState = activeState;
  lastEndedBattleState = finishedState;
  battleState = null;
  clearBattleFloatLayer();
  if (typeof resetStackOrbitVfx === "function") resetStackOrbitVfx();
  if (typeof closeBattleHudPopups === "function") closeBattleHudPopups();
  if (typeof closeBattleInventoryPopover === "function") closeBattleInventoryPopover();
  if (typeof clearBattleDamageSummary === "function") clearBattleDamageSummary(finishedState);
  if (typeof hideBattleCountdownOverlay === "function") hideBattleCountdownOverlay();
  if (typeof resetBattleAuraFrame === "function") resetBattleAuraFrame();
  if (typeof ArenaEquipment !== "undefined" && typeof ArenaEquipment.clearAll === "function") {
    ArenaEquipment.clearAll();
  }
  if (typeof ThoughtArena !== "undefined" && typeof ThoughtArena.clearAll === "function") {
    ThoughtArena.clearAll();
  }
  renderPlayerProfiles._bootKey = null;
  renderPlayerProfiles._avatarAt = 0;
  renderPlayerProfiles._gridSynced = false;

  let battleSummary;
  try {
    lastRoundStats = finishedState.itemDamageStats;
    accumulateRunItemStats(runItemStats, finishedState.itemDamageStats);
    let goldReward = 0;

    const piggyGold = getLoadoutGoldPerRoundBonus(playerItems);
    if (piggyGold > 0) {
      gold += piggyGold;
      goldEarnedTotal += piggyGold;
      log(`Копилки и сокровища: +${piggyGold}💰`);
    }

    if (battleWinner === "player") {
      goldReward = ROUND_GOLD + WIN_GOLD;
    } else if (battleWinner === "enemy") {
      goldReward = ROUND_GOLD;
    } else {
      goldReward = ROUND_GOLD;
    }
    if (typeof applyRoundGoldWithShopMeta === "function") {
      goldReward = applyRoundGoldWithShopMeta("player", goldReward, playerItems, (msg) => log(msg));
    }
    gold += goldReward;
    goldEarnedTotal += goldReward;
    if (battleWinner === "player") {
      recentBattleResults.push("win");
      log(`Победа в бою! +${goldReward}💰`);
      playPrepSfx("battle_victory");
      if (typeof CombatLog !== "undefined") {
        CombatLog.addEvent({ type: "win", text: `Победа! +${goldReward}💰`, mergeKey: "battle:win" });
      }
    } else if (battleWinner === "enemy") {
      recentBattleResults.push("loss");
      log(`Поражение в бою. +${goldReward}💰`);
      playPrepSfx("battle_defeat");
      if (typeof CombatLog !== "undefined") {
        CombatLog.addEvent({ type: "loss", text: `Поражение. +${goldReward}💰`, mergeKey: "battle:loss" });
      }
    } else {
      recentBattleResults.push("draw");
      log(`Ничья. +${goldReward}💰`);
      playPrepSfx("battle_draw");
      if (typeof CombatLog !== "undefined") {
        CombatLog.addEvent({ type: "neutral", text: `Ничья. +${goldReward}💰`, mergeKey: "battle:draw" });
      }
    }
    if (goldReward > 0) playPrepSfx("gold");

    battleSummary = buildBattleSummary(finishedState, {
      roundNum: round,
      goldReward,
    });

    if (typeof CombatLog !== "undefined" && battleSummary.classWinnerLine) {
      CombatLog.addEvent({
        type: battleWinner === "player" ? "win" : battleWinner === "enemy" ? "loss" : "neutral",
        text: battleSummary.classWinnerLine,
        mergeKey: `battle:class:${round}`,
        icon: battleWinner === "player" ? "🏆" : battleWinner === "enemy" ? "💀" : "🤝",
      });
    }

    if (typeof finalizeBattleReplay === "function") finalizeBattleReplay(finishedState);

    lastBattleReplay = {
      frames: finishedState.replayFrames || [],
      log: [...finishedState.log],
      summary: battleSummary,
      prepSnapshot: lastBattlePrepSnapshot,
    };

    if (recentBattleResults.length > 5) recentBattleResults.shift();

    const battleResult = battleWinner === "player" ? "win" : battleWinner === "enemy" ? "loss" : "draw";
    runResults[round - 1] = battleResult;
    round++;
    syncAllMutationMilestones();
    if (isAnyLobbyMode() && lobbyState) {
      if (isLobby2pMode()) syncLobby2pBothFromGlobals();
      else syncLobbyPlayerFromGlobals();
    }
    if (!isCampaignMode()) resetShopForNewRound();

    setBattleControlsVisible(false);
    resetBattlePause();
  } catch (err) {
    console.error("endBattle summary failed:", err);
    battleSummary = buildBattleSummary(finishedState, { roundNum: round, goldReward: 0 });
    if (typeof finalizeBattleReplay === "function") finalizeBattleReplay(finishedState);
    lastBattleReplay = {
      frames: finishedState.replayFrames || [],
      log: [...(finishedState.log || [])],
      summary: battleSummary,
      prepSnapshot: lastBattlePrepSnapshot,
    };
  }

  const resultSummary = battleSummary;
  const resultLog = finishedState.log || [];
  requestAnimationFrame(() => {
    showBattleResultPopup(resultSummary, resultLog);
  });

  if (isAnyLobbyMode() && lobbyState) {
    lastLobbyPlayerBattleWinner = battleWinner;
    lobbyRoundSettling = true;
    battleState = null;
    const live = countActiveLobbyMatches(lobbyMatches);
    if (live > 0 && typeof CombatLog !== "undefined") {
      CombatLog.addEvent({
        type: "neutral",
        text: `⏳ Ещё ${live} боёв в лобби — Tab или полоска внизу, чтобы смотреть`,
        mergeKey: `lobby:live-wait:${round}`,
      });
    }
    lastEndedBattleState = null;
    return;
  }

  try {
    applyPostBattlePrep(battleWinner);
  } catch (err) {
    console.error("applyPostBattlePrep failed:", err);
    updateUI();
  }
  lastEndedBattleState = null;
}

function applyPostBattlePrep(battleWinner) {
  if (gameOver) return;

  if (isCampaignMode() && typeof Campaign !== "undefined" && Campaign.isActive()) {
    battleState = null;
    if (typeof clearBattleInventoryPopoverCache === "function") clearBattleInventoryPopoverCache();
    if (battleWinner !== "player") {
      log("Манекен выстоял — пересоберите билд и попробуйте снова");
      if (typeof CombatLog !== "undefined") {
        CombatLog.addEvent({
          type: "loss",
          text: "Урок не сдан — попробуйте ещё раз",
          mergeKey: "campaign:retry",
        });
      }
      Campaign.applyPrepStep();
      prepViewSide = "player";
      recalcSynergies();
      renderBattleStats();
      renderPlayerProfiles();
      pendingGameOver = false;
      updateUI();
      syncCampaignChrome();
      return;
    }
    const advance = Campaign.advanceAfterWin();
    if (advance.done) {
      pendingGameOver = true;
      log(Campaign.getCompletionMessage());
      if (typeof CombatLog !== "undefined") {
        CombatLog.addEvent({
          type: "win",
          text: Campaign.getCompletionMessage(),
          mergeKey: "campaign:complete",
        });
      }
      updateUI();
      renderRunStats();
      return;
    }
    log(`✅ Урок пройден! ${Campaign.getProgressLabel()}`);
    Campaign.applyPrepStep();
    prepViewSide = "player";
    recalcSynergies();
    renderBattleStats();
    renderPlayerProfiles();
    pendingGameOver = false;
    updateUI();
    syncCampaignChrome();
    return;
  }

  if (isAnyLobbyMode() && lobbyState) {
    ensureLobbyBackgroundMatchesReady();
    fastForwardRemainingLobbyMatches(lobbyMatches);
    const lobbyResult = applyAllLobbyMatchResults(lobbyState, lobbyMatches);

    if (isLobby2pMode()) {
      lobbyResult.summaries.filter((s) => s.isPlayerMatch).forEach((playerSummary) => {
        const humanId = [playerSummary.winnerId, playerSummary.loserId]
          .find((id) => lobbyState.humanIds?.includes(id));
        if (humanId == null) return;
        const fighter = getLobbyHumanFighter(lobbyState, humanId);
        if (playerSummary.loserId === humanId && typeof CombatLog !== "undefined") {
          const msg = playerSummary.eliminated
            ? `💔 ${fighter?.name} выбыл! −${playerSummary.damage} HP`
            : `💔 ${fighter?.name}: −${playerSummary.damage} HP (осталось ${fighter?.hp ?? 0})`;
          CombatLog.addEvent({ type: "loss", text: msg, mergeKey: `lobby2p:dmg:${humanId}:${round}` });
        } else if (playerSummary.winnerId === humanId && typeof CombatLog !== "undefined") {
          const oppId = playerSummary.winnerId === humanId ? playerSummary.loserId : playerSummary.winnerId;
          const opp = lobbyState.fighters[oppId];
          const msg = playerSummary.eliminated
            ? `🏆 ${fighter?.name} победил ${opp?.name}! −${playerSummary.damage} HP`
            : `🏆 ${fighter?.name} vs ${opp?.name}: −${playerSummary.damage} HP`;
          CombatLog.addEvent({ type: "win", text: msg, mergeKey: `lobby2p:win:${humanId}:${round}` });
        }
      });
    } else {
    const playerSummary = lobbyResult.summaries.find((s) => s.isPlayerMatch);
    const opponent = getLobbyOpponent(lobbyState);

    if (playerSummary?.loserId === lobbyState.playerId) {
      const msg = playerSummary.eliminated
        ? `💔 Вы выбыли из лобби! Урон: −${playerSummary.damage} HP`
        : `💔 Урон по вам: −${playerSummary.damage} HP (осталось ${getLobbyPlayer(lobbyState)?.hp ?? 0})`;
      if (typeof CombatLog !== "undefined") {
        CombatLog.addEvent({ type: "loss", text: msg, mergeKey: `lobby:dmg:player:${round}` });
      }
    } else if (playerSummary?.winnerId === lobbyState.playerId && opponent) {
      const msg = playerSummary.eliminated
        ? `🏆 ${opponent.name} выбыл! Урон: −${playerSummary.damage} HP`
        : `🏆 Урон ${opponent.name}: −${playerSummary.damage} HP (осталось ${opponent.hp})`;
      if (typeof CombatLog !== "undefined") {
        CombatLog.addEvent({ type: "win", text: msg, mergeKey: `lobby:dmg:enemy:${round}` });
      }
    }
    }

    lobbyResult.summaries.filter((s) => !s.isPlayerMatch).forEach((s) => {
      if (typeof CombatLog === "undefined") return;
      const a = lobbyState.fighters[s.winnerId];
      const b = lobbyState.fighters[s.loserId];
      if (!a || !b) return;
      const text = s.eliminated
        ? `${a.name} победил ${b.name} (−${s.damage} HP, выбыл)`
        : `${a.name} vs ${b.name}: −${s.damage} HP`;
      CombatLog.addEvent({ type: "neutral", text, mergeKey: `lobby:side:${round}:${s.matchId}` });
    });

    const playerBag = grantBagReward(playerContainers, round, GRID_COLS, GRID_ROWS, playerItems);
    if (playerBag.granted) {
      playerContainers = playerBag.containers;
      const bagName = ITEM_CATALOG[playerBag.bagId]?.name || "Сумка";
      log(`🎒 Новая сумка: ${bagName}! Инвентарь расширен.`);
      if (typeof CombatLog !== "undefined") {
        CombatLog.notifyBackpack(ITEM_CATALOG[playerBag.bagId]);
      }
    }
    if (isLobby2pMode()) {
      const enemyBag = grantBagReward(enemyContainers, round, GRID_COLS, GRID_ROWS, enemyItems);
      if (enemyBag.granted) {
        enemyContainers = enemyBag.containers;
        log(`🎒 Игрок 2: новая сумка ${ITEM_CATALOG[enemyBag.bagId]?.name || "Сумка"}!`);
      }
    }

    if (typeof disposeLobbyMatches === "function") disposeLobbyMatches(lobbyMatches);
    const dialoguePlayerMatch = lobbyMatches.find((m) => m.isPlayerMatch && !m.byeFighterId);
    const dialogueWinnerId = dialoguePlayerMatch?.state?.winner === "player"
      ? dialoguePlayerMatch.fighterAId
      : (dialoguePlayerMatch?.state?.winner === "enemy" ? dialoguePlayerMatch.fighterBId : null);
    lobbyMatches = [];
    lobbyBackgroundSimAcc.clear();
    battleState = null;
    if (typeof clearBattleInventoryPopoverCache === "function") clearBattleInventoryPopoverCache();

    const runOver = isLobby2pMode()
      ? isLobby2pRunOver(lobbyState)
      : isLobbyRunOver(lobbyState);
    if (lobbyResult.playerEliminated || lobbyResult.lobbyWon || runOver) {
      pendingGameOver = true;
      updateUI();
      renderRunStats();
      renderLobbyChrome(true);
      if (isLobby2pMode()) syncLobby2pHudDom();
      return;
    }

    startLobbyPrepRound(lobbyState, round);
    if (isLobby2pMode()) {
      importLobby2pHumanToGlobals(0);
      importLobby2pHumanToGlobals(1);
      lobbyState.ready[0] = false;
      lobbyState.ready[1] = false;
      lobbyViewFighterId = 0;
      prepViewSide = "player";
      resetShopForNewRoundForSide("player");
      resetShopForNewRoundForSide("enemy");
      syncLobby2pHudDom();
    } else {
    lobbyViewFighterId = lobbyState.playerId;
    setLobbyViewFighter(lobbyState.playerId);
    resetLobbyPrepTimer();
    resetShopForNewRoundForSide("player");
    prepViewSide = "player";
    }
    recalcSynergies();
    renderBattleStats();
    renderPlayerProfiles();
    pendingGameOver = false;
    updateUI();
    renderRunStats();
    renderLobbyChrome(true);
    if (typeof DialogueEngine !== "undefined") {
      const prepDurationSec = typeof LOBBY_PREP_SECONDS !== "undefined" ? LOBBY_PREP_SECONDS : 55;
      if (dialogueWinnerId != null) DialogueEngine.onPostBattle(lobbyState, dialogueWinnerId, []);
      DialogueEngine.onRoundPrep(lobbyState, round, [], { prepDurationSec });
    }
    return;
  }

  if (round > RUN_BATTLES) {
    pendingGameOver = true;
    updateUI();
    return;
  }

  const playerBag = grantBagReward(playerContainers, round, GRID_COLS, GRID_ROWS, playerItems);
  if (playerBag.granted) {
    playerContainers = playerBag.containers;
    const bagName = ITEM_CATALOG[playerBag.bagId]?.name || "Сумка";
    log(`🎒 Новая сумка: ${bagName}! Инвентарь расширен.`);
    if (typeof CombatLog !== "undefined") {
      CombatLog.notifyBackpack(ITEM_CATALOG[playerBag.bagId]);
    }
  }

  const enemyBag = grantBagReward(enemyContainers, round, GRID_COLS, GRID_ROWS, enemyItems);
  if (enemyBag.granted) {
    enemyContainers = enemyBag.containers;
  }

  const enemyBattleWon = battleWinner === "enemy" ? true : battleWinner === "player" ? false : null;
  if (opponentMode === "hardbot") {
    const enemyPrep = hardBotPrepPhase(
      {
        classId: enemyClass,
        gold: enemyGold,
        containers: enemyContainers,
        items: enemyItems,
        bench: enemyBench,
      },
      round,
      GRID_COLS,
      GRID_ROWS,
      enemyBattleWon,
      playerContainers,
      playerItems,
      playerClass,
    );
    enemyArchetype = enemyPrep.archetype;
    enemyClass = enemyPrep.classId;
    enemyGold = enemyPrep.gold;
    enemyContainers = enemyPrep.containers;
    enemyItems = enemyPrep.items;
    enemyBench = enemyPrep.bench;
  } else if (opponentMode === "ai") {
    const enemyPrep = aiEnemyPrepPhase(
      {
        archetype: enemyArchetype,
        classId: enemyClass,
        gold: enemyGold,
        containers: enemyContainers,
        items: enemyItems,
        bench: enemyBench,
      },
      round,
      GRID_COLS,
      GRID_ROWS,
      enemyBattleWon,
      playerItems,
      playerClass,
    );
    enemyArchetype = enemyPrep.archetype;
    enemyClass = enemyPrep.classId;
    enemyGold = enemyPrep.gold;
    enemyContainers = enemyPrep.containers;
    enemyItems = enemyPrep.items;
    enemyBench = enemyPrep.bench;
  } else {
    applyManualEnemyRoundGold(battleWinner);
  }

  resetShopForNewRoundForSide("player");
  prepViewSide = "player";

  recalcSynergies();
  renderBattleStats();
  renderPlayerProfiles();
  pendingGameOver = false;
  updateUI();
}

function showRunComplete() {
  gameOver = true;
  if (isAnyLobbyMode() && lobbyState) {
    showLobbyRunCompleteOverlay(
      lobbyState,
      runResults,
      runItemStats,
      round,
      phase,
      captureRunEndBoardSnapshot(),
      { spent: goldSpentTotal, earned: goldEarnedTotal },
    );
    return;
  }
  showRunCompleteOverlay(runResults, runItemStats, round, phase, captureRunEndBoardSnapshot(), {
    spent: goldSpentTotal,
    earned: goldEarnedTotal,
  });
}

function tickBattlePresentation() {
  if (isBattleResultIdle()) return;
  const presentState = getDisplayBattleState();
  if (!isBattleUiPhase() || !presentState) return;
  const elapsed = battleStartTime ? (Date.now() - battleStartTime) / 1000 : 0;
  const now = performance.now();
  if (!tickBattlePresentation._at) {
    tickBattlePresentation._at = { emotion: 0, arena: 0, orbit: 0, aura: 0 };
  }
  const emotionGap = typeof BattleFxTier !== "undefined"
    ? BattleFxTier.emotionPresentGapMs()
    : 100;
  const arenaGap = typeof BattleFxTier !== "undefined"
    ? BattleFxTier.arenaPresentGapMs()
    : 450;
  const orbitGap = typeof BattleFxTier !== "undefined"
    ? BattleFxTier.stackOrbitGapMs()
    : 170;
  const auraGap = typeof BattleFxTier !== "undefined"
    ? BattleFxTier.auraPresentGapMs()
    : 180;

  if (now - tickBattlePresentation._at.emotion >= emotionGap) {
    tickBattlePresentation._at.emotion = now;
    if (typeof drawEmotionLayer === "function") {
      drawEmotionLayer(null, presentState, elapsed);
    }
  }
  if (now - tickBattlePresentation._at.arena >= arenaGap) {
    tickBattlePresentation._at.arena = now;
    if (typeof tickBattleArenaPresentation === "function") {
      tickBattleArenaPresentation(presentState, elapsed);
    }
  }
  if (now - tickBattlePresentation._at.orbit >= orbitGap) {
    tickBattlePresentation._at.orbit = now;
    const orbitEnabled = typeof BattleFxTier === "undefined"
      || (BattleFxTier.stackOrbitParticlesEnabled?.() ?? true);
    if (orbitEnabled && !presentState.finished && typeof syncStackOrbitFromBattle === "function") {
      syncStackOrbitFromBattle(presentState);
    }
  }
  if (now - tickBattlePresentation._at.aura >= auraGap) {
    tickBattlePresentation._at.aura = now;
    const auraOk = typeof BattleFxTier === "undefined"
      || (BattleFxTier.battleAuraFrameEnabled?.() ?? !BattleFxTier.isLightBattleFx());
    if (auraOk && typeof syncBattleAuraFrame === "function") {
      syncBattleAuraFrame(presentState, elapsed);
    }
  }
}

function tickSingleBattleState(state, dt) {
  const countdownDt = typeof getBattleCountdownDt === "function" ? getBattleCountdownDt(dt) : dt;
  if (countdownDt > 0 && typeof tickBattleCountdown === "function") {
    tickBattleCountdown(state, countdownDt);
  }
  const simDt = getBattleSimDt(dt);
  const countdownActive = typeof isBattleCountdownActive === "function" && isBattleCountdownActive(state);
  if (simDt > 0 && !countdownActive) {
    battleTick(state, simDt);
    recordBattleFrame(state);
  }
}

function tickLobbyRoundBattles(dt, ts) {
  if (!isAnyLobbyMode() || phase !== "battle" || !lobbyMatches.length) return false;

  let playerJustFinished = false;
  const bgInterval = 1 / (typeof getLobbyBackgroundSimHz === "function" ? getLobbyBackgroundSimHz() : 5);
  const simOpts = { spectateMatchId: lobbySpectateMatchId };

  const tickMatchStep = (match, stepDt) => {
    if (match.isPlayerMatch && !battleEndHandled) {
      battleState = match.state;
      try {
        tickSingleBattleState(match.state, stepDt);
      } catch (err) {
        console.error("lobby player battleTick failed:", err);
      }
    } else {
      tickLobbyMatchState(match, stepDt, () => stepDt, lobbyState);
    }
    if (match.state?.finished) {
      match.finished = true;
      if (match.isPlayerMatch) playerJustFinished = true;
    }
  };

  lobbyMatches.forEach((match, index) => {
    if (match.byeFighterId || !match.state || match.state.finished) return;
    if (match.isPlayerMatch && battleEndHandled) return;

    const fullSim = typeof isLobbyMatchFullySimulated === "function"
      ? isLobbyMatchFullySimulated(match, index, simOpts)
      : index === lobbySpectateMatchId;

    if (fullSim) {
      lobbyBackgroundSimAcc.delete(match.id);
      tickMatchStep(match, dt);
      return;
    }

    let acc = (lobbyBackgroundSimAcc.get(match.id) || 0) + dt;
    if (acc >= bgInterval && match.state && !match.state.finished) {
      tickMatchStep(match, bgInterval);
      acc -= bgInterval;
    }
    lobbyBackgroundSimAcc.set(match.id, acc);
    if (match.state?.finished) {
      lobbyBackgroundSimAcc.delete(match.id);
    }
  });

  if (battleState && !battleEndHandled) {
    flushBattleEvents();
  }

  const lobbyHpTickMs = 500;
  const lobbyProfileTickMs = 1400;
  const lobbyAvatarTickMs = 1800;
  const lobbyChromeTickMs = 1200;

  if (Math.floor(ts / lobbyHpTickMs) !== Math.floor((ts - dt * 1000) / lobbyHpTickMs)) {
    if (lobbyState) {
      const rosterOpts = {
        phase: "battle",
        spectateMatchId: lobbySpectateMatchId,
        matches: lobbyMatches,
        round,
      };
      if (typeof syncLobbyFighterCardHp === "function") syncLobbyFighterCardHp(lobbyState, rosterOpts);
      if (typeof syncLobbyBattleBottomChipMetrics === "function") {
        syncLobbyBattleBottomChipMetrics(lobbyState, rosterOpts);
      }
    }
  }
  if (Math.floor(ts / lobbyProfileTickMs) !== Math.floor((ts - dt * 1000) / lobbyProfileTickMs)) {
    renderBattleStats();
    renderPlayerProfiles();
    if (typeof refreshBattleInventoryPopover === "function") refreshBattleInventoryPopover();
  }
  if (Math.floor(ts / lobbyAvatarTickMs) !== Math.floor((ts - dt * 1000) / lobbyAvatarTickMs)) {
    if (typeof syncLobbyFighterAvatars === "function" && lobbyState) {
      syncLobbyFighterAvatars(lobbyState, {
        phase: "battle",
        spectateMatchId: lobbySpectateMatchId,
        matches: lobbyMatches,
        round,
      });
    }
  }
  if (Math.floor(ts / lobbyChromeTickMs) !== Math.floor((ts - dt * 1000) / lobbyChromeTickMs)) {
    if (!tickLobbyRoundBattles._lastChromeAt || ts - tickLobbyRoundBattles._lastChromeAt >= lobbyChromeTickMs) {
      tickLobbyRoundBattles._lastChromeAt = ts;
      renderLobbyChrome();
    }
  }
  if (typeof syncBattleInventoryPopoverFlash === "function") syncBattleInventoryPopoverFlash();
  tickBattleHudLite();
  tickBattlePresentation();

  if (playerJustFinished && !battleEndHandled) {
    endBattle();
  }
  return true;
}

function cleanupLobbyRoundTransition() {
  if (typeof clearBattleInventoryPopoverCache === "function") clearBattleInventoryPopoverCache();
  if (typeof closeBattleInventoryPopover === "function") closeBattleInventoryPopover();
}

function finishLobbyRoundFromContinue() {
  if (!isLobbyMode() || !lobbyState) return;
  ensureLobbyBackgroundMatchesReady();
  fastForwardRemainingLobbyMatches(lobbyMatches);
  try {
    applyPostBattlePrep(lastLobbyPlayerBattleWinner);
  } catch (err) {
    console.error("finishLobbyRoundFromContinue failed:", err);
    updateUI();
  }
  cleanupLobbyRoundTransition();
  lobbyRoundSettling = false;
  lastLobbyPlayerBattleWinner = null;
}

function gameLoop(ts) {
  if (!gameLoop.last) gameLoop.last = ts;
  const dt = Math.min(0.05, (ts - gameLoop.last) / 1000);
  gameLoop.last = ts;
  lastGameLoopDt = dt;
  synergyAnimTime += dt;

  if (phase === "prep") {
    gameLoop._prepFxAcc = (gameLoop._prepFxAcc || 0) + dt;
    const prepFxStep = 1 / 30;
    if (gameLoop._prepFxAcc >= prepFxStep) {
      const fxDt = gameLoop._prepFxAcc;
      gameLoop._prepFxAcc = 0;
      if (typeof tickInventoryAnimationController === "function") tickInventoryAnimationController(fxDt);
      if (typeof tickSynergyVisualController === "function") tickSynergyVisualController(fxDt);
    }
    if (isLobby2pMode()) tickLobby2pSideBattles(dt);
    if (isLobbyMode() && lobbyState && typeof tickLobbyFighterThoughts === "function") {
      const thoughtDirty = tickLobbyFighterThoughts(lobbyState, {
        phase: "prep",
        round,
        viewFighterId: lobbyViewFighterId,
        matches: lobbyMatches,
        timerRemaining: lobbyPrepTimerRemaining,
        timerActive: lobbyPrepTimerActive,
      });
      if (thoughtDirty && typeof syncLobbyFighterAvatars === "function") {
        syncLobbyFighterAvatars(lobbyState, {
          phase: "prep",
          round,
          viewFighterId: lobbyViewFighterId,
          matches: lobbyMatches,
        });
      }
    } else if (!isLobbyMode() && !isLobby2pMode() && typeof tickSoloPrepThoughts === "function") {
      tickSoloPrepThoughts();
    }
    if (isLobbyMode() && lobbyState && typeof DialogueEngine !== "undefined") {
      const prepDurationSec = typeof LOBBY_PREP_SECONDS !== "undefined" ? LOBBY_PREP_SECONDS : 55;
      const dialogueCtx = {
        lobby: lobbyState,
        phase: "prep",
        round,
        matches: lobbyMatches,
        timerRemaining: lobbyPrepTimerRemaining,
        timerActive: lobbyPrepTimerActive,
        prepDurationSec,
      };
      if (DialogueEngine.shouldProcessTick(dialogueCtx)) {
        DialogueEngine.tick(dialogueCtx);
      }
    } else if (!isLobbyMode() && !isLobby2pMode() && phase === "prep" && typeof DialogueEngine !== "undefined") {
      const soloCtx = { round, prepDurationSec: 60 };
      if (DialogueEngine.shouldProcessTick(soloCtx)) {
        DialogueEngine.tickSolo(soloCtx);
      }
    }
    if (isLobbyMode() && lobbyPrepTimerActive) {
      lobbyPrepTimerRemaining = Math.max(0, lobbyPrepTimerRemaining - dt);
      if (Math.floor(ts / 250) !== Math.floor((ts - dt * 1000) / 250)) {
        renderLobbyChrome();
      }
      if (lobbyPrepTimerRemaining <= 0) {
        lobbyPrepTimerActive = false;
        if (canStartBattle()) {
          queueLobbyTimerBattleStart();
        } else if (!lobbyPrepOvertimeUsed) {
          lobbyPrepOvertimeUsed = true;
          lobbyPrepTimerRemaining = LOBBY_PREP_OVERTIME_SEC;
          lobbyPrepTimerActive = true;
          playPrepSfx("ui_error");
          renderLobbyChrome();
        }
      }
    }
  }

  if (phase === "prep" && synergyState.isDragging && dragPayload) {
    const st = getSideState(prepViewSide);
    const otherItems = prepViewSide === "player" ? enemyItems : playerItems;
    synergyPreviewBuilt = refreshPreviewSynergies(
      st.containers,
      st.items,
      dragPayload,
      hoverSlot,
      dragFrom,
      otherItems,
    );
    canvas?.classList.toggle(
      "synergy-preview-mode",
      synergyState.previewSynergies.length > 0,
    );
  } else {
    synergyPreviewBuilt = null;
    canvas?.classList.remove("synergy-preview-mode");
    canvas?.classList.remove("amplify-preview-mode");
  }

  if (phase === "battle" && tickLobbyRoundBattles(dt, ts)) {
    // все пары лобби тикают параллельно
  } else if (phase === "battle" && battleState && !battleState.finished) {
    const countdownDt = typeof getBattleCountdownDt === "function" ? getBattleCountdownDt(dt) : dt;
    if (countdownDt > 0 && typeof tickBattleCountdown === "function") {
      tickBattleCountdown(battleState, countdownDt);
    }
    const simDt = getBattleSimDt(dt);
    const countdownActive = typeof isBattleCountdownActive === "function"
      && isBattleCountdownActive(battleState);
    if (simDt > 0 && !countdownActive) {
      try {
        battleTick(battleState, simDt);
      } catch (err) {
        console.error("battleTick failed:", err);
      }
      flushBattleEvents();
      recordBattleFrame(battleState);
    }
    if (Math.floor(ts / 500) !== Math.floor((ts - dt * 1000) / 500)) {
      renderBattleStats();
      renderPlayerProfiles();
      if (typeof refreshBattleInventoryPopover === "function") refreshBattleInventoryPopover();
    }
    if (typeof syncBattleInventoryPopoverFlash === "function") syncBattleInventoryPopoverFlash();
    tickBattleHudLite();
    tickBattlePresentation();
  } else if (phase === "battle" && battleState?.finished && !isLobbyMode()) {
    if (typeof resetStackOrbitVfx === "function") resetStackOrbitVfx();
    clearBattleFloatLayer();
    endBattle();
  } else if (phase === "replay") {
    tickReplay(dt);
    if (Math.floor(ts / 500) !== Math.floor((ts - dt * 1000) / 500)) {
      renderPlayerProfiles();
      if (typeof refreshBattleInventoryPopover === "function") refreshBattleInventoryPopover();
    }
    if (typeof syncBattleInventoryPopoverFlash === "function") syncBattleInventoryPopoverFlash();
    tickBattleHudLite();
    tickBattlePresentation();
  }
  if (phase === "prep") {
    tickDisplaceAnimations(dt);
    tickGamepad(dt);
  } else {
    tickGamepad(dt);
  }
  if (phase === "prep" && !dragPayload && !isTouchUi() && !isPointerOverPrepSidebar(lastPointerClient.x, lastPointerClient.y) && !isPointerOverCombatFeed(lastPointerClient.x, lastPointerClient.y)) {
    if (prepTooltipsEnabled) {
      try { updateTooltip(mousePos.x, mousePos.y); } catch (err) { console.error("updateTooltip failed:", err); }
    }
  } else if ((phase === "battle" || phase === "replay") && battleState && !dragPayload && !isTouchUi()) {
    if (prepTooltipsEnabled) {
      try { updateTooltip(mousePos.x, mousePos.y); } catch (err) { console.error("updateTooltip failed:", err); }
    }
  }
  try {
    const needsSmoothDraw = !!dragPayload || synergyState.isDragging;
    const throttleBattleDraw = shouldThrottleBattleCanvasDraw() && !needsSmoothDraw;
    if ((phase === "prep" && !needsSmoothDraw) || throttleBattleDraw) {
      const accKey = throttleBattleDraw ? "_battleDrawAcc" : "_drawAcc";
      const fps = throttleBattleDraw ? battleCanvasDrawFps() : 30;
      gameLoop[accKey] = (gameLoop[accKey] || 0) + dt;
      if (gameLoop[accKey] < 1 / fps) {
        // skip canvas redraw this frame
      } else {
        gameLoop[accKey] = 0;
        draw();
      }
    } else {
      draw();
    }
  } catch (err) {
    console.error("draw failed:", err);
  }
  if (isBattleResultIdle()) {
    setTimeout(() => gameLoop(performance.now()), 250);
  } else {
    requestAnimationFrame(gameLoop);
  }
}

function layoutGridOrigin(team) {
  if (phase === "prep" && isLobby2pMode()) {
    return team === "player" ? 0 : ENEMY_X;
  }
  if (phase === "prep") return 0;
  return team === "player" ? 0 : ENEMY_X;
}

function layoutBackpackY() {
  return 0;
}

function gridOrigin(team) {
  return layoutGridOrigin(team);
}

window._battleLayout = {
  get CELL() { return CELL; },
  get BACKPACK_Y() { return BACKPACK_Y; },
  gridOrigin,
};

function handleBattleEvent(ev) {
  if (!canvas || !battleState || typeof floatLayer === "undefined") return;

  switch (ev.type) {
    case "damage": {
      const side = ev.targetTeam === "player" ? battleState.player : battleState.enemy;
      const item = ev.targetUid
        ? side?.items?.find((i) => i.uid === ev.targetUid)
        : null;
      const col = item?.col ?? 3;
      const row = item?.row ?? 2;
      if (ev.amount > 0) playPrepSfx("battle_hit", { amount: ev.amount });
      floatLayer.spawnDamage(canvas, ev.targetTeam, col, row, ev.amount);
      if (ev.sourceTeam && ev.amount > 0
        && document.documentElement.dataset.battleArenaLayout === "true"
        && typeof ArenaEquipment !== "undefined"
        && ArenaEquipment.triggerDamageStrike) {
        const atkSide = battleState[ev.sourceTeam];
        const srcItem = ev.sourceUid
          ? atkSide?.items?.find((i) => i.uid === ev.sourceUid)
          : atkSide?.items?.find(
            (i) => i.col === (ev.sourceCol ?? 3) && i.row === (ev.sourceRow ?? 2),
          );
        if (srcItem?.uid) {
          ArenaEquipment.triggerDamageStrike(ev.sourceTeam, srcItem.uid, ev.amount);
        }
      }
      if (ev.amount >= 8 && ev.sourceTeam) {
        floatLayer.spawnEmotionFly(
          canvas,
          "😤",
          ev.sourceTeam,
          ev.sourceCol ?? 3,
          ev.sourceRow ?? 2,
          ev.targetTeam,
          col,
          row,
        );
      }
      break;
    }
    case "heal": {
      const side = ev.targetTeam === "player" ? battleState.player : battleState.enemy;
      const item = ev.targetUid
        ? side?.items?.find((i) => i.uid === ev.targetUid)
        : null;
      if (ev.amount > 0) playPrepSfx("battle_heal", { amount: ev.amount });
      floatLayer.spawnHeal(canvas, ev.targetTeam, item?.col ?? 3, item?.row ?? 2, ev.amount);
      break;
    }
    case "poison_tick": {
      playPrepSfx("battle_poison");
      if (document.documentElement.dataset.battleHeroPlacement === "flank-arena"
        && typeof getProfileAvatarFloatAnchor === "function") {
        const pt = getProfileAvatarFloatAnchor(ev.targetTeam, 0);
        floatLayer.spawn(`☠️ −${ev.amount}`, "poison", pt.x, pt.y);
      } else {
        const cx = gridOrigin(ev.targetTeam) + GRID_INNER_W / 2;
        const cy = BACKPACK_Y + GRID_INNER_H / 2;
        const { vx, vy } = floatLayer.canvasToViewport(canvas, cx, cy);
        floatLayer.spawn(`☠️ −${ev.amount}`, "poison", vx, vy);
      }
      break;
    }
    case "block": {
      playPrepSfx("battle_block");
      if (document.documentElement.dataset.battleHeroPlacement === "flank-arena"
        && typeof getProfileAvatarFloatAnchor === "function") {
        const pt = getProfileAvatarFloatAnchor(ev.targetTeam, 0);
        floatLayer.spawn(`🛡 ${ev.amount}`, "block", pt.x, pt.y);
      } else {
        const cx = gridOrigin(ev.targetTeam) + GRID_INNER_W / 2;
        const cy = BACKPACK_Y + 20;
        const { vx, vy } = floatLayer.canvasToViewport(canvas, cx, cy);
        floatLayer.spawn(`🛡 ${ev.amount}`, "block", vx, vy);
      }
      break;
    }
    case "miss": {
      playPrepSfx("battle_miss");
      break;
    }
    case "fireStack": {
      if (typeof handleStackOrbitEvent === "function") handleStackOrbitEvent(ev);
      break;
    }
    default:
      break;
  }
}

function flushBattleEvents() {
  if (!battleState?.events?.length) return;
  battleState.events.forEach((ev) => handleBattleEvent(ev));
  battleState.events = [];
}
function gridStrideFor(team) {
  return team === "enemy" ? GRID_STRIDE : GRID_STRIDE;
}
function cellRect(team, col, row) {
  const cell = team === "enemy" ? GRID_CELL : layoutCell;
  const stride = gridStrideFor(team);
  return {
    x: layoutGridOrigin(team) + col * stride,
    y: layoutBackpackY() + row * stride,
    w: cell,
    h: cell,
  };
}
function xToCol(x, team = "player") {
  const stride = gridStrideFor(team);
  return Math.floor((x - layoutGridOrigin(team)) / stride);
}
function yToRow(y, team = "player") {
  const stride = gridStrideFor(team);
  return Math.floor((y - layoutBackpackY()) / stride);
}
function isOnBoard(mx, my, team = "player") {
  const ox = layoutGridOrigin(team);
  const oy = layoutBackpackY();
  return mx >= ox && mx < ox + GRID_INNER_W && my >= oy && my < oy + GRID_INNER_H;
}

function bindLobby2pSellZones() {
  document.querySelectorAll(".lobby2p-sell-zone").forEach((btn) => {
    if (btn.dataset.bound === "y") return;
    btn.dataset.bound = "y";
    btn.addEventListener("click", () => {
      const human = Number(btn.dataset.human);
      const side = human === 0 ? "player" : "enemy";
      if (phase !== "prep" || !canEditPrepSide(side)) return;
      setLobby2pActiveHuman(human);
      sellSelected(side);
    });
  });
}

function isPrepSellFabActive() {
  if (typeof window.usesPrepSellFab === "function" && window.usesPrepSellFab()) {
    const fab = document.getElementById("btn-prep-sell-fab");
    if (!fab || fab.hidden || fab.classList.contains("hidden-by-campaign")) return false;
    const cs = getComputedStyle(fab);
    return cs.display !== "none" && cs.visibility !== "hidden";
  }
  return false;
}

function getPrepSellDropElement() {
  if (isPrepSellFabActive()) return document.getElementById("btn-prep-sell-fab");
  return document.getElementById("sell-drop-zone") || document.getElementById("shop-sell-zone");
}

function isDropOnSell(e) {
  if (!e) return false;
  const pad = isTouchUi() ? 18 : 8;
  const dragSide = dragFrom?.side || prepViewSide;

  if (isLobby2pMode() && lobbyState?.isSplitLobby && phase === "prep") {
    if (e.target?.closest?.(".lobby2p-sell-zone")) {
      const zone = e.target.closest(".lobby2p-sell-zone");
      const human = Number(zone.dataset.human);
      const side = human === 0 ? "player" : "enemy";
      return side === dragSide;
    }
    for (const human of [0, 1]) {
      const side = human === 0 ? "player" : "enemy";
      if (side !== dragSide) continue;
      const zone = document.querySelector(`.lobby2p-sell-zone[data-human="${human}"]`);
      if (!zone) continue;
      const r = zone.getBoundingClientRect();
      if (e.clientX >= r.left - pad && e.clientX <= r.right + pad
        && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad) return true;
    }
    return false;
  }

  const sellFab = document.getElementById("btn-prep-sell-fab");
  if (isPrepSellFabActive()) {
    if (e.target?.closest?.("#btn-prep-sell-fab")) return true;
    if (sellFab) {
      const r = sellFab.getBoundingClientRect();
      if (r.width > 0 && e.clientX >= r.left - pad && e.clientX <= r.right + pad
        && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad) return true;
    }
    return false;
  }

  const icon = document.getElementById("sell-drop-zone");
  const zone = icon || document.getElementById("shop-sell-zone");
  if (!zone) return false;
  if (e.target?.closest?.("#sell-drop-zone, #shop-sell-zone")) return true;
  const r = zone.getBoundingClientRect();
  return e.clientX >= r.left - pad && e.clientX <= r.right + pad
    && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
}

function isDropOnBench(e) {
  if (!e || phase !== "prep") return false;
  if (dragFrom?.type === "bench" && hasPrepBoardDropTarget()) return false;
  const pad = isTouchUi() ? 14 : 0;

  if (isLobby2pMode() && lobbyState?.isSplitLobby) {
    if (e.target?.closest?.(".lobby2p-bench-slots, .lobby2p-bench-slots .bench-card")) {
      const col = e.target.closest(".lobby2p-col-bench");
      if (col) {
        const human = Number(col.dataset.human);
        const side = human === 0 ? "player" : "enemy";
        const dragSide = dragFrom?.side || prepViewSide;
        return !dragFrom?.side || dragSide === side;
      }
    }
    for (const human of [0, 1]) {
      const benchEl = document.getElementById(`lobby2p-bench-slots-${human}`);
      if (!benchEl) continue;
      const r = benchEl.getBoundingClientRect();
      const onBench = r.width > 0
        && e.clientX >= r.left - pad && e.clientX <= r.right + pad
        && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
      if (onBench) {
        const side = human === 0 ? "player" : "enemy";
        const dragSide = dragFrom?.side || prepViewSide;
        return !dragFrom?.side || dragSide === side;
      }
    }
    return false;
  }

  if (e.target?.closest?.("#btn-prep-bench-close")) return false;

  if (typeof usesPrepBenchPopover === "function" && usesPrepBenchPopover()) {
    const fab = document.getElementById("btn-prep-bench-fab");
    if (fab && !fab.hidden) {
      const fr = fab.getBoundingClientRect();
      const onFab = fr.width > 0
        && e.clientX >= fr.left - pad && e.clientX <= fr.right + pad
        && e.clientY >= fr.top - pad && e.clientY <= fr.bottom + pad;
      if (onFab || e.target?.closest?.("#btn-prep-bench-fab")) {
        if (dragPayload && dragFrom?.type !== "bench" && typeof openPrepBenchPopover === "function") {
          openPrepBenchPopover();
        }
        return true;
      }
      if (e.target?.closest?.("#bench-panel, #bench-slots, .bench-card")) {
        if (dragPayload && dragFrom?.type !== "bench" && typeof openPrepBenchPopover === "function") {
          openPrepBenchPopover();
        }
        return true;
      }
    }
  }

  const panel = document.getElementById("bench-panel");
  if (!panel) return false;
  const r = panel.getBoundingClientRect();
  const inBenchRect = r.width > 0 && r.height > 0
    && e.clientX >= r.left - pad && e.clientX <= r.right + pad
    && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
  if (inBenchRect) return true;
  if (e.target?.closest?.("#bench-panel")) return true;
  if (canvas && isLoadoutInteractionPhase()) {
    const side = dragFrom?.side || prepViewSide;
    const { x: mx, y: my } = canvasCoordsFromClient(e.clientX, e.clientY);
    if (isOnBoard(mx, my, side)) {
      const col = xToCol(mx, side);
      const row = yToRow(my, side);
      if (isSlotCell(getLoadoutEditState(side).containers, col, row)) return false;
    }
  }
  return false;
}

function canvasCoordsFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const rw = rect.width > 0 ? rect.width : canvas.width;
  const rh = rect.height > 0 ? rect.height : canvas.height;
  if (rw <= 0 || rh <= 0 || canvas.width <= 0 || canvas.height <= 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: (clientX - rect.left) * (canvas.width / rw),
    y: (clientY - rect.top) * (canvas.height / rh),
  };
}

function getElementClientCenter(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function boardCellClientCenter(col, row, team = prepViewSide) {
  const rect = cellRect(team, col, row);
  const canvasRect = canvas.getBoundingClientRect();
  const scaleX = canvasRect.width / canvas.width;
  const scaleY = canvasRect.height / canvas.height;
  return {
    x: canvasRect.left + (rect.x + rect.w / 2) * scaleX,
    y: canvasRect.top + (rect.y + rect.h / 2) * scaleY,
  };
}

/** Canvas logical coords → viewport client coords (battle + prep). */
function canvasPointToClient(x, y) {
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
  const canvasRect = canvas.getBoundingClientRect();
  if (canvasRect.width <= 0 || canvasRect.height <= 0) return null;
  const scaleX = canvasRect.width / canvas.width;
  const scaleY = canvasRect.height / canvas.height;
  return {
    x: canvasRect.left + x * scaleX,
    y: canvasRect.top + y * scaleY,
  };
}

/** Horizontal center of a team's backpack field in viewport coords. */
function getBattleTeamAnchorClient(team) {
  if (!isBattleUiPhase()) return null;
  const x = gridOrigin(team) + GRID_INNER_W / 2;
  const y = layoutBackpackY() + GRID_INNER_H / 2;
  return canvasPointToClient(x, y);
}

window.canvasPointToClient = canvasPointToClient;
window.getBattleTeamAnchorClient = getBattleTeamAnchorClient;
window.getBattleFieldLayoutMetrics = getFieldLayoutMetrics;

function setGamepadBoardFocus(col, row) {
  if (phase !== "prep" || !canEditPrepSide()) return;
  const c = Math.max(0, Math.min(GRID_COLS - 1, col));
  const r = Math.max(0, Math.min(GRID_ROWS - 1, row));
  gamepadBoardFocus = { col: c, row: r };
  const st = getSideState(prepViewSide);
  if (dragPayload) {
    if (isContainerItem(dragPayload.itemId)) {
      hoverCell = { col: c, row: r };
      hoverSlot = null;
      if (typeof PrepDragArc !== "undefined" && PrepDragArc.isActive()) {
        maybePrepArcHoverSound(c, r);
      }
    } else if (isSlotCell(st.containers, c, r)) {
      hoverSlot = { col: c, row: r };
      hoverCell = null;
      if (typeof PrepDragArc !== "undefined" && PrepDragArc.isActive()) {
        maybePrepArcHoverSound(c, r);
      }
    } else {
      hoverCell = { col: c, row: r };
      hoverSlot = null;
      if (typeof PrepDragArc !== "undefined" && PrepDragArc.isActive()) {
        PrepDragArc.syncHoverCell(null, null);
      }
    }
  } else {
    hoverSlot = isSlotCell(st.containers, c, r) ? { col: c, row: r } : null;
    hoverCell = null;
  }
}

function clearGamepadBoardFocus() {
  gamepadBoardFocus = null;
  if (!dragPayload) {
    hoverSlot = null;
    hoverCell = null;
  }
}

function drawGamepadBoardFocus() {
  if (!gamepadBoardFocus || phase !== "prep" || !fxCtx) return;
  const team = prepViewSide;
  const { col, row } = gamepadBoardFocus;
  const { x, y, w, h } = cellRect(team, col, row);
  fxCtx.save();
  fxCtx.strokeStyle = "#f0c14b";
  fxCtx.lineWidth = 2.5;
  fxCtx.shadowColor = "rgba(240, 193, 75, 0.55)";
  fxCtx.shadowBlur = 8;
  roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 5);
  fxCtx.stroke();
  fxCtx.restore();
}

function dropGamepadAtBoardFocus() {
  if (!gamepadBoardFocus) return;
  const { x, y } = boardCellClientCenter(gamepadBoardFocus.col, gamepadBoardFocus.row);
  gamepadPointerUpAt(x, y);
}

function activateGamepadPrepFocus(focus) {
  if (phase !== "prep" || gameOver || !canEditPrepSide()) return;

  if (focus.zone === "shop") {
    const card = document.querySelectorAll("#shop-slots .shop-card")[focus.index];
    if (!card || card.classList.contains("empty") || card.dataset.unaffordable) return;
    const c = getElementClientCenter(card);
    if (!c) return;
    startShopDrag(+card.dataset.index, createSyntheticPointerEvent(c.x, c.y), prepViewSide);
    return;
  }

  if (focus.zone === "bench") {
    const card = document.querySelectorAll("#bench-slots .bench-card")[focus.index];
    if (!card || card.classList.contains("empty")) return;
    const idx = +card.dataset.bench;
    if (Number.isNaN(idx)) return;
    const c = getElementClientCenter(card);
    if (!c) return;
    startBenchDrag(idx, createSyntheticPointerEvent(c.x, c.y), prepViewSide);
    return;
  }

  if (focus.zone === "board") {
    const { x, y } = boardCellClientCenter(focus.col, focus.row);
    if (dragPayload) dropGamepadAtBoardFocus();
    else gamepadPointerDownAt(x, y);
  }
}

function createSyntheticPointerEvent(clientX, clientY) {
  return {
    clientX,
    clientY,
    target: canvas,
    preventDefault() {},
    button: 0,
  };
}

function getDragGhostCanvas() {
  if (!dragGhostCanvas) {
    dragGhostCanvas = document.getElementById("ui-drag-ghost");
    dragGhostCtx = dragGhostCanvas?.getContext("2d") || null;
  }
  return dragGhostCanvas;
}

function hideDragGhostOverlay() {
  getDragGhostCanvas()?.classList.add("hidden");
}

/** Призрак drag: центр якорной клетки превью, не середина всей фигуры. */
function getDragGhostAnchorClient(clientX, clientY) {
  if (!isLoadoutInteractionPhase() || !dragPayload || !canvas) {
    return { x: clientX, y: clientY };
  }

  const side = dragFrom?.side || prepViewSide;
  if (!canEditPrepSide(side)) return { x: clientX, y: clientY };

  if (isPrepBackpackArcDrag() || isPrepEnhancementStripDrag()) {
    const sidebarAnchor = getPrepArcSidebarAnchorClient(clientX, clientY);
    if (sidebarAnchor) return sidebarAnchor;
    return { x: clientX, y: clientY };
  }

  const team = prepViewSide;

  if (isContainerItem(dragPayload.itemId) && hoverCell) {
    return boardCellClientCenter(hoverCell.col, hoverCell.row, team);
  }

  if (!isContainerItem(dragPayload.itemId) && hoverSlot) {
    const st = getLoadoutEditState(side);
    const placement = resolveLoadoutPlacementDisplacing(
      st.containers,
      dragPayload.itemId,
      hoverSlot.col,
      hoverSlot.row,
      dragPayload.rotation || 0,
    );
    if (placement.valid) {
      return boardCellClientCenter(placement.col, placement.row, team);
    }
    return boardCellClientCenter(hoverSlot.col, hoverSlot.row, team);
  }

  return { x: clientX, y: clientY };
}

function syncDragGhostOverlay(clientX, clientY) {
  if (!dragPayload) {
    hideDragGhostOverlay();
    return;
  }
  const el = getDragGhostCanvas();
  if (!el || !dragGhostCtx) return;

  const sidebarDrag = isPrepSidebarArcDrag();
  const anchor = getDragGhostAnchorClient(clientX, clientY);
  let ghostX = anchor.x;
  let ghostY = anchor.y;
  let arcRotation = null;

  if (isLoadoutInteractionPhase()
    && isPrepArcDragSource()
    && typeof PrepDragArc !== "undefined"
    && PrepDragArc.isActive()) {
    PrepDragArc.mountGhostToBody();
    if (sidebarDrag) {
      ghostX = clientX;
      ghostY = clientY;
      arcRotation = null;
      const outsideShopArea = !isPointerInsideShopDrawerBounds(clientX, clientY);
      let linkTarget = null;
      if (isPrepEnhancementStripDrag()) {
        linkTarget = getPrepArcSidebarAnchorClient(clientX, clientY);
      } else if (outsideShopArea) {
        linkTarget = getPrepSidebarLinkTargetClient();
      }
      PrepDragArc.sync(clientX, clientY, clientX, clientY, {
        linkPoint: linkTarget,
        grabAtPointer: true,
        remoteHold: true,
        dropState: getPrepArcDropState(),
        itemId: dragPayload.itemId,
      });
      el.classList.add("ui-drag-ghost--arc-flight", "ui-drag-ghost--remote-hold");
      el.classList.remove("hidden");
    } else {
      const arcPos = PrepDragArc.resolveGhostPosition(clientX, clientY, anchor.x, anchor.y);
      ghostX = arcPos.x;
      ghostY = arcPos.y;
      arcRotation = arcPos.rotation;
      PrepDragArc.sync(clientX, clientY, anchor.x, anchor.y, {
        dropState: getPrepArcDropState(),
        itemId: dragPayload.itemId,
        linkPoint: null,
        grabAtPointer: false,
        remoteHold: false,
      });
      el.classList.add("ui-drag-ghost--arc-flight");
      el.classList.remove("ui-drag-ghost--remote-hold");
    }
  } else {
    el.classList.remove("ui-drag-ghost--arc-flight", "ui-drag-ghost--remote-hold");
  }

  el.classList.remove("hidden");
  el.style.left = `${ghostX}px`;
  el.style.top = `${ghostY}px`;

  const def = ITEM_CATALOG[dragPayload.itemId];
  if (!def) return;

  const ghostDrawRotation = typeof getPrepGhostDrawRotation === "function"
    ? getPrepGhostDrawRotation()
    : (dragPayload.rotation || 0);

  const remoteHoldGhost = sidebarDrag
    && isLoadoutInteractionPhase()
    && typeof PrepDragArc !== "undefined"
    && PrepDragArc.isActive();
  const ghostLayout = remoteHoldGhost
    ? getPrepRemoteHoldGhostLayout(def, ghostDrawRotation)
    : null;
  const dpr = window.devicePixelRatio || 1;
  let sizeW;
  let sizeH;
  if (ghostLayout) {
    sizeW = Math.ceil(ghostLayout.clientW);
    sizeH = Math.ceil(ghostLayout.clientH);
  } else {
    sizeW = DRAG_GHOST_CANVAS_SIZE;
    sizeH = DRAG_GHOST_CANVAS_SIZE;
  }
  if (el.width !== Math.ceil(sizeW * dpr) || el.height !== Math.ceil(sizeH * dpr)) {
    el.width = Math.ceil(sizeW * dpr);
    el.height = Math.ceil(sizeH * dpr);
    el.style.width = `${sizeW}px`;
    el.style.height = `${sizeH}px`;
  }

  dragGhostCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dragGhostCtx.clearRect(0, 0, sizeW, sizeH);

  if (ghostLayout) {
    dragGhostCtx.scale(ghostLayout.scale, ghostLayout.scale);
    drawPrepRemoteHoldGhost(
      dragGhostCtx,
      def,
      dragPayload.itemId,
      ghostDrawRotation,
      ghostLayout,
    );
  } else {
    const offset = uiPx(10);
    drawItemPreview(offset, offset, def, dragPayload.itemId, true, ghostDrawRotation, dragGhostCtx);
  }
  if (typeof applyPrepDragGhostStyles === "function") {
    applyPrepDragGhostStyles(el, arcRotation, { fullSize: !!ghostLayout });
  }
}

function updatePointerFromClient(clientX, clientY) {
  if (!canvas) return;
  lastPointerClient.x = clientX;
  lastPointerClient.y = clientY;
  const coords = canvasCoordsFromClient(clientX, clientY);
  mousePos.x = coords.x;
  mousePos.y = coords.y;

  if (isLoadoutInteractionPhase()) {
    hoverCell = null;
    hoverSlot = null;
    const synthetic = createSyntheticPointerEvent(clientX, clientY);
    updatePendingShopDrag(synthetic);
    if (phase === "prep") {
      updatePendingBenchDrag(synthetic);
      updatePendingEnhancementDrag(synthetic);
    }
    if (phase === "prep") updatePendingCanvasPick(clientX, clientY);
    const side = dragPayload && dragFrom?.side ? dragFrom.side : prepViewSide;
    if (dragPayload && canEditPrepSide(side)) {
      syncPrepDragBoardHover(clientX, clientY, clientX, clientY);
      if (typeof window.syncFxCanvasGeometry === "function") window.syncFxCanvasGeometry();
    }

    const overSidebar = isPointerOverPrepSidebar(clientX, clientY);
    if (overSidebar) {
      tooltipItem = null;
      syncFieldTooltip();
    } else if (dragPayload) {
      tooltipItem = null;
      hideSidebarTooltip();
    } else if ((pendingShopDrag || pendingBenchDrag) && !isTouchUi()) {
      tooltipItem = null;
      hideSidebarTooltip();
    } else if (!isTouchUi()) {
      if (!sidebarTooltipPinned
        && (sidebarTooltipSource === "shop" || sidebarTooltipSource === "bench" || sidebarTooltipSource === "doll")) {
        hideSidebarTooltip();
      }
      updateTooltip(mousePos.x, mousePos.y);
    }

    const benchPanel = document.getElementById("bench-panel");
    const benchFab = document.getElementById("btn-prep-bench-fab");
    const onBench = !!(dragPayload && isDropOnBench(synthetic));
    if (benchPanel) {
      benchPanel.classList.toggle("bench-drop-target", onBench);
    }
    if (benchFab) {
      benchFab.classList.toggle("bench-drop-target", onBench);
    }
    syncSellDropHighlight(clientX, clientY);
    syncPrepShopDragBackdrop(clientX, clientY);
  } else if ((phase === "battle" || phase === "replay") && battleState && !isTouchUi()) {
    updateTooltip(mousePos.x, mousePos.y);
  }

  syncDragGhostOverlay(clientX, clientY);
  if (dragPayload && typeof onPrepDragMove === "function") onPrepDragMove(clientX, clientY);
}

function gamepadPointerDownAt(clientX, clientY) {
  if (!isLoadoutInteractionPhase() || gameOver || !canEditPrepSide()) return;
  updatePointerFromClient(clientX, clientY);
  const synthetic = createSyntheticPointerEvent(clientX, clientY);
  const target = document.elementFromPoint(clientX, clientY);

  const shopCard = target?.closest?.(".shop-card:not(.empty)");
  if (shopCard && canEditPrepSide(prepViewSide)) {
    const index = shopCard.dataset.shopIndex != null
      ? +shopCard.dataset.shopIndex
      : +shopCard.dataset.index;
    if (!Number.isNaN(index)) {
      beginPendingShopDrag(index, synthetic, prepViewSide);
      if (isTouchUi()) {
        armPointerTapTooltip(clientX, clientY, () => {
          if (dragPayload || shopDidDrag) return;
          showSidebarTooltipAt(
            clientX,
            clientY,
            shopCard.dataset.itemId,
            null,
            "shop",
            shopCard,
            { pinned: true },
          );
        }, { pointerType: "touch" });
      }
      return;
    }
  }

  const benchCard = target?.closest?.(".bench-card:not(.empty)");
  if (benchCard && canEditPrepSide(prepViewSide)) {
    const index = +benchCard.dataset.bench;
    if (!Number.isNaN(index)) {
      if (isTouchUi()) {
        const st = getSideState(prepViewSide);
        const entry = st.bench[index];
        beginPendingBenchDrag(index, synthetic, prepViewSide);
        armPointerTapTooltip(clientX, clientY, () => {
          if (dragPayload) return;
          if (!entry) return;
          showSidebarTooltipAt(
            clientX,
            clientY,
            entry.itemId,
            entry,
            "bench",
            benchCard,
            { pinned: true },
          );
        }, { pointerType: "touch" });
      } else {
        startBenchDrag(index, synthetic, prepViewSide);
      }
      return;
    }
  }

  const enhSlot = target?.closest?.(".enh-slot--filled[data-enh-slot]");
  if (enhSlot && canEditPrepSide(prepViewSide)) {
    const slotId = enhSlot.dataset.enhSlot;
    if (slotId) {
      if (isTouchUi()) {
        beginPendingEnhancementDrag(slotId, synthetic, prepViewSide);
      } else {
        startEnhancementSlotDrag(slotId, { ...synthetic, currentTarget: enhSlot }, prepViewSide);
      }
      return;
    }
  }

  const dollSlot = target?.closest?.(".doll-slot[data-slot]");
  if (dollSlot && typeof isDollOpen === "function" && isDollOpen() && canEditPrepSide(prepViewSide)) {
    if (isTouchUi()) {
      armPointerTapTooltip(clientX, clientY, () => {
        if (dragPayload) return;
        if (typeof refreshDollSlotTooltip === "function") {
          refreshDollSlotTooltip({ clientX, clientY }, dollSlot, { pinned: true });
        }
      }, { pointerType: "touch" });
    }
    return;
  }

  const clickable = target?.closest?.("button:not([disabled]), .shop-pin");
  if (clickable && !clickable.closest("#game-canvas")) {
    clickable.click();
    return;
  }

  if (isTouchUi() && target?.closest?.("#game-canvas")) {
    armPointerTapTooltip(clientX, clientY, () => {
      pendingCanvasPick = null;
      updatePointerFromClient(clientX, clientY);
      updateTooltip(mousePos.x, mousePos.y);
    }, { pointerType: "touch" });
    pendingCanvasPick = { clientX, clientY };
    return;
  }

  onMouseDown(synthetic);
}

function gamepadPointerUpAt(clientX, clientY) {
  updatePointerFromClient(clientX, clientY);
  if (tryShowPrepPointerTapTooltip(clientX, clientY)) return;
  if (tryBuyFromPendingShopDrag(clientX, clientY)) return;
  if (tryUnequipEnhancementFromPendingDrag(clientX, clientY)) return;
  pendingBenchDrag = null;
  pendingEnhancementDrag = null;
  pendingCanvasPick = null;
  finishDragDrop(createSyntheticPointerEvent(clientX, clientY));
}

function canvasCoordsFromEvent(e) {
  return canvasCoordsFromClient(e.clientX, e.clientY);
}
function rotateDragItem() {
  if (!dragPayload) return;
  const oldRot = ((dragPayload.rotation || 0) % 4 + 4) % 4;
  const newRot = (oldRot + 1) % 4;
  dragPayload.rotation = newRot;
  if (typeof beginPrepGhostRotationSpin === "function") {
    beginPrepGhostRotationSpin(oldRot, newRot);
  }
  playPrepSfx("prep_rotate");
  syncDragGhostOverlay(lastPointerClient.x, lastPointerClient.y);
}

function draw() {
  if (isBattleResultIdle()) return;
  drawWorldLayer();
  drawFxLayer();
}

function drawWorldLayer() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  if (phase === "prep") {
    if (isLobby2pMode() && lobbyState?.isSplitLobby) {
      const shake = typeof getPrepBackpackShakeOffset === "function"
        ? getPrepBackpackShakeOffset()
        : { x: 0, y: 0 };
      ctx.save();
      ctx.translate(shake.x, shake.y);
      drawLobby2pSplitPrep();
      ctx.restore();
    } else {
    const side = prepViewSide;
    const st = getSideState(side);
    const shake = typeof getPrepBackpackShakeOffset === "function"
      ? getPrepBackpackShakeOffset()
      : { x: 0, y: 0 };
    ctx.save();
    ctx.translate(shake.x, shake.y);
    const frameOptions = {
      showFullPlacementGrid: shouldShowFullContainerPlacementGrid(),
      containers: st.containers,
      items: st.items,
    };
    drawBackpackFrame(side, frameOptions);
    drawContainers(st.containers, side, false);
    drawSynergyVisuals(ctx, synergyAnimTime, synergyPreviewBuilt, "under", side);
    drawLoadoutItems(st.items, side, false);
    if (typeof drawAllPrepItemIdleEffects === "function") {
      drawAllPrepItemIdleEffects(ctx, st.items, side, synergyAnimTime);
    }
    drawSynergyVisuals(ctx, synergyAnimTime, synergyPreviewBuilt, "over", side);
    if (typeof drawPrepSynergyEnhancements === "function") {
      drawPrepSynergyEnhancements(ctx, synergyAnimTime, side, st.items);
    }
    const ampDragCtx = (dragPayload?.itemId
      && typeof isAmplifierBackpackItem === "function"
      && isAmplifierBackpackItem(dragPayload.itemId))
      ? {
        extraItemId: dragPayload.itemId,
        excludeUid: isPrepLoadoutItemDrag() ? dragFrom.item?.uid : null,
      }
      : null;
    const hasAmplifyHighlights = typeof drawPrepAmplifyHighlights === "function"
      && drawPrepAmplifyHighlights(ctx, synergyAnimTime, side, st.items, ampDragCtx);
    canvas?.classList.toggle("amplify-preview-mode", !!hasAmplifyHighlights);
    if (canEditPrepSide(side) && dragPayload && getPrepDropPlacement(st, side)) {
      if (typeof drawPrepDropPreview === "function") drawPrepDropPreview(ctx, side, st);
      else drawDropPreview(ctx);
    }
    ctx.restore();
    }
  } else if (isBattleUiPhase()) {
    const viewState = getDisplayBattleState();
    if (shouldDrawCanvasLoadoutInBattle()) {
      if (viewState) {
        drawBackpackFrame("player", {
          containers: playerContainers,
          items: viewState.player.items,
        });
        drawBackpackFrame("enemy", {
          containers: enemyContainers,
          items: viewState.enemy.items,
        });
        drawContainers(playerContainers, "player", false);
        drawContainers(enemyContainers, "enemy", false);
      } else if (battleState) {
        drawBackpackFrame("player", { containers: playerContainers, items: playerItems });
        drawBackpackFrame("enemy", { containers: enemyContainers, items: enemyItems });
      }
    }
  }
  if (isBattleUiPhase() && getDisplayBattleState()) {
    const viewState = getDisplayBattleState();
    if (shouldDrawCanvasLoadoutInBattle()) {
      drawPlacedItems(viewState.player.items, "player", false, true);
      drawPlacedItems(viewState.enemy.items, "enemy", true, true);
    }
  } else if (!isBattleUiPhase()) {
    if (typeof resetStackOrbitVfx === "function") resetStackOrbitVfx();
    clearBattleFloatLayer();
    if (typeof clearEmotionLayer === "function") clearEmotionLayer();
    if (typeof clearAttackFxLayer === "function") clearAttackFxLayer();
    if (typeof clearBattleDamageSummary === "function") clearBattleDamageSummary(battleState);
    if (typeof clearDamageFlightLayer === "function") clearDamageFlightLayer();
    if (typeof hideBattleCountdownOverlay === "function") hideBattleCountdownOverlay();
  }
}

function drawFxLayer() {
  if (!fxCtx || !fxCanvas) return;
  fxCtx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
  if (phase === "prep") {
    const side = prepViewSide;
    const st = getLoadoutEditState(side);
    const shake = typeof getPrepBackpackShakeOffset === "function"
      ? getPrepBackpackShakeOffset()
      : { x: 0, y: 0 };
    fxCtx.save();
    fxCtx.translate(shake.x, shake.y);
    drawDisplaceAnimations(fxCtx, side);
    if (canEditPrepSide() && hoverSlot && !dragPayload && !gamepadBoardFocus) drawHoverCell();
    if (canEditPrepSide() && gamepadBoardFocus && isGamepadInteraction()) drawGamepadBoardFocus();
    if (typeof drawPrepCellReactions === "function") drawPrepCellReactions(fxCtx, side);
    if (typeof drawBoardTooltipItemSparkles === "function") {
      drawBoardTooltipItemSparkles(fxCtx, synergyAnimTime);
    }
    fxCtx.restore();
    return;
  }
  if (isBattleUiPhase() && battleState) {
    drawAttackAnimations(fxCtx, battleState);
    renderBattleEffectsOverlay(battleState);
    if (typeof drawBoardTooltipItemSparkles === "function") {
      drawBoardTooltipItemSparkles(fxCtx, synergyAnimTime);
    }
    if (typeof renderBattleCountdown === "function") renderBattleCountdown(battleState);
  }
}

function meadowCssColor(varName, fallback) {
  if (typeof document === "undefined" || !document.documentElement) return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
}

function drawBackground() {
  if (phase === "prep") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.55, Math.max(w, h) * 0.75);
    glow.addColorStop(0, meadowCssColor("--canvas-glow-0", "rgba(143, 214, 148, 0.2)"));
    glow.addColorStop(0.55, meadowCssColor("--canvas-glow-1", "rgba(92, 184, 92, 0.08)"));
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (!shouldDrawCanvasLoadoutInBattle()) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  ctx.fillStyle = meadowCssColor("--canvas-battle-fill", "rgba(143, 214, 148, 0.35)");
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function getFieldFrameRect(team) {
  const cell = teamLayoutCell(team);
  const ox = layoutGridOrigin(team);
  const oy = layoutBackpackY();
  const gridW = GRID_INNER_W;
  const gridH = GRID_INNER_H;
  if (phase === "prep") {
    return {
      x: ox,
      y: oy,
      w: gridW,
      h: gridH,
      cell,
      ox,
      gridW,
      gridH,
    };
  }
  const pad = FRAME_PAD;
  return {
    x: ox - pad,
    y: oy - pad - FRAME_TITLE_H,
    w: gridW + pad * 2,
    h: gridH + pad * 2 + FRAME_TITLE_H,
    cell,
    ox,
    gridW,
    gridH,
  };
}

function gridCellFill(available, row, col) {
  if (!available) return meadowCssColor("--canvas-cell-blocked", "#a8c49a");
  const a = meadowCssColor("--canvas-cell-a", "#c5ddb8");
  const b = meadowCssColor("--canvas-cell-b", "#b8d4a8");
  return (row + col) % 2 === 0 ? a : b;
}

function getActiveExpansionDragItemId() {
  return dragPayload?.itemId ?? null;
}

function shouldShowFullContainerPlacementGrid() {
  if (!isLoadoutInteractionPhase()) return false;
  const itemId = getActiveExpansionDragItemId();
  return itemId != null && isShopExpansionContainer(itemId);
}

function drawBackpackFrame(team, options = {}) {
  const {
    showFullPlacementGrid = false,
    containers = [],
    items = [],
  } = options;
  const revealAllBoardCells = showFullPlacementGrid;
  const activeCells = revealAllBoardCells ? null : buildActiveVisualCellSet(containers, items);
  const gridCols = GRID_COLS;
  const gridRows = GRID_ROWS;

  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const available = isBoardCellAvailable(col, row, gridCols, gridRows);
      if (!available) continue;

      const key = `${col},${row}`;
      const isSlot = revealAllBoardCells || !activeCells || activeCells.has(key);
      if (!isSlot) continue;

      const { x: cx, y: cy, w: cw, h: ch } = cellRect(team, col, row);
      if (isSlot) {
        ctx.fillStyle = gridCellFill(true, row, col);
        ctx.fillRect(cx, cy, cw, ch);
      } else {
        ctx.fillStyle = "rgba(12, 22, 16, 0.55)";
        ctx.fillRect(cx, cy, cw, ch);
        ctx.strokeStyle = "rgba(74, 222, 128, 0.14)";
        ctx.lineWidth = 1;
        ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1);
      }
    }
  }
}

function teamLayoutCell(team) {
  return team === "enemy" ? GRID_CELL : layoutCell;
}

function drawContainers(containers, team, dimmed) {
  const cell = teamLayoutCell(team);
  containers.forEach((container) => {
    const def = ITEM_CATALOG[container.itemId];
    const bounds = getContainerBounds(container);
    const boardW = bounds.maxCol - bounds.minCol + 1;
    const boardH = bounds.maxRow - bounds.minRow + 1;
    const stride = gridStrideFor(team);
    const cell = teamLayoutCell(team);
    const gap = Math.max(0, stride - cell);
    const ox = gridOrigin(team) + bounds.minCol * stride;
    const oy = layoutBackpackY() + bounds.minRow * stride;
    const boardPixW = boardW * cell + Math.max(0, boardW - 1) * gap;
    const boardPixH = boardH * cell + Math.max(0, boardH - 1) * gap;
    const alpha = dimmed ? 0.55 : 1;

    getItemCells(container).forEach(([c, r]) => {
      const { x, y, w, h } = cellRect(team, c, r);
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = def.color;
      roundRect(x + 1, y + 1, w - 2, h - 2, 5);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2;
      roundRect(x + 1, y + 1, w - 2, h - 2, 5);
      ctx.stroke();
    });

    ctx.globalAlpha = alpha * 0.25;
    ctx.fillStyle = def.color;
    roundRect(ox + 2, oy + 2, boardPixW - 4, boardPixH - 4, 8);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = RARITY_COLORS[def.rarity] || "#8b949e";
    ctx.lineWidth = 2;
    roundRect(ox + 2, oy + 2, boardPixW - 4, boardPixH - 4, 8);
    ctx.stroke();

    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        if (!isSlotCell(containers, c, r)) continue;
        const { x, y, w, h } = cellRect(team, c, r);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      }
    }
    ctx.globalAlpha = 1;
  });
}

function drawLoadoutItems(items, team, dimmed) {
  const glowUid = !dragPayload && tooltipItem?.contentItem?.uid ? tooltipItem.contentItem.uid : null;
  items.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    const alpha = dimmed ? 0.55 : 1;
    const transform = typeof getPrepItemDrawTransform === "function"
      ? getPrepItemDrawTransform(item.uid)
      : null;
    const spread = typeof getPrepNeighborSpread === "function"
      ? getPrepNeighborSpread(item, team)
      : { x: 0, y: 0 };
    const center = typeof getItemVisualCenter === "function"
      ? getItemVisualCenter(item, team)
      : null;
    const gemCellMap = typeof getGemCellVisualMap === "function"
      ? getGemCellVisualMap(item, def)
      : null;

    ctx.save();
    if (center && (transform || spread.x || spread.y)) {
      ctx.translate(center.x + spread.x, center.y + spread.y);
      if (transform?.scale) ctx.scale(transform.scale, transform.scale);
      ctx.translate(-center.x, -center.y);
      if (transform?.offsetX || transform?.offsetY) {
        ctx.translate(transform.offsetX || 0, transform.offsetY || 0);
      }
    }

    getItemCells(item).forEach(([c, r]) => {
      const { x, y, w, h } = cellRect(team, c, r);
      const gemVis = gemCellMap?.get(`${c},${r}`);
      let fill = def.color;
      if (gemVis?.gemId) {
        fill = ITEM_CATALOG[gemVis.gemId]?.color || def.color;
      } else if (gemVis?.emptySocket) {
        fill = "#4a3868";
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill + "dd";
      roundRect(x + CELL_TILE_PAD, y + CELL_TILE_PAD, w - CELL_TILE_PAD * 2, h - CELL_TILE_PAD * 2, 5);
      ctx.fill();
      ctx.strokeStyle = RARITY_COLORS[def.rarity] || "#8b949e";
      ctx.lineWidth = 1.5;
      roundRect(x + CELL_TILE_PAD, y + CELL_TILE_PAD, w - CELL_TILE_PAD * 2, h - CELL_TILE_PAD * 2, 5);
      ctx.stroke();
    });
    ctx.globalAlpha = alpha;
    drawPlacedItemIcons(ctx, def, item, (c, r) => cellRect(team, c, r), { glow: glowUid === item.uid });
    drawItemSocketVisuals(ctx, item, def, (c, r) => cellRect(team, c, r));
    ctx.globalAlpha = 1;
    ctx.restore();
  });
}

function drawPlacedItems(items, team, dimmed, animated) {
  if (!items?.length) return;
  if (animated && battleState) {
    drawLoadoutItems(items, team, dimmed);
    items.forEach((item) => {
      const def = ITEM_CATALOG[item.itemId];
      if (!def) return;
      if (typeof drawBattleItemOverlays === "function") {
        drawBattleItemOverlays(ctx, item, team, def, battleState);
      }
    });
    if (typeof drawAllPrepItemIdleEffects === "function") {
      drawAllPrepItemIdleEffects(ctx, items, team, synergyAnimTime);
    }
    return;
  }
  drawLoadoutItems(items, team, dimmed);
}

function drawItemPreview(x, y, def, itemId, selected, rotation, targetCtx = ctx) {
  const shape = rotateShape(def.shape, rotation);
  targetCtx.fillStyle = selected ? "rgba(240,193,75,0.15)" : "rgba(0,0,0,0.2)";
  roundRect(x, y, CELL + 4, CELL - 4, 6, targetCtx);
  targetCtx.fill();
  shape.forEach(([dx, dy]) => {
    targetCtx.fillStyle = def.color;
    roundRect(x + 8 + dx * 16, y + 8 + dy * 16, 14, 14, 3, targetCtx);
    targetCtx.fill();
  });
  const rotDeg = (((rotation || 0) % 4) + 4) % 4 * 90;
  const icons = getItemIcons(def);
  const iconCells = shape.map(([dx, dy]) => [dx, dy]);
  const previewCellRectFn = (c, r) => ({
    x: x + 8 + c * 16,
    y: y + 8 + r * 16,
    w: 14,
    h: 14,
  });
  const useShapeBounds = iconCells.length > 1 && icons.length <= 1;
  const iconRect = useShapeBounds && typeof getShapeIconDrawRect === "function"
    ? getShapeIconDrawRect(iconCells, previewCellRectFn)
    : (() => {
      const [adx, ady] = getShapeAnchorOffset(shape);
      return previewCellRectFn(adx, ady);
    })();
  const center = typeof getCellsBoundsCenter === "function"
    ? getCellsBoundsCenter(iconCells, previewCellRectFn)
    : null;
  const drawIcons = () => {
    drawItemIcons(targetCtx, icons, iconRect.x, iconRect.y, iconRect.w, iconRect.h, 2);
  };
  if (typeof withCanvasRotation === "function") {
    withCanvasRotation(targetCtx, center, rotDeg, drawIcons);
  } else {
    drawIcons();
  }
}

function drawHoverCell() {
  if (!hoverSlot || !fxCtx) return;
  const team = prepViewSide;
  const { x, y, w, h } = cellRect(team, hoverSlot.col, hoverSlot.row);
  fxCtx.fillStyle = team === "enemy" ? "rgba(248,81,73,0.25)" : "rgba(88,166,255,0.25)";
  roundRect(x + 2, y + 2, w - 4, h - 4, 4);
  fxCtx.fill();
}

function drawDropPreview(targetCtx = fxCtx) {
  if (!dragPayload || !targetCtx) return;
  const team = prepViewSide;
  const st = getSideState(team);
  const visual = typeof getPrepDragVisualRotation === "function"
    ? getPrepDragVisualRotation()
    : { drawRot: dragPayload.rotation || 0, spinDeg: 0, spinning: false };
  const drawRot = visual.drawRot ?? (dragPayload.rotation || 0);
  const spinDeg = visual.spinDeg || 0;
  const wrapSpin = typeof InventoryAnimationController !== "undefined"
    && typeof InventoryAnimationController.withDragSpinTransform === "function"
    ? (col, row, shape, drawFn) => InventoryAnimationController.withDragSpinTransform(
      targetCtx, team, col, row, shape, spinDeg, drawFn,
    )
    : (_col, _row, _shape, drawFn) => drawFn();

  if (isContainerItem(dragPayload.itemId) && hoverCell) {
    const excludeUid = dragFrom?.type === "container" ? dragFrom.container.uid : null;
    const exactOnly = visual.spinning;
    const resolved = resolveContainerPlacementAtCursor(st, hoverCell.col, hoverCell.row, drawRot, exactOnly);
    const col = resolved?.col ?? hoverCell.col;
    const row = resolved?.row ?? hoverCell.row;
    const valid = resolved
      ? (dragFrom?.type === "container"
        ? canMoveContainerWithItems(
          dragFrom.container,
          resolved.col,
          resolved.row,
          st.containers,
          st.items,
          excludeUid,
          getActiveGridCols(),
          getActiveGridRows(),
        )
        : canPlaceContainer(
          dragPayload.itemId,
          resolved.col,
          resolved.row,
          resolved.rotation,
          getActiveGridCols(),
          getActiveGridRows(),
          st.containers,
          excludeUid,
          st.items,
        ))
      : canPlaceContainer(
        dragPayload.itemId,
        hoverCell.col,
        hoverCell.row,
        drawRot,
        GRID_COLS,
        GRID_ROWS,
        st.containers,
        excludeUid,
        st.items,
      );
    const shape = rotateShape(ITEM_CATALOG[dragPayload.itemId].shape, drawRot);
    wrapSpin(col, row, shape, () => {
      shape.forEach(([dx, dy]) => {
        const { x, y, w, h } = cellRect(team, col + dx, row + dy);
        targetCtx.fillStyle = valid ? "rgba(63,185,80,0.4)" : "rgba(248,81,73,0.4)";
        roundRect(x + 2, y + 2, w - 4, h - 4, 4);
        targetCtx.fill();
      });
    });
    return;
  }
  if (!hoverSlot) return;
  const excludeUid = isPrepLoadoutItemDrag() ? dragFrom.item.uid : null;
  const placement = resolveLoadoutPlacementDisplacing(
    st.containers,
    dragPayload.itemId,
    hoverSlot.col,
    hoverSlot.row,
    visual.spinning ? drawRot : (dragPayload.rotation || 0),
  );
  if (placement.valid && !visual.spinning) dragPayload.rotation = placement.rotation;
  const displaced = placement.valid
    ? getOverlappingLoadoutItems(
      st.items,
      dragPayload.itemId,
      placement.col,
      placement.row,
      placement.rotation,
      excludeUid,
    )
    : [];
  const displacedUids = displaced.map((item) => item.uid);
  const slotOk = typeof canAddSlotItemToLoadout !== "function"
    || canAddSlotItemToLoadout(st.items, dragPayload.itemId, excludeUid, displacedUids);
  const benchOk = st.bench.length + displaced.length <= MAX_BENCH;
  const valid = placement.valid && benchOk && slotOk;
  const previewRot = visual.spinning ? drawRot : placement.rotation;
  const previewCol = placement.valid ? placement.col : hoverSlot.col;
  const previewRow = placement.valid ? placement.row : hoverSlot.row;
  const shape = rotateShape(ITEM_CATALOG[dragPayload.itemId].shape, previewRot);
  wrapSpin(previewCol, previewRow, shape, () => {
    shape.forEach(([dx, dy]) => {
      const { x, y, w, h } = cellRect(team, previewCol + dx, previewRow + dy);
      targetCtx.fillStyle = valid ? "rgba(63,185,80,0.45)" : "rgba(248,81,73,0.45)";
      roundRect(x + 2, y + 2, w - 4, h - 4, 4);
      targetCtx.fill();
    });
  });
  displaced.forEach((item) => {
    getItemCells(item).forEach(([c, r]) => {
      const { x, y, w, h } = cellRect(team, c, r);
      targetCtx.fillStyle = valid ? "rgba(210,153,34,0.35)" : "rgba(248,81,73,0.25)";
      roundRect(x + 2, y + 2, w - 4, h - 4, 4);
      targetCtx.fill();
    });
  });
}

function describeEffect(e) {
  switch (e.type) {
    case "damage":
      return `⚔ Урон: ${formatDamageRangeText(e)}${e.damageType ? ` (${formatDamageType(e.damageType)})` : ""}`;
    case "heal": return `❤ Лечение: ${e.value}`;
    case "block": return `🛡 Блок: ${e.value}`;
    case "poison": return `☠ Яд: ${e.value}`;
    case "slow": return `🐌 Замедление: ${Math.round((e.value || 0) * 100)}%`;
    case "passiveDefense": return `🦺 Защита: +${e.value}`;
    case "passiveMaxHp": return `❤ Макс. HP: +${e.value}`;
    case "passiveLuck": return `🍀 Удача: +${e.value}`;
    case "statMult": {
      const pct = Math.round(Math.abs(e.value) * 100);
      if (e.stat === "cooldown") return `⚡ Кулдаун: −${pct}%`;
      if (e.stat === "magicDamage") return `✨ Маг. урон: +${pct}%`;
      if (e.stat === "heal") return `💚 Лечение: +${pct}%`;
      return `💪 Урон: +${pct}%`;
    }
    case "lifesteal": return `🩸 Вампиризм: ${Math.round(e.value * 100)}%`;
    case "buffTimed":
      if (e.stat === "heart") return `💖 Сердце: +${e.value} (каждые ${e.duration}с)`;
      return `🔥 +${Math.round(e.value * 100)}% ${e.stat || "урон"} на ${e.duration}с`;
    case "crit": return `🎯 Крит: ${Math.round((e.chance || 0) * 100)}%`;
    case "dodgePeriodic": return `💨 Уклонение каждые ${e.interval || 5}с`;
    case "groundFire": return `🔥 Огонь на поле: ${e.value} урона/с`;
    case "repeatCast": return `🔮 Повтор магических заклинаний`;
    case "shieldBreakBonus": return `🛡 Пробивание блока: +${Math.round((e.value || 0) * 100)}%`;
    case "shieldBlockMult": return `🛡 Усиление блока: +${Math.round((e.value || 0) * 100)}%`;
    case "gainStack": {
      const stack = e.stack || "spikes";
      const label = typeof getStackLabel === "function" ? getStackLabel(stack, e.value || 1) : stack;
      const when = e.trigger === "battle_start" ? "В начале боя" : e.trigger === "on_hit" ? "При попадании" : "Получить";
      const chance = e.chance != null ? ` (${Math.round(e.chance * 100)}%)` : "";
      return `📌 ${when}: +${e.value || 1} ${label}${chance}`;
    }
    case "spendStack": {
      const stack = e.stack || "spikes";
      const label = typeof getStackLabel === "function" ? getStackLabel(stack, e.value || 1) : stack;
      const parts = [`Потратить ${e.value || 1} ${label}`];
      if (e.heal) parts.push(`+${e.heal} HP`);
      if (e.attackBuff) parts.push(`+${e.attackBuff} урона след. атаке`);
      return `📌 ${parts.join(", ")}`;
    }
    case "damagePerStack": {
      const stack = e.stack || "spikes";
      const label = typeof getStackLabel === "function" ? getStackLabel(stack, 2) : stack;
      return `📌 +${e.value || 1} урона за каждый ${label.slice(0, -1) || "стак"}`;
    }
    case "weaponDamageStart": return `⚔ В начале боя: оружие +${e.value || 0} урона`;
    case "stackThreshold": {
      const stack = e.stack || "heat";
      const label = typeof getStackLabel === "function" ? getStackLabel(stack, e.threshold || 0) : stack;
      const parts = [`При ${e.threshold} ${label}`];
      if (e.weaponDamage) parts.push(`оружие +${e.weaponDamage} урона`);
      if (e.heal) parts.push(`+${e.heal} HP`);
      if (e.damage) parts.push(`${e.damage} урона`);
      if (e.critChance) parts.push(`+${Math.round(e.critChance * 100)}% крит`);
      return `📊 ${parts.join(", ")}`;
    }
    case "periodic": return `⏱ Каждые ${e.interval || 3}с: особый эффект`;
    case "tagScaledStack": return `📌 +${e.perTag || e.value || 1} ${e.stack || "блок"} за каждый предмет с ${typeof formatItemTagMechanic === "function" ? formatItemTagMechanic(e.tag || "armor") : `[${formatTagLabel(e.tag || "armor")}]`}`;
    case "convertHp": return `❤️ −${e.hpCost || e.from} HP → +${e.stackGain || e.toStacks} ${e.stack || "regen"}`;
    case "timedDamageReduction": return `🛡 −${Math.round((e.value || 0.25) * 100)}% урона на ${e.duration || 3}с`;
    case "cooldownStartMult": return `⚡ Предметы на ${Math.round((e.value || 0) * 100)}% быстрее`;
    case "hpLossRatio": return `❤️ В начале боя: −${Math.round((e.value || 0) * 100)}% HP`;
    case "revive": return `🔄 Перерождение с ${Math.round((e.hpRatio || 0.5) * 100)}% HP, неуязвимость ${e.invuln || 2}с`;
    case "applyStun": {
      const chance = e.chance != null ? ` (${Math.round(e.chance * 100)}%)` : "";
      return `💫 Оглушение ${e.duration || 0.5}с${chance}`;
    }
    case "bonusDamageOnStun": return `⚔ +${e.value || 1} урона по оглушённому`;
    case "cleanseDebuffs": return `✨ Снять ${e.value || 1} дебафф(ов)`;
    case "stealWeaponDamage": return `🗡 Украсть ${e.value || 1} урона с оружия противника`;
    case "damagePerFoeDebuff": return `☠ +${e.value || 0.5} урона за дебафф противника`;
    case "damagePerTag": return `🏷 +${e.value || 1} урона за предмет с ${typeof formatItemTagMechanic === "function" ? formatItemTagMechanic(e.tag || "food") : `[${formatTagLabel(e.tag || "food")}]`}`;
    case "hpThreshold": {
      const pct = Math.round((e.threshold || 0.7) * 100);
      const dir = e.direction === "above" ? "выше" : "ниже";
      return `❤️ При HP ${dir} ${pct}%: особый эффект`;
    }
    case "activationThreshold": return `🔁 После ${e.count || 6} активаций: особый эффект`;
    case "zeroStamina": return `⚡ При нулевой выносливости: +${e.restoreStamina || 2} выносливости`;
    case "invulnOnStaminaSpend": return `✨ Потратить ${e.staminaCost || 10} выносливости → неуязвимость ${e.duration || 2}с`;
    case "extraAttackOnStun": return `⚔ Доп. атака по оглушённому противнику`;
    case "critPerStack": {
      const stack = e.stack || "luck";
      const label = typeof getStackLabel === "function" ? getStackLabel(stack, 2) : stack;
      return `🎯 +${Math.round((e.value || 0.05) * 100)}% крит за ${label}`;
    }
    case "cooldownMultPerTag": {
      const tags = (e.tags || [e.tag || "pet"]).map(formatTagLabel).join(" / ");
      return `⚡ На ${Math.round((e.perTag || 0.15) * 100)}% быстрее за «${tags}»`;
    }
    case "cooldownMultPerAdjacent":
      return `⚡ На ${Math.round((e.perAdjacent || 0.10) * 100)}% быстрее за соседа (до ${Math.round((e.maxBonus || 0.60) * 100)}%)`;
    case "cooldownMultPerItemCost":
      return `⚡ На ${Math.round((e.perCost || 0.01) * 100)}% быстрее за стоимость предметов`;
    case "cooldownMultPerSocket":
      return `⚡ Атаки на ${Math.round((e.perSocket || 0.03) * 100)}% быстрее за сокет (до ${Math.round((e.maxBonus || 0.60) * 100)}%)`;
    case "cooldownMultPerTotalStacks":
      return `⚡ На ${Math.round((e.perStack || 0.05) * 100)}% быстрее за каждый стак${e.maxStacks ? ` (макс. ${e.maxStacks})` : ""}`;
    case "heartThreshold": return `💖 При ${e.count || 7} сердцах: особый эффект`;
    case "tagScaledMaxHp": return `❤️ +${e.perTag || 40} макс. HP за «${e.tag || "pet"}»`;
    case "passiveMaxStamina": return `⚡ +${e.value || 1} макс. выносливости`;
    case "onRevive": return `🔄 При перерождении: урон/яд по тегам`;
    case "onFoeHeal": return `☠ При лечении противника: яд`;
    case "critPerFoeDebuff": return `🎯 +${Math.round((e.value || 0.01) * 100)}% крит за дебафф противника`;
    case "lifestealPerTag": return `🩸 +${Math.round((e.value || 0.15) * 100)}% вампиризм за ${typeof formatItemTagMechanic === "function" ? formatItemTagMechanic(e.tag || "cold") : `[${formatTagLabel(e.tag || "cold")}]`}`;
    case "healPerTag": {
      const scope = e.adjacent ? "соседний " : "";
      return `❤ +${e.value || 1} лечения за ${scope}предмет с ${typeof formatItemTagMechanic === "function" ? formatItemTagMechanic(e.tag || "vampiric") : `[${formatTagLabel(e.tag || "vampiric")}]`}`;
    }
    case "gainWeakestStack": return `📊 +${e.value || 1} к самому слабому стаку`;
    case "onHitCapBonus": return `⚔ При попадании: +${e.value || 1} урона (до ${e.cap || 7})`;
    case "breakBlockOnHit": return `🛡 Снять ${e.value || 4} блока при попадании`;
    case "breakBlockOnCrit": return `🛡 При крите: снять ${e.value || 15} блока`;
    case "critDamageMult": return `🎯 +${Math.round((e.value || 0.5) * 100)}% крит. урона`;
    case "mutualHpThreshold": return `❤️ Оба ниже ${Math.round((e.threshold || 0.8) * 100)}% HP: особый эффект`;
    case "hitCounter": return `🎯 Каждые ${e.threshold || 4} попадания: особый эффект`;
    case "battleRageLowHp": return `🔥 Боевая ярость (<50% HP): особый эффект`;
    case "selfPoison": return `☠ +${e.value || 1} яда себе при попадании`;
    case "onDefend": return `🛡 При блоке/уклонении (${Math.round((e.chance ?? 1) * 100)}%): особый эффект`;
    case "activationLimit": return `⏳ До ${e.base || 3} активаций за бой`;
    case "preventMiss": return `🎯 Потратить ресурс → отменить промах`;
    case "onActivate": return `⚡ При активации: особый эффект`;
    case "foeHpThreshold": return `❤️ Противник ниже ${Math.round((e.threshold || 0.5) * 100)}% HP: особый эффект`;
    case "debuffThreshold": return `☠ При ${e.threshold || 10}+ дебаффах: особый эффект`;
    case "procChanceBonus": return `🍀 +${Math.round((e.value || 0.12) * 100)}% к шансу эффектов`;
    case "damagePerTotalStacks": return `⚔ +${e.value || 1} урона за каждый стак`;
    case "staminaSpendOnHit": return `⚡ −${e.staminaCost || 1} выносливости → +${e.itemDamage || 1} урона`;
    case "stealRandomStack": return `📊 ${Math.round((e.chance ?? 1) * 100)}% украсть случайный стак`;
    case "destroyFoeStacks": return `💥 Уничтожить ${e.value || 4} стака противника`;
    case "bonusDamageOnHit": return `⚔ ${Math.round((e.chance ?? 1) * 100)}% +${e.value || 1} урона`;
    case "healAsDamageMult": return `✨ ${Math.round((e.value || 0.3) * 100)}% лечения как маг. урон`;
    case "stackGainMult": return `📊 +${Math.round((e.value || 1) * 100)}% к получению стаков`;
    case "cooldownMultPerTotalStacks": return `⚡ На ${Math.round((e.perStack || 0.05) * 100)}% быстрее за каждый стак`;
    case "maxHpPercentStart": return `❤ +${Math.round((e.value || 0.12) * 100)}% макс. HP в начале боя`;
    case "stonesMultiThrow": return `🪨 Камни можно метать многократно`;
    case "onFatigueStart": return `⏳ При усталости: особый эффект`;
    case "fatigueDamageOnHit": return `💀 Урон от усталости при попадании`;
    case "critPerFoeFatigue": return `🎯 +${Math.round((e.value || 0.07) * 100)}% крит за усталость противника`;
    case "cardScaledBonus": return `🃏 +${e.perCard || 5} ${e.stack || "стака"} за каждую карту`;
    case "cardScaledDamage": return `🃏 ${e.base || 12} (+${e.perCard || 4}/карта) маг. урона`;
    case "neutralScaledStack": return `📦 +${e.perItem || 8} ${e.stack || "жара"} за нейтральный предмет`;
    case "selfPoisonStart": return `☠ В начале боя: +${e.value || 3} яда себе`;
    default: return `${typeof localizeBbDescription === "function" ? localizeBbDescription(e.type) : e.type}${e.value != null ? `: ${e.value}` : ""}`;
  }
}

function escapeTooltipHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTooltipCooldownSec(sec) {
  const n = Math.max(0, Number(sec) || 0);
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}с` : `${rounded.toFixed(1)}с`;
}

function getItemTooltipAdjustments(contentItem) {
  if (!contentItem) return null;
  const rt = contentItem.runtime;
  const hasGems = contentItem.socketedGems?.some(Boolean);
  if (!rt && !hasGems) return null;

  const adj = {
    cooldownMult: rt?.cooldownMult ?? 1,
    damageBonus: rt?.damageBonus ?? 0,
    healBonus: rt?.healBonus ?? 0,
    blockBonus: rt?.blockBonus ?? 0,
    poisonBonus: rt?.poisonBonus ?? 0,
    passiveMaxHp: 0,
    passiveDefense: 0,
    passiveLuck: 0,
  };

  if (typeof getSocketBattleEffects === "function") {
    getSocketBattleEffects(contentItem).forEach((e) => {
      if (e.type === "statMult" && e.stat === "cooldown") {
        adj.cooldownMult *= 1 + (e.value || 0);
      }
      if (e.type === "heal") adj.healBonus += e.value || 0;
      if (e.type === "block") adj.blockBonus += e.value || 0;
      if (e.type === "damage") adj.damageBonus += e.value || 0;
      if (e.type === "passiveMaxHp") adj.passiveMaxHp += e.value || 0;
      if (e.type === "passiveDefense") adj.passiveDefense += e.value || 0;
      if (e.type === "passiveLuck") adj.passiveLuck += e.value || 0;
    });
  }

  if (typeof clampCooldownMult === "function") {
    adj.cooldownMult = clampCooldownMult(adj.cooldownMult);
  }

  return adj;
}

function applyDamageBonusToEffect(effect, bonus, def) {
  if (!bonus) return effect;
  const { min, max } = resolveDamageRange(effect, def);
  const nextMin = min + bonus;
  const nextMax = max + bonus;
  return {
    ...effect,
    valueMin: nextMin,
    valueMax: nextMax,
    value: Math.round((nextMin + nextMax) / 2),
  };
}

function makeStatDeltaLine(prefix, baseFormatted, effectiveFormatted, options = {}) {
  const { color = "#e6edf3", buffColor = "green", suffix = "" } = options;
  const base = `${baseFormatted}${suffix}`;
  const effective = `${effectiveFormatted}${suffix}`;
  if (base === effective) {
    return { text: `${prefix} ${base}`, style: "normal", color };
  }
  return {
    text: prefix,
    style: "normal",
    color,
    statDelta: { from: baseFormatted, to: effectiveFormatted, suffix, buffColor },
  };
}

function describeTooltipEffectLine(e, def, adj) {
  if (!adj) {
    return { text: describeEffect(e), style: "normal", color: "#e6edf3" };
  }

  switch (e.type) {
    case "damage": {
      if (adj.damageBonus <= 0) break;
      const typeSuffix = e.damageType ? ` (${formatDamageType(e.damageType)})` : "";
      const baseRange = formatDamageRangeText(e, def);
      const modRange = formatDamageRangeText(applyDamageBonusToEffect(e, adj.damageBonus, def), def);
      return makeStatDeltaLine("⚔ Урон:", baseRange, modRange, { suffix: typeSuffix, buffColor: "green" });
    }
    case "heal": {
      if (adj.healBonus <= 0) break;
      const base = String(e.value ?? 0);
      const mod = String((e.value ?? 0) + adj.healBonus);
      return makeStatDeltaLine("❤ Лечение:", base, mod, { buffColor: "green" });
    }
    case "block": {
      if (adj.blockBonus <= 0) break;
      const base = String(e.value ?? 0);
      const mod = String((e.value ?? 0) + adj.blockBonus);
      return makeStatDeltaLine("🛡 Блок:", base, mod, { buffColor: "green" });
    }
    case "poison": {
      if (adj.poisonBonus <= 0) break;
      const base = String(e.value ?? 0);
      const mod = String((e.value ?? 0) + adj.poisonBonus);
      return makeStatDeltaLine("☠ Яд:", base, mod, { buffColor: "green" });
    }
    case "passiveDefense": {
      if (adj.passiveDefense <= 0) break;
      const base = String(e.value ?? 0);
      const mod = String((e.value ?? 0) + adj.passiveDefense);
      return makeStatDeltaLine("🦺 Защита:", `+${base}`, `+${mod}`, { buffColor: "green" });
    }
    case "passiveMaxHp": {
      if (adj.passiveMaxHp <= 0) break;
      const base = String(e.value ?? 0);
      const mod = String((e.value ?? 0) + adj.passiveMaxHp);
      return makeStatDeltaLine("❤ Макс. HP:", `+${base}`, `+${mod}`, { buffColor: "green" });
    }
    case "passiveLuck": {
      if (adj.passiveLuck <= 0) break;
      const base = String(e.value ?? 0);
      const mod = String((e.value ?? 0) + adj.passiveLuck);
      return makeStatDeltaLine("🍀 Удача:", `+${base}`, `+${mod}`, { buffColor: "green" });
    }
    default:
      break;
  }

  return { text: describeEffect(e), style: "normal", color: "#e6edf3" };
}

function renderTooltipLinesHtml(lines) {
  const fmt = typeof formatTooltipMechanicText === "function"
    ? formatTooltipMechanicText
    : (text) => (typeof escapeTooltipHtml === "function" ? escapeTooltipHtml(text) : String(text ?? ""));

  return lines
    .filter((l) => !l.sep)
    .map((l) => {
      const color = l.color ? ` style="color:${l.color}"` : "";
      if (l.statDelta) {
        const buffClass = l.statDelta.buffColor === "purple" ? " tt-stat-buff--purple" : "";
        const suffix = l.statDelta.suffix ? escapeTooltipHtml(l.statDelta.suffix) : "";
        return `<div class="tt-line tt-line-stat tt-${l.style || "normal"}"${color}>${fmt(l.text)} <span class="tt-stat-base">${escapeTooltipHtml(l.statDelta.from)}</span><span class="tt-stat-arrow">→</span><span class="tt-stat-buff${buffClass}">${escapeTooltipHtml(l.statDelta.to)}</span>${suffix}</div>`;
      }
      return `<div class="tt-line tt-${l.style || "normal"}"${color}>${fmt(l.text)}</div>`;
    })
    .join("");
}

function isDescribeEffectFallback(e) {
  const described = describeEffect(e);
  const typeLabel = typeof localizeBbDescription === "function" ? localizeBbDescription(e.type) : e.type;
  const fallback = `${typeLabel}${e.value != null ? `: ${e.value}` : ""}`;
  return described === fallback;
}

function getStrongCanonicalEffectTexts(def) {
  return (def.effects || [])
    .filter((e) => !isDescribeEffectFallback(e))
    .map((e) => describeEffect(e));
}

function normalizeTooltipCompareText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/[«»"""'']/g, "")
    .replace(/(?:^|[\s,.;])(?:в\s+)?(?:при\s+[\p{L}]+|в\s+начале\s+боя)\s*:?\s*/giu, " ")
    .replace(/каждый|тегом|у противника|противнику|с тегом/g, "")
    .replace(/(\p{L}+)ов(?=[\s,.!?:;→]|$)/gu, "$1")
    .replace(/следующей/g, "след")
    .replace(/[^\p{L}\p{N}%+\-→.:]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tooltipCompareTokens(text) {
  const normalized = normalizeTooltipCompareText(text);
  if (!normalized) return [];
  return normalized.split(" ").filter((token) => token.length > 1 || /[\d%]/.test(token));
}

function isTooltipTextCoveredBy(candidate, canonicalTexts) {
  const normalizedCandidate = normalizeTooltipCompareText(candidate);
  if (!normalizedCandidate) return true;

  return canonicalTexts.some((canonical) => {
    const normalizedCanonical = normalizeTooltipCompareText(canonical);
    if (!normalizedCanonical) return false;
    if (normalizedCandidate.includes(normalizedCanonical) || normalizedCanonical.includes(normalizedCandidate)) {
      return true;
    }

    const candidateTokens = tooltipCompareTokens(candidate);
    const canonicalTokens = tooltipCompareTokens(canonical);
    if (!candidateTokens.length || !canonicalTokens.length) return false;

    const shorter = candidateTokens.length <= canonicalTokens.length ? candidateTokens : canonicalTokens;
    const longer = candidateTokens.length > canonicalTokens.length ? candidateTokens : canonicalTokens;
    const longerSet = new Set(longer);
    const matched = shorter.filter((token) => longerSet.has(token)).length;
    return matched / shorter.length >= 0.75;
  });
}

function splitTooltipDescriptionSegments(text) {
  return String(text ?? "")
    .split(/\.\s+/)
    .map((segment) => segment.replace(/\.\s*$/, "").trim())
    .filter(Boolean);
}

function filterRedundantTooltipText(text, canonicalTexts) {
  if (!text || !canonicalTexts.length) return text;

  const segments = splitTooltipDescriptionSegments(text);
  if (!segments.length) return text;

  const kept = segments.filter((segment) => !isTooltipTextCoveredBy(segment, canonicalTexts));
  if (!kept.length) return null;
  if (kept.length === segments.length) return text;

  const joined = kept.join(". ");
  return /[.!?]$/.test(text.trim()) ? `${joined}.` : joined;
}

/** context: shop — магазин; bench — скамейка; field — предмет на поле / canvas */
function buildItemTooltipLines(def, contentItem, rotation, context = "field") {
  const lines = [];
  lines.push({ text: `${getItemIcons(def).join("")} ${typeof getItemDisplayName === "function" ? getItemDisplayName(def) : def.name}`, style: "title", color: RARITY_COLORS[def.rarity] || "#e6edf3" });

  if (def.isContainer) {
    const slots = getSlotBounds(playerContainers);
    const shape = typeof normalizeItemShape === "function"
      ? normalizeItemShape(def.shape)
      : (Array.isArray(def.shape) ? def.shape : []);
    const bounds = typeof getShapeBounds === "function"
      ? getShapeBounds(shape)
      : { cols: shape.length || 1, rows: 1 };
    lines.push({
      text: `Контейнер · +${shape.length} слотов (${bounds.cols}×${bounds.rows})`,
      style: "sub",
      color: "#8b949e",
    });
    const containerDesc = typeof getItemTooltipDescription === "function"
      ? getItemTooltipDescription(def)
      : def.description;
    const containerCanonicalTexts = getStrongCanonicalEffectTexts(def);
    const filteredContainerDesc = containerDesc
      ? filterRedundantTooltipText(containerDesc, containerCanonicalTexts)
      : null;
    if (filteredContainerDesc) {
      lines.push({ text: filteredContainerDesc, style: "normal", color: "#c9d1d9" });
    }
    if (context === "shop") {
      lines.push({ text: `${def.cost}💰 · купите и поставьте рядом с инвентарём`, style: "normal", color: "#f0c14b" });
    }
    if (slots) {
      lines.push({
        text: `Поле: ${slots.maxCol - slots.minCol + 1}×${slots.maxRow - slots.minRow + 1} (${slots.count} кл.)`,
        style: "normal",
        color: "#79c0ff",
      });
    }
    return lines;
  }

  if (context !== "shop") {
    const shape = typeof normalizeItemShape === "function"
      ? normalizeItemShape(def.shape)
      : (Array.isArray(def.shape) ? def.shape : []);
    lines.push({ text: `${shape.length} кл.`, style: "sub", color: "#8b949e" });
  }

  const canonicalEffectTexts = getStrongCanonicalEffectTexts(def);

  const tooltipDescription = typeof getItemTooltipDescription === "function"
    ? getItemTooltipDescription(def)
    : def.description;
  const filteredTooltipDescription = tooltipDescription
    ? filterRedundantTooltipText(tooltipDescription, canonicalEffectTexts)
    : null;
  if (filteredTooltipDescription) {
    lines.push({ text: filteredTooltipDescription, style: "normal", color: "#c9d1d9" });
  }

  const buildHints = typeof getItemBuildHints === "function" ? getItemBuildHints(def) : def.buildHints;
  if (buildHints && context !== "shop") {
    lines.push({ text: `💡 ${buildHints}`, style: "sub", color: "#79c0ff" });
  }

  if (contentItem && typeof formatSocketedGemsLine === "function") {
    const socketLine = formatSocketedGemsLine(contentItem);
    if (socketLine) lines.push({ text: socketLine, style: "normal", color: "#d2a8ff" });
  }
  if (def.sockets > 0 && context !== "shop") {
    const used = contentItem?.socketedGems?.filter(Boolean).length || 0;
    lines.push({
      text: `⭕ Сокеты: ${used}/${def.sockets}`,
      style: "normal",
      color: "#bc8cff",
    });
  }

  if (isGemItem(def.id) && context === "field") {
    lines.push({ text: "Перетащите на предмет с сокетом для вставки", style: "normal", color: "#bc8cff" });
  }

  if (def.goldPerRound > 0) {
    lines.push({ text: `💰 +${def.goldPerRound} золота за раунд`, style: "normal", color: "#f0c14b" });
  }

  const adj = context === "field" ? getItemTooltipAdjustments(contentItem) : null;

  if (def.effects?.length) {
    def.effects.forEach((e) => {
      lines.push(describeTooltipEffectLine(e, def, adj));
    });
    if (def.cooldown > 0) {
      if (adj && adj.cooldownMult < 0.999) {
        const effective = def.cooldown * adj.cooldownMult;
        lines.push(makeStatDeltaLine(
          "⏱ Перезарядка:",
          formatTooltipCooldownSec(def.cooldown),
          formatTooltipCooldownSec(effective),
          { color: "#8b949e", buffColor: "purple" },
        ));
      } else {
        lines.push({
          text: `⏱ Перезарядка: ${formatTooltipCooldownSec(def.cooldown)}`,
          style: "normal",
          color: "#8b949e",
        });
      }
    } else if (def.effects.every((e) => e.trigger === "passive" || e.type.startsWith("passive"))) {
      lines.push({ text: "Пассивный", style: "normal", color: "#8b949e" });
    }
    const staminaCost = typeof getItemStaminaCost === "function" ? getItemStaminaCost(def) : (def.staminaCost || 0);
    if (staminaCost > 0) {
      lines.push({ text: `⚡ Выносливость: ${staminaCost}`, style: "normal", color: "#d29922" });
    }
  } else if (adj && (adj.passiveMaxHp > 0 || adj.passiveDefense > 0 || adj.passiveLuck > 0)) {
    if (adj.passiveDefense > 0 && !def.effects?.some((e) => e.type === "passiveDefense")) {
      lines.push(makeStatDeltaLine("🦺 Защита:", "+0", `+${adj.passiveDefense}`, { buffColor: "green" }));
    }
    if (adj.passiveMaxHp > 0 && !def.effects?.some((e) => e.type === "passiveMaxHp")) {
      lines.push(makeStatDeltaLine("❤ Макс. HP:", "+0", `+${adj.passiveMaxHp}`, { buffColor: "green" }));
    }
    if (adj.passiveLuck > 0 && !def.effects?.some((e) => e.type === "passiveLuck")) {
      lines.push(makeStatDeltaLine("🍀 Удача:", "+0", `+${adj.passiveLuck}`, { buffColor: "green" }));
    }
  }

  if (def.classRestriction) {
    const c = getClassById(def.classRestriction);
    lines.push({ text: `Только: ${c?.name || def.classRestriction}`, style: "normal", color: "#f0c14b" });
  }

  getUniqueItemSynergies(def).forEach((s) => {
    const desc = typeof localizeSynergyDesc === "function" ? localizeSynergyDesc(s.desc) : s.desc;
    if (isTooltipTextCoveredBy(desc, canonicalEffectTexts)) return;
    lines.push({ text: desc, style: "normal", color: "#79c0ff" });
  });

  if (typeof getCraftTooltipLines === "function") {
    getCraftTooltipLines(def.id).forEach((line) => lines.push(line));
  }

  if (context === "field" && contentItem?.runtime) {
    const rt = contentItem.runtime;
    const bonuses = [];
    if (rt.poisonSourceEfficiency != null && rt.poisonSourceEfficiency < 1) {
      bonuses.push(`${Math.round(rt.poisonSourceEfficiency * 100)}% эффективности яда (стак)`);
    }
    if (rt.blockSourceEfficiency != null && rt.blockSourceEfficiency < 1) {
      bonuses.push(`${Math.round(rt.blockSourceEfficiency * 100)}% эффективности блока (стак)`);
    }
    if (rt.duplicateEfficiency != null && rt.duplicateEfficiency < 1) {
      bonuses.push(`${Math.round(rt.duplicateEfficiency * 100)}% силы (повтор на доске)`);
    }
    if (rt.grantBlockBuff && rt.grantBlockBuffEfficiency != null && rt.grantBlockBuffEfficiency < 1) {
      bonuses.push(`${Math.round(rt.grantBlockBuffEfficiency * 100)}% баффа оружия при блоке`);
    }
    if (bonuses.length) {
      lines.push({ sep: true });
      lines.push({ text: "Модификаторы:", style: "label", color: "#a371f7" });
      bonuses.forEach((b) => lines.push({ text: b, style: "normal", color: "#a371f7" }));
    }
    if (rt.activeSynergies?.length) {
      lines.push({ sep: true });
      lines.push({ text: "Активно:", style: "label", color: "#58a6ff" });
      rt.activeSynergies.forEach((s) => lines.push({ text: s.desc, style: "normal", color: "#58a6ff" }));
    }
  }

  return lines;
}

function getTooltipBounds(boundsKind = "viewport") {
  if (boundsKind === "field") {
    const canvasEl = document.getElementById("game-canvas");
    if (canvasEl) return canvasEl.getBoundingClientRect();
  }
  if (boundsKind === "shop") {
    const shop = document.getElementById("shop-panel");
    if (shop) return shop.getBoundingClientRect();
  }
  const app = document.getElementById("app");
  if (app) {
    const rect = app.getBoundingClientRect();
    return {
      left: rect.left + 8,
      top: rect.top + 8,
      right: rect.right - 8,
      bottom: rect.bottom - 8,
      width: rect.width - 16,
      height: rect.height - 16,
    };
  }
  return {
    left: 8,
    top: 8,
    right: window.innerWidth - 8,
    bottom: window.innerHeight - 8,
  };
}

function isPointerOverPrepSidebar(clientX, clientY) {
  if (clientX == null || clientY == null) return false;
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit) return false;
  return !!hit.closest(
    "#shop-panel, #prep-bench-popover, #bench-panel, #bench-slots, .bench-card, #btn-prep-bench-fab, #prep-shop-popover, .run-stats-anchor, #prep-run-stats-anchor, #run-stats-popover, #sidebar-tooltip, #prep-tooltip-dock, #recipe-book-overlay, #combat-feed-dock, #combat-feed-panel, #combat-feed-scroll, #prep-doll-layer",
  );
}

function isPointerOverShopDrawer(clientX, clientY) {
  if (clientX == null || clientY == null) return false;
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit) return false;
  return !!hit.closest("#shop-panel");
}

function isPointerOverBenchPopoverPanel(clientX, clientY) {
  if (clientX == null || clientY == null) return false;
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit) return false;
  return !!hit.closest("#prep-bench-popover .prep-bench-popover__panel, #btn-prep-bench-fab");
}

function isPointerOverShopPopoverPanel(clientX, clientY) {
  if (clientX == null || clientY == null) return false;
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit) return false;
  return !!hit.closest("#prep-shop-popover .prep-shop-popover__panel, #btn-mobile-shop, #btn-prep-sell-fab");
}

function syncPrepShopDragBackdrop(clientX, clientY) {
  const root = document.documentElement;
  const dragActive = !!(dragPayload || pendingShopDrag || pendingBenchDrag || pendingEnhancementDrag);
  const benchOpen = root.hasAttribute("data-prep-bench-open");
  const shopOpen = root.hasAttribute("data-prep-shop-open");
  const overSidebar = isPointerOverShopDrawer(clientX, clientY)
    || isPointerOverBenchPopoverPanel(clientX, clientY)
    || isPointerOverShopPopoverPanel(clientX, clientY);
  const targetsBoard = dragActive
    && !overSidebar
    && (root.hasAttribute("data-prep-shop-open") || benchOpen || shopOpen);
  root.toggleAttribute("data-prep-drag-targets-board", targetsBoard);
}

function isPointerOverCombatFeed(clientX, clientY) {
  if (clientX == null || clientY == null) return false;
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit) return false;
  return !!hit.closest(
    "#combat-feed-dock, #combat-feed-panel, #combat-feed-scroll, .combat-feed-msg-text--hinted",
  );
}

function markCombatFeedTooltipActive() {
  sidebarTooltipSource = "combat-feed";
  fieldTooltipVisible = false;
  tooltipItem = null;
}

function clearCombatFeedTooltipActive() {
  if (sidebarTooltipSource === "combat-feed") sidebarTooltipSource = null;
}

function getShopTooltipAnchorY() {
  const slots = document.getElementById("shop-slots");
  const panel = document.getElementById("shop-panel");
  const el = slots || panel;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return rect.top + rect.height * 0.42;
}

function getBenchTooltipAnchorY() {
  const slots = document.getElementById("bench-slots");
  const panel = document.getElementById("bench-panel");
  const el = slots || panel;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return rect.top + rect.height * 0.38;
}

function getTooltipCorridorBounds(margin = 10, gap = 14) {
  const canvasRect = document.getElementById("game-canvas")?.getBoundingClientRect();
  const shopRect = document.getElementById("shop-panel")?.getBoundingClientRect();
  const vv = window.visualViewport;
  const viewTop = (vv?.offsetTop ?? 0) + margin;
  const viewBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - margin;

  if (!canvasRect || !shopRect) return null;

  const left = canvasRect.right + gap;
  const right = shopRect.left - gap;
  if (right - left < 72) return null;

  return { left, right, top: viewTop, bottom: viewBottom };
}

function positionTooltipInCorridor(tipW, tipH, margin, gap, options = {}) {
  const {
    hAnchor = "left",
    hFraction = 0.55,
    clientY = 0,
    verticalBias = 0.42,
    anchorY = null,
  } = options;

  const corridor = getTooltipCorridorBounds(margin, gap);
  if (!corridor) return null;

  const corridorW = corridor.right - corridor.left;
  let left;

  if (hAnchor === "center") {
    const centerX = corridor.left + corridorW * hFraction;
    left = centerX - tipW / 2;
    left = Math.max(corridor.left, Math.min(left, corridor.right - tipW));
  } else {
    left = corridor.left;
    if (left + tipW > corridor.right) {
      left = Math.max(corridor.left, corridor.right - tipW);
    }
  }

  const refY = anchorY ?? clientY;
  let top = refY - tipH * verticalBias;
  top = Math.max(corridor.top, Math.min(top, corridor.bottom - tipH));
  return { left, top };
}

function getCorridorTooltipPosition(placement, clientX, clientY, tipW, tipH, margin, gap) {
  if (placement === "field") {
    return positionTooltipInCorridor(tipW, tipH, margin, gap, {
      hAnchor: "left",
      clientY,
      verticalBias: 0.42,
    });
  }
  if (placement === "shop") {
    return positionTooltipInCorridor(tipW, tipH, margin, gap, {
      hAnchor: "center",
      hFraction: 0.58,
      anchorY: getShopTooltipAnchorY(),
      clientY,
      verticalBias: 0.36,
    });
  }
  if (placement === "bench") {
    return positionTooltipInCorridor(tipW, tipH, margin, gap, {
      hAnchor: "center",
      hFraction: 0.58,
      anchorY: getBenchTooltipAnchorY(),
      clientY,
      verticalBias: 0.4,
    });
  }
  if (placement === "doll") {
    return positionTooltipInCorridor(tipW, tipH, margin, gap, {
      hAnchor: "left",
      clientY,
      verticalBias: 0.42,
    });
  }
  if (placement === "inventory") {
    return null;
  }
  return null;
}

function positionHeroHudTooltip(clientX, clientY, tipW, tipH, margin, gap) {
  const vv = window.visualViewport;
  const viewLeft = (vv?.offsetLeft ?? 0) + margin;
  const viewTop = (vv?.offsetTop ?? 0) + margin;
  const viewRight = viewLeft + (vv?.width ?? window.innerWidth) - margin * 2;
  const viewBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - margin;

  let left = clientX - tipW / 2;
  let top = clientY + gap;
  if (top + tipH > viewBottom) top = clientY - tipH - gap;
  top = Math.max(viewTop, Math.min(top, viewBottom - tipH));
  left = Math.max(viewLeft, Math.min(left, viewRight - tipW));
  return { left, top };
}

function positionSidebarTooltip(clientX, clientY, boundsKind = "viewport", placement = "auto") {
  const el = document.getElementById("sidebar-tooltip");
  const dock = document.getElementById("prep-tooltip-dock");
  if (!el || el.classList.contains("hidden")) return;

  if (shouldUsePrepTooltipDock(placement)) {
    el.classList.remove("sidebar-tooltip--floating");
    setPrepTooltipDockPassthrough(false);
    positionPrepTooltipDock();
    el.style.left = "";
    el.style.top = "";
    el.style.right = "";
    el.style.bottom = "";
    el.style.visibility = "";
    el.style.position = "";
    el.style.zIndex = "";
    syncPrepTooltipDockVisibility();
    return;
  }

  el.classList.add("sidebar-tooltip--floating");
  setPrepTooltipDockPassthrough(true);

  const bounds = getTooltipBounds(boundsKind);
  const margin = 10;
  const gap = 14;

  el.style.visibility = "hidden";
  el.style.left = "-9999px";
  el.style.top = "0";
  const tipW = el.offsetWidth;
  const tipH = el.offsetHeight;

  let left;
  let top;

  if (placement === "enhancement" || placement === "companion") {
    const heroHudPos = positionHeroHudTooltip(clientX, clientY, tipW, tipH, margin, gap);
    left = heroHudPos.left;
    top = heroHudPos.top;
  } else if (placement === "shop" || placement === "bench" || placement === "field" || placement === "doll" || placement === "inventory") {
    const corridorPos = getCorridorTooltipPosition(placement, clientX, clientY, tipW, tipH, margin, gap);
    if (corridorPos) {
      left = corridorPos.left;
      top = corridorPos.top;
    } else if (placement === "field") {
      const vv = window.visualViewport;
      const viewRight = (vv?.offsetLeft ?? 0) + (vv?.width ?? window.innerWidth) - margin;
      const viewTop = (vv?.offsetTop ?? 0) + margin;
      const viewBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - margin;
      left = viewRight - tipW;
      top = Math.max(viewTop, Math.min(clientY - tipH * 0.42, viewBottom - tipH));
    } else if (placement === "inventory") {
      left = clientX - tipW / 2;
      top = clientY - tipH - gap;
      top = Math.max(bounds.top + margin, Math.min(top, bounds.bottom - tipH - margin));
      left = Math.max(bounds.left + margin, Math.min(left, bounds.right - tipW - margin));
    } else {
      const bias = placement === "bench" ? 0.58 : 0.42;
      left = clientX - tipW - gap;
      top = clientY - tipH * bias;
      top = Math.max(bounds.top + margin, Math.min(top, bounds.bottom - tipH - margin));
      left = Math.max(bounds.left + margin, Math.min(left, bounds.right - tipW - margin));
    }
  } else {
    const spaceRight = bounds.right - clientX - margin;
    const spaceLeft = clientX - bounds.left - margin;
    const preferRight = spaceRight >= spaceLeft;

    if (preferRight && spaceRight >= Math.min(tipW, 120)) {
      left = clientX + gap;
    } else if (spaceLeft >= Math.min(tipW, 120)) {
      left = clientX - tipW - gap;
    } else if (spaceRight >= spaceLeft) {
      left = clientX + gap;
    } else {
      left = clientX - tipW - gap;
    }

    top = clientY - tipH * 0.35;
    top = Math.max(bounds.top + margin, Math.min(top, bounds.bottom - tipH - margin));
    left = Math.max(bounds.left + margin, Math.min(left, bounds.right - tipW - margin));
  }

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.visibility = "";
}

function syncFieldTooltip() {
  try {
    if (!tooltipItem || dragPayload) {
      if (fieldTooltipVisible && sidebarTooltipSource !== "combat-feed") {
        hideSidebarTooltip();
      }
      return;
    }

    if (sidebarTooltipSource === "combat-feed") {
      clearCombatFeedTooltipActive();
    }

    sidebarTooltipSource = "field";
    sidebarTooltipPinned = false;
    const { itemId, x, y, contentItem, rotation } = tooltipItem;
    const el = document.getElementById("sidebar-tooltip");
    const def = ITEM_CATALOG[itemId];
    if (!el || !def) return;

    el.classList.remove("synergy-tooltip");
    const lines = buildItemTooltipLines(def, contentItem, rotation || 0, "field");
    applySidebarTooltipCard(el, lines, getItemTooltipCardOptions(def, "field"));
    el.classList.remove("hidden");
    fieldTooltipVisible = true;

    const client = canvasPointToClient(x, y);
    if (!client) return;
    positionSidebarTooltip(client.x, client.y, "field", "field");
  } catch (err) {
    console.error("syncFieldTooltip failed:", err);
    tooltipItem = null;
    hideSidebarTooltip();
  }
}

function roundRect(x, y, w, h, r, targetCtx = ctx) {
  targetCtx.beginPath();
  targetCtx.moveTo(x + r, y);
  targetCtx.lineTo(x + w - r, y);
  targetCtx.quadraticCurveTo(x + w, y, x + w, y + r);
  targetCtx.lineTo(x + w, y + h - r);
  targetCtx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  targetCtx.lineTo(x + r, y + h);
  targetCtx.quadraticCurveTo(x, y + h, x, y + h - r);
  targetCtx.lineTo(x, y + r);
  targetCtx.quadraticCurveTo(x, y, x + r, y);
  targetCtx.closePath();
}


function findItemAtCanvasPoint(mx, my, items, team = "player") {
  const col = xToCol(mx, team);
  const row = yToRow(my, team);
  const exact = findItemAtSlot(items, col, row);
  if (exact) return exact;
  if (!isTouchUi()) return null;

  const stride = gridStrideFor(team);
  const pad = TOOLTIP_CONFIG.touchPadding;
  const searchRadius = Math.ceil(pad / stride) + 1;
  let best = null;
  let bestDist = Infinity;

  items.forEach((item) => {
    getItemCells(item).forEach(([c, r]) => {
      if (Math.abs(c - col) > searchRadius || Math.abs(r - row) > searchRadius) return;
      const rect = cellRect(team, c, r);
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      const dist = Math.hypot(mx - cx, my - cy);
      const maxDist = Math.max(rect.w, rect.h) / 2 + pad;
      if (dist <= maxDist && dist < bestDist) {
        bestDist = dist;
        best = item;
      }
    });
  });

  return best;
}

function findContainerAtCanvasPoint(mx, my, containers, team = "player") {
  const col = xToCol(mx, team);
  const row = yToRow(my, team);
  const exact = findContainerAtCell(containers, col, row);
  if (exact) return exact;
  if (!isTouchUi()) return null;

  const stride = gridStrideFor(team);
  const pad = TOOLTIP_CONFIG.touchPadding;
  const searchRadius = Math.ceil(pad / stride) + 1;
  let best = null;
  let bestDist = Infinity;

  containers.forEach((container) => {
    getItemCells(container).forEach(([c, r]) => {
      if (Math.abs(c - col) > searchRadius || Math.abs(r - row) > searchRadius) return;
      const rect = cellRect(team, c, r);
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      const dist = Math.hypot(mx - cx, my - cy);
      const maxDist = Math.max(rect.w, rect.h) / 2 + pad;
      if (dist <= maxDist && dist < bestDist) {
        bestDist = dist;
        best = container;
      }
    });
  });

  return best;
}

function hitTest(mx, my) {
  let side = prepViewSide;
  if (isLobby2pMode() && phase === "prep" && lobbyState?.isSplitLobby && !lobby2pHasActiveDuel()) {
    side = mx < GRID_INNER_W + GRID_GAP / 2 ? "player" : "enemy";
  }
  if (!canEditPrepSide(side)) return null;
  if (isOnBoard(mx, my, side) && isLoadoutInteractionPhase()) {
    const st = getLoadoutEditState(side);
    const col = xToCol(mx, side);
    const row = yToRow(my, side);
    if (!isSlotCell(st.containers, col, row)) {
      return { zone: "board", col, row, side };
    }
    const item = findItemAtCanvasPoint(mx, my, st.items, side);
    return {
      zone: "slot",
      col,
      row,
      side,
      item,
      container: findContainerAtCell(st.containers, col, row)
        || findContainerAtCanvasPoint(mx, my, st.containers, side),
    };
  }
  return null;
}

function onGlobalMouseMove(e) {
  if (!canvas) return;
  updatePointerFromClient(e.clientX, e.clientY);
}

function getTooltipBoardSources() {
  if ((phase === "battle" || phase === "replay") && battleState) {
    return {
      playerItems: battleState.player.items,
      enemyItems: battleState.enemy.items,
      playerContainers: null,
      enemyContainers: null,
    };
  }
  if (phase === "prep") {
    return {
      playerItems,
      enemyItems,
      playerContainers,
      enemyContainers,
    };
  }
  return null;
}

function isPointerOverBattleInventoryPopover(clientX, clientY) {
  if (clientX == null || clientY == null) return false;
  const hit = document.elementFromPoint(clientX, clientY);
  return !!hit?.closest?.(".battle-inventory-popover");
}

function updateTooltip(mx, my) {
  if (isPointerOverCombatFeed(lastPointerClient.x, lastPointerClient.y)) {
    return;
  }
  if (isPointerOverBattleInventoryPopover(lastPointerClient.x, lastPointerClient.y)) {
    return;
  }

  if (sidebarTooltipSource === "combat-feed" && typeof CombatLog?.hideTooltip === "function") {
    CombatLog.hideTooltip();
  }

  if (dragPayload) {
    tooltipItem = null;
    syncFieldTooltip();
    return;
  }

  const sidebarEl = document.getElementById("sidebar-tooltip");
  const sidebarHoverActive = sidebarEl
    && !sidebarEl.classList.contains("hidden")
    && (sidebarTooltipSource === "shop" || sidebarTooltipSource === "bench"
      || sidebarTooltipSource === "combat-feed" || sidebarTooltipSource === "doll"
      || sidebarTooltipSource === "inventory");
  if (sidebarHoverActive) {
    return;
  }

  const sources = getTooltipBoardSources();
  if (!sources) {
    tooltipItem = null;
    syncFieldTooltip();
    return;
  }

  if (phase === "prep") {
    const side = prepViewSide;
    if (isOnBoard(mx, my, side)) {
      const col = xToCol(mx, side);
      const row = yToRow(my, side);
      const items = side === "player" ? sources.playerItems : sources.enemyItems;
      const containers = side === "player" ? sources.playerContainers : sources.enemyContainers;
      const item = findItemAtCanvasPoint(mx, my, items, side);
      if (item) {
        tooltipItem = { itemId: item.itemId, x: mx, y: my, contentItem: item };
        syncFieldTooltip();
        return;
      }
      if (containers) {
        const container = findContainerAtCanvasPoint(mx, my, containers, side);
        if (container) {
          tooltipItem = { itemId: container.itemId, x: mx, y: my, rotation: container.rotation || 0 };
          syncFieldTooltip();
          return;
        }
      }
    }
    tooltipItem = null;
    syncFieldTooltip();
    return;
  }

  if (isOnBoard(mx, my, "player")) {
    const col = xToCol(mx, "player");
    const row = yToRow(my, "player");
    const item = findItemAtCanvasPoint(mx, my, sources.playerItems, "player");
    if (item) {
      tooltipItem = { itemId: item.itemId, x: mx, y: my, contentItem: item };
      syncFieldTooltip();
      return;
    }
    if (sources.playerContainers) {
      const container = findContainerAtCanvasPoint(mx, my, sources.playerContainers, "player");
      if (container) {
        tooltipItem = { itemId: container.itemId, x: mx, y: my, rotation: container.rotation || 0 };
        syncFieldTooltip();
        return;
      }
    }
  }

  if (isOnBoard(mx, my, "enemy")) {
    const col = xToCol(mx, "enemy");
    const row = yToRow(my, "enemy");
    const item = findItemAtCanvasPoint(mx, my, sources.enemyItems, "enemy");
    if (item) {
      tooltipItem = { itemId: item.itemId, x: mx, y: my, contentItem: item };
      syncFieldTooltip();
      return;
    }
    if (sources.enemyContainers) {
      const container = findContainerAtCanvasPoint(mx, my, sources.enemyContainers, "enemy");
      if (container) {
        tooltipItem = { itemId: container.itemId, x: mx, y: my, rotation: container.rotation || 0 };
        syncFieldTooltip();
        return;
      }
    }
  }

  tooltipItem = null;
  syncFieldTooltip();
}

function showSidebarTooltipAt(clientX, clientY, itemId, contentItem, context = "shop", sourceEl = null, options = {}) {
  if (shouldSuppressTooltipReshow(sourceEl)) return;
  if (typeof isEnhancementBackpackItem === "function" && isEnhancementBackpackItem(itemId)) {
    const def = typeof getEnhancementDef === "function" ? getEnhancementDef(getEnhancementIdFromItem(itemId)) : null;
    if (def) {
      showEnhancementTooltipAt(clientX, clientY, def, context, sourceEl, options);
      return;
    }
  }
  const el = document.getElementById("sidebar-tooltip");
  const def = ITEM_CATALOG[itemId];
  if (!el || !def) return;
  cancelScheduledTooltipHide();
  sidebarTooltipPinned = !!options.pinned;
  sidebarTooltipSource = context;
  if (typeof syncDomSparkleFromTooltipSource === "function") {
    syncDomSparkleFromTooltipSource(sourceEl);
  }
  tooltipItem = null;
  fieldTooltipVisible = false;
  el.classList.remove("synergy-tooltip");
  if (sourceEl?.dataset?.unaffordable) {
    const sideGold = getSideState(prepViewSide).gold;
    applySidebarTooltipCard(el, [
      { text: "Недостаточно золота", style: "title", color: "#f85149" },
      { text: `${def.cost}💰 · у вас ${sideGold}💰`, style: "sub", color: "#8b949e" },
    ], getItemTooltipCardOptions(def, context));
  } else {
    const lines = buildItemTooltipLines(def, contentItem, 0, context);
    applySidebarTooltipCard(el, lines, getItemTooltipCardOptions(def, context));
  }
  el.classList.remove("hidden");
  syncPrepTooltipDockVisibility();
  const boundsKind = context === "shop" ? "shop"
    : context === "bench" ? "bench"
      : context === "field" || context === "inventory" ? "field"
        : "viewport";
  positionSidebarTooltip(clientX, clientY, boundsKind, context);
  if (shouldUsePrepTooltipDock(context)) {
    requestAnimationFrame(() => {
      positionPrepTooltipDock();
      syncPrepTooltipDockVisibility();
    });
  }
}

function showSidebarTooltip(e, itemId, contentItem, context = "shop") {
  showSidebarTooltipAt(e.clientX, e.clientY, itemId, contentItem, context, e.currentTarget);
}

function moveSidebarTooltip(e, boundsKind = "viewport", placement = "auto") {
  if (shouldUsePrepTooltipDock(placement)) {
    positionPrepTooltipDock();
    syncPrepTooltipDockVisibility();
    return;
  }
  positionSidebarTooltip(e.clientX, e.clientY, boundsKind, placement);
}

function bindPointerTapTooltip(el, onTapAt) {
  if (!el || el.dataset.pointerTapTooltipBound === "1") return;
  el.dataset.pointerTapTooltipBound = "1";
  let activePointer = null;
  const captureOpts = { capture: true };

  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    activePointer = e.pointerId;
    const shownNow = armPointerTapTooltip(
      e.clientX,
      e.clientY,
      () => onTapAt(e.clientX, e.clientY),
      { pointerType: e.pointerType, allowMouse: true },
    );
    if (shownNow) activePointer = null;
  }, captureOpts);
  el.addEventListener("pointerup", (e) => {
    if (activePointer == null || e.pointerId !== activePointer) return;
    activePointer = null;
    if (isTouchLikePointerType(e.pointerType)) return;
    finishTouchTapGesture(e.clientX, e.clientY);
  }, captureOpts);
  el.addEventListener("pointercancel", () => {
    activePointer = null;
    clearTouchTapGesture();
  }, captureOpts);
}

function tryShowPrepPointerTapTooltip(clientX, clientY) {
  if (!isTouchUi() || phase !== "prep" || gameOver || !prepTooltipsEnabled) return false;
  if (dragPayload || shopDidDrag) return false;

  const tip = document.getElementById("sidebar-tooltip");
  const tipAlreadyVisible = tip && !tip.classList.contains("hidden") && sidebarTooltipPinned;

  if (pendingShopDrag) {
    const dx = clientX - pendingShopDrag.startX;
    const dy = clientY - pendingShopDrag.startY;
    if (Math.hypot(dx, dy) < getPrepDragCommitThresholdPx()) {
      const { index, side } = pendingShopDrag;
      const st = getSideState(side);
      const entry = st.shop[index];
      const card = document.querySelector(`.shop-card[data-index="${index}"]`);
      if (entry && card && !card.classList.contains("empty")) {
        pendingShopDrag = null;
        syncUiDragState();
        if (tipAlreadyVisible && sidebarTooltipSource === "shop") return true;
        showSidebarTooltipAt(clientX, clientY, entry, null, "shop", card, { pinned: true });
        return true;
      }
    }
  }

  if (pendingBenchDrag) {
    const dx = clientX - pendingBenchDrag.startX;
    const dy = clientY - pendingBenchDrag.startY;
    if (Math.hypot(dx, dy) < getPrepDragCommitThresholdPx()) {
      const { index, side } = pendingBenchDrag;
      const st = getSideState(side);
      const entry = st.bench[index];
      const card = document.querySelectorAll("#bench-slots .bench-card")[index];
      if (entry && card && !card.classList.contains("empty")) {
        pendingBenchDrag = null;
        syncUiDragState();
        if (tipAlreadyVisible && sidebarTooltipSource === "bench") return true;
        showSidebarTooltipAt(clientX, clientY, entry.itemId, entry, "bench", card, { pinned: true });
        return true;
      }
    }
  }

  if (pendingCanvasPick) {
    const dx = clientX - pendingCanvasPick.clientX;
    const dy = clientY - pendingCanvasPick.clientY;
    if (Math.hypot(dx, dy) < getPrepDragCommitThresholdPx()) {
      pendingCanvasPick = null;
      updatePointerFromClient(clientX, clientY);
      updateTooltip(mousePos.x, mousePos.y);
      return true;
    }
  }

  return false;
}

function bindItemTooltipEvents(el, itemId, contentItem, context = "shop") {
  if (!itemId || !el) return;
  const boundsKind = context === "shop" ? "shop"
    : context === "bench" ? "bench"
      : context === "field" ? "field"
        : context === "inventory" ? "viewport"
          : "viewport";
  const refresh = (e) => {
    if (!prepTooltipsEnabled) return;
    const liveItemId = el.dataset.itemId || itemId;
    if (!liveItemId) return;
    showSidebarTooltip(e, liveItemId, contentItem, context);
  };

  el.addEventListener("mouseenter", (e) => {
    if (isSyntheticMouseFromTouch()) return;
    cancelScheduledTooltipHide();
    refresh(e);
  });
  el.addEventListener("mousemove", (e) => {
    if (isSyntheticMouseFromTouch()) return;
    cancelScheduledTooltipHide();
    refresh(e);
    moveSidebarTooltip(e, boundsKind, context);
  });
  el.addEventListener("mouseleave", requestHideSidebarTooltip);

  bindPointerTapTooltip(el, (clientX, clientY) => {
    if (!prepTooltipsEnabled) return;
    const liveItemId = el.dataset.itemId || itemId;
    if (!liveItemId) return;
    showSidebarTooltipAt(clientX, clientY, liveItemId, contentItem, context, el, { pinned: true });
  });

  if (context === "shop" || context === "bench" || context === "field" || context === "inventory") {
    el.style.cursor = "help";
  }
  if (typeof bindItemEmojiSparklePointer === "function") {
    bindItemEmojiSparklePointer(el);
  }
}

function onMouseDown(e) {
  if (!isLoadoutInteractionPhase() || gameOver) return;
  if (isLobby2pMode() && phase === "prep" && lobbyState?.isSplitLobby && !lobby2pHasActiveDuel()) {
    const { x: mx } = canvasCoordsFromEvent(e);
    const targetSide = mx < GRID_INNER_W + GRID_GAP / 2 ? "player" : "enemy";
    if (targetSide !== prepViewSide && canEditPrepSide(targetSide)) {
      setLobby2pActiveHuman(targetSide === "player" ? 0 : 1);
    }
  }
  if (!canEditPrepSide()) return;
  const side = prepViewSide;
  const st = getLoadoutEditState(side);
  const { x: mx, y: my } = canvasCoordsFromEvent(e);
  const hit = hitTest(mx, my);

  if (hit?.zone === "slot" && hit.item) {
    e.preventDefault();
    selectedBench = -1;
    dragPayload = { itemId: hit.item.itemId, rotation: hit.item.rotation || 0 };
    dragFrom = { type: "item", item: hit.item, side };
    st.items = st.items.filter((i) => i.uid !== hit.item.uid);
    beginPrepDragArcFromBackpack(hit.item.col, hit.item.row, side);
    startSynergyPreview();
    recalcSynergies();
    syncUiDragState();
    if (typeof onPrepDragStart === "function") onPrepDragStart();
    syncDragGhostOverlay(e.clientX, e.clientY);
  } else if (hit?.zone === "slot" && hit.container && !hit.item && !ITEM_CATALOG[hit.container.itemId].immovable) {
    e.preventDefault();
    selectedBench = -1;
    const carriedItems = getItemsTouchingContainer(st.items, hit.container);
    dragPayload = { itemId: hit.container.itemId, rotation: hit.container.rotation || 0 };
    dragFrom = { type: "container", container: hit.container, carriedItems, side };
    st.containers = st.containers.filter((c) => c.uid !== hit.container.uid);
    st.items = st.items.filter((i) => !carriedItems.some((c) => c.uid === i.uid));
    beginPrepDragArcFromBackpack(hit.container.col, hit.container.row, side);
    startSynergyPreview();
    recalcSynergies();
    syncUiDragState();
    if (typeof onPrepDragStart === "function") onPrepDragStart();
    syncDragGhostOverlay(e.clientX, e.clientY);
  }
}

function tryGemSocketDrop(st, dragFrom, dragPayload, col, row, side) {
  if (!isGemItem(dragPayload.itemId)) return false;
  const excludeUid = isPrepLoadoutItemDrag() ? dragFrom.item.uid : null;
  const host = findSocketHostAt(st.items, col, row, dragPayload.itemId, excludeUid);
  if (!host) return false;

  let gemId = dragPayload.itemId;
  let purchasedGemId = null;

  if (dragFrom.type === "shop") {
    // Покупку откладываем до успешной вставки в сокет.
    purchasedGemId = dragFrom.index;
  } else if (dragFrom.type === "item" || dragFrom.type === "enhancement") {
    st.items = st.items.filter((i) => i.uid !== dragFrom.item.uid);
  }

  const hostIdx = st.items.findIndex((i) => i.uid === host.uid);
  if (hostIdx < 0) return false;
  if (dragFrom.type === "shop") {
    const bought = commitShopPurchase(purchasedGemId, side);
    if (!bought) return false;
    gemId = bought;
  }
  const socketed = socketGemIntoItem(st.items[hostIdx], gemId);
  if (!socketed) return false;

  st.items[hostIdx] = socketed;
  const gemName = ITEM_CATALOG[gemId]?.name || gemId;
  const hostName = ITEM_CATALOG[host.itemId]?.name || host.itemId;
  log(`💎 ${gemName} вставлен в ${hostName}`);
  playPrepSfx("prep_gem");
  if (side === prepViewSide && typeof CombatLog !== "undefined") {
    CombatLog.notifyGemSocketed(gemId, host.itemId);
  }
  return true;
}

function drawItemSocketMarkers(ctx, item, def, team, cellRectFn) {
  if (typeof drawItemSocketVisuals === "function") {
    drawItemSocketVisuals(ctx, item, def, cellRectFn);
    return;
  }
  const count = getItemSocketCount(item.itemId);
  if (!count) return;
  const normalized = ensureSocketArray(item);
  const cells = getItemCells(item);
  const cols = cells.map(([c]) => c);
  const rows = cells.map(([, r]) => r);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  const maxRow = Math.max(...rows);

  for (let i = 0; i < count; i++) {
    const col = count === 1
      ? Math.round((minCol + maxCol) / 2)
      : Math.round(minCol + ((maxCol - minCol) * i) / Math.max(1, count - 1));
    const rect = cellRectFn(col, maxRow);
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h - 6;
    const gemId = normalized.socketedGems[i];
    const filled = !!gemId;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = filled ? `${ITEM_CATALOG[gemId]?.color || "#d2a8ff"}cc` : "rgba(255,255,255,0.18)";
    ctx.fill();
    ctx.strokeStyle = filled ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (filled && ITEM_CATALOG[gemId]) {
      drawCellEmojiAt(ctx, getItemIcons(ITEM_CATALOG[gemId])[0], cx, cy, 10);
    }
    ctx.restore();
  }
}

function finishDragDrop(e) {
  pendingShopDrag = null;
  pendingBenchDrag = null;
  if (!dragPayload || !dragFrom) {
    clearDragUiState();
    return;
  }

  const shopPurchasedDuringDrop = dragFrom.type === "shop";
  const commerceSide = dragFrom.side || prepViewSide;

  let prepArcCelebrate = false;
  const dropE = createDropPointerEvent(e);
  const { x: dropClientX, y: dropClientY } = getDropPointerClient(e);

  const side = dragFrom.side || prepViewSide;
  const st = getLoadoutEditState(side);

  if (dragPayload) {
    syncPrepDragBoardHover(dropClientX, dropClientY, dropClientX, dropClientY);
    if (isPrepSidebarArcDrag()) {
      const projected = projectClientPointToPrepBackpack(dropClientX, dropClientY);
      if (projected) applyPrepSidebarCorridorHover(projected, side, st);
    }
  }
  if (!canEditPrepSide(side)) {
    restoreDraggedItem(side);
    notifyPrepDragRejectedFromDragFrom();
    clearDragUiState();
    return;
  }

  const dropOnSell = isDropOnSell(dropE);
  const pointerOnBench = isDropOnBench(dropE);
  const sidebarPlacement = isPrepSidebarArcDrag() && !pointerOnBench
    ? getPrepDropPlacement(st, side)
    : null;
  const dropBackToShop = isPrepSidebarArcDrag()
    && isPointerInsideShopDrawerBounds(dropClientX, dropClientY)
    && !hasPrepBoardDropTarget()
    && !sidebarPlacement?.valid;
  const { x: mx, y: my } = canvasCoordsFromClient(dropClientX, dropClientY);
  const onBoard = isOnBoard(mx, my, side);
  const boardCol = onBoard ? xToCol(mx, side) : null;
  const boardRow = onBoard ? yToRow(my, side) : null;
  const dropCol = pointerOnBench ? null : (sidebarPlacement?.col ?? boardCol);
  const dropRow = pointerOnBench ? null : (sidebarPlacement?.row ?? boardRow);
  const hasDropCell = dropCol != null && dropRow != null;
  const onBackpackSlot = hasDropCell && isSlotCell(st.containers, dropCol, dropRow);
  const dropOnBench = pointerOnBench;

  if (typeof tryFinishDragOnDoll === "function" && tryFinishDragOnDoll(dropE)) {
    clearDragUiState();
    if (canEditPrepSide(side)) applyCraftingForSide(side);
    renderBench();
    recalcSynergies();
    updateUI();
    return;
  }

  if (dropOnSell && sellDraggedItem(side)) {
    if (isPrepBackpackArcDrag()) prepArcCelebrate = true;
    clearDragUiState();
    renderBench();
    recalcSynergies();
    updateUI();
    return;
  }

  if (dropOnSell) {
    restoreDraggedItem(side);
    notifyPrepDragRejectedFromDragFrom();
    clearDragUiState();
    renderBench();
    recalcSynergies();
    updateUI();
    return;
  }

  if (dropBackToShop) {
    // Пользователь передумал: вернул предмет в зону магазина — отменяем hold.
    restoreDraggedItem(side);
    clearDragUiState();
    renderBench();
    recalcSynergies();
    updateUI();
    return;
  }

  if (dropOnBench) {
    if (dragFrom.type === "shop") {
      if (st.bench.length < MAX_BENCH) {
        const itemId = commitShopPurchase(dragFrom.index, side);
        if (itemId) {
          st.bench.push({
            itemId,
            uid: `bench-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            rotation: dragPayload.rotation || 0,
          });
          prepArcCelebrate = true;
        }
      } else {
        log("Скамейка полна!");
      }
    } else if (dragFrom.type === "item" || dragFrom.type === "enhancement") {
      st.bench.push({ itemId: dragFrom.item.itemId, uid: dragFrom.item.uid, rotation: dragPayload.rotation || 0 });
      prepArcCelebrate = true;
      if (dragFrom.type === "enhancement") syncEnhancementsForSide(side);
    } else if (dragFrom.type === "container") {
      st.bench.push({
        itemId: dragFrom.container.itemId,
        uid: dragFrom.container.uid,
        rotation: dragPayload.rotation || 0,
        carriedItems: dragFrom.carriedItems,
        originCol: dragFrom.container.col,
        originRow: dragFrom.container.row,
      });
      prepArcCelebrate = true;
    }
  } else if (isContainerItem(dragPayload.itemId) && hasDropCell) {
    const col = dropCol;
    const row = dropRow;
    const excludeUid = dragFrom.type === "container" ? dragFrom.container.uid : null;
    const canMove = dragFrom.type === "container"
      ? canMoveContainerWithItems(
        dragFrom.container,
        col,
        row,
        st.containers,
        st.items,
        excludeUid,
        getActiveGridCols(),
        getActiveGridRows(),
      )
      : canPlaceContainer(
        dragPayload.itemId,
        col,
        row,
        dragPayload.rotation || 0,
        getActiveGridCols(),
        getActiveGridRows(),
        st.containers,
        excludeUid,
        st.items,
      );

    if (canMove) {
      if (dragFrom.type === "bench") {
        const benchEntry = dragFrom.benchEntry;
        commitBenchDragEntry(dragFrom);
        const placed = createContainer(dragPayload.itemId, col, row, dragPayload.rotation || 0);
        st.containers = [...st.containers, placed];
        (benchEntry?.carriedItems || []).forEach((item) => {
          const dCol = col - (benchEntry.originCol ?? col);
          const dRow = row - (benchEntry.originRow ?? row);
          st.items = [...st.items, { ...item, col: item.col + dCol, row: item.row + dRow }];
        });
        prepArcCelebrate = true;
      } else if (dragFrom.type === "shop") {
        const itemId = commitShopPurchase(dragFrom.index, side);
        if (itemId) {
          const placed = createContainer(itemId, col, row, dragPayload.rotation || 0);
          st.containers = [...st.containers, placed];
          prepArcCelebrate = true;
        }
      } else {
        const placed = createContainer(dragPayload.itemId, col, row, dragPayload.rotation || 0);
        if (dragFrom.type === "container") {
          placed.uid = dragFrom.container.uid;
          const dCol = col - dragFrom.container.col;
          const dRow = row - dragFrom.container.row;
          st.containers = [...st.containers, placed];
          st.items = [...st.items, ...dragFrom.carriedItems.map((item) => ({
            ...item,
            col: item.col + dCol,
            row: item.row + dRow,
          }))];
        }
      }
      if (typeof notifyPrepHeavyDrop === "function") {
        notifyPrepHeavyDrop(ITEM_CATALOG[dragPayload.itemId]);
      }
      if (side === prepViewSide && typeof CombatLog !== "undefined" && isShopExpansionContainer(dragPayload.itemId)) {
        CombatLog.notifyBackpack(ITEM_CATALOG[dragPayload.itemId]);
      }
      if (dragFrom.type === "container" && dragFrom.carriedItems?.length) {
        dragFrom.carriedItems.forEach((item) => {
          if (typeof notifyPrepItemPlaced === "function") {
            notifyPrepItemPlaced(item, ITEM_CATALOG[item.itemId]);
          }
        });
      }
    } else if (dragFrom.type === "container") {
      st.containers = [...st.containers, dragFrom.container];
      st.items = [...st.items, ...dragFrom.carriedItems];
      dragFrom.carriedItems?.forEach((item) => {
        if (typeof notifyPrepPlacementRejected === "function") notifyPrepPlacementRejected(item);
      });
    }
  } else if (!isContainerItem(dragPayload.itemId) && hasDropCell) {
    const col = dropCol;
    const row = dropRow;
    if (isSlotCell(st.containers, col, row) && tryGemSocketDrop(st, dragFrom, dragPayload, col, row, side)) {
      commitBenchDragEntry(dragFrom);
      // камень вставлен в сокет
    } else if (isSlotCell(st.containers, col, row)) {
      const excludeUid = isPrepLoadoutItemDrag() ? dragFrom.item.uid : null;
      const placement = resolveLoadoutPlacementDisplacing(
        st.containers,
        dragPayload.itemId,
        col,
        row,
        dragPayload.rotation || 0,
      );
      if (placement.valid) {
        const displaced = getOverlappingLoadoutItems(
          st.items,
          dragPayload.itemId,
          placement.col,
          placement.row,
          placement.rotation,
          excludeUid,
        );
        const displacedUids = displaced.map((item) => item.uid);
        const slotOk = typeof canAddSlotItemToLoadout !== "function"
          || canAddSlotItemToLoadout(st.items, dragPayload.itemId, excludeUid, displacedUids);
        if (st.bench.length + displaced.length > MAX_BENCH) {
          log("Скамейка полна!");
          if (isPrepLoadoutItemDrag()) {
            st.items = [...st.items, dragFrom.item];
            if (typeof notifyPrepPlacementRejected === "function") notifyPrepPlacementRejected(dragFrom.item);
          }
          restoreDraggedItem(side);
          clearDragUiState();
          renderBench();
          recalcSynergies();
          updateUI();
          return;
        }
        if (!slotOk) {
          if (isPrepLoadoutItemDrag()) {
            st.items = [...st.items, dragFrom.item];
            if (typeof notifyPrepPlacementRejected === "function") notifyPrepPlacementRejected(dragFrom.item);
          }
          restoreDraggedItem(side);
          clearDragUiState();
          renderBench();
          recalcSynergies();
          updateUI();
          return;
        }
        let displacedItems = [];
        if (displaced.length) {
          displaced.forEach((existing) => {
            st.items = st.items.filter((i) => i.uid !== existing.uid);
          });
          displacedItems = displaced;
        }
        if (dragFrom.type === "bench") {
          commitBenchDragEntry(dragFrom);
        } else if (dragFrom.type === "shop") {
          const itemId = commitShopPurchase(dragFrom.index, side);
          if (!itemId) {
            clearDragUiState();
            renderBench();
            recalcSynergies();
            updateUI();
            return;
          }
          dragPayload.itemId = itemId;
        }
        if (displacedItems.length) {
          renderBench(side);
          queueDisplaceToBenchAnimations(side, displacedItems, prepViewSide, (item) => {
            const benchState = getSideState(side);
            benchState.bench.push({
              itemId: item.itemId,
              uid: item.uid,
              rotation: item.rotation || 0,
            });
          });
        }
        const placed = createPlacedItem(dragPayload.itemId, placement.col, placement.row, placement.rotation);
        if (isPrepLoadoutItemDrag()) {
          placed.uid = dragFrom.item.uid;
          if (dragFrom.item.socketedGems) placed.socketedGems = [...dragFrom.item.socketedGems];
        }
        st.items = [...st.items, placed];
        dragPayload.rotation = placement.rotation;
        if (typeof notifyPrepItemPlaced === "function") {
          notifyPrepItemPlaced(placed, ITEM_CATALOG[placed.itemId]);
        }
        if (dragFrom.type === "enhancement") syncEnhancementsForSide(side);
        if (dragFrom.type === "shop" || dragFrom.type === "bench" || dragFrom.type === "enhancement") {
          prepArcCelebrate = true;
        }
      } else if (isPrepLoadoutItemDrag()) {
        st.items = [...st.items, dragFrom.item];
        if (typeof notifyPrepPlacementRejected === "function") notifyPrepPlacementRejected(dragFrom.item);
      }
    } else if (isPrepLoadoutItemDrag()) {
      st.items = [...st.items, dragFrom.item];
      if (typeof notifyPrepPlacementRejected === "function") notifyPrepPlacementRejected(dragFrom.item);
    }
  } else if (isPrepLoadoutItemDrag()) {
    st.items = [...st.items, dragFrom.item];
    if (typeof notifyPrepPlacementRejected === "function") notifyPrepPlacementRejected(dragFrom.item);
  } else if (dragFrom.type === "container") {
    st.containers = [...st.containers, dragFrom.container];
    st.items = [...st.items, ...dragFrom.carriedItems];
    dragFrom.carriedItems?.forEach((item) => {
      if (typeof notifyPrepPlacementRejected === "function") notifyPrepPlacementRejected(item);
    });
  }

  if (dragFrom?.type === "bench" && dragFrom.benchEntry) {
    restoreBenchDragEntry(st, dragFrom);
  }

  maybeCelebratePrepArcDrop(prepArcCelebrate);
  clearDragUiState();
  if (shopPurchasedDuringDrop) suppressShopClickUntil = 0;
  if (canEditPrepSide(side)) applyCraftingForSide(side);
  if (typeof hasActiveDisplaceAnimations === "function" && hasActiveDisplaceAnimations(side)) {
    if (shopPurchasedDuringDrop) renderShop(commerceSide);
    recalcSynergies();
    updateUI();
  } else {
    if (shopPurchasedDuringDrop) renderShop(commerceSide);
    renderBench();
    recalcSynergies();
    updateUI();
  }
  if (!dragPayload && !isPointerOverPrepSidebar(lastPointerClient.x, lastPointerClient.y)) {
    if (prepTooltipsEnabled && !isTouchUi()) {
      try { updateTooltip(mousePos.x, mousePos.y); } catch (err) { console.error("updateTooltip failed:", err); }
    } else if (prepTooltipsEnabled && typeof applyGamepadPrepFocusTooltip === "function" && lastGamepadPrepFocus) {
      applyGamepadPrepFocusTooltip(lastGamepadPrepFocus);
    }
  }
}

function beginPendingBenchDrag(index, e, side = prepViewSide) {
  if (phase !== "prep" || gameOver || !canEditPrepSide(side)) return;
  const st = getSideState(side);
  if (!st.bench[index]) return;
  pendingBenchDrag = { index, startX: e.clientX, startY: e.clientY, side };
  syncUiDragState();
}

function updatePendingBenchDrag(e) {
  if (!pendingBenchDrag || dragPayload) return;
  const dx = e.clientX - pendingBenchDrag.startX;
  const dy = e.clientY - pendingBenchDrag.startY;
  if (Math.hypot(dx, dy) < getPrepDragCommitThresholdPx()) return;
  const { index, side } = pendingBenchDrag;
  pendingBenchDrag = null;
  clearTouchTapGesture();
  hideSidebarTooltip();
  startBenchDrag(index, e, side);
}

function updatePendingCanvasPick(clientX, clientY) {
  if (!pendingCanvasPick || dragPayload) return;
  const dx = clientX - pendingCanvasPick.clientX;
  const dy = clientY - pendingCanvasPick.clientY;
  if (Math.hypot(dx, dy) < getPrepDragCommitThresholdPx()) return;
  pendingCanvasPick = null;
  onMouseDown(createSyntheticPointerEvent(clientX, clientY));
}

function tryBuyFromPendingShopDrag(clientX, clientY) {
  if (!pendingShopDrag || dragPayload) return false;
  const dx = clientX - pendingShopDrag.startX;
  const dy = clientY - pendingShopDrag.startY;
  if (Math.hypot(dx, dy) >= getPrepDragCommitThresholdPx()) return false;
  if (isTouchUi()) return false;
  const { index, side } = pendingShopDrag;
  pendingShopDrag = null;
  syncUiDragState();

  const st = getSideState(side);
  const entry = st.shop[index];
  const card = document.querySelector(`.shop-card[data-index="${index}"]`);
  if (!entry || !card || card.classList.contains("empty")) return false;
  showSidebarTooltipAt(clientX, clientY, entry, null, "shop", card, { pinned: true });
  suppressShopClickUntil = Date.now() + 500;
  return true;
}

function beginPendingShopDrag(index, e, side = prepViewSide) {
  if (!isLoadoutInteractionPhase() || gameOver || !canEditPrepSide(side)) return;
  const st = getSideState(side);
  if (!st.shop[index]) return;
  const entryId = st.shop[index];
  const enhMeta = typeof resolveShopEntryMeta === "function" ? resolveShopEntryMeta(entryId) : null;
  const cost = enhMeta?.cost ?? ITEM_CATALOG[entryId]?.cost;
  if (cost == null || st.gold < cost) return;
  e.preventDefault();
  pendingShopDrag = { index, startX: e.clientX, startY: e.clientY, side };
  shopDidDrag = false;
  syncUiDragState();
}

function updatePendingShopDrag(e) {
  if (!pendingShopDrag || dragPayload) return;
  const dx = e.clientX - pendingShopDrag.startX;
  const dy = e.clientY - pendingShopDrag.startY;
  if (Math.hypot(dx, dy) < getPrepDragCommitThresholdPx()) return;
  const { index, side } = pendingShopDrag;
  pendingShopDrag = null;
  clearTouchTapGesture();
  shopDidDrag = true;
  startShopDrag(index, e, side);
}

function beginPrepDragArcFromCard(cardEl, itemIdOverride = null, originOverride = null) {
  if (!isLoadoutInteractionPhase() || typeof PrepDragArc === "undefined") return;
  const c = originOverride || getElementClientCenter(cardEl);
  if (!c) return;
  const itemId = itemIdOverride || cardEl?.dataset?.itemId || dragPayload?.itemId;
  PrepDragArc.begin({ fromX: c.x, fromY: c.y, itemId });
}

function beginPrepDragArcFromBackpack(col, row, side = prepViewSide) {
  if (!isLoadoutInteractionPhase() || typeof PrepDragArc === "undefined") return;
  const c = boardCellClientCenter(col, row, side);
  if (!c) return;
  const st = getLoadoutEditState(side);
  const kind = isContainerItem(dragPayload?.itemId)
    ? "c"
    : (isSlotCell(st.containers, col, row) ? "s" : "c");
  const originPlaceable = isPrepArcPlaceableCell(col, row);
  PrepDragArc.begin({
    fromX: c.x,
    fromY: c.y,
    itemId: dragPayload?.itemId,
    originCol: originPlaceable ? col : null,
    originRow: originPlaceable ? row : null,
    originKind: kind,
  });
}

function startShopDrag(index, e, side = prepViewSide) {
  if (!isLoadoutInteractionPhase() || gameOver || !canEditPrepSide(side)) return;
  const st = getSideState(side);
  if (!st.shop[index]) return;
  const entryId = st.shop[index];
  const enhMeta = typeof resolveShopEntryMeta === "function" ? resolveShopEntryMeta(entryId) : null;
  const cost = enhMeta?.cost ?? ITEM_CATALOG[entryId]?.cost;
  if (cost == null || st.gold < cost) return;
  if (e?.preventDefault) e.preventDefault();
  clearTouchTapGesture();
  hideSidebarTooltip();
  dragPayload = { itemId: entryId, rotation: 0 };
  dragFrom = { type: "shop", index, side };
  prepSidebarDragUnlocked = usesPrepCommercePopoverMode();
  prepSidebarStickyHover = null;
  const cardSel = `.shop-card[data-index="${index}"]`;
  const arcCard = document.querySelector(cardSel);
  const arcOrigin = getElementClientCenter(arcCard)
    || (e?.clientX != null && e?.clientY != null ? { x: e.clientX, y: e.clientY } : null);
  beginPrepDragArcFromCard(arcCard, entryId, arcOrigin);
  startSynergyPreview();
  document.querySelector(cardSel)?.classList.add("shop-dragging");
  syncUiDragState();
  if (typeof onPrepDragStart === "function") onPrepDragStart();
  if (typeof window.resetPrepTouchGesture === "function") window.resetPrepTouchGesture();
  if (e?.clientX != null && e?.clientY != null) {
    lastPointerClient.x = e.clientX;
    lastPointerClient.y = e.clientY;
    syncPrepDragBoardHover(e.clientX, e.clientY, e.clientX, e.clientY);
  }
  syncDragGhostOverlay(lastPointerClient.x, lastPointerClient.y);
}

function startBenchDrag(index, e, side = prepViewSide) {
  const st = getSideState(side);
  if (phase !== "prep" || gameOver || !canEditPrepSide(side) || !st.bench[index]) return;
  e.preventDefault();
  clearTouchTapGesture();
  hideSidebarTooltip();
  const arcCard = document.querySelector(`.bench-card[data-bench="${index}"]`);
  const arcOrigin = getElementClientCenter(arcCard)
    || (e?.clientX != null && e?.clientY != null ? { x: e.clientX, y: e.clientY } : null);
  const benchEntry = takeBenchEntryOnDragStart(st, index);
  if (!benchEntry) return;
  selectedBench = -1;
  document.querySelectorAll("#bench-slots .bench-card").forEach((card) => {
    card.classList.toggle("selected", +card.dataset.bench === index);
  });
  dragPayload = { itemId: benchEntry.itemId, rotation: benchEntry.rotation || 0 };
  dragFrom = { type: "bench", index, side, benchEntry };
  prepSidebarDragUnlocked = usesPrepCommercePopoverMode();
  prepSidebarStickyHover = null;
  renderBench(side);
  beginPrepDragArcFromCard(arcCard, benchEntry.itemId, arcOrigin);
  if (typeof window.resetPrepTouchGesture === "function") window.resetPrepTouchGesture();
  startSynergyPreview();
  syncUiDragState();
  if (typeof onPrepDragStart === "function") onPrepDragStart();
  if (e?.clientX != null && e?.clientY != null) {
    lastPointerClient.x = e.clientX;
    lastPointerClient.y = e.clientY;
    syncPrepDragBoardHover(e.clientX, e.clientY, e.clientX, e.clientY);
  }
  syncDragGhostOverlay(lastPointerClient.x, lastPointerClient.y);
}

function updateUI() {
  renderPlayerProfiles();
  renderRunStats();
  renderLobbyChrome();
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
  if (phase === "prep" && !gameOver) {
    if (isCampaignMode()) syncCampaignChrome();
    else ensureShopReadyForSide(prepViewSide);
    updatePrepSideUI();
    if (isLobby2pMode() && lobbyState?.isSplitLobby) {
      renderLobby2pCommerce();
      syncLobby2pHudDom();
    } else {
      renderShop();
      renderBench();
    }
    renderFightButton();
    if (typeof syncDollUI === "function") syncDollUI(prepViewSide);
    refreshPlayerCharacteristicsPopup(getPlayerCharacteristicsState());
    refreshFighterCharacteristicsPopup(getEnemyCharacteristicsState());
  }
}

  function isPrepHeroCardHud() {
    const root = document.documentElement;
    return root.dataset.prepLayout === "side"
      || root.dataset.uiSurface === "tablet-side"
      || root.dataset.uiSurface === "desktop";
  }

function getPrepHeroCardName(profile) {
  return typeof getNoviceClassLabel === "function"
    ? getNoviceClassLabel(profile?.classId)
    : profile?.className || "Герой";
}

let prepDollBtnHome = null;

function syncPrepHeroCardChrome(side = prepViewSide || "player") {
  const dollBtn = document.getElementById("btn-toggle-doll");
  const layer = document.getElementById("prep-character-layer");
  const viewTag = document.getElementById("prep-hero-card-view-tag");
  if (!dollBtn || !layer) return;

  if (!prepDollBtnHome) prepDollBtnHome = layer;

  if (!layer.contains(dollBtn)) prepDollBtnHome.appendChild(dollBtn);
  dollBtn.classList.remove("btn-toggle-doll--hero-card");
  dollBtn.textContent = "🪆 Экипировка";
  dollBtn.removeAttribute("aria-label");
  dollBtn.title = "";

  if (!viewTag) return;
  viewTag.classList.add("hidden");
  viewTag.innerHTML = "";
  return;
}

function renderPrepStageChrome(playerProfile, enemyProfile) {
  const layer = document.getElementById("prep-character-layer");
  const prepPlayer = document.getElementById("prep-character-player");
  const prepEnemy = document.getElementById("prep-character-enemy");
  const statsHud = document.getElementById("prep-stats-hud");
  const showHeroHud = isPrepHeroHudVisible();
  const battlePrepHero = syncBattlePrepHeroLayerDom();

  const fillChar = (el, profile, chrSide) => {
    if (!el) return;
    if (profile?.classId) el.dataset.class = profile.classId;
    else el.removeAttribute("data-class");
    if (typeof renderPrepCharacterHtml === "function") {
      el.innerHTML = renderPrepCharacterHtml(chrSide, profile, round);
      return;
    }
    if (profile.classIconSrc) {
      el.innerHTML = `<img class="prep-character-img" src="${profile.classIconSrc}" alt="" draggable="false">`;
    } else {
      el.innerHTML = `<span class="prep-character-emoji">${profile.classIcon || "❓"}</span>`;
    }
  };

  if (phase === "prep") {
    if (isLobby2pMode() && lobbyState?.isSplitLobby) {
      layer?.setAttribute("aria-hidden", "true");
      prepPlayer?.setAttribute("hidden", "");
      prepEnemy?.setAttribute("hidden", "");
      if (statsHud) statsHud.innerHTML = "";
      return;
    }
    layer?.setAttribute("aria-hidden", "false");
    fillChar(prepPlayer, playerProfile, "player");
    fillChar(prepEnemy, enemyProfile, "enemy");
    if (prepViewSide === "player") {
      prepPlayer?.removeAttribute("hidden");
      prepEnemy?.setAttribute("hidden", "");
    } else {
      prepEnemy?.removeAttribute("hidden");
      prepPlayer?.setAttribute("hidden", "");
    }
  } else if (battlePrepHero) {
    layer?.setAttribute("aria-hidden", "false");
    fillChar(prepPlayer, playerProfile, "player");
    fillChar(prepEnemy, enemyProfile, "enemy");
    prepPlayer?.removeAttribute("hidden");
    prepEnemy?.removeAttribute("hidden");
    if (typeof scheduleBattleHeroRowSync === "function") scheduleBattleHeroRowSync();
    if (typeof syncPrepBuildEmojiBtn === "function") {
      const playerArchetype = getSideMutationRuntime("player");
      const enemyArchetype = getSideMutationRuntime("enemy");
      const playerProgress = typeof resolveMutationProgress === "function"
        ? resolveMutationProgress({
          classId: playerArchetype.classId,
          companionId: playerArchetype.companionId,
          items: playerArchetype.items,
          enhancements: playerArchetype.enhancements,
          round,
        })
        : null;
      syncPrepBuildEmojiBtn({
        formId: playerProfile?.archetypeFormId ?? playerArchetype.formId,
        mutationId: playerProfile?.archetypeMutationId ?? playerArchetype.mutationId,
        classId: playerArchetype.classId,
        leaderId: playerProgress?.leader?.id,
        round,
        emojiOverride: playerProfile?.archetypeEmoji,
      });
      if (typeof syncBattleEnemyArchetypeFloat === "function") {
        syncBattleEnemyArchetypeFloat({
          profile: enemyProfile,
          formId: enemyProfile?.archetypeFormId ?? enemyArchetype.formId,
          mutationId: enemyProfile?.archetypeMutationId ?? enemyArchetype.mutationId,
          classId: enemyArchetype.classId,
          round,
          emojiOverride: enemyProfile?.archetypeEmoji,
        });
      }
    }
    return;
  } else {
    layer?.setAttribute("aria-hidden", "true");
    prepPlayer?.setAttribute("hidden", "");
    prepEnemy?.setAttribute("hidden", "");
    return;
  }

  if (!showHeroHud && phase !== "prep") return;

  const side = prepViewSide;
  let profile = side === "player" ? playerProfile : enemyProfile;
  let mutRt = getSideMutationRuntime(side);
  const st = getSideState(side);
  const mutationProgress = typeof resolveMutationProgress === "function"
    ? resolveMutationProgress({
      classId: mutRt.classId,
      companionId: mutRt.companionId,
      items: mutRt.items,
      enhancements: mutRt.enhancements,
      round,
    })
    : null;
  const companion = typeof getCompanionById === "function" ? getCompanionById(mutRt.companionId) : null;
  const displayTitle = getRunDisplayTitle(side);
  const heroCardHud = isPrepHeroCardHud();
  const mutationHtml = typeof renderMutationProgressHtml === "function"
    ? renderMutationProgressHtml(mutationProgress, mutRt.formId, mutRt.mutationId, round, { heroCard: heroCardHud })
    : "";
  const enhancementHtml = typeof renderPrepEnhancementStripHtml === "function"
    ? renderPrepEnhancementStripHtml(round, mutRt.enhancements, { heroCard: heroCardHud })
    : "";
  const keyStatusHtml = typeof renderPrepBuildKeyStatusHtml === "function"
    ? renderPrepBuildKeyStatusHtml(mutRt.items)
    : "";
  const ampStatusHtml = typeof renderPrepAmplifierStatusHtml === "function"
    ? renderPrepAmplifierStatusHtml(mutRt.items)
    : "";
  const modifierStripHtml = typeof renderPrepModifierStripHtml === "function"
    ? renderPrepModifierStripHtml(mutRt.items)
    : `${keyStatusHtml}${ampStatusHtml}`;

  if (statsHud) {
    const lobbyPlayer = isLobbyMode() ? getLobbyPlayer(lobbyState) : null;
    const viewedFighter = isLobbyMode() ? getLobbyFighterById(lobbyState, lobbyViewFighterId) : null;
    const roundLabel = isLobbyMode()
      ? `${round}`
      : `${Math.min(round, RUN_BATTLES)}/${RUN_BATTLES}`;
    const hpLabel = viewedFighter
      ? `${viewedFighter.hp}/${LOBBY_START_HP}`
      : lobbyPlayer
        ? `${lobbyPlayer.hp}/${LOBBY_START_HP}`
          : profile.hpDisplay;
    const hpRowClass = lobbyPlayer ? " prep-stats-row--lobby-hp" : "";
    const companionLabel = renderPrepCompanionLabelHtml(companion);
    const heroCardName = getPrepHeroCardName(profile);
    const metricsInBottomBar = heroCardHud;
    const roundCaption = "Раунд";
    const collapsedMetricsHtml = heroCardHud
      ? `
        <div class="hud-character-panel__collapsed-metrics" aria-hidden="true">
          <div class="prep-stats-row"><span>💰</span><b>${st.gold}</b></div>
          <div class="prep-stats-row${hpRowClass}"><span>❤️</span><b>${hpLabel}</b></div>
          <div class="prep-stats-row prep-stats-row--round"><span>${roundCaption}</span><b>${roundLabel}</b></div>
        </div>`
      : "";
    const metricsHtml = metricsInBottomBar
      ? `<div class="prep-stats-row prep-stats-row--companion"><span>${companionLabel}</span></div>`
      : `
        <div class="prep-stats-row prep-stats-row--companion"><span>${companionLabel}</span></div>
        <div class="prep-stats-row"><span>💰</span><b>${st.gold}</b></div>
        <div class="prep-stats-row${hpRowClass}"><span>❤️</span><b>${hpLabel}</b></div>
        <div class="prep-stats-row prep-stats-row--round"><span>Раунд</span><b>${roundLabel}</b></div>`;
    syncPrepBottomStats({
      gold: st.gold,
      hpLabel,
      roundLabel,
      lobbyHp: !!lobbyPlayer,
    });
    const statsHeaderHtml = heroCardHud
      ? `
      <div class="prep-hero-card__stats-row">
        <div class="prep-stats-class">${heroCardName}</div>
        <div class="prep-stats-metrics">
          ${metricsHtml}
        </div>
        ${collapsedMetricsHtml}
      </div>`
      : `
      <div class="prep-stats-class">${displayTitle}</div>
      <div class="prep-stats-metrics">
        <div class="prep-stats-row"><span>${companionLabel}</span></div>
        <div class="prep-stats-row"><span>💰</span><b>${st.gold}</b></div>
        <div class="prep-stats-row${hpRowClass}"><span>❤️</span><b>${hpLabel}</b></div>
        <div class="prep-stats-row"><span>Раунд</span><b>${roundLabel}</b></div>
      </div>`;
    statsHud.innerHTML = `
      ${statsHeaderHtml}
      ${mutationHtml}
      ${enhancementHtml}
      ${modifierStripHtml}
    `;
    bindPrepEnhancementStrip(side);
    bindPrepCompanionTooltip(statsHud);
    if (typeof syncPrepHudCollapseChrome === "function") syncPrepHudCollapseChrome();
    if (!document.getElementById("prep-hero-tooltip")?.classList.contains("hidden")) {
      refreshPrepHeroTooltip();
    }
  }

  if (phase === "prep" && typeof syncPrepBuildEmojiBtn === "function") {
    syncPrepBuildEmojiBtn({
      formId: mutRt.formId,
      mutationId: mutRt.mutationId,
      classId: mutRt.classId,
      leaderId: mutationProgress?.leader?.id,
      round,
    });
  }

  if (typeof syncPrepHudHero === "function") {
    syncPrepHudHero(profile, { side });
  }

  syncPrepHeroCardChrome(side);

  if (phase === "prep" && !isAnyLobbyMode() && typeof tickSoloPrepThoughts === "function") {
    tickSoloPrepThoughts();
  }
}

function renderPlayerProfiles(opts = {}) {
  const statsEl = document.getElementById("battle-stats-panel");
  const playerAvatarEl = document.getElementById("player-avatar-slot");
  const enemyAvatarEl = document.getElementById("enemy-avatar-slot");
  const lightSpectate = !!opts.lightSpectate;

  let playerProfile;
  let enemyProfile;
  const viewState = getDisplayBattleState();
  const spectateNames = getLobbySpectateProfileNames();
  const profilePlayerClass = spectateNames?.playerClassId || playerClass;
  const profileEnemyClass = spectateNames?.enemyClassId || enemyClass;

  if (phase === "battle" && viewState) {
    playerProfile = computeCombatProfileFromBattleSide(
      viewState.player, profilePlayerClass, spectateNames?.playerName || getPlayerProfileName(), viewState,
    );
    enemyProfile = computeCombatProfileFromBattleSide(
      viewState.enemy, profileEnemyClass, spectateNames?.enemyName || getEnemyDisplayName(), viewState,
    );
  } else if (phase === "replay" && viewState) {
    playerProfile = computeCombatProfileFromBattleSide(
      viewState.player, profilePlayerClass, spectateNames?.playerName || getPlayerProfileName(), viewState,
    );
    enemyProfile = computeCombatProfileFromBattleSide(
      viewState.enemy, profileEnemyClass, spectateNames?.enemyName || getEnemyDisplayName(), viewState,
    );
  } else {
    playerProfile = computeCombatProfile(playerItems, playerClass, getPlayerProfileName());
    enemyProfile = computeCombatProfile(enemyItems, enemyClass, getEnemyDisplayName());
  }

  applyProfileIdentity(playerProfile, profilePlayerClass, gold);
  applyProfileIdentity(enemyProfile, profileEnemyClass, enemyGold);
  if (viewState) {
    enrichProfileWeaponBadge(playerProfile, viewState.player?.items || playerItems, profilePlayerClass);
    enrichProfileWeaponBadge(enemyProfile, viewState.enemy?.items || enemyItems, profileEnemyClass);
  } else {
    enrichProfileWeaponBadge(playerProfile, playerItems, playerClass);
    enrichProfileWeaponBadge(enemyProfile, enemyItems, enemyClass);
  }
  if (typeof enrichProfileArchetypeBanner === "function") {
    const resolveArchetype = (side, spectateFormId, spectateMutationId) => {
      if (isLobbyMode() && lobbyState && lobbyMatches?.[lobbySpectateMatchId]) {
        const match = lobbyMatches[lobbySpectateMatchId];
        if (!match?.byeFighterId) {
          const fighterId = side === "player" ? match.fighterAId : match.fighterBId;
          const fighter = lobbyState.fighters?.[fighterId];
          const progress = typeof resolveMutationProgress === "function"
            ? resolveMutationProgress({
              classId: fighter?.classId,
              companionId: fighter?.companionId,
              items: fighter?.items,
              enhancements: fighter?.enhancements,
              round,
            })
            : null;
          return {
            formId: fighter?.mutationFormId ?? null,
            mutationId: fighter?.mutationId ?? null,
            leaderId: progress?.leader?.id || null,
          };
        }
      }
      const rt = getSideMutationRuntime(side);
      const classId = side === "player"
        ? (spectateNames?.playerClassId || playerClass)
        : (spectateNames?.enemyClassId || enemyClass);
      const progress = typeof resolveMutationProgress === "function"
        ? resolveMutationProgress({
          classId,
          companionId: rt.companionId,
          items: rt.items,
          enhancements: rt.enhancements,
          round,
        })
        : null;
      return {
        formId: spectateFormId ?? rt.formId,
        mutationId: spectateMutationId ?? rt.mutationId,
        leaderId: progress?.leader?.id || null,
      };
    };
    const playerArchetype = resolveArchetype(
      "player",
      spectateNames?.playerMutationFormId,
      spectateNames?.playerMutationId,
    );
    const enemyArchetype = resolveArchetype(
      "enemy",
      spectateNames?.enemyMutationFormId,
      spectateNames?.enemyMutationId,
    );
    enrichProfileArchetypeBanner(
      playerProfile,
      playerArchetype.formId,
      playerArchetype.mutationId,
      round,
      playerArchetype.leaderId,
    );
    enrichProfileArchetypeBanner(
      enemyProfile,
      enemyArchetype.formId,
      enemyArchetype.mutationId,
      round,
      enemyArchetype.leaderId,
    );
  }
  const playerBpItems = viewState?.player?.items || playerItems;
  const enemyBpItems = viewState?.enemy?.items || enemyItems;
  playerProfile.backpackPower = computeBackpackPower(playerContainers, playerBpItems, profilePlayerClass || playerClass);
  enemyProfile.backpackPower = computeBackpackPower(enemyContainers, enemyBpItems, profileEnemyClass || enemyClass);

  renderPrepStageChrome(playerProfile, enemyProfile);

  const liveBattle = phase === "battle" || phase === "replay";
  if (liveBattle && viewState && typeof bootstrapBattleThoughts === "function") {
    if (renderPlayerProfiles._bootKey !== viewState) {
      renderPlayerProfiles._bootKey = viewState;
      renderPlayerProfiles._gridSynced = false;
      if (typeof syncBattleArenaLayout === "function") syncBattleArenaLayout();
      if (typeof window.syncHeroEmotionSlotAnchors === "function") {
        window.syncHeroEmotionSlotAnchors();
      }
      bootstrapBattleThoughts({
        battleState: viewState,
      });
    }
  }

  if (!statsEl || !playerAvatarEl || !enemyAvatarEl) return;

  const buildStatsEl = document.getElementById("battle-build-stats-content");
  const statsOptions = {
    round,
    maxRound: isLobbyMode() ? round : RUN_BATTLES,
    itemCount: Math.max(playerItems.length, enemyItems.length, 1),
  };

  if (liveBattle) {
    if (buildStatsEl) {
      const buildHtml = renderBattleStatsCompareHTML(playerProfile, enemyProfile, {
        ...statsOptions,
        liveBattle: true,
        buildOnly: true,
      });
      if (buildStatsEl.innerHTML !== buildHtml) buildStatsEl.innerHTML = buildHtml;
    }
  } else {
    if (buildStatsEl) buildStatsEl.innerHTML = "";
    closeBattleBuildStatsPopover();
    statsEl.innerHTML = renderBattleStatsCompareHTML(playerProfile, enemyProfile, {
      ...statsOptions,
      liveBattle: false,
    });
  }

  if (liveBattle) {
    if (typeof ensureBattleHeroShells === "function") {
      ensureBattleHeroShells(viewState, playerProfile, enemyProfile);
    } else {
      const battleHud = document.getElementById("battle-run-hud");
      if (battleHud) {
        battleHud.hidden = false;
        battleHud.removeAttribute("aria-hidden");
      }
      if (!playerAvatarEl.querySelector(".avatar-hero-shell")) {
        playerAvatarEl.innerHTML = renderAvatarHeroHTML(playerProfile, "player");
      }
      if (!enemyAvatarEl.querySelector(".avatar-hero-shell")) {
        enemyAvatarEl.innerHTML = renderAvatarHeroHTML(enemyProfile, "enemy");
      }
      if (typeof renderAvatarBarsHTML === "function") {
        const playerBars = document.getElementById("battle-hud-player");
        const enemyBars = document.getElementById("battle-hud-enemy");
        if (playerBars && !playerBars.querySelector(".battle-hud-status-stack")) {
          playerBars.innerHTML = renderAvatarBarsHTML(playerProfile, "player");
        }
        if (enemyBars && !enemyBars.querySelector(".battle-hud-status-stack")) {
          enemyBars.innerHTML = renderAvatarBarsHTML(enemyProfile, "enemy");
        }
      }
    }
    if (!lightSpectate && typeof syncBattleSceneGridMetrics === "function" && !renderPlayerProfiles._gridSynced) {
      renderPlayerProfiles._gridSynced = true;
      requestAnimationFrame(() => syncBattleSceneGridMetrics());
    }
  } else {
    const battleHud = document.getElementById("battle-run-hud");
    if (battleHud) {
      battleHud.hidden = true;
      battleHud.setAttribute("aria-hidden", "true");
    }
    document.getElementById("battle-hud-player")?.replaceChildren();
    document.getElementById("battle-hud-enemy")?.replaceChildren();
    if (!playerAvatarEl.querySelector(".profile-avatar") || playerAvatarEl.querySelector(".avatar-hero-shell")) {
      playerAvatarEl.innerHTML = renderProfileAvatarHTML(playerProfile, "player");
    }
    if (!enemyAvatarEl.querySelector(".profile-avatar") || enemyAvatarEl.querySelector(".avatar-hero-shell")) {
      enemyAvatarEl.innerHTML = renderProfileAvatarHTML(enemyProfile, "enemy");
    }
  }
  if (liveBattle && viewState) {
    viewState._heroProfiles = { player: playerProfile, enemy: enemyProfile };
    const avatarNow = performance.now();
    const avatarGap = 200;
    if (avatarNow - (renderPlayerProfiles._avatarAt || 0) >= avatarGap) {
      renderPlayerProfiles._avatarAt = avatarNow;
      syncAllAvatarHeroEffects(playerProfile, enemyProfile, viewState);
    } else if (typeof syncLiveAvatarHeroFrame === "function") {
      syncLiveAvatarHeroFrame(viewState);
    }
    if (document.documentElement.dataset.battlePrepHeroLayer === "true"
      && typeof syncPrepBuildEmojiBtn === "function") {
      syncPrepBuildEmojiBtn({
        formId: playerProfile.archetypeFormId,
        mutationId: playerProfile.archetypeMutationId,
        classId: profilePlayerClass || playerClass,
        leaderId: null,
        round,
        emojiOverride: playerProfile.archetypeEmoji,
      });
      if (typeof syncBattleEnemyArchetypeFloat === "function") {
        syncBattleEnemyArchetypeFloat({
          profile: enemyProfile,
          formId: enemyProfile.archetypeFormId,
          mutationId: enemyProfile.archetypeMutationId,
          classId: profileEnemyClass || enemyClass,
          round,
          emojiOverride: enemyProfile.archetypeEmoji,
        });
      }
    }
    if (!lightSpectate && typeof updateBattleAnalyzer === "function") updateBattleAnalyzer(viewState, 0);
  }
  if (!lightSpectate && !liveBattle) syncBattleArenaLayout();
}

function renderRunStats() {
  const el = document.getElementById("run-stats-panel");
  if (!el) return;
  if (isAnyLobbyMode() && lobbyState) {
    el.innerHTML = renderLobbyStandingsPanel(lobbyState, round, runResults, {
      spent: goldSpentTotal,
      earned: goldEarnedTotal,
    });
    return;
  }
  el.innerHTML = renderRunStatsPanel(round, phase, runResults, {
    spent: goldSpentTotal,
    earned: goldEarnedTotal,
  });
}

function log(msg) {
  if (!msg || phase !== "prep") return;
  const isCraftMsg = msg.includes("Крафт") || msg.includes("🔄") || msg.includes("🎰");
  if (!isCraftMsg) return;

  const hint = document.getElementById("shop-panel-hint");
  if (hint) {
    if (!hint.dataset.defaultHint) hint.dataset.defaultHint = hint.textContent;
    hint.textContent = msg;
    window.clearTimeout(log.craftTimer);
    log.craftTimer = window.setTimeout(() => {
      hint.textContent = hint.dataset.defaultHint || hint.textContent;
    }, 3500);
  }
}

function buildItemCardHTML(def, { cardType = "item-card", extraClasses = "", tagsHtml = "", innerBefore = "", innerAfter = "", dataAttrs = "", showShape = true, shapeSize = "md" } = {}) {
  const classes = getRarityCardClasses(def.rarity, [cardType, extraClasses].filter(Boolean).join(" "));
  const shapeHtml = showShape ? renderItemShapeMiniHTML(def, { size: shapeSize }) : "";
  const iconHtml = `<div class="${getItemIconShellClass(def)}">${renderItemIconsHTML(def)}</div>`;
  const visualHtml = showShape
    ? `<div class="item-card-cluster">${iconHtml}${shapeHtml}</div>`
    : iconHtml;
  return `<div class="${classes}"${dataAttrs ? ` ${dataAttrs}` : ""}>
    ${innerBefore}
    ${visualHtml}
    <div class="info"><div class="name">${def.name}</div>${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ""}</div>
    ${innerAfter}
  </div>`;
}

function renderBattleStats() {
  renderRunStats();
}

window.positionPrepTooltipDock = positionPrepTooltipDock;
window.getPrepHeroGridTooltipZone = getPrepHeroGridTooltipZone;
window.getPrepHeroPortraitTooltipZone = getPrepHeroPortraitTooltipZone;
window.syncPrepTooltipDockVisibility = syncPrepTooltipDockVisibility;
window.isLivePrepSession = isLivePrepSession;
window.bindPointerTapTooltip = bindPointerTapTooltip;
window.syncPrepHeroCardChrome = syncPrepHeroCardChrome;

if (typeof Campaign !== "undefined") {
  Campaign.registerCampaignRuntime({
    getGold: () => gold,
    setGold: (v) => { gold = v; },
    setFixedShop: (ids) => {
      for (let i = 0; i < MAX_SHOP; i++) shop[i] = ids[i] ?? null;
      shopFrozen = Array(MAX_SHOP).fill(false);
      shopReadyForRound = round;
    },
    setShopOptions: (opts) => { campaignShopOptions = { ...campaignShopOptions, ...opts }; },
    resetPlayerLoadout: () => {
      bench = [];
      selectedBench = -1;
      playerContainers = createStartingContainers();
      playerItems = applyClassStarters(playerContainers, [], playerClass);
      playerPendingShopBuffs = 0;
      setPrepDollOpen(false);
    },
    openDoll: () => setPrepDollOpen(true),
    syncChrome: () => {
      syncCampaignChrome();
      renderShop();
      renderBench();
      recalcSynergies();
      updateUI();
    },
  });
}

registerPrepShopRuntime({
  getPrepViewSide: () => prepViewSide,
  getPhase: () => phase,
  getRound: () => round,
  getGameOver: () => gameOver,
  getSelectedBench: () => selectedBench,
  setSelectedBench: (v) => { selectedBench = v; },
  getGoldSpentTotal: () => goldSpentTotal,
  addGoldSpent: (n) => { goldSpentTotal += n; },
  getGoldEarnedTotal: () => goldEarnedTotal,
  getRecentBattleResults: () => recentBattleResults,
  getPlayerItems: () => playerItems,
  getEnemyItems: () => enemyItems,
  getShopDidDrag: () => shopDidDrag,
  setShopDidDrag: (v) => { shopDidDrag = v; },
  getSuppressShopClickUntil: () => suppressShopClickUntil,
  getSideState,
  canEditPrepSide,
  isVersusMode,
  isEnemyPrepEditable,
  log,
  draw,
  recalcSynergies,
  updateUI,
  playPrepSfx,
  isSyntheticMouseFromTouch,
  isTouchUi,
  getSideEnhancements,
  getSideCompanionId: (side) => (side === "enemy" ? enemyCompanionId : playerCompanionId),
  getSideMutationId: (side) => (side === "enemy" ? enemyMutationId : playerMutationId),
  getSideMutationFormId: (side) => (side === "enemy" ? enemyMutationFormId : playerMutationFormId),
  beginPendingShopDrag,
  beginPendingBenchDrag,
  startBenchDrag,
  isPrepCommerceDragActive: () => !!(dragPayload || pendingShopDrag || pendingBenchDrag || pendingEnhancementDrag),
  shouldUseFixedShop: (side) => isCampaignMode() && side === "player" && typeof Campaign !== "undefined" && Campaign.isActive(),
  applyFixedShop: (side) => {
    if (side === "player" && typeof Campaign !== "undefined") Campaign.applyPrepStep();
  },
  canRefreshShop: (side) => {
    if (!isCampaignMode() || side !== "player") return true;
    return campaignShopOptions.allowRefresh !== false;
  },
  canSellShop: (side) => {
    if (!isCampaignMode() || side !== "player") return true;
    return campaignShopOptions.allowSell !== false;
  },
  isLobby2pSplitPrep: () => isLobby2pMode() && phase === "prep" && !!lobbyState?.isSplitLobby,
});

init();
