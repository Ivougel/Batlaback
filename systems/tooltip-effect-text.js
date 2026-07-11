// Transpiled from TypeScript — npm run compile:ts

const TT_STACK = {
  luck: "\u0443\u0434\u0430\u0447\u0430",
  block: "\u0431\u043B\u043E\u043A",
  spikes: "\u0448\u0438\u043F",
  heat: "\u0436\u0430\u0440",
  mana: "\u043C\u0430\u043D\u0430",
  regen: "\u0440\u0435\u0433\u0435\u043D",
  empower: "\u0443\u0441\u0438\u043B\u0435\u043D\u0438\u0435",
  cold: "\u0445\u043E\u043B\u043E\u0434"
};
function ttPct(v) {
  return `${Math.round(Math.abs(Number(v) || 0) * 100)}%`;
}
function ttInterval(n) {
  const v = Math.max(0.5, Number(n) || 3);
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? `${r} \u0441\u0435\u043A` : `${r.toFixed(1)} \u0441\u0435\u043A`;
}
function ttStack(stack) {
  return TT_STACK[stack] || stack || "\u0431\u043E\u043D\u0443\u0441";
}
function ttStackLabel(stack, n, getStackLabel) {
  if (typeof getStackLabel === "function") return getStackLabel(stack, n || 1);
  return ttStack(stack);
}
function resolveGainStack(gs) {
  if (typeof gs === "string") return { stack: gs, value: 1 };
  return { stack: gs?.stack || "heat", value: gs?.value || 1 };
}
function describePeriodicTooltip(e, def) {
  const iv = ttInterval(e.interval);
  const bits = [];
  if (e.randomPick?.length) {
    const parts = (e.randomPick || []).map((pick) => {
      const gain = pick.gainStack;
      if (pick.heal) return `\u043B\u0435\u0447\u0438\u0442 \u043D\u0430 ${pick.heal} HP`;
      if (pick.foePoison) return `\u043E\u0442\u0440\u0430\u0432\u043B\u044F\u0435\u0442 \u0432\u0440\u0430\u0433\u0430 (${pick.foePoison})`;
      if (gain) return `+${gain.value || 1} ${ttStack(gain.stack || "heat")}`;
      if (pick.block) return `+${pick.block} \u0431\u043B\u043E\u043A\u0430`;
      if (pick.cleanseDebuffs) return `\u0441\u043D\u0438\u043C\u0430\u0435\u0442 ${pick.cleanseDebuffs} \u043D\u0435\u0433\u0430\u0442\u0438\u0432\u0430`;
      if (pick.restoreStamina) return `+${pick.restoreStamina} \u0432\u044B\u043D\u043E\u0441\u043B\u0438\u0432\u043E\u0441\u0442\u0438`;
      return "\u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u0439 \u0431\u043E\u043D\u0443\u0441";
    });
    bits.push(parts.length > 1 ? `\u0441\u043B\u0443\u0447\u0430\u0439\u043D\u043E: ${parts.slice(0, -1).join(", ")} \u0438\u043B\u0438 ${parts.at(-1)}` : parts[0]);
  }
  if (e.gainWeakestStack) {
    const gw = e.gainWeakestStack === true ? {} : e.gainWeakestStack;
    let line = `+${gw.value || 1} \u043A \u0441\u0430\u043C\u043E\u043C\u0443 \u0441\u043B\u0430\u0431\u043E\u043C\u0443 \u0431\u043E\u043D\u0443\u0441\u0443`;
    if (gw.altStack && gw.minStack) line += ` (\u0443\u0434\u0432\u043E\u0435\u043D\u043D\u0430\u044F ${ttStack(String(gw.altStack))} \u043F\u0440\u0438 ${gw.minStack}+)`;
    bits.push(line);
  }
  if (e.gainStack) {
    const gs = resolveGainStack(e.gainStack);
    const ch = e.chance != null && e.chance < 1 ? `${ttPct(e.chance)} \u0448\u0430\u043D\u0441: ` : "";
    bits.push(`${ch}+${gs.value} ${ttStack(gs.stack)}`);
  }
  if (e.cleanseDebuffs) bits.push(`\u0441\u043D\u0438\u043C\u0430\u0435\u0442 ${e.cleanseDebuffs} \u043D\u0435\u0433\u0430\u0442\u0438\u0432\u0430`);
  if (e.heal) bits.push(`\u043B\u0435\u0447\u0438\u0442 \u043D\u0430 ${e.heal} HP`);
  if (e.damage) bits.push(`${e.damage} ${e.damageType === "magic" ? "\u043C\u0430\u0433\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E " : ""}\u0443\u0440\u043E\u043D\u0430`);
  if (e.foePoison) bits.push(`\u043E\u0442\u0440\u0430\u0432\u043B\u044F\u0435\u0442 \u0432\u0440\u0430\u0433\u0430 (${e.foePoison})`);
  if (e.block) bits.push(`+${e.block} \u0431\u043B\u043E\u043A\u0430`);
  if (e.stealWeaponDamage) bits.push(`\u043A\u0440\u0430\u0434\u0451\u0442 ${e.stealWeaponDamage} \u0443\u0440\u043E\u043D\u0430 \u0443 \u043E\u0440\u0443\u0436\u0438\u044F \u0432\u0440\u0430\u0433\u0430`);
  if (e.gainAllStacks) bits.push(`+${e.gainAllStacks} \u043A\u043E \u0432\u0441\u0435\u043C \u0431\u043E\u043D\u0443\u0441\u0430\u043C`);
  if (e.stripFoeStacksOnceEach) bits.push("\u0441\u043D\u044F\u0442\u044C \u043F\u043E 1 \u0431\u043E\u043D\u0443\u0441\u0443 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0442\u0438\u043F\u0430 \u0443 \u0432\u0440\u0430\u0433\u0430");
  if (e.restoreStamina) bits.push(`+${e.restoreStamina} \u0432\u044B\u043D\u043E\u0441\u043B\u0438\u0432\u043E\u0441\u0442\u0438`);
  if (e.maxHp) bits.push(`+${e.maxHp} \u043A \u043C\u0430\u043A\u0441. \u0437\u0434\u043E\u0440\u043E\u0432\u044C\u044E`);
  if (e.randomTimedBuff) bits.push("\u0441\u043B\u0443\u0447\u0430\u0439\u043D\u043E\u0435 \u0443\u0441\u0438\u043B\u0435\u043D\u0438\u0435");
  if (e.weaponDamageBonus) {
    bits.push(def?.isContainer ? `\u043E\u0440\u0443\u0436\u0438\u0435 \u0432\u043D\u0443\u0442\u0440\u0438 +${e.weaponDamageBonus} \u0443\u0440\u043E\u043D\u0430` : `\u043E\u0440\u0443\u0436\u0438\u0435 +${e.weaponDamageBonus} \u0443\u0440\u043E\u043D\u0430`);
  }
  if (e.gainDominantStack) bits.push(`+${e.gainDominantStack} \u043A \u0441\u0430\u043C\u043E\u043C\u0443 \u0441\u0438\u043B\u044C\u043D\u043E\u043C\u0443 \u0431\u043E\u043D\u0443\u0441\u0443`);
  if (!bits.length) return `\u23F1 \u041A\u0430\u0436\u0434\u044B\u0435 ${iv} \u2014 \u043F\u0435\u0440\u0438\u043E\u0434\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u044D\u0444\u0444\u0435\u043A\u0442`;
  return `\u23F1 \u041A\u0430\u0436\u0434\u044B\u0435 ${iv}: ${bits.join(", ")}`;
}
function describeThresholdTooltip(e, getStackLabel) {
  const once = e.once !== false ? ", \u043E\u0434\u0438\u043D \u0440\u0430\u0437 \u0437\u0430 \u0431\u043E\u0439" : "";
  if (e.type === "debuffThreshold") {
    return `\u2620 \u041F\u0440\u0438 ${e.threshold || 10}+ \u043D\u0435\u0433\u0430\u0442\u0438\u0432\u0430\u0445 \u0441\u043D\u0438\u043C\u0430\u0435\u0442 ${e.cleanseDebuffs || e.value || 1}${once}`;
  }
  if (e.type === "mutualHpThreshold") {
    const pctT = Math.round((e.threshold || 0.8) * 100);
    const parts = [];
    if (e.gainStack) {
      const gs = resolveGainStack(e.gainStack);
      parts.push(`+${gs.value} ${ttStack(gs.stack)}`);
    }
    if (e.damage) {
      parts.push(`${e.damage} \u043C\u0430\u0433. \u0443\u0440\u043E\u043D\u0430${e.lifesteal ? ` (\u043B\u0435\u0447\u0438\u0442 ${ttPct(e.lifesteal)} \u043E\u0442 \u0443\u0440\u043E\u043D\u0430)` : ""}`);
    }
    if (e.heal) parts.push(`\u043B\u0435\u0447\u0438\u0442 \u043D\u0430 ${e.heal} HP`);
    const body = parts.length ? `: ${parts.join(", ")}` : "";
    return `\u2764\uFE0F \u0415\u0441\u043B\u0438 \u0443 \u043E\u0431\u043E\u0438\u0445 <${pctT}% \u0437\u0434\u043E\u0440\u043E\u0432\u044C\u044F${body}${once}`;
  }
  if (e.type === "foeHpThreshold") {
    const pctT = Math.round((e.threshold || 0.5) * 100);
    const parts = [];
    if (e.heal) parts.push(`\u043B\u0435\u0447\u0438\u0442 \u043D\u0430 ${e.heal} HP`);
    if (e.gainDominantStack) parts.push(`+${e.gainDominantStack} \u043A \u0441\u0438\u043B\u044C\u043D\u0435\u0439\u0448\u0435\u043C\u0443 \u0431\u043E\u043D\u0443\u0441\u0443`);
    if (e.gainStack) {
      const gs = resolveGainStack(e.gainStack);
      parts.push(`+${gs.value} ${ttStack(gs.stack)}`);
    }
    const body = parts.length ? `: ${parts.join(", ")}` : "";
    return `\u2764\uFE0F \u0415\u0441\u043B\u0438 \u0443 \u043F\u0440\u043E\u0442\u0438\u0432\u043D\u0438\u043A\u0430 <${pctT}% \u0437\u0434\u043E\u0440\u043E\u0432\u044C\u044F${body}${once}`;
  }
  if (e.type === "hpThreshold") {
    const pctT = Math.round((e.threshold || 0.5) * 100);
    const dir = e.direction === "above" ? "\u0432\u044B\u0448\u0435" : "\u043D\u0438\u0436\u0435";
    const parts = [];
    if (e.heal) parts.push(`\u043B\u0435\u0447\u0438\u0442 \u043D\u0430 ${e.heal} HP`);
    if (e.cleanseDebuffs) parts.push(`\u0441\u043D\u0438\u043C\u0430\u0435\u0442 ${e.cleanseDebuffs} \u043D\u0435\u0433\u0430\u0442\u0438\u0432\u0430`);
    if (e.gainStack) {
      const gs = resolveGainStack(e.gainStack);
      parts.push(`+${gs.value} ${ttStack(gs.stack)}`);
    }
    const body = parts.length ? `: ${parts.join(", ")}` : "";
    return `\u2764\uFE0F \u0415\u0441\u043B\u0438 \u0437\u0434\u043E\u0440\u043E\u0432\u044C\u0435 ${dir} ${pctT}%${body}${once}`;
  }
  if (e.type === "stackThreshold") {
    const stack = e.stack || "heat";
    const label = ttStackLabel(stack, e.threshold, getStackLabel);
    const parts = [];
    if (e.weaponDamage) parts.push(`\u043E\u0440\u0443\u0436\u0438\u0435 +${e.weaponDamage} \u0443\u0440\u043E\u043D\u0430`);
    if (e.heal) parts.push(`\u043B\u0435\u0447\u0438\u0442 \u043D\u0430 ${e.heal} HP`);
    if (e.damage) parts.push(`${e.damage} \u0443\u0440\u043E\u043D\u0430`);
    if (e.gainStack) {
      const gs = resolveGainStack(e.gainStack);
      parts.push(`+${gs.value} ${ttStack(gs.stack)}`);
    }
    if (e.cleanseDebuffs) parts.push(`\u0441\u043D\u0438\u043C\u0430\u0435\u0442 ${e.cleanseDebuffs} \u043D\u0435\u0433\u0430\u0442\u0438\u0432\u0430`);
    const body = parts.length ? `: ${parts.join(", ")}` : "";
    return `\u{1F4CA} \u041F\u0440\u0438 ${e.threshold}+ ${label}${body}${once}`;
  }
  if (e.type === "activationThreshold") {
    const parts = [];
    if (e.heal) parts.push(`\u043B\u0435\u0447\u0438\u0442 \u043D\u0430 ${e.heal} HP`);
    if (e.gainStack) {
      const gs = resolveGainStack(e.gainStack);
      parts.push(`+${gs.value} ${ttStack(gs.stack)}`);
    }
    if (e.cleanseDebuffs) parts.push(`\u0441\u043D\u0438\u043C\u0430\u0435\u0442 ${e.cleanseDebuffs} \u043D\u0435\u0433\u0430\u0442\u0438\u0432\u0430`);
    if (e.foePoison) parts.push(`+${e.foePoison} \u044F\u0434\u0430`);
    const body = parts.length ? `: ${parts.join(", ")}` : "";
    return `\u{1F501} \u041F\u043E\u0441\u043B\u0435 ${e.count || e.threshold || 6} \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0439${body}`;
  }
  if (e.type === "heartThreshold") {
    return `\u{1F496} \u041F\u0440\u0438 ${e.count || 7} \u0441\u0435\u0440\u0434\u0446\u0430\u0445 \u2014 \u043E\u0441\u043E\u0431\u044B\u0439 \u0431\u043E\u043D\u0443\u0441`;
  }
  return null;
}
function describeOnDefendTooltip(e) {
  const ch = e.chance != null ? `${ttPct(e.chance)}` : "100%";
  const bits = [];
  if (e.preventDamage) bits.push(`\u0431\u043B\u043E\u043A\u0438\u0440\u0443\u0435\u0442 ${e.preventDamage} \u0443\u0440\u043E\u043D\u0430`);
  if (e.drainStamina) bits.push(`\u0437\u0430\u0431\u0438\u0440\u0430\u0435\u0442 ${e.drainStamina} \u0432\u044B\u043D\u043E\u0441\u043B\u0438\u0432\u043E\u0441\u0442\u0438 \u0443 \u0432\u0440\u0430\u0433\u0430`);
  if (!bits.length) return `\u{1F6E1} \u041F\u0440\u0438 \u0431\u043B\u043E\u043A\u0435 \u0438\u043B\u0438 \u0443\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0438 (${ch} \u0448\u0430\u043D\u0441)`;
  return `\u{1F6E1} \u041F\u0440\u0438 \u0431\u043B\u043E\u043A\u0435 \u0438\u043B\u0438 \u0443\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0438 (${ch} \u0448\u0430\u043D\u0441): ${bits.join(", ")}`;
}
