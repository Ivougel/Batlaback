// Transpiled from TypeScript — npm run compile:ts

const PREP_HUD_PRESET_STORAGE_KEY = "bb-prep-hud-preset";
const PREP_HUD_PRESETS = {
  "hero-card": {
    id: "hero-card",
    label: "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0433\u0435\u0440\u043E\u044F",
    hint: "\u041F\u0440\u044F\u043C\u043E\u0443\u0433\u043E\u043B\u044C\u043D\u044B\u0439 bust-\u043F\u043E\u0440\u0442\u0440\u0435\u0442, \u043C\u0443\u0442\u0430\u0446\u0438\u0438 \u0438 \u0443\u0441\u0438\u043B\u0435\u043D\u0438\u044F \u0441\u043F\u0440\u0430\u0432\u0430",
    emoji: "\u{1F0CF}"
  },
  "unit-frame": {
    id: "unit-frame",
    label: "Unit Frame",
    hint: "\u041A\u0440\u0443\u0433\u043B\u044B\u0435 \u043F\u043E\u0440\u0442\u0440\u0435\u0442\u044B \u0438 \u043F\u043E\u043B\u043E\u0441\u044B HP \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u0444\u0430\u0437\u0435 \u0431\u043E\u044F",
    emoji: "\u2694\uFE0F"
  }
};
function getPrepHudPresetId() {
  try {
    const stored = localStorage.getItem(PREP_HUD_PRESET_STORAGE_KEY);
    return stored && PREP_HUD_PRESETS[stored] ? stored : "hero-card";
  } catch {
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
  } catch {
  }
  if (typeof syncUnitFrameHudChrome === "function") {
    syncUnitFrameHudChrome();
  } else if (typeof syncPrepUnitFrameHudChrome === "function") {
    syncPrepUnitFrameHudChrome();
  }
  if (typeof renderPlayerProfiles === "function") {
    try {
      renderPlayerProfiles();
    } catch {
    }
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
      const target = e.target;
      if (!target.checked) return;
      applyPrepHudPreset(target.value);
    });
  });
  syncPrepHudPresetSettingsUi();
}
