/**
 * Фоновая музыка: плейлист по очереди, громкость в localStorage, autoplay после первого жеста.
 */
(function initMusicSystem() {
  const MUSIC_PLAYLIST = [
    "music/negrov.mp3",
    "music/Backpack Bazaar.mp3",
    "music/Backpack Bazaar2.mp3",
  ];
  const MUSIC_VOLUME_KEY = "bb-music-volume";
  const DEFAULT_VOLUME = 0.6;

  let musicAudio = null;
  let currentTrackIndex = 0;
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

  function playTrack(index, autoplay = false) {
    if (!musicAudio || !MUSIC_PLAYLIST.length) return;
    currentTrackIndex = ((index % MUSIC_PLAYLIST.length) + MUSIC_PLAYLIST.length) % MUSIC_PLAYLIST.length;
    musicAudio.src = MUSIC_PLAYLIST[currentTrackIndex];
    musicAudio.load();
    if (!autoplay) return;
    const playPromise = musicAudio.play();
    if (!playPromise) return;
    playPromise.catch(() => {});
  }

  function playNextTrack() {
    playTrack(currentTrackIndex + 1, true);
  }

  function onTrackEnded() {
    playNextTrack();
  }

  function onTrackError() {
    if (MUSIC_PLAYLIST.length <= 1) return;
    playNextTrack();
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
    musicAudio = new Audio(MUSIC_PLAYLIST[0]);
    musicAudio.loop = false;
    musicAudio.preload = "auto";
    musicAudio.addEventListener("ended", onTrackEnded);
    musicAudio.addEventListener("error", onTrackError);
    currentTrackIndex = 0;
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
