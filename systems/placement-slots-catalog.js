// Transpiled from TypeScript — npm run compile:ts

const PLACEMENT_SLOT_DEFS = {
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
      "desc": "\u2B50 \u041C\u0430\u0433\u0438\u044F: +1 \u0443\u0440\u043E\u043D\u0430"
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
      "desc": "\u2B50 \u0412\u0430\u043C\u043F\u0438\u0440\u0438\u043A: +2 \u043A \u0445\u0438\u043B\u0443"
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
      "desc": "\u2B50 vampiric: +4 \u043A \u043B\u0435\u0447\u0435\u043D\u0438\u044E"
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
      "desc": "\u2B50 vampiric: +4 \u043A \u043B\u0435\u0447\u0435\u043D\u0438\u044E"
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
      "desc": "\u2B50 vampiric: +4 \u043A \u043B\u0435\u0447\u0435\u043D\u0438\u044E"
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
      "desc": "\u2B50 vampiric: +4 \u043A \u043B\u0435\u0447\u0435\u043D\u0438\u044E"
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
      "desc": "\u2B50 \u0415\u0434\u0430 \u0441\u043B\u0435\u0432\u0430: +2 \u043A \u0445\u0438\u043B\u0443"
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
      "desc": "\u2B50 \u0415\u0434\u0430 \u0441\u043B\u0435\u0432\u0430: +2 \u043A \u0445\u0438\u043B\u0443"
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
      "desc": "\u2B50 \u0417\u0435\u043B\u044C\u0435 \u0441\u043F\u0440\u0430\u0432\u0430: +2 \u043A \u0445\u0438\u043B\u0443"
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
      "desc": "\u2B50 \u0417\u0435\u043B\u044C\u0435: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food/potion: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food/potion: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food/potion: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food/potion: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/debuff: \u22126% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/debuff: \u22126% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/debuff: \u22126% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/debuff: \u22126% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u0414\u0432\u043E\u0439\u043D\u043E\u0439 \u044F\u0434"
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
      "desc": "\u2B50 \u0414\u0432\u043E\u0439\u043D\u043E\u0439 \u044F\u0434"
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
      "desc": "\u2B50 \u0414\u0432\u043E\u0439\u043D\u043E\u0439 \u044F\u0434"
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
      "desc": "\u2B50 \u0414\u0432\u043E\u0439\u043D\u043E\u0439 \u044F\u0434"
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
      "desc": "\u2B50 \u0414\u0432\u043E\u0439\u043D\u043E\u0439 \u044F\u0434"
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
      "desc": "\u2B50 \u0414\u0432\u043E\u0439\u043D\u043E\u0439 \u044F\u0434"
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
      "desc": "\u2B50 \u041C\u0430\u0433\u0438\u044F: \u22128% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u041C\u0430\u0433\u0438\u044F/\u043E\u0433\u043E\u043D\u044C: +3 \u0443\u0440\u043E\u043D\u0430"
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
      "desc": "\u2B50 \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D \u0444\u043B\u0435\u0439\u0442\u044B"
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
      "desc": "\u2B50 \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D \u0444\u043B\u0435\u0439\u0442\u044B"
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
      "desc": "\u2B50 \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D \u0444\u043B\u0435\u0439\u0442\u044B"
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
      "desc": "\u2B50 \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D \u0444\u043B\u0435\u0439\u0442\u044B"
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
      "desc": "\u2B50 \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D \u0444\u043B\u0435\u0439\u0442\u044B"
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
      "desc": "\u2B50 \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D \u0444\u043B\u0435\u0439\u0442\u044B"
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
      "desc": "\u2B50 \u041E\u0433\u043E\u043D\u044C: +8 \u0436\u0430\u0440\u0430 \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 \u041E\u0433\u043E\u043D\u044C: +8 \u0436\u0430\u0440\u0430 \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 \u041E\u0433\u043E\u043D\u044C: +8 \u0436\u0430\u0440\u0430 \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 \u041E\u0433\u043E\u043D\u044C: +8 \u0436\u0430\u0440\u0430 \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 food: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u221220% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u221220% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 weapon/pet: \u221220% CD"
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
      "desc": "\u2B50 +1 \u0443\u0440\u043E\u043D\u0430 \u0433\u043E\u0441\u0442\u044E"
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
      "desc": "\u2B50 +1 \u0443\u0440\u043E\u043D\u0430 \u0433\u043E\u0441\u0442\u044E"
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
      "desc": "\u2B50 \u0415\u0434\u0430/\u043F\u0440\u0438\u0440\u043E\u0434\u0430: +2 \u0445\u0438\u043B, \u0433\u043E\u0441\u0442\u044E \u22128% CD"
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
      "desc": "\u2B50 \u0411\u0440\u043E\u043D\u044F: +2 \u0431\u043B\u043E\u043A\u0430"
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
      "desc": "\u2B50 \u0411\u0440\u043E\u043D\u044F: +2 \u0431\u043B\u043E\u043A\u0430"
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
      "desc": "\u2B50 \u041F\u0440\u0438\u0440\u043E\u0434\u0430/\u0435\u0434\u0430: +2 \u043A \u0445\u0438\u043B\u0443"
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
      "desc": "\u2B50 dark/debuff: \u221220% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 dark/debuff: \u221220% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 dark/debuff: \u221220% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 dark/debuff: \u221220% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u041F\u0438\u0442\u043E\u043C\u0435\u0446/\u0435\u0434\u0430: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u041F\u0438\u0442\u043E\u043C\u0435\u0446/\u0435\u0434\u0430: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u041F\u0438\u0442\u043E\u043C\u0435\u0446/\u0435\u0434\u0430: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u041F\u0438\u0442\u043E\u043C\u0435\u0446/\u0435\u0434\u0430: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u0421\u0432\u044F\u0442\u043E\u0439: +2 \u0431\u043B\u043E\u043A\u0430 \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 \u0421\u0432\u044F\u0442\u043E\u0439: +2 \u0431\u043B\u043E\u043A\u0430 \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 \u0421\u0432\u044F\u0442\u043E\u0439: +2 \u0431\u043B\u043E\u043A\u0430 \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 \u0421\u0432\u044F\u0442\u043E\u0439: +2 \u0431\u043B\u043E\u043A\u0430 \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u041E\u0440\u0443\u0436\u0438\u0435: +1 \u0443\u0440\u043E\u043D\u0430"
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
      "desc": "\u2B50 \u041E\u0440\u0443\u0436\u0438\u0435: +1 \u0443\u0440\u043E\u043D\u0430"
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
      "desc": "\u2B50 \u041E\u0440\u0443\u0436\u0438\u0435: +1 \u0443\u0440\u043E\u043D\u0430"
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
      "desc": "\u2B50 \u041E\u0440\u0443\u0436\u0438\u0435: +3 \u0443\u0440\u043E\u043D\u0430 \u043F\u0440\u0438 \u0431\u043B\u043E\u043A\u0435"
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
      "desc": "\u2B50 +2 \u0443\u0440\u043E\u043D\u0430 \u0433\u043E\u0441\u0442\u044E"
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
      "desc": "\u2B50 +2 \u0443\u0440\u043E\u043D\u0430 \u0433\u043E\u0441\u0442\u044E"
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
      "desc": "\u2B50 +2 \u0445\u0438\u043B \u0433\u043E\u0441\u0442\u044E"
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
      "desc": "\u2B50 \u0429\u0438\u0442: +1 \u0431\u043B\u043E\u043A"
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
      "desc": "\u2B50 +1 \u0443\u0440\u043E\u043D\u0430 \u0445\u043E\u0437\u044F\u0438\u043D\u0443"
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
      "desc": "\u2B50 \u041C\u0430\u0433\u0438\u044F: \u22128% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u041C\u0430\u0433\u0438\u044F: \u22128% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 armor: +20 block \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 armor: +20 block \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 armor: +20 block \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 armor: +20 block \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 dark: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 dark: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 dark: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 dark: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u0415\u0434\u0430: +1 \u0443\u0440\u043E\u043D\u0430 \u0441\u043A\u043E\u0432\u043E\u0440\u043E\u0434\u043A\u0438"
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
      "desc": "\u2B50 pet: \u22127% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet: \u22127% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet: \u22127% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet: \u22127% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \xAB\u041D\u0430\u0447\u0430\u043B\u043E \u0431\u043E\u044F\xBB: +2 \u043C\u0430\u043A\u0441. HP"
    },
    {
      "id": "piggy_2",
      "kind": "star",
      "at": [
        -1,
        0
      ],
      "acceptBattleStart": true,
      "desc": "\u2B50 \xAB\u041D\u0430\u0447\u0430\u043B\u043E \u0431\u043E\u044F\xBB: +2 \u043C\u0430\u043A\u0441. HP"
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
      "desc": "\u2B50 \u0415\u0434\u0430: +1 \u0445\u0438\u043B \u0445\u043E\u0437\u044F\u0438\u043D\u0443 \u0438 \u0433\u043E\u0441\u0442\u044E"
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
      "desc": "\u2B50 \u041C\u0430\u0433\u0438\u044F: +2 \u043C\u0430\u043D\u044B \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 \u041C\u0430\u0433\u0438\u044F: +2 \u043C\u0430\u043D\u044B \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 \u041E\u0433\u043E\u043D\u044C: +1 \u043C\u0430\u043D\u0430 \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 \u041E\u0433\u043E\u043D\u044C: +1 \u043C\u0430\u043D\u0430 \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 \u041C\u0430\u0433\u0438\u044F: +1 \u0443\u0440\u043E\u043D\u0430"
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
      "desc": "\u2B50 food: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 ranged: +1 \u0443\u0440\u043E\u043D\u0430"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food: +1 luck \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 food: +1 luck \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u041E\u0440\u0443\u0436\u0438\u0435: +4% \u0432\u0430\u043C\u043F\u0438\u0440\u0438\u0437\u043C\u0430"
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
      "desc": "\u2B50 \u041E\u0440\u0443\u0436\u0438\u0435: +4% \u0432\u0430\u043C\u043F\u0438\u0440\u0438\u0437\u043C\u0430"
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
      "desc": "\u2B50 \u041E\u0440\u0443\u0436\u0438\u0435: +4 \u0443\u0440\u043E\u043D\u0430 \u043F\u0440\u0438 \u0431\u043B\u043E\u043A\u0435"
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
      "desc": "\u2B50 +1 \u0431\u043B\u043E\u043A \u0433\u043E\u0441\u0442\u044E"
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
      "desc": "\u2B50 \u0417\u0435\u043B\u044C\u0435: \u221220% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u0417\u0435\u043B\u044C\u0435: \u221220% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u0417\u0435\u043B\u044C\u0435: \u221220% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u0417\u0435\u043B\u044C\u0435: \u221220% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u0421\u0432\u044F\u0442\u043E\u0439: +3 \u043A \u043B\u0435\u0447\u0435\u043D\u0438\u044E"
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
      "desc": "\u2B50 \u0421\u0432\u044F\u0442\u043E\u0439: +3 \u043A \u043B\u0435\u0447\u0435\u043D\u0438\u044E"
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
      "desc": "\u2B50 \u0421\u0432\u044F\u0442\u043E\u0439: +3 \u043A \u043B\u0435\u0447\u0435\u043D\u0438\u044E"
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
      "desc": "\u2B50 \u0421\u0432\u044F\u0442\u043E\u0439: +3 \u043A \u043B\u0435\u0447\u0435\u043D\u0438\u044E"
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
      "desc": "\u2B50 \u0415\u0434\u0430: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u0415\u0434\u0430: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u0415\u0434\u0430: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 \u0415\u0434\u0430: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 cold: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 cold: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 cold: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 cold: \u221210% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/food: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food: \u2212-12% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food: \u2212-12% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food: \u2212-12% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 food: \u2212-12% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 +2 \u0443\u0440\u043E\u043D\u0430 \u0433\u043E\u0441\u0442\u044E"
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
      "desc": "\u2B50 +2 \u0443\u0440\u043E\u043D\u0430 \u0433\u043E\u0441\u0442\u044E"
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
      "desc": "\u2B50 \u041E\u0440\u0443\u0436\u0438\u0435 \u0441\u0432\u0435\u0440\u0445\u0443: +2 \u0443\u0440\u043E\u043D\u0430"
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
      "desc": "\u2B50 \u041E\u0440\u0443\u0436\u0438\u0435 \u0441\u043D\u0438\u0437\u0443: +2 \u0443\u0440\u043E\u043D\u0430"
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
      "desc": "\u2B50 +1 \u0431\u043B\u043E\u043A \u0433\u043E\u0441\u0442\u044E"
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
      "desc": "\u2B50 armor: +1 block \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 armor: +1 block \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 armor: +1 block \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 armor: +1 block \u0432 \u043D\u0430\u0447\u0430\u043B\u0435 \u0431\u043E\u044F"
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
      "desc": "\u2B50 \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D \u0433\u043E\u0441\u0442\u044E"
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
      "desc": "\u2B50 \u041E\u0440\u0443\u0436\u0438\u0435: +4 \u0443\u0440\u043E\u043D\u0430"
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
      "desc": "\u2B50 \u041E\u0440\u0443\u0436\u0438\u0435: +1 \u0443\u0440\u043E\u043D\u0430"
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
      "desc": "\u2B50 \u041E\u0440\u0443\u0436\u0438\u0435: +1 \u0443\u0440\u043E\u043D\u0430"
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
      "desc": "\u2B50 \u041E\u0440\u0443\u0436\u0438\u0435: +1 \u0443\u0440\u043E\u043D\u0430"
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
      "desc": "\u2B50 pet/luck: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/luck: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/luck: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
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
      "desc": "\u2B50 pet/luck: \u221215% \u043A\u0443\u043B\u0434\u0430\u0443\u043D"
    }
  ]
};
function patchPlacementSlotCatalog() {
  if (typeof ITEM_CATALOG === "undefined") return;
  Object.entries(PLACEMENT_SLOT_DEFS).forEach(([itemId, slots]) => {
    if (!ITEM_CATALOG[itemId]) return;
    ITEM_CATALOG[itemId].placementSlots = slots.map((slot) => ({ ...slot }));
  });
}
patchPlacementSlotCatalog();
window.PLACEMENT_SLOT_DEFS = PLACEMENT_SLOT_DEFS;
