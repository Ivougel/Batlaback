/**
 * Скорость орбиты эмодзи-стаков вокруг героя в бою (localStorage: bb-emoji-orbit-speed).
 */
import type { EmojiOrbitPresetId } from "../types/game";

(function initEmojiOrbitSpeedModule(): void {
  const STORAGE_KEY = "bb-emoji-orbit-speed";

  const PRESETS: Record<Exclude<EmojiOrbitPresetId, "custom">, { label: string; durationSec: number }> = {
    slow: { label: "Медленно", durationSec: 7 },
    normal: { label: "Средне", durationSec: 4.5 },
    fast: { label: "Быстро", durationSec: 2.8 },
  };

  const CUSTOM_MIN_SEC = 2.5;
  const CUSTOM_MAX_SEC = 14;
  const STAGGER_SEC = 0.18;

  interface OrbitState {
    preset: EmojiOrbitPresetId;
    durationSec: number;
  }

  interface StoredOrbitState {
    preset?: EmojiOrbitPresetId;
    durationSec?: number;
  }

  function clampDuration(sec: number): number {
    return Math.min(CUSTOM_MAX_SEC, Math.max(CUSTOM_MIN_SEC, +sec || PRESETS.slow.durationSec));
  }

  function readStored(): StoredOrbitState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as StoredOrbitState;
    } catch {
      return null;
    }
  }

  function writeStored(data: StoredOrbitState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }

  function resolveState(): OrbitState {
    const stored = readStored();
    let preset: EmojiOrbitPresetId = "slow";
    if (stored?.preset === "custom") {
      preset = "custom";
    } else if (stored?.preset && stored.preset in PRESETS) {
      preset = stored.preset as Exclude<EmojiOrbitPresetId, "custom">;
    }
    const durationSec =
      preset === "custom"
        ? clampDuration(stored?.durationSec ?? PRESETS.slow.durationSec)
        : PRESETS[preset].durationSec;
    return { preset, durationSec: clampDuration(durationSec) };
  }

  let state = resolveState();

  function getEmojiOrbitPreset(): EmojiOrbitPresetId {
    return state.preset;
  }

  function getEmojiOrbitDurationSec(): number {
    return state.durationSec;
  }

  function getEmojiOrbitParticleDurationSec(particleIndex = 0): number {
    return state.durationSec + (particleIndex % 3) * STAGGER_SEC;
  }

  function applyEmojiOrbitSpeed(): void {
    document.documentElement.style.setProperty("--emoji-orbit-base-duration", `${state.durationSec}s`);
    document.querySelectorAll(".avatar-stack-orbit-particle").forEach((span, i) => {
      (span as HTMLElement).style.animationDuration = `${getEmojiOrbitParticleDurationSec(i)}s`;
    });
    if (typeof syncStackOrbitFromBattle === "function") {
      document.querySelectorAll(".avatar-stack-orbit-ring").forEach((ring) => {
        const el = ring as HTMLElement;
        delete el.dataset.orbitSig;
        delete el.dataset.orbitSizeKey;
      });
    }
  }

  function syncEmojiOrbitSpeedSettingsUi(): void {
    const valueEl = document.getElementById("settings-emoji-orbit-duration-value");
    const slider = document.getElementById("settings-emoji-orbit-duration") as HTMLInputElement | null;
    if (valueEl) valueEl.textContent = formatDurationLabel(state.durationSec);
    if (slider) slider.value = String(state.durationSec);

    document.querySelectorAll<HTMLInputElement>('input[name="emoji-orbit-preset"]').forEach((input) => {
      const checked = state.preset !== "custom" && input.value === state.preset;
      input.checked = checked;
      input.closest(".settings-orbit-preset")?.classList.toggle("is-selected", checked);
    });
  }

  function persistState(): void {
    writeStored({
      preset: state.preset,
      durationSec: state.durationSec,
    });
    applyEmojiOrbitSpeed();
    syncEmojiOrbitSpeedSettingsUi();
  }

  function setEmojiOrbitPreset(presetId: string): void {
    if (!(presetId in PRESETS)) return;
    const key = presetId as Exclude<EmojiOrbitPresetId, "custom">;
    state.preset = key;
    state.durationSec = PRESETS[key].durationSec;
    persistState();
  }

  function setEmojiOrbitCustomDuration(durationSec: number): void {
    state.preset = "custom";
    state.durationSec = clampDuration(durationSec);
    persistState();
  }

  function formatDurationLabel(sec: number): string {
    return `${sec.toFixed(1).replace(".0", "")} сек`;
  }

  function initEmojiOrbitSpeed(): void {
    state = resolveState();
    applyEmojiOrbitSpeed();
  }

  function initEmojiOrbitSpeedControls(): void {
    initEmojiOrbitSpeed();

    document.querySelectorAll<HTMLInputElement>('input[name="emoji-orbit-preset"]').forEach((input) => {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        setEmojiOrbitPreset(input.value);
      });
    });

    const slider = document.getElementById("settings-emoji-orbit-duration") as HTMLInputElement | null;
    slider?.addEventListener("input", (e) => {
      setEmojiOrbitCustomDuration(+(e.target as HTMLInputElement).value);
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
