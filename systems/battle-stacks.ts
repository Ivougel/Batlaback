/**
 * Боевые стаки (шипы, блок, усиление и т.д.) — единый API.
 */
import type { BattleSideState, BattleStackType, StatusChip } from "../types/game";

type StackMeta = { label: string; icon: string; max: number };
type BoardItem = { itemId: string; uid: string; runtime?: { damageBonus?: number } };
type StackEffect = {
  type?: string;
  stack?: string;
  value?: number;
  stacks?: string[];
  minStack?: number;
  altStack?: string;
  threshold?: number;
  targetSide?: string;
};

const BATTLE_STACK_TYPES: Record<string, StackMeta> = {
  spikes: { label: "Шипы", icon: "📌", max: 999 },
  block: { label: "Блок", icon: "🛡", max: 999 },
  empower: { label: "Усиление", icon: "💪", max: 999 },
  regen: { label: "Регенерация", icon: "💚", max: 999 },
  luck: { label: "Удача", icon: "🍀", max: 999 },
  heat: { label: "Жар", icon: "🔥", max: 999 },
  mana: { label: "Мана", icon: "✨", max: 999 },
};

function createSideStacks(): Record<string, number> {
  return { spikes: 0, block: 0, empower: 0, regen: 0, luck: 0, heat: 0, mana: 0 };
}

function ensureSideStacks(side: BattleSideState): Record<string, number> {
  if (!side.stacks) side.stacks = createSideStacks();
  return side.stacks;
}

function getStackMeta(stackType: string): StackMeta {
  return BATTLE_STACK_TYPES[stackType] || { label: stackType, icon: "📊", max: 999 };
}

function getStackLabel(stackType: string, count = 1): string {
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
  if (stackType === "cold") {
    if (n === 1) return "холод";
    return "холода";
  }
  return meta.label.toLowerCase();
}

function formatStackAmount(stackType: string, amount: number): string {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  if (!n) return `0 ${getStackLabel(stackType, 2)}`;
  return `${n} ${getStackLabel(stackType, n)}`;
}

function getSideStack(side: BattleSideState, stackType: string): number {
  if (stackType === "poison") return side?.poisonStacks || 0;
  if (stackType === "cold") return side?.coldStacks || 0;
  return ensureSideStacks(side)[stackType] || 0;
}

const RANDOM_STACK_TYPES: string[] = ["spikes", "block", "empower", "regen", "luck", "heat", "mana", "cold"];

function pickRandomPositiveStack(side: BattleSideState, types: string[] = RANDOM_STACK_TYPES): string | null {
  const available = types.filter((t) => getSideStack(side, t) > 0);
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function destroyRandomSideStacks(side: BattleSideState, count = 4): void {
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

function getSideStackCap(stackType: string): number {
  return getStackMeta(stackType).max || 999;
}

function applyGainWeakestStack(
  state: object,
  side: BattleSideState,
  item: BoardItem,
  team: string,
  effect: StackEffect,
): unknown {
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

function addSideStack(side: BattleSideState, stackType: string, amount: number, cap: number | null = null): number {
  const delta = Math.max(0, Math.floor(Number(amount) || 0));
  if (delta <= 0) return 0;
  if (stackType === "cold") {
    const max = cap ?? 999;
    const room = Math.max(0, max - (side.coldStacks || 0));
    const added = Math.min(delta, room);
    side.coldStacks = (side.coldStacks || 0) + added;
    return added;
  }
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

function spendSideStack(side: BattleSideState, stackType: string, amount: number): boolean {
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

function getSpikeRetaliationDamage(side: BattleSideState): number {
  return getSideStack(side, "spikes");
}

function isMeleeDamageType(damageType: string): boolean {
  return damageType !== "magic" && damageType !== "fire";
}

/** Плоский бонус за стаки усиление/жар/мана — общий потолок за удар. */
const STACK_GLOBAL_FLAT_DAMAGE_CAP = 8;
const STACK_GLOBAL_DAMAGE_PER = 1;
/** Маг: мана-стаки чуть сильнее вносят вклад в урон (новичок ~+25%). */
const MAGE_MANA_STACK_DAMAGE_MULT = 1.25;

function getGlobalStackFlatDamageBonus(side: BattleSideState): number {
  let bonus = getSideStack(side, "empower") * STACK_GLOBAL_DAMAGE_PER;
  bonus += getSideStack(side, "heat") * STACK_GLOBAL_DAMAGE_PER;
  const manaStacks = getSideStack(side, "mana");
  const manaPer = side?.classId === "mage"
    ? STACK_GLOBAL_DAMAGE_PER * MAGE_MANA_STACK_DAMAGE_MULT
    : STACK_GLOBAL_DAMAGE_PER;
  bonus += manaStacks * manaPer;
  return Math.min(STACK_GLOBAL_FLAT_DAMAGE_CAP, bonus);
}

function getDamageBonusFromStacks(
  side: BattleSideState,
  item: BoardItem,
  effects: StackEffect[] = [],
): number {
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

function syncStackResourceSpend(side: BattleSideState, stackType: string, amount: number): void {
  const spent = Math.max(0, Math.floor(Number(amount) || 0));
  if (spent <= 0) return;
  if (stackType === "block") side.block = Math.max(0, (side.block || 0) - spent);
}

function syncStackResourceGain(side: BattleSideState, stackType: string, amount: number): void {
  const added = Math.max(0, Math.floor(Number(amount) || 0));
  if (added <= 0) return;
  if (stackType === "block") side.block = (side.block || 0) + added;
  if (stackType === "luck") side.luck = (side.luck || 0) + added;
}

function countTaggedItemsOnSide(side: BattleSideState, tag: string): number {
  return (side?.items || []).filter((item) => {
    const def = ITEM_CATALOG[item.itemId];
    return def && !def.isContainer && def.tags?.includes(tag);
  }).length;
}

function getTotalSideStacks(side: BattleSideState): number {
  const types = ["spikes", "block", "empower", "regen", "luck", "heat", "mana", "cold"];
  return types.reduce((sum, t) => sum + getSideStack(side, t), 0);
}

/** Снять по 1 стаку каждого типа (баффы противника). */
function stripOneStackPerType(side: BattleSideState): number {
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

function getStackThresholdKey(item: BoardItem, effect: StackEffect): string {
  return `${item?.uid || item?.itemId}:${effect.stack || "?"}:${effect.threshold}:${effect.targetSide || "self"}`;
}

function collectItemBattleEffects(item: BoardItem): Array<Record<string, unknown>> {
  const def = ITEM_CATALOG[item?.itemId] as { effects?: Array<Record<string, unknown>> } | undefined;
  return typeof getBattleEffectsForItem === "function"
    ? getBattleEffectsForItem(item)
    : (def?.effects || []);
}

function collectStackStatusChips(
  side: BattleSideState,
  buffs: StatusChip[],
  debuffs: StatusChip[],
  seen: Set<string>,
  pushFn: (list: StatusChip[], chip: StatusChip, seenSet: Set<string>) => void,
): void {
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
      lines.push(side?.classId === "mage"
        ? "+1.5 урона за каждую ману (класс мага)"
        : "+1 урона за каждую ману");
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
