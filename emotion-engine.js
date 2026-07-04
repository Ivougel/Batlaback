/**
 * EmotionEngine — «живой диалог» между персонажами во время боя (только визуал).
 * BattleAnalyzer → DialogEvent → EmotionPresenter (боевые эмоджи / мысли героя).
 */

const EMOTION_ANALYZE_INTERVAL_MS = 500;
const EMOTION_MIN_GAP_MS = 600;
const EMOTION_SIMULTANEOUS_DAMAGE_MS = 300;

/** Стартовая «основная» эмоция — всегда на экране, не гаснет по таймеру */
const DEFAULT_MAIN_EMOJI = {
  player: "😤",
  enemy: "😏",
};

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
    playerMain: null,
    enemyMain: null,
    lastEmitAt: { player: 0, enemy: 0 },
    seenAttackIds: new Set(),
    seenFloatIds: new Set(),
    recentDamage: [],
    durationFlags: { t30: false, t60: false, t120: false },
    firstBlood: false,
    pauseTotalMs: 0,
    pauseStartedAt: null,
    comboCount: { player: 0, enemy: 0 },
    lastHitBy: { player: null, enemy: null },
    endDialogShown: false,
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
  if (renderEmotionDom._lastKey) {
    renderEmotionDom._lastKey.player = null;
    renderEmotionDom._lastKey.enemy = null;
  }
  if (typeof EmotionPresenter !== "undefined") {
    EmotionPresenter.clearAllThoughts();
  }
  if (typeof ArenaEquipment !== "undefined") {
    ArenaEquipment.clearAll();
  }
}

function clearEmotionMount(side) {
  if (typeof EmotionPresenter !== "undefined") {
    EmotionPresenter.clearThought(side);
  }
}

function renderEmotionDom(anim, side) {
  const key = anim?.emoji ? `${anim.emoji}|${anim.animation || ""}` : "";
  if (renderEmotionDom._lastKey?.[side] === key) return;
  if (!renderEmotionDom._lastKey) renderEmotionDom._lastKey = { player: null, enemy: null };
  renderEmotionDom._lastKey[side] = key;
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

function createMainEmotionEvent(side, emoji, animation = "nod") {
  return createDialogEvent({
    side,
    emoji,
    animation,
    duration: Number.POSITIVE_INFINITY,
    priority: 0,
    persistent: true,
  });
}

function ensureMainEmotions() {
  if (!emotionEngine.playerMain) {
    emotionEngine.playerMain = createMainEmotionEvent("player", DEFAULT_MAIN_EMOJI.player);
  }
  if (!emotionEngine.enemyMain) {
    emotionEngine.enemyMain = createMainEmotionEvent("enemy", DEFAULT_MAIN_EMOJI.enemy);
  }
}

function getMainEmotion(side) {
  return side === "player" ? emotionEngine.playerMain : emotionEngine.enemyMain;
}

function setMainEmotion(side, event) {
  if (side === "player") emotionEngine.playerMain = event;
  else emotionEngine.enemyMain = event;
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
  persistent = false,
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
    persistent,
  };
}

function tryQueueEvent(side, event) {
  const now = Date.now();
  const pri = event.priority ?? getEmojiPriority(event.emoji);
  event.priority = pri;

  ensureMainEmotions();
  const current = getMainEmotion(side);
  const lastEmit = emotionEngine.lastEmitAt[side] || 0;

  if (current && pri <= current.priority) return false;

  event.startedAt = now;
  event.duration = Number.POSITIVE_INFINITY;
  event.persistent = true;
  setMainEmotion(side, event);
  emotionEngine.lastEmitAt[side] = now;
  return true;
}

function pickMemeEmoji(options) {
  const list = Array.isArray(options) ? options : [options];
  return list[Math.floor(Math.random() * list.length)];
}

function takeSnapshot(state) {
  const playerHp = Math.max(0, state.player?.hp ?? 0);
  const enemyHp = Math.max(0, state.enemy?.hp ?? 0);
  const playerMax = Math.max(1, state.player?.maxHp ?? 100);
  const enemyMax = Math.max(1, state.enemy?.maxHp ?? 100);
  return {
    playerHp,
    enemyHp,
    playerHpPct: playerHp / playerMax,
    enemyHpPct: enemyHp / enemyMax,
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
    emoji: "🫨",
    replyTo: "enemy",
    animation: "fly",
    duration: 1100,
    flyFrom: "player",
    flyTo: "enemy",
    priority: EMOTION_PRIORITY.normal + 1,
  }));
  tryQueueEvent("enemy", createDialogEvent({
    side: "enemy",
    emoji: "🫨",
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

function queueDamageDialog(victim, attacker, amount, victimHpPct = 1) {
  const combo = emotionEngine.comboCount || (emotionEngine.comboCount = { player: 0, enemy: 0 });
  const lastHitBy = emotionEngine.lastHitBy || (emotionEngine.lastHitBy = { player: null, enemy: null });

  if (lastHitBy[victim] === attacker) {
    combo[attacker] = (combo[attacker] || 0) + 1;
  } else {
    combo[attacker] = 1;
  }
  lastHitBy[victim] = attacker;

  if (combo[attacker] === 3) {
    tryQueueEvent(attacker, createDialogEvent({
      side: attacker,
      emoji: pickMemeEmoji(["🔥😤", "🔥", "⚡😈", "💪🔥"]),
      animation: "grow",
      duration: 1400,
      priority: EMOTION_PRIORITY.crit,
    }));
    tryQueueEvent(victim, createDialogEvent({
      side: victim,
      emoji: pickMemeEmoji(["😵‍💫", "🤯", "😱", "💫"]),
      animation: "shake",
      duration: 1300,
      priority: EMOTION_PRIORITY.crit - 1,
    }));
    combo[attacker] = 0;
  }

  recordDamageHit(victim, amount);
  if (checkSimultaneousDamage()) return;

  if (!emotionEngine.firstBlood) {
    emotionEngine.firstBlood = true;
    tryQueueEvent(victim, createDialogEvent({
      side: victim,
      emoji: "🩸",
      replyTo: attacker,
      animation: "shake",
      duration: 1100,
    }));
    tryQueueEvent(attacker, createDialogEvent({
      side: attacker,
      emoji: "👀",
      replyTo: victim,
      animation: "bounce",
      duration: 1000,
    }));
    return;
  }

  if (amount > 15) {
    const victimEmoji = victimHpPct < 0.25
      ? pickMemeEmoji(["💀😱", "💀🫠", "☠️"])
      : pickMemeEmoji(["💀🔥", "💀", "🪦"]);
    tryQueueEvent(victim, createDialogEvent({
      side: victim,
      emoji: victimEmoji,
      replyTo: attacker,
      animation: "grow",
      duration: 1400,
      priorityHint: "skull",
    }));
    tryQueueEvent(attacker, createDialogEvent({
      side: attacker,
      emoji: pickMemeEmoji(["🗿", "😈", "🤣"]),
      replyTo: victim,
      animation: "fly",
      duration: 1300,
      flyFrom: attacker,
      flyTo: victim,
      priority: EMOTION_PRIORITY.poison,
    }));
    return;
  }

  maybeTaunt(attacker, victimHpPct);

  if (amount > 8) {
    tryQueueEvent(victim, createDialogEvent({
      side: victim,
      emoji: victimHpPct < 0.3 ? "😭" : "😤",
      replyTo: attacker,
      animation: "shake",
      duration: 1200,
    }));
    tryQueueEvent(attacker, createDialogEvent({
      side: attacker,
      emoji: pickMemeEmoji(["🤣", "😏", "😎"]),
      replyTo: victim,
      animation: "bounce",
      duration: 1100,
    }));
    return;
  }

  if (amount > 2) {
    tryQueueEvent(victim, createDialogEvent({
      side: victim,
      emoji: pickMemeEmoji(["🫠", "😮", "😵‍💫"]),
      replyTo: attacker,
      animation: "shake",
      duration: 1000,
    }));
    tryQueueEvent(attacker, createDialogEvent({
      side: attacker,
      emoji: pickMemeEmoji(["🥱", "🗿", "🙂"]),
      replyTo: victim,
      animation: "nod",
      duration: 900,
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
    emoji: pickMemeEmoji(["🤡", "😒", "🙄"]),
    replyTo: victim,
    animation: "shake",
    duration: 1100,
  }));

  setTimeout(() => {
    tryQueueEvent(victim, createDialogEvent({
      side: victim,
      emoji: pickMemeEmoji(["😏🛡️", "🤙", "💅"]),
      animation: "bounce",
      duration: 1000,
      priority: EMOTION_PRIORITY.normal + 1,
    }));
  }, 500);
}

function queuePoisonDialog(victim, attacker) {
  tryQueueEvent(victim, createDialogEvent({
    side: victim,
    emoji: pickMemeEmoji(["🤮", "🤢", "☣️"]),
    replyTo: attacker,
    animation: "particles",
    duration: 1400,
    priorityHint: "poison",
  }));
  tryQueueEvent(attacker, createDialogEvent({
    side: attacker,
    emoji: pickMemeEmoji(["🧪😈", "😈", "🤢"]),
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
    emoji: pickMemeEmoji(["💚✨", "💚", "🩹"]),
    replyTo: foe,
    animation: "bounce",
    duration: 1200,
  }));
  tryQueueEvent(foe, createDialogEvent({
    side: foe,
    emoji: pickMemeEmoji(["🙄", "😑", "🤨"]),
    replyTo: healer,
    animation: "shake",
    duration: 1000,
  }));
}

function queueCritDialog(victim, attacker) {
  tryQueueEvent(victim, createDialogEvent({
    side: victim,
    emoji: pickMemeEmoji(["💥😵", "💥", "🤯"]),
    replyTo: attacker,
    animation: "grow",
    duration: 1100,
    priorityHint: "crit",
  }));
  tryQueueEvent(attacker, createDialogEvent({
    side: attacker,
    emoji: "👀",
    replyTo: victim,
    animation: "bounce",
    duration: 900,
    priority: EMOTION_PRIORITY.crit - 1,
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

  if (playerLoss > 0.5) queueDamageDialog("player", "enemy", playerLoss, cur.playerHpPct);
  if (enemyLoss > 0.5) queueDamageDialog("enemy", "player", enemyLoss, cur.enemyHpPct);

  if (playerGain > 0.5) queueHealDialog("player");
  if (enemyGain > 0.5) queueHealDialog("enemy");

  if (cur.playerPoison > prev.playerPoison) {
    queuePoisonDialog("player", "enemy");
  }
  if (cur.enemyPoison > prev.enemyPoison) {
    queuePoisonDialog("enemy", "player");
  }

  if (cur.playerHpPct < 0.12 && cur.enemyHpPct < 0.12 && !emotionEngine.durationFlags.dogfight) {
    emotionEngine.durationFlags.dogfight = true;
    queueDurationDialog("😰", "shake", 1400);
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
    queueDurationDialog("⏳💀", "shake", 2200);
  }

  const elapsedSec = Math.floor(realSec);
  if (elapsedSec > 5 && elapsedSec % 8 === 0 && !emotionEngine[`taunt_${elapsedSec}`]) {
    emotionEngine[`taunt_${elapsedSec}`] = true;

    const aggressor = Math.random() > 0.5 ? "player" : "enemy";
    const target = foeOf(aggressor);

    tryQueueEvent(aggressor, createDialogEvent({
      side: aggressor,
      emoji: pickMemeEmoji(["😤", "👊", "💢", "😈", "🫵"]),
      animation: "bounce",
      duration: 1100,
      priority: EMOTION_PRIORITY.normal + 1,
    }));

    setTimeout(() => {
      const snap = emotionEngine.snapshot;
      const targetHpPct = target === "player" ? snap?.playerHpPct : snap?.enemyHpPct;
      tryQueueEvent(target, createDialogEvent({
        side: target,
        emoji: targetHpPct < 0.3
          ? pickMemeEmoji(["😰", "😨", "🥵"])
          : pickMemeEmoji(["😏", "🗿", "💪", "😤"]),
        animation: targetHpPct < 0.3 ? "shake" : "nod",
        duration: 1000,
        priority: EMOTION_PRIORITY.normal,
      }));
    }, 800);
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

function bootstrapBattleThoughts(opts = {}) {
  if (opts.battleState) emotionActiveBattle = opts.battleState;
  ensureMainEmotions();
  const playerEmoji = opts.playerEmoji || DEFAULT_MAIN_EMOJI.player;
  const enemyEmoji = opts.enemyEmoji || DEFAULT_MAIN_EMOJI.enemy;
  emotionEngine.playerMain = createMainEmotionEvent("player", playerEmoji);
  emotionEngine.enemyMain = createMainEmotionEvent("enemy", enemyEmoji);
  renderEmotionDom(emotionEngine.playerMain, "player");
  renderEmotionDom(emotionEngine.enemyMain, "enemy");
  emotionEngine.lastRenderAt = Date.now();
}

function drawEmotionLayer(_ctx, battleState, elapsedReal) {
  if (!battleState) {
    clearEmotionLayer();
    return;
  }

  if (battleState.finished) {
    if (!emotionEngine.endDialogShown) {
      emotionEngine.endDialogShown = true;
      queueBattleEndDialog(battleState.winner);
    }
    ensureMainEmotions();
    renderEmotionDom(emotionEngine.playerMain, "player");
    renderEmotionDom(emotionEngine.enemyMain, "enemy");
    emotionEngine.lastRenderAt = Date.now();
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

  ensureMainEmotions();
  renderEmotionDom(emotionEngine.playerMain, "player");
  renderEmotionDom(emotionEngine.enemyMain, "enemy");

  emotionEngine.lastRenderAt = Date.now();
}

function tickBattleArenaPresentation(battleState, elapsedReal) {
  if (
    typeof ArenaEquipment !== "undefined"
    && document.documentElement.dataset.battleArenaLayout === "true"
    && battleState
  ) {
    ArenaEquipment.syncBattle(battleState, elapsedReal);
  }
}

function queueBattleEndDialog(winner) {
  const loser = foeOf(winner);

  tryQueueEvent(winner, createDialogEvent({
    side: winner,
    emoji: pickMemeEmoji(["🏆😎", "🎉", "💪😤", "🥇"]),
    animation: "bounce",
    duration: Number.POSITIVE_INFINITY,
    priority: EMOTION_PRIORITY.skull + 1,
    persistent: true,
  }));

  tryQueueEvent(loser, createDialogEvent({
    side: loser,
    emoji: pickMemeEmoji(["💀", "😵", "🪦😭", "😭"]),
    animation: "shake",
    duration: Number.POSITIVE_INFINITY,
    priority: EMOTION_PRIORITY.skull + 1,
    persistent: true,
  }));
}

// ─── Провокации и ответные реакции ───

const TAUNT_COOLDOWNS = { player: 0, enemy: 0 };
const TAUNT_MIN_INTERVAL = 4000;

function maybeTaunt(attacker, victimHpPct) {
  const now = Date.now();
  if (now - TAUNT_COOLDOWNS[attacker] < TAUNT_MIN_INTERVAL) return;
  TAUNT_COOLDOWNS[attacker] = now;

  const victim = foeOf(attacker);

  if (victimHpPct < 0.25) {
    tryQueueEvent(attacker, createDialogEvent({
      side: attacker,
      emoji: pickMemeEmoji(["🕺", "💪", "😤👊", "🎉"]),
      animation: "bounce",
      duration: 1500,
      priority: EMOTION_PRIORITY.normal + 1,
    }));
    setTimeout(() => {
      tryQueueEvent(victim, createDialogEvent({
        side: victim,
        emoji: victimHpPct < 0.12
          ? pickMemeEmoji(["😡💢", "🤬", "😤💢"])
          : pickMemeEmoji(["😒", "🙄", "😐"]),
        animation: "shake",
        duration: 1200,
        priority: EMOTION_PRIORITY.normal,
      }));
    }, 600);
    return;
  }

  if (Math.random() > 0.4) return;
  tryQueueEvent(attacker, createDialogEvent({
    side: attacker,
    emoji: pickMemeEmoji(["😏", "😎", "🗿", "🤙"]),
    animation: "nod",
    duration: 1000,
    priority: EMOTION_PRIORITY.normal,
  }));
  setTimeout(() => {
    tryQueueEvent(victim, createDialogEvent({
      side: victim,
      emoji: pickMemeEmoji(["😠", "🤨", "😤", "💢"]),
      animation: "shake",
      duration: 1000,
      priority: EMOTION_PRIORITY.normal,
    }));
  }, 700);
}
