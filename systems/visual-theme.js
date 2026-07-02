/**
 * Визуальные темы оформления (localStorage: bb-visual-theme).
 * meadow — текущий «Луг»; diablo — тёмное Sanctuary на том же заднике.
 */

const VISUAL_THEME_STORAGE_KEY = "bb-visual-theme";

const VISUAL_THEMES = {
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

function getVisualThemeId() {
  try {
    const stored = localStorage.getItem(VISUAL_THEME_STORAGE_KEY);
    return VISUAL_THEMES[stored] ? stored : "meadow";
  } catch (_) {
    return "meadow";
  }
}

function getVisualThemeMeta(themeId = getVisualThemeId()) {
  return VISUAL_THEMES[themeId] || VISUAL_THEMES.meadow;
}

function applyVisualTheme(themeId) {
  const theme = getVisualThemeMeta(themeId);
  const root = document.documentElement;
  root.dataset.visualTheme = theme.id;
  try {
    localStorage.setItem(VISUAL_THEME_STORAGE_KEY, theme.id);
  } catch (_) { /* ignore */ }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme.themeColor);

  if (typeof drawBackground === "function") {
    try {
      drawBackground();
      if (typeof render === "function") render();
    } catch (_) { /* canvas may not exist yet */ }
  }

  syncVisualThemeSettingsUi();
}

function syncVisualThemeSettingsUi() {
  const current = getVisualThemeId();
  document.querySelectorAll('input[name="visual-theme"]').forEach((input) => {
    input.checked = input.value === current;
  });
  document.querySelectorAll(".settings-theme-option").forEach((label) => {
    const input = label.querySelector('input[name="visual-theme"]');
    label.classList.toggle("is-selected", input?.value === current);
  });
}

function initVisualTheme() {
  applyVisualTheme(getVisualThemeId());
}

function initVisualThemeControls() {
  document.querySelectorAll('input[name="visual-theme"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      if (!e.target.checked) return;
      applyVisualTheme(e.target.value);
    });
  });
  syncVisualThemeSettingsUi();
}
