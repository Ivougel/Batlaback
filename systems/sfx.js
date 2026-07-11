// Transpiled from TypeScript — npm run compile:ts

(function initGameSfx() {
  const SFX_VOLUME_KEY = "bb-sfx-volume";
  const DEFAULT_VOLUME = 0.75;
  const SFX_PRESET_GAIN = 1.5;
  let ctx = null;
  let master = null;
  let unlocked = false;
  let unlockBound = false;
  const lastAt = /* @__PURE__ */ new Map();
  function getSfxVolume() {
    const raw = localStorage.getItem(SFX_VOLUME_KEY);
    const v = raw == null ? DEFAULT_VOLUME : Number(raw);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULT_VOLUME;
  }
  function applyMasterVolume() {
    if (master) master.gain.value = getSfxVolume();
  }
  function setSfxVolume(volume) {
    const clamped = Math.max(0, Math.min(1, volume));
    localStorage.setItem(SFX_VOLUME_KEY, String(clamped));
    applyMasterVolume();
    syncSfxVolumeUi(clamped);
    return clamped;
  }
  function syncSfxVolumeUi(volume) {
    const pct = Math.round(volume * 100);
    const slider = document.getElementById("settings-sfx-volume");
    const label = document.getElementById("settings-sfx-volume-value");
    if (slider) slider.value = String(pct);
    if (label) label.textContent = `${pct}%`;
  }
  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    applyMasterVolume();
    master.connect(ctx.destination);
    return ctx;
  }
  function unlockAudio() {
    const c = ensureCtx();
    if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => {
    });
    unlocked = true;
  }
  function bindUnlock() {
    if (unlockBound) return;
    unlockBound = true;
    const unlock = () => unlockAudio();
    document.addEventListener("pointerdown", unlock, { passive: true });
    document.addEventListener("keydown", unlock);
    document.addEventListener("touchstart", unlock, { passive: true });
  }
  function canPlay(id, minGapMs = 45) {
    const now = performance.now();
    const prev = lastAt.get(id) || 0;
    if (now - prev < minGapMs) return false;
    lastAt.set(id, now);
    return true;
  }
  function tone(freq, duration, {
    type = "sine",
    volume = 0.12,
    attack = 8e-3,
    decay = 0.85,
    detune = 0,
    pan = 0
  } = {}) {
    const c = ensureCtx();
    if (!c || !master || getSfxVolume() <= 0) return;
    unlockAudio();
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    const panner = c.createStereoPanner?.() || null;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (detune) osc.detune.setValueAtTime(detune, t0);
    const peak = Math.max(1e-4, volume * SFX_PRESET_GAIN);
    gain.gain.setValueAtTime(1e-4, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(1e-4, t0 + Math.max(attack + 0.01, duration * decay));
    osc.connect(gain);
    if (panner) {
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(master);
    } else {
      gain.connect(master);
    }
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }
  function noiseBurst(duration, { volume = 0.08, freq = 900, q = 0.7 } = {}) {
    const c = ensureCtx();
    if (!c || !master || getSfxVolume() <= 0) return;
    unlockAudio();
    const t0 = c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * duration));
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = c.createGain();
    const peak = Math.max(1e-4, volume * SFX_PRESET_GAIN);
    gain.gain.setValueAtTime(peak, t0);
    gain.gain.exponentialRampToValueAtTime(1e-4, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }
  function arpeggio(notes, gap = 0.055, opts = {}) {
    notes.forEach((freq, i) => {
      window.setTimeout(() => tone(freq, opts.duration || 0.11, {
        volume: opts.volume || 0.09,
        type: opts.type || "triangle",
        ...opts
      }), i * gap * 1e3);
    });
  }
  let SFX = {};
  function rebuildGameSfxTheme(themeId) {
    const build = SfxThemes?.build;
    if (typeof build !== "function") return;
    SFX = build(themeId, { tone, noiseBurst, arpeggio });
    if (document.documentElement) {
      document.documentElement.dataset.soundTheme = themeId;
    }
  }
  function readInitialSoundThemeId() {
    try {
      const stored = localStorage.getItem("bb-sound-theme");
      if (stored && SfxThemes?.META?.[stored]) return stored;
    } catch (_) {
    }
    return SfxThemes?.defaultId || "classic";
  }
  rebuildGameSfxTheme(readInitialSoundThemeId());
  const RATE_LIMITS = {
    battle_hit: 40,
    battle_heal: 55,
    battle_block: 70,
    battle_poison: 90,
    battle_miss: 80,
    thought_nod: 220,
    thought_bounce: 200,
    thought_wobble: 180,
    thought_pop: 200,
    thought_whoosh: 220,
    thought_dance: 280,
    thought_sparkle: 220,
    thought_reply: 200,
    prep_shop_open: 280,
    prep_shop_close: 220,
    prep_bench_open: 280,
    prep_bench_close: 220,
    prep_doll_open: 260,
    prep_doll_close: 220,
    prep_recipe_open: 260,
    prep_recipe_close: 220,
    prep_enh_equip: 200,
    prep_enh_equip_epic: 320,
    prep_enh_equip_legendary: 420,
    prep_enh_unequip: 180,
    prep_enh_buy: 200,
    prep_enh_buy_epic: 300,
    prep_enh_buy_legendary: 400,
    prep_buy_rare: 220,
    prep_buy_epic: 300,
    prep_buy_legendary: 400,
    ui_confirm: 200,
    arc_hover: 120,
    ui_hover: 85,
    ui_click: 60,
    ui_toggle: 60,
    ui_open: 70,
    ui_close: 70
  };
  const NAV_SFX_SELECTOR = [
    "button:not([disabled])",
    "[role='button']:not([aria-disabled='true'])",
    ".doll-slot",
    "select:not([disabled])",
    "a[href]:not([aria-disabled='true'])"
  ].join(", ");
  const BUTTON_SFX_SELECTOR = NAV_SFX_SELECTOR;
  const BUTTON_SFX_SKIP_SELECTOR = [
    ".shop-card:not(.empty)",
    ".bench-card",
    ".shop-pin",
    "#btn-refresh",
    "#sell-drop-zone",
    "#btn-prep-sell-fab",
    "#btn-fight"
  ].join(", ");
  const BUTTON_SFX_CLOSE_RE = /(?:close|закрыть|✕|×)/i;
  const BUTTON_SFX_CLOSE_CLASS_RE = /(?:^|\s|-)(?:[\w-]*-close|btn-close|settings-close|recipe-book-close|board-preview-close|battle-detail-close|prep-shop-drawer-close)(?:\s|$)/;
  function isInteractiveDisabled(el) {
    if (!el) return true;
    if (el instanceof HTMLButtonElement && el.disabled) return true;
    if (el instanceof HTMLInputElement && el.disabled) return true;
    if (el instanceof HTMLSelectElement && el.disabled) return true;
    if (el.getAttribute("aria-disabled") === "true") return true;
    if (el.classList.contains("disabled")) return true;
    return false;
  }
  function resolveButtonSfx(el) {
    if (!el || isInteractiveDisabled(el)) return null;
    const sfxHost = el.closest("[data-sfx]");
    const explicit = sfxHost?.dataset.sfx;
    if (explicit === "none") return null;
    if (explicit && SFX[explicit]) return explicit;
    if (el.matches(BUTTON_SFX_SKIP_SELECTOR)) return null;
    const id = el instanceof HTMLElement ? el.id : "";
    const cls = el instanceof HTMLElement && typeof el.className === "string" ? el.className : "";
    const label = `${el.getAttribute("aria-label") || ""} ${el instanceof HTMLElement ? el.title : ""} ${el.textContent || ""}`.trim().toLowerCase();
    if (BUTTON_SFX_CLOSE_RE.test(label) || BUTTON_SFX_CLOSE_CLASS_RE.test(cls)) {
      return "ui_close";
    }
    if (id === "btn-escape-resume") return "ui_close";
    if (el.matches("select")) {
      return "ui_toggle";
    }
    if (el.hasAttribute("aria-expanded") || el.hasAttribute("aria-pressed") || el.classList.contains("prep-side-btn") || el.classList.contains("bc-speed") || id === "btn-battle-pause" || id === "btn-lobby-roster-hide" || id === "btn-combat-feed" || el.classList.contains("combat-feed-toggle") || el.classList.contains("shop-pin")) {
      return "ui_toggle";
    }
    return "ui_click";
  }
  function findButtonSfxTarget(target) {
    if (!(target instanceof Element)) return null;
    const el = target.closest(BUTTON_SFX_SELECTOR);
    if (!el || isInteractiveDisabled(el)) return null;
    return el;
  }
  function playButtonSfx(target) {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    const host = el instanceof Element ? el.closest(BUTTON_SFX_SELECTOR) || el : el;
    const sfxId = resolveButtonSfx(host);
    if (!sfxId) return false;
    return playGameSfx(sfxId);
  }
  function playUiHoverSfx(target) {
    if (typeof SFX.ui_hover !== "function") return false;
    const el = findButtonSfxTarget(target);
    if (!el) return false;
    return playGameSfx("ui_hover");
  }
  let lastPointerDownAt = 0;
  function bindGlobalButtonSfx() {
    document.addEventListener("pointerdown", (event) => {
      lastPointerDownAt = performance.now();
      if (event.button !== 0) return;
      const target = findButtonSfxTarget(event.target);
      if (!target) return;
      playButtonSfx(target);
    }, { capture: true, passive: true });
    document.addEventListener("pointerover", (event) => {
      if (event.pointerType !== "mouse") return;
      const target = findButtonSfxTarget(event.target);
      if (!target) return;
      if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
      if (performance.now() - lastPointerDownAt < 80) return;
      playUiHoverSfx(target);
    }, { capture: true, passive: true });
    document.addEventListener("focusin", (event) => {
      const target = findButtonSfxTarget(event.target);
      if (!target) return;
      if (performance.now() - lastPointerDownAt < 140) return;
      playUiHoverSfx(target);
    }, { capture: true });
    document.addEventListener("change", (event) => {
      const input = event.target;
      if (input instanceof HTMLSelectElement) {
        playGameSfx("ui_click");
        return;
      }
      if (!(input instanceof HTMLInputElement)) return;
      if (input.type === "checkbox" || input.type === "radio") {
        playGameSfx("ui_toggle");
        return;
      }
      if (input.type === "range") {
        playGameSfx("ui_click");
      }
    }, { capture: true });
  }
  function playGameSfx(id, options = {}) {
    if (!id || getSfxVolume() <= 0) return false;
    const fn = SFX[id];
    if (typeof fn !== "function") return false;
    const gap = RATE_LIMITS[id] ?? 45;
    if (!canPlay(id, gap)) return false;
    try {
      fn(options);
      return true;
    } catch (_) {
      return false;
    }
  }
  function initGameSfx2() {
    bindUnlock();
    bindGlobalButtonSfx();
    syncSfxVolumeUi(getSfxVolume());
  }
  window.getSfxVolume = getSfxVolume;
  window.setSfxVolume = setSfxVolume;
  window.syncSfxVolumeUi = syncSfxVolumeUi;
  window.playGameSfx = playGameSfx;
  window.playButtonSfx = playButtonSfx;
  window.rebuildGameSfxTheme = rebuildGameSfxTheme;
  window.GameSfx = {
    play: playGameSfx,
    playButton: playButtonSfx,
    getVolume: getSfxVolume,
    setVolume: setSfxVolume,
    rebuildTheme: rebuildGameSfxTheme
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGameSfx2);
  } else {
    initGameSfx2();
  }
})();
