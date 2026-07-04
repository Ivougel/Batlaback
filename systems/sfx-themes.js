/**
 * Шаблоны звукового оформления (процедурные SFX).
 *
 * Исследование «дофаминового» звука (juicy audio):
 * - Короткие микро-награды 100–300 ms — мгновенная обратная связь (HCI: curiosity/competence).
 * - Восходящий pitch = прогресс и успех; нисходящий = ошибка/потеря.
 * - Мажорные арпеджио на покупках, крафте, победе — «slot-machine» без перегруза.
 * - Слои: тон + высокочастотный шум-«блеск» на вехах, не на каждом клике.
 * - Яркие sine/triangle вместо грубого square; громче только на наградах.
 * - Стерео-pan на монетах/покупках — ширина без усталости.
 *
 * @see https://doi.org/10.1145/3677084 (Juicy Audio)
 */
(function initSfxThemes(global) {
  /** @param {{ tone: Function, noiseBurst: Function, arpeggio: Function }} api */
  function buildClassicSfx(api) {
    const { tone, noiseBurst, arpeggio } = api;
    const sfx = {};

    Object.assign(sfx, {
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
        window.setTimeout(() => tone(680, 0.05, { volume: 0.05, type: "sine", detune: 20 }), 25);
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
      ui_hover() {
        tone(520, 0.04, { volume: 0.016, type: "sine", attack: 0.002, decay: 0.6 });
      },
      arc_begin() {
        sfx.arc_hover();
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
    });

    return sfx;
  }

  /** @param {{ tone: Function, noiseBurst: Function, arpeggio: Function }} api */
  function buildDopamineSfx(api) {
    const { tone, noiseBurst, arpeggio } = api;
    const sfx = {};

    function sparkle(delayMs = 0, opts = {}) {
      window.setTimeout(() => {
        noiseBurst(opts.duration || 0.06, {
          volume: opts.volume || 0.035,
          freq: opts.freq || 2200,
          q: opts.q || 1.4,
        });
      }, delayMs);
    }

    Object.assign(sfx, {
      ui_click() {
        tone(784, 0.055, { volume: 0.075, type: "sine" });
        window.setTimeout(() => tone(988, 0.045, { volume: 0.06, type: "triangle", pan: 0.12 }), 28);
      },
      ui_toggle() {
        tone(659, 0.04, { volume: 0.065, type: "sine" });
        window.setTimeout(() => tone(880, 0.05, { volume: 0.07, type: "triangle", pan: -0.1 }), 32);
      },
      ui_open() {
        arpeggio([523, 659, 784], 0.032, { volume: 0.065, type: "sine", duration: 0.08 });
      },
      ui_close() {
        tone(698, 0.05, { volume: 0.055, type: "triangle" });
        window.setTimeout(() => tone(440, 0.07, { volume: 0.05, type: "sine" }), 30);
      },
      ui_error() {
        tone(330, 0.07, { volume: 0.07, type: "triangle" });
        window.setTimeout(() => tone(247, 0.09, { volume: 0.06, type: "sine" }), 45);
      },

      prep_pickup() {
        tone(587, 0.06, { volume: 0.07, type: "sine", pan: -0.15 });
        window.setTimeout(() => tone(784, 0.055, { volume: 0.065, type: "triangle", pan: 0.15 }), 25);
      },
      prep_place(opts = {}) {
        const heavy = !!opts.heavy;
        tone(heavy ? 196 : 262, heavy ? 0.1 : 0.08, { volume: heavy ? 0.095 : 0.078, type: "sine" });
        window.setTimeout(() => {
          tone(heavy ? 392 : 523, heavy ? 0.09 : 0.07, {
            volume: heavy ? 0.06 : 0.045,
            type: "triangle",
          });
        }, heavy ? 35 : 22);
        noiseBurst(heavy ? 0.05 : 0.035, { volume: heavy ? 0.045 : 0.03, freq: heavy ? 1100 : 1600, q: 1.1 });
      },
      prep_reject() {
        tone(349, 0.06, { volume: 0.07, type: "triangle" });
        window.setTimeout(() => tone(262, 0.08, { volume: 0.06, type: "sine" }), 40);
      },
      prep_buy() {
        arpeggio([659, 784, 988, 1175, 1319], 0.034, { volume: 0.085, type: "sine", duration: 0.09 });
        sparkle(140, { volume: 0.04, freq: 2400 });
      },
      prep_sell() {
        arpeggio([587, 494, 392], 0.042, { volume: 0.065, type: "triangle", duration: 0.09 });
      },
      prep_refresh() {
        arpeggio([523, 659, 784, 988, 1175], 0.032, { volume: 0.07, type: "sine" });
        sparkle(120, { volume: 0.03 });
      },
      prep_freeze() {
        tone(1568, 0.05, { volume: 0.055, type: "sine" });
        window.setTimeout(() => tone(1175, 0.07, { volume: 0.048, type: "triangle" }), 28);
        sparkle(50, { volume: 0.025, freq: 2800, duration: 0.05 });
      },
      prep_rotate() {
        tone(523, 0.035, { volume: 0.06, type: "sine", detune: -20 });
        window.setTimeout(() => tone(740, 0.045, { volume: 0.058, type: "triangle", detune: 15 }), 22);
      },
      prep_craft() {
        arpeggio([523, 659, 784, 988, 1175, 1319], 0.042, { volume: 0.088, type: "sine", duration: 0.1 });
        sparkle(200, { volume: 0.045, freq: 2600 });
        sparkle(280, { volume: 0.03, freq: 3000, duration: 0.07 });
      },
      prep_gem() {
        arpeggio([1175, 1568, 1976], 0.038, { volume: 0.082, type: "triangle" });
        sparkle(90, { volume: 0.038, freq: 2800 });
      },
      gold() {
        arpeggio([1319, 1568, 1760], 0.032, { volume: 0.08, type: "sine", duration: 0.085 });
        sparkle(70, { volume: 0.035, freq: 2500 });
        tone(1760, 0.06, { volume: 0.045, type: "triangle", pan: 0.2 });
      },

      arc_hover() {
        tone(523, 0.08, { volume: 0.024, type: "sine" });
        window.setTimeout(() => tone(659, 0.07, { volume: 0.018, type: "sine" }), 35);
      },
      ui_hover() {
        tone(784, 0.035, { volume: 0.018, type: "sine", attack: 0.002, decay: 0.58 });
      },
      arc_begin() {
        sfx.arc_hover();
      },
      arc_celebrate() {
        arpeggio([659, 784, 988], 0.04, { volume: 0.03, type: "triangle", duration: 0.09 });
        sparkle(100, { volume: 0.02, freq: 2000 });
      },

      battle_start() {
        arpeggio([262, 330, 392, 523], 0.055, { volume: 0.088, type: "triangle" });
        noiseBurst(0.04, { volume: 0.035, freq: 700 });
      },
      battle_countdown_tick() {
        tone(698, 0.055, { volume: 0.075, type: "sine" });
      },
      battle_countdown_go() {
        arpeggio([523, 659, 784, 988], 0.038, { volume: 0.095, type: "triangle" });
        noiseBurst(0.045, { volume: 0.04, freq: 1200, q: 1.2 });
      },
      battle_hit(opts = {}) {
        const amt = Number(opts.amount) || 1;
        const heavy = amt >= 8;
        const base = heavy ? 165 : 220;
        tone(base, heavy ? 0.09 : 0.065, { volume: heavy ? 0.095 : 0.072, type: "triangle" });
        window.setTimeout(() => {
          tone(heavy ? 110 : 150, heavy ? 0.08 : 0.055, {
            volume: heavy ? 0.06 : 0.04,
            type: "sine",
          });
        }, 18);
        noiseBurst(heavy ? 0.055 : 0.038, { volume: heavy ? 0.055 : 0.038, freq: heavy ? 900 : 1300 });
      },
      battle_heal(opts = {}) {
        const amt = Math.min(4, 2 + Math.floor((Number(opts.amount) || 1) / 8));
        arpeggio([523, 659, 784, 988].slice(0, amt), 0.042, { volume: 0.072, type: "sine" });
      },
      battle_block() {
        tone(2093, 0.045, { volume: 0.065, type: "triangle" });
        window.setTimeout(() => tone(1568, 0.06, { volume: 0.052, type: "sine" }), 20);
      },
      battle_poison() {
        tone(311, 0.09, { volume: 0.065, type: "triangle", detune: -30 });
        window.setTimeout(() => tone(277, 0.1, { volume: 0.055, type: "sine" }), 55);
      },
      battle_miss() {
        tone(392, 0.05, { volume: 0.04, type: "sine" });
      },
      battle_victory() {
        arpeggio([523, 659, 784, 988, 1175, 1319, 1568], 0.065, { volume: 0.09, type: "triangle", duration: 0.12 });
        sparkle(350, { volume: 0.04, freq: 2400, duration: 0.1 });
        sparkle(500, { volume: 0.03, freq: 2800, duration: 0.08 });
      },
      battle_defeat() {
        arpeggio([440, 392, 349, 311], 0.085, { volume: 0.072, type: "sine", duration: 0.11 });
      },
      battle_draw() {
        arpeggio([440, 415, 392], 0.1, { volume: 0.065, type: "sine" });
      },
    });

    return sfx;
  }

  /** @param {{ tone: Function, noiseBurst: Function, arpeggio: Function }} api */
  function buildGentleSfx(api) {
    const { tone, noiseBurst, arpeggio } = api;
    const sfx = {};

    // 67 BPM — в такт фоновой музыке (девчачья, мягкая)
    const BEAT = 60 / 67;
    const HALF = BEAT / 2;
    const QUARTER = BEAT / 4;
    const EIGHTH = BEAT / 8;

    const SINE = "sine";
    const bell = { type: SINE, attack: 0.028, volume: 0.048 };

    // G major / пентатоника — тёплый «музыкальный ящик»
    const motif = [392, 494, 587, 784];

    function gentleTone(freq, duration, opts = {}) {
      tone(freq, duration, {
        type: SINE,
        attack: 0.022,
        decay: 0.92,
        volume: 0.05,
        ...opts,
      });
    }

    function gentleArp(notes, gap = EIGHTH, opts = {}) {
      arpeggio(notes, gap, {
        type: SINE,
        attack: 0.024,
        volume: 0.052,
        duration: QUARTER * 1.1,
        ...opts,
      });
    }

    Object.assign(sfx, {
      ui_click() {
        gentleTone(523, QUARTER, { volume: 0.05, attack: 0.02 });
        window.setTimeout(() => gentleTone(659, EIGHTH * 1.2, { volume: 0.042, pan: 0.08 }), EIGHTH * 0.9);
      },
      ui_toggle() {
        gentleTone(440, EIGHTH, { volume: 0.048 });
        window.setTimeout(() => gentleTone(523, QUARTER, { volume: 0.05 }), QUARTER * 0.85);
      },
      ui_open() {
        gentleArp([392, 494, 587], EIGHTH, { volume: 0.048 });
      },
      ui_close() {
        gentleTone(587, QUARTER, { volume: 0.045 });
        window.setTimeout(() => gentleTone(494, HALF * 0.7, { volume: 0.04 }), QUARTER);
      },
      ui_error() {
        gentleTone(349, HALF * 0.55, { volume: 0.05, detune: -8 });
        window.setTimeout(() => gentleTone(311, HALF * 0.65, { volume: 0.042, detune: -12 }), QUARTER);
      },

      prep_pickup() {
        gentleTone(494, QUARTER, bell);
        window.setTimeout(() => gentleTone(587, QUARTER, { volume: 0.046, pan: 0.1 }), EIGHTH);
      },
      prep_place(opts = {}) {
        const heavy = !!opts.heavy;
        gentleTone(heavy ? 196 : 262, heavy ? HALF * 0.7 : QUARTER * 1.2, {
          volume: heavy ? 0.058 : 0.048,
          attack: 0.03,
        });
        if (heavy) {
          window.setTimeout(() => gentleTone(392, QUARTER, { volume: 0.038 }), EIGHTH);
        }
      },
      prep_reject() {
        gentleTone(415, QUARTER, { volume: 0.048 });
        window.setTimeout(() => gentleTone(370, HALF * 0.6, { volume: 0.04 }), QUARTER);
      },
      prep_buy() {
        gentleArp(motif, EIGHTH, { volume: 0.058, duration: QUARTER * 1.15 });
      },
      prep_sell() {
        gentleArp([587, 494, 392], EIGHTH * 1.1, { volume: 0.045 });
      },
      prep_refresh() {
        gentleArp([392, 440, 494, 587], EIGHTH, { volume: 0.05 });
      },
      prep_freeze() {
        gentleTone(880, QUARTER, { volume: 0.044, attack: 0.03 });
        window.setTimeout(() => gentleTone(784, HALF * 0.55, { volume: 0.038 }), QUARTER);
      },
      prep_rotate() {
        gentleTone(440, EIGHTH, { volume: 0.045, detune: -10 });
        window.setTimeout(() => gentleTone(523, QUARTER, { volume: 0.046, detune: 8 }), EIGHTH);
      },
      prep_craft() {
        gentleArp([392, 494, 587, 659, 784], EIGHTH, { volume: 0.055, duration: QUARTER * 1.2 });
      },
      prep_gem() {
        gentleArp([659, 784, 988], EIGHTH * 1.05, { volume: 0.054 });
      },
      gold() {
        gentleArp([587, 740, 880], EIGHTH, { volume: 0.056 });
        window.setTimeout(() => gentleTone(988, QUARTER, { volume: 0.038, pan: 0.12 }), HALF * 0.9);
      },

      arc_hover() {
        gentleTone(440, QUARTER, { volume: 0.018, attack: 0.03 });
      },
      ui_hover() {
        gentleTone(587, EIGHTH * 0.9, { volume: 0.014, attack: 0.018 });
      },
      arc_begin() {
        sfx.arc_hover();
      },
      arc_celebrate() {
        gentleArp([494, 587, 659], EIGHTH * 1.1, { volume: 0.026, duration: QUARTER });
      },

      battle_start() {
        gentleArp([262, 330, 392, 494], QUARTER * 0.9, { volume: 0.055, type: "triangle" });
      },
      battle_countdown_tick() {
        gentleTone(523, EIGHTH * 1.1, { volume: 0.05, type: "triangle" });
      },
      battle_countdown_go() {
        gentleArp([392, 494, 587, 659], EIGHTH, { volume: 0.058 });
      },
      battle_hit(opts = {}) {
        const amt = Number(opts.amount) || 1;
        const heavy = amt >= 8;
        gentleTone(heavy ? 165 : 220, heavy ? QUARTER : EIGHTH * 1.2, {
          volume: heavy ? 0.055 : 0.042,
          type: "triangle",
          attack: 0.015,
        });
      },
      battle_heal(opts = {}) {
        const amt = Math.min(3, 1 + Math.floor((Number(opts.amount) || 1) / 12));
        gentleArp([523, 659, 784].slice(0, amt), EIGHTH * 1.15, { volume: 0.05 });
      },
      battle_block() {
        gentleTone(1047, EIGHTH, { volume: 0.045, attack: 0.018 });
        window.setTimeout(() => gentleTone(784, QUARTER, { volume: 0.038 }), EIGHTH);
      },
      battle_poison() {
        gentleTone(311, HALF * 0.55, { volume: 0.045, detune: -15 });
      },
      battle_miss() {
        gentleTone(370, EIGHTH, { volume: 0.035 });
      },
      battle_victory() {
        gentleArp([392, 494, 587, 659, 784, 988], EIGHTH * 1.05, {
          volume: 0.06,
          duration: QUARTER * 1.25,
        });
      },
      battle_defeat() {
        gentleArp([440, 392, 349, 311], QUARTER * 0.95, { volume: 0.048, duration: HALF * 0.55 });
      },
      battle_draw() {
        gentleArp([440, 415], HALF * 0.85, { volume: 0.045, duration: QUARTER });
      },
    });

    return sfx;
  }

  /** Diablo — мокрое мясо, капли, тяжёлые удары. */
  function buildMeatSfx(api) {
    const { tone, noiseBurst, arpeggio } = api;
    const sfx = {};

    function squelch(vol = 0.075, heavy = false) {
      const base = heavy ? 68 : 88;
      tone(base, heavy ? 0.11 : 0.07, { volume: vol, type: "sawtooth", attack: 0.002, decay: 0.78 });
      noiseBurst(heavy ? 0.08 : 0.055, { volume: vol * 0.85, freq: heavy ? 220 : 320, q: 2.2 });
      window.setTimeout(() => {
        tone(base * 0.62, heavy ? 0.14 : 0.09, { volume: vol * 0.55, type: "sine", attack: 0.004 });
      }, heavy ? 35 : 22);
    }

    function drip(delayMs = 0, vol = 0.042) {
      window.setTimeout(() => {
        const f = 110 + Math.random() * 55;
        tone(f, 0.045, { volume: vol, type: "triangle", attack: 0.001, decay: 0.72 });
        noiseBurst(0.035, { volume: vol * 0.75, freq: 380 + Math.random() * 120, q: 2.4 });
      }, delayMs);
    }

    function meatHover() {
      drip(0, 0.028);
    }

    Object.assign(sfx, {
      ui_hover() {
        meatHover();
      },
      ui_click() {
        squelch(0.072);
        drip(55, 0.032);
      },
      ui_toggle() {
        squelch(0.068);
        window.setTimeout(() => drip(0, 0.03), 70);
      },
      ui_open() {
        squelch(0.08, true);
        drip(90, 0.038);
        drip(160, 0.028);
      },
      ui_close() {
        tone(140, 0.09, { volume: 0.07, type: "sawtooth", attack: 0.003 });
        noiseBurst(0.07, { volume: 0.06, freq: 260, q: 1.6 });
        window.setTimeout(() => squelch(0.055), 45);
      },
      ui_error() {
        tone(95, 0.14, { volume: 0.085, type: "sawtooth" });
        noiseBurst(0.09, { volume: 0.07, freq: 180, q: 1.2 });
        window.setTimeout(() => tone(72, 0.16, { volume: 0.07, type: "square" }), 80);
      },

      prep_pickup() {
        squelch(0.065);
        drip(40, 0.035);
      },
      prep_place(opts = {}) {
        squelch(opts.heavy ? 0.095 : 0.078, !!opts.heavy);
        if (opts.heavy) drip(120, 0.04);
      },
      prep_reject() {
        tone(110, 0.1, { volume: 0.08, type: "sawtooth" });
        noiseBurst(0.06, { volume: 0.065, freq: 240, q: 1.8 });
      },
      prep_buy() {
        arpeggio([110, 98, 88, 78], 0.07, { volume: 0.07, type: "sawtooth", duration: 0.12 });
        drip(200, 0.038);
        drip(280, 0.03);
      },
      prep_sell() {
        arpeggio([130, 110, 95], 0.08, { volume: 0.065, type: "triangle", duration: 0.1 });
      },
      prep_refresh() {
        squelch(0.06);
        drip(60, 0.032);
        drip(130, 0.028);
      },
      prep_freeze() {
        tone(180, 0.08, { volume: 0.055, type: "triangle" });
        noiseBurst(0.05, { volume: 0.04, freq: 900, q: 1.5 });
      },
      prep_rotate() {
        squelch(0.05);
      },
      prep_craft() {
        squelch(0.082, true);
        drip(80, 0.036);
        drip(150, 0.032);
        drip(230, 0.028);
      },
      prep_gem() {
        tone(220, 0.06, { volume: 0.06, type: "triangle" });
        squelch(0.055);
      },
      gold() {
        arpeggio([98, 110, 124], 0.06, { volume: 0.068, type: "sawtooth" });
        drip(100, 0.035);
      },

      arc_hover() {
        meatHover();
      },
      arc_begin() {
        sfx.arc_hover();
      },
      arc_celebrate() {
        squelch(0.07);
        drip(70, 0.03);
      },

      battle_start() {
        arpeggio([82, 73, 65, 58], 0.09, { volume: 0.09, type: "sawtooth", duration: 0.14 });
        noiseBurst(0.08, { volume: 0.065, freq: 200, q: 1.4 });
      },
      battle_countdown_tick() {
        squelch(0.06);
      },
      battle_countdown_go() {
        squelch(0.095, true);
        drip(60, 0.04);
      },
      battle_hit(opts = {}) {
        const heavy = (Number(opts.amount) || 1) >= 8;
        squelch(heavy ? 0.1 : 0.082, heavy);
        drip(heavy ? 90 : 50, heavy ? 0.045 : 0.035);
      },
      battle_heal() {
        tone(165, 0.08, { volume: 0.05, type: "sine" });
        drip(40, 0.025);
      },
      battle_block() {
        tone(200, 0.05, { volume: 0.065, type: "square" });
        noiseBurst(0.04, { volume: 0.05, freq: 600, q: 1.2 });
      },
      battle_poison() {
        tone(130, 0.12, { volume: 0.07, type: "sawtooth", detune: -20 });
        noiseBurst(0.07, { volume: 0.055, freq: 300, q: 2 });
      },
      battle_miss() {
        drip(0, 0.022);
      },
      battle_victory() {
        arpeggio([98, 110, 124, 147], 0.1, { volume: 0.085, type: "sawtooth", duration: 0.15 });
        drip(300, 0.04);
        drip(420, 0.035);
      },
      battle_defeat() {
        arpeggio([110, 98, 82, 65], 0.11, { volume: 0.08, type: "sawtooth", duration: 0.14 });
      },
      battle_draw() {
        tone(100, 0.12, { volume: 0.065, type: "triangle" });
        drip(80, 0.03);
      },
    });

    return sfx;
  }

  /** Black Mirror — стеклянные тики смартфона, hover на каждой кнопке. */
  function buildMirrorSfx(api) {
    const { tone, noiseBurst, arpeggio } = api;
    const sfx = {};

    function glassTick(freq = 2800, vol = 0.026, pan = 0) {
      tone(freq, 0.022, { volume: vol, type: "sine", attack: 0.0008, decay: 0.58, pan });
      window.setTimeout(() => {
        tone(freq * 1.498, 0.016, { volume: vol * 0.35, type: "sine", attack: 0.0006, decay: 0.5, pan });
      }, 6);
    }

    function glassShimmer(freq = 3200, vol = 0.012) {
      noiseBurst(0.014, { volume: vol, freq, q: 3.2 });
    }

    function mirrorHover() {
      glassTick(3400, 0.018, (Math.random() - 0.5) * 0.25);
      glassShimmer(4200, 0.006);
    }

    function mirrorTap() {
      glassTick(2600, 0.032, 0);
      window.setTimeout(() => tone(1900, 0.038, { volume: 0.022, type: "sine", attack: 0.002, decay: 0.72 }), 14);
      glassShimmer(3600, 0.008);
    }

    function mirrorSlide(open = true) {
      const notes = open ? [1800, 2200, 2600] : [2600, 2200, 1800];
      arpeggio(notes, 0.028, { volume: 0.028, type: "sine", duration: 0.07, attack: 0.002, decay: 0.65 });
      glassShimmer(open ? 5000 : 3800, 0.007);
    }

    Object.assign(sfx, {
      ui_hover() {
        mirrorHover();
      },
      ui_click() {
        mirrorTap();
      },
      ui_toggle() {
        glassTick(2400, 0.028, -0.12);
        window.setTimeout(() => glassTick(2900, 0.026, 0.12), 38);
      },
      ui_open() {
        mirrorSlide(true);
      },
      ui_close() {
        mirrorSlide(false);
      },
      ui_error() {
        glassTick(880, 0.034, 0);
        window.setTimeout(() => glassTick(660, 0.03, 0), 55);
        window.setTimeout(() => tone(520, 0.06, { volume: 0.022, type: "sine" }), 110);
      },

      prep_pickup() {
        glassTick(2200, 0.028, -0.15);
        window.setTimeout(() => glassTick(2800, 0.024, 0.15), 32);
      },
      prep_place(opts = {}) {
        mirrorTap();
        if (opts.heavy) {
          window.setTimeout(() => tone(420, 0.05, { volume: 0.018, type: "sine" }), 20);
        }
      },
      prep_reject() {
        glassTick(700, 0.03);
        window.setTimeout(() => glassTick(550, 0.026), 45);
      },
      prep_buy() {
        arpeggio([2200, 2637, 3136, 3520], 0.032, { volume: 0.032, type: "sine", duration: 0.06, attack: 0.002 });
        glassShimmer(4800, 0.01);
      },
      prep_sell() {
        arpeggio([2800, 2349, 1976], 0.035, { volume: 0.026, type: "sine", duration: 0.065 });
      },
      prep_refresh() {
        arpeggio([2000, 2400, 2800, 3200], 0.028, { volume: 0.028, type: "sine" });
      },
      prep_freeze() {
        glassTick(3800, 0.03);
        glassShimmer(5200, 0.012);
      },
      prep_rotate() {
        glassTick(2100, 0.024, -0.1);
        window.setTimeout(() => glassTick(2500, 0.022, 0.1), 28);
      },
      prep_craft() {
        arpeggio([2200, 2772, 3296, 3920, 4400], 0.034, { volume: 0.034, type: "sine", duration: 0.07 });
        glassShimmer(5500, 0.012);
      },
      prep_gem() {
        arpeggio([3136, 3951, 4699], 0.03, { volume: 0.032, type: "sine" });
        glassShimmer(6000, 0.014);
      },
      gold() {
        arpeggio([3520, 4186, 4978], 0.028, { volume: 0.03, type: "sine" });
        glassTick(5280, 0.022, 0.18);
      },

      arc_hover() {
        mirrorHover();
      },
      arc_begin() {
        sfx.arc_hover();
      },
      arc_celebrate() {
        arpeggio([2800, 3322, 3951], 0.03, { volume: 0.024, type: "sine" });
      },

      battle_start() {
        arpeggio([880, 1108, 1318, 1760], 0.04, { volume: 0.038, type: "sine" });
        glassShimmer(3000, 0.008);
      },
      battle_countdown_tick() {
        glassTick(2000, 0.028);
      },
      battle_countdown_go() {
        arpeggio([1760, 2217, 2637, 3136], 0.028, { volume: 0.038, type: "sine" });
        glassShimmer(4000, 0.01);
      },
      battle_hit(opts = {}) {
        const heavy = (Number(opts.amount) || 1) >= 8;
        tone(heavy ? 320 : 440, heavy ? 0.06 : 0.045, {
          volume: heavy ? 0.038 : 0.028,
          type: "sine",
          attack: 0.002,
        });
        glassTick(heavy ? 1800 : 2400, heavy ? 0.032 : 0.024);
      },
      battle_heal() {
        arpeggio([1760, 2093, 2637], 0.035, { volume: 0.028, type: "sine" });
      },
      battle_block() {
        glassTick(4200, 0.034);
        window.setTimeout(() => glassTick(3600, 0.026), 22);
      },
      battle_poison() {
        glassTick(1200, 0.028);
        window.setTimeout(() => tone(900, 0.07, { volume: 0.02, type: "sine", detune: -10 }), 40);
      },
      battle_miss() {
        glassTick(1600, 0.018);
      },
      battle_victory() {
        arpeggio([2637, 3136, 3520, 4186, 4699, 5280], 0.038, { volume: 0.036, type: "sine", duration: 0.08 });
        glassShimmer(6200, 0.014);
      },
      battle_defeat() {
        arpeggio([1760, 1568, 1397, 1175], 0.045, { volume: 0.028, type: "sine", duration: 0.09 });
      },
      battle_draw() {
        arpeggio([1760, 1661, 1568], 0.05, { volume: 0.026, type: "sine" });
      },
    });

    return sfx;
  }

  /**
   * Лес / дубовый мох — глухие лесные звуки.
   * Референс: желудь падает на мох у подножия дуба.
   * - Низкий thump 80–180 Hz, без ярких верхов
   * - Короткий удар + мягкий «хвост» мха (медленный decay)
   * - Шум через bandpass 160–320 Hz — органическая «глухость»
   * - Лёгкий rustle 500–900 Hz — шёпот листвы (награды, не hover)
   */
  function buildForestSfx(api) {
    /** Пресет изначально глуше классики — поднимаем общий gain. */
    const FOREST_GAIN = 3.4;
    const tone = (hz, dur, opts = {}) => {
      const o = { ...opts };
      if (o.volume != null) o.volume *= FOREST_GAIN;
      return api.tone(hz, dur, o);
    };
    const noiseBurst = (dur, opts = {}) => {
      const o = { ...opts };
      if (o.volume != null) o.volume *= FOREST_GAIN;
      return api.noiseBurst(dur, o);
    };
    const arpeggio = (notes, gap, opts = {}) => {
      const o = { ...opts };
      if (o.volume != null) o.volume *= FOREST_GAIN;
      return api.arpeggio(notes, gap, o);
    };
    const sfx = {};

    const SINE = "sine";
    const TRI = "triangle";

    /** Ядро пресета — глухой удар желудя о мох. */
    function acornThud(opts = {}) {
      const {
        vol = 0.065,
        heavy = false,
        pan = 0,
        baseHz = heavy ? 66 : 76 + Math.random() * 12,
      } = opts;
      const bodyDur = heavy ? 0.17 : 0.12;
      const thumpDur = heavy ? 0.095 : 0.07;

      tone(baseHz, bodyDur, {
        volume: vol,
        type: SINE,
        attack: heavy ? 0.014 : 0.01,
        decay: 0.97,
        pan,
      });
      tone(baseHz * 0.5, bodyDur * 1.2, {
        volume: vol * 0.5,
        type: TRI,
        attack: 0.02,
        decay: 0.99,
        pan,
      });
      tone(baseHz * 0.32, bodyDur * 1.35, {
        volume: vol * 0.26,
        type: SINE,
        attack: 0.024,
        decay: 0.99,
        pan,
      });
      noiseBurst(thumpDur, {
        volume: vol * 0.78,
        freq: heavy ? 138 : 158 + Math.random() * 38,
        q: heavy ? 4.2 : 3.6,
      });
      window.setTimeout(() => {
        tone(baseHz * 0.38, heavy ? 0.15 : 0.11, {
          volume: vol * 0.34,
          type: SINE,
          attack: 0.024,
          decay: 0.99,
          pan,
        });
        noiseBurst(heavy ? 0.075 : 0.05, {
          volume: vol * 0.4,
          freq: 96 + Math.random() * 28,
          q: 3,
        });
      }, heavy ? 40 : 26);
    }

    /** Мягкий шелест — hover, лёгкие действия. */
    function leafRustle(vol = 0.022, pan = 0) {
      noiseBurst(0.055, {
        volume: vol,
        freq: 520 + Math.random() * 280,
        q: 1.4,
      });
      tone(180 + Math.random() * 40, 0.07, {
        volume: vol * 0.55,
        type: TRI,
        attack: 0.014,
        decay: 0.94,
        pan,
      });
    }

    /** Два-три желудя каскадом — награды, покупки. */
    function acornCascade(notes, gapMs = 95, vol = 0.05) {
      notes.forEach((mult, i) => {
        window.setTimeout(() => {
          acornThud({
            vol: vol * (0.88 + i * 0.04),
            baseHz: 88 * mult,
            pan: (i % 2 === 0 ? -1 : 1) * 0.18,
          });
        }, i * gapMs);
      });
    }

    /** Глухой «сухой» щелчок ветки — toggle. */
    function twigSnap(vol = 0.042, pan = 0) {
      tone(210 + Math.random() * 35, 0.05, {
        volume: vol,
        type: TRI,
        attack: 0.004,
        decay: 0.82,
        pan,
      });
      noiseBurst(0.032, { volume: vol * 0.65, freq: 380 + Math.random() * 120, q: 2.2 });
    }

    function forestHover() {
      acornThud({
        vol: 0.04,
        baseHz: 78 + Math.random() * 10,
        pan: (Math.random() - 0.5) * 0.22,
      });
    }

    /** Подбор предмета — тихий глухой «сдвиг с мха», без яркого шелеста. */
    function forestPickup(pan = -0.1) {
      noiseBurst(0.038, {
        volume: 0.02,
        freq: 118 + Math.random() * 28,
        q: 3.5,
      });
      window.setTimeout(() => {
        acornThud({
          vol: 0.036,
          baseHz: 74 + Math.random() * 8,
          pan,
        });
      }, 16);
    }

    Object.assign(sfx, {
      ui_hover() {
        forestHover();
      },
      ui_click() {
        acornThud({ vol: 0.058, baseHz: 72 + Math.random() * 10, pan: (Math.random() - 0.5) * 0.2 });
      },
      ui_toggle() {
        twigSnap(0.04, -0.1);
        window.setTimeout(() => acornThud({ vol: 0.038, baseHz: 102 }), 55);
      },
      ui_open() {
        acornThud({ vol: 0.055, heavy: false, pan: -0.12 });
        window.setTimeout(() => leafRustle(0.024, 0.1), 70);
        window.setTimeout(() => acornThud({ vol: 0.042, baseHz: 88, pan: 0.08 }), 140);
      },
      ui_close() {
        acornThud({ vol: 0.048, baseHz: 92, pan: 0.1 });
        window.setTimeout(() => leafRustle(0.02, -0.08), 60);
      },
      ui_error() {
        tone(72, 0.14, { volume: 0.062, type: SINE, attack: 0.01, decay: 0.97 });
        noiseBurst(0.08, { volume: 0.048, freq: 160, q: 2.8 });
        window.setTimeout(() => tone(58, 0.16, { volume: 0.05, type: TRI, attack: 0.014 }), 80);
      },

      prep_pickup() {
        forestPickup(-0.12);
      },
      prep_place(opts = {}) {
        acornThud({ vol: opts.heavy ? 0.072 : 0.058, heavy: !!opts.heavy, pan: 0.06 });
        if (opts.heavy) {
          window.setTimeout(() => leafRustle(0.026, 0.12), 90);
        }
      },
      prep_reject() {
        tone(68, 0.1, { volume: 0.058, type: SINE, attack: 0.008, decay: 0.95 });
        noiseBurst(0.06, { volume: 0.05, freq: 175, q: 3 });
      },
      prep_buy() {
        acornCascade([1, 1.08, 1.18, 1.28], 105, 0.052);
        window.setTimeout(() => leafRustle(0.022, 0.15), 380);
      },
      prep_sell() {
        acornCascade([1.22, 1.08, 0.94], 110, 0.044);
      },
      prep_refresh() {
        leafRustle(0.03, 0);
        window.setTimeout(() => acornThud({ vol: 0.05, baseHz: 98 }), 60);
        window.setTimeout(() => acornThud({ vol: 0.042, baseHz: 106, pan: -0.12 }), 150);
      },
      prep_freeze() {
        tone(140, 0.09, { volume: 0.038, type: SINE, attack: 0.02, decay: 0.96 });
        noiseBurst(0.05, { volume: 0.028, freq: 420, q: 1.8 });
      },
      prep_rotate() {
        twigSnap(0.036, -0.08);
        window.setTimeout(() => acornThud({ vol: 0.04, baseHz: 100, pan: 0.1 }), 40);
      },
      prep_craft() {
        acornThud({ vol: 0.062, heavy: true, pan: 0 });
        window.setTimeout(() => acornCascade([1.05, 1.15, 1.25], 90, 0.048), 120);
        window.setTimeout(() => leafRustle(0.028, 0.18), 340);
      },
      prep_gem() {
        acornCascade([1.12, 1.28, 1.42], 88, 0.05);
      },
      gold() {
        acornCascade([1.18, 1.32, 1.48], 92, 0.054);
        window.setTimeout(() => leafRustle(0.024, 0.2), 280);
      },

      arc_hover() {
        forestHover();
      },
      arc_begin() {
        sfx.arc_hover();
      },
      arc_celebrate() {
        acornCascade([1, 1.1, 1.2], 85, 0.038);
      },

      battle_start() {
        acornThud({ vol: 0.068, heavy: true, pan: 0 });
        window.setTimeout(() => acornCascade([0.95, 1.05, 1.12], 100, 0.055), 140);
        leafRustle(0.032, 0);
      },
      battle_countdown_tick() {
        acornThud({ vol: 0.05, baseHz: 94 + Math.random() * 12 });
      },
      battle_countdown_go() {
        acornCascade([1, 1.1, 1.22, 1.35], 88, 0.058);
        leafRustle(0.03, 0);
      },
      battle_hit(opts = {}) {
        const heavy = (Number(opts.amount) || 1) >= 8;
        acornThud({ vol: heavy ? 0.078 : 0.062, heavy, pan: (Math.random() - 0.5) * 0.25 });
        if (heavy) {
          window.setTimeout(() => leafRustle(0.034, 0.1), 70);
        }
      },
      battle_heal(opts = {}) {
        const steps = Math.min(3, 1 + Math.floor((Number(opts.amount) || 1) / 12));
        acornCascade([1.05, 1.15, 1.25].slice(0, steps), 100, 0.042);
      },
      battle_block() {
        twigSnap(0.048, 0);
        window.setTimeout(() => acornThud({ vol: 0.044, baseHz: 118, pan: -0.08 }), 28);
      },
      battle_poison() {
        tone(82, 0.12, { volume: 0.05, type: TRI, attack: 0.012, decay: 0.96, detune: -18 });
        noiseBurst(0.07, { volume: 0.04, freq: 200, q: 2.5 });
      },
      battle_miss() {
        leafRustle(0.018, 0);
      },
      battle_victory() {
        acornCascade([0.92, 1, 1.08, 1.16, 1.26, 1.38], 98, 0.056);
        window.setTimeout(() => leafRustle(0.034, 0.2), 520);
        window.setTimeout(() => acornThud({ vol: 0.048, baseHz: 86, pan: -0.15 }), 640);
      },
      battle_defeat() {
        acornCascade([1.18, 1.02, 0.88, 0.74], 115, 0.05);
        window.setTimeout(() => tone(62, 0.18, { volume: 0.048, type: SINE, attack: 0.016, decay: 0.98 }), 420);
      },
      battle_draw() {
        acornThud({ vol: 0.046, baseHz: 96 });
        window.setTimeout(() => acornThud({ vol: 0.04, baseHz: 96, pan: 0.12 }), 180);
      },
    });

    return sfx;
  }

  const SOUND_THEME_META = {
    classic: {
      id: "classic",
      label: "Классика",
      hint: "Текущий баланс — нейтральные тона, квадратные удары в бою",
      emoji: "🎮",
    },
    dopamine: {
      id: "dopamine",
      label: "Дофамин",
      hint: "Восходящие награды, блеск на покупках — juicy micro-rewards",
      emoji: "✨",
    },
    gentle: {
      id: "gentle",
      label: "Нежность",
      hint: "Мягкие колокольчики в такт 67 BPM — пастельная девчачья игра",
      emoji: "🌸",
    },
    meat: {
      id: "meat",
      label: "Мясо",
      hint: "Diablo — капает, хлюпает, тяжёлые удары и мокрые клики",
      emoji: "🥩",
    },
    mirror: {
      id: "mirror",
      label: "Black Mirror",
      hint: "Стеклянные тики смартфона — hover, тап и каждый переход по UI",
      emoji: "📱",
    },
    forest: {
      id: "forest",
      label: "Дубовый мох",
      hint: "Глухой лес — желудь на мох, шелест листвы, мягкие удары без ярких верхов",
      emoji: "🌳",
    },
  };

  const builders = {
    classic: buildClassicSfx,
    dopamine: buildDopamineSfx,
    gentle: buildGentleSfx,
    meat: buildMeatSfx,
    mirror: buildMirrorSfx,
    forest: buildForestSfx,
  };

  function applySharedPrepClockSfx(sfx, api) {
    const { tone, arpeggio } = api;
    sfx.prep_phase_start = () => {
      arpeggio([392, 494, 587], 0.06, { volume: 0.08, type: "sine" });
    };
    sfx.prep_timer_10 = () => {
      tone(660, 0.09, { volume: 0.075, type: "triangle" });
      window.setTimeout(() => tone(784, 0.08, { volume: 0.065, type: "sine" }), 55);
    };
    sfx.prep_timer_5 = () => {
      tone(740, 0.1, { volume: 0.085, type: "triangle" });
      window.setTimeout(() => tone(880, 0.11, { volume: 0.08, type: "square" }), 60);
    };
    return sfx;
  }

  /** Звуки «мыслей» героев — мягкие, стерео по стороне боя. */
  function applySharedThoughtSfx(sfx, api) {
    const { tone, arpeggio } = api;
    const pan = (opts = {}) => (opts.pan ?? 0);

    sfx.thought_nod = (opts = {}) => {
      tone(392, 0.14, { volume: 0.042, type: "sine", pan: pan(opts) });
      window.setTimeout(() => tone(494, 0.1, { volume: 0.034, type: "triangle", pan: pan(opts) }), 70);
    };
    sfx.thought_bounce = (opts = {}) => {
      tone(523, 0.08, { volume: 0.05, type: "triangle", pan: pan(opts) });
      window.setTimeout(() => tone(698, 0.11, { volume: 0.048, type: "sine", pan: pan(opts) * 0.6 }), 55);
      window.setTimeout(() => tone(440, 0.09, { volume: 0.036, type: "sine", pan: pan(opts) }), 130);
    };
    sfx.thought_wobble = (opts = {}) => {
      tone(330, 0.1, { volume: 0.038, type: "triangle", pan: pan(opts), detune: -18 });
      window.setTimeout(() => tone(370, 0.1, { volume: 0.034, type: "sine", pan: -pan(opts), detune: 14 }), 90);
      window.setTimeout(() => tone(350, 0.09, { volume: 0.03, type: "triangle", pan: pan(opts) }), 175);
    };
    sfx.thought_pop = (opts = {}) => {
      arpeggio([440, 554, 659], 0.042, { volume: 0.045, type: "sine", duration: 0.09, pan: pan(opts) });
    };
    sfx.thought_whoosh = (opts = {}) => {
      tone(880, 0.06, { volume: 0.028, type: "sine", pan: pan(opts) });
      window.setTimeout(() => tone(620, 0.12, { volume: 0.034, type: "triangle", pan: -pan(opts) * 0.5 }), 40);
    };
    sfx.thought_dance = (opts = {}) => {
      arpeggio([392, 494, 587, 659], 0.055, { volume: 0.04, type: "triangle", duration: 0.08, pan: pan(opts) });
    };
    sfx.thought_sparkle = (opts = {}) => {
      tone(988, 0.07, { volume: 0.032, type: "sine", pan: pan(opts) });
      window.setTimeout(() => tone(1319, 0.08, { volume: 0.028, type: "triangle", pan: pan(opts) * 0.7 }), 65);
    };
    sfx.thought_reply = (opts = {}) => {
      tone(587, 0.11, { volume: 0.038, type: "sine", pan: pan(opts) });
      window.setTimeout(() => tone(740, 0.09, { volume: 0.032, type: "triangle", pan: pan(opts) * 0.5 }), 80);
    };
    return sfx;
  }

  function buildSfxTheme(themeId, api) {
    const build = builders[themeId] || builders.classic;
    return applySharedThoughtSfx(applySharedPrepClockSfx(build(api), api), api);
  }

  global.SfxThemes = {
    META: SOUND_THEME_META,
    builders,
    build: buildSfxTheme,
    defaultId: "classic",
  };
})(typeof window !== "undefined" ? window : globalThis);
