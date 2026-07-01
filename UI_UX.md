# UI / UX — Backpack Battles

Дизайн-система для адаптивного интерфейса игры. Дополняет [LAYOUT.md](./LAYOUT.md) (геометрия и профили).

## Принципы

1. **Touch-first** — интерактивные цели ≥ `var(--touch-target-min)` (44px).
2. **Три масштаба** — `--ui-scale` (панели), `--type-scale` (текст), `--game-scale` (эмодзи/FX). Не смешивать в одном правиле.
3. **Hero-dominant** — карточка героя ведёт композицию; UI может слегка наезжать на модель (HP-бары, имя, чипы).
4. **Full-bleed portrait** — где есть полноразмерный арт (`classIconSrc`, prep sticker), показываем **contain + bleed**, не бюст-кроп.
5. **Слои** — портрет (z1) → HUD/имя/эффекты (z2+) → bottom-chrome (фикс).

## Карточка героя

### Структура (battle)

```
.avatar-hero-shell          overflow: visible
  .avatar-hero-upper
    .avatar-hero-name       ← поверх верха портрета (scrim)
    .avatar-hero-stage       ← full-bleed слой
      .profile-avatar
        .portrait-zoom-clip
          img.profile-avatar-img
  .avatar-hero-effects-panel
#battle-hud-{player|enemy}   ← отдельный слой, overlap на низ портрета
```

### Токены (`styles/tokens.css`)

| Токен | Назначение |
|-------|------------|
| `--hero-portrait-bleed` | Множитель высоты img (1.12 = +12% за пределы stage) |
| `--hero-hud-overlap` | Насколько HP-бары заезжают на портрет |
| `--hero-chrome-scrim` | Градиент под HUD |
| `--hero-name-scrim` | Градиент под именем |
| `--hero-card-min-portrait-h` | Мин. высота stage по профилю |

### Режим `data-hero-card-mode="full-bleed"`

Включается в battle/prep для flank-arena и prep hero. CSS: `styles/hero-card.css`.

- `object-fit: contain`, `object-position: center bottom`
- `overflow: visible` на shell/stage/clip
- Zoom только через `--battle-portrait-zoom` на img (без clip transform)

## Размеры по профилям

Задаёт `ui-layout.js` → `BATTLE_PROFILES` / `PREP_PROFILES`:

| Профиль | Hero zone | imgRatio | portraitZoom |
|---------|-----------|----------|--------------|
| phone-portrait | ~32vh | 0.72 | 1.0 |
| tablet-portrait | ~36% field | 0.68 | 0.98 |
| phone-landscape | ~30% | 0.52 | 0.90 |
| tablet-side | ~28% | 0.52 | 0.84 |

## Class pick overlay

Три шага: **режим → ваш класс → соперник**. Без прокрутки — сетка `1fr` по высоте viewport.

- Подсказка `#class-action-hint` и бейдж `#class-step-badge` обновляются в `syncClassOverlayUi()` (`game.js`)
- Карточки класса: full-bleed sticker + текст поверх градиента (`styles/class-picker.css`)
- Шаг 3: dock «Назад» + «Начать забег» (или «Начать игру» в PvP)

## Overlap (допустимый)

- HP/stamina: `--hero-hud-overlap` (≈14–18px × ui-scale)
- Имя героя: absolute + `--hero-name-scrim`
- Runtime chips: поверх нижней трети портрета
- Debuff stacks: `bottom: 100%` над портретом (уже есть)

## Чеклист QA

- [ ] Портрет не обрезает голову (contain + bottom anchor)
- [ ] HUD читаем на фоне модели (scrim)
- [ ] Touch targets на class cards / toolbar
- [ ] `npm run test:ui` зелёный

## Файлы

| Файл | Роль |
|------|------|
| `styles/hero-card.css` | Full-bleed hero card |
| `styles/battle-hud-compact.css` | HUD overlap + scrim |
| `styles/tokens.css` | Design tokens |
| `ui-layout.js` | Числовые коэффициенты |
| `components/avatar-hero-effects.js` | DOM shell |
