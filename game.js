/**
 * Backpack Battles — браузерный автобатлер с рюкзаком
 */

const GRID_COLS = 9;
const GRID_ROWS = 7;
const GRID_CELL = uiPx(30);
const GRID_PLAYER_X = uiPx(14);
const GRID_GAP = uiPx(380);
const FRAME_PAD = uiPx(10);
const FRAME_TITLE_H = uiPx(24);
const FRAME_EDGE = uiPx(2);
const SHOP_FIELD_GAP = uiPx(12);
const BACKPACK_COLS = GRID_COLS;
const BACKPACK_ROWS = GRID_ROWS;
const CELL = GRID_CELL;
/** Y-координата сетки: заголовок рамки + верхний отступ, верх рамки = 0. */
const BACKPACK_Y = FRAME_TITLE_H + FRAME_PAD;
const GRID_TOP_Y = BACKPACK_Y;
const PLAYER_X = GRID_PLAYER_X;
const ENEMY_X = PLAYER_X + GRID_COLS * GRID_CELL + GRID_GAP;
const GAP_W = GRID_GAP;
const CANVAS_H = BACKPACK_Y + GRID_ROWS * CELL + FRAME_PAD + FRAME_EDGE;
const CANVAS_W = ENEMY_X + GRID_COLS * CELL + FRAME_PAD + FRAME_EDGE;
const MAX_BENCH = 6;
const MAX_SHOP = 5;
const SHOP_RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const START_GOLD = 12;
const ROUND_GOLD = 10;
const WIN_GOLD = 3;

let canvas, ctx;
let lastGameLoopDt = 0.016;
let phase = "prep";
let layoutCell = GRID_CELL;
let layoutPlayerX = GRID_PLAYER_X;
let layoutCanvasH = CANVAS_H;
let round = 1;
let gold = START_GOLD;
let shop = [];
let shopFrozen = [];
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
let goldSpentTotal = 0;
let goldEarnedTotal = 0;
let recentBattleResults = [];
let battleState = null;
let dragPayload = null;
let dragFrom = null;
let selectedBench = -1;
let gameOver = false;
let hoverCell = null;
let hoverSlot = null;
let mousePos = { x: 0, y: 0 };
let lastPointerClient = { x: 0, y: 0 };
let gamepadBoardFocus = null;
let synergyAnimTime = 0;
let synergyPreviewBuilt = null;
let tooltipItem = null;
let fieldTooltipVisible = false;
let sidebarTooltipSource = null;
let lastRoundStats = null;
let pendingGameOver = false;
let lastBattleReplay = null;
let lastBattlePrepSnapshot = null;
let replayPlayback = null;
let runResults = [];
let runItemStats = createEmptyRunItemStats();
let battleEndHandled = false;
let pendingShopDrag = null;
let shopDidDrag = false;
let opponentMode = "ai";
let gameMode = "solo";
let prepViewSide = "player";
let selectedGameMode = "solo";
let selectedOpponentMode = "ai";
let selectedEnemyClass = null;
let pendingPlayerClass = null;
let enemyShop = [];
let enemyShopFrozen = [];
let enemyShopReadyForRound = 0;

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
  };
}

function isVersusMode() {
  return gameMode === "versus";
}

function getEnemyDisplayName() {
  return isVersusMode() ? "Игрок 2" : "ИИ";
}

function getPlayerProfileName() {
  return isVersusMode() ? "Игрок 1" : "Игрок";
}

function getShopSideLabel(side) {
  if (side === "enemy") {
    return isVersusMode() ? "Игрок 2" : (isEnemyPrepEditable() ? "Противник" : "ИИ");
  }
  return isVersusMode() ? "Игрок 1" : "Вы";
}

function isEnemyPrepEditable() {
  return opponentMode === "manual";
}

function canEditPrepSide(side = prepViewSide) {
  if (side === "player") return true;
  return isEnemyPrepEditable();
}

function getPrepFieldTeam() {
  return prepViewSide;
}

function getShopContextForSide(side = prepViewSide) {
  const st = getSideState(side);
  const otherItems = side === "player" ? enemyItems : playerItems;
  return {
    round,
    gold: st.gold,
    goldSpentTotal: side === "player" ? goldSpentTotal : 0,
    goldEarnedTotal: side === "player" ? goldEarnedTotal : 0,
    recentResults: recentBattleResults.slice(-3),
    playerClass: st.classId,
    loadoutTags: collectLoadoutTags(st.items),
    opponentLoadoutTags: collectLoadoutTags(otherItems),
  };
}

function ensureSideShopArrays(st) {
  if (st.shop.length !== MAX_SHOP) st.shop.length = MAX_SHOP;
  if (st.shopFrozen.length !== MAX_SHOP) st.shopFrozen.length = MAX_SHOP;
  for (let i = 0; i < MAX_SHOP; i++) {
    if (st.shop[i] === undefined) st.shop[i] = null;
    if (st.shopFrozen[i] === undefined) st.shopFrozen[i] = false;
  }
}

function refreshShopSlotsForSide(side = prepViewSide) {
  const st = getSideState(side);
  ensureSideShopArrays(st);
  const ctx = getShopContextForSide(side);
  const unfrozen = [];
  for (let i = 0; i < MAX_SHOP; i++) {
    if (st.shopFrozen[i] && st.shop[i]) continue;
    unfrozen.push(i);
  }
  if (!unfrozen.length) return;
  const rolled = rollShopBatch(unfrozen.length, ctx);
  unfrozen.forEach((shopIndex, j) => {
    st.shop[shopIndex] = rolled[j] || rollShopItemGuaranteed(ctx);
  });
}

function resetShopForNewRoundForSide(side = prepViewSide) {
  if (gameOver) return;
  refreshShopSlotsForSide(side);
  getSideState(side).shopReadyForRound = round;
}

function ensureShopReadyForSide(side = prepViewSide) {
  if (gameOver) return;
  const st = getSideState(side);
  ensureSideShopArrays(st);
  if (st.shopReadyForRound !== round) resetShopForNewRoundForSide(side);
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

function setPrepViewSide(side) {
  if (side !== "player" && side !== "enemy") return;
  if (side === prepViewSide) return;
  clearDragUiState();
  prepViewSide = side;
  const app = document.getElementById("app");
  if (app) app.dataset.prepSide = side;
  if (typeof resetPrepFocus === "function") resetPrepFocus();
  syncBattleArenaLayout();
  updatePrepSideUI();
  ensureShopReadyForSide(side);
  renderShop();
  renderBench();
  recalcSynergies();
  updateUI();
}

function updatePrepSideUI() {
  document.querySelectorAll(".prep-side-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.prepSide === prepViewSide);
  });
  const editable = canEditPrepSide();
  const shopPanel = document.getElementById("shop-panel");
  shopPanel?.classList.toggle("shop-readonly", !editable);
  const title = document.getElementById("shop-panel-title");
  const hint = document.getElementById("shop-panel-hint");
  const sideHint = document.getElementById("prep-side-hint");
  const refreshBtn = document.getElementById("btn-refresh");
  const playerBtn = document.getElementById("btn-prep-player");
  const enemyBtn = document.getElementById("btn-prep-enemy");

  if (isVersusMode()) {
    if (playerBtn) playerBtn.textContent = "🧑 Игрок 1";
    if (enemyBtn) enemyBtn.textContent = "🧑 Игрок 2";
    if (prepViewSide === "enemy") {
      if (title) title.textContent = "🛒 Магазин · Игрок 2";
      if (hint) hint.textContent = "Покупки и расстановка второго игрока · Tab — вернуться к игроку 1";
      if (sideHint) sideHint.textContent = "Редактируете стол и магазин игрока 2 · Tab — переключить";
    } else {
      if (title) title.textContent = "🛒 Магазин · Игрок 1";
      if (hint) hint.textContent = "Покупки и расстановка первого игрока · Tab — перейти к игроку 2";
      if (sideHint) sideHint.textContent = "Редактируете стол и магазин игрока 1 · Tab — переключить";
    }
  } else if (prepViewSide === "enemy") {
    if (playerBtn) playerBtn.textContent = "🧑 Мой стол";
    if (enemyBtn) enemyBtn.textContent = "🤖 Противник";
    if (title) title.textContent = "🛒 Магазин ИИ (просмотр)";
    if (hint) hint.textContent = "ИИ управляет этим билдом сам — только просмотр";
    if (sideHint) sideHint.textContent = "Просмотр билда ИИ · Tab — ваш магазин и стол";
  } else {
    if (playerBtn) playerBtn.textContent = "🧑 Мой стол";
    if (enemyBtn) enemyBtn.textContent = "🤖 Противник";
    if (title) title.textContent = "🛒 Магазин";
    if (hint) hint.textContent = "Перетащите предмет в инвентарь или на скамейку · 📍 — заморозить";
    if (sideHint) sideHint.textContent = "Ваш магазин и стол · Tab — билд бота · ⚗️ Рецепты — в панели магазина";
  }
  if (refreshBtn) refreshBtn.disabled = !editable;
  updateShopGoldStat();
}

function updateShopGoldStat() {
  const el = document.getElementById("shop-gold-stat");
  if (!el || phase !== "prep") return;
  const st = getSideState(prepViewSide);
  el.textContent = `💰 ${st.gold} · ${getShopSideLabel(prepViewSide)}`;
}

function showGameModeStep() {
  document.getElementById("class-step-mode")?.classList.remove("hidden");
  document.getElementById("class-step-player")?.classList.add("hidden");
  document.getElementById("class-step-opponent")?.classList.add("hidden");
  document.getElementById("class-modal-title").textContent = "Режим игры";
  document.getElementById("class-modal-subtitle").textContent = "Одиночная — против бота. Противостояние — два игрока за одним экраном.";
}

function showPlayerClassStep() {
  document.getElementById("class-step-mode")?.classList.add("hidden");
  document.getElementById("class-step-player")?.classList.remove("hidden");
  document.getElementById("class-step-opponent")?.classList.add("hidden");
  document.getElementById("class-modal-title").textContent = selectedGameMode === "versus"
    ? "Игрок 1 — класс"
    : "Выберите класс";
  document.getElementById("class-modal-subtitle").textContent = selectedGameMode === "versus"
    ? "Первый игрок выбирает класс и стартовый набор."
    : "Каждый класс получает стартовый набор и уникальный бонус на весь забег.";
}

function resetClassSelectOverlay() {
  pendingPlayerClass = null;
  selectedEnemyClass = null;
  selectedGameMode = "solo";
  selectedOpponentMode = "ai";
  document.querySelectorAll(".game-mode-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.gameMode === "solo");
  });
  document.querySelectorAll(".class-card[data-class]").forEach((card) => card.classList.remove("selected"));
  document.querySelectorAll(".opponent-class-card").forEach((card) => card.classList.remove("selected"));
  showGameModeStep();
  updateStartRunButton();
}

function showSecondClassStep() {
  document.getElementById("class-step-mode")?.classList.add("hidden");
  document.getElementById("class-step-player")?.classList.add("hidden");
  document.getElementById("class-step-opponent")?.classList.remove("hidden");
  const heading = document.getElementById("class-step-opponent-heading");
  const hint = document.getElementById("opponent-mode-hint");
  if (selectedGameMode === "versus") {
    document.getElementById("class-modal-title").textContent = "Игрок 2 — класс";
    document.getElementById("class-modal-subtitle").textContent = `Игрок 1: ${getClassById(pendingPlayerClass)?.name || pendingPlayerClass}`;
    if (heading) heading.textContent = "Класс второго игрока";
    if (hint) hint.textContent = "Перед боем оба игрока по очереди покупают в магазине (Tab или кнопки внизу).";
  } else {
    document.getElementById("class-modal-title").textContent = "Класс бота";
    document.getElementById("class-modal-subtitle").textContent = `Ваш класс: ${getClassById(pendingPlayerClass)?.name || pendingPlayerClass}`;
    if (heading) heading.textContent = "Класс бота";
    if (hint) hint.textContent = "Бот сам покупает предметы и расставляет билд между боями.";
  }
  if (!selectedEnemyClass) selectedEnemyClass = pendingPlayerClass === "mage" ? "warrior" : "mage";
  document.querySelectorAll(".opponent-class-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.opponentClass === selectedEnemyClass);
  });
  updateStartRunButton();
  scrollClassPickerCardIntoView(document.querySelector(`.opponent-class-card[data-opponent-class="${selectedEnemyClass}"]`));
}

function updateStartRunButton() {
  const btn = document.getElementById("btn-start-run");
  if (!btn) return;
  btn.disabled = !(pendingPlayerClass && selectedEnemyClass);
}

function scrollClassPickerCardIntoView(card) {
  card?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
}

function selectPlayerClass(classId) {
  pendingPlayerClass = classId;
  document.querySelectorAll(".class-card[data-class]").forEach((card) => {
    card.classList.toggle("selected", card.dataset.class === classId);
  });
  scrollClassPickerCardIntoView(document.querySelector(`.class-card[data-class="${classId}"]`));
  showSecondClassStep();
}

function selectGameMode(mode) {
  if (mode !== "solo" && mode !== "versus") return;
  selectedGameMode = mode;
  selectedOpponentMode = mode === "versus" ? "manual" : "ai";
  document.querySelectorAll(".game-mode-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.gameMode === mode);
  });
  showPlayerClassStep();
}

function selectOpponentClass(classId) {
  selectedEnemyClass = classId;
  document.querySelectorAll(".opponent-class-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.opponentClass === classId);
  });
  scrollClassPickerCardIntoView(document.querySelector(`.opponent-class-card[data-opponent-class="${classId}"]`));
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

function init() {
  canvas = document.getElementById("game-canvas");
  ctx = canvas.getContext("2d");
  canvas.height = CANVAS_H;
  canvas.width = CANVAS_W;
  syncBattleArenaLayout();
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (dragPayload && phase === "prep") rotateDragItem();
  });
  canvas.addEventListener("mouseleave", () => {
    if (!dragPayload) {
      hoverCell = null;
      hoverSlot = null;
      tooltipItem = null;
    }
  });
  window.addEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("mousemove", onGlobalMouseMove);
  window.addEventListener("mouseup", finishDragDrop);
  document.addEventListener("selectstart", (e) => {
    if (dragPayload || pendingShopDrag) e.preventDefault();
  });
  document.addEventListener("dragstart", (e) => {
    if (dragPayload || pendingShopDrag) e.preventDefault();
  });
  document.getElementById("btn-fight").addEventListener("click", startBattle);
  document.getElementById("btn-refresh")?.addEventListener("click", () => refreshShop(true));
  document.getElementById("btn-sell").addEventListener("click", sellSelected);
  document.getElementById("btn-restart").addEventListener("click", returnToMainMenu);
  document.querySelectorAll(".game-mode-card").forEach((btn) => {
    btn.addEventListener("click", () => selectGameMode(btn.dataset.gameMode));
  });
  document.querySelectorAll(".class-card[data-class]:not([disabled])").forEach((btn) => {
    btn.addEventListener("click", () => selectPlayerClass(btn.dataset.class));
  });
  document.querySelectorAll(".opponent-class-card").forEach((btn) => {
    btn.addEventListener("click", () => selectOpponentClass(btn.dataset.opponentClass));
  });
  document.getElementById("btn-class-back-mode")?.addEventListener("click", () => {
    showGameModeStep();
  });
  document.getElementById("btn-class-back")?.addEventListener("click", () => {
    showPlayerClassStep();
  });
  document.getElementById("btn-start-run")?.addEventListener("click", startRunFromOverlay);
  document.getElementById("btn-prep-player")?.addEventListener("click", () => setPrepViewSide("player"));
  document.getElementById("btn-prep-enemy")?.addEventListener("click", () => setPrepViewSide("enemy"));
  document.getElementById("btn-battle-continue")?.addEventListener("click", () => {
    transitionToPhase("prep", () => {
      hideBattleResultPopup();
      if (pendingGameOver) {
        showRunComplete();
        pendingGameOver = false;
        return;
      }
      document.getElementById("phase-label").textContent = "Подготовка";
      document.getElementById("phase-label").classList.remove("battle");
      updatePrepSideUI();
      renderFightButton();
      ensureShopReady();
      renderShop();
      updateUI();
    });
  });
  document.getElementById("btn-battle-replay")?.addEventListener("click", () => {
    startBattleReplay();
  });
  initBattleControls({ onSkip: skipBattle });
  loadBattleSettings();
  bindProfileStatusTooltips();
  bindRunStatsToggle();
  bindPlayerCharacteristicsControls(getPlayerCharacteristicsState, getEnemyCharacteristicsState);
  initBoardPreviewControls();
  initRecipeBookControls();
  initGamepadControls({
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
      setPrepViewSide(prepViewSide === "player" ? "enemy" : "player");
    },
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
  window.addEventListener("resize", syncBattleArenaLayout);
  showClassSelect();
  requestAnimationFrame(gameLoop);
}

function isBattleUiPhase() {
  return phase === "battle" || phase === "replay";
}

function getAppDataPhase() {
  return isBattleUiPhase() ? "battle" : "prep";
}

function applyPhaseCanvasLayout() {
  if (!canvas) return;
  layoutCell = GRID_CELL;
  layoutPlayerX = GRID_PLAYER_X;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  layoutCanvasH = CANVAS_H;
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
  if (app) {
    app.dataset.phase = getAppDataPhase();
    if (phase === "prep") app.dataset.prepSide = prepViewSide;
  }
  applyPhaseCanvasLayout();
  setBattleControlsVisible(isBattleUiPhase());
  syncBattleArenaLayout();
  renderPlayerProfiles();
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
  if (phase === "prep" && !gameOver) {
    ensureShopReadyForSide("player");
    if (isEnemyPrepEditable()) ensureShopReadyForSide("enemy");
    updatePrepSideUI();
    renderShop();
    renderBench();
  }
  renderFightButton();
  if (phase !== "prep") closeAllFighterCharacteristicsPopups();
}

function setPhase(newPhase) {
  phase = newPhase;
  renderPhase();
}

function transitionToPhase(newPhase, afterTransition) {
  const layout = document.querySelector(".game-layout");
  if (layout) layout.classList.add("phase-transitioning");
  window.setTimeout(() => {
    phase = newPhase;
    renderPhase();
    afterTransition?.();
    requestAnimationFrame(() => {
      layout?.classList.remove("phase-transitioning");
    });
  }, 200);
}

function getFieldLayoutMetrics() {
  const cell = GRID_CELL;
  const playerLeft = GRID_PLAYER_X - FRAME_PAD;
  const playerRight = GRID_PLAYER_X + GRID_COLS * cell + FRAME_PAD + FRAME_EDGE;
  const enemyLeft = ENEMY_X - FRAME_PAD;
  const enemyRight = ENEMY_X + GRID_COLS * cell + FRAME_PAD + FRAME_EDGE;
  const totalW = CANVAS_W;
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
}

function bindRunStatsToggle() {
  const btn = document.getElementById("btn-toggle-run-stats");
  const popover = document.getElementById("run-stats-popover");
  if (!btn || !popover) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleRunStatsPopover();
  });

  document.addEventListener("click", (e) => {
    if (popover.classList.contains("hidden")) return;
    if (e.target.closest(".run-stats-anchor")) return;
    closeRunStatsPopover();
  });
}

function isRunStatsPopoverOpen() {
  return isPopupOpen("run-stats-popover");
}

function openRunStatsPopover() {
  const btn = document.getElementById("btn-toggle-run-stats");
  const popover = document.getElementById("run-stats-popover");
  if (!btn || !popover) return;
  renderRunStats();
  popover.classList.remove("hidden");
  btn.setAttribute("aria-expanded", "true");
  btn.textContent = "📊 Скрыть статистику";
}

function closeRunStatsPopover() {
  const btn = document.getElementById("btn-toggle-run-stats");
  const popover = document.getElementById("run-stats-popover");
  if (!btn || !popover) return;
  popover.classList.add("hidden");
  btn.setAttribute("aria-expanded", "false");
  btn.textContent = "📊 Показать статистику";
}

function toggleRunStatsPopover() {
  if (isRunStatsPopoverOpen()) closeRunStatsPopover();
  else openRunStatsPopover();
}

function returnToMainMenu() {
  pendingGameOver = false;
  gameOver = false;
  playerClass = null;
  gameMode = "solo";
  opponentMode = "ai";
  prepViewSide = "player";
  phase = "classSelect";
  dragPayload = null;
  dragFrom = null;
  clearDragUiState();
  closeRunStatsPopover();
  closeAllFighterCharacteristicsPopups();
  hideSidebarTooltip();
  hideSynergyTooltip();
  hideBoardPreviewPopup();
  hideBattleResultPopup();
  document.getElementById("overlay")?.classList.add("hidden");
  document.getElementById("class-overlay")?.classList.remove("hidden");
  resetClassSelectOverlay();
  document.getElementById("phase-label").textContent = "Выбор класса";
  document.getElementById("phase-label").classList.remove("battle");
  renderPhase();
  renderFightButton();
}

function showClassSelect() {
  returnToMainMenu();
}

function getShopContext() {
  return getShopContextForSide("player");
}

function startRunFromOverlay() {
  if (!pendingPlayerClass || !selectedEnemyClass) return;
  gameMode = selectedGameMode;
  playerClass = pendingPlayerClass;
  opponentMode = gameMode === "versus" ? "manual" : "ai";
  enemyClass = selectedEnemyClass;
  enemyArchetype = AI_ARCHETYPES[selectedEnemyClass] || AI_ARCHETYPES.warrior;
  prepViewSide = "player";
  document.getElementById("class-overlay")?.classList.add("hidden");
  const app = document.getElementById("app");
  if (app) app.dataset.gameMode = gameMode;
  restartGame();
}

function startRun(classId) {
  playerClass = classId;
  document.getElementById("class-overlay").classList.add("hidden");
  restartGame();
}

function restartGame() {
  if (!playerClass) {
    showClassSelect();
    return;
  }
  phase = "prep";
  round = 1;
  gold = START_GOLD;
  goldSpentTotal = 0;
  goldEarnedTotal = 0;
  recentBattleResults = [];
  runResults = [];
  runItemStats = createEmptyRunItemStats();
  bench = [];
  playerContainers = createStartingContainers();
  playerItems = applyClassStarters(playerContainers, [], playerClass);
  enemyGold = START_GOLD;
  enemyBench = [];
  if (opponentMode === "ai") {
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
  resetShopForNewRound();
  renderShop();
  renderBench();
  recalcSynergies();
  updateUI();
  renderRunStats();
  renderFightButton();
  document.getElementById("phase-label").textContent = "Подготовка";
  document.getElementById("phase-label").classList.remove("battle");
  log(isVersusMode()
    ? "Режим противостояния: Tab или кнопки — переключить магазин между игроками."
    : "Расставьте предметы и в бой! Tab — посмотреть билд бота.");
}

function refillShopSlots() {
  if (shop.length !== MAX_SHOP) shop = Array(MAX_SHOP).fill(null);
  if (shopFrozen.length !== MAX_SHOP) shopFrozen = Array(MAX_SHOP).fill(false);
  refreshShopSlotsForSide("player");
}

/** Кнопка «Обновить»: переролл всех незамороженных ячеек. */
function refreshShopSlots() {
  if (shop.length !== MAX_SHOP) shop = Array(MAX_SHOP).fill(null);
  if (shopFrozen.length !== MAX_SHOP) shopFrozen = Array(MAX_SHOP).fill(false);
  refreshShopSlotsForSide("player");
}

/** Начало раунда: обновить незамороженные ячейки (как бесплатное «Обновить»). */
function resetShopForNewRound() {
  resetShopForNewRoundForSide("player");
}

function ensureShopReady() {
  ensureShopReadyForSide("player");
}

function refreshShop(pay = false, side = prepViewSide) {
  if (gameOver || !canEditPrepSide(side)) return;
  const st = getSideState(side);
  if (pay) {
    if (phase !== "prep") return;
    if (st.gold < 1) return;
    st.gold -= 1;
    if (side === "player") goldSpentTotal += 1;
  }
  refreshShopSlotsForSide(side);
  if (phase === "prep") {
    renderShop();
    updateUI();
  }
}

function toggleShopFreeze(index, side = prepViewSide) {
  if (phase !== "prep" || gameOver || !canEditPrepSide(side) || !getSideState(side).shop[index]) return;
  const st = getSideState(side);
  st.shopFrozen[index] = !st.shopFrozen[index];
  const name = ITEM_CATALOG[st.shop[index]].name;
  log(st.shopFrozen[index] ? `📌 Закреплено: ${name}` : `📌 Снято закрепление: ${name}`);
  renderShop();
}

function isPopupOpen(id) {
  const el = document.getElementById(id);
  return !!(el && !el.classList.contains("hidden"));
}

function closeAllPopups() {
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

  return closed;
}

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function isPhaseTransitioning() {
  return document.querySelector(".game-layout")?.classList.contains("phase-transitioning");
}

function handleEnterHotkey(e) {
  if (e.key !== "Enter" || isPhaseTransitioning()) return false;
  if (isBoardPreviewOpen() || isPopupOpen("class-overlay")) {
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

function handleRecipeBookHotkey(e) {
  if (e.key !== "b" && e.key !== "B") return false;
  if (isPhaseTransitioning()) return false;
  toggleRecipeBookPopup();
  e.preventDefault();
  return true;
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
    if (closeAllPopups()) e.preventDefault();
    return;
  }

  if (e.key === "Enter") {
    if (handleEnterHotkey(e)) return;
  }

  if (handleRecipeBookHotkey(e)) return;

  if (handleCharacteristicsHotkey(e)) return;

  if (e.key === "r" || e.key === "R" || e.key === "к" || e.key === "К") {
    if (dragPayload && phase === "prep") rotateDragItem();
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
    setPrepViewSide(prepViewSide === "player" ? "enemy" : "player");
  }
}

function commitShopPurchase(index, side = prepViewSide) {
  const st = getSideState(side);
  const itemId = st.shop[index];
  if (!itemId) return null;
  const def = ITEM_CATALOG[itemId];
  if (st.gold < def.cost) return null;
  st.gold -= def.cost;
  if (side === "player") goldSpentTotal += def.cost;
  st.shop[index] = null;
  st.shopFrozen[index] = false;
  return itemId;
}

function buyFromShop(index, side = prepViewSide) {
  if (phase !== "prep" || gameOver || !canEditPrepSide(side)) return;
  const st = getSideState(side);
  if (!st.shop[index]) return;
  if (st.bench.length >= MAX_BENCH) { log("Скамейка полна!"); return; }
  const itemId = commitShopPurchase(index, side);
  if (!itemId) return;
  st.bench.push({ itemId, uid: `bench-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` });
  renderShop();
  renderBench();
  updateUI();
}

function getSellRefund(itemId) {
  return ITEM_CATALOG[itemId]?.cost || 0;
}

function creditItemSale(itemId, side = prepViewSide) {
  if (!itemId) return;
  getSideState(side).gold += getSellRefund(itemId);
}

function sellBenchEntry(index, side = prepViewSide) {
  const st = getSideState(side);
  const entry = st.bench[index];
  if (!entry) return false;
  creditItemSale(entry.itemId, side);
  (entry.carriedItems || []).forEach((ci) => creditItemSale(ci.itemId, side));
  st.bench.splice(index, 1);
  if (side === prepViewSide) {
    if (selectedBench === index) selectedBench = -1;
    else if (selectedBench > index) selectedBench -= 1;
  }
  return true;
}

function sellDraggedItem(side = prepViewSide) {
  if (!dragFrom || !dragPayload) return false;
  if (dragFrom.type === "shop") return false;

  if (dragFrom.type === "bench") {
    return sellBenchEntry(dragFrom.index, side);
  }
  if (dragFrom.type === "item") {
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

function sellSelected(side = prepViewSide) {
  const st = getSideState(side);
  if (selectedBench < 0 || !st.bench[selectedBench]) return;
  sellBenchEntry(selectedBench, side);
  renderBench();
  updateUI();
}

function restoreDraggedItem(side = prepViewSide) {
  if (!dragFrom) return;
  const st = getSideState(side);
  if (dragFrom.type === "item") {
    st.items = [...st.items, dragFrom.item];
  } else if (dragFrom.type === "container") {
    st.containers = [...st.containers, dragFrom.container];
    st.items = [...st.items, ...dragFrom.carriedItems];
  }
}

function syncUiDragState() {
  document.body.classList.toggle("is-ui-dragging", !!(dragPayload || pendingShopDrag));
}

function applyCraftingForSide(side = prepViewSide) {
  const st = getSideState(side);
  const result = tryResolveCrafting(st.containers, st.items);
  if (!result.crafted.length) return false;
  st.items = result.items;
  result.crafted.forEach((recipe) => {
    const out = ITEM_CATALOG[recipe.output];
    if (out) log(`⚗️ Крафт: ${out.icon} ${out.name}`);
  });
  return true;
}

function clearDragUiState() {
  document.querySelectorAll(".shop-card.shop-dragging").forEach((el) => el.classList.remove("shop-dragging"));
  pendingShopDrag = null;
  shopDidDrag = false;
  endSynergyPreview();
  synergyPreviewBuilt = null;
  canvas?.classList.remove("synergy-preview-mode");
  document.getElementById("bench-panel")?.classList.remove("bench-drop-target");
  document.getElementById("shop-sell-zone")?.classList.remove("sell-drop-target");
  dragPayload = null;
  dragFrom = null;
  clearGamepadBoardFocus();
  syncUiDragState();
}

function canStartBattle() {
  if (phase !== "prep" || gameOver || round > RUN_BATTLES) return false;
  if (playerItems.length === 0) return false;
  if (opponentMode === "manual" && enemyItems.length === 0) return false;
  return true;
}

function renderFightButton() {
  const btn = document.getElementById("btn-fight");
  if (!btn) return;
  const visible = phase === "prep" && !gameOver;
  btn.classList.toggle("hidden", !visible);
  if (visible) btn.disabled = !canStartBattle();
  if (visible && isVersusMode() && enemyItems.length === 0) {
    btn.title = "Игрок 2: положите предметы на стол";
  } else if (visible && playerItems.length === 0) {
    btn.title = "Положите предметы в сумку";
  } else {
    btn.title = "";
  }
}

function recalcSynergies() {
  applySynergyModifiersToContainers(playerContainers, playerItems);
  applySynergyModifiersToContainers(enemyContainers, enemyItems);
  refreshActiveSynergies(playerItems, enemyItems);
  renderPlayerProfiles();
}

function skipBattle() {
  if (phase !== "battle" || !battleState || battleState.finished) return;
  fastForwardBattle(battleState);
  renderBattleStats();
  if (battleState?.finished) endBattle();
}

function startBattleReplay() {
  if (!lastBattleReplay?.frames?.length || !lastBattlePrepSnapshot) return;
  hideBattleResultPopup();
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
  if (typeof setBattleEnemyTeamLabel === "function") {
    setBattleEnemyTeamLabel(getEnemyDisplayName());
  }
  battleState.recording = false;
  applyBattleFrame(battleState, lastBattleReplay.frames[0]);
  updateBattleControlsUI();
  renderFightButton();
  document.getElementById("phase-label").textContent = "Повтор боя";
  document.getElementById("phase-label").classList.add("battle");
}

function finishBattleReplay() {
  battleState = null;
  clearBattleFloatLayer();
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

  if (
    replayPlayback.index >= replayPlayback.frames.length - 1
    && replayPlayback.accum >= 0.35
  ) {
    finishBattleReplay();
  }
}

function startBattle() {
  if (!canStartBattle()) {
    if (phase === "prep" && playerItems.length === 0) {
      log("Положите хотя бы один предмет в сумку! (не только на скамейку)");
    } else if (phase === "prep" && isVersusMode() && enemyItems.length === 0) {
      log("Игрок 2: положите предметы на стол (Tab — переключить магазин)");
    }
    return;
  }
  if (dragPayload) {
    dragPayload = null;
    dragFrom = null;
    synergyPreviewBuilt = null;
  }

  applyCraftingForSide("player");
  if (isVersusMode()) applyCraftingForSide("enemy");

  transitionToPhase("battle", () => {
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
    );
    battleState.recording = true;
    battleState.replayFrames = [captureBattleFrame(battleState)];
    battleState.lastRecordAt = 0;
    setBattleSpeed(savedBattleSpeed);
    updateBattleControlsUI();
    document.getElementById("phase-label").textContent = "Бой!";
    document.getElementById("phase-label").classList.add("battle");
    log(`Раунд ${round}: бой!`);
    renderBattleStats();
    renderPlayerProfiles();
    renderFightButton();
  });
}

function endBattle() {
  if (!battleState || battleEndHandled) return;
  battleEndHandled = true;

  const battleWinner = battleState.winner;
  const finishedState = battleState;
  battleState = null;
  clearBattleFloatLayer();

  let battleSummary;
  try {
    lastRoundStats = finishedState.itemDamageStats;
    accumulateRunItemStats(runItemStats, finishedState.itemDamageStats);
    let goldReward = 0;

    if (battleWinner === "player") {
      goldReward = ROUND_GOLD + WIN_GOLD;
      gold += goldReward;
      goldEarnedTotal += goldReward;
      recentBattleResults.push("win");
      log(`Победа в бою! +${goldReward}💰`);
    } else if (battleWinner === "enemy") {
      goldReward = ROUND_GOLD;
      gold += goldReward;
      goldEarnedTotal += goldReward;
      recentBattleResults.push("loss");
      log(`Поражение в бою. +${goldReward}💰`);
    } else {
      goldReward = ROUND_GOLD;
      gold += goldReward;
      goldEarnedTotal += goldReward;
      recentBattleResults.push("draw");
      log(`Ничья. +${goldReward}💰`);
    }

    battleSummary = buildBattleSummary(finishedState, {
      roundNum: round,
      goldReward,
    });

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
    resetShopForNewRound();

    setBattleControlsVisible(false);
    resetBattlePause();
  } catch (err) {
    console.error("endBattle summary failed:", err);
    battleSummary = buildBattleSummary(finishedState, { roundNum: round, goldReward: 0 });
    lastBattleReplay = {
      frames: finishedState.replayFrames || [],
      log: [...(finishedState.log || [])],
      summary: battleSummary,
      prepSnapshot: lastBattlePrepSnapshot,
    };
  }

  showBattleResultPopup(battleSummary, finishedState.log || []);

  try {
    applyPostBattlePrep(battleWinner);
  } catch (err) {
    console.error("applyPostBattlePrep failed:", err);
    updateUI();
  }
}

function applyPostBattlePrep(battleWinner) {
  if (gameOver) return;

  if (round > RUN_BATTLES) {
    pendingGameOver = true;
    updateUI();
    return;
  }

  const playerBag = grantBagReward(playerContainers, round, GRID_COLS, GRID_ROWS);
  if (playerBag.granted) {
    playerContainers = playerBag.containers;
    const bagName = ITEM_CATALOG[playerBag.bagId]?.name || "Сумка";
    log(`🎒 Новая сумка: ${bagName}! Инвентарь расширен.`);
  }

  const enemyBag = grantBagReward(enemyContainers, round, GRID_COLS, GRID_ROWS);
  if (enemyBag.granted) {
    enemyContainers = enemyBag.containers;
  }

  const enemyBattleWon = battleWinner === "enemy" ? true : battleWinner === "player" ? false : null;
  if (opponentMode === "ai") {
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
  showRunCompleteOverlay(runResults, runItemStats, round, phase, captureRunEndBoardSnapshot(), {
    spent: goldSpentTotal,
    earned: goldEarnedTotal,
  });
}

function gameLoop(ts) {
  if (!gameLoop.last) gameLoop.last = ts;
  const dt = Math.min(0.05, (ts - gameLoop.last) / 1000);
  gameLoop.last = ts;
  lastGameLoopDt = dt;
  synergyAnimTime += dt;

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
  }

  if (phase === "battle" && battleState && !battleState.finished) {
    const simDt = getBattleSimDt(dt);
    if (simDt > 0) {
      battleTick(battleState, simDt);
      recordBattleFrame(battleState);
    }
    if (Math.floor(ts / 500) !== Math.floor((ts - dt * 1000) / 500)) {
      renderBattleStats();
      renderPlayerProfiles();
    }
  } else if (phase === "battle" && battleState?.finished) {
    endBattle();
  } else if (phase === "replay") {
    tickReplay(dt);
    if (Math.floor(ts / 500) !== Math.floor((ts - dt * 1000) / 500)) {
      renderPlayerProfiles();
    }
  }
  if (phase === "prep") {
    tickDisplaceAnimations(dt);
    tickGamepad(dt);
  } else {
    tickGamepad(dt);
  }
  if (phase === "prep" && !dragPayload && !isPointerOverPrepSidebar(lastPointerClient.x, lastPointerClient.y)) {
    updateTooltip(mousePos.x, mousePos.y);
  } else if ((phase === "battle" || phase === "replay") && battleState && !dragPayload) {
    updateTooltip(mousePos.x, mousePos.y);
  }
  draw();
  requestAnimationFrame(gameLoop);
}

function gridOrigin(team) { return team === "player" ? layoutPlayerX : ENEMY_X; }
function cellRect(team, col, row) {
  const cell = team === "enemy" ? GRID_CELL : layoutCell;
  return { x: gridOrigin(team) + col * cell, y: BACKPACK_Y + row * cell, w: cell, h: cell };
}
function xToCol(x, team = "player") {
  const cell = team === "enemy" ? GRID_CELL : layoutCell;
  return Math.floor((x - gridOrigin(team)) / cell);
}
function yToRow(y, team = "player") {
  const cell = team === "enemy" ? GRID_CELL : layoutCell;
  return Math.floor((y - BACKPACK_Y) / cell);
}
function isOnBoard(mx, my, team = "player") {
  const ox = gridOrigin(team);
  const cell = team === "enemy" ? GRID_CELL : layoutCell;
  return mx >= ox && mx < ox + GRID_COLS * cell && my >= BACKPACK_Y && my < BACKPACK_Y + GRID_ROWS * cell;
}

function isDropOnSell(e) {
  const zone = document.getElementById("shop-sell-zone");
  if (!zone || !e) return false;
  if (e.target?.closest?.("#shop-sell-zone")) return true;
  const r = zone.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}

function isDropOnBench(e) {
  const panel = document.getElementById("bench-panel");
  if (!panel || !e) return false;
  if (e.target?.closest?.("#bench-panel")) return true;
  const r = panel.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}

function canvasCoordsFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

function getElementClientCenter(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
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
    } else if (isSlotCell(st.containers, c, r)) {
      hoverSlot = { col: c, row: r };
      hoverCell = null;
    } else {
      hoverCell = { col: c, row: r };
      hoverSlot = null;
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
  if (!gamepadBoardFocus || phase !== "prep") return;
  const team = prepViewSide;
  const { col, row } = gamepadBoardFocus;
  const { x, y, w, h } = cellRect(team, col, row);
  ctx.save();
  ctx.strokeStyle = "#f0c14b";
  ctx.lineWidth = 2.5;
  ctx.shadowColor = "rgba(240, 193, 75, 0.55)";
  ctx.shadowBlur = 8;
  roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 5);
  ctx.stroke();
  ctx.restore();
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
    return;
  }

  if (focus.zone === "actions") {
    const btns = [
      document.getElementById("btn-sell"),
      document.getElementById("btn-recipe-book"),
    ].filter(Boolean);
    btns[focus.index]?.click();
    return;
  }

  if (focus.zone === "header") {
    const btns = [
      document.getElementById("btn-fight"),
      document.getElementById("btn-refresh"),
    ].filter((el) => el && !el.disabled && !el.classList.contains("hidden"));
    btns[focus.index]?.click();
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

function updatePointerFromClient(clientX, clientY) {
  if (!canvas) return;
  lastPointerClient.x = clientX;
  lastPointerClient.y = clientY;
  const coords = canvasCoordsFromClient(clientX, clientY);
  mousePos.x = coords.x;
  mousePos.y = coords.y;

  if (phase === "prep") {
    hoverCell = null;
    hoverSlot = null;
    const synthetic = createSyntheticPointerEvent(clientX, clientY);
    updatePendingShopDrag(synthetic);
    const side = dragPayload && dragFrom?.side ? dragFrom.side : prepViewSide;
    const st = getSideState(side);
    if (dragPayload && canEditPrepSide(side) && isOnBoard(mousePos.x, mousePos.y, side)) {
      const col = xToCol(mousePos.x, side);
      const row = yToRow(mousePos.y, side);
      if (isContainerItem(dragPayload.itemId)) {
        hoverCell = { col, row };
      } else if (isSlotCell(st.containers, col, row)) {
        hoverSlot = { col, row };
      } else {
        hoverCell = { col, row };
      }
    }

    const overSidebar = isPointerOverPrepSidebar(clientX, clientY);
    if (overSidebar) {
      tooltipItem = null;
      syncFieldTooltip();
    } else {
      if (sidebarTooltipSource === "shop" || sidebarTooltipSource === "bench") {
        hideSidebarTooltip();
      }
      if (!dragPayload) {
        updateTooltip(mousePos.x, mousePos.y);
      }
    }

    const benchPanel = document.getElementById("bench-panel");
    if (benchPanel) {
      benchPanel.classList.toggle("bench-drop-target", !!(dragPayload && isDropOnBench(synthetic)));
    }
    const sellZone = document.getElementById("shop-sell-zone");
    if (sellZone) {
      sellZone.classList.toggle(
        "sell-drop-target",
        !!(dragPayload && dragFrom?.type !== "shop" && isDropOnSell(synthetic)),
      );
    }
  } else if ((phase === "battle" || phase === "replay") && battleState) {
    updateTooltip(mousePos.x, mousePos.y);
  }
}

function gamepadPointerDownAt(clientX, clientY) {
  if (phase !== "prep" || gameOver || !canEditPrepSide()) return;
  updatePointerFromClient(clientX, clientY);
  const synthetic = createSyntheticPointerEvent(clientX, clientY);
  const target = document.elementFromPoint(clientX, clientY);

  const shopCard = target?.closest?.(".shop-card:not(.empty)");
  if (shopCard && canEditPrepSide(prepViewSide)) {
    const index = +shopCard.dataset.index;
    if (!Number.isNaN(index)) {
      beginPendingShopDrag(index, synthetic, prepViewSide);
      return;
    }
  }

  const benchCard = target?.closest?.(".bench-card:not(.empty)");
  if (benchCard && canEditPrepSide(prepViewSide)) {
    const index = +benchCard.dataset.bench;
    if (!Number.isNaN(index)) {
      startBenchDrag(index, synthetic, prepViewSide);
      return;
    }
  }

  const clickable = target?.closest?.("button:not([disabled]), .shop-pin");
  if (clickable && !clickable.closest("#game-canvas")) {
    clickable.click();
    return;
  }

  onMouseDown(synthetic);
}

function gamepadPointerUpAt(clientX, clientY) {
  updatePointerFromClient(clientX, clientY);
  if (pendingShopDrag && !dragPayload) {
    const dx = clientX - pendingShopDrag.startX;
    const dy = clientY - pendingShopDrag.startY;
    if (Math.hypot(dx, dy) < 6) {
      const { index, side } = pendingShopDrag;
      pendingShopDrag = null;
      buyFromShop(index, side);
      syncUiDragState();
      return;
    }
  }
  finishDragDrop(createSyntheticPointerEvent(clientX, clientY));
}

function canvasCoordsFromEvent(e) {
  return canvasCoordsFromClient(e.clientX, e.clientY);
}
function rotateDragItem() {
  if (dragPayload) dragPayload.rotation = ((dragPayload.rotation || 0) + 1) % 4;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  if (phase === "prep") {
    const side = prepViewSide;
    const st = getSideState(side);
    drawBackpackFrame(side, true);
    drawContainers(st.containers, side, false);
    drawSynergyVisuals(ctx, synergyAnimTime, synergyPreviewBuilt, "under", side);
    drawLoadoutItems(st.items, side, false);
    drawDisplaceAnimations(ctx, side);
    drawSynergyVisuals(ctx, synergyAnimTime, synergyPreviewBuilt, "over", side);
    if (canEditPrepSide() && hoverSlot && !dragPayload && !gamepadBoardFocus) drawHoverCell();
    if (canEditPrepSide() && gamepadBoardFocus) drawGamepadBoardFocus();
    if (canEditPrepSide() && dragPayload && (hoverCell || hoverSlot)) drawDropPreview();
  } else if (isBattleUiPhase()) {
    drawBackpackFrame("player", true);
    drawBackpackFrame("enemy", false);
  }
  if (phase !== "prep" && battleState) {
    battleState.player.items.forEach((item) => {
      drawBattleItemWithAnimation(
        ctx,
        item,
        "player",
        ITEM_CATALOG[item.itemId],
        cellRect,
        roundRect,
        battleState,
      );
    });
    battleState.enemy.items.forEach((item) => {
      drawBattleItemWithAnimation(
        ctx,
        item,
        "enemy",
        ITEM_CATALOG[item.itemId],
        cellRect,
        roundRect,
        battleState,
      );
    });
    drawAttackAnimations(ctx, battleState);
    renderBattleEffectsOverlay(battleState);
  } else {
    clearBattleFloatLayer();
  }
  if (dragPayload) drawDragGhost();
}

function drawBackground() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const g = ctx.createRadialGradient(cx, cy * 0.5, 60, cx, cy, Math.max(canvas.width, canvas.height) * 0.55);
  g.addColorStop(0, "#1a2433");
  g.addColorStop(1, "#0a0e14");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function getFieldFrameRect(team) {
  const cell = teamLayoutCell(team);
  const ox = gridOrigin(team);
  const w = GRID_COLS * cell;
  const h = GRID_ROWS * cell;
  const pad = FRAME_PAD;
  return {
    x: ox - pad,
    y: BACKPACK_Y - pad - FRAME_TITLE_H,
    w: w + pad * 2,
    h: h + pad * 2 + FRAME_TITLE_H,
    cell,
    ox,
    gridW: w,
    gridH: h,
  };
}

function drawBackpackFrame(team, interactive) {
  const frame = getFieldFrameRect(team);
  const { x, y, w, h, ox, gridW: gw, cell } = frame;
  const pad = FRAME_PAD;
  ctx.save();
  roundRect(x, y, w, h, uiPx(12));
  ctx.fillStyle = interactive ? "rgba(22, 45, 82, 0.55)" : "rgba(62, 28, 35, 0.5)";
  ctx.fill();
  ctx.strokeStyle = interactive ? "rgba(88, 166, 255, 0.6)" : "rgba(248, 81, 73, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = interactive ? "#79c0ff" : "#ffa198";
  ctx.font = `bold ${uiPx(12)}px sans-serif`;
  let title = interactive ? "ВАШЕ ПОЛЕ" : "ПОЛЕ ИИ";
  let titleEmoji = interactive ? "🎒" : "🤖";
  if (phase === "prep") {
    if (isVersusMode()) {
      if (team === "player" && prepViewSide === "player") {
        title = "ИГРОК 1";
        titleEmoji = "🧑";
      } else if (team === "player") {
        title = "ИГР. 1";
        titleEmoji = "🧑";
      } else if (team === "enemy" && prepViewSide === "enemy") {
        title = "ИГРОК 2";
        titleEmoji = "🧑";
      } else {
        title = "ИГР. 2";
        titleEmoji = "🧑";
      }
    } else if (team === "player" && prepViewSide === "player") {
      title = "ВАШЕ ПОЛЕ";
      titleEmoji = "🎒";
    } else if (team === "player") {
      title = "ВЫ";
      titleEmoji = "🧑";
    } else if (team === "enemy" && prepViewSide === "enemy") {
      title = "ИИ";
      titleEmoji = "🤖";
    } else {
      title = "ИИ";
      titleEmoji = "🤖";
    }
  }
  const titleY = BACKPACK_Y - pad - uiPx(8);
  const titleCenterX = ox + gw / 2;
  const titleWidth = ctx.measureText(title).width;
  const emojiGap = uiPx(6);
  ctx.textAlign = "right";
  ctx.fillText(titleEmoji, titleCenterX - titleWidth / 2 - emojiGap, titleY);
  ctx.textAlign = "center";
  ctx.fillText(title, titleCenterX, titleY);
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const { x, y, w: cw, h: ch } = cellRect(team, col, row);
      const available = isBoardCellAvailable(col, row, GRID_COLS, GRID_ROWS);
      ctx.fillStyle = !available ? (interactive ? "#0d1520" : "#1a1014")
        : interactive ? ((row + col) % 2 === 0 ? "#1a3050" : "#152840")
        : ((row + col) % 2 === 0 ? "#3d2228" : "#331c22");
      roundRect(x + 2, y + 2, cw - 4, ch - 4, 4);
      ctx.fill();
      if (!available) {
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.font = `${uiPx(10)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✕", x + cw / 2, y + ch / 2);
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
    const ox = gridOrigin(team) + bounds.minCol * cell;
    const oy = BACKPACK_Y + bounds.minRow * cell;
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
    roundRect(ox + 2, oy + 2, boardW * cell - 4, boardH * cell - 4, 8);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = RARITY_COLORS[def.rarity] || "#8b949e";
    ctx.lineWidth = 2;
    roundRect(ox + 2, oy + 2, boardW * cell - 4, boardH * cell - 4, 8);
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
  items.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    const alpha = dimmed ? 0.55 : 1;
    getItemCells(item).forEach(([c, r], idx) => {
      const { x, y, w, h } = cellRect(team, c, r);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = def.color + "dd";
      roundRect(x + 3, y + 3, w - 6, h - 6, 5);
      ctx.fill();
      ctx.strokeStyle = RARITY_COLORS[def.rarity] || "#8b949e";
      ctx.lineWidth = 1.5;
      roundRect(x + 3, y + 3, w - 6, h - 6, 5);
      ctx.stroke();
      if (idx === 0) {
        ctx.font = `${uiPx(27)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(def.icon, x + w / 2, y + h / 2);
      }
    });
    ctx.globalAlpha = 1;
  });
}

function drawBattleItems(items, team, dimmed) {
  items.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    getItemCells(item).forEach(([c, r], idx) => {
      const { x, y, w, h } = cellRect(team, c, r);
      ctx.globalAlpha = dimmed ? 0.55 : 1;
      ctx.fillStyle = def.color + "cc";
      roundRect(x + 3, y + 3, w - 6, h - 6, 5);
      ctx.fill();
      if (idx === 0) {
        ctx.font = `${uiPx(27)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(def.icon, x + w / 2, y + h / 2);
      }
      if (item.currentCooldown != null) {
        const maxCd = getEffectiveCooldown(item);
        const pct = 1 - item.currentCooldown / maxCd;
        ctx.fillStyle = pct >= 1 ? "#3fb950" : "#58a6ff";
        roundRect(x + 4, y + h - 10, (w - 8) * Math.max(0, Math.min(1, pct)), 5, 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  });
}

function drawBattleHud() {
  /* HP и VS — в центральной HTML-панели статов */
}

function drawHpBar(x, y, w, hp, maxHp, color, label) {
  ctx.fillStyle = "#8b949e";
  ctx.font = `${uiPx(10)}px sans-serif`;
  ctx.textAlign = x > 400 ? "right" : "left";
  ctx.fillText(`${label}: ${Math.ceil(hp)}`, x + (x > 400 ? w : 0), y - 4);
  ctx.fillStyle = "#21262d";
  roundRect(x, y, w, 10, 4);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(x, y, w * Math.max(0, hp / maxHp), 10, 4);
  ctx.fill();
}

function drawFloatingNumbers() {
  battleState?.floatingNumbers?.forEach((fn) => {
    const alpha = fn.age / fn.maxAge < 0.3 ? 1 : 1 - (fn.age / fn.maxAge - 0.3) / 0.7;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = `bold ${uiPx(16)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = fn.color;
    ctx.fillText(fn.text, fn.x, fn.y - fn.age * 55);
    ctx.restore();
  });
}

function drawItemPreview(x, y, def, itemId, selected, rotation) {
  const shape = rotateShape(def.shape, rotation);
  ctx.fillStyle = selected ? "rgba(240,193,75,0.15)" : "rgba(0,0,0,0.2)";
  roundRect(x, y, CELL + 4, CELL - 4, 6);
  ctx.fill();
  shape.forEach(([dx, dy], idx) => {
    ctx.fillStyle = def.color;
    roundRect(x + 8 + dx * 16, y + 8 + dy * 16, 14, 14, 3);
    ctx.fill();
    if (idx === 0) {
      ctx.font = `${uiPx(27)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.icon, x + 15 + dx * 16, y + 15 + dy * 16);
    }
  });
}

function drawHoverCell() {
  if (!hoverSlot) return;
  const team = prepViewSide;
  const { x, y, w, h } = cellRect(team, hoverSlot.col, hoverSlot.row);
  ctx.fillStyle = team === "enemy" ? "rgba(248,81,73,0.25)" : "rgba(88,166,255,0.25)";
  roundRect(x + 2, y + 2, w - 4, h - 4, 4);
  ctx.fill();
}

function drawDropPreview() {
  if (!dragPayload) return;
  const team = prepViewSide;
  const st = getSideState(team);
  if (isContainerItem(dragPayload.itemId) && hoverCell) {
    const excludeUid = dragFrom?.type === "container" ? dragFrom.container.uid : null;
    const valid = canPlaceContainer(
      dragPayload.itemId,
      hoverCell.col,
      hoverCell.row,
      dragPayload.rotation || 0,
      GRID_COLS,
      GRID_ROWS,
      st.containers,
      excludeUid,
    );
    rotateShape(ITEM_CATALOG[dragPayload.itemId].shape, dragPayload.rotation || 0).forEach(([dx, dy]) => {
      const { x, y, w, h } = cellRect(team, hoverCell.col + dx, hoverCell.row + dy);
      ctx.fillStyle = valid ? "rgba(63,185,80,0.4)" : "rgba(248,81,73,0.4)";
      roundRect(x + 2, y + 2, w - 4, h - 4, 4);
      ctx.fill();
    });
    return;
  }
  if (!hoverSlot) return;
  const excludeUid = dragFrom?.type === "item" ? dragFrom.item.uid : null;
  const placement = resolveLoadoutPlacementDisplacing(
    st.containers,
    dragPayload.itemId,
    hoverSlot.col,
    hoverSlot.row,
    dragPayload.rotation || 0,
  );
  if (placement.valid) dragPayload.rotation = placement.rotation;
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
  const benchOk = st.bench.length + displaced.length <= MAX_BENCH;
  const valid = placement.valid && benchOk;
  rotateShape(ITEM_CATALOG[dragPayload.itemId].shape, placement.rotation).forEach(([dx, dy]) => {
    const { x, y, w, h } = cellRect(team, placement.col + dx, placement.row + dy);
    ctx.fillStyle = valid ? "rgba(63,185,80,0.45)" : "rgba(248,81,73,0.45)";
    roundRect(x + 2, y + 2, w - 4, h - 4, 4);
    ctx.fill();
  });
  displaced.forEach((item) => {
    getItemCells(item).forEach(([c, r]) => {
      const { x, y, w, h } = cellRect(team, c, r);
      ctx.fillStyle = valid ? "rgba(210,153,34,0.35)" : "rgba(248,81,73,0.25)";
      roundRect(x + 2, y + 2, w - 4, h - 4, 4);
      ctx.fill();
    });
  });
}

function drawDragGhost() {
  drawItemPreview(mousePos.x - 30, mousePos.y - 30, ITEM_CATALOG[dragPayload.itemId], dragPayload.itemId, true, dragPayload.rotation || 0);
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
      return `💪 Урон: +${pct}%`;
    }
    case "lifesteal": return `🩸 Вампиризм: ${Math.round(e.value * 100)}%`;
    case "buffTimed": return `🔥 +${Math.round(e.value * 100)}% ${e.stat || "урон"} на ${e.duration}с`;
    case "crit": return `🎯 Крит: ${Math.round((e.chance || 0) * 100)}%`;
    case "dodgePeriodic": return `💨 Уклонение каждые ${e.interval || 5}с`;
    case "groundFire": return `🔥 Огонь на поле: ${e.value} урона/с`;
    case "repeatCast": return `🔮 Повтор магических заклинаний`;
    case "shieldBreakBonus": return `🛡 Пробивание блока: +${Math.round((e.value || 0) * 100)}%`;
    case "shieldBlockMult": return `🛡 Усиление блока: +${Math.round((e.value || 0) * 100)}%`;
    default: return `${e.type}${e.value != null ? `: ${e.value}` : ""}`;
  }
}

/** context: shop — магазин; bench — скамейка; field — предмет на поле / canvas */
function buildItemTooltipLines(def, contentItem, rotation, context = "field") {
  const lines = [];
  lines.push({ text: `${def.icon} ${def.name}`, style: "title", color: RARITY_COLORS[def.rarity] || "#e6edf3" });

  if (def.isContainer) {
    const slots = getSlotBounds(playerContainers);
    const { w, h } = getInternalSize(def, rotation || 0);
    lines.push({ text: `Контейнер · ${w}×${h} слотов`, style: "sub", color: "#8b949e" });
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
    lines.push({ text: `${def.shape.length} кл.`, style: "sub", color: "#8b949e" });
  }

  if (def.effects?.length) {
    def.effects.forEach((e) => {
      lines.push({ text: describeEffect(e), style: "normal", color: "#e6edf3" });
    });
    if (def.cooldown > 0) {
      lines.push({ text: `⏱ Перезарядка: ${def.cooldown}с`, style: "normal", color: "#8b949e" });
    } else if (def.effects.every((e) => e.trigger === "passive" || e.type.startsWith("passive"))) {
      lines.push({ text: "Пассивный", style: "normal", color: "#8b949e" });
    }
    const staminaCost = typeof getItemStaminaCost === "function" ? getItemStaminaCost(def) : (def.staminaCost || 0);
    if (staminaCost > 0) {
      lines.push({ text: `⚡ Выносливость: ${staminaCost}`, style: "normal", color: "#d29922" });
    }
  }

  if (def.classRestriction) {
    const c = getClassById(def.classRestriction);
    lines.push({ text: `Только: ${c?.name || def.classRestriction}`, style: "normal", color: "#f0c14b" });
  }

  getUniqueItemSynergies(def).forEach((s) => {
    lines.push({ text: s.desc, style: "normal", color: "#79c0ff" });
  });

  if (typeof getCraftTooltipLines === "function") {
    getCraftTooltipLines(def.id).forEach((line) => lines.push(line));
  }

  if (context === "field" && contentItem?.runtime) {
    const rt = contentItem.runtime;
    const bonuses = [];
    if (rt.damageBonus > 0) bonuses.push(`+${rt.damageBonus} урона`);
    if (rt.healBonus > 0) bonuses.push(`+${rt.healBonus} лечения`);
    if (rt.blockBonus > 0) bonuses.push(`+${rt.blockBonus} блока`);
    if (rt.poisonBonus > 0) bonuses.push(`+${rt.poisonBonus} яда`);
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
    if (rt.cooldownMult < 1) bonuses.push(`−${Math.round((1 - rt.cooldownMult) * 100)}% кулдаун`);
    if (bonuses.length) {
      lines.push({ sep: true });
      lines.push({ text: "Сейчас:", style: "label", color: "#a371f7" });
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

function canvasPointToClient(cx, cy) {
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return { x: rect.left, y: rect.top };
  return {
    x: rect.left + (cx / canvas.width) * rect.width,
    y: rect.top + (cy / canvas.height) * rect.height,
  };
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
    "#shop-panel, .run-stats-anchor, #run-stats-popover, #sidebar-tooltip, #recipe-book-overlay",
  );
}

function positionSidebarTooltip(clientX, clientY, boundsKind = "viewport") {
  const el = document.getElementById("sidebar-tooltip");
  if (!el || el.classList.contains("hidden")) return;

  const bounds = getTooltipBounds(boundsKind);
  const margin = 10;
  const gap = 14;

  el.style.visibility = "hidden";
  el.style.left = "-9999px";
  el.style.top = "0";
  const tipW = el.offsetWidth;
  const tipH = el.offsetHeight;

  const spaceRight = bounds.right - clientX - margin;
  const spaceLeft = clientX - bounds.left - margin;
  const preferRight = spaceRight >= spaceLeft;

  let left;
  if (preferRight && spaceRight >= Math.min(tipW, 120)) {
    left = clientX + gap;
  } else if (spaceLeft >= Math.min(tipW, 120)) {
    left = clientX - tipW - gap;
  } else if (spaceRight >= spaceLeft) {
    left = clientX + gap;
  } else {
    left = clientX - tipW - gap;
  }

  let top = clientY - tipH * 0.35;
  top = Math.max(bounds.top + margin, Math.min(top, bounds.bottom - tipH - margin));
  left = Math.max(bounds.left + margin, Math.min(left, bounds.right - tipW - margin));

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.visibility = "";
}

function syncFieldTooltip() {
  if (!tooltipItem || dragPayload) {
    if (fieldTooltipVisible) {
      hideSidebarTooltip();
    }
    return;
  }

  sidebarTooltipSource = "field";
  const { itemId, x, y, contentItem, rotation } = tooltipItem;
  const el = document.getElementById("sidebar-tooltip");
  const def = ITEM_CATALOG[itemId];
  if (!el || !def) return;

  el.classList.remove("synergy-tooltip");
  el.style.borderColor = RARITY_COLORS[def.rarity] || "#30363d";
  const lines = buildItemTooltipLines(def, contentItem, rotation || 0, "field");
  el.innerHTML = lines
    .filter((l) => !l.sep)
    .map((l) => {
      const color = l.color ? ` style="color:${l.color}"` : "";
      return `<div class="tt-line tt-${l.style || "normal"}"${color}>${l.text}</div>`;
    })
    .join("");
  el.classList.remove("hidden");
  fieldTooltipVisible = true;

  const client = canvasPointToClient(x, y);
  positionSidebarTooltip(client.x, client.y, "field");
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}


function hitTest(mx, my) {
  const side = prepViewSide;
  if (!canEditPrepSide(side)) return null;
  if (isOnBoard(mx, my, side) && phase === "prep") {
    const st = getSideState(side);
    const col = xToCol(mx, side);
    const row = yToRow(my, side);
    if (!isSlotCell(st.containers, col, row)) {
      return { zone: "board", col, row, side };
    }
    return {
      zone: "slot",
      col,
      row,
      side,
      item: findItemAtSlot(st.items, col, row),
      container: findContainerAtCell(st.containers, col, row),
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

function updateTooltip(mx, my) {
  if (dragPayload) {
    tooltipItem = null;
    syncFieldTooltip();
    return;
  }

  if (sidebarTooltipSource === "shop" || sidebarTooltipSource === "bench") {
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
      const item = findItemAtSlot(items, col, row);
      if (item) {
        tooltipItem = { itemId: item.itemId, x: mx, y: my, contentItem: item };
        syncFieldTooltip();
        return;
      }
      if (containers) {
        const container = findContainerAtCell(containers, col, row);
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
    const item = findItemAtSlot(sources.playerItems, col, row);
    if (item) {
      tooltipItem = { itemId: item.itemId, x: mx, y: my, contentItem: item };
      syncFieldTooltip();
      return;
    }
    if (sources.playerContainers) {
      const container = findContainerAtCell(sources.playerContainers, col, row);
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
    const item = findItemAtSlot(sources.enemyItems, col, row);
    if (item) {
      tooltipItem = { itemId: item.itemId, x: mx, y: my, contentItem: item };
      syncFieldTooltip();
      return;
    }
    if (sources.enemyContainers) {
      const container = findContainerAtCell(sources.enemyContainers, col, row);
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

function showSidebarTooltip(e, itemId, contentItem, context = "shop") {
  const el = document.getElementById("sidebar-tooltip");
  const def = ITEM_CATALOG[itemId];
  if (!el || !def) return;
  sidebarTooltipSource = context;
  tooltipItem = null;
  fieldTooltipVisible = false;
  el.classList.remove("synergy-tooltip");
  if (e.currentTarget?.dataset?.unaffordable) {
    const sideGold = getSideState(prepViewSide).gold;
    el.innerHTML = `<div class="tt-line tt-title">Недостаточно золота</div><div class="tt-line tt-sub">${def.cost}💰 · у вас ${sideGold}💰</div>`;
  } else {
    const lines = buildItemTooltipLines(def, contentItem, 0, context);
    el.innerHTML = lines
      .filter((l) => !l.sep)
      .map((l) => `<div class="tt-line tt-${l.style || "normal"}">${l.text}</div>`)
      .join("");
  }
  el.classList.remove("hidden");
  moveSidebarTooltip(e, "shop");
}

function moveSidebarTooltip(e, boundsKind = "viewport") {
  positionSidebarTooltip(e.clientX, e.clientY, boundsKind);
}

function hideSidebarTooltip() {
  const el = document.getElementById("sidebar-tooltip");
  if (el) el.classList.add("hidden");
  fieldTooltipVisible = false;
  sidebarTooltipSource = null;
}

function bindItemTooltipEvents(el, itemId, contentItem, context = "shop") {
  if (!itemId || !el) return;
  const boundsKind = context === "shop" ? "shop" : "viewport";
  const refresh = (e) => {
    const liveItemId = el.dataset.itemId || itemId;
    if (!liveItemId) return;
    showSidebarTooltip(e, liveItemId, contentItem, context);
  };
  el.addEventListener("mouseenter", refresh);
  el.addEventListener("mousemove", (e) => {
    refresh(e);
    moveSidebarTooltip(e, boundsKind);
  });
  el.addEventListener("mouseleave", hideSidebarTooltip);
  if (context === "shop" || context === "bench" || context === "field") {
    el.style.cursor = "help";
  }
}

function onMouseDown(e) {
  if (phase !== "prep" || gameOver || !canEditPrepSide()) return;
  const side = prepViewSide;
  const st = getSideState(side);
  const { x: mx, y: my } = canvasCoordsFromEvent(e);
  const hit = hitTest(mx, my);

  if (hit?.zone === "slot" && hit.item) {
    e.preventDefault();
    selectedBench = -1;
    dragPayload = { itemId: hit.item.itemId, rotation: hit.item.rotation || 0 };
    dragFrom = { type: "item", item: hit.item, side };
    st.items = st.items.filter((i) => i.uid !== hit.item.uid);
    startSynergyPreview();
    recalcSynergies();
    syncUiDragState();
  } else if (hit?.zone === "slot" && hit.container && !hit.item && !ITEM_CATALOG[hit.container.itemId].immovable) {
    e.preventDefault();
    selectedBench = -1;
    const carriedItems = getItemsTouchingContainer(st.items, hit.container);
    dragPayload = { itemId: hit.container.itemId, rotation: hit.container.rotation || 0 };
    dragFrom = { type: "container", container: hit.container, carriedItems, side };
    st.containers = st.containers.filter((c) => c.uid !== hit.container.uid);
    st.items = st.items.filter((i) => !carriedItems.some((c) => c.uid === i.uid));
    startSynergyPreview();
    recalcSynergies();
    syncUiDragState();
  }
}

function finishDragDrop(e) {
  pendingShopDrag = null;
  if (!dragPayload || !dragFrom) {
    clearDragUiState();
    return;
  }

  const side = dragFrom.side || prepViewSide;
  const st = getSideState(side);
  if (!canEditPrepSide(side)) {
    restoreDraggedItem(side);
    clearDragUiState();
    return;
  }

  const dropOnSell = isDropOnSell(e);
  const dropOnBench = isDropOnBench(e);
  const { x: mx, y: my } = canvasCoordsFromEvent(e);

  if (dropOnSell && sellDraggedItem(side)) {
    clearDragUiState();
    renderBench();
    recalcSynergies();
    updateUI();
    return;
  }

  if (dropOnSell) {
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
        }
      }
    } else if (dragFrom.type === "item") {
      st.bench.push({ itemId: dragFrom.item.itemId, uid: dragFrom.item.uid, rotation: dragPayload.rotation || 0 });
    } else if (dragFrom.type === "container") {
      st.bench.push({
        itemId: dragFrom.container.itemId,
        uid: dragFrom.container.uid,
        rotation: dragPayload.rotation || 0,
        carriedItems: dragFrom.carriedItems,
        originCol: dragFrom.container.col,
        originRow: dragFrom.container.row,
      });
    }
  } else if (isContainerItem(dragPayload.itemId) && isOnBoard(mx, my, side)) {
    const col = xToCol(mx, side);
    const row = yToRow(my, side);
    const excludeUid = dragFrom.type === "container" ? dragFrom.container.uid : null;
    const canMove = dragFrom.type === "container"
      ? canMoveContainerWithItems(
        dragFrom.container,
        col,
        row,
        st.containers,
        st.items,
        excludeUid,
        GRID_COLS,
        GRID_ROWS,
      )
      : canPlaceContainer(dragPayload.itemId, col, row, dragPayload.rotation || 0, GRID_COLS, GRID_ROWS, st.containers, excludeUid);

    if (canMove) {
      if (dragFrom.type === "bench") {
        const benchEntry = st.bench[dragFrom.index];
        st.bench.splice(dragFrom.index, 1);
        if (selectedBench === dragFrom.index) selectedBench = -1;
        const placed = createContainer(dragPayload.itemId, col, row, dragPayload.rotation || 0);
        st.containers = [...st.containers, placed];
        (benchEntry?.carriedItems || []).forEach((item) => {
          const dCol = col - (benchEntry.originCol ?? col);
          const dRow = row - (benchEntry.originRow ?? row);
          st.items = [...st.items, { ...item, col: item.col + dCol, row: item.row + dRow }];
        });
      } else if (dragFrom.type === "shop") {
        const itemId = commitShopPurchase(dragFrom.index, side);
        if (itemId) {
          const placed = createContainer(itemId, col, row, dragPayload.rotation || 0);
          st.containers = [...st.containers, placed];
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
    } else if (dragFrom.type === "container") {
      st.containers = [...st.containers, dragFrom.container];
      st.items = [...st.items, ...dragFrom.carriedItems];
    }
  } else if (!isContainerItem(dragPayload.itemId) && isOnBoard(mx, my, side)) {
    const col = xToCol(mx, side);
    const row = yToRow(my, side);
    if (isSlotCell(st.containers, col, row)) {
      const excludeUid = dragFrom.type === "item" ? dragFrom.item.uid : null;
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
        if (st.bench.length + displaced.length > MAX_BENCH) {
          log("Скамейка полна!");
          if (dragFrom.type === "item") st.items = [...st.items, dragFrom.item];
          clearDragUiState();
          renderBench();
          recalcSynergies();
          updateUI();
          return;
        }
        if (displaced.length) {
          displaced.forEach((existing) => {
            st.items = st.items.filter((i) => i.uid !== existing.uid);
          });
          queueDisplaceToBenchAnimations(side, displaced, prepViewSide, () => {
            renderBench();
            recalcSynergies();
            updateUI();
          });
        }
        if (dragFrom.type === "bench") {
          st.bench.splice(dragFrom.index, 1);
          if (selectedBench === dragFrom.index) selectedBench = -1;
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
        const placed = createPlacedItem(dragPayload.itemId, placement.col, placement.row, placement.rotation);
        if (dragFrom.type === "item") placed.uid = dragFrom.item.uid;
        st.items = [...st.items, placed];
        dragPayload.rotation = placement.rotation;
      } else if (dragFrom.type === "item") {
        st.items = [...st.items, dragFrom.item];
      }
    } else if (dragFrom.type === "item") {
      st.items = [...st.items, dragFrom.item];
    }
  } else if (dragFrom.type === "item") {
    st.items = [...st.items, dragFrom.item];
  } else if (dragFrom.type === "container") {
    st.containers = [...st.containers, dragFrom.container];
    st.items = [...st.items, ...dragFrom.carriedItems];
  }

  clearDragUiState();
  if (canEditPrepSide(side)) applyCraftingForSide(side);
  renderBench();
  recalcSynergies();
  updateUI();
}

function beginPendingShopDrag(index, e, side = prepViewSide) {
  if (phase !== "prep" || gameOver || !canEditPrepSide(side)) return;
  const st = getSideState(side);
  if (!st.shop[index]) return;
  const def = ITEM_CATALOG[st.shop[index]];
  if (st.gold < def.cost) return;
  e.preventDefault();
  pendingShopDrag = { index, startX: e.clientX, startY: e.clientY, side };
  shopDidDrag = false;
  syncUiDragState();
}

function updatePendingShopDrag(e) {
  if (!pendingShopDrag || dragPayload) return;
  const dx = e.clientX - pendingShopDrag.startX;
  const dy = e.clientY - pendingShopDrag.startY;
  if (Math.hypot(dx, dy) < 6) return;
  const { index, side } = pendingShopDrag;
  pendingShopDrag = null;
  shopDidDrag = true;
  startShopDrag(index, e, side);
}

function startShopDrag(index, e, side = prepViewSide) {
  if (phase !== "prep" || gameOver || !canEditPrepSide(side)) return;
  const st = getSideState(side);
  if (!st.shop[index]) return;
  const def = ITEM_CATALOG[st.shop[index]];
  if (st.gold < def.cost) return;
  if (e?.preventDefault) e.preventDefault();
  hideSidebarTooltip();
  dragPayload = { itemId: st.shop[index], rotation: 0 };
  dragFrom = { type: "shop", index, side };
  startSynergyPreview();
  document.querySelector(`.shop-card[data-index="${index}"]`)?.classList.add("shop-dragging");
  syncUiDragState();
}

function startBenchDrag(index, e, side = prepViewSide) {
  const st = getSideState(side);
  if (phase !== "prep" || gameOver || !canEditPrepSide(side) || !st.bench[index]) return;
  e.preventDefault();
  selectedBench = index;
  renderBench();
  dragPayload = { itemId: st.bench[index].itemId, rotation: st.bench[index].rotation || 0 };
  dragFrom = { type: "bench", index, side };
  startSynergyPreview();
  syncUiDragState();
}

function updateUI() {
  document.getElementById("round-stat").textContent = `Раунд ${Math.min(round, RUN_BATTLES)}/${RUN_BATTLES}`;
  renderPlayerProfiles();
  renderRunStats();
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

function renderPlayerProfiles() {
  const statsEl = document.getElementById("battle-stats-panel");
  const playerAvatarEl = document.getElementById("player-avatar-slot");
  const enemyAvatarEl = document.getElementById("enemy-avatar-slot");
  if (!statsEl || !playerAvatarEl || !enemyAvatarEl) return;

  let playerProfile;
  let enemyProfile;

  if (phase === "battle" && battleState) {
    playerProfile = computeCombatProfileFromBattleSide(battleState.player, playerClass, getPlayerProfileName(), battleState);
    enemyProfile = computeCombatProfileFromBattleSide(battleState.enemy, enemyClass, getEnemyDisplayName(), battleState);
  } else if (phase === "replay" && battleState) {
    playerProfile = computeCombatProfileFromBattleSide(battleState.player, playerClass, getPlayerProfileName(), battleState);
    enemyProfile = computeCombatProfileFromBattleSide(battleState.enemy, enemyClass, getEnemyDisplayName(), battleState);
  } else {
    playerProfile = computeCombatProfile(playerItems, playerClass, getPlayerProfileName());
    enemyProfile = computeCombatProfile(enemyItems, enemyClass, getEnemyDisplayName());
  }

  applyProfileIdentity(playerProfile, playerClass, gold);
  applyProfileIdentity(enemyProfile, enemyClass, enemyGold);
  playerProfile.backpackPower = computeBackpackPower(playerContainers, playerItems, playerClass);
  enemyProfile.backpackPower = computeBackpackPower(enemyContainers, enemyItems, enemyClass);

  statsEl.innerHTML = renderBattleStatsCompareHTML(playerProfile, enemyProfile, {
    round,
    maxRound: RUN_BATTLES,
    liveBattle: phase === "battle" || phase === "replay",
    itemCount: Math.max(playerItems.length, enemyItems.length, 1),
  });
  playerAvatarEl.innerHTML = renderProfileAvatarHTML(playerProfile, "player");
  enemyAvatarEl.innerHTML = renderProfileAvatarHTML(enemyProfile, "enemy");
  syncBattleArenaLayout();
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
  const hint = document.getElementById("shop-panel-hint");
  if (!hint || !msg.includes("Крафт")) return;
  if (!hint.dataset.defaultHint) hint.dataset.defaultHint = hint.textContent;
  hint.textContent = msg;
  window.clearTimeout(log.craftTimer);
  log.craftTimer = window.setTimeout(() => {
    hint.textContent = hint.dataset.defaultHint || hint.textContent;
  }, 3500);
}

function buildItemCardHTML(def, { cardType = "item-card", extraClasses = "", tagsHtml = "", innerBefore = "", innerAfter = "", dataAttrs = "", showShape = true, shapeSize = "md" } = {}) {
  const classes = getRarityCardClasses(def.rarity, [cardType, extraClasses].filter(Boolean).join(" "));
  const shapeHtml = showShape ? renderItemShapeMiniHTML(def, { size: shapeSize }) : "";
  return `<div class="${classes}"${dataAttrs ? ` ${dataAttrs}` : ""}>
    ${innerBefore}
    <div class="icon" style="background:${def.color}33">${def.icon}</div>
    ${shapeHtml}
    <div class="info"><div class="name">${def.name}</div>${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ""}</div>
    ${innerAfter}
  </div>`;
}

function getShopDisplayEntries(side = prepViewSide) {
  const st = getSideState(side);
  return st.shop
    .map((itemId, index) => ({
      index,
      itemId,
      cost: itemId ? (ITEM_CATALOG[itemId]?.cost ?? 0) : -1,
    }))
    .sort((a, b) => {
      if (a.cost !== b.cost) return b.cost - a.cost;
      return a.index - b.index;
    });
}

function renderShop(side = prepViewSide) {
  const el = document.getElementById("shop-slots");
  if (!el) return;
  const st = getSideState(side);
  const editable = canEditPrepSide(side);
  el.innerHTML = getShopDisplayEntries(side).map(({ itemId, index }) => {
    if (!itemId) return `<div class="shop-card empty">—</div>`;
    const def = ITEM_CATALOG[itemId];
    const frozen = st.shopFrozen[index];
    const affordable = st.gold >= def.cost;
    const pinBtn = editable
      ? `<button type="button" class="shop-pin${frozen ? " active" : ""}" data-pin="${index}" title="${frozen ? "Открепить" : "❄️ Заморозить предмет"}">${frozen ? "📌" : "📍"}</button>`
      : "";
    return buildItemCardHTML(def, {
      cardType: "shop-card",
      extraClasses: [frozen ? "frozen" : "", affordable || !editable ? "" : "unaffordable"].filter(Boolean).join(" "),
      innerBefore: pinBtn,
      innerAfter: `<div class="cost">${def.cost}💰</div>`,
      shapeSize: "md",
      dataAttrs: `data-index="${index}" data-item-id="${itemId}"${affordable || !editable ? "" : ' data-unaffordable="1" title="Недостаточно золота"'}`, 
    });
  }).join("");
  el.querySelectorAll(".shop-card:not(.empty)").forEach((card) => {
    bindItemTooltipEvents(card, card.dataset.itemId, null, "shop");
  });
  if (!editable) return;
  el.querySelectorAll(".shop-pin").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleShopFreeze(+btn.dataset.pin, side);
    });
  });
  el.querySelectorAll(".shop-card:not(.empty)").forEach((card) => {
    if (!card.dataset.unaffordable) {
      card.addEventListener("mousedown", (e) => {
        if (e.button !== 0 || e.target.closest(".shop-pin")) return;
        beginPendingShopDrag(+card.dataset.index, e, side);
      });
      card.addEventListener("click", (e) => {
        if (e.target.closest(".shop-pin") || shopDidDrag) {
          shopDidDrag = false;
          return;
        }
        buyFromShop(+card.dataset.index, side);
      });
    }
  });
}

function renderBench(side = prepViewSide) {
  const el = document.getElementById("bench-slots");
  const st = getSideState(side);
  el.innerHTML = Array.from({ length: MAX_BENCH }, (_, i) => {
    const b = st.bench[i];
    if (!b) return `<div class="bench-card empty">пусто</div>`;
    const def = ITEM_CATALOG[b.itemId];
    return buildItemCardHTML(def, {
      cardType: "bench-card",
      extraClasses: i === selectedBench ? "selected" : "",
      shapeSize: "sm",
      dataAttrs: `data-bench="${i}" data-item-id="${b.itemId}"`,
    });
  }).join("");
  el.querySelectorAll(".bench-card:not(.empty)").forEach((card) => {
    const idx = +card.dataset.bench;
    bindItemTooltipEvents(card, st.bench[idx]?.itemId, null, "bench");
  });
  if (!canEditPrepSide(side)) return;
  el.querySelectorAll(".bench-card:not(.empty)").forEach((card) => {
    const idx = +card.dataset.bench;
    card.addEventListener("mousedown", (e) => startBenchDrag(idx, e, side));
  });
}

function renderBattleStats() {
  renderRunStats();
}

init();
