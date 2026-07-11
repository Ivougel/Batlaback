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

/** Touch phone/tablet/PWA: prep throttled (including during drag). */
function shouldThrottlePrepGameLoop() {
  if (phase !== "prep") return false;
  return typeof BattleFxTier !== "undefined" && BattleFxTier.shouldThrottleGameLoop?.();
}

/** Touch phone/tablet: бой — setTimeout только на low tier; medium/tablet → rAF. */
function shouldThrottleBattleGameLoop() {
  if (!isBattleUiPhase()) return false;
  if (typeof BattleFxTier !== "undefined" && BattleFxTier.shouldThrottleBattleGameLoop) {
    return BattleFxTier.shouldThrottleBattleGameLoop();
  }
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
  if (typeof shouldUseBBStackBattleLayout === "function" && shouldUseBBStackBattleLayout()) {
    const now = performance.now();
    const gap = typeof BattleFxTier !== "undefined" && BattleFxTier.battleHudLiteGapMs
      ? BattleFxTier.battleHudLiteGapMs()
      : 120;
    if (now - (syncLiveBattleHud._at || 0) < gap) return;
    syncLiveBattleHud._at = now;
    if (typeof syncBBBattleHud === "function") syncBBBattleHud(viewState);
    return;
  }
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
    const gap = typeof BattleFxTier !== "undefined" && BattleFxTier.prepGameLoopGapMs
      ? BattleFxTier.prepGameLoopGapMs()
      : 33;
    setTimeout(() => gameLoop(performance.now()), gap);
  } else {
    requestAnimationFrame(gameLoop);
  }
}

function tickBattlePresentation() {
  if (isBattleResultFrozen()) return;
  const presentState = getDisplayBattleState();
  if (typeof shouldUseBBStackBattleLayout === "function" && shouldUseBBStackBattleLayout()) {
    if (isBattleUiPhase() && presentState && typeof renderBattleEffectsOverlay === "function") {
      renderBattleEffectsOverlay(presentState);
    }
    return;
  }
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
      if (typeof tickSoloPrepThoughts === "function") {
        const thoughtsOk = typeof BattleFxTier === "undefined"
          || !BattleFxTier.prepFxReduced
          || !BattleFxTier.prepFxReduced();
        if (thoughtsOk) tickSoloPrepThoughts();
      }
      const dialogueOk = typeof BattleFxTier === "undefined"
        || !BattleFxTier.prepFxReduced
        || !BattleFxTier.prepFxReduced();
      if (dialogueOk && typeof DialogueEngine !== "undefined") {
        const soloCtx = { round, prepDurationSec: 60 };
        if (DialogueEngine.shouldProcessTick(soloCtx)) {
          DialogueEngine.tickSolo(soloCtx);
        }
      }
      if (typeof PrepCountdown !== "undefined" && PrepCountdown.isActive()) {
        PrepCountdown.tick(dt);
      }
    } catch (err) {
      console.error("prep gameLoop tick failed:", err);
    }
  }

  if (phase === "prep" && synergyState.isDragging && dragPayload) {
    const hoverKey = [
      hoverSlot?.col ?? "",
      hoverSlot?.row ?? "",
      hoverCell?.col ?? "",
      hoverCell?.row ?? "",
      dragPayload.rotation ?? 0,
    ].join(",");
    if (hoverKey !== gameLoop._synergyHoverKey) {
      gameLoop._synergyHoverKey = hoverKey;
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
    }
    canvas?.classList.toggle(
      "synergy-preview-mode",
      synergyState.previewSynergies.length > 0,
    );
  } else {
    gameLoop._synergyHoverKey = null;
    synergyPreviewBuilt = null;
    canvas?.classList.remove("synergy-preview-mode");
    canvas?.classList.remove("amplify-preview-mode");
  }

  if (phase === "battle" && battleState && !battleState.finished) {
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
  } else if (phase === "battle" && battleState?.finished) {
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
    if (typeof tickCraftMergeAnimations === "function") tickCraftMergeAnimations(dt);
    if (typeof PrepStoragePhysics !== "undefined") PrepStoragePhysics.tick(dt);
    tickGamepad(dt);
  } else {
    tickGamepad(dt);
  }
  if ((phase === "battle" || phase === "replay") && battleState && !dragPayload && !isTouchUi()) {
    // tooltips off during live battle — меньше hit-test / layout
  }
  try {
    const needsSmoothDraw = !!dragPayload || synergyState.isDragging;
    const throttleBattleDraw = shouldThrottleBattleCanvasDraw() && !needsSmoothDraw;
    const throttlePrepDraw = phase === "prep" && (
      !needsSmoothDraw
      || (typeof BattleFxTier !== "undefined" && BattleFxTier.shouldThrottleGameLoop?.())
    );
    if (throttlePrepDraw || throttleBattleDraw) {
      const accKey = throttleBattleDraw ? "_battleDrawAcc" : "_drawAcc";
      let fps = 30;
      if (throttleBattleDraw) {
        fps = battleCanvasDrawFps();
      } else if (needsSmoothDraw && typeof BattleFxTier !== "undefined" && BattleFxTier.prepDragDrawFps) {
        fps = BattleFxTier.prepDragDrawFps();
      } else if (typeof BattleFxTier !== "undefined" && BattleFxTier.prepIdleDrawFps) {
        fps = BattleFxTier.prepIdleDrawFps();
      }
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
