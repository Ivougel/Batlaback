/**
 * Визуальный слой drag/drop инвентаря подготовки — без игровой логики.
 */

const PREP_PLACE_DURATION = 0.2;
const PREP_REJECT_DURATION = 0.28;

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
  }

  function onDragMove(clientX, clientY) {
    if (lastDragClient) {
      dragVelX = clientX - lastDragClient.x;
      dragVelY = clientY - lastDragClient.y;
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
    const fullSize = !!opts.fullSize;
    const speed = Math.hypot(dragVelX, dragVelY);
    const scale = fullSize
      ? 1
      : 1.05 + Math.min(0.05, speed * 0.0018);
    const tilt = fullSize
      ? Math.max(-10, Math.min(10, dragVelX * 0.12))
      : arcRotation != null
        ? arcRotation * 0.35
        : Math.max(-10, Math.min(10, dragVelX * 0.12));
    el.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${tilt}deg)`;
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
    if (typeof playGameSfx === "function") playGameSfx("prep_place");
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
        ? 1.1 - (p / 0.45) * 0.15
        : 0.95 + easeOutBack((p - 0.45) / 0.55) * 0.05;
      const lift = p < 0.35 ? -5 * (1 - p / 0.35) : 0;
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
    if (typeof isContainerItem === "function" && isContainerItem(dragPayload.itemId) && hoverCell) {
      const shape = rotateShape(ITEM_CATALOG[dragPayload.itemId].shape, dragPayload.rotation || 0);
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
        dragPayload.rotation || 0,
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

  function drawPlacementFigureShadow(ctx, team, placementInfo) {
    const { col, row, rotation, valid, displaced, kind } = placementInfo;
    const itemId = dragPayload.itemId;
    const def = ITEM_CATALOG[itemId];
    if (!def) return;
    const ghostItem = { itemId, col, row, rotation: rotation || 0, uid: "__prep-drop-preview__" };
    const shape = rotateShape(def.shape, rotation || 0);
    const fill = itemPreviewFill(def.color, valid);
    const stroke = valid ? "rgba(120,220,140,0.75)" : "rgba(255,120,110,0.6)";

    shape.forEach(([dx, dy]) => {
      const { x, y, w, h } = cellRect(team, col + dx, row + dy);
      ctx.save();
      ctx.fillStyle = fill;
      roundRect(x + CELL_TILE_PAD, y + CELL_TILE_PAD, w - CELL_TILE_PAD * 2, h - CELL_TILE_PAD * 2, 5);
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = valid ? 2 : 1.5;
      roundRect(x + CELL_TILE_PAD, y + CELL_TILE_PAD, w - CELL_TILE_PAD * 2, h - CELL_TILE_PAD * 2, 5);
      ctx.stroke();
      ctx.restore();
    });

    ctx.save();
    ctx.globalAlpha = valid ? 0.92 : 0.72;
    if (kind === "item" && typeof drawPlacedItemIcons === "function") {
      drawPlacedItemIcons(ctx, def, ghostItem, (c, r) => cellRect(team, c, r));
    } else if (kind === "container") {
      const icons = getItemIcons(def);
      const [adx, ady] = getShapeAnchorOffset(shape);
      const anchorRect = cellRect(team, col + adx, row + ady);
      drawItemIcons(
        ctx,
        icons,
        anchorRect.x + anchorRect.w * 0.5,
        anchorRect.y + anchorRect.h * 0.5,
        anchorRect.w * 0.72,
        anchorRect.h * 0.72,
        CELL_TILE_PAD,
      );
    }
    ctx.restore();

    drawPlacementFacingMarker(ctx, team, col, row, rotation);

    displaced.forEach((item) => {
      const itemDef = ITEM_CATALOG[item.itemId];
      if (!itemDef) return;
      ctx.save();
      ctx.globalAlpha = valid ? 0.24 : 0.16;
      getItemCells(item).forEach(([c, r]) => {
        const { x, y, w, h } = cellRect(team, c, r);
        ctx.fillStyle = "rgba(210,153,34,0.55)";
        roundRect(x + CELL_TILE_PAD, y + CELL_TILE_PAD, w - CELL_TILE_PAD * 2, h - CELL_TILE_PAD * 2, 5);
        ctx.fill();
      });
      if (typeof drawPlacedItemIcons === "function") {
        drawPlacedItemIcons(ctx, itemDef, item, (c, r) => cellRect(team, c, r));
      }
      ctx.restore();
    });
  }

  function drawEnhancedDropPreview(ctx, team, st) {
    if (typeof dragPayload === "undefined" || !dragPayload) return;
    const placementInfo = typeof getPrepDropPlacement === "function"
      ? getPrepDropPlacement(st, team)
      : null;
    if (!placementInfo) return;

    if (placementInfo.kind === "item" && placementInfo.valid) {
      const nextRot = placementInfo.rotation || 0;
      if ((dragPayload.rotation || 0) !== nextRot) {
        dragPayload.rotation = nextRot;
      }
    }

    const pulse = 0.5 + Math.sin(spreadPhase * 5) * 0.12;
    const { col, row, rotation, valid, displaced } = placementInfo;
    const shape = rotateShape(ITEM_CATALOG[dragPayload.itemId].shape, rotation || 0);

    shape.forEach(([dx, dy]) => {
      const { x, y, w, h } = cellRect(team, col + dx, row + dy);
      ctx.save();
      ctx.fillStyle = valid
        ? `rgba(63,185,80,${0.32 + pulse * 0.18})`
        : `rgba(248,81,73,${0.28 + pulse * 0.12})`;
      roundRect(x + 3, y + 3, w - 6, h - 6, 5);
      ctx.fill();
      ctx.strokeStyle = valid
        ? `rgba(120,220,140,${0.4 + pulse * 0.12})`
        : `rgba(255,120,110,${0.3 + pulse * 0.1})`;
      ctx.lineWidth = valid ? 2 : 1.5;
      roundRect(x + 3, y + 3, w - 6, h - 6, 5);
      ctx.stroke();
      ctx.restore();
    });

    displaced.forEach((item) => {
      getItemCells(item).forEach(([c, r]) => {
        const { x, y, w, h } = cellRect(team, c, r);
        ctx.save();
        ctx.fillStyle = valid ? `rgba(210,153,34,${0.22 + pulse * 0.08})` : `rgba(248,81,73,${0.16})`;
        roundRect(x + 3, y + 3, w - 6, h - 6, 5);
        ctx.fill();
        ctx.restore();
      });
    });

    const showFigure = typeof shouldDrawPrepGridFigurePreview !== "function"
      || shouldDrawPrepGridFigurePreview();
    if (showFigure) {
      drawPlacementFigureShadow(ctx, team, placementInfo);
    }
  }

  function tick(dt) {
    spreadPhase += dt;
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
  InventoryAnimationController.tick(dt);
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

function notifyPrepItemPlaced(item, def) {
  InventoryAnimationController.notifyItemPlaced(item, def);
  if (typeof CombatLog !== "undefined" && def) CombatLog.notifyItemPlaced(def);
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
