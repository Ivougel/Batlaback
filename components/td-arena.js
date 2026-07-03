/**
 * TdArena — отрисовка tower defense на отдельном canvas (#td-arena-canvas).
 */

const TdArena = (() => {
  /** @type {Map<string, HTMLImageElement>} */
  const portraitCache = new Map();
  let mountEl = null;
  let canvasEl = null;
  let ctx = null;

  function init() {
    mountEl = document.getElementById("td-arena-mount");
    canvasEl = document.getElementById("td-arena-canvas");
    ctx = canvasEl?.getContext("2d") || null;
  }

  function setVisible(visible) {
    if (!mountEl) init();
    if (!mountEl) return;
    mountEl.classList.toggle("hidden", !visible);
    mountEl.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible) resize();
  }

  function resize() {
    if (!canvasEl || !mountEl) return;
    const fieldCol = document.getElementById("prep-field-column");
    const w = fieldCol?.clientWidth || mountEl.clientWidth || 800;
    const h = fieldCol?.clientHeight || mountEl.clientHeight || 600;
    if (w <= 0 || h <= 0) return;

    const bitmapW = typeof TD_CANVAS_W === "number" ? TD_CANVAS_W : 960;
    const bitmapH = typeof TD_CANVAS_H === "number" ? TD_CANVAS_H : 640;
    if (canvasEl.width !== bitmapW) canvasEl.width = bitmapW;
    if (canvasEl.height !== bitmapH) canvasEl.height = bitmapH;

    const scale = Math.min(w / bitmapW, h / bitmapH, 1.6);
    const displayW = Math.max(1, Math.floor(bitmapW * scale));
    const displayH = Math.max(1, Math.floor(bitmapH * scale));
    canvasEl.style.width = `${displayW}px`;
    canvasEl.style.height = `${displayH}px`;
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
      ctx2.lineWidth = Math.max(20, w * 0.03);
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
      ctx2.lineWidth = Math.max(15, w * 0.024);
      ctx2.stroke();
    });
  }

  function drawCenterPlatform(ctx2, cx, cy, r) {
    ctx2.save();
    ctx2.beginPath();
    ctx2.arc(cx, cy, r, 0, Math.PI * 2);
    ctx2.fillStyle = "rgba(255, 230, 180, 0.35)";
    ctx2.fill();
    ctx2.strokeStyle = "rgba(180, 140, 60, 0.55)";
    ctx2.lineWidth = 3;
    ctx2.stroke();
    ctx2.restore();
  }

  function drawItemOrbit(ctx2, tdState, cx, cy, heroR) {
    (tdState.attackItems || []).forEach((atk) => {
      const angle = atk.orbitAngle || 0;
      const orbitR = heroR * 1.85;
      const ix = cx + Math.cos(angle) * orbitR;
      const iy = cy + Math.sin(angle) * orbitR * 0.75;
      const def = ITEM_CATALOG?.[atk.itemId];
      const icon = atk.icon || def?.icon || "⚔️";
      const size = heroR * (atk.flashTimer > 0 ? 0.55 : 0.42);

      ctx2.save();
      if (atk.flashTimer > 0) {
        ctx2.shadowColor = "#fbbf24";
        ctx2.shadowBlur = 12;
      }
      if (typeof drawCellEmojiAt === "function") {
        drawCellEmojiAt(ctx2, icon, ix, iy, size);
      }
      ctx2.restore();
    });
  }

  function drawHero(ctx2, tdState, w, h, animTime) {
    const cx = (tdState.map?.center?.x ?? 0.5) * w;
    const cy = (tdState.map?.center?.y ?? 0.5) * h;
    const baseR = Math.min(w, h) * 0.09;
    const pulse = 1 + Math.sin(animTime * 2.5) * 0.03;

    drawCenterPlatform(ctx2, cx, cy, baseR * 1.15 * pulse);

    const portrait = loadPortrait(tdState.classId);
    const drawR = baseR * 1.05 * pulse;
    if (portrait?.complete && portrait.naturalWidth > 0) {
      ctx2.save();
      ctx2.beginPath();
      ctx2.arc(cx, cy, drawR, 0, Math.PI * 2);
      ctx2.clip();
      ctx2.drawImage(portrait, cx - drawR, cy - drawR * 1.15, drawR * 2, drawR * 2.2);
      ctx2.restore();
    } else {
      const cls = typeof getClassById === "function" ? getClassById(tdState.classId) : null;
      const icon = cls?.icon || "🛡️";
      if (typeof drawCellEmojiAt === "function") {
        drawCellEmojiAt(ctx2, icon, cx, cy, drawR * 1.6);
      }
    }

    drawItemOrbit(ctx2, tdState, cx, cy, drawR);

    const hero = tdState.hero;
    const barW = baseR * 2.4;
    const barH = Math.max(7, baseR * 0.14);
    const barX = cx - barW / 2;
    const barY = cy + drawR + 14;
    const hpRatio = Math.max(0, hero.hp / hero.maxHp);

    ctx2.fillStyle = "rgba(0,0,0,0.5)";
    ctx2.fillRect(barX, barY, barW, barH);
    ctx2.fillStyle = hpRatio > 0.35 ? "#4ade80" : "#ef4444";
    ctx2.fillRect(barX, barY, barW * hpRatio, barH);
    ctx2.strokeStyle = "rgba(255,255,255,0.4)";
    ctx2.lineWidth = 1;
    ctx2.strokeRect(barX, barY, barW, barH);

    ctx2.font = `bold ${Math.max(11, baseR * 0.28)}px system-ui,sans-serif`;
    ctx2.fillStyle = "#fff";
    ctx2.textAlign = "center";
    ctx2.fillText(`${Math.ceil(hero.hp)}/${hero.maxHp}`, cx, barY + barH + 14);

    if (hero.block > 0) {
      ctx2.fillStyle = "#93c5fd";
      ctx2.fillText(`🛡${Math.ceil(hero.block)}`, cx, barY - 6);
    }
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

  function drawAttackFx(ctx2, tdState, w, h) {
    const cx = (tdState.map?.center?.x ?? 0.5) * w;
    const cy = (tdState.map?.center?.y ?? 0.5) * h;
    (tdState.attackFx || []).forEach((fx) => {
      const pig = tdState.pigs.find((p) => p.id === fx.targetId);
      if (!pig) return;
      const pos = tdLerpPath(tdState, pig.pathId, pig.t);
      const tx = pos.x * w;
      const ty = pos.y * h;
      const alpha = Math.max(0, fx.ttl / 0.4);
      const atk = tdState.attackItems.find((a) => a.uid === fx.uid || a.itemId === fx.itemId);

      ctx2.save();
      ctx2.globalAlpha = alpha;
      ctx2.strokeStyle = "#fbbf24";
      ctx2.lineWidth = 3;
      ctx2.beginPath();
      if (atk) {
        const angle = atk.orbitAngle || 0;
        const orbitR = Math.min(w, h) * 0.09 * 1.85;
        ctx2.moveTo(cx + Math.cos(angle) * orbitR, cy + Math.sin(angle) * orbitR * 0.75);
      } else {
        ctx2.moveTo(cx, cy);
      }
      ctx2.lineTo(tx, ty);
      ctx2.stroke();
      if (fx.icon && typeof drawCellEmojiAt === "function") {
        drawCellEmojiAt(ctx2, fx.icon, (tx + cx) / 2, (ty + cy) / 2, Math.min(w, h) * 0.04);
      }
      if (fx.damage) {
        ctx2.font = `bold ${Math.max(12, w * 0.016)}px system-ui,sans-serif`;
        ctx2.fillStyle = "#fef08a";
        ctx2.textAlign = "center";
        ctx2.fillText(`-${fx.damage}`, tx, ty - Math.min(w, h) * 0.03);
      }
      ctx2.restore();
    });
  }

  function drawWaveHud(ctx2, tdState, w, h) {
    const wave = tdState.wave;
    const alive = tdState.pigs.length;
    const left = tdState.spawnQueue.length + alive;
    const diffId = tdState.difficultyId || "normal";
    const diff = typeof getTdDifficulty === "function" ? getTdDifficulty(diffId) : null;
    const diffTag = diff ? `${diff.emoji} ${diff.label}` : "";
    const label = `🌊 ${wave}/${TD_MAX_WAVES}`;
    const sub = `🐷 ${left}${diffTag ? ` · ${diffTag}` : ""}`;

    ctx2.font = `bold ${Math.max(14, w * 0.018)}px system-ui,sans-serif`;
    ctx2.textAlign = "left";
    ctx2.textBaseline = "top";
    const padW = Math.max(ctx2.measureText(label).width, ctx2.measureText(sub).width) + 24;
    const boxH = diffTag ? 46 : 46;
    ctx2.fillStyle = "rgba(0,0,0,0.55)";
    ctx2.fillRect(8, 8, padW, boxH);
    ctx2.fillStyle = "#fff";
    ctx2.fillText(label, 16, 12);
    ctx2.font = `${Math.max(12, w * 0.014)}px system-ui,sans-serif`;
    ctx2.fillStyle = "rgba(255,255,255,0.85)";
    ctx2.fillText(sub, 16, 32);
  }

  function drawFrame(tdState, animTime = 0) {
    if (!ctx || !canvasEl || !tdState) return;
    const w = canvasEl.width;
    const h = canvasEl.height;
    ctx.clearRect(0, 0, w, h);
    drawGrass(ctx, tdState, w, h);
    drawDecor(ctx, tdState, w, h);
    drawPaths(ctx, tdState, w, h);
    drawPigs(ctx, tdState, w, h);
    drawAttackFx(ctx, tdState, w, h);
    drawHero(ctx, tdState, w, h, animTime);
    drawWaveHud(ctx, tdState, w, h);
  }

  /** @deprecated — совместимость с game-canvas */
  function draw(ctx2, tdState, w, h, animTime = 0) {
    drawFrame(tdState, animTime);
  }

  return { init, setVisible, resize, draw, drawFrame, loadPortrait };
})();
