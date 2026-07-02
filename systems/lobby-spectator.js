/**
 * Лобби: таймер подготовки, ростер участников, параллельные бои и наблюдение.
 */

const LOBBY_PREP_SECONDS = 50;
const LOBBY_PREP_OVERTIME_SEC = 12;

function cloneLobbyBattleItem(item) {
  return {
    uid: item.uid,
    itemId: item.itemId,
    col: item.col,
    row: item.row,
    rotation: item.rotation || 0,
    runtime: item.runtime ? { ...item.runtime } : null,
  };
}

function fighterBattleItems(fighter) {
  return flattenContainersForBattle(fighter.containers, fighter.items).map(cloneLobbyBattleItem);
}

function shuffleLobbyArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildLobbyRoundMatches(lobby) {
  const player = getLobbyPlayer(lobby);
  const opponent = getLobbyOpponent(lobby);
  const matches = [];
  const used = new Set();

  if (player?.alive && opponent?.alive) {
    matches.push({
      id: matches.length,
      fighterAId: player.id,
      fighterBId: opponent.id,
      isPlayerMatch: true,
      state: null,
      finished: false,
    });
    used.add(player.id);
    used.add(opponent.id);
  }

  const pool = getAliveLobbyFighters(lobby).filter((f) => !used.has(f.id));
  shuffleLobbyArray(pool);
  if (pool.length % 2 === 1) {
    const byeFighter = pool.pop();
    matches.push({
      id: matches.length,
      byeFighterId: byeFighter.id,
      isPlayerMatch: false,
      state: null,
      finished: true,
      winnerSide: "bye",
    });
  }
  for (let i = 0; i < pool.length; i += 2) {
    matches.push({
      id: matches.length,
      fighterAId: pool[i].id,
      fighterBId: pool[i + 1].id,
      isPlayerMatch: false,
      state: null,
      finished: false,
    });
  }
  return matches;
}

function createLobbyMatchState(match, lobby, battleRound) {
  const fighterA = lobby.fighters[match.fighterAId];
  const fighterB = lobby.fighters[match.fighterBId];
  if (!fighterA || !fighterB) return null;
  if (typeof syncLobbyFighterMutationMilestones === "function") {
    syncLobbyFighterMutationMilestones(fighterA, battleRound);
    syncLobbyFighterMutationMilestones(fighterB, battleRound);
  }
  const state = createBattleState(
    fighterBattleItems(fighterA),
    fighterBattleItems(fighterB),
    fighterA.classId,
    fighterB.classId,
    battleRound,
    {
      player: typeof lobbyFighterPrepMeta === "function" ? lobbyFighterPrepMeta(fighterA) : {},
      enemy: typeof lobbyFighterPrepMeta === "function" ? lobbyFighterPrepMeta(fighterB) : {},
    },
  );
  state.recording = !!match.isPlayerMatch;
  if (state.recording) {
    state.replayFrames = [captureBattleFrame(state)];
    state.lastRecordAt = 0;
  } else {
    state.replayFrames = [];
    state.lastRecordAt = 0;
  }
  match.state = state;
  return state;
}

function initLobbyRoundBattles(lobby, battleRound) {
  const matches = buildLobbyRoundMatches(lobby);
  matches.forEach((match) => {
    if (!match.byeFighterId) createLobbyMatchState(match, lobby, battleRound);
  });
  return matches;
}

function isLobbyMatchFullySimulated(match, matchIndex, opts = {}) {
  const { spectateMatchId = 0 } = opts;
  if (!match || match.byeFighterId || !match.state || match.state.finished) return false;
  return matchIndex === spectateMatchId;
}

function getLobbyBackgroundSimHz() {
  if (typeof window.BattleFxTier?.isLightBattleFx === "function" && window.BattleFxTier.isLightBattleFx()) {
    return 3;
  }
  return 5;
}

function getLobbyMatchFighter(lobby, fighterId, side) {
  const match = lobby;
  const fighter = match.fighters[fighterId];
  if (!fighter) return null;
  return fighter;
}

function getLobbyMatchLabels(lobby, match) {
  if (match.byeFighterId) {
    const f = lobby.fighters[match.byeFighterId];
    return { a: f?.name || "—", b: "bye", short: `${f?.name || "—"} (bye)` };
  }
  const a = lobby.fighters[match.fighterAId];
  const b = lobby.fighters[match.fighterBId];
  return {
    a: a?.name || "—",
    b: b?.name || "—",
    short: `${a?.name || "—"} vs ${b?.name || "—"}`,
  };
}

function areAllLobbyMatchesFinished(matches) {
  if (!matches?.length) return true;
  return matches.every((match) => {
    if (match.byeFighterId) return true;
    return match.finished || match.state?.finished;
  });
}

function countActiveLobbyMatches(matches) {
  if (!matches?.length) return 0;
  return matches.filter((match) => {
    if (match.byeFighterId) return false;
    return match.state && !match.state.finished;
  }).length;
}

function tickLobbyMatchState(match, dt, simDtFn, lobby = null) {
  if (!match?.state || match.state.finished || match.byeFighterId) {
    if (match?.state?.finished) match.finished = true;
    return;
  }
  const state = match.state;
  const countdownDt = typeof getBattleCountdownDt === "function" ? getBattleCountdownDt(dt) : dt;
  if (countdownDt > 0 && typeof tickBattleCountdown === "function") {
    tickBattleCountdown(state, countdownDt);
  }
  const simDt = typeof simDtFn === "function" ? simDtFn(dt) : dt;
  const countdownActive = typeof isBattleCountdownActive === "function" && isBattleCountdownActive(state);
  if (simDt > 0 && !countdownActive) {
    battleTick(state, simDt);
    recordBattleFrame(state);
  }
  if (state.finished) {
    match.finished = true;
    if (state.recording && typeof finalizeBattleReplay === "function") finalizeBattleReplay(state);
    if (!match.isPlayerMatch) state.replayFrames = [];
    if (typeof CombatLog !== "undefined" && lobby) {
      const labels = getLobbyMatchLabels(lobby, match);
      const winner = state.winner === "player" ? labels.a : state.winner === "enemy" ? labels.b : null;
      const text = winner
        ? `⚔ ${labels.short}: победа ${winner}`
        : `⚔ ${labels.short}: ничья`;
      CombatLog.addEvent({
        type: "neutral",
        text,
        mergeKey: `lobby:live:${match.id}:${state.elapsed}`,
      });
    }
  }
}

function fastForwardLobbyMatch(match) {
  if (!match?.state || match.state.finished || match.byeFighterId) return;
  const state = match.state;
  try {
    if (match.isPlayerMatch) {
      fastForwardBattle(state);
    } else {
      liteFastForwardLobbyMatch(state);
    }
  } catch (err) {
    console.error("fastForwardLobbyMatch failed:", err);
    state.finished = true;
    state.winner = state.winner || "draw";
  }
  state.replayFrames = [];
  state.recording = false;
  match.finished = true;
}

function liteFastForwardLobbyMatch(state) {
  if (!state || state.finished) return;
  if (state.countdown?.active) {
    state.countdown.active = false;
    state.countdown.remaining = 0;
    state.countdown.label = null;
  }
  state.recording = false;
  let steps = 0;
  while (!state.finished && steps < 80000) {
    battleTick(state, 0.05);
    steps += 1;
  }
  if (!state.finished && typeof resolveBattleTimeout === "function") {
    resolveBattleTimeout(state);
  }
  state.replayFrames = [];
}

function disposeLobbyMatchState(match) {
  if (!match) return;
  const state = match.state;
  if (state) {
    state.replayFrames = [];
    state.recording = false;
    state.log = null;
    state.floatingNumbers = null;
    state.animations = null;
    state.commentary = null;
    match.state = null;
  }
  match.finished = true;
}

function disposeLobbyMatches(matches) {
  if (!matches?.length) return;
  matches.forEach(disposeLobbyMatchState);
}

function fastForwardRemainingLobbyMatches(matches) {
  matches.forEach((match) => {
    if (!match.finished && match.state && !match.state.finished) fastForwardLobbyMatch(match);
  });
}

function getLobbyFighterById(lobby, fighterId) {
  return lobby?.fighters?.[fighterId] ?? null;
}

function getAliveLobbyFighterIds(lobby) {
  return getAliveLobbyFighters(lobby).map((f) => f.id);
}

function cycleLobbyViewFighterId(lobby, currentId, delta) {
  const ids = getAliveLobbyFighterIds(lobby);
  if (!ids.length) return 0;
  let idx = ids.indexOf(currentId);
  if (idx < 0) idx = 0;
  idx = (idx + delta + ids.length) % ids.length;
  return ids[idx];
}

function syncEnemyBoardFromLobbyFighter(fighter) {
  if (!fighter) return;
  const ghost = exportGhostFighterState(fighter);
  enemyContainers = ghost.containers;
  enemyItems = ghost.items;
  enemyClass = ghost.classId;
  enemyArchetype = fighter.archetype;
  enemyGold = ghost.gold;
  if (ghost.companionId) enemyCompanionId = ghost.companionId;
  enemyMutationFormId = ghost.mutationFormId ?? null;
  enemyMutationId = ghost.mutationId ?? null;
  if (ghost.enhancements) {
    enemyEnhancements = {
      head: ghost.enhancements.head ?? null,
      chest: ghost.enhancements.chest ?? null,
      boots: ghost.enhancements.boots ?? null,
    };
  }
}

function buildLobbyRosterStripSignature(lobby, opts = {}) {
  if (!lobby) return "";
  const {
    viewFighterId = 0,
    phase = "prep",
    spectateMatchId = 0,
    matches = [],
  } = opts;

  const fighterSig = lobby.fighters.map((f) => {
    const hp = typeof getLobbyFighterLiveHp === "function"
      ? getLobbyFighterLiveHp(f.id, lobby, matches)
      : { current: f.hp, inBattle: false };
    return `${f.id}:${f.alive ? 1 : 0}:${hp.current}:${hp.inBattle ? 1 : 0}:${f.id === lobby.currentOpponentId ? 1 : 0}:${f.mutationFormId || ""}:${f.mutationId || ""}`;
  }).join("|");

  if (phase === "battle" && matches.length) {
    const parts = matches.map((match) => {
      if (match.byeFighterId) return `bye:${match.byeFighterId}`;
      const live = match.state && !match.state.finished;
      return `${match.fighterAId}-${match.fighterBId}:${live ? "live" : "done"}:${match.finished ? "1" : "0"}`;
    });
    return `battle:${spectateMatchId}:${fighterSig}:${parts.join("|")}`;
  }

  return `prep:${viewFighterId}:${fighterSig}`;
}

function renderLobbyFighterHpBar(current, max) {
  const pct = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
  return `
    <div class="lobby-fighter-card-hp-bar" role="presentation">
      <div class="lobby-fighter-card-hp-track">
        <div class="lobby-fighter-card-hp-fill" style="width:${pct}%"></div>
      </div>
      <span class="lobby-fighter-card-hp-val">♥ ${Math.ceil(current)}</span>
    </div>`;
}

function renderLobbyFighterCard(fighter, lobby, opts = {}) {
  const {
    phase = "prep",
    viewFighterId = 0,
    spectateMatchId = 0,
    matches = [],
    round = 1,
    active = false,
    extraClass = "",
    disabled = false,
    dataAttrs = "",
    title = "",
  } = opts;

  const hp = typeof getLobbyFighterLiveHp === "function"
    ? getLobbyFighterLiveHp(fighter.id, lobby, matches)
    : { current: fighter.hp, max: LOBBY_START_HP, inBattle: false };
  const maxHp = hp.max || LOBBY_START_HP;
  const visual = typeof resolveLobbyFighterAvatarVisual === "function"
    ? resolveLobbyFighterAvatarVisual(fighter, lobby, { phase, matches, spectateMatchId, round })
    : { emoji: "❓", mode: "idle", animClass: "" };

  const mutationBadge = typeof renderLobbyMutationBadgeHtml === "function"
    ? renderLobbyMutationBadgeHtml(fighter, round)
    : "";

  const cls = [
    "lobby-fighter-card",
    active ? "lobby-fighter-card--active" : "",
    fighter.isHuman ? "lobby-fighter-card--yours" : "",
    !fighter.alive ? "lobby-fighter-card--out" : "",
    fighter.id === lobby.currentOpponentId ? "lobby-fighter-card--next" : "",
    hp.inBattle ? "lobby-fighter-card--live" : "",
    extraClass,
  ].filter(Boolean).join(" ");

  const emojiClasses = [
    "lobby-fighter-emoji",
    visual.mode === "prep-orbit" ? "lobby-fighter-emoji--prep-orbit" : "",
    visual.isMutation ? "lobby-fighter-emoji--mutation" : "",
    visual.animClass || "",
  ].filter(Boolean).join(" ");

  const cardTitle = title || `${fighter.name} · ${fighter.alive ? `${Math.ceil(hp.current)} HP` : "выбыл"}`;

  return `<button type="button" class="${cls}" ${dataAttrs} ${disabled ? "disabled" : ""} title="${cardTitle}">
    <span class="lobby-fighter-card-name">${fighter.isHuman ? "🧑 " : ""}${fighter.name}</span>
    ${renderLobbyFighterHpBar(hp.current, maxHp)}
    <span class="lobby-fighter-card-avatar${visual.isMutation ? " lobby-fighter-card-avatar--mutation" : ""}" data-lobby-fighter-avatar="${fighter.id}" aria-hidden="true">
      <span class="${emojiClasses}">${visual.emoji}</span>
      ${mutationBadge}
    </span>
  </button>`;
}

function findLobbyPlayerMatchIndex(matches) {
  if (!matches?.length) return 0;
  const idx = matches.findIndex((m) => m.isPlayerMatch && !m.byeFighterId && m.state);
  return idx >= 0 ? idx : 0;
}

function renderLobbyBattleBottomChip(fighter, lobby, opts = {}) {
  const {
    spectateMatchId = 0,
    matches = [],
    active = false,
    disabled = false,
    matchIndex = -1,
    match = null,
  } = opts;

  const hp = typeof getLobbyFighterLiveHp === "function"
    ? getLobbyFighterLiveHp(fighter.id, lobby, matches)
    : { current: fighter.hp, max: LOBBY_START_HP, inBattle: false };
  const visual = typeof resolveLobbyFighterAvatarVisual === "function"
    ? resolveLobbyFighterAvatarVisual(fighter, lobby, { phase: "battle", matches, spectateMatchId })
    : { emoji: "❓", animClass: "" };

  const cls = [
    "lobby-battle-bottom-chip",
    active ? "lobby-battle-bottom-chip--active" : "",
    fighter.isHuman ? "lobby-battle-bottom-chip--yours" : "",
    !fighter.alive ? "lobby-battle-bottom-chip--out" : "",
    hp.inBattle ? "lobby-battle-bottom-chip--live" : "",
    match?.isPlayerMatch && fighter.isHuman ? "lobby-battle-bottom-chip--yours-match" : "",
  ].filter(Boolean).join(" ");

  const emojiClasses = [
    "lobby-fighter-emoji",
    visual.animClass || "",
  ].filter(Boolean).join(" ");

  const dataAttrs = matchIndex >= 0 && match && !match.byeFighterId
    ? `data-lobby-fighter-card="${fighter.id}" data-lobby-spectate="${matchIndex}"`
    : `data-lobby-fighter-card="${fighter.id}"`;
  const cardTitle = `${fighter.name} · ${fighter.alive ? `${Math.ceil(hp.current)} HP` : "выбыл"}`;
  const battleCtx = typeof getLobbyFighterBattleContext === "function"
    ? getLobbyFighterBattleContext(fighter.id, lobby, matches)
    : null;
  const statusHtml = typeof renderLobbyBattleStatusHTML === "function"
    ? renderLobbyBattleStatusHTML(battleCtx)
    : "";
  const hasStatus = !!statusHtml;

  return `<button type="button" class="${cls}${hasStatus ? " lobby-battle-bottom-chip--has-status" : ""}" ${dataAttrs} ${disabled ? "disabled" : ""} title="${cardTitle}" aria-label="${cardTitle}">
    <span class="lobby-battle-bottom-chip-avatar" data-lobby-fighter-avatar="${fighter.id}" aria-hidden="true">
      <span class="${emojiClasses}">${visual.emoji}</span>
    </span>
    <span class="lobby-battle-bottom-chip-status" data-lobby-fighter-status="${fighter.id}" aria-hidden="true"${hasStatus ? "" : " hidden"}>${statusHtml}</span>
    <span class="lobby-battle-bottom-chip-hp" aria-hidden="true">♥ ${Math.ceil(hp.current)}</span>
  </button>`;
}

function renderLobbyBattleBottomStrip(lobby, opts = {}) {
  const { spectateMatchId = 0, matches = [] } = opts;
  const spectateMatch = matches[spectateMatchId];
  const chips = lobby.fighters.map((fighter) => {
    if (!fighter.alive && fighter.id !== lobby.playerId) {
      return renderLobbyBattleBottomChip(fighter, lobby, {
        spectateMatchId,
        matches,
        disabled: true,
        matchIndex: -1,
      });
    }
    const match = findLobbyMatchForFighter(matches, fighter.id);
    const matchIndex = match ? matches.indexOf(match) : -1;
    const inSpectated = spectateMatch
      && !spectateMatch.byeFighterId
      && (spectateMatch.fighterAId === fighter.id || spectateMatch.fighterBId === fighter.id);
    return renderLobbyBattleBottomChip(fighter, lobby, {
      spectateMatchId,
      matches,
      active: inSpectated,
      match,
      matchIndex,
      disabled: !match || !!match.byeFighterId,
    });
  }).join("");

  return `<div class="lobby-battle-bottom-strip">${chips}</div>`;
}

function renderLobbyRosterStrip(lobby, opts = {}) {
  if (!lobby) return "";
  const {
    viewFighterId = 0,
    phase = "prep",
    spectateMatchId = 0,
    matches = [],
    layout = "full",
    round = 1,
  } = opts;

  if (phase === "battle" && matches.length && layout === "bottom") {
    return renderLobbyBattleBottomStrip(lobby, { spectateMatchId, matches });
  }

  if (phase === "battle" && matches.length) {
    const liveCount = countActiveLobbyMatches(matches);
    const header = liveCount > 0
      ? `<div class="lobby-battle-strip-label">Параллельные бои · live: ${liveCount}</div>`
      : `<div class="lobby-battle-strip-label">Все бои завершены</div>`;
    const spectateMatch = matches[spectateMatchId];
    let banner = "";
    if (spectateMatch && !spectateMatch.byeFighterId) {
      const spectateLabels = getLobbyMatchLabels(lobby, spectateMatch);
      if (spectateMatch.isPlayerMatch) {
        banner = `<div class="lobby-spectate-banner lobby-spectate-banner--yours" role="status">⚔ Ваш бой · ${spectateLabels.a} vs ${spectateLabels.b}</div>`;
      } else {
        banner = `<div class="lobby-spectate-banner lobby-spectate-banner--watch" role="status">👁 Смотрите: ${spectateLabels.a} ⚔ ${spectateLabels.b}</div>`;
      }
    }

    const fighterCards = lobby.fighters.map((fighter) => {
      if (!fighter.alive && fighter.id !== lobby.playerId) {
        return renderLobbyFighterCard(fighter, lobby, {
          phase,
          spectateMatchId,
          matches,
          round,
          disabled: true,
          dataAttrs: `data-lobby-fighter-card="${fighter.id}"`,
        });
      }
      const match = findLobbyMatchForFighter(matches, fighter.id);
      const matchIndex = match ? matches.indexOf(match) : -1;
      const inSpectated = spectateMatch
        && !spectateMatch.byeFighterId
        && (spectateMatch.fighterAId === fighter.id || spectateMatch.fighterBId === fighter.id);
      return renderLobbyFighterCard(fighter, lobby, {
        phase,
        spectateMatchId,
        matches,
        round,
        active: inSpectated,
        extraClass: match?.isPlayerMatch && fighter.isHuman ? "lobby-fighter-card--yours-match" : "",
        disabled: !match || !!match.byeFighterId,
        dataAttrs: matchIndex >= 0 && !match.byeFighterId
          ? `data-lobby-fighter-card="${fighter.id}" data-lobby-spectate="${matchIndex}"`
          : `data-lobby-fighter-card="${fighter.id}"`,
      });
    }).join("");

    return `${banner}${header}<div class="lobby-fighter-card-list lobby-fighter-card-list--battle">${fighterCards}</div>`;
  }

  return `<div class="lobby-fighter-card-list">${lobby.fighters.map((fighter) => {
    const active = fighter.id === viewFighterId;
    const disabled = !fighter.alive;
    return renderLobbyFighterCard(fighter, lobby, {
      phase,
      viewFighterId,
      matches,
      round,
      active,
      disabled,
      dataAttrs: `data-lobby-fighter="${fighter.id}"`,
    });
  }).join("")}</div>`;
}

function formatLobbyPrepTimer(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : String(r);
}

function renderLobbyPrepTimerHTML(remaining, active, opts = {}) {
  if (!active) return "";
  const total = Math.max(1, Number(opts.total) || (typeof LOBBY_PREP_SECONDS !== "undefined" ? LOBBY_PREP_SECONDS : 50));
  const seconds = Math.max(0, Math.ceil(remaining));
  const urgent = seconds <= 10;
  const critical = seconds <= 5;
  const pct = Math.max(0, Math.min(1, remaining / total));
  const ringR = 34;
  const ringLen = 2 * Math.PI * ringR;
  const ringOffset = ringLen * (1 - pct);
  const display = formatLobbyPrepTimer(remaining);
  const isShort = !display.includes(":");
  const cls = [
    "prep-timer-hero",
    urgent ? "prep-timer-hero--urgent" : "",
    critical ? "prep-timer-hero--critical" : "",
  ].filter(Boolean).join(" ");
  const unitHtml = isShort
    ? `<span class="prep-timer-hero__unit">сек</span>`
    : `<span class="prep-timer-hero__unit prep-timer-hero__unit--clock">до боя</span>`;

  return `<div class="${cls}" role="timer" aria-live="assertive" aria-label="До боя ${display}">
    <div class="prep-timer-hero__glow" aria-hidden="true"></div>
    <div class="prep-timer-hero__ring" aria-hidden="true">
      <svg viewBox="0 0 80 80" focusable="false">
        <circle class="prep-timer-hero__ring-track" cx="40" cy="40" r="${ringR}"></circle>
        <circle class="prep-timer-hero__ring-fill" cx="40" cy="40" r="${ringR}"
          style="stroke-dasharray:${ringLen.toFixed(2)};stroke-dashoffset:${ringOffset.toFixed(2)}"></circle>
      </svg>
    </div>
    <div class="prep-timer-hero__core">
      <span class="prep-timer-hero__eyebrow">Подготовка</span>
      <span class="prep-timer-hero__value">${display}</span>
      ${unitHtml}
    </div>
  </div>`;
}

window.renderLobbyPrepTimerHTML = renderLobbyPrepTimerHTML;

window.findLobbyPlayerMatchIndex = findLobbyPlayerMatchIndex;
