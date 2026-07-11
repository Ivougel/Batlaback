/**
 * Фоновая музыка: плейлист или один трек, громкость в localStorage, autoplay после первого жеста.
 */
(function initMusicSystem() {
  type MusicTrack = {
    id: string;
    label: string;
    src: string | null;
    hint: string;
  };

  type SetMusicTrackOptions = { autoplay?: boolean };

  const NEGROV_TRACK = "music/negrov.mp3";
  const BASE_PLAYLIST = [
    "music/Backpack Bazaar.mp3",
    "music/Backpack Bazaar2.mp3",
    "music/Whisper of the Deep Woods.mp3",
    "music/Whisper of the Mossy Path.mp3",
    "music/Whispering Grove.mp3",
  ];
  const MUSIC_VOLUME_KEY = "bb-music-volume";
  const MUSIC_TRACK_KEY = "bb-music-track";
  const NEGROV_ENABLED_KEY = "bb-negrov-enabled";
  const DEFAULT_VOLUME = 0.6;
  const PLAYLIST_TRACK_ID = "playlist";

  const MUSIC_TRACKS: MusicTrack[] = [
    {
      id: PLAYLIST_TRACK_ID,
      label: "🔀 Плейлист",
      src: null,
      hint: "Все треки по очереди. Чекбокс «Негры» добавляет особый трек в начало.",
    },
    {
      id: "backpack-bazaar",
      label: "Backpack Bazaar",
      src: "music/Backpack Bazaar.mp3",
      hint: "Основная тема базара.",
    },
    {
      id: "backpack-bazaar2",
      label: "Backpack Bazaar 2",
      src: "music/Backpack Bazaar2.mp3",
      hint: "Вторая версия темы базара.",
    },
    {
      id: "whisper-deep-woods",
      label: "Whisper of the Deep Woods",
      src: "music/Whisper of the Deep Woods.mp3",
      hint: "Тихий лесной ambient.",
    },
    {
      id: "whisper-mossy-path",
      label: "Whisper of the Mossy Path",
      src: "music/Whisper of the Mossy Path.mp3",
      hint: "Мшистая тропа — спокойный фон.",
    },
    {
      id: "whispering-grove",
      label: "Whispering Grove",
      src: "music/Whispering Grove.mp3",
      hint: "Шёпот рощи.",
    },
    {
      id: "negrov",
      label: "Негры",
      src: NEGROV_TRACK,
      hint: "Отдельный трек (тот же, что в плейлисте с чекбоксом).",
    },
  ];

  let musicAudio: HTMLAudioElement | null = null;
  let currentTrackIndex = 0;
  let musicStarted = false;
  let unlockBound = false;
  let pausedByBackground = false;

  function getMusicTrackMeta(trackId: string = getMusicTrackId()): MusicTrack {
    return MUSIC_TRACKS.find((t) => t.id === trackId) || MUSIC_TRACKS[0];
  }

  function getMusicTrackId(): string {
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

  function getMusicPlaylist(): string[] {
    const selected = getMusicTrackId();
    if (selected !== PLAYLIST_TRACK_ID) {
      const track = MUSIC_TRACKS.find((t) => t.id === selected);
      return track?.src ? [track.src] : [...BASE_PLAYLIST];
    }
    if (isNegrovEnabled()) return [NEGROV_TRACK, ...BASE_PLAYLIST];
    return [...BASE_PLAYLIST];
  }

  function getCurrentTrackSrc(): string | null {
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

  function updateMusicLoopMode() {
    if (!musicAudio) return;
    musicAudio.loop = !isPlaylistMode();
  }

  function getMusicVolume() {
    const raw = localStorage.getItem(MUSIC_VOLUME_KEY);
    const v = raw == null ? DEFAULT_VOLUME : Number(raw);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULT_VOLUME;
  }

  function syncMusicVolumeUi(volume: number): void {
    const pct = Math.round(volume * 100);
    const slider = document.getElementById("settings-music-volume") as HTMLInputElement | null;
    const label = document.getElementById("settings-music-volume-value");
    if (slider) slider.value = String(pct);
    if (label) label.textContent = `${pct}%`;
  }

  function syncNegrovEnabledUi(enabled: boolean): void {
    const checkbox = document.getElementById("settings-negrov-enabled") as HTMLInputElement | null;
    if (!checkbox) return;
    const playlist = isPlaylistMode();
    checkbox.checked = !!enabled;
    checkbox.disabled = !playlist;
    checkbox.closest(".settings-row")?.classList.toggle("settings-row--disabled", !playlist);
  }

  function populateMusicTrackSelect(): void {
    const select = document.getElementById("settings-music-track") as HTMLSelectElement | null;
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
    const select = document.getElementById("settings-music-track") as HTMLSelectElement | null;
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

  function applyMusicVolume(volume: number): void {
    if (musicAudio) musicAudio.volume = volume;
    syncMusicVolumeUi(volume);
  }

  function setMusicVolume(volume: number): number {
    const clamped = Math.max(0, Math.min(1, volume));
    localStorage.setItem(MUSIC_VOLUME_KEY, String(clamped));
    applyMusicVolume(clamped);
    return clamped;
  }

  function setMusicTrack(trackId: string, options: SetMusicTrackOptions = {}): string {
    const meta = getMusicTrackMeta(trackId);
    const id = meta?.id || PLAYLIST_TRACK_ID;
    try {
      localStorage.setItem(MUSIC_TRACK_KEY, id);
    } catch (_) { /* ignore */ }

    syncMusicTrackSettingsUi();
    updateMusicLoopMode();

    if (!musicAudio) return id;

    const wasPlaying = musicStarted && !musicAudio.paused;
    currentTrackIndex = 0;
    playTrack(0, options.autoplay !== false && (wasPlaying || musicStarted));
    return id;
  }

  function setNegrovEnabled(enabled: boolean): boolean {
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

  function playTrack(index: number, autoplay = false): void {
    const playlist = getMusicPlaylist();
    if (!musicAudio || !playlist.length) return;
    currentTrackIndex = ((index % playlist.length) + playlist.length) % playlist.length;
    musicAudio.src = playlist[currentTrackIndex];
    updateMusicLoopMode();
    musicAudio.load();
    if (!autoplay) return;
    const playPromise = musicAudio.play();
    if (!playPromise) return;
    playPromise.catch(() => {});
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

  function initMusicTrackControls() {
    populateMusicTrackSelect();
    syncMusicTrackSettingsUi();

    const select = document.getElementById("settings-music-track") as HTMLSelectElement | null;
    select?.addEventListener("change", (e) => {
      const target = e.target as HTMLSelectElement;
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
