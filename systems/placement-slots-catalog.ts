/**
 * Слоты размещения (⭐ / ◆) — сгенерировано tools/generate-placement-slots.mjs
 * Источник: tools/bb-reference/placement-slot-overrides.json + автоконверсия synergies.
 * @see systems/placement-slots.js
 */
import type { PlacementSlotCatalogEntry } from "../types/game";

const PLACEMENT_SLOT_DEFS: Record<string, PlacementSlotCatalogEntry[]> = {
  "apprentice_staff": [
    {
      "id": "app_gem_star",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "magic"
      ],
      "hostApply": {
        "type": "damageBonus",
        "value": 1
      },
      "desc": "⭐ Магия: +1 урона"
    }
  ],
  "blood_harvester": [
    {
      "id": "bh_vamp",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "vampiric"
      ],
      "hostApply": {
        "type": "healBonus",
        "value": 2
      },
      "desc": "⭐ Вампирик: +2 к хилу"
    }
  ],
  "bloody_dagger": [
    {
      "id": "bloody_dagger_fx_0_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "vampiric"
      ],
      "desc": "⭐ vampiric: +4 к лечению"
    },
    {
      "id": "bloody_dagger_fx_0_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "vampiric"
      ],
      "desc": "⭐ vampiric: +4 к лечению"
    },
    {
      "id": "bloody_dagger_fx_0_3",
      "kind": "star",
      "at": [
        1,
        1
      ],
      "acceptTags": [
        "vampiric"
      ],
      "desc": "⭐ vampiric: +4 к лечению"
    },
    {
      "id": "bloody_dagger_fx_0_4",
      "kind": "star",
      "at": [
        -1,
        1
      ],
      "acceptTags": [
        "vampiric"
      ],
      "desc": "⭐ vampiric: +4 к лечению"
    }
  ],
  "boiling_pot": [
    {
      "id": "bp_food_1",
      "kind": "star",
      "at": [
        -2,
        0
      ],
      "acceptTags": [
        "food"
      ],
      "hostApply": {
        "type": "healBonus",
        "value": 2
      },
      "desc": "⭐ Еда слева: +2 к хилу"
    },
    {
      "id": "bp_food_2",
      "kind": "star",
      "at": [
        -2,
        1
      ],
      "acceptTags": [
        "food"
      ],
      "hostApply": {
        "type": "healBonus",
        "value": 2
      },
      "desc": "⭐ Еда слева: +2 к хилу"
    },
    {
      "id": "bp_potion_1",
      "kind": "star",
      "at": [
        2,
        0
      ],
      "acceptTags": [
        "potion"
      ],
      "hostApply": {
        "type": "healBonus",
        "value": 2
      },
      "desc": "⭐ Зелье справа: +2 к хилу"
    },
    {
      "id": "bp_potion_2",
      "kind": "star",
      "at": [
        2,
        1
      ],
      "acceptTags": [
        "potion"
      ],
      "guestApply": {
        "type": "cooldownReduction",
        "value": 0.15
      },
      "desc": "⭐ Зелье: −15% кулдаун"
    }
  ],
  "cauldron": [
    {
      "id": "cauldron_fx_0_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "food",
        "potion"
      ],
      "desc": "⭐ food/potion: −15% кулдаун"
    },
    {
      "id": "cauldron_fx_0_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "food",
        "potion"
      ],
      "desc": "⭐ food/potion: −15% кулдаун"
    },
    {
      "id": "cauldron_fx_0_3",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "food",
        "potion"
      ],
      "desc": "⭐ food/potion: −15% кулдаун"
    },
    {
      "id": "cauldron_fx_0_4",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "food",
        "potion"
      ],
      "desc": "⭐ food/potion: −15% кулдаун"
    }
  ],
  "crow": [
    {
      "id": "crow_fx_0_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "pet",
        "debuff"
      ],
      "desc": "⭐ pet/debuff: −6% кулдаун"
    },
    {
      "id": "crow_fx_0_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "pet",
        "debuff"
      ],
      "desc": "⭐ pet/debuff: −6% кулдаун"
    },
    {
      "id": "crow_fx_0_3",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "pet",
        "debuff"
      ],
      "desc": "⭐ pet/debuff: −6% кулдаун"
    },
    {
      "id": "crow_fx_0_4",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "pet",
        "debuff"
      ],
      "desc": "⭐ pet/debuff: −6% кулдаун"
    }
  ],
  "cthulhu": [
    {
      "id": "cthulhu_fx_0_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: −15% кулдаун"
    },
    {
      "id": "cthulhu_fx_0_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: −15% кулдаун"
    },
    {
      "id": "cthulhu_fx_0_3",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: −15% кулдаун"
    },
    {
      "id": "cthulhu_fx_0_4",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: −15% кулдаун"
    }
  ],
  "death_scythe": [
    {
      "id": "ds_1",
      "kind": "star",
      "at": [
        2,
        0
      ],
      "acceptTags": [
        "poison",
        "food",
        "pet",
        "potion"
      ],
      "guestApply": {
        "type": "poisonBonus",
        "value": 2
      },
      "desc": "⭐ Двойной яд"
    },
    {
      "id": "ds_2",
      "kind": "star",
      "at": [
        2,
        1
      ],
      "acceptTags": [
        "poison",
        "food",
        "pet",
        "potion"
      ],
      "guestApply": {
        "type": "poisonBonus",
        "value": 2
      },
      "desc": "⭐ Двойной яд"
    },
    {
      "id": "ds_3",
      "kind": "star",
      "at": [
        0,
        2
      ],
      "acceptTags": [
        "poison",
        "food",
        "pet",
        "potion"
      ],
      "guestApply": {
        "type": "poisonBonus",
        "value": 2
      },
      "desc": "⭐ Двойной яд"
    },
    {
      "id": "ds_4",
      "kind": "star",
      "at": [
        1,
        2
      ],
      "acceptTags": [
        "poison",
        "food",
        "pet",
        "potion"
      ],
      "guestApply": {
        "type": "poisonBonus",
        "value": 2
      },
      "desc": "⭐ Двойной яд"
    },
    {
      "id": "ds_5",
      "kind": "star",
      "at": [
        -2,
        0
      ],
      "acceptTags": [
        "poison",
        "food",
        "pet",
        "potion"
      ],
      "guestApply": {
        "type": "poisonBonus",
        "value": 2
      },
      "desc": "⭐ Двойной яд"
    },
    {
      "id": "ds_6",
      "kind": "star",
      "at": [
        -2,
        1
      ],
      "acceptTags": [
        "poison",
        "food",
        "pet",
        "potion"
      ],
      "guestApply": {
        "type": "poisonBonus",
        "value": 2
      },
      "desc": "⭐ Двойной яд"
    }
  ],
  "enchanted_staff": [
    {
      "id": "es_magic_star",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "magic"
      ],
      "hostApply": {
        "type": "cooldownReduction",
        "value": 0.08
      },
      "desc": "⭐ Магия: −8% кулдаун"
    }
  ],
  "fire_staff": [
    {
      "id": "fire_magic_star",
      "kind": "star",
      "at": [
        2,
        0
      ],
      "acceptTags": [
        "magic",
        "fire"
      ],
      "hostApply": {
        "type": "damageBonus",
        "value": 3
      },
      "desc": "⭐ Магия/огонь: +3 урона"
    }
  ],
  "flute": [
    {
      "id": "flute_s1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptStarHost": true,
      "hostApply": {
        "type": "cooldownReduction",
        "value": 0.1
      },
      "desc": "⭐ −10% кулдаун флейты"
    },
    {
      "id": "flute_s2",
      "kind": "star",
      "at": [
        1,
        -1
      ],
      "acceptStarHost": true,
      "hostApply": {
        "type": "cooldownReduction",
        "value": 0.1
      },
      "desc": "⭐ −10% кулдаун флейты"
    },
    {
      "id": "flute_s3",
      "kind": "star",
      "at": [
        1,
        1
      ],
      "acceptStarHost": true,
      "hostApply": {
        "type": "cooldownReduction",
        "value": 0.1
      },
      "desc": "⭐ −10% кулдаун флейты"
    },
    {
      "id": "flute_s4",
      "kind": "star",
      "at": [
        2,
        0
      ],
      "acceptStarHost": true,
      "hostApply": {
        "type": "cooldownReduction",
        "value": 0.1
      },
      "desc": "⭐ −10% кулдаун флейты"
    },
    {
      "id": "flute_s5",
      "kind": "star",
      "at": [
        2,
        -1
      ],
      "acceptStarHost": true,
      "hostApply": {
        "type": "cooldownReduction",
        "value": 0.1
      },
      "desc": "⭐ −10% кулдаун флейты"
    },
    {
      "id": "flute_s6",
      "kind": "star",
      "at": [
        2,
        1
      ],
      "acceptStarHost": true,
      "hostApply": {
        "type": "cooldownReduction",
        "value": 0.1
      },
      "desc": "⭐ −10% кулдаун флейты"
    }
  ],
  "frozen_flame": [
    {
      "id": "ff_fire_r",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "fire"
      ],
      "desc": "⭐ Огонь: +8 жара в начале боя"
    },
    {
      "id": "ff_fire_l",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "fire"
      ],
      "desc": "⭐ Огонь: +8 жара в начале боя"
    },
    {
      "id": "ff_fire_u",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "fire"
      ],
      "desc": "⭐ Огонь: +8 жара в начале боя"
    },
    {
      "id": "ff_fire_d",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "fire"
      ],
      "desc": "⭐ Огонь: +8 жара в начале боя"
    }
  ],
  "gingerbread_jerry": [
    {
      "id": "gingerbread_jerry_fx_0_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: −10% кулдаун"
    },
    {
      "id": "gingerbread_jerry_fx_0_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: −10% кулдаун"
    },
    {
      "id": "gingerbread_jerry_fx_0_3",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: −10% кулдаун"
    },
    {
      "id": "gingerbread_jerry_fx_0_4",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: −10% кулдаун"
    }
  ],
  "gloves_of_haste": [
    {
      "id": "goh_r",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "weapon",
        "pet",
        "food",
        "potion",
        "magic",
        "armor",
        "shield",
        "accessory"
      ],
      "guestApply": {
        "type": "cooldownReduction",
        "value": 0.2
      },
      "desc": "⭐ −20% кулдаун"
    },
    {
      "id": "goh_l",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "weapon",
        "pet",
        "food",
        "potion",
        "magic",
        "armor",
        "shield",
        "accessory"
      ],
      "guestApply": {
        "type": "cooldownReduction",
        "value": 0.2
      },
      "desc": "⭐ −20% кулдаун"
    }
  ],
  "gloves_of_power": [
    {
      "id": "gloves_of_power_star_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "weapon",
        "pet",
        "food",
        "potion",
        "magic",
        "armor",
        "shield",
        "accessory"
      ],
      "guestApply": {
        "type": "cooldownReduction",
        "value": 0.2
      },
      "desc": "⭐ weapon/pet: −20% CD"
    }
  ],
  "glowing_crown": [
    {
      "id": "gc_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "weapon",
        "pet",
        "armor",
        "shield"
      ],
      "guestApply": {
        "type": "damageBonus",
        "value": 1
      },
      "desc": "⭐ +1 урона гостю"
    },
    {
      "id": "gc_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "weapon",
        "pet",
        "armor",
        "shield"
      ],
      "guestApply": {
        "type": "damageBonus",
        "value": 1
      },
      "desc": "⭐ +1 урона гостю"
    }
  ],
  "goobert": [
    {
      "id": "goobert_food",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "food",
        "nature"
      ],
      "hostApply": {
        "type": "healBonus",
        "value": 2
      },
      "guestApply": {
        "type": "cooldownReduction",
        "value": 0.08
      },
      "desc": "⭐ Еда/природа: +2 хил, гостю −8% CD"
    }
  ],
  "great_shield": [
    {
      "id": "gs_armor_1",
      "kind": "star",
      "at": [
        2,
        0
      ],
      "acceptTags": [
        "armor"
      ],
      "hostApply": {
        "type": "blockBonus",
        "value": 2
      },
      "desc": "⭐ Броня: +2 блока"
    },
    {
      "id": "gs_armor_2",
      "kind": "star",
      "at": [
        0,
        2
      ],
      "acceptTags": [
        "armor"
      ],
      "hostApply": {
        "type": "blockBonus",
        "value": 2
      },
      "desc": "⭐ Броня: +2 блока"
    }
  ],
  "healing_herb": [
    {
      "id": "hh_nature",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "nature",
        "food"
      ],
      "hostApply": {
        "type": "healBonus",
        "value": 2
      },
      "desc": "⭐ Природа/еда: +2 к хилу"
    }
  ],
  "heart_of_darkness": [
    {
      "id": "heart_of_darkness_fx_0_1",
      "kind": "star",
      "at": [
        1,
        1
      ],
      "acceptTags": [
        "dark",
        "debuff"
      ],
      "desc": "⭐ dark/debuff: −20% кулдаун"
    },
    {
      "id": "heart_of_darkness_fx_0_2",
      "kind": "star",
      "at": [
        2,
        0
      ],
      "acceptTags": [
        "dark",
        "debuff"
      ],
      "desc": "⭐ dark/debuff: −20% кулдаун"
    },
    {
      "id": "heart_of_darkness_fx_0_3",
      "kind": "star",
      "at": [
        0,
        2
      ],
      "acceptTags": [
        "dark",
        "debuff"
      ],
      "desc": "⭐ dark/debuff: −20% кулдаун"
    },
    {
      "id": "heart_of_darkness_fx_0_4",
      "kind": "star",
      "at": [
        -2,
        0
      ],
      "acceptTags": [
        "dark",
        "debuff"
      ],
      "desc": "⭐ dark/debuff: −20% кулдаун"
    }
  ],
  "hedgehog": [
    {
      "id": "hh_pet_r",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ Питомец/еда: −15% кулдаун"
    },
    {
      "id": "hh_pet_l",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ Питомец/еда: −15% кулдаун"
    },
    {
      "id": "hh_pet_u",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ Питомец/еда: −15% кулдаун"
    },
    {
      "id": "hh_pet_d",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ Питомец/еда: −15% кулдаун"
    }
  ],
  "holy_armor": [
    {
      "id": "ha_holy_1",
      "kind": "star",
      "at": [
        2,
        0
      ],
      "acceptTags": [
        "holy"
      ],
      "desc": "⭐ Святой: +2 блока в начале боя"
    },
    {
      "id": "ha_holy_2",
      "kind": "star",
      "at": [
        2,
        1
      ],
      "acceptTags": [
        "holy"
      ],
      "desc": "⭐ Святой: +2 блока в начале боя"
    },
    {
      "id": "ha_holy_3",
      "kind": "star",
      "at": [
        0,
        3
      ],
      "acceptTags": [
        "holy"
      ],
      "desc": "⭐ Святой: +2 блока в начале боя"
    },
    {
      "id": "ha_holy_4",
      "kind": "star",
      "at": [
        1,
        3
      ],
      "acceptTags": [
        "holy"
      ],
      "desc": "⭐ Святой: +2 блока в начале боя"
    }
  ],
  "hyper_hedgehog": [
    {
      "id": "hyper_hedgehog_fx_0_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    },
    {
      "id": "hyper_hedgehog_fx_0_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    },
    {
      "id": "hyper_hedgehog_fx_0_3",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    },
    {
      "id": "hyper_hedgehog_fx_0_4",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    }
  ],
  "improved_whetstone": [
    {
      "id": "iwhet_r",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "weapon"
      ],
      "guestApply": {
        "type": "damageBonus",
        "value": 1
      },
      "desc": "⭐ Оружие: +1 урона"
    },
    {
      "id": "iwhet_l",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "weapon"
      ],
      "guestApply": {
        "type": "damageBonus",
        "value": 1
      },
      "desc": "⭐ Оружие: +1 урона"
    },
    {
      "id": "iwhet_u",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "weapon"
      ],
      "guestApply": {
        "type": "damageBonus",
        "value": 1
      },
      "desc": "⭐ Оружие: +1 урона"
    }
  ],
  "iron_shield": [
    {
      "id": "is_weapon",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "weapon"
      ],
      "hostApply": {
        "type": "grantBlockBuff",
        "value": 3,
        "buffTargetTags": [
          "weapon"
        ],
        "cap": 12
      },
      "desc": "⭐ Оружие: +3 урона при блоке"
    }
  ],
  "king_crown": [
    {
      "id": "kc_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "weapon",
        "pet",
        "armor",
        "shield",
        "food",
        "potion"
      ],
      "guestApply": {
        "type": "damageBonus",
        "value": 2
      },
      "desc": "⭐ +2 урона гостю"
    },
    {
      "id": "kc_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "weapon",
        "pet",
        "armor",
        "shield",
        "food",
        "potion"
      ],
      "guestApply": {
        "type": "damageBonus",
        "value": 2
      },
      "desc": "⭐ +2 урона гостю"
    }
  ],
  "leaf_badge": [
    {
      "id": "lb_star",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "food",
        "potion",
        "weapon",
        "pet"
      ],
      "guestApply": {
        "type": "healBonus",
        "value": 2
      },
      "desc": "⭐ +2 хил гостю"
    }
  ],
  "leather_armor": [
    {
      "id": "la_shield",
      "kind": "star",
      "at": [
        2,
        0
      ],
      "acceptTags": [
        "shield"
      ],
      "guestApply": {
        "type": "blockBonus",
        "value": 1
      },
      "desc": "⭐ Щит: +1 блок"
    }
  ],
  "lucky_clover": [
    {
      "id": "lc_star",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "weapon",
        "pet",
        "food",
        "potion",
        "magic",
        "armor",
        "shield",
        "accessory"
      ],
      "hostApply": {
        "type": "damageBonus",
        "value": 1
      },
      "desc": "⭐ +1 урона хозяину"
    }
  ],
  "magic_staff": [
    {
      "id": "ms_magic_star",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "magic"
      ],
      "hostApply": {
        "type": "cooldownReduction",
        "value": 0.08
      },
      "desc": "⭐ Магия: −8% кулдаун"
    }
  ],
  "mana_orb_charm": [
    {
      "id": "moc_magic",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "magic"
      ],
      "guestApply": {
        "type": "cooldownReduction",
        "value": 0.08
      },
      "desc": "⭐ Магия: −8% кулдаун"
    }
  ],
  "moon_armor": [
    {
      "id": "moon_armor_fx_0_1",
      "kind": "star",
      "at": [
        2,
        0
      ],
      "acceptTags": [
        "armor"
      ],
      "desc": "⭐ armor: +20 block в начале боя"
    },
    {
      "id": "moon_armor_fx_0_2",
      "kind": "star",
      "at": [
        -2,
        0
      ],
      "acceptTags": [
        "armor"
      ],
      "desc": "⭐ armor: +20 block в начале боя"
    },
    {
      "id": "moon_armor_fx_0_3",
      "kind": "star",
      "at": [
        2,
        1
      ],
      "acceptTags": [
        "armor"
      ],
      "desc": "⭐ armor: +20 block в начале боя"
    },
    {
      "id": "moon_armor_fx_0_4",
      "kind": "star",
      "at": [
        -2,
        1
      ],
      "acceptTags": [
        "armor"
      ],
      "desc": "⭐ armor: +20 block в начале боя"
    }
  ],
  "mrs_struggles": [
    {
      "id": "mrs_struggles_fx_0_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "dark"
      ],
      "desc": "⭐ dark: −10% кулдаун"
    },
    {
      "id": "mrs_struggles_fx_0_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "dark"
      ],
      "desc": "⭐ dark: −10% кулдаун"
    },
    {
      "id": "mrs_struggles_fx_0_3",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "dark"
      ],
      "desc": "⭐ dark: −10% кулдаун"
    },
    {
      "id": "mrs_struggles_fx_0_4",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "dark"
      ],
      "desc": "⭐ dark: −10% кулдаун"
    }
  ],
  "pan": [
    {
      "id": "pan_food",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "food"
      ],
      "hostApply": {
        "type": "damageBonus",
        "value": 1
      },
      "desc": "⭐ Еда: +1 урона сковородки"
    }
  ],
  "paradise_birb": [
    {
      "id": "paradise_birb_fx_0_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "pet"
      ],
      "desc": "⭐ pet: −7% кулдаун"
    },
    {
      "id": "paradise_birb_fx_0_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "pet"
      ],
      "desc": "⭐ pet: −7% кулдаун"
    },
    {
      "id": "paradise_birb_fx_0_3",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "pet"
      ],
      "desc": "⭐ pet: −7% кулдаун"
    },
    {
      "id": "paradise_birb_fx_0_4",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "pet"
      ],
      "desc": "⭐ pet: −7% кулдаун"
    }
  ],
  "piggybank": [
    {
      "id": "piggy_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptBattleStart": true,
      "desc": "⭐ «Начало боя»: +2 макс. HP"
    },
    {
      "id": "piggy_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptBattleStart": true,
      "desc": "⭐ «Начало боя»: +2 макс. HP"
    }
  ],
  "pineapple": [
    {
      "id": "pine_food",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "food"
      ],
      "hostApply": {
        "type": "healBonus",
        "value": 1
      },
      "guestApply": {
        "type": "healBonus",
        "value": 1
      },
      "desc": "⭐ Еда: +1 хил хозяину и гостю"
    }
  ],
  "prismatic_orb": [
    {
      "id": "po_magic_r",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "magic"
      ],
      "desc": "⭐ Магия: +2 маны в начале боя"
    },
    {
      "id": "po_magic_l",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "magic"
      ],
      "desc": "⭐ Магия: +2 маны в начале боя"
    },
    {
      "id": "po_fire_u",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "fire"
      ],
      "desc": "⭐ Огонь: +1 мана в начале боя"
    },
    {
      "id": "po_fire_d",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "fire"
      ],
      "desc": "⭐ Огонь: +1 мана в начале боя"
    }
  ],
  "prismatic_sword": [
    {
      "id": "ps_gem",
      "kind": "star",
      "at": [
        2,
        0
      ],
      "acceptTags": [
        "magic"
      ],
      "hostApply": {
        "type": "damageBonus",
        "value": 1
      },
      "desc": "⭐ Магия: +1 урона"
    }
  ],
  "pumpkin": [
    {
      "id": "pumpkin_fx_0_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: −10% кулдаун"
    },
    {
      "id": "pumpkin_fx_0_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: −10% кулдаун"
    },
    {
      "id": "pumpkin_fx_0_3",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: −10% кулдаун"
    },
    {
      "id": "pumpkin_fx_0_4",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: −10% кулдаун"
    }
  ],
  "ranger_bag": [
    {
      "id": "ranger_bag_star_1",
      "kind": "star",
      "at": [
        2,
        0
      ],
      "acceptTags": [
        "ranged"
      ],
      "guestApply": {
        "type": "damageBonus",
        "value": 1
      },
      "desc": "⭐ ranged: +1 урона"
    }
  ],
  "rat": [
    {
      "id": "rat_fx_0_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    },
    {
      "id": "rat_fx_0_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    },
    {
      "id": "rat_fx_0_3",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    },
    {
      "id": "rat_fx_0_4",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    }
  ],
  "rat_chef": [
    {
      "id": "rat_chef_fx_0_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: +1 luck в начале боя"
    },
    {
      "id": "rat_chef_fx_0_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: +1 luck в начале боя"
    },
    {
      "id": "rat_chef_fx_1_1",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    },
    {
      "id": "rat_chef_fx_1_2",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    }
  ],
  "red_orchid_collar": [
    {
      "id": "roc_weapon_r",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "weapon"
      ],
      "desc": "⭐ Оружие: +4% вампиризма"
    },
    {
      "id": "roc_weapon_l",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "weapon"
      ],
      "desc": "⭐ Оружие: +4% вампиризма"
    }
  ],
  "royal_helmet": [
    {
      "id": "rh_weapon",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "weapon"
      ],
      "hostApply": {
        "type": "grantBlockBuff",
        "value": 4,
        "buffTargetTags": [
          "weapon"
        ],
        "cap": 20
      },
      "desc": "⭐ Оружие: +4 урона при блоке"
    }
  ],
  "shell_totem": [
    {
      "id": "st_star",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "weapon",
        "pet",
        "food",
        "potion",
        "magic",
        "armor",
        "shield",
        "accessory"
      ],
      "guestApply": {
        "type": "blockBonus",
        "value": 1
      },
      "desc": "⭐ +1 блок гостю"
    }
  ],
  "shelly": [
    {
      "id": "sh_potion_r",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "potion"
      ],
      "desc": "⭐ Зелье: −20% кулдаун"
    },
    {
      "id": "sh_potion_l",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "potion"
      ],
      "desc": "⭐ Зелье: −20% кулдаун"
    },
    {
      "id": "sh_potion_u",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "potion"
      ],
      "desc": "⭐ Зелье: −20% кулдаун"
    },
    {
      "id": "sh_potion_d",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "potion"
      ],
      "desc": "⭐ Зелье: −20% кулдаун"
    }
  ],
  "shiny_shell": [
    {
      "id": "ss_holy_r",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "holy"
      ],
      "desc": "⭐ Святой: +3 к лечению"
    },
    {
      "id": "ss_holy_l",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "holy"
      ],
      "desc": "⭐ Святой: +3 к лечению"
    },
    {
      "id": "ss_holy_u",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "holy"
      ],
      "desc": "⭐ Святой: +3 к лечению"
    },
    {
      "id": "ss_holy_d",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "holy"
      ],
      "desc": "⭐ Святой: +3 к лечению"
    }
  ],
  "snowcake": [
    {
      "id": "sc_food_r",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ Еда: −10% кулдаун"
    },
    {
      "id": "sc_food_l",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ Еда: −10% кулдаун"
    },
    {
      "id": "sc_food_u",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ Еда: −10% кулдаун"
    },
    {
      "id": "sc_food_d",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ Еда: −10% кулдаун"
    }
  ],
  "snowmaster": [
    {
      "id": "snowmaster_fx_0_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "cold"
      ],
      "desc": "⭐ cold: −10% кулдаун"
    },
    {
      "id": "snowmaster_fx_0_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "cold"
      ],
      "desc": "⭐ cold: −10% кулдаун"
    },
    {
      "id": "snowmaster_fx_0_3",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "cold"
      ],
      "desc": "⭐ cold: −10% кулдаун"
    },
    {
      "id": "snowmaster_fx_0_4",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "cold"
      ],
      "desc": "⭐ cold: −10% кулдаун"
    }
  ],
  "squirrel": [
    {
      "id": "squirrel_fx_0_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    },
    {
      "id": "squirrel_fx_0_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    },
    {
      "id": "squirrel_fx_0_3",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    },
    {
      "id": "squirrel_fx_0_4",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    }
  ],
  "squirrel_archer": [
    {
      "id": "squirrel_archer_fx_0_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    },
    {
      "id": "squirrel_archer_fx_0_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    },
    {
      "id": "squirrel_archer_fx_0_3",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    },
    {
      "id": "squirrel_archer_fx_0_4",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "pet",
        "food"
      ],
      "desc": "⭐ pet/food: −15% кулдаун"
    }
  ],
  "stankus_toothpick": [
    {
      "id": "stankus_toothpick_fx_0_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: −-12% кулдаун"
    },
    {
      "id": "stankus_toothpick_fx_0_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: −-12% кулдаун"
    },
    {
      "id": "stankus_toothpick_fx_0_3",
      "kind": "star",
      "at": [
        1,
        1
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: −-12% кулдаун"
    },
    {
      "id": "stankus_toothpick_fx_0_4",
      "kind": "star",
      "at": [
        -1,
        1
      ],
      "acceptTags": [
        "food"
      ],
      "desc": "⭐ food: −-12% кулдаун"
    }
  ],
  "star_of_courage": [
    {
      "id": "soc_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "weapon",
        "pet",
        "armor",
        "shield"
      ],
      "guestApply": {
        "type": "damageBonus",
        "value": 2
      },
      "desc": "⭐ +2 урона гостю"
    },
    {
      "id": "soc_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "weapon",
        "pet",
        "armor",
        "shield"
      ],
      "guestApply": {
        "type": "damageBonus",
        "value": 2
      },
      "desc": "⭐ +2 урона гостю"
    }
  ],
  "steel_goobert": [
    {
      "id": "sg_weapon_u",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "weapon"
      ],
      "guestApply": {
        "type": "damageBonus",
        "value": 2
      },
      "desc": "⭐ Оружие сверху: +2 урона"
    },
    {
      "id": "sg_weapon_d",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "weapon"
      ],
      "guestApply": {
        "type": "damageBonus",
        "value": 2
      },
      "desc": "⭐ Оружие снизу: +2 урона"
    }
  ],
  "stone_badge": [
    {
      "id": "sb_star",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "weapon",
        "pet",
        "food",
        "potion",
        "magic",
        "armor",
        "shield",
        "accessory"
      ],
      "guestApply": {
        "type": "blockBonus",
        "value": 1
      },
      "desc": "⭐ +1 блок гостю"
    }
  ],
  "sun_armor": [
    {
      "id": "sun_armor_fx_0_1",
      "kind": "star",
      "at": [
        2,
        0
      ],
      "acceptTags": [
        "armor"
      ],
      "desc": "⭐ armor: +1 block в начале боя"
    },
    {
      "id": "sun_armor_fx_0_2",
      "kind": "star",
      "at": [
        -2,
        0
      ],
      "acceptTags": [
        "armor"
      ],
      "desc": "⭐ armor: +1 block в начале боя"
    },
    {
      "id": "sun_armor_fx_0_3",
      "kind": "star",
      "at": [
        2,
        1
      ],
      "acceptTags": [
        "armor"
      ],
      "desc": "⭐ armor: +1 block в начале боя"
    },
    {
      "id": "sun_armor_fx_0_4",
      "kind": "star",
      "at": [
        -2,
        1
      ],
      "acceptTags": [
        "armor"
      ],
      "desc": "⭐ armor: +1 block в начале боя"
    }
  ],
  "twine_badge": [
    {
      "id": "tb_star",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "weapon",
        "pet",
        "potion",
        "food"
      ],
      "guestApply": {
        "type": "cooldownReduction",
        "value": 0.15
      },
      "desc": "⭐ −15% кулдаун гостю"
    }
  ],
  "villain_sword": [
    {
      "id": "vs_weapon",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "weapon"
      ],
      "guestApply": {
        "type": "damageBonus",
        "value": 4
      },
      "desc": "⭐ Оружие: +4 урона"
    }
  ],
  "whetstone": [
    {
      "id": "whet_r",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "weapon"
      ],
      "guestApply": {
        "type": "damageBonus",
        "value": 1
      },
      "desc": "⭐ Оружие: +1 урона"
    },
    {
      "id": "whet_l",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "weapon"
      ],
      "guestApply": {
        "type": "damageBonus",
        "value": 1
      },
      "desc": "⭐ Оружие: +1 урона"
    }
  ],
  "wolf_badge": [
    {
      "id": "wb_star",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "weapon"
      ],
      "guestApply": {
        "type": "damageBonus",
        "value": 1
      },
      "desc": "⭐ Оружие: +1 урона"
    }
  ],
  "wolpertinger": [
    {
      "id": "wolpertinger_fx_0_1",
      "kind": "star",
      "at": [
        1,
        0
      ],
      "acceptTags": [
        "pet",
        "luck"
      ],
      "desc": "⭐ pet/luck: −15% кулдаун"
    },
    {
      "id": "wolpertinger_fx_0_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptTags": [
        "pet",
        "luck"
      ],
      "desc": "⭐ pet/luck: −15% кулдаун"
    },
    {
      "id": "wolpertinger_fx_0_3",
      "kind": "star",
      "at": [
        0,
        1
      ],
      "acceptTags": [
        "pet",
        "luck"
      ],
      "desc": "⭐ pet/luck: −15% кулдаун"
    },
    {
      "id": "wolpertinger_fx_0_4",
      "kind": "star",
      "at": [
        0,
        -1
      ],
      "acceptTags": [
        "pet",
        "luck"
      ],
      "desc": "⭐ pet/luck: −15% кулдаун"
    }
  ]
};

function patchPlacementSlotCatalog(): void {
  if (typeof ITEM_CATALOG === "undefined") return;
  Object.entries(PLACEMENT_SLOT_DEFS).forEach(([itemId, slots]) => {
    if (!ITEM_CATALOG[itemId]) return;
    ITEM_CATALOG[itemId].placementSlots = slots.map((slot) => ({ ...slot }));
  });
}

patchPlacementSlotCatalog();

window.PLACEMENT_SLOT_DEFS = PLACEMENT_SLOT_DEFS;
