/**
 * HTML-overlay для летящих чисел и снарядов — цель: аватар в профиле сбоку.
 */

const battleFloatDomPool = new Map();

function ensureBattleFloatLayer() {
  let layer = document.getElementById("battle-float-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "battle-float-layer";
    layer.className = "battle-float-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
  }
  return layer;
}

function clearBattleFloatLayer() {
  battleFloatDomPool.forEach((el) => el.remove());
  battleFloatDomPool.clear();
  const layer = document.getElementById("battle-float-layer");
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

/** Прямой урон от предмета → аватар противника (красная стрелка). */
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

/** Усталость арены: сверху экрана → аватар (синяя стрелка). */
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

/** DoT яда/огня: чип ДЕБА в центре → аватар владельца дебаффа. */
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

/** Лечение: петля от предмета к своему аватару (зелёная стрелка). */
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
  const row = document.querySelector(`#battle-stats-panel .stat-stamina-cell-${team}`);
  if (row) {
    const bar = row.querySelector(".stat-stamina-bar");
    const rect = (bar || row).getBoundingClientRect();
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

  (state.animations?.failedPopups || []).forEach((popup) => {
    const uid = popup.uid || `fail-${popup.itemUid}`;
    activeIds.add(uid);
    const side = popup.team === "player" ? state.player : state.enemy;
    const item = side?.items?.find((i) => i.uid === popup.itemUid);
    const origin = item && typeof getItemViewportCenter === "function"
      ? getItemViewportCenter(item, popup.team)
      : getBattlefieldCenterViewport();
    const t = Math.min(1, popup.age / popup.maxAge);
    const alpha = t < 0.12 ? t / 0.12 : t > 0.72 ? Math.max(0, 1 - (t - 0.72) / 0.28) : 1;
    const scale = 0.92 + Math.sin(t * Math.PI) * 0.08;
    const html = `<span class="battle-float-failed-icon">${popup.icon}</span><span class="battle-float-failed-label">${popup.label}</span>`;
    const el = upsertBattleFloatEl(
      layer,
      uid,
      `battle-float battle-float-failed-card battle-float-team-${popup.team}`,
      html,
      true,
    );
    applyBattleFloatTransform(el, origin.x, origin.y - t * 16, scale, alpha);
  });

  battleFloatDomPool.forEach((el, uid) => {
    if (activeIds.has(uid)) return;
    el.remove();
    battleFloatDomPool.delete(uid);
  });
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function easeInOutQuint(t) {
  return t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
