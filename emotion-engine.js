/**
 * EmotionEngine — «живой диалог» между персонажами во время боя (только визуал).
 * BattleAnalyzer → DialogEvent → AnimationQueue → drawEmotionLayer()
 * Все анимации — реальное время через Date.now(), не dt / gameSpeed.
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
  };
}

function resetEmotionEngine() {
  emotionEngine = createEmotionEngineState();
  emotionActiveBattle = null;
  clearEmotionLayer();
}

function foeOf(side) {
  return side === "player" ? "enemy" : "player";
}

function lerp(a, b, t) {
  return a + (b - a) * t;
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

/** Смещение эмодзи от центра аватара (viewport px). */
const EMOJI_SIDE_OFFSET_X = 60;
const EMOJI_HEAD_OFFSET_Y = -80;

const emotionDomPool = new Map();

function ensureEmotionLayer() {
  let layer = document.getElementById("battle-emotion-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "battle-emotion-layer";
    layer.className = "battle-emotion-layer";
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:96;overflow:visible;";
    document.body.appendChild(layer);
  }
  return layer;
}

function clearEmotionLayer() {
  emotionDomPool.forEach((el) => el.remove());
  emotionDomPool.clear();
  document.querySelectorAll(".avatar-emotion-mount").forEach((mount) => {
    mount.replaceChildren();
  });
  document.getElementById("battle-emotion-layer")?.replaceChildren();
}

function getEmotionMount(side) {
  const appPhase = document.getElementById("app")?.dataset?.phase;
  if (appPhase === "battle") {
    const hudMount = document.getElementById(`${side}-hud-emotion-mount`);
    if (hudMount) return hudMount;
  }
  const panelId = side === "player" ? "player-avatar-panel" : "enemy-avatar-panel";
  return document.querySelector(`#${panelId} .avatar-hero-stage`)
    || document.querySelector(`#${panelId} .profile-avatar`);
}

function ensureEmotionMount(side) {
  const stage = getEmotionMount(side);
  if (!stage) return null;
  let mount = stage.querySelector(":scope > .avatar-emotion-mount");
  if (!mount) {
    mount = document.createElement("div");
    mount.className = "avatar-emotion-mount";
    mount.dataset.team = side;
    mount.setAttribute("aria-hidden", "true");
    mount.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:30;overflow:visible;";
    stage.appendChild(mount);
  }
  return mount;
}

/** Локальное смещение над головой (px от центра stage). */
function getHeadOffset(side) {
  const appPhase = document.getElementById("app")?.dataset?.phase;
  if (appPhase === "battle" && typeof window.HERO_ANCHOR?.getEmojiOffset === "function") {
    return window.HERO_ANCHOR.getEmojiOffset(side);
  }
  return {
    x: side === "player" ? EMOJI_SIDE_OFFSET_X : -EMOJI_SIDE_OFFSET_X,
    y: EMOJI_HEAD_OFFSET_Y,
  };
}

function getMountCenterViewport(mount) {
  const rect = mount.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function getHeroAnchor(side) {
  const appPhase = document.getElementById("app")?.dataset?.phase;
  if (appPhase === "battle" && typeof window.HERO_ANCHOR?.getViewportCenter === "function") {
    const pt = window.HERO_ANCHOR.getViewportCenter(side);
    if (pt?.x != null && pt?.y != null) return pt;
  }
  if (typeof getProfileAvatarViewportCenter === "function") {
    const pt = getProfileAvatarViewportCenter(side);
    if (pt?.x != null && pt?.y != null) return { x: pt.x, y: pt.y };
  }
  if (typeof getAvatarHeroStageRect === "function") {
    const rect = getAvatarHeroStageRect(side);
    if (rect?.width > 0) {
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }
  }
  const panelId = side === "player" ? "player-avatar-panel" : "enemy-avatar-panel";
  const avatar = document.querySelector(`#${panelId} .profile-avatar-img, #${panelId} .profile-avatar`);
  if (avatar) {
    const rect = avatar.getBoundingClientRect();
    if (rect.width > 0) {
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }
  return {
    x: window.innerWidth * (side === "player" ? 0.22 : 0.78),
    y: window.innerHeight * 0.68,
  };
}

function getSideAnchor(side) {
  const hero = getHeroAnchor(side);
  const offsetX = side === "player" ? EMOJI_SIDE_OFFSET_X : -EMOJI_SIDE_OFFSET_X;
  return { x: hero.x + offsetX, y: hero.y + EMOJI_HEAD_OFFSET_Y };
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

function animProgress(anim) {
  return clamp01((Date.now() - anim.startedAt) / anim.duration);
}

function resolveAnimOffset(anim, side) {
  const progress = animProgress(anim);
  const head = getHeadOffset(side);
  const tSec = (Date.now() - anim.startedAt) / 1000;

  if (anim.animation === "fly" && anim.flyTo) {
    const mount = ensureEmotionMount(anim.flyFrom || side);
    const dst = getSideAnchor(anim.flyTo);
    const t = progress;
    let offsetX = head.x;
    let offsetY = head.y;
    if (mount && dst) {
      const center = getMountCenterViewport(mount);
      const endX = dst.x - center.x;
      const endY = dst.y - center.y;
      offsetX = lerp(head.x, endX, t);
      offsetY = lerp(head.y, endY, t) + Math.sin(t * Math.PI) * -80;
    }
    return { offsetX, offsetY, progress, rotation: 0, scale: 1 };
  }

  let offsetX = head.x;
  let offsetY = head.y;
  let rotation = 0;
  let scale = 1;

  switch (anim.animation) {
    case "shake": {
      offsetX += Math.sin(tSec * 40) * 5 * (1 - progress);
      if (anim.emoji.includes("🛡")) {
        rotation = Math.sin(tSec * 18) * 0.35 * (1 - progress);
      }
      break;
    }
    case "bounce":
      offsetY += -Math.sin(progress * Math.PI) * 30;
      break;
    case "grow":
      scale = 1 + Math.sin(progress * Math.PI) * 2;
      break;
    case "nod":
      rotation = Math.sin(tSec * 3) * 0.15;
      break;
    case "particles":
      break;
    default:
      offsetX += Math.sin(tSec * 40) * 5 * (1 - progress);
  }

  return { offsetX, offsetY, progress, rotation, scale };
}

function particleColor(emoji) {
  const e = String(emoji || "");
  if (e.includes("🤢")) return "#3fb950";
  if (e.includes("🔥")) return "#ffa657";
  return "#58a6ff";
}

function upsertEmotionEl(uid, side, anim) {
  let el = emotionDomPool.get(uid);
  const mount = ensureEmotionMount(side);
  if (!mount) return null;
  if (!el) {
    el = document.createElement("div");
    el.className = `battle-emotion-float battle-emotion-team-${side} battle-emotion-${anim.animation}`;
    el.dataset.emotionUid = uid;
    emotionDomPool.set(uid, el);
    mount.appendChild(el);
  } else if (el.parentElement !== mount) {
    mount.appendChild(el);
  }
  return el;
}

function renderParticlesDom(el, anim, centerX, centerY) {
  el.querySelectorAll(".battle-emotion-particle").forEach((node) => node.remove());
  const progress = animProgress(anim);
  const count = 6;
  const color = particleColor(anim.emoji);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI;
    const px = Math.cos(angle) * progress * 40;
    const py = -Math.sin(angle) * progress * 50;
    const alpha = 1 - progress;
    if (alpha <= 0) continue;
    const dot = document.createElement("span");
    dot.className = "battle-emotion-particle";
    dot.style.cssText = [
      "position:absolute",
      "left:50%",
      "top:50%",
      `transform:translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
      `width:${6 + (1 - progress) * 4}px`,
      `height:${6 + (1 - progress) * 4}px`,
      "border-radius:50%",
      `background:${color}`,
      `opacity:${alpha}`,
    ].join(";");
    el.appendChild(dot);
  }
}

function renderEmotionDom(anim, side) {
  const uid = `emotion-${side}`;
  const { offsetX, offsetY, progress, rotation, scale } = resolveAnimOffset(anim, side);
  if (progress >= 1) {
    const el = emotionDomPool.get(uid);
    if (el) {
      el.remove();
      emotionDomPool.delete(uid);
    }
    return;
  }

  const el = upsertEmotionEl(uid, side, anim);
  if (!el) return;

  el.style.position = "absolute";
  el.style.left = "50%";
  el.style.top = "50%";
  el.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) rotate(${rotation}rad) scale(${scale})`;
  el.style.opacity = String(Math.max(0.15, 1 - progress * 0.12));
  el.style.fontSize = `${42 * scale}px`;
  el.style.lineHeight = "1";
  el.style.filter = "drop-shadow(0 4px 14px rgba(0,0,0,0.55))";
  el.style.transition = "none";
  el.style.willChange = "transform";

  if (anim.animation === "particles") {
    renderParticlesDom(el, anim, offsetX, offsetY);
    el.textContent = progress < 0.85 ? anim.emoji : "";
    el.style.opacity = String(Math.max(0.2, 1 - progress * 0.35));
    return;
  }

  el.querySelectorAll(".battle-emotion-particle").forEach((node) => node.remove());
  el.textContent = anim.emoji;
}

function pruneFinishedAnimations() {
  const now = Date.now();
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

  analyzeBattleState(battleState, elapsedReal);
  pruneFinishedAnimations();

  const active = new Set();
  if (emotionEngine.playerAnim) {
    active.add("emotion-player");
    renderEmotionDom(emotionEngine.playerAnim, "player");
  }
  if (emotionEngine.enemyAnim) {
    active.add("emotion-enemy");
    renderEmotionDom(emotionEngine.enemyAnim, "enemy");
  }

  emotionDomPool.forEach((el, uid) => {
    if (active.has(uid)) return;
    el.remove();
    emotionDomPool.delete(uid);
  });

  emotionEngine.lastRenderAt = Date.now();
}
