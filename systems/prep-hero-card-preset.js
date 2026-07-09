// Transpiled from TypeScript — npm run compile:ts

const PREP_HERO_CARD_PRESET_STORAGE_KEY = "bb-prep-hero-card-preset";
const PREP_HERO_CARD_PRESETS = {
  classic: {
    id: "classic",
    label: "\u041A\u043B\u0430\u0441\u0441\u0438\u0447\u0435\u0441\u043A\u0430\u044F",
    hint: "Bust-\u043F\u043E\u0440\u0442\u0440\u0435\u0442 \u043D\u0430 \u0432\u0441\u044E \u0432\u044B\u0441\u043E\u0442\u0443 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438, \u043C\u0443\u0442\u0430\u0446\u0438\u0438 \u0438 \u0443\u0441\u0438\u043B\u0435\u043D\u0438\u044F \u0441\u043F\u0440\u0430\u0432\u0430",
    emoji: "\u{1F0CF}"
  },
  banner: {
    id: "banner",
    label: "\u0411\u0430\u043D\u043D\u0435\u0440",
    hint: "\u041A\u043E\u043C\u043F\u0430\u043A\u0442\u043D\u0430\u044F \u0448\u0430\u043F\u043A\u0430: \u043F\u043E\u0440\u0442\u0440\u0435\u0442 + \u043F\u0443\u0442\u044C/\u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441, \u0430\u0434\u0430\u043F\u0442\u0438\u0432\u043D\u043E \u043F\u043E\u0434 \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u044D\u043A\u0440\u0430\u043D\u0430",
    emoji: "\u{1F4CB}"
  }
};
function getPrepHeroCardPresetId() {
  try {
    const stored = localStorage.getItem(PREP_HERO_CARD_PRESET_STORAGE_KEY);
    return stored && PREP_HERO_CARD_PRESETS[stored] ? stored : "classic";
  } catch {
    return "classic";
  }
}
function getPrepHeroCardPresetMeta(presetId = getPrepHeroCardPresetId()) {
  return PREP_HERO_CARD_PRESETS[presetId] || PREP_HERO_CARD_PRESETS.classic;
}
function isPrepHeroCardBannerPreset() {
  return getPrepHeroCardPresetId() === "banner";
}
function applyPrepHeroCardPreset(presetId) {
  const preset = getPrepHeroCardPresetMeta(presetId);
  const root = document.documentElement;
  root.dataset.prepHeroCardPreset = preset.id;
  try {
    localStorage.setItem(PREP_HERO_CARD_PRESET_STORAGE_KEY, preset.id);
  } catch {
  }
  if (typeof window.syncPrepHeroCardPortraitSize === "function") {
    window.syncPrepHeroCardPortraitSize();
  }
  if (typeof syncPrepHudCollapseChrome === "function") {
    syncPrepHudCollapseChrome();
  }
  if (typeof renderPlayerProfiles === "function") {
    try {
      renderPlayerProfiles();
    } catch {
    }
  }
  syncPrepHeroCardPresetSettingsUi();
}
function syncPrepHeroCardPresetSettingsUi() {
  const current = getPrepHeroCardPresetId();
  document.querySelectorAll('input[name="prep-hero-card-preset"]').forEach((input) => {
    input.checked = input.value === current;
  });
  document.querySelectorAll(".settings-prep-hero-card-option").forEach((label) => {
    const input = label.querySelector('input[name="prep-hero-card-preset"]');
    label.classList.toggle("is-selected", input?.value === current);
  });
}
function initPrepHeroCardPreset() {
  applyPrepHeroCardPreset(getPrepHeroCardPresetId());
}
function initPrepHeroCardPresetControls() {
  document.querySelectorAll('input[name="prep-hero-card-preset"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      const target = e.target;
      if (!target.checked) return;
      applyPrepHeroCardPreset(target.value);
    });
  });
  syncPrepHeroCardPresetSettingsUi();
}
