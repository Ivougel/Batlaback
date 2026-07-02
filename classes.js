/**
 * Герои игрока — стартовый лоадаут и пассивные бонусы забега.
 * noviceLabel / heroLabel — имя героя; heroTagline — строка на плитке; heroLore — история в витрине.
 */
const CLASS_HERO_ROSTER_COPY = {
  title: "Мартовичок · Роксивичок · Морковичок · Мыковичок",
  hint: "Девочки-звери собрались, чтобы скрестить кличку с именем — и решить, кто идёт в забег.",
};

const CLASS_CATALOG = {
  warrior: {
    id: "warrior",
    name: "Воин",
    noviceLabel: "Воин-мартовичок",
    heroLabel: "Воин-мартовичок",
    heroTagline: "Корги, что клялась оставаться милым арбузиком на лугу — и пошла в бой с мечом.",
    heroLore: "Мартовичок — упрямая корги-девочка: кличку скрестили с именем, характер не смягчили. На тропинке она милая, в рюкзаке — ржавый меч и железный шлем. За весь забег даёт чуть больше максимального здоровья и стоит на лапах, когда другие уже валятся.",
    icon: "⚔️",
    iconSrc: "img/sticker_warrior.png",
    heroPortraitSrc: "img/gem/Warior new.png",
    desc: "+3% максимального здоровья",
    loadoutDesc: "Ржавый меч · железный шлем",
    starterItems: ["rusty_sword", "iron_helmet"],
    combatBonus: { type: "maxHpMult", value: 0.03 },
    priorityTags: ["weapon", "armor", "shield"],
  },
  rogue: {
    id: "rogue",
    name: "Разбойник",
    noviceLabel: "Разбойник-роксивичок",
    heroLabel: "Разбойник-роксивичок",
    heroTagline: "Кошка с двумя жизнями: хитрые ловушки днём, слава в чате — ночью.",
    heroLore: "Роксивичок — рыжая разбойница, которая успевает и подстроить сюрприз на поляне, и засиять в переписке. Кинжал и яд всегда под лапой: бьёт чаще и быстрее, чем соперник успевает моргнуть.",
    icon: "🗡️",
    iconSrc: "img/sticker_rogue.png",
    heroPortraitSrc: "img/gem/roguenew.png",
    desc: "+3% скорость атаки",
    loadoutDesc: "Кинжал · яд",
    starterItems: ["dagger", "poison_vial"],
    combatBonus: { type: "attackSpeedMult", value: 0.03 },
    priorityTags: ["weapon", "poison"],
  },
  mage: {
    id: "mage",
    name: "Маг",
    noviceLabel: "Маг-морковичок",
    heroLabel: "Маг-морковичок",
    heroTagline: "Маг с блестящими заклинаниями — превращает хаос на поле в урон.",
    heroLore: "Морковичок — колдунья с театральным жестом: на поле боя сыплет искры, усиливает мана-стаки и выжимает из посоха ученика лишний магический урон. Чем больше магии в рюкзаке, тем ярче финал раунда.",
    icon: "🔮",
    iconSrc: "img/sticker_mage.png",
    heroPortraitSrc: "img/gem/Magenew.png",
    desc: "+4% магический урон · мана-стаки +25% к урону",
    loadoutDesc: "Посох ученика · мана-кристалл",
    starterItems: ["apprentice_staff", "mana_crystal"],
    combatBonus: { type: "magicDamageMult", value: 0.04 },
    priorityTags: ["magic", "gem", "fire"],
  },
  priest: {
    id: "priest",
    name: "Жрец",
    noviceLabel: "Жрец-мыковичок",
    heroLabel: "Жрец-мыковичок",
    heroTagline: "Жрица с оперным голосом и корзиной перекусов под рясой.",
    heroLore: "Мыковичок — корги-сопрано, о которой пишут в журнале DOG. Благословляет яблоки и бананы: каждая еда в рюкзаке чуть раздувает максимум HP, а лечение от перекусов работает сильнее.",
    icon: "✨",
    iconSrc: "img/sticker_priest.png",
    heroPortraitSrc: "img/gem/priestnew.png",
    desc: "+1.5% макс. HP за еду · еда лечит на 8% сильнее",
    loadoutDesc: "Яблоко · банан",
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

function getHeroLabel(classId) {
  const cls = getClassById(classId);
  return cls?.heroLabel || cls?.noviceLabel || cls?.name || null;
}

function getClassHeroPortraitSrc(classId) {
  const cls = getClassById(classId);
  return cls?.heroPortraitSrc || cls?.iconSrc || null;
}

/** Волшебная рамка героя (prep / HUD) — свой стиль на каждый класс. */
function renderHeroPortraitFrameHTML(classId, options = {}) {
  const cls = getClassById(classId);
  const safeClass = cls ? classId : "warrior";
  const { alt = cls?.name || "" } = options;
  const src = getClassHeroPortraitSrc(classId);
  const safeAlt = escapeClassHtml(alt);

  if (!src && !cls?.icon) {
    return `<span class="prep-character-emoji">❓</span>`;
  }

  const portraitHtml = src
    ? `<img class="hero-portrait-frame__img prep-character-img" src="${escapeClassHtml(src)}" alt="${safeAlt}" draggable="false">`
    : `<span class="prep-character-emoji hero-portrait-frame__emoji">${cls.icon}</span>`;

  const sparkles = [1, 2, 3, 4, 5, 6].map(
    (i) => `<span class="hero-portrait-sparkle hero-portrait-sparkle--${i}" aria-hidden="true"></span>`,
  ).join("");

  return `<div class="hero-portrait-frame" data-class="${escapeClassHtml(safeClass)}">
    <div class="hero-portrait-frame__scene" aria-hidden="true">
      <div class="hero-portrait-frame__sun"></div>
      <div class="hero-portrait-frame__glow"></div>
      <div class="hero-portrait-frame__sparkles">${sparkles}</div>
      <div class="hero-portrait-frame__grass"></div>
    </div>
    ${portraitHtml}
    <div class="hero-portrait-frame__ornament" aria-hidden="true"></div>
  </div>`;
}

function getHeroLore(classId) {
  return getClassById(classId)?.heroLore || "";
}

function getHeroTagline(classId) {
  const cls = getClassById(classId);
  return cls?.heroTagline || cls?.heroLore || "";
}

function syncClassHeroRosterCaption() {
  const titleEl = document.querySelector(".class-hero-roster-title");
  const hintEl = document.querySelector(".class-hero-roster-hint");
  if (titleEl) titleEl.textContent = CLASS_HERO_ROSTER_COPY.title;
  if (hintEl) hintEl.textContent = CLASS_HERO_ROSTER_COPY.hint;
}

function syncClassPickerCardsFromCatalog() {
  document.querySelectorAll(".class-card.glass-card[data-class]").forEach((card) => {
    const cls = getClassById(card.dataset.class);
    if (!cls) return;
    const nameEl = card.querySelector(".class-name");
    const descEl = card.querySelector(".class-desc");
    const bonusEl = card.querySelector(".class-bonus");
    if (nameEl) nameEl.textContent = cls.noviceLabel || cls.heroLabel || cls.name;
    const tagline = getHeroTagline(card.dataset.class);
    if (descEl) {
      if (tagline) {
        descEl.textContent = tagline;
        descEl.classList.remove("hidden");
        descEl.removeAttribute("aria-hidden");
      } else {
        descEl.textContent = "";
        descEl.classList.add("hidden");
        descEl.setAttribute("aria-hidden", "true");
      }
    }
    if (bonusEl) bonusEl.textContent = cls.desc || "";
  });
  document.querySelectorAll(".opponent-class-card[data-opponent-class]").forEach((card) => {
    const cls = getClassById(card.dataset.opponentClass);
    if (!cls) return;
    const nameEl = card.querySelector(".class-name");
    const descEl = card.querySelector(".class-desc");
    if (nameEl) nameEl.textContent = cls.noviceLabel || cls.heroLabel || cls.name;
    if (descEl) {
      descEl.textContent = cls.desc || cls.loadoutDesc || "";
      descEl.classList.remove("hidden");
      descEl.removeAttribute("aria-hidden");
    }
  });
}

const CLASS_HERO_ROSTER_ORDER = ["warrior", "rogue", "mage", "priest"];

function setClassHeroShowcaseMode(mode) {
  const single = document.getElementById("class-hero-showcase-single");
  const roster = document.getElementById("class-hero-showcase-roster");
  if (!single || !roster) return;
  const showRoster = mode === "roster";
  single.classList.toggle("hidden", showRoster);
  roster.classList.toggle("hidden", !showRoster);
  single.setAttribute("aria-hidden", showRoster ? "true" : "false");
  roster.setAttribute("aria-hidden", showRoster ? "false" : "true");
}

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
  if (!grid || grid.dataset.built === "2") return;
  grid.innerHTML = CLASS_HERO_ROSTER_ORDER.map((classId, index) => {
    const cls = getClassById(classId);
    const src = getClassHeroPortraitSrc(classId);
    if (!cls || !src) return "";
    return `
      <div class="class-hero-roster-cell" data-class="${classId}" style="--roster-i:${index}">
        <img class="class-hero-roster-img" src="${escapeClassHtml(src)}" alt="${escapeClassHtml(cls.noviceLabel || cls.name)}" draggable="false">
        <span class="class-hero-roster-label">${escapeClassHtml(cls.heroLabel || cls.noviceLabel || cls.name)}</span>
      </div>
    `;
  }).join("");
  grid.dataset.built = "2";
}

function updateClassHeroRosterShowcase() {
  const showcase = document.getElementById("class-hero-showcase");
  const overlay = document.getElementById("class-overlay");
  if (!showcase) return;

  ensureClassHeroRosterGrid();
  syncClassHeroRosterCaption();
  setClassHeroShowcaseMode("roster");

  showcase.classList.remove("hidden");
  showcase.classList.add("is-visible", "class-hero-showcase--roster");
  showcase.removeAttribute("data-class");
  showcase.setAttribute("aria-hidden", "false");
  overlay?.classList.add("class-overlay--hero-visible");
}

function updateClassHeroShowcase(classId) {
  const showcase = document.getElementById("class-hero-showcase");
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

  setClassHeroShowcaseMode("single");
  showcase.classList.remove("class-hero-showcase--roster");

  const src = getClassHeroPortraitSrc(classId);
  if (img.getAttribute("src") !== src) img.setAttribute("src", src || "");
  img.alt = cls.heroLabel || cls.noviceLabel || cls.name;
  if (nameEl) nameEl.textContent = cls.heroLabel || cls.noviceLabel || cls.name;
  if (descEl) descEl.textContent = cls.heroLore || cls.desc || "";

  showcase.dataset.class = classId;
  showcase.classList.remove("hidden");
  showcase.classList.add("is-visible");
  showcase.setAttribute("aria-hidden", "false");
  overlay?.classList.add("class-overlay--hero-visible");
}
