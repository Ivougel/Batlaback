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

## Что **не** входит (задача hotseat)

- Режим `hotseat` / `versus` как отдельный `gameMode`
- Выбор класса для игрока 2
- Поочерёдный prep (pass-and-play)
- Раздельные экономики / магазины двух игроков
- Hotseat intro flow

Инфраструктура для versus UX частично есть (`bb-fidelity.js`, `bb-intro-layout.js`, `bb-vs-overlay.js`), но **не активирована** — `BB_FIDELITY_MODES = new Set(["classic"])`.

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
