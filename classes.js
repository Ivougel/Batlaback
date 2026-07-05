/**
 * Герои игрока — стартовый лоадаут и пассивные бонусы забега.
 * noviceLabel / heroLabel — имя героя; desc — бонус; getClassIntroBlurb — текст для UI.
 */
const CLASS_HERO_ROSTER_COPY = {
  title: "Мартовичок · Роксивичок · Морковичок · Мыковичок",
  hint: "Четыре героини с разными бонусами — выберите, кто пойдёт в забег.",
};

const CLASS_CATALOG = {
  warrior: {
    id: "warrior",
    name: "Воин",
    noviceLabel: "Воин-мартовичок",
    heroLabel: "Воин-мартовичок",
    heroTagline: "+3% максимального HP на весь забег.",
    heroLore: "+3% максимального HP на весь забег. Старт: ржавый меч и железный шлем.",
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
    heroTagline: "+3% скорости атаки на весь забег.",
    heroLore: "+3% скорости атаки на весь забег. Старт: кинжал и флакон яда.",
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
    heroTagline: "+4% магического урона · мана-стаки усиливают урон.",
    heroLore: "+4% магического урона · мана-стаки дают +25% к урону. Старт: посох ученика и мана-кристалл.",
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
    heroTagline: "+1,5% макс. HP за еду · еда лечит на 8% сильнее.",
    heroLore: "+1,5% макс. HP за каждую еду в рюкзаке · еда лечит на 8% сильнее. Старт: яблоко и банан.",
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

/** Bust/стикер для HUD-карточки и плиток выбора класса. */
function getClassHudPortraitSrc(classId) {
  const cls = getClassById(classId);
  return cls?.hudPortraitSrc || cls?.heroPortraitSrc || cls?.iconSrc || null;
}

function syncClassPickPortrait(card, classId) {
  if (!card || !classId) return;
  let wrap = card.querySelector(".glass-card-icon--class");
  if (!wrap) {
    wrap = document.createElement("span");
    wrap.className = "glass-card-icon glass-card-icon--class class-icon class-pick-portrait";
    card.insertBefore(wrap, card.firstChild);
  } else {
    wrap.classList.add("class-pick-portrait");
  }
  wrap.dataset.class = classId;
  let img = wrap.querySelector(".class-pick-portrait-media, .class-sticker");
  if (!img) {
    img = document.createElement("img");
    img.draggable = false;
    wrap.replaceChildren(img);
  }
  img.className = "class-pick-portrait-media";
  const cls = getClassById(classId);
  const src = getClassHudPortraitSrc(classId);
  if (src) img.src = src;
  img.alt = cls?.noviceLabel || cls?.name || "";
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

function getClassIntroBlurb(classId) {
  const cls = getClassById(classId);
  const guide = getClassDetailGuide(classId);
  if (!cls) return "";
  const parts = [
    guide?.bonusDetail || cls.desc,
    cls.loadoutDesc ? `Старт: ${cls.loadoutDesc}` : "",
    guide?.tagFocus ? `Ищите: ${guide.tagFocus}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function getHeroLore(classId) {
  return getClassIntroBlurb(classId) || getClassById(classId)?.desc || "";
}

function getHeroTagline(classId) {
  const cls = getClassById(classId);
  return cls?.desc || cls?.heroTagline || "";
}

function syncClassHeroRosterCaption() {
  const titleEl = document.querySelector(".class-hero-roster-title");
  const hintEl = document.querySelector(".class-hero-roster-hint");
  if (titleEl) titleEl.textContent = CLASS_HERO_ROSTER_COPY.title;
  if (hintEl) hintEl.textContent = CLASS_HERO_ROSTER_COPY.hint;
}

function ensureClassCardFoot(card, selectors = [".class-name", ".class-desc", ".class-bonus"]) {
  if (card.querySelector(".class-card-foot")) return;
  const foot = document.createElement("div");
  foot.className = "class-card-foot";
  selectors.forEach((sel) => {
    const el = card.querySelector(sel);
    if (el) foot.appendChild(el);
  });
  if (foot.childElementCount) card.appendChild(foot);
}

function syncClassPickerCardsFromCatalog() {
  document.querySelectorAll(".class-card.glass-card[data-class]").forEach((card) => {
    ensureClassCardFoot(card);
    const cls = getClassById(card.dataset.class);
    if (!cls) return;
    const nameEl = card.querySelector(".class-name");
    const descEl = card.querySelector(".class-desc");
    const bonusEl = card.querySelector(".class-bonus");
    if (nameEl) nameEl.textContent = cls.heroLabel || cls.noviceLabel || cls.name;
    if (descEl) {
      descEl.textContent = "";
      descEl.classList.add("hidden");
      descEl.setAttribute("aria-hidden", "true");
    }
    if (bonusEl) {
      bonusEl.textContent = "";
      bonusEl.classList.add("hidden");
      bonusEl.setAttribute("aria-hidden", "true");
    }
    syncClassPickPortrait(card, card.dataset.class);
  });
  document.querySelectorAll(".opponent-class-card[data-opponent-class]").forEach((card) => {
    ensureClassCardFoot(card, [".class-name", ".class-desc"]);
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
    syncClassPickPortrait(card, card.dataset.opponentClass);
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
  syncClassDetailButton(null);
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

  showcase.dataset.class = classId;
  showcase.classList.remove("hidden");
  showcase.classList.add("is-visible");
  showcase.setAttribute("aria-hidden", "false");
  overlay?.classList.add("class-overlay--hero-visible");
  syncClassDetailButton(classId);
}

/** Подробности для попапа «Подробнее» на экране выбора героя. */
const CLASS_DETAIL_GUIDES = {
  warrior: {
    bonusDetail: "На весь забег +3% к максимальному HP — выдерживает длинные дуэли.",
    tagFocus: "Оружие, броня, щиты",
    builds: [
      {
        id: "guardian",
        name: "Страж",
        emoji: "🛡️",
        desc: "Блок, броня и живучесть — стойте на линии и не отступайте.",
        items: ["great_shield", "iron_helmet", "titan_armor", "wooden_buckler"],
      },
      {
        id: "berserk",
        name: "Берсерк",
        emoji: "🔥",
        desc: "Много оружия и темп — давите уроном, пока живы.",
        items: ["axe", "war_hammer", "whetstone", "rage_potion"],
      },
      {
        id: "crusader",
        name: "Крестоносец",
        emoji: "✝️",
        desc: "Святая броня и молот — путь к ветке Паладина.",
        items: ["holy_armor", "weapon_holy_mace", "shield_of_valor", "key_paladin_oath"],
      },
    ],
    recommendedItems: ["rusty_sword", "axe", "great_shield", "iron_helmet", "whetstone", "titan_armor"],
  },
  rogue: {
    bonusDetail: "+3% скорости атаки — чаще срабатывают оружие и ядовитые эффекты.",
    tagFocus: "Оружие, яд, ловушки",
    builds: [
      {
        id: "assassin",
        name: "Ассасин",
        emoji: "🗡️",
        desc: "Яд и быстрые удары — добивайте ослабленного врага.",
        items: ["dagger", "poison_dagger", "pestilence_flask", "spectral_dagger"],
      },
      {
        id: "shadow",
        name: "Тень",
        emoji: "🌑",
        desc: "Скрытность и контроль — уклонение, дым и внезапный урон.",
        items: ["smoke_bomb", "shadow_blade", "poison_vial", "garlic"],
      },
      {
        id: "plague",
        name: "Чума",
        emoji: "☣️",
        desc: "Стаки яда и урон со временем — медленно, но верно.",
        items: ["pestilence_flask", "darkest_lotus", "poison_vial", "enh_plague_bindings"],
      },
    ],
    recommendedItems: ["dagger", "poison_dagger", "poison_vial", "garlic", "pestilence_flask", "smoke_bomb"],
  },
  mage: {
    bonusDetail: "+4% магического урона · мана-стаки дают +25% к урону.",
    tagFocus: "Магия, кристаллы, огонь",
    builds: [
      {
        id: "pyro",
        name: "Пиромант",
        emoji: "🔥",
        desc: "Огонь и жар — поджигайте поле и усиливайте огненные предметы.",
        items: ["fire_staff", "fire_crystal", "lump_of_coal", "key_ember_codex"],
      },
      {
        id: "cryo",
        name: "Криомант",
        emoji: "❄️",
        desc: "Холод и контроль — замедляйте и бейте магией.",
        items: ["frost_crystal", "snow_stick", "spell_scroll_frostbolt", "frozen_flame"],
      },
      {
        id: "arcanist",
        name: "Арканист",
        emoji: "💎",
        desc: "Мана, кристаллы и повтор заклинаний.",
        items: ["mana_crystal", "prismatic_orb", "enchanted_staff", "rune_of_magic"],
      },
    ],
    recommendedItems: ["apprentice_staff", "mana_crystal", "fire_staff", "enchanted_staff", "prismatic_orb", "fly_agaric"],
  },
  priest: {
    bonusDetail: "+1.5% макс. HP за каждую еду · еда лечит на 8% сильнее.",
    tagFocus: "Еда, зелья, святой",
    builds: [
      {
        id: "paladin",
        name: "Паладин",
        emoji: "⚔️",
        desc: "Святой танк — броня, блок и исцеление.",
        items: ["holy_armor", "divine_potion", "weapon_holy_mace", "key_paladin_oath"],
      },
      {
        id: "zrecrela",
        name: "ЖРЕЦИЛА",
        emoji: "🎵",
        desc: "Хор, музыка и святые усиления — путь к ключу гимна.",
        items: ["armor_holy_choir", "accessory_musical_slippers", "key_hymn_folio", "enh_hymn_veil"],
      },
      {
        id: "oracle",
        name: "Провидец",
        emoji: "🔮",
        desc: "Лечение и выживание через зелья и травы.",
        items: ["healing_herbs", "health_potion", "bandage", "cheese"],
      },
    ],
    recommendedItems: ["apple", "banana", "healing_herbs", "health_potion", "divine_potion", "cheese"],
  },
};

/** Связь пути мутации с рекомендуемой сборкой в CLASS_DETAIL_GUIDES (если есть). */
const MUTATION_TO_BUILD_ID = {
  w_guardian: "guardian",
  w_berserk: "berserk",
  w_crusader: "crusader",
  r_assassin: "assassin",
  r_shadow: "shadow",
  r_plague: "plague",
  m_pyro: "pyro",
  m_cryo: "cryo",
  m_arcanist: "arcanist",
  p_paladin: "paladin",
  p_zrecrela: "zrecrela",
  p_oracle: "oracle",
};

function getClassIdForMutation(mutationId) {
  const def = typeof getMutationById === "function" ? getMutationById(mutationId) : null;
  return def?.noviceClass || null;
}

function resolveBuildIdForMutation(mutationId) {
  return MUTATION_TO_BUILD_ID[mutationId] || null;
}

function getClassDetailGuide(classId) {
  const cls = getClassById(classId);
  const guide = CLASS_DETAIL_GUIDES[classId];
  if (!cls || !guide) return null;
  return { ...guide, classId, cls };
}

function syncClassDetailButton(classId) {
  const btn = document.getElementById("btn-class-detail");
  if (!btn) return;
  const playerStep = document.getElementById("class-step-player");
  const onPlayerStep = playerStep && !playerStep.classList.contains("hidden");
  const show = onPlayerStep && !!classId && !!getClassDetailGuide(classId);
  btn.classList.toggle("hidden", !show);
  btn.disabled = !show;
  if (show) btn.dataset.classId = classId;
  else delete btn.dataset.classId;
}
