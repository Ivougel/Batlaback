#!/usr/bin/env node
/**
 * Убирает stub-эффекты миграции и чинит cooldown: 0 у предметов с активируемыми эффектами.
 * Запуск после patch-battle-effects.py
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "items-migrated.json");

const ACTIVATABLE_TYPES = new Set([
  "damage",
  "heal",
  "block",
  "poison",
  "slow",
  "buffTimed",
  "lifesteal",
  "onHitCapBonus",
  "breakBlockOnHit",
  "selfPoison",
]);
const SKIP_TRIGGERS = new Set([
  "passive",
  "battle_start",
  "on_hit",
  "on_block",
  "on_miss",
  "on_defend",
  "on_revive",
  "on_foe_heal",
]);

function isActivatable(effect) {
  if (!effect?.type || !ACTIVATABLE_TYPES.has(effect.type)) return false;
  const trigger = effect.trigger || effect.phase;
  return !(trigger && SKIP_TRIGGERS.has(trigger));
}

function isStubDamage(effect, tags) {
  if (effect.type !== "damage") return false;
  if (tags.includes("weapon")) return false;
  const max = effect.valueMax ?? effect.value ?? 0;
  return max <= 3;
}

function hasPassiveBlockMechanic(effects) {
  return effects.some(
    (e) =>
      e.type === "shieldBlockMult" ||
      e.type === "passiveDefense" ||
      (e.type === "gainStack" && e.stack === "block" && (e.trigger === "battle_start" || e.trigger === "passive")),
  );
}

function parseCooldownFromDesc(desc) {
  const m = (desc || "").match(/(?:каждые|через)\s*([\d.,]+)\s*с/i);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

function main() {
  const data = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const items = data.items || data;
  let stripped = 0;
  let cdFixed = 0;

  for (const item of items) {
    if (item.protected || item.isContainer) continue;
    const tags = item.tags || [];
    let effects = [...(item.effects || [])];
    const hasPeriodic = effects.some((e) => e.type === "periodic");
    const hasThreshold = effects.some((e) => e.type === "activationThreshold");

    const beforeLen = effects.length;
    effects = effects.filter((effect) => {
      if (isStubDamage(effect, tags) && (hasPeriodic || hasThreshold || !tags.includes("weapon"))) {
        return false;
      }
      if (effect.type === "block" && isActivatable(effect) && hasPassiveBlockMechanic(effects)) {
        return false;
      }
      if (effect.type === "heal" && isActivatable(effect) && hasPeriodic) {
        const periodicHeal = effects.some((e) => e.type === "periodic" && (e.heal || e.healIfBelow));
        if (periodicHeal) return false;
      }
      return true;
    });
    stripped += beforeLen - effects.length;
    item.effects = effects;

    const activatable = effects.filter(isActivatable);
    const periodicInterval = effects.find((e) => e.type === "periodic")?.interval;
    const descCd = parseCooldownFromDesc(item.description);

    if (activatable.length === 0) {
      if (hasPeriodic && periodicInterval) {
        item.cooldown = periodicInterval;
      }
      continue;
    }

    if ((item.cooldown ?? 0) === 0) {
      item.cooldown = periodicInterval || descCd || (tags.includes("weapon") ? 2.5 : 3);
      cdFixed += 1;
    }
  }

  fs.writeFileSync(SRC, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`fix-broken-activations: removed ${stripped} stub effects, fixed ${cdFixed} zero cooldowns`);
}

main();
