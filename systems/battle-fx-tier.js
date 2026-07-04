(function initBattleFxTier() {
  const STORAGE_KEY = "bb-light-battle-fx";

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

  function isLightBattleFx() {
    if (prefersReducedMotion()) return true;
    const stored = readStoredLightFx();
    if (stored !== null) return stored;
    return true;
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

  function applyBattleFxTierFlags() {
    const light = isLightBattleFx();
    document.documentElement.dataset.battleFxLight = light ? "true" : "false";
    if (isPhoneTier()) {
      document.documentElement.dataset.battleFxPhone = "true";
    } else {
      document.documentElement.removeAttribute("data-battle-fx-phone");
    }
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
    if (isFlankBattleThoughtFxActive()) return false;
    return !isLightBattleFx();
  }

  function equipSyncGapMs() {
    if (isFlankBattleThoughtFxActive()) return isPhoneTier() ? 700 : 650;
    if (!isLightBattleFx()) return 450;
    return isPhoneTier() ? 550 : 650;
  }

  function emotionPresentGapMs() {
    if (isFlankBattleThoughtFxActive()) return isPhoneTier() ? 280 : 240;
    if (!isLightBattleFx()) return 66;
    return isPhoneTier() ? 120 : 100;
  }

  function arenaPresentGapMs() {
    if (isFlankBattleThoughtFxActive()) return 720;
    return isLightBattleFx() ? 500 : 450;
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
    isLightBattleFx,
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
    applyBattleFxTierFlags,
    syncLightBattleFxSettingsUi,
  };

  window.initLightBattleFxControls = initLightBattleFxControls;
  window.syncLightBattleFxSettingsUi = syncLightBattleFxSettingsUi;
})();
