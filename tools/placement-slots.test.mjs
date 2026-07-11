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
    "systems/bb-classic.js",
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

  assert(getPlacementSlotsForItem("pan").length === 1, "pan has food star slot");

  const host = { uid: "h1", itemId: "pan", col: 2, row: 3, rotation: 0 };
  const guest = { uid: "g1", itemId: "apple", col: 3, row: 3, rotation: 0 };
  const [sc, sr] = getPlacementSlotCell(host, getPlacementSlotsForItem("pan")[0]);
  assert(sc === 3 && sr === 3, "star cell to the right of pan");

  const active = collectActivePlacementSlots([host, guest]);
  assert(active.length === 1, "apple fills pan star");
  assert(active[0].guestId === "apple", "guest is apple");

  host.runtime = createRuntimeState(host);
  guest.runtime = createRuntimeState(guest);
  s.applySynergyModifiers([host, guest]);
  assert((host.runtime.damageBonus || 0) >= 1, "pan gets damage bonus from food star");

  const host2 = { uid: "h2", itemId: "pan", col: 0, row: 0, rotation: 0 };
  const badGuest = { uid: "g2", itemId: "wooden_sword", col: 1, row: 0, rotation: 0 };
  assert(collectActivePlacementSlots([host2, badGuest]).length === 0, "weapon does not fill food star");

  const idleStars = s.collectPlacementSlotVisualEntries([host, guest]);
  assert(idleStars.length === 1 && idleStars[0].mode === "active", "idle: one active star on filled slot");
  const idleLinks = s.collectPlacementSlotLinkVisuals([host, guest]);
  assert(idleLinks.length === 1 && idleLinks[0].hostUid === host.uid && idleLinks[0].guestUid === guest.uid,
    "idle: host-guest link");
  assert(s.collectPlacementSlotVisualEntries([host2, badGuest]).length === 0, "idle: no star for incompatible pair");

  const previewFood = { uid: "drag1", itemId: "apple", col: 1, row: 0, rotation: 0 };
  const previewStars = s.collectPlacementSlotVisualEntries([host2, previewFood], { focusUid: "drag1" });
  assert(previewStars.length === 1 && previewStars[0].mode === "preview", "drag preview: food on pan star");
  const previewBad = s.collectPlacementSlotVisualEntries(
    [host2, { uid: "drag2", itemId: "wooden_sword", col: 1, row: 0, rotation: 0 }],
    { focusUid: "drag2" },
  );
  assert(previewBad.length === 0, "drag preview: weapon on food star shows no stars");

  assert(getPlacementSlotsForItem("whetstone").length === 2, "whetstone has 2 weapon stars");

  const whetDrag = { uid: "wd", itemId: "whetstone", col: 2, row: 2, rotation: 0 };
  const whetMarkers = s.collectHostPlacementSlotMarkers(whetDrag);
  assert(whetMarkers.length === 2, "drag host: whetstone shows both star cells");
  assert(whetMarkers.every((m) => m.kind === "star"), "whetstone markers are stars");

  const piggySlotLines = s.getPlacementSlotTooltipLines("piggybank");
  assert(piggySlotLines.length === 1, "piggybank: identical star slots deduped in tooltip");
  assert(
    piggySlotLines[0].includes("Начало боя") && piggySlotLines[0].includes("+2"),
    "piggybank slot tooltip keeps battle-start effect text",
  );

  s.gameMode = "classic";
  s.selectedGameMode = "classic";
  const whet = { uid: "w1", itemId: "whetstone", col: 2, row: 2, rotation: 0 };
  const sword = { uid: "s1", itemId: "wooden_sword", col: 3, row: 2, rotation: 0 };
  const swordFar = { uid: "s2", itemId: "dagger", col: 2, row: 0, rotation: 0 };
  whet.runtime = createRuntimeState(whet);
  sword.runtime = createRuntimeState(sword);
  swordFar.runtime = createRuntimeState(swordFar);
  s.applySynergyModifiers([whet, sword, swordFar]);
  assert((sword.runtime.damageBonus || 0) >= 1, "weapon in star gets damage");
  assert((swordFar.runtime.damageBonus || 0) === 0, "classic: no adjacency bonus off-star");

  const flute = { uid: "f1", itemId: "flute", col: 0, row: 2, rotation: 0 };
  const whetHost = { uid: "wh1", itemId: "whetstone", col: 1, row: 2, rotation: 0 };
  flute.runtime = createRuntimeState(flute);
  s.applySynergyModifiers([flute, whetHost]);
  assert((flute.runtime.cooldownMult || 1) <= 0.91, "flute gets CD from star-host in slot");

  const goob = { uid: "sg1", itemId: "steel_goobert", col: 3, row: 2, rotation: 0 };
  const swordAbove = { uid: "sa1", itemId: "wooden_sword", col: 3, row: 1, rotation: 0 };
  goob.runtime = createRuntimeState(goob);
  swordAbove.runtime = createRuntimeState(swordAbove);
  s.applySynergyModifiers([goob, swordAbove]);
  assert((swordAbove.runtime.damageBonus || 0) >= 2, "steel goobert buffs weapon in star");

  assert(getPlacementSlotsForItem("holy_armor").length === 4, "holy armor has 4 holy stars");
  const armor = { uid: "ha1", itemId: "holy_armor", col: 0, row: 0, rotation: 0 };
  const shell = { uid: "sh1", itemId: "shiny_shell", col: 2, row: 0, rotation: 0 };
  const shellFar = { uid: "sh2", itemId: "shiny_shell", col: 5, row: 5, rotation: 0 };
  assert(
    s.countTagForItemEffect({ items: [armor, shell, shellFar] }, armor, "holy") === 1,
    "classic: holy tag only in star slots",
  );

  assert(getPlacementSlotsForItem("cthulhu").length === 4, "cthulhu has 4 food stars");
  const cth = { uid: "ct1", itemId: "cthulhu", col: 0, row: 0, rotation: 0 };
  const carrot = { uid: "cr1", itemId: "carrot", col: 1, row: 0, rotation: 0 };
  assert(
    s.countTagForItemEffect({ items: [cth, carrot] }, cth, "food") === 1,
    "classic: food in cthulhu star",
  );

  const starHost = { uid: "soc1", itemId: "star_of_courage", col: 1, row: 1, rotation: 0 };
  const knight = { uid: "ks1", itemId: "knight_sword", col: 0, row: 0, rotation: 0 };
  const whetstoneHost = { uid: "ws1", itemId: "whetstone", col: 1, row: 2, rotation: 0 };
  knight.runtime = createRuntimeState(knight);
  s.applySynergyModifiers([knight, starHost, whetstoneHost]);
  assert(
    (knight.runtime.damageBonus || 0) >= 3,
    "classic: knight sword stacks star (+2) and whetstone (+1)",
  );
  assert(
    (knight.runtime.activeSynergies || []).length >= 2,
    "classic: multiple active star sources listed on guest",
  );

  console.log("placement-slots.test.mjs: OK");
}

run();
