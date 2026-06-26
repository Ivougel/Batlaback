/**
 * Боевые стаки (шипы, блок, усиление и т.д.) — единый API.
 */

const BATTLE_STACK_TYPES = {
  spikes: { label: "Шипы", icon: "📌", max: 999 },
  block: { label: "Блок", icon: "🛡", max: 999 },
  empower: { label: "Усиление", icon: "💪", max: 999 },
  regen: { label: "Регенерация", icon: "💚", max: 999 },
  luck: { label: "Удача", icon: "🍀", max: 999 },
  heat: { label: "Жар", icon: "🔥", max: 999 },
  mana: { label: "Мана", icon: "✨", max: 999 },
};

function createSideStacks() {
  return { spikes: 0, block: 0, empower: 0, regen: 0, luck: 0, heat: 0, mana: 0 };
}

function ensureSideStacks(side) {
  if (!side.stacks) side.stacks = createSideStacks();
  return side.stacks;
}

function getStackMeta(stackType) {
  return BATTLE_STACK_TYPES[stackType] || { label: stackType, icon: "📊", max: 999 };
}

function getStackLabel(stackType, count = 1) {
  const meta = getStackMeta(stackType);
  const n = Math.abs(Number(count) || 0);
  if (stackType === "spikes") {
    if (n === 1) return "шип";
    if (n >= 2 && n <= 4) return "шипа";
    return "шипов";
  }
  if (stackType === "block") {
    if (n === 1) return "блок";
    if (n >= 2 && n <= 4) return "блока";
    return "блоков";
  }
  if (stackType === "empower") {
    if (n === 1) return "усиление";
    if (n >= 2 && n <= 4) return "усиления";
    return "усилений";
  }
  if (stackType === "regen") {
    if (n === 1) return "реген";
    if (n >= 2 && n <= 4) return "регена";
    return "регенов";
  }
  if (stackType === "luck") {
    if (n === 1) return "удача";
    if (n >= 2 && n <= 4) return "удачи";
    return "удачи";
  }
  if (stackType === "heat") {
    if (n === 1) return "жар";
    if (n >= 2 && n <= 4) return "жара";
    return "жара";
  }
  if (stackType === "mana") {
    if (n === 1) return "мана";
    if (n >= 2 && n <= 4) return "маны";
    return "маны";
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
  return ensureSideStacks(side)[stackType] || 0;
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
  if (stackType === "poison") {
    const room = Math.max(0, (cap ?? getSideStackCap("poison")) - (side.poisonStacks || 0));
    const added = Math.min(delta, room);
    side.poisonStacks = (side.poisonStacks || 0) + added;
    return added;
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
  ensureSideStacks(side)[stackType] = have - need;
  return true;
}

function getSpikeRetaliationDamage(side) {
  return getSideStack(side, "spikes");
}

function isMeleeDamageType(damageType) {
  return damageType !== "magic" && damageType !== "fire";
}

function getDamageBonusFromStacks(side, item, effects = []) {
  let bonus = 0;
  effects.forEach((effect) => {
    if (effect.type === "damagePerStack") {
      bonus += getSideStack(side, effect.stack || "spikes") * (Number(effect.value) || 1);
    }
  });
  const def = ITEM_CATALOG[item?.itemId];
  if (def?.tags?.includes("spikes") && !effects.some((e) => e.type === "damagePerStack")) {
    bonus += getSideStack(side, "spikes");
  }
  bonus += getSideStack(side, "empower") * 1;
  bonus += getSideStack(side, "heat") * 1;
  bonus += getSideStack(side, "mana") * 1;
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

function getStackThresholdKey(item, effect) {
  return `${item?.uid || item?.itemId}:${effect.stack || "?"}:${effect.threshold}:${effect.targetSide || "self"}`;
}

function collectItemBattleEffects(item) {
  const def = ITEM_CATALOG[item?.itemId];
  return typeof getBattleEffectsForItem === "function"
    ? getBattleEffectsForItem(item)
    : (def?.effects || []);
}

function collectStackStatusChips(side, buffs, debuffs, seen, pushFn) {
  if (!side) return;
  Object.entries(BATTLE_STACK_TYPES).forEach(([stackType, meta]) => {
    const value = getSideStack(side, stackType);
    if (value <= 0) return;
    const lines = [`${formatStackAmount(stackType, value)}`];
    if (stackType === "spikes") {
      lines.push("При получении ближнего урона: столько же урона атакующему");
      lines.push("+1 урона оружию с тегом «шипы» за каждый шип");
    } else if (stackType === "block") {
      lines.push("Добавляет блок при получении");
    } else if (stackType === "empower") {
      lines.push("+1 урона за каждое усиление");
    } else if (stackType === "regen") {
      lines.push("Восстановление HP каждую секунду");
    } else if (stackType === "heat") {
      lines.push("+1 урона за каждый жар");
    } else if (stackType === "mana") {
      lines.push("+1 урона за каждую ману");
    }
    pushFn(buffs, {
      id: `stack-${stackType}`,
      icon: meta.icon,
      value,
      title: meta.label,
      lines,
    }, seen);
  });
}
