/**
 * TdArena — карта TD: слоты, башни-герои, свиньи, hit-test, pan/zoom.
 */

const TdArena = (() => {
  /** @type {Map<string, HTMLImageElement>} */
  const portraitCache = new Map();
  let mountEl = null;
  let viewportEl = null;
  let canvasEl = null;
  let resetBtnEl = null;
  let zoomInBtnEl = null;
  let zoomOutBtnEl = null;
  let ctx = null;
  let gesturesBound = false;
  let onTapHandler = null;
  let displayW = 0;
  let displayH = 0;

  const MIN_ZOOM = 0.34;
  const MAX_ZOOM = 2.6;
  /** При zoom=1 видна ~38% ширины/высоты мира — остальное за кадром. */
  const VISIBLE_WORLD_FRAC_W = 0.38;
  const VISIBLE_WORLD_FRAC_H = 0.38;
  const CAMERA_OVERSCROLL_PX = 140;
  const CAMERA_ANIM_MS = 360;
  const TAP_MOVE_PX = 10;
  const TAP_TIME_MS = 300;
  const DOUBLE_TAP_MS = 320;

  const camera = { cx: 0, cy: 0, zoom: 1 };
  let cameraTween = null;
  let cameraAnimFrame = 0;

  /** @type {Map<number, { x: number, y: number }>} */
  const activePointers = new Map();
  let pendingTap = null;
  let panGesture = null;
  let pinchGesture = null;
  let lastTapAt = 0;
  let tapTimer = null;

  function init() {
    mountEl = document.getElementById("td-arena-mount");
    viewportEl = document.getElementById("td-map-viewport");
    canvasEl = document.getElementById("td-arena-canvas");
    resetBtnEl = document.getElementById("td-arena-reset-view");
    zoomInBtnEl = document.getElementById("td-arena-zoom-in");
    zoomOutBtnEl = document.getElementById("td-arena-zoom-out");
    ctx = canvasEl?.getContext("2d") || null;
    ensureMapChrome();
  }

  function ensureMapChrome() {
    if (!mountEl) return;
    if (!viewportEl && canvasEl) {
      viewportEl = document.createElement("div");
      viewportEl.id = "td-map-viewport";
      viewportEl.className = "td-map-viewport";
      mountEl.insertBefore(viewportEl, canvasEl);
      viewportEl.appendChild(canvasEl);
    }
    if (!mountEl.querySelector(".td-map-vignette")) {
      const vignette = document.createElement("div");
      vignette.className = "td-map-vignette";
      vignette.setAttribute("aria-hidden", "true");
      mountEl.appendChild(vignette);
    }
    ensureZoomControls();
    ensureResetButton();
    bindZoomControlHandlers();
  }

  function ensureZoomControls() {
    if (!mountEl) return;
    let wrap = document.getElementById("td-map-zoom-controls");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "td-map-zoom-controls";
      wrap.className = "td-map-zoom-controls";
      wrap.innerHTML = `
        <button type="button" class="td-map-zoom-btn" id="td-arena-zoom-in" title="Приблизить" aria-label="Приблизить карту">+</button>
        <button type="button" class="td-map-zoom-btn" id="td-arena-zoom-out" title="Отдалить" aria-label="Отдалить карту">−</button>
      `;
      mountEl.appendChild(wrap);
    }
    zoomInBtnEl = document.getElementById("td-arena-zoom-in");
    zoomOutBtnEl = document.getElementById("td-arena-zoom-out");
  }

  function bindZoomControlHandlers() {
    ensureZoomControls();
    if (zoomInBtnEl && !zoomInBtnEl.dataset.bound) {
      zoomInBtnEl.dataset.bound = "1";
      zoomInBtnEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        zoomAtViewportCenter(1.12);
        requestRedraw();
      });
    }
    if (zoomOutBtnEl && !zoomOutBtnEl.dataset.bound) {
      zoomOutBtnEl.dataset.bound = "1";
      zoomOutBtnEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        zoomAtViewportCenter(1 / 1.12);
        requestRedraw();
      });
    }
  }

  function ensureResetButton() {
    if (!mountEl) return;
    if (!resetBtnEl) {
      resetBtnEl = document.createElement("button");
      resetBtnEl.type = "button";
      resetBtnEl.id = "td-arena-reset-view";
      resetBtnEl.className = "td-arena-reset-view hidden";
      resetBtnEl.title = "К центру карты";
      resetBtnEl.setAttribute("aria-label", "К центру карты");
      resetBtnEl.textContent = "⌖";
      mountEl.appendChild(resetBtnEl);
    }
    if (!resetBtnEl.dataset.bound) {
      resetBtnEl.dataset.bound = "1";
      resetBtnEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        animateCameraHome();
      });
    }
  }

  function getBitmapSize() {
    const w = typeof TD_CANVAS_W === "number" ? TD_CANVAS_W : 3000;
    const h = typeof TD_CANVAS_H === "number" ? TD_CANVAS_H : 3000;
    return { w, h };
  }

  function getWorldBounds() {
    const { w, h } = getBitmapSize();
    const marginX = w * 0.1;
    const marginY = h * 0.1;
    return {
      minX: -marginX,
      maxX: w + marginX,
      minY: -marginY,
      maxY: h + marginY,
    };
  }

  function getCameraHome() {
    const slots = typeof TD_MAP_SLOTS !== "undefined" ? TD_MAP_SLOTS : [];
    const centerSlot = slots.find((s) => s.pathId == null) || slots[4] || { x: 0.5, y: 0.5 };
    const { w, h } = getBitmapSize();
    return {
      cx: centerSlot.x * w,
      cy: centerSlot.y * h,
      zoom: 1,
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function cancelCameraTween() {
    cameraTween = null;
    if (cameraAnimFrame) {
      cancelAnimationFrame(cameraAnimFrame);
      cameraAnimFrame = 0;
    }
  }

  function stepCameraTween() {
    if (!cameraTween) return;
    const now = performance.now();
    const t = Math.min(1, (now - cameraTween.startTime) / cameraTween.duration);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.cx = lerp(cameraTween.from.cx, cameraTween.to.cx, ease);
    camera.cy = lerp(cameraTween.from.cy, cameraTween.to.cy, ease);
    camera.zoom = lerp(cameraTween.from.zoom, cameraTween.to.zoom, ease);
    clampCamera();
    syncResetButtonVisibility();
    requestRedraw();
    if (t >= 1) {
      cameraTween = null;
      cameraAnimFrame = 0;
      return;
    }
    cameraAnimFrame = requestAnimationFrame(stepCameraTween);
  }

  function animateCameraTo(target, durationMs = CAMERA_ANIM_MS) {
    cancelCameraTween();
    cameraTween = {
      from: { cx: camera.cx, cy: camera.cy, zoom: camera.zoom },
      to: { cx: target.cx, cy: target.cy, zoom: target.zoom },
      startTime: performance.now(),
      duration: durationMs,
    };
    cameraAnimFrame = requestAnimationFrame(stepCameraTween);
  }

  function animateCameraHome() {
    animateCameraTo(getCameraHome());
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function getViewRect() {
    const rect = getDisplayRect();
    if (rect && rect.width > 8 && rect.height > 8) {
      return { width: rect.width, height: rect.height };
    }
    if (displayW > 8 && displayH > 8) {
      return { width: displayW, height: displayH };
    }
    const mountRect = mountEl?.getBoundingClientRect();
    if (mountRect && mountRect.width > 8 && mountRect.height > 8) {
      return { width: mountRect.width, height: mountRect.height };
    }
    return null;
  }

  function getBaseScale(viewRect, w, h) {
    if (!viewRect?.width || !viewRect?.height) return 1;
    return Math.min(
      viewRect.width / (w * VISIBLE_WORLD_FRAC_W),
      viewRect.height / (h * VISIBLE_WORLD_FRAC_H),
    );
  }

  function getViewScale(viewRect, w, h) {
    return getBaseScale(viewRect, w, h) * camera.zoom;
  }

  function clampCamera() {
    const viewRect = getViewRect();
    if (!viewRect) return;
    const { w, h } = getBitmapSize();
    const bounds = getWorldBounds();
    const scale = getViewScale(viewRect, w, h);
    const halfVisW = viewRect.width / scale / 2;
    const halfVisH = viewRect.height / scale / 2;
    const overscroll = CAMERA_OVERSCROLL_PX;

    let minCx = bounds.minX + halfVisW - overscroll;
    let maxCx = bounds.maxX - halfVisW + overscroll;
    let minCy = bounds.minY + halfVisH - overscroll;
    let maxCy = bounds.maxY - halfVisH + overscroll;

    if (minCx > maxCx) {
      const mid = (bounds.minX + bounds.maxX) / 2;
      minCx = mid;
      maxCx = mid;
    }
    if (minCy > maxCy) {
      const mid = (bounds.minY + bounds.maxY) / 2;
      minCy = mid;
      maxCy = mid;
    }

    camera.cx = clamp(camera.cx, minCx, maxCx);
    camera.cy = clamp(camera.cy, minCy, maxCy);
    camera.zoom = clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM);
  }

  function resetCamera() {
    const home = getCameraHome();
    camera.cx = home.cx;
    camera.cy = home.cy;
    camera.zoom = home.zoom;
    syncResetButtonVisibility();
  }

  function isCameraMoved() {
    const home = getCameraHome();
    const moved = Math.abs(camera.cx - home.cx) > 24
      || Math.abs(camera.cy - home.cy) > 24
      || Math.abs(camera.zoom - home.zoom) > 0.03;
    return moved;
  }

  function syncResetButtonVisibility() {
    if (!resetBtnEl) return;
    resetBtnEl.classList.toggle("hidden", !isCameraMoved() && !cameraTween);
  }

  function zoomAtViewportCenter(factor) {
    const viewRect = getViewRect();
    const rect = getDisplayRect();
    if (!viewRect || !rect) return;
    cancelCameraTween();
    const cx = rect.left + viewRect.width / 2;
    const cy = rect.top + viewRect.height / 2;
    zoomAt(cx, cy, camera.zoom * factor);
  }

  function applyCameraTransform(ctx2, viewRect, w, h, dpr = 1) {
    const viewScale = getViewScale(viewRect, w, h);
    const scale = viewScale * dpr;
    ctx2.setTransform(
      scale, 0, 0, scale,
      (viewRect.width / 2 - camera.cx * viewScale) * dpr,
      (viewRect.height / 2 - camera.cy * viewScale) * dpr,
    );
  }

  function clientToBitmap(clientX, clientY) {
    const viewRect = getViewRect();
    const rect = getDisplayRect();
    if (!viewRect || !rect) return null;
    const { w, h } = getBitmapSize();
    const scale = getViewScale(viewRect, w, h);
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - viewRect.width / 2) / scale + camera.cx,
      y: (sy - viewRect.height / 2) / scale + camera.cy,
      w,
      h,
    };
  }

  function requestRedraw() {
    if (typeof draw === "function" && typeof phase !== "undefined") draw();
  }

  function zoomAt(clientX, clientY, newZoom) {
    cancelCameraTween();
    const viewRect = getViewRect();
    const rect = getDisplayRect();
    if (!viewRect || !rect) return;
    const { w, h } = getBitmapSize();
    const oldScale = getViewScale(viewRect, w, h);
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const anchorX = (sx - viewRect.width / 2) / oldScale + camera.cx;
    const anchorY = (sy - viewRect.height / 2) / oldScale + camera.cy;
    camera.zoom = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);
    const newScale = getViewScale(viewRect, w, h);
    camera.cx = anchorX - (sx - viewRect.width / 2) / newScale;
    camera.cy = anchorY - (sy - viewRect.height / 2) / newScale;
    clampCamera();
    syncResetButtonVisibility();
  }

  function panByScreenDelta(dx, dy) {
    cancelCameraTween();
    const viewRect = getViewRect();
    if (!viewRect) return;
    const { w, h } = getBitmapSize();
    const scale = getViewScale(viewRect, w, h);
    camera.cx -= dx / scale;
    camera.cy -= dy / scale;
    clampCamera();
    syncResetButtonVisibility();
  }

  function pointerDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function pointerMidpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function clearGestureState() {
    pendingTap = null;
    panGesture = null;
    pinchGesture = null;
    canvasEl?.classList.remove("td-arena-canvas--panning");
  }

  function finishTap(clientX, clientY) {
    const now = Date.now();
    if (now - lastTapAt < DOUBLE_TAP_MS) {
      if (tapTimer) {
        clearTimeout(tapTimer);
        tapTimer = null;
      }
      lastTapAt = 0;
      animateCameraHome();
      return;
    }
    lastTapAt = now;
    if (tapTimer) clearTimeout(tapTimer);
    tapTimer = window.setTimeout(() => {
      tapTimer = null;
      if (typeof onTapHandler === "function") onTapHandler(clientX, clientY);
    }, DOUBLE_TAP_MS);
  }

  function onPointerDown(e) {
    if (!canvasEl || e.button > 0) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      canvasEl.setPointerCapture(e.pointerId);
    } catch (_) {}

    if (activePointers.size >= 2) {
      const pts = [...activePointers.values()];
      const a = pts[pts.length - 2];
      const b = pts[pts.length - 1];
      pinchGesture = {
        startDist: Math.max(24, pointerDistance(a, b)),
        startZoom: camera.zoom,
        startCx: camera.cx,
        startCy: camera.cy,
        midpoint: pointerMidpoint(a, b),
      };
      pendingTap = null;
      panGesture = null;
      e.preventDefault();
      return;
    }

    pendingTap = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
      pointerId: e.pointerId,
    };
    panGesture = null;
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!activePointers.has(e.pointerId)) return;
    const prev = activePointers.get(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinchGesture && activePointers.size >= 2) {
      const pts = [...activePointers.values()];
      const dist = Math.max(24, pointerDistance(pts[0], pts[1]));
      const mid = pointerMidpoint(pts[0], pts[1]);
      const ratio = dist / pinchGesture.startDist;
      zoomAt(mid.x, mid.y, pinchGesture.startZoom * ratio);
      requestRedraw();
      e.preventDefault();
      return;
    }

    if (pendingTap && pendingTap.pointerId === e.pointerId) {
      const dx = e.clientX - pendingTap.x;
      const dy = e.clientY - pendingTap.y;
      if (Math.hypot(dx, dy) >= TAP_MOVE_PX) {
        panGesture = {
          pointerId: e.pointerId,
          lastX: e.clientX,
          lastY: e.clientY,
        };
        pendingTap = null;
        canvasEl?.classList.add("td-arena-canvas--panning");
      }
    }

    if (panGesture && panGesture.pointerId === e.pointerId) {
      const dx = e.clientX - panGesture.lastX;
      const dy = e.clientY - panGesture.lastY;
      panGesture.lastX = e.clientX;
      panGesture.lastY = e.clientY;
      panByScreenDelta(dx, dy);
      requestRedraw();
      e.preventDefault();
    }
  }

  function onPointerUp(e) {
    const wasPending = pendingTap && pendingTap.pointerId === e.pointerId;
    const tapX = pendingTap?.x;
    const tapY = pendingTap?.y;
    const tapTime = pendingTap?.time;

    activePointers.delete(e.pointerId);
    try {
      canvasEl?.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (activePointers.size < 2) pinchGesture = null;
    if (activePointers.size === 0) {
      canvasEl?.classList.remove("td-arena-canvas--panning");
      if (wasPending && tapTime && Date.now() - tapTime <= TAP_TIME_MS) {
        finishTap(tapX, tapY);
      }
      pendingTap = null;
      panGesture = null;
    }
  }

  function onWheel(e) {
    if (!canvasEl || !mountEl || mountEl.classList.contains("hidden")) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    zoomAt(e.clientX, e.clientY, camera.zoom * factor);
    requestRedraw();
  }

  function bindGestures({ onTap } = {}) {
    if (!canvasEl) init();
    if (!canvasEl || gesturesBound) {
      onTapHandler = onTap || onTapHandler;
      return;
    }
    gesturesBound = true;
    onTapHandler = onTap || null;
    canvasEl.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvasEl.addEventListener("pointermove", onPointerMove, { passive: false });
    canvasEl.addEventListener("pointerup", onPointerUp);
    canvasEl.addEventListener("pointercancel", onPointerUp);
    canvasEl.addEventListener("wheel", onWheel, { passive: false });
  }

  function unbindGestures() {
    if (!canvasEl || !gesturesBound) return;
    gesturesBound = false;
    canvasEl.removeEventListener("pointerdown", onPointerDown);
    canvasEl.removeEventListener("pointermove", onPointerMove);
    canvasEl.removeEventListener("pointerup", onPointerUp);
    canvasEl.removeEventListener("pointercancel", onPointerUp);
    canvasEl.removeEventListener("wheel", onWheel);
    activePointers.clear();
    clearGestureState();
  }

  function setVisible(visible) {
    if (!mountEl) init();
    if (!mountEl) return;
    mountEl.classList.toggle("hidden", !visible);
    mountEl.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible) {
      bindResizeObserver();
      resize();
      resetCamera();
    } else {
      syncResetButtonVisibility();
    }
  }

  function measureStageSize() {
    const fieldCol = document.getElementById("prep-field-column");
    const mountRect = mountEl?.getBoundingClientRect();
    let colW = Math.floor(mountRect?.width || 0);
    let colH = Math.floor(mountRect?.height || 0);
    if (colW <= 8 || colH <= 8) {
      colW = Math.floor(fieldCol?.clientWidth || 0);
      colH = Math.floor(fieldCol?.clientHeight || 0);
    }
    if (colW <= 8 || colH <= 8) {
      const objectsLayer = document.getElementById("layer-objects");
      const layerRect = objectsLayer?.getBoundingClientRect();
      colW = Math.floor(layerRect?.width || 0);
      colH = Math.floor(layerRect?.height || 0);
    }
    return { colW, colH };
  }

  function resize() {
    if (!canvasEl || !mountEl) return;
    const { colW, colH } = measureStageSize();
    if (colW <= 8 || colH <= 8) {
      requestAnimationFrame(resize);
      return;
    }

    displayW = colW;
    displayH = colH;
    mountEl.style.width = "100%";
    mountEl.style.height = "100%";
    canvasEl.style.width = "100%";
    canvasEl.style.height = "100%";

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const backingW = Math.max(1, Math.floor(displayW * dpr));
    const backingH = Math.max(1, Math.floor(displayH * dpr));
    if (canvasEl.width !== backingW) canvasEl.width = backingW;
    if (canvasEl.height !== backingH) canvasEl.height = backingH;

    if (camera.cx <= 0 || camera.cy <= 0 || !isCameraMoved()) resetCamera();
    else clampCamera();
    syncResetButtonVisibility();
  }

  let resizeObserver = null;

  function bindResizeObserver() {
    if (resizeObserver || typeof ResizeObserver === "undefined") return;
    const fieldCol = document.getElementById("prep-field-column");
    const objectsLayer = document.getElementById("layer-objects");
    const targets = [mountEl, fieldCol, objectsLayer].filter(Boolean);
    if (!targets.length) return;
    resizeObserver = new ResizeObserver(() => resize());
    targets.forEach((el) => resizeObserver.observe(el));
  }

  function getDisplayRect() {
    if (!canvasEl) return null;
    return canvasEl.getBoundingClientRect();
  }

  /** Экранные координаты → нормализованные 0–1 на bitmap. */
  function clientToNorm(clientX, clientY) {
    const bitmap = clientToBitmap(clientX, clientY);
    if (!bitmap) return null;
    return {
      x: clamp(bitmap.x / bitmap.w, 0, 1),
      y: clamp(bitmap.y / bitmap.h, 0, 1),
    };
  }

  function hitTestSlot(clientX, clientY, tdState = null) {
    const norm = clientToNorm(clientX, clientY);
    if (!norm || typeof tdHitTestSlot !== "function") return null;
    return tdHitTestSlot(norm.x, norm.y, tdState);
  }

  function loadPortrait(classId) {
    if (!classId || portraitCache.has(classId)) return portraitCache.get(classId) || null;
    const src = typeof getClassHeroPortraitSrc === "function"
      ? getClassHeroPortraitSrc(classId)
      : null;
    if (!src) return null;
    const img = new Image();
    img.src = src;
    portraitCache.set(classId, img);
    return img;
  }

  function pointOnPath(path, t) {
    if (typeof tdLerpPath === "function") return tdLerpPath([path], 0, t);
    if (!path?.length) return { x: 0.5, y: 0.5 };
    if (t <= 0) return { x: path[0].x, y: path[0].y };
    if (t >= 1) return { x: path[path.length - 1].x, y: path[path.length - 1].y };
    const segLen = 1 / (path.length - 1);
    const segIdx = Math.min(path.length - 2, Math.floor(t / segLen));
    const localT = (t - segIdx * segLen) / segLen;
    const a = path[segIdx];
    const b = path[segIdx + 1];
    return {
      x: a.x + (b.x - a.x) * localT,
      y: a.y + (b.y - a.y) * localT,
    };
  }

  function tangentOnPath(path, t) {
    const eps = 0.012;
    const a = pointOnPath(path, Math.max(0, t - eps));
    const b = pointOnPath(path, Math.min(1, t + eps));
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len, angle: Math.atan2(dy, dx) };
  }

  function getParallaxOffset(depth = 0.5) {
    const { w, h } = getBitmapSize();
    const factor = (1 - depth) * 0.045;
    return {
      x: (camera.cx - w / 2) * factor,
      y: (camera.cy - h / 2) * factor,
    };
  }

  function getLanePendingQueue(tdState, pathId) {
    return (tdState.spawnQueue || []).filter((s) => s.pathId === pathId);
  }

  function isLaneActive(tdState, pathId) {
    if (!tdState || tdState.wavePhase === "done") return false;
    if (tdState.wavePhase === "break") return false;
    const onPath = (tdState.pigs || []).some((p) => p.pathId === pathId);
    const pending = getLanePendingQueue(tdState, pathId).length > 0;
    return onPath || pending;
  }

  function laneHasWaveTraffic(tdState, pathId) {
    if (!tdState || tdState.wavePhase === "break" || tdState.wavePhase === "done") return false;
    return isLaneActive(tdState, pathId);
  }

  function pigQueueIconScale(strength) {
    const s = typeof strength === "number" ? strength : 50;
    return 0.82 + (s / 100) * 0.42;
  }

  function strokePath(ctx2, path, w, h) {
    ctx2.beginPath();
    path.forEach((pt, i) => {
      const x = pt.x * w;
      const y = pt.y * h;
      if (i === 0) ctx2.moveTo(x, y);
      else ctx2.lineTo(x, y);
    });
  }

  function tdWorldPx(pxConst, fracConst, dim) {
    if (typeof pxConst === "number") return pxConst;
    return Math.max(8, dim * (typeof fracConst === "number" ? fracConst : 0.05));
  }

  function getPathWidths(w) {
    return {
      rimW: tdWorldPx(typeof TD_PATH_RIM_PX !== "undefined" ? TD_PATH_RIM_PX : null, TD_PATH_RIM_FRAC, w),
      pathW: tdWorldPx(typeof TD_PATH_WIDTH_PX !== "undefined" ? TD_PATH_WIDTH_PX : null, TD_PATH_WIDTH_FRAC, w),
    };
  }

  function drawGrass(ctx2, tdState, w, h) {
    const map = tdState.map || {};
    const grd = ctx2.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, map.grassLight || "#3d6b35");
    grd.addColorStop(1, map.grassDark || "#2d5228");
    ctx2.fillStyle = grd;
    ctx2.fillRect(0, 0, w, h);

    const edge = ctx2.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.22, w / 2, h / 2, Math.max(w, h) * 0.72);
    edge.addColorStop(0, "rgba(0,0,0,0)");
    edge.addColorStop(0.72, "rgba(0,0,0,0.06)");
    edge.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx2.fillStyle = edge;
    ctx2.fillRect(0, 0, w, h);
  }

  function drawDecor(ctx2, tdState, w, h) {
    (tdState.map?.decor || []).forEach((d) => {
      const parallax = getParallaxOffset(d.depth ?? 0.5);
      const cx = d.x * w + parallax.x;
      const cy = d.y * h + parallax.y;
      const baseSize = tdWorldPx(46, 0.04, Math.min(w, h)) * (d.scale || 1);
      const rot = d.rotate || 0;
      ctx2.save();
      ctx2.translate(cx, cy);
      ctx2.rotate(rot);
      if (typeof drawCellEmojiAt === "function") {
        drawCellEmojiAt(ctx2, d.emoji, 0, 0, baseSize);
      }
      ctx2.restore();
    });
  }

  function drawPathChevrons(ctx2, path, w, h, animTime, pathW) {
    const steps = 18;
    const flowSpeed = 0.55;
    const flowOffset = (animTime * flowSpeed) % 1;
    const chevLen = pathW * 0.32;
    const chevW = pathW * 0.22;

    for (let i = 0; i < steps; i += 1) {
      const t = ((i / steps) + flowOffset) % 1;
      if (t < 0.04 || t > 0.94) continue;
      const pt = pointOnPath(path, t);
      const tan = tangentOnPath(path, t);
      const cx = pt.x * w;
      const cy = pt.y * h;
      const fade = t < 0.12 ? (t - 0.04) / 0.08 : t > 0.86 ? (0.94 - t) / 0.08 : 1;

      ctx2.save();
      ctx2.translate(cx, cy);
      ctx2.rotate(tan.angle);
      ctx2.globalAlpha = 0.1 + fade * 0.18;
      ctx2.fillStyle = "rgba(255,255,255,0.9)";
      ctx2.beginPath();
      ctx2.moveTo(-chevLen * 0.35, -chevW);
      ctx2.lineTo(chevLen * 0.45, 0);
      ctx2.lineTo(-chevLen * 0.35, chevW);
      ctx2.closePath();
      ctx2.fill();
      ctx2.restore();
    }
  }

  function drawWaveQueueIcon(ctx2, cx, cy, radius, spawn, w) {
    const scale = pigQueueIconScale(spawn.strength);
    const r = radius * scale;
    const strong = (spawn.strength || 0) > 55;

    ctx2.save();
    ctx2.beginPath();
    ctx2.arc(cx, cy, r, 0, Math.PI * 2);
    ctx2.fillStyle = strong ? "rgba(60, 20, 10, 0.72)" : "rgba(30, 18, 8, 0.65)";
    ctx2.fill();
    ctx2.strokeStyle = strong ? "rgba(255, 160, 100, 0.75)" : "rgba(255,255,255,0.6)";
    ctx2.lineWidth = Math.max(1.5, w * 0.002);
    ctx2.shadowColor = "rgba(0,0,0,0.35)";
    ctx2.shadowBlur = 4;
    ctx2.stroke();
    ctx2.shadowBlur = 0;

    const emoji = typeof TD_PIG_EMOJI === "string" ? TD_PIG_EMOJI : "🐷";
    if (typeof drawCellEmojiAt === "function") {
      drawCellEmojiAt(ctx2, emoji, cx, cy, r * 1.55);
    }
    ctx2.restore();
  }

  function drawWaveQueues(ctx2, tdState, w, h) {
    if (!tdState || tdState.wavePhase === "break") return;
    const paths = tdState.map?.paths || [];
    const iconR = tdWorldPx(28, 0.014, Math.min(w, h));

    paths.forEach((path, pathId) => {
      const pending = getLanePendingQueue(tdState, pathId);
      if (!pending.length) return;

      const maxIcons = 14;
      const visible = pending.slice(0, maxIcons);
      const hidden = pending.length - visible.length;

      const maxT = 0.76;
      const startT = 0.05;
      const step = visible.length > 1
        ? Math.min(0.1, (maxT - startT) / (visible.length - 1))
        : 0;

      visible.forEach((spawn, i) => {
        const t = startT + i * step;
        const pt = pointOnPath(path, t);
        drawWaveQueueIcon(ctx2, pt.x * w, pt.y * h, iconR, spawn, w);
      });

      if (hidden > 0) {
        const pt = pointOnPath(path, Math.min(maxT, startT + visible.length * step));
        const cx = pt.x * w;
        const cy = pt.y * h;
        ctx2.save();
        ctx2.font = `bold ${Math.max(9, w * 0.01)}px system-ui,sans-serif`;
        ctx2.fillStyle = "rgba(255,255,255,0.85)";
        ctx2.textAlign = "center";
        ctx2.textBaseline = "middle";
        ctx2.fillText(`+${hidden}`, cx, cy);
        ctx2.restore();
      }
    });
  }

  function drawSpawnPortals(ctx2, tdState, w, h, animTime) {
    const paths = tdState.map?.paths || [];
    const baseR = tdWorldPx(
      typeof TD_SPAWN_RING_PX !== "undefined" ? TD_SPAWN_RING_PX : null,
      TD_SPAWN_RING_FRAC,
      Math.min(w, h),
    );
    const pulse = 0.5 + 0.5 * Math.sin(animTime * 3.9);

    paths.forEach((path, pathId) => {
      const start = path?.[0];
      if (!start) return;
      const cx = start.x * w;
      const cy = start.y * h;
      const active = isLaneActive(tdState, pathId);
      const r = baseR * (active ? 1.25 + pulse * 0.3 : 1);

      ctx2.save();
      ctx2.globalAlpha = active ? 1 : 0.38;

      if (active) {
        const glowR = r * (1.8 + pulse * 0.45);
        const grd = ctx2.createRadialGradient(cx, cy, r * 0.2, cx, cy, glowR);
        grd.addColorStop(0, `rgba(255, 120, 70, ${0.35 + pulse * 0.25})`);
        grd.addColorStop(0.55, `rgba(255, 80, 40, ${0.18 + pulse * 0.12})`);
        grd.addColorStop(1, "rgba(255, 60, 30, 0)");
        ctx2.fillStyle = grd;
        ctx2.beginPath();
        ctx2.arc(cx, cy, glowR, 0, Math.PI * 2);
        ctx2.fill();
      }

      ctx2.beginPath();
      ctx2.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
      ctx2.fillStyle = active ? "rgba(239, 68, 68, 0.28)" : "rgba(80, 50, 50, 0.18)";
      ctx2.strokeStyle = active ? "rgba(252, 165, 165, 0.85)" : "rgba(120, 90, 90, 0.4)";
      ctx2.lineWidth = active ? 2.5 : 1.5;
      ctx2.fill();
      ctx2.stroke();

      if (active) {
        ctx2.beginPath();
        ctx2.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
        ctx2.strokeStyle = `rgba(255, 200, 150, ${0.45 + pulse * 0.35})`;
        ctx2.lineWidth = 1.5;
        ctx2.stroke();
      }

      ctx2.restore();
    });
  }

  function drawLaneBadges(ctx2, tdState, w, h) {
    if (!tdState) return;
    const paths = tdState.map?.paths || [];
    const maxWaves = typeof TD_MAX_WAVES === "number" ? TD_MAX_WAVES : 99;

    paths.forEach((path, pathId) => {
      const start = path?.[0];
      if (!start) return;
      const tan = tangentOnPath(path, 0.03);
      const perpX = -tan.y;
      const perpY = tan.x;
      const cx = start.x * w + perpX * Math.min(w, h) * 0.055;
      const cy = start.y * h + perpY * Math.min(w, h) * 0.055;

      let text = null;
      let accent = "#bfdbfe";

      if (tdState.wavePhase === "break") {
        const secs = Math.max(0, Math.ceil(tdState.breakTimer || 0));
        text = `через ${secs}с`;
        accent = "#fde68a";
      } else if (laneHasWaveTraffic(tdState, pathId)) {
        text = `волна ${tdState.wave}/${maxWaves}`;
        const pending = getLanePendingQueue(tdState, pathId).length;
        const alive = (tdState.pigs || []).filter((p) => p.pathId === pathId).length;
        const laneTotal = pending + alive;
        if (laneTotal > 0) text = `${text} · ${laneTotal}🐷`;
      } else {
        return;
      }

      ctx2.save();
      ctx2.font = `bold ${Math.max(9, w * 0.011)}px system-ui,sans-serif`;
      const tw = ctx2.measureText(text).width + 12;
      const th = Math.max(16, w * 0.018);
      const bx = cx - tw / 2;
      const by = cy - th / 2;

      ctx2.fillStyle = "rgba(8, 12, 18, 0.78)";
      ctx2.strokeStyle = `${accent}55`;
      ctx2.lineWidth = 1;
      const rad = th * 0.35;
      if (typeof roundRect === "function") {
        roundRect(bx, by, tw, th, rad, ctx2);
      } else {
        ctx2.beginPath();
        ctx2.rect(bx, by, tw, th);
      }
      ctx2.fill();
      ctx2.stroke();

      ctx2.fillStyle = accent;
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";
      ctx2.fillText(text, cx, cy);
      ctx2.restore();
    });
  }

  function drawPaths(ctx2, tdState, w, h, animTime = 0) {
    const map = tdState.map || {};
    const pathFill = map.pathColor || "rgba(139, 90, 43, 0.55)";
    const { rimW, pathW } = getPathWidths(w);

    (map.paths || []).forEach((path) => {
      strokePath(ctx2, path, w, h);
      ctx2.strokeStyle = "rgba(20, 12, 5, 0.55)";
      ctx2.lineWidth = rimW * 1.12;
      ctx2.lineCap = "round";
      ctx2.lineJoin = "round";
      ctx2.stroke();

      strokePath(ctx2, path, w, h);
      ctx2.strokeStyle = "rgba(40, 25, 10, 0.45)";
      ctx2.lineWidth = rimW;
      ctx2.stroke();

      strokePath(ctx2, path, w, h);
      ctx2.strokeStyle = pathFill;
      ctx2.lineWidth = pathW;
      ctx2.stroke();

      strokePath(ctx2, path, w, h);
      ctx2.strokeStyle = "rgba(0, 0, 0, 0.22)";
      ctx2.lineWidth = pathW * 1.08;
      ctx2.globalCompositeOperation = "multiply";
      ctx2.stroke();
      ctx2.globalCompositeOperation = "source-over";

      strokePath(ctx2, path, w, h);
      ctx2.strokeStyle = "rgba(255, 235, 200, 0.12)";
      ctx2.lineWidth = pathW * 0.42;
      ctx2.stroke();

      drawPathChevrons(ctx2, path, w, h, animTime, pathW);
    });
  }

  function drawBuildSlots(ctx2, tdState, w, h, selectedSlotId, animTime = 0) {
    const slots = tdState.map?.slots || TD_MAP_SLOTS || [];
    slots.forEach((slot) => {
      const cx = slot.x * w;
      const cy = slot.y * h;
      const r = tdWorldPx(
        typeof TD_SLOT_RADIUS_PX !== "undefined" ? TD_SLOT_RADIUS_PX : null,
        TD_SLOT_RADIUS_FRAC,
        Math.min(w, h),
      );
      const tower = (tdState.towers || []).find((t) => t.slotId === slot.id && t.alive);
      const selected = slot.id === selectedSlotId;
      const isCenter = slot.pathId == null;

      ctx2.save();

      if (isCenter) {
        const breathe = 0.5 + 0.5 * Math.sin(animTime * (Math.PI * 2 / 3));
        const auraR = r * (2.2 + breathe * 0.35);
        const grd = ctx2.createRadialGradient(cx, cy, r * 0.3, cx, cy, auraR);
        grd.addColorStop(0, `rgba(120, 200, 255, ${0.18 + breathe * 0.12})`);
        grd.addColorStop(0.6, `rgba(80, 160, 220, ${0.08 + breathe * 0.06})`);
        grd.addColorStop(1, "rgba(60, 140, 200, 0)");
        ctx2.fillStyle = grd;
        ctx2.beginPath();
        ctx2.arc(cx, cy, auraR, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.shadowColor = `rgba(120, 200, 255, ${0.2 + breathe * 0.15})`;
        ctx2.shadowBlur = 18 + breathe * 14;
      }

      ctx2.beginPath();
      ctx2.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
      if (tower) {
        ctx2.fillStyle = selected ? "rgba(168, 85, 247, 0.35)" : "rgba(255, 230, 180, 0.3)";
        ctx2.strokeStyle = selected ? "rgba(168, 85, 247, 0.9)" : "rgba(180, 140, 60, 0.55)";
      } else if (isCenter) {
        ctx2.fillStyle = selected ? "rgba(96, 200, 255, 0.22)" : "rgba(120, 200, 255, 0.12)";
        ctx2.strokeStyle = selected ? "rgba(120, 220, 255, 0.95)" : "rgba(120, 200, 255, 0.55)";
        ctx2.setLineDash([]);
      } else {
        ctx2.fillStyle = selected ? "rgba(96, 165, 250, 0.25)" : "rgba(255,255,255,0.08)";
        ctx2.strokeStyle = selected ? "rgba(96, 165, 250, 0.85)" : "rgba(255,255,255,0.25)";
        ctx2.setLineDash([6, 4]);
      }
      ctx2.lineWidth = selected ? 3 : 2;
      ctx2.fill();
      ctx2.stroke();
      ctx2.setLineDash([]);
      ctx2.shadowBlur = 0;

      if (!tower) {
        ctx2.font = `bold ${Math.max(10, r * 0.45)}px system-ui,sans-serif`;
        ctx2.fillStyle = isCenter ? "rgba(200, 235, 255, 0.9)" : "rgba(255,255,255,0.7)";
        ctx2.textAlign = "center";
        ctx2.textBaseline = "middle";
        ctx2.fillText("+", cx, cy);
      }

      ctx2.font = `600 ${Math.max(9, r * 0.32)}px system-ui,sans-serif`;
      ctx2.fillStyle = selected ? "#bfdbfe" : isCenter ? "rgba(180, 230, 255, 0.85)" : "rgba(255,255,255,0.55)";
      ctx2.textAlign = "center";
      ctx2.textBaseline = "top";
      ctx2.fillText(slot.label || "", cx, cy + r * 1.35);
      ctx2.restore();
    });
  }

  function drawTowers(ctx2, tdState, w, h, animTime) {
    (tdState.towers || []).forEach((tower) => {
      if (!tower.alive) return;
      const slot = (tdState.map?.slots || TD_MAP_SLOTS).find((s) => s.id === tower.slotId);
      if (!slot) return;

      const cx = slot.x * w;
      const cy = slot.y * h;
      const baseR = tdWorldPx(
        typeof TD_HERO_RADIUS_PX !== "undefined" ? TD_HERO_RADIUS_PX : null,
        TD_HERO_RADIUS_FRAC,
        Math.min(w, h),
      );
      const pulse = 1 + Math.sin(animTime * 2.5 + tower.slotId) * 0.025;

      const portrait = loadPortrait(tower.classId);
      const drawR = baseR * pulse;
      if (portrait?.complete && portrait.naturalWidth > 0) {
        ctx2.save();
        ctx2.beginPath();
        ctx2.arc(cx, cy, drawR, 0, Math.PI * 2);
        ctx2.clip();
        ctx2.drawImage(portrait, cx - drawR, cy - drawR * 1.12, drawR * 2, drawR * 2.15);
        ctx2.restore();
      } else {
        const cls = typeof getClassById === "function" ? getClassById(tower.classId) : null;
        if (typeof drawCellEmojiAt === "function") {
          drawCellEmojiAt(ctx2, cls?.icon || "🛡️", cx, cy, drawR * 1.5);
        }
      }

      // В TD не рисуем орбиту предметов рюкзака — только портрет башни.

      const hero = tower.hero;
      if (!hero) return;
      const barW = baseR * 2.2;
      const barH = Math.max(5, baseR * 0.12);
      const barX = cx - barW / 2;
      const barY = cy + drawR + 10;
      const hpRatio = Math.max(0, hero.hp / hero.maxHp);

      ctx2.fillStyle = "rgba(0,0,0,0.5)";
      ctx2.fillRect(barX, barY, barW, barH);
      ctx2.fillStyle = hpRatio > 0.35 ? "#4ade80" : "#ef4444";
      ctx2.fillRect(barX, barY, barW * hpRatio, barH);
    });
  }

  function drawPigs(ctx2, tdState, w, h) {
    tdState.pigs.forEach((pig) => {
      const pos = tdLerpPath(tdState, pig.pathId, pig.t);
      const cx = pos.x * w;
      const cy = pos.y * h;
      const size = tdWorldPx(
        typeof TD_UNIT_SIZE_PX !== "undefined" ? TD_UNIT_SIZE_PX : null,
        TD_UNIT_SIZE_FRAC,
        Math.min(w, h),
      ) * pig.sizeScale;
      const hpRatio = Math.max(0, pig.hp / pig.maxHp);

      ctx2.save();
      ctx2.globalAlpha = 0.3;
      ctx2.fillStyle = "#000";
      ctx2.beginPath();
      ctx2.ellipse(cx, cy + size * 0.35, size * 0.5, size * 0.15, 0, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.restore();

      if (typeof drawCellEmojiAt === "function") {
        drawCellEmojiAt(ctx2, TD_PIG_EMOJI, cx, cy, size);
      }

      if (hpRatio < 0.99) {
        const barW = size * 1.1;
        const barH = Math.max(3, size * 0.1);
        ctx2.fillStyle = "rgba(0,0,0,0.4)";
        ctx2.fillRect(cx - barW / 2, cy - size * 0.75, barW, barH);
        ctx2.fillStyle = "#f87171";
        ctx2.fillRect(cx - barW / 2, cy - size * 0.75, barW * hpRatio, barH);
      }
    });
  }

  function quadBezier(a, b, c, t) {
    const u = 1 - t;
    return u * u * a + 2 * u * t * b + t * t * c;
  }

  function drawAttackFx(ctx2, tdState, w, h) {
    (tdState.attackFx || []).forEach((fx) => {
      const maxTtl = fx.maxTtl || fx.ttl || 0.4;
      const life = 1 - Math.max(0, fx.ttl / maxTtl);
      const fromX = (fx.fromX ?? 0.5) * w;
      const fromY = (fx.fromY ?? 0.5) * h;
      let toX = (fx.toX ?? fx.fromX ?? 0.5) * w;
      let toY = (fx.toY ?? fx.fromY ?? 0.5) * h;

      if (fx.targetId != null) {
        const pig = tdState.pigs.find((p) => p.id === fx.targetId);
        if (pig) {
          const pos = tdLerpPath(tdState, pig.pathId, pig.t);
          toX = pos.x * w;
          toY = pos.y * h;
        }
      }

      const icon = fx.icon || "⚔️";
      const attackType = fx.attackType || "melee";
      const visual = fx.visual || "slash";
      const iconSize = Math.min(w, h) * 0.034;

      ctx2.save();

      if (attackType === "support" || fx.effectType === "heal" || fx.effectType === "block" || fx.effectType === "grantBlockBuff") {
        const pulseR = Math.min(w, h) * (0.045 + Math.sin(life * Math.PI) * 0.028);
        const color = fx.effectType === "heal" ? "#4ade80" : "#60a5fa";
        ctx2.globalAlpha = 0.85 - life * 0.55;
        ctx2.fillStyle = `${color}33`;
        ctx2.strokeStyle = color;
        ctx2.lineWidth = 3;
        ctx2.beginPath();
        ctx2.arc(fromX, fromY, pulseR, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.stroke();
        if (typeof drawCellEmojiAt === "function") {
          drawCellEmojiAt(ctx2, icon, fromX, fromY - pulseR * 0.15, pulseR * 0.75);
        }
      } else if (attackType === "aoe" || visual === "aoe" || visual === "orb") {
        const radius = Math.min(w, h) * (0.03 + life * 0.09);
        ctx2.globalAlpha = 0.9 - life * 0.75;
        ctx2.strokeStyle = visual === "orb" ? "#fb923c" : "#f97316";
        ctx2.fillStyle = visual === "orb" ? "rgba(251, 146, 60, 0.22)" : "rgba(249, 115, 22, 0.18)";
        ctx2.lineWidth = 3;
        ctx2.beginPath();
        ctx2.arc(toX, toY, radius, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.stroke();
        if (typeof drawCellEmojiAt === "function") {
          drawCellEmojiAt(ctx2, icon, toX, toY, radius * 0.85);
        }
      } else if (attackType === "projectile" || attackType === "magic" || visual === "arrow" || visual === "bolt" || visual === "magic") {
        const lift = visual === "magic" ? 0.14 : 0.09;
        const cpX = (fromX + toX) / 2;
        const cpY = Math.min(fromY, toY) - Math.min(w, h) * lift;
        const px = quadBezier(fromX, cpX, toX, life);
        const py = quadBezier(fromY, cpY, toY, life);
        const trailT = Math.max(0, life - 0.08);
        const tx = quadBezier(fromX, cpX, toX, trailT);
        const ty = quadBezier(fromY, cpY, toY, trailT);

        ctx2.globalAlpha = 0.55 * (1 - life * 0.4);
        ctx2.strokeStyle = visual === "magic" ? "#c4b5fd" : visual === "bolt" ? "#fde68a" : "#fcd34d";
        ctx2.lineWidth = visual === "bolt" ? 2.5 : 2;
        ctx2.beginPath();
        ctx2.moveTo(fromX, fromY);
        ctx2.quadraticCurveTo(cpX, cpY, tx, ty);
        ctx2.stroke();

        if (typeof drawCellEmojiAt === "function") {
          const size = iconSize * (0.95 + Math.sin(life * Math.PI) * 0.12);
          drawCellEmojiAt(ctx2, icon, px, py, size);
        }
      } else {
        const midX = (fromX + toX) / 2;
        const midY = Math.min(fromY, toY) - Math.min(w, h) * 0.07;
        const px = quadBezier(fromX, midX, toX, Math.min(1, life * 1.15));
        const py = quadBezier(fromY, midY, toY, Math.min(1, life * 1.15));

        ctx2.globalAlpha = 0.95 - life * 0.5;
        ctx2.strokeStyle = "#fbbf24";
        ctx2.lineWidth = 3 + life * 2;
        ctx2.lineCap = "round";
        ctx2.beginPath();
        ctx2.moveTo(fromX, fromY);
        ctx2.quadraticCurveTo(midX, midY, toX, toY);
        ctx2.stroke();

        ctx2.beginPath();
        ctx2.moveTo(px - 8, py);
        ctx2.lineTo(px + 8, py);
        ctx2.stroke();

        if (typeof drawCellEmojiAt === "function") {
          drawCellEmojiAt(ctx2, icon, px, py, iconSize * 1.05);
        }
      }

      if (fx.damage > 0 && life > 0.45) {
        const alpha = Math.min(1, (life - 0.45) / 0.35);
        ctx2.globalAlpha = alpha;
        ctx2.font = `bold ${Math.max(11, w * 0.014)}px system-ui,sans-serif`;
        ctx2.fillStyle = "#fef08a";
        ctx2.textAlign = "center";
        ctx2.textBaseline = "middle";
        ctx2.fillText(`-${fx.damage}`, toX, toY - Math.min(w, h) * 0.03);
      }

      ctx2.restore();
    });
  }

  function drawWaveBanner(ctx2, tdState, w, h) {
    if (!tdState.waveBannerTtl || tdState.waveBannerTtl <= 0 || !tdState.waveBannerText) return;
    const alpha = Math.min(1, tdState.waveBannerTtl / 0.5);
    const text = tdState.waveBannerText;
    ctx2.save();
    ctx2.globalAlpha = alpha;
    ctx2.font = `bold ${Math.max(16, w * 0.022)}px system-ui,sans-serif`;
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    const tw = ctx2.measureText(text).width + 40;
    const bx = w / 2;
    const by = h * 0.22;
    ctx2.fillStyle = "rgba(0,0,0,0.62)";
    ctx2.fillRect(bx - tw / 2, by - 22, tw, 44);
    ctx2.fillStyle = "#fef08a";
    ctx2.fillText(text, bx, by);
    ctx2.restore();
  }

  function drawWaveHudScreen(ctx2, tdState, viewW) {
    const wave = tdState.wave;
    const killed = tdState.pigsKilled || 0;
    const total = tdState.totalPigs || 0;
    const alive = tdState.pigs?.length || 0;
    const left = (tdState.spawnQueue?.length || 0) + alive;
    const diffId = tdState.difficultyId || "normal";
    const diff = typeof getTdDifficulty === "function" ? getTdDifficulty(diffId) : null;
    const diffTag = diff ? `${diff.emoji} ${diff.label}` : "";
    const towers = (tdState.towers || []).filter((t) => t.alive).length;
    const baseLives = tdState.baseLives ?? TD_BASE_LIVES;
    const label = `🌊 Волна ${wave}/${TD_MAX_WAVES}`;
    const sub = `🐷 ${killed}/${total} · на карте ${alive} · осталось ${left} · 🏰 ${towers} · ❤️ ${baseLives}${diffTag ? ` · ${diffTag}` : ""}`;

    ctx2.font = `bold ${Math.max(14, viewW * 0.018)}px system-ui,sans-serif`;
    ctx2.textAlign = "left";
    ctx2.textBaseline = "top";
    const padW = Math.max(ctx2.measureText(label).width, ctx2.measureText(sub).width) + 24;
    ctx2.fillStyle = "rgba(0,0,0,0.55)";
    ctx2.fillRect(8, 8, padW, 46);
    ctx2.fillStyle = "#fff";
    ctx2.fillText(label, 16, 12);
    ctx2.font = `${Math.max(11, viewW * 0.013)}px system-ui,sans-serif`;
    ctx2.fillStyle = "rgba(255,255,255,0.85)";
    ctx2.fillText(sub, 16, 32);
  }

  function drawMapHintScreen(ctx2, viewW) {
    if (!isCameraMoved()) return;
    const hint = "Двойной тап — к центру · колёсико — зум";
    ctx2.font = `${Math.max(10, viewW * 0.012)}px system-ui,sans-serif`;
    ctx2.textAlign = "right";
    ctx2.textBaseline = "bottom";
    const tw = ctx2.measureText(hint).width + 16;
    const bx = viewW - 8;
    const by = 52;
    ctx2.fillStyle = "rgba(0,0,0,0.45)";
    ctx2.fillRect(bx - tw, by - 18, tw, 20);
    ctx2.fillStyle = "rgba(255,255,255,0.78)";
    ctx2.fillText(hint, bx - 8, by - 4);
  }

  function drawFrame(tdState, animTime = 0, selectedSlotId = null) {
    if (!ctx || !canvasEl || !tdState) return;
    const { w, h } = getBitmapSize();
    const viewRect = getViewRect();
    if (!viewRect?.width || !viewRect?.height) return;
    const sel = selectedSlotId ?? tdState.selectedSlotId ?? null;
    const dpr = Math.max(1, canvasEl.width / viewRect.width);
    const grassDark = tdState?.map?.grassDark || "#2d5228";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = grassDark;
    ctx.fillRect(0, 0, viewRect.width, viewRect.height);

    ctx.save();
    applyCameraTransform(ctx, viewRect, w, h, dpr);
    drawGrass(ctx, tdState, w, h);
    drawDecor(ctx, tdState, w, h);
    drawPaths(ctx, tdState, w, h, animTime);
    drawSpawnPortals(ctx, tdState, w, h, animTime);
    drawWaveQueues(ctx, tdState, w, h);
    drawLaneBadges(ctx, tdState, w, h);
    drawBuildSlots(ctx, tdState, w, h, sel, animTime);
    drawPigs(ctx, tdState, w, h);
    drawAttackFx(ctx, tdState, w, h);
    drawTowers(ctx, tdState, w, h, animTime);
    drawWaveBanner(ctx, tdState, w, h);
    ctx.restore();

    drawWaveHudScreen(ctx, tdState, viewRect.width);
    drawMapHintScreen(ctx, viewRect.width);
    syncResetButtonVisibility();
  }

  function draw(ctx2, tdState, w, h, animTime = 0) {
    drawFrame(tdState, animTime);
  }

  return {
    init,
    setVisible,
    resize,
    draw,
    drawFrame,
    loadPortrait,
    hitTestSlot,
    clientToNorm,
    getDisplayRect,
    bindGestures,
    unbindGestures,
    resetCamera,
  };
})();
