/**
 * Backpack Battles — браузерный автобатлер с рюкзаком
 */

const GRID_COLS = 9;
const GRID_ROWS = 7;
const FRAME_EDGE = 2;
const SHOP_FIELD_GAP = 12;
const BACKPACK_COLS = GRID_COLS;
const BACKPACK_ROWS = GRID_ROWS;
const MAX_BENCH = 6;
const MAX_SHOP = 5;
const SHOP_RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
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
let lastRoundStats = null;
let pendingGameOver = false;
let lastBattleReplay = null;
let lastBattlePrepSnapshot = null;
let replayPlayback = null;
let runResults = [];
let runItemStats = createEmptyRunItemStats();
let battleEndHandled = false;
let pendingShopDrag = null;
let pendingBenchDrag = null;
let pendingCanvasPick = null;
let shopDidDrag = false;
let lastTouchEventAt = 0;
const TOUCH_LONG_PRESS_MS = 450;
const TOUCH_LONG_PRESS_MOVE_PX = 10;
const MOUSE_DRAG_THRESHOLD_PX = 5;
const TOUCH_DRAG_THRESHOLD_PX = 4;
let touchLongPress = null;
let suppressShopClickUntil = 0;
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

function isSyntheticMouseFromTouch() {
  return Date.now() - lastTouchEventAt < 700;
}

function isTouchUi() {
  return document.documentElement.dataset.touch === "true";
}

function getDragThresholdPx() {
  return isTouchUi() ? TOUCH_DRAG_THRESHOLD_PX : MOUSE_DRAG_THRESHOLD_PX;
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

function clearTouchLongPress() {
  if (touchLongPress?.timer) clearTimeout(touchLongPress.timer);
  touchLongPress = null;
}

function armTouchLongPress({ clientX, clientY, onHold, onCancel }) {
  if (!isTouchUi()) return;
  clearTouchLongPress();
  const state = {
    clientX,
    clientY,
    startX: clientX,
    startY: clientY,
    onHold,
    onCancel,
    held: false,
    timer: null,
  };
  state.timer = setTimeout(() => {
    state.held = true;
    state.timer = null;
    onHold?.(state);
  }, TOUCH_LONG_PRESS_MS);
  touchLongPress = state;
}

function updateTouchLongPressMove(clientX, clientY) {
  if (!touchLongPress) return;
  const dx = clientX - touchLongPress.startX;
  const dy = clientY - touchLongPress.startY;
  if (Math.hypot(dx, dy) < TOUCH_LONG_PRESS_MOVE_PX) return;
  if (touchLongPress.held) {
    hideSidebarTooltip();
    clearTouchLongPress();
    return;
  }
  touchLongPress.onCancel?.();
  clearTouchLongPress();
}

function finishTouchLongPress() {
  const wasHeld = touchLongPress?.held;
  clearTouchLongPress();
  if (wasHeld) hideSidebarTooltip();
  return wasHeld;
}

function bindTouchInput() {
  const boardSection = document.querySelector(".board-section");
  const shopPanel = document.getElementById("shop-panel");
  const touchTargets = [boardSection, canvas, shopPanel].filter(Boolean);
  const captureOpts = { passive: false, capture: true };
  const bubbleOpts = { passive: false };
  let activeGesture = null;

  const isTouchLikePointer = (e) => e.pointerType === "touch" || e.pointerType === "pen";
  const gestureKey = (kind, id) => `${kind}:${id}`;
  const ignoreTarget = (target) => target?.closest?.("button, a, input, select, textarea");

  const onDown = (kind, id, x, y, e) => {
    if (activeGesture) return;
    if (ignoreTarget(e.target)) return;

    if ((phase === "battle" || phase === "replay") && e.target?.closest?.("#game-canvas") && !dragPayload) {
      activeGesture = gestureKey(kind, id);
      lastTouchEventAt = Date.now();
      if (e.cancelable) e.preventDefault();
      armTouchLongPress({
        clientX: x,
        clientY: y,
        onHold: () => {
          updatePointerFromClient(x, y);
          updateTooltip(mousePos.x, mousePos.y);
        },
      });
      return;
    }

    if (phase !== "prep" || gameOver) return;
    activeGesture = gestureKey(kind, id);
    lastTouchEventAt = Date.now();
    if (e.cancelable) e.preventDefault();
    if (kind === "pointer") {
      try {
        boardSection?.setPointerCapture(id);
      } catch (_) {}
    }
    gamepadPointerDownAt(x, y);
  };

  const onMove = (kind, id, x, y, e) => {
    if (activeGesture !== gestureKey(kind, id)) return;
    updateTouchLongPressMove(x, y);
    if (e.cancelable) e.preventDefault();
    updatePointerFromClient(x, y);
  };

  const onUp = (kind, id, x, y) => {
    if (activeGesture !== gestureKey(kind, id)) return;
    lastTouchEventAt = Date.now();
    const longPressHeld = finishTouchLongPress();
    if (longPressHeld && !dragPayload) {
      pendingShopDrag = null;
      pendingBenchDrag = null;
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
    if (dragPayload && phase === "prep" && e.touches.length === 2) {
      e.preventDefault();
      rotateDragItem();
    }
  }, bubbleOpts);
}

function setPhaseLabel(text, isBattle = false) {
  const el = document.getElementById("phase-label");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("battle", isBattle);
}

function init() {
  applyGridMetricsFromCss();
  canvas = document.getElementById("game-canvas");
  ctx = canvas.getContext("2d");
  applyPhaseCanvasLayout();
  syncBattleArenaLayout();
  canvas.addEventListener("mousedown", (e) => {
    if (isSyntheticMouseFromTouch()) return;
    onMouseDown(e);
  });
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
  window.addEventListener("mousemove", (e) => {
    if (isSyntheticMouseFromTouch()) return;
    onGlobalMouseMove(e);
  });
  window.addEventListener("mouseup", (e) => {
    if (isSyntheticMouseFromTouch()) return;
    finishDragDrop(e);
  });
  document.addEventListener("selectstart", (e) => {
    if (dragPayload || pendingShopDrag) e.preventDefault();
  });
  document.addEventListener("dragstart", (e) => {
    if (dragPayload || pendingShopDrag) e.preventDefault();
  });
  bindTouchInput();
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
      setPhaseLabel("Подготовка", false);
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
  bindPrepHeroTooltip();
  bindPlayerCharacteristicsControls(getPlayerCharacteristicsState, getEnemyCharacteristicsState);
  initBoardPreviewControls();
  initRecipeBookControls();
  initSettingsControls();
  initMusic();
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
    onPrepFocusChanged: onGamepadPrepFocusChanged,
    togglePrepTooltips,
    sendBoardFocusToBench,
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
  window.addEventListener("resize", syncBattleArenaLayout);
  window.addEventListener("resize", () => {
    requestAnimationFrame(applyGridMetricsFromCss);
  });
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
  if (phase === "prep") {
    canvas.width = PREP_CANVAS_W;
    canvas.height = PREP_CANVAS_H;
  } else {
    canvas.width = BATTLE_CANVAS_W;
    canvas.height = BATTLE_CANVAS_H;
  }
  layoutCanvasH = canvas.height;
  if (typeof window.fitCanvasDisplaySize === "function") {
    window.fitCanvasDisplaySize();
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
  if (app) {
    app.dataset.phase = getAppDataPhase();
    if (phase === "prep") app.dataset.prepSide = prepViewSide;
  }
  applyPhaseCanvasLayout();
  setBattleControlsVisible(isBattleUiPhase());
  syncBattleArenaLayout();
  const battleSceneUi = document.getElementById("battle-scene-ui");
  if (battleSceneUi) battleSceneUi.setAttribute("aria-hidden", isBattleUiPhase() ? "false" : "true");
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
  if (typeof applyUiLayout === "function") scheduleLayoutAfterPhase();
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
  const hud = document.getElementById("prep-stats-hud");
  const tooltip = document.getElementById("prep-hero-tooltip");
  if (!hud || !tooltip) return;

  const open = () => {
    refreshPrepHeroTooltip();
    tooltip.classList.remove("hidden");
    hud.setAttribute("aria-expanded", "true");
  };

  const toggle = (e) => {
    e?.stopPropagation?.();
    if (tooltip.classList.contains("hidden")) open();
    else closePrepHeroTooltip();
  };

  hud.addEventListener("click", toggle);
  hud.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(e);
    }
    if (e.key === "Escape") closePrepHeroTooltip();
  });

  document.addEventListener("click", (e) => {
    if (tooltip.classList.contains("hidden")) return;
    if (e.target.closest("#prep-stats-hud") || e.target.closest("#prep-hero-tooltip")) return;
    closePrepHeroTooltip();
  });
}

function refreshPrepHeroTooltip() {
  const titleEl = document.getElementById("prep-hero-tooltip-title");
  const descEl = document.getElementById("prep-hero-tooltip-desc");
  const classId = prepViewSide === "player" ? playerClass : enemyClass;
  const cls = getClassById(classId);
  if (titleEl) titleEl.textContent = cls?.name || "—";
  if (descEl) descEl.textContent = cls?.desc || "Описание класса недоступно.";
}

function closePrepHeroTooltip() {
  document.getElementById("prep-hero-tooltip")?.classList.add("hidden");
  document.getElementById("prep-stats-hud")?.setAttribute("aria-expanded", "false");
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
  setPhaseLabel("Выбор класса", false);
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
  setPhaseLabel("Подготовка", false);
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

  if (typeof isSettingsOpen === "function" && isSettingsOpen()) {
    hideSettingsPopup();
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

function sendBoardFocusToBench() {
  if (phase !== "prep" || !canEditPrepSide() || !gamepadBoardFocus) return false;
  const st = getSideState(prepViewSide);
  const { col, row } = gamepadBoardFocus;
  const item = findItemAtSlot(st.items, col, row);
  if (!item) return false;
  if (st.bench.length >= MAX_BENCH) {
    log("Скамейка полна!");
    return false;
  }
  st.items = st.items.filter((i) => i.uid !== item.uid);
  st.bench.push({
    itemId: item.itemId,
    uid: item.uid,
    rotation: item.rotation || 0,
  });
  synergyPreviewBuilt = null;
  recalcSynergies();
  renderBench();
  updateUI();
  if (lastGamepadPrepFocus) applyGamepadPrepFocusTooltip(lastGamepadPrepFocus);
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
    if (closeAllPopups()) e.preventDefault();
    return;
  }

  if (e.key === "Enter") {
    if (handleEnterHotkey(e)) return;
  }

  if (handleRecipeBookHotkey(e)) return;

  if (handleCharacteristicsHotkey(e)) return;

  if (handlePrepTooltipsHotkey(e)) return;

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
  document.body.classList.toggle("is-ui-dragging", !!(dragPayload || pendingShopDrag || pendingBenchDrag));
  if (dragPayload || pendingShopDrag || pendingBenchDrag) {
    tooltipItem = null;
    hideSidebarTooltip();
  }
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
  pendingBenchDrag = null;
  pendingCanvasPick = null;
  shopDidDrag = false;
  endSynergyPreview();
  synergyPreviewBuilt = null;
  canvas?.classList.remove("synergy-preview-mode");
  document.getElementById("bench-panel")?.classList.remove("bench-drop-target");
  document.getElementById("shop-sell-zone")?.classList.remove("sell-drop-target");
  dragPayload = null;
  dragFrom = null;
  clearGamepadBoardFocus();
  hideDragGhostOverlay();
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
  setPhaseLabel("Повтор боя", true);
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
    setPhaseLabel("Бой!", true);
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
  if (phase === "prep" && !dragPayload && !isTouchUi() && !isPointerOverPrepSidebar(lastPointerClient.x, lastPointerClient.y)) {
    updateTooltip(mousePos.x, mousePos.y);
  } else if ((phase === "battle" || phase === "replay") && battleState && !dragPayload && !isTouchUi()) {
    updateTooltip(mousePos.x, mousePos.y);
  }
  draw();
  requestAnimationFrame(gameLoop);
}

function layoutGridOrigin(team) {
  if (phase === "prep") return 0;
  return team === "player" ? 0 : ENEMY_X;
}

function layoutBackpackY() {
  return 0;
}

function gridOrigin(team) {
  return layoutGridOrigin(team);
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

function isDropOnSell(e) {
  const zone = document.getElementById("shop-sell-zone");
  if (!zone || !e) return false;
  if (e.target?.closest?.("#shop-sell-zone")) return true;
  const r = zone.getBoundingClientRect();
  const pad = isTouchUi() ? 14 : 0;
  return e.clientX >= r.left - pad && e.clientX <= r.right + pad
    && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
}

function isDropOnBench(e) {
  const panel = document.getElementById("bench-panel");
  if (!panel || !e) return false;
  if (e.target?.closest?.("#bench-panel")) return true;
  const r = panel.getBoundingClientRect();
  const pad = isTouchUi() ? 14 : 0;
  return e.clientX >= r.left - pad && e.clientX <= r.right + pad
    && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
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
  if (phase !== "prep" || !dragPayload || !canvas) {
    return { x: clientX, y: clientY };
  }

  const side = dragFrom?.side || prepViewSide;
  if (!canEditPrepSide(side)) return { x: clientX, y: clientY };

  const team = prepViewSide;

  if (isContainerItem(dragPayload.itemId) && hoverCell) {
    return boardCellClientCenter(hoverCell.col, hoverCell.row, team);
  }

  if (!isContainerItem(dragPayload.itemId) && hoverSlot) {
    const st = getSideState(side);
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

  const anchor = getDragGhostAnchorClient(clientX, clientY);
  el.classList.remove("hidden");
  el.style.left = `${anchor.x}px`;
  el.style.top = `${anchor.y}px`;

  const size = DRAG_GHOST_CANVAS_SIZE;
  const dpr = window.devicePixelRatio || 1;
  if (el.width !== Math.ceil(size * dpr) || el.height !== Math.ceil(size * dpr)) {
    el.width = Math.ceil(size * dpr);
    el.height = Math.ceil(size * dpr);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
  }

  dragGhostCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dragGhostCtx.clearRect(0, 0, size, size);

  const def = ITEM_CATALOG[dragPayload.itemId];
  if (!def) return;
  const offset = uiPx(10);
  drawItemPreview(offset, offset, def, dragPayload.itemId, true, dragPayload.rotation || 0, dragGhostCtx);
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
    updatePendingBenchDrag(synthetic);
    updatePendingCanvasPick(clientX, clientY);
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
    } else if (dragPayload || pendingShopDrag || pendingBenchDrag) {
      tooltipItem = null;
      hideSidebarTooltip();
    } else {
      if (sidebarTooltipSource === "shop" || sidebarTooltipSource === "bench") {
        hideSidebarTooltip();
      }
      if (!isTouchUi() || touchLongPress?.held) {
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

  syncDragGhostOverlay(clientX, clientY);
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
      if (isTouchUi()) {
        armTouchLongPress({
          clientX,
          clientY,
          onHold: () => {
            if (dragPayload || shopDidDrag) return;
            showSidebarTooltipAt(
              clientX,
              clientY,
              shopCard.dataset.itemId,
              null,
              "shop",
              shopCard,
            );
          },
        });
      }
      beginPendingShopDrag(index, synthetic, prepViewSide);
      return;
    }
  }

  const benchCard = target?.closest?.(".bench-card:not(.empty)");
  if (benchCard && canEditPrepSide(prepViewSide)) {
    const index = +benchCard.dataset.bench;
    if (!Number.isNaN(index)) {
      if (isTouchUi()) {
        armTouchLongPress({
          clientX,
          clientY,
          onHold: () => {
            if (dragPayload) return;
            showSidebarTooltipAt(
              clientX,
              clientY,
              benchCard.dataset.itemId,
              null,
              "bench",
              benchCard,
            );
          },
        });
        beginPendingBenchDrag(index, synthetic, prepViewSide);
      } else {
        startBenchDrag(index, synthetic, prepViewSide);
      }
      return;
    }
  }

  const clickable = target?.closest?.("button:not([disabled]), .shop-pin");
  if (clickable && !clickable.closest("#game-canvas")) {
    clickable.click();
    return;
  }

  if (isTouchUi() && target?.closest?.("#game-canvas")) {
    armTouchLongPress({
      clientX,
      clientY,
      onHold: () => {
        pendingCanvasPick = null;
        updatePointerFromClient(clientX, clientY);
        updateTooltip(mousePos.x, mousePos.y);
      },
    });
    pendingCanvasPick = { clientX, clientY };
    return;
  }

  onMouseDown(synthetic);
}

function gamepadPointerUpAt(clientX, clientY) {
  updatePointerFromClient(clientX, clientY);
  const threshold = getDragThresholdPx();
  if (pendingShopDrag && !dragPayload) {
    const dx = clientX - pendingShopDrag.startX;
    const dy = clientY - pendingShopDrag.startY;
    if (Math.hypot(dx, dy) < threshold) {
      const { index, side } = pendingShopDrag;
      pendingShopDrag = null;
      syncUiDragState();
      if (!isTouchUi()) {
        buyFromShop(index, side);
        suppressShopClickUntil = Date.now() + 500;
      }
      return;
    }
  }
  pendingBenchDrag = null;
  pendingCanvasPick = null;
  finishDragDrop(createSyntheticPointerEvent(clientX, clientY));
}

function canvasCoordsFromEvent(e) {
  return canvasCoordsFromClient(e.clientX, e.clientY);
}
function rotateDragItem() {
  if (!dragPayload) return;
  dragPayload.rotation = ((dragPayload.rotation || 0) + 1) % 4;
  syncDragGhostOverlay(lastPointerClient.x, lastPointerClient.y);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  if (phase === "prep") {
    const side = prepViewSide;
    drawBackpackFrame(side, true);
    const st = getSideState(side);
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
}

function drawBackground() {
  if (phase === "prep") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  ctx.fillStyle = "#12100d";
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
  if (!available) return "#1a1612";
  return (row + col) % 2 === 0 ? "#4a4038" : "#403830";
}

function drawBackpackFrame(team, interactive) {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const { x: cx, y: cy, w: cw, h: ch } = cellRect(team, col, row);
      const available = isBoardCellAvailable(col, row, GRID_COLS, GRID_ROWS);
      ctx.fillStyle = gridCellFill(available, row, col);
      ctx.fillRect(cx, cy, cw, ch);
      if (!available) {
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.font = `${uiPx(10)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✕", cx + cw / 2, cy + ch / 2);
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
    const ox = gridOrigin(team) + bounds.minCol * GRID_STRIDE;
    const oy = layoutBackpackY() + bounds.minRow * GRID_STRIDE;
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
    getItemCells(item).forEach(([c, r]) => {
      const { x, y, w, h } = cellRect(team, c, r);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = def.color + "dd";
      roundRect(x + CELL_TILE_PAD, y + CELL_TILE_PAD, w - CELL_TILE_PAD * 2, h - CELL_TILE_PAD * 2, 5);
      ctx.fill();
      ctx.strokeStyle = RARITY_COLORS[def.rarity] || "#8b949e";
      ctx.lineWidth = 1.5;
      roundRect(x + CELL_TILE_PAD, y + CELL_TILE_PAD, w - CELL_TILE_PAD * 2, h - CELL_TILE_PAD * 2, 5);
      ctx.stroke();
    });
    const [iconCol, iconRow] = getItemIconCell(item);
    const iconRect = cellRect(team, iconCol, iconRow);
    ctx.globalAlpha = alpha;
    drawCellEmoji(ctx, def.icon, iconRect.x, iconRect.y, iconRect.w, iconRect.h);
    ctx.globalAlpha = 1;
  });
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
  const [adx, ady] = getShapeAnchorOffset(shape);
  drawCellEmoji(targetCtx, def.icon, x + 8 + adx * 16, y + 8 + ady * 16, 14, 14, 2);
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
    "#shop-panel, .run-stats-anchor, #prep-run-stats-anchor, #run-stats-popover, #sidebar-tooltip, #recipe-book-overlay",
  );
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
  return null;
}

function positionSidebarTooltip(clientX, clientY, boundsKind = "viewport", placement = "auto") {
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

  let left;
  let top;

  if (placement === "shop" || placement === "bench" || placement === "field") {
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
  positionSidebarTooltip(client.x, client.y, "field", "field");
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

function showSidebarTooltipAt(clientX, clientY, itemId, contentItem, context = "shop", sourceEl = null) {
  const el = document.getElementById("sidebar-tooltip");
  const def = ITEM_CATALOG[itemId];
  if (!el || !def) return;
  sidebarTooltipSource = context;
  tooltipItem = null;
  fieldTooltipVisible = false;
  el.classList.remove("synergy-tooltip");
  if (sourceEl?.dataset?.unaffordable) {
    const sideGold = getSideState(prepViewSide).gold;
    el.innerHTML = `<div class="tt-line tt-title">Недостаточно золота</div><div class="tt-line tt-sub">${def.cost}💰 · у вас ${sideGold}💰</div>`;
  } else {
    const lines = buildItemTooltipLines(def, contentItem, 0, context);
    el.innerHTML = lines
      .filter((l) => !l.sep)
      .map((l) => `<div class="tt-line tt-${l.style || "normal"}">${l.text}</div>`)
      .join("");
  }
  el.style.borderColor = RARITY_COLORS[def.rarity] || "#30363d";
  el.classList.remove("hidden");
  const boundsKind = context === "shop" ? "shop" : context === "bench" ? "bench" : context === "field" ? "field" : "viewport";
  positionSidebarTooltip(clientX, clientY, boundsKind, context);
}

function showSidebarTooltip(e, itemId, contentItem, context = "shop") {
  showSidebarTooltipAt(e.clientX, e.clientY, itemId, contentItem, context, e.currentTarget);
}

function moveSidebarTooltip(e, boundsKind = "viewport", placement = "auto") {
  positionSidebarTooltip(e.clientX, e.clientY, boundsKind, placement);
}

function hideSidebarTooltip() {
  const el = document.getElementById("sidebar-tooltip");
  if (el) el.classList.add("hidden");
  fieldTooltipVisible = false;
  sidebarTooltipSource = null;
}

function bindItemTooltipEvents(el, itemId, contentItem, context = "shop") {
  if (!itemId || !el) return;
  const boundsKind = context === "shop" ? "shop" : context === "bench" ? "bench" : context === "field" ? "field" : "viewport";
  const refresh = (e) => {
    const liveItemId = el.dataset.itemId || itemId;
    if (!liveItemId) return;
    showSidebarTooltip(e, liveItemId, contentItem, context);
  };

  el.addEventListener("mouseenter", refresh);
  el.addEventListener("mousemove", (e) => {
    refresh(e);
    moveSidebarTooltip(e, boundsKind, context);
  });
  el.addEventListener("mouseleave", hideSidebarTooltip);

  if (isTouchUi() && context !== "shop" && context !== "bench") {
    const touchOpts = { passive: false };
    el.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      armTouchLongPress({
        clientX: t.clientX,
        clientY: t.clientY,
        onHold: () => {
          showSidebarTooltipAt(t.clientX, t.clientY, el.dataset.itemId || itemId, contentItem, context, el);
        },
      });
    }, touchOpts);
    el.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      if (!t) return;
      updateTouchLongPressMove(t.clientX, t.clientY);
    }, touchOpts);
    el.addEventListener("touchend", () => {
      finishTouchLongPress();
    }, touchOpts);
    el.addEventListener("touchcancel", () => {
      finishTouchLongPress();
    }, touchOpts);
  }

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
    syncDragGhostOverlay(e.clientX, e.clientY);
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
    syncDragGhostOverlay(e.clientX, e.clientY);
  }
}

function finishDragDrop(e) {
  pendingShopDrag = null;
  if (!dragPayload || !dragFrom) {
    clearDragUiState();
    return;
  }

  const dropE = createDropPointerEvent(e);
  const { x: dropClientX, y: dropClientY } = getDropPointerClient(e);

  const side = dragFrom.side || prepViewSide;
  const st = getSideState(side);
  if (!canEditPrepSide(side)) {
    restoreDraggedItem(side);
    clearDragUiState();
    return;
  }

  const dropOnSell = isDropOnSell(dropE);
  const dropOnBench = isDropOnBench(dropE);
  const { x: mx, y: my } = canvasCoordsFromClient(dropClientX, dropClientY);

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
  if (Math.hypot(dx, dy) < getDragThresholdPx()) return;
  const { index, side } = pendingBenchDrag;
  pendingBenchDrag = null;
  clearTouchLongPress();
  hideSidebarTooltip();
  startBenchDrag(index, e, side);
}

function updatePendingCanvasPick(clientX, clientY) {
  if (!pendingCanvasPick || dragPayload) return;
  const dx = clientX - pendingCanvasPick.clientX;
  const dy = clientY - pendingCanvasPick.clientY;
  if (Math.hypot(dx, dy) < getDragThresholdPx()) return;
  pendingCanvasPick = null;
  onMouseDown(createSyntheticPointerEvent(clientX, clientY));
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
  if (Math.hypot(dx, dy) < getDragThresholdPx()) return;
  const { index, side } = pendingShopDrag;
  pendingShopDrag = null;
  clearTouchLongPress();
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
  clearTouchLongPress();
  hideSidebarTooltip();
  dragPayload = { itemId: st.shop[index], rotation: 0 };
  dragFrom = { type: "shop", index, side };
  startSynergyPreview();
  document.querySelector(`.shop-card[data-index="${index}"]`)?.classList.add("shop-dragging");
  syncUiDragState();
  if (e?.clientX != null && e?.clientY != null) {
    lastPointerClient.x = e.clientX;
    lastPointerClient.y = e.clientY;
  }
  syncDragGhostOverlay(lastPointerClient.x, lastPointerClient.y);
}

function startBenchDrag(index, e, side = prepViewSide) {
  const st = getSideState(side);
  if (phase !== "prep" || gameOver || !canEditPrepSide(side) || !st.bench[index]) return;
  e.preventDefault();
  clearTouchLongPress();
  hideSidebarTooltip();
  selectedBench = index;
  renderBench();
  dragPayload = { itemId: st.bench[index].itemId, rotation: st.bench[index].rotation || 0 };
  dragFrom = { type: "bench", index, side };
  startSynergyPreview();
  syncUiDragState();
  if (e?.clientX != null && e?.clientY != null) {
    lastPointerClient.x = e.clientX;
    lastPointerClient.y = e.clientY;
  }
  syncDragGhostOverlay(lastPointerClient.x, lastPointerClient.y);
}

function updateUI() {
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

function renderPrepStageChrome(playerProfile, enemyProfile) {
  const layer = document.getElementById("prep-character-layer");
  const prepPlayer = document.getElementById("prep-character-player");
  const prepEnemy = document.getElementById("prep-character-enemy");
  const statsHud = document.getElementById("prep-stats-hud");
  if (phase !== "prep") {
    layer?.setAttribute("aria-hidden", "true");
    prepPlayer?.setAttribute("hidden", "");
    prepEnemy?.setAttribute("hidden", "");
    return;
  }

  layer?.setAttribute("aria-hidden", "false");

  const fillChar = (el, profile) => {
    if (!el) return;
    if (profile.classIconSrc) {
      el.innerHTML = `<img class="prep-character-img" src="${profile.classIconSrc}" alt="" draggable="false">`;
    } else {
      el.innerHTML = `<span class="prep-character-emoji">${profile.classIcon || "❓"}</span>`;
    }
  };

  fillChar(prepPlayer, playerProfile);
  fillChar(prepEnemy, enemyProfile);
  prepPlayer?.toggleAttribute("hidden", prepViewSide !== "player");
  prepEnemy?.toggleAttribute("hidden", prepViewSide !== "enemy");

  const side = prepViewSide;
  const profile = side === "player" ? playerProfile : enemyProfile;
  const st = getSideState(side);

  if (statsHud) {
    statsHud.innerHTML = `
      <div class="prep-stats-class">${profile.className || "—"}</div>
      <div class="prep-stats-row"><span>💰</span><b>${st.gold}</b></div>
      <div class="prep-stats-row"><span>❤️</span><b>${profile.hpDisplay}</b></div>
      <div class="prep-stats-row"><span>Раунд</span><b>${Math.min(round, RUN_BATTLES)}/${RUN_BATTLES}</b></div>
    `;
    if (!document.getElementById("prep-hero-tooltip")?.classList.contains("hidden")) {
      refreshPrepHeroTooltip();
    }
  }
}

function renderPlayerProfiles() {
  const statsEl = document.getElementById("battle-stats-panel");
  const playerAvatarEl = document.getElementById("player-avatar-slot");
  const enemyAvatarEl = document.getElementById("enemy-avatar-slot");

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

  renderPrepStageChrome(playerProfile, enemyProfile);

  if (!statsEl || !playerAvatarEl || !enemyAvatarEl) return;

  statsEl.innerHTML = renderBattleStatsCompareHTML(playerProfile, enemyProfile, {
    round,
    maxRound: RUN_BATTLES,
    liveBattle: phase === "battle" || phase === "replay",
    itemCount: Math.max(playerItems.length, enemyItems.length, 1),
  });

  const liveBattle = phase === "battle" || phase === "replay";
  const playerNeedsAvatar = !liveBattle || !playerAvatarEl.querySelector(".profile-avatar");
  const enemyNeedsAvatar = !liveBattle || !enemyAvatarEl.querySelector(".profile-avatar");
  if (playerNeedsAvatar) {
    playerAvatarEl.innerHTML = renderProfileAvatarHTML(playerProfile, "player");
  }
  if (enemyNeedsAvatar) {
    enemyAvatarEl.innerHTML = renderProfileAvatarHTML(enemyProfile, "enemy");
  }
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

function renderShopCardHTML(def, { extraClasses = "", innerBefore = "", dataAttrs = "", shapeSize = "md" } = {}) {
  const classes = getRarityCardClasses(def.rarity, ["shop-card", extraClasses].filter(Boolean).join(" "));
  const shapeHtml = renderItemShapeMiniHTML(def, { size: shapeSize });
  const rarityColor = getRarityNameColor(def.rarity);
  return `<div class="${classes}"${dataAttrs ? ` ${dataAttrs}` : ""} style="--shop-rarity-color:${rarityColor}">
    ${innerBefore}
    <div class="shop-item-main">
      <div class="shop-item-visual">
        <div class="icon" style="background:${def.color}33">${def.icon}</div>
        <div class="cost" aria-label="Цена ${def.cost}"><span class="cost-value">${def.cost}</span><span class="cost-coin" aria-hidden="true">💰</span></div>
      </div>
      ${shapeHtml}
    </div>
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
    return renderShopCardHTML(def, {
      extraClasses: [frozen ? "frozen" : "", affordable || !editable ? "" : "unaffordable"].filter(Boolean).join(" "),
      innerBefore: pinBtn,
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
        if (isSyntheticMouseFromTouch()) return;
        if (e.button !== 0 || e.target.closest(".shop-pin")) return;
        beginPendingShopDrag(+card.dataset.index, e, side);
      });
      card.addEventListener("click", (e) => {
        if (isTouchUi()) return;
        if (Date.now() < suppressShopClickUntil) return;
        if (e.target.closest(".shop-pin") || shopDidDrag) {
          shopDidDrag = false;
          return;
        }
        buyFromShop(+card.dataset.index, side);
      });
    }
  });
  if (typeof refreshGamepadPrepFocus === "function") refreshGamepadPrepFocus();
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
    card.addEventListener("mousedown", (e) => {
      if (isSyntheticMouseFromTouch()) return;
      startBenchDrag(idx, e, side);
    });
  });
  if (typeof refreshGamepadPrepFocus === "function") refreshGamepadPrepFocus();
}

function renderBattleStats() {
  renderRunStats();
}

init();
