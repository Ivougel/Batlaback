/** Фильтр камней (gem) — механика сокетов отключена. */

export function isStandaloneGemstoneItem(item) {
  if (!item?.id) return false;
  if (/^(chipped|flawed|regular|flawless|perfect)_(ruby|sapphire|emerald|topaz|amethyst)$/.test(item.id)) {
    return true;
  }
  if (item.id === "charge_gem") return true;
  const tags = item.tags || [];
  return tags.includes("gem")
    && !tags.includes("weapon")
    && !tags.includes("magic")
    && !tags.includes("utility");
}

export function stripGemFromCatalogItem(item) {
  const next = { ...item, sockets: 0 };
  if (Array.isArray(next.tags) && next.tags.includes("gem")) {
    next.tags = next.tags.filter((t) => t !== "gem");
  }
  if (Array.isArray(next.metaEffects)) {
    next.metaEffects = next.metaEffects.filter((e) => e.tag !== "gem" && e.type !== "generate_gem" && e.type !== "gem_if_godly");
  }
  return next;
}

export function filterCatalogItems(items) {
  return items
    .filter((item) => !isStandaloneGemstoneItem(item))
    .map(stripGemFromCatalogItem);
}
