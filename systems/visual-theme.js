// Transpiled from TypeScript — npm run compile:ts

const VISUAL_THEME_STORAGE_KEY = "bb-visual-theme";
const VISUAL_THEMES = {
  meadow: {
    id: "meadow",
    label: "\u041B\u0443\u0433",
    hint: "\u0412\u0435\u0441\u0451\u043B\u044B\u0435 \u0437\u0432\u0435\u0440\u0438, \u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u044B\u0439 HUD, Nunito",
    emoji: "\u{1F33F}",
    themeColor: "#5cb85c"
  },
  diablo: {
    id: "diablo",
    label: "Sanctuary",
    hint: "\u041A\u0430\u043C\u0435\u043D\u044C, \u0437\u043E\u043B\u043E\u0442\u043E \u0438 \u043A\u0440\u043E\u0432\u044C \u2014 \u043A\u0430\u043A \u0432 Diablo",
    emoji: "\u{1F525}",
    themeColor: "#1a1210"
  }
};
function getVisualThemeId() {
  try {
    const stored = localStorage.getItem(VISUAL_THEME_STORAGE_KEY);
    return stored && VISUAL_THEMES[stored] ? stored : "meadow";
  } catch {
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
  } catch {
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme.themeColor);
  if (typeof drawBackground === "function") {
    try {
      drawBackground();
      if (typeof render === "function") render();
    } catch {
    }
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
      const target = e.target;
      if (!target.checked) return;
      applyVisualTheme(target.value);
    });
  });
  syncVisualThemeSettingsUi();
}
