# BB Reference — эталон Classic Backpack Battles

| Файл | Назначение |
|------|------------|
| `../systems/bb-reference-unlocks.js` | Таблица unlock предметов (генерация: `node tools/generate-bb-unlock-tiers.mjs`) |
| `../systems/bb-reference-recipes.js` | Рецепты крафта BB (генерация: `npm run generate:bb-recipes`) |
| `items-missing.json` | Предметы classic, отсутствовавшие в legacy |
| `recipes.json` | Экспорт рецептов + skipped |

Импорт предметов: `npm run import:bb-items` (legacy → pool append → catalog → recipes).

Следующие этапы fidelity:
- расширить `recipes.json` — полный каталог крафтов BB (~200+)
- `shop-rarity.json` — сверка с wiki
- `economy.json` — золото / reroll
