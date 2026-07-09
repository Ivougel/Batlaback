/**
 * Main game loop + battle presentation tick — вынесено из game.js.
 * Состояние (phase, battleState, …) остаётся в game.js.
 */

function isBattleResultOverlayOpen() {
  return typeof isPopupOpen === "function" && isPopupOpen("battle-result-overlay");
}

function isBattleResultIdle() {
  return phase === "battle"
    && !battleState
    && isBattleResultOverlayOpen();
}

/** Result overlay на battle/replay — минимальный loop (gamepad), без FX/canvas. */
function isBattleResultFrozen() {
  if (!isBattleResultOverlayOpen()) return false;
  return phase === "battle" || phase === "replay";
}

/** Меню / выбор класса — не гонять 60 FPS gameLoop и canvas. */
function isGameLoopSuspended() {
  if (!document.body.classList.contains("screen-app-visible")) return true;
  if (phase === "classSelect") return true;
  return isPopupOpen("class-overlay");
}

/** Touch phone/tablet: prep без drag — 30 Hz вместо 60. */
function shouldThrottlePrepGameLoop() {
  if (phase !== "prep" || dragPayload || synergyState?.isDragging) return false;
  return typeof BattleFxTier !== "undefined" && BattleFxTier.shouldThrottleGameLoop?.();
}

/** Touch phone/tablet: бой — 20–30 Hz (dt сохраняет точность симуляции). */
function shouldThrottleBattleGameLoop() {
  if (!isBattleUiPhase()) return false;
  return typeof BattleFxTier !== "undefined" && BattleFxTier.shouldThrottleGameLoop?.();
}

/** Flank-бой: рюкзак на canvas не рисуется — только DOM float overlay. */
function shouldSkipFlankBattleCanvasDraw() {
  if (!isBattleUiPhase()) return false;
  if (document.documentElement.dataset.battleHeroPlacement !== "flank-arena") return false;
  return !shouldDrawCanvasLoadoutInBattle();
}

function tickFlankBattleDomOverlay(state) {
  if (!state || typeof renderBattleEffectsOverlay !== "function") return;
  const now = performance.now();
  const gap = typeof BattleFxTier !== "undefined" && BattleFxTier.battleFloatPresentGapMs
    ? BattleFxTier.battleFloatPresentGapMs()
    : 33;
  if (now - (tickFlankBattleDomOverlay._at || 0) < gap) return;
  tickFlankBattleDomOverlay._at = now;
  renderBattleEffectsOverlay(state);
}

/** Лёгкий HUD в бою: HP/stamina без полного renderPlayerProfiles. */
function syncLiveBattleHud(viewState) {
  if (!isBattleUiPhase() || !viewState) return;
  const now = performance.now();
  const gap = typeof BattleFxTier !== "undefined" && BattleFxTier.battleHudLiteGapMs
    ? BattleFxTier.battleHudLiteGapMs()
    : 120;
  if (now - (syncLiveBattleHud._at || 0) < gap) return;
  syncLiveBattleHud._at = now;
  if (typeof syncLiveAvatarHeroFrame === "function") syncLiveAvatarHeroFrame(viewState);
}

function syncLiveBattleProfiles(viewState) {
  if (!isBattleUiPhase() || !viewState) return;
  const now = performance.now();
  const gap = battleProfileTickMs();
  if (now - (syncLiveBattleProfiles._at || 0) < gap) return;
  syncLiveBattleProfiles._at = now;
  renderBattleStats();
  renderPlayerProfiles({ battleHudOnly: true });
  if (typeof refreshBattleInventoryPopover === "function") refreshBattleInventoryPopover();
}

function battleGameLoopGapMs() {
  if (typeof BattleFxTier !== "undefined" && BattleFxTier.battleGameLoopGapMs) {
    return BattleFxTier.battleGameLoopGapMs();
  }
  return 33;
}

function scheduleGameLoop() {
  if (isGameLoopSuspended() || isBattleResultFrozen()) {
    setTimeout(() => gameLoop(performance.now()), 250);
  } else if (shouldThrottleBattleGameLoop()) {
    setTimeout(() => gameLoop(performance.now()), battleGameLoopGapMs());
  } else if (shouldThrottlePrepGameLoop()) {
    setTimeout(() => gameLoop(performance.now()), 33);
  } else {
    requestAnimationFrame(gameLoop);
  }
}

function tickBattlePresentation() {
  if (isBattleResultFrozen()) return;
  const presentState = getDisplayBattleState();
  if (!isBattleUiPhase() || !presentState) return;
  const elapsed = battleStartTime ? (Date.now() - battleStartTime) / 1000 : 0;
  const ctx = { presentState, elapsed, phase };
  if (typeof PresentationClock !== "undefined" && PresentationClock.tick) {
    PresentationClock.tick(performance.now(), ctx);
    return;
  }
  const now = performance.now();
  if (!tickBattlePresentation._at) {
    tickBattlePresentation._at = { emotion: 0, arena: 0, orbit: 0, aura: 0, float: 0 };
  }
  const emotionGap = typeof BattleFxTier !== "undefined"
    ? BattleFxTier.emotionPresentGapMs()
    : 100;
  const arenaGap = typeof BattleFxTier !== "undefined"
    ? BattleFxTier.arenaPresentGapMs()
    : 450;
  const orbitGap = typeof BattleFxTier !== "undefined"
    ? BattleFxTier.stackOrbitGapMs()
    : 170;
  const auraGap = typeof BattleFxTier !== "undefined"
    ? BattleFxTier.auraPresentGapMs()
    : 180;

  if (now - tickBattlePresentation._at.emotion >= emotionGap) {
    tickBattlePresentation._at.emotion = now;
    if (typeof drawEmotionLayer === "function") {
      drawEmotionLayer(null, presentState, elapsed);
    }
  }
  if (now - tickBattlePresentation._at.arena >= arenaGap) {
    tickBattlePresentation._at.arena = now;
    if (typeof tickBattleArenaPresentation === "function") {
      tickBattleArenaPresentation(presentState, elapsed);
    }
  }
  if (now - tickBattlePresentation._at.orbit >= orbitGap) {
    tickBattlePresentation._at.orbit = now;
    const orbitEnabled = typeof BattleFxTier === "undefined"
      || (BattleFxTier.stackOrbitParticlesEnabled?.() ?? true);
    if (orbitEnabled && !presentState.finished && typeof syncStackOrbitFromBattle === "function") {
      syncStackOrbitFromBattle(presentState);
    }
  }
  if (now - tickBattlePresentation._at.aura >= auraGap) {
    tickBattlePresentation._at.aura = now;
    const auraOk = typeof BattleFxTier === "undefined"
      || (BattleFxTier.battleAuraFrameEnabled?.() ?? !BattleFxTier.isLightBattleFx());
    if (auraOk && typeof syncBattleAuraFrame === "function") {
      syncBattleAuraFrame(presentState, elapsed);
    }
  }
  const floatGap = typeof BattleFxTier !== "undefined" && BattleFxTier.battleFloatPresentGapMs
    ? BattleFxTier.battleFloatPresentGapMs()
    : 33;
  if (now - tickBattlePresentation._at.float >= floatGap) {
    tickBattlePresentation._at.float = now;
    if (shouldSkipFlankBattleCanvasDraw()) {
      tickFlankBattleDomOverlay(presentState);
    } else if (typeof renderBattleEffectsOverlay === "function") {
      renderBattleEffectsOverlay(presentState);
    }
  }
}

function tickSingleBattleState(state, dt) {
  const countdownDt = typeof getBattleCountdownDt === "function" ? getBattleCountdownDt(dt) : dt;
  if (countdownDt > 0 && typeof tickBattleCountdown === "function") {
    tickBattleCountdown(state, countdownDt);
  }
  const simDt = getBattleSimDt(dt);
  const countdownActive = typeof isBattleCountdownActive === "function" && isBattleCountdownActive(state);
  if (simDt > 0 && !countdownActive) {
    battleTick(state, simDt);
    recordBattleFrame(state);
  }
}

function tickLobbyRoundBattles(dt, ts) {
  if (!isAnyLobbyMode() || phase !== "battle" || !lobbyMatches.length) return false;

  let playerJustFinished = false;
  const bgInterval = 1 / (typeof getLobbyBackgroundSimHz === "function" ? getLobbyBackgroundSimHz() : 5);
  const simOpts = { spectateMatchId: lobbySpectateMatchId };

  const tickMatchStep = (match, stepDt) => {
    const matchIndex = lobbyMatches.indexOf(match);
    const isSpectated = matchIndex === lobbySpectateMatchId;
    if (match.isPlayerMatch) {
      if (!isLobby2pMode() && battleEndHandled) return;
      if (match.state?.finished) return;
      battleState = match.state;
      try {
        tickSingleBattleState(match.state, stepDt);
      } catch (err) {
        console.error("lobby player battleTick failed:", err);
      }
    } else {
      tickLobbyMatchState(match, stepDt, () => stepDt, lobbyState);
    }
    if (match.state?.finished) {
      match.finished = true;
      if (match.isPlayerMatch && isSpectated) playerJustFinished = true;
    }
  };

  lobbyMatches.forEach((match) => {
    if (match.byeFighterId || !match.state || match.state.finished) return;
    if (match.isPlayerMatch && battleEndHandled && !isLobby2pMode()) return;

    const fullSim = typeof isLobbyMatchFullySimulated === "function"
      ? isLobbyMatchFullySimulated(match, lobbyMatches.indexOf(match), simOpts)
      : lobbyMatches.indexOf(match) === lobbySpectateMatchId;

    if (fullSim) {
      lobbyBackgroundSimAcc.delete(match.id);
      tickMatchStep(match, dt);
      return;
    }

    let acc = (lobbyBackgroundSimAcc.get(match.id) || 0) + dt;
    if (acc >= bgInterval && match.state && !match.state.finished) {
      tickMatchStep(match, bgInterval);
      acc -= bgInterval;
    }
    lobbyBackgroundSimAcc.set(match.id, acc);
    if (match.state?.finished) {
      lobbyBackgroundSimAcc.delete(match.id);
    }
  });

  if (battleState && !battleEndHandled) {
    flushBattleEvents();
  }

  const lobbyHpTickMs = typeof BattleFxTier !== "undefined" && BattleFxTier.lobbyHpTickMs
    ? BattleFxTier.lobbyHpTickMs()
    : 500;
  const lobbyProfileTickMs = typeof BattleFxTier !== "undefined" && BattleFxTier.lobbyProfileTickMs
    ? BattleFxTier.lobbyProfileTickMs()
    : 1400;
  const lobbyAvatarTickMs = typeof BattleFxTier !== "undefined" && BattleFxTier.lobbyAvatarTickMs
    ? BattleFxTier.lobbyAvatarTickMs()
    : 1800;
  const lobbyChromeTickMs = typeof BattleFxTier !== "undefined" && BattleFxTier.lobbyChromeTickMs
    ? BattleFxTier.lobbyChromeTickMs()
    : 1200;

  if (Math.floor(ts / lobbyHpTickMs) !== Math.floor((ts - dt * 1000) / lobbyHpTickMs)) {
    if (lobbyState) {
      const rosterOpts = {
        phase: "battle",
        spectateMatchId: lobbySpectateMatchId,
        matches: lobbyMatches,
        round,
      };
      if (typeof syncLobbyFighterCardHp === "function") syncLobbyFighterCardHp(lobbyState, rosterOpts);
      if (typeof syncLobbyBattleBottomChipMetrics === "function") {
        syncLobbyBattleBottomChipMetrics(lobbyState, rosterOpts);
      }
    }
  }
  if (Math.floor(ts / lobbyProfileTickMs) !== Math.floor((ts - dt * 1000) / lobbyProfileTickMs)) {
    renderBattleStats();
    renderPlayerProfiles();
    if (typeof refreshBattleInventoryPopover === "function") refreshBattleInventoryPopover();
  }
  if (Math.floor(ts / lobbyAvatarTickMs) !== Math.floor((ts - dt * 1000) / lobbyAvatarTickMs)) {
    if (typeof syncLobbyFighterAvatars === "function" && lobbyState) {
      syncLobbyFighterAvatars(lobbyState, {
        phase: "battle",
        spectateMatchId: lobbySpectateMatchId,
        matches: lobbyMatches,
        round,
      });
    }
  }
  if (Math.floor(ts / lobbyChromeTickMs) !== Math.floor((ts - dt * 1000) / lobbyChromeTickMs)) {
    if (!tickLobbyRoundBattles._lastChromeAt || ts - tickLobbyRoundBattles._lastChromeAt >= lobbyChromeTickMs) {
      tickLobbyRoundBattles._lastChromeAt = ts;
      renderLobbyChrome();
    }
  }
  if (typeof syncBattleInventoryPopoverFlash === "function") syncBattleInventoryPopoverFlash();
  syncLiveBattleHud(getDisplayBattleState());
  tickBattlePresentation();

  if (playerJustFinished && !battleEndHandled) {
    endBattle();
  }
  return true;
}

function gameLoop(ts) {
  if (!gameLoop.last) gameLoop.last = ts;
  const dt = Math.min(0.05, (ts - gameLoop.last) / 1000);
  gameLoop.last = ts;
  lastGameLoopDt = dt;

  if (isGameLoopSuspended()) {
    scheduleGameLoop();
    return;
  }

  if (isBattleResultFrozen()) {
    tickGamepad(dt);
    scheduleGameLoop();
    return;
  }

  synergyAnimTime += dt;

  if (phase === "prep") {
    try {
    gameLoop._prepFxAcc = (gameLoop._prepFxAcc || 0) + dt;
    const prepFxHz = typeof BattleFxTier !== "undefined" && BattleFxTier.prepFxStepHz
      ? BattleFxTier.prepFxStepHz()
      : 30;
    const prepFxStep = 1 / prepFxHz;
    if (gameLoop._prepFxAcc >= prepFxStep) {
      const fxDt = gameLoop._prepFxAcc;
      gameLoop._prepFxAcc = 0;
      if (typeof tickInventoryAnimationController === "function") tickInventoryAnimationController(fxDt);
      if (typeof tickSynergyVisualController === "function") tickSynergyVisualController(fxDt);
    }
    if (isLobby2pMode()) tickLobby2pSideBattles(dt);
    if (isAnyLobbyMode() && lobbyState && typeof tickLobbyFighterThoughts === "function") {
      const thoughtsOk = typeof BattleFxTier === "undefined"
        || !BattleFxTier.prepLobbyFxReduced
        || !BattleFxTier.prepLobbyFxReduced();
      if (thoughtsOk) {
        const thoughtDirty = tickLobbyFighterThoughts(lobbyState, {
          phase: "prep",
          round,
          viewFighterId: isLobby2pMode() ? (prepViewSide === "player" ? 0 : 1) : lobbyViewFighterId,
          matches: lobbyMatches,
          timerRemaining: lobbyPrepTimerRemaining,
          timerActive: lobbyPrepTimerActive && !isLobby2pMode(),
        });
        if (thoughtDirty && typeof syncLobbyFighterAvatars === "function") {
          syncLobbyFighterAvatars(lobbyState, {
            phase: "prep",
            round,
            viewFighterId: isLobby2pMode() ? (prepViewSide === "player" ? 0 : 1) : lobbyViewFighterId,
            matches: lobbyMatches,
          });
        }
      }
    } else if (!isAnyLobbyMode() && typeof tickSoloPrepThoughts === "function") {
      const thoughtsOk = typeof BattleFxTier === "undefined"
        || !BattleFxTier.prepLobbyFxReduced
        || !BattleFxTier.prepLobbyFxReduced();
      if (thoughtsOk) tickSoloPrepThoughts();
    }
    const dialogueOk = typeof BattleFxTier === "undefined"
      || !BattleFxTier.prepLobbyFxReduced
      || !BattleFxTier.prepLobbyFxReduced();
    if (dialogueOk && isAnyLobbyMode() && lobbyState && typeof DialogueEngine !== "undefined") {
      const prepDurationSec = typeof LOBBY_PREP_SECONDS !== "undefined" ? LOBBY_PREP_SECONDS : 55;
      const dialogueCtx = {
        lobby: lobbyState,
        phase: "prep",
        round,
        matches: lobbyMatches,
        timerRemaining: isLobby2pMode() ? null : lobbyPrepTimerRemaining,
        timerActive: isLobby2pMode() ? false : lobbyPrepTimerActive,
        prepDurationSec,
      };
      if (DialogueEngine.shouldProcessTick(dialogueCtx)) {
        DialogueEngine.tick(dialogueCtx);
      }
    } else if (dialogueOk && !isAnyLobbyMode() && phase === "prep" && typeof DialogueEngine !== "undefined") {
      const soloCtx = { round, prepDurationSec: 60 };
      if (DialogueEngine.shouldProcessTick(soloCtx)) {
        DialogueEngine.tickSolo(soloCtx);
      }
    }
    if (isLobbyMode() && lobbyPrepTimerActive) {
      lobbyPrepTimerRemaining = Math.max(0, lobbyPrepTimerRemaining - dt);
      if (typeof PrepCountdown !== "undefined") {
        PrepCountdown.tickPrepTimerAudio(
          lobbyPrepTimerRemaining,
          true,
          `lobby:${round}`,
        );
        PrepCountdown.tryArmLobbyAutoCountdown(lobbyPrepTimerRemaining);
      }
      if (Math.floor(ts / 250) !== Math.floor((ts - dt * 1000) / 250)) {
        if (typeof syncLobbyPrepTimerChrome === "function") syncLobbyPrepTimerChrome();
        else renderLobbyChrome();
      }
      if (lobbyPrepTimerRemaining <= 0 && !(typeof PrepCountdown !== "undefined" && PrepCountdown.isActive())) {
        lobbyPrepTimerActive = false;
        if (canStartBattle()) {
          executeBattleStart();
        } else if (!lobbyPrepOvertimeUsed) {
          lobbyPrepOvertimeUsed = true;
          lobbyPrepTimerRemaining = LOBBY_PREP_OVERTIME_SEC;
          lobbyPrepTimerActive = true;
          if (typeof PrepCountdown !== "undefined") PrepCountdown.resetLobbyArming();
          playPrepSfx("ui_error");
          renderLobbyChrome();
        }
      }
    }
    if (phase === "prep" && typeof PrepCountdown !== "undefined" && PrepCountdown.isActive()) {
      PrepCountdown.tick(dt);
    }
    } catch (err) {
      console.error("prep gameLoop tick failed:", err);
    }
  }

  if (phase === "prep" && synergyState.isDragging && dragPayload) {
    const st = getSideState(prepViewSide);
    const otherItems = prepViewSide === "player" ? enemyItems : playerItems;
    synergyPreviewBuilt = refreshPreviewSynergies(
      st.containers,
      st.items,
      dragPayload,
      hoverSlot,
      dragFrom,
      otherItems,
    );
    canvas?.classList.toggle(
      "synergy-preview-mode",
      synergyState.previewSynergies.length > 0,
    );
  } else {
    synergyPreviewBuilt = null;
    canvas?.classList.remove("synergy-preview-mode");
    canvas?.classList.remove("amplify-preview-mode");
  }

  if (phase === "battle" && tickLobbyRoundBattles(dt, ts)) {
    // все пары лобби тикают параллельно
  } else if (phase === "battle" && battleState && !battleState.finished) {
    const countdownDt = typeof getBattleCountdownDt === "function" ? getBattleCountdownDt(dt) : dt;
    if (countdownDt > 0 && typeof tickBattleCountdown === "function") {
      tickBattleCountdown(battleState, countdownDt);
    }
    const simDt = getBattleSimDt(dt);
    const countdownActive = typeof isBattleCountdownActive === "function"
      && isBattleCountdownActive(battleState);
    if (simDt > 0 && !countdownActive) {
      try {
        battleTick(battleState, simDt);
      } catch (err) {
        console.error("battleTick failed:", err);
      }
      flushBattleEvents();
      recordBattleFrame(battleState);
    }
    const profileTickMs = battleProfileTickMs();
    if (Math.floor(ts / profileTickMs) !== Math.floor((ts - dt * 1000) / profileTickMs)) {
      syncLiveBattleProfiles(battleState);
    }
    if (typeof syncBattleInventoryPopoverFlash === "function") syncBattleInventoryPopoverFlash();
    syncLiveBattleHud(battleState);
    tickBattlePresentation();
  } else if (phase === "battle" && battleState?.finished && !isLobbyMode()) {
    if (typeof resetStackOrbitVfx === "function") resetStackOrbitVfx();
    clearBattleFloatLayer();
    endBattle();
  } else if (phase === "replay") {
    tickReplay(dt);
    if (Math.floor(ts / battleProfileTickMs()) !== Math.floor((ts - dt * 1000) / battleProfileTickMs())) {
      syncLiveBattleProfiles(getDisplayBattleState());
    }
    if (typeof syncBattleInventoryPopoverFlash === "function") syncBattleInventoryPopoverFlash();
    syncLiveBattleHud(getDisplayBattleState());
    tickBattlePresentation();
  }
  if (phase === "prep") {
    tickDisplaceAnimations(dt);
    tickGamepad(dt);
  } else {
    tickGamepad(dt);
  }
  if (phase === "prep" && !dragPayload && !isTouchUi() && !isPointerOverPrepSidebar(lastPointerClient.x, lastPointerClient.y) && !isPointerOverCombatFeed(lastPointerClient.x, lastPointerClient.y)) {
    if (prepTooltipsEnabled) {
      try { updateTooltip(mousePos.x, mousePos.y); } catch (err) { console.error("updateTooltip failed:", err); }
    }
  } else if ((phase === "battle" || phase === "replay") && battleState && !dragPayload && !isTouchUi()) {
    // tooltips off during live battle — меньше hit-test / layout
  }
  try {
    const needsSmoothDraw = !!dragPayload || synergyState.isDragging;
    const throttleBattleDraw = shouldThrottleBattleCanvasDraw() && !needsSmoothDraw;
    if ((phase === "prep" && !needsSmoothDraw) || throttleBattleDraw) {
      const accKey = throttleBattleDraw ? "_battleDrawAcc" : "_drawAcc";
      const fps = throttleBattleDraw ? battleCanvasDrawFps() : 30;
      gameLoop[accKey] = (gameLoop[accKey] || 0) + dt;
      if (gameLoop[accKey] < 1 / fps) {
        // skip canvas redraw this frame
      } else {
        gameLoop[accKey] = 0;
        draw();
      }
    } else {
      draw();
    }
  } catch (err) {
    console.error("draw failed:", err);
  }
  scheduleGameLoop();
}
