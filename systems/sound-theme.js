/**
 * Звуковое оформление (localStorage: bb-sound-theme).
 * classic · dopamine · gentle · meat (Diablo) · mirror (Black Mirror UI).
 */

const SOUND_THEME_STORAGE_KEY = "bb-sound-theme";

function getSoundThemeId() {
  try {
    const stored = localStorage.getItem(SOUND_THEME_STORAGE_KEY);
    return SfxThemes?.META?.[stored] ? stored : (SfxThemes?.defaultId || "classic");
  } catch (_) {
    return SfxThemes?.defaultId || "classic";
  }
}

function getSoundThemeMeta(themeId = getSoundThemeId()) {
  return SfxThemes?.META?.[themeId] || SfxThemes?.META?.classic;
}

function previewSoundTheme(themeId = getSoundThemeId()) {
  if (typeof playGameSfx !== "function" || typeof getSfxVolume !== "function") return;
  if (getSfxVolume() <= 0) return;

  if (themeId === "mirror") {
    playGameSfx("ui_hover");
    window.setTimeout(() => playGameSfx("ui_click"), 180);
    window.setTimeout(() => playGameSfx("ui_open"), 420);
    return;
  }

  if (themeId === "meat") {
    playGameSfx("ui_hover");
    window.setTimeout(() => playGameSfx("ui_click"), 160);
    window.setTimeout(() => playGameSfx("prep_place", { heavy: true }), 380);
    return;
  }

  if (themeId === "gentle") {
    playGameSfx("ui_click");
    window.setTimeout(() => playGameSfx("gold"), 450);
    return;
  }

  playGameSfx("ui_click");
  window.setTimeout(() => playGameSfx("prep_buy"), 130);
  window.setTimeout(() => playGameSfx("gold"), 420);
}

function applySoundTheme(themeId, options = {}) {
  const meta = getSoundThemeMeta(themeId);
  const id = meta?.id || "classic";
  const root = document.documentElement;
  root.dataset.soundTheme = id;
  try {
    localStorage.setItem(SOUND_THEME_STORAGE_KEY, id);
  } catch (_) { /* ignore */ }

  if (typeof rebuildGameSfxTheme === "function") {
    rebuildGameSfxTheme(id);
  }

  syncSoundThemeSettingsUi();

  if (options.preview !== false) {
    previewSoundTheme(id);
  }
}

function populateSoundThemeSelect() {
  const select = document.getElementById("settings-sound-theme");
  if (!select || !SfxThemes?.META) return;

  const current = getSoundThemeId();
  select.replaceChildren();
  Object.values(SfxThemes.META).forEach((meta) => {
    const opt = document.createElement("option");
    opt.value = meta.id;
    opt.textContent = `${meta.emoji} ${meta.label}`;
    select.appendChild(opt);
  });
  select.value = current;
}

function syncSoundThemeSettingsUi() {
  const current = getSoundThemeId();
  const select = document.getElementById("settings-sound-theme");
  if (select) {
    if (!select.options.length) populateSoundThemeSelect();
    select.value = current;
  }

  const hint = document.getElementById("settings-sound-theme-hint");
  if (hint) {
    const meta = getSoundThemeMeta(current);
    hint.textContent = meta?.hint || "";
  }
}

function initSoundTheme() {
  applySoundTheme(getSoundThemeId(), { preview: false });
}

function initSoundThemeControls() {
  populateSoundThemeSelect();
  syncSoundThemeSettingsUi();

  const select = document.getElementById("settings-sound-theme");
  select?.addEventListener("change", (e) => {
    applySoundTheme(e.target.value);
  });
}
