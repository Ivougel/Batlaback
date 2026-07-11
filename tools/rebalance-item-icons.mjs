#!/usr/bin/env node
/**
 * Уникализирует icon в tools/items-migrated.json: один базовый эмодзi на группу,
 * варианты — duo по смыслу (теги, крафт, flavor).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const JSON_PATH = path.join(ROOT, "tools/items-migrated.json");

/** @type {Record<string, string>} */
const ICON_PATCH = {
  // 🪨 — базовый камень
  bag_of_stones: "🪨🎒",
  stone_badge: "🪨🏅",
  whetstone: "🪨🔧",
  lump_of_coal: "🪨♨️",

  // 🔥 — горящий уголь
  fire_staff: "🔥🪄",
  burning_torch: "🔦🔥",
  flame_badge: "🔥🏅",

  // ✨ — искорка
  magic_badge: "✨🏅",
  rune_of_magic: "📜✨",
  magic_torch: "🔦✨",

  // 🎒 — рюкзак
  fanny_pack: "🎒👝",
  stamina_sack: "🎒💪",

  // 🔨 — молот
  forging_hammer: "🔨⚒️",
  war_hammer: "🔨⚔️",

  // ⚔️ — меч рыцаря
  crossblades: "⚔️✖️",
  hero_sword: "⚔️🦸",

  // 🗡️ — ядовитый кинжал
  rusty_sword: "🗡️🕸️",
  hero_long_sword: "🗡️📏",

  // 📦 — ящик богатства
  storage_chest: "📦🗄️",
  box_of_prosperity: "📦💰",

  // 🔮 — сфера маны
  mana_orb_charm: "🔮📿",
  prismatic_orb: "🔮🌈",

  // 🪄 — посох ученика (magic_staff уже 🪄✨)
  enchanted_staff: "🪄💫",

  // 💳 — карта покупателя
  platinum_customer_card: "💳💎",

  // 🧪✨ — божественное зелье (mana_potion уже 🧪🔮)
  strong_mana_potion: "🧪💠",

  // ❄️ — морозный кристалл
  snowmaster: "❄️👑",

  // 🌿 — целебная трава
  healing_herbs: "🌿🧺",

  // 🛡️ — железный щит
  great_shield: "🛡️🔰",

  // 🍀 — талисман
  lucky_clover: "☘️",

  // 💎 — мана-кристалл
  corrupted_crystal: "💎🌀",

  // 🐷 — копилка
  lucky_piggy: "🐷🍀",

  // 🏖️ — карманный песок
  sir_sand: "🏖️⚔️",

  // 🐚 — Шелли (pet)
  shiny_shell: "🐚✨",

  // ⛄ — снежок
  wonky_snowman: "⛄🎩",

  // 🦷 — клык зверя
  walrus_tusk: "🦷🌊",

  // 🥕 — морковь
  carrot_goobert: "🥕🟢",

  // 🌶️ — перец чили
  chili_goobert: "🌶️🟢",

  // 🧊 — Куберт (pet)
  frozen_flame: "🧊🔥",

  // 🪔 — лампа джинна
  oil_lamp: "🪔🛢️",

  // 🛄 — большой мешок
  duffle_bag: "🛄✈️",

  // 👜 — кожаная сумка
  starter_bag: "👜🌱",

  // 🌰 — маленький каштан (pet)
  acorn_collar: "🌰📿",

  // 🌈 — радужный значок
  rainbow_goobert: "🌈🟢",

  // 💀 — черепной значок (артефакты камня: 🪨❄️ / 🪨🔥)
  artifact_stone_death: "🪨💀",
};

const raw = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
const items = raw.items || raw;

let changed = 0;
for (const item of items) {
  const next = ICON_PATCH[item.id];
  if (!next || item.icon === next) continue;
  item.icon = next;
  changed += 1;
}

const byIcon = new Map();
for (const item of items) {
  const icon = item.icon || "";
  if (!byIcon.has(icon)) byIcon.set(icon, []);
  byIcon.get(icon).push(item.id);
}

const dups = [...byIcon.entries()].filter(([, list]) => list.length > 1);
if (dups.length) {
  console.error("Остались дубликаты иконок:");
  for (const [icon, ids] of dups.sort((a, b) => b[1].length - a[1].length)) {
    console.error(`  ${JSON.stringify(icon)} (${ids.length}): ${ids.join(", ")}`);
  }
  process.exit(1);
}

fs.writeFileSync(JSON_PATH, `${JSON.stringify(raw, null, 2)}\n`);
console.log(`Обновлено иконок: ${changed}`);
console.log(`Уникальных icon: ${byIcon.size} / ${items.length} предметов`);
