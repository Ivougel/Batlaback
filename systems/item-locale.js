/**
 * Русские строки предметов для тултипов (из ITEM_CATALOG).
 */

function getItemDisplayName(def) {
  return def?.name || def?.id || "";
}

function getItemTooltipDescription(def) {
  const raw = def?.description || "";
  return typeof normalizeMechanicTags === "function" ? normalizeMechanicTags(raw) : raw;
}

function getItemBuildHints(def) {
  const raw = def?.buildHints || "";
  return typeof normalizeMechanicTags === "function" ? normalizeMechanicTags(raw) : raw;
}

function localizeSynergyDesc(desc) {
  const raw = desc || "";
  return typeof normalizeMechanicTags === "function" ? normalizeMechanicTags(raw) : raw;
}

function formatTooltipMechanicText(text) {
  if (typeof formatMechanicTagsHtml === "function") {
    return formatMechanicTagsHtml(text, { normalize: false });
  }
  return typeof escapeTooltipHtml === "function" ? escapeTooltipHtml(text) : String(text ?? "");
}
