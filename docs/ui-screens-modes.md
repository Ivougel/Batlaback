# UI — экраны, режимы и окна

> **Зафиксировано:** 2026-07-04. Источник правды для структуры окон и режимов.  
> Геометрия и профили viewport: [LAYOUT.md](../LAYOUT.md). Принципы UX: [UI_UX.md](../UI_UX.md).  
> Машиночитаемый реестр: [tools/ui-structure-manifest.json](../tools/ui-structure-manifest.json).

## Как не сломать контракт

1. Новый экран / overlay → добавить в `ui-structure-manifest.json` и прогнать `npm run test:structure`.
2. Новый `data-game-mode` или шаг intro → обновить этот документ и manifest.
3. Визуальные изменения prep/battle/class → `npm run test:snapshots` (обновить эталоны: `npm run test:snapshots:update`).

---

## Дерево приложения

```
body
├── #class-overlay          ← меню / intro (до забега)
├── #app                    ← основная игра
│   ├── prep-left-column    ← поле, герой HUD
│   └── #shop-panel         ← магазин + скамейка
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
| `solo` | Одиночная | ИИ | Стандартный prep, магазин, скамейка — **полный каталог** |
| `path` | Путь героя | ИИ | Как solo, но **мета-прогрессия**: герои и предметы открываются по уровню |
| `versus` | Противостояние | 2-й игрок | Переключение `data-prep-side` player/enemy |
| `hardbot` | Сложный бот | Hard AI | Как solo, усиленный бот |
| `lobby` | Лобби | 8 ghost-бойцов | `#lobby-prep-roster-panel`, таймер prep |
| `lobby2p` | Лобби 2P | Split-screen | Два игрока + боты |
| `campaign` | Кампания | Тренировочный манекен | Фиксированный магазин по урокам, `#campaign-hint-bar` |

**Intro-поток по режимам:**

| Режим | Шаги class-overlay |
|-------|-------------------|
| solo, path, hardbot, lobby | mode → player → companion → summary → старт |
| lobby2p | mode → player → companion → класс P2 → спутник P2 → старт |
| versus | mode → player → companion → summary → **opponent** → старт |
| campaign | mode → **campaign-trial** → player → companion → summary → старт |

---

## Фазы (`phase` в JS / `data-phase` на `#app`)

| `phase` (JS) | `#app[data-phase]` | Экран |
|--------------|---------------------|-------|
| `classSelect` | *(overlay виден, app скрыт)* | Меню выбора |
| `prep` | `prep` | Подготовка: поле 9×7, магазин, скамейка |
| `battle` | `battle` | Бой: два поля, аватары, combat floor |
| `replay` | `replay` | Повтор боя + timeline в bottom-chrome |

---

## Intro overlay (`#class-overlay`)

Атрибут шага: `data-class-intro-step` (`CLASS_INTRO_STEP_IDS` в `game.js`).

| step key | DOM id | Содержимое |
|----------|--------|------------|
| `mode` | `#class-step-mode` | Карточки режима |
| `campaignTrial` | `#class-step-campaign` | Испытания кампании |
| `player` | `#class-step-player` | 4 класса + галерея мутаций |
| `companion` | `#class-step-companion` | Сетка спутников |
| `summary` | `#class-step-summary` | Итог + кнопка «Старт» |
| `opponent` | `#class-step-opponent` | Класс соперника (только versus) |

---

## Основной экран prep (`#app[data-phase="prep"]`)

| Зона | id / класс | Роль |
|------|------------|------|
| Левая колонка | `.prep-left-column` | HUD героя + поле |
| Верхняя панель | `#prep-top-bar` / `#prep-hero-card` | Портрет, статы, мутации |
| Поле | `#prep-field-column` → `#prep-field-island` → `#game-canvas` | Сетка 9×7 |
| Герой на сцене | `#prep-character-layer` | Full-bleed модель слева/справа |
| Ростер лобби | `#lobby-prep-roster-panel` | Список бойцов (lobby) |
| Магазин | `#shop-panel` | 4 слота + продажа |
| Скамейка | `#bench-panel` | 6 слотов запаса |
| Низ | `#bottom-chrome` | Навигация, золото, HP, «БОЙ» |

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

---

## Модальные окна

| id | Тип | Когда |
|----|-----|-------|
| `#class-overlay` | fullscreen intro | До забега / возврат в меню |
| `#escape-menu-overlay` | pause menu | Escape / меню |
| `#settings-overlay` | настройки | Из escape-menu |
| `#overlay` | run complete | Конец забега |
| `#battle-result-overlay` | итог раунда | После боя |
| `#battle-detail-overlay` | детали боя | По клику из результата |
| `#board-preview-overlay` | превью доски | Синергии / просмотр |
| `#recipe-book-overlay` | рецепты | Кнопка «Рецепты» |
| `#run-stats-popover` | popover | Статистика забега из HUD |

---

## Тесты фиксации

```bash
npm run test:structure
npm run test:layout
npm run test:phases
npm run test:snapshots
npm run test:ui
```

---

## Файлы-владельцы

| Область | Файлы |
|---------|-------|
| Режимы / фазы | `game.js` |
| Layout / профили | `ui-layout.js` |
| Intro | `index.html` `#class-overlay`, `styles/class-*.css` |
| Prep | `styles/tablet-side.css`, `mobile-prep.css`, `prep-hero-card.css` |
| Lobby | `lobby*.js`, `#lobby-prep-roster-panel` |
| Overlays | `styles/escape-menu.css`, `modal-scale.css` |
