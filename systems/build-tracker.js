// Transpiled from TypeScript — npm run compile:ts

let trackedBuild = null;
function normalizeBuildTrackItemId(itemId) {
  if (!itemId) return null;
  return itemId;
}
function getTrackedBuild() {
  return trackedBuild ? { ...trackedBuild, itemIds: [...trackedBuild.itemIds] } : null;
}
function isBuildTrackedItem(itemId) {
  if (!trackedBuild?.itemIds?.length) return false;
  const norm = normalizeBuildTrackItemId(itemId);
  return norm ? trackedBuild.itemIds.includes(norm) : false;
}
function getClassBuildGuideEntry(classId, buildId) {
  const guide = typeof getClassDetailGuide === "function" ? getClassDetailGuide(classId) : null;
  if (!guide?.builds?.length) return null;
  return guide.builds.find((b) => b.id === buildId) || null;
}
function setTrackedBuild(classId, buildId) {
  const build = getClassBuildGuideEntry(classId, buildId);
  if (!build) return false;
  const cls = typeof getClassById === "function" ? getClassById(classId) : null;
  trackedBuild = {
    classId,
    buildId: build.id,
    buildName: build.name,
    buildEmoji: build.emoji || "\u2728",
    className: cls?.heroLabel || cls?.name || classId,
    itemIds: [...new Set((build.items || []).map(normalizeBuildTrackItemId).filter((id) => Boolean(id)))]
  };
  syncBuildTrackUi();
  return true;
}
function clearTrackedBuild() {
  if (!trackedBuild) return;
  trackedBuild = null;
  syncBuildTrackUi();
}
function isTrackedBuildActive(classId, buildId) {
  return trackedBuild?.classId === classId && trackedBuild?.buildId === buildId;
}
function syncBuildTrackUi() {
  syncBuildTrackShopBar();
  if (typeof renderShop === "function" && typeof rt !== "undefined" && rt?.getPhase?.() === "prep") {
    renderShop();
  }
  if (typeof refreshClassDetailBuildButtons === "function") refreshClassDetailBuildButtons();
}
function syncBuildTrackShopBar() {
  const bar = document.getElementById("shop-build-track-bar");
  if (!bar) return;
  if (!trackedBuild) {
    bar.classList.add("hidden");
    bar.textContent = "";
    bar.setAttribute("aria-hidden", "true");
    return;
  }
  bar.classList.remove("hidden");
  bar.setAttribute("aria-hidden", "false");
  bar.innerHTML = `
    <span class="shop-build-track-bar-label">
      <span class="shop-build-track-bar-emoji" aria-hidden="true">${trackedBuild.buildEmoji}</span>
      \u0411\u0438\u043B\u0434: <strong>${escapeBuildTrackHtml(trackedBuild.buildName)}</strong>
      <span class="shop-build-track-bar-sub">\u2014 \u043D\u0443\u0436\u043D\u044B\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u043F\u043E\u0434\u0441\u0432\u0435\u0447\u0435\u043D\u044B \u{1F3AF}</span>
    </span>
    <button type="button" class="shop-build-track-bar-clear" id="btn-clear-build-track">\u0421\u043D\u044F\u0442\u044C</button>
  `;
  bar.querySelector("#btn-clear-build-track")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearTrackedBuild();
  });
}
function escapeBuildTrackHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
function renderShopTrackBadge(itemId) {
  if (!isBuildTrackedItem(itemId)) return "";
  return `<span class="shop-track-badge" title="\u041D\u0443\u0436\u0435\u043D \u0434\u043B\u044F \u043E\u0442\u0441\u043B\u0435\u0436\u0438\u0432\u0430\u0435\u043C\u043E\u0433\u043E \u0431\u0438\u043B\u0434\u0430" aria-hidden="true">\u{1F3AF}</span>`;
}
function getShopCardTrackExtraClasses(itemId) {
  return isBuildTrackedItem(itemId) ? "shop-card--build-tracked" : "";
}
window.getTrackedBuild = getTrackedBuild;
window.setTrackedBuild = setTrackedBuild;
window.clearTrackedBuild = clearTrackedBuild;
window.isBuildTrackedItem = isBuildTrackedItem;
window.isTrackedBuildActive = isTrackedBuildActive;
window.renderShopTrackBadge = renderShopTrackBadge;
window.getShopCardTrackExtraClasses = getShopCardTrackExtraClasses;
window.syncBuildTrackShopBar = syncBuildTrackShopBar;
