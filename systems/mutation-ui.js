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

/** [core, mid, ring, halo] — уникальное свечение каждого архетипа */
const ARCHETYPE_MAGIC_GLOW = {
  w_guardian: ["rgba(150, 210, 255, 0.72)", "rgba(80, 150, 230, 0.34)", "rgba(120, 190, 255, 0.55)", "rgba(60, 110, 210, 0.22)"],
  w_berserk: ["rgba(255, 120, 70, 0.78)", "rgba(220, 50, 30, 0.36)", "rgba(255, 90, 50, 0.58)", "rgba(180, 40, 20, 0.24)"],
  w_crusader: ["rgba(255, 230, 140, 0.82)", "rgba(230, 180, 60, 0.38)", "rgba(255, 210, 90, 0.6)", "rgba(200, 150, 40, 0.26)"],
  w_duelist: ["rgba(180, 220, 255, 0.74)", "rgba(100, 160, 220, 0.32)", "rgba(140, 200, 255, 0.52)", "rgba(70, 120, 200, 0.22)"],
  w_juggernaut: ["rgba(190, 200, 215, 0.76)", "rgba(120, 130, 150, 0.34)", "rgba(160, 175, 195, 0.54)", "rgba(90, 100, 120, 0.24)"],
  w_gladiator: ["rgba(255, 190, 110, 0.78)", "rgba(210, 120, 50, 0.36)", "rgba(255, 170, 80, 0.56)", "rgba(180, 100, 40, 0.24)"],
  w_breaker: ["rgba(255, 160, 90, 0.8)", "rgba(230, 90, 40, 0.38)", "rgba(255, 130, 60, 0.58)", "rgba(200, 70, 30, 0.26)"],
  w_veteran: ["rgba(220, 185, 120, 0.76)", "rgba(160, 120, 70, 0.34)", "rgba(210, 170, 100, 0.54)", "rgba(130, 95, 55, 0.24)"],
  r_assassin: ["rgba(180, 90, 220, 0.76)", "rgba(110, 40, 160, 0.36)", "rgba(160, 70, 210, 0.54)", "rgba(80, 30, 130, 0.24)"],
  r_bard: ["rgba(255, 150, 210, 0.78)", "rgba(200, 80, 170, 0.36)", "rgba(255, 120, 200, 0.56)", "rgba(170, 60, 140, 0.24)"],
  r_plague: ["rgba(130, 230, 110, 0.76)", "rgba(60, 160, 50, 0.36)", "rgba(100, 210, 85, 0.54)", "rgba(40, 120, 35, 0.24)"],
  r_trickster: ["rgba(255, 210, 90, 0.78)", "rgba(190, 120, 220, 0.34)", "rgba(255, 190, 70, 0.56)", "rgba(160, 90, 200, 0.24)"],
  r_shadow: ["rgba(120, 90, 180, 0.74)", "rgba(50, 30, 90, 0.38)", "rgba(90, 60, 150, 0.52)", "rgba(30, 20, 70, 0.28)"],
  r_nightblade: ["rgba(150, 130, 255, 0.76)", "rgba(70, 50, 170, 0.36)", "rgba(120, 100, 240, 0.54)", "rgba(50, 35, 130, 0.26)"],
  r_scout: ["rgba(140, 220, 130, 0.76)", "rgba(70, 150, 70, 0.34)", "rgba(110, 200, 100, 0.54)", "rgba(45, 110, 45, 0.24)"],
  r_rogue: ["rgba(200, 190, 170, 0.72)", "rgba(130, 110, 90, 0.32)", "rgba(180, 165, 140, 0.5)", "rgba(100, 85, 70, 0.22)"],
  m_pyro: ["rgba(255, 140, 60, 0.82)", "rgba(230, 60, 20, 0.4)", "rgba(255, 110, 40, 0.62)", "rgba(200, 45, 15, 0.28)"],
  m_cryo: ["rgba(140, 230, 255, 0.8)", "rgba(60, 170, 230, 0.38)", "rgba(100, 210, 255, 0.58)", "rgba(40, 130, 200, 0.26)"],
  m_arcanist: ["rgba(190, 140, 255, 0.8)", "rgba(120, 60, 220, 0.38)", "rgba(170, 110, 255, 0.58)", "rgba(90, 40, 190, 0.26)"],
  m_elementalist: ["rgba(255, 170, 120, 0.76)", "rgba(90, 190, 255, 0.34)", "rgba(220, 140, 200, 0.54)", "rgba(70, 150, 230, 0.24)"],
  m_battlemage: ["rgba(200, 130, 255, 0.78)", "rgba(120, 70, 210, 0.36)", "rgba(180, 100, 255, 0.56)", "rgba(90, 50, 180, 0.26)"],
  m_chaos: ["rgba(255, 120, 220, 0.78)", "rgba(120, 80, 255, 0.36)", "rgba(255, 90, 200, 0.56)", "rgba(100, 60, 230, 0.26)"],
  m_sage: ["rgba(170, 210, 255, 0.76)", "rgba(90, 140, 210, 0.34)", "rgba(140, 190, 255, 0.54)", "rgba(70, 110, 190, 0.24)"],
  m_seer: ["rgba(170, 120, 255, 0.78)", "rgba(90, 50, 180, 0.38)", "rgba(140, 90, 240, 0.56)", "rgba(60, 30, 150, 0.26)"],
  p_paladin: ["rgba(255, 225, 130, 0.84)", "rgba(240, 180, 50, 0.4)", "rgba(255, 210, 80, 0.62)", "rgba(210, 150, 30, 0.28)"],
  p_discipline: ["rgba(210, 230, 255, 0.8)", "rgba(120, 160, 230, 0.36)", "rgba(180, 205, 255, 0.56)", "rgba(90, 130, 210, 0.26)"],
  p_zrecrela: ["rgba(255, 180, 220, 0.78)", "rgba(230, 120, 180, 0.36)", "rgba(255, 150, 210, 0.56)", "rgba(200, 90, 160, 0.26)"],
  p_oracle: ["rgba(170, 210, 255, 0.82)", "rgba(100, 140, 255, 0.4)", "rgba(140, 180, 255, 0.62)", "rgba(80, 110, 230, 0.28)"],
  p_plague: ["rgba(160, 240, 130, 0.76)", "rgba(80, 170, 70, 0.36)", "rgba(130, 220, 100, 0.54)", "rgba(50, 130, 45, 0.26)"],
  p_hierophant: ["rgba(255, 245, 180, 0.86)", "rgba(255, 210, 90, 0.42)", "rgba(255, 230, 130, 0.64)", "rgba(230, 180, 60, 0.3)"],
  p_inquisitor: ["rgba(255, 150, 90, 0.82)", "rgba(230, 70, 40, 0.4)", "rgba(255, 120, 60, 0.6)", "rgba(200, 50, 25, 0.28)"],
  p_hermit: ["rgba(255, 210, 140, 0.78)", "rgba(200, 130, 60, 0.36)", "rgba(255, 190, 110, 0.56)", "rgba(170, 100, 45, 0.26)"],
};

const CLASS_MAGIC_GLOW = {
  warrior: ["rgba(220, 170, 100, 0.72)", "rgba(170, 110, 50, 0.34)", "rgba(210, 150, 80, 0.52)", "rgba(140, 85, 40, 0.24)"],
  rogue: ["rgba(170, 120, 220, 0.74)", "rgba(100, 60, 160, 0.34)", "rgba(150, 90, 210, 0.52)", "rgba(70, 40, 130, 0.24)"],
  mage: ["rgba(160, 130, 255, 0.78)", "rgba(90, 60, 210, 0.36)", "rgba(140, 100, 255, 0.56)", "rgba(60, 35, 180, 0.26)"],
  priest: ["rgba(255, 230, 150, 0.8)", "rgba(220, 180, 70, 0.38)", "rgba(255, 215, 100, 0.58)", "rgba(190, 150, 50, 0.26)"],
};

const DEFAULT_MAGIC_GLOW = ["rgba(167, 139, 250, 0.72)", "rgba(120, 80, 220, 0.34)", "rgba(167, 139, 250, 0.52)", "rgba(90, 60, 190, 0.24)"];

function clearArchetypeMagicGlow(el) {
  if (!el) return;
  el.classList.remove("archetype-magic-glow--active");
  el.style.removeProperty("--archetype-glow-core");
  el.style.removeProperty("--archetype-glow-mid");
  el.style.removeProperty("--archetype-glow-ring");
  el.style.removeProperty("--archetype-glow-halo");
}

function applyArchetypeMagicGlow(el, pathId, classId = null) {
  if (!el) return;
  const palette = (pathId && ARCHETYPE_MAGIC_GLOW[pathId])
    || (classId && CLASS_MAGIC_GLOW[classId])
    || DEFAULT_MAGIC_GLOW;
  el.style.setProperty("--archetype-glow-core", palette[0]);
  el.style.setProperty("--archetype-glow-mid", palette[1]);
  el.style.setProperty("--archetype-glow-ring", palette[2]);
  el.style.setProperty("--archetype-glow-halo", palette[3]);
  el.classList.add("archetype-magic-glow--active");
  if (pathId) el.dataset.archetypePath = pathId;
}

function getMutationUnlockHint(mutDef) {
  if (!mutDef) return "";
  if (typeof getMutationGrowthHint === "function") {
    return getMutationGrowthHint(mutDef);
  }
  return "";
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
      <p class="mutation-gallery-eyebrow">${escapeMutationUiHtml(novice)} · 8 путей развития</p>
      <p class="mutation-gallery-hint">Нажмите путь — посмотрите бонусы и подтвердите намерение</p>
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
      <div class="mutation-intent-popup-perks"></div>
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
  const intentPerks = popup.querySelector(".mutation-intent-popup-perks");
  if (intentPerks) {
    const perksHtml = renderMutationLorePerksHtml(meta);
    intentPerks.innerHTML = perksHtml;
    intentPerks.hidden = !perksHtml;
  }

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
    <div class="mutation-lore-popup-perks"></div>
    <div class="mutation-lore-popup-actions">
      <button type="button" class="btn-secondary mutation-lore-popup-guide-btn">🛤️ Пути и сборки</button>
    </div>
  `;
  document.body.appendChild(popup);

  popup.querySelector(".mutation-lore-popup-guide-btn")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const mutationId = popup.dataset.mutationId;
    if (typeof showClassBuildGuideFromMutation === "function") {
      showClassBuildGuideFromMutation(mutationId);
    }
  });

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
  const perks = typeof getMutationPerkMeta === "function" ? getMutationPerkMeta(mutationId) : null;
  return {
    emoji: getMutationUiEmoji(mutationId),
    name: def.name,
    formName: def.formName,
    growthHint: perks?.growthHint || "",
    formPerk: perks?.formPerk || "",
    capstoneDesc: perks?.capstoneDesc || "",
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
    if (event.target.closest(".mutation-progress--interactive[data-mutation-id]")) return;
    hideMutationLorePopup();
  };
  document.addEventListener("pointerdown", mutationLoreOutsideCloser, true);
}

function renderMutationLorePerksHtml(meta) {
  if (!meta) return "";
  const rows = [];
  if (meta.growthHint) {
    rows.push(`<p class="mutation-lore-popup-perk"><span class="mutation-lore-popup-perk-label">Путь</span><span class="mutation-lore-popup-perk-text">${escapeMutationUiHtml(meta.growthHint)}</span></p>`);
  }
  if (meta.formPerk) {
    const formRound = typeof MUTATION_ROUND_FORM !== "undefined" ? MUTATION_ROUND_FORM : 8;
    rows.push(`<p class="mutation-lore-popup-perk"><span class="mutation-lore-popup-perk-label">На ${formRound}-м раунде</span><span class="mutation-lore-popup-perk-text">${escapeMutationUiHtml(meta.formPerk)}</span></p>`);
  }
  if (meta.capstoneDesc) {
    const finalRound = typeof MUTATION_ROUND_FINAL !== "undefined" ? MUTATION_ROUND_FINAL : 16;
    rows.push(`<p class="mutation-lore-popup-perk"><span class="mutation-lore-popup-perk-label">На ${finalRound}-м раунде</span><span class="mutation-lore-popup-perk-text">${escapeMutationUiHtml(meta.capstoneDesc)}</span></p>`);
  }
  return rows.join("");
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
  popup.dataset.mutationId = mutationId;
  const guideBtn = popup.querySelector(".mutation-lore-popup-guide-btn");
  const classId = typeof getClassIdForMutation === "function" ? getClassIdForMutation(mutationId) : null;
  const hasGuide = classId && typeof getClassDetailGuide === "function" && getClassDetailGuide(classId);
  if (guideBtn) {
    guideBtn.hidden = !hasGuide;
    guideBtn.disabled = !hasGuide;
  }
  const perksEl = popup.querySelector(".mutation-lore-popup-perks");
  if (perksEl) {
    const perksHtml = renderMutationLorePerksHtml(meta);
    perksEl.innerHTML = perksHtml;
    perksEl.hidden = !perksHtml;
  }

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
  delete popup.dataset.mutationId;
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
    const perks = typeof getMutationPerkMeta === "function" ? getMutationPerkMeta(mutationId) : null;
    return {
      kind: "mutation",
      label: def?.name || mutationId,
      sub: "полная мутация",
      perk: perks?.capstoneDesc || "",
      emoji: getMutationUiEmoji(mutationId),
    };
  }
  if (formId && r >= (typeof MUTATION_ROUND_FORM !== "undefined" ? MUTATION_ROUND_FORM : 8)) {
    const def = typeof getMutationById === "function" ? getMutationById(formId) : null;
    const perks = typeof getMutationPerkMeta === "function" ? getMutationPerkMeta(formId) : null;
    return {
      kind: "form",
      label: def?.formName || formId,
      sub: "трансформация",
      perk: perks?.formPerk || "",
      emoji: getMutationUiEmoji(formId),
    };
  }
  return null;
}

function renderPrepMutationBadgeHtml(formId, mutationId, round = 1) {
  const meta = getPrepMutationBadgeMeta(formId, mutationId, round);
  if (!meta) return "";
  const perkHtml = meta.perk
    ? `<span class="prep-mutation-badge-perk">${escapeMutationUiHtml(meta.perk)}</span>`
    : "";
  const title = meta.perk ? `${meta.label} · ${meta.perk}` : meta.label;
  return `
    <span class="prep-mutation-badge prep-mutation-badge--${meta.kind}" title="${escapeMutationUiHtml(title)}">
      <span class="prep-mutation-badge-emoji" aria-hidden="true">${meta.emoji}</span>
      <span class="prep-mutation-badge-text">${escapeMutationUiHtml(meta.label)}</span>
      <span class="prep-mutation-badge-sub">${escapeMutationUiHtml(meta.sub)}</span>
      ${perkHtml}
    </span>
  `;
}

function getFighterMutationEmoji(fighter, round = 1) {
  if (fighter?.mutationId) return getMutationUiEmoji(fighter.mutationId);
  const formRound = typeof MUTATION_ROUND_FORM !== "undefined" ? MUTATION_ROUND_FORM : 8;
  if (fighter?.mutationFormId && round >= formRound) {
    return getMutationUiEmoji(fighter.mutationFormId);
  }
  return null;
}

function renderMutationBadgeHtml(fighter, round = 1) {
  const meta = getPrepMutationBadgeMeta(fighter?.mutationFormId, fighter?.mutationId, round);
  if (!meta) return "";
  return `
    <span class="prep-mutation-badge prep-mutation-badge--compact prep-mutation-badge--${meta.kind}" title="${escapeMutationUiHtml(meta.label)}">
      <span class="prep-mutation-badge-emoji" aria-hidden="true">${meta.emoji}</span>
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

function ensurePrepBuildEmojiDom() {
  const heroCard = document.getElementById("prep-hero-card");
  let heroSlot = document.getElementById("prep-hero-card-build-slot");
  let btn = document.getElementById("prep-build-emoji-btn");

  if (!heroCard) return { heroSlot, btn };

  if (!heroSlot) {
    heroSlot = document.createElement("div");
    heroSlot.className = "prep-hero-card__build-slot";
    heroSlot.id = "prep-hero-card-build-slot";
    heroSlot.setAttribute("aria-hidden", "true");
    const actions = heroCard.querySelector(".prep-hero-card__actions");
    if (actions) heroCard.insertBefore(heroSlot, actions);
    else heroCard.appendChild(heroSlot);
  }

  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "prep-build-emoji-btn build-preview-toggle hidden";
    btn.id = "prep-build-emoji-btn";
    btn.dataset.mutationId = "";
    btn.dataset.emojiSlot = "build";
    btn.setAttribute("aria-label", "Путь сборки");
    btn.title = "Путь сборки";
    btn.innerHTML = `
      <span class="prep-build-emoji-btn-glow" aria-hidden="true"></span>
      <span class="prep-build-emoji-btn-glyph" aria-hidden="true"></span>`;
    heroSlot.appendChild(btn);
    prepBuildEmojiBtnBound = false;
  }

  if (btn && typeof bindPrepBuildEmojiBtnInteractions === "function") {
    bindPrepBuildEmojiBtnInteractions();
  }

  return { heroSlot, btn };
}

function isBBStackPrepArchetypeChromeHidden() {
  const root = document.documentElement;
  return root.dataset.prepLayout === "bb-stack"
    && document.getElementById("app")?.dataset?.phase === "prep";
}

function isPrepBuildEmojiHeroHudMount() {
  const root = document.documentElement;
  return root.dataset.prepLayout === "side"
    || root.dataset.uiSurface === "tablet-side"
    || root.dataset.uiSurface === "desktop";
}

function isBattlePrepHeroSpecFloat() {
  const app = document.getElementById("app");
  const phase = app?.dataset?.phase;
  return document.documentElement.dataset.battlePrepHeroLayer === "true"
    && (phase === "battle" || phase === "replay");
}

/** Бой/replay или prep tablet-side: спек-слоты на #battle-hero-spec-layer + fixed. */
function isHeroSpecFloatLayerActive() {
  if (isBattlePrepHeroSpecFloat()) return true;
  const app = document.getElementById("app");
  return app?.dataset?.phase === "prep"
    && isPrepBuildEmojiHeroHudMount()
    && isPrepFullBodyHeroLayerVisible();
}

function syncBattleSpecLayerMount() {
  const root = document.documentElement;
  const specLayer = document.getElementById("battle-hero-spec-layer");
  const charLayer = document.getElementById("prep-character-layer");
  const specLayerActive = isHeroSpecFloatLayerActive();
  const slotIds = ["prep-character-spec-slot", "prep-character-spec-slot-enemy"];

  root.toggleAttribute("data-battle-spec-layer", specLayerActive);

  if (specLayer) {
    specLayer.classList.toggle("hidden", !specLayerActive);
    specLayer.toggleAttribute("aria-hidden", !specLayerActive);
  }

  if (!charLayer) return;

  const home = specLayerActive && specLayer ? specLayer : charLayer;
  slotIds.forEach((id) => {
    const slot = document.getElementById(id);
    if (!slot || slot.parentElement === home) return;
    home.appendChild(slot);
  });
}

function isPrepFullBodyHeroLayerVisible() {
  const app = document.getElementById("app");
  if (app?.dataset?.phase !== "prep") return false;
  const layer = document.getElementById("prep-character-layer");
  return !!layer && layer.getAttribute("aria-hidden") !== "true";
}

function shouldUseHeroFieldFloatMount() {
  const specSlot = document.getElementById("prep-character-spec-slot");
  if (!specSlot) return false;
  if (isBattlePrepHeroSpecFloat()) return true;
  return isPrepFullBodyHeroLayerVisible() && isPrepBuildEmojiHeroHudMount();
}

function restorePrepBuildEmojiHeroSlot(heroCard, heroSlot) {
  if (!heroCard || !heroSlot || heroCard.contains(heroSlot)) return;
  const actions = heroCard.querySelector(".prep-hero-card__actions");
  if (actions) heroCard.insertBefore(heroSlot, actions);
  else heroCard.appendChild(heroSlot);
}

function syncPrepBuildEmojiBtnMount() {
  ensurePrepBuildEmojiDom();
  syncBattleSpecLayerMount();
  const btn = document.getElementById("prep-build-emoji-btn");
  const heroSlot = document.getElementById("prep-hero-card-build-slot");
  const specSlot = document.getElementById("prep-character-spec-slot");
  const heroCard = document.getElementById("prep-hero-card");
  const statsRow = document.querySelector(".prep-hero-card__stats-row");
  const shopHeader = document.querySelector(".shop-panel-header");
  if (!btn) return;

  const heroHud = isPrepBuildEmojiHeroHudMount();
  const battlePrepHero = isBattlePrepHeroSpecFloat();
  const heroFieldFloat = shouldUseHeroFieldFloatMount() && !battlePrepHero;

  if (heroFieldFloat) {
    hideBattleArchetypeFloat("player");
    specSlot.removeAttribute("aria-hidden");
    btn.classList.add("prep-build-emoji-btn--hero-field-float");
    btn.classList.remove("prep-build-emoji-btn--hud-float");
    if (!specSlot.contains(btn)) specSlot.appendChild(btn);
    if (heroSlot?.contains(btn)) heroSlot.removeChild(btn);
    if (heroSlot) {
      heroSlot.classList.remove("prep-hero-card__build-slot--hud-inline");
      heroSlot.setAttribute("aria-hidden", "true");
    }
  } else if (battlePrepHero) {
    specSlot?.removeAttribute("aria-hidden");
    btn.classList.remove("prep-build-emoji-btn--hero-field-float", "prep-build-emoji-btn--hud-float");
    if (specSlot?.contains(btn)) specSlot.removeChild(btn);
    if (heroSlot) {
      restorePrepBuildEmojiHeroSlot(heroCard, heroSlot);
      if (!heroSlot.contains(btn)) heroSlot.appendChild(btn);
      heroSlot.setAttribute("aria-hidden", "true");
    }
    btn.classList.add("hidden");
  } else if (isBBStackPrepArchetypeChromeHidden()) {
    hideBattleArchetypeFloat("player");
    hideBattleArchetypeFloat("enemy");
    btn.classList.add("hidden");
    if (heroSlot) {
      heroSlot.classList.remove("prep-hero-card__build-slot--hud-inline");
      restorePrepBuildEmojiHeroSlot(heroCard, heroSlot);
      heroSlot.setAttribute("aria-hidden", "true");
    }
    if (specSlot) specSlot.setAttribute("aria-hidden", "true");
  } else if (heroHud && heroSlot) {
    specSlot?.setAttribute("aria-hidden", "true");
    btn.classList.remove("prep-build-emoji-btn--hero-field-float");
    heroSlot.classList.add("prep-hero-card__build-slot--hud-inline");
    btn.classList.add("prep-build-emoji-btn--hud-float");
    if (statsRow && !statsRow.contains(heroSlot)) {
      statsRow.insertBefore(heroSlot, statsRow.firstChild);
    }
    if (!heroSlot.contains(btn)) heroSlot.appendChild(btn);
  } else {
    specSlot?.setAttribute("aria-hidden", "true");
    if (heroSlot) {
      heroSlot.classList.remove("prep-hero-card__build-slot--hud-inline");
      restorePrepBuildEmojiHeroSlot(heroCard, heroSlot);
    }
    btn.classList.remove("prep-build-emoji-btn--hud-float", "prep-build-emoji-btn--hero-field-float");
    if (shopHeader && !shopHeader.contains(btn)) shopHeader.appendChild(btn);
  }

  if (heroSlot && !heroFieldFloat) {
    if (heroHud && !btn.classList.contains("hidden")) heroSlot.removeAttribute("aria-hidden");
    else heroSlot.setAttribute("aria-hidden", "true");
  }

  const enemySpecSlot = document.getElementById("prep-character-spec-slot-enemy");
  if (!battlePrepHero) {
    hideBattleArchetypeFloat("player");
    hideBattleArchetypeFloat("enemy");
  } else {
    specSlot?.removeAttribute("aria-hidden");
    enemySpecSlot?.removeAttribute("aria-hidden");
  }
}

function getBattleArchetypeFloatElements(side) {
  if (side === "enemy") {
    return {
      slot: document.getElementById("prep-character-spec-slot-enemy"),
      floatEl: document.getElementById("battle-enemy-archetype-float"),
    };
  }
  return {
    slot: document.getElementById("prep-character-spec-slot"),
    floatEl: document.getElementById("battle-player-archetype-float"),
  };
}

function hideBattleArchetypeFloat(side) {
  const { slot, floatEl } = getBattleArchetypeFloatElements(side);
  if (slot) slot.setAttribute("aria-hidden", "true");
  if (!floatEl) return;
  floatEl.hidden = true;
  const glyph = floatEl.querySelector(".battle-archetype-float-glyph")
    || floatEl.querySelector(".prep-build-emoji-btn-glyph");
  if (glyph) glyph.textContent = "";
  floatEl.removeAttribute("title");
  floatEl.removeAttribute("aria-label");
  floatEl.dataset.archetypePath = "";
  floatEl.dataset.mutationId = "";
  floatEl.dataset.emoji = "";
  clearArchetypeMagicGlow(floatEl);
}

function hideBattleEnemyArchetypeFloat() {
  hideBattleArchetypeFloat("enemy");
}

function hideBattlePlayerArchetypeFloat() {
  hideBattleArchetypeFloat("player");
}

function syncBattleArchetypeFloat(side, opts = {}) {
  const { slot, floatEl } = getBattleArchetypeFloatElements(side);
  if (!slot || !floatEl) return;

  if (!isBattlePrepHeroSpecFloat()) {
    hideBattleArchetypeFloat(side);
    return;
  }

  const display = resolvePrepBuildEmojiDisplay({
    formId: opts.formId ?? opts.profile?.archetypeFormId,
    mutationId: opts.mutationId ?? opts.profile?.archetypeMutationId,
    classId: opts.classId,
    leaderId: opts.leaderId,
    round: opts.round ?? 1,
    emojiOverride: opts.emojiOverride ?? opts.profile?.archetypeEmoji,
  });

  const emoji = opts.profile?.archetypeEmoji ?? display.emoji;
  if (!emoji) {
    hideBattleArchetypeFloat(side);
    return;
  }

  slot.removeAttribute("aria-hidden");
  floatEl.hidden = false;
  const glyph = floatEl.querySelector(".battle-archetype-float-glyph")
    || floatEl.querySelector(".prep-build-emoji-btn-glyph");
  if (glyph) glyph.textContent = emoji;

  const pathId = opts.profile?.archetypePathId || display.pathId || "";
  floatEl.dataset.archetypePath = pathId;
  floatEl.dataset.mutationId = pathId;
  floatEl.dataset.emoji = emoji;
  const label = formatArchetypeTooltipLabel(pathId, {
    fallback: opts.profile?.archetypeLabel || display.label,
    mutationId: opts.mutationId ?? opts.profile?.archetypeMutationId,
    formId: opts.formId ?? opts.profile?.archetypeFormId,
  });
  floatEl.title = label;
  floatEl.setAttribute("aria-label", label);
  floatEl.classList.toggle("prep-build-emoji-btn--has-path", !!pathId);
  floatEl.classList.toggle("prep-build-emoji-btn--lore", !!pathId && display.loreEnabled);
  applyArchetypeMagicGlow(floatEl, pathId, opts.classId);

  if (pathId && typeof bindAvatarArchetypeBannerInteractions === "function") {
    bindAvatarArchetypeBannerInteractions(floatEl);
  }

  if (typeof window.syncBattleHeroSpecAnchors === "function") {
    requestAnimationFrame(() => window.syncBattleHeroSpecAnchors());
  }
}

function syncBattleEnemyArchetypeFloat(opts = {}) {
  syncBattleArchetypeFloat("enemy", opts);
}

function syncBattlePlayerArchetypeFloat(opts = {}) {
  syncBattleArchetypeFloat("player", opts);
}

function resolveBattleArchetypeFloatOpts(side) {
  const viewState = typeof getDisplayBattleState === "function" ? getDisplayBattleState() : null;
  const profile = viewState?._heroProfiles?.[side];
  const runRound = typeof round !== "undefined" ? round : 1;
  if (profile && (profile.archetypeEmoji || profile.archetypePathId || profile.archetypeMutationId || profile.archetypeFormId)) {
    const classId = side === "player"
      ? (typeof playerClass !== "undefined" ? playerClass : profile.classId)
      : (typeof enemyClass !== "undefined" ? enemyClass : profile.classId);
    return {
      profile,
      formId: profile.archetypeFormId,
      mutationId: profile.archetypeMutationId,
      classId: classId || profile.classId,
      round: profile.archetypeRound ?? runRound,
      emojiOverride: profile.archetypeEmoji,
    };
  }
  if (typeof getSideMutationRuntime !== "function") return null;
  const mutRt = getSideMutationRuntime(side);
  const mutationProgress = typeof resolveMutationProgress === "function"
    ? resolveMutationProgress({
      classId: mutRt.classId,
      companionId: mutRt.companionId,
      items: mutRt.items,
      round: runRound,
    })
    : null;
  return {
    formId: mutRt.formId,
    mutationId: mutRt.mutationId,
    classId: mutRt.classId,
    leaderId: mutationProgress?.leader?.id,
    round: runRound,
  };
}

function syncBattleArchetypeFloatsFromRuntime() {
  if (!isBattlePrepHeroSpecFloat()) return;
  const playerOpts = resolveBattleArchetypeFloatOpts("player");
  const enemyOpts = resolveBattleArchetypeFloatOpts("enemy");
  if (playerOpts) syncBattlePlayerArchetypeFloat(playerOpts);
  if (enemyOpts) syncBattleEnemyArchetypeFloat(enemyOpts);
}

window.syncBattleEnemyArchetypeFloat = syncBattleEnemyArchetypeFloat;
window.syncBattlePlayerArchetypeFloat = syncBattlePlayerArchetypeFloat;
window.syncBattleArchetypeFloatsFromRuntime = syncBattleArchetypeFloatsFromRuntime;
window.syncBattleSpecLayerMount = syncBattleSpecLayerMount;
window.hideBattleArchetypeFloat = hideBattleArchetypeFloat;

function syncPrepBuildEmojiBtn(opts = {}) {
  ensurePrepBuildEmojiDom();
  const btn = document.getElementById("prep-build-emoji-btn");
  if (!btn) return;

  syncPrepBuildEmojiBtnMount();

  if (isBBStackPrepArchetypeChromeHidden()) {
    btn.classList.add("hidden");
    return;
  }

  if (isBattlePrepHeroSpecFloat()) {
    syncBattlePlayerArchetypeFloat(opts);
    const enemyOpts = resolveBattleArchetypeFloatOpts("enemy");
    if (enemyOpts) syncBattleEnemyArchetypeFloat(enemyOpts);
    return;
  }

  hideBattleArchetypeFloat("player");
  hideBattleArchetypeFloat("enemy");

  const display = resolvePrepBuildEmojiDisplay(opts);
  const glyph = btn.querySelector(".prep-build-emoji-btn-glyph");
  if (glyph) glyph.textContent = display.emoji;

  btn.dataset.mutationId = display.pathId || "";
  btn.dataset.emoji = display.emoji;
  const tooltip = display.pathId
    ? formatArchetypeTooltipLabel(display.pathId, {
      fallback: display.label,
      mutationId: opts.mutationId,
      formId: opts.formId,
    })
    : display.label;
  btn.title = tooltip;
  btn.setAttribute("aria-label", display.loreEnabled
    ? `${tooltip} · нажмите для подробностей`
    : tooltip);

  btn.classList.toggle("prep-build-emoji-btn--has-path", !!display.pathId);
  btn.classList.toggle("prep-build-emoji-btn--lore", display.loreEnabled);
  btn.classList.remove("hidden");
  applyArchetypeMagicGlow(btn, display.pathId || "", opts.classId);

  const specSlot = document.getElementById("prep-character-spec-slot");
  const heroSlot = document.getElementById("prep-hero-card-build-slot");
  if (specSlot?.contains(btn) && !btn.classList.contains("hidden")) {
    specSlot.removeAttribute("aria-hidden");
  } else if (heroSlot && isPrepBuildEmojiHeroHudMount() && !btn.classList.contains("hidden")) {
    heroSlot.removeAttribute("aria-hidden");
  }

  if (typeof window.syncBattleHeroSpecAnchors === "function") {
    requestAnimationFrame(() => window.syncBattleHeroSpecAnchors());
  }
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

  if (typeof bindPointerTapTooltip === "function") {
    bindPointerTapTooltip(btn, () => {
      const pathId = btn.dataset.mutationId;
      if (!pathId) return;
      showMutationLorePopup(btn, pathId, { pin: true });
    });
  }

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
  bindMutationProgressInteractions();
  syncPrepBuildEmojiBtnMount();
}

function syncPrepBuildEmojiBtnFromRuntime() {
  if (typeof getSideMutationRuntime !== "function") return;
  const app = document.getElementById("app");
  const phase = app?.dataset?.phase;
  if (phase !== "prep" && phase !== "battle" && phase !== "replay") return;

  if ((phase === "battle" || phase === "replay") && isBattlePrepHeroSpecFloat()) {
    syncPrepBuildEmojiBtnMount();
    syncBattleArchetypeFloatsFromRuntime();
    return;
  }

  const side = typeof prepViewSide !== "undefined" ? prepViewSide : "player";
  const mutRt = getSideMutationRuntime(side);
  const runRound = typeof round !== "undefined" ? round : 1;
  const mutationProgress = typeof resolveMutationProgress === "function"
    ? resolveMutationProgress({
      classId: mutRt.classId,
      companionId: mutRt.companionId,
      items: mutRt.items,
      round: runRound,
    })
    : null;
  syncPrepBuildEmojiBtn({
    formId: mutRt.formId,
    mutationId: mutRt.mutationId,
    classId: mutRt.classId,
    leaderId: mutationProgress?.leader?.id,
    round: runRound,
  });
}

window.syncPrepBuildEmojiBtnMount = syncPrepBuildEmojiBtnMount;
window.syncPrepBuildEmojiBtn = syncPrepBuildEmojiBtn;
window.syncPrepBuildEmojiBtnFromRuntime = syncPrepBuildEmojiBtnFromRuntime;

function renderPrepCharacterHtml(side, profile, runRound = 1) {
  const classId = profile?.classId;
  const portraitSrc = classId && typeof getClassHeroPortraitSrc === "function"
    ? getClassHeroPortraitSrc(classId)
    : (profile?.classIconSrc || null);
  const alt = escapeMutationUiHtml(profile?.className || "");

  if (portraitSrc) {
    const fullBleed = document.documentElement.dataset.heroCardMode === "full-bleed";
    if (fullBleed) {
      return `<img class="prep-character-img prep-character-img--float" src="${escapeMutationUiHtml(portraitSrc)}" alt="${alt}" draggable="false">`;
    }
    if (typeof renderHeroPortraitFrameHTML === "function" && classId) {
      return renderHeroPortraitFrameHTML(classId, {
        alt: profile?.className || "",
      });
    }
    return `<img class="prep-character-img" src="${escapeMutationUiHtml(portraitSrc)}" alt="${alt}" draggable="false">`;
  }
  if (profile?.classIconSrc) {
    return `<img class="prep-character-img" src="${escapeMutationUiHtml(profile.classIconSrc)}" alt="${alt}" draggable="false">`;
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
  void side;
  void milestone;
  clearMutationRevealFx();
}

function formatArchetypeTooltipLabel(pathId, opts = {}) {
  if (!pathId) return opts.fallback || "Герой";
  const def = typeof getMutationById === "function" ? getMutationById(pathId) : null;
  const perks = typeof getMutationPerkMeta === "function" ? getMutationPerkMeta(pathId) : null;
  const name = def?.name || pathId;
  if (opts.mutationId === pathId && perks?.capstoneDesc) {
    return `${name} · ${perks.capstoneDesc}`;
  }
  if (opts.formId === pathId && perks?.formPerk) {
    return `${def?.formName || name} · ${perks.formPerk}`;
  }
  if (perks?.capstoneDesc) return `${name} · ${perks.capstoneDesc}`;
  return name;
}

let mutationProgressBound = false;

function bindMutationProgressInteractions() {
  if (mutationProgressBound) return;
  mutationProgressBound = true;

  document.addEventListener("pointerover", (event) => {
    if (isCoarseMutationPointer()) return;
    const el = event.target.closest(".mutation-progress--interactive[data-mutation-id]");
    if (!el) return;
    showMutationLorePopup(el, el.dataset.mutationId);
  });

  document.addEventListener("pointerout", (event) => {
    if (isCoarseMutationPointer() || mutationLorePopupPinned) return;
    const el = event.target.closest(".mutation-progress--interactive[data-mutation-id]");
    if (!el) return;
    const to = event.relatedTarget;
    if (to?.closest?.(`#${MUTATION_LORE_POPUP_ID}`)) return;
    if (to?.closest?.(".mutation-progress--interactive[data-mutation-id]")) return;
    hideMutationLorePopup();
  });

  document.addEventListener("click", (event) => {
    const el = event.target.closest(".mutation-progress--interactive[data-mutation-id]");
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    const pathId = el.dataset.mutationId;
    if (!pathId) return;
    if (isCoarseMutationPointer()) {
      if (mutationLorePopupCell === el && mutationLorePopupPinned) hideMutationLorePopup();
      else showMutationLorePopup(el, pathId, { pin: true });
      return;
    }
    showMutationLorePopup(el, pathId, { pin: true });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const el = event.target.closest(".mutation-progress--interactive[data-mutation-id]");
    if (!el) return;
    event.preventDefault();
    showMutationLorePopup(el, el.dataset.mutationId, { pin: true });
  });
}

const avatarArchetypeBannerBound = new WeakSet();

function bindAvatarArchetypeBannerInteractions(banner) {
  if (!banner || avatarArchetypeBannerBound.has(banner)) return;
  avatarArchetypeBannerBound.add(banner);

  banner.addEventListener("pointerover", () => {
    if (isCoarseMutationPointer()) return;
    const pathId = banner.dataset.archetypePath;
    if (!pathId) return;
    showMutationLorePopup(banner, pathId);
  });

  banner.addEventListener("pointerout", (event) => {
    if (isCoarseMutationPointer() || mutationLorePopupPinned) return;
    const to = event.relatedTarget;
    if (to?.closest?.(`#${MUTATION_LORE_POPUP_ID}`)) return;
    if (to?.closest?.(".avatar-hero-archetype-banner, .battle-archetype-float")) return;
    hideMutationLorePopup();
  });

  banner.addEventListener("click", (event) => {
    const pathId = banner.dataset.archetypePath;
    if (!pathId) return;
    event.preventDefault();
    event.stopPropagation();
    if (isCoarseMutationPointer()) {
      if (mutationLorePopupCell === banner && mutationLorePopupPinned) hideMutationLorePopup();
      else showMutationLorePopup(banner, pathId, { pin: true });
      return;
    }
    showMutationLorePopup(banner, pathId, { pin: true });
  });
}

window.bindAvatarArchetypeBannerInteractions = bindAvatarArchetypeBannerInteractions;
window.bindMutationProgressInteractions = bindMutationProgressInteractions;
function syncPrepHeroMutationBadge(formId, mutationId, roundNum = 1) {
  const mount = document.getElementById("prep-hero-mutation-badge-mount");
  if (!mount) return;
  if (isBBStackPrepArchetypeChromeHidden()) {
    mount.innerHTML = "";
    mount.setAttribute("aria-hidden", "true");
    return;
  }
  const html = typeof renderPrepMutationBadgeHtml === "function"
    ? renderPrepMutationBadgeHtml(formId, mutationId, roundNum)
    : "";
  mount.innerHTML = html;
  mount.toggleAttribute("aria-hidden", !html);
}

window.getPrepMutationBadgeMeta = getPrepMutationBadgeMeta;
window.syncPrepHeroMutationBadge = syncPrepHeroMutationBadge;
