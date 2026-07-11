/**
 * Карточка-подсказка предмета — компактная сводка + попапы info/craft (реф. Backpack Battles).
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

const HINT_LINE_TONE_BY_COLOR = {
  "#8b949e": "muted",
  "#6e7681": "muted",
  "#c9d1d9": "body",
  "#e6edf3": "body",
  "#f0c14b": "gold",
  "#d29922": "amber",
  "#79c0ff": "info",
  "#58a6ff": "info",
  "#d2a8ff": "magic",
  "#bc8cff": "magic",
  "#a371f7": "epic",
  "#3fb950": "buff",
  "#ff7b72": "danger",
  "#ffa657": "unique",
};

function resolveHintLineTone(line) {
  if (!line) return "body";
  if (line.style === "sub") return "muted";
  if (line.style === "label") return "label";
  const tone = HINT_LINE_TONE_BY_COLOR[String(line.color || "").trim().toLowerCase()];
  return tone || "body";
}

function renderTooltipHudLineHtml(line) {
  if (!line || line.sep) return "";
  const fmt = typeof formatTooltipMechanicText === "function"
    ? formatTooltipMechanicText
    : (text) => (typeof escapeTooltipHtml === "function" ? escapeTooltipHtml(text) : String(text ?? ""));
  const esc = typeof escapeTooltipHtml === "function" ? escapeTooltipHtml : (s) => String(s ?? "");
  const tone = resolveHintLineTone(line);
  const toneClass = ` item-hint-card__line--tone-${tone}`;
  if (line.statDelta) {
    const buffClass = line.statDelta.buffColor === "purple" ? " item-hint-card__stat-buff--purple" : "";
    const suffix = line.statDelta.suffix ? esc(line.statDelta.suffix) : "";
    return `<div class="item-hint-card__line item-hint-card__line-stat item-hint-card__line--${line.style || "normal"}${toneClass}">${fmt(line.text)} <span class="item-hint-card__stat-base">${esc(line.statDelta.from)}</span><span class="item-hint-card__stat-arrow">→</span><span class="item-hint-card__stat-buff${buffClass}">${esc(line.statDelta.to)}</span>${suffix}</div>`;
  }
  if (line.html) {
    return `<div class="item-hint-card__line item-hint-card__line--${line.style || "normal"}${toneClass} item-hint-card__line--html">${line.html}</div>`;
  }
  return `<div class="item-hint-card__line item-hint-card__line--${line.style || "normal"}${toneClass}">${fmt(line.text)}</div>`;
}

function renderInfoPopupBodyHtml(entries) {
  const esc = typeof escapeTooltipHtml === "function" ? escapeTooltipHtml : (s) => String(s ?? "");
  const fmt = typeof formatTooltipMechanicText === "function"
    ? formatTooltipMechanicText
    : (text) => esc(text);
  return (entries || []).map((entry) => {
    const desc = entry.descHtml
      ? entry.descHtml
      : fmt(entry.desc || "");
    return `<article class="item-info-entry item-info-entry--${entry.kind || "detail"}">
      <div class="item-info-entry__head">
        <span class="item-info-entry__icon" aria-hidden="true">${esc(entry.icon || "ℹ️")}</span>
        <h5 class="item-info-entry__title">${esc(entry.title || "Подробнее")}</h5>
      </div>
      <div class="item-info-entry__desc">${desc}</div>
    </article>`;
  }).join("");
}

function renderCraftPopupBodyHtml(lines) {
  const fmt = typeof formatTooltipMechanicText === "function"
    ? formatTooltipMechanicText
    : (text) => (typeof escapeTooltipHtml === "function" ? escapeTooltipHtml(text) : String(text ?? ""));
  return (lines || []).filter((line) => line && !line.sep && line.style !== "label").map((line) => {
    if (line.html) {
      return `<div class="item-craft-popup__line item-craft-popup__line--recipe">${line.html}</div>`;
    }
    const tone = line.style === "flavor" ? "flavor" : "text";
    return `<div class="item-craft-popup__line item-craft-popup__line--${tone}">${fmt(line.text)}</div>`;
  }).join("");
}

function renderTooltipTagsRowHtml(footerMeta) {
  if (!footerMeta?.tags?.length) return "";
  const esc = typeof escapeTooltipHtml === "function" ? escapeTooltipHtml : (s) => String(s ?? "");
  const tagsHtml = footerMeta.tags.map((tag) => (
    `<button type="button" class="item-hint-card__tag-icon" data-tag-id="${esc(tag.id || tag.label)}" aria-label="${esc(tag.caption || tag.label)}" aria-expanded="false">
      <span class="item-hint-card__tag-emoji" aria-hidden="true">${esc(tag.icon)}</span>
      <span class="item-hint-card__tag-caption" aria-hidden="true">${esc(tag.caption || tag.label)}</span>
    </button>`
  )).join("");
  return `<div class="item-hint-card__tags-row"><div class="item-hint-card__tag-icons">${tagsHtml}</div></div>`;
}

function renderTooltipMetaBarHtml(footerMeta) {
  if (!footerMeta) return "";
  const esc = typeof escapeTooltipHtml === "function" ? escapeTooltipHtml : (s) => String(s ?? "");
  const metaParts = [footerMeta.rarityLabel];
  if (footerMeta.level != null) metaParts.push(`Уровень ${footerMeta.level}`);
  return `<div class="item-hint-card__meta-bar">
    <div class="item-hint-card__gem" aria-hidden="true"></div>
    <span class="item-hint-card__meta">${esc(metaParts.join(", "))}</span>
  </div>`;
}

function renderTooltipRailHtml({ costBadge, hasInfo, hasCraft, itemId, craftSide, esc }) {
  const parts = [];
  if (costBadge != null && costBadge !== "") {
    parts.push(`<div class="item-hint-card__cost" aria-hidden="true"><span class="item-hint-card__cost-value">${esc(String(costBadge))}</span></div>`);
  }
  if (hasInfo) {
    parts.push(`<button type="button" class="item-hint-card__edge-btn item-hint-card__info-btn" data-item-id="${esc(itemId)}" title="Подробнее о механиках" aria-label="Подробнее о механиках" aria-expanded="false" aria-controls="item-info-popup-inline">ⓘ</button>`);
  }
  if (hasCraft) {
    parts.push(`<button type="button" class="item-hint-card__edge-btn item-hint-card__craft-btn" data-item-id="${esc(itemId)}" data-craft-side="${esc(craftSide)}" title="Рецепты крафта" aria-label="Рецепты крафта" aria-expanded="false" aria-controls="item-craft-popup-inline">📖</button>`);
  }
  if (!parts.length) return "";
  return `<div class="item-hint-card__rail">${parts.join("")}</div>`;
}

function renderTooltipArtHtml(options = {}) {
  const esc = typeof escapeTooltipHtml === "function" ? escapeTooltipHtml : (s) => String(s ?? "");
  const icons = (options.icons || [options.emoji || "📦"]).slice(0, 2).filter(Boolean);
  if (!icons.length) icons.push("📦");
  if (icons.length === 1) {
    return `<div class="item-hint-card__emoji-stage"><span class="item-hint-card__emoji item-hint-card__emoji--primary" aria-hidden="true">${esc(icons[0])}</span></div>`;
  }
  return `<div class="item-hint-card__emoji-stage item-hint-card__emoji-stage--duo"><span class="item-hint-card__emoji item-hint-card__emoji--primary" aria-hidden="true">${esc(icons[0])}</span><span class="item-hint-card__emoji item-hint-card__emoji--orbit" aria-hidden="true">${esc(icons[1])}</span></div>`;
}

function renderTooltipCardHtml(payload, options = {}) {
  const summaryLines = payload?.summaryLines || [];
  const titleText = payload?.titleText || "Предмет";
  const footerMeta = payload?.footerMeta || null;
  const hasInfo = !!payload?.hasInfo;
  const hasCraft = !!payload?.hasCraft;
  const emoji = options.emoji || "📦";
  const rarityColor = options.rarityColor || "#30363d";
  const costBadge = options.costBadge ?? null;
  const itemId = options.itemId || "";
  const craftSide = payload?.craftSide || options.craftSide || "player";
  const esc = typeof escapeTooltipHtml === "function" ? escapeTooltipHtml : (s) => String(s ?? "");
  const fmt = typeof formatTooltipMechanicText === "function"
    ? formatTooltipMechanicText
    : (text) => esc(text);

  const bodyHtml = summaryLines.map((line) => renderTooltipHudLineHtml(line)).join("");

  const railHtml = renderTooltipRailHtml({
    costBadge,
    hasInfo,
    hasCraft,
    itemId,
    craftSide,
    esc,
  });

  const infoOverlayHtml = hasInfo
    ? `<div class="item-info-popup item-info-popup--in-card hidden" id="item-info-popup-inline" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="item-info-popup-inline-title">
        <div class="item-info-popup__panel">
          <header class="item-info-popup__header">
            <h4 class="item-info-popup__title" id="item-info-popup-inline-title"></h4>
            <button type="button" class="item-info-popup__close" aria-label="Закрыть">×</button>
          </header>
          <div class="item-info-popup__body"></div>
        </div>
      </div>`
    : "";

  const craftOverlayHtml = hasCraft
    ? `<div class="item-craft-popup item-craft-popup--in-card hidden" id="item-craft-popup-inline" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="item-craft-popup-inline-title">
        <div class="item-craft-popup__panel">
          <header class="item-craft-popup__header">
            <h4 class="item-craft-popup__title" id="item-craft-popup-inline-title"></h4>
            <button type="button" class="item-craft-popup__close" aria-label="Закрыть">×</button>
          </header>
          <div class="item-craft-popup__body"></div>
        </div>
      </div>`
    : "";

  const hasTags = !!(footerMeta?.tags?.length);
  const hasRail = !!(railHtml);

  return `<div class="item-hint-card${costBadge != null && costBadge !== "" ? " item-hint-card--has-cost" : ""}${hasRail ? " item-hint-card--has-rail" : ""}${hasTags ? " item-hint-card--has-tags" : ""}${hasInfo ? " item-hint-card--has-info" : ""}${hasCraft ? " item-hint-card--has-craft" : ""}${options.locked || payload?.locked ? " item-hint-card--locked" : ""}" style="--hint-rarity:${rarityColor}" data-item-id="${esc(itemId)}">
    ${railHtml}
    ${(hasInfo || hasCraft) ? `<div class="item-hint-card__side-flyout">${infoOverlayHtml}${craftOverlayHtml}</div>` : ""}
    <div class="item-hint-card__frame">
      <div class="item-hint-card__header">
        <div class="item-hint-card__title">${fmt(titleText)}</div>
      </div>
      <div class="item-hint-card__hud">${bodyHtml}</div>
      ${renderTooltipTagsRowHtml(footerMeta)}
      <div class="item-hint-card__art" aria-hidden="true">
        <div class="item-hint-card__art-glow"></div>
        ${renderTooltipArtHtml(options)}
      </div>
      ${renderTooltipMetaBarHtml(footerMeta)}
    </div>
  </div>`;
}

function getItemTooltipCardOptions(def, context = "field") {
  if (!def) return { emoji: "📦", icons: ["📦"], rarityColor: "#30363d" };
  const icons = typeof getItemIcons === "function"
    ? getItemIcons(def)
    : (def.icon ? [def.icon] : ["📦"]);
  const emoji = icons[0] || def.icon || "📦";
  const rarityColor = typeof RARITY_COLORS !== "undefined"
    ? (RARITY_COLORS[def.rarity] || "#30363d")
    : "#30363d";
  let costBadge = null;
  const showCostInContexts = new Set(["shop", "field", "bench", "inventory"]);
  if (showCostInContexts.has(context) && def.cost != null) costBadge = def.cost;
  return { emoji, icons, rarityColor, costBadge, itemId: def.id };
}

function bindCraftRecipeChipHints(root) {
  if (!root) return;
  root.querySelectorAll(".craft-recipe-chip").forEach((chip) => {
    if (chip.dataset.craftTipBound === "1") return;
    chip.dataset.craftTipBound = "1";
    chip.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (e.pointerType === "mouse") return;
      const scope = root.closest(".sidebar-tooltip, .item-hint-card") || root;
      scope.querySelectorAll(".craft-recipe-chip--show-name").forEach((el) => {
        el.classList.remove("craft-recipe-chip--show-name");
      });
      chip.classList.add("craft-recipe-chip--show-name");
    });
  });
}

function hideItemHintTagCaptions(root = document) {
  const scope = root || document;
  const nodes = scope.querySelectorAll(".item-hint-card__tag-icon--show-caption");
  nodes.forEach((btn) => {
    btn.classList.remove("item-hint-card__tag-icon--show-caption");
    btn.setAttribute("aria-expanded", "false");
  });
  return nodes.length > 0;
}

function bindItemHintTagButtons(root) {
  if (!root) return;
  root.querySelectorAll(".item-hint-card__tag-icon").forEach((btn) => {
    if (btn.dataset.tagBound === "1") return;
    btn.dataset.tagBound = "1";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const scope = root.closest(".sidebar-tooltip, .item-hint-card") || root;
      const wasOpen = btn.classList.contains("item-hint-card__tag-icon--show-caption");
      hideItemHintTagCaptions(scope);
      if (!wasOpen) {
        btn.classList.add("item-hint-card__tag-icon--show-caption");
        btn.setAttribute("aria-expanded", "true");
      }
    });
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
  });
}

function hideItemHintSecondaryOverlay(root, selector) {
  const overlay = root?.querySelector(`${selector}:not(.hidden)`);
  if (!overlay) return false;
  overlay.classList.add("hidden");
  overlay.setAttribute("hidden", "");
  overlay.setAttribute("aria-hidden", "true");
  return true;
}

function hideItemHintCraftOverlay(root = document.getElementById("sidebar-tooltip")) {
  const closed = hideItemHintSecondaryOverlay(root, ".item-craft-popup--in-card");
  if (closed) root?.querySelector(".item-hint-card__craft-btn")?.setAttribute("aria-expanded", "false");
  return closed;
}

function hideItemHintInfoOverlay(root = document.getElementById("sidebar-tooltip")) {
  const closed = hideItemHintSecondaryOverlay(root, ".item-info-popup--in-card");
  if (closed) root?.querySelector(".item-hint-card__info-btn")?.setAttribute("aria-expanded", "false");
  return closed;
}

function hideItemHintSecondaryOverlays(root = document.getElementById("sidebar-tooltip")) {
  hideItemHintTagCaptions(root);
  return hideItemHintInfoOverlay(root) || hideItemHintCraftOverlay(root);
}

function bindSecondaryOverlay(root, btnSelector, overlaySelector, onOpen) {
  const btn = root?.querySelector(btnSelector);
  const overlay = root?.querySelector(overlaySelector);
  if (!btn || !overlay || btn.dataset.overlayBound === "1") return;
  btn.dataset.overlayBound = "1";

  const closeBtn = overlay.querySelector("[class$='__close']");
  const hideOverlay = () => {
    if (overlaySelector.includes("info")) hideItemHintInfoOverlay(root);
    else hideItemHintCraftOverlay(root);
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    hideItemHintSecondaryOverlays(root);
    onOpen({ btn, overlay, root });
    overlay.classList.remove("hidden");
    overlay.removeAttribute("hidden");
    overlay.setAttribute("aria-hidden", "false");
    btn.setAttribute("aria-expanded", "true");
  });

  closeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    hideOverlay();
  });

  btn.addEventListener("pointerdown", (e) => e.stopPropagation());
  overlay.addEventListener("pointerdown", (e) => e.stopPropagation());
}

function bindItemHintInfoButton(root, payload) {
  bindSecondaryOverlay(root, ".item-hint-card__info-btn", ".item-info-popup--in-card", ({ overlay }) => {
    const titleEl = overlay.querySelector(".item-info-popup__title");
    const bodyEl = overlay.querySelector(".item-info-popup__body");
    if (titleEl) titleEl.textContent = payload?.titleText || "Подробнее";
    if (bodyEl) {
      bodyEl.innerHTML = renderInfoPopupBodyHtml(payload?.infoEntries || []);
      bindCraftRecipeChipHints(bodyEl);
    }
  });
}

function bindItemHintCraftButton(root) {
  bindSecondaryOverlay(root, ".item-hint-card__craft-btn", ".item-craft-popup--in-card", ({ btn, overlay }) => {
    const itemId = btn.dataset.itemId;
    const side = btn.dataset.craftSide || (typeof prepViewSide !== "undefined" ? prepViewSide : "player");
    const meta = typeof getCraftTooltipMeta === "function" ? getCraftTooltipMeta(itemId, side) : null;
    if (!meta) return;

    const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[itemId] : null;
    const itemName = def
      ? (typeof getItemDisplayName === "function" ? getItemDisplayName(def) : def.name)
      : itemId;
    const titleEl = overlay.querySelector(".item-craft-popup__title");
    const bodyEl = overlay.querySelector(".item-craft-popup__body");
    if (titleEl) titleEl.textContent = itemName;
    if (bodyEl) {
      bodyEl.innerHTML = renderCraftPopupBodyHtml(meta.lines);
      bindCraftRecipeChipHints(bodyEl);
    }
  });
}

function applySidebarTooltipCard(el, payload, cardOptions) {
  if (!el) return;
  el.classList.remove("synergy-tooltip");
  el.classList.add("sidebar-tooltip--card");
  el.style.borderColor = "";
  el.style.border = "";
  el.style.background = "";
  el.style.boxShadow = "";

  const side = payload?.craftSide
    || cardOptions?.craftSide
    || (typeof prepViewSide !== "undefined" ? prepViewSide : "player");
  const itemId = cardOptions?.itemId || "";
  let renderPayload = payload;
  if (itemId && typeof getCraftTooltipMeta === "function") {
    renderPayload = {
      ...payload,
      craftSide: side,
      hasCraft: payload?.hasCraft ?? !!getCraftTooltipMeta(itemId, side),
    };
  }

  const renderOptions = {
    ...(cardOptions || {}),
    itemId,
    craftSide: side,
  };

  el.innerHTML = renderTooltipCardHtml(renderPayload, renderOptions);
  bindCraftRecipeChipHints(el);
  bindItemHintTagButtons(el);
  if (renderPayload?.hasInfo) bindItemHintInfoButton(el, renderPayload);
  if (renderPayload?.hasCraft) bindItemHintCraftButton(el);
}

function applySidebarTooltipPlain(el, lines) {
  if (!el) return;
  el.classList.remove("sidebar-tooltip--card");
  if (typeof renderTooltipLinesHtml === "function") {
    el.innerHTML = renderTooltipLinesHtml(lines);
  }
}

window.hideItemHintCraftOverlay = hideItemHintCraftOverlay;
window.hideItemHintInfoOverlay = hideItemHintInfoOverlay;
window.hideItemHintTagCaptions = hideItemHintTagCaptions;
window.hideItemHintSecondaryOverlays = hideItemHintSecondaryOverlays;
window.renderCraftPopupBodyHtml = renderCraftPopupBodyHtml;
window.renderInfoPopupBodyHtml = renderInfoPopupBodyHtml;
