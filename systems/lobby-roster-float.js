/**
 * Плавающий ростер лобби на экране подготовки: перетаскивание 👀 по полю и toggle списка.
 */

const LOBBY_ROSTER_FLOAT_STORAGE_KEY = "bb-lobby-roster-float-pos";
const LOBBY_ROSTER_FLOAT_DRAG_PX = 8;

let lobbyRosterFloatDrag = null;
let lobbyRosterFloatToggleCollapse = null;
let lobbyRosterFloatResizeObserver = null;

function readLobbyRosterFloatPosition() {
  try {
    const raw = localStorage.getItem(LOBBY_ROSTER_FLOAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.x) || !Number.isFinite(parsed?.y)) return null;
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

function saveLobbyRosterFloatPosition(x, y) {
  try {
    localStorage.setItem(LOBBY_ROSTER_FLOAT_STORAGE_KEY, JSON.stringify({ x, y }));
  } catch {
    /* ignore quota / private mode */
  }
}

function getLobbyRosterFloatBounds() {
  const field = document.getElementById("prep-field-column");
  const panel = document.getElementById("lobby-prep-roster-panel");
  if (!field || !panel || panel.classList.contains("hidden")) return null;
  const fieldRect = field.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  return {
    field,
    minX: 0,
    minY: 0,
    maxX: Math.max(0, fieldRect.width - panelRect.width),
    maxY: Math.max(0, fieldRect.height - panelRect.height),
  };
}

function applyLobbyRosterFloatPosition(x, y, { save = false } = {}) {
  const panel = document.getElementById("lobby-prep-roster-panel");
  const bounds = getLobbyRosterFloatBounds();
  if (!panel || !bounds) return;
  const clampedX = Math.max(bounds.minX, Math.min(x, bounds.maxX));
  const clampedY = Math.max(bounds.minY, Math.min(y, bounds.maxY));
  panel.style.setProperty("--lobby-roster-float-x", `${clampedX}px`);
  panel.style.setProperty("--lobby-roster-float-y", `${clampedY}px`);
  panel.dataset.lobbyRosterPositioned = "true";
  if (save) saveLobbyRosterFloatPosition(clampedX, clampedY);
}

function readLobbyRosterFloatAppliedPosition(panel) {
  const xRaw = panel.style.getPropertyValue("--lobby-roster-float-x").trim();
  const yRaw = panel.style.getPropertyValue("--lobby-roster-float-y").trim();
  const x = parseFloat(xRaw);
  const y = parseFloat(yRaw);
  if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  return null;
}

function captureLobbyRosterHandleAnchor() {
  const panel = document.getElementById("lobby-prep-roster-panel");
  const handle = document.getElementById("btn-lobby-roster-hide");
  const field = document.getElementById("prep-field-column");
  if (!panel || !handle || !field || panel.classList.contains("hidden")) return null;
  const fieldRect = field.getBoundingClientRect();
  const handleRect = handle.getBoundingClientRect();
  return {
    handleX: handleRect.left - fieldRect.left,
    handleY: handleRect.top - fieldRect.top,
    handleW: handleRect.width,
    handleH: handleRect.height,
  };
}

function syncLobbyRosterExpandDirection() {
  const panel = document.getElementById("lobby-prep-roster-panel");
  const field = document.getElementById("prep-field-column");
  const handle = document.getElementById("btn-lobby-roster-hide");
  if (!panel || !field || !handle || panel.classList.contains("hidden")) return;
  if (panel.classList.contains("lobby-prep-roster-panel--collapsed")) {
    panel.removeAttribute("data-lobby-roster-expand");
    return;
  }
  const fieldRect = field.getBoundingClientRect();
  const handleRect = handle.getBoundingClientRect();
  const handleCenterX = handleRect.left + handleRect.width / 2 - fieldRect.left;
  const ratio = fieldRect.width > 0 ? handleCenterX / fieldRect.width : 0.5;
  if (ratio >= 0.58) panel.dataset.lobbyRosterExpand = "left";
  else if (ratio <= 0.42) panel.dataset.lobbyRosterExpand = "right";
  else panel.dataset.lobbyRosterExpand = "down";
}

function stabilizeLobbyRosterExpandPosition(anchor) {
  const panel = document.getElementById("lobby-prep-roster-panel");
  const handle = document.getElementById("btn-lobby-roster-hide");
  if (!panel || !handle || panel.classList.contains("lobby-prep-roster-panel--collapsed") || !anchor) return;
  const expand = panel.dataset.lobbyRosterExpand || "down";
  requestAnimationFrame(() => {
    const panelW = panel.offsetWidth;
    const panelH = panel.offsetHeight;
    const handleW = handle.offsetWidth || anchor.handleW;
    const handleH = handle.offsetHeight || anchor.handleH;
    let left = anchor.handleX;
    let top = anchor.handleY;
    if (expand === "left") left = anchor.handleX - (panelW - handleW);
    else if (expand === "right") left = anchor.handleX;
    else top = anchor.handleY;
    applyLobbyRosterFloatPosition(left, top);
    clampLobbyRosterFloatPosition();
  });
}

function refreshLobbyRosterFloatLayout({ anchor } = {}) {
  syncLobbyRosterExpandDirection();
  if (anchor) stabilizeLobbyRosterExpandPosition(anchor);
  else clampLobbyRosterFloatPosition();
}

function clampLobbyRosterFloatPosition() {
  const panel = document.getElementById("lobby-prep-roster-panel");
  if (!panel || panel.classList.contains("hidden") || panel.dataset.lobbyRosterPositioned !== "true") return;
  const saved = readLobbyRosterFloatAppliedPosition(panel) || readLobbyRosterFloatPosition();
  if (!saved) return;
  applyLobbyRosterFloatPosition(saved.x, saved.y);
}

function restoreLobbyRosterFloatPosition() {
  const panel = document.getElementById("lobby-prep-roster-panel");
  if (!panel || panel.classList.contains("hidden")) return;
  if (panel.dataset.lobbyRosterPositioned === "true") {
    clampLobbyRosterFloatPosition();
    refreshLobbyRosterFloatLayout();
    return;
  }
  const saved = readLobbyRosterFloatPosition();
  if (!saved) return;
  requestAnimationFrame(() => {
    applyLobbyRosterFloatPosition(saved.x, saved.y);
  });
}

function clearLobbyRosterFloatDragState() {
  if (!lobbyRosterFloatDrag) return;
  const { handle, pointerId } = lobbyRosterFloatDrag;
  if (handle?.hasPointerCapture?.(pointerId)) {
    handle.releasePointerCapture(pointerId);
  }
  handle?.classList.remove("lobby-roster-float-handle--dragging");
  document.getElementById("lobby-prep-roster-panel")?.classList.remove("lobby-prep-roster-panel--dragging");
  lobbyRosterFloatDrag = null;
}

function onLobbyRosterFloatPointerMove(e) {
  if (!lobbyRosterFloatDrag || e.pointerId !== lobbyRosterFloatDrag.pointerId) return;
  const dx = e.clientX - lobbyRosterFloatDrag.startClientX;
  const dy = e.clientY - lobbyRosterFloatDrag.startClientY;
  if (!lobbyRosterFloatDrag.moved) {
    if (Math.hypot(dx, dy) < LOBBY_ROSTER_FLOAT_DRAG_PX) return;
    lobbyRosterFloatDrag.moved = true;
    lobbyRosterFloatDrag.handle.classList.add("lobby-roster-float-handle--dragging");
    document.getElementById("lobby-prep-roster-panel")?.classList.add("lobby-prep-roster-panel--dragging");
  }
  e.preventDefault();
  const fieldRect = lobbyRosterFloatDrag.fieldRect;
  applyLobbyRosterFloatPosition(
    e.clientX - fieldRect.left - lobbyRosterFloatDrag.offsetX,
    e.clientY - fieldRect.top - lobbyRosterFloatDrag.offsetY,
  );
}

function onLobbyRosterFloatPointerEnd(e) {
  if (!lobbyRosterFloatDrag || e.pointerId !== lobbyRosterFloatDrag.pointerId) return;
  const drag = lobbyRosterFloatDrag;
  clearLobbyRosterFloatDragState();
  window.removeEventListener("pointermove", onLobbyRosterFloatPointerMove);
  window.removeEventListener("pointerup", onLobbyRosterFloatPointerEnd);
  window.removeEventListener("pointercancel", onLobbyRosterFloatPointerEnd);
  if (drag.moved) {
    const panel = document.getElementById("lobby-prep-roster-panel");
    const pos = panel ? readLobbyRosterFloatAppliedPosition(panel) : null;
    if (pos) saveLobbyRosterFloatPosition(pos.x, pos.y);
    return;
  }
  lobbyRosterFloatToggleCollapse?.();
}

function onLobbyRosterFloatPointerDown(e) {
  if (e.button !== 0) return;
  const handle = e.currentTarget;
  const panel = document.getElementById("lobby-prep-roster-panel");
  const field = document.getElementById("prep-field-column");
  if (!panel || !field || panel.classList.contains("hidden")) return;
  e.preventDefault();
  e.stopPropagation();
  const panelRect = panel.getBoundingClientRect();
  lobbyRosterFloatDrag = {
    handle,
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startClientY: e.clientY,
    offsetX: e.clientX - panelRect.left,
    offsetY: e.clientY - panelRect.top,
    fieldRect: field.getBoundingClientRect(),
    moved: false,
  };
  handle.setPointerCapture(e.pointerId);
  window.addEventListener("pointermove", onLobbyRosterFloatPointerMove);
  window.addEventListener("pointerup", onLobbyRosterFloatPointerEnd);
  window.addEventListener("pointercancel", onLobbyRosterFloatPointerEnd);
}

function initLobbyRosterFloat({ toggleCollapse } = {}) {
  lobbyRosterFloatToggleCollapse = typeof toggleCollapse === "function" ? toggleCollapse : null;
  const handle = document.getElementById("btn-lobby-roster-hide");
  const field = document.getElementById("prep-field-column");
  if (!handle || handle.dataset.lobbyRosterFloatBound === "true") return;
  handle.dataset.lobbyRosterFloatBound = "true";
  handle.addEventListener("pointerdown", onLobbyRosterFloatPointerDown);
  restoreLobbyRosterFloatPosition();
  if (field && !lobbyRosterFloatResizeObserver) {
    lobbyRosterFloatResizeObserver = new ResizeObserver(() => refreshLobbyRosterFloatLayout());
    lobbyRosterFloatResizeObserver.observe(field);
  }
  window.addEventListener("resize", () => refreshLobbyRosterFloatLayout(), { passive: true });
}
