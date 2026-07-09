/**
 * Тесты слотов размещения (⭐ / ◆).
 * node tools/placement-slots.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

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
    window: null,
    document: { documentElement: { dataset: {} } },
    localStorage: { getItem: () => null },
    CRAFT_OUTPUT_IDS: new Set(),
    getCraftOutputItemIds: () => [],
    isCraftOutputItemId: () => false,
    MAX_POISON_BONUS_PER_ITEM: 4,
    clampCooldownMult: (v) => v,
    clampItemRuntimeBonuses: () => {},
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  const files = [
    "items.js",
    "items-catalog.js",
    "backpack-engine.js",
    "systems/placement-slots.js",
    "systems/placement-slots-catalog.js",
  ];
  files.forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), ctx);
  });
  return sandbox;
}

function run() {
  const s = loadSandbox();
  const {
    getPlacementSlotsForItem,
    getPlacementSlotCell,
    collectActivePlacementSlots,
    applyPlacementSlotModifiers,
    createRuntimeState,
  } = s;

  assert(getPlacementSlotsForItem("apple").length === 1, "apple has star slot");

  const host = { uid: "h1", itemId: "apple", col: 2, row: 3, rotation: 0 };
  const guest = { uid: "g1", itemId: "banana", col: 3, row: 3, rotation: 0 };
  const [sc, sr] = getPlacementSlotCell(host, getPlacementSlotsForItem("apple")[0]);
  assert(sc === 3 && sr === 3, "star cell to the right of apple");

  const active = collectActivePlacementSlots([host, guest]);
  assert(active.length === 1, "banana fills apple star");
  assert(active[0].guestId === "banana", "guest is banana");

  host.runtime = createRuntimeState(host);
  guest.runtime = createRuntimeState(guest);
  s.applySynergyModifiers([host, guest]);
  assert((host.runtime.healBonus || 0) >= 1, "host gets heal bonus from star");

  const host2 = { uid: "h2", itemId: "apple", col: 0, row: 0, rotation: 0 };
  const badGuest = { uid: "g2", itemId: "wooden_sword", col: 1, row: 0, rotation: 0 };
  assert(collectActivePlacementSlots([host2, badGuest]).length === 0, "weapon does not fill food star");

  console.log("placement-slots.test.mjs: OK");
}

run();
