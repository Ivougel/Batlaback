// Transpiled from TypeScript — npm run compile:ts

function shouldApplyMetaItemUnlockForHero(_heroClass) {
  if (typeof isMaxAccountMode === "function" && isMaxAccountMode()) return false;
  if (typeof MetaProgress === "undefined" || !MetaProgress.isActiveForRun()) return false;
  if (typeof isClassicMode === "function" && isClassicMode()) return false;
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
    showDescription: true
  };
  if (!def || !itemId) return base;
  const classId = heroClass || opts.heroClass || (typeof pendingPlayerClass !== "undefined" ? pendingPlayerClass : null) || (typeof playerClass !== "undefined" ? playerClass : null);
  const applyUnlock = opts.forceMetaUnlock ?? shouldApplyMetaItemUnlockForHero(classId);
  if (!applyUnlock || typeof MetaProgress === "undefined" || !classId) return base;
  if (MetaProgress.isItemUnlocked(itemId, classId)) return base;
  return {
    locked: true,
    hint: MetaProgress.getItemUnlockHint(itemId, classId) || "\u0417\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043E",
    showStats: false,
    showName: true,
    showDescription: false
  };
}
function buildLockedItemTooltipLines(def, presentation) {
  const name = typeof getItemDisplayName === "function" ? getItemDisplayName(def) : def.name;
  const lines = [
    {
      text: `\u{1F512} ${getItemIcons(def).join("")} ${name}`,
      style: "title",
      color: "#8b949e"
    },
    {
      text: presentation.hint,
      style: "normal",
      color: "#f0b86e"
    },
    {
      text: "\u042D\u0444\u0444\u0435\u043A\u0442\u044B \u043E\u0442\u043A\u0440\u043E\u044E\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u0440\u0430\u0437\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0438",
      style: "sub",
      color: "#6e7681"
    }
  ];
  if ((def.cost ?? 0) > 0) {
    lines.push({
      text: `${def.cost}\u{1F4B0} \xB7 \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u0441\u043B\u0435 \u0440\u0430\u0437\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0438 \u0432 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0435`,
      style: "sub",
      color: "#6e7681"
    });
  }
  return lines;
}
window.shouldApplyMetaItemUnlockForHero = shouldApplyMetaItemUnlockForHero;
window.getItemPresentationState = getItemPresentationState;
window.buildLockedItemTooltipLines = buildLockedItemTooltipLines;
