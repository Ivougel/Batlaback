/**
 * Попап настроек.
 */

function showSettingsPopup() {
  const overlay = document.getElementById("settings-overlay");
  if (!overlay) return;
  if (typeof syncMusicVolumeUi === "function") {
    syncMusicVolumeUi(typeof getMusicVolume === "function" ? getMusicVolume() : 0.6);
  }
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  document.getElementById("btn-settings")?.setAttribute("aria-expanded", "true");
  if (typeof tryStartMusic === "function") tryStartMusic();
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}

function hideSettingsPopup() {
  document.getElementById("settings-overlay")?.classList.add("hidden");
  document.getElementById("settings-overlay")?.setAttribute("aria-hidden", "true");
  document.getElementById("btn-settings")?.setAttribute("aria-expanded", "false");
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}

function toggleSettingsPopup() {
  if (isSettingsOpen()) hideSettingsPopup();
  else showSettingsPopup();
}

function isSettingsOpen() {
  return isPopupOpen("settings-overlay");
}

function initSettingsControls() {
  document.getElementById("btn-settings")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSettingsPopup();
  });
  document.getElementById("btn-settings-close")?.addEventListener("click", hideSettingsPopup);
  document.getElementById("settings-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "settings-overlay") hideSettingsPopup();
  });

  const slider = document.getElementById("settings-music-volume");
  slider?.addEventListener("input", (e) => {
    const pct = +e.target.value;
    if (typeof setMusicVolume === "function") setMusicVolume(pct / 100);
    if (typeof tryStartMusic === "function") tryStartMusic();
  });
}
