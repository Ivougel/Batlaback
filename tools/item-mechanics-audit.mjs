#!/usr/bin/env node
/**
 * Аудит механик всех предметов пула: статика + smoke-тесты усилителей/ключей/боя.
 * node tools/item-mechanics-audit.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_JSON = path.join(ROOT, "tools/item-mechanics-audit.json");
const OUT_CSV = path.join(ROOT, "tools/item-mechanics-audit.csv");

const LOAD_ORDER = [
  "classes.js",
  "systems/item-pool-120.js",
  "items.js",
  "items-catalog.js",
  "systems/mutations.js",
  "systems/build-keys.js",
  "systems/triple-support-items.js",
  "systems/backpack-amplifiers.js",
  "systems/meta-effects.js",
  "systems/synergy.js",
  "systems/battle-stacks.js",
  "systems/gem-sockets.js",
  "backpack-engine.js",
  "shop-engine.js",
  "battle-engine.js",
];

const COOLDOWN_ACTIVATION = new Set([
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

const PASSIVE_TRIGGERS = new Set([
  "passive",
  "battle_start",
  "on_hit",
  "on_miss",
  "on_block",
  "on_defend",
  "on_revive",
  "on_foe_heal",
]);

const KNOWN_BATTLE_EFFECTS = new Set([
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
  "passiveMaxHp",
  "passiveDefense",
  "passiveLuck",
  "passiveMaxStamina",
  "statMult",
  "damagePerStack",
  "damagePerTag",
  "damagePerFoeDebuff",
  "damagePerTotalStacks",
  "gainStack",
  "spendStack",
  "gainWeakestStack",
  "tagScaledStack",
  "neutralScaledStack",
  "stackThreshold",
  "weaponDamageStart",
  "shieldBlockMult",
  "shieldBreakBonus",
  "breakBlockOnCrit",
  "timedDamageReduction",
  "onDefend",
  "groundFire",
  "applyStun",
  "extraAttackOnStun",
  "bonusDamageOnStun",
  "dodgePeriodic",
  "selfPoisonStart",
  "crit",
  "critPerStack",
  "critPerFoeDebuff",
  "critPerFoeFatigue",
  "critDamageMult",
  "procChanceBonus",
  "lifestealPerTag",
  "healPerTag",
  "healAsDamageMult",
  "hpThreshold",
  "heartThreshold",
  "mutualHpThreshold",
  "onFoeHeal",
  "debuffThreshold",
  "cooldownMultPerTag",
  "cooldownMultPerAdjacent",
  "cooldownMultPerItemCost",
  "cooldownMultPerSocket",
  "cooldownMultPerTotalStacks",
  "cooldownStartMult",
  "repeatCast",
  "stealWeaponDamage",
  "stealRandomStack",
  "destroyFoeStacks",
  "cleanseDebuffs",
  "activationLimit",
  "activationThreshold",
  "stonesMultiThrow",
  "invulnOnStaminaSpend",
  "zeroStamina",
  "revive",
  "onRevive",
  "preventMiss",
  "fatigueDamageOnHit",
  "attackBuff",
  "onHitCapBonus",
  "hitCounter",
  "staminaSpendOnHit",
  "bonusDamageOnHit",
  "foeHpThreshold",
  "battleRageLowHp",
  "convertHp",
  "maxHpPercentStart",
  "tagScaledMaxHp",
  "stackGainMult",
  "staminaRegenPerStack",
  "onActivate",
  "periodic",
  "cardScaledBonus",
  "cardScaledDamage",
  "max_hp_per_start_item",
  "synergyHint",
]);

const KNOWN_META = new Set([
  "offer_tag",
  "offer_class",
  "exclude_player_class",
  "unique_chance_bonus",
  "bonus_unique",
  "sell_bonus",
  "starting_value",
  "gain_gold",
  "gain_buff",
  "generate_gem",
  "generate_flame",
  "dig_item",
  "items_not_gold",
  "upgrade_adjacent_potion",
  "consume_recombo",
  "consume_inside_flame",
  "gem_if_godly",
  "rarity_up",
  "trade_offer",
  "restock_tag",
  "restock_bag",
  "starred_chance_bonus",
  "unlock_build",
  "generate_worth",
]);

const SYNERGY_APPLY = new Set([
  "damageBonus",
  "healBonus",
  "blockBonus",
  "cooldownReduction",
  "grantBlockBuff",
  "poisonBonus",
]);

function loadSandbox() {
  const sandbox = {
    console,
    Math,
    Object,
    Array,
    Map,
    Set,
    JSON,
    Number,
    String,
    Boolean,
    parseInt,
    parseFloat,
    isNaN,
    Infinity,
    Error,
    Date,
    performance: { now: () => 0 },
    document: { documentElement: { dataset: {} } },
    localStorage: { getItem: () => null },
    location: { search: "" },
    STAMINA_BASE_MAX: 10,
    STAMINA_REGEN_PER_SEC: 1,
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const file of LOAD_ORDER) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx);
  }
  vm.runInContext(
    `
    if (typeof registerTripleSupportItems === "function") registerTripleSupportItems();
    globalThis.__sb = globalThis;
    globalThis.__catalog = ITEM_CATALOG;
  `,
    ctx,
  );
  return { sandbox, catalog: sandbox.__catalog };
}

function classifyItem(def, helpers) {
  const paths = [];
  const issues = [];
  const effects = def.effects || [];
  const meta = def.metaEffects || [];
  const synergies = def.synergies || [];

  if (def.isAmplifierItem) {
    const amp = helpers.getAmplifierDef(def.amplifierId || def.id);
    if (!amp?.implemented) issues.push("amplifier not implemented");
    else {
      paths.push("amplify_highlight");
      if (amp.combat) paths.push("amplify_combat");
    }
    return { paths, issues, activity: amp?.implemented ? "prep+battle" : "none" };
  }

  if (def.isBuildKey) {
    paths.push("key_unlock_build");
    if (!meta.some((e) => e.type === "unlock_build")) issues.push("key missing unlock_build meta");
    return { paths, issues, activity: "prep_shop_craft" };
  }

  if (def.isContainer) {
    paths.push("container_slots");
    if (def.goldPerRound) paths.push("container_gold");
    return { paths, issues, activity: "prep" };
  }

  for (const e of effects) {
    if (!KNOWN_BATTLE_EFFECTS.has(e.type)) {
      issues.push(`unknown effect.type: ${e.type}`);
    }
    if (e.type === "attackBuff" && e.value != null && e.attackBuff == null) {
      issues.push("attackBuff uses value field (handled by runtime alias)");
    }
    const tr = e.trigger || e.phase;
    if (tr === "on_attack" && e.type !== "spendStack" && e.type !== "gainStack") {
      issues.push(`on_attack trigger on ${e.type} may be ignored`);
    }
    if (COOLDOWN_ACTIVATION.has(e.type) && !PASSIVE_TRIGGERS.has(tr || "")) {
      paths.push("battle_cooldown");
    } else if (tr === "periodic" || e.type === "periodic") {
      paths.push("battle_periodic");
    } else if (["on_hit", "on_miss", "on_block", "on_defend"].includes(tr)) {
      paths.push(`battle_${tr}`);
    } else if (e.type === "passiveMaxHp" || e.type === "passiveDefense" || tr === "passive" || tr === "battle_start") {
      paths.push("battle_passive");
    } else if (
      ["stackThreshold", "activationThreshold", "hpThreshold", "heartThreshold", "mutualHpThreshold"].includes(e.type)
    ) {
      paths.push("battle_threshold");
    } else if (KNOWN_BATTLE_EFFECTS.has(e.type)) {
      paths.push("battle_passive");
    }
  }

  for (const e of meta) {
    if (!KNOWN_META.has(e.type)) issues.push(`unknown meta.type: ${e.type}`);
    if (e.type === "offer_tag" || e.type === "offer_class") paths.push("meta_shop_pool");
    if (e.type === "unlock_build") paths.push("key_unlock_build");
    if (["gain_gold", "dig_item", "generate_gem", "generate_flame"].includes(e.type)) {
      paths.push("meta_shop_enter");
    }
  }

  for (const s of synergies) {
    if (s.apply?.type && !SYNERGY_APPLY.has(s.apply.type)) {
      issues.push(`unknown synergy apply: ${s.apply.type}`);
    }
    paths.push("synergy_adjacency");
  }

  const uniquePaths = [...new Set(paths)];
  let activity = "none";
  if (uniquePaths.some((p) => p.startsWith("battle_"))) activity = "battle";
  else if (uniquePaths.some((p) => p.startsWith("meta_") || p === "key_unlock_build")) activity = "prep";
  else if (uniquePaths.includes("synergy_adjacency")) activity = "prep_indirect";
  else if (uniquePaths.includes("container_slots")) activity = "prep";

  if (!uniquePaths.length && !issues.length) issues.push("no runtime path detected");

  return { paths: uniquePaths, issues, activity };
}

function runIntegrationTests(sb) {
  const tests = [];

  const ampItems = [
    { uid: "a1", itemId: "amplify_fire", col: 0, row: 0 },
    { uid: "b1", itemId: "fire_staff", col: 1, row: 0 },
  ];
  const hi = sb.collectAmplifyHighlightedItems(ampItems, sb.collectAmplifiersInLoadout(ampItems));
  tests.push({
    name: "amplify_highlight_fire_staff",
    ok: hi.length === 1 && hi[0].item.itemId === "fire_staff",
    detail: `highlighted ${hi.length}`,
  });

  const ampDrag = sb.collectAmplifiersInLoadout([{ uid: "b1", itemId: "fire_staff", col: 1, row: 0 }], {
    extraItemId: "amplify_fire",
  });
  tests.push({
    name: "amplify_drag_preview",
    ok: ampDrag.length === 1 && ampDrag[0].id === "amplify_fire",
    detail: ampDrag.map((a) => a.id).join(","),
  });

  const side = { hp: 100, maxHp: 100, damageMult: 1, magicDamageMult: 1, cooldownMult: 1 };
  sb.applyAmplifierCombatBonus(side, ampItems);
  tests.push({
    name: "amplify_combat_bonus",
    ok: side.magicDamageMult > 1,
    detail: `magicMult=${side.magicDamageMult}`,
  });

  const keyItems = [{ uid: "k1", itemId: "key_paladin_oath", col: 0, row: 0 }];
  const unlocked = sb.collectUnlockedBuilds(keyItems);
  tests.push({
    name: "key_unlock_build",
    ok: unlocked.has("triple_paladin"),
    detail: [...unlocked].join(","),
  });

  const badgeCtx = {
    round: 5,
    playerClass: "priest",
    loadoutItems: [{ uid: "x", itemId: "flame_badge", col: 0, row: 0 }],
    shopModifiers: sb.collectShopPoolModifiers([{ uid: "x", itemId: "flame_badge", col: 0, row: 0 }]),
  };
  tests.push({
    name: "offer_tag_shop_modifiers",
    ok: badgeCtx.shopModifiers.offerTags.has("pyromancer"),
    detail: [...badgeCtx.shopModifiers.offerTags].join(","),
  });

  const battleItem = sb.createPlacedItem("apple", 0, 0);
  battleItem.uid = "apple-1";
  const battleSide = sb.createBattleSide([battleItem], "warrior", {});
  const apple = battleSide.items[0];
  tests.push({
    name: "battle_cooldown_activation",
    ok: apple.currentCooldown < 9000,
    detail: `cd=${apple.currentCooldown}`,
  });

  const broom = sb.createPlacedItem("broom", 0, 0);
  broom.uid = "broom-1";
  const broomSide = sb.createBattleSide([broom], "warrior", {});
  const missState = { player: broomSide, enemy: { hp: 100, maxHp: 100, block: 0 } };
  sb.processOnMissItemEffects(missState, broomSide.items[0], broomSide, missState.enemy, "player");
  const broomRt = broomSide.items[0].runtime || {};
  tests.push({
    name: "attackBuff_on_miss_broom",
    ok: (broomRt.pendingAttackBuff || 0) >= 2,
    detail: `pendingAttackBuff=${broomRt.pendingAttackBuff || 0}`,
  });

  return tests;
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function main() {
  const { sandbox: sb, catalog } = loadSandbox();
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/item-pool-120-manifest.json"), "utf8"));
  const helpers = {
    getAmplifierDef: sb.getAmplifierDef,
  };

  const rows = [];
  let ok = 0;
  let warn = 0;
  let fail = 0;

  for (const id of manifest.items) {
    const def = catalog[id];
    if (!def) {
      rows.push({ id, status: "FAIL", activity: "none", paths: "", issues: "missing from ITEM_CATALOG" });
      fail += 1;
      continue;
    }
    const { paths, issues, activity } = classifyItem(def, helpers);
    const critical = issues.filter((i) => !i.includes("synergyHint") && !i.includes("attackBuff uses value"));
    const status = critical.length ? "FAIL" : issues.length ? "WARN" : paths.length ? "OK" : "FAIL";
    if (status === "OK") ok += 1;
    else if (status === "WARN") warn += 1;
    else fail += 1;
    rows.push({
      id,
      status,
      activity,
      paths: paths.join("|"),
      issues: issues.join("; "),
    });
  }

  const integration = runIntegrationTests(sb);
  const intFails = integration.filter((t) => !t.ok);

  fs.writeFileSync(
    OUT_JSON,
    `${JSON.stringify({ summary: { ok, warn, fail, total: rows.length }, integration, rows }, null, 2)}\n`,
  );
  const header = "id,status,activity,paths,issues\n";
  fs.writeFileSync(
    OUT_CSV,
    header +
      rows.map((r) => [r.id, r.status, r.activity, r.paths, r.issues].map(csvEscape).join(",")).join("\n") +
      "\n",
  );

  console.log("=== Item mechanics audit ===\n");
  console.log(`Пул: ${rows.length} · OK ${ok} · WARN ${warn} · FAIL ${fail}`);
  console.log("\nИнтеграционные тесты:");
  integration.forEach((t) => {
    console.log(`  ${t.ok ? "✓" : "✗"} ${t.name}: ${t.detail}`);
  });

  const fails = rows.filter((r) => r.status === "FAIL");
  if (fails.length) {
    console.log(`\nFAIL (${fails.length}):`);
    fails.slice(0, 15).forEach((r) => {
      console.log(`  ${r.id}: ${r.issues || "no paths"}`);
    });
    if (fails.length > 15) console.log(`  …ещё ${fails.length - 15}`);
  }

  const warns = rows.filter((r) => r.status === "WARN");
  if (warns.length) {
    console.log(`\nWARN (${warns.length}):`);
    warns.slice(0, 10).forEach((r) => {
      console.log(`  ${r.id}: ${r.issues}`);
    });
  }

  console.log(`\n→ ${OUT_CSV}`);

  if (fail > 0 || intFails.length) process.exit(1);
}

main();
