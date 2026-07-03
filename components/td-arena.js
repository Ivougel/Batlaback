/**
 * TdArena — отрисовка tower defense: тропинки, герой в центре, свиньи.
 */

const TdArena = (() => {
  const PATH_COLOR = "rgba(139, 90, 43, 0.55)";
  const PATH_EDGE = "rgba(90, 55, 20, 0.35)";
  const GRASS_LIGHT = "#3d6b35";
  const GRASS_DARK = "#2d5228";

  function drawGrass(ctx, w, h) {
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, GRASS_LIGHT);
    grd.addColorStop(1, GRASS_DARK);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    for (let i = 0; i < 40; i++) {
      const x = ((i * 137) % 100) / 100 * w;
      const y = ((i * 89) % 100) / 100 * h;
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPaths(ctx, w, h) {
    TD_PATHS.forEach((path) => {
      ctx.beginPath();
      path.forEach((pt, i) => {
        const x = pt.x * w;
        const y = pt.y * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = PATH_EDGE;
      ctx.lineWidth = Math.max(18, w * 0.028);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      ctx.beginPath();
      path.forEach((pt, i) => {
        const x = pt.x * w;
        const y = pt.y * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = PATH_COLOR;
      ctx.lineWidth = Math.max(14, w * 0.022);
      ctx.stroke();
    });
  }

  function drawHero(ctx, tdState, w, h, animTime) {
    const cx = TD_CENTER.x * w;
    const cy = TD_CENTER.y * h;
    const cls = typeof getClassById === "function" ? getClassById(tdState.classId) : null;
    const icon = cls?.icon || "🛡️";
    const pulse = 1 + Math.sin(animTime * 3) * 0.04;
    const baseSize = Math.min(w, h) * 0.11 * pulse;

    ctx.save();
    ctx.shadowColor = "rgba(255, 220, 100, 0.45)";
    ctx.shadowBlur = baseSize * 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy, baseSize * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 240, 200, 0.25)";
    ctx.fill();
    ctx.restore();

    if (typeof drawCellEmojiAt === "function") {
      drawCellEmojiAt(ctx, icon, cx, cy, baseSize);
    } else {
      ctx.font = `${baseSize}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(icon, cx, cy);
    }

    const hero = tdState.hero;
    const barW = baseSize * 1.6;
    const barH = Math.max(6, baseSize * 0.12);
    const barX = cx - barW / 2;
    const barY = cy + baseSize * 0.85;
    const hpRatio = Math.max(0, hero.hp / hero.maxHp);

    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = hpRatio > 0.35 ? "#4ade80" : "#ef4444";
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    if (hero.block > 0) {
      ctx.font = `bold ${Math.max(10, baseSize * 0.22)}px system-ui,sans-serif`;
      ctx.fillStyle = "#93c5fd";
      ctx.textAlign = "center";
      ctx.fillText(`🛡${Math.ceil(hero.block)}`, cx, barY - 8);
    }
  }

  function drawPigs(ctx, tdState, w, h) {
    tdState.pigs.forEach((pig) => {
      const pos = tdLerpPath(pig.pathId, pig.t);
      const cx = pos.x * w;
      const cy = pos.y * h;
      const size = Math.min(w, h) * 0.045 * pig.sizeScale;
      const hpRatio = Math.max(0, pig.hp / pig.maxHp);

      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(cx, cy + size * 0.35, size * 0.5, size * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (typeof drawCellEmojiAt === "function") {
        drawCellEmojiAt(ctx, TD_PIG_EMOJI, cx, cy, size);
      } else {
        ctx.font = `${size}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(TD_PIG_EMOJI, cx, cy);
      }

      if (hpRatio < 0.99) {
        const barW = size * 1.1;
        const barH = Math.max(3, size * 0.1);
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(cx - barW / 2, cy - size * 0.75, barW, barH);
        ctx.fillStyle = "#f87171";
        ctx.fillRect(cx - barW / 2, cy - size * 0.75, barW * hpRatio, barH);
      }
    });
  }

  function drawAttackFx(ctx, tdState, w, h) {
    (tdState.attackFx || []).forEach((fx) => {
      const pig = tdState.pigs.find((p) => p.id === fx.targetId);
      if (!pig) return;
      const pos = tdLerpPath(pig.pathId, pig.t);
      const tx = pos.x * w;
      const ty = pos.y * h;
      const cx = TD_CENTER.x * w;
      const cy = TD_CENTER.y * h;
      const alpha = Math.max(0, fx.ttl / 0.35);
      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      if (fx.icon && typeof drawCellEmojiAt === "function") {
        drawCellEmojiAt(ctx, fx.icon, (cx + tx) / 2, (cy + ty) / 2, Math.min(w, h) * 0.035);
      }
      ctx.restore();
    });
  }

  function drawWaveHud(ctx, tdState, w, h) {
    const wave = tdState.wave;
    const alive = tdState.pigs.length;
    const left = tdState.spawnQueue.length + alive;
    const label = `🌊 ${wave}/${TD_MAX_WAVES}`;
    const sub = `🐷 ${left}`;

    ctx.font = `bold ${Math.max(14, w * 0.018)}px system-ui,sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(8, 8, ctx.measureText(label).width + 20, 44);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, 16, 12);
    ctx.font = `${Math.max(12, w * 0.014)}px system-ui,sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(sub, 16, 32);
  }

  function draw(ctx, tdState, w, h, animTime = 0) {
    if (!ctx || !tdState) return;
    drawGrass(ctx, w, h);
    drawPaths(ctx, w, h);
    drawPigs(ctx, tdState, w, h);
    drawAttackFx(ctx, tdState, w, h);
    drawHero(ctx, tdState, w, h, animTime);
    drawWaveHud(ctx, tdState, w, h);
  }

  return { draw };
})();
