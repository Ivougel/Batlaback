/**
 * Русские строки предметов для тултипов (из ITEM_CATALOG).
 */

function getItemDisplayName(def) {
  return def?.name || def?.id || "";
}

function getItemTooltipDescription(def) {
  return def?.description || "";
}

function getItemBuildHints(def) {
  return def?.buildHints || "";
}

function localizeSynergyDesc(desc) {
  return desc || "";
}
