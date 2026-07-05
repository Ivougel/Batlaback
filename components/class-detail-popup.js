/**
 * Попап «Подробнее» — описание класса, сборки и предметы на экране выбора героя.
 */

function renderClassDetailItemChip(itemId) {
  const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[itemId] : null;
  if (!def) {
    return `<span class="class-detail-item class-detail-item--missing">${escapeClassHtml(itemId)}</span>`;
  }
  const color = typeof getRarityNameColor === "function"
    ? getRarityNameColor(def.rarity)
    : "#e6edf3";
  const tip = (def.description || def.name || "").replace(/"/g, "&quot;");
  const tracked = typeof isBuildTrackedItem === "function" && isBuildTrackedItem(itemId);
  return `
    <span class="class-detail-item rarity-${def.rarity || "common"}${tracked ? " class-detail-item--tracked" : ""}" data-item-id="${escapeClassHtml(itemId)}" title="${tip}">
      <span class="class-detail-item-icon" aria-hidden="true">${def.icon || "📦"}</span>
      <span class="class-detail-item-name" style="color:${color}">${escapeClassHtml(def.name)}</span>
      ${tracked ? `<span class="class-detail-item-track" aria-hidden="true">🎯</span>` : ""}
    </span>
  `;
}

function renderClassDetailTrackButton(classId, build) {
  const active = typeof isTrackedBuildActive === "function"
    && isTrackedBuildActive(classId, build.id);
  return `
    <button
      type="button"
      class="btn-secondary class-detail-track-btn${active ? " is-active" : ""}"
      data-class-id="${escapeClassHtml(classId)}"
      data-build-id="${escapeClassHtml(build.id)}"
      aria-pressed="${active ? "true" : "false"}"
    >${active ? "✓ Отслеживается" : "Отслеживать билд"}</button>
  `;
}

function renderClassDetailStarterRow(cls) {
  const ids = cls.starterItems || [];
  if (!ids.length) return "";
  return `
    <section class="class-detail-section">
      <h3 class="class-detail-section-title">🎒 Стартовый набор</h3>
      <p class="class-detail-section-lead">${escapeClassHtml(cls.loadoutDesc || "")}</p>
      <div class="class-detail-items">${ids.map(renderClassDetailItemChip).join("")}</div>
    </section>
  `;
}

function renderClassDetailBuilds(classId, builds = [], options = {}) {
  if (!builds.length) return "";
  const highlightBuildId = options.highlightBuildId || null;
  const rows = builds.map((build) => {
    const active = typeof isTrackedBuildActive === "function"
      && isTrackedBuildActive(classId, build.id);
    const highlighted = highlightBuildId === build.id;
    return `
    <article class="class-detail-build${active ? " class-detail-build--active" : ""}${highlighted ? " class-detail-build--highlight" : ""}" data-build-id="${escapeClassHtml(build.id)}">
      <header class="class-detail-build-head">
        <span class="class-detail-build-emoji" aria-hidden="true">${build.emoji || "✨"}</span>
        <div class="class-detail-build-copy">
          <h4 class="class-detail-build-name">${escapeClassHtml(build.name)}</h4>
          <p class="class-detail-build-desc">${escapeClassHtml(build.desc || "")}</p>
        </div>
        ${renderClassDetailTrackButton(classId, build)}
      </header>
      <div class="class-detail-items class-detail-items--build">
        ${(build.items || []).map(renderClassDetailItemChip).join("")}
      </div>
    </article>
  `;
  }).join("");
  return `
    <section class="class-detail-section" id="class-detail-builds-section">
      <h3 class="class-detail-section-title">🛤️ Как собирать билд</h3>
      <p class="class-detail-section-lead">Примеры наборов предметов — отслеживайте билд, и нужное будет подсвечено в магазине 🎯</p>
      <div class="class-detail-builds">${rows}</div>
    </section>
  `;
}

function renderClassDetailMutationPaths(classId, options = {}) {
  if (typeof getMutationsForNoviceClass !== "function") return "";
  const mutations = getMutationsForNoviceClass(classId);
  if (!mutations.length) return "";
  const highlightMutationId = options.highlightMutationId || null;
  const cls = typeof getClassById === "function" ? getClassById(classId) : null;
  const cells = mutations.map((mut) => {
    const emoji = typeof getMutationUiEmoji === "function" ? getMutationUiEmoji(mut.id) : "✨";
    const hint = typeof getMutationGrowthHint === "function" ? getMutationGrowthHint(mut) : "";
    const isCurrent = highlightMutationId === mut.id;
    return `
      <div class="class-detail-path${isCurrent ? " class-detail-path--current" : ""}" data-mutation-id="${escapeClassHtml(mut.id)}" title="${escapeClassHtml(hint)}">
        <span class="class-detail-path-emoji" aria-hidden="true">${emoji}</span>
        <span class="class-detail-path-name">${escapeClassHtml(mut.name)}</span>
        <span class="class-detail-path-form">${escapeClassHtml(mut.formName || "")}</span>
        ${isCurrent ? `<span class="class-detail-path-badge">ваш путь</span>` : ""}
      </div>
    `;
  }).join("");
  return `
    <section class="class-detail-section class-detail-section--paths" id="class-detail-paths-section">
      <h3 class="class-detail-section-title">🔀 Варианты развития</h3>
      <p class="class-detail-section-lead">${escapeClassHtml(cls?.heroLabel || cls?.name || "Герой")} · 8 путей трансформации к 8–16 раунду</p>
      <div class="class-detail-paths">${cells}</div>
    </section>
  `;
}

function renderClassDetailRecommended(ids = []) {
  if (!ids.length) return "";
  return `
    <section class="class-detail-section">
      <h3 class="class-detail-section-title">⭐ Часто берут в магазине</h3>
      <div class="class-detail-items">${ids.map(renderClassDetailItemChip).join("")}</div>
    </section>
  `;
}

function renderClassDetailTrackStatus(classId) {
  const tracked = typeof getTrackedBuild === "function" ? getTrackedBuild() : null;
  if (!tracked || tracked.classId !== classId) {
    return `<p class="class-detail-track-status class-detail-track-status--idle">Нажмите «Отслеживать билд» — нужные предметы будут заметно подсвечены в магазине.</p>`;
  }
  return `
    <div class="class-detail-track-status class-detail-track-status--active">
      <span>🎯 Отслеживается: <strong>${escapeClassHtml(tracked.buildEmoji)} ${escapeClassHtml(tracked.buildName)}</strong></span>
      <button type="button" class="btn-secondary class-detail-track-clear" id="btn-class-detail-clear-track">Снять</button>
    </div>
  `;
}

function renderClassDetailBody(classId, options = {}) {
  const data = typeof getClassDetailGuide === "function" ? getClassDetailGuide(classId) : null;
  if (!data) return "<p>Нет данных по этому классу.</p>";
  const { cls, tagFocus, builds, recommendedItems } = data;
  const highlightBuildId = options.highlightBuildId
    || (options.highlightMutationId && typeof resolveBuildIdForMutation === "function"
      ? resolveBuildIdForMutation(options.highlightMutationId)
      : null);
  const portraitSrc = getClassHeroPortraitSrc(classId);
  const label = cls.heroLabel || cls.noviceLabel || cls.name;
  return `
    <header class="class-detail-hero">
      ${portraitSrc
    ? `<img class="class-detail-hero-img" src="${escapeClassHtml(portraitSrc)}" alt="" draggable="false">`
    : `<span class="class-detail-hero-emoji">${cls.icon || "❓"}</span>`}
      <div class="class-detail-hero-copy">
        <p class="class-detail-hero-label">${escapeClassHtml(label)}</p>
        <p class="class-detail-hero-bonus">${escapeClassHtml(cls.desc || "")}</p>
      </div>
    </header>
    <section class="class-detail-section class-detail-section--lore">
      <h3 class="class-detail-section-title">⚡ Бонус класса</h3>
      <p class="class-detail-lore">${escapeClassHtml(typeof getClassIntroBlurb === "function" ? getClassIntroBlurb(classId) : (cls.desc || ""))}</p>
      ${tagFocus ? `<p class="class-detail-tags">Ищите в магазине: <strong>${escapeClassHtml(tagFocus)}</strong></p>` : ""}
    </section>
    ${renderClassDetailStarterRow(cls)}
    ${renderClassDetailMutationPaths(classId, options)}
    ${renderClassDetailBuilds(classId, builds, { highlightBuildId })}
    ${renderClassDetailRecommended(recommendedItems)}
    ${renderClassDetailTrackStatus(classId)}
  `;
}

function bindClassDetailItemTooltips(root) {
  root?.querySelectorAll(".class-detail-item[data-item-id]").forEach((chip) => {
    if (typeof bindItemTooltipEvents === "function") {
      bindItemTooltipEvents(chip, chip.dataset.itemId, null, "shop");
    }
  });
}

function bindClassDetailTrackControls(root, classId) {
  root?.querySelectorAll(".class-detail-track-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const cid = btn.dataset.classId || classId;
      const buildId = btn.dataset.buildId;
      if (!cid || !buildId) return;
      if (typeof isTrackedBuildActive === "function" && isTrackedBuildActive(cid, buildId)) {
        if (typeof clearTrackedBuild === "function") clearTrackedBuild();
      } else if (typeof setTrackedBuild === "function") {
        setTrackedBuild(cid, buildId);
      }
      refreshClassDetailPopupBody(cid);
    });
  });
  root?.querySelector("#btn-class-detail-clear-track")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof clearTrackedBuild === "function") clearTrackedBuild();
    refreshClassDetailPopupBody(classId);
  });
}

function getClassDetailPopupOptions() {
  const overlay = document.getElementById("class-detail-overlay");
  if (!overlay || overlay.classList.contains("hidden")) return {};
  return {
    highlightMutationId: overlay.dataset.highlightMutationId || null,
    highlightBuildId: overlay.dataset.highlightBuildId || null,
  };
}

function scrollClassDetailToHighlight(body, options = {}) {
  if (!body) return;
  const target = (options.highlightBuildId
    ? body.querySelector(`.class-detail-build[data-build-id="${options.highlightBuildId}"]`)
    : null)
    || (options.highlightMutationId
      ? body.querySelector(`.class-detail-path[data-mutation-id="${options.highlightMutationId}"]`)
      : null)
    || body.querySelector("#class-detail-builds-section")
    || body.querySelector("#class-detail-paths-section");
  target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function refreshClassDetailPopupBody(classId) {
  const body = document.getElementById("class-detail-body");
  const overlay = document.getElementById("class-detail-overlay");
  if (!body || !classId || overlay?.classList.contains("hidden")) return;
  const options = getClassDetailPopupOptions();
  body.innerHTML = renderClassDetailBody(classId, options);
  bindClassDetailItemTooltips(body);
  bindClassDetailTrackControls(body, classId);
}

function refreshClassDetailBuildButtons() {
  const overlay = document.getElementById("class-detail-overlay");
  const classId = overlay?.dataset.classId;
  if (!classId || overlay?.classList.contains("hidden")) return;
  refreshClassDetailPopupBody(classId);
}

function isClassDetailPopupOpen() {
  return typeof isPopupOpen === "function"
    ? isPopupOpen("class-detail-overlay")
    : !document.getElementById("class-detail-overlay")?.classList.contains("hidden");
}

function showClassDetailPopup(classId, options = {}) {
  const overlay = document.getElementById("class-detail-overlay");
  const body = document.getElementById("class-detail-body");
  const title = document.getElementById("class-detail-title");
  if (!overlay || !body || !classId) return;
  const cls = typeof getClassById === "function" ? getClassById(classId) : null;
  const highlightMutationId = options.highlightMutationId || null;
  const highlightBuildId = options.highlightBuildId
    || (highlightMutationId && typeof resolveBuildIdForMutation === "function"
      ? resolveBuildIdForMutation(highlightMutationId)
      : null);
  if (title) {
    title.textContent = cls
      ? `${cls.heroLabel || cls.noviceLabel || cls.name}`
      : "Подробнее о герое";
  }
  body.innerHTML = renderClassDetailBody(classId, { highlightMutationId, highlightBuildId });
  bindClassDetailItemTooltips(body);
  bindClassDetailTrackControls(body, classId);
  overlay.classList.remove("hidden");
  overlay.dataset.classId = classId;
  if (highlightMutationId) overlay.dataset.highlightMutationId = highlightMutationId;
  else delete overlay.dataset.highlightMutationId;
  if (highlightBuildId) overlay.dataset.highlightBuildId = highlightBuildId;
  else delete overlay.dataset.highlightBuildId;
  document.body.classList.add("class-detail-open");
  document.getElementById("btn-class-detail-close")?.focus();
  requestAnimationFrame(() => scrollClassDetailToHighlight(body, { highlightMutationId, highlightBuildId }));
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}

function showClassBuildGuideFromMutation(mutationId) {
  if (!mutationId) return false;
  const classId = typeof getClassIdForMutation === "function"
    ? getClassIdForMutation(mutationId)
    : null;
  if (!classId || typeof getClassDetailGuide !== "function" || !getClassDetailGuide(classId)) return false;
  if (typeof hideMutationLorePopup === "function") hideMutationLorePopup();
  showClassDetailPopup(classId, { highlightMutationId: mutationId });
  return true;
}

function hideClassDetailPopup() {
  const overlay = document.getElementById("class-detail-overlay");
  if (!overlay) return;
  if (typeof hideSidebarTooltip === "function") hideSidebarTooltip();
  overlay.classList.add("hidden");
  delete overlay.dataset.classId;
  delete overlay.dataset.highlightMutationId;
  delete overlay.dataset.highlightBuildId;
  document.body.classList.remove("class-detail-open");
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}

function initClassDetailPopup() {
  document.getElementById("btn-class-detail")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const classId = event.currentTarget.dataset.classId;
    if (classId) showClassDetailPopup(classId);
  });
  document.getElementById("btn-class-detail-close")?.addEventListener("click", hideClassDetailPopup);
  document.getElementById("class-detail-overlay")?.addEventListener("click", (event) => {
    if (event.target.id === "class-detail-overlay") hideClassDetailPopup();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isClassDetailPopupOpen()) return;
    event.preventDefault();
    hideClassDetailPopup();
  });
}

window.showClassDetailPopup = showClassDetailPopup;
window.showClassBuildGuideFromMutation = showClassBuildGuideFromMutation;
window.hideClassDetailPopup = hideClassDetailPopup;
window.isClassDetailPopupOpen = isClassDetailPopupOpen;
window.refreshClassDetailBuildButtons = refreshClassDetailBuildButtons;
