// @ts-nocheck — большой каталог реплик, слабая схема line-объектов
/**
 * Каталог диалогов — голоса героев, интересы, реплики и цепочки ответов.
 * Один забег = одна сквозная «переписка» с памятью о сказанном.
 */

const DIALOGUE_RUN_PHASES = {
  opening: { minRound: 1, maxRound: 2 },
  early: { minRound: 3, maxRound: 6 },
  mid: { minRound: 7, maxRound: 11 },
  late: { minRound: 12, maxRound: 16 },
};

const HERO_DIALOGUE_VOICES = {
  warrior: {
    classId: "warrior",
    label: "Мартовичок",
    traits: ["упрямый", "прямолинейный", "гордый"],
    interests: ["мечи", "броня", "выживание", "честный бой"],
    tone: "грубоватый, но надёжный",
    emoji: "😤",
  },
  rogue: {
    classId: "rogue",
    label: "Роксивичок",
    traits: ["язвительный", "быстрый", "любит хайп"],
    interests: ["ловушки", "яд", "чат", "неожиданности"],
    tone: "колкий, с подколами",
    emoji: "😏",
  },
  mage: {
    classId: "mage",
    label: "Морковичок",
    traits: ["театральный", "расчётливый", "любопытный"],
    interests: ["магия", "кристаллы", "синергии", "эксперименты"],
    tone: "чуть высокомерный интеллектуал",
    emoji: "🤔",
  },
  priest: {
    classId: "priest",
    label: "Мыковичок",
    traits: ["заботливый", "оптимистичный", "драматичный"],
    interests: ["еда", "лечение", "перекусы", "мораль"],
    tone: "тёплый, с оперными нотками",
    emoji: "🙏",
  },
};

/** @type {Array<object>} */
const DIALOGUE_LINES = [
  // ─── Старт забега ───
  { id: "open_warrior_1", trigger: "run_open", classId: "warrior", phase: "opening", weight: 3,
    text: "Я не для красоты на поле. Кто первый — тот и арбуз." },
  { id: "open_rogue_1", trigger: "run_open", classId: "rogue", phase: "opening", weight: 3,
    text: "Ладно, звери, не обижайтесь: я уже записываю ваши ошибки в чат." },
  { id: "open_mage_1", trigger: "run_open", classId: "mage", phase: "opening", weight: 3,
    text: "Сцена готова. Посмотрим, чья сборка красивее на бумаге — и в бою." },
  { id: "open_priest_1", trigger: "run_open", classId: "priest", phase: "opening", weight: 3,
    text: "Дети, перекусите перед боем. Голодный герой — плохой хор!" },

  { id: "open_reply_calm", trigger: "reply", replyTo: ["open_warrior_1", "open_rogue_1", "open_mage_1", "open_priest_1"], weight: 2,
    texts: {
      warrior: "Словами не возьмёшь. Только рюкзаком.",
      rogue: "О, речь пошла. Значит, уже страшно.",
      mage: "Риторика — тоже ресурс. Но урон важнее.",
      priest: "Я принесу бананы. Остальное — судьба.",
    } },

  // ─── Prep: покупки / сборка ───
  { id: "prep_shop_warrior", trigger: "prep_shop", classId: "warrior", weight: 2,
    text: "Ещё одна железка — и я перестану помещаться в кружок." },
  { id: "prep_shop_rogue", trigger: "prep_shop", classId: "rogue", weight: 2,
    text: "Магазин любит меня. Я люблю скидки. Всё честно." },
  { id: "prep_shop_mage", trigger: "prep_shop", classId: "mage", phase: "early", weight: 2,
    text: "Кристалл блестит правильно. Это знак. Наверное." },
  { id: "prep_shop_priest", trigger: "prep_shop", classId: "priest", weight: 2,
    text: "Яблоко в рюкзаке — это не жадность, это вера." },

  { id: "prep_build_focus", trigger: "prep_idle", weight: 1,
    texts: {
      warrior: "Сетка не прощает слабых. Хорошо, что я упрямый.",
      rogue: "Поворот на один градус — и враг уже не понимает, что случилось.",
      mage: "Синергия щёлкнула. Слышали? Нет? Жаль.",
      priest: "Мой рюкзак пахнет надеждой и сушёными фруктами.",
    } },

  // ─── Соперник раунда ───
  { id: "prep_opponent_warrior", trigger: "prep_opponent", classId: "warrior", weight: 3,
    text: "Ты следующий. Не обижайся заранее." },
  { id: "prep_opponent_rogue", trigger: "prep_opponent", classId: "rogue", weight: 3,
    text: "О, мой любимый соперник. Уже скучаю по твоему HP." },
  { id: "prep_opponent_mage", trigger: "prep_opponent", classId: "mage", weight: 3,
    text: "Противник выбран. Теория говорит: будет больно." },
  { id: "prep_opponent_priest", trigger: "prep_opponent", classId: "priest", weight: 3,
    text: "Пусть победит достойный. Но если голоден — скажи." },

  { id: "prep_opponent_reply", trigger: "reply", replyTo: ["prep_opponent_warrior", "prep_opponent_rogue", "prep_opponent_mage", "prep_opponent_priest"], weight: 2,
    texts: {
      warrior: "Сначала дождись моего удара.",
      rogue: "Ты всегда такая смелая до первой синергии?",
      mage: "Статистика на моей стороне. Почти всегда.",
      priest: "Я помолюсь за нас обоих. Но сильнее — за себя.",
    } },

  // ─── Таймер подготовки ───
  { id: "prep_timer_low", trigger: "prep_timer", minTimer: 0, maxTimer: 12, weight: 4,
    texts: {
      warrior: "Время! Я ещё даже кулак не размял!",
      rogue: "Тик-так. Люблю, когда все паникуют одновременно.",
      mage: "Дедлайн — лучший катализатор магии.",
      priest: "Дети, не бегайте с полным ртом!",
    } },

  { id: "prep_timer_reply", trigger: "reply", replyTo: ["prep_timer_low"], weight: 2,
    texts: {
      warrior: "Паника — для слабых. Я просто злюсь.",
      rogue: "Ещё пять секунд — и я притворюсь, что готов.",
      mage: "Хаос ускоряет метаболизм маны. Наверное.",
      priest: "Господи, дай им хотя бы один ход мысли.",
    } },

  // ─── Середина забега ───
  { id: "mid_run_warrior", trigger: "prep_idle", classId: "warrior", phase: "mid", weight: 2,
    text: "Половина забега позади. Я ещё стою. Это уже победа." },
  { id: "mid_run_rogue", trigger: "prep_idle", classId: "rogue", phase: "mid", weight: 2,
    text: "Середина — мой любимый акт. Все уже устали, а я нет." },
  { id: "mid_run_mage", trigger: "prep_idle", classId: "mage", phase: "mid", weight: 2,
    text: "Кривая силы выходит на плато. Пора взрывать мету." },
  { id: "mid_run_priest", trigger: "prep_idle", classId: "priest", phase: "mid", weight: 2,
    text: "Мы живы — значит, бог перекусов доволен." },

  // ─── Поздний забег ───
  { id: "late_run_warrior", trigger: "prep_idle", classId: "warrior", phase: "late", weight: 3,
    text: "Финал близко. Кто дрогнет — тот лопнет, как я в шутку." },
  { id: "late_run_rogue", trigger: "prep_idle", classId: "rogue", phase: "late", weight: 3,
    text: "Осталось мало раундов. Идеально для грязного трюка." },
  { id: "late_run_mage", trigger: "prep_idle", classId: "mage", phase: "late", weight: 3,
    text: "Сейчас или никогда. Мой посох дрожит от важности." },
  { id: "late_run_priest", trigger: "prep_idle", classId: "priest", phase: "late", weight: 3,
    text: "Финал! Помните: даже герой должен есть между ударами." },

  // ─── Низкое HP ───
  { id: "low_hp_any", trigger: "low_hp", maxHpPct: 0.35, weight: 4,
    texts: {
      warrior: "Мало HP? Зато много характера.",
      rogue: "Кровь — это просто красный дебафф. Норм.",
      mage: "Критическая масса достигнута. Шучу. Мне больно.",
      priest: "Я ещё пою. Значит, ещё жив.",
    } },

  { id: "low_hp_reply", trigger: "reply", replyTo: ["low_hp_any"], weight: 2,
    texts: {
      warrior: "Держись. Или хотя бы не падай на мою сетку.",
      rogue: "Не ной. Это мешает наслаждаться драмой.",
      mage: "Регенерация — социальный конструкт.",
      priest: "Съешь что-нибудь. Серьёзно.",
    } },

  // ─── После боя ───
  { id: "post_win", trigger: "post_battle_win", weight: 3,
    texts: {
      warrior: "Ещё один раунд. Ещё один шрам для статистики.",
      rogue: "Победа записана. Скриншот в чат — опционально.",
      mage: "Гипотеза подтверждена. Боль — побочный эффект.",
      priest: "Слава победителю! И тем, кто принёс закуски.",
    } },
  { id: "post_loss", trigger: "post_battle_loss", weight: 3,
    texts: {
      warrior: "Проиграл? Значит, в следующий раз ударю сильнее.",
      rogue: "Поражение — это контент. Спасибо за просмотр.",
      mage: "Аномалия в данных. Пересчитаю билд.",
      priest: "Поражение горькое. Как несоленый суп.",
    } },

  { id: "post_battle_reply", trigger: "reply", replyTo: ["post_win", "post_loss"], weight: 2,
    texts: {
      warrior: "Следующий раунд начнётся без жалоб.",
      rogue: "Главное — чтобы зрителям было весело.",
      mage: "Наука требует жертв. Обычно — HP.",
      priest: "Обнимите рюкзак и идите дальше.",
    } },

  // ─── Бантер между случайными участниками ───
  { id: "banter_warrior_rogue", trigger: "prep_banter", fromClass: "warrior", toClass: "rogue", weight: 2,
    text: "Перестань вертеться. У меня от этого меч сводит.",
    reply: { rogue: "Верчусь — потому что ты промахиваешься красиво." } },
  { id: "banter_mage_priest", trigger: "prep_banter", fromClass: "mage", toClass: "priest", weight: 2,
    text: "Твои бананы не складываются в синергию.",
    reply: { priest: "А твоя гордыня не лечит HP, деточка." } },
  { id: "banter_rogue_mage", trigger: "prep_banter", fromClass: "rogue", toClass: "mage", weight: 2,
    text: "Сколько кристаллов — столько и оправданий.",
    reply: { mage: "Сколько подколов — столько и будущих поражений." } },
  { id: "banter_priest_warrior", trigger: "prep_banter", fromClass: "priest", toClass: "warrior", weight: 2,
    text: "Ты снова забыл поесть перед боем.",
    reply: { warrior: "Я забыл только страх. Еда подождёт." } },

  // ─── Текст + эмодзи (чат-стиль) ───
  { id: "chat_flirt_rogue", trigger: "prep_emoji", classId: "rogue", weight: 2, text: "Ты сегодня опасно хороша 😏" },
  { id: "chat_flirt_mage", trigger: "prep_emoji", classId: "mage", weight: 2, text: "Эта сборка — чистая эстетика ✨" },
  { id: "chat_flirt_priest", trigger: "prep_emoji", classId: "priest", weight: 2, text: "Обнимашки перед боем? 🥰" },
  { id: "chat_flirt_warrior", trigger: "prep_emoji", classId: "warrior", weight: 2, text: "Смотри в глаза, не на мой меч 😤" },
  { id: "chat_hype_1", trigger: "prep_emoji", weight: 2, text: "Погнали! 🔥" },
  { id: "chat_hype_2", trigger: "prep_emoji", weight: 2, text: "Это будет легенда 👑" },
  { id: "chat_hype_3", trigger: "prep_emoji", weight: 2, text: "Я в ударе 💪" },
  { id: "chat_mock_1", trigger: "prep_emoji", weight: 2, text: "Серьёзно? 🙃" },
  { id: "chat_mock_2", trigger: "prep_emoji", weight: 2, text: "Окей, режиссёр 🎬" },
  { id: "chat_love_1", trigger: "prep_emoji", weight: 2, text: "Люблю этот хаос 💕" },
  { id: "chat_love_2", trigger: "prep_emoji", weight: 2, text: "Вы лучшие 🫶" },
  { id: "chat_food_priest", trigger: "prep_emoji", classId: "priest", weight: 2, text: "Кто забыл перекус? 🍌" },
  { id: "chat_food_any", trigger: "prep_emoji", weight: 1, text: "Хочу пиццу после раунда 🍕" },
  { id: "chat_timer_panic", trigger: "prep_emoji", triggerAlso: "prep_timer", weight: 3, text: "ААА ВРЕМЯ ⏰😱" },
  { id: "chat_win_vibe", trigger: "prep_emoji", phase: "early", weight: 2, text: "Сегодня наш день 🥳" },
  { id: "chat_late_run", trigger: "prep_emoji", phase: "late", weight: 2, text: "Финишная прямая 🏁🔥" },
];

/** Категории чистых эмодзи-сообщений (как в мессенджере). */
const DIALOGUE_EMOJI_CATEGORIES = {
  kisses: ["😘", "😚", "😙", "😗", "💋", "🥰", "😍", "💏", "💑"],
  hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "♥️", "💌"],
  hugs: ["🤗", "🫂", "🥹", "🫶"],
  flirt: ["😉", "😏", "🫦", "💅", "👀", "🌹", "💐", "✨", "😼"],
  silly: ["🙃", "😜", "🤪", "😝", "🤡", "👻", "🫠", "🗿", "💀"],
  hype: ["🔥", "⚡", "💥", "🚀", "🎯", "👑", "🏆", "💪", "🥇", "🎉", "🥳", "🎊", "👏", "🙌"],
  pain: ["😭", "😢", "🥺", "😿", "💔", "🤕", "😵‍💫", "😖", "😫"],
  chill: ["😌", "🙂", "😊", "☺️", "😇", "🥱", "💤", "🍵", "🧘"],
  angry: ["😤", "😠", "💢", "👿", "😡", "🤬"],
  food: ["🍎", "🍌", "🥪", "🍕", "🍩", "🧃", "🍪", "🥕", "🍉", "🥐"],
  hands: ["👍", "👎", "👊", "✊", "🤝", "🫡", "🤞", "✌️", "🤟", "👋", "🖐️"],
  combo: [
    "😘✨", "💋🔥", "🥰💕", "😏👀", "💀😂", "😭🙏", "🔥👑", "💪😤",
    "🤔💭", "😇🙏", "😼💅", "👀🍿", "🥺👉👈", "💅😌", "🫶✨", "😘💋",
    "🥰🌹", "😏🔥", "💕😚", "🙃💀", "😤⚔️", "🔮✨", "🍌😇", "🗡️😏",
  ],
};

/** Предпочтения классов — чаще шлют эти категории. */
const CLASS_EMOJI_CATEGORY_BIAS = {
  warrior: ["hype", "angry", "hands", "combo"],
  rogue: ["flirt", "silly", "combo", "kisses"],
  mage: ["combo", "chill", "hype", "hearts"],
  priest: ["hearts", "hugs", "food", "kisses"],
};

/** Ответ-эмодзи на входящее сообщение. */
const DIALOGUE_EMOJI_REPLY_MAP = {
  kisses: ["😘", "🥰", "😍", "💋", "😚", "🫶"],
  hearts: ["💕", "❤️", "🥰", "💖", "💞", "🫶"],
  hugs: ["🤗", "🫂", "🥹", "🫶"],
  flirt: ["😏", "😉", "👀", "😼", "💅"],
  silly: ["🙃", "😜", "💀", "🗿", "😂"],
  hype: ["🔥", "💪", "🥳", "👏", "⚡"],
  pain: ["🥺", "🫂", "😢", "🙏", "💔"],
  chill: ["😌", "🙂", "👍", "🫡"],
  angry: ["😤", "💢", "👿", "🙄"],
  food: ["😋", "🤤", "🍕", "🍌", "🙏"],
  hands: ["👍", "🤝", "🫡", "✌️", "👋"],
  combo: ["🔥", "😘", "💀😂", "🥰✨", "👀🍿", "😏👑"],
  default: ["👀", "😏", "🔥", "🥰", "💀", "👍", "😘"],
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
  if (!list?.length) return "😏";
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
    weight: 1,
  };
}

function buildTextEmojiLine(classId) {
  const templates = [
    "ого {e}", "смотри {e}", "это я {e}", "настроение {e}", "поймала вайб {e}",
    "держи {e}", "тебе {e}", "ну {e}", "лол {e}", "погнали {e}",
  ];
  const emoji = pickDialogueEmoji({ classId });
  const tpl = templates[Math.floor(Math.random() * templates.length)];
  return {
    id: `chat_dyn_${emoji}_${Math.random().toString(36).slice(2, 7)}`,
    trigger: "prep_emoji",
    text: tpl.replace("{e}", emoji),
    emojiOnly: false,
    weight: 1,
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
  return r <= 2 ? "opening" : (r <= 6 ? "early" : (r <= 11 ? "mid" : "late"));
}

function getHeroDialogueVoice(classId) {
  return HERO_DIALOGUE_VOICES[classId] || {
    classId: classId || "warrior",
    label: "Герой",
    traits: ["загадочный"],
    interests: ["победа"],
    tone: "нейтральный",
    emoji: "💭",
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
  const lines = DIALOGUE_LINES.filter((line) => line.trigger === "prep_banter"
    && line.fromClass === fromClass
    && line.toClass === toClass);
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
