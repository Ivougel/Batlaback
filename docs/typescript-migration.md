# Миграция на TypeScript

Постепенный переход: **источник правды — `.ts`**, рядом лежит transpiled `.js` для `file://` и Playwright.

## Уже на TypeScript

| Модуль | Назначение |
|--------|------------|
| `systems/runtime-loader.ts` | ленивая подгрузка combat-feed |
| `systems/presentation-clock.ts` | единый scheduler визуальных каналов боя |
| `systems/layout-scales.ts` | CSS-масштабы UI (`LayoutScales`) |
| `systems/input-mode.ts` | touch / mouse / gamepad |
| `systems/battle-speed.ts` | скорость и пауза боя |
| `systems/prep-hud-preset.ts` | пресет HUD (hero-card / unit-frame) |
| `systems/visual-theme.ts` | визуальные темы (meadow / diablo) |
| `systems/emoji-orbit-speed.ts` | скорость орбиты эмодзи-стаков |
| `systems/prep-countdown.ts` | отсчёт 3-2-1 и окно результата боя |
| `systems/battle-fx-tier.ts` | perf tier / light battle FX |
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
| `systems/item-presentation.ts` | unlock/locked состояние предметов |
| `systems/triple-support-items.ts` | опоры троек + bias магазина |
| `systems/synergy.ts` | синергии и подсветка клеток |
| `systems/item-locale.ts` | русские строки предметов для тултипов |
| `systems/tooltip-effect-text.ts` | человекочитаемые строки эффектов в тултипах |
| `systems/gem-sockets.ts` | камни в сокетах предметов |
| `systems/meta-effects.ts` | мета-эффекты вне боя (магазин, золото, recombo) |
| `systems/sfx.ts` | Web Audio SFX, громкость, глобальные клики |
| `systems/music.ts` | фоновая музыка, плейлист, настройки |
| `systems/battle-debuffs.ts` | дебаффы, оглушение, перерождение |
| `systems/battle-stacks.ts` | боевые стаки (шипы, блок, усиление…) |
| `systems/animation.ts` | анимации боя, летящие числа, пульсация |
| `systems/arena-attack-styles.ts` | стили атак экипировки манекена + thought reactions |
| `systems/attack-events.ts` | декoupled события атаки для визуального слоя |
| `systems/battle-analyzer.ts` | метрики боя для UI (DPS, прогноз лечения) |
| `systems/stack-orbit-vfx.ts` | орбита стаков вокруг аватара + снаряды fireStack |
| `systems/dialogue-catalog.ts` | каталог реплик, голоса героев, emoji-диалоги |
| `systems/dialogue-engine.ts` | сквозные диалоги забега (DialogueEngine) |

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

- Переводить изолированные `systems/*` по одному (`combat-profile`, `battle-hero-anchor`, …)
- `items.js` / `game.js` — в конце (много глобальных связей)
- Полный ESM (`import`/`export`) — после большинства systems
