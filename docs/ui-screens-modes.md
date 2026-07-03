# UI — экраны, режимы и окна

> **Зафиксировано:** 2026-07-03. Источник правды для структуры окон и режимов.  
> Геометрия и профили viewport: [LAYOUT.md](../LAYOUT.md). Принципы UX: [UI_UX.md](../UI_UX.md).  
> Машиночитаемый реестр: [tools/ui-structure-manifest.json](../tools/ui-structure-manifest.json).

## Как не сломать контракт

1. Новый экран / overlay → добавить в `ui-structure-manifest.json` и прогнать `npm run test:structure`.
2. Новый `data-game-mode` или шаг intro → обновить этот документ и manifest.
3. Визуальные изменения prep/battle/class → `npm run test:snapshots` (обновить эталоны: `npm run test:snapshots:update`).
4. Не смешивать TD-only UI с лобби/solo prep (пример: `#td-hint-bar` только при `data-td-run-live="true"`).

---

## Дерево приложения

```
body
├── #class-overlay          ← меню / intro (до забега)
├── #app                    ← основная игра
│   ├── prep-left-column    ← поле, герой HUD, TD-карта
│   ├── #shop-panel         ← магазин + скамейка
│   ├── #td-build-panel     ← TD: магазин/башни (только td live)
│   ├── #td-loadout-sheet   ← TD: рюкзак 6×6
│   └── #td-hero-sheet      ← TD: мутации героя
├── #bottom-chrome          ← toolbar (prep / battle / replay)
├── #escape-menu-overlay
├── #settings-overlay
├── #overlay                ← конец забега
├── #battle-result-overlay
├── #battle-detail-overlay
├── #board-preview-overlay
└── #recipe-book-overlay
```

---

## Режимы игры (`gameMode` / `data-game-mode`)

| ID | Название | Противник | Особенности prep |
|----|----------|-----------|------------------|
| `solo` | Одиночная | ИИ | Стандартный prep, магазин, скамейка |
| `versus` | Противостояние | 2-й игрок | Переключение `data-prep-side` player/enemy |
| `hardbot` | Сложный бот | Hard AI | Как solo, усиленный бот |
| `lobby` | Лобби | 8 ghost-бойцов | `#lobby-prep-roster-panel`, таймер prep, без TD-подсказок |
| `td` | Tower Defense | Волны свиней | Карта, башни, `#td-build-panel`, `data-td-run-live` в бою |
| `campaign` | Кампания | Тренировочный манекен | Фиксированный магазин по урокам, `#campaign-hint-bar`, бои с ослабленным манекеном |

**Intro-поток по режимам:**

| Режим | Шаги class-overlay |
|-------|-------------------|
| solo, hardbot, lobby | mode → player → companion → summary → старт |
| versus | mode → player → companion → summary → **opponent** → старт |
| td | mode → **td-difficulty** → player → companion → summary → старт |
| campaign | mode → **campaign-trial** → player → companion → summary → старт |

---

## Фазы (`phase` в JS / `data-phase` на `#app`)

| `phase` (JS) | `#app[data-phase]` | Экран |
|--------------|---------------------|-------|
| `classSelect` | *(overlay виден, app скрыт)* | Меню выбора |
| `prep` | `prep` | Подготовка: поле 9×7, магазин, скамейка |
| `battle` | `battle` | Бой: два поля, аватары, combat floor |
| `replay` | `replay` | Повтор боя + timeline в bottom-chrome |

**TD-подфаза:** при `gameMode=td` и активном забеге `isTdRunLive()` → `phase=battle`, но UI prep-героя (`data-prep-hero-hud`) и TD-хром (`data-td-run-live="true"`).

---

## Intro overlay (`#class-overlay`)

Атрибут шага: `data-class-intro-step` (`CLASS_INTRO_STEPS` в `game.js`).

| step key | DOM id | Содержимое |
|----------|--------|------------|
| `mode` | `#class-step-mode` | 5 карточек режима |
| `tdDifficulty` | `#class-step-td-difficulty` | 5 сложностей TD |
| `campaignTrial` | `#class-step-campaign` | Испытания кампании |
| `player` | `#class-step-player` | 4 класса + галерея мутаций |
| `companion` | `#class-step-companion` | Сетка спутников |
| `summary` | `#class-step-summary` | Итог + кнопка «Старт» |
| `opponent` | `#class-step-opponent` | Класс соперника (только versus) |

Пока overlay открыт: `body` без `screen-app-visible`, `#app` может быть скрыт transition-ом.

---

## Основной экран prep (`#app[data-phase="prep"]`)

### Колонки

| Зона | id / класс | Роль |
|------|------------|------|
| Левая колонка | `.prep-left-column` | HUD героя + поле |
| Верхняя панель | `#prep-top-bar` / `#prep-hero-card` | Портрет, статы, мутации |
| Поле | `#prep-field-column` → `#prep-field-island` → `#game-canvas` | Сетка 9×7 |
| Герой на сцене | `#prep-character-layer` | Full-bleed модель слева/справа |
| Ростер лобби | `#lobby-prep-roster-panel` | Список 8 бойцов (lobby) |
| Магазин | `#shop-panel` | 4 слота + продажа |
| Скамейка | `#bench-panel` | 6 слотов запаса |
| Низ | `#bottom-chrome` | Навигация, золото, HP, «БОЙ» |

### TD-only в prep-колонке (не показывать в lobby/solo)

| Элемент | Условие видимости |
|---------|-------------------|
| `#td-hint-bar` | `data-game-mode=td` + `data-td-run-live=true` |
| `#td-build-panel` | TD live |
| `#btn-td-loadout` | TD live |
| `#td-tower-panel` | Выбор слота башни |

---

## Экран battle / replay

| Зона | id | Роль |
|------|-----|------|
| Поле боя | `#prep-field-island` (двойная сетка) | player + enemy grids |
| Сцена | `#battle-scene-ui` | Портреты flank-arena |
| Combat floor | `#battle-thought-arena` | Эмодзи-дуэль |
| HUD | `#battle-hud-player` / `#battle-hud-enemy` | HP, stamina |
| Журнал | `#combat-feed-panel` | Лента событий |
| Replay | timeline в `#bottom-chrome` | `data-phase=replay` |

**TD battle:** `#td-arena-mount`, `#td-arena-canvas` вместо классического поля; `data-battle-hero-placement` сброшен.

---

## Модальные окна и sheets

| id | Тип | Когда |
|----|-----|-------|
| `#class-overlay` | fullscreen intro | До забега / возврат в меню |
| `#escape-menu-overlay` | pause menu | Escape / меню |
| `#settings-overlay` | настройки | Из escape-menu |
| `#overlay` | run complete | Конец забега (победа/поражение) |
| `#battle-result-overlay` | итог раунда | После боя |
| `#battle-detail-overlay` | детали боя | По клику из результата |
| `#board-preview-overlay` | превью доски | Синергии / просмотр |
| `#recipe-book-overlay` | рецепты | Кнопка «Рецепты» |
| `#td-loadout-sheet` | bottom sheet | Рюкзак башни 6×6 |
| `#td-hero-sheet` | bottom sheet | Мутации TD-героя |
| `#run-stats-popover` | popover | Статистика забега из HUD |

---

## Матрица layout (viewport → поверхность)

См. [LAYOUT.md](../LAYOUT.md). Кратко:

| Устройство | `data-layout-profile` | `data-ui-surface` | prep |
|------------|----------------------|-------------------|------|
| iPhone portrait | `phone-portrait` | `phone-drawer` | stacked + drawer shop |
| iPhone landscape | `phone-landscape` | `tablet-side` | side, как iPad mini |
| iPad portrait | `tablet-portrait` | `tablet-stacked` | вертикальный стек |
| iPad landscape PWA | `tablet-landscape` | `tablet-side` | **крупная сетка**, магазин справа |
| Desktop | `desktop-landscape` | `desktop` | side-by-side |

Ключевые `data-*` на `<html>`:

- `data-ui-tier`, `data-prep-layout`, `data-ui-surface`, `data-layout-profile`, `data-battle-profile`
- `data-game-mode`, `data-game-phase`
- `data-touch`, `data-prep-side-fit`, `data-prep-viewport-fit`

Ключевые `data-*` на `#app`:

- `data-phase`, `data-game-mode`, `data-prep-side`
- `data-td-run-live`, `data-td-loadout-open`, `data-prep-hero-hud`, `data-doll-open`

---

## Тесты фиксации

```bash
npm run test:structure   # DOM + manifest + профили режимов
npm run test:layout      # 5 viewport-профилей на boot
npm run test:phases      # prep + battle после quick start
npm run test:snapshots   # pixel-эталоны class overlay + prep + battle
npm run test:ui          # всё вместе
```

Обновить снапшоты после намеренного UI-изменения:

```bash
npm run test:snapshots:update
```

---

## Файлы-владельцы

| Область | Файлы |
|---------|-------|
| Режимы / фазы | `game.js` (`renderPhase`, `selectGameMode`, intro steps) |
| Layout / профили | `ui-layout.js` |
| Intro | `index.html` `#class-overlay`, `styles/class-*.css` |
| Prep | `styles/tablet-side.css`, `mobile-prep.css`, `prep-hero-card.css` |
| TD | `styles/td-mode.css`, `td-run-compact.css` |
| Lobby | `lobby*.js`, `#lobby-prep-roster-panel` |
| Overlays | `styles/escape-menu.css`, `modal-scale.css` |
