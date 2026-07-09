#!/usr/bin/env node
/**
 * Синхронизирует элементальные теги и исправляет эффекты предметов.
 * Источник правил: tools/element-tag-assignments.json
 * Запуск: node tools/sync-element-tags.js && node tools/generate-bb-catalog.js
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "items-migrated.json");
const RULES = path.join(__dirname, "element-tag-assignments.json");

function uniqTags(tags) {
  return [...new Set((tags || []).filter(Boolean))];
}

function mergeEffects(existing, additions) {
  const out = [...(existing || [])];
  for (const eff of additions || []) {
    const key = JSON.stringify(eff, Object.keys(eff).sort());
    if (out.some((e) => JSON.stringify(e, Object.keys(e).sort()) === key)) continue;
    out.push(eff);
  }
  return out;
}

function main() {
  const data = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const rules = JSON.parse(fs.readFileSync(RULES, "utf8"));
  const idSet = new Set(data.items.map((i) => i.id));
  let tagAdds = 0;
  let effectFixes = 0;

  for (const [tag, ids] of Object.entries(rules.addTags || {})) {
    for (const id of ids) {
      if (!idSet.has(id)) continue;
      const item = data.items.find((i) => i.id === id);
      if (!item.tags) item.tags = [];
      if (!item.tags.includes(tag)) {
        item.tags.push(tag);
        tagAdds += 1;
      }
    }
  }

  for (const [id, removeList] of Object.entries(rules.removeTags || {})) {
    const item = data.items.find((i) => i.id === id);
    if (!item) continue;
    item.tags = (item.tags || []).filter((t) => !removeList.includes(t));
  }

  for (const [id, patch] of Object.entries(rules.itemEffects || {})) {
    const item = data.items.find((i) => i.id === id);
    if (!item) {
      console.warn(`skip missing item: ${id}`);
      continue;
    }

    if (patch.tags) item.tags = uniqTags(patch.tags);
    else if (patch.addTags) item.tags = uniqTags([...(item.tags || []), ...patch.addTags]);

    if (patch.cooldown != null) item.cooldown = patch.cooldown;
    if (patch.effects) {
      item.effects = patch.effects;
      effectFixes += 1;
    }
    if (patch.effectsAppend) {
      item.effects = mergeEffects(item.effects, patch.effectsAppend);
      effectFixes += 1;
    }
    if (patch.description) item.description = patch.description;
    if (patch.buildHints) item.buildHints = patch.buildHints;
  }

  fs.writeFileSync(SRC, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Updated ${SRC}: +${tagAdds} tag assignments, ${effectFixes} effect patches`);
}

main();
