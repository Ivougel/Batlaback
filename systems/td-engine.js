/**
 * Tower Defense — 99 волн свиней к герою в центре.
 * Карта генерируется случайно для каждой волны.
 */

const TD_MAX_WAVES = 99;
const TD_PIG_EMOJI = "🐷";
const TD_CENTER = { x: 0.5, y: 0.5 };
const TD_CANVAS_W = 960;
const TD_CANVAS_H = 640;
const TD_SPAWN_INTERVAL = 0.55;
const TD_WAVE_BREAK = 0.6;
const TD_MAX_ACTIVATIONS_PER_TICK = 3;
/** Множитель сложности между ступенями: 1.55^4 ≈ 5.7× от лёгкого к ультра. */
const TD_DIFF_EXP_BASE = 1.55;

const TD_DIFFICULTIES = {
  easy: {
    id: "easy",
    index: 0,
    emoji: "🌱",
    label: "Лёгкий",
    desc: "Мало свиней, слабый урон · для знакомства",
    goldMult: 0.88,
    spawnIntervalMult: 1.18,
  },
  normal: {
    id: "normal",
    index: 1,
    emoji: "⚔️",
    label: "Нормальный",
    desc: "Базовый баланс · эталон 99 волн",
    goldMult: 1,
    spawnIntervalMult: 1,
  },
  hard: {
    id: "hard",
    index: 2,
    emoji: "🔥",
    label: "Сложный",
    desc: "Больше стай и HP · нужен крепкий билд",
    goldMult: 1.14,
    spawnIntervalMult: 0.86,
  },
  nightmare: {
    id: "nightmare",
    index: 3,
    emoji: "💀",
    label: "Кошмар",
    desc: "Быстрые толстые свиньи · мало ошибок",
    goldMult: 1.32,
    spawnIntervalMult: 0.74,
  },
  ultra: {
    id: "ultra",
    index: 4,
    emoji: "☠️",
    label: "Ультра",
    desc: "Экспоненциальный ад · только для ветеранов",
    goldMult: 1.55,
    spawnIntervalMult: 0.62,
  },
};

const TD_DIFFICULTY_ORDER = ["easy", "normal", "hard", "nightmare", "ultra"];

function getTdDifficulty(id) {
  return TD_DIFFICULTIES[id] || TD_DIFFICULTIES.normal;
}

function getTdDifficultyScale(id) {
  const diff = getTdDifficulty(id);
  return Math.pow(TD_DIFF_EXP_BASE, diff.index - 1);
}

function getTdDifficultyGoldMult(id) {
  return getTdDifficulty(id).goldMult;
}

/** Комбинированный множитель волны: сложность × поздний забег. */
function tdWaveDifficultyMult(wave, difficultyId) {
  const diffScale = getTdDifficultyScale(difficultyId);
  const diff = getTdDifficulty(difficultyId);
  const waveT = Math.pow(Math.min(1, wave / TD_MAX_WAVES), 1.28);
  const lateBoost = 1 + waveT * 0.22 * (diff.index + 1);
  return diffScale * lateBoost;
}

function tdFormatDifficultyLabel(id) {
  const d = getTdDifficulty(id);
  return `${d.emoji} ${d.label}`;
}

function tdClamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function tdSeededRandom(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return ((s >>> 0) & 0xfffffff) / 0x10000000;
  };
}

/** Случайная карта: 3–5 тропинок с края к центру + декор. */
function generateTdMap(waveNum, runSeed = 1) {
  const rng = tdSeededRandom(waveNum * 9973 + runSeed * 7919 + 42);
  const center = { x: TD_CENTER.x, y: TD_CENTER.y };
  const numPaths = 3 + Math.floor(rng() * 3);
  const paths = [];

  for (let i = 0; i < numPaths; i++) {
    const angle = (i / numPaths) * Math.PI * 2 + (rng() - 0.5) * 0.65;
    const dist = 0.38 + rng() * 0.1;
    const start = {
      x: tdClamp(center.x + Math.cos(angle) * dist, 0.04, 0.96),
      y: tdClamp(center.y + Math.sin(angle) * dist, 0.04, 0.96),
    };
    const bends = 1 + Math.floor(rng() * 2);
    const path = [start];
    for (let b = 0; b < bends; b++) {
      const t = (b + 1) / (bends + 1);
      path.push({
        x: tdClamp(start.x + (center.x - start.x) * t + (rng() - 0.5) * 0.22, 0.06, 0.94),
        y: tdClamp(start.y + (center.y - start.y) * t + (rng() - 0.5) * 0.22, 0.06, 0.94),
      });
    }
    path.push({ ...center });
    paths.push(path);
  }

  const decor = [];
  const decorEmojis = ["🌲", "🌳", "🪨", "🌿", "🍄", "🪵"];
  const count = 12 + Math.floor(rng() * 18);
  for (let i = 0; i < count; i++) {
    decor.push({
      x: rng() * 0.92 + 0.04,
      y: rng() * 0.92 + 0.04,
      emoji: decorEmojis[Math.floor(rng() * decorEmojis.length)],
      scale: 0.7 + rng() * 0.6,
    });
  }

  const grassHue = Math.floor(rng() * 24);
  return {
    seed: waveNum * 9973 + runSeed,
    paths,
    center,
    decor,
    grassLight: `hsl(${108 + grassHue}, 38%, ${32 + Math.floor(rng() * 8)}%)`,
    grassDark: `hsl(${112 + grassHue}, 42%, ${22 + Math.floor(rng() * 6)}%)`,
    pathColor: `hsl(${28 + Math.floor(rng() * 12)}, 45%, ${38 + Math.floor(rng() * 10)}%)`,
  };
}

function tdGetPaths(state) {
  return state?.map?.paths || [];
}

function tdLerpPath(stateOrPaths, pathId, t) {
  const paths = Array.isArray(stateOrPaths) ? stateOrPaths : tdGetPaths(stateOrPaths);
  const path = paths[pathId % Math.max(1, paths.length)];
  if (!path?.length) return { ...TD_CENTER };
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

function tdWavePigCount(wave, difficultyId = "normal") {
  const mult = tdWaveDifficultyMult(wave, difficultyId);
  const base = 3 + Math.floor(wave * 0.32);
  const scaled = Math.round(base * Math.pow(mult, 0.72));
  const cap = Math.round(26 + 10 * Math.pow(getTdDifficultyScale(difficultyId), 0.35));
  return Math.min(Math.max(2, scaled), cap);
}

function tdRollPigStrength(wave, rng, difficultyId = "normal") {
  const mult = tdWaveDifficultyMult(wave, difficultyId);
  const base = (8 + wave * 0.85) * Math.pow(mult, 0.82);
  const spread = rng() * 18 * Math.pow(mult, 0.35) + (wave > 50 ? rng() * 12 : 0);
  return Math.min(100, Math.round(base + spread));
}

function tdPigHp(strength, wave, difficultyId = "normal") {
  const mult = getTdDifficultyScale(difficultyId);
  return Math.round((6 + strength * 0.55 + wave * 0.4) * Math.pow(mult, 0.92));
}

function tdPigDamage(strength, difficultyId = "normal") {
  const mult = getTdDifficultyScale(difficultyId);
  return Math.round((2 + strength * 0.22) * Math.pow(mult, 0.78));
}

function tdPigSpeed(strength, wave, difficultyId = "normal") {
  const mult = getTdDifficultyScale(difficultyId);
  const base = (0.055 + wave * 0.00035) * (1 + (mult - 1) * 0.38);
  const slow = strength > 60 ? (strength - 60) * 0.00008 : 0;
  return Math.min(0.17, base - slow);
}

function buildWaveSpawnQueue(wave, pathCount, difficultyId = "normal", rng = Math.random) {
  const diff = getTdDifficulty(difficultyId);
  const spawnGap = TD_SPAWN_INTERVAL * diff.spawnIntervalMult;
  const count = tdWavePigCount(wave, difficultyId);
  const queue = [];
  for (let i = 0; i < count; i++) {
    const strength = tdRollPigStrength(wave, rng, difficultyId);
    queue.push({
      pathId: i % Math.max(1, pathCount),
      delay: i * spawnGap,
      strength,
      maxHp: tdPigHp(strength, wave, difficultyId),
      damage: tdPigDamage(strength, difficultyId),
      speed: tdPigSpeed(strength, wave, difficultyId),
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
    icon: def.icon,
    cooldown: cd,
    timer: cd * (0.2 + Math.random() * 0.4),
    damageBonus: item.runtime?.damageBonus || 0,
    blockSourceEfficiency: item.runtime?.blockSourceEfficiency ?? 1,
    healSourceEfficiency: item.runtime?.healSourceEfficiency ?? 1,
    orbitAngle: Math.random() * Math.PI * 2,
    flashTimer: 0,
  };
}

function createTdState(playerItems, classId, waveNum, prepMeta = {}) {
  const hero = createBattleSide(playerItems, classId, prepMeta.player || prepMeta);
  const attackItems = hero.items
    .map(cloneTdBattleItem)
    .filter(Boolean);

  attackItems.forEach((atk, i) => {
    atk.orbitAngle = (i / Math.max(1, attackItems.length)) * Math.PI * 2;
  });

  if (!attackItems.length) {
    attackItems.push({
      uid: "td-fallback",
      itemId: "rusty_sword",
      icon: "⚔️",
      cooldown: 1.8,
      timer: 0.3,
      damageBonus: 0,
      blockSourceEfficiency: 1,
      healSourceEfficiency: 1,
      orbitAngle: 0,
      flashTimer: 0,
    });
  }

  const difficultyId = prepMeta.difficultyId || prepMeta.player?.difficultyId || "normal";
  const map = generateTdMap(waveNum, prepMeta.runSeed || 1);
  const spawnQueue = buildWaveSpawnQueue(waveNum, map.paths.length, difficultyId);
  const spawnGap = TD_SPAWN_INTERVAL * getTdDifficulty(difficultyId).spawnIntervalMult;
  const totalSpawnDelay = spawnQueue.length > 0
    ? spawnQueue[spawnQueue.length - 1].delay + spawnGap
    : 0;

  return {
    mode: "td",
    wave: waveNum,
    difficultyId,
    map,
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
        uid: atkItem.uid,
        targetId: target.id,
        damage: dmg,
        ttl: 0.4,
      });
      atkItem.flashTimer = 0.35;
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
      atkItem.flashTimer = 0.35;
      didSomething = true;
    } else if (eff.type === "block" || eff.type === "grantBlockBuff") {
      const base = eff.value || 3;
      const block = Math.round(base * (atkItem.blockSourceEfficiency || 1));
      hero.block = (hero.block || 0) + block;
      atkItem.flashTimer = 0.35;
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
    dmg = Math.max(1, dmg - hero.defense * 0.35);
  }
  hero.hp -= dmg;
  state.pigsLeaked += 1;
  state.log.push(`🐷 Свинья (${pig.strength}) добралась! −${Math.round(dmg)} HP`);
}

function tdTick(state, dt) {
  if (!state || state.finished) return;
  state.elapsed += dt;

  state.attackFx = state.attackFx
    .map((fx) => ({ ...fx, ttl: fx.ttl - dt }))
    .filter((fx) => fx.ttl > 0);

  state.attackItems.forEach((atk) => {
    if (atk.flashTimer > 0) atk.flashTimer -= dt;
    atk.orbitAngle += dt * 0.6;
  });

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
    if (!state.spawnQueue.length) {
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
      if (before !== state.pigs.length || atk.flashTimer > 0) {
        activations += 1;
      }
      if (atk.timer <= 0) atk.timer = 0.12;
    }
  });

  if (state.hero.hp <= 0) {
    state.hero.hp = 0;
    state.finished = true;
    state.winner = "enemy";
    state.wavePhase = "done";
    return;
  }

  const allSpawned = !state.spawnQueue.length;
  if (allSpawned && state.pigs.length === 0 && state.wavePhase !== "break" && state.wavePhase !== "done") {
    state.wavePhase = "break";
    state.breakTimer = TD_WAVE_BREAK;
    state.log.push(`✅ Волна ${state.wave} отбита! (${state.pigsKilled} 🐷)`);
  }
}

function buildTdWaveSummary(state, meta = {}) {
  const won = state.winner === "player";
  const allWaves = state.wave >= TD_MAX_WAVES && won;
  const playerClassName = typeof getClassById === "function"
    ? (getClassById(state.classId)?.name || state.classId || "Игрок")
    : "Игрок";
  const playerItems = Object.values(state.itemDamageStats || {})
    .filter((s) => s.team === "player")
    .sort((a, b) => b.damageDealt - a.damageDealt)
    .map((stat) => {
      const def = ITEM_CATALOG[stat.itemId] || {};
      return { ...stat, name: def.name || stat.itemId, icon: def.icon };
    });

  const diffLabel = tdFormatDifficultyLabel(state.difficultyId || meta.difficultyId || "normal");
  return {
    winner: state.winner,
    title: allWaves ? "🏆 Победа!" : won ? "Волна отбита!" : "Оборона палала",
    roundNum: meta.roundNum || state.wave,
    goldReward: meta.goldReward || 0,
    battleTime: state.elapsed,
    playerClassName,
    enemyClassName: "🐷 Свиньи",
    difficultyLabel: diffLabel,
    classWinnerLine: allWaves
      ? `Все ${TD_MAX_WAVES} волн на ${diffLabel}!`
      : won
        ? `Волна ${state.wave} (${diffLabel}): ${state.pigsKilled} 🐷 · HP ${Math.ceil(state.hero.hp)}/${state.hero.maxHp}`
        : `Прорыв на волне ${state.wave} · ${diffLabel}`,
    player: {
      hp: Math.ceil(state.hero.hp),
      maxHp: state.hero.maxHp,
      damage: Object.values(state.itemDamageStats || {}).reduce((n, s) => n + (s.damageDealt || 0), 0),
      heal: state.hero.totalHealingDone || 0,
      block: state.hero.totalDamageBlocked || 0,
    },
    enemy: {
      hp: 0,
      maxHp: 0,
      damage: state.pigsLeaked,
    },
    playerItems,
    enemyItems: [],
    tdStats: {
      pigsKilled: state.pigsKilled,
      pigsLeaked: state.pigsLeaked,
      totalPigs: state.totalPigs,
      wave: state.wave,
    },
    isTd: true,
    tdSubtitle: won
      ? `${diffLabel} · волна ${state.wave}/${TD_MAX_WAVES} · +${meta.goldReward || 0}💰`
      : `${diffLabel} · волна ${state.wave}/${TD_MAX_WAVES} · поражение`,
  };
}

function fastForwardTd(state, maxSec = 300) {
  let elapsed = 0;
  while (!state.finished && elapsed < maxSec) {
    tdTick(state, 0.05);
    elapsed += 0.05;
  }
}
