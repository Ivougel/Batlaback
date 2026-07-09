/**
 * EmotionEngine — «живой диалог» между персонажами во время боя (только визуал).
 * BattleAnalyzer → DialogEvent → EmotionPresenter (боевые эмоджи / мысли героя).
 */

const EMOTION_ANALYZE_INTERVAL_MS = 500;
const EMOTION_MIN_GAP_MS = 600;
const EMOTION_SIMULTANEOUS_DAMAGE_MS = 300;
/** Пауза между репликами в «диалоге» мыслей (мс). */
const DIALOG_REPLY_DELAY_MS = 620;
const DIALOG_CHAIN_DELAY_MS = 480;

function isStaticBattleEmotions() {
  return typeof BattleFxTier !== "undefined" && BattleFxTier.isStaticBattleThoughts?.();
}

function getEmotionAnalyzeGapMs() {
  if (typeof BattleFxTier !== "undefined" && BattleFxTier.emotionAnalyzeGapMs) {
    return BattleFxTier.emotionAnalyzeGapMs();
  }
  return EMOTION_ANALYZE_INTERVAL_MS;
}

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
  animation = "wobble",
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

function playThoughtReactionSfx(event, role = "speak") {
  if (typeof playGameSfx !== "function" || !event) return;
  const pan = event.side === "player" ? -0.42 : 0.42;
  const anim = event.animation || "wobble";
  const speakMap = {
    nod: "thought_nod",
    shake: "thought_wobble",
    wobble: "thought_wobble",
    bounce: "thought_bounce",
    grow: "thought_pop",
    fly: "thought_whoosh",
    dance: "thought_dance",
    particles: "thought_sparkle",
  };
  const id = role === "reply" ? "thought_reply" : (speakMap[anim] || "thought_nod");
  playGameSfx(id, { pan });
}

function queueDialogLine(event, options = {}) {
  const delay = options.delay ?? 0;
  const sfxRole = options.sfxRole ?? "speak";
  const run = () => {
    if (tryQueueEvent(event.side, event)) {
      playThoughtReactionSfx(event, sfxRole);
    }
  };
  if (delay > 0) window.setTimeout(run, delay);
  else run();
}

/** Реплика говорящего → пауза → ответ (не одновременная тряска). */
function queueDialogExchange(speakerEvent, replyEvent, options = {}) {
  const replyDelay = options.replyDelay ?? DIALOG_REPLY_DELAY_MS;
  queueDialogLine(speakerEvent, { sfxRole: "speak" });
  if (replyEvent) {
    queueDialogLine(replyEvent, { delay: replyDelay, sfxRole: "reply" });
  }
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

  queueDialogLine(createDialogEvent({
    side: "player",
    emoji: "🫨",
    replyTo: "enemy",
    animation: "dance",
    duration: 1100,
    flyFrom: "player",
    flyTo: "enemy",
    priority: EMOTION_PRIORITY.normal + 1,
  }), { sfxRole: "speak" });
  queueDialogLine(createDialogEvent({
    side: "enemy",
    emoji: "🫨",
    replyTo: "player",
    animation: "wobble",
    duration: 1100,
    flyFrom: "enemy",
    flyTo: "player",
    priority: EMOTION_PRIORITY.normal,
  }), { delay: DIALOG_REPLY_DELAY_MS + 180, sfxRole: "reply" });
  emotionEngine.recentDamage = [];
  return true;
}

function queueDamageDialog(victim, attacker, amount, victimHpPct = 1) {
  if (isStaticBattleEmotions()) {
    recordDamageHit(victim, amount);
    if (checkSimultaneousDamage()) return;
    if (!emotionEngine.firstBlood && amount > 4) {
      emotionEngine.firstBlood = true;
      tryQueueEvent(victim, createDialogEvent({
        side: victim,
        emoji: "🩸",
        replyTo: attacker,
        animation: "nod",
        duration: 1100,
      }));
      return;
    }
    if (amount > 14 || victimHpPct < 0.2) {
      tryQueueEvent(victim, createDialogEvent({
        side: victim,
        emoji: victimHpPct < 0.2 ? pickMemeEmoji(["💀", "😱"]) : pickMemeEmoji(["😵‍💫", "😤"]),
        replyTo: attacker,
        animation: "nod",
        duration: 1200,
        priorityHint: amount > 14 ? "crit" : "normal",
      }));
    }
    return;
  }

  const combo = emotionEngine.comboCount || (emotionEngine.comboCount = { player: 0, enemy: 0 });
  const lastHitBy = emotionEngine.lastHitBy || (emotionEngine.lastHitBy = { player: null, enemy: null });

  if (lastHitBy[victim] === attacker) {
    combo[attacker] = (combo[attacker] || 0) + 1;
  } else {
    combo[attacker] = 1;
  }
  lastHitBy[victim] = attacker;

  if (combo[attacker] === 3) {
    queueDialogExchange(
      createDialogEvent({
        side: attacker,
        emoji: pickMemeEmoji(["🔥😤", "🔥", "⚡😈", "💪🔥"]),
        animation: "dance",
        duration: 1400,
        priority: EMOTION_PRIORITY.crit,
      }),
      createDialogEvent({
        side: victim,
        emoji: pickMemeEmoji(["😵‍💫", "🤯", "😱", "💫"]),
        animation: "wobble",
        duration: 1300,
        priority: EMOTION_PRIORITY.crit - 1,
      }),
    );
    combo[attacker] = 0;
  }

  recordDamageHit(victim, amount);
  if (checkSimultaneousDamage()) return;

  if (!emotionEngine.firstBlood) {
    emotionEngine.firstBlood = true;
    queueDialogExchange(
      createDialogEvent({
        side: victim,
        emoji: "🩸",
        replyTo: attacker,
        animation: "wobble",
        duration: 1100,
      }),
      createDialogEvent({
        side: attacker,
        emoji: "👀",
        replyTo: victim,
        animation: "bounce",
        duration: 1000,
      }),
    );
    return;
  }

  if (amount > 15) {
    const victimEmoji = victimHpPct < 0.25
      ? pickMemeEmoji(["💀😱", "💀🫠", "☠️"])
      : pickMemeEmoji(["💀🔥", "💀", "🪦"]);
    queueDialogExchange(
      createDialogEvent({
        side: victim,
        emoji: victimEmoji,
        replyTo: attacker,
        animation: "grow",
        duration: 1400,
        priorityHint: "skull",
      }),
      createDialogEvent({
        side: attacker,
        emoji: pickMemeEmoji(["🗿", "😈", "🤣"]),
        replyTo: victim,
        animation: "dance",
        duration: 1300,
        flyFrom: attacker,
        flyTo: victim,
        priority: EMOTION_PRIORITY.poison,
      }),
    );
    return;
  }

  maybeTaunt(attacker, victimHpPct);

  if (amount > 8) {
    queueDialogExchange(
      createDialogEvent({
        side: victim,
        emoji: victimHpPct < 0.3 ? "😭" : "😤",
        replyTo: attacker,
        animation: "wobble",
        duration: 1200,
      }),
      createDialogEvent({
        side: attacker,
        emoji: pickMemeEmoji(["🤣", "😏", "😎"]),
        replyTo: victim,
        animation: "bounce",
        duration: 1100,
      }),
    );
    return;
  }

  if (amount > 2) {
    queueDialogExchange(
      createDialogEvent({
        side: victim,
        emoji: pickMemeEmoji(["🫠", "😮", "😵‍💫"]),
        replyTo: attacker,
        animation: "nod",
        duration: 1000,
      }),
      createDialogEvent({
        side: attacker,
        emoji: pickMemeEmoji(["🥱", "🗿", "🙂"]),
        replyTo: victim,
        animation: "nod",
        duration: 900,
      }),
    );
  }
}

function queueBlockDialog(victim, attacker) {
  queueDialogExchange(
    createDialogEvent({
      side: victim,
      emoji: "🛡️😏",
      replyTo: attacker,
      animation: "bounce",
      duration: 1300,
      priorityHint: "block",
    }),
    createDialogEvent({
      side: attacker,
      emoji: pickMemeEmoji(["🤡", "😒", "🙄"]),
      replyTo: victim,
      animation: "wobble",
      duration: 1100,
    }),
  );

  window.setTimeout(() => {
    queueDialogLine(createDialogEvent({
      side: victim,
      emoji: pickMemeEmoji(["😏🛡️", "🤙", "💅"]),
      animation: "dance",
      duration: 1000,
      priority: EMOTION_PRIORITY.normal + 1,
    }), { sfxRole: "speak" });
  }, DIALOG_REPLY_DELAY_MS + DIALOG_CHAIN_DELAY_MS);
}

function queuePoisonDialog(victim, attacker) {
  queueDialogExchange(
    createDialogEvent({
      side: victim,
      emoji: pickMemeEmoji(["🤮", "🤢", "☣️"]),
      replyTo: attacker,
      animation: "wobble",
      duration: 1400,
      priorityHint: "poison",
    }),
    createDialogEvent({
      side: attacker,
      emoji: pickMemeEmoji(["🧪😈", "😈", "🤢"]),
      replyTo: victim,
      animation: "nod",
      duration: 1000,
      priority: EMOTION_PRIORITY.poison - 1,
    }),
  );
}

function queueHealDialog(healer) {
  const foe = foeOf(healer);
  queueDialogExchange(
    createDialogEvent({
      side: healer,
      emoji: pickMemeEmoji(["💚✨", "💚", "🩹"]),
      replyTo: foe,
      animation: "bounce",
      duration: 1200,
    }),
    createDialogEvent({
      side: foe,
      emoji: pickMemeEmoji(["🙄", "😑", "🤨"]),
      replyTo: healer,
      animation: "nod",
      duration: 1000,
    }),
  );
}

function queueCritDialog(victim, attacker) {
  queueDialogExchange(
    createDialogEvent({
      side: victim,
      emoji: pickMemeEmoji(["💥😵", "💥", "🤯"]),
      replyTo: attacker,
      animation: "grow",
      duration: 1100,
      priorityHint: "crit",
    }),
    createDialogEvent({
      side: attacker,
      emoji: "👀",
      replyTo: victim,
      animation: "bounce",
      duration: 900,
      priority: EMOTION_PRIORITY.crit - 1,
    }),
  );
}

function queueDurationDialog(emoji, animation, duration = 1500) {
  const first = Math.random() > 0.5 ? "player" : "enemy";
  const second = foeOf(first);
  queueDialogLine(createDialogEvent({
    side: first,
    emoji,
    animation,
    duration,
    priority: EMOTION_PRIORITY.normal,
  }), { sfxRole: "speak" });
  queueDialogLine(createDialogEvent({
    side: second,
    emoji,
    animation: animation === "shake" ? "wobble" : animation,
    duration,
    priority: EMOTION_PRIORITY.normal,
  }), { delay: DIALOG_REPLY_DELAY_MS, sfxRole: "reply" });
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
  if (isStaticBattleEmotions()) return;
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

  if (isStaticBattleEmotions()) {
    if (cur.playerPoison > prev.playerPoison) queuePoisonDialog("player", "enemy");
    if (cur.enemyPoison > prev.enemyPoison) queuePoisonDialog("enemy", "player");
    return;
  }

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
    queueDurationDialog("😰", "wobble", 1400);
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
    queueDurationDialog("⏳💀", "wobble", 2200);
  }

  const elapsedSec = Math.floor(realSec);
  if (elapsedSec > 5 && elapsedSec % 8 === 0 && !emotionEngine[`taunt_${elapsedSec}`]) {
    emotionEngine[`taunt_${elapsedSec}`] = true;

    const aggressor = Math.random() > 0.5 ? "player" : "enemy";
    const target = foeOf(aggressor);

    queueDialogLine(createDialogEvent({
      side: aggressor,
      emoji: pickMemeEmoji(["😤", "👊", "💢", "😈", "🫵"]),
      animation: "bounce",
      duration: 1100,
      priority: EMOTION_PRIORITY.normal + 1,
    }), { sfxRole: "speak" });

    window.setTimeout(() => {
      const snap = emotionEngine.snapshot;
      const targetHpPct = target === "player" ? snap?.playerHpPct : snap?.enemyHpPct;
      queueDialogLine(createDialogEvent({
        side: target,
        emoji: targetHpPct < 0.3
          ? pickMemeEmoji(["😰", "😨", "🥵"])
          : pickMemeEmoji(["😏", "🗿", "💪", "😤"]),
        animation: targetHpPct < 0.3 ? "wobble" : "nod",
        duration: 1000,
        priority: EMOTION_PRIORITY.normal,
      }), { sfxRole: "reply" });
    }, DIALOG_REPLY_DELAY_MS);
  }
}

function analyzeBattleState(battleState, elapsedReal) {
  if (typeof BattleFxTier !== "undefined" && BattleFxTier.battleEmotionReactive
    && !BattleFxTier.battleEmotionReactive()) {
    return;
  }
  const now = Date.now();
  const analyzeGap = getEmotionAnalyzeGapMs();
  if (now - emotionEngine.lastAnalyzeAt < analyzeGap) return;
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
  if (opts.battleState) {
    if (opts.battleState === emotionActiveBattle && emotionEngine.playerMain && emotionEngine.enemyMain) {
      return;
    }
    emotionActiveBattle = opts.battleState;
  }
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

  queueDialogLine(createDialogEvent({
    side: winner,
    emoji: pickMemeEmoji(["🏆😎", "🎉", "💪😤", "🥇"]),
    animation: "dance",
    duration: Number.POSITIVE_INFINITY,
    priority: EMOTION_PRIORITY.skull + 1,
    persistent: true,
  }), { sfxRole: "speak" });

  queueDialogLine(createDialogEvent({
    side: loser,
    emoji: pickMemeEmoji(["💀", "😵", "🪦😭", "😭"]),
    animation: "wobble",
    duration: Number.POSITIVE_INFINITY,
    priority: EMOTION_PRIORITY.skull + 1,
    persistent: true,
  }), { delay: DIALOG_REPLY_DELAY_MS, sfxRole: "reply" });
}

// ─── Провокации и ответные реакции ───

const TAUNT_COOLDOWNS = { player: 0, enemy: 0 };
const TAUNT_MIN_INTERVAL = 4000;

function maybeTaunt(attacker, victimHpPct) {
  if (isStaticBattleEmotions()) return;
  const now = Date.now();
  if (now - TAUNT_COOLDOWNS[attacker] < TAUNT_MIN_INTERVAL) return;
  TAUNT_COOLDOWNS[attacker] = now;

  const victim = foeOf(attacker);

  if (victimHpPct < 0.25) {
    queueDialogExchange(
      createDialogEvent({
        side: attacker,
        emoji: pickMemeEmoji(["🕺", "💪", "😤👊", "🎉"]),
        animation: "dance",
        duration: 1500,
        priority: EMOTION_PRIORITY.normal + 1,
      }),
      createDialogEvent({
        side: victim,
        emoji: victimHpPct < 0.12
          ? pickMemeEmoji(["😡💢", "🤬", "😤💢"])
          : pickMemeEmoji(["😒", "🙄", "😐"]),
        animation: "wobble",
        duration: 1200,
        priority: EMOTION_PRIORITY.normal,
      }),
      { replyDelay: 680 },
    );
    return;
  }

  if (Math.random() > 0.4) return;
  queueDialogExchange(
    createDialogEvent({
      side: attacker,
      emoji: pickMemeEmoji(["😏", "😎", "🗿", "🤙"]),
      animation: "nod",
      duration: 1000,
      priority: EMOTION_PRIORITY.normal,
    }),
    createDialogEvent({
      side: victim,
      emoji: pickMemeEmoji(["😠", "🤨", "😤", "💢"]),
      animation: "nod",
      duration: 1000,
      priority: EMOTION_PRIORITY.normal,
    }),
  );
}
