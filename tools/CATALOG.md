# Каталог предметов

Единый источник правды: **`tools/items-migrated.json`** (только ID из пула v120; полный архив: `tools/items-migrated-legacy.json`).

```
tools/item-pool-120-manifest.json  →  tools/generate-item-pool-120.mjs
  →  tools/items-migrated.json  →  items-catalog.js  →  ITEM_CATALOG
  (+ enh / amplify / key / triple из systems/*.js)
```

Сборка:

```bash
bash tools/build-catalog.sh
# или: npm run generate:item-pool
```

Логика предметов (`defItem`, слоты, магазин) — в **`items.js`** (без данных каталога).

## Сборка

```bash
bash tools/build-catalog.sh
```

После правки JSON всегда пересобирайте каталог. В рантайме подключаются только `items.js` + `items-catalog.js`.

## Поля предмета

| Поле | Назначение |
|------|------------|
| `name`, `description`, `buildHints` | тексты UI (русский) |
| `effects[]` | бой → `battle-engine.js` |
| `metaEffects[]` | магазин → `systems/meta-effects.js` |
| `synergies[]` | соседство → `systems/synergy.js` |
| `shape`, `icon`, `cost`, `tags`, … | отображение и магазин |

## Файлы

| Файл | Роль |
|------|------|
| `tools/items-migrated.json` | править здесь |
| `tools/build-catalog.sh` | сборка |
| `tools/generate-items-catalog.js` | генератор |
| `items-catalog.js` | результат (не править вручную) |
| `items.js` | хелперы и `defItem`, без `ITEM_CATALOG` |

## Миграция с двух файлов

Однократно: `node tools/merge-manual-items-into-json.js` (уже выполнено — ручные предметы из старого `items.js` перенесены в JSON).
