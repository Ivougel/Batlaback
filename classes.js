/**
 * Классы игрока — стартовый лоадаут и пассивные бонусы забега.
 */
const CLASS_CATALOG = {
  warrior: {
    id: "warrior",
    name: "Воин",
    noviceLabel: "Воин-новичок",
    icon: "⚔️",
    iconSrc: "img/sticker_warrior.png",
    desc: "+3% максимального здоровья",
    starterItems: ["rusty_sword", "iron_helmet"],
    combatBonus: { type: "maxHpMult", value: 0.03 },
    priorityTags: ["weapon", "armor", "shield"],
  },
  rogue: {
    id: "rogue",
    name: "Разбойник",
    noviceLabel: "Разбойник-новичок",
    icon: "🗡️",
    iconSrc: "img/sticker_rogue.png",
    desc: "+3% скорость атаки",
    starterItems: ["dagger", "poison_vial"],
    combatBonus: { type: "attackSpeedMult", value: 0.03 },
    priorityTags: ["weapon", "poison"],
  },
  mage: {
    id: "mage",
    name: "Маг",
    noviceLabel: "Маг-новичок",
    icon: "🔮",
    iconSrc: "img/sticker_mage.png",
    desc: "+4% магический урон · мана-стаки +25% к урону",
    starterItems: ["apprentice_staff", "mana_crystal"],
    combatBonus: { type: "magicDamageMult", value: 0.04 },
    priorityTags: ["magic", "gem", "fire"],
  },
  priest: {
    id: "priest",
    name: "Жрец",
    noviceLabel: "Жрец-новичок",
    icon: "✨",
    iconSrc: "img/sticker_priest.png",
    desc: "+1.5% макс. HP за еду · еда лечит на 8% сильнее",
    starterItems: ["apple", "banana"],
    combatBonus: { type: "foodInventory", maxHpPctPerFood: 0.015, foodHealMult: 0.08 },
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
