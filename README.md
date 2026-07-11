# Batlaback

Клон Backpack Battles (браузер).

**Engine baseline (classic solo):** tag `engine-baseline-classic` — см. [docs/BASELINE.md](docs/BASELINE.md).  
Hotseat-режим разрабатывается от этой точки (ветка `hotseat`).

## Разработка

```bash
npm install
npm run dev          # Vite dev-сервер, index.html (115 скриптов)
npm run dev:bundle   # один classic-бандл (~2 MB), index.vite.html
npm run build        # production → dist/ (бандл + ассеты)
npm run preview      # проверить dist/ локально
npm run lint         # Biome (tools/ + конфиги)
npm run typecheck    # checkJs на systems/*
npm run test:unit    # Vitest: game logic без браузера
npm run test:ui      # layout + snapshots (Playwright)
```

`index.html` не меняется — Playwright-тесты на `file://` работают как раньше.
Production-сборка: `dist/index.html` + `dist/generated/legacy-app-core.js` (1 HTTP-запрос вместо 115).

### TypeScript

```bash
npm run compile:ts   # systems/*.ts → systems/*.js
npm run typecheck    # checkJs + strict TS
```

См. [docs/typescript-migration.md](docs/typescript-migration.md).

## Предметы

Правки в **`tools/items-migrated.json`**, затем:

```bash
bash tools/build-catalog.sh
```

Подробно: `tools/CATALOG.md`
