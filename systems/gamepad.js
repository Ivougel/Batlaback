/**
 * Управление с геймпада (Gamepad API).
 * Крестовина — навигация по меню и элементам; стик — курсор (опционально).
 */

const GP_XBOX = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7,
  SELECT: 8, START: 9, L3: 10, R3: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
};

const GP_SWITCH = {
  A: 1, B: 0, X: 3, Y: 2, LB: 4, RB: 5, LT: 6, RT: 7,
  SELECT: 8, START: 9, L3: 10, R3: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
};

const GP_DEADZONE = 0.18;
const GP_CURSOR_SPEED = 620;
const GP_ACTIVATION_IDLE_MS = 4000;
const GP_DPAD_REPEAT_DELAY = 0.42;
const GP_DPAD_REPEAT_RATE = 0.13;
const GP_DPAD_COOLDOWN = 0.16;
const GP_SHOP_SLOTS = 5;
const GP_BENCH_SLOTS = 6;

let gpHandlers = null;
let gpActive = false;
let gpAwaitingWake = true;
let gpButtonMap = GP_XBOX;
let gpConnectedPadKey = null;
let gpCursor = { x: 0, y: 0, initialized: false };
let gpPrevButtons = [];
let gpLastInputAt = 0;
let gpMenuFocus = { items: [], index: -1, context: null };
let gpPointerDown = false;
let gpPrepInputMode = "dpad";
let gpLastSidebarZone = "shop";
let gpPrepSideKey = null;
let gpDpadHold = { x: 0, y: 0, age: 0 };
let gpDpadCooldown = 0;
let gpHatPrev = { x: 0, y: 0 };

let gpPrepFocus = {
  zone: "shop",
  index: 0,
  col: 4,
  row: 3,
};

const GP_HINT_SETS = {
  classMode: [
    { keys: "✚", label: "выбор режима" },
    { keys: "A", label: "подтвердить" },
    { keys: "B", label: "назад" },
  ],
  classPlayer: [
    { keys: "✚", label: "класс" },
    { keys: "A", label: "выбрать" },
    { keys: "B", label: "назад" },
  ],
  classOpponent: [
    { keys: "✚", label: "класс" },
    { keys: "A", label: "выбрать" },
    { keys: "+", label: "начать" },
    { keys: "B", label: "назад" },
  ],
  prep: [
    { keys: "✚", label: "навигация" },
    { keys: "A", label: "выбрать / положить" },
    { keys: "X", label: "обновить" },
    { keys: "B", label: "отмена" },
    { keys: "←", label: "доска" },
    { keys: "L / R", label: "стол" },
    { keys: "+", label: "в бой" },
  ],
  prepDrag: [
    { keys: "✚", label: "клетка доски" },
    { keys: "A", label: "положить" },
    { keys: "ZR", label: "поворот" },
    { keys: "B", label: "отмена" },
  ],
  battle: [
    { keys: "+", label: "пауза" },
    { keys: "A", label: "пропустить" },
    { keys: "L / R", label: "скорость" },
  ],
  battleResult: [
    { keys: "✚", label: "разделы" },
    { keys: "A", label: "открыть" },
    { keys: "+ / A", label: "продолжить" },
    { keys: "X", label: "повтор" },
    { keys: "B", label: "закрыть" },
  ],
  runComplete: [
    { keys: "✚", label: "разделы" },
    { keys: "A / +", label: "главный экран" },
    { keys: "B", label: "закрыть" },
  ],
  recipeBook: [{ keys: "B", label: "закрыть" }],
  boardPreview: [{ keys: "B", label: "закрыть" }],
};

function initGamepadControls(handlers) {
  gpHandlers = handlers || {};
  const cursorEl = document.getElementById("gamepad-cursor");
  if (cursorEl && !gpCursor.initialized) {
    gpCursor.x = window.innerWidth * 0.5;
    gpCursor.y = window.innerHeight * 0.45;
    gpCursor.initialized = true;
    syncGamepadCursorElement();
  }

  const onPadChange = (e) => {
    if (e?.type === "gamepadconnected") {
      bindActiveGamepad(e.gamepad || getActiveGamepad(), true);
      gpAwaitingWake = false;
    } else {
      resetGamepadBinding();
    }
    refreshGamepadHints();
    syncGamepadCursorVisibility();
  };

  window.addEventListener("gamepadconnected", onPadChange);
  window.addEventListener("gamepaddisconnected", onPadChange);

  const wakeGamepads = () => {
    const pad = getActiveGamepad();
    if (pad) {
      bindActiveGamepad(pad, !gpConnectedPadKey);
      gpAwaitingWake = false;
      refreshGamepadHints();
    }
  };
  window.addEventListener("pointerdown", wakeGamepads, { passive: true });
  window.addEventListener("keydown", wakeGamepads);

  refreshGamepadHints();
}

function resetPrepFocus() {
  gpPrepFocus = { zone: "shop", index: 0, col: 4, row: 3 };
  gpLastSidebarZone = "shop";
  gpPrepInputMode = "dpad";
  applyPrepFocusVisual();
}

function normalizePadId(id) {
  return String(id || "").toLowerCase();
}

function isSwitchGamepad(pad) {
  const id = normalizePadId(pad?.id);
  return id.includes("nintendo") || id.includes("switch") || id.includes("057e")
    || id.includes("pro controller") || id.includes("joy-con") || id.includes("joycon");
}

function resolveGamepadButtons(pad) {
  return isSwitchGamepad(pad) ? GP_SWITCH : GP_XBOX;
}

function getGamepadLabel(pad) {
  if (!pad) return "Геймпад";
  if (isSwitchGamepad(pad)) return "Switch Pro";
  const id = pad.id || "";
  return id.split("(")[0].trim() || "Геймпад";
}

function getActiveGamepad() {
  if (!navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  for (let i = 0; i < pads.length; i++) {
    if (pads[i]?.connected) return pads[i];
  }
  return null;
}

function resetGamepadBinding() {
  gpConnectedPadKey = null;
  gpPrevButtons = [];
  gpPointerDown = false;
  if (!getActiveGamepad()) {
    gpActive = false;
    gpAwaitingWake = true;
  }
}

function bindActiveGamepad(pad, resetPrev = true) {
  if (!pad) return;
  const key = `${pad.index}:${pad.id}`;
  if (gpConnectedPadKey !== key || resetPrev) {
    gpConnectedPadKey = key;
    gpButtonMap = resolveGamepadButtons(pad);
    gpPrevButtons = (pad.buttons || []).map((b) => !!b.pressed);
  }
  gpActive = true;
}

function markGamepadInput() {
  gpLastInputAt = performance.now();
  gpActive = true;
  gpAwaitingWake = false;
  syncGamepadCursorVisibility();
}

function syncGamepadCursorElement() {
  const el = document.getElementById("gamepad-cursor");
  if (!el) return;
  el.style.transform = `translate(${gpCursor.x}px, ${gpCursor.y}px)`;
}

function syncGamepadCursorVisibility() {
  const el = document.getElementById("gamepad-cursor");
  if (!el) return;
  const useCursor = gpPrepInputMode === "stick" && gpHandlers?.useVirtualCursor?.();
  const show = gpActive && useCursor
    && (performance.now() - gpLastInputAt < GP_ACTIVATION_IDLE_MS || gpPointerDown || gpHandlers?.isDragging?.());
  el.classList.toggle("hidden", !show);
  document.body.classList.toggle("gamepad-active", !!show);
}

function wasBtnPressed(pad, name, prevButtons) {
  const idx = gpButtonMap[name];
  if (idx == null) return false;
  return !!pad.buttons[idx]?.pressed && !(prevButtons[idx] ?? false);
}

function isBtnHeld(pad, name) {
  const idx = gpButtonMap[name];
  if (idx == null) return false;
  return !!pad.buttons[idx]?.pressed;
}

function readStick(pad, axisX, axisY) {
  const x = pad.axes[axisX] || 0;
  const y = pad.axes[axisY] || 0;
  const len = Math.hypot(x, y);
  if (len < GP_DEADZONE) return { x: 0, y: 0 };
  const scale = (len - GP_DEADZONE) / (1 - GP_DEADZONE);
  return { x: (x / len) * scale, y: (y / len) * scale };
}

function readDpadDirection(pad) {
  let x = 0;
  let y = 0;
  if (isBtnHeld(pad, "LEFT")) x -= 1;
  if (isBtnHeld(pad, "RIGHT")) x += 1;
  if (isBtnHeld(pad, "UP")) y -= 1;
  if (isBtnHeld(pad, "DOWN")) y += 1;
  return { x, y };
}

function readDpadEdge(pad, prevButtons) {
  let x = 0;
  let y = 0;
  if (wasBtnPressed(pad, "LEFT", prevButtons)) x -= 1;
  if (wasBtnPressed(pad, "RIGHT", prevButtons)) x += 1;
  if (wasBtnPressed(pad, "UP", prevButtons)) y -= 1;
  if (wasBtnPressed(pad, "DOWN", prevButtons)) y += 1;
  if (x || y) {
    gpHatPrev.x = pad.axes[6] ?? pad.axes[9] ?? 0;
    gpHatPrev.y = pad.axes[7] ?? pad.axes[10] ?? 0;
    return { x, y };
  }

  // Если крестовина уже идёт через кнопки — оси hat не читаем (иначе двойной ввод).
  const btnHeld = readDpadDirection(pad);
  if (btnHeld.x || btnHeld.y) return { x: 0, y: 0 };

  const hatX = pad.axes[6] ?? pad.axes[9] ?? 0;
  const hatY = pad.axes[7] ?? pad.axes[10] ?? 0;
  if (Math.abs(hatX) < 0.45 && Math.abs(hatY) < 0.45) {
    gpHatPrev.x = hatX;
    gpHatPrev.y = hatY;
    return { x: 0, y: 0 };
  }

  let edgeX = 0;
  let edgeY = 0;
  if (Math.abs(hatX) >= Math.abs(hatY)) {
    if (Math.abs(hatX - gpHatPrev.x) >= 0.35) edgeX = hatX > 0 ? 1 : -1;
  } else if (Math.abs(hatY - gpHatPrev.y) >= 0.35) {
    edgeY = hatY > 0 ? 1 : -1;
  }

  gpHatPrev.x = hatX;
  gpHatPrev.y = hatY;
  return { x: edgeX, y: edgeY };
}

function emitDpadMove(dx, dy, onMove) {
  if (!dx && !dy) return false;
  if (gpDpadCooldown > 0) return false;
  onMove(dx, dy);
  gpDpadCooldown = GP_DPAD_COOLDOWN;
  return true;
}

/** Одно нажатие = один шаг; повтор только при удержании (опционально). */
function tickDpadNavigation(pad, prevButtons, dt, onMove, allowRepeat = false) {
  gpDpadCooldown = Math.max(0, gpDpadCooldown - dt);

  const edge = readDpadEdge(pad, prevButtons);
  if (edge.x || edge.y) {
    gpDpadHold = { x: edge.x, y: edge.y, age: 0 };
    emitDpadMove(edge.x, edge.y, onMove);
    return;
  }

  if (!allowRepeat) {
    if (!readDpadDirection(pad).x && !readDpadDirection(pad).y) {
      gpDpadHold = { x: 0, y: 0, age: 0 };
    }
    return;
  }

  const held = readDpadDirection(pad);
  if (!held.x && !held.y) {
    gpDpadHold = { x: 0, y: 0, age: 0 };
    return;
  }

  if (gpDpadHold.x !== held.x || gpDpadHold.y !== held.y) {
    gpDpadHold = { x: held.x, y: held.y, age: 0 };
  }

  gpDpadHold.age += dt;
  if (gpDpadHold.age < GP_DPAD_REPEAT_DELAY) return;

  gpDpadHold.age -= GP_DPAD_REPEAT_RATE;
  emitDpadMove(held.x, held.y, onMove);
}

function moveGamepadCursor(dx, dy, dt) {
  if (!dx && !dy) return;
  gpPrepInputMode = "stick";
  clearPrepFocusVisual();
  markGamepadInput();
  gpCursor.x = Math.max(8, Math.min(window.innerWidth - 8, gpCursor.x + dx * GP_CURSOR_SPEED * dt));
  gpCursor.y = Math.max(8, Math.min(window.innerHeight - 8, gpCursor.y + dy * GP_CURSOR_SPEED * dt));
  syncGamepadCursorElement();
  gpHandlers?.updatePointerFromClient?.(gpCursor.x, gpCursor.y);
}

function getMenuContext() {
  if (gpHandlers?.isRecipeBookOpen?.()) return "recipeBook";
  if (gpHandlers?.isBoardPreviewOpen?.()) return "boardPreview";
  if (gpHandlers?.isPopupOpen?.("battle-result-overlay")) return "battleResult";
  if (gpHandlers?.isPopupOpen?.("overlay")) return "runComplete";
  if (gpHandlers?.isPopupOpen?.("class-overlay")) {
    if (!document.getElementById("class-step-mode")?.classList.contains("hidden")) return "classMode";
    if (!document.getElementById("class-step-player")?.classList.contains("hidden")) return "classPlayer";
    return "classOpponent";
  }
  if (gpHandlers?.getPhase?.() === "battle" || gpHandlers?.getPhase?.() === "replay") return "battle";
  if (gpHandlers?.getPhase?.() === "prep" && !gpHandlers?.getGameOver?.()) {
    return gpHandlers?.isDragging?.() ? "prepDrag" : "prep";
  }
  return null;
}

function refreshGamepadHints() {
  const bar = document.getElementById("gamepad-hints-bar");
  const list = document.getElementById("gamepad-hints-list");
  const status = document.getElementById("gamepad-status");
  if (!bar || !list) return;

  const context = getMenuContext();
  const hints = context ? GP_HINT_SETS[context] : null;
  const pad = getActiveGamepad();

  if (status) {
    if (pad) {
      const label = getGamepadLabel(pad);
      const layout = isSwitchGamepad(pad) ? " · Switch" : "";
      status.textContent = `🎮 ${label}${layout}`;
      status.classList.add("is-connected");
    } else if (gpAwaitingWake) {
      status.textContent = "🎮 Кликните по игре и нажмите кнопку на геймпаде";
      status.classList.remove("is-connected");
    } else {
      status.textContent = "🎮 Подключите геймпад";
      status.classList.remove("is-connected");
    }
  }

  if (!hints) {
    bar.classList.add("hidden");
    return;
  }

  bar.classList.remove("hidden");
  list.innerHTML = hints.map((h) =>
    `<span class="gamepad-hint-chip"><kbd class="gamepad-hint-key">${h.keys}</kbd><span>${h.label}</span></span>`,
  ).join("");
}

function queryAccordionFocusables(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return [];
  const items = [];
  container.querySelectorAll(".accordion-section").forEach((section) => {
    const header = section.querySelector(".accordion-header");
    if (header) items.push(header);
    const copyBtn = section.querySelector(".accordion-copy-btn");
    if (copyBtn) items.push(copyBtn);
  });
  return items;
}

function queryMenuFocusables(context) {
  if (context === "classMode") return [...document.querySelectorAll("#class-step-mode .game-mode-card")];
  if (context === "classPlayer") {
    return [...document.querySelectorAll("#class-step-player .class-card[data-class]:not([disabled])")];
  }
  if (context === "classOpponent") {
    return [
      ...document.querySelectorAll("#class-step-opponent .opponent-class-card"),
      document.getElementById("btn-class-back"),
      document.getElementById("btn-start-run"),
    ].filter(Boolean);
  }
  if (context === "battleResult") {
    return [
      ...queryAccordionFocusables("#battle-result-accordions"),
      document.getElementById("btn-battle-replay"),
      document.getElementById("btn-battle-continue"),
    ].filter((el) => el && !el.classList.contains("hidden"));
  }
  if (context === "runComplete") {
    return [
      ...queryAccordionFocusables("#run-complete-accordions"),
      document.getElementById("btn-restart"),
    ].filter(Boolean);
  }
  if (context === "recipeBook") return [document.getElementById("btn-recipe-book-close")].filter(Boolean);
  if (context === "boardPreview") return [document.getElementById("btn-board-preview-close")].filter(Boolean);
  return [];
}

function syncMenuFocus(context) {
  const items = queryMenuFocusables(context);
  if (gpMenuFocus.context !== context) {
    gpMenuFocus = { context, items, index: items.length ? 0 : -1 };
  } else {
    gpMenuFocus.items = items;
    if (gpMenuFocus.index >= items.length) gpMenuFocus.index = items.length - 1;
    if (gpMenuFocus.index < 0 && items.length) gpMenuFocus.index = 0;
  }
  applyMenuFocusVisual();
}

function applyMenuFocusVisual() {
  document.querySelectorAll(".gamepad-focus").forEach((el) => {
    if (!el.closest("#game-canvas")) el.classList.remove("gamepad-focus");
  });
  gpMenuFocus.items.forEach((el, i) => {
    el?.classList.toggle("gamepad-focus", i === gpMenuFocus.index);
  });

  const focused = gpMenuFocus.items[gpMenuFocus.index];
  if (focused?.classList.contains("accordion-header")) {
    focused.closest(".accordion-section")?.classList.add("open");
  }
  focused?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

function clearGamepadMenuFocus() {
  gpMenuFocus.items.forEach((el) => el?.classList?.remove("gamepad-focus"));
  gpMenuFocus = { items: [], index: -1, context: null };
}

function stepSpatialMenuFocus(dx, dy) {
  const items = gpMenuFocus.items;
  const current = items[gpMenuFocus.index];
  if (!current || (!dx && !dy)) return;

  const cur = current.getBoundingClientRect();
  const curCx = cur.left + cur.width / 2;
  const curCy = cur.top + cur.height / 2;
  let bestIdx = -1;
  let bestScore = Infinity;

  items.forEach((el, i) => {
    if (i === gpMenuFocus.index) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const ddx = cx - curCx;
    const ddy = cy - curCy;
    if (dx < 0 && ddx >= -4) return;
    if (dx > 0 && ddx <= 4) return;
    if (dy < 0 && ddy >= -4) return;
    if (dy > 0 && ddy <= 4) return;
    const primary = dx !== 0 ? Math.abs(ddx) : Math.abs(ddy);
    const secondary = dx !== 0 ? Math.abs(ddy) : Math.abs(ddx);
    const score = primary + secondary * 0.35;
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });

  if (bestIdx >= 0) {
    gpMenuFocus.index = bestIdx;
    applyMenuFocusVisual();
    markGamepadInput();
    items[bestIdx]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }
}

function activateMenuFocus() {
  const el = gpMenuFocus.items[gpMenuFocus.index];
  if (!el || el.disabled) return;
  markGamepadInput();

  if (el.classList.contains("accordion-header")) {
    el.closest(".accordion-section")?.classList.add("open");
    return;
  }

  el.click();
}

function clearPrepFocusVisual() {
  document.querySelectorAll(".shop-card.gamepad-focus, .bench-card.gamepad-focus").forEach((el) => {
    el.classList.remove("gamepad-focus");
  });
  document.querySelectorAll("#shop-panel button.gamepad-focus, #btn-fight.gamepad-focus").forEach((el) => {
    el.classList.remove("gamepad-focus");
  });
  gpHandlers?.clearBoardFocus?.();
}

function getPrepHeaderButtons() {
  return [
    document.getElementById("btn-fight"),
    document.getElementById("btn-refresh"),
  ].filter((el) => el && !el.disabled && !el.classList.contains("hidden"));
}

function getPrepActionButtons() {
  return [
    document.getElementById("btn-sell"),
    document.getElementById("btn-recipe-book"),
  ].filter(Boolean);
}

function applyPrepFocusVisual() {
  clearPrepFocusVisual();
  const f = gpPrepFocus;

  if (f.zone === "shop") {
    document.querySelectorAll("#shop-slots .shop-card")[f.index]?.classList.add("gamepad-focus");
  } else if (f.zone === "bench") {
    document.querySelectorAll("#bench-slots .bench-card")[f.index]?.classList.add("gamepad-focus");
  } else if (f.zone === "actions") {
    getPrepActionButtons()[f.index]?.classList.add("gamepad-focus");
  } else if (f.zone === "header") {
    getPrepHeaderButtons()[f.index]?.classList.add("gamepad-focus");
  } else if (f.zone === "board") {
    gpHandlers?.setBoardFocus?.(f.col, f.row);
  }

  const focused = document.querySelector(".gamepad-focus");
  focused?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

function moveBoardFocus(dx, dy) {
  gpPrepFocus.zone = "board";
  gpPrepFocus.col = Math.max(0, Math.min((gpHandlers?.getGridCols?.() || 9) - 1, gpPrepFocus.col + dx));
  gpPrepFocus.row = Math.max(0, Math.min((gpHandlers?.getGridRows?.() || 7) - 1, gpPrepFocus.row + dy));
  applyPrepFocusVisual();
  markGamepadInput();
}

function movePrepFocus(dx, dy) {
  if (!dx && !dy) return;
  gpPrepInputMode = "dpad";
  markGamepadInput();

  if (gpHandlers?.isDragging?.()) {
    moveBoardFocus(dx, dy);
    return;
  }

  const f = gpPrepFocus;

  if (f.zone === "board") {
    if (dx > 0) {
      f.zone = gpLastSidebarZone || "shop";
      applyPrepFocusVisual();
      return;
    }
    if (dx < 0 || dy !== 0) moveBoardFocus(dx, dy);
    return;
  }

  if (dx < 0 && f.zone !== "board") {
    gpLastSidebarZone = f.zone;
    f.zone = "board";
    applyPrepFocusVisual();
    return;
  }

  if (f.zone === "header") {
    const btns = getPrepHeaderButtons();
    if (dx > 0 && f.index < btns.length - 1) f.index += 1;
    if (dx < 0 && f.index > 0) f.index -= 1;
    if (dy > 0) { f.zone = "shop"; f.index = 0; }
    applyPrepFocusVisual();
    return;
  }

  if (f.zone === "shop") {
    if (dx > 0 && f.index < GP_SHOP_SLOTS - 1) f.index += 1;
    if (dx < 0 && f.index > 0) f.index -= 1;
    if (dy > 0) { f.zone = "actions"; f.index = 0; }
    if (dy < 0) { f.zone = "header"; f.index = 0; }
    applyPrepFocusVisual();
    return;
  }

  if (f.zone === "actions") {
    const btns = getPrepActionButtons();
    if (dx > 0 && f.index < btns.length - 1) f.index += 1;
    if (dx < 0 && f.index > 0) f.index -= 1;
    if (dy > 0) { f.zone = "bench"; f.index = 0; }
    if (dy < 0) { f.zone = "shop"; f.index = Math.min(f.index, GP_SHOP_SLOTS - 1); }
    applyPrepFocusVisual();
    return;
  }

  if (f.zone === "bench") {
    if (dx > 0 && f.index < GP_BENCH_SLOTS - 1) f.index += 1;
    if (dx < 0 && f.index > 0) f.index -= 1;
    if (dy < 0) { f.zone = "actions"; f.index = 0; }
    applyPrepFocusVisual();
  }
}

function handleOverlayNavigation(pad, prevButtons, dt) {
  const context = getMenuContext();
  if (!context || context === "prep" || context === "prepDrag" || context === "battle") return false;

  syncMenuFocus(context);

  tickDpadNavigation(pad, prevButtons, dt, (x, y) => {
    stepSpatialMenuFocus(x, y);
  }, false);

  const stick = readStick(pad, 0, 1);
  if (Math.abs(stick.x) > 0.55 || Math.abs(stick.y) > 0.55) {
    // Стик не дублирует крестовину — только если крестовина не нажата.
    const held = readDpadDirection(pad);
    if (!held.x && !held.y) {
      if (stick.x < -0.55) stepSpatialMenuFocus(-1, 0);
      else if (stick.x > 0.55) stepSpatialMenuFocus(1, 0);
      else if (stick.y < -0.55) stepSpatialMenuFocus(0, -1);
      else if (stick.y > 0.55) stepSpatialMenuFocus(0, 1);
    }
  }

  if (wasBtnPressed(pad, "A", prevButtons)) {
    activateMenuFocus();
    return true;
  }

  if (wasBtnPressed(pad, "START", prevButtons)) {
    if (context === "classOpponent") document.getElementById("btn-start-run")?.click();
    else if (context === "battleResult") document.getElementById("btn-battle-continue")?.click();
    else if (context === "runComplete") document.getElementById("btn-restart")?.click();
    else activateMenuFocus();
    markGamepadInput();
    return true;
  }

  if (wasBtnPressed(pad, "B", prevButtons)) {
    gpHandlers?.closeAllPopups?.();
    markGamepadInput();
    return true;
  }

  if (context === "battleResult" && wasBtnPressed(pad, "X", prevButtons)) {
    document.getElementById("btn-battle-replay")?.click();
    markGamepadInput();
    return true;
  }

  return true;
}

function handlePrepGamepad(pad, prevButtons, dt) {
  const sideKey = gpHandlers?.getPrepSideKey?.();
  if (sideKey && sideKey !== gpPrepSideKey) {
    gpPrepSideKey = sideKey;
    resetPrepFocus();
  }

  if (gpHandlers?.isDragging?.() && gpPrepFocus.zone !== "board") {
    gpPrepFocus.zone = "board";
    applyPrepFocusVisual();
  }

  const allowBoardRepeat = gpHandlers?.isDragging?.() || gpPrepFocus.zone === "board";
  tickDpadNavigation(pad, prevButtons, dt, (x, y) => movePrepFocus(x, y), allowBoardRepeat);

  const stick = readStick(pad, 0, 1);
  if (Math.hypot(stick.x, stick.y) > 0.35) {
    moveGamepadCursor(stick.x, stick.y, dt);
  }

  if (wasBtnPressed(pad, "LB", prevButtons)) {
    gpHandlers?.togglePrepSide?.(-1);
    markGamepadInput();
  }
  if (wasBtnPressed(pad, "RB", prevButtons)) {
    gpHandlers?.togglePrepSide?.(1);
    markGamepadInput();
  }
  if (wasBtnPressed(pad, "Y", prevButtons)) {
    gpHandlers?.toggleRecipeBook?.();
    markGamepadInput();
  }
  if (wasBtnPressed(pad, "SELECT", prevButtons)) {
    gpHandlers?.toggleCharacteristics?.();
    markGamepadInput();
  }
  if (wasBtnPressed(pad, "X", prevButtons) && !gpHandlers?.isDragging?.()) {
    gpHandlers?.refreshShop?.();
    markGamepadInput();
  }
  if (wasBtnPressed(pad, "RT", prevButtons) && gpHandlers?.isDragging?.()) {
    gpHandlers?.rotateDrag?.();
    markGamepadInput();
  }
  if (wasBtnPressed(pad, "B", prevButtons)) {
    if (gpHandlers?.isDragging?.()) gpHandlers?.cancelDrag?.();
    else gpHandlers?.closeAllPopups?.();
    markGamepadInput();
  }

  if (wasBtnPressed(pad, "A", prevButtons) && !gpPointerDown) {
    if (gpPrepInputMode === "dpad") {
      if (gpHandlers?.isDragging?.()) gpHandlers?.dropAtBoardFocus?.();
      else gpHandlers?.activatePrepFocus?.(gpPrepFocus);
      markGamepadInput();
    } else {
      gpPointerDown = true;
      gpHandlers?.pointerDownAt?.(gpCursor.x, gpCursor.y);
      markGamepadInput();
    }
  }

  if (gpPrepInputMode === "stick" && !isBtnHeld(pad, "A") && gpPointerDown) {
    gpPointerDown = false;
    gpHandlers?.pointerUpAt?.(gpCursor.x, gpCursor.y);
    markGamepadInput();
  }

  if (wasBtnPressed(pad, "START", prevButtons)) {
    gpHandlers?.confirmPrimary?.();
    markGamepadInput();
  }

  if (gpPrepInputMode === "dpad" && !gpHandlers?.isDragging?.()) {
    applyPrepFocusVisual();
  } else if (gpHandlers?.isDragging?.() && gpPrepFocus.zone === "board") {
    applyPrepFocusVisual();
  }
}

function handleBattleGamepad(pad, prevButtons) {
  if (wasBtnPressed(pad, "START", prevButtons)) {
    gpHandlers?.togglePause?.();
    markGamepadInput();
  }
  if (wasBtnPressed(pad, "A", prevButtons)) {
    gpHandlers?.confirmPrimary?.();
    markGamepadInput();
  }
  if (wasBtnPressed(pad, "LB", prevButtons)) {
    gpHandlers?.cycleBattleSpeed?.(-1);
    markGamepadInput();
  }
  if (wasBtnPressed(pad, "RB", prevButtons)) {
    gpHandlers?.cycleBattleSpeed?.(1);
    markGamepadInput();
  }
  if (wasBtnPressed(pad, "B", prevButtons)) {
    gpHandlers?.closeAllPopups?.();
    markGamepadInput();
  }
}

function tickGamepad(dt) {
  if (!navigator.getGamepads) return;

  const pad = getActiveGamepad();
  if (!pad) {
    if (gpPointerDown) {
      gpPointerDown = false;
      gpHandlers?.pointerUpAt?.(gpCursor.x, gpCursor.y);
    }
    syncGamepadCursorVisibility();
    return;
  }

  bindActiveGamepad(pad, false);
  gpActive = true;
  gpAwaitingWake = false;

  const prevButtons = gpPrevButtons;
  gpPrevButtons = (pad.buttons || []).map((b) => !!b.pressed);

  const context = getMenuContext();
  refreshGamepadHints();

  if (context && context !== "prep" && context !== "prepDrag" && context !== "battle") {
    handleOverlayNavigation(pad, prevButtons, dt);
    syncGamepadCursorVisibility();
    return;
  }

  clearGamepadMenuFocus();

  if (context === "prep" || context === "prepDrag") {
    handlePrepGamepad(pad, prevButtons, dt);
  } else if (context === "battle") {
    handleBattleGamepad(pad, prevButtons);
  } else {
    clearPrepFocusVisual();
  }

  syncGamepadCursorVisibility();
}
