// Transpiled from TypeScript — npm run compile:ts

(function initEmojiOrbitSpeedModule() {
  const STORAGE_KEY = "bb-emoji-orbit-speed";
  const PRESETS = {
    slow: { label: "\u041C\u0435\u0434\u043B\u0435\u043D\u043D\u043E", durationSec: 7 },
    normal: { label: "\u0421\u0440\u0435\u0434\u043D\u0435", durationSec: 4.5 },
    fast: { label: "\u0411\u044B\u0441\u0442\u0440\u043E", durationSec: 2.8 }
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
    } catch {
      return null;
    }
  }
  function writeStored(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
    }
  }
  function resolveState() {
    const stored = readStored();
    let preset = "slow";
    if (stored?.preset === "custom") {
      preset = "custom";
    } else if (stored?.preset && stored.preset in PRESETS) {
      preset = stored.preset;
    }
    const durationSec = preset === "custom" ? clampDuration(stored?.durationSec ?? PRESETS.slow.durationSec) : PRESETS[preset].durationSec;
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
    return state.durationSec + particleIndex % 3 * STAGGER_SEC;
  }
  function applyEmojiOrbitSpeed() {
    document.documentElement.style.setProperty("--emoji-orbit-base-duration", `${state.durationSec}s`);
    document.querySelectorAll(".avatar-stack-orbit-particle").forEach((span, i) => {
      span.style.animationDuration = `${getEmojiOrbitParticleDurationSec(i)}s`;
    });
    if (typeof syncStackOrbitFromBattle === "function") {
      document.querySelectorAll(".avatar-stack-orbit-ring").forEach((ring) => {
        const el = ring;
        delete el.dataset.orbitSig;
        delete el.dataset.orbitSizeKey;
      });
    }
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
  function persistState() {
    writeStored({
      preset: state.preset,
      durationSec: state.durationSec
    });
    applyEmojiOrbitSpeed();
    syncEmojiOrbitSpeedSettingsUi();
  }
  function setEmojiOrbitPreset(presetId) {
    if (!(presetId in PRESETS)) return;
    const key = presetId;
    state.preset = key;
    state.durationSec = PRESETS[key].durationSec;
    persistState();
  }
  function setEmojiOrbitCustomDuration(durationSec) {
    state.preset = "custom";
    state.durationSec = clampDuration(durationSec);
    persistState();
  }
  function formatDurationLabel(sec) {
    return `${sec.toFixed(1).replace(".0", "")} \u0441\u0435\u043A`;
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
    syncEmojiOrbitSpeedSettingsUi
  };
  window.getEmojiOrbitParticleDurationSec = getEmojiOrbitParticleDurationSec;
  window.getEmojiOrbitDurationSec = getEmojiOrbitDurationSec;
  window.initEmojiOrbitSpeed = initEmojiOrbitSpeed;
  window.initEmojiOrbitSpeedControls = initEmojiOrbitSpeedControls;
  window.syncEmojiOrbitSpeedSettingsUi = syncEmojiOrbitSpeedSettingsUi;
})();
