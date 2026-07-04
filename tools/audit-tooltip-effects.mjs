#!/usr/bin/env node
/**
 * Аудит тултипов: fallback-строки, «особый эффект», пустые описания.
 * node tools/audit-tooltip-effects.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { humanizeItemDescription } from "./humanize-item-descriptions.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MIGRATED = path.join(ROOT, "tools/items-migrated.json");
const GAME = path.join(ROOT, "game.js");
const OUT = path.join(ROOT, "tools/tooltip-effects-audit.json");

const VAGUE = /особый эффект|^[a-z_]+:\s*\d/i;
const BAD = /вампиризм|дебафф|к прокам|кулдаун:|\/с\b| стак/i;

function extractDescribeEffectCases(src) {
  const start = src.indexOf("function describeEffect(");
  const end = src.indexOf("function escapeTooltipHtml", start);
  const block = src.slice(start, end);
  return new Set([...block.matchAll(/case "([^"]+)":/g)].map((m) => m[1]));
}

function simulateFallback(type, value) {
  return `${type}${value != null ? `: ${value}` : ""}`;
}

function main() {
  const game = fs.readFileSync(GAME, "utf8");
  const handled = extractDescribeEffectCases(game);
  const data = JSON.parse(fs.readFileSync(MIGRATED, "utf8"));

  const report = {
    generatedAt: new Date().toISOString(),
    total: data.items.length,
    missingHandler: [],
    vagueDescription: [],
    badWording: [],
    emptyDescription: [],
  };

  for (const item of data.items) {
    const desc = (item.description || "").trim();
    if (!desc) report.emptyDescription.push(item.id);

    if (VAGUE.test(desc)) report.vagueDescription.push({ id: item.id, desc });
    if (BAD.test(desc)) report.badWording.push({ id: item.id, desc });

    for (const e of item.effects || []) {
      if (!handled.has(e.type)) {
        report.missingHandler.push({
          id: item.id,
          type: e.type,
          fallback: simulateFallback(e.type, e.value),
        });
      }
    }

    const regen = humanizeItemDescription(item);
    if (regen !== desc) {
      if (!report.descriptionDrift) report.descriptionDrift = [];
      report.descriptionDrift.push({ id: item.id, stored: desc, regen });
    }
  }

  report.summary = {
    missingHandler: report.missingHandler.length,
    vagueDescription: report.vagueDescription.length,
    badWording: report.badWording.length,
    emptyDescription: report.emptyDescription.length,
    descriptionDrift: report.descriptionDrift?.length || 0,
  };

  fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Отчёт: ${OUT}`);
}

main();
