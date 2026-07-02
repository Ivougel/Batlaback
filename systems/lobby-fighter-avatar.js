/**
 * Компактные emoji-аватары в карточках лобби: орбита в prep, эмоции в бою.
 */

function getLobbyFighterClassEmoji(classId) {
  const cls = typeof CLASS_CATALOG !== "undefined" ? CLASS_CATALOG[classId] : null;
  return cls?.icon || "❓";
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

function getSpectatedMainEmotion(side) {
  if (typeof getMainEmotion !== "function") return null;
  const em = getMainEmotion(side);
  if (!em?.emoji) return null;
  return {
    emoji: splitPrimaryEmoji(em.emoji),
    animation: em.animation || "",
  };
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

function getLobbyFighterDisplayEmoji(fighter, round = 1) {
  if (typeof getLobbyFighterMutationEmoji === "function") {
    return getLobbyFighterMutationEmoji(fighter, round);
  }
  if (fighter?.mutationId && typeof getMutationUiEmoji === "function") {
    return getMutationUiEmoji(fighter.mutationId);
  }
  const formRound = typeof MUTATION_ROUND_FORM !== "undefined" ? MUTATION_ROUND_FORM : 8;
  if (fighter?.mutationFormId && round >= formRound && typeof getMutationUiEmoji === "function") {
    return getMutationUiEmoji(fighter.mutationFormId);
  }
  return getLobbyFighterClassEmoji(fighter?.classId);
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

  const match = findLobbyMatchForFighter(matches, fighter.id);
  if (!match || match.byeFighterId || !match.state || match.state.finished) {
    return {
      emoji: baseEmoji,
      mode: "idle",
      animClass: isMutation ? "lobby-fighter-emoji--mutation" : "",
      isMutation,
      isForm,
    };
  }

  const spectateMatch = matches[spectateMatchId];
  const isSpectated = spectateMatch
    && !spectateMatch.byeFighterId
    && (spectateMatch.fighterAId === fighter.id || spectateMatch.fighterBId === fighter.id);

  if (isSpectated) {
    const side = match.fighterAId === fighter.id ? "player" : "enemy";
    const em = getSpectatedMainEmotion(side);
    if (em?.emoji) {
      const animClass = em.animation ? `lobby-fighter-emoji--${em.animation}` : "lobby-fighter-emoji--live";
      return {
        emoji: em.emoji,
        mode: "battle-emotion",
        animClass,
        isMutation,
        isForm,
      };
    }
  }

  return {
    emoji: isMutation ? baseEmoji : "⚔️",
    mode: "battle-bg",
    animClass: isMutation ? "lobby-fighter-emoji--mutation" : "lobby-fighter-emoji--pulse",
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
  } else if (visual.animClass) {
    emojiEl.classList.add(visual.animClass);
  }

  el.dataset.avatarMode = visual.mode || "";
  el.classList.toggle("lobby-fighter-card-avatar--mutation", !!visual.isMutation);
  el.classList.toggle("lobby-fighter-card-avatar--form", !!visual.isForm);
}

function syncLobbyFighterAvatars(lobby, opts = {}) {
  if (!lobby) return;
  const phase = opts.phase || document.getElementById("app")?.dataset.phase || "prep";
  const rosterOpts = { ...opts, phase };

  document.querySelectorAll("[data-lobby-fighter-avatar]").forEach((mount) => {
    const fighterId = Number(mount.dataset.lobbyFighterAvatar);
    const fighter = lobby.fighters?.[fighterId];
    if (!fighter) return;
    const visual = resolveLobbyFighterAvatarVisual(fighter, lobby, rosterOpts);
    syncLobbyFighterAvatarEl(mount, visual);
  });
}

window.syncLobbyFighterAvatars = syncLobbyFighterAvatars;
window.getLobbyFighterLiveHp = getLobbyFighterLiveHp;
window.findLobbyMatchForFighter = findLobbyMatchForFighter;
window.resolveLobbyFighterAvatarVisual = resolveLobbyFighterAvatarVisual;
