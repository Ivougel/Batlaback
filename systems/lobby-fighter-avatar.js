/**
 * Мысли героев в лобби: кружки участников показывают эмоции/мысли, а не иконки классов.
 * Работает в prep, battle и replay; в solo prep — на персонажах под полем.
 */

const LOBBY_THOUGHT_TICK_MS = 2400;
const LOBBY_AMBIENT_INTERVAL_MS = 16000;
const SOLO_PREP_THOUGHT_TICK_MS = 3200;
const MIN_FIGHTER_EMOJI_HOLD_MS = 7000;
const MIN_FIGHTER_EMOJI_HOLD_URGENT_MS = 2800;

const CLASS_PERSONALITY_THOUGHTS = {
  warrior: ["😤", "💪", "🗿", "😠"],
  rogue: ["😏", "😼", "👀", "💨"],
  mage: ["🤔", "✨", "😌", "🧐"],
  priest: ["🙏", "😇", "💭", "😊"],
};

const PREP_AMBIENT_THOUGHTS = ["🛍️", "📦", "💭", "😌", "🤔", "😏", "💪"];

const lobbyFighterEmotionById = new Map();
const lobbyFighterMainThoughtById = new Map();
const lobbyFighterLastEmojiChangeAt = new Map();
const lobbyMatchEmotionSnaps = new Map();
const soloPrepThoughtBySide = { player: null, enemy: null };

let lobbyThoughtLastTickAt = 0;
let lobbyAmbientLastAt = 0;
let soloPrepThoughtLastAt = 0;
let lobbyPrepTimerThoughtSec = null;
let lobbyPrepOpponentThoughtId = null;

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

function canChangeFighterEmoji(fighterId, priority = 0) {
  const last = lobbyFighterLastEmojiChangeAt.get(fighterId) || 0;
  const minGap = priority >= 4 ? 1800 : (priority >= 3 ? MIN_FIGHTER_EMOJI_HOLD_URGENT_MS : MIN_FIGHTER_EMOJI_HOLD_MS);
  return Date.now() - last >= minGap;
}

function markFighterEmojiChanged(fighterId) {
  lobbyFighterLastEmojiChangeAt.set(fighterId, Date.now());
}

function pickFromPool(pool) {
  if (!pool?.length) return "🤔";
  return pool[Math.floor(Math.random() * pool.length)];
}

function getClassPersonalityThought(classId) {
  return pickFromPool(CLASS_PERSONALITY_THOUGHTS[classId] || ["🤔", "😌", "🗿"]);
}

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

function makeThoughtVisual(emoji, animation = "nod", priority = 0) {
  const anim = animation || "nod";
  return {
    emoji: splitPrimaryEmoji(emoji),
    animation: anim,
    animClass: lobbyEmotionAnimationClass(anim),
    mode: lobbyEmotionModeFromAnimation(anim),
    priority: priority ?? 0,
    at: Date.now(),
  };
}

function clearLobbyFighterEmotions() {
  lobbyFighterEmotionById.clear();
  lobbyMatchEmotionSnaps.clear();
}

function resetLobbyFighterThoughts() {
  lobbyFighterMainThoughtById.clear();
  lobbyFighterLastEmojiChangeAt.clear();
  clearLobbyFighterEmotions();
  soloPrepThoughtBySide.player = null;
  soloPrepThoughtBySide.enemy = null;
  lobbyThoughtLastTickAt = 0;
  lobbyAmbientLastAt = 0;
  soloPrepThoughtLastAt = 0;
  lobbyPrepTimerThoughtSec = null;
  lobbyPrepOpponentThoughtId = null;
}

function ensureLobbyFighterMainThought(fighterId, fighter) {
  if (lobbyFighterMainThoughtById.has(fighterId)) return;
  lobbyFighterMainThoughtById.set(
    fighterId,
    makeThoughtVisual(getClassPersonalityThought(fighter?.classId), "nod", 0),
  );
}

function seedLobbyFighterThoughts(lobby) {
  if (!lobby?.fighters?.length) return;
  lobby.fighters.forEach((fighter) => {
    ensureLobbyFighterMainThought(fighter.id, fighter);
    if (!fighter.alive) {
      lobbyFighterMainThoughtById.set(fighter.id, makeThoughtVisual("💀", "shake", 0));
    }
  });
}

function setLobbyFighterMainThought(fighterId, emoji, animation = "nod") {
  const nextEmoji = splitPrimaryEmoji(emoji);
  const prev = lobbyFighterMainThoughtById.get(fighterId);
  if (prev?.emoji === nextEmoji) return false;
  if (!canChangeFighterEmoji(fighterId, 0)) return false;
  lobbyFighterMainThoughtById.set(fighterId, makeThoughtVisual(nextEmoji, animation, 0));
  markFighterEmojiChanged(fighterId);
  return true;
}

function setLobbyFighterEmotion(fighterId, { emoji, animation, priority = 1 }) {
  const prev = lobbyFighterEmotionById.get(fighterId);
  const pri = priority ?? 1;
  const nextEmoji = splitPrimaryEmoji(emoji);
  if (prev && pri < (prev.priority ?? 0)) return false;
  if (prev && pri === (prev.priority ?? 0) && prev.emoji === nextEmoji) return false;
  if (!canChangeFighterEmoji(fighterId, pri)) return false;

  lobbyFighterEmotionById.set(fighterId, {
    emoji: nextEmoji,
    animation: animation || "nod",
    animClass: lobbyEmotionAnimationClass(animation),
    mode: lobbyEmotionModeFromAnimation(animation),
    priority: pri,
    at: Date.now(),
  });
  markFighterEmojiChanged(fighterId);
  return true;
}

function decayLobbyFighterEmotions() {
  const now = Date.now();
  let changed = false;
  lobbyFighterEmotionById.forEach((em, fighterId) => {
    const age = now - (em.at || 0);
    const pri = em.priority ?? 0;
    if (pri >= 4 && age > 7200) {
      lobbyFighterEmotionById.delete(fighterId);
      changed = true;
    } else if (pri >= 2 && age > 5800) {
      lobbyFighterEmotionById.delete(fighterId);
      changed = true;
    } else if (age > 4500) {
      lobbyFighterEmotionById.delete(fighterId);
      changed = true;
    }
  });
  return changed;
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
    setLobbyFighterMainThought(fighterId, em.emoji, em.animation);
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
    if (inferred) {
      setLobbyFighterEmotion(fighterId, inferred);
      setLobbyFighterMainThought(fighterId, inferred.emoji, inferred.animation);
    }
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

function pickPrepAmbientThought(fighter) {
  const classPool = CLASS_PERSONALITY_THOUGHTS[fighter?.classId] || [];
  return pickFromPool([...classPool, ...PREP_AMBIENT_THOUGHTS]);
}

function tickLobbyPrepContextThoughts(lobby, opts = {}) {
  const {
    matches = [],
    timerRemaining = null,
    timerActive = false,
  } = opts;
  let dirty = false;

  lobby.fighters.forEach((fighter) => {
    ensureLobbyFighterMainThought(fighter.id, fighter);
    if (!fighter.alive) {
      if (setLobbyFighterMainThought(fighter.id, "💀", "shake")) dirty = true;
      if (setLobbyFighterEmotion(fighter.id, { emoji: "💀", animation: "shake", priority: 5 })) dirty = true;
      return;
    }

    const hp = getLobbyFighterLiveHp(fighter.id, lobby, matches);
    const hpPct = hp.max > 0 ? hp.current / hp.max : 1;

    if (hpPct < 0.2) {
      if (setLobbyFighterEmotion(fighter.id, { emoji: "😱", animation: "shake", priority: 4 })) dirty = true;
      return;
    }
    if (hpPct < 0.35) {
      if (setLobbyFighterEmotion(fighter.id, { emoji: "😰", animation: "wobble", priority: 3 })) dirty = true;
      return;
    }

    if (timerActive && timerRemaining != null && timerRemaining <= 12) {
      if (fighter.isHuman) {
        const timerSec = Math.floor(timerRemaining);
        if (lobbyPrepTimerThoughtSec !== timerSec) {
          lobbyPrepTimerThoughtSec = timerSec;
          const emoji = timerSec <= 3 ? "😱" : (timerSec <= 8 ? "⏰" : "😤");
          if (setLobbyFighterEmotion(fighter.id, {
            emoji,
            animation: timerSec <= 5 ? "wobble" : "nod",
            priority: 3,
          })) dirty = true;
        }
      }
      return;
    }

    if (fighter.id === lobby.currentOpponentId && !hp.inBattle) {
      if (lobbyPrepOpponentThoughtId !== fighter.id) {
        lobbyPrepOpponentThoughtId = fighter.id;
        if (setLobbyFighterEmotion(fighter.id, { emoji: "😏", animation: "nod", priority: 1 })) dirty = true;
      }
    }
  });

  const now = Date.now();
  if (now - lobbyAmbientLastAt >= LOBBY_AMBIENT_INTERVAL_MS) {
    lobbyAmbientLastAt = now;
    const alive = lobby.fighters.filter((f) => f.alive);
    if (alive.length) {
      const fighter = alive[Math.floor(Math.random() * alive.length)];
      const emoji = pickPrepAmbientThought(fighter);
      const emoChanged = setLobbyFighterEmotion(fighter.id, { emoji, animation: "nod", priority: 1 });
      const mainChanged = setLobbyFighterMainThought(fighter.id, emoji, "nod");
      if (emoChanged || mainChanged) dirty = true;
    }
  }

  if (decayLobbyFighterEmotions()) dirty = true;
  return dirty;
}

function tickLobbyFighterThoughts(lobby, opts = {}) {
  if (!lobby) return false;
  const now = Date.now();
  if (now - lobbyThoughtLastTickAt < LOBBY_THOUGHT_TICK_MS) return false;
  lobbyThoughtLastTickAt = now;

  const phase = opts.phase || document.getElementById("app")?.dataset.phase || "prep";
  const matches = opts.matches || [];

  seedLobbyFighterThoughts(lobby);

  if (phase === "battle" || phase === "replay") {
    refreshLobbyBattleEmotions(lobby, matches);
    return true;
  }

  return tickLobbyPrepContextThoughts(lobby, opts);
}

function buildSoloPrepThought(side) {
  const classId = side === "player"
    ? (typeof playerClass !== "undefined" ? playerClass : "warrior")
    : (typeof enemyClass !== "undefined" ? enemyClass : "rogue");
  const st = typeof getSideState === "function" ? getSideState(side) : null;
  const maxHp = Math.max(1, st?.maxHp ?? 100);
  const hpPct = (st?.hp ?? maxHp) / maxHp;

  if (hpPct < 0.2) return makeThoughtVisual("😱", "shake", 3);
  if (hpPct < 0.35) return makeThoughtVisual("😰", "wobble", 2);
  return makeThoughtVisual(getClassPersonalityThought(classId), "nod", 0);
}

function syncSoloPrepCharacterThought(side, thought) {
  const el = document.getElementById(side === "player" ? "prep-character-player" : "prep-character-enemy");
  if (!el || el.hasAttribute("hidden")) return;
  const emojiEl = el.querySelector(".prep-character-emoji");
  if (emojiEl && thought?.emoji) emojiEl.textContent = thought.emoji;
}

function tickSoloPrepThoughts() {
  const now = Date.now();
  if (now - soloPrepThoughtLastAt < SOLO_PREP_THOUGHT_TICK_MS) return false;
  soloPrepThoughtLastAt = now;

  let dirty = false;
  ["player", "enemy"].forEach((side) => {
    const next = buildSoloPrepThought(side);
    const prev = soloPrepThoughtBySide[side];
    if (!prev || (prev.emoji !== next.emoji && Math.random() > 0.82)) {
      if (Math.random() > 0.55) {
        const classId = side === "player"
          ? (typeof playerClass !== "undefined" ? playerClass : "warrior")
          : (typeof enemyClass !== "undefined" ? enemyClass : "rogue");
        soloPrepThoughtBySide[side] = makeThoughtVisual(
          pickFromPool([...CLASS_PERSONALITY_THOUGHTS[classId] || [], ...PREP_AMBIENT_THOUGHTS]),
          "nod",
          0,
        );
      } else {
        soloPrepThoughtBySide[side] = next;
      }
      dirty = true;
    }
    syncSoloPrepCharacterThought(side, soloPrepThoughtBySide[side]);
  });

  return dirty;
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

function resolveLobbyThoughtVisual(fighter, lobby, opts = {}) {
  const { phase = "prep", matches = [] } = opts;
  ensureLobbyFighterMainThought(fighter.id, fighter);

  const isMutation = !!fighter?.mutationId;
  const isForm = !isMutation && !!fighter?.mutationFormId
    && (opts.round ?? 1) >= (typeof MUTATION_ROUND_FORM !== "undefined" ? MUTATION_ROUND_FORM : 8);

  if (!fighter.alive) {
    return {
      emoji: "💀",
      mode: "live",
      animClass: "lobby-fighter-emoji--shake",
      isMutation,
      isForm,
    };
  }

  const hp = getLobbyFighterLiveHp(fighter.id, lobby, matches);
  const transient = lobbyFighterEmotionById.get(fighter.id);
  if (transient) {
    return {
      emoji: transient.emoji,
      mode: transient.mode,
      animClass: transient.animClass,
      isMutation,
      isForm,
    };
  }

  const main = lobbyFighterMainThoughtById.get(fighter.id);
  const mainEmoji = main?.emoji || getClassPersonalityThought(fighter.classId);
  const mainAnim = main?.animClass || "lobby-fighter-emoji--nod";

  if (hp.inBattle) {
    const hpPct = hp.max > 0 ? hp.current / hp.max : 1;
    if (hpPct < 0.2) {
      return { emoji: "😱", mode: "live", animClass: "lobby-fighter-emoji--shake", isMutation, isForm };
    }
    if (hpPct < 0.35) {
      return { emoji: "😰", mode: "wobble", animClass: "lobby-fighter-emoji--wobble", isMutation, isForm };
    }
    return {
      emoji: mainEmoji,
      mode: main?.mode || "live",
      animClass: mainAnim || "lobby-fighter-emoji--live",
      isMutation,
      isForm,
    };
  }

  return {
    emoji: mainEmoji,
    mode: phase === "prep" ? "prep-orbit" : (main?.mode || "nod"),
    animClass: phase === "prep" ? "" : (mainAnim || ""),
    isMutation,
    isForm,
  };
}

function resolveLobbyFighterAvatarVisual(fighter, lobby, opts = {}) {
  return resolveLobbyThoughtVisual(fighter, lobby, opts);
}

function syncLobbyFighterAvatarEl(el, visual) {
  if (!el) return;
  const emojiEl = el.querySelector(".lobby-fighter-emoji");
  if (!emojiEl) return;

  const nextEmoji = visual.emoji || "🤔";
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

  let nextAnimKey = "none";
  if (visual.mode === "prep-orbit") nextAnimKey = "prep-orbit";
  else if (visual.mode !== "battle-idle") {
    nextAnimKey = visual.animClass || (visual.mode ? `lobby-fighter-emoji--${visual.mode}` : "none");
  }

  if (emojiEl.dataset.thoughtEmoji !== nextEmoji) {
    emojiEl.dataset.thoughtEmoji = nextEmoji;
    emojiEl.textContent = nextEmoji;
  }

  if (emojiEl.dataset.thoughtAnim !== nextAnimKey) {
    emojiEl.dataset.thoughtAnim = nextAnimKey;
    emojiEl.classList.remove(...modeClass);
    if (visual.mode === "prep-orbit") {
      emojiEl.classList.add("lobby-fighter-emoji--prep-orbit");
    } else if (visual.mode !== "battle-idle") {
      if (visual.animClass) emojiEl.classList.add(visual.animClass);
      else if (visual.mode) emojiEl.classList.add(`lobby-fighter-emoji--${visual.mode}`);
    }
  }

  el.dataset.avatarMode = visual.mode || "";
  el.dataset.avatarThought = nextEmoji;
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

  seedLobbyFighterThoughts(lobby);
  if (phase === "battle" || phase === "replay") {
    refreshLobbyBattleEmotions(lobby, rosterOpts.matches || []);
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
window.resetLobbyFighterThoughts = resetLobbyFighterThoughts;
window.seedLobbyFighterThoughts = seedLobbyFighterThoughts;
window.tickLobbyFighterThoughts = tickLobbyFighterThoughts;
window.tickSoloPrepThoughts = tickSoloPrepThoughts;
window.getLobbyFighterLiveHp = getLobbyFighterLiveHp;
window.getLobbyFighterDisplayEmoji = getLobbyFighterDisplayEmoji;
window.findLobbyMatchForFighter = findLobbyMatchForFighter;
window.resolveLobbyFighterAvatarVisual = resolveLobbyFighterAvatarVisual;
