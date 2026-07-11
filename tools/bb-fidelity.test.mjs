/**
 * Smoke-тесты BB fidelity и synergy-shop.
 * node tools/bb-fidelity.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadCraftSandbox(gameMode = "classic") {
  const sandbox = {
    console,
    Math,
    Object,
    Array,
    Map,
    Set,
    JSON,
    phase: "prep",
    gameMode,
    selectedGameMode: gameMode,
    prepViewSide: "player",
    dragPayload: null,
    dragFrom: null,
    synergyState: { isDragging: false, previewSynergies: [] },
    synergyPreviewBuilt: null,
    canvasPointToClient: (x, y) => ({ x, y }),
    getItemVisualCenter: () => ({ x: 10, y: 20 }),
    getLoadoutEditState: () => ({ items: [], containers: [], bench: [] }),
    getSideState: () => ({ items: [], containers: [], bench: [] }),
    getCraftContextFromGame: () => ({}),
    getComputedStyle: () => ({ getPropertyValue: () => "1" }),
    document: {
      documentElement: { dataset: {}, style: {} },
      getElementById: (id) => (id === "app" ? { dataset: { phase: sandbox.phase } } : null),
    },
    window: null,
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  [
    "systems/bb-fidelity.js",
    "systems/synergy-shop.js",
    "items.js",
    "items-catalog.js",
    "systems/bb-reference-recipes.js",
    "systems/crafting.js",
    "systems/craft-preview.js",
    "systems/craft-shop.js",
  ].forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), ctx);
  });
  return sandbox;
}

function loadSandbox(gameMode = "classic", withCraft = false) {
  const sandbox = {
    console,
    Math,
    Object,
    Array,
    Map,
    Set,
    JSON,
    phase: "prep",
    gameMode,
    selectedGameMode: gameMode,
    prepViewSide: "player",
    dragPayload: null,
    dragFrom: null,
    synergyState: { isDragging: false, previewSynergies: [] },
    synergyPreviewBuilt: null,
    ITEM_CATALOG: {
      flower: {
        id: "flower",
        name: "Flower",
        tags: ["nature", "magic"],
        placementSlots: [
          { id: "flower_n", kind: "star", at: [1, 0], acceptTags: ["nature"], desc: "⭐ nature" },
        ],
      },
      mushroom: {
        id: "mushroom",
        name: "Mushroom",
        tags: ["nature", "food"],
        placementSlots: [
          { id: "mush_n", kind: "star", at: [1, 0], acceptTags: ["nature"], desc: "⭐ nature" },
        ],
      },
      rock: {
        id: "rock",
        name: "Rock",
        tags: ["stone"],
        synergies: [],
      },
      rusty_sword: { id: "rusty_sword", name: "Rusty Sword" },
      whetstone: { id: "whetstone", name: "Whetstone" },
      hero_sword: { id: "hero_sword", name: "Hero Sword" },
    },
    canvasPointToClient: (x, y) => ({ x, y }),
    getItemVisualCenter: () => ({ x: 10, y: 20 }),
    getLoadoutEditState: () => ({
      items: [{ uid: "s1", itemId: "rusty_sword", col: 1, row: 1 }],
      containers: [],
      bench: [],
    }),
    getSideState: () => ({
      items: [{ uid: "s1", itemId: "rusty_sword", col: 1, row: 1 }],
      containers: [],
      bench: [],
    }),
    getCraftContextFromGame: () => ({}),
    getComputedStyle: () => ({ getPropertyValue: () => "1" }),
    document: {
      documentElement: { dataset: {}, style: {} },
      getElementById: (id) => (id === "app" ? { dataset: { phase: sandbox.phase } } : null),
    },
    window: null,
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "systems/bb-fidelity.js"), "utf8"), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "systems/placement-slots.js"), "utf8"), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "systems/synergy-shop.js"), "utf8"), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "systems/craft-shop.js"), "utf8"), ctx);
  if (withCraft) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, "systems/crafting.js"), "utf8"), ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, "systems/craft-preview.js"), "utf8"), ctx);
  }
  return sandbox;
}

function run() {
  const classic = loadSandbox("classic");
  assert(classic.isBBFidelityMode(), "classic is BB fidelity");
  assert(classic.isBBFidelityClassic(), "classic profile");
  assert(classic.shouldShowPrepSynergyCommerceFx() === false, "synergy commerce fx disabled");
  assert(classic.shouldShowPrepCraftCommerceFx(), "craft commerce fx on in classic prep");

  const hint = classic.getShopSynergyHint("mushroom", [
    { uid: "a1", itemId: "flower", col: 1, row: 1 },
  ]);
  assert(hint && hint.partnerUids.includes("a1"), "mushroom synergizes with flower on board");
  assert(hint.strength === "strong", "placement slot synergy strength");

  const none = classic.getShopSynergyHint("rock", [
    { uid: "a1", itemId: "flower", col: 1, row: 1 },
  ]);
  assert(none === null, "rock has no synergy hint");

  const classes = classic.getShopSynergyExtraClasses("mushroom", [
    { uid: "a1", itemId: "flower", col: 1, row: 1 },
  ]);
  assert(classes === "", "synergy css class disabled");

  const craft = loadSandbox("classic", true);
  const craftHint = craft.getShopCraftHint(
    "whetstone",
    [],
    [{ uid: "s1", itemId: "rusty_sword", col: 1, row: 1 }],
    [],
  );
  assert(craftHint && craftHint.boardUids.includes("s1"), "whetstone crafts with rusty_sword on board");
  assert(craftHint.benchIndices.length === 0, "no bench partner for whetstone hint");

  const craftClasses = craft.getShopCraftExtraClasses(
    "whetstone",
    [],
    [{ uid: "s1", itemId: "rusty_sword", col: 1, row: 1 }],
    [],
    "player",
  );
  assert(craftClasses.includes("craft"), "craft css class");

  const craftTargets = craft.getShopCraftTetherTargetsForItem(
    "whetstone",
    [],
    [{ uid: "s1", itemId: "rusty_sword", col: 1, row: 1 }],
    [{ itemId: "whetstone" }],
    "player",
  );
  assert(craftTargets.length === 1, "shop craft tether only to board partner");

  const noBenchHint = craft.getShopCraftHint(
    "whetstone",
    [],
    [],
    [{ itemId: "rusty_sword" }],
  );
  assert(noBenchHint === null, "bench-only partner does not highlight shop craft");

  craft.dragPayload = { itemId: "whetstone" };
  craft.dragFrom = { type: "shop", side: "player" };
  const dragTargets = craft.resolveActiveDragCraftTetherTargets("player");
  assert(dragTargets.length >= 1, "drag craft tether targets");

  const fullCraft = loadCraftSandbox("classic");
  const mushroomBoard = [{ uid: "m1", itemId: "fly_agaric", col: 2, row: 1 }];
  fullCraft.getLoadoutEditState = () => ({ items: mushroomBoard, containers: [], bench: [] });
  fullCraft.getSideState = () => ({ items: mushroomBoard, containers: [], bench: [] });
  assert(fullCraft.getShopCraftHint("wooden_buckler", [], mushroomBoard, []) === null,
    "wooden_buckler does not craft with fly_agaric on board");
  assert(fullCraft.getShopSynergyHint("wooden_buckler", mushroomBoard) === null,
    "wooden_buckler has no shop synergy with fly_agaric");
  fullCraft.dragPayload = { itemId: "wooden_buckler" };
  fullCraft.dragFrom = { type: "shop", side: "player" };
  assert(fullCraft.resolveActiveDragCraftTetherTargets("player").length === 0,
    "no craft tether for wooden_buckler + fly_agaric");
  fullCraft.synergyState = { isDragging: true, previewSynergies: [] };
  assert(fullCraft.resolveActiveDragSynergyTetherTargets("player").length === 0,
    "no synergy drag tether without placement preview");

  assert(craft.getShopCraftExtraClasses(
    "whetstone",
    [],
    [{ uid: "s1", itemId: "rusty_sword" }],
    [],
    "player",
  ) !== "", "classic craft commerce fx on");

  assert(classic.shouldUseBBVsScreen(), "classic uses BB VS screen in prep");
  assert(!classic.shouldRotateBBPrepField90(), "prep field not rotated (portrait grid)");

  const classicVs = loadSandbox("classic");
  classicVs.phase = "battle";
  assert(!classicVs.shouldUseBBVsScreen(), "VS screen only in prep");
  assert(classicVs.shouldUseBBStackBattleLayout(), "classic uses BB battle stack in battle");

  const classicPrep = loadSandbox("classic");
  assert(!classicPrep.shouldUseBBStackBattleLayout(), "battle stack only in battle phase");
  assert(classicPrep.shouldUseBBRoundResultScreen(), "classic uses BB round result");
  assert(classicPrep.shouldUseBBRunCompleteScreen(), "classic uses BB run complete");
  assert(classicPrep.shouldUseBBRunLives(), "classic uses run lives");
  assert(classicPrep.getBBRunLivesMax() === 4, "4 run lives");
  assert(classicPrep.shouldSkipBBCompanionIntro(), "classic skips companion in BB");

  const classicIntro = loadSandbox("classic");
  classicIntro.document = {
    documentElement: { dataset: {} },
    getElementById: (id) => {
      if (id === "class-overlay") {
        return { classList: { contains: () => false } };
      }
      return null;
    },
  };
  assert(classicIntro.shouldUseBBIntroLayout(), "BB intro on hero steps for classic");

  const desktopMouse = loadSandbox("classic");
  desktopMouse.window = {
    innerWidth: 1440,
    innerHeight: 900,
    matchMedia: (q) => ({ matches: String(q).includes("pointer: fine") }),
  };
  assert(!desktopMouse.shouldUseBBStackPrepLayout(), "desktop fine pointer skips bb-stack");

  const phoneTouch = loadSandbox("classic");
  phoneTouch.window = {
    innerWidth: 390,
    innerHeight: 844,
    matchMedia: () => ({ matches: false }),
  };
  assert(phoneTouch.shouldUseBBStackPrepLayout(), "phone portrait keeps bb-stack");

  const classicBattle = loadSandbox("classic");
  classicBattle.phase = "battle";
  assert(!classicBattle.shouldUseBBVersusTurnFlow(), "classic no versus turn flow");

  console.log("bb-fidelity.test.mjs: OK");
}

run();
