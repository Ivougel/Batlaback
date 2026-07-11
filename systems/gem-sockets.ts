/**
 * Gem/sockets — отключено. Заглушки для совместимости с prep/battle UI.
 */

type SocketedItem = {
  uid?: string;
  itemId: string;
  col?: number;
  row?: number;
  socketedGems?: Array<string | null>;
};

function isGemItem(_itemId?: string | null): boolean {
  return false;
}

function getItemSocketCount(_itemId?: string): number {
  return 0;
}

function ensureSocketArray(item: SocketedItem): SocketedItem {
  return item;
}

function canSocketGem(_hostItem: SocketedItem, _gemId: string): boolean {
  return false;
}

function socketGemIntoItem(_hostItem: SocketedItem, _gemId: string): SocketedItem | null {
  return null;
}

function findSocketHostAt(
  _items: SocketedItem[],
  _col: number,
  _row: number,
  _gemId: string,
  _excludeUid?: string | null,
): SocketedItem | null {
  return null;
}

function getSocketBattleEffects(_item: SocketedItem): Array<Record<string, unknown>> {
  return [];
}

function getBattleEffectsForItem(item: SocketedItem): Array<Record<string, unknown>> {
  const def = typeof ITEM_CATALOG !== "undefined" ? ITEM_CATALOG[item?.itemId] : null;
  return def?.effects || [];
}

function formatSocketedGemsLine(_item: SocketedItem): string | null {
  return null;
}

function initPlacedItemSockets(item: SocketedItem): SocketedItem {
  return item;
}

function getPlacedItemVisualLayout(
  _item: SocketedItem,
  def?: { tags?: string[]; icon?: string },
): { iconSlots: Array<{ cell: [number, number]; icons: string[]; useShapeBounds?: boolean }>; gemSlots: never[] } {
  return { iconSlots: [], gemSlots: [] };
}

function getGemCellVisualMap(
  _item: SocketedItem,
  _def?: { tags?: string[] },
): Map<string, { gemId?: string; emptySocket?: boolean }> {
  return new Map();
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
