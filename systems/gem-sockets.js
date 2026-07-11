// Transpiled from TypeScript — npm run compile:ts

function isGemItem(_itemId) {
  return false;
}
function getItemSocketCount(_itemId) {
  return 0;
}
function ensureSocketArray(item) {
  return item;
}
function canSocketGem(_hostItem, _gemId) {
  return false;
}
function socketGemIntoItem(_hostItem, _gemId) {
  return null;
}
function findSocketHostAt(_items, _col, _row, _gemId, _excludeUid) {
  return null;
}
function getSocketBattleEffects(_item) {
  return [];
}
function getBattleEffectsForItem(item) {
  const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[item?.itemId] : null;
  return def?.effects || [];
}
function formatSocketedGemsLine(_item) {
  return null;
}
function initPlacedItemSockets(item) {
  return item;
}
function getPlacedItemVisualLayout(_item, def) {
  return { iconSlots: [], gemSlots: [] };
}
function getGemCellVisualMap(_item, _def) {
  return /* @__PURE__ */ new Map();
}
window.isGemItem = isGemItem;
window.getItemSocketCount = getItemSocketCount;
window.ensureSocketArray = ensureSocketArray;
window.canSocketGem = canSocketGem;
window.socketGemIntoItem = socketGemIntoItem;
window.findSocketHostAt = findSocketHostAt;
window.getSocketBattleEffects = getSocketBattleEffects;
window.getBattleEffectsForItem = getBattleEffectsForItem;
window.formatSocketedGemsLine = formatSocketedGemsLine;
window.initPlacedItemSockets = initPlacedItemSockets;
window.getPlacedItemVisualLayout = getPlacedItemVisualLayout;
window.getGemCellVisualMap = getGemCellVisualMap;
