/**
 * Фоновая музыка: loop, громкость в localStorage, autoplay после первого жеста.
 */
(function initMusicSystem() {
  const MUSIC_TRACK = "music/Backpack Bazaar.mp3";
  const MUSIC_VOLUME_KEY = "bb-music-volume";
  const DEFAULT_VOLUME = 0.6;

  let musicAudio = null;
  let musicStarted = false;
  let unlockBound = false;

  function getMusicVolume() {
    const raw = localStorage.getItem(MUSIC_VOLUME_KEY);
    const v = raw == null ? DEFAULT_VOLUME : Number(raw);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULT_VOLUME;
  }

  function syncMusicVolumeUi(volume) {
    const pct = Math.round(volume * 100);
    const slider = document.getElementById("settings-music-volume");
    const label = document.getElementById("settings-music-volume-value");
    if (slider) slider.value = String(pct);
    if (label) label.textContent = `${pct}%`;
  }

  function applyMusicVolume(volume) {
    if (musicAudio) musicAudio.volume = volume;
    syncMusicVolumeUi(volume);
  }

  function setMusicVolume(volume) {
    const clamped = Math.max(0, Math.min(1, volume));
    localStorage.setItem(MUSIC_VOLUME_KEY, String(clamped));
    applyMusicVolume(clamped);
    return clamped;
  }

  function tryStartMusic() {
    if (!musicAudio || musicStarted) return;
    const playPromise = musicAudio.play();
    if (!playPromise) {
      musicStarted = true;
      return;
    }
    playPromise.then(() => {
      musicStarted = true;
    }).catch(() => {});
  }

  function bindMusicUnlock() {
    if (unlockBound) return;
    unlockBound = true;
    const unlock = () => tryStartMusic();
    document.addEventListener("pointerdown", unlock, { passive: true });
    document.addEventListener("keydown", unlock);
    document.addEventListener("touchstart", unlock, { passive: true });
  }

  function initMusic() {
    if (musicAudio) return;
    musicAudio = new Audio(MUSIC_TRACK);
    musicAudio.loop = true;
    musicAudio.preload = "auto";
    applyMusicVolume(getMusicVolume());
    bindMusicUnlock();
    tryStartMusic();
  }

  window.getMusicVolume = getMusicVolume;
  window.setMusicVolume = setMusicVolume;
  window.syncMusicVolumeUi = syncMusicVolumeUi;
  window.initMusic = initMusic;
  window.tryStartMusic = tryStartMusic;
})();
