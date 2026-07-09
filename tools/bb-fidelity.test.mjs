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

function loadSandbox(gameMode = "classic") {
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
    synergyState: { isDragging: false, previewSynergies: [] },
    synergyPreviewBuilt: null,
    ITEM_CATALOG: {
      flower: {
        id: "flower",
        name: "Flower",
        tags: ["nature", "magic"],
        synergies: [{ neighborTags: ["nature"], adjacency: "strong" }],
      },
      mushroom: {
        id: "mushroom",
        name: "Mushroom",
        tags: ["nature", "food"],
        synergies: [{ neighborTags: ["nature"], adjacency: "weak" }],
      },
      rock: {
        id: "rock",
        name: "Rock",
        tags: ["stone"],
        synergies: [],
      },
    },
    canvasPointToClient: (x, y) => ({ x, y }),
    getItemVisualCenter: () => ({ x: 10, y: 20 }),
    getLoadoutEditState: () => ({ items: [{ uid: "a1", itemId: "flower", col: 1, row: 1 }] }),
    document: { documentElement: { dataset: {} } },
    window: null,
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "systems/bb-fidelity.js"), "utf8"), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "systems/synergy-shop.js"), "utf8"), ctx);
  return sandbox;
}

function run() {
  const classic = loadSandbox("classic");
  assert(classic.isBBFidelityMode(), "classic is BB fidelity");
  assert(classic.isBBFidelityClassic(), "classic profile");
  assert(classic.shouldShowPrepSynergyCommerceFx(), "commerce fx on in classic prep");

  const hint = classic.getShopSynergyHint("mushroom", [
    { uid: "a1", itemId: "flower", col: 1, row: 1 },
  ]);
  assert(hint && hint.partnerUids.includes("a1"), "mushroom synergizes with flower on board");
  assert(hint.strength === "strong" || hint.strength === "weak", "synergy strength");

  const none = classic.getShopSynergyHint("rock", [
    { uid: "a1", itemId: "flower", col: 1, row: 1 },
  ]);
  assert(none === null, "rock has no synergy hint");

  const classes = classic.getShopSynergyExtraClasses("mushroom", [
    { uid: "a1", itemId: "flower", col: 1, row: 1 },
  ]);
  assert(classes.includes("synergy"), "synergy css class");

  const solo = loadSandbox("solo");
  assert(!solo.isBBFidelityMode(), "solo is not BB fidelity");
  assert(solo.shouldShowPrepSynergyCommerceFx() === false, "solo commerce fx off by default");

  const versus = loadSandbox("versus");
  assert(versus.isBBFidelityVersus(), "versus profile");
  assert(versus.shouldShowPrepSynergyCommerceFx(), "versus commerce fx on");
  assert(versus.shouldUseBBVsScreen(), "versus uses BB VS screen in prep");

  const classicVs = loadSandbox("classic");
  classicVs.phase = "battle";
  assert(!classicVs.shouldUseBBVsScreen(), "VS screen only in prep");
  assert(classicVs.shouldUseBBStackBattleLayout(), "classic uses BB battle stack in battle");

  const classicPrep = loadSandbox("classic");
  assert(!classicPrep.shouldUseBBStackBattleLayout(), "battle stack only in battle phase");

  console.log("bb-fidelity.test.mjs: OK");
}

run();
