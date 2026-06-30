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
| iPhone landscape | phone | `stacked` | `phone-landscape` | `phone-landscape` |
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
| `phone-landscape.css` | `data-ui-surface="phone-landscape"` |
| `tablet-stacked.css` | `data-ui-surface="tablet-stacked"` |
| `tablet-side.css` | `data-ui-surface="tablet-side"` |
| `desktop-prep.css` | `data-ui-surface="desktop"` |
| `surface-profiles.css` | типографика / touch по поверхностям |
| `container-queries.css` | карточки class/shop по размеру контейнера |
| `battle-arena-layout.css` | `data-battle-hero-placement="flank-arena"` |
| `battle-scale.css` | `data-battle-profile` — эмодзи, HP/stamina |

## Автомасштаб — что уже есть / что осталось

**Готово (prep):** `--ui-scale`, `--type-scale`, `--game-scale`, зоны, fit по профилю, CSS по `data-ui-surface`.

**Готово (battle):** `BATTLE_PROFILES` + `BattleHeroAnchor` (эмодзи от combat floor), `syncBattleHudAnchors` (HP под портретом), `syncFlankArenaHeroAnchors`.

**Осталось (backlog):**
- Предметы на поле боя / FX — частично через `--game-scale`, без единого профиля
- Модалки (рецепты, события) — фикс. px, не читают `--ui-scale`
- Class overlay — container queries, но не полный fluid type
- Replay / damage float — canvas coords, не viewport %
- **VISUAL EXP** (`?vexp=1`) — косметика; при багах отключить: `?vexp=0` или `VisualExperiment.disable()`

### Этап J (battle auto-scale)

- Убран штраф `--battle-emoji-scale` 0.72 на phone
- `EMOJI_SIZE_BY_PROFILE` — крупнее на phone/tablet, центр в высоком combat floor
- `syncBattleHudAnchors` — якорь под `.avatar-hero-upper` / badge, не на тело портрета
- `visual-experiment.css` — flank-arena сохраняет бюст-кроп (HP не на героя)
- `battle-scale.css` — типографика HP/эмодзи по `data-battle-profile`

### Этап K (modals, tablet battle, mobile scale, vexp snapshots)

- **`modal-scale.css`** — container queries для recipe/settings/battle-result/run-complete
- **Phone prep** — `fitMinScale: 0.65`, `--ui-scale` floor 0.58 на tier phone, type boost 1.18
- **Tablet landscape battle** — `BATTLE_PROFILES` floorShare 0.30, `tablet-side.css` combat floor
- **`layout-battle-vexp-snapshots.spec.mjs`** — эталоны боя с `?vexp=1` (отдельно от базы)

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
npm run test:layout   # boot + class overlay, 5 профилей
npm run test:phases   # prep + battle после quick start, 3 профиля
npm run test:geometry # геометрия зон hero/canvas/shop
npm run test:snapshots # pixel-snapshots class overlay + battle arena (Playwright)
npm run test:ui       # все четыре набора
```

Обновить эталоны снапшотов: `npm run test:snapshots:update`

### Этап E (prep/battle)

- `measureLayoutZones()` — также battle: `--zone-battle-hero-h`, `--zone-battle-floor-h`
- `applyMeasuredZoneFit()` — в бою поджимает hero row, если combat floor < 72px
- `styles/tablet-stacked.css` — iPad portrait: лимиты shop/canvas, min combat floor

### Этап F (типографика, grid, CI)

- **Токены:** `--font-2xl`, `--font-chip`; все `font-size` в `styles.css` → токены
- **Mobile prep grid:** убран `display: contents`, явная grid-цепочка `game-layout → board-section → battle-arena → prep-left-column`
- **Мёртвый CSS:** удалены правила для несуществующего `#prep-toolbar` (toolbar = `#bottom-chrome`)
- **Зоны prep:** `measureLayoutZones()` считает `#bottom-chrome` как `--zone-toolbar-h`
- **CI:** `.github/workflows/ui-layout.yml` — `npm run test:ui` на push/PR

### Этап G (grid-areas, геометрия, desktop)

- **Mobile canvas/hero:** grid areas `canvas` / `hero` в `prep-field-column` (без absolute top/left)
- **FAB:** `syncMobileShopFabPosition()` якорится на hero rect
- **`styles/desktop-prep.css`** — field + shop side-by-side на desktop
- **`test:geometry`** — hero между canvas и toolbar; shop справа от поля (iPad landscape, desktop); бой iPhone landscape

### Этап H (phone-landscape, snapshots)

- **`resolveUiSurface`** — iPhone landscape → `phone-landscape` (не `tablet-stacked`)
- **`styles/phone-landscape.css`** — компактный stacked prep + combat floor в viewport
- **`BATTLE_PROFILES["phone-landscape"]`** — меньше hero row, больше floor
- **`test:snapshots`** — Playwright `toHaveScreenshot` для class overlay (4 профиля)
- **`test:phases`** — добавлен iPhone landscape (prep + battle in viewport)

### Этап I (battle snapshots, iPad shop scroll)

- **`layout-battle-snapshots.spec.mjs`** — снапшоты `#app[data-phase="battle"] .prep-field-column` (iPhone portrait, iPad landscape, desktop); пауза боя + mask FX/countdown
- **`tablet-stacked.css`** — shop/bench: flex-колонка, `overflow-y: auto`, `overscroll-behavior: contain`
- **`test:geometry`** — `ipad-portrait-shop-scroll` (панель в viewport, слоты скроллятся)
- **`.gitignore`** — `test-results/`

Проверяет 5 профилей: iPhone portrait/landscape, iPad portrait/landscape, desktop.

## Добавление нового экрана

1. Определи `data-ui-surface` / `data-layout-profile`.
2. Размеры — через токены или `PREP_PROFILES` / `BATTLE_PROFILES`.
3. Позиции — CSS grid areas, не inline px в JS.
4. Прогони `npm run test:layout`.
