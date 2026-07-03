/**
 * Движок рюкзака: контейнеры на поле + единое пространство слотов для предметов.
 * Сумка 3×3 и рюкзак 1×3 образуют общее поле (например 4×3), через границу можно ставить длинные предметы.
 */

const STRONG_OFFSETS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const WEAK_OFFSETS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

function getStarterBagOrigin(gridW = 7, gridH = 9, bagW = 3, bagH = 3) {
  return {
    col: Math.floor((gridW - bagW) / 2),
    row: Math.floor((gridH - bagH) / 2),
  };
}

function isBoardCellAvailable(col, row, gridW, gridH) {
  return col >= 0 && col < gridW && row >= 0 && row < gridH;
}

function isContainerItem(itemId) {
  return !!ITEM_CATALOG[itemId]?.isContainer;
}

function getInternalSize(def, rotation = 0) {
  const r = ((rotation % 4) + 4) % 4;
  let w = def.internalCols;
  let h = def.internalRows;
  if (r === 1 || r === 3) [w, h] = [h, w];
  return { w, h };
}

function rotateShape(shape, times = 1) {
  const base = typeof normalizeItemShape === "function"
    ? normalizeItemShape(shape)
    : (Array.isArray(shape) && shape.length ? shape : [[0, 0]]);
  let cells = base.map(([x, y]) => [x, y]);
  const t = ((times % 4) + 4) % 4;
  for (let i = 0; i < t; i++) {
    cells = cells.map(([x, y]) => [y, -x]);
    cells = normalizeShape(cells);
  }
  return cells;
}

function normalizeShape(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => [x - minX, y - minY]);
}

function getItemCells(item) {
  const def = ITEM_CATALOG[item.itemId];
  const shape = rotateShape(def.shape, item.rotation || 0);
  return shape.map(([dx, dy]) => [item.col + dx, item.row + dy]);
}

/** Клетка-якорь: иконка всегда по центру этого квадрата, не всей фигуры. */
function getItemIconCell(item) {
  return [item.col, item.row];
}

/** Смещение якорной клетки в повёрнутой shape (после normalize всегда есть [0,0]). */
function getShapeAnchorOffset(shape) {
  return shape.find(([dx, dy]) => dx === 0 && dy === 0) || [0, 0];
}

function getContainerBounds(container) {
  const cells = getItemCells(container);
  return {
    minCol: Math.min(...cells.map(([c]) => c)),
    maxCol: Math.max(...cells.map(([c]) => c)),
    minRow: Math.min(...cells.map(([, r]) => r)),
    maxRow: Math.max(...cells.map(([, r]) => r)),
  };
}

function createPlacedItem(itemId, col, row, rotation = 0) {
  const item = {
    uid: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    itemId,
    col: Number(col) || 0,
    row: Number(row) || 0,
    rotation: rotation || 0,
    runtime: null,
  };
  return typeof initPlacedItemSockets === "function" ? initPlacedItemSockets(item) : item;
}

function createContainer(itemId, col, row, rotation = 0) {
  return {
    uid: `container-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    itemId,
    col: Number(col) || 0,
    row: Number(row) || 0,
    rotation: rotation || 0,
  };
}

function createStartingContainers(gridW = 7, gridH = 9) {
  const { col, row } = getStarterBagOrigin(gridW, gridH);
  return [createContainer("starter_bag", col, row, 0)];
}

function createEmptyLoadout() {
  return { containers: createStartingContainers(), items: [] };
}

/** Все клетки, куда можно класть предметы (объединение контейнеров). */
function buildSlotSet(containers) {
  const set = new Set();
  containers.forEach((container) => {
    getItemCells(container).forEach(([c, r]) => set.add(`${c},${r}`));
  });
  return set;
}

/** Клетки, которые рисуем в компактном режиме: только слоты контейнеров. */
function buildActiveVisualCellSet(containers, items) {
  void items;
  return buildSlotSet(containers);
}

/** Контейнер из магазина, расширяющий поле (не стартовая сумка). */
function isShopExpansionContainer(itemId) {
  const def = ITEM_CATALOG[itemId];
  return !!def?.isContainer && !!def?.shopContainer && !def?.immovable;
}

function isSlotCell(containers, col, row) {
  return buildSlotSet(containers).has(`${col},${row}`);
}

function buildItemOccupancyMap(items, excludeUid = null) {
  const map = new Map();
  items.forEach((item) => {
    if (item.uid === excludeUid) return;
    getItemCells(item).forEach(([c, r]) => map.set(`${c},${r}`, item.uid));
  });
  return map;
}

function buildContainerOccupancyMap(containers, excludeUid = null) {
  const map = new Map();
  containers.forEach((container) => {
    if (container.uid === excludeUid) return;
    getItemCells(container).forEach(([c, r]) => map.set(`${c},${r}`, container.uid));
  });
  return map;
}

function canPlaceContainer(itemId, col, row, rotation, gridW, gridH, containers, excludeUid = null, items = null) {
  const def = ITEM_CATALOG[itemId];
  if (!def?.isContainer) return false;
  const shape = rotateShape(def.shape, rotation || 0);
  const occupied = buildContainerOccupancyMap(containers, excludeUid);
  const itemOccupied = items ? buildItemOccupancyMap(items) : null;
  return shape.every(([dx, dy]) => {
    const c = col + dx;
    const r = row + dy;
    if (!isBoardCellAvailable(c, r, gridW, gridH)) return false;
    if (occupied.has(`${c},${r}`)) return false;
    if (itemOccupied?.has(`${c},${r}`)) return false;
    return true;
  });
}

function canPlaceInLoadout(itemId, col, row, rotation, containers, items, excludeUid = null) {
  const def = ITEM_CATALOG[itemId];
  if (!def || def.isContainer) return false;
  if (typeof canPlaceEnhancementItemInLoadout === "function"
    && !canPlaceEnhancementItemInLoadout(itemId, items, excludeUid)) {
    return false;
  }
  if (typeof canAddSlotItemToLoadout === "function"
    && !canAddSlotItemToLoadout(items, itemId, excludeUid)) {
    return false;
  }
  const slots = buildSlotSet(containers);
  const occupied = buildItemOccupancyMap(items, excludeUid);
  const shape = rotateShape(def.shape, rotation || 0);
  return shape.every(([dx, dy]) => {
    const c = col + dx;
    const r = row + dy;
    return slots.has(`${c},${r}`) && !occupied.has(`${c},${r}`);
  });
}

function resolveLoadoutPlacement(containers, items, itemId, hoverCol, hoverRow, rotation, excludeUid = null) {
  const def = ITEM_CATALOG[itemId];
  if (!def || def.isContainer) {
    return { valid: false, col: hoverCol, row: hoverRow, rotation: 0 };
  }
  const slots = buildSlotSet(containers);
  const hc = hoverCol;
  const hr = hoverRow;
  if (!slots.has(`${hc},${hr}`)) {
    return { valid: false, col: hc, row: hr, rotation: rotation || 0 };
  }

  const startRot = ((rotation || 0) % 4 + 4) % 4;
  const rotations = [startRot];
  for (let r = 0; r < 4; r++) if (r !== startRot) rotations.push(r);

  for (const rot of rotations) {
    const shape = rotateShape(def.shape, rot);
    for (const [dx, dy] of shape) {
      const anchorCol = hc - dx;
      const anchorRow = hr - dy;
      if (canPlaceInLoadout(itemId, anchorCol, anchorRow, rot, containers, items, excludeUid)) {
        return { valid: true, col: anchorCol, row: anchorRow, rotation: rot };
      }
    }
  }

  return { valid: false, col: hc, row: hr, rotation: startRot };
}

function canPlaceInLoadoutOnSlots(itemId, col, row, rotation, containers) {
  const def = ITEM_CATALOG[itemId];
  if (!def || def.isContainer) return false;
  const slots = buildSlotSet(containers);
  const shape = rotateShape(def.shape, rotation || 0);
  return shape.every(([dx, dy]) => slots.has(`${col + dx},${row + dy}`));
}

/** Размещение с вытеснением: занятые клетки допустимы, конфликтующие предметы уходят на скамейку. */
function resolveLoadoutPlacementDisplacing(containers, itemId, hoverCol, hoverRow, rotation) {
  const def = ITEM_CATALOG[itemId];
  if (!def || def.isContainer) {
    return { valid: false, col: hoverCol, row: hoverRow, rotation: 0 };
  }
  const slots = buildSlotSet(containers);
  const hc = hoverCol;
  const hr = hoverRow;
  if (!slots.has(`${hc},${hr}`)) {
    return { valid: false, col: hc, row: hr, rotation: rotation || 0 };
  }

  const startRot = ((rotation || 0) % 4 + 4) % 4;
  const rotations = [startRot];
  for (let r = 0; r < 4; r++) if (r !== startRot) rotations.push(r);

  for (const rot of rotations) {
    const shape = rotateShape(def.shape, rot);
    for (const [dx, dy] of shape) {
      const anchorCol = hc - dx;
      const anchorRow = hr - dy;
      if (canPlaceInLoadoutOnSlots(itemId, anchorCol, anchorRow, rot, containers)) {
        return { valid: true, col: anchorCol, row: anchorRow, rotation: rot };
      }
    }
  }

  return { valid: false, col: hc, row: hr, rotation: startRot };
}

function findItemAtSlot(items, col, row) {
  return items.find((item) => getItemCells(item).some(([c, r]) => c === col && r === row)) || null;
}

function findContainerAtCell(containers, col, row) {
  return containers.find((container) =>
    getItemCells(container).some(([c, r]) => c === col && r === row),
  ) || null;
}

function getOverlappingLoadoutItems(items, itemId, col, row, rotation, excludeUid = null) {
  const shape = rotateShape(ITEM_CATALOG[itemId].shape, rotation || 0);
  const newCells = new Set(shape.map(([dx, dy]) => `${col + dx},${row + dy}`));
  return items.filter((item) => {
    if (item.uid === excludeUid) return false;
    return getItemCells(item).some(([c, r]) => newCells.has(`${c},${r}`));
  });
}

function getItemsTouchingContainer(items, container) {
  const cellSet = new Set(getItemCells(container).map(([c, r]) => `${c},${r}`));
  return items.filter((item) => getItemCells(item).some(([c, r]) => cellSet.has(`${c},${r}`)));
}

function translateItems(items, dCol, dRow, itemUids) {
  const uidSet = new Set(itemUids);
  return items.map((item) => {
    if (!uidSet.has(item.uid)) return item;
    return { ...item, col: item.col + dCol, row: item.row + dRow };
  });
}

function validateLoadoutItems(containers, items) {
  const slots = buildSlotSet(containers);
  const occupied = new Map();
  for (const item of items) {
    for (const [c, r] of getItemCells(item)) {
      if (!slots.has(`${c},${r}`)) return false;
      const key = `${c},${r}`;
      if (occupied.has(key)) return false;
      occupied.set(key, item.uid);
    }
  }
  return true;
}

function canMoveContainerWithItems(container, newCol, newRow, containers, items, excludeUid, gridW, gridH) {
  if (!canPlaceContainer(container.itemId, newCol, newRow, container.rotation || 0, gridW, gridH, containers, excludeUid)) {
    return false;
  }
  const dCol = newCol - container.col;
  const dRow = newRow - container.row;
  const touched = getItemsTouchingContainer(items, container);
  const movedItems = translateItems(items, dCol, dRow, touched.map((i) => i.uid));
  const movedContainers = containers.map((c) =>
    c.uid === excludeUid ? { ...c, col: newCol, row: newRow } : c,
  );
  return validateLoadoutItems(movedContainers, movedItems);
}

function applyClassStarters(containers, items, classId) {
  const cls = getClassById(classId);
  if (!cls) return [...items];
  const next = [...items];
  cls.starterItems.forEach((itemId) => {
    const spot = findLoadoutItemPlacement(containers, next, itemId, 0);
    if (spot) next.push(createPlacedItem(itemId, spot.col, spot.row, spot.rotation));
  });
  return next;
}

function flattenContainersForBattle(containers, items) {
  return items.map((item) => ({ ...item }));
}

function getAllContents(items) {
  return items;
}

function applySynergyModifiersToContainers(containers, items) {
  applySynergyModifiers(items);
  return items;
}

function collectActiveSynergyDescriptions(containers, items) {
  const seen = new Set();
  const list = [];
  items.forEach((item) => {
    (item.runtime?.activeSynergies || []).forEach((s) => {
      const key = `${item.uid}:${s.desc}`;
      if (seen.has(key)) return;
      seen.add(key);
      list.push({ itemName: ITEM_CATALOG[item.itemId].name, desc: s.desc });
    });
  });
  return list;
}

function getSlotBounds(containers) {
  const slots = buildSlotSet(containers);
  if (!slots.size) return null;
  let minCol = Infinity;
  let maxCol = -Infinity;
  let minRow = Infinity;
  let maxRow = -Infinity;
  slots.forEach((key) => {
    const [c, r] = key.split(",").map(Number);
    minCol = Math.min(minCol, c);
    maxCol = Math.max(maxCol, c);
    minRow = Math.min(minRow, r);
    maxRow = Math.max(maxRow, r);
  });
  return { minCol, maxCol, minRow, maxRow, count: slots.size };
}

function getAdjacentItems(items, sourceItem) {
  const sourceCells = getItemCells(sourceItem);
  const sourceSet = new Set(sourceCells.map(([c, r]) => `${c},${r}`));
  const result = new Map();

  items.forEach((other) => {
    if (other.uid === sourceItem.uid) return;
    const otherCells = getItemCells(other);
    const otherSet = new Set(otherCells.map(([c, r]) => `${c},${r}`));
    let strong = false;
    let weak = false;

    sourceCells.forEach(([sc, sr]) => {
      STRONG_OFFSETS.forEach(([dx, dy]) => {
        if (otherSet.has(`${sc + dx},${sr + dy}`)) strong = true;
      });
      WEAK_OFFSETS.forEach(([dx, dy]) => {
        if (otherSet.has(`${sc + dx},${sr + dy}`)) weak = true;
      });
    });

    if (strong || weak) result.set(other.uid, { item: other, strong, weak });
  });

  return result;
}

function itemHasTag(itemId, tags) {
  const def = ITEM_CATALOG[itemId];
  return tags.some((t) => def.tags.includes(t));
}

function neighborMatchesRule(entry, rule) {
  if (rule.adjacency === "strong") return entry.strong && itemHasTag(entry.item.itemId, rule.neighborTags);
  if (rule.adjacency === "weak") return entry.weak && itemHasTag(entry.item.itemId, rule.neighborTags);
  if (rule.adjacency === "both") {
    return (entry.strong || entry.weak) && itemHasTag(entry.item.itemId, rule.neighborTags);
  }
  return false;
}

function createRuntimeState(item) {
  return {
    cooldownMult: 1,
    damageBonus: 0,
    healBonus: 0,
    blockBonus: 0,
    poisonBonus: 0,
    blockSourceEfficiency: 1,
    duplicateEfficiency: 1,
    poisonSourceEfficiency: 1,
    grantBlockBuffEfficiency: 1,
    blockBuffGiven: 0,
    pendingAttackBuff: 0,
    grantBlockBuff: null,
    activeSynergies: [],
  };
}

function applySynergyModifiers(items) {
  items.forEach((item) => {
    item.runtime = createRuntimeState(item);
  });

  items.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    if (!def.synergies?.length) return;
    const neighbors = getAdjacentItems(items, item);
    def.synergies.forEach((rule) => {
      neighbors.forEach((entry) => {
        if (!neighborMatchesRule(entry, rule)) return;
        const targetItem = rule.target === "neighbor" ? entry.item : item;
        if (!targetItem.runtime) targetItem.runtime = createRuntimeState(targetItem);
        applySynergyEffect(rule, item, targetItem, entry);
        targetItem.runtime.activeSynergies.push({ from: def.name, desc: rule.desc });
      });
    });
  });

  items.forEach((item) => {
    if (typeof clampItemRuntimeBonuses === "function") clampItemRuntimeBonuses(item);
  });

  return items;
}

function applySynergyEffect(rule, sourceItem, targetItem, neighborEntry) {
  const { apply } = rule;
  const rt = targetItem.runtime;
  switch (apply.type) {
    case "cooldownReduction":
      rt.cooldownMult *= 1 - apply.value;
      if (typeof clampCooldownMult === "function") {
        rt.cooldownMult = clampCooldownMult(rt.cooldownMult);
      }
      break;
    case "damageBonus":
      rt.damageBonus += apply.value;
      break;
    case "healBonus":
      rt.healBonus += apply.value;
      break;
    case "blockBonus":
      rt.blockBonus += apply.value;
      break;
    case "grantBlockBuff":
      rt.grantBlockBuff = {
        value: apply.value,
        buffTargetTags: apply.buffTargetTags,
        cap: apply.cap,
        sourceUid: sourceItem.uid,
      };
      break;
    case "poisonBonus":
      rt.poisonBonus += apply.value;
      rt.poisonBonus = Math.min(rt.poisonBonus, typeof MAX_POISON_BONUS_PER_ITEM !== "undefined"
        ? MAX_POISON_BONUS_PER_ITEM
        : 4);
      break;
    default:
      break;
  }
}

function sortItemsForBattle(items) {
  return [...items].sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col));
}

function getEffectiveCooldown(item) {
  const def = ITEM_CATALOG[item.itemId];
  return (def.cooldown || 0) * (item.runtime?.cooldownMult ?? 1);
}

function findContainerPlacement(gridW, gridH, containers, itemId, items = null) {
  for (let rotation = 0; rotation < 4; rotation++) {
    for (let row = 0; row < gridH; row++) {
      for (let col = 0; col < gridW; col++) {
        if (canPlaceContainer(itemId, col, row, rotation, gridW, gridH, containers, null, items)) {
          return { col, row, rotation };
        }
      }
    }
  }
  return null;
}

/** Лучшее место рядом с кластером контейнеров (как в Backpack Battles). */
function findAdjacentContainerSpot(containers, gridW, gridH, itemId, items = null) {
  if (!containers.length) return findContainerPlacement(gridW, gridH, containers, itemId, items);

  const tried = new Set();
  const candidates = [];

  containers.forEach((container) => {
    const bounds = getContainerBounds(container);
    const sides = [
      { col: bounds.maxCol + 1, row: bounds.minRow, rotation: 0 },
      { col: bounds.minCol - 1, row: bounds.minRow, rotation: 0 },
      { col: bounds.minCol, row: bounds.maxRow + 1, rotation: 1 },
      { col: bounds.minCol, row: bounds.minRow - 1, rotation: 1 },
      { col: bounds.maxCol + 1, row: bounds.maxRow, rotation: 0 },
      { col: bounds.minCol - 1, row: bounds.maxRow, rotation: 0 },
    ];

    sides.forEach((spot) => {
      const key = `${spot.col},${spot.row},${spot.rotation}`;
      if (tried.has(key)) return;
      tried.add(key);
      if (canPlaceContainer(itemId, spot.col, spot.row, spot.rotation, gridW, gridH, containers, null, items)) {
        candidates.push(spot);
      }
    });
  });

  if (!candidates.length) return findContainerPlacement(gridW, gridH, containers, itemId, items);

  const clusterBounds = getSlotBounds(containers);
  candidates.sort((a, b) => {
    const score = (spot) => {
      const cells = getItemCells({ itemId, col: spot.col, row: spot.row, rotation: spot.rotation });
      const centerCol = cells.reduce((s, [c]) => s + c, 0) / cells.length;
      const centerRow = cells.reduce((s, [, r]) => s + r, 0) / cells.length;
      const midCol = (clusterBounds.minCol + clusterBounds.maxCol) / 2;
      const midRow = (clusterBounds.minRow + clusterBounds.maxRow) / 2;
      return Math.abs(centerCol - midCol) + Math.abs(centerRow - midRow);
    };
    return score(a) - score(b);
  });

  return candidates[0];
}

/** @deprecated используйте findAdjacentContainerSpot */
function findAdjacentBackpackSpot(containers, gridW, gridH) {
  return findAdjacentContainerSpot(containers, gridW, gridH, "backpack");
}

function findLoadoutItemPlacement(containers, items, itemId, rotation) {
  const slots = buildSlotSet(containers);
  const startRot = ((rotation || 0) % 4 + 4) % 4;
  const rotations = [startRot, 0, 1, 2, 3].filter((r, i, a) => a.indexOf(r) === i);

  for (const rot of rotations) {
    const shape = rotateShape(ITEM_CATALOG[itemId].shape, rot);
    const slotList = [...slots].map((k) => k.split(",").map(Number));
    for (const [col, row] of slotList) {
      if (canPlaceInLoadout(itemId, col, row, rot, containers, items)) {
        return { col, row, rotation: rot };
      }
    }
  }
  return null;
}

/** Награда после раунда: автоматически ставит сумку рядом с инвентарём. */
function grantBagReward(containers, roundNum, gridW, gridH, items = []) {
  if (!shouldGrantBagReward(roundNum)) return { granted: false, containers, bagId: null };

  const bagId = pickBagRewardId(roundNum);
  const spot = findAdjacentContainerSpot(containers, gridW, gridH, bagId, items);
  if (!spot) return { granted: false, containers, bagId: null };

  return {
    granted: true,
    bagId,
    containers: [...containers, createContainer(bagId, spot.col, spot.row, spot.rotation || 0)],
  };
}

/** @deprecated используйте grantBagReward */
function grantBackpackReward(containers, roundNum, gridW, gridH) {
  return grantBagReward(containers, roundNum, gridW, gridH);
}
