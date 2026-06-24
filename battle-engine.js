/**
 * Боевой движок: универсальные эффекты, классовые бонусы, статусы.
 */

const MAX_BATTLE_DURATION = 120;
/** Не более N активаций предметов за один tick — разносит залпы по волнам. */
const MAX_ACTIVATIONS_PER_SIDE_PER_TICK = 2;
const BATTLE_CD_START_MIN_RATIO = 0.5;
const BATTLE_CD_START_RANGE_RATIO = 0.5;
const STAMINA_BASE_MAX = 100;
const STAMINA_REGEN_PER_SEC = 9;
const STAMINA_WEAPON_REGEN_BONUS = 1;
const STAMINA_FAILED_RETRY_CD = 0.45;
/** Множитель роста пула выносливости от дорогих предметов (ниже = меньше «разгон»). */
const STAMINA_POOL_PEAK_MULT = 2;
const STAMINA_POOL_PEAK_ADD = 14;
const STAMINA_POOL_BASE_ADD = 28;
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

const POISON_STACK_CAP = 3;
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
  return Math.max(0, Math.floor(stacks * scale));
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

function createBattleSide(items, classId) {
  const side = {
    hp: 108,
    maxHp: 108,
    block: 0,
    defense: 0,
    poisonStacks: 0,
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
    dodgeInterval: 0,
    dodgeTimer: 0,
    dodgeReady: false,
    groundFire: 0,
    groundFireTimer: 0,
    groundFireSourceTeam: null,
    groundFireSourceItemUid: null,
    repeatMagic: false,
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
    stamina: 0,
    maxStamina: STAMINA_BASE_MAX,
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
  finalizeSideCombatStats(side);
  finalizeSideStamina(side);
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

function applyClassCombatBonus(side, classId) {
  const cls = getClassById(classId);
  if (!cls?.combatBonus) return;
  const b = cls.combatBonus;
  if (b.type === "maxHpMult") side.maxHp = Math.floor(side.maxHp * (1 + b.value));
  if (b.type === "attackSpeedMult") side.cooldownMult *= 1 - b.value;
  if (b.type === "magicDamageMult") side.magicDamageMult *= 1 + b.value;
}

function applyPassiveItemEffects(side) {
  side.items.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    (def.effects || []).forEach((effect) => {
      if (effect.trigger !== "passive" && effect.type.startsWith("passive")) {
        applyPassiveEffect(side, item, effect);
        return;
      }
      if (effect.trigger === "passive") applyPassiveEffect(side, item, effect);
    });
  });
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

function createBattleState(playerItems, enemyItems, playerClassId = null, enemyClassId = null, battleRound = 1) {
  const player = createBattleSide(playerItems, playerClassId);
  const enemy = createBattleSide(enemyItems, enemyClassId || pickRandomClassId());
  const state = {
    player,
    enemy,
    battleRound: Math.max(1, battleRound || 1),
    fatigueAnnounced: false,
    log: [],
    finished: false,
    winner: null,
    elapsed: 0,
    floatingNumbers: [],
    itemDamageStats: {},
  };
  initBattleAnimations(state);
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
  return mult;
}

function battleTick(state, dt) {
  if (state.finished) return;

  state.elapsed += dt;
  tickStatusEffects(state, dt);
  tickPoison(state, dt);
  tickGroundFire(state, dt);
  tickFatigue(state, dt);
  tickBattleAnimations(state, dt);

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

    self.items.forEach((item) => {
      if (item.currentCooldown > 0 && item.currentCooldown < 9000) {
        item.currentCooldown = Math.max(0, item.currentCooldown - dt);
      }
    });

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
  [state.player, state.enemy].forEach((side) => {
    side.timedBuffs = side.timedBuffs.filter((b) => {
      b.remaining -= dt;
      return b.remaining > 0;
    });
    if (side.slowTimer > 0) {
      side.slowTimer -= dt;
      if (side.slowTimer <= 0) side.slowDebuff = 0;
    }
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
      spawnBattleFloat(state, `-${dmg}☠`, "#3fb950", {
        targetTeam: team,
        kind: "debuff",
        fromDebuffChip: "poison",
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
      spawnBattleFloat(state, `-${dmg}🔥`, "#f0883e", {
        targetTeam: team,
        kind: "debuff",
        fromDebuffChip: "ground-fire",
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
      spawnBattleFloat(state, `-${FATIGUE_HP_DRAIN_PER_SEC}⏳`, "#d29922", {
        targetTeam: team,
        kind: "debuff",
      });
      triggerProfileAvatarHitShake(team);
      triggerProfileAvatarCritFlip(team);
    }
  });
}

function activateItem(state, item, self, foe, team) {
  const def = ITEM_CATALOG[item.itemId];
  const rt = item.runtime || createRuntimeState(item);
  ensureItemStat(state, item, team);
  state.itemDamageStats[item.uid].activations++;
  queueItemAttackAnimation(state, item, team);

  const activeEffects = (def.effects || []).filter((e) => e.trigger !== "passive");
  const magicEffects = activeEffects.filter((e) => e.damageType === "magic" || def.tags.includes("magic"));

  activeEffects.forEach((effect) => {
    if (effect.type === "groundFire" || effect.type === "dodgePeriodic" || effect.type === "repeatCast"
      || effect.type === "crit" || effect.type === "shieldBreakBonus") return;
    executeEffect(state, effect, item, self, foe, rt, team);
  });

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

  const groundFx = (def.effects || []).find((e) => e.type === "groundFire");
  if (groundFx && activeEffects.some((e) => e.type === "damage" && (e.damageType === "fire" || def.tags.includes("fire")))) {
    const value = scalePacedValue(groundFx.value || 2, GROUND_FIRE_PACING);
    const before = foe.groundFire;
    foe.groundFire = Math.max(foe.groundFire, value);
    foe.groundFireSourceTeam = team;
    foe.groundFireSourceItemUid = item.uid;
    if (foe.groundFire > before) {
      const victimTeam = team === "player" ? "enemy" : "player";
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

function executeEffect(state, effect, item, self, foe, rt, team) {
  const def = ITEM_CATALOG[item.itemId];
  ensureItemStat(state, item, team);
  const stat = state.itemDamageStats[item.uid];

  switch (effect.type) {
    case "damage": {
      const dupEff = rt.duplicateEfficiency ?? 1;
      const range = resolveDamageRange(effect, def);
      let base = rollDamageWithLuck(range.min, range.max, self.luck);
      base += rt.damageBonus || 0;
      if (dupEff < 1) base = Math.max(base > 0 ? 1 : 0, Math.floor(base * dupEff));
      let dmg = base;
      if (effect.damageType === "magic") dmg *= self.magicDamageMult;
      else dmg *= getTimedDamageMult(self);

      let isCrit = false;
      if (self.critChance > 0 && Math.random() < self.critChance) {
        isCrit = true;
        dmg *= 2;
        pushBattleLog(state, {
          actor: team,
          type: "crit",
          source: def.name,
          message: `${battleTeamLabel(team)} · ${def.name}: крит!`,
        });
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
      if (rt.grantBlockBuff?.buffTargetTags) {
        buffNeighborWeaponsOnBlock(state, item, self, rt.grantBlockBuff);
      }
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
      foe.poisonSourceTeam = team;
      foe.poisonSourceItemUid = item.uid;
      stat.poisonApplied += added;
      const effNote = sourceEff < 1 ? ` (${Math.round(sourceEff * 100)}% от стака)` : "";
      pushBattleLog(state, {
        actor: team,
        type: "poison",
        target: team === "player" ? "enemy" : "player",
        source: def.name,
        message: `${battleTeamLabel(team)} · ${def.name}: +${added} яда${effNote} (×${foe.poisonStacks}) → ${battleTeamLabel(team === "player" ? "enemy" : "player")}`,
      });
      queueHitAnimation(state, item, team, `☠ +${added} яд`, "#3fb950");
      triggerProfileAvatarCritFlip(team === "player" ? "enemy" : "player");
      break;
    }
    case "slow": {
      foe.slowDebuff = Math.max(foe.slowDebuff, effect.value || 0.1);
      foe.slowTimer = Math.max(foe.slowTimer, effect.duration || 3);
      pushBattleLog(state, {
        actor: team,
        type: "debuff",
        source: def.name,
        target: team === "player" ? "enemy" : "player",
        message: `${battleTeamLabel(team)} · ${def.name}: замедление → ${battleTeamLabel(team === "player" ? "enemy" : "player")}`,
      });
      const slowPct = Math.round((effect.value || 0.1) * 100);
      queueHitAnimation(state, item, team, `🐌 −${slowPct}%`, "#a371f7");
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
    target.dodgeReady = false;
    pushBattleLog(state, {
      actor: attackerTeam,
      type: "miss",
      source: sourceLabel,
      target: targetTeam,
      message: `${battleTeamLabel(attackerTeam)} · ${sourceLabel} → ${battleTeamLabel(targetTeam)}: промах (уклонение)`,
    });
    queueHitAnimation(state, sourceItem, attackerTeam, "MISS", "#8b949e");
    return 0;
  }

  const inputAmount = amount;
  let dmg = inputAmount;
  if (isFatigueActive(state)) {
    dmg *= getFatigueDamageTakenMult(state);
  }
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
    target.hp = Math.max(0, target.hp - hpDmg);
    const dmgType = effect?.damageType;
    const floatText = dmgType === "fire" ? `🔥 −${Math.round(hpDmg)}`
      : dmgType === "magic" ? `✨ −${Math.round(hpDmg)}`
        : `−${Math.round(hpDmg)}`;
    queueHitAnimation(state, sourceItem, attackerTeam, floatText, "#f85149");
    triggerProfileAvatarHitShake(targetTeam);
  } else if (blockAbs + armorAbs > 0) {
    const absorbed = Math.round(blockAbs + armorAbs);
    queueHitAnimation(state, sourceItem, attackerTeam, `🛡 −${absorbed}`, "#8b949e");
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
