// Transpiled from TypeScript — npm run compile:ts

const synergyState = {
  previewSynergies: [],
  activeSynergies: [],
  enemyActiveSynergies: [],
  activeSynergyCells: [],
  enemyActiveSynergyCells: [],
  previewSynergyCells: [],
  cellStates: /* @__PURE__ */ new Map(),
  isDragging: false
};
const SYNERGY_VISUAL = {
  NONE: "none",
  ACTIVE: "active",
  PREVIEW: "preview"
};
function formatSynergyBonus(rule) {
  return formatSynergyHumanDesc(rule);
}
function formatSynergyTagLabels(tags) {
  const labels = (tags || []).map((tag) => typeof formatTagLabel === "function" ? formatTagLabel(tag) : tag);
  if (!labels.length) return "\u043D\u0443\u0436\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} \u0438\u043B\u0438 ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} \u0438\u043B\u0438 ${labels[labels.length - 1]}`;
}
function formatSynergyPlacementPhrase(rule) {
  if (rule.adjacency === "weak") return "\u0415\u0441\u043B\u0438 \u043F\u043E \u0434\u0438\u0430\u0433\u043E\u043D\u0430\u043B\u0438 \u0441\u0442\u043E\u0438\u0442";
  if (rule.adjacency === "both") return "\u0415\u0441\u043B\u0438 \u0440\u044F\u0434\u043E\u043C \u0438\u043B\u0438 \u043F\u043E \u0434\u0438\u0430\u0433\u043E\u043D\u0430\u043B\u0438 \u0441\u0442\u043E\u0438\u0442";
  return "\u0415\u0441\u043B\u0438 \u0440\u044F\u0434\u043E\u043C \u0441\u0442\u043E\u0438\u0442";
}
function formatSynergyApplyPhrase(apply) {
  if (!apply) return "";
  const v = apply.value;
  switch (apply.type) {
    case "damageBonus":
      return `+${v} \u043A \u0443\u0440\u043E\u043D\u0443`;
    case "healBonus":
      return `+${v} \u043A \u043B\u0435\u0447\u0435\u043D\u0438\u044E`;
    case "blockBonus":
      return `+${v} \u043A \u0431\u043B\u043E\u043A\u0443`;
    case "poisonBonus":
      return `+${v} \u043A \u044F\u0434\u0443`;
    case "cooldownReduction":
      return `\u0441\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u0442 \u043D\u0430 ${Math.round((v ?? 0) * 100)}% \u0431\u044B\u0441\u0442\u0440\u0435\u0435`;
    case "grantBlockBuff": {
      const cap = apply.cap ? ` (\u043D\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 +${apply.cap} \u0437\u0430 \u0431\u043E\u0439)` : "";
      return `+${v} \u043A \u0443\u0440\u043E\u043D\u0443 \u0441\u043E\u0441\u0435\u0434\u043D\u0435\u0433\u043E \u043E\u0440\u0443\u0436\u0438\u044F, \u043A\u043E\u0433\u0434\u0430 \u0432\u044B \u0431\u043B\u043E\u043A\u0438\u0440\u0443\u0435\u0442\u0435${cap}`;
    }
    default:
      return "";
  }
}
function formatSynergyHumanDesc(rule) {
  if (!rule?.apply) return rule?.desc || "";
  const bonus = formatSynergyApplyPhrase(rule.apply);
  if (!bonus) return rule.desc || "";
  const placement = formatSynergyPlacementPhrase(rule);
  const neighbor = formatSynergyTagLabels(rule.neighborTags);
  if (rule.apply.type === "grantBlockBuff") {
    return `${placement} ${neighbor}: ${bonus}`;
  }
  if (rule.target === "neighbor") {
    return `\u0421\u043E\u0441\u0435\u0434\u043D\u0438\u0435 ${neighbor}: ${bonus}`;
  }
  if (rule.apply.type === "cooldownReduction") {
    return `${placement} ${neighbor} \u2014 \u044D\u0442\u043E\u0442 \u043F\u0440\u0435\u0434\u043C\u0435\u0442 ${bonus}`;
  }
  return `${placement} ${neighbor} \u2014 ${bonus} \u0443 \u044D\u0442\u043E\u0433\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430`;
}
function formatActiveSynergyTooltipLines(activeSynergies) {
  const counts = /* @__PURE__ */ new Map();
  (activeSynergies || []).forEach((entry) => {
    const desc = entry?.desc || "";
    if (!desc) return;
    counts.set(desc, (counts.get(desc) || 0) + 1);
  });
  return [...counts.entries()].map(([desc, count]) => count > 1 ? `${desc} (\xD7${count})` : desc);
}
function formatSynergyConditionFromRule(rule) {
  const human = formatSynergyHumanDesc(rule);
  if (human) return human;
  const adj = rule.adjacency === "weak" ? "\u0434\u0438\u0430\u0433\u043E\u043D\u0430\u043B\u044C\u043D\u043E" : "\u0440\u044F\u0434\u043E\u043C";
  const tags = formatTagsList(rule.neighborTags || [], " / ");
  if (tags) return `${adj} \u0441 ${tags}`;
  return rule.desc || "";
}
function parseSynergyTexts(rule) {
  const effect = formatSynergyBonus(rule);
  if (rule.desc?.includes(":")) {
    const idx = rule.desc.indexOf(":");
    return {
      condition: rule.desc.slice(0, idx).trim(),
      effect: rule.desc.slice(idx + 1).trim() || effect
    };
  }
  return {
    condition: formatSynergyConditionFromRule(rule),
    effect: effect || rule.desc || ""
  };
}
function inferSynergyType(itemA, itemB, rule) {
  const defA = ITEM_CATALOG[itemA.itemId];
  const defB = ITEM_CATALOG[itemB.itemId];
  const tags = [...defA?.tags || [], ...defB?.tags || []];
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
    desc: formatSynergyHumanDesc(rule),
    ruleId: rule.id,
    applyType: rule.apply?.type,
    type: inferSynergyType(item, partner, rule),
    strength: rule.adjacency === "strong" ? "strong" : "weak",
    status: SYNERGY_VISUAL.ACTIVE
  };
}
function buildPlacementSynergyEntry(hostItem, guestItem, slot) {
  const hostDef = ITEM_CATALOG[hostItem.itemId];
  const guestDef = ITEM_CATALOG[guestItem.itemId];
  const desc = slot.desc || (typeof formatPlacementSlotDesc === "function" ? formatPlacementSlotDesc(slot) : "\u2B50 \u0441\u0438\u043D\u0435\u0440\u0433\u0438\u044F");
  const pseudoRule = { neighborTags: slot.acceptTags || [], id: slot.id };
  return {
    items: [hostItem.itemId, guestItem.itemId],
    itemUids: [hostItem.uid, guestItem.uid],
    names: [hostDef.name, guestDef.name],
    icons: [hostDef.icon, guestDef.icon],
    condition: desc,
    effect: desc,
    bonus: desc,
    desc,
    ruleId: slot.id,
    type: inferSynergyType(hostItem, guestItem, pseudoRule),
    strength: "strong",
    status: SYNERGY_VISUAL.ACTIVE
  };
}
function collectActiveSynergies(items) {
  if (typeof collectActivePlacementSlots !== "function") return [];
  const uidToItem = new Map(items.map((i) => [i.uid, i]));
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  collectActivePlacementSlots(items).forEach((entry) => {
    const host = uidToItem.get(entry.hostUid);
    const guest = entry.guestUid ? uidToItem.get(entry.guestUid) : null;
    if (!host || !guest) return;
    const key = `${entry.hostUid}:${entry.guestUid}:${entry.slotId}`;
    if (seen.has(key)) return;
    seen.add(key);
    const slot = (typeof getPlacementSlotsForItem === "function" ? getPlacementSlotsForItem(host.itemId) : []).find((s) => s.id === entry.slotId);
    if (!slot) return;
    result.push(buildPlacementSynergyEntry(host, guest, slot));
  });
  return result;
}
function cellKey(col, row) {
  return `${col},${row}`;
}
function buildSynergyCellGroups(synergies, items, status) {
  const uidToItem = new Map(items.map((i) => [i.uid, i]));
  return (synergies || []).map((syn) => {
    const cells = [];
    const keys = /* @__PURE__ */ new Set();
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
      itemUids: syn.itemUids
    };
  });
}
function rebuildCellStates(activeGroups, previewGroups) {
  const map = /* @__PURE__ */ new Map();
  const previewKeys = /* @__PURE__ */ new Set();
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
        mode: SYNERGY_VISUAL.ACTIVE
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
        mode: SYNERGY_VISUAL.PREVIEW
      });
    });
  });
  synergyState.cellStates = map;
  return map;
}
function syncSynergyCellLayers(playerItems2, enemyItems2, previewItems, previewSynergies) {
  const previewUids = getSynergyInvolvedUids(previewSynergies);
  const activeFiltered = synergyState.activeSynergies.filter(
    (s) => !s.itemUids.some((u) => previewUids.has(u))
  );
  synergyState.activeSynergyCells = buildSynergyCellGroups(
    activeFiltered,
    playerItems2,
    SYNERGY_VISUAL.ACTIVE
  );
  synergyState.enemyActiveSynergyCells = buildSynergyCellGroups(
    synergyState.enemyActiveSynergies,
    enemyItems2 || [],
    SYNERGY_VISUAL.ACTIVE
  );
  synergyState.previewSynergyCells = previewSynergies.length && previewItems ? buildSynergyCellGroups(previewSynergies, previewItems, SYNERGY_VISUAL.PREVIEW) : [];
  rebuildCellStates(
    synergyState.activeSynergyCells,
    synergyState.previewSynergyCells
  );
}
function buildPreviewPlacement(containers, items, dragPayload, hoverSlot, dragFrom) {
  if (!dragPayload || !hoverSlot || isContainerItem(dragPayload.itemId)) return null;
  const excludeUid = dragFrom?.type === "item" ? dragFrom.item?.uid : null;
  const placement = resolveLoadoutPlacement(
    containers,
    items,
    dragPayload.itemId,
    hoverSlot.col,
    hoverSlot.row,
    dragPayload.rotation || 0,
    excludeUid ?? null
  );
  if (!placement.valid) return null;
  let previewItems = items.filter((i) => i.uid !== excludeUid);
  const previewItem = createPlacedItem(
    dragPayload.itemId,
    placement.col,
    placement.row,
    placement.rotation
  );
  if (excludeUid) previewItem.uid = excludeUid;
  previewItems = [...previewItems, previewItem];
  applySynergyModifiers(previewItems);
  return { previewItems, previewUid: previewItem.uid, placement };
}
function refreshActiveSynergies(playerItems2, enemyItems2 = []) {
  synergyState.activeSynergies = collectActiveSynergies(playerItems2).map((s) => ({
    ...s,
    status: SYNERGY_VISUAL.ACTIVE
  }));
  synergyState.enemyActiveSynergies = collectActiveSynergies(enemyItems2).map((s) => ({
    ...s,
    status: SYNERGY_VISUAL.ACTIVE
  }));
  syncSynergyCellLayers(playerItems2, enemyItems2, null, synergyState.previewSynergies);
  return synergyState.activeSynergies;
}
function refreshPreviewSynergies(containers, playerItems2, dragPayload, hoverSlot, dragFrom, enemyItems2 = []) {
  if (!synergyState.isDragging || !dragPayload || !hoverSlot) {
    synergyState.previewSynergies = [];
    syncSynergyCellLayers(playerItems2, enemyItems2, null, []);
    return null;
  }
  const built = buildPreviewPlacement(containers, playerItems2, dragPayload, hoverSlot, dragFrom);
  if (!built) {
    synergyState.previewSynergies = [];
    syncSynergyCellLayers(playerItems2, enemyItems2, null, []);
    return null;
  }
  const all = collectActiveSynergies(built.previewItems);
  synergyState.previewSynergies = all.filter((s) => s.itemUids.includes(built.previewUid)).map((s) => ({ ...s, status: SYNERGY_VISUAL.PREVIEW }));
  syncSynergyCellLayers(playerItems2, enemyItems2, built.previewItems, synergyState.previewSynergies);
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
      []
    );
  }
}
function getSynergyInvolvedUids(synergies) {
  const set = /* @__PURE__ */ new Set();
  (synergies || []).forEach((s) => s.itemUids.forEach((u) => set.add(u)));
  return set;
}
function getCellSynergyState(col, row) {
  return synergyState.cellStates.get(cellKey(col, row)) || null;
}
function collectSynergyPanelEntries(synergies) {
  return synergies.map((s) => ({
    itemName: s.names[0],
    partnerName: s.names[1],
    desc: s.effect || s.bonus || s.desc
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
  if (typeof cellRect === "function") {
    return cellRect(team, col, row);
  }
  const stride = typeof GRID_STRIDE !== "undefined" ? GRID_STRIDE : 47;
  const originX = typeof layoutGridOrigin === "function" ? layoutGridOrigin(team) : team === "player" ? GRID_PLAYER_X || 0 : ENEMY_X || 0;
  const topY = typeof layoutBackpackY === "function" ? layoutBackpackY() : BACKPACK_Y || 0;
  const cell = typeof GRID_CELL !== "undefined" ? GRID_CELL : 46;
  return { x: originX + col * stride, y: topY + row * stride, w: cell, h: cell };
}
function synergyColorForType(type, strength, mode) {
  const isActive = mode === SYNERGY_VISUAL.ACTIVE;
  const palette = {
    magic: { strong: isActive ? "#e8c547" : "#c9a227", weak: isActive ? "#6cb6ff" : "#58a6ff" },
    weapon: { strong: isActive ? "#f0c14b" : "#e3b341", weak: isActive ? "#8ec5ff" : "#79c0ff" },
    poison: { strong: isActive ? "#56d364" : "#3fb950", weak: isActive ? "#7ee787" : "#56d364" },
    armor: { strong: isActive ? "#b1bac4" : "#8b949e", weak: isActive ? "#9198a1" : "#6e7681" },
    gem: { strong: isActive ? "#bc8cff" : "#a371f7", weak: isActive ? "#d2a8ff" : "#bc8cff" },
    default: { strong: isActive ? "#ffe066" : "#f0c14b", weak: isActive ? "#6cb6ff" : "#58a6ff" }
  };
  const set = palette[type] || palette.default;
  return set[strength] || set.strong;
}
window.formatSynergyHumanDesc = formatSynergyHumanDesc;
window.formatActiveSynergyTooltipLines = formatActiveSynergyTooltipLines;
