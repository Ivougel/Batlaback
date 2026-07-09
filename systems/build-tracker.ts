/**
 * Отслеживание выбранного билда из попапа «Подробнее» — подсветка предметов в магазине.
 */
import type { TrackedBuild } from "../types/game";

let trackedBuild: TrackedBuild | null = null;

function normalizeBuildTrackItemId(itemId: string | null | undefined): string | null {
  if (!itemId) return null;
  return itemId;
}

function getTrackedBuild(): TrackedBuild | null {
  return trackedBuild ? { ...trackedBuild, itemIds: [...trackedBuild.itemIds] } : null;
}

function isBuildTrackedItem(itemId: string): boolean {
  if (!trackedBuild?.itemIds?.length) return false;
  const norm = normalizeBuildTrackItemId(itemId);
  return norm ? trackedBuild.itemIds.includes(norm) : false;
}

function getClassBuildGuideEntry(classId: string, buildId: string) {
  const guide = typeof getClassDetailGuide === "function" ? getClassDetailGuide(classId) : null;
  if (!guide?.builds?.length) return null;
  return guide.builds.find((b) => b.id === buildId) || null;
}

function setTrackedBuild(classId: string, buildId: string): boolean {
  const build = getClassBuildGuideEntry(classId, buildId);
  if (!build) return false;
  const cls = typeof getClassById === "function" ? getClassById(classId) : null;
  trackedBuild = {
    classId,
    buildId: build.id,
    buildName: build.name,
    buildEmoji: build.emoji || "✨",
    className: cls?.heroLabel || cls?.name || classId,
    itemIds: [...new Set((build.items || []).map(normalizeBuildTrackItemId).filter((id): id is string => Boolean(id)))],
  };
  syncBuildTrackUi();
  return true;
}

function clearTrackedBuild() {
  if (!trackedBuild) return;
  trackedBuild = null;
  syncBuildTrackUi();
}

function isTrackedBuildActive(classId: string, buildId: string): boolean {
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
      Билд: <strong>${escapeBuildTrackHtml(trackedBuild.buildName)}</strong>
      <span class="shop-build-track-bar-sub">— нужные предметы подсвечены 🎯</span>
    </span>
    <button type="button" class="shop-build-track-bar-clear" id="btn-clear-build-track">Снять</button>
  `;
  bar.querySelector("#btn-clear-build-track")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearTrackedBuild();
  });
}

function escapeBuildTrackHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function renderShopTrackBadge(itemId: string): string {
  if (!isBuildTrackedItem(itemId)) return "";
  return `<span class="shop-track-badge" title="Нужен для отслеживаемого билда" aria-hidden="true">🎯</span>`;
}

function getShopCardTrackExtraClasses(itemId: string): string {
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
