# Engine baseline — classic (solo vs AI)

> **Зафиксировано:** 2026-07-11  
> **Git tag:** `engine-baseline-classic`  
> **Commit:** `53d3d37` — *Improve PWA prep perf and smooth screen transitions.*

Это **базовая сборка движка** перед разработкой режима **hotseat** (два игрока на одном устройстве).  
Все изменения hotseat ведутся **от этой точки**, не ломая solo-classic без явного намерения.

---

## Что входит в baseline

| Область | Состояние |
|---------|-----------|
| **Режим игры** | Только `classic` — игрок vs ИИ (`game.js`: `GAME_MODE = "classic"`) |
| **Intro** | 2 шага: выбор класса → summary → старт |
| **Prep** | Поле 9×7, магазин 5 слотов, скамейка, pool v120, крафт BB |
| **Battle** | Автобой, replay, bottom-chrome |
| **Layout** | 5 профилей: iPhone P/L, iPad P/L, desktop ([LAYOUT.md](../LAYOUT.md)) |
| **BB Fidelity** | UX classic (storage physics, VS overlay, run complete) |
| **TypeScript** | `systems/*.ts` → compile pipeline |
| **PWA** | Precache, iPad mini PWA как опциональный visual ref |

## Что **не** входит (ещё в работе)

- Раздельный счётчик жизней для обоих игроков hotseat
- Параллельный split-screen prep (сейчас строго поочерёдный)

## Что уже есть (hotseat MVP)

- Режим `hotseat` в intro (`#class-step-mode`)
- Выбор класса игрока 2 (`#class-step-opponent`)
- Поочерёдный prep + `#hotseat-handoff-overlay`
- Без AI shopping на стороне игрока 2
- Те же BB-правила classic (max account, без спутников)

---

## Как вернуться к baseline

```bash
git checkout engine-baseline-classic
# или
git checkout main   # если tag на HEAD main
git diff engine-baseline-classic   # должно быть пусто на main в момент фиксации
```

## Проверка перед hotseat-работой

```bash
npm run test:meta          # логика classic, крафт, prep board
npm run test:layout        # профили viewport (Playwright)
npm run test:structure     # DOM-контракт
npm run test:geometry      # зоны и fit
npm run test:snapshots     # визуальные эталоны prep/battle
```

Машиночитаемый контракт UI: [tools/ui-structure-manifest.json](../tools/ui-structure-manifest.json).

---

## Ветка разработки hotseat

```bash
git checkout hotseat    # feature-ветка от baseline
```

Правила для агента при hotseat-изменениях:

1. **Не менять** solo-classic поведение без feature-flag / `gameMode` guard.
2. Новый режим → `data-game-mode="hotseat"`, обновить manifest + [ui-screens-modes.md](ui-screens-modes.md).
3. Прогонять `npm run test:ui` на всех профилях перед merge.
4. Регресс classic: `npm run test:meta && npm run test:structure`.

---

## Связанные документы

- [ui-screens-modes.md](ui-screens-modes.md) — экраны и фазы
- [LAYOUT.md](../LAYOUT.md) — адаптивный HUD
- `.cursor/rules/prep-hud-layout-baseline.mdc` — правило доступности UI
