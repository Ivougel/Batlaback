/**
 * Боевой движок: универсальные эффекты, классовые бонусы, статусы.
 */

const MAX_BATTLE_DURATION = 120;
/** Не более N активаций предметов за один tick — разносит залпы по волнам. */
const MAX_ACTIVATIONS_PER_SIDE_PER_TICK = 2;
const BATTLE_CD_START_MIN_RATIO = 0.5;
const BATTLE_CD_START_RANGE_RATIO = 0.5;
const STAMINA_BASE_MAX = 40;
const STAMINA_REGEN_PER_SEC = 5;
const STAMINA_WEAPON_REGEN_BONUS = 1;
const STAMINA_FAILED_RETRY_CD = 0.45;
/** Множитель роста пула выносливости от дорогих предметов (ниже = меньше «разгон»). */
const STAMINA_POOL_PEAK_MULT = 0.55;
const STAMINA_POOL_PEAK_ADD = 5;
const STAMINA_POOL_BASE_ADD = 8;
/** Сглаживание разгона урона и DoT (1 = без изменений). */
const DAMAGE_PACING_SCALE = 0.88;
const POISON_STACK_PACING = 0.55;
const GROUND_FIRE_PACING = 0.85;
/** Усталость арены: порог по номеру раунда забега (1…16). */
const FATIGUE_ROUND_START_MAX = 18;
const FATIGUE_ROUND_START_MIN = 7;
const FATIGUE_RUN_ROUNDS = 16;
const FATIGUE_DAMAGE_BONUS_BASE = 0.12;
const FATIGUE_DAMAGE_ESCALATE_EVERY_SEC = 5;
const FATIGUE_DAMAGE_ESCALATE_STEP = 0.05;
const FATIGUE_DAMAGE_BONUS_CAP = 0.4;
/** Через столько секунд после старта усталости — доп. drain HP. */
const FATIGUE_HP_DRAIN_DELAY_AFTER_START = 10;
const FATIGUE_HP_DRAIN_PER_SEC = 2;

function getFatigueStartSec(battleRound = 1, maxItemsOnSide = 0) {
  const round = Math.max(1, Math.min(FATIGUE_RUN_ROUNDS, battleRound || 1));
  const t = (round - 1) / Math.max(1, FATIGUE_RUN_ROUNDS - 1);
  let start = FATIGUE_ROUND_START_MAX - t * (FATIGUE_ROUND_START_MAX - FATIGUE_ROUND_START_MIN);
  if (maxItemsOnSide >= 8) start -= 4.5;
  else if (maxItemsOnSide >= 6) start -= 3;
  else if (maxItemsOnSide >= 5) start -= 1.5;
  return Math.max(4, start);
}

function getFatigueBoardPressure(state) {
  if (!state?.player?.items || !state?.enemy?.items) return 0;
  return Math.max(state.player.items.length, state.enemy.items.length);
}

function isFatigueActive(state) {
  if (!state?.battleRound) return false;
  return (state.elapsed || 0) >= getFatigueStartSec(state.battleRound, getFatigueBoardPressure(state));
}

function getFatigueSecondsActive(state) {
  if (!isFatigueActive(state)) return 0;
  return Math.max(0, (state.elapsed || 0) - getFatigueStartSec(state.battleRound, getFatigueBoardPressure(state)));
}

function getFatigueDamageTakenMult(state) {
  const activeSec = getFatigueSecondsActive(state);
  if (activeSec <= 0) return 1;
  const steps = Math.floor(activeSec / FATIGUE_DAMAGE_ESCALATE_EVERY_SEC);
  const bonus = Math.min(
    FATIGUE_DAMAGE_BONUS_CAP,
    FATIGUE_DAMAGE_BONUS_BASE + steps * FATIGUE_DAMAGE_ESCALATE_STEP,
  );
  return 1 + bonus;
}

function getFatiguePrepDescription(battleRound = 1, itemCount = 7) {
  const start = Math.round(getFatigueStartSec(battleRound, itemCount) * 10) / 10;
  return `С ${start}с: входящий урон растёт; через ${FATIGUE_HP_DRAIN_DELAY_AFTER_START}с после — −${FATIGUE_HP_DRAIN_PER_SEC} HP/с`;
}

const POISON_STACK_CAP = 999;
/** Урон яда в секунду = floor(стаки × множитель), мин. 1 при стаках > 0. */
const POISON_DOT_PER_STACK = 0.5;
const REPEAT_MAGIC_EFFECT_SCALE = 0.42;
const MAX_CDR_RATIO = 0.5;
const MAX_DAMAGE_MULT_BONUS = 0.58;
const MAX_MAGIC_DAMAGE_MULT_BONUS = 0.78;
const MAX_LIFESTEAL = 0.35;
const MAX_SHIELD_BLOCK_MULT = 0.45;
const MAX_CRIT_CHANCE = 0.35;
const MAX_POISON_BONUS_PER_ITEM = 2;
const MAX_FLAT_DAMAGE_BONUS = 6;
const MAX_FLAT_BLOCK_BONUS = 10;
const MAX_FLAT_HEAL_BONUS = 6;
/** Пассивная броня не может поглотить больше этой доли входящего урона за удар. */
const ARMOR_ABSORB_CAP_RATIO = 0.5;
/** Доля защиты, которую элементальный урон частично игнорирует. */
const BLOCK_PENETRATION = {
  magic: 0.4,
  fire: 0.45,
};
const ARMOR_PENETRATION = {
  magic: 0.55,
  fire: 0.6,
};
/** Элементальный урон слабее ограничен cap поглощения брони за удар. */
const ELEMENTAL_ARMOR_CAP_REDUCTION = 0.2;
/** Эффективность 1-го, 2-го, 3-го и 4+ источников активного блока на стороне. */
const BLOCK_SOURCE_EFFICIENCY = [1, 0.85, 0.72, 0.6];
/** То же для дубликатов одного itemId, grantBlockBuff и poison-источников. */
const DUPLICATE_ITEM_EFFICIENCY = BLOCK_SOURCE_EFFICIENCY;
/** 2-й и дальше poison-слот заметно слабее (отдельно от блока). */
const POISON_SOURCE_EFFICIENCY = [1, 0.65, 0.5, 0.4];
/** Лечение слабее под ядом: −5% за стак, макс. −50%. */
const HEAL_POISON_PENALTY_PER_STACK = 0.05;
const HEAL_POISON_PENALTY_CAP = 0.5;

function getStackEfficiency(index, table = BLOCK_SOURCE_EFFICIENCY) {
  if (index < table.length) return table[index];
  return table[table.length - 1];
}

function scalePacedValue(value, scale) {
  if (value <= 0 || scale >= 1) return value;
  return Math.max(1, Math.floor(value * scale));
}

function scalePoisonStacks(stacks, scale = POISON_STACK_PACING) {
  if (stacks <= 0 || scale >= 1) return stacks;
  return Math.max(1, Math.floor(stacks * scale));
}

function getMaxGroundFireFromEffects(effects) {
  return (effects || [])
    .filter((e) => e.type === "groundFire")
    .reduce((max, e) => Math.max(max, Number(e.value) || 0), 0);
}

function resolveGroundFireValue(effects, fallback = 2) {
  const raw = getMaxGroundFireFromEffects(effects);
  return scalePacedValue(raw > 0 ? raw : fallback, GROUND_FIRE_PACING);
}

function getPoisonVictimTeam(self, foe, attackerTeam) {
  return foe === self ? attackerTeam : (attackerTeam === "player" ? "enemy" : "player");
}

function getArmorCapRatio(damageType) {
  if (damageType === "magic" || damageType === "fire") {
    return Math.max(0.2, ARMOR_ABSORB_CAP_RATIO - ELEMENTAL_ARMOR_CAP_REDUCTION);
  }
  return ARMOR_ABSORB_CAP_RATIO;
}

function getEffectiveBlock(block, damageType) {
  const penetration = BLOCK_PENETRATION[damageType] || 0;
  return Math.max(0, Math.floor(block * (1 - penetration)));
}

function getEffectiveDefense(defense, damageType) {
  const penetration = ARMOR_PENETRATION[damageType] || 0;
  return Math.max(0, Math.floor(defense * (1 - penetration)));
}

function itemHasActivatableBlockEffect(def) {
  return (def?.effects || []).some((e) => e.type === "block" && e.trigger !== "passive");
}

function getBlockSourceEfficiency(sourceIndex) {
  return getStackEfficiency(sourceIndex, BLOCK_SOURCE_EFFICIENCY);
}

function getDuplicateItemEfficiency(copyIndex) {
  return getStackEfficiency(copyIndex, DUPLICATE_ITEM_EFFICIENCY);
}

function getPoisonSourceEfficiency(sourceIndex) {
  return getStackEfficiency(sourceIndex, POISON_SOURCE_EFFICIENCY);
}

function getPoisonDotDamage(poisonStacks) {
  if (poisonStacks <= 0) return 0;
  return Math.max(1, Math.floor(poisonStacks * POISON_DOT_PER_STACK));
}

function getHealAmountUnderPoison(baseAmount, poisonStacks) {
  if (baseAmount <= 0 || poisonStacks <= 0) return baseAmount;
  const penalty = Math.min(
    HEAL_POISON_PENALTY_CAP,
    poisonStacks * HEAL_POISON_PENALTY_PER_STACK,
  );
  return Math.max(0, Math.floor(baseAmount * (1 - penalty)));
}

function itemHasPoisonEffect(def) {
  return (def?.effects || []).some((e) => e.type === "poison");
}

/** Снижает блок при нескольких block-предметах; полная сила у самого сильного источника. */
function assignBlockSourceEfficiency(side) {
  const blockItems = side.items.filter((item) => itemHasActivatableBlockEffect(ITEM_CATALOG[item.itemId]));
  blockItems.sort((a, b) => {
    const defA = ITEM_CATALOG[a.itemId];
    const defB = ITEM_CATALOG[b.itemId];
    const valA = (defA.effects.find((e) => e.type === "block")?.value || 0) + (a.runtime?.blockBonus || 0);
    const valB = (defB.effects.find((e) => e.type === "block")?.value || 0) + (b.runtime?.blockBonus || 0);
    return valB - valA;
  });
  blockItems.forEach((item, index) => {
    item.runtime = item.runtime || createRuntimeState(item);
    item.runtime.blockSourceEfficiency = getBlockSourceEfficiency(index);
  });
}

/** Несколько poison-предметов — слабее стаки (кроме сильнейшего). */
function assignPoisonSourceEfficiency(side) {
  const poisonItems = side.items.filter((item) => itemHasPoisonEffect(ITEM_CATALOG[item.itemId]));
  poisonItems.sort((a, b) => {
    const defA = ITEM_CATALOG[a.itemId];
    const defB = ITEM_CATALOG[b.itemId];
    const poisonA = defA.effects.find((e) => e.type === "poison");
    const poisonB = defB.effects.find((e) => e.type === "poison");
    const valA = (poisonA?.value || 0) + (a.runtime?.poisonBonus || 0);
    const valB = (poisonB?.value || 0) + (b.runtime?.poisonBonus || 0);
    return valB - valA;
  });
  poisonItems.forEach((item, index) => {
    item.runtime = item.runtime || createRuntimeState(item);
    item.runtime.poisonSourceEfficiency = getPoisonSourceEfficiency(index);
  });
}

/** 2-й и следующие копии одного itemId слабее (броня, урон, баффы). */
function assignDuplicateItemEfficiency(side) {
  const byId = new Map();
  side.items.forEach((item) => {
    if (!byId.has(item.itemId)) byId.set(item.itemId, []);
    byId.get(item.itemId).push(item);
  });
  byId.forEach((list) => {
    list.sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col));
    list.forEach((item, index) => {
      item.runtime = item.runtime || createRuntimeState(item);
      item.runtime.duplicateEfficiency = getDuplicateItemEfficiency(index);
    });
  });
}

/** Несколько щитов с grantBlockBuff — слабее бафф соседнему оружию. */
function assignGrantBlockBuffEfficiency(side) {
  const shields = side.items.filter((item) => item.runtime?.grantBlockBuff);
  shields.sort((a, b) => {
    const defA = ITEM_CATALOG[a.itemId];
    const defB = ITEM_CATALOG[b.itemId];
    const valA = (defA.effects.find((e) => e.type === "block")?.value || 0) + (a.runtime?.blockBonus || 0);
    const valB = (defB.effects.find((e) => e.type === "block")?.value || 0) + (b.runtime?.blockBonus || 0);
    return valB - valA;
  });
  shields.forEach((item, index) => {
    item.runtime = item.runtime || createRuntimeState(item);
    item.runtime.grantBlockBuffEfficiency = getBlockSourceEfficiency(index);
    item.runtime.blockBuffGiven = item.runtime.blockBuffGiven || 0;
  });
}

function clampCooldownMult(mult) {
  const value = Number(mult) || 1;
  return Math.max(1 - MAX_CDR_RATIO, Math.min(1, value));
}

function finalizeSideCombatStats(side) {
  side.cooldownMult = clampCooldownMult(side.cooldownMult);
  side.damageMult = Math.min(side.damageMult, 1 + MAX_DAMAGE_MULT_BONUS);
  side.magicDamageMult = Math.min(side.magicDamageMult, 1 + MAX_MAGIC_DAMAGE_MULT_BONUS);
  side.lifesteal = Math.min(side.lifesteal, MAX_LIFESTEAL);
  side.shieldBlockMult = Math.min(side.shieldBlockMult, MAX_SHIELD_BLOCK_MULT);
  side.critChance = Math.min(side.critChance, MAX_CRIT_CHANCE);
}

function clampItemRuntimeBonuses(item) {
  if (!item?.runtime) return;
  const rt = item.runtime;
  rt.cooldownMult = clampCooldownMult(rt.cooldownMult ?? 1);
  rt.poisonBonus = Math.min(rt.poisonBonus || 0, MAX_POISON_BONUS_PER_ITEM);
  rt.damageBonus = Math.min(rt.damageBonus || 0, MAX_FLAT_DAMAGE_BONUS);
  rt.blockBonus = Math.min(rt.blockBonus || 0, MAX_FLAT_BLOCK_BONUS);
  rt.healBonus = Math.min(rt.healBonus || 0, MAX_FLAT_HEAL_BONUS);
}

function scaleEffectForRepeat(effect, scale = REPEAT_MAGIC_EFFECT_SCALE) {
  if (scale >= 1 || effect.type !== "damage") return effect;
  const scaled = { ...effect };
  if (scaled.valueMin != null || scaled.valueMax != null) {
    scaled.valueMin = Math.max(1, Math.round((scaled.valueMin ?? scaled.value ?? 1) * scale));
    scaled.valueMax = Math.max(
      scaled.valueMin,
      Math.round((scaled.valueMax ?? scaled.value ?? 1) * scale),
    );
    scaled.value = Math.round((scaled.valueMin + scaled.valueMax) / 2);
    return scaled;
  }
  if (scaled.value == null) return effect;
  scaled.value = Math.max(1, Math.round(scaled.value * scale));
  return scaled;
}

function resolveBattleTimeout(state) {
  if (state.finished) return;
  const pHp = state.player.hp;
  const eHp = state.enemy.hp;
  state.finished = true;
  if (pHp === eHp) {
    state.winner = "draw";
  } else {
    state.winner = pHp > eHp ? "player" : "enemy";
  }
  pushBattleLog(state, {
    actor: "system",
    type: "info",
    message: state.winner === "draw"
      ? `Бой завершён по лимиту времени (${MAX_BATTLE_DURATION}с) — ничья`
      : `Бой завершён по лимиту времени (${MAX_BATTLE_DURATION}с) — побеждает ${battleTeamLabel(state.winner)}`,
  });
}

function createBattleSide(items, classId, prepMeta = {}) {
  const side = {
    hp: 108,
    maxHp: 108,
    block: 0,
    defense: 0,
    poisonStacks: 0,
    stacks: typeof createSideStacks === "function" ? createSideStacks() : { spikes: 0 },
    poisonTimer: 0,
    poisonSourceTeam: null,
    poisonSourceItemUid: null,
    damageMult: 1,
    magicDamageMult: 1,
    cooldownMult: 1,
    lifesteal: 0,
    critChance: 0,
    critDoublePoison: false,
    shieldBlockMult: 0,
    shieldBreakBonus: 0,
    slowDebuff: 0,
    slowTimer: 0,
    stunTimer: 0,
    invulnerableTimer: 0,
    reviveCharges: 0,
    reviveHpRatio: 0.5,
    reviveInvuln: 2,
    zeroStaminaTriggered: false,
    hpThresholdFired: new Set(),
    sideActivationTotal: 0,
    guaranteedCritTimer: 0,
    mutualHpThresholdFired: new Set(),
    hearts: 0,
    heartThresholdFired: new Set(),
    dodgeInterval: 0,
    dodgeTimer: 0,
    dodgeReady: false,
    groundFire: 0,
    groundFireTimer: 0,
    groundFireSourceTeam: null,
    groundFireSourceItemUid: null,
    repeatMagic: false,
    repeatAllAttacks: false,
    blockBuffCap: 0,
    blockBuffGiven: 0,
    timedBuffs: [],
    items: sortItemsForBattle(items.map(cloneBattleItem)),
    totalDamageDealt: 0,
    totalPhysicalDamageDealt: 0,
    totalMagicDamageDealt: 0,
    totalHealingDone: 0,
    totalBlockAbsorbed: 0,
    totalDamageBlocked: 0,
    blockLedger: [],
    classId: classId || null,
    luck: 0,
    procChanceBonus: 0,
    battleRageTimer: 0,
    battleRageUsed: false,
    battleRageDamageReduction: 0,
    battleRageCooldownFactor: 1,
    pendingShopBuffs: 0,
    stamina: 0,
    maxStamina: STAMINA_BASE_MAX,
    tagCooldownMult: 1,
    staminaRegen: STAMINA_REGEN_PER_SEC,
    staminaSpendFlash: 0,
    lastStaminaSpend: 0,
  };

  applyClassCombatBonus(side, classId);
  assignDuplicateItemEfficiency(side);
  assignBlockSourceEfficiency(side);
  assignPoisonSourceEfficiency(side);
  assignGrantBlockBuffEfficiency(side);
  applyPassiveItemEffects(side);
  side.pendingShopBuffs = Number(prepMeta.pendingShopBuffs) || 0;
  if (typeof collectMetaEffectsFromItems === "function") {
    collectMetaEffectsFromItems(side.items).forEach((effect) => {
      if (effect.phase === "battle_start" && effect.type === "starred_chance_bonus") {
        side.procChanceBonus = (side.procChanceBonus || 0) + (Number(effect.value) || 0);
      }
    });
  }
  side.items.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    (def?.effects || []).forEach((effect) => {
      if (effect.type !== "max_hp_per_start_item") return;
      const startCount = countBattleStartItems(side.items);
      side.maxHp += startCount * (Number(effect.value) || 0);
    });
  });
  if (side.pendingShopBuffs > 0) {
    side.timedBuffs.push({
      stat: "damage",
      value: 0.08 * side.pendingShopBuffs,
      remaining: 8,
    });
  }
  side.hp = side.maxHp;
  finalizeSideCombatStats(side);
  finalizeSideStamina(side);
  if (typeof applyBattleStartItemEffects === "function") {
    applyBattleStartItemEffects(side);
  }
  side.hp = side.maxHp;
  return side;
}

function finalizeSideStamina(side) {
  let peakCost = 0;
  let weaponCount = 0;
  side.items.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    const cost = getItemStaminaCost(def);
    if (cost > peakCost) peakCost = cost;
    if (def?.tags?.includes("weapon") && cost > 0) weaponCount += 1;
  });
  side.maxStamina = Math.max(
    STAMINA_BASE_MAX,
    Math.ceil(peakCost * STAMINA_POOL_PEAK_MULT + STAMINA_POOL_PEAK_ADD),
    Math.ceil(peakCost + STAMINA_POOL_BASE_ADD),
  );
  side.stamina = side.maxStamina;
  side.staminaRegen = STAMINA_REGEN_PER_SEC + weaponCount * STAMINA_WEAPON_REGEN_BONUS;
}

function spendBattleStamina(state, side, team, amount, item) {
  if (amount <= 0) return;
  side.stamina = Math.max(0, side.stamina - amount);
  side.staminaSpendFlash = 0.42;
  side.lastStaminaSpend = amount;
  if (item) applyInvulnOnStaminaSpend(state, item, side, team, amount);
  if (typeof queueStaminaSpendFeedback === "function") {
    queueStaminaSpendFeedback(state, team, amount, item);
  }
}

function tryItemActivationWithoutStamina(state, item, self, team, staminaCost) {
  const def = ITEM_CATALOG[item.itemId];
  item.currentCooldown = STAMINA_FAILED_RETRY_CD;
  if (typeof queueItemFailedAnimation === "function") {
    queueItemFailedAnimation(state, item, team, staminaCost);
  }
  pushBattleLog(state, {
    actor: team,
    type: "miss",
    source: def?.name,
    message: `${battleTeamLabel(team)} · ${def?.icon || "⚔"} ${def?.name || "Предмет"}: неудачно (нет выносливости)`,
  });
}

function countBattleStartItems(items = []) {
  return items.filter((item) => isBattleStartItem(item.itemId)).length;
}

function isBattleStartItem(itemId) {
  const def = ITEM_CATALOG[itemId];
  if (!def) return false;
  if ((def.effects || []).some((e) => e.phase === "battle_start")) return true;
  if ((def.metaEffects || []).some((e) => e.phase === "battle_start")) return true;
  if ((def.effects || []).some((e) => (
    e.trigger === "passive"
    && ["passiveMaxHp", "passiveLuck", "groundFire"].includes(e.type)
  ))) return true;
  return false;
}

function rollEffectChance(side, chance) {
  const base = Number(chance) || 0;
  if (base <= 0) return true;
  const bonus = side?.procChanceBonus || 0;
  return Math.random() < Math.min(0.95, base + bonus);
}

function tryActivateBattleRage(side, state, team, sourceLabel) {
  if (side.battleRageUsed || side.maxHp <= 0) return;
  if (side.hp / side.maxHp >= 0.5) return;
  const rageEffect = side.items
    .map((item) => ITEM_CATALOG[item.itemId]?.effects || [])
    .flat()
    .find((e) => e.type === "battleRageLowHp");
  if (!rageEffect) return;
  side.battleRageUsed = true;
  side.battleRageTimer = Number(rageEffect.duration) || 5;
  side.battleRageDamageReduction = Number(rageEffect.damageReduction) || 0.2;
  const cdBoost = Number(rageEffect.cooldownBoost) || 0.25;
  side.battleRageCooldownFactor = 1 - cdBoost;
  side.cooldownMult *= side.battleRageCooldownFactor;
  if (rageEffect.gainBlock) {
    applyGainStackEffect(state, { stack: "block", value: Number(rageEffect.gainBlock) }, null, side, team);
  }
  finalizeSideCombatStats(side);
  pushBattleLog(state, {
    actor: team,
    type: "buff",
    source: sourceLabel || "Battle Rage",
    message: `${battleTeamLabel(team)}: Battle Rage на ${side.battleRageTimer}с`,
  });
}

function checkMutualHpThresholdEffects(state) {
  if (!state?.player || !state?.enemy) return;
  const sides = [
    { side: state.player, foe: state.enemy, team: "player" },
    { side: state.enemy, foe: state.player, team: "enemy" },
  ];
  sides.forEach(({ side, foe, team }) => {
    side.items.forEach((item) => {
      collectItemBattleEffects(item).forEach((effect) => {
        if (effect.type !== "mutualHpThreshold") return;
        const threshold = Number(effect.threshold) || 0.8;
        const pRatio = state.player.maxHp > 0 ? state.player.hp / state.player.maxHp : 1;
        const eRatio = state.enemy.maxHp > 0 ? state.enemy.hp / state.enemy.maxHp : 1;
        if (pRatio > threshold || eRatio > threshold) return;
        const key = getStackThresholdKey(item, effect);
        if (!side.mutualHpThresholdFired) side.mutualHpThresholdFired = new Set();
        if (effect.once !== false && side.mutualHpThresholdFired.has(key)) return;
        if (effect.once !== false) side.mutualHpThresholdFired.add(key);
        const rt = item.runtime || createRuntimeState(item);
        const def = ITEM_CATALOG[item.itemId];
        if (effect.gainStack) applyGainStackEffect(state, effect.gainStack, item, side, team);
        if (effect.heal) executeEffect(state, { type: "heal", value: effect.heal }, item, side, foe, rt, team);
        if (effect.damage && foe) {
          const savedLs = side.lifesteal;
          if (effect.lifesteal) side.lifesteal = Number(effect.lifesteal);
          executeEffect(state, {
            type: "damage",
            value: effect.damage,
            damageType: effect.damageType || "magic",
          }, item, side, foe, rt, team);
          side.lifesteal = savedLs;
        }
        if (state && def) {
          pushBattleLog(state, {
            actor: team,
            type: "buff",
            source: def.name,
            message: `${battleTeamLabel(team)} · ${def.name}: оба ниже ${Math.round(threshold * 100)}% HP`,
          });
        }
      });
    });
  });
}

function applyClassCombatBonus(side, classId) {
  const cls = getClassById(classId);
  if (!cls?.combatBonus) return;
  const b = cls.combatBonus;
  if (b.type === "maxHpMult") side.maxHp = Math.floor(side.maxHp * (1 + b.value));
  if (b.type === "attackSpeedMult") side.cooldownMult *= 1 - b.value;
  if (b.type === "magicDamageMult") side.magicDamageMult *= 1 + b.value;
  if (b.type === "foodInventory") {
    const foodCount = countFoodItemsInLoadout(side.items);
    const perFood = Number(b.maxHpPerFood) || 0;
    const bonusHp = foodCount * perFood;
    if (bonusHp > 0) {
      side.maxHp += bonusHp;
      side.classFoodBonusHp = bonusHp;
      side.classFoodCount = foodCount;
    }
  }
}

function countFoodItemsInLoadout(items = []) {
  return items.filter((item) => {
    const def = ITEM_CATALOG[item.itemId];
    return def && !def.isContainer && def.tags?.includes("food");
  }).length;
}

function applyPassiveItemEffects(side) {
  side.items.forEach((item) => {
    const effects = typeof getBattleEffectsForItem === "function"
      ? getBattleEffectsForItem(item)
      : (ITEM_CATALOG[item.itemId]?.effects || []);
    effects.forEach((effect) => {
      if (effect.trigger !== "passive" && effect.type.startsWith("passive")) {
        applyPassiveEffect(side, item, effect);
        return;
      }
      if (effect.trigger === "passive") applyPassiveEffect(side, item, effect);
    });
  });
}

function isBattleStartTrigger(effect) {
  return effect?.trigger === "battle_start" || effect?.phase === "battle_start";
}

function isOnHitTrigger(effect) {
  return effect?.trigger === "on_hit" || effect?.phase === "on_hit";
}

function isOnBlockTrigger(effect) {
  return effect?.trigger === "on_block" || effect?.phase === "on_block";
}

function applyWeaponStartDamageBonus(side, value) {
  const bonus = Math.max(0, Math.floor(Number(value) || 0));
  if (!bonus) return;
  side.items.forEach((weapon) => {
    const wDef = ITEM_CATALOG[weapon.itemId];
    if (!wDef?.tags?.includes("weapon")) return;
    weapon.runtime = weapon.runtime || createRuntimeState(weapon);
    weapon.runtime.damageBonus = (weapon.runtime.damageBonus || 0) + bonus;
  });
}

function applyGainStackEffect(state, effect, item, self, team) {
  const stack = effect.stack || "spikes";
  if (effect.chance != null && Math.random() > Number(effect.chance)) return 0;
  const added = typeof addSideStack === "function"
    ? addSideStack(self, stack, effect.value ?? 1, effect.cap)
    : 0;
  if (added <= 0) return 0;
  const def = ITEM_CATALOG[item.itemId];
  if (typeof syncStackResourceGain === "function") syncStackResourceGain(self, stack, added);
  else {
    if (stack === "block") self.block += added;
    if (stack === "luck") self.luck += added;
  }
  if (state && def && team) {
    const label = typeof formatStackAmount === "function"
      ? formatStackAmount(stack, added)
      : `+${added}`;
    pushBattleLog(state, {
      actor: team,
      type: "buff",
      source: def.name,
      message: `${battleTeamLabel(team)} · ${def.name}: ${label} (всего: ${typeof getSideStack === "function" ? getSideStack(self, stack) : added})`,
    });
    const icon = typeof getStackMeta === "function" ? getStackMeta(stack).icon : "📊";
    queueHitAnimation(state, item, team, `+${added}${icon}`, "#d29922");
  }
  if (state && team) checkStackThresholds(state, self, null, team, item);
  return added;
}

function applySpendStackEffect(state, effect, item, self, foe, rt, team) {
  const stack = effect.stack || "spikes";
  const cost = Math.max(1, Math.floor(Number(effect.value) || 1));
  const extra = effect.extraSpend;
  if (typeof spendSideStack !== "function") return false;
  if (!spendSideStack(self, stack, cost)) return false;
  if (extra && !spendSideStack(self, extra.stack || "heat", Number(extra.value) || 1)) {
    if (typeof addSideStack === "function") addSideStack(self, stack, cost);
    return false;
  }
  const def = ITEM_CATALOG[item.itemId];
  if (typeof syncStackResourceSpend === "function") syncStackResourceSpend(self, stack, cost);
  if (extra && typeof syncStackResourceSpend === "function") {
    syncStackResourceSpend(self, extra.stack || "heat", Number(extra.value) || 1);
  }
  if (effect.foePoison) {
    executeEffect(state, { type: "poison", value: effect.foePoison }, item, self, foe, rt, team);
    if (effect.duplicateChance && Math.random() < Number(effect.duplicateChance)) {
      executeEffect(state, { type: "poison", value: effect.foePoison }, item, self, foe, rt, team);
    }
  }
  if (effect.cleansePoisonSelf) {
    self.poisonStacks = Math.max(0, (self.poisonStacks || 0) - Number(effect.cleansePoisonSelf || 0));
  }
  if (effect.cleansePoisonFoe && foe) {
    foe.poisonStacks = Math.max(0, (foe.poisonStacks || 0) - Number(effect.cleansePoisonFoe || 0));
  }
  if (effect.heal) {
    executeEffect(state, { type: "heal", value: effect.heal }, item, self, foe, rt, team);
  }
  if (effect.gainStack) {
    const gs = typeof effect.gainStack === "object"
      ? effect.gainStack
      : { stack: effect.gainStack, value: effect.gainStackValue ?? 1 };
    applyGainStackEffect(state, gs, item, self, team);
  }
  if (effect.attackBuff) {
    rt.pendingAttackBuff = (rt.pendingAttackBuff || 0) + Number(effect.attackBuff || 0);
  }
  if (effect.permanentDamage) {
    rt.damageBonus = (rt.damageBonus || 0) + Number(effect.permanentDamage);
  }
  if (effect.guaranteedCrit && self) {
    self.guaranteedCritTimer = Math.max(self.guaranteedCritTimer || 0, Number(effect.guaranteedCrit) || 1.5);
  }
  if (state && def) {
    pushBattleLog(state, {
      actor: team,
      type: "buff",
      source: def.name,
      message: `${battleTeamLabel(team)} · ${def.name}: потрачено ${cost} ${typeof getStackLabel === "function" ? getStackLabel(stack, cost) : stack}`,
    });
  }
  return true;
}

function applyTagScaledStack(side, effect, item) {
  const tag = effect.tag || "armor";
  const count = countTaggedItemsOnSide(side, tag);
  const per = Number(effect.perTag ?? effect.value ?? 1);
  const total = Math.floor(per * count);
  if (total <= 0) return 0;
  return applyGainStackEffect(null, {
    stack: effect.stack || "block",
    value: total,
  }, item, side, null);
}

function applyConvertHpStart(side, effect, item) {
  const hpCost = Math.max(0, Math.floor(Number(effect.hpCost ?? effect.from) || 0));
  const stackGain = Math.max(0, Math.floor(Number(effect.stackGain ?? effect.toStacks) || 0));
  if (!hpCost || !stackGain) return;
  const pay = Math.min(hpCost, Math.max(0, side.hp - 1));
  side.hp -= pay;
  const scaled = Math.floor(stackGain * (pay / hpCost));
  if (scaled > 0) {
    applyGainStackEffect(null, {
      stack: effect.stack || "regen",
      value: scaled,
    }, item, side, null);
  }
}

function applyTimedDamageReductionStart(side, effect) {
  const duration = Number(effect.duration) || 3;
  const value = Number(effect.value) || 0.25;
  side.timedBuffs.push({
    stat: "damageTaken",
    value: -value,
    remaining: duration,
  });
}

function applyCooldownStartMult(side, effect) {
  const bonus = Number(effect.value) || 0;
  if (bonus <= 0) return;
  side.cooldownMult *= Math.max(0.2, 1 - bonus);
  finalizeSideCombatStats(side);
}

function checkStackThresholds(state, self, foe, team, sourceItem = null) {
  if (!self?.items) return;
  self.items.forEach((item) => {
    if (sourceItem && item.uid !== sourceItem.uid) return;
    collectItemBattleEffects(item).forEach((effect) => {
      if (effect.type !== "stackThreshold") return;
      const watchSide = effect.targetSide === "foe" ? foe : self;
      if (!watchSide) return;
      const stack = effect.stack || "heat";
      const threshold = Number(effect.threshold) || 0;
      if (getSideStack(watchSide, stack) < threshold) return;
      const key = getStackThresholdKey(item, effect);
      if (!self.firedThresholds) self.firedThresholds = new Set();
      if (effect.once !== false && self.firedThresholds.has(key)) return;
      if (effect.once !== false) self.firedThresholds.add(key);
      const def = ITEM_CATALOG[item.itemId];
      const rt = item.runtime || createRuntimeState(item);
      if (effect.weaponDamage) {
        applyWeaponStartDamageBonus(self, effect.weaponDamage);
      }
      if (effect.itemDamage && item.uid) {
        rt.damageBonus = (rt.damageBonus || 0) + Number(effect.itemDamage);
      }
      if (effect.heal) {
        executeEffect(state, { type: "heal", value: effect.heal }, item, self, foe, rt, team);
      }
      if (effect.damage) {
        const hpDmg = applyDamage(
          effect.targetSide === "foe" ? foe : self,
          effect.damage,
          state,
          def?.name || "Порог",
          team,
          self,
          { damageType: effect.damageType || "physical" },
          item,
          { noRetaliation: true },
        );
        if (effect.lifesteal && hpDmg > 0) {
          self.hp = Math.min(self.maxHp, self.hp + hpDmg);
        }
      }
      if (effect.critChance) {
        self.critChance = Math.min(MAX_CRIT_CHANCE, (self.critChance || 0) + Number(effect.critChance));
      }
      if (effect.convertHp) {
        const hpCost = Math.min(Number(effect.convertHp.hpCost) || 15, Math.max(0, self.hp - 1));
        if (hpCost > 0) {
          self.hp -= hpCost;
          applyGainStackEffect(state, {
            stack: effect.convertHp.stack || "regen",
            value: effect.convertHp.stackGain || 30,
          }, item, self, team);
        }
      }
      if (effect.maxHp) {
        self.maxHp += Number(effect.maxHp);
        self.hp = Math.min(self.maxHp, self.hp + Number(effect.maxHp));
      }
      if (effect.spendStack) applySpendStackEffect(state, effect.spendStack, item, self, foe, rt, team);
      if (effect.cleanseDebuffs && typeof cleanseSideDebuffs === "function") {
        cleanseSideDebuffs(self, effect.cleanseDebuffs);
      }
      if (state && def) {
        pushBattleLog(state, {
          actor: team,
          type: "buff",
          source: def.name,
          message: `${battleTeamLabel(team)} · ${def.name}: порог ${threshold} ${typeof getStackLabel === "function" ? getStackLabel(stack, threshold) : stack}`,
        });
      }
    });
  });
}

function tickRegenStacks(state, dt) {
  [state.player, state.enemy].forEach((side, idx) => {
    const team = idx === 0 ? "player" : "enemy";
    side.regenTimer = (side.regenTimer || 0) + dt;
    if (side.regenTimer < 1) return;
    side.regenTimer -= 1;
    const regen = getSideStack(side, "regen");
    if (regen <= 0) return;
    const before = side.hp;
    side.hp = Math.min(side.maxHp, side.hp + regen);
    const healed = side.hp - before;
    if (healed > 0 && state) {
      pushBattleLog(state, {
        actor: team,
        type: "heal",
        message: `${battleTeamLabel(team)}: реген +${healed} HP (×${regen})`,
      });
    }
  });
}

function tickPeriodicItemEffects(state, dt) {
  const sides = [
    { self: state.player, foe: state.enemy, team: "player" },
    { self: state.enemy, foe: state.player, team: "enemy" },
  ];
  sides.forEach(({ self, foe, team }) => {
    self.items.forEach((item) => {
      const effects = collectItemBattleEffects(item);
      effects.forEach((effect) => {
        if (effect.type !== "periodic") return;
        const interval = Math.max(0.5, Number(effect.interval) || 3);
        if (!item.periodicTimers) item.periodicTimers = {};
        const timerKey = String(effect.interval);
        item.periodicTimers[timerKey] = (item.periodicTimers[timerKey] || 0) + dt;
        if (item.periodicTimers[timerKey] < interval) return;
        const rt = item.runtime || createRuntimeState(item);
        if (rt.activationsLeft != null && rt.activationsLeft <= 0) return;
        item.periodicTimers[timerKey] -= interval;
        if (effect.randomPick?.length) {
          const pick = effect.randomPick[Math.floor(Math.random() * effect.randomPick.length)];
          if (pick.heal) executeEffect(state, { type: "heal", value: pick.heal }, item, self, foe, rt, team);
          if (pick.gainStack) applyGainStackEffect(state, pick.gainStack, item, self, team);
          if (pick.foePoison && foe) executeEffect(state, { type: "poison", value: pick.foePoison }, item, self, foe, rt, team);
          return;
        }
        if (effect.gainStack) {
          if (effect.chance == null || rollEffectChance(self, effect.chance)) {
            applyGainStackEffect(state, effect.gainStack, item, self, team);
          }
        }
        if (effect.spendStack) {
          const spent = applySpendStackEffect(state, effect.spendStack, item, self, foe, rt, team);
          if (spent && effect.gainDominantStack) {
            const stacks = ["spikes", "block", "empower", "regen", "luck", "heat", "mana"];
            let maxType = stacks[0];
            let maxVal = getSideStack(self, maxType);
            stacks.forEach((t) => {
              const v = getSideStack(self, t);
              if (v > maxVal) {
                maxVal = v;
                maxType = t;
              }
            });
            applyGainStackEffect(state, {
              stack: maxType,
              value: Number(effect.gainDominantStack) || 3,
            }, item, self, team);
          }
        } else if (effect.gainDominantStack) {
          const stacks = ["spikes", "block", "empower", "regen", "luck", "heat", "mana"];
          let maxType = stacks[0];
          let maxVal = getSideStack(self, maxType);
          stacks.forEach((t) => {
            const v = getSideStack(self, t);
            if (v > maxVal) {
              maxVal = v;
              maxType = t;
            }
          });
          applyGainStackEffect(state, {
            stack: maxType,
            value: Number(effect.gainDominantStack) || 3,
          }, item, self, team);
        }
        if (effect.cleansePoisonSelf) {
          self.poisonStacks = Math.max(0, (self.poisonStacks || 0) - Number(effect.cleansePoisonSelf));
        }
        if (effect.cleansePoisonFoe && foe) {
          foe.poisonStacks = Math.max(0, (foe.poisonStacks || 0) - Number(effect.cleansePoisonFoe));
        }
        if (effect.cleanseDebuffs) {
          if (rollEffectChance(self, effect.cleanseChance ?? 1)) {
            cleanseSideDebuffs(self, effect.cleanseDebuffs);
          }
        }
        if (effect.heal) {
          executeEffect(state, { type: "heal", value: effect.heal }, item, self, foe, rt, team);
        }
        if (effect.foePoison && foe) {
          executeEffect(state, { type: "poison", value: effect.foePoison }, item, self, foe, rt, team);
        }
        if (effect.gainHeart) {
          self.hearts = (self.hearts || 0) + Number(effect.gainHeart || 1);
          const def = ITEM_CATALOG[item.itemId];
          if (state && def) {
            pushBattleLog(state, {
              actor: team,
              type: "buff",
              source: def.name,
              message: `${battleTeamLabel(team)} · ${def.name}: +${effect.gainHeart || 1} ❤ (всего: ${self.hearts})`,
            });
          }
          checkHeartThresholdEffects(state, self, foe, team);
        }
        if (effect.restoreStamina) {
          self.stamina = Math.min(self.maxStamina, self.stamina + Number(effect.restoreStamina || 0));
        }
        if (effect.gainWeakestStack && typeof applyGainWeakestStack === "function") {
          applyGainWeakestStack(state, self, item, team, effect.gainWeakestStack === true ? {} : effect.gainWeakestStack);
        }
        if (effect.stealWeaponDamage && foe && typeof stealFoeWeaponDamage === "function") {
          const stolen = stealFoeWeaponDamage(foe, effect.stealWeaponDamage);
          if (stolen > 0) {
            rt.damageBonus = (rt.damageBonus || 0) + stolen;
          }
        }
        if (effect.damage && foe) {
          let dmg = Number(effect.damage) || 0;
          if (effect.damagePerStackBonus) {
            dmg += getSideStack(self, effect.damagePerStackBonus.stack || "spikes")
              * (Number(effect.damagePerStackBonus.value) || 1);
          }
          if (dmg > 0) {
            applyDamage(
              foe,
              scalePacedValue(dmg, DAMAGE_PACING_SCALE),
              state,
              ITEM_CATALOG[item.itemId]?.name || "Периодика",
              team,
              self,
              { damageType: effect.damageType || "physical" },
              item,
              { noRetaliation: true },
            );
          }
        }
        if (effect.weaponDamageBonus) {
          applyWeaponStartDamageBonus(self, effect.weaponDamageBonus);
        }
        if (effect.maxHp) {
          self.maxHp += Number(effect.maxHp);
          self.hp = Math.min(self.maxHp, self.hp + Number(effect.maxHp));
        }
        if (effect.randomTimedBuff) {
          const stats = ["damage", "heal"];
          const stat = stats[Math.floor(Math.random() * stats.length)];
          self.timedBuffs.push({ stat, value: 0.1, remaining: 4 });
        }
        if (effect.cooldownBoost) {
          self.cooldownMult *= 1 - Number(effect.cooldownBoost);
          finalizeSideCombatStats(self);
        }
        if (effect.convertHp) {
          const hpCost = Math.min(Number(effect.convertHp.hpCost) || 10, Math.max(0, self.hp - 1));
          if (hpCost > 0) {
            self.hp -= hpCost;
            applyGainStackEffect(state, {
              stack: effect.convertHp.stack || "regen",
              value: effect.convertHp.stackGain || 20,
            }, item, self, team);
          }
        }
        checkStackThresholds(state, self, foe, team, item);
        if (effect.consumesUse && rt.activationsLeft != null) {
          rt.activationsLeft = Math.max(0, rt.activationsLeft - 1);
        }
      });
    });
  });
}

function applyHpLossRatioStart(side, ratio) {
  const r = Math.max(0, Math.min(1, Number(ratio) || 0));
  if (r <= 0) return;
  side.hp = Math.max(1, Math.floor(side.maxHp * (1 - r)));
}

function checkHpThresholdEffects(state, side, foe, team) {
  if (!side?.items) return;
  side.items.forEach((item) => {
    collectItemBattleEffects(item).forEach((effect) => {
      if (effect.type !== "hpThreshold") return;
      const key = getStackThresholdKey(item, effect);
      if (!side.hpThresholdFired) side.hpThresholdFired = new Set();
      if (effect.once !== false && side.hpThresholdFired.has(key)) return;
      const hpRatio = side.maxHp > 0 ? side.hp / side.maxHp : 1;
      const threshold = Number(effect.threshold) || 0.7;
      const below = effect.direction !== "above";
      if (below && hpRatio > threshold) return;
      if (!below && hpRatio < threshold) return;
      if (effect.once !== false) side.hpThresholdFired.add(key);
      const rt = item.runtime || createRuntimeState(item);
      const def = ITEM_CATALOG[item.itemId];
      if (effect.cleanseDebuffs) cleanseSideDebuffs(side, effect.cleanseDebuffs);
      if (effect.gainStack) applyGainStackEffect(state, effect.gainStack, item, side, team);
      if (effect.heal) executeEffect(state, { type: "heal", value: effect.heal }, item, side, foe, rt, team);
      if (effect.dodgeReady) side.dodgeReady = true;
      if (effect.maxHp) {
        side.maxHp += Number(effect.maxHp);
        side.hp = Math.min(side.maxHp, side.hp + Number(effect.maxHp));
      }
      if (effect.gainBlock) applyGainStackEffect(state, { stack: "block", value: effect.gainBlock }, item, side, team);
      if (effect.timedDamageReduction) {
        side.timedBuffs.push({
          stat: effect.timedDamageReduction.stat || "damageTaken",
          value: -(Number(effect.timedDamageReduction.value) || 0.35),
          remaining: Number(effect.timedDamageReduction.duration) || 7,
        });
      }
      if (state && def) {
        pushBattleLog(state, {
          actor: team,
          type: "buff",
          source: def.name,
          message: `${battleTeamLabel(team)} · ${def.name}: порог HP ${Math.round(threshold * 100)}%`,
        });
      }
    });
  });
}

function checkFoeHealTriggers(state, healedSide, healedTeam, healAmount) {
  if (!state || healAmount <= 0) return;
  const foeTeam = healedTeam === "player" ? "enemy" : "player";
  const foeSide = foeTeam === "player" ? state.player : state.enemy;
  const healedFoe = healedTeam === "player" ? state.enemy : state.player;
  foeSide.items.forEach((item) => {
    collectItemBattleEffects(item).forEach((effect) => {
      if (effect.type !== "onFoeHeal") return;
      const rt = item.runtime || createRuntimeState(item);
      const def = ITEM_CATALOG[item.itemId];
      if (effect.foePoison && healedFoe) {
        executeEffect(state, { type: "poison", value: effect.foePoison }, item, foeSide, healedFoe, rt, foeTeam);
      }
      if (effect.selfPoison) {
        executeEffect(state, { type: "poison", value: effect.selfPoison }, item, foeSide, healedFoe, rt, foeTeam);
      }
      if (state && def) {
        pushBattleLog(state, {
          actor: foeTeam,
          type: "poison",
          source: def.name,
          message: `${battleTeamLabel(foeTeam)} · ${def.name}: ответ на лечение противника`,
        });
      }
    });
  });
}

function applyOnReviveItemEffects(state, side, foe, team) {
  if (!side?.items) return;
  side.items.forEach((item) => {
    collectItemBattleEffects(item).forEach((effect) => {
      if (effect.type !== "onRevive") return;
      const rt = item.runtime || createRuntimeState(item);
      const def = ITEM_CATALOG[item.itemId];
      if (effect.damagePerTag && foe) {
        const count = countTaggedItemsOnSide(side, effect.damagePerTag.tag || "fire");
        const per = Number(effect.damagePerTag.value) || 5;
        const dmg = count * per;
        if (dmg > 0) {
          applyDamage(
            foe,
            dmg,
            state,
            def?.name || "Перерождение",
            team,
            side,
            { damageType: effect.damagePerTag.damageType || "magic" },
            item,
            { noRetaliation: true },
          );
        }
      }
      if (effect.foePoison && foe) {
        executeEffect(state, { type: "poison", value: effect.foePoison }, item, side, foe, rt, team);
      }
      if (effect.cleanseDebuffsFoe && foe) {
        cleanseSideDebuffs(foe, effect.cleanseDebuffsFoe);
      }
    });
  });
}

function processOnMissItemEffects(state, item, self, foe, team) {
  const rt = item.runtime || createRuntimeState(item);
  collectItemBattleEffects(item).forEach((effect) => {
    if (effect.trigger !== "on_miss" && effect.phase !== "on_miss") return;
    if (effect.type === "gainStack") applyGainStackEffect(state, effect, item, self, team);
    if (effect.attackBuff) rt.pendingAttackBuff = (rt.pendingAttackBuff || 0) + Number(effect.attackBuff);
    if (effect.type === "poison" && rollEffectChance(self, effect.chance ?? 1)) {
      executeEffect(state, effect, item, self, foe, rt, team);
    }
  });
}

function processOnBlockItemEffects(state, item, self, team) {
  collectItemBattleEffects(item).forEach((effect) => {
    if (!isOnBlockTrigger(effect)) return;
    if (effect.type === "gainStack" && rollEffectChance(self, effect.chance ?? 1)) {
      applyGainStackEffect(state, effect, item, self, team);
    }
  });
}

function checkActivationThresholdEffects(state, side, foe, team) {
  side.items.forEach((item) => {
    collectItemBattleEffects(item).forEach((effect) => {
      if (effect.type !== "activationThreshold") return;
      const need = Number(effect.count) || 6;
      if ((side.sideActivationTotal || 0) < need) return;
      const key = getStackThresholdKey(item, effect);
      if (!side.firedThresholds) side.firedThresholds = new Set();
      if (effect.once !== false && side.firedThresholds.has(key)) return;
      if (effect.once !== false) side.firedThresholds.add(key);
      const rt = item.runtime || createRuntimeState(item);
      const def = ITEM_CATALOG[item.itemId];
      if (effect.heal) executeEffect(state, { type: "heal", value: effect.heal }, item, side, foe, rt, team);
      if (effect.gainStack) applyGainStackEffect(state, effect.gainStack, item, side, team);
      if (effect.spendStack) applySpendStackEffect(state, effect.spendStack, item, side, foe, rt, team);
      if (effect.restoreStamina) {
        side.stamina = Math.min(side.maxStamina, side.stamina + Number(effect.restoreStamina || 0));
      }
      if (effect.maxHp) {
        side.maxHp += Number(effect.maxHp);
        side.hp = Math.min(side.maxHp, side.hp + Number(effect.maxHp));
      }
      if (effect.weaponDamageStart) applyWeaponStartDamageBonus(side, effect.weaponDamageStart);
      if (effect.foePoison && foe) {
        executeEffect(state, { type: "poison", value: effect.foePoison }, item, side, foe, rt, team);
      }
      if (effect.repeat !== false && effect.once === false) {
        side.sideActivationTotal = 0;
      }
      if (state && def) {
        pushBattleLog(state, {
          actor: team,
          type: "buff",
          source: def.name,
          message: `${battleTeamLabel(team)} · ${def.name}: после ${need} активаций`,
        });
      }
    });
  });
}

function tryZeroStaminaItemEffects(state, side, team) {
  if (side.zeroStaminaTriggered || side.stamina > 0) return;
  side.zeroStaminaTriggered = true;
  side.items.forEach((item) => {
    collectItemBattleEffects(item).forEach((effect) => {
      if (effect.type !== "zeroStamina") return;
      side.stamina = Math.min(side.maxStamina, side.stamina + (Number(effect.restoreStamina) || 2));
      if (effect.gainStack) applyGainStackEffect(state, effect.gainStack, item, side, team);
      const def = ITEM_CATALOG[item.itemId];
      if (state && def) {
        pushBattleLog(state, {
          actor: team,
          type: "buff",
          source: def.name,
          message: `${battleTeamLabel(team)} · ${def.name}: восстановление выносливости`,
        });
      }
    });
  });
}

function applyInvulnOnStaminaSpend(state, item, side, team, staminaCost) {
  collectItemBattleEffects(item).forEach((effect) => {
    if (effect.type !== "invulnOnStaminaSpend") return;
    const need = Number(effect.staminaCost) || 10;
    if (staminaCost < need) return;
    grantSideInvulnerability(side, effect.duration || 2);
    if (effect.gainStack) applyGainStackEffect(state, effect.gainStack, item, side, team);
    const def = ITEM_CATALOG[item.itemId];
    if (state && def) {
      pushBattleLog(state, {
        actor: team,
        type: "buff",
        source: def.name,
        message: `${battleTeamLabel(team)} · ${def.name}: неуязвимость ${effect.duration || 2}с`,
      });
    }
  });
}

function applyBattleStartItemEffects(side) {
  side.firedThresholds = new Set();
  side.hpThresholdFired = new Set();
  side.regenTimer = 0;
  side.items.forEach((item) => {
    item.periodicTimers = {};
    const effects = collectItemBattleEffects(item);
    effects.forEach((effect) => {
      if (!isBattleStartTrigger(effect)) return;
      if (effect.type === "gainStack") applyGainStackEffect(null, effect, item, side, null);
      if (effect.type === "weaponDamageStart") applyWeaponStartDamageBonus(side, effect.value);
      if (effect.type === "tagScaledStack") applyTagScaledStack(side, effect, item);
      if (effect.type === "convertHp") applyConvertHpStart(side, effect, item);
      if (effect.type === "timedDamageReduction") applyTimedDamageReductionStart(side, effect);
      if (effect.type === "cooldownStartMult") applyCooldownStartMult(side, effect);
      if (effect.type === "hpLossRatio") applyHpLossRatioStart(side, effect.value);
      if (effect.type === "revive") setupRevive(side, effect.hpRatio, effect.invuln);
      if (effect.type === "tagScaledMaxHp") applyTagScaledMaxHp(side, effect);
    });
  });
  initItemActivationLimits(side);
}

function processOnDefendEffects(state, defender, attacker, defenderTeam, ctx) {
  if (!defender?.items) return;
  const ctxBlock = ctx?.blockAbs || 0;
  const ctxArmor = ctx?.armorAbs || 0;
  if (!ctx?.dodged && ctxBlock <= 0 && ctxArmor <= 0) return;
  defender.items.forEach((item) => {
    const effects = collectItemBattleEffects(item);
    effects.forEach((effect) => {
      if (effect.type !== "onDefend" && effect.trigger !== "on_defend") return;
      if (!rollEffectChance(defender, effect.chance ?? 1)) return;
      const rt = item.runtime || createRuntimeState(item);
      const def = ITEM_CATALOG[item.itemId];
      const attackerTeam = defenderTeam === "player" ? "enemy" : "player";
      if (effect.preventDamage && ctx?.hpDmg > 0) {
        const heal = Math.min(Number(effect.preventDamage), ctx.hpDmg);
        defender.hp = Math.min(defender.maxHp, defender.hp + heal);
        if (state && def) {
          pushBattleLog(state, {
            actor: defenderTeam,
            type: "heal",
            source: def.name,
            message: `${battleTeamLabel(defenderTeam)} · ${def.name}: −${heal} урона от блока`,
          });
        }
      }
      if (effect.drainStamina && attacker) {
        const drain = Number(effect.drainStamina) || 0;
        attacker.stamina = Math.max(0, attacker.stamina - drain);
        if (state && def && drain > 0) {
          pushBattleLog(state, {
            actor: defenderTeam,
            type: "debuff",
            source: def.name,
            message: `${battleTeamLabel(attackerTeam)}: −${drain} выносливости (${def.name})`,
          });
        }
      }
      if (effect.gainStack) {
        const gs = typeof effect.gainStack === "object"
          ? effect.gainStack
          : { stack: effect.gainStack, value: 1 };
        applyGainStackEffect(state, gs, item, defender, defenderTeam);
      }
      if (effect.foePoison && attacker) {
        executeEffect(state, { type: "poison", value: effect.foePoison }, item, defender, attacker, rt, defenderTeam);
      }
      if (effect.slow && attacker) {
        executeEffect(state, { type: "slow", value: effect.slow, duration: effect.duration || 3 }, item, defender, attacker, rt, defenderTeam);
      }
    });
  });
}

function trySpendToPreventMiss(state, attacker, team, target, sourceItem) {
  let prevented = false;
  attacker.items.forEach((item) => {
    if (prevented) return;
    collectItemBattleEffects(item).forEach((effect) => {
      if (effect.type !== "preventMiss" || prevented) return;
      const rt = item.runtime || createRuntimeState(item);
      const spendFx = effect.spendStack || effect;
      if (!applySpendStackEffect(state, spendFx, item, attacker, target, rt, team)) return;
      rt.pendingAttackBuff = (rt.pendingAttackBuff || 0) + Number(effect.attackBuff || spendFx.attackBuff || 5);
      prevented = true;
      const def = ITEM_CATALOG[item.itemId];
      if (state && def) {
        pushBattleLog(state, {
          actor: team,
          type: "attack",
          source: def.name,
          message: `${battleTeamLabel(team)} · ${def.name}: промах отменён`,
        });
      }
    });
  });
  return prevented;
}

function initItemActivationLimits(side) {
  side.items.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    const rt = item.runtime || createRuntimeState(item);
    collectItemBattleEffects(item).forEach((effect) => {
      if (effect.type !== "activationLimit") return;
      let max = Number(effect.base) || 3;
      if (effect.perTag && effect.tag && typeof countTaggedItemsOnSide === "function") {
        let count = countTaggedItemsOnSide(side, effect.tag);
        if (effect.excludeSelf && def?.tags?.includes(effect.tag)) count = Math.max(0, count - 1);
        max += count * (Number(effect.perTag) || 1);
      }
      rt.activationsLeft = max;
    });
  });
}

function processOnHitItemEffects(state, item, self, foe, team) {
  const def = ITEM_CATALOG[item.itemId];
  const rt = item.runtime || createRuntimeState(item);
  const effects = typeof getBattleEffectsForItem === "function"
    ? getBattleEffectsForItem(item)
    : (def?.effects || []);
  effects.forEach((effect) => {
    if (!isOnHitTrigger(effect)) return;
    if (effect.type === "gainStack") applyGainStackEffect(state, effect, item, self, team);
    if (effect.type === "spendStack") applySpendStackEffect(state, effect, item, self, foe, rt, team);
    if (effect.type === "applyStun") {
      if (rollEffectChance(self, effect.chance ?? 1)) {
        const stunned = applyStunToSide(foe, effect.duration || 0.5);
        if (stunned && effect.bonusDamageOnStun) {
          executeEffect(state, { type: "damage", value: effect.bonusDamageOnStun }, item, self, foe, rt, team);
        } else if (stunned) {
          const bonusFx = collectItemBattleEffects(item).find((e) => e.type === "bonusDamageOnStun");
          if (bonusFx) {
            executeEffect(state, { type: "damage", value: bonusFx.value || 1 }, item, self, foe, rt, team);
          }
        }
      }
    }
    if (effect.type === "cleanseDebuffs") {
      const count = Number(effect.value) || 1;
      cleanseSideDebuffs(self, count);
    }
    if (effect.type === "stealWeaponDamage") {
      const stolen = stealFoeWeaponDamage(foe, effect.value || 1);
      if (stolen > 0) {
        rt.damageBonus = (rt.damageBonus || 0) + stolen;
        pushBattleLog(state, {
          actor: team,
          type: "buff",
          source: ITEM_CATALOG[item.itemId]?.name,
          message: `${battleTeamLabel(team)} · ${ITEM_CATALOG[item.itemId]?.name}: украдено +${stolen} урона у оружия противника`,
        });
      }
    }
    if ((effect.type === "poison" || effect.type === "slow") && rollEffectChance(self, effect.chance ?? 1)) {
      executeEffect(state, effect, item, self, foe, rt, team);
    }
    if (effect.type === "onHitCapBonus") {
      const cap = Number(effect.cap) || 7;
      const bonus = Number(effect.value) || 1;
      rt.damageBonus = Math.min(cap, (rt.damageBonus || 0) + bonus);
    }
    if (effect.type === "breakBlockOnHit" && foe) {
      const breakAmt = Number(effect.value) || 4;
      foe.block = Math.max(0, (foe.block || 0) - breakAmt);
    }
    if (effect.type === "selfPoison" && rollEffectChance(self, effect.chance ?? 1)) {
      executeEffect(state, { type: "poison", value: effect.value || 1 }, item, self, self, rt, team);
    }
    if (effect.type === "hitCounter") {
      rt.hitCount = (rt.hitCount || 0) + 1;
      const need = Number(effect.threshold) || 4;
      if (rt.hitCount >= need) {
        rt.hitCount = 0;
        if (effect.gainStack) {
          const gs = typeof effect.gainStack === "object"
            ? effect.gainStack
            : { stack: effect.gainStack, value: 1 };
          applyGainStackEffect(state, gs, item, self, team);
        }
      }
    }
  });
  checkStackThresholds(state, self, foe, team, item);
}

function trySpikeRetaliation(state, target, targetTeam, attackerSide, attackerTeam, sourceItem, damageType, options = {}) {
  if (options.noRetaliation) return;
  if (typeof getSpikeRetaliationDamage !== "function" || typeof isMeleeDamageType !== "function") return;
  if (!isMeleeDamageType(damageType)) return;
  const spikes = getSpikeRetaliationDamage(target);
  if (spikes <= 0 || !attackerSide) return;
  attackerSide.hp = Math.max(0, attackerSide.hp - spikes);
  pushBattleLog(state, {
    actor: targetTeam,
    type: "damage",
    source: "Шипы",
    target: attackerTeam,
    message: `${battleTeamLabel(targetTeam)}: шипы → ${battleTeamLabel(attackerTeam)} −${spikes} HP`,
  });
  queueHitAnimation(state, sourceItem, targetTeam, `📌 −${spikes}`, "#d29922");
  triggerProfileAvatarHitShake(attackerTeam);
}

function applyPassiveEffect(side, item, effect) {
  switch (effect.type) {
    case "passiveMaxHp":
      side.maxHp += effect.value;
      break;
    case "passiveLuck":
      side.luck += effect.value;
      break;
    case "passiveDefense": {
      const dupEff = item.runtime?.duplicateEfficiency ?? 1;
      const added = Math.max(0, Math.floor(effect.value * dupEff));
      side.defense += added;
      break;
    }
    case "statMult":
      applyStatMult(side, effect.stat, effect.value);
      break;
    case "lifesteal":
      side.lifesteal += effect.value;
      break;
    case "shieldBlockMult":
      side.shieldBlockMult += effect.value;
      break;
    case "shieldBreakBonus":
      side.shieldBreakBonus += effect.value;
      break;
    case "crit":
      side.critChance += effect.chance || 0;
      if (effect.doublePoison) side.critDoublePoison = true;
      break;
    case "dodgePeriodic":
      side.dodgeInterval = effect.interval || 5;
      side.dodgeTimer = 0;
      side.dodgeReady = false;
      break;
    case "groundFire":
      break;
    case "repeatCast":
      if (effect.magicOnly) side.repeatMagic = true;
      else side.repeatAllAttacks = true;
      break;
    case "cooldownMultPerTag":
      applyTagCooldownMult(side, effect);
      break;
    case "passiveMaxStamina":
      side.maxStamina += Number(effect.value) || 1;
      side.stamina += Number(effect.value) || 1;
      break;
    case "lifestealPerTag": {
      const count = countTaggedItemsOnSide(side, effect.tag || "cold");
      side.lifesteal += count * (Number(effect.value) || 0.15);
      break;
    }
    case "battleRageLowHp":
      break;
    default:
      break;
  }
}

function applyStatMult(side, stat, value) {
  if (stat === "damage") side.damageMult *= 1 + value;
  if (stat === "magicDamage") side.magicDamageMult *= 1 + value;
  if (stat === "cooldown") side.cooldownMult *= 1 + value;
  finalizeSideCombatStats(side);
}

function getItemCooldownMult(item) {
  return clampCooldownMult(item.runtime?.cooldownMult ?? 1);
}

function createBattleState(playerItems, enemyItems, playerClassId = null, enemyClassId = null, battleRound = 1, prepMeta = {}) {
  const player = createBattleSide(playerItems, playerClassId, prepMeta.player || {});
  const enemy = createBattleSide(enemyItems, enemyClassId || pickRandomClassId(), prepMeta.enemy || {});
  const state = {
    player,
    enemy,
    battleRound: Math.max(1, battleRound || 1),
    fatigueAnnounced: false,
    log: [],
    finished: false,
    winner: null,
    elapsed: 0,
    visualElapsed: 0,
    floatingNumbers: [],
    itemDamageStats: {},
  };
  initBattleAnimations(state);
  if (typeof initBattleDamageTracker === "function") initBattleDamageTracker(state);
  state.replayFrames = [];
  state.lastRecordAt = 0;
  state.recording = false;
  return state;
}

function cloneBattleItem(item) {
  const def = ITEM_CATALOG[item.itemId];
  const baseCd = def.cooldown || 0;
  const hasActive = itemHasActivatableEffects(def);
  return {
    ...item,
    currentCooldown: hasActive
      ? baseCd * (BATTLE_CD_START_MIN_RATIO + Math.random() * BATTLE_CD_START_RANGE_RATIO)
      : 9999,
    runtime: item.runtime ? { ...item.runtime } : createRuntimeState(item),
  };
}

function getSideCooldownMult(side) {
  let mult = clampCooldownMult(side.cooldownMult);
  if (side.slowDebuff > 0) mult *= 1 + side.slowDebuff;
  if (side.tagCooldownMult && side.tagCooldownMult !== 1) mult *= side.tagCooldownMult;
  return mult;
}

function applyTagCooldownMult(side, effect) {
  const tags = Array.isArray(effect.tags) ? effect.tags : [effect.tag || "pet"];
  const perTag = Number(effect.perTag ?? effect.value ?? 0.15);
  let count = 0;
  tags.forEach((tag) => { count += countTaggedItemsOnSide(side, tag); });
  if (count <= 0) return;
  const factor = Math.max(0.35, 1 - perTag * count);
  side.tagCooldownMult = (side.tagCooldownMult || 1) * factor;
}

function applyTagScaledMaxHp(side, effect) {
  const count = countTaggedItemsOnSide(side, effect.tag || "pet");
  const bonus = Math.floor(count * (Number(effect.perTag ?? effect.value) || 40));
  if (bonus <= 0) return;
  side.maxHp += bonus;
  side.hp += bonus;
}

function getEffectiveCritChance(side, item, foe) {
  if ((side.guaranteedCritTimer || 0) > 0) return 1;
  let crit = side.critChance || 0;
  (side.items || []).forEach((it) => {
    collectItemBattleEffects(it).forEach((effect) => {
      if (effect.type === "critPerStack") {
        crit += getSideStack(side, effect.stack || "luck") * (Number(effect.value) || 0.05);
      }
      if (effect.type === "critPerFoeDebuff" && foe && typeof countSideDebuffs === "function") {
        crit += countSideDebuffs(foe) * (Number(effect.value) || 0.01);
      }
    });
  });
  return Math.min(MAX_CRIT_CHANCE, crit);
}

function checkHeartThresholdEffects(state, side, foe, team) {
  if (!side?.items) return;
  side.items.forEach((item) => {
    collectItemBattleEffects(item).forEach((effect) => {
      if (effect.type !== "heartThreshold") return;
      const need = Number(effect.count) || 7;
      if ((side.hearts || 0) < need) return;
      const key = getStackThresholdKey(item, effect);
      if (!side.heartThresholdFired) side.heartThresholdFired = new Set();
      if (effect.once !== false && side.heartThresholdFired.has(key)) return;
      if (effect.once !== false) side.heartThresholdFired.add(key);
      side.hearts -= need;
      const rt = item.runtime || createRuntimeState(item);
      const def = ITEM_CATALOG[item.itemId];
      if (effect.maxHp) {
        side.maxHp += Number(effect.maxHp);
        side.hp = Math.min(side.maxHp, side.hp + Number(effect.maxHp));
      }
      if (effect.gainStack) applyGainStackEffect(state, effect.gainStack, item, side, team);
      if (effect.heal) executeEffect(state, { type: "heal", value: effect.heal }, item, side, foe, rt, team);
      if (state && def) {
        pushBattleLog(state, {
          actor: team,
          type: "buff",
          source: def.name,
          message: `${battleTeamLabel(team)} · ${def.name}: потрачено ${need} ❤`,
        });
      }
    });
  });
}

function battleTick(state, dt) {
  if (state.finished) return;

  state.elapsed += dt;
  tickStatusEffects(state, dt);
  tickRegenStacks(state, dt);
  tickPeriodicItemEffects(state, dt);
  tickPoison(state, dt);
  tickGroundFire(state, dt);
  tickFatigue(state, dt);
  tickBattleAnimations(state, dt);
  if (typeof tickDamageFlights === "function") tickDamageFlights(state, dt);

  if (state.elapsed >= MAX_BATTLE_DURATION) {
    resolveBattleTimeout(state);
    return;
  }

  const sides = [
    { self: state.player, foe: state.enemy, team: "player" },
    { self: state.enemy, foe: state.player, team: "enemy" },
  ];

  sides.forEach(({ self, foe, team }) => {
    if (self.dodgeInterval > 0) {
      self.dodgeTimer += dt;
      if (self.dodgeTimer >= self.dodgeInterval) {
        self.dodgeTimer = 0;
        self.dodgeReady = true;
        pushBattleLog(state, {
          actor: team,
          type: "buff",
          message: `${battleTeamLabel(team)}: уклонение готово`,
        });
      }
    }

    self.stamina = Math.min(self.maxStamina, self.stamina + self.staminaRegen * dt);
    if (self.staminaSpendFlash > 0) {
      self.staminaSpendFlash = Math.max(0, self.staminaSpendFlash - dt);
    }

    tryZeroStaminaItemEffects(state, self, team);

    self.items.forEach((item) => {
      if (item.currentCooldown > 0 && item.currentCooldown < 9000) {
        item.currentCooldown = Math.max(0, item.currentCooldown - dt);
      }
    });

    if (isSideStunned(self)) return;

    const cdMult = getSideCooldownMult(self);
    const ready = self.items
      .filter((item) => item.currentCooldown <= 0 && item.currentCooldown < 9000)
      .sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col));

    let activations = 0;
    ready.forEach((item) => {
      if (activations >= MAX_ACTIVATIONS_PER_SIDE_PER_TICK) {
        item.currentCooldown = Math.min(item.currentCooldown, 0.35);
        return;
      }
      const def = ITEM_CATALOG[item.itemId];
      const staminaCost = getItemStaminaCost(def);
      if (staminaCost > 0 && self.stamina < staminaCost) {
        tryItemActivationWithoutStamina(state, item, self, team, staminaCost);
        return;
      }
      if (staminaCost > 0) {
        spendBattleStamina(state, self, team, staminaCost, item);
      }
      activateItem(state, item, self, foe, team);
      activations += 1;
      item.currentCooldown = (def.cooldown || 0) * cdMult * getItemCooldownMult(item);
    });
  });

  if (state.player.hp <= 0 || state.enemy.hp <= 0) {
    state.finished = true;
    state.winner = state.player.hp <= 0 && state.enemy.hp <= 0
      ? "draw"
      : state.player.hp <= 0 ? "enemy" : "player";
  }
}

function tickStatusEffects(state, dt) {
  checkMutualHpThresholdEffects(state);
  [state.player, state.enemy].forEach((side, idx) => {
    const team = idx === 0 ? "player" : "enemy";
    side.timedBuffs = side.timedBuffs.filter((b) => {
      b.remaining -= dt;
      return b.remaining > 0;
    });
    if (side.guaranteedCritTimer > 0) {
      side.guaranteedCritTimer = Math.max(0, side.guaranteedCritTimer - dt);
    }
    if (side.slowTimer > 0) {
      side.slowTimer -= dt;
      if (side.slowTimer <= 0) side.slowDebuff = 0;
    }
    if (side.stunTimer > 0) {
      side.stunTimer = Math.max(0, side.stunTimer - dt);
    }
    if (side.invulnerableTimer > 0) {
      side.invulnerableTimer = Math.max(0, side.invulnerableTimer - dt);
    }
    checkHpThresholdEffects(state, side, idx === 0 ? state.enemy : state.player, team);
    if (side.battleRageTimer > 0) {
      side.battleRageTimer -= dt;
      if (side.battleRageTimer <= 0) {
        if (side.battleRageCooldownFactor && side.battleRageCooldownFactor !== 1) {
          side.cooldownMult /= side.battleRageCooldownFactor;
          side.battleRageCooldownFactor = 1;
          finalizeSideCombatStats(side);
        }
        side.battleRageDamageReduction = 0;
      }
    }
    tryActivateBattleRage(side, state, team, "Battle Rage");
  });
}

function getTimedDamageMult(side) {
  let mult = side.damageMult;
  side.timedBuffs.forEach((b) => {
    if (b.stat === "damage") mult *= 1 + b.value;
  });
  return mult;
}

function isMagicDamageType(damageType) {
  return damageType === "magic" || damageType === "fire";
}

function classifyDamageCategory(damageType) {
  if (isMagicDamageType(damageType)) return "magic";
  if (damageType === null) return null;
  return "physical";
}

function creditDamageStats(side, stat, hpDmg, damageType) {
  if (hpDmg <= 0) return;
  side.totalDamageDealt += hpDmg;
  if (stat) stat.damageDealt += hpDmg;

  const category = classifyDamageCategory(damageType);
  if (category === "magic") {
    side.totalMagicDamageDealt += hpDmg;
    if (stat) stat.magicDamageDealt = (stat.magicDamageDealt || 0) + hpDmg;
  } else if (category === "physical") {
    side.totalPhysicalDamageDealt += hpDmg;
    if (stat) stat.physicalDamageDealt = (stat.physicalDamageDealt || 0) + hpDmg;
  }
}

function creditDotDamage(state, sourceTeam, sourceItemUid, dmg, damageType = null) {
  if (dmg <= 0 || !sourceTeam) return;
  const attacker = sourceTeam === "player" ? state.player : state.enemy;
  const stat = sourceItemUid ? state.itemDamageStats[sourceItemUid] : null;
  creditDamageStats(attacker, stat, dmg, damageType);
  if (sourceItemUid && typeof recordDotDamageDealt === "function") {
    const item = attacker.items?.find((i) => i.uid === sourceItemUid);
    if (item) {
      const dotKind = damageType === "fire" ? "fire" : "poison";
      recordDotDamageDealt(state, sourceTeam, item, dmg, dotKind);
    }
  }
}

function creditItemDamageBlocked(state, itemUid, team, amount) {
  const rounded = Math.round(amount);
  if (rounded <= 0 || !itemUid) return;
  const side = team === "player" ? state.player : state.enemy;
  const item = side.items.find((i) => i.uid === itemUid);
  if (!item) return;
  ensureItemStat(state, item, team);
  const stat = state.itemDamageStats[itemUid];
  stat.damageBlocked = (stat.damageBlocked || 0) + rounded;
  side.totalDamageBlocked = (side.totalDamageBlocked || 0) + rounded;
}

function getArmorDefenseItems(side) {
  return side.items.map((item) => {
    const def = ITEM_CATALOG[item.itemId];
    const passive = (def.effects || []).find((e) => e.type === "passiveDefense");
    if (!passive) return null;
    const dupEff = item.runtime?.duplicateEfficiency ?? 1;
    return { item, value: Math.max(0, Math.floor((passive.value || 0) * dupEff)) };
  }).filter(Boolean);
}

function creditBlockAbsorption(state, target, targetTeam, blockAbs) {
  const credits = new Map();
  if (blockAbs <= 0) return credits;

  target.blockLedger = target.blockLedger || [];
  let remaining = blockAbs;
  while (remaining > 0 && target.blockLedger.length > 0) {
    const entry = target.blockLedger[0];
    const take = Math.min(remaining, entry.amount);
    credits.set(entry.itemUid, (credits.get(entry.itemUid) || 0) + take);
    creditItemDamageBlocked(state, entry.itemUid, targetTeam, take);
    entry.amount -= take;
    remaining -= take;
    if (entry.amount <= 0) target.blockLedger.shift();
  }
  return credits;
}

function creditArmorAbsorption(state, target, targetTeam, armorAbs) {
  const credits = new Map();
  if (armorAbs <= 0) return credits;

  const armorItems = getArmorDefenseItems(target);
  const totalDefense = armorItems.reduce((sum, entry) => sum + entry.value, 0);
  if (totalDefense <= 0) return credits;

  let assigned = 0;
  armorItems.forEach(({ item, value }, index) => {
    const share = index === armorItems.length - 1
      ? armorAbs - assigned
      : Math.round((value / totalDefense) * armorAbs);
    const amount = Math.max(0, Math.min(share, armorAbs - assigned));
    assigned += amount;
    if (amount <= 0) return;
    credits.set(item.uid, (credits.get(item.uid) || 0) + amount);
    creditItemDamageBlocked(state, item.uid, targetTeam, amount);
  });
  return credits;
}

function logDefenseAbsorption(state, targetTeam, blockCredits, armorCredits) {
  const parts = [];
  blockCredits.forEach((amount, uid) => {
    const stat = state.itemDamageStats[uid];
    if (stat && amount > 0) parts.push(`${stat.name}: блок −${Math.round(amount)}`);
  });
  armorCredits.forEach((amount, uid) => {
    const stat = state.itemDamageStats[uid];
    if (stat && amount > 0) parts.push(`${stat.name}: броня −${Math.round(amount)}`);
  });
  if (!parts.length) return;

  pushBattleLog(state, {
    actor: targetTeam,
    type: "defense",
    message: `🛡 ${battleTeamLabel(targetTeam)} · ${parts.join(" · ")}`,
  });
}

function tickPoison(state, dt) {
  [
    { side: state.player, team: "player" },
    { side: state.enemy, team: "enemy" },
  ].forEach(({ side, team }) => {
    if (side.poisonStacks <= 0) return;
    side.poisonTimer += dt;
    while (side.poisonTimer >= 1) {
      side.poisonTimer -= 1;
      const dmg = getPoisonDotDamage(side.poisonStacks);
      side.hp = Math.max(0, side.hp - dmg);
      const sourceTeam = side.poisonSourceTeam || (team === "player" ? "enemy" : "player");
      creditDotDamage(state, sourceTeam, side.poisonSourceItemUid, dmg, null);
      pushBattleLog(state, {
        actor: sourceTeam,
        type: "poison",
        target: team,
        message: `${battleTeamLabel(team)}: яд −${dmg} HP (стаков: ${side.poisonStacks}, ${getPoisonDotDamage(side.poisonStacks)}/с)`,
      });
      triggerProfileAvatarHitShake(team);
    }
  });
}

function tickGroundFire(state, dt) {
  [
    { side: state.player, team: "player" },
    { side: state.enemy, team: "enemy" },
  ].forEach(({ side, team }) => {
    if (side.groundFire <= 0) return;
    side.groundFireTimer += dt;
    while (side.groundFireTimer >= 1) {
      side.groundFireTimer -= 1;
      const dmg = side.groundFire;
      side.hp = Math.max(0, side.hp - dmg);
      const fireSourceTeam = side.groundFireSourceTeam || (team === "player" ? "enemy" : "player");
      creditDotDamage(state, fireSourceTeam, side.groundFireSourceItemUid, dmg, "fire");
      pushBattleLog(state, {
        actor: fireSourceTeam,
        type: "fire",
        target: team,
        message: `${battleTeamLabel(team)}: огонь на поле −${dmg} HP`,
      });
      triggerProfileAvatarHitShake(team);
    }
  });
}

function tickFatigue(state, dt) {
  if (!isFatigueActive(state)) return;

  if (!state.fatigueAnnounced) {
    state.fatigueAnnounced = true;
    const pct = Math.round((getFatigueDamageTakenMult(state) - 1) * 100);
    pushBattleLog(state, {
      actor: "system",
      type: "info",
      message: `⏳ Усталость арены (раунд ${state.battleRound}): входящий урон +${pct}%`,
    });
  }

  const activeSec = getFatigueSecondsActive(state);
  if (activeSec < FATIGUE_HP_DRAIN_DELAY_AFTER_START) return;

  [
    { side: state.player, team: "player" },
    { side: state.enemy, team: "enemy" },
  ].forEach(({ side, team }) => {
    side.fatigueDrainTimer = (side.fatigueDrainTimer || 0) + dt;
    while (side.fatigueDrainTimer >= 1) {
      side.fatigueDrainTimer -= 1;
      if (side.hp <= 0) break;
      side.hp = Math.max(0, side.hp - FATIGUE_HP_DRAIN_PER_SEC);
      pushBattleLog(state, {
        actor: team,
        type: "debuff",
        target: team,
        message: `${battleTeamLabel(team)}: усталость −${FATIGUE_HP_DRAIN_PER_SEC} HP`,
      });
      triggerProfileAvatarHitShake(team);
    }
  });
}

function triggerOnActivateListeners(state, sourceItem, self, foe, team) {
  if (!self?.items || !sourceItem) return;
  const sourceDef = ITEM_CATALOG[sourceItem.itemId];
  if (!itemHasActivatableEffects(sourceDef)) return;

  self.items.forEach((listenerItem) => {
    const listenerDef = ITEM_CATALOG[listenerItem.itemId];
    const effects = typeof getBattleEffectsForItem === "function"
      ? getBattleEffectsForItem(listenerItem)
      : (listenerDef?.effects || []);
    const rt = listenerItem.runtime || createRuntimeState(listenerItem);
    effects.forEach((effect) => {
      if (effect.type !== "onActivate") return;
      if (effect.chance != null && !rollEffectChance(self, effect.chance)) return;
      if (effect.gainStack) applyGainStackEffect(state, effect.gainStack, listenerItem, self, team);
      if (effect.heal) executeEffect(state, { type: "heal", value: effect.heal }, listenerItem, self, foe, rt, team);
    });
  });
}

function activateItem(state, item, self, foe, team) {
  const def = ITEM_CATALOG[item.itemId];
  const rt = item.runtime || createRuntimeState(item);
  if (rt.activationsLeft != null && rt.activationsLeft <= 0) return;
  ensureItemStat(state, item, team);
  state.itemDamageStats[item.uid].activations++;
  self.sideActivationTotal = (self.sideActivationTotal || 0) + 1;
  checkActivationThresholdEffects(state, self, foe, team);
  queueItemActivationPulse(state, item, team);

  const allEffects = typeof getBattleEffectsForItem === "function"
    ? getBattleEffectsForItem(item)
    : (def.effects || []);
  allEffects.forEach((effect) => {
    if (effect.type !== "spendStack") return;
    const tr = effect.trigger || effect.phase;
    if (tr === "on_hit" || tr === "on_block" || tr === "battle_start" || tr === "passive" || tr === "on_miss") return;
    applySpendStackEffect(state, effect, item, self, foe, rt, team);
  });
  const activeEffects = allEffects.filter((e) => {
    const tr = e.trigger || e.phase;
    return tr !== "passive" && tr !== "on_hit" && tr !== "on_block" && tr !== "battle_start";
  });
  const magicEffects = activeEffects.filter((e) => e.damageType === "magic" || def.tags.includes("magic"));

  activeEffects.forEach((effect) => {
    if (effect.type === "groundFire" || effect.type === "dodgePeriodic" || effect.type === "repeatCast"
      || effect.type === "crit" || effect.type === "shieldBreakBonus"
      || effect.type === "gainStack" || effect.type === "spendStack"
      || effect.type === "damagePerStack" || effect.type === "weaponDamageStart"
      || effect.type === "stackThreshold" || effect.type === "periodic"
      || effect.type === "tagScaledStack" || effect.type === "convertHp"
      || effect.type === "timedDamageReduction" || effect.type === "cooldownStartMult"
      || effect.type === "applyStun" || effect.type === "bonusDamageOnStun"
      || effect.type === "cleanseDebuffs" || effect.type === "stealWeaponDamage"
      || effect.type === "damagePerFoeDebuff" || effect.type === "damagePerTag"
      || effect.type === "hpThreshold" || effect.type === "activationThreshold"
      || effect.type === "zeroStamina" || effect.type === "invulnOnStaminaSpend"
      || effect.type === "hpLossRatio" || effect.type === "revive"
      || effect.type === "extraAttackOnStun" || effect.type === "critPerStack"
      || effect.type === "cooldownMultPerTag" || effect.type === "heartThreshold"
      || effect.type === "tagScaledMaxHp" || effect.type === "passiveMaxStamina"
      || effect.type === "onRevive" || effect.type === "onFoeHeal" || effect.type === "critPerFoeDebuff"
      || effect.type === "lifestealPerTag" || effect.type === "healPerTag"
      || effect.type === "onDefend" || effect.type === "activationLimit" || effect.type === "preventMiss"
      || effect.type === "onActivate") return;
    executeEffect(state, effect, item, self, foe, rt, team);
  });

  if (self.repeatAllAttacks) {
    const damageEffects = activeEffects.filter((e) => e.type === "damage");
    if (damageEffects.length > 0) {
      pushBattleLog(state, {
        actor: team,
        type: "attack",
        source: def.name,
        message: `${battleTeamLabel(team)} · ${def.name}: повтор атаки`,
      });
      damageEffects.forEach((effect) => {
        executeEffect(state, effect, item, self, foe, rt, team, {
          skipExtraAttack: true,
          skipOnHit: true,
        });
      });
    }
  }

  if (rt.activationsLeft != null) {
    rt.activationsLeft = Math.max(0, rt.activationsLeft - 1);
  }

  if (def.id === "mana_orb" && magicEffects.length > 0) {
    pushBattleLog(state, {
      actor: team,
      type: "cast",
      source: def.name,
      message: `${battleTeamLabel(team)} · ${def.name}: повтор сферы (${Math.round(REPEAT_MAGIC_EFFECT_SCALE * 100)}%)`,
    });
    magicEffects.forEach((effect) => {
      executeEffect(state, scaleEffectForRepeat(effect), item, self, foe, rt, team);
    });
  }

  const groundFxValues = allEffects.filter((e) => e.type === "groundFire");
  if (groundFxValues.length > 0 && activeEffects.some((e) => e.type === "damage" && (e.damageType === "fire" || def.tags.includes("fire")))) {
    const value = resolveGroundFireValue(allEffects);
    const before = foe.groundFire;
    foe.groundFire = Math.max(foe.groundFire, value);
    foe.groundFireSourceTeam = team;
    foe.groundFireSourceItemUid = item.uid;
    if (foe.groundFire > before) {
      const victimTeam = getPoisonVictimTeam(self, foe, team);
      pushBattleLog(state, {
        actor: team,
        type: "debuff",
        target: victimTeam,
        source: def.name,
        message: `${battleTeamLabel(team)} · ${def.name}: огонь на поле ×${foe.groundFire} → ${battleTeamLabel(victimTeam)}`,
      });
      queueHitAnimation(state, item, team, `🔥 −${foe.groundFire} огонь`, "#f0883e");
      triggerProfileAvatarCritFlip(victimTeam);
    }
  }

  triggerOnActivateListeners(state, item, self, foe, team);
}

function ensureItemStat(state, item, team) {
  if (!state.itemDamageStats[item.uid]) {
    const def = ITEM_CATALOG[item.itemId];
    const synergyText = (item.runtime?.activeSynergies || [])
      .map((s) => s.desc)
      .filter(Boolean)
      .join(" · ") || null;
    state.itemDamageStats[item.uid] = {
      itemId: item.itemId,
      name: def.name,
      icon: def.icon,
      damageDealt: 0,
      physicalDamageDealt: 0,
      magicDamageDealt: 0,
      healingDone: 0,
      blockDone: 0,
      damageBlocked: 0,
      poisonApplied: 0,
      activations: 0,
      team: team || null,
      synergyBonus: synergyText,
    };
  } else if (team) {
    state.itemDamageStats[item.uid].team = team;
  }
}

function executeEffect(state, effect, item, self, foe, rt, team, execOptions = {}) {
  const def = ITEM_CATALOG[item.itemId];
  ensureItemStat(state, item, team);
  const stat = state.itemDamageStats[item.uid];

  switch (effect.type) {
    case "damage": {
      const dupEff = rt.duplicateEfficiency ?? 1;
      const range = resolveDamageRange(effect, def);
      let base = rollDamageWithLuck(range.min, range.max, self.luck);
      base += rt.damageBonus || 0;
      if (typeof getDamageBonusFromStacks === "function") {
        const allFx = typeof getBattleEffectsForItem === "function"
          ? getBattleEffectsForItem(item)
          : (def.effects || []);
        base += getDamageBonusFromStacks(self, item, allFx);
      }
      if (typeof getFoeDebuffDamageBonus === "function") {
        const debuffFx = (typeof getBattleEffectsForItem === "function"
          ? getBattleEffectsForItem(item)
          : (def.effects || [])).find((e) => e.type === "damagePerFoeDebuff");
        if (debuffFx) base += getFoeDebuffDamageBonus(foe, debuffFx.value);
      }
      if (typeof getTagDamageBonus === "function") {
        const tagFx = (typeof getBattleEffectsForItem === "function"
          ? getBattleEffectsForItem(item)
          : (def.effects || [])).find((e) => e.type === "damagePerTag");
        if (tagFx) base += getTagDamageBonus(self, tagFx.tag, tagFx.value);
      }
      if (dupEff < 1) base = Math.max(base > 0 ? 1 : 0, Math.floor(base * dupEff));
      let dmg = base;
      if (effect.damageType === "magic") dmg *= self.magicDamageMult;
      else dmg *= getTimedDamageMult(self);

      let isCrit = false;
      let critDamageBonus = 0;
      collectItemBattleEffects(item).forEach((fx) => {
        if (fx.type === "critDamageMult") critDamageBonus += Number(fx.value) || 0;
      });
      const critChance = typeof getEffectiveCritChance === "function"
        ? getEffectiveCritChance(self, item, foe)
        : self.critChance;
      if (critChance > 0 && Math.random() < critChance) {
        isCrit = true;
        dmg *= 2 + critDamageBonus;
        pushBattleLog(state, {
          actor: team,
          type: "crit",
          source: def.name,
          message: `${battleTeamLabel(team)} · ${def.name}: крит!`,
        });
        if (foe) {
          (self.items || []).forEach((it) => {
            collectItemBattleEffects(it).forEach((fx) => {
              if (fx.type === "breakBlockOnCrit") {
                foe.block = Math.max(0, (foe.block || 0) - (Number(fx.value) || 15));
              }
            });
          });
        }
        if (self.critDoublePoison) {
          executeEffect(state, { type: "poison", value: (rt.poisonBonus || 0) + 4 }, item, self, foe, rt, team);
        }
      }

      if (rt.pendingAttackBuff) {
        dmg += rt.pendingAttackBuff;
        rt.pendingAttackBuff = 0;
      }

      dmg = scalePacedValue(dmg, DAMAGE_PACING_SCALE);

      const actualDmg = applyDamage(foe, dmg, state, def.name, team, self, effect, item, { isCrit });
      creditDamageStats(self, stat, actualDmg, effect.damageType);
      if (typeof emitEffectAttackVisual === "function" && actualDmg > 0) {
        emitEffectAttackVisual(state, item, team, effect, {
          damage: actualDmg,
          isCrit,
          damageType: effect.damageType || "physical",
          targetTeam: team === "player" ? "enemy" : "player",
        });
      }
      if (!execOptions.skipOnHit) processOnHitItemEffects(state, item, self, foe, team);

      if (!execOptions.skipExtraAttack
        && typeof isSideStunned === "function"
        && isSideStunned(foe)
        && collectItemBattleEffects(item).some((e) => e.type === "extraAttackOnStun")) {
        pushBattleLog(state, {
          actor: team,
          type: "attack",
          source: def.name,
          message: `${battleTeamLabel(team)} · ${def.name}: доп. атака (оглушение)`,
        });
        executeEffect(state, effect, item, self, foe, rt, team, {
          skipExtraAttack: true,
          skipOnHit: true,
        });
      }

      if (self.lifesteal > 0 && actualDmg > 0) {
        const rawHeal = Math.floor(actualDmg * self.lifesteal);
        const heal = getHealAmountUnderPoison(rawHeal, self.poisonStacks);
        if (heal > 0) {
          self.hp = Math.min(self.maxHp, self.hp + heal);
          const poisonNote = heal < rawHeal && self.poisonStacks > 0
            ? ` (яд ×${self.poisonStacks})`
            : "";
          pushBattleLog(state, {
            actor: team,
            type: "heal",
            source: def.name,
            message: `${battleTeamLabel(team)} · ${def.name}: вампиризм +${heal} HP${poisonNote}`,
          });
          stat.healingDone += heal;
          self.totalHealingDone += heal;
          queueHitAnimation(state, item, team, `+${heal}❤`, "#3fb950");
        }
      }
      break;
    }
    case "heal": {
      let amount = effect.value + (rt.healBonus || 0);
      if (typeof getTagDamageBonus === "function") {
        const healPerTagFx = collectItemBattleEffects(item).find((e) => e.type === "healPerTag");
        if (healPerTagFx) amount += getTagDamageBonus(self, healPerTagFx.tag, healPerTagFx.value);
      }
      const beforePoison = amount;
      amount = getHealAmountUnderPoison(amount, self.poisonStacks);
      const before = self.hp;
      self.hp = Math.min(self.maxHp, self.hp + amount);
      const healed = self.hp - before;
      const poisonNote = amount < beforePoison
        ? ` (яд ×${self.poisonStacks}: −${Math.round((1 - amount / beforePoison) * 100)}%)`
        : "";
      pushBattleLog(state, {
        actor: team,
        type: "heal",
        source: def.name,
        message: `${battleTeamLabel(team)} · ${def.name}: +${formatLogNumber(healed)} HP${poisonNote}`,
      });
      stat.healingDone += healed;
      self.totalHealingDone += healed;
      queueHitAnimation(state, item, team, `+${healed}❤`, "#3fb950");
      if (typeof emitEffectAttackVisual === "function") {
        emitEffectAttackVisual(state, item, team, effect, { damage: 0, targetTeam: team });
      }
      if (healed > 0 && typeof checkFoeHealTriggers === "function") {
        checkFoeHealTriggers(state, self, team, healed);
      }
      break;
    }
    case "block": {
      let amount = effect.value + (rt.blockBonus || 0);
      if (self.shieldBlockMult > 0) amount = Math.floor(amount * (1 + self.shieldBlockMult));
      const sourceEff = rt.blockSourceEfficiency ?? 1;
      if (sourceEff < 1) amount = Math.max(amount > 0 ? 1 : 0, Math.floor(amount * sourceEff));
      self.block += amount;
      const effNote = sourceEff < 1 ? ` (${Math.round(sourceEff * 100)}% от стака)` : "";
      pushBattleLog(state, {
        actor: team,
        type: "block",
        source: def.name,
        message: `${battleTeamLabel(team)} · ${def.name}: +${amount} блок${effNote}`,
      });
      stat.blockDone += amount;
      self.totalBlockAbsorbed += amount;
      if (!self.blockLedger) self.blockLedger = [];
      self.blockLedger.push({ itemUid: item.uid, amount });
      queueHitAnimation(state, item, team, `+${amount}🛡`, "#8b949e");
      if (typeof emitEffectAttackVisual === "function") {
        emitEffectAttackVisual(state, item, team, effect, { damage: 0, targetTeam: team });
      }
      if (rt.grantBlockBuff?.buffTargetTags) {
        buffNeighborWeaponsOnBlock(state, item, self, rt.grantBlockBuff);
      }
      processOnBlockItemEffects(state, item, self, team);
      break;
    }
    case "poison": {
      if (effect.interval > 1 && stat.activations % effect.interval !== 0) break;
      let stacks = (effect.value || 2) + (rt.poisonBonus || 0);
      const sourceEff = rt.poisonSourceEfficiency ?? 1;
      if (sourceEff < 1) stacks = Math.max(stacks > 0 ? 1 : 0, Math.floor(stacks * sourceEff));
      stacks = scalePoisonStacks(stacks, POISON_STACK_PACING);
      const room = Math.max(0, POISON_STACK_CAP - foe.poisonStacks);
      const added = Math.min(stacks, room);
      if (added <= 0) break;
      foe.poisonStacks += added;
      const victimTeam = getPoisonVictimTeam(self, foe, team);
      if (added > 0) {
        const attacker = team === "player" ? state.player : state.enemy;
        const victim = victimTeam === "player" ? state.player : state.enemy;
        checkStackThresholds(state, attacker, victim, team);
      }
      foe.poisonSourceTeam = team;
      foe.poisonSourceItemUid = item.uid;
      stat.poisonApplied += added;
      const effNote = sourceEff < 1 ? ` (${Math.round(sourceEff * 100)}% от стака)` : "";
      pushBattleLog(state, {
        actor: team,
        type: "poison",
        target: victimTeam,
        source: def.name,
        message: `${battleTeamLabel(team)} · ${def.name}: +${added} яда${effNote} (×${foe.poisonStacks}) → ${battleTeamLabel(victimTeam)}`,
      });
      queueHitAnimation(state, item, team, `☠ +${added} яд`, "#3fb950");
      if (typeof emitEffectAttackVisual === "function") {
        emitEffectAttackVisual(state, item, team, effect, {
          damage: 0,
          targetTeam: victimTeam,
        });
      }
      triggerProfileAvatarCritFlip(victimTeam);
      break;
    }
    case "slow": {
      if (effect.chance != null && !rollEffectChance(self, effect.chance)) break;
      foe.slowDebuff = Math.max(foe.slowDebuff, effect.value || 0.1);
      foe.slowTimer = Math.max(foe.slowTimer, effect.duration || 3);
      const victimTeam = getPoisonVictimTeam(self, foe, team);
      pushBattleLog(state, {
        actor: team,
        type: "debuff",
        source: def.name,
        target: victimTeam,
        message: `${battleTeamLabel(team)} · ${def.name}: замедление → ${battleTeamLabel(victimTeam)}`,
      });
      const slowPct = Math.round((effect.value || 0.1) * 100);
      queueHitAnimation(state, item, team, `🐌 −${slowPct}%`, "#a371f7");
      if (typeof emitEffectAttackVisual === "function") {
        emitEffectAttackVisual(state, item, team, effect, {
          damage: 0,
          targetTeam: victimTeam,
        });
      }
      break;
    }
    case "buffTimed": {
      self.timedBuffs.push({
        stat: effect.stat || "damage",
        value: effect.value,
        remaining: effect.duration || 5,
      });
      pushBattleLog(state, {
        actor: team,
        type: "buff",
        source: def.name,
        message: `${battleTeamLabel(team)} · ${def.name}: усиление на ${effect.duration || 5}с`,
      });
      break;
    }
    default:
      break;
  }
}

function applyDamage(target, amount, state, sourceLabel, attackerTeam, attackerSide, effect, sourceItem, options = {}) {
  const targetTeam = attackerTeam === "player" ? "enemy" : "player";

  if (target.dodgeReady) {
    const attackerSide = attackerTeam === "player" ? state.player : state.enemy;
    const spentThrough = attackerSide && trySpendToPreventMiss(state, attackerSide, attackerTeam, target, sourceItem);
    if (!spentThrough) {
      target.dodgeReady = false;
      pushBattleLog(state, {
        actor: attackerTeam,
        type: "miss",
        source: sourceLabel,
        target: targetTeam,
        message: `${battleTeamLabel(attackerTeam)} · ${sourceLabel} → ${battleTeamLabel(targetTeam)}: промах (уклонение)`,
      });
      queueHitAnimation(state, sourceItem, attackerTeam, "MISS", "#8b949e");
      if (typeof emitEffectAttackVisual === "function" && sourceItem && effect) {
        emitEffectAttackVisual(state, sourceItem, attackerTeam, effect, {
          miss: true,
          damage: 0,
          targetTeam,
        });
      }
      if (sourceItem && typeof processOnMissItemEffects === "function") {
        processOnMissItemEffects(state, sourceItem, attackerSide, target, attackerTeam);
      }
      processOnDefendEffects(state, target, attackerSide, targetTeam, { dodged: true, blockAbs: 0, hpDmg: 0 });
      return 0;
    }
    target.dodgeReady = false;
  }

  if (isSideInvulnerable(target)) {
    pushBattleLog(state, {
      actor: attackerTeam,
      type: "miss",
      source: sourceLabel,
      target: targetTeam,
      message: `${battleTeamLabel(attackerTeam)} · ${sourceLabel} → ${battleTeamLabel(targetTeam)}: неуязвимость`,
    });
    queueHitAnimation(state, sourceItem, attackerTeam, "✨", "#d2a8ff");
    return 0;
  }

  const inputAmount = amount;
  let dmg = inputAmount;
  if (isFatigueActive(state)) {
    dmg *= getFatigueDamageTakenMult(state);
  }
  if (target.battleRageDamageReduction > 0) {
    dmg *= 1 - target.battleRageDamageReduction;
  }
  target.timedBuffs?.forEach((buff) => {
    if (buff.stat === "damageTaken") dmg *= Math.max(0.1, 1 + buff.value);
  });
  const rawAmount = dmg;
  let blockAbs = 0;
  let armorAbs = 0;

  if (target.block > 0) {
    const effectiveBlock = getEffectiveBlock(target.block, effect?.damageType);
    let absorbed = Math.min(effectiveBlock, dmg);
    if (attackerSide?.shieldBreakBonus > 0) {
      const extra = Math.floor(absorbed * attackerSide.shieldBreakBonus);
      absorbed = Math.min(target.block, absorbed + extra);
    }
    target.block -= absorbed;
    blockAbs = absorbed;
    dmg -= Math.min(absorbed, amount);
  }

  if (target.defense > 0 && dmg > 0) {
    const effectiveDefense = getEffectiveDefense(target.defense, effect?.damageType);
    const armorCap = Math.max(0, Math.floor(rawAmount * getArmorCapRatio(effect?.damageType)));
    const reduced = Math.min(effectiveDefense, dmg, armorCap);
    armorAbs = reduced;
    dmg -= reduced;
  }

  const hpDmg = dmg > 0 ? dmg : 0;
  const blockCredits = blockAbs > 0
    ? creditBlockAbsorption(state, target, targetTeam, blockAbs)
    : new Map();
  const armorCredits = armorAbs > 0
    ? creditArmorAbsorption(state, target, targetTeam, armorAbs)
    : new Map();
  logDefenseAbsorption(state, targetTeam, blockCredits, armorCredits);

  if (hpDmg > 0) {
    const newHp = target.hp - hpDmg;
    if (newHp <= 0 && typeof tryReviveSide === "function" && tryReviveSide(target, state, targetTeam, "Перерождение")) {
      // HP восстановлено перерождением
    } else {
      target.hp = Math.max(0, newHp);
    }
    tryActivateBattleRage(target, state, targetTeam, "Battle Rage");
    const attackerSide = attackerTeam === "player" ? state.player : state.enemy;
    trySpikeRetaliation(state, target, targetTeam, attackerSide, attackerTeam, sourceItem, effect?.damageType, options);
    const dmgType = effect?.damageType;
    const floatText = dmgType === "fire" ? `🔥 −${Math.round(hpDmg)}`
      : dmgType === "magic" ? `✨ −${Math.round(hpDmg)}`
        : `−${Math.round(hpDmg)}`;
    queueHitAnimation(state, sourceItem, attackerTeam, floatText, "#f85149");
    triggerProfileAvatarHitShake(targetTeam);
  } else if (blockAbs + armorAbs > 0) {
    const absorbed = Math.round(blockAbs + armorAbs);
    queueHitAnimation(state, null, attackerTeam, `🛡 −${absorbed}`, "#8b949e");
  }

  if (rawAmount > 0 || blockAbs > 0 || armorAbs > 0) {
    pushBattleLog(state, {
      actor: attackerTeam,
      type: "damage",
      source: sourceLabel,
      target: targetTeam,
      raw: rawAmount,
      block: blockAbs,
      armor: armorAbs,
      hp: hpDmg,
      message: buildDamageLogMessage(
        attackerTeam,
        sourceLabel,
        targetTeam,
        rawAmount,
        blockAbs,
        armorAbs,
        hpDmg,
      ),
    });
  }

  if (blockAbs > 0 || armorAbs > 0) {
    const attackerSide = attackerTeam === "player" ? state.player : state.enemy;
    processOnDefendEffects(state, target, attackerSide, targetTeam, {
      blockAbs,
      armorAbs,
      hpDmg,
      dodged: false,
    });
  }

  return hpDmg;
}

function buffNeighborWeaponsOnBlock(state, shieldItem, self, buffRule) {
  const cap = buffRule.cap ?? 999;
  const shieldRt = shieldItem.runtime || createRuntimeState(shieldItem);
  if ((shieldRt.blockBuffGiven || 0) >= cap) return;

  const buffEff = shieldRt.grantBlockBuffEfficiency ?? 1;
  const baseGive = Math.max(buffRule.value > 0 ? 1 : 0, Math.floor(buffRule.value * buffEff));
  const neighbors = getAdjacentItems(self.items, shieldItem);
  neighbors.forEach((entry) => {
    if (!entry.strong) return;
    if (!itemHasTag(entry.item.itemId, buffRule.buffTargetTags)) return;
    const room = cap - (shieldRt.blockBuffGiven || 0);
    const give = Math.min(baseGive, room);
    if (give <= 0) return;
    entry.item.runtime = entry.item.runtime || createRuntimeState(entry.item);
    entry.item.runtime.pendingAttackBuff += give;
    shieldRt.blockBuffGiven = (shieldRt.blockBuffGiven || 0) + give;
    const effNote = buffEff < 1 ? ` (${Math.round(buffEff * 100)}%)` : "";
    pushBattleLog(state, {
      actor: "system",
      type: "buff",
      source: ITEM_CATALOG[shieldItem.itemId].name,
      message: `${ITEM_CATALOG[shieldItem.itemId].name} → +${give} атаки ${ITEM_CATALOG[entry.item.itemId].name}${effNote}`,
    });
  });
}

const BATTLE_LOG_MAX = 500;
let battleEnemyTeamLabel = "ИИ";

function setBattleEnemyTeamLabel(label) {
  battleEnemyTeamLabel = label || "ИИ";
}

function battleTeamLabel(team) {
  if (team === "player") return "Вы";
  if (team === "enemy") return battleEnemyTeamLabel;
  return "—";
}

function formatLogNumber(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function pushBattleLog(state, entry) {
  const row = {
    t: Math.round((state.elapsed || 0) * 10) / 10,
    actor: entry.actor || "system",
    type: entry.type || "info",
    message: entry.message || "",
    ...entry,
  };
  state.log.push(row);
  if (state.log.length > BATTLE_LOG_MAX) state.log.shift();
}

/** @deprecated — используйте pushBattleLog */
function pushLog(state, msg) {
  pushBattleLog(state, { actor: "system", type: "info", message: msg });
}

function buildDamageLogMessage(attackerTeam, sourceLabel, targetTeam, raw, blockAbs, armorAbs, hpDmg) {
  const attacker = battleTeamLabel(attackerTeam);
  const target = battleTeamLabel(targetTeam);
  let msg = `${attacker} · ${sourceLabel} → ${target}: ${formatLogNumber(raw)} урона`;
  const parts = [];
  if (blockAbs > 0) parts.push(`блок −${formatLogNumber(blockAbs)}`);
  if (armorAbs > 0) parts.push(`броня −${formatLogNumber(armorAbs)}`);
  if (hpDmg > 0) parts.push(`HP −${formatLogNumber(hpDmg)}`);
  else if (parts.length) parts.push("HP 0");
  if (parts.length) msg += ` (${parts.join(", ")})`;
  return msg;
}

function snapshotBattleSide(side) {
  return {
    hp: side.hp,
    maxHp: side.maxHp,
    stamina: side.stamina,
    maxStamina: side.maxStamina,
    staminaRegen: side.staminaRegen,
    staminaSpendFlash: side.staminaSpendFlash || 0,
    lastStaminaSpend: side.lastStaminaSpend || 0,
    block: side.block,
    poisonStacks: side.poisonStacks,
    stacks: side.stacks ? { ...side.stacks } : createSideStacks?.() || { spikes: 0 },
    poisonSourceTeam: side.poisonSourceTeam,
    poisonSourceItemUid: side.poisonSourceItemUid,
    slowDebuff: side.slowDebuff,
    slowTimer: side.slowTimer,
    dodgeReady: side.dodgeReady,
    groundFire: side.groundFire,
    groundFireTimer: side.groundFireTimer,
    groundFireSourceTeam: side.groundFireSourceTeam,
    groundFireSourceItemUid: side.groundFireSourceItemUid,
    timedBuffs: side.timedBuffs.map((b) => ({ ...b })),
    items: side.items.map((item) => ({
      uid: item.uid,
      itemId: item.itemId,
      col: item.col,
      row: item.row,
      rotation: item.rotation || 0,
      currentCooldown: item.currentCooldown,
      runtime: item.runtime ? { ...item.runtime } : null,
    })),
  };
}

function captureBattleFrame(state) {
  return {
    elapsed: state.elapsed,
    battleRound: state.battleRound,
    fatigueAnnounced: !!state.fatigueAnnounced,
    player: snapshotBattleSide(state.player),
    enemy: snapshotBattleSide(state.enemy),
    log: state.log.slice(-80),
    floatingNumbers: state.floatingNumbers.map((fn) => ({ ...fn })),
    winner: state.winner,
    finished: state.finished,
  };
}

function applySideSnapshot(side, snap) {
  side.hp = snap.hp;
  side.maxHp = snap.maxHp;
  side.stamina = snap.stamina ?? side.stamina ?? side.maxStamina;
  side.maxStamina = snap.maxStamina ?? side.maxStamina ?? STAMINA_BASE_MAX;
  side.staminaRegen = snap.staminaRegen ?? side.staminaRegen ?? STAMINA_REGEN_PER_SEC;
  side.staminaSpendFlash = snap.staminaSpendFlash ?? 0;
  side.lastStaminaSpend = snap.lastStaminaSpend ?? 0;
  side.block = snap.block;
  side.poisonStacks = snap.poisonStacks;
  if (snap.stacks) side.stacks = { ...snap.stacks };
  side.poisonSourceTeam = snap.poisonSourceTeam ?? null;
  side.poisonSourceItemUid = snap.poisonSourceItemUid ?? null;
  side.slowDebuff = snap.slowDebuff ?? 0;
  side.slowTimer = snap.slowTimer ?? 0;
  side.dodgeReady = !!snap.dodgeReady;
  side.groundFire = snap.groundFire ?? 0;
  side.groundFireTimer = snap.groundFireTimer ?? 0;
  side.groundFireSourceTeam = snap.groundFireSourceTeam ?? null;
  side.groundFireSourceItemUid = snap.groundFireSourceItemUid ?? null;
  side.timedBuffs = (snap.timedBuffs || []).map((b) => ({ ...b }));
  side.items.forEach((item) => {
    const match = snap.items.find((s) => s.uid === item.uid);
    if (!match) return;
    item.currentCooldown = match.currentCooldown;
    if (match.runtime) item.runtime = { ...match.runtime };
  });
}

function applyBattleFrame(state, frame) {
  state.elapsed = frame.elapsed;
  state.battleRound = frame.battleRound ?? state.battleRound ?? 1;
  state.fatigueAnnounced = !!frame.fatigueAnnounced;
  applySideSnapshot(state.player, frame.player);
  applySideSnapshot(state.enemy, frame.enemy);
  state.log = [...frame.log];
  state.floatingNumbers = frame.floatingNumbers.map((fn) => ({ ...fn }));
  state.finished = !!frame.finished;
  state.winner = frame.winner || null;
}

function recordBattleFrame(state) {
  if (!state?.recording) return;
  const interval = 0.12;
  if (state.elapsed - (state.lastRecordAt || 0) >= interval || state.finished) {
    state.lastRecordAt = state.elapsed;
    state.replayFrames.push(captureBattleFrame(state));
  }
}

function fastForwardBattle(state) {
  if (state.countdown?.active) {
    state.countdown.active = false;
    state.countdown.remaining = 0;
    state.countdown.label = null;
  }
  state.recording = true;
  state.replayFrames = [captureBattleFrame(state)];
  state.lastRecordAt = 0;
  let steps = 0;
  while (!state.finished && steps < 80000) {
    battleTick(state, 0.05);
    recordBattleFrame(state);
    steps++;
  }
  if (!state.finished) {
    resolveBattleTimeout(state);
    recordBattleFrame(state);
  }
  if (!state.replayFrames.length || state.replayFrames[state.replayFrames.length - 1].elapsed !== state.elapsed) {
    state.replayFrames.push(captureBattleFrame(state));
  }
}
