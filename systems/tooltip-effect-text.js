/**
 * Человекочитаемые строки эффектов для тултипов (16+).
 */

const TT_STACK = {
  luck: "удача",
  block: "блок",
  spikes: "шип",
  heat: "жар",
  mana: "мана",
  regen: "реген",
  empower: "усиление",
  cold: "холод",
};

function ttPct(v) {
  return `${Math.round(Math.abs(Number(v) || 0) * 100)}%`;
}

function ttInterval(n) {
  const v = Math.max(0.5, Number(n) || 3);
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? `${r} сек` : `${r.toFixed(1)} сек`;
}

function ttStack(stack) {
  return TT_STACK[stack] || stack || "бонус";
}

function ttStackLabel(stack, n, getStackLabel) {
  if (typeof getStackLabel === "function") return getStackLabel(stack, n || 1);
  return ttStack(stack);
}

function describePeriodicTooltip(e, def) {
  const iv = ttInterval(e.interval);
  const bits = [];

  if (e.randomPick?.length) {
    const parts = e.randomPick.map((pick) => {
      if (pick.heal) return `лечит на ${pick.heal} HP`;
      if (pick.foePoison) return `отравляет врага (${pick.foePoison})`;
      if (pick.gainStack) return `+${pick.gainStack.value || 1} ${ttStack(pick.gainStack.stack)}`;
      if (pick.block) return `+${pick.block} блока`;
      if (pick.cleanseDebuffs) return `снимает ${pick.cleanseDebuffs} негатива`;
      if (pick.restoreStamina) return `+${pick.restoreStamina} выносливости`;
      return "случайный бонус";
    });
    bits.push(parts.length > 1 ? `случайно: ${parts.slice(0, -1).join(", ")} или ${parts.at(-1)}` : parts[0]);
  }
  if (e.gainWeakestStack) {
    const gw = e.gainWeakestStack === true ? {} : e.gainWeakestStack;
    let line = `+${gw.value || 1} к самому слабому бонусу`;
    if (gw.altStack && gw.minStack) line += ` (удвоенная ${ttStack(gw.altStack)} при ${gw.minStack}+)`;
    bits.push(line);
  }
  if (e.gainStack) {
    const gs = typeof e.gainStack === "object" ? e.gainStack : { stack: e.gainStack, value: 1 };
    const ch = e.chance != null && e.chance < 1 ? `${ttPct(e.chance)} шанс: ` : "";
    bits.push(`${ch}+${gs.value || 1} ${ttStack(gs.stack)}`);
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

function describeThresholdTooltip(e, getStackLabel) {
  const once = e.once !== false ? ", один раз за бой" : "";

  if (e.type === "debuffThreshold") {
    return `☠ При ${e.threshold || 10}+ негативах снимает ${e.cleanseDebuffs || e.value || 1}${once}`;
  }
  if (e.type === "mutualHpThreshold") {
    const pctT = Math.round((e.threshold || 0.8) * 100);
    const parts = [];
    if (e.gainStack) parts.push(`+${e.gainStack.value} ${ttStack(e.gainStack.stack)}`);
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
    if (e.gainStack) parts.push(`+${e.gainStack.value} ${ttStack(e.gainStack.stack)}`);
    const body = parts.length ? `: ${parts.join(", ")}` : "";
    return `❤️ Если у противника <${pctT}% здоровья${body}${once}`;
  }
  if (e.type === "hpThreshold") {
    const pctT = Math.round((e.threshold || 0.5) * 100);
    const dir = e.direction === "above" ? "выше" : "ниже";
    const parts = [];
    if (e.heal) parts.push(`лечит на ${e.heal} HP`);
    if (e.cleanseDebuffs) parts.push(`снимает ${e.cleanseDebuffs} негатива`);
    if (e.gainStack) parts.push(`+${e.gainStack.value} ${ttStack(e.gainStack.stack)}`);
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
    if (e.gainStack) parts.push(`+${e.gainStack.value} ${ttStack(e.gainStack.stack)}`);
    if (e.cleanseDebuffs) parts.push(`снимает ${e.cleanseDebuffs} негатива`);
    const body = parts.length ? `: ${parts.join(", ")}` : "";
    return `📊 При ${e.threshold}+ ${label}${body}${once}`;
  }
  if (e.type === "activationThreshold") {
    const parts = [];
    if (e.heal) parts.push(`лечит на ${e.heal} HP`);
    if (e.gainStack) parts.push(`+${e.gainStack.value} ${ttStack(e.gainStack.stack)}`);
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

function describeOnDefendTooltip(e) {
  const ch = e.chance != null ? `${ttPct(e.chance)}` : "100%";
  const bits = [];
  if (e.preventDamage) bits.push(`блокирует ${e.preventDamage} урона`);
  if (e.drainStamina) bits.push(`забирает ${e.drainStamina} выносливости у врага`);
  if (!bits.length) return `🛡 При блоке или уклонении (${ch} шанс)`;
  return `🛡 При блоке или уклонении (${ch} шанс): ${bits.join(", ")}`;
}
