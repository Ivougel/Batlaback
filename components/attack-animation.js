/**
 * Отрисовка анимаций предметов на canvas (снаряды — в HTML-overlay).
 */

function drawAttackAnimations(_ctx, _state) {
  /* снаряды рисуются в renderBattleEffectsOverlay */
}

function drawBattleItemWithAnimation(ctx, item, team, def, cellRectFn, roundRectFn, state) {
  const pulse = getItemPulseScale(state, item.uid);
  const flashing = isItemFlashing(state, item.uid);
  const failedFlash = typeof isItemFailedFlash === "function" && isItemFailedFlash(state, item.uid);
  const cells = getItemCells(item);
  const pad = typeof CELL_TILE_PAD !== "undefined" ? CELL_TILE_PAD : 3;

  cells.forEach(([c, r]) => {
    const { x, y, w, h } = cellRectFn(team, c, r);

    ctx.save();
    if (failedFlash) {
      ctx.shadowColor = "#f85149";
      ctx.shadowBlur = 18;
    } else if (flashing) {
      ctx.shadowColor = team === "player" ? "#58a6ff" : "#f85149";
      ctx.shadowBlur = 16;
    }

    ctx.fillStyle = def.color + (failedFlash ? "ee" : flashing ? "ff" : "cc");
    roundRectFn(x + pad, y + pad, w - pad * 2, h - pad * 2, 5);
    ctx.fill();

    if (failedFlash) {
      ctx.strokeStyle = "#f85149";
      ctx.lineWidth = 2;
      roundRectFn(x + pad, y + pad, w - pad * 2, h - pad * 2, 5);
      ctx.stroke();
    }

    if (item.currentCooldown != null) {
      const maxCd = getEffectiveCooldown(item);
      const pct = maxCd > 0 ? 1 - item.currentCooldown / maxCd : 1;
      ctx.fillStyle = pct >= 1 ? "#3fb950" : "#58a6ff";
      roundRectFn(x + 4, y + h - 10, (w - 8) * Math.max(0, Math.min(1, pct)), 5, 2);
      ctx.fill();
    }
    ctx.restore();
  });

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
  drawCellEmoji(ctx, def.icon, x, y, w, h);
  ctx.restore();
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function drawEnhancedFloatingNumbers(_ctx, _state) {
  /* числа рисуются в renderBattleEffectsOverlay */
}
