// Transpiled from TypeScript — npm run compile:ts

const BATTLE_STACK_TYPES = {
  spikes: { label: "\u0428\u0438\u043F\u044B", icon: "\u{1F4CC}", max: 999 },
  block: { label: "\u0411\u043B\u043E\u043A", icon: "\u{1F6E1}", max: 999 },
  empower: { label: "\u0423\u0441\u0438\u043B\u0435\u043D\u0438\u0435", icon: "\u{1F4AA}", max: 999 },
  regen: { label: "\u0420\u0435\u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u044F", icon: "\u{1F49A}", max: 999 },
  luck: { label: "\u0423\u0434\u0430\u0447\u0430", icon: "\u{1F340}", max: 999 },
  heat: { label: "\u0416\u0430\u0440", icon: "\u{1F525}", max: 999 },
  mana: { label: "\u041C\u0430\u043D\u0430", icon: "\u2728", max: 999 }
};
function createSideStacks() {
  return { spikes: 0, block: 0, empower: 0, regen: 0, luck: 0, heat: 0, mana: 0 };
}
function ensureSideStacks(side) {
  if (!side.stacks) side.stacks = createSideStacks();
  return side.stacks;
}
function getStackMeta(stackType) {
  return BATTLE_STACK_TYPES[stackType] || { label: stackType, icon: "\u{1F4CA}", max: 999 };
}
function getStackLabel(stackType, count = 1) {
  const meta = getStackMeta(stackType);
  const n = Math.abs(Number(count) || 0);
  if (stackType === "spikes") {
    if (n === 1) return "\u0448\u0438\u043F";
    if (n >= 2 && n <= 4) return "\u0448\u0438\u043F\u0430";
    return "\u0448\u0438\u043F\u043E\u0432";
  }
  if (stackType === "block") {
    if (n === 1) return "\u0431\u043B\u043E\u043A";
    if (n >= 2 && n <= 4) return "\u0431\u043B\u043E\u043A\u0430";
    return "\u0431\u043B\u043E\u043A\u043E\u0432";
  }
  if (stackType === "empower") {
    if (n === 1) return "\u0443\u0441\u0438\u043B\u0435\u043D\u0438\u0435";
    if (n >= 2 && n <= 4) return "\u0443\u0441\u0438\u043B\u0435\u043D\u0438\u044F";
    return "\u0443\u0441\u0438\u043B\u0435\u043D\u0438\u0439";
  }
  if (stackType === "regen") {
    if (n === 1) return "\u0440\u0435\u0433\u0435\u043D";
    if (n >= 2 && n <= 4) return "\u0440\u0435\u0433\u0435\u043D\u0430";
    return "\u0440\u0435\u0433\u0435\u043D\u043E\u0432";
  }
  if (stackType === "luck") {
    if (n === 1) return "\u0443\u0434\u0430\u0447\u0430";
    if (n >= 2 && n <= 4) return "\u0443\u0434\u0430\u0447\u0438";
    return "\u0443\u0434\u0430\u0447\u0438";
  }
  if (stackType === "heat") {
    if (n === 1) return "\u0436\u0430\u0440";
    if (n >= 2 && n <= 4) return "\u0436\u0430\u0440\u0430";
    return "\u0436\u0430\u0440\u0430";
  }
  if (stackType === "mana") {
    if (n === 1) return "\u043C\u0430\u043D\u0430";
    if (n >= 2 && n <= 4) return "\u043C\u0430\u043D\u044B";
    return "\u043C\u0430\u043D\u044B";
  }
  if (stackType === "cold") {
    if (n === 1) return "\u0445\u043E\u043B\u043E\u0434";
    return "\u0445\u043E\u043B\u043E\u0434\u0430";
  }
  return meta.label.toLowerCase();
}
function formatStackAmount(stackType, amount) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  if (!n) return `0 ${getStackLabel(stackType, 2)}`;
  return `${n} ${getStackLabel(stackType, n)}`;
}
function getSideStack(side, stackType) {
  if (stackType === "poison") return side?.poisonStacks || 0;
  if (stackType === "cold") return side?.coldStacks || 0;
  return ensureSideStacks(side)[stackType] || 0;
}
const RANDOM_STACK_TYPES = ["spikes", "block", "empower", "regen", "luck", "heat", "mana", "cold"];
function pickRandomPositiveStack(side, types = RANDOM_STACK_TYPES) {
  const available = types.filter((t) => getSideStack(side, t) > 0);
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}
function destroyRandomSideStacks(side, count = 4) {
  let left = Math.max(0, Math.floor(Number(count) || 0));
  while (left > 0) {
    const stackType = pickRandomPositiveStack(side);
    if (!stackType) break;
    const have = getSideStack(side, stackType);
    const spend = Math.min(have, left);
    spendSideStack(side, stackType, spend);
    if (stackType === "block" && typeof syncStackResourceSpend === "function") {
      syncStackResourceSpend(side, stackType, spend);
    }
    left -= spend;
  }
}
function getSideStackCap(stackType) {
  return getStackMeta(stackType).max || 999;
}
function applyGainWeakestStack(state, side, item, team, effect) {
  const types = effect.stacks || ["spikes", "block", "empower", "regen", "luck", "heat", "mana"];
  let minType = types[0];
  let minVal = getSideStack(side, minType);
  types.forEach((t) => {
    const v = getSideStack(side, t);
    if (v < minVal) {
      minVal = v;
      minType = t;
    }
  });
  const amount = Number(effect.value) || 1;
  if (effect.minStack != null && minVal >= Number(effect.minStack)) {
    const alt = effect.altStack || "mana";
    return applyGainStackEffect(state, { stack: alt, value: amount * 2 }, item, side, team);
  }
  return applyGainStackEffect(state, { stack: minType, value: amount }, item, side, team);
}
function addSideStack(side, stackType, amount, cap = null) {
  const delta = Math.max(0, Math.floor(Number(amount) || 0));
  if (delta <= 0) return 0;
  if (stackType === "cold") {
    const max2 = cap ?? 999;
    const room2 = Math.max(0, max2 - (side.coldStacks || 0));
    const added2 = Math.min(delta, room2);
    side.coldStacks = (side.coldStacks || 0) + added2;
    return added2;
  }
  if (stackType === "poison") {
    const room2 = Math.max(0, (cap ?? getSideStackCap("poison")) - (side.poisonStacks || 0));
    const added2 = Math.min(delta, room2);
    side.poisonStacks = (side.poisonStacks || 0) + added2;
    return added2;
  }
  const stacks = ensureSideStacks(side);
  const max = cap ?? getSideStackCap(stackType);
  const room = Math.max(0, max - (stacks[stackType] || 0));
  const added = Math.min(delta, room);
  stacks[stackType] = (stacks[stackType] || 0) + added;
  return added;
}
function spendSideStack(side, stackType, amount) {
  const need = Math.max(0, Math.floor(Number(amount) || 0));
  if (need <= 0) return true;
  const have = getSideStack(side, stackType);
  if (have < need) return false;
  if (stackType === "poison") {
    side.poisonStacks = have - need;
    return true;
  }
  if (stackType === "cold") {
    side.coldStacks = have - need;
    return true;
  }
  ensureSideStacks(side)[stackType] = have - need;
  return true;
}
function getSpikeRetaliationDamage(side) {
  return getSideStack(side, "spikes");
}
function isMeleeDamageType(damageType) {
  return damageType !== "magic" && damageType !== "fire";
}
const STACK_GLOBAL_FLAT_DAMAGE_CAP = 8;
const STACK_GLOBAL_DAMAGE_PER = 1;
const MAGE_MANA_STACK_DAMAGE_MULT = 1.25;
function getGlobalStackFlatDamageBonus(side) {
  let bonus = getSideStack(side, "empower") * STACK_GLOBAL_DAMAGE_PER;
  bonus += getSideStack(side, "heat") * STACK_GLOBAL_DAMAGE_PER;
  const manaStacks = getSideStack(side, "mana");
  const manaPer = side?.classId === "mage" ? STACK_GLOBAL_DAMAGE_PER * MAGE_MANA_STACK_DAMAGE_MULT : STACK_GLOBAL_DAMAGE_PER;
  bonus += manaStacks * manaPer;
  return Math.min(STACK_GLOBAL_FLAT_DAMAGE_CAP, bonus);
}
function getDamageBonusFromStacks(side, item, effects = []) {
  let bonus = 0;
  effects.forEach((effect) => {
    if (effect.type === "damagePerStack") {
      bonus += getSideStack(side, effect.stack || "spikes") * (Number(effect.value) || 1);
    }
    if (effect.type === "damagePerTotalStacks" && typeof getTotalSideStacks === "function") {
      bonus += getTotalSideStacks(side) * (Number(effect.value) || 1);
    }
  });
  const def = ITEM_CATALOG[item?.itemId];
  if (def?.tags?.includes("spikes") && !effects.some((e) => e.type === "damagePerStack")) {
    bonus += getSideStack(side, "spikes");
  }
  bonus += getGlobalStackFlatDamageBonus(side);
  return Math.floor(bonus);
}
function syncStackResourceSpend(side, stackType, amount) {
  const spent = Math.max(0, Math.floor(Number(amount) || 0));
  if (spent <= 0) return;
  if (stackType === "block") side.block = Math.max(0, (side.block || 0) - spent);
}
function syncStackResourceGain(side, stackType, amount) {
  const added = Math.max(0, Math.floor(Number(amount) || 0));
  if (added <= 0) return;
  if (stackType === "block") side.block = (side.block || 0) + added;
  if (stackType === "luck") side.luck = (side.luck || 0) + added;
}
function countTaggedItemsOnSide(side, tag) {
  return (side?.items || []).filter((item) => {
    const def = ITEM_CATALOG[item.itemId];
    return def && !def.isContainer && def.tags?.includes(tag);
  }).length;
}
function getTotalSideStacks(side) {
  const types = ["spikes", "block", "empower", "regen", "luck", "heat", "mana", "cold"];
  return types.reduce((sum, t) => sum + getSideStack(side, t), 0);
}
function stripOneStackPerType(side) {
  if (!side) return 0;
  let stripped = 0;
  RANDOM_STACK_TYPES.forEach((stackType) => {
    if (getSideStack(side, stackType) > 0 && spendSideStack(side, stackType, 1)) {
      stripped += 1;
      if (stackType === "block" && typeof syncStackResourceSpend === "function") {
        syncStackResourceSpend(side, stackType, 1);
      }
    }
  });
  return stripped;
}
function getStackThresholdKey(item, effect) {
  return `${item?.uid || item?.itemId}:${effect.stack || "?"}:${effect.threshold}:${effect.targetSide || "self"}`;
}
function collectItemBattleEffects(item) {
  const def = ITEM_CATALOG[item?.itemId];
  return typeof getBattleEffectsForItem === "function" ? getBattleEffectsForItem(item) : def?.effects || [];
}
function collectStackStatusChips(side, buffs, debuffs, seen, pushFn) {
  if (!side) return;
  Object.entries(BATTLE_STACK_TYPES).forEach(([stackType, meta]) => {
    const value = getSideStack(side, stackType);
    if (value <= 0) return;
    const lines = [`${formatStackAmount(stackType, value)}`];
    if (stackType === "spikes") {
      lines.push("\u041F\u0440\u0438 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u0438 \u0431\u043B\u0438\u0436\u043D\u0435\u0433\u043E \u0443\u0440\u043E\u043D\u0430: \u0441\u0442\u043E\u043B\u044C\u043A\u043E \u0436\u0435 \u0443\u0440\u043E\u043D\u0430 \u0430\u0442\u0430\u043A\u0443\u044E\u0449\u0435\u043C\u0443");
      lines.push("+1 \u0443\u0440\u043E\u043D\u0430 \u043E\u0440\u0443\u0436\u0438\u044E \u0441 \u0442\u0435\u0433\u043E\u043C \xAB\u0448\u0438\u043F\u044B\xBB \u0437\u0430 \u043A\u0430\u0436\u0434\u044B\u0439 \u0448\u0438\u043F");
    } else if (stackType === "block") {
      lines.push("\u0414\u043E\u0431\u0430\u0432\u043B\u044F\u0435\u0442 \u0431\u043B\u043E\u043A \u043F\u0440\u0438 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u0438");
    } else if (stackType === "empower") {
      lines.push("+1 \u0443\u0440\u043E\u043D\u0430 \u0437\u0430 \u043A\u0430\u0436\u0434\u043E\u0435 \u0443\u0441\u0438\u043B\u0435\u043D\u0438\u0435");
    } else if (stackType === "regen") {
      lines.push("\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 HP \u043A\u0430\u0436\u0434\u0443\u044E \u0441\u0435\u043A\u0443\u043D\u0434\u0443");
    } else if (stackType === "heat") {
      lines.push("+1 \u0443\u0440\u043E\u043D\u0430 \u0437\u0430 \u043A\u0430\u0436\u0434\u044B\u0439 \u0436\u0430\u0440");
    } else if (stackType === "mana") {
      lines.push(side?.classId === "mage" ? "+1.5 \u0443\u0440\u043E\u043D\u0430 \u0437\u0430 \u043A\u0430\u0436\u0434\u0443\u044E \u043C\u0430\u043D\u0443 (\u043A\u043B\u0430\u0441\u0441 \u043C\u0430\u0433\u0430)" : "+1 \u0443\u0440\u043E\u043D\u0430 \u0437\u0430 \u043A\u0430\u0436\u0434\u0443\u044E \u043C\u0430\u043D\u0443");
    }
    pushFn(buffs, {
      id: `stack-${stackType}`,
      icon: meta.icon,
      value,
      title: meta.label,
      lines
    }, seen);
  });
}
