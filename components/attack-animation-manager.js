/**
 * AttackAnimationManager — визуальный слой атак (не влияет на урон/баланс).
 * Снаряды летят от ячейки предмета в инвентаре к аватару цели. DOM-пул объектов.
 */

const ATTACK_FX_MAX = 48;
const attackFxPool = [];
const attackFxActive = new Map();

function ensureAttackFxLayer() {
  let layer = document.getElementById("attack-fx-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "attack-fx-layer";
    layer.className = "attack-fx-layer";
    layer.setAttribute("aria-hidden", "true");
    appendToLayerFx(layer);
  }
  return layer;
}

function clearAttackFxLayer() {
  attackFxActive.forEach((el) => releaseAttackFxEl(el));
  attackFxActive.clear();
  const layer = document.getElementById("attack-fx-layer");
  if (layer) layer.innerHTML = "";
}

function acquireAttackFxEl(className) {
  let el = attackFxPool.pop();
  if (!el) {
    el = document.createElement("div");
  }
  el.className = className;
  el.style.opacity = "";
  el.style.removeProperty("--afx-rot");
  return el;
}

function releaseAttackFxEl(el) {
  if (!el) return;
  el.remove();
  if (attackFxPool.length < ATTACK_FX_MAX) attackFxPool.push(el);
}

function getAttackFxOrigin(fx, state) {
  if (state && fx?.sourceItemUid && typeof getItemViewportCenter === "function") {
    const side = fx.sourceTeam === "player" ? state.player : state.enemy;
    const item = side?.items?.find((i) => i.uid === fx.sourceItemUid);
    if (item) return getItemViewportCenter(item, fx.sourceTeam);
  }
  const team = fx?.sourceTeam || "player";
  if (typeof getProfileAvatarFloatAnchor === "function") {
    const pt = getProfileAvatarFloatAnchor(team, 0);
    return { x: pt.x, y: pt.y + 28 };
  }
  if (typeof getProfileAvatarViewportCenter === "function") {
    const c = getProfileAvatarViewportCenter(team);
    return { x: c.x, y: c.y + 20 };
  }
  return { x: window.innerWidth * (team === "player" ? 0.22 : 0.78), y: window.innerHeight * 0.32 };
}

function getAttackFxTarget(team) {
  if (typeof getProfileAvatarViewportCenter === "function") {
    return getProfileAvatarViewportCenter(team);
  }
  return getAttackFxOrigin(team);
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function sampleAttackTrajectory(attackType, from, to, targetTeam, t) {
  if (attackType === "melee") {
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 36 };
    const pt = typeof quadraticBezier === "function"
      ? quadraticBezier(from, mid, to, t)
      : { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    const pt2 = typeof quadraticBezier === "function"
      ? quadraticBezier(from, mid, to, Math.min(1, t + 0.04))
      : pt;
    const angle = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * (180 / Math.PI);
    return { ...pt, angle, scale: 0.85 + t * 0.35 };
  }
  if (attackType === "projectile" || attackType === "magic") {
    const cp = typeof getWeaponControlPoint === "function"
      ? getWeaponControlPoint(from, to, targetTeam)
      : { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 48 };
    const pt = typeof quadraticBezier === "function"
      ? quadraticBezier(from, cp, to, t)
      : { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    const pt2 = typeof quadraticBezier === "function"
      ? quadraticBezier(from, cp, to, Math.min(1, t + 0.03))
      : pt;
    const angle = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * (180 / Math.PI);
    const lift = attackType === "magic" ? 1.08 : 1;
    return { ...pt, angle, scale: (0.9 + Math.sin(t * Math.PI) * 0.18) * lift };
  }
  if (attackType === "aoe") {
    return { x: to.x, y: to.y, angle: 0, scale: 0.4 + t * 1.6, alpha: 1 - t * 0.85 };
  }
  return {
    x: from.x + (to.x - from.x) * easeInOutQuad(t),
    y: from.y + (to.y - from.y) * easeInOutQuad(t) - Math.sin(t * Math.PI) * 24,
    angle: 0,
    scale: 0.95 + Math.sin(t * Math.PI) * 0.1,
  };
}

function initAttackVisuals(state) {
  if (!state.attackVisuals) state.attackVisuals = [];
}

function enqueueAttackVisual(state, event) {
  initAttackVisuals(state);
  if (state.attackVisuals.length >= ATTACK_FX_MAX) {
    state.attackVisuals.shift();
  }
  state.attackVisuals.push({
    ...event,
    age: -(event.delay || 0),
    maxAge: (event.duration || 0.5) + (event.delay || 0),
  });
}

function tickAttackVisuals(state, dt) {
  if (!state?.attackVisuals?.length) return;
  state.attackVisuals = state.attackVisuals
    .map((fx) => ({ ...fx, age: fx.age + dt }))
    .filter((fx) => fx.age < fx.maxAge);
}

function applyAttackFxTransform(el, x, y, scale, angle, alpha) {
  el.style.opacity = String(Math.max(0, Math.min(1, alpha)));
  el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${angle || 0}deg) scale(${scale})`;
}

function renderAttackVisuals(state) {
  if (!state?.attackVisuals?.length) {
    if (attackFxActive.size > 0) clearAttackFxLayer();
    return;
  }

  const layer = ensureAttackFxLayer();
  const activeIds = new Set();

  state.attackVisuals.forEach((fx) => {
    if (fx.age < 0) return;
    activeIds.add(fx.id);

    const from = getAttackFxOrigin(fx, state);
    const to = getAttackFxTarget(fx.targetTeam);
    const rawT = fx.age / (fx.duration || 0.5);
    const t = easeOutCubic(Math.min(1, rawT));
    const pt = sampleAttackTrajectory(fx.attackType, from, to, fx.targetTeam, t);

    let className = `attack-fx attack-fx-${fx.attackType} attack-fx-visual-${fx.visual || "slash"}`;
    className += fx.effects?.crit ? " attack-fx-crit" : "";
    className += fx.effects?.miss ? " attack-fx-miss" : "";
    if (fx.sourceTeam) className += ` attack-fx-team-${fx.sourceTeam}`;

    let el = attackFxActive.get(fx.id);
    if (!el) {
      el = acquireAttackFxEl(className);
      el.dataset.fxUid = fx.id;
      if (fx.attackType === "aoe") {
        el.innerHTML = `<span class="attack-fx-aoe-ring"></span><span class="attack-fx-aoe-icon">${typeof firstItemIconGrapheme === "function" ? firstItemIconGrapheme(fx.icon) : fx.icon}</span>`;
      } else if (fx.attackType === "melee") {
        el.innerHTML = `<span class="attack-fx-melee-slash">${typeof firstItemIconGrapheme === "function" ? firstItemIconGrapheme(fx.icon) : fx.icon}</span>`;
      } else {
        el.textContent = typeof firstItemIconGrapheme === "function" ? firstItemIconGrapheme(fx.icon) : fx.icon;
      }
      layer.appendChild(el);
      attackFxActive.set(fx.id, el);
    } else if (el.className !== className) {
      el.className = className;
    }

    const alpha = fx.attackType === "aoe"
      ? (pt.alpha ?? (1 - rawT * 0.9))
      : rawT < 0.08 ? rawT / 0.08 : rawT > 0.88 ? Math.max(0, 1 - (rawT - 0.88) / 0.12) : 1;

    applyAttackFxTransform(el, pt.x, pt.y, pt.scale || 1, pt.angle || 0, alpha);
  });

  attackFxActive.forEach((el, uid) => {
    if (activeIds.has(uid)) return;
    releaseAttackFxEl(el);
    attackFxActive.delete(uid);
  });
}
