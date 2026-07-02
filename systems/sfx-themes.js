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
  };

  const builders = {
    classic: buildClassicSfx,
    dopamine: buildDopamineSfx,
    gentle: buildGentleSfx,
  };

  function buildSfxTheme(themeId, api) {
    const build = builders[themeId] || builders.classic;
    return build(api);
  }

  global.SfxThemes = {
    META: SOUND_THEME_META,
    builders,
    build: buildSfxTheme,
    defaultId: "classic",
  };
})(typeof window !== "undefined" ? window : globalThis);
