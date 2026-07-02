/**
 * Классы игрока — стартовый лоадаут и пассивные бонусы забега.
 */
const CLASS_CATALOG = {
  warrior: {
    id: "warrior",
    name: "Воин",
    noviceLabel: "Воин-мартовичок",
    icon: "⚔️",
    iconSrc: "img/sticker_warrior.png",
    heroPortraitSrc: "img/gem/Warior new.png",
    desc: "+3% максимального здоровья",
    starterItems: ["rusty_sword", "iron_helmet"],
    combatBonus: { type: "maxHpMult", value: 0.03 },
    priorityTags: ["weapon", "armor", "shield"],
  },
  rogue: {
    id: "rogue",
    name: "Разбойник",
    noviceLabel: "Разбойник-роксивичок",
    icon: "🗡️",
    iconSrc: "img/sticker_rogue.png",
    heroPortraitSrc: "img/gem/roguenew.png",
    desc: "+3% скорость атаки",
    starterItems: ["dagger", "poison_vial"],
    combatBonus: { type: "attackSpeedMult", value: 0.03 },
    priorityTags: ["weapon", "poison"],
  },
  mage: {
    id: "mage",
    name: "Маг",
    noviceLabel: "Маг-морковичок",
    icon: "🔮",
    iconSrc: "img/sticker_mage.png",
    heroPortraitSrc: "img/gem/Magenew.png",
    desc: "+4% магический урон · мана-стаки +25% к урону",
    starterItems: ["apprentice_staff", "mana_crystal"],
    combatBonus: { type: "magicDamageMult", value: 0.04 },
    priorityTags: ["magic", "gem", "fire"],
  },
  priest: {
    id: "priest",
    name: "Жрец",
    noviceLabel: "Жрец-мыковичок",
    icon: "✨",
    iconSrc: "img/sticker_priest.png",
    heroPortraitSrc: "img/gem/priestnew.png",
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

function getClassHeroPortraitSrc(classId) {
  const cls = getClassById(classId);
  return cls?.heroPortraitSrc || cls?.iconSrc || null;
}

const CLASS_HERO_ROSTER_ORDER = ["warrior", "rogue", "mage", "priest"];

function hideClassHeroShowcase() {
  const showcase = document.getElementById("class-hero-showcase");
  const overlay = document.getElementById("class-overlay");
  if (!showcase) return;
  showcase.classList.add("hidden");
  showcase.classList.remove("is-visible", "class-hero-showcase--roster");
  showcase.removeAttribute("data-class");
  showcase.setAttribute("aria-hidden", "true");
  document.getElementById("class-hero-showcase-single")?.classList.add("hidden");
  document.getElementById("class-hero-showcase-roster")?.classList.add("hidden");
  overlay?.classList.remove("class-overlay--hero-visible");
}

function ensureClassHeroRosterGrid() {
  const grid = document.getElementById("class-hero-roster-grid");
  if (!grid || grid.dataset.built === "1") return;
  grid.innerHTML = CLASS_HERO_ROSTER_ORDER.map((classId, index) => {
    const cls = getClassById(classId);
    const src = getClassHeroPortraitSrc(classId);
    if (!cls || !src) return "";
    return `
      <div class="class-hero-roster-cell" data-class="${classId}" style="--roster-i:${index}">
        <div class="class-hero-roster-cell-glow" aria-hidden="true"></div>
        <img class="class-hero-roster-img" src="${escapeClassHtml(src)}" alt="${escapeClassHtml(cls.noviceLabel || cls.name)}" draggable="false">
        <span class="class-hero-roster-label">${escapeClassHtml(cls.noviceLabel || cls.name)}</span>
      </div>
    `;
  }).join("");
  grid.dataset.built = "1";
}

function updateClassHeroRosterShowcase() {
  const showcase = document.getElementById("class-hero-showcase");
  const single = document.getElementById("class-hero-showcase-single");
  const roster = document.getElementById("class-hero-showcase-roster");
  const overlay = document.getElementById("class-overlay");
  if (!showcase || !roster) return;

  ensureClassHeroRosterGrid();
  single?.classList.add("hidden");
  roster.classList.remove("hidden");
  roster.setAttribute("aria-hidden", "false");

  showcase.classList.remove("hidden");
  showcase.classList.add("is-visible", "class-hero-showcase--roster");
  showcase.removeAttribute("data-class");
  showcase.setAttribute("aria-hidden", "false");
  overlay?.classList.add("class-overlay--hero-visible");
}

function updateClassHeroShowcase(classId) {
  const showcase = document.getElementById("class-hero-showcase");
  const single = document.getElementById("class-hero-showcase-single");
  const roster = document.getElementById("class-hero-showcase-roster");
  const img = document.getElementById("class-hero-showcase-img");
  const nameEl = document.getElementById("class-hero-showcase-name");
  const descEl = document.getElementById("class-hero-showcase-desc");
  const overlay = document.getElementById("class-overlay");
  if (!showcase || !img) return;

  const cls = classId ? getClassById(classId) : null;
  if (!cls) {
    hideClassHeroShowcase();
    return;
  }

  roster?.classList.add("hidden");
  roster?.setAttribute("aria-hidden", "true");
  single?.classList.remove("hidden");
  showcase.classList.remove("class-hero-showcase--roster");

  const src = getClassHeroPortraitSrc(classId);
  if (img.getAttribute("src") !== src) img.setAttribute("src", src || "");
  img.alt = cls.noviceLabel || cls.name;
  if (nameEl) nameEl.textContent = cls.noviceLabel || cls.name;
  if (descEl) descEl.textContent = cls.desc || "";

  showcase.dataset.class = classId;
  showcase.classList.remove("hidden");
  showcase.classList.add("is-visible");
  showcase.setAttribute("aria-hidden", "false");
  overlay?.classList.add("class-overlay--hero-visible");
}
