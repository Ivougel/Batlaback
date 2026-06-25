/**
 * Лог пересчёта стамины: старые vs новые cost и DPS.
 * Usage: node tools/verify-stamina-rebalance.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

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
  getItemStaminaCost,
  resolveDamageRange,
  itemHasActivatableEffects,
} = context;

const DAMAGE_PACING = context.DAMAGE_PACING_SCALE ?? 0.88;
const STAMINA_BASE_MAX = context.STAMINA_BASE_MAX ?? 40;
const STAMINA_REGEN = context.STAMINA_REGEN_PER_SEC ?? 5;
const STAMINA_WEAPON_REGEN = context.STAMINA_WEAPON_REGEN_BONUS ?? 1;

const OLD_STAMINA_SCALE = 1.12;
const OLD_REGEN_REF = 9 + 1;

function oldComputeCost(opts) {
  const tags = opts.tags || [];
  if (!tags.includes("weapon")) return 0;
  let cost = 0;
  (opts.effects || []).forEach((e) => {
    if (e.trigger === "passive") return;
    if (e.type === "damage") {
      cost = Math.max(cost, Math.round((e.valueMax ?? e.value ?? 1) * 1.15 + 3));
    }
    if (e.type === "poison") {
      cost = Math.max(cost, Math.round((e.value || 0) * 2.2 + 3));
    }
  });
  if (cost <= 0) cost = 5;
  return Math.max(1, Math.ceil(cost * OLD_STAMINA_SCALE));
}

function avgHitPaced(def) {
  let total = 0;
  (def.effects || []).forEach((e) => {
    if (e.trigger === "passive" || e.type !== "damage") return;
    const { min, max } = resolveDamageRange(e, def);
    total += ((min + max) / 2) * DAMAGE_PACING;
  });
  return total;
}

function classCdMult(classId) {
  if (classId === "rogue") return 0.9;
  return 1;
}

/**
 * Устойчивый APS с учётом пула и регена между ударами.
 * Долгосрочно: min(1/cd, regen/cost).
 * Пул влияет на burst: hitsBeforeEmpty = floor(pool/cost).
 */
function sustainableAps(staminaCost, cooldown, regen, pool = STAMINA_BASE_MAX) {
  if (staminaCost <= 0 || cooldown <= 0) return 1 / cooldown;
  const cdAps = 1 / cooldown;
  const regenAps = regen / staminaCost;
  if (regenAps >= cdAps) return cdAps;
  return regenAps;
}

function metrics(def, classId = "neutral") {
  const cd = (def.cooldown || 0) * classCdMult(classId);
  const hit = avgHitPaced(def);
  const idealAps = cd > 0 ? 1 / cd : 0;
  const dpsIdeal = hit * idealAps;
  const regen = STAMINA_REGEN + STAMINA_WEAPON_REGEN;
  const cost = getItemStaminaCost(def);
  const susAps = sustainableAps(cost, cd, regen);
  const dpsStamina = hit * susAps;
  const staminaLimited = cost > 0 && regen / cost < idealAps;
  const hitsBeforeEmpty = cost > 0 ? Math.floor(STAMINA_BASE_MAX / cost) : "";
  return {
    dpsIdeal: dpsIdeal ? +dpsIdeal.toFixed(2) : "",
    dpsStamina: dpsStamina ? +dpsStamina.toFixed(2) : "",
    staminaLimited,
    hitsBeforeEmpty,
    regen,
  };
}

const weapons = Object.values(ITEM_CATALOG)
  .filter((d) => d.tags?.includes("weapon") && itemHasActivatableEffects(d))
  .sort((a, b) => getItemStaminaCost(b) - getItemStaminaCost(a));

console.log("=== STAMINA REBALANCE ===");
console.log(`pool max base: ${STAMINA_BASE_MAX} | regen ref (1 weapon): ${STAMINA_REGEN}+${STAMINA_WEAPON_REGEN}=${STAMINA_REGEN + STAMINA_WEAPON_REGEN}/s`);
console.log("");
console.log(
  [
    "item".padEnd(22),
    "old⚡".padStart(5),
    "new⚡".padStart(5),
    "DPS ideal".padStart(10),
    "DPS cap".padStart(8),
    "lim".padStart(4),
    "burst".padStart(6),
  ].join(" | "),
);
console.log("-".repeat(72));

weapons.forEach((def) => {
  const oldCost = oldComputeCost(def);
  const newCost = getItemStaminaCost(def);
  const m = metrics(def, def.classRestriction || "neutral");
  const rogueM = def.id === "shadow_blade" ? metrics(def, "rogue") : null;
  const line = [
    def.name.slice(0, 22).padEnd(22),
    String(oldCost).padStart(5),
    String(newCost).padStart(5),
    String(m.dpsIdeal).padStart(10),
    String(rogueM ? rogueM.dpsStamina : m.dpsStamina).padStart(8),
    (rogueM ? rogueM.staminaLimited : m.staminaLimited) ? "yes" : "no",
    String(rogueM ? rogueM.hitsBeforeEmpty : m.hitsBeforeEmpty).padStart(6),
  ].join(" | ");
  console.log(line);
});

const checks = [
  ["dagger", "dagger"],
  ["falcon_blade", "falcon_blade"],
  ["shadow_blade", "shadow_blade"],
  ["war_hammer", "war_hammer"],
  ["knight_sword", "knight_sword"],
  ["eggscalibur", "eggscalibur"],
];

console.log("\n=== CHECKS ===");
checks.forEach(([id, label]) => {
  const def = ITEM_CATALOG[id];
  const cls = id === "shadow_blade" ? "rogue" : "neutral";
  const m = metrics(def, cls);
  const cost = getItemStaminaCost(def);
  console.log(
    `${label}: cost=${cost}, pool%=${Math.round((cost / STAMINA_BASE_MAX) * 100)}%, `
    + `regen-limited=${m.staminaLimited}, dpsIdeal=${m.dpsIdeal}, dpsCap=${m.dpsStamina}, burst=${m.hitsBeforeEmpty}`,
  );
});
