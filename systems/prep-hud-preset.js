/**
 * Пресеты HUD prep/battle (localStorage: bb-prep-hud-preset).
 * hero-card — текущие фреймы; unit-frame — MMORPG unit frames.
 */

const PREP_HUD_PRESET_STORAGE_KEY = "bb-prep-hud-preset";

const PREP_HUD_PRESETS = {
  "hero-card": {
    id: "hero-card",
    label: "Карточка героя",
    hint: "Прямоугольный bust-портрет, мутации и усиления справа",
    emoji: "🃏",
  },
  "unit-frame": {
    id: "unit-frame",
    label: "Unit Frame",
    hint: "MMORPG — круглые портреты и полосы HP на подготовке и в бою",
    emoji: "⚔️",
  },
};

function getPrepHudPresetId() {
  try {
    const stored = localStorage.getItem(PREP_HUD_PRESET_STORAGE_KEY);
    return PREP_HUD_PRESETS[stored] ? stored : "hero-card";
  } catch (_) {
    return "hero-card";
  }
}

function getPrepHudPresetMeta(presetId = getPrepHudPresetId()) {
  return PREP_HUD_PRESETS[presetId] || PREP_HUD_PRESETS["hero-card"];
}

function isPrepHudPresetUnitFrame() {
  return getPrepHudPresetId() === "unit-frame";
}

function applyPrepHudPreset(presetId) {
  const preset = getPrepHudPresetMeta(presetId);
  const root = document.documentElement;
  root.dataset.prepHudPreset = preset.id;
  try {
    localStorage.setItem(PREP_HUD_PRESET_STORAGE_KEY, preset.id);
  } catch (_) { /* ignore */ }

  if (typeof syncUnitFrameHudChrome === "function") {
    syncUnitFrameHudChrome();
  } else if (typeof syncPrepUnitFrameHudChrome === "function") {
    syncPrepUnitFrameHudChrome();
  }
  if (typeof renderPlayerProfiles === "function") {
    try {
      renderPlayerProfiles();
    } catch (_) { /* profiles may not exist yet */ }
  }

  syncPrepHudPresetSettingsUi();
}

function syncPrepHudPresetSettingsUi() {
  const current = getPrepHudPresetId();
  document.querySelectorAll('input[name="prep-hud-preset"]').forEach((input) => {
    input.checked = input.value === current;
  });
  document.querySelectorAll(".settings-prep-hud-option").forEach((label) => {
    const input = label.querySelector('input[name="prep-hud-preset"]');
    label.classList.toggle("is-selected", input?.value === current);
  });
}

function initPrepHudPreset() {
  applyPrepHudPreset(getPrepHudPresetId());
}

function initPrepHudPresetControls() {
  document.querySelectorAll('input[name="prep-hud-preset"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      if (!e.target.checked) return;
      applyPrepHudPreset(e.target.value);
    });
  });
  syncPrepHudPresetSettingsUi();
}
