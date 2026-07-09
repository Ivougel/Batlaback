/**
 * Classic Backpack Battles — fidelity mode без мутаций, спутников и кастомных shop-роллов.
 */
const BB_CLASSIC_MODE_ID = "classic";

function isClassicGameMode(modeId) {
  return modeId === BB_CLASSIC_MODE_ID;
}

function isClassicMode() {
  if (typeof gameMode !== "undefined" && isClassicGameMode(gameMode)) return true;
  if (typeof selectedGameMode !== "undefined" && isClassicGameMode(selectedGameMode)) return true;
  const dm = typeof document !== "undefined" ? document.documentElement?.dataset?.gameMode : null;
  return dm === BB_CLASSIC_MODE_ID;
}

function usesMetaItemUnlock(modeId) {
  return modeId === BB_CLASSIC_MODE_ID || modeId === "path";
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
  return isClassicMode() ? 4 : 5;
}

function shouldSkipCompanionIntro() {
  return isClassicMode();
}

window.BB_CLASSIC_MODE_ID = BB_CLASSIC_MODE_ID;
window.isClassicGameMode = isClassicGameMode;
window.isClassicMode = isClassicMode;
window.usesMetaItemUnlock = usesMetaItemUnlock;
window.shouldUseMutationSystem = shouldUseMutationSystem;
window.shouldUseCustomShopRolls = shouldUseCustomShopRolls;
window.shouldFilterToPool120 = shouldFilterToPool120;
window.getPrepShopSlotCount = getPrepShopSlotCount;
window.shouldSkipCompanionIntro = shouldSkipCompanionIntro;
