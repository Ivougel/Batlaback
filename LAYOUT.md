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
| iPhone landscape | phone | `side` | `tablet-side` | `phone-landscape` |
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
| `phone-landscape.css` | `data-layout-profile="phone-landscape"` (бой; prep на `tablet-side`) |
| `tablet-stacked.css` | `data-ui-surface="tablet-stacked"` |
| `tablet-side.css` | `data-ui-surface="tablet-side"` |
| `desktop-prep.css` | `data-ui-surface="desktop"` |
| `surface-profiles.css` | типографика / touch по поверхностям |
| `container-queries.css` | карточки class/shop по размеру контейнера |
| `battle-arena-layout.css` | `data-battle-hero-placement="flank-arena"` |
| `battle-scale.css` | `data-battle-profile` — эмодзи, HP/stamina |
| `replay-chrome.css` | `data-phase="replay"` — timeline в toolbar |
| `modal-scale.css` | overlay-модалки, container queries |

## Автомасштаб — что уже есть / что осталось

**Готово (prep):** `--ui-scale`, `--type-scale`, `--game-scale`, зоны, fit по профилю, CSS по `data-ui-surface`.

**Готово (battle):** `BATTLE_PROFILES` + `BattleHeroAnchor` (эмодзи от combat floor), `syncBattleHudAnchors` (HP под портретом), `syncFlankArenaHeroAnchors`.

**Осталось (backlog):** нет — базовая автоматическая раскладка закрыта (N→R). Дальше только точечные фичи.

### Этап R (shop sheet zones, class dock test, PWA precache)

- **`syncMobileOverlayAnchors()`** — `--prep-shop-sheet-max-h` и `--prep-shop-sheet-bottom` (sheet над toolbar, не под ним)
- **`syncClassOverlayAnchors()`** — `--class-modal-scroll-max-h` от header + dock на opponent step
- **`test:geometry`** — `iphone-portrait-shop-sheet-zone`, `iphone-portrait-class-dock`
- **PWA precache** — `bb-pwa-v3`, все новые CSS/JS из `index.html`

### Этап Q (type-scale, overlay tokens, tooltip test)

- **`TYPE_SCALE_BY_TIER`** — phone floor 0.96 / boost 1.2, tablet floor 0.94
- **`syncClassOverlayAnchors()`** — `--class-mobile-dock-h` от измеренного dock
- **Токены:** `--class-mobile-dock-*`, `--overlay-rotate-prompt-*`
- **class-mobile-dock / rotate prompt** — padding и типографика через `--ui-scale` / `--font-*`
- **`test:geometry`** — `iphone-portrait-battle-inventory-tooltip`, type-scale в prep-chrome

### Этап P (HTML battle HUD, compact chips, tablet anchor fix)

- **`isMobilePortraitBattleHud()` / `isCompactBattleHud()`** — phone portrait + tablet portrait compact HUD
- **`syncBattleHudRuntimeChips()`** — block/poison/bonus chips в DOM (`.battle-hud-runtime-chips`)
- **`syncBattleHudAnchors()`** — HUD строго под `.avatar-hero-stage`, `--battle-hud-max-h` в hero row
- **`styles/battle-hud-compact.css`** — компактные полоски + runtime chips
- **`test:geometry`** — `ipad-portrait-battle-hud`

### Этап O (mobile overlay FAB anchors)

- **`syncMobileOverlayAnchors()`** — единый якорь для prep + battle/replay на mobile: toolbar, bottom/right FAB
- **Токены:** `--prep-mobile-fab-bottom`, `--prep-mobile-fab-right`, `--prep-doll-layer-bottom`, `--prep-mobile-edge-inset`
- **`battle-build-stats` FAB** — вместо `56px`/`12px` → zone tokens от `#bottom-chrome`
- **Doll toggle + doll layer** — `--prep-mobile-fab-bottom` / `--prep-doll-layer-bottom`
- **`test:geometry`** — `iphone-portrait-mobile-fab-anchors`

### Этап N (modal dedup, prep zone anchors)

- **`modal-scale.css`** — единый источник для `.modal` / `.overlay > .modal` (типографика, padding, compact)
- **`styles.css`** — убраны дубли `.modal`; структурные правила модалок (run-complete, class-overlay) остаются
- **Mobile prep anchors** — `measureLayoutZones()` пишет `--prep-canvas-zone-bottom`, `--prep-hero-zone-*`, `--prep-toolbar-zone-top`
- **FAB / shop sheet** — `--prep-shop-fab-size`, `--prep-shop-sheet-max-h` от `--app-h` / `--touch-target-min`
- **`syncMobileShopFabPosition`** — после `measureLayoutZones`, без magic `56px` / `12px`

### Этап M (replay timeline, modal tokens)

- **`replay-chrome.css`** + **`replay-timeline.js`** — полоса прогресса в bottom-chrome при `data-phase="replay"`
- Скраб по тапу/перетаскиванию, стрелки на фокусе; ширина в `%` / `vw`, не фикс. px
- На phone timeline на всю ширину центра, журнал событий скрыт
- **`modal-scale.css`** — базовый `.overlay > .modal` на `--ui-scale` / `--font-*`

### Этап L (battle FX profile, float scale, modals)

- **`BATTLE_PROFILES`** — `fxFloatScale` / `fxProjectileScale` → `--fx-float-scale`, `--fx-projectile-scale`
- **`battle-float-layer.js`** — траектории через `battleFxPx()` (viewport, не canvas px)
- **`LayoutScales`** — `fxFloatScale()`, `battleFxPx()` для FX
- **`battle-scale.css`** — компактные летящие числа на phone-профилях
- **`modal-scale.css`** — class overlay fluid type, battle-detail, board-preview
- **Phone landscape prep** — `side` + `tablet-side` (как iPad Mini)

### Этап J (battle auto-scale)

- Убран штраф `--battle-emoji-scale` 0.72 на phone
- `EMOJI_SIZE_BY_PROFILE` — крупнее на phone/tablet, центр в высоком combat floor
- `syncBattleHudAnchors` — якорь под `.avatar-hero-upper` / badge, не на тело портрета
- `battle-scale.css` — типографика HP/эмодзи по `data-battle-profile`

### Этап K (modals, tablet battle, mobile scale)

- **`modal-scale.css`** — container queries для recipe/settings/battle-result/run-complete
- **Phone prep** — `fitMinScale: 0.65`, `--ui-scale` floor 0.58 на tier phone, type boost 1.18
- **Tablet landscape battle** — `BATTLE_PROFILES` floorShare 0.30, `tablet-side.css` combat floor

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

- **Phone landscape prep** — `side` + `tablet-side` (магазин справа, как iPad Mini)
- **`styles/phone-landscape.css`** — бой по `data-layout-profile="phone-landscape"`
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
