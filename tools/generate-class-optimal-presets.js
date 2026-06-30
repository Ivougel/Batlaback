#!/usr/bin/env node
/**
 * Генерация optimal-пресетов через hard bot (с сохранением позиций предметов).
 * node tools/generate-class-optimal-presets.js
 */

const fs = require("fs");
const path = require("path");
const { createSimSandbox, ROOT } = require("./sim-sandbox.js");

const CLASSES = ["warrior", "rogue", "mage", "priest"];
const ROUNDS = [1, 8, 16];
const GRID_W = 9;
const GRID_H = 7;
const TARGET_POWER = 9999;

const PRIEST_HYBRID_ARCHETYPE = {
  priorityTags: ["weapon", "food", "magic"],
  secondaryTags: ["potion", "nature"],
};

const sandbox = createSimSandbox();

function countWeapons(items) {
  return items.filter((item) => sandbox.ITEM_CATALOG[item.itemId]?.tags?.includes("weapon")).length;
}

function countFood(items) {
  return typeof sandbox.countFoodItemsInLoadout === "function"
    ? sandbox.countFoodItemsInLoadout(items)
    : items.filter((item) => sandbox.ITEM_CATALOG[item.itemId]?.tags?.includes("food")).length;
}

function serializeItems(items) {
  return items.map((item) => ({
    itemId: item.itemId,
    col: item.col,
    row: item.row,
    rotation: item.rotation || 0,
  }));
}

function buildOptimalPreset(classId, round, variant = "opt") {
  const savedArchetype = variant === "hybrid" && classId === "priest"
    ? { ...sandbox.AI_ARCHETYPES.priest }
    : null;

  if (savedArchetype) {
    sandbox.AI_ARCHETYPES.priest = {
      ...sandbox.AI_ARCHETYPES.priest,
      ...PRIEST_HYBRID_ARCHETYPE,
    };
  }

  const containers = sandbox.createStartingContainers(GRID_W, GRID_H);
  let items = sandbox.applyClassStarters(containers, [], classId);
  items = sandbox.buildHardBotOptimalLoadout(
    containers,
    items,
    classId,
    round,
    GRID_W,
    GRID_H,
    TARGET_POWER,
  );

  if (typeof sandbox.applySynergyModifiers === "function") {
    sandbox.applySynergyModifiers(items);
  }

  const power = sandbox.measureHardBotPower(containers, items, classId);
  const cls = sandbox.getClassById(classId);
  const key = variant === "hybrid"
    ? `${classId}_r${round}_hybrid_opt`
    : `${classId}_r${round}_opt`;

  if (savedArchetype) {
    sandbox.AI_ARCHETYPES.priest = savedArchetype;
  }

  return {
    key,
    label: variant === "hybrid"
      ? `${cls?.name || classId} hybrid optimal R${round}`
      : `${cls?.name || classId} bot-optimal R${round}`,
    classId,
    round,
    variant,
    power,
    itemCount: items.length,
    weaponCount: countWeapons(items),
    foodCount: countFood(items),
    items: serializeItems(items),
    itemIds: [...new Set(items.map((i) => i.itemId))],
  };
}

function main() {
  const presets = {};
  const summary = [];

  for (const classId of CLASSES) {
    for (const round of ROUNDS) {
      const preset = buildOptimalPreset(classId, round, "opt");
      presets[preset.key] = preset;
      summary.push({
        key: preset.key,
        classId,
        round,
        variant: "opt",
        power: preset.power,
        items: preset.itemCount,
        weapons: preset.weaponCount,
        food: preset.foodCount,
        topItems: preset.itemIds.slice(0, 8).join(", "),
      });

      if (classId === "priest") {
        const hybrid = buildOptimalPreset(classId, round, "hybrid");
        presets[hybrid.key] = hybrid;
        summary.push({
          key: hybrid.key,
          classId,
          round,
          variant: "hybrid",
          power: hybrid.power,
          items: hybrid.itemCount,
          weapons: hybrid.weaponCount,
          food: hybrid.foodCount,
          topItems: hybrid.itemIds.slice(0, 8).join(", "),
        });
      }
    }
  }

  const outPath = path.join(__dirname, "class-optimal-presets.json");
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), presets }, null, 2), "utf8");

  console.log("=== Optimal presets (hard bot, targetPower=max) ===\n");
  console.log(
    "Key".padEnd(24),
    "PWR".padStart(5),
    "Itm".padStart(4),
    "Wpn".padStart(4),
    "Food".padStart(5),
    "Top items",
  );
  for (const row of summary) {
    console.log(
      row.key.padEnd(24),
      String(row.power).padStart(5),
      String(row.items).padStart(4),
      String(row.weapons).padStart(4),
      String(row.food).padStart(5),
      row.topItems,
    );
  }
  console.log(`\nJSON → ${outPath}`);
}

main();
