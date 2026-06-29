/**
 * Battle Float Layer — летящие числа урона, лечения, emoji-реакции.
 * Все элементы рендерятся в #battle-float-layer (position: fixed, z-index 9999).
 */

const battleFloatDomPool = new Map();

const floatLayer = (() => {
  function getLayer() {
    return document.getElementById("battle-float-layer");
  }

  function spawn(text, cssClass, vx, vy, opts = {}) {
    const layer = getLayer();
    if (!layer) return null;

    const el = document.createElement("div");
    el.className = `battle-float ${cssClass}`;
    el.textContent = text;
    el.style.left = `${vx}px`;
    el.style.top = `${vy}px`;
    layer.appendChild(el);

    const hasFlyTarget = opts.toVx != null && opts.toVy != null;
    const keyframes = hasFlyTarget
      ? [
        { transform: "translateX(-50%) scale(1)", opacity: 1, left: `${vx}px`, top: `${vy}px` },
        { transform: "translateX(-50%) scale(0.7)", opacity: 0.2, left: `${opts.toVx}px`, top: `${opts.toVy}px` },
      ]
      : [
        { transform: "translateX(-50%) translateY(0) scale(1.2)", opacity: 1 },
        { transform: "translateX(-50%) translateY(-56px) scale(0.9)", opacity: 0 },
      ];

    const duration = hasFlyTarget ? 550 : 900;
    el.animate(keyframes, {
      duration,
      easing: "ease-out",
      fill: "forwards",
    }).finished.then(() => el.remove()).catch(() => el.remove());
    return el;
  }

  function canvasToViewport(canvas, cx, cy) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { vx: rect.left, vy: rect.top };
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    return {
      vx: rect.left + cx * scaleX,
      vy: rect.top + cy * scaleY,
    };
  }

  function cellCenterViewport(canvas, team, col, row) {
    if (typeof cellRect === "function") {
      const rect = cellRect(team, col, row);
      return canvasToViewport(canvas, rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    const layout = window._battleLayout;
    if (!layout) return { vx: 0, vy: 0 };
    const { CELL, BACKPACK_Y, gridOrigin } = layout;
    const stride = typeof GRID_STRIDE !== "undefined" ? GRID_STRIDE : CELL;
    const cx = gridOrigin(team) + col * stride + CELL / 2;
    const cy = BACKPACK_Y + row * stride + CELL / 2;
    return canvasToViewport(canvas, cx, cy);
  }

  function spawnDamage(canvas, team, col, row, amount) {
    const { vx, vy } = cellCenterViewport(canvas, team, col, row);
    spawn(`−${amount}`, "damage", vx, vy);
  }

  function spawnHeal(canvas, team, col, row, amount) {
    const { vx, vy } = cellCenterViewport(canvas, team, col, row);
    spawn(`+${amount}`, "heal", vx, vy);
  }

  function spawnEmotion(emoji, anchorEl, opts = {}) {
    let vx;
    let vy;
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      vx = rect.left + rect.width / 2;
      vy = rect.top - 8;
    } else {
      vx = opts.vx ?? 0;
      vy = opts.vy ?? 0;
    }
    spawn(emoji, "emotion", vx, vy, opts);
  }

  function spawnEmotionFly(canvas, emoji, fromTeam, fromCol, fromRow, toTeam, toCol, toRow) {
    const from = cellCenterViewport(canvas, fromTeam, fromCol, fromRow);
    const to = cellCenterViewport(canvas, toTeam, toCol, toRow);
    spawn(emoji, "emotion", from.vx, from.vy, { toVx: to.vx, toVy: to.vy });
  }

  return {
    spawn,
    spawnDamage,
    spawnHeal,
    spawnEmotion,
    spawnEmotionFly,
    canvasToViewport,
  };
})();

function ensureBattleFloatLayer() {
  return document.getElementById("battle-float-layer");
}

function clearBattleFloatLayer() {
  battleFloatDomPool.forEach((el) => el.remove());
  battleFloatDomPool.clear();
  const layer = ensureBattleFloatLayer();
  if (layer) layer.innerHTML = "";
}

function getBattleCanvasEl() {
  return document.getElementById("game-canvas");
}

function quadraticBezier(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function cubicBezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const uu = u * u;
  const uuu = uu * u;
  const tt = t * t;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

function getArcControlPoint(from, to, targetTeam) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const lift = Math.max(56, dist * 0.48);
  const side = targetTeam === "player" ? -1 : targetTeam === "enemy" ? 1 : (to.x < from.x ? -1 : 1);
  return {
    x: midX + side * dist * 0.14,
    y: midY - lift,
  };
}

function getWeaponControlPoint(from, to, targetTeam) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const lift = Math.max(28, dist * 0.12);
  const side = targetTeam === "player" ? -1 : targetTeam === "enemy" ? 1 : (to.x < from.x ? -1 : 1);
  return {
    x: midX + side * dist * 0.06,
    y: midY - lift,
  };
}

function getFatigueOriginViewport(targetTeam) {
  const canvas = getBattleCanvasEl();
  const avatar = getProfileAvatarViewportCenter(targetTeam);
  if (!canvas) {
    return { x: avatar.x, y: Math.max(48, avatar.y - window.innerHeight * 0.42) };
  }
  const rect = canvas.getBoundingClientRect();
  const bias = targetTeam === "player" ? -0.12 : targetTeam === "enemy" ? 0.12 : 0;
  return {
    x: rect.left + rect.width * (0.5 + bias),
    y: rect.top + rect.height * 0.04,
  };
}

function getFatigueControlPoint(from, to) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) * 0.42 + to.y * 0.58;
  return { x: midX, y: midY };
}

function getDebuffDotControlPoint(from, to, targetTeam) {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const outward = targetTeam === "player" ? -1 : 1;
  const bulge = Math.min(52, dist * 0.24);
  return {
    x: midX + outward * bulge * 0.35,
    y: midY + Math.min(32, dist * 0.14),
  };
}

function getHealLoopControls(from, to, targetTeam) {
  const outward = targetTeam === "player" ? -1 : 1;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const loop = Math.max(72, dist * 0.38);
  const lift = Math.max(36, dist * 0.16);
  return {
    c1: {
      x: from.x + outward * loop,
      y: from.y - lift * 0.55,
    },
    c2: {
      x: to.x + outward * loop * 0.55,
      y: to.y - lift,
    },
  };
}

function sampleFloatTrajectory(trajectory, from, to, targetTeam, t) {
  switch (trajectory) {
    case "weapon":
      return quadraticBezier(from, getWeaponControlPoint(from, to, targetTeam), to, t);
    case "fatigue":
      return quadraticBezier(from, getFatigueControlPoint(from, to), to, t);
    case "debuff-dot":
      return quadraticBezier(from, getDebuffDotControlPoint(from, to, targetTeam), to, t);
    case "heal-loop": {
      const { c1, c2 } = getHealLoopControls(from, to, targetTeam);
      return cubicBezier(from, c1, c2, to, t);
    }
    default:
      return quadraticBezier(from, getArcControlPoint(from, to, targetTeam), to, t);
  }
}

function getBattlefieldCenterViewport() {
  if (typeof getTeamGridCenter === "function") {
    const player = getTeamGridCenter("player");
    const enemy = getTeamGridCenter("enemy");
    const cell = typeof GRID_CELL !== "undefined" ? GRID_CELL : 30;
    const topY = typeof GRID_TOP_Y !== "undefined" ? GRID_TOP_Y : 24;
    const cx = (player.x + enemy.x) / 2;
    const cy = topY + cell * 0.25;
    return canvasPointToViewport(cx, cy);
  }
  const canvas = getBattleCanvasEl();
  if (!canvas) return { x: window.innerWidth / 2, y: window.innerHeight * 0.28 };
  const rect = canvas.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.1 };
}

function getBattleStatsStaminaBarCenter(team) {
  const slotId = team === "player" ? "player-avatar-slot" : "enemy-avatar-slot";
  const bar = document.querySelector(`#${slotId} .avatar-hero-stamina-bar`);
  if (bar) {
    const rect = bar.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }
  const row = document.querySelector(`#battle-stats-panel .stat-stamina-cell-${team}`);
  if (row) {
    const staminaBar = row.querySelector(".stat-stamina-bar");
    const rect = (staminaBar || row).getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return getBattleStatsPanelCenter();
}

function getBattleStatsPanelCenter() {
  const panel = document.getElementById("battle-stats-panel");
  if (!panel || panel.offsetParent === null) return getBattlefieldCenterViewport();
  const rect = panel.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height * 0.28,
  };
}

function getItemViewportCenter(item, team) {
  if (!item || typeof getItemCells !== "function" || typeof cellRect !== "function") {
    return getBattlefieldCenterViewport();
  }
  const cells = getItemCells(item);
  if (!cells.length) return getBattlefieldCenterViewport();
  let sx = 0;
  let sy = 0;
  cells.forEach(([c, r]) => {
    const rect = cellRect(team, c, r);
    sx += rect.x + rect.w / 2;
    sy += rect.y + rect.h / 2;
  });
  return canvasPointToViewport(sx / cells.length, sy / cells.length);
}

function resolveFloatOriginViewport(options = {}, kind = "damage", targetTeam = "enemy") {
  if (options.trajectory === "fatigue") {
    return getFatigueOriginViewport(targetTeam);
  }
  if (options.fromDebuffChip || options.trajectory === "debuff-dot") {
    return getProfileDebuffChipCenter(targetTeam, options.fromDebuffChip || "poison");
  }
  if (options.item && typeof getItemViewportCenter === "function") {
    const itemTeam = options.sourceTeam || targetTeam;
    return getItemViewportCenter(options.item, itemTeam);
  }
  if (kind === "positive") {
    return getBattleStatsPanelCenter();
  }
  return getBattlefieldCenterViewport();
}

function canvasPointToViewport(x, y) {
  const canvas = getBattleCanvasEl();
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return { x: rect.left, y: rect.top };
  return {
    x: rect.left + (x / canvas.width) * rect.width,
    y: rect.top + (y / canvas.height) * rect.height,
  };
}

function getProfileDebuffChipCenter(team, debuffId) {
  const colClass = team === "player" ? ".stats-col-player" : ".stats-col-enemy";
  const chip = document.querySelector(`#battle-stats-panel ${colClass} .status-debuffs [data-status-id="${debuffId}"]`);
  if (chip) {
    const rect = chip.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }
  const section = document.querySelector(`#battle-stats-panel ${colClass} .status-debuffs`);
  if (section) {
    const rect = section.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return getProfileAvatarViewportCenter(team);
}

function getProfileAvatarViewportCenter(team) {
  const avatarId = team === "player" ? "player-avatar-panel" : "enemy-avatar-panel";
  const avatar = document.querySelector(`#${avatarId} .profile-avatar`);
  if (avatar) {
    const rect = avatar.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  const fallback = getTeamGridCenter(team);
  return canvasPointToViewport(fallback.x, fallback.y);
}

function getFloatAlpha(fn) {
  if (fn.delay && fn.age < fn.delay) return 0;
  const effectiveAge = fn.delay ? fn.age - fn.delay : fn.age;
  const effectiveMax = fn.maxAge || 1;
  const fadeStart = fn.kind === "positive" ? 0.72 : 0.68;
  const progress = effectiveAge / effectiveMax;
  if (progress < fadeStart) return 1;
  const fade = (progress - fadeStart) / (1 - fadeStart);
  return Math.max(0, 1 - fade * fade);
}

function applyBattleFloatTransform(el, x, y, scale, alpha) {
  el.style.opacity = String(Math.max(0, Math.min(1, alpha)));
  el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`;
}

function upsertBattleFloatEl(layer, uid, className, content, asHtml = false) {
  let el = battleFloatDomPool.get(uid);
  if (!el) {
    el = document.createElement("div");
    el.className = className;
    el.dataset.floatUid = uid;
    battleFloatDomPool.set(uid, el);
    layer.appendChild(el);
  } else if (el.className !== className) {
    el.className = className;
  }
  if (asHtml) {
    if (el.innerHTML !== content) el.innerHTML = content;
  } else if (el.textContent !== content) {
    el.textContent = content;
  }
  return el;
}

function renderBattleEffectsOverlay(state) {
  const layer = ensureBattleFloatLayer();
  if (!layer) return;
  if (!state) {
    clearBattleFloatLayer();
    return;
  }

  const activeIds = new Set();

  (state.floatingNumbers || []).forEach((fn) => {
    const uid = fn.uid || fn.text;
    activeIds.add(uid);
    const alpha = getFloatAlpha(fn);
    const magnitude = fn.magnitude ?? parseFloatingMagnitude(fn.text);
    const scale = getFloatingScale(magnitude);
    const pulse = 1 + Math.sin(Math.min(1, fn.age / fn.maxAge) * Math.PI) * 0.04;
    const color = fn.color || "#f85149";
    const isFailed = fn.kind === "failed";
    const isStamina = fn.kind === "stamina";
    const className = isFailed
      ? `battle-float battle-float-failed battle-float-team-${fn.itemTeam || fn.sourceTeam || "player"}`
      : isStamina
        ? `battle-float battle-float-stamina battle-float-team-${fn.itemTeam || fn.sourceTeam || "player"}`
        : `battle-float battle-float-${fn.kind || "damage"} battle-float-target-${fn.team || "enemy"}${fn.anchorMode === "hero-above" ? " battle-float-hero-above" : ""}`;
    const el = upsertBattleFloatEl(layer, uid, className, fn.text, false);
    el.style.setProperty("--bf-color", color);
    applyBattleFloatTransform(el, fn.x, fn.y, scale * pulse, alpha);
  });

  battleFloatDomPool.forEach((el, uid) => {
    if (activeIds.has(uid)) return;
    el.remove();
    battleFloatDomPool.delete(uid);
  });
}
