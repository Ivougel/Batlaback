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

  function thoughtStepGapMs() {
    if (!isLightBattleFx()) return 0;
    return isPhoneTier() ? 50 : 33;
  }

  function arenaPhysicsGapMs() {
    if (!isLightBattleFx()) return 0;
    return isPhoneTier() ? 50 : 33;
  }

  function emotionPresentGapMs() {
    if (!isLightBattleFx()) return 66;
    return isPhoneTier() ? 120 : 100;
  }

  function arenaPresentGapMs() {
    return isLightBattleFx() ? 500 : 450;
  }

  function stackOrbitGapMs() {
    if (!isLightBattleFx()) return 70;
    return isPhoneTier() ? 200 : 170;
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
    applyBattleFxTierFlags,
    syncLightBattleFxSettingsUi,
  };

  window.initLightBattleFxControls = initLightBattleFxControls;
  window.syncLightBattleFxSettingsUi = syncLightBattleFxSettingsUi;
})();
