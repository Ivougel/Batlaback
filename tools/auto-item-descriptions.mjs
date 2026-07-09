#!/usr/bin/env node
/**
 * Генерирует description из effects/synergies для предметов без текста.
 * node tools/auto-item-descriptions.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MIGRATED = path.join(ROOT, "tools/items-migrated.json");
const MANIFEST = path.join(ROOT, "tools/item-pool-120-manifest.json");

function dmgRange(e) {
  if (e.valueMin != null || e.valueMax != null) {
    return `${e.valueMin ?? e.value ?? "?"}–${e.valueMax ?? e.value ?? "?"}`;
  }
  return String(e.value ?? "?");
}

function triggerLabel(t) {
  const map = {
    on_hit: "при попадании",
    on_miss: "при промахе",
    on_block: "при блоке",
    on_defend: "при защите",
    on_revive: "при воскрешении",
    on_foe_heal: "когда враг лечится",
    battle_start: "в начале боя",
    passive: "пассивно",
    periodic: "периодически",
  };
  return map[t] || t || "";
}

function describeEffect(e) {
  const trig = e.trigger && e.trigger !== "passive" ? ` (${triggerLabel(e.trigger)})` : "";
  const pct = (v) => `${Math.round(Math.abs(v) * 100)}%`;
  switch (e.type) {
    case "damage":
      return `${e.damageType === "magic" ? "Магический удар" : "Удар"} ${dmgRange(e)} урона${trig}`;
    case "heal":
      return `Лечение ${e.value ?? "?"} HP${trig}`;
    case "block":
      return `Блок ${e.value ?? "?"}${trig}`;
    case "poison":
      return `Яд ${e.value ?? "?"}${trig}`;
    case "slow":
      return `Замедление ${e.value != null ? pct(e.value) : "?"}${trig}`;
    case "buffTimed":
      return `Баф +${pct(e.value)} урона на ${e.duration ?? "?"}с${trig}`;
    case "passiveMaxHp":
      return `+${e.value ?? "?"} макс. HP`;
    case "passiveDefense":
      return `+${e.value ?? "?"} защиты`;
    case "passiveLuck":
      return `+${e.value ?? "?"} удачи`;
    case "passiveMaxStamina":
      return `+${e.value ?? "?"} макс. стамины`;
    case "lifesteal":
      return `Вампиризм ${e.value != null ? pct(e.value) : "?"}${trig}`;
    case "lifestealPerTag":
      return `Вампиризм за тег «${e.tag ?? "?"}»${trig}`;
    case "crit":
      return `+${e.value ?? "?"}% крита${trig}`;
    case "critDamageMult":
      return `+${e.value != null ? pct(e.value) : "?"} урона крита`;
    case "gainStack":
      return `+${e.value ?? 1} стак «${e.stack ?? "?"}»${trig}`;
    case "spendStack":
      return `Тратит стак «${e.stack ?? "?"}»${trig}`;
    case "damagePerStack":
      return `+${e.value ?? "?"} урона за стак «${e.stack ?? "?"}»`;
    case "damagePerTag":
      return `+${e.value ?? "?"} урона за тег «${e.tag ?? "?"}»`;
    case "groundFire":
      return `Поджигает поле (${e.value ?? "?"} урона/с)`;
    case "applyStun":
      return `Оглушение ${e.duration ?? "?"}с${trig}`;
    case "stealWeaponDamage":
      return `Крадёт урон оружия врага${trig}`;
    case "cooldownMultPerTag":
      return `−${e.value != null ? pct(Math.abs(e.value)) : "?"} CD за тег «${e.tag ?? "?"}»`;
    case "cooldownMultPerAdjacent":
      return `−${e.value != null ? pct(Math.abs(e.value)) : "?"} CD соседям`;
    case "cooldownMultPerTotalStacks":
      return `−CD за общие стаки`;
    case "statMult":
      return `×${e.value ?? "?"} к ${e.stat ?? "стату"}`;
    case "stackThreshold":
      return `Бонус при ${e.threshold ?? "?"} стаках «${e.stack ?? "?"}»`;
    case "tagScaledStack":
      return `Стаки от тега «${e.tag ?? "?"}»`;
    case "revive":
      return `Воскрешение с ${e.value != null ? pct(e.value) : "?"} HP`;
    case "periodic":
      return `Каждые ${e.interval ?? e.value ?? "?"}с: эффект`;
    case "activationThreshold":
      return `Активация при ${e.threshold ?? "?"} срабатываниях`;
    case "activationLimit":
      return `Лимит ${e.limit ?? "?"} активаций за бой`;
    case "heartThreshold":
      return `Бонус при HP ниже ${e.threshold ?? "?"}%`;
    case "hpThreshold":
      return `Эффект при HP ${e.op ?? "<"} ${e.threshold ?? "?"}`;
    case "fatigueDamageOnHit":
      return `Урон растёт с усталостью врага${trig}`;
    case "critPerFoeFatigue":
      return `+крит за усталость врага`;
    case "destroyFoeStacks":
      return `Снимает стаки врага${trig}`;
    case "cleanseDebuffs":
      return `Снимает дебаффы${trig}`;
    case "invulnOnStaminaSpend":
      return `Неуязвимость при трате стамины`;
    case "repeatCast":
      return `Повтор активации (${e.chance != null ? pct(e.chance) : "?"})`;
    case "procChanceBonus":
      return `+${e.value != null ? pct(e.value) : "?"} шанс прока`;
    case "shieldBlockMult":
      return `×${e.value ?? "?"} эффективность блока`;
    case "breakBlockOnHit":
      return `Пробивает блок${trig}`;
    case "bonusDamageOnStun":
      return `+урон по оглушённому${trig}`;
    case "extraAttackOnStun":
      return `Доп. атака по оглушённому${trig}`;
    case "healPerTag":
      return `Лечение за тег «${e.tag ?? "?"}»`;
    case "maxHpPercentStart":
      return `+${e.value != null ? pct(e.value) : "?"} макс. HP в начале боя`;
    case "selfPoison":
    case "selfPoisonStart":
      return `Самояд ${e.value ?? "?"}`;
    default:
      return `${e.type}${e.value != null ? ` ${e.value}` : ""}${trig}`;
  }
}

function describeMeta(e) {
  switch (e.type) {
    case "gain_gold":
      return `+${e.value ?? "?"}💰`;
    case "offer_tag":
      return `Магазин: тег «${e.tag ?? "?"}»`;
    case "starting_value":
      return `Старт: +${e.value ?? "?"}`;
    case "max_hp_per_start_item":
      return `+HP за стартовый предмет`;
    default:
      return `мета: ${e.type}`;
  }
}

function describeItem(item) {
  const parts = [];
  for (const e of item.effects || []) {
    parts.push(describeEffect(e));
  }
  for (const e of item.metaEffects || []) {
    parts.push(describeMeta(e));
  }
  if (item.isContainer) {
    const slots = (item.internalCols || 0) * (item.internalRows || 0);
    parts.unshift(`+${slots} слотов рюкзака`);
    if (item.goldPerRound) parts.push(`+${item.goldPerRound}💰/раунд`);
  }
  if (item.defense) parts.unshift(`+${item.defense} защиты`);
  if (item.maxHp && !(item.effects || []).some((e) => e.type === "passiveMaxHp")) {
    parts.unshift(`+${item.maxHp} макс. HP`);
  }
  const syn = (item.synergies || [])
    .slice(0, 2)
    .map((s) => s.desc || s.apply?.type)
    .filter(Boolean);
  if (syn.length) parts.push(`Синергия: ${syn.join(", ")}`);
  return parts.filter(Boolean).join(". ").replace(/\.\./g, ".") + (parts.length ? "." : "");
}

export function autoDescribeItem(item) {
  const text = describeItem(item);
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const poolIds = new Set(manifest.items);
  const data = JSON.parse(fs.readFileSync(MIGRATED, "utf8"));
  let patched = 0;

  data.items.forEach((item) => {
    if (!poolIds.has(item.id)) return;
    if (item.description?.trim()) return;
    const text = autoDescribeItem(item);
    if (!text) return;
    item.description = text;
    patched += 1;
  });

  fs.writeFileSync(MIGRATED, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Авто-описания: +${patched} предметов`);
}

if (process.argv[1]?.endsWith("auto-item-descriptions.mjs")) {
  main();
}
