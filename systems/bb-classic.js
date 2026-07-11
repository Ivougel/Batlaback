/**
 * Classic Backpack Battles — fidelity mode без мутаций, спутников и кастомных shop-роллов.
 */
const BB_CLASSIC_MODE_ID = "classic";

function isClassicGameMode(modeId) {
  return modeId === BB_CLASSIC_MODE_ID;
}

function isClassicMode() {
  if (typeof selectedGameMode !== "undefined" && selectedGameMode) {
    return isClassicGameMode(selectedGameMode);
  }
  if (typeof gameMode !== "undefined" && gameMode) {
    return isClassicGameMode(gameMode);
  }
  const dm = typeof document !== "undefined" ? document.documentElement?.dataset?.gameMode : null;
  return dm === BB_CLASSIC_MODE_ID;
}

function usesMetaItemUnlock(modeId) {
  return modeId === "path";
}

function shouldUseMutationSystem() {
  return !isClassicMode();
}

function shouldUseCustomShopRolls() {
  return !isClassicMode();
}

function shouldFilterToPool120() {
  return !isClassicMode();
}

function getPrepShopSlotCount() {
  return 5;
}

function shouldSkipCompanionIntro() {
  if (typeof shouldSkipBBCompanionIntro === "function" && shouldSkipBBCompanionIntro()) {
    return true;
  }
  return isClassicMode();
}

/**
 * Classic = «max account»: все герои и предметы открыты (meta + craft).
 * Meta-lock и pool120 не применяются; craft-only и craft-outputs — не в магазине.
 */
function isMaxAccountMode() {
  return isClassicMode();
}

/** Classic — без боевых бонусов класса и стартового оружия. */
function shouldUseClassSystem() {
  return !isClassicMode();
}

/** «Только: класс X» на экипировку — работает и в classic (max account ≠ снятие ограничений). */
function shouldApplyClassItemRestriction() {
  return true;
}

/** Classic — героя выбираем для портрета и class-restricted экипировки. */
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
window.isClassicGameMode = isClassicGameMode;
window.isClassicMode = isClassicMode;
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
