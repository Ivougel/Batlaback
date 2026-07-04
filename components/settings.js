/**
 * Попап настроек.
 */

function showSettingsPopup() {
  const overlay = document.getElementById("settings-overlay");
  if (!overlay) return;
  if (typeof syncMusicVolumeUi === "function") {
    syncMusicVolumeUi(typeof getMusicVolume === "function" ? getMusicVolume() : 0.6);
  }
  if (typeof syncSfxVolumeUi === "function") {
    syncSfxVolumeUi(typeof getSfxVolume === "function" ? getSfxVolume() : 0.75);
  }
  if (typeof syncNegrovEnabledUi === "function") {
    syncNegrovEnabledUi(typeof isNegrovEnabled === "function" ? isNegrovEnabled() : false);
  }
  if (typeof syncCombatFeedSettingsUi === "function") syncCombatFeedSettingsUi();
  if (typeof syncLightBattleFxSettingsUi === "function") syncLightBattleFxSettingsUi();
  if (typeof syncEmojiOrbitSpeedSettingsUi === "function") syncEmojiOrbitSpeedSettingsUi();
  if (typeof syncVisualThemeSettingsUi === "function") syncVisualThemeSettingsUi();
  if (typeof syncSoundThemeSettingsUi === "function") syncSoundThemeSettingsUi();
  if (typeof syncMusicTrackSettingsUi === "function") syncMusicTrackSettingsUi();
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  document.querySelectorAll("#btn-settings, #btn-settings-intro").forEach((btn) => {
    btn?.setAttribute("aria-expanded", "true");
  });
  if (typeof tryStartMusic === "function") tryStartMusic();
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}

function hideSettingsPopup(options = {}) {
  const playSfx = options.sfx !== false;
  if (playSfx && typeof playGameSfx === "function") playGameSfx("ui_close");
  document.getElementById("settings-overlay")?.classList.add("hidden");
  document.getElementById("settings-overlay")?.setAttribute("aria-hidden", "true");
  document.querySelectorAll("#btn-settings, #btn-settings-intro").forEach((btn) => {
    btn?.setAttribute("aria-expanded", "false");
  });
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}

function toggleSettingsPopup() {
  if (isSettingsOpen()) hideSettingsPopup({ sfx: false });
  else showSettingsPopup();
}

function isSettingsOpen() {
  return isPopupOpen("settings-overlay");
}

function initSettingsControls() {
  document.querySelectorAll("#btn-settings, #btn-settings-intro").forEach((btn) => {
    btn?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSettingsPopup();
    });
  });
  document.getElementById("btn-settings-close")?.addEventListener("click", () => hideSettingsPopup({ sfx: false }));
  document.getElementById("settings-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "settings-overlay") hideSettingsPopup();
  });

  const slider = document.getElementById("settings-music-volume");
  slider?.addEventListener("input", (e) => {
    const pct = +e.target.value;
    if (typeof setMusicVolume === "function") setMusicVolume(pct / 100);
    if (typeof tryStartMusic === "function") tryStartMusic();
  });

  const sfxSlider = document.getElementById("settings-sfx-volume");
  sfxSlider?.addEventListener("input", (e) => {
    const pct = +e.target.value;
    if (typeof setSfxVolume === "function") setSfxVolume(pct / 100);
  });

  const negrovCheckbox = document.getElementById("settings-negrov-enabled");
  negrovCheckbox?.addEventListener("change", (e) => {
    if (typeof setNegrovEnabled === "function") setNegrovEnabled(e.target.checked);
    if (typeof tryStartMusic === "function") tryStartMusic();
  });

  if (typeof initVisualThemeControls === "function") initVisualThemeControls();
  if (typeof initSoundThemeControls === "function") initSoundThemeControls();
  if (typeof initMusicTrackControls === "function") initMusicTrackControls();

  document.getElementById("btn-settings-buy-pass")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    if (typeof launchPassLaughBalls === "function") {
      launchPassLaughBalls({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
  });
}
