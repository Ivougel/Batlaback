#!/usr/bin/env node
/**
 * Описания предметов для игроков 16+: понятный русский, без dev-жаргона.
 * node tools/humanize-item-descriptions.mjs [--apply] [--report tools/description-audit.json]
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MIGRATED = path.join(ROOT, "tools/items-migrated.json");
const CATALOG_GEN = path.join(ROOT, "tools/generate-items-catalog.js");

const STACK = {
  luck: "удача",
  block: "блок",
  spikes: "шип",
  heat: "жар",
  mana: "мана",
  regen: "реген",
  empower: "усиление",
  cold: "холод",
};

const TAG = {
  card: "карты",
  gem: "камни",
  pyromancer: "пиромант",
  fire: "огонь",
  ranger: "следопыт",
  pet: "питомцы",
  reaper: "жнец",
  adventurer: "авантюрист",
  treasure: "сокровища",
  berserker: "берсерк",
  food: "еда",
  potion: "зелья",
  bag: "сумки",
  vampiric: "вампиризм",
  cold: "холод",
  armor: "броня",
  weapon: "оружие",
  dark: "тёмный",
  holy: "святой",
  magic: "магия",
};

const THRESHOLD_TYPES = new Set([
  "debuffThreshold", "mutualHpThreshold", "foeHpThreshold", "hpThreshold",
  "stackThreshold", "activationThreshold", "heartThreshold",
]);

const GEM_SOCKET = {
  amethyst: {
    weapon: "может снять усиления у врага при ударе",
    accessory: "даёт ману",
    armor: "даёт сопротивление магии",
  },
  emerald: {
    weapon: "лечит при ударе",
    accessory: "увеличивает макс. здоровье",
    armor: "даёт регенерацию",
  },
  ruby: {
    weapon: "может дать жар при ударе",
    accessory: "увеличивает урон",
    armor: "защищает от холода",
  },
  sapphire: {
    weapon: "может наложить холод при ударе",
    accessory: "даёт удачу",
    armor: "даёт блок",
  },
  topaz: {
    weapon: "ускоряет атаки",
    accessory: "ускоряет предметы",
    armor: "быстрее восстанавливает выносливость",
  },
};

const CLASS = {
  mage: "маг",
  warrior: "воин",
  ranger: "следопыт",
  all: "любой класс",
};

function pct(v) {
  return `${Math.round(Math.abs(Number(v) || 0) * 100)}%`;
}

function fmtInterval(n) {
  const v = Math.max(0.5, Number(n) || 3);
  const r = Math.round(v * 10) / 10;
  const num = Number.isInteger(r) ? `${r}` : r.toFixed(1);
  return `${num} сек`;
}

function onceLabel(e) {
  return e?.once !== false ? ", один раз за бой" : "";
}

function dmgRange(e) {
  if (e.valueMin != null || e.valueMax != null) {
    return `${e.valueMin ?? e.value ?? "?"}–${e.valueMax ?? e.value ?? "?"}`;
  }
  return String(e.value ?? "?");
}

function stackWord(stack) {
  return STACK[stack] || stack || "бонус";
}

function dedupeEffects(effects) {
  const seen = new Set();
  return (effects || []).filter((e) => {
    const key = JSON.stringify(e);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tagWord(tag) {
  return TAG[tag] || tag || "?";
}

function triggerPrefix(trigger, phase) {
  const t = trigger || phase;
  if (t === "battle_start") return "В начале боя";
  if (t === "on_hit") return "При попадании";
  if (t === "on_miss") return "При промахе";
  if (t === "on_block") return "При блоке";
  if (t === "on_defend") return "При защите";
  if (t === "on_revive") return "При воскрешении";
  if (t === "on_foe_heal") return "Когда враг лечится";
  return null;
}

function statMultLine(e) {
  const v = Number(e.value) || 0;
  if (e.stat === "cooldown") {
    return v <= 0
      ? `Предметы перезаряжаются на ${pct(v)} быстрее`
      : `Предметы перезаряжаются на ${pct(v)} медленнее`;
  }
  if (e.stat === "magicDamage") return `+${pct(v)} к магическому урону`;
  if (e.stat === "heal") return `+${pct(v)} к лечению`;
  if (e.stat === "damage") return `+${pct(v)} к урону`;
  return `+${pct(v)} к ${e.stat || "характеристике"}`;
}

function describeDamage(e, trig) {
  const type = e.damageType;
  const label = type === "magic" ? "Магический удар" : type === "fire" ? "Огненный удар" : "Удар";
  const range = dmgRange(e);
  const suffix = trig ? ` ${trig.toLowerCase()}` : "";
  return `${label} ${range} урона${suffix}`;
}

function describeRandomPick(picks) {
  const parts = picks.map((pick) => {
    if (pick.heal) return `лечит на ${pick.heal} HP`;
    if (pick.foePoison) return `отравляет врага (${pick.foePoison})`;
    if (pick.gainStack) return `+${pick.gainStack.value || 1} ${stackWord(pick.gainStack.stack)}`;
    if (pick.block) return `+${pick.block} блока`;
    if (pick.cleanseDebuffs) return `снимает ${pick.cleanseDebuffs} негатива`;
    if (pick.restoreStamina) return `+${pick.restoreStamina} выносливости`;
    return "случайный бонус";
  });
  if (parts.length <= 1) return parts[0] || "случайный эффект";
  const last = parts.pop();
  return `случайно: ${parts.join(", ")} или ${last}`;
}

function describePeriodic(e, item) {
  const iv = fmtInterval(e.interval);
  const bits = [];

  if (e.randomPick?.length) bits.push(describeRandomPick(e.randomPick));
  if (e.gainWeakestStack) {
    const gw = e.gainWeakestStack === true ? {} : e.gainWeakestStack;
    let line = `+${gw.value || 1} к самому слабому бонусу`;
    if (gw.altStack && gw.minStack) {
      line += ` (удвоенная ${stackWord(gw.altStack)} при ${gw.minStack}+)`;
    }
    bits.push(line);
  }
  if (e.gainStack) {
    const gs = typeof e.gainStack === "object" ? e.gainStack : { stack: e.gainStack, value: 1 };
    const ch = e.chance != null && e.chance < 1 ? `${pct(e.chance)} ` : "";
    bits.push(`${ch}+${gs.value || 1} ${stackWord(gs.stack)}`);
  }
  if (e.gainAllStacks) bits.push(`+${e.gainAllStacks} ко всем бонусам`);
  if (e.cleanseDebuffs) {
    const ch = e.cleanseChance != null && e.cleanseChance < 1 ? `${pct(e.cleanseChance)} ` : "";
    bits.push(`${ch}снимает ${e.cleanseDebuffs} негатива`);
  }
  if (e.heal) bits.push(`лечит на ${e.heal} HP`);
  if (e.healIfBelow) bits.push(`лечит на ${e.healIfBelow} HP, если здоровье низкое`);
  if (e.damage) bits.push(`наносит ${e.damage} ${e.damageType === "magic" ? "магического " : ""}урона`);
  if (e.poison) bits.push(`+${e.poison} яда`);
  if (e.foePoison) bits.push(`отравляет врага (${e.foePoison})`);
  if (e.block) bits.push(`+${e.block} блока`);
  if (e.stealWeaponDamage) bits.push(`украсть ${e.stealWeaponDamage} урона у оружия врага`);
  if (e.drainFoeStamina) bits.push(`−${e.drainFoeStamina} выносливости врагу`);
  if (e.stripFoeStacksOnceEach) bits.push("снять по 1 бонусу каждого типа у врага");
  if (e.cooldownBoostItem) bits.push(`ускорить предмет на ${pct(e.cooldownBoostItem)}`);
  if (e.gainDominantStack) bits.push(`+${e.gainDominantStack} к самому сильному бонусу`);
  if (e.spendStack) bits.push(`тратит ${e.spendStack.value || 1} ${stackWord(e.spendStack.stack)}`);
  if (e.spendRandomStack) bits.push(`тратит ${e.spendRandomStack} случайный бонус`);
  if (e.lifesteal) bits.push(`лечит на ${pct(e.lifesteal)} от урона`);
  if (e.maxHp) bits.push(`+${e.maxHp} к макс. здоровью`);
  if (e.restoreStamina) bits.push(`+${e.restoreStamina} выносливости`);
  if (e.randomTimedBuff) bits.push("даёт случайное усиление");
  if (e.weaponDamageBonus) {
    bits.push(item?.isContainer ? `оружие внутри +${e.weaponDamageBonus} урона` : `оружие +${e.weaponDamageBonus} урона`);
  }
  if (e.stunEvery) bits.push(`оглушение ${e.stunDuration || 1}с каждые ${e.stunEvery} тика`);
  if (e.applyColdOrSelf) bits.push("+1 холод (себе или врагу)");
  if (e.gainHeart) bits.push(`+${e.gainHeart || 1} ❤`);

  if (!bits.length) return `Каждые ${iv} — особый эффект`;
  return `Каждые ${iv}: ${bits.join(", ")}`;
}

function describeMeta(e) {
  switch (e.type) {
    case "consume_recombo":
      return e.target === "inside"
        ? "В магазине перерабатывает содержимое сумки в новые предметы (по их общей цене)"
        : "В магазине перерабатывает себя и соседние предметы в новые (по их общей цене)";
    case "dig_item":
      return "В магазине выдаёт случайный предмет";
    case "generate_gem":
      return "В магазине даёт сколотый камень";
    case "generate_flame": {
      const ch = e.chance != null ? ` (${pct(e.chance)} шанс)` : "";
      return `В магазине${ch} создаёт предмет пламени за 1 золото`;
    }
    case "generate_worth":
      return `В магазине даёт случайный предмет за ${e.value || 1} золота`;
    case "gain_buff":
      return `В магазине даёт +${e.value || 1} усиление к следующему бою`;
    case "consume_inside_flame":
      return "В магазине превращает содержимое контейнера в пламя";
    case "exclude_player_class":
      return "В магазине не продаются стартовые предметы вашего класса";
    case "offer_tag":
      return `В магазине чаще встречаются предметы: ${tagWord(e.tag)}`;
    case "offer_class":
      return `В магазине чаще предметы класса «${CLASS[e.classId] || e.classId}»`;
    case "rarity_up":
      return "При обновлении витрины иногда повышает редкость товара";
    case "trade_offer": {
      const ch = e.chance != null ? `${pct(e.chance)} шанс: ` : "";
      return `При обновлении магазина ${ch}+${e.value || 3} золота`;
    }
    case "restock_tag": {
      const ch = e.chance != null ? `${pct(e.chance)} шанс ` : "";
      return `При покупке «${tagWord(e.tag)}» ${ch}дополняет витрину`;
    }
    case "restock_bag": {
      const ch = e.chance != null ? `${pct(e.chance)} шанс ` : "";
      return `При покупке сумки ${ch}та же сумка снова появляется в магазине`;
    }
    case "starting_value":
      return `+${e.value || 1} к стартовой ценности`;
    case "bag_slots":
      return `+${e.value || 1} слота в контейнере`;
    default:
      return null;
  }
}

function describeGem(item) {
  const m = String(item.id).match(/^(?:chipped|flawed|regular|flawless|perfect)_(amethyst|emerald|ruby|sapphire|topaz)$/);
  if (!m) return null;
  const sockets = GEM_SOCKET[m[1]];
  if (!sockets) return null;
  return `${item.name}. В оружии: ${sockets.weapon}. В аксессуаре: ${sockets.accessory}. В броне: ${sockets.armor}.`;
}

function isPassiveEffect(e) {
  if (e.type === "periodic" || THRESHOLD_TYPES.has(e.type)) return false;
  if (["onDefend", "attackBuff", "onHitCapBonus", "bonusDamageOnHit"].includes(e.type)) return false;
  return e.trigger === "passive" || e.type.startsWith("passive");
}

function isActivationEffect(e) {
  const tr = e.trigger || e.phase;
  return !tr && e.type !== "periodic" && !isPassiveEffect(e);
}

function describeEffect(e, item, { forActivation = false } = {}) {
  const trig = triggerPrefix(e.trigger, e.phase);
  const chance = e.chance != null && e.chance < 1 ? `${pct(e.chance)} ` : "";

  switch (e.type) {
    case "damage":
      return describeDamage(e, forActivation ? null : trig);
    case "heal":
      return forActivation || !trig ? `Лечение ${e.value} HP` : `${trig}: лечение ${e.value} HP`;
    case "block":
      return forActivation || !trig ? `Блок ${e.value}` : `${trig}: блок ${e.value}`;
    case "poison":
      if (trig) {
        const body = e.chance != null && e.chance < 1
          ? `${pct(e.chance)} шанс: +${e.value} яда`
          : `+${e.value} яда`;
        return `${trig}: ${body}`;
      }
      if (e.chance != null && e.chance < 1) return `${pct(e.chance)} шанс: +${e.value} яда`;
      return `Накладывает ${e.value} яда`;
    case "slow":
      return trig
        ? `${trig}: замедляет на ${pct(e.value)} на ${e.duration || 3} сек`
        : `Замедляет на ${pct(e.value)} на ${e.duration || 3} сек`;
    case "buffTimed": {
      const stat = e.stat === "damage" ? "урона" : (e.stat || "урона");
      const dur = `${e.duration || 3} сек`;
      return forActivation || !trig
        ? `+${pct(e.value)} ${stat} на ${dur}`
        : `${trig}: +${pct(e.value)} ${stat} на ${dur}`;
    }
    case "passiveMaxHp":
      return `+${e.value} к макс. здоровью`;
    case "passiveDefense":
      return `+${e.value} защиты`;
    case "passiveLuck":
      return `+${e.value} удачи`;
    case "passiveMaxStamina":
      return `+${e.value} макс. выносливости`;
    case "statMult":
      return statMultLine(e);
    case "lifesteal":
      return `Лечит на ${pct(e.value)} от нанесённого урона`;
    case "lifestealPerTag":
      return `+${pct(e.value)} к лечению от урона за каждый предмет «${tagWord(e.tag)}»`;
    case "shieldBreakBonus":
      return `+${pct(e.value)} пробивания блока`;
    case "shieldBlockMult":
      return `+${pct(e.value)} эффективности блока`;
    case "groundFire":
      return `Поджигает поле (${e.value} урона в секунду)`;
    case "dodgePeriodic":
      return `Уклонение каждые ${fmtInterval(e.interval || 5)}`;
    case "extraAttackOnStun":
      return "Дополнительная атака по оглушённому противнику";
    case "bonusDamageOnStun":
      return `+${e.value || 1} урона по оглушённому`;
    case "applyStun":
      return `${trig ? `${trig}: ` : ""}${chance}оглушает на ${e.duration || 0.5} сек`.trim();
    case "gainStack": {
      const when = trig || (e.trigger === "battle_start" ? "В начале боя" : null);
      const line = `+${e.value || 1} ${stackWord(e.stack)}`;
      return when ? `${when}: ${line}` : line;
    }
    case "spendStack": {
      const parts = [`тратит ${e.value || 1} ${stackWord(e.stack)}`];
      if (e.attackBuff) parts.push(`следующая атака +${e.attackBuff} урона`);
      if (e.heal) parts.push(`лечит на ${e.heal} HP`);
      const body = parts.join(", ");
      return forActivation ? `При активации: ${body}` : (trig ? `${trig}: ${body}` : body);
    }
    case "damagePerStack":
      return `+${e.value || 1} урона за каждый ${stackWord(e.stack)}`;
    case "damagePerTag":
      return `+${e.value || 1} урона за каждый предмет «${tagWord(e.tag)}»`;
    case "damagePerFoeDebuff":
      return `+${e.value || 0.5} урона за каждый негатив на враге`;
    case "damagePerTotalStacks":
      return `+${e.value || 1} урона за каждый бонус на панели`;
    case "crit":
      return `+${pct(e.chance || e.value || 0)} шанс крита${trig ? ` ${trig.toLowerCase()}` : ""}`;
    case "critDamageMult":
      return `+${pct(e.value)} крит. урона`;
    case "critPerStack":
      return `+${pct(e.value)} крита за ${stackWord(e.stack)}`;
    case "critPerFoeDebuff":
      return `+${pct(e.value)} к шансу крита за негатив на враге`;
    case "weaponDamageStart":
      return `В начале боя: оружие +${e.value || 0} урона`;
    case "periodic":
      return describePeriodic(e, item);
    case "stackThreshold": {
      const parts = [`При ${e.threshold}+ ${stackWord(e.stack)}`];
      if (e.weaponDamage) parts.push(`оружие +${e.weaponDamage} урона`);
      if (e.heal) parts.push(`+${e.heal} HP`);
      if (e.damage) parts.push(`${e.damage} урона`);
      if (e.critChance) parts.push(`+${pct(e.critChance)} крит`);
      if (e.gainStack) parts.push(`+${e.gainStack.value} ${stackWord(e.gainStack.stack)}`);
      if (e.cleanseDebuffs) parts.push(`снимает ${e.cleanseDebuffs} негатива`);
      const suffix = onceLabel(e);
      return parts.slice(0, 1).join("") + (parts.length > 1 ? `: ${parts.slice(1).join(", ")}` : "") + suffix;
    }
    case "hpThreshold": {
      const pctT = Math.round((e.threshold || 0.5) * 100);
      const dir = e.direction === "above" ? "выше" : "ниже";
      const parts = [];
      if (e.heal) parts.push(`лечит на ${e.heal} HP`);
      if (e.cleanseDebuffs) parts.push(`снимает ${e.cleanseDebuffs} негатива`);
      if (e.gainStack) parts.push(`+${e.gainStack.value} ${stackWord(e.gainStack.stack)}`);
      const body = parts.length ? `: ${parts.join(", ")}` : "";
      return `Если здоровье ${dir} ${pctT}%${body}${onceLabel(e)}`;
    }
    case "foeHpThreshold": {
      const pctT = Math.round((e.threshold || 0.5) * 100);
      const parts = [];
      if (e.heal) parts.push(`лечит на ${e.heal} HP`);
      if (e.gainDominantStack) parts.push(`+${e.gainDominantStack} к самому сильному бонусу`);
      if (e.gainStack) parts.push(`+${e.gainStack.value} ${stackWord(e.gainStack.stack)}`);
      const body = parts.length ? `: ${parts.join(", ")}` : "";
      return `Если у противника меньше ${pctT}% здоровья${body}${onceLabel(e)}`;
    }
    case "debuffThreshold":
      return `При ${e.threshold || 10}+ негативах снимает ${e.cleanseDebuffs || e.value || 1}${onceLabel(e)}`;
    case "mutualHpThreshold": {
      const pctT = Math.round((e.threshold || 0.8) * 100);
      const parts = [];
      if (e.gainStack) parts.push(`+${e.gainStack.value} ${stackWord(e.gainStack.stack)}`);
      if (e.damage) {
        parts.push(`${e.damage} магического урона${e.lifesteal ? ` (лечит на ${pct(e.lifesteal)} от урона)` : ""}`);
      }
      if (e.heal) parts.push(`лечит на ${e.heal} HP`);
      const body = parts.length ? `: ${parts.join(", ")}` : "";
      return `Если у обоих меньше ${pctT}% здоровья${body}${onceLabel(e)}`;
    }
    case "activationThreshold": {
      const parts = [];
      if (e.heal) parts.push(`+${e.heal} HP`);
      if (e.gainStack) parts.push(`+${e.gainStack.value} ${stackWord(e.gainStack.stack)}`);
      if (e.cleanseDebuffs) parts.push(`снимает ${e.cleanseDebuffs} негатива`);
      if (e.maxHp) parts.push(`+${e.maxHp} макс. HP`);
      if (e.restoreStamina) parts.push(`+${e.restoreStamina} выносливости`);
      if (e.foePoison) parts.push(`+${e.foePoison} яда`);
      const body = parts.length ? `: ${parts.join(", ")}` : "";
      return `После ${e.count || e.threshold || 6} активаций${body}`;
    }
    case "attackBuff":
      return `${trig || "При промахе"}: следующая атака сильнее на ${e.value || 1}`;
    case "onDefend": {
      const ch = e.chance != null ? pct(e.chance) : "100%";
      const bits = [];
      if (e.preventDamage) bits.push(`блокирует ${e.preventDamage} урона`);
      if (e.drainStamina) bits.push(`забирает ${e.drainStamina} выносливости у врага`);
      return `При блоке или уклонении (${ch} шанс): ${bits.join(", ")}`;
    }
    case "onHitCapBonus":
      return `${pct(e.chance ?? 1)} шанс: +${e.value || 1} урона (макс. +${e.cap || "?"})`;
    case "bonusDamageOnHit":
      return `${pct(e.chance ?? 1)} шанс: +${e.value || 1} урона`;
    case "heartThreshold":
      return `При ${e.count || 7} сердцах срабатывает особый эффект`;
    case "stealRandomStack":
      return `${trig ? `${trig}: ` : ""}${chance}крадёт ${e.value || 1} бонус у врага`.trim();
    case "stealWeaponDamage":
      return `${trig ? `${trig}: ` : ""}украсть ${e.value || 1} урона у оружия врага`.trim();
    case "destroyFoeStacks":
      return `Уничтожить ${e.value || 4} бонусов у врага`;
    case "cleanseDebuffs":
      return `Снимает ${e.value || e.cleanseDebuffs || 1} негатива`;
    case "timedDamageReduction":
      return `${trig || "В начале боя"}: получает на ${pct(e.value)} меньше урона на ${e.duration || 3} сек`;
    case "cooldownStartMult":
      return `Предметы на ${pct(Math.abs(e.value))} быстрее`;
    case "cooldownMultPerTag": {
      const tags = (e.tags || [e.tag]).map(tagWord).join("/");
      const bonus = pct(Math.abs(e.perTag || e.value || 0.15));
      if (item.isContainer && (e.tags || []).includes("bag")) {
        return `Предметы внутри на ${bonus} быстрее`;
      }
      return `На ${bonus} быстрее за «${tags}»`;
    }
    case "cooldownMultPerAdjacent":
      return `На ${pct(Math.abs(e.perAdjacent || e.value || 0.1))} быстрее за соседа`;
    case "cooldownMultPerItemCost":
      return `На ${pct(Math.abs(e.perCost || 0.01))} быстрее за стоимость предметов`;
    case "cooldownMultPerSocket":
      return `На ${pct(Math.abs(e.perSocket || 0.03))} быстрее за сокет`;
    case "cooldownMultPerTotalStacks":
      return `На ${pct(Math.abs(e.perStack || 0.05))} быстрее за каждый бонус на панели`;
    case "tagScaledStack":
      return `+${e.perTag || e.value || 1} ${stackWord(e.stack)} за «${tagWord(e.tag)}»`;
    case "tagScaledMaxHp":
      return `+${e.perTag || 40} макс. HP за «${tagWord(e.tag)}»`;
    case "neutralScaledStack":
      return `+${e.perItem || 8} ${stackWord(e.stack || "heat")} за нейтральный предмет`;
    case "cardScaledBonus":
      return `+${e.perCard || 5} ${stackWord(e.stack || "luck")} за карту`;
    case "cardScaledDamage":
      return `Маг. удар ${e.base || 12} (+${e.perCard || 4}/карта)`;
    case "healPerTag":
      return `+${e.value || 1} лечения за ${e.adjacent ? "соседний " : ""}«${tagWord(e.tag)}»`;
    case "healAsDamageMult":
      return `Лечение наносит ${pct(e.value)} магического урона`;
    case "stackGainMult":
      return `Бонусы на панели на ${pct(e.value)} эффективнее`;
    case "maxHpPercentStart":
      return `+${pct(e.value)} к макс. здоровью в начале боя`;
    case "max_hp_per_start_item":
      return `+${e.value || 2} макс. HP за стартовый предмет`;
    case "zeroStamina":
      return `При нулевой выносливости: +${e.restoreStamina || 2} выносливости${e.gainStack ? ` и +${e.gainStack.value} ${stackWord(e.gainStack.stack)}` : ""}`;
    case "invulnOnStaminaSpend":
      return `Потратить ${e.staminaCost || 10} выносливости — неуязвимость на ${e.duration || 2} сек`;
    case "revive":
      return `Воскресает с ${pct(e.hpRatio || e.value || 0.5)} здоровья`;
    case "stonesMultiThrow":
      return "Камни можно бросать много раз";
    case "procChanceBonus":
      return `На ${pct(e.value)} чаще срабатывают эффекты предметов`;
    case "battleRageLowHp":
      return "Боевая ярость (<50% HP): −урон, быстрее предметы";
    case "repeatCast":
      return `Повтор магии (${pct(e.chance || 1)})`;
    case "onFoeHeal":
      return `Когда враг лечится: +${e.poison || e.value || 1} яда ему`;
    case "selfPoison":
    case "selfPoisonStart":
      return `${trig || "В начале боя"}: +${e.value || 1} яда себе`;
    case "synergyHint":
      return e.text || e.desc || null;
    case "activationLimit":
      return `До ${e.base || e.limit || 3} активаций за бой`;
    default:
      return null;
  }
}

function describeActivationBundle(effects, item) {
  const gain = effects.find((e) => e.type === "gainStack");
  const spend = effects.find((e) => e.type === "spendStack");
  const dmg = effects.find((e) => e.type === "damage");
  const heal = effects.find((e) => e.type === "heal");
  const block = effects.find((e) => e.type === "block");
  const buff = effects.find((e) => e.type === "buffTimed");
  const slow = effects.find((e) => e.type === "slow");

  if (spend) {
    const parts = [describeEffect(spend, item, { forActivation: true }).replace(/^Активация: /, "")];
    if (dmg) parts.push(describeDamage(dmg));
    if (heal) parts.push(`+${heal.value} HP`);
    return `При активации: ${parts.join(" и ")}`;
  }

  if (gain && !spend && !dmg) {
    return `При активации: +${gain.value || 1} ${stackWord(gain.stack)}`;
  }

  const simple = [];
  if (dmg) simple.push(describeDamage(dmg));
  if (heal) simple.push(`лечение ${heal.value} HP`);
  if (block) simple.push(`блок ${block.value}`);
  if (buff) simple.push(`+${pct(buff.value)} урона на ${buff.duration || 3} сек`);
  if (slow) simple.push(`замедление ${pct(slow.value)}`);

  if (simple.length === 1 && (heal || block)) {
    return heal ? `Лечение ${heal.value} HP.` : `Блок ${block.value}.`;
  }
  if (simple.length) return simple.join(". ");
  return null;
}

export function humanizeItemDescription(item) {
  const gem = describeGem(item);
  if (gem) return gem;

  const lines = [];
  const effects = dedupeEffects(item.effects || []);
  const meta = item.metaEffects || [];

  if (item.defense) lines.push(`+${item.defense} защиты`);
  if (item.maxHp && !effects.some((e) => e.type === "passiveMaxHp")) {
    lines.push(`+${item.maxHp} макс. HP`);
  }

  if (item.isContainer) {
    const slots = (item.internalCols || 0) * (item.internalRows || 0);
    if (slots > 0) lines.push(`+${slots} слотов рюкзака`);
    if (item.goldPerRound) lines.push(`+${item.goldPerRound}💰/раунд`);
  }

  const used = new Set();

  effects.forEach((e, i) => {
    if (e.type === "periodic" || isPassiveEffect(e) || isActivationEffect(e)) return;
    if (THRESHOLD_TYPES.has(e.type)) return;
    const line = describeEffect(e, item);
    if (line) { lines.push(line); used.add(i); }
  });

  effects.forEach((e, i) => {
    if (!isPassiveEffect(e) || used.has(i)) return;
    if (e.type === "periodic") return;
    const line = describeEffect(e, item);
    if (line) { lines.push(line); used.add(i); }
  });

  effects.forEach((e, i) => {
    if (e.type !== "periodic" || used.has(i)) return;
    lines.push(describePeriodic(e, item));
    used.add(i);
  });

  [...THRESHOLD_TYPES].forEach((type) => {
    effects.filter((e) => e.type === type).forEach((e) => {
      const line = describeEffect(e, item);
      if (line) lines.push(line);
    });
  });

  const activationFx = effects.filter((e, i) => !used.has(i) && isActivationEffect(e));
  if (activationFx.length) {
    const bundle = describeActivationBundle(activationFx, item);
    if (bundle) lines.push(bundle.replace(/\.$/, ""));
    else activationFx.forEach((e) => {
      const line = describeEffect(e, item, { forActivation: true });
      if (line) lines.push(line);
    });
  }

  const shopMeta = meta.filter((e) => String(e.phase || "").startsWith("shop") || e.phase === "passive");
  shopMeta.forEach((e) => {
    const line = describeMeta(e);
    if (line) lines.push(line);
  });

  if (item.isContainer && item.id === "offering_bowl") {
    lines.push("Содержимое можно переработать в магазине");
  }

  // Бой → магазин: сначала боевые эффекты, потом мета
  const battleLines = [];
  const shopLines = [];
  lines.forEach((line) => {
    if (/^В магазине|^При обновлении магазина|^При покупке/.test(line)) shopLines.push(line);
    else battleLines.push(line);
  });

  const text = [...battleLines, ...shopLines].filter(Boolean).join(". ").replace(/\s+/g, " ").replace(/\.\./g, ".");
  return text ? `${text}.` : "";
}

function main() {
  const apply = process.argv.includes("--apply");
  const reportPath = process.argv.find((a) => a.startsWith("--report="))?.slice(9)
    || path.join(ROOT, "tools/description-humanize-report.json");

  const data = JSON.parse(fs.readFileSync(MIGRATED, "utf8"));
  const report = {
    generatedAt: new Date().toISOString(),
    total: data.items.length,
    changed: [],
    unchanged: [],
    empty: [],
  };

  data.items.forEach((item) => {
    const before = (item.description || "").trim();
    const after = humanizeItemDescription(item).trim();
    if (!after) {
      report.empty.push({ id: item.id, name: item.name, before });
      return;
    }
    if (before === after) {
      report.unchanged.push(item.id);
    } else {
      report.changed.push({ id: item.id, name: item.name, before, after });
      if (apply) item.description = after;
    }
  });

  report.summary = {
    changed: report.changed.length,
    unchanged: report.unchanged.length,
    empty: report.empty.length,
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (apply) {
    fs.writeFileSync(MIGRATED, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    if (fs.existsSync(CATALOG_GEN)) {
      execSync(`node ${CATALOG_GEN}`, { stdio: "inherit" });
    }
  }

  console.log(`Описания: изменено ${report.summary.changed}, без изменений ${report.summary.unchanged}, пусто ${report.summary.empty}`);
  console.log(`Отчёт: ${reportPath}`);
  if (!apply) console.log("Запустите с --apply для записи в items-migrated.json");
}

if (process.argv[1]?.endsWith("humanize-item-descriptions.mjs")) {
  main();
}
