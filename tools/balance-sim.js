/**
 * Headless balance simulation (Node.js).
 * Usage: node tools/balance-sim.js
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

loadScripts(context, [
  "classes.js",
  "items.js",
  "backpack-engine.js",
  "battle-engine.js",
]);

const {
  ITEM_CATALOG,
  createStartingContainers,
  createPlacedItem,
  createContainer,
  findContainerPlacement,
  flattenContainersForBattle,
  applySynergyModifiersToContainers,
  createBattleState,
  fastForwardBattle,
  pickRandomClassId,
  findLoadoutItemPlacement,
} = context;

const GRID_COLS = 9;
const GRID_ROWS = 7;
const BATTLES_PER_MATCHUP = 334;
const CLASS_IDS = ["warrior", "rogue", "mage"];

const CLASS_LOADOUTS = {
  warrior: ["rusty_sword", "iron_shield", "leather_armor", "iron_helmet", "great_shield", "knight_sword", "royal_helmet"],
  rogue: ["dagger", "poison_vial", "poison_dagger", "poison_vial", "beast_fang", "shadow_blade", "smoke_bomb"],
  mage: ["apprentice_staff", "mana_crystal", "fire_crystal", "rune_of_magic", "frost_crystal", "fire_staff", "mana_orb"],
};

const SCENARIO_LOADOUTS = {
  hybridTankMage: [
    "great_shield", "iron_shield", "iron_helmet", "leather_armor",
    "apprentice_staff", "mana_crystal", "poison_dagger", "poison_vial", "titan_armor",
  ],
};

function buildLoadout(itemIds, extraBags = 3) {
  let containers = createStartingContainers(GRID_COLS, GRID_ROWS);
  for (let i = 0; i < extraBags; i++) {
    const spot = findContainerPlacement(GRID_COLS, GRID_ROWS, containers, "backpack")
      || findContainerPlacement(GRID_COLS, GRID_ROWS, containers, "leather_pouch");
    if (!spot) break;
    const bagId = spot.itemId || "backpack";
    containers.push(createContainer("backpack", spot.col, spot.row, spot.rotation || 0));
  }
  const items = [];
  itemIds.forEach((itemId) => {
    const def = ITEM_CATALOG[itemId];
    if (!def || def.isContainer) return;
    const spot = findLoadoutItemPlacement(containers, items, itemId, 0);
    if (spot) items.push(createPlacedItem(itemId, spot.col, spot.row, spot.rotation || 0));
  });
  applySynergyModifiersToContainers(containers, items);
  return flattenContainersForBattle(containers, items);
}

function runBattle(playerItems, enemyItems, playerClass, enemyClass, battleRound = 12) {
  const state = createBattleState(playerItems, enemyItems, playerClass, enemyClass, battleRound);
  state.recording = false;
  fastForwardBattle(state);
  return {
    winner: state.winner,
    elapsed: state.elapsed,
    stats: state.itemDamageStats,
    playerHp: state.player.hp,
    enemyHp: state.enemy.hp,
  };
}

function estimateItemPower(itemId) {
  const def = ITEM_CATALOG[itemId];
  if (!def || def.isContainer) return null;
  const cells = (def.shape || [[0, 0]]).length;
  const effects = def.effects || [];
  const dmg = effects.find((e) => e.type === "damage");
  const block = effects.find((e) => e.type === "block");
  const poison = effects.find((e) => e.type === "poison");
  const heal = effects.find((e) => e.type === "heal");
  const passiveDef = effects.find((e) => e.type === "passiveDefense");
  const passiveHp = effects.find((e) => e.type === "passiveMaxHp");
  const lifesteal = effects.find((e) => e.type === "lifesteal");
  const shieldMult = effects.find((e) => e.type === "shieldBlockMult");
  const statMults = effects.filter((e) => e.type === "statMult");
  const dodge = effects.find((e) => e.type === "dodgePeriodic");
  const slow = effects.find((e) => e.type === "slow");
  const repeat = effects.find((e) => e.type === "repeatCast");
  const cd = def.cooldown || 2.5;
  let score = 0;

  if (dmg) {
    const avgDmg = (dmg.valueMin + dmg.valueMax) / 2;
    let dps = avgDmg * (30 / cd);
    if (dmg.damageType === "magic") dps *= 1.15;
    if (dmg.damageType === "fire") dps *= 1.1;
    if (repeat) dps *= 1 + (context.REPEAT_MAGIC_EFFECT_SCALE || 0.5) * 0.85;
    score += dps;
  }
  if (block) {
    const blockScore = (block.value || 0) * (30 / cd) * 0.85;
    score += blockScore;
  }
  if (poison) score += (poison.value || 0) * (30 / cd) * 1.15;
  if (heal) score += (heal.value || 0) * (30 / cd) * 0.9;
  if (passiveDef) score += passiveDef.value * 15 * (context.ARMOR_ABSORB_CAP_RATIO || 0.5);
  if (passiveHp) score += passiveHp.value * 0.55;
  if (lifesteal) score += (lifesteal.value || 0) * 40;
  if (shieldMult) score += (shieldMult.value || 0) * 35;
  statMults.forEach((sm) => {
    if (sm.stat === "damage") score += (sm.value || 0) * 45;
    if (sm.stat === "magicDamage") score += (sm.value || 0) * 50;
    if (sm.stat === "cooldown") score += Math.abs(sm.value || 0) * 30;
  });
  if (dodge) score += (30 / (dodge.interval || 5)) * 8;
  if (slow) score += (slow.value || 0) * 25;

  return {
    itemId,
    name: def.name,
    cost: def.cost,
    cells,
    rarity: def.rarity,
    score30s: Math.round(score),
    scorePerGold: def.cost > 0 ? +(score / def.cost).toFixed(2) : score,
    scorePerCell: +(score / cells).toFixed(2),
  };
}

function simulateCrossClassMatrix() {
  const matrix = {};
  const aggregate = {};
  const itemContributions = {};

  CLASS_IDS.forEach((playerClass) => {
    matrix[playerClass] = {};
    let totalWins = 0;
    let totalLosses = 0;
    let totalDraws = 0;
    let totalBattles = 0;

    CLASS_IDS.forEach((enemyClass) => {
      let wins = 0;
      let losses = 0;
      let draws = 0;
      const playerItems = buildLoadout(CLASS_LOADOUTS[playerClass]);
      const enemyItems = buildLoadout(CLASS_LOADOUTS[enemyClass]);

      for (let i = 0; i < BATTLES_PER_MATCHUP; i++) {
        const result = runBattle(playerItems, enemyItems, playerClass, enemyClass);
        if (result.winner === "player") wins += 1;
        else if (result.winner === "enemy") losses += 1;
        else draws += 1;

        if (result.winner === "player") {
          Object.values(result.stats).forEach((stat) => {
            if (stat.team !== "player") return;
            if (!itemContributions[stat.itemId]) {
              itemContributions[stat.itemId] = { wins: 0, damage: 0, blocked: 0, poison: 0 };
            }
            itemContributions[stat.itemId].wins += 1;
            itemContributions[stat.itemId].damage += stat.damageDealt || 0;
            itemContributions[stat.itemId].blocked += stat.damageBlocked || stat.blockDone || 0;
            itemContributions[stat.itemId].poison += stat.poisonApplied || 0;
          });
        }
      }

      matrix[playerClass][enemyClass] = {
        wins,
        losses,
        draws,
        winrate: +((wins / BATTLES_PER_MATCHUP) * 100).toFixed(1),
      };
      totalWins += wins;
      totalLosses += losses;
      totalDraws += draws;
      totalBattles += BATTLES_PER_MATCHUP;
    });

    aggregate[playerClass] = {
      wins: totalWins,
      losses: totalLosses,
      draws: totalDraws,
      battles: totalBattles,
      winrate: +((totalWins / totalBattles) * 100).toFixed(1),
    };
  });

  const topWinContributors = Object.entries(itemContributions)
    .map(([itemId, data]) => ({
      itemId,
      name: ITEM_CATALOG[itemId]?.name || itemId,
      winBattles: data.wins,
      avgDamageInWins: +(data.damage / Math.max(1, data.wins)).toFixed(1),
      avgBlockedInWins: +(data.blocked / Math.max(1, data.wins)).toFixed(1),
      avgPoisonInWins: +(data.poison / Math.max(1, data.wins)).toFixed(1),
    }))
    .sort((a, b) => b.winBattles - a.winBattles)
    .slice(0, 10);

  return { matrix, aggregate, topWinContributors };
}

function simulateMatchup(playerLoadout, enemyLoadout, playerClass, enemyClass, battles = BATTLES_PER_MATCHUP) {
  const playerItems = buildLoadout(playerLoadout);
  const enemyItems = buildLoadout(enemyLoadout);
  let wins = 0;
  let losses = 0;
  let draws = 0;

  for (let i = 0; i < battles; i++) {
    const result = runBattle(playerItems, enemyItems, playerClass, enemyClass);
    if (result.winner === "player") wins += 1;
    else if (result.winner === "enemy") losses += 1;
    else draws += 1;
  }

  return {
    playerClass,
    enemyClass,
    playerLoadout,
    enemyLoadout,
    battles,
    wins,
    losses,
    draws,
    winrate: +((wins / battles) * 100).toFixed(1),
  };
}

function buildEfficiencyTable() {
  return Object.keys(ITEM_CATALOG)
    .map(estimateItemPower)
    .filter(Boolean)
    .sort((a, b) => b.scorePerGold - a.scorePerGold);
}

const efficiency = buildEfficiencyTable();
const simulation = simulateCrossClassMatrix();
const scenarios = {
  mageVsHybridTank: simulateMatchup(
    CLASS_LOADOUTS.mage,
    SCENARIO_LOADOUTS.hybridTankMage,
    "mage",
    "mage",
    500,
  ),
  warriorVsHybridTank: simulateMatchup(
    CLASS_LOADOUTS.warrior,
    SCENARIO_LOADOUTS.hybridTankMage,
    "warrior",
    "mage",
    500,
  ),
  rogueVsHybridTank: simulateMatchup(
    CLASS_LOADOUTS.rogue,
    SCENARIO_LOADOUTS.hybridTankMage,
    "rogue",
    "mage",
    500,
  ),
};

function measureBattleDurations(label, playerLoadout, enemyLoadout, playerClass, enemyClass, battleRound = 12, n = 120) {
  const durations = [];
  for (let i = 0; i < n; i++) {
    const result = runBattle(
      buildLoadout(playerLoadout),
      buildLoadout(enemyLoadout),
      playerClass,
      enemyClass,
      battleRound,
    );
    durations.push(result.elapsed);
  }
  durations.sort((a, b) => a - b);
  const avg = durations.reduce((s, v) => s + v, 0) / durations.length;
  return {
    label,
    battleRound,
    avgSec: +(avg.toFixed(1)),
    p50Sec: +(durations[Math.floor(n * 0.5)].toFixed(1)),
    p90Sec: +(durations[Math.floor(n * 0.9)].toFixed(1)),
    overFatiguePct: Math.round(
      (durations.filter((d) => d >= context.getFatigueStartSec(battleRound, 7)).length / n) * 100,
    ),
  };
}

const battleDurations = [
  measureBattleDurations("mageVsMageLate", CLASS_LOADOUTS.mage, CLASS_LOADOUTS.mage, "mage", "mage", 14),
  measureBattleDurations("rogueVsRogueLate", CLASS_LOADOUTS.rogue, CLASS_LOADOUTS.rogue, "rogue", "rogue", 14),
  measureBattleDurations("warriorVsWarriorLate", CLASS_LOADOUTS.warrior, CLASS_LOADOUTS.warrior, "warrior", "warrior", 14),
  measureBattleDurations("mageVsWarriorLate", CLASS_LOADOUTS.mage, CLASS_LOADOUTS.warrior, "mage", "warrior", 14),
  measureBattleDurations("earlyRound3", ["rusty_sword", "dagger", "poison_vial"], ["rusty_sword", "iron_shield"], "rogue", "warrior", 3),
];

const report = {
  generatedAt: new Date().toISOString(),
  balanceVersion: "2025-06-24",
  caps: {
    POISON_STACK_CAP: context.POISON_STACK_CAP,
    MAX_POISON_BONUS_PER_ITEM: context.MAX_POISON_BONUS_PER_ITEM,
    MAX_CDR_RATIO: context.MAX_CDR_RATIO,
    MAX_DAMAGE_MULT_BONUS: context.MAX_DAMAGE_MULT_BONUS,
    MAX_MAGIC_DAMAGE_MULT_BONUS: context.MAX_MAGIC_DAMAGE_MULT_BONUS,
    MAX_LIFESTEAL: context.MAX_LIFESTEAL,
    MAX_CRIT_CHANCE: context.MAX_CRIT_CHANCE,
    BLOCK_PENETRATION: context.BLOCK_PENETRATION,
    ARMOR_PENETRATION: context.ARMOR_PENETRATION,
    ELEMENTAL_ARMOR_CAP_REDUCTION: context.ELEMENTAL_ARMOR_CAP_REDUCTION,
    BLOCK_SOURCE_EFFICIENCY: context.BLOCK_SOURCE_EFFICIENCY,
    POISON_SOURCE_EFFICIENCY: context.POISON_SOURCE_EFFICIENCY,
    HEAL_POISON_PENALTY_PER_STACK: context.HEAL_POISON_PENALTY_PER_STACK,
    HEAL_POISON_PENALTY_CAP: context.HEAL_POISON_PENALTY_CAP,
    REPEAT_MAGIC_EFFECT_SCALE: context.REPEAT_MAGIC_EFFECT_SCALE,
    ARMOR_ABSORB_CAP_RATIO: context.ARMOR_ABSORB_CAP_RATIO,
    MAX_ACTIVATIONS_PER_SIDE_PER_TICK: context.MAX_ACTIVATIONS_PER_SIDE_PER_TICK,
    FATIGUE_ROUND_START_MAX: context.FATIGUE_ROUND_START_MAX,
    FATIGUE_ROUND_START_MIN: context.FATIGUE_ROUND_START_MIN,
    FATIGUE_DAMAGE_BONUS_CAP: context.FATIGUE_DAMAGE_BONUS_CAP,
    FATIGUE_HP_DRAIN_PER_SEC: context.FATIGUE_HP_DRAIN_PER_SEC,
  },
  rulesSummary: {
    poison: "Стаки суммируются, максимум POISON_STACK_CAP; poisonBonus на предмет ≤ MAX_POISON_BONUS_PER_ITEM",
    cdr: "Суммарное ускорение ограничено MAX_CDR_RATIO (мин. кулдаун 50%)",
    repeatMagic: "Только mana_orb повторяет своё заклинание на REPEAT_MAGIC_EFFECT_SCALE",
    elementalPen: "magic/fire частично игнорируют блок и броню; cap брони ниже для элементов",
    blockStacking: "Несколько block-предметов: сортировка по силе, эффективность BLOCK_SOURCE_EFFICIENCY",
    duplicateItems: "2+ копии itemId: DUPLICATE_ITEM_EFFICIENCY на броню, урон и оценку ИИ",
    poisonStacking: "Несколько poison-предметов: POISON_SOURCE_EFFICIENCY на стаки",
    healUnderPoison: "Лечение −5% за стак яда на себе, макс. −50%",
    grantBlockBuff: "Cap и сила баффа per-shield; несколько щитов — diminishing на бафф",
    arenaFatigue: "Усталость арены: порог по раунду и числу предметов, +входящий урон, позже −HP/с",
    battlePacing: "Старт CD 50–100%, макс. 3 активации за tick",
    itemFootprint: "Сильные gems/руны/legendaries — 1×2 клетки",
  },
  loadouts: CLASS_LOADOUTS,
  scenarioLoadouts: SCENARIO_LOADOUTS,
  crossClassMatrix: simulation.matrix,
  winrates: simulation.aggregate,
  battleDurations,
  scenarios,
  topWinContributors: simulation.topWinContributors,
  efficiencyAll: efficiency,
  efficiencyTop15: efficiency.slice(0, 15),
  efficiencyBottom15: efficiency.filter((e) => e.cost > 0).slice(-15).reverse(),
  efficiencyByRarity: {
    common: efficiency.filter((e) => e.rarity === "common"),
    uncommon: efficiency.filter((e) => e.rarity === "uncommon"),
    rare: efficiency.filter((e) => e.rarity === "rare"),
    legendary: efficiency.filter((e) => e.rarity === "legendary"),
  },
};

const outPath = path.join(__dirname, "balance-sim-results.json");
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
