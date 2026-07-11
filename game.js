/**
 * Backpack Battles — браузерный автобатлер с рюкзаком
 */

const GRID_COLS = 9;
const GRID_ROWS = 7;
const FRAME_EDGE = 2;
const SHOP_FIELD_GAP = 12;
const BACKPACK_COLS = GRID_COLS;
const BACKPACK_ROWS = GRID_ROWS;
const START_GOLD = 12;
const ROUND_GOLD = 10;
const WIN_GOLD = 3;
const MAX_SHOP = 5;

/** Читаются из CSS (--cell-size, --cell-gap, …) и пересчитываются на resize. */
let GRID_CELL = 46;
let GRID_CELL_GAP = 1;
let GRID_STRIDE = 47;
let FRAME_PAD = 8;
let FRAME_TITLE_H = 22;
let GRID_INNER_W = 422;
let GRID_INNER_H = 328;
let BACKPACK_Y = 0;
let GRID_TOP_Y = 0;
let GRID_PLAYER_X = 0;
let PLAYER_X = 0;
let PLAYER_FIELD_OUTER_W = 422;
let PREP_CANVAS_W = 422;
let PREP_CANVAS_H = 328;
let GRID_GAP = 108;
let ENEMY_X = 939;
let GAP_W = 108;
let BATTLE_CANVAS_W = 880;
let BATTLE_CANVAS_H = 328;
let CANVAS_H = BATTLE_CANVAS_H;
let CANVAS_W = BATTLE_CANVAS_W;
let CELL = GRID_CELL;

function readCssPx(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const val = parseFloat(raw);
  return Number.isFinite(val) ? val : fallback;
}

function getBBBattleStackGap() {
  const scale = readCssPx("--ui-scale", 1);
  return Math.max(28, Math.round(48 * scale));
}

function applyBBStackBattleCanvasSize() {
  if (typeof shouldUseBBStackBattleLayout !== "function" || !shouldUseBBStackBattleLayout()) {
    return false;
  }
  const gap = getBBBattleStackGap();
  BATTLE_CANVAS_W = GRID_INNER_W;
  BATTLE_CANVAS_H = GRID_INNER_H * 2 + gap;
  CANVAS_W = BATTLE_CANVAS_W;
  CANVAS_H = BATTLE_CANVAS_H;
  return true;
}

window.getBBBattleStackGap = getBBBattleStackGap;
window.applyBBStackBattleCanvasSize = applyBBStackBattleCanvasSize;

function getBBBattleCanvasLogicalSize() {
  applyBBStackBattleCanvasSize();
  return { w: BATTLE_CANVAS_W, h: BATTLE_CANVAS_H };
}

window.getBBBattleCanvasLogicalSize = getBBBattleCanvasLogicalSize;

function applyGridMetricsFromCss() {
  const prevKey = `${GRID_CELL}|${GRID_CELL_GAP}|${GRID_INNER_W}|${GRID_INNER_H}`;
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
  applyBBStackBattleCanvasSize();
  CANVAS_W = BATTLE_CANVAS_W;
  CANVAS_H = BATTLE_CANVAS_H;

  layoutCell = GRID_CELL;
  layoutPlayerX = GRID_PLAYER_X;
  layoutCanvasH = canvas ? canvas.height : BATTLE_CANVAS_H;

  const nextKey = `${GRID_CELL}|${GRID_CELL_GAP}|${GRID_INNER_W}|${GRID_INNER_H}`;
  const metricsChanged = nextKey !== prevKey;
  lastGridMetricsKey = nextKey;
  if (!canvas || !metricsChanged) return metricsChanged;

  applyPhaseCanvasLayout();
  syncBattleArenaLayout({ skipCanvasFit: true });
  return true;
}

window.applyGridMetricsFromCss = applyGridMetricsFromCss;

let canvas, ctx, fxCanvas, fxCtx;
let lastGridMetricsKey = "";
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
let runLives = 4;
let runItemStats = createEmptyRunItemStats();
let battleEndHandled = false;
let pendingShopDrag = null;
let pendingBenchDrag = null;
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
const GAME_MODE = "classic";
let gameMode = GAME_MODE;
let lastEndedBattleState = null;
let prepViewSide = "player";

function playPrepSfx(id, opts) {
  if (typeof playGameSfx === "function") playGameSfx(id, opts);
}

let selectedGameMode = GAME_MODE;
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

function isClassicModeActive() {
  return typeof isClassicMode === "function" && isClassicMode();
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
  return "ИИ";
}

function getPlayerProfileName() {
  if (playerClass && typeof getClassById === "function") {
    const cls = getClassById(playerClass);
    if (cls?.heroLabel || cls?.noviceLabel || cls?.name) {
      return cls.heroLabel || cls.noviceLabel || cls.name;
    }
  }
  return "Игрок";
}

function canEditPrepSide(side = prepViewSide) {
  if (phase === "prep" && typeof isCraftMergeBlockingPrep === "function" && isCraftMergeBlockingPrep()) {
    return false;
  }
  return side === "player";
}

function getPrepFieldTeam() {
  return prepViewSide;
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
      },
      enemy: {
        pendingShopBuffs: enemyPendingShopBuffs,
        companionId: enemyCompanionId,
        mutationFormId: enemyMutationFormId,
        mutationId: enemyMutationId,
      },
    },
  );
  battleState.recording = true;
  battleState.replayFrames = [captureBattleFrame(battleState)];
  battleState.lastRecordAt = 0;

  if (typeof resetStackOrbitVfx === "function") resetStackOrbitVfx();
  battleStartTime = Date.now();
  tickBattlePresentation._at = { emotion: 0, arena: 0, orbit: 0, aura: 0, float: 0 };
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
  if (typeof initBattleDamageTracker === "function" && battleState) {
    initBattleDamageTracker(battleState);
  }
  setBattleSpeed(savedBattleSpeed);
  updateBattleControlsUI();
  setPhaseLabel("Бой!", true);
  log(`Раунд ${round}: бой!`);
  renderBattleStats();
  renderFightButton();
  if (typeof queuePrewarmBattleInventoryPopover === "function") {
    requestAnimationFrame(() => queuePrewarmBattleInventoryPopover());
  }
  if (typeof updateBattleAnalyzer === "function" && battleState) {
    updateBattleAnalyzer(battleState, 0);
  }
}


function setPrepViewSide(side, opts = {}) {
  if (side !== "player" && side !== "enemy") return;
  if (side === prepViewSide) return;
  clearDragUiState();
  closePrepHeroTooltip();
  prepViewSide = side;
  if (typeof resetMutationProgressHintTracking === "function") resetMutationProgressHintTracking();
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

function syncPrepBottomBarChrome() {
  const stats = document.getElementById("prep-bottom-stats");
  if (!stats) return;
  const show = phase === "prep" && !gameOver;
  stats.hidden = !show;
  stats.classList.toggle("hidden", !show);
}

function syncPrepBottomStats({ gold: goldValue, hpLabel, roundLabel } = {}) {
  const goldEl = document.getElementById("prep-bottom-stat-gold");
  const hpEl = document.getElementById("prep-bottom-stat-hp");
  const roundEl = document.getElementById("prep-bottom-stat-round");
  if (goldEl && goldValue != null) goldEl.textContent = String(goldValue);
  if (hpEl && hpLabel != null) hpEl.textContent = String(hpLabel);
  if (roundEl && roundLabel != null) roundEl.textContent = String(roundLabel);
}

window.syncPrepBottomBarChrome = syncPrepBottomBarChrome;
window.syncPrepBottomStats = syncPrepBottomStats;

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

  if (prepViewSide === "enemy") {
    setPrepSideBtnContent(playerBtn, "🧑", "Мой стол");
    setPrepSideBtnContent(enemyBtn, "🤖", "Противник");
    if (hint) hint.textContent = "ИИ управляет этим билдом сам — только просмотр";
  } else {
    setPrepSideBtnContent(playerBtn, "🧑", "Мой стол");
    setPrepSideBtnContent(enemyBtn, "🤖", "Противник");
    if (hint) hint.textContent = "Перетащите предмет в инвентарь или на скамейку · 📍 на карточке — закрепить в магазине";
  }
  if (refreshBtn) refreshBtn.disabled = !editable;
  syncPrepBottomBarChrome();
  syncShopHintsVisibility();
}

function getActiveCompanionIdForLoadout() {
  return prepViewSide === "enemy" ? enemyCompanionId : playerCompanionId;
}

function getSideMutationRuntime(side = "player") {
  if (side === "enemy") {
    return {
      classId: enemyClass,
      companionId: enemyCompanionId,
      formId: enemyMutationFormId,
      mutationId: enemyMutationId,
      items: enemyItems,
    };
  }
  return {
    classId: playerClass,
    companionId: playerCompanionId,
    formId: playerMutationFormId,
    mutationId: playerMutationId,
    items: playerItems,
  };
}

function syncMutationMilestonesForSide(side = "player") {
  if (typeof shouldUseMutationSystem === "function" && !shouldUseMutationSystem()) return null;
  if (typeof resolveMutationProgress !== "function" || typeof pickMutationIdForMilestone !== "function") return null;
  const rt = getSideMutationRuntime(side);
  if (!rt.classId) return null;
  const progress = resolveMutationProgress({
    classId: rt.classId,
    companionId: rt.companionId,
    items: rt.items,
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
    } else if (round >= MUTATION_ROUND_FORM && pickId && !playerMutationFormId) {
      playerMutationFormId = pickId;
    }
  }
  return progress;
}

function syncAllMutationMilestones() {
  return syncMutationMilestonesForSide("player");
}

function getRunDisplayTitle(side = "player") {
  const rt = getSideMutationRuntime(side);
  if (!rt.classId) {
    return side === "player" ? getPlayerProfileName() : getEnemyDisplayName();
  }
  if (typeof getMutationDisplayTitle === "function") {
    return getMutationDisplayTitle(rt.classId, rt.formId, rt.mutationId);
  }
  const cls = getClassById(rt.classId);
  return cls?.heroLabel || cls?.noviceLabel || cls?.name || "—";
}

const CLASS_INTRO_STEP_IDS = {
  player: "class-step-player",
  summary: "class-step-summary",
};

function classIntroSkipsCompanion() {
  return typeof shouldSkipCompanionIntro === "function" && shouldSkipCompanionIntro();
}

/** Порядок шагов intro — classic: один экран «Играть». */
function getClassIntroStepSequence() {
  if (typeof shouldSkipClassIntro === "function" && shouldSkipClassIntro()) {
    return ["player"];
  }
  return ["player", "summary"];
}

function getClassIntroStepNumber(stepKey) {
  const seq = getClassIntroStepSequence();
  const idx = seq.indexOf(stepKey);
  return idx >= 0 ? idx + 1 : 1;
}
function renderPrepCompanionLabelHtml(companion) {
  if (!companion) return "—";
  const safeName = typeof escapeClassHtml === "function"
    ? escapeClassHtml(companion.name)
    : companion.name;
  return `<button type="button" class="prep-companion-tip" data-companion-id="${companion.id}" aria-label="Спутник: ${safeName}">${companion.emoji} ${safeName}</button>`;
}

function formatClassIntroStepBadge(stepKey, label) {
  return `Шаг ${getClassIntroStepNumber(stepKey)} из ${getClassIntroTotalSteps()} · ${label}`;
}

function getClassIntroTotalSteps() {
  return getClassIntroStepSequence().length;
}

let classSummaryTooltipPinned = false;
let classSummaryTooltipKind = null;

function setClassIntroStep(stepKey, options = {}) {
  const overlay = document.getElementById("class-overlay");
  const prevStep = overlay?.getAttribute("data-class-intro-step") || "player";
  let resolvedKey = stepKey;
  const targetId = CLASS_INTRO_STEP_IDS[resolvedKey];
  if (!targetId || !document.getElementById(targetId)) {
    console.warn(`[intro] missing step "${stepKey}" — fallback to player`);
    resolvedKey = "player";
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

  document.getElementById("btn-class-summary-start")?.addEventListener("click", () => {
    startRunFromOverlay();
  });
}

function renderClassSummaryStep() {
  const cls = pendingPlayerClass ? getClassById(pendingPlayerClass) : null;
  const skipCompanion = typeof shouldSkipCompanionIntro === "function" && shouldSkipCompanionIntro();
  const companion = !skipCompanion && pendingPlayerCompanionId ? COMPANION_CATALOG?.[pendingPlayerCompanionId] : null;
  const lead = document.getElementById("class-summary-lead");
  const heroImg = document.getElementById("class-summary-hero-img");
  const heroName = document.getElementById("class-summary-hero-name");
  const companionEmoji = document.getElementById("class-summary-companion-emoji");
  const companionName = document.getElementById("class-summary-companion-name");
  const startBtn = document.getElementById("btn-class-summary-start");
  const heroFloat = document.getElementById("class-summary-hero");
  const companionBlock = companionEmoji?.closest(".class-summary-companion, [data-summary-kind=\"companion\"]");
  const stage = document.getElementById("class-summary-stage");
  const backBtn = document.getElementById("btn-class-back-companion");

  const heroLabel = cls?.heroLabel || cls?.noviceLabel || cls?.name || "—";
  if (lead) {
    lead.textContent = skipCompanion
      ? `Ваш выбор: ${heroLabel}`
      : `Ваш выбор: ${heroLabel} и ${companion?.name || "—"}`;
  }
  if (heroImg && pendingPlayerClass) {
    const src = typeof getClassHeroPortraitSrc === "function"
      ? getClassHeroPortraitSrc(pendingPlayerClass)
      : "";
    if (heroImg.getAttribute("src") !== src) heroImg.setAttribute("src", src || "");
    heroImg.alt = heroLabel;
  }
  if (heroName) heroName.textContent = heroLabel;
  if (companionEmoji) companionEmoji.textContent = companion?.emoji || (skipCompanion ? "" : "🐾");
  if (companionName) companionName.textContent = companion?.name || (skipCompanion ? "" : "—");
  if (companionBlock) companionBlock.classList.toggle("hidden", skipCompanion);
  if (stage) stage.classList.toggle("class-summary-stage--solo-pick", skipCompanion);
  if (backBtn) backBtn.textContent = skipCompanion ? "← Герой" : "← Спутник";
  if (heroFloat) {
    if (pendingPlayerClass) heroFloat.dataset.class = pendingPlayerClass;
    else heroFloat.removeAttribute("data-class");
  }
  if (startBtn) {
    startBtn.disabled = !(pendingPlayerClass && (skipCompanion || pendingPlayerCompanionId));
    startBtn.textContent = "Старт";
  }
}

function showSummaryStep() {
  dismissClassOverlayTooltip();
  hideClassSummaryTooltip();
  const skipCompanion = typeof shouldSkipCompanionIntro === "function" && shouldSkipCompanionIntro();
  if (!pendingPlayerClass || (!skipCompanion && !pendingPlayerCompanionId)) return;
  setClassIntroStep("summary");
  if (!selectedEnemyClass) {
    selectedEnemyClass = pendingPlayerClass === "mage" ? "warrior" : "mage";
  }
  document.getElementById("class-modal-title").textContent = "Классика";
  document.getElementById("class-modal-subtitle").textContent = skipCompanion
    ? "Classic · полный доступ · старт с пустым рюкзаком"
    : "Наведите на героя или спутника — подробности о выборе";
  renderClassSummaryStep();
  syncClassOverlayUi();
  syncClassMobileDock();
  if (typeof syncBBFidelityContext === "function") syncBBFidelityContext();
}

function syncClassOverlayUi() {
  const badge = document.getElementById("class-step-badge");
  const hint = document.getElementById("class-action-hint");
  const playerStep = document.getElementById("class-step-player");
  const summaryStep = document.getElementById("class-step-summary");
  if (!badge || !hint) return;

  if (playerStep && !playerStep.classList.contains("hidden")) {
    badge.textContent = formatClassIntroStepBadge("player", "Герой");
    hint.textContent = pendingPlayerClass
      ? "Нажмите героя ещё раз — к обзору и старту"
      : "Выберите героиню · слева — портрет и «Подробнее»";
  } else if (summaryStep && !summaryStep.classList.contains("hidden")) {
    badge.textContent = formatClassIntroStepBadge("summary", "Старт");
    hint.textContent = "Проверьте выбор · «Старт» или «Играть» внизу";
  } else {
    badge.textContent = "";
    hint.textContent = "";
  }
  syncClassHeroShowcase();
  syncBottomChromeIntro();
  if (typeof syncClassicWikiEntry === "function") syncClassicWikiEntry();
  if (typeof syncIntroHeaderWikiButton === "function") syncIntroHeaderWikiButton();
  if (typeof syncBBIntroLayout === "function") syncBBIntroLayout();
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

function syncChromeNavButtons() {
  const overlay = document.getElementById("class-overlay");
  const overlayOpen = !!overlay && !overlay.classList.contains("hidden");
  const introBack = document.getElementById("btn-class-back");
  const prepBack = document.getElementById("btn-chrome-back");
  const inBattle = phase === "battle" || phase === "replay";
  const inPrep = phase === "prep" && !gameOver && !overlayOpen;

  if (introBack) introBack.classList.toggle("hidden", !overlayOpen);
  if (prepBack) prepBack.classList.toggle("hidden", !inPrep || inBattle);
}

function syncBottomChromeIntro() {
  const overlay = document.getElementById("class-overlay");
  const overlayOpen = !!overlay && !overlay.classList.contains("hidden");
  const stepEl = document.getElementById("bottom-chrome-intro-step");
  const hintEl = document.getElementById("bottom-chrome-intro-hint");
  const badge = document.getElementById("class-step-badge");
  const hint = document.getElementById("class-action-hint");
  const summaryStep = document.getElementById("class-step-summary");
  const backBtn = document.getElementById("btn-class-back");
  const startBtn = document.getElementById("btn-start-run");

  if (stepEl) stepEl.textContent = badge?.textContent?.trim() || "Backpack Battles";
  if (hintEl) hintEl.textContent = hint?.textContent?.trim() || "Выберите героя для классического забега";

  const onSummary = summaryStep && !summaryStep.classList.contains("hidden");

  if (backBtn) backBtn.classList.toggle("hidden", !overlayOpen);
  if (startBtn) startBtn.classList.toggle("hidden", !(overlayOpen && onSummary));

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
  const summaryStep = document.getElementById("class-step-summary");
  if (summaryStep && !summaryStep.classList.contains("hidden")) {
    if (typeof hideClassHeroShowcase === "function") hideClassHeroShowcase();
    return;
  }
  if (typeof updateClassHeroShowcase !== "function") return;
  updateClassHeroShowcase(pendingPlayerClass || null);
}

function showPlayerClassStep() {
  dismissClassOverlayTooltip();
  hideClassSummaryTooltip();
  setClassIntroStep("player");
  document.getElementById("class-modal-title").textContent = "Выберите героя";
  document.getElementById("class-modal-subtitle").textContent = "Classic · все герои и предметы открыты · выберите портрет";
  const grid = document.getElementById("player-class-grid");
  if (grid) {
    grid.classList.remove("hidden");
    grid.removeAttribute("aria-hidden");
  }
  document.getElementById("btn-classic-intro-play")?.classList.add("hidden");
  document.getElementById("btn-classic-intro-play")?.setAttribute("hidden", "");
  syncClassOverlayUi();
  syncClassMobileDock();
  if (typeof renderClassMutationGallery === "function") {
    renderClassMutationGallery(typeof shouldUseMutationSystem === "function" && shouldUseMutationSystem() ? pendingPlayerClass : null);
  }
  if (typeof MetaProgress !== "undefined") {
    MetaProgress.setPickerMode(selectedGameMode);
    MetaProgress.refreshClassPickerCards();
  }
}

function resetClassSelectOverlay() {
  pendingPlayerClass = null;
  pendingMutationIntentId = null;
  pendingPlayerCompanionId = null;
  selectedEnemyClass = null;
  selectedGameMode = GAME_MODE;
  if (typeof MetaProgress !== "undefined") MetaProgress.setPickerMode(GAME_MODE);
  document.querySelectorAll(".class-card[data-class]").forEach((card) => card.classList.remove("selected"));
  if (typeof renderClassMutationGallery === "function") renderClassMutationGallery(null);
  showPlayerClassStep();
  updateStartRunButton();
  if (typeof syncClassPickerCardsFromCatalog === "function") syncClassPickerCardsFromCatalog();
  if (typeof MetaProgress !== "undefined") MetaProgress.refreshClassPickerCards();
  syncClassOverlayUi();
  syncClassMobileDock();
  if (typeof syncBBFidelityContext === "function") syncBBFidelityContext();
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
  const ready = !!pendingPlayerClass;
  btn.disabled = !ready;
  btn.textContent = "Старт";
  const summaryBtn = document.getElementById("btn-class-summary-start");
  if (summaryBtn) summaryBtn.disabled = !pendingPlayerClass;
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
  showSummaryStep();
}

function selectPlayerClass(classId) {
  if (typeof MetaProgress !== "undefined" && MetaProgress.isActiveForPicker() && !MetaProgress.isHeroUnlocked(classId)) {
    const hint = MetaProgress.getHeroUnlockHint(classId);
    if (typeof log === "function" && hint) log(`🔒 ${hint}`);
    return;
  }
  const reclick = pendingPlayerClass === classId;
  pendingPlayerClass = classId;
  if (!reclick) pendingMutationIntentId = null;
  document.querySelectorAll(".class-card[data-class]").forEach((card) => {
    card.classList.toggle("selected", card.dataset.class === classId);
  });
  scrollClassPickerCardIntoView(document.querySelector(`.class-card[data-class="${classId}"]`));
  if (typeof renderClassMutationGallery === "function") {
    renderClassMutationGallery(
      typeof shouldUseMutationSystem === "function" && shouldUseMutationSystem() ? classId : null,
    );
  }
  if (reclick) {
    pendingPlayerCompanionId = null;
    showSummaryStep();
    return;
  }
  syncClassOverlayUi();
  if (typeof window.syncClassOverlayAnchors === "function") {
    requestAnimationFrame(() => window.syncClassOverlayAnchors());
  }
  syncClassMobileDock();
  updateStartRunButton();
  if (typeof syncBBIntroLayout === "function") syncBBIntroLayout();
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

function updateTouchTapGestureMove(clientX, clientY) {
  if (!touchTapGesture || touchTapGesture.cancelled) return;
  const dist = Math.hypot(clientX - touchTapGesture.startX, clientY - touchTapGesture.startY);
  if (dist >= TOOLTIP_CONFIG.moveTolerance) {
    touchTapGesture.cancelled = true;
    touchTapGesture.onCancel?.();
    clearTouchTapGesture();
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

function beginPendingCanvasPick(clientX, clientY) {
  const canPrepPick = typeof isLoadoutInteractionPhase === "function"
    && isLoadoutInteractionPhase()
    && !gameOver
    && typeof canEditPrepSide === "function"
    && canEditPrepSide();
  const canBattlePick = (phase === "battle" || phase === "replay")
    && battleState
    && prepTooltipsEnabled;
  if (!canPrepPick && !canBattlePick) return;

  pendingCanvasPick = { clientX, clientY };
  beginTouchTapGesture({
    clientX,
    clientY,
    allowMouse: true,
    onTap: () => {
      pendingCanvasPick = null;
      updatePointerFromClient(clientX, clientY);
      if (prepTooltipsEnabled && typeof updateTooltip === "function") {
        updateTooltip(mousePos.x, mousePos.y);
      }
    },
  });
}

function tryFinishPendingCanvasPickTooltip(clientX, clientY) {
  if (!pendingCanvasPick || dragPayload) return false;
  const threshold = typeof getPrepDragCommitThresholdPx === "function"
    ? getPrepDragCommitThresholdPx()
    : MOUSE_DRAG_THRESHOLD_PX;
  const dx = clientX - pendingCanvasPick.clientX;
  const dy = clientY - pendingCanvasPick.clientY;
  if (Math.hypot(dx, dy) >= threshold) {
    pendingCanvasPick = null;
    return false;
  }
  const shown = finishTouchTapGesture(clientX, clientY);
  if (!shown) pendingCanvasPick = null;
  return shown;
}


function bindTouchInput() {
  const boardSection = document.querySelector(".board-section");
  const shopPanel = document.getElementById("shop-panel");
  const prepShopPopover = document.getElementById("prep-shop-popover");
  const benchPopover = document.getElementById("prep-bench-popover");
  const benchFab = document.getElementById("btn-prep-bench-fab");
  const prepPointerSelector = [
    "#game-canvas",
    ".canvas-scale-wrap",
    "#prep-field-island",
    ".board-section",
    "#shop-panel",
    "#prep-shop-popover",
    "#prep-bench-popover",
    "#prep-storage-mount",
    "#btn-prep-bench-fab",
  ].join(", ");
  const captureOpts = { passive: false, capture: true };
  const bubbleOpts = { passive: false };
  let activeGesture = null;
  let prepDragPrimaryPointerId = null;
  let pointerCaptureEl = null;

  const isTouchLikePointer = (e) => e.pointerType === "touch" || e.pointerType === "pen";
  const gestureKey = (kind, id) => `${kind}:${id}`;
  const ignoreTarget = (target) => target?.closest?.("button, a, input, select, textarea");
  const isPrepPointerTarget = (target) => !!target?.closest?.(prepPointerSelector);
  const isStoragePhysicsTarget = (target) => !!target?.closest?.(".prep-storage-body, .prep-screen-flier");

  const capturePointerSurface = (id, el) => {
    pointerCaptureEl = el || canvas;
    try {
      pointerCaptureEl?.setPointerCapture(id);
    } catch (_) {}
  };
  const releasePointerSurface = (id) => {
    try {
      pointerCaptureEl?.releasePointerCapture(id);
    } catch (_) {}
    pointerCaptureEl = null;
  };

  const onDown = (kind, id, x, y, e) => {
    if (dragPayload && isLoadoutInteractionPhase()) {
      if (activeGesture && gestureKey(kind, id) !== activeGesture) {
        if (e.cancelable) e.preventDefault();
        if (typeof tryRotateDragItemFromSecondaryTouch === "function") {
          tryRotateDragItemFromSecondaryTouch();
        }
        return;
      }
    }
    if (activeGesture) return;
    if (ignoreTarget(e.target)) return;
    if (isStoragePhysicsTarget(e.target)) return;

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
    if (!isPrepPointerTarget(e.target)) return;
    activeGesture = gestureKey(kind, id);
    prepDragPrimaryPointerId = kind === "pointer" ? id : null;
    lastTouchEventAt = Date.now();
    if (e.cancelable) e.preventDefault();
    const shopPointerSurface = e.target?.closest?.(
      "#prep-shop-popover, #shop-panel, .shop-card, .shop-pin, .btn-refresh-shop",
    );
    if (kind === "pointer" && !shopPointerSurface) {
      const captureEl = e.target?.closest?.("#game-canvas, .canvas-scale-wrap, .prep-storage-arena")
        || canvas;
      capturePointerSurface(id, captureEl);
    }
    gamepadPointerDownAt(x, y);
  };

  const onMove = (kind, id, x, y, e) => {
    if (activeGesture !== gestureKey(kind, id)) return;
    updateTouchTapGestureMove(x, y);
    const dragging = !!(dragPayload || pendingShopDrag || pendingBenchDrag);
    if (dragging && e?.cancelable) e.preventDefault();
    updatePointerFromClient(x, y);
  };

  const onUp = (kind, id, x, y) => {
    if (activeGesture !== gestureKey(kind, id)) return;
    lastTouchEventAt = Date.now();
    const tapHandled = finishTouchTapGesture(x, y);
    if (tapHandled && !dragPayload && !pendingShopDrag && !pendingBenchDrag) {
      pendingCanvasPick = null;
      syncUiDragState();
      activeGesture = null;
      if (kind === "pointer") releasePointerSurface(id);
      return;
    }
    gamepadPointerUpAt(x, y);
    if (kind === "pointer") releasePointerSurface(id);
    activeGesture = null;
    if (!dragPayload && !pendingShopDrag && !pendingBenchDrag) {
      prepDragPrimaryPointerId = null;
    }
  };

  document.addEventListener("pointerdown", (e) => {
    if (!isTouchLikePointer(e)) return;
    onDown("pointer", e.pointerId, e.clientX, e.clientY, e);
  }, captureOpts);

  document.addEventListener("pointermove", (e) => {
    if (!isTouchLikePointer(e)) return;
    onMove("pointer", e.pointerId, e.clientX, e.clientY, e);
  }, captureOpts);

  document.addEventListener("pointerup", (e) => {
    if (!isTouchLikePointer(e)) return;
    onUp("pointer", e.pointerId, e.clientX, e.clientY);
  }, captureOpts);

  document.addEventListener("pointercancel", (e) => {
    if (!isTouchLikePointer(e)) return;
    onUp("pointer", e.pointerId, e.clientX, e.clientY);
  }, captureOpts);

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
    if (dragPayload && isLoadoutInteractionPhase() && e.touches.length >= 2) {
      e.preventDefault();
      if (typeof tryRotateDragItemFromSecondaryTouch === "function") {
        tryRotateDragItemFromSecondaryTouch();
      }
    }
  }, bubbleOpts);

  bindTouchTooltipDismiss();
  window.getPrepDragPrimaryPointerId = () => prepDragPrimaryPointerId;
  window.resetPrepTouchGesture = () => {
    activeGesture = null;
    prepDragPrimaryPointerId = null;
    pointerCaptureEl = null;
  };
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
    if (e.button !== 0) return;
    markMouseInteraction();
    if (phase === "battle" && typeof handleBattleHudClick === "function") {
      handleBattleHudClick(e.clientX, e.clientY);
    }
    beginPendingCanvasPick(e.clientX, e.clientY);
  });
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (dragPayload && isLoadoutInteractionPhase()) rotateDragItem();
  });
  canvas.addEventListener("mouseleave", () => {
    if (!dragPayload) {
      hoverCell = null;
      hoverSlot = null;
      if (!sidebarTooltipPinned) {
        tooltipItem = null;
      }
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
    tryFinishPendingCanvasPickTooltip(e.clientX, e.clientY);
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
  document.getElementById("btn-fight").addEventListener("click", () => startBattle());
  document.getElementById("btn-refresh")?.addEventListener("click", () => refreshShop(true));
  document.getElementById("sell-drop-zone")?.addEventListener("click", sellSelected);
  document.getElementById("btn-restart").addEventListener("click", returnToMainMenu);
  if (typeof syncClassPickerCardsFromCatalog === "function") syncClassPickerCardsFromCatalog();
  if (typeof MetaProgress !== "undefined") {
    MetaProgress.setPickerMode(GAME_MODE);
    MetaProgress.refreshClassPickerCards();
  }
  if (typeof syncClassHeroRosterCaption === "function") syncClassHeroRosterCaption();
  document.querySelectorAll(".class-card[data-class]").forEach((btn) => {
    btn.addEventListener("click", () => selectPlayerClass(btn.dataset.class));
  });
  document.getElementById("btn-classic-intro-play")?.addEventListener("click", () => {
    if (typeof beginClassicRun === "function") beginClassicRun();
  });
  document.getElementById("btn-class-back")?.addEventListener("click", () => {
    const summaryStep = document.getElementById("class-step-summary");
    const playerStep = document.getElementById("class-step-player");
    if (summaryStep && !summaryStep.classList.contains("hidden")) {
      showPlayerClassStep();
    } else if (playerStep && !playerStep.classList.contains("hidden")) {
      showPlayerClassStep();
    }
  });
  document.getElementById("btn-class-back-player")?.addEventListener("click", () => showPlayerClassStep());
  document.getElementById("btn-class-back-companion")?.addEventListener("click", () => showPlayerClassStep());
  document.getElementById("btn-chrome-back")?.addEventListener("click", () => returnToMainMenu());
  bindClassSummaryInteractions();
  document.getElementById("btn-start-run")?.addEventListener("click", startRunFromOverlay);
  window.addEventListener("resize", syncClassMobileDock, { passive: true });
  window.addEventListener("orientationchange", syncClassMobileDock, { passive: true });
  document.getElementById("btn-prep-player")?.addEventListener("click", () => setPrepViewSide("player"));
  document.getElementById("btn-prep-enemy")?.addEventListener("click", () => setPrepViewSide("enemy"));
  document.getElementById("btn-battle-continue")?.addEventListener("click", () => {
    if (isPhaseTransitioning()) return;
    if (typeof PrepCountdown !== "undefined") PrepCountdown.clearBattleResultWindow();
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
      setPhaseLabel("Подготовка", false);
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
        () => (typeof hideBBRoundResult === "function"
          ? hideBBRoundResult()
          : hideBattleResultPopupAsync("resultToPrep")),
      );
      return;
    }
    if (typeof hideBBRoundResult === "function" && document.getElementById("bb-round-result-overlay") && !document.getElementById("bb-round-result-overlay").classList.contains("hidden")) {
      void hideBBRoundResult().then(() => transitionToPhase("prep", continueAfterResult));
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
  if (typeof initBBItemWikiControls === "function") initBBItemWikiControls();
  if (typeof initClassDetailPopup === "function") initClassDetailPopup();
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
  if (typeof initPrepHudPreset === "function") initPrepHudPreset();
  if (typeof initPrepHeroCardPreset === "function") initPrepHeroCardPreset();
  if (typeof initSoundTheme === "function") initSoundTheme();
  if (typeof initPrepBuildEmojiBtn === "function") initPrepBuildEmojiBtn();
  if (typeof initLightBattleFxControls === "function") initLightBattleFxControls();
  if (typeof initEmojiOrbitSpeedControls === "function") initEmojiOrbitSpeedControls();
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
    isBBItemWikiOpen,
    isClassDetailPopupOpen,
    closeAllPopups,
    useVirtualCursor: () => phase === "prep" && !gameOver && !isPopupOpen("class-overlay")
      && !isPopupOpen("battle-result-overlay") && !isPopupOpen("overlay")
      && !isPopupOpen("bb-run-complete-overlay")
      && !isRecipeBookOpen() && !(typeof isBBItemWikiOpen === "function" && isBBItemWikiOpen())
      && !isClassDetailPopupOpen?.() && !isBoardPreviewOpen(),
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

function getDisplayBattleState() {
  return battleState ?? null;
}

window.getDisplayBattleState = getDisplayBattleState;

/** В flank-arena рюкзак показывается по тапу на портрет, не на canvas. */
function shouldDrawCanvasLoadoutInBattle() {
  if (!isBattleUiPhase()) return false;
  if (typeof shouldUseBBStackBattleLayout === "function" && shouldUseBBStackBattleLayout()) {
    return true;
  }
  return document.documentElement.dataset.battleHeroPlacement !== "flank-arena";
}

function shouldThrottleBattleCanvasDraw() {
  if (!isBattleUiPhase()) return false;
  const perfLimited = typeof BattleFxTier !== "undefined" && BattleFxTier.isPerfConstrainedDevice?.();
  if (!perfLimited && !(typeof BattleFxTier !== "undefined" && BattleFxTier.isLightBattleFx())) {
    return false;
  }
  if (document.documentElement.dataset.battleHeroPlacement === "flank-arena") return true;
  return typeof BattleFxTier !== "undefined" && BattleFxTier.isLightBattleFx();
}

function battleCanvasDrawFps() {
  const perfLimited = typeof BattleFxTier !== "undefined" && BattleFxTier.isPerfConstrainedDevice?.();
  if (!perfLimited) return 30;
  if (document.documentElement.dataset.uiTier === "tablet") return 12;
  return 18;
}

function tickBattleHudLite() {
  syncLiveBattleHud(getDisplayBattleState());
}

function battleProfileTickMs() {
  if (typeof BattleFxTier !== "undefined" && BattleFxTier.battleProfileTickMs) {
    return BattleFxTier.battleProfileTickMs();
  }
  return 500;
}

function getAppDataPhase() {
  if (phase === "classSelect") return "classSelect";
  if (phase === "battle" || phase === "replay") return phase;
  return "prep";
}

function shouldUseBBPrepLandscapeCanvas() {
  return typeof shouldRotateBBPrepField90 === "function" && shouldRotateBBPrepField90();
}

function getPrepGridInnerSize() {
  return { w: GRID_INNER_W, h: GRID_INNER_H };
}

window.getPrepGridInnerSize = getPrepGridInnerSize;
window.shouldUseBBPrepLandscapeCanvas = shouldUseBBPrepLandscapeCanvas;

function applyPhaseCanvasLayout() {
  if (!canvas) return false;
  layoutCell = GRID_CELL;
  layoutPlayerX = GRID_PLAYER_X;
  let targetW;
  let targetH;
  if (phase === "prep") {
    if (shouldUseBBPrepLandscapeCanvas()) {
      targetW = PREP_CANVAS_H;
      targetH = PREP_CANVAS_W;
    } else {
      targetW = PREP_CANVAS_W;
      targetH = PREP_CANVAS_H;
    }
  } else {
    applyBBStackBattleCanvasSize();
    targetW = BATTLE_CANVAS_W;
    targetH = BATTLE_CANVAS_H;
  }

  const bitmapChanged = canvas.width !== targetW || canvas.height !== targetH;
  if (bitmapChanged) {
    canvas.width = targetW;
    canvas.height = targetH;
    if (fxCanvas) {
      fxCanvas.width = targetW;
      fxCanvas.height = targetH;
    }
    layoutCanvasH = canvas.height;
    if (typeof warmupCellEmojiMetrics === "function") warmupCellEmojiMetrics(ctx);
    if (typeof window.syncFxCanvasGeometry === "function") {
      requestAnimationFrame(() => window.syncFxCanvasGeometry());
    }
  }
  return bitmapChanged;
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
  const enteringPrep = phase === "prep" && renderPhase._lastPhase !== "prep";
  if (enteringPrep && typeof resetMutationProgressHintTracking === "function") {
    resetMutationProgressHintTracking();
  }
  if (enteringPrep && !gameOver && typeof resolveDuePendingCraftsOnPrepEntry === "function") {
    resolveDuePendingCraftsOnPrepEntry();
  }
  renderPhase._lastPhase = phase;
  if (root) {
    root.dataset.gamePhase = phase === "battle" || phase === "replay" ? phase : phase === "prep" ? "prep" : "";
    root.dataset.gameMode = gameMode;
  }
  if (typeof syncBBFidelityContext === "function") syncBBFidelityContext();
  syncClassOverlayHiddenDuringGame();
  applyPhaseCanvasLayout();
  const phaseTransitioning = typeof ScreenTransitions !== "undefined" && ScreenTransitions.isScreenTransitioning();
  setBattleControlsVisible(isBattleUiPhase());
  syncBattleArenaLayout({ skipCanvasFit: phaseTransitioning });
  syncPrepHeroHudDom();
  if (phase !== "prep") {
    window.forceHidePrepBenchChrome?.();
    window.closePrepBenchPopover?.();
    if (typeof PrepStoragePhysics !== "undefined") PrepStoragePhysics.unmount();
  }
  window.syncPrepBenchFabVisibility?.();
  const battleSceneUi = document.getElementById("battle-scene-ui");
  if (battleSceneUi) battleSceneUi.setAttribute("aria-hidden", isBattleUiPhase() ? "false" : "true");
  renderPlayerProfiles();
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
  if (phase === "prep" && !gameOver) {
    ensureShopReadyForSide("player");
    updatePrepSideUI();
    renderShop();
    renderBench();
  }
  syncPrepTooltipDockVisibility();
  renderFightButton();
  if (typeof syncBBPrepLayout === "function") syncBBPrepLayout();
  if (typeof syncBBFidelityBattleLayout === "function") syncBBFidelityBattleLayout();
  if (typeof syncBBBattleHud === "function") syncBBBattleHud();
  if (phase !== "prep") closeAllFighterCharacteristicsPopups();
  if (!isBattleUiPhase() && typeof closeBattleInventoryPopover === "function") closeBattleInventoryPopover();
  if (phase !== "prep" && typeof closeMobilePrepShop === "function") closeMobilePrepShop();
  if (typeof applyUiLayout === "function" && !(typeof ScreenTransitions !== "undefined" && ScreenTransitions.isScreenTransitioning())) {
    scheduleLayoutAfterPhase();
  }
  syncRunHudPhase();
  syncBattleHudVisibility();
  if (typeof CombatLog?.syncCombatFeedPhase === "function") CombatLog.syncCombatFeedPhase();
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
  const bbStack = typeof shouldUseBBStackBattleLayout === "function" && shouldUseBBStackBattleLayout();
  if (battleHud) {
    battleHud.hidden = !live || bbStack;
    if (live && !bbStack) battleHud.removeAttribute("aria-hidden");
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

function syncBattleArenaLayout(options = {}) {
  const arena = document.getElementById("battle-arena");
  if (!arena || !canvas) return;

  const layout = getFieldLayoutMetrics();

  arena.style.setProperty("--battle-field-ratio", String(layout.playerColumnRatio));
  arena.style.setProperty("--battle-center-ratio", String(layout.centerRatio));
  arena.style.setProperty("--battle-enemy-ratio", String(layout.enemyColumnRatio));
  arena.style.setProperty("--battle-shop-left", String(layout.shopLeftRatio));
  arena.style.setProperty("--battle-shop-right", String(layout.shopRightRatio));

  arena.classList.toggle("is-battle", isBattleUiPhase());
  if (options.skipCanvasFit) return;
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
  if (typeof MetaProgress !== "undefined") {
    MetaProgress.setRunMode(null);
  }
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
  if (typeof clearTrackedBuild === "function") clearTrackedBuild();
  releasePreviousBattleReplayFrames();
  lastBattleReplay = null;
  if (typeof DialogueEngine !== "undefined") DialogueEngine.reset("");
  if (typeof ScreenTransitions !== "undefined" && typeof ScreenTransitions.clearPhaseTransitionLock === "function") {
    ScreenTransitions.clearPhaseTransitionLock();
  }
  document.getElementById("overlay")?.classList.add("hidden");
  if (typeof hideBBRunComplete === "function") void hideBBRunComplete();

  const finishReturn = () => {
    resetClassSelectOverlay();
    gameMode = GAME_MODE;
    selectedGameMode = GAME_MODE;
    setPhaseLabel("Выбор героя", false);
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

function beginClassicRun() {
  if (typeof ScreenTransitions !== "undefined" && ScreenTransitions.isScreenTransitioning()) return;
  pendingPlayerClass = null;
  playerClass = null;
  playerCompanionId = null;
  enemyCompanionId = null;
  enemyClass = null;
  selectedEnemyClass = null;
  playerMutationFormId = null;
  playerMutationId = null;
  enemyMutationFormId = null;
  enemyMutationId = null;
  enemyArchetype = AI_ARCHETYPES.warrior;
  gameMode = GAME_MODE;
  selectedGameMode = GAME_MODE;
  if (typeof MetaProgress !== "undefined") MetaProgress.setRunMode(GAME_MODE);
  prepViewSide = "player";
  dismissClassOverlayTooltip();
  hideClassSummaryTooltip();
  const overlay = document.getElementById("class-overlay");
  overlay?.classList.remove("class-overlay--summary");
  const app = document.getElementById("app");
  if (app) app.dataset.gameMode = gameMode;
  document.documentElement.dataset.gameMode = gameMode;
  if (typeof syncBBFidelityContext === "function") syncBBFidelityContext();

  const beginRun = () => {
    if (typeof RuntimeLoader !== "undefined" && RuntimeLoader.preloadCombatFeedBundle) {
      RuntimeLoader.preloadCombatFeedBundle();
    }
    restartGame();
  };

  const proceed = () => {
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
  };

  if (typeof RuntimeLoader !== "undefined") {
    return RuntimeLoader.ensureModeBundle(GAME_MODE)
      .then(proceed)
      .catch((err) => {
        console.error("Mode bundle load failed:", err);
      });
  }

  proceed();
  return Promise.resolve();
}
window.beginClassicRun = beginClassicRun;

function startRunFromOverlay() {
  if (!pendingPlayerClass) return;
  if (typeof MetaProgress !== "undefined" && MetaProgress.isActiveForPicker()
    && !MetaProgress.isHeroUnlocked(pendingPlayerClass)) return;
  if (typeof ScreenTransitions !== "undefined" && ScreenTransitions.isScreenTransitioning()) return;
  if (!selectedEnemyClass) {
    selectedEnemyClass = pendingPlayerClass === "mage" ? "warrior" : "mage";
  }

  const proceedStartRun = () => {
    gameMode = GAME_MODE;
    selectedGameMode = GAME_MODE;
    if (typeof refreshCraftRecipesForCurrentMode === "function") {
      refreshCraftRecipesForCurrentMode();
    }
    if (typeof MetaProgress !== "undefined") MetaProgress.setRunMode(GAME_MODE);
    playerClass = pendingPlayerClass;
    playerCompanionId = null;
    enemyCompanionId = typeof defaultCompanionForClass === "function"
      ? defaultCompanionForClass(selectedEnemyClass || pendingPlayerClass)
      : "s_stranger";
    playerMutationFormId = null;
    playerMutationId = null;
    enemyMutationFormId = null;
    enemyMutationId = null;
    enemyClass = selectedEnemyClass || pendingPlayerClass;
    enemyArchetype = AI_ARCHETYPES[enemyClass] || AI_ARCHETYPES.warrior;
    prepViewSide = "player";
    dismissClassOverlayTooltip();
    hideClassSummaryTooltip();
    const overlay = document.getElementById("class-overlay");
    overlay?.classList.remove("class-overlay--summary");
    const app = document.getElementById("app");
    if (app) app.dataset.gameMode = gameMode;
    document.documentElement.dataset.gameMode = gameMode;
    if (typeof syncBBFidelityContext === "function") syncBBFidelityContext();

    const beginRun = () => {
      if (typeof RuntimeLoader !== "undefined" && RuntimeLoader.preloadCombatFeedBundle) {
        RuntimeLoader.preloadCombatFeedBundle();
      }
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
  };

  if (typeof RuntimeLoader !== "undefined") {
    return RuntimeLoader.ensureModeBundle(GAME_MODE)
      .then(proceedStartRun)
      .catch((err) => {
        console.error("Mode bundle load failed:", err);
      });
  }

  proceedStartRun();
  return Promise.resolve();
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
  const classless = typeof shouldUseClassSystem === "function" && !shouldUseClassSystem();
  if (classless) {
    playerCompanionId = null;
    enemyCompanionId = null;
  } else {
    if (!playerCompanionId && !(typeof isClassicMode === "function" && isClassicMode())) {
      playerCompanionId = typeof defaultCompanionForClass === "function"
        ? defaultCompanionForClass(playerClass)
        : "s_stranger";
    }
    if (!enemyCompanionId) {
      enemyCompanionId = typeof defaultCompanionForClass === "function"
        ? defaultCompanionForClass(enemyClass || playerClass)
        : "s_stranger";
    }
  }
  playerMutationFormId = null;
  playerMutationId = null;
  enemyMutationFormId = null;
  enemyMutationId = null;
  if (typeof resetPendingCraftState === "function") resetPendingCraftState();
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
  runLives = typeof getBBRunLivesMax === "function" ? getBBRunLivesMax() : 4;
  runItemStats = createEmptyRunItemStats();
  bench = [];
  shop = Array(MAX_SHOP).fill(null);
  playerContainers = createStartingContainers();
  playerItems = classless ? [] : applyClassStarters(playerContainers, [], playerClass);
  if (typeof getStartingValueBonus === "function") {
    gold += getStartingValueBonus(playerItems);
  }
  enemyGold = START_GOLD;
  enemyBench = [];
  {
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
  releasePreviousBattleReplayFrames();
  lastBattleReplay = null;
  if (typeof DialogueEngine !== "undefined") {
    DialogueEngine.reset(`${gameMode}:${Date.now()}`);
  }
  document.getElementById("app")?.setAttribute("data-prep-side", "player");
  document.getElementById("battle-result-overlay")?.classList.add("hidden");
  document.getElementById("bb-round-result-overlay")?.classList.add("hidden");
  document.getElementById("overlay").classList.add("hidden");
  hideBoardPreviewPopup();
  renderPhase();
  updatePrepSideUI();
  resetShopForNewRound();
  renderShop();
  renderBench();
  recalcSynergies();
  updateUI();
  renderRunStats();
  renderFightButton();
  setPhaseLabel("Подготовка", false);
  if (typeof PrepCountdown !== "undefined") {
    PrepCountdown.onPrepPhaseStarted(`run:${round}`);
  }
  requestAnimationFrame(() => {
    ensureShopReadyForSide("player");
    renderShop();
    renderBench();
    updatePrepSideUI();
    if (typeof applyUiLayout === "function") applyUiLayout();
  });
  log("Классика: соберите рюкзак и нажмите «Бой».");
}

function isPopupOpen(id) {
  const el = document.getElementById(id);
  return !!(el && !el.classList.contains("hidden"));
}

/** Итоги боя: phase=battle, симуляция остановлена, overlay открыт. */

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
  if (isPopupOpen("bb-run-complete-overlay")) {
    if (gameOver) returnToMainMenu();
    closed = true;
  } else if (isPopupOpen("overlay")) {
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

  if (typeof isClassDetailPopupOpen === "function" && isClassDetailPopupOpen()) {
    hideClassDetailPopup();
    closed = true;
  }

  if (isRecipeBookOpen()) {
    hideRecipeBookPopup();
    closed = true;
  }

  if (typeof isBBItemWikiOpen === "function" && isBBItemWikiOpen()) {
    hideBBItemWiki();
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
    if (summaryStepOpen && pendingPlayerClass) {
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

  if ((isPopupOpen("overlay") || isPopupOpen("bb-run-complete-overlay")) && gameOver) {
    returnToMainMenu();
    e.preventDefault();
    return true;
  }

  if (isPopupOpen("overlay") || isPopupOpen("bb-run-complete-overlay")) {
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
  return (typeof PrepCountdown !== "undefined" && PrepCountdown.isActive())
    || isBoardPreviewOpen()
    || isRecipeBookOpen()
    || (typeof isBBItemWikiOpen === "function" && isBBItemWikiOpen())
    || isPopupOpen("class-overlay")
    || isPopupOpen("overlay")
    || isPopupOpen("bb-run-complete-overlay")
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
    || (typeof isBBItemWikiOpen === "function" && isBBItemWikiOpen())
    || isPopupOpen("class-overlay")
    || isPopupOpen("overlay")
    || isPopupOpen("bb-run-complete-overlay")
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
      || isPopupOpen("bb-run-complete-overlay")
      || isPopupOpen("battle-result-overlay")
    ) {
      return;
    }
    e.preventDefault();
    setPrepViewSide(prepViewSide === "player" ? "enemy" : "player");
  }
}


function getCraftContextFromGame(side = prepViewSide) {
  const st = getSideState(side);
  return { playerClass: st.classId, classId: st.classId };
}

function syncPendingCraftsForSide(side = prepViewSide) {
  if (typeof syncPendingCraftClustersForSide === "function") {
    syncPendingCraftClustersForSide(side);
  }
  return true;
}


function canStartBattle() {
  if (phase !== "prep" || gameOver) return false;
  if (round > RUN_BATTLES) return false;
  if (playerItems.length === 0) return false;
  if (typeof isItemAllowedForHeroClass === "function"
    && playerItems.some((item) => !isItemAllowedForHeroClass(item.itemId, playerClass))) {
    return false;
  }
  return true;
}

function renderFightButton() {
  const btn = document.getElementById("btn-fight");
  if (!btn) return;
  const visible = phase === "prep" && !gameOver;
  btn.classList.toggle("hidden", !visible);
  if (visible) btn.disabled = !canStartBattle();
  if (visible) {
    btn.textContent = (typeof isBBFidelityMode === "function" && isBBFidelityMode())
      ? "⚔️ В бой!"
      : "⚔️ Бой";
    btn.title = playerItems.length === 0
      ? "Положите предметы в сумку"
      : (typeof isItemAllowedForHeroClass === "function"
        && playerItems.some((item) => !isItemAllowedForHeroClass(item.itemId, playerClass)))
        ? "Уберите экипировку другого класса"
        : "";
  }
}

function recalcSynergies() {
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
  if (typeof BBVsOverlay !== "undefined" && BBVsOverlay.isActive()) {
    BBVsOverlay.cancel();
    executeBattleStart();
    return;
  }
  if (typeof PrepCountdown !== "undefined" && PrepCountdown.isActive()) {
    PrepCountdown.cancel();
    executeBattleStart();
    return;
  }
  if (typeof ScreenTransitions !== "undefined" && ScreenTransitions.isScreenTransitioning()) {
    if (typeof ScreenTransitions.clearPhaseTransitionLock === "function") {
      ScreenTransitions.clearPhaseTransitionLock();
    }
  }
  if (!canStartBattle()) {
    playPrepSfx("ui_error");
    if (phase === "prep" && playerItems.length === 0) {
      log("Положите хотя бы один предмет в сумку! (не только на скамейку)");
    }
    return;
  }
  if (phase === "prep" && typeof BBVsOverlay !== "undefined" && BBVsOverlay.shouldUse()) {
    BBVsOverlay.start(() => executeBattleStart());
    return;
  }
  if (phase === "prep" && typeof PrepCountdown !== "undefined") {
    PrepCountdown.start(() => executeBattleStart());
    return;
  }
  executeBattleStart();
}

function rollbackBattleStartPrep() {
  battleState = null;
  battleEndHandled = false;
}

function executeBattleStart() {
  if (dragPayload) {
    dragPayload = null;
    dragFrom = null;
    synergyPreviewBuilt = null;
  }
  window.forceHidePrepBenchChrome?.();
  window.closePrepBenchPopover?.();

  try {
    prepareBattleStartState();
  } catch (err) {
    console.error("startBattle prepare failed:", err);
    rollbackBattleStartPrep();
    playPrepSfx("ui_error");
    log("Не удалось начать бой — проверьте консоль");
    return;
  }

  transitionToPhase("battle", () => {
    try {
      finalizeBattleStartUi();
    } catch (err) {
      console.error("startBattle failed:", err);
      rollbackBattleStartPrep();
      if (typeof ScreenTransitions !== "undefined" && typeof ScreenTransitions.clearPhaseTransitionLock === "function") {
        ScreenTransitions.clearPhaseTransitionLock();
      }
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
  const activeState = battleState;
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
    if (typeof shouldUseBBRunLives === "function" && shouldUseBBRunLives() && battleWinner === "enemy") {
      runLives = Math.max(0, runLives - 1);
    }
    runResults[round - 1] = battleResult;
    round++;
    syncAllMutationMilestones();
    resetShopForNewRound();

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
    if (typeof showBattleResultForMode === "function") {
      showBattleResultForMode(resultSummary, resultLog);
    } else {
      showBattleResultPopup(resultSummary, resultLog);
    }
  });

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

  if (round > RUN_BATTLES) {
    pendingGameOver = true;
    updateUI();
    return;
  }

  if (typeof shouldUseBBRunLives === "function" && shouldUseBBRunLives() && runLives <= 0) {
    pendingGameOver = true;
    log("Жизни закончились — забег завершён");
    updateUI();
    return;
  }

  const playerBag = grantBagReward(playerContainers, round, GRID_COLS, GRID_ROWS, playerItems);
  if (playerBag.granted) {
    playerContainers = playerBag.containers;
    const bagName = ITEM_CATALOG[playerBag.bagId]?.name || "Сумка";
    log(`🎒 Новая сумка: ${bagName}! Инвентарь расширен.`);
    if (typeof scheduleCanvasFit === "function") scheduleCanvasFit();
    if (typeof CombatLog !== "undefined") {
      CombatLog.notifyBackpack(ITEM_CATALOG[playerBag.bagId]);
    }
  }

  const enemyBag = grantBagReward(enemyContainers, round, GRID_COLS, GRID_ROWS, enemyItems);
  if (enemyBag.granted) {
    enemyContainers = enemyBag.containers;
  }

  const enemyBattleWon = battleWinner === "enemy" ? true : battleWinner === "player" ? false : null;
  if (typeof syncDuePendingCraftClustersOnPrepEntry === "function") {
    syncDuePendingCraftClustersOnPrepEntry();
  }
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
    { forceArchetypeId: enemyClass },
  );
  enemyArchetype = enemyPrep.archetype;
  enemyClass = enemyPrep.classId;
  enemyGold = enemyPrep.gold;
  enemyContainers = enemyPrep.containers;
  enemyItems = enemyPrep.items;
  enemyBench = enemyPrep.bench;

  resetShopForNewRoundForSide("player");
  prepViewSide = "player";

  recalcSynergies();
  renderBattleStats();
  renderPlayerProfiles();
  pendingGameOver = false;
  updateUI();
  if (typeof PrepCountdown !== "undefined") {
    PrepCountdown.onPrepPhaseStarted(`solo:${round}`);
  }
}

function shouldApplyMetaUnlockForSide(side) {
  return isClassicModeActive() && side === "player";
}

function showRunComplete() {
  gameOver = true;
  releasePreviousBattleReplayFrames();
  lastBattleReplay = null;
  if (typeof DialogueEngine !== "undefined") DialogueEngine.reset("");
  const runCompletePayload = {
    spent: goldSpentTotal,
    earned: goldEarnedTotal,
  };
  if (typeof showRunCompleteForMode === "function") {
    showRunCompleteForMode(
      runResults,
      runItemStats,
      round,
      phase,
      captureRunEndBoardSnapshot(),
      runCompletePayload,
    );
    return;
  }
  showRunCompleteOverlay(runResults, runItemStats, round, phase, captureRunEndBoardSnapshot(), runCompletePayload);
}



function layoutGridOrigin(team) {
  if (phase === "prep") return 0;
  if (typeof shouldUseBBStackBattleLayout === "function" && shouldUseBBStackBattleLayout()) {
    return 0;
  }
  return team === "player" ? 0 : ENEMY_X;
}

function layoutBackpackY(team = "player") {
  if (typeof shouldUseBBStackBattleLayout === "function" && shouldUseBBStackBattleLayout()) {
    return team === "enemy" ? 0 : GRID_INNER_H + getBBBattleStackGap();
  }
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

function shouldUseLegacyBattleFloatSpawn() {
  return !(typeof shouldUseBBStackBattleLayout === "function" && shouldUseBBStackBattleLayout());
}

function throttleBattleEventSfx(id, gapMs = 70) {
  if (typeof playPrepSfx !== "function") return false;
  handleBattleEvent._sfxAt = handleBattleEvent._sfxAt || {};
  const now = performance.now();
  const last = handleBattleEvent._sfxAt[id] || 0;
  if (now - last < gapMs) return false;
  handleBattleEvent._sfxAt[id] = now;
  playPrepSfx(id);
  return true;
}

function handleBattleEvent(ev) {
  if (!canvas || !battleState || typeof floatLayer === "undefined") return;

  switch (ev.type) {
    case "damage": {
      const sourceSide = ev.sourceTeam === "player" ? battleState.player : battleState.enemy;
      const sourceItem = ev.sourceUid
        ? sourceSide?.items?.find((i) => i.uid === ev.sourceUid)
        : null;
      const col = sourceItem?.col ?? ev.sourceCol ?? 3;
      const row = sourceItem?.row ?? ev.sourceRow ?? 2;
      if (ev.amount > 0) throttleBattleEventSfx("battle_hit", 70);
      if (shouldUseLegacyBattleFloatSpawn()) {
        floatLayer.spawnDamage(canvas, ev.targetTeam, col, row, ev.amount);
      }
      break;
    }
    case "heal": {
      const side = ev.targetTeam === "player" ? battleState.player : battleState.enemy;
      const item = ev.targetUid
        ? side?.items?.find((i) => i.uid === ev.targetUid)
        : null;
      if (ev.amount > 0) throttleBattleEventSfx("battle_heal", 80);
      if (shouldUseLegacyBattleFloatSpawn()) {
        floatLayer.spawnHeal(canvas, ev.targetTeam, item?.col ?? 3, item?.row ?? 2, ev.amount);
      }
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
        const cy = layoutBackpackY(ev.targetTeam) + GRID_INNER_H / 2;
        const { vx, vy } = floatLayer.canvasToViewport(canvas, cx, cy);
        floatLayer.spawn(`☠️ −${ev.amount}`, "poison", vx, vy);
      }
      break;
    }
    case "block": {
      throttleBattleEventSfx("battle_block", 90);
      if (shouldUseLegacyBattleFloatSpawn()) {
        if (document.documentElement.dataset.battleHeroPlacement === "flank-arena"
          && typeof getProfileAvatarFloatAnchor === "function") {
          const pt = getProfileAvatarFloatAnchor(ev.targetTeam, 0);
          floatLayer.spawn(`🛡 ${ev.amount}`, "block", pt.x, pt.y);
        } else {
          const cx = gridOrigin(ev.targetTeam) + GRID_INNER_W / 2;
          const cy = layoutBackpackY(ev.targetTeam) + 20;
          const { vx, vy } = floatLayer.canvasToViewport(canvas, cx, cy);
          floatLayer.spawn(`🛡 ${ev.amount}`, "block", vx, vy);
        }
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
    y: layoutBackpackY(team) + row * stride,
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
  return Math.floor((y - layoutBackpackY(team)) / stride);
}
function isOnBoard(mx, my, team = "player") {
  const ox = layoutGridOrigin(team);
  const oy = layoutBackpackY(team);
  return mx >= ox && mx < ox + GRID_INNER_W && my >= oy && my < oy + GRID_INNER_H;
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
  if (e.target?.closest?.("#sell-drop-zone, #shop-sell-zone, #bb-prep-commerce-sell")) return true;
  const r = zone.getBoundingClientRect();
  return e.clientX >= r.left - pad && e.clientX <= r.right + pad
    && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
}

function isDropOnBench(e, opts = {}) {
  if (!e || phase !== "prep") return false;
  if (!opts.ignoreBoardTarget && dragFrom?.type === "bench" && hasPrepBoardDropTarget()) return false;
  const pad = isTouchUi() ? 14 : 0;

  if (typeof shouldUsePrepStoragePhysics === "function" && shouldUsePrepStoragePhysics()) {
    if (typeof PrepStoragePhysics !== "undefined") {
      if (PrepStoragePhysics.isPointerInside(e.clientX, e.clientY)) return true;
      if (PrepStoragePhysics.hitTestBenchIndex(e.clientX, e.clientY) >= 0) return true;
    }
    if (e.target?.closest?.("#prep-storage-mount, #prep-storage-arena, .prep-storage-body")) {
      return true;
    }
    const band = typeof PrepStoragePhysics !== "undefined"
      ? PrepStoragePhysics.getStorageBandRect?.()
      : null;
    if (band && e.clientX >= band.left - pad && e.clientX <= band.right + pad
      && e.clientY >= band.top - pad && e.clientY <= band.bottom + pad) {
      return true;
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
  const rotated = shouldUseBBPrepDrawRotate();
  if (rotated) {
    const bp = typeof bbPrepBitmapPointFromClient === "function"
      ? bbPrepBitmapPointFromClient(clientX, clientY, canvas)
      : { x: (clientX - rect.left) / rw * canvas.width, y: (clientY - rect.top) / rh * canvas.height };
    if (typeof bbPrepLogicalFromBitmap === "function") {
      return bbPrepLogicalFromBitmap(bp.x, bp.y, null, canvas.width, canvas.height);
    }
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
  const pt = canvasPointToClient(rect.x + rect.w / 2, rect.y + rect.h / 2);
  if (pt) return pt;
  const canvasRect = canvas.getBoundingClientRect();
  const scaleX = canvasRect.width / canvas.width;
  const scaleY = canvasRect.height / canvas.height;
  return {
    x: canvasRect.left + (rect.x + rect.w / 2) * scaleX,
    y: canvasRect.top + (rect.y + rect.h / 2) * scaleY,
  };
}

/** Logical canvas coords → viewport client coords (с fallback, без «угла экрана»). */
function boardPointToViewportClient(x, y) {
  const pt = canvasPointToClient(x, y);
  if (pt) return pt;
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

function boardItemClientCenter(item, team = prepViewSide) {
  if (!item) return null;
  if (typeof getItemCells === "function") {
    const cells = getItemCells(item);
    if (cells.length) {
      let sx = 0;
      let sy = 0;
      let count = 0;
      cells.forEach(([col, row]) => {
        const pt = boardCellClientCenter(col, row, team);
        if (!pt) return;
        sx += pt.x;
        sy += pt.y;
        count += 1;
      });
      if (count) return { x: sx / count, y: sy / count };
    }
  }
  if (typeof getItemVisualCenter === "function") {
    const center = getItemVisualCenter(item, team);
    if (center) return boardPointToViewportClient(center.x, center.y);
  }
  return null;
}

/** Canvas logical coords → viewport client coords (battle + prep). */
function canvasPointToClient(x, y) {
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
  const canvasRect = canvas.getBoundingClientRect();
  if (canvasRect.width <= 0 || canvasRect.height <= 0) return null;
  const rotated = shouldUseBBPrepDrawRotate();
  if (rotated && typeof bbPrepClientFromLogical === "function") {
    return bbPrepClientFromLogical(x, y, null, canvas);
  }
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
  const y = layoutBackpackY(team) + GRID_INNER_H / 2;
  return canvasPointToClient(x, y);
}

window.canvasPointToClient = canvasPointToClient;
window.boardPointToViewportClient = boardPointToViewportClient;
window.boardCellClientCenter = boardCellClientCenter;
window.boardItemClientCenter = boardItemClientCenter;
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
      if (typeof maybePrepArcHoverSound === "function") {
        maybePrepArcHoverSound(c, r);
      }
    } else if (isSlotCell(st.containers, c, r)) {
      hoverSlot = { col: c, row: r };
      hoverCell = null;
      if (typeof maybePrepArcHoverSound === "function") {
        maybePrepArcHoverSound(c, r);
      }
    } else {
      hoverCell = { col: c, row: r };
      hoverSlot = null;
      if (typeof maybePrepArcHoverSound === "function") {
        maybePrepArcHoverSound(null, null);
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


function draw() {
  if (isBattleResultFrozen()) return;
  if (shouldSkipFlankBattleCanvasDraw()) return;
  drawWorldLayer();
  drawFxLayer();
  if (phase === "prep"
    && typeof BBCraftTether !== "undefined"
    && typeof BBCraftTether.syncPendingBoardClusters === "function"
    && typeof dragPayload !== "undefined"
    && !dragPayload) {
    BBCraftTether.syncPendingBoardClusters(prepViewSide);
  }
}

function drawWorldLayer() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  if (phase === "prep") {
    const side = prepViewSide;
    const st = getSideState(side);
    const shake = typeof getPrepBackpackShakeOffset === "function"
      ? getPrepBackpackShakeOffset()
      : { x: 0, y: 0 };
    ctx.save();
    ctx.translate(shake.x, shake.y);
    applyBBPrepDrawRotate(ctx);
    const frameOptions = {
      showFullPlacementGrid: shouldShowFullContainerPlacementGrid(),
      containers: st.containers,
      items: st.items,
    };
    drawBackpackFrame(side, frameOptions);
    drawContainers(st.containers, side, false);
    drawSynergyVisuals(ctx, synergyAnimTime, synergyPreviewBuilt, "under", side);
    drawLoadoutItems(st.items, side, false);
    const skipHeavyPrepFx = dragPayload
      && typeof BattleFxTier !== "undefined"
      && BattleFxTier.shouldSkipHeavyPrepBoardFxDuringDrag?.();
    if (!skipHeavyPrepFx && typeof drawAllPrepItemIdleEffects === "function") {
      drawAllPrepItemIdleEffects(ctx, st.items, side, synergyAnimTime);
    }
    if (typeof drawPrepPlacementSlotVisuals === "function") {
      const slotDragging = typeof synergyState !== "undefined"
        && synergyState.isDragging
        && dragPayload;
      const shadowPlacement = slotDragging
        && typeof getPrepDragShadowPlacement === "function"
        ? getPrepDragShadowPlacement(st, side)
        : null;
      const dragHostItem = slotDragging
        && shadowPlacement
        && dragPayload
        && typeof isContainerItem === "function"
        && !isContainerItem(dragPayload.itemId)
        && typeof getPlacementSlotsForItem === "function"
        && getPlacementSlotsForItem(dragPayload.itemId).length
        ? {
          uid: dragFrom?.type === "item" ? dragFrom.item?.uid : "drag-preview-host",
          itemId: dragPayload.itemId,
          col: shadowPlacement.col,
          row: shadowPlacement.row,
          rotation: shadowPlacement.rotation || 0,
        }
        : null;
      drawPrepPlacementSlotVisuals(ctx, st.items, (c, r) => cellRect(side, c, r), {
        isDragging: !!slotDragging,
        previewItems: synergyPreviewBuilt?.previewItems,
        previewUid: synergyPreviewBuilt?.previewUid,
        dragHostItem,
        time: synergyAnimTime,
      });
    }
    drawSynergyVisuals(ctx, synergyAnimTime, synergyPreviewBuilt, "over", side);
    if (!skipHeavyPrepFx
      && typeof drawPrepSynergyEnhancements === "function"
      && typeof shouldShowIdlePrepBoardHighlights === "function"
      && shouldShowIdlePrepBoardHighlights()) {
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
    const craftDragTypes = /* @__PURE__ */ new Set(["shop", "bench", "item"]);
    const craftDragCtx = (dragPayload?.itemId && craftDragTypes.has(dragFrom?.type))
      ? {
        shopItemId: dragPayload.itemId,
        containers: st.containers,
        ctx: typeof getCraftContextFromGame === "function" ? getCraftContextFromGame(side) : {},
        boardOnly: dragFrom?.type === "shop",
      }
      : null;
    const hasCraftHighlights = typeof drawPrepCraftHighlights === "function"
      && drawPrepCraftHighlights(ctx, synergyAnimTime, side, st.items, st.bench, craftDragCtx);
    if (!skipHeavyPrepFx
      && typeof drawPrepPendingCraftHighlights === "function"
      && typeof shouldShowIdlePrepBoardHighlights === "function"
      && shouldShowIdlePrepBoardHighlights()) {
      drawPrepPendingCraftHighlights(ctx, synergyAnimTime, side, st.items);
    }
    canvas?.classList.toggle("craft-preview-mode", !!hasCraftHighlights);
    if (canEditPrepSide(side) && dragPayload
      && typeof getPrepDragShadowPlacement === "function"
      && getPrepDragShadowPlacement(st, side)) {
      if (typeof drawPrepDropPreview === "function") drawPrepDropPreview(ctx, side, st);
    }
    ctx.restore();
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
        drawContainers(getBattleCanvasContainers(playerContainers), "player", false);
        drawContainers(getBattleCanvasContainers(enemyContainers), "enemy", false);
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
    const prepCountdownActive = typeof PrepCountdown !== "undefined" && PrepCountdown.isActive();
    if (typeof hideBattleCountdownOverlay === "function" && !prepCountdownActive) {
      hideBattleCountdownOverlay();
    }
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
    applyBBPrepDrawRotate(fxCtx);
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
    if (typeof shouldUseBBStackPrepLayout === "function" && shouldUseBBStackPrepLayout()) {
      ctx.fillStyle = meadowCssColor("--bb-canvas-bg", meadowCssColor("--meadow-cream-deep", "#f5edd4"));
      ctx.fillRect(0, 0, w, h);
      return;
    }
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
  const oy = layoutBackpackY(team);
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
  if ((typeof shouldUseBBStackPrepLayout === "function" && shouldUseBBStackPrepLayout())
    || (typeof shouldUseBBStackBattleLayout === "function" && shouldUseBBStackBattleLayout())) {
    const a = meadowCssColor("--canvas-cell-a", "#c5ddb8");
    const b = meadowCssColor("--canvas-cell-b", "#b8d4a8");
    return (row + col) % 2 === 0 ? a : b;
  }
  if (!available) return meadowCssColor("--canvas-cell-blocked", "#a8c49a");
  const a = meadowCssColor("--canvas-cell-a", "#c5ddb8");
  const b = meadowCssColor("--canvas-cell-b", "#b8d4a8");
  return (row + col) % 2 === 0 ? a : b;
}

function shouldUseBBPrepContainerChrome() {
  if (typeof shouldUseBBStackBattleLayout === "function" && shouldUseBBStackBattleLayout()) {
    return true;
  }
  return typeof shouldUseBBStackPrepLayout === "function" && shouldUseBBStackPrepLayout();
}

function shouldHidePrepExpansionContainersInBattle() {
  return typeof shouldUseBBStackBattleLayout === "function" && shouldUseBBStackBattleLayout();
}

function getBattleCanvasContainers(containers) {
  if (!shouldHidePrepExpansionContainersInBattle()) return containers;
  return containers.filter((container) => !!ITEM_CATALOG[container.itemId]?.immovable);
}

function buildBattleCanvasCellSet(containers, items) {
  const slots = buildSlotSet(getBattleCanvasContainers(containers));
  (items || []).forEach((item) => {
    getItemCells(item).forEach(([c, r]) => slots.add(`${c},${r}`));
  });
  return slots;
}

function shouldUseBBPrepDrawRotate() {
  return typeof shouldRotateBBPrepField90 === "function"
    && shouldRotateBBPrepField90()
    && typeof phase !== "undefined"
    && phase === "prep";
}

function applyBBPrepDrawRotate(ctx) {
  if (typeof applyBBPrepBoardTransform === "function") {
    return applyBBPrepBoardTransform(ctx);
  }
  return false;
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
  const activeCells = revealAllBoardCells
    ? null
    : (isBattleUiPhase() && shouldHidePrepExpansionContainersInBattle()
      ? buildBattleCanvasCellSet(containers, items)
      : buildActiveVisualCellSet(containers, items));
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
  const bbPrep = shouldUseBBPrepContainerChrome();
  containers.forEach((container) => {
    const def = ITEM_CATALOG[container.itemId];
    const bounds = getContainerBounds(container);
    const alpha = dimmed ? 0.55 : 1;

    ctx.globalAlpha = alpha;
    if (bbPrep) {
      drawMergedOccupiedCells(ctx, team, getItemCells(container), {
        fillStyle: "rgba(88, 68, 48, 0.95)",
        bridgeGaps: true,
        inset: 1,
      });
    } else {
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
    }

    if (!bbPrep) {
      const boardW = bounds.maxCol - bounds.minCol + 1;
      const boardH = bounds.maxRow - bounds.minRow + 1;
      const stride = gridStrideFor(team);
      const gap = Math.max(0, stride - cell);
      const ox = gridOrigin(team) + bounds.minCol * stride;
      const oy = layoutBackpackY(team) + bounds.minRow * stride;
      const boardPixW = boardW * cell + Math.max(0, boardW - 1) * gap;
      const boardPixH = boardH * cell + Math.max(0, boardH - 1) * gap;

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
    }
    ctx.globalAlpha = 1;
  });
}

function drawLoadoutItems(items, team, dimmed) {
  const glowUid = !dragPayload && tooltipItem?.contentItem?.uid ? tooltipItem.contentItem.uid : null;
  const pendingCraftUids = (typeof shouldShowIdlePrepBoardHighlights === "function"
    && shouldShowIdlePrepBoardHighlights()
    && typeof getPendingCraftBoardUids === "function")
    ? getPendingCraftBoardUids(team)
    : new Set();
  const craftPartnerUids = new Set(pendingCraftUids);
  if (typeof shouldShowPrepCraftCommerceFx === "function"
    && shouldShowPrepCraftCommerceFx()
    && dragPayload?.itemId
    && typeof getCraftPartnerTargets === "function") {
    const craftDragTypes = new Set(["shop", "bench", "item"]);
    if (dragFrom && craftDragTypes.has(dragFrom.type)) {
      const st = getSideState(team);
      const ctx = typeof getCraftContextFromGame === "function" ? getCraftContextFromGame(team) : {};
      const targets = getCraftPartnerTargets(
        dragPayload.itemId,
        st.containers ?? [],
        st.items,
        st.bench,
        ctx,
        { boardOnly: dragFrom.type === "shop" },
      );
      targets.boardUids.forEach((uid) => craftPartnerUids.add(uid));
    }
  }
  const craftChargeUids = typeof getCraftMergeChargingUids === "function"
    ? getCraftMergeChargingUids(team)
    : new Set();
  items.forEach((item) => {
    if (typeof getCraftMergeHiddenUids === "function" && getCraftMergeHiddenUids(team).has(item.uid)) {
      return;
    }
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

    const flatPrepTiles = typeof phase !== "undefined" && phase === "prep";
    const itemCells = getItemCells(item);
    if (flatPrepTiles && !gemCellMap) {
      ctx.globalAlpha = alpha;
      drawMergedOccupiedCells(ctx, team, itemCells, {
        fillStyle: `${def.color}ee`,
        bridgeGaps: true,
        inset: 1,
      });
    } else {
      itemCells.forEach(([c, r]) => {
        const { x, y, w, h } = cellRect(team, c, r);
        const gemVis = gemCellMap?.get(`${c},${r}`);
        let fill = def.color;
        if (gemVis?.gemId) {
          fill = ITEM_CATALOG[gemVis.gemId]?.color || def.color;
        } else if (gemVis?.emptySocket) {
          fill = "#4a3868";
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fill + (flatPrepTiles ? "ee" : "dd");
        if (flatPrepTiles) {
          ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        } else {
          roundRect(x + CELL_TILE_PAD, y + CELL_TILE_PAD, w - CELL_TILE_PAD * 2, h - CELL_TILE_PAD * 2, 5);
          ctx.fill();
          ctx.strokeStyle = RARITY_COLORS[def.rarity] || "#8b949e";
          ctx.lineWidth = 1.5;
          roundRect(x + CELL_TILE_PAD, y + CELL_TILE_PAD, w - CELL_TILE_PAD * 2, h - CELL_TILE_PAD * 2, 5);
          ctx.stroke();
        }
      });
    }
    ctx.globalAlpha = alpha;
    drawPlacedItemIcons(ctx, def, item, (c, r) => cellRect(team, c, r), {
      glow: glowUid === item.uid,
      craftPendingGlow: craftPartnerUids.has(item.uid),
      craftMergeChargeGlow: craftChargeUids.has(item.uid),
    });
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
      drawMergedShapeCells(targetCtx, team, col, row, shape, {
        fillStyle: valid ? "rgba(63,185,80,0.4)" : "rgba(248,81,73,0.4)",
        bridgeGaps: true,
        inset: 0,
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
  const benchOk = typeof canFitOnBench === "function"
    ? canFitOnBench(st, displaced.length)
    : st.bench.length + displaced.length <= MAX_BENCH;
  const valid = placement.valid && benchOk && slotOk;
  const previewRot = visual.spinning ? drawRot : placement.rotation;
  const previewCol = placement.valid ? placement.col : hoverSlot.col;
  const previewRow = placement.valid ? placement.row : hoverSlot.row;
  const shape = rotateShape(ITEM_CATALOG[dragPayload.itemId].shape, previewRot);
  wrapSpin(previewCol, previewRow, shape, () => {
    drawMergedShapeCells(targetCtx, team, previewCol, previewRow, shape, {
      fillStyle: valid ? "rgba(63,185,80,0.45)" : "rgba(248,81,73,0.45)",
      bridgeGaps: true,
      inset: 0,
    });
  });
  displaced.forEach((item) => {
    drawMergedOccupiedCells(targetCtx, team, getItemCells(item), {
      fillStyle: valid ? "rgba(210,153,34,0.35)" : "rgba(248,81,73,0.25)",
      bridgeGaps: true,
      inset: 0,
    });
  });
}

function describeEffect(e, def) {
  switch (e.type) {
    case "damage":
      return `⚔ Урон: ${formatDamageRangeText(e)}${e.damageType ? ` (${formatDamageType(e.damageType)})` : ""}`;
    case "heal": return `❤ Лечение: ${e.value}`;
    case "block": return `🛡 Блок: ${e.value}`;
    case "poison": {
      const val = e.value ?? 0;
      if (e.trigger === "on_hit") {
        const ch = e.chance != null ? `${Math.round(e.chance * 100)}% ` : "";
        return `☠ При попадании: ${ch}+${val} яда`.trim();
      }
      if (e.trigger === "on_miss") {
        const ch = e.chance != null ? `${Math.round(e.chance * 100)}% ` : "";
        return `☠ При промахе: ${ch}+${val} яда`.trim();
      }
      return `☠ Яд: ${val}`;
    }
    case "slow": return `🐌 Замедление: ${Math.round((e.value || 0) * 100)}%`;
    case "passiveDefense": return `🦺 Защита: +${e.value}`;
    case "passiveMaxHp": return `❤ Макс. HP: +${e.value}`;
    case "passiveLuck": return `🍀 Удача: +${e.value}`;
    case "statMult": {
      const pct = Math.round(Math.abs(e.value) * 100);
      if (e.stat === "cooldown") return `⚡ Перезарядка: −${pct}%`;
      if (e.stat === "magicDamage") return `✨ Маг. урон: +${pct}%`;
      if (e.stat === "heal") return `💚 Лечение: +${pct}%`;
      return `💪 Урон: +${pct}%`;
    }
    case "lifesteal": return `🩸 Лечит на ${Math.round(e.value * 100)}% от урона`;
    case "buffTimed":
      if (e.stat === "heart") return `💖 Сердце: +${e.value} (каждые ${e.duration || 3} сек)`;
      return `🔥 +${Math.round(e.value * 100)}% ${e.stat || "урона"} на ${e.duration || 3} сек`;
    case "crit": return `🎯 Крит: ${Math.round((e.chance || 0) * 100)}%`;
    case "dodgePeriodic": return `💨 Уклонение каждые ${e.interval || 5} сек`;
    case "groundFire": return `🔥 Огонь на поле: ${e.value} урона в секунду`;
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
      return `📌 +${e.value || 1} урона за каждый ${label}`;
    }
    case "weaponDamageStart": return `⚔ В начале боя: оружие +${e.value || 0} урона`;
    case "stackThreshold": {
      if (typeof describeThresholdTooltip === "function") {
        const t = describeThresholdTooltip(e, getStackLabel);
        if (t) return t;
      }
      const stack = e.stack || "heat";
      const label = typeof getStackLabel === "function" ? getStackLabel(stack, e.threshold || 0) : stack;
      const parts = [`При ${e.threshold}+ ${label}`];
      if (e.weaponDamage) parts.push(`оружие +${e.weaponDamage} урона`);
      if (e.heal) parts.push(`+${e.heal} HP`);
      if (e.damage) parts.push(`${e.damage} урона`);
      if (e.critChance) parts.push(`+${Math.round(e.critChance * 100)}% крит`);
      return `📊 ${parts.join(", ")}`;
    }
    case "periodic":
      return typeof describePeriodicTooltip === "function"
        ? describePeriodicTooltip(e, def)
        : `⏱ Каждые ${e.interval || 3} сек: периодический эффект`;
    case "tagScaledStack": return `📌 +${e.perTag || e.value || 1} ${e.stack || "блок"} за каждый предмет с ${typeof formatItemTagMechanic === "function" ? formatItemTagMechanic(e.tag || "armor") : `[${formatTagLabel(e.tag || "armor")}]`}`;
    case "convertHp": return `❤️ −${e.hpCost || e.from} HP → +${e.stackGain || e.toStacks} ${e.stack || "regen"}`;
    case "timedDamageReduction": return `🛡 −${Math.round((e.value || 0.25) * 100)}% урона на ${e.duration || 3} сек`;
    case "cooldownStartMult": return `⚡ Предметы на ${Math.round((e.value || 0) * 100)}% быстрее`;
    case "hpLossRatio": return `❤️ В начале боя: −${Math.round((e.value || 0) * 100)}% HP`;
    case "revive": return `🔄 Перерождение с ${Math.round((e.hpRatio || 0.5) * 100)}% HP, неуязвимость ${e.invuln || 2} сек`;
    case "applyStun": {
      const chance = e.chance != null ? ` (${Math.round(e.chance * 100)}%)` : "";
      return `💫 Оглушение ${e.duration || 0.5} сек${chance}`;
    }
    case "bonusDamageOnStun": return `⚔ +${e.value || 1} урона по оглушённому`;
    case "cleanseDebuffs": return `✨ Снимает ${e.value || 1} негатива`;
    case "stealWeaponDamage": return `🗡 Украсть ${e.value || 1} урона с оружия противника`;
    case "damagePerFoeDebuff": return `☠ +${e.value || 0.5} урона за негатив на враге`;
    case "damagePerTag": {
      const tagLabel = typeof formatTagLabel === "function" ? formatTagLabel(e.tag || "food") : (e.tag || "еда");
      const val = e.value || 1;
      return `🏷 +${val} к урону за каждую «${tagLabel}» на вашем поле`;
    }
    case "hpThreshold": {
      if (typeof describeThresholdTooltip === "function") {
        const t = describeThresholdTooltip(e, getStackLabel);
        if (t) return t;
      }
      const pct = Math.round((e.threshold || 0.7) * 100);
      const dir = e.direction === "above" ? "выше" : "ниже";
      return `❤️ Если здоровье ${dir} ${pct}%`;
    }
    case "activationThreshold": {
      if (typeof describeThresholdTooltip === "function") {
        const t = describeThresholdTooltip(e, getStackLabel);
        if (t) return t;
      }
      return `🔁 После ${e.count || e.threshold || 6} активаций`;
    }
    case "zeroStamina": return `⚡ При нулевой выносливости: +${e.restoreStamina || 2} выносливости`;
    case "invulnOnStaminaSpend": return `✨ Потратить ${e.staminaCost || 10} выносливости → неуязвимость ${e.duration || 2} сек`;
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
      return `⚡ На ${Math.round((e.perStack || 0.05) * 100)}% быстрее за каждый бонус на панели${e.maxStacks ? ` (макс. ${e.maxStacks})` : ""}`;
    case "heartThreshold": {
      if (typeof describeThresholdTooltip === "function") {
        const t = describeThresholdTooltip(e, getStackLabel);
        if (t) return t;
      }
      return `💖 При ${e.count || 7} сердцах — особый бонус`;
    }
    case "tagScaledMaxHp": return `❤️ +${e.perTag || 40} макс. HP за «${e.tag || "pet"}»`;
    case "passiveMaxStamina": return `⚡ +${e.value || 1} макс. выносливости`;
    case "onRevive": return `🔄 При перерождении: урон/яд по тегам`;
    case "onFoeHeal": return `☠ При лечении противника: яд`;
    case "critPerFoeDebuff": return `🎯 +${Math.round((e.value || 0.01) * 100)}% крит за негатив на враге`;
    case "lifestealPerTag": return `🩸 +${Math.round((e.value || 0.15) * 100)}% лечения от урона за ${typeof formatItemTagMechanic === "function" ? formatItemTagMechanic(e.tag || "cold") : `[${formatTagLabel(e.tag || "cold")}]`}`;
    case "healPerTag": {
      const scope = e.adjacent ? "соседний " : "";
      return `❤ +${e.value || 1} лечения за ${scope}предмет с ${typeof formatItemTagMechanic === "function" ? formatItemTagMechanic(e.tag || "vampiric") : `[${formatTagLabel(e.tag || "vampiric")}]`}`;
    }
    case "attackBuff": {
      const val = e.value ?? e.attackBuff ?? 0;
      const when = e.trigger === "on_miss"
        ? "При промахе"
        : e.trigger === "on_hit"
          ? "При попадании"
          : "После атаки";
      const chance = e.chance != null ? ` (${Math.round(e.chance * 100)}%)` : "";
      return `🎯 ${when}${chance}: следующая атака +${val} урона`;
    }
    case "gainWeakestStack": return `📊 +${e.value || 1} к самому слабому бонусу`;
    case "onHitCapBonus": return `⚔ При попадании: +${e.value || 1} урона (до ${e.cap || 7})`;
    case "breakBlockOnHit": return `🛡 Снять ${e.value || 4} блока при попадании`;
    case "breakBlockOnCrit": return `🛡 При крите: снять ${e.value || 15} блока`;
    case "critDamageMult": return `🎯 +${Math.round((e.value || 0.5) * 100)}% крит. урона`;
    case "mutualHpThreshold": {
      if (typeof describeThresholdTooltip === "function") {
        const t = describeThresholdTooltip(e, getStackLabel);
        if (t) return t;
      }
      return `❤️ Если у обоих <${Math.round((e.threshold || 0.8) * 100)}% здоровья`;
    }
    case "hitCounter": {
      const parts = [];
      if (e.gainStack) {
        const gs = e.gainStack;
        const label = typeof getStackLabel === "function" ? getStackLabel(gs.stack, gs.value || 1) : gs.stack;
        parts.push(`+${gs.value || 1} ${label}`);
      }
      if (e.heal) parts.push(`+${e.heal} HP`);
      const body = parts.length ? `: ${parts.join(", ")}` : "";
      return `🎯 Каждые ${e.threshold || 4} попадания${body}`;
    }
    case "battleRageLowHp": return `🔥 Боевая ярость (<50% HP): меньше урона, быстрее предметы`;
    case "selfPoison": return `☠ +${e.value || 1} яда себе при попадании`;
    case "onDefend": {
      if (typeof describeOnDefendTooltip === "function") return describeOnDefendTooltip(e);
      const ch = Math.round((e.chance ?? 1) * 100);
      return `🛡 При блоке или уклонении (${ch}% шанс)`;
    }
    case "activationLimit": return `⏳ До ${e.base || e.limit || 3} активаций за бой`;
    case "preventMiss": return `🎯 Потратить ресурс → отменить промах`;
    case "onActivate": {
      const parts = [];
      if (e.gainStack) {
        const gs = e.gainStack;
        const label = typeof getStackLabel === "function" ? getStackLabel(gs.stack, gs.value || 1) : gs.stack;
        parts.push(`+${gs.value || 1} ${label}`);
      }
      if (e.heal) parts.push(`+${e.heal} HP`);
      const ch = e.chance != null && e.chance < 1 ? ` (${Math.round(e.chance * 100)}% шанс)` : "";
      const body = parts.length ? `: ${parts.join(", ")}` : "";
      return `⚡ При активации${ch}${body}`;
    }
    case "foeHpThreshold": {
      if (typeof describeThresholdTooltip === "function") {
        const t = describeThresholdTooltip(e, getStackLabel);
        if (t) return t;
      }
      return `❤️ Если у противника <${Math.round((e.threshold || 0.5) * 100)}% здоровья`;
    }
    case "debuffThreshold": {
      if (typeof describeThresholdTooltip === "function") {
        const t = describeThresholdTooltip(e, getStackLabel);
        if (t) return t;
      }
      return `☠ При ${e.threshold || 10}+ негативах`;
    }
    case "procChanceBonus": return `🍀 +${Math.round((e.value || 0.12) * 100)}% к шансу эффектов`;
    case "damagePerTotalStacks": return `⚔ +${e.value || 1} урона за каждый бонус на панели`;
    case "staminaSpendOnHit": return `⚡ −${e.staminaCost || 1} выносливости → +${e.itemDamage || 1} урона`;
    case "stealRandomStack": return `📊 ${Math.round((e.chance ?? 1) * 100)}% украсть случайный бонус`;
    case "destroyFoeStacks": return `💥 Уничтожить ${e.value || 4} бонусов противника`;
    case "bonusDamageOnHit": return `⚔ ${Math.round((e.chance ?? 1) * 100)}% +${e.value || 1} урона`;
    case "healAsDamageMult": return `✨ ${Math.round((e.value || 0.3) * 100)}% лечения как маг. урон`;
    case "stackGainMult": return `📊 Бонусы на панели на ${Math.round((e.value || 1) * 100)}% эффективнее`;
    case "maxHpPercentStart": return `❤ +${Math.round((e.value || 0.12) * 100)}% макс. HP в начале боя`;
    case "max_hp_per_start_item": return `❤ +${e.value || 2} макс. HP за стартовый предмет`;
    case "staminaRegenPerStack": return `⚡ +${Math.round((e.value || 0.007) * 1000) / 10} выносливости в сек за каждый бонус на панели`;
    case "stonesMultiThrow": return `🪨 Камни можно метать многократно`;
    case "onFatigueStart": return `⏳ При усталости: урон и замедление предметов`;
    case "fatigueDamageOnHit": return `💀 Урон от усталости при попадании`;
    case "critPerFoeFatigue": return `🎯 +${Math.round((e.value || 0.07) * 100)}% крит за усталость противника`;
    case "cardScaledBonus": return `🃏 +${e.perCard || 5} ${e.stack || "бонуса"} за каждую карту`;
    case "cardScaledDamage": return `🃏 ${e.base || 12} (+${e.perCard || 4}/карта) маг. урона`;
    case "neutralScaledStack": return `📦 +${e.perItem || 8} ${e.stack || "жара"} за нейтральный предмет`;
    case "selfPoisonStart": return `☠ В начале боя: +${e.value || 3} яда себе`;
    default: return `${typeof localizeBbDescription === "function" ? localizeBbDescription(e.type) : e.type}${e.value != null ? `: ${e.value}` : ""}`;
  }
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
  const dragActive = !!(dragPayload || pendingShopDrag || pendingBenchDrag);
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



function hitTest(mx, my) {
  const side = prepViewSide;
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




function updateUI() {
  if ((phase === "prep" || isBattleUiPhase()) && typeof ensureCombatFeedReady === "function") {
    ensureCombatFeedReady();
  }
  renderPlayerProfiles();
  renderRunStats();
  if (typeof syncBBRunLivesHud === "function") syncBBRunLivesHud();
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
  if (phase === "prep" && !gameOver) {
    ensureShopReadyForSide(prepViewSide);
    updatePrepSideUI();
    renderShop();
    renderBench();
    renderFightButton();
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

function getPrepHeroCardDisplayTitle(side = prepViewSide || "player", mutationProgress = null) {
  const rt = getSideMutationRuntime(side);
  if (!rt.classId) {
    return side === "player" ? getPlayerProfileName() : getEnemyDisplayName();
  }
  const novice = typeof getNoviceClassLabel === "function"
    ? getNoviceClassLabel(rt.classId)
    : "Герой";
  if (rt.mutationId && typeof getMutationById === "function") {
    const m = getMutationById(rt.mutationId);
    return `${novice} → ${String(m?.name || rt.mutationId).toUpperCase()}`;
  }
  const formRound = typeof MUTATION_ROUND_FORM !== "undefined" ? MUTATION_ROUND_FORM : 8;
  if (rt.formId && round >= formRound && typeof getMutationById === "function") {
    const m = getMutationById(rt.formId);
    return `${novice} → ${String(m?.formName || rt.formId).toUpperCase()}`;
  }
  const leaderName = mutationProgress?.leader?.name;
  if (leaderName) {
    return `${novice} → ${String(leaderName).toUpperCase()}`;
  }
  return novice;
}

function renderPrepMilestoneHintHtml(roundNum, formId, mutationId) {
  const formR = typeof MUTATION_ROUND_FORM !== "undefined" ? MUTATION_ROUND_FORM : 8;
  const finalR = typeof MUTATION_ROUND_FINAL !== "undefined" ? MUTATION_ROUND_FINAL : 16;
  if (mutationId) return "";
  if (formId && roundNum >= formR) {
    const left = Math.max(0, finalR - roundNum);
    if (!left) return "";
    return `<span class="prep-milestone-chip" title="Полная мутация R${finalR}">R${finalR} · ещё ${left}</span>`;
  }
  if (roundNum < formR) {
    return `<span class="prep-milestone-chip" title="Первая форма R${formR}">R${formR} · ещё ${formR - roundNum}</span>`;
  }
  return "";
}

function renderPrepCompanionChipHtml(companion) {
  if (!companion) return "—";
  const safeName = typeof escapeClassHtml === "function"
    ? escapeClassHtml(companion.name)
    : companion.name;
  const hintRaw = String(companion.desc || "").split(/[.!]/)[0]?.trim() || "";
  const hint = typeof escapeClassHtml === "function" ? escapeClassHtml(hintRaw) : hintRaw;
  const hintHtml = hint
    ? `<span class="prep-companion-chip-hint">${hint}</span>`
    : "";
  return `<span class="prep-companion-chip"><button type="button" class="prep-companion-tip" data-companion-id="${companion.id}" aria-label="Спутник: ${safeName}">${companion.emoji} ${safeName}</button>${hintHtml}</span>`;
}

function syncPrepHeroCardChrome(side = prepViewSide || "player") {
  const viewTag = document.getElementById("prep-hero-card-view-tag");
  if (!viewTag) return;
  viewTag.classList.add("hidden");
  viewTag.innerHTML = "";
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
    if (typeof syncPrepBuildEmojiBtnMount === "function") syncPrepBuildEmojiBtnMount();
    if (typeof syncPrepBuildEmojiBtn === "function") {
      const playerArchetype = getSideMutationRuntime("player");
      const enemyArchetype = getSideMutationRuntime("enemy");
      const playerProgress = typeof resolveMutationProgress === "function"
        ? resolveMutationProgress({
          classId: playerArchetype.classId,
          companionId: playerArchetype.companionId,
          items: playerArchetype.items,
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
    if (typeof syncPrepHeroMutationBadge === "function") syncPrepHeroMutationBadge(null, null, round);
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
      round,
    })
    : null;
  const companion = typeof getCompanionById === "function" ? getCompanionById(mutRt.companionId) : null;
  const displayTitle = getRunDisplayTitle(side);
  const heroCardHud = isPrepHeroCardHud();
  const useMutationHud = typeof shouldUseMutationSystem !== "function" || shouldUseMutationSystem();
  const mutationDeltas = typeof notifyPrepMutationProgressChange === "function"
    ? notifyPrepMutationProgressChange(mutationProgress)
    : null;
  const mutationHtml = useMutationHud && typeof renderMutationProgressHtml === "function"
    ? renderMutationProgressHtml(mutationProgress, mutRt.formId, mutRt.mutationId, round, {
      heroCard: heroCardHud,
      deltas: mutationDeltas,
    })
    : "";
  const keyStatusHtml = useMutationHud && typeof renderPrepBuildKeyStatusHtml === "function"
    ? renderPrepBuildKeyStatusHtml(mutRt.items)
    : "";
  const ampStatusHtml = useMutationHud && typeof renderPrepAmplifierStatusHtml === "function"
    ? renderPrepAmplifierStatusHtml(mutRt.items)
    : "";
  const modifierStripHtml = `${keyStatusHtml}${ampStatusHtml}`;
  const enhancements = useMutationHud && typeof syncEnhancementsFromBackpack === "function"
    ? syncEnhancementsFromBackpack(
      mutRt.items,
      typeof createEmptyEnhancementLoadout === "function" ? createEmptyEnhancementLoadout() : { head: null, chest: null, boots: null },
      round,
    )
    : null;
  const enhancementHtml = enhancements && typeof renderPrepEnhancementStripHtml === "function"
    ? renderPrepEnhancementStripHtml(round, enhancements, { heroCard: heroCardHud })
    : "";

  if (statsHud) {
    const roundLabel = `${Math.min(round, RUN_BATTLES)}/${RUN_BATTLES}`;
    const hpLabel = profile.hpDisplay;
    const hpRowClass = "";
    const companionLabel = renderPrepCompanionLabelHtml(companion);
    const heroCardName = heroCardHud
      ? getPrepHeroCardDisplayTitle(side, mutationProgress)
      : displayTitle;
    const milestoneHint = heroCardHud && useMutationHud
      ? renderPrepMilestoneHintHtml(round, mutRt.formId, mutRt.mutationId)
      : "";
    const identitySubParts = [];
    if (milestoneHint) identitySubParts.push(milestoneHint);
    if (heroCardHud && useMutationHud && companion) {
      identitySubParts.push(`<span class="prep-hero-card__companion-wrap">${renderPrepCompanionChipHtml(companion)}</span>`);
    }
    const identitySubHtml = identitySubParts.length
      ? `<div class="prep-hero-card__identity-sub">${identitySubParts.join("")}</div>`
      : "";
    const bbStackPrep = typeof shouldUseBBStackPrepLayout === "function" && shouldUseBBStackPrepLayout();
    const metricsInBottomBar = heroCardHud && !bbStackPrep;
    const metricsHtml = metricsInBottomBar
      ? (useMutationHud
        ? ""
        : `<div class="prep-stats-row prep-stats-row--companion"><span>${companionLabel}</span></div>`)
      : bbStackPrep
        ? `
        <div class="prep-stats-row prep-stats-row--bb-gold"><span>💰</span><b>${st.gold}</b></div>
        <div class="prep-stats-row${hpRowClass}"><span>❤️</span><b>${hpLabel}</b></div>`
        : `
        <div class="prep-stats-row prep-stats-row--companion"><span>${companionLabel}</span></div>
        <div class="prep-stats-row"><span>💰</span><b>${st.gold}</b></div>
        <div class="prep-stats-row${hpRowClass}"><span>❤️</span><b>${hpLabel}</b></div>
        <div class="prep-stats-row prep-stats-row--round"><span>Раунд</span><b>${roundLabel}</b></div>`;
    syncPrepBottomStats({
      gold: st.gold,
      hpLabel,
      roundLabel,
    });
    const bbGoldEl = document.getElementById("bb-prep-commerce-gold-value");
    if (bbGoldEl) bbGoldEl.textContent = String(st.gold);
    const buildSlot = document.getElementById("prep-hero-card-build-slot");
    if (buildSlot?.isConnected) buildSlot.remove();
    const statsHeaderHtml = heroCardHud
      ? `
      <div class="prep-hero-card__stats-row">
        <div class="prep-hero-card__identity">
          <div class="prep-stats-class">${heroCardName}</div>
          ${identitySubHtml}
        </div>
        <div class="prep-stats-metrics">
          ${metricsHtml}
        </div>
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
    if (heroCardHud && buildSlot) {
      const statsRow = statsHud.querySelector(".prep-hero-card__stats-row");
      if (statsRow) statsRow.insertBefore(buildSlot, statsRow.firstChild);
    }
    bindPrepModChipTooltips(statsHud);
    bindPrepCompanionTooltip(statsHud);
    if (typeof syncPrepHeroMutationBadge === "function") {
      syncPrepHeroMutationBadge(useMutationHud ? mutRt.formId : null, useMutationHud ? mutRt.mutationId : null, round);
    }
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

  if (typeof syncUnitFrameHudChrome === "function") {
    syncUnitFrameHudChrome();
  }

  if (phase === "prep" && typeof tickSoloPrepThoughts === "function") {
    tickSoloPrepThoughts();
  }
}

function renderPlayerProfiles(opts = {}) {
  const statsEl = document.getElementById("battle-stats-panel");
  const playerAvatarEl = document.getElementById("player-avatar-slot");
  const enemyAvatarEl = document.getElementById("enemy-avatar-slot");
  const lightSpectate = !!opts.lightSpectate;
  const viewState = getDisplayBattleState();

  if (opts.battleHudOnly && viewState && (phase === "battle" || phase === "replay")) {
    if (typeof syncLiveAvatarHeroFrame === "function") syncLiveAvatarHeroFrame(viewState);
    if (document.documentElement.dataset.battlePrepHeroLayer === "true"
      && typeof syncBattleArchetypeFloatsFromRuntime === "function") {
      syncBattleArchetypeFloatsFromRuntime();
    }
    return;
  }

  let playerProfile;
  let enemyProfile;
  const profilePlayerClass = playerClass;
  const profileEnemyClass = enemyClass;

  if (phase === "battle" && viewState) {
    playerProfile = computeCombatProfileFromBattleSide(
      viewState.player, profilePlayerClass, getPlayerProfileName(), viewState,
    );
    enemyProfile = computeCombatProfileFromBattleSide(
      viewState.enemy, profileEnemyClass, getEnemyDisplayName(), viewState,
    );
  } else if (phase === "replay" && viewState) {
    playerProfile = computeCombatProfileFromBattleSide(
      viewState.player, profilePlayerClass, getPlayerProfileName(), viewState,
    );
    enemyProfile = computeCombatProfileFromBattleSide(
      viewState.enemy, profileEnemyClass, getEnemyDisplayName(), viewState,
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
      const rt = getSideMutationRuntime(side);
      const classId = side === "player" ? playerClass : enemyClass;
      const progress = typeof resolveMutationProgress === "function"
        ? resolveMutationProgress({
          classId,
          companionId: rt.companionId,
          items: rt.items,
          round,
        })
        : null;
      return {
        formId: spectateFormId ?? rt.formId,
        mutationId: spectateMutationId ?? rt.mutationId,
        leaderId: progress?.leader?.id || null,
      };
    };
    const playerArchetype = resolveArchetype("player", null, null);
    const enemyArchetype = resolveArchetype("enemy", null, null);
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
  const bbStackBattle = typeof shouldUseBBStackBattleLayout === "function" && shouldUseBBStackBattleLayout();
  if (liveBattle && viewState && typeof bootstrapBattleThoughts === "function" && !bbStackBattle) {
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
    maxRound: RUN_BATTLES,
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
    if (bbStackBattle) {
      if (typeof syncBBBattleHud === "function") {
        syncBBBattleHud(viewState, playerProfile, enemyProfile);
      }
    } else if (typeof ensureBattleHeroShells === "function") {
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
    if (typeof syncUnitFrameHudChrome === "function") syncUnitFrameHudChrome();
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
    const avatarGap = (typeof BattleFxTier !== "undefined" && BattleFxTier.isLightBattleFx?.())
      ? 400
      : 200;
    if (avatarNow - (renderPlayerProfiles._avatarAt || 0) >= avatarGap) {
      renderPlayerProfiles._avatarAt = avatarNow;
      syncAllAvatarHeroEffects(playerProfile, enemyProfile, viewState);
    } else if (typeof syncLiveAvatarHeroFrame === "function") {
      syncLiveAvatarHeroFrame(viewState);
    }
    if (document.documentElement.dataset.battlePrepHeroLayer === "true"
      && typeof syncPrepBuildEmojiBtn === "function") {
      if (typeof syncPrepBuildEmojiBtnMount === "function") syncPrepBuildEmojiBtnMount();
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
  const rarityColor = getRarityNameColor(def.rarity);
  const shapeHtml = showShape ? renderItemShapeMiniHTML(def, { size: shapeSize }) : "";
  const iconHtml = `<div class="${getItemIconShellClass(def)}">${renderItemIconsHTML(def)}</div>`;
  const visualHtml = showShape
    ? `<div class="item-card-cluster">${iconHtml}${shapeHtml}</div>`
    : iconHtml;
  return `<div class="${classes}" style="--item-rarity-color:${rarityColor}"${dataAttrs ? ` ${dataAttrs}` : ""}>
    ${innerBefore}
    ${visualHtml}
    <div class="info"><div class="name">${def.name}</div>${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ""}</div>
    ${innerAfter}
  </div>`;
}

function renderBattleStats() {
  renderRunStats();
}

window.syncPrepHeroCardChrome = syncPrepHeroCardChrome;

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
  log,
  draw,
  recalcSynergies,
  updateUI,
  playPrepSfx,
  isSyntheticMouseFromTouch,
  isTouchUi,
  isPrepCommerceDragActive: () => !!(dragPayload || pendingShopDrag || pendingBenchDrag),
  getSideCompanionId: (side) => (side === "enemy" ? enemyCompanionId : playerCompanionId),
  getSideMutationId: (side) => (side === "enemy" ? enemyMutationId : playerMutationId),
  getSideMutationFormId: (side) => (side === "enemy" ? enemyMutationFormId : playerMutationFormId),
  beginPendingShopDrag,
  beginPendingBenchDrag,
  startBenchDrag,
  shouldApplyMetaUnlockForSide,
});

init();
