/**
 * Боевая статистика и форматирование результатов боя.
 */

function formatBattleTime(seconds) {
  const s = Math.max(0, seconds || 0);
  if (s < 60) return `${s.toFixed(1)}с`;
  const m = Math.floor(s / 60);
  const rest = (s % 60).toFixed(0);
  return `${m}:${rest.padStart(2, "0")}`;
}

function formatStatNumber(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function formatDamageTypeSplit(physical, magic) {
  const parts = [];
  if ((physical || 0) > 0) parts.push(`🗡 ${formatStatNumber(physical)} физ.`);
  if ((magic || 0) > 0) parts.push(`✨ ${formatStatNumber(magic)} маг.`);
  return parts.length ? parts.join(" · ") : "—";
}

function getItemExtraEffects(stat, def) {
  const extras = [];
  if (stat.synergyBonus) extras.push(stat.synergyBonus);
  if (stat.poisonApplied > 0) extras.push(`☠ Яд ×${stat.poisonApplied}`);
  if (stat.damageBlocked > 0) extras.push(`🛡 Поглощено ${formatStatNumber(stat.damageBlocked)}`);
  if (stat.blockDone > 0 && stat.damageDealt === 0 && stat.healingDone === 0 && !stat.damageBlocked) {
    extras.push(`🛡 Блок +${formatStatNumber(stat.blockDone)}`);
  }
  if (!extras.length && def?.effects?.length) {
    const passive = def.effects.find(
      (e) => e.trigger === "passive" || e.type.startsWith("passive"),
    );
    if (passive && stat.activations === 0) {
      if (passive.type === "passiveDefense") extras.push(`🦺 Защита +${passive.value}`);
      if (passive.type === "passiveMaxHp") extras.push(`❤ +${passive.value} HP`);
    }
    const speed = def.effects.find((e) => e.type === "statMult" && e.stat === "cooldown");
    if (speed && stat.activations > 0) extras.push("✨ Ускорение магии");
    const buff = def.effects.find((e) => e.type === "buffTimed");
    if (buff && stat.activations > 0) extras.push(`✨ Усиление на ${buff.duration || 5}с`);
  }
  return extras;
}

function createEmptyRunItemStats() {
  return { player: {}, enemy: {} };
}

function accumulateRunItemStats(runStats, itemDamageStats) {
  Object.values(itemDamageStats || {}).forEach((stat) => {
    const team = stat.team === "enemy" ? "enemy" : "player";
    const key = stat.itemId;
    if (!key) return;
    if (!runStats[team][key]) {
      const def = ITEM_CATALOG[key] || {};
      runStats[team][key] = {
        itemId: key,
        name: def.name || stat.name,
        icon: def.icon || stat.icon,
        damageDealt: 0,
        physicalDamageDealt: 0,
        magicDamageDealt: 0,
        healingDone: 0,
        blockDone: 0,
        damageBlocked: 0,
        poisonApplied: 0,
        activations: 0,
        team,
      };
    }
    const agg = runStats[team][key];
    agg.damageDealt += stat.damageDealt || 0;
    agg.physicalDamageDealt = (agg.physicalDamageDealt || 0) + (stat.physicalDamageDealt || 0);
    agg.magicDamageDealt = (agg.magicDamageDealt || 0) + (stat.magicDamageDealt || 0);
    agg.healingDone += stat.healingDone || 0;
    agg.blockDone += stat.blockDone || 0;
    agg.damageBlocked = (agg.damageBlocked || 0) + (stat.damageBlocked || 0);
    agg.poisonApplied += stat.poisonApplied || 0;
    agg.activations += stat.activations || 0;
  });
}

function runItemStatsToArrays(runStats) {
  const toList = (team) =>
    Object.values(runStats[team] || {}).sort(
      (a, b) => b.damageDealt - a.damageDealt || b.healingDone - a.healingDone,
    );
  return {
    player: toList("player"),
    enemy: toList("enemy"),
  };
}

function buildBattleSummary(state, meta) {
  const byTeam = (team) =>
    Object.values(state.itemDamageStats)
      .filter((s) => s.team === team)
      .sort((a, b) => b.damageDealt - a.damageDealt)
      .map((stat) => {
        const def = ITEM_CATALOG[stat.itemId] || {};
        return {
          ...stat,
          extraEffects: getItemExtraEffects(stat, def),
        };
      });

  const titles = { player: "Победа!", enemy: "Поражение", draw: "Ничья" };

  return {
    winner: state.winner,
    title: titles[state.winner] || "Бой завершён",
    roundNum: meta.roundNum,
    goldReward: meta.goldReward,
    battleTime: state.elapsed,
    player: {
      hp: Math.ceil(state.player.hp),
      maxHp: state.player.maxHp,
      damage: state.player.totalDamageDealt,
      physicalDamage: state.player.totalPhysicalDamageDealt || 0,
      magicDamage: state.player.totalMagicDamageDealt || 0,
      heal: state.player.totalHealingDone,
      block: state.player.totalDamageBlocked || state.player.totalBlockAbsorbed,
    },
    enemy: {
      hp: Math.ceil(state.enemy.hp),
      maxHp: state.enemy.maxHp,
      damage: state.enemy.totalDamageDealt,
      physicalDamage: state.enemy.totalPhysicalDamageDealt || 0,
      magicDamage: state.enemy.totalMagicDamageDealt || 0,
      heal: state.enemy.totalHealingDone,
      block: state.enemy.totalDamageBlocked || state.enemy.totalBlockAbsorbed,
    },
    playerItems: byTeam("player"),
    enemyItems: byTeam("enemy"),
  };
}
