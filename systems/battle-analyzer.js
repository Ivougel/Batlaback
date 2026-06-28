/**
 * BattleAnalyzer — метрики боя для UI (DPS, прогноз лечения).
 * Не меняет боевую логику.
 */

const BATTLE_ANALYZER_WINDOW_SEC = 5;

function initBattleCommentary(state) {
  if (state.commentary) return state.commentary;
  state.commentary = {
    player: createSideMetricsTracker(),
    enemy: createSideMetricsTracker(),
  };
  return state.commentary;
}

function createSideMetricsTracker() {
  return {
    hpSamples: [],
    lastHp: null,
    lastStamina: null,
  };
}

function clearBattleCommentary(state) {
  if (!state?.commentary) return;
  state.commentary = null;
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

function buildSideBattleState(team, metrics, foeMetrics, state) {
  return {
    team,
    metrics,
    foeMetrics,
    elapsed: state.elapsed || 0,
  };
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

function updateBattleAnalyzer(state, _dt) {
  if (!state || state.finished) return;
  refreshBattleCommentaryStates(state);
}
