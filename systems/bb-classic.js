/**
 * Classic Backpack Battles — fidelity mode без мутаций, спутников и кастомных shop-роллов.
 * Hotseat использует те же правила экономики/магазина, но PvP pass-and-play.
 */
const BB_CLASSIC_MODE_ID = "classic";
const BB_HOTSEAT_MODE_ID = "hotseat";

function getActiveGameModeId() {
  if (typeof selectedGameMode !== "undefined" && selectedGameMode) {
    return selectedGameMode;
  }
  if (typeof gameMode !== "undefined" && gameMode) {
    return gameMode;
  }
  const dm = typeof document !== "undefined" ? document.documentElement?.dataset?.gameMode : null;
  return dm || null;
}

function isClassicGameMode(modeId) {
  return modeId === BB_CLASSIC_MODE_ID;
}

function isHotseatGameMode(modeId) {
  return modeId === BB_HOTSEAT_MODE_ID;
}

function isClassicMode() {
  return isClassicGameMode(getActiveGameModeId());
}

function isHotseatMode() {
  return isHotseatGameMode(getActiveGameModeId());
}

/** Alias для существующего кода (craft-pending, VS overlay labels). */
function isVersusMode() {
  return isHotseatMode();
}

/** Classic + hotseat: max account, без мутаций/спутников, BB shop. */
function usesClassicRules() {
  const mode = getActiveGameModeId();
  return isClassicGameMode(mode) || isHotseatGameMode(mode);
}

function usesMetaItemUnlock(modeId) {
  return modeId === "path";
}

function shouldUseMutationSystem() {
  return !usesClassicRules();
}

function shouldUseCustomShopRolls() {
  return !usesClassicRules();
}

function shouldFilterToPool120() {
  return !usesClassicRules();
}

function getPrepShopSlotCount() {
  return 5;
}

function shouldSkipCompanionIntro() {
  if (typeof shouldSkipBBCompanionIntro === "function" && shouldSkipBBCompanionIntro()) {
    return true;
  }
  return usesClassicRules();
}

/**
 * Classic/hotseat = «max account»: все герои и предметы открыты (meta + craft).
 * Meta-lock и pool120 не применяются; craft-only и craft-outputs — не в магазине.
 */
function isMaxAccountMode() {
  return usesClassicRules();
}

/** Classic/hotseat — без боевых бонусов класса и стартового оружия. */
function shouldUseClassSystem() {
  return !usesClassicRules();
}

/** «Только: класс X» на экипировку — работает и в classic (max account ≠ снятие ограничений). */
function shouldApplyClassItemRestriction() {
  return true;
}

/** Classic/hotseat — героя выбираем для портрета и class-restricted экипировки. */
function shouldSkipClassIntro() {
  return false;
}

/** classId для shop/placement restrictions — выбранный герой. */
function getMechanicalClassId(classId) {
  return classId || null;
}

/** Только ⭐/◆ слоты (как в Backpack Battles). */
function shouldUseAdjacencySynergies() {
  return false;
}

window.BB_CLASSIC_MODE_ID = BB_CLASSIC_MODE_ID;
window.BB_HOTSEAT_MODE_ID = BB_HOTSEAT_MODE_ID;
window.getActiveGameModeId = getActiveGameModeId;
window.isClassicGameMode = isClassicGameMode;
window.isHotseatGameMode = isHotseatGameMode;
window.isClassicMode = isClassicMode;
window.isHotseatMode = isHotseatMode;
window.isVersusMode = isVersusMode;
window.usesClassicRules = usesClassicRules;
window.isMaxAccountMode = isMaxAccountMode;
window.usesMetaItemUnlock = usesMetaItemUnlock;
window.shouldUseMutationSystem = shouldUseMutationSystem;
window.shouldUseCustomShopRolls = shouldUseCustomShopRolls;
window.shouldFilterToPool120 = shouldFilterToPool120;
window.getPrepShopSlotCount = getPrepShopSlotCount;
window.shouldSkipCompanionIntro = shouldSkipCompanionIntro;
window.shouldUseClassSystem = shouldUseClassSystem;
window.shouldApplyClassItemRestriction = shouldApplyClassItemRestriction;
window.shouldSkipClassIntro = shouldSkipClassIntro;
window.getMechanicalClassId = getMechanicalClassId;
window.shouldUseAdjacencySynergies = shouldUseAdjacencySynergies;
