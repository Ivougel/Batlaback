/**
 * Tower Defense — 99 волн свиней к герою в центре.
 * Использует предметы и статы героя из battle-engine.
 */

const TD_MAX_WAVES = 99;
const TD_PIG_EMOJI = "🐷";
const TD_CENTER = { x: 0.5, y: 0.5 };
const TD_SPAWN_INTERVAL = 0.55;
const TD_WAVE_BREAK = 1.2;
const TD_MAX_ACTIVATIONS_PER_TICK = 3;

/** Четыре тропинки с краёв к центру (нормализованные координаты). */
const TD_PATHS = [
  [{ x: 0.5, y: 0.06 }, { x: 0.5, y: 0.32 }, { x: 0.5, y: 0.5 }],
  [{ x: 0.94, y: 0.5 }, { x: 0.68, y: 0.5 }, { x: 0.5, y: 0.5 }],
  [{ x: 0.5, y: 0.94 }, { x: 0.5, y: 0.68 }, { x: 0.5, y: 0.5 }],
  [{ x: 0.06, y: 0.5 }, { x: 0.32, y: 0.5 }, { x: 0.5, y: 0.5 }],
];

function tdLerpPath(pathId, t) {
  const path = TD_PATHS[pathId % TD_PATHS.length];
  if (t <= 0) return { x: path[0].x, y: path[0].y };
  if (t >= 1) return { x: path[path.length - 1].x, y: path[path.length - 1].y };
  const segLen = 1 / (path.length - 1);
  const segIdx = Math.min(path.length - 2, Math.floor(t / segLen));
  const localT = (t - segIdx * segLen) / segLen;
  const a = path[segIdx];
  const b = path[segIdx + 1];
  return {
    x: a.x + (b.x - a.x) * localT,
    y: a.y + (b.y - a.y) * localT,
  };
}

function tdPigSizeScale(strength) {
  return 0.5 + (strength / 100) * 2.2;
}

function tdWavePigCount(wave) {
  return Math.min(3 + Math.floor(wave * 0.32), 26);
}

/** Сила свиньи 1–100: растёт с волной + случайный разброс. */
function tdRollPigStrength(wave, rng) {
  const base = 8 + wave * 0.85;
  const spread = rng() * 18 + (wave > 50 ? rng() * 12 : 0);
  return Math.min(100, Math.round(base + spread));
}

function tdPigHp(strength, wave) {
  return Math.round(6 + strength * 0.55 + wave * 0.4);
}

function tdPigDamage(strength) {
  return Math.round(2 + strength * 0.22);
}

function tdPigSpeed(strength, wave) {
  const base = 0.055 + wave * 0.00035;
  const slow = strength > 60 ? (strength - 60) * 0.00008 : 0;
  return Math.min(0.14, base - slow);
}

function buildWaveSpawnQueue(wave, rng = Math.random) {
  const count = tdWavePigCount(wave);
  const queue = [];
  for (let i = 0; i < count; i++) {
    const strength = tdRollPigStrength(wave, rng);
    queue.push({
      pathId: i % 4,
      delay: i * TD_SPAWN_INTERVAL,
      strength,
      maxHp: tdPigHp(strength, wave),
      damage: tdPigDamage(strength),
      speed: tdPigSpeed(strength, wave),
    });
  }
  return queue;
}

function cloneTdBattleItem(item) {
  const def = ITEM_CATALOG[item.itemId];
  if (!def || def.isContainer) return null;
  const hasOffense = (def.effects || []).some((e) =>
    e.type === "damage" || e.type === "poison" || e.type === "groundFire",
  );
  const hasSupport = (def.effects || []).some((e) =>
    e.type === "heal" || e.type === "block" || e.type === "grantBlockBuff",
  );
  if (!hasOffense && !hasSupport) return null;

  const cd = def.cooldown || 2.5;
  return {
    uid: item.uid,
    itemId: item.itemId,
    cooldown: cd,
    timer: cd * (0.3 + Math.random() * 0.5),
    damageBonus: item.runtime?.damageBonus || 0,
    blockSourceEfficiency: item.runtime?.blockSourceEfficiency ?? 1,
    healSourceEfficiency: item.runtime?.healSourceEfficiency ?? 1,
  };
}

function createTdState(playerItems, classId, waveNum, prepMeta = {}) {
  const hero = createBattleSide(playerItems, classId, prepMeta.player || prepMeta);
  const attackItems = hero.items
    .map(cloneTdBattleItem)
    .filter(Boolean);

  if (!attackItems.length) {
    attackItems.push({
      uid: "td-fallback",
      itemId: "rusty_sword",
      cooldown: 1.8,
      timer: 0.5,
      damageBonus: 0,
      blockSourceEfficiency: 1,
      healSourceEfficiency: 1,
    });
  }

  const spawnQueue = buildWaveSpawnQueue(waveNum);
  const totalSpawnDelay = spawnQueue.length > 0
    ? spawnQueue[spawnQueue.length - 1].delay + TD_SPAWN_INTERVAL
    : 0;

  return {
    mode: "td",
    wave: waveNum,
    hero,
    classId,
    pigs: [],
    attackItems,
    spawnQueue,
    spawnElapsed: 0,
    totalSpawnDelay,
    wavePhase: "spawning",
    breakTimer: 0,
    elapsed: 0,
    finished: false,
    winner: null,
    pigsKilled: 0,
    pigsLeaked: 0,
    totalPigs: spawnQueue.length,
    events: [],
    log: [],
    itemDamageStats: {},
    nextPigId: 1,
    attackFx: [],
  };
}

function tdRecordItemDamage(state, itemId, amount) {
  const key = `player:${itemId}`;
  if (!state.itemDamageStats[key]) {
    state.itemDamageStats[key] = { team: "player", itemId, damageDealt: 0, activations: 0 };
  }
  state.itemDamageStats[key].damageDealt += amount;
  state.itemDamageStats[key].activations += 1;
}

function tdPickTargetPig(pigs) {
  if (!pigs.length) return null;
  let best = pigs[0];
  for (const pig of pigs) {
    if (pig.t > best.t) best = pig;
  }
  return best;
}

function tdApplyItemActivation(state, atkItem) {
  const def = ITEM_CATALOG[atkItem.itemId];
  if (!def) return;
  const hero = state.hero;
  let didSomething = false;

  (def.effects || []).forEach((eff) => {
    if (eff.type === "damage") {
      const target = tdPickTargetPig(state.pigs);
      if (!target) return;
      const base = typeof getEffectAverageDamage === "function"
        ? getEffectAverageDamage(eff, def)
        : (eff.value || 3);
      const dmg = Math.max(1, Math.round((base + atkItem.damageBonus) * (hero.damageMult || 1)));
      target.hp -= dmg;
      tdRecordItemDamage(state, atkItem.itemId, dmg);
      state.attackFx.push({
        itemId: atkItem.itemId,
        icon: def.icon,
        targetId: target.id,
        damage: dmg,
        ttl: 0.35,
      });
      if (target.hp <= 0) {
        state.pigs = state.pigs.filter((p) => p.id !== target.id);
        state.pigsKilled += 1;
      }
      didSomething = true;
    } else if (eff.type === "heal") {
      const base = eff.value || 4;
      const heal = Math.round(base * (atkItem.healSourceEfficiency || 1));
      hero.hp = Math.min(hero.maxHp, hero.hp + heal);
      hero.totalHealingDone = (hero.totalHealingDone || 0) + heal;
      didSomething = true;
    } else if (eff.type === "block" || eff.type === "grantBlockBuff") {
      const base = eff.value || 3;
      const block = Math.round(base * (atkItem.blockSourceEfficiency || 1));
      hero.block = (hero.block || 0) + block;
      didSomething = true;
    }
  });

  if (didSomething) {
    atkItem.timer = atkItem.cooldown * (hero.cooldownMult || 1);
  }
}

function tdSpawnPig(state, spawn) {
  state.pigs.push({
    id: state.nextPigId++,
    pathId: spawn.pathId,
    t: 0,
    hp: spawn.maxHp,
    maxHp: spawn.maxHp,
    strength: spawn.strength,
    damage: spawn.damage,
    speed: spawn.speed,
    sizeScale: tdPigSizeScale(spawn.strength),
  });
}

function tdPigReachHero(state, pig) {
  const hero = state.hero;
  let dmg = pig.damage;
  if (hero.block > 0) {
    const absorbed = Math.min(hero.block, dmg);
    hero.block -= absorbed;
    dmg -= absorbed;
    hero.totalDamageBlocked = (hero.totalDamageBlocked || 0) + absorbed;
  }
  if (dmg > 0 && hero.defense > 0) {
    const afterDef = Math.max(1, dmg - hero.defense * 0.35);
    dmg = afterDef;
  }
  hero.hp -= dmg;
  hero.totalDamageDealt = (hero.totalDamageDealt || 0) + 0;
  state.pigsLeaked += 1;
  state.log.push(`🐷 Свинья (${pig.strength}) добралась! −${Math.round(dmg)} HP`);
}

function tdTick(state, dt) {
  if (!state || state.finished) return;
  state.elapsed += dt;

  state.attackFx = state.attackFx
    .map((fx) => ({ ...fx, ttl: fx.ttl - dt }))
    .filter((fx) => fx.ttl > 0);

  if (state.wavePhase === "break") {
    state.breakTimer -= dt;
    if (state.breakTimer <= 0) {
      state.wavePhase = "done";
      state.finished = true;
      state.winner = state.hero.hp > 0 ? "player" : "enemy";
    }
    return;
  }

  if (state.wavePhase === "spawning") {
    state.spawnElapsed += dt;
    while (state.spawnQueue.length && state.spawnQueue[0].delay <= state.spawnElapsed) {
      tdSpawnPig(state, state.spawnQueue.shift());
    }
    if (!state.spawnQueue.length && state.spawnElapsed >= state.totalSpawnDelay) {
      state.wavePhase = "fighting";
    }
  }

  state.pigs.forEach((pig) => {
    pig.t += pig.speed * dt;
    if (pig.t >= 1) {
      tdPigReachHero(state, pig);
      pig.t = 1.01;
      pig.dead = true;
    }
  });
  state.pigs = state.pigs.filter((p) => !p.dead);

  let activations = 0;
  state.attackItems.forEach((atk) => {
    atk.timer -= dt;
    if (atk.timer <= 0 && activations < TD_MAX_ACTIVATIONS_PER_TICK) {
      const before = state.pigs.length;
      tdApplyItemActivation(state, atk);
      if (before !== state.pigs.length || atk.timer <= 0) {
        activations += 1;
      }
      if (atk.timer <= 0) atk.timer = 0.15;
    }
  });

  if (state.hero.hp <= 0) {
    state.hero.hp = 0;
    state.finished = true;
    state.winner = "enemy";
    state.wavePhase = "done";
    return;
  }

  const allSpawned = !state.spawnQueue.length && state.spawnElapsed >= state.totalSpawnDelay;
  if (allSpawned && state.pigs.length === 0 && state.wavePhase !== "break") {
    state.wavePhase = "break";
    state.breakTimer = TD_WAVE_BREAK;
    state.log.push(`✅ Волна ${state.wave} отбита!`);
  }
}

function buildTdWaveSummary(state, meta = {}) {
  const won = state.winner === "player";
  const allWaves = state.wave >= TD_MAX_WAVES && won;
  return {
    winner: state.winner,
    title: allWaves ? "🏆 Победа!" : won ? "Волна отбита!" : "Оборона палала",
    roundNum: meta.roundNum || state.wave,
    goldReward: meta.goldReward || 0,
    battleTime: state.elapsed,
    classWinnerLine: allWaves
      ? `Все ${TD_MAX_WAVES} волн пережиты!`
      : won
        ? `Волна ${state.wave}: ${state.pigsKilled} свиней уничтожено`
        : `Свиньи прорвались на волне ${state.wave}`,
    player: {
      hp: Math.ceil(state.hero.hp),
      maxHp: state.hero.maxHp,
      damage: state.hero.totalDamageDealt || 0,
      heal: state.hero.totalHealingDone || 0,
      block: state.hero.totalDamageBlocked || 0,
    },
    enemy: {
      hp: 0,
      maxHp: 0,
      damage: state.pigsLeaked,
    },
    tdStats: {
      pigsKilled: state.pigsKilled,
      pigsLeaked: state.pigsLeaked,
      totalPigs: state.totalPigs,
      wave: state.wave,
    },
    isTd: true,
  };
}

function fastForwardTd(state, maxSec = 300) {
  let elapsed = 0;
  while (!state.finished && elapsed < maxSec) {
    tdTick(state, 0.05);
    elapsed += 0.05;
  }
}
