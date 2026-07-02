/**
 * Тесты PR-A/B: усиления в рюкзаке, магазин, крафт, ключи.
 * Запуск: node tools/enhancement-system.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const LOAD_ORDER = [
  "classes.js",
  "systems/item-pool-120.js",
  "items.js",
  "items-catalog.js",
  "systems/mutations.js",
  "systems/enhancements.js",
  "systems/enhancement-catalog-ext.js",
  "systems/enhancement-crafting.js",
  "systems/triple-support-items.js",
  "systems/backpack-amplifiers.js",
  "systems/meta-effects.js",
  "shop-engine.js",
  "backpack-engine.js",
  "systems/crafting.js",
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadSandbox(extra = {}) {
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
    round: extra.round ?? 2,
    playerMutationFormId: extra.playerMutationFormId ?? null,
    playerMutationId: extra.playerMutationId ?? null,
    enemyMutationFormId: null,
    enemyMutationId: null,
    prepViewSide: "player",
    playerItems: extra.playerItems ?? [],
    enemyItems: [],
    playerEnhancements: { head: null, chest: null, boots: null },
    enemyEnhancements: { head: null, chest: null, boots: null },
    playerCompanionId: "s_stranger",
    enemyCompanionId: "s_stranger",
    playerClass: "priest",
    enemyClass: "mage",
    gold: 20,
    enemyGold: 20,
  };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  sandbox.document = {
    getElementById: () => null,
    createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }),
    querySelectorAll: () => [],
    querySelector: () => null,
  };
  sandbox.getSideState = (side = "player") => ({
    items: side === "enemy" ? sandbox.enemyItems : sandbox.playerItems,
    gold: side === "enemy" ? sandbox.enemyGold : sandbox.gold,
    classId: side === "enemy" ? sandbox.enemyClass : sandbox.playerClass,
  });
  sandbox.getSideEnhancements = (side) => (
    side === "enemy" ? sandbox.enemyEnhancements : sandbox.playerEnhancements
  );
  sandbox.getSideEnhancementsRaw = sandbox.getSideEnhancements;
  sandbox.getSideCompanionId = () => sandbox.playerCompanionId;
  sandbox.getSideMutationId = () => sandbox.playerMutationId;
  sandbox.getSideMutationFormId = () => sandbox.playerMutationFormId;

  const ctx = vm.createContext(sandbox);
  for (const file of LOAD_ORDER) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), ctx);
  }
  vm.runInContext(`
    Object.assign(globalThis, {
      ITEM_CATALOG,
      ENHANCEMENT_CATALOG,
      registerEnhancementItemsInCatalog,
      syncEnhancementsFromBackpack,
      canPlaceEnhancementItemInLoadout,
      getEnhancementPlacementBlockReason,
      rollShopEnhancementEntry,
      getShopEligibleKeyItems,
      getEnhancementCraftRecipes,
      isCraftRecipeAvailable,
      collectUnlockedBuilds,
      tryResolveCrafting,
      resolveMutationProgress,
      isShopEligibleItem,
      ITEM_RECIPES,
      buildSlotSet,
      canPlaceInLoadout,
      createPlacedItem,
      getStrongCraftComponents,
      getAdjacentItems,
      collectLoadoutTags,
      getAmplifierDef,
      itemMatchesAmplifierTarget,
      collectAmplifiersInLoadout,
      collectAmplifyHighlightedItems,
      getShopEligibleAmplifiers,
      tryRollShopAmplifier,
      isAmplifierBackpackItem,
      scoreShopItemPickWeight,
      BUILD_UNLOCK_CATALOG,
    });
  `, ctx);
  return sandbox;
}

function testCatalogRegistration(sb) {
  const ids = [
    "enh_stray_charm",
    "enh_defeated_breastplate",
    "enh_holy_aegis",
    "enh_shadow_hood",
    "enh_guardian_sabatons",
    "key_ember_codex",
    "key_paladin_oath",
    "weapon_holy_mace",
    "armor_holy_choir",
  ];
  ids.forEach((id) => {
    assert(sb.ITEM_CATALOG[id], `каталог: ${id}`);
  });
  const implemented = Object.values(sb.ENHANCEMENT_CATALOG).filter((d) => d.implemented);
  assert(implemented.length === 24, `24 усиления, got ${implemented.length}`);
  assert(sb.ITEM_CATALOG.fire_staff?.recommendedTriple === "triple_pyro_mage", "patch fire_staff");
  assert(sb.ITEM_CATALOG.weapon_holy_mace?.recommendedTriple === "triple_paladin", "holy mace triple");
  assert(sb.ITEM_CATALOG.enh_holy_aegis.shape?.length === 1, "holy_aegis shape 1x1");
  assert(sb.ITEM_CATALOG.enh_holy_aegis.craftOnly, "holy_aegis только крафт");
  assert(!sb.ITEM_CATALOG.enh_stray_charm.craftOnly, "stray_charm в магазине");
  assert(sb.ITEM_CATALOG.key_ember_codex.isBuildKey, "ключ пироманта");
  assert(sb.isShopEligibleItem(sb.ITEM_CATALOG.enh_stray_charm) === false, "усиления не в общем пуле");
  assert(sb.isShopEligibleItem(sb.ITEM_CATALOG.key_ember_codex) === false, "ключи не в общем пуле");
}

function testBackpackSync(sb) {
  sb.playerItems = [{ uid: "a", itemId: "enh_stray_charm", col: 1, row: 1 }];
  sb.syncEnhancementsFromBackpack(sb.playerItems, sb.playerEnhancements, 2);
  assert(sb.playerEnhancements.head === "enh_stray_charm", "sync head");

  sb.playerItems = [];
  sb.playerEnhancements = { head: null, chest: null, boots: null };
  sb.syncEnhancementsFromBackpack(sb.playerItems, sb.playerEnhancements, 2);
  assert(sb.playerEnhancements.head === null, "пустой рюкзак");
}

function testPlacementRules(sb) {
  const headItems = [{ uid: "a", itemId: "enh_stray_charm", col: 0, row: 0 }];
  assert(
    !sb.canPlaceEnhancementItemInLoadout("enh_ember_crown", headItems, null, 2),
    "две головы нельзя",
  );
  assert(
    sb.canPlaceEnhancementItemInLoadout("enh_defeated_breastplate", headItems, null, 6),
    "грудь при одной голове ок",
  );
  assert(
    !sb.canPlaceEnhancementItemInLoadout("enh_ember_crown", headItems, null, 1),
    "голова заблокирована до R2",
  );
  assert(
    !sb.canPlaceEnhancementItemInLoadout("enh_defeated_breastplate", headItems, null, 5),
    "грудь до R6",
  );
}

function testShopRollIds(sb) {
  const ctx = {
    round: 6,
    loadoutItems: [],
    companionId: "s_spark",
    mutationId: "m_pyro",
    unlockedBuilds: new Set(),
  };
  const entry = sb.rollShopEnhancementEntry(ctx);
  if (entry) {
    assert(!entry.startsWith("enh:"), `магазин без префикса enh:, got ${entry}`);
    assert(sb.ITEM_CATALOG[entry]?.isEnhancementItem, `id в каталоге: ${entry}`);
  }
  const keyPool = sb.getShopEligibleKeyItems({ round: 5, loadoutItems: [] });
  assert(keyPool.length === 4, "4 ключа в пуле с R4+");
}

function testCraftRecipes(sb) {
  const recipes = sb.getEnhancementCraftRecipes();
  assert(recipes.length === 8, "8 грудных/ботиночных рецептов");
  assert(sb.ITEM_RECIPES.some((r) => r.output === "enh_holy_aegis"), "рецепт в ITEM_RECIPES");

  const guardian = recipes.find((r) => r.output === "enh_guardian_mail");
  const blocked = sb.isCraftRecipeAvailable(guardian, {
    round: 5,
    loadoutItems: [{ itemId: "leather_armor" }],
    mutationFormId: "w_guardian",
    unlockedBuilds: new Set(),
  });
  assert(!blocked, "guardian заблокирован до R6");

  const ok = sb.isCraftRecipeAvailable(guardian, {
    round: 6,
    loadoutItems: [{ itemId: "leather_armor" }],
    mutationFormId: "w_guardian",
    unlockedBuilds: new Set(),
  });
  assert(ok, "guardian с формой R8");

  const zealot = recipes.find((r) => r.output === "enh_zealot_vestment");
  const withKey = sb.isCraftRecipeAvailable(zealot, {
    round: 6,
    loadoutItems: [{ itemId: "key_hymn_folio" }, { itemId: "holy_armor" }],
    mutationFormId: null,
    unlockedBuilds: sb.collectUnlockedBuilds([
      { itemId: "key_hymn_folio" },
      { itemId: "holy_armor" },
    ]),
  });
  assert(withKey, "zealot с ключом и holy");

  const blockedZealot = sb.isCraftRecipeAvailable(zealot, {
    round: 6,
    loadoutItems: [{ itemId: "holy_armor" }],
    mutationFormId: null,
    unlockedBuilds: new Set(),
  });
  assert(!blockedZealot, "zealot без ключа/формы");
}

function testTripleShopBias(sb) {
  const item = sb.ITEM_CATALOG.weapon_holy_mace;
  const base = sb.scoreShopItemPickWeight(item, { loadoutItems: [], unlockedBuilds: new Set() });
  const boosted = sb.scoreShopItemPickWeight(item, {
    loadoutItems: [{ itemId: "key_paladin_oath" }],
    unlockedBuilds: sb.collectUnlockedBuilds([{ itemId: "key_paladin_oath" }]),
    mutationId: "p_paladin",
    companionId: "s_blade",
  });
  assert(boosted > base, "bias опоры с ключом паладина");
  assert(sb.BUILD_UNLOCK_CATALOG.triple_assassin?.supportItemIds?.includes("dagger"), "assassin triple supports");
}

function testCraftPipeline(sb) {
  const containers = [{
    uid: "bag",
    itemId: "starter_bag",
    col: 3,
    row: 2,
    rotation: 0,
  }];
  const items = [
    { uid: "i1", itemId: "dagger", col: 3, row: 2 },
    { uid: "i2", itemId: "pestilence_flask", col: 4, row: 2 },
  ];
  const result = sb.tryResolveCrafting(containers, items, { round: 1, loadoutItems: items });
  assert(result.crafted.length === 1, "базовый крафт сработал");
  assert(result.crafted[0].output === "poison_dagger", "poison_dagger");
}

function testEnhancementCraftCluster(sb) {
  const containers = [{
    uid: "bag",
    itemId: "starter_bag",
    col: 3,
    row: 2,
    rotation: 0,
  }];
  const items = [
    { uid: "i1", itemId: "leather_armor", col: 3, row: 2 },
    { uid: "i2", itemId: "wooden_buckler", col: 5, row: 2 },
  ];
  const recipe = sb.ITEM_RECIPES.find((r) => r.output === "enh_guardian_mail");
  const comps = sb.getStrongCraftComponents(items);
  const matched = comps.some((cluster) => {
    const ids = cluster.map((i) => i.itemId).sort().join("+");
    return ids === "leather_armor+wooden_buckler";
  });
  assert(matched, "кластер leather+shield связан");
  const ctx = {
    round: 6,
    loadoutItems: items,
    mutationFormId: "w_guardian",
    unlockedBuilds: new Set(),
  };
  assert(sb.isCraftRecipeAvailable(recipe, ctx), "рецепт guardian доступен");
}

function testAmplifiers(sb) {
  assert(sb.ITEM_CATALOG.amplify_fire?.isAmplifierItem, "amplify_fire в каталоге");
  assert(sb.ITEM_CATALOG.amplify_fire.shape?.length === 1, "amplify 1x1");
  assert(!sb.isShopEligibleItem(sb.ITEM_CATALOG.amplify_fire), "усилители не в общем пуле");

  assert(sb.itemMatchesAmplifierTarget("fire_staff", sb.getAmplifierDef("amplify_fire")), "staff+fire amp");
  assert(sb.itemMatchesAmplifierTarget("enh_ember_crown", sb.getAmplifierDef("amplify_fire")), "ember crown fire");
  assert(!sb.itemMatchesAmplifierTarget("dagger", sb.getAmplifierDef("amplify_fire")), "dagger не fire");

  assert(sb.itemMatchesAmplifierTarget("fire_staff", sb.getAmplifierDef("amplify_staff")), "staff equip");
  assert(sb.itemMatchesAmplifierTarget("leather_armor", sb.getAmplifierDef("amplify_chest")), "chest armor");

  const items = [
    { uid: "a", itemId: "amplify_fire", col: 1, row: 1 },
    { uid: "b", itemId: "fire_staff", col: 2, row: 1 },
    { uid: "c", itemId: "dagger", col: 3, row: 1 },
  ];
  const amps = sb.collectAmplifiersInLoadout(items);
  assert(amps.length === 1 && amps[0].id === "amplify_fire", "collect amplifiers");
  const hi = sb.collectAmplifyHighlightedItems(items, amps);
  assert(hi.length === 1 && hi[0].item.itemId === "fire_staff", "highlight fire_staff");

  const pool = sb.getShopEligibleAmplifiers({ round: 3, loadoutItems: [] });
  assert(pool.length === 10, "10 усилителей в пуле R3+");
  const blocked = sb.getShopEligibleAmplifiers({ round: 2, loadoutItems: [] });
  assert(blocked.length === 0, "до R3 пул пуст");
}

function testMutationTags(sb) {
  sb.playerItems = [{ uid: "x", itemId: "enh_ember_crown", col: 0, row: 0 }];
  sb.syncEnhancementsFromBackpack(sb.playerItems, sb.playerEnhancements, 2);
  const progress = sb.resolveMutationProgress({
    classId: "mage",
    companionId: "s_spark",
    items: sb.playerItems,
    enhancements: sb.playerEnhancements,
    round: 8,
  });
  assert(progress && typeof progress.leaderShare === "number", "прогресс мутации");
}

async function testPrepShopDragPlaywright() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.log("  skip e2e: playwright недоступен");
    return;
  }
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    console.log(`  skip e2e: ${err.message.split("\n")[0]}`);
    return;
  }
  const page = await browser.newPage();
  const baseUrl = `file://${path.join(ROOT, "index.html")}`;
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => typeof startRunFromOverlay === "function", { timeout: 15000 });

    await page.evaluate(() => {
      selectGameMode("solo");
      selectPlayerClass("priest");
      if (typeof selectCompanion === "function") selectCompanion("s_stranger");
      selectOpponentClass("mage");
      startRunFromOverlay();
    });
    await page.waitForFunction(() => document.getElementById("app")?.dataset.phase === "prep", { timeout: 10000 });

    const seeded = await page.evaluate(() => {
      if (typeof registerEnhancementItemsInCatalog === "function") registerEnhancementItemsInCatalog();
      shop[0] = "enh_stray_charm";
      shopReadyForRound = round;
      renderShop();
      const card = document.querySelector('.shop-card[data-item-id="enh_stray_charm"]');
      return {
        hasCard: !!card,
        hasCatalog: !!ITEM_CATALOG.enh_stray_charm,
        isEnhancement: !!ITEM_CATALOG.enh_stray_charm?.isEnhancementItem,
      };
    });
    assert(seeded.hasCatalog, "e2e: enh_stray_charm в каталоге");
    assert(seeded.hasCard, "e2e: карточка в магазине");
    assert(seeded.isEnhancement, "e2e: флаг isEnhancementItem");

    const dragOk = await page.evaluate(() => {
      const def = ITEM_CATALOG.enh_stray_charm;
      if (!def) return { ok: false, reason: "no def" };
      round = 2;
      const st = getSideState("player");
      const slots = [...buildSlotSet(st.containers)];
      if (!slots.length) return { ok: false, reason: "no slots" };
      const free = slots.find((slot) => {
        const [col, row] = slot.split(",").map(Number);
        return canPlaceInLoadout("enh_stray_charm", col, row, 0, st.containers, st.items, null);
      });
      if (!free) {
        return {
          ok: false,
          reason: getEnhancementPlacementBlockReason("enh_stray_charm", st.items, null, round) || "no free cell",
        };
      }
      const [col, row] = free.split(",").map(Number);
      return { ok: true, col, row, gold: st.gold, cost: def.cost };
    });
    assert(dragOk.ok, `e2e: можно положить в рюкзак @${dragOk.col ?? "?"},${dragOk.row ?? "?"} (${dragOk.reason || ""})`);
  } finally {
    await browser.close();
  }
}

async function main() {
  const tests = [
    ["каталог", () => testCatalogRegistration(loadSandbox())],
    ["sync рюкзака", () => testBackpackSync(loadSandbox())],
    ["правила размещения", () => testPlacementRules(loadSandbox())],
    ["магазин id", () => testShopRollIds(loadSandbox())],
    ["крафт доступность", () => testCraftRecipes(loadSandbox())],
    ["triple shop bias", () => testTripleShopBias(loadSandbox())],
    ["крафт pipeline", () => testCraftPipeline(loadSandbox())],
    ["enhancement кластер+рецепт", () => testEnhancementCraftCluster(loadSandbox())],
    ["усилители рюкзака", () => testAmplifiers(loadSandbox())],
    ["мутации+теги", () => testMutationTags(loadSandbox())],
  ];

  let passed = 0;
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      fn();
      console.log(`✓ ${name}`);
      passed += 1;
    } catch (err) {
      console.error(`✗ ${name}: ${err.message}`);
      failed += 1;
    }
  }

  try {
    await testPrepShopDragPlaywright();
    console.log("✓ e2e prep: усиление в рюкзак");
    passed += 1;
  } catch (err) {
    console.error(`✗ e2e prep: ${err.message}`);
    failed += 1;
  }

  console.log(`\nИтого: ${passed} ok, ${failed} fail`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
