/**
 * Анимации боя: вспышки, пульсация предметов, летящие числа (HTML-overlay).
 */
import type { BattleSide } from "../types/game";

type BoardItem = { uid: string; itemId: string; col?: number; row?: number };
type ViewportPoint = { x: number; y: number };

type FloatKind = "failed" | "miss" | "positive" | "debuff" | "damage" | "stamina" | string;

type FloatingNumber = {
  uid: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
  maxAge: number;
  magnitude: number;
  kind: FloatKind;
  trajectory: string;
  team: string;
  sourceTeam: string | null;
  debuffId: string | null;
  itemUid: string | null;
  itemTeam: string | null;
  delay: number;
  spawnAtTarget: boolean;
  stayInPlace: boolean;
  anchorMode: string | null;
  lane: number;
};

type AnimPulse = {
  itemUid: string;
  team: string;
  col?: number;
  row?: number;
  age: number;
  maxAge: number;
  scale: number;
};
type AnimFlash = {
  itemUid: string;
  team?: string;
  age: number;
  maxAge: number;
  failed?: boolean;
};

type FailedPopup = { age: number; maxAge: number };

type BattleAnimState = {
  animations?: {
    pulses: AnimPulse[];
    flashes: AnimFlash[];
    failedPopups: FailedPopup[];
  };
  floatingNumbers?: FloatingNumber[];
  _floatUid?: number;
  _blockFxGate?: Record<string, number>;
  elapsed?: number;
  player?: { items?: BoardItem[] };
  enemy?: { items?: BoardItem[] };
};

type FloatOptions = {
  sourceTeam?: string | null;
  targetTeam?: string | null;
  kind?: FloatKind;
  magnitude?: number;
  trajectory?: string;
  fromDebuffChip?: string | null;
  item?: BoardItem | null;
  maxAge?: number;
  delay?: number;
  spawnAtTarget?: boolean;
  stayInPlace?: boolean;
};

const PROJECTILE_DURATION = 1.5;

function initBattleAnimations(state: BattleAnimState): void {
  state.animations = {
    pulses: [],
    flashes: [],
    failedPopups: [],
  };
}

function parseFloatingMagnitude(text: unknown): number {
  const match = String(text).match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 1;
}

function readCssNumber(name: string, fallback = 1): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const val = parseFloat(raw);
  return Number.isFinite(val) ? val : fallback;
}

function getFloatingScale(magnitude: number): number {
  const mag = Math.max(1, magnitude || 1);
  const base = Math.min(2.5, 0.88 + Math.log2(mag + 1) * 0.42);
  return base * readCssNumber("--fx-float-scale", 1);
}

function classifyFloatingText(text: unknown): FloatKind {
  const t = String(text);
  if (t.includes("Неудачно")) return "failed";
  if (t.includes("MISS")) return "miss";
  if (/^\+|\+.*[❤🛡]|[❤🛡].*\+/.test(t)) return "positive";
  if (t.includes("☠") || t.includes("яд") || t.includes("🐌") || /огонь/i.test(t)) return "debuff";
  if (t.includes("−") || t.startsWith("-")) return "damage";
  return "damage";
}

function getAvatarOriginViewport(team: string, spreadX = 14, spreadY = 10): ViewportPoint {
  const center = getProfileAvatarViewportCenter(team);
  return {
    x: center.x + (Math.random() - 0.5) * spreadX,
    y: center.y + (Math.random() - 0.5) * spreadY,
  };
}

function resolveFloatTeams(options: FloatOptions = {}, kind: FloatKind = "damage"): {
  originTeam: string;
  targetTeam: string;
} {
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

function resolveFloatingEndpointsCanvas(options: FloatOptions = {}): {
  fromX: number;
  fromY: number;
  targetTeam: string;
} {
  const kind = options.kind || "damage";
  const { originTeam, targetTeam } = resolveFloatTeams(options, kind);
  const from = getAvatarOriginViewport(originTeam);
  return {
    fromX: from.x,
    fromY: from.y,
    targetTeam,
  };
}

function resolveFloatTrajectory(options: FloatOptions = {}, kind: FloatKind = "damage", text = ""): string {
  if (options.trajectory) return options.trajectory;
  if (options.fromDebuffChip) return "debuff-dot";
  if (kind === "positive" && options.item && String(text).includes("❤")) return "heal-loop";
  if (kind === "damage" || kind === "miss") return "weapon";
  return "default";
}

const MAX_BATTLE_FLOATING_NUMBERS = 32;

function spawnBattleFloat(
  state: BattleAnimState,
  text: string,
  color: string,
  options: FloatOptions = {},
): void {
  state.floatingNumbers = state.floatingNumbers || [];
  if (state.floatingNumbers.length >= MAX_BATTLE_FLOATING_NUMBERS) {
    state.floatingNumbers.shift();
  }
  state._floatUid = (state._floatUid || 0) + 1;
  const kind = options.kind || classifyFloatingText(text);
  const magnitude = options.magnitude ?? parseFloatingMagnitude(text);
  const { originTeam, targetTeam } = resolveFloatTeams(options, kind);
  const trajectory = resolveFloatTrajectory(options, kind, text);
  const isWeaponHit = trajectory === "weapon";
  const isDebuffApply = kind === "debuff" && trajectory !== "debuff-dot" && trajectory !== "fatigue";

  const fromVp = resolveFloatOriginViewport(options, kind, targetTeam);
  const spread = (options.fromDebuffChip || trajectory === "debuff-dot" || trajectory === "fatigue") ? 0 : 12;
  if (spread) {
    fromVp.x += (Math.random() - 0.5) * spread;
    fromVp.y += (Math.random() - 0.5) * spread * 0.6;
  }
  const toVp = getProfileAvatarViewportCenter(targetTeam);

  const itemUid = options.item?.uid || null;
  if (itemUid) {
    state.floatingNumbers = state.floatingNumbers.filter(
      (fn) => !(fn.itemUid === itemUid && fn.age < 0.2),
    );
  }

  const heroFloat = (kind === "damage" || kind === "positive")
    && !options.stayInPlace
    && !options.fromDebuffChip
    && !isDebuffApply;
  const lane = heroFloat ? allocateHeroFloatLane(state, targetTeam) : 0;
  const anchor = heroFloat ? getProfileAvatarFloatAnchor(targetTeam, lane) : null;

  state.floatingNumbers.push({
    uid: `float-${state._floatUid}`,
    fromX: anchor?.x ?? fromVp.x,
    fromY: anchor?.y ?? fromVp.y,
    toX: anchor?.x ?? toVp.x,
    toY: anchor?.y ?? toVp.y,
    x: anchor?.x ?? fromVp.x,
    y: anchor?.y ?? fromVp.y,
    text,
    color: color || "#f85149",
    age: 0,
    maxAge: options.maxAge ?? (isWeaponHit ? 1.35 : 1.6),
    magnitude,
    kind,
    trajectory,
    team: targetTeam,
    sourceTeam: (options.fromDebuffChip || trajectory === "debuff-dot" || trajectory === "fatigue")
      ? null
      : originTeam,
    debuffId: options.fromDebuffChip || null,
    itemUid: options.item?.uid || null,
    itemTeam: options.sourceTeam || originTeam,
    delay: options.delay ?? (isDebuffApply ? PROJECTILE_DURATION : 0),
    spawnAtTarget: options.spawnAtTarget ?? (isDebuffApply || heroFloat),
    stayInPlace: options.stayInPlace ?? (kind === "failed" || kind === "stamina"),
    anchorMode: heroFloat ? "hero-above" : null,
    lane,
  });
}

function getItemProjectileTargetTeam(item: BoardItem, team: string): string {
  const def = ITEM_CATALOG[item.itemId] as { effects?: Array<{ trigger?: string; type?: string }> } | undefined;
  const effects = (def?.effects || []).filter((e) => e.trigger !== "passive");
  const targetsFoe = effects.some((e) =>
    ["damage", "poison", "slow"].includes(e.type || "") || e.type === "groundFire",
  );
  const targetsSelf = effects.some((e) => ["heal", "block"].includes(e.type || ""));
  if (targetsSelf && !targetsFoe) return team;
  return team === "player" ? "enemy" : "player";
}

function getProjectileFromViewport(
  state: BattleAnimState,
  projectile: { team: string; itemUid?: string; fromCol?: number; fromRow?: number; fromX: number; fromY: number },
): ViewportPoint {
  const side = projectile.team === "player" ? state.player : state.enemy;
  const item = side?.items?.find((i) => i.uid === projectile.itemUid);
  if (item && typeof getItemViewportCenter === "function") {
    return getItemViewportCenter(item, projectile.team);
  }
  if (projectile.fromCol != null && typeof cellRect === "function") {
    const rect = cellRect(projectile.team, projectile.fromCol, projectile.fromRow ?? 0);
    return canvasPointToViewport(rect.x + rect.w / 2, rect.y + rect.h / 2);
  }
  return { x: projectile.fromX, y: projectile.fromY };
}

function getFloatItemOriginViewport(state: BattleAnimState, fn: FloatingNumber): ViewportPoint | null {
  if (!fn.itemUid || !fn.itemTeam) return null;
  const side = fn.itemTeam === "player" ? state.player : state.enemy;
  const item = side?.items?.find((i) => i.uid === fn.itemUid);
  if (item && typeof getItemViewportCenter === "function") {
    return getItemViewportCenter(item, fn.itemTeam);
  }
  return null;
}

function queueItemFailedAnimation(state: BattleAnimState, item: BoardItem, team: string, _staminaCost: number): void {
  if (!state.animations) initBattleAnimations(state);
  state.animations!.flashes.push({
    itemUid: item.uid,
    team,
    age: 0,
    maxAge: 0.55,
    failed: true,
  });
}

function queueStaminaSpendFeedback(state: BattleAnimState, team: string, amount: number, item: BoardItem): void {
  spawnBattleFloat(state, `−${amount}`, "#d29922", {
    sourceTeam: team,
    item,
    kind: "stamina",
    maxAge: 0.85,
    stayInPlace: true,
  });
}

function queueItemActivationPulse(state: BattleAnimState, item: BoardItem, team: string): void {
  if (!state.animations) initBattleAnimations(state);

  state.animations!.pulses.push({
    itemUid: item.uid,
    team,
    col: item.col,
    row: item.row,
    age: 0,
    maxAge: 0.4,
    scale: 1.25,
  });

  state.animations!.flashes.push({
    itemUid: item.uid,
    team,
    age: 0,
    maxAge: 0.25,
  });
}

/** @deprecated Используй emitAttackEvent + AttackAnimationManager */
function queueItemAttackAnimation(state: BattleAnimState, item: BoardItem, team: string): void {
  queueItemActivationPulse(state, item, team);
}

function triggerAvatarReaction(team: string, type: string): void {
  const el = document.getElementById(team === "player" ? "player-avatar-slot" : "enemy-avatar-slot");
  if (!el) return;
  const cls = `avatar-reaction-${type}`;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 400);
}

function isBlockFeedback(text: string, color: string, kind: FloatKind): boolean {
  return String(text).includes("🛡") || (kind === "damage" && color === "#8b949e");
}

function resolveBlockFeedbackTeam(kind: FloatKind, sourceTeam: string | null, targetTeam: string): string | null {
  if (kind === "positive") return sourceTeam;
  return targetTeam;
}

function shouldThrottleBlockFeedback(state: BattleAnimState, team: string): boolean {
  if (!state || !team) return false;
  state._blockFxGate = state._blockFxGate || {};
  const now = state.elapsed || 0;
  const last = state._blockFxGate[team];
  if (last != null && now - last < 0.45) return true;
  state._blockFxGate[team] = now;
  return false;
}


function queueHitAnimation(
  state: BattleAnimState,
  item: BoardItem | null,
  team: string,
  text: string,
  color: string,
): void {
  if (!state.animations) initBattleAnimations(state);
  const kind = classifyFloatingText(text);
  const { targetTeam } = resolveFloatTeams({ sourceTeam: team, item }, kind);
  const trajectory = resolveFloatTrajectory({ sourceTeam: team, item }, kind, text);
  const isWeaponHit = trajectory === "weapon";
  const isDebuffApply = kind === "debuff";
  const blockFx = isBlockFeedback(text, color, kind);
  const blockTeam = blockFx ? resolveBlockFeedbackTeam(kind, team, targetTeam) : null;
  const aggregatedDamage = typeof isAggregatedWeaponDamage === "function"
    && isAggregatedWeaponDamage(text, color, kind);

  if (kind === "positive" && item && typeof recordBenefitEffect === "function") {
    const match = String(text).match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const benefitKind = String(text).includes("❤") ? "heal"
        : String(text).includes("🛡") ? "block"
          : "other";
      recordBenefitEffect(state, team, item, parseFloat(match[1]), benefitKind);
    }
  }

  const skipBlockFloat = blockFx && blockTeam && shouldThrottleBlockFeedback(state, blockTeam);
  const skipFloat = aggregatedDamage || skipBlockFloat;
  if (!skipFloat) {
    spawnBattleFloat(state, text, color, {
      sourceTeam: team,
      item: blockFx ? null : item,
      kind,
      trajectory: "hero-rise",
      delay: 0,
      spawnAtTarget: true,
      maxAge: isWeaponHit ? 1.35 : isDebuffApply ? 1.8 : undefined,
    });
  }

  if (kind === "damage" && color !== "#8b949e") {
    triggerAvatarReaction(targetTeam, "hit");
  }
  if (blockFx && blockTeam) {
    triggerAvatarReaction(blockTeam, "block");
  }
  if (kind === "positive" && String(text).includes("❤")) {
    triggerAvatarReaction(team, "heal");
  }

  if (item && state.animations) {
    state.animations.flashes.push({
      itemUid: item.uid,
      team,
      age: 0,
      maxAge: 0.2,
    });
  }
}

function getTeamGridCenter(team: string): ViewportPoint {
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

function tickFloatingNumbers(state: BattleAnimState, dt: number): void {
  if (!state?.floatingNumbers) return;
  state.floatingNumbers = state.floatingNumbers
    .map((fn) => {
      const age = fn.age + dt;
      const delay = fn.delay || 0;
      const maxAge = fn.maxAge || 1;
      const liveTo = getProfileAvatarViewportCenter(fn.team);

      if (age < delay) {
        return { ...fn, age, x: fn.toX ?? liveTo.x, y: fn.toY ?? liveTo.y };
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

      const baseX = fn.toX ?? fn.fromX ?? liveTo.x;
      const baseY = fn.toY ?? fn.fromY ?? liveTo.y;
      const lift = fn.anchorMode === "hero-above" ? 52 : 42;
      const eased = easeOutCubic(t);
      return {
        ...fn,
        age,
        x: baseX,
        y: baseY - eased * lift,
        toX: baseX,
        toY: baseY,
      };
    })
    .filter((fn) => fn.age < (fn.delay || 0) + fn.maxAge);
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function easeInOutQuint(t: number): number {
  return t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function tickBattleAnimations(state: BattleAnimState, dt: number): void {
  if (!state?.animations) {
    tickFloatingNumbers(state, dt);
    return;
  }
  const anim = state.animations;

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

function getItemPulseScale(state: BattleAnimState, itemUid: string): number {
  if (!state?.animations) return 1;
  const pulse = state.animations.pulses.find((p) => p.itemUid === itemUid);
  if (!pulse) return 1;
  const t = pulse.age / pulse.maxAge;
  return 1 + (pulse.scale - 1) * (1 - t);
}

function isItemFlashing(state: BattleAnimState, itemUid: string): boolean {
  if (!state?.animations) return false;
  return state.animations.flashes.some((f) => f.itemUid === itemUid && f.age < f.maxAge * 0.5);
}

function isItemFailedFlash(state: BattleAnimState, itemUid: string): boolean {
  if (!state?.animations) return false;
  return state.animations.flashes.some((f) => f.itemUid === itemUid && f.failed && f.age < f.maxAge);
}
