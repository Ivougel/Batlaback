/**
 * Lobby / lobby2p runtime — вынесено из game.js.
 * Состояние (lobbyState, lobbyMatches, …) остаётся в game.js.
 */

function applyLobbyGhostToEnemy() {
  const ghost = exportGhostFighterState(getLobbyOpponent(lobbyState));
  if (!ghost) return;
  enemyContainers = ghost.containers;
  enemyItems = ghost.items;
  enemyClass = ghost.classId;
  enemyArchetype = ghost.archetype;
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

function resetLobbyPrepTimer() {
  lobbyPrepTimerRemaining = LOBBY_PREP_SECONDS;
  lobbyPrepTimerActive = true;
  lobbyPrepOvertimeUsed = false;
  if (typeof PrepCountdown !== "undefined") {
    PrepCountdown.resetLobbyArming();
    PrepCountdown.onPrepPhaseStarted(`lobby:${round}`);
  }
}

function stopLobbyPrepTimer() {
  lobbyPrepTimerActive = false;
}

/** Автостарт по таймеру — через PrepCountdown в gameLoop. */

function rollbackPreparedBattleStart() {
  battleState = null;
  if (typeof disposeLobbyMatches === "function") disposeLobbyMatches(lobbyMatches);
  lobbyMatches = [];
  lobbyBackgroundSimAcc.clear();
}

function scheduleLobbyBackgroundRoundMatches(lobby, battleRound) {
  const pending = lobbyMatches.filter((m) => !m.byeFighterId && !m.isPlayerMatch && !m.state);
  if (!pending.length) return;
  pending.forEach((match, index) => {
    const run = () => {
      if ((phase !== "battle" && phase !== "replay") || match.state) return;
      createLobbyMatchState(match, lobby, battleRound);
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, { timeout: 320 + index * 80 });
    } else {
      setTimeout(run, index * 16);
    }
  });
}

function ensureLobbyBackgroundMatchesReady() {
  if (!isAnyLobbyMode() || !lobbyState) return;
  lobbyMatches.forEach((match) => {
    if (!match.byeFighterId && !match.state) {
      createLobbyMatchState(match, lobbyState, round);
    }
  });
}

function beginLobbyRoundBattles(battleRound) {
  if (!lobbyState) throw new Error("lobby state missing");
  if (typeof syncAllLobbyFighterMutations === "function") {
    syncAllLobbyFighterMutations(lobbyState, battleRound);
  }
  if (typeof disposeLobbyMatches === "function") disposeLobbyMatches(lobbyMatches);
  lobbyMatches = [];
  lobbyBackgroundSimAcc.clear();

  if (isLobby2pMode()) {
    lobbyMatches = buildLobby2pRoundMatches(lobbyState);
    lobbyMatches.forEach((match) => {
      if (!match.byeFighterId) createLobbyMatchState(match, lobbyState, battleRound);
    });
  } else {
    lobbyMatches = buildLobbyRoundMatches(lobbyState);
    const playerMatch = lobbyMatches.find((m) => m.isPlayerMatch);
    if (!playerMatch || playerMatch.byeFighterId) throw new Error("lobby player match missing");
    createLobbyMatchState(playerMatch, lobbyState, battleRound);
    scheduleLobbyBackgroundRoundMatches(lobbyState, battleRound);
  }

  const playerIdx = isLobby2pMode()
    ? lobbyMatches.findIndex((m) => m.isPlayerMatch && m.humanId === 0)
    : lobbyMatches.findIndex((m) => m.isPlayerMatch);
  lobbySpectateMatchId = playerIdx >= 0 ? playerIdx : 0;
  const playerMatch = lobbyMatches[lobbySpectateMatchId];
  if (!playerMatch?.state) throw new Error("lobby player match missing");
  battleState = playerMatch.state;
  syncLobbySpectateBoards(playerMatch);
  const app = document.getElementById("app");
  if (app) app.dataset.lobbySpectate = "yours";
}
function setLobbyViewFighter(fighterId) {
  if (!lobbyState) return;
  const fighter = getLobbyFighterById(lobbyState, fighterId);
  if (!fighter || (!fighter.alive && fighter.id !== lobbyState.playerId)) return;
  lobbyViewFighterId = fighter.id;
  clearDragUiState();
  closePrepHeroTooltip();
  if (fighter.isHuman) {
    prepViewSide = "player";
  } else {
    syncEnemyBoardFromLobbyFighter(fighter);
    prepViewSide = "enemy";
  }
  const app = document.getElementById("app");
  if (app) app.dataset.prepSide = prepViewSide;
  updatePrepSideUI();
  if (fighter.isHuman) ensureShopReadyForSide("player");
  renderShop();
  renderBench();
  recalcSynergies();
  draw();
  renderLobbyChrome();
}

function syncLobbyPlayerFromGlobals() {
  if (!lobbyState) return;
  importLobbyPlayerGlobals(lobbyState, {
    classId: playerClass,
    gold,
    containers: playerContainers,
    items: playerItems,
    bench,
    pendingShopBuffs: playerPendingShopBuffs,
    companionId: playerCompanionId,
    mutationFormId: playerMutationFormId,
    mutationId: playerMutationId,
    enhancements: playerEnhancements,
    round,
  });
}

function invalidateLobbySpectateLayoutCaches() {
  if (typeof BattleHeroAnchor !== "undefined" && BattleHeroAnchor.invalidateMeasureCache) {
    BattleHeroAnchor.invalidateMeasureCache();
  }
  if (typeof window.syncHeroEmotionSlotAnchors === "function") {
    if (window.syncHeroEmotionSlotAnchors._layout) {
      window.syncHeroEmotionSlotAnchors._layout.player = "";
      window.syncHeroEmotionSlotAnchors._layout.enemy = "";
    }
    window.syncHeroEmotionSlotAnchors._rootEmoji = null;
  }
}

function setLobbySpectateMatch(matchIndex) {
  if (!lobbyMatches.length) return;
  const idx = Math.max(0, Math.min(lobbyMatches.length - 1, matchIndex));
  const match = lobbyMatches[idx];
  if (!match || match.byeFighterId || !match.state) return;
  if (idx === lobbySpectateMatchId) return;

  lobbySpectateMatchId = idx;
  syncLobbySpectateBoards(match);
  const app = document.getElementById("app");
  if (app) app.dataset.lobbySpectate = match.isPlayerMatch ? "yours" : "watch";
  syncLobby2pBattleTabs();
  if (typeof Lobby2pHud !== "undefined") Lobby2pHud.syncBattle();
  queueLobbySpectatePresentation();
}

function queueLobbySpectatePresentation() {
  if (queueLobbySpectatePresentation._raf) return;
  queueLobbySpectatePresentation._raf = requestAnimationFrame(() => {
    queueLobbySpectatePresentation._raf = 0;
    applyLobbySpectatePresentation();
  });
}

function applyLobbySpectatePresentation() {
  const match = lobbyMatches[lobbySpectateMatchId];
  if (!match?.state || match.byeFighterId) return;

  lastLobbyRosterStripSig = "";
  lastLobbyRosterStripPhase = "";
  renderLobbyChrome(true);
  renderPlayerProfiles({ lightSpectate: true });

  const viewState = getDisplayBattleState();
  if (viewState && typeof drawEmotionLayer === "function") {
    const elapsed = battleStartTime ? (Date.now() - battleStartTime) / 1000 : 0;
    drawEmotionLayer(null, viewState, elapsed);
  }
  if (viewState && typeof syncStackOrbitFromBattle === "function" && !viewState.finished) {
    syncStackOrbitFromBattle(viewState, { force: true });
  }
  if (viewState && typeof syncBattleAuraFrame === "function") {
    const elapsed = battleStartTime ? (Date.now() - battleStartTime) / 1000 : 0;
    syncBattleAuraFrame(viewState, elapsed);
  }
  if (typeof closeBattleInventoryPopover === "function") closeBattleInventoryPopover();
  if (typeof queuePrewarmBattleInventoryPopover === "function") queuePrewarmBattleInventoryPopover();
}

function syncLobbySpectateBoards(match) {
  if (!match || !lobbyState) return;
  const fighterA = lobbyState.fighters[match.fighterAId];
  const fighterB = lobbyState.fighters[match.fighterBId];
  if (fighterA) {
    playerContainers = fighterA.containers;
    playerItems = fighterA.items;
    playerClass = fighterA.classId;
  }
  if (fighterB) {
    enemyContainers = fighterB.containers;
    enemyItems = fighterB.items;
    enemyClass = fighterB.classId;
    enemyArchetype = fighterB.archetype;
    enemyGold = fighterB.gold;
  }
  if (typeof setBattleEnemyTeamLabel === "function") {
    setBattleEnemyTeamLabel(fighterB?.name || "Соперник");
  }
}

function getDisplayBattleState() {
  if (!isAnyLobbyMode() || !isBattleUiPhase() || !lobbyMatches.length) return battleState;
  const match = lobbyMatches[lobbySpectateMatchId];
  return match?.state || battleState;
}

function getLobbySpectateProfileNames() {
  const match = lobbyMatches[lobbySpectateMatchId];
  if (!match || !lobbyState || match.byeFighterId) return null;
  const fighterA = lobbyState.fighters[match.fighterAId];
  const fighterB = lobbyState.fighters[match.fighterBId];
  return {
    playerName: fighterA?.name || "Игрок",
    enemyName: fighterB?.name || "Соперник",
    playerClassId: fighterA?.classId,
    enemyClassId: fighterB?.classId,
    playerMutationFormId: fighterA?.mutationFormId ?? null,
    playerMutationId: fighterA?.mutationId ?? null,
    enemyMutationFormId: fighterB?.mutationFormId ?? null,
    enemyMutationId: fighterB?.mutationId ?? null,
  };
}

function findLobby2pHumanMatchIndex(humanId) {
  if (!lobbyMatches?.length) return -1;
  return lobbyMatches.findIndex(
    (m) => m.isPlayerMatch && m.humanId === humanId && !m.byeFighterId && m.state,
  );
}

function syncLobby2pBattleTabs() {
  const wrap = document.getElementById("lobby2p-battle-tabs");
  if (!wrap) return;
  const show = isLobby2pMode() && isBattleUiPhase() && !!lobbyState;
  wrap.classList.toggle("hidden", !show);
  if (!show) return;

  [0, 1].forEach((humanId) => {
    const btn = document.getElementById(`lobby2p-battle-tab-${humanId}`);
    if (!btn) return;
    const fighter = getLobbyHumanFighter(lobbyState, humanId);
    const matchIdx = findLobby2pHumanMatchIndex(humanId);
    const match = matchIdx >= 0 ? lobbyMatches[matchIdx] : null;
    const alive = fighter?.alive !== false;
    const inBattle = !!(match?.state && !match.state.finished);
    const finished = !!(match?.state?.finished);
    const spectating = matchIdx === lobbySpectateMatchId;
    const oppId = match
      ? (match.fighterAId === humanId ? match.fighterBId : match.fighterAId)
      : null;
    const opp = oppId != null ? lobbyState.fighters[oppId] : null;

    btn.disabled = !alive || matchIdx < 0;
    btn.classList.toggle("lobby2p-battle-tab--active", spectating);
    btn.classList.toggle("lobby2p-battle-tab--live", inBattle);
    btn.classList.toggle("lobby2p-battle-tab--done", finished);
    btn.classList.toggle("lobby2p-battle-tab--out", !alive);
    btn.setAttribute("aria-selected", spectating ? "true" : "false");

    const hp = fighter?.hp ?? 0;
    const status = !alive ? "выбыл" : inBattle ? "в бою" : finished ? "готово" : "—";
    btn.textContent = `${fighter?.name || `Игрок ${humanId + 1}`} · ♥${hp}${opp ? ` vs ${opp.name}` : ""} · ${status}`;
  });
}

function bindLobby2pBattleTabs() {
  const wrap = document.getElementById("lobby2p-battle-tabs");
  if (!wrap || wrap.dataset.bound === "1") return;
  wrap.dataset.bound = "1";
  wrap.addEventListener("click", (e) => {
    const tab = e.target.closest(".lobby2p-battle-tab");
    if (!tab || tab.disabled) return;
    const humanId = Number(tab.dataset.human);
    const idx = findLobby2pHumanMatchIndex(humanId);
    if (idx >= 0) setLobbySpectateMatch(idx);
  });
}

function returnToLobbyPlayerMatch() {
  if (!isAnyLobbyMode() || !lobbyMatches.length) return;
  if (isLobby2pMode()) {
    const idx = lobbyMatches.findIndex((m) => m.isPlayerMatch && m.humanId === 0 && !m.byeFighterId);
    if (idx >= 0) setLobbySpectateMatch(idx);
    return;
  }
  const idx = typeof findLobbyPlayerMatchIndex === "function"
    ? findLobbyPlayerMatchIndex(lobbyMatches)
    : lobbyMatches.findIndex((m) => m.isPlayerMatch);
  if (idx >= 0) setLobbySpectateMatch(idx);
}

function syncLobbyReturnTableButton() {
  const btn = document.getElementById("btn-lobby-return-table");
  if (!btn) return;
  if (isLobby2pMode()) {
    btn.classList.add("hidden");
    return;
  }
  const match = lobbyMatches[lobbySpectateMatchId];
  const watching = isAnyLobbyMode()
    && isBattleUiPhase()
    && !!lobbyState
    && match
    && !match.byeFighterId
    && (!match.isPlayerMatch || (isLobby2pMode() && match.humanId !== 0));
  btn.classList.toggle("hidden", !watching);
}

function closeStandingsDropdown() {
  const btn = document.getElementById("btn-standings-toggle");
  const dropdown = document.getElementById("standings-dropdown");
  if (!dropdown || dropdown.classList.contains("hidden")) return;
  dropdown.classList.add("hidden");
  dropdown.setAttribute("aria-hidden", "true");
  dropdown.style.removeProperty("left");
  dropdown.style.removeProperty("bottom");
  dropdown.style.removeProperty("position");
  btn?.setAttribute("aria-expanded", "false");
  btn?.classList.remove("active");
}

function positionStandingsDropdown() {
  const btn = document.getElementById("btn-standings-toggle");
  const dropdown = document.getElementById("standings-dropdown");
  if (!btn || !dropdown || dropdown.classList.contains("hidden")) return;
  const rect = btn.getBoundingClientRect();
  const width = dropdown.offsetWidth || 220;
  const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
  dropdown.style.position = "fixed";
  dropdown.style.left = `${Math.round(left)}px`;
  dropdown.style.bottom = `${Math.round(window.innerHeight - rect.top + 8)}px`;
  dropdown.style.right = "auto";
}

function syncPrepBottomStats({ gold, hpLabel, roundLabel, lobbyHp = false } = {}) {
  const bar = document.getElementById("prep-bottom-stats");
  if (!bar) return;
  const show = isPrepHeroHudVisible();
  bar.toggleAttribute("hidden", !show);
  if (!show) return;
  const goldEl = document.getElementById("prep-bottom-stat-gold");
  const hpEl = document.getElementById("prep-bottom-stat-hp");
  const roundEl = document.getElementById("prep-bottom-stat-round");
  if (goldEl && gold != null) goldEl.textContent = String(gold);
  if (hpEl && hpLabel != null) hpEl.textContent = hpLabel;
  if (roundEl && roundLabel != null) roundEl.textContent = roundLabel;
  bar.classList.toggle("prep-bottom-stats--lobby-hp", !!lobbyHp);
  const roundCaption = bar.querySelector(".prep-bottom-stat--round .prep-bottom-stat-label");
  if (roundCaption) roundCaption.textContent = "Раунд";
}

function syncPrepBottomBarChrome() {
  const standingsAnchor = document.getElementById("standings-anchor");
  const isPrep = phase === "prep";
  if (isLobby2pMode() && isPrep) {
    document.getElementById("prep-bottom-stats")?.setAttribute("hidden", "");
    standingsAnchor?.toggleAttribute("hidden", true);
    return;
  }
  if (isLobby2pMode() && isBattleUiPhase() && lobbyState) {
    standingsAnchor?.toggleAttribute("hidden", false);
    const countEl = document.getElementById("standings-alive-count");
    if (countEl && typeof getAliveLobbyFighters === "function") {
      countEl.textContent = String(getAliveLobbyFighters(lobbyState).length);
    }
    const dropdown = document.getElementById("standings-dropdown");
    const strip = document.getElementById("lobby-roster-strip-battle");
    if (dropdown && strip && isBattleUiPhase()) {
      dropdown.innerHTML = strip.innerHTML;
    }
    return;
  }
  // В лобби список соперников — кружки с эмоциями поверх поля prep.
  const showStandings = false;
  standingsAnchor?.toggleAttribute("hidden", !showStandings);

  if (showStandings && lobbyState) {
    const countEl = document.getElementById("standings-alive-count");
    if (countEl && typeof getAliveLobbyFighters === "function") {
      countEl.textContent = String(getAliveLobbyFighters(lobbyState).length);
    }
  } else {
    closeStandingsDropdown();
  }

  if (!isPrep || !isPrepHeroCardHud()) {
    document.getElementById("prep-bottom-stats")?.setAttribute("hidden", "");
  }
}

function bindStandingsToggle() {
  const btn = document.getElementById("btn-standings-toggle");
  const dropdown = document.getElementById("standings-dropdown");
  if (!btn || !dropdown || btn.dataset.standingsBound === "true") return;
  btn.dataset.standingsBound = "true";

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const willOpen = dropdown.classList.contains("hidden");
    dropdown.classList.toggle("hidden", !willOpen);
    dropdown.setAttribute("aria-hidden", willOpen ? "false" : "true");
    btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    btn.classList.toggle("active", willOpen);
    if (willOpen) {
      requestAnimationFrame(() => positionStandingsDropdown());
    } else {
      dropdown.style.removeProperty("left");
      dropdown.style.removeProperty("bottom");
      dropdown.style.removeProperty("position");
    }
  });

  window.addEventListener("resize", () => positionStandingsDropdown(), { passive: true });

  document.addEventListener("click", (e) => {
    if (dropdown.classList.contains("hidden")) return;
    if (e.target.closest(".standings-anchor")) return;
    closeStandingsDropdown();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeStandingsDropdown();
  });
}

function syncLobbyPrepTimerChrome() {
  if (!isAnyLobbyMode() || !lobbyState || phase !== "prep") return;
  const bottomTimer = document.getElementById("lobby-prep-timer-bottom");
  if (!bottomTimer || typeof syncLobbyPrepTimerDOM !== "function") return;
  syncLobbyPrepTimerDOM(
    bottomTimer,
    lobbyPrepTimerRemaining,
    lobbyPrepTimerActive,
    { total: typeof LOBBY_PREP_SECONDS !== "undefined" ? LOBBY_PREP_SECONDS : 50 },
  );
}

function renderLobbyChrome(force = false) {
  const prepFieldRoster = document.getElementById("lobby-prep-field-roster");
  const battleRosterBar = document.getElementById("lobby-battle-roster-bar");
  const stripPrep = document.getElementById("lobby-roster-strip-prep");
  const stripBattle = document.getElementById("lobby-roster-strip-battle");
  const show = isAnyLobbyMode() && !!lobbyState;
  prepFieldRoster?.classList.toggle("hidden", !show || phase !== "prep" || (isLobby2pMode() && lobbyState?.isSplitLobby));
  battleRosterBar?.classList.toggle("hidden", !show || !isBattleUiPhase());
  syncPrepBottomBarChrome();
  if (!show) {
    const bottomTimer = document.getElementById("lobby-prep-timer-bottom");
    if (bottomTimer) {
      bottomTimer.innerHTML = "";
      bottomTimer.classList.add("hidden");
    }
    syncLobbyReturnTableButton();
    return;
  }

  const rosterOpts = phase === "prep"
    ? { phase: "prep", viewFighterId: lobbyViewFighterId, round }
    : { phase: "battle", spectateMatchId: lobbySpectateMatchId, matches: lobbyMatches, layout: "bottom", round };
  const stripSig = typeof buildLobbyRosterStripSignature === "function"
    ? buildLobbyRosterStripSignature(lobbyState, rosterOpts)
    : "";
  const rosterPhaseChanged = phase !== lastLobbyRosterStripPhase;
  if (force || rosterPhaseChanged || stripSig !== lastLobbyRosterStripSig) {
    lastLobbyRosterStripSig = stripSig;
    lastLobbyRosterStripPhase = phase;
    const stripHtml = renderLobbyRosterStrip(lobbyState, rosterOpts);
    const prepStrip = typeof isLobbyRosterPrepStripHtml === "function"
      ? isLobbyRosterPrepStripHtml(stripHtml)
      : stripHtml.includes('data-lobby-fighter="');
    if (stripPrep && (phase === "prep" || prepStrip)) stripPrep.innerHTML = stripHtml;
    if (stripBattle && isBattleUiPhase()) stripBattle.innerHTML = stripHtml;
  }
  syncLobbyReturnTableButton();
  syncLobby2pBattleTabs();
  if (typeof Lobby2pHud !== "undefined") Lobby2pHud.syncBattle();
  if (show && phase === "prep") {
    if (typeof syncLobbyFighterAvatars === "function") {
      syncLobbyFighterAvatars(lobbyState, rosterOpts);
    }
    if (typeof syncLobbyFighterCardHp === "function") {
      syncLobbyFighterCardHp(lobbyState, rosterOpts);
    }
  }
  const bottomTimer = document.getElementById("lobby-prep-timer-bottom");
  const heroTimer = document.getElementById("prep-hero-card-timer");
  if (heroTimer) heroTimer.innerHTML = "";
  const timerOpts = {
    total: typeof LOBBY_PREP_SECONDS !== "undefined" ? LOBBY_PREP_SECONDS : 50,
  };
  if (bottomTimer) {
    if (typeof syncLobbyPrepTimerDOM === "function") {
      syncLobbyPrepTimerDOM(
        bottomTimer,
        lobbyPrepTimerRemaining,
        phase === "prep" && lobbyPrepTimerActive,
        timerOpts,
      );
    } else {
      const timerHtml = phase === "prep" && lobbyPrepTimerActive
        ? renderLobbyPrepTimerHTML(lobbyPrepTimerRemaining, true, timerOpts)
        : "";
      bottomTimer.innerHTML = timerHtml;
      bottomTimer.classList.toggle("hidden", !timerHtml);
    }
  }
  if (isBattleUiPhase() && typeof queuePrewarmBattleInventoryPopover === "function") {
    const popoverOpen = typeof isBattleInventoryPopoverOpen === "function" && isBattleInventoryPopoverOpen();
    if (!isLobbyMode() || popoverOpen || isLobby2pMode()) {
      queuePrewarmBattleInventoryPopover();
    }
  }
}

function clearLobbyRosterTouchHighlights(root) {
  root?.querySelectorAll(".lobby-fighter-card--touch, .lobby-prep-field-chip--touch").forEach((el) => {
    el.classList.remove("lobby-fighter-card--touch", "lobby-prep-field-chip--touch");
  });
}

function bindLobbyRosterClicks() {
  const onRosterPointerDown = (e) => {
    if (e.button !== 0) return;
    const enemyChip = e.target.closest(
      ".lobby-fighter-card:not(.lobby-fighter-card--yours), .lobby-prep-field-chip:not(.lobby-prep-field-chip--yours)",
    );
    if (enemyChip && phase === "prep") {
      enemyChip.classList.add(
        enemyChip.classList.contains("lobby-prep-field-chip")
          ? "lobby-prep-field-chip--touch"
          : "lobby-fighter-card--touch",
      );
    }
    const fighterBtn = e.target.closest("[data-lobby-fighter]");
    if (fighterBtn && isLobbyMode() && phase === "prep" && !fighterBtn.disabled) {
      e.preventDefault();
      setLobbyViewFighter(Number(fighterBtn.dataset.lobbyFighter));
      closeStandingsDropdown();
      return;
    }
    const spectateBtn = e.target.closest("[data-lobby-spectate]");
    if (spectateBtn && isAnyLobbyMode() && isBattleUiPhase()) {
      e.preventDefault();
      const idx = Number(spectateBtn.dataset.lobbySpectate);
      if (Number.isFinite(idx)) setLobbySpectateMatch(idx);
      return;
    }
    const fighterCard = e.target.closest("[data-lobby-fighter-card]");
    if (fighterCard && isAnyLobbyMode() && isBattleUiPhase() && !fighterCard.disabled) {
      e.preventDefault();
      const idx = Number(fighterCard.dataset.lobbySpectate);
      if (Number.isFinite(idx)) setLobbySpectateMatch(idx);
    }
  };
  const onRosterPointerEnd = (e) => {
    clearLobbyRosterTouchHighlights(e.currentTarget);
  };
  const standingsDropdown = document.getElementById("standings-dropdown");
  standingsDropdown?.addEventListener("pointerdown", onRosterPointerDown);
  standingsDropdown?.addEventListener("pointerup", onRosterPointerEnd);
  standingsDropdown?.addEventListener("pointercancel", onRosterPointerEnd);
  standingsDropdown?.addEventListener("pointerleave", onRosterPointerEnd);
  const prepFieldRoster = document.getElementById("lobby-prep-field-roster");
  prepFieldRoster?.addEventListener("pointerdown", onRosterPointerDown);
  prepFieldRoster?.addEventListener("pointerup", onRosterPointerEnd);
  prepFieldRoster?.addEventListener("pointercancel", onRosterPointerEnd);
  prepFieldRoster?.addEventListener("pointerleave", onRosterPointerEnd);
  document.getElementById("lobby-battle-roster-bar")?.addEventListener("pointerdown", onRosterPointerDown);
  bindStandingsToggle();
  document.getElementById("btn-lobby-return-table")?.addEventListener("click", (e) => {
    e.preventDefault();
    returnToLobbyPlayerMatch();
  });
}

function initLobbyRun() {
  lobbyState = initLobby(playerClass, GRID_COLS, GRID_ROWS);
  lobbyViewFighterId = lobbyState.playerId;
  lobbyMatches = [];
  lobbySpectateMatchId = 0;
  const player = getLobbyPlayer(lobbyState);
  if (player) {
    player.companionId = playerCompanionId;
    player.enhancements = playerEnhancements;
  }
  runLobbyBotsShopPhase(lobbyState, round);
  if (typeof syncAllLobbyFighterMutations === "function") {
    syncAllLobbyFighterMutations(lobbyState, round);
  }
  pickLobbyOpponent(lobbyState);
  resetLobbyPrepTimer();
  if (typeof resetLobbyFighterThoughts === "function") resetLobbyFighterThoughts();
  if (typeof seedLobbyFighterThoughts === "function") seedLobbyFighterThoughts(lobbyState);
  if (typeof DialogueEngine !== "undefined") {
    const prepDurationSec = typeof LOBBY_PREP_SECONDS !== "undefined" ? LOBBY_PREP_SECONDS : 55;
    DialogueEngine.reset(`lobby:${lobbyState?.seed || Date.now()}`);
    DialogueEngine.onRunStart(lobbyState, round, { prepDurationSec });
  }
  setLobbyViewFighter(lobbyState.playerId);
  delete document.documentElement.dataset.lobbySplit;
  syncLobby2pHudDom();
}

function initLobby2pRun() {
  lobbyState = initLobby2p(playerClass, enemyClass, GRID_COLS, GRID_ROWS);
  lobbyViewFighterId = 0;
  lobbyMatches = [];
  lobbySpectateMatchId = 0;
  const h0 = getLobbyHumanFighter(lobbyState, 0);
  const h1 = getLobbyHumanFighter(lobbyState, 1);
  if (h0) {
    h0.companionId = playerCompanionId;
    h0.enhancements = playerEnhancements;
  }
  if (h1) {
    h1.companionId = enemyCompanionId;
    h1.enhancements = enemyEnhancements;
  }
  importLobby2pHumanToGlobals(0);
  importLobby2pHumanToGlobals(1);
  runLobbyBotsShopPhase(lobbyState, round);
  if (typeof syncAllLobbyFighterMutations === "function") {
    syncAllLobbyFighterMutations(lobbyState, round);
  }
  resetShopForNewRoundForSide("player");
  resetShopForNewRoundForSide("enemy");
  prepViewSide = "player";
  document.getElementById("app")?.setAttribute("data-prep-side", "player");
  document.documentElement.dataset.lobbySplit = "true";
  if (typeof resetLobbyFighterThoughts === "function") resetLobbyFighterThoughts();
  if (typeof seedLobbyFighterThoughts === "function") seedLobbyFighterThoughts(lobbyState);
  if (typeof DialogueEngine !== "undefined") {
    const prepDurationSec = typeof LOBBY_PREP_SECONDS !== "undefined" ? LOBBY_PREP_SECONDS : 55;
    DialogueEngine.reset(`lobby2p:${lobbyState?.seed || Date.now()}`);
    DialogueEngine.onRunStart(lobbyState, round, { prepDurationSec });
  }
  lobby2pShopPopoverHuman = 0;
  lobby2pBenchPopoverHuman = 0;
  if (typeof window.closePrepShopPopover === "function") window.closePrepShopPopover();
  if (typeof window.closePrepBenchPopover === "function") window.closePrepBenchPopover();
  syncLobby2pHudDom();
  applyPhaseCanvasLayout();
  draw();
}

function getLobby2pHumanGlobals(humanId) {
  if (humanId === 0) {
    return {
      classId: playerClass,
      gold,
      containers: playerContainers,
      items: playerItems,
      bench,
      pendingShopBuffs: playerPendingShopBuffs,
      companionId: playerCompanionId,
      mutationFormId: playerMutationFormId,
      mutationId: playerMutationId,
      enhancements: playerEnhancements,
      round,
    };
  }
  return {
    classId: enemyClass,
    gold: enemyGold,
    containers: enemyContainers,
    items: enemyItems,
    bench: enemyBench,
    pendingShopBuffs: enemyPendingShopBuffs,
    companionId: enemyCompanionId,
    mutationFormId: enemyMutationFormId,
    mutationId: enemyMutationId,
    enhancements: enemyEnhancements,
    round,
  };
}

function syncLobby2pHumanFromGlobals(humanId) {
  if (!lobbyState?.isSplitLobby) return;
  importLobbyFighterGlobals(lobbyState, humanId, getLobby2pHumanGlobals(humanId));
}

function syncLobby2pBothFromGlobals() {
  syncLobby2pHumanFromGlobals(0);
  syncLobby2pHumanFromGlobals(1);
}

function importLobby2pHumanToGlobals(humanId) {
  const fighter = getLobbyHumanFighter(lobbyState, humanId);
  if (!fighter) return;
  const ghost = exportGhostFighterState(fighter);
  if (!ghost) return;
  if (humanId === 0) {
    playerClass = ghost.classId;
    gold = ghost.gold;
    playerContainers = ghost.containers;
    playerItems = ghost.items;
    bench = fighter.bench ? fighter.bench.map((e) => (e ? { ...e } : null)) : [];
    playerCompanionId = ghost.companionId || playerCompanionId;
    playerMutationFormId = ghost.mutationFormId ?? null;
    playerMutationId = ghost.mutationId ?? null;
    if (ghost.enhancements) playerEnhancements = { ...ghost.enhancements };
  } else {
    enemyClass = ghost.classId;
    enemyGold = ghost.gold;
    enemyContainers = ghost.containers;
    enemyItems = ghost.items;
    enemyBench = fighter.bench ? fighter.bench.map((e) => (e ? { ...e } : null)) : [];
    enemyCompanionId = ghost.companionId || enemyCompanionId;
    enemyMutationFormId = ghost.mutationFormId ?? null;
    enemyMutationId = ghost.mutationId ?? null;
    if (ghost.enhancements) enemyEnhancements = { ...ghost.enhancements };
  }
}

function lobby2pHasSideBattle(humanId) {
  const sb = lobbyState?.sideBattles?.[humanId];
  return !!(sb?.state && !sb.state.finished);
}

function lobby2pHasAnySideBattle() {
  return lobby2pHasSideBattle(0) || lobby2pHasSideBattle(1);
}

function lobby2pHasActiveDuel() {
  const sb0 = lobbyState?.sideBattles?.[0];
  const sb1 = lobbyState?.sideBattles?.[1];
  return !!(sb0?.type === "duel" && sb0?.state && !sb0.state.finished)
    || !!(sb1?.type === "duel" && sb1?.state && !sb1.state.finished);
}

function lobby2pResolvePointerSide(clientX, canvasRect) {
  if (!canvasRect?.width) return prepViewSide;
  const mid = canvasRect.left + canvasRect.width / 2;
  return clientX < mid ? "player" : "enemy";
}

function isLobby2pColumnPrepLayout() {
  return isLobby2pMode() && phase === "prep" && lobbyState?.isSplitLobby
    && !lobby2pHasActiveDuel() && !lobby2pHasAnySideBattle();
}

function getLobby2pColumnWidth() {
  const cw = canvas?.width || BATTLE_CANVAS_W;
  return cw / 2;
}

function getLobby2pColumnGridOrigin(team) {
  const colW = getLobby2pColumnWidth();
  const inset = Math.max(0, (colW - GRID_INNER_W) / 2);
  return team === "player" ? inset : colW + inset;
}

function getLobby2pColumnClip(half) {
  const colW = getLobby2pColumnWidth();
  return { x: half === "left" ? 0 : colW, w: colW };
}

/** Popover магазина: какой humanId (0|1) открыл drawer. */
let lobby2pShopPopoverHuman = 0;
/** Popover скамейки: какой humanId (0|1) открыл drawer. */
let lobby2pBenchPopoverHuman = 0;

function getLobby2pShopPopoverHuman() {
  return lobby2pShopPopoverHuman;
}

function syncLobby2pShopFabExpanded() {
  const open = typeof window.isPrepShopPopoverOpen === "function" && window.isPrepShopPopoverOpen();
  document.querySelectorAll(".lobby2p-shop-fab").forEach((btn) => {
    const humanId = Number(btn.dataset.human);
    btn.setAttribute("aria-expanded", open && humanId === lobby2pShopPopoverHuman ? "true" : "false");
  });
}

function syncLobby2pBenchFabExpanded() {
  const benchOpen = typeof window.isPrepBenchPopoverOpen === "function" && window.isPrepBenchPopoverOpen();
  document.querySelectorAll(".lobby2p-bench-fab").forEach((btn) => {
    const humanId = Number(btn.dataset.human);
    btn.setAttribute("aria-expanded", benchOpen && humanId === lobby2pBenchPopoverHuman ? "true" : "false");
  });
}

function syncLobby2pBenchFabBadges() {
  [0, 1].forEach((humanId) => {
    const arr = humanId === 0 ? bench : enemyBench;
    const count = arr.filter(Boolean).length;
    const countEl = document.getElementById(`lobby2p-bench-count-${humanId}`);
    if (countEl) countEl.textContent = String(count);
    const fab = document.querySelector(`.lobby2p-bench-fab[data-human="${humanId}"]`);
    fab?.classList.toggle("lobby2p-bench-fab--has-items", count > 0);
  });
}

function getLobby2pBenchPopoverHuman() {
  return lobby2pBenchPopoverHuman;
}

function openLobby2pShop(humanId) {
  if (!isLobby2pMode() || !lobbyState?.isSplitLobby || phase !== "prep") return;
  if (typeof window.closePrepBenchPopover === "function") window.closePrepBenchPopover();
  lobby2pShopPopoverHuman = humanId;
  setLobby2pActiveHuman(humanId);
  if (typeof window.syncShopMount === "function") window.syncShopMount();
  renderShop(prepViewSide, document.getElementById("shop-slots"));
  if (typeof window.openPrepShopPopover === "function") window.openPrepShopPopover();
  syncLobby2pShopFabExpanded();
  requestAnimationFrame(() => {
    if (typeof window.syncPrepShopPopoverPosition === "function") window.syncPrepShopPopoverPosition();
  });
}

function toggleLobby2pShop(humanId) {
  const shopOpen = typeof window.isPrepShopPopoverOpen === "function" && window.isPrepShopPopoverOpen();
  if (shopOpen && lobby2pShopPopoverHuman === humanId) {
    if (typeof window.closePrepShopPopover === "function") window.closePrepShopPopover();
    syncLobby2pShopFabExpanded();
    return;
  }
  openLobby2pShop(humanId);
}

function openLobby2pBench(humanId) {
  if (!isLobby2pMode() || !lobbyState?.isSplitLobby || phase !== "prep") return;
  if (typeof window.closePrepShopPopover === "function") window.closePrepShopPopover();
  lobby2pBenchPopoverHuman = humanId;
  setLobby2pActiveHuman(humanId);
  if (typeof window.syncBenchMount === "function") window.syncBenchMount();
  renderBench(prepViewSide, document.getElementById("bench-slots"));
  if (typeof window.openPrepBenchPopover === "function") window.openPrepBenchPopover();
  syncLobby2pBenchFabExpanded();
  syncLobby2pShopFabExpanded();
  requestAnimationFrame(() => {
    if (typeof window.syncLobby2pBenchPopoverPosition === "function") {
      window.syncLobby2pBenchPopoverPosition();
    }
  });
}

function toggleLobby2pBench(humanId) {
  const benchOpen = typeof window.isPrepBenchPopoverOpen === "function" && window.isPrepBenchPopoverOpen();
  if (benchOpen && lobby2pBenchPopoverHuman === humanId) {
    if (typeof window.closePrepBenchPopover === "function") window.closePrepBenchPopover();
    syncLobby2pBenchFabExpanded();
    return;
  }
  openLobby2pBench(humanId);
}

function lobby2pSideFromHudTarget(target) {
  if (!isLobby2pMode() || !lobbyState?.isSplitLobby) return null;
  const col = target?.closest?.(
    ".lobby2p-col-commerce[data-human], .lobby2p-col-shop[data-human], .lobby2p-col-bench[data-human], .lobby2p-col-head[data-human]",
  );
  if (!col) return null;
  return Number(col.dataset.human) === 0 ? "player" : "enemy";
}

function lobby2pSideFromCommerceTarget(target) {
  return lobby2pSideFromHudTarget(target);
}

function ensureLobby2pActiveHumanForSide(side) {
  if (!isLobby2pMode() || !lobbyState?.isSplitLobby) return;
  const humanId = side === "player" ? 0 : 1;
  if ((prepViewSide === "player" ? 0 : 1) !== humanId) setLobby2pActiveHuman(humanId);
}

function resolveShopCardElement(side, index) {
  return document.querySelector(`#shop-slots .shop-card[data-index="${index}"]`)
    || document.querySelector(`.shop-card[data-index="${index}"]`);
}

function resolveBenchCardElement(side, index) {
  if (isLobby2pMode() && lobbyState?.isSplitLobby) {
    if (typeof window.isPrepBenchPopoverOpen === "function" && window.isPrepBenchPopoverOpen()) {
      return document.querySelector(`#bench-slots .bench-card[data-bench="${index}"]`);
    }
    return null;
  }
  return document.querySelector(`#bench-slots .bench-card[data-bench="${index}"]`);
}

function lobby2pSideFromCanvasX(mx) {
  return mx < getLobby2pColumnWidth() ? "player" : "enemy";
}

/** 'column' — сетка P1/P2 по центру своей половины canvas. */
let lobby2pDrawLayout = null;
/** true во время drawLobby2pPrepHalf: origin в локальных координатах колонки + ctx.translate. */
let lobby2pDrawColumnLocal = false;

function isLobby2pColumnLayoutActive() {
  return lobby2pDrawLayout === "column"
    || lobby2pDrawColumnLocal
    || isLobby2pColumnPrepLayout();
}

function lobby2pColumnInset() {
  const colW = getLobby2pColumnWidth();
  return Math.max(0, (colW - GRID_INNER_W) / 2);
}

function setLobby2pActiveHuman(humanId) {
  if (!isLobby2pMode()) return;
  syncLobby2pHumanFromGlobals(prepViewSide === "player" ? 0 : 1);
  prepViewSide = humanId === 0 ? "player" : "enemy";
  lobbyViewFighterId = humanId;
  const shopOpen = typeof window.isPrepShopPopoverOpen === "function" && window.isPrepShopPopoverOpen();
  const benchOpen = typeof window.isPrepBenchPopoverOpen === "function" && window.isPrepBenchPopoverOpen();
  if (shopOpen) lobby2pShopPopoverHuman = humanId;
  if (benchOpen) lobby2pBenchPopoverHuman = humanId;
  const app = document.getElementById("app");
  if (app) app.dataset.prepSide = prepViewSide;
  clearDragUiState();
  closePrepHeroTooltip();
  ensureShopReadyForSide(prepViewSide);
  updatePrepSideUI();
  if (isLobby2pMode() && lobbyState?.isSplitLobby) {
    renderLobby2pCommerce();
    syncLobby2pShopFabExpanded();
    syncLobby2pBenchFabExpanded();
    if (shopOpen) {
      renderShop(prepViewSide, document.getElementById("shop-slots"));
      requestAnimationFrame(() => {
        if (typeof window.syncPrepShopPopoverPosition === "function") window.syncPrepShopPopoverPosition();
      });
    }
    if (benchOpen) {
      if (typeof window.syncBenchMount === "function") window.syncBenchMount();
      renderBench(prepViewSide, document.getElementById("bench-slots"));
      requestAnimationFrame(() => {
        if (typeof window.syncLobby2pBenchPopoverPosition === "function") {
          window.syncLobby2pBenchPopoverPosition();
        }
      });
    }
  } else {
    renderShop();
    renderBench();
  }
  recalcSynergies();
  syncLobby2pHudDom();
  draw();
}

function toggleLobby2pReady(humanId) {
  if (!lobbyState?.isSplitLobby || phase !== "prep") return;
  if (lobby2pHasSideBattle(humanId)) return;
  lobbyState.ready[humanId] = !lobbyState.ready[humanId];
  playPrepSfx(lobbyState.ready[humanId] ? "ui_confirm" : "ui_click");
  log(lobbyState.ready[humanId]
    ? `${getLobbyHumanFighter(lobbyState, humanId)?.name || "Игрок"} готов к раунду`
    : `${getLobbyHumanFighter(lobbyState, humanId)?.name || "Игрок"} снял готовность`);
  syncLobby2pHudDom();
  tryStartLobby2pScheduledRound();
}

function tryStartLobby2pScheduledRound() {
  if (!lobbyState?.isSplitLobby || phase !== "prep") return;
  if (!lobbyState.ready[0] || !lobbyState.ready[1]) return;
  if (lobby2pHasAnySideBattle()) return;
  lobbyState.ready[0] = false;
  lobbyState.ready[1] = false;
  syncLobby2pBothFromGlobals();
  syncLobby2pHudDom();
  executeBattleStart();
}

function createLobby2pSideBattleState(humanId, opponentFighter, type) {
  const human = getLobbyHumanFighter(lobbyState, humanId);
  if (!human?.alive || !opponentFighter?.alive) return null;
  syncLobby2pBothFromGlobals();
  const humanItems = fighterBattleItems(human);
  const oppItems = fighterBattleItems(opponentFighter);
  return createBattleState(
    humanItems,
    oppItems,
    human.classId,
    opponentFighter.classId,
    round,
    {
      player: lobbyFighterPrepMeta(human),
      enemy: lobbyFighterPrepMeta(opponentFighter),
    },
  );
}

function startLobby2pFarm(humanId) {
  if (!lobbyState?.isSplitLobby || phase !== "prep") return;
  if (lobby2pHasAnySideBattle()) return;
  syncLobby2pBothFromGlobals();
  const bot = pickStrongestLobbyBot(lobbyState, [humanId]);
  if (!bot) {
    log("Нет доступных ботов для фарма");
    playPrepSfx("ui_error");
    return;
  }
  const state = createLobby2pSideBattleState(humanId, bot, "farm");
  if (!state) return;
  state.recording = humanId === 0;
  lobbyState.sideBattles[humanId] = { type: "farm", opponentId: bot.id, state, shared: false };
  lobbyState.ready[humanId] = false;
  log(`🌾 ${getLobbyHumanFighter(lobbyState, humanId)?.name}: фарм vs ${bot.name}`);
  playPrepSfx("battle_start");
  syncLobby2pHudDom();
  renderFightButton();
}

function startLobby2pDuel(challengerId) {
  if (!lobbyState?.isSplitLobby || phase !== "prep") return;
  if (lobby2pHasAnySideBattle()) return;
  const targetId = challengerId === 0 ? 1 : 0;
  const challenger = getLobbyHumanFighter(lobbyState, challengerId);
  const target = getLobbyHumanFighter(lobbyState, targetId);
  if (!challenger?.alive || !target?.alive) return;
  syncLobby2pBothFromGlobals();
  const state = createLobby2pSideBattleState(challengerId, target, "duel");
  if (!state) return;
  state.recording = true;
  const duelEntry = { type: "duel", opponentId: targetId, state, shared: true };
  lobbyState.sideBattles[0] = duelEntry;
  lobbyState.sideBattles[1] = duelEntry;
  lobbyState.ready[0] = false;
  lobbyState.ready[1] = false;
  log(`⚔️ Дуэль: ${challenger.name} vs ${target.name}`);
  playPrepSfx("battle_start");
  syncLobby2pHudDom();
  renderFightButton();
}

function finishLobby2pSideBattle(humanId, state, type) {
  if (!lobbyState?.isSplitLobby || !state?.finished) return;
  const human = getLobbyHumanFighter(lobbyState, humanId);
  const opponent = lobbyState.fighters[lobbyState.sideBattles[humanId]?.opponentId];
  if (!human || !opponent) return;

  const pseudoMatch = {
    id: -1,
    fighterAId: human.id,
    fighterBId: opponent.id,
    isPlayerMatch: true,
    state,
    finished: true,
  };
  const summary = applyLobbyMatchHpResult(lobbyState, pseudoMatch);
  importLobby2pHumanToGlobals(humanId);
  if (type === "duel" && opponent.isHuman) {
    importLobby2pHumanToGlobals(opponent.id);
  }

  if (state.winner === "player") {
    const reward = ROUND_GOLD + WIN_GOLD;
    if (humanId === 0) gold += reward;
    else enemyGold += reward;
    syncLobby2pHumanFromGlobals(humanId);
  } else if (state.winner === "enemy") {
    const reward = ROUND_GOLD;
    if (humanId === 0) gold += reward;
    else enemyGold += reward;
    syncLobby2pHumanFromGlobals(humanId);
  }

  const labels = getLobbyMatchLabels(lobbyState, pseudoMatch);
  const winnerName = state.winner === "player" ? labels.a : state.winner === "enemy" ? labels.b : null;
  if (winnerName) {
    log(`${type === "duel" ? "⚔️ Дуэль" : "🌾 Фарм"}: победа ${winnerName}${summary?.damage ? ` (−${summary.damage} HP)` : ""}`);
  } else {
    log(`${type === "duel" ? "⚔️ Дуэль" : "🌾 Фарм"}: ничья`);
  }

  if (type === "duel") {
    lobbyState.sideBattles[0] = null;
    lobbyState.sideBattles[1] = null;
  } else {
    lobbyState.sideBattles[humanId] = null;
  }
  syncLobby2pHudDom();
  renderFightButton();
  updateUI();
  if (isLobby2pRunOver(lobbyState)) {
    pendingGameOver = true;
    updateUI();
  }
}

function tickLobby2pSideBattles(dt) {
  if (!isLobby2pMode() || phase !== "prep" || !lobbyState?.isSplitLobby) return;
  const seen = new Set();
  [0, 1].forEach((humanId) => {
    const sb = lobbyState.sideBattles[humanId];
    if (!sb?.state || sb.state.finished) return;
    if (seen.has(sb.state)) return;
    seen.add(sb.state);
    const state = sb.state;
    const countdownDt = typeof getBattleCountdownDt === "function" ? getBattleCountdownDt(dt) : dt;
    if (countdownDt > 0 && typeof tickBattleCountdown === "function") {
      tickBattleCountdown(state, countdownDt);
    }
    const simDt = typeof getBattleSimDt === "function" ? getBattleSimDt(dt) : dt;
    const countdownActive = typeof isBattleCountdownActive === "function" && isBattleCountdownActive(state);
    if (simDt > 0 && !countdownActive) {
      battleTick(state, simDt);
      if (state.recording) recordBattleFrame(state);
    }
    if (state.finished) {
      finishLobby2pSideBattle(humanId, state, sb.type);
    }
  });
}

function renderLobby2pCommerce() {
  ensureShopReadyForSide("player");
  ensureShopReadyForSide("enemy");
  const shopOpen = typeof window.isPrepShopPopoverOpen === "function" && window.isPrepShopPopoverOpen();
  if (shopOpen) {
    renderShop(prepViewSide, document.getElementById("shop-slots"));
  }
  const benchOpen = typeof window.isPrepBenchPopoverOpen === "function" && window.isPrepBenchPopoverOpen();
  if (benchOpen) {
    renderBench(prepViewSide, document.getElementById("bench-slots"));
  }
  syncLobby2pBenchFabBadges();
}

function syncLobby2pHudDom() {
  if (typeof Lobby2pHud !== "undefined") Lobby2pHud.sync();
}

function initLobby2pHudBridge() {
  if (typeof Lobby2pHud === "undefined") return;
  Lobby2pHud.register({
    isActive: () => isLobby2pMode() && phase === "prep" && !!lobbyState?.isSplitLobby,
    getRound: () => round,
    getAliveCount: () => (lobbyState ? getAliveLobbyFighters(lobbyState).length : 0),
    getFighter: (id) => getLobbyHumanFighter(lobbyState, id),
    getClassId: (id) => (id === 0 ? playerClass : enemyClass),
    getEnhancements: (id) => (id === 0 ? playerEnhancements : enemyEnhancements),
    getItems: (id) => (id === 0 ? playerItems : enemyItems),
    getActiveHuman: () => (prepViewSide === "player" ? 0 : 1),
    getReady: (id) => !!lobbyState?.ready?.[id],
    hasSideBattle: (id) => lobby2pHasSideBattle(id),
    hasAnySideBattle: () => lobby2pHasAnySideBattle(),
    hasActiveDuel: () => lobby2pHasActiveDuel(),
    getBenchCount: (id) => {
      const arr = id === 0 ? bench : enemyBench;
      return arr.filter(Boolean).length;
    },
    setActiveHuman: (id) => setLobby2pActiveHuman(id),
    toggleReady: (id) => toggleLobby2pReady(id),
    startFarm: (id) => startLobby2pFarm(id),
    startDuel: (id) => startLobby2pDuel(id),
    refreshShop: (id) => {
      const side = id === 0 ? "player" : "enemy";
      setLobby2pActiveHuman(id);
      refreshShop(true, side);
      syncLobby2pHumanFromGlobals(id);
      renderLobby2pCommerce();
      if (typeof window.isPrepShopPopoverOpen === "function" && window.isPrepShopPopoverOpen()) {
        renderShop(prepViewSide, document.getElementById("shop-slots"));
      }
      syncLobby2pHudDom();
    },
    toggleShop: (id) => toggleLobby2pShop(id),
    toggleBench: (id) => toggleLobby2pBench(id),
    openShop: (id) => openLobby2pShop(id),
    renderCommerce: () => renderLobby2pCommerce(),
    renderRosterHtml: () => {
      if (!lobbyState || typeof renderLobbyRosterStrip !== "function") return "";
      return renderLobbyRosterStrip(lobbyState, {
        phase: "prep",
        viewFighterId: lobbyViewFighterId,
        round,
      });
    },
    scheduleLayout: () => {
      if (typeof window.scheduleLayout === "function") window.scheduleLayout();
      else if (typeof applyUiLayout === "function") applyUiLayout();
      if (typeof window.syncShopMount === "function") window.syncShopMount();
      document.documentElement.dataset.prepShopPopover = "true";
      if (typeof window.fitCanvasDisplaySize === "function") window.fitCanvasDisplaySize();
      draw();
    },
    isBattleActive: () => isLobby2pMode() && isBattleUiPhase() && !!lobbyState?.isSplitLobby,
    getHumanMatchIndex: (id) => findLobby2pHumanMatchIndex(id),
    getSpectatedHuman: () => {
      const match = lobbyMatches?.[lobbySpectateMatchId];
      return match?.isPlayerMatch ? match.humanId : null;
    },
    isHumanMatchLive: (humanId) => {
      const idx = findLobby2pHumanMatchIndex(humanId);
      const match = idx >= 0 ? lobbyMatches[idx] : null;
      return !!(match?.state && !match.state.finished);
    },
    isHumanMatchDone: (humanId) => {
      const idx = findLobby2pHumanMatchIndex(humanId);
      const match = idx >= 0 ? lobbyMatches[idx] : null;
      return !!(match?.state?.finished);
    },
    getHumanOpponentName: (humanId) => {
      const idx = findLobby2pHumanMatchIndex(humanId);
      const match = idx >= 0 ? lobbyMatches[idx] : null;
      if (!match || !lobbyState) return "";
      const oppId = match.fighterAId === humanId ? match.fighterBId : match.fighterAId;
      return lobbyState.fighters[oppId]?.name || "";
    },
    spectateHuman: (humanId) => {
      const idx = findLobby2pHumanMatchIndex(humanId);
      if (idx >= 0) setLobbySpectateMatch(idx);
    },
  });
  Lobby2pHud.bind();
}

function drawLobby2pPrepHalf(side, useColumnLayout = false) {
  const prevLayout = lobby2pDrawLayout;
  const prevLocal = lobby2pDrawColumnLocal;
  const half = side === "player" ? "left" : "right";
  let columnClip = null;
  if (useColumnLayout) {
    lobby2pDrawLayout = "column";
    lobby2pDrawColumnLocal = true;
    columnClip = getLobby2pColumnClip(half);
  }
  const st = getSideState(side);
  const shake = typeof getPrepBackpackShakeOffset === "function"
    ? getPrepBackpackShakeOffset()
    : { x: 0, y: 0 };
  ctx.save();
  if (columnClip) {
    ctx.beginPath();
    ctx.rect(columnClip.x, 0, columnClip.w, canvas.height);
    ctx.clip();
    ctx.translate(columnClip.x, 0);
  }
  ctx.translate(shake.x, shake.y);
  const frameOptions = {
    showFullPlacementGrid: shouldShowFullContainerPlacementGrid(),
    containers: st.containers,
    items: st.items,
  };
  drawBackpackFrame(side, frameOptions);
  drawContainers(st.containers, side, false);
  drawSynergyVisuals(ctx, synergyAnimTime, synergyPreviewBuilt, "under", side);
  drawLoadoutItems(st.items, side, false);
  if (typeof drawAllPrepItemIdleEffects === "function") {
    drawAllPrepItemIdleEffects(ctx, st.items, side, synergyAnimTime);
  }
  drawSynergyVisuals(ctx, synergyAnimTime, synergyPreviewBuilt, "over", side);
  if (typeof drawPrepSynergyEnhancements === "function") {
    drawPrepSynergyEnhancements(ctx, synergyAnimTime, side, st.items);
  }
  if (canEditPrepSide(side) && dragPayload && getPrepDropPlacement(st, side)) {
    if (typeof drawPrepDropPreview === "function") drawPrepDropPreview(ctx, side, st);
    else drawDropPreview(ctx);
  }
  ctx.restore();
  lobby2pDrawLayout = prevLayout;
  lobby2pDrawColumnLocal = prevLocal;
}

function drawLobby2pSideBattleHalf(sideBattle, half, humanId) {
  const state = sideBattle.state;
  if (!state) return;
  const { x: clipX, w: clipW } = getLobby2pColumnClip(half);
  const mirror = humanId === 1;
  const humanTeam = mirror ? "enemy" : "player";
  const oppTeam = mirror ? "player" : "enemy";
  const humanContainers = mirror ? enemyContainers : playerContainers;
  const oppContainers = mirror ? playerContainers : enemyContainers;
  ctx.save();
  ctx.beginPath();
  ctx.rect(clipX, 0, clipW, canvas.height);
  ctx.clip();
  drawBackpackFrame(humanTeam, { containers: humanContainers, items: state.player.items });
  drawBackpackFrame(oppTeam, { containers: oppContainers, items: state.enemy.items });
  drawContainers(humanContainers, humanTeam, false);
  drawContainers(oppContainers, oppTeam, false);
  drawPlacedItems(state.player.items, humanTeam, false, true);
  drawPlacedItems(state.enemy.items, oppTeam, true, true);
  ctx.restore();
}

function drawLobby2pSideBattleFx(fxLayerCtx, state, half, humanId) {
  if (!state || !fxLayerCtx) return;
  const { x: clipX, w: clipW } = getLobby2pColumnClip(half);
  const mirror = humanId === 1;
  fxLayerCtx.save();
  fxLayerCtx.beginPath();
  fxLayerCtx.rect(clipX, 0, fxCanvas.width, fxCanvas.height);
  fxLayerCtx.clip();
  if (mirror) {
    fxLayerCtx.save();
    fxLayerCtx.translate(ENEMY_X + GRID_INNER_W, 0);
    fxLayerCtx.scale(-1, 1);
    fxLayerCtx.translate(-(ENEMY_X + GRID_INNER_W), 0);
    drawAttackAnimations(fxLayerCtx, state);
    fxLayerCtx.restore();
  } else {
    drawAttackAnimations(fxLayerCtx, state);
  }
  if (typeof renderBattleEffectsOverlay === "function") renderBattleEffectsOverlay(state);
  fxLayerCtx.restore();
}

function drawLobby2pSplitPrep() {
  if (lobby2pHasActiveDuel()) {
    const duelState = lobbyState.sideBattles[0]?.state;
    if (duelState) {
      drawBackpackFrame("player", { containers: playerContainers, items: duelState.player.items });
      drawBackpackFrame("enemy", { containers: enemyContainers, items: duelState.enemy.items });
      drawContainers(playerContainers, "player", false);
      drawContainers(enemyContainers, "enemy", false);
      drawPlacedItems(duelState.player.items, "player", false, true);
      drawPlacedItems(duelState.enemy.items, "enemy", true, true);
    }
    return;
  }
  const columnPrep = isLobby2pColumnPrepLayout();
  const sb0 = lobbyState.sideBattles[0];
  const sb1 = lobbyState.sideBattles[1];
  if (sb0?.state && !sb0.state.finished && !sb0.shared) {
    drawLobby2pSideBattleHalf(sb0, "left", 0);
  } else {
    drawLobby2pPrepHalf("player", columnPrep);
  }
  if (sb1?.state && !sb1.state.finished && !sb1.shared) {
    drawLobby2pSideBattleHalf(sb1, "right", 1);
  } else if (!sb0?.shared) {
    drawLobby2pPrepHalf("enemy", columnPrep);
  }
}
