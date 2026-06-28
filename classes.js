/**
 * Классы игрока — стартовый лоадаут и пассивные бонусы забега.
 */
const CLASS_CATALOG = {
  warrior: {
    id: "warrior",
    name: "Воин",
    icon: "⚔️",
    iconSrc: "img/sticker_warrior.png",
    desc: "+10% максимального здоровья",
    starterItems: ["rusty_sword", "iron_helmet"],
    combatBonus: { type: "maxHpMult", value: 0.1 },
    priorityTags: ["weapon", "armor", "shield"],
  },
  rogue: {
    id: "rogue",
    name: "Разбойник",
    icon: "🗡️",
    iconSrc: "img/sticker_rogue.png",
    desc: "+10% скорость атаки",
    starterItems: ["dagger", "poison_vial"],
    combatBonus: { type: "attackSpeedMult", value: 0.1 },
    priorityTags: ["weapon", "poison"],
  },
  mage: {
    id: "mage",
    name: "Маг",
    icon: "🔮",
    iconSrc: "img/sticker_mage.png",
    desc: "+15% магический урон · мана-стаки +50% к урону",
    starterItems: ["apprentice_staff", "mana_crystal"],
    combatBonus: { type: "magicDamageMult", value: 0.15 },
    priorityTags: ["magic", "gem", "fire"],
  },
  priest: {
    id: "priest",
    name: "Жрец",
    icon: "✨",
    iconSrc: "img/sticker_priest.png",
    desc: "+5 макс. HP за каждую еду в рюкзаке",
    starterItems: ["apple", "banana"],
    combatBonus: { type: "foodInventory", maxHpPerFood: 5 },
    priorityTags: ["food", "potion", "nature"],
  },
};

function escapeClassHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function renderClassIconHTML(classId, imgClass = "class-sticker") {
  const cls = getClassById(classId);
  if (!cls) return "❓";
  if (cls.iconSrc) {
    return `<img class="${imgClass}" src="${escapeClassHtml(cls.iconSrc)}" alt="${escapeClassHtml(cls.name)}" draggable="false">`;
  }
  return cls.icon || "❓";
}

function getClassById(id) {
  return CLASS_CATALOG[id] || null;
}

function pickRandomClassId() {
  const keys = Object.keys(CLASS_CATALOG);
  return keys[Math.floor(Math.random() * keys.length)];
}
