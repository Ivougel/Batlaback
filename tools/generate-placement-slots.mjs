#!/usr/bin/env node
/**
 * Генерирует systems/placement-slots-catalog.ts из legacy-каталога + bb-reference overrides.
 * node tools/generate-placement-slots.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LEGACY = path.join(ROOT, "tools/items-migrated-legacy.json");
const CATALOG = path.join(ROOT, "tools/items-migrated.json");
const OVERRIDES = path.join(ROOT, "tools/bb-reference/placement-slot-overrides.json");
const OUT = path.join(ROOT, "systems/placement-slots-catalog.ts");

function loadRuntimeCatalog() {
  const sandbox = {
    console,
    Math,
    Object,
    Array,
    Map,
    Set,
    JSON,
    CRAFT_OUTPUT_IDS: new Set(),
    isCraftOutputItemId: () => false,
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  ["items.js", "items-catalog.js"].forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), ctx);
  });
  vm.runInContext("globalThis.ITEM_CATALOG = ITEM_CATALOG;", ctx);
  return sandbox.ITEM_CATALOG;
}

function normalizeShape(shape) {
  if (Array.isArray(shape) && shape.length) return shape.map(([c, r]) => [c, r]);
  if (shape?.w && shape?.h) {
    const cells = [];
    for (let y = 0; y < shape.h; y++) {
      for (let x = 0; x < shape.w; x++) cells.push([x, y]);
    }
    return cells.length ? cells : [[0, 0]];
  }
  return [[0, 0]];
}

function rotateOffset(at, rotation = 0) {
  let [x, y] = at;
  const t = ((rotation % 4) + 4) % 4;
  for (let i = 0; i < t; i += 1) {
    [x, y] = [y, -x];
  }
  return [x, y];
}

function shapeCells(shape, rotation = 0) {
  let cells = normalizeShape(shape);
  const t = ((rotation % 4) + 4) % 4;
  for (let i = 0; i < t; i += 1) {
    cells = cells.map(([x, y]) => [y, -x]);
    const minX = Math.min(...cells.map(([x]) => x));
    const minY = Math.min(...cells.map(([, y]) => y));
    cells = cells.map(([x, y]) => [x - minX, y - minY]);
  }
  return new Set(cells.map(([x, y]) => `${x},${y}`));
}

function slotOverlapsAtRotation(shape, at, rotation) {
  const body = shapeCells(shape, rotation);
  const [dx, dy] = rotateOffset(at, rotation);
  return body.has(`${dx},${dy}`);
}

function isRotationSafeSlot(shape, at) {
  for (let rot = 0; rot < 4; rot += 1) {
    if (slotOverlapsAtRotation(shape, at, rot)) return false;
  }
  return true;
}

function adjacentOutsideCells(shape) {
  const body = new Set(normalizeShape(shape).map(([x, y]) => `${x},${y}`));
  const offsets = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [2, 0], [0, 2], [-2, 0], [0, -2],
    [2, 1], [1, 2], [-2, 1], [-1, 2],
  ];
  const out = new Map();
  body.forEach((key) => {
    const [bx, by] = key.split(",").map(Number);
    offsets.forEach(([dx, dy]) => {
      const ax = bx + dx;
      const ay = by + dy;
      const k = `${ax},${ay}`;
      if (!body.has(k)) out.set(k, [ax, ay]);
    });
  });
  return [...out.values()];
}

function pickRotationSafePositions(shape, count) {
  const candidates = adjacentOutsideCells(shape).filter((at) => isRotationSafeSlot(shape, at));
  const prefs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [2, 0], [0, 2], [-2, 0], [0, -2],
  ];
  const picked = [];
  for (const p of prefs) {
    if (picked.length >= count) break;
    if (candidates.some(([x, y]) => x === p[0] && y === p[1])) picked.push(p);
  }
  for (const p of candidates) {
    if (picked.length >= count) break;
    if (!picked.some(([x, y]) => x === p[0] && y === p[1])) picked.push(p);
  }
  while (picked.length < count) picked.push([1, 0]);
  return picked.slice(0, count);
}

function synergyToSlot(item, rule, at, idx) {
  const tags = rule.neighborTags || [];
  const slot = {
    id: `${item.id}_star_${idx}`,
    kind: "star",
    at,
    acceptTags: tags,
  };
  if (rule.target === "neighbor") {
    slot.guestApply = { ...rule.apply };
  } else {
    slot.hostApply = { ...rule.apply };
  }
  const tagLabel = tags.slice(0, 2).join("/") || "предмет";
  const bonus = rule.apply?.type === "cooldownReduction"
    ? `−${Math.round((rule.apply.value || 0) * 100)}% CD`
    : rule.apply?.type === "damageBonus"
      ? `+${rule.apply.value} урона`
      : rule.apply?.type === "healBonus"
        ? `+${rule.apply.value} хил`
        : rule.apply?.type === "blockBonus"
          ? `+${rule.apply.value} блок`
          : rule.apply?.type === "poisonBonus"
            ? `+${rule.apply.value} яд`
            : rule.apply?.type === "grantBlockBuff"
              ? `+${rule.apply.value} урона оружию при блоке`
              : "бонус";
  slot.desc = `⭐ ${tagLabel}: ${bonus}`;
  return slot;
}

function hintToSlot(item, effect, at, idx) {
  const tags = effect.neighborTags || ["weapon"];
  return {
    id: `${item.id}_hint_${idx}`,
    kind: "star",
    at,
    acceptTags: tags,
    guestApply: { type: "damageBonus", value: effect.value || 1 },
    desc: `⭐ ${tags.join("/")}: +${effect.value || 1} урона`,
  };
}

function autoGenerateSlots(item) {
  const shape = normalizeShape(item.shape);
  const rules = (item.synergies || []).filter((rule) => {
    if ((item.tags || []).includes("weapon")) return false;
    return rule.neighborTags?.length;
  });
  const hints = (item.effects || []).filter((e) => e.type === "synergyHint");
  const slotCount = Math.max(rules.length, hints.length);
  if (!slotCount) return [];
  const positions = pickRotationSafePositions(shape, slotCount);
  const slots = [];
  rules.forEach((rule, i) => {
    slots.push(synergyToSlot(item, rule, positions[i] || [1, 0], i + 1));
  });
  hints.forEach((effect, i) => {
    const at = positions[rules.length + i] || positions[i] || [1, 0];
    slots.push(hintToSlot(item, effect, at, i + 1));
  });
  return slots.filter((s) => isRotationSafeSlot(shape, s.at));
}

function collectTagGroupsFromEffects(effects) {
  const groups = [];
  (effects || []).forEach((effect) => {
    if (effect.type === "tagScaledStack" && effect.tag) {
      groups.push({ tags: [effect.tag], kind: "tagScaled", effect });
    }
    if (effect.type === "cooldownMultPerTag") {
      const tags = Array.isArray(effect.tags) ? effect.tags : [effect.tag].filter(Boolean);
      if (tags.length) groups.push({ tags, kind: "cooldown", effect });
    }
    if (effect.type === "healPerTag" && effect.tag) {
      groups.push({ tags: [effect.tag], kind: "heal", effect });
    }
    if (effect.type === "lifestealPerTag" && effect.tag) {
      groups.push({ tags: [effect.tag], kind: "lifesteal", effect });
    }
  });
  const seen = new Set();
  return groups.filter((group) => {
    const key = `${group.kind}:${group.tags.slice().sort().join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tagGroupDesc(group) {
  const tags = group.tags.join("/");
  const { effect } = group;
  if (group.kind === "tagScaled") {
    const per = effect.perTag ?? effect.value ?? 1;
    const stack = effect.stack || "block";
    return `⭐ ${tags}: +${per} ${stack} в начале боя`;
  }
  if (group.kind === "cooldown") {
    const pct = Math.round((effect.perTag ?? effect.value ?? 0.15) * 100);
    return `⭐ ${tags}: −${pct}% кулдаун`;
  }
  if (group.kind === "heal") {
    return `⭐ ${tags}: +${effect.value || 1} к лечению`;
  }
  if (group.kind === "lifesteal") {
    return `⭐ ${tags}: +${Math.round((effect.value || 0.15) * 100)}% вампиризма`;
  }
  return `⭐ ${tags}`;
}

function autoGenerateFromTagEffects(item) {
  const groups = collectTagGroupsFromEffects(item.effects);
  if (!groups.length) return [];
  const shape = normalizeShape(item.shape);
  const perGroup = groups.length === 1 ? 4 : 2;
  const positions = pickRotationSafePositions(shape, groups.length * perGroup);
  const slots = [];
  let posIdx = 0;
  groups.forEach((group, gi) => {
    for (let i = 0; i < perGroup; i += 1) {
      const at = positions[posIdx] || [1, 0];
      posIdx += 1;
      slots.push({
        id: `${item.id}_fx_${gi}_${i + 1}`,
        kind: "star",
        at,
        acceptTags: group.tags,
        desc: tagGroupDesc(group),
      });
    }
  });
  return slots.filter((s) => isRotationSafeSlot(shape, s.at));
}

function mergeSlotLists(...lists) {
  const out = [];
  const seen = new Set();
  lists.flat().forEach((slot) => {
    const key = `${slot.at[0]},${slot.at[1]}:${(slot.acceptTags || []).join(",")}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(slot);
  });
  return out;
}

function stripGemFromSlots(slots) {
  return (slots || [])
    .filter((slot) => slot.kind !== "diamond")
    .map((slot) => {
      const acceptTags = (slot.acceptTags || []).filter((t) => t !== "gem");
      const next = { ...slot };
      if (acceptTags.length) next.acceptTags = acceptTags;
      else delete next.acceptTags;
      if (next.desc) next.desc = next.desc.replace(/◆/g, "⭐").replace(/[Кк]ристалл/g, "магия");
      return next;
    });
}

function validateSlots(itemId, shape, slots) {
  const bad = slots.filter((s) => !isRotationSafeSlot(shape, s.at));
  if (bad.length) {
    console.warn(`  ⚠ ${itemId}: ${bad.length} слот(ов) перекрывают форму при повороте`);
  }
}

function main() {
  const legacy = JSON.parse(fs.readFileSync(LEGACY, "utf8"));
  const catalogIds = new Set(JSON.parse(fs.readFileSync(CATALOG, "utf8")).items.map((i) => i.id));
  const legacyById = new Map(legacy.items.map((i) => [i.id, i]));
  const runtimeCatalog = loadRuntimeCatalog();
  const overrides = fs.existsSync(OVERRIDES)
    ? JSON.parse(fs.readFileSync(OVERRIDES, "utf8")).items || {}
    : {};

  const byId = new Map();
  let autoCount = 0;
  let autoTagCount = 0;

  for (const itemId of catalogIds) {
    if (overrides[itemId]) {
      const legacyItem = legacyById.get(itemId);
      validateSlots(itemId, legacyItem?.shape || [[0, 0]], overrides[itemId]);
      byId.set(itemId, stripGemFromSlots(overrides[itemId]));
      continue;
    }
    const legacyItem = legacyById.get(itemId);
    const runtimeItem = runtimeCatalog[itemId];
    const merged = {
      ...(legacyItem || {}),
      ...(runtimeItem || {}),
      id: itemId,
      shape: runtimeItem?.shape || legacyItem?.shape || [[0, 0]],
      tags: runtimeItem?.tags || legacyItem?.tags || [],
      effects: runtimeItem?.effects || legacyItem?.effects || [],
      synergies: runtimeItem?.synergies || legacyItem?.synergies || [],
    };
    const fromTags = autoGenerateFromTagEffects(merged);
    const legacySynergies = legacyItem?.synergies || [];
    const fromSynergies = legacySynergies.length
      ? autoGenerateSlots({ ...merged, synergies: legacySynergies })
      : [];
    const auto = stripGemFromSlots(mergeSlotLists(fromTags, fromSynergies));
    if (auto.length) {
      byId.set(itemId, auto);
      autoCount += 1;
      if (fromTags.length) autoTagCount += 1;
    }
  }

  Object.entries(overrides).forEach(([id, slots]) => {
    if (!catalogIds.has(id)) return;
    if (!byId.has(id)) {
      const item = legacyById.get(id);
      if (item) validateSlots(id, item.shape, slots);
      byId.set(id, slots);
    }
  });

  const sortedIds = [...byId.keys()].sort();
  const defsObj = {};
  sortedIds.forEach((id) => {
    defsObj[id] = byId.get(id);
  });

  const body = `/**
 * Слоты размещения (⭐ / ◆) — сгенерировано tools/generate-placement-slots.mjs
 * Источник: tools/bb-reference/placement-slot-overrides.json + автоконверсия synergies.
 * @see systems/placement-slots.js
 */
import type { PlacementSlotCatalogEntry } from "../types/game";

const PLACEMENT_SLOT_DEFS: Record<string, PlacementSlotCatalogEntry[]> = ${JSON.stringify(defsObj, null, 2)};

function patchPlacementSlotCatalog(): void {
  if (typeof ITEM_CATALOG === "undefined") return;
  Object.entries(PLACEMENT_SLOT_DEFS).forEach(([itemId, slots]) => {
    if (!ITEM_CATALOG[itemId]) return;
    ITEM_CATALOG[itemId].placementSlots = slots.map((slot) => ({ ...slot }));
  });
}

patchPlacementSlotCatalog();

window.PLACEMENT_SLOT_DEFS = PLACEMENT_SLOT_DEFS;
`;

  fs.writeFileSync(OUT, body, "utf8");
  const totalSlots = sortedIds.reduce((n, id) => n + defsObj[id].length, 0);
  const poolOnly = sortedIds.filter((id) => {
    const manifest = fs.existsSync(path.join(ROOT, "tools/item-pool-120-manifest.json"))
      ? JSON.parse(fs.readFileSync(path.join(ROOT, "tools/item-pool-120-manifest.json"), "utf8")).items
      : [];
    return new Set(manifest).has(id);
  }).length;
  console.log(`Wrote ${OUT}`);
  console.log(`  ${sortedIds.length} предметов в каталоге, ${totalSlots} слотов`);
  console.log(`  ${poolOnly} в pool v240, ${Object.keys(overrides).length} override, ${autoCount} auto (${autoTagCount} tag-fx)`);
}

main();
