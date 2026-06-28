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

  function applyDragGhostStyles(el) {
    if (!el) return;
    const speed = Math.hypot(dragVelX, dragVelY);
    const scale = 1.05 + Math.min(0.05, speed * 0.0018);
    const tilt = Math.max(-10, Math.min(10, dragVelX * 0.12));
    el.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${tilt}deg)`;
    el.style.filter =
      "drop-shadow(0 10px 22px rgba(0,0,0,0.55)) drop-shadow(0 3px 8px rgba(0,0,0,0.35))";
    el.style.opacity = "0.96";
  }

  function resetDragGhostStyles(el) {
    if (!el) return;
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
  }

  function notifyPlacementRejected(item) {
    if (!item?.uid) return;
    queueReject(item.uid);
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

  function drawEnhancedDropPreview(ctx, team, st) {
    if (typeof dragPayload === "undefined" || !dragPayload) return;
    const pulse = 0.5 + Math.sin(spreadPhase * 5) * 0.12;

    if (typeof isContainerItem === "function" && isContainerItem(dragPayload.itemId) && hoverCell) {
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
        st.items,
      );
      rotateShape(ITEM_CATALOG[dragPayload.itemId].shape, dragPayload.rotation || 0).forEach(([dx, dy]) => {
        const { x, y, w, h } = cellRect(team, hoverCell.col + dx, hoverCell.row + dy);
        ctx.save();
        ctx.fillStyle = valid
          ? `rgba(63,185,80,${0.22 + pulse * 0.12})`
          : `rgba(248,81,73,${0.18 + pulse * 0.08})`;
        roundRect(x + 3, y + 3, w - 6, h - 6, 5);
        ctx.fill();
        ctx.strokeStyle = valid
          ? `rgba(120,220,140,${0.35 + pulse * 0.15})`
          : `rgba(255,120,110,${0.28 + pulse * 0.1})`;
        ctx.lineWidth = 1.5;
        roundRect(x + 3, y + 3, w - 6, h - 6, 5);
        ctx.stroke();
        ctx.restore();
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
    const benchOk = st.bench.length + displaced.length <= (typeof MAX_BENCH !== "undefined" ? MAX_BENCH : 6);
    const valid = placement.valid && benchOk;

    rotateShape(ITEM_CATALOG[dragPayload.itemId].shape, placement.rotation).forEach(([dx, dy]) => {
      const { x, y, w, h } = cellRect(team, placement.col + dx, placement.row + dy);
      ctx.save();
      ctx.fillStyle = valid
        ? `rgba(63,185,80,${0.24 + pulse * 0.14})`
        : `rgba(248,81,73,${0.2 + pulse * 0.1})`;
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
}

function onPrepDragMove(clientX, clientY) {
  InventoryAnimationController.onDragMove(clientX, clientY);
}

function onPrepDragEnd() {
  InventoryAnimationController.onDragEnd();
  InventoryAnimationController.resetDragGhostStyles(getDragGhostCanvas?.());
}

function applyPrepDragGhostStyles(el) {
  InventoryAnimationController.applyDragGhostStyles(el);
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
