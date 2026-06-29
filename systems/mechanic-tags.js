/**
 * Теги механик в описаниях: [начало боя], [еда] — синяя подсветка в тултипах.
 */

const MECHANIC_TAG_HINTS = {
  "начало боя": "Предмет с эффектом в начале боя или учитывается копилкой",
  "в начале боя": "Срабатывает один раз при старте боя",
  "при попадании": "Когда предмет наносит урон по HP противника",
  "при промахе": "Когда атака этого предмета промахнулась",
  "при атаке": "При активации атакующего предмета",
  "при блоке": "Когда вы блокируете входящий урон",
  "при входе в магазин": "Срабатывает при открытии магазина между боями",
  "пассивно": "Постоянный эффект, не требует активации",
  "оружие": "Предмет с тегом weapon",
  "броня": "Предмет с тегом armor",
  "щит": "Предмет с тегом shield",
  "магия": "Магический урон или тег magic",
  "огонь": "Огненный урон или тег fire",
  "яд": "Яд или тег poison",
  "еда": "Предмет с тегом food",
  "кристалл": "Предмет с тегом gem",
  "питомец": "Предмет с тегом pet",
  "удача": "Стак или тег luck",
  "шип": "Стак spikes",
  "шипы": "Стак spikes",
  "блок": "Стак block или эффект блока",
  "жар": "Стак heat",
  "мана": "Стак mana",
  "реген": "Стак regen",
  "холод": "Стак cold",
  "усиление": "Стак empower",
  "вампирский": "Предмет с тегом vampiric",
  "лечение": "Эффект исцеления",
  "дебафф": "Отрицательный эффект на противнике",
  "карта": "Предмет с тегом card",
};

/** Триггеры и фразы → теги (длинные первыми). */
const MECHANIC_TRIGGER_REPLACEMENTS = [
  ["При входе в магазин", "[при входе в магазин]"],
  ["В начале боя", "В [начале боя]"],
  ["При попадании", "[при попадании]"],
  ["При промахе", "[при промахе]"],
  ["При атаке", "[при атаке]"],
  ["При блоке", "[при блоке]"],
  ["Пассивно", "[пассивно]"],
];

function escapeMechanicHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeMechanicAttr(text) {
  return escapeMechanicHtml(text).replace(/'/g, "&#39;");
}

/** «тег» → [тег], триггеры, «за каждый предмет [X]» → «… с [X]». */
function normalizeMechanicTags(text) {
  if (text == null || text === "") return "";
  let s = String(text);

  s = s.replace(/«([^»]+)»/g, "[$1]");
  s = s.replace(/“([^”]+)”/g, "[$1]");
  s = s.replace(/"([^"]+)"/g, "[$1]");

  MECHANIC_TRIGGER_REPLACEMENTS.forEach(([from, to]) => {
    s = s.split(from).join(to);
  });

  s = s.replace(/(?:^|[\s,.])за каждый предмет \[(?!с )/g, (m) => m.replace(" предмет [", " предмет с ["));
  s = s.replace(/(?:^|[\s,.])за предмет \[(?!с )/g, (m) => m.replace(" предмет [", " предмет с ["));
  s = s.replace(/(?:^|[\s,.])с каждым предметом \[(?!с )/g, (m) => m.replace(" предметом [", " предметом с ["));

  return s;
}

function formatMechanicTagHtml(label) {
  const key = String(label).toLowerCase();
  const hint = MECHANIC_TAG_HINTS[key];
  const title = hint ? ` title="${escapeMechanicAttr(hint)}"` : "";
  return `<span class="mechanic-tag"${title}>${escapeMechanicHtml(label)}</span>`;
}

/** Текст с [тегами] → HTML с синими span.mechanic-tag */
function formatMechanicTagsHtml(text, options = {}) {
  const { normalize = true } = options;
  const raw = normalize ? normalizeMechanicTags(text) : String(text ?? "");
  if (!raw.includes("[")) return escapeMechanicHtml(raw);

  return raw
    .split(/(\[[^\]]+\])/g)
    .map((part) => {
      if (part.startsWith("[") && part.endsWith("]")) {
        return formatMechanicTagHtml(part.slice(1, -1));
      }
      return escapeMechanicHtml(part);
    })
    .join("");
}

/** Обёртка для подписи тега предмета: [еда] */
function formatItemTagMechanic(tag) {
  const label = typeof formatTagLabel === "function" ? formatTagLabel(tag) : tag;
  return `[${label}]`;
}
