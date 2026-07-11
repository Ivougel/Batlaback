/**
 * Русские строки предметов для тултипов (из ITEM_CATALOG).
 */

type CatalogDef = { id?: string; name?: string; description?: string; buildHints?: string };

function getItemDisplayName(def: CatalogDef | null | undefined): string {
  return def?.name || def?.id || "";
}

function getItemTooltipDescription(def: CatalogDef | null | undefined): string {
  const raw = def?.description || "";
  return typeof normalizeMechanicTags === "function" ? normalizeMechanicTags(raw) : raw;
}

function getItemBuildHints(def: CatalogDef | null | undefined): string {
  const raw = def?.buildHints || "";
  return typeof normalizeMechanicTags === "function" ? normalizeMechanicTags(raw) : raw;
}

function localizeSynergyDesc(desc: string): string {
  const raw = desc || "";
  return typeof normalizeMechanicTags === "function" ? normalizeMechanicTags(raw) : raw;
}

function formatTooltipMechanicText(text: unknown): string {
  if (typeof formatMechanicTagsHtml === "function") {
    return formatMechanicTagsHtml(text, { normalize: false });
  }
  return typeof escapeTooltipHtml === "function" ? escapeTooltipHtml(text) : String(text ?? "");
}
