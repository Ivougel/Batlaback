/**
 * CellRenderer — подсветка клеток инвентаря (не предметов).
 */

/** Масштаб радиуса свечения (1 = полный, 1/6 ≈ половина от прежнего 1/3). */
const GLOW_RADIUS = 1 / 6;

function glowSize(base, pulseAmp = 0, pulse = 0) {
  return (base + pulseAmp * pulse) * GLOW_RADIUS;
}

function glowPad(strongPad, weakPad, isStrong) {
  return Math.max(1, Math.round((isStrong ? strongPad : weakPad) * GLOW_RADIUS));
}

function synergyCellPath(ctx, rect) {
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
}

function drawSynergyCellGlow(ctx, col, row, type, strength, pulse, mode) {
  const rect = cellRectForSynergy("player", col, row);
  const color = synergyColorForType(type, strength, mode);
  const isPreview = mode === SYNERGY_VISUAL.PREVIEW;
  const isStrong = strength === "strong";

  const fillAlpha = isPreview
    ? (isStrong ? 0.14 + pulse * 0.09 : 0.1 + pulse * 0.06)
    : (isStrong ? 0.05 + pulse * 0.025 : 0.035 + pulse * 0.02);
  const strokeAlpha = isPreview
    ? (isStrong ? 0.325 + pulse * 0.125 : 0.225 + pulse * 0.075)
    : (isStrong ? 0.14 + pulse * 0.05 : 0.1 + pulse * 0.04);
  const blur = isPreview
    ? glowSize(isStrong ? 20 : 14, isStrong ? 12 : 8, pulse)
    : glowSize(isStrong ? 8 : 6, isStrong ? 4 : 3, pulse);

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = hexToRgba(color, fillAlpha);
  ctx.beginPath();
  synergyCellPath(ctx, rect);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = hexToRgba(color, strokeAlpha);
  ctx.lineWidth = isPreview ? 2 : 1;
  ctx.beginPath();
  synergyCellPath(ctx, rect);
  ctx.stroke();
  ctx.restore();
}

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Внешний ореол — рисуется ПОД предметами. */
function drawActiveCellHalo(ctx, col, row, team, type, strength, pulse) {
  const rect = cellRectForSynergy(team, col, row);
  const color = synergyColorForType(type, strength, SYNERGY_VISUAL.ACTIVE);
  const isStrong = strength === "strong";
  const pad = glowPad(8, 5, isStrong);

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = glowSize(isStrong ? 32 : 22, isStrong ? 16 : 10, pulse);
  ctx.fillStyle = hexToRgba(color, isStrong ? 0.09 + pulse * 0.05 : 0.06 + pulse * 0.035);
  ctx.beginPath();
  ctx.rect(rect.x - pad, rect.y - pad, rect.w + pad * 2, rect.h + pad * 2);
  ctx.fill();
  ctx.restore();
}

/** Яркая поверхность клетки — рисуется ПОВЕРХ предметов (без текста). */
function drawActiveCellSurface(ctx, col, row, team, type, strength, pulse) {
  const rect = cellRectForSynergy(team, col, row);
  const color = synergyColorForType(type, strength, SYNERGY_VISUAL.ACTIVE);
  const isStrong = strength === "strong";

  ctx.save();

  ctx.fillStyle = hexToRgba(color, isStrong ? 0.11 + pulse * 0.07 : 0.08 + pulse * 0.05);
  ctx.beginPath();
  synergyCellPath(ctx, rect);
  ctx.fill();

  ctx.strokeStyle = hexToRgba(color, isStrong ? 0.425 + pulse * 0.06 : 0.325 + pulse * 0.075);
  ctx.lineWidth = isStrong ? 2 : 1.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = glowSize(isStrong ? 14 : 10, isStrong ? 8 : 5, pulse);
  ctx.beginPath();
  synergyCellPath(ctx, rect);
  ctx.stroke();

  ctx.shadowBlur = 0;
  if (pulse > 0.55) {
    const sparkAlpha = (pulse - 0.55) * 0.9;
    ctx.globalAlpha = sparkAlpha;
    ctx.font = `${uiPx(isStrong ? 11 : 9)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = hexToRgba(color, 0.9);
    ctx.fillText("✦", rect.x + 6, rect.y + rect.h / 2);
    ctx.fillText("✦", rect.x + rect.w - 6, rect.y + rect.h / 2);
  }

  ctx.restore();
}

/** Мягкая энергия между связанными предметами (не золотой луч preview). */
function drawActiveEnergyBridge(ctx, from, to, color, pulse, time, strong) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const wave = Math.sin(time * 3) * 3;

  ctx.save();
  ctx.strokeStyle = hexToRgba(color, strong ? 0.225 + pulse * 0.125 : 0.16 + pulse * 0.09);
  ctx.lineWidth = strong ? 2.5 : 1.8;
  ctx.shadowColor = color;
  ctx.shadowBlur = glowSize(strong ? 14 : 9, strong ? 6 : 4, pulse);
  ctx.setLineDash([6, 8]);
  ctx.lineDashOffset = -time * 12;

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(
    (from.x + to.x) / 2 + nx * wave,
    (from.y + to.y) / 2 + ny * wave,
    to.x,
    to.y,
  );
  ctx.stroke();

  const midX = (from.x + to.x) / 2 + nx * wave * 0.5;
  const midY = (from.y + to.y) / 2 + ny * wave * 0.5;
  ctx.fillStyle = hexToRgba(color, 0.175 + pulse * 0.125);
  ctx.shadowBlur = glowSize(strong ? 10 : 6);
  ctx.beginPath();
  ctx.arc(midX, midY, glowSize(strong ? 4 : 3, strong ? 2 : 1.5, pulse), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function resolveGroupItemCenters(group, items, team) {
  if (!group.itemUids?.length || !items?.length) return null;
  const list = group.itemUids
    .map((uid) => items.find((i) => i.uid === uid))
    .filter(Boolean);
  if (list.length < 2) return null;
  return [
    getItemVisualCenter(list[0], team),
    getItemVisualCenter(list[1], team),
  ];
}

/** ACTIVE: яркое свечение клеток + пульсация + мягкая энергия между партнёрами. */
function drawActiveSynergyCellLayer(ctx, cellGroups, team, items, time, layer) {
  if (!cellGroups?.length) return;

  const pulse = 0.5 + Math.sin(time * 2.6) * 0.5;
  const drawn = new Set();

  cellGroups.forEach((group) => {
    const color = synergyColorForType(group.type, group.strength, SYNERGY_VISUAL.ACTIVE);

    group.cells.forEach(({ col, row, key }) => {
      if (drawn.has(key)) return;
      drawn.add(key);

      if (layer === "halo") {
        drawActiveCellHalo(ctx, col, row, team, group.type, group.strength, pulse);
      } else if (layer === "surface") {
        drawActiveCellSurface(ctx, col, row, team, group.type, group.strength, pulse);
      }
    });

    if (layer === "surface") {
      const centers = resolveGroupItemCenters(group, items, team);
      if (centers) {
        drawActiveEnergyBridge(
          ctx,
          centers[0],
          centers[1],
          color,
          pulse,
          time,
          group.strength === "strong",
        );
      }
    }
  });
}

/** PREVIEW: яркие клетки + золотой луч между партнёрами. */
function drawPreviewSynergyCellLayer(ctx, cellGroups, synergies, items, time) {
  if (!cellGroups?.length) return;

  const pulse = 0.5 + Math.sin(time * 5) * 0.2;
  const drawn = new Set();
  const uidToItem = new Map(items.map((i) => [i.uid, i]));

  cellGroups.forEach((group) => {
    group.cells.forEach(({ col, row, key }) => {
      if (drawn.has(key)) return;
      drawn.add(key);
      drawSynergyCellGlow(
        ctx,
        col,
        row,
        group.type,
        group.strength,
        pulse,
        SYNERGY_VISUAL.PREVIEW,
      );
    });
  });

  (synergies || []).forEach((syn) => {
    const itemA = uidToItem.get(syn.itemUids[0]);
    const itemB = uidToItem.get(syn.itemUids[1]);
    if (!itemA || !itemB) return;

    const centerA = getItemVisualCenter(itemA, "player");
    const centerB = getItemVisualCenter(itemB, "player");
    const beamColor = syn.strength === "strong"
      ? `rgba(255, 220, 100, ${0.375 + pulse * 0.1})`
      : `rgba(140, 200, 255, ${0.275 + pulse * 0.075})`;
    drawSynergyBeam(ctx, centerA, centerB, beamColor, time, syn.strength === "strong");
  });
}

function drawSynergyBeam(ctx, from, to, color, time, strong) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const wave = Math.sin(time * 10) * (strong ? 8 : 4);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = strong ? 4 : 2.5;
  ctx.shadowColor = strong ? "#ffe066" : "#79c0ff";
  ctx.shadowBlur = glowSize(strong ? 18 : 10);
  ctx.setLineDash([10, 5]);
  ctx.lineDashOffset = -time * 50;

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  const midX = (from.x + to.x) / 2 + nx * wave;
  const midY = (from.y + to.y) / 2 + ny * wave;
  ctx.quadraticCurveTo(midX, midY, to.x, to.y);
  ctx.stroke();

  const dotT = (time * 1.2) % 1;
  ctx.fillStyle = strong ? "#fff3a0" : "#b8dcff";
  ctx.shadowBlur = glowSize(strong ? 14 : 8);
  ctx.beginPath();
  ctx.arc(
    from.x + (to.x - from.x) * dotT,
    from.y + (to.y - from.y) * dotT,
    glowSize(strong ? 6 : 4),
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

function roundRectSynergy(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawSynergyVisuals(ctx, time, previewBuilt, pass, teamFilter) {
  if (typeof phase === "undefined" || phase !== "prep") return;

  if (pass === "under") {
    if (!teamFilter || teamFilter === "player") {
      drawActiveSynergyCellLayer(
        ctx,
        synergyState.activeSynergyCells,
        "player",
        playerItems,
        time,
        "halo",
      );
    }
    if (!teamFilter || teamFilter === "enemy") {
      drawActiveSynergyCellLayer(
        ctx,
        synergyState.enemyActiveSynergyCells,
        "enemy",
        enemyItems,
        time,
        "halo",
      );
    }
    return;
  }

  if (pass === "over") {
    if (!teamFilter || teamFilter === "player") {
      drawActiveSynergyCellLayer(
        ctx,
        synergyState.activeSynergyCells,
        "player",
        playerItems,
        time,
        "surface",
      );

      if (
        synergyState.isDragging
        && synergyState.previewSynergyCells.length
        && previewBuilt
      ) {
        drawPreviewSynergyCellLayer(
          ctx,
          synergyState.previewSynergyCells,
          synergyState.previewSynergies,
          previewBuilt.previewItems,
          time,
        );
      }
    }

    if (!teamFilter || teamFilter === "enemy") {
      drawActiveSynergyCellLayer(
        ctx,
        synergyState.enemyActiveSynergyCells,
        "enemy",
        enemyItems,
        time,
        "surface",
      );
    }
  }
}
