/**
 * Генерация CSV для баланса (Google Sheets / Excel).
 * Usage: node tools/generate-balance-export.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(__dirname, "balance-export");

function loadScripts(context, files) {
  files.forEach((file) => {
    let code = fs.readFileSync(path.join(ROOT, file), "utf8");
    code = code.replace(/\bconst /g, "var ");
    code = code.replace(/\blet /g, "var ");
    vm.runInContext(code, context, { filename: file });
  });
}

const context = {
  console,
  Math,
  Date,
  Object,
  Array,
  Set,
  Map,
  JSON,
  uiPx: (value) => Math.round(value),
  queueItemAttackAnimation: () => {},
  queueItemFailedAnimation: () => {},
  queueStaminaSpendFeedback: () => {},
  queueHitAnimation: () => {},
  spawnBattleFloat: () => {},
  triggerProfileAvatarCritFlip: () => {},
  triggerProfileAvatarFatigueMirror: () => {},
  triggerProfileAvatarHitShake: () => {},
  initBattleAnimations: () => {},
  tickBattleAnimations: () => {},
  creditDotDamage: () => {},
};

vm.createContext(context);
loadScripts(context, ["classes.js", "items.js", "backpack-engine.js", "battle-engine.js"]);

const {
  ITEM_CATALOG,
  CLASS_CATALOG,
  getItemStaminaCost,
  resolveDamageRange,
  formatDamageRangeText,
  getClassById,
  createBattleSide,
  itemHasActivatableEffects,
} = context;

const DAMAGE_PACING = context.DAMAGE_PACING_SCALE ?? 0.88;
const STAMINA_BASE_MAX = context.STAMINA_BASE_MAX ?? 40;
const STAMINA_REGEN = context.STAMINA_REGEN_PER_SEC ?? 5;
const STAMINA_WEAPON_REGEN = context.STAMINA_WEAPON_REGEN_BONUS ?? 1;

function shapeSize(shape) {
  if (!shape?.length) return "";
  let minC = 9;
  let minR = 9;
  let maxC = 0;
  let maxR = 0;
  shape.forEach(([c, r]) => {
    minC = Math.min(minC, c);
    minR = Math.min(minR, r);
    maxC = Math.max(maxC, c);
    maxR = Math.max(maxR, r);
  });
  return `${maxC - minC + 1}×${maxR - minR + 1}`;
}

function classCdMult(classId) {
  const cls = getClassById(classId);
  if (cls?.combatBonus?.type === "attackSpeedMult") return 1 - cls.combatBonus.value;
  return 1;
}

function classMagicMult(classId) {
  const cls = getClassById(classId);
  if (cls?.combatBonus?.type === "magicDamageMult") return 1 + cls.combatBonus.value;
  return 1;
}

function itemCdMult(def) {
  let mult = 1;
  (def.effects || []).forEach((e) => {
    if (e.type === "statMult" && e.stat === "cooldown") mult *= 1 + e.value;
  });
  return mult;
}

function itemDamageMult(def) {
  let mult = 1;
  (def.effects || []).forEach((e) => {
    if (e.type === "statMult" && e.stat === "damage") mult *= 1 + e.value;
  });
  return mult;
}

function itemMagicMult(def) {
  let mult = 1;
  (def.effects || []).forEach((e) => {
    if (e.type === "statMult" && e.stat === "magicDamage") mult *= 1 + e.value;
  });
  return mult;
}

function pacedAvgDamage(effect, def, classId) {
  if (effect.type !== "damage") return 0;
  const { min, max } = resolveDamageRange(effect, def);
  let avg = ((min + max) / 2) * DAMAGE_PACING;
  if (effect.damageType === "magic") {
    avg *= itemMagicMult(def) * classMagicMult(classId);
  } else {
    avg *= itemDamageMult(def);
  }
  return avg;
}

function sustainableAps(staminaCost, cooldown, regen, pool = STAMINA_BASE_MAX) {
  if (staminaCost <= 0 || cooldown <= 0) return 1 / cooldown;
  const cdAps = 1 / cooldown;
  const regenAps = regen / staminaCost;
  if (regenAps >= cdAps) return cdAps;
  return regenAps;
}

function estimateItemMetrics(def, classId = "neutral", weaponCount = 1) {
  const cdBase = def.cooldown || 0;
  const effectiveCd = cdBase > 0 ? cdBase * classCdMult(classId) * itemCdMult(def) : 0;
  let directHit = 0;
  let healPerActivation = 0;

  (def.effects || []).forEach((e) => {
    if (e.trigger === "passive") return;
    if (e.type === "damage") directHit += pacedAvgDamage(e, def, classId);
    if (e.type === "heal") healPerActivation += e.value || 0;
  });

  const idealAps = effectiveCd > 0 ? 1 / effectiveCd : 0;
  const staminaCost = getItemStaminaCost(def);
  const regen = STAMINA_REGEN + weaponCount * STAMINA_WEAPON_REGEN;
  const susAps = sustainableAps(staminaCost, effectiveCd, regen);
  const hitsBeforeEmpty = staminaCost > 0 ? Math.floor(STAMINA_BASE_MAX / staminaCost) : "";

  return {
    effectiveCd: effectiveCd ? Math.round(effectiveCd * 100) / 100 : "",
    directHitAvg: directHit ? Math.round(directHit * 10) / 10 : "",
    dpsIdeal: directHit * idealAps ? Math.round(directHit * idealAps * 100) / 100 : "",
    dpsStamina: directHit * susAps ? Math.round(directHit * susAps * 100) / 100 : "",
    hpsIdeal: healPerActivation * idealAps ? Math.round(healPerActivation * idealAps * 100) / 100 : "",
    staminaCost,
    regenRef: regen,
    hitsBeforeEmpty,
    staminaLimited: staminaCost > 0 && regen / staminaCost < idealAps,
    activationsPerSec: idealAps ? Math.round(idealAps * 1000) / 1000 : "",
    sustainableAps: susAps ? Math.round(susAps * 1000) / 1000 : "",
  };
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  });
  return `\ufeff${lines.join("\n")}\n`;
}

function writeCsv(name, rows) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, name), toCsv(rows), "utf8");
}

const constants = [
  { key: "BASE_HP", value: 108, note: "Стартовое HP всех классов до предметов" },
  { key: "STAMINA_BASE_MAX", value: STAMINA_BASE_MAX, note: "Базовый пул выносливости" },
  { key: "STAMINA_REGEN_PER_SEC", value: STAMINA_REGEN, note: "Базовая регенерация" },
  { key: "STAMINA_WEAPON_REGEN_BONUS", value: STAMINA_WEAPON_REGEN, note: "+1/с за оружие с ⚡" },
  { key: "DAMAGE_PACING_SCALE", value: DAMAGE_PACING, note: "Множитель исходящего урона в бою" },
];

const classRows = Object.values(CLASS_CATALOG).map((cls) => {
  const side = createBattleSide(
    cls.starterItems.map((itemId, idx) => ({ uid: `s${idx}`, itemId, col: 0, row: 0 })),
    cls.id,
  );
  return {
    id: cls.id,
    name: cls.name,
    bonus: cls.desc,
    starter_items: cls.starterItems.join("; "),
    hp_start: side.maxHp,
    max_stamina: side.maxStamina,
    stamina_regen: side.staminaRegen,
    passive_armor: side.defense,
  };
});

const rarityOrder = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const itemRows = Object.values(ITEM_CATALOG)
  .filter((i) => !i.isContainer)
  .sort((a, b) => (rarityOrder[a.rarity] ?? 9) - (rarityOrder[b.rarity] ?? 9)
    || (a.cost ?? 0) - (b.cost ?? 0)
    || a.name.localeCompare(b.name, "ru"))
  .map((def) => {
    const m = estimateItemMetrics(def, def.classRestriction || "neutral", 1);
    const mRogue = def.classRestriction === "rogue" ? estimateItemMetrics(def, "rogue", 1) : null;
    return {
      id: def.id,
      name: def.name,
      rarity: def.rarity,
      cost: def.cost ?? 0,
      size: shapeSize(def.shape),
      cooldown: def.cooldown ?? 0,
      stamina_cost: m.staminaCost,
      dps_ideal: m.dpsIdeal,
      dps_stamina_capped: mRogue ? mRogue.dpsStamina : m.dpsStamina,
      regen_ref_1_weapon: m.regenRef,
      hits_before_empty: m.hitsBeforeEmpty,
      stamina_limited: m.staminaLimited ? "да" : "",
      activations_ideal_per_sec: m.activationsPerSec,
      activations_sustainable_per_sec: m.sustainableAps,
    };
  });

writeCsv("constants.csv", constants);
writeCsv("classes.csv", classRows);
writeCsv("items.csv", itemRows);

console.log(`Balance export → ${OUT_DIR}/`);
