#!/usr/bin/env node
/**
 * Финальная правка 6 оставшихся предметов — полная замена effects.
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "items-migrated.json");

const REPLACEMENTS = {
  blood_harvester: {
    effects: [
      { type: "stackGainMult", value: 1, trigger: "passive" },
      { type: "cooldownMultPerTotalStacks", perStack: 0.05, maxStacks: 40, trigger: "passive" },
    ],
    description: "Стаки на 100% эффективнее. Предметы на 5% быстрее за каждый стак (макс. +200%).",
  },
  pop: {
    effects: [
      { type: "periodic", interval: 8, trigger: "passive", foePoison: 3 },
      { type: "cooldownMultPerSocket", perSocket: 0.03, maxBonus: 0.60, trigger: "passive" },
    ],
    cooldown: 8,
    description: "Каждые 8с: +3 яда. Атаки на 3% быстрее за каждый заполненный сокет (до 60%).",
  },
  lil_chestnut: {
    effects: [
      { type: "periodic", interval: 6, trigger: "passive", gainDominantStack: 3 },
      { type: "cooldownMultPerItemCost", perCost: 0.01, trigger: "passive" },
    ],
    cooldown: 6,
    description: "При обновлении магазина: 40% шанс торгового предложения. Каждые 6с: +3 к сильнейшему стаку. На 1% быстрее за каждое очко стоимости предметов.",
  },
  flute: {
    effects: [
      {
        type: "periodic",
        interval: 4.7,
        trigger: "passive",
        randomPick: [
          { block: 14 },
          { restoreStamina: 2 },
          { gainStack: { stack: "luck", value: 2 } },
        ],
      },
      { type: "cooldownMultPerAdjacent", perAdjacent: 0.10, maxBonus: 0.60, trigger: "passive" },
    ],
    cooldown: 4.7,
    description: "Каждые 4.7с: случайно +14 блока, +2 выносливости или +2 удачи. На 10% быстрее за каждый соседний предмет (до 60%).",
  },
  fanfare: {
    effects: [
      {
        type: "periodic",
        interval: 3,
        trigger: "passive",
        drainFoeStamina: 1,
        cooldownPenalty: 0.8,
        stunEvery: 5,
        stunDuration: 1,
      },
    ],
    cooldown: 3,
    description: "Каждые 3с: −1 выносливости противнику (+0.8с к своему кулдауну). Каждые 5 срабатываний: оглушение на 1с.",
  },
  mrs_struggles: {
    effects: [
      { type: "periodic", interval: 4.7, trigger: "passive", stripFoeStacksOnceEach: true },
      { type: "cooldownMultPerTag", tags: ["dark"], perTag: 0.10, trigger: "passive" },
    ],
    cooldown: 4.7,
    description: "Каждые 4.7с: снять по 1 стаку каждого типа у противника. На 10% быстрее за каждый тёмный предмет.",
  },
};

function main() {
  const data = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const items = data.items || data;
  let fixed = 0;

  for (const item of items) {
    const patch = REPLACEMENTS[item.id];
    if (!patch) continue;
    item.effects = patch.effects;
    if (patch.description) item.description = patch.description;
    if (patch.cooldown != null) item.cooldown = patch.cooldown;
    fixed += 1;
  }

  fs.writeFileSync(SRC, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`fix-remaining-items: обновлено ${fixed} предметов`);
}

main();
