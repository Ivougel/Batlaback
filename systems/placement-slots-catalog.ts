/**
 * Слоты размещения (⭐ / ◆) — патч к ITEM_CATALOG.
 * Гость должен занять клетку слота; один предмет-гость — один слот за бой.
 * @see systems/placement-slots.js
 */
import type { PlacementSlotCatalogEntry } from "../types/game";

const PLACEMENT_SLOT_DEFS: Record<string, PlacementSlotCatalogEntry[]> = {
  apple: [{
    id: "apple_food_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["food"],
    hostApply: { type: "healBonus", value: 1 },
    desc: "⭐ Еда в слоте: +1 к лечению",
  }],
  banana: [{
    id: "banana_food_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["food"],
    guestApply: { type: "healBonus", value: 1 },
    desc: "⭐ Еда в слоте: +1 к лечению гостя",
  }],
  cheese: [{
    id: "cheese_food_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["food"],
    hostApply: { type: "healBonus", value: 1 },
    desc: "⭐ Еда в слоте: +1 к лечению",
  }],
  garlic: [{
    id: "garlic_food_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["food"],
    guestApply: { type: "damageBonus", value: 1 },
    desc: "⭐ Еда в слоте: +1 урона гостю",
  }],
  healing_herb: [{
    id: "herb_nature_star",
    kind: "star",
    at: [0, 1],
    acceptTags: ["nature", "food"],
    hostApply: { type: "healBonus", value: 2 },
    desc: "⭐ Природа/еда в слоте: +2 к лечению",
  }],
  health_stone: [{
    id: "health_food_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["food"],
    hostApply: { type: "healBonus", value: 1 },
    desc: "⭐ Еда в слоте: +1 к лечению",
  }],
  apprentice_staff: [{
    id: "staff_magic_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["gem", "magic"],
    hostApply: { type: "damageBonus", value: 1 },
    desc: "⭐ Кристалл/магия в слоте: +1 урона",
  }],
  fire_staff: [{
    id: "fire_gem_diamond",
    kind: "diamond",
    at: [2, 0],
    acceptTags: ["gem"],
    hostApply: { type: "damageBonus", value: 3 },
    desc: "◆ Кристалл в слоте: +3 урона",
  }],
  mana_crystal: [{
    id: "mana_magic_diamond",
    kind: "diamond",
    at: [1, 0],
    acceptTags: ["magic", "gem"],
    guestApply: { type: "damageBonus", value: 2 },
    desc: "◆ Магия/кристалл в слоте: +2 урона гостю",
  }],
  wooden_sword: [{
    id: "sword_weapon_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["weapon"],
    hostApply: { type: "damageBonus", value: 1 },
    desc: "⭐ Оружие в слоте: +1 урона",
  }],
  goobert: [{
    id: "goobert_food_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["food", "nature"],
    hostApply: { type: "healBonus", value: 2 },
    guestApply: { type: "cooldownReduction", value: 0.08 },
    desc: "⭐ Еда/природа: +2 хил хозяину, гостю −8% CD",
  }],
  pineapple: [{
    id: "pine_food_star",
    kind: "star",
    at: [1, 0],
    acceptTags: ["food"],
    hostApply: { type: "healBonus", value: 1 },
    guestApply: { type: "healBonus", value: 1 },
    desc: "⭐ Еда в слоте: +1 хил хозяину и гостю",
  }],
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
