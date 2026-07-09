/**
 * Визуальные темы оформления (localStorage: bb-visual-theme).
 * meadow — текущий «Луг»; diablo — тёмное Sanctuary на том же заднике.
 */
import type { VisualThemeId } from "../types/game";

const VISUAL_THEME_STORAGE_KEY = "bb-visual-theme";

interface VisualThemeMeta {
  id: VisualThemeId;
  label: string;
  hint: string;
  emoji: string;
  themeColor: string;
}

const VISUAL_THEMES: Record<VisualThemeId, VisualThemeMeta> = {
  meadow: {
    id: "meadow",
    label: "Луг",
    hint: "Весёлые звери, прозрачный HUD, Nunito",
    emoji: "🌿",
    themeColor: "#5cb85c",
  },
  diablo: {
    id: "diablo",
    label: "Sanctuary",
    hint: "Камень, золото и кровь — как в Diablo",
    emoji: "🔥",
    themeColor: "#1a1210",
  },
};

function getVisualThemeId(): VisualThemeId {
  try {
    const stored = localStorage.getItem(VISUAL_THEME_STORAGE_KEY) as VisualThemeId | null;
    return stored && VISUAL_THEMES[stored] ? stored : "meadow";
  } catch {
    return "meadow";
  }
}

function getVisualThemeMeta(themeId: VisualThemeId = getVisualThemeId()): VisualThemeMeta {
  return VISUAL_THEMES[themeId] || VISUAL_THEMES.meadow;
}

function applyVisualTheme(themeId: string): void {
  const theme = getVisualThemeMeta(themeId as VisualThemeId);
  const root = document.documentElement;
  root.dataset.visualTheme = theme.id;
  try {
    localStorage.setItem(VISUAL_THEME_STORAGE_KEY, theme.id);
  } catch {
    /* ignore */
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme.themeColor);

  if (typeof drawBackground === "function") {
    try {
      drawBackground();
      if (typeof render === "function") render();
    } catch {
      /* canvas may not exist yet */
    }
  }

  syncVisualThemeSettingsUi();
}

function syncVisualThemeSettingsUi(): void {
  const current = getVisualThemeId();
  document.querySelectorAll<HTMLInputElement>('input[name="visual-theme"]').forEach((input) => {
    input.checked = input.value === current;
  });
  document.querySelectorAll(".settings-theme-option").forEach((label) => {
    const input = label.querySelector<HTMLInputElement>('input[name="visual-theme"]');
    label.classList.toggle("is-selected", input?.value === current);
  });
}

function initVisualTheme(): void {
  applyVisualTheme(getVisualThemeId());
}

function initVisualThemeControls(): void {
  document.querySelectorAll<HTMLInputElement>('input[name="visual-theme"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (!target.checked) return;
      applyVisualTheme(target.value);
    });
  });
  syncVisualThemeSettingsUi();
}
