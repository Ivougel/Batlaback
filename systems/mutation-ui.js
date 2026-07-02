/**
 * UI мутаций: галерея на старте, бейдж R8/R16, highlight при открытии.
 * @see docs/mutations-gdd.md
 */

const MUTATION_UI_EMOJI = {
  w_guardian: "🛡️", w_berserk: "🔥", w_crusader: "✝️", w_duelist: "⚔️",
  w_juggernaut: "🏔️", w_gladiator: "🏟️", w_breaker: "💥", w_veteran: "🎖️",
  r_assassin: "🗡️", r_bard: "🎵", r_plague: "☣️", r_trickster: "🃏",
  r_shadow: "🌑", r_nightblade: "🌙", r_scout: "🏹", r_rogue: "🐣",
  m_pyro: "🔥", m_cryo: "❄️", m_arcanist: "💎", m_elementalist: "🌪️",
  m_battlemage: "⚔️", m_chaos: "🌀", m_sage: "📚", m_seer: "👁️",
  p_paladin: "⚔️", p_discipline: "⚖️", p_zrecrela: "🎵", p_oracle: "🔮",
  p_plague: "☠️", p_hierophant: "👑", p_inquisitor: "🔥", p_hermit: "🕯️",
};

const MUTATION_REVEAL_MS = 3000;
const MUTATION_LORE_POPUP_ID = "mutation-lore-popup";
const MUTATION_INTENT_POPUP_ID = "mutation-intent-popup";
let mutationRevealTimer = null;
let mutationLorePopupCell = null;
let mutationLorePopupPinned = false;
let mutationLoreOutsideCloser = null;
let mutationIntentPopupCell = null;

function isCoarseMutationPointer() {
  return window.matchMedia("(pointer: coarse)").matches
    || (window.matchMedia("(hover: none)").matches && "ontouchstart" in window);
}

function getMutationUiEmoji(mutationId) {
  return MUTATION_UI_EMOJI[mutationId] || "❓";
}

function getMutationUnlockHint(mutDef) {
  if (!mutDef) return "";
  if (mutDef.diversity) {
    return "4+ семейств тегов · спутник Странник";
  }
  const tags = Object.entries(mutDef.tagWeights || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);
  const bias = (mutDef.companionBias || []).length
    ? ` · спутник: ${mutDef.companionBias.join(", ")}`
    : "";
  return `Теги: ${tags.join(", ")}${bias} · форма R8, мутация R16`;
}

function buildClassMutationGalleryHtml(classId) {
  if (!classId || typeof getMutationsForNoviceClass !== "function") return "";
  const mutations = getMutationsForNoviceClass(classId);
  if (!mutations.length) return "";

  const cells = mutations.map((mut) => {
    const hint = getMutationUnlockHint(mut);
    const emoji = getMutationUiEmoji(mut.id);
    const formLabel = escapeMutationUiHtml(mut.formName);
    return `
      <button type="button" class="mutation-silhouette" data-mutation-id="${escapeMutationUiHtml(mut.id)}" title="${escapeMutationUiHtml(hint)}" aria-label="${escapeMutationUiHtml(mut.name)} · ${formLabel}">
        <span class="mutation-silhouette-icon" aria-hidden="true">${emoji}</span>
        <span class="mutation-silhouette-name">${escapeMutationUiHtml(mut.name)}</span>
        <span class="mutation-silhouette-form" data-default="${formLabel}">${formLabel}</span>
      </button>
    `;
  }).join("");

  const novice = typeof getNoviceClassLabel === "function"
    ? getNoviceClassLabel(classId)
    : classId;

  return `
    <div class="mutation-gallery" role="group" aria-label="Мутации класса">
      <p class="mutation-gallery-eyebrow">${escapeMutationUiHtml(novice)} · 8 путей R16</p>
      <p class="mutation-gallery-hint">Силуэты откроются в забеге · наведите для подсказки · нажмите путь — подтвердите намерение</p>
      <div class="mutation-gallery-grid">${cells}</div>
    </div>
  `;
}

function escapeMutationUiHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMutationIntentLabel(classId, mutationId) {
  const raw = typeof getMutationDisplayTitle === "function"
    ? getMutationDisplayTitle(classId, null, mutationId)
    : "";
  if (!raw) return "—";
  return raw.split("-").map((part) => {
    const text = part.trim();
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
  }).filter(Boolean).join("-");
}

function ensureMutationIntentPopup() {
  let popup = document.getElementById(MUTATION_INTENT_POPUP_ID);
  if (popup) return popup;

  popup = document.createElement("div");
  popup.id = MUTATION_INTENT_POPUP_ID;
  popup.className = "mutation-intent-popup hidden";
  popup.setAttribute("aria-hidden", "true");
  popup.innerHTML = `
    <button type="button" class="mutation-intent-popup-backdrop" aria-label="Закрыть"></button>
    <div class="mutation-intent-popup-panel" role="dialog" aria-modal="true" aria-labelledby="mutation-intent-popup-title">
      <div class="mutation-intent-popup-glow" aria-hidden="true"></div>
      <span class="mutation-intent-popup-emoji" aria-hidden="true"></span>
      <p class="mutation-intent-popup-lead">Вы будете</p>
      <p class="mutation-intent-popup-title" id="mutation-intent-popup-title"></p>
      <p class="mutation-intent-popup-form"></p>
      <p class="mutation-intent-popup-quip"></p>
      <div class="mutation-intent-popup-actions">
        <button type="button" class="btn-secondary mutation-intent-popup-no">Нет</button>
        <button type="button" class="btn-primary mutation-intent-popup-yes">Да</button>
      </div>
    </div>
  `;
  document.body.appendChild(popup);

  popup.querySelector(".mutation-intent-popup-backdrop")?.addEventListener("click", () => hideMutationIntentPopup());
  popup.querySelector(".mutation-intent-popup-no")?.addEventListener("click", () => hideMutationIntentPopup());
  popup.querySelector(".mutation-intent-popup-yes")?.addEventListener("click", () => hideMutationIntentPopup({ confirm: true }));
  popup.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideMutationIntentPopup();
    if (event.key === "Enter") hideMutationIntentPopup({ confirm: true });
  });

  return popup;
}

function applyMutationIntentSelection(cell, mutationId) {
  document.querySelectorAll(".mutation-silhouette--intent-selected").forEach((el) => {
    el.classList.remove("mutation-silhouette--intent-selected");
  });
  if (cell) {
    cell.classList.add("mutation-silhouette--intent-selected");
    highlightMutationLoreCell(cell, true);
  }
  mutationIntentPopupCell = cell || null;
  if (typeof onMutationIntentSelected === "function") {
    onMutationIntentSelected(mutationId || null);
  }
}

function showMutationIntentPopup(cell, mutationId, classId) {
  if (!cell || !mutationId || !classId) return;
  const meta = getMutationLorePopupMeta(mutationId);
  if (!meta) return;

  hideMutationLorePopup();
  const popup = ensureMutationIntentPopup();
  const title = formatMutationIntentLabel(classId, mutationId);

  popup.querySelector(".mutation-intent-popup-emoji").textContent = meta.emoji;
  popup.querySelector(".mutation-intent-popup-title").textContent = title;
  popup.querySelector(".mutation-intent-popup-form").textContent = meta.formName;
  popup.querySelector(".mutation-intent-popup-quip").textContent = meta.quip;

  popup.classList.remove("hidden", "mutation-intent-popup--enter");
  popup.setAttribute("aria-hidden", "false");
  void popup.offsetWidth;
  popup.classList.add("mutation-intent-popup--enter");

  mutationIntentPopupCell = cell;
  popup.dataset.mutationId = mutationId;
  popup.dataset.classId = classId;

  popup.querySelector(".mutation-intent-popup-yes")?.focus?.();
}

function hideMutationIntentPopup({ confirm = false } = {}) {
  const popup = document.getElementById(MUTATION_INTENT_POPUP_ID);
  if (!popup || popup.classList.contains("hidden")) return;

  const mutationId = popup.dataset.mutationId;
  const classId = popup.dataset.classId;
  if (confirm && mutationIntentPopupCell && mutationId) {
    applyMutationIntentSelection(mutationIntentPopupCell, mutationId);
    if (typeof onMutationIntentConfirmed === "function") {
      onMutationIntentConfirmed(mutationId, classId || null);
    }
  }

  popup.classList.add("hidden");
  popup.classList.remove("mutation-intent-popup--enter");
  popup.setAttribute("aria-hidden", "true");
  delete popup.dataset.mutationId;
  delete popup.dataset.classId;
  mutationIntentPopupCell = null;
}

function ensureMutationLorePopup() {
  let popup = document.getElementById(MUTATION_LORE_POPUP_ID);
  if (popup) return popup;

  popup = document.createElement("div");
  popup.id = MUTATION_LORE_POPUP_ID;
  popup.className = "mutation-lore-popup hidden";
  popup.setAttribute("role", "tooltip");
  popup.setAttribute("aria-hidden", "true");
  popup.innerHTML = `
    <div class="mutation-lore-popup-glow" aria-hidden="true"></div>
    <span class="mutation-lore-popup-emoji" aria-hidden="true"></span>
    <p class="mutation-lore-popup-name"></p>
    <p class="mutation-lore-popup-form"></p>
    <p class="mutation-lore-popup-quip"></p>
  `;
  document.body.appendChild(popup);

  popup.addEventListener("pointerenter", () => {
    if (!isCoarseMutationPointer()) mutationLorePopupPinned = false;
  });
  popup.addEventListener("pointerleave", () => {
    if (!isCoarseMutationPointer() && !mutationLorePopupPinned) hideMutationLorePopup();
  });

  return popup;
}

function getMutationLorePopupMeta(mutationId) {
  const def = typeof getMutationById === "function" ? getMutationById(mutationId) : null;
  if (!def) return null;
  return {
    emoji: getMutationUiEmoji(mutationId),
    name: def.name,
    formName: def.formName,
    quip: typeof getMutationLoreQuip === "function" ? getMutationLoreQuip(mutationId) : "",
  };
}

function positionMutationLorePopup(cell, popup) {
  popup.classList.remove("mutation-lore-popup--below");
  popup.style.visibility = "hidden";
  popup.classList.remove("hidden");
  popup.setAttribute("aria-hidden", "false");

  const rect = cell.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();
  const margin = 10;
  const viewportPad = 8;

  let top = rect.top - popupRect.height - margin;
  if (top < viewportPad) {
    top = rect.bottom + margin;
    popup.classList.add("mutation-lore-popup--below");
  }

  let left = rect.left + rect.width / 2 - popupRect.width / 2;
  left = Math.max(viewportPad, Math.min(left, window.innerWidth - popupRect.width - viewportPad));
  top = Math.max(viewportPad, Math.min(top, window.innerHeight - popupRect.height - viewportPad));

  popup.style.top = `${Math.round(top)}px`;
  popup.style.left = `${Math.round(left)}px`;
  popup.style.visibility = "";
}

function highlightMutationLoreCell(cell, active) {
  document.querySelectorAll(".mutation-silhouette--lore-active").forEach((el) => {
    el.classList.remove("mutation-silhouette--lore-active");
  });
  document.querySelectorAll(".prep-build-emoji-btn--lore-active").forEach((el) => {
    el.classList.remove("prep-build-emoji-btn--lore-active");
  });
  if (!cell || !active) return;
  if (cell.classList.contains("prep-build-emoji-btn")) {
    cell.classList.add("prep-build-emoji-btn--lore-active");
    return;
  }
  const grid = cell.closest(".mutation-gallery-grid");
  grid?.querySelectorAll(".mutation-silhouette").forEach((btn) => {
    btn.classList.toggle("mutation-silhouette--lore-active", btn === cell);
  });
}

function detachMutationLoreOutsideCloser() {
  if (!mutationLoreOutsideCloser) return;
  document.removeEventListener("pointerdown", mutationLoreOutsideCloser, true);
  mutationLoreOutsideCloser = null;
}

function attachMutationLoreOutsideCloser() {
  if (mutationLoreOutsideCloser) return;
  mutationLoreOutsideCloser = (event) => {
    const popup = document.getElementById(MUTATION_LORE_POPUP_ID);
    if (!popup || popup.classList.contains("hidden")) return;
    if (event.target.closest(`#${MUTATION_LORE_POPUP_ID}`)) return;
    if (event.target.closest(".mutation-silhouette[data-mutation-id]")) return;
    if (event.target.closest(".prep-build-emoji-btn[data-mutation-id]")) return;
    hideMutationLorePopup();
  };
  document.addEventListener("pointerdown", mutationLoreOutsideCloser, true);
}

function showMutationLorePopup(cell, mutationId, opts = {}) {
  if (!cell || !mutationId) return;
  const meta = getMutationLorePopupMeta(mutationId);
  if (!meta) return;

  const popup = ensureMutationLorePopup();
  mutationLorePopupCell = cell;
  mutationLorePopupPinned = !!opts.pin;

  popup.querySelector(".mutation-lore-popup-emoji").textContent = meta.emoji;
  popup.querySelector(".mutation-lore-popup-name").textContent = meta.name;
  popup.querySelector(".mutation-lore-popup-form").textContent = meta.formName;
  popup.querySelector(".mutation-lore-popup-quip").textContent = meta.quip;

  highlightMutationLoreCell(cell, true);
  positionMutationLorePopup(cell, popup);
  popup.classList.remove("mutation-lore-popup--enter");
  void popup.offsetWidth;
  popup.classList.add("mutation-lore-popup--enter");

  if (mutationLorePopupPinned) attachMutationLoreOutsideCloser();
  else detachMutationLoreOutsideCloser();
}

function hideMutationLorePopup() {
  const popup = document.getElementById(MUTATION_LORE_POPUP_ID);
  if (!popup || popup.classList.contains("hidden")) return;

  popup.classList.add("hidden");
  popup.classList.remove("mutation-lore-popup--enter", "mutation-lore-popup--below");
  popup.setAttribute("aria-hidden", "true");
  highlightMutationLoreCell(mutationLorePopupCell, false);
  mutationLorePopupCell = null;
  mutationLorePopupPinned = false;
  detachMutationLoreOutsideCloser();
}

function clearMutationLoreQuipFx() {
  hideMutationLorePopup();
  hideMutationIntentPopup();
  document.querySelectorAll(".mutation-silhouette--intent-selected").forEach((el) => {
    el.classList.remove("mutation-silhouette--intent-selected");
  });
  mutationIntentPopupCell = null;
}

function bindClassMutationGalleryInteractions() {
  const wrap = document.getElementById("class-mutation-gallery");
  if (!wrap || wrap.dataset.loreBound === "1") return;
  wrap.dataset.loreBound = "1";

  wrap.addEventListener("pointerover", (event) => {
    if (isCoarseMutationPointer()) return;
    const cell = event.target.closest(".mutation-silhouette[data-mutation-id]");
    if (!cell || !wrap.contains(cell)) return;
    showMutationLorePopup(cell, cell.dataset.mutationId);
  });

  wrap.addEventListener("pointerout", (event) => {
    if (isCoarseMutationPointer() || mutationLorePopupPinned) return;
    const cell = event.target.closest(".mutation-silhouette[data-mutation-id]");
    if (!cell) return;
    const to = event.relatedTarget;
    if (to?.closest?.(`#${MUTATION_LORE_POPUP_ID}`)) return;
    if (to?.closest?.(".mutation-silhouette[data-mutation-id]")) return;
    hideMutationLorePopup();
  });

  wrap.addEventListener("click", (event) => {
    const cell = event.target.closest(".mutation-silhouette[data-mutation-id]");
    if (!cell) return;
    event.preventDefault();
    event.stopPropagation();

    const classId = wrap.dataset.classId;
    if (!classId) return;
    showMutationIntentPopup(cell, cell.dataset.mutationId, classId);
  });

  wrap.addEventListener("focusin", (event) => {
    const cell = event.target.closest(".mutation-silhouette[data-mutation-id]");
    if (!cell) return;
    showMutationLorePopup(cell, cell.dataset.mutationId, { pin: true });
  });

  wrap.addEventListener("focusout", (event) => {
    const cell = event.target.closest(".mutation-silhouette[data-mutation-id]");
    if (!cell) return;
    const to = event.relatedTarget;
    if (to?.closest?.(`#${MUTATION_LORE_POPUP_ID}`)) return;
    if (to?.closest?.(".mutation-silhouette[data-mutation-id]")) return;
    hideMutationLorePopup();
  });
}

function renderClassMutationGallery(classId) {
  const wrap = document.getElementById("class-mutation-gallery");
  if (!wrap) return;
  clearMutationLoreQuipFx();
  const html = classId && typeof buildClassMutationGalleryHtml === "function"
    ? buildClassMutationGalleryHtml(classId)
    : "";
  wrap.innerHTML = html;
  wrap.classList.toggle("hidden", !html);
  if (classId) wrap.dataset.classId = classId;
  else delete wrap.dataset.classId;
  delete wrap.dataset.intentMutationId;
  if (html) bindClassMutationGalleryInteractions();
}

function getPrepMutationBadgeMeta(formId, mutationId, round = 1) {
  const r = round || 1;
  if (mutationId) {
    const def = typeof getMutationById === "function" ? getMutationById(mutationId) : null;
    return {
      kind: "mutation",
      label: def?.name || mutationId,
      sub: `R${typeof MUTATION_ROUND_FINAL !== "undefined" ? MUTATION_ROUND_FINAL : 16}`,
      emoji: getMutationUiEmoji(mutationId),
    };
  }
  if (formId && r >= (typeof MUTATION_ROUND_FORM !== "undefined" ? MUTATION_ROUND_FORM : 8)) {
    const def = typeof getMutationById === "function" ? getMutationById(formId) : null;
    return {
      kind: "form",
      label: def?.formName || formId,
      sub: `форма R${typeof MUTATION_ROUND_FORM !== "undefined" ? MUTATION_ROUND_FORM : 8}`,
      emoji: getMutationUiEmoji(formId),
    };
  }
  return null;
}

function renderPrepMutationBadgeHtml(formId, mutationId, round = 1) {
  const meta = getPrepMutationBadgeMeta(formId, mutationId, round);
  if (!meta) return "";
  return `
    <span class="prep-mutation-badge prep-mutation-badge--${meta.kind}" title="${escapeMutationUiHtml(meta.label)}">
      <span class="prep-mutation-badge-emoji" aria-hidden="true">${meta.emoji}</span>
      <span class="prep-mutation-badge-text">${escapeMutationUiHtml(meta.label)}</span>
      <span class="prep-mutation-badge-sub">${escapeMutationUiHtml(meta.sub)}</span>
    </span>
  `;
}

function getLobbyFighterMutationEmoji(fighter, round = 1) {
  if (fighter?.mutationId) return getMutationUiEmoji(fighter.mutationId);
  const formRound = typeof MUTATION_ROUND_FORM !== "undefined" ? MUTATION_ROUND_FORM : 8;
  if (fighter?.mutationFormId && round >= formRound) {
    return getMutationUiEmoji(fighter.mutationFormId);
  }
  return null;
}

function renderLobbyMutationBadgeHtml(fighter, round = 1) {
  const meta = getPrepMutationBadgeMeta(fighter?.mutationFormId, fighter?.mutationId, round);
  if (!meta) return "";
  return `
    <span class="lobby-mutation-badge lobby-mutation-badge--${meta.kind}" title="${escapeMutationUiHtml(meta.label)}">
      <span class="lobby-mutation-badge-emoji" aria-hidden="true">${meta.emoji}</span>
    </span>
  `;
}

function resolvePrepBuildPathId(formId, mutationId, leaderId, round = 1) {
  if (mutationId) return mutationId;
  const formRound = typeof MUTATION_ROUND_FORM !== "undefined" ? MUTATION_ROUND_FORM : 8;
  if (formId && round >= formRound) return formId;
  return leaderId || null;
}

function resolvePrepBuildEmojiDisplay(opts = {}) {
  const {
    formId = null,
    mutationId = null,
    classId = null,
    leaderId = null,
    round = 1,
    emojiOverride = null,
  } = opts;

  const pathId = resolvePrepBuildPathId(formId, mutationId, leaderId, round);
  const customEmoji = emojiOverride
    ?? (typeof window !== "undefined" ? window.__prepBuildEmojiOverride : null);

  if (pathId) {
    const def = typeof getMutationById === "function" ? getMutationById(pathId) : null;
    const badge = getPrepMutationBadgeMeta(formId, mutationId, round);
    return {
      pathId,
      emoji: customEmoji || getMutationUiEmoji(pathId),
      label: badge?.label || def?.name || pathId,
      sub: badge?.sub || "",
      loreEnabled: true,
    };
  }

  const cls = typeof getClassById === "function" ? getClassById(classId) : null;
  return {
    pathId: null,
    emoji: customEmoji || cls?.icon || "🧙",
    label: cls?.name || "Герой",
    sub: "",
    loreEnabled: false,
  };
}

let prepBuildEmojiBtnBound = false;

function syncPrepBuildEmojiBtn(opts = {}) {
  const btn = document.getElementById("prep-build-emoji-btn");
  if (!btn) return;

  const display = resolvePrepBuildEmojiDisplay(opts);
  const glyph = btn.querySelector(".prep-build-emoji-btn-glyph");
  if (glyph) glyph.textContent = display.emoji;

  btn.dataset.mutationId = display.pathId || "";
  btn.dataset.emoji = display.emoji;
  btn.title = display.label;
  btn.setAttribute("aria-label", display.loreEnabled
    ? `${display.label} · наведите для «правды»`
    : display.label);

  btn.classList.toggle("prep-build-emoji-btn--has-path", !!display.pathId);
  btn.classList.toggle("prep-build-emoji-btn--lore", display.loreEnabled);
  btn.classList.remove("hidden");
}

/** Будущая кастомизация: window.setPrepBuildEmojiOverride("🌸") */
function setPrepBuildEmojiOverride(emoji) {
  if (typeof window !== "undefined") {
    window.__prepBuildEmojiOverride = emoji || null;
  }
}

function bindPrepBuildEmojiBtnInteractions() {
  if (prepBuildEmojiBtnBound) return;
  const btn = document.getElementById("prep-build-emoji-btn");
  if (!btn) return;
  prepBuildEmojiBtnBound = true;

  btn.addEventListener("pointerover", () => {
    if (isCoarseMutationPointer()) return;
    const pathId = btn.dataset.mutationId;
    if (!pathId) return;
    showMutationLorePopup(btn, pathId);
  });

  btn.addEventListener("pointerout", (event) => {
    if (isCoarseMutationPointer() || mutationLorePopupPinned) return;
    const to = event.relatedTarget;
    if (to?.closest?.(`#${MUTATION_LORE_POPUP_ID}`)) return;
    if (to?.closest?.(".prep-build-emoji-btn")) return;
    hideMutationLorePopup();
  });

  btn.addEventListener("click", (event) => {
    const pathId = btn.dataset.mutationId;
    if (!pathId) return;
    event.preventDefault();
    event.stopPropagation();

    if (isCoarseMutationPointer()) {
      if (mutationLorePopupCell === btn && mutationLorePopupPinned) {
        hideMutationLorePopup();
      } else {
        showMutationLorePopup(btn, pathId, { pin: true });
      }
      return;
    }
    showMutationLorePopup(btn, pathId, { pin: true });
  });

  btn.addEventListener("focusin", () => {
    const pathId = btn.dataset.mutationId;
    if (pathId) showMutationLorePopup(btn, pathId);
  });

  btn.addEventListener("focusout", (event) => {
    if (mutationLorePopupPinned) return;
    const to = event.relatedTarget;
    if (to?.closest?.(`#${MUTATION_LORE_POPUP_ID}`)) return;
    hideMutationLorePopup();
  });
}

function initPrepBuildEmojiBtn() {
  bindPrepBuildEmojiBtnInteractions();
}

function renderPrepCharacterHtml(side, profile, runRound = 1) {
  if (typeof renderHeroPortraitFrameHTML === "function" && profile?.classId) {
    return renderHeroPortraitFrameHTML(profile.classId, {
      alt: profile?.className || "",
    });
  }
  if (profile?.classIconSrc) {
    return `<img class="prep-character-img" src="${escapeMutationUiHtml(profile.classIconSrc)}" alt="" draggable="false">`;
  }
  return `<span class="prep-character-emoji">${profile?.classIcon || "❓"}</span>`;
}

function clearMutationRevealFx() {
  if (mutationRevealTimer) {
    clearTimeout(mutationRevealTimer);
    mutationRevealTimer = null;
  }
  document.getElementById("prep-character-player")?.classList.remove("prep-character--mutation-reveal");
  document.getElementById("prep-character-enemy")?.classList.remove("prep-character--mutation-reveal");
  document.getElementById("app")?.removeAttribute("data-mutation-reveal");
}

function triggerMutationMilestoneCelebration(side, milestone = "mutation") {
  const elId = side === "enemy" ? "prep-character-enemy" : "prep-character-player";
  const el = document.getElementById(elId);
  const app = document.getElementById("app");
  if (!el && !app) return;

  clearMutationRevealFx();
  el?.classList.add("prep-character--mutation-reveal");
  if (app) {
    app.dataset.mutationReveal = side;
    app.dataset.mutationMilestone = milestone;
  }

  mutationRevealTimer = setTimeout(() => {
    el?.classList.remove("prep-character--mutation-reveal");
    app?.removeAttribute("data-mutation-reveal");
    app?.removeAttribute("data-mutation-milestone");
    mutationRevealTimer = null;
  }, MUTATION_REVEAL_MS);
}
