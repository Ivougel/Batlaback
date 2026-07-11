// Transpiled from TypeScript — npm run compile:ts

(function initPresentationClock() {
  const channels = /* @__PURE__ */ new Map();
  let centralizedBattle = true;
  function isPaused() {
    if (typeof isGameLoopSuspended === "function" && isGameLoopSuspended()) return true;
    if (typeof isBattleResultFrozen === "function" && isBattleResultFrozen()) return true;
    if (typeof isBattleResultIdle === "function" && isBattleResultIdle()) return true;
    if (document.body?.classList.contains("screen-transitioning")) return true;
    if (typeof ScreenTransitions !== "undefined" && ScreenTransitions.isScreenTransitioning?.()) {
      return true;
    }
    const layout = document.querySelector(".game-layout");
    if (layout?.classList.contains("phase-transitioning")) return true;
    return false;
  }
  function isBattleCentralized() {
    if (!centralizedBattle) return false;
    const phase = document.getElementById("app")?.dataset?.phase;
    return phase === "battle" || phase === "replay";
  }
  function registerChannel(id, spec) {
    channels.set(id, {
      id,
      gapMs: spec.gapMs,
      tick: spec.tick,
      enabled: spec.enabled ?? (() => true),
      lastAt: 0,
      wake: false
    });
  }
  function unregisterChannel(id) {
    channels.delete(id);
  }
  function wake(id) {
    const ch = channels.get(id);
    if (!ch) return;
    const now = performance.now();
    const gap = typeof ch.gapMs === "function" ? ch.gapMs({}) : ch.gapMs;
    if (gap <= 0) {
      ch.wake = true;
      return;
    }
    if (now - ch.lastAt < gap * 0.85) {
      ch.lastAt = now - gap;
    }
  }
  function shouldOwnLoop(id) {
    return isBattleCentralized() && !isPaused() && channels.has(id);
  }
  function tick(now, ctx = {}) {
    if (isPaused()) return;
    for (const ch of channels.values()) {
      if (!ch.enabled(ctx)) {
        ch.wake = false;
        continue;
      }
      const gap = typeof ch.gapMs === "function" ? ch.gapMs(ctx) : ch.gapMs;
      const due = gap <= 0 || now - ch.lastAt >= gap;
      if (!due) continue;
      ch.lastAt = now;
      ch.wake = false;
      try {
        ch.tick(now, ctx);
      } catch (err) {
        console.error(`PresentationClock[${ch.id}] tick failed:`, err);
      }
    }
  }
  function registerBattleChannels() {
    registerChannel("emotion", {
      gapMs: () => typeof BattleFxTier !== "undefined" ? BattleFxTier.emotionPresentGapMs() : 100,
      enabled: (ctx) => !!ctx.presentState && (ctx.phase === "battle" || ctx.phase === "replay"),
      tick: (_now, ctx) => {
        if (typeof drawEmotionLayer !== "function") return;
        drawEmotionLayer(null, ctx.presentState, ctx.elapsed ?? 0);
      }
    });
    registerChannel("arena-sync", {
      gapMs: () => typeof BattleFxTier !== "undefined" ? BattleFxTier.arenaPresentGapMs() : 450,
      enabled: (ctx) => !!ctx.presentState && (ctx.phase === "battle" || ctx.phase === "replay"),
      tick: (_now, ctx) => {
        if (typeof tickBattleArenaPresentation === "function") {
          tickBattleArenaPresentation(ctx.presentState, ctx.elapsed ?? 0);
        }
      }
    });
    registerChannel("arena-equip", {
      gapMs: () => {
        if (typeof ArenaEquipment === "undefined") return 32;
        if (typeof BattleFxTier !== "undefined") return BattleFxTier.arenaPhysicsGapMs();
        return 32;
      },
      enabled: (ctx) => {
        if (!ctx.presentState || ctx.presentState.finished) return false;
        return ctx.phase === "battle" || ctx.phase === "replay";
      },
      tick: (now) => {
        if (typeof ArenaEquipment === "undefined" || !ArenaEquipment.tickPhysicsFromClock) return;
        const keepGoing = ArenaEquipment.tickPhysicsFromClock(now);
        if (keepGoing) wake("arena-equip");
      }
    });
    registerChannel("thought", {
      gapMs: () => typeof BattleFxTier !== "undefined" ? BattleFxTier.thoughtStepGapMs() : 0,
      enabled: (ctx) => {
        if (!ctx.presentState || ctx.presentState.finished) return false;
        return ctx.phase === "battle" || ctx.phase === "replay";
      },
      tick: (now) => {
        if (typeof ThoughtArena === "undefined" || !ThoughtArena.tickFromClock) return;
        const keepGoing = ThoughtArena.tickFromClock(now);
        if (keepGoing) wake("thought");
      }
    });
    registerChannel("orbit", {
      gapMs: () => typeof BattleFxTier !== "undefined" ? BattleFxTier.stackOrbitGapMs() : 170,
      enabled: (ctx) => {
        if (!ctx.presentState || ctx.presentState.finished) return false;
        const orbitEnabled = typeof BattleFxTier === "undefined" || (BattleFxTier.stackOrbitParticlesEnabled?.() ?? true);
        return orbitEnabled && (ctx.phase === "battle" || ctx.phase === "replay");
      },
      tick: (_now, ctx) => {
        if (typeof syncStackOrbitFromBattle === "function") {
          syncStackOrbitFromBattle(ctx.presentState);
        }
      }
    });
    registerChannel("aura", {
      gapMs: () => typeof BattleFxTier !== "undefined" ? BattleFxTier.auraPresentGapMs() : 180,
      enabled: (ctx) => {
        if (!ctx.presentState) return false;
        const auraOk = typeof BattleFxTier === "undefined" || (BattleFxTier.battleAuraFrameEnabled?.() ?? !BattleFxTier.isLightBattleFx());
        return auraOk && (ctx.phase === "battle" || ctx.phase === "replay");
      },
      tick: (_now, ctx) => {
        if (typeof syncBattleAuraFrame === "function") {
          syncBattleAuraFrame(ctx.presentState, ctx.elapsed ?? 0);
        }
      }
    });
    registerChannel("float", {
      gapMs: () => typeof BattleFxTier !== "undefined" && BattleFxTier.battleFloatPresentGapMs ? BattleFxTier.battleFloatPresentGapMs() : 33,
      enabled: (ctx) => !!ctx.presentState && (ctx.phase === "battle" || ctx.phase === "replay"),
      tick: (_now, ctx) => {
        if (typeof shouldSkipFlankBattleCanvasDraw === "function" && shouldSkipFlankBattleCanvasDraw()) {
          if (typeof tickFlankBattleDomOverlay === "function") tickFlankBattleDomOverlay(ctx.presentState);
        } else if (typeof renderBattleEffectsOverlay === "function") {
          renderBattleEffectsOverlay(ctx.presentState);
        }
      }
    });
  }
  registerBattleChannels();
  window.PresentationClock = {
    registerChannel,
    unregisterChannel,
    wake,
    shouldOwnLoop,
    isPaused,
    isBattleCentralized,
    tick,
    setCentralizedBattle(v) {
      centralizedBattle = !!v;
    }
  };
})();
