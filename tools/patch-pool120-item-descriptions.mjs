#!/usr/bin/env node
/**
 * Дописывает description для предметов pool v120 без текста.
 * node tools/patch-pool120-item-descriptions.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MIGRATED = path.join(ROOT, "tools/items-migrated.json");
const MANIFEST = path.join(ROOT, "tools/item-pool-120-manifest.json");

/** id → описание для игрока (из effects). */
const DESCRIPTIONS = {
  rusty_sword: "Удар 1–3 урона ближнего боя.",
  iron_helmet: "+3 защиты. Активация: блок 4.",
  dagger: "Удар 1–3 урона. Дополнительная атака по оглушённому противнику.",
  poison_vial: "Накладывает 1 яда.",
  apprentice_staff: "Магический удар 1–3 урона.",
  mana_crystal: "Магический удар 1–4 урона.",
  apple: "Лечение 3 HP.",
  fire_staff: "Огненный удар 6–11. Поджигает поле (3 урона/с). +15% пробивания блока.",
  knight_sword: "Мощный удар 12–16 урона.",
  iron_shield: "Блок 5.",
  poison_dagger: "Удар 1–2 урона. При попадании: +2 яда. Доп. атака по оглушённому.",
  smoke_bomb: "Каждые 3с: уклонение. Активация: +2 яда.",
  fire_crystal: "Огненный удар 2–5 урона.",
  spark_stone: "Магический удар 1–3 урона.",
  frost_crystal: "Магический удар 1–4. Замедление 15% на 3с.",
  lucky_charm: "+35 удачи (пассивно).",
  health_stone: "+12 макс. HP. Активация: лечение 4.",
  bandage: "Лечение 3 HP.",
  healing_herb: "Лечение 5 HP.",
  rage_potion: "+30% урона на 5с.",
  antitoxin: "Лечение 4 HP.",
  cork_charm: "Блок 2.",
  royal_helmet: "+10 защиты, +15 макс. HP. Активация: блок 10.",
  titan_armor: "+16 защиты, +15 макс. HP.",
  iron_patch: "+2 защиты.",
};

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const poolIds = new Set(manifest.items);
  const data = JSON.parse(fs.readFileSync(MIGRATED, "utf8"));
  let patched = 0;

  data.items.forEach((item) => {
    if (!poolIds.has(item.id)) return;
    if (item.description?.trim()) return;
    const text = DESCRIPTIONS[item.id];
    if (!text) return;
    item.description = text;
    patched += 1;
  });

  fs.writeFileSync(MIGRATED, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Описания: +${patched} предметов в items-migrated.json`);
}

main();
