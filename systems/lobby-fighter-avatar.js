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

    const statusEl = chip.querySelector("[data-lobby-fighter-status]");
    if (!statusEl) return;
    const ctx = getLobbyFighterBattleContext(fighterId, lobby, matches);
    const chips = collectLobbyFighterStatusChips(ctx);
    const sig = buildLobbyFighterStatusSignature(chips);
    if (statusEl.dataset.statusSig === sig) {
      statusEl.hidden = chips.length === 0;
      return;
    }
    statusEl.dataset.statusSig = sig;
    statusEl.hidden = chips.length === 0;
    statusEl.innerHTML = renderLobbyBattleStatusHTML(ctx);
    chip.classList.toggle("lobby-battle-bottom-chip--has-status", chips.length > 0);
  });
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
  syncLobbyBattleBottomChipMetrics(lobby, rosterOpts);
}

window.syncLobbyBattleBottomChipMetrics = syncLobbyBattleBottomChipMetrics;
window.getLobbyFighterBattleContext = getLobbyFighterBattleContext;
window.renderLobbyBattleStatusHTML = renderLobbyBattleStatusHTML;

window.syncLobbyFighterAvatars = syncLobbyFighterAvatars;
window.getLobbyFighterLiveHp = getLobbyFighterLiveHp;
window.findLobbyMatchForFighter = findLobbyMatchForFighter;
window.resolveLobbyFighterAvatarVisual = resolveLobbyFighterAvatarVisual;
