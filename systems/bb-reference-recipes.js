/**
 * Рецепты крафта BB — сгенерировано tools/generate-bb-recipes.mjs
 * @see tools/bb-reference/recipes.json (экспорт ниже)
 * Катализаторы BB пока не поддержаны — только полное слияние ингредиентов.
 */
const BB_REFERENCE_RECIPES = [
  {
    "id": "wooden_swordx1_whetstonex2_to_hero_sword",
    "output": "hero_sword",
    "inputs": [
      {
        "itemId": "wooden_sword",
        "count": 1
      },
      {
        "itemId": "whetstone",
        "count": 2
      }
    ]
  },
  {
    "id": "hero_swordx1_whetstonex2_to_hero_long_sword",
    "output": "hero_long_sword",
    "inputs": [
      {
        "itemId": "hero_sword",
        "count": 1
      },
      {
        "itemId": "whetstone",
        "count": 2
      }
    ]
  },
  {
    "id": "hero_swordx1_gloves_of_hastex2_to_falcon_blade",
    "output": "falcon_blade",
    "inputs": [
      {
        "itemId": "hero_sword",
        "count": 1
      },
      {
        "itemId": "gloves_of_haste",
        "count": 2
      }
    ]
  },
  {
    "id": "falcon_bladex1_hero_long_swordx1_to_crossblades",
    "output": "crossblades",
    "inputs": [
      {
        "itemId": "falcon_blade",
        "count": 1
      },
      {
        "itemId": "hero_long_sword",
        "count": 1
      }
    ]
  },
  {
    "id": "daggerx1_pestilence_flaskx1_to_poison_dagger",
    "output": "poison_dagger",
    "inputs": [
      {
        "itemId": "dagger",
        "count": 1
      },
      {
        "itemId": "pestilence_flask",
        "count": 1
      }
    ]
  },
  {
    "id": "daggerx1_mana_crystalx1_to_spectral_dagger",
    "output": "spectral_dagger",
    "inputs": [
      {
        "itemId": "dagger",
        "count": 1
      },
      {
        "itemId": "mana_crystal",
        "count": 1
      }
    ]
  },
  {
    "id": "hungry_bladex1_mana_crystalx1_to_manathirst",
    "output": "manathirst",
    "inputs": [
      {
        "itemId": "hungry_blade",
        "count": 1
      },
      {
        "itemId": "mana_crystal",
        "count": 1
      }
    ]
  },
  {
    "id": "broomx1_mana_crystalx1_to_magic_staff",
    "output": "magic_staff",
    "inputs": [
      {
        "itemId": "broom",
        "count": 1
      },
      {
        "itemId": "mana_crystal",
        "count": 1
      }
    ]
  },
  {
    "id": "broomx1_mana_crystalx1_to_enchanted_staff",
    "output": "enchanted_staff",
    "inputs": [
      {
        "itemId": "broom",
        "count": 1
      },
      {
        "itemId": "mana_crystal",
        "count": 1
      }
    ]
  },
  {
    "id": "broomx1_panx1_to_shovel",
    "output": "shovel",
    "inputs": [
      {
        "itemId": "broom",
        "count": 1
      },
      {
        "itemId": "pan",
        "count": 1
      }
    ]
  },
  {
    "id": "panx1_heroic_potionx1_to_eggscalibur",
    "output": "eggscalibur",
    "inputs": [
      {
        "itemId": "pan",
        "count": 1
      },
      {
        "itemId": "heroic_potion",
        "count": 1
      }
    ]
  },
  {
    "id": "wooden_swordx1_lump_of_coalx1_to_torch",
    "output": "torch",
    "inputs": [
      {
        "itemId": "wooden_sword",
        "count": 1
      },
      {
        "itemId": "lump_of_coal",
        "count": 1
      }
    ]
  },
  {
    "id": "hungry_bladex1_thorn_whipx1_to_bloodthorne",
    "output": "bloodthorne",
    "inputs": [
      {
        "itemId": "hungry_blade",
        "count": 1
      },
      {
        "itemId": "thorn_whip",
        "count": 1
      }
    ]
  },
  {
    "id": "daggerx1_blood_amuletx1_to_bloody_dagger",
    "output": "bloody_dagger",
    "inputs": [
      {
        "itemId": "dagger",
        "count": 1
      },
      {
        "itemId": "blood_amulet",
        "count": 1
      }
    ]
  },
  {
    "id": "ripsaw_bladex1_whetstonex1_to_katana",
    "output": "katana",
    "inputs": [
      {
        "itemId": "ripsaw_blade",
        "count": 1
      },
      {
        "itemId": "whetstone",
        "count": 1
      }
    ]
  },
  {
    "id": "hero_long_swordx1_lump_of_coalx2_to_burning_blade",
    "output": "burning_blade",
    "inputs": [
      {
        "itemId": "hero_long_sword",
        "count": 1
      },
      {
        "itemId": "lump_of_coal",
        "count": 2
      }
    ]
  },
  {
    "id": "hero_swordx1_lump_of_coalx2_to_burning_sword",
    "output": "burning_sword",
    "inputs": [
      {
        "itemId": "hero_sword",
        "count": 1
      },
      {
        "itemId": "lump_of_coal",
        "count": 2
      }
    ]
  },
  {
    "id": "thorn_whipx1_lump_of_coalx2_to_flame_whip",
    "output": "flame_whip",
    "inputs": [
      {
        "itemId": "thorn_whip",
        "count": 1
      },
      {
        "itemId": "lump_of_coal",
        "count": 2
      }
    ]
  },
  {
    "id": "daggerx1_lump_of_coalx2_to_molten_dagger",
    "output": "molten_dagger",
    "inputs": [
      {
        "itemId": "dagger",
        "count": 1
      },
      {
        "itemId": "lump_of_coal",
        "count": 2
      }
    ]
  },
  {
    "id": "spearx1_lump_of_coalx2_to_molten_spear",
    "output": "molten_spear",
    "inputs": [
      {
        "itemId": "spear",
        "count": 1
      },
      {
        "itemId": "lump_of_coal",
        "count": 2
      }
    ]
  },
  {
    "id": "magic_staffx1_draconic_orbx1_to_staff_of_fire",
    "output": "staff_of_fire",
    "inputs": [
      {
        "itemId": "magic_staff",
        "count": 1
      },
      {
        "itemId": "draconic_orb",
        "count": 1
      }
    ]
  },
  {
    "id": "magic_staffx1_pestilence_flaskx1_to_serpent_staff",
    "output": "serpent_staff",
    "inputs": [
      {
        "itemId": "magic_staff",
        "count": 1
      },
      {
        "itemId": "pestilence_flask",
        "count": 1
      }
    ]
  },
  {
    "id": "magic_staffx1_demonic_flaskx1_to_staff_of_unhealing",
    "output": "staff_of_unhealing",
    "inputs": [
      {
        "itemId": "magic_staff",
        "count": 1
      },
      {
        "itemId": "demonic_flask",
        "count": 1
      }
    ]
  },
  {
    "id": "magic_staffx1_acorn_collarx1_to_critwood_staff",
    "output": "critwood_staff",
    "inputs": [
      {
        "itemId": "magic_staff",
        "count": 1
      },
      {
        "itemId": "acorn_collar",
        "count": 1
      }
    ]
  },
  {
    "id": "shortbowx1_lucky_charmx2_to_fortunas_hope",
    "output": "fortunas_hope",
    "inputs": [
      {
        "itemId": "shortbow",
        "count": 1
      },
      {
        "itemId": "lucky_charm",
        "count": 2
      }
    ]
  },
  {
    "id": "bow_and_arrowx1_lucky_charmx2_to_fortunas_grace",
    "output": "fortunas_grace",
    "inputs": [
      {
        "itemId": "bow_and_arrow",
        "count": 1
      },
      {
        "itemId": "lucky_charm",
        "count": 2
      }
    ]
  },
  {
    "id": "shortbowx1_pestilence_flaskx1_to_belladonnas_shade",
    "output": "belladonnas_shade",
    "inputs": [
      {
        "itemId": "shortbow",
        "count": 1
      },
      {
        "itemId": "pestilence_flask",
        "count": 1
      }
    ]
  },
  {
    "id": "bow_and_arrowx1_pestilence_flaskx1_to_belladonnas_whisper",
    "output": "belladonnas_whisper",
    "inputs": [
      {
        "itemId": "bow_and_arrow",
        "count": 1
      },
      {
        "itemId": "pestilence_flask",
        "count": 1
      }
    ]
  },
  {
    "id": "shortbowx1_walrus_tuskx1_to_tusk_poker",
    "output": "tusk_poker",
    "inputs": [
      {
        "itemId": "shortbow",
        "count": 1
      },
      {
        "itemId": "walrus_tusk",
        "count": 1
      }
    ]
  },
  {
    "id": "bow_and_arrowx1_walrus_tuskx1_to_tusk_piercer",
    "output": "tusk_piercer",
    "inputs": [
      {
        "itemId": "bow_and_arrow",
        "count": 1
      },
      {
        "itemId": "walrus_tusk",
        "count": 1
      }
    ]
  },
  {
    "id": "gloves_of_hastex1_walrus_tuskx1_to_claws_of_attack",
    "output": "claws_of_attack",
    "inputs": [
      {
        "itemId": "gloves_of_haste",
        "count": 1
      },
      {
        "itemId": "walrus_tusk",
        "count": 1
      }
    ]
  },
  {
    "id": "wooden_bucklerx1_walrus_tuskx1_to_spiked_shield",
    "output": "spiked_shield",
    "inputs": [
      {
        "itemId": "wooden_buckler",
        "count": 1
      },
      {
        "itemId": "walrus_tusk",
        "count": 1
      }
    ]
  },
  {
    "id": "health_potionx1_blueberriesx1_to_mana_potion",
    "output": "mana_potion",
    "inputs": [
      {
        "itemId": "health_potion",
        "count": 1
      },
      {
        "itemId": "blueberries",
        "count": 1
      }
    ]
  },
  {
    "id": "health_potionx1_healing_herbsx1_to_strong_health_potion",
    "output": "strong_health_potion",
    "inputs": [
      {
        "itemId": "health_potion",
        "count": 1
      },
      {
        "itemId": "healing_herbs",
        "count": 1
      }
    ]
  },
  {
    "id": "heroic_potionx1_bananax1_to_strong_heroic_potion",
    "output": "strong_heroic_potion",
    "inputs": [
      {
        "itemId": "heroic_potion",
        "count": 1
      },
      {
        "itemId": "banana",
        "count": 1
      }
    ]
  },
  {
    "id": "leather_armorx1_blood_amuletx1_to_vampiric_armor",
    "output": "vampiric_armor",
    "inputs": [
      {
        "itemId": "leather_armor",
        "count": 1
      },
      {
        "itemId": "blood_amulet",
        "count": 1
      }
    ]
  },
  {
    "id": "holy_armorx1_mana_crystalx1_to_moon_armor",
    "output": "moon_armor",
    "inputs": [
      {
        "itemId": "holy_armor",
        "count": 1
      },
      {
        "itemId": "mana_crystal",
        "count": 1
      }
    ]
  },
  {
    "id": "shield_of_valorx1_mana_crystalx1_to_moon_shield",
    "output": "moon_shield",
    "inputs": [
      {
        "itemId": "shield_of_valor",
        "count": 1
      },
      {
        "itemId": "mana_crystal",
        "count": 1
      }
    ]
  },
  {
    "id": "wooden_swordx1_shiny_shellx1_to_shell_totem",
    "output": "shell_totem",
    "inputs": [
      {
        "itemId": "wooden_sword",
        "count": 1
      },
      {
        "itemId": "shiny_shell",
        "count": 1
      }
    ]
  },
  {
    "id": "broomx1_snowballx1_to_snow_stick",
    "output": "snow_stick",
    "inputs": [
      {
        "itemId": "broom",
        "count": 1
      },
      {
        "itemId": "snowball",
        "count": 1
      }
    ]
  },
  {
    "id": "hungry_bladex1_snowballx1_to_frostbite",
    "output": "frostbite",
    "inputs": [
      {
        "itemId": "hungry_blade",
        "count": 1
      },
      {
        "itemId": "snowball",
        "count": 1
      }
    ]
  },
  {
    "id": "spearx1_glowing_crownx1_to_holy_spear",
    "output": "holy_spear",
    "inputs": [
      {
        "itemId": "spear",
        "count": 1
      },
      {
        "itemId": "glowing_crown",
        "count": 1
      }
    ]
  },
  {
    "id": "spearx1_pestilence_flaskx1_to_poison_spear",
    "output": "poison_spear",
    "inputs": [
      {
        "itemId": "spear",
        "count": 1
      },
      {
        "itemId": "pestilence_flask",
        "count": 1
      }
    ]
  },
  {
    "id": "panx1_corrupted_crystalx1_to_pandamonium",
    "output": "pandamonium",
    "inputs": [
      {
        "itemId": "pan",
        "count": 1
      },
      {
        "itemId": "corrupted_crystal",
        "count": 1
      }
    ]
  },
  {
    "id": "lightsaberx1_corrupted_crystalx1_to_darksaber",
    "output": "darksaber",
    "inputs": [
      {
        "itemId": "lightsaber",
        "count": 1
      },
      {
        "itemId": "corrupted_crystal",
        "count": 1
      }
    ]
  },
  {
    "id": "torchx1_lump_of_coalx1_to_burning_torch",
    "output": "burning_torch",
    "inputs": [
      {
        "itemId": "torch",
        "count": 1
      },
      {
        "itemId": "lump_of_coal",
        "count": 1
      }
    ]
  },
  {
    "id": "death_scythex1_whetstonex1_to_war_scythe",
    "output": "war_scythe",
    "inputs": [
      {
        "itemId": "death_scythe",
        "count": 1
      },
      {
        "itemId": "whetstone",
        "count": 1
      }
    ]
  },
  {
    "id": "pestilence_flaskx1_fly_agaricx1_to_strong_pestilence_flask",
    "output": "strong_pestilence_flask",
    "inputs": [
      {
        "itemId": "pestilence_flask",
        "count": 1
      },
      {
        "itemId": "fly_agaric",
        "count": 1
      }
    ]
  },
  {
    "id": "demonic_flaskx1_corrupted_crystalx1_to_strong_demonic_flask",
    "output": "strong_demonic_flask",
    "inputs": [
      {
        "itemId": "demonic_flask",
        "count": 1
      },
      {
        "itemId": "corrupted_crystal",
        "count": 1
      }
    ]
  },
  {
    "id": "wooden_bucklerx1_snowballx1_to_frozen_buckler",
    "output": "frozen_buckler",
    "inputs": [
      {
        "itemId": "wooden_buckler",
        "count": 1
      },
      {
        "itemId": "snowball",
        "count": 1
      }
    ]
  },
  {
    "id": "leather_armorx1_snowballx1_to_ice_armor",
    "output": "ice_armor",
    "inputs": [
      {
        "itemId": "leather_armor",
        "count": 1
      },
      {
        "itemId": "snowball",
        "count": 1
      }
    ]
  },
  {
    "id": "gloves_of_hastex1_blood_amuletx1_to_vampiric_gloves",
    "output": "vampiric_gloves",
    "inputs": [
      {
        "itemId": "gloves_of_haste",
        "count": 1
      },
      {
        "itemId": "blood_amulet",
        "count": 1
      }
    ]
  },
  {
    "id": "goobertx1_hero_swordx1_to_steel_goobert",
    "output": "steel_goobert",
    "inputs": [
      {
        "itemId": "goobert",
        "count": 1
      },
      {
        "itemId": "hero_sword",
        "count": 1
      }
    ]
  },
  {
    "id": "goobertx1_blood_amuletx1_to_blood_goobert",
    "output": "blood_goobert",
    "inputs": [
      {
        "itemId": "goobert",
        "count": 1
      },
      {
        "itemId": "blood_amulet",
        "count": 1
      }
    ]
  },
  {
    "id": "goobertx1_lightsaberx1_to_light_goobert",
    "output": "light_goobert",
    "inputs": [
      {
        "itemId": "goobert",
        "count": 1
      },
      {
        "itemId": "lightsaber",
        "count": 1
      }
    ]
  },
  {
    "id": "leather_armorx1_stone_skin_potionx1_to_stone_armor",
    "output": "stone_armor",
    "inputs": [
      {
        "itemId": "leather_armor",
        "count": 1
      },
      {
        "itemId": "stone_skin_potion",
        "count": 1
      }
    ]
  },
  {
    "id": "stone_skin_potionx1_stonex2_to_strong_stone_skin_potion",
    "output": "strong_stone_skin_potion",
    "inputs": [
      {
        "itemId": "stone_skin_potion",
        "count": 1
      },
      {
        "itemId": "stone",
        "count": 2
      }
    ]
  },
  {
    "id": "lump_of_coalx2_to_burning_coal",
    "output": "burning_coal",
    "inputs": [
      {
        "itemId": "lump_of_coal",
        "count": 2
      }
    ]
  },
  {
    "id": "shiny_shellx1_health_potionx1_to_shelly",
    "output": "shelly",
    "inputs": [
      {
        "itemId": "shiny_shell",
        "count": 1
      },
      {
        "itemId": "health_potion",
        "count": 1
      }
    ]
  },
  {
    "id": "cap_of_resiliencex1_corrupted_crystalx1_to_cap_of_discomfort",
    "output": "cap_of_discomfort",
    "inputs": [
      {
        "itemId": "cap_of_resilience",
        "count": 1
      },
      {
        "itemId": "corrupted_crystal",
        "count": 1
      }
    ]
  },
  {
    "id": "holy_armorx1_corrupted_crystalx1_to_corrupted_armor",
    "output": "corrupted_armor",
    "inputs": [
      {
        "itemId": "holy_armor",
        "count": 1
      },
      {
        "itemId": "corrupted_crystal",
        "count": 1
      }
    ]
  },
  {
    "id": "heart_containerx1_corrupted_crystalx1_to_heart_of_darkness",
    "output": "heart_of_darkness",
    "inputs": [
      {
        "itemId": "heart_container",
        "count": 1
      },
      {
        "itemId": "corrupted_crystal",
        "count": 1
      }
    ]
  },
  {
    "id": "strong_health_potionx1_blood_amuletx1_to_vampiric_potion",
    "output": "vampiric_potion",
    "inputs": [
      {
        "itemId": "strong_health_potion",
        "count": 1
      },
      {
        "itemId": "blood_amulet",
        "count": 1
      }
    ]
  },
  {
    "id": "leather_bootsx1_divine_potionx1_to_winged_boots",
    "output": "winged_boots",
    "inputs": [
      {
        "itemId": "leather_boots",
        "count": 1
      },
      {
        "itemId": "divine_potion",
        "count": 1
      }
    ]
  },
  {
    "id": "cap_of_resiliencex1_stone_skin_potionx1_to_stone_helm",
    "output": "stone_helm",
    "inputs": [
      {
        "itemId": "cap_of_resilience",
        "count": 1
      },
      {
        "itemId": "stone_skin_potion",
        "count": 1
      }
    ]
  },
  {
    "id": "leather_bootsx1_stone_skin_potionx1_to_stone_shoes",
    "output": "stone_shoes",
    "inputs": [
      {
        "itemId": "leather_boots",
        "count": 1
      },
      {
        "itemId": "stone_skin_potion",
        "count": 1
      }
    ]
  },
  {
    "id": "wooden_swordx1_prismatic_orbx1_to_prismatic_sword",
    "output": "prismatic_sword",
    "inputs": [
      {
        "itemId": "wooden_sword",
        "count": 1
      },
      {
        "itemId": "prismatic_orb",
        "count": 1
      }
    ]
  },
  {
    "id": "torchx1_mana_potionx1_to_magic_torch",
    "output": "magic_torch",
    "inputs": [
      {
        "itemId": "torch",
        "count": 1
      },
      {
        "itemId": "mana_potion",
        "count": 1
      }
    ]
  },
  {
    "id": "burning_torchx1_mana_potionx1_to_magic_torch",
    "output": "magic_torch",
    "inputs": [
      {
        "itemId": "burning_torch",
        "count": 1
      },
      {
        "itemId": "mana_potion",
        "count": 1
      }
    ]
  },
  {
    "id": "magic_staffx1_spiked_collarx1_to_spiked_staff",
    "output": "spiked_staff",
    "inputs": [
      {
        "itemId": "magic_staff",
        "count": 1
      },
      {
        "itemId": "spiked_collar",
        "count": 1
      }
    ]
  },
  {
    "id": "thorn_whipx1_forging_hammerx1_to_chain_whip",
    "output": "chain_whip",
    "inputs": [
      {
        "itemId": "thorn_whip",
        "count": 1
      },
      {
        "itemId": "forging_hammer",
        "count": 1
      }
    ]
  },
  {
    "id": "impractically_large_greatswordx1_forging_hammerx1_to_busted_blade",
    "output": "busted_blade",
    "inputs": [
      {
        "itemId": "impractically_large_greatsword",
        "count": 1
      },
      {
        "itemId": "forging_hammer",
        "count": 1
      }
    ]
  },
  {
    "id": "whetstonex1_forging_hammerx1_to_improved_whetstone",
    "output": "improved_whetstone",
    "inputs": [
      {
        "itemId": "whetstone",
        "count": 1
      },
      {
        "itemId": "forging_hammer",
        "count": 1
      }
    ]
  },
  {
    "id": "gloves_of_hastex1_forging_hammerx1_to_dragon_claws",
    "output": "dragon_claws",
    "inputs": [
      {
        "itemId": "gloves_of_haste",
        "count": 1
      },
      {
        "itemId": "forging_hammer",
        "count": 1
      }
    ]
  },
  {
    "id": "leather_armorx1_forging_hammerx1_to_dragonscale_armor",
    "output": "dragonscale_armor",
    "inputs": [
      {
        "itemId": "leather_armor",
        "count": 1
      },
      {
        "itemId": "forging_hammer",
        "count": 1
      }
    ]
  },
  {
    "id": "leather_bootsx1_forging_hammerx1_to_dragonskin_boots",
    "output": "dragonskin_boots",
    "inputs": [
      {
        "itemId": "leather_boots",
        "count": 1
      },
      {
        "itemId": "forging_hammer",
        "count": 1
      }
    ]
  },
  {
    "id": "goobertx1_chili_pepperx1_to_chili_goobert",
    "output": "chili_goobert",
    "inputs": [
      {
        "itemId": "goobert",
        "count": 1
      },
      {
        "itemId": "chili_pepper",
        "count": 1
      }
    ]
  },
  {
    "id": "goobertx1_carrotx2_to_carrot_goobert",
    "output": "carrot_goobert",
    "inputs": [
      {
        "itemId": "goobert",
        "count": 1
      },
      {
        "itemId": "carrot",
        "count": 2
      }
    ]
  },
  {
    "id": "goobertx1_fly_agaricx2_to_poison_goobert",
    "output": "poison_goobert",
    "inputs": [
      {
        "itemId": "goobert",
        "count": 1
      },
      {
        "itemId": "fly_agaric",
        "count": 2
      }
    ]
  },
  {
    "id": "ratx1_healing_herbsx1_to_rat_chef",
    "output": "rat_chef",
    "inputs": [
      {
        "itemId": "rat",
        "count": 1
      },
      {
        "itemId": "healing_herbs",
        "count": 1
      }
    ]
  },
  {
    "id": "hedgehogx1_heroic_potionx1_to_hyper_hedgehog",
    "output": "hyper_hedgehog",
    "inputs": [
      {
        "itemId": "hedgehog",
        "count": 1
      },
      {
        "itemId": "heroic_potion",
        "count": 1
      }
    ]
  },
  {
    "id": "holy_armorx1_lump_of_coalx2_to_sun_armor",
    "output": "sun_armor",
    "inputs": [
      {
        "itemId": "holy_armor",
        "count": 1
      },
      {
        "itemId": "lump_of_coal",
        "count": 2
      }
    ]
  },
  {
    "id": "shield_of_valorx1_lump_of_coalx2_to_sun_shield",
    "output": "sun_shield",
    "inputs": [
      {
        "itemId": "shield_of_valor",
        "count": 1
      },
      {
        "itemId": "lump_of_coal",
        "count": 2
      }
    ]
  },
  {
    "id": "molten_spearx1_lump_of_coalx4_to_blazing_spear",
    "output": "blazing_spear",
    "inputs": [
      {
        "itemId": "molten_spear",
        "count": 1
      },
      {
        "itemId": "lump_of_coal",
        "count": 4
      }
    ]
  },
  {
    "id": "impractically_large_greatswordx1_lump_of_coalx4_to_molten_greatsword",
    "output": "molten_greatsword",
    "inputs": [
      {
        "itemId": "impractically_large_greatsword",
        "count": 1
      },
      {
        "itemId": "lump_of_coal",
        "count": 4
      }
    ]
  },
  {
    "id": "piggybankx1_lucky_charmx2_to_lucky_piggy",
    "output": "lucky_piggy",
    "inputs": [
      {
        "itemId": "piggybank",
        "count": 1
      },
      {
        "itemId": "lucky_charm",
        "count": 2
      }
    ]
  },
  {
    "id": "red_orchid_collarx1_holy_armorx1_to_white_lily_collar",
    "output": "white_lily_collar",
    "inputs": [
      {
        "itemId": "red_orchid_collar",
        "count": 1
      },
      {
        "itemId": "holy_armor",
        "count": 1
      }
    ]
  },
  {
    "id": "red_orchid_collarx1_mana_crystalx1_to_blue_sage_collar",
    "output": "blue_sage_collar",
    "inputs": [
      {
        "itemId": "red_orchid_collar",
        "count": 1
      },
      {
        "itemId": "mana_crystal",
        "count": 1
      }
    ]
  },
  {
    "id": "acorn_collarx1_blood_amuletx1_to_red_orchid_collar",
    "output": "red_orchid_collar",
    "inputs": [
      {
        "itemId": "acorn_collar",
        "count": 1
      },
      {
        "itemId": "blood_amulet",
        "count": 1
      }
    ]
  },
  {
    "id": "spiked_shieldx1_pineapplex1_to_pine_protector",
    "output": "pine_protector",
    "inputs": [
      {
        "itemId": "spiked_shield",
        "count": 1
      },
      {
        "itemId": "pineapple",
        "count": 1
      }
    ]
  },
  {
    "id": "hero_swordx1_garlicx1_to_stankus_toothpick",
    "output": "stankus_toothpick",
    "inputs": [
      {
        "itemId": "hero_sword",
        "count": 1
      },
      {
        "itemId": "garlic",
        "count": 1
      }
    ]
  },
  {
    "id": "panx1_wooden_bucklerx1_to_boiling_pot",
    "output": "boiling_pot",
    "inputs": [
      {
        "itemId": "pan",
        "count": 1
      },
      {
        "itemId": "wooden_buckler",
        "count": 1
      }
    ]
  },
  {
    "id": "leather_armorx1_goobertx1_to_holdall",
    "output": "holdall",
    "inputs": [
      {
        "itemId": "leather_armor",
        "count": 1
      },
      {
        "itemId": "goobert",
        "count": 1
      }
    ]
  },
  {
    "id": "holy_armorx1_bunch_of_coinsx1_to_gold_armor",
    "output": "gold_armor",
    "inputs": [
      {
        "itemId": "holy_armor",
        "count": 1
      },
      {
        "itemId": "bunch_of_coins",
        "count": 1
      }
    ]
  }
];

window.BB_REFERENCE_RECIPES = BB_REFERENCE_RECIPES;
