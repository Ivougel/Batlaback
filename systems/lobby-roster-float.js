/**
 * Плавающий ростер лобби: 👀 — фиксированный якорь, список раскрывается от него в сторону поля.
 */

const LOBBY_ROSTER_FLOAT_STORAGE_KEY = "bb-lobby-roster-float-pos";
const LOBBY_ROSTER_FLOAT_DRAG_PX = 8;
const LOBBY_ROSTER_BODY_GAP_PX = 6;

let lobbyRosterFloatDrag = null;
let lobbyRosterFloatToggleCollapse = null;
let lobbyRosterFloatResizeObserver = null;
let lobbyRosterHandlePos = null;

function readLobbyRosterHandleStorage() {
  try {
    const raw = localStorage.getItem(LOBBY_ROSTER_FLOAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const x = Number.isFinite(parsed?.handleX) ? parsed.handleX : parsed?.x;
    const y = Number.isFinite(parsed?.handleY) ? parsed.handleY : parsed?.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  } catch {
    return null;
  }
}

function saveLobbyRosterHandleStorage(x, y) {
  try {
    localStorage.setItem(
      LOBBY_ROSTER_FLOAT_STORAGE_KEY,
      JSON.stringify({ v: 2, handleX: x, handleY: y }),
    );
  } catch {
    /* ignore */
  }
}

function getLobbyRosterFloatNodes() {
  const panel = document.getElementById("lobby-prep-roster-panel");
  const handle = document.getElementById("btn-lobby-roster-hide");
  const body = document.getElementById("lobby-prep-roster-body");
  const field = document.getElementById("prep-field-column");
  if (!panel || !handle || !field || panel.classList.contains("hidden")) return null;
  return { panel, handle, body, field };
}

function isLobbyRosterCollapsed() {
  const panel = document.getElementById("lobby-prep-roster-panel");
  return !!panel?.classList.contains("lobby-prep-roster-panel--collapsed");
}

function resolveLobbyRosterExpandDirection(handleX, fieldWidth, handleWidth) {
  const centerX = handleX + handleWidth / 2;
  const ratio = fieldWidth > 0 ? centerX / fieldWidth : 0.5;
  if (ratio >= 0.58) return "left";
  if (ratio <= 0.42) return "right";
  return "down";
}

function measureLobbyRosterBodySize(panel, body, expand) {
  if (!panel || !body) return { width: 0, height: 0 };
  const prevExpand = panel.dataset.lobbyRosterExpand;
  panel.dataset.lobbyRosterExpand = expand;
  const prevDisplay = body.style.display;
  const prevVisibility = body.style.visibility;
  body.style.display = "flex";
  body.style.visibility = "hidden";
  const width = body.offsetWidth;
  const height = body.offsetHeight;
  body.style.display = prevDisplay;
  body.style.visibility = prevVisibility;
  if (prevExpand) panel.dataset.lobbyRosterExpand = prevExpand;
  else panel.removeAttribute("data-lobby-roster-expand");
  return { width, height };
}

function readCurrentLobbyRosterHandlePos() {
  const nodes = getLobbyRosterFloatNodes();
  if (!nodes) return null;
  const fieldRect = nodes.field.getBoundingClientRect();
  const handleRect = nodes.handle.getBoundingClientRect();
  return {
    x: handleRect.left - fieldRect.left,
    y: handleRect.top - fieldRect.top,
  };
}

function clampLobbyRosterHandlePosition(handleX, handleY, { expanded = false, expand = "down" } = {}) {
  const nodes = getLobbyRosterFloatNodes();
  if (!nodes) return { x: handleX, y: handleY };
  const { handle, body, field } = nodes;
  const fieldRect = field.getBoundingClientRect();
  const handleW = handle.offsetWidth;
  const handleH = handle.offsetHeight;
  const gap = LOBBY_ROSTER_BODY_GAP_PX;
  let minX = 0;
  let minY = 0;
  let maxX = Math.max(0, fieldRect.width - handleW);
  let maxY = Math.max(0, fieldRect.height - handleH);

  if (expanded && body) {
    const bodySize = measureLobbyRosterBodySize(nodes.panel, body, expand);
    if (expand === "left") minX = bodySize.width + gap;
    else if (expand === "right") maxX = Math.max(minX, fieldRect.width - handleW - bodySize.width - gap);
    else maxY = Math.max(minY, fieldRect.height - handleH - bodySize.height - gap);
  }

  return {
    x: Math.max(minX, Math.min(handleX, maxX)),
    y: Math.max(minY, Math.min(handleY, maxY)),
  };
}

function applyLobbyRosterHandlePosition(handleX, handleY, { save = false } = {}) {
  const nodes = getLobbyRosterFloatNodes();
  if (!nodes) return;
  const { panel, handle } = nodes;
  const expanded = !isLobbyRosterCollapsed();
  const fieldRect = nodes.field.getBoundingClientRect();
  const expand = expanded
    ? resolveLobbyRosterExpandDirection(handleX, fieldRect.width, handle.offsetWidth)
    : "down";

  if (expanded) panel.dataset.lobbyRosterExpand = expand;
  else panel.removeAttribute("data-lobby-roster-expand");

  const clamped = clampLobbyRosterHandlePosition(handleX, handleY, { expanded, expand });
  lobbyRosterHandlePos = clamped;
  panel.style.setProperty("--lobby-roster-float-x", `${clamped.x}px`);
  panel.style.setProperty("--lobby-roster-float-y", `${clamped.y}px`);
  panel.dataset.lobbyRosterPositioned = "true";
  if (save) saveLobbyRosterHandleStorage(clamped.x, clamped.y);
}

function layoutLobbyRosterPanel({ save = false } = {}) {
  const stored = lobbyRosterHandlePos || readLobbyRosterHandleStorage() || readCurrentLobbyRosterHandlePos();
  if (!stored) return;
  applyLobbyRosterHandlePosition(stored.x, stored.y, { save });
}

function refreshLobbyRosterFloatLayout() {
  layoutLobbyRosterPanel();
}

function restoreLobbyRosterFloatPosition() {
  const stored = readLobbyRosterHandleStorage();
  if (!stored) return;
  lobbyRosterHandlePos = stored;
  requestAnimationFrame(() => layoutLobbyRosterPanel());
}

function clearLobbyRosterFloatDragState() {
  if (!lobbyRosterFloatDrag) return;
  const { handle, pointerId } = lobbyRosterFloatDrag;
  if (handle?.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
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
  applyLobbyRosterHandlePosition(
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
    if (lobbyRosterHandlePos) saveLobbyRosterHandleStorage(lobbyRosterHandlePos.x, lobbyRosterHandlePos.y);
    return;
  }
  lobbyRosterFloatToggleCollapse?.();
}

function onLobbyRosterFloatPointerDown(e) {
  if (e.button !== 0) return;
  const handle = e.currentTarget;
  const nodes = getLobbyRosterFloatNodes();
  if (!nodes) return;
  e.preventDefault();
  e.stopPropagation();
  const handleRect = handle.getBoundingClientRect();
  lobbyRosterFloatDrag = {
    handle,
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startClientY: e.clientY,
    offsetX: e.clientX - handleRect.left,
    offsetY: e.clientY - handleRect.top,
    fieldRect: nodes.field.getBoundingClientRect(),
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
    lobbyRosterFloatResizeObserver = new ResizeObserver(() => layoutLobbyRosterPanel());
    lobbyRosterFloatResizeObserver.observe(field);
  }
  window.addEventListener("resize", () => layoutLobbyRosterPanel(), { passive: true });
}
