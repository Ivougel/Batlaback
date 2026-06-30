/**
 * Фоновая музыка: плейлист по очереди, громкость в localStorage, autoplay после первого жеста.
 */
(function initMusicSystem() {
  const NEGROV_TRACK = "music/negrov.mp3";
  const BASE_PLAYLIST = [
    "music/Backpack Bazaar.mp3",
    "music/Backpack Bazaar2.mp3",
  ];
  const MUSIC_VOLUME_KEY = "bb-music-volume";
  const NEGROV_ENABLED_KEY = "bb-negrov-enabled";
  const DEFAULT_VOLUME = 0.6;

  let musicAudio = null;
  let currentTrackIndex = 0;
  let musicStarted = false;
  let unlockBound = false;
  let pausedByBackground = false;

  function isNegrovEnabled() {
    return localStorage.getItem(NEGROV_ENABLED_KEY) === "1";
  }

  function getMusicPlaylist() {
    if (isNegrovEnabled()) return [NEGROV_TRACK, ...BASE_PLAYLIST];
    return [...BASE_PLAYLIST];
  }

  function getCurrentTrackSrc() {
    const playlist = getMusicPlaylist();
    if (!playlist.length) return null;
    const idx = ((currentTrackIndex % playlist.length) + playlist.length) % playlist.length;
    return playlist[idx];
  }

  function isPlayingNegrovTrack() {
    if (!musicAudio) return false;
    const src = musicAudio.getAttribute("src") || musicAudio.src || "";
    return src.includes("negrov");
  }

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

  function syncNegrovEnabledUi(enabled) {
    const checkbox = document.getElementById("settings-negrov-enabled");
    if (checkbox) checkbox.checked = !!enabled;
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

  function setNegrovEnabled(enabled) {
    const next = !!enabled;
    localStorage.setItem(NEGROV_ENABLED_KEY, next ? "1" : "0");
    syncNegrovEnabledUi(next);

    if (!musicAudio) return next;

    const playlist = getMusicPlaylist();
    if (!playlist.length) return next;

    const currentSrc = getCurrentTrackSrc();
    if (!next && isPlayingNegrovTrack()) {
      currentTrackIndex = 0;
      playTrack(0, musicStarted && !musicAudio.paused);
      return next;
    }

    const playingSrc = musicAudio.getAttribute("src") || musicAudio.src || "";
    const idxInNew = playlist.findIndex((track) => playingSrc.includes(track.replace(/^\.?\//, "")));
    if (idxInNew >= 0) {
      currentTrackIndex = idxInNew;
    } else if (currentSrc) {
      currentTrackIndex = playlist.indexOf(currentSrc);
      if (currentTrackIndex < 0) currentTrackIndex = 0;
    }

    return next;
  }

  function playTrack(index, autoplay = false) {
    const playlist = getMusicPlaylist();
    if (!musicAudio || !playlist.length) return;
    currentTrackIndex = ((index % playlist.length) + playlist.length) % playlist.length;
    musicAudio.src = playlist[currentTrackIndex];
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
    const playlist = getMusicPlaylist();
    if (playlist.length <= 1) return;
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

  function pauseMusicForBackground() {
    if (!musicAudio || musicAudio.paused) return;
    pausedByBackground = true;
    musicAudio.pause();
  }

  function resumeMusicFromBackground() {
    if (!musicAudio || !pausedByBackground) return;
    pausedByBackground = false;
    if (getMusicVolume() <= 0) return;
    const playPromise = musicAudio.play();
    if (playPromise) playPromise.catch(() => {});
  }

  function bindMusicVisibility() {
    const onHide = () => pauseMusicForBackground();
    const onShow = () => resumeMusicFromBackground();

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") onHide();
      else onShow();
    });
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("blur", onHide);
    window.addEventListener("focus", onShow);
  }

  function initMusic() {
    if (musicAudio) return;
    const playlist = getMusicPlaylist();
    if (!playlist.length) return;
    musicAudio = new Audio(playlist[0]);
    musicAudio.loop = false;
    musicAudio.preload = "auto";
    musicAudio.addEventListener("ended", onTrackEnded);
    musicAudio.addEventListener("error", onTrackError);
    currentTrackIndex = 0;
    applyMusicVolume(getMusicVolume());
    syncNegrovEnabledUi(isNegrovEnabled());
    bindMusicUnlock();
    bindMusicVisibility();
    tryStartMusic();
  }

  window.getMusicVolume = getMusicVolume;
  window.setMusicVolume = setMusicVolume;
  window.syncMusicVolumeUi = syncMusicVolumeUi;
  window.isNegrovEnabled = isNegrovEnabled;
  window.setNegrovEnabled = setNegrovEnabled;
  window.syncNegrovEnabledUi = syncNegrovEnabledUi;
  window.initMusic = initMusic;
  window.tryStartMusic = tryStartMusic;
})();
