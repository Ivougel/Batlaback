# Пул предметов v240

**Единственный игровой каталог** — **240 предметов** (+ `starter_bag` для стартового рюкзака). Полный legacy-каталог (~308) архивирован в `tools/items-migrated-legacy.json`.

## Состав (240)

| Слой | Шт. | Роль |
|------|-----|------|
| Старт класса | 8 | 2×4 новичка (`rusty_sword`…`banana`) |
| Усиления 1×1 | 24 | `enh_*` head/chest/boots |
| Усилители рюкзака | 10 | `amplify_*` |
| Ключи веток | 4 | `key_*` |
| Опоры троек | 7* | `fire_staff`, holy/musical опоры… |
| Рюкзак (магазин) | 68 | базовый набор: оружие, еда, яд, магия, броня… |
| Расширение legacy | 120 | katana, pets, артефакты, gems, контейнеры… |

\*В пуле **52 уникальных системных** ID (dagger — и старт, и опора ассасина).

**Исключено из core:** `artifact_stone_death`, `heart_container`, `more_stats`, `gloves_of_haste` — мета «стат-палка», не ось классов.

## Файлы

| Файл | Назначение |
|------|------------|
| `tools/items-migrated.json` | **~198** записей: 240 из пула + `starter_bag` |
| `tools/items-migrated-legacy.json` | архив полного каталога (308) |
| `tools/generate-item-pool-120.mjs` | пересборка: манифест → migrated → catalog → runtime |
| `systems/item-pool-120.js` | `isItemInPool120`, `filterItemsToPool120` (всегда активен) |
| `bash tools/build-catalog.sh` | = `node tools/generate-item-pool-120.mjs` |

## Сборка каталога

```bash
npm run generate:item-pool
# или
bash tools/build-catalog.sh
```

Правки предметов рюкзака: сначала `tools/items-migrated.json` (только ID из пула), затем пересборка.

## Баланс-сим (4 архетипа)

```bash
npm run sim:balance-pool120
```

- Пресеты: AI prep по `AI_ARCHETYPES[classId]`, магазин **только pool v240**, win-streak до R1/R8/R16
- Бои: round-robin 4×4, fatigue = prep round, спутник + мутация R8/R16
- Отчёт: `tools/class-balance-pool120-results.json`

## Версия

- v2 — 2026-07-02 — +120 расширение из legacy, авто-описания из effects.
- v1 — 2026-07-02 — 120 предметов, квоты по тегам + backfill.
