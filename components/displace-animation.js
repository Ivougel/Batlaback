/**
 * Анимация вытеснения: предметы «вываливаются» с доски и падают на скамейку.
 */

const DISPLACE_FALL_DURATION = 0.58;
const DISPLACE_STAGGER = 0.07;

let displaceAnimations = [];

function easeInQuad(t) {
  return t * t;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function getItemVisualCenterOnBoard(item, team) {
  const cells = getItemCells(item);
  if (!cells.length) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  cells.forEach(([c, r]) => {
    const rect = cellRect(team, c, r);
    sx += rect.x + rect.w / 2;
    sy += rect.y + rect.h / 2;
  });
  return { x: sx / cells.length, y: sy / cells.length };
}

function getBenchTargetCanvasPoint(side, slotOffset = 0) {
  const canvasEl = document.getElementById("game-canvas");
  const slotsEl = document.getElementById("bench-slots");
  if (!canvasEl || !slotsEl) {
    return { x: uiPx(48), y: canvasEl ? canvasEl.height * 0.72 : 320 };
  }

  const canvasRect = canvasEl.getBoundingClientRect();
  const scaleX = canvasEl.width / Math.max(1, canvasRect.width);
  const scaleY = canvasEl.height / Math.max(1, canvasRect.height);
  const st = getSideState(side);
  const slotIndex = Math.min(
    st.bench.length + slotOffset,
    Math.max(0, (typeof MAX_BENCH !== "undefined" ? MAX_BENCH : 6) - 1),
  );
  const cards = slotsEl.querySelectorAll(".bench-card");
  const targetEl = cards[slotIndex] || slotsEl;
  const tr = targetEl.getBoundingClientRect();

  return {
    x: (tr.left + tr.width / 2 - canvasRect.left) * scaleX,
    y: (tr.top + tr.height / 2 - canvasRect.top) * scaleY,
  };
}

function queueDisplaceToBenchAnimations(side, items, team, onItemLanded) {
  if (!items?.length) return;

  items.forEach((item, index) => {
    const from = getItemVisualCenterOnBoard(item, team);
    const to = getBenchTargetCanvasPoint(side, index);
    displaceAnimations.push({
      side,
      item: {
        itemId: item.itemId,
        uid: item.uid,
        rotation: item.rotation || 0,
        col: item.col,
        row: item.row,
      },
      team,
      fromX: from.x,
      fromY: from.y,
      toX: to.x + (index - (items.length - 1) / 2) * uiPx(6),
      toY: to.y,
      delay: index * DISPLACE_STAGGER,
      age: 0,
      duration: DISPLACE_FALL_DURATION,
      wobble: (Math.random() - 0.5) * 0.35,
      onComplete: () => {
        const st = getSideState(side);
        st.bench.push({
          itemId: item.itemId,
          uid: item.uid,
          rotation: item.rotation || 0,
        });
        if (typeof onItemLanded === "function") onItemLanded(item, side);
      },
    });
  });
}

function tickDisplaceAnimations(dt) {
  if (!displaceAnimations.length) return;

  displaceAnimations = displaceAnimations.filter((anim) => {
    anim.age += dt;
    if (anim.age < anim.delay + anim.duration) return true;

    try {
      anim.onComplete?.();
    } catch (err) {
      console.error("displace onComplete failed:", err);
    }
    return false;
  });
}

function hasActiveDisplaceAnimations(side = null) {
  if (!side) return displaceAnimations.length > 0;
  return displaceAnimations.some((anim) => anim.side === side);
}

function drawDisplacedItem(ctx, item, team, centerX, centerY, alpha, scale) {
  const def = ITEM_CATALOG[item.itemId];
  if (!def) return;

  const itemCenter = getItemVisualCenterOnBoard(item, team);
  const pad = typeof CELL_TILE_PAD !== "undefined" ? CELL_TILE_PAD : 3;
  const cells = getItemCells(item);

  ctx.save();
  ctx.globalAlpha = alpha;

  cells.forEach(([c, r]) => {
    const rect = cellRect(team, c, r);
    const x = centerX + (rect.x - itemCenter.x) * scale;
    const y = centerY + (rect.y - itemCenter.y) * scale;
    const w = rect.w * scale;
    const h = rect.h * scale;

    ctx.fillStyle = def.color + "dd";
    roundRect(x + pad * scale, y + pad * scale, w - pad * 2 * scale, h - pad * 2 * scale, 5 * scale);
    ctx.fill();
    ctx.strokeStyle = RARITY_COLORS[def.rarity] || "#8b949e";
    ctx.lineWidth = 1.5;
    roundRect(x + pad * scale, y + pad * scale, w - pad * 2 * scale, h - pad * 2 * scale, 5 * scale);
    ctx.stroke();
  });

  if (cells.length) {
    drawPlacedItemIcons(ctx, def, item, (c, r) => {
      const rect = cellRect(team, c, r);
      return {
        x: centerX + (rect.x - itemCenter.x) * scale,
        y: centerY + (rect.y - itemCenter.y) * scale,
        w: rect.w * scale,
        h: rect.h * scale,
      };
    });
    if (typeof drawItemSocketVisuals === "function") {
      drawItemSocketVisuals(ctx, item, def, (c, r) => {
        const rect = cellRect(team, c, r);
        return {
          x: centerX + (rect.x - itemCenter.x) * scale,
          y: centerY + (rect.y - itemCenter.y) * scale,
          w: rect.w * scale,
          h: rect.h * scale,
        };
      });
    }
  }

  ctx.restore();
}

function drawDisplaceAnimations(ctx, team) {
  displaceAnimations.forEach((anim) => {
    if (anim.team !== team) return;

    const localAge = anim.age - anim.delay;
    if (localAge < 0) {
      drawDisplacedItem(
        ctx,
        anim.item,
        anim.team,
        anim.fromX,
        anim.fromY,
        1,
        1,
      );
      return;
    }

    const t = Math.min(1, localAge / anim.duration);
    const fallT = easeInQuad(t);
    const slideT = easeOutCubic(t);
    const x = anim.fromX + (anim.toX - anim.fromX) * slideT + Math.sin(t * Math.PI * 2) * anim.wobble * uiPx(8) * (1 - t);
    const y = anim.fromY + (anim.toY - anim.fromY) * fallT;
    const alpha = t > 0.88 ? 1 - (t - 0.88) / 0.12 : 1;
    const scale = 1 - t * 0.18;

    drawDisplacedItem(ctx, anim.item, anim.team, x, y, alpha, scale);
  });
}

function clearDisplaceAnimations(side = null) {
  if (!side) {
    displaceAnimations = [];
    return;
  }
  displaceAnimations = displaceAnimations.filter((anim) => anim.side !== side);
}
