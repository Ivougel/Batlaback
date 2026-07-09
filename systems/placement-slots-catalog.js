// Transpiled from TypeScript — npm run compile:ts

const PLACEMENT_SLOT_DEFS = {
  apple: [{
    id: "apple_food_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["food"],
    hostApply: { type: "healBonus", value: 1 },
    desc: "\u2B50 \u0415\u0434\u0430 \u0432 \u0441\u043B\u043E\u0442\u0435: +1 \u043A \u043B\u0435\u0447\u0435\u043D\u0438\u044E"
  }],
  banana: [{
    id: "banana_food_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["food"],
    guestApply: { type: "healBonus", value: 1 },
    desc: "\u2B50 \u0415\u0434\u0430 \u0432 \u0441\u043B\u043E\u0442\u0435: +1 \u043A \u043B\u0435\u0447\u0435\u043D\u0438\u044E \u0433\u043E\u0441\u0442\u044F"
  }],
  cheese: [{
    id: "cheese_food_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["food"],
    hostApply: { type: "healBonus", value: 1 },
    desc: "\u2B50 \u0415\u0434\u0430 \u0432 \u0441\u043B\u043E\u0442\u0435: +1 \u043A \u043B\u0435\u0447\u0435\u043D\u0438\u044E"
  }],
  garlic: [{
    id: "garlic_food_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["food"],
    guestApply: { type: "damageBonus", value: 1 },
    desc: "\u2B50 \u0415\u0434\u0430 \u0432 \u0441\u043B\u043E\u0442\u0435: +1 \u0443\u0440\u043E\u043D\u0430 \u0433\u043E\u0441\u0442\u044E"
  }],
  healing_herb: [{
    id: "herb_nature_star",
    kind: "star",
    at: [0, 1],
    acceptTags: ["nature", "food"],
    hostApply: { type: "healBonus", value: 2 },
    desc: "\u2B50 \u041F\u0440\u0438\u0440\u043E\u0434\u0430/\u0435\u0434\u0430 \u0432 \u0441\u043B\u043E\u0442\u0435: +2 \u043A \u043B\u0435\u0447\u0435\u043D\u0438\u044E"
  }],
  health_stone: [{
    id: "health_food_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["food"],
    hostApply: { type: "healBonus", value: 1 },
    desc: "\u2B50 \u0415\u0434\u0430 \u0432 \u0441\u043B\u043E\u0442\u0435: +1 \u043A \u043B\u0435\u0447\u0435\u043D\u0438\u044E"
  }],
  apprentice_staff: [{
    id: "staff_magic_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["gem", "magic"],
    hostApply: { type: "damageBonus", value: 1 },
    desc: "\u2B50 \u041A\u0440\u0438\u0441\u0442\u0430\u043B\u043B/\u043C\u0430\u0433\u0438\u044F \u0432 \u0441\u043B\u043E\u0442\u0435: +1 \u0443\u0440\u043E\u043D\u0430"
  }],
  fire_staff: [{
    id: "fire_gem_diamond",
    kind: "diamond",
    at: [2, 0],
    acceptTags: ["gem"],
    hostApply: { type: "damageBonus", value: 3 },
    desc: "\u25C6 \u041A\u0440\u0438\u0441\u0442\u0430\u043B\u043B \u0432 \u0441\u043B\u043E\u0442\u0435: +3 \u0443\u0440\u043E\u043D\u0430"
  }],
  mana_crystal: [{
    id: "mana_magic_diamond",
    kind: "diamond",
    at: [1, 0],
    acceptTags: ["magic", "gem"],
    guestApply: { type: "damageBonus", value: 2 },
    desc: "\u25C6 \u041C\u0430\u0433\u0438\u044F/\u043A\u0440\u0438\u0441\u0442\u0430\u043B\u043B \u0432 \u0441\u043B\u043E\u0442\u0435: +2 \u0443\u0440\u043E\u043D\u0430 \u0433\u043E\u0441\u0442\u044E"
  }],
  wooden_sword: [{
    id: "sword_weapon_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["weapon"],
    hostApply: { type: "damageBonus", value: 1 },
    desc: "\u2B50 \u041E\u0440\u0443\u0436\u0438\u0435 \u0432 \u0441\u043B\u043E\u0442\u0435: +1 \u0443\u0440\u043E\u043D\u0430"
  }],
  goobert: [{
    id: "goobert_food_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["food", "nature"],
    hostApply: { type: "healBonus", value: 2 },
    guestApply: { type: "cooldownReduction", value: 0.08 },
    desc: "\u2B50 \u0415\u0434\u0430/\u043F\u0440\u0438\u0440\u043E\u0434\u0430: +2 \u0445\u0438\u043B \u0445\u043E\u0437\u044F\u0438\u043D\u0443, \u0433\u043E\u0441\u0442\u044E \u22128% CD"
  }],
  pineapple: [{
    id: "pine_food_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["food"],
    hostApply: { type: "healBonus", value: 1 },
    guestApply: { type: "healBonus", value: 1 },
    desc: "\u2B50 \u0415\u0434\u0430 \u0432 \u0441\u043B\u043E\u0442\u0435: +1 \u0445\u0438\u043B \u0445\u043E\u0437\u044F\u0438\u043D\u0443 \u0438 \u0433\u043E\u0441\u0442\u044E"
  }]
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
