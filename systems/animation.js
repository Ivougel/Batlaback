/**
 * Анимации боя: вспышки, пульсация предметов, летящие числа (HTML-overlay).
 */

const PROJECTILE_DURATION = 1.5;

function initBattleAnimations(state) {
  state.animations = {
    projectiles: [],
    pulses: [],
    flashes: [],
    failedPopups: [],
  };
}

function parseFloatingMagnitude(text) {
  const match = String(text).match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 1;
}

function getFloatingScale(magnitude) {
  const mag = Math.max(1, magnitude || 1);
  return Math.min(2.5, 0.88 + Math.log2(mag + 1) * 0.42);
}

function classifyFloatingText(text) {
  const t = String(text);
  if (t.includes("Неудачно")) return "failed";
  if (t.includes("MISS")) return "miss";
  if (/^\+|\+.*[❤🛡]|[❤🛡].*\+/.test(t)) return "positive";
  if (t.includes("☠") || t.includes("яд") || t.includes("🐌") || /огонь/i.test(t)) return "debuff";
  if (t.includes("−") || t.startsWith("-")) return "damage";
  return "damage";
}

function getAvatarOriginViewport(team, spreadX = 14, spreadY = 10) {
  const center = getProfileAvatarViewportCenter(team);
  return {
    x: center.x + (Math.random() - 0.5) * spreadX,
    y: center.y + (Math.random() - 0.5) * spreadY,
  };
}

function resolveFloatTeams(options = {}, kind = "damage") {
  const sourceTeam = options.sourceTeam || null;

  if (kind === "positive") {
    const beneficiary = options.targetTeam || sourceTeam || "player";
    return { originTeam: beneficiary, targetTeam: beneficiary };
  }

  const targetTeam = options.targetTeam
    || (sourceTeam === "player" ? "enemy" : sourceTeam === "enemy" ? "player" : null)
    || "enemy";
  const originTeam = sourceTeam || (targetTeam === "player" ? "enemy" : "player");
  return { originTeam, targetTeam };
}

function resolveFloatingEndpointsCanvas(options = {}) {
  const kind = options.kind || "damage";
  const { originTeam, targetTeam } = resolveFloatTeams(options, kind);
  const from = getAvatarOriginViewport(originTeam);
  return {
    fromX: from.x,
    fromY: from.y,
    targetTeam,
  };
}

function spawnBattleFloat(state, text, color, options = {}) {
  state.floatingNumbers = state.floatingNumbers || [];
  state._floatUid = (state._floatUid || 0) + 1;
  const kind = options.kind || classifyFloatingText(text);
  const magnitude = options.magnitude ?? parseFloatingMagnitude(text);
  const { originTeam, targetTeam } = resolveFloatTeams(options, kind);

  const fromVp = resolveFloatOriginViewport(options, kind, targetTeam);
  const spread = options.fromDebuffChip ? 0 : 12;
  if (spread) {
    fromVp.x += (Math.random() - 0.5) * spread;
    fromVp.y += (Math.random() - 0.5) * spread * 0.6;
  }
  const toVp = getProfileAvatarViewportCenter(targetTeam);
  const controlVp = getArcControlPoint(fromVp, toVp, targetTeam);

  state.floatingNumbers.push({
    uid: `float-${state._floatUid}`,
    fromX: fromVp.x,
    fromY: fromVp.y,
    controlX: controlVp.x,
    controlY: controlVp.y,
    toX: toVp.x,
    toY: toVp.y,
    x: fromVp.x,
    y: fromVp.y,
    text,
    color: color || "#f85149",
    age: 0,
    maxAge: options.maxAge ?? 5.5,
    magnitude,
    kind,
    team: targetTeam,
    sourceTeam: options.fromDebuffChip ? null : originTeam,
    debuffId: options.fromDebuffChip || null,
    itemUid: options.item?.uid || null,
    itemTeam: options.sourceTeam || originTeam,
    delay: options.delay ?? 0,
    spawnAtTarget: options.spawnAtTarget ?? false,
    stayInPlace: options.stayInPlace ?? (kind === "failed" || kind === "stamina"),
  });
}

function getItemProjectileTargetTeam(item, team) {
  const def = ITEM_CATALOG[item.itemId];
  const effects = (def.effects || []).filter((e) => e.trigger !== "passive");
  const targetsFoe = effects.some((e) =>
    ["damage", "poison", "slow"].includes(e.type) || e.type === "groundFire",
  );
  const targetsSelf = effects.some((e) => ["heal", "block"].includes(e.type));
  if (targetsSelf && !targetsFoe) return team;
  return team === "player" ? "enemy" : "player";
}

function getProjectileFromViewport(state, projectile) {
  const side = projectile.team === "player" ? state.player : state.enemy;
  const item = side?.items?.find((i) => i.uid === projectile.itemUid);
  if (item && typeof getItemViewportCenter === "function") {
    return getItemViewportCenter(item, projectile.team);
  }
  if (projectile.fromCol != null && typeof cellRect === "function") {
    const rect = cellRect(projectile.team, projectile.fromCol, projectile.fromRow);
    return canvasPointToViewport(rect.x + rect.w / 2, rect.y + rect.h / 2);
  }
  return { x: projectile.fromX, y: projectile.fromY };
}

function getFloatItemOriginViewport(state, fn) {
  if (!fn.itemUid || !fn.itemTeam) return null;
  const side = fn.itemTeam === "player" ? state.player : state.enemy;
  const item = side?.items?.find((i) => i.uid === fn.itemUid);
  if (item && typeof getItemViewportCenter === "function") {
    return getItemViewportCenter(item, fn.itemTeam);
  }
  return null;
}

function queueItemFailedAnimation(state, item, team, _staminaCost) {
  if (!state.animations) initBattleAnimations(state);
  const def = ITEM_CATALOG[item.itemId];
  state._floatUid = (state._floatUid || 0) + 1;
  state.animations.failedPopups.push({
    uid: `fail-${state._floatUid}`,
    icon: def?.icon || "⚔",
    label: "Неудачно",
    itemUid: item.uid,
    team,
    age: 0,
    maxAge: 1.15,
  });
  state.animations.flashes.push({
    itemUid: item.uid,
    team,
    age: 0,
    maxAge: 0.55,
    failed: true,
  });
}

function queueStaminaSpendFeedback(state, team, amount, item) {
  spawnBattleFloat(state, `−${amount}`, "#d29922", {
    sourceTeam: team,
    item,
    kind: "stamina",
    maxAge: 0.85,
    stayInPlace: true,
  });
}

function queueItemAttackAnimation(state, item, team) {
  if (!state.animations) initBattleAnimations(state);
  const def = ITEM_CATALOG[item.itemId];
  const targetTeam = getItemProjectileTargetTeam(item, team);
  const fromVp = typeof getItemViewportCenter === "function"
    ? getItemViewportCenter(item, team)
    : getAvatarOriginViewport(team, 10, 8);
  fromVp.x += (Math.random() - 0.5) * 6;
  fromVp.y += (Math.random() - 0.5) * 4;

  state._floatUid = (state._floatUid || 0) + 1;
  state.animations.projectiles.push({
    uid: `proj-${state._floatUid}`,
    icon: def.icon,
    itemUid: item.uid,
    fromCol: item.col,
    fromRow: item.row,
    fromX: fromVp.x,
    fromY: fromVp.y,
    toTeam: targetTeam,
    progress: 0,
    duration: PROJECTILE_DURATION,
    team,
  });

  state.animations.pulses.push({
    itemUid: item.uid,
    team,
    col: item.col,
    row: item.row,
    age: 0,
    maxAge: 0.4,
    scale: 1.25,
  });

  state.animations.flashes.push({
    itemUid: item.uid,
    team,
    age: 0,
    maxAge: 0.25,
  });
}

function queueHitAnimation(state, item, team, text, color) {
  if (!state.animations) initBattleAnimations(state);
  const kind = classifyFloatingText(text);
  const hitsOnTarget = kind === "damage" || kind === "debuff" || kind === "miss";

  spawnBattleFloat(state, text, color, {
    sourceTeam: team,
    item,
    kind,
    delay: hitsOnTarget ? PROJECTILE_DURATION : 0,
    spawnAtTarget: hitsOnTarget,
    maxAge: hitsOnTarget ? 1.8 : 5.5,
  });

  if (item) {
    state.animations.flashes.push({
      itemUid: item.uid,
      team,
      age: 0,
      maxAge: 0.2,
    });
  }
}

function getTeamGridCenter(team) {
  const innerW = typeof GRID_INNER_W !== "undefined"
    ? GRID_INNER_W
    : (typeof GRID_COLS !== "undefined" ? GRID_COLS : 9)
      * (typeof GRID_CELL !== "undefined" ? GRID_CELL : 88)
      + ((typeof GRID_COLS !== "undefined" ? GRID_COLS : 9) - 1)
      * (typeof GRID_CELL_GAP !== "undefined" ? GRID_CELL_GAP : 4);
  const innerH = typeof GRID_INNER_H !== "undefined"
    ? GRID_INNER_H
    : (typeof GRID_ROWS !== "undefined" ? GRID_ROWS : 7)
      * (typeof GRID_CELL !== "undefined" ? GRID_CELL : 88)
      + ((typeof GRID_ROWS !== "undefined" ? GRID_ROWS : 7) - 1)
      * (typeof GRID_CELL_GAP !== "undefined" ? GRID_CELL_GAP : 4);
  const originX = typeof GRID_PLAYER_X !== "undefined" ? GRID_PLAYER_X : 8;
  const gap = typeof GRID_GAP !== "undefined" ? GRID_GAP : 96;
  const topY = typeof BACKPACK_Y !== "undefined" ? BACKPACK_Y : 8;
  const ox = team === "player"
    ? originX
    : (typeof ENEMY_X !== "undefined" ? ENEMY_X : originX + innerW + gap);
  return { x: ox + innerW / 2, y: topY + innerH / 2 };
}

function tickFloatingNumbers(state, dt) {
  if (!state?.floatingNumbers) return;
  state.floatingNumbers = state.floatingNumbers
    .map((fn) => {
      const age = fn.age + dt;
      const delay = fn.delay || 0;
      const maxAge = fn.maxAge || 1;
      const liveTo = getProfileAvatarViewportCenter(fn.team);

      if (age < delay) {
        return { ...fn, age, x: liveTo.x, y: liveTo.y };
      }

      const animAge = age - delay;
      const t = Math.min(1, animAge / maxAge);

      if (fn.stayInPlace) {
        const origin = getFloatItemOriginViewport(state, fn)
          || (fn.kind === "stamina" ? getBattleStatsStaminaBarCenter(fn.sourceTeam || fn.itemTeam || fn.team)
            : getBattlefieldCenterViewport());
        const lift = fn.kind === "failed" ? 18 : fn.kind === "stamina" ? 14 : 24;
        return {
          ...fn,
          age,
          x: origin.x,
          y: origin.y - t * lift,
          toX: origin.x,
          toY: origin.y,
        };
      }

      if (fn.spawnAtTarget) {
        const lift = 42;
        return {
          ...fn,
          age,
          x: liveTo.x,
          y: liveTo.y - t * lift,
          toX: liveTo.x,
          toY: liveTo.y,
        };
      }

      const ease = easeInOutCubic(t);
      let fromAnchor;
      if (fn.debuffId) {
        fromAnchor = getProfileDebuffChipCenter(fn.team, fn.debuffId);
      } else {
        fromAnchor = getFloatItemOriginViewport(state, fn)
          || (fn.kind === "positive" ? getBattleStatsPanelCenter() : getBattlefieldCenterViewport());
      }

      const control = getArcControlPoint(fromAnchor, liveTo, fn.team);
      const pt = quadraticBezier(fromAnchor, control, liveTo, ease);

      return {
        ...fn,
        age,
        fromX: fromAnchor.x,
        fromY: fromAnchor.y,
        controlX: control.x,
        controlY: control.y,
        toX: liveTo.x,
        toY: liveTo.y,
        x: pt.x,
        y: pt.y,
      };
    })
    .filter((fn) => fn.age < (fn.delay || 0) + fn.maxAge);
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

function tickBattleAnimations(state, dt) {
  if (!state?.animations) {
    tickFloatingNumbers(state, dt);
    return;
  }
  const anim = state.animations;

  anim.projectiles = anim.projectiles
    .map((p) => {
      const liveFrom = getProjectileFromViewport(state, p);
      return {
        ...p,
        fromX: liveFrom.x,
        fromY: liveFrom.y,
        progress: p.progress + dt / p.duration,
      };
    })
    .filter((p) => p.progress < 1);

  anim.pulses = anim.pulses
    .map((p) => ({ ...p, age: p.age + dt }))
    .filter((p) => p.age < p.maxAge);

  anim.flashes = anim.flashes
    .map((f) => ({ ...f, age: f.age + dt }))
    .filter((f) => f.age < f.maxAge);

  anim.failedPopups = (anim.failedPopups || [])
    .map((p) => ({ ...p, age: p.age + dt }))
    .filter((p) => p.age < p.maxAge);

  tickFloatingNumbers(state, dt);
}

function getItemPulseScale(state, itemUid) {
  if (!state?.animations) return 1;
  const pulse = state.animations.pulses.find((p) => p.itemUid === itemUid);
  if (!pulse) return 1;
  const t = pulse.age / pulse.maxAge;
  return 1 + (pulse.scale - 1) * (1 - t);
}

function isItemFlashing(state, itemUid) {
  if (!state?.animations) return false;
  return state.animations.flashes.some((f) => f.itemUid === itemUid && f.age < f.maxAge * 0.5);
}

function isItemFailedFlash(state, itemUid) {
  if (!state?.animations) return false;
  return state.animations.flashes.some((f) => f.itemUid === itemUid && f.failed && f.age < f.maxAge);
}
