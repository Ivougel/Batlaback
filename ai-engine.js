/**
 * Умный ИИ: архетипы, синергии, контр-пик игрока, покупки, продажи, перекомпоновка.
 */

const AI_ECON = { START_GOLD: 12, ROUND_GOLD: 10, WIN_GOLD: 3 };

const AI_ARCHETYPES = {
  mage: {
    id: "mage",
    name: "Маг",
    priorityTags: ["magic", "gem", "fire"],
    secondaryTags: [],
  },
  warrior: {
    id: "warrior",
    name: "Воин",
    priorityTags: ["weapon", "armor", "shield"],
    secondaryTags: [],
  },
  rogue: {
    id: "rogue",
    name: "Разбойник",
    priorityTags: ["weapon", "poison"],
    secondaryTags: ["nature"],
  },
  priest: {
    id: "priest",
    name: "Жрец",
    priorityTags: ["food", "potion"],
    secondaryTags: ["nature"],
  },
};

const AI_MAX_BENCH = 6;
const AI_SELL_THRESHOLD = 1.5;
const AI_OFFBUILD_SELL_THRESHOLD = 6;
const AI_SYNERGY_POTENTIAL_WEIGHT = 12;
const AI_SYNERGY_PLACEMENT_STRONG = 18;
const AI_SYNERGY_PLACEMENT_WEAK = 9;
const AI_SHOP_REFRESH_CHANCE = 0.5;
const AI_KILL_COMMIT_ROUND = 3;
const AI_KILL_COMMIT_ITEMS = 4;

/** Бонусы за «закрытие» известных пар синергий при покупке. */
const AI_SYNERGY_COMPLETION = [
  { needTags: ["poison"], preferIds: ["poison_dagger"], preferTags: ["weapon"], bonus: 20 },
  { needTags: ["weapon"], preferTags: ["poison"], bonus: 14 },
  { needTags: ["armor"], preferTags: ["shield"], bonus: 14 },
  { needTags: ["shield"], preferTags: ["armor"], bonus: 12 },
  { needTags: ["magic"], preferTags: ["gem"], bonus: 12 },
  { needTags: ["gem"], preferTags: ["magic"], bonus: 10 },
];

function pickEnemyArchetype() {
  const id = pickRandomClassId();
  return AI_ARCHETYPES[id] || AI_ARCHETYPES.warrior;
}

function countBlockSources(items) {
  return items.filter((item) => {
    const def = ITEM_CATALOG[item.itemId];
    return (def?.effects || []).some((e) => e.type === "block" && e.trigger !== "passive");
  }).length;
}

function countPoisonSources(items) {
  return items.filter((item) => {
    const def = ITEM_CATALOG[item.itemId];
    return (def?.effects || []).some((e) => e.type === "poison");
  }).length;
}

function countHealSources(items) {
  return items.filter((item) => {
    const def = ITEM_CATALOG[item.itemId];
    return (def?.effects || []).some((e) => e.type === "heal");
  }).length;
}

function countWeaponItems(items) {
  return items.filter((item) => ITEM_CATALOG[item.itemId]?.tags.includes("weapon")).length;
}

function countItemCopies(items, itemId) {
  return items.filter((item) => item.itemId === itemId).length;
}

function loadoutHasTags(items, tags) {
  const set = new Set(collectLoadoutTags(items));
  return tags.some((t) => set.has(t));
}

/** Контекст билда игрока для контр-пика. */
function buildPlayerScout(playerItems) {
  const items = playerItems || [];
  const tags = collectLoadoutTags(items);
  return {
    tags,
    poisonSources: countPoisonSources(items),
    blockSources: countBlockSources(items),
    weaponCount: countWeaponItems(items),
    healSources: countHealSources(items),
    hasShield: tags.includes("shield"),
    hasPoison: tags.includes("poison") || countPoisonSources(items) > 0,
    hasMagic: tags.some((t) => ["magic", "fire", "gem"].includes(t)),
    hasArmor: tags.includes("armor"),
  };
}

/** Сколько предметов уже в тему выбранного kill-билда. */
function countArchetypeItems(items, archetype) {
  return items.filter((item) => itemMatchesKillArchetype(ITEM_CATALOG[item.itemId], archetype)).length;
}

function itemMatchesKillArchetype(def, archetype) {
  if (!def || !archetype) return false;

  if (archetype.id === "mage") {
    return itemHasMagicDamage(def)
      || def.tags.includes("gem")
      || def.tags.includes("magic")
      || def.tags.includes("fire");
  }

  if (archetype.id === "rogue") {
    if (def.tags.includes("poison")) return true;
    if (def.tags.includes("weapon") && !hasBlockOnlyItem(def)) return true;
    return def.tags.includes("nature");
  }

  if (archetype.id === "priest") {
    return def.tags.includes("food")
      || def.tags.includes("potion")
      || def.tags.includes("nature");
  }

  const { hasPriority } = countTagAffinity(def, archetype);
  if (hasPriority) return true;
  return (archetype.secondaryTags || []).some((tag) => def.tags.includes(tag));
}

function isLoadoutCommitted(round, itemCount) {
  return round >= AI_KILL_COMMIT_ROUND || itemCount >= AI_KILL_COMMIT_ITEMS;
}

/**
 * Выбирает класс/архетип, который лучше всего убивает текущий билд игрока.
 * Цель — не «случайный класс», а контр-стратегия под scout игрока.
 */
function pickKillArchetype(scout, playerClass, round, currentArchetype, ownItems, battleWon) {
  const scores = { mage: 0, warrior: 0, rogue: 0, priest: 0 };

  if (playerClass === "mage" || scout.hasMagic) {
    scores.mage += 16;
    scores.rogue += 12;
    scores.warrior -= 4;
  }
  if (playerClass === "warrior" || scout.weaponCount >= 2 || scout.hasArmor) {
    scores.mage += 14;
    scores.rogue += 9;
    scores.warrior += 3;
  }
  if (playerClass === "rogue" || scout.hasPoison) {
    scores.mage += 13;
    scores.warrior += 7;
    scores.rogue += 4;
  }
  if (playerClass === "priest" || scout.healSources >= 2) {
    scores.rogue += 14;
    scores.mage += 8;
    scores.priest += 6;
    scores.warrior += 5;
  }
  if (scout.blockSources >= 1 || scout.hasShield) {
    scores.mage += 10;
    scores.rogue += 6;
    scores.warrior -= 2;
  }
  if (scout.healSources >= 1) {
    scores.rogue += 11;
    scores.mage += 5;
  }
  if (scout.weaponCount >= 3) {
    scores.mage += 6;
    scores.rogue += 4;
  }

  if (battleWon === false) {
    Object.keys(scores).forEach((id) => { scores[id] += 2; });
    if (scout.hasMagic) scores.mage += 6;
    if (scout.healSources >= 1) scores.rogue += 5;
    if (scout.blockSources >= 2) scores.mage += 4;
  }

  if (currentArchetype?.id && ownItems?.length) {
    const committed = countArchetypeItems(ownItems, currentArchetype);
    const ratio = committed / Math.max(1, ownItems.length);
    if (ratio >= 0.55 && round >= 2) scores[currentArchetype.id] += 8;
    if (ratio >= 0.75 && round >= 4) scores[currentArchetype.id] += 10;
  }

  let bestId = "warrior";
  let bestScore = -Infinity;
  Object.entries(scores).forEach(([id, score]) => {
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  });
  return AI_ARCHETYPES[bestId] || AI_ARCHETYPES.warrior;
}

function scoreKillPressure(def, scout, archetype) {
  if (!def || !scout) return 0;
  let score = 0;
  const hasDamage = (def.effects || []).some((e) => e.type === "damage");
  const hasMagic = itemHasMagicDamage(def);
  const hasPoison = (def.effects || []).some((e) => e.type === "poison");
  const hasBlock = (def.effects || []).some((e) => e.type === "block" && e.trigger !== "passive");
  const hasHeal = (def.effects || []).some((e) => e.type === "heal");

  (def.effects || []).forEach((e) => {
    if (e.type === "damage") {
      const mult = (e.damageType === "magic" || e.damageType === "fire") ? 1.35 : 1.15;
      score += getEffectAverageDamage(e, def) * mult;
    }
    if (e.type === "poison") score += e.value * 1.5;
  });

  if (scout.blockSources >= 1 || scout.hasShield) {
    if (hasMagic) score += 12;
    if (def.tags.includes("fire")) score += 8;
    if (hasBlock && !hasDamage && !hasMagic && !hasPoison) score -= 10;
  }
  if (scout.healSources >= 1 && hasPoison) score += 14;
  if (scout.hasMagic && hasPoison) score += 6;
  if (scout.hasPoison && hasHeal && archetype?.id !== "warrior") score -= 10;
  if (scout.weaponCount >= 2 && hasMagic) score += 5;
  if (def.rarity === "legendary" && (hasDamage || hasMagic)) score += 12;

  return score;
}

function scoreBuildCoherence(def, archetype, items, bench, round) {
  if (!def || !archetype) return 0;
  const combined = [...items, ...bench];
  if (!isLoadoutCommitted(round, items.length)) return 0;

  if (itemMatchesKillArchetype(def, archetype)) return 4;

  let score = -8;
  const synergy = countSynergyPotential(def.id, items) + countSynergyPotential(def.id, bench);
  if (synergy >= AI_SYNERGY_POTENTIAL_WEIGHT) score += 5;

  if (archetype.id === "mage" && def.tags.includes("weapon") && !itemHasMagicDamage(def)) score -= 12;
  if (archetype.id === "rogue" && hasBlockOnlyItem(def) && combined.length >= 5) score -= 8;
  if (archetype.id === "mage" && hasBlockOnlyItem(def) && !scoutHasHeavyBlock(null, combined)) score -= 6;
  if (archetype.id === "priest") {
    if (def.tags.includes("food") || def.tags.includes("potion")) return 8;
    if (def.tags.includes("weapon") || def.tags.includes("armor")) return -14;
  }

  return score;
}

function hasBlockOnlyItem(def) {
  const effects = def.effects || [];
  const hasBlock = effects.some((e) => e.type === "block" && e.trigger !== "passive");
  const hasOffense = effects.some((e) => e.type === "damage" || e.type === "poison");
  return hasBlock && !hasOffense;
}

function scoutHasHeavyBlock(scout, items) {
  if (scout?.blockSources >= 2) return true;
  return countBlockSources(items) >= 2;
}

function countSynergyPotentialWith(itemId, partnerItems) {
  const def = ITEM_CATALOG[itemId];
  if (!def || !partnerItems.length) return 0;
  let score = 0;
  partnerItems.forEach((existing) => {
    const exDef = ITEM_CATALOG[existing.itemId];
    (def.synergies || []).forEach((rule) => {
      if (rule.neighborTags.some((t) => exDef.tags.includes(t))) score += AI_SYNERGY_POTENTIAL_WEIGHT;
    });
    (exDef.synergies || []).forEach((rule) => {
      if (rule.neighborTags.some((t) => def.tags.includes(t))) score += AI_SYNERGY_POTENTIAL_WEIGHT;
    });
  });
  return score;
}

function shouldSellForKillBuild(item, archetype, items, scout, round, battleWon) {
  const def = ITEM_CATALOG[item.itemId];
  if (!def || !archetype) return false;
  if (!isLoadoutCommitted(round, items.length)) return false;
  if (itemMatchesKillArchetype(def, archetype)) return false;

  if (archetype.id === "priest" && def.tags.includes("weapon") && !def.tags.includes("holy")) {
    const foodN = typeof countFoodItemsInLoadout === "function"
      ? countFoodItemsInLoadout(items)
      : items.filter((i) => ITEM_CATALOG[i.itemId]?.tags?.includes("food")).length;
    return foodN >= 2;
  }
  if (archetype.id === "priest" && def.tags.includes("armor") && !def.tags.includes("food")) {
    const foodN = typeof countFoodItemsInLoadout === "function"
      ? countFoodItemsInLoadout(items)
      : items.filter((i) => ITEM_CATALOG[i.itemId]?.tags?.includes("food")).length;
    return foodN >= 3;
  }
  if (archetype.id === "rogue" && def.tags.includes("weapon") && !hasBlockOnlyItem(def)) {
    return countWeaponItems(items) > 2;
  }

  const others = items.filter((i) => i.uid !== item.uid);
  const archetypeCount = countArchetypeItems(others, archetype);
  if (archetypeCount < 2) return false;

  if (hasBlockOnlyItem(def) && archetype.id !== "warrior") return true;
  if (def.tags.includes("poison") && archetype.id !== "rogue") return true;
  if (archetype.id === "mage" && def.tags.includes("weapon") && !itemHasMagicDamage(def)) return true;
  if (archetype.id === "rogue" && hasBlockOnlyItem(def)) return true;

  const onThemeOthers = others.filter((other) =>
    itemMatchesKillArchetype(ITEM_CATALOG[other.itemId], archetype),
  );
  const themeSynergy = countSynergyPotentialWith(item.itemId, onThemeOthers);
  if (themeSynergy >= AI_SYNERGY_POTENTIAL_WEIGHT) return false;

  return true;
}

function getAiSellThreshold(item, archetype, items, scout, round, battleWon) {
  let threshold = AI_SELL_THRESHOLD;
  if (shouldSellForKillBuild(item, archetype, items, scout, round, battleWon)) {
    threshold = AI_OFFBUILD_SELL_THRESHOLD;
  }
  if (battleWon === false) threshold += 1.2;
  return threshold;
}

function getItemPowerScore(def) {
  let power = 0;
  (def.effects || []).forEach((e) => {
    if (e.type === "damage") power += getEffectAverageDamage(e, def);
    if (e.type === "block") power += e.value * 0.85;
    if (e.type === "heal") power += e.value * 0.6;
    if (e.type === "poison") power += e.value * 1.4;
  });
  return power;
}

function countTagAffinity(def, archetype) {
  let score = 0;
  archetype.priorityTags.forEach((tag, idx) => {
    if (def.tags.includes(tag)) score += (3 - idx) * 4;
  });
  (archetype.secondaryTags || []).forEach((tag) => {
    if (def.tags.includes(tag)) score += 2;
  });
  const hasPriority = def.tags.some((t) => archetype.priorityTags.includes(t));
  if (!hasPriority) score -= 3;
  return { score, hasPriority };
}

function countSynergyPotential(itemId, items) {
  const def = ITEM_CATALOG[itemId];
  if (!def || !items.length) return 0;
  let score = 0;
  items.forEach((existing) => {
    const exDef = ITEM_CATALOG[existing.itemId];
    (def.synergies || []).forEach((rule) => {
      if (rule.neighborTags.some((t) => exDef.tags.includes(t))) score += AI_SYNERGY_POTENTIAL_WEIGHT;
    });
    (exDef.synergies || []).forEach((rule) => {
      if (rule.neighborTags.some((t) => def.tags.includes(t))) score += AI_SYNERGY_POTENTIAL_WEIGHT;
    });
  });
  return score;
}

function scoreSynergyCompletion(itemId, items, bench = []) {
  const def = ITEM_CATALOG[itemId];
  if (!def) return 0;
  const combined = [...items, ...bench];
  if (!combined.length) return 0;

  let bonus = 0;
  AI_SYNERGY_COMPLETION.forEach((rule) => {
    if (!loadoutHasTags(combined, rule.needTags)) return;
    if (rule.preferIds?.includes(itemId)) {
      bonus += rule.bonus;
      return;
    }
    if (rule.preferTags?.some((t) => def.tags.includes(t))) bonus += rule.bonus;
  });
  return bonus;
}

function itemHasMagicDamage(def) {
  return (def.effects || []).some((e) =>
    e.type === "damage" && (e.damageType === "magic" || e.damageType === "fire"),
  ) || def.tags.includes("magic") || def.tags.includes("fire");
}

function scoreCounterPick(def, scout, ownItems, ownBench) {
  if (!scout) return 0;
  let score = 0;
  const hasHeal = (def.effects || []).some((e) => e.type === "heal");
  const hasBlock = (def.effects || []).some((e) => e.type === "block" && e.trigger !== "passive");
  const hasPoison = (def.effects || []).some((e) => e.type === "poison");
  const hasMagic = itemHasMagicDamage(def);
  const ownPoison = countPoisonSources([...ownItems, ...ownBench]);
  const poisonWar = scout.poisonSources >= 2 || scout.hasPoison || ownPoison >= 2;

  if (poisonWar) {
    if (hasHeal) score -= 12;
    if (hasBlock) score += 7;
    if (hasMagic) score += 5;
    if (hasPoison) score += 2;
    if (def.id === "poison_dagger") score += 2;
  }

  if (scout.blockSources >= 1 || scout.hasShield) {
    if (hasMagic) score += 9;
    if (def.tags.includes("fire")) score += 6;
  }

  if (scout.weaponCount >= 2 && scout.hasPoison && hasBlock) score += 5;

  if (scout.hasMagic && hasBlock) score += 4;

  if (scout.hasMagic) {
    if (hasMagic) score += 14;
    if (def.tags.includes("fire")) score += 10;
    if (def.id === "fire_staff" || def.id === "apprentice_staff") score += 8;
  }

  if (scout.healSources >= 1) {
    if (hasPoison) score += 5;
    if (hasHeal) score -= 14;
  }

  if (scout.blockSources >= 2 && hasMagic) score += 8;

  return score;
}

function scoreContainerForAI(itemId, state, gridW, gridH) {
  const def = ITEM_CATALOG[itemId];
  if (!def?.shopContainer) return -999;

  const spot = findAdjacentContainerSpot(state.containers, gridW, gridH, itemId)
    || findContainerPlacement(gridW, gridH, state.containers, itemId);
  if (!spot) return -999;

  const slots = (def.internalCols || 1) * (def.internalRows || 1);
  const costEff = slots / Math.max(1, def.cost);
  return 6 + slots * 2.5 + costEff * 4;
}

function countCraftPotential(itemId, items, bench = []) {
  if (typeof getRecipesUsingIngredient !== "function") return 0;
  const recipes = getRecipesUsingIngredient(itemId);
  if (!recipes.length) return 0;
  const loadout = [...items, ...bench];
  const counts = new Map();
  loadout.forEach((item) => {
    counts.set(item.itemId, (counts.get(item.itemId) || 0) + 1);
  });
  let score = 0;
  recipes.forEach((recipe) => {
    let partners = 0;
    recipe.inputs.forEach((input) => {
      if (input.itemId === itemId) return;
      if ((counts.get(input.itemId) || 0) >= input.count) partners += 1;
    });
    if (partners > 0) score += 6 + partners * 3;
    else score += 2;
  });
  return score;
}

function scoreItemForAI(
  itemId,
  archetype,
  items,
  bench = [],
  classId = null,
  gridW = 9,
  gridH = 7,
  containers = [],
  scout = null,
  round = 1,
) {
  const def = ITEM_CATALOG[itemId];
  if (!def) return -999;
  if (def.shopContainer) {
    return scoreContainerForAI(itemId, { containers, items, bench }, gridW, gridH);
  }
  if (def.isContainer) return -999;
  if (def.classRestriction && classId && def.classRestriction !== classId) return -999;

  const { score: tagScore, hasPriority } = countTagAffinity(def, archetype);
  let score = tagScore;
  score += getItemPowerScore(def);
  score += countSynergyPotential(itemId, items);
  score += countSynergyPotential(itemId, bench);
  score += countCraftPotential(itemId, items, bench);
  if (typeof isGemItem === "function" && isGemItem(itemId)) {
    const emptySockets = items.filter((i) => {
      if (typeof getItemSocketCount !== "function" || getItemSocketCount(i.itemId) <= 0) return false;
      const normalized = typeof ensureSocketArray === "function" ? ensureSocketArray(i) : i;
      return (normalized.socketedGems || []).some((g) => !g);
    }).length;
    if (emptySockets > 0) score += 10 + emptySockets * 3;
  }
  score += scoreSynergyCompletion(itemId, items, bench);
  score += scoreCounterPick(def, scout, items, bench);
  score += scoreKillPressure(def, scout, archetype);
  score += scoreBuildCoherence(def, archetype, items, bench, round);

  const hasBlock = (def.effects || []).some((e) => e.type === "block" && e.trigger !== "passive");
  if (hasBlock) {
    const existingBlockSources = countBlockSources([...items, ...bench]);
    const blockEff = typeof getBlockSourceEfficiency === "function"
      ? getBlockSourceEfficiency(existingBlockSources)
      : 1;
    if (blockEff < 1) score *= blockEff;
  }

  const hasPoison = (def.effects || []).some((e) => e.type === "poison");
  if (hasPoison) {
    const existingPoisonSources = countPoisonSources([...items, ...bench]);
    const poisonEff = typeof getPoisonSourceEfficiency === "function"
      ? getPoisonSourceEfficiency(existingPoisonSources)
      : 1;
    if (poisonEff < 1) score *= poisonEff;
    if (existingPoisonSources >= 1) score *= 0.45;
    if (existingPoisonSources >= 2) score *= 0.2;
  }

  const copies = countItemCopies([...items, ...bench], itemId);
  if (copies > 0) {
    const dupEff = typeof getDuplicateItemEfficiency === "function"
      ? getDuplicateItemEfficiency(copies)
      : 1;
    if (dupEff < 1) score *= dupEff;
  }

  if (def.tags.includes("weapon")) {
    const weapons = countWeaponItems([...items, ...bench]);
    const synergy = countSynergyPotential(itemId, items) + countSynergyPotential(itemId, bench);
    if (weapons >= 2 && synergy < AI_SYNERGY_POTENTIAL_WEIGHT) score -= 7;
    if (weapons >= 3) score -= 5;
  }

  if (archetype.id === "warrior" && round <= 4) {
    if (def.tags.includes("weapon")) score += 10;
    if (def.tags.includes("armor") || def.tags.includes("shield")) score += 8;
  }

  if (archetype.id === "priest") {
    const foodN = typeof countFoodItemsInLoadout === "function"
      ? countFoodItemsInLoadout([...items, ...bench])
      : [...items, ...bench].filter((i) => ITEM_CATALOG[i.itemId]?.tags?.includes("food")).length;
    if (def.tags.includes("food")) {
      score += 38;
      if (foodN < 3) score += 18;
      if (foodN < 5) score += 8;
    }
    if (def.tags.includes("potion")) score += 14;
    if (foodN < 3 && def.tags.includes("weapon") && !def.tags.includes("holy")) score -= 45;
    if (def.tags.includes("weapon") && !def.tags.includes("holy")) score -= 28;
    if (def.tags.includes("armor") && !def.tags.includes("food")) score -= 12;
  }

  if (archetype.id === "rogue" && def.tags?.includes("amplifier")) {
    const ampN = [...items, ...bench].filter((i) =>
      ITEM_CATALOG[i.itemId]?.tags?.includes("amplifier"),
    ).length;
    const weapons = countWeaponItems([...items, ...bench]);
    if (ampN >= 1) score -= 18;
    if (weapons < 1) score -= 30;
  }

  if (archetype.id === "rogue") {
    const weapons = countWeaponItems([...items, ...bench]);
    const early = round <= 8;
    if (weapons < 2 && def.tags.includes("weapon") && !hasBlockOnlyItem(def)) score += early ? 24 : 16;
    if (weapons < 1 && def.tags.includes("poison") && !def.tags.includes("weapon")) score -= 8;
    if (weapons < 1 && def.tags.includes("gem")) score -= 28;
  }

  if (archetype.id === "mage" && round <= 6) {
    if (itemHasMagicDamage(def) || def.tags.includes("gem") || def.tags.includes("magic")) score += 12;
    if (def.tags.includes("food") || def.tags.includes("potion")) score -= 10;
  }
  if (archetype.id === "mage" && round >= 10) {
    if (itemHasMagicDamage(def) || def.tags.includes("fire") || def.tags.includes("magic")) score += 16;
    if (def.tags.includes("weapon") && !itemHasMagicDamage(def)) score -= 12;
  }

  if (archetype.id === "rogue" && round >= 12 && def.tags.includes("weapon")) {
    const weapons = countWeaponItems([...items, ...bench]);
    if (weapons >= 2) score -= 6;
  }

  score -= def.shape.length * 1.2;
  score += (getItemPowerScore(def) / Math.max(1, def.cost)) * 1.5;

  if (!hasPriority && def.rarity === "rare") score += 5;
  if (!hasPriority && def.rarity === "uncommon") score += 2;
  if (!hasPriority && def.rarity === "legendary") score += 10;

  return score;
}

function scoreOwnedItem(item, archetype, items, scout = null, round = 1) {
  const others = items.filter((i) => i.uid !== item.uid);
  return scoreItemForAI(item.itemId, archetype, others, [], null, 9, 7, [], scout, round) - 1;
}

function scorePlacementPosition(containers, items, itemId, placement) {
  const def = ITEM_CATALOG[itemId];
  const temp = {
    uid: "__temp__",
    itemId,
    col: placement.col,
    row: placement.row,
    rotation: placement.rotation,
  };
  const combined = [...items.filter((i) => i.uid !== temp.uid), temp];
  let score = 0;

  const neighbors = getAdjacentItems(combined, temp);
  neighbors.forEach((entry, neighborUid) => {
    const other = combined.find((i) => i.uid === neighborUid);
    if (!other) return;
    const oDef = ITEM_CATALOG[other.itemId];
    (def.synergies || []).forEach((rule) => {
      if (entry.strong && rule.adjacency !== "weak" && rule.neighborTags.some((t) => oDef.tags.includes(t))) {
        score += AI_SYNERGY_PLACEMENT_STRONG;
      }
      if (entry.weak && rule.adjacency !== "strong" && rule.neighborTags.some((t) => oDef.tags.includes(t))) {
        score += AI_SYNERGY_PLACEMENT_WEAK;
      }
    });
    if (typeof getRecipesUsingIngredient === "function") {
      getRecipesUsingIngredient(itemId).forEach((recipe) => {
        recipe.inputs.forEach((input) => {
          if (input.itemId === itemId || other.itemId !== input.itemId) return;
          if (entry.strong) score += 20;
        });
      });
    }
  });

  const bounds = getSlotBounds(containers);
  if (bounds) {
    const cells = getItemCells(temp);
    const centerCol = cells.reduce((s, [c]) => s + c, 0) / cells.length;
    const centerRow = cells.reduce((s, [, r]) => s + r, 0) / cells.length;
    const midCol = (bounds.minCol + bounds.maxCol) / 2;
    const midRow = (bounds.minRow + bounds.maxRow) / 2;
    score -= Math.abs(centerCol - midCol) + Math.abs(centerRow - midRow);
  }

  return score;
}

function scoreFullLoadout(containers, items) {
  let total = 0;
  items.forEach((item) => {
    total += scorePlacementPosition(containers, items, item.itemId, {
      col: item.col,
      row: item.row,
      rotation: item.rotation || 0,
    });
  });
  return total;
}

function findBestLoadoutPlacement(containers, items, itemId, excludeUid = null) {
  const slots = [...buildSlotSet(containers)].map((k) => k.split(",").map(Number));
  let best = null;
  let bestScore = -Infinity;

  for (let rot = 0; rot < 4; rot++) {
    for (const [col, row] of slots) {
      const placement = resolveLoadoutPlacement(containers, items, itemId, col, row, rot, excludeUid);
      if (!placement.valid) continue;
      const posScore = scorePlacementPosition(containers, items, itemId, placement);
      if (posScore > bestScore) {
        bestScore = posScore;
        best = placement;
      }
    }
  }

  if (best) return best;
  return findLoadoutItemPlacement(containers, items, itemId, 0);
}

function generateAIShopSlots(count = 4, ctx = {}) {
  return rollShopBatch(count, ctx);
}

function aiScoreContext(state, archetype, gridW, gridH, scout, round = 1) {
  return {
    archetype,
    items: state.items,
    bench: state.bench,
    classId: state.classId,
    gridW,
    gridH,
    containers: state.containers,
    scout,
    round,
  };
}

function aiItemScore(itemId, ctx) {
  return scoreItemForAI(
    itemId,
    ctx.archetype,
    ctx.items,
    ctx.bench,
    ctx.classId,
    ctx.gridW,
    ctx.gridH,
    ctx.containers,
    ctx.scout,
    ctx.round,
  );
}

function aiPurgeOffBuildBoard(state, archetype, scout, round, battleWon) {
  if (!isLoadoutCommitted(round, state.items.length)) return;
  let guard = 0;
  while (guard < 40) {
    guard += 1;
    const victim = state.items.find((item) =>
      shouldSellForKillBuild(item, archetype, state.items, scout, round, battleWon),
    );
    if (!victim || state.items.length <= 2) break;
    state.gold += ITEM_CATALOG[victim.itemId].cost;
    state.items = state.items.filter((i) => i.uid !== victim.uid);
  }
}

function aiTrySellWeakest(state, archetype, gridW = 9, gridH = 7, scout = null, round = 1, battleWon = null) {
  const ctx = aiScoreContext(state, archetype, gridW, gridH, scout, round);
  let changed = true;
  let guard = 0;

  while (changed && guard < 50) {
    guard++;
    changed = false;

    if (state.bench.length > 0) {
      const benchScores = state.bench.map((b, idx) => ({
        idx,
        itemId: b.itemId,
        score: aiItemScore(b.itemId, ctx),
        forceSell: shouldSellForKillBuild({ itemId: b.itemId }, archetype, state.items, scout, round, battleWon)
          || (isLoadoutCommitted(round, state.items.length)
            && !itemMatchesKillArchetype(ITEM_CATALOG[b.itemId], archetype)),
      }));
      benchScores.sort((a, b) => a.score - b.score);
      const worst = benchScores[0];
      const benchThreshold = worst
        ? getAiSellThreshold({ itemId: worst.itemId }, archetype, state.items, scout, round, battleWon)
        : AI_SELL_THRESHOLD;
      const benchFull = state.bench.length >= AI_MAX_BENCH;
      if (
        worst
        && (benchFull || worst.forceSell)
        && (worst.forceSell || worst.score < benchThreshold)
      ) {
        const sold = state.bench.splice(worst.idx, 1)[0];
        state.gold += ITEM_CATALOG[sold.itemId].cost;
        changed = true;
        continue;
      }
    }

    const ownedScores = state.items
      .map((item) => ({
        item,
        score: scoreOwnedItem(item, archetype, state.items, scout, round),
        forceSell: shouldSellForKillBuild(item, archetype, state.items, scout, round, battleWon),
        threshold: getAiSellThreshold(item, archetype, state.items, scout, round, battleWon),
      }))
      .sort((a, b) => a.score - b.score);

    const worstOwned = ownedScores[0];
    if (
      worstOwned
      && state.items.length > 1
      && (worstOwned.forceSell || worstOwned.score < worstOwned.threshold)
    ) {
      const sold = worstOwned.item;
      state.gold += ITEM_CATALOG[sold.itemId].cost;
      state.items = state.items.filter((i) => i.uid !== sold.uid);
      changed = true;
    }
  }
}

function aiPlaceBenchContainers(state, gridW, gridH) {
  let progress = true;
  let guard = 0;
  while (progress && guard < 12) {
    guard++;
    progress = false;
    for (let i = 0; i < state.bench.length; i++) {
      const benchItem = state.bench[i];
      if (!isContainerItem(benchItem.itemId)) continue;
      const spot = findAdjacentContainerSpot(state.containers, gridW, gridH, benchItem.itemId)
        || findContainerPlacement(gridW, gridH, state.containers, benchItem.itemId);
      if (!spot) continue;
      state.containers.push(createContainer(
        benchItem.itemId,
        spot.col,
        spot.row,
        benchItem.rotation || spot.rotation || 0,
      ));
      state.bench.splice(i, 1);
      progress = true;
      break;
    }
  }
}

function aiPlaceBenchItems(state, gridW, gridH, archetype = null, scout = null, round = 1) {
  aiPlaceBenchContainers(state, gridW, gridH);
  let progress = true;
  let guard = 0;
  while (progress && guard < 30) {
    guard++;
    progress = false;
    const order = state.bench
      .map((benchItem, index) => ({ benchItem, index, score: archetype
        ? scoreItemForAI(
          benchItem.itemId,
          archetype,
          state.items,
          state.bench.filter((_, i) => i !== index),
          state.classId,
          gridW,
          gridH,
          state.containers,
          scout,
          round,
        )
        : 0,
      onTheme: archetype
        ? itemMatchesKillArchetype(ITEM_CATALOG[benchItem.itemId], archetype)
        : true,
      }))
      .sort((a, b) => b.score - a.score);

    const hasOnThemeBench = order.some((entry) => entry.onTheme);
    const placementQueue = (archetype && isLoadoutCommitted(round, state.items.length) && hasOnThemeBench)
      ? order.filter((entry) => entry.onTheme)
      : order;

    for (const entry of placementQueue) {
      const benchItem = entry.benchItem;
      const benchIndex = state.bench.indexOf(benchItem);
      if (benchIndex < 0) continue;
      if (isContainerItem(benchItem.itemId)) continue;
      if (typeof isGemItem === "function" && isGemItem(benchItem.itemId)) continue;
      if (
        archetype
        && isLoadoutCommitted(round, state.items.length)
        && !entry.onTheme
      ) continue;
      const spot = findBestLoadoutPlacement(state.containers, state.items, benchItem.itemId);
      if (!spot?.valid) continue;
      state.items.push(createPlacedItem(benchItem.itemId, spot.col, spot.row, spot.rotation));
      state.bench.splice(benchIndex, 1);
      progress = true;
      break;
    }
  }
}

/** Перекладывает предметы на поле ради сильных соседств. */
function aiOptimizeLoadout(state) {
  if (state.items.length < 2) return;

  let improved = true;
  let guard = 0;
  while (improved && guard < 80) {
    guard++;
    improved = false;
    const before = scoreFullLoadout(state.containers, state.items);

    for (const item of [...state.items]) {
      const best = findBestLoadoutPlacement(state.containers, state.items, item.itemId, item.uid);
      if (!best?.valid) continue;

      const samePlace = item.col === best.col && item.row === best.row
        && (item.rotation || 0) === (best.rotation || 0);
      if (samePlace) continue;

      const moved = state.items.map((i) =>
        (i.uid === item.uid
          ? { ...i, col: best.col, row: best.row, rotation: best.rotation }
          : i),
      );
      if (!validateLoadoutItems(state.containers, moved)) continue;

      const after = scoreFullLoadout(state.containers, moved);
      if (after > before + 0.15) {
        state.items = moved;
        improved = true;
        break;
      }
    }
  }

  if (state.items.length < 2) return;
  let swapGuard = 0;
  while (swapGuard < 24) {
    swapGuard++;
    const before = scoreFullLoadout(state.containers, state.items);
    let swapped = false;

    for (let i = 0; i < state.items.length; i++) {
      for (let j = i + 1; j < state.items.length; j++) {
        const a = state.items[i];
        const b = state.items[j];
        const candidate = state.items.map((item) => {
          if (item.uid === a.uid) return { ...item, col: b.col, row: b.row, rotation: b.rotation || 0 };
          if (item.uid === b.uid) return { ...item, col: a.col, row: a.row, rotation: a.rotation || 0 };
          return item;
        });
        if (!validateLoadoutItems(state.containers, candidate)) continue;
        const after = scoreFullLoadout(state.containers, candidate);
        if (after > before + 0.5) {
          state.items = candidate;
          swapped = true;
          break;
        }
      }
      if (swapped) break;
    }
    if (!swapped) break;
  }
}

function aiApplyCrafting(state) {
  if (typeof tryResolveCrafting !== "function") return;
  let guard = 0;
  while (guard < 12) {
    guard += 1;
    const result = tryResolveCrafting(state.containers, state.items);
    if (!result.crafted.length) break;
    state.items = result.items;
  }
}

function findStrongAdjacentPlacement(containers, items, itemId, anchorItem, excludeUid = null) {
  if (!ITEM_CATALOG[itemId] || !anchorItem) return null;
  const anchorCells = getItemCells(anchorItem);
  let best = null;
  let bestScore = -Infinity;

  for (let rot = 0; rot < 4; rot += 1) {
    const shape = rotateShape(ITEM_CATALOG[itemId].shape, rot);
    for (const [ac, ar] of anchorCells) {
      for (const [dx, dy] of STRONG_OFFSETS) {
        const touchCol = ac + dx;
        const touchRow = ar + dy;
        for (const [sdx, sdy] of shape) {
          const col = touchCol - sdx;
          const row = touchRow - sdy;
          const placement = resolveLoadoutPlacement(
            containers,
            items,
            itemId,
            col,
            row,
            rot,
            excludeUid,
          );
          if (!placement.valid) continue;
          const temp = createPlacedItem(itemId, placement.col, placement.row, placement.rotation);
          const pool = [
            ...items.filter((i) => i.uid !== excludeUid && i.uid !== temp.uid),
            temp,
          ];
          const adj = getAdjacentItems(pool, temp);
          if (!adj.get(anchorItem.uid)?.strong) continue;
          const posScore = scorePlacementPosition(containers, items, itemId, placement) + 25;
          if (posScore > bestScore) {
            bestScore = posScore;
            best = placement;
          }
        }
      }
    }
  }
  return best;
}

function aiRecipeInputTotal(recipe) {
  return recipe.inputs.reduce((sum, input) => sum + input.count, 0);
}

function aiHasIngredientsForRecipe(recipe, items, bench) {
  const counts = new Map();
  [...items, ...bench].forEach((item) => {
    counts.set(item.itemId, (counts.get(item.itemId) || 0) + 1);
  });
  return recipe.inputs.every((input) => (counts.get(input.itemId) || 0) >= input.count);
}

function aiIsRecipeClusterReady(items, recipe) {
  if (typeof getStrongCraftComponents !== "function") return false;
  const components = getStrongCraftComponents(items);
  return components.some((cluster) => {
    if (cluster.length !== aiRecipeInputTotal(recipe)) return false;
    const counts = new Map();
    cluster.forEach((item) => {
      counts.set(item.itemId, (counts.get(item.itemId) || 0) + 1);
    });
    return recipe.inputs.every((input) => (counts.get(input.itemId) || 0) === input.count);
  });
}

function aiCraftRecipePriority(recipe) {
  const outDef = ITEM_CATALOG[recipe.output];
  return outDef ? getItemPowerScore(outDef) : 0;
}

function aiNudgeForCrafting(state) {
  if (typeof getAllCraftRecipes !== "function") return;
  const recipes = [...getAllCraftRecipes()].sort(
    (a, b) => aiCraftRecipePriority(b) - aiCraftRecipePriority(a),
  );
  const ingredientIds = (recipe) => recipe.inputs.map((input) => input.itemId);

  let guard = 0;
  while (guard < 32) {
    guard += 1;
    let progress = false;

    if (typeof tryResolveCrafting === "function") {
      const crafted = tryResolveCrafting(state.containers, state.items);
      if (crafted.crafted.length) {
        state.items = crafted.items;
        progress = true;
        continue;
      }
    }

    for (const recipe of recipes) {
      if (!aiHasIngredientsForRecipe(recipe, state.items, state.bench)) continue;
      if (aiIsRecipeClusterReady(state.items, recipe)) continue;

      const inputs = ingredientIds(recipe);
      const anchors = state.items.filter(
        (item) => inputs.includes(item.itemId) && !(typeof isGemItem === "function" && isGemItem(item.itemId)),
      );

      for (const anchor of anchors) {
        for (let bi = 0; bi < state.bench.length; bi += 1) {
          const benchItem = state.bench[bi];
          if (!inputs.includes(benchItem.itemId)) continue;
          const spot = findStrongAdjacentPlacement(
            state.containers,
            state.items,
            benchItem.itemId,
            anchor,
          );
          if (!spot?.valid) continue;
          state.items.push(createPlacedItem(benchItem.itemId, spot.col, spot.row, spot.rotation));
          state.bench.splice(bi, 1);
          progress = true;
          break;
        }
        if (progress) break;

        for (const mover of state.items) {
          if (mover.uid === anchor.uid) continue;
          if (!inputs.includes(mover.itemId)) continue;
          const spot = findStrongAdjacentPlacement(
            state.containers,
            state.items,
            mover.itemId,
            anchor,
            mover.uid,
          );
          if (!spot?.valid) continue;
          const samePlace = mover.col === spot.col && mover.row === spot.row
            && (mover.rotation || 0) === (spot.rotation || 0);
          if (samePlace) continue;
          const moved = state.items.map((item) =>
            (item.uid === mover.uid
              ? { ...item, col: spot.col, row: spot.row, rotation: spot.rotation }
              : item),
          );
          if (!validateLoadoutItems(state.containers, moved)) continue;
          state.items = moved;
          progress = true;
          break;
        }
        if (progress) break;
      }
      if (progress) break;
    }

    if (!progress) break;
  }
}

function aiScoreGemHost(host, gemId, archetype) {
  if (typeof canSocketGem !== "function" || !canSocketGem(host, gemId)) return -999;
  const def = ITEM_CATALOG[host.itemId];
  if (!def) return -999;
  let score = getItemPowerScore(def);
  const cat = typeof getSocketCategory === "function" ? getSocketCategory(def) : "accessory";
  if (cat === "weapon") score += 10;
  else if (cat === "armor" || def.tags?.includes("shield")) score += 7;
  else score += 4;

  const parsed = typeof parseGemId === "function" ? parseGemId(gemId) : null;
  if (parsed && archetype?.id) {
    if (archetype.id === "mage" && parsed.type === "amethyst") score += 6;
    if (archetype.id === "warrior" && parsed.type === "ruby") score += 6;
    if (archetype.id === "rogue" && parsed.type === "emerald") score += 6;
    if (archetype.id === "priest" && parsed.type === "sapphire") score += 6;
  }
  return score;
}

function aiSocketGems(state) {
  if (typeof socketGemIntoItem !== "function" || typeof canSocketGem !== "function") return;
  if (typeof isGemItem !== "function") return;
  if (!state.bench) state.bench = [];

  const archetype = state.archetype || null;
  let guard = 0;

  while (guard < 24) {
    guard += 1;

    let gemId = null;
    let gemUid = null;
    let benchIdx = state.bench.findIndex((b) => isGemItem(b.itemId));
    if (benchIdx >= 0) {
      gemId = state.bench[benchIdx].itemId;
    } else {
      const fieldGem = state.items.find((item) => isGemItem(item.itemId));
      if (fieldGem) {
        gemId = fieldGem.itemId;
        gemUid = fieldGem.uid;
      }
    }
    if (!gemId) break;

    let bestHost = null;
    let bestScore = -Infinity;
    state.items.forEach((host) => {
      if (isGemItem(host.itemId)) return;
      const hostScore = aiScoreGemHost(host, gemId, archetype);
      if (hostScore > bestScore) {
        bestScore = hostScore;
        bestHost = host;
      }
    });
    if (!bestHost || bestScore < 0) break;

    const hostUid = bestHost.uid;
    const socketed = socketGemIntoItem(bestHost, gemId);
    if (!socketed) break;

    state.items = state.items
      .filter((item) => item.uid !== gemUid)
      .map((item) => (item.uid === hostUid ? socketed : item));

    if (benchIdx >= 0) {
      state.bench.splice(benchIdx, 1);
    }
  }
}

function aiBuyFromShop(state, archetype, shop, gridW = 9, gridH = 7, scout = null, round = 1, battleWon = null) {
  let activeArchetype = state.archetype || archetype;
  const ctx = () => aiScoreContext(state, activeArchetype, gridW, gridH, scout, round);

  const ranked = () =>
    shop
      .map((itemId, index) => ({
        index,
        itemId,
        score: aiItemScore(itemId, ctx()),
      }))
      .filter((c) => c.itemId && ITEM_CATALOG[c.itemId])
      .sort((a, b) => b.score - a.score);

  let progress = true;
  let guard = 0;
  while (progress && guard < 30) {
    guard++;
    progress = false;
    const candidates = ranked();

    for (const pick of candidates) {
      const def = ITEM_CATALOG[pick.itemId];
      if (state.gold < def.cost) continue;
      if (state.bench.length >= AI_MAX_BENCH && pick.score < AI_SELL_THRESHOLD + 2) continue;
      if (pick.score < 0 && Math.random() > 0.08) continue;

      if (state.bench.length >= AI_MAX_BENCH) {
        aiTrySellWeakest(state, activeArchetype, gridW, gridH, scout, round, battleWon);
      }
      if (state.bench.length >= AI_MAX_BENCH) continue;

      state.gold -= def.cost;
      state.bench.push({
        itemId: pick.itemId,
        uid: `ai-bench-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      });
      shop[pick.index] = null;
      progress = true;

      const nextArch = Object.values(AI_ARCHETYPES).find((a) =>
        itemMatchesKillArchetype(def, a) && a.priorityTags.some((t) => def.tags.includes(t)),
      );
      if (nextArch && nextArch.id !== activeArchetype.id) {
        const onBoard = countArchetypeItems(state.items, nextArch);
        const onBench = state.bench.filter((b) => itemMatchesKillArchetype(ITEM_CATALOG[b.itemId], nextArch)).length;
        if (onBoard + onBench >= 2 || pick.score > (candidates[1]?.score || 0) + 8) {
          activeArchetype = nextArch;
          state.archetype = nextArch;
          state.classId = nextArch.id;
        }
      }

      aiTrySellWeakest(state, activeArchetype, gridW, gridH, scout, round, battleWon);
      break;
    }
  }

  return activeArchetype;
}

/**
 * Фаза подготовки ИИ после раунда: контр-пик, покупки, продажи, размещение, перекомпоновка.
 * @param {Array} playerItems — предметы для скаута (контр-пик).
 * @param {string|null} playerClass — класс цели скаута.
 * @param {{ recentResults?: string[] }} prepOpts — доп. контекст подготовки.
 * @returns {{ gold, containers, items, bench, archetype, classId }}
 */
function aiEnemyPrepPhase(
  state,
  round,
  gridW,
  gridH,
  battleWon = null,
  playerItems = [],
  playerClass = null,
  prepOpts = {},
) {
  const scoutItems = prepOpts.scoutItems ?? playerItems;
  const scoutClass = prepOpts.scoutClass ?? playerClass;
  const scout = buildPlayerScout(scoutItems);
  const killArchetype = prepOpts.forceArchetypeId && AI_ARCHETYPES[prepOpts.forceArchetypeId]
    ? AI_ARCHETYPES[prepOpts.forceArchetypeId]
    : pickKillArchetype(
      scout,
      scoutClass,
      round,
      state.archetype,
      state.items || [],
      battleWon,
    );
  const next = {
    archetype: killArchetype,
    classId: killArchetype.id,
    gold: state.gold ?? AI_ECON.START_GOLD,
    containers: state.containers || createStartingContainers(),
    items: [...(state.items || [])],
    bench: [...(state.bench || [])],
  };

  if (battleWon === true) next.gold += AI_ECON.ROUND_GOLD + AI_ECON.WIN_GOLD;
  else if (battleWon === false) next.gold += AI_ECON.ROUND_GOLD;
  else if (battleWon === null && round === 1) {
    // старт игры
  } else {
    next.gold += AI_ECON.ROUND_GOLD;
  }

  aiOptimizeLoadout(next);
  aiTrySellWeakest(next, killArchetype, gridW, gridH, scout, round, battleWon);
  aiPurgeOffBuildBoard(next, killArchetype, scout, round, battleWon);

  const shopCtx = {
    round,
    gold: next.gold,
    playerClass: next.classId,
    loadoutTags: collectLoadoutTags(next.items),
    loadoutItems: next.items,
    opponentLoadoutTags: scout.tags,
    recentResults: Array.isArray(prepOpts.recentResults)
      ? prepOpts.recentResults
      : (battleWon === false ? ["loss", "loss"] : []),
    goldSpentTotal: 0,
    isReroll: false,
    hasUniqueInLoadout: typeof loadoutHasUniqueItem === "function"
      ? loadoutHasUniqueItem(next.items)
      : false,
  };

  let shopArchetype = next.archetype;
  const shop = generateAIShopSlots(4, shopCtx);
  shopArchetype = aiBuyFromShop(next, shopArchetype, shop, gridW, gridH, scout, round, battleWon);

  const refreshChance = battleWon === false ? Math.min(0.85, AI_SHOP_REFRESH_CHANCE + 0.25) : AI_SHOP_REFRESH_CHANCE;
  if (next.gold >= 1 && Math.random() < refreshChance) {
    next.gold -= 1;
    shopArchetype = aiBuyFromShop(
      next,
      shopArchetype,
      generateAIShopSlots(4, { ...shopCtx, isReroll: true }),
      gridW,
      gridH,
      scout,
      round,
      battleWon,
    );
  }

  next.archetype = shopArchetype;
  next.classId = shopArchetype.id;
  aiTrySellWeakest(next, next.archetype, gridW, gridH, scout, round, battleWon);
  aiPlaceBenchItems(next, gridW, gridH, next.archetype, scout, round);
  aiOptimizeLoadout(next);
  aiTrySellWeakest(next, next.archetype, gridW, gridH, scout, round, battleWon);
  aiPlaceBenchItems(next, gridW, gridH, next.archetype, scout, round);
  aiOptimizeLoadout(next);
  aiSocketGems(next);
  aiNudgeForCrafting(next);
  aiApplyCrafting(next);
  aiOptimizeLoadout(next);
  aiSocketGems(next);
  aiNudgeForCrafting(next);
  aiApplyCrafting(next);
  aiPurgeOffBuildBoard(next, next.archetype, scout, round, battleWon);
  aiTrySellWeakest(next, next.archetype, gridW, gridH, scout, round, battleWon);
  aiSocketGems(next);
  aiNudgeForCrafting(next);
  aiApplyCrafting(next);
  applySynergyModifiersToContainers(next.containers, next.items);

  return next;
}

function createInitialEnemyState(round, gridW, gridH, playerItems = [], playerClass = null) {
  const scout = buildPlayerScout(playerItems);
  const killArchetype = pickKillArchetype(scout, playerClass, round, null, playerItems, null);
  const containers = createStartingContainers();
  const items = applyClassStarters(containers, [], killArchetype.id);
  return aiEnemyPrepPhase(
    {
      archetype: killArchetype,
      classId: killArchetype.id,
      gold: AI_ECON.START_GOLD,
      containers,
      items,
      bench: [],
    },
    round,
    gridW,
    gridH,
    null,
    playerItems,
    playerClass,
  );
}
