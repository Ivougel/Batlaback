/**
 * Отрисовка анимаций предметов на canvas (снаряды — в HTML-overlay).
 */

function drawBattleItemCooldownBar(ctx, item, rectFn, roundRectFn) {
  if (item.currentCooldown == null) return;
  const [iconCol, iconRow] = getItemIconCell(item);
  const { x, y, w, h } = rectFn(iconCol, iconRow);
  const maxCd = getEffectiveCooldown(item);
  const pct = maxCd > 0 ? 1 - item.currentCooldown / maxCd : 1;
  ctx.fillStyle = pct >= 1 ? "#3fb950" : "#58a6ff";
  roundRectFn(x + 4, y + h - 10, (w - 8) * Math.max(0, Math.min(1, pct)), 5, 2);
  ctx.fill();
}

function drawAttackAnimations(_ctx, _state) {
  /* снаряды рисуются в renderBattleEffectsOverlay */
}

function drawBattleItemOverlays(ctx, item, team, def, state) {
  if (!ctx || !item || !def || !state) return;
  const pulse = getItemPulseScale(state, item.uid);
  const flashing = isItemFlashing(state, item.uid);
  const failedFlash = typeof isItemFailedFlash === "function" && isItemFailedFlash(state, item.uid);
  const cells = getItemCells(item);
  const pad = typeof CELL_TILE_PAD !== "undefined" ? CELL_TILE_PAD : 3;
  const rectFn = (c, r) => cellRect(team, c, r);

  cells.forEach(([c, r]) => {
    const { x, y, w, h } = rectFn(c, r);
    ctx.save();
    if (failedFlash) {
      ctx.strokeStyle = "#f85149";
      ctx.lineWidth = 2;
      roundRect(x + pad, y + pad, w - pad * 2, h - pad * 2, 5);
      ctx.stroke();
    } else if (flashing) {
      ctx.shadowColor = team === "player" ? "#58a6ff" : "#f85149";
      ctx.shadowBlur = 16;
      roundRect(x + pad, y + pad, w - pad * 2, h - pad * 2, 5);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  });

  drawBattleItemCooldownBar(ctx, item, rectFn, roundRect);

  if (!cells.length || pulse <= 1) return;
  const [iconCol, iconRow] = getItemIconCell(item);
  const { x, y, w, h } = rectFn(iconCol, iconRow);
  const iconCx = x + pad + (w - pad * 2) / 2;
  const iconCy = y + pad + (h - pad * 2) / 2;
  ctx.save();
  ctx.translate(iconCx, iconCy);
  ctx.scale(pulse, pulse);
  ctx.translate(-iconCx, -iconCy);
  drawPlacedItemIcons(ctx, def, item, (c, r) => rectFn(c, r));
  ctx.restore();
}

function drawBattleItemWithAnimation(ctx, item, team, def, cellRectFn, roundRectFn, state) {
  const pulse = getItemPulseScale(state, item.uid);
  const flashing = isItemFlashing(state, item.uid);
  const failedFlash = typeof isItemFailedFlash === "function" && isItemFailedFlash(state, item.uid);
  const cells = getItemCells(item);
  const pad = typeof CELL_TILE_PAD !== "undefined" ? CELL_TILE_PAD : 3;

  cells.forEach(([c, r]) => {
    const { x, y, w, h } = cellRectFn(team, c, r);
    const gemVis = typeof getGemCellVisualMap === "function"
      ? getGemCellVisualMap(item, def).get(`${c},${r}`)
      : null;
    let fill = def.color;
    if (gemVis?.gemId) {
      fill = ITEM_CATALOG[gemVis.gemId]?.color || def.color;
    } else if (gemVis?.emptySocket) {
      fill = "#4a3868";
    }

    ctx.save();
    if (failedFlash) {
      ctx.shadowColor = "#f85149";
      ctx.shadowBlur = 18;
    } else if (flashing) {
      ctx.shadowColor = team === "player" ? "#58a6ff" : "#f85149";
      ctx.shadowBlur = 16;
    }

    ctx.fillStyle = fill + (failedFlash ? "ee" : flashing ? "ff" : "cc");
    roundRectFn(x + pad, y + pad, w - pad * 2, h - pad * 2, 5);
    ctx.fill();

    if (failedFlash) {
      ctx.strokeStyle = "#f85149";
      ctx.lineWidth = 2;
      roundRectFn(x + pad, y + pad, w - pad * 2, h - pad * 2, 5);
      ctx.stroke();
    }

    ctx.restore();
  });

  drawBattleItemCooldownBar(ctx, item, (c, r) => cellRectFn(team, c, r), roundRectFn);

  if (!cells.length) return;

  const [iconCol, iconRow] = getItemIconCell(item);
  const { x, y, w, h } = cellRectFn(team, iconCol, iconRow);
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const iconCx = x + pad + innerW / 2;
  const iconCy = y + pad + innerH / 2;

  ctx.save();
  if (pulse > 1) {
    ctx.translate(iconCx, iconCy);
    ctx.scale(pulse, pulse);
    ctx.translate(-iconCx, -iconCy);
  }
  if (failedFlash) {
    ctx.shadowColor = "#f85149";
    ctx.shadowBlur = 18;
  } else if (flashing) {
    ctx.shadowColor = team === "player" ? "#58a6ff" : "#f85149";
    ctx.shadowBlur = 16;
  }
  drawPlacedItemIcons(ctx, def, item, (c, r) => cellRectFn(team, c, r));
  if (typeof drawItemSocketVisuals === "function") {
    drawItemSocketVisuals(ctx, item, def, (c, r) => cellRectFn(team, c, r));
  }
  ctx.restore();
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function drawEnhancedFloatingNumbers(_ctx, _state) {
  /* числа рисуются в renderBattleEffectsOverlay */
}
