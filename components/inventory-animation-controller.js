/**
 * Визуальный слой drag/drop инвентаря подготовки — без игровой логики.
 */

const PREP_PLACE_DURATION = 0.28;
const PREP_REJECT_DURATION = 0.28;
const PREP_ROTATE_DURATION = 0.24;

const InventoryAnimationController = (() => {
  const itemAnims = new Map();
  let dragVelX = 0;
  let dragVelY = 0;
  let lastDragClient = null;
  let backpackShakeT = 0;
  let backpackShakePower = 0;
  const cellPulses = new Map();
  let dragActive = false;
  let spreadPhase = 0;
  let ghostSwingX = 0;
  let ghostSwingY = 0;
  let ghostSwingVx = 0;
  let ghostSwingVy = 0;
  let ghostFloatPhase = 0;
  let ghostOrbitPhase = 0;
  let ghostRotateAnim = null;

  function easeOutCubic(t) {
    return 1 - (1 - t) ** 3;
  }

  function normalizeRotationIndex(rotation) {
    return ((rotation || 0) % 4 + 4) % 4;
  }

  function getGhostDrawRotation() {
    if (ghostRotateAnim) return ghostRotateAnim.fromRot;
    if (typeof dragPayload !== "undefined" && dragPayload) {
      return normalizeRotationIndex(dragPayload.rotation);
    }
    return 0;
  }

  function getGhostSpinCssDeg() {
    if (!ghostRotateAnim) return 0;
    const p = easeOutCubic(Math.min(1, ghostRotateAnim.t / ghostRotateAnim.duration));
    return p * 90;
  }

  function beginGhostRotationSpin(fromRot, toRot) {
    const from = normalizeRotationIndex(fromRot);
    const to = normalizeRotationIndex(toRot);
    if (from === to) return false;
    if (ghostRotateAnim) {
      ghostRotateAnim = { fromRot: ghostRotateAnim.toRot, toRot: to, t: 0, duration: PREP_ROTATE_DURATION };
      return true;
    }
    ghostRotateAnim = { fromRot: from, toRot: to, t: 0, duration: PREP_ROTATE_DURATION };
    return true;
  }

  function clearGhostRotationSpin() {
    ghostRotateAnim = null;
  }

  function getDragVisualRotation() {
    return {
      drawRot: getGhostDrawRotation(),
      spinDeg: getGhostSpinCssDeg(),
      spinning: !!ghostRotateAnim,
    };
  }

  function getShapeBoundsCenter(team, col, row, shape) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    shape.forEach(([dx, dy]) => {
      const { x, y, w, h } = cellRect(team, col + dx, row + dy);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });
    if (!Number.isFinite(minX)) return null;
    return { x: (minX + maxX) * 0.5, y: (minY + maxY) * 0.5 };
  }

  function withDragSpinTransform(ctx, team, col, row, shape, spinDeg, drawFn) {
    if (!spinDeg) {
      drawFn();
      return;
    }
    const center = getShapeBoundsCenter(team, col, row, shape);
    if (!center) {
      drawFn();
      return;
    }
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(spinDeg * Math.PI / 180);
    ctx.translate(-center.x, -center.y);
    drawFn();
    ctx.restore();
  }

  function resolveVisualDropPlacement(st, team, logicalPlacement) {
    const visual = getDragVisualRotation();
    if (!visual.spinning || !logicalPlacement) return logicalPlacement;
    if (typeof getPrepDropPlacement !== "function") {
      return { ...logicalPlacement, rotation: visual.drawRot };
    }
    const atDrawRot = getPrepDropPlacement(st, team, visual.drawRot);
    if (atDrawRot) return atDrawRot;
    return { ...logicalPlacement, rotation: visual.drawRot };
  }

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  }

  function onDragStart() {
    dragActive = true;
    lastDragClient = null;
    dragVelX = 0;
    dragVelY = 0;
    ghostSwingX = 0;
    ghostSwingY = 0;
    ghostSwingVx = 0;
    ghostSwingVy = 0;
    ghostFloatPhase = Math.random() * Math.PI * 2;
    ghostOrbitPhase = Math.random() * Math.PI * 2;
    ghostRotateAnim = null;
  }

  function onDragMove(clientX, clientY) {
    if (lastDragClient) {
      dragVelX = clientX - lastDragClient.x;
      dragVelY = clientY - lastDragClient.y;
      ghostSwingVx += dragVelX * 0.045;
      ghostSwingVy += dragVelY * 0.03;
      ghostOrbitPhase += Math.max(-0.35, Math.min(0.35, dragVelX * 0.006));
    }
    lastDragClient = { x: clientX, y: clientY };
  }

  function onDragEnd() {
    dragActive = false;
    lastDragClient = null;
    dragVelX = 0;
    dragVelY = 0;
  }

  function applyDragGhostStyles(el, arcRotation = null, opts = {}) {
    if (!el) return;
    const spinDeg = getGhostSpinCssDeg();
    if (opts.stable) {
      el.style.transform = spinDeg
        ? `translate(-50%, -50%) rotate(${spinDeg.toFixed(2)}deg)`
        : "translate(-50%, -50%)";
      el.style.filter = "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.45))";
      el.style.opacity = "0.94";
      return;
    }
    const fullSize = !!opts.fullSize;
    const speed = Math.hypot(dragVelX, dragVelY);
    const swingLimit = fullSize ? 12 : 8;
    const swingX = Math.max(-swingLimit, Math.min(swingLimit, ghostSwingX));
    const swingY = Math.max(-swingLimit, Math.min(swingLimit, ghostSwingY));
    const floatAmp = fullSize ? 2.6 : 1.7;
    const floatY = Math.sin(ghostFloatPhase) * floatAmp;
    const orbitRadiusX = fullSize ? 9.5 : 4.5;
    const orbitRadiusY = fullSize ? 6.5 : 3.2;
    const orbitX = Math.cos(ghostOrbitPhase) * orbitRadiusX;
    const orbitY = Math.sin(ghostOrbitPhase) * orbitRadiusY;
    const scale = fullSize
      ? 1
      : 1.05 + Math.min(0.05, speed * 0.0018);
    const tilt = fullSize
      ? Math.max(-10, Math.min(10, dragVelX * 0.12))
      : arcRotation != null
        ? arcRotation * 0.35
        : Math.max(-10, Math.min(10, dragVelX * 0.12));
    const spinScale = spinDeg > 0 ? 1 + Math.sin((spinDeg / 90) * Math.PI) * 0.045 : 1;
    el.style.transform = `translate(-50%, -50%) translate(${(swingX + orbitX).toFixed(2)}px, ${(swingY + floatY + orbitY).toFixed(2)}px) scale(${(scale * spinScale).toFixed(4)}) rotate(${(tilt + spinDeg).toFixed(2)}deg)`;
    el.style.filter = fullSize
      ? "drop-shadow(0 8px 20px rgba(0,0,0,0.5)) drop-shadow(0 2px 6px rgba(0,0,0,0.35))"
      : "drop-shadow(0 10px 22px rgba(0,0,0,0.55)) drop-shadow(0 3px 8px rgba(0,0,0,0.35))";
    el.style.opacity = fullSize ? "1" : "0.96";
  }

  function resetDragGhostStyles(el) {
    if (!el) return;
    el.classList.remove("ui-drag-ghost--arc-flight");
    el.style.transform = "translate(-50%, -50%)";
    el.style.filter = "drop-shadow(0 4px 14px rgba(0, 0, 0, 0.45))";
    el.style.opacity = "0.94";
    ghostSwingX = 0;
    ghostSwingY = 0;
    ghostSwingVx = 0;
    ghostSwingVy = 0;
    ghostOrbitPhase = 0;
    ghostRotateAnim = null;
  }

  function itemVisualWeight(def) {
    if (!def) return 0.4;
    const rarityWeight = {
      common: 0.3,
      rare: 0.5,
      epic: 0.7,
      legendary: 0.85,
      unique: 0.9,
      godly: 1,
    };
    const cells = def.shape?.length || 1;
    return (rarityWeight[def.rarity] || 0.4) * (0.55 + cells * 0.12);
  }

  function queuePlacement(uid, cells, valid = true) {
    if (!uid) return;
    itemAnims.set(uid, { kind: "place", t: 0, duration: PREP_PLACE_DURATION, valid });
    (cells || []).forEach(([col, row]) => {
      cellPulses.set(`${col},${row}`, { t: 0, duration: PREP_PLACE_DURATION, valid });
    });
  }

  function queueReject(uid) {
    if (!uid) return;
    itemAnims.set(uid, { kind: "reject", t: 0, duration: PREP_REJECT_DURATION });
  }

  function triggerBackpackShake(def) {
    const power = itemVisualWeight(def);
    backpackShakePower = Math.max(backpackShakePower, power);
    backpackShakeT = 0.32 + power * 0.18;
    const island = document.getElementById("prep-field-island");
    if (!island) return;
    island.classList.remove("prep-backpack-shake");
    void island.offsetWidth;
    island.classList.add("prep-backpack-shake");
    island.style.setProperty("--prep-shake-power", String(power));
  }

  function notifyItemPlaced(item, def) {
    if (!item?.uid) return;
    const cells = typeof getItemCells === "function" ? getItemCells(item) : [];
    queuePlacement(item.uid, cells, true);
    triggerBackpackShake(def || ITEM_CATALOG?.[item.itemId]);
  }

  function notifyPlacementRejected(item) {
    if (!item?.uid) return;
    queueReject(item.uid);
    if (typeof playGameSfx === "function") playGameSfx("prep_reject");
  }

  function getItemDrawTransform(uid) {
    const anim = itemAnims.get(uid);
    if (!anim) return null;
    const p = anim.t / anim.duration;
    if (anim.kind === "place") {
      const bounce = p < 0.45
        ? 1.16 - (p / 0.45) * 0.22
        : 0.95 + easeOutBack((p - 0.45) / 0.55) * 0.05;
      const lift = p < 0.4 ? -10 * (1 - p / 0.4) : 0;
      return { scale: bounce, offsetY: lift, offsetX: 0, shake: 0 };
    }
    if (anim.kind === "reject") {
      const shake = Math.sin(p * Math.PI * 6) * (1 - p) * 4;
      const bounce = 1 + Math.sin(p * Math.PI) * 0.08 * (1 - p);
      return { scale: bounce, offsetY: -3 * Math.sin(p * Math.PI), offsetX: shake, shake };
    }
    return null;
  }

  function getNeighborSpread(item, team) {
    if (!dragActive || typeof dragPayload === "undefined" || !dragPayload) return { x: 0, y: 0 };
    if (typeof hoverCell === "undefined" && typeof hoverSlot === "undefined") return { x: 0, y: 0 };
    if (dragFrom?.type === "item" && dragFrom.item?.uid === item.uid) return { x: 0, y: 0 };

    const targetCells = [];
    const side = typeof prepViewSide !== "undefined" ? prepViewSide : team;
    const dragRot = getGhostDrawRotation();
    if (typeof isContainerItem === "function" && isContainerItem(dragPayload.itemId) && hoverCell) {
      const shape = rotateShape(ITEM_CATALOG[dragPayload.itemId].shape, dragRot);
      shape.forEach(([dx, dy]) => targetCells.push([hoverCell.col + dx, hoverCell.row + dy]));
    } else if (hoverSlot && typeof resolveLoadoutPlacementDisplacing === "function") {
      const st = typeof getSideState === "function" ? getSideState(side) : null;
      if (!st) return { x: 0, y: 0 };
      const excludeUid = dragFrom?.type === "item" ? dragFrom.item?.uid : null;
      const placement = resolveLoadoutPlacementDisplacing(
        st.containers,
        dragPayload.itemId,
        hoverSlot.col,
        hoverSlot.row,
        dragRot,
      );
      if (placement.valid) {
        rotateShape(ITEM_CATALOG[dragPayload.itemId].shape, placement.rotation).forEach(([dx, dy]) => {
          targetCells.push([placement.col + dx, placement.row + dy]);
        });
      }
    }
    if (!targetCells.length) return { x: 0, y: 0 };

    const itemCells = getItemCells(item);
    let minDist = Infinity;
    itemCells.forEach(([c, r]) => {
      targetCells.forEach(([tc, tr]) => {
        minDist = Math.min(minDist, Math.hypot(c - tc, r - tr));
      });
    });
    if (minDist > 1.6) return { x: 0, y: 0 };

    const center = typeof getItemVisualCenter === "function"
      ? getItemVisualCenter(item, team)
      : null;
    if (!center) return { x: 0, y: 0 };

    let tcx = 0;
    let tcy = 0;
    targetCells.forEach(([c, r]) => {
      const rect = cellRect(team, c, r);
      tcx += rect.x + rect.w / 2;
      tcy += rect.y + rect.h / 2;
    });
    tcx /= targetCells.length;
    tcy /= targetCells.length;

    const dx = center.x - tcx;
    const dy = center.y - tcy;
    const len = Math.hypot(dx, dy) || 1;
    const push = (1.6 - minDist) * 3.5;
    const wobble = Math.sin(spreadPhase * 4 + item.uid.length) * 0.6;
    return {
      x: (dx / len) * push + wobble,
      y: (dy / len) * push + wobble * 0.5,
    };
  }

  function getBackpackShakeOffset() {
    if (backpackShakeT <= 0) return { x: 0, y: 0 };
    const p = 1 - backpackShakeT / (0.32 + backpackShakePower * 0.18);
    const amp = backpackShakePower * 3.5 * (1 - p);
    return {
      x: Math.sin(p * Math.PI * 8) * amp,
      y: Math.cos(p * Math.PI * 6) * amp * 0.6,
    };
  }

  function drawCellReactions(ctx, team) {
    if (typeof BattleFxTier !== "undefined" && BattleFxTier.prepFxReduced?.()
      && BattleFxTier.prepFxReduced()) {
      return;
    }
    cellPulses.forEach((pulse, key) => {
      const [col, row] = key.split(",").map(Number);
      const rect = cellRect(team, col, row);
      const p = pulse.t / pulse.duration;
      const alpha = (1 - p) * (pulse.valid ? 0.35 : 0.28);
      ctx.save();
      ctx.fillStyle = pulse.valid ? `rgba(63,185,80,${alpha})` : `rgba(248,81,73,${alpha})`;
      const inset = 2 + p * 3;
      roundRect(rect.x + inset, rect.y + inset, rect.w - inset * 2, rect.h - inset * 2, 4);
      ctx.fill();
      ctx.restore();
    });
  }

  function itemPreviewFill(color, valid) {
    const alpha = valid ? 0.78 : 0.52;
    const hex = String(color || "#58a6ff");
    if (hex.startsWith("#") && hex.length >= 7) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        return `rgba(${r},${g},${b},${alpha})`;
      }
    }
    return valid ? `rgba(88,166,255,${alpha})` : `rgba(248,81,73,${alpha * 0.85})`;
  }

  function drawPlacementFacingMarker(ctx, team, col, row, rotation) {
    const { x, y, w, h } = cellRect(team, col, row);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rot = ((rotation || 0) % 4 + 4) % 4;
    const size = Math.min(w, h) * 0.2;
    const inset = Math.max(3, CELL_TILE_PAD + 1);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot * Math.PI / 2);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2 + inset);
    ctx.lineTo(-size, -h / 2 + inset + size * 1.35);
    ctx.lineTo(size, -h / 2 + inset + size * 1.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawPlacementFigureShadow(ctx, team, placementInfo, options = {}) {
    const { includeDisplaced = true } = options;
    const { col, row, rotation, valid, displaced, kind } = placementInfo;
    const itemId = dragPayload.itemId;
    const def = ITEM_CATALOG[itemId];
    if (!def) return;
    const ghostItem = { itemId, col, row, rotation: rotation || 0, uid: "__prep-drop-preview__" };
    const shape = rotateShape(def.shape, rotation || 0);
    const fill = itemPreviewFill(def.color, valid);

    drawMergedShapeCells(ctx, team, col, row, shape, {
      fillStyle: fill,
      bridgeGaps: true,
      inset: 0,
    });

    ctx.save();
    ctx.globalAlpha = valid ? 0.92 : 0.72;
    if (kind === "item" && typeof drawPlacedItemIcons === "function") {
      drawPlacedItemIcons(ctx, def, ghostItem, (c, r) => cellRect(team, c, r));
    } else if (kind === "container") {
      const icons = getItemIcons(def);
      const containerCells = shape.map(([dx, dy]) => [col + dx, row + dy]);
      const iconRect = typeof getShapeIconDrawRect === "function"
        ? getShapeIconDrawRect(containerCells, (c, r) => cellRect(team, c, r))
        : cellRect(team, col + getShapeAnchorOffset(shape)[0], row + getShapeAnchorOffset(shape)[1]);
      const iconRotDeg = (((rotation || 0) % 4) + 4) % 4 * 90;
      const iconCenter = typeof getCellsBoundsCenter === "function"
        ? getCellsBoundsCenter(containerCells, (c, r) => cellRect(team, c, r))
        : null;
      const drawContainerIcons = () => {
        if (!iconRect) return;
        drawItemIcons(ctx, icons, iconRect.x, iconRect.y, iconRect.w, iconRect.h);
      };
      if (typeof withCanvasRotation === "function") {
        withCanvasRotation(ctx, iconCenter, iconRotDeg, drawContainerIcons);
      } else {
        drawContainerIcons();
      }
    }
    ctx.restore();

    drawPlacementFacingMarker(ctx, team, col, row, rotation);

    if (!includeDisplaced) return;

    displaced.forEach((item) => {
      const itemDef = ITEM_CATALOG[item.itemId];
      if (!itemDef) return;
      ctx.save();
      ctx.globalAlpha = valid ? 0.24 : 0.16;
      drawMergedOccupiedCells(ctx, team, getItemCells(item), {
        fillStyle: "rgba(210,153,34,0.55)",
        bridgeGaps: true,
        inset: 0,
      });
      if (typeof drawPlacedItemIcons === "function") {
        drawPlacedItemIcons(ctx, itemDef, item, (c, r) => cellRect(team, c, r));
      }
      ctx.restore();
    });
  }

  function drawEnhancedDropPreview(ctx, team, st) {
    if (typeof dragPayload === "undefined" || !dragPayload) return;
    const shadowPlacement = typeof getPrepDragShadowPlacement === "function"
      ? getPrepDragShadowPlacement(st, team)
      : null;
    if (!shadowPlacement) return;

    const logicalPlacement = typeof getPrepDropPlacement === "function"
      ? getPrepDropPlacement(st, team)
      : null;

    const visual = getDragVisualRotation();
    const def = ITEM_CATALOG[dragPayload.itemId];
    if (!def) return;

    if (logicalPlacement?.kind === "item" && logicalPlacement.valid && !visual.spinning) {
      const nextRot = logicalPlacement.rotation || 0;
      if ((dragPayload.rotation || 0) !== nextRot) {
        dragPayload.rotation = nextRot;
      }
    }

    const visualPlacement = visual.spinning
      ? resolveVisualDropPlacement(st, team, shadowPlacement)
      : shadowPlacement;
    const pulse = 0.5 + Math.sin(spreadPhase * 5) * 0.12;
    const { col, row, rotation, valid } = visualPlacement;
    const shape = rotateShape(def.shape, rotation || 0);
    const fillColor = itemPreviewFill(def.color, valid);
    const strokeColor = valid
      ? `rgba(130,255,160,${0.92 + pulse * 0.06})`
      : `rgba(255,110,100,${0.9 + pulse * 0.05})`;
    const strokeW = Math.max(2, typeof uiPx === "function" ? uiPx(2.5) : 2.5);

    withDragSpinTransform(ctx, team, col, row, shape, visual.spinDeg, () => {
      drawMergedShapeCells(ctx, team, col, row, shape, {
        fillStyle: fillColor,
        strokeStyle: strokeColor,
        lineWidth: strokeW,
        bridgeGaps: true,
        inset: 0,
      });
    });

    (shadowPlacement.displaced || []).forEach((item) => {
      const displacedFill = shadowPlacement.valid
        ? `rgba(255,210,80,${0.38 + pulse * 0.12})`
        : `rgba(255,110,100,${0.28 + pulse * 0.08})`;
      const displacedStroke = shadowPlacement.valid
        ? `rgba(255,220,120,${0.75 + pulse * 0.08})`
        : `rgba(255,110,100,${0.65})`;
      drawMergedOccupiedCells(ctx, team, getItemCells(item), {
        fillStyle: displacedFill,
        strokeStyle: displacedStroke,
        lineWidth: Math.max(1.5, strokeW * 0.75),
        bridgeGaps: true,
        inset: 0,
      });
    });
  }

  function tick(dt) {
    spreadPhase += dt;
    let rotateSpinFinished = false;
    if (ghostRotateAnim) {
      ghostRotateAnim.t += dt;
      if (ghostRotateAnim.t >= ghostRotateAnim.duration) {
        ghostRotateAnim = null;
        rotateSpinFinished = true;
      }
    }
    if (dragActive) {
      ghostFloatPhase += dt * 6.5;
      ghostOrbitPhase += dt * 4.2;
      ghostSwingVx += (-ghostSwingX * 18 - ghostSwingVx * 7.5) * dt;
      ghostSwingVy += (-ghostSwingY * 14 - ghostSwingVy * 6.2) * dt;
      ghostSwingX += ghostSwingVx * dt;
      ghostSwingY += ghostSwingVy * dt;
    } else {
      ghostSwingX = 0;
      ghostSwingY = 0;
      ghostSwingVx = 0;
      ghostSwingVy = 0;
      ghostOrbitPhase = 0;
    }
    if (backpackShakeT > 0) {
      backpackShakeT = Math.max(0, backpackShakeT - dt);
      if (backpackShakeT <= 0) {
        backpackShakePower = 0;
        document.getElementById("prep-field-island")?.classList.remove("prep-backpack-shake");
      }
    }

    itemAnims.forEach((anim, uid) => {
      anim.t += dt;
      if (anim.t >= anim.duration) itemAnims.delete(uid);
    });

    cellPulses.forEach((pulse, key) => {
      pulse.t += dt;
      if (pulse.t >= pulse.duration) cellPulses.delete(key);
    });

    return rotateSpinFinished;
  }

  function notifyHeavyDrop(def) {
    triggerBackpackShake(def);
    if (typeof playGameSfx === "function") playGameSfx("prep_place", { heavy: true });
  }

  return {
    onDragStart,
    onDragMove,
    onDragEnd,
    applyDragGhostStyles,
    resetDragGhostStyles,
    beginGhostRotationSpin,
    getGhostDrawRotation,
    getGhostSpinCssDeg,
    getDragVisualRotation,
    withDragSpinTransform,
    clearGhostRotationSpin,
    notifyItemPlaced,
    notifyPlacementRejected,
    notifyHeavyDrop,
    getItemDrawTransform,
    getNeighborSpread,
    getBackpackShakeOffset,
    drawCellReactions,
    drawEnhancedDropPreview,
    tick,
  };
})();

function tickInventoryAnimationController(dt) {
  const rotateSpinFinished = InventoryAnimationController.tick(dt);
  if (typeof dragPayload !== "undefined" && dragPayload && typeof getDragGhostCanvas === "function") {
    const el = getDragGhostCanvas();
    if (el && !el.classList.contains("hidden")) {
      const fullSize = false;
      const stable = true;
      InventoryAnimationController.applyDragGhostStyles(el, null, { fullSize, stable });
      if (rotateSpinFinished && typeof syncDragGhostOverlay === "function") {
        syncDragGhostOverlay(lastPointerClient.x, lastPointerClient.y);
      }
    }
  }
}

function onPrepDragStart() {
  InventoryAnimationController.onDragStart();
  playPrepSfx("prep_pickup");
}

function onPrepDragMove(clientX, clientY) {
  InventoryAnimationController.onDragMove(clientX, clientY);
}

function onPrepDragEnd() {
  InventoryAnimationController.onDragEnd();
  InventoryAnimationController.resetDragGhostStyles(getDragGhostCanvas?.());
}

function applyPrepDragGhostStyles(el, arcRotation = null, opts = {}) {
  InventoryAnimationController.applyDragGhostStyles(el, arcRotation, opts);
}

function beginPrepGhostRotationSpin(fromRot, toRot) {
  return InventoryAnimationController.beginGhostRotationSpin(fromRot, toRot);
}

function getPrepGhostDrawRotation() {
  return InventoryAnimationController.getGhostDrawRotation();
}

function getPrepDragVisualRotation() {
  return InventoryAnimationController.getDragVisualRotation();
}

function notifyPrepItemPlaced(item, def) {
  InventoryAnimationController.notifyItemPlaced(item, def);
  if (typeof CombatLog !== "undefined" && def) CombatLog.notifyItemPlaced(def);
  if (typeof playPrepItemPlacedSfx === "function") {
    playPrepItemPlacedSfx(item, def);
  }
}

function notifyPrepPlacementRejected(item) {
  InventoryAnimationController.notifyPlacementRejected(item);
}

function getPrepItemDrawTransform(uid) {
  return InventoryAnimationController.getItemDrawTransform(uid);
}

function getPrepNeighborSpread(item, team) {
  return InventoryAnimationController.getNeighborSpread(item, team);
}

function getPrepBackpackShakeOffset() {
  return InventoryAnimationController.getBackpackShakeOffset();
}

function drawPrepCellReactions(ctx, team) {
  InventoryAnimationController.drawCellReactions(ctx, team);
}

function notifyPrepHeavyDrop(def) {
  InventoryAnimationController.notifyHeavyDrop(def);
}

function drawPrepDropPreview(ctx, team, st) {
  InventoryAnimationController.drawEnhancedDropPreview(ctx, team, st);
}
