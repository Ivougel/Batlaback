(function initBattleFxTier() {
  const STORAGE_KEY = "bb-light-battle-fx";

  let cachedPerfTier = null;
  let cachedPerfTierAt = 0;
  const PERF_TIER_CACHE_MS = 2000;

  function prefersReducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  }

  function readStoredLightFx() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  }

  function isAutoLightTier() {
    const tier = document.documentElement?.dataset?.uiTier;
    return tier === "phone" || tier === "tablet";
  }

  function isTouchUiDevice() {
    return document.documentElement?.dataset?.touch === "true";
  }

  /**
   * Авто-уровень производительности по экрану и устройству.
   * low — слабое / save-data / reduced-motion
   * medium — touch phone/tablet, компактный desktop
   * high — desktop с запасом
   */
  function resolvePerfTier(force = false) {
    const now = performance.now();
    if (!force && cachedPerfTier && now - cachedPerfTierAt < PERF_TIER_CACHE_MS) {
      return cachedPerfTier;
    }

    if (prefersReducedMotion()) {
      cachedPerfTier = "low";
      cachedPerfTierAt = now;
      return cachedPerfTier;
    }

    if (navigator.connection?.saveData) {
      cachedPerfTier = "low";
      cachedPerfTierAt = now;
      return cachedPerfTier;
    }

    const uiTier = document.documentElement?.dataset?.uiTier || "desktop";
    const touch = isTouchUiDevice();
    const dpr = window.devicePixelRatio || 1;
    const cores = navigator.hardwareConcurrency || 8;

    let score = 0;
    if (uiTier === "phone") score += 3;
    else if (uiTier === "tablet") score += 2;
    if (touch) score += 1;
    if (dpr >= 2) score += 1;
    if (cores <= 4) score += 2;
    else if (cores <= 6) score += 1;

    if (score >= 5 || cores <= 2) cachedPerfTier = "low";
    else if (score >= 2) cachedPerfTier = "medium";
    else cachedPerfTier = "high";

    cachedPerfTierAt = now;
    return cachedPerfTier;
  }

  function isPerfTierAtMost(maxTier) {
    const order = { low: 0, medium: 1, high: 2 };
    const cur = resolvePerfTier();
    return (order[cur] ?? 1) <= (order[maxTier] ?? 1);
  }

  /** Touch / medium+low tier — throttle sim presentation и canvas. */
  function isPerfConstrainedDevice() {
    if (prefersReducedMotion()) return true;
    const perf = resolvePerfTier();
    if (perf === "low") return true;
    if (perf === "medium" && isTouchUiDevice()) return true;
    return false;
  }

  function isLightBattleFx() {
    if (prefersReducedMotion()) return true;
    const stored = readStoredLightFx();
    if (stored !== null) return stored;
    const perf = resolvePerfTier();
    if (perf === "low") return true;
    if (perf === "medium") return true;
    return isAutoLightTier();
  }

  function shouldThrottleGameLoop() {
    return isPerfConstrainedDevice();
  }

  function isPhoneTier() {
    return document.documentElement?.dataset?.uiTier === "phone";
  }

  /** Flank battle: мысль + орбита — полный rAF-шаг физики. */
  function isFlankBattleThoughtFxActive() {
    const app = document.getElementById("app");
    const phase = app?.dataset?.phase;
    if (phase !== "battle" && phase !== "replay") return false;
    const root = document.documentElement;
    if (root.dataset.battleHeroPlacement !== "flank-arena") return false;
    if (root.dataset.battleArenaLayout === "true") return true;
    return root.dataset.battlePrepHeroLayer === "true";
  }

  function setLightBattleFx(enabled) {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    applyBattleFxTierFlags();
  }

  function prepLobbyFxReduced() {
    return isLightBattleFx();
  }

  function equipAutoAttackEnabled() {
    return !prefersReducedMotion();
  }

  function battleGameLoopGapMs() {
    if (!shouldThrottleGameLoop()) return 0;
    const perf = resolvePerfTier();
    if (perf === "low") return isPhoneTier() ? 50 : 66;
    return isPhoneTier() ? 33 : 50;
  }

  function battleHudLiteGapMs() {
    if (!isLightBattleFx()) return 120;
    return isPhoneTier() ? 200 : 280;
  }

  function battleFloatPresentGapMs() {
    if (!isLightBattleFx()) return 16;
    return isPhoneTier() ? 33 : 24;
  }

  function battleProfileTickMs() {
    if (!isLightBattleFx()) return 500;
    return isPhoneTier() ? 800 : 1000;
  }

  function prepFxStepHz() {
    const perf = resolvePerfTier();
    if (perf === "low") return 20;
    if (isLightBattleFx()) return 24;
    return 30;
  }

  function lobbyHpTickMs() {
    if (!isLightBattleFx()) return 500;
    return isPhoneTier() ? 700 : 650;
  }

  function lobbyProfileTickMs() {
    if (!isLightBattleFx()) return 1400;
    return isPhoneTier() ? 2000 : 1800;
  }

  function lobbyAvatarTickMs() {
    if (!isLightBattleFx()) return 1800;
    return isPhoneTier() ? 2400 : 2200;
  }

  function lobbyChromeTickMs() {
    if (!isLightBattleFx()) return 1200;
    return isPhoneTier() ? 1600 : 1500;
  }

  function lobbyEmotionRefreshMs() {
    if (!isLightBattleFx()) return 2800;
    return isPhoneTier() ? 4000 : 3600;
  }

  function applyBattleFxTierFlags() {
    const light = isLightBattleFx();
    const perf = resolvePerfTier(true);
    const root = document.documentElement;
    root.dataset.battleFxLight = light ? "true" : "false";
    root.dataset.perfTier = perf;
    if (isStaticBattleThoughts()) root.dataset.battleThoughtsStatic = "true";
    else root.removeAttribute("data-battle-thoughts-static");
    if (isPhoneTier()) {
      root.dataset.battleFxPhone = "true";
    } else {
      root.removeAttribute("data-battle-fx-phone");
    }
  }

  /** Статичные мысли только при prefers-reduced-motion. */
  function isStaticBattleThoughts() {
    return prefersReducedMotion();
  }

  function equipThoughtReactionsEnabled() {
    return !prefersReducedMotion();
  }

  function battleEmotionReactive() {
    return !isLightBattleFx();
  }

  function emotionAnalyzeGapMs() {
    if (!battleEmotionReactive()) return 2400;
    if (isFlankBattleThoughtFxActive() && isLightBattleFx()) return 1800;
    if (isLightBattleFx()) return 1200;
    return 500;
  }

  /** ~12–14 FPS cap для орбиты/мыслей во flank-бою (0 = лаги на планшете). */
  function flankFxStepGapMs() {
    if (prefersReducedMotion()) return 96;
    return isPhoneTier() ? 80 : 72;
  }

  function arenaPhysicsGapMs() {
    if (isFlankBattleThoughtFxActive()) return flankFxStepGapMs();
    if (!isLightBattleFx()) return isPhoneTier() ? 40 : 32;
    return isPhoneTier() ? 50 : 50;
  }

  function thoughtStepGapMs() {
    if (isFlankBattleThoughtFxActive()) return flankFxStepGapMs();
    if (!isLightBattleFx()) return isPhoneTier() ? 40 : 32;
    return isPhoneTier() ? 50 : 50;
  }

  function equipIdleWobbleEnabled() {
    return !prefersReducedMotion();
  }

  function equipSyncGapMs() {
    if (isFlankBattleThoughtFxActive()) return isPhoneTier() ? 700 : 650;
    if (!isLightBattleFx()) return 450;
    return isPhoneTier() ? 550 : 650;
  }

  function emotionPresentGapMs() {
    if (isFlankBattleThoughtFxActive()) return isPhoneTier() ? 500 : 450;
    if (!isLightBattleFx()) return 66;
    return isPhoneTier() ? 160 : 140;
  }

  function arenaPresentGapMs() {
    if (isFlankBattleThoughtFxActive()) return isLightBattleFx() ? 1200 : 720;
    return isLightBattleFx() ? 650 : 450;
  }

  function stackOrbitGapMs() {
    if (isFlankBattleThoughtFxActive()) return isPhoneTier() ? 220 : 180;
    if (!isLightBattleFx()) return 70;
    return isPhoneTier() ? 220 : 280;
  }

  function auraPresentGapMs() {
    if (!isLightBattleFx()) return 50;
    return isPhoneTier() ? 220 : 180;
  }

  function stackOrbitParticlesEnabled() {
    if (prefersReducedMotion()) return false;
    if (isLightBattleFx()) return false;
    return true;
  }

  function auraRunnersEnabled() {
    return !isLightBattleFx();
  }

  function battleAuraFrameEnabled() {
    return !isLightBattleFx();
  }

  function prepHudMoodIntervalMs() {
    if (prefersReducedMotion()) return 0;
    if (!isLightBattleFx()) return 7200;
    const perf = resolvePerfTier();
    if (perf === "low") return 12000;
    return isPhoneTier() ? 10000 : 9000;
  }

  function prepHudMoodCycleEnabled() {
    if (prefersReducedMotion()) return false;
    if (resolvePerfTier() === "low") return false;
    return true;
  }

  function prepSynergyFxEnabled() {
    return !prepLobbyFxReduced();
  }

  function syncLightBattleFxSettingsUi() {
    const cb = document.getElementById("settings-light-battle-fx");
    if (cb) cb.checked = isLightBattleFx();
  }

  function initLightBattleFxControls() {
    applyBattleFxTierFlags();
    const cb = document.getElementById("settings-light-battle-fx");
    cb?.addEventListener("change", (e) => {
      setLightBattleFx(e.target.checked);
      syncLightBattleFxSettingsUi();
    });
  }

  window.BattleFxTier = {
    resolvePerfTier,
    isPerfTierAtMost,
    isLightBattleFx,
    isPerfConstrainedDevice,
    shouldThrottleGameLoop,
    isTouchUiDevice,
    isStaticBattleThoughts,
    equipThoughtReactionsEnabled,
    battleEmotionReactive,
    emotionAnalyzeGapMs,
    thoughtStepGapMs,
    arenaPhysicsGapMs,
    emotionPresentGapMs,
    arenaPresentGapMs,
    stackOrbitGapMs,
    stackOrbitParticlesEnabled,
    auraPresentGapMs,
    auraRunnersEnabled,
    battleAuraFrameEnabled,
    equipIdleWobbleEnabled,
    equipSyncGapMs,
    prepLobbyFxReduced,
    equipAutoAttackEnabled,
    battleGameLoopGapMs,
    battleHudLiteGapMs,
    battleProfileTickMs,
    battleFloatPresentGapMs,
    prepFxStepHz,
    lobbyHpTickMs,
    lobbyProfileTickMs,
    lobbyAvatarTickMs,
    lobbyChromeTickMs,
    lobbyEmotionRefreshMs,
    prepHudMoodIntervalMs,
    prepHudMoodCycleEnabled,
    prepSynergyFxEnabled,
    applyBattleFxTierFlags,
    syncLightBattleFxSettingsUi,
  };

  window.initLightBattleFxControls = initLightBattleFxControls;
  window.syncLightBattleFxSettingsUi = syncLightBattleFxSettingsUi;
})();
