// Transpiled from TypeScript — npm run compile:ts

(function initMusicSystem() {
  const NEGROV_TRACK = "music/negrov.mp3";
  const BASE_PLAYLIST = [
    "music/Backpack Bazaar.mp3",
    "music/Backpack Bazaar2.mp3",
    "music/Whisper of the Deep Woods.mp3",
    "music/Whisper of the Mossy Path.mp3",
    "music/Whispering Grove.mp3"
  ];
  const MUSIC_VOLUME_KEY = "bb-music-volume";
  const MUSIC_TRACK_KEY = "bb-music-track";
  const NEGROV_ENABLED_KEY = "bb-negrov-enabled";
  const DEFAULT_VOLUME = 0.6;
  const PLAYLIST_TRACK_ID = "playlist";
  const MUSIC_TRACKS = [
    {
      id: PLAYLIST_TRACK_ID,
      label: "\u{1F500} \u041F\u043B\u0435\u0439\u043B\u0438\u0441\u0442",
      src: null,
      hint: "\u0412\u0441\u0435 \u0442\u0440\u0435\u043A\u0438 \u043F\u043E \u043E\u0447\u0435\u0440\u0435\u0434\u0438. \u0427\u0435\u043A\u0431\u043E\u043A\u0441 \xAB\u041D\u0435\u0433\u0440\u044B\xBB \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0435\u0442 \u043E\u0441\u043E\u0431\u044B\u0439 \u0442\u0440\u0435\u043A \u0432 \u043D\u0430\u0447\u0430\u043B\u043E."
    },
    {
      id: "backpack-bazaar",
      label: "Backpack Bazaar",
      src: "music/Backpack Bazaar.mp3",
      hint: "\u041E\u0441\u043D\u043E\u0432\u043D\u0430\u044F \u0442\u0435\u043C\u0430 \u0431\u0430\u0437\u0430\u0440\u0430."
    },
    {
      id: "backpack-bazaar2",
      label: "Backpack Bazaar 2",
      src: "music/Backpack Bazaar2.mp3",
      hint: "\u0412\u0442\u043E\u0440\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F \u0442\u0435\u043C\u044B \u0431\u0430\u0437\u0430\u0440\u0430."
    },
    {
      id: "whisper-deep-woods",
      label: "Whisper of the Deep Woods",
      src: "music/Whisper of the Deep Woods.mp3",
      hint: "\u0422\u0438\u0445\u0438\u0439 \u043B\u0435\u0441\u043D\u043E\u0439 ambient."
    },
    {
      id: "whisper-mossy-path",
      label: "Whisper of the Mossy Path",
      src: "music/Whisper of the Mossy Path.mp3",
      hint: "\u041C\u0448\u0438\u0441\u0442\u0430\u044F \u0442\u0440\u043E\u043F\u0430 \u2014 \u0441\u043F\u043E\u043A\u043E\u0439\u043D\u044B\u0439 \u0444\u043E\u043D."
    },
    {
      id: "whispering-grove",
      label: "Whispering Grove",
      src: "music/Whispering Grove.mp3",
      hint: "\u0428\u0451\u043F\u043E\u0442 \u0440\u043E\u0449\u0438."
    },
    {
      id: "negrov",
      label: "\u041D\u0435\u0433\u0440\u044B",
      src: NEGROV_TRACK,
      hint: "\u041E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0442\u0440\u0435\u043A (\u0442\u043E\u0442 \u0436\u0435, \u0447\u0442\u043E \u0432 \u043F\u043B\u0435\u0439\u043B\u0438\u0441\u0442\u0435 \u0441 \u0447\u0435\u043A\u0431\u043E\u043A\u0441\u043E\u043C)."
    }
  ];
  let musicAudio = null;
  let currentTrackIndex = 0;
  let musicStarted = false;
  let unlockBound = false;
  let pausedByBackground = false;
  function getMusicTrackMeta(trackId = getMusicTrackId()) {
    return MUSIC_TRACKS.find((t) => t.id === trackId) || MUSIC_TRACKS[0];
  }
  function getMusicTrackId() {
    try {
      const stored = localStorage.getItem(MUSIC_TRACK_KEY);
      if (!stored || stored === PLAYLIST_TRACK_ID) return PLAYLIST_TRACK_ID;
      return MUSIC_TRACKS.some((t) => t.id === stored) ? stored : PLAYLIST_TRACK_ID;
    } catch (_) {
      return PLAYLIST_TRACK_ID;
    }
  }
  function isPlaylistMode() {
    return getMusicTrackId() === PLAYLIST_TRACK_ID;
  }
  function isNegrovEnabled() {
    return localStorage.getItem(NEGROV_ENABLED_KEY) === "1";
  }
  function getMusicPlaylist() {
    const selected = getMusicTrackId();
    if (selected !== PLAYLIST_TRACK_ID) {
      const track = MUSIC_TRACKS.find((t) => t.id === selected);
      return track?.src ? [track.src] : [...BASE_PLAYLIST];
    }
    if (isNegrovEnabled()) return [NEGROV_TRACK, ...BASE_PLAYLIST];
    return [...BASE_PLAYLIST];
  }
  function getCurrentTrackSrc() {
    const playlist = getMusicPlaylist();
    if (!playlist.length) return null;
    const idx = (currentTrackIndex % playlist.length + playlist.length) % playlist.length;
    return playlist[idx];
  }
  function isPlayingNegrovTrack() {
    if (!musicAudio) return false;
    const src = musicAudio.getAttribute("src") || musicAudio.src || "";
    return src.includes("negrov");
  }
  function updateMusicLoopMode() {
    if (!musicAudio) return;
    musicAudio.loop = !isPlaylistMode();
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
    if (!checkbox) return;
    const playlist = isPlaylistMode();
    checkbox.checked = !!enabled;
    checkbox.disabled = !playlist;
    checkbox.closest(".settings-row")?.classList.toggle("settings-row--disabled", !playlist);
  }
  function populateMusicTrackSelect() {
    const select = document.getElementById("settings-music-track");
    if (!select) return;
    const current = getMusicTrackId();
    select.replaceChildren();
    MUSIC_TRACKS.forEach((track) => {
      const opt = document.createElement("option");
      opt.value = track.id;
      opt.textContent = track.label;
      select.appendChild(opt);
    });
    select.value = current;
  }
  function syncMusicTrackSettingsUi() {
    const current = getMusicTrackId();
    const select = document.getElementById("settings-music-track");
    if (select) {
      if (!select.options.length) populateMusicTrackSelect();
      select.value = current;
    }
    const hint = document.getElementById("settings-music-track-hint");
    if (hint) {
      hint.textContent = getMusicTrackMeta(current).hint || "";
    }
    syncNegrovEnabledUi(isNegrovEnabled());
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
  function setMusicTrack(trackId, options = {}) {
    const meta = getMusicTrackMeta(trackId);
    const id = meta?.id || PLAYLIST_TRACK_ID;
    try {
      localStorage.setItem(MUSIC_TRACK_KEY, id);
    } catch (_) {
    }
    syncMusicTrackSettingsUi();
    updateMusicLoopMode();
    if (!musicAudio) return id;
    const wasPlaying = musicStarted && !musicAudio.paused;
    currentTrackIndex = 0;
    playTrack(0, options.autoplay !== false && (wasPlaying || musicStarted));
    return id;
  }
  function setNegrovEnabled(enabled) {
    if (!isPlaylistMode()) {
      syncNegrovEnabledUi(isNegrovEnabled());
      return isNegrovEnabled();
    }
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
    currentTrackIndex = (index % playlist.length + playlist.length) % playlist.length;
    musicAudio.src = playlist[currentTrackIndex];
    updateMusicLoopMode();
    musicAudio.load();
    if (!autoplay) return;
    const playPromise = musicAudio.play();
    if (!playPromise) return;
    playPromise.catch(() => {
    });
  }
  function playNextTrack() {
    if (!isPlaylistMode()) return;
    playTrack(currentTrackIndex + 1, true);
  }
  function onTrackEnded() {
    playNextTrack();
  }
  function onTrackError() {
    const playlist = getMusicPlaylist();
    if (!isPlaylistMode() || playlist.length <= 1) return;
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
    }).catch(() => {
    });
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
    if (playPromise) playPromise.catch(() => {
    });
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
  function initMusicTrackControls() {
    populateMusicTrackSelect();
    syncMusicTrackSettingsUi();
    const select = document.getElementById("settings-music-track");
    select?.addEventListener("change", (e) => {
      const target = e.target;
      setMusicTrack(target.value);
      tryStartMusic();
    });
  }
  function initMusic() {
    if (musicAudio) return;
    const playlist = getMusicPlaylist();
    if (!playlist.length) return;
    musicAudio = new Audio(playlist[0]);
    musicAudio.loop = !isPlaylistMode();
    musicAudio.preload = "auto";
    musicAudio.addEventListener("ended", onTrackEnded);
    musicAudio.addEventListener("error", onTrackError);
    currentTrackIndex = 0;
    applyMusicVolume(getMusicVolume());
    syncMusicTrackSettingsUi();
    bindMusicUnlock();
    bindMusicVisibility();
    tryStartMusic();
  }
  window.getMusicVolume = getMusicVolume;
  window.setMusicVolume = setMusicVolume;
  window.syncMusicVolumeUi = syncMusicVolumeUi;
  window.getMusicTrackId = getMusicTrackId;
  window.setMusicTrack = setMusicTrack;
  window.syncMusicTrackSettingsUi = syncMusicTrackSettingsUi;
  window.initMusicTrackControls = initMusicTrackControls;
  window.isNegrovEnabled = isNegrovEnabled;
  window.setNegrovEnabled = setNegrovEnabled;
  window.syncNegrovEnabledUi = syncNegrovEnabledUi;
  window.initMusic = initMusic;
  window.tryStartMusic = tryStartMusic;
})();
