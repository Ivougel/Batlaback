/**
 * Tower Defense — башни-герои на слотах карты, непрерывный забег.
 * Магазин и расстановка во время волн.
 */

const TD_MAX_WAVES = 99;
const TD_PIG_EMOJI = "🐷";
/** Мировые координаты карты (больше вьюпорта — pan/zoom по оверворлду). */
const TD_CANVAS_W = 3000;
const TD_CANVAS_H = 3000;
/** Игровой хаб (слоты, центр) — центральная доля мира. */
const TD_PLAYFIELD_MIN = 0.26;
const TD_PLAYFIELD_MAX = 0.74;

function tdPlayfieldCoord(u) {
  return TD_PLAYFIELD_MIN + u * (TD_PLAYFIELD_MAX - TD_PLAYFIELD_MIN);
}

/** Абсолютные размеры в px мира (стабильны при TD_CANVAS_W=3000). */
const TD_PATH_WIDTH_PX = 58;
const TD_PATH_RIM_PX = 72;
const TD_UNIT_SIZE_PX = 42;
const TD_HERO_RADIUS_PX = 74;
const TD_SLOT_RADIUS_PX = 66;
const TD_SPAWN_RING_PX = 30;
/** @deprecated доли — fallback для старых размеров */
const TD_PATH_WIDTH_FRAC = 0.058;
const TD_PATH_RIM_FRAC = 0.072;
const TD_UNIT_SIZE_FRAC = 0.045;
const TD_HERO_RADIUS_FRAC = 0.062;
const TD_SLOT_RADIUS_FRAC = 0.055;
const TD_SPAWN_RING_FRAC = 0.028;
const TD_SPAWN_INTERVAL = 0.55;
const TD_WAVE_BREAK = 1.4;
const TD_MAX_ACTIVATIONS_PER_TICK = 8;
/** Рюкзак одной башни — компактное поле 6×6 (Legion TD / backpack-hybrid). */
const TD_TOWER_COLS = 6;
const TD_TOWER_ROWS = 6;
const TD_BASE_LIVES = 12;
/** Золото за убитую свинью (начисляется в game.js из pendingGold). */
const TD_GOLD_PER_PIG_KILL = 2;
const TD_DIFF_EXP_BASE = 1.55;

/** Слоты постройки: pathId = какая дорожка сюда leak'ит (null = только атака). */
const TD_MAP_SLOTS = [
  { id: 0, x: tdPlayfieldCoord(0.5), y: tdPlayfieldCoord(0.78), pathId: 2, label: "Юг" },
  { id: 1, x: tdPlayfieldCoord(0.5), y: tdPlayfieldCoord(0.18), pathId: 0, label: "Север" },
  { id: 2, x: tdPlayfieldCoord(0.88), y: tdPlayfieldCoord(0.48), pathId: 1, label: "Восток" },
  { id: 3, x: tdPlayfieldCoord(0.12), y: tdPlayfieldCoord(0.48), pathId: 3, label: "Запад" },
  { id: 4, x: tdPlayfieldCoord(0.5), y: tdPlayfieldCoord(0.42), pathId: null, label: "Центр" },
];

const TD_RECRUIT_COST = {
  warrior: 28,
  rogue: 32,
  mage: 36,
  priest: 30,
};

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
    desc: "Базовый баланс · эталон волн",
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

function tdQuadBezierPoint(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function tdSampleQuadraticChain(segments, stepsPerSeg = 14) {
  const points = [];
  segments.forEach((seg) => {
    for (let i = 0; i <= stepsPerSeg; i += 1) {
      if (i === 0 && points.length) continue;
      points.push(tdQuadBezierPoint(seg.from, seg.ctrl, seg.to, i / stepsPerSeg));
    }
  });
  return points;
}

function tdPathBasis(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    len,
    ux: dx / len,
    uy: dy / len,
    px: -dy / len,
    py: dx / len,
  };
}

/** Точка вдоль хорды start→end: along/perp — доли длины хорды. */
function tdPathPt(start, basis, along, perp = 0) {
  return {
    x: start.x + basis.ux * basis.len * along + basis.px * basis.len * perp,
    y: start.y + basis.uy * basis.len * along + basis.py * basis.len * perp,
  };
}

function tdPathPolylineLength(path) {
  if (!path?.length) return 0;
  let len = 0;
  for (let i = 1; i < path.length; i += 1) {
    len += tdDist(path[i - 1], path[i]);
  }
  return len;
}

function tdPathStraightLength(path) {
  if (!path?.length) return 0;
  return tdDist(path[0], path[path.length - 1]);
}

/** Запад: пологая дуга вниз-вверх (капля). */
function tdBuildWestWindingPath(start, end, rng) {
  const b = tdPathBasis(start, end);
  const j = 1 + (rng() - 0.5) * 0.06;
  const p = (v) => v * j;
  const a = (along, perp) => tdPathPt(start, b, along, p(perp));
  return tdSampleQuadraticChain([
    { from: start, ctrl: a(0.1, 0.26), to: a(0.24, 0.18) },
    { from: a(0.24, 0.18), ctrl: a(0.38, -0.24), to: a(0.5, -0.17) },
    { from: a(0.5, -0.17), ctrl: a(0.62, 0.22), to: a(0.72, 0.14) },
    { from: a(0.72, 0.14), ctrl: a(0.82, -0.12), to: a(0.9, -0.06) },
    { from: a(0.9, -0.06), ctrl: a(0.96, 0.02), to: end },
  ]);
}

/** Север: резкий зигзаг с выраженным изломом. */
function tdBuildNorthWindingPath(start, end, rng) {
  const b = tdPathBasis(start, end);
  const j = 1 + (rng() - 0.5) * 0.08;
  const p = (v) => v * j;
  const a = (along, perp) => tdPathPt(start, b, along, p(perp));
  return tdSampleQuadraticChain([
    { from: start, ctrl: a(0.1, 0.26), to: a(0.22, 0.2) },
    { from: a(0.22, 0.2), ctrl: a(0.34, -0.24), to: a(0.46, -0.18) },
    { from: a(0.46, -0.18), ctrl: a(0.56, 0.22), to: a(0.66, 0.16) },
    { from: a(0.66, 0.16), ctrl: a(0.78, -0.12), to: a(0.88, -0.06) },
    { from: a(0.88, -0.06), ctrl: a(0.94, 0.02), to: end },
  ]);
}

/** Восток: плавная S-образная змейка. */
function tdBuildEastWindingPath(start, end, rng) {
  const b = tdPathBasis(start, end);
  const j = 1 + (rng() - 0.5) * 0.07;
  const p = (v) => v * j;
  const a = (along, perp) => tdPathPt(start, b, along, p(perp));
  return tdSampleQuadraticChain([
    { from: start, ctrl: a(0.1, 0.2), to: a(0.22, 0.14) },
    { from: a(0.22, 0.14), ctrl: a(0.36, -0.22), to: a(0.48, -0.16) },
    { from: a(0.48, -0.16), ctrl: a(0.58, 0.2), to: a(0.68, 0.14) },
    { from: a(0.68, 0.14), ctrl: a(0.78, -0.16), to: a(0.86, -0.1) },
    { from: a(0.86, -0.1), ctrl: a(0.94, 0.04), to: end },
  ]);
}

/** Юг: два изгиба перед слотом игрока — не прямая в лоб. */
function tdBuildSouthWindingPath(start, end, rng) {
  const b = tdPathBasis(start, end);
  const j = 1 + (rng() - 0.5) * 0.08;
  const p = (v) => v * j;
  const a = (along, perp) => tdPathPt(start, b, along, p(perp));
  return tdSampleQuadraticChain([
    { from: start, ctrl: a(0.11, -0.2), to: a(0.24, -0.14) },
    { from: a(0.24, -0.14), ctrl: a(0.38, 0.22), to: a(0.5, 0.18) },
    { from: a(0.5, 0.18), ctrl: a(0.62, -0.16), to: a(0.74, -0.1) },
    { from: a(0.74, -0.1), ctrl: a(0.86, 0.1), to: a(0.93, 0.05) },
    { from: a(0.93, 0.05), ctrl: a(0.97, 0.01), to: end },
  ]);
}

const TD_LANE_PATH_BUILDERS = [
  tdBuildNorthWindingPath,
  tdBuildEastWindingPath,
  tdBuildSouthWindingPath,
  tdBuildWestWindingPath,
];

function tdBuildWindingLanePath(start, end, pathId, rng) {
  const builder = TD_LANE_PATH_BUILDERS[pathId % TD_LANE_PATH_BUILDERS.length]
    || tdBuildWestWindingPath;
  return builder(start, end, rng);
}

function tdPathSpeedScale(path) {
  if (!path?.length) return 1;
  const curved = tdPathPolylineLength(path);
  const straight = tdPathStraightLength(path);
  if (curved <= 1e-6 || straight <= 1e-6) return 1;
  return straight / curved;
}

/** Фиксированная карта забега: 4 дорожки к слотам + декор. */
function generateTdRunMap(runSeed = 1) {
  const rng = tdSeededRandom(runSeed * 7919 + 42);
  const slots = TD_MAP_SLOTS.map((s) => ({ ...s }));

  const pathStarts = [
    { x: 0.5, y: -0.09 },
    { x: 1.09, y: 0.5 },
    { x: 0.5, y: 1.09 },
    { x: -0.09, y: 0.5 },
  ];

  const paths = pathStarts.map((start, pathId) => {
    const slot = slots.find((s) => s.pathId === pathId);
    const end = slot ? { x: slot.x, y: slot.y } : { x: 0.5, y: 0.5 };
    return tdBuildWindingLanePath(start, end, pathId, rng);
  });

  const pathLengths = paths.map(tdPathPolylineLength);
  const pathStraightLengths = paths.map(tdPathStraightLength);

  const decor = [];
  const decorEmojis = ["🌲", "🌳", "🪨", "🌿", "🍄", "🪵"];
  const decorCount = 48 + Math.floor(rng() * 28);
  for (let i = 0; i < decorCount; i++) {
    const inPlay = rng() < 0.45;
    const x = inPlay
      ? TD_PLAYFIELD_MIN + rng() * (TD_PLAYFIELD_MAX - TD_PLAYFIELD_MIN)
      : rng() * 0.94 + 0.03;
    const y = inPlay
      ? TD_PLAYFIELD_MIN + rng() * (TD_PLAYFIELD_MAX - TD_PLAYFIELD_MIN)
      : rng() * 0.94 + 0.03;
    decor.push({
      x,
      y,
      emoji: decorEmojis[Math.floor(rng() * decorEmojis.length)],
      scale: 0.55 + rng() * 0.85,
      rotate: (rng() - 0.5) * 1.1,
      depth: 0.25 + rng() * 0.75,
    });
  }

  const grassHue = Math.floor(rng() * 24);
  return {
    seed: runSeed,
    slots,
    paths,
    pathLengths,
    pathStraightLengths,
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
  if (!path?.length) return { x: 0.5, y: 0.5 };
  if (t <= 0) return { x: path[0].x, y: path[0].y };
  if (t >= 1) return { x: path[path.length - 1].x, y: path[path.length - 1].y };

  const totalLen = tdPathPolylineLength(path);
  if (totalLen <= 1e-8) return { x: path[0].x, y: path[0].y };

  let dist = t * totalLen;
  for (let i = 1; i < path.length; i += 1) {
    const segLen = tdDist(path[i - 1], path[i]);
    if (dist <= segLen) {
      const localT = segLen > 1e-8 ? dist / segLen : 0;
      const a = path[i - 1];
      const b = path[i];
      return {
        x: a.x + (b.x - a.x) * localT,
        y: a.y + (b.y - a.y) * localT,
      };
    }
    dist -= segLen;
  }
  const last = path[path.length - 1];
  return { x: last.x, y: last.y };
}

function tdGetPathSpeedScale(state, pathId) {
  const map = state?.map;
  if (!map?.paths?.[pathId]) return 1;
  if (map.pathLengths?.[pathId] && map.pathStraightLengths?.[pathId]) {
    const curved = map.pathLengths[pathId];
    const straight = map.pathStraightLengths[pathId];
    if (curved > 1e-6 && straight > 1e-6) return straight / curved;
  }
  return tdPathSpeedScale(map.paths[pathId]);
}

function tdPigSizeScale(strength) {
  return 0.5 + (strength / 100) * 2.2;
}

function tdWavePigCount(wave, difficultyId = "normal") {
  const mult = tdWaveDifficultyMult(wave, difficultyId);
  const base = 3 + Math.floor(wave * 0.34);
  const scaled = Math.round(base * Math.pow(mult, 0.72));
  const cap = Math.round(24 + 10 * Math.pow(getTdDifficultyScale(difficultyId), 0.35));
  return Math.min(Math.max(2, scaled), cap);
}

function tdRollPigStrength(wave, rng, difficultyId = "normal") {
  const mult = tdWaveDifficultyMult(wave, difficultyId);
  const base = (8 + wave * 0.85) * Math.pow(mult, 0.82);
  const spread = rng() * 18 * Math.pow(mult, 0.35) + (wave > 30 ? rng() * 12 : 0);
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

function createTdTowerLoadout(classId) {
  const { col, row } = getStarterBagOrigin(TD_TOWER_COLS, TD_TOWER_ROWS);
  const containers = [createContainer("starter_bag", col, row, 0)];
  const items = applyClassStarters(containers, [], classId);
  return { containers, items, classId };
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
    timer: cd * (0.15 + Math.random() * 0.35),
    damageBonus: item.runtime?.damageBonus || 0,
    blockSourceEfficiency: item.runtime?.blockSourceEfficiency ?? 1,
    healSourceEfficiency: item.runtime?.healSourceEfficiency ?? 1,
    orbitAngle: Math.random() * Math.PI * 2,
    flashTimer: 0,
  };
}

function tdSyncTowerCombat(tower, prepMeta = {}) {
  if (!tower) return;
  applySynergyModifiersToContainers(tower.containers, tower.items);
  const flat = flattenContainersForBattle(tower.containers, tower.items).map((it) => {
    const c = clonePrepBattleItem(it);
    return c;
  });
  tower.hero = createBattleSide(flat, tower.classId, prepMeta);
  tower.attackItems = tower.hero.items.map(cloneTdBattleItem).filter(Boolean);
  tower.attackItems.forEach((atk, i) => {
    atk.towerSlotId = tower.slotId;
    atk.orbitAngle = (i / Math.max(1, tower.attackItems.length)) * Math.PI * 2;
  });
  if (!tower.attackItems.length) {
    tower.attackItems.push({
      uid: `td-fallback-${tower.slotId}`,
      itemId: "rusty_sword",
      icon: "⚔️",
      cooldown: 2,
      timer: 0.4,
      damageBonus: 0,
      blockSourceEfficiency: 1,
      healSourceEfficiency: 1,
      orbitAngle: 0,
      flashTimer: 0,
      towerSlotId: tower.slotId,
    });
  }
  tower.alive = tower.hero.hp > 0;
}

function createTdTower(slotId, classId, prepMeta = {}, free = false) {
  const slot = TD_MAP_SLOTS.find((s) => s.id === slotId);
  if (!slot) return null;
  const loadout = createTdTowerLoadout(classId);
  const tower = {
    slotId,
    classId,
    ...loadout,
    hero: null,
    attackItems: [],
    alive: true,
    free,
    orbitPhase: Math.random() * Math.PI * 2,
  };
  tdSyncTowerCombat(tower, prepMeta);
  return tower;
}

function tdGetTowerAtSlot(state, slotId) {
  return (state.towers || []).find((t) => t.slotId === slotId && t.alive);
}

function tdGetSlotDef(slotId) {
  return TD_MAP_SLOTS.find((s) => s.id === slotId) || null;
}

function tdGetRecruitCost(classId) {
  return TD_RECRUIT_COST[classId] ?? 35;
}

function tdCanRecruitAtSlot(state, slotId, classId, gold) {
  if (tdGetTowerAtSlot(state, slotId)) return { ok: false, reason: "Слот занят" };
  if (!TD_MAP_SLOTS.some((s) => s.id === slotId)) return { ok: false, reason: "Нет слота" };
  if (!getClassById(classId)) return { ok: false, reason: "Неизвестный класс" };
  const cost = tdGetRecruitCost(classId);
  if (gold < cost) return { ok: false, reason: `Нужно ${cost}💰` };
  return { ok: true, cost };
}

function tdRecruitTower(state, slotId, classId, prepMeta = {}) {
  if (tdGetTowerAtSlot(state, slotId)) return { ok: false, reason: "Слот занят" };
  if (!TD_MAP_SLOTS.some((s) => s.id === slotId)) return { ok: false, reason: "Нет слота" };
  if (!getClassById(classId)) return { ok: false, reason: "Неизвестный класс" };
  const tower = createTdTower(slotId, classId, prepMeta);
  if (!tower) return { ok: false, reason: "Не удалось создать башню" };
  state.towers.push(tower);
  return { ok: true, tower, cost: tdGetRecruitCost(classId) };
}

function tdAutoPlaceItemOnTower(tower, itemId, uid) {
  const def = ITEM_CATALOG[itemId];
  if (!def || def.isContainer) return false;
  for (let rot = 0; rot < 4; rot++) {
    for (let row = 0; row < TD_TOWER_ROWS; row++) {
      for (let col = 0; col < TD_TOWER_COLS; col++) {
        if (!canPlaceInLoadout(itemId, col, row, rot, tower.containers, tower.items)) continue;
        tower.items.push({
          uid,
          itemId,
          col,
          row,
          rotation: rot,
          runtime: {},
        });
        return true;
      }
    }
  }
  return false;
}

function tdEquipItemOnTower(state, slotId, itemFromBench, prepMeta = {}) {
  const tower = tdGetTowerAtSlot(state, slotId);
  if (!tower || !itemFromBench) return { ok: false, reason: "Нет башни или предмета" };
  const placed = tdAutoPlaceItemOnTower(tower, itemFromBench.itemId, itemFromBench.uid);
  if (!placed) return { ok: false, reason: "Нет места в рюкзаке башни" };
  tdSyncTowerCombat(tower, prepMeta);
  return { ok: true, tower };
}

/** Предмет/сумка на конкретную клетку рюкзака башни (ручная укладка). */
function tdPlaceOnTowerLoadout(tower, itemId, col, row, rotation, uid, prepMeta = {}) {
  if (!tower || !itemId) return { ok: false, reason: "Нет башни" };
  const def = ITEM_CATALOG[itemId];
  if (!def) return { ok: false, reason: "Неизвестный предмет" };
  if (def.isContainer) {
    if (!canPlaceInLoadoutOnSlots(itemId, col, row, rotation, tower.containers)) {
      return { ok: false, reason: "Сюда нельзя поставить сумку" };
    }
    tower.containers.push(createContainer(itemId, col, row, rotation));
    const placed = tower.containers[tower.containers.length - 1];
    if (uid && placed) placed.uid = uid;
    tdSyncTowerCombat(tower, prepMeta);
    return { ok: true, tower };
  }
  if (!canPlaceInLoadout(itemId, col, row, rotation, tower.containers, tower.items)) {
    return { ok: false, reason: "Нет места в рюкзаке" };
  }
  tower.items.push({
    uid: uid || `td-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    itemId,
    col,
    row,
    rotation: rotation || 0,
    runtime: {},
  });
  tdSyncTowerCombat(tower, prepMeta);
  return { ok: true, tower };
}

function tdStartWave(state) {
  const difficultyId = state.difficultyId || "normal";
  const pathCount = state.map?.paths?.length || 4;
  state.spawnQueue = buildWaveSpawnQueue(state.wave, pathCount, difficultyId);
  state.spawnElapsed = 0;
  state.wavePhase = "spawning";
  state.breakTimer = 0;
  state.pigsKilled = 0;
  state.pigsLeaked = 0;
  state.totalPigs = state.spawnQueue.length;
  state.pigs = [];
  state.waveBannerText = `🌊 Волна ${state.wave} началась!`;
  state.waveBannerTtl = 3.2;
}

function createTdRunState(commanderClassId, prepMeta = {}) {
  const difficultyId = prepMeta.difficultyId || "normal";
  const runSeed = prepMeta.runSeed || Math.floor(Math.random() * 99999);
  const map = generateTdRunMap(runSeed);
  const towers = [];
  const commander = createTdTower(0, commanderClassId, prepMeta.player || prepMeta, true);
  if (commander) towers.push(commander);

  const state = {
    mode: "td",
    runMode: "towers",
    continuous: true,
    wave: 1,
    difficultyId,
    runSeed,
    commanderClassId,
    map,
    towers,
    baseLives: TD_BASE_LIVES,
    pigs: [],
    spawnQueue: [],
    spawnElapsed: 0,
    wavePhase: "spawning",
    breakTimer: 0,
    elapsed: 0,
    finished: false,
    runVictory: false,
    winner: null,
    paused: false,
    selectedSlotId: 0,
    events: [],
    log: [],
    itemDamageStats: {},
    nextPigId: 1,
    attackFx: [],
    prepMeta: prepMeta.player || prepMeta,
  };

  tdStartWave(state);
  return state;
}

/** @deprecated — совместимость; используйте createTdRunState */
function createTdState(playerItems, classId, waveNum, prepMeta = {}) {
  const state = createTdRunState(classId, prepMeta);
  state.wave = waveNum;
  tdStartWave(state);
  if (playerItems?.length) {
    const tower = state.towers[0];
    if (tower) {
      tower.items = playerItems.map(clonePrepBattleItem);
      tdSyncTowerCombat(tower, prepMeta.player || prepMeta);
    }
  }
  return state;
}

function tdRecordItemDamage(state, itemId, slotId, amount) {
  const key = `tower${slotId}:${itemId}`;
  if (!state.itemDamageStats[key]) {
    state.itemDamageStats[key] = { team: "player", itemId, slotId, damageDealt: 0, activations: 0 };
  }
  state.itemDamageStats[key].damageDealt += amount;
  state.itemDamageStats[key].activations += 1;
}

function tdDist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function tdPickTargetPigForTower(pigs, tower, map) {
  if (!pigs.length || !tower?.alive) return null;
  const slot = tdGetSlotDef(tower.slotId);
  if (!slot) return pigs[0];

  let best = null;
  let bestScore = -Infinity;
  pigs.forEach((pig) => {
    const pos = tdLerpPath(map.paths, pig.pathId, pig.t);
    let score = pig.t;
    if (slot.pathId != null && pig.pathId === slot.pathId) score += 2;
    else score -= tdDist(pos, slot) * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = pig;
    }
  });
  return best;
}

function tdResolveTowerAttackVisual(def, effect) {
  if (typeof resolveItemAttackVisual === "function") {
    return resolveItemAttackVisual(def, effect);
  }
  if (effect?.type === "heal" || effect?.type === "block" || effect?.type === "grantBlockBuff") return "support";
  if (effect?.type === "poison" || effect?.type === "groundFire") return "aoe";
  return "slash";
}

function tdEmitTowerAttackFx(state, tower, atkItem, def, effect, extra = {}) {
  const slot = tdGetSlotDef(tower.slotId);
  const visual = tdResolveTowerAttackVisual(def, effect);
  const cfg = typeof ATTACK_VISUAL_CONFIG !== "undefined"
    ? (ATTACK_VISUAL_CONFIG[visual] || ATTACK_VISUAL_CONFIG.slash)
    : { attackType: "melee", duration: 0.42 };
  const fromX = slot?.x ?? 0.5;
  const fromY = slot?.y ?? 0.5;
  let toX = fromX;
  let toY = fromY;
  const target = extra.target || null;
  if (target) {
    const pos = tdLerpPath(state.map?.paths || [], target.pathId, target.t);
    toX = pos.x;
    toY = pos.y;
  }
  const duration = cfg.duration || 0.42;
  state.attackFx.push({
    itemId: atkItem.itemId,
    icon: def?.icon || atkItem.icon || "⚔️",
    uid: atkItem.uid,
    visual,
    attackType: cfg.attackType || "melee",
    effectType: effect?.type || "damage",
    targetId: target?.id ?? null,
    towerSlotId: tower.slotId,
    damage: extra.damage || 0,
    ttl: duration,
    maxTtl: duration,
    fromX,
    fromY,
    toX,
    toY,
  });
}

function tdApplyTowerItemActivation(state, tower, atkItem) {
  const def = ITEM_CATALOG[atkItem.itemId];
  if (!def || !tower.alive) return false;
  const hero = tower.hero;
  let didSomething = false;

  (def.effects || []).forEach((eff) => {
    if (eff.type === "damage") {
      const target = tdPickTargetPigForTower(state.pigs, tower, state.map);
      if (!target) return;
      const base = typeof getEffectAverageDamage === "function"
        ? getEffectAverageDamage(eff, def)
        : (eff.value || 3);
      const dmg = Math.max(1, Math.round((base + atkItem.damageBonus) * (hero.damageMult || 1)));
      target.hp -= dmg;
      tdRecordItemDamage(state, atkItem.itemId, tower.slotId, dmg);
      tdEmitTowerAttackFx(state, tower, atkItem, def, eff, { target, damage: dmg });
      atkItem.flashTimer = 0.35;
      if (target.hp <= 0) {
        state.pigs = state.pigs.filter((p) => p.id !== target.id);
        state.pigsKilled += 1;
        state.pendingGold = (state.pendingGold || 0) + TD_GOLD_PER_PIG_KILL;
      }
      didSomething = true;
    } else if (eff.type === "heal") {
      const base = eff.value || 4;
      const heal = Math.round(base * (atkItem.healSourceEfficiency || 1));
      hero.hp = Math.min(hero.maxHp, hero.hp + heal);
      hero.totalHealingDone = (hero.totalHealingDone || 0) + heal;
      tdEmitTowerAttackFx(state, tower, atkItem, def, eff);
      atkItem.flashTimer = 0.35;
      didSomething = true;
    } else if (eff.type === "block" || eff.type === "grantBlockBuff") {
      const base = eff.value || 3;
      const block = Math.round(base * (atkItem.blockSourceEfficiency || 1));
      hero.block = (hero.block || 0) + block;
      tdEmitTowerAttackFx(state, tower, atkItem, def, eff);
      atkItem.flashTimer = 0.35;
      didSomething = true;
    }
  });

  if (didSomething) {
    atkItem.timer = atkItem.cooldown * (hero.cooldownMult || 1);
  }
  return didSomething;
}

function tdSpawnPig(state, spawn) {
  const speedScale = tdGetPathSpeedScale(state, spawn.pathId);
  state.pigs.push({
    id: state.nextPigId++,
    pathId: spawn.pathId,
    t: 0,
    hp: spawn.maxHp,
    maxHp: spawn.maxHp,
    strength: spawn.strength,
    damage: spawn.damage,
    speed: spawn.speed * speedScale,
    sizeScale: tdPigSizeScale(spawn.strength),
  });
}

function tdPigReachSlot(state, pig) {
  const slotDef = TD_MAP_SLOTS.find((s) => s.pathId === pig.pathId);
  const slotId = slotDef?.id;
  const tower = slotId != null ? tdGetTowerAtSlot(state, slotId) : null;

  if (!tower) {
    state.baseLives = Math.max(0, (state.baseLives || 0) - 1);
    state.pigsLeaked += 1;
    state.log.push(`🐷 Прорыв! База −1 (${state.baseLives}❤️)`);
    return;
  }

  const hero = tower.hero;
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
  const cls = typeof getClassById === "function" ? getClassById(tower.classId) : null;
  state.log.push(`🐷 Удар по ${cls?.name || "башне"} (${slotDef?.label}) −${Math.round(dmg)} HP`);
  if (hero.hp <= 0) {
    hero.hp = 0;
    tower.alive = false;
    tower.attackItems = [];
    state.log.push(`💀 Башня ${cls?.name || ""} пала!`);
  }
}

function tdCheckDefeat(state) {
  const livingTowers = (state.towers || []).filter((t) => t.alive && t.hero?.hp > 0);
  if (livingTowers.length === 0 || (state.baseLives ?? 0) <= 0) {
    state.finished = true;
    state.winner = "enemy";
    state.wavePhase = "done";
    return true;
  }
  return false;
}

function tdAdvanceWave(state) {
  if (state.wave >= TD_MAX_WAVES) {
    state.finished = true;
    state.runVictory = true;
    state.winner = "player";
    state.wavePhase = "done";
    state.log.push(`🏆 Карта пройдена! ${TD_MAX_WAVES} волн!`);
    return;
  }
  state.wave += 1;
  tdStartWave(state);
  state.waveJustCleared = true;
  state.log.push(`🌊 Волна ${state.wave}…`);
}

function tdHitTestSlot(normX, normY, state = null) {
  let best = null;
  let bestD = Infinity;

  const trySlot = (slot, maxR) => {
    const d = tdDist({ x: normX, y: normY }, slot);
    if (d < maxR && d < bestD) {
      bestD = d;
      best = slot.id;
    }
  };

  TD_MAP_SLOTS.forEach((slot) => {
    const occupied = state?.towers?.some((t) => t.slotId === slot.id && t.alive);
    trySlot(slot, occupied ? 0.13 : 0.09);
  });

  return best;
}

function tdTick(state, dt) {
  if (!state || state.finished || state.paused) return;
  state.elapsed += dt;
  if (state.waveBannerTtl > 0) state.waveBannerTtl = Math.max(0, state.waveBannerTtl - dt);

  state.attackFx = state.attackFx
    .map((fx) => ({ ...fx, ttl: fx.ttl - dt }))
    .filter((fx) => fx.ttl > 0);

  (state.towers || []).forEach((tower) => {
    if (!tower.alive) return;
    tower.orbitPhase = (tower.orbitPhase || 0) + dt * 0.6;
    (tower.attackItems || []).forEach((atk) => {
      if (atk.flashTimer > 0) atk.flashTimer -= dt;
      atk.orbitAngle = (atk.orbitAngle || 0) + dt * 0.55;
    });
  });

  if (state.wavePhase === "break") {
    state.breakTimer -= dt;
    if (state.breakTimer <= 0) {
      if (state.continuous) {
        tdAdvanceWave(state);
      } else {
        state.wavePhase = "done";
        state.finished = true;
        state.winner = (state.towers || []).some((t) => t.alive) ? "player" : "enemy";
      }
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
      tdPigReachSlot(state, pig);
      pig.t = 1.01;
      pig.dead = true;
    }
  });
  state.pigs = state.pigs.filter((p) => !p.dead);

  if (tdCheckDefeat(state)) return;

  let activations = 0;
  (state.towers || []).forEach((tower) => {
    if (!tower.alive) return;
    (tower.attackItems || []).forEach((atk) => {
      if (activations >= TD_MAX_ACTIVATIONS_PER_TICK) return;
      atk.timer -= dt;
      if (atk.timer <= 0) {
        const before = state.pigs.length;
        const acted = tdApplyTowerItemActivation(state, tower, atk);
        if (acted) activations += 1;
        if (before !== state.pigs.length || atk.flashTimer > 0) {
          /* counted */
        }
        if (atk.timer <= 0) atk.timer = 0.1;
      }
    });
  });

  if (tdCheckDefeat(state)) return;

  const allSpawned = !state.spawnQueue.length;
  if (allSpawned && state.pigs.length === 0 && state.wavePhase === "fighting") {
    state.wavePhase = "break";
    state.breakTimer = TD_WAVE_BREAK;
    state.log.push(`✅ Волна ${state.wave} отбита! (${state.pigsKilled} 🐷)`);
  }
}

function buildTdWaveSummary(state, meta = {}) {
  const won = state.winner === "player";
  const allWaves = state.runVictory || (state.wave >= TD_MAX_WAVES && won);
  const living = (state.towers || []).filter((t) => t.alive);
  const totalHp = living.reduce((n, t) => n + (t.hero?.hp || 0), 0);
  const maxHp = living.reduce((n, t) => n + (t.hero?.maxHp || 0), 0);

  const playerItems = Object.values(state.itemDamageStats || {})
    .filter((s) => s.team === "player")
    .sort((a, b) => b.damageDealt - a.damageDealt)
    .map((stat) => {
      const def = ITEM_CATALOG[stat.itemId] || {};
      return { ...stat, name: def.name || stat.itemId, icon: def.icon };
    });

  const diffLabel = tdFormatDifficultyLabel(state.difficultyId || meta.difficultyId || "normal");
  const commanderName = typeof getClassById === "function"
    ? (getClassById(state.commanderClassId)?.name || "Командир")
    : "Командир";

  return {
    winner: state.winner,
    title: allWaves ? "🏆 Карта пройдена!" : won ? "Волна отбита!" : "Оборона палала",
    roundNum: meta.roundNum || state.wave,
    goldReward: meta.goldReward || 0,
    battleTime: state.elapsed,
    playerClassName: commanderName,
    enemyClassName: "🐷 Свиньи",
    difficultyLabel: diffLabel,
    classWinnerLine: allWaves
      ? `Все ${TD_MAX_WAVES} волн на ${diffLabel}!`
      : won
        ? `Волна ${state.wave} (${diffLabel}): ${state.pigsKilled} 🐷 · башни ${living.length} · база ${state.baseLives}❤️`
        : `Прорыв на волне ${state.wave} · ${diffLabel}`,
    player: {
      hp: Math.ceil(totalHp),
      maxHp: maxHp || 1,
      damage: Object.values(state.itemDamageStats || {}).reduce((n, s) => n + (s.damageDealt || 0), 0),
      heal: living.reduce((n, t) => n + (t.hero?.totalHealingDone || 0), 0),
      block: living.reduce((n, t) => n + (t.hero?.totalDamageBlocked || 0), 0),
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
      baseLives: state.baseLives,
      towerCount: living.length,
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

if (typeof window !== "undefined") {
  window.TD_TOWER_COLS = TD_TOWER_COLS;
  window.TD_TOWER_ROWS = TD_TOWER_ROWS;
}
