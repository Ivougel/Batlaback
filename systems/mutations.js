/**
 * Мутации и спутники — каталог, прогресс, бонусы забега.
 * @see docs/mutations-gdd.md
 */

const MUTATION_ROUND_FORM = 8;
const MUTATION_ROUND_FINAL = 16;
const MUTATION_FORM_THRESHOLD = 0.4;
const MUTATION_FINAL_THRESHOLD = 0.55;

function getMutationFormThresholdPct() {
  return Math.round(MUTATION_FORM_THRESHOLD * 100);
}

function getMutationFinalThresholdPct() {
  return Math.round(MUTATION_FINAL_THRESHOLD * 100);
}

function getMutationMilestoneSharePct(progress) {
  return Math.round((progress?.leaderShare ?? progress?.leaderPct ?? 0) * 100);
}

function getMutationMilestoneEyebrow(round) {
  if (round >= MUTATION_ROUND_FINAL) return "мутация";
  if (round >= MUTATION_ROUND_FORM) return "трансформация";
  return "развитие";
}

function getMutationProgressPathContext(progress, formId, mutationId) {
  if (mutationId) {
    const def = getMutationById(mutationId);
    return { pathId: mutationId, targetName: def?.name || mutationId, mode: "mutation" };
  }
  if (formId) {
    const def = getMutationById(formId);
    return { pathId: formId, targetName: def?.formName || formId, mode: "form" };
  }
  const dominant = progress?.dominant || progress?.ranked?.[0] || null;
  const leader = progress?.leader || null;
  const blended = !!progress?.isBlendedBuild && dominant && leader && dominant.id !== leader.id;
  const path = blended ? dominant : (leader || dominant);
  return {
    pathId: path?.id || null,
    targetName: path?.name || "—",
    mode: "growth",
    blended,
    blendedLabel: blended ? leader?.name : null,
  };
}

const MUTATION_TAG_FAMILIES = [
  "melee", "weapon", "magic", "holy", "poison", "fire", "cold", "armor", "shield",
  "heal", "pet", "luck", "musical", "gem", "debuff", "vampiric", "food", "nature", "utility", "speed",
];

const COMPANION_CATALOG = {
  s_stranger: {
    id: "s_stranger",
    name: "Странник",
    emoji: "🐣",
    desc: "Все характеристики +1%. Экип без ограничений.",
    equipRestrict: [],
    combat: { allMult: 0.01 },
    mutationBias: ["w_veteran", "r_rogue", "m_sage", "p_hermit"],
  },
  s_blade: {
    id: "s_blade",
    name: "Дух мечника",
    emoji: "⚔️",
    desc: "Физический урон +4%. Магический урон −12%.",
    equipRestrict: [],
    combat: { damageMult: 0.04, magicDamageMult: -0.12 },
    mutationBias: ["w_guardian", "w_berserk", "w_crusader", "p_paladin", "r_plague", "m_battlemage"],
  },
  s_spark: {
    id: "s_spark",
    name: "Огненная искорка",
    emoji: "🔥",
    desc: "Огненные эффекты +8%. Холодные −10%.",
    equipRestrict: [],
    combat: { fireTagMult: 0.08, coldTagMult: -0.1 },
    mutationBias: ["m_pyro", "p_inquisitor", "p_zrecrela"],
  },
  s_frost: {
    id: "s_frost",
    name: "Ледяная крупинка",
    emoji: "❄️",
    desc: "Холодные эффекты +8%. Огненные −10%.",
    equipRestrict: [],
    combat: { coldTagMult: 0.08, fireTagMult: -0.1 },
    mutationBias: ["m_cryo", "m_seer"],
  },
  s_arcane: {
    id: "s_arcane",
    name: "Искра арканы",
    emoji: "✨",
    desc: "Магический урон +6%. Физический −8%. Нельзя двуручное оружие.",
    equipRestrict: ["no_two_hand"],
    combat: { magicDamageMult: 0.06, damageMult: -0.08 },
    mutationBias: ["m_arcanist", "p_discipline"],
  },
  s_shadow: {
    id: "s_shadow",
    name: "Тень",
    emoji: "🌑",
    desc: "Яд +8%, предметы быстрее. Блок слабее. Нельзя щит.",
    equipRestrict: ["no_shield"],
    combat: { poisonTagMult: 0.08, cooldownMult: -0.04, shieldBlockMult: -0.1 },
    mutationBias: ["r_assassin", "r_shadow", "r_nightblade"],
  },
  s_light: {
    id: "s_light",
    name: "Свет",
    emoji: "🌟",
    desc: "Святой урон +8%, лечение +6%.",
    equipRestrict: [],
    combat: { holyTagMult: 0.08, healTagMult: 0.06 },
    mutationBias: ["p_paladin", "p_zrecrela", "p_oracle", "p_hierophant", "r_bard", "w_crusader"],
  },
};

const MUTATION_FORM_PERK = "Предметы перезаряжаются на 2% быстрее";

const MUTATION_CAPSTONE_DESCS = {
  w_guardian: "При блоке выше 25: раз в 8 с отражает 20% святого урона",
  w_berserk: "Ниже половины HP: +12% к урону и −8% к получаемому (один раз)",
  w_crusader: "15% физического урона превращается в блок; святые предметы рядом перезаряжаются быстрее",
  w_duelist: "Первый удар каждые 5 с: +25% урона и дополнительная уязвимость врагу",
  w_juggernaut: "Стоите на месте — +2 блока в секунду (максимум +10)",
  w_gladiator: "30% шанс колющего ответа, когда по вам попадают",
  w_breaker: "Каждый четвёртый удар снижает блок врага на 30% на 3 с",
  w_veteran: "+1% ко всем характеристикам за каждый тип предметов в рюкзаке (до +5%)",
  r_assassin: "При 3+ стаках яда на враге: следующий удар +35% (раз в 6 с)",
  r_bard: "Раз в 7 с гимн: +8 блока, −1 стамина врагу, музыкальные предметы быстрее",
  r_plague: "Яд накладывает кровотечение; яд и кровотечение усиливают друг друга на 8%",
  r_trickster: "Раз в 9 с крадёт у врага один положительный эффект",
  r_shadow: "Первые 10 с боя: +15% к уклонению",
  r_nightblade: "8% урона от яда превращается в лечение",
  r_scout: "Питомцы и ядовитые предметы: +10% к периодическому урону",
  r_rogue: "+1 золото за раунд, продажа на 5% выгоднее, бонус за разнообразие предметов",
  m_pyro: "Каждый пятый огненный тик разогревает все огненные предметы в рюкзаке",
  m_cryo: "При 4+ стаках льда на враге: 1,5 с замедления (−20% перезарядки врага)",
  m_arcanist: "+2 к максимуму стаков маны",
  m_elementalist: "Нечётные активации +8% огня, чётные +8% льда",
  m_battlemage: "После магического удара: следующий ближний +20% (2 с)",
  m_chaos: "10% срабатываний дают случайный бонус от соседних предметов",
  m_sage: "+0,5% к магическому урону за каждый тип предметов в рюкзаке (до +4%)",
  m_seer: "Раз в 8 с: следующий удар врага наносит на 25% меньше урона",
  p_paladin: "12% урона превращается в блок; при блоке выше 30 следующий святой удар +25%",
  p_discipline: "Раз в 5 с: стак Покаяния (+8% к получаемому святому и магическому урону)",
  p_zrecrela: "Раз в 6 с гимн: снимает дебафф, −1 стамина врагу, святые предметы рядом сильнее",
  p_oracle: "Лечение до 90% HP без штрафа насыщения",
  p_plague: "Святые периодические эффекты также накладывают яд (50% силы)",
  p_hierophant: "Святые эффекты на 15% сильнее",
  p_inquisitor: "Против врага с 2+ дебаффами: святой и огненный урон +10%",
  p_hermit: "+1% ко всем характеристикам за тип предметов; лечение и еда не конфликтуют",
};

function mut(id, noviceClass, name, formName, weights, opts = {}) {
  return {
    id,
    noviceClass,
    name,
    formName,
    tagWeights: weights,
    companionBias: opts.companionBias || [],
    diversity: !!opts.diversity,
    minFamilies: opts.minFamilies || 4,
    maxLeaderPct: opts.maxLeaderPct ?? 0.35,
    requiresCompanion: opts.requiresCompanion || null,
    capstoneId: opts.capstoneId || id,
    capstoneDesc: MUTATION_CAPSTONE_DESCS[id] || opts.capstoneDesc || "",
    formPerk: MUTATION_FORM_PERK,
  };
}

const MUTATION_CATALOG = {
  w_guardian: mut("w_guardian", "warrior", "СТРАЖ", "Щитоносец", { shield: 3, armor: 2 }, { companionBias: ["s_blade"] }),
  w_berserk: mut("w_berserk", "warrior", "БЕРСЕРК", "Задира", { melee: 3, weapon: 2 }, { companionBias: ["s_blade"] }),
  w_crusader: mut("w_crusader", "warrior", "КРЕСТОНОСЕЦ", "Послушник", { holy: 3, melee: 2 }, { companionBias: ["s_light", "s_blade"] }),
  w_duelist: mut("w_duelist", "warrior", "ДУЭЛЯНТ", "Фехтовальщик", { melee: 2, weapon: 2, speed: 2 }, { companionBias: ["s_shadow"] }),
  w_juggernaut: mut("w_juggernaut", "warrior", "КОЛОСС", "Ополченец", { armor: 4, shield: 1 }, { companionBias: ["s_blade"] }),
  w_gladiator: mut("w_gladiator", "warrior", "ГЛАДИАТОР", "Боец ямы", { melee: 2, debuff: 2 }, { companionBias: ["s_shadow"] }),
  w_breaker: mut("w_breaker", "warrior", "СЛОМАТЕЛЬ", "Крушитель", { weapon: 3, melee: 2 }, { companionBias: ["s_blade"] }),
  w_veteran: mut("w_veteran", "warrior", "ВЕТЕРАН", "Странник войны", {}, { diversity: true, requiresCompanion: "s_stranger" }),

  r_assassin: mut("r_assassin", "rogue", "АССАСИН", "Клинок", { poison: 3, melee: 2 }, { companionBias: ["s_shadow"] }),
  r_bard: mut("r_bard", "rogue", "БАРД", "Скрипач", { holy: 2, musical: 3 }, { companionBias: ["s_light", "s_spark"] }),
  r_plague: mut("r_plague", "rogue", "ЧУМНОЙ", "Заражённый", { poison: 3, armor: 1, melee: 1 }, { companionBias: ["s_blade"] }),
  r_trickster: mut("r_trickster", "rogue", "ПЛУТ", "Мошенник", { luck: 3, debuff: 2, utility: 1 }, { companionBias: ["s_stranger"] }),
  r_shadow: mut("r_shadow", "rogue", "ТЕНЬ", "Беглец", { melee: 2, speed: 2 }, { companionBias: ["s_shadow"] }),
  r_nightblade: mut("r_nightblade", "rogue", "НОЧНОЙ КЛИНОК", "Губитель", { poison: 2, vampiric: 2 }, { companionBias: ["s_shadow"] }),
  r_scout: mut("r_scout", "rogue", "ЕГЕРЬ", "Следопыт", { pet: 3, poison: 1 }, { companionBias: ["s_shadow"] }),
  r_rogue: mut("r_rogue", "rogue", "АФЕРИСТ", "Бродяга", {}, { diversity: true, requiresCompanion: "s_stranger" }),

  m_pyro: mut("m_pyro", "mage", "ПИРОМАНТ", "Огнепоклонник", { fire: 4, magic: 1, weapon: 1 }, { companionBias: ["s_spark"] }),
  m_cryo: mut("m_cryo", "mage", "КРИОМАНТ", "Морозник", { cold: 3, magic: 2, gem: 1 }, { companionBias: ["s_frost"] }),
  m_arcanist: mut("m_arcanist", "mage", "АРКАНИСТ", "Ученик", { gem: 3, magic: 3 }, { companionBias: ["s_arcane"] }),
  m_elementalist: mut("m_elementalist", "mage", "СТИХИЙНИК", "Двуликий", { fire: 2, cold: 2, magic: 1 }, { companionBias: ["s_spark", "s_frost"] }),
  m_battlemage: mut("m_battlemage", "mage", "БОЕВОЙ МАГ", "Полевой", { magic: 2, melee: 2, weapon: 1 }, { companionBias: ["s_blade"] }),
  m_chaos: mut("m_chaos", "mage", "ХАОТИЧНЫЙ УЧЁНЫЙ", "Безумец", { luck: 2, speed: 2, magic: 1 }, { companionBias: ["s_spark", "s_stranger"] }),
  m_sage: mut("m_sage", "mage", "МУДРЕЦ", "Отшельник", {}, { diversity: true, requiresCompanion: "s_stranger" }),
  m_seer: mut("m_seer", "mage", "ПРОВИДЕЦ", "Прорицатель", { debuff: 3, magic: 2 }, { companionBias: ["s_frost"] }),

  p_paladin: mut("p_paladin", "priest", "ПАЛАДИН", "Карающий", { holy: 3, melee: 2 }, { companionBias: ["s_blade", "s_light"] }),
  p_discipline: mut("p_discipline", "priest", "ДИСЦИПЛИНА", "Каратель", { magic: 2, holy: 2 }, { companionBias: ["s_arcane"] }),
  p_zrecrela: mut("p_zrecrela", "priest", "ЖРЕЦИЛА", "Шумная", { holy: 2, musical: 3, luck: 1 }, { companionBias: ["s_spark", "s_light"] }),
  p_oracle: mut("p_oracle", "priest", "ОРАКУЛ", "Прозорливый", { heal: 3, shield: 2 }, { companionBias: ["s_light"] }),
  p_plague: mut("p_plague", "priest", "ЧУМНОЙ ЖРЕЦ", "Морящий", { holy: 2, poison: 2 }, { companionBias: ["s_shadow"] }),
  p_hierophant: mut("p_hierophant", "priest", "ИЕРОФАНТ", "Высший", { holy: 5 }, { companionBias: ["s_light"] }),
  p_inquisitor: mut("p_inquisitor", "priest", "ИНКВИЗИТОР", "Судия", { holy: 2, fire: 2 }, { companionBias: ["s_spark"] }),
  p_hermit: mut("p_hermit", "priest", "ОТШЕЛЬНИК", "Странник веры", {}, { diversity: true, requiresCompanion: "s_stranger" }),
};

function getCompanionById(id) {
  return COMPANION_CATALOG[id] || null;
}

function getMutationById(id) {
  return MUTATION_CATALOG[id] || null;
}

const MUTATION_TAG_LABELS = {
  weapon: "оружие",
  armor: "броня",
  shield: "щит",
  magic: "магия",
  gem: "кристалл",
  poison: "яд",
  food: "еда",
  fire: "огонь",
  cold: "лёд",
  holy: "святой",
  luck: "удача",
  pet: "питомец",
  debuff: "дебафф",
  melee: "ближний",
  musical: "музыка",
  heal: "лечение",
  utility: "универсальный",
  speed: "скорость",
  vampiric: "вампирский",
};

function formatMutationTagLabel(tag) {
  if (typeof formatTagLabel === "function") return formatTagLabel(tag);
  return MUTATION_TAG_LABELS[tag] || tag;
}

function formatMutationCompanionBias(bias = []) {
  if (!bias.length) return "";
  const names = bias
    .map((id) => getCompanionById(id)?.name || id)
    .filter(Boolean);
  if (!names.length) return "";
  return ` · лучше со спутником ${names.join(" или ")}`;
}

function getMutationGrowthHint(mutation) {
  if (!mutation) return "";
  if (mutation.diversity) {
    return "Разные типы предметов в рюкзаке · нужен спутник Странник";
  }
  const tags = Object.entries(mutation.tagWeights || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => formatMutationTagLabel(tag));
  const bias = formatMutationCompanionBias(mutation.companionBias);
  return tags.length ? `Копите предметы: ${tags.join(", ")}${bias}` : "";
}

function getMutationPerkMeta(mutationId) {
  const def = getMutationById(mutationId);
  if (!def) return null;
  return {
    growthHint: getMutationGrowthHint(def),
    formPerk: def.formPerk || MUTATION_FORM_PERK,
    capstoneDesc: def.capstoneDesc || MUTATION_CAPSTONE_DESCS[mutationId] || "",
    perkTagline: def.capstoneDesc || MUTATION_CAPSTONE_DESCS[mutationId] || "",
  };
}

function escapeMutationHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMutationMilestoneGap(progress, round = 1, formId = null, mutationId = null) {
  if (mutationId) {
    const perks = getMutationPerkMeta(mutationId);
    return perks?.capstoneDesc || "Полная мутация открыта";
  }
  if (formId && round >= MUTATION_ROUND_FORM) {
    return MUTATION_FORM_PERK;
  }
  if (!progress?.leader && !progress?.dominant) return "";
  const sharePct = getMutationMilestoneSharePct(progress);
  const formNeed = getMutationFormThresholdPct();
  const finalNeed = getMutationFinalThresholdPct();
  if (round >= MUTATION_ROUND_FINAL) {
    if (sharePct >= finalNeed) return "Готово к полной мутации";
    return `ещё ${Math.max(0, finalNeed - sharePct)}% до мутации`;
  }
  if (round >= MUTATION_ROUND_FORM) {
    if (sharePct >= finalNeed) return "Готово к полной мутации";
    return `ещё ${Math.max(0, finalNeed - sharePct)}% до мутации`;
  }
  if (sharePct >= formNeed) return "Готово к трансформации";
  return `ещё ${Math.max(0, formNeed - sharePct)}% до трансформации`;
}

function getMutationsForNoviceClass(classId) {
  return Object.values(MUTATION_CATALOG).filter((m) => m.noviceClass === classId);
}

function getNoviceClassLabel(classId) {
  if (typeof getHeroLabel === "function") {
    const hero = getHeroLabel(classId);
    if (hero) return hero;
  }
  const cls = typeof getClassById === "function" ? getClassById(classId) : null;
  if (!cls) return "Герой";
  return cls.heroLabel || cls.noviceLabel || cls.name;
}

function formatHeroBuildTitle(heroLabel, buildPart) {
  const hero = String(heroLabel || "").trim();
  const part = String(buildPart || "").trim().toLowerCase();
  if (!hero) return part || "—";
  if (!part) return hero;
  return `${hero.toLowerCase()}-${part}`;
}

function getMutationDisplayTitle(classId, formId, mutationId) {
  const hero = getNoviceClassLabel(classId);
  if (mutationId) {
    const m = getMutationById(mutationId);
    if (m) return formatHeroBuildTitle(hero, m.name);
  }
  if (formId) {
    const m = getMutationById(formId);
    if (m) return formatHeroBuildTitle(hero, m.formName);
  }
  return hero;
}

function defaultCompanionForClass(classId) {
  const map = {
    warrior: "s_blade",
    rogue: "s_shadow",
    mage: "s_arcane",
    priest: "s_light",
  };
  return map[classId] || "s_stranger";
}

function defaultClassForCompanion(companionId) {
  const map = {
    s_blade: "warrior",
    s_shadow: "rogue",
    s_arcane: "mage",
    s_light: "priest",
    s_spark: "mage",
    s_frost: "mage",
    s_stranger: "warrior",
  };
  return map[companionId] || "warrior";
}

function estimateItemPowerScore(itemId) {
  const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[itemId] : null;
  if (!def) return 0;
  const rarityScore = { common: 1, rare: 2, epic: 3, legendary: 4, unique: 4, godly: 5 };
  return (rarityScore[def.rarity] || 1) * 2 + (def.effects?.length || 0);
}

function collectLoadoutTagCounts(items = [], dollItemIds = []) {
  const counts = Object.create(null);
  const bump = (tags, mult) => {
    (tags || []).forEach((tag) => {
      counts[tag] = (counts[tag] || 0) + mult;
    });
  };

  const sorted = [...items]
    .filter((it) => it && ITEM_CATALOG[it.itemId] && !ITEM_CATALOG[it.itemId].isContainer)
    .sort((a, b) => estimateItemPowerScore(b.itemId) - estimateItemPowerScore(a.itemId))
    .slice(0, 8);

  sorted.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    bump(def.tags, 1);
  });

  dollItemIds.forEach((itemId) => {
    const def = ITEM_CATALOG[itemId];
    if (!def) return;
    bump(def.tags, 2);
  });

  return counts;
}

function countTagFamiliesFromCounts(tagCounts) {
  let n = 0;
  MUTATION_TAG_FAMILIES.forEach((tag) => {
    if ((tagCounts[tag] || 0) > 0) n += 1;
  });
  return n;
}

function scoreMutation(mutation, tagCounts, companionId, familyCount) {
  if (mutation.diversity) {
    if (mutation.requiresCompanion && companionId !== mutation.requiresCompanion) return 0;
    if (familyCount < mutation.minFamilies) return 0;
    return 10 + familyCount;
  }

  let score = 0;
  Object.entries(mutation.tagWeights || {}).forEach(([tag, weight]) => {
    score += (tagCounts[tag] || 0) * weight;
  });

  if (mutation.companionBias?.includes(companionId)) {
    score *= 1.25;
  }

  const companion = getCompanionById(companionId);
  if (companion?.mutationBias?.includes(mutation.id)) {
    score += 4;
  }

  return score;
}

function resolveMutationProgress(ctx = {}) {
  const classId = ctx.classId;
  const companionId = ctx.companionId || "s_stranger";
  const items = ctx.items || [];
  const slotItemIds = typeof listSlotItemIds === "function"
    ? listSlotItemIds(items)
    : (typeof deriveDollFromItems === "function"
      ? Object.values(deriveDollFromItems(items).doll || {}).filter(Boolean)
      : []);

  const tagCounts = collectLoadoutTagCounts(items, slotItemIds);
  if (typeof applyEnhancementTagsToCounts === "function") {
    applyEnhancementTagsToCounts(tagCounts, ctx.enhancements);
  }
  const familyCount = countTagFamiliesFromCounts(tagCounts);
  const pool = getMutationsForNoviceClass(classId);

  const ranked = pool
    .map((mutation) => ({
      id: mutation.id,
      name: mutation.name,
      formName: mutation.formName,
      score: scoreMutation(mutation, tagCounts, companionId, familyCount),
      diversity: !!mutation.diversity,
    }))
    .sort((a, b) => b.score - a.score);

  const maxScore = ranked[0]?.score || 0;
  const totalScore = ranked.reduce((sum, r) => sum + r.score, 0) || 0;
  const leader = ranked[0] || null;
  const leaderShare = totalScore > 0 && leader ? leader.score / totalScore : 0;

  let diversityLeader = null;
  if (familyCount >= 4) {
    diversityLeader = ranked.find((r) => MUTATION_CATALOG[r.id]?.diversity) || null;
  }

  const isBlendedBuild = leaderShare < 0.35 && familyCount >= 4;
  const effectiveLeader = isBlendedBuild && diversityLeader
    ? diversityLeader
    : leader;

  return {
    classId,
    companionId,
    noviceLabel: getNoviceClassLabel(classId),
    tagCounts,
    familyCount,
    ranked: ranked.map((r) => ({
      ...r,
      pct: totalScore > 0 ? Math.round((r.score / totalScore) * 100) : 0,
    })),
    dominant: leader ? {
      ...leader,
      pct: totalScore > 0 ? Math.round((leader.score / totalScore) * 100) : 0,
    } : null,
    leader: effectiveLeader ? {
      ...effectiveLeader,
      pct: totalScore > 0 ? Math.round((effectiveLeader.score / totalScore) * 100) : 0,
    } : null,
    isBlendedBuild: isBlendedBuild && !!diversityLeader && diversityLeader.id !== leader?.id,
    maxScore,
    leaderShare,
    leaderPct: leaderShare,
  };
}

function pickMutationIdForMilestone(progress, round) {
  if (!progress?.leader?.id) return null;
  const share = progress.leaderShare ?? progress.leaderPct ?? 0;
  if (round >= MUTATION_ROUND_FINAL && share >= MUTATION_FINAL_THRESHOLD) return progress.leader.id;
  if (round >= MUTATION_ROUND_FORM && share >= MUTATION_FORM_THRESHOLD) return progress.leader.id;
  return null;
}

function canCompanionEquipItem(companionId, itemId, def = null) {
  const companion = getCompanionById(companionId);
  const itemDef = def || (typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[itemId] : null);
  if (!companion || !itemDef?.slot) return true;
  const slot = itemDef.slot;
  const tags = itemDef.tags || [];
  if (companion.equipRestrict.includes("no_two_hand") && slot === "twoHand") return false;
  if (companion.equipRestrict.includes("no_shield") && (slot === "leftHand" || tags.includes("shield"))) return false;
  return true;
}

function applyCompanionCombatBonus(side, companionId) {
  const c = getCompanionById(companionId);
  if (!c?.combat || !side) return;
  const b = c.combat;
  if (b.allMult) {
    side.damageMult *= 1 + b.allMult;
    side.magicDamageMult *= 1 + b.allMult;
  }
  if (b.damageMult) side.damageMult *= 1 + b.damageMult;
  if (b.magicDamageMult) side.magicDamageMult *= 1 + b.magicDamageMult;
  if (b.cooldownMult) side.cooldownMult *= 1 + b.cooldownMult;
  if (b.shieldBlockMult) side.shieldBlockMult += b.shieldBlockMult;
  side.companionId = companionId;
  side.companionTagMods = {
    fire: b.fireTagMult || 0,
    cold: b.coldTagMult || 0,
    holy: b.holyTagMult || 0,
    poison: b.poisonTagMult || 0,
    heal: b.healTagMult || 0,
  };
}

function applyMutationMilestoneBonus(side, formId, mutationId) {
  if (typeof applyMutationMilestoneCapstones === "function") {
    applyMutationMilestoneCapstones(side, formId, mutationId);
  }
}

function applyRunModifiersToSide(side, prepMeta = {}) {
  applyCompanionCombatBonus(side, prepMeta.companionId || "s_stranger");
  if (typeof applyEnhancementRunModifiers === "function") {
    applyEnhancementRunModifiers(side, prepMeta);
  }
  if (typeof applyAmplifierRunModifiers === "function") {
    applyAmplifierRunModifiers(side, prepMeta);
  }
  applyMutationMilestoneBonus(side, prepMeta.mutationFormId, prepMeta.mutationId);
}

function tickMutationCapstones(state, dt) {
  if (typeof tickMutationCapstonesImpl === "function") {
    tickMutationCapstonesImpl(state, dt);
  }
}

function renderMutationDeltaBadgeHtml(delta, compact = false) {
  if (!delta) return "";
  if (typeof renderMutationDeltaBadge === "function") {
    return renderMutationDeltaBadge(delta, { compact });
  }
  const sign = delta > 0 ? "+" : "";
  const dir = delta > 0 ? "up" : "down";
  const compactClass = compact ? " mutation-progress-delta--compact" : "";
  return `<span class="mutation-progress-delta mutation-progress-delta--${dir}${compactClass}">${escapeMutationHtml(`${sign}${delta}%`)}</span>`;
}

function renderMutationAltLine(entry, deltas) {
  const delta = deltas?.[entry.id];
  const deltaHtml = renderMutationDeltaBadgeHtml(delta, true);
  return `<span class="mutation-progress-alt${delta ? " mutation-progress-alt--changed" : ""}">${escapeMutationHtml(entry.name)} ${entry.pct}%${deltaHtml}</span>`;
}

function renderMutationProgressHtml(progress, formId, mutationId, round, options = {}) {
  if (!progress) return "";
  const pathCtx = getMutationProgressPathContext(progress, formId, mutationId);
  const pathId = pathCtx.pathId;
  const targetName = pathCtx.targetName;
  const sharePct = getMutationMilestoneSharePct(progress);
  const formNeed = getMutationFormThresholdPct();
  const finalNeed = getMutationFinalThresholdPct();
  const goalPct = round >= MUTATION_ROUND_FORM && !mutationId ? finalNeed : formNeed;
  const alt = progress.ranked.slice(1, 3);
  const deltas = options.deltas || null;
  const hasDeltas = deltas && Object.keys(deltas).length > 0;
  const leaderDelta = pathId ? deltas?.[pathId] : null;
  const leaderDeltaHtml = renderMutationDeltaBadgeHtml(leaderDelta);
  const milestone = getMutationMilestoneEyebrow(round);
  const perks = pathId ? getMutationPerkMeta(pathId) : null;
  const perkLine = mutationId
    ? perks?.capstoneDesc
    : formId && round >= MUTATION_ROUND_FORM
      ? perks?.formPerk
      : perks?.perkTagline;
  const gapLine = formatMutationMilestoneGap(progress, round, formId, mutationId);
  const pathAttr = pathId ? ` data-mutation-id="${escapeMutationHtml(pathId)}"` : "";
  const pulseClass = hasDeltas ? " mutation-progress--delta-pulse" : "";
  const perkHtml = perkLine
    ? `<p class="mutation-progress-perk">${escapeMutationHtml(perkLine)}</p>`
    : "";
  const gapHtml = gapLine
    ? `<span class="mutation-progress-gap">${escapeMutationHtml(gapLine)}</span>`
    : "";
  const goalHtml = !mutationId
    ? `<span class="mutation-progress-goal">→ ${goalPct}%</span>`
    : "";
  const blendedHtml = pathCtx.blended && pathCtx.blendedLabel
    ? `<span class="mutation-progress-blended">универсальный · ${escapeMutationHtml(pathCtx.blendedLabel)}</span>`
    : "";
  const lockedHtml = formId && !mutationId
    ? `<span class="mutation-progress-locked">трансформация</span>`
    : mutationId
      ? `<span class="mutation-progress-locked">полная мутация</span>`
      : "";

  if (options.heroCard) {
    const altHtml = alt.length
      ? `<div class="mutation-progress-alts mutation-progress-alts--hero-card">${alt.map((a) => renderMutationAltLine(a, deltas)).join("")}</div>`
      : "";
    return `
      <div class="mutation-progress mutation-progress--hero-card mutation-progress--interactive${pulseClass}"${pathAttr} role="status" aria-live="polite" tabindex="0" title="Подробнее о пути">
        <div class="mutation-progress-head">
          <span class="mutation-progress-eyebrow">Путь · ${milestone}</span>
          <strong class="mutation-progress-target">${escapeMutationHtml(String(targetName || "—").toUpperCase())}</strong>
        </div>
        ${perkHtml}
        ${blendedHtml}
        <div class="mutation-progress-bar" aria-hidden="true">
          <div class="mutation-progress-fill" style="width:${Math.min(100, sharePct)}%"></div>
        </div>
        <div class="mutation-progress-meta">
          <span class="mutation-progress-pct">${sharePct}%${leaderDeltaHtml}</span>
          ${goalHtml}
          ${gapHtml}
        </div>
        ${altHtml}
      </div>
    `;
  }

  const altHtml = alt.length
    ? `<div class="mutation-progress-alts">${alt.map((a) => renderMutationAltLine(a, deltas)).join("")}</div>`
    : "";

  return `
    <div class="mutation-progress mutation-progress--interactive${pulseClass}"${pathAttr} role="status" aria-live="polite" tabindex="0" title="Подробнее о пути">
      <div class="mutation-progress-head">
        <span class="mutation-progress-eyebrow">Путь · ${milestone}</span>
        <strong class="mutation-progress-target">${escapeMutationHtml(targetName)}</strong>
      </div>
      ${perkHtml}
      ${blendedHtml}
      <div class="mutation-progress-bar" aria-hidden="true">
        <div class="mutation-progress-fill" style="width:${Math.min(100, sharePct)}%"></div>
      </div>
      <div class="mutation-progress-meta">
        <span class="mutation-progress-pct">${sharePct}%${leaderDeltaHtml}</span>
        ${goalHtml}
        ${gapHtml}
        ${lockedHtml}
      </div>
      ${altHtml}
    </div>
  `;
}

const COMPANION_COMBAT_LABELS = {
  allMult: "Все множители урона (damageMult и magicDamageMult)",
  damageMult: "Физический урон (damageMult)",
  magicDamageMult: "Магический урон (magicDamageMult)",
  cooldownMult: "Кулдаун предметов (cooldownMult)",
  shieldBlockMult: "Блок щитом (shieldBlockMult)",
};

const COMPANION_TAG_LABELS = {
  fire: "огонь",
  cold: "холод",
  holy: "holy",
  poison: "яд",
  heal: "хил",
};

const COMPANION_EQUIP_RESTRICT_LABELS = {
  no_two_hand: "Двуручное оружие нельзя надеть",
  no_shield: "Щит нельзя надеть (leftHand и тег shield)",
};

function formatCompanionSignedPct(value) {
  const pct = Math.round(Math.abs(value) * 1000) / 10;
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

function formatCompanionMultLine(key, value) {
  const label = COMPANION_COMBAT_LABELS[key] || key;
  if (key === "cooldownMult") {
    const factor = 1 + value;
    const speedPct = Math.round(Math.abs(value) * 1000) / 10;
    if (value < 0) {
      return `${label} ← ×${factor.toFixed(2)} · предметы перезаряжаются на ${speedPct}% быстрее`;
    }
    if (value > 0) {
      return `${label} ← ×${factor.toFixed(2)} · предметы перезаряжаются на ${speedPct}% медленнее`;
    }
    return `${label} без изменений`;
  }
  if (key === "shieldBlockMult") {
    const sign = value >= 0 ? "+" : "−";
    const pct = Math.round(Math.abs(value) * 100);
    return `${label} ← shieldBlockMult ${sign} ${pct} п.п. (аддитивно)`;
  }
  const factor = 1 + value;
  return `${label} ← ×${factor.toFixed(factor % 1 === 0 ? 0 : 2)} (${formatCompanionSignedPct(value)} к множителю)`;
}

function formatCompanionTagMultLine(tag, value) {
  const label = COMPANION_TAG_LABELS[tag] || tag;
  const factor = 1 + value;
  return `Эффекты с тегом «${label}» ← ×${factor.toFixed(2)} (${formatCompanionSignedPct(value)})`;
}

function buildCompanionTooltipLines(companionId) {
  const companion = getCompanionById(companionId);
  if (!companion) return [{ text: "Спутник не найден", style: "normal" }];

  const lines = [
    { text: `${companion.emoji} ${companion.name}`, style: "title" },
    { text: companion.desc, style: "sub", color: "#8b949e" },
    { text: "Бой (формулы забега)", style: "label", color: "#7dd3fc" },
  ];

  const combat = companion.combat || {};
  if (combat.allMult) lines.push({ text: formatCompanionMultLine("allMult", combat.allMult), style: "normal" });
  if (combat.damageMult) lines.push({ text: formatCompanionMultLine("damageMult", combat.damageMult), style: "normal" });
  if (combat.magicDamageMult) lines.push({ text: formatCompanionMultLine("magicDamageMult", combat.magicDamageMult), style: "normal" });
  if (combat.cooldownMult) lines.push({ text: formatCompanionMultLine("cooldownMult", combat.cooldownMult), style: "normal" });
  if (combat.shieldBlockMult) lines.push({ text: formatCompanionMultLine("shieldBlockMult", combat.shieldBlockMult), style: "normal" });

  const tagEntries = Object.entries(COMPANION_TAG_LABELS)
    .map(([tag]) => [tag, combat[`${tag}TagMult`]])
    .filter(([, value]) => value);
  if (tagEntries.length) {
    lines.push({ text: "Модификаторы тегов", style: "label", color: "#7dd3fc" });
    tagEntries.forEach(([tag, value]) => {
      lines.push({ text: formatCompanionTagMultLine(tag, value), style: "normal" });
    });
  }

  if (companion.equipRestrict?.length) {
    lines.push({ text: "Ограничения экипа", style: "label", color: "#7dd3fc" });
    companion.equipRestrict.forEach((rule) => {
      lines.push({
        text: COMPANION_EQUIP_RESTRICT_LABELS[rule] || rule,
        style: "normal",
        color: "#f0a060",
      });
    });
  } else {
    lines.push({ text: "Экип: без ограничений слотов", style: "sub", color: "#86efac" });
  }

  if (companion.mutationBias?.length) {
    lines.push({ text: "Мутации", style: "label", color: "#7dd3fc" });
    lines.push({
      text: "+4 к очкам ветки для: "
        + companion.mutationBias.map((id) => getMutationById(id)?.name || id).join(", "),
      style: "normal",
    });
    lines.push({
      text: "Если мутация в companionBias спутника → score ×1.25",
      style: "sub",
      color: "#8b949e",
    });
  }

  return lines;
}
