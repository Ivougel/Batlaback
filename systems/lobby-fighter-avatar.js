/**
 * Компактные emoji-аватары в карточках лобби: орбита в prep, эмоции в бою.
 */

function getLobbyFighterClassEmoji(classId) {
  const cls = typeof getClassById === "function"
    ? getClassById(classId)
    : (typeof CLASS_CATALOG !== "undefined" ? CLASS_CATALOG[classId] : null);
  return cls?.icon || "❓";
}

function getLobbyFighterDisplayEmoji(fighter, round = 1) {
  if (typeof getLobbyFighterMutationEmoji === "function") {
    const mutationEmoji = getLobbyFighterMutationEmoji(fighter, round);
    if (mutationEmoji) return mutationEmoji;
  } else if (fighter?.mutationId && typeof getMutationUiEmoji === "function") {
    return getMutationUiEmoji(fighter.mutationId);
  } else {
    const formRound = typeof MUTATION_ROUND_FORM !== "undefined" ? MUTATION_ROUND_FORM : 8;
    if (fighter?.mutationFormId && round >= formRound && typeof getMutationUiEmoji === "function") {
      return getMutationUiEmoji(fighter.mutationFormId);
    }
  }
  return getLobbyFighterClassEmoji(fighter?.classId);
}

function splitPrimaryEmoji(text) {
  const raw = String(text || "").trim();
  if (!raw) return "❓";
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
    const first = [...seg.segment(raw)][0]?.segment;
    if (first) return first;
  }
  return [...raw][0] || raw;
}

const lobbyFighterEmotionById = new Map();
const lobbyMatchEmotionSnaps = new Map();

function lobbyEmotionAnimationClass(animation) {
  const map = {
    shake: "lobby-fighter-emoji--shake",
    bounce: "lobby-fighter-emoji--bounce",
    nod: "lobby-fighter-emoji--nod",
    wobble: "lobby-fighter-emoji--wobble",
    grow: "lobby-fighter-emoji--pulse",
    pulse: "lobby-fighter-emoji--pulse",
    fly: "lobby-fighter-emoji--live",
    particles: "lobby-fighter-emoji--shake",
  };
  return map[String(animation || "").toLowerCase()] || "lobby-fighter-emoji--live";
}

function lobbyEmotionModeFromAnimation(animation) {
  return lobbyEmotionAnimationClass(animation).replace("lobby-fighter-emoji--", "") || "live";
}

function clearLobbyFighterEmotions() {
  lobbyFighterEmotionById.clear();
  lobbyMatchEmotionSnaps.clear();
}

function setLobbyFighterEmotion(fighterId, { emoji, animation, priority = 1 }) {
  const prev = lobbyFighterEmotionById.get(fighterId);
  const pri = priority ?? 1;
  const nextEmoji = splitPrimaryEmoji(emoji);
  if (prev && pri < (prev.priority ?? 0)) return;
  if (prev && pri === (prev.priority ?? 0) && prev.emoji === nextEmoji) return;

  lobbyFighterEmotionById.set(fighterId, {
    emoji: nextEmoji,
    animation: animation || "nod",
    animClass: lobbyEmotionAnimationClass(animation),
    mode: lobbyEmotionModeFromAnimation(animation),
    priority: pri,
    at: Date.now(),
  });
}

function decayLobbyFighterEmotions() {
  const now = Date.now();
  lobbyFighterEmotionById.forEach((em, fighterId) => {
    const age = now - (em.at || 0);
    const pri = em.priority ?? 0;
    if (pri >= 4 && age > 2800) lobbyFighterEmotionById.delete(fighterId);
    else if (pri >= 2 && age > 2200) lobbyFighterEmotionById.delete(fighterId);
    else if (age > 1600) lobbyFighterEmotionById.delete(fighterId);
  });
}

function getSpectatedMainEmotion(side) {
  if (typeof getMainEmotion !== "function") return null;
  const em = getMainEmotion(side);
  if (!em?.emoji) return null;
  return {
    emoji: splitPrimaryEmoji(em.emoji),
    animation: em.animation || "nod",
    priority: em.priority ?? 3,
  };
}

function takeLobbyEmotionSnapshot(state) {
  return {
    playerHp: Math.max(0, state.player?.hp ?? 0),
    enemyHp: Math.max(0, state.enemy?.hp ?? 0),
    playerMax: Math.max(1, state.player?.maxHp ?? 100),
    enemyMax: Math.max(1, state.enemy?.maxHp ?? 100),
    playerPoison: state.player?.poisonStacks ?? 0,
    enemyPoison: state.enemy?.poisonStacks ?? 0,
  };
}

function inferBackgroundFighterEmotion(team, snap, prev) {
  const hp = snap[`${team}Hp`];
  const max = snap[`${team}Max`];
  const hpPct = hp / max;
  const poison = snap[`${team}Poison`];
  const prevHp = prev ? prev[`${team}Hp`] : hp;
  const loss = Math.max(0, prevHp - hp);
  const poisonGain = prev ? Math.max(0, poison - (prev[`${team}Poison`] ?? 0)) : 0;

  if (hpPct <= 0) return { emoji: "💀", animation: "shake", priority: 5 };
  if (poisonGain > 0 || poison >= 3) return { emoji: "🤢", animation: "shake", priority: 4 };
  if (loss > 15) return { emoji: hpPct < 0.25 ? "💀" : "😵‍💫", animation: "grow", priority: 5 };
  if (loss > 8) return { emoji: hpPct < 0.3 ? "😭" : "😤", animation: "shake", priority: 3 };
  if (loss > 2) return { emoji: "😮", animation: "shake", priority: 2 };
  if (hpPct < 0.2) return { emoji: "😱", animation: "shake", priority: 4 };
  if (hpPct < 0.35) return { emoji: "😰", animation: "wobble", priority: 2 };
  if (poison > 0) return { emoji: "😣", animation: "nod", priority: 2 };
  return null;
}

function syncSpectatedMatchEmotions(match) {
  if (!match?.state || match.state.finished || match.byeFighterId) return;
  const displayState = typeof getDisplayBattleState === "function" ? getDisplayBattleState() : null;
  if (!displayState || match.state !== displayState) return;

  [
    ["player", match.fighterAId],
    ["enemy", match.fighterBId],
  ].forEach(([team, fighterId]) => {
    const em = getSpectatedMainEmotion(team);
    if (!em?.emoji) return;
    setLobbyFighterEmotion(fighterId, em);
  });
}

function analyzeBackgroundMatchEmotions(match) {
  const state = match?.state;
  if (!state || state.finished || match.byeFighterId) return;

  const snap = takeLobbyEmotionSnapshot(state);
  const prev = lobbyMatchEmotionSnaps.get(match.id);

  [
    ["player", match.fighterAId],
    ["enemy", match.fighterBId],
  ].forEach(([team, fighterId]) => {
    const inferred = inferBackgroundFighterEmotion(team, snap, prev);
    if (inferred) setLobbyFighterEmotion(fighterId, inferred);
  });

  lobbyMatchEmotionSnaps.set(match.id, snap);
}

function refreshLobbyBattleEmotions(lobby, matches) {
  if (!matches?.length) return;
  const displayState = typeof getDisplayBattleState === "function" ? getDisplayBattleState() : null;

  matches.forEach((match) => {
    if (match.byeFighterId || !match.state || match.state.finished) return;
    if (displayState && match.state === displayState) syncSpectatedMatchEmotions(match);
    else analyzeBackgroundMatchEmotions(match);
  });

  decayLobbyFighterEmotions();
}

function findLobbyMatchForFighter(matches, fighterId) {
  if (!matches?.length) return null;
  return matches.find((match) => {
    if (match.byeFighterId) return match.byeFighterId === fighterId;
    return match.fighterAId === fighterId || match.fighterBId === fighterId;
  }) || null;
}

function getLobbyFighterLiveHp(fighterId, lobby, matches) {
  const fighter = lobby?.fighters?.[fighterId];
  const maxHp = typeof LOBBY_START_HP !== "undefined" ? LOBBY_START_HP : 100;
  if (!fighter) return { current: 0, max: maxHp, inBattle: false };
  if (!fighter.alive) return { current: 0, max: maxHp, inBattle: false };

  const match = findLobbyMatchForFighter(matches, fighterId);
  const state = match?.state;
  if (state && !state.finished && !match.byeFighterId) {
    const side = match.fighterAId === fighterId ? state.player : state.enemy;
    if (side) {
      return {
        current: side.hp ?? fighter.hp,
        max: side.maxHp ?? maxHp,
        inBattle: true,
      };
    }
  }
  return { current: fighter.hp, max: maxHp, inBattle: false };
}

function resolveLobbyFighterAvatarVisual(fighter, lobby, opts = {}) {
  const { phase = "prep", matches = [], spectateMatchId = 0, round = 1 } = opts;
  const baseEmoji = getLobbyFighterDisplayEmoji(fighter, round);
  const isMutation = !!fighter?.mutationId;
  const isForm = !isMutation && !!fighter?.mutationFormId && round >= (typeof MUTATION_ROUND_FORM !== "undefined" ? MUTATION_ROUND_FORM : 8);
  if (phase !== "battle" && phase !== "replay") {
    return {
      emoji: baseEmoji,
      mode: "prep-orbit",
      animClass: isMutation ? "lobby-fighter-emoji--mutation" : "",
      isMutation,
      isForm,
    };
  }

  const hp = getLobbyFighterLiveHp(fighter.id, lobby, matches);
  const stored = lobbyFighterEmotionById.get(fighter.id);

  if (stored && hp.inBattle) {
    return {
      emoji: stored.emoji,
      mode: stored.mode,
      animClass: stored.animClass,
      isMutation,
      isForm,
    };
  }

  if (hp.inBattle) {
    const hpPct = hp.max > 0 ? hp.current / hp.max : 1;
    return {
      emoji: baseEmoji,
      mode: "live",
      animClass: hpPct < 0.35 ? "lobby-fighter-emoji--wobble" : "lobby-fighter-emoji--live",
      isMutation,
      isForm,
    };
  }

  return {
    emoji: baseEmoji,
    mode: "battle-idle",
    animClass: "",
    isMutation,
    isForm,
  };
}

function syncLobbyFighterAvatarEl(el, visual) {
  if (!el) return;
  const emojiEl = el.querySelector(".lobby-fighter-emoji");
  if (!emojiEl) return;

  const nextEmoji = visual.emoji || "❓";
  if (emojiEl.textContent !== nextEmoji) emojiEl.textContent = nextEmoji;

  const modeClass = [
    "lobby-fighter-emoji--prep-orbit",
    "lobby-fighter-emoji--live",
    "lobby-fighter-emoji--pulse",
    "lobby-fighter-emoji--shake",
    "lobby-fighter-emoji--bounce",
    "lobby-fighter-emoji--nod",
    "lobby-fighter-emoji--wobble",
    "lobby-fighter-emoji--mutation",
  ];
  emojiEl.classList.remove(...modeClass);
  if (visual.mode === "prep-orbit") {
    emojiEl.classList.add("lobby-fighter-emoji--prep-orbit");
  } else if (visual.mode !== "battle-idle") {
    if (visual.animClass) emojiEl.classList.add(visual.animClass);
    else if (visual.mode) emojiEl.classList.add(`lobby-fighter-emoji--${visual.mode}`);
  }

  el.dataset.avatarMode = visual.mode || "";
  el.classList.toggle("lobby-fighter-card-avatar--mutation", !!visual.isMutation);
  el.classList.toggle("lobby-fighter-card-avatar--form", !!visual.isForm);
}

function getLobbyFighterBattleContext(fighterId, lobby, matches) {
  const match = findLobbyMatchForFighter(matches, fighterId);
  if (!match?.state || match.state.finished || match.byeFighterId) return null;
  const team = match.fighterAId === fighterId ? "player" : "enemy";
  const sideState = team === "player" ? match.state.player : match.state.enemy;
  if (!sideState) return null;
  return { match, team, sideState, battleState: match.state };
}

function escapeLobbyStatusAttr(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function collectLobbyFighterStatusChips(ctx) {
  if (!ctx?.sideState) return [];
  const side = ctx.sideState;
  const items = side.items || [];
  if (typeof collectBattleStatusEffects === "function") {
    const { buffs, debuffs } = collectBattleStatusEffects(side, items, ctx.battleState);
    return [...(buffs || []), ...(debuffs || [])];
  }
  if (typeof buildStatusChipEntries === "function") {
    return buildStatusChipEntries(side).map((chip) => ({
      id: chip.theme?.id || chip.icon,
      icon: chip.icon,
      value: chip.label,
      title: chip.icon,
      lines: [`${chip.icon} ${chip.label}`],
    }));
  }
  return [];
}

function buildLobbyFighterStatusSignature(chips) {
  return chips.map((chip) => `${chip.id}:${chip.icon}`).join("|");
}

function renderLobbyBattleStatusChipHTML(chip) {
  const icon = chip.icon || "•";
  const title = escapeLobbyStatusAttr((chip.lines || []).join(" · ") || chip.title || icon);
  return `<span class="lobby-battle-bottom-status-emoji" data-status-id="${escapeLobbyStatusAttr(chip.id)}" title="${title}" aria-hidden="true">${icon}</span>`;
}

function renderLobbyBattleStatusHTML(ctx, maxVisible = 5) {
  const chips = collectLobbyFighterStatusChips(ctx);
  if (!chips.length) return "";
  const seen = new Set();
  const unique = chips.filter((chip) => {
    const key = chip.id || chip.icon;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const visible = unique.slice(0, maxVisible);
  const overflow = unique.length - visible.length;
  const overflowHtml = overflow > 0
    ? `<span class="lobby-battle-bottom-status-emoji lobby-battle-bottom-status-emoji--more" title="+${overflow}">+${overflow}</span>`
    : "";
  return visible.map(renderLobbyBattleStatusChipHTML).join("") + overflowHtml;
}

function syncLobbyFighterCardHp(lobby, opts = {}) {
  if (!lobby) return;
  const matches = opts.matches || [];
  const maxHp = typeof LOBBY_START_HP !== "undefined" ? LOBBY_START_HP : 100;

  document.querySelectorAll("[data-lobby-fighter-card], [data-lobby-fighter]").forEach((card) => {
    const fighterId = Number(card.dataset.lobbyFighterCard || card.dataset.lobbyFighter);
    const fighter = lobby.fighters?.[fighterId];
    if (!fighter) return;

    const hp = getLobbyFighterLiveHp(fighterId, lobby, matches);
    const fill = card.querySelector(".lobby-fighter-card-hp-fill");
    const val = card.querySelector(".lobby-fighter-card-hp-val");
    if (fill) {
      const pct = Math.max(0, Math.min(100, (hp.current / Math.max(1, maxHp)) * 100));
      fill.style.width = `${pct}%`;
    }
    if (val) val.textContent = `♥ ${Math.ceil(hp.current)}`;
    card.classList.toggle("lobby-fighter-card--live", !!hp.inBattle);
    card.classList.toggle("lobby-fighter-card--out", !fighter.alive);
    card.classList.toggle("lobby-prep-field-chip--live", !!hp.inBattle);
    card.classList.toggle("lobby-prep-field-chip--out", !fighter.alive);
  });
}

function syncLobbyBattleBottomChipMetrics(lobby, opts = {}) {
  if (!lobby) return;
  const matches = opts.matches || [];
  const phase = opts.phase || document.getElementById("app")?.dataset.phase || "prep";
  if (phase !== "battle" && phase !== "replay") return;

  document.querySelectorAll(".lobby-battle-bottom-chip[data-lobby-fighter-card]").forEach((chip) => {
    const fighterId = Number(chip.dataset.lobbyFighterCard);
    const fighter = lobby.fighters?.[fighterId];
    if (!fighter) return;

    const hp = getLobbyFighterLiveHp(fighterId, lobby, matches);
    const hpEl = chip.querySelector(".lobby-battle-bottom-chip-hp");
    if (hpEl) hpEl.textContent = `♥ ${Math.ceil(hp.current)}`;
    chip.classList.toggle("lobby-battle-bottom-chip--live", !!hp.inBattle);
  });
}

function syncLobbyFighterAvatars(lobby, opts = {}) {
  if (!lobby) return;
  const phase = opts.phase || document.getElementById("app")?.dataset.phase || "prep";
  const rosterOpts = { ...opts, phase };

  if (phase === "battle" || phase === "replay") {
    refreshLobbyBattleEmotions(lobby, rosterOpts.matches || []);
  } else {
    clearLobbyFighterEmotions();
  }

  document.querySelectorAll("[data-lobby-fighter-avatar]").forEach((mount) => {
    const fighterId = Number(mount.dataset.lobbyFighterAvatar);
    const fighter = lobby.fighters?.[fighterId];
    if (!fighter) return;
    const visual = resolveLobbyFighterAvatarVisual(fighter, lobby, rosterOpts);
    syncLobbyFighterAvatarEl(mount, visual);
  });
  syncLobbyFighterCardHp(lobby, rosterOpts);
  syncLobbyBattleBottomChipMetrics(lobby, rosterOpts);
}

window.syncLobbyFighterCardHp = syncLobbyFighterCardHp;
window.syncLobbyBattleBottomChipMetrics = syncLobbyBattleBottomChipMetrics;
window.getLobbyFighterBattleContext = getLobbyFighterBattleContext;
window.renderLobbyBattleStatusHTML = renderLobbyBattleStatusHTML;

window.syncLobbyFighterAvatars = syncLobbyFighterAvatars;
window.clearLobbyFighterEmotions = clearLobbyFighterEmotions;
window.getLobbyFighterLiveHp = getLobbyFighterLiveHp;
window.getLobbyFighterDisplayEmoji = getLobbyFighterDisplayEmoji;
window.findLobbyMatchForFighter = findLobbyMatchForFighter;
window.resolveLobbyFighterAvatarVisual = resolveLobbyFighterAvatarVisual;
