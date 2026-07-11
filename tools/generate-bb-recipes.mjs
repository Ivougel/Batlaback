#!/usr/bin/env node
/**
 * Генерирует systems/bb-reference-recipes.js — рецепты BB (classic fidelity).
 * Источник: backpackbattles.wiki.gg/wiki/Recipe + валидация ID в каталоге.
 * node tools/generate-bb-recipes.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "systems/bb-reference-recipes.js");

/** [outputId, ...ingredientIds] — порядок как в BB (катализаторы пока не поддержаны). */
const RAW_RECIPES = [
  ["hero_sword", "wooden_sword", "whetstone", "whetstone"],
  ["hero_long_sword", "hero_sword", "whetstone", "whetstone"],
  ["falcon_blade", "hero_sword", "gloves_of_haste", "gloves_of_haste"],
  ["crossblades", "falcon_blade", "hero_long_sword"],
  ["poison_dagger", "dagger", "pestilence_flask"],
  ["spectral_dagger", "dagger", "mana_crystal"],
  ["manathirst", "hungry_blade", "mana_crystal"],
  ["magic_staff", "broom", "mana_crystal"],
  ["enchanted_staff", "broom", "mana_crystal"],
  ["shovel", "broom", "pan"],
  ["eggscalibur", "pan", "heroic_potion"],
  ["torch", "wooden_sword", "lump_of_coal"],
  ["bloodthorne", "hungry_blade", "thorn_whip"],
  ["bloody_dagger", "dagger", "blood_amulet"],
  ["katana", "ripsaw_blade", "whetstone"],
  ["burning_blade", "hero_long_sword", "lump_of_coal", "lump_of_coal"],
  ["burning_sword", "hero_sword", "lump_of_coal", "lump_of_coal"],
  ["flame_whip", "thorn_whip", "lump_of_coal", "lump_of_coal"],
  ["molten_dagger", "dagger", "lump_of_coal", "lump_of_coal"],
  ["molten_spear", "spear", "lump_of_coal", "lump_of_coal"],
  ["staff_of_fire", "magic_staff", "draconic_orb"],
  ["serpent_staff", "magic_staff", "pestilence_flask"],
  ["staff_of_unhealing", "magic_staff", "demonic_flask"],
  ["critwood_staff", "magic_staff", "acorn_collar"],
  ["fortunas_hope", "shortbow", "lucky_charm", "lucky_charm"],
  ["fortunas_grace", "bow_and_arrow", "lucky_charm", "lucky_charm"],
  ["belladonnas_shade", "shortbow", "pestilence_flask"],
  ["belladonnas_whisper", "bow_and_arrow", "pestilence_flask"],
  ["tusk_poker", "shortbow", "walrus_tusk"],
  ["tusk_piercer", "bow_and_arrow", "walrus_tusk"],
  ["claws_of_attack", "gloves_of_haste", "walrus_tusk"],
  ["spiked_shield", "wooden_buckler", "walrus_tusk"],
  ["mana_potion", "health_potion", "blueberries"],
  ["strong_health_potion", "health_potion", "healing_herbs"],
  ["strong_heroic_potion", "heroic_potion", "banana"],
  ["vampiric_armor", "leather_armor", "blood_amulet"],
  ["moon_armor", "holy_armor", "mana_crystal"],
  ["moon_shield", "shield_of_valor", "mana_crystal"],
  ["shell_totem", "wooden_sword", "shiny_shell"],
  ["snow_stick", "broom", "snowball"],
  ["frostbite", "hungry_blade", "snowball"],
  ["holy_spear", "spear", "glowing_crown"],
  ["poison_spear", "spear", "pestilence_flask"],
  ["pandamonium", "pan", "corrupted_crystal"],
  ["darksaber", "lightsaber", "corrupted_crystal"],
  ["burning_torch", "torch", "lump_of_coal"],
  ["war_scythe", "death_scythe", "whetstone"],
  ["strong_pestilence_flask", "pestilence_flask", "fly_agaric"],
  ["strong_demonic_flask", "demonic_flask", "corrupted_crystal"],
  ["frozen_buckler", "wooden_buckler", "snowball"],
  ["ice_armor", "leather_armor", "snowball"],
  ["vampiric_gloves", "gloves_of_haste", "blood_amulet"],
  ["steel_goobert", "goobert", "hero_sword"],
  ["blood_goobert", "goobert", "blood_amulet"],
  ["light_goobert", "goobert", "lightsaber"],
  ["stone_armor", "leather_armor", "stone_skin_potion"],
  ["strong_stone_skin_potion", "stone_skin_potion", "stone", "stone"],
  ["burning_coal", "lump_of_coal", "lump_of_coal"],
  ["shelly", "shiny_shell", "health_potion"],
  ["cap_of_discomfort", "cap_of_resilience", "corrupted_crystal"],
  ["corrupted_armor", "holy_armor", "corrupted_crystal"],
  ["heart_of_darkness", "heart_container", "corrupted_crystal"],
  ["vampiric_potion", "strong_health_potion", "blood_amulet"],
  ["winged_boots", "leather_boots", "divine_potion"],
  ["stone_helm", "cap_of_resilience", "stone_skin_potion"],
  ["stone_shoes", "leather_boots", "stone_skin_potion"],
  ["prismatic_sword", "wooden_sword", "prismatic_orb"],
  ["magic_torch", "torch", "mana_potion"],
  ["magic_torch", "burning_torch", "mana_potion"],
  ["spiked_staff", "magic_staff", "spiked_collar"],
  ["chain_whip", "thorn_whip", "forging_hammer"],
  ["busted_blade", "impractically_large_greatsword", "forging_hammer"],
  ["improved_whetstone", "whetstone", "forging_hammer"],
  ["dragon_claws", "gloves_of_haste", "forging_hammer"],
  ["dragonscale_armor", "leather_armor", "forging_hammer"],
  ["dragonskin_boots", "leather_boots", "forging_hammer"],
  ["chili_goobert", "goobert", "chili_pepper"],
  ["carrot_goobert", "goobert", "carrot", "carrot"],
  ["poison_goobert", "goobert", "fly_agaric", "fly_agaric"],
  ["king_crown", "glowing_crown", "box_of_riches"],
  ["king_goobert", "goobert", "king_crown"],
  ["rat_chef", "rat", "healing_herbs"],
  ["hyper_hedgehog", "hedgehog", "heroic_potion"],
  ["sun_armor", "holy_armor", "lump_of_coal", "lump_of_coal"],
  ["sun_shield", "shield_of_valor", "lump_of_coal", "lump_of_coal"],
  ["blazing_spear", "molten_spear", "lump_of_coal", "lump_of_coal", "lump_of_coal", "lump_of_coal"],
  ["molten_greatsword", "impractically_large_greatsword", "lump_of_coal", "lump_of_coal", "lump_of_coal", "lump_of_coal"],
  ["lucky_piggy", "piggybank", "lucky_charm", "lucky_charm"],
  ["white_lily_collar", "red_orchid_collar", "holy_armor"],
  ["blue_sage_collar", "red_orchid_collar", "mana_crystal"],
  ["red_orchid_collar", "acorn_collar", "blood_amulet"],
  ["pine_protector", "spiked_shield", "pineapple"],
  ["stankus_toothpick", "hero_sword", "garlic"],
  ["boiling_pot", "pan", "wooden_buckler"],
  ["holdall", "leather_armor", "goobert"],
  ["duffle_bag", "leather_armor", "forging_hammer"],
  ["gold_armor", "holy_armor", "bunch_of_coins"],
  ["box_of_prosperity", "box_of_riches", "maneki_neko"],
  ["ruby_whelp", "ruby_egg"],
  ["ruby_chonk", "ruby_whelp", "holo_fire_lizard"],
  ["squirrel_archer", "squirrel", "shortbow"],
  ["doom_cap", "fly_agaric", "demonic_flask"],
];

function loadCatalogIds() {
  const ids = new Set();
  for (const file of [
    "tools/items-migrated.json",
    "tools/items-migrated-legacy.json",
    "tools/bb-reference/items-missing.json",
  ]) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    const data = JSON.parse(fs.readFileSync(full, "utf8"));
    (data.items || []).forEach((item) => ids.add(item.id));
  }
  return ids;
}

function toRecipeRow(row) {
  const [output, ...rest] = row;
  const counts = new Map();
  rest.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
  const inputs = [...counts.entries()].map(([itemId, count]) => ({ itemId, count }));
  const id = inputs.map((i) => `${i.itemId}x${i.count}`).join("_") + `_to_${output}`;
  return { id, output, inputs };
}

function main() {
  const catalogIds = loadCatalogIds();
  const seen = new Set();
  const recipes = [];
  const skipped = [];

  RAW_RECIPES.forEach((row) => {
    const recipe = toRecipeRow(row);
    const key = `${recipe.output}:${recipe.inputs.map((i) => `${i.itemId}x${i.count}`).join("+")}`;
    if (seen.has(key)) return;
    seen.add(key);

    const missing = [recipe.output, ...recipe.inputs.map((i) => i.itemId)]
      .filter((id) => !catalogIds.has(id));
    if (missing.length) {
      skipped.push({ output: recipe.output, missing: [...new Set(missing)] });
      return;
    }
    recipes.push(recipe);
  });

  const body = `/**
 * Рецепты крафта BB — сгенерировано tools/generate-bb-recipes.mjs
 * @see tools/bb-reference/recipes.json (экспорт ниже)
 * Катализаторы BB пока не поддержаны — только полное слияние ингредиентов.
 */
const BB_REFERENCE_RECIPES = ${JSON.stringify(recipes, null, 2)};

window.BB_REFERENCE_RECIPES = BB_REFERENCE_RECIPES;
`;

  fs.writeFileSync(OUT, body);
  fs.writeFileSync(
    path.join(ROOT, "tools/bb-reference/recipes.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), recipes, skipped }, null, 2),
  );

  console.log(`Wrote ${OUT} (${recipes.length} recipes, skipped ${skipped.length})`);
  if (skipped.length) {
    const sample = skipped.slice(0, 8).map((s) => `${s.output}: ${s.missing.join(", ")}`);
    console.log("Skipped sample:", sample.join("\n  "));
  }
}

main();
