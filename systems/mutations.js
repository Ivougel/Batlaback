/**
 * Мутации и спутники — каталог, прогресс, бонусы забега.
 * @see docs/mutations-gdd.md
 */

const MUTATION_ROUND_FORM = 8;
const MUTATION_ROUND_FINAL = 16;
const MUTATION_FORM_THRESHOLD = 0.4;
const MUTATION_FINAL_THRESHOLD = 0.55;

const MUTATION_TAG_FAMILIES = [
  "melee", "weapon", "magic", "holy", "poison", "fire", "cold", "armor", "shield",
  "heal", "pet", "luck", "musical", "gem", "debuff", "vampiric", "food", "nature", "utility", "speed",
];

const COMPANION_CATALOG = {
  s_stranger: {
    id: "s_stranger",
    name: "Странник",
    emoji: "🐣",
    desc: "+1% ко всем характеристикам · без ограничений экипа",
    equipRestrict: [],
    combat: { allMult: 0.01 },
    mutationBias: ["w_veteran", "r_rogue", "m_sage", "p_hermit"],
  },
  s_blade: {
    id: "s_blade",
    name: "Дух мечника",
    emoji: "⚔️",
    desc: "+физика · −12% магии",
    equipRestrict: [],
    combat: { damageMult: 0.04, magicDamageMult: -0.12 },
    mutationBias: ["w_guardian", "w_berserk", "w_crusader", "p_paladin", "r_plague", "m_battlemage"],
  },
  s_spark: {
    id: "s_spark",
    name: "Огненная искорка",
    emoji: "🔥",
    desc: "+огонь · −холод",
    equipRestrict: [],
    combat: { fireTagMult: 0.08, coldTagMult: -0.1 },
    mutationBias: ["m_pyro", "p_inquisitor", "p_zrecrela"],
  },
  s_frost: {
    id: "s_frost",
    name: "Ледяная крупинка",
    emoji: "❄️",
    desc: "+холод и мана · −огонь",
    equipRestrict: [],
    combat: { coldTagMult: 0.08, fireTagMult: -0.1 },
    mutationBias: ["m_cryo", "m_seer"],
  },
  s_arcane: {
    id: "s_arcane",
    name: "Искра арканы",
    emoji: "✨",
    desc: "+магия · −физика · без двуручного на манекене",
    equipRestrict: ["no_two_hand"],
    combat: { magicDamageMult: 0.06, damageMult: -0.08 },
    mutationBias: ["m_arcanist", "p_discipline"],
  },
  s_shadow: {
    id: "s_shadow",
    name: "Тень",
    emoji: "🌑",
    desc: "+яд и скорость · −блок · без щита на манекене",
    equipRestrict: ["no_shield"],
    combat: { poisonTagMult: 0.08, cooldownMult: -0.04, shieldBlockMult: -0.1 },
    mutationBias: ["r_assassin", "r_shadow", "r_nightblade"],
  },
  s_light: {
    id: "s_light",
    name: "Свет",
    emoji: "🌟",
    desc: "+holy и хил · −burst",
    equipRestrict: [],
    combat: { holyTagMult: 0.08, healTagMult: 0.06 },
    mutationBias: ["p_paladin", "p_zrecrela", "p_oracle", "p_hierophant", "r_bard", "w_crusader"],
  },
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

function getMutationsForNoviceClass(classId) {
  return Object.values(MUTATION_CATALOG).filter((m) => m.noviceClass === classId);
}

function getNoviceClassLabel(classId) {
  const cls = typeof getClassById === "function" ? getClassById(classId) : null;
  if (!cls) return "Новичок";
  return cls.noviceLabel || `${cls.name}-новичок`;
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
  const doll = typeof deriveDollFromItems === "function" ? deriveDollFromItems(items) : { doll: {} };
  const dollIds = Object.values(doll.doll || {}).filter(Boolean);

  const tagCounts = collectLoadoutTagCounts(items, dollIds);
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

  const effectiveLeader = leaderShare < 0.35 && diversityLeader
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
    leader: effectiveLeader ? {
      ...effectiveLeader,
      pct: totalScore > 0 ? Math.round((effectiveLeader.score / totalScore) * 100) : 0,
    } : null,
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

function getMutationDisplayTitle(classId, formId, mutationId) {
  if (mutationId) {
    const m = getMutationById(mutationId);
    if (m) return m.name;
  }
  if (formId) {
    const m = getMutationById(formId);
    if (m) return `${m.formName} (${getNoviceClassLabel(classId)})`;
  }
  return getNoviceClassLabel(classId);
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
  applyMutationMilestoneBonus(side, prepMeta.mutationFormId, prepMeta.mutationId);
}

function tickMutationCapstones(state, dt) {
  if (typeof tickMutationCapstonesImpl === "function") {
    tickMutationCapstonesImpl(state, dt);
  }
}

function renderMutationProgressHtml(progress, formId, mutationId, round) {
  if (!progress) return "";
  const leader = progress.leader;
  const alt = progress.ranked.slice(1, 3);
  const targetName = mutationId
    ? getMutationById(mutationId)?.name
    : formId
      ? getMutationById(formId)?.formName
      : leader?.name || "—";
  const pct = leader?.pct ?? 0;
  const milestone = round >= MUTATION_ROUND_FINAL
    ? "финал"
    : round >= MUTATION_ROUND_FORM
      ? "форма"
      : "рост";

  const altHtml = alt.length
    ? `<div class="mutation-progress-alts">${alt.map((a) => `<span>${a.name} ${a.pct}%</span>`).join("")}</div>`
    : "";

  return `
    <div class="mutation-progress" role="status" aria-live="polite">
      <div class="mutation-progress-head">
        <span class="mutation-progress-eyebrow">Мутация · ${milestone}</span>
        <strong class="mutation-progress-target">${targetName}</strong>
      </div>
      <div class="mutation-progress-bar" aria-hidden="true">
        <div class="mutation-progress-fill" style="width:${Math.min(100, pct)}%"></div>
      </div>
      <div class="mutation-progress-meta">
        <span>${pct}%</span>
        ${formId && !mutationId ? `<span class="mutation-progress-locked">форма R${MUTATION_ROUND_FORM}</span>` : ""}
        ${mutationId ? `<span class="mutation-progress-locked">мутация R${MUTATION_ROUND_FINAL}</span>` : ""}
      </div>
      ${altHtml}
    </div>
  `;
}
