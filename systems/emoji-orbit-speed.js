/**
 * Скорость орбиты эмодзи-стаков вокруг героя в бою (localStorage: bb-emoji-orbit-speed).
 */
(function initEmojiOrbitSpeedModule() {
  const STORAGE_KEY = "bb-emoji-orbit-speed";

  const PRESETS = {
    slow: { label: "Медленно", durationSec: 7 },
    normal: { label: "Средне", durationSec: 4.5 },
    fast: { label: "Быстро", durationSec: 2.8 },
  };

  const CUSTOM_MIN_SEC = 2.5;
  const CUSTOM_MAX_SEC = 14;
  const STAGGER_SEC = 0.18;

  function clampDuration(sec) {
    return Math.min(CUSTOM_MAX_SEC, Math.max(CUSTOM_MIN_SEC, +sec || PRESETS.slow.durationSec));
  }

  function readStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function writeStored(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) { /* ignore */ }
  }

  function resolveState() {
    const stored = readStored();
    const preset = PRESETS[stored?.preset] ? stored.preset : "slow";
    const durationSec = stored?.preset === "custom"
      ? clampDuration(stored.durationSec)
      : PRESETS[preset].durationSec;
    return { preset, durationSec: clampDuration(durationSec) };
  }

  let state = resolveState();

  function getEmojiOrbitPreset() {
    return state.preset;
  }

  function getEmojiOrbitDurationSec() {
    return state.durationSec;
  }

  function getEmojiOrbitParticleDurationSec(particleIndex = 0) {
    const base = state.durationSec;
    return base + (particleIndex % 3) * STAGGER_SEC;
  }

  function applyEmojiOrbitSpeed() {
    document.documentElement.style.setProperty("--emoji-orbit-base-duration", `${state.durationSec}s`);
    document.querySelectorAll(".avatar-stack-orbit-particle").forEach((span, i) => {
      span.style.animationDuration = `${getEmojiOrbitParticleDurationSec(i)}s`;
    });
    if (typeof syncStackOrbitFromBattle === "function") {
      document.querySelectorAll(".avatar-stack-orbit-ring").forEach((ring) => {
        delete ring.dataset.orbitSig;
        delete ring.dataset.orbitSizeKey;
      });
    }
  }

  function persistState() {
    writeStored({
      preset: state.preset,
      durationSec: state.durationSec,
    });
    applyEmojiOrbitSpeed();
    syncEmojiOrbitSpeedSettingsUi();
  }

  function setEmojiOrbitPreset(presetId) {
    if (!PRESETS[presetId]) return;
    state.preset = presetId;
    state.durationSec = PRESETS[presetId].durationSec;
    persistState();
  }

  function setEmojiOrbitCustomDuration(durationSec) {
    state.preset = "custom";
    state.durationSec = clampDuration(durationSec);
    persistState();
  }

  function formatDurationLabel(sec) {
    return `${sec.toFixed(1).replace(".0", "")} сек`;
  }

  function syncEmojiOrbitSpeedSettingsUi() {
    const valueEl = document.getElementById("settings-emoji-orbit-duration-value");
    const slider = document.getElementById("settings-emoji-orbit-duration");
    if (valueEl) valueEl.textContent = formatDurationLabel(state.durationSec);
    if (slider) slider.value = String(state.durationSec);

    document.querySelectorAll('input[name="emoji-orbit-preset"]').forEach((input) => {
      const checked = state.preset !== "custom" && input.value === state.preset;
      input.checked = checked;
      input.closest(".settings-orbit-preset")?.classList.toggle("is-selected", checked);
    });
  }

  function initEmojiOrbitSpeed() {
    state = resolveState();
    applyEmojiOrbitSpeed();
  }

  function initEmojiOrbitSpeedControls() {
    initEmojiOrbitSpeed();

    document.querySelectorAll('input[name="emoji-orbit-preset"]').forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        setEmojiOrbitPreset(input.value);
      });
    });

    const slider = document.getElementById("settings-emoji-orbit-duration");
    slider?.addEventListener("input", (e) => {
      setEmojiOrbitCustomDuration(+e.target.value);
    });
  }

  window.EmojiOrbitSpeed = {
    PRESETS,
    CUSTOM_MIN_SEC,
    CUSTOM_MAX_SEC,
    getEmojiOrbitPreset,
    getEmojiOrbitDurationSec,
    getEmojiOrbitParticleDurationSec,
    setEmojiOrbitPreset,
    setEmojiOrbitCustomDuration,
    applyEmojiOrbitSpeed,
    syncEmojiOrbitSpeedSettingsUi,
  };

  window.getEmojiOrbitParticleDurationSec = getEmojiOrbitParticleDurationSec;
  window.getEmojiOrbitDurationSec = getEmojiOrbitDurationSec;
  window.initEmojiOrbitSpeed = initEmojiOrbitSpeed;
  window.initEmojiOrbitSpeedControls = initEmojiOrbitSpeedControls;
  window.syncEmojiOrbitSpeedSettingsUi = syncEmojiOrbitSpeedSettingsUi;
})();
