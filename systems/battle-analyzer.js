/**
 * BattleAnalyzer — анализ состояния боя без изменения боевой логики.
 * BattleAnalyzer → BattleState (на side commentary snapshot)
 */

const BATTLE_ANALYZER_WINDOW_SEC = 5;
/** На 80% реже: интервалы и фазы ×5 (частота 20% от базовой). */
const EMOTION_INTERVAL_SCALE = 5;
/** Минимальный интервал между реакциями — визуальное время. */
const EMOTION_REACTION_MIN_GAP = 1.15;

function getBattleVisualNow(state) {
  return state?.visualElapsed ?? state?.elapsed ?? 0;
}
const BATTLE_PHASE_THRESHOLDS = [
  { sec: 120, id: "survival", emotion: "survival_battle" },
  { sec: 60, id: "exhaustion", emotion: "exhaustion" },
  { sec: 30, id: "prolonged", emotion: "prolonged" },
];

function initBattleCommentary(state) {
  if (state.commentary) return state.commentary;
  state.commentary = {
    seenAttackIds: new Set(),
    player: createSideCommentaryTracker(),
    enemy: createSideCommentaryTracker(),
  };
  return state.commentary;
}

function createSideCommentaryTracker() {
  return {
    hpSamples: [],
    lastHp: null,
    lastStamina: null,
    transientQueue: [],
    lastReactionAt: 0,
    lastReactionAtVisual: 0,
    lastReactionKey: null,
    activeReactionKey: null,
    activeReactionUntil: 0,
  };
}

function clearBattleCommentary(state) {
  if (!state?.commentary) return;
  state.commentary = null;
  state.moodPulse = null;
}

function sampleSideMetrics(side, team, state, tracker) {
  const elapsed = state.elapsed || 0;
  const hp = Math.max(0, side.hp || 0);
  const maxHp = Math.max(1, side.maxHp || 100);
  const hpPct = hp / maxHp;
  const stamina = side.stamina ?? 0;
  const maxStamina = Math.max(1, side.maxStamina ?? 40);
  const staminaPct = stamina / maxStamina;

  tracker.hpSamples.push({ t: elapsed, hp });
  const cutoff = elapsed - BATTLE_ANALYZER_WINDOW_SEC;
  tracker.hpSamples = tracker.hpSamples.filter((s) => s.t >= cutoff);

  let incomingDps = 0;
  let healRate = 0;
  if (tracker.hpSamples.length >= 2) {
    const oldest = tracker.hpSamples[0];
    const dt = Math.max(0.25, elapsed - oldest.t);
    incomingDps = Math.max(0, (oldest.hp - hp) / dt);
    healRate = Math.max(0, (hp - oldest.hp) / dt);
  }
  const regenPerSec = typeof getSideStack === "function" ? getSideStack(side, "regen") : 0;
  const projectedHeal2s = Math.min(
    Math.max(0, maxHp - hp),
    (healRate + regenPerSec) * 2,
  );

  const hpLost = tracker.lastHp != null ? Math.max(0, tracker.lastHp - hp) : 0;
  tracker.lastHp = hp;
  tracker.lastStamina = stamina;

  const profile = state._heroProfiles?.[team];
  const debuffs = profile?.debuffs || [];
  const buffs = profile?.buffs || [];

  return {
    team,
    hp,
    maxHp,
    hpPct,
    hpLost,
    incomingDps,
    healRate,
    regenPerSec,
    projectedHeal2s,
    stamina,
    maxStamina,
    staminaPct,
    poisonStacks: side.poisonStacks || 0,
    groundFire: side.groundFire || 0,
    stunTimer: side.stunTimer || 0,
    slowTimer: side.slowTimer || 0,
    block: side.block || 0,
    buffCount: buffs.length,
    debuffCount: debuffs.length,
    debuffIds: debuffs.map((d) => d.id),
    buffIds: buffs.map((b) => b.id),
    isStunned: typeof isSideStunned === "function" ? isSideStunned(side) : side.stunTimer > 0,
  };
}

function estimateOutgoingDps(state, team) {
  const foeTeam = team === "player" ? "enemy" : "player";
  const foeSide = foeTeam === "player" ? state.player : state.enemy;
  const tracker = state.commentary?.[foeTeam];
  if (!tracker?.hpSamples?.length) return 0;
  const elapsed = state.elapsed || 0;
  const oldest = tracker.hpSamples[0];
  const dt = Math.max(0.25, elapsed - oldest.t);
  const hpLost = Math.max(0, oldest.hp - Math.max(0, foeSide.hp || 0));
  return hpLost / dt;
}

function estimateWinProbability(myMetrics, foeMetrics) {
  const myScore = myMetrics.hpPct * 100
    + myMetrics.buffCount * 4
    - myMetrics.debuffCount * 6
    - myMetrics.poisonStacks * 2
    - myMetrics.groundFire * 2
    + estimateOutgoingDpsFromMetrics(myMetrics) * 3
    - myMetrics.incomingDps * 3;
  const foeScore = foeMetrics.hpPct * 100
    + foeMetrics.buffCount * 4
    - foeMetrics.debuffCount * 6
    - foeMetrics.poisonStacks * 2
    - foeMetrics.groundFire * 2;
  const total = Math.max(1, myScore + foeScore);
  return Math.max(0.05, Math.min(0.95, myScore / total));
}

function estimateOutgoingDpsFromMetrics(metrics) {
  return metrics.outgoingDps || 0;
}

function resolveBattleDurationPhase(elapsed) {
  for (const phase of BATTLE_PHASE_THRESHOLDS) {
    if (elapsed >= phase.sec) return phase;
  }
  return null;
}

function buildSideBattleState(team, metrics, foeMetrics, state) {
  const side = team === "player" ? state.player : state.enemy;
  const winProb = estimateWinProbability(metrics, foeMetrics);
  const hpAdvantage = metrics.hpPct - foeMetrics.hpPct;
  const durationPhase = resolveBattleDurationPhase(state.elapsed || 0);

  const flags = [];
  if (metrics.isStunned) flags.push("stunned");
  if (metrics.hpPct <= 0.2) flags.push("desperate");
  else if (metrics.hpPct <= 0.35 && metrics.incomingDps > 3) flags.push("desperate");
  if (metrics.poisonStacks > 0) flags.push("poisoned");
  if (metrics.groundFire > 0) flags.push("burning");
  if (metrics.slowTimer > 0 || metrics.debuffIds.includes("slow")) flags.push("slowed");
  if (metrics.debuffIds.includes("invuln") || (side?.invulnerableTimer || 0) > 0) flags.push("invulnerable");
  if (side?.dodgeReady) flags.push("dodge_ready");
  if (metrics.staminaPct <= 0.25 && metrics.staminaPct > 0) flags.push("tired");
  if (winProb >= 0.62 && metrics.hpPct > 0.4) flags.push("winning");
  else if (winProb <= 0.38 && metrics.hpPct < 0.55) flags.push("losing");
  else if (metrics.hpPct >= 0.7 && hpAdvantage > 0.1) flags.push("confident");
  else if (metrics.hpPct >= 0.65) flags.push("healthy");
  if (durationPhase) flags.push(durationPhase.emotion);

  if (metrics.hpLost >= metrics.maxHp * 0.12) {
    pushTransientReaction(state, team, "big_hit", 0.55);
  }

  return {
    team,
    metrics,
    foeMetrics,
    winProbability: winProb,
    hpAdvantage,
    durationPhase,
    flags,
    mood: resolveMoodFromHp(metrics.hpPct),
    elapsed: state.elapsed || 0,
  };
}

function analyzeBattleSide(state, team) {
  initBattleCommentary(state);
  const side = team === "player" ? state.player : state.enemy;
  const foeTeam = team === "player" ? "enemy" : "player";
  const foeSide = foeTeam === "player" ? state.player : state.enemy;
  const tracker = state.commentary[team];
  const foeTracker = state.commentary[foeTeam];

  const metrics = sampleSideMetrics(side, team, state, tracker);
  const foeMetrics = sampleSideMetrics(foeSide, foeTeam, state, foeTracker);
  metrics.outgoingDps = estimateOutgoingDps(state, team);

  return buildSideBattleState(team, metrics, foeMetrics, state);
}

function refreshBattleCommentaryStates(state) {
  initBattleCommentary(state);
  const pTracker = state.commentary.player;
  const eTracker = state.commentary.enemy;

  const playerMetrics = sampleSideMetrics(state.player, "player", state, pTracker);
  const enemyMetrics = sampleSideMetrics(state.enemy, "enemy", state, eTracker);
  playerMetrics.outgoingDps = estimateOutgoingDps(state, "player");
  enemyMetrics.outgoingDps = estimateOutgoingDps(state, "enemy");

  state.commentary.playerState = buildSideBattleState("player", playerMetrics, enemyMetrics, state);
  state.commentary.enemyState = buildSideBattleState("enemy", enemyMetrics, playerMetrics, state);
}

function resolveMoodFromHp(hpPct) {
  if (hpPct <= 0.05) return { id: "critical", emoji: "💀", brightness: 0.52, pulse: true };
  if (hpPct <= 0.2) return { id: "panic", emoji: "😰", brightness: 0.62, pulse: true };
  if (hpPct <= 0.5) return { id: "neutral", emoji: "😐", brightness: 0.82, pulse: false };
  return { id: "calm", emoji: "🙂", brightness: 1, pulse: false };
}

function collectAttackVisualTriggers(state) {
  initBattleCommentary(state);
  const triggers = [];
  (state.attackVisuals || []).forEach((fx) => {
    if (state.commentary.seenAttackIds.has(fx.id)) return;
    state.commentary.seenAttackIds.add(fx.id);
    if (fx.effects?.crit) {
      triggers.push({ team: fx.targetTeam, key: "crit", priority: 75 });
    }
    if (fx.effects?.block) {
      triggers.push({ team: fx.targetTeam, key: "shield", priority: 28, transient: true });
    }
    if (fx.effects?.heal) {
      const src = fx.sourceTeam === "player" ? state.player : state.enemy;
      triggers.push({
        team: fx.sourceTeam,
        key: src.lifesteal > 0 ? "lifesteal" : "heal_boost",
        priority: src.lifesteal > 0 ? 70 : 45,
        transient: true,
      });
    }
    if (fx.effects?.poison) {
      triggers.push({ team: fx.targetTeam, key: "poisoned", priority: 85, transient: true });
    }
    if (fx.effects?.burn) {
      triggers.push({ team: fx.targetTeam, key: "burning", priority: 80, transient: true });
    }
  });
  return triggers;
}

function pushTransientReaction(state, team, key, duration = 1.1) {
  initBattleCommentary(state);
  const tracker = state.commentary[team];
  const now = getBattleVisualNow(state);
  if (now - (tracker.lastReactionAtVisual || 0) < EMOTION_REACTION_MIN_GAP) return;
  tracker.transientQueue.push({ key, until: now + duration });
  tracker.activeReactionKey = key;
  tracker.activeReactionUntil = now + duration;
  tracker.lastReactionAt = now;
  tracker.lastReactionAtVisual = now;
  tracker.lastReactionKey = key;
}

function detectHpSpikeReactions(state) {
  /* handled in buildSideBattleState via metrics.hpLost */
}

function updateBattleAnalyzer(state, _dt) {
  if (!state || state.finished) return;
  initBattleCommentary(state);
  const now = getBattleVisualNow(state);

  collectAttackVisualTriggers(state).forEach((tr) => {
    pushTransientReaction(state, tr.team, tr.key, tr.transient ? 1.0 : 0.85);
  });

  ["player", "enemy"].forEach((team) => {
    const tracker = state.commentary[team];
    tracker.transientQueue = tracker.transientQueue.filter((t) => t.until > now);
    if (tracker.activeReactionUntil <= now) {
      tracker.activeReactionKey = null;
    }
  });

  refreshBattleCommentaryStates(state);
}

function formatBattleElapsed(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
