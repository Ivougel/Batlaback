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
  const state = createBattleState(
    fighterBattleItems(fighterA),
    fighterBattleItems(fighterB),
    fighterA.classId,
    fighterB.classId,
    battleRound,
    {},
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
}

function buildLobbyRosterStripSignature(lobby, opts = {}) {
  if (!lobby) return "";
  const {
    viewFighterId = 0,
    phase = "prep",
    spectateMatchId = 0,
    matches = [],
  } = opts;

  if (phase === "battle" && matches.length) {
    const parts = matches.map((match) => {
      if (match.byeFighterId) return `bye:${match.byeFighterId}`;
      const live = match.state && !match.state.finished;
      return `${match.fighterAId}-${match.fighterBId}:${live ? "live" : "done"}:${match.finished ? "1" : "0"}`;
    });
    return `battle:${spectateMatchId}:${parts.join("|")}`;
  }

  return `prep:${viewFighterId}:${lobby.fighters.map((f) => (
    `${f.id}:${f.alive ? 1 : 0}:${f.hp}:${f.gold}:${f.id === lobby.currentOpponentId ? 1 : 0}`
  )).join("|")}`;
}

function renderLobbyRosterStrip(lobby, opts = {}) {
  if (!lobby) return "";
  const {
    viewFighterId = 0,
    phase = "prep",
    spectateMatchId = 0,
    matches = [],
  } = opts;

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
    return `${banner}${header}${matches.map((match, index) => {
      if (match.byeFighterId) {
        const f = lobby.fighters[match.byeFighterId];
        return `<button type="button" class="lobby-roster-chip lobby-roster-chip--bye" disabled title="Пропуск раунда">
          <span class="lobby-roster-name">${f?.name || "—"}</span>
          <span class="lobby-roster-meta">bye</span>
        </button>`;
      }
      const labels = getLobbyMatchLabels(lobby, match);
      const active = index === spectateMatchId;
      const live = match.state && !match.state.finished;
      const done = match.finished || match.state?.finished;
      const cls = [
        "lobby-roster-chip",
        active ? "lobby-roster-chip--active" : "",
        match.isPlayerMatch ? "lobby-roster-chip--yours" : "",
        live ? "lobby-roster-chip--live" : "",
        done ? "lobby-roster-chip--done" : "",
      ].filter(Boolean).join(" ");
      return `<button type="button" class="${cls}" data-lobby-spectate="${index}" title="${labels.short}">
        <span class="lobby-roster-name">${labels.a} ⚔ ${labels.b}</span>
        <span class="lobby-roster-meta">${match.isPlayerMatch ? "ваш бой" : live ? "live" : done ? "✓" : "…"}</span>
      </button>`;
    }).join("")}`;
  }

  return lobby.fighters.map((fighter) => {
    const active = fighter.id === viewFighterId;
    const cls = [
      "lobby-roster-chip",
      active ? "lobby-roster-chip--active" : "",
      fighter.isHuman ? "lobby-roster-chip--yours" : "",
      !fighter.alive ? "lobby-roster-chip--out" : "",
      fighter.id === lobby.currentOpponentId ? "lobby-roster-chip--next" : "",
    ].filter(Boolean).join(" ");
    const disabled = !fighter.alive ? "disabled" : "";
    return `<button type="button" class="${cls}" data-lobby-fighter="${fighter.id}" ${disabled}
      title="${fighter.name} · ${fighter.alive ? `${fighter.hp} HP` : "выбыл"}">
      <span class="lobby-roster-name">${fighter.isHuman ? "🧑 " : "👤 "}${fighter.name}</span>
        <span class="lobby-roster-meta">${fighter.alive ? `${fighter.hp}♥ ${fighter.gold}💰` : "out"}${fighter.id === lobby.currentOpponentId ? " ⚔" : ""}</span>
    </button>`;
  }).join("");
}

function formatLobbyPrepTimer(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : String(r);
}

function renderLobbyPrepTimerHTML(remaining, active) {
  if (!active) return "";
  const urgent = remaining <= 10;
  return `<div class="lobby-prep-timer${urgent ? " lobby-prep-timer--urgent" : ""}" aria-live="polite">
    <span class="lobby-prep-timer-label">⏱</span>
    <b>${formatLobbyPrepTimer(remaining)}</b>
  </div>`;
}

let lobbyBattleDockOpen = false;
let lobbyBattleDockStripHtml = "";

function isLobbyBattleDockOpen() {
  return lobbyBattleDockOpen;
}

function mountLobbyBattleDockStrip() {
  const strip = document.getElementById("lobby-roster-strip-battle");
  if (!strip || !lobbyBattleDockStripHtml) return;
  if (strip.innerHTML !== lobbyBattleDockStripHtml) {
    strip.innerHTML = lobbyBattleDockStripHtml;
  }
}

function unmountLobbyBattleDockStrip() {
  const strip = document.getElementById("lobby-roster-strip-battle");
  if (!strip || !strip.innerHTML) return;
  lobbyBattleDockStripHtml = strip.innerHTML;
  strip.replaceChildren();
}

function setLobbyBattleDockStripHtml(html) {
  lobbyBattleDockStripHtml = html || "";
  if (lobbyBattleDockOpen) mountLobbyBattleDockStrip();
}

function renderLobbyBattleDockSummary(lobby, opts = {}) {
  if (!lobby) return "Параллельные бои";
  const { spectateMatchId = 0, matches = [] } = opts;
  const liveCount = countActiveLobbyMatches(matches);
  const spectateMatch = matches[spectateMatchId];
  if (spectateMatch && !spectateMatch.byeFighterId) {
    const labels = getLobbyMatchLabels(lobby, spectateMatch);
    const prefix = spectateMatch.isPlayerMatch ? "Ваш бой" : "Смотрите";
    const liveSuffix = liveCount > 1 ? ` · live ${liveCount}` : "";
    return `${prefix}: ${labels.a} vs ${labels.b}${liveSuffix}`;
  }
  if (liveCount > 0) return `Параллельные бои · live: ${liveCount}`;
  return matches.length ? "Все бои завершены" : "Параллельные бои";
}

function setLobbyBattleDockOpen(open) {
  const next = !!open;
  if (next === lobbyBattleDockOpen) return;
  lobbyBattleDockOpen = next;

  const dock = document.getElementById("lobby-battle-dock");
  const toggle = document.getElementById("lobby-battle-dock-toggle");
  const panel = document.getElementById("lobby-battle-dock-panel");
  dock?.classList.toggle("lobby-battle-dock--open", next);
  toggle?.setAttribute("aria-expanded", next ? "true" : "false");

  if (next) {
    panel?.classList.remove("hidden");
    mountLobbyBattleDockStrip();
    return;
  }

  panel?.classList.add("hidden");
  requestAnimationFrame(() => {
    if (lobbyBattleDockOpen) return;
    unmountLobbyBattleDockStrip();
  });
}

function syncLobbyBattleDockChrome(lobby, opts = {}) {
  const dock = document.getElementById("lobby-battle-dock");
  const toggleText = document.getElementById("lobby-battle-dock-toggle-text");
  if (!dock || dock.classList.contains("hidden")) return;
  const summary = renderLobbyBattleDockSummary(lobby, opts);
  if (toggleText && toggleText.textContent !== summary) {
    toggleText.textContent = summary;
  }
}

function bindLobbyBattleDock() {
  const dock = document.getElementById("lobby-battle-dock");
  const toggle = document.getElementById("lobby-battle-dock-toggle");
  if (!dock || dock.dataset.bound === "1") return;
  dock.dataset.bound = "1";

  toggle?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLobbyBattleDockOpen(!lobbyBattleDockOpen);
  });

  document.addEventListener("pointerdown", (e) => {
    if (!lobbyBattleDockOpen || !dock || dock.classList.contains("hidden")) return;
    if (dock.contains(e.target)) return;
    setLobbyBattleDockOpen(false);
  }, true);
}
