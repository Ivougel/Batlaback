# Layout — адаптивная раскладка Backpack Battles

## Источник правды

| Слой | Файл | Назначение |
|------|------|------------|
| Оркестратор | `ui-layout.js` | resize → профили, масштабы, `--app-h`, fit |
| Масштабы JS | `systems/layout-scales.js` | `LayoutScales.gameScale()`, `typePx()` |
| Токены | `styles/tokens.css` | `--ui-scale`, `--font-*`, `--cell-size`, зоны |
| Поверхности | `data-ui-surface` | CSS-режим: drawer / side / stacked |
| Профили | `data-layout-profile` | tier × orientation |
| Бой | `data-battle-profile` | коэффициенты `BATTLE_PROFILES` |

## Матрица профилей

| Viewport | tier | prepLayout | ui-surface | battle-profile |
|----------|------|------------|------------|----------------|
| iPhone portrait | phone | `mobile` | `phone-drawer` | `phone-portrait` |
| iPhone landscape | phone | `side` / `stacked` | `phone-landscape` | `phone-landscape` |
| iPad portrait | tablet | `stacked` | `tablet-stacked` | `tablet-portrait` |
| iPad landscape | tablet | `side` | `tablet-side` | `tablet-landscape-side` |
| Desktop | desktop | `side` | `desktop` | `desktop-landscape` |

**Правило:** планшет в портрете **никогда** не попадает в `mobile` (drawer).

## Три масштаба

- `--ui-scale` — панели, отступы, сетка prep
- `--type-scale` — типографика (`--font-root`, `--font-sm`…)
- `--game-scale` — эмодзи, иконки предметов, FX боя

## Зоны экрана (prep)

После layout `measureLayoutZones()` пишет:

- `--zone-topbar-h`, `--zone-toolbar-h`, `--zone-canvas-h`, `--zone-hero-h`, `--zone-chrome-h`
- `--zone-used-h` — сумма зон

Если `--zone-used-h` > `--app-h`, `applyMeasuredZoneFit()` уменьшает `--prep-canvas-max-h` или `--prep-mobile-canvas-cap`.

## Приоритет сжатия (комфорт)

1. Canvas / поле (первым)
2. Hero-слот
3. Shop drawer height
4. `--ui-scale` (крайний случай)

Touch-цели: `min-height: var(--touch-target-min)` (≥ 44px).

## CSS по поверхностям

| Файл | Поверхность |
|------|-------------|
| `mobile-prep.css` | `data-prep-layout="mobile"` |
| `tablet-side.css` | `data-ui-surface="tablet-side"` |
| `surface-profiles.css` | `tablet-stacked`, `phone-landscape`, `desktop` |
| `container-queries.css` | карточки class/shop по размеру контейнера |
| `battle-arena-layout.css` | `data-battle-hero-placement="flank-arena"` |

## Опасный паттерн селекторов

```css
/* НЕЛЬЗЯ — скрывает весь <html> */
html[data-ui-surface="phone-drawer"], html[data-prep-layout="mobile"] .foo { }

/* ПРАВИЛЬНО */
html[data-prep-layout="mobile"] .foo { }
html[data-ui-surface="phone-drawer"][data-prep-layout="mobile"] .foo { }
```

## Тесты

```bash
npm run test:layout
```

Проверяет 5 профилей: iPhone portrait/landscape, iPad portrait/landscape, desktop.

## Добавление нового экрана

1. Определи `data-ui-surface` / `data-layout-profile`.
2. Размеры — через токены или `PREP_PROFILES` / `BATTLE_PROFILES`.
3. Позиции — CSS grid areas, не inline px в JS.
4. Прогони `npm run test:layout`.
