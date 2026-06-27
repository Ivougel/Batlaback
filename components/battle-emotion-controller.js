/**
 * EmotionController — визуальный слой эмоций/комментариев боя.
 * BattleAnalyzer → BattleState → EmotionController → UI
 */

const KAYFU_EMOJI = "🤠";

const EMOTION_CATALOG = {
  stunned:         { emoji: "😵", variants: ["😵‍💫", "🫠", "💫", "😵💢"], priority: 100, shellClass: "emotion-stunned" },
  desperate:       { emoji: "💀", variants: ["☠️", "⚰️", "📉", "💀🔥"], priority: 90, shellClass: "emotion-desperate" },
  poisoned:        { emoji: "🤢", variants: ["🤮", "🫠", "☣️", "🤢💅"], priority: 85, shellClass: "emotion-poisoned" },
  burning:         { emoji: "🥵🔥", variants: ["🔥😭", "🥵", "🌋", "🔥💀"], priority: 80, shellClass: "emotion-burning" },
  crit:            { emoji: "😡💥", variants: ["💥😤", "🗿💥", "⚡😡", "👊💥"], priority: 75, transient: true, shellClass: "emotion-hit-shake" },
  big_hit:         { emoji: "💥", variants: ["🫨", "💢", "😱", "📉💥"], priority: 72, transient: true, shellClass: "emotion-hit-shake" },
  lifesteal:       { emoji: "😈🩸", variants: ["🧛", "🩸😏", "😈", "🧃🩸"], priority: 70, transient: true },
  invulnerable:    { emoji: "✨", variants: ["🛡️✨", "💫", "🌟", "✨😎"], priority: 68, shellClass: "emotion-invuln" },
  tired:           { emoji: "🥵", variants: ["😮‍💨", "🥱", "🔋🪫", "☕😵"], priority: 65, shellClass: "emotion-tired" },
  slowed:          { emoji: "🐌", variants: ["🦥", "⏳", "🐢", "🐌💤"], priority: 63, shellClass: "emotion-slowed" },
  losing:          { emoji: "😰", variants: ["😭", "🫠", "📉😰", "💀☕"], priority: 60, shellClass: "emotion-losing" },
  cooked:          { emoji: "🫠", variants: ["💀☕", "🔥🫠", "📉", "😭🔥"], priority: 58, shellClass: "emotion-losing" },
  survival_battle: { emoji: "⚔️💀", variants: ["⏳💀", "🪦", "⚔️😵", "🏴‍☠️"], priority: 55, shellClass: "emotion-survival" },
  exhaustion:      { emoji: "😮‍💨", variants: ["🥱", "🪫", "😵‍💫", "💤"], priority: 50, shellClass: "emotion-exhaustion" },
  dodge_ready:     { emoji: "💨", variants: ["🏃💨", "💨😏", "🌬️", "💨✨"], priority: 48 },
  heal_boost:      { emoji: "💚", variants: ["❤️‍🩹", "💚✨", "🩹", "💚😌"], priority: 45, transient: true },
  prolonged:       { emoji: "⚔️", variants: ["⏳⚔️", "🗿⚔️", "⌛", "⚔️😮‍💨"], priority: 40, shellClass: "emotion-prolonged" },
  winning:         { emoji: "😎", variants: ["😎✨", "🗿", "💪", "👑"], priority: 35, shellClass: "emotion-winning" },
  confident:       { emoji: "😏", variants: ["😏✨", "🗿", "💅", "😏👍"], priority: 30, shellClass: "emotion-confident" },
  shield:          { emoji: "🛡️😏", variants: ["🛡️", "🧱😏", "🛡️💅", "😏🛡️"], priority: 28, transient: true },
  delulu:          { emoji: "✨🙂", variants: ["🦄", "🌈", "💭✨", "🌟😌"], priority: 24, shellClass: "emotion-confident" },
  rizz:            { emoji: "😏✨", variants: ["💅", "🤙", "✨😮‍💨", "😏🔥"], priority: 22 },
  sigma:           { emoji: "🗿", variants: ["😐🗿", "💪🗿", "🗿👍", "🫡🗿"], priority: 20 },
  healthy:         { emoji: "😎", variants: ["🙂", "😌", "☺️", "🫡"], priority: 18, shellClass: "emotion-healthy" },
  vibing:          { emoji: "🤙", variants: ["✨🤙", "🎧", "😌✨", "🕺"], priority: 16 },
  based:           { emoji: "🗿👍", variants: ["👍🗿", "🫡", "😤👍", "💯"], priority: 14 },
  touch_grass:     { emoji: "🌿", variants: ["🌿📵", "🌱", "🍃", "🌿😌"], priority: 12 },
  skibidi:         { emoji: "🚽", variants: ["📱💀", "🎤", "🚽💀", "📺"], priority: 10 },
  no_cap:          { emoji: "🧢", variants: ["🧢🔥", "🫡", "💯", "🧢✨"], priority: 8 },
};

const MOOD_VARIANTS = {
  critical: ["💀", "⚰️", "📉", "🫠"],
  panic: ["😰", "😱", "🫨", "💀😭"],
  neutral: ["😐", "😑", "🫠", "🙂‍↔️"],
  calm: ["🙂", "😌", "☺️", "🫡"],
};

const EMOTION_ORBIT_PHASE = { player: 0, enemy: 1.7 };

function moodPulseRand(team, cycleIndex, part) {
  const base = team === "enemy" ? 7919 : 6151;
  const x = Math.sin((cycleIndex + 1) * (base + part * 1337) * 0.0013) * 10000;
  return x - Math.floor(x);
}

function computeMoodPulseSegment(elapsed, durationPhase, team, cycleIndex, willBeVisible) {
  const mins = (elapsed || 0) / 60;
  let hideMin = 10.8;
  let hideSpan = 7.6;
  if (mins >= 2) {
    hideMin = 6.8;
    hideSpan = 4.4;
  } else if (mins >= 1) {
    hideMin = 8.4;
    hideSpan = 5.2;
  } else if (mins >= 0.5) {
    hideMin = 9.6;
    hideSpan = 6.0;
  }
  if (durationPhase?.sec >= 120) {
    hideMin -= 1.2;
    hideSpan -= 0.7;
  } else if (durationPhase?.sec >= 60) {
    hideMin -= 0.6;
    hideSpan -= 0.4;
  }

  const showMin = 1.6;
  const showSpan = 0.9 + moodPulseRand(team, cycleIndex, 9) * 1.1;
  const r = moodPulseRand(team, cycleIndex, willBeVisible ? 2 : 3);

  if (willBeVisible) return showMin + r * showSpan;
  return hideMin + r * hideSpan;
}

function ensureMoodPulseState(state, team) {
  if (!state.moodPulse) state.moodPulse = {};
  if (state.moodPulse[team]) return state.moodPulse[team];

  const elapsed = state.visualElapsed ?? state.elapsed ?? 0;
  const firstWait = computeMoodPulseSegment(elapsed, null, team, 0, false);
  state.moodPulse[team] = {
    visible: false,
    cycleIndex: 0,
    nextFlipAt: elapsed + firstWait,
  };
  return state.moodPulse[team];
}

function resolveMoodPulseVisible(state, team) {
  if (!state) return false;
  const elapsed = state.visualElapsed ?? state.elapsed ?? 0;
  const pulse = ensureMoodPulseState(state, team);
  const sideState = team === "player" ? state.commentary?.playerState : state.commentary?.enemyState;

  if (elapsed >= pulse.nextFlipAt) {
    pulse.visible = !pulse.visible;
    pulse.cycleIndex += 1;
    const segment = computeMoodPulseSegment(
      elapsed,
      sideState?.durationPhase,
      team,
      pulse.cycleIndex,
      pulse.visible,
    );
    pulse.nextFlipAt = elapsed + segment;
  }

  return pulse.visible;
}

function pickEmotionVariant(def, key, elapsed, teamSlot = 0) {
  const pool = def?.variants?.length ? def.variants : [def?.emoji || "✨"];
  let h = 0;
  for (let i = 0; i < String(key).length; i += 1) h = (h * 33 + key.charCodeAt(i)) % 1000;
  const idx = Math.floor(((elapsed || 0) + teamSlot) / 4.2 + h * 0.17) % pool.length;
  return pool[idx];
}

function pickMoodEmoji(mood, elapsed, team) {
  const pool = MOOD_VARIANTS[mood?.id] || [mood?.emoji || "🙂"];
  const slot = EMOTION_ORBIT_PHASE[team] || 0;
  const idx = Math.floor(((elapsed || 0) + slot) / 6.6) % pool.length;
  return pool[idx];
}

function collectRankedEmotionFlags(sideState, battleState) {
  const team = sideState.team;
  const tracker = battleState.commentary?.[team];
  const now = battleState.visualElapsed ?? sideState.elapsed ?? 0;
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
  const idx = Math.floor((elapsed + slot * 1.3) / 4.4) % tier.length;
  const key = tier[idx] || flags[0];
  return { key, def: EMOTION_CATALOG[key] };
}

function resolveEmotionPresentation(battleState, team) {
  const sideState = team === "player"
    ? battleState.commentary?.playerState
    : battleState.commentary?.enemyState;
  if (!sideState) return null;

  const visualElapsed = battleState.visualElapsed ?? sideState.elapsed ?? 0;
  const flags = collectRankedEmotionFlags(sideState, battleState);
  const primary = pickRotatingEmotion(flags, visualElapsed, EMOTION_ORBIT_PHASE[team] || 0);
  const mood = sideState.mood;
  const teamSlot = EMOTION_ORBIT_PHASE[team] || 0;
  const secondary = flags.find((k) => k !== primary.key && EMOTION_CATALOG[k]?.emoji !== mood?.emoji);
  const secondaryDef = secondary ? EMOTION_CATALOG[secondary] : null;
  const countdownActive = typeof isBattleCountdownActive === "function"
    && isBattleCountdownActive(battleState);

  return {
    team,
    mood,
    primaryKey: primary.key,
    primaryEmoji: pickEmotionVariant(primary.def, primary.key, visualElapsed, teamSlot),
    secondaryEmoji: secondaryDef
      ? pickEmotionVariant(secondaryDef, secondary, visualElapsed + 1.1, teamSlot)
      : null,
    moodEmoji: pickMoodEmoji(mood, visualElapsed, team),
    shellClass: primary.def.shellClass || "",
    brightness: mood.brightness ?? 1,
    pulse: !!mood.pulse || primary.key === "desperate" || primary.key === "losing",
    durationPhase: sideState.durationPhase,
    elapsedLabel: formatBattleElapsed(sideState.elapsed),
    floatPhase: visualElapsed + (EMOTION_ORBIT_PHASE[team] || 0),
    showTimer: !battleState.finished && !countdownActive,
  };
}

function ensureEmotionOrbit(shell, team) {
  let orbit = shell.querySelector(".avatar-emotion-orbit");
  if (!orbit) {
    orbit = document.createElement("div");
    orbit.className = "avatar-emotion-orbit";
    orbit.dataset.team = team;
    orbit.innerHTML = `
      <span class="avatar-emotion-float avatar-emotion-kayfu avatar-emotion-kayfu-active" aria-hidden="true">${KAYFU_EMOJI}</span>
      <span class="avatar-emotion-float avatar-emotion-mood" aria-hidden="true"></span>
      <span class="avatar-emotion-float avatar-emotion-reaction" aria-hidden="true"></span>
      <span class="avatar-battle-timer" aria-hidden="true" hidden></span>
    `;
    const stage = shell.querySelector(".avatar-hero-stage");
    if (stage) stage.prepend(orbit);
  }
  if (!orbit.querySelector(".avatar-emotion-kayfu")) {
    const kayfu = document.createElement("span");
    kayfu.className = "avatar-emotion-float avatar-emotion-kayfu avatar-emotion-kayfu-active";
    kayfu.textContent = KAYFU_EMOJI;
    kayfu.setAttribute("aria-hidden", "true");
    orbit.prepend(kayfu);
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

function layoutEmotionFloat(el, emoji, phase, slotIndex, options = {}) {
  if (!el) return;
  const show = !!emoji;
  if (show && el.textContent !== emoji) {
    el.textContent = emoji;
    el.classList.remove("avatar-emotion-pop");
    void el.offsetWidth;
    el.classList.add("avatar-emotion-pop");
  }
  if (show) {
    const angle = phase * 0.9 + slotIndex * Math.PI * 0.85;
    const rx = 38 + Math.sin(phase * 0.7 + slotIndex) * 8;
    const ry = 32 + Math.cos(phase * 0.55 + slotIndex * 1.2) * 10;
    const x = 50 + Math.cos(angle) * rx;
    const y = 28 + Math.sin(angle) * ry;
    el.style.setProperty("--emo-x", `${x}%`);
    el.style.setProperty("--emo-y", `${y}%`);
    el.style.setProperty("--emo-rot", `${Math.sin(phase * 1.1 + slotIndex) * 12}deg`);
  }
  el.hidden = !show;
  if (options.moodPulse) {
    el.hidden = false;
    el.classList.toggle("avatar-emotion-mood-active", show);
  }
}

function layoutKayfuFloat(el, phase, team) {
  if (!el) return;
  el.textContent = KAYFU_EMOJI;
  const side = team === "player" ? -1 : 1;
  const x = 50 + side * 36 + Math.sin(phase * 0.45 + 0.6) * 5;
  const y = 44 + Math.cos(phase * 0.38 + 1.2) * 6;
  el.style.setProperty("--emo-x", `${x}%`);
  el.style.setProperty("--emo-y", `${y}%`);
  el.style.setProperty("--emo-rot", `${-6 + Math.sin(phase * 0.55) * 10}deg`);
  el.hidden = false;
  el.classList.add("avatar-emotion-kayfu-active");
}

function hashEffectSlot(key, team) {
  let h = team === "enemy" ? 17 : 3;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) % 997;
  return h;
}

function layoutEffectHop(el, key, team, tick) {
  const h = hashEffectSlot(key, team);
  const jumpEvery = 2.8 + (h % 10) * 0.26;
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

const EFFECT_ORBIT_ICON_BY_ID = {
  block: "🛡",
  "dodge-ready": "💨",
  "stack-block": "🛡",
  "stack-spikes": "📌",
  "stack-empower": "⚡",
  "stack-regen": "💚",
  "stack-heat": "🔥",
  "stack-mana": "✨",
  "stack-luck": "🍀",
  poison: "☠",
  slow: "🐌",
  "ground-fire": "🔥",
  stun: "😵",
  invuln: "✨",
  revive: "💫",
  "arena-fatigue": "😮‍💨",
};

function firstGrapheme(text) {
  const raw = String(text || "✨");
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(raw)];
    if (seg[0]?.segment) return seg[0].segment;
  }
  return raw.charAt(0) || "✨";
}

function normalizeEffectOrbitIcon(chip) {
  if (EFFECT_ORBIT_ICON_BY_ID[chip.id]) return EFFECT_ORBIT_ICON_BY_ID[chip.id];
  return firstGrapheme(chip.icon);
}

function formatEffectOrbitCount(value) {
  const n = Math.ceil(Number(value) || 0);
  if (n <= 1) return 0;
  return Math.min(99, n);
}

function collectEffectOrbitItems(profile) {
  const items = [];
  const buffs = profile?.buffs || [];
  const hasBlockBuff = buffs.some((chip) => chip.id === "block");

  buffs.forEach((chip) => {
    if (hasBlockBuff && chip.id === "stack-block") return;
    items.push({
      key: `buff-${chip.id}`,
      icon: normalizeEffectOrbitIcon(chip),
      kind: "buff",
      count: formatEffectOrbitCount(chip.value),
    });
  });
  (profile?.debuffs || []).forEach((chip) => {
    if (chip.id === "arena-fatigue") return;
    items.push({
      key: `debuff-${chip.id}`,
      icon: normalizeEffectOrbitIcon(chip),
      kind: "debuff",
      count: formatEffectOrbitCount(chip.value),
    });
  });
  return items.slice(0, 6);
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

function applyEmotionPresentation(team, presentation, profile, state) {
  if (!presentation) return;
  const slot = typeof getAvatarSlotEl === "function" ? getAvatarSlotEl(team) : null;
  const shell = slot?.querySelector(".avatar-hero-shell");
  if (!shell) return;

  const { orbit } = ensureEmotionOrbit(shell, team);
  const kayfuEl = orbit.querySelector(".avatar-emotion-kayfu");
  const moodEl = orbit.querySelector(".avatar-emotion-mood");
  const reactionEl = orbit.querySelector(".avatar-emotion-reaction");
  const timerEl = orbit.querySelector(".avatar-battle-timer");

  layoutKayfuFloat(kayfuEl, presentation.floatPhase, team);

  const moodVisible = resolveMoodPulseVisible(state, team);
  layoutEmotionFloat(
    moodEl,
    moodVisible ? presentation.moodEmoji : null,
    presentation.floatPhase,
    0,
    { moodPulse: true },
  );

  const reactionEmoji = presentation.primaryEmoji !== presentation.moodEmoji
    ? presentation.primaryEmoji
    : (presentation.secondaryEmoji || null);
  layoutEmotionFloat(reactionEl, reactionEmoji, presentation.floatPhase + 0.8, 1);

  if (timerEl) {
    timerEl.textContent = presentation.showTimer ? presentation.elapsedLabel : "";
    timerEl.hidden = !presentation.showTimer;
  }

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

  applyEmotionPresentation("player", resolveEmotionPresentation(state, "player"), playerProfile, state);
  applyEmotionPresentation("enemy", resolveEmotionPresentation(state, "enemy"), enemyProfile, state);
}

function hideBattleTimerDisplay() {
  document.querySelectorAll(".avatar-battle-timer").forEach((el) => {
    el.textContent = "";
    el.hidden = true;
  });
  const overlay = document.getElementById("battle-countdown-overlay");
  if (overlay) overlay.hidden = true;
}

function clearBattleEmotions() {
  hideBattleTimerDisplay();
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

function tickBattleEmotions(state) {
  if (!state || state.finished) return;
  updateBattleAnalyzer(state, 0);
  updateBattleEmotions(state);
  if (typeof syncIncomingDpsTooltip === "function") {
    syncIncomingDpsTooltip("player", state);
    syncIncomingDpsTooltip("enemy", state);
  }
}
