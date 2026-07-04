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

function renderClassDetailBuilds(classId, builds = []) {
  if (!builds.length) return "";
  const rows = builds.map((build) => {
    const active = typeof isTrackedBuildActive === "function"
      && isTrackedBuildActive(classId, build.id);
    return `
    <article class="class-detail-build${active ? " class-detail-build--active" : ""}" data-build-id="${escapeClassHtml(build.id)}">
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
    <section class="class-detail-section">
      <h3 class="class-detail-section-title">🛤️ Рекомендуемые сборки</h3>
      <p class="class-detail-section-lead">8 путей мутации на R16 — выберите билд и отслеживайте нужные предметы в магазине.</p>
      <div class="class-detail-builds">${rows}</div>
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

function renderClassDetailBody(classId) {
  const data = typeof getClassDetailGuide === "function" ? getClassDetailGuide(classId) : null;
  if (!data) return "<p>Нет данных по этому классу.</p>";
  const { cls, bonusDetail, tagFocus, builds, recommendedItems } = data;
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
    ${renderClassDetailBuilds(classId, builds)}
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

function refreshClassDetailPopupBody(classId) {
  const body = document.getElementById("class-detail-body");
  const overlay = document.getElementById("class-detail-overlay");
  if (!body || !classId || overlay?.classList.contains("hidden")) return;
  body.innerHTML = renderClassDetailBody(classId);
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

function showClassDetailPopup(classId) {
  const overlay = document.getElementById("class-detail-overlay");
  const body = document.getElementById("class-detail-body");
  const title = document.getElementById("class-detail-title");
  if (!overlay || !body || !classId) return;
  const cls = typeof getClassById === "function" ? getClassById(classId) : null;
  if (title) {
    title.textContent = cls
      ? `${cls.heroLabel || cls.noviceLabel || cls.name}`
      : "Подробнее о герое";
  }
  body.innerHTML = renderClassDetailBody(classId);
  bindClassDetailItemTooltips(body);
  bindClassDetailTrackControls(body, classId);
  overlay.classList.remove("hidden");
  overlay.dataset.classId = classId;
  document.body.classList.add("class-detail-open");
  document.getElementById("btn-class-detail-close")?.focus();
  if (typeof refreshGamepadHints === "function") refreshGamepadHints();
}

function hideClassDetailPopup() {
  const overlay = document.getElementById("class-detail-overlay");
  if (!overlay) return;
  if (typeof hideSidebarTooltip === "function") hideSidebarTooltip();
  overlay.classList.add("hidden");
  delete overlay.dataset.classId;
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
window.hideClassDetailPopup = hideClassDetailPopup;
window.isClassDetailPopupOpen = isClassDetailPopupOpen;
window.refreshClassDetailBuildButtons = refreshClassDetailBuildButtons;
