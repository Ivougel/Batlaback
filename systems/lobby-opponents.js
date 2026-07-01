/**
 * Лобби в стиле auto-battler: пул соперников-ghost, HP забега, снимки билдов.
 */

const LOBBY_FIGHTER_COUNT = 8;
const LOBBY_START_HP = 100;
const LOBBY_BOT_COUNT = LOBBY_FIGHTER_COUNT - 1;

const LOBBY_BOT_NAMES = [
  "Грок", "Сильвана", "Морана", "Тайрик", "Лира", "Борн", "Каз",
];

function cloneLobbyItems(items) {
  return items.map((item) => ({
    ...item,
    runtime: item.runtime
      ? {
          ...item.runtime,
          activeSynergies: item.runtime.activeSynergies
            ? item.runtime.activeSynergies.map((s) => ({ ...s }))
            : undefined,
        }
      : null,
  }));
}

function cloneLobbyContainers(containers) {
  return containers.map((c) => ({ ...c }));
}

function createLobbyFighter(id, name, classId, isHuman = false) {
  const containers = createStartingContainers();
  const items = applyClassStarters(containers, [], classId);
  const archetype = AI_ARCHETYPES[classId] || AI_ARCHETYPES.warrior;
  return {
    id,
    name,
    isHuman,
    classId,
    archetype,
    hp: LOBBY_START_HP,
    alive: true,
    gold: AI_ECON.START_GOLD,
    containers,
    items,
    bench: [],
    recentResults: [],
    lastBattleWon: null,
    lastOpponentId: null,
    pendingShopBuffs: 0,
    bonusUniqueGranted: false,
  };
}

function initLobby(playerClassId, gridW, gridH) {
  const fighters = [createLobbyFighter(0, "Вы", playerClassId, true)];
  for (let i = 0; i < LOBBY_BOT_COUNT; i++) {
    const classId = pickRandomClassId();
    const name = LOBBY_BOT_NAMES[i] || `Боец ${i + 1}`;
    fighters.push(createLobbyFighter(i + 1, name, classId, false));
  }
  return {
    fighters,
    playerId: 0,
    currentOpponentId: null,
    gridW,
    gridH,
    lastDamage: null,
  };
}

function getAliveLobbyFighters(lobby) {
  return lobby.fighters.filter((f) => f.alive);
}

function getLobbyPlayer(lobby) {
  return lobby.fighters[lobby.playerId];
}

function getLobbyOpponent(lobby) {
  if (lobby?.currentOpponentId == null) return null;
  return lobby.fighters[lobby.currentOpponentId] || null;
}

function pickLobbyOpponent(lobby) {
  const alive = getAliveLobbyFighters(lobby).filter((f) => f.id !== lobby.playerId);
  if (!alive.length) {
    lobby.currentOpponentId = null;
    return null;
  }
  const opponent = alive[Math.floor(Math.random() * alive.length)];
  lobby.currentOpponentId = opponent.id;
  return opponent;
}

function pickLobbyScoutTarget(lobby, fighter) {
  if (fighter.lastOpponentId != null) {
    const lastOpp = lobby.fighters[fighter.lastOpponentId];
    if (lastOpp?.alive && lastOpp.items?.length) {
      return { items: lastOpp.items, classId: lastOpp.classId };
    }
  }

  const others = getAliveLobbyFighters(lobby).filter((f) => f.id !== fighter.id);
  if (!others.length) return { items: [], classId: null };

  const nonHuman = others.filter((f) => !f.isHuman);
  const pool = nonHuman.length ? nonHuman : others;
  const target = pool[Math.floor(Math.random() * pool.length)];
  return { items: target.items || [], classId: target.classId || null };
}

function grantLobbyFighterBag(fighter, round, gridW, gridH) {
  if (!fighter?.alive) return;
  const bag = grantBagReward(fighter.containers, round, gridW, gridH, fighter.items);
  if (bag.granted) fighter.containers = bag.containers;
}

function advanceLobbyFighterPrep(fighter, round, gridW, gridH, battleWon, scoutItems, scoutClass, prepOpts = {}) {
  if (!fighter.alive || fighter.isHuman) return;

  const prep = aiEnemyPrepPhase(
    {
      archetype: fighter.archetype,
      classId: fighter.classId,
      gold: fighter.gold,
      containers: fighter.containers,
      items: fighter.items,
      bench: fighter.bench,
    },
    round,
    gridW,
    gridH,
    battleWon,
    scoutItems || [],
    scoutClass,
    prepOpts,
  );

  fighter.archetype = prep.archetype;
  fighter.classId = prep.classId;
  fighter.gold = prep.gold;
  fighter.containers = prep.containers;
  fighter.items = prep.items;
  fighter.bench = prep.bench;
}

function runLobbyBotsShopPhase(lobby, round) {
  const bots = lobby.fighters.filter((f) => !f.isHuman && f.alive);
  if (typeof shuffleLobbyArray === "function") shuffleLobbyArray(bots);
  bots.forEach((fighter) => {
    const scout = pickLobbyScoutTarget(lobby, fighter);
    advanceLobbyFighterPrep(
      fighter,
      round,
      lobby.gridW,
      lobby.gridH,
      fighter.lastBattleWon,
      scout.items,
      scout.classId,
      { recentResults: (fighter.recentResults || []).slice(-3) },
    );
  });
}

function startLobbyPrepRound(lobby, round) {
  lobby.fighters.forEach((fighter) => {
    if (!fighter.isHuman && fighter.alive) {
      grantLobbyFighterBag(fighter, round, lobby.gridW, lobby.gridH);
    }
  });
  runLobbyBotsShopPhase(lobby, round);
  pickLobbyOpponent(lobby);
}

function recordLobbyMatchOutcomes(lobby, matches) {
  if (!lobby || !matches?.length) return;

  matches.forEach((match) => {
    if (match.byeFighterId != null) return;
    const fighterA = lobby.fighters[match.fighterAId];
    const fighterB = lobby.fighters[match.fighterBId];
    const state = match.state;
    if (!fighterA || !fighterB || !state?.finished) return;

    fighterA.lastOpponentId = fighterB.id;
    fighterB.lastOpponentId = fighterA.id;

    if (state.winner === "player") {
      fighterA.lastBattleWon = true;
      fighterB.lastBattleWon = false;
      fighterA.recentResults = [...(fighterA.recentResults || []), "win"].slice(-5);
      fighterB.recentResults = [...(fighterB.recentResults || []), "loss"].slice(-5);
    } else if (state.winner === "enemy") {
      fighterA.lastBattleWon = false;
      fighterB.lastBattleWon = true;
      fighterA.recentResults = [...(fighterA.recentResults || []), "loss"].slice(-5);
      fighterB.recentResults = [...(fighterB.recentResults || []), "win"].slice(-5);
    } else {
      fighterA.lastBattleWon = null;
      fighterB.lastBattleWon = null;
      fighterA.recentResults = [...(fighterA.recentResults || []), "draw"].slice(-5);
      fighterB.recentResults = [...(fighterB.recentResults || []), "draw"].slice(-5);
    }
  });
}

function importLobbyPlayerGlobals(lobby, globals) {
  const player = getLobbyPlayer(lobby);
  if (!player || !globals) return;
  player.classId = globals.classId;
  player.gold = globals.gold;
  player.containers = cloneLobbyContainers(globals.containers);
  player.items = cloneLobbyItems(globals.items);
  player.bench = Array.isArray(globals.bench) ? globals.bench.map((e) => (e ? { ...e } : null)) : [];
  if (globals.pendingShopBuffs != null) player.pendingShopBuffs = globals.pendingShopBuffs;
}

function exportGhostFighterState(fighter) {
  if (!fighter) return null;
  return {
    id: fighter.id,
    name: fighter.name,
    classId: fighter.classId,
    archetype: fighter.archetype,
    gold: fighter.gold,
    containers: cloneLobbyContainers(fighter.containers),
    items: cloneLobbyItems(fighter.items),
  };
}

/** Бонус урона по раунду (как TFT / Magic Chess: растёт к поздней игре). */
function calcLobbyRoundDamageBonus(battleRound = 1) {
  const r = Math.max(1, Math.floor(battleRound) || 1);
  if (r <= 1) return 0;
  if (r === 2) return 2;
  if (r === 3) return 5;
  if (r === 4) return 8;
  if (r === 5) return 10;
  if (r === 6) return 12;
  return 17;
}

/**
 * Урон за исход боя (не «выжившие предметы» — рюкзак статичен).
 * Сильнее бьёшь и чем больше HP осталось у победителя — тем больше урон по HP лобби.
 */
function calcLobbyWinPressureDamage(winnerSide, state) {
  const winner = winnerSide === "player" ? state?.player : state?.enemy;
  const loser = winnerSide === "player" ? state?.enemy : state?.player;
  if (!winner || !loser) return 4;

  const dealt = Math.max(0, winner.totalDamageDealt ?? 0);
  const dealtScore = Math.min(8, Math.max(2, Math.round(dealt / 14)));

  const winHpRatio = Math.max(0, Math.min(1, (winner.hp ?? 0) / Math.max(1, winner.maxHp ?? 1)));
  const marginScore = Math.round(winHpRatio * 4);

  return Math.max(4, dealtScore + marginScore);
}

function calcLobbyBattleDamage(finishedState, winnerSide, battleRound = 1) {
  const winDmg = calcLobbyWinPressureDamage(winnerSide, finishedState);
  const roundDmg = calcLobbyRoundDamageBonus(battleRound);
  return winDmg + roundDmg;
}

function calcLobbyDrawDamage(battleRound = 1) {
  const roundDmg = calcLobbyRoundDamageBonus(battleRound);
  return Math.max(2, Math.ceil(roundDmg * 0.5) + 1);
}

function applyLobbyMatchHpResult(lobby, match) {
  if (match.byeFighterId) return null;
  const fighterA = lobby.fighters[match.fighterAId];
  const fighterB = lobby.fighters[match.fighterBId];
  const state = match.state;
  if (!fighterA || !fighterB || !state?.finished) return null;

  const battleRound = state.battleRound ?? 1;
  let summary = { matchId: match.id, isPlayerMatch: !!match.isPlayerMatch };

  if (state.winner === "player") {
    const dmg = calcLobbyBattleDamage(state, "player", battleRound);
    fighterB.hp = Math.max(0, fighterB.hp - dmg);
    if (fighterB.hp <= 0) fighterB.alive = false;
    summary = { ...summary, winnerId: fighterA.id, loserId: fighterB.id, damage: dmg, eliminated: !fighterB.alive };
  } else if (state.winner === "enemy") {
    const dmg = calcLobbyBattleDamage(state, "enemy", battleRound);
    fighterA.hp = Math.max(0, fighterA.hp - dmg);
    if (fighterA.hp <= 0) fighterA.alive = false;
    summary = { ...summary, winnerId: fighterB.id, loserId: fighterA.id, damage: dmg, eliminated: !fighterA.alive };
  } else {
    const dmg = calcLobbyDrawDamage(battleRound);
    fighterA.hp = Math.max(0, fighterA.hp - dmg);
    fighterB.hp = Math.max(0, fighterB.hp - dmg);
    if (fighterA.hp <= 0) fighterA.alive = false;
    if (fighterB.hp <= 0) fighterB.alive = false;
    summary = { ...summary, draw: true, damage: dmg };
  }
  return summary;
}

function applyAllLobbyMatchResults(lobby, matches) {
  recordLobbyMatchOutcomes(lobby, matches);
  const summaries = [];
  matches.forEach((match) => {
    const s = applyLobbyMatchHpResult(lobby, match);
    if (s) summaries.push(s);
  });
  const player = getLobbyPlayer(lobby);
  const alive = getAliveLobbyFighters(lobby);
  return {
    summaries,
    playerEliminated: !player?.alive,
    lobbyWon: player?.alive && alive.length === 1 && alive[0].id === lobby.playerId,
  };
}

function applyLobbyBattleResult(lobby, battleWinner, finishedState) {
  const player = getLobbyPlayer(lobby);
  const opponent = getLobbyOpponent(lobby);
  lobby.lastDamage = null;
  if (!player || !opponent) {
    return { playerEliminated: !player?.alive, lobbyWon: false };
  }

  const battleRound = finishedState?.battleRound ?? 1;

  if (battleWinner === "player") {
    const dmg = calcLobbyBattleDamage(finishedState, "player", battleRound);
    opponent.hp = Math.max(0, opponent.hp - dmg);
    if (opponent.hp <= 0) opponent.alive = false;
    lobby.lastDamage = { target: "opponent", amount: dmg, eliminated: !opponent.alive };
    player.lastBattleWon = true;
    opponent.lastBattleWon = false;
    player.lastOpponentId = opponent.id;
    opponent.lastOpponentId = player.id;
    player.recentResults = [...(player.recentResults || []), "win"].slice(-5);
    opponent.recentResults = [...(opponent.recentResults || []), "loss"].slice(-5);
  } else if (battleWinner === "enemy") {
    const dmg = calcLobbyBattleDamage(finishedState, "enemy", battleRound);
    player.hp = Math.max(0, player.hp - dmg);
    if (player.hp <= 0) player.alive = false;
    lobby.lastDamage = { target: "player", amount: dmg, eliminated: !player.alive };
    player.lastBattleWon = false;
    opponent.lastBattleWon = true;
    player.lastOpponentId = opponent.id;
    opponent.lastOpponentId = player.id;
    player.recentResults = [...(player.recentResults || []), "loss"].slice(-5);
    opponent.recentResults = [...(opponent.recentResults || []), "win"].slice(-5);
  } else {
    const dmg = calcLobbyDrawDamage(battleRound);
    player.hp = Math.max(0, player.hp - dmg);
    opponent.hp = Math.max(0, opponent.hp - dmg);
    if (player.hp <= 0) player.alive = false;
    if (opponent.hp <= 0) opponent.alive = false;
    lobby.lastDamage = { target: "both", amount: dmg };
    player.lastBattleWon = null;
    opponent.lastBattleWon = null;
    player.lastOpponentId = opponent.id;
    opponent.lastOpponentId = player.id;
    player.recentResults = [...(player.recentResults || []), "draw"].slice(-5);
    opponent.recentResults = [...(opponent.recentResults || []), "draw"].slice(-5);
  }

  const alive = getAliveLobbyFighters(lobby);
  return {
    playerEliminated: !player.alive,
    lobbyWon: player.alive && alive.length === 1 && alive[0].id === lobby.playerId,
    opponentEliminated: !opponent.alive,
  };
}

function isLobbyRunOver(lobby) {
  const player = getLobbyPlayer(lobby);
  if (!player?.alive) return true;
  const alive = getAliveLobbyFighters(lobby);
  return alive.length === 1 && alive[0].id === lobby.playerId;
}

function getLobbyPlacement(lobby) {
  const sorted = [...lobby.fighters].sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return b.hp - a.hp;
  });
  const rank = sorted.findIndex((f) => f.isHuman) + 1;
  return { rank, total: lobby.fighters.length, sorted };
}

function renderLobbyStandingsPanel(lobby, roundNum, runResults, goldStats = null) {
  if (!lobby) return "";
  const { rank, sorted } = getLobbyPlacement(lobby);
  const player = getLobbyPlayer(lobby);
  const opponent = getLobbyOpponent(lobby);
  const { wins, losses, draws } = countRunResults(runResults || []);
  const rows = sorted.map((fighter, index) => {
    const cls = [
      "lobby-row",
      fighter.isHuman ? "lobby-row--player" : "",
      !fighter.alive ? "lobby-row--out" : "",
      fighter.id === lobby.currentOpponentId ? "lobby-row--next" : "",
    ].filter(Boolean).join(" ");
    const status = fighter.alive ? `${fighter.hp} HP · ${fighter.gold}💰` : "выбыл";
    const marker = fighter.id === lobby.currentOpponentId ? " ⚔" : "";
    return `
      <div class="${cls}" title="${fighter.name}">
        <span class="lobby-rank">${index + 1}</span>
        <span class="lobby-name">${fighter.isHuman ? "🧑 " : "👤 "}${fighter.name}${marker}</span>
        <span class="lobby-hp">${status}</span>
      </div>`;
  }).join("");

  const goldLine = goldStats
    ? `<div class="run-gold-summary">Получено: <b>${goldStats.earned ?? 0}💰</b> · Потрачено: <b>${goldStats.spent ?? 0}💰</b></div>`
    : "";

  return `
    <div class="bstat-header">🏟 Лобби · ${getAliveLobbyFighters(lobby).length} в игре</div>
    <div class="lobby-next-opponent">Следующий бой: <b>${opponent?.name || "—"}</b></div>
    <div class="lobby-player-hp">Ваше HP: <b>${player?.hp ?? 0}</b> / ${LOBBY_START_HP}</div>
    <div class="lobby-standings">${rows}</div>
    <div class="run-summary">Раунд <b>${roundNum}</b> · Победы: <b>${wins}</b> · Поражения: <b>${losses}</b>${draws ? ` · Ничьи: <b>${draws}</b>` : ""} · Место: <b>${rank}</b>/${lobby.fighters.length}</div>
    ${goldLine}
  `;
}

function showLobbyRunCompleteOverlay(lobby, runResults, runItemStats, roundNum, phase, boardSnapshot, goldStats) {
  const overlay = document.getElementById("overlay");
  if (!overlay || !lobby) return;

  document.getElementById("battle-result-overlay")?.classList.add("hidden");

  const { rank, total } = getLobbyPlacement(lobby);
  const player = getLobbyPlayer(lobby);
  const won = player?.alive && getAliveLobbyFighters(lobby).length === 1;
  const title = won ? "Победа в лобби!" : "Лобби завершено";
  const subtitle = won
    ? `Вы последний выживший! Место: ${rank} из ${total}`
    : `Место: ${rank} из ${total} · HP: ${player?.hp ?? 0}`;

  document.getElementById("overlay-title").textContent = title;
  document.getElementById("overlay-text").textContent = subtitle;

  const { player: playerStats, enemy: enemyStats } = runItemStatsToArrays(runItemStats);
  const accordionsEl = document.getElementById("run-complete-accordions");
  if (accordionsEl) {
    renderAccordions(accordionsEl, [
      {
        title: "🏟 Итоги лобби",
        html: renderLobbyStandingsPanel(lobby, roundNum, runResults, goldStats),
        open: true,
      },
      {
        title: "⚔ Статистика предметов за забег",
        html: renderItemStatsSection(playerStats, enemyStats, { showBoardButtons: !!boardSnapshot }),
        open: true,
        getCopyText: () => formatItemStatsCopyText(playerStats, enemyStats, {
          title: "Статистика предметов за лобби",
        }),
      },
    ]);
    bindBoardPreviewButtons(accordionsEl, boardSnapshot);
  }

  overlay.classList.remove("hidden");
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}
