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
const GP_WAKE_THRESHOLD = 0.12;
const GP_HAT_THRESHOLD = 0.35;
const GP_CURSOR_SPEED = 620;
const GP_ACTIVATION_IDLE_MS = 4000;
const GP_DPAD_REPEAT_DELAY = 0.42;
const GP_DPAD_REPEAT_RATE = 0.13;
const GP_DPAD_COOLDOWN = 0.16;
const GP_PREP_ZONES = ["board", "shop", "bench"];
const SHOP_GRID_COLS = 2;
const BENCH_GRID_COLS = 3;

let gpHandlers = null;
let gpActive = false;
let gpAwaitingWake = true;
let gpButtonMap = GP_XBOX;
let gpConnectedPadKey = null;
let gpPreferredPadIndex = null;
let gpMergedPadCache = null;
let gpCursor = { x: 0, y: 0, initialized: false };
let gpPrevButtons = [];
let gpLastInputAt = 0;
let gpMenuFocus = { items: [], index: -1, context: null };
let gpPointerDown = false;
let gpPrepInputMode = "dpad";
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
    { keys: "✚", label: "в зоне" },
    { keys: "RB", label: "поле" },
    { keys: "LB", label: "стол" },
    { keys: "A", label: "выбрать" },
    { keys: "X", label: "продажа / обновить" },
    { keys: "B", label: "отмена" },
    { keys: "SELECT", label: "подсказки" },
    { keys: "+", label: "в бой" },
  ],
  prepDrag: [
    { keys: "✚", label: "клетка" },
    { keys: "A", label: "положить" },
    { keys: "X", label: "продать" },
    { keys: "ZR", label: "поворот" },
    { keys: "B", label: "отмена" },
  ],
  battle: [
    { keys: "+", label: "пауза" },
    { keys: "A", label: "пропустить" },
    { keys: "L / R", label: "скорость" },
  ],
  battleResult: [
    { keys: "✚", label: "кнопки" },
    { keys: "A", label: "вклад / лог" },
    { keys: "+ / A", label: "продолжить" },
    { keys: "X", label: "повтор" },
    { keys: "B", label: "закрыть" },
  ],
  battleDetail: [
    { keys: "A", label: "копировать" },
    { keys: "B", label: "назад" },
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

  const pollGamepads = () => {
    const pad = getActiveGamepad();
    if (pad) bindActiveGamepad(pad, !gpConnectedPadKey);
  };
  window.addEventListener("pointerdown", pollGamepads, { passive: true });
  window.addEventListener("keydown", pollGamepads);
  window.addEventListener("focus", pollGamepads);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pollGamepads();
  });

  onInteractionModeChange((mode, prev) => {
    if (prev === "gamepad" && mode !== "gamepad") {
      clearGamepadInteractionState({ cancelDrag: true });
    }
    refreshGamepadHints();
    syncGamepadCursorVisibility();
    if (typeof applyUiLayout === "function") applyUiLayout();
  });

  refreshGamepadHints();
}

function resetPrepFocus() {
  gpPrepFocus = { zone: "shop", index: 0, col: 4, row: 3 };
  gpPrepInputMode = "dpad";
  applyPrepFocusVisual();
}

function normalizePadId(id) {
  return String(id || "").toLowerCase();
}

function gamepadButtonValue(btn) {
  if (!btn) return 0;
  if (btn.pressed) return 1;
  return btn.value ?? 0;
}

function isGameSirGamepad(pad) {
  const id = normalizePadId(pad?.id);
  return id.includes("gamesir") || id.includes("game sir") || id.includes("x2s") || id.includes("x2 ");
}

function isGenericIosXboxPad(pad) {
  const id = normalizePadId(pad?.id);
  return id.includes("xbox wireless controller") && !id.includes("microsoft");
}

function isSwitchGamepad(pad) {
  const id = normalizePadId(pad?.id);
  if (id.includes("nintendo") || id.includes("switch") || id.includes("057e")
    || id.includes("pro controller") || id.includes("joy-con") || id.includes("joycon")) {
    return true;
  }
  // GameSir в режиме Switch на iOS часто маскируется под Xbox Wireless Controller.
  if (isGameSirGamepad(pad) && (id.includes("switch") || pad?.mapping === "xr-standard")) {
    return true;
  }
  return false;
}

function resolveGamepadButtons(pad) {
  return isSwitchGamepad(pad) ? GP_SWITCH : GP_XBOX;
}

function getGamepadLabel(pad) {
  if (!pad) return "Геймпад";
  if (isSwitchGamepad(pad)) return "Switch Pro";
  if (isGameSirGamepad(pad)) return "GameSir";
  if (isGenericIosXboxPad(pad)) return "GameSir / Xbox";
  const id = pad.id || "";
  return id.split("(")[0].trim() || "Геймпад";
}

function getConnectedGamepads() {
  if (!navigator.getGamepads) return [];
  const pads = [];
  const list = navigator.getGamepads();
  for (let i = 0; i < list.length; i++) {
    const pad = list[i];
    if (pad && pad.connected !== false) pads.push(pad);
  }
  return pads;
}

function isSplitHalfPad(pad) {
  const count = pad?.buttons?.length || 0;
  return count > 0 && count <= 10;
}

function gamepadActivityScore(pad) {
  if (!pad) return 0;
  let score = 0;
  for (const btn of pad.buttons || []) {
    const val = gamepadButtonValue(btn);
    if (val > GP_WAKE_THRESHOLD) score += val;
  }
  for (const axis of pad.axes || []) {
    if (Math.abs(axis) > GP_DEADZONE) score += Math.abs(axis);
  }
  const hat = readHatAxes(pad);
  if (hat.x || hat.y) score += 1;
  return score;
}

function mergeGamepadStates(pads) {
  if (!pads.length) return null;
  if (pads.length === 1) return pads[0];

  const base = pads[0];
  const mergedButtons = [...(base.buttons || [])];
  const mergedAxes = [...(base.axes || [])];

  for (let i = 1; i < pads.length; i++) {
    const pad = pads[i];
    for (let b = 0; b < (pad.buttons?.length || 0); b++) {
      const val = gamepadButtonValue(pad.buttons[b]);
      if (val > gamepadButtonValue(mergedButtons[b])) mergedButtons[b] = pad.buttons[b];
    }
    for (let a = 0; a < (pad.axes?.length || 0); a++) {
      const val = pad.axes[a] || 0;
      if (Math.abs(val) > Math.abs(mergedAxes[a] || 0)) mergedAxes[a] = val;
    }
  }

  gpMergedPadCache = {
    index: base.index,
    id: pads.map((p) => p.id).join(" + "),
    connected: true,
    buttons: mergedButtons,
    axes: mergedAxes,
    mapping: base.mapping || "",
  };
  return gpMergedPadCache;
}

function pickActiveGamepad(pads) {
  if (!pads.length) return null;

  if (gpPreferredPadIndex != null) {
    const preferred = pads.find((p) => p.index === gpPreferredPadIndex);
    if (preferred) return preferred;
    gpPreferredPadIndex = null;
  }

  if (pads.length >= 2 && pads.every(isSplitHalfPad)) {
    return mergeGamepadStates(pads);
  }

  if (pads.length === 1) return pads[0];

  let best = pads[0];
  let bestScore = gamepadActivityScore(best);
  for (let i = 1; i < pads.length; i++) {
    const score = gamepadActivityScore(pads[i]);
    if (score > bestScore) {
      best = pads[i];
      bestScore = score;
    }
  }
  return best;
}

function getActiveGamepad() {
  const pads = getConnectedGamepads();
  return pickActiveGamepad(pads);
}

function resetGamepadBinding() {
  gpConnectedPadKey = null;
  gpPreferredPadIndex = null;
  gpMergedPadCache = null;
  gpPrevButtons = [];
  gpPointerDown = false;
  if (!getActiveGamepad()) {
    gpActive = false;
    gpAwaitingWake = true;
  }
}

function clearGamepadInteractionState(options = {}) {
  if (gpPointerDown) {
    gpPointerDown = false;
    gpHandlers?.pointerUpAt?.(gpCursor.x, gpCursor.y);
  }
  if (options.cancelDrag && gpHandlers?.isDragging?.()) {
    gpHandlers?.cancelDrag?.();
  }
  gpActive = false;
  clearGamepadMenuFocus();
  clearPrepFocusVisual();
  syncGamepadCursorVisibility();
}

function bindActiveGamepad(pad, resetPrev = true) {
  if (!pad) return;
  const key = `${pad.index}:${pad.id}`;
  if (gpConnectedPadKey !== key || resetPrev) {
    gpConnectedPadKey = key;
    gpButtonMap = resolveGamepadButtons(pad);
    gpPrevButtons = (pad.buttons || []).map((b) => gamepadButtonValue(b) > GP_WAKE_THRESHOLD);
  }
}

function markGamepadInput(pad) {
  markGamepadInteraction();
  gpLastInputAt = performance.now();
  gpAwaitingWake = false;
  gpActive = true;
  if (pad?.index != null) gpPreferredPadIndex = pad.index;
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
  const useCursor = isGamepadInteraction()
    && gpPrepInputMode === "stick"
    && gpHandlers?.useVirtualCursor?.();
  const show = gpActive && useCursor
    && (performance.now() - gpLastInputAt < GP_ACTIVATION_IDLE_MS || gpPointerDown || gpHandlers?.isDragging?.());
  el.classList.toggle("hidden", !show);
  document.body.classList.toggle("gamepad-active", !!show);
}

function readHatAxes(pad) {
  const hatX = pad.axes?.[6] ?? pad.axes?.[9] ?? 0;
  const hatY = pad.axes?.[7] ?? pad.axes?.[10] ?? 0;
  let x = 0;
  let y = 0;
  if (Math.abs(hatX) >= GP_HAT_THRESHOLD) x = hatX > 0 ? 1 : -1;
  if (Math.abs(hatY) >= GP_HAT_THRESHOLD) y = hatY > 0 ? 1 : -1;
  return { x, y };
}

function hasAnyGamepadInput(pad) {
  if (!pad) return false;

  for (const btn of pad.buttons || []) {
    if (gamepadButtonValue(btn) > GP_WAKE_THRESHOLD) return true;
  }

  for (let axis = 0; axis + 1 < (pad.axes?.length || 0); axis += 2) {
    const x = pad.axes[axis] || 0;
    const y = pad.axes[axis + 1] || 0;
    if (Math.hypot(x, y) > GP_DEADZONE) return true;
  }

  const hat = readHatAxes(pad);
  return !!(hat.x || hat.y);
}

function detectGamepadActivity(pad, prevButtons) {
  if (!pad) return false;

  const buttons = pad.buttons || [];
  for (let i = 0; i < buttons.length; i++) {
    const val = gamepadButtonValue(buttons[i]);
    const pressed = val > GP_WAKE_THRESHOLD;
    if (pressed && !(prevButtons[i] ?? false)) return true;
    if (gpAwaitingWake && pressed) return true;
  }

  for (let axis = 0; axis + 1 < (pad.axes?.length || 0); axis += 2) {
    const x = pad.axes[axis] || 0;
    const y = pad.axes[axis + 1] || 0;
    if (Math.hypot(x, y) > GP_DEADZONE) return true;
  }

  const dpad = readDpadDirection(pad);
  if (dpad.x || dpad.y) return true;

  const hat = readHatAxes(pad);
  if (hat.x || hat.y) {
    if (gpAwaitingWake) return true;
    if (Math.abs((pad.axes?.[6] ?? pad.axes?.[9] ?? 0) - gpHatPrev.x) >= GP_HAT_THRESHOLD
      || Math.abs((pad.axes?.[7] ?? pad.axes?.[10] ?? 0) - gpHatPrev.y) >= GP_HAT_THRESHOLD) {
      return true;
    }
  }

  return false;
}

function isButtonActive(pad, idx) {
  const btn = pad.buttons[idx];
  if (!btn) return false;
  return gamepadButtonValue(btn) > GP_WAKE_THRESHOLD;
}

function wasBtnPressed(pad, name, prevButtons) {
  const idx = gpButtonMap[name];
  if (idx == null) return false;
  return isButtonActive(pad, idx) && !(prevButtons[idx] ?? false);
}

function isBtnHeld(pad, name) {
  const idx = gpButtonMap[name];
  if (idx == null) return false;
  return isButtonActive(pad, idx);
}

/** Switch Pro: смена зоны на ZL (LT), Xbox — на RB. */
function getPrepZoneCycleButton(pad) {
  return isSwitchGamepad(pad) ? "LT" : "RB";
}

function mapHintsForPad(hints, pad) {
  if (!hints || !isSwitchGamepad(pad)) return hints;
  return hints.map((h) => {
    if (h.keys === "RB" && h.label === "поле") return { ...h, keys: "ZL" };
    if (h.keys === "LB" && h.label === "стол") return { ...h, keys: "L" };
    return h;
  });
}

function readStick(pad, axisX, axisY) {
  const x = pad.axes[axisX] || 0;
  const y = pad.axes[axisY] || 0;
  const len = Math.hypot(x, y);
  if (len < GP_DEADZONE) return { x: 0, y: 0 };
  const scale = (len - GP_DEADZONE) / (1 - GP_DEADZONE);
  return { x: (x / len) * scale, y: (y / len) * scale };
}

function readDpadButtonsOnly(pad) {
  let x = 0;
  let y = 0;
  if (isBtnHeld(pad, "LEFT")) x -= 1;
  if (isBtnHeld(pad, "RIGHT")) x += 1;
  if (isBtnHeld(pad, "UP")) y -= 1;
  if (isBtnHeld(pad, "DOWN")) y += 1;
  return { x, y };
}

function readDpadDirection(pad) {
  const buttons = readDpadButtonsOnly(pad);
  if (buttons.x || buttons.y) return buttons;
  return readHatAxes(pad);
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
  const btnHeld = readDpadButtonsOnly(pad);
  if (btnHeld.x || btnHeld.y) return { x: 0, y: 0 };

  const hatX = pad.axes[6] ?? pad.axes[9] ?? 0;
  const hatY = pad.axes[7] ?? pad.axes[10] ?? 0;
  if (Math.abs(hatX) < GP_HAT_THRESHOLD && Math.abs(hatY) < GP_HAT_THRESHOLD) {
    gpHatPrev.x = hatX;
    gpHatPrev.y = hatY;
    return { x: 0, y: 0 };
  }

  let edgeX = 0;
  let edgeY = 0;
  if (Math.abs(hatX) >= Math.abs(hatY)) {
    if (Math.abs(hatX - gpHatPrev.x) >= GP_HAT_THRESHOLD) edgeX = hatX > 0 ? 1 : -1;
  } else if (Math.abs(hatY - gpHatPrev.y) >= GP_HAT_THRESHOLD) {
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
  if (typeof isDetailPopupOpen === "function" && isDetailPopupOpen()) return "battleDetail";
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
  const pad = getActiveGamepad();
  refreshPrepToolbarHints(pad);

  const hints = context ? mapHintsForPad(GP_HINT_SETS[context], pad) : null;

  if (status) {
    if (pad) {
      const label = getGamepadLabel(pad);
      const layout = isSwitchGamepad(pad) ? " · Switch" : "";
      status.textContent = `🎮 ${label}${layout}`;
      status.classList.add("is-connected");
    } else if (gpAwaitingWake) {
      status.textContent = isTouchCapableDevice()
        ? "🎮 Коснитесь экрана и нажмите любую кнопку на геймпаде"
        : "🎮 Кликните по игре и нажмите кнопку на геймпаде";
      status.classList.remove("is-connected");
    } else {
      status.textContent = "🎮 Подключите геймпад";
      status.classList.remove("is-connected");
    }
  }

  if (!hints || !isGamepadInteraction()) {
    bar.classList.add("hidden");
    return;
  }

  bar.classList.remove("hidden");
  list.innerHTML = hints.map((h) =>
    `<span class="gamepad-hint-chip"><kbd class="gamepad-hint-key">${h.keys}</kbd><span>${h.label}</span></span>`,
  ).join("");
}

function preferSwitchPrepHints(pad) {
  return isSwitchGamepad(pad) || isTouchInteraction() || document.documentElement.dataset.touch === "true";
}

function refreshPrepToolbarHints(pad) {
  const el = document.getElementById("prep-toolbar-hints");
  if (!el) return;
  const context = getMenuContext();
  if (!isGamepadInteraction() || (context !== "prep" && context !== "prepDrag")) {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }
  el.classList.remove("hidden");

  const switchPad = preferSwitchPrepHints(pad);
  const hints = context === "prepDrag"
    ? [
      { keys: "✚", label: "клетка" },
      { keys: "A", label: "положить" },
      { keys: "X", label: "продать" },
      { keys: switchPad ? "ZR" : "RT", label: "поворот" },
      { keys: "B", label: "отмена" },
    ]
    : [
      { keys: "✚", label: "навигация" },
      { keys: switchPad ? "ZL" : "RB", label: switchPad ? "окно" : "зона" },
      { keys: switchPad ? "L" : "LB", label: "стол" },
      { keys: "A", label: "выбор" },
      { keys: "X", label: "продажа" },
      { keys: "B", label: "отмена" },
      { keys: switchPad ? "−" : "SELECT", label: "инфо" },
      { keys: "+", label: "бой" },
    ];

  el.innerHTML = hints.map((h) =>
    `<span class="prep-hint-chip"><kbd class="prep-hint-key">${h.keys}</kbd><span>${h.label}</span></span>`,
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
      ...document.querySelectorAll("#battle-result-accordions .battle-result-popup-trigger"),
      ...document.querySelectorAll("#battle-result-accordions .popup-trigger-copy-btn"),
      document.getElementById("btn-battle-replay"),
      document.getElementById("btn-battle-continue"),
    ].filter((el) => el && !el.classList.contains("hidden"));
  }
  if (context === "battleDetail") {
    return [
      document.getElementById("btn-battle-detail-copy"),
      document.getElementById("btn-battle-detail-close"),
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
  if (
    focused?.classList.contains("class-card")
    || focused?.classList.contains("game-mode-card")
    || focused?.classList.contains("opponent-class-card")
  ) {
    focused.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
  } else {
    focused?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }
}

function clearGamepadMenuFocus() {
  gpMenuFocus.items.forEach((el) => el?.classList?.remove("gamepad-focus"));
  gpMenuFocus = { items: [], index: -1, context: null };
}

function stepSpatialFocusIndex(items, currentIndex, dx, dy) {
  const current = items[currentIndex];
  if (!current || (!dx && !dy)) return currentIndex;

  const cur = current.getBoundingClientRect();
  const curCx = cur.left + cur.width / 2;
  const curCy = cur.top + cur.height / 2;
  let bestIdx = -1;
  let bestScore = Infinity;

  items.forEach((el, i) => {
    if (i === currentIndex) return;
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

  return bestIdx >= 0 ? bestIdx : currentIndex;
}

function stepSpatialMenuFocus(dx, dy) {
  const items = gpMenuFocus.items;
  const next = stepSpatialFocusIndex(items, gpMenuFocus.index, dx, dy);
  if (next !== gpMenuFocus.index) {
    gpMenuFocus.index = next;
    applyMenuFocusVisual();
    markGamepadInput();
    items[next]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
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
  gpHandlers?.clearBoardFocus?.();
}

function getShopFocusCards() {
  return [...document.querySelectorAll("#shop-slots .shop-card")];
}

function getBenchFocusCards() {
  return [...document.querySelectorAll("#bench-slots .bench-card")];
}

function clampPrepFocusIndices() {
  if (gpPrepFocus.zone === "shop") {
    const n = getShopFocusCards().length;
    if (n) gpPrepFocus.index = Math.max(0, Math.min(gpPrepFocus.index, n - 1));
    else gpPrepFocus.index = 0;
  } else if (gpPrepFocus.zone === "bench") {
    const n = getBenchFocusCards().length;
    if (n) gpPrepFocus.index = Math.max(0, Math.min(gpPrepFocus.index, n - 1));
    else gpPrepFocus.index = 0;
  }
}

function applyPrepFocusVisual() {
  clearPrepFocusVisual();
  clampPrepFocusIndices();
  const f = gpPrepFocus;

  if (f.zone === "shop") {
    getShopFocusCards()[f.index]?.classList.add("gamepad-focus");
  } else if (f.zone === "bench") {
    getBenchFocusCards()[f.index]?.classList.add("gamepad-focus");
  } else if (f.zone === "board") {
    gpHandlers?.setBoardFocus?.(f.col, f.row);
  }

  const focused = document.querySelector(".gamepad-focus");
  focused?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  gpHandlers?.onPrepFocusChanged?.(f);
}

function cyclePrepZone(dir = 1) {
  const zones = GP_PREP_ZONES;
  let i = zones.indexOf(gpPrepFocus.zone);
  if (i < 0) i = 0;
  gpPrepFocus.zone = zones[(i + dir + zones.length) % zones.length];
  applyPrepFocusVisual();
  markGamepadInput();
}

function moveBoardFocus(dx, dy) {
  gpPrepFocus.col = Math.max(0, Math.min((gpHandlers?.getGridCols?.() || 9) - 1, gpPrepFocus.col + dx));
  gpPrepFocus.row = Math.max(0, Math.min((gpHandlers?.getGridRows?.() || 7) - 1, gpPrepFocus.row + dy));
  applyPrepFocusVisual();
  markGamepadInput();
}

function moveGridFocusIndex(index, count, cols, dx, dy) {
  if (!count) return index;
  let idx = Math.min(Math.max(0, index), count - 1);
  const row = Math.floor(idx / cols);
  const col = idx % cols;

  if (dx !== 0) {
    const newCol = col + dx;
    if (newCol >= 0 && newCol < cols) {
      const candidate = row * cols + newCol;
      if (candidate < count) idx = candidate;
    }
    return idx;
  }

  if (dy !== 0) {
    const newRow = row + dy;
    if (newRow < 0) return idx;
    const maxRow = Math.floor((count - 1) / cols);
    if (newRow > maxRow) return idx;
    let candidate = newRow * cols + col;
    if (candidate >= count) {
      if (count % cols === 1 && newRow === maxRow) idx = count - 1;
      return idx;
    }
    idx = candidate;
  }

  return idx;
}

function movePrepFocus(dx, dy) {
  if (!dx && !dy) return;
  gpPrepInputMode = "dpad";
  markGamepadInput();

  if (gpHandlers?.isDragging?.()) {
    if (gpPrepFocus.zone !== "board") {
      gpPrepFocus.zone = "board";
    }
    moveBoardFocus(dx, dy);
    return;
  }

  const f = gpPrepFocus;

  if (f.zone === "board") {
    moveBoardFocus(dx, dy);
    return;
  }

  if (f.zone === "shop") {
    const cards = getShopFocusCards();
    if (!cards.length) return;
    f.index = moveGridFocusIndex(f.index, cards.length, SHOP_GRID_COLS, dx, dy);
    applyPrepFocusVisual();
    return;
  }

  if (f.zone === "bench") {
    const cards = getBenchFocusCards();
    if (!cards.length) return;
    f.index = moveGridFocusIndex(f.index, cards.length, BENCH_GRID_COLS, dx, dy);
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
    if (typeof hideDetailPopup === "function" && isDetailPopupOpen()) {
      hideDetailPopup();
      markGamepadInput();
      return true;
    }
    if (context === "classOpponent") document.getElementById("btn-start-run")?.click();
    else if (context === "battleResult") document.getElementById("btn-battle-continue")?.click();
    else if (context === "runComplete") document.getElementById("btn-restart")?.click();
    else activateMenuFocus();
    markGamepadInput();
    return true;
  }

  if (wasBtnPressed(pad, "B", prevButtons)) {
    if (typeof hideDetailPopup === "function" && isDetailPopupOpen()) {
      hideDetailPopup();
    } else {
      gpHandlers?.closeAllPopups?.();
    }
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
    gpHandlers?.togglePrepSide?.();
    markGamepadInput();
  }
  if (wasBtnPressed(pad, getPrepZoneCycleButton(pad), prevButtons)) {
    cyclePrepZone(1);
    markGamepadInput();
  }
  if (wasBtnPressed(pad, "Y", prevButtons)) {
    gpHandlers?.toggleRecipeBook?.();
    markGamepadInput();
  }
  if (wasBtnPressed(pad, "SELECT", prevButtons)) {
    gpHandlers?.togglePrepTooltips?.();
    markGamepadInput();
  }
  if (wasBtnPressed(pad, "X", prevButtons)) {
    if (gpHandlers?.isDragging?.()) {
      gpHandlers?.sellDraggedQuick?.();
    } else if (gpPrepFocus.zone === "board") {
      gpHandlers?.sellBoardFocus?.();
    } else if (gpPrepFocus.zone === "bench") {
      gpHandlers?.sellBenchFocus?.(gpPrepFocus.index);
    } else if (gpPrepFocus.zone === "shop") {
      gpHandlers?.refreshShop?.();
    }
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

function refreshGamepadPrepFocus() {
  const ctx = getMenuContext();
  if (ctx === "prep" || ctx === "prepDrag") applyPrepFocusVisual();
}

function tickGamepad(dt) {
  if (!navigator.getGamepads) return;

  const pad = getActiveGamepad();
  if (!pad) {
    if (gpPointerDown && isGamepadInteraction()) {
      gpPointerDown = false;
      gpHandlers?.pointerUpAt?.(gpCursor.x, gpCursor.y);
    }
    gpActive = false;
    syncGamepadCursorVisibility();
    return;
  }

  bindActiveGamepad(pad, false);

  const prevButtons = gpPrevButtons;
  const nextButtons = (pad.buttons || []).map((b) => gamepadButtonValue(b) > GP_WAKE_THRESHOLD);

  if (detectGamepadActivity(pad, prevButtons)
    || (!isGamepadInteraction() && hasAnyGamepadInput(pad))) {
    markGamepadInput(pad);
  }

  gpPrevButtons = nextButtons;

  if (!isGamepadInteraction()) {
    gpActive = false;
    refreshGamepadHints();
    syncGamepadCursorVisibility();
    return;
  }

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
