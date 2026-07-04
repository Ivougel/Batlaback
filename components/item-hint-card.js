/**
 * Карточка-подсказка предмета/усиления: крупный emoji + HUD-текст сверху (реф. Hearthstone).
 */

function stripLeadingEmoji(text) {
  return String(text ?? "")
    .replace(/^(\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*)\s*/u, "")
    .trim();
}

function extractLeadingEmoji(text) {
  const match = String(text ?? "").match(/^(\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*)/u);
  return match?.[1] || null;
}

function renderTooltipHudLineHtml(line) {
  if (!line || line.sep) return "";
  const fmt = typeof formatTooltipMechanicText === "function"
    ? formatTooltipMechanicText
    : (text) => (typeof escapeTooltipHtml === "function" ? escapeTooltipHtml(text) : String(text ?? ""));
  const esc = typeof escapeTooltipHtml === "function" ? escapeTooltipHtml : (s) => String(s ?? "");
  const color = line.color ? ` style="color:${line.color}"` : "";
  if (line.statDelta) {
    const buffClass = line.statDelta.buffColor === "purple" ? " item-hint-card__stat-buff--purple" : "";
    const suffix = line.statDelta.suffix ? esc(line.statDelta.suffix) : "";
    return `<div class="item-hint-card__line item-hint-card__line-stat item-hint-card__line--${line.style || "normal"}"${color}>${fmt(line.text)} <span class="item-hint-card__stat-base">${esc(line.statDelta.from)}</span><span class="item-hint-card__stat-arrow">→</span><span class="item-hint-card__stat-buff${buffClass}">${esc(line.statDelta.to)}</span>${suffix}</div>`;
  }
  return `<div class="item-hint-card__line item-hint-card__line--${line.style || "normal"}"${color}>${fmt(line.text)}</div>`;
}

function renderTooltipCardHtml(lines, options = {}) {
  const list = (lines || []).filter(Boolean);
  const titleLine = list.find((l) => l.style === "title") || list[0];
  const hudLines = list.filter((l) => !l.sep);
  const emoji = options.emoji
    || extractLeadingEmoji(titleLine?.text)
    || "📦";
  const rarityColor = options.rarityColor || "#30363d";
  const costBadge = options.costBadge ?? null;
  const titleText = stripLeadingEmoji(titleLine?.text || "") || "Предмет";

  const bodyHtml = hudLines.map((line) => {
    if (line === titleLine) {
      const color = titleLine.color ? ` style="color:${titleLine.color}"` : "";
      const fmt = typeof formatTooltipMechanicText === "function"
        ? formatTooltipMechanicText
        : (text) => (typeof escapeTooltipHtml === "function" ? escapeTooltipHtml(text) : String(text ?? ""));
      return `<div class="item-hint-card__title"${color}>${fmt(titleText)}</div>`;
    }
    return renderTooltipHudLineHtml(line);
  }).join("");

  const costHtml = costBadge != null && costBadge !== ""
    ? `<div class="item-hint-card__cost" aria-hidden="true"><span class="item-hint-card__cost-value">${typeof escapeTooltipHtml === "function" ? escapeTooltipHtml(String(costBadge)) : String(costBadge)}</span></div>`
    : "";

  return `<div class="item-hint-card${costBadge != null && costBadge !== "" ? " item-hint-card--has-cost" : ""}" style="--hint-rarity:${rarityColor}">
    <div class="item-hint-card__frame">
      ${costHtml}
      <div class="item-hint-card__hud">${bodyHtml}</div>
      <div class="item-hint-card__art" aria-hidden="true">
        <div class="item-hint-card__art-glow"></div>
        <span class="item-hint-card__emoji">${emoji}</span>
      </div>
      <div class="item-hint-card__gem" aria-hidden="true"></div>
    </div>
  </div>`;
}

function getItemTooltipCardOptions(def, context = "field") {
  if (!def) return { emoji: "📦", rarityColor: "#30363d" };
  const emoji = typeof getItemIcons === "function"
    ? (getItemIcons(def)[0] || "📦")
    : (def.icon || "📦");
  const rarityColor = typeof RARITY_COLORS !== "undefined"
    ? (RARITY_COLORS[def.rarity] || "#30363d")
    : "#30363d";
  let costBadge = null;
  if (context === "shop" && def.cost != null) costBadge = def.cost;
  return { emoji, rarityColor, costBadge };
}

function getEnhancementTooltipCardOptions(def, context = "shop") {
  if (!def) return { emoji: "✨", rarityColor: "#30363d" };
  const emoji = def.icon || "✨";
  const rarityColor = typeof RARITY_COLORS !== "undefined"
    ? (RARITY_COLORS[def.rarity] || "#30363d")
    : "#30363d";
  let costBadge = null;
  if (context === "shop" && typeof getEnhancementShopCost === "function") {
    costBadge = getEnhancementShopCost(def);
  }
  return { emoji, rarityColor, costBadge };
}

function applySidebarTooltipCard(el, lines, cardOptions) {
  if (!el) return;
  el.classList.remove("synergy-tooltip");
  el.classList.add("sidebar-tooltip--card");
  el.style.borderColor = "";
  el.style.border = "";
  el.style.background = "";
  el.style.boxShadow = "";
  el.innerHTML = renderTooltipCardHtml(lines, cardOptions || {});
}

function applySidebarTooltipPlain(el, lines) {
  if (!el) return;
  el.classList.remove("sidebar-tooltip--card");
  if (typeof renderTooltipLinesHtml === "function") {
    el.innerHTML = renderTooltipLinesHtml(lines);
  }
}
