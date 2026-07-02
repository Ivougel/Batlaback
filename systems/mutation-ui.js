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
let mutationRevealTimer = null;

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
    return `
      <div class="mutation-silhouette" title="${escapeMutationUiHtml(hint)}">
        <span class="mutation-silhouette-icon" aria-hidden="true">${emoji}</span>
        <span class="mutation-silhouette-name">${escapeMutationUiHtml(mut.name)}</span>
        <span class="mutation-silhouette-form">${escapeMutationUiHtml(mut.formName)}</span>
      </div>
    `;
  }).join("");

  const novice = typeof getNoviceClassLabel === "function"
    ? getNoviceClassLabel(classId)
    : classId;

  return `
    <div class="mutation-gallery" role="group" aria-label="Мутации класса">
      <p class="mutation-gallery-eyebrow">${escapeMutationUiHtml(novice)} · 8 путей R16</p>
      <p class="mutation-gallery-hint">Силуэты откроются в забеге: собирайте теги в рюкзаке и на манекене</p>
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

function renderClassMutationGallery(classId) {
  const wrap = document.getElementById("class-mutation-gallery");
  if (!wrap) return;
  const html = classId && typeof buildClassMutationGalleryHtml === "function"
    ? buildClassMutationGalleryHtml(classId)
    : "";
  wrap.innerHTML = html;
  wrap.classList.toggle("hidden", !html);
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

function renderPrepCharacterHtml(side, profile, runRound = 1) {
  const rt = typeof getSideMutationRuntime === "function" ? getSideMutationRuntime(side) : null;
  const r = runRound || 1;
  const badge = typeof renderPrepMutationBadgeHtml === "function"
    ? renderPrepMutationBadgeHtml(rt?.formId, rt?.mutationId, r)
    : "";
  const useMutationEmoji = !!rt?.mutationId;
  const mutationEmoji = useMutationEmoji ? getMutationUiEmoji(rt.mutationId) : null;

  let inner = "";
  if (useMutationEmoji && mutationEmoji) {
    inner = `<span class="prep-character-emoji prep-character-emoji--mutation" aria-hidden="true">${mutationEmoji}</span>`;
  } else if (profile?.classIconSrc) {
    inner = `<img class="prep-character-img" src="${escapeMutationUiHtml(profile.classIconSrc)}" alt="" draggable="false">`;
  } else {
    inner = `<span class="prep-character-emoji">${profile?.classIcon || "❓"}</span>`;
  }

  return `${inner}${badge}`;
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
