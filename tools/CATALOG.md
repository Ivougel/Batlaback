# Каталог предметов

Источник правды: **`tools/items-migrated.json`** (русский язык).

```
tools/items-migrated.json  →  items-bb-catalog.js  →  ITEM_CATALOG
```

Ручные предметы — в **`items.js`** (`protectedIds` в JSON).

## Сборка

```bash
bash tools/build-catalog.sh
```

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
| `tools/generate-bb-catalog.js` | генератор |
| `items-bb-catalog.js` | результат (не править вручную) |
