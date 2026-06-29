/**
 * EmotionEngine — «живой диалог» между персонажами во время боя (только визуал).
 * BattleAnalyzer → DialogEvent → EmotionPresenter (боевые эмоджи / мысли героя).
 */

const EMOTION_ANALYZE_INTERVAL_MS = 500;
const EMOTION_MIN_GAP_MS = 600;
const EMOTION_SIMULTANEOUS_DAMAGE_MS = 300;

const EMOTION_PRIORITY = {
  skull: 5,
  poison: 4,
  crit: 3,
  block: 2,
  normal: 1,
};

/** @type {ReturnType<typeof createEmotionEngineState>} */
let emotionEngine = createEmotionEngineState();
/** @type {object|null} */
let emotionActiveBattle = null;

function createEmotionEngineState() {
  return {
    lastAnalyzeAt: 0,
    lastRenderAt: 0,
    snapshot: null,
    playerAnim: null,
    enemyAnim: null,
    lastEmitAt: { player: 0, enemy: 0 },
    seenAttackIds: new Set(),
    seenFloatIds: new Set(),
    recentDamage: [],
    durationFlags: { t30: false, t60: false, t120: false },
    pauseTotalMs: 0,
    pauseStartedAt: null,
  };
}

function isEmotionBattlePaused() {
  return typeof isBattlePaused === "function" ? isBattlePaused() : !!battlePaused;
}

function syncEmotionPauseClock() {
  const paused = isEmotionBattlePaused();
  if (paused && emotionEngine.pauseStartedAt == null) {
    emotionEngine.pauseStartedAt = Date.now();
  } else if (!paused && emotionEngine.pauseStartedAt != null) {
    emotionEngine.pauseTotalMs += Date.now() - emotionEngine.pauseStartedAt;
    emotionEngine.pauseStartedAt = null;
  }
  return paused;
}

/** «Игровые» часы эмодзи — без времени, проведённого на паузе. */
function emotionEffectiveNow() {
  let frozenMs = emotionEngine.pauseTotalMs || 0;
  if (emotionEngine.pauseStartedAt != null) {
    frozenMs += Date.now() - emotionEngine.pauseStartedAt;
  }
  return Date.now() - frozenMs;
}

function resetEmotionEngine() {
  emotionEngine = createEmotionEngineState();
  emotionActiveBattle = null;
  clearEmotionLayer();
}

function clearEmotionLayer() {
  if (typeof EmotionPresenter !== "undefined") {
    EmotionPresenter.clearAllThoughts();
  }
}

function clearEmotionMount(side) {
  if (typeof EmotionPresenter !== "undefined") {
    EmotionPresenter.clearThought(side);
  }
}

function renderEmotionDom(anim, side) {
  if (typeof EmotionPresenter !== "undefined") {
    EmotionPresenter.presentThought(side, anim);
  }
}

function foeOf(side) {
  return side === "player" ? "enemy" : "player";
}

function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

function getEmojiPriority(emoji, hint = "normal") {
  const e = String(emoji || "");
  if (e.includes("💀")) return EMOTION_PRIORITY.skull;
  if (e.includes("🤢")) return EMOTION_PRIORITY.poison;
  if (e.includes("💥")) return EMOTION_PRIORITY.crit;
  if (e.includes("🛡")) return EMOTION_PRIORITY.block;
  if (hint === "crit") return EMOTION_PRIORITY.crit;
  if (hint === "poison") return EMOTION_PRIORITY.poison;
  if (hint === "block") return EMOTION_PRIORITY.block;
  if (hint === "skull") return EMOTION_PRIORITY.skull;
  return EMOTION_PRIORITY.normal;
}

function createDialogEvent({
  side,
  emoji,
  replyTo = null,
  animation = "shake",
  duration = 1200,
  priority = null,
  flyFrom = null,
  flyTo = null,
  priorityHint = "normal",
}) {
  return {
    side,
    emoji,
    replyTo,
    animation,
    startedAt: Date.now(),
    duration,
    priority: priority ?? getEmojiPriority(emoji, priorityHint),
    flyFrom: flyFrom || side,
    flyTo: flyTo || (replyTo || null),
  };
}

function tryQueueEvent(side, event) {
  const now = Date.now();
  const pri = event.priority ?? getEmojiPriority(event.emoji);
  event.priority = pri;

  const current = side === "player" ? emotionEngine.playerAnim : emotionEngine.enemyAnim;
  const lastEmit = emotionEngine.lastEmitAt[side] || 0;

  if (current) {
    const progress = (now - current.startedAt) / current.duration;
    if (progress < 1 && pri <= current.priority) return false;
  }

  if (now - lastEmit < EMOTION_MIN_GAP_MS) {
    if (!current || pri <= current.priority) return false;
  }

  event.startedAt = now;
  if (side === "player") emotionEngine.playerAnim = event;
  else emotionEngine.enemyAnim = event;
  emotionEngine.lastEmitAt[side] = now;
  return true;
}

function takeSnapshot(state) {
  return {
    playerHp: Math.max(0, state.player?.hp ?? 0),
    enemyHp: Math.max(0, state.enemy?.hp ?? 0),
    playerPoison: state.player?.poisonStacks ?? 0,
    enemyPoison: state.enemy?.poisonStacks ?? 0,
    elapsed: state.elapsed ?? 0,
  };
}

function recordDamageHit(victim, amount) {
  const now = Date.now();
  emotionEngine.recentDamage.push({ side: victim, amount, at: now });
  emotionEngine.recentDamage = emotionEngine.recentDamage.filter((d) => now - d.at < 800);
}

function checkSimultaneousDamage() {
  const now = Date.now();
  const windowMs = EMOTION_SIMULTANEOUS_DAMAGE_MS;
  const playerHit = emotionEngine.recentDamage.find(
    (d) => d.side === "player" && now - d.at <= windowMs,
  );
  const enemyHit = emotionEngine.recentDamage.find(
    (d) => d.side === "enemy" && now - d.at <= windowMs,
  );
  if (!playerHit || !enemyHit) return false;

  tryQueueEvent("player", createDialogEvent({
    side: "player",
    emoji: "😬",
    replyTo: "enemy",
    animation: "fly",
    duration: 1100,
    flyFrom: "player",
    flyTo: "enemy",
    priority: EMOTION_PRIORITY.normal + 1,
  }));
  tryQueueEvent("enemy", createDialogEvent({
    side: "enemy",
    emoji: "😬",
    replyTo: "player",
    animation: "fly",
    duration: 1100,
    flyFrom: "enemy",
    flyTo: "player",
    priority: EMOTION_PRIORITY.normal + 1,
  }));
  emotionEngine.recentDamage = [];
  return true;
}

function queueDamageDialog(victim, attacker, amount) {
  recordDamageHit(victim, amount);
  if (checkSimultaneousDamage()) return;

  if (amount > 15) {
    tryQueueEvent(victim, createDialogEvent({
      side: victim,
      emoji: "💀",
      replyTo: attacker,
      animation: "grow",
      duration: 1400,
      priorityHint: "skull",
    }));
    tryQueueEvent(attacker, createDialogEvent({
      side: attacker,
      emoji: "😈",
      replyTo: victim,
      animation: "fly",
      duration: 1300,
      flyFrom: attacker,
      flyTo: victim,
      priority: EMOTION_PRIORITY.poison,
    }));
    return;
  }

  if (amount > 8) {
    tryQueueEvent(victim, createDialogEvent({
      side: victim,
      emoji: "😤",
      replyTo: attacker,
      animation: "shake",
      duration: 1200,
    }));
    tryQueueEvent(attacker, createDialogEvent({
      side: attacker,
      emoji: "😏",
      replyTo: victim,
      animation: "bounce",
      duration: 1100,
    }));
    return;
  }

  if (amount > 2) {
    tryQueueEvent(victim, createDialogEvent({
      side: victim,
      emoji: "😮",
      replyTo: attacker,
      animation: "shake",
      duration: 1000,
    }));
  }
}

function queueBlockDialog(victim, attacker) {
  tryQueueEvent(victim, createDialogEvent({
    side: victim,
    emoji: "🛡️😏",
    replyTo: attacker,
    animation: "shake",
    duration: 1300,
    priorityHint: "block",
  }));
  tryQueueEvent(attacker, createDialogEvent({
    side: attacker,
    emoji: "😒",
    replyTo: victim,
    animation: "shake",
    duration: 1100,
  }));
}

function queuePoisonDialog(victim, attacker) {
  tryQueueEvent(victim, createDialogEvent({
    side: victim,
    emoji: "🤢",
    replyTo: attacker,
    animation: "particles",
    duration: 1400,
    priorityHint: "poison",
  }));
  tryQueueEvent(attacker, createDialogEvent({
    side: attacker,
    emoji: "😈",
    replyTo: victim,
    animation: "nod",
    duration: 1000,
    priority: EMOTION_PRIORITY.poison - 1,
  }));
}

function queueHealDialog(healer) {
  const foe = foeOf(healer);
  tryQueueEvent(healer, createDialogEvent({
    side: healer,
    emoji: "💚",
    replyTo: foe,
    animation: "bounce",
    duration: 1200,
  }));
  tryQueueEvent(foe, createDialogEvent({
    side: foe,
    emoji: "😒",
    replyTo: healer,
    animation: "shake",
    duration: 1000,
  }));
}

function queueCritDialog(victim, attacker) {
  tryQueueEvent(victim, createDialogEvent({
    side: victim,
    emoji: "💥",
    replyTo: attacker,
    animation: "grow",
    duration: 1100,
    priorityHint: "crit",
  }));
}

function queueDurationDialog(emoji, animation, duration = 1500) {
  ["player", "enemy"].forEach((side) => {
    tryQueueEvent(side, createDialogEvent({
      side,
      emoji,
      animation,
      duration,
      priority: EMOTION_PRIORITY.normal,
    }));
  });
}

function scanAttackVisuals(state) {
  (state.attackVisuals || []).forEach((fx) => {
    if (!fx?.id || emotionEngine.seenAttackIds.has(fx.id)) return;
    emotionEngine.seenAttackIds.add(fx.id);

    if (fx.effects?.crit && fx.targetTeam) {
      const victim = fx.targetTeam;
      const attacker = fx.sourceTeam || foeOf(victim);
      queueCritDialog(victim, attacker);
    }

    if (fx.effects?.poison && fx.targetTeam) {
      const victim = fx.targetTeam;
      const attacker = fx.sourceTeam || foeOf(victim);
      queuePoisonDialog(victim, attacker);
    }
  });
}

function scanFloatingNumbers(state) {
  (state.floatingNumbers || []).forEach((fn) => {
    if (!fn?.uid || emotionEngine.seenFloatIds.has(fn.uid)) return;
    emotionEngine.seenFloatIds.add(fn.uid);
    const text = String(fn.text || "");
    if (!text.includes("🛡")) return;

    const victim = fn.targetTeam || fn.team;
    if (!victim) return;
    const attacker = foeOf(victim);
    queueBlockDialog(victim, attacker);
  });
}

function detectSnapshotEvents(prev, cur, elapsedReal) {
  const playerLoss = Math.max(0, prev.playerHp - cur.playerHp);
  const enemyLoss = Math.max(0, prev.enemyHp - cur.enemyHp);
  const playerGain = Math.max(0, cur.playerHp - prev.playerHp);
  const enemyGain = Math.max(0, cur.enemyHp - prev.enemyHp);

  if (playerLoss > 0.5) queueDamageDialog("player", "enemy", playerLoss);
  if (enemyLoss > 0.5) queueDamageDialog("enemy", "player", enemyLoss);

  if (playerGain > 0.5) queueHealDialog("player");
  if (enemyGain > 0.5) queueHealDialog("enemy");

  if (cur.playerPoison > prev.playerPoison) {
    queuePoisonDialog("player", "enemy");
  }
  if (cur.enemyPoison > prev.enemyPoison) {
    queuePoisonDialog("enemy", "player");
  }

  const realSec = Math.max(0, elapsedReal || 0);
  if (realSec > 30 && !emotionEngine.durationFlags.t30) {
    emotionEngine.durationFlags.t30 = true;
    queueDurationDialog("😮‍💨", "nod", 1600);
  }
  if (realSec > 60 && !emotionEngine.durationFlags.t60) {
    emotionEngine.durationFlags.t60 = true;
    queueDurationDialog("😴", "nod", 2000);
  }
  if (realSec > 120 && !emotionEngine.durationFlags.t120) {
    emotionEngine.durationFlags.t120 = true;
    queueDurationDialog("💀", "shake", 2200);
  }
}

function analyzeBattleState(battleState, elapsedReal) {
  const now = Date.now();
  if (now - emotionEngine.lastAnalyzeAt < EMOTION_ANALYZE_INTERVAL_MS) return;
  emotionEngine.lastAnalyzeAt = now;

  scanAttackVisuals(battleState);
  scanFloatingNumbers(battleState);

  const snap = takeSnapshot(battleState);
  if (!emotionEngine.snapshot) {
    emotionEngine.snapshot = snap;
    return;
  }

  detectSnapshotEvents(emotionEngine.snapshot, snap, elapsedReal);
  emotionEngine.snapshot = snap;
}

function pruneFinishedAnimations() {
  const now = emotionEffectiveNow();
  ["player", "enemy"].forEach((side) => {
    const key = side === "player" ? "playerAnim" : "enemyAnim";
    const anim = emotionEngine[key];
    if (!anim) return;
    if (now - anim.startedAt >= anim.duration) emotionEngine[key] = null;
  });
}

function drawEmotionLayer(_ctx, battleState, elapsedReal) {
  if (!battleState || battleState.finished) {
    clearEmotionLayer();
    return;
  }

  const appPhase = document.getElementById("app")?.dataset?.phase;
  if (appPhase !== "battle" && appPhase !== "replay") {
    clearEmotionLayer();
    return;
  }

  if (battleState !== emotionActiveBattle) {
    resetEmotionEngine();
    emotionActiveBattle = battleState;
  }

  const paused = syncEmotionPauseClock();

  if (!paused) {
    analyzeBattleState(battleState, elapsedReal);
  }
  pruneFinishedAnimations();

  if (emotionEngine.playerAnim) {
    renderEmotionDom(emotionEngine.playerAnim, "player");
  } else {
    clearEmotionMount("player");
  }
  if (emotionEngine.enemyAnim) {
    renderEmotionDom(emotionEngine.enemyAnim, "enemy");
  } else {
    clearEmotionMount("enemy");
  }

  emotionEngine.lastRenderAt = Date.now();
}
