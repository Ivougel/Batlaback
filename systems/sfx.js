/**
 * Системные звуки игры (Web Audio API, процедурный синтез).
 * Громкость: localStorage bb-sfx-volume · разблокировка после первого жеста.
 */
(function initGameSfx() {
  const SFX_VOLUME_KEY = "bb-sfx-volume";
  const DEFAULT_VOLUME = 0.75;

  let ctx = null;
  let master = null;
  let unlocked = false;
  let unlockBound = false;
  const lastAt = new Map();

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
    if (c.state === "suspended") c.resume().catch(() => {});
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
    attack = 0.008,
    decay = 0.85,
    detune = 0,
    pan = 0,
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
    const peak = Math.max(0.0001, volume * getSfxVolume());
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack + 0.01, duration * decay));
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
    const peak = Math.max(0.0001, volume * getSfxVolume());
    gain.gain.setValueAtTime(peak, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
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
        ...opts,
      }), i * gap * 1000);
    });
  }

  const SFX = {
    ui_click() {
      tone(640, 0.05, { volume: 0.07, type: "triangle" });
    },
    ui_toggle() {
      tone(480, 0.04, { volume: 0.06, type: "square" });
      window.setTimeout(() => tone(620, 0.05, { volume: 0.055, type: "triangle" }), 35);
    },
    ui_open() {
      tone(380, 0.06, { volume: 0.06, type: "sine" });
      window.setTimeout(() => tone(520, 0.07, { volume: 0.065, type: "triangle" }), 40);
    },
    ui_close() {
      tone(520, 0.05, { volume: 0.055, type: "triangle" });
      window.setTimeout(() => tone(360, 0.07, { volume: 0.05, type: "sine" }), 35);
    },
    ui_error() {
      tone(220, 0.1, { volume: 0.09, type: "sawtooth" });
      window.setTimeout(() => tone(180, 0.12, { volume: 0.08, type: "sawtooth" }), 60);
    },

    prep_pickup() {
      tone(420, 0.07, { volume: 0.065, type: "triangle" });
      window.setTimeout(() => tone(560, 0.06, { volume: 0.05, type: "sine" }), 30);
    },
    prep_place(opts = {}) {
      const heavy = !!opts.heavy;
      tone(heavy ? 180 : 240, heavy ? 0.14 : 0.1, { volume: heavy ? 0.1 : 0.08, type: "sine" });
      noiseBurst(heavy ? 0.06 : 0.04, { volume: heavy ? 0.05 : 0.035, freq: heavy ? 500 : 700 });
    },
    prep_reject() {
      tone(160, 0.08, { volume: 0.08, type: "sawtooth" });
      window.setTimeout(() => tone(130, 0.1, { volume: 0.07, type: "square" }), 45);
    },
    prep_buy() {
      arpeggio([880, 1100, 1320], 0.045, { volume: 0.075, type: "sine" });
    },
    prep_sell() {
      arpeggio([660, 520, 390], 0.05, { volume: 0.07, type: "triangle" });
    },
    prep_refresh() {
      arpeggio([440, 554, 659, 880], 0.04, { volume: 0.065, type: "triangle" });
    },
    prep_freeze() {
      tone(1200, 0.06, { volume: 0.05, type: "sine" });
      window.setTimeout(() => tone(900, 0.08, { volume: 0.045, type: "triangle" }), 40);
    },
    prep_rotate() {
      tone(500, 0.04, { volume: 0.055, type: "triangle", detune: -30 });
      window.setTimeout(() => tone(680, 0.05, { volume: 0.05, type: "sine", detune: 20 }, 25));
    },
    prep_craft() {
      arpeggio([523, 659, 784, 1047], 0.055, { volume: 0.08, type: "sine" });
      window.setTimeout(() => noiseBurst(0.08, { volume: 0.04, freq: 1400, q: 1.2 }), 180);
    },
    prep_gem() {
      arpeggio([988, 1319, 1568], 0.05, { volume: 0.075, type: "triangle" });
    },
    gold() {
      arpeggio([988, 1319], 0.04, { volume: 0.07, type: "sine" });
    },

    arc_hover() {
      tone(440, 0.1, { volume: 0.028, type: "sine" });
      window.setTimeout(() => tone(620, 0.08, { volume: 0.02, type: "sine" }), 40);
    },
    arc_begin() {
      SFX.arc_hover();
    },
    arc_celebrate() {
      tone(740, 0.1, { volume: 0.032, type: "triangle" });
      window.setTimeout(() => tone(980, 0.12, { volume: 0.028, type: "sine" }), 55);
      window.setTimeout(() => tone(1180, 0.08, { volume: 0.018, type: "sine" }), 110);
    },

    battle_start() {
      arpeggio([220, 277, 330, 440], 0.07, { volume: 0.09, type: "square" });
    },
    battle_countdown_tick() {
      tone(520, 0.07, { volume: 0.08, type: "square" });
    },
    battle_countdown_go() {
      arpeggio([440, 554, 659], 0.045, { volume: 0.1, type: "triangle" });
      noiseBurst(0.05, { volume: 0.045, freq: 800 });
    },
    battle_hit(opts = {}) {
      const amt = Number(opts.amount) || 1;
      const heavy = amt >= 8;
      const base = heavy ? 140 : 200;
      tone(base, heavy ? 0.12 : 0.08, { volume: heavy ? 0.1 : 0.075, type: "square" });
      noiseBurst(heavy ? 0.07 : 0.045, { volume: heavy ? 0.07 : 0.05, freq: heavy ? 600 : 900 });
    },
    battle_heal(opts = {}) {
      const amt = Math.min(3, 1 + Math.floor((Number(opts.amount) || 1) / 10));
      arpeggio([523, 659, 784].slice(0, amt), 0.05, { volume: 0.065, type: "sine" });
    },
    battle_block() {
      tone(1800, 0.05, { volume: 0.06, type: "triangle" });
      window.setTimeout(() => tone(1200, 0.07, { volume: 0.05, type: "sine" }), 25);
    },
    battle_poison() {
      tone(280, 0.12, { volume: 0.07, type: "sawtooth" });
      window.setTimeout(() => tone(240, 0.14, { volume: 0.06, type: "triangle", detune: -40 }), 70);
    },
    battle_miss() {
      tone(300, 0.06, { volume: 0.045, type: "triangle" });
    },
    battle_victory() {
      arpeggio([523, 659, 784, 1047, 1319], 0.08, { volume: 0.085, type: "triangle" });
    },
    battle_defeat() {
      arpeggio([392, 349, 311, 262], 0.1, { volume: 0.08, type: "sawtooth" });
    },
    battle_draw() {
      arpeggio([440, 440, 415], 0.12, { volume: 0.07, type: "sine" });
    },
  };

  const RATE_LIMITS = {
    battle_hit: 40,
    battle_heal: 55,
    battle_block: 70,
    battle_poison: 90,
    battle_miss: 80,
    arc_hover: 120,
    ui_click: 60,
  };

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

  function initGameSfx() {
    bindUnlock();
    syncSfxVolumeUi(getSfxVolume());
  }

  window.getSfxVolume = getSfxVolume;
  window.setSfxVolume = setSfxVolume;
  window.syncSfxVolumeUi = syncSfxVolumeUi;
  window.playGameSfx = playGameSfx;
  window.GameSfx = { play: playGameSfx, getVolume: getSfxVolume, setVolume: setSfxVolume };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGameSfx);
  } else {
    initGameSfx();
  }
})();
