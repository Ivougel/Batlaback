/**
 * TdArena — карта TD: слоты, башни-герои, свиньи, hit-test, pan/zoom.
 */

const TdArena = (() => {
  /** @type {Map<string, HTMLImageElement>} */
  const portraitCache = new Map();
  let mountEl = null;
  let canvasEl = null;
  let resetBtnEl = null;
  let ctx = null;
  let gesturesBound = false;
  let onTapHandler = null;
  let displayW = 0;
  let displayH = 0;

  const MIN_ZOOM = 0.72;
  const MAX_ZOOM = 3;
  const TAP_MOVE_PX = 10;
  const TAP_TIME_MS = 300;
  const DOUBLE_TAP_MS = 320;

  const camera = { cx: 0, cy: 0, zoom: 1 };

  /** @type {Map<number, { x: number, y: number }>} */
  const activePointers = new Map();
  let pendingTap = null;
  let panGesture = null;
  let pinchGesture = null;
  let lastTapAt = 0;
  let tapTimer = null;

  function init() {
    mountEl = document.getElementById("td-arena-mount");
    canvasEl = document.getElementById("td-arena-canvas");
    resetBtnEl = document.getElementById("td-arena-reset-view");
    ctx = canvasEl?.getContext("2d") || null;
    ensureResetButton();
  }

  function ensureResetButton() {
    if (!mountEl || resetBtnEl) return;
    resetBtnEl = document.createElement("button");
    resetBtnEl.type = "button";
    resetBtnEl.id = "td-arena-reset-view";
    resetBtnEl.className = "td-arena-reset-view hidden";
    resetBtnEl.title = "Сбросить вид карты";
    resetBtnEl.setAttribute("aria-label", "Сбросить вид карты");
    resetBtnEl.textContent = "⌖";
    resetBtnEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetCamera();
      requestRedraw();
    });
    mountEl.appendChild(resetBtnEl);
  }

  function getBitmapSize() {
    const w = typeof TD_CANVAS_W === "number" ? TD_CANVAS_W : 960;
    const h = typeof TD_CANVAS_H === "number" ? TD_CANVAS_H : 640;
    return { w, h };
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function getViewRect() {
    const rect = getDisplayRect();
    if (rect?.width && rect?.height) {
      return { width: rect.width, height: rect.height };
    }
    if (displayW > 0 && displayH > 0) {
      return { width: displayW, height: displayH };
    }
    return null;
  }

  function getBaseScale(viewRect, w, h) {
    if (!viewRect?.width || !viewRect?.height) return 1;
    return Math.max(viewRect.width / w, viewRect.height / h);
  }

  function getViewScale(viewRect, w, h) {
    return getBaseScale(viewRect, w, h) * camera.zoom;
  }

  function clampCamera() {
    const viewRect = getViewRect();
    if (!viewRect) return;
    const { w, h } = getBitmapSize();
    const scale = getViewScale(viewRect, w, h);
    const halfVisW = viewRect.width / scale / 2;
    const halfVisH = viewRect.height / scale / 2;
    camera.cx = clamp(camera.cx, halfVisW, w - halfVisW);
    camera.cy = clamp(camera.cy, halfVisH, h - halfVisH);
    camera.zoom = clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM);
  }

  function resetCamera() {
    const { w, h } = getBitmapSize();
    camera.cx = w / 2;
    camera.cy = h / 2;
    camera.zoom = 1;
    syncResetButtonVisibility();
  }

  function isCameraMoved() {
    const { w, h } = getBitmapSize();
    const moved = Math.abs(camera.cx - w / 2) > 2
      || Math.abs(camera.cy - h / 2) > 2
      || Math.abs(camera.zoom - 1) > 0.02;
    return moved;
  }

  function syncResetButtonVisibility() {
    if (!resetBtnEl) return;
    resetBtnEl.classList.toggle("hidden", !isCameraMoved());
  }

  function applyCameraTransform(ctx2, viewRect, w, h) {
    const scale = getViewScale(viewRect, w, h);
    ctx2.setTransform(
      scale, 0, 0, scale,
      viewRect.width / 2 - camera.cx * scale,
      viewRect.height / 2 - camera.cy * scale,
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
      resetCamera();
      requestRedraw();
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

  function resize() {
    if (!canvasEl || !mountEl) return;
    const fieldCol = document.getElementById("prep-field-column");
    const leftCol = document.getElementById("prep-left-column");
    const colW = Math.floor(
      fieldCol?.clientWidth || leftCol?.clientWidth || mountEl.clientWidth || 0,
    );
    const colH = Math.floor(
      fieldCol?.clientHeight || leftCol?.clientHeight || mountEl.clientHeight || 0,
    );
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

    if (camera.cx <= 0 || camera.cy <= 0) resetCamera();
    else clampCamera();
    syncResetButtonVisibility();
  }

  let resizeObserver = null;

  function bindResizeObserver() {
    if (resizeObserver || typeof ResizeObserver === "undefined") return;
    const fieldCol = document.getElementById("prep-field-column");
    const leftCol = document.getElementById("prep-left-column");
    const target = fieldCol || leftCol;
    if (!target) return;
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(target);
    if (leftCol && leftCol !== target) resizeObserver.observe(leftCol);
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

  function drawGrass(ctx2, tdState, w, h) {
    const map = tdState.map || {};
    const grd = ctx2.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, map.grassLight || "#3d6b35");
    grd.addColorStop(1, map.grassDark || "#2d5228");
    ctx2.fillStyle = grd;
    ctx2.fillRect(0, 0, w, h);
  }

  function drawDecor(ctx2, tdState, w, h) {
    (tdState.map?.decor || []).forEach((d) => {
      const cx = d.x * w;
      const cy = d.y * h;
      const size = Math.min(w, h) * 0.04 * d.scale;
      if (typeof drawCellEmojiAt === "function") {
        drawCellEmojiAt(ctx2, d.emoji, cx, cy, size);
      }
    });
  }

  function drawPathSpawns(ctx2, tdState, w, h) {
    const paths = tdState.map?.paths || [];
    const r = Math.min(w, h) * 0.028;
    paths.forEach((path, pathId) => {
      const start = path?.[0];
      if (!start) return;
      const cx = start.x * w;
      const cy = start.y * h;
      ctx2.save();
      ctx2.beginPath();
      ctx2.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
      ctx2.fillStyle = "rgba(239, 68, 68, 0.22)";
      ctx2.strokeStyle = "rgba(252, 165, 165, 0.75)";
      ctx2.lineWidth = 2;
      ctx2.fill();
      ctx2.stroke();
      ctx2.font = `bold ${Math.max(14, r * 1.1)}px system-ui,sans-serif`;
      ctx2.textAlign = "center";
      ctx2.textBaseline = "middle";
      ctx2.fillStyle = "#fecaca";
      ctx2.fillText("🐷", cx, cy);
      ctx2.restore();
    });
  }

  function drawPaths(ctx2, tdState, w, h) {
    const map = tdState.map || {};
    const pathFill = map.pathColor || "rgba(139, 90, 43, 0.55)";
    (map.paths || []).forEach((path) => {
      ctx2.beginPath();
      path.forEach((pt, i) => {
        const x = pt.x * w;
        const y = pt.y * h;
        if (i === 0) ctx2.moveTo(x, y);
        else ctx2.lineTo(x, y);
      });
      ctx2.strokeStyle = "rgba(40, 25, 10, 0.4)";
      ctx2.lineWidth = Math.max(18, w * 0.028);
      ctx2.lineCap = "round";
      ctx2.lineJoin = "round";
      ctx2.stroke();

      ctx2.beginPath();
      path.forEach((pt, i) => {
        const x = pt.x * w;
        const y = pt.y * h;
        if (i === 0) ctx2.moveTo(x, y);
        else ctx2.lineTo(x, y);
      });
      ctx2.strokeStyle = pathFill;
      ctx2.lineWidth = Math.max(13, w * 0.022);
      ctx2.stroke();
    });
    drawPathSpawns(ctx2, tdState, w, h);
  }

  function drawBuildSlots(ctx2, tdState, w, h, selectedSlotId) {
    const slots = tdState.map?.slots || TD_MAP_SLOTS || [];
    slots.forEach((slot) => {
      const cx = slot.x * w;
      const cy = slot.y * h;
      const r = Math.min(w, h) * 0.055;
      const tower = (tdState.towers || []).find((t) => t.slotId === slot.id && t.alive);
      const selected = slot.id === selectedSlotId;

      ctx2.save();
      ctx2.beginPath();
      ctx2.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
      if (tower) {
        ctx2.fillStyle = selected ? "rgba(168, 85, 247, 0.35)" : "rgba(255, 230, 180, 0.3)";
        ctx2.strokeStyle = selected ? "rgba(168, 85, 247, 0.9)" : "rgba(180, 140, 60, 0.55)";
      } else {
        ctx2.fillStyle = selected ? "rgba(96, 165, 250, 0.25)" : "rgba(255,255,255,0.08)";
        ctx2.strokeStyle = selected ? "rgba(96, 165, 250, 0.85)" : "rgba(255,255,255,0.25)";
        ctx2.setLineDash([6, 4]);
      }
      ctx2.lineWidth = selected ? 3 : 2;
      ctx2.fill();
      ctx2.stroke();
      ctx2.setLineDash([]);

      if (!tower) {
        ctx2.font = `bold ${Math.max(10, r * 0.45)}px system-ui,sans-serif`;
        ctx2.fillStyle = "rgba(255,255,255,0.7)";
        ctx2.textAlign = "center";
        ctx2.textBaseline = "middle";
        ctx2.fillText("+", cx, cy);
      }

      ctx2.font = `600 ${Math.max(9, r * 0.32)}px system-ui,sans-serif`;
      ctx2.fillStyle = selected ? "#bfdbfe" : "rgba(255,255,255,0.55)";
      ctx2.textAlign = "center";
      ctx2.textBaseline = "top";
      ctx2.fillText(slot.label || "", cx, cy + r * 1.35);
      ctx2.restore();
    });
  }

  function drawTowerItemOrbit(ctx2, tower, cx, cy, heroR, w) {
    (tower.attackItems || []).forEach((atk) => {
      const angle = atk.orbitAngle || 0;
      const orbitR = heroR * 1.75;
      const ix = cx + Math.cos(angle) * orbitR;
      const iy = cy + Math.sin(angle) * orbitR * 0.72;
      const def = ITEM_CATALOG?.[atk.itemId];
      const icon = atk.icon || def?.icon || "⚔️";
      const size = heroR * (atk.flashTimer > 0 ? 0.5 : 0.38);

      ctx2.save();
      if (atk.flashTimer > 0) {
        ctx2.shadowColor = "#fbbf24";
        ctx2.shadowBlur = 10;
      }
      if (typeof drawCellEmojiAt === "function") {
        drawCellEmojiAt(ctx2, icon, ix, iy, size);
      }
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
      const baseR = Math.min(w, h) * 0.062;
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

      drawTowerItemOrbit(ctx2, tower, cx, cy, drawR, w);

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
      const size = Math.min(w, h) * 0.045 * pig.sizeScale;
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
    const hint = "Двойной тап — весь обзор";
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
    const dpr = canvasEl.width / viewRect.width;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const grassDark = tdState?.map?.grassDark || "#2d5228";
    ctx.fillStyle = grassDark;
    ctx.fillRect(0, 0, viewRect.width, viewRect.height);

    ctx.save();
    applyCameraTransform(ctx, viewRect, w, h);
    drawGrass(ctx, tdState, w, h);
    drawDecor(ctx, tdState, w, h);
    drawPaths(ctx, tdState, w, h);
    drawBuildSlots(ctx, tdState, w, h, sel);
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
