/**
 * Человекочитаемые строки эффектов для тултипов (16+).
 */

type EffectLike = Record<string, unknown> & {
  interval?: number;
  chance?: number;
  randomPick?: Array<Record<string, unknown>>;
  gainWeakestStack?: boolean | Record<string, unknown>;
  gainStack?: string | { stack?: string; value?: number };
  cleanseDebuffs?: number;
  heal?: number;
  damage?: number;
  damageType?: string;
  foePoison?: number;
  block?: number;
  stealWeaponDamage?: number;
  gainAllStacks?: number;
  stripFoeStacksOnceEach?: boolean;
  restoreStamina?: number;
  maxHp?: number;
  randomTimedBuff?: boolean;
  weaponDamageBonus?: number;
  gainDominantStack?: number;
  type?: string;
  threshold?: number;
  once?: boolean;
  direction?: string;
  stack?: string;
  count?: number;
  value?: number;
  preventDamage?: number;
  drainStamina?: number;
  lifesteal?: number;
  weaponDamage?: number;
};

const TT_STACK: Record<string, string> = {
  luck: "удача",
  block: "блок",
  spikes: "шип",
  heat: "жар",
  mana: "мана",
  regen: "реген",
  empower: "усиление",
  cold: "холод",
};

function ttPct(v: unknown): string {
  return `${Math.round(Math.abs(Number(v) || 0) * 100)}%`;
}

function ttInterval(n: unknown): string {
  const v = Math.max(0.5, Number(n) || 3);
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? `${r} сек` : `${r.toFixed(1)} сек`;
}

function ttStack(stack: string): string {
  return TT_STACK[stack] || stack || "бонус";
}

function ttStackLabel(stack: string, n: number | undefined, getStackLabel?: (stack: string, n: number) => string): string {
  if (typeof getStackLabel === "function") return getStackLabel(stack, n || 1);
  return ttStack(stack);
}

function resolveGainStack(gs: EffectLike["gainStack"]): { stack: string; value: number } {
  if (typeof gs === "string") return { stack: gs, value: 1 };
  return { stack: gs?.stack || "heat", value: gs?.value || 1 };
}

function describePeriodicTooltip(e: EffectLike, def?: { isContainer?: boolean }): string {
  const iv = ttInterval(e.interval);
  const bits = [];

  if (e.randomPick?.length) {
    const parts = (e.randomPick || []).map((pick: Record<string, unknown>) => {
      const gain = pick.gainStack as { value?: number; stack?: string } | undefined;
      if (pick.heal) return `лечит на ${pick.heal} HP`;
      if (pick.foePoison) return `отравляет врага (${pick.foePoison})`;
      if (gain) return `+${gain.value || 1} ${ttStack(gain.stack || "heat")}`;
      if (pick.block) return `+${pick.block} блока`;
      if (pick.cleanseDebuffs) return `снимает ${pick.cleanseDebuffs} негатива`;
      if (pick.restoreStamina) return `+${pick.restoreStamina} выносливости`;
      return "случайный бонус";
    });
    bits.push(parts.length > 1 ? `случайно: ${parts.slice(0, -1).join(", ")} или ${parts.at(-1)}` : parts[0]);
  }
  if (e.gainWeakestStack) {
    const gw = e.gainWeakestStack === true
      ? ({} as Record<string, unknown>)
      : (e.gainWeakestStack as Record<string, unknown>);
    let line = `+${gw.value || 1} к самому слабому бонусу`;
    if (gw.altStack && gw.minStack) line += ` (удвоенная ${ttStack(String(gw.altStack))} при ${gw.minStack}+)`;
    bits.push(line);
  }
  if (e.gainStack) {
    const gs = resolveGainStack(e.gainStack);
    const ch = e.chance != null && e.chance < 1 ? `${ttPct(e.chance)} шанс: ` : "";
    bits.push(`${ch}+${gs.value} ${ttStack(gs.stack)}`);
  }
  if (e.cleanseDebuffs) bits.push(`снимает ${e.cleanseDebuffs} негатива`);
  if (e.heal) bits.push(`лечит на ${e.heal} HP`);
  if (e.damage) bits.push(`${e.damage} ${e.damageType === "magic" ? "магического " : ""}урона`);
  if (e.foePoison) bits.push(`отравляет врага (${e.foePoison})`);
  if (e.block) bits.push(`+${e.block} блока`);
  if (e.stealWeaponDamage) bits.push(`крадёт ${e.stealWeaponDamage} урона у оружия врага`);
  if (e.gainAllStacks) bits.push(`+${e.gainAllStacks} ко всем бонусам`);
  if (e.stripFoeStacksOnceEach) bits.push("снять по 1 бонусу каждого типа у врага");
  if (e.restoreStamina) bits.push(`+${e.restoreStamina} выносливости`);
  if (e.maxHp) bits.push(`+${e.maxHp} к макс. здоровью`);
  if (e.randomTimedBuff) bits.push("случайное усиление");
  if (e.weaponDamageBonus) {
    bits.push(def?.isContainer
      ? `оружие внутри +${e.weaponDamageBonus} урона`
      : `оружие +${e.weaponDamageBonus} урона`);
  }
  if (e.gainDominantStack) bits.push(`+${e.gainDominantStack} к самому сильному бонусу`);

  if (!bits.length) return `⏱ Каждые ${iv} — периодический эффект`;
  return `⏱ Каждые ${iv}: ${bits.join(", ")}`;
}

function describeThresholdTooltip(e: EffectLike, getStackLabel?: (stack: string, n: number) => string): string | null {
  const once = e.once !== false ? ", один раз за бой" : "";

  if (e.type === "debuffThreshold") {
    return `☠ При ${e.threshold || 10}+ негативах снимает ${e.cleanseDebuffs || e.value || 1}${once}`;
  }
  if (e.type === "mutualHpThreshold") {
    const pctT = Math.round((e.threshold || 0.8) * 100);
    const parts = [];
    if (e.gainStack) {
      const gs = resolveGainStack(e.gainStack);
      parts.push(`+${gs.value} ${ttStack(gs.stack)}`);
    }
    if (e.damage) {
      parts.push(`${e.damage} маг. урона${e.lifesteal ? ` (лечит ${ttPct(e.lifesteal)} от урона)` : ""}`);
    }
    if (e.heal) parts.push(`лечит на ${e.heal} HP`);
    const body = parts.length ? `: ${parts.join(", ")}` : "";
    return `❤️ Если у обоих <${pctT}% здоровья${body}${once}`;
  }
  if (e.type === "foeHpThreshold") {
    const pctT = Math.round((e.threshold || 0.5) * 100);
    const parts = [];
    if (e.heal) parts.push(`лечит на ${e.heal} HP`);
    if (e.gainDominantStack) parts.push(`+${e.gainDominantStack} к сильнейшему бонусу`);
    if (e.gainStack) {
      const gs = resolveGainStack(e.gainStack);
      parts.push(`+${gs.value} ${ttStack(gs.stack)}`);
    }
    const body = parts.length ? `: ${parts.join(", ")}` : "";
    return `❤️ Если у противника <${pctT}% здоровья${body}${once}`;
  }
  if (e.type === "hpThreshold") {
    const pctT = Math.round((e.threshold || 0.5) * 100);
    const dir = e.direction === "above" ? "выше" : "ниже";
    const parts = [];
    if (e.heal) parts.push(`лечит на ${e.heal} HP`);
    if (e.cleanseDebuffs) parts.push(`снимает ${e.cleanseDebuffs} негатива`);
    if (e.gainStack) {
      const gs = resolveGainStack(e.gainStack);
      parts.push(`+${gs.value} ${ttStack(gs.stack)}`);
    }
    const body = parts.length ? `: ${parts.join(", ")}` : "";
    return `❤️ Если здоровье ${dir} ${pctT}%${body}${once}`;
  }
  if (e.type === "stackThreshold") {
    const stack = e.stack || "heat";
    const label = ttStackLabel(stack, e.threshold, getStackLabel);
    const parts = [];
    if (e.weaponDamage) parts.push(`оружие +${e.weaponDamage} урона`);
    if (e.heal) parts.push(`лечит на ${e.heal} HP`);
    if (e.damage) parts.push(`${e.damage} урона`);
    if (e.gainStack) {
      const gs = resolveGainStack(e.gainStack);
      parts.push(`+${gs.value} ${ttStack(gs.stack)}`);
    }
    if (e.cleanseDebuffs) parts.push(`снимает ${e.cleanseDebuffs} негатива`);
    const body = parts.length ? `: ${parts.join(", ")}` : "";
    return `📊 При ${e.threshold}+ ${label}${body}${once}`;
  }
  if (e.type === "activationThreshold") {
    const parts = [];
    if (e.heal) parts.push(`лечит на ${e.heal} HP`);
    if (e.gainStack) {
      const gs = resolveGainStack(e.gainStack);
      parts.push(`+${gs.value} ${ttStack(gs.stack)}`);
    }
    if (e.cleanseDebuffs) parts.push(`снимает ${e.cleanseDebuffs} негатива`);
    if (e.foePoison) parts.push(`+${e.foePoison} яда`);
    const body = parts.length ? `: ${parts.join(", ")}` : "";
    return `🔁 После ${e.count || e.threshold || 6} активаций${body}`;
  }
  if (e.type === "heartThreshold") {
    return `💖 При ${e.count || 7} сердцах — особый бонус`;
  }
  return null;
}

function describeOnDefendTooltip(e: EffectLike): string {
  const ch = e.chance != null ? `${ttPct(e.chance)}` : "100%";
  const bits = [];
  if (e.preventDamage) bits.push(`блокирует ${e.preventDamage} урона`);
  if (e.drainStamina) bits.push(`забирает ${e.drainStamina} выносливости у врага`);
  if (!bits.length) return `🛡 При блоке или уклонении (${ch} шанс)`;
  return `🛡 При блоке или уклонении (${ch} шанс): ${bits.join(", ")}`;
}
