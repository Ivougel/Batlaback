/**
 * Уровень боевых FX: auto по tier, prefers-reduced-motion, настройка в settings.
 */
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
    return isAutoLightTier();
  }

  function isPhoneTier() {
    return document.documentElement?.dataset?.uiTier === "phone";
  }

  /** Flank battle: мысль + орбита — не душим в light FX. */
  function isFlankBattleThoughtFxActive() {
    const app = document.getElementById("app");
    const phase = app?.dataset?.phase;
    if (phase !== "battle" && phase !== "replay") return false;
    return document.documentElement?.dataset?.battleArenaLayout === "true";
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

  function arenaPhysicsGapMs() {
    if (isFlankBattleThoughtFxActive()) return 0;
    if (!isLightBattleFx()) return 0;
    return isPhoneTier() ? 50 : 50;
  }

  function thoughtStepGapMs() {
    if (isFlankBattleThoughtFxActive()) return 0;
    if (!isLightBattleFx()) return 0;
    return isPhoneTier() ? 50 : 50;
  }

  function equipIdleWobbleEnabled() {
    if (isFlankBattleThoughtFxActive()) return true;
    return !isLightBattleFx();
  }

  function equipSyncGapMs() {
    if (isFlankBattleThoughtFxActive()) return 450;
    if (!isLightBattleFx()) return 450;
    return isPhoneTier() ? 550 : 650;
  }

  function emotionPresentGapMs() {
    if (isFlankBattleThoughtFxActive()) return 66;
    if (!isLightBattleFx()) return 66;
    return isPhoneTier() ? 120 : 100;
  }

  function arenaPresentGapMs() {
    if (isFlankBattleThoughtFxActive()) return 450;
    return isLightBattleFx() ? 500 : 450;
  }

  function stackOrbitGapMs() {
    if (isFlankBattleThoughtFxActive()) return 70;
    if (!isLightBattleFx()) return 70;
    return isPhoneTier() ? 220 : 280;
  }

  function auraPresentGapMs() {
    if (!isLightBattleFx()) return 50;
    return isPhoneTier() ? 220 : 180;
  }

  function auraRunnersEnabled() {
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
    auraPresentGapMs,
    auraRunnersEnabled,
    equipIdleWobbleEnabled,
    equipSyncGapMs,
    applyBattleFxTierFlags,
    syncLightBattleFxSettingsUi,
  };

  window.initLightBattleFxControls = initLightBattleFxControls;
  window.syncLightBattleFxSettingsUi = syncLightBattleFxSettingsUi;
})();
