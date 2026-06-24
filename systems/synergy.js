/**
 * Система синергий — логика + состояние клеток инвентаря.
 */

const synergyState = {
  previewSynergies: [],
  activeSynergies: [],
  enemyActiveSynergies: [],
  activeSynergyCells: [],
  enemyActiveSynergyCells: [],
  previewSynergyCells: [],
  cellStates: new Map(),
  isDragging: false,
};

const SYNERGY_VISUAL = {
  NONE: "none",
  ACTIVE: "active",
  PREVIEW: "preview",
};

function formatSynergyBonus(rule) {
  const { apply } = rule;
  if (!apply) return rule.desc || "";
  switch (apply.type) {
    case "cooldownReduction":
      return `−${Math.round(apply.value * 100)}% кулдаун`;
    case "damageBonus":
      return `+${apply.value} урона`;
    case "healBonus":
      return `+${apply.value} лечения`;
    case "blockBonus":
      return `+${apply.value} блока`;
    case "poisonBonus":
      return `+${apply.value} яда`;
    case "grantBlockBuff":
      return `+${apply.value} атаки соседнему оружию`;
    default:
      return rule.desc || apply.type;
  }
}

function formatSynergyConditionFromRule(rule) {
  const adj = rule.adjacency === "weak" ? "диагонально" : "рядом";
  const tags = formatTagsList(rule.neighborTags || [], " / ");
  if (tags) return `${adj} с ${tags}`;
  return rule.desc || "";
}

function parseSynergyTexts(rule) {
  const effect = formatSynergyBonus(rule);
  if (rule.desc?.includes(":")) {
    const idx = rule.desc.indexOf(":");
    return {
      condition: rule.desc.slice(0, idx).trim(),
      effect: rule.desc.slice(idx + 1).trim() || effect,
    };
  }
  return {
    condition: formatSynergyConditionFromRule(rule),
    effect: effect || rule.desc || "",
  };
}

function inferSynergyType(itemA, itemB, rule) {
  const defA = ITEM_CATALOG[itemA.itemId];
  const defB = ITEM_CATALOG[itemB.itemId];
  const tags = [...(defA?.tags || []), ...(defB?.tags || [])];
  if (tags.includes("magic")) return "magic";
  if (tags.includes("weapon")) return "weapon";
  if (tags.includes("poison")) return "poison";
  if (tags.includes("armor")) return "armor";
  if (tags.includes("gem")) return "gem";
  if (rule?.neighborTags?.[0]) return rule.neighborTags[0];
  return "default";
}

function buildSynergyEntry(item, partner, rule) {
  const def = ITEM_CATALOG[item.itemId];
  const partnerDef = ITEM_CATALOG[partner.itemId];
  const texts = parseSynergyTexts(rule);
  return {
    items: [item.itemId, partner.itemId],
    itemUids: [item.uid, partner.uid],
    names: [def.name, partnerDef.name],
    icons: [def.icon, partnerDef.icon],
    condition: texts.condition,
    effect: texts.effect,
    bonus: texts.effect,
    desc: rule.desc,
    ruleId: rule.id,
    applyType: rule.apply?.type,
    type: inferSynergyType(item, partner, rule),
    strength: rule.adjacency === "strong" ? "strong" : "weak",
    status: SYNERGY_VISUAL.ACTIVE,
  };
}

/** Активные синергии для текущей расстановки. */
function collectActiveSynergies(items) {
  const result = [];
  const seen = new Set();

  items.forEach((item) => {
    const def = ITEM_CATALOG[item.itemId];
    if (!def?.synergies?.length) return;
    const neighbors = getAdjacentItems(items, item);

    def.synergies.forEach((rule) => {
      neighbors.forEach((entry) => {
        if (!neighborMatchesRule(entry, rule)) return;
        const partner = entry.item;
        const key = [item.uid, partner.uid].sort().join(":") + (rule.id || rule.desc);
        if (seen.has(key)) return;
        seen.add(key);
        result.push(buildSynergyEntry(item, partner, rule));
      });
    });
  });

  return result;
}

function cellKey(col, row) {
  return `${col},${row}`;
}

/** Клетки инвентаря, участвующие в синергии. */
function buildSynergyCellGroups(synergies, items, status) {
  const uidToItem = new Map(items.map((i) => [i.uid, i]));

  return (synergies || []).map((syn) => {
    const cells = [];
    const keys = new Set();
    syn.itemUids.forEach((uid) => {
      const item = uidToItem.get(uid);
      if (!item) return;
      getItemCells(item).forEach(([col, row]) => {
        const key = cellKey(col, row);
        if (keys.has(key)) return;
        keys.add(key);
        cells.push({ col, row, key, synergyActive: true });
      });
    });
    return {
      cells,
      type: syn.type || "default",
      strength: syn.strength || "strong",
      status,
      itemUids: syn.itemUids,
    };
  });
}

function rebuildCellStates(activeGroups, previewGroups) {
  const map = new Map();
  const previewKeys = new Set();
  (previewGroups || []).forEach((g) => {
    g.cells.forEach((c) => previewKeys.add(c.key));
  });

  (activeGroups || []).forEach((group) => {
    group.cells.forEach((cell) => {
      if (previewKeys.has(cell.key)) return;
      map.set(cell.key, {
        col: cell.col,
        row: cell.row,
        synergyActive: true,
        type: group.type,
        strength: group.strength,
        mode: SYNERGY_VISUAL.ACTIVE,
      });
    });
  });

  (previewGroups || []).forEach((group) => {
    group.cells.forEach((cell) => {
      map.set(cell.key, {
        col: cell.col,
        row: cell.row,
        synergyActive: true,
        type: group.type,
        strength: group.strength,
        mode: SYNERGY_VISUAL.PREVIEW,
      });
    });
  });

  synergyState.cellStates = map;
  return map;
}

function syncSynergyCellLayers(playerItems, enemyItems, previewItems, previewSynergies) {
  const previewUids = getSynergyInvolvedUids(previewSynergies);
  const activeFiltered = synergyState.activeSynergies.filter(
    (s) => !s.itemUids.some((u) => previewUids.has(u)),
  );

  synergyState.activeSynergyCells = buildSynergyCellGroups(
    activeFiltered,
    playerItems,
    SYNERGY_VISUAL.ACTIVE,
  );

  synergyState.enemyActiveSynergyCells = buildSynergyCellGroups(
    synergyState.enemyActiveSynergies,
    enemyItems || [],
    SYNERGY_VISUAL.ACTIVE,
  );

  synergyState.previewSynergyCells = previewSynergies.length && previewItems
    ? buildSynergyCellGroups(previewSynergies, previewItems, SYNERGY_VISUAL.PREVIEW)
    : [];

  rebuildCellStates(synergyState.activeSynergyCells, synergyState.previewSynergyCells);
}

function buildPreviewPlacement(containers, items, dragPayload, hoverSlot, dragFrom) {
  if (!dragPayload || !hoverSlot || isContainerItem(dragPayload.itemId)) return null;

  const excludeUid = dragFrom?.type === "item" ? dragFrom.item.uid : null;
  const placement = resolveLoadoutPlacement(
    containers,
    items,
    dragPayload.itemId,
    hoverSlot.col,
    hoverSlot.row,
    dragPayload.rotation || 0,
    excludeUid,
  );
  if (!placement.valid) return null;

  let previewItems = items.filter((i) => i.uid !== excludeUid);
  const previewItem = createPlacedItem(
    dragPayload.itemId,
    placement.col,
    placement.row,
    placement.rotation,
  );
  if (excludeUid) previewItem.uid = excludeUid;
  previewItems = [...previewItems, previewItem];
  applySynergyModifiers(previewItems);

  return { previewItems, previewUid: previewItem.uid, placement };
}

/** Обновить активные синергии (игрок + ИИ). */
function refreshActiveSynergies(playerItems, enemyItems = []) {
  synergyState.activeSynergies = collectActiveSynergies(playerItems).map((s) => ({
    ...s,
    status: SYNERGY_VISUAL.ACTIVE,
  }));
  synergyState.enemyActiveSynergies = collectActiveSynergies(enemyItems).map((s) => ({
    ...s,
    status: SYNERGY_VISUAL.ACTIVE,
  }));
  syncSynergyCellLayers(playerItems, enemyItems, null, synergyState.previewSynergies);
  return synergyState.activeSynergies;
}

/** Обновить preview-синергии (только пока предмет зажат над рюкзаком). */
function refreshPreviewSynergies(containers, playerItems, dragPayload, hoverSlot, dragFrom, enemyItems = []) {
  if (!synergyState.isDragging || !dragPayload || !hoverSlot) {
    synergyState.previewSynergies = [];
    syncSynergyCellLayers(playerItems, enemyItems, null, []);
    return null;
  }

  const built = buildPreviewPlacement(containers, playerItems, dragPayload, hoverSlot, dragFrom);
  if (!built) {
    synergyState.previewSynergies = [];
    syncSynergyCellLayers(playerItems, enemyItems, null, []);
    return null;
  }

  const all = collectActiveSynergies(built.previewItems);
  synergyState.previewSynergies = all
    .filter((s) => s.itemUids.includes(built.previewUid))
    .map((s) => ({ ...s, status: SYNERGY_VISUAL.PREVIEW }));

  syncSynergyCellLayers(playerItems, enemyItems, built.previewItems, synergyState.previewSynergies);
  return built;
}

function startSynergyPreview() {
  synergyState.isDragging = true;
  synergyState.previewSynergies = [];
  synergyState.previewSynergyCells = [];
}

function endSynergyPreview() {
  synergyState.isDragging = false;
  synergyState.previewSynergies = [];
  synergyState.previewSynergyCells = [];
  if (typeof playerItems !== "undefined") {
    syncSynergyCellLayers(
      playerItems,
      typeof enemyItems !== "undefined" ? enemyItems : [],
      null,
      [],
    );
  }
}

function getSynergyInvolvedUids(synergies) {
  const set = new Set();
  (synergies || []).forEach((s) => s.itemUids.forEach((u) => set.add(u)));
  return set;
}

function getCellSynergyState(col, row) {
  return synergyState.cellStates.get(cellKey(col, row)) || null;
}

/** @deprecated Используйте synergyState.activeSynergies */
function collectSynergyPanelEntries(synergies) {
  return synergies.map((s) => ({
    itemName: s.names[0],
    partnerName: s.names[1],
    desc: s.effect || s.bonus || s.desc,
  }));
}

function getItemVisualCenter(item, team) {
  const cells = getItemCells(item);
  if (!cells.length) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  cells.forEach(([c, r]) => {
    const rect = cellRectForSynergy(team, c, r);
    sx += rect.x + rect.w / 2;
    sy += rect.y + rect.h / 2;
  });
  return { x: sx / cells.length, y: sy / cells.length };
}

function cellRectForSynergy(team, col, row) {
  const originX = team === "player"
    ? (typeof GRID_PLAYER_X !== "undefined" ? GRID_PLAYER_X : 36)
    : (typeof GRID_PLAYER_X !== "undefined" ? GRID_PLAYER_X : 36)
      + (typeof GRID_COLS !== "undefined" ? GRID_COLS : 9)
      * (typeof GRID_CELL !== "undefined" ? GRID_CELL : 42)
      + (typeof GRID_GAP !== "undefined" ? GRID_GAP : 72);
  const cell = typeof GRID_CELL !== "undefined" ? GRID_CELL : 42;
  const topY = typeof GRID_TOP_Y !== "undefined" ? GRID_TOP_Y : 60;
  return { x: originX + col * cell, y: topY + row * cell, w: cell, h: cell };
}

function synergyColorForType(type, strength, mode) {
  const isActive = mode === SYNERGY_VISUAL.ACTIVE;
  const palette = {
    magic: { strong: isActive ? "#e8c547" : "#c9a227", weak: isActive ? "#6cb6ff" : "#58a6ff" },
    weapon: { strong: isActive ? "#f0c14b" : "#e3b341", weak: isActive ? "#8ec5ff" : "#79c0ff" },
    poison: { strong: isActive ? "#56d364" : "#3fb950", weak: isActive ? "#7ee787" : "#56d364" },
    armor: { strong: isActive ? "#b1bac4" : "#8b949e", weak: isActive ? "#9198a1" : "#6e7681" },
    gem: { strong: isActive ? "#bc8cff" : "#a371f7", weak: isActive ? "#d2a8ff" : "#bc8cff" },
    default: { strong: isActive ? "#ffe066" : "#f0c14b", weak: isActive ? "#6cb6ff" : "#58a6ff" },
  };
  const set = palette[type] || palette.default;
  return set[strength] || set.strong;
}
