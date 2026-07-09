/**
 * Состояние отображения предмета (unlock / locked tooltips).
 */
function shouldApplyMetaItemUnlockForHero(heroClass) {
  if (typeof MetaProgress === "undefined" || !MetaProgress.isActiveForRun()) return false;
  if (typeof isClassicMode === "function" && isClassicMode()) return true;
  if (typeof isPathMode === "function" && isPathMode()) return true;
  return false;
}

function getItemPresentationState(itemId, heroClass, opts = {}) {
  const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[itemId] : null;
  const base = {
    locked: false,
    hint: "",
    showStats: true,
    showName: true,
    showDescription: true,
  };
  if (!def || !itemId) return base;

  const classId = heroClass
    || opts.heroClass
    || (typeof pendingPlayerClass !== "undefined" ? pendingPlayerClass : null)
    || (typeof playerClass !== "undefined" ? playerClass : null);

  const applyUnlock = opts.forceMetaUnlock ?? shouldApplyMetaItemUnlockForHero(classId);
  if (!applyUnlock || typeof MetaProgress === "undefined") return base;

  if (MetaProgress.isItemUnlocked(itemId, classId)) return base;

  return {
    locked: true,
    hint: MetaProgress.getItemUnlockHint(itemId, classId) || "Заблокировано",
    showStats: false,
    showName: true,
    showDescription: false,
  };
}

function buildLockedItemTooltipLines(def, presentation) {
  const name = typeof getItemDisplayName === "function" ? getItemDisplayName(def) : def.name;
  const lines = [
    {
      text: `🔒 ${getItemIcons(def).join("")} ${name}`,
      style: "title",
      color: "#8b949e",
    },
    {
      text: presentation.hint,
      style: "normal",
      color: "#f0b86e",
    },
    {
      text: "Эффекты откроются после разблокировки",
      style: "sub",
      color: "#6e7681",
    },
  ];
  if (def.cost > 0) {
    lines.push({
      text: `${def.cost}💰 · только после разблокировки в магазине`,
      style: "sub",
      color: "#6e7681",
    });
  }
  return lines;
}

window.shouldApplyMetaItemUnlockForHero = shouldApplyMetaItemUnlockForHero;
window.getItemPresentationState = getItemPresentationState;
window.buildLockedItemTooltipLines = buildLockedItemTooltipLines;
