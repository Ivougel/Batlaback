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

  getItemCells(item).forEach(([c, r], idx) => {
    const { x, y, w, h } = cellRectFn(team, c, r);
    const cx = x + w / 2;
    const cy = y + h / 2;

    ctx.save();
    if (idx === 0 && pulse > 1) {
      ctx.translate(cx, cy);
      ctx.scale(pulse, pulse);
      ctx.translate(-cx, -cy);
    }

    if (failedFlash) {
      ctx.shadowColor = "#f85149";
      ctx.shadowBlur = 18;
    } else if (flashing) {
      ctx.shadowColor = team === "player" ? "#58a6ff" : "#f85149";
      ctx.shadowBlur = 16;
    }

    ctx.fillStyle = def.color + (failedFlash ? "ee" : flashing ? "ff" : "cc");
    roundRectFn(x + 3, y + 3, w - 6, h - 6, 5);
    ctx.fill();

    if (failedFlash) {
      ctx.strokeStyle = "#f85149";
      ctx.lineWidth = 2;
      roundRectFn(x + 3, y + 3, w - 6, h - 6, 5);
      ctx.stroke();
    }

    if (idx === 0) {
      ctx.font = `${Math.round(uiPx(27) * (pulse > 1 ? pulse : 1))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.icon, cx, cy);
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
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function drawEnhancedFloatingNumbers(_ctx, _state) {
  /* числа рисуются в renderBattleEffectsOverlay */
}
