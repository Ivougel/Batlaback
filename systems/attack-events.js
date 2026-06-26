/**
 * AttackEvent — декoupled события атаки для визуального слоя.
 * Боевая логика не зависит от анимации: события создаются ПОСЛЕ расчёта эффекта.
 */

const ATTACK_VISUAL_CONFIG = {
  slash:  { attackType: "melee",      duration: 0.38, delay: 0.07 },
  arrow:  { attackType: "projectile", duration: 0.58, delay: 0.09 },
  bolt:   { attackType: "projectile", duration: 0.52, delay: 0.08 },
  magic:  { attackType: "magic",      duration: 0.68, delay: 0.11 },
  orb:    { attackType: "magic",      duration: 0.72, delay: 0.1 },
  aoe:    { attackType: "aoe",        duration: 0.48, delay: 0.06 },
  support:{ attackType: "support",    duration: 0.42, delay: 0.05 },
};

const ATTACK_TAG_VISUAL = [
  { tags: ["ranged", "bow"], visual: "arrow" },
  { tags: ["crossbow"], visual: "bolt" },
  { tags: ["staff", "magic"], visual: "magic" },
  { tags: ["fire"], visual: "orb" },
  { tags: ["melee"], visual: "slash" },
];

function resolveItemAttackVisual(def, effect = null) {
  if (!def) return "slash";
  if (def.attackVisual && ATTACK_VISUAL_CONFIG[def.attackVisual]) return def.attackVisual;
  if (effect?.damageType === "magic") return "magic";
  if (effect?.damageType === "fire") return "orb";
  if (effect?.type === "poison" || effect?.type === "slow" || effect?.type === "groundFire") return "aoe";
  if (effect?.type === "heal" || effect?.type === "block") return "support";
  const tags = def.tags || [];
  for (const rule of ATTACK_TAG_VISUAL) {
    if (rule.tags.some((t) => tags.includes(t))) return rule.visual;
  }
  if (tags.includes("weapon")) return tags.includes("ranged") ? "arrow" : "slash";
  return "support";
}

function resolveAttackTargetTeam(sourceTeam, effect, def) {
  const selfTypes = ["heal", "block"];
  if (effect && selfTypes.includes(effect.type)) return sourceTeam;
  const effects = def?.effects || [];
  const targetsFoe = effects.some((e) =>
    ["damage", "poison", "slow", "groundFire"].includes(e.type),
  );
  const targetsSelf = effects.some((e) => ["heal", "block"].includes(e.type));
  if (targetsSelf && !targetsFoe) return sourceTeam;
  return sourceTeam === "player" ? "enemy" : "player";
}

function buildAttackEvent(state, item, sourceTeam, effect, context = {}) {
  const def = ITEM_CATALOG[item.itemId];
  const visual = context.visual || resolveItemAttackVisual(def, effect);
  const cfg = ATTACK_VISUAL_CONFIG[visual] || ATTACK_VISUAL_CONFIG.slash;
  const targetTeam = context.targetTeam || resolveAttackTargetTeam(sourceTeam, effect, def);
  state._attackEventUid = (state._attackEventUid || 0) + 1;

  return {
    id: `atk-${state._attackEventUid}`,
    timestamp: state.elapsed || 0,
    sourceItemUid: item.uid,
    sourceItemId: item.itemId,
    sourceTeam,
    targetTeam,
    attackType: cfg.attackType,
    visual,
    icon: def?.icon || "⚔",
    damage: Math.max(0, context.damage || 0),
    damageType: context.damageType || effect?.damageType || "physical",
    duration: cfg.duration,
    delay: cfg.delay,
    effects: {
      crit: !!context.isCrit,
      miss: !!context.miss,
      poison: effect?.type === "poison",
      burn: effect?.damageType === "fire" || effect?.type === "groundFire",
      heal: effect?.type === "heal",
      block: effect?.type === "block",
      slow: effect?.type === "slow",
    },
  };
}

function emitAttackEvent(state, event) {
  if (!state || !event) return;
  if (typeof enqueueAttackVisual === "function") {
    enqueueAttackVisual(state, event);
  }
}

function emitEffectAttackVisual(state, item, sourceTeam, effect, context = {}) {
  if (!state || !item || !effect) return;
  emitAttackEvent(state, buildAttackEvent(state, item, sourceTeam, effect, context));
}
