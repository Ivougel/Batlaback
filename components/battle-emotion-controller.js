/**
 * EmotionController — визуальный слой эмоций/комментариев боя.
 * BattleAnalyzer → BattleState → EmotionController → UI
 */

const EMOTION_CATALOG = {
  stunned:         { emoji: "😵", priority: 100, shellClass: "emotion-stunned" },
  desperate:       { emoji: "💀", priority: 90, shellClass: "emotion-desperate" },
  poisoned:        { emoji: "🤢", priority: 85, shellClass: "emotion-poisoned" },
  burning:         { emoji: "🥵🔥", priority: 80, shellClass: "emotion-burning" },
  crit:            { emoji: "😡💥", priority: 75, transient: true, shellClass: "emotion-hit-shake" },
  big_hit:         { emoji: "💥", priority: 72, transient: true, shellClass: "emotion-hit-shake" },
  lifesteal:       { emoji: "😈🩸", priority: 70, transient: true },
  invulnerable:    { emoji: "✨", priority: 68, shellClass: "emotion-invuln" },
  tired:           { emoji: "🥵", priority: 65, shellClass: "emotion-tired" },
  slowed:          { emoji: "🐌", priority: 63, shellClass: "emotion-slowed" },
  losing:          { emoji: "😰", priority: 60, shellClass: "emotion-losing" },
  survival_battle: { emoji: "⚔️💀", priority: 55, shellClass: "emotion-survival" },
  exhaustion:      { emoji: "😮‍💨", priority: 50, shellClass: "emotion-exhaustion" },
  dodge_ready:     { emoji: "💨", priority: 48 },
  prolonged:       { emoji: "⚔️", priority: 40, shellClass: "emotion-prolonged" },
  heal_boost:      { emoji: "💚", priority: 45, transient: true },
  winning:         { emoji: "😎", priority: 35, shellClass: "emotion-winning" },
  shield:          { emoji: "🛡️😏", priority: 28, transient: true },
  confident:       { emoji: "😏", priority: 30, shellClass: "emotion-confident" },
  healthy:         { emoji: "😎", priority: 20, shellClass: "emotion-healthy" },
};

const EMOTION_ORBIT_PHASE = { player: 0, enemy: 1.7 };

function collectRankedEmotionFlags(sideState, battleState) {
  const team = sideState.team;
  const tracker = battleState.commentary?.[team];
  const now = sideState.elapsed || 0;
  const keys = new Set(sideState.flags || []);

  if (tracker?.activeReactionKey && tracker.activeReactionUntil > now) {
    keys.add(tracker.activeReactionKey);
  }

  return [...keys]
    .filter((k) => EMOTION_CATALOG[k])
    .sort((a, b) => (EMOTION_CATALOG[b].priority || 0) - (EMOTION_CATALOG[a].priority || 0));
}

function pickRotatingEmotion(flags, elapsed, slot = 0) {
  if (!flags.length) return { key: "healthy", def: EMOTION_CATALOG.healthy };
  const topTier = EMOTION_CATALOG[flags[0]].priority;
  const tier = flags.filter((k) => EMOTION_CATALOG[k].priority >= topTier - 5);
  const idx = Math.floor((elapsed + slot * 1.3) / 2.2) % tier.length;
  const key = tier[idx] || flags[0];
  return { key, def: EMOTION_CATALOG[key] };
}

function resolveEmotionPresentation(battleState, team) {
  const sideState = team === "player"
    ? battleState.commentary?.playerState
    : battleState.commentary?.enemyState;
  if (!sideState) return null;

  const flags = collectRankedEmotionFlags(sideState, battleState);
  const primary = pickRotatingEmotion(flags, sideState.elapsed || 0, EMOTION_ORBIT_PHASE[team] || 0);
  const mood = sideState.mood;
  const secondary = flags.find((k) => k !== primary.key && EMOTION_CATALOG[k]?.emoji !== mood?.emoji);
  const secondaryDef = secondary ? EMOTION_CATALOG[secondary] : null;

  return {
    team,
    mood,
    primaryKey: primary.key,
    primaryEmoji: primary.def.emoji,
    secondaryEmoji: secondaryDef?.emoji || null,
    moodEmoji: mood?.emoji || "🙂",
    shellClass: primary.def.shellClass || "",
    brightness: mood.brightness ?? 1,
    pulse: !!mood.pulse || primary.key === "desperate" || primary.key === "losing",
    durationPhase: sideState.durationPhase,
    elapsedLabel: formatBattleElapsed(sideState.elapsed),
    floatPhase: (sideState.elapsed || 0) + (EMOTION_ORBIT_PHASE[team] || 0),
  };
}

function ensureEmotionOrbit(shell, team) {
  let orbit = shell.querySelector(".avatar-emotion-orbit");
  if (!orbit) {
    orbit = document.createElement("div");
    orbit.className = "avatar-emotion-orbit";
    orbit.dataset.team = team;
    orbit.innerHTML = `
      <span class="avatar-emotion-float avatar-emotion-mood" aria-hidden="true"></span>
      <span class="avatar-emotion-float avatar-emotion-reaction" aria-hidden="true"></span>
      <span class="avatar-battle-timer" aria-hidden="true"></span>
    `;
    const stage = shell.querySelector(".avatar-hero-stage");
    if (stage) stage.prepend(orbit);
  }
  let effectOrbit = shell.querySelector(".avatar-effect-orbit");
  if (!effectOrbit) {
    effectOrbit = document.createElement("div");
    effectOrbit.className = "avatar-effect-orbit";
    effectOrbit.dataset.team = team;
    const stage = shell.querySelector(".avatar-hero-stage");
    if (stage) stage.insertBefore(effectOrbit, stage.querySelector(".profile-avatar"));
  }
  return { orbit, effectOrbit };
}

function layoutEmotionFloat(el, emoji, phase, slotIndex) {
  if (!el) return;
  if (el.textContent !== emoji) {
    el.textContent = emoji;
    el.classList.remove("avatar-emotion-pop");
    void el.offsetWidth;
    el.classList.add("avatar-emotion-pop");
  }
  const angle = phase * 0.9 + slotIndex * Math.PI * 0.85;
  const rx = 38 + Math.sin(phase * 0.7 + slotIndex) * 8;
  const ry = 32 + Math.cos(phase * 0.55 + slotIndex * 1.2) * 10;
  const x = 50 + Math.cos(angle) * rx;
  const y = 28 + Math.sin(angle) * ry;
  el.style.setProperty("--emo-x", `${x}%`);
  el.style.setProperty("--emo-y", `${y}%`);
  el.style.setProperty("--emo-rot", `${Math.sin(phase * 1.1 + slotIndex) * 12}deg`);
  el.hidden = !emoji;
}

function hashEffectSlot(key, team) {
  let h = team === "enemy" ? 17 : 3;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) % 997;
  return h;
}

function layoutEffectHop(el, key, team, tick) {
  const h = hashEffectSlot(key, team);
  const jumpEvery = 1.4 + (h % 10) * 0.13;
  const jumpPhase = Math.floor(tick / jumpEvery);
  const rnd = (n) => {
    const x = Math.sin((h + 1) * 928371 + n * 2654435761 + jumpPhase * 1337) * 10000;
    return x - Math.floor(x);
  };
  const x = 12 + rnd(1) * 76;
  const y = 8 + rnd(2) * 72;
  const rot = -18 + rnd(3) * 36;
  el.style.setProperty("--fx-x", `${x}%`);
  el.style.setProperty("--fx-y", `${y}%`);
  el.style.setProperty("--fx-rot", `${rot}deg`);
  el.style.setProperty("--fx-delay", `${(h % 8) * 0.11}s`);
}

function collectEffectOrbitItems(profile) {
  const items = [];
  (profile?.buffs || []).forEach((chip) => {
    items.push({
      key: `buff-${chip.id}`,
      icon: chip.icon,
      kind: "buff",
      count: chip.value > 1 ? chip.value : 0,
    });
  });
  (profile?.debuffs || []).forEach((chip) => {
    items.push({
      key: `debuff-${chip.id}`,
      icon: chip.icon,
      kind: "debuff",
      count: chip.value > 1 ? chip.value : 0,
    });
  });
  return items.slice(0, 10);
}

function syncEffectOrbit(team, profile, tick) {
  const slot = typeof getAvatarSlotEl === "function" ? getAvatarSlotEl(team) : null;
  const shell = slot?.querySelector(".avatar-hero-shell");
  if (!shell) return;
  const { effectOrbit } = ensureEmotionOrbit(shell, team);
  const items = collectEffectOrbitItems(profile);
  const activeKeys = new Set(items.map((i) => i.key));

  effectOrbit.querySelectorAll(".avatar-effect-hop").forEach((el) => {
    if (!activeKeys.has(el.dataset.effectKey)) el.remove();
  });

  items.forEach((item) => {
    let el = effectOrbit.querySelector(`[data-effect-key="${CSS.escape(item.key)}"]`);
    if (!el) {
      el = document.createElement("span");
      el.className = `avatar-effect-hop avatar-effect-hop-${item.kind}`;
      el.dataset.effectKey = item.key;
      effectOrbit.appendChild(el);
    }
    const countHtml = item.count > 1 ? `<span class="avatar-effect-count">×${item.count}</span>` : "";
    const inner = `${item.icon}${countHtml}`;
    if (el.innerHTML !== inner) el.innerHTML = inner;
    layoutEffectHop(el, item.key, team, tick);
  });
}

function applyEmotionPresentation(team, presentation, profile) {
  if (!presentation) return;
  const slot = typeof getAvatarSlotEl === "function" ? getAvatarSlotEl(team) : null;
  const shell = slot?.querySelector(".avatar-hero-shell");
  if (!shell) return;

  const { orbit } = ensureEmotionOrbit(shell, team);
  const moodEl = orbit.querySelector(".avatar-emotion-mood");
  const reactionEl = orbit.querySelector(".avatar-emotion-reaction");
  const timerEl = orbit.querySelector(".avatar-battle-timer");

  layoutEmotionFloat(moodEl, presentation.moodEmoji, presentation.floatPhase, 0);

  const reactionEmoji = presentation.primaryEmoji !== presentation.moodEmoji
    ? presentation.primaryEmoji
    : (presentation.secondaryEmoji || null);
  layoutEmotionFloat(reactionEl, reactionEmoji, presentation.floatPhase + 0.8, 1);

  if (timerEl) timerEl.textContent = presentation.elapsedLabel;

  shell.style.setProperty("--avatar-mood-brightness", String(presentation.brightness));
  shell.classList.toggle("avatar-mood-pulse", presentation.pulse);

  const emotionClasses = Object.values(EMOTION_CATALOG)
    .map((d) => d.shellClass)
    .filter(Boolean);
  emotionClasses.forEach((cls) => shell.classList.remove(cls));
  if (presentation.shellClass) shell.classList.add(presentation.shellClass);

  shell.dataset.emotionState = presentation.primaryKey;
  shell.dataset.moodState = presentation.mood?.id || "calm";

  syncEffectOrbit(team, profile, presentation.floatPhase);
}

function updateBattleEmotions(state) {
  if (!state?.commentary?.playerState) return;
  const playerProfile = state._heroProfiles?.player
    || (typeof computeCombatProfileFromBattleSide === "function"
      ? computeCombatProfileFromBattleSide(state.player, null, "Игрок", state)
      : null);
  const enemyProfile = state._heroProfiles?.enemy
    || (typeof computeCombatProfileFromBattleSide === "function"
      ? computeCombatProfileFromBattleSide(state.enemy, null, "ИИ", state)
      : null);

  applyEmotionPresentation("player", resolveEmotionPresentation(state, "player"), playerProfile);
  applyEmotionPresentation("enemy", resolveEmotionPresentation(state, "enemy"), enemyProfile);
}

function clearBattleEmotions() {
  ["player", "enemy"].forEach((team) => {
    const slot = typeof getAvatarSlotEl === "function" ? getAvatarSlotEl(team) : null;
    const shell = slot?.querySelector(".avatar-hero-shell");
    if (!shell) return;
    shell.style.removeProperty("--avatar-mood-brightness");
    shell.classList.remove("avatar-mood-pulse");
    Object.values(EMOTION_CATALOG).forEach((d) => {
      if (d.shellClass) shell.classList.remove(d.shellClass);
    });
    shell.querySelector(".avatar-emotion-orbit")?.remove();
    shell.querySelector(".avatar-effect-orbit")?.remove();
  });
}

function tickBattleEmotions(state, dt) {
  if (!state || state.finished) return;
  updateBattleAnalyzer(state, dt);
  updateBattleEmotions(state);
}
