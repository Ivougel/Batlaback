// Transpiled from TypeScript — npm run compile:ts

const DIALOGUE_RUN_PHASES = {
  opening: { minRound: 1, maxRound: 2 },
  early: { minRound: 3, maxRound: 6 },
  mid: { minRound: 7, maxRound: 11 },
  late: { minRound: 12, maxRound: 16 }
};
const HERO_DIALOGUE_VOICES = {
  warrior: {
    classId: "warrior",
    label: "\u041C\u0430\u0440\u0442\u043E\u0432\u0438\u0447\u043E\u043A",
    traits: ["\u0443\u043F\u0440\u044F\u043C\u044B\u0439", "\u043F\u0440\u044F\u043C\u043E\u043B\u0438\u043D\u0435\u0439\u043D\u044B\u0439", "\u0433\u043E\u0440\u0434\u044B\u0439"],
    interests: ["\u043C\u0435\u0447\u0438", "\u0431\u0440\u043E\u043D\u044F", "\u0432\u044B\u0436\u0438\u0432\u0430\u043D\u0438\u0435", "\u0447\u0435\u0441\u0442\u043D\u044B\u0439 \u0431\u043E\u0439"],
    tone: "\u0433\u0440\u0443\u0431\u043E\u0432\u0430\u0442\u044B\u0439, \u043D\u043E \u043D\u0430\u0434\u0451\u0436\u043D\u044B\u0439",
    emoji: "\u{1F624}"
  },
  rogue: {
    classId: "rogue",
    label: "\u0420\u043E\u043A\u0441\u0438\u0432\u0438\u0447\u043E\u043A",
    traits: ["\u044F\u0437\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439", "\u0431\u044B\u0441\u0442\u0440\u044B\u0439", "\u043B\u044E\u0431\u0438\u0442 \u0445\u0430\u0439\u043F"],
    interests: ["\u043B\u043E\u0432\u0443\u0448\u043A\u0438", "\u044F\u0434", "\u0447\u0430\u0442", "\u043D\u0435\u043E\u0436\u0438\u0434\u0430\u043D\u043D\u043E\u0441\u0442\u0438"],
    tone: "\u043A\u043E\u043B\u043A\u0438\u0439, \u0441 \u043F\u043E\u0434\u043A\u043E\u043B\u0430\u043C\u0438",
    emoji: "\u{1F60F}"
  },
  mage: {
    classId: "mage",
    label: "\u041C\u043E\u0440\u043A\u043E\u0432\u0438\u0447\u043E\u043A",
    traits: ["\u0442\u0435\u0430\u0442\u0440\u0430\u043B\u044C\u043D\u044B\u0439", "\u0440\u0430\u0441\u0447\u0451\u0442\u043B\u0438\u0432\u044B\u0439", "\u043B\u044E\u0431\u043E\u043F\u044B\u0442\u043D\u044B\u0439"],
    interests: ["\u043C\u0430\u0433\u0438\u044F", "\u043A\u0440\u0438\u0441\u0442\u0430\u043B\u043B\u044B", "\u0441\u0438\u043D\u0435\u0440\u0433\u0438\u0438", "\u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u044B"],
    tone: "\u0447\u0443\u0442\u044C \u0432\u044B\u0441\u043E\u043A\u043E\u043C\u0435\u0440\u043D\u044B\u0439 \u0438\u043D\u0442\u0435\u043B\u043B\u0435\u043A\u0442\u0443\u0430\u043B",
    emoji: "\u{1F914}"
  },
  priest: {
    classId: "priest",
    label: "\u041C\u044B\u043A\u043E\u0432\u0438\u0447\u043E\u043A",
    traits: ["\u0437\u0430\u0431\u043E\u0442\u043B\u0438\u0432\u044B\u0439", "\u043E\u043F\u0442\u0438\u043C\u0438\u0441\u0442\u0438\u0447\u043D\u044B\u0439", "\u0434\u0440\u0430\u043C\u0430\u0442\u0438\u0447\u043D\u044B\u0439"],
    interests: ["\u0435\u0434\u0430", "\u043B\u0435\u0447\u0435\u043D\u0438\u0435", "\u043F\u0435\u0440\u0435\u043A\u0443\u0441\u044B", "\u043C\u043E\u0440\u0430\u043B\u044C"],
    tone: "\u0442\u0451\u043F\u043B\u044B\u0439, \u0441 \u043E\u043F\u0435\u0440\u043D\u044B\u043C\u0438 \u043D\u043E\u0442\u043A\u0430\u043C\u0438",
    emoji: "\u{1F64F}"
  }
};
const DIALOGUE_LINES = [
  // ─── Старт забега ───
  {
    id: "open_warrior_1",
    trigger: "run_open",
    classId: "warrior",
    phase: "opening",
    weight: 3,
    text: "\u042F \u043D\u0435 \u0434\u043B\u044F \u043A\u0440\u0430\u0441\u043E\u0442\u044B \u043D\u0430 \u043F\u043E\u043B\u0435. \u041A\u0442\u043E \u043F\u0435\u0440\u0432\u044B\u0439 \u2014 \u0442\u043E\u0442 \u0438 \u0430\u0440\u0431\u0443\u0437."
  },
  {
    id: "open_rogue_1",
    trigger: "run_open",
    classId: "rogue",
    phase: "opening",
    weight: 3,
    text: "\u041B\u0430\u0434\u043D\u043E, \u0437\u0432\u0435\u0440\u0438, \u043D\u0435 \u043E\u0431\u0438\u0436\u0430\u0439\u0442\u0435\u0441\u044C: \u044F \u0443\u0436\u0435 \u0437\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u044E \u0432\u0430\u0448\u0438 \u043E\u0448\u0438\u0431\u043A\u0438 \u0432 \u0447\u0430\u0442."
  },
  {
    id: "open_mage_1",
    trigger: "run_open",
    classId: "mage",
    phase: "opening",
    weight: 3,
    text: "\u0421\u0446\u0435\u043D\u0430 \u0433\u043E\u0442\u043E\u0432\u0430. \u041F\u043E\u0441\u043C\u043E\u0442\u0440\u0438\u043C, \u0447\u044C\u044F \u0441\u0431\u043E\u0440\u043A\u0430 \u043A\u0440\u0430\u0441\u0438\u0432\u0435\u0435 \u043D\u0430 \u0431\u0443\u043C\u0430\u0433\u0435 \u2014 \u0438 \u0432 \u0431\u043E\u044E."
  },
  {
    id: "open_priest_1",
    trigger: "run_open",
    classId: "priest",
    phase: "opening",
    weight: 3,
    text: "\u0414\u0435\u0442\u0438, \u043F\u0435\u0440\u0435\u043A\u0443\u0441\u0438\u0442\u0435 \u043F\u0435\u0440\u0435\u0434 \u0431\u043E\u0435\u043C. \u0413\u043E\u043B\u043E\u0434\u043D\u044B\u0439 \u0433\u0435\u0440\u043E\u0439 \u2014 \u043F\u043B\u043E\u0445\u043E\u0439 \u0445\u043E\u0440!"
  },
  {
    id: "open_reply_calm",
    trigger: "reply",
    replyTo: ["open_warrior_1", "open_rogue_1", "open_mage_1", "open_priest_1"],
    weight: 2,
    texts: {
      warrior: "\u0421\u043B\u043E\u0432\u0430\u043C\u0438 \u043D\u0435 \u0432\u043E\u0437\u044C\u043C\u0451\u0448\u044C. \u0422\u043E\u043B\u044C\u043A\u043E \u0440\u044E\u043A\u0437\u0430\u043A\u043E\u043C.",
      rogue: "\u041E, \u0440\u0435\u0447\u044C \u043F\u043E\u0448\u043B\u0430. \u0417\u043D\u0430\u0447\u0438\u0442, \u0443\u0436\u0435 \u0441\u0442\u0440\u0430\u0448\u043D\u043E.",
      mage: "\u0420\u0438\u0442\u043E\u0440\u0438\u043A\u0430 \u2014 \u0442\u043E\u0436\u0435 \u0440\u0435\u0441\u0443\u0440\u0441. \u041D\u043E \u0443\u0440\u043E\u043D \u0432\u0430\u0436\u043D\u0435\u0435.",
      priest: "\u042F \u043F\u0440\u0438\u043D\u0435\u0441\u0443 \u0431\u0430\u043D\u0430\u043D\u044B. \u041E\u0441\u0442\u0430\u043B\u044C\u043D\u043E\u0435 \u2014 \u0441\u0443\u0434\u044C\u0431\u0430."
    }
  },
  // ─── Prep: покупки / сборка ───
  {
    id: "prep_shop_warrior",
    trigger: "prep_shop",
    classId: "warrior",
    weight: 2,
    text: "\u0415\u0449\u0451 \u043E\u0434\u043D\u0430 \u0436\u0435\u043B\u0435\u0437\u043A\u0430 \u2014 \u0438 \u044F \u043F\u0435\u0440\u0435\u0441\u0442\u0430\u043D\u0443 \u043F\u043E\u043C\u0435\u0449\u0430\u0442\u044C\u0441\u044F \u0432 \u043A\u0440\u0443\u0436\u043E\u043A."
  },
  {
    id: "prep_shop_rogue",
    trigger: "prep_shop",
    classId: "rogue",
    weight: 2,
    text: "\u041C\u0430\u0433\u0430\u0437\u0438\u043D \u043B\u044E\u0431\u0438\u0442 \u043C\u0435\u043D\u044F. \u042F \u043B\u044E\u0431\u043B\u044E \u0441\u043A\u0438\u0434\u043A\u0438. \u0412\u0441\u0451 \u0447\u0435\u0441\u0442\u043D\u043E."
  },
  {
    id: "prep_shop_mage",
    trigger: "prep_shop",
    classId: "mage",
    phase: "early",
    weight: 2,
    text: "\u041A\u0440\u0438\u0441\u0442\u0430\u043B\u043B \u0431\u043B\u0435\u0441\u0442\u0438\u0442 \u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u043E. \u042D\u0442\u043E \u0437\u043D\u0430\u043A. \u041D\u0430\u0432\u0435\u0440\u043D\u043E\u0435."
  },
  {
    id: "prep_shop_priest",
    trigger: "prep_shop",
    classId: "priest",
    weight: 2,
    text: "\u042F\u0431\u043B\u043E\u043A\u043E \u0432 \u0440\u044E\u043A\u0437\u0430\u043A\u0435 \u2014 \u044D\u0442\u043E \u043D\u0435 \u0436\u0430\u0434\u043D\u043E\u0441\u0442\u044C, \u044D\u0442\u043E \u0432\u0435\u0440\u0430."
  },
  {
    id: "prep_build_focus",
    trigger: "prep_idle",
    weight: 1,
    texts: {
      warrior: "\u0421\u0435\u0442\u043A\u0430 \u043D\u0435 \u043F\u0440\u043E\u0449\u0430\u0435\u0442 \u0441\u043B\u0430\u0431\u044B\u0445. \u0425\u043E\u0440\u043E\u0448\u043E, \u0447\u0442\u043E \u044F \u0443\u043F\u0440\u044F\u043C\u044B\u0439.",
      rogue: "\u041F\u043E\u0432\u043E\u0440\u043E\u0442 \u043D\u0430 \u043E\u0434\u0438\u043D \u0433\u0440\u0430\u0434\u0443\u0441 \u2014 \u0438 \u0432\u0440\u0430\u0433 \u0443\u0436\u0435 \u043D\u0435 \u043F\u043E\u043D\u0438\u043C\u0430\u0435\u0442, \u0447\u0442\u043E \u0441\u043B\u0443\u0447\u0438\u043B\u043E\u0441\u044C.",
      mage: "\u0421\u0438\u043D\u0435\u0440\u0433\u0438\u044F \u0449\u0451\u043B\u043A\u043D\u0443\u043B\u0430. \u0421\u043B\u044B\u0448\u0430\u043B\u0438? \u041D\u0435\u0442? \u0416\u0430\u043B\u044C.",
      priest: "\u041C\u043E\u0439 \u0440\u044E\u043A\u0437\u0430\u043A \u043F\u0430\u0445\u043D\u0435\u0442 \u043D\u0430\u0434\u0435\u0436\u0434\u043E\u0439 \u0438 \u0441\u0443\u0448\u0451\u043D\u044B\u043C\u0438 \u0444\u0440\u0443\u043A\u0442\u0430\u043C\u0438."
    }
  },
  // ─── Соперник раунда ───
  {
    id: "prep_opponent_warrior",
    trigger: "prep_opponent",
    classId: "warrior",
    weight: 3,
    text: "\u0422\u044B \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439. \u041D\u0435 \u043E\u0431\u0438\u0436\u0430\u0439\u0441\u044F \u0437\u0430\u0440\u0430\u043D\u0435\u0435."
  },
  {
    id: "prep_opponent_rogue",
    trigger: "prep_opponent",
    classId: "rogue",
    weight: 3,
    text: "\u041E, \u043C\u043E\u0439 \u043B\u044E\u0431\u0438\u043C\u044B\u0439 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A. \u0423\u0436\u0435 \u0441\u043A\u0443\u0447\u0430\u044E \u043F\u043E \u0442\u0432\u043E\u0435\u043C\u0443 HP."
  },
  {
    id: "prep_opponent_mage",
    trigger: "prep_opponent",
    classId: "mage",
    weight: 3,
    text: "\u041F\u0440\u043E\u0442\u0438\u0432\u043D\u0438\u043A \u0432\u044B\u0431\u0440\u0430\u043D. \u0422\u0435\u043E\u0440\u0438\u044F \u0433\u043E\u0432\u043E\u0440\u0438\u0442: \u0431\u0443\u0434\u0435\u0442 \u0431\u043E\u043B\u044C\u043D\u043E."
  },
  {
    id: "prep_opponent_priest",
    trigger: "prep_opponent",
    classId: "priest",
    weight: 3,
    text: "\u041F\u0443\u0441\u0442\u044C \u043F\u043E\u0431\u0435\u0434\u0438\u0442 \u0434\u043E\u0441\u0442\u043E\u0439\u043D\u044B\u0439. \u041D\u043E \u0435\u0441\u043B\u0438 \u0433\u043E\u043B\u043E\u0434\u0435\u043D \u2014 \u0441\u043A\u0430\u0436\u0438."
  },
  {
    id: "prep_opponent_reply",
    trigger: "reply",
    replyTo: ["prep_opponent_warrior", "prep_opponent_rogue", "prep_opponent_mage", "prep_opponent_priest"],
    weight: 2,
    texts: {
      warrior: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0434\u043E\u0436\u0434\u0438\u0441\u044C \u043C\u043E\u0435\u0433\u043E \u0443\u0434\u0430\u0440\u0430.",
      rogue: "\u0422\u044B \u0432\u0441\u0435\u0433\u0434\u0430 \u0442\u0430\u043A\u0430\u044F \u0441\u043C\u0435\u043B\u0430\u044F \u0434\u043E \u043F\u0435\u0440\u0432\u043E\u0439 \u0441\u0438\u043D\u0435\u0440\u0433\u0438\u0438?",
      mage: "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u043D\u0430 \u043C\u043E\u0435\u0439 \u0441\u0442\u043E\u0440\u043E\u043D\u0435. \u041F\u043E\u0447\u0442\u0438 \u0432\u0441\u0435\u0433\u0434\u0430.",
      priest: "\u042F \u043F\u043E\u043C\u043E\u043B\u044E\u0441\u044C \u0437\u0430 \u043D\u0430\u0441 \u043E\u0431\u043E\u0438\u0445. \u041D\u043E \u0441\u0438\u043B\u044C\u043D\u0435\u0435 \u2014 \u0437\u0430 \u0441\u0435\u0431\u044F."
    }
  },
  // ─── Таймер подготовки ───
  {
    id: "prep_timer_low",
    trigger: "prep_timer",
    minTimer: 0,
    maxTimer: 12,
    weight: 4,
    texts: {
      warrior: "\u0412\u0440\u0435\u043C\u044F! \u042F \u0435\u0449\u0451 \u0434\u0430\u0436\u0435 \u043A\u0443\u043B\u0430\u043A \u043D\u0435 \u0440\u0430\u0437\u043C\u044F\u043B!",
      rogue: "\u0422\u0438\u043A-\u0442\u0430\u043A. \u041B\u044E\u0431\u043B\u044E, \u043A\u043E\u0433\u0434\u0430 \u0432\u0441\u0435 \u043F\u0430\u043D\u0438\u043A\u0443\u044E\u0442 \u043E\u0434\u043D\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E.",
      mage: "\u0414\u0435\u0434\u043B\u0430\u0439\u043D \u2014 \u043B\u0443\u0447\u0448\u0438\u0439 \u043A\u0430\u0442\u0430\u043B\u0438\u0437\u0430\u0442\u043E\u0440 \u043C\u0430\u0433\u0438\u0438.",
      priest: "\u0414\u0435\u0442\u0438, \u043D\u0435 \u0431\u0435\u0433\u0430\u0439\u0442\u0435 \u0441 \u043F\u043E\u043B\u043D\u044B\u043C \u0440\u0442\u043E\u043C!"
    }
  },
  {
    id: "prep_timer_reply",
    trigger: "reply",
    replyTo: ["prep_timer_low"],
    weight: 2,
    texts: {
      warrior: "\u041F\u0430\u043D\u0438\u043A\u0430 \u2014 \u0434\u043B\u044F \u0441\u043B\u0430\u0431\u044B\u0445. \u042F \u043F\u0440\u043E\u0441\u0442\u043E \u0437\u043B\u044E\u0441\u044C.",
      rogue: "\u0415\u0449\u0451 \u043F\u044F\u0442\u044C \u0441\u0435\u043A\u0443\u043D\u0434 \u2014 \u0438 \u044F \u043F\u0440\u0438\u0442\u0432\u043E\u0440\u044E\u0441\u044C, \u0447\u0442\u043E \u0433\u043E\u0442\u043E\u0432.",
      mage: "\u0425\u0430\u043E\u0441 \u0443\u0441\u043A\u043E\u0440\u044F\u0435\u0442 \u043C\u0435\u0442\u0430\u0431\u043E\u043B\u0438\u0437\u043C \u043C\u0430\u043D\u044B. \u041D\u0430\u0432\u0435\u0440\u043D\u043E\u0435.",
      priest: "\u0413\u043E\u0441\u043F\u043E\u0434\u0438, \u0434\u0430\u0439 \u0438\u043C \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u0438\u043D \u0445\u043E\u0434 \u043C\u044B\u0441\u043B\u0438."
    }
  },
  // ─── Середина забега ───
  {
    id: "mid_run_warrior",
    trigger: "prep_idle",
    classId: "warrior",
    phase: "mid",
    weight: 2,
    text: "\u041F\u043E\u043B\u043E\u0432\u0438\u043D\u0430 \u0437\u0430\u0431\u0435\u0433\u0430 \u043F\u043E\u0437\u0430\u0434\u0438. \u042F \u0435\u0449\u0451 \u0441\u0442\u043E\u044E. \u042D\u0442\u043E \u0443\u0436\u0435 \u043F\u043E\u0431\u0435\u0434\u0430."
  },
  {
    id: "mid_run_rogue",
    trigger: "prep_idle",
    classId: "rogue",
    phase: "mid",
    weight: 2,
    text: "\u0421\u0435\u0440\u0435\u0434\u0438\u043D\u0430 \u2014 \u043C\u043E\u0439 \u043B\u044E\u0431\u0438\u043C\u044B\u0439 \u0430\u043A\u0442. \u0412\u0441\u0435 \u0443\u0436\u0435 \u0443\u0441\u0442\u0430\u043B\u0438, \u0430 \u044F \u043D\u0435\u0442."
  },
  {
    id: "mid_run_mage",
    trigger: "prep_idle",
    classId: "mage",
    phase: "mid",
    weight: 2,
    text: "\u041A\u0440\u0438\u0432\u0430\u044F \u0441\u0438\u043B\u044B \u0432\u044B\u0445\u043E\u0434\u0438\u0442 \u043D\u0430 \u043F\u043B\u0430\u0442\u043E. \u041F\u043E\u0440\u0430 \u0432\u0437\u0440\u044B\u0432\u0430\u0442\u044C \u043C\u0435\u0442\u0443."
  },
  {
    id: "mid_run_priest",
    trigger: "prep_idle",
    classId: "priest",
    phase: "mid",
    weight: 2,
    text: "\u041C\u044B \u0436\u0438\u0432\u044B \u2014 \u0437\u043D\u0430\u0447\u0438\u0442, \u0431\u043E\u0433 \u043F\u0435\u0440\u0435\u043A\u0443\u0441\u043E\u0432 \u0434\u043E\u0432\u043E\u043B\u0435\u043D."
  },
  // ─── Поздний забег ───
  {
    id: "late_run_warrior",
    trigger: "prep_idle",
    classId: "warrior",
    phase: "late",
    weight: 3,
    text: "\u0424\u0438\u043D\u0430\u043B \u0431\u043B\u0438\u0437\u043A\u043E. \u041A\u0442\u043E \u0434\u0440\u043E\u0433\u043D\u0435\u0442 \u2014 \u0442\u043E\u0442 \u043B\u043E\u043F\u043D\u0435\u0442, \u043A\u0430\u043A \u044F \u0432 \u0448\u0443\u0442\u043A\u0443."
  },
  {
    id: "late_run_rogue",
    trigger: "prep_idle",
    classId: "rogue",
    phase: "late",
    weight: 3,
    text: "\u041E\u0441\u0442\u0430\u043B\u043E\u0441\u044C \u043C\u0430\u043B\u043E \u0440\u0430\u0443\u043D\u0434\u043E\u0432. \u0418\u0434\u0435\u0430\u043B\u044C\u043D\u043E \u0434\u043B\u044F \u0433\u0440\u044F\u0437\u043D\u043E\u0433\u043E \u0442\u0440\u044E\u043A\u0430."
  },
  {
    id: "late_run_mage",
    trigger: "prep_idle",
    classId: "mage",
    phase: "late",
    weight: 3,
    text: "\u0421\u0435\u0439\u0447\u0430\u0441 \u0438\u043B\u0438 \u043D\u0438\u043A\u043E\u0433\u0434\u0430. \u041C\u043E\u0439 \u043F\u043E\u0441\u043E\u0445 \u0434\u0440\u043E\u0436\u0438\u0442 \u043E\u0442 \u0432\u0430\u0436\u043D\u043E\u0441\u0442\u0438."
  },
  {
    id: "late_run_priest",
    trigger: "prep_idle",
    classId: "priest",
    phase: "late",
    weight: 3,
    text: "\u0424\u0438\u043D\u0430\u043B! \u041F\u043E\u043C\u043D\u0438\u0442\u0435: \u0434\u0430\u0436\u0435 \u0433\u0435\u0440\u043E\u0439 \u0434\u043E\u043B\u0436\u0435\u043D \u0435\u0441\u0442\u044C \u043C\u0435\u0436\u0434\u0443 \u0443\u0434\u0430\u0440\u0430\u043C\u0438."
  },
  // ─── Низкое HP ───
  {
    id: "low_hp_any",
    trigger: "low_hp",
    maxHpPct: 0.35,
    weight: 4,
    texts: {
      warrior: "\u041C\u0430\u043B\u043E HP? \u0417\u0430\u0442\u043E \u043C\u043D\u043E\u0433\u043E \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0430.",
      rogue: "\u041A\u0440\u043E\u0432\u044C \u2014 \u044D\u0442\u043E \u043F\u0440\u043E\u0441\u0442\u043E \u043A\u0440\u0430\u0441\u043D\u044B\u0439 \u0434\u0435\u0431\u0430\u0444\u0444. \u041D\u043E\u0440\u043C.",
      mage: "\u041A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043C\u0430\u0441\u0441\u0430 \u0434\u043E\u0441\u0442\u0438\u0433\u043D\u0443\u0442\u0430. \u0428\u0443\u0447\u0443. \u041C\u043D\u0435 \u0431\u043E\u043B\u044C\u043D\u043E.",
      priest: "\u042F \u0435\u0449\u0451 \u043F\u043E\u044E. \u0417\u043D\u0430\u0447\u0438\u0442, \u0435\u0449\u0451 \u0436\u0438\u0432."
    }
  },
  {
    id: "low_hp_reply",
    trigger: "reply",
    replyTo: ["low_hp_any"],
    weight: 2,
    texts: {
      warrior: "\u0414\u0435\u0440\u0436\u0438\u0441\u044C. \u0418\u043B\u0438 \u0445\u043E\u0442\u044F \u0431\u044B \u043D\u0435 \u043F\u0430\u0434\u0430\u0439 \u043D\u0430 \u043C\u043E\u044E \u0441\u0435\u0442\u043A\u0443.",
      rogue: "\u041D\u0435 \u043D\u043E\u0439. \u042D\u0442\u043E \u043C\u0435\u0448\u0430\u0435\u0442 \u043D\u0430\u0441\u043B\u0430\u0436\u0434\u0430\u0442\u044C\u0441\u044F \u0434\u0440\u0430\u043C\u043E\u0439.",
      mage: "\u0420\u0435\u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u044F \u2014 \u0441\u043E\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0439 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442.",
      priest: "\u0421\u044A\u0435\u0448\u044C \u0447\u0442\u043E-\u043D\u0438\u0431\u0443\u0434\u044C. \u0421\u0435\u0440\u044C\u0451\u0437\u043D\u043E."
    }
  },
  // ─── После боя ───
  {
    id: "post_win",
    trigger: "post_battle_win",
    weight: 3,
    texts: {
      warrior: "\u0415\u0449\u0451 \u043E\u0434\u0438\u043D \u0440\u0430\u0443\u043D\u0434. \u0415\u0449\u0451 \u043E\u0434\u0438\u043D \u0448\u0440\u0430\u043C \u0434\u043B\u044F \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0438.",
      rogue: "\u041F\u043E\u0431\u0435\u0434\u0430 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u0430. \u0421\u043A\u0440\u0438\u043D\u0448\u043E\u0442 \u0432 \u0447\u0430\u0442 \u2014 \u043E\u043F\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E.",
      mage: "\u0413\u0438\u043F\u043E\u0442\u0435\u0437\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0430. \u0411\u043E\u043B\u044C \u2014 \u043F\u043E\u0431\u043E\u0447\u043D\u044B\u0439 \u044D\u0444\u0444\u0435\u043A\u0442.",
      priest: "\u0421\u043B\u0430\u0432\u0430 \u043F\u043E\u0431\u0435\u0434\u0438\u0442\u0435\u043B\u044E! \u0418 \u0442\u0435\u043C, \u043A\u0442\u043E \u043F\u0440\u0438\u043D\u0451\u0441 \u0437\u0430\u043A\u0443\u0441\u043A\u0438."
    }
  },
  {
    id: "post_loss",
    trigger: "post_battle_loss",
    weight: 3,
    texts: {
      warrior: "\u041F\u0440\u043E\u0438\u0433\u0440\u0430\u043B? \u0417\u043D\u0430\u0447\u0438\u0442, \u0432 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0440\u0430\u0437 \u0443\u0434\u0430\u0440\u044E \u0441\u0438\u043B\u044C\u043D\u0435\u0435.",
      rogue: "\u041F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u2014 \u044D\u0442\u043E \u043A\u043E\u043D\u0442\u0435\u043D\u0442. \u0421\u043F\u0430\u0441\u0438\u0431\u043E \u0437\u0430 \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440.",
      mage: "\u0410\u043D\u043E\u043C\u0430\u043B\u0438\u044F \u0432 \u0434\u0430\u043D\u043D\u044B\u0445. \u041F\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u0430\u044E \u0431\u0438\u043B\u0434.",
      priest: "\u041F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0433\u043E\u0440\u044C\u043A\u043E\u0435. \u041A\u0430\u043A \u043D\u0435\u0441\u043E\u043B\u0435\u043D\u044B\u0439 \u0441\u0443\u043F."
    }
  },
  {
    id: "post_battle_reply",
    trigger: "reply",
    replyTo: ["post_win", "post_loss"],
    weight: 2,
    texts: {
      warrior: "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0440\u0430\u0443\u043D\u0434 \u043D\u0430\u0447\u043D\u0451\u0442\u0441\u044F \u0431\u0435\u0437 \u0436\u0430\u043B\u043E\u0431.",
      rogue: "\u0413\u043B\u0430\u0432\u043D\u043E\u0435 \u2014 \u0447\u0442\u043E\u0431\u044B \u0437\u0440\u0438\u0442\u0435\u043B\u044F\u043C \u0431\u044B\u043B\u043E \u0432\u0435\u0441\u0435\u043B\u043E.",
      mage: "\u041D\u0430\u0443\u043A\u0430 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0436\u0435\u0440\u0442\u0432. \u041E\u0431\u044B\u0447\u043D\u043E \u2014 HP.",
      priest: "\u041E\u0431\u043D\u0438\u043C\u0438\u0442\u0435 \u0440\u044E\u043A\u0437\u0430\u043A \u0438 \u0438\u0434\u0438\u0442\u0435 \u0434\u0430\u043B\u044C\u0448\u0435."
    }
  },
  // ─── Бантер между случайными участниками ───
  {
    id: "banter_warrior_rogue",
    trigger: "prep_banter",
    fromClass: "warrior",
    toClass: "rogue",
    weight: 2,
    text: "\u041F\u0435\u0440\u0435\u0441\u0442\u0430\u043D\u044C \u0432\u0435\u0440\u0442\u0435\u0442\u044C\u0441\u044F. \u0423 \u043C\u0435\u043D\u044F \u043E\u0442 \u044D\u0442\u043E\u0433\u043E \u043C\u0435\u0447 \u0441\u0432\u043E\u0434\u0438\u0442.",
    reply: { rogue: "\u0412\u0435\u0440\u0447\u0443\u0441\u044C \u2014 \u043F\u043E\u0442\u043E\u043C\u0443 \u0447\u0442\u043E \u0442\u044B \u043F\u0440\u043E\u043C\u0430\u0445\u0438\u0432\u0430\u0435\u0448\u044C\u0441\u044F \u043A\u0440\u0430\u0441\u0438\u0432\u043E." }
  },
  {
    id: "banter_mage_priest",
    trigger: "prep_banter",
    fromClass: "mage",
    toClass: "priest",
    weight: 2,
    text: "\u0422\u0432\u043E\u0438 \u0431\u0430\u043D\u0430\u043D\u044B \u043D\u0435 \u0441\u043A\u043B\u0430\u0434\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0432 \u0441\u0438\u043D\u0435\u0440\u0433\u0438\u044E.",
    reply: { priest: "\u0410 \u0442\u0432\u043E\u044F \u0433\u043E\u0440\u0434\u044B\u043D\u044F \u043D\u0435 \u043B\u0435\u0447\u0438\u0442 HP, \u0434\u0435\u0442\u043E\u0447\u043A\u0430." }
  },
  {
    id: "banter_rogue_mage",
    trigger: "prep_banter",
    fromClass: "rogue",
    toClass: "mage",
    weight: 2,
    text: "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u043A\u0440\u0438\u0441\u0442\u0430\u043B\u043B\u043E\u0432 \u2014 \u0441\u0442\u043E\u043B\u044C\u043A\u043E \u0438 \u043E\u043F\u0440\u0430\u0432\u0434\u0430\u043D\u0438\u0439.",
    reply: { mage: "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u0434\u043A\u043E\u043B\u043E\u0432 \u2014 \u0441\u0442\u043E\u043B\u044C\u043A\u043E \u0438 \u0431\u0443\u0434\u0443\u0449\u0438\u0445 \u043F\u043E\u0440\u0430\u0436\u0435\u043D\u0438\u0439." }
  },
  {
    id: "banter_priest_warrior",
    trigger: "prep_banter",
    fromClass: "priest",
    toClass: "warrior",
    weight: 2,
    text: "\u0422\u044B \u0441\u043D\u043E\u0432\u0430 \u0437\u0430\u0431\u044B\u043B \u043F\u043E\u0435\u0441\u0442\u044C \u043F\u0435\u0440\u0435\u0434 \u0431\u043E\u0435\u043C.",
    reply: { warrior: "\u042F \u0437\u0430\u0431\u044B\u043B \u0442\u043E\u043B\u044C\u043A\u043E \u0441\u0442\u0440\u0430\u0445. \u0415\u0434\u0430 \u043F\u043E\u0434\u043E\u0436\u0434\u0451\u0442." }
  },
  // ─── Текст + эмодзи (чат-стиль) ───
  { id: "chat_flirt_rogue", trigger: "prep_emoji", classId: "rogue", weight: 2, text: "\u0422\u044B \u0441\u0435\u0433\u043E\u0434\u043D\u044F \u043E\u043F\u0430\u0441\u043D\u043E \u0445\u043E\u0440\u043E\u0448\u0430 \u{1F60F}" },
  { id: "chat_flirt_mage", trigger: "prep_emoji", classId: "mage", weight: 2, text: "\u042D\u0442\u0430 \u0441\u0431\u043E\u0440\u043A\u0430 \u2014 \u0447\u0438\u0441\u0442\u0430\u044F \u044D\u0441\u0442\u0435\u0442\u0438\u043A\u0430 \u2728" },
  { id: "chat_flirt_priest", trigger: "prep_emoji", classId: "priest", weight: 2, text: "\u041E\u0431\u043D\u0438\u043C\u0430\u0448\u043A\u0438 \u043F\u0435\u0440\u0435\u0434 \u0431\u043E\u0435\u043C? \u{1F970}" },
  { id: "chat_flirt_warrior", trigger: "prep_emoji", classId: "warrior", weight: 2, text: "\u0421\u043C\u043E\u0442\u0440\u0438 \u0432 \u0433\u043B\u0430\u0437\u0430, \u043D\u0435 \u043D\u0430 \u043C\u043E\u0439 \u043C\u0435\u0447 \u{1F624}" },
  { id: "chat_hype_1", trigger: "prep_emoji", weight: 2, text: "\u041F\u043E\u0433\u043D\u0430\u043B\u0438! \u{1F525}" },
  { id: "chat_hype_2", trigger: "prep_emoji", weight: 2, text: "\u042D\u0442\u043E \u0431\u0443\u0434\u0435\u0442 \u043B\u0435\u0433\u0435\u043D\u0434\u0430 \u{1F451}" },
  { id: "chat_hype_3", trigger: "prep_emoji", weight: 2, text: "\u042F \u0432 \u0443\u0434\u0430\u0440\u0435 \u{1F4AA}" },
  { id: "chat_mock_1", trigger: "prep_emoji", weight: 2, text: "\u0421\u0435\u0440\u044C\u0451\u0437\u043D\u043E? \u{1F643}" },
  { id: "chat_mock_2", trigger: "prep_emoji", weight: 2, text: "\u041E\u043A\u0435\u0439, \u0440\u0435\u0436\u0438\u0441\u0441\u0451\u0440 \u{1F3AC}" },
  { id: "chat_love_1", trigger: "prep_emoji", weight: 2, text: "\u041B\u044E\u0431\u043B\u044E \u044D\u0442\u043E\u0442 \u0445\u0430\u043E\u0441 \u{1F495}" },
  { id: "chat_love_2", trigger: "prep_emoji", weight: 2, text: "\u0412\u044B \u043B\u0443\u0447\u0448\u0438\u0435 \u{1FAF6}" },
  { id: "chat_food_priest", trigger: "prep_emoji", classId: "priest", weight: 2, text: "\u041A\u0442\u043E \u0437\u0430\u0431\u044B\u043B \u043F\u0435\u0440\u0435\u043A\u0443\u0441? \u{1F34C}" },
  { id: "chat_food_any", trigger: "prep_emoji", weight: 1, text: "\u0425\u043E\u0447\u0443 \u043F\u0438\u0446\u0446\u0443 \u043F\u043E\u0441\u043B\u0435 \u0440\u0430\u0443\u043D\u0434\u0430 \u{1F355}" },
  { id: "chat_timer_panic", trigger: "prep_emoji", triggerAlso: "prep_timer", weight: 3, text: "\u0410\u0410\u0410 \u0412\u0420\u0415\u041C\u042F \u23F0\u{1F631}" },
  { id: "chat_win_vibe", trigger: "prep_emoji", phase: "early", weight: 2, text: "\u0421\u0435\u0433\u043E\u0434\u043D\u044F \u043D\u0430\u0448 \u0434\u0435\u043D\u044C \u{1F973}" },
  { id: "chat_late_run", trigger: "prep_emoji", phase: "late", weight: 2, text: "\u0424\u0438\u043D\u0438\u0448\u043D\u0430\u044F \u043F\u0440\u044F\u043C\u0430\u044F \u{1F3C1}\u{1F525}" }
];
const DIALOGUE_EMOJI_CATEGORIES = {
  kisses: ["\u{1F618}", "\u{1F61A}", "\u{1F619}", "\u{1F617}", "\u{1F48B}", "\u{1F970}", "\u{1F60D}", "\u{1F48F}", "\u{1F491}"],
  hearts: ["\u2764\uFE0F", "\u{1F9E1}", "\u{1F49B}", "\u{1F49A}", "\u{1F499}", "\u{1F49C}", "\u{1F5A4}", "\u{1F90D}", "\u{1F90E}", "\u{1F495}", "\u{1F49E}", "\u{1F493}", "\u{1F497}", "\u{1F496}", "\u{1F498}", "\u{1F49D}", "\u2665\uFE0F", "\u{1F48C}"],
  hugs: ["\u{1F917}", "\u{1FAC2}", "\u{1F979}", "\u{1FAF6}"],
  flirt: ["\u{1F609}", "\u{1F60F}", "\u{1FAE6}", "\u{1F485}", "\u{1F440}", "\u{1F339}", "\u{1F490}", "\u2728", "\u{1F63C}"],
  silly: ["\u{1F643}", "\u{1F61C}", "\u{1F92A}", "\u{1F61D}", "\u{1F921}", "\u{1F47B}", "\u{1FAE0}", "\u{1F5FF}", "\u{1F480}"],
  hype: ["\u{1F525}", "\u26A1", "\u{1F4A5}", "\u{1F680}", "\u{1F3AF}", "\u{1F451}", "\u{1F3C6}", "\u{1F4AA}", "\u{1F947}", "\u{1F389}", "\u{1F973}", "\u{1F38A}", "\u{1F44F}", "\u{1F64C}"],
  pain: ["\u{1F62D}", "\u{1F622}", "\u{1F97A}", "\u{1F63F}", "\u{1F494}", "\u{1F915}", "\u{1F635}\u200D\u{1F4AB}", "\u{1F616}", "\u{1F62B}"],
  chill: ["\u{1F60C}", "\u{1F642}", "\u{1F60A}", "\u263A\uFE0F", "\u{1F607}", "\u{1F971}", "\u{1F4A4}", "\u{1F375}", "\u{1F9D8}"],
  angry: ["\u{1F624}", "\u{1F620}", "\u{1F4A2}", "\u{1F47F}", "\u{1F621}", "\u{1F92C}"],
  food: ["\u{1F34E}", "\u{1F34C}", "\u{1F96A}", "\u{1F355}", "\u{1F369}", "\u{1F9C3}", "\u{1F36A}", "\u{1F955}", "\u{1F349}", "\u{1F950}"],
  hands: ["\u{1F44D}", "\u{1F44E}", "\u{1F44A}", "\u270A", "\u{1F91D}", "\u{1FAE1}", "\u{1F91E}", "\u270C\uFE0F", "\u{1F91F}", "\u{1F44B}", "\u{1F590}\uFE0F"],
  combo: [
    "\u{1F618}\u2728",
    "\u{1F48B}\u{1F525}",
    "\u{1F970}\u{1F495}",
    "\u{1F60F}\u{1F440}",
    "\u{1F480}\u{1F602}",
    "\u{1F62D}\u{1F64F}",
    "\u{1F525}\u{1F451}",
    "\u{1F4AA}\u{1F624}",
    "\u{1F914}\u{1F4AD}",
    "\u{1F607}\u{1F64F}",
    "\u{1F63C}\u{1F485}",
    "\u{1F440}\u{1F37F}",
    "\u{1F97A}\u{1F449}\u{1F448}",
    "\u{1F485}\u{1F60C}",
    "\u{1FAF6}\u2728",
    "\u{1F618}\u{1F48B}",
    "\u{1F970}\u{1F339}",
    "\u{1F60F}\u{1F525}",
    "\u{1F495}\u{1F61A}",
    "\u{1F643}\u{1F480}",
    "\u{1F624}\u2694\uFE0F",
    "\u{1F52E}\u2728",
    "\u{1F34C}\u{1F607}",
    "\u{1F5E1}\uFE0F\u{1F60F}"
  ]
};
const CLASS_EMOJI_CATEGORY_BIAS = {
  warrior: ["hype", "angry", "hands", "combo"],
  rogue: ["flirt", "silly", "combo", "kisses"],
  mage: ["combo", "chill", "hype", "hearts"],
  priest: ["hearts", "hugs", "food", "kisses"]
};
const DIALOGUE_EMOJI_REPLY_MAP = {
  kisses: ["\u{1F618}", "\u{1F970}", "\u{1F60D}", "\u{1F48B}", "\u{1F61A}", "\u{1FAF6}"],
  hearts: ["\u{1F495}", "\u2764\uFE0F", "\u{1F970}", "\u{1F496}", "\u{1F49E}", "\u{1FAF6}"],
  hugs: ["\u{1F917}", "\u{1FAC2}", "\u{1F979}", "\u{1FAF6}"],
  flirt: ["\u{1F60F}", "\u{1F609}", "\u{1F440}", "\u{1F63C}", "\u{1F485}"],
  silly: ["\u{1F643}", "\u{1F61C}", "\u{1F480}", "\u{1F5FF}", "\u{1F602}"],
  hype: ["\u{1F525}", "\u{1F4AA}", "\u{1F973}", "\u{1F44F}", "\u26A1"],
  pain: ["\u{1F97A}", "\u{1FAC2}", "\u{1F622}", "\u{1F64F}", "\u{1F494}"],
  chill: ["\u{1F60C}", "\u{1F642}", "\u{1F44D}", "\u{1FAE1}"],
  angry: ["\u{1F624}", "\u{1F4A2}", "\u{1F47F}", "\u{1F644}"],
  food: ["\u{1F60B}", "\u{1F924}", "\u{1F355}", "\u{1F34C}", "\u{1F64F}"],
  hands: ["\u{1F44D}", "\u{1F91D}", "\u{1FAE1}", "\u270C\uFE0F", "\u{1F44B}"],
  combo: ["\u{1F525}", "\u{1F618}", "\u{1F480}\u{1F602}", "\u{1F970}\u2728", "\u{1F440}\u{1F37F}", "\u{1F60F}\u{1F451}"],
  default: ["\u{1F440}", "\u{1F60F}", "\u{1F525}", "\u{1F970}", "\u{1F480}", "\u{1F44D}", "\u{1F618}"]
};
function flattenDialogueEmojiPool() {
  const all = [];
  Object.values(DIALOGUE_EMOJI_CATEGORIES).forEach((list) => {
    list.forEach((emoji) => all.push(emoji));
  });
  return all;
}
const DIALOGUE_EMOJI_FLAT_POOL = flattenDialogueEmojiPool();
function isDialogueEmojiOnly(text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  if (/^[\p{Extended_Pictographic}\u200d\uFE0F\u20e3\s]+$/u.test(raw)) return true;
  return raw.length <= 8 && !/[a-zA-Zа-яА-ЯёЁ0-9]/.test(raw);
}
function categorizeDialogueEmoji(text) {
  const raw = String(text || "").trim();
  for (const [cat, list] of Object.entries(DIALOGUE_EMOJI_CATEGORIES)) {
    if (list.some((emoji) => raw.includes(emoji) || emoji.includes(raw))) return cat;
  }
  if (isDialogueEmojiOnly(raw)) return "combo";
  return "default";
}
function pickFromList(list) {
  if (!list?.length) return "\u{1F60F}";
  return list[Math.floor(Math.random() * list.length)];
}
function pickDialogueEmoji(opts = {}) {
  const classId = opts.classId;
  const bias = CLASS_EMOJI_CATEGORY_BIAS[classId];
  if (bias?.length && Math.random() > 0.28) {
    const cat = bias[Math.floor(Math.random() * bias.length)];
    const pool = DIALOGUE_EMOJI_CATEGORIES[cat];
    if (pool?.length) return pickFromList(pool);
  }
  return pickFromList(DIALOGUE_EMOJI_FLAT_POOL);
}
function pickDialogueEmojiReply(incomingText, classId) {
  const cat = categorizeDialogueEmoji(incomingText);
  const pool = DIALOGUE_EMOJI_REPLY_MAP[cat] || DIALOGUE_EMOJI_REPLY_MAP.default;
  if (Math.random() > 0.55) return pickDialogueEmoji({ classId });
  return pickFromList(pool);
}
function buildRandomEmojiLine(classId) {
  const emoji = pickDialogueEmoji({ classId });
  return {
    id: `emoji_dyn_${emoji}_${Math.random().toString(36).slice(2, 7)}`,
    trigger: "prep_emoji",
    text: emoji,
    emojiOnly: true,
    weight: 1
  };
}
function buildTextEmojiLine(classId) {
  const templates = [
    "\u043E\u0433\u043E {e}",
    "\u0441\u043C\u043E\u0442\u0440\u0438 {e}",
    "\u044D\u0442\u043E \u044F {e}",
    "\u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u0435 {e}",
    "\u043F\u043E\u0439\u043C\u0430\u043B\u0430 \u0432\u0430\u0439\u0431 {e}",
    "\u0434\u0435\u0440\u0436\u0438 {e}",
    "\u0442\u0435\u0431\u0435 {e}",
    "\u043D\u0443 {e}",
    "\u043B\u043E\u043B {e}",
    "\u043F\u043E\u0433\u043D\u0430\u043B\u0438 {e}"
  ];
  const emoji = pickDialogueEmoji({ classId });
  const tpl = templates[Math.floor(Math.random() * templates.length)];
  return {
    id: `chat_dyn_${emoji}_${Math.random().toString(36).slice(2, 7)}`,
    trigger: "prep_emoji",
    text: tpl.replace("{e}", emoji),
    emojiOnly: false,
    weight: 1
  };
}
function pickDialogueEmojiMessage(classId) {
  if (Math.random() > 0.55) return buildRandomEmojiLine(classId);
  return buildTextEmojiLine(classId);
}
function getDialogueRunPhase(round = 1) {
  const r = Math.max(1, round);
  for (const [key, band] of Object.entries(DIALOGUE_RUN_PHASES)) {
    if (r >= band.minRound && r <= band.maxRound) return key;
  }
  return r <= 2 ? "opening" : r <= 6 ? "early" : r <= 11 ? "mid" : "late";
}
function getHeroDialogueVoice(classId) {
  return HERO_DIALOGUE_VOICES[classId] || {
    classId: classId || "warrior",
    label: "\u0413\u0435\u0440\u043E\u0439",
    traits: ["\u0437\u0430\u0433\u0430\u0434\u043E\u0447\u043D\u044B\u0439"],
    interests: ["\u043F\u043E\u0431\u0435\u0434\u0430"],
    tone: "\u043D\u0435\u0439\u0442\u0440\u0430\u043B\u044C\u043D\u044B\u0439",
    emoji: "\u{1F4AD}"
  };
}
function resolveDialogueLineText(line, classId) {
  if (!line) return "";
  if (line.text) return line.text;
  if (line.texts && classId && line.texts[classId]) return line.texts[classId];
  if (line.texts) {
    const keys = Object.keys(line.texts);
    return line.texts[keys[Math.floor(Math.random() * keys.length)]];
  }
  return "";
}
function isDialogueLineEmojiOnly(line, classId) {
  if (line?.emojiOnly) return true;
  const text = resolveDialogueLineText(line, classId);
  return isDialogueEmojiOnly(text);
}
function getDialogueLinesForTrigger(trigger, ctx = {}) {
  const phase = ctx.phase || getDialogueRunPhase(ctx.round || 1);
  return DIALOGUE_LINES.filter((line) => {
    if (line.trigger !== trigger && line.triggerAlso !== trigger) return false;
    if (line.phase && line.phase !== phase) return false;
    if (line.classId && line.classId !== ctx.classId) return false;
    if (line.fromClass && line.fromClass !== ctx.fromClass) return false;
    if (line.toClass && line.toClass !== ctx.toClass) return false;
    if (line.minTimer != null && (ctx.timerRemaining ?? 99) > line.minTimer) return false;
    if (line.maxTimer != null && (ctx.timerRemaining ?? 99) > line.maxTimer) return false;
    if (line.maxHpPct != null && (ctx.hpPct ?? 1) > line.maxHpPct) return false;
    if (line.replyTo && !line.replyTo.includes(ctx.replyToLineId)) return false;
    return true;
  });
}
function pickWeightedDialogueLine(lines) {
  if (!lines?.length) return null;
  const total = lines.reduce((sum, line) => sum + (line.weight || 1), 0);
  let roll = Math.random() * total;
  for (const line of lines) {
    roll -= line.weight || 1;
    if (roll <= 0) return line;
  }
  return lines[lines.length - 1];
}
function findDialogueLineById(id) {
  return DIALOGUE_LINES.find((line) => line.id === id) || null;
}
function findBanterLine(fromClass, toClass) {
  const lines = DIALOGUE_LINES.filter((line) => line.trigger === "prep_banter" && line.fromClass === fromClass && line.toClass === toClass);
  return pickWeightedDialogueLine(lines);
}
window.HERO_DIALOGUE_VOICES = HERO_DIALOGUE_VOICES;
window.DIALOGUE_LINES = DIALOGUE_LINES;
window.getDialogueRunPhase = getDialogueRunPhase;
window.getHeroDialogueVoice = getHeroDialogueVoice;
window.resolveDialogueLineText = resolveDialogueLineText;
window.getDialogueLinesForTrigger = getDialogueLinesForTrigger;
window.pickWeightedDialogueLine = pickWeightedDialogueLine;
window.findDialogueLineById = findDialogueLineById;
window.findBanterLine = findBanterLine;
window.DIALOGUE_EMOJI_CATEGORIES = DIALOGUE_EMOJI_CATEGORIES;
window.isDialogueEmojiOnly = isDialogueEmojiOnly;
window.isDialogueLineEmojiOnly = isDialogueLineEmojiOnly;
window.pickDialogueEmoji = pickDialogueEmoji;
window.pickDialogueEmojiReply = pickDialogueEmojiReply;
window.pickDialogueEmojiMessage = pickDialogueEmojiMessage;
window.buildRandomEmojiLine = buildRandomEmojiLine;
