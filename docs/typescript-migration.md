# Миграция на TypeScript

Постепенный переход: **источник правды — `.ts`**, рядом лежит transpiled `.js` для `file://` и Playwright.

## Уже на TypeScript

| Модуль | Назначение |
|--------|------------|
| `systems/runtime-loader.ts` | ленивая подгрузка lobby/hardbot |
| `systems/presentation-clock.ts` | единый scheduler визуальных каналов боя |
| `systems/layout-scales.ts` | CSS-масштабы UI (`LayoutScales`) |
| `systems/input-mode.ts` | touch / mouse / gamepad |
| `systems/battle-speed.ts` | скорость и пауза боя |
| `systems/prep-hud-preset.ts` | пресет HUD (hero-card / unit-frame) |
| `systems/visual-theme.ts` | визуальные темы (meadow / diablo) |
| `systems/emoji-orbit-speed.ts` | скорость орбиты эмодзи-стаков |
| `systems/prep-countdown.ts` | отсчёт 3-2-1 и окно результата боя |
| `systems/battle-fx-tier.ts` | perf tier / light battle FX |
| `systems/lobby-runtime-stub.ts` | заглушки lobby до lazy-load |
| `systems/screen-transitions.ts` | переходы intro / prep / battle / results |
| `systems/craft-pending.ts` | отложенный крафт между раундами |
| `systems/build-tracker.ts` | отслеживание билда в магазине |
| `systems/prep-sfx.ts` | звуки prep (магазин, скамейка, покупки) |
| `systems/sound-theme.ts` | темы звука (localStorage) |
| `systems/mechanic-tags.ts` | подсветка [тегов] в описаниях |
| `systems/placement-slots-catalog.ts` | каталог слотов ⭐/◆ |
| `systems/item-unlock-tiers.ts` | разблокировка предметов по уровню |
| `systems/craft-preview.ts` | подсветка партнёров крафта при drag |
| `systems/crafting.ts` | рецепты и детекция кластеров |
| `systems/placement-slots.ts` | логика слотов ⭐/◆ на поле |
| `systems/meta-progress.ts` | мета-прогресс между забегами |
| `systems/build-keys.ts` | ключи веток в магазине |
| `systems/prep-shop.ts` | магазин и скамейка в prep |

**Не трогаем** (выпиливаются отдельно): `mutations`, `mutation-ui`, `mutation-capstones`, `mutation-progress-hints`.

`tools/compile-ts.mjs` автоматически находит все `systems/*.ts`.

## Рабочий цикл

```bash
# После правки .ts
npm run compile:ts      # esbuild → systems/*.js
npm run typecheck       # compile:ts + checkJs + strict TS
```

Коммитьте **и `.ts`, и сгенерированный `.js`** — тесты на `file://` не требуют сборки.

## Добавить новый модуль

1. Создать `systems/my-module.ts` (или переименовать `.js` → `.ts`)
2. При необходимости — типы в `types/game.d.ts` / `types/globals.d.ts`
3. `npm run compile:ts && npm run typecheck`

Отдельная регистрация в `compile-ts.mjs` **не нужна**.

## checkJs (без .ts)

`tsconfig.json` — мягкая проверка JS:

- `systems/item-pool-120.js`

## Дальше

- Переводить изолированные `systems/*` по одному (`synergy`, `combat`, …)
- `items.js` / `game.js` — в конце (много глобальных связей)
- Полный ESM (`import`/`export`) — после большинства systems
